import { type ClassValue, clsx } from 'clsx';

// Simple clsx replacement (no external dep)
export function cn(...inputs: (string | undefined | null | false)[]) {
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
  const d = typeof date === 'string' ? new Date(date) : date;
  return new Intl.DateTimeFormat('fr-FR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  }).format(d);
}

export function formatDateTime(date: string | Date): string {
  if (!date) return '';
  const d = typeof date === 'string' ? new Date(date) : date;
  return new Intl.DateTimeFormat('fr-FR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  }).format(d);
}

export function generateMatricule(prefix: string, number: number): string {
  return `${prefix}${String(number).padStart(4, '0')}`;
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
    inactive: 'bg-gray-100 text-gray-700',
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
    closed: 'bg-gray-100 text-gray-700',
    present: 'bg-emerald-100 text-emerald-700',
    absent: 'bg-red-100 text-red-700',
    late: 'bg-amber-100 text-amber-700',
  };
  return colors[status] || 'bg-gray-100 text-gray-700';
}

export const LEVELS = [
  { value: '6eme', label: '6ème' },
  { value: '5eme', label: '5ème' },
  { value: '4eme', label: '4ème' },
  { value: '3eme', label: '3ème' },
  { value: '2nde', label: '2nde' },
  { value: '1ere', label: '1ère' },
  { value: 'Terminale', label: 'Terminale' },
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
];

export const DAYS_OF_WEEK = [
  { value: 1, label: 'Lundi' },
  { value: 2, label: 'Mardi' },
  { value: 3, label: 'Mercredi' },
  { value: 4, label: 'Jeudi' },
  { value: 5, label: 'Vendredi' },
  { value: 6, label: 'Samedi' },
];
