import { NavLink, Outlet } from 'react-router-dom';
import { supabase } from '@/lib/supabase';
import { useAuth } from './Auth';

const NAV = [
  { to: '/', label: 'Dashboard', icon: '📊' },
  { to: '/players', label: 'Players', icon: '👥' },
  { to: '/rooms', label: 'Rooms', icon: '🎱' },
  { to: '/settings', label: 'Settings', icon: '⚙️' },
  { to: '/audit', label: 'Audit Log', icon: '📜' },
];

export function Layout() {
  const { me } = useAuth();
  return (
    <div className="shell">
      <aside className="sidebar">
        <div className="brand">
          <img src="/favicon.svg" width={34} height={34} alt="" />
          <div>
            <strong>Housie Tambola King</strong>
            <div className="muted small">Admin</div>
          </div>
        </div>
        <nav>
          {NAV.map((n) => (
            <NavLink key={n.to} to={n.to} end={n.to === '/'} className={({ isActive }) => (isActive ? 'nav active' : 'nav')}>
              <span>{n.icon}</span>
              {n.label}
            </NavLink>
          ))}
        </nav>
        <div className="sidebar-footer">
          <div className="small muted">{me?.displayName}</div>
          <button className="btn ghost small" onClick={() => supabase.auth.signOut()}>
            Sign out
          </button>
        </div>
      </aside>
      <main className="content">
        <Outlet />
      </main>
    </div>
  );
}
