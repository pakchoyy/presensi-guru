import { useState } from "react";
import { X, Smartphone, Clock, Loader2 } from "lucide-react";
import { supabase } from "@/lib/supabase";
import { useToast } from "@/components/shared/Toast";

interface Device {
  _id: string;
  deviceName: string;
  lastActiveAt: number;
  createdAt: number;
  deviceId: string;
}

interface DeviceLimitModalProps {
  isOpen: boolean;
  onClose: () => void;
  devices: Device[];
  tier: string;
  deviceLimit: number;
  onDeviceLoggedOut: () => void;
}

export function DeviceLimitModal({
  isOpen,
  onClose,
  devices,
  tier,
  deviceLimit,
  onDeviceLoggedOut,
}: DeviceLimitModalProps) {
  const { toast } = useToast();
  const [loggingOut, setLoggingOut] = useState<string | null>(null);

  if (!isOpen) return null;

  const handleLogout = async (deviceId: string) => {
    setLoggingOut(deviceId);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.user) {
        toast("Session tidak ditemukan");
        return;
      }

      await supabase
        .from("devices")
        .delete()
        .eq("user_id", session.user.id)
        .eq("device_id", deviceId);

      toast("Perangkat berhasil logout");
      onDeviceLoggedOut();
    } catch (error: any) {
      toast(error.message || "Gagal logout perangkat");
    } finally {
      setLoggingOut(null);
    }
  };

  const formatDate = (timestamp: number) => {
    const now = Date.now();
    const diff = now - timestamp;
    const minutes = Math.floor(diff / 60000);
    const hours = Math.floor(diff / 3600000);
    const days = Math.floor(diff / 86400000);

    if (minutes < 1) return "Baru saja";
    if (minutes < 60) return `${minutes} menit lalu`;
    if (hours < 24) return `${hours} jam lalu`;
    if (days < 7) return `${days} hari lalu`;
    return new Date(timestamp).toLocaleDateString("id-ID", { day: "numeric", month: "short" });
  };

  return (
    <>
      <div
        className="fixed inset-0 bg-black/50 backdrop-blur-sm z-[100] animate-fade-in"
        onClick={onClose}
      />
      <div className="fixed left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 w-[90%] max-w-md bg-[var(--card-bg)] rounded-2xl shadow-xl z-[101] border border-[var(--border)] animate-slide-up">
        <div className="flex items-center justify-between p-4 border-b border-[var(--border)]">
          <div>
            <h2 className="text-base font-bold">Batas Perangkat Tercapai</h2>
            <p className="text-[0.75rem] text-[var(--text-light)] mt-0.5">
              Tier {tier} maksimal {deviceLimit} perangkat
            </p>
          </div>
          <button
            onClick={onClose}
            className="p-2 hover:bg-[var(--hover-bg)] rounded-lg transition-colors"
          >
            <X size={18} />
          </button>
        </div>

        <div className="p-4">
          <p className="text-[0.8rem] text-[var(--text-light)] mb-4">
            Logout dari salah satu perangkat untuk melanjutkan login, atau upgrade ke PRO untuk 3 perangkat.
          </p>

          <div className="space-y-2">
            {devices.map((device) => (
              <div
                key={device._id}
                className="flex items-center gap-3 p-3 bg-[var(--bg)] rounded-lg border border-[var(--border)]"
              >
                <div className="flex-shrink-0">
                  <Smartphone size={20} className="text-[var(--text-light)]" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="text-[0.8rem] font-medium truncate">
                    {device.deviceName}
                  </div>
                  <div className="flex items-center gap-1 text-[0.7rem] text-[var(--text-light)] mt-0.5">
                    <Clock size={12} />
                    <span>{formatDate(device.lastActiveAt)}</span>
                  </div>
                </div>
                <button
                  onClick={() => handleLogout(device.deviceId)}
                  disabled={loggingOut !== null}
                  className="flex-shrink-0 px-3 py-1.5 text-[0.75rem] bg-red-500 text-white rounded-lg hover:bg-red-600 disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center gap-1.5"
                >
                  {loggingOut === device.deviceId ? (
                    <>
                      <Loader2 size={12} className="animate-spin" />
                      <span>Logout...</span>
                    </>
                  ) : (
                    <span>Logout</span>
                  )}
                </button>
              </div>
            ))}
          </div>
        </div>

        {tier === "FREE" && (
          <div className="p-4 border-t border-[var(--border)] bg-blue-50 dark:bg-blue-950/20">
            <p className="text-[0.75rem] text-blue-600 dark:text-blue-400">
              Upgrade ke PRO untuk menggunakan hingga 3 perangkat sekaligus
            </p>
          </div>
        )}
      </div>
    </>
  );
}
