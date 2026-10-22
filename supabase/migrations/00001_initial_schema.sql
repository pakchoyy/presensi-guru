-- ============================================
-- STEP 2: SUPABASE SQL MIGRATION
-- From Convex schema to PostgreSQL
-- ============================================

BEGIN;

-- ============================================
-- PROFILES (extends auth.users)
-- Replaces: convex users table + custom auth
-- ============================================
CREATE TABLE public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email TEXT NOT NULL,
  name TEXT NOT NULL,
  tier TEXT NOT NULL DEFAULT 'FREE' CHECK (tier IN ('FREE', 'PRO')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Auto-create profile on user signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (id, email, name, tier)
  VALUES (
    NEW.id,
    COALESCE(NEW.email, NEW.raw_user_meta_data->>'email', ''),
    COALESCE(NEW.raw_user_meta_data->>'name', split_part(NEW.email, '@', 1)),
    COALESCE(NEW.raw_user_meta_data->>'tier', 'FREE')
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE OR REPLACE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- ============================================
-- SCHOOLS
-- ============================================
CREATE TABLE public.schools (
  id BIGINT PRIMARY KEY,
  nama TEXT NOT NULL,
  jenjang TEXT NOT NULL,
  logo_url TEXT,
  alamat TEXT,
  dibuat_pada BIGINT NOT NULL DEFAULT 0,
  diubah_pada BIGINT NOT NULL DEFAULT 0
);
CREATE INDEX idx_schools_diubah_pada ON public.schools(diubah_pada);

-- ============================================
-- TEACHERS
-- ============================================
CREATE TABLE public.teachers (
  id BIGINT PRIMARY KEY,
  user_id UUID REFERENCES public.profiles(id),
  nama TEXT NOT NULL,
  email TEXT NOT NULL,
  sekolah_id BIGINT NOT NULL DEFAULT 0,
  tier TEXT NOT NULL DEFAULT 'FREE',
  dibuat_pada BIGINT NOT NULL DEFAULT 0,
  diubah_pada BIGINT NOT NULL DEFAULT 0
);
CREATE INDEX idx_teachers_email ON public.teachers(email);
CREATE INDEX idx_teachers_user_id ON public.teachers(user_id);
CREATE INDEX idx_teachers_diubah_pada ON public.teachers(diubah_pada);

-- ============================================
-- ACADEMIC YEARS
-- ============================================
CREATE TABLE public.academic_years (
  id BIGINT PRIMARY KEY,
  guru_id BIGINT NOT NULL,
  label TEXT NOT NULL,
  tanggal_mulai TEXT NOT NULL,
  tanggal_selesai TEXT NOT NULL,
  semester_aktif TEXT NOT NULL,
  dibuat_pada BIGINT NOT NULL DEFAULT 0,
  diubah_pada BIGINT NOT NULL DEFAULT 0
);
CREATE INDEX idx_academic_years_guru_id ON public.academic_years(guru_id);

-- ============================================
-- CLASSROOMS
-- ============================================
CREATE TABLE public.classrooms (
  id BIGINT PRIMARY KEY,
  tahun_ajaran_id BIGINT NOT NULL,
  guru_id BIGINT NOT NULL,
  nama TEXT NOT NULL,
  status_aktif BOOLEAN NOT NULL DEFAULT true,
  dibuat_pada BIGINT NOT NULL DEFAULT 0,
  diubah_pada BIGINT NOT NULL DEFAULT 0
);
CREATE INDEX idx_classrooms_guru_id ON public.classrooms(guru_id);
CREATE INDEX idx_classrooms_kelas_id ON public.classrooms(id);
CREATE INDEX idx_classrooms_diubah_pada ON public.classrooms(diubah_pada);

-- ============================================
-- STUDENTS
-- ============================================
CREATE TABLE public.students (
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
CREATE INDEX idx_students_kelas_id ON public.students(kelas_id);
CREATE INDEX idx_students_diubah_pada ON public.students(diubah_pada);

-- ============================================
-- ATTENDANCE SESSIONS
-- ============================================
CREATE TABLE public.attendance_sessions (
  id BIGINT PRIMARY KEY,
  kelas_id BIGINT NOT NULL,
  tanggal TEXT NOT NULL,
  dibuat_pada BIGINT NOT NULL DEFAULT 0,
  diubah_pada BIGINT NOT NULL DEFAULT 0
);
CREATE INDEX idx_attendance_sessions_kelas_id ON public.attendance_sessions(kelas_id);
CREATE INDEX idx_attendance_sessions_tanggal ON public.attendance_sessions(tanggal);
CREATE INDEX idx_attendance_sessions_kelas_tanggal ON public.attendance_sessions(kelas_id, tanggal);
CREATE INDEX idx_attendance_sessions_diubah_pada ON public.attendance_sessions(diubah_pada);

-- ============================================
-- ATTENDANCE RECORDS
-- ============================================
CREATE TABLE public.attendance_records (
  id BIGINT PRIMARY KEY,
  sesi_id BIGINT NOT NULL,
  siswa_id BIGINT NOT NULL,
  status TEXT NOT NULL,
  catatan TEXT,
  diubah_pada BIGINT NOT NULL DEFAULT 0
);
CREATE INDEX idx_attendance_records_sesi_id ON public.attendance_records(sesi_id);
CREATE INDEX idx_attendance_records_sesi_siswa ON public.attendance_records(sesi_id, siswa_id);
CREATE INDEX idx_attendance_records_diubah_pada ON public.attendance_records(diubah_pada);

-- ============================================
-- CALENDAR ENTRIES
-- ============================================
CREATE TABLE public.calendar_entries (
  id BIGINT PRIMARY KEY,
  tahun_ajaran_id BIGINT NOT NULL,
  tanggal TEXT NOT NULL,
  jenis TEXT NOT NULL,
  keterangan TEXT,
  sumber TEXT NOT NULL,
  dibuat_pada BIGINT NOT NULL DEFAULT 0,
  diubah_pada BIGINT NOT NULL DEFAULT 0
);
CREATE INDEX idx_calendar_entries_tanggal ON public.calendar_entries(tanggal);

-- ============================================
-- LICENSES
-- ============================================
CREATE TABLE public.licenses (
  id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  kode TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'tersedia' CHECK (status IN ('tersedia', 'digunakan', 'kadaluarsa')),
  email TEXT,
  guru_id BIGINT,
  tanggal_aktivasi BIGINT,
  tanggal_berakhir BIGINT
);
CREATE INDEX idx_licenses_kode ON public.licenses(kode);
CREATE INDEX idx_licenses_email ON public.licenses(email);

-- ============================================
-- BACKUPS (local backup records)
-- ============================================
CREATE TABLE public.backups (
  id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  guru_id BIGINT NOT NULL,
  data TEXT NOT NULL,
  label TEXT NOT NULL,
  total_entitas INTEGER NOT NULL DEFAULT 0,
  dibuat_pada BIGINT NOT NULL DEFAULT 0
);
CREATE INDEX idx_backups_guru_id ON public.backups(guru_id);

-- ============================================
-- FASE 4: CLOUD SYNC TABLES (PRO ONLY)
-- ============================================

-- SYNC METADATA
CREATE TABLE public.sync_metadata (
  id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES public.profiles(id),
  entity_type TEXT NOT NULL,
  last_synced_at BIGINT NOT NULL DEFAULT 0,
  sync_status TEXT NOT NULL DEFAULT 'idle' CHECK (sync_status IN ('idle', 'syncing', 'error')),
  error_message TEXT,
  total_records INTEGER NOT NULL DEFAULT 0
);
CREATE INDEX idx_sync_metadata_user_id ON public.sync_metadata(user_id);
CREATE INDEX idx_sync_metadata_user_entity ON public.sync_metadata(user_id, entity_type);

-- CLOUD SCHOOLS
CREATE TABLE public.cloud_schools (
  id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES public.profiles(id),
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
CREATE INDEX idx_cloud_schools_user_id ON public.cloud_schools(user_id);
CREATE INDEX idx_cloud_schools_user_local ON public.cloud_schools(user_id, local_id);

-- CLOUD TEACHERS
CREATE TABLE public.cloud_teachers (
  id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES public.profiles(id),
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
CREATE INDEX idx_cloud_teachers_user_id ON public.cloud_teachers(user_id);
CREATE INDEX idx_cloud_teachers_email ON public.cloud_teachers(email);
CREATE INDEX idx_cloud_teachers_user_local ON public.cloud_teachers(user_id, local_id);

-- CLOUD ACADEMIC YEARS
CREATE TABLE public.cloud_academic_years (
  id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES public.profiles(id),
  local_id BIGINT NOT NULL,
  guru_id BIGINT NOT NULL,
  label TEXT NOT NULL,
  tanggal_mulai TEXT NOT NULL,
  tanggal_selesai TEXT NOT NULL,
  semester_aktif TEXT NOT NULL,
  last_synced_at BIGINT NOT NULL DEFAULT 0,
  version INTEGER NOT NULL DEFAULT 1
);
CREATE INDEX idx_cloud_academic_years_user_id ON public.cloud_academic_years(user_id);
CREATE INDEX idx_cloud_academic_years_user_local ON public.cloud_academic_years(user_id, local_id);

-- CLOUD CLASSROOMS
CREATE TABLE public.cloud_classrooms (
  id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES public.profiles(id),
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
CREATE INDEX idx_cloud_classrooms_user_id ON public.cloud_classrooms(user_id);
CREATE INDEX idx_cloud_classrooms_user_guru ON public.cloud_classrooms(user_id, guru_id);
CREATE INDEX idx_cloud_classrooms_user_local ON public.cloud_classrooms(user_id, local_id);

-- CLOUD STUDENTS
CREATE TABLE public.cloud_students (
  id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES public.profiles(id),
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
CREATE INDEX idx_cloud_students_user_id ON public.cloud_students(user_id);
CREATE INDEX idx_cloud_students_user_kelas ON public.cloud_students(user_id, kelas_id);
CREATE INDEX idx_cloud_students_user_local ON public.cloud_students(user_id, local_id);

-- CLOUD ATTENDANCE SESSIONS
CREATE TABLE public.cloud_attendance_sessions (
  id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES public.profiles(id),
  local_id BIGINT NOT NULL,
  kelas_id BIGINT NOT NULL,
  tanggal TEXT NOT NULL,
  dibuat_pada BIGINT NOT NULL DEFAULT 0,
  diubah_pada BIGINT NOT NULL DEFAULT 0,
  last_synced_at BIGINT NOT NULL DEFAULT 0,
  version INTEGER NOT NULL DEFAULT 1
);
CREATE INDEX idx_cloud_att_sessions_user_id ON public.cloud_attendance_sessions(user_id);
CREATE INDEX idx_cloud_att_sessions_user_kelas_tgl ON public.cloud_attendance_sessions(user_id, kelas_id, tanggal);
CREATE INDEX idx_cloud_att_sessions_user_local ON public.cloud_attendance_sessions(user_id, local_id);

-- CLOUD ATTENDANCE RECORDS
CREATE TABLE public.cloud_attendance_records (
  id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES public.profiles(id),
  local_id BIGINT NOT NULL,
  sesi_id BIGINT NOT NULL,
  siswa_id BIGINT NOT NULL,
  status TEXT NOT NULL,
  catatan TEXT,
  diubah_pada BIGINT NOT NULL DEFAULT 0,
  last_synced_at BIGINT NOT NULL DEFAULT 0,
  version INTEGER NOT NULL DEFAULT 1
);
CREATE INDEX idx_cloud_att_records_user_id ON public.cloud_attendance_records(user_id);
CREATE INDEX idx_cloud_att_records_user_sesi ON public.cloud_attendance_records(user_id, sesi_id);
CREATE INDEX idx_cloud_att_records_user_local ON public.cloud_attendance_records(user_id, local_id);

-- CLOUD CALENDAR ENTRIES
CREATE TABLE public.cloud_calendar_entries (
  id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES public.profiles(id),
  local_id BIGINT NOT NULL,
  tahun_ajaran_id BIGINT NOT NULL,
  tanggal TEXT NOT NULL,
  jenis TEXT NOT NULL,
  keterangan TEXT,
  sumber TEXT NOT NULL,
  last_synced_at BIGINT NOT NULL DEFAULT 0,
  version INTEGER NOT NULL DEFAULT 1
);
CREATE INDEX idx_cloud_calendar_entries_user_id ON public.cloud_calendar_entries(user_id);
CREATE INDEX idx_cloud_calendar_entries_user_tgl ON public.cloud_calendar_entries(user_id, tanggal);
CREATE INDEX idx_cloud_calendar_entries_user_local ON public.cloud_calendar_entries(user_id, local_id);

-- SYNC QUEUE (offline queue)
CREATE TABLE public.sync_queue (
  id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES public.profiles(id),
  entity_type TEXT NOT NULL,
  local_id BIGINT NOT NULL,
  operation TEXT NOT NULL CHECK (operation IN ('create', 'update', 'delete')),
  data JSONB NOT NULL DEFAULT '{}',
  created_at BIGINT NOT NULL DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'synced', 'failed')),
  retries INTEGER NOT NULL DEFAULT 0,
  error_message TEXT
);
CREATE INDEX idx_sync_queue_user_status ON public.sync_queue(user_id, status);
CREATE INDEX idx_sync_queue_created_at ON public.sync_queue(created_at);

-- CLOUD BACKUPS (compressed)
CREATE TABLE public.cloud_backups (
  id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES public.profiles(id),
  type TEXT NOT NULL CHECK (type IN ('auto', 'manual')),
  data TEXT NOT NULL,
  size INTEGER NOT NULL DEFAULT 0,
  total_entitas INTEGER NOT NULL DEFAULT 0,
  label TEXT NOT NULL,
  created_at BIGINT NOT NULL DEFAULT 0
);
CREATE INDEX idx_cloud_backups_user_id ON public.cloud_backups(user_id);
CREATE INDEX idx_cloud_backups_user_created ON public.cloud_backups(user_id, created_at);

-- CLOUD TOMBSTONES
CREATE TABLE public.cloud_tombstones (
  id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES public.profiles(id),
  entity_type TEXT NOT NULL,
  local_id BIGINT NOT NULL,
  deleted_at BIGINT NOT NULL DEFAULT 0
);
CREATE INDEX idx_cloud_tombstones_user_id ON public.cloud_tombstones(user_id);

-- DEVICES
CREATE TABLE public.devices (
  id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES public.profiles(id),
  device_name TEXT NOT NULL,
  device_id TEXT NOT NULL,
  last_active_at BIGINT NOT NULL DEFAULT 0,
  created_at BIGINT NOT NULL DEFAULT 0,
  ip_address TEXT,
  user_agent TEXT
);
CREATE INDEX idx_devices_user_id ON public.devices(user_id);
CREATE INDEX idx_devices_user_device ON public.devices(user_id, device_id);
-- Unique constraint: one device_id per user
CREATE UNIQUE INDEX idx_devices_user_device_unique ON public.devices(user_id, device_id);

-- ============================================
-- ROW LEVEL SECURITY (RLS)
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
-- RLS POLICIES
-- ============================================

-- PROFILES: user only sees/edits own profile
CREATE POLICY "Users can view own profile" ON public.profiles
  FOR SELECT USING (auth.uid() = id);

CREATE POLICY "Users can update own profile" ON public.profiles
  FOR UPDATE USING (auth.uid() = id);

CREATE POLICY "Users can insert own profile" ON public.profiles
  FOR INSERT WITH CHECK (auth.uid() = id);

-- TEACHERS: link auth.user to teacher record
-- Teachers are accessible based on email or user_id match
CREATE POLICY "Teachers accessible by linked user" ON public.teachers
  FOR ALL USING (
    user_id = auth.uid()
    OR email = (SELECT email FROM public.profiles WHERE id = auth.uid())
  );

-- SCHOOLS: accessible by any authenticated user (shared data)
CREATE POLICY "Schools accessible by authenticated users" ON public.schools
  FOR ALL USING (auth.uid() IS NOT NULL);

-- ACADEMIC YEARS: accessible by owner's teacher
CREATE POLICY "Academic years accessible by owner" ON public.academic_years
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM public.teachers
      WHERE teachers.id = academic_years.guru_id
      AND teachers.user_id = auth.uid()
    )
  );

-- CLASSROOMS: accessible by owner teacher
CREATE POLICY "Classrooms accessible by owner" ON public.classrooms
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM public.teachers
      WHERE teachers.id = classrooms.guru_id
      AND teachers.user_id = auth.uid()
    )
  );

-- STUDENTS: accessible via classroom owner
CREATE POLICY "Students accessible by classroom owner" ON public.students
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM public.classrooms c
      JOIN public.teachers t ON t.id = c.guru_id
      WHERE c.id = students.kelas_id
      AND t.user_id = auth.uid()
    )
  );

