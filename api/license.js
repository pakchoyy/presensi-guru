import { createClient } from "@supabase/supabase-js";

const SEMESTER_MS = 180 * 24 * 60 * 60 * 1000;

function getSupabase() {
  const url = process.env.VITE_SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error("Missing Supabase env");
  return createClient(url, key);
}

const normEmail = (e) => String(e || "").toLowerCase().trim();
const normKode = (k) => String(k || "").toUpperCase().trim();

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
    .select("id, tier")
    .limit(1);
  if (error) throw error;
  return data && data[0] ? data[0].tier || "PRO" : null;
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
  const tanggalBerakhir = now + SEMESTER_MS;
  const ok = await claimKode(supabase, kode, {
    email,
    guru_id: body.guruId ?? null,
    tanggal_aktivasi: now,
    tanggal_berakhir: tanggalBerakhir,
  });
  if (!ok) return [409, { error: await kodeError(supabase, kode) }];

  let referral = null;
  try { referral = await applyReferral(supabase, body.ref, email, ok); } catch { /* referral tidak boleh menggagalkan aktivasi */ }
  return [200, { ok: true, tanggalBerakhir, tier: ok, referral }];
}

// ── Affiliate (kode & saldo sama dengan Presensi Siswa; bonus pembeli Guru dari app_settings) ──
const REF_RE = /^PY-[A-Z0-9]{6}$/;
const GURU_REWARD_KEYS = {
  PLUS: ["affiliate_commission_guru_plus", "affiliate_bonus_days_guru_plus", 1500, 12],
  PRO: ["affiliate_commission_guru_pro", "affiliate_bonus_days_guru_pro", 3000, 30],
};

async function activeLic(supabase, email, product) {
  const { data } = await supabase.from("licenses").select("id, tier, tanggal_berakhir")
    .eq("email", email).eq("status", "digunakan").eq("product", product)
    .order("tanggal_berakhir", { ascending: false }).limit(1).maybeSingle();
  return data && (!data.tanggal_berakhir || data.tanggal_berakhir > Date.now()) ? data : null;
}
const isPro = (l) => !!l && (l.tier || "PRO") === "PRO";

async function applyReferral(supabase, rawCode, buyerEmail, buyerTier) {
  const code = String(rawCode || "").toUpperCase().trim();
  if (!code) return null;
  if (!REF_RE.test(code)) return "invalid";
  const { data: ref } = await supabase.from("referrals").select("owner_email").eq("code", code).maybeSingle();
  if (!ref) return "invalid";
  if (ref.owner_email === buyerEmail) return "self";
  // Pembeli baru di Presensi Guru: belum pernah punya lisensi Guru lain.
  const { count } = await supabase.from("licenses").select("id", { count: "exact", head: true })
    .eq("email", buyerEmail).eq("status", "digunakan").eq("product", PRODUCT);
  if ((count || 0) > 1) return "not_new";
  const [ownGuru, ownSiswa] = await Promise.all([activeLic(supabase, ref.owner_email, "guru"), activeLic(supabase, ref.owner_email, "siswa")]);
  if (!isPro(ownGuru) && !isPro(ownSiswa)) return "owner_not_pro";
  const [kC, kD, dC, dD] = GURU_REWARD_KEYS[buyerTier === "PLUS" ? "PLUS" : "PRO"];
  const { data: rows } = await supabase.from("app_settings").select("key, value").in("key", [kC, kD, "affiliate_cap_per_semester"]);
  const cfg = Object.fromEntries((rows || []).map((r) => [r.key, Number(r.value)]));
  const { data, error } = await supabase.rpc("affiliate_credit", {
    p_code: code, p_owner: ref.owner_email, p_buyer: buyerEmail, p_tier: buyerTier,
    p_days: Number.isFinite(cfg[kD]) ? cfg[kD] : dD,
    p_commission: Number.isFinite(cfg[kC]) ? cfg[kC] : dC,
    p_cap: Number.isFinite(cfg.affiliate_cap_per_semester) ? cfg.affiliate_cap_per_semester : 6,
    // Bonus hari ke lisensi Guru pemilik; kalau tidak punya, ke lisensi Siswa-nya.
    p_license_id: (ownGuru || ownSiswa)?.id ?? null,
    p_product: PRODUCT,
  });
  if (error) throw error;
  if (data === "ok") await creditBuyer(supabase, buyerEmail, code, buyerTier, Number.isFinite(cfg[kC]) ? cfg[kC] : dC);
  return data;
}

