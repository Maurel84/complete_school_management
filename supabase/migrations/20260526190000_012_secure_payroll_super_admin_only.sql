/*
  # Restrict payroll visibility to super admins

  Payroll data is highly sensitive. This migration narrows payroll access so
  only the `super_admin` role can view or manage salary records.
*/

DROP POLICY IF EXISTS "Authenticated users can view payrolls" ON payrolls;
DROP POLICY IF EXISTS "Admins and accountants can manage payrolls" ON payrolls;
DROP POLICY IF EXISTS "Super admins can view payrolls" ON payrolls;
DROP POLICY IF EXISTS "Super admins can insert payrolls" ON payrolls;
DROP POLICY IF EXISTS "Super admins can update payrolls" ON payrolls;
DROP POLICY IF EXISTS "Super admins can delete payrolls" ON payrolls;

CREATE POLICY "Super admins can view payrolls"
  ON payrolls FOR SELECT TO authenticated
  USING (
    school_id = (SELECT school_id FROM profiles WHERE id = auth.uid())
    AND EXISTS (
      SELECT 1
      FROM profiles p
      JOIN roles r ON p.role_id = r.id
      WHERE p.id = auth.uid()
        AND r.name = 'super_admin'
    )
  );

CREATE POLICY "Super admins can insert payrolls"
  ON payrolls FOR INSERT TO authenticated
  WITH CHECK (
    school_id = (SELECT school_id FROM profiles WHERE id = auth.uid())
    AND EXISTS (
      SELECT 1
      FROM profiles p
      JOIN roles r ON p.role_id = r.id
      WHERE p.id = auth.uid()
        AND r.name = 'super_admin'
    )
  );

CREATE POLICY "Super admins can update payrolls"
  ON payrolls FOR UPDATE TO authenticated
  USING (
    school_id = (SELECT school_id FROM profiles WHERE id = auth.uid())
    AND EXISTS (
      SELECT 1
      FROM profiles p
      JOIN roles r ON p.role_id = r.id
      WHERE p.id = auth.uid()
        AND r.name = 'super_admin'
    )
  )
  WITH CHECK (
    school_id = (SELECT school_id FROM profiles WHERE id = auth.uid())
    AND EXISTS (
      SELECT 1
      FROM profiles p
      JOIN roles r ON p.role_id = r.id
      WHERE p.id = auth.uid()
        AND r.name = 'super_admin'
    )
  );

CREATE POLICY "Super admins can delete payrolls"
  ON payrolls FOR DELETE TO authenticated
  USING (
    school_id = (SELECT school_id FROM profiles WHERE id = auth.uid())
    AND EXISTS (
      SELECT 1
      FROM profiles p
      JOIN roles r ON p.role_id = r.id
      WHERE p.id = auth.uid()
        AND r.name = 'super_admin'
    )
  );
