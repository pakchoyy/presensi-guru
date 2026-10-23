/**
 * Web Push untuk pengingat absen.
 *
 * Alur: daftarkan service worker → minta izin notifikasi → subscribe ke push
 * service browser dengan kunci VAPID publik → kirim langganan ke Edge Function
 * `register-push` (diverifikasi dengan kode login + PIN guru).
 *
 * Push dikirim tanpa payload; teks notifikasi disusun service worker dari
 * konfigurasi yang ditulis di sini ke Cache API.
 */

/** Kunci VAPID publik — memang untuk disebar ke klien (bukan rahasia). */
export const VAPID_PUBLIC_KEY =
  "BIQfJycV4I2JZpjhb3N6pbwMnUXm-9oasMXB6JXoiNbXNLBqs6B3kfu7tnAdywzaQvjqfpmiKpTBC6nEUMzp0Cc";

const CACHE_KONFIG = "bgy-push-konfig";
const URL_KONFIG = "/__push-konfig";

export interface KonfigPengingat {
  /** Jam kerja (untuk teks notifikasi). */
  jamMasuk: string;
  jamPulang: string;
  /** Batas akhir absen masuk = jam masuk + toleransi. */
  batasMasuk: string;
  /** Jam pengingat dikirim (sudah dihitung pemanggil). */
  ingatMasuk: string;
  ingatPulang: string;
  hariAktif: number[];
}

export interface IdentitasGuru {
  kodeLogin: string;
  pin: string;
  sekolahId?: number;
}

function base64UrlKeUint8(base64Url: string): Uint8Array {
  const padding = "=".repeat((4 - (base64Url.length % 4)) % 4);
  const base64 = (base64Url + padding).replace(/-/g, "+").replace(/_/g, "/");
  const raw = atob(base64);
  const out = new Uint8Array(raw.length);
  for (let i = 0; i < raw.length; i++) out[i] = raw.charCodeAt(i);
  return out;
}

function arrayBufferKeBase64Url(buf: ArrayBuffer | null): string {
  if (!buf) return "";
  const bytes = new Uint8Array(buf);
  let s = "";
  for (const b of bytes) s += String.fromCharCode(b);
  return btoa(s).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

export function pushDidukung(): boolean {
  return (
    typeof window !== "undefined" &&
    "serviceWorker" in navigator &&
    "PushManager" in window &&
    "Notification" in window &&
    !!import.meta.env.VITE_SUPABASE_URL
  );
}

async function simpanKonfigKeCache(konfig: KonfigPengingat): Promise<void> {
  try {
    const cache = await caches.open(CACHE_KONFIG);
    await cache.put(
      URL_KONFIG,
      new Response(JSON.stringify(konfig), { headers: { "Content-Type": "application/json" } }),
    );
  } catch {
    // Cache diblokir — notifikasi tetap muncul, hanya teksnya versi umum.
  }
}

async function daftarkanServiceWorker(): Promise<ServiceWorkerRegistration> {
  const reg = await navigator.serviceWorker.register("/sw.js", { scope: "/" });
  await navigator.serviceWorker.ready;
  return reg;
}

async function panggilRegisterPush(body: Record<string, unknown>): Promise<void> {
  const url = import.meta.env.VITE_SUPABASE_URL as string;
  const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string;
  const resp = await fetch(`${url}/functions/v1/register-push`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      apikey: anonKey,
      Authorization: `Bearer ${anonKey}`,
    },
    body: JSON.stringify(body),
  });
  if (!resp.ok) {
    const teks = await resp.text().catch(() => "");
    let pesan = `HTTP ${resp.status}`;
    try {
      const j = JSON.parse(teks) as { error?: string };
      if (j.error) pesan = j.error;
    } catch {
      if (teks) pesan = teks.slice(0, 120);
    }
    throw new Error(pesan);
  }
}

export const pushService = {
  /** Apakah perangkat ini sudah berlangganan push? */
  async statusLangganan(): Promise<boolean> {
    if (!pushDidukung()) return false;
    try {
      const reg = await navigator.serviceWorker.getRegistration("/");
      const sub = await reg?.pushManager.getSubscription();
      return !!sub;
    } catch {
      return false;
    }
  },

  /**
   * Nyalakan pengingat push. Melempar Error dengan pesan siap-tampil kalau
   * gagal (izin ditolak, kode/PIN belum tersinkron ke cloud, dll).
   */
  async nyalakan(identitas: IdentitasGuru, konfig: KonfigPengingat): Promise<void> {
    if (!pushDidukung()) throw new Error("Perangkat ini tidak mendukung notifikasi push");

    let izin = Notification.permission;
    if (izin === "default") izin = await Notification.requestPermission();
    if (izin !== "granted") throw new Error("Izin notifikasi ditolak");

    const reg = await daftarkanServiceWorker();
    const sub =
      (await reg.pushManager.getSubscription()) ??
      (await reg.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: base64UrlKeUint8(VAPID_PUBLIC_KEY) as BufferSource,
      }));

    await simpanKonfigKeCache(konfig);

    await panggilRegisterPush({
      kode_login: identitas.kodeLogin,
      pin: identitas.pin,
      sekolah_id: identitas.sekolahId,
      endpoint: sub.endpoint,
      keys: {
        p256dh: arrayBufferKeBase64Url(sub.getKey("p256dh")),
        auth: arrayBufferKeBase64Url(sub.getKey("auth")),
      },
      // Server cukup tahu jam pengingatnya; offset sudah dihitung di klien.
      jam_masuk: konfig.ingatMasuk,
      jam_pulang: konfig.ingatPulang,
      menit_sebelum: 0,
      tz_offset_min: new Date().getTimezoneOffset(),
      hari_aktif: konfig.hariAktif.join(","),
    });
  },

  /** Matikan pengingat push dan hapus langganan di server. */
  async matikan(identitas: IdentitasGuru): Promise<void> {
    if (!pushDidukung()) return;
    const reg = await navigator.serviceWorker.getRegistration("/");
    const sub = await reg?.pushManager.getSubscription();
    if (!sub) return;

    // Server dibersihkan dulu; kalau gagal, langganan lokal tetap dicabut
    // supaya guru tidak menerima pengingat lagi di perangkat ini.
    try {
      await panggilRegisterPush({
        kode_login: identitas.kodeLogin,
        pin: identitas.pin,
        endpoint: sub.endpoint,
        aktif: false,
      });
    } catch {
      /* diabaikan — unsubscribe lokal di bawah tetap dilakukan */
    }
    await sub.unsubscribe();
  },
};
