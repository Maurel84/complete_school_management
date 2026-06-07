/*
  # Repair admin and demo auth accounts

  Run this after migration 017 if production has:
  - "Acces limite" for the existing admin account,
  - "Invalid login credentials" for demo@schoolmanager.pro.

  It is safe to run multiple times.
*/

CREATE EXTENSION IF NOT EXISTS pgcrypto;

ALTER TABLE schools
  ADD COLUMN IF NOT EXISTS is_demo boolean DEFAULT false;

ALTER TABLE profiles
  ADD COLUMN IF NOT EXISTS email text DEFAULT '',
  ADD COLUMN IF NOT EXISTS account_type text DEFAULT 'staff',
  ADD COLUMN IF NOT EXISTS module_access jsonb DEFAULT '[]'::jsonb;

INSERT INTO schools (
  id,
  name,
  address,
  city,
  country,
  phone,
  email,
  motto,
  establishment_type,
  active,
  is_demo
)
VALUES
  (
    'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11',
    'Ecole Demo Horizon',
    '25 Rue de la Paix',
    'Abidjan',
    'Cote d Ivoire',
    '+225 07 08 09 10 11',
    'demo@schoolmanager.pro',
    'Grandir, apprendre, reussir',
    'maternelle_primaire',
    true,
    true
  ),
  (
    'c0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11',
    'Ecole Primaire Horizon',
    '',
    'Abidjan',
    'Cote d Ivoire',
    '',
    '',
    'Grandir, apprendre, reussir',
    'maternelle_primaire',
    true,
    false
  )
ON CONFLICT (id) DO UPDATE
SET
  name = EXCLUDED.name,
  establishment_type = EXCLUDED.establishment_type,
  active = EXCLUDED.active,
  is_demo = EXCLUDED.is_demo,
  updated_at = now();

INSERT INTO academic_years (
  id,
  school_id,
  name,
  start_date,
  end_date,
  active
)
VALUES
  (
    'b0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11',
    'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11',
    '2025-2026',
    '2025-09-15',
    '2026-07-15',
    true
  ),
  (
    'c1eebc99-9c0b-4ef8-bb6d-6bb9bd380a11',
    'c0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11',
    '2026-2027',
    '2026-09-14',
    '2027-07-16',
    true
  )
ON CONFLICT (id) DO UPDATE
SET
  school_id = EXCLUDED.school_id,
  name = EXCLUDED.name,
  start_date = EXCLUDED.start_date,
  end_date = EXCLUDED.end_date,
  active = EXCLUDED.active;

DO $$
DECLARE
  account record;
  v_user_id uuid;
  v_role_id uuid;
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
  FOR account IN
    SELECT *
    FROM (
      VALUES
        (
          'admin@schoolmanager.pro',
          'Admin123!',
          'Admin',
          'General',
          '+225 07 00 00 01',
          'super_admin',
          'c0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11'::uuid,
          'admin'
        ),
        (
          'demo@schoolmanager.pro',
          'Demo123!',
          'Demo',
          'Primaire',
          '+225 07 00 00 02',
          'admin',
          'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11'::uuid,
          'demo'
        )
    ) AS accounts(email, password, first_name, last_name, phone, role_name, school_id, account_type)
  LOOP
    SELECT id INTO v_role_id FROM roles WHERE name = account.role_name;

    SELECT id INTO v_user_id FROM auth.users WHERE email = account.email;

    IF v_user_id IS NULL THEN
      v_user_id := gen_random_uuid();

      INSERT INTO auth.users (
        id,
        instance_id,
        aud,
        role,
        email,
        encrypted_password,
        email_confirmed_at,
        raw_app_meta_data,
        raw_user_meta_data,
        created_at,
        updated_at,
        confirmation_token,
        email_change,
        email_change_token_new,
        recovery_token
      )
      VALUES (
        v_user_id,
        '00000000-0000-0000-0000-000000000000',
        'authenticated',
        'authenticated',
        account.email,
        crypt(account.password, gen_salt('bf')),
        now(),
        jsonb_build_object(
          'provider', 'email',
          'providers', jsonb_build_array('email'),
          'role', account.role_name,
          'school_id', account.school_id::text
        ),
        jsonb_build_object(
          'first_name', account.first_name,
          'last_name', account.last_name,
          'phone', account.phone
        ),
        now(),
        now(),
        '',
        '',
        '',
        ''
      );
    ELSE
      UPDATE auth.users
      SET
        encrypted_password = crypt(account.password, gen_salt('bf')),
        email_confirmed_at = COALESCE(email_confirmed_at, now()),
        raw_app_meta_data = COALESCE(raw_app_meta_data, '{}'::jsonb)
          || jsonb_build_object(
            'provider', 'email',
            'providers', jsonb_build_array('email'),
            'role', account.role_name,
            'school_id', account.school_id::text
          ),
        raw_user_meta_data = COALESCE(raw_user_meta_data, '{}'::jsonb)
          || jsonb_build_object(
            'first_name', account.first_name,
            'last_name', account.last_name,
            'phone', account.phone
          ),
        updated_at = now()
      WHERE id = v_user_id;
    END IF;

    INSERT INTO auth.identities (
      provider_id,
      user_id,
      identity_data,
      provider,
      last_sign_in_at,
      created_at,
      updated_at
    )
    VALUES (
      v_user_id::text,
      v_user_id,
      jsonb_build_object('sub', v_user_id::text, 'email', account.email),
      'email',
      now(),
      now(),
      now()
    )
    ON CONFLICT (provider_id, provider) DO UPDATE
    SET
      user_id = EXCLUDED.user_id,
      identity_data = EXCLUDED.identity_data,
      updated_at = now();

    INSERT INTO profiles (
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
      v_user_id,
      account.school_id,
      v_role_id,
      account.email,
      account.first_name,
      account.last_name,
      account.phone,
      account.account_type,
      v_all_modules,
      true
    )
    ON CONFLICT (id) DO UPDATE
    SET
      school_id = EXCLUDED.school_id,
      role_id = EXCLUDED.role_id,
      email = EXCLUDED.email,
      first_name = EXCLUDED.first_name,
      last_name = EXCLUDED.last_name,
      phone = EXCLUDED.phone,
      account_type = EXCLUDED.account_type,
      module_access = EXCLUDED.module_access,
      active = true,
      updated_at = now();
  END LOOP;
END $$;
