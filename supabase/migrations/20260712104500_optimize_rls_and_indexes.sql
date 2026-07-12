-- Optimization migration for Row Level Security (RLS) and Indexing
-- Created: 2026-07-12
-- Author: Senior Full Stack Developer

-- ==========================================
-- 1. DATABASE INDEXES FOR PERFORMANCE
-- ==========================================

-- Payments indexes
CREATE INDEX IF NOT EXISTS idx_payments_dashboard_perf ON payments(school_id, payment_date DESC, amount);
CREATE INDEX IF NOT EXISTS idx_payments_school_status_perf ON payments(school_id, status);

-- Grades indexes
CREATE INDEX IF NOT EXISTS idx_grades_bulletin_perf ON grades(school_id, academic_year_id, class_id, term);
CREATE INDEX IF NOT EXISTS idx_grades_student_term_perf ON grades(student_id, academic_year_id, term);

-- Attendance indexes
CREATE INDEX IF NOT EXISTS idx_attendance_class_date_perf ON attendance(school_id, class_id, date);

-- Expenses indexes
CREATE INDEX IF NOT EXISTS idx_expenses_perf ON expenses(school_id, status, expense_date DESC);

-- Report Cards indexes
CREATE INDEX IF NOT EXISTS idx_report_cards_lookup_perf ON report_cards(school_id, academic_year_id, class_id, term);


-- ==========================================
-- 2. REFACTORING RLS POLICIES USING STABLE HELPER FUNCTIONS
-- ==========================================

-- ------------------------------------------
-- Table: roles
-- ------------------------------------------
DROP POLICY IF EXISTS "Authenticated users can view roles" ON roles;
DROP POLICY IF EXISTS "Admins can manage roles" ON roles;

CREATE POLICY "Authenticated users can view roles" 
  ON roles FOR SELECT TO authenticated 
  USING (true);

CREATE POLICY "Admins can manage roles" 
  ON roles FOR ALL TO authenticated 
  USING (public.current_profile_role_name() IN ('super_admin', 'admin'));

-- ------------------------------------------
-- Table: schools
-- ------------------------------------------
DROP POLICY IF EXISTS "Authenticated users can view their school" ON schools;
DROP POLICY IF EXISTS "Admins can manage schools" ON schools;

CREATE POLICY "Authenticated users can view their school" 
  ON schools FOR SELECT TO authenticated 
  USING (id = public.current_profile_school_id() OR public.current_profile_role_name() = 'super_admin');

CREATE POLICY "Admins can manage schools" 
  ON schools FOR ALL TO authenticated 
  USING (public.current_profile_role_name() IN ('super_admin', 'admin'));

-- ------------------------------------------
-- Table: levels
-- ------------------------------------------
DROP POLICY IF EXISTS "Authenticated users can view levels" ON levels;
DROP POLICY IF EXISTS "Admins can manage levels" ON levels;

CREATE POLICY "Authenticated users can view levels" 
  ON levels FOR SELECT TO authenticated 
  USING (school_id = public.current_profile_school_id());

CREATE POLICY "Admins can manage levels" 
  ON levels FOR ALL TO authenticated 
  USING (school_id = public.current_profile_school_id() AND public.current_profile_role_name() IN ('super_admin', 'admin', 'director'));

-- ------------------------------------------
-- Table: classes
-- ------------------------------------------
DROP POLICY IF EXISTS "Authenticated users can view classes" ON classes;
DROP POLICY IF EXISTS "Admins can manage classes" ON classes;

CREATE POLICY "Authenticated users can view classes" 
  ON classes FOR SELECT TO authenticated 
  USING (school_id = public.current_profile_school_id());

CREATE POLICY "Admins can manage classes" 
  ON classes FOR ALL TO authenticated 
  USING (school_id = public.current_profile_school_id() AND public.current_profile_role_name() IN ('super_admin', 'admin', 'director'));

-- ------------------------------------------
-- Table: academic_years
-- ------------------------------------------
DROP POLICY IF EXISTS "Authenticated users can view academic years" ON academic_years;
DROP POLICY IF EXISTS "Admins can manage academic years" ON academic_years;

