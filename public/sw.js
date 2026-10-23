/* Service worker Presensi Yuk | Guru — khusus pengingat absen.
 *
 * Push dikirim TANPA payload (lihat Edge Function send-absen-reminder), jadi
 * teks notifikasi disusun di sini dari konfigurasi yang ditulis halaman saat
 * guru menyalakan pengingat. Konfigurasi disimpan di Cache API karena service
 * worker tidak bisa membaca localStorage.
 */

const CACHE_KONFIG = "bgy-push-konfig";
const URL_KONFIG = "/__push-konfig";

self.addEventListener("install", () => self.skipWaiting());
self.addEventListener("activate", (event) => event.waitUntil(self.clients.claim()));

async function bacaKonfig() {
  try {
    const cache = await caches.open(CACHE_KONFIG);
    const resp = await cache.match(URL_KONFIG);
    if (!resp) return null;
    return await resp.json();
  } catch {
    return null;
  }
}

/** Tebak slot pengingat (masuk / pulang) dari jam sekarang di perangkat. */
function susunPesan(konfig) {
  const bawaan = {
    title: "Presensi Yuk | Guru",
    body: "Jangan lupa absen hari ini.",
  };
  if (!konfig) return bawaan;

  const menitDari = (jam) => {
    const m = /^(\d{1,2}):(\d{2})/.exec(jam || "");
    return m ? Number(m[1]) * 60 + Number(m[2]) : null;
  };

  const now = new Date();
  const sekarang = now.getHours() * 60 + now.getMinutes();

  const jarak = (jam) => {
    const t = menitDari(jam);
    return t == null ? Infinity : Math.abs(sekarang - t);
  };
  const dekatMasuk = jarak(konfig.ingatMasuk);
  const dekatPulang = jarak(konfig.ingatPulang);

  if (dekatMasuk === Infinity && dekatPulang === Infinity) return bawaan;

  if (dekatMasuk <= dekatPulang) {
    return {
      title: "Presensi Yuk | Guru",
      body: `Batas absen masuk ${konfig.batasMasuk} — tinggal 5 menit lagi.`,
    };
  }
  return {
    title: "Presensi Yuk | Guru",
    body: `Jam pulang ${konfig.jamPulang} — jangan lupa absen pulang.`,
  };
}

self.addEventListener("push", (event) => {
  event.waitUntil(
    (async () => {
      const konfig = await bacaKonfig();
      const pesan = susunPesan(konfig);
      await self.registration.showNotification(pesan.title, {
        body: pesan.body,
        icon: "/icons/pg-192-v1.png",
        badge: "/icons/pg-192-v1.png",
        tag: "pengingat-absen",
        renotify: true,
        data: { url: "/" },
      });
    })(),
  );
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const target = (event.notification.data && event.notification.data.url) || "/";
  event.waitUntil(
    (async () => {
      const daftar = await self.clients.matchAll({ type: "window", includeUncontrolled: true });
      for (const klien of daftar) {
        if ("focus" in klien) return klien.focus();
      }
      if (self.clients.openWindow) return self.clients.openWindow(target);
    })(),
  );
});
