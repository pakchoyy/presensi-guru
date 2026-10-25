// Hitung posisi overlay (lingkaran radius & ikon guru) di atas peta Google embed
// yang berpusat di titik sekolah. Proyeksi Web Mercator, tile 256 px CSS.
const R = 6378137;

export function metersPerPixel(lat: number, z: number): number {
  return (156543.03392 * Math.cos((lat * Math.PI) / 180)) / 2 ** z;
}

/** Selisih piksel titik (lat2,lng2) terhadap pusat (lat,lng): x ke kanan, y ke bawah. */
export function offsetPx(lat: number, lng: number, lat2: number, lng2: number, z: number) {
  const mpp = metersPerPixel(lat, z);
  const rad = Math.PI / 180;
  return {
    x: ((lng2 - lng) * rad * R * Math.cos(lat * rad)) / mpp,
    y: (-(lat2 - lat) * rad * R) / mpp,
  };
}

/** Zoom bulat terbesar (13–19) yang memuat lingkaran radius dan posisi guru di kotak w×h. */
export function pilihZoom(
  lat: number,
  lng: number,
  radiusMeter: number,
  w: number,
  h: number,
  posisi?: { lat: number; lng: number } | null,
  margin = 20,
): number {
  for (let z = 19; z > 13; z--) {
    const r = radiusMeter / metersPerPixel(lat, z);
    if (r > Math.min(w, h) / 2 - margin) continue;
    if (posisi) {
      const o = offsetPx(lat, lng, posisi.lat, posisi.lng, z);
      if (Math.abs(o.x) > w / 2 - margin || Math.abs(o.y) > h / 2 - margin) continue;
    }
    return z;
  }
  return 13;
}