/** Bonus uang untuk pembeli yang memakai kode teman: setengah komisi pengajak, dibulatkan ke bawah ke Rp100. */
export const buyerShare = (commission) => Math.floor(Math.max(0, Number(commission) || 0) / 2 / 100) * 100;

// Dipanggil hanya setelah affiliate_credit = 'ok' (sekali per pembeli per produk), jadi tidak dobel.
// shortcut: bukan satu transaksi dengan affiliate_credit; kalau insert ini gagal, bonus pembeli dicatat manual oleh admin.
async function creditBuyer(supabase, buyerEmail, code, tier, commission) {
  const amount = buyerShare(commission);
  if (amount <= 0) return;
  await supabase.from("affiliate_ledger").insert({
    owner_email: buyerEmail, type: "earn", amount, status: "ok", buyer_email: buyerEmail, product: PRODUCT,
    note: `Bonus pembeli ${tier} ${PRODUCT} pakai kode ${code}`,
  });
}

// Dashboard, info & tarik dana dilayani server Presensi Siswa (satu saldo). Token sesi email sama (satu project Supabase).
const AFFILIATE_UPSTREAM = "https://presiswa.bantuguruyuk.web.id/api/license";
const PROXIED = new Set(["affiliate", "affiliate_info", "withdraw"]);
async function proxyAffiliate(req, res) {
  const r = await fetch(AFFILIATE_UPSTREAM, {
    method: "POST",
    headers: { "Content-Type": "application/json", ...(req.headers.authorization ? { Authorization: req.headers.authorization } : {}) },
    body: JSON.stringify(req.body || {}),
  });
  const data = await r.json().catch(() => ({}));
  return res.status(r.status).json(data);
}

async function renew(supabase, body) {
  const email = normEmail(body.email);
  const kode = normKode(body.kode);
  if (!email.includes("@")) return [400, { error: "Email tidak valid" }];
  if (kode.length < 8) return [400, { error: "Format kode: BGY-PG-XXXX" }];

  const { data: current } = await supabase
    .from("licenses")
    .select("id, tanggal_berakhir, tier")
    .eq("email", email)
    .eq("product", PRODUCT)
    .eq("status", "digunakan")
    .order("tanggal_berakhir", { ascending: false })
    .limit(1)
    .maybeSingle();

  const now = Date.now();
  const base = current?.tanggal_berakhir ? Math.max(now, current.tanggal_berakhir) : now;
  const newExpiry = base + SEMESTER_MS;

  if (current?.tier === "PRO" && current.tanggal_berakhir > now && /-PLUS-/.test(kode)) {
    return [409, { error: `Paket PRO masih aktif sampai ${new Date(current.tanggal_berakhir).toLocaleDateString("id-ID")}. Pakai kode PRO untuk memperpanjang.` }];
  }
  const tier = await claimKode(supabase, kode, { email, tanggal_aktivasi: now, tanggal_berakhir: newExpiry });
  if (!tier) return [409, { error: "Kode perpanjangan tidak valid atau sudah digunakan" }];

  if (current) await supabase.from("licenses").update({ tanggal_berakhir: newExpiry, tier }).eq("id", current.id);
  return [200, { ok: true, tanggalBerakhir: newExpiry, tier }];
}

// Cek lisensi aktif milik sebuah email (menggantikan query langsung ke tabel dari browser).
async function status(supabase, body) {
  const email = normEmail(body.email);
  if (!email.includes("@")) return [400, { error: "Email tidak valid" }];
  const { data, error } = await supabase
    .from("licenses")
    .select("tanggal_berakhir, tier")
    .eq("email", email)
    .eq("product", PRODUCT)
    .eq("status", "digunakan")
    .order("tanggal_berakhir", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error) throw error;
  return [200, { found: !!data, tanggalBerakhir: data?.tanggal_berakhir ?? null, tier: data ? data.tier || "PRO" : null }];
}