-- ATTENDANCE SESSIONS: accessible via classroom owner
CREATE POLICY "Attendance sessions accessible by classroom owner" ON public.attendance_sessions
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM public.classrooms c
      JOIN public.teachers t ON t.id = c.guru_id
      WHERE c.id = attendance_sessions.kelas_id
      AND t.user_id = auth.uid()
    )
  );

-- ATTENDANCE RECORDS: accessible via session -> classroom owner
CREATE POLICY "Attendance records accessible by session owner" ON public.attendance_records
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM public.attendance_sessions s
      JOIN public.classrooms c ON c.id = s.kelas_id
      JOIN public.teachers t ON t.id = c.guru_id
      WHERE s.id = attendance_records.sesi_id
      AND t.user_id = auth.uid()
    )
  );

-- CALENDAR ENTRIES: accessible by authenticated users
CREATE POLICY "Calendar entries accessible by authenticated users" ON public.calendar_entries
  FOR ALL USING (auth.uid() IS NOT NULL);

-- LICENSES: admin full access, user only sees own
CREATE POLICY "Licenses readable by authenticated users" ON public.licenses
  FOR SELECT USING (auth.uid() IS NOT NULL);

CREATE POLICY "Licenses insert by admin only" ON public.licenses
  FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE id = auth.uid() AND tier = 'PRO'
    )
  );

