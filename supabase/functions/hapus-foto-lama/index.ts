// Hapus foto selfie presensi yang lebih dari 7 hari (bucket selfie-guru).
// Data jam & lokasi tetap; hanya kolom URL foto yang dikosongkan.
// Dipanggil pg_cron sekali sehari dengan header x-reminder-key (verify_jwt = false).
import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";

const SIMPAN_HARI = 7;
const BUCKET = "selfie-guru";

Deno.serve(async (req) => {
  const admin = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!, {
    auth: { persistSession: false },
  });

  const { data: kunci } = await admin.from("app_secrets").select("value").eq("name", "reminder_key").maybeSingle();
  if (!kunci?.value || req.headers.get("x-reminder-key") !== kunci.value) {
    return new Response(JSON.stringify({ error: "unauthorized" }), { status: 401 });
  }

  const batas = new Date(Date.now() - SIMPAN_HARI * 864e5).toISOString().slice(0, 10);
  const { data: baris, error } = await admin
    .from("cloud_guru_attendance")
    .select("id, selfie_masuk_url, selfie_pulang_url")
    .lt("tanggal", batas)
    .or("selfie_masuk_url.not.is.null,selfie_pulang_url.not.is.null")
    .limit(1000);
  if (error) return new Response(JSON.stringify({ error: error.message }), { status: 500 });

  // URL yang tersimpan berupa path objek di bucket; data URL lama (bukan path) cukup dikosongkan.
  const path = (baris ?? [])
    .flatMap((b) => [b.selfie_masuk_url, b.selfie_pulang_url])
    .filter((p): p is string => !!p && !p.startsWith("data:") && !p.startsWith("http"));
  let gagal = 0;
  for (let i = 0; i < path.length; i += 100) {
    const { error: e } = await admin.storage.from(BUCKET).remove(path.slice(i, i + 100));
    if (e) gagal++;
  }
  // Kosongkan URL hanya kalau penghapusan berhasil, supaya file tidak yatim.
  if (gagal === 0 && baris?.length) {
    await admin
      .from("cloud_guru_attendance")
      .update({ selfie_masuk_url: null, selfie_pulang_url: null })
      .in("id", baris.map((b) => b.id));
  }

  return new Response(JSON.stringify({ baris: baris?.length ?? 0, file: path.length, gagal }), {
    headers: { "Content-Type": "application/json" },
  });
});
