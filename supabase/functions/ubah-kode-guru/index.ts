// Edge Function: ubah-kode-guru
//
// Ganti kode login guru yang sudah punya akun cloud. Email akun cloud =
// `${kode}@guru.local`, jadi email & kolom kode_login diganti bersama dari
// server (kolom kode_login dikunci trigger untuk klien biasa).
//
// Input (JSON): { user_id: string, kode_baru: string }
// Auth: pemanggil harus pemilik sekolah tempat guru itu terdaftar.
import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.4";

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

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });
  if (req.method !== "POST") return json({ error: "method_not_allowed" }, 405);

  const SUPABASE_URL = Deno.env.get("SUPABASE_URL");
  const SERVICE_ROLE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (!SUPABASE_URL || !SERVICE_ROLE) return json({ error: "env_missing" }, 500);

  const admin = createClient(SUPABASE_URL, SERVICE_ROLE, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  const bearer = (req.headers.get("Authorization") || "").replace(/^Bearer\s+/i, "");
  if (!bearer) return json({ error: "unauthorized" }, 401);
  const { data: userRes, error: userErr } = await admin.auth.getUser(bearer);
  if (userErr || !userRes?.user) return json({ error: "invalid_token" }, 401);
  const callerId = userRes.user.id;

  let body: { user_id?: string; kode_baru?: string };
  try { body = await req.json(); } catch { return json({ error: "bad_json" }, 400); }
  const kodeBaru = (body.kode_baru || "").trim();
  if (!body.user_id || !kodeBaru) return json({ error: "user_id_dan_kode_baru_wajib" }, 400);
  if (!/^[A-Za-z0-9._-]{3,40}$/.test(kodeBaru)) return json({ error: "kode_tidak_valid" }, 400);

  const { data: sekolah } = await admin
    .from("cloud_guru_sekolah").select("id").eq("owner_user_id", callerId).maybeSingle();
  if (!sekolah) return json({ error: "forbidden_not_admin" }, 403);

  const { data: target } = await admin
    .from("cloud_guru_teachers").select("sekolah_uuid, kode_login").eq("user_id", body.user_id).maybeSingle();
  if (!target) return json({ error: "guru_tidak_ditemukan" }, 404);
  if (target.sekolah_uuid !== sekolah.id) return json({ error: "forbidden_wrong_school" }, 403);
  if (target.kode_login === kodeBaru) return json({ ok: true, kode_login: kodeBaru });

  const { data: dup } = await admin
    .from("cloud_guru_teachers").select("id").eq("kode_login", kodeBaru).maybeSingle();
  if (dup) return json({ error: "kode_sudah_dipakai" }, 409);

  const { error: upAuth } = await admin.auth.admin.updateUserById(body.user_id, {
    email: `${kodeBaru}@guru.local`,
    email_confirm: true,
  });
  if (upAuth) return json({ error: "update_email_failed", detail: upAuth.message }, 500);

  const { error: upRow } = await admin
    .from("cloud_guru_teachers")
    .update({ kode_login: kodeBaru, diubah_pada: Date.now() })
    .eq("user_id", body.user_id);
  if (upRow) {
    // Kembalikan email supaya akun & baris tetap konsisten.
    await admin.auth.admin.updateUserById(body.user_id, {
      email: `${target.kode_login}@guru.local`, email_confirm: true,
    }).catch(() => {});
    return json({ error: "update_row_failed", detail: upRow.message }, 500);
  }

  return json({ ok: true, kode_login: kodeBaru });
});
