import { createContext, useContext, useState, useEffect, ReactNode } from "react";
import { supabase } from "@/lib/supabase";
import { passwordDariPin } from "@/lib/utils";
import { cloudLoginService } from "@/services/cloud-login.service";

interface User {
  id: string;
  email: string;
  name: string;
  tier: "FREE" | "PRO";
}

interface AuthContextType {
  user: User | null;
  token: string | null;
  loading: boolean;
  /** Tandai perangkat ini lolos batas perangkat (dipanggil setelah OTP + cloud-login berhasil). */
  markDeviceOk: () => void;
  /** Login guru lewat kode (NIP/NUPTK/G-XXXX) + PIN. Memakai synthetic email `${kode}@guru.local`. */
  loginGuru: (kode: string, pin: string) => Promise<void>;
  logout: () => Promise<void>;
  isAuthenticated: boolean;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

// Admin masuk lewat kode email; sesi baru dianggap masuk setelah server menyetujui perangkat ini
// (api/cloud-login). Akun guru (NIP+PIN, email @guru.local) tidak lewat batas ini.
const DEVICE_OK_KEY = "guru_device_ok";
const isGuruAccount = (email?: string | null) => !!email && email.endsWith("@guru.local");

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [okUid, setOkUid] = useState<string | null>(() => localStorage.getItem(DEVICE_OK_KEY));

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

  const markDeviceOk = () => {
    supabase.auth.getSession().then(({ data }) => {
      const uid = data.session?.user?.id;
      if (!uid) return;
      localStorage.setItem(DEVICE_OK_KEY, uid);
      setOkUid(uid);
    });
  };

  const loginGuru = async (kode: string, pin: string) => {
    const k = kode.trim();
    if (!k) throw new Error("Nomor / Kode wajib diisi");
    if (!/^\d{4,6}$/.test(pin.trim())) throw new Error("PIN harus 4-6 digit");
    const syntheticEmail = `${k.toLowerCase()}@guru.local`;
    const { data, error } = await supabase.auth.signInWithPassword({
      email: syntheticEmail,
      password: passwordDariPin(pin),
    });
    if (error) {
      if (error.message.includes("Invalid login")) {
        throw new Error("Kode atau PIN salah");
      }
      throw new Error(error.message);
    }
    if (!data.user) throw new Error("Gagal login");
  };

  const logout = async () => {
    // Lepas jatah perangkat ini di server sebelum sesi dihapus.
    if (!isGuruAccount(user?.email)) await cloudLoginService.release();
    localStorage.removeItem(DEVICE_OK_KEY);
    setOkUid(null);
    await supabase.auth.signOut();
  };

  const value = {
    user,
    token,
    loading,
    markDeviceOk,
    loginGuru,
    logout,
    isAuthenticated: !!user && (isGuruAccount(user.email) || okUid === user.id),
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
