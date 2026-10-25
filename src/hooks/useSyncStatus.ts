import { isPaid, isOnTrial } from "@/lib/features";
import { useState, useEffect } from "react";
import { useOnlineStatus } from "./useOnlineStatus";
import { useCloudAuth } from "@/contexts/CloudAuthContext";
import { useApp } from "@/contexts/AppContext";
import { Tier } from "@/types/enums";
import { supabase } from "@/lib/supabase";

export type SyncStatus = "synced" | "syncing" | "waiting" | "offline" | "not-connected" | "realtime";

export function useSyncStatus() {
  const online = useOnlineStatus();
  const { teacher, setupSelesai } = useApp();
  const { isCloudConnected } = useCloudAuth();
  const [lastSync, setLastSync] = useState(() =>
    parseInt(localStorage.getItem("presensi_last_sync") || "0")
  );
  const [isSyncing, setIsSyncing] = useState(false);
  const [realtimeConnected, setRealtimeConnected] = useState(false);
  // Tanpa sesi login, sinkron sebenarnya tidak jalan — jangan tampil "tersinkron".
  const [hasSession, setHasSession] = useState(false);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => setHasSession(!!data.session));
    const { data } = supabase.auth.onAuthStateChange((_e, session) => setHasSession(!!session));
    return () => data.subscription.unsubscribe();
  }, []);

  useEffect(() => {
    const handleSyncEvent = (e: Event) => {
      const detail = (e as CustomEvent).detail;
      if (detail?.type === "sync-start") setIsSyncing(true);
      if (detail?.type === "sync-end") setIsSyncing(false);
    };
    const handleStorage = () => {
      setLastSync(parseInt(localStorage.getItem("presensi_last_sync") || "0"));
    };
    const handleRealtimeStatus = (e: Event) => {
      setRealtimeConnected(!!(e as CustomEvent).detail?.connected);
    };

    window.addEventListener("presensi-sync", handleSyncEvent);
    window.addEventListener("storage", handleStorage);
    window.addEventListener("data-changed", handleStorage);
    window.addEventListener("realtime-status", handleRealtimeStatus);
    const interval = setInterval(handleStorage, 10_000);

    return () => {
      window.removeEventListener("presensi-sync", handleSyncEvent);
      window.removeEventListener("storage", handleStorage);
      window.removeEventListener("data-changed", handleStorage);
      window.removeEventListener("realtime-status", handleRealtimeStatus);
      clearInterval(interval);
    };
  }, []);

  const isPRO = setupSelesai && (isPaid(teacher?.tier) || isOnTrial(teacher?.tier));

  if (!isPRO) return { status: "not-connected" as SyncStatus, lastSync: 0 };

  if (!online) return { status: "offline" as SyncStatus, lastSync };
  if (!isCloudConnected) return { status: "not-connected" as SyncStatus, lastSync };
  if (!hasSession) return { status: "waiting" as SyncStatus, lastSync };
  if (isSyncing) return { status: "syncing" as SyncStatus, lastSync };
  if (realtimeConnected) return { status: "realtime" as SyncStatus, lastSync };
  if (lastSync === 0) return { status: "waiting" as SyncStatus, lastSync };

  const syncedRecently = Date.now() - lastSync < 5 * 60 * 1000;
  return { status: syncedRecently ? "synced" as SyncStatus : "waiting" as SyncStatus, lastSync };
}
