/*
  # Bootstrap hosted admin account

  This migration is intended for freshly linked hosted projects where:
  - the schema exists,
  - the reference data is still empty,
  - the demo admin auth user already exists but is not confirmed,
  - no matching profile has been created yet.

  It is safe to run multiple times.
*/

INSERT INTO roles (name, display_name, description) VALUES
  ('super_admin', 'Super Administrateur', 'Acces total a toutes les ecoles'),
  ('admin', 'Administrateur', 'Gestion complete de letablissement'),
  ('accountant', 'Comptable', 'Gestion comptable et financiere'),
  ('cashier', 'Caissier', 'Gestion de la caisse et encaissements'),
  ('director', 'Directeur', 'Direction de letablissement'),
  ('supervisor', 'Surveillant', 'Surveillance et discipline'),
  ('teacher', 'Enseignant', 'Gestion pedagogique'),
  ('parent', 'Parent', 'Consultation notes paiements absences'),
  ('student', 'Eleve', 'Consultation notes et emploi du temps')
ON CONFLICT (name) DO NOTHING;

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
  active
)
VALUES (
  'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11',
  'Ecole Maternelle et Primaire Horizon',
  '25 Rue de la Paix',
  'Abidjan',
  'Cote d Ivoire',
  '+225 07 08 09 10 11',
  'contact@horizon-primaire.edu',
  'Grandir, apprendre, s epanouir',
  'maternelle_primaire',
  true
)
ON CONFLICT (id) DO UPDATE
SET
  name = EXCLUDED.name,
  address = EXCLUDED.address,
  city = EXCLUDED.city,
  country = EXCLUDED.country,
  phone = EXCLUDED.phone,
  email = EXCLUDED.email,
  motto = EXCLUDED.motto,
  establishment_type = EXCLUDED.establishment_type,
  active = EXCLUDED.active,
  updated_at = now();

INSERT INTO academic_years (
  id,
  school_id,
  name,
  start_date,
  end_date,
  active
)
VALUES (
  'b0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11',
  'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11',
  '2025-2026',
  '2025-09-15',
  '2026-07-15',
  true
)
ON CONFLICT (id) DO UPDATE
SET
  school_id = EXCLUDED.school_id,
  name = EXCLUDED.name,
  start_date = EXCLUDED.start_date,
  end_date = EXCLUDED.end_date,
  active = EXCLUDED.active;

INSERT INTO levels (school_id, name, order_index)
SELECT
  'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11'::uuid,
  preset.name,
  preset.order_index
FROM (
  VALUES
    ('Petite Section', 1),
    ('Moyenne Section', 2),
    ('Grande Section', 3),
    ('CP', 4),
    ('CE1', 5),
    ('CE2', 6),
    ('CM1', 7),
    ('CM2', 8)
) AS preset(name, order_index)
WHERE NOT EXISTS (
  SELECT 1
  FROM levels l
  WHERE l.school_id = 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11'::uuid
    AND l.name = preset.name
);

INSERT INTO fee_types (school_id, name, description, is_recurring)
SELECT
  'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11'::uuid,
  preset.name,
  preset.description,
  preset.is_recurring
FROM (
  VALUES
    ('Frais d''inscription', 'Paiement unique a l''entree', false),
    ('Frais de scolarite', 'Scolarite mensuelle ou par echeance', true),
    ('Cantine', 'Restauration scolaire', true),
    ('Transport', 'Ramassage et transport scolaire', true)
) AS preset(name, description, is_recurring)
WHERE NOT EXISTS (
  SELECT 1
  FROM fee_types ft
  WHERE ft.school_id = 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11'::uuid
    AND lower(ft.name) = lower(preset.name)
);

UPDATE auth.users
SET
  email_confirmed_at = COALESCE(email_confirmed_at, now()),
  updated_at = now()
WHERE email = 'admin@schoolmanager.pro';

INSERT INTO profiles (
  id,
  school_id,
  role_id,
  first_name,
  last_name,
  phone,
  active
)
SELECT
  u.id,
  'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11'::uuid,
  r.id,
  COALESCE(u.raw_user_meta_data->>'first_name', 'Admin'),
  COALESCE(u.raw_user_meta_data->>'last_name', 'Demo'),
  COALESCE(u.raw_user_meta_data->>'phone', '+225 07 00 00 00'),
  true
FROM auth.users u
JOIN roles r ON r.name = 'admin'
WHERE u.email = 'admin@schoolmanager.pro'
ON CONFLICT (id) DO UPDATE
SET
  school_id = EXCLUDED.school_id,
  role_id = EXCLUDED.role_id,
  first_name = EXCLUDED.first_name,
  last_name = EXCLUDED.last_name,
  phone = EXCLUDED.phone,
  active = EXCLUDED.active,
  updated_at = now();
