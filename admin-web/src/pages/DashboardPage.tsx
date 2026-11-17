import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import type { IconDefinition } from '@fortawesome/fontawesome-svg-core';
import {
  faBan,
  faCalendarDay,
  faDice,
  faDoorOpen,
  faTicket,
  faTowerBroadcast,
  faUserPlus,
  faUsers,
  faUserSecret,
} from '@fortawesome/free-solid-svg-icons';
import { rpc } from '@/lib/supabase';
import { useAsync } from '@/lib/useAsync';

interface Dashboard {
  players: number;
  guests: number;
  newToday: number;
  banned: number;
  openRooms: number;
  runningGames: number;
  roomsToday: number;
  gamesToday: number;
  ticketsToday: number;
  dailyNewPlayers: { day: string; count: number }[];
}

export function DashboardPage() {
  const { data, error, loading, reload } = useAsync(() => rpc<Dashboard>('admin_dashboard'));

  if (loading && !data) return <p className="muted">Loading…</p>;
  if (error) return <p className="error">Could not load dashboard.</p>;
  if (!data) return null;

  const stats: [string, number, IconDefinition, string][] = [
    ['Players', data.players, faUsers, 'linear-gradient(135deg,#4c1d95,#7c3aed)'],
    ['New today', data.newToday, faUserPlus, 'linear-gradient(135deg,#16a34a,#4ade80)'],
    ['Live games', data.runningGames, faTowerBroadcast, 'linear-gradient(135deg,#db2777,#f472b6)'],
    ['Open rooms', data.openRooms, faDoorOpen, 'linear-gradient(135deg,#ea580c,#f5b700)'],
    ['Rooms today', data.roomsToday, faCalendarDay, 'linear-gradient(135deg,#0891b2,#22d3ee)'],
    ['Games today', data.gamesToday, faDice, 'linear-gradient(135deg,#7c3aed,#c026d3)'],
    ['Tickets today', data.ticketsToday, faTicket, 'linear-gradient(135deg,#d97706,#fbbf24)'],
    ['Guests', data.guests, faUserSecret, 'linear-gradient(135deg,#334155,#64748b)'],
    ['Banned', data.banned, faBan, 'linear-gradient(135deg,#dc2626,#f43f5e)'],
  ];
  const max = Math.max(1, ...data.dailyNewPlayers.map((d) => d.count));

  return (
    <>
      <div className="row" style={{ justifyContent: 'flex-end', marginBottom: 14 }}>
        <button className="btn ghost small" onClick={reload}>
          Refresh
        </button>
      </div>
      <div className="grid">
        {stats.map(([label, value, icon, gradient]) => (
          <div key={label} className="panel stat">
            <span className="stat-icon" style={{ background: gradient }}>
              <FontAwesomeIcon icon={icon} />
            </span>
            <div>
              <div className="value">{Number(value).toLocaleString('en-IN')}</div>
              <div className="label">{label}</div>
            </div>
          </div>
        ))}
      </div>
      <div className="spacer" />
      <div className="panel">
        <h2>New players · last 14 days</h2>
        <div style={{ display: 'flex', alignItems: 'flex-end', gap: 6, height: 170 }}>
          {data.dailyNewPlayers.length === 0 ? <p className="muted">No sign-ups yet.</p> : null}
          {data.dailyNewPlayers.map((d) => (
            <div key={d.day} style={{ flex: 1, textAlign: 'center' }} title={`${d.day}: ${d.count}`}>
              <div className="small">{d.count}</div>
              <div style={{ height: (d.count / max) * 120, background: 'var(--gradient)', borderRadius: 8, minHeight: 3 }} />
              <div className="small muted">{d.day.slice(5)}</div>
            </div>
          ))}
        </div>
      </div>
    </>
  );
}
