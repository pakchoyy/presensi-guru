-- Persetujuan izin: proses → disetujui / ditolak (oleh admin sekolah).
-- Catatan: status pulang "EARLY" (pulang cepat) disimpan sebagai 'LATE' di
-- kolom status_pulang (nilai itu tidak pernah dipakai untuk pulang), supaya
-- CHECK constraint lama tidak perlu dibongkar.
ALTER TABLE public.cloud_guru_attendance ADD COLUMN IF NOT EXISTS status_izin TEXT
  CHECK (status_izin IN ('proses','disetujui','ditolak'));

-- Guru hanya boleh mengajukan (proses); keputusan hanya dari admin/service_role.
CREATE OR REPLACE FUNCTION public.jaga_status_izin()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF auth.uid() IS NOT NULL AND auth.uid() = NEW.user_id THEN
    IF TG_OP = 'INSERT' THEN
      IF NEW.status_izin IS NOT NULL AND NEW.status_izin <> 'proses' THEN NEW.status_izin := 'proses'; END IF;
    ELSIF NEW.status_izin IS DISTINCT FROM OLD.status_izin AND NEW.status_izin IS DISTINCT FROM 'proses' THEN
      NEW.status_izin := OLD.status_izin;
    END IF;
  END IF;
  RETURN NEW;
END $$;
CREATE OR REPLACE TRIGGER jaga_status_izin BEFORE INSERT OR UPDATE ON public.cloud_guru_attendance
  FOR EACH ROW EXECUTE FUNCTION public.jaga_status_izin();
