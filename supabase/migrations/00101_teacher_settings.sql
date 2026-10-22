-- Teacher settings for PRO cloud-synced preferences
CREATE TABLE IF NOT EXISTS public.teacher_settings (
  email TEXT PRIMARY KEY,
  hari_aktif_mode TEXT NOT NULL DEFAULT 'Senin-Sabtu',
  hari_aktif_custom TEXT,
  updated_at BIGINT NOT NULL DEFAULT 0
);

ALTER TABLE public.teacher_settings ENABLE ROW LEVEL SECURITY;

CREATE POLICY pol_teacher_settings_select ON public.teacher_settings FOR SELECT USING (true);
CREATE POLICY pol_teacher_settings_insert ON public.teacher_settings FOR INSERT WITH CHECK (true);
CREATE POLICY pol_teacher_settings_update ON public.teacher_settings FOR UPDATE USING (true) WITH CHECK (true);
