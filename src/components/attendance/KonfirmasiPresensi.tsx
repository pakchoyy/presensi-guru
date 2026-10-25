import { ArrowLeft, Save } from "lucide-react";
import { PetaPro } from "@/components/attendance/PetaPro";

/**
 * Layar konfirmasi sebelum presensi disimpan: foto selfie, lokasi sekolah,
 * jarak, dan peta — lalu guru memilih Kembali atau Simpan.
 */
export function KonfirmasiPresensi({
  aksi,
  fotoUrl,
  verifikasiWajah,
  namaSekolah,
  lat,
  lng,
  radiusMeter,
  posisi,
  jarakMeter,
  menyimpan,
  onKembali,
  onSimpan,
}: {
  aksi: "in" | "out";
  fotoUrl: string;
  verifikasiWajah?: boolean;
  namaSekolah: string;
  lat?: number;
  lng?: number;
  radiusMeter?: number;
  /** null = paket tanpa GPS (selfie saja): info lokasi & peta disembunyikan. */
  posisi: { lat: number; lng: number } | null;
  jarakMeter: number | null;
  menyimpan: boolean;
  onKembali: () => void;
  onSimpan: () => void;
}) {
  const jarakLabel =
    jarakMeter == null
      ? "—"
      : jarakMeter >= 1000
        ? `${(jarakMeter / 1000).toFixed(2)} km`
        : `${jarakMeter} m`;

  return (
    <div className="fixed inset-0 z-[900] bg-[var(--bg)] flex flex-col">
      {/* Header */}
      <div
        className="px-3 h-[58px] flex items-center gap-2 text-white flex-shrink-0"
        style={{ background: "var(--grad)" }}
      >
        <button
          onClick={onKembali}
          className="w-9 h-9 rounded-xl bg-white/15 border border-white/25 flex items-center justify-center active:scale-95"
          aria-label="Kembali"
        >
          <ArrowLeft size={18} />
        </button>
        <div className="font-extrabold text-[1rem]">
          Presensi {aksi === "in" ? "Datang" : "Pulang"}
        </div>
      </div>

      <div className="flex-1 overflow-y-auto px-[14px] py-4">
        {/* Foto selfie */}
        <div className="flex justify-center">
          <div
            className="w-[150px] h-[150px] rounded-full overflow-hidden border-4 bg-[var(--input-bg)]"
            style={{ borderColor: "var(--brand)" }}
          >
            <img src={fotoUrl} alt="Selfie presensi" className="w-full h-full object-cover" />
          </div>
        </div>
        {verifikasiWajah !== undefined && (
        <div className="flex justify-center mt-2">
          <span
            className="px-3 py-[3px] rounded-full text-[0.66rem] font-extrabold"
            style={
              verifikasiWajah
                ? { background: "var(--hadir-bg)", color: "var(--hadir)" }
                : { background: "#fef3c7", color: "#b45309" }
            }
          >
            {verifikasiWajah ? "✓ Wajah terverifikasi" : "Foto tanpa verifikasi wajah"}
          </span>
        </div>
        )}

        {posisi && (<>
        {/* Info lokasi */}
        <div
          className="mt-4 bg-[var(--card-bg)] rounded-2xl border border-[var(--border)] overflow-hidden"
          style={{ boxShadow: "var(--shadow)" }}
        >
          <div className="px-4 py-3 border-b border-[var(--border)]">
            <div className="text-[0.72rem] font-bold text-[var(--text)]">Lokasi Presensi</div>
            <div className="text-[0.85rem] text-[var(--text-light)] mt-[2px] break-words">
              {namaSekolah}
            </div>
          </div>
          <div className="px-4 py-3">
            <div className="text-[0.72rem] font-bold text-[var(--text)]">Jarak Anda Ke Lokasi</div>
            <div className="text-[0.85rem] text-[var(--text-light)] mt-[2px]">{jarakLabel}</div>
          </div>
        </div>

        {/* Peta */}
        {lat != null && lng != null ? (
          <PetaPro
            namaSekolah={namaSekolah}
            lat={lat}
            lng={lng}
            radiusMeter={radiusMeter}
            posisi={posisi}
            jarakMeter={jarakMeter}
          />
        ) : (
          <div className="mt-3 bg-[var(--card-bg)] rounded-2xl border border-[var(--border)] p-4 text-center text-[0.75rem] text-[var(--text-light)]">
            Titik sekolah belum diatur, jadi peta tidak bisa ditampilkan.
          </div>
        )}
        </>)}
        <div className="mt-3 text-center text-[0.68rem] text-[var(--text-light)]">
          Foto kurang bagus? Tap <b>Kembali</b> lalu ambil ulang. Yang dihitung presensi terakhir.
        </div>
      </div>

      {/* Aksi */}
      <div className="flex-shrink-0 px-[14px] pb-5 pt-3 flex gap-3 border-t border-[var(--border)] bg-[var(--card-bg)]">
        <button
          onClick={onKembali}
          disabled={menyimpan}
          className="flex-1 py-[14px] rounded-full text-white font-bold text-[0.9rem] flex items-center justify-center gap-2 active:scale-95 disabled:opacity-50"
          style={{ background: "#ef4444" }}
        >
          <ArrowLeft size={17} /> Kembali
        </button>
        <button
          onClick={onSimpan}
          disabled={menyimpan}
          className="flex-1 py-[14px] rounded-full text-white font-bold text-[0.9rem] flex items-center justify-center gap-2 active:scale-95 disabled:opacity-50"
          style={{ background: "var(--brand)" }}
        >
          <Save size={17} /> {menyimpan ? "Menyimpan..." : "Simpan"}
        </button>
      </div>
    </div>
  );
}
