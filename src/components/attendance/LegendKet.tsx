import { DAFTAR_KET } from "@/lib/ket-presensi";

/** Keterangan kode di kolom Ket tabel presensi. */
export function LegendKet() {
  return (
    <div className="mt-3 grid grid-cols-2 gap-x-3 gap-y-1 text-[0.66rem] text-[var(--text-light)]">
      {DAFTAR_KET.map((k) => (
        <div key={k.kode} className="flex items-center gap-2">
          <span className="w-7 text-center rounded font-bold text-white py-[1px]" style={{ background: k.warna }}>{k.kode}</span>
          {k.label}
        </div>
      ))}
    </div>
  );
}
