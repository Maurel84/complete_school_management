-- SQL Migration: Groupe Scolaire La Harpe de David Finance Module Schema
-- Created: 2026-07-12
-- Author: Senior Full Stack Developer

-- ==========================================
-- 1. CREATE NEW TABLES
-- ==========================================

-- Table: payment_plans (Tuition fee configuration per cycle/group of levels)
CREATE TABLE IF NOT EXISTS public.payment_plans (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id uuid REFERENCES public.schools(id) ON DELETE CASCADE NOT NULL,
  academic_year_id uuid REFERENCES public.academic_years(id) ON DELETE CASCADE NOT NULL,
  name text NOT NULL, -- 'Maternelle', 'Primaire (CP1-CM1)', 'CM2'
  total_amount numeric(12,2) NOT NULL DEFAULT 0,
  canteen_monthly numeric(12,2) NOT NULL DEFAULT 0,
  canteen_quarterly numeric(12,2) NOT NULL DEFAULT 0,
  canteen_annual numeric(12,2) NOT NULL DEFAULT 0,
  created_at timestamptz DEFAULT now()
);

-- Table: payment_plan_levels (Junction table to link levels to plans)
CREATE TABLE IF NOT EXISTS public.payment_plan_levels (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  plan_id uuid REFERENCES public.payment_plans(id) ON DELETE CASCADE NOT NULL,
  level_id uuid REFERENCES public.levels(id) ON DELETE CASCADE NOT NULL,
  created_at timestamptz DEFAULT now(),
  UNIQUE(plan_id, level_id)
);

-- Table: payment_schedule_templates (Schedules templates for plans)
CREATE TABLE IF NOT EXISTS public.payment_schedule_templates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  plan_id uuid REFERENCES public.payment_plans(id) ON DELETE CASCADE NOT NULL,
  installment_number int NOT NULL, -- 1, 2, 3
  label text NOT NULL, -- 'Premier versement', etc.
  amount numeric(12,2) NOT NULL DEFAULT 0,
  due_date date NOT NULL,
  created_at timestamptz DEFAULT now(),
  UNIQUE(plan_id, installment_number)
);

-- Table: payment_plan_compositions (Composition items of the 1st installment)
CREATE TABLE IF NOT EXISTS public.payment_plan_compositions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  plan_id uuid REFERENCES public.payment_plans(id) ON DELETE CASCADE NOT NULL,
  item_name text NOT NULL, -- 'Frais d''inscription', 'Tissu du lundi', 'Macaron', etc.
  amount numeric(12,2) NOT NULL DEFAULT 0,
  created_at timestamptz DEFAULT now()
);

-- Table: student_fees (Student assignments to payment plans)
CREATE TABLE IF NOT EXISTS public.student_fees (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  student_id uuid REFERENCES public.students(id) ON DELETE CASCADE NOT NULL UNIQUE,
  plan_id uuid REFERENCES public.payment_plans(id) ON DELETE RESTRICT NOT NULL,
  canteen_option text NOT NULL DEFAULT 'none', -- 'none', 'trimestriel'
  discount_amount numeric(12,2) NOT NULL DEFAULT 0,
  created_at timestamptz DEFAULT now()
);

-- Table: student_installments (Actual installments generated for students)
CREATE TABLE IF NOT EXISTS public.student_installments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  student_id uuid REFERENCES public.students(id) ON DELETE CASCADE NOT NULL,
  installment_number int NOT NULL, -- 1, 2, 3
  label text NOT NULL,
  amount numeric(12,2) NOT NULL DEFAULT 0,
  due_date date NOT NULL,
  created_at timestamptz DEFAULT now(),
  UNIQUE(student_id, installment_number)
);

-- Table: canteen_payments (Quarterly canteen payments tracking)
CREATE TABLE IF NOT EXISTS public.canteen_payments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id uuid REFERENCES public.schools(id) ON DELETE CASCADE NOT NULL,
  student_id uuid REFERENCES public.students(id) ON DELETE CASCADE NOT NULL,
  academic_year_id uuid REFERENCES public.academic_years(id) ON DELETE CASCADE NOT NULL,
  amount numeric(12,2) NOT NULL DEFAULT 0,
  payment_method text NOT NULL DEFAULT 'cash', -- 'cash', 'mobile_money', etc.
  payment_date date NOT NULL DEFAULT CURRENT_DATE,
  trimester int NOT NULL, -- 1, 2, 3
  receipt_number text UNIQUE NOT NULL,
  processed_by uuid REFERENCES public.profiles(id),
  notes text DEFAULT '',
  created_at timestamptz DEFAULT now()
);