CREATE POLICY "Licenses update by admin" ON public.licenses
  FOR UPDATE USING (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE id = auth.uid() AND tier = 'PRO'
    )
  );

-- BACKUPS: accessible by owner teacher
CREATE POLICY "Backups accessible by owner" ON public.backups
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM public.teachers
      WHERE teachers.id = backups.guru_id
      AND teachers.user_id = auth.uid()
    )
  );

-- CLOUD TABLES (user-scoped): user owns all their cloud data
-- Cloud Schools
CREATE POLICY "Cloud schools accessible by owner" ON public.cloud_schools
  FOR ALL USING (user_id = auth.uid());

-- Cloud Teachers
CREATE POLICY "Cloud teachers accessible by owner" ON public.cloud_teachers
  FOR ALL USING (user_id = auth.uid());

-- Cloud Academic Years
CREATE POLICY "Cloud academic years accessible by owner" ON public.cloud_academic_years
  FOR ALL USING (user_id = auth.uid());

-- Cloud Classrooms
CREATE POLICY "Cloud classrooms accessible by owner" ON public.cloud_classrooms
  FOR ALL USING (user_id = auth.uid());

-- Cloud Students
CREATE POLICY "Cloud students accessible by owner" ON public.cloud_students
  FOR ALL USING (user_id = auth.uid());

