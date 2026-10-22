-- Absen mandiri siswa (B2) - trial untuk 1-2 guru saja
-- 1 link per siswa via absen_token, flag per kelas

ALTER TABLE public.students
  ADD COLUMN IF NOT EXISTS absen_token TEXT UNIQUE;

CREATE INDEX IF NOT EXISTS idx_students_absen_token ON public.students(absen_token);

ALTER TABLE public.classrooms
  ADD COLUMN IF NOT EXISTS allow_siswa_absen_mandiri BOOLEAN NOT NULL DEFAULT false;

-- Aktifkan hanya untuk trial (suhaimihs90@gmail.com & coba@gmail.com)
-- Guru dicari via teachers.email, lalu kelasnya di-ON-kan
-- UPDATE public.classrooms SET allow_siswa_absen_mandiri = true
-- WHERE guru_id IN (SELECT id FROM public.teachers WHERE email IN ('suhaimihs90@gmail.com','coba@gmail.com'));

-- Cloud tables juga perlu kolom yang sama untuk sync (jika ada cloud_students)
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema='public' AND table_name='cloud_students') THEN
    EXECUTE 'ALTER TABLE public.cloud_students ADD COLUMN IF NOT EXISTS absen_token TEXT';
    EXECUTE 'CREATE INDEX IF NOT EXISTS idx_cloud_students_absen_token ON public.cloud_students(absen_token)';
  END IF;
END $$;

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema='public' AND table_name='cloud_classrooms') THEN
    EXECUTE 'ALTER TABLE public.cloud_classrooms ADD COLUMN IF NOT EXISTS allow_siswa_absen_mandiri BOOLEAN NOT NULL DEFAULT false';
  END IF;
END $$;
