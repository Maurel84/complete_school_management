-- 1. Add unique constraint to accounting_accounts to prevent duplicates
ALTER TABLE public.accounting_accounts 
  ADD CONSTRAINT accounting_accounts_school_id_account_number_key UNIQUE (school_id, account_number);

-- 2. Insert standard SYSCOHADA accounts for all existing schools
INSERT INTO public.accounting_accounts (school_id, account_number, name, account_type)
SELECT 
  s.id, 
  acc.account_number, 
  acc.name, 
  acc.account_type
FROM public.schools s
CROSS JOIN (
  VALUES 
    ('101000', 'Capital Social', 'liability'),
    ('411100', 'Élèves / Parents (Créances scolarité)', 'asset'),
    ('421100', 'Personnel Enseignant (Salaires dus)', 'liability'),
    ('421200', 'Personnel Administratif (Salaires dus)', 'liability'),
    ('521100', 'Banque (Compte Courant)', 'asset'),
    ('571100', 'Caisse École', 'asset'),
    ('605100', 'Achats de fournitures scolaires', 'expense'),
    ('611000', 'Transports du personnel', 'expense'),
    ('625000', 'Frais d''entretien et réparations', 'expense'),
    ('661100', 'Rémunérations brutes du personnel', 'expense'),
    ('664000', 'Charges sociales (CNPS part patronale)', 'expense'),
    ('706100', 'Recettes - Droits de scolarité', 'revenue'),
    ('706200', 'Recettes - Droits d''inscription', 'revenue'),
    ('707100', 'Recettes - Tissu, Tenues & Sport', 'revenue'),
    ('707200', 'Recettes - Macarons & divers', 'revenue'),
    ('708200', 'Recettes - Cantine scolaire', 'revenue')
) AS acc(account_number, name, account_type)
ON CONFLICT (school_id, account_number) DO NOTHING;

-- 3. Alter payrolls table to add details JSONB column
ALTER TABLE public.payrolls 
  ADD COLUMN IF NOT EXISTS details jsonb DEFAULT '{}'::jsonb;

-- 4. Create contracts table
CREATE TABLE IF NOT EXISTS public.contracts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id uuid NOT NULL REFERENCES public.schools(id) ON DELETE CASCADE,
  person_id uuid NOT NULL,
  person_type text NOT NULL CHECK (person_type IN ('teacher', 'staff')),
  contract_type text NOT NULL CHECK (contract_type IN ('stagiaire', 'vacataire', 'interim', 'cdd', 'cdi')),
  start_date date NOT NULL,
  end_date date,
  base_salary numeric NOT NULL DEFAULT 0,
  allowances numeric NOT NULL DEFAULT 0,
  job_description text,
  terms text,
  status text NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'active', 'ended')),
  created_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 5. Enable Row Level Security (RLS) on contracts
ALTER TABLE public.contracts ENABLE ROW LEVEL SECURITY;

-- 6. Create RLS Policies for contracts
CREATE POLICY "Admins and accountants can manage contracts" ON public.contracts
  FOR ALL TO authenticated
  USING (school_id = current_profile_school_id());
