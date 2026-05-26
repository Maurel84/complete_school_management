/*
  # Demo Data - Sample school with students, parents, teachers, etc.
  Creates realistic test data for the SchoolManager Pro application.
*/

-- Demo School
INSERT INTO schools (id, name, address, city, country, phone, email, motto, establishment_type, active)
VALUES ('a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11', 'College Lycee Moderne', '25 Rue de la Paix', 'Abidjan', 'Cote d Ivoire', '+225 07 08 09 10 11', 'contact@collegemoderne.edu', 'Savoir et Progress', 'college_lycee', true);

-- Academic Year
INSERT INTO academic_years (id, school_id, name, start_date, end_date, active)
VALUES ('b0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11', 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11', '2025-2026', '2025-09-15', '2026-07-15', true);

-- Levels (using gen_random_uuid for valid UUIDs)
INSERT INTO levels (school_id, name, order_index) VALUES
  ('a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11', '6eme', 1),
  ('a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11', '5eme', 2),
  ('a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11', '4eme', 3),
  ('a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11', '3eme', 4),
  ('a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11', '2nde', 5),
  ('a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11', '1ere', 6),
  ('a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11', 'Terminale', 7);

-- Subjects
INSERT INTO subjects (school_id, name, code, coefficient) VALUES
  ('a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11', 'Mathematiques', 'MATH', 4),
  ('a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11', 'Francais', 'FRA', 4),
  ('a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11', 'Anglais', 'ANG', 3),
  ('a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11', 'Histoire-Geographie', 'HG', 3),
  ('a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11', 'Sciences Physiques', 'SP', 3),
  ('a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11', 'SVT', 'SVT', 2),
  ('a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11', 'Philosophie', 'PHILO', 3),
  ('a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11', 'EPS', 'EPS', 2),
  ('a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11', 'Informatique', 'INFO', 1),
  ('a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11', 'Economie', 'ECO', 2);

-- Fee Types
INSERT INTO fee_types (school_id, name, description, is_recurring) VALUES
  ('a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11', 'Frais d inscription', 'Frais annuels d inscription', false),
  ('a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11', 'Frais de scolarite', 'Frais mensuels de scolarite', true),
  ('a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11', 'Frais annexes', 'Fournitures et materiel', false);

-- Classes (using level references from above)
DO $$
DECLARE
  l6eme uuid; l5eme uuid; l4eme uuid; l3eme uuid; l2nde uuid; l1ere uuid; lterm uuid;
  ay_id uuid;
  sc_id uuid;
BEGIN
  sc_id := 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11';
  ay_id := 'b0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11';
  SELECT id INTO l6eme FROM levels WHERE school_id = sc_id AND name = '6eme';
  SELECT id INTO l5eme FROM levels WHERE school_id = sc_id AND name = '5eme';
  SELECT id INTO l4eme FROM levels WHERE school_id = sc_id AND name = '4eme';
  SELECT id INTO l3eme FROM levels WHERE school_id = sc_id AND name = '3eme';
  SELECT id INTO l2nde FROM levels WHERE school_id = sc_id AND name = '2nde';
  SELECT id INTO l1ere FROM levels WHERE school_id = sc_id AND name = '1ere';
  SELECT id INTO lterm FROM levels WHERE school_id = sc_id AND name = 'Terminale';

  INSERT INTO classes (school_id, level_id, academic_year_id, name, capacity, room) VALUES
    (sc_id, l6eme, ay_id, '6eme A', 35, 'Salle 101'),
    (sc_id, l6eme, ay_id, '6eme B', 35, 'Salle 102'),
    (sc_id, l5eme, ay_id, '5eme A', 35, 'Salle 201'),
    (sc_id, l5eme, ay_id, '5eme B', 35, 'Salle 202'),
    (sc_id, l4eme, ay_id, '4eme A', 35, 'Salle 301'),
    (sc_id, l4eme, ay_id, '4eme B', 35, 'Salle 302'),
    (sc_id, l3eme, ay_id, '3eme A', 35, 'Salle 401'),
    (sc_id, l3eme, ay_id, '3eme B', 35, 'Salle 402'),
    (sc_id, l2nde, ay_id, '2nde A', 35, 'Salle 501'),
    (sc_id, l2nde, ay_id, '2nde B', 35, 'Salle 502'),
    (sc_id, l1ere, ay_id, '1ere S', 35, 'Salle 601'),
    (sc_id, l1ere, ay_id, '1ere L', 35, 'Salle 602'),
    (sc_id, lterm, ay_id, 'Tle S', 35, 'Salle 701'),
    (sc_id, lterm, ay_id, 'Tle L', 35, 'Salle 702');

  -- Fees
  INSERT INTO fees (school_id, fee_type_id, academic_year_id, level_id, amount, due_date) VALUES
    (sc_id, (SELECT id FROM fee_types WHERE school_id = sc_id AND name = 'Frais d inscription'), ay_id, l6eme, 25000, '2025-09-30'),
    (sc_id, (SELECT id FROM fee_types WHERE school_id = sc_id AND name = 'Frais d inscription'), ay_id, l5eme, 25000, '2025-09-30'),
    (sc_id, (SELECT id FROM fee_types WHERE school_id = sc_id AND name = 'Frais d inscription'), ay_id, l4eme, 30000, '2025-09-30'),
    (sc_id, (SELECT id FROM fee_types WHERE school_id = sc_id AND name = 'Frais de scolarite'), ay_id, l6eme, 15000, '2025-10-31'),
    (sc_id, (SELECT id FROM fee_types WHERE school_id = sc_id AND name = 'Frais de scolarite'), ay_id, l5eme, 15000, '2025-10-31'),
    (sc_id, (SELECT id FROM fee_types WHERE school_id = sc_id AND name = 'Frais de scolarite'), ay_id, l4eme, 20000, '2025-10-31'),
    (sc_id, (SELECT id FROM fee_types WHERE school_id = sc_id AND name = 'Frais annexes'), ay_id, l6eme, 10000, '2025-10-15');

  -- Teachers
  INSERT INTO teachers (school_id, matricule, first_name, last_name, date_of_birth, sex, phone, email, specialty, contract_type, hire_date, status) VALUES
    (sc_id, 'ENS0001', 'Amadou', 'Konate', '1975-03-15', 'M', '+225 07 11 22 33', 'a.konate@ecole.edu', 'Mathematiques', 'cdi', '2015-09-01', 'active'),
    (sc_id, 'ENS0002', 'Marie', 'Dupont', '1980-07-22', 'F', '+225 07 22 33 44', 'm.dupont@ecole.edu', 'Francais', 'cdi', '2016-09-01', 'active'),
    (sc_id, 'ENS0003', 'Jean', 'Bamba', '1982-11-10', 'M', '+225 07 33 44 55', 'j.bamba@ecole.edu', 'Sciences Physiques', 'cdi', '2017-09-01', 'active'),
    (sc_id, 'ENS0004', 'Fatou', 'Diallo', '1985-05-08', 'F', '+225 07 44 55 66', 'f.diallo@ecole.edu', 'Anglais', 'cdd', '2020-09-01', 'active'),
    (sc_id, 'ENS0005', 'Paul', 'Ouattara', '1978-09-30', 'M', '+225 07 55 66 77', 'p.ouattara@ecole.edu', 'Histoire-Geographie', 'cdi', '2014-09-01', 'active');

  -- Staff
  INSERT INTO staff (school_id, matricule, first_name, last_name, sex, phone, email, department, position, contract_type, hire_date, status) VALUES
    (sc_id, 'PER0001', 'Aissatou', 'Traore', 'F', '+225 07 66 77 88', 'a.traore@ecole.edu', 'Administration', 'Secretaire', 'cdi', '2018-01-15', 'active'),
    (sc_id, 'PER0002', 'Moussa', 'Coulibaly', 'M', '+225 07 77 88 99', 'm.coulibaly@ecole.edu', 'Intendance', 'Intendant', 'cdi', '2019-03-01', 'active'),
    (sc_id, 'PER0003', 'Adjoua', 'Yao', 'F', '+225 07 88 99 00', 'a.yao@ecole.edu', 'Comptabilite', 'Comptable', 'cdi', '2020-06-01', 'active');

  -- Students (20 students across classes)
  INSERT INTO students (school_id, matricule, first_name, last_name, date_of_birth, sex, birth_place, nationality, class_id, status, enrollment_date, address) VALUES
    (sc_id, 'ELV0001', 'Kouadio', 'Yao', '2012-01-15', 'M', 'Abidjan', 'Ivoirienne', (SELECT id FROM classes WHERE school_id = sc_id AND name = '6eme A'), 'active', '2025-09-15', 'Cocody'),
    (sc_id, 'ELV0002', 'Aminata', 'Diallo', '2012-04-20', 'F', 'Bouake', 'Ivoirienne', (SELECT id FROM classes WHERE school_id = sc_id AND name = '6eme A'), 'active', '2025-09-15', 'Plateau'),
    (sc_id, 'ELV0003', 'Ibrahim', 'Coulibaly', '2012-07-08', 'M', 'Korhogo', 'Ivoirien', (SELECT id FROM classes WHERE school_id = sc_id AND name = '6eme A'), 'active', '2025-09-15', 'Marcory'),
    (sc_id, 'ELV0004', 'Mariam', 'Traore', '2012-10-12', 'F', 'Abidjan', 'Ivoirienne', (SELECT id FROM classes WHERE school_id = sc_id AND name = '6eme B'), 'active', '2025-09-15', 'Abobo'),
    (sc_id, 'ELV0005', 'Yves', 'Aka', '2012-03-25', 'M', 'Yamoussoukro', 'Ivoirien', (SELECT id FROM classes WHERE school_id = sc_id AND name = '6eme B'), 'active', '2025-09-15', 'Treichville'),
    (sc_id, 'ELV0006', 'Sophie', 'NGuessan', '2011-06-18', 'F', 'San Pedro', 'Ivoirienne', (SELECT id FROM classes WHERE school_id = sc_id AND name = '5eme A'), 'active', '2025-09-15', 'Cocody'),
    (sc_id, 'ELV0007', 'Emmanuel', 'Koffi', '2011-09-30', 'M', 'Daloa', 'Ivoirien', (SELECT id FROM classes WHERE school_id = sc_id AND name = '5eme A'), 'active', '2025-09-15', 'Adjame'),
    (sc_id, 'ELV0008', 'Fatim', 'Sylla', '2011-12-05', 'F', 'Man', 'Ivoirienne', (SELECT id FROM classes WHERE school_id = sc_id AND name = '5eme B'), 'active', '2025-09-15', 'Koumassi'),
    (sc_id, 'ELV0009', 'Patrick', 'Loba', '2011-02-14', 'M', 'Abidjan', 'Ivoirien', (SELECT id FROM classes WHERE school_id = sc_id AND name = '5eme B'), 'active', '2025-09-15', 'Yopougon'),
    (sc_id, 'ELV0010', 'Christelle', 'Gnahore', '2011-08-22', 'F', 'Gagnoa', 'Ivoirienne', (SELECT id FROM classes WHERE school_id = sc_id AND name = '4eme A'), 'active', '2025-09-15', 'Cocody'),
    (sc_id, 'ELV0011', 'Armand', 'Brou', '2010-11-03', 'M', 'Bouake', 'Ivoirien', (SELECT id FROM classes WHERE school_id = sc_id AND name = '4eme A'), 'active', '2025-09-15', 'Plateau'),
    (sc_id, 'ELV0012', 'Michele', 'Kone', '2010-04-17', 'F', 'Abidjan', 'Ivoirienne', (SELECT id FROM classes WHERE school_id = sc_id AND name = '4eme B'), 'active', '2025-09-15', 'Marcory'),
    (sc_id, 'ELV0013', 'Serge', 'Ouffoue', '2010-07-28', 'M', 'Abengourou', 'Ivoirien', (SELECT id FROM classes WHERE school_id = sc_id AND name = '3eme A'), 'active', '2025-09-15', 'Abobo'),
    (sc_id, 'ELV0014', 'Nathalie', 'Assemian', '2010-01-09', 'F', 'Odienne', 'Ivoirienne', (SELECT id FROM classes WHERE school_id = sc_id AND name = '3eme A'), 'active', '2025-09-15', 'Treichville'),
    (sc_id, 'ELV0015', 'David', 'Zadi', '2010-05-20', 'M', 'Sassandra', 'Ivoirien', (SELECT id FROM classes WHERE school_id = sc_id AND name = '3eme B'), 'active', '2025-09-15', 'Adjame'),
    (sc_id, 'ELV0016', 'Veronique', 'Adou', '2009-09-11', 'F', 'Abidjan', 'Ivoirienne', (SELECT id FROM classes WHERE school_id = sc_id AND name = '2nde A'), 'active', '2025-09-15', 'Cocody'),
    (sc_id, 'ELV0017', 'Felix', 'Djekpou', '2009-03-06', 'M', 'Bondoukou', 'Ivoirien', (SELECT id FROM classes WHERE school_id = sc_id AND name = '2nde A'), 'active', '2025-09-15', 'Yopougon'),
    (sc_id, 'ELV0018', 'Carine', 'Gbagbo', '2009-12-25', 'F', 'Duekoue', 'Ivoirienne', (SELECT id FROM classes WHERE school_id = sc_id AND name = '1ere S'), 'active', '2025-09-15', 'Koumassi'),
    (sc_id, 'ELV0019', 'Roland', 'Kouassi', '2009-06-14', 'M', 'Touba', 'Ivoirien', (SELECT id FROM classes WHERE school_id = sc_id AND name = '1ere L'), 'active', '2025-09-15', 'Plateau'),
    (sc_id, 'ELV0020', 'Estelle', 'Dogbo', '2009-08-30', 'F', 'Seguela', 'Ivoirienne', (SELECT id FROM classes WHERE school_id = sc_id AND name = 'Tle S'), 'active', '2025-09-15', 'Marcory');

  -- Parents
  INSERT INTO parents (school_id, first_name, last_name, phone, email, address, profession) VALUES
    (sc_id, 'Auguste', 'Yao', '+225 07 12 34 56', 'a.yao@email.com', 'Cocody', 'Commercant'),
    (sc_id, 'Kadiatou', 'Diallo', '+225 07 23 45 67', 'k.diallo@email.com', 'Plateau', 'Enseignante'),
    (sc_id, 'Mamadou', 'Coulibaly', '+225 07 34 56 78', 'm.coulibaly@email.com', 'Marcory', 'Medecin'),
    (sc_id, 'Awa', 'Traore', '+225 07 45 67 89', 'a.traore@email.com', 'Abobo', 'Commercante'),
    (sc_id, 'Laurent', 'Aka', '+225 07 56 78 90', 'l.aka@email.com', 'Treichville', 'Ingenieur'),
    (sc_id, 'Brigitte', 'NGuessan', '+225 07 67 89 01', 'b.nguessan@email.com', 'Cocody', 'Avocate'),
    (sc_id, 'Desire', 'Koffi', '+225 07 78 90 12', 'd.koffi@email.com', 'Adjame', 'Fonctionnaire'),
    (sc_id, 'Mariama', 'Sylla', '+225 07 89 01 23', 'm.sylla@email.com', 'Koumassi', 'Infirmiere'),
    (sc_id, 'Francois', 'Loba', '+225 07 90 12 34', 'f.loba@email.com', 'Yopougon', 'Chauffeur'),
    (sc_id, 'Victorine', 'Gnahore', '+225 07 01 23 45', 'v.gnahore@email.com', 'Cocody', 'Coiffeuse');

  -- Student-Parent relationships
  INSERT INTO student_parents (student_id, parent_id, relationship, is_primary) VALUES
    ((SELECT id FROM students WHERE matricule = 'ELV0001'), (SELECT id FROM parents WHERE last_name = 'Yao' AND first_name = 'Auguste'), 'pere', true),
    ((SELECT id FROM students WHERE matricule = 'ELV0002'), (SELECT id FROM parents WHERE last_name = 'Diallo' AND first_name = 'Kadiatou'), 'mere', true),
    ((SELECT id FROM students WHERE matricule = 'ELV0003'), (SELECT id FROM parents WHERE last_name = 'Coulibaly' AND first_name = 'Mamadou'), 'pere', true),
    ((SELECT id FROM students WHERE matricule = 'ELV0004'), (SELECT id FROM parents WHERE last_name = 'Traore' AND first_name = 'Awa'), 'mere', true),
    ((SELECT id FROM students WHERE matricule = 'ELV0005'), (SELECT id FROM parents WHERE last_name = 'Aka' AND first_name = 'Laurent'), 'pere', true),
    ((SELECT id FROM students WHERE matricule = 'ELV0006'), (SELECT id FROM parents WHERE last_name = 'NGuessan' AND first_name = 'Brigitte'), 'mere', true),
    ((SELECT id FROM students WHERE matricule = 'ELV0007'), (SELECT id FROM parents WHERE last_name = 'Koffi' AND first_name = 'Desire'), 'pere', true),
    ((SELECT id FROM students WHERE matricule = 'ELV0008'), (SELECT id FROM parents WHERE last_name = 'Sylla' AND first_name = 'Mariama'), 'mere', true),
    ((SELECT id FROM students WHERE matricule = 'ELV0009'), (SELECT id FROM parents WHERE last_name = 'Loba' AND first_name = 'Francois'), 'pere', true),
    ((SELECT id FROM students WHERE matricule = 'ELV0010'), (SELECT id FROM parents WHERE last_name = 'Gnahore' AND first_name = 'Victorine'), 'mere', true);

  -- Sample Payments
  INSERT INTO payments (school_id, student_id, fee_id, parent_id, receipt_number, amount, payment_method, payment_date, status, academic_year_id) VALUES
    (sc_id, (SELECT id FROM students WHERE matricule = 'ELV0001'), (SELECT id FROM fees WHERE school_id = sc_id LIMIT 1), (SELECT id FROM parents WHERE last_name = 'Yao' AND first_name = 'Auguste'), 'REC-2025-00001', 25000, 'cash', '2025-09-20', 'paid', ay_id),
    (sc_id, (SELECT id FROM students WHERE matricule = 'ELV0001'), (SELECT id FROM fees WHERE school_id = sc_id LIMIT 1), (SELECT id FROM parents WHERE last_name = 'Yao' AND first_name = 'Auguste'), 'REC-2025-00002', 15000, 'cash', '2025-10-05', 'paid', ay_id),
    (sc_id, (SELECT id FROM students WHERE matricule = 'ELV0002'), (SELECT id FROM fees WHERE school_id = sc_id LIMIT 1), (SELECT id FROM parents WHERE last_name = 'Diallo' AND first_name = 'Kadiatou'), 'REC-2025-00003', 25000, 'mobile_money', '2025-09-22', 'paid', ay_id),
    (sc_id, (SELECT id FROM students WHERE matricule = 'ELV0003'), (SELECT id FROM fees WHERE school_id = sc_id LIMIT 1), (SELECT id FROM parents WHERE last_name = 'Coulibaly' AND first_name = 'Mamadou'), 'REC-2025-00004', 25000, 'transfer', '2025-09-25', 'paid', ay_id),
    (sc_id, (SELECT id FROM students WHERE matricule = 'ELV0006'), (SELECT id FROM fees WHERE school_id = sc_id LIMIT 1), (SELECT id FROM parents WHERE last_name = 'NGuessan' AND first_name = 'Brigitte'), 'REC-2025-00005', 25000, 'cash', '2025-10-02', 'paid', ay_id),
    (sc_id, (SELECT id FROM students WHERE matricule = 'ELV0007'), (SELECT id FROM fees WHERE school_id = sc_id LIMIT 1), (SELECT id FROM parents WHERE last_name = 'Koffi' AND first_name = 'Desire'), 'REC-2025-00006', 25000, 'mobile_money', '2025-10-08', 'paid', ay_id),
    (sc_id, (SELECT id FROM students WHERE matricule = 'ELV0011'), (SELECT id FROM fees WHERE school_id = sc_id LIMIT 1), (SELECT id FROM parents WHERE last_name = 'Yao' AND first_name = 'Auguste'), 'REC-2025-00007', 30000, 'cash', '2025-09-30', 'paid', ay_id);

  -- Expenses
  INSERT INTO expenses (school_id, category, description, amount, expense_date, supplier, status) VALUES
    (sc_id, 'fournitures', 'Cartouches imprimante et papier', 35000, '2025-10-01', 'BuroPlus', 'validated'),
    (sc_id, 'entretien', 'Nettoyage salles avant rentree', 80000, '2025-09-10', 'CleanPro', 'validated'),
    (sc_id, 'equipement', 'Tables et chaises salle 102', 150000, '2025-09-05', 'MobilierCI', 'validated');

  -- Accounting Accounts
  INSERT INTO accounting_accounts (school_id, account_number, name, account_type) VALUES
    (sc_id, '100', 'Caisse', 'asset'),
    (sc_id, '200', 'Fournisseurs', 'liability'),
    (sc_id, '300', 'Frais de scolarite', 'revenue'),
    (sc_id, '400', 'Charges de personnel', 'expense'),
    (sc_id, '500', 'Charges de fonctionnement', 'expense'),
    (sc_id, '600', 'Frais d inscription', 'revenue');

  -- Cash Transactions
  INSERT INTO cash_transactions (school_id, transaction_number, type, amount, description, category, validated, created_at) VALUES
    (sc_id, 'TRX-001', 'in', 25000, 'Paiement inscription Kouadio Yao', 'payment', true, '2025-09-20'),
    (sc_id, 'TRX-002', 'in', 25000, 'Paiement inscription Aminata Diallo', 'payment', true, '2025-09-22'),
    (sc_id, 'TRX-003', 'out', 50000, 'Achat fournitures bureau', 'supplies', true, '2025-09-25'),
    (sc_id, 'TRX-004', 'in', 25000, 'Paiement scolarite Ibrahim Coulibaly', 'payment', true, '2025-09-25'),
    (sc_id, 'TRX-005', 'out', 75000, 'Reparation toiture salle 301', 'maintenance', true, '2025-10-01');
END $$;
