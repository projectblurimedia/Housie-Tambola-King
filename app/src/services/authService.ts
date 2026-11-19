import { supabase } from '@/lib/supabase';
import { AppError, toAppError } from './errors';

/** Indian mobile → 10 digits, or null if invalid. */
export function normalizeIndianMobile(input: string): string | null {
  const digits = input.replace(/\D/g, '').replace(/^(91|0)(?=\d{10}$)/, '');
  return /^[6-9]\d{9}$/.test(digits) ? digits : null;
}

/** A wrong PIN: how many tries are left before the 15-minute lock. */
export class PinError extends AppError {
  constructor(
    code: string,
    readonly attemptsLeft?: number,
    readonly lockedUntil?: string,
  ) {
    super(code);
  }
}

type LoginResult = { email: string; password: string } | { error: string; attemptsLeft?: number; lockedUntil?: string };

async function signInWith(result: LoginResult, language: string): Promise<void> {
  if ('error' in result) throw new PinError(result.error, result.attemptsLeft, result.lockedUntil);
  const { error } = await supabase.auth.signInWithPassword(result);
  if (error) throw toAppError(error);
  await supabase.rpc('update_my_profile', { p_language: language }).then(
    () => undefined,
    () => undefined,
  );
}

/**
 * Mobile number + 4-digit PIN (see supabase/migrations/20261130000001_pin_login.sql).
 * The server returns one-time credentials for the account, which we sign in with.
 * Forgot PIN: pending — to be replaced by SMS OTP later.
 */
export const authService = {
  /** New account: name + mobile + PIN (the app asks for the PIN twice). */
  async register(mobile: string, displayName: string, pin: string, language: string): Promise<void> {
    const phone = normalizeIndianMobile(mobile);
    if (!phone) throw new AppError('INVALID_PHONE');
    const res = await supabase.rpc('phone_register', { p_phone: phone, p_name: displayName.trim(), p_pin: pin });
    if (res.error) throw toAppError(res.error);
    await signInWith(res.data as LoginResult, language);
  },

  async login(mobile: string, pin: string, language: string): Promise<void> {
    const phone = normalizeIndianMobile(mobile);
    if (!phone) throw new AppError('INVALID_PHONE');
    const res = await supabase.rpc('pin_login', { p_phone: phone, p_pin: pin });
    if (res.error) throw toAppError(res.error);
    await signInWith(res.data as LoginResult, language);
  },

  async signOut(): Promise<void> {
    const { error } = await supabase.auth.signOut();
    if (error) throw toAppError(error);
  },

  async deleteAccount(): Promise<void> {
    const { error } = await supabase.rpc('delete_my_account');
    if (error) throw toAppError(error);
    await supabase.auth.signOut({ scope: 'local' }).catch(() => undefined);
  },
};
