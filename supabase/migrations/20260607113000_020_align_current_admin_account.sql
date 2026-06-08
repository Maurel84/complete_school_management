/*
  # Align current production admin account

  This migration keeps the real admin account separate from demo credentials.
  It does not create or reset passwords. Create/update the password from
  Supabase Auth, then run this migration to align metadata and the public profile.
*/

CREATE OR REPLACE FUNCTION public.current_profile_school_id()
RETURNS uuid
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = public
AS $function$
  SELECT school_id
  FROM profiles
  WHERE id = auth.uid()
    AND active IS TRUE
$function$;

CREATE OR REPLACE FUNCTION public.current_profile_role_name()
RETURNS text
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = public
AS $function$
  SELECT r.name
  FROM profiles p
  JOIN roles r ON p.role_id = r.id
  WHERE p.id = auth.uid()
    AND p.active IS TRUE
$function$;

GRANT EXECUTE ON FUNCTION public.current_profile_school_id() TO authenticated;
GRANT EXECUTE ON FUNCTION public.current_profile_role_name() TO authenticated;

DO $$
DECLARE
  v_admin_user_id uuid;
  v_admin_role_id uuid;
  v_admin_school_id uuid := 'c0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11'::uuid;
  v_all_modules jsonb := '[
    "dashboard",
    "students",
    "parents",
    "classes",
    "finance",
    "cash",
    "accounting",
    "teachers",
    "hr",
    "grades",
    "attendance",
    "schedule",
    "messages",
    "documents",
    "users",
    "settings"
  ]'::jsonb;
BEGIN
  SELECT id INTO v_admin_user_id
  FROM auth.users
  WHERE lower(email) = lower('tarieljeremie@gmail.com')
  LIMIT 1;

  SELECT id INTO v_admin_role_id
  FROM public.roles
  WHERE name = 'super_admin';

  IF v_admin_user_id IS NULL THEN
    RAISE NOTICE 'Admin auth user tarieljeremie@gmail.com not found. Create it in Supabase Auth, then rerun this migration.';
  ELSE
    UPDATE auth.users
    SET
      raw_app_meta_data = COALESCE(raw_app_meta_data, '{}'::jsonb) || jsonb_build_object(
        'role', 'super_admin',
        'school_id', v_admin_school_id::text
      ),
      raw_user_meta_data = COALESCE(raw_user_meta_data, '{}'::jsonb) || jsonb_build_object(
        'first_name', COALESCE(raw_user_meta_data->>'first_name', 'Admin'),
        'last_name', COALESCE(raw_user_meta_data->>'last_name', 'General')
      ),
      email_confirmed_at = COALESCE(email_confirmed_at, now()),
      updated_at = now()
    WHERE id = v_admin_user_id;

    INSERT INTO public.profiles (
      id,
      school_id,
      role_id,
      email,
      first_name,
      last_name,
      phone,
      account_type,
      module_access,
      active
    )
    VALUES (
      v_admin_user_id,
      v_admin_school_id,
      v_admin_role_id,
      'tarieljeremie@gmail.com',
      'Admin',
      'General',
      '+225 07 00 00 01',
      'admin',
      v_all_modules,
      true
    )
    ON CONFLICT (id) DO UPDATE
    SET
      school_id = EXCLUDED.school_id,
      role_id = EXCLUDED.role_id,
      email = EXCLUDED.email,
      account_type = EXCLUDED.account_type,
      module_access = EXCLUDED.module_access,
      active = true,
      updated_at = now();
  END IF;

  UPDATE public.profiles p
  SET
    active = false,
    module_access = '[]'::jsonb,
    updated_at = now()
  FROM auth.users u
  WHERE p.id = u.id
    AND lower(u.email) = lower('admin@schoolmanager.pro')
    AND (v_admin_user_id IS NULL OR p.id <> v_admin_user_id);

  UPDATE auth.users
  SET
    raw_app_meta_data = COALESCE(raw_app_meta_data, '{}'::jsonb) || jsonb_build_object(
      'role', 'disabled',
      'school_id', NULL
    ),
    updated_at = now()
  WHERE lower(email) = lower('admin@schoolmanager.pro')
    AND (v_admin_user_id IS NULL OR id <> v_admin_user_id);
END $$;
