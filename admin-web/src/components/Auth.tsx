import { createContext, ReactNode, useContext, useEffect, useState } from 'react';
import { Navigate } from 'react-router-dom';
import type { Session } from '@supabase/supabase-js';
import { rpc, supabase } from '@/lib/supabase';

interface Me {
  id: string;
  displayName: string;
  role: 'player' | 'admin';
  phone: string | null;
}

interface AuthState {
  session: Session | null;
  me: Me | null;
  ready: boolean;
  refresh: () => Promise<void>;
}

const AuthContext = createContext<AuthState>({ session: null, me: null, ready: false, refresh: async () => undefined });

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [me, setMe] = useState<Me | null>(null);
  const [ready, setReady] = useState(false);

  const loadMe = async (s: Session | null) => {
    if (!s) {
      setMe(null);
      return;
    }
    try {
      setMe(await rpc<Me>('get_me'));
    } catch {
      setMe(null);
    }
  };

  useEffect(() => {
    supabase.auth.getSession().then(async ({ data }) => {
      setSession(data.session);
      await loadMe(data.session);
      setReady(true);
    });
    const { data } = supabase.auth.onAuthStateChange((_e, s) => {
      setSession(s);
      loadMe(s);
    });
    return () => data.subscription.unsubscribe();
  }, []);

  return (
    <AuthContext.Provider value={{ session, me, ready, refresh: () => loadMe(session) }}>{children}</AuthContext.Provider>
  );
}

export const useAuth = () => useContext(AuthContext);

/** UI gate only — every admin RPC/policy re-checks the role on the server. */
export function RequireAdmin({ children }: { children: ReactNode }) {
  const { session, me, ready } = useAuth();
  if (!ready) return <div className="center muted">Loading…</div>;
  if (!session) return <Navigate to="/login" replace />;
  if (!me) return <div className="center muted">Loading…</div>;
  if (me.role !== 'admin') {
    return (
      <div className="center">
        <div className="panel" style={{ maxWidth: 420, textAlign: 'center' }}>
          <h2>Not an admin</h2>
          <p className="muted">This account ({me.phone ?? me.displayName}) is not an admin. See scripts/make-admin.sql.</p>
          <button className="btn" onClick={() => supabase.auth.signOut()}>
            Sign out
          </button>
        </div>
      </div>
    );
  }
  return <>{children}</>;
}