CREATE POLICY "Authenticated users can view academic years" 
  ON academic_years FOR SELECT TO authenticated 
  USING (school_id = public.current_profile_school_id());

CREATE POLICY "Admins can manage academic years" 
  ON academic_years FOR ALL TO authenticated 
  USING (school_id = public.current_profile_school_id() AND public.current_profile_role_name() IN ('super_admin', 'admin', 'director'));

-- ------------------------------------------
-- Table: subjects
-- ------------------------------------------
DROP POLICY IF EXISTS "Authenticated users can view subjects" ON subjects;
DROP POLICY IF EXISTS "Admins can manage subjects" ON subjects;

CREATE POLICY "Authenticated users can view subjects" 
  ON subjects FOR SELECT TO authenticated 
  USING (school_id = public.current_profile_school_id());

CREATE POLICY "Admins can manage subjects" 
  ON subjects FOR ALL TO authenticated 
  USING (school_id = public.current_profile_school_id() AND public.current_profile_role_name() IN ('super_admin', 'admin', 'director'));

-- ------------------------------------------
-- Table: students
-- ------------------------------------------
DROP POLICY IF EXISTS "Authenticated users can view students in their school" ON students;
DROP POLICY IF EXISTS "Admins and staff can manage students" ON students;

CREATE POLICY "Authenticated users can view students in their school" 
  ON students FOR SELECT TO authenticated 
  USING (school_id = public.current_profile_school_id());

CREATE POLICY "Admins and staff can manage students" 
  ON students FOR ALL TO authenticated 
  USING (school_id = public.current_profile_school_id() AND public.current_profile_role_name() IN ('super_admin', 'admin', 'director', 'supervisor'));

-- ------------------------------------------
-- Table: parents
-- ------------------------------------------
DROP POLICY IF EXISTS "Authenticated users can view parents in their school" ON parents;
DROP POLICY IF EXISTS "Admins can manage parents" ON parents;

CREATE POLICY "Authenticated users can view parents in their school" 
  ON parents FOR SELECT TO authenticated 
  USING (school_id = public.current_profile_school_id());

CREATE POLICY "Admins can manage parents" 
  ON parents FOR ALL TO authenticated 
  USING (school_id = public.current_profile_school_id() AND public.current_profile_role_name() IN ('super_admin', 'admin', 'director'));

-- ------------------------------------------
-- Table: student_parents
-- ------------------------------------------
DROP POLICY IF EXISTS "Authenticated users can view student_parents in their school" ON student_parents;
DROP POLICY IF EXISTS "Admins can manage student_parents" ON student_parents;

CREATE POLICY "Authenticated users can view student_parents in their school" 
  ON student_parents FOR SELECT TO authenticated 
  USING (EXISTS (SELECT 1 FROM students WHERE students.id = student_parents.student_id AND students.school_id = public.current_profile_school_id()));

CREATE POLICY "Admins can manage student_parents" 
  ON student_parents FOR ALL TO authenticated 
  USING (EXISTS (SELECT 1 FROM students WHERE students.id = student_parents.student_id AND students.school_id = public.current_profile_school_id()) AND public.current_profile_role_name() IN ('super_admin', 'admin', 'director'));

-- ------------------------------------------
-- Table: teachers
-- ------------------------------------------
DROP POLICY IF EXISTS "Authenticated users can view teachers in their school" ON teachers;
DROP POLICY IF EXISTS "Admins can manage teachers" ON teachers;

CREATE POLICY "Authenticated users can view teachers in their school" 
  ON teachers FOR SELECT TO authenticated 
  USING (school_id = public.current_profile_school_id());

CREATE POLICY "Admins can manage teachers" 
  ON teachers FOR ALL TO authenticated 
  USING (school_id = public.current_profile_school_id() AND public.current_profile_role_name() IN ('super_admin', 'admin', 'director'));

