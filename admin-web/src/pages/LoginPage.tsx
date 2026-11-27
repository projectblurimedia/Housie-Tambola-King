import { FormEvent, useState } from 'react';
import { Navigate } from 'react-router-dom';
import { errorText, isConfigured, supabase } from '@/lib/supabase';
import { useAuth } from '@/components/Auth';
import { BrandMark } from '@/components/Layout';

/**
 * Temporary admin sign-in: mobile number + password (no SMS provider is connected yet).
 * Each admin is a Supabase email/password user whose email is derived from the number,
 * created by SQL (see docs/environment.md → "Admin login"). The admin role is still
 * checked server-side on every admin RPC. Planned: switch back to phone OTP + 2FA.
 */
export function adminEmailFor(mobile: string): string {
  return `91${mobile.replace(/\D/g, '').slice(-10)}@admin.housietambolaking.app`;
}

export function LoginPage() {
  const { session } = useAuth();
  const [phone, setPhone] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  if (session) return <Navigate to="/" replace />;

  const signIn = async (e: FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setError('');
    const { error: err } = await supabase.auth.signInWithPassword({ email: adminEmailFor(phone), password });
    setBusy(false);
    if (err) setError(err.message.includes('Invalid login') ? 'Wrong mobile number or password' : errorText(err));
  };

  return (
    <div className="center">
      <div className="glass login-card">
        <div className="sidebar-brand">
          <span className="brand-mark">
            <BrandMark size={44} />
          </span>
          <div>
            <div className="brand-name">
              Housie Tambola King
            </div>
            <div className="brand-sub">Admin control centre</div>
          </div>
        </div>
        {!isConfigured ? (
          <p className="error" style={{ padding: 24 }}>
            Set VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY in admin-web/.env.local
          </p>
        ) : (
          <form onSubmit={signIn}>
            <label className="field">
              Admin mobile number
              <input value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="10-digit mobile" inputMode="numeric" autoFocus />
            </label>
            <label className="field">
              Password
              <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} autoComplete="current-password" />
            </label>
            <button className="btn" disabled={busy || phone.replace(/\D/g, '').length < 10 || !password}>
              {busy ? 'Signing in…' : 'Sign in'}
            </button>
          </form>
        )}
        {error ? <p className="error">{error}</p> : null}
      </div>
    </div>
  );
}
