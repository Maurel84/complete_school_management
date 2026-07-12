export function cn(...inputs: Array<string | undefined | null | false>) {
  return inputs.filter(Boolean).join(' ');
}

export function formatCurrency(amount: number): string {
  return new Intl.NumberFormat('fr-FR', {
    style: 'currency',
    currency: 'XOF',
    minimumFractionDigits: 0,
  }).format(amount);
}

export function formatDate(date: string | Date): string {
  if (!date) return '';
  const value = typeof date === 'string' ? new Date(date) : date;
  return new Intl.DateTimeFormat('fr-FR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  }).format(value);
}

export function formatDateTime(date: string | Date): string {
  if (!date) return '';
  const value = typeof date === 'string' ? new Date(date) : date;
  return new Intl.DateTimeFormat('fr-FR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  }).format(value);
}

export function formatMonthYear(month: number, year: number): string {
  return new Intl.DateTimeFormat('fr-FR', {
    month: 'long',
    year: 'numeric',
  }).format(new Date(year, month - 1, 1));
}

export function getInitials(firstName = '', lastName = ''): string {
  return `${firstName.charAt(0)}${lastName.charAt(0)}`.trim().toUpperCase();
}

export function generateMatricule(prefix: string, number: number): string {
  const randomSuffix = Math.floor(1000 + Math.random() * 9000);
  return `${prefix}${String(number).padStart(3, '0')}-${randomSuffix}`;
}

export function generateReceiptNumber(): string {
  const now = new Date();
  const year = now.getFullYear();
  const random = Math.floor(Math.random() * 100000).toString().padStart(5, '0');
  return `REC-${year}-${random}`;
}

export function getStatusColor(status: string): string {
  const colors: Record<string, string> = {
    active: 'bg-emerald-100 text-emerald-700',
    inactive: 'bg-slate-100 text-slate-700',
    suspended: 'bg-amber-100 text-amber-700',
    transferred: 'bg-blue-100 text-blue-700',
    graduated: 'bg-teal-100 text-teal-700',
    paid: 'bg-emerald-100 text-emerald-700',
    partial: 'bg-amber-100 text-amber-700',
    unpaid: 'bg-red-100 text-red-700',
    overdue: 'bg-red-100 text-red-700',
    pending: 'bg-amber-100 text-amber-700',
    validated: 'bg-emerald-100 text-emerald-700',
    open: 'bg-emerald-100 text-emerald-700',
    closed: 'bg-slate-100 text-slate-700',
    present: 'bg-emerald-100 text-emerald-700',
    absent: 'bg-red-100 text-red-700',
    late: 'bg-amber-100 text-amber-700',
    draft: 'bg-slate-100 text-slate-700',
  };

  return colors[status] || 'bg-slate-100 text-slate-700';
}

export const PRIMARY_LEVEL_PRESETS = [
  { name: 'Petite Section', order_index: 1 },
  { name: 'Moyenne Section', order_index: 2 },
  { name: 'Grande Section', order_index: 3 },
  { name: 'CP', order_index: 4 },
  { name: 'CE1', order_index: 5 },
  { name: 'CE2', order_index: 6 },
  { name: 'CM1', order_index: 7 },
  { name: 'CM2', order_index: 8 },
];

export const PRIMARY_SUBJECT_PRESETS = [
  { name: 'Langage', code: 'LANG', coefficient: 1 },
  { name: 'Graphisme', code: 'GRAF', coefficient: 1 },
  { name: 'Motricité', code: 'MOT', coefficient: 1 },
  { name: 'Éveil', code: 'EVE', coefficient: 1 },
  { name: 'Français', code: 'FR', coefficient: 3 },
  { name: 'Mathématiques', code: 'MATH', coefficient: 3 },
  { name: 'Lecture', code: 'LEC', coefficient: 2 },
  { name: 'Écriture', code: 'ECR', coefficient: 2 },
  { name: 'Sciences', code: 'SCI', coefficient: 2 },
  { name: 'Éducation civique', code: 'ECM', coefficient: 1 },
  { name: 'Anglais', code: 'ANG', coefficient: 1 },
  { name: 'EPS', code: 'EPS', coefficient: 1 },
  { name: 'Arts plastiques', code: 'ART', coefficient: 1 },
  { name: 'Informatique', code: 'INFO', coefficient: 1 },
];

export const PRIMARY_FEE_TYPE_PRESETS = [
  { name: 'Frais d\'inscription', description: 'Paiement unique à l\'entrée', is_recurring: false },
  { name: 'Frais de scolarité', description: 'Scolarité mensuelle ou par échéance', is_recurring: true },
  { name: 'Cantine', description: 'Restauration scolaire', is_recurring: true },
  { name: 'Transport', description: 'Ramassage et transport scolaire', is_recurring: true },
  { name: 'Tenue scolaire', description: 'Uniforme, tablier, équipements', is_recurring: false },
  { name: 'Activités pédagogiques', description: 'Sorties, ateliers, évaluations et projets', is_recurring: false },
];

export const ESTABLISHMENT_TYPE_OPTIONS = [
  { value: 'maternelle_primaire', label: 'Maternelle & primaire' },
];

export const SEX_OPTIONS = [
  { value: 'M', label: 'Masculin' },
  { value: 'F', label: 'Féminin' },
];

export const RELATIONSHIP_OPTIONS = [
  { value: 'pere', label: 'Père' },
  { value: 'mere', label: 'Mère' },
  { value: 'tuteur', label: 'Tuteur' },
  { value: 'autre', label: 'Autre' },
];

export const PAYMENT_METHODS = [
  { value: 'cash', label: 'Espèces' },
  { value: 'check', label: 'Chèque' },
  { value: 'transfer', label: 'Virement' },
  { value: 'mobile_money', label: 'Mobile Money' },
  { value: 'card', label: 'Carte bancaire' },
];

export const STATUS_OPTIONS = [
  { value: 'active', label: 'Actif' },
  { value: 'suspended', label: 'Suspendu' },
  { value: 'transferred', label: 'Transféré' },
  { value: 'graduated', label: 'Diplômé' },
];

export const CONTRACT_TYPES = [
  { value: 'cdi', label: 'CDI' },
  { value: 'cdd', label: 'CDD' },
  { value: 'interim', label: 'Intérim' },
  { value: 'vacataire', label: 'Vacataire' },
];

export const GRADE_TYPES = [
  { value: 'devoir', label: 'Devoir' },
  { value: 'composition', label: 'Composition' },
  { value: 'examen', label: 'Examen' },
  { value: 'controle', label: 'Contrôle' },
  { value: 'observation', label: 'Observation continue' },
];

export const DAYS_OF_WEEK = [
  { value: 1, label: 'Lundi' },
  { value: 2, label: 'Mardi' },
  { value: 3, label: 'Mercredi' },
  { value: 4, label: 'Jeudi' },
  { value: 5, label: 'Vendredi' },
  { value: 6, label: 'Samedi' },
];

export const STAFF_DEPARTMENTS = [
  'Direction',
  'Administration',
  'Comptabilité',
  'Vie scolaire',
  'Santé scolaire',
  'Cantine',
  'Transport',
  'Entretien',
  'Sécurité',
];

export const STAFF_POSITIONS = [
  'Directeur',
  'Directeur des études',
  'Secrétaire',
  'Comptable',
  'Caissier',
  'Surveillant',
  'Assistant administratif',
  'Infirmier scolaire',
  'Responsable cantine',
  'Chauffeur',
  'Agent d\'entretien',
  'Agent de sécurité',
];

export const PAYROLL_STATUS_OPTIONS = [
  { value: 'draft', label: 'Brouillon' },
  { value: 'pending', label: 'En attente' },
  { value: 'validated', label: 'Validé' },
  { value: 'paid', label: 'Payé' },
];

export const MONTH_OPTIONS = [
  { value: 1, label: 'Janvier' },
  { value: 2, label: 'Février' },
  { value: 3, label: 'Mars' },
  { value: 4, label: 'Avril' },
  { value: 5, label: 'Mai' },
  { value: 6, label: 'Juin' },
  { value: 7, label: 'Juillet' },
  { value: 8, label: 'Août' },
  { value: 9, label: 'Septembre' },
  { value: 10, label: 'Octobre' },
  { value: 11, label: 'Novembre' },
  { value: 12, label: 'Décembre' },
];

export const SCHOOL_ROLE_BLUEPRINTS = [
  {
    title: 'Super administrateur général',
    access: ['Pilotage global', 'Paramétrage complet', 'Edition des données mock', 'Visibilité sur la masse salariale'],
    note: 'Profil le plus sensible. Réservé au propriétaire ou à la direction générale.',
  },
  {
    title: 'Administration & direction',
    access: ['Élèves et parents', 'Classes et emploi du temps', 'Documents et messagerie', 'Suivi opérationnel'],
    note: 'Utiliser les rôles admin, directeur, surveillant, comptable et caissier selon les besoins.',
  },
  {
    title: 'Titulaire de classe',
    access: ['Tableau de bord', 'Suivi des élèves de sa classe', 'Notes, présences, discipline', 'Communication avec les familles'],
    note: 'Il s\'agit d\'une responsabilité attachée au rôle Enseignant via les affectations de classe.',
  },
  {
    title: 'Parents & élèves',
    access: ['Consultation ciblée', 'Absences, notes, paiements', 'Messagerie et documents'],
    note: 'Le portail parent/élève doit rester strictement limité à leurs propres données.',
  },
];
