import type { TeacherAttendance } from "@/types/entities";
import { todayStr } from "@/lib/utils";

export interface KetPresensi {
  kode: string;
  label: string;
  warna: string;
}

// Urutan = urutan di keterangan (legend).
export const DAFTAR_KET: KetPresensi[] = [
  { kode: "H", label: "Hadir", warna: "#16a34a" },
  { kode: "T", label: "Terlambat", warna: "#f59e0b" },
  { kode: "PC", label: "Pulang cepat", warna: "#6b7280" },
  { kode: "LA", label: "Luar area", warna: "#dc2626" },
  { kode: "S", label: "Sakit", warna: "#ea580c" },
  { kode: "I", label: "Izin / Cuti / Dinas", warna: "#2563eb" },
  { kode: "A", label: "Alpha", warna: "#991b1b" },
];
const KET = Object.fromEntries(DAFTAR_KET.map((k) => [k.kode, k]));

/**
 * Keterangan satu hari efektif. Hari yang sudah lewat tanpa presensi dan tanpa
 * izin otomatis Alpha; hari ini yang belum presensi masih "-".
 */
export function ketPresensi(tanggal: string, rec?: TeacherAttendance): KetPresensi {
  // Izin yang ditolak admin tidak dihitung — hari itu dinilai dari presensinya.
  const izinBerlaku = rec?.statusIzin !== "ditolak";
  if (rec?.statusHari === "A") return KET.A;
  if (izinBerlaku && (rec?.statusHari === "S" || rec?.statusHari === "I")) return KET[rec.statusHari];
  if (rec?.jamMasuk) {
    if (rec.statusMasuk === "FAR") return KET.LA;
    if (rec.statusMasuk === "LATE" || rec.statusHari === "T") return KET.T;
    if (rec.statusPulang === "EARLY") return KET.PC;
    return KET.H;
  }
  if (tanggal < todayStr()) return KET.A;
  return { kode: "-", label: "Belum", warna: "var(--text-light)" };
}
