-- Tanggal libur kalender sekolah (YYYY-MM-DD dipisah koma), dikirim admin; dipakai HP guru & api/clockin.
ALTER TABLE public.cloud_guru_sekolah ADD COLUMN IF NOT EXISTS libur text;
