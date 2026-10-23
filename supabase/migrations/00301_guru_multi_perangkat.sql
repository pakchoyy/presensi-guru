-- =========================================================================
--  00301_guru_multi_perangkat — guru absen dari HP masing-masing.
--
--  Sebelumnya data guru & absen hanya ada di perangkat admin. Migrasi ini:
--   1. Menambah "sekolah cloud" yang DIMILIKI akun admin (owner_user_id).
--      Kepemilikan diikat ke auth.uid(), bukan ke sekolah_id lokal, karena
--      sekolah_id = Date.now()+acak sehingga bisa ditebak.
--   2. Menutup celah: guru dulu boleh UPDATE baris cloud_guru_teachers miliknya
--      sendiri — termasuk kolom role & sekolah_id — sehingga bisa menjadikan
--      dirinya admin. Sekarang semua penulisan data guru lewat Edge Function
--      (service_role); admin hanya boleh mengubah kolom aman.
--   3. Absen guru bisa ditulis guru sendiri dan dibaca/diubah admin sekolahnya.
--   4. Bucket Storage privat untuk selfie: <sekolah_uuid>/<user_id>/<file>.
-- =========================================================================

-- ---------- 1. Sekolah cloud --------------------------------------------
CREATE TABLE IF NOT EXISTS public.cloud_guru_sekolah (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_user_id   UUID NOT NULL UNIQUE REFERENCES auth.users(id) ON DELETE CASCADE,
  local_id        BIGINT NOT NULL,
  nama            TEXT NOT NULL,
  lat             DOUBLE PRECISION,
  lng             DOUBLE PRECISION,
  radius_meter    INT  NOT NULL DEFAULT 100,
  jam_masuk       TEXT NOT NULL DEFAULT '07:00',
  jam_pulang      TEXT NOT NULL DEFAULT '13:00',
  toleransi_menit INT  NOT NULL DEFAULT 15,
  hari_aktif      TEXT NOT NULL DEFAULT '1,2,3,4,5,6',
  diubah_pada     BIGINT NOT NULL DEFAULT 0,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.cloud_guru_sekolah ENABLE ROW LEVEL SECURITY;

-- ---------- 2. Relasi ke sekolah cloud -----------------------------------
ALTER TABLE public.cloud_guru_teachers
  ADD COLUMN IF NOT EXISTS sekolah_uuid UUID REFERENCES public.cloud_guru_sekolah(id) ON DELETE CASCADE;
ALTER TABLE public.cloud_guru_attendance
  ADD COLUMN IF NOT EXISTS sekolah_uuid UUID REFERENCES public.cloud_guru_sekolah(id) ON DELETE CASCADE;

-- Satu baris absen per guru per tanggal (kunci upsert dari perangkat guru).
CREATE UNIQUE INDEX IF NOT EXISTS uq_cga_user_tanggal
  ON public.cloud_guru_attendance (user_id, tanggal);
CREATE INDEX IF NOT EXISTS ix_cga_sekolah_tanggal
  ON public.cloud_guru_attendance (sekolah_uuid, tanggal);
CREATE INDEX IF NOT EXISTS ix_cgt_sekolah_uuid
  ON public.cloud_guru_teachers (sekolah_uuid);

-- ---------- 3. Helper identitas (SECURITY DEFINER, tanpa loop RLS) --------
CREATE OR REPLACE FUNCTION public.sekolah_milik_saya()
RETURNS UUID LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT id FROM cloud_guru_sekolah WHERE owner_user_id = auth.uid() LIMIT 1;
$$;

CREATE OR REPLACE FUNCTION public.sekolah_saya_sebagai_guru()
RETURNS UUID LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT sekolah_uuid FROM cloud_guru_teachers
   WHERE user_id = auth.uid() AND status_aktif = true
   LIMIT 1;
$$;

CREATE OR REPLACE FUNCTION public.guru_di_sekolah_saya(p_user UUID)
RETURNS BOOLEAN LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (
    SELECT 1 FROM cloud_guru_teachers t
     WHERE t.user_id = p_user
       AND t.sekolah_uuid IS NOT NULL
       AND t.sekolah_uuid = (SELECT id FROM cloud_guru_sekolah WHERE owner_user_id = auth.uid())
  );
$$;

REVOKE EXECUTE ON FUNCTION public.sekolah_milik_saya()        FROM anon, PUBLIC;
REVOKE EXECUTE ON FUNCTION public.sekolah_saya_sebagai_guru() FROM anon, PUBLIC;
REVOKE EXECUTE ON FUNCTION public.guru_di_sekolah_saya(UUID)  FROM anon, PUBLIC;
GRANT  EXECUTE ON FUNCTION public.sekolah_milik_saya()        TO authenticated, service_role;
GRANT  EXECUTE ON FUNCTION public.sekolah_saya_sebagai_guru() TO authenticated, service_role;
GRANT  EXECUTE ON FUNCTION public.guru_di_sekolah_saya(UUID)  TO authenticated, service_role;
-- Tanpa login auth.uid() = NULL, jadi helper selalu NULL/false: aman, dan anon
-- mendapat hasil kosong (bukan "permission denied") saat policy dievaluasi.
GRANT  EXECUTE ON FUNCTION public.sekolah_milik_saya()        TO anon;
GRANT  EXECUTE ON FUNCTION public.sekolah_saya_sebagai_guru() TO anon;
GRANT  EXECUTE ON FUNCTION public.guru_di_sekolah_saya(UUID)  TO anon;

-- ---------- 4. Policy cloud_guru_sekolah ---------------------------------
CREATE POLICY cgs_select ON public.cloud_guru_sekolah FOR SELECT TO authenticated
  USING (owner_user_id = auth.uid() OR id = public.sekolah_saya_sebagai_guru());
CREATE POLICY cgs_insert ON public.cloud_guru_sekolah FOR INSERT TO authenticated
  WITH CHECK (owner_user_id = auth.uid());
CREATE POLICY cgs_update ON public.cloud_guru_sekolah FOR UPDATE TO authenticated
  USING (owner_user_id = auth.uid()) WITH CHECK (owner_user_id = auth.uid());

-- ---------- 5. Policy cloud_guru_teachers (tutup celah) ------------------
-- Catatan: di proyek ini DROP/REVOKE lewat alat migrasi tertahan konfirmasi,
-- jadi policy lama DIUBAH di tempat (ALTER POLICY) dan pembatasan kolom
-- memakai trigger. Hasil keamanannya setara dengan drop + revoke kolom.

-- Guru tidak boleh lagi membuat/menghapus baris guru (hanya service_role).
ALTER POLICY cgt_insert_own ON public.cloud_guru_teachers WITH CHECK (false);
ALTER POLICY cgt_delete_own ON public.cloud_guru_teachers USING (false);

-- UPDATE: dulu guru boleh ubah barisnya sendiri (termasuk role!).
-- Sekarang hanya admin pemilik sekolah.
ALTER POLICY cgt_update_own ON public.cloud_guru_teachers
  USING (sekolah_uuid IS NOT NULL AND sekolah_uuid = public.sekolah_milik_saya())
  WITH CHECK (sekolah_uuid IS NOT NULL AND sekolah_uuid = public.sekolah_milik_saya());
ALTER POLICY cgt_update_own ON public.cloud_guru_teachers RENAME TO cgt_admin_update;

ALTER POLICY cgt_admin_select_school ON public.cloud_guru_teachers
  USING (sekolah_uuid IS NOT NULL AND sekolah_uuid = public.sekolah_milik_saya());
ALTER POLICY cgt_admin_select_school ON public.cloud_guru_teachers RENAME TO cgt_admin_select;

-- Kolom identitas & hak akses hanya boleh diubah service_role.
CREATE OR REPLACE FUNCTION public.jaga_kolom_guru()
RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
  IF coalesce(auth.role(), '') <> 'service_role' AND (
       NEW.user_id      IS DISTINCT FROM OLD.user_id
    OR NEW.sekolah_id   IS DISTINCT FROM OLD.sekolah_id
    OR NEW.sekolah_uuid IS DISTINCT FROM OLD.sekolah_uuid
    OR NEW.role         IS DISTINCT FROM OLD.role
    OR NEW.kode_login   IS DISTINCT FROM OLD.kode_login
    OR NEW.local_id     IS DISTINCT FROM OLD.local_id
    OR NEW.absen_token  IS DISTINCT FROM OLD.absen_token
    OR NEW.tier         IS DISTINCT FROM OLD.tier
  ) THEN
    RAISE EXCEPTION 'kolom ini hanya boleh diubah lewat server';
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_jaga_kolom_guru
  BEFORE UPDATE ON public.cloud_guru_teachers
  FOR EACH ROW EXECUTE FUNCTION public.jaga_kolom_guru();

-- ---------- 6. Policy cloud_guru_attendance ------------------------------
ALTER POLICY cga_select_own ON public.cloud_guru_attendance
  USING (
    user_id = auth.uid()
    OR (sekolah_uuid IS NOT NULL AND sekolah_uuid = public.sekolah_milik_saya())
  );
ALTER POLICY cga_select_own ON public.cloud_guru_attendance RENAME TO cga_select;

-- Guru menulis absennya sendiri (hanya untuk sekolah tempat dia aktif);
-- admin menulis absen guru di sekolahnya (isi jam manual / status).
ALTER POLICY cga_insert_own ON public.cloud_guru_attendance
  WITH CHECK (
    (user_id = auth.uid() AND sekolah_uuid = public.sekolah_saya_sebagai_guru())
    OR (sekolah_uuid = public.sekolah_milik_saya() AND public.guru_di_sekolah_saya(user_id))
  );
ALTER POLICY cga_insert_own ON public.cloud_guru_attendance RENAME TO cga_insert;

ALTER POLICY cga_update_own ON public.cloud_guru_attendance
  USING (
    (user_id = auth.uid() AND sekolah_uuid = public.sekolah_saya_sebagai_guru())
    OR (sekolah_uuid IS NOT NULL AND sekolah_uuid = public.sekolah_milik_saya())
  )
  WITH CHECK (
    (user_id = auth.uid() AND sekolah_uuid = public.sekolah_saya_sebagai_guru())
    OR (sekolah_uuid = public.sekolah_milik_saya() AND public.guru_di_sekolah_saya(user_id))
  );
ALTER POLICY cga_update_own ON public.cloud_guru_attendance RENAME TO cga_update;

-- Tidak ada yang menghapus absen dari klien (batal izin = update status_hari).
ALTER POLICY cga_delete_own ON public.cloud_guru_attendance USING (false);

-- ---------- 7. Storage selfie --------------------------------------------
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES ('selfie-guru', 'selfie-guru', false, 1048576, ARRAY['image/jpeg'])
ON CONFLICT (id) DO NOTHING;

-- Path wajib: <sekolah_uuid>/<user_id>/<nama-file>.jpg
CREATE POLICY selfie_guru_insert ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'selfie-guru'
    AND (storage.foldername(name))[1] = public.sekolah_saya_sebagai_guru()::text
    AND (storage.foldername(name))[2] = auth.uid()::text
  );
CREATE POLICY selfie_guru_update ON storage.objects FOR UPDATE TO authenticated
  USING (
    bucket_id = 'selfie-guru'
    AND (storage.foldername(name))[2] = auth.uid()::text
  )
  WITH CHECK (
    bucket_id = 'selfie-guru'
    AND (storage.foldername(name))[1] = public.sekolah_saya_sebagai_guru()::text
    AND (storage.foldername(name))[2] = auth.uid()::text
  );
CREATE POLICY selfie_guru_select ON storage.objects FOR SELECT TO authenticated
  USING (
    bucket_id = 'selfie-guru'
    AND (
      (storage.foldername(name))[2] = auth.uid()::text
      OR (storage.foldername(name))[1] = public.sekolah_milik_saya()::text
    )
  );
