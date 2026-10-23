// Pengirim pengingat absen (Web Push tanpa payload).
//
// Dipanggil pg_cron tiap 5 menit. Untuk tiap langganan aktif, waktu lokal
// perangkat dihitung dari tz_offset_min, lalu dicek apakah sekarang masuk
// jendela pengingat (jam masuk/pulang dikurangi menit_sebelum).
//
// Push dikirim TANPA payload: isi notifikasi disusun di service worker pada
// perangkat guru. Jadi tidak perlu enkripsi aes128gcm, dan teks pengingat
// tidak pernah melewati server push pihak ketiga.
import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";

interface Langganan {
  id: number;
  endpoint: string;
  jam_masuk: string;
  jam_pulang: string;
  menit_sebelum: number;
  tz_offset_min: number;
  hari_aktif: string;
  last_masuk: string | null;
  last_pulang: string | null;
  gagal_beruntun: number;
}

const b64url = (buf: ArrayBuffer | Uint8Array): string => {
  const bytes = buf instanceof Uint8Array ? buf : new Uint8Array(buf);
  let s = "";
  for (const b of bytes) s += String.fromCharCode(b);
  return btoa(s).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
};

/** JWT ES256 untuk header Authorization: vapid. */
async function buatVapidJwt(aud: string, subject: string, jwk: JsonWebKey): Promise<string> {
  const key = await crypto.subtle.importKey(
    "jwk",
    { ...jwk, key_ops: ["sign"], ext: true } as JsonWebKey,
    { name: "ECDSA", namedCurve: "P-256" },
    false,
    ["sign"],
  );
  const header = b64url(new TextEncoder().encode(JSON.stringify({ typ: "JWT", alg: "ES256" })));
  const payload = b64url(
    new TextEncoder().encode(
      JSON.stringify({ aud, exp: Math.floor(Date.now() / 1000) + 12 * 3600, sub: subject }),
    ),
  );
  const data = new TextEncoder().encode(`${header}.${payload}`);
  const sig = await crypto.subtle.sign({ name: "ECDSA", hash: "SHA-256" }, key, data);
  return `${header}.${payload}.${b64url(sig)}`;
}

function menitDariJam(jam: string): number | null {
  const m = /^(\d{1,2}):(\d{2})/.exec(jam ?? "");
  if (!m) return null;
  const h = Number(m[1]);
  const mm = Number(m[2]);
  if (h > 23 || mm > 59) return null;
  return h * 60 + mm;
}

Deno.serve(async (req) => {
  const url = Deno.env.get("SUPABASE_URL")!;
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const admin = createClient(url, serviceKey, { auth: { persistSession: false } });

  // Kunci pemanggil (dipakai pg_cron) — fungsi ini verify_jwt = false.
  const { data: rahasia, error: errRahasia } = await admin
    .from("app_secrets")
    .select("name, value")
    .in("name", ["vapid_private_jwk", "vapid_public", "vapid_subject", "reminder_key"]);
  if (errRahasia) return new Response(JSON.stringify({ error: errRahasia.message }), { status: 500 });

  const peta = Object.fromEntries((rahasia ?? []).map((r) => [r.name, r.value]));
  const kunciPemanggil = peta["reminder_key"];
  if (!kunciPemanggil || req.headers.get("x-reminder-key") !== kunciPemanggil) {
    return new Response(JSON.stringify({ error: "unauthorized" }), { status: 401 });
  }

  const jwk = JSON.parse(peta["vapid_private_jwk"]) as JsonWebKey;
  const vapidPublic = peta["vapid_public"];
  const subject = peta["vapid_subject"] ?? "mailto:admin@bantuguruyuk.web.id";

  const { data: langganan, error } = await admin
    .from("cloud_guru_push")
    .select("id, endpoint, jam_masuk, jam_pulang, menit_sebelum, tz_offset_min, hari_aktif, last_masuk, last_pulang, gagal_beruntun")
    .eq("aktif", true)
    .returns<Langganan[]>();
  if (error) return new Response(JSON.stringify({ error: error.message }), { status: 500 });

  const sekarangUtc = Date.now();
  const hasil = { dicek: langganan?.length ?? 0, dikirim: 0, gagal: 0, dihapus: 0 };
  const TOLERANSI_MENIT = 3; // cron tiap 5 menit → jendela ±3 menit

  for (const sub of langganan ?? []) {
    // Waktu lokal perangkat: UTC - offset (getTimezoneOffset WIB = -420).
    const lokal = new Date(sekarangUtc - sub.tz_offset_min * 60_000);
    const menitSekarang = lokal.getUTCHours() * 60 + lokal.getUTCMinutes();
    const tanggalLokal = lokal.toISOString().slice(0, 10);
    const hariLokal = lokal.getUTCDay();

    const hariAktif = sub.hari_aktif.split(",").map((n) => Number(n.trim()));
    if (!hariAktif.includes(hariLokal)) continue;

    const cocok = (jam: string, terakhir: string | null): boolean => {
      const target = menitDariJam(jam);
      if (target == null) return false;
      const ingat = target - sub.menit_sebelum;
      return Math.abs(menitSekarang - ingat) <= TOLERANSI_MENIT && terakhir !== tanggalLokal;
    };

    const kirimMasuk = cocok(sub.jam_masuk, sub.last_masuk);
    const kirimPulang = !kirimMasuk && cocok(sub.jam_pulang, sub.last_pulang);
    if (!kirimMasuk && !kirimPulang) continue;

    try {
      const aud = new URL(sub.endpoint).origin;
      const jwt = await buatVapidJwt(aud, subject, jwk);
      const resp = await fetch(sub.endpoint, {
        method: "POST",
        headers: {
          TTL: "1800",
          Urgency: "high",
          Authorization: `vapid t=${jwt}, k=${vapidPublic}`,
        },
      });

      if (resp.status === 404 || resp.status === 410) {
        // Langganan sudah mati (app di-uninstall / izin dicabut).
        await admin.from("cloud_guru_push").delete().eq("id", sub.id);
        hasil.dihapus++;
        continue;
      }
      if (!resp.ok) {
        hasil.gagal++;
        await admin
          .from("cloud_guru_push")
          .update({ gagal_beruntun: sub.gagal_beruntun + 1, updated_at: new Date().toISOString() })
          .eq("id", sub.id);
        continue;
      }

      hasil.dikirim++;
      await admin
        .from("cloud_guru_push")
        .update({
          ...(kirimMasuk ? { last_masuk: tanggalLokal } : { last_pulang: tanggalLokal }),
          gagal_beruntun: 0,
          updated_at: new Date().toISOString(),
        })
        .eq("id", sub.id);
    } catch (_e) {
      hasil.gagal++;
    }
  }

  return new Response(JSON.stringify(hasil), {
    status: 200,
    headers: { "Content-Type": "application/json" },
  });
});
