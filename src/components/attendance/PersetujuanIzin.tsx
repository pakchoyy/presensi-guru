import { useCallback, useEffect, useState } from "react";
import { Check, ChevronDown, FileText, X } from "lucide-react";
import { useApp } from "@/contexts/AppContext";
import { useToast } from "@/components/shared/Toast";
import { teacherAttendanceRepo } from "@/repositories/dexie/teacher-attendance.repo";
import { adminCloud } from "@/services/multi-perangkat.service";
import { bacaJenis } from "@/components/guru/IzinGuruPage";
import type { TeacherAttendance } from "@/types/entities";
import { addDays, formatTanggalPanjang, timestamp, todayStr } from "@/lib/utils";

/** Verifikasi izin di Dashboard admin: yang menunggu + riwayat keputusan (31 hari terakhir). */
export function PersetujuanIzin({ onBerubah }: { onBerubah?: () => void }) {
  const { teachers } = useApp();
  const { toast } = useToast();
  const [daftar, setDaftar] = useState<TeacherAttendance[]>([]);
  const [riwayat, setRiwayat] = useState<TeacherAttendance[]>([]);
  const [buka, setBuka] = useState(false);
  const [lihat, setLihat] = useState<"menunggu" | "riwayat">("menunggu");

  const muat = useCallback(async () => {
    const dari = addDays(todayStr(), -31);
    const sampai = addDays(todayStr(), 62);
    await adminCloud.tarikAbsen(dari, sampai).catch(() => 0);
    const semua = await teacherAttendanceRepo.getAllRange(dari, sampai);
    const menunggu = semua.filter((r) => r.statusIzin === "proses").sort((a, b) => a.tanggal.localeCompare(b.tanggal));
    setDaftar(menunggu);
    // Ada yang menunggu → langsung terbuka supaya tidak terlewat.
    if (menunggu.length) setBuka(true);
    setRiwayat(
      semua
        .filter((r) => r.statusIzin === "disetujui" || r.statusIzin === "ditolak")
        .sort((a, b) => b.tanggal.localeCompare(a.tanggal)),
    );
  }, []);

  useEffect(() => { muat(); }, [muat]);

  const putuskan = async (rec: TeacherAttendance, statusIzin: "disetujui" | "ditolak") => {
    const baru = { ...rec, statusIzin, diubahPada: timestamp() };
    await teacherAttendanceRepo.save(baru);
    await adminCloud.kirimAbsen(rec.guruId, baru).catch(() => "tertunda");
    setDaftar((d) => d.filter((r) => r.id !== rec.id));
    setRiwayat((d) => [baru, ...d]);
    toast(statusIzin === "disetujui" ? "Izin disetujui" : "Izin ditolak", statusIzin === "disetujui" ? "success" : "info");
    onBerubah?.();
  };

  const tampil = lihat === "menunggu" ? daftar : riwayat;

  return (
    <div className="bg-[var(--card-bg)] rounded-2xl border border-[var(--border)] mb-3 overflow-hidden" style={{ boxShadow: "var(--shadow)" }}>
      <button
        onClick={() => setBuka((v) => !v)}
        className="w-full flex items-center gap-3 p-[12px] bg-transparent border-none text-left font-[inherit]"
        aria-expanded={buka}
      >
        <span className="w-9 h-9 rounded-xl bg-[#fef3c7] text-[#d97706] flex items-center justify-center flex-shrink-0">
          <FileText size={17} />
        </span>
        <span className="flex-1 min-w-0">
          <span className="block font-bold text-[0.88rem] text-[var(--text)]">Verifikasi Izin</span>
          <span className="block text-[0.66rem] text-[var(--text-light)]">
            {daftar.length ? `${daftar.length} pengajuan menunggu keputusan` : "Tidak ada pengajuan menunggu"}
          </span>
        </span>
        {daftar.length > 0 && (
          <span className="min-w-[22px] h-[22px] px-[6px] rounded-full bg-[#dc2626] text-white text-[0.7rem] font-extrabold flex items-center justify-center">
            {daftar.length}
          </span>
        )}
        <ChevronDown size={18} className={`text-[var(--text-light)] transition-transform ${buka ? "rotate-180" : ""}`} />
      </button>

      {buka && (
        <div className="px-[12px] pb-[12px]">
          <div className="grid grid-cols-2 p-1 rounded-xl bg-[var(--input-bg)] border border-[var(--border)] mb-2">
            {(["menunggu", "riwayat"] as const).map((v) => (
              <button
                key={v}
                onClick={() => setLihat(v)}
                className={`py-[6px] rounded-lg text-[0.75rem] font-bold border-none ${
                  lihat === v ? "bg-[var(--card-bg)] text-[var(--brand)] shadow-sm" : "bg-transparent text-[var(--text-light)]"
                }`}
              >
                {v === "menunggu" ? `Menunggu (${daftar.length})` : "Riwayat"}
              </button>
            ))}
          </div>
          {tampil.length === 0 && (
            <div className="py-4 text-center text-[0.75rem] text-[var(--text-light)]">
              {lihat === "menunggu" ? "Semua pengajuan sudah diputuskan." : "Belum ada izin yang diputuskan."}
            </div>
          )}
      <div className="space-y-2">
        {tampil.map((r) => {
          const { jenis, keterangan } = bacaJenis(r);
          const nama = teachers.find((t) => t.id === r.guruId)?.nama ?? "Guru";
          return (
            <div key={r.id} className="flex items-center gap-2 rounded-xl bg-[var(--input-bg)] p-2">
              <div className="flex-1 min-w-0">
                <div className="text-[0.8rem] font-bold text-[var(--text)] truncate">{nama} · {jenis}</div>
                <div className="text-[0.66rem] text-[var(--text-light)]">{formatTanggalPanjang(r.tanggal)}</div>
                {keterangan && <div className="text-[0.68rem] text-[var(--text)] break-words">{keterangan}</div>}
              </div>
              {r.statusIzin === "proses" ? (
                <>
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
                </>
              ) : (
                <span
                  className="px-3 py-1 rounded-full text-[0.66rem] font-bold text-white flex-shrink-0"
                  style={{ background: r.statusIzin === "disetujui" ? "#16a34a" : "#dc2626" }}
                >
                  {r.statusIzin === "disetujui" ? "Disetujui" : "Ditolak"}
                </span>
              )}
            </div>
          );
        })}
      </div>
        </div>
      )}
    </div>
  );
}
