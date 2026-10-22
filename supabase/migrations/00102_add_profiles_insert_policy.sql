-- Fix: device linking inserts a profile row on demand, but RLS had no INSERT policy.
-- Without this, handleDeviceLogin creates a license/profile but the insert is silently
-- blocked, so CloudAuthContext finds no profile and the "Hubungkan" form keeps showing.
DROP POLICY IF EXISTS pol_profiles_insert ON public.profiles;
CREATE POLICY pol_profiles_insert ON public.profiles
  FOR INSERT
  WITH CHECK (true);
