-- ============================================
-- 00104_cleanup_cloud_duplicates.sql
-- ============================================
-- Bersihkan baris DUPLIKAT di tabel cloud (user_id + local_id dobel) yang
-- membuat itungan rekap berbeda di tiap perangkat (efek: satu siswa tampil
-- beda sendiri, misal "masuk 13 hari tapi cuma 11").
--
-- Lalu pasang UNIQUE INDEX agar duplikat tidak bisa terulang lagi.
--
-- CARA PAKAI: buka Supabase SQL Editor -> paste seluruh file ini -> Run.
-- Jangan jalankan dalam 1 transaction besar (jalankan apa adanya, aman).
-- ============================================

-- 1) Hapus duplikat per tabel — simpan baris dengan id (identity) terkecil.
--    Data yang tersisa otomatis disinkron ulang dari perangkat lokal yang
--    otoritatif pada sync berikutnya.

-- cloud_attendance_records
DELETE FROM public.cloud_attendance_records a
USING public.cloud_attendance_records b
WHERE a.user_id = b.user_id AND a.local_id = b.local_id AND a.id > b.id;

-- cloud_attendance_sessions
DELETE FROM public.cloud_attendance_sessions a
USING public.cloud_attendance_sessions b
WHERE a.user_id = b.user_id AND a.local_id = b.local_id AND a.id > b.id;

-- cloud_students
DELETE FROM public.cloud_students a
USING public.cloud_students b
WHERE a.user_id = b.user_id AND a.local_id = b.local_id AND a.id > b.id;

-- cloud_classrooms
DELETE FROM public.cloud_classrooms a
USING public.cloud_classrooms b
WHERE a.user_id = b.user_id AND a.local_id = b.local_id AND a.id > b.id;

-- cloud_schools
DELETE FROM public.cloud_schools a
USING public.cloud_schools b
WHERE a.user_id = b.user_id AND a.local_id = b.local_id AND a.id > b.id;

-- cloud_teachers
DELETE FROM public.cloud_teachers a
USING public.cloud_teachers b
WHERE a.user_id = b.user_id AND a.local_id = b.local_id AND a.id > b.id;

-- cloud_academic_years
DELETE FROM public.cloud_academic_years a
USING public.cloud_academic_years b
WHERE a.user_id = b.user_id AND a.local_id = b.local_id AND a.id > b.id;

-- cloud_calendar_entries
DELETE FROM public.cloud_calendar_entries a
USING public.cloud_calendar_entries b
WHERE a.user_id = b.user_id AND a.local_id = b.local_id AND a.id > b.id;

-- cloud_tombstones (duplikat tombstone dibersihkan agar tidak memicu delete ulang)
DELETE FROM public.cloud_tombstones a
USING public.cloud_tombstones b
WHERE a.user_id = b.user_id AND a.entity_type = b.entity_type
  AND a.local_id = b.local_id AND a.id > b.id;

-- ============================================
-- 2) UNIQUE INDEX — cegah duplikat terulang
--    (sync di sisi aplikasi sudah diubah memakai UPSERT)
-- ============================================

CREATE UNIQUE INDEX IF NOT EXISTS uq_cloud_records_uid_local
  ON public.cloud_attendance_records(user_id, local_id);
CREATE UNIQUE INDEX IF NOT EXISTS uq_cloud_sessions_uid_local
  ON public.cloud_attendance_sessions(user_id, local_id);
CREATE UNIQUE INDEX IF NOT EXISTS uq_cloud_students_uid_local
  ON public.cloud_students(user_id, local_id);
CREATE UNIQUE INDEX IF NOT EXISTS uq_cloud_classrooms_uid_local
  ON public.cloud_classrooms(user_id, local_id);
CREATE UNIQUE INDEX IF NOT EXISTS uq_cloud_schools_uid_local
  ON public.cloud_schools(user_id, local_id);
CREATE UNIQUE INDEX IF NOT EXISTS uq_cloud_teachers_uid_local
  ON public.cloud_teachers(user_id, local_id);
CREATE UNIQUE INDEX IF NOT EXISTS uq_cloud_ay_uid_local
  ON public.cloud_academic_years(user_id, local_id);
CREATE UNIQUE INDEX IF NOT EXISTS uq_cloud_calendar_uid_local
  ON public.cloud_calendar_entries(user_id, local_id);
CREATE UNIQUE INDEX IF NOT EXISTS uq_cloud_tombstones
  ON public.cloud_tombstones(user_id, entity_type, local_id);
