import { createContext, useContext, useState, useEffect, useRef, ReactNode } from "react";
import { supabase } from "@/lib/supabase";
import { syncService } from "@/services/sync.service";

interface CloudUser {
  id: string;
  email: string;
  name: string;
  tier: string;
}

interface CloudAuthContextType {
  cloudEmail: string | null;
  cloudUser: CloudUser | null;
  isCloudConnected: boolean;
  loading: boolean;
  setCloudEmail: (email: string) => void;
  clearCloudEmail: () => void;
}

const CloudAuthContext = createContext<CloudAuthContextType | undefined>(undefined);

const CLOUD_EMAIL_KEY = "presensi_cloud_email";

export function CloudAuthProvider({ children }: { children: ReactNode }) {
  const [cloudEmail, setCloudEmailState] = useState<string | null>(() => {
    const stored = localStorage.getItem(CLOUD_EMAIL_KEY);

    if (!stored || stored === "null" || stored === "undefined" || !stored.trim()) {
      localStorage.removeItem(CLOUD_EMAIL_KEY);
      return null;
    }

    if (!stored.includes("@") || stored.length < 5) {
      console.warn("[CloudAuth] Invalid email format, clearing:", stored);
      localStorage.removeItem(CLOUD_EMAIL_KEY);
      return null;
    }

    return stored.trim();
  });

  const [cloudUser, setCloudUser] = useState<CloudUser | null>(null);
  const [loading, setLoading] = useState(false);
  const prevConnected = useRef(false);

  useEffect(() => {
    if (!cloudEmail) return;

    const fetchUser = async () => {
      setLoading(true);
      const normalizedEmail = cloudEmail.toLowerCase().trim();

      const { data: profiles } = await supabase
        .from("profiles")
        .select("id, email, name, tier")
        .eq("email", normalizedEmail)
        .limit(1);

      if (profiles && profiles.length > 0) {
        const p = profiles[0];
        setCloudUser({ id: p.id, email: p.email, name: p.name, tier: p.tier });
      } else {
        setCloudUser(null);
      }

      setLoading(false);
    };

    fetchUser();
  }, [cloudEmail]);

  useEffect(() => {
    const isConnected = !!cloudUser;
    if (isConnected && !prevConnected.current && cloudEmail) {
      const normalized = cloudEmail.toLowerCase().trim();
      if (normalized !== cloudEmail) {
        localStorage.setItem(CLOUD_EMAIL_KEY, normalized);
        setCloudEmailState(normalized);
      } else {
        syncService.syncAll(cloudEmail).catch(() => {});
      }
    }
    prevConnected.current = isConnected;
  }, [cloudUser, cloudEmail]);

  const setCloudEmail = (email: string) => {
    localStorage.setItem(CLOUD_EMAIL_KEY, email);
    setCloudEmailState(email);
  };

  const clearCloudEmail = () => {
    localStorage.removeItem(CLOUD_EMAIL_KEY);
    setCloudEmailState(null);
    setCloudUser(null);
  };

  const value = {
    cloudEmail,
    cloudUser,
    isCloudConnected: !!cloudUser,
    loading: cloudEmail !== null && loading,
    setCloudEmail,
    clearCloudEmail,
  };

  return <CloudAuthContext.Provider value={value}>{children}</CloudAuthContext.Provider>;
}

export function useCloudAuth() {
  const context = useContext(CloudAuthContext);
  if (context === undefined) {
    throw new Error("useCloudAuth must be used within CloudAuthProvider");
  }
  return context;
}
