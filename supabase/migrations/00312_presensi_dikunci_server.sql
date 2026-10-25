-- Presensi dikunci di server (temuan audit 1, 3, 4, 8).
-- * Jam masuk/pulang selalu diisi jam server (zona sekolah), bukan jam HP.
-- * Jarak dihitung ulang dari lokasi, status dihitung dari setelan sekolah.
-- * Bukti (selfie, lokasi, jarak, verifikasi wajah) hanya berubah bersama presensi baru.
-- * Admin / perangkat bersama diperlakukan sama dengan guru: tidak bisa mengubah status
--   atau memutus izin. Hanya Kepala Sekolah yang mengoreksi, tanpa bisa mengarang bukti.
-- * Paket sekolah dihitung server dari lisensi + tanggal sekolah terdaftar (masa coba 30 hari).
-- Service role (api/clockin, edge function) tidak dibatasi: auth.uid() NULL.

ALTER TABLE public.cloud_guru_sekolah ADD COLUMN IF NOT EXISTS tz_menit integer;

CREATE OR REPLACE FUNCTION public.jarak_meter(lat1 float8, lng1 float8, lat2 float8, lng2 float8)
RETURNS integer LANGUAGE sql IMMUTABLE AS $$
  SELECT round(2 * 6371000 * asin(sqrt(
    power(sin(radians(lat2 - lat1) / 2), 2)
    + cos(radians(lat1)) * cos(radians(lat2)) * power(sin(radians(lng2 - lng1) / 2), 2)
  )))::integer
$$;

CREATE OR REPLACE FUNCTION public.jaga_status_izin()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  verif uuid;
  s public.cloud_guru_sekolah%ROWTYPE;
  lama public.cloud_guru_attendance%ROWTYPE;
  kini timestamp;
  jam_kini time;
  masuk_baru boolean;
  pulang_baru boolean;
