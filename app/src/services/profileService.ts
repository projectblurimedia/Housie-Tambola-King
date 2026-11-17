import { supabase } from '@/lib/supabase';
import type { AppSettings, Me } from '@/types/api';
import { unwrap } from './errors';

export type Language = 'en' | 'te';

export const profileService = {
  async getMe(): Promise<Me> {
    return unwrap(await supabase.rpc('get_me')) as Me;
  },

  async updateProfile(patch: { displayName?: string; avatarKey?: string; language?: Language }): Promise<Me> {
    return unwrap(
      await supabase.rpc('update_my_profile', {
        p_display_name: patch.displayName ?? null,
        p_avatar_key: patch.avatarKey ?? null,
        p_language: patch.language ?? null,
      }),
    ) as Me;
  },

  async getSettings(): Promise<AppSettings> {
    return unwrap(
      await supabase.from('app_settings').select('min_app_version, maintenance_message').eq('id', 1).single(),
    ) as AppSettings;
  },
};
