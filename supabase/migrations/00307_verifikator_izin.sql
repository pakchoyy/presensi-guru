-- Kepala Sekolah (atau guru lain yang ditunjuk admin) sebagai VERIFIKATOR izin:
-- login dengan akun gurunya sendiri, hanya bisa melihat & memutuskan pengajuan
-- izin di sekolahnya. Pengaturan sistem tetap di akun admin (operator).
ALTER TABLE public.cloud_guru_teachers ADD COLUMN IF NOT EXISTS verifikator BOOLEAN NOT NULL DEFAULT false;

CREATE OR REPLACE FUNCTION public.sekolah_saya_sebagai_verifikator()
RETURNS uuid LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT sekolah_uuid FROM public.cloud_guru_teachers
  WHERE user_id = auth.uid() AND verifikator AND status_aktif IS NOT FALSE
  LIMIT 1
$$;

-- Hanya baris pengajuan izin (status_izin terisi) yang terlihat oleh verifikator.
CREATE POLICY cga_verifikator_select ON public.cloud_guru_attendance FOR SELECT
  USING (status_izin IS NOT NULL AND sekolah_uuid = public.sekolah_saya_sebagai_verifikator());
CREATE POLICY cga_verifikator_update ON public.cloud_guru_attendance FOR UPDATE
  USING (status_izin IS NOT NULL AND sekolah_uuid = public.sekolah_saya_sebagai_verifikator())
  WITH CHECK (sekolah_uuid = public.sekolah_saya_sebagai_verifikator());
-- Nama guru untuk daftar pengajuan.
CREATE POLICY cgt_verifikator_select ON public.cloud_guru_teachers FOR SELECT
  USING (sekolah_uuid = public.sekolah_saya_sebagai_verifikator());

-- Guru hanya boleh mengajukan (proses). Verifikator hanya boleh mengubah
-- status_izin; kolom lain dikembalikan ke nilai lama.
CREATE OR REPLACE FUNCTION public.jaga_status_izin()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  keputusan TEXT;
  waktu BIGINT;
BEGIN
  IF auth.uid() IS NULL THEN RETURN NEW; END IF;
  IF auth.uid() = NEW.user_id THEN
    IF TG_OP = 'INSERT' THEN
      IF NEW.status_izin IS NOT NULL AND NEW.status_izin <> 'proses' THEN NEW.status_izin := 'proses'; END IF;
    ELSIF NEW.status_izin IS DISTINCT FROM OLD.status_izin AND NEW.status_izin IS DISTINCT FROM 'proses' THEN
      NEW.status_izin := OLD.status_izin;
    END IF;
  ELSIF TG_OP = 'UPDATE' AND NEW.sekolah_uuid IS DISTINCT FROM public.sekolah_milik_saya() THEN
    keputusan := NEW.status_izin;
    waktu := NEW.diubah_pada;
    NEW := OLD;
    IF keputusan IN ('disetujui', 'ditolak') THEN
      NEW.status_izin := keputusan;
      NEW.diubah_pada := waktu;
    END IF;
  END IF;
  RETURN NEW;
END $$;
