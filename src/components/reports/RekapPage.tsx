import { BarChart3 } from "lucide-react";

// TODO: Rekap per-guru per-bulan — tabel Jam Masuk / Jam Pulang / Durasi / Status Masuk / Status Hari
// Reuse pola jsPDF + autotable dari presensi-siswa src/services/export.service.ts
export function RekapPage() {
  return (
    <div className="flex-1 px-[14px] pt-[14px] pb-[90px] lg:pb-4">
      <div className="bg-[var(--card-bg)] rounded-xl border border-[var(--border)] p-6 text-center">
        <BarChart3 className="mx-auto text-[var(--text-light)] mb-2" size={32} />
        <div className="font-bold text-[var(--text)]">Rekap Guru</div>
        <div className="text-[0.78rem] text-[var(--text-light)] mt-1">
          Rekap bulanan per guru — segera hadir
        </div>
      </div>
    </div>
  );
}
