/*
  # Financial Schema - Fees, Payments, Cash, Accounting

  1. New Tables
    - `fee_types` - Types of fees (inscription, scolarite, etc.)
    - `fees` - Fee assignments per class/level with amounts
    - `payments` - Payment records with receipt numbers
    - `cash_registers` - Cash register sessions (open/close)
    - `cash_transactions` - Cash in/out transactions
    - `expenses` - Expense records
    - `accounting_accounts` - Chart of accounts
    - `accounting_entries` - Journal entries
    - `payrolls` - Payroll records for staff/teachers
    - `discounts` - Discounts and scholarships

  2. Security
    - RLS on all tables
    - School-scoped access
    - Financial roles (accountant, cashier) have write access
*/

CREATE TABLE IF NOT EXISTS fee_types (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id uuid REFERENCES schools(id) ON DELETE CASCADE NOT NULL,
  name text NOT NULL,
  description text DEFAULT '',
  is_recurring boolean DEFAULT false,
  created_at timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS fees (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id uuid REFERENCES schools(id) ON DELETE CASCADE NOT NULL,
  fee_type_id uuid REFERENCES fee_types(id) ON DELETE CASCADE NOT NULL,
  academic_year_id uuid REFERENCES academic_years(id) NOT NULL,
  level_id uuid REFERENCES levels(id),
  class_id uuid REFERENCES classes(id),
  amount numeric(12,2) NOT NULL DEFAULT 0,
  due_date date,
  description text DEFAULT '',
  created_at timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS payments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id uuid REFERENCES schools(id) ON DELETE CASCADE NOT NULL,
  student_id uuid REFERENCES students(id) ON DELETE CASCADE NOT NULL,
  fee_id uuid REFERENCES fees(id),
  parent_id uuid REFERENCES parents(id),
  receipt_number text UNIQUE NOT NULL,
  amount numeric(12,2) NOT NULL DEFAULT 0,
  payment_method text DEFAULT 'cash',
  payment_date date DEFAULT CURRENT_DATE,
  status text DEFAULT 'paid',
  academic_year_id uuid REFERENCES academic_years(id),
  processed_by uuid REFERENCES profiles(id),
  notes text DEFAULT '',
  created_at timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS cash_registers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id uuid REFERENCES schools(id) ON DELETE CASCADE NOT NULL,
  cashier_id uuid REFERENCES profiles(id),
  opening_balance numeric(12,2) NOT NULL DEFAULT 0,
  closing_balance numeric(12,2),
  opened_at timestamptz DEFAULT now(),
  closed_at timestamptz,
  status text DEFAULT 'open',
  created_at timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS cash_transactions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id uuid REFERENCES schools(id) ON DELETE CASCADE NOT NULL,
  cash_register_id uuid REFERENCES cash_registers(id),
  transaction_number text UNIQUE NOT NULL,
  type text NOT NULL DEFAULT 'in',
  amount numeric(12,2) NOT NULL DEFAULT 0,
  description text DEFAULT '',
  category text DEFAULT '',
  payment_id uuid REFERENCES payments(id),
  processed_by uuid REFERENCES profiles(id),
  validated_by uuid REFERENCES profiles(id),
  validated boolean DEFAULT false,
  created_at timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS expenses (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id uuid REFERENCES schools(id) ON DELETE CASCADE NOT NULL,
  category text DEFAULT '',
  description text NOT NULL,
  amount numeric(12,2) NOT NULL DEFAULT 0,
  expense_date date DEFAULT CURRENT_DATE,
  supplier text DEFAULT '',
  invoice_number text DEFAULT '',
  processed_by uuid REFERENCES profiles(id),
  validated_by uuid REFERENCES profiles(id),
  status text DEFAULT 'pending',
  created_at timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS accounting_accounts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id uuid REFERENCES schools(id) ON DELETE CASCADE NOT NULL,
  account_number text NOT NULL,
  name text NOT NULL,
  account_type text NOT NULL DEFAULT 'asset',
  parent_id uuid REFERENCES accounting_accounts(id),
  created_at timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS accounting_entries (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id uuid REFERENCES schools(id) ON DELETE CASCADE NOT NULL,
  account_id uuid REFERENCES accounting_accounts(id) NOT NULL,
  entry_number text NOT NULL,
  debit numeric(12,2) DEFAULT 0,
  credit numeric(12,2) DEFAULT 0,
  description text DEFAULT '',
  entry_date date DEFAULT CURRENT_DATE,
  reference text DEFAULT '',
  created_by uuid REFERENCES profiles(id),
  created_at timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS payrolls (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id uuid REFERENCES schools(id) ON DELETE CASCADE NOT NULL,
  person_id uuid NOT NULL,
  person_type text NOT NULL DEFAULT 'teacher',
  month int NOT NULL,
  year int NOT NULL,
  base_salary numeric(12,2) DEFAULT 0,
  bonuses numeric(12,2) DEFAULT 0,
  deductions numeric(12,2) DEFAULT 0,
  net_salary numeric(12,2) DEFAULT 0,
  status text DEFAULT 'pending',
  paid_date date,
  created_at timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS discounts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id uuid REFERENCES schools(id) ON DELETE CASCADE NOT NULL,
  student_id uuid REFERENCES students(id) ON DELETE CASCADE NOT NULL,
  fee_id uuid REFERENCES fees(id),
  type text DEFAULT 'discount',
  amount numeric(12,2) DEFAULT 0,
  percentage numeric(5,2) DEFAULT 0,
  reason text DEFAULT '',
  approved_by uuid REFERENCES profiles(id),
  academic_year_id uuid REFERENCES academic_years(id),
  created_at timestamptz DEFAULT now()
);

ALTER TABLE fee_types ENABLE ROW LEVEL SECURITY;
ALTER TABLE fees ENABLE ROW LEVEL SECURITY;
ALTER TABLE payments ENABLE ROW LEVEL SECURITY;
ALTER TABLE cash_registers ENABLE ROW LEVEL SECURITY;
ALTER TABLE cash_transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE expenses ENABLE ROW LEVEL SECURITY;
ALTER TABLE accounting_accounts ENABLE ROW LEVEL SECURITY;
ALTER TABLE accounting_entries ENABLE ROW LEVEL SECURITY;
ALTER TABLE payrolls ENABLE ROW LEVEL SECURITY;
ALTER TABLE discounts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can view fee_types" ON fee_types FOR SELECT TO authenticated USING (school_id = (SELECT school_id FROM profiles WHERE id = auth.uid()));
CREATE POLICY "Financial roles can manage fee_types" ON fee_types FOR ALL TO authenticated USING (school_id = (SELECT school_id FROM profiles WHERE id = auth.uid()) AND EXISTS (SELECT 1 FROM profiles p JOIN roles r ON p.role_id = r.id WHERE p.id = auth.uid() AND r.name IN ('super_admin', 'admin', 'accountant', 'director')));

CREATE POLICY "Authenticated users can view fees" ON fees FOR SELECT TO authenticated USING (school_id = (SELECT school_id FROM profiles WHERE id = auth.uid()));
CREATE POLICY "Financial roles can manage fees" ON fees FOR ALL TO authenticated USING (school_id = (SELECT school_id FROM profiles WHERE id = auth.uid()) AND EXISTS (SELECT 1 FROM profiles p JOIN roles r ON p.role_id = r.id WHERE p.id = auth.uid() AND r.name IN ('super_admin', 'admin', 'accountant', 'director')));

CREATE POLICY "Authenticated users can view payments" ON payments FOR SELECT TO authenticated USING (school_id = (SELECT school_id FROM profiles WHERE id = auth.uid()));
CREATE POLICY "Financial roles can manage payments" ON payments FOR ALL TO authenticated USING (school_id = (SELECT school_id FROM profiles WHERE id = auth.uid()) AND EXISTS (SELECT 1 FROM profiles p JOIN roles r ON p.role_id = r.id WHERE p.id = auth.uid() AND r.name IN ('super_admin', 'admin', 'accountant', 'cashier', 'director')));

CREATE POLICY "Authenticated users can view cash_registers" ON cash_registers FOR SELECT TO authenticated USING (school_id = (SELECT school_id FROM profiles WHERE id = auth.uid()));
CREATE POLICY "Cashiers and admins can manage cash_registers" ON cash_registers FOR ALL TO authenticated USING (school_id = (SELECT school_id FROM profiles WHERE id = auth.uid()) AND EXISTS (SELECT 1 FROM profiles p JOIN roles r ON p.role_id = r.id WHERE p.id = auth.uid() AND r.name IN ('super_admin', 'admin', 'cashier', 'accountant')));

CREATE POLICY "Authenticated users can view cash_transactions" ON cash_transactions FOR SELECT TO authenticated USING (school_id = (SELECT school_id FROM profiles WHERE id = auth.uid()));
CREATE POLICY "Cashiers and admins can manage cash_transactions" ON cash_transactions FOR ALL TO authenticated USING (school_id = (SELECT school_id FROM profiles WHERE id = auth.uid()) AND EXISTS (SELECT 1 FROM profiles p JOIN roles r ON p.role_id = r.id WHERE p.id = auth.uid() AND r.name IN ('super_admin', 'admin', 'cashier', 'accountant')));

CREATE POLICY "Authenticated users can view expenses" ON expenses FOR SELECT TO authenticated USING (school_id = (SELECT school_id FROM profiles WHERE id = auth.uid()));
CREATE POLICY "Financial roles can manage expenses" ON expenses FOR ALL TO authenticated USING (school_id = (SELECT school_id FROM profiles WHERE id = auth.uid()) AND EXISTS (SELECT 1 FROM profiles p JOIN roles r ON p.role_id = r.id WHERE p.id = auth.uid() AND r.name IN ('super_admin', 'admin', 'accountant', 'director')));

CREATE POLICY "Authenticated users can view accounting_accounts" ON accounting_accounts FOR SELECT TO authenticated USING (school_id = (SELECT school_id FROM profiles WHERE id = auth.uid()));
CREATE POLICY "Accountants can manage accounting_accounts" ON accounting_accounts FOR ALL TO authenticated USING (school_id = (SELECT school_id FROM profiles WHERE id = auth.uid()) AND EXISTS (SELECT 1 FROM profiles p JOIN roles r ON p.role_id = r.id WHERE p.id = auth.uid() AND r.name IN ('super_admin', 'admin', 'accountant')));

CREATE POLICY "Authenticated users can view accounting_entries" ON accounting_entries FOR SELECT TO authenticated USING (school_id = (SELECT school_id FROM profiles WHERE id = auth.uid()));
CREATE POLICY "Accountants can manage accounting_entries" ON accounting_entries FOR ALL TO authenticated USING (school_id = (SELECT school_id FROM profiles WHERE id = auth.uid()) AND EXISTS (SELECT 1 FROM profiles p JOIN roles r ON p.role_id = r.id WHERE p.id = auth.uid() AND r.name IN ('super_admin', 'admin', 'accountant')));

CREATE POLICY "Authenticated users can view payrolls" ON payrolls FOR SELECT TO authenticated USING (school_id = (SELECT school_id FROM profiles WHERE id = auth.uid()));
CREATE POLICY "Admins and accountants can manage payrolls" ON payrolls FOR ALL TO authenticated USING (school_id = (SELECT school_id FROM profiles WHERE id = auth.uid()) AND EXISTS (SELECT 1 FROM profiles p JOIN roles r ON p.role_id = r.id WHERE p.id = auth.uid() AND r.name IN ('super_admin', 'admin', 'accountant', 'director')));

CREATE POLICY "Authenticated users can view discounts" ON discounts FOR SELECT TO authenticated USING (school_id = (SELECT school_id FROM profiles WHERE id = auth.uid()));
CREATE POLICY "Admins can manage discounts" ON discounts FOR ALL TO authenticated USING (school_id = (SELECT school_id FROM profiles WHERE id = auth.uid()) AND EXISTS (SELECT 1 FROM profiles p JOIN roles r ON p.role_id = r.id WHERE p.id = auth.uid() AND r.name IN ('super_admin', 'admin', 'director')));

CREATE INDEX IF NOT EXISTS idx_payments_student_id ON payments(student_id);
CREATE INDEX IF NOT EXISTS idx_payments_school_id ON payments(school_id);
CREATE INDEX IF NOT EXISTS idx_cash_transactions_register_id ON cash_transactions(cash_register_id);
CREATE INDEX IF NOT EXISTS idx_expenses_school_id ON expenses(school_id);