-- ------------------------------------------
-- Table: staff
-- ------------------------------------------
DROP POLICY IF EXISTS "Authenticated users can view staff in their school" ON staff;
DROP POLICY IF EXISTS "Admins can manage staff" ON staff;

CREATE POLICY "Authenticated users can view staff in their school" 
  ON staff FOR SELECT TO authenticated 
  USING (school_id = public.current_profile_school_id());

CREATE POLICY "Admins can manage staff" 
  ON staff FOR ALL TO authenticated 
  USING (school_id = public.current_profile_school_id() AND public.current_profile_role_name() IN ('super_admin', 'admin', 'director'));

-- ------------------------------------------
-- Table: enrollments
-- ------------------------------------------
DROP POLICY IF EXISTS "Authenticated users can view enrollments in their school" ON enrollments;
DROP POLICY IF EXISTS "Admins can manage enrollments" ON enrollments;

CREATE POLICY "Authenticated users can view enrollments in their school" 
  ON enrollments FOR SELECT TO authenticated 
  USING (school_id = public.current_profile_school_id());

CREATE POLICY "Admins can manage enrollments" 
  ON enrollments FOR ALL TO authenticated 
  USING (school_id = public.current_profile_school_id() AND public.current_profile_role_name() IN ('super_admin', 'admin', 'director'));

-- ------------------------------------------
-- Table: fee_types
-- ------------------------------------------
DROP POLICY IF EXISTS "Authenticated users can view fee_types" ON fee_types;
DROP POLICY IF EXISTS "Financial roles can manage fee_types" ON fee_types;

CREATE POLICY "Authenticated users can view fee_types" 
  ON fee_types FOR SELECT TO authenticated 
  USING (school_id = public.current_profile_school_id());

CREATE POLICY "Financial roles can manage fee_types" 
  ON fee_types FOR ALL TO authenticated 
  USING (school_id = public.current_profile_school_id() AND public.current_profile_role_name() IN ('super_admin', 'admin', 'accountant', 'director'));

-- ------------------------------------------
-- Table: fees
-- ------------------------------------------
DROP POLICY IF EXISTS "Authenticated users can view fees" ON fees;
DROP POLICY IF EXISTS "Financial roles can manage fees" ON fees;

CREATE POLICY "Authenticated users can view fees" 
  ON fees FOR SELECT TO authenticated 
  USING (school_id = public.current_profile_school_id());

CREATE POLICY "Financial roles can manage fees" 
  ON fees FOR ALL TO authenticated 
  USING (school_id = public.current_profile_school_id() AND public.current_profile_role_name() IN ('super_admin', 'admin', 'accountant', 'director'));

-- ------------------------------------------
-- Table: payments
-- ------------------------------------------
DROP POLICY IF EXISTS "Authenticated users can view payments" ON payments;
DROP POLICY IF EXISTS "Financial roles can manage payments" ON payments;

CREATE POLICY "Authenticated users can view payments" 
  ON payments FOR SELECT TO authenticated 
  USING (school_id = public.current_profile_school_id());

CREATE POLICY "Financial roles can manage payments" 
  ON payments FOR ALL TO authenticated 
  USING (school_id = public.current_profile_school_id() AND public.current_profile_role_name() IN ('super_admin', 'admin', 'accountant', 'cashier', 'director'));

-- ------------------------------------------
-- Table: cash_registers
-- ------------------------------------------
DROP POLICY IF EXISTS "Authenticated users can view cash_registers" ON cash_registers;
DROP POLICY IF EXISTS "Cashiers and admins can manage cash_registers" ON cash_registers;

CREATE POLICY "Authenticated users can view cash_registers" 
  ON cash_registers FOR SELECT TO authenticated 
  USING (school_id = public.current_profile_school_id());

CREATE POLICY "Cashiers and admins can manage cash_registers" 
  ON cash_registers FOR ALL TO authenticated 
  USING (school_id = public.current_profile_school_id() AND public.current_profile_role_name() IN ('super_admin', 'admin', 'cashier', 'accountant'));

