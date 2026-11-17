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

  const stats: [string, number][] = [
    ['Players', data.players],
    ['New today', data.newToday],
    ['Guests', data.guests],
    ['Banned', data.banned],
    ['Open rooms', data.openRooms],
    ['Live games', data.runningGames],
    ['Rooms today', data.roomsToday],
    ['Games today', data.gamesToday],
    ['Tickets today', data.ticketsToday],
  ];
  const max = Math.max(1, ...data.dailyNewPlayers.map((d) => d.count));

  return (
    <>
      <div className="row" style={{ justifyContent: 'space-between' }}>
        <h1>Dashboard</h1>
        <button className="btn ghost small" onClick={reload}>
          Refresh
        </button>
      </div>
      <div className="grid">
        {stats.map(([label, value]) => (
          <div key={label} className="panel stat">
            <div className="label">{label}</div>
            <div className="value">{Number(value).toLocaleString('en-IN')}</div>
          </div>
        ))}
      </div>
      <div className="spacer" />
      <div className="panel">
        <h2>New players · last 14 days</h2>
        <div style={{ display: 'flex', alignItems: 'flex-end', gap: 6, height: 160 }}>
          {data.dailyNewPlayers.map((d) => (
            <div key={d.day} style={{ flex: 1, textAlign: 'center' }} title={`${d.day}: ${d.count}`}>
              <div className="small">{d.count}</div>
              <div style={{ height: (d.count / max) * 120, background: 'var(--primary)', borderRadius: 6, minHeight: 2 }} />
              <div className="small muted">{d.day.slice(5)}</div>
            </div>
          ))}
        </div>
      </div>
    </>
  );
}