-- Table: payment_details (Tuition payment breakdowns, i.e., composition items)
CREATE TABLE IF NOT EXISTS public.payment_details (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  payment_id uuid REFERENCES public.payments(id) ON DELETE CASCADE NOT NULL,
  item_name text NOT NULL, -- 'Frais d''inscription', etc.
  amount numeric(12,2) NOT NULL DEFAULT 0,
  created_at timestamptz DEFAULT now()
);

-- Table: receipts (Metadata for printable school receipts, QR codes, signatures)
CREATE TABLE IF NOT EXISTS public.receipts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  payment_id uuid REFERENCES public.payments(id) ON DELETE CASCADE,
  canteen_payment_id uuid REFERENCES public.canteen_payments(id) ON DELETE CASCADE,
  receipt_number text UNIQUE NOT NULL,
  qr_code_hash text NOT NULL,
  digital_signature text NOT NULL,
  stamp_url text DEFAULT '',
  created_at timestamptz DEFAULT now(),
  CONSTRAINT check_receipt_source CHECK (
    (payment_id IS NOT NULL AND canteen_payment_id IS NULL) OR
    (payment_id IS NULL AND canteen_payment_id IS NOT NULL)
  )
);

-- ==========================================
-- 2. ENABLE ROW LEVEL SECURITY (RLS)
-- ==========================================
ALTER TABLE public.payment_plans ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.payment_plan_levels ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.payment_schedule_templates ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.payment_plan_compositions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.student_fees ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.student_installments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.canteen_payments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.payment_details ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.receipts ENABLE ROW LEVEL SECURITY;

-- ==========================================
-- 3. CREATE RLS POLICIES (optimized)
-- ==========================================

-- Table: payment_plans
CREATE POLICY "Authenticated users can view payment plans" ON public.payment_plans
  FOR SELECT TO authenticated USING (school_id = public.current_profile_school_id());

CREATE POLICY "Admins can manage payment plans" ON public.payment_plans
  FOR ALL TO authenticated USING (school_id = public.current_profile_school_id() AND public.current_profile_role_name() IN ('super_admin', 'admin', 'director'));

-- Table: payment_plan_levels
CREATE POLICY "Authenticated users can view plan levels" ON public.payment_plan_levels
  FOR SELECT TO authenticated USING (EXISTS (SELECT 1 FROM public.payment_plans WHERE id = plan_id AND school_id = public.current_profile_school_id()));

CREATE POLICY "Admins can manage plan levels" ON public.payment_plan_levels
  FOR ALL TO authenticated USING (EXISTS (SELECT 1 FROM public.payment_plans WHERE id = plan_id AND school_id = public.current_profile_school_id()) AND public.current_profile_role_name() IN ('super_admin', 'admin', 'director'));

-- Table: payment_schedule_templates
CREATE POLICY "Authenticated users can view schedule templates" ON public.payment_schedule_templates
  FOR SELECT TO authenticated USING (EXISTS (SELECT 1 FROM public.payment_plans WHERE id = plan_id AND school_id = public.current_profile_school_id()));

CREATE POLICY "Admins can manage schedule templates" ON public.payment_schedule_templates
  FOR ALL TO authenticated USING (EXISTS (SELECT 1 FROM public.payment_plans WHERE id = plan_id AND school_id = public.current_profile_school_id()) AND public.current_profile_role_name() IN ('super_admin', 'admin', 'director'));

-- Table: payment_plan_compositions
CREATE POLICY "Authenticated users can view compositions" ON public.payment_plan_compositions
  FOR SELECT TO authenticated USING (EXISTS (SELECT 1 FROM public.payment_plans WHERE id = plan_id AND school_id = public.current_profile_school_id()));

CREATE POLICY "Admins can manage compositions" ON public.payment_plan_compositions
  FOR ALL TO authenticated USING (EXISTS (SELECT 1 FROM public.payment_plans WHERE id = plan_id AND school_id = public.current_profile_school_id()) AND public.current_profile_role_name() IN ('super_admin', 'admin', 'director'));

-- Table: student_fees
CREATE POLICY "Authenticated users can view student fees" ON public.student_fees
  FOR SELECT TO authenticated USING (EXISTS (SELECT 1 FROM public.students WHERE id = student_id AND school_id = public.current_profile_school_id()));

