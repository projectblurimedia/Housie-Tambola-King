import i18n from './i18n';
import { toAppError } from '@/services/errors';

/** Localized, user-safe message for any error (never the raw server text). */
export function errorMessage(err: unknown): string {
  const { code } = toAppError(err);
  const key = `errors.${code}`;
  return i18n.exists(key) ? i18n.t(key) : i18n.t('errors.UNKNOWN_ERROR');
}
