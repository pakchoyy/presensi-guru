import { createClient } from "@supabase/supabase-js";

export const config = {
  api: { bodyParser: false },
};

function getSupabase() {
  const url = process.env.VITE_SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error("Missing Supabase env");
  return createClient(url, key);
}

// Rate limit bersama semua instance (tabel rate_hits lewat fungsi DB rate_hit). Gagal cek = tidak membatasi.
async function rateLimited(supabase, key, max, windowS) {
  const { data, error } = await supabase.rpc("rate_hit", { p_key: key, p_max: max, p_window_s: windowS });
  return !error && data === true;
}
const clientIp = (req) => String(req.headers["x-forwarded-for"] || "").split(",")[0].trim() || "unknown";

// Waktu sekolah: zona dari setelan admin (menit dari UTC), default WIB.
function waktuSekolah(tzMenit) {
  const d = new Date(Date.now() + (tzMenit ?? 420) * 60 * 1000).toISOString();
  return { tanggal: d.slice(0, 10), jam: d.slice(11, 19) };
}
function toRad(d) { return (d * Math.PI) / 180; }
function haversineMeters(lat1, lng1, lat2, lng2) {
  const R = 6371000;
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);
  const a = Math.sin(dLat / 2) ** 2 + Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}
function addMinutes(hhmm, mins) {
  const [h, m] = hhmm.split(":").map(Number);
  const total = h * 60 + m + mins;
  const hh = Math.floor(total / 60) % 24;
  const mm = total % 60;
  return `${String(hh).padStart(2, "0")}:${String(mm).padStart(2, "0")}`;
}

async function findGuruByToken(supabase, token) {
  const { data: g } = await supabase
    .from("cloud_guru_teachers")
    .select("local_id, user_id, sekolah_uuid, nama, nip, jabatan, absen_token, status_aktif")
    .eq("absen_token", token)
    .maybeSingle();
  if (!g || g.status_aktif === false) return null;
  return g;
}

// Setelan & paket sekolah dari cloud_guru_sekolah milik guru ini (paket dihitung server, lihat 00312).
async function getSekolah(supabase, g) {
  const q = supabase
    .from("cloud_guru_sekolah")
    .select("id, nama, lat, lng, radius_meter, jam_masuk, jam_pulang, toleransi_menit, mulai_masuk, batas_pulang, hari_aktif, libur, paket, paket_sampai, tz_menit");
  const { data } = await (g.sekolah_uuid ? q.eq("id", g.sekolah_uuid) : q.eq("owner_user_id", g.user_id)).limit(1).maybeSingle();
  if (!data) return null;
  const { tanggal } = waktuSekolah(data.tz_menit);
  const hari = String(data.hari_aktif || "1,2,3,4,5,6").split(",").map(Number);
  return {
    ...data,
    // GPS/radius hanya untuk PRO & masa coba.
    gps: data.paket === "PRO" && (!data.paket_sampai || data.paket_sampai > Date.now()),
    hariKerja: hari.includes(new Date(`${tanggal}T00:00:00Z`).getUTCDay())
      && !String(data.libur || "").split(",").includes(tanggal),
    jamMasuk: data.jam_masuk || "07:00",
    jamPulang: data.jam_pulang || "15:00",
    toleransi: data.toleransi_menit ?? 15,
    radius: data.radius_meter ?? 100,
  };
}

async function getAttendanceToday(supabase, userId, guruId, tanggal) {
  const { data } = await supabase
    .from("cloud_guru_attendance")
    .select("local_id, sekolah_uuid, jam_masuk, jam_pulang, status_masuk, status_pulang, jarak_masuk_meter, jarak_pulang_meter, selfie_masuk_url, selfie_pulang_url")
    .eq("user_id", userId)
    .eq("guru_id", guruId)
    .eq("tanggal", tanggal)
    .maybeSingle();
  return data || null;
}

// Minimal multipart parser untuk Vercel Node runtime (tanpa dep tambahan)
async function readBody(req) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    req.on("data", (c) => chunks.push(c));
    req.on("end", () => resolve(Buffer.concat(chunks)));
    req.on("error", reject);
  });
}

