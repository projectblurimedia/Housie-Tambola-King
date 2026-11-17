import { useEffect, useState } from 'react';
import { NavLink, Outlet, useLocation } from 'react-router-dom';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import type { IconDefinition } from '@fortawesome/fontawesome-svg-core';
import { faBars, faChartPie, faClockRotateLeft, faDice, faRightFromBracket, faSliders, faUsers } from '@fortawesome/free-solid-svg-icons';
import { supabase } from '@/lib/supabase';
import { useAuth } from './Auth';

interface NavItem {
  to: string;
  label: string;
  sub: string;
  icon: IconDefinition;
  gradient: string;
}

// Same colourful gradient squares as the NearbyU admin menu.
const SECTIONS: { title: string; items: NavItem[] }[] = [
  {
    title: 'Overview',
    items: [{ to: '/', label: 'Dashboard', sub: 'Players, rooms and games at a glance', icon: faChartPie, gradient: 'linear-gradient(135deg,#4c1d95,#7c3aed)' }],
  },
  {
    title: 'Game',
    items: [
      { to: '/players', label: 'Players', sub: 'Search, ban and manage players', icon: faUsers, gradient: 'linear-gradient(135deg,#db2777,#f472b6)' },
      { to: '/rooms', label: 'Rooms', sub: 'Normal and series rooms', icon: faDice, gradient: 'linear-gradient(135deg,#ea580c,#f5b700)' },
    ],
  },
  {
    title: 'App setup',
    items: [
      { to: '/settings', label: 'Settings', sub: 'Home-screen notice and app version', icon: faSliders, gradient: 'linear-gradient(135deg,#0891b2,#7c3aed)' },
      { to: '/audit', label: 'Audit Log', sub: 'Every admin action, append-only', icon: faClockRotateLeft, gradient: 'linear-gradient(135deg,#334155,#64748b)' },
    ],
  },
];

const ALL = SECTIONS.flatMap((s) => s.items);

function itemFor(pathname: string): NavItem {
  return ALL.filter((i) => i.to !== '/' && pathname.startsWith(i.to)).sort((a, b) => b.to.length - a.to.length)[0] ?? ALL[0];
}

export function BrandMark({ size = 30 }: { size?: number }) {
  return <img src="/favicon.svg" width={size} height={size} alt="" />;
}

/** Every admin page: the glass sidebar (a drawer on small screens) and the page beside it. */
export function Layout() {
  const { me } = useAuth();
  const location = useLocation();
  const [navOpen, setNavOpen] = useState(false);
  const current = itemFor(location.pathname);

  useEffect(() => setNavOpen(false), [location.pathname]);

  return (
    <div className={`shell${navOpen ? ' nav-open' : ''}`}>
      <div className="scrim" onClick={() => setNavOpen(false)} />
      <aside className="sidebar">
        <div className="sidebar-panel glass">
          <div className="sidebar-brand">
            <span className="brand-mark">
              <BrandMark />
            </span>
            <div>
              <div className="brand-name">Housie Tambola King</div>
              <div className="brand-sub">Admin control centre</div>
            </div>
          </div>
          <nav className="nav">
            {SECTIONS.map((section) => (
              <div key={section.title}>
                <div className="nav-section">{section.title}</div>
                {section.items.map((item) => (
                  <NavLink key={item.to} to={item.to} end={item.to === '/'} className={({ isActive }) => `nav-item${isActive ? ' active' : ''}`}>
                    <span className="nav-icon" style={{ background: item.gradient }}>
                      <FontAwesomeIcon icon={item.icon} />
                    </span>
                    {item.label}
                  </NavLink>
                ))}
              </div>
            ))}
          </nav>
          <div className="sidebar-footer">
            <span className="avatar">{(me?.displayName ?? 'A').slice(0, 1).toUpperCase()}</span>
            <div className="who">
              <strong>{me?.displayName ?? 'Admin'}</strong>
              <span>{me?.phone ? `+${me.phone.slice(0, 2)} ${me.phone.slice(2)}` : 'Administrator'}</span>
            </div>
            <button className="icon-btn" title="Sign out" onClick={() => supabase.auth.signOut()}>
              <FontAwesomeIcon icon={faRightFromBracket} />
            </button>
          </div>
        </div>
      </aside>
      <main className="main">
        <header className="topbar glass">
          <button className="icon-btn menu-btn" onClick={() => setNavOpen(true)} aria-label="Menu">
            <FontAwesomeIcon icon={faBars} />
          </button>
          <span className="nav-icon" style={{ background: current.gradient }}>
            <FontAwesomeIcon icon={current.icon} />
          </span>
          <div className="topbar-title">
            <h1>{current.label}</h1>
            <p>{current.sub}</p>
          </div>
        </header>
        <div className="content">
          <Outlet />
        </div>
      </main>
    </div>
  );
}