-- ------------------------------------------
-- Table: cash_transactions
-- ------------------------------------------
DROP POLICY IF EXISTS "Authenticated users can view cash_transactions" ON cash_transactions;
DROP POLICY IF EXISTS "Cashiers and admins can manage cash_transactions" ON cash_transactions;

CREATE POLICY "Authenticated users can view cash_transactions" 
  ON cash_transactions FOR SELECT TO authenticated 
  USING (school_id = public.current_profile_school_id());

CREATE POLICY "Cashiers and admins can manage cash_transactions" 
  ON cash_transactions FOR ALL TO authenticated 
  USING (school_id = public.current_profile_school_id() AND public.current_profile_role_name() IN ('super_admin', 'admin', 'cashier', 'accountant'));

-- ------------------------------------------
-- Table: expenses
-- ------------------------------------------
DROP POLICY IF EXISTS "Authenticated users can view expenses" ON expenses;
DROP POLICY IF EXISTS "Financial roles can manage expenses" ON expenses;

CREATE POLICY "Authenticated users can view expenses" 
  ON expenses FOR SELECT TO authenticated 
  USING (school_id = public.current_profile_school_id());

CREATE POLICY "Financial roles can manage expenses" 
  ON expenses FOR ALL TO authenticated 
  USING (school_id = public.current_profile_school_id() AND public.current_profile_role_name() IN ('super_admin', 'admin', 'accountant', 'director'));

-- ------------------------------------------
-- Table: accounting_accounts
-- ------------------------------------------
DROP POLICY IF EXISTS "Authenticated users can view accounting_accounts" ON accounting_accounts;
DROP POLICY IF EXISTS "Accountants can manage accounting_accounts" ON accounting_accounts;

CREATE POLICY "Authenticated users can view accounting_accounts" 
  ON accounting_accounts FOR SELECT TO authenticated 
  USING (school_id = public.current_profile_school_id());

CREATE POLICY "Accountants can manage accounting_accounts" 
  ON accounting_accounts FOR ALL TO authenticated 
  USING (school_id = public.current_profile_school_id() AND public.current_profile_role_name() IN ('super_admin', 'admin', 'accountant'));

-- ------------------------------------------
-- Table: accounting_entries
-- ------------------------------------------
DROP POLICY IF EXISTS "Authenticated users can view accounting_entries" ON accounting_entries;
DROP POLICY IF EXISTS "Accountants can manage accounting_entries" ON accounting_entries;

CREATE POLICY "Authenticated users can view accounting_entries" 
  ON accounting_entries FOR SELECT TO authenticated 
  USING (school_id = public.current_profile_school_id());

CREATE POLICY "Accountants can manage accounting_entries" 
  ON accounting_entries FOR ALL TO authenticated 
  USING (school_id = public.current_profile_school_id() AND public.current_profile_role_name() IN ('super_admin', 'admin', 'accountant'));

-- ------------------------------------------
-- Table: payrolls
-- ------------------------------------------
DROP POLICY IF EXISTS "Authenticated users can view payrolls" ON payrolls;
DROP POLICY IF EXISTS "Admins and accountants can manage payrolls" ON payrolls;

CREATE POLICY "Authenticated users can view payrolls" 
  ON payrolls FOR SELECT TO authenticated 
  USING (school_id = public.current_profile_school_id());

CREATE POLICY "Admins and accountants can manage payrolls" 
  ON payrolls FOR ALL TO authenticated 
  USING (school_id = public.current_profile_school_id() AND public.current_profile_role_name() IN ('super_admin', 'admin', 'accountant', 'director'));

-- ------------------------------------------
-- Table: discounts
-- ------------------------------------------
DROP POLICY IF EXISTS "Authenticated users can view discounts" ON discounts;
DROP POLICY IF EXISTS "Admins can manage discounts" ON discounts;

CREATE POLICY "Authenticated users can view discounts" 
  ON discounts FOR SELECT TO authenticated 
  USING (school_id = public.current_profile_school_id());

CREATE POLICY "Admins can manage discounts" 
  ON discounts FOR ALL TO authenticated 
  USING (school_id = public.current_profile_school_id() AND public.current_profile_role_name() IN ('super_admin', 'admin', 'director'));

