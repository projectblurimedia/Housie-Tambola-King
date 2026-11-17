import { supabase } from '@/lib/supabase';
import { AppError, toAppError } from './errors';

/** Indian mobile → E.164 (+91XXXXXXXXXX), or null if invalid. */
export function normalizeIndianMobile(input: string): string | null {
  const digits = input.replace(/\D/g, '').replace(/^(91|0)(?=\d{10}$)/, '');
  return /^[6-9]\d{9}$/.test(digits) ? `+91${digits}` : null;
}

export const authService = {
  /** Instant play: an anonymous account carrying the player's name. */
  async playAsGuest(displayName: string, language: string): Promise<void> {
    const { error } = await supabase.auth.signInAnonymously({
      options: { data: { language, display_name: displayName.trim() } },
    });
    if (error) throw toAppError(error);
  },

  /** Sign-in / sign-up by phone. */
  async sendOtp(phone: string, language: string): Promise<void> {
    const { error } = await supabase.auth.signInWithOtp({ phone, options: { data: { language } } });
    if (error) throw toAppError(error);
  },

  async verifyOtp(phone: string, token: string): Promise<void> {
    const { error } = await supabase.auth.verifyOtp({ phone, token, type: 'sms' });
    if (error) throw toAppError(error);
  },

  /** Guest → verified account, keeping coins and history. Sends an OTP to the new phone. */
  async startLinkPhone(phone: string): Promise<void> {
    const { error } = await supabase.auth.updateUser({ phone });
    if (error) throw toAppError(error);
  },

  async verifyLinkPhone(phone: string, token: string): Promise<void> {
    const { error } = await supabase.auth.verifyOtp({ phone, token, type: 'phone_change' });
    if (error) throw toAppError(error);
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

  assertPhone(input: string): string {
    const phone = normalizeIndianMobile(input);
    if (!phone) throw new AppError('INVALID_PHONE');
    return phone;
  },
};