// Kode teman yang lupa diisi saat aktivasi: sekali, paling lambat 7 hari setelah aktivasi pertama.
// Kode lisensi jadi bukti pemilik email (tidak ada sesi login di layar ini).
async function pakaiRef(supabase, body) {
  const email = normEmail(body.email);
  const kode = normKode(body.kode);
  if (!email.includes("@") || kode.length < 8) return [400, { error: "Isi email dan kode lisensi yang dipakai aktivasi" }];
  const { data: lis } = await supabase.from("licenses").select("tier")
    .eq("kode", kode).eq("email", email).eq("product", PRODUCT).eq("status", "digunakan").maybeSingle();
  if (!lis) return [403, { error: "Email dan kode lisensi tidak cocok" }];
  const { data: pertama } = await supabase.from("licenses").select("tanggal_aktivasi")
    .eq("email", email).eq("product", PRODUCT).eq("status", "digunakan")
    .order("tanggal_aktivasi", { ascending: true }).limit(1).maybeSingle();
  if (!pertama?.tanggal_aktivasi || Date.now() - pertama.tanggal_aktivasi > 7 * 864e5) {
    return [409, { error: "Kode teman hanya bisa diisi sampai 7 hari setelah aktivasi pertama" }];
  }
  const { count } = await supabase.from("referral_rewards").select("buyer_email", { count: "exact", head: true })
    .eq("buyer_email", email).eq("product", PRODUCT);
  if ((count || 0) > 0) return [409, { error: "Kode teman sudah pernah dipakai" }];
  const referral = await applyReferral(supabase, body.ref, email, lis.tier || "PRO");
  return [200, { ok: true, referral }];
}

const ACTIONS = { activate, renew, status, pakai_ref: pakaiRef };

// Rate limit bersama semua instance (tabel rate_hits lewat fungsi DB rate_hit). Gagal cek = tidak membatasi.
async function rateLimited(supabase, key, max, windowS) {
  const { data, error } = await supabase.rpc("rate_hit", { p_key: key, p_max: max, p_window_s: windowS });
  return !error && data === true;
}
const clientIp = (req) => String(req.headers["x-forwarded-for"] || "").split(",")[0].trim() || "unknown";
const LIMITED_ACTIONS = new Set(["activate", "renew", "pakai_ref"]);

// Pengumuman aktif untuk Presensi Guru (tanpa login). Di-cache CDN 5 menit.
async function announcements(res) {
  const now = new Date().toISOString();
  const { data, error } = await getSupabase()
    .from("announcements")
    .select("id, title, body, target, level, link_url, link_label, starts_at")
    .eq("active", true)
    .in("product", ["guru", "all"])
    .lte("starts_at", now)
    .or(`ends_at.is.null,ends_at.gt.${now}`)
    .order("starts_at", { ascending: false })
    .limit(10);
  if (error) return res.status(500).json({ items: [] });
  res.setHeader("Vercel-CDN-Cache-Control", "max-age=300, stale-while-revalidate=60");
  return res.status(200).json({ items: data || [] });
}

export default async function handler(req, res) {
  if (req.method === "GET" && req.query?.action === "announcements") return announcements(res);
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });
  const { action } = req.body || {};
  res.setHeader("Cache-Control", "no-store");
  if (PROXIED.has(action)) {
    try { return await proxyAffiliate(req, res); } catch { return res.status(502).json({ error: "Layanan affiliate sedang tidak tersedia" }); }
  }
  const fn = ACTIONS[action];
  if (!fn) return res.status(400).json({ error: "Action tidak dikenal" });
  try {
    const supabase = getSupabase();
    if (LIMITED_ACTIONS.has(action) && (await rateLimited(supabase, `lic-guru:${clientIp(req)}`, 30, 600))) {
      return res.status(429).json({ error: "Terlalu banyak percobaan. Coba lagi 10 menit lagi." });
    }
    const [code, payload] = await fn(supabase, req.body);
    return res.status(code).json(payload);
  } catch {
    return res.status(500).json({ error: "Gagal memproses lisensi di server" });
  }
}
