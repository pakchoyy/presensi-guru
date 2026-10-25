import { useState } from "react";
import { MapPin, Navigation, LocateFixed, School as SchoolIcon, UserRound, ExternalLink } from "lucide-react";

/**
 * Peta lokasi presensi: Google Maps embed (tanpa API key) + tombol "Buka di Maps".
 * Lingkaran radius tidak bisa digambar di embed, jadi radius & jarak ditulis di bawah peta.
 */
export function PetaLokasi({
  namaSekolah,
  lat,
  lng,
  radiusMeter,
  posisi,
  jarakMeter,
  loading,
  onRefresh,
}: {
  namaSekolah: string;
  lat: number;
  lng: number;
  radiusMeter?: number;
  posisi?: { lat: number; lng: number } | null;
  jarakMeter?: number | null;
  loading?: boolean;
  onRefresh?: () => void;
}) {
  // "sekolah" = titik sekolah; "saya" = titik posisi guru.
  const [fokus, setFokus] = useState<"sekolah" | "saya">("sekolah");
  const radius = radiusMeter ?? 100;
  const titik = fokus === "saya" && posisi ? posisi : { lat, lng };
  const q = `${titik.lat},${titik.lng}`;
  const diDalam = jarakMeter != null ? jarakMeter <= radius : null;

  return (
    <div
      className="mt-3 bg-[var(--card-bg)] rounded-2xl border border-[var(--border)] overflow-hidden"
      style={{ boxShadow: "var(--shadow)" }}
    >
      <div className="flex items-center gap-3 p-3">
        <div className="w-9 h-9 rounded-xl bg-[var(--brand-soft)] text-[var(--brand-strong)] flex items-center justify-center flex-shrink-0">
          <MapPin size={16} />
        </div>
        <div className="flex-1 min-w-0">
          <div className="text-[0.65rem] text-[var(--text-light)]">Lokasi Presensi</div>
          <div className="font-bold text-[var(--text)] text-[0.85rem] truncate">{namaSekolah}</div>
        </div>
        {onRefresh && (
          <button
            onClick={onRefresh}
            disabled={loading}
            className="w-9 h-9 rounded-xl bg-[var(--input-bg)] border border-[var(--border)] flex items-center justify-center text-[var(--brand)] active:scale-95 disabled:opacity-50"
            aria-label="Perbarui lokasi saya"
          >
            <LocateFixed size={16} className={loading ? "animate-pulse" : ""} />
          </button>
        )}
      </div>

      <div className="relative isolate">
        <iframe
          key={q}
          title={fokus === "saya" ? "Peta posisi Anda" : `Peta lokasi ${namaSekolah}`}
          src={`https://maps.google.com/maps?q=${q}&z=17&output=embed`}
          loading="lazy"
          referrerPolicy="no-referrer-when-downgrade"
          className="block h-[220px] w-full border-0 bg-[var(--input-bg)]"
        />
        <a
          href={`https://www.google.com/maps/search/?api=1&query=${q}`}
          target="_blank"
          rel="noreferrer"
          className="absolute left-2 top-2 z-10 flex items-center gap-1 rounded-lg bg-white px-2 py-[6px] text-[0.68rem] font-bold text-[#1a73e8] no-underline shadow"
        >
          Buka di Maps <ExternalLink size={12} />
        </a>
        {posisi && (
          <div className="absolute right-2 top-2 z-10 flex rounded-xl overflow-hidden border border-[var(--border)] bg-[var(--card-bg)] shadow">
            <FokusBtn aktif={fokus === "sekolah"} onClick={() => setFokus("sekolah")} icon={<SchoolIcon size={12} />} label="Sekolah" />
            <FokusBtn aktif={fokus === "saya"} onClick={() => setFokus("saya")} icon={<UserRound size={12} />} label="Saya" />
          </div>
        )}
      </div>

      <div className="flex items-center gap-2 px-3 py-[10px] border-t border-[var(--border)]">
        <Navigation size={13} className="text-[var(--text-light)] flex-shrink-0" />
        <div className="text-[0.68rem] text-[var(--text-light)] flex-1 min-w-0">
          {loading
            ? "Mengambil lokasi Anda..."
            : jarakMeter != null
              ? <>Jarak Anda <b className="text-[var(--text)]">{jarakMeter} m</b> · radius {radius} m</>
              : <>Radius presensi {radius} m dari titik sekolah</>}
        </div>
        {diDalam != null && (
          <span
            className="px-2 py-[3px] rounded-full text-[0.6rem] font-extrabold flex-shrink-0"
            style={{
              background: diDalam ? "var(--hadir-bg)" : "var(--alpha-bg)",
              color: diDalam ? "var(--hadir)" : "var(--alpha)",
            }}
          >
            {diDalam ? "Dalam area" : "Luar area"}
          </span>
        )}
      </div>
    </div>
  );
}

function FokusBtn({
  aktif,
  onClick,
  icon,
  label,
}: {
  aktif: boolean;
  onClick: () => void;
  icon: React.ReactNode;
  label: string;
}) {
  return (
    <button
      onClick={onClick}
      className={`px-2 py-[5px] text-[0.6rem] font-bold flex items-center gap-1 border-none ${
        aktif ? "bg-[var(--brand)] text-white" : "bg-transparent text-[var(--text-light)]"
      }`}
    >
      {icon} {label}
    </button>
  );
}