-- ------------------------------------------
-- Table: attendance
-- ------------------------------------------
DROP POLICY IF EXISTS "Authenticated users can view attendance" ON attendance;
DROP POLICY IF EXISTS "Staff can manage attendance" ON attendance;

CREATE POLICY "Authenticated users can view attendance" 
  ON attendance FOR SELECT TO authenticated 
  USING (school_id = public.current_profile_school_id());

CREATE POLICY "Staff can manage attendance" 
  ON attendance FOR ALL TO authenticated 
  USING (school_id = public.current_profile_school_id() AND public.current_profile_role_name() IN ('super_admin', 'admin', 'director', 'supervisor', 'teacher'));

-- ------------------------------------------
-- Table: grades
-- ------------------------------------------
DROP POLICY IF EXISTS "Authenticated users can view grades" ON grades;
DROP POLICY IF EXISTS "Teachers and admins can manage grades" ON grades;

CREATE POLICY "Authenticated users can view grades" 
  ON grades FOR SELECT TO authenticated 
  USING (school_id = public.current_profile_school_id());

CREATE POLICY "Teachers and admins can manage grades" 
  ON grades FOR ALL TO authenticated 
  USING (school_id = public.current_profile_school_id() AND public.current_profile_role_name() IN ('super_admin', 'admin', 'director', 'teacher'));

-- ------------------------------------------
-- Table: report_cards
-- ------------------------------------------
DROP POLICY IF EXISTS "Authenticated users can view report_cards" ON report_cards;
DROP POLICY IF EXISTS "Admins can manage report_cards" ON report_cards;

CREATE POLICY "Authenticated users can view report_cards" 
  ON report_cards FOR SELECT TO authenticated 
  USING (school_id = public.current_profile_school_id());

CREATE POLICY "Admins can manage report_cards" 
  ON report_cards FOR ALL TO authenticated 
  USING (school_id = public.current_profile_school_id() AND public.current_profile_role_name() IN ('super_admin', 'admin', 'director'));

-- ------------------------------------------
-- Table: report_card_items
-- ------------------------------------------
DROP POLICY IF EXISTS "Authenticated users can view report_card_items" ON report_card_items;
DROP POLICY IF EXISTS "Admins can manage report_card_items" ON report_card_items;

CREATE POLICY "Authenticated users can view report_card_items" 
  ON report_card_items FOR SELECT TO authenticated 
  USING (EXISTS (SELECT 1 FROM report_cards WHERE report_cards.id = report_card_items.report_card_id AND report_cards.school_id = public.current_profile_school_id()));

CREATE POLICY "Admins can manage report_card_items" 
  ON report_card_items FOR ALL TO authenticated 
  USING (EXISTS (SELECT 1 FROM report_cards WHERE report_cards.id = report_card_items.report_card_id AND report_cards.school_id = public.current_profile_school_id()) AND public.current_profile_role_name() IN ('super_admin', 'admin', 'director'));

-- ------------------------------------------
-- Table: schedules
-- ------------------------------------------
DROP POLICY IF EXISTS "Authenticated users can view schedules" ON schedules;
DROP POLICY IF EXISTS "Admins can manage schedules" ON schedules;

CREATE POLICY "Authenticated users can view schedules" 
  ON schedules FOR SELECT TO authenticated 
  USING (school_id = public.current_profile_school_id());

CREATE POLICY "Admins can manage schedules" 
  ON schedules FOR ALL TO authenticated 
  USING (school_id = public.current_profile_school_id() AND public.current_profile_role_name() IN ('super_admin', 'admin', 'director'));

-- ------------------------------------------
-- Table: teacher_subjects
-- ------------------------------------------
DROP POLICY IF EXISTS "Authenticated users can view teacher_subjects" ON teacher_subjects;
DROP POLICY IF EXISTS "Admins can manage teacher_subjects" ON teacher_subjects;

