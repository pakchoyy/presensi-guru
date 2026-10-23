-- true = selfie lolos deteksi wajah + gerak kepala; false = foto biasa
-- (mis. model gagal dimuat offline). NULL = data lama sebelum fitur ini.
ALTER TABLE public.cloud_guru_attendance
  ADD COLUMN IF NOT EXISTS verifikasi_masuk BOOLEAN,
  ADD COLUMN IF NOT EXISTS verifikasi_pulang BOOLEAN;