BEGIN
  IF auth.uid() IS NULL THEN RETURN NEW; END IF;
  verif := public.sekolah_saya_sebagai_verifikator();

  -- Kepala Sekolah mengoreksi guru lain: jam/status boleh, bukti tidak.
  IF verif IS NOT NULL AND verif = NEW.sekolah_uuid AND auth.uid() <> NEW.user_id THEN
    IF TG_OP = 'INSERT' THEN
      NEW.selfie_masuk_url := NULL; NEW.selfie_pulang_url := NULL; NEW.izin_foto_url := NULL;
      NEW.lokasi_masuk_lat := NULL; NEW.lokasi_masuk_lng := NULL;
      NEW.lokasi_pulang_lat := NULL; NEW.lokasi_pulang_lng := NULL;
      NEW.jarak_masuk_meter := NULL; NEW.jarak_pulang_meter := NULL;
      NEW.verifikasi_masuk := NULL; NEW.verifikasi_pulang := NULL;
    ELSE
      NEW.user_id := OLD.user_id; NEW.sekolah_uuid := OLD.sekolah_uuid; NEW.local_id := OLD.local_id;
      NEW.guru_id := OLD.guru_id; NEW.tanggal := OLD.tanggal;
      NEW.selfie_masuk_url := OLD.selfie_masuk_url; NEW.selfie_pulang_url := OLD.selfie_pulang_url;
      NEW.izin_foto_url := OLD.izin_foto_url;
      NEW.lokasi_masuk_lat := OLD.lokasi_masuk_lat; NEW.lokasi_masuk_lng := OLD.lokasi_masuk_lng;
      NEW.lokasi_pulang_lat := OLD.lokasi_pulang_lat; NEW.lokasi_pulang_lng := OLD.lokasi_pulang_lng;
      NEW.jarak_masuk_meter := OLD.jarak_masuk_meter; NEW.jarak_pulang_meter := OLD.jarak_pulang_meter;
      NEW.verifikasi_masuk := OLD.verifikasi_masuk; NEW.verifikasi_pulang := OLD.verifikasi_pulang;
    END IF;
    RETURN NEW;
  END IF;

  -- Guru sendiri, atau admin lewat perangkat bersama.
  IF TG_OP = 'INSERT' THEN
    SELECT * INTO lama FROM cloud_guru_attendance WHERE user_id = NEW.user_id AND tanggal = NEW.tanggal;
    IF FOUND THEN RETURN NEW; END IF; -- upsert ke baris yang ada: diurus cabang UPDATE
  ELSE
    lama := OLD;
    NEW.user_id := OLD.user_id; NEW.sekolah_uuid := OLD.sekolah_uuid; NEW.local_id := OLD.local_id;
    NEW.guru_id := OLD.guru_id; NEW.tanggal := OLD.tanggal;
  END IF;

  SELECT * INTO s FROM cloud_guru_sekolah WHERE id = NEW.sekolah_uuid;
  kini := (now() AT TIME ZONE 'UTC') + make_interval(mins => coalesce(s.tz_menit, 420));
  jam_kini := date_trunc('second', kini)::time;
  -- Kirim ulang baris yang sama (jam dalam 5 menit dari tersimpan) bukan presensi baru.
  masuk_baru := NEW.jam_masuk IS NOT NULL AND (lama.jam_masuk IS NULL
    OR abs(extract(epoch FROM NEW.jam_masuk - lama.jam_masuk)) > 300);
  pulang_baru := NEW.jam_pulang IS NOT NULL AND (lama.jam_pulang IS NULL
    OR abs(extract(epoch FROM NEW.jam_pulang - lama.jam_pulang)) > 300);

  IF masuk_baru OR pulang_baru THEN
    IF NEW.tanggal <> kini::date THEN
      RAISE EXCEPTION 'PRESENSI: presensi hanya bisa dikirim di hari yang sama';
    END IF;
    IF NOT (extract(dow FROM NEW.tanggal)::int::text = ANY (string_to_array(coalesce(s.hari_aktif, '1,2,3,4,5,6'), ',')))
       OR NEW.tanggal::text = ANY (string_to_array(coalesce(s.libur, ''), ',')) THEN
      RAISE EXCEPTION 'PRESENSI: hari ini libur, presensi tidak dibuka';
    END IF;
  END IF;

  IF masuk_baru THEN
    IF lama.jam_pulang IS NOT NULL THEN RAISE EXCEPTION 'PRESENSI: sudah presensi pulang'; END IF;
    IF jam_kini < coalesce(s.mulai_masuk::time, coalesce(s.jam_masuk, '07:00')::time - interval '60 minutes') THEN
      RAISE EXCEPTION 'PRESENSI: presensi masuk belum dibuka';
    END IF;
    NEW.jam_masuk := jam_kini;
    NEW.jarak_masuk_meter := CASE WHEN NEW.lokasi_masuk_lat IS NULL OR s.lat IS NULL THEN NULL
      ELSE public.jarak_meter(NEW.lokasi_masuk_lat, NEW.lokasi_masuk_lng, s.lat, s.lng) END;
    NEW.status_masuk := CASE
      WHEN NEW.jarak_masuk_meter > coalesce(s.radius_meter, 100) THEN 'FAR'
      WHEN jam_kini <= coalesce(s.jam_masuk, '07:00')::time + make_interval(mins => coalesce(s.toleransi_menit, 15)) THEN 'ONTIME'
      ELSE 'LATE' END;
  ELSE
    NEW.jam_masuk := lama.jam_masuk; NEW.status_masuk := lama.status_masuk;
    NEW.selfie_masuk_url := lama.selfie_masuk_url; NEW.verifikasi_masuk := lama.verifikasi_masuk;
    NEW.lokasi_masuk_lat := lama.lokasi_masuk_lat; NEW.lokasi_masuk_lng := lama.lokasi_masuk_lng;
    NEW.jarak_masuk_meter := lama.jarak_masuk_meter;
  END IF;

  IF pulang_baru THEN
    IF NEW.jam_masuk IS NULL THEN RAISE EXCEPTION 'PRESENSI: belum presensi masuk'; END IF;
    IF jam_kini > coalesce(s.batas_pulang::time, coalesce(s.jam_pulang, '15:00')::time + interval '180 minutes') THEN
      RAISE EXCEPTION 'PRESENSI: presensi pulang sudah ditutup';
    END IF;
    NEW.jam_pulang := jam_kini;
    NEW.jarak_pulang_meter := CASE WHEN NEW.lokasi_pulang_lat IS NULL OR s.lat IS NULL THEN NULL
      ELSE public.jarak_meter(NEW.lokasi_pulang_lat, NEW.lokasi_pulang_lng, s.lat, s.lng) END;
    -- 'LATE' untuk pulang = pulang cepat (EARLY di aplikasi).
    NEW.status_pulang := CASE
      WHEN NEW.jarak_pulang_meter > coalesce(s.radius_meter, 100) THEN 'FAR'
      WHEN jam_kini < coalesce(s.jam_pulang, '15:00')::time THEN 'LATE'
      ELSE 'ONTIME' END;
  ELSE
    NEW.jam_pulang := lama.jam_pulang; NEW.status_pulang := lama.status_pulang;
    NEW.selfie_pulang_url := lama.selfie_pulang_url; NEW.verifikasi_pulang := lama.verifikasi_pulang;
    NEW.lokasi_pulang_lat := lama.lokasi_pulang_lat; NEW.lokasi_pulang_lng := lama.lokasi_pulang_lng;
    NEW.jarak_pulang_meter := lama.jarak_pulang_meter;
  END IF;

  -- Izin hanya diajukan (S/I) atau dibatalkan; keputusan milik Kepala Sekolah.
  IF NEW.status_hari IS DISTINCT FROM lama.status_hari AND NEW.status_hari IS NOT NULL AND NEW.status_hari NOT IN ('S', 'I') THEN
    NEW.status_hari := lama.status_hari;
  END IF;
  IF NEW.status_izin IS DISTINCT FROM lama.status_izin AND NEW.status_izin IS DISTINCT FROM 'proses' THEN
    NEW.status_izin := CASE WHEN TG_OP = 'INSERT' AND NEW.status_izin IS NOT NULL THEN 'proses' ELSE lama.status_izin END;
  END IF;
  RETURN NEW;
