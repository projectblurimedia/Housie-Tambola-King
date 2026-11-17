import { supabase } from '@/lib/supabase';
import { AppError, toAppError } from './errors';

/** Indian mobile → 10 digits, or null if invalid. */
export function normalizeIndianMobile(input: string): string | null {
  const digits = input.replace(/\D/g, '').replace(/^(91|0)(?=\d{10}$)/, '');
  return /^[6-9]\d{9}$/.test(digits) ? digits : null;
}

export const authService = {
  /**
   * Name + mobile number → straight in, no OTP (testing phase; see
   * supabase/migrations/20261118000001_phone_login.sql). The same number always opens the
   * same account. To be replaced by SMS OTP before public launch.
   */
  async loginWithPhone(mobile: string, displayName: string, language: string): Promise<void> {
    const phone = normalizeIndianMobile(mobile);
    if (!phone) throw new AppError('INVALID_PHONE');
    const creds = await supabase.rpc('phone_login', { p_phone: phone, p_name: displayName.trim() });
    if (creds.error) throw toAppError(creds.error);
    const { error } = await supabase.auth.signInWithPassword(creds.data as { email: string; password: string });
    if (error) throw toAppError(error);
    await supabase.rpc('update_my_profile', { p_language: language }).then(
      () => undefined,
      () => undefined,
    );
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
