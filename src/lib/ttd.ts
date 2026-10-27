import type { School, Teacher } from "@/types/entities";

const BULAN_ID = ["Januari", "Februari", "Maret", "April", "Mei", "Juni", "Juli", "Agustus", "September", "Oktober", "November", "Desember"];
export const tanggalIndo = (d: Date) => `${d.getDate()} ${BULAN_ID[d.getMonth()]} ${d.getFullYear()}`;

export interface TtdBlok { baris: string[]; nama: string; nip: string }

/** Isi blok tanda tangan: setelan admin di sekolah, kosong diisi dari guru berperan Kepala Sekolah. */
export function ttdBlok(school: School | null, teachers: Teacher[]): TtdBlok | null {
  const t = school?.ttd || {};
  if (t.aktif === false) return null;
  const ks = teachers.find((g) => g.role === "ks" && g.statusAktif !== false);
  const tgl = tanggalIndo(t.tanggal ? new Date(`${t.tanggal}T00:00:00`) : new Date());
  return {
    baris: [t.tempat ? `${t.tempat}, ${tgl}` : tgl, t.jabatan || `Kepala ${school?.nama || "Sekolah"}`],
    nama: t.nama || ks?.nama || "",
    nip: t.nip ?? ks?.nip ?? "",
  };
}

