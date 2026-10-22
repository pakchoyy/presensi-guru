-- Tabel licenses hanya diakses lewat server (api/license.js, service-role key).
-- Jalankan SETELAH api/license.js ter-deploy dan aktivasi sudah dites.
DROP POLICY IF EXISTS pol_licenses ON public.licenses;
DROP POLICY IF EXISTS "Licenses readable by authenticated users" ON public.licenses;
DROP POLICY IF EXISTS "Licenses insert by admin only" ON public.licenses;
DROP POLICY IF EXISTS "Licenses update by admin" ON public.licenses;
ALTER TABLE public.licenses ENABLE ROW LEVEL SECURITY;
-- Tanpa policy = anon/authenticated tidak bisa baca/ubah; service-role tetap bisa (bypass RLS).
