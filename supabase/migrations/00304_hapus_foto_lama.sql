-- Foto selfie presensi hanya disimpan 7 hari: tiap hari 02:17 WIB (19:17 UTC)
-- pg_cron memanggil Edge Function hapus-foto-lama.
CREATE OR REPLACE FUNCTION public.jalankan_hapus_foto_lama()
RETURNS bigint
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'extensions'
AS $$
DECLARE
  kunci TEXT;
  req_id BIGINT;
BEGIN
  SELECT value INTO kunci FROM public.app_secrets WHERE name = 'reminder_key';
  IF kunci IS NULL THEN
    RAISE EXCEPTION 'reminder_key belum diset di app_secrets';
  END IF;
  SELECT net.http_post(
    url     := 'https://ikemxrcimsqsbbnuhkld.supabase.co/functions/v1/hapus-foto-lama',
    headers := jsonb_build_object('Content-Type', 'application/json', 'x-reminder-key', kunci),
    body    := '{}'::jsonb
  ) INTO req_id;
  RETURN req_id;
END;
$$;

REVOKE ALL ON FUNCTION public.jalankan_hapus_foto_lama() FROM PUBLIC, anon, authenticated;

SELECT cron.schedule('hapus-foto-lama', '17 19 * * *', 'SELECT public.jalankan_hapus_foto_lama();');