CREATE POLICY "Admins can manage student fees" ON public.student_fees
  FOR ALL TO authenticated USING (EXISTS (SELECT 1 FROM public.students WHERE id = student_id AND school_id = public.current_profile_school_id()) AND public.current_profile_role_name() IN ('super_admin', 'admin', 'director', 'accountant'));

-- Table: student_installments
CREATE POLICY "Authenticated users can view student installments" ON public.student_installments
  FOR SELECT TO authenticated USING (EXISTS (SELECT 1 FROM public.students WHERE id = student_id AND school_id = public.current_profile_school_id()));

CREATE POLICY "Admins can manage student installments" ON public.student_installments
  FOR ALL TO authenticated USING (EXISTS (SELECT 1 FROM public.students WHERE id = student_id AND school_id = public.current_profile_school_id()) AND public.current_profile_role_name() IN ('super_admin', 'admin', 'director', 'accountant'));

-- Table: canteen_payments
CREATE POLICY "Authenticated users can view canteen payments" ON public.canteen_payments
  FOR SELECT TO authenticated USING (school_id = public.current_profile_school_id());

CREATE POLICY "Financial roles can manage canteen payments" ON public.canteen_payments
  FOR ALL TO authenticated USING (school_id = public.current_profile_school_id() AND public.current_profile_role_name() IN ('super_admin', 'admin', 'director', 'accountant', 'cashier'));

-- Table: payment_details
CREATE POLICY "Authenticated users can view payment details" ON public.payment_details
  FOR SELECT TO authenticated USING (EXISTS (SELECT 1 FROM public.payments WHERE id = payment_id AND school_id = public.current_profile_school_id()));

CREATE POLICY "Financial roles can manage payment details" ON public.payment_details
  FOR ALL TO authenticated USING (EXISTS (SELECT 1 FROM public.payments WHERE id = payment_id AND school_id = public.current_profile_school_id()) AND public.current_profile_role_name() IN ('super_admin', 'admin', 'director', 'accountant', 'cashier'));

-- Table: receipts
CREATE POLICY "Authenticated users can view receipts" ON public.receipts
  FOR SELECT TO authenticated USING (
    (payment_id IS NOT NULL AND EXISTS (SELECT 1 FROM public.payments WHERE id = payment_id AND school_id = public.current_profile_school_id())) OR
    (canteen_payment_id IS NOT NULL AND EXISTS (SELECT 1 FROM public.canteen_payments WHERE id = canteen_payment_id AND school_id = public.current_profile_school_id()))
  );

CREATE POLICY "Financial roles can manage receipts" ON public.receipts
  FOR ALL TO authenticated USING (public.current_profile_role_name() IN ('super_admin', 'admin', 'director', 'accountant', 'cashier'));


-- ==========================================
-- 4. CREATE DATABASE INDEXES
-- ==========================================
CREATE INDEX IF NOT EXISTS idx_student_fees_plan ON public.student_fees(plan_id);
CREATE INDEX IF NOT EXISTS idx_student_installments_lookup ON public.student_installments(student_id, due_date);
CREATE INDEX IF NOT EXISTS idx_canteen_payments_student ON public.canteen_payments(student_id, academic_year_id);
CREATE INDEX IF NOT EXISTS idx_payment_details_id ON public.payment_details(payment_id);
CREATE INDEX IF NOT EXISTS idx_receipts_pay ON public.receipts(payment_id);
CREATE INDEX IF NOT EXISTS idx_receipts_canteen ON public.receipts(canteen_payment_id);


-- ==========================================
-- 5. AUTOMATIC SCHEDULING TRIGGER
-- ==========================================

CREATE OR REPLACE FUNCTION public.generate_student_installments()
RETURNS TRIGGER AS $$
BEGIN
  -- Insert student installments automatically based on schedule templates configured for the plan
  INSERT INTO public.student_installments (student_id, installment_number, label, amount, due_date)
  SELECT 
    NEW.student_id,
    t.installment_number,
    t.label,
    t.amount,
    t.due_date
  FROM public.payment_schedule_templates t
  WHERE t.plan_id = NEW.plan_id
  ON CONFLICT (student_id, installment_number) DO UPDATE
  SET amount = EXCLUDED.amount,
      due_date = EXCLUDED.due_date,
      label = EXCLUDED.label;
      
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE OR REPLACE TRIGGER trg_generate_student_installments
AFTER INSERT OR UPDATE OF plan_id ON public.student_fees
FOR EACH ROW
EXECUTE FUNCTION public.generate_student_installments();
