/*
  # Accounts, demo separation and module access

  This migration prepares two clean usage modes:
  - demo@schoolmanager.pro for mock data,
  - admin@schoolmanager.pro for real administration and user creation.

  Auth users are created by the setup-demo/admin-create-user Edge Functions.
*/

ALTER TABLE schools
  ADD COLUMN IF NOT EXISTS is_demo boolean DEFAULT false;

ALTER TABLE profiles
  ADD COLUMN IF NOT EXISTS email text DEFAULT '',
  ADD COLUMN IF NOT EXISTS account_type text DEFAULT 'staff',
  ADD COLUMN IF NOT EXISTS module_access jsonb DEFAULT '[]'::jsonb;

DROP POLICY IF EXISTS "Users can view profiles" ON profiles;
DROP POLICY IF EXISTS "Users can view profiles in their school" ON profiles;
DROP POLICY IF EXISTS "Admins can update profiles" ON profiles;

CREATE POLICY "Users can view profiles in their school"
  ON profiles FOR SELECT TO authenticated
  USING (
    id = auth.uid()
    OR school_id = (SELECT school_id FROM profiles WHERE id = auth.uid())
    OR EXISTS (
      SELECT 1
      FROM profiles p
      JOIN roles r ON p.role_id = r.id
      WHERE p.id = auth.uid()
        AND r.name = 'super_admin'
    )
  );

CREATE POLICY "Admins can update profiles"
  ON profiles FOR UPDATE TO authenticated
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

UPDATE roles SET display_name = 'Super Administrateur', description = 'Acces total a toutes les ecoles' WHERE name = 'super_admin';
UPDATE roles SET display_name = 'Administrateur', description = 'Gestion complete de l''etablissement' WHERE name = 'admin';
UPDATE roles SET display_name = 'Direction', description = 'Pilotage pedagogique et administratif' WHERE name = 'director';
UPDATE roles SET display_name = 'Comptabilite', description = 'Gestion financiere et comptable' WHERE name = 'accountant';
UPDATE roles SET display_name = 'Caisse', description = 'Encaissements et operations de caisse' WHERE name = 'cashier';
UPDATE roles SET display_name = 'Surveillance', description = 'Presence, discipline et vie scolaire' WHERE name = 'supervisor';
UPDATE roles SET display_name = 'Enseignant', description = 'Classe, presences et evaluations' WHERE name = 'teacher';
UPDATE roles SET display_name = 'Parent', description = 'Portail famille' WHERE name = 'parent';
UPDATE roles SET display_name = 'Eleve', description = 'Portail eleve' WHERE name = 'student';

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
VALUES (
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

UPDATE schools
SET
  name = 'Ecole Demo Horizon',
  establishment_type = 'maternelle_primaire',
  is_demo = true,
  active = true,
  updated_at = now()
WHERE id = 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11';

INSERT INTO academic_years (
  id,
  school_id,
  name,
  start_date,
  end_date,
  active
)
VALUES (
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

INSERT INTO levels (school_id, name, order_index)
SELECT 'c0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11'::uuid, level_name, order_index
FROM (
  VALUES
    ('Petite Section', 1),
    ('Moyenne Section', 2),
    ('Grande Section', 3),
    ('CP1', 4),
    ('CP2', 5),
    ('CE1', 6),
    ('CE2', 7),
    ('CM1', 8),
    ('CM2', 9)
) AS presets(level_name, order_index)
WHERE NOT EXISTS (
  SELECT 1
  FROM levels
  WHERE school_id = 'c0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11'
    AND name = presets.level_name
);

INSERT INTO subjects (school_id, name, code, coefficient)
SELECT 'c0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11'::uuid, subject_name, code, coefficient
FROM (
  VALUES
    ('Langage oral', 'LGO', 1),
    ('Lecture', 'LECT', 1),
    ('Ecriture', 'ECR', 1),
    ('Mathematiques', 'MATH', 1),
    ('Questionner le monde', 'QMON', 1),
    ('Arts plastiques', 'ART', 1),
    ('Education physique', 'EPS', 1),
    ('Anglais initiation', 'ANG', 1)
) AS presets(subject_name, code, coefficient)
WHERE NOT EXISTS (
  SELECT 1
  FROM subjects
  WHERE school_id = 'c0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11'
    AND name = presets.subject_name
);

INSERT INTO fee_types (school_id, name, description, is_recurring)
SELECT 'c0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11'::uuid, fee_name, description, is_recurring
FROM (
  VALUES
    ('Frais d''inscription', 'Paiement unique a l''inscription', false),
    ('Frais de scolarite', 'Frais principal de l''annee scolaire', true),
    ('Cantine', 'Service de restauration scolaire', true),
    ('Transport', 'Navette scolaire', true),
    ('Garderie', 'Accueil avant ou apres les cours', true)
) AS presets(fee_name, description, is_recurring)
WHERE NOT EXISTS (
  SELECT 1
  FROM fee_types
  WHERE school_id = 'c0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11'
    AND name = presets.fee_name
);

UPDATE profiles p
SET
  school_id = 'c0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11',
  role_id = (SELECT id FROM roles WHERE name = 'super_admin'),
  email = u.email,
  account_type = 'admin',
  module_access = '["dashboard","students","parents","classes","finance","cash","accounting","teachers","hr","grades","attendance","schedule","messages","documents","users","settings"]'::jsonb,
  active = true,
  updated_at = now()
FROM auth.users u
WHERE p.id = u.id
  AND u.email = 'admin@schoolmanager.pro';

UPDATE profiles p
SET
  school_id = 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11',
  role_id = (SELECT id FROM roles WHERE name = 'admin'),
  email = u.email,
  account_type = 'demo',
  module_access = '["dashboard","students","parents","classes","finance","cash","accounting","teachers","hr","grades","attendance","schedule","messages","documents","users","settings"]'::jsonb,
  active = true,
  updated_at = now()
FROM auth.users u
WHERE p.id = u.id
  AND u.email = 'demo@schoolmanager.pro';
