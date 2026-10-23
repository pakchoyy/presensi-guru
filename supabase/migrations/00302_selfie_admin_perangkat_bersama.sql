-- =========================================================================
--  00302 — absen di perangkat bersama (HP admin) ikut terkirim ke cloud.
--  Admin mengunggah selfie guru sekolahnya ke path yang sama dengan HP guru:
--  <sekolah_uuid>/<user_id_guru>/<file>. Guru itu harus terdaftar di sekolah
--  milik admin.
-- =========================================================================
CREATE POLICY selfie_admin_insert ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'selfie-guru'
    AND (storage.foldername(name))[1] = public.sekolah_milik_saya()::text
    AND public.guru_di_sekolah_saya(((storage.foldername(name))[2])::uuid)
  );
CREATE POLICY selfie_admin_update ON storage.objects FOR UPDATE TO authenticated
  USING (
    bucket_id = 'selfie-guru'
    AND (storage.foldername(name))[1] = public.sekolah_milik_saya()::text
  )
  WITH CHECK (
    bucket_id = 'selfie-guru'
    AND (storage.foldername(name))[1] = public.sekolah_milik_saya()::text
    AND public.guru_di_sekolah_saya(((storage.foldername(name))[2])::uuid)
  );
