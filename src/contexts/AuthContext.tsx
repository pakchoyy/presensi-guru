import { createContext, useContext, useState, useEffect, ReactNode } from "react";
import { supabase } from "@/lib/supabase";
import { syncService } from "@/services/sync.service";

interface User {
  id: string;
  email: string;
  name: string;
  tier: "FREE" | "PRO";
}

interface Device {
  _id: string;
  deviceName: string;
  lastActiveAt: number;
  createdAt: number;
  deviceId: string;
}

interface DeviceLimitError {
  isDeviceLimitError: boolean;
  message: string;
  devices: Device[];
  tier: string;
  deviceLimit: number;
}

interface AuthContextType {
  user: User | null;
  token: string | null;
  loading: boolean;
  login: (email: string, password: string) => Promise<void>;
  register: (email: string, password: string, name: string) => Promise<void>;
  logout: () => Promise<void>;
  isAuthenticated: boolean;
  deviceLimitError: DeviceLimitError | null;
  clearDeviceLimitError: () => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

const DEVICE_ID_KEY = "presensi_device_id";

function getDeviceId(): string {
  let deviceId = localStorage.getItem(DEVICE_ID_KEY);
  if (!deviceId) {
    deviceId = `device-${Date.now()}-${Math.random().toString(36).substring(2)}`;
    localStorage.setItem(DEVICE_ID_KEY, deviceId);
  }
  return deviceId;
}

function getDeviceName(): string {
  const ua = navigator.userAgent;
  let browser = "Browser";
  let os = "Unknown";

  if (ua.includes("Chrome")) browser = "Chrome";
  else if (ua.includes("Firefox")) browser = "Firefox";
  else if (ua.includes("Safari")) browser = "Safari";
  else if (ua.includes("Edge")) browser = "Edge";

  if (ua.includes("Windows")) os = "Windows";
  else if (ua.includes("Mac")) os = "Mac";
  else if (ua.includes("Linux")) os = "Linux";
  else if (ua.includes("Android")) os = "Android";
  else if (ua.includes("iOS")) os = "iOS";

  return `${browser} on ${os}`;
}

async function checkDeviceLimit(userId: string): Promise<{ allowed: boolean; devices: Device[]; tier: string; limit: number }> {
  const { data: profile } = await supabase
    .from("profiles")
    .select("tier")
    .eq("id", userId)
    .single();

  const tier = profile?.tier || "FREE";
  const limit = tier === "PRO" ? 3 : 1;

  const { data: activeDevices } = await supabase
    .from("devices")
    .select("id, device_id, device_name, last_active_at, created_at")
    .eq("user_id", userId);

  const devices: Device[] = (activeDevices || []).map((d: any) => ({
    _id: String(d.id),
    deviceName: d.device_name,
    lastActiveAt: d.last_active_at,
    createdAt: d.created_at,
    deviceId: d.device_id,
  }));
  const deviceId = getDeviceId();

  const existingDevice = devices.find((d) => d.deviceId === deviceId);
  const otherDevices = devices.filter((d) => d.deviceId !== deviceId);

  if (existingDevice) {
    return { allowed: true, devices, tier, limit };
  }

  if (devices.length >= limit) {
    return { allowed: false, devices, tier, limit };
  }

  return { allowed: true, devices, tier, limit };
}

export async function trackDevice(userId: string) {
  const deviceId = getDeviceId();
  const deviceName = getDeviceName();

  const { data: existing } = await supabase
    .from("devices")
    .select("id")
    .eq("user_id", userId)
    .eq("device_id", deviceId)
    .maybeSingle();

  const now = Date.now();
  if (existing) {
    await supabase
      .from("devices")
      .update({ last_active_at: now, device_name: deviceName })
      .eq("id", existing.id);
  } else {
    await supabase.from("devices").insert({
      user_id: userId,
      device_name: deviceName,
      device_id: deviceId,
      last_active_at: now,
      created_at: now,
      ip_address: null,
      user_agent: navigator.userAgent,
    });
  }
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [deviceLimitError, setDeviceLimitError] = useState<DeviceLimitError | null>(null);

  useEffect(() => {
    const init = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (session?.user) {
        const supabaseUser = session.user;
        setToken(session.access_token);

        const { data: profile } = await supabase
          .from("profiles")
          .select("name, tier")
          .eq("id", supabaseUser.id)
          .single();

        setUser({
          id: supabaseUser.id,
          email: supabaseUser.email || "",
          name: profile?.name || supabaseUser.user_metadata?.name || "",
          tier: (profile?.tier as "FREE" | "PRO") || "FREE",
        });
      }
      setLoading(false);
    };

    init();

    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, session) => {
      if (session?.user) {
        setToken(session.access_token);

        const { data: profile } = await supabase
          .from("profiles")
          .select("name, tier")
          .eq("id", session.user.id)
          .single();

        setUser({
          id: session.user.id,
          email: session.user.email || "",
          name: profile?.name || session.user.user_metadata?.name || "",
          tier: (profile?.tier as "FREE" | "PRO") || "FREE",
        });
      } else {
        setToken(null);
        setUser(null);
      }
      setLoading(false);
    });

