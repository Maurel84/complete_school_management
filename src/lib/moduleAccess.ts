import type { Profile, UserRole } from '../types';

export type ModuleKey =
  | 'dashboard'
  | 'students'
  | 'parents'
  | 'classes'
  | 'finance'
  | 'cash'
  | 'accounting'
  | 'teachers'
  | 'hr'
  | 'grades'
  | 'attendance'
  | 'schedule'
  | 'messages'
  | 'documents'
  | 'users'
  | 'settings';

export interface AppModule {
  key: ModuleKey;
  label: string;
  path: string;
  description: string;
  category: 'Pilotage' | 'Scolarite' | 'Finance' | 'Equipe' | 'Administration';
  defaultRoles: UserRole[];
}

export const APP_MODULES: AppModule[] = [
  {
    key: 'dashboard',
    label: 'Tableau de bord',
    path: '/',
    description: "Vue d'ensemble de l'ecole et alertes utiles.",
    category: 'Pilotage',
    defaultRoles: ['super_admin', 'admin', 'director', 'accountant', 'cashier', 'supervisor', 'teacher', 'parent', 'student'],
  },
  {
    key: 'students',
    label: 'Eleves',
    path: '/students',
    description: 'Dossiers eleves, photos, familles et cartes scolaires.',
    category: 'Scolarite',
    defaultRoles: ['super_admin', 'admin', 'director', 'supervisor', 'teacher', 'parent'],
  },
  {
    key: 'parents',
    label: 'Familles',
    path: '/parents',
    description: 'Parents, contacts financiers et personnes autorisees.',
    category: 'Scolarite',
    defaultRoles: ['super_admin', 'admin', 'director', 'supervisor'],
  },
  {
    key: 'classes',
    label: 'Classes',
    path: '/classes',
    description: 'Classes de la Petite Section au CM2.',
    category: 'Scolarite',
    defaultRoles: ['super_admin', 'admin', 'director', 'teacher', 'supervisor'],
  },
  {
    key: 'finance',
    label: 'Finances',
    path: '/finance',
    description: 'Frais, paiements, recus et comptes familles.',
    category: 'Finance',
    defaultRoles: ['super_admin', 'admin', 'director', 'accountant', 'cashier', 'parent'],
  },
  {
    key: 'cash',
    label: 'Caisse',
    path: '/cash',
    description: 'Ouverture, encaissements et cloture de caisse.',
    category: 'Finance',
    defaultRoles: ['super_admin', 'admin', 'director', 'cashier', 'accountant'],
  },
  {
    key: 'accounting',
    label: 'Comptabilite',
    path: '/accounting',
    description: 'Comptes, ecritures et suivi comptable.',
    category: 'Finance',
    defaultRoles: ['super_admin', 'admin', 'director', 'accountant'],
  },
  {
    key: 'teachers',
    label: 'Enseignants',
    path: '/teachers',
    description: 'Enseignants, titulaires et affectations de classe.',
    category: 'Equipe',
    defaultRoles: ['super_admin', 'admin', 'director'],
  },
  {
    key: 'hr',
    label: 'Personnel',
    path: '/hr',
    description: 'Administration, personnel, contrats et salaires.',
    category: 'Equipe',
    defaultRoles: ['super_admin', 'admin', 'director'],
  },
  {
    key: 'grades',
    label: 'Evaluations',
    path: '/grades',
    description: 'Notes, competences et suivi pedagogique.',
    category: 'Scolarite',
    defaultRoles: ['super_admin', 'admin', 'director', 'teacher', 'parent', 'student'],
  },
  {
    key: 'attendance',
    label: 'Presences',
    path: '/attendance',
    description: 'Presences, retards et absences.',
    category: 'Scolarite',
    defaultRoles: ['super_admin', 'admin', 'director', 'supervisor', 'teacher', 'parent', 'student'],
  },
  {
    key: 'schedule',
    label: 'Emploi du temps',
    path: '/schedule',
    description: 'Planning des classes et des enseignants.',
    category: 'Scolarite',
    defaultRoles: ['super_admin', 'admin', 'director', 'teacher', 'supervisor', 'student'],
  },
  {
    key: 'messages',
    label: 'Messages',
    path: '/messages',
    description: 'Communication interne et familles.',
    category: 'Pilotage',
    defaultRoles: ['super_admin', 'admin', 'director', 'teacher', 'parent', 'supervisor', 'student'],
  },
  {
    key: 'documents',
    label: 'Documents',
    path: '/documents',
    description: 'Recus, cartes scolaires et documents administratifs.',
    category: 'Administration',
    defaultRoles: ['super_admin', 'admin', 'director', 'teacher', 'accountant', 'cashier'],
  },
  {
    key: 'users',
    label: 'Utilisateurs',
    path: '/users',
    description: 'Creation des comptes et controle des modules.',
    category: 'Administration',
    defaultRoles: ['super_admin', 'admin'],
  },
  {
    key: 'settings',
    label: 'Parametres',
    path: '/settings',
    description: 'Ecole, annees, niveaux, matieres et frais.',
    category: 'Administration',
    defaultRoles: ['super_admin', 'admin'],
  },
];

export const ALL_MODULE_KEYS = APP_MODULES.map(module => module.key);

export function normalizeModuleAccess(value: unknown): ModuleKey[] {
  if (!Array.isArray(value)) return [];

  const validKeys = new Set(ALL_MODULE_KEYS);
  return value.filter((item): item is ModuleKey => typeof item === 'string' && validKeys.has(item as ModuleKey));
}

export function getDefaultModuleKeys(role: UserRole | null): ModuleKey[] {
  if (!role) return [];
  return APP_MODULES.filter(module => module.defaultRoles.includes(role)).map(module => module.key);
}

export function getAllowedModuleKeys(profile: Profile | null, role: UserRole | null): ModuleKey[] {
  if (!profile || !role) return [];
  if (role === 'super_admin') return ALL_MODULE_KEYS;

  const explicitAccess = normalizeModuleAccess(profile.module_access);
  const baseAccess = explicitAccess.length > 0 ? explicitAccess : getDefaultModuleKeys(role);
  const requiredAccess: ModuleKey[] = role === 'admin' ? ['dashboard', 'users', 'settings'] : ['dashboard'];

  return Array.from(new Set([...requiredAccess, ...baseAccess]));
}

export function canAccessModule(profile: Profile | null, role: UserRole | null, moduleKey: ModuleKey) {
  return getAllowedModuleKeys(profile, role).includes(moduleKey);
}

export function findModuleByPath(pathname: string): AppModule | undefined {
  if (pathname === '/') return APP_MODULES.find(module => module.key === 'dashboard');

  return APP_MODULES
    .filter(module => module.path !== '/' && pathname.startsWith(module.path))
    .sort((left, right) => right.path.length - left.path.length)[0];
}
