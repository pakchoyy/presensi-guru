import { createClient } from "@supabase/supabase-js";
import { createHmac, timingSafeEqual } from "crypto";

// Link klaim dibuat toko Kreacy untuk pesanan yang sudah dibayar:
// ?t=<KLAIM_TOKEN_PLUS|KLAIM_TOKEN_PRO>&order=<id pesanan>&sig=<HMAC(id pesanan)>&sig2=<HMAC("v2:" + t + ":" + id pesanan)>.
// sig2 mengikat paket ke pesanan, jadi t tidak bisa ditukar (mis. ke token PRO atau dari link Siswa).
// Link lama (hanya sig) diterima untuk PLUS saja; link PRO lama yang belum diklaim dilayani admin lewat WhatsApp.
// Satu pesanan = satu kode (licenses.klaim_order unik); membuka link lagi menampilkan kode yang sama.
function getSupabaseAdmin() {
  const url = process.env.VITE_SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error("Missing Supabase env");
  return createClient(url, key);
}

function tierFromToken(t) {
  if (!t) return null;
  if (process.env.KLAIM_TOKEN_PLUS && t === process.env.KLAIM_TOKEN_PLUS) return "PLUS";
  if (process.env.KLAIM_TOKEN_PRO && t === process.env.KLAIM_TOKEN_PRO) return "PRO";
  return null;
}

export function validOrderSig(order, sig, secret, t) {
  if (!secret || !/^[A-Za-z0-9-]{1,64}$/.test(order) || !/^[0-9a-f]{64}$/.test(sig)) return false;
  const expected = createHmac("sha256", secret).update(t === undefined ? order : `v2:${t}:${order}`).digest();
  return timingSafeEqual(expected, Buffer.from(sig, "hex"));
}

/** Link sah kalau sig2 cocok dengan t+order, atau (link lama) sig cocok dengan order dan paketnya PLUS. */
export function validClaim(q, tier, secret) {
  const t = String(q.t || ""), order = String(q.order || "");
  if (validOrderSig(order, String(q.sig2 || ""), secret, t)) return true;
  return tier === "PLUS" && validOrderSig(order, String(q.sig || ""), secret);
}

