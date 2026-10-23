// Edge Function: create-guru-account
//
// Memprovisioning akun auth.users untuk seorang guru + insert row ke
// cloud_guru_teachers. Dipanggil oleh halaman Daftar Guru (admin only).
//
// Input (JSON):
//   { nama: string, kode_login?: string, pin?: string, nip?: string,
//     jabatan?: string, role?: 'guru'|'admin'|'kepala'|'operator',
//     local_id?: number }   (sekolah_id lama masih diterima tapi diabaikan)
//
// Auth:
//   Header "Authorization: Bearer <access_token>" dari admin. Pemanggil harus
//   pemilik sebuah cloud_guru_sekolah; guru otomatis didaftarkan ke sekolah
//   itu. sekolah_id dari klien diabaikan — tidak bisa dipercaya karena
//   nilainya Date.now()+acak dan mudah ditebak.

import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.4";

type Role = "guru" | "admin" | "kepala" | "operator";

interface Payload {
  nama: string;
  kode_login?: string;
  pin?: string;
  nip?: string;
  jabatan?: string;
  role?: Role;
  sekolah_id?: number; // diabaikan, lihat catatan Auth di atas
  local_id?: number;
}

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

function randomKode(): string {
  const n = Math.floor(1000 + Math.random() * 9000);
  return `G-${n}`;
}

function randomPin(len = 4): string {
  let out = "";
  for (let i = 0; i < len; i++) out += Math.floor(Math.random() * 10).toString();
  return out;
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
  if (!SUPABASE_URL || !SERVICE_ROLE) {
    return json({ error: "env_missing" }, 500);
  }

  const admin = createClient(SUPABASE_URL, SERVICE_ROLE, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  const auth = req.headers.get("Authorization") || "";
  const bearer = auth.replace(/^Bearer\s+/i, "");
  if (!bearer) return json({ error: "unauthorized" }, 401);
  const { data: userRes, error: userErr } = await admin.auth.getUser(bearer);
  if (userErr || !userRes?.user) return json({ error: "invalid_token" }, 401);
  const callerId = userRes.user.id;

  let body: Payload;
  try {
    body = (await req.json()) as Payload;
  } catch {
    return json({ error: "bad_json" }, 400);
  }
  if (!body?.nama) {
    return json({ error: "nama_wajib" }, 400);
  }

  const { data: sekolah } = await admin
    .from("cloud_guru_sekolah")
    .select("id, local_id")
    .eq("owner_user_id", callerId)
    .maybeSingle();
  if (!sekolah) {
    return json({ error: "sekolah_belum_terdaftar_di_cloud" }, 403);
  }

  let kode = (body.kode_login || body.nip || "").trim();
  if (!kode) {
    for (let i = 0; i < 50; i++) {
      const candidate = randomKode();
      const { data: dup } = await admin
        .from("cloud_guru_teachers")
        .select("id")
        .eq("kode_login", candidate)
        .maybeSingle();
      if (!dup) { kode = candidate; break; }
    }
    if (!kode) return json({ error: "cannot_generate_unique_kode" }, 500);
  } else {
    const { data: dup } = await admin
      .from("cloud_guru_teachers")
      .select("id")
      .eq("kode_login", kode)
      .maybeSingle();
    if (dup) return json({ error: "kode_sudah_dipakai" }, 409);
  }

  const pin = (body.pin || "").trim() || randomPin(4);
  if (!/^\d{4,6}$/.test(pin)) {
    return json({ error: "pin_harus_4_6_digit" }, 400);
  }

  const email = `${kode}@guru.local`;
  const role: Role = body.role || "guru";

  const { data: created, error: createErr } = await admin.auth.admin.createUser({
    email,
    password: passwordDariPin(pin),
    email_confirm: true,
    user_metadata: {
      kode_login: kode,
      nama: body.nama,
      nip: body.nip ?? null,
      role,
      sekolah_id: sekolah.local_id,
      tier: "FREE",
    },
  });
  if (createErr || !created.user) {
    return json({ error: "create_user_failed", detail: createErr?.message }, 500);
  }
  const guruUserId = created.user.id;

  const now = Date.now();
  const { data: inserted, error: insErr } = await admin
    .from("cloud_guru_teachers")
    .insert({
      user_id: guruUserId,
      local_id: body.local_id ?? now,
      sekolah_id: sekolah.local_id,
      sekolah_uuid: sekolah.id,
      nama: body.nama,
      email: "",
      tier: "FREE",
      nip: body.nip ?? null,
      kode_login: kode,
      jabatan: body.jabatan ?? null,
      role,
      absen_token: crypto.randomUUID(),
      status_aktif: true,
      dibuat_pada: now,
      diubah_pada: now,
      last_synced_at: now,
      version: 1,
    })
    .select("id, user_id")
    .single();

  if (insErr) {
    await admin.auth.admin.deleteUser(guruUserId).catch(() => {});
    return json({ error: "insert_row_failed", detail: insErr.message }, 500);
  }

  return json({
    ok: true,
    user_id: guruUserId,
    row_id: inserted.id,
    kode_login: kode,
    pin, // dikembalikan PLAIN sekali supaya admin bisa share — frontend tidak boleh menyimpan.
    email,
  });
});
