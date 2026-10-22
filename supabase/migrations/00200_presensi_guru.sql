-- =========================================================================
--  Presensi Guru (PresGuru) — migrasi awal, dijalankan di Supabase project
--  yang SAMA dengan Presensi Siswa (shared profiles/licenses/schools).
-- =========================================================================

-- 1) Kolom "product" di licenses supaya kode PRO terpisah per produk ---------
ALTER TABLE licenses
  ADD COLUMN IF NOT EXISTS product TEXT NOT NULL DEFAULT 'siswa';

-- Backfill license existing dianggap milik produk "siswa"
UPDATE licenses SET product = 'siswa' WHERE product IS NULL;

-- Validasi value
ALTER TABLE licenses
  DROP CONSTRAINT IF EXISTS licenses_product_check;
ALTER TABLE licenses
  ADD CONSTRAINT licenses_product_check CHECK (product IN ('siswa','guru'));

CREATE INDEX IF NOT EXISTS idx_licenses_email_product
  ON licenses (lower(email), product);

-- 2) Tambahan kolom geofence + jam di cloud_schools --------------------------
-- (Nama kolom camelCase di DB tetap snake_case; schema sudah ada di cloud_schools)
ALTER TABLE cloud_schools
  ADD COLUMN IF NOT EXISTS lat DOUBLE PRECISION,
  ADD COLUMN IF NOT EXISTS lng DOUBLE PRECISION,
  ADD COLUMN IF NOT EXISTS radius_meter INTEGER DEFAULT 100,
  ADD COLUMN IF NOT EXISTS jam_masuk_standar TEXT DEFAULT '07:00',
  ADD COLUMN IF NOT EXISTS jam_pulang_standar TEXT DEFAULT '13:00',
  ADD COLUMN IF NOT EXISTS toleransi_terlambat_menit INTEGER DEFAULT 15;

-- 3) Table: cloud_guru_teachers (daftar guru per sekolah) ------------------
CREATE TABLE IF NOT EXISTS cloud_guru_teachers (
  id              BIGSERIAL PRIMARY KEY,
  user_id         UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  local_id        BIGINT NOT NULL,
  sekolah_id      BIGINT NOT NULL,
  nama            TEXT NOT NULL,
  email           TEXT DEFAULT '',
  tier            TEXT NOT NULL DEFAULT 'FREE',
  nip             TEXT,
  jabatan         TEXT,
  role            TEXT NOT NULL DEFAULT 'guru' CHECK (role IN ('admin','guru')),
  absen_token     TEXT UNIQUE,
  status_aktif    BOOLEAN NOT NULL DEFAULT true,
  dibuat_pada     BIGINT NOT NULL,
  diubah_pada     BIGINT NOT NULL,
  last_synced_at  BIGINT NOT NULL,
  version         INTEGER NOT NULL DEFAULT 1,
  UNIQUE (user_id, local_id)
);
CREATE INDEX IF NOT EXISTS idx_cgt_user ON cloud_guru_teachers(user_id);
CREATE INDEX IF NOT EXISTS idx_cgt_token ON cloud_guru_teachers(absen_token);

ALTER TABLE cloud_guru_teachers ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS cgt_select_own ON cloud_guru_teachers;
CREATE POLICY cgt_select_own ON cloud_guru_teachers
  FOR SELECT USING (user_id = auth.uid());
DROP POLICY IF EXISTS cgt_insert_own ON cloud_guru_teachers;
CREATE POLICY cgt_insert_own ON cloud_guru_teachers
  FOR INSERT WITH CHECK (user_id = auth.uid());
DROP POLICY IF EXISTS cgt_update_own ON cloud_guru_teachers;
CREATE POLICY cgt_update_own ON cloud_guru_teachers
  FOR UPDATE USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());
DROP POLICY IF EXISTS cgt_delete_own ON cloud_guru_teachers;
CREATE POLICY cgt_delete_own ON cloud_guru_teachers
  FOR DELETE USING (user_id = auth.uid());

-- 4) Table: cloud_guru_attendance (clock-in/out harian) --------------------
CREATE TABLE IF NOT EXISTS cloud_guru_attendance (
  id                   BIGSERIAL PRIMARY KEY,
  user_id              UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  local_id             BIGINT NOT NULL,
  guru_id              BIGINT NOT NULL,
  tanggal              DATE NOT NULL,
  jam_masuk            TIME,
  jam_pulang           TIME,
  selfie_masuk_url     TEXT,
  selfie_pulang_url    TEXT,
  lokasi_masuk_lat     DOUBLE PRECISION,
  lokasi_masuk_lng     DOUBLE PRECISION,
  lokasi_pulang_lat    DOUBLE PRECISION,
  lokasi_pulang_lng    DOUBLE PRECISION,
  jarak_masuk_meter    INTEGER,
  jarak_pulang_meter   INTEGER,
  status_masuk         TEXT CHECK (status_masuk IN ('ONTIME','LATE','FAR')),
  status_pulang        TEXT CHECK (status_pulang IN ('ONTIME','LATE','FAR')),
  status_hari          TEXT CHECK (status_hari IN ('H','S','I','A','T')),
  catatan              TEXT,
  diubah_pada          BIGINT NOT NULL,
  last_synced_at       BIGINT NOT NULL,
  version              INTEGER NOT NULL DEFAULT 1,
  UNIQUE (user_id, local_id),
  UNIQUE (user_id, guru_id, tanggal)
);
CREATE INDEX IF NOT EXISTS idx_cga_user_tanggal ON cloud_guru_attendance(user_id, tanggal);
CREATE INDEX IF NOT EXISTS idx_cga_guru_tanggal ON cloud_guru_attendance(guru_id, tanggal);

ALTER TABLE cloud_guru_attendance ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS cga_select_own ON cloud_guru_attendance;
CREATE POLICY cga_select_own ON cloud_guru_attendance
  FOR SELECT USING (user_id = auth.uid());
DROP POLICY IF EXISTS cga_insert_own ON cloud_guru_attendance;
CREATE POLICY cga_insert_own ON cloud_guru_attendance
  FOR INSERT WITH CHECK (user_id = auth.uid());
DROP POLICY IF EXISTS cga_update_own ON cloud_guru_attendance;
CREATE POLICY cga_update_own ON cloud_guru_attendance
  FOR UPDATE USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());
DROP POLICY IF EXISTS cga_delete_own ON cloud_guru_attendance;
CREATE POLICY cga_delete_own ON cloud_guru_attendance
  FOR DELETE USING (user_id = auth.uid());

-- =========================================================================
-- 5) Storage bucket "teacher-selfies" — JALANKAN MANUAL via dashboard
--    (SQL berikut hanya reminder; eksekusi dari Supabase Studio → Storage)
-- =========================================================================
--
--  Buat bucket "teacher-selfies" sebagai PRIVATE.
--  Policy:
--    - INSERT via service_role (dilakukan oleh /api/clockin.js) — otomatis
--      dibolehkan karena service_role bypass RLS.
--    - SELECT boleh untuk service_role (idem). Untuk client-side read,
--      gunakan signed URL yang di-generate dari api.
--
--  Alternatif: bikin bucket PUBLIC jika guru/admin boleh akses foto langsung,
--  dan API cukup return public URL.
-- =========================================================================