export default async function handler(req, res) {
  if (req.method !== "GET") {
    return res.status(405).json({ error: "Method not allowed" });
  }
  res.setHeader("Cache-Control", "no-store");
  res.setHeader("X-Robots-Tag", "noindex");

  const tier = tierFromToken(String(req.query.t || ""));
  let kode = "";
  let error = "";

  const order = String(req.query.order || "");
  if (!tier || !validClaim(req.query, tier, process.env.KLAIM_HMAC_SECRET)) {
    error = "Link klaim tidak valid. Buka link dari halaman pesanan di toko, atau hubungi admin.";
  } else {
    try {
      const supabaseAdmin = getSupabaseAdmin();
      const byOrder = async () =>
        (await supabaseAdmin.from("licenses").select("kode").eq("klaim_order", order).maybeSingle()).data?.kode || "";
      kode = await byOrder();
      for (let i = 0; !kode && i < 3; i++) {
        let q = supabaseAdmin.from("licenses").select("id").eq("status", "tersedia").eq("product", "guru");
                q = tier === "PLUS" ? q.eq("tier", "PLUS") : q.eq("tier", "PRO");
        const { data: available, error: queryError } = await q.limit(1);
        if (queryError) throw queryError;
        if (!available || available.length === 0) break;
        const { data: claimed, error: claimError } = await supabaseAdmin
          .from("licenses")
          .update({ status: "terkirim", klaim_order: order })
          .eq("id", available[0].id)
          .eq("status", "tersedia")
          .select("kode");
        // 23505: pesanan yang sama sedang diklaim bersamaan; ambil kode milik pesanan itu.
        if (claimError?.code === "23505") kode = await byOrder();
        else if (claimError) throw claimError;
        else if (claimed && claimed.length) kode = claimed[0].kode;
      }
      if (!kode) error = "Stok kode habis. Hubungi admin via WhatsApp.";
    } catch (e) {
      error = "Gagal menghubungi server. Coba lagi nanti.";
    }
  }
  const paket = tier || "PRO";
  const aktivasiUrl = kode ? `https://preguru.bantuguruyuk.web.id/aktivasi?kode=${encodeURIComponent(kode)}` : "";

  const html = `<!DOCTYPE html>
<html lang="id">
<head>
<meta charset="UTF-8"/>
<meta name="viewport" content="width=device-width,initial-scale=1.0"/>
<title>Klaim Kode — Presensi Yuk</title>
<style>
*,*::before,*::after{box-sizing:border-box;margin:0;padding:0}
body{font-family:'Segoe UI',system-ui,sans-serif;background:linear-gradient(135deg,#0ea5a0,#0d7a8a,#2d6a7f);min-height:100vh;color:#fff;display:flex;flex-direction:column;align-items:center;justify-content:center;padding:20px}
.card{background:rgba(255,255,255,.12);border:2px solid rgba(255,255,255,.25);border-radius:20px;padding:40px 28px;text-align:center;max-width:420px;width:100%;backdrop-filter:blur(12px);box-shadow:0 8px 32px rgba(0,0,0,.15)}
.card h1{font-size:1.5rem;margin-bottom:10px;font-weight:800}
.card .emoji{font-size:4rem;margin-bottom:20px;animation:bounce 1s ease-in-out}
.card p{font-size:.9rem;opacity:.9;line-height:1.7;margin-bottom:20px}
.code-box{background:rgba(255,255,255,.2);border:2px solid rgba(255,255,255,.4);border-radius:14px;padding:20px;margin-bottom:20px;position:relative;overflow:hidden}
.code-box::before{content:'';position:absolute;top:0;left:0;right:0;height:3px;background:linear-gradient(90deg,#fde68a,#fbbf24,#fde68a);animation:shimmer 2s infinite}
.code-box .kode{font-size:1.8rem;font-weight:900;letter-spacing:4px;font-family:'Courier New',monospace;margin-bottom:12px;color:#fde68a;text-shadow:0 2px 8px rgba(0,0,0,.2)}
.btn{display:inline-flex;align-items:center;justify-content:center;gap:8px;padding:14px 28px;border-radius:12px;font-weight:700;font-size:.9rem;cursor:pointer;width:100%;border:none;font-family:inherit;transition:all .3s;box-shadow:0 4px 12px rgba(0,0,0,.15)}
.btn-copy{background:linear-gradient(135deg,#f59e0b,#d97706);color:#1e293b;margin-bottom:10px;position:relative;overflow:hidden}
.btn-copy:hover{transform:translateY(-2px);box-shadow:0 6px 16px rgba(245,158,11,.4)}
.btn-copy:active{transform:translateY(0)}
.btn-copy:disabled{opacity:.6;cursor:not-allowed}
.btn-app{background:rgba(255,255,255,.18);color:#fff;border:2px solid rgba(255,255,255,.3);margin-bottom:10px}
.btn-app:hover{background:rgba(255,255,255,.28);transform:translateY(-2px)}
.steps{text-align:left;font-size:.8rem;opacity:.9;line-height:1.9;margin-top:20px;padding:16px 18px;background:rgba(0,0,0,.15);border-radius:12px;border:1px solid rgba(255,255,255,.1)}
.steps b{color:#fde68a;font-weight:700}
.error-box{background:rgba(220,38,38,.25);border:2px solid rgba(220,38,38,.4);border-radius:14px;padding:24px;margin-bottom:20px}
.error-box .err{font-size:.95rem;font-weight:700;margin-bottom:10px}
.footer{margin-top:28px;font-size:.75rem;opacity:.7;text-align:center}
.footer a{color:#fde68a;text-decoration:none;font-weight:600}
.footer a:hover{text-decoration:underline}
@keyframes bounce{0%,100%{transform:scale(1)}50%{transform:scale(1.1)}}
@keyframes shimmer{0%{transform:translateX(-100%)}100%{transform:translateX(100%)}}
@media(max-width:400px){.card{padding:32px 20px}.code-box .kode{font-size:1.5rem;letter-spacing:3px}}
</style>
</head>
<body>
<div class="card">
  ${kode ? `
  <div class="emoji">🎉</div>
  <h1>Pembayaran Berhasil!</h1>
  <p>Lisensi ${paket} Presensi Yuk siap diaktivasi.</p>
  <div class="code-box">
    <div class="kode" id="kodeTeks">${kode}</div>
    <button class="btn btn-copy" onclick="copyKode(this)">📋 Salin Kode</button>
  </div>
  <button class="btn btn-app" onclick="window.location.href='${aktivasiUrl}'">📲 Aktifkan di Presensi Yuk</button>
  <div class="steps">
    <b>Cara aktivasi:</b><br/>
    1. 📲 Ketuk <b>Aktifkan di Presensi Yuk</b> (kode terisi otomatis)<br/>
    2. 📧 Masukkan <b>email</b> kamu<br/>
    3. ✅ <b>Aktivasi!</b> Lisensi aktif 1 semester (6 bulan)<br/>
    Simpan kode ini. Ganti HP cukup masukkan email yang sama.
  </div>
  ` : `
  <div class="emoji">😔</div>
  <h1>Oops!</h1>
  <div class="error-box">
    <div class="err">${error}</div>
  </div>
  <button class="btn btn-copy" onclick="window.open('https://wa.me/6289530713597?text=Halo%20Pak%20Choyy%2C%20stok%20kode%20PRO%20habis.%20Tolong%20diisi%20ulang.','_blank')">💬 Hubungi Admin</button>
  `}
</div>
<div class="footer">
  <a href="https://bantuguruyuk.web.id" target="_blank">Bantu Guru Yuk</a>
  &bull; <a href="https://preguru.bantuguruyuk.web.id" target="_blank">Presensi Yuk</a>
</div>
<script>
function copyKode(btn) {
  const kode = document.getElementById('kodeTeks').textContent;
  navigator.clipboard.writeText(kode).then(() => {
    const originalHTML = btn.innerHTML;
    btn.innerHTML = '✅ Tersalin!';
    btn.disabled = true;
    setTimeout(() => {
      btn.innerHTML = originalHTML;
      btn.disabled = false;
    }, 2000);
  }).catch(() => {
    alert('Gagal menyalin. Salin manual: ' + kode);
  });
}
</script>
</body>
</html>`;

  res.setHeader("Content-Type", "text/html; charset=utf-8");
  return res.status(200).send(html);
}
