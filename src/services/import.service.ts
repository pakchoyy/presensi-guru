// TODO: Import daftar guru dari Excel.
// Pattern bisa diadopsi dari presensi-siswa versi lama (XLSX utility).
import type { Teacher } from "@/types/entities";

export interface ImportResult {
  success: boolean;
  teachers: Partial<Teacher>[];
  errors: string[];
}

export async function importGuruFromExcel(_file: File): Promise<ImportResult> {
  return { success: false, teachers: [], errors: ["Import Excel belum diimplementasi"] };
}
