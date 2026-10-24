import { createClient } from "@supabase/supabase-js";

// Kirim kode masuk (OTP) lewat Resend, bukan SMTP bawaan Supabase.
// Kode diambil dari generateLink (service role); klien memverifikasi dengan supabase.auth.verifyOtp.
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function getSupabase() {
  const url = process.env.VITE_SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error("Missing Supabase env");
  return createClient(url, key, { auth: { persistSession: false } });
}

// Rate limit bersama semua instance (fungsi DB rate_hit): 1x/60 dtk & 5x/jam per email, 20x/jam per IP.
async function limited(supabase, key, max, windowS) {
  const { data, error } = await supabase.rpc("rate_hit", { p_key: key, p_max: max, p_window_s: windowS });
  return !error && data === true;
}

async function generateCode(supabase, email) {
  let { data, error } = await supabase.auth.admin.generateLink({ type: "magiclink", email });
  if (error) {
    // User belum ada → buat dulu (email dianggap terkonfirmasi setelah kode diverifikasi).
    await supabase.auth.admin.createUser({ email, email_confirm: true });
    ({ data, error } = await supabase.auth.admin.generateLink({ type: "magiclink", email }));
  }
  if (error) throw error;
  return data?.properties?.email_otp;
}

const html = (code) => `<!doctype html><html><body style="font-family:Arial,sans-serif;background:#f1f5f9;padding:24px">
<div style="max-width:420px;margin:auto;background:#fff;border-radius:14px;padding:24px;text-align:center">
<div style="font-size:18px;font-weight:700;color:#2563eb"><i>Presensi Yuk</i> | Guru</div>
<p style="color:#334155;font-size:14px">Kode masuk kamu:</p>
<div style="font-size:34px;font-weight:800;letter-spacing:8px;color:#0f172a;margin:12px 0">${code}</div>
<p style="color:#64748b;font-size:12px">Masukkan kode ini di aplikasi. Berlaku sekitar 1 jam.<br>Kalau kamu tidak meminta kode ini, abaikan email ini.</p>
</div></body></html>`;

const ALLOWED = (o) => o === "https://preguru.bantuguruyuk.web.id" || /^https:\/\/[a-z0-9-]+\.vercel\.app$/.test(o) || /^http:\/\/localhost(:\d+)?$/.test(o);

export default async function handler(req, res) {
  res.setHeader("Cache-Control", "no-store");
  const origin = req.headers.origin;
  if (origin && !ALLOWED(origin)) return res.status(403).json({ error: "Origin tidak diizinkan" });
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });
  const body = req.body || {};
  if (body.action !== "send") return res.status(400).json({ error: "Action tidak dikenal" });

  const email = String(body.email || "").toLowerCase().trim().slice(0, 254);
  if (!EMAIL_RE.test(email)) return res.status(400).json({ error: "Email tidak valid." });

  const ip = String(req.headers["x-forwarded-for"] || "").split(",")[0].trim() || "unknown";
  const supabase = getSupabase();
  if ((await limited(supabase, "otp-ip:" + ip, 20, 3600)) || (await limited(supabase, "otp-h:" + email, 5, 3600))) {
    return res.status(429).json({ error: "Terlalu sering minta kode. Coba lagi nanti." });
  }
  if (await limited(supabase, "otp-m:" + email, 1, 60)) {
    return res.status(429).json({ error: "Tunggu 1 menit sebelum minta kode lagi." });
  }

  try {
    const code = await generateCode(supabase, email);
    if (!code) throw new Error("No OTP generated");
    const r = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${process.env.RESEND_API_KEY}` },
      body: JSON.stringify({
        from: process.env.OTP_FROM_EMAIL || "Presensi Yuk <noreply@kreacy.my.id>",
        to: [email],
        subject: `Kode masuk Presensi Yuk | Guru: ${code}`,
        html: html(code),
        text: `Kode masuk Presensi Yuk: ${code}\nMasukkan kode ini di aplikasi. Abaikan jika kamu tidak memintanya.`,
      }),
    });
    if (!r.ok) {
      console.error("resend error:", r.status, await r.text().catch(() => ""));
      return res.status(502).json({ error: "Gagal mengirim email. Coba lagi sebentar lagi." });
    }
    return res.status(200).json({ ok: true });
  } catch (e) {
    console.error("otp error:", e);
    return res.status(500).json({ error: "Gagal membuat kode. Coba lagi." });
  }
}
