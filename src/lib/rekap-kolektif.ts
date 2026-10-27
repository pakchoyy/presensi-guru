export interface RingkasanGuru {
  hari: number;      // hari efektif yang sudah berjalan
  hadir: number;     // H, pulang cepat, luar area
  terlambat: number;
  sakit: number;
  izin: number;
  alpa: number;
  persen: number;    // (hadir + terlambat) / hari, dibulatkan
}

/** Ringkas kode keterangan harian (dari ketPresensi) menjadi satu baris rekap. Kode "-" (belum) tidak dihitung. */
export function ringkasKode(kodes: string[]): RingkasanGuru {
  const r = { hari: 0, hadir: 0, terlambat: 0, sakit: 0, izin: 0, alpa: 0, persen: 0 };
  for (const k of kodes) {
    if (k === "-") continue;
    r.hari++;
    if (k === "T") r.terlambat++;
    else if (k === "S") r.sakit++;
    else if (k === "I") r.izin++;
    else if (k === "A") r.alpa++;
    else r.hadir++; // H, PC, LA
  }
  r.persen = r.hari ? Math.round(((r.hadir + r.terlambat) / r.hari) * 100) : 0;
  return r;
}
