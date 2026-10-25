-- Paket sekolah (FREE/PLUS/PRO) dicatat admin agar HP guru tahu fitur yang berlaku
-- (PRO/masa coba = GPS & peta; selainnya selfie saja). paket_sampai = akhir lisensi/masa coba (ms epoch).
ALTER TABLE public.cloud_guru_sekolah
  ADD COLUMN IF NOT EXISTS paket TEXT,
  ADD COLUMN IF NOT EXISTS paket_sampai BIGINT;
