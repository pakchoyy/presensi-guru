-- =========================================================================
--  00201_nip_login — Login guru mandiri via kode (NIP/NUPTK/G-XXXX) + PIN.
--  Guru TIDAK register mandiri. Ops / Kepala Sekolah mendaftarkan via halaman
--  Daftar Guru → Edge Function `create-guru-account` memprovisioning akun
--  auth.users sintetis ber-email `${kode}@guru.local` + password = PIN.
-- =========================================================================

-- 1) Expand role check: tambahkan 'kepala' & 'operator' sebagai sinonim admin.
ALTER TABLE cloud_guru_teachers
  DROP CONSTRAINT IF EXISTS cloud_guru_teachers_role_check;
ALTER TABLE cloud_guru_teachers
  ADD CONSTRAINT cloud_guru_teachers_role_check
  CHECK (role IN ('admin','guru','kepala','operator'));

-- 2) Tambah kolom kode_login — kode yang dipakai guru untuk login mandiri.
--    Nullable supaya migrasi data lama tetap aman; UNIQUE partial agar bisa
--    diisi belakangan tanpa menabrak baris yang belum ada kodenya.
ALTER TABLE cloud_guru_teachers
  ADD COLUMN IF NOT EXISTS kode_login TEXT;

CREATE UNIQUE INDEX IF NOT EXISTS uq_cgt_kode_login
  ON cloud_guru_teachers (kode_login)
  WHERE kode_login IS NOT NULL;

-- Backfill: untuk baris yang punya NIP tapi belum punya kode_login, pakai NIP.
UPDATE cloud_guru_teachers
   SET kode_login = nip
 WHERE kode_login IS NULL AND nip IS NOT NULL AND nip <> '';

-- 3) RPC lookup kode_login → auth user_id tanpa expose PII.
--    Dipanggil Edge Function provisioning untuk cek konflik sebelum createUser.
CREATE OR REPLACE FUNCTION public.guru_user_by_kode(p_kode TEXT)
RETURNS TABLE (user_id UUID, nama TEXT, nip TEXT, sekolah_id BIGINT)
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT user_id, nama, nip, sekolah_id
    FROM cloud_guru_teachers
   WHERE kode_login = p_kode
     AND status_aktif = true
   LIMIT 1;
$$;

REVOKE ALL ON FUNCTION public.guru_user_by_kode(TEXT) FROM public;
GRANT EXECUTE ON FUNCTION public.guru_user_by_kode(TEXT) TO service_role;

-- 4) Policy tambahan: admin (role 'admin'|'kepala'|'operator') boleh SELECT
--    semua baris di sekolah_id yang sama. (Insert/update tetap scoped user_id
--    karena provisioning dijalankan oleh Edge Function via service_role.)
DROP POLICY IF EXISTS cgt_admin_select_school ON cloud_guru_teachers;
CREATE POLICY cgt_admin_select_school ON cloud_guru_teachers
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM cloud_guru_teachers me
       WHERE me.user_id = auth.uid()
         AND me.role IN ('admin','kepala','operator')
         AND me.sekolah_id = cloud_guru_teachers.sekolah_id
    )
  );

-- =========================================================================
-- CATATAN:
--   * Password/PIN TIDAK disimpan di tabel public. Password hash dikelola oleh
--     Supabase Auth (bcrypt) via auth.users. Edge Function `reset-guru-pin`
--     memakai service_role untuk auth.admin.updateUserById.
--   * Kode default yang di-generate di client adalah `G-XXXX` (4 digit random).
--     Admin bebas override dengan NIP, NUPTK, atau nomor urut sekolah.
--   * Email sintetis `${kode}@guru.local` memakai domain `.local` reserved RFC
--     6762 — tidak pernah bentrok dengan email publik.
-- =========================================================================
