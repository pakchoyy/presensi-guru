-- Fix: profiles.id previously had no column default. Anonymous (non-auth) flows that
-- create a profile on demand must supply an id; adding a default makes any insert
-- robust against missing id.
ALTER TABLE public.profiles ALTER COLUMN id SET DEFAULT gen_random_uuid();

-- Ensure the INSERT policy exists (idempotent; also added in 00102).
DROP POLICY IF EXISTS pol_profiles_insert ON public.profiles;
CREATE POLICY pol_profiles_insert ON public.profiles
  FOR INSERT
  WITH CHECK (true);