function parseMultipart(buffer, boundary) {
  const result = { fields: {}, files: {} };
  const sep = Buffer.from(`--${boundary}`);
  const parts = [];
  let start = 0;
  while (true) {
    const idx = buffer.indexOf(sep, start);
    if (idx === -1) break;
    if (start !== idx) parts.push(buffer.slice(start, idx));
    start = idx + sep.length;
  }
  for (const part of parts) {
    if (part.length < 4) continue;
    // Trim leading \r\n and trailing \r\n
    let p = part;
    if (p[0] === 0x0d && p[1] === 0x0a) p = p.slice(2);
    if (p[p.length - 2] === 0x0d && p[p.length - 1] === 0x0a) p = p.slice(0, -2);
    const headerEnd = p.indexOf(Buffer.from("\r\n\r\n"));
    if (headerEnd === -1) continue;
    const header = p.slice(0, headerEnd).toString("utf8");
    const body = p.slice(headerEnd + 4);
    const nameMatch = /name="([^"]+)"/.exec(header);
    if (!nameMatch) continue;
    const name = nameMatch[1];
    const filenameMatch = /filename="([^"]+)"/.exec(header);
    if (filenameMatch) {
      const ctMatch = /Content-Type:\s*(\S+)/i.exec(header);
      result.files[name] = {
        filename: filenameMatch[1],
        contentType: ctMatch ? ctMatch[1] : "application/octet-stream",
        data: body,
      };
    } else {
      // strip trailing CRLF before boundary
      let text = body;
      if (text[text.length - 2] === 0x0d && text[text.length - 1] === 0x0a) text = text.slice(0, -2);
      result.fields[name] = text.toString("utf8");
    }
  }
  return result;
}

