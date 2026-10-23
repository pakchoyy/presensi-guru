// Edge Function: reset-guru-pin
//
// Reset PIN seorang guru. Dipanggil oleh admin (Ops / Kepala Sekolah) dari
// halaman Daftar Guru.
//
// Input (JSON): { user_id: string, new_pin?: string }
//   Jika new_pin kosong → generate 4 digit random.
//
// Return: { ok, new_pin }

import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient, SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2.45.4";

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json", ...CORS },
  });
}

function randomPin(len = 4): string {
  let out = "";
  for (let i = 0; i < len; i++) out += Math.floor(Math.random() * 10).toString();
  return out;
}

async function bumpVersion(admin: SupabaseClient, userId: string): Promise<number> {
  const { data } = await admin
    .from("cloud_guru_teachers")
    .select("version")
    .eq("user_id", userId)
    .maybeSingle();
  return ((data?.version as number | undefined) ?? 0) + 1;
}

/** Sama persis dengan passwordDariPin() di src/lib/utils.ts. */
function passwordDariPin(pin: string): string {
  return `pyg-${pin.trim()}`;
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });
  if (req.method !== "POST") return json({ error: "method_not_allowed" }, 405);

  const SUPABASE_URL = Deno.env.get("SUPABASE_URL");
  const SERVICE_ROLE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (!SUPABASE_URL || !SERVICE_ROLE) return json({ error: "env_missing" }, 500);

  const admin = createClient(SUPABASE_URL, SERVICE_ROLE, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  const auth = req.headers.get("Authorization") || "";
  const bearer = auth.replace(/^Bearer\s+/i, "");
  if (!bearer) return json({ error: "unauthorized" }, 401);
  const { data: userRes, error: userErr } = await admin.auth.getUser(bearer);
  if (userErr || !userRes?.user) return json({ error: "invalid_token" }, 401);
  const callerId = userRes.user.id;

  let body: { user_id?: string; new_pin?: string };
  try { body = await req.json(); } catch { return json({ error: "bad_json" }, 400); }
  if (!body?.user_id) return json({ error: "user_id_wajib" }, 400);

  // Pemanggil harus pemilik sekolah cloud tempat guru itu terdaftar.
  const { data: sekolah } = await admin
    .from("cloud_guru_sekolah")
    .select("id")
    .eq("owner_user_id", callerId)
    .maybeSingle();
  if (!sekolah) return json({ error: "forbidden_not_admin" }, 403);

  const { data: targetRow } = await admin
    .from("cloud_guru_teachers")
    .select("sekolah_uuid")
    .eq("user_id", body.user_id)
    .maybeSingle();
  if (!targetRow) return json({ error: "guru_tidak_ditemukan" }, 404);
  if (targetRow.sekolah_uuid !== sekolah.id) {
    return json({ error: "forbidden_wrong_school" }, 403);
  }

  const pin = (body.new_pin || "").trim() || randomPin(4);
  if (!/^\d{4,6}$/.test(pin)) return json({ error: "pin_harus_4_6_digit" }, 400);

  const { error: upErr } = await admin.auth.admin.updateUserById(body.user_id, {
    password: passwordDariPin(pin),
  });
  if (upErr) return json({ error: "update_password_failed", detail: upErr.message }, 500);

  const newVersion = await bumpVersion(admin, body.user_id);
  await admin
    .from("cloud_guru_teachers")
    .update({ diubah_pada: Date.now(), version: newVersion })
    .eq("user_id", body.user_id);

  return json({ ok: true, new_pin: pin });
});
