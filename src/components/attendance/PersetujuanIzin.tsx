import { useCallback, useEffect, useState } from "react";
import { Check, ChevronDown, FileText, Plus, X } from "lucide-react";
import { useApp } from "@/contexts/AppContext";
import { useToast } from "@/components/shared/Toast";
import { teacherAttendanceRepo } from "@/repositories/dexie/teacher-attendance.repo";
import { adminCloud, type IzinSekolah } from "@/services/multi-perangkat.service";
import { bacaJenis, IzinGuruPage } from "@/components/guru/IzinGuruPage";
import type { TeacherAttendance } from "@/types/entities";
import { addDays, formatTanggalPanjang, timestamp, todayStr } from "@/lib/utils";

/**
 * Verifikasi izin di Dashboard (Admin & Kepala Sekolah): yang menunggu +
 * riwayat keputusan (31 hari terakhir), plus catat izin langsung.
 */
export function PersetujuanIzin({ onBerubah }: { onBerubah?: () => void }) {
  const { teachers } = useApp();
  const { toast } = useToast();
  const [semua, setSemua] = useState<IzinSekolah[]>([]);
  const [buka, setBuka] = useState(false);
  const [lihat, setLihat] = useState<"menunggu" | "riwayat">("menunggu");
  // Admin mencatat izin sendiri / guru lain: null = tutup, 0 = belum pilih guru.
  const [catatUntuk, setCatatUntuk] = useState<number | null>(null);
  const guruAktif = teachers.filter((t) => t.statusAktif !== false);

  const muat = useCallback(async () => {
    const dari = addDays(todayStr(), -31);
    const sampai = addDays(todayStr(), 62);
    await adminCloud.tarikAbsen(dari, sampai).catch(() => 0);
    const daftar: IzinSekolah[] = (await teacherAttendanceRepo.getAllRange(dari, sampai))
      .filter((r) => r.statusIzin)
      .map((r) => ({
        kunci: String(r.id),
        nama: teachers.find((t) => t.id === r.guruId)?.nama ?? "Guru",
        tanggal: r.tanggal,
        statusHari: r.statusHari,
        statusIzin: r.statusIzin!,
        catatan: r.catatan,
      }));
    setSemua(daftar);
    // Ada yang menunggu → langsung terbuka supaya tidak terlewat.
    if (daftar.some((d) => d.statusIzin === "proses")) setBuka(true);
  }, [teachers]);

  useEffect(() => { muat(); }, [muat]);

  const putuskan = async (izin: IzinSekolah, statusIzin: "disetujui" | "ditolak") => {
    try {
      const rec = await teacherAttendanceRepo.getById(Number(izin.kunci));
      if (!rec) return;
      const baru: TeacherAttendance = { ...rec, statusIzin, diubahPada: timestamp() };
      await teacherAttendanceRepo.save(baru);
      await adminCloud.kirimAbsen(rec.guruId, baru).catch(() => "tertunda");
    } catch {
      toast("Gagal menyimpan keputusan — cek internet", "error");
      return;
    }
    setSemua((d) => d.map((x) => (x.kunci === izin.kunci ? { ...x, statusIzin } : x)));
    toast(statusIzin === "disetujui" ? "Izin disetujui" : "Izin ditolak", statusIzin === "disetujui" ? "success" : "info");
    onBerubah?.();
  };

  const menunggu = semua.filter((d) => d.statusIzin === "proses").sort((a, b) => a.tanggal.localeCompare(b.tanggal));
  const riwayat = semua.filter((d) => d.statusIzin !== "proses").sort((a, b) => b.tanggal.localeCompare(a.tanggal));
  const tampil = lihat === "menunggu" ? menunggu : riwayat;

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
            {menunggu.length ? `${menunggu.length} pengajuan menunggu keputusan` : "Tidak ada pengajuan menunggu"}
          </span>
        </span>
        {menunggu.length > 0 && (
          <span className="min-w-[22px] h-[22px] px-[6px] rounded-full bg-[#dc2626] text-white text-[0.7rem] font-extrabold flex items-center justify-center">
            {menunggu.length}
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
                {v === "menunggu" ? `Menunggu (${menunggu.length})` : "Riwayat"}
              </button>
            ))}
          </div>
          <button
              onClick={() => setCatatUntuk(0)}
              className="w-full mb-2 py-[8px] rounded-xl border-[1.5px] border-dashed border-[var(--brand)] text-[var(--brand)] bg-transparent text-[0.78rem] font-bold flex items-center justify-center gap-1 active:scale-95"
            >
              <Plus size={14} /> Catat izin (termasuk untuk diri sendiri)
            </button>
          {tampil.length === 0 && (
            <div className="py-4 text-center text-[0.75rem] text-[var(--text-light)]">
              {lihat === "menunggu" ? "Semua pengajuan sudah diputuskan." : "Belum ada izin yang diputuskan."}
            </div>
          )}
          <div className="space-y-2">
            {tampil.map((r) => {
              const { jenis, keterangan } = bacaJenis(r);
              return (
                <div key={r.kunci} className="flex items-center gap-2 rounded-xl bg-[var(--input-bg)] p-2">
                  <div className="flex-1 min-w-0">
                    <div className="text-[0.8rem] font-bold text-[var(--text)] truncate">{r.nama} · {jenis}</div>
                    <div className="text-[0.66rem] text-[var(--text-light)]">{formatTanggalPanjang(r.tanggal)}</div>
                    {keterangan && <div className="text-[0.68rem] text-[var(--text)] break-words">{keterangan}</div>}
                  </div>
                  {r.statusIzin === "proses" ? (
                    <>
                      <button
                        onClick={() => putuskan(r, "ditolak")}
                        className="w-9 h-9 rounded-xl bg-[#fee2e2] text-[#dc2626] flex items-center justify-center border-none active:scale-95"
                        aria-label={`Tolak izin ${r.nama}`}
                      >
                        <X size={16} />
                      </button>
                      <button
                        onClick={() => putuskan(r, "disetujui")}
                        className="w-9 h-9 rounded-xl bg-[#dcfce7] text-[#16a34a] flex items-center justify-center border-none active:scale-95"
                        aria-label={`Setujui izin ${r.nama}`}
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

      {catatUntuk !== null && (
        <div className="fixed inset-0 z-[800] bg-[var(--bg)] overflow-y-auto">
          <div className="max-w-app mx-auto px-[14px] pt-[14px]">
            <div className="font-extrabold text-[1rem] text-[var(--text)] mb-2">Catat izin</div>
            <label className="text-[0.78rem] font-bold text-[var(--text)] mb-1 block">Guru</label>
            <select
              value={catatUntuk || ""}
              onChange={(e) => setCatatUntuk(Number(e.target.value) || 0)}
              className="w-full px-3 py-[10px] rounded-xl border-[1.5px] border-[var(--border)] bg-[var(--card-bg)] text-[var(--text)] text-[0.9rem] font-[inherit]"
            >
              <option value="">Pilih guru…</option>
              {guruAktif.map((t) => (
                <option key={t.id} value={t.id}>{t.nama}{t.role === "admin" ? " (admin)" : ""}</option>
              ))}
            </select>
          </div>
          {catatUntuk ? (
            <IzinGuruPage
              key={catatUntuk}
              guruId={catatUntuk}
              onSelesai={() => { setCatatUntuk(null); muat(); onBerubah?.(); }}
            />
          ) : (
            <div className="max-w-app mx-auto px-[14px] pt-3">
              <button
                onClick={() => setCatatUntuk(null)}
                className="w-full py-3 rounded-full bg-[#ef4444] text-white font-bold border-none"
              >
                Batal
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
