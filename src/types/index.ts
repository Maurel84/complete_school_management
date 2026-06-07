export type UserRole = 'super_admin' | 'admin' | 'accountant' | 'cashier' | 'director' | 'supervisor' | 'teacher' | 'parent' | 'student';

export interface School {
  id: string;
  name: string;
  address: string;
  city: string;
  country: string;
  phone: string;
  email: string;
  logo_url: string;
  motto: string;
  establishment_type: string;
  is_demo: boolean;
  active: boolean;
  created_at: string;
  updated_at: string;
}

export interface Role {
  id: string;
  name: UserRole;
  display_name: string;
  description: string;
}

export interface Profile {
  id: string;
  school_id: string;
  role_id: string;
  email: string;
  first_name: string;
  last_name: string;
  phone: string;
  avatar_url: string;
  account_type: string;
  module_access: string[];
  active: boolean;
  role?: Role;
  school?: School;
}

export interface Level {
  id: string;
  school_id: string;
  name: string;
  order_index: number;
}

export interface AcademicYear {
  id: string;
  school_id: string;
  name: string;
  start_date: string;
  end_date: string;
  active: boolean;
}

export interface Class {
  id: string;
  school_id: string;
  level_id: string;
  academic_year_id: string;
  name: string;
  capacity: number;
  room: string;
  level?: Level;
}

export interface Subject {
  id: string;
  school_id: string;
  name: string;
  code: string;
  coefficient: number;
  description: string;
}

export interface Student {
  id: string;
  school_id: string;
  matricule: string;
  first_name: string;
  last_name: string;
  date_of_birth: string;
  sex: string;
  birth_place: string;
  nationality: string;
  photo_url: string;
  address: string;
  phone: string;
  email: string;
  class_id: string;
  status: string;
  medical_info: string;
  previous_school: string;
  enrollment_date: string;
  class?: Class;
  parents?: StudentParent[];
}

export interface Parent {
  id: string;
  school_id: string;
  user_id: string;
  first_name: string;
  last_name: string;
  phone: string;
  email: string;
  address: string;
  profession: string;
  children?: Student[];
}

export interface StudentParent {
  id: string;
  student_id: string;
  parent_id: string;
  relationship: string;
  is_primary: boolean;
  is_billing_contact: boolean;
  is_pickup_authorized: boolean;
  emergency_priority: number;
  notes: string;
  parent?: Parent;
  student?: Student;
}

export interface Teacher {
  id: string;
  school_id: string;
  user_id: string;
  matricule: string;
  first_name: string;
  last_name: string;
  date_of_birth: string;
  sex: string;
  phone: string;
  email: string;
  address: string;
  photo_url: string;
  specialty: string;
  contract_type: string;
  hire_date: string;
  status: string;
}

export interface Staff {
  id: string;
  school_id: string;
  user_id: string;
  matricule: string;
  first_name: string;
  last_name: string;
  date_of_birth: string;
  sex: string;
  phone: string;
  email: string;
  address: string;
  photo_url: string;
  department: string;
  position: string;
  contract_type: string;
  hire_date: string;
  status: string;
}

export interface Enrollment {
  id: string;
  school_id: string;
  student_id: string;
  class_id: string;
  academic_year_id: string;
  enrollment_date: string;
  status: string;
}

export interface FeeType {
  id: string;
  school_id: string;
  name: string;
  description: string;
  is_recurring: boolean;
}

export interface Fee {
  id: string;
  school_id: string;
  fee_type_id: string;
  academic_year_id: string;
  level_id: string;
  class_id: string;
  amount: number;
  due_date: string;
  description: string;
  fee_type?: FeeType;
}

export interface Payment {
  id: string;
  school_id: string;
  student_id: string;
  fee_id: string;
  parent_id: string;
  receipt_number: string;
  amount: number;
  payment_method: string;
  payment_date: string;
  status: string;
  academic_year_id: string;
  processed_by: string;
  notes: string;
  student?: Student;
  parent?: Parent;
  fee?: Fee;
}

export interface CashRegister {
  id: string;
  school_id: string;
  cashier_id: string;
  opening_balance: number;
  closing_balance: number;
  opened_at: string;
  closed_at: string;
  status: string;
}

