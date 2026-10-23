-- Jendela presensi: masuk dibuka jam mulai_masuk, pulang ditutup jam batas_pulang ("HH:MM").
ALTER TABLE public.cloud_guru_sekolah
  ADD COLUMN IF NOT EXISTS mulai_masuk TEXT,
  ADD COLUMN IF NOT EXISTS batas_pulang TEXT;
