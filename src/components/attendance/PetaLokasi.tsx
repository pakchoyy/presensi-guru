import { useEffect, useRef, useState } from "react";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import { MapPin, Navigation, LocateFixed, School as SchoolIcon, UserRound } from "lucide-react";

/**
 * Peta lokasi presensi (Leaflet + tile OpenStreetMap — tanpa API key).
 * Menampilkan marker sekolah, lingkaran radius geofence, dan marker posisi
 * guru kalau GPS sudah didapat.
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
  // "sekolah" = radius selalu terlihat; "keduanya" = zoom out sampai posisi
  // guru ikut masuk layar (lingkaran radius bisa jadi kecil kalau jauh).
  const [fokus, setFokus] = useState<"sekolah" | "keduanya">("sekolah");
  const boxRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<L.Map | null>(null);
  const layerRef = useRef<L.LayerGroup | null>(null);

  const radius = radiusMeter ?? 100;

  // Inisialisasi peta sekali.
  useEffect(() => {
    if (!boxRef.current || mapRef.current) return;
    const map = L.map(boxRef.current, {
      center: [lat, lng],
      zoom: 17,
      zoomControl: true,
      attributionControl: true,
    });
    L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
      maxZoom: 19,
      attribution: "&copy; OpenStreetMap",
    }).addTo(map);
    layerRef.current = L.layerGroup().addTo(map);
    mapRef.current = map;
    return () => {
      map.remove();
      mapRef.current = null;
      layerRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Gambar ulang marker + radius setiap data berubah.
  useEffect(() => {
    const map = mapRef.current;
    const layer = layerRef.current;
    if (!map || !layer) return;
    layer.clearLayers();

    const titikSekolah = L.latLng(lat, lng);
    const lingkaran = L.circle(titikSekolah, {
      radius,
      color: "#2563eb",
      weight: 2,
      fillColor: "#3b82f6",
      fillOpacity: 0.18,
    }).addTo(layer);
    L.marker(titikSekolah, { icon: ikonBulat("#16a34a", SVG_SEKOLAH, 34) })
      .addTo(layer)
      .bindPopup(namaSekolah);

    const titikSaya = posisi ? L.latLng(posisi.lat, posisi.lng) : null;
    if (titikSaya) {
      // Posisi guru di atas marker sekolah supaya tetap terlihat walau berimpit.
      L.marker(titikSaya, { icon: ikonBulat("#eab308", SVG_ORANG, 30), zIndexOffset: 1000 })
        .addTo(layer)
        .bindPopup("Posisi Anda");
    }

    if (fokus === "keduanya" && titikSaya) {
      map.fitBounds(L.latLngBounds([titikSekolah, titikSaya]).pad(0.3), { maxZoom: 18 });
    } else {
      // Pas ke lingkaran radius supaya area geofence selalu kelihatan jelas.
      map.fitBounds(lingkaran.getBounds().pad(0.6), { maxZoom: 18 });
    }
    // Container baru kadang belum punya ukuran final saat render pertama.
    setTimeout(() => map.invalidateSize(), 50);
  }, [lat, lng, radius, posisi, namaSekolah, fokus]);

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

      {/* isolate: z-index Leaflet (400–1000) tetap di dalam peta, tidak menutupi menu/sheet. */}
      <div className="relative isolate">
        <div ref={boxRef} className="h-[190px] w-full bg-[var(--input-bg)] z-0" aria-label="Peta lokasi sekolah" />
        {posisi && (
          <div className="absolute right-2 top-2 z-[400] flex rounded-xl overflow-hidden border border-[var(--border)] bg-[var(--card-bg)] shadow">
            <FokusBtn
              aktif={fokus === "sekolah"}
              onClick={() => setFokus("sekolah")}
              icon={<SchoolIcon size={12} />}
              label="Area"
            />
            <FokusBtn
              aktif={fokus === "keduanya"}
              onClick={() => setFokus("keduanya")}
              icon={<UserRound size={12} />}
              label="Saya"
            />
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

/** Marker custom (divIcon) supaya tidak perlu bundling aset ikon Leaflet. */
// Sekolah = gedung hijau, guru = orang kuning (ikon lucide School / UserRound).
const SVG_SEKOLAH = '<path d="M14 22v-4a2 2 0 1 0-4 0v4"/><path d="m18 10 3.447 1.724a1 1 0 0 1 .553.894V20a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2v-7.382a1 1 0 0 1 .553-.894L6 10"/><path d="M18 5v17"/><path d="m4 6 7.106-3.553a2 2 0 0 1 1.788 0L20 6"/><path d="M6 5v17"/><circle cx="12" cy="9" r="2"/>';
const SVG_ORANG = '<circle cx="12" cy="8" r="5"/><path d="M20 21a8 8 0 0 0-16 0"/>';

function ikonBulat(warna: string, svg: string, ukuran: number): L.DivIcon {
  const ikon = Math.round(ukuran * 0.55);
  return L.divIcon({
    className: "",
    html: `<div style="width:${ukuran}px;height:${ukuran}px;border-radius:50%;background:${warna};border:2.5px solid #fff;box-shadow:0 2px 6px rgba(0,0,0,.35);display:flex;align-items:center;justify-content:center"><svg xmlns="http://www.w3.org/2000/svg" width="${ikon}" height="${ikon}" viewBox="0 0 24 24" fill="none" stroke="#fff" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">${svg}</svg></div>`,
    iconSize: [ukuran, ukuran],
    iconAnchor: [ukuran / 2, ukuran / 2],
    popupAnchor: [0, -ukuran / 2],
  });
}
