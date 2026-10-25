// Hapus foto presensi di bucket selfie-guru: selfie setelah 7 hari, foto lampiran izin setelah 30 hari.
// Data jam & lokasi tetap; hanya kolom URL foto yang dikosongkan.
// Dipanggil pg_cron sekali sehari dengan header x-reminder-key (verify_jwt = false).
import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";

const BUCKET = "selfie-guru";
const BATCH = 500;
const BATAS_WAKTU_MS = 50_000;

type Admin = ReturnType<typeof createClient>;

// Kolom foto dan lama simpan (hari). Diproses per batch sampai habis atau waktu hampir habis.
const JENIS: { kolom: string[]; hari: number }[] = [
  { kolom: ["selfie_masuk_url", "selfie_pulang_url"], hari: 7 },
  { kolom: ["izin_foto_url"], hari: 30 },
];

async function satuBatch(admin: Admin, kolom: string[], hari: number) {
  const batas = new Date(Date.now() - hari * 864e5).toISOString().slice(0, 10);
  const { data: baris, error } = await admin
    .from("cloud_guru_attendance")
    .select(`id, ${kolom.join(", ")}`)
    .lt("tanggal", batas)
    .or(kolom.map((k) => `${k}.not.is.null`).join(","))
    .limit(BATCH);
  if (error) throw error;
  const rows = (baris ?? []) as unknown as Record<string, string | null>[];
  // URL tersimpan berupa path objek; data URL lama (bukan path) cukup dikosongkan.
  const path = rows
    .flatMap((b) => kolom.map((k) => b[k]))
    .filter((p): p is string => !!p && !p.startsWith("data:") && !p.startsWith("http"));
  for (let i = 0; i < path.length; i += 100) {
    const { error: e } = await admin.storage.from(BUCKET).remove(path.slice(i, i + 100));
    // Kosongkan URL hanya kalau penghapusan berhasil, supaya file tidak yatim.
    if (e) throw e;
  }
  const kosong = Object.fromEntries(kolom.map((k) => [k, null]));
  for (let i = 0; i < rows.length; i += 100) {
    const { error: e } = await admin
      .from("cloud_guru_attendance")
      .update(kosong)
      .in("id", rows.slice(i, i + 100).map((b) => b.id));
    if (e) throw e;
  }
  return { baris: rows.length, file: path.length };
}

Deno.serve(async (req) => {
  const admin = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!, {
    auth: { persistSession: false },
  });

  const { data: kunci } = await admin.from("app_secrets").select("value").eq("name", "reminder_key").maybeSingle();
  if (!kunci?.value || req.headers.get("x-reminder-key") !== kunci.value) {
    return new Response(JSON.stringify({ error: "unauthorized" }), { status: 401 });
  }

  const mulai = Date.now();
  const total = { baris: 0, file: 0 };
  try {
    for (const { kolom, hari } of JENIS) {
      while (Date.now() - mulai < BATAS_WAKTU_MS) {
        const r = await satuBatch(admin, kolom, hari);
        total.baris += r.baris;
        total.file += r.file;
        if (r.baris < BATCH) break;
      }
    }
  } catch (e) {
    return new Response(JSON.stringify({ ...total, error: String((e as Error)?.message ?? e) }), { status: 500 });
  }
  return new Response(JSON.stringify(total), { headers: { "Content-Type": "application/json" } });
});