CREATE POLICY "Authenticated users can view teacher_subjects" 
  ON teacher_subjects FOR SELECT TO authenticated 
  USING (school_id = public.current_profile_school_id());

CREATE POLICY "Admins can manage teacher_subjects" 
  ON teacher_subjects FOR ALL TO authenticated 
  USING (school_id = public.current_profile_school_id() AND public.current_profile_role_name() IN ('super_admin', 'admin', 'director'));

-- ------------------------------------------
-- Table: messages
-- ------------------------------------------
DROP POLICY IF EXISTS "Users can view their messages" ON messages;
DROP POLICY IF EXISTS "Authenticated users can send messages" ON messages;
DROP POLICY IF EXISTS "Users can update their messages" ON messages;

CREATE POLICY "Users can view their messages" 
  ON messages FOR SELECT TO authenticated 
  USING (school_id = public.current_profile_school_id() AND (sender_id = auth.uid() OR recipient_id = auth.uid() OR is_announcement = true));

CREATE POLICY "Authenticated users can send messages" 
  ON messages FOR INSERT TO authenticated 
  WITH CHECK (school_id = public.current_profile_school_id() AND sender_id = auth.uid());

CREATE POLICY "Users can update their messages" 
  ON messages FOR UPDATE TO authenticated 
  USING (recipient_id = auth.uid() AND school_id = public.current_profile_school_id());

-- ------------------------------------------
-- Table: notifications
-- ------------------------------------------
DROP POLICY IF EXISTS "Users can view their notifications" ON notifications;
DROP POLICY IF EXISTS "System can insert notifications" ON notifications;
DROP POLICY IF EXISTS "Users can update their notifications" ON notifications;

CREATE POLICY "Users can view their notifications" 
  ON notifications FOR SELECT TO authenticated 
  USING (user_id = auth.uid());

CREATE POLICY "System can insert notifications" 
  ON notifications FOR INSERT TO authenticated 
  WITH CHECK (school_id = public.current_profile_school_id());

CREATE POLICY "Users can update their notifications" 
  ON notifications FOR UPDATE TO authenticated 
  USING (user_id = auth.uid());

-- ------------------------------------------
-- Table: discipline_records
-- ------------------------------------------
DROP POLICY IF EXISTS "Authenticated users can view discipline" ON discipline_records;
DROP POLICY IF EXISTS "Staff can manage discipline" ON discipline_records;

CREATE POLICY "Authenticated users can view discipline" 
  ON discipline_records FOR SELECT TO authenticated 
  USING (school_id = public.current_profile_school_id());

CREATE POLICY "Staff can manage discipline" 
  ON discipline_records FOR ALL TO authenticated 
  USING (school_id = public.current_profile_school_id() AND public.current_profile_role_name() IN ('super_admin', 'admin', 'director', 'supervisor'));

-- ------------------------------------------
-- Table: documents
-- ------------------------------------------
DROP POLICY IF EXISTS "Authenticated users can view documents" ON documents;
DROP POLICY IF EXISTS "Authenticated users can manage documents" ON documents;

CREATE POLICY "Authenticated users can view documents" 
  ON documents FOR SELECT TO authenticated 
  USING (school_id = public.current_profile_school_id());

CREATE POLICY "Authenticated users can manage documents" 
  ON documents FOR ALL TO authenticated 
  USING (school_id = public.current_profile_school_id() AND public.current_profile_role_name() IN ('super_admin', 'admin', 'director', 'teacher'));

-- ------------------------------------------
-- Table: audit_logs
-- ------------------------------------------
DROP POLICY IF EXISTS "Admins can view audit_logs" ON audit_logs;
DROP POLICY IF EXISTS "System can insert audit_logs" ON audit_logs;

CREATE POLICY "Admins can view audit_logs" 
  ON audit_logs FOR SELECT TO authenticated 
  USING (school_id = public.current_profile_school_id() AND public.current_profile_role_name() IN ('super_admin', 'admin'));

CREATE POLICY "System can insert audit_logs" 
  ON audit_logs FOR INSERT TO authenticated 
  WITH CHECK (true);
