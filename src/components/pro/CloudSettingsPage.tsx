import { useState, useEffect } from "react";
import { useCloudAuth } from "@/contexts/CloudAuthContext";
import { supabase } from "@/lib/supabase";
import { syncService } from "@/services/sync.service";
import { listCloudBackups, deleteCloudBackup } from "@/services/backup.service";
import { useToast } from "@/components/shared/Toast";
import { showConfirmDialog } from "@/components/shared/ConfirmDialog";
import { useApp } from "@/contexts/AppContext";
import { 
  ArrowLeft, Smartphone, Cloud, Upload, 
  Trash2, Download, Clock, RefreshCw, AlertCircle, Info 
} from "lucide-react";
import { PageName } from "@/types/enums";

export function CloudSettingsPage() {
  const { cloudUser, cloudEmail } = useCloudAuth();
  const { toast } = useToast();
  const { setActivePage } = useApp();
  const [syncing, setSyncing] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [downloading, setDownloading] = useState(false);
  const [deleting, setDeleting] = useState<string | null>(null);
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);
  const [activeDevices, setActiveDevices] = useState<any[]>([]);
  const [cloudBackups, setCloudBackups] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!cloudEmail || !cloudUser) {
      setLoading(false);
      return;
    }
    loadData();
  }, [cloudEmail, cloudUser]);

  async function loadData() {
    if (!cloudUser) return;
    setLoading(true);
    try {
      const { data: devices } = await supabase
        .from("devices")
        .select("id, device_id, device_name, last_active_at, created_at")
        .eq("user_id", cloudUser.id);

      setActiveDevices(devices || []);

      try {
        const backups = await listCloudBackups(cloudEmail!);
        setCloudBackups(backups);
      } catch {
        setCloudBackups([]);
      }
    } catch (err) {
      console.error("Failed to load cloud data:", err);
    }
    setLoading(false);
  }

  const handleManualSync = async () => {
    if (!cloudEmail) return;
    setSyncing(true);
    try {
      const result = await syncService.syncAll(cloudEmail);
      toast(`✅ Sync selesai: ${result.uploaded} upload, ${result.downloaded} download`);
      await loadData();
    } catch (error) {
      toast("❌ Sync gagal. Coba lagi.");
    } finally {
      setSyncing(false);
    }
  };

  const handleForceDownload = async () => {
    if (!cloudEmail) return;
    const ok = await showConfirmDialog({
      title: "Tarik Data dari Cloud?",
      message: "Semua data lokal akan DITIMPA dengan data dari cloud. Pastikan data di cloud sudah yang terbaru.",
      confirmText: "Ya, Tarik",
      cancelText: "Batal",
      danger: true,
    });
    if (!ok) return;

    setDownloading(true);
    try {
      syncService.resetSyncState();
      const downloaded = await syncService.downloadAll(cloudEmail);
      toast(`✅ ${downloaded} data ditarik dari cloud`, "success");
      window.location.reload();
    } catch (error) {
      toast("❌ Gagal tarik data dari cloud", "error");
    } finally {
      setDownloading(false);
    }
  };

  const handleForceUpload = async () => {
    if (!cloudEmail) return;
    const ok = await showConfirmDialog({
      title: "Upload Data ke Cloud?",
      message: "Semua data di cloud akan DITIMPA dengan data lokal device ini. Data di device lain akan diganti.",
      confirmText: "Ya, Upload",
      cancelText: "Batal",
      danger: true,
    });
    if (!ok) return;

    setUploading(true);
    try {
      syncService.resetSyncState();
      const uploaded = await syncService.initialUpload(cloudEmail);
      toast(`✅ ${uploaded} data diupload ke cloud`, "success");
      window.location.reload();
    } catch (error) {
      toast("❌ Gagal upload data ke cloud", "error");
    } finally {
      setUploading(false);
    }
  };

  const handleDeleteBackup = async (backupId: string) => {
    if (!cloudEmail) return;
    setDeleting(backupId);
    setDeleteConfirmId(null);
    try {
      const success = await deleteCloudBackup(cloudEmail, backupId);
      if (success) {
        toast("✅ Backup dihapus");
        await loadData();
      } else {
        toast("❌ Gagal hapus backup");
      }
    } catch (error) {
      toast("❌ Gagal hapus backup");
    } finally {
      setDeleting(null);
    }
  };

  if (!cloudEmail || !cloudUser) {
    return (
      <div className="flex-1 px-[14px] pt-[14px] pb-[90px] lg:pb-4">
        <div className="bg-[var(--card-bg)] rounded-xl border border-[var(--border)] p-[14px] text-center">
          <AlertCircle size={40} className="mx-auto mb-3 text-[var(--text-light)]" />
          <div className="text-[0.85rem] font-bold mb-2">Belum Login</div>
          <p className="text-[0.75rem] text-[var(--text-light)] mb-3">
            Anda harus login terlebih dahulu untuk mengakses Cloud Settings.
          </p>
          <button
            onClick={() => setActivePage(PageName.PENGATURAN)}
            className="px-4 py-2 rounded-lg bg-[#2563eb] text-white font-bold text-[0.78rem]"
          >
            Kembali ke Pengaturan
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex-1 px-[14px] pt-[14px] pb-[90px] lg:pb-4">
      <button
        onClick={() => setActivePage(PageName.PENGATURAN)}
        className="flex items-center gap-2 text-[0.78rem] font-bold text-[#2563eb] mb-3 bg-transparent border-none cursor-pointer"
      >
        <ArrowLeft size={16} /> Kembali
      </button>

      <div className="text-[1.1rem] font-bold mb-3">
        Cloud Sync & Device Management
      </div>

      {/* Auto-Sync Info — prominent at top */}
      <div className="bg-green-50 dark:bg-green-950/20 rounded-xl border border-green-200 dark:border-green-800 p-[14px] mb-3">
        <div className="text-[0.8rem] font-bold flex items-center gap-2 mb-2">
          <Cloud size={15} className="text-green-600 dark:text-green-400" />
          <span className="text-green-900 dark:text-green-100">Sync Otomatis Aktif 🟢</span>
        </div>
        <div className="text-[0.72rem] text-green-900 dark:text-green-100 mb-2">
          Semua perubahan data <b>otomatis</b> tersinkronisasi ke cloud. Tidak perlu klik tombol apapun.
        </div>
        <div className="text-[0.65rem] text-green-700 dark:text-green-300">
          Data yang sama bisa diakses dari HP, laptop, atau tablet manapun — <b>cukup login dengan email yang sama</b>.
        </div>
      </div>

      <div className="bg-[var(--card-bg)] rounded-xl border border-[var(--border)] p-[14px] mb-3">
        <div className="text-[0.8rem] font-bold flex items-center gap-2 mb-3">
          <Smartphone size={15} /> Active Devices ({activeDevices.length}/3)
        </div>
        
        {activeDevices.length > 0 ? (
          <div className="space-y-2">
            {activeDevices.map((device: any) => (
              <div key={device.id || device.device_id} className="flex items-center gap-3 p-3 bg-[var(--input-bg)] rounded-lg border border-[var(--border)]">
                <Smartphone size={16} className="text-[var(--text-light)] flex-shrink-0" />
                <div className="flex-1 min-w-0">
                  <div className="text-[0.78rem] font-semibold truncate">
                    {device.device_name || device.deviceName}
                  </div>
                  <div className="text-[0.68rem] text-[var(--text-light)]">
                    Last active: {formatRelativeTime(device.last_active_at || device.lastActiveAt)}
                  </div>
                </div>
                <span className="text-[0.65rem] text-[var(--text-light)] flex-shrink-0">
                  {(device.device_id || device.deviceId || "").substring(0, 8)}...
                </span>
              </div>
            ))}
          </div>
        ) : (
          <p className="text-[0.75rem] text-[var(--text-light)]">
            Tidak ada device aktif
          </p>
        )}
      </div>

      {/* Manual Backup — hanya untuk backup/darurat */}
      <div className="bg-amber-50 dark:bg-amber-950/20 rounded-xl border border-amber-200 dark:border-amber-800 p-[10px] mb-3 text-center">
        <div className="text-[0.68rem] text-amber-800 dark:text-amber-200">
          ⚠️ Tombol di bawah hanya untuk <b>backup manual / darurat</b>. Normalnya data sync otomatis.
        </div>
      </div>

      {/* Manual Upload / Tarik */}
      <div className="bg-[var(--card-bg)] rounded-xl border border-[var(--border)] p-[14px] mb-3">
        <div className="text-[0.8rem] font-bold flex items-center gap-2 mb-2">
          <Upload size={15} className="text-[#2563eb]" /> Upload & Tarik Manual
        </div>
        <div className="text-[0.68rem] text-[var(--text-light)] mb-3">
          Upload data lokal ke cloud, atau tarik data dari cloud ke device ini.
        </div>
        <div className="flex gap-2">
          <button
            onClick={async () => {
              if (!cloudEmail) return;
              setSyncing(true);
              try {
                await syncService.initialUpload(cloudEmail);
                toast("✅ Upload ke cloud berhasil");
              } catch (error) {
                toast("❌ Upload gagal. Coba lagi.");
              } finally {
                setSyncing(false);
              }
            }}
            disabled={syncing}
            className="flex-1 flex items-center justify-center gap-[5px] py-[9px] rounded-[10px] bg-[#2563eb] text-white font-bold text-[0.75rem] border-none cursor-pointer disabled:opacity-50"
          >
            <Upload size={13} /> {syncing ? "Memproses..." : "Upload ke Cloud"}
          </button>
          <button
            onClick={async () => {
              if (!cloudEmail) return;
              setSyncing(true);
              try {
                const count = await syncService.downloadAll(cloudEmail);
                toast(`✅ Tarik dari cloud berhasil (${count} data)`);
              } catch (error) {
                toast("❌ Tarik gagal. Coba lagi.");
              } finally {
                setSyncing(false);
              }
            }}
            disabled={syncing}
            className="flex-1 flex items-center justify-center gap-[5px] py-[9px] rounded-[10px] border border-[#2563eb] text-[#2563eb] font-bold text-[0.75rem] cursor-pointer bg-transparent disabled:opacity-50"
          >
            <Download size={13} /> {syncing ? "Memproses..." : "Tarik dari Cloud"}
          </button>
        </div>
      </div>

      {/* Sync Sekarang — with dropdown options */}
      <div className="bg-[var(--card-bg)] rounded-xl border border-[var(--border)] p-[14px] mb-3">
        <div className="text-[0.8rem] font-bold flex items-center gap-2 mb-3">
          <RefreshCw size={15} className="text-[#2563eb]" /> Manual Sync
        </div>
        <div className="text-[0.68rem] text-[var(--text-light)] mb-3">
          Pilih opsi sync sesuai kebutuhan. <b>Tarik dari Cloud</b> untuk dapat data terbaru dari device lain. <b>Upload ke Cloud</b> untuk share data lokal ke device lain.
        </div>
        <div className="grid grid-cols-3 gap-2">
          <button
            onClick={handleManualSync}
            disabled={syncing}
            className="flex flex-col items-center gap-1 py-3 rounded-[10px] bg-[#2563eb] text-white font-bold text-[0.72rem] cursor-pointer disabled:opacity-50 border-none"
          >
            <RefreshCw size={16} className={syncing ? "animate-spin" : ""} />
            <span>{syncing ? "Sync..." : "Sync Biasa"}</span>
          </button>
          <button
            onClick={handleForceDownload}
            disabled={downloading}
            className="flex flex-col items-center gap-1 py-3 rounded-[10px] border-[1.5px] border-[#2563eb] bg-white dark:bg-transparent text-[#2563eb] font-bold text-[0.72rem] cursor-pointer disabled:opacity-50"
          >
            <Download size={16} className={downloading ? "animate-bounce" : ""} />
            <span>{downloading ? "Menarik..." : "Tarik Cloud"}</span>
          </button>
          <button
            onClick={handleForceUpload}
            disabled={uploading}
            className="flex flex-col items-center gap-1 py-3 rounded-[10px] border-[1.5px] border-[#2563eb] bg-white dark:bg-transparent text-[#2563eb] font-bold text-[0.72rem] cursor-pointer disabled:opacity-50"
          >
            <Upload size={16} className={uploading ? "animate-bounce" : ""} />
            <span>{uploading ? "Upload..." : "Upload Cloud"}</span>
          </button>
        </div>
      </div>

      {/* Backups */}
      <div className="bg-[var(--card-bg)] rounded-xl border border-[var(--border)] p-[14px]">
        <div className="text-[0.8rem] font-bold flex items-center gap-2 mb-3">
          <Download size={15} /> Cloud Backups
        </div>
        
        {cloudBackups.length > 0 ? (
          <div className="space-y-2">
            {cloudBackups.map((backup: any) => (
              <div key={backup._id} className="flex items-center gap-3 p-3 bg-[var(--input-bg)] rounded-lg border border-[var(--border)]">
                <div className="flex-1 min-w-0">
                  <div className="text-[0.75rem] font-semibold truncate">
                    {backup.label}
                  </div>
                  <div className="text-[0.68rem] text-[var(--text-light)]">
                    {backup.totalEntitas} items
                  </div>
                </div>
                <button
                  onClick={() => setDeleteConfirmId(backup._id)}
                  disabled={deleting !== null}
                  className="p-2 text-red-500 hover:bg-red-50 dark:hover:bg-red-950/20 rounded-lg disabled:opacity-50 flex-shrink-0"
                  title="Hapus backup"
                >
                  {deleting === backup._id ? (
                    <RefreshCw size={14} className="animate-spin" />
                  ) : (
                    <Trash2 size={14} />
                  )}
                </button>
              </div>
            ))}
          </div>
        ) : (
          <p className="text-[0.75rem] text-[var(--text-light)]">
            Belum ada backup
          </p>
        )}
      </div>
      
      {deleteConfirmId && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-[1000] flex items-end lg:items-center justify-center animate-fade-in" onClick={() => setDeleteConfirmId(null)}>
          <div className="bg-[var(--card-bg)] rounded-t-2xl lg:rounded-2xl w-full max-w-[420px] mx-4 px-4 pt-[18px] pb-[22px] animate-slide-up" onClick={(e) => e.stopPropagation()}>
            <div className="w-12 h-1.5 bg-[var(--border)] rounded-full mx-auto mb-[14px]" />
            <div className="text-[0.85rem] font-bold mb-2 text-center text-[#ef4444]">
              Hapus Backup?
            </div>
            <p className="text-[var(--text-light)] text-[0.75rem] text-center mb-[14px]">
              Backup <b className="text-[var(--text)]">{cloudBackups.find(b => b._id === deleteConfirmId)?.label || ""}</b> akan dihapus permanen.
            </p>
            <div className="flex gap-2">
              <button
                onClick={() => setDeleteConfirmId(null)}
                className="flex-1 flex items-center justify-center py-[10px] px-[14px] rounded-[10px] border-[1.5px] border-[var(--border)] bg-[var(--card-bg)] text-[var(--text)] font-bold text-[0.82rem] cursor-pointer"
              >
                Batal
              </button>
              <button
                onClick={() => handleDeleteBackup(deleteConfirmId)}
                disabled={deleting !== null}
                className="flex-1 flex items-center justify-center py-[10px] px-[14px] rounded-[10px] bg-[#ef4444] text-white font-bold text-[0.82rem] cursor-pointer disabled:opacity-60 disabled:cursor-not-allowed"
              >
                {deleting === deleteConfirmId ? "Menghapus..." : "Hapus"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function formatRelativeTime(timestamp: number): string {
  if (!timestamp) return "Unknown";
  const now = Date.now();
  const diff = now - timestamp;
  const minutes = Math.floor(diff / 60000);
  const hours = Math.floor(diff / 3600000);
  const days = Math.floor(diff / 86400000);

  if (minutes < 1) return "Baru saja";
  if (minutes < 60) return `${minutes} menit lalu`;
  if (hours < 24) return `${hours} jam lalu`;
  return `${days} hari lalu`;
}

function formatBytes(bytes: number): string {
  if (bytes < 1024) return bytes + " B";
  if (bytes < 1048576) return (bytes / 1024).toFixed(1) + " KB";
  return (bytes / 1048576).toFixed(1) + " MB";
}
