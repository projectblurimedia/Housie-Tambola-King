/**
 * Public runtime config. EXPO_PUBLIC_* values are inlined at build time from app/.env
 * (local) or the EAS environment (preview/production builds) — see docs/environment.md.
 */
export const SUPABASE_URL = process.env.EXPO_PUBLIC_SUPABASE_URL ?? '';
export const SUPABASE_ANON_KEY = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY ?? '';

export const IS_CONFIGURED = SUPABASE_URL.startsWith('https://') && SUPABASE_ANON_KEY.length > 20;

/** One place for the brand name — change it here (and app.json) when the final name is chosen. */
export const APP_NAME = 'Housie Tambola King';

/** Owner's choice (2026-11-19) for the public support / policy contact. */
export const SUPPORT_EMAIL = 'projectblurimedia@gmail.com';
/** Public pages served by the admin-web deployment (admin-web/public/*.html). */
export const PRIVACY_URL = 'https://housie-tambola-king-admin.vercel.app/privacy.html';
export const TERMS_URL = 'https://housie-tambola-king-admin.vercel.app/terms.html';