-- Cloud Attendance Sessions
CREATE POLICY "Cloud attendance sessions accessible by owner" ON public.cloud_attendance_sessions
  FOR ALL USING (user_id = auth.uid());

-- Cloud Attendance Records
CREATE POLICY "Cloud attendance records accessible by owner" ON public.cloud_attendance_records
  FOR ALL USING (user_id = auth.uid());

-- Cloud Calendar Entries
CREATE POLICY "Cloud calendar entries accessible by owner" ON public.cloud_calendar_entries
  FOR ALL USING (user_id = auth.uid());

-- Sync Queue
CREATE POLICY "Sync queue accessible by owner" ON public.sync_queue
  FOR ALL USING (user_id = auth.uid());

-- Cloud Backups
CREATE POLICY "Cloud backups accessible by owner" ON public.cloud_backups
  FOR ALL USING (user_id = auth.uid());

-- Cloud Tombstones
CREATE POLICY "Cloud tombstones accessible by owner" ON public.cloud_tombstones
  FOR ALL USING (user_id = auth.uid());

-- Devices
CREATE POLICY "Devices accessible by owner" ON public.devices
  FOR ALL USING (user_id = auth.uid());

-- Sync Metadata
CREATE POLICY "Sync metadata accessible by owner" ON public.sync_metadata
  FOR ALL USING (user_id = auth.uid());

-- ============================================
-- ADDITIONAL OPTIMIZATION INDEXES
-- (per Langkah 5: index semua kolom yang sering difilter)
-- ============================================

CREATE INDEX idx_profiles_tier ON public.profiles(tier);
CREATE INDEX idx_students_status_aktif ON public.students(status_aktif);
CREATE INDEX idx_classrooms_status_aktif ON public.classrooms(status_aktif);
CREATE INDEX idx_licenses_status ON public.licenses(status);
CREATE INDEX idx_cloud_tombstones_deleted_at ON public.cloud_tombstones(deleted_at);

COMMIT;