export default async function handler(req, res) {
  // Hanya situs sendiri yang boleh memanggil dari browser.
  const origin = req.headers.origin;
  if (origin && origin !== "https://preguru.bantuguruyuk.web.id" && !/^https:\/\/[a-z0-9-]+\.vercel\.app$/.test(origin) && !/^http:\/\/localhost(:\d+)?$/.test(origin)) {
    return res.status(403).json({ error: "Origin tidak diizinkan" });
  }
  if (origin) res.setHeader("Access-Control-Allow-Origin", origin);
  res.setHeader("Vary", "Origin");
  res.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");
  if (req.method === "OPTIONS") return res.status(200).end();

  const supabase = getSupabase();
  // Satu sekolah sering satu IP (WiFi), jadi batas IP longgar; batas ketat per token.
  if (await rateLimited(supabase, `clockin:${clientIp(req)}`, 600, 600)) {
    return res.status(429).json({ error: "Terlalu banyak percobaan. Coba lagi beberapa menit lagi." });
  }

  if (req.method === "GET") {
    const token = String(req.query.token || "").trim();
    if (!token) return res.status(400).json({ error: "Token wajib" });
    if (await rateLimited(supabase, `clockin-t:${token}`, 30, 600)) {
      return res.status(429).json({ error: "Terlalu banyak percobaan. Coba lagi beberapa menit lagi." });
    }

    const g = await findGuruByToken(supabase, token);
    if (!g) return res.status(404).json({ error: "Link tidak valid. Token tidak ditemukan atau akun dihapus" });

    const sekolah = await getSekolah(supabase, g);
    const { tanggal } = waktuSekolah(sekolah?.tz_menit);
    const att = await getAttendanceToday(supabase, g.user_id, g.local_id, tanggal);

    return res.status(200).json({
      gps: sekolah ? sekolah.gps : false,
      hariKerja: sekolah ? sekolah.hariKerja : false,
      guru: { id: g.local_id, nama: g.nama, nip: g.nip, jabatan: g.jabatan },
      sekolah: sekolah ? {
        nama: sekolah.nama,
        lat: sekolah.lat,
        lng: sekolah.lng,
        radiusMeter: sekolah.radius,
        jamMasukStandar: sekolah.jamMasuk,
        jamPulangStandar: sekolah.jamPulang,
        toleransiTerlambatMenit: sekolah.toleransi,
      } : { nama: "Sekolah" },
      tanggal,
      existing: att ? {
        jamMasuk: att.jam_masuk,
        jamPulang: att.jam_pulang,
        statusMasuk: att.status_masuk,
        statusPulang: att.status_pulang,
        jarakMasukMeter: att.jarak_masuk_meter,
        jarakPulangMeter: att.jarak_pulang_meter,
        selfieMasukUrl: att.selfie_masuk_url,
        selfiePulangUrl: att.selfie_pulang_url,
      } : null,
    });
  }

  if (req.method === "POST") {
    const ct = req.headers["content-type"] || "";
    if (!ct.startsWith("multipart/form-data")) {
      return res.status(400).json({ error: "Expected multipart/form-data" });
    }
    const boundary = ct.split("boundary=")[1];
    if (!boundary) return res.status(400).json({ error: "Missing boundary" });

    const raw = await readBody(req);
    const { fields, files } = parseMultipart(raw, boundary);
    const token = String(fields.token || "").trim();
    const action = String(fields.action || "").trim(); // "in" | "out"
    const lat = parseFloat(String(fields.lat));
    const lng = parseFloat(String(fields.lng));
    if (!token || !["in", "out"].includes(action)) {
      return res.status(400).json({ error: "Parameter tidak lengkap" });
    }
    if (await rateLimited(supabase, `clockin-t:${token}`, 30, 600)) {
      return res.status(429).json({ error: "Terlalu banyak percobaan. Coba lagi beberapa menit lagi." });
    }

    const g = await findGuruByToken(supabase, token);
    if (!g) return res.status(404).json({ error: "Token tidak valid" });
    const sekolah = await getSekolah(supabase, g);
    if (!sekolah) return res.status(400).json({ error: "Sekolah belum terhubung ke cloud" });
    const { gps, hariKerja, radius, jamMasuk, jamPulang, toleransi } = sekolah;
    if (gps && (!isFinite(lat) || !isFinite(lng))) return res.status(400).json({ error: "Lokasi wajib diisi" });
    if (!hariKerja) return res.status(400).json({ error: "Hari ini libur, presensi tidak dibuka" });

    const { tanggal, jam } = waktuSekolah(sekolah.tz_menit);
    const hhmm = jam.slice(0, 5);
    const existing = await getAttendanceToday(supabase, g.user_id, g.local_id, tanggal);

    // Jendela & urutan sama dengan aplikasi (jendelaPresensi): masuk boleh diulang sebelum pulang.
    if (action === "in") {
      const mulai = sekolah.mulai_masuk || addMinutes(jamMasuk, -60);
      if (hhmm < mulai) return res.status(400).json({ error: `Presensi masuk baru dibuka jam ${mulai}` });
      if (existing?.jam_pulang) return res.status(400).json({ error: "Sudah presensi pulang hari ini" });
    } else {
      const batas = sekolah.batas_pulang || addMinutes(jamPulang, 180);
      if (hhmm > batas) return res.status(400).json({ error: `Presensi pulang sudah ditutup jam ${batas}` });
      if (!existing?.jam_masuk) return res.status(400).json({ error: "Belum presensi masuk hari ini" });
    }

    let jarakMeter = 0;
    if (gps && sekolah.lat != null && sekolah.lng != null) {
      jarakMeter = Math.round(haversineMeters(lat, lng, sekolah.lat, sekolah.lng));
    }

    let status;
    if (gps && sekolah.lat != null && jarakMeter > radius) status = "FAR";
    else if (action === "in") status = hhmm <= addMinutes(jamMasuk, toleransi) ? "ONTIME" : "LATE";
    else status = hhmm < jamPulang ? "LATE" : "ONTIME"; // LATE untuk pulang = pulang cepat (EARLY)

    // Selfie ke bucket privat `selfie-guru`, path <sekolah_uuid>/<user_id>/… (dibaca admin, dihapus setelah 7 hari).
    let selfieUrl = null;
    const sel = files.selfie;
    if (sel && sel.data && sel.data.length > 0) {
      const path = `${sekolah.id}/${g.user_id}/${tanggal}-${action === "in" ? "masuk" : "pulang"}-g${g.local_id}.jpg`;
      const { error: upErr } = await supabase.storage
        .from("selfie-guru")
        .upload(path, sel.data, { contentType: "image/jpeg", upsert: true });
      if (upErr) return res.status(500).json({ error: `Gagal upload selfie: ${upErr.message}` });
      selfieUrl = path;
    }

    const localId = existing?.local_id ?? Date.now() + Math.floor(Math.random() * 1000);
    const now = Date.now();
    const payload = {
      user_id: g.user_id,
      sekolah_uuid: sekolah.id,
      local_id: localId,
      guru_id: g.local_id,
      tanggal,
      ...(action === "in"
        ? {
            jam_masuk: jam,
            selfie_masuk_url: selfieUrl,
            lokasi_masuk_lat: gps ? lat : null,
            lokasi_masuk_lng: gps ? lng : null,
            jarak_masuk_meter: gps ? jarakMeter : null,
            status_masuk: status,
          }
        : {
            jam_pulang: jam,
            selfie_pulang_url: selfieUrl,
            lokasi_pulang_lat: gps ? lat : null,
            lokasi_pulang_lng: gps ? lng : null,
            jarak_pulang_meter: gps ? jarakMeter : null,
            status_pulang: status,
          }),
      diubah_pada: now,
      last_synced_at: now,
      version: 1,
    };

    if (existing) {
      const { error: upErr } = await supabase
        .from("cloud_guru_attendance")
        .update(payload)
        .eq("user_id", g.user_id)
        .eq("local_id", existing.local_id);
      if (upErr) return res.status(500).json({ error: upErr.message });
    } else {
      const { error: insErr } = await supabase.from("cloud_guru_attendance").insert(payload);
      if (insErr) return res.status(500).json({ error: insErr.message });
    }

    return res.status(200).json({
      ok: true,
      tanggal,
      jam,
      status: status === "LATE" && action === "out" ? "EARLY" : status,
      jarakMeter,
      selfieUrl,
      action,
    });
  }

  return res.status(405).json({ error: "Method not allowed" });
}
