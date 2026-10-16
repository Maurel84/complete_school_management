/**
 * School Theme & White-Label Customization Engine
 * Complete School Management SaaS
 * 
 * Allows multi-tenant schools to customize their primary and accent colors,
 * select prestige academic presets, define bespoke brand guidelines,
 * and seamlessly toggle between Light Mode and Dark Mode.
 */

import { supabase } from './supabase';

export interface SchoolTheme {
  presetId: 'emerald' | 'navy' | 'burgundy' | 'teal' | 'slate_orange' | 'custom';
  primary: string;       // HEX code (ex: #059669)
  primaryHover: string;  // HEX code (ex: #047857)
  primaryLight: string;  // HEX code (ex: #ecfdf5)
  accent: string;        // HEX code (ex: #f59e0b)
  accentLight: string;   // HEX code (ex: #fef3c7)
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
export function adjustBrightness(hex: string, percent: number): string {
  let cleanHex = hex.replace('#', '');
  if (cleanHex.length === 3) {
    cleanHex = cleanHex.split('').map(c => c + c).join('');
  }
  let num = parseInt(cleanHex, 16);
  if (isNaN(num)) return hex;

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

      const storedBranding = localStorage.getItem(`school_branding_${schoolId}`);
      if (storedBranding) {
        const parsed = JSON.parse(storedBranding);
        if (parsed.theme) return parsed.theme;
      }
    }
    const globalStored = localStorage.getItem('school_active_theme');
    if (globalStored) return JSON.parse(globalStored);
  } catch (err) {
    console.warn('Failed to parse school theme from storage', err);
  }

  return DEFAULT_THEME;
}

/**
 * Injects dynamic CSS rules onto document to globally reskin all primary buttons,
 * badges, accents, and borders across the entire application immediately.
 */
export function applySchoolTheme(theme: SchoolTheme): void {
  if (typeof window === 'undefined') return;

  const root = document.documentElement;
  const primary = theme.primary || '#059669';
  const primaryHover = theme.primaryHover || adjustBrightness(primary, -15);
  const primaryLight = theme.primaryLight || adjustBrightness(primary, 88);
  const accent = theme.accent || '#d97706';
  const accentLight = theme.accentLight || adjustBrightness(accent, 88);

  root.style.setProperty('--school-primary', primary);
  root.style.setProperty('--school-primary-hover', primaryHover);
  root.style.setProperty('--school-primary-light', primaryLight);
  root.style.setProperty('--school-accent', accent);
  root.style.setProperty('--school-accent-light', accentLight);

  // Inject or update global stylesheet override for instant live application
  let styleEl = document.getElementById('app-school-dynamic-theme') as HTMLStyleElement;
  if (!styleEl) {
    styleEl = document.createElement('style');
    styleEl.id = 'app-school-dynamic-theme';
    document.head.appendChild(styleEl);
  }

  styleEl.innerHTML = `
    /* Instant White-Label Dynamic Overrides */
    .bg-emerald-600, .bg-emerald-700, .bg-emerald-500 {
      background-color: ${primary} !important;
    }
    .hover\\:bg-emerald-700:hover, .hover\\:bg-emerald-600:hover, .hover\\:bg-emerald-500:hover {
      background-color: ${primaryHover} !important;
    }
    .text-emerald-600, .text-emerald-700, .text-emerald-500 {
      color: ${primary} !important;
    }
    .text-emerald-800, .text-emerald-900 {
      color: ${primaryHover} !important;
    }
    .border-emerald-600, .border-emerald-500, .border-emerald-400, .border-emerald-300, .border-emerald-200 {
      border-color: ${primary} !important;
    }
    .focus\\:border-emerald-500:focus, .focus\\:border-emerald-600:focus {
      border-color: ${primary} !important;
    }
    .bg-emerald-50, .bg-emerald-100, .bg-emerald-200 {
      background-color: ${primaryLight} !important;
    }
    .bg-emerald-400\\/15, .bg-emerald-400\\/20, .bg-emerald-500\\/10, .bg-emerald-500\\/20 {
      background-color: ${primaryLight} !important;
    }
    .focus\\:ring-emerald-500:focus, .focus\\:ring-emerald-600:focus, .ring-emerald-500, .ring-emerald-600 {
      --tw-ring-color: ${primary} !important;
    }
    .school-primary-btn, .btn-premium-emerald {
      background-color: ${primary} !important;
      color: #ffffff !important;
    }
    .school-primary-btn:hover, .btn-premium-emerald:hover {
      background-color: ${primaryHover} !important;
    }
    .school-primary-bg {
      background-color: ${primary} !important;
    }
    .school-primary-text {
      color: ${primary} !important;
    }
    .school-primary-border {
      border-color: ${primary} !important;
    }
    .school-accent-bg {
      background-color: ${accent} !important;
    }
    .school-accent-text {
      color: ${accent} !important;
    }
  `;
}

/**
 * Saves theme to localStorage and activates it immediately
 */
export async function saveSchoolTheme(schoolId: string, theme: SchoolTheme): Promise<void> {
  if (typeof window !== 'undefined') {
    localStorage.setItem(`school_theme_${schoolId}`, JSON.stringify(theme));
    localStorage.setItem('school_active_theme', JSON.stringify(theme));
    
    // Also save in branding bundle for printable documents and cards
    try {
      const existingBranding = localStorage.getItem(`school_branding_${schoolId}`);
      const parsed = existingBranding ? JSON.parse(existingBranding) : {};
      parsed.theme = theme;
      localStorage.setItem(`school_branding_${schoolId}`, JSON.stringify(parsed));
    } catch {}

    applySchoolTheme(theme);
  }

  // Attempt saving to Supabase if columns exist, ignore if not present (code 42703)
  try {
    const { error } = await supabase.from('schools').update({
      theme_primary: theme.primary,
      theme_accent: theme.accent,
      theme_preset: theme.presetId,
    } as any).eq('id', schoolId);

    if (error && error.code !== '42703') {
      console.warn('Note on cloud theme sync:', error.message);
    }
  } catch {
    // Ignore schema discrepancy if columns are not present in Supabase table
  }
}

/**
 * Dark Mode Management
 */
export function getDarkMode(): boolean {
  if (typeof window === 'undefined') return false;
  try {
    return localStorage.getItem('app_dark_mode') === 'true';
  } catch {
    return false;
  }
}

export function setDarkMode(isDark: boolean): void {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem('app_dark_mode', String(isDark));
    if (isDark) {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
  } catch (err) {
    console.warn('Error setting dark mode:', err);
  }
}

export function toggleDarkMode(): boolean {
  const current = getDarkMode();
  const next = !current;
  setDarkMode(next);
  return next;
}

/**
 * Initialization at application bootstrap
 */
export function initThemeAndDarkMode(): void {
  if (typeof window === 'undefined') return;
  
  // 1. Initialize Dark Mode
  const isDark = getDarkMode();
  if (isDark) {
    document.documentElement.classList.add('dark');
  } else {
    document.documentElement.classList.remove('dark');
  }

  // 2. Initialize School Theme
  const theme = getSchoolTheme();
  applySchoolTheme(theme);
}
