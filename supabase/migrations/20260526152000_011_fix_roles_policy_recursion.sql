/*
  # Fix recursive RLS policy on roles

  The original "Admins can manage roles" policy was created FOR ALL and
  referenced the roles table again inside its authorization subquery.
  Because FOR ALL also applies to SELECT, any authenticated read touching
  roles could recurse infinitely through RLS evaluation.

  This script is safe to re-run from the Supabase SQL Editor. It removes any
  previous role-management policies and recreates an explicit SELECT rule plus
  command-specific write rules.
*/

DROP POLICY IF EXISTS "Authenticated users can view roles" ON roles;
DROP POLICY IF EXISTS "Admins can manage roles" ON roles;
DROP POLICY IF EXISTS "Admins can insert roles" ON roles;
DROP POLICY IF EXISTS "Admins can update roles" ON roles;
DROP POLICY IF EXISTS "Admins can delete roles" ON roles;

CREATE POLICY "Authenticated users can view roles"
  ON roles FOR SELECT TO authenticated USING (true);

CREATE POLICY "Admins can insert roles"
  ON roles FOR INSERT TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1
      FROM profiles p
      JOIN roles r ON p.role_id = r.id
      WHERE p.id = auth.uid()
        AND r.name IN ('super_admin', 'admin')
    )
  );

CREATE POLICY "Admins can update roles"
  ON roles FOR UPDATE TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM profiles p
      JOIN roles r ON p.role_id = r.id
      WHERE p.id = auth.uid()
        AND r.name IN ('super_admin', 'admin')
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1
      FROM profiles p
      JOIN roles r ON p.role_id = r.id
      WHERE p.id = auth.uid()
        AND r.name IN ('super_admin', 'admin')
    )
  );

CREATE POLICY "Admins can delete roles"
  ON roles FOR DELETE TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM profiles p
      JOIN roles r ON p.role_id = r.id
      WHERE p.id = auth.uid()
        AND r.name IN ('super_admin', 'admin')
    )
  );