END $$;

-- Paket sekolah: dihitung server, klien tidak bisa menulisnya.
CREATE OR REPLACE FUNCTION public.hitung_paket_sekolah()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  surel text;
  lis record;
  sekarang bigint := (extract(epoch FROM now()) * 1000)::bigint;
  coba_sampai bigint;
BEGIN
  IF coalesce(auth.role(), '') <> 'service_role' THEN
    IF TG_OP = 'INSERT' THEN NEW.created_at := now();
    ELSE NEW.created_at := OLD.created_at; NEW.owner_user_id := OLD.owner_user_id;
    END IF;
  END IF;
  SELECT lower(email) INTO surel FROM auth.users WHERE id = NEW.owner_user_id;
  SELECT tier, tanggal_berakhir INTO lis FROM licenses
   WHERE lower(email) = surel AND product = 'guru' AND status = 'digunakan'
   ORDER BY tanggal_berakhir DESC NULLS LAST LIMIT 1;
  coba_sampai := (extract(epoch FROM coalesce(NEW.created_at, now())) * 1000)::bigint + 30::bigint * 86400000;
  IF lis.tanggal_berakhir IS NOT NULL AND lis.tanggal_berakhir > sekarang THEN
    NEW.paket := CASE WHEN lis.tier = 'PLUS' THEN 'PLUS' ELSE 'PRO' END;
    NEW.paket_sampai := lis.tanggal_berakhir;
  ELSIF coba_sampai > sekarang THEN
    NEW.paket := 'PRO'; NEW.paket_sampai := coba_sampai;
  ELSE
    NEW.paket := 'FREE'; NEW.paket_sampai := NULL;
  END IF;
  RETURN NEW;
END $$;

CREATE TRIGGER trg_hitung_paket_sekolah
  BEFORE INSERT OR UPDATE ON public.cloud_guru_sekolah
  FOR EACH ROW EXECUTE FUNCTION public.hitung_paket_sekolah();

-- Isi ulang paket semua sekolah dari lisensi (nilai lama ditulis klien).
UPDATE public.cloud_guru_sekolah SET diubah_pada = diubah_pada;
