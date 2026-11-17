/**
 * Every RPC raises a bare UPPER_SNAKE code (see supabase/migrations/*); Edge Functions return
 * { error: { code } }. This normalizes both (plus network/auth errors) into AppError.code,
 * which the UI localizes with errorMessage() — never showing raw server text.
 */
export class AppError extends Error {
  constructor(readonly code: string, message?: string) {
    super(message ?? code);
  }
}

const CODE_RE = /^[A-Z][A-Z0-9_]{2,}$/;

export function toAppError(err: unknown): AppError {
  if (err instanceof AppError) return err;
  const e = err as { message?: string; code?: string; status?: number; name?: string } | null;
  const message = e?.message ?? '';
  if (CODE_RE.test(message)) return new AppError(message);
  if (/network|fetch|timeout|Failed to fetch/i.test(message)) return new AppError('NETWORK_ERROR', message);
  // Supabase Auth error codes (otp_expired, invalid_credentials, over_sms_send_rate_limit, phone_exists…)
  if (e?.code && /^[a-z_]+$/.test(e.code)) return new AppError(`AUTH_${e.code.toUpperCase()}`, message);
  if (/Token has expired or is invalid/i.test(message)) return new AppError('AUTH_OTP_EXPIRED', message);
  return new AppError('UNKNOWN_ERROR', message);
}

/** Unwraps a supabase-js { data, error } result, throwing a normalized AppError. */
export function unwrap<T>(result: { data: T | null; error: unknown }): T {
  if (result.error) throw toAppError(result.error);
  return result.data as T;
}
