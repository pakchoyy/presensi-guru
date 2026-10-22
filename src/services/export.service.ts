// TODO: Rework export untuk rekap guru per bulan.
// Kolom baru: Tanggal | Jam Masuk | Jam Pulang | Durasi | Status Masuk | Status Hari | Catatan
// Pattern jsPDF + autotable + xlsx bisa diadopsi dari presensi-siswa versi lama.
import type { School, Teacher, TeacherAttendance } from "@/types/entities";

export interface RekapGuruCtx {
  school: School | null;
  teacher: Teacher | null;
  guru: Teacher;
  records: TeacherAttendance[];
  periode: string;
}

export async function exportRekapGuruPDF(_ctx: RekapGuruCtx): Promise<void> {
  console.warn("exportRekapGuruPDF: TODO — belum diimplementasi");
}

export async function exportRekapGuruXLSX(_ctx: RekapGuruCtx): Promise<void> {
  console.warn("exportRekapGuruXLSX: TODO — belum diimplementasi");
}
