import { isPaid } from "@/lib/features";
import { useState, useRef, useEffect, useCallback } from "react";
import { useApp } from "@/contexts/AppContext";
import { useCloudAuth } from "@/contexts/CloudAuthContext";
import { useToast } from "@/components/shared/Toast";
import {
  createBackup, downloadBackup, readBackupFile, restoreFromBackup,
  backupToCloud, listCloudBackups, restoreFromCloudBackup, deleteCloudBackup,
  type CloudBackup,
} from "@/services/backup.service";
import { Tier } from "@/types/enums";
import { Database, Download, Upload, RotateCcw, AlertTriangle, Cloud, Lock } from "lucide-react";

export function BackupRestorePage() {
  const { refreshTeachers, teacher } = useApp();
  const { cloudEmail } = useCloudAuth();
  const { toast } = useToast();
  const isPRO = isPaid(teacher?.tier);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const [restoreData, setRestoreData] = useState<any>(null);
  const [restoring, setRestoring] = useState(false);
  const [backingUp, setBackingUp] = useState(false);
  const [cloudBackingUp, setCloudBackingUp] = useState(false);
  const [cloudRestoring, setCloudRestoring] = useState<string | null>(null);
  const [cloudBackups, setCloudBackups] = useState<CloudBackup[]>([]);
  const [loadingCloud, setLoadingCloud] = useState(false);

  const loadCloudBackups = useCallback(async () => {
    if (!isPRO || !cloudEmail) return;
    setLoadingCloud(true);
    const list = await listCloudBackups(cloudEmail);
    setCloudBackups(list);
    setLoadingCloud(false);
  }, [isPRO, cloudEmail]);

  useEffect(() => { loadCloudBackups(); }, [loadCloudBackups]);

  const handleBackup = async () => {
    setBackingUp(true);
    try {
      const blob = await createBackup();
      downloadBackup(blob);
      toast("Backup berhasil dibuat");
    } catch {
      toast("Gagal membuat backup. Coba lagi");
    } finally {
      setBackingUp(false);
    }
  };

  const handleCloudBackup = async () => {
    if (!cloudEmail) return;
    setCloudBackingUp(true);
    try {
      const ok = await backupToCloud(cloudEmail, "manual");
      if (ok) {
        toast("Backup cloud berhasil");
        await loadCloudBackups();
      } else {
        toast("Gagal backup ke cloud. Periksa internet.");
      }
    } catch {
      toast("Gagal backup ke cloud");
    } finally {
      setCloudBackingUp(false);
    }
  };

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const data = await readBackupFile(file);
      setRestoreData(data);
    } catch (err: unknown) {
      toast((err as Error).message || "File backup tidak valid");
    }
  };

  const handleRestore = async () => {
    if (!restoreData) return;
    setRestoring(true);
    try {
      const count = await restoreFromBackup(restoreData);
      toast(`✅ ${count} data berhasil dipulihkan`);
      setRestoreData(null);
      await refreshTeachers();
    } catch {
      toast("Gagal memulihkan backup");
    } finally {
      setRestoring(false);
    }
  };

  const handleCloudRestore = async (backup: CloudBackup) => {
    setCloudRestoring(backup._id);
    try {
      const count = await restoreFromCloudBackup(backup);
      toast(`☁️ ${count} data berhasil dipulihkan dari cloud`);
      await refreshTeachers();
    } catch {
      toast("Gagal memulihkan dari cloud");
    } finally {
      setCloudRestoring(null);
    }
  };

  const formatDate = (ts: number) => {
    const d = new Date(ts);
    return d.toLocaleDateString("id-ID", { weekday: "long", year: "numeric", month: "long", day: "numeric", hour: "2-digit", minute: "2-digit" });
  };

  return (
    <div className="flex-1 px-[14px] pt-[14px] pb-[calc(90px+var(--ticker-h,0px))] lg:pb-4">
      {/* Backup Lokal */}
      <div className="bg-[var(--card-bg)] rounded-xl border border-[var(--border)] p-[14px] mb-3">
        <div className="text-[0.8rem] font-bold flex items-center gap-[6px] mb-[10px]">
          <Database size={15} /> Backup Lokal
        </div>
        <p className="text-[var(--text-light)] text-[0.75rem] mb-3">
          Simpan data kamu sebagai file backup yang bisa dipulihkan kapan saja. Cocok untuk pindah HP atau jaga-jaga.
        </p>
        <button onClick={handleBackup} disabled={backingUp} className="w-full flex items-center justify-center gap-[6px] py-[10px] rounded-[10px] text-white font-bold text-[0.82rem] cursor-pointer disabled:opacity-60 mb-2"
          style={{ background: "linear-gradient(135deg,#3b82f6,#2563eb,#1d4ed8)" }}>
          <Download size={15} /> {backingUp ? "Membuat backup..." : "Buat Backup Lokal"}
        </button>
      </div>

      {/* Backup Cloud (PRO) */}
      {isPRO ? (
        <div className="bg-[var(--card-bg)] rounded-xl border border-[var(--border)] p-[14px] mb-3" style={{ borderColor: "rgba(14,165,160,.3)" }}>
          <div className="text-[0.8rem] font-bold flex items-center gap-[6px] mb-[10px]">
            <Cloud size={15} className="text-[#2563eb]" /> Backup Cloud (PRO)
          </div>
          <p className="text-[var(--text-light)] text-[0.75rem] mb-3">
            Simpan backup langsung ke cloud. Bisa dipulihkan dari device lain dengan akun yang sama.
          </p>
          <button onClick={handleCloudBackup} disabled={cloudBackingUp} className="w-full flex items-center justify-center gap-[6px] py-[10px] rounded-[10px] text-white font-bold text-[0.82rem] cursor-pointer disabled:opacity-60 mb-3"
            style={{ background: "linear-gradient(135deg,#3b82f6,#2563eb,#1d4ed8)" }}>
            <Cloud size={15} /> {cloudBackingUp ? "Mengunggah..." : "Buat Backup Cloud"}
          </button>

          {cloudBackups.length > 0 && (
            <div>
              <div className="text-[0.7rem] font-bold text-[var(--text)] mb-2">Riwayat Backup Cloud</div>
              {cloudBackups.map((b) => (
                <div key={b._id} className="flex items-center gap-2 bg-[var(--input-bg)] rounded-lg p-2 mb-2">
                  <Cloud size={14} className="text-[#2563eb] flex-shrink-0" />
                  <div className="flex-1 min-w-0">
                    <div className="text-[0.7rem] font-semibold">{b.label}</div>
                    <div className="text-[0.62rem] text-[var(--text-light)]">{b.totalEntitas} data</div>
                  </div>
                  <button
                    onClick={() => handleCloudRestore(b)}
                    disabled={cloudRestoring === b._id}
                    className="px-3 py-[6px] rounded-[8px] bg-[#2563eb] text-white text-[0.68rem] font-bold cursor-pointer disabled:opacity-50"
                  >
                    {cloudRestoring === b._id ? "..." : "Pulihkan"}
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      ) : (
        <div className="bg-[var(--card-bg)] rounded-xl border border-[var(--border)] p-[14px] mb-3">
          <div className="text-[0.8rem] font-bold flex items-center gap-[6px] mb-[10px]">
            <Cloud size={15} className="text-[var(--text-light)]" /> Backup Cloud
            <Lock size={11} className="text-[#b45309]" />
          </div>
          <p className="text-[var(--text-light)] text-[0.72rem] mb-2">
            Backup cloud tersedia untuk pengguna PRO. Upgrade untuk menyimpan data aman di cloud.
          </p>
        </div>
      )}

      {/* Restore Lokal — PRO Only */}
      {isPRO ? (
      <div className="bg-[var(--card-bg)] rounded-xl border border-[var(--border)] p-[14px]">
        <div className="text-[0.8rem] font-bold flex items-center gap-[6px] mb-[10px]">
          <RotateCcw size={15} /> Pulihkan dari Backup
        </div>
        <input ref={fileInputRef} type="file" accept=".json" onChange={handleFileSelect} className="hidden" />
        {!restoreData ? (
          <button onClick={() => fileInputRef.current?.click()} className="w-full flex items-center justify-center gap-[6px] py-[10px] rounded-[10px] border-[1.5px] border-[var(--border)] bg-[var(--card-bg)] text-[var(--text)] font-bold text-[0.82rem] cursor-pointer">
            <Upload size={15} /> Pilih File Backup (.json)
          </button>
        ) : (
          <div>
            <div className="bg-[var(--input-bg)] rounded-lg p-3 mb-3">
              <div className="text-[0.72rem] text-[var(--text-light)] mb-1">File Backup:</div>
              <div className="text-[0.78rem] font-semibold">{new Date(restoreData.tanggal).toLocaleDateString("id-ID", { weekday: "long", year: "numeric", month: "long", day: "numeric", hour: "2-digit", minute: "2-digit" })}</div>
              <div className="text-[0.7rem] text-[var(--text-light)] mt-1">{restoreData.totalEntitas} data · v{restoreData.version}</div>
            </div>
            <div className="bg-[#fef3c7] rounded-lg p-3 mb-3 border border-[#fbbf24] flex items-start gap-2">
              <AlertTriangle size={14} className="text-[#b45309] flex-shrink-0 mt-[1px]" />
              <div className="text-[0.7rem] text-[#78350f]">
                Memulihkan backup akan <b>mengganti seluruh data</b> yang ada. Pastikan sudah backup terbaru.
              </div>
            </div>
            <div className="flex gap-2">
              <button onClick={() => setRestoreData(null)} className="flex-1 py-[10px] rounded-[10px] border-[1.5px] border-[var(--border)] bg-[var(--card-bg)] text-[var(--text)] font-bold text-[0.82rem] cursor-pointer">Batal</button>
              <button onClick={handleRestore} disabled={restoring} className="flex-1 py-[10px] rounded-[10px] bg-[#ef4444] text-white font-bold text-[0.82rem] cursor-pointer disabled:opacity-60">{restoring ? "Memulihkan..." : "Pulihkan"}</button>
            </div>
          </div>
        )}
      </div>
      ) : (
        <div className="bg-[var(--card-bg)] rounded-xl border border-[var(--border)] p-[14px]">
          <div className="text-[0.8rem] font-bold flex items-center gap-[6px] mb-[10px]">
            <RotateCcw size={15} /> Pulihkan Backup
            <Lock size={11} className="text-[#b45309]" />
          </div>
          <p className="text-[var(--text-light)] text-[0.72rem]">
            Fitur restore backup hanya tersedia untuk pengguna PRO.
          </p>
        </div>
      )}
    </div>
  );
}
