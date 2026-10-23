import { useCallback, useEffect, useState } from "react";
import { Check, FileText, X } from "lucide-react";
import { useApp } from "@/contexts/AppContext";
import { useToast } from "@/components/shared/Toast";
import { teacherAttendanceRepo } from "@/repositories/dexie/teacher-attendance.repo";
import { adminCloud } from "@/services/multi-perangkat.service";
import { bacaJenis } from "@/components/guru/IzinGuruPage";
import type { TeacherAttendance } from "@/types/entities";
import { addDays, formatTanggalPanjang, timestamp, todayStr } from "@/lib/utils";

/** Pengajuan izin guru yang menunggu keputusan admin. Tersembunyi kalau tidak ada. */
export function PersetujuanIzin({ onBerubah }: { onBerubah?: () => void }) {
  const { teachers } = useApp();
  const { toast } = useToast();
  const [daftar, setDaftar] = useState<TeacherAttendance[]>([]);

  const muat = useCallback(async () => {
    const dari = addDays(todayStr(), -31);
    const sampai = addDays(todayStr(), 62);
    await adminCloud.tarikAbsen(dari, sampai).catch(() => 0);
    const semua = await teacherAttendanceRepo.getAllRange(dari, sampai);
    setDaftar(semua.filter((r) => r.statusIzin === "proses").sort((a, b) => a.tanggal.localeCompare(b.tanggal)));
  }, []);

  useEffect(() => { muat(); }, [muat]);

  const putuskan = async (rec: TeacherAttendance, statusIzin: "disetujui" | "ditolak") => {
    const baru = { ...rec, statusIzin, diubahPada: timestamp() };
    await teacherAttendanceRepo.save(baru);
    await adminCloud.kirimAbsen(rec.guruId, baru).catch(() => "tertunda");
    setDaftar((d) => d.filter((r) => r.id !== rec.id));
    toast(statusIzin === "disetujui" ? "Izin disetujui" : "Izin ditolak", statusIzin === "disetujui" ? "success" : "info");
    onBerubah?.();
  };

  if (daftar.length === 0) return null;

  return (
    <div className="bg-[var(--card-bg)] rounded-2xl border-[1.5px] border-[#f59e0b] p-[12px] mb-3" style={{ boxShadow: "var(--shadow)" }}>
      <div className="flex items-center gap-2 font-bold text-[0.85rem] text-[var(--text)] mb-2">
        <FileText size={16} className="text-[#f59e0b]" /> Pengajuan izin menunggu ({daftar.length})
      </div>
      <div className="space-y-2">
        {daftar.map((r) => {
          const { jenis, keterangan } = bacaJenis(r);
          const nama = teachers.find((t) => t.id === r.guruId)?.nama ?? "Guru";
          return (
            <div key={r.id} className="flex items-center gap-2 rounded-xl bg-[var(--input-bg)] p-2">
              <div className="flex-1 min-w-0">
                <div className="text-[0.8rem] font-bold text-[var(--text)] truncate">{nama} · {jenis}</div>
                <div className="text-[0.66rem] text-[var(--text-light)]">{formatTanggalPanjang(r.tanggal)}</div>
                {keterangan && <div className="text-[0.68rem] text-[var(--text)] break-words">{keterangan}</div>}
              </div>
              <button
                onClick={() => putuskan(r, "ditolak")}
                className="w-9 h-9 rounded-xl bg-[#fee2e2] text-[#dc2626] flex items-center justify-center border-none active:scale-95"
                aria-label={`Tolak izin ${nama}`}
              >
                <X size={16} />
              </button>
              <button
                onClick={() => putuskan(r, "disetujui")}
                className="w-9 h-9 rounded-xl bg-[#dcfce7] text-[#16a34a] flex items-center justify-center border-none active:scale-95"
                aria-label={`Setujui izin ${nama}`}
              >
                <Check size={16} />
              </button>
            </div>
          );
        })}
      </div>
    </div>
  );
}
