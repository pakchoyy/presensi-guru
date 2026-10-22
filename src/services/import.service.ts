import * as XLSX from "xlsx";
import type { Teacher } from "@/types/entities";

export interface ImportGuruResult {
  success: boolean;
  teachers: Partial<Teacher>[];
  errors: string[];
}

function pick(row: Record<string, unknown>, keys: string[]): string | undefined {
  for (const k of Object.keys(row)) {
    if (keys.includes(k.toLowerCase().trim())) {
      const v = row[k];
      if (v !== undefined && v !== null && String(v).trim()) return String(v).trim();
    }
  }
  return undefined;
}

export function importGuruFromExcel(file: File): Promise<ImportGuruResult> {
  return new Promise((resolve) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const data = new Uint8Array(e.target!.result as ArrayBuffer);
        const workbook = XLSX.read(data, { type: "array" });
        const sheetName = workbook.SheetNames[0];
        if (!sheetName) {
          resolve({ success: false, teachers: [], errors: ["File Excel kosong"] });
          return;
        }
        const sheet = workbook.Sheets[sheetName];
        const rows: Record<string, unknown>[] = XLSX.utils.sheet_to_json(sheet, { defval: "" });
        if (rows.length === 0) {
          resolve({ success: false, teachers: [], errors: ["File Excel tidak memiliki data guru"] });
          return;
        }

        const errors: string[] = [];
        const teachers: Partial<Teacher>[] = [];

        rows.forEach((row, i) => {
          const baris = i + 2;
          const nama = pick(row, ["nama", "nama guru", "name"]);
          if (!nama) {
            errors.push(`Baris ${baris}: nama guru wajib diisi`);
            return;
          }
          const nip = pick(row, ["nip", "no induk", "nomor induk"]);
          if (nip && !/^\d{8,18}$/.test(nip)) {
            errors.push(`Baris ${baris}: NIP "${nip}" harus 8-18 digit angka`);
            return;
          }
          const jabatan = pick(row, ["jabatan", "role", "posisi"]);
          const email = pick(row, ["email", "e-mail"]);

          teachers.push({
            nama,
            nip: nip || undefined,
            jabatan: jabatan || undefined,
            email: email || "",
            role: "guru",
            statusAktif: true,
          });
        });

        resolve({
          success: teachers.length > 0,
          teachers,
          errors,
        });
      } catch {
        resolve({
          success: false,
          teachers: [],
          errors: ["File tidak dapat dibaca. Pastikan file Excel (.xlsx) valid."],
        });
      }
    };
    reader.onerror = () => resolve({ success: false, teachers: [], errors: ["Gagal membaca file"] });
    reader.readAsArrayBuffer(file);
  });
}

export function generateTemplateGuruBlob(): Blob {
  const wb = XLSX.utils.book_new();
  const ws = XLSX.utils.aoa_to_sheet([
    ["Petunjuk: Nama wajib. NIP opsional (8-18 digit). Jabatan & Email opsional."],
    ["Nama", "NIP", "Jabatan", "Email"],
    ["Ahmad Fauzi, S.Pd.", "198501012010011001", "Guru Kelas 1A", "ahmad@sekolah.sch.id"],
    ["Siti Rahayu, S.Pd.", "", "Guru Mapel Matematika", ""],
  ]);
  ws["!cols"] = [{ wch: 30 }, { wch: 22 }, { wch: 25 }, { wch: 30 }];
  XLSX.utils.book_append_sheet(wb, ws, "Daftar Guru");
  const buffer = XLSX.write(wb, { bookType: "xlsx", type: "array" });
  return new Blob([buffer], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" });
}

export function downloadTemplateGuru() {
  const blob = generateTemplateGuruBlob();
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = "template_daftar_guru.xlsx";
  a.click();
  URL.revokeObjectURL(url);
}
