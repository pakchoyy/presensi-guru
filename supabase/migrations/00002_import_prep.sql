-- ============================================
-- MIGRATION 00002: PREPARE FOR CONVEX IMPORT
-- ============================================

BEGIN;

-- 1. Drop FK on profiles so we can import profiles without auth.users
ALTER TABLE public.profiles DROP CONSTRAINT IF EXISTS profiles_id_fkey;

-- 2. Update trigger to UPSERT (handle existing profiles from import)
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (id, email, name, tier)
  VALUES (
    NEW.id,
    COALESCE(NEW.email, NEW.raw_user_meta_data->>'email', ''),
    COALESCE(NEW.raw_user_meta_data->>'name', split_part(NEW.email, '@', 1)),
    COALESCE(NEW.raw_user_meta_data->>'tier', 'FREE')
  )
  ON CONFLICT (email) DO UPDATE SET
    id = EXCLUDED.id,
    updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 3. Add unique constraint on profiles.email for the UPSERT
ALTER TABLE public.profiles ADD CONSTRAINT IF NOT EXISTS profiles_email_unique UNIQUE (email);

-- 4. Disable identity auto-gen on cloud tables (allow manual local_id insert)
-- We'll use local_id values directly from the backup
COMMENT ON TABLE public.cloud_schools IS 'Imported from Convex backup';
COMMENT ON TABLE public.cloud_teachers IS 'Imported from Convex backup';
COMMENT ON TABLE public.cloud_academic_years IS 'Imported from Convex backup';
COMMENT ON TABLE public.cloud_classrooms IS 'Imported from Convex backup';
COMMENT ON TABLE public.cloud_students IS 'Imported from Convex backup';
COMMENT ON TABLE public.cloud_attendance_sessions IS 'Imported from Convex backup';
COMMENT ON TABLE public.cloud_attendance_records IS 'Imported from Convex backup';
COMMENT ON TABLE public.cloud_calendar_entries IS 'Imported from Convex backup';
COMMENT ON TABLE public.cloud_backups IS 'Imported from Convex backup';
COMMENT ON TABLE public.cloud_tombstones IS 'Imported from Convex backup';
COMMENT ON TABLE public.sync_metadata IS 'Imported from Convex backup';

COMMIT;
