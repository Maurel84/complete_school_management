/*
  # School assets storage

  Creates a public storage bucket for school branding assets such as the logo
  used in receipts and administrative documents.
*/

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'school-assets',
  'school-assets',
  true,
  5242880,
  ARRAY['image/png', 'image/jpeg', 'image/webp', 'image/svg+xml']
)
ON CONFLICT (id) DO UPDATE
SET
  public = EXCLUDED.public,
  file_size_limit = EXCLUDED.file_size_limit,
  allowed_mime_types = EXCLUDED.allowed_mime_types;

DROP POLICY IF EXISTS "Authenticated users can view school assets" ON storage.objects;
DROP POLICY IF EXISTS "Admins can upload school assets" ON storage.objects;
DROP POLICY IF EXISTS "Admins can update school assets" ON storage.objects;
DROP POLICY IF EXISTS "Admins can delete school assets" ON storage.objects;

CREATE POLICY "Authenticated users can view school assets"
  ON storage.objects FOR SELECT TO authenticated
  USING (bucket_id = 'school-assets');

CREATE POLICY "Admins can upload school assets"
  ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'school-assets'
    AND EXISTS (
      SELECT 1
      FROM public.profiles p
      JOIN public.roles r ON p.role_id = r.id
      WHERE p.id = auth.uid()
        AND r.name IN ('super_admin', 'admin')
        AND p.school_id::text = split_part(storage.objects.name, '/', 1)
    )
  );

CREATE POLICY "Admins can update school assets"
  ON storage.objects FOR UPDATE TO authenticated
  USING (
    bucket_id = 'school-assets'
    AND EXISTS (
      SELECT 1
      FROM public.profiles p
      JOIN public.roles r ON p.role_id = r.id
      WHERE p.id = auth.uid()
        AND r.name IN ('super_admin', 'admin')
        AND p.school_id::text = split_part(storage.objects.name, '/', 1)
    )
  )
  WITH CHECK (
    bucket_id = 'school-assets'
    AND EXISTS (
      SELECT 1
      FROM public.profiles p
      JOIN public.roles r ON p.role_id = r.id
      WHERE p.id = auth.uid()
        AND r.name IN ('super_admin', 'admin')
        AND p.school_id::text = split_part(storage.objects.name, '/', 1)
    )
  );

CREATE POLICY "Admins can delete school assets"
  ON storage.objects FOR DELETE TO authenticated
  USING (
    bucket_id = 'school-assets'
    AND EXISTS (
      SELECT 1
      FROM public.profiles p
      JOIN public.roles r ON p.role_id = r.id
      WHERE p.id = auth.uid()
        AND r.name IN ('super_admin', 'admin')
        AND p.school_id::text = split_part(storage.objects.name, '/', 1)
    )
  );
