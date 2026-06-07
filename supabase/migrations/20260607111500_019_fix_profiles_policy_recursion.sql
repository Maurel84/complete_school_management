/*
  # Fix recursive profiles policies

  The profiles table cannot authorize itself by querying profiles again inside
  the policy expression. These helper functions run as the migration owner and
  provide the current user's school and role without triggering profiles RLS.
*/

CREATE OR REPLACE FUNCTION public.current_profile_school_id()
RETURNS uuid
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = public
AS $$
  SELECT school_id
  FROM profiles
  WHERE id = auth.uid()
$$;

CREATE OR REPLACE FUNCTION public.current_profile_role_name()
RETURNS text
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = public
AS $$
  SELECT r.name
  FROM profiles p
  JOIN roles r ON p.role_id = r.id
  WHERE p.id = auth.uid()
$$;

GRANT EXECUTE ON FUNCTION public.current_profile_school_id() TO authenticated;
GRANT EXECUTE ON FUNCTION public.current_profile_role_name() TO authenticated;

DROP POLICY IF EXISTS "Users can view profiles" ON profiles;
DROP POLICY IF EXISTS "Users can view profiles in their school" ON profiles;
DROP POLICY IF EXISTS "Users can update own profile" ON profiles;
DROP POLICY IF EXISTS "Admins can insert profiles" ON profiles;
DROP POLICY IF EXISTS "Admins can update profiles" ON profiles;
DROP POLICY IF EXISTS "Admins can delete profiles" ON profiles;

CREATE POLICY "Users can view own profile"
  ON profiles FOR SELECT TO authenticated
  USING (id = auth.uid());

CREATE POLICY "Admins can view school profiles"
  ON profiles FOR SELECT TO authenticated
  USING (
    public.current_profile_role_name() = 'super_admin'
    OR (
      school_id = public.current_profile_school_id()
      AND public.current_profile_role_name() IN ('admin', 'director')
    )
  );

CREATE POLICY "Users can update own profile"
  ON profiles FOR UPDATE TO authenticated
  USING (id = auth.uid())
  WITH CHECK (id = auth.uid());

CREATE POLICY "Admins can insert profiles"
  ON profiles FOR INSERT TO authenticated
  WITH CHECK (
    public.current_profile_role_name() = 'super_admin'
    OR (
      school_id = public.current_profile_school_id()
      AND public.current_profile_role_name() = 'admin'
    )
  );

CREATE POLICY "Admins can update profiles"
  ON profiles FOR UPDATE TO authenticated
  USING (
    public.current_profile_role_name() = 'super_admin'
    OR (
      school_id = public.current_profile_school_id()
      AND public.current_profile_role_name() = 'admin'
    )
  )
  WITH CHECK (
    public.current_profile_role_name() = 'super_admin'
    OR (
      school_id = public.current_profile_school_id()
      AND public.current_profile_role_name() = 'admin'
    )
  );

CREATE POLICY "Admins can delete profiles"
  ON profiles FOR DELETE TO authenticated
  USING (
    public.current_profile_role_name() = 'super_admin'
    OR (
      school_id = public.current_profile_school_id()
      AND public.current_profile_role_name() = 'admin'
    )
  );
