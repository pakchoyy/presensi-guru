import { useEffect, useRef, useState } from "react";
import { MapPin, Navigation, LocateFixed, UserRound, ExternalLink } from "lucide-react";
import { metersPerPixel, offsetPx, pilihZoom } from "@/lib/peta-overlay";

const TINGGI = 220;

/**
 * Peta lokasi presensi: Google Maps embed (tanpa API key) berpusat di sekolah, tidak bisa digeser,
 * dengan lingkaran radius & ikon guru digambar di atasnya. Interaksi lewat tombol "Buka di Maps".
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
  const radius = radiusMeter ?? 100;
  const kotak = useRef<HTMLDivElement>(null);
  const [lebar, setLebar] = useState(0);
  useEffect(() => {
    const el = kotak.current;
    if (!el) return;
    const ro = new ResizeObserver(() => setLebar(el.clientWidth));
    ro.observe(el);
    setLebar(el.clientWidth);
    return () => ro.disconnect();
  }, []);
  const z = lebar ? pilihZoom(lat, lng, radius, lebar, TINGGI, posisi) : 17;
  const rPx = radius / metersPerPixel(lat, z);
  const o = posisi ? offsetPx(lat, lng, posisi.lat, posisi.lng, z) : null;
  const q = `${lat},${lng}`;
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

      <div ref={kotak} className="relative isolate overflow-hidden" style={{ height: TINGGI }}>
        <iframe
          key={`${q}-${z}`}
          title={`Peta lokasi ${namaSekolah}`}
          src={`https://maps.google.com/maps?q=${q}&z=${z}&output=embed`}
          loading="lazy"
          referrerPolicy="no-referrer-when-downgrade"
          tabIndex={-1}
          className="block w-full border-0 bg-[var(--input-bg)] pointer-events-none"
          style={{ height: TINGGI }}
        />
        {lebar > 0 && (
          <div className="absolute inset-0 pointer-events-none" aria-hidden="true">
            <div
              className="absolute rounded-full"
              style={{
                left: lebar / 2 - rPx,
                top: TINGGI / 2 - rPx,
                width: rPx * 2,
                height: rPx * 2,
                border: "2px solid #2563eb",
                background: "rgba(59,130,246,0.18)",
              }}
            />
            {o && (
              <div
                className="absolute flex items-center justify-center rounded-full text-white"
                style={{
                  left: lebar / 2 + o.x - 15,
                  top: TINGGI / 2 + o.y - 15,
                  width: 30,
                  height: 30,
                  background: "#eab308",
                  border: "2.5px solid #fff",
                  boxShadow: "0 2px 6px rgba(0,0,0,.35)",
                }}
              >
                <UserRound size={16} strokeWidth={2.4} />
              </div>
            )}
          </div>
        )}
        <a
          href={`https://www.google.com/maps/search/?api=1&query=${q}`}
          target="_blank"
          rel="noreferrer"
          className="absolute left-2 top-2 z-10 flex items-center gap-1 rounded-lg bg-white px-2 py-[6px] text-[0.68rem] font-bold text-[#1a73e8] no-underline shadow"
        >
          Buka di Maps <ExternalLink size={12} />
        </a>
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
