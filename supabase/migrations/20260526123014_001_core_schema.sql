/*
  # Core Schema - SchoolManager Pro

  1. New Tables
    - `schools` - Multi-tenant SaaS isolation
    - `roles` - 9 role definitions
    - `profiles` - Extended auth.users with school/role
    - `levels` - 6e through Terminale
    - `academic_years` - School year periods
    - `classes` - Class groups within levels
    - `subjects` - Academic subjects

  2. Security
    - RLS on all tables
    - School-scoped access for regular users
    - Super admin cross-school access
*/

CREATE TABLE IF NOT EXISTS schools (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  address text DEFAULT '',
  city text DEFAULT '',
  country text DEFAULT '',
  phone text DEFAULT '',
  email text DEFAULT '',
  logo_url text DEFAULT '',
  motto text DEFAULT '',
  establishment_type text DEFAULT 'college',
  active boolean DEFAULT true,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS roles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text UNIQUE NOT NULL,
  display_name text NOT NULL,
  description text DEFAULT '',
  created_at timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS profiles (
  id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  school_id uuid REFERENCES schools(id) ON DELETE CASCADE,
  role_id uuid REFERENCES roles(id),
  first_name text DEFAULT '',
  last_name text DEFAULT '',
  phone text DEFAULT '',
  avatar_url text DEFAULT '',
  active boolean DEFAULT true,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS levels (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id uuid REFERENCES schools(id) ON DELETE CASCADE,
  name text NOT NULL,
  order_index int DEFAULT 0,
  created_at timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS academic_years (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id uuid REFERENCES schools(id) ON DELETE CASCADE,
  name text NOT NULL,
  start_date date NOT NULL,
  end_date date NOT NULL,
  active boolean DEFAULT false,
  created_at timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS classes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id uuid REFERENCES schools(id) ON DELETE CASCADE,
  level_id uuid REFERENCES levels(id) ON DELETE CASCADE,
  academic_year_id uuid REFERENCES academic_years(id),
  name text NOT NULL,
  capacity int DEFAULT 40,
  room text DEFAULT '',
  created_at timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS subjects (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id uuid REFERENCES schools(id) ON DELETE CASCADE,
  name text NOT NULL,
  code text DEFAULT '',
  coefficient int DEFAULT 1,
  description text DEFAULT '',
  created_at timestamptz DEFAULT now()
);

ALTER TABLE schools ENABLE ROW LEVEL SECURITY;
ALTER TABLE roles ENABLE ROW LEVEL SECURITY;
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE levels ENABLE ROW LEVEL SECURITY;
ALTER TABLE classes ENABLE ROW LEVEL SECURITY;
ALTER TABLE academic_years ENABLE ROW LEVEL SECURITY;
ALTER TABLE subjects ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can view roles"
  ON roles FOR SELECT TO authenticated USING (true);

CREATE POLICY "Admins can manage roles"
  ON roles FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM profiles p JOIN roles r ON p.role_id = r.id WHERE p.id = auth.uid() AND r.name IN ('super_admin', 'admin')));

CREATE POLICY "Authenticated users can view their school"
  ON schools FOR SELECT TO authenticated
  USING (id = (SELECT school_id FROM profiles WHERE id = auth.uid()) OR EXISTS (SELECT 1 FROM profiles p JOIN roles r ON p.role_id = r.id WHERE p.id = auth.uid() AND r.name = 'super_admin'));

CREATE POLICY "Admins can manage schools"
  ON schools FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM profiles p JOIN roles r ON p.role_id = r.id WHERE p.id = auth.uid() AND r.name IN ('super_admin', 'admin')));

CREATE POLICY "Users can view profiles"
  ON profiles FOR SELECT TO authenticated USING (true);

CREATE POLICY "Users can update own profile"
  ON profiles FOR UPDATE TO authenticated
  USING (auth.uid() = id)
  WITH CHECK (auth.uid() = id);

CREATE POLICY "Admins can insert profiles"
  ON profiles FOR INSERT TO authenticated
  WITH CHECK (EXISTS (SELECT 1 FROM profiles p JOIN roles r ON p.role_id = r.id WHERE p.id = auth.uid() AND r.name IN ('super_admin', 'admin')));

CREATE POLICY "Admins can delete profiles"
  ON profiles FOR DELETE TO authenticated
  USING (EXISTS (SELECT 1 FROM profiles p JOIN roles r ON p.role_id = r.id WHERE p.id = auth.uid() AND r.name IN ('super_admin', 'admin')));

CREATE POLICY "Authenticated users can view levels"
  ON levels FOR SELECT TO authenticated
  USING (school_id = (SELECT school_id FROM profiles WHERE id = auth.uid()));

CREATE POLICY "Admins can manage levels"
  ON levels FOR ALL TO authenticated
  USING (school_id = (SELECT school_id FROM profiles WHERE id = auth.uid()) AND EXISTS (SELECT 1 FROM profiles p JOIN roles r ON p.role_id = r.id WHERE p.id = auth.uid() AND r.name IN ('super_admin', 'admin', 'director')));

CREATE POLICY "Authenticated users can view classes"
  ON classes FOR SELECT TO authenticated
  USING (school_id = (SELECT school_id FROM profiles WHERE id = auth.uid()));

CREATE POLICY "Admins can manage classes"
  ON classes FOR ALL TO authenticated
  USING (school_id = (SELECT school_id FROM profiles WHERE id = auth.uid()) AND EXISTS (SELECT 1 FROM profiles p JOIN roles r ON p.role_id = r.id WHERE p.id = auth.uid() AND r.name IN ('super_admin', 'admin', 'director')));

CREATE POLICY "Authenticated users can view academic years"
  ON academic_years FOR SELECT TO authenticated
  USING (school_id = (SELECT school_id FROM profiles WHERE id = auth.uid()));

CREATE POLICY "Admins can manage academic years"
  ON academic_years FOR ALL TO authenticated
  USING (school_id = (SELECT school_id FROM profiles WHERE id = auth.uid()) AND EXISTS (SELECT 1 FROM profiles p JOIN roles r ON p.role_id = r.id WHERE p.id = auth.uid() AND r.name IN ('super_admin', 'admin', 'director')));

CREATE POLICY "Authenticated users can view subjects"
  ON subjects FOR SELECT TO authenticated
  USING (school_id = (SELECT school_id FROM profiles WHERE id = auth.uid()));

CREATE POLICY "Admins can manage subjects"
  ON subjects FOR ALL TO authenticated
  USING (school_id = (SELECT school_id FROM profiles WHERE id = auth.uid()) AND EXISTS (SELECT 1 FROM profiles p JOIN roles r ON p.role_id = r.id WHERE p.id = auth.uid() AND r.name IN ('super_admin', 'admin', 'director')));

INSERT INTO roles (name, display_name, description) VALUES
  ('super_admin', 'Super Administrateur', 'Acces total a toutes les ecoles'),
  ('admin', 'Administrateur', 'Gestion complete de letablissement'),
  ('accountant', 'Comptable', 'Gestion comptable et financiere'),
  ('cashier', 'Caissier', 'Gestion de la caisse et encaissements'),
  ('director', 'Directeur', 'Direction de letablissement'),
  ('supervisor', 'Surveillant', 'Surveillance et discipline'),
  ('teacher', 'Enseignant', 'Gestion pedagogique'),
  ('parent', 'Parent', 'Consultation notes paiements absences'),
  ('student', 'Eleve', 'Consultation notes et emploi du temps');
