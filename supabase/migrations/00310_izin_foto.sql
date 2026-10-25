-- Lampiran foto pengajuan izin (surat dokter dll), path objek di bucket selfie-guru.
ALTER TABLE public.cloud_guru_attendance ADD COLUMN IF NOT EXISTS izin_foto_url TEXT;
