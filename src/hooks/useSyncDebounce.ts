import { useState, useRef, useCallback } from "react";
import { syncService } from "@/services/sync.service";
import { useToast } from "@/components/shared/Toast";

const MIN_INTERVAL = 2 * 60 * 1000; // 2 menit (hemat kuota)
const RETRY_BASE = 10_000;
const RETRY_MAX = 60_000;

function dispatchSyncEvent(type: "sync-start" | "sync-end") {
  window.dispatchEvent(new CustomEvent("presensi-sync", { detail: { type } }));
}

export function useSyncDebounce(email: string | null) {
  const [isSyncing, setIsSyncing] = useState(false);
  const [lastSync, setLastSync] = useState(0);
  const { toast } = useToast();

  const lastSyncRef = useRef(0);
  const retryCount = useRef(0);
  const timerRef = useRef<ReturnType<typeof setTimeout>>();
  const pendingRef = useRef(false);

  const doSync = useCallback(async (force = false) => {
    if (!email) return;
    if (pendingRef.current || isSyncing) return;

    const now = Date.now();

    if (!force) {
      if (now - lastSyncRef.current < MIN_INTERVAL) return;
    }

    pendingRef.current = true;
    setIsSyncing(true);
    dispatchSyncEvent("sync-start");

    try {
      const result = await syncService.incrementalSync(email);
      const ts = Date.now();
      lastSyncRef.current = ts;
      setLastSync(ts);
      retryCount.current = 0;
    } catch {
      retryCount.current++;
      const delay = Math.min(RETRY_BASE * Math.pow(2, retryCount.current - 1), RETRY_MAX);
      timerRef.current = setTimeout(() => doSync(false), delay);
      toast("⚠️ Sinkronisasi gagal — dicoba lagi otomatis", "error");
    } finally {
      pendingRef.current = false;
      setIsSyncing(false);
      dispatchSyncEvent("sync-end");
    }
  }, [email, isSyncing, toast]);

  const resetDebounce = useCallback(() => {
    lastSyncRef.current = 0;
  }, []);

  return { sync: doSync, isSyncing, lastSync, resetDebounce };
}
