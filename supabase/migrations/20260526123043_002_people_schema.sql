/*
  # People Schema - Students, Parents, Teachers, Staff

  1. New Tables
    - `students` - Student records with matricule, class, status, medical info
    - `parents` - Parent/tutor records with contact info and profession
    - `student_parents` - Junction table linking students to parents with relationship type
    - `teachers` - Teacher profiles with subjects, classes assigned
    - `staff` - Administrative and support staff records
    - `enrollments` - Student enrollment in classes per academic year

  2. Security
    - RLS on all tables
    - School-scoped access
    - Parents can only see their own children
    - Students can only see their own data
*/

CREATE TABLE IF NOT EXISTS students (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id uuid REFERENCES schools(id) ON DELETE CASCADE NOT NULL,
  matricule text UNIQUE NOT NULL,
  first_name text NOT NULL,
  last_name text NOT NULL,
  date_of_birth date,
  sex text DEFAULT 'M',
  birth_place text DEFAULT '',
  nationality text DEFAULT '',
  photo_url text DEFAULT '',
  address text DEFAULT '',
  phone text DEFAULT '',
  email text DEFAULT '',
  class_id uuid REFERENCES classes(id),
  status text DEFAULT 'active',
  medical_info text DEFAULT '',
  previous_school text DEFAULT '',
  enrollment_date date DEFAULT CURRENT_DATE,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS parents (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id uuid REFERENCES schools(id) ON DELETE CASCADE NOT NULL,
  user_id uuid REFERENCES auth.users(id),
  first_name text NOT NULL,
  last_name text NOT NULL,
  phone text DEFAULT '',
  email text DEFAULT '',
  address text DEFAULT '',
  profession text DEFAULT '',
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS student_parents (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  student_id uuid REFERENCES students(id) ON DELETE CASCADE NOT NULL,
  parent_id uuid REFERENCES parents(id) ON DELETE CASCADE NOT NULL,
  relationship text DEFAULT 'pere',
  is_primary boolean DEFAULT false,
  created_at timestamptz DEFAULT now(),
  UNIQUE(student_id, parent_id)
);

CREATE TABLE IF NOT EXISTS teachers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id uuid REFERENCES schools(id) ON DELETE CASCADE NOT NULL,
  user_id uuid REFERENCES auth.users(id),
  matricule text UNIQUE NOT NULL,
  first_name text NOT NULL,
  last_name text NOT NULL,
  date_of_birth date,
  sex text DEFAULT 'M',
  phone text DEFAULT '',
  email text DEFAULT '',
  address text DEFAULT '',
  photo_url text DEFAULT '',
  specialty text DEFAULT '',
  contract_type text DEFAULT 'cdi',
  hire_date date DEFAULT CURRENT_DATE,
  status text DEFAULT 'active',
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS staff (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id uuid REFERENCES schools(id) ON DELETE CASCADE NOT NULL,
  user_id uuid REFERENCES auth.users(id),
  matricule text UNIQUE NOT NULL,
  first_name text NOT NULL,
  last_name text NOT NULL,
  date_of_birth date,
  sex text DEFAULT 'M',
  phone text DEFAULT '',
  email text DEFAULT '',
  address text DEFAULT '',
  photo_url text DEFAULT '',
  department text DEFAULT '',
  position text DEFAULT '',
  contract_type text DEFAULT 'cdi',
  hire_date date DEFAULT CURRENT_DATE,
  status text DEFAULT 'active',
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS enrollments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id uuid REFERENCES schools(id) ON DELETE CASCADE NOT NULL,
  student_id uuid REFERENCES students(id) ON DELETE CASCADE NOT NULL,
  class_id uuid REFERENCES classes(id) ON DELETE CASCADE NOT NULL,
  academic_year_id uuid REFERENCES academic_years(id) NOT NULL,
  enrollment_date date DEFAULT CURRENT_DATE,
  status text DEFAULT 'active',
  created_at timestamptz DEFAULT now()
);

ALTER TABLE students ENABLE ROW LEVEL SECURITY;
ALTER TABLE parents ENABLE ROW LEVEL SECURITY;
ALTER TABLE student_parents ENABLE ROW LEVEL SECURITY;
ALTER TABLE teachers ENABLE ROW LEVEL SECURITY;
ALTER TABLE staff ENABLE ROW LEVEL SECURITY;
ALTER TABLE enrollments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can view students in their school"
  ON students FOR SELECT TO authenticated
  USING (school_id = (SELECT school_id FROM profiles WHERE id = auth.uid()));

CREATE POLICY "Admins and staff can manage students"
  ON students FOR ALL TO authenticated
  USING (school_id = (SELECT school_id FROM profiles WHERE id = auth.uid()) AND EXISTS (SELECT 1 FROM profiles p JOIN roles r ON p.role_id = r.id WHERE p.id = auth.uid() AND r.name IN ('super_admin', 'admin', 'director', 'supervisor')));

CREATE POLICY "Authenticated users can view parents in their school"
  ON parents FOR SELECT TO authenticated
  USING (school_id = (SELECT school_id FROM profiles WHERE id = auth.uid()));

CREATE POLICY "Admins can manage parents"
  ON parents FOR ALL TO authenticated
  USING (school_id = (SELECT school_id FROM profiles WHERE id = auth.uid()) AND EXISTS (SELECT 1 FROM profiles p JOIN roles r ON p.role_id = r.id WHERE p.id = auth.uid() AND r.name IN ('super_admin', 'admin', 'director')));

CREATE POLICY "Authenticated users can view student_parents in their school"
  ON student_parents FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM students WHERE students.id = student_parents.student_id AND students.school_id = (SELECT school_id FROM profiles WHERE id = auth.uid())));

