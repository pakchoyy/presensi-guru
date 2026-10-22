import { createClient } from "@supabase/supabase-js";

const YEAR_MS = 365 * 24 * 60 * 60 * 1000;

function getSupabase() {
  const url = process.env.VITE_SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error("Missing Supabase env");
  return createClient(url, key);
}

const normEmail = (e) => String(e || "").toLowerCase().trim();
const normKode = (k) => String(k || "").toUpperCase().trim();

async function markPro(supabase, email) {
  const { data: profile } = await supabase.from("profiles").select("id, tier").eq("email", email).maybeSingle();
  if (profile && profile.tier !== "PRO") {
    await supabase.from("profiles").update({ tier: "PRO", updated_at: new Date().toISOString() }).eq("id", profile.id);
  }
}

// Produk aplikasi ini (shared Supabase project dengan Presensi Siswa).
const PRODUCT = "guru";

// Klaim kode secara atomik: hanya berhasil kalau status masih 'tersedia' DAN product cocok.
async function claimKode(supabase, kode, fields) {
  const { data, error } = await supabase
    .from("licenses")
    .update({ status: "digunakan", ...fields })
    .eq("kode", kode)
    .eq("status", "tersedia")
    .eq("product", PRODUCT)
    .select("id")
    .limit(1);
  if (error) throw error;
  return data && data.length > 0;
}

async function kodeError(supabase, kode) {
  const { data } = await supabase.from("licenses").select("status, product").eq("kode", kode).maybeSingle();
  if (!data) return "Kode lisensi tidak ditemukan";
  if (data.product && data.product !== PRODUCT) return "Kode ini untuk produk lain (Presensi Siswa) — gunakan kode PresGuru";
  return "Kode lisensi sudah digunakan";
}

async function activate(supabase, body) {
  const email = normEmail(body.email);
  const kode = normKode(body.kode);
  if (!email.includes("@")) return [400, { error: "Email tidak valid" }];
  if (kode.length < 8) return [400, { error: "Format kode: BGY-PG-XXXX" }];

  const now = Date.now();
  const tanggalBerakhir = now + YEAR_MS;
  const ok = await claimKode(supabase, kode, {
    email,
    guru_id: body.guruId ?? null,
    tanggal_aktivasi: now,
    tanggal_berakhir: tanggalBerakhir,
  });
  if (!ok) return [409, { error: await kodeError(supabase, kode) }];

  await markPro(supabase, email);
  return [200, { ok: true, tanggalBerakhir }];
}

async function renew(supabase, body) {
  const email = normEmail(body.email);
  const kode = normKode(body.kode);
  if (!email.includes("@")) return [400, { error: "Email tidak valid" }];
  if (kode.length < 8) return [400, { error: "Format kode: BGY-PG-XXXX" }];

  const { data: current } = await supabase
    .from("licenses")
    .select("id, tanggal_berakhir")
    .eq("email", email)
    .eq("product", PRODUCT)
    .eq("status", "digunakan")
    .order("tanggal_berakhir", { ascending: false })
    .limit(1)
    .maybeSingle();

  const now = Date.now();
  const base = current?.tanggal_berakhir ? Math.max(now, current.tanggal_berakhir) : now;
  const newExpiry = base + YEAR_MS;

  const ok = await claimKode(supabase, kode, { email, tanggal_aktivasi: now, tanggal_berakhir: newExpiry });
  if (!ok) return [409, { error: "Kode perpanjangan tidak valid atau sudah digunakan" }];

  if (current) await supabase.from("licenses").update({ tanggal_berakhir: newExpiry }).eq("id", current.id);
  return [200, { ok: true, tanggalBerakhir: newExpiry }];
}

// Cek lisensi aktif milik sebuah email (menggantikan query langsung ke tabel dari browser).
async function status(supabase, body) {
  const email = normEmail(body.email);
  if (!email.includes("@")) return [400, { error: "Email tidak valid" }];
  const { data, error } = await supabase
    .from("licenses")
    .select("tanggal_berakhir")
    .eq("email", email)
    .eq("product", PRODUCT)
    .eq("status", "digunakan")
    .order("tanggal_berakhir", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error) throw error;
  return [200, { found: !!data, tanggalBerakhir: data?.tanggal_berakhir ?? null }];
}

const ACTIONS = { activate, renew, status };

export default async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });
  const { action } = req.body || {};
  const fn = ACTIONS[action];
  if (!fn) return res.status(400).json({ error: "Action tidak dikenal" });
  try {
    const [code, payload] = await fn(getSupabase(), req.body);
    return res.status(code).json(payload);
  } catch {
    return res.status(500).json({ error: "Gagal memproses lisensi di server" });
  }
}
