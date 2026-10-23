// Register / unregister Web Push subscription milik guru.
//
// Di perangkat bersama (mode kios) guru login lokal tanpa sesi Supabase, jadi
// fungsi ini memverifikasi sendiri: kode+PIN dicocokkan ke akun sintetis
// `${kode}@guru.local` yang dibuat create-guru-account. Karena itu
// verify_jwt = false.
import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...CORS, "Content-Type": "application/json" },
  });
}

/** Sama persis dengan passwordDariPin() di src/lib/utils.ts. */
function passwordDariPin(pin: string): string {
  return `pyg-${pin.trim()}`;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });
  if (req.method !== "POST") return json({ error: "method_not_allowed" }, 405);

  const url = Deno.env.get("SUPABASE_URL")!;
  const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return json({ error: "body_bukan_json" }, 400);
  }

  const kode = String(body.kode_login ?? "").trim();
  const pin = String(body.pin ?? "").trim();
  const endpoint = String(body.endpoint ?? "").trim();
  if (!kode || !pin || !endpoint) return json({ error: "kode_login, pin, endpoint wajib" }, 400);

  // 1. Verifikasi identitas guru lewat akun sintetis.
  const authClient = createClient(url, anonKey, { auth: { persistSession: false } });
  const { data: login, error: loginErr } = await authClient.auth.signInWithPassword({
    email: `${kode}@guru.local`,
    password: passwordDariPin(pin),
  });
  if (loginErr || !login.user) return json({ error: "kode_atau_pin_salah" }, 401);

  const admin = createClient(url, serviceKey, { auth: { persistSession: false } });

  // 2. Mode berhenti berlangganan.
  if (body.aktif === false) {
    const { error } = await admin.from("cloud_guru_push").delete().eq("endpoint", endpoint);
    if (error) return json({ error: error.message }, 500);
    return json({ ok: true, aktif: false });
  }

  // 3. Simpan / perbarui langganan.
  const keys = (body.keys ?? {}) as Record<string, string>;
  const row = {
    endpoint,
    p256dh: keys.p256dh ?? null,
    auth: keys.auth ?? null,
    kode_login: kode,
    user_id: login.user.id,
    sekolah_id: body.sekolah_id != null ? Number(body.sekolah_id) : null,
    jam_masuk: String(body.jam_masuk ?? "07:00").slice(0, 5),
    jam_pulang: String(body.jam_pulang ?? "13:00").slice(0, 5),
    menit_sebelum: Number(body.menit_sebelum ?? 10),
    tz_offset_min: Number(body.tz_offset_min ?? -420),
    hari_aktif: String(body.hari_aktif ?? "1,2,3,4,5,6"),
    aktif: true,
    gagal_beruntun: 0,
    updated_at: new Date().toISOString(),
  };

  const { error } = await admin.from("cloud_guru_push").upsert(row, { onConflict: "endpoint" });
  if (error) return json({ error: error.message }, 500);

  return json({ ok: true, aktif: true });
});
