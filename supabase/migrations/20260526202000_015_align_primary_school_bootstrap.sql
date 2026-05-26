/*
  # Align hosted bootstrap with a primary-school setup

  This migration keeps existing custom data intact as much as possible while
  steering the default hosted bootstrap toward a Petite Section -> CM2 school.
*/

DO $$
DECLARE
  demo_school_id constant uuid := 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11';
BEGIN
  UPDATE schools
  SET
    name = CASE
      WHEN COALESCE(name, '') IN ('', 'College Lycee Moderne')
        THEN 'Ecole Maternelle et Primaire Horizon'
      ELSE name
    END,
    email = CASE
      WHEN COALESCE(email, '') IN ('', 'contact@collegemoderne.edu')
        THEN 'contact@horizon-primaire.edu'
      ELSE email
    END,
    motto = CASE
      WHEN COALESCE(motto, '') IN ('', 'Savoir et Progress')
        THEN 'Grandir, apprendre, s epanouir'
      ELSE motto
    END,
    establishment_type = 'maternelle_primaire',
    updated_at = now()
  WHERE id = demo_school_id;

  UPDATE fee_types
  SET
    name = 'Frais de scolarite',
    description = 'Scolarite mensuelle ou par echeance'
  WHERE school_id = demo_school_id
    AND lower(name) IN ('mensualite', 'mensualité');

  INSERT INTO levels (school_id, name, order_index)
  SELECT
    demo_school_id,
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
  WHERE EXISTS (SELECT 1 FROM schools WHERE id = demo_school_id)
    AND NOT EXISTS (
      SELECT 1
      FROM levels l
      WHERE l.school_id = demo_school_id
        AND l.name = preset.name
    );

  INSERT INTO fee_types (school_id, name, description, is_recurring)
  SELECT
    demo_school_id,
    preset.name,
    preset.description,
    preset.is_recurring
  FROM (
    VALUES
      ('Frais d''inscription', 'Paiement unique a l''entree', false),
      ('Frais de scolarite', 'Scolarite mensuelle ou par echeance', true),
      ('Cantine', 'Restauration scolaire', true),
      ('Transport', 'Ramassage et transport scolaire', true),
      ('Tenue scolaire', 'Uniforme, tablier et equipements', false)
  ) AS preset(name, description, is_recurring)
  WHERE EXISTS (SELECT 1 FROM schools WHERE id = demo_school_id)
    AND NOT EXISTS (
      SELECT 1
      FROM fee_types ft
      WHERE ft.school_id = demo_school_id
        AND lower(ft.name) = lower(preset.name)
    );
END $$;
