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

function todayWIB() {
  return new Date(Date.now() + 7 * 60 * 60 * 1000).toISOString().slice(0, 10);
}
function hhmmssWIB() {
  const d = new Date(Date.now() + 7 * 60 * 60 * 1000);
  return d.toISOString().slice(11, 19);
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
    .select("local_id, user_id, sekolah_id, nama, nip, jabatan, absen_token, status_aktif")
    .eq("absen_token", token)
    .maybeSingle();
  if (!g || g.status_aktif === false) return null;
  return g;
}

async function getSekolahForUser(supabase, userId, sekolahLocalId) {
  // sekolah hidup di cloud_schools shared antara Siswa & Guru
  const { data } = await supabase
    .from("cloud_schools")
    .select("nama, lat, lng, radius_meter, jam_masuk_standar, jam_pulang_standar, toleransi_terlambat_menit")
    .eq("user_id", userId)
    .eq("local_id", sekolahLocalId)
    .maybeSingle();
  return data || null;
}

async function getAttendanceToday(supabase, userId, guruId, tanggal) {
  const { data } = await supabase
    .from("cloud_guru_attendance")
    .select("local_id, jam_masuk, jam_pulang, status_masuk, status_pulang, jarak_masuk_meter, jarak_pulang_meter, selfie_masuk_url, selfie_pulang_url")
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
  // Satu sekolah bisa satu IP (WiFi); batas longgar, cukup menahan tebak-tebak token.
  if (await rateLimited(supabase, `clockin:${clientIp(req)}`, 120, 600)) {
    return res.status(429).json({ error: "Terlalu banyak percobaan. Coba lagi beberapa menit lagi." });
  }

  if (req.method === "GET") {
    const token = String(req.query.token || "").trim();
    if (!token) return res.status(400).json({ error: "Token wajib" });

    const g = await findGuruByToken(supabase, token);
    if (!g) return res.status(404).json({ error: "Link tidak valid — token tidak ditemukan atau akun dihapus" });

    const sekolah = await getSekolahForUser(supabase, g.user_id, g.sekolah_id);
    const tanggal = todayWIB();
    const att = await getAttendanceToday(supabase, g.user_id, g.local_id, tanggal);

    return res.status(200).json({
      guru: { id: g.local_id, nama: g.nama, nip: g.nip, jabatan: g.jabatan },
      sekolah: sekolah ? {
        nama: sekolah.nama,
        lat: sekolah.lat,
        lng: sekolah.lng,
        radiusMeter: sekolah.radius_meter ?? 100,
        jamMasukStandar: sekolah.jam_masuk_standar ?? "07:00",
        jamPulangStandar: sekolah.jam_pulang_standar ?? "13:00",
        toleransiTerlambatMenit: sekolah.toleransi_terlambat_menit ?? 15,
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
    if (!token || !["in", "out"].includes(action) || !isFinite(lat) || !isFinite(lng)) {
      return res.status(400).json({ error: "Parameter tidak lengkap" });
    }

    const g = await findGuruByToken(supabase, token);
    if (!g) return res.status(404).json({ error: "Token tidak valid" });

    const sekolah = await getSekolahForUser(supabase, g.user_id, g.sekolah_id);
    const tanggal = todayWIB();
    const jam = hhmmssWIB();
    const radius = sekolah?.radius_meter ?? 100;
    const jamStandar = (action === "in" ? sekolah?.jam_masuk_standar : sekolah?.jam_pulang_standar) ?? (action === "in" ? "07:00" : "13:00");
    const toleransi = sekolah?.toleransi_terlambat_menit ?? 15;

    let jarakMeter = 0;
    if (sekolah?.lat != null && sekolah?.lng != null) {
      jarakMeter = Math.round(haversineMeters(lat, lng, sekolah.lat, sekolah.lng));
    }

    let status;
    if (sekolah?.lat != null && jarakMeter > radius) status = "FAR";
    else if (action === "in") {
      const cutoff = addMinutes(jamStandar, toleransi);
      status = jam.slice(0, 5) <= cutoff ? "ONTIME" : "LATE";
    } else {
      status = "ONTIME";
    }

    // Upload selfie bila ada
    let selfieUrl = null;
    const sel = files.selfie;
    if (sel && sel.data && sel.data.length > 0) {
      const path = `${g.user_id}/${g.local_id}/${tanggal}_${action}.jpg`;
      const { error: upErr } = await supabase.storage
        .from("teacher-selfies")
        .upload(path, sel.data, { contentType: sel.contentType || "image/jpeg", upsert: true });
      if (upErr) return res.status(500).json({ error: `Gagal upload selfie: ${upErr.message}` });
      const { data: pub } = supabase.storage.from("teacher-selfies").getPublicUrl(path);
      selfieUrl = pub?.publicUrl || path;
    }

    // Upsert record
    const existing = await getAttendanceToday(supabase, g.user_id, g.local_id, tanggal);
    const localId = existing?.local_id ?? Date.now() + Math.floor(Math.random() * 1000);
    const now = Date.now();
    const payload = {
      user_id: g.user_id,
      local_id: localId,
      guru_id: g.local_id,
      tanggal,
      ...(action === "in"
        ? {
            jam_masuk: jam,
            selfie_masuk_url: selfieUrl,
            lokasi_masuk_lat: lat,
            lokasi_masuk_lng: lng,
            jarak_masuk_meter: jarakMeter,
            status_masuk: status,
          }
        : {
            jam_pulang: jam,
            selfie_pulang_url: selfieUrl,
            lokasi_pulang_lat: lat,
            lokasi_pulang_lng: lng,
            jarak_pulang_meter: jarakMeter,
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
      status,
      jarakMeter,
      selfieUrl,
      action,
    });
  }

  return res.status(405).json({ error: "Method not allowed" });
}