export interface CashTransaction {
  id: string;
  school_id: string;
  cash_register_id: string;
  transaction_number: string;
  type: string;
  amount: number;
  description: string;
  category: string;
  payment_id: string;
  processed_by: string;
  validated_by: string;
  validated: boolean;
  created_at: string;
  payment?: Payment;
}

export interface Expense {
  id: string;
  school_id: string;
  category: string;
  description: string;
  amount: number;
  expense_date: string;
  supplier: string;
  invoice_number: string;
  processed_by: string;
  validated_by: string;
  status: string;
}

export interface AccountingAccount {
  id: string;
  school_id: string;
  account_number: string;
  name: string;
  account_type: string;
  parent_id: string;
}

export interface AccountingEntry {
  id: string;
  school_id: string;
  account_id: string;
  entry_number: string;
  debit: number;
  credit: number;
  description: string;
  entry_date: string;
  reference: string;
}

export interface Payroll {
  id: string;
  school_id: string;
  person_id: string;
  person_type: string;
  month: number;
  year: number;
  base_salary: number;
  bonuses: number;
  deductions: number;
  net_salary: number;
  status: string;
  paid_date: string;
}

export interface Discount {
  id: string;
  school_id: string;
  student_id: string;
  fee_id: string;
  type: string;
  amount: number;
  percentage: number;
  reason: string;
  approved_by: string;
  academic_year_id: string;
}

export interface Attendance {
  id: string;
  school_id: string;
  student_id: string;
  class_id: string;
  date: string;
  status: string;
  arrival_time: string;
  reason: string;
  justified: boolean;
  recorded_by: string;
}

export interface Grade {
  id: string;
  school_id: string;
  student_id: string;
  subject_id: string;
  class_id: string;
  teacher_id: string;
  academic_year_id: string;
  term: string;
  grade_type: string;
  title: string;
  score: number;
  max_score: number;
  coefficient: number;
  date: string;
  comments: string;
}

export interface ReportCard {
  id: string;
  school_id: string;
  student_id: string;
  class_id: string;
  academic_year_id: string;
  term: string;
  overall_average: number;
  rank: number;
  class_size: number;
  appreciation: string;
  decision: string;
  published: boolean;
}

export interface ReportCardItem {
  id: string;
  report_card_id: string;
  subject_id: string;
  average: number;
  coefficient: number;
  weighted_average: number;
  class_average: number;
  rank: number;
  appreciation: string;
  teacher_comment: string;
}

export interface Schedule {
  id: string;
  school_id: string;
  class_id: string;
  teacher_id: string;
  subject_id: string;
  day_of_week: number;
  start_time: string;
  end_time: string;
  room: string;
  academic_year_id: string;
}

export interface TeacherSubject {
  id: string;
  school_id: string;
  teacher_id: string;
  subject_id: string;
  class_id: string;
  academic_year_id: string;
  is_principal: boolean;
}

export interface Message {
  id: string;
  school_id: string;
  sender_id: string;
  recipient_id: string;
  subject: string;
  content: string;
  is_read: boolean;
  is_announcement: boolean;
  created_at: string;
}

export interface Notification {
  id: string;
  school_id: string;
  user_id: string;
  type: string;
  title: string;
  message: string;
  is_read: boolean;
  link: string;
  created_at: string;
}

export interface DisciplineRecord {
  id: string;
  school_id: string;
  student_id: string;
  type: string;
  description: string;
  date: string;
  sanction: string;
  reported_by: string;
  parent_notified: boolean;
}

export interface Document {
  id: string;
  school_id: string;
  entity_type: string;
  entity_id: string;
  document_type: string;
  title: string;
  file_url: string;
  file_size: number;
  uploaded_by: string;
  created_at: string;
}

export interface DashboardStats {
  totalStudents: number;
  totalBoys: number;
  totalGirls: number;
  totalTeachers: number;
  totalParents: number;
  totalPayments: number;
  totalUnpaid: number;
  cashBalance: number;
  recentExpenses: number;
  alerts: AlertItem[];
}

export interface AlertItem {
  id: string;
  type: string;
  message: string;
  date: string;
}
