/**
 * School Theme & White-Label Customization Engine
 * Complete School Management SaaS
 * 
 * Allows multi-tenant schools to customize their primary and accent colors,
 * select prestige academic presets, or define bespoke brand guidelines.
 */

import { supabase } from './supabase';

export interface SchoolTheme {
  presetId: 'emerald' | 'navy' | 'burgundy' | 'teal' | 'slate_orange' | 'custom';
  primary: string;       // HEX code (ex: #059669)
  primaryHover: string;  // HEX code (ex: #047857)
  primaryLight: string;  // HEX code or rgba (ex: #ecfdf5)
  accent: string;        // HEX code (ex: #f59e0b)
  accentLight: string;   // HEX code or rgba (ex: #fef3c7)
  name: string;
}

export interface ThemePresetOption {
  id: 'emerald' | 'navy' | 'burgundy' | 'teal' | 'slate_orange';
  name: string;
  tagline: string;
  primary: string;
  primaryHover: string;
  primaryLight: string;
  accent: string;
  accentLight: string;
  description: string;
}

export const THEME_PRESETS: ThemePresetOption[] = [
  {
    id: 'emerald',
    name: 'Émeraude Prestige & Or',
    tagline: 'Standard Académique Ivoirien',
    primary: '#059669',
    primaryHover: '#047857',
    primaryLight: '#ecfdf5',
    accent: '#d97706',
    accentLight: '#fef3c7',
    description: 'Rigueur, fraîcheur et bienveillance pédagogique. Très prisé pour les groupes scolaires et collèges bilingues.',
  },
  {
    id: 'navy',
    name: 'Bleu Nuit Oxford & Or Impérial',
    tagline: 'Excellence & Grandes Écoles',
    primary: '#1e3a8a',
    primaryHover: '#172554',
    primaryLight: '#eff6ff',
    accent: '#eab308',
    accentLight: '#fef9c3',
    description: 'Élégance institutionnelle et prestige académique international (style Cambridge/Harvard).',
  },
  {
    id: 'burgundy',
    name: 'Bordeaux Cardinal & Rose Corail',
    tagline: 'Tradition & Humanisme',
    primary: '#881337',
    primaryHover: '#4c0519',
    primaryLight: '#fff1f2',
    accent: '#f43f5e',
    accentLight: '#ffe4e6',
    description: 'Noblesse historique, pensionnats privés et institutions d’excellence éducative.',
  },
  {
    id: 'teal',
    name: 'Bleu Canard & Océan Turquoise',
    tagline: 'Modernité & Sérénité',
    primary: '#0f766e',
    primaryHover: '#134e4a',
    primaryLight: '#f0fdfa',
    accent: '#06b6d4',
    accentLight: '#cffafe',
    description: 'Fraîcheur contemporaine, sérénité pour les cycles préscolaires et primaires connectés.',
  },
  {
    id: 'slate_orange',
    name: 'Ardoise Pure & Orange National',
    tagline: 'Sober Luxury Côte d’Ivoire',
    primary: '#0f172a',
    primaryHover: '#020617',
    primaryLight: '#f8fafc',
    accent: '#f97316',
    accentLight: '#ffedd5',
    description: 'Sobriété haut de gamme aux teintes emblématiques nationales avec touches d’orange ivoirien.',
  },
];

export const DEFAULT_THEME: SchoolTheme = {
  presetId: 'emerald',
  primary: '#059669',
  primaryHover: '#047857',
  primaryLight: '#ecfdf5',
  accent: '#d97706',
  accentLight: '#fef3c7',
  name: 'Émeraude Prestige & Or',
};

/**
 * Adjust hex color brightness
 */
function adjustBrightness(hex: string, percent: number): string {
  let num = parseInt(hex.replace('#', ''), 16);
  let r = (num >> 16) + Math.round((255 - (num >> 16)) * (percent / 100));
  let g = ((num >> 8) & 0x00ff) + Math.round((255 - ((num >> 8) & 0x00ff)) * (percent / 100));
  let b = (num & 0x0000ff) + Math.round((255 - (num & 0x0000ff)) * (percent / 100));

  r = Math.min(255, Math.max(0, r));
  g = Math.min(255, Math.max(0, g));
  b = Math.min(255, Math.max(0, b));

  return `#${((1 << 24) + (r << 16) + (g << 8) + b).toString(16).slice(1)}`;
}

/**
 * Get active theme from localStorage or default
 */
export function getSchoolTheme(schoolId?: string): SchoolTheme {
  if (typeof window === 'undefined') return DEFAULT_THEME;

  try {
    if (schoolId) {
      const stored = localStorage.getItem(`school_theme_${schoolId}`);
      if (stored) return JSON.parse(stored);
    }
    const globalStored = localStorage.getItem('school_active_theme');
    if (globalStored) return JSON.parse(globalStored);
  } catch (err) {
    console.warn('Failed to parse school theme from storage', err);
  }

  return DEFAULT_THEME;
}

/**
 * Injects CSS variables onto document root
 */
export function applySchoolTheme(theme: SchoolTheme): void {
  if (typeof window === 'undefined') return;

  const root = document.documentElement;
  root.style.setProperty('--school-primary', theme.primary);
  root.style.setProperty('--school-primary-hover', theme.primaryHover || adjustBrightness(theme.primary, -15));
  root.style.setProperty('--school-primary-light', theme.primaryLight || adjustBrightness(theme.primary, 85));
  root.style.setProperty('--school-accent', theme.accent);
  root.style.setProperty('--school-accent-light', theme.accentLight || adjustBrightness(theme.accent, 85));
}

/**
 * Saves theme to localStorage and updates school settings
 */
export async function saveSchoolTheme(schoolId: string, theme: SchoolTheme): Promise<void> {
  if (typeof window !== 'undefined') {
    localStorage.setItem(`school_theme_${schoolId}`, JSON.stringify(theme));
    localStorage.setItem('school_active_theme', JSON.stringify(theme));
    applySchoolTheme(theme);
  }

  try {
    // Attempt saving to Supabase if columns exist, ignore if not present
    await supabase.from('schools').update({
      theme_primary: theme.primary,
      theme_accent: theme.accent,
      theme_preset: theme.presetId,
    } as any).eq('id', schoolId);
  } catch {
    // Ignore schema discrepancy if columns are not present in Supabase table
  }
}