    return () => subscription.unsubscribe();
  }, []);

  const login = async (email: string, password: string) => {
    const { data, error } = await supabase.auth.signInWithPassword({
      email: email.toLowerCase().trim(),
      password,
    });

    if (error) {
      if (error.message.includes("Invalid login")) {
        throw new Error("Email atau password salah");
      }
      throw new Error(error.message);
    }

    if (!data.user) {
      throw new Error("Gagal login");
    }

    const limitCheck = await checkDeviceLimit(data.user.id);
    if (!limitCheck.allowed) {
      await supabase.auth.signOut();
      setDeviceLimitError({
        isDeviceLimitError: true,
        message: `Batas perangkat tercapai. Tier ${limitCheck.tier} maksimal ${limitCheck.limit} perangkat.`,
        devices: limitCheck.devices.map((d: any) => ({
          _id: d.id.toString(),
          deviceName: d.device_name,
          lastActiveAt: d.last_active_at,
          createdAt: d.created_at,
          deviceId: d.device_id,
        })),
        tier: limitCheck.tier,
        deviceLimit: limitCheck.limit,
      });
      throw new Error("Batas perangkat tercapai. Tier " + limitCheck.tier + " maksimal " + limitCheck.limit + " perangkat.");
    }

    await trackDevice(data.user.id);

    const { data: profile } = await supabase
      .from("profiles")
      .select("name, tier")
      .eq("id", data.user.id)
      .single();

    const currentUser: User = {
      id: data.user.id,
      email: data.user.email || email,
      name: profile?.name || data.user.user_metadata?.name || "",
      tier: (profile?.tier as "FREE" | "PRO") || "FREE",
    };

    if (currentUser.tier === "PRO") {
      setTimeout(async () => {
        try {
          const uploaded = await syncService.initialUpload(email);
          if (uploaded > 0) {
            console.log(`Initial cloud upload completed: ${uploaded} records`);
          }
        } catch (err) {
          console.error("Initial upload failed:", err);
        }
      }, 1000);
    }
  };

  const clearDeviceLimitError = () => {
    setDeviceLimitError(null);
  };

  const register = async (email: string, password: string, name: string) => {
    const { data, error } = await supabase.auth.signUp({
      email: email.toLowerCase().trim(),
      password,
      options: {
        data: { name, tier: "FREE" },
      },
    });

    if (error) throw new Error(error.message);

    if (data.user) {
      await trackDevice(data.user.id);
    }
  };

  const logout = async () => {
    const userId = user?.id;
    const deviceId = getDeviceId();

    if (userId) {
      await supabase.from("devices").delete().eq("user_id", userId).eq("device_id", deviceId);
    }

    await supabase.auth.signOut();
  };

  const value = {
    user,
    token,
    loading,
    login,
    register,
    logout,
    isAuthenticated: !!user,
    deviceLimitError,
    clearDeviceLimitError,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error("useAuth must be used within AuthProvider");
  }
  return context;
}
