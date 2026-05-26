import { createClient } from '@supabase/supabase-js';

function sanitizeEnvValue(value: string | undefined) {
  return value?.trim().replace(/^['"`]/, '').replace(/['"`]$/, '') ?? '';
}

function normalizeSupabaseUrl(rawValue: string | undefined) {
  const value = sanitizeEnvValue(rawValue);
  if (!value) return '';

  const dashboardMatch = value.match(/^https?:\/\/supabase\.com\/dashboard\/project\/([a-z0-9-]+)/i);
  if (dashboardMatch) {
    return `https://${dashboardMatch[1]}.supabase.co`;
  }

  if (/^[a-z0-9-]+$/i.test(value)) {
    return `https://${value}.supabase.co`;
  }

  try {
    return new URL(value).origin;
  } catch {
    return '';
  }
}

const supabaseUrl = normalizeSupabaseUrl(import.meta.env.VITE_SUPABASE_URL);
const supabaseAnonKey = sanitizeEnvValue(import.meta.env.VITE_SUPABASE_ANON_KEY);

export const supabaseConfigError = !supabaseUrl || !supabaseAnonKey
  ? 'Configuration Supabase invalide. Vérifie VITE_SUPABASE_URL et VITE_SUPABASE_ANON_KEY dans Vercel, puis redéploie le site.'
  : null;

if (supabaseConfigError) {
  console.error('[Supabase config]', {
    hasUrl: Boolean(supabaseUrl),
    hasAnonKey: Boolean(supabaseAnonKey),
    rawUrl: import.meta.env.VITE_SUPABASE_URL ?? null,
  });
}

export const supabase = createClient(
  supabaseUrl || 'https://invalid.supabase.local',
  supabaseAnonKey || 'invalid-anon-key',
);
