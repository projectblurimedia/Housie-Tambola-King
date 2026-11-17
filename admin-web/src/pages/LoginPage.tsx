import { FormEvent, useState } from 'react';
import { Navigate } from 'react-router-dom';
import { errorText, isConfigured, supabase } from '@/lib/supabase';
import { useAuth } from '@/components/Auth';

/** Phone OTP sign-in, same Supabase Auth as the app. Admin role is checked after sign-in. */
export function LoginPage() {
  const { session } = useAuth();
  const [phone, setPhone] = useState('');
  const [code, setCode] = useState('');
  const [sent, setSent] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  if (session) return <Navigate to="/" replace />;

  const e164 = `+91${phone.replace(/\D/g, '').slice(-10)}`;

  const send = async (e: FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setError('');
    const { error: err } = await supabase.auth.signInWithOtp({ phone: e164, options: { shouldCreateUser: false } });
    setBusy(false);
    if (err) setError(errorText(err));
    else setSent(true);
  };

  const verify = async (e: FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setError('');
    const { error: err } = await supabase.auth.verifyOtp({ phone: e164, token: code, type: 'sms' });
    setBusy(false);
    if (err) setError(errorText(err));
  };

  return (
    <div className="center" style={{ background: 'linear-gradient(135deg,#4c1d95,#7c3aed,#c026d3)' }}>
      <div className="panel" style={{ width: 360 }}>
        <div className="row" style={{ marginBottom: 16 }}>
          <img src="/favicon.svg" width={40} height={40} alt="" />
          <div>
            <h2 style={{ margin: 0 }}>Housie Tambola King</h2>
            <div className="muted small">Admin console</div>
          </div>
        </div>
        {!isConfigured ? (
          <p className="error">Set VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY in admin-web/.env.local</p>
        ) : !sent ? (
          <form onSubmit={send} style={{ display: 'grid', gap: 12 }}>
            <label className="field">
              Admin mobile number
              <input value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="10-digit mobile" inputMode="numeric" autoFocus />
            </label>
            <button className="btn" disabled={busy || phone.replace(/\D/g, '').length < 10}>
              {busy ? 'Sending…' : 'Send code'}
            </button>
          </form>
        ) : (
          <form onSubmit={verify} style={{ display: 'grid', gap: 12 }}>
            <label className="field">
              Code sent to {e164}
              <input value={code} onChange={(e) => setCode(e.target.value.replace(/\D/g, '').slice(0, 6))} inputMode="numeric" autoFocus />
            </label>
            <button className="btn" disabled={busy || code.length !== 6}>
              {busy ? 'Verifying…' : 'Sign in'}
            </button>
            <button type="button" className="btn ghost" onClick={() => setSent(false)}>
              Change number
            </button>
          </form>
        )}
        {error ? <p className="error">{error}</p> : null}
      </div>
    </div>
  );
}
