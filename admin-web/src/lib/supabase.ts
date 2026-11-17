import { createClient } from '@supabase/supabase-js';

const url = import.meta.env.VITE_SUPABASE_URL as string | undefined;
const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined;

export const isConfigured = !!url && !!anonKey;

export const supabase = createClient(url || 'https://placeholder.supabase.co', anonKey || 'placeholder', {
  auth: { persistSession: true, autoRefreshToken: true },
});

/** Every RPC raises a bare UPPER_SNAKE code; show it readably. */
export function errorText(err: unknown): string {
  const message = (err as { message?: string })?.message ?? 'Something went wrong';
  return /^[A-Z_]+$/.test(message) ? message.replace(/_/g, ' ').toLowerCase().replace(/^\w/, (c) => c.toUpperCase()) : message;
}

/** rpc() that throws instead of returning { error }. */
export async function rpc<T>(fn: string, args?: Record<string, unknown>): Promise<T> {
  const { data, error } = await supabase.rpc(fn, args);
  if (error) throw error;
  return data as T;
}

export function rupees(paise: number): string {
  return `₹${(paise / 100).toLocaleString('en-IN', { maximumFractionDigits: 2 })}`;
}

export function coins(n: number): string {
  return Number(n).toLocaleString('en-IN');
}

export function when(iso: string | null | undefined): string {
  return iso ? new Date(iso).toLocaleString('en-IN', { dateStyle: 'medium', timeStyle: 'short' }) : '—';
}
