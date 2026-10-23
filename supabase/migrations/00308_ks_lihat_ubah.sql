-- Kepala Sekolah (verifikator) bisa melihat & mengubah presensi semua guru di
-- sekolahnya (seperti Dashboard admin), dan izinnya sendiri langsung disetujui.
-- Kolom bukti (foto, lokasi, jarak) & identitas tetap tidak bisa diubah KS.
ALTER POLICY cga_verifikator_select ON public.cloud_guru_attendance
  USING (sekolah_uuid = public.sekolah_saya_sebagai_verifikator());
ALTER POLICY cga_verifikator_update ON public.cloud_guru_attendance
  USING (sekolah_uuid = public.sekolah_saya_sebagai_verifikator());

CREATE POLICY cga_verifikator_insert ON public.cloud_guru_attendance FOR INSERT
  WITH CHECK (
    sekolah_uuid = public.sekolah_saya_sebagai_verifikator()
    AND EXISTS (
      SELECT 1 FROM public.cloud_guru_teachers t
      WHERE t.user_id = cloud_guru_attendance.user_id AND t.sekolah_uuid = cloud_guru_attendance.sekolah_uuid
    )
  );

CREATE OR REPLACE FUNCTION public.jaga_status_izin()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  ks BOOLEAN;
BEGIN
  IF auth.uid() IS NULL THEN RETURN NEW; END IF;
  ks := public.sekolah_saya_sebagai_verifikator() IS NOT DISTINCT FROM NEW.sekolah_uuid
        AND public.sekolah_saya_sebagai_verifikator() IS NOT NULL;

  IF auth.uid() = NEW.user_id THEN
    -- Guru biasa hanya boleh mengajukan; KS boleh langsung menyetujui izinnya sendiri.
    IF ks THEN RETURN NEW; END IF;
    IF TG_OP = 'INSERT' THEN
      IF NEW.status_izin IS NOT NULL AND NEW.status_izin <> 'proses' THEN NEW.status_izin := 'proses'; END IF;
    ELSIF NEW.status_izin IS DISTINCT FROM OLD.status_izin AND NEW.status_izin IS DISTINCT FROM 'proses' THEN
      NEW.status_izin := OLD.status_izin;
    END IF;
  ELSIF ks AND NEW.sekolah_uuid IS DISTINCT FROM public.sekolah_milik_saya() AND TG_OP = 'UPDATE' THEN
    -- KS mengubah data guru lain: bukti & identitas tetap seperti semula.
    NEW.user_id := OLD.user_id;
    NEW.sekolah_uuid := OLD.sekolah_uuid;
    NEW.local_id := OLD.local_id;
    NEW.guru_id := OLD.guru_id;
    NEW.tanggal := OLD.tanggal;
    NEW.selfie_masuk_url := OLD.selfie_masuk_url;
    NEW.selfie_pulang_url := OLD.selfie_pulang_url;
    NEW.lokasi_masuk_lat := OLD.lokasi_masuk_lat;
    NEW.lokasi_masuk_lng := OLD.lokasi_masuk_lng;
    NEW.lokasi_pulang_lat := OLD.lokasi_pulang_lat;
    NEW.lokasi_pulang_lng := OLD.lokasi_pulang_lng;
    NEW.jarak_masuk_meter := OLD.jarak_masuk_meter;
    NEW.jarak_pulang_meter := OLD.jarak_pulang_meter;
    NEW.verifikasi_masuk := OLD.verifikasi_masuk;
    NEW.verifikasi_pulang := OLD.verifikasi_pulang;
  END IF;
  RETURN NEW;
END $$;
