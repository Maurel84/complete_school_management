/*
  # Family links, student media and generated documents

  This migration strengthens the primary-school workflow with:
  - richer parent/student links,
  - a dedicated student photo bucket,
  - a generated documents bucket for receipts and school cards,
  - broader document permissions for financial teams.
*/

ALTER TABLE student_parents
  ADD COLUMN IF NOT EXISTS is_billing_contact boolean DEFAULT false,
  ADD COLUMN IF NOT EXISTS is_pickup_authorized boolean DEFAULT true,
  ADD COLUMN IF NOT EXISTS emergency_priority int DEFAULT 2,
  ADD COLUMN IF NOT EXISTS notes text DEFAULT '';

CREATE INDEX IF NOT EXISTS idx_student_parents_parent_id ON student_parents(parent_id);
CREATE INDEX IF NOT EXISTS idx_student_parents_student_id ON student_parents(student_id);

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES
  (
    'student-media',
    'student-media',
    true,
    10485760,
    ARRAY['image/png', 'image/jpeg', 'image/webp']
  ),
  (
    'school-documents',
    'school-documents',
    true,
    10485760,
    ARRAY['text/html', 'application/pdf', 'image/png', 'image/jpeg', 'image/webp']
  )
ON CONFLICT (id) DO UPDATE
SET
  public = EXCLUDED.public,
  file_size_limit = EXCLUDED.file_size_limit,
  allowed_mime_types = EXCLUDED.allowed_mime_types;

DROP POLICY IF EXISTS "Authenticated users can view student media" ON storage.objects;
DROP POLICY IF EXISTS "School teams can upload student media" ON storage.objects;
DROP POLICY IF EXISTS "School teams can update student media" ON storage.objects;
DROP POLICY IF EXISTS "School teams can delete student media" ON storage.objects;

CREATE POLICY "Authenticated users can view student media"
  ON storage.objects FOR SELECT TO authenticated
  USING (bucket_id = 'student-media');

CREATE POLICY "School teams can upload student media"
  ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'student-media'
    AND EXISTS (
      SELECT 1
      FROM public.profiles p
      JOIN public.roles r ON p.role_id = r.id
      WHERE p.id = auth.uid()
        AND r.name IN ('super_admin', 'admin', 'director', 'supervisor')
        AND p.school_id::text = split_part(storage.objects.name, '/', 1)
    )
  );

CREATE POLICY "School teams can update student media"
  ON storage.objects FOR UPDATE TO authenticated
  USING (
    bucket_id = 'student-media'
    AND EXISTS (
      SELECT 1
      FROM public.profiles p
      JOIN public.roles r ON p.role_id = r.id
      WHERE p.id = auth.uid()
        AND r.name IN ('super_admin', 'admin', 'director', 'supervisor')
        AND p.school_id::text = split_part(storage.objects.name, '/', 1)
    )
  )
  WITH CHECK (
    bucket_id = 'student-media'
    AND EXISTS (
      SELECT 1
      FROM public.profiles p
      JOIN public.roles r ON p.role_id = r.id
      WHERE p.id = auth.uid()
        AND r.name IN ('super_admin', 'admin', 'director', 'supervisor')
        AND p.school_id::text = split_part(storage.objects.name, '/', 1)
    )
  );

CREATE POLICY "School teams can delete student media"
  ON storage.objects FOR DELETE TO authenticated
  USING (
    bucket_id = 'student-media'
    AND EXISTS (
      SELECT 1
      FROM public.profiles p
      JOIN public.roles r ON p.role_id = r.id
      WHERE p.id = auth.uid()
        AND r.name IN ('super_admin', 'admin', 'director', 'supervisor')
        AND p.school_id::text = split_part(storage.objects.name, '/', 1)
    )
  );

DROP POLICY IF EXISTS "Authenticated users can view school documents" ON storage.objects;
DROP POLICY IF EXISTS "School teams can upload school documents" ON storage.objects;
DROP POLICY IF EXISTS "School teams can update school documents" ON storage.objects;
DROP POLICY IF EXISTS "School teams can delete school documents" ON storage.objects;

CREATE POLICY "Authenticated users can view school documents"
  ON storage.objects FOR SELECT TO authenticated
  USING (bucket_id = 'school-documents');

CREATE POLICY "School teams can upload school documents"
  ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'school-documents'
    AND EXISTS (
      SELECT 1
      FROM public.profiles p
      JOIN public.roles r ON p.role_id = r.id
      WHERE p.id = auth.uid()
        AND r.name IN ('super_admin', 'admin', 'director', 'accountant', 'cashier', 'supervisor', 'teacher')
        AND p.school_id::text = split_part(storage.objects.name, '/', 1)
    )
  );

CREATE POLICY "School teams can update school documents"
  ON storage.objects FOR UPDATE TO authenticated
  USING (
    bucket_id = 'school-documents'
    AND EXISTS (
      SELECT 1
      FROM public.profiles p
      JOIN public.roles r ON p.role_id = r.id
      WHERE p.id = auth.uid()
        AND r.name IN ('super_admin', 'admin', 'director', 'accountant', 'cashier', 'supervisor', 'teacher')
        AND p.school_id::text = split_part(storage.objects.name, '/', 1)
    )
  )
  WITH CHECK (
    bucket_id = 'school-documents'
    AND EXISTS (
      SELECT 1
      FROM public.profiles p
      JOIN public.roles r ON p.role_id = r.id
      WHERE p.id = auth.uid()
        AND r.name IN ('super_admin', 'admin', 'director', 'accountant', 'cashier', 'supervisor', 'teacher')
        AND p.school_id::text = split_part(storage.objects.name, '/', 1)
    )
  );

CREATE POLICY "School teams can delete school documents"
  ON storage.objects FOR DELETE TO authenticated
  USING (
    bucket_id = 'school-documents'
    AND EXISTS (
      SELECT 1
      FROM public.profiles p
      JOIN public.roles r ON p.role_id = r.id
      WHERE p.id = auth.uid()
        AND r.name IN ('super_admin', 'admin', 'director', 'accountant', 'cashier', 'supervisor', 'teacher')
        AND p.school_id::text = split_part(storage.objects.name, '/', 1)
    )
  );

DROP POLICY IF EXISTS "Authenticated users can manage documents" ON documents;

CREATE POLICY "Authenticated users can manage documents"
  ON documents FOR ALL TO authenticated
  USING (
    school_id = (SELECT school_id FROM profiles WHERE id = auth.uid())
    AND EXISTS (
      SELECT 1
      FROM profiles p
      JOIN roles r ON p.role_id = r.id
      WHERE p.id = auth.uid()
        AND r.name IN ('super_admin', 'admin', 'director', 'teacher', 'accountant', 'cashier', 'supervisor')
    )
  )
  WITH CHECK (
    school_id = (SELECT school_id FROM profiles WHERE id = auth.uid())
    AND EXISTS (
      SELECT 1
      FROM profiles p
      JOIN roles r ON p.role_id = r.id
      WHERE p.id = auth.uid()
        AND r.name IN ('super_admin', 'admin', 'director', 'teacher', 'accountant', 'cashier', 'supervisor')
    )
  );
