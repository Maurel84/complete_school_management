/*
  # Academic and Communication Schema

  1. New Tables
    - `attendance` - Student attendance/absence records
    - `grades` - Student grades per subject/assignment
    - `report_cards` - Term/semester report cards
    - `report_card_items` - Individual subject entries in report cards
    - `schedules` - Timetable entries
    - `teacher_subjects` - Teacher-subject-class assignments
    - `messages` - Internal messaging
    - `notifications` - System notifications
    - `discipline_records` - Discipline/sanction records
    - `documents` - Uploaded/generated documents
    - `audit_logs` - Audit trail

  2. Security
    - RLS on all tables, school-scoped
*/

CREATE TABLE IF NOT EXISTS attendance (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id uuid REFERENCES schools(id) ON DELETE CASCADE NOT NULL,
  student_id uuid REFERENCES students(id) ON DELETE CASCADE NOT NULL,
  class_id uuid REFERENCES classes(id),
  date date DEFAULT CURRENT_DATE,
  status text NOT NULL DEFAULT 'present',
  arrival_time time,
  reason text DEFAULT '',
  justified boolean DEFAULT false,
  recorded_by uuid REFERENCES profiles(id),
  created_at timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS grades (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id uuid REFERENCES schools(id) ON DELETE CASCADE NOT NULL,
  student_id uuid REFERENCES students(id) ON DELETE CASCADE NOT NULL,
  subject_id uuid REFERENCES subjects(id) NOT NULL,
  class_id uuid REFERENCES classes(id),
  teacher_id uuid REFERENCES teachers(id),
  academic_year_id uuid REFERENCES academic_years(id),
  term text DEFAULT '1',
  grade_type text DEFAULT 'devoir',
  title text DEFAULT '',
  score numeric(5,2) NOT NULL DEFAULT 0,
  max_score numeric(5,2) NOT NULL DEFAULT 20,
  coefficient numeric(5,2) DEFAULT 1,
  date date DEFAULT CURRENT_DATE,
  comments text DEFAULT '',
  created_by uuid REFERENCES profiles(id),
  created_at timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS report_cards (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id uuid REFERENCES schools(id) ON DELETE CASCADE NOT NULL,
  student_id uuid REFERENCES students(id) ON DELETE CASCADE NOT NULL,
  class_id uuid REFERENCES classes(id),
  academic_year_id uuid REFERENCES academic_years(id) NOT NULL,
  term text NOT NULL DEFAULT '1',
  overall_average numeric(5,2) DEFAULT 0,
  rank int DEFAULT 0,
  class_size int DEFAULT 0,
  appreciation text DEFAULT '',
  decision text DEFAULT '',
  published boolean DEFAULT false,
  created_at timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS report_card_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  report_card_id uuid REFERENCES report_cards(id) ON DELETE CASCADE NOT NULL,
  subject_id uuid REFERENCES subjects(id) NOT NULL,
  average numeric(5,2) DEFAULT 0,
  coefficient numeric(5,2) DEFAULT 1,
  weighted_average numeric(5,2) DEFAULT 0,
  class_average numeric(5,2) DEFAULT 0,
  rank int DEFAULT 0,
  appreciation text DEFAULT '',
  teacher_comment text DEFAULT ''
);

CREATE TABLE IF NOT EXISTS schedules (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id uuid REFERENCES schools(id) ON DELETE CASCADE NOT NULL,
  class_id uuid REFERENCES classes(id),
  teacher_id uuid REFERENCES teachers(id),
  subject_id uuid REFERENCES subjects(id),
  day_of_week int NOT NULL DEFAULT 1,
  start_time time NOT NULL,
  end_time time NOT NULL,
  room text DEFAULT '',
  academic_year_id uuid REFERENCES academic_years(id),
  created_at timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS teacher_subjects (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id uuid REFERENCES schools(id) ON DELETE CASCADE NOT NULL,
  teacher_id uuid REFERENCES teachers(id) ON DELETE CASCADE NOT NULL,
  subject_id uuid REFERENCES subjects(id) ON DELETE CASCADE NOT NULL,
  class_id uuid REFERENCES classes(id) ON DELETE CASCADE NOT NULL,
  academic_year_id uuid REFERENCES academic_years(id),
  is_principal boolean DEFAULT false,
  created_at timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id uuid REFERENCES schools(id) ON DELETE CASCADE NOT NULL,
  sender_id uuid REFERENCES profiles(id) NOT NULL,
  recipient_id uuid REFERENCES profiles(id),
  subject text DEFAULT '',
  content text NOT NULL,
  is_read boolean DEFAULT false,
  is_announcement boolean DEFAULT false,
  created_at timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS notifications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id uuid REFERENCES schools(id) ON DELETE CASCADE NOT NULL,
  user_id uuid REFERENCES profiles(id) NOT NULL,
  type text NOT NULL DEFAULT 'info',
  title text NOT NULL,
  message text DEFAULT '',
  is_read boolean DEFAULT false,
  link text DEFAULT '',
  created_at timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS discipline_records (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id uuid REFERENCES schools(id) ON DELETE CASCADE NOT NULL,
  student_id uuid REFERENCES students(id) ON DELETE CASCADE NOT NULL,
  type text NOT NULL DEFAULT 'observation',
  description text NOT NULL,
  date date DEFAULT CURRENT_DATE,
  sanction text DEFAULT '',
  reported_by uuid REFERENCES profiles(id),
  parent_notified boolean DEFAULT false,
  created_at timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS documents (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id uuid REFERENCES schools(id) ON DELETE CASCADE NOT NULL,
  entity_type text NOT NULL,
  entity_id uuid NOT NULL,
  document_type text NOT NULL,
  title text NOT NULL,
  file_url text DEFAULT '',
  file_size bigint DEFAULT 0,
  uploaded_by uuid REFERENCES profiles(id),
  created_at timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS audit_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id uuid REFERENCES schools(id) ON DELETE CASCADE,
  user_id uuid REFERENCES auth.users(id),
  action text NOT NULL,
  entity_type text DEFAULT '',
  entity_id uuid,
  details jsonb DEFAULT '{}',
  ip_address text DEFAULT '',
  created_at timestamptz DEFAULT now()
);

ALTER TABLE attendance ENABLE ROW LEVEL SECURITY;
ALTER TABLE grades ENABLE ROW LEVEL SECURITY;
ALTER TABLE report_cards ENABLE ROW LEVEL SECURITY;
ALTER TABLE report_card_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE schedules ENABLE ROW LEVEL SECURITY;
ALTER TABLE teacher_subjects ENABLE ROW LEVEL SECURITY;
ALTER TABLE messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE discipline_records ENABLE ROW LEVEL SECURITY;
ALTER TABLE documents ENABLE ROW LEVEL SECURITY;
ALTER TABLE audit_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can view attendance" ON attendance FOR SELECT TO authenticated USING (school_id = (SELECT school_id FROM profiles WHERE id = auth.uid()));
CREATE POLICY "Staff can manage attendance" ON attendance FOR ALL TO authenticated USING (school_id = (SELECT school_id FROM profiles WHERE id = auth.uid()) AND EXISTS (SELECT 1 FROM profiles p JOIN roles r ON p.role_id = r.id WHERE p.id = auth.uid() AND r.name IN ('super_admin', 'admin', 'director', 'supervisor', 'teacher')));

CREATE POLICY "Authenticated users can view grades" ON grades FOR SELECT TO authenticated USING (school_id = (SELECT school_id FROM profiles WHERE id = auth.uid()));
CREATE POLICY "Teachers and admins can manage grades" ON grades FOR ALL TO authenticated USING (school_id = (SELECT school_id FROM profiles WHERE id = auth.uid()) AND EXISTS (SELECT 1 FROM profiles p JOIN roles r ON p.role_id = r.id WHERE p.id = auth.uid() AND r.name IN ('super_admin', 'admin', 'director', 'teacher')));

CREATE POLICY "Authenticated users can view report_cards" ON report_cards FOR SELECT TO authenticated USING (school_id = (SELECT school_id FROM profiles WHERE id = auth.uid()));
CREATE POLICY "Admins can manage report_cards" ON report_cards FOR ALL TO authenticated USING (school_id = (SELECT school_id FROM profiles WHERE id = auth.uid()) AND EXISTS (SELECT 1 FROM profiles p JOIN roles r ON p.role_id = r.id WHERE p.id = auth.uid() AND r.name IN ('super_admin', 'admin', 'director')));

CREATE POLICY "Authenticated users can view report_card_items" ON report_card_items FOR SELECT TO authenticated USING (EXISTS (SELECT 1 FROM report_cards WHERE report_cards.id = report_card_items.report_card_id AND report_cards.school_id = (SELECT school_id FROM profiles WHERE id = auth.uid())));
CREATE POLICY "Admins can manage report_card_items" ON report_card_items FOR ALL TO authenticated USING (EXISTS (SELECT 1 FROM report_cards WHERE report_cards.id = report_card_items.report_card_id AND report_cards.school_id = (SELECT school_id FROM profiles WHERE id = auth.uid())) AND EXISTS (SELECT 1 FROM profiles p JOIN roles r ON p.role_id = r.id WHERE p.id = auth.uid() AND r.name IN ('super_admin', 'admin', 'director')));

CREATE POLICY "Authenticated users can view schedules" ON schedules FOR SELECT TO authenticated USING (school_id = (SELECT school_id FROM profiles WHERE id = auth.uid()));
CREATE POLICY "Admins can manage schedules" ON schedules FOR ALL TO authenticated USING (school_id = (SELECT school_id FROM profiles WHERE id = auth.uid()) AND EXISTS (SELECT 1 FROM profiles p JOIN roles r ON p.role_id = r.id WHERE p.id = auth.uid() AND r.name IN ('super_admin', 'admin', 'director')));

CREATE POLICY "Authenticated users can view teacher_subjects" ON teacher_subjects FOR SELECT TO authenticated USING (school_id = (SELECT school_id FROM profiles WHERE id = auth.uid()));
CREATE POLICY "Admins can manage teacher_subjects" ON teacher_subjects FOR ALL TO authenticated USING (school_id = (SELECT school_id FROM profiles WHERE id = auth.uid()) AND EXISTS (SELECT 1 FROM profiles p JOIN roles r ON p.role_id = r.id WHERE p.id = auth.uid() AND r.name IN ('super_admin', 'admin', 'director')));

CREATE POLICY "Users can view their messages" ON messages FOR SELECT TO authenticated USING (school_id = (SELECT school_id FROM profiles WHERE id = auth.uid()) AND (sender_id = auth.uid() OR recipient_id = auth.uid() OR is_announcement = true));
CREATE POLICY "Authenticated users can send messages" ON messages FOR INSERT TO authenticated WITH CHECK (school_id = (SELECT school_id FROM profiles WHERE id = auth.uid()) AND sender_id = auth.uid());
CREATE POLICY "Users can update their messages" ON messages FOR UPDATE TO authenticated USING (recipient_id = auth.uid() AND school_id = (SELECT school_id FROM profiles WHERE id = auth.uid()));

CREATE POLICY "Users can view their notifications" ON notifications FOR SELECT TO authenticated USING (user_id = auth.uid());
CREATE POLICY "System can insert notifications" ON notifications FOR INSERT TO authenticated WITH CHECK (school_id = (SELECT school_id FROM profiles WHERE id = auth.uid()));
CREATE POLICY "Users can update their notifications" ON notifications FOR UPDATE TO authenticated USING (user_id = auth.uid());

CREATE POLICY "Authenticated users can view discipline" ON discipline_records FOR SELECT TO authenticated USING (school_id = (SELECT school_id FROM profiles WHERE id = auth.uid()));
CREATE POLICY "Staff can manage discipline" ON discipline_records FOR ALL TO authenticated USING (school_id = (SELECT school_id FROM profiles WHERE id = auth.uid()) AND EXISTS (SELECT 1 FROM profiles p JOIN roles r ON p.role_id = r.id WHERE p.id = auth.uid() AND r.name IN ('super_admin', 'admin', 'director', 'supervisor')));

CREATE POLICY "Authenticated users can view documents" ON documents FOR SELECT TO authenticated USING (school_id = (SELECT school_id FROM profiles WHERE id = auth.uid()));
CREATE POLICY "Authenticated users can manage documents" ON documents FOR ALL TO authenticated USING (school_id = (SELECT school_id FROM profiles WHERE id = auth.uid()) AND EXISTS (SELECT 1 FROM profiles p JOIN roles r ON p.role_id = r.id WHERE p.id = auth.uid() AND r.name IN ('super_admin', 'admin', 'director', 'teacher')));

CREATE POLICY "Admins can view audit_logs" ON audit_logs FOR SELECT TO authenticated USING (school_id = (SELECT school_id FROM profiles WHERE id = auth.uid()) AND EXISTS (SELECT 1 FROM profiles p JOIN roles r ON p.role_id = r.id WHERE p.id = auth.uid() AND r.name IN ('super_admin', 'admin')));
CREATE POLICY "System can insert audit_logs" ON audit_logs FOR INSERT TO authenticated WITH CHECK (true);

CREATE INDEX IF NOT EXISTS idx_attendance_student_date ON attendance(student_id, date);
CREATE INDEX IF NOT EXISTS idx_grades_student_subject ON grades(student_id, subject_id);
CREATE INDEX IF NOT EXISTS idx_schedules_class_day ON schedules(class_id, day_of_week);
CREATE INDEX IF NOT EXISTS idx_notifications_user ON notifications(user_id);
CREATE INDEX IF NOT EXISTS idx_messages_recipient ON messages(recipient_id);
CREATE INDEX IF NOT EXISTS idx_audit_logs_school ON audit_logs(school_id);
