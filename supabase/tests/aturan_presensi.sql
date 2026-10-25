-- Uji aturan presensi di database (00312). Jalankan utuh; semua dibatalkan (ROLLBACK).
-- Gagal = muncul error "GAGAL: ...".
BEGIN;

-- Data uji: admin (pemilik sekolah), guru, Kepala Sekolah.
INSERT INTO auth.users (id, email) VALUES
  ('00000000-0000-4000-8000-0000000000a1', 'uji-admin@contoh.local'),
  ('00000000-0000-4000-8000-0000000000b2', 'uji-guru@contoh.local'),
  ('00000000-0000-4000-8000-0000000000c3', 'uji-ks@contoh.local');
INSERT INTO cloud_guru_sekolah (id, owner_user_id, local_id, nama, lat, lng, radius_meter, jam_masuk, jam_pulang,
  toleransi_menit, hari_aktif, mulai_masuk, batas_pulang, tz_menit, paket, paket_sampai)
VALUES ('00000000-0000-4000-8000-0000000000d4', '00000000-0000-4000-8000-0000000000a1', 1, 'SD Uji', -7.5, 112.5, 100,
  '23:59', '00:00', 0, '0,1,2,3,4,5,6', '00:00', '23:59', 420, 'PRO', 4102444800000);
INSERT INTO cloud_guru_teachers (user_id, local_id, sekolah_id, nama, email, tier, role, absen_token, status_aktif,
  dibuat_pada, diubah_pada, last_synced_at, sekolah_uuid, verifikator)
VALUES
  ('00000000-0000-4000-8000-0000000000b2', 2, 1, 'Guru Uji', 'uji-guru@contoh.local', 'FREE', 'guru', 'tok-uji-guru', true, 0, 0, 0, '00000000-0000-4000-8000-0000000000d4', false),
  ('00000000-0000-4000-8000-0000000000c3', 3, 1, 'KS Uji', 'uji-ks@contoh.local', 'FREE', 'guru', 'tok-uji-ks', true, 0, 0, 0, '00000000-0000-4000-8000-0000000000d4', true);

-- Temuan 3: paket sekolah tidak ikut nilai kiriman (sekolah tanpa lisensi = masa coba 30 hari).
DO $$ BEGIN
  IF (SELECT paket_sampai FROM cloud_guru_sekolah WHERE nama = 'SD Uji') = 4102444800000 THEN
    RAISE EXCEPTION 'GAGAL: paket_sampai dari klien diterima';
  END IF;
END $$;

-- Temuan 1: guru memalsukan jam/lokasi/status.
SET LOCAL ROLE authenticated;
SELECT set_config('request.jwt.claims', '{"sub":"00000000-0000-4000-8000-0000000000b2","role":"authenticated"}', true);
INSERT INTO cloud_guru_attendance (user_id, sekolah_uuid, local_id, guru_id, tanggal, jam_masuk, status_masuk,
  lokasi_masuk_lat, lokasi_masuk_lng, jarak_masuk_meter, verifikasi_masuk, diubah_pada)
VALUES ('00000000-0000-4000-8000-0000000000b2', '00000000-0000-4000-8000-0000000000d4', 1, 2,
  ((now() AT TIME ZONE 'UTC') + interval '7 hours')::date, '06:55', 'ONTIME', 0, 0, 0, true, 1);
DO $$ DECLARE r record; BEGIN
  SELECT * INTO r FROM cloud_guru_attendance WHERE user_id = '00000000-0000-4000-8000-0000000000b2';
  IF r.jam_masuk = '06:55' THEN RAISE EXCEPTION 'GAGAL: jam masuk dari HP diterima'; END IF;
  IF r.jarak_masuk_meter = 0 OR r.status_masuk <> 'FAR' THEN RAISE EXCEPTION 'GAGAL: jarak/status palsu diterima (%/%)', r.jarak_masuk_meter, r.status_masuk; END IF;
END $$;
UPDATE cloud_guru_attendance SET status_masuk = 'ONTIME', jarak_masuk_meter = 0, lokasi_masuk_lat = -7.5,
  lokasi_masuk_lng = 112.5, status_izin = 'disetujui', status_hari = 'H'
 WHERE user_id = '00000000-0000-4000-8000-0000000000b2';
DO $$ DECLARE r record; BEGIN
  SELECT * INTO r FROM cloud_guru_attendance WHERE user_id = '00000000-0000-4000-8000-0000000000b2';
  IF r.status_masuk <> 'FAR' OR r.lokasi_masuk_lat <> 0 THEN RAISE EXCEPTION 'GAGAL: bukti bisa diubah guru'; END IF;
  IF r.status_izin = 'disetujui' OR r.status_hari = 'H' THEN RAISE EXCEPTION 'GAGAL: guru memutus izin/status sendiri'; END IF;
END $$;

-- Temuan 4: admin (pemilik sekolah, bukan KS) mengubah status / menyetujui izin guru.
SELECT set_config('request.jwt.claims', '{"sub":"00000000-0000-4000-8000-0000000000a1","role":"authenticated"}', true);
UPDATE cloud_guru_attendance SET status_masuk = 'ONTIME', status_izin = 'disetujui', status_hari = 'H', jam_masuk = '07:00'
 WHERE user_id = '00000000-0000-4000-8000-0000000000b2';
DO $$ DECLARE r record; BEGIN
  SELECT * INTO r FROM cloud_guru_attendance WHERE user_id = '00000000-0000-4000-8000-0000000000b2';
  IF r.status_masuk <> 'FAR' OR r.status_izin = 'disetujui' OR r.status_hari = 'H' OR r.jam_masuk = '07:00' THEN
    RAISE EXCEPTION 'GAGAL: admin bisa mengubah presensi guru';
  END IF;
END $$;

-- Temuan 8: Kepala Sekolah membuat presensi guru lain dengan bukti karangan.
SET LOCAL ROLE authenticated;
SELECT set_config('request.jwt.claims', '{"sub":"00000000-0000-4000-8000-0000000000c3","role":"authenticated"}', true);
INSERT INTO cloud_guru_attendance (user_id, sekolah_uuid, local_id, guru_id, tanggal, jam_masuk, status_masuk, status_hari,
  selfie_masuk_url, lokasi_masuk_lat, lokasi_masuk_lng, jarak_masuk_meter, verifikasi_masuk, diubah_pada)
VALUES ('00000000-0000-4000-8000-0000000000b2', '00000000-0000-4000-8000-0000000000d4', 9, 2, '2026-01-05', '07:00',
  'ONTIME', 'H', 'palsu.jpg', -7.5, 112.5, 0, true, 1);
DO $$ DECLARE r record; BEGIN
  SELECT * INTO r FROM cloud_guru_attendance WHERE user_id = '00000000-0000-4000-8000-0000000000b2' AND tanggal = '2026-01-05';
  IF r.selfie_masuk_url IS NOT NULL OR r.lokasi_masuk_lat IS NOT NULL OR r.verifikasi_masuk IS NOT NULL THEN
    RAISE EXCEPTION 'GAGAL: KS bisa mengarang bukti';
  END IF;
  IF r.status_hari <> 'H' THEN RAISE EXCEPTION 'GAGAL: koreksi status KS ditolak'; END IF;
END $$;

SELECT 'SEMUA LOLOS' AS hasil;
ROLLBACK;