CREATE POLICY "Admins can manage student_parents"
  ON student_parents FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM students WHERE students.id = student_parents.student_id AND students.school_id = (SELECT school_id FROM profiles WHERE id = auth.uid())) AND EXISTS (SELECT 1 FROM profiles p JOIN roles r ON p.role_id = r.id WHERE p.id = auth.uid() AND r.name IN ('super_admin', 'admin', 'director')));

CREATE POLICY "Authenticated users can view teachers in their school"
  ON teachers FOR SELECT TO authenticated
  USING (school_id = (SELECT school_id FROM profiles WHERE id = auth.uid()));

CREATE POLICY "Admins can manage teachers"
  ON teachers FOR ALL TO authenticated
  USING (school_id = (SELECT school_id FROM profiles WHERE id = auth.uid()) AND EXISTS (SELECT 1 FROM profiles p JOIN roles r ON p.role_id = r.id WHERE p.id = auth.uid() AND r.name IN ('super_admin', 'admin', 'director')));

CREATE POLICY "Authenticated users can view staff in their school"
  ON staff FOR SELECT TO authenticated
  USING (school_id = (SELECT school_id FROM profiles WHERE id = auth.uid()));

CREATE POLICY "Admins can manage staff"
  ON staff FOR ALL TO authenticated
  USING (school_id = (SELECT school_id FROM profiles WHERE id = auth.uid()) AND EXISTS (SELECT 1 FROM profiles p JOIN roles r ON p.role_id = r.id WHERE p.id = auth.uid() AND r.name IN ('super_admin', 'admin', 'director')));

CREATE POLICY "Authenticated users can view enrollments in their school"
  ON enrollments FOR SELECT TO authenticated
  USING (school_id = (SELECT school_id FROM profiles WHERE id = auth.uid()));

CREATE POLICY "Admins can manage enrollments"
  ON enrollments FOR ALL TO authenticated
  USING (school_id = (SELECT school_id FROM profiles WHERE id = auth.uid()) AND EXISTS (SELECT 1 FROM profiles p JOIN roles r ON p.role_id = r.id WHERE p.id = auth.uid() AND r.name IN ('super_admin', 'admin', 'director')));

-- Index for performance
CREATE INDEX IF NOT EXISTS idx_students_school_id ON students(school_id);
CREATE INDEX IF NOT EXISTS idx_students_matricule ON students(matricule);
CREATE INDEX IF NOT EXISTS idx_parents_school_id ON parents(school_id);
CREATE INDEX IF NOT EXISTS idx_teachers_school_id ON teachers(school_id);
CREATE INDEX IF NOT EXISTS idx_staff_school_id ON staff(school_id);
CREATE INDEX IF NOT EXISTS idx_enrollments_student_id ON enrollments(student_id);
CREATE INDEX IF NOT EXISTS idx_enrollments_class_id ON enrollments(class_id);
