import { useMemo } from "react";
import { MapPin, Navigation, LocateFixed } from "lucide-react";

/**
 * Peta lokasi presensi (OpenStreetMap embed — tanpa API key / dependency baru).
 * Marker = titik sekolah. Kalau posisi guru sudah diketahui, bbox dilebarkan
 * supaya kedua titik kelihatan sekaligus.
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
  const src = useMemo(() => {
    // Setengah lebar bbox dalam derajat (~250 m default, melebar kalau guru jauh).
    const extraM = Math.max(radiusMeter ?? 100, jarakMeter ?? 0) + 150;
    const dLat = extraM / 111_320;
    const dLng = extraM / (111_320 * Math.max(0.2, Math.cos((lat * Math.PI) / 180)));

    let minLat = lat - dLat, maxLat = lat + dLat;
    let minLng = lng - dLng, maxLng = lng + dLng;
    if (posisi) {
      minLat = Math.min(minLat, posisi.lat - dLat / 3);
      maxLat = Math.max(maxLat, posisi.lat + dLat / 3);
      minLng = Math.min(minLng, posisi.lng - dLng / 3);
      maxLng = Math.max(maxLng, posisi.lng + dLng / 3);
    }
    const bbox = [minLng, minLat, maxLng, maxLat].map((n) => n.toFixed(6)).join(",");
    return `https://www.openstreetmap.org/export/embed.html?bbox=${bbox}&layer=mapnik&marker=${lat.toFixed(6)},${lng.toFixed(6)}`;
  }, [lat, lng, radiusMeter, jarakMeter, posisi]);

  const diDalam = jarakMeter != null && radiusMeter != null ? jarakMeter <= radiusMeter : null;

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

      <div className="relative h-[170px] bg-[var(--input-bg)]">
        <iframe
          title="Peta lokasi sekolah"
          src={src}
          className="w-full h-full border-0"
          loading="lazy"
          referrerPolicy="no-referrer"
        />
      </div>

      <div className="flex items-center gap-2 px-3 py-[10px] border-t border-[var(--border)]">
        <Navigation size={13} className="text-[var(--text-light)] flex-shrink-0" />
        <div className="text-[0.68rem] text-[var(--text-light)] flex-1 min-w-0">
          {loading
            ? "Mengambil lokasi Anda..."
            : jarakMeter != null
              ? <>Jarak Anda <b className="text-[var(--text)]">{jarakMeter} m</b> dari sekolah</>
              : "Lokasi Anda belum diambil"}
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
