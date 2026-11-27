import { useEffect, useState } from 'react';
import { NavLink, Outlet, useLocation } from 'react-router-dom';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import type { IconDefinition } from '@fortawesome/fontawesome-svg-core';
import {
  faBars,
  faBug,
  faChartPie,
  faClockRotateLeft,
  faDice,
  faRightFromBracket,
  faSliders,
  faUsers,
  faXmark,
} from '@fortawesome/free-solid-svg-icons';
import { supabase } from '@/lib/supabase';
import { useAuth } from './Auth';

interface NavItem {
  to: string;
  label: string;
  sub: string;
  icon: IconDefinition;
  gradient: string;
}

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
      { to: '/crashes', label: 'Crashes', sub: 'App errors sent from player phones', icon: faBug, gradient: 'linear-gradient(135deg,#dc2626,#f97316)' },
      { to: '/audit', label: 'Audit Log', sub: 'Every admin action, append-only', icon: faClockRotateLeft, gradient: 'linear-gradient(135deg,#334155,#64748b)' },
    ],
  },
];

const ALL = SECTIONS.flatMap((s) => s.items);
const MOBILE = '(max-width: 900px)';
const COLLAPSE_KEY = 'admin.navCollapsed';

function itemFor(pathname: string): NavItem {
  return ALL.filter((i) => i.to !== '/' && pathname.startsWith(i.to)).sort((a, b) => b.to.length - a.to.length)[0] ?? ALL[0];
}

/** The app's icon: purple tile, gold edge, shiny crown and the 7 · 31 · 65 balls. */
export function BrandMark({ size = 30 }: { size?: number }) {
  return <img src="/brand.svg" width={size} height={size} alt="" style={{ display: 'block' }} />;
}

function readCollapsed(): boolean {
  try {
    return localStorage.getItem(COLLAPSE_KEY) === '1';
  } catch {
    return false;
  }
}

/**
 * Every admin page: a frosted-glass sidebar beside the page. The ☰ button always works:
 * on a wide screen it folds the sidebar away (remembered), on a phone it opens a drawer that
 * closes with ✕, the dimmed backdrop, Esc, or choosing a page.
 */
export function Layout() {
  const { me } = useAuth();
  const location = useLocation();
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [collapsed, setCollapsed] = useState(readCollapsed);
  const current = itemFor(location.pathname);

  useEffect(() => setDrawerOpen(false), [location.pathname]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && setDrawerOpen(false);
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  // The page behind an open drawer doesn't scroll.
  useEffect(() => {
    document.body.style.overflow = drawerOpen ? 'hidden' : '';
    return () => {
      document.body.style.overflow = '';
    };
  }, [drawerOpen]);

  const toggle = () => {
    if (window.matchMedia(MOBILE).matches) {
      setDrawerOpen((o) => !o);
      return;
    }
    setCollapsed((c) => {
      try {
        localStorage.setItem(COLLAPSE_KEY, c ? '0' : '1');
      } catch {
        // Private mode: just don't remember it.
      }
      return !c;
    });
  };

  return (
    <div className={`shell${drawerOpen ? ' nav-open' : ''}${collapsed ? ' nav-collapsed' : ''}`}>
      <div className="scrim" onClick={() => setDrawerOpen(false)} aria-hidden />
      <aside className="sidebar" aria-label="Menu">
        <div className="sidebar-panel glass">
          <div className="sidebar-brand">
            <span className="brand-mark">
              <BrandMark size={44} />
            </span>
            <div className="brand-text">
              <div className="brand-name">
                Housie Tambola <span className="gold-text">King</span>
              </div>
              <div className="brand-sub">Admin control centre</div>
            </div>
            <button className="icon-btn drawer-close" onClick={() => setDrawerOpen(false)} aria-label="Close menu">
              <FontAwesomeIcon icon={faXmark} />
            </button>
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
          <button
            className="icon-btn menu-btn"
            onClick={toggle}
            aria-label={drawerOpen || !collapsed ? 'Hide menu' : 'Show menu'}
            aria-expanded={drawerOpen || !collapsed}
          >
            <FontAwesomeIcon icon={faBars} />
          </button>
          <span className="topbar-brand">
            <BrandMark size={34} />
          </span>
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
