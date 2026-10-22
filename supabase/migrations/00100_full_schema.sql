-- ============================================
-- FULL SUPABASE SCHEMA + IMPORT PREP
-- Copy-paste seluruh isi file ini ke Supabase SQL Editor → Run
-- ============================================

BEGIN;

-- ============================================
-- PROFILES (standalone, no FK to auth.users)
-- ============================================
CREATE TABLE IF NOT EXISTS public.profiles (
  id UUID PRIMARY KEY,
  email TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  tier TEXT NOT NULL DEFAULT 'FREE' CHECK (tier IN ('FREE', 'PRO')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Trigger: UPSERT on new auth signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $func$
BEGIN
  INSERT INTO public.profiles (id, email, name, tier)
  VALUES (
    NEW.id,
    COALESCE(NEW.email, NEW.raw_user_meta_data->>'email', ''),
    COALESCE(NEW.raw_user_meta_data->>'name', split_part(NEW.email, '@', 1)),
    COALESCE(NEW.raw_user_meta_data->>'tier', 'FREE')
  )
  ON CONFLICT (email) DO UPDATE SET
    id = EXCLUDED.id,
    name = CASE WHEN EXCLUDED.name <> '' THEN EXCLUDED.name ELSE public.profiles.name END,
    tier = CASE WHEN public.profiles.tier = 'FREE' AND EXCLUDED.tier = 'PRO' THEN 'PRO' ELSE public.profiles.tier END,
    updated_at = now();
  RETURN NEW;
END;
$func$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- ============================================
-- LOCAL TABLES
-- ============================================

CREATE TABLE IF NOT EXISTS public.schools (
  id BIGINT PRIMARY KEY,
  nama TEXT NOT NULL,
  jenjang TEXT NOT NULL,
  logo_url TEXT,
  alamat TEXT,
  dibuat_pada BIGINT NOT NULL DEFAULT 0,
  diubah_pada BIGINT NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS public.teachers (
  id BIGINT PRIMARY KEY,
  user_id UUID,
  nama TEXT NOT NULL,
  email TEXT NOT NULL,
  sekolah_id BIGINT NOT NULL DEFAULT 0,
  tier TEXT NOT NULL DEFAULT 'FREE',
  dibuat_pada BIGINT NOT NULL DEFAULT 0,
  diubah_pada BIGINT NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS public.academic_years (
  id BIGINT PRIMARY KEY,
  guru_id BIGINT NOT NULL,
  label TEXT NOT NULL,
  tanggal_mulai TEXT NOT NULL,
  tanggal_selesai TEXT NOT NULL,
  semester_aktif TEXT NOT NULL,
  dibuat_pada BIGINT NOT NULL DEFAULT 0,
  diubah_pada BIGINT NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS public.classrooms (
  id BIGINT PRIMARY KEY,
  tahun_ajaran_id BIGINT NOT NULL,
  guru_id BIGINT NOT NULL,
  nama TEXT NOT NULL,
  status_aktif BOOLEAN NOT NULL DEFAULT true,
  dibuat_pada BIGINT NOT NULL DEFAULT 0,
  diubah_pada BIGINT NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS public.students (
  id BIGINT PRIMARY KEY,
  kelas_id BIGINT NOT NULL,
  nama TEXT NOT NULL,
  nisn TEXT,
  jenis_kelamin TEXT,
  urutan INTEGER NOT NULL DEFAULT 0,
  status_aktif BOOLEAN NOT NULL DEFAULT true,
  dibuat_pada BIGINT NOT NULL DEFAULT 0,
  diubah_pada BIGINT NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS public.attendance_sessions (
  id BIGINT PRIMARY KEY,
  kelas_id BIGINT NOT NULL,
  tanggal TEXT NOT NULL,
  dibuat_pada BIGINT NOT NULL DEFAULT 0,
  diubah_pada BIGINT NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS public.attendance_records (
  id BIGINT PRIMARY KEY,
  sesi_id BIGINT NOT NULL,
  siswa_id BIGINT NOT NULL,
  status TEXT NOT NULL,
  catatan TEXT,
  diubah_pada BIGINT NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS public.calendar_entries (
  id BIGINT PRIMARY KEY,
  tahun_ajaran_id BIGINT NOT NULL,
  tanggal TEXT NOT NULL,
  jenis TEXT NOT NULL,
  keterangan TEXT,
  sumber TEXT NOT NULL,
  dibuat_pada BIGINT NOT NULL DEFAULT 0,
  diubah_pada BIGINT NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS public.licenses (
  id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  kode TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'tersedia' CHECK (status IN ('tersedia', 'digunakan', 'kadaluarsa')),
  email TEXT,
  guru_id BIGINT,
  tanggal_aktivasi BIGINT,
  tanggal_berakhir BIGINT
);

CREATE TABLE IF NOT EXISTS public.backups (
  id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  guru_id BIGINT NOT NULL,
  data TEXT NOT NULL,
  label TEXT NOT NULL,
  total_entitas INTEGER NOT NULL DEFAULT 0,
  dibuat_pada BIGINT NOT NULL DEFAULT 0
);

-- ============================================
-- CLOUD SYNC TABLES
-- ============================================

CREATE TABLE IF NOT EXISTS public.sync_metadata (
  id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  user_id UUID NOT NULL,
  entity_type TEXT NOT NULL,
  last_synced_at BIGINT NOT NULL DEFAULT 0,
  sync_status TEXT NOT NULL DEFAULT 'idle',
  error_message TEXT,
  total_records INTEGER NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS public.cloud_schools (
  id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  user_id UUID NOT NULL,
  local_id BIGINT NOT NULL,
  nama TEXT NOT NULL,
  jenjang TEXT NOT NULL,
  logo_url TEXT,
  alamat TEXT,
  dibuat_pada BIGINT NOT NULL DEFAULT 0,
  diubah_pada BIGINT NOT NULL DEFAULT 0,
  last_synced_at BIGINT NOT NULL DEFAULT 0,
  version INTEGER NOT NULL DEFAULT 1
);

CREATE TABLE IF NOT EXISTS public.cloud_teachers (
  id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  user_id UUID NOT NULL,
  local_id BIGINT NOT NULL,
  nama TEXT NOT NULL,
  email TEXT NOT NULL,
  sekolah_id BIGINT NOT NULL DEFAULT 0,
  tier TEXT NOT NULL DEFAULT 'FREE',
  dibuat_pada BIGINT NOT NULL DEFAULT 0,
  diubah_pada BIGINT NOT NULL DEFAULT 0,
  last_synced_at BIGINT NOT NULL DEFAULT 0,
  version INTEGER NOT NULL DEFAULT 1
);

CREATE TABLE IF NOT EXISTS public.cloud_academic_years (
  id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  user_id UUID NOT NULL,
  local_id BIGINT NOT NULL,
  guru_id BIGINT NOT NULL,
  label TEXT NOT NULL,
  tanggal_mulai TEXT NOT NULL,
  tanggal_selesai TEXT NOT NULL,
  semester_aktif TEXT NOT NULL,
  last_synced_at BIGINT NOT NULL DEFAULT 0,
  version INTEGER NOT NULL DEFAULT 1
);

CREATE TABLE IF NOT EXISTS public.cloud_classrooms (
  id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  user_id UUID NOT NULL,
  local_id BIGINT NOT NULL,
  tahun_ajaran_id BIGINT NOT NULL,
  guru_id BIGINT NOT NULL,
  nama TEXT NOT NULL,
  status_aktif BOOLEAN NOT NULL DEFAULT true,
  dibuat_pada BIGINT NOT NULL DEFAULT 0,
  diubah_pada BIGINT NOT NULL DEFAULT 0,
  last_synced_at BIGINT NOT NULL DEFAULT 0,
  version INTEGER NOT NULL DEFAULT 1
);

CREATE TABLE IF NOT EXISTS public.cloud_students (
  id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  user_id UUID NOT NULL,
  local_id BIGINT NOT NULL,
  kelas_id BIGINT NOT NULL,
  nama TEXT NOT NULL,
  nisn TEXT,
  jenis_kelamin TEXT,
  urutan INTEGER NOT NULL DEFAULT 0,
  status_aktif BOOLEAN NOT NULL DEFAULT true,
  dibuat_pada BIGINT NOT NULL DEFAULT 0,
  diubah_pada BIGINT NOT NULL DEFAULT 0,
  last_synced_at BIGINT NOT NULL DEFAULT 0,
  version INTEGER NOT NULL DEFAULT 1
);

CREATE TABLE IF NOT EXISTS public.cloud_attendance_sessions (
  id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  user_id UUID NOT NULL,
  local_id BIGINT NOT NULL,
  kelas_id BIGINT NOT NULL,
  tanggal TEXT NOT NULL,
  dibuat_pada BIGINT NOT NULL DEFAULT 0,
  diubah_pada BIGINT NOT NULL DEFAULT 0,
  last_synced_at BIGINT NOT NULL DEFAULT 0,
  version INTEGER NOT NULL DEFAULT 1
);

CREATE TABLE IF NOT EXISTS public.cloud_attendance_records (
  id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  user_id UUID NOT NULL,
  local_id BIGINT NOT NULL,
  sesi_id BIGINT NOT NULL,
  siswa_id BIGINT NOT NULL,
  status TEXT NOT NULL,
  catatan TEXT,
  diubah_pada BIGINT NOT NULL DEFAULT 0,
  last_synced_at BIGINT NOT NULL DEFAULT 0,
  version INTEGER NOT NULL DEFAULT 1
);

CREATE TABLE IF NOT EXISTS public.cloud_calendar_entries (
  id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  user_id UUID NOT NULL,
  local_id BIGINT NOT NULL,
  tahun_ajaran_id BIGINT NOT NULL,
  tanggal TEXT NOT NULL,
  jenis TEXT NOT NULL,
  keterangan TEXT,
  sumber TEXT NOT NULL,
  last_synced_at BIGINT NOT NULL DEFAULT 0,
  version INTEGER NOT NULL DEFAULT 1
);

CREATE TABLE IF NOT EXISTS public.sync_queue (
  id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  user_id UUID NOT NULL,
  entity_type TEXT NOT NULL,
  local_id BIGINT NOT NULL,
  operation TEXT NOT NULL,
  data JSONB DEFAULT '{}',
  created_at BIGINT NOT NULL DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'pending',
  retries INTEGER NOT NULL DEFAULT 0,
  error_message TEXT
);

CREATE TABLE IF NOT EXISTS public.cloud_backups (
  id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  user_id UUID NOT NULL,
  type TEXT NOT NULL,
  data TEXT NOT NULL,
  size INTEGER NOT NULL DEFAULT 0,
  total_entitas INTEGER NOT NULL DEFAULT 0,
  label TEXT NOT NULL,
  created_at BIGINT NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS public.cloud_tombstones (
  id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  user_id UUID NOT NULL,
  entity_type TEXT NOT NULL,
  local_id BIGINT NOT NULL,
  deleted_at BIGINT NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS public.devices (
  id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  user_id UUID NOT NULL,
  device_name TEXT NOT NULL,
  device_id TEXT NOT NULL,
  last_active_at BIGINT NOT NULL DEFAULT 0,
  created_at BIGINT NOT NULL DEFAULT 0,
  ip_address TEXT,
  user_agent TEXT,
  UNIQUE(user_id, device_id)
);

-- ============================================
-- INDEXES
-- ============================================
CREATE INDEX IF NOT EXISTS idx_profiles_tier ON public.profiles(tier);
CREATE INDEX IF NOT EXISTS idx_licenses_kode ON public.licenses(kode);
CREATE INDEX IF NOT EXISTS idx_licenses_email ON public.licenses(email);
CREATE INDEX IF NOT EXISTS idx_licenses_status ON public.licenses(status);
CREATE INDEX IF NOT EXISTS idx_cloud_schools_user_id ON public.cloud_schools(user_id);
CREATE INDEX IF NOT EXISTS idx_cloud_teachers_user_id ON public.cloud_teachers(user_id);
CREATE INDEX IF NOT EXISTS idx_cloud_academic_years_user_id ON public.cloud_academic_years(user_id);
CREATE INDEX IF NOT EXISTS idx_cloud_classrooms_user_id ON public.cloud_classrooms(user_id);
CREATE INDEX IF NOT EXISTS idx_cloud_students_user_id ON public.cloud_students(user_id);
CREATE INDEX IF NOT EXISTS idx_cloud_att_sessions_user_id ON public.cloud_attendance_sessions(user_id);
CREATE INDEX IF NOT EXISTS idx_cloud_att_records_user_id ON public.cloud_attendance_records(user_id);
CREATE INDEX IF NOT EXISTS idx_cloud_calendar_entries_user_id ON public.cloud_calendar_entries(user_id);

CREATE INDEX IF NOT EXISTS idx_students_kelas_id ON public.students(kelas_id);
CREATE INDEX IF NOT EXISTS idx_attendance_sessions_kelas_id ON public.attendance_sessions(kelas_id);
CREATE INDEX IF NOT EXISTS idx_attendance_sessions_tanggal ON public.attendance_sessions(tanggal);
CREATE INDEX IF NOT EXISTS idx_attendance_records_sesi_id ON public.attendance_records(sesi_id);
CREATE INDEX IF NOT EXISTS idx_calendar_entries_tanggal ON public.calendar_entries(tanggal);
CREATE INDEX IF NOT EXISTS idx_classrooms_guru_id ON public.classrooms(guru_id);
CREATE INDEX IF NOT EXISTS idx_academic_years_guru_id ON public.academic_years(guru_id);

-- ============================================
-- RLS: ENABLE ON ALL TABLES
-- ============================================
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.schools ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.teachers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.academic_years ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.classrooms ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.students ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.attendance_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.attendance_records ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.calendar_entries ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.licenses ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.backups ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sync_metadata ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.cloud_schools ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.cloud_teachers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.cloud_academic_years ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.cloud_classrooms ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.cloud_students ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.cloud_attendance_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.cloud_attendance_records ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.cloud_calendar_entries ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sync_queue ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.cloud_backups ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.cloud_tombstones ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.devices ENABLE ROW LEVEL SECURITY;

-- ============================================
-- RLS POLICIES (open for import phase, tighten later)
-- ============================================
CREATE POLICY pol_schools ON public.schools FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY pol_teachers ON public.teachers FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY pol_academic_years ON public.academic_years FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY pol_classrooms ON public.classrooms FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY pol_students ON public.students FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY pol_attendance_sessions ON public.attendance_sessions FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY pol_attendance_records ON public.attendance_records FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY pol_calendar_entries ON public.calendar_entries FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY pol_licenses ON public.licenses FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY pol_backups ON public.backups FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY pol_sync_metadata ON public.sync_metadata FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY pol_cloud_schools ON public.cloud_schools FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY pol_cloud_teachers ON public.cloud_teachers FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY pol_cloud_academic_years ON public.cloud_academic_years FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY pol_cloud_classrooms ON public.cloud_classrooms FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY pol_cloud_students ON public.cloud_students FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY pol_cloud_att_sessions ON public.cloud_attendance_sessions FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY pol_cloud_att_records ON public.cloud_attendance_records FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY pol_cloud_calendar ON public.cloud_calendar_entries FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY pol_sync_queue ON public.sync_queue FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY pol_cloud_backups ON public.cloud_backups FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY pol_cloud_tombstones ON public.cloud_tombstones FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY pol_devices ON public.devices FOR ALL USING (true) WITH CHECK (true);

CREATE POLICY pol_profiles_select ON public.profiles FOR SELECT USING (true);
CREATE POLICY pol_profiles_update ON public.profiles FOR UPDATE USING (true) WITH CHECK (true);
CREATE POLICY pol_profiles_insert ON public.profiles FOR INSERT WITH CHECK (true);

COMMIT;
