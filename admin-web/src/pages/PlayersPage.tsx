import { useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { errorText, rpc, when } from '@/lib/supabase';
import { useAsync } from '@/lib/useAsync';
import { useToast } from '@/components/Toast';

const inr = (n: number) => `₹${Number(n).toLocaleString('en-IN', { maximumFractionDigits: 2 })}`;

interface PlayerRow {
  id: string;
  displayName: string;
  phone: string | null;
  isGuest: boolean;
  role: 'player' | 'admin';
  isBanned: boolean;
  gamesPlayed: number;
  prizesWon: number;
  amountWon: number;
  createdAt: string;
}

const PAGE = 50;

export function PlayersPage() {
  const navigate = useNavigate();
  const [search, setSearch] = useState('');
  const [query, setQuery] = useState('');
  const [filter, setFilter] = useState('all');
  const [page, setPage] = useState(0);
  const { data, loading, error } = useAsync(
    () =>
      rpc<{ total: number; rows: PlayerRow[] }>('admin_list_players', {
        p_search: query,
        p_filter: filter,
        p_limit: PAGE,
        p_offset: page * PAGE,
      }),
    [query, filter, page],
  );

  return (
    <>
      <form
        className="row"
        onSubmit={(e) => {
          e.preventDefault();
          setPage(0);
          setQuery(search);
        }}
      >
        <input placeholder="Search name, phone or id" value={search} onChange={(e) => setSearch(e.target.value)} style={{ minWidth: 280 }} />
        <select
          value={filter}
          onChange={(e) => {
            setPage(0);
            setFilter(e.target.value);
          }}
        >
          <option value="all">All</option>
          <option value="verified">Verified</option>
          <option value="guests">Guests</option>
          <option value="banned">Banned</option>
          <option value="admins">Admins</option>
        </select>
        <button className="btn">Search</button>
      </form>
      <div className="spacer" />
      <div className="panel table-wrap">
        {error ? <p className="error">{errorText(error)}</p> : null}
        <table>
          <thead>
            <tr>
              <th>Name</th>
              <th>Phone</th>
              <th>Status</th>
              <th>Games</th>
              <th>Prizes</th>
              <th>Won</th>
              <th>Joined</th>
            </tr>
          </thead>
          <tbody>
            {(data?.rows ?? []).map((p) => (
              <tr key={p.id} className="clickable" onClick={() => navigate(`/players/${p.id}`)}>
                <td>{p.displayName}</td>
                <td>{p.phone ?? <span className="muted">—</span>}</td>
                <td>
                  {p.isBanned ? <span className="badge banned">banned</span> : null}{' '}
                  {p.role === 'admin' ? <span className="badge admin">admin</span> : null}{' '}
                  {p.isGuest ? <span className="badge guest">guest</span> : <span className="badge active">verified</span>}
                </td>
                <td>{p.gamesPlayed}</td>
                <td>{p.prizesWon}</td>
                <td>{inr(p.amountWon)}</td>
                <td className="small">{when(p.createdAt)}</td>
              </tr>
            ))}
          </tbody>
        </table>
        {loading ? <p className="muted">Loading…</p> : null}
        <div className="pager">
          <span className="muted small">{data ? `${data.total} players` : ''}</span>
          <button className="btn ghost small" disabled={page === 0} onClick={() => setPage(page - 1)}>
            ‹ Prev
          </button>
          <button className="btn ghost small" disabled={!data || (page + 1) * PAGE >= data.total} onClick={() => setPage(page + 1)}>
            Next ›
          </button>
        </div>
      </div>
    </>
  );
}

interface PlayerDetail {
  profile: {
    id: string;
    display_name: string;
    phone: string | null;
    role: string;
    is_guest: boolean;
    is_banned: boolean;
    banned_reason: string | null;
    games_played: number;
    prizes_won: number;
    amount_won: number;
    /** Play coins (no money). */
    coins?: number;
    created_at: string;
  } | null;
  rooms: { id: string; code: string; title: string; kind: string; status: string; joinedAt: string; isHost: boolean }[];
  wins: { prize: string; amount: number; createdAt: string }[];
}

export function PlayerDetailPage() {
  const { id } = useParams();
  const toast = useToast();
  const { data, loading, reload } = useAsync(() => rpc<PlayerDetail>('admin_get_player', { p_user: id }), [id]);
  const [coinDelta, setCoinDelta] = useState('');
  const [coinNote, setCoinNote] = useState('');
  const access = useAsync(() => rpc<number>('admin_get_amount_access', { p_user: id }), [id]);

  if (loading && !data) return <p className="muted">Loading…</p>;
  if (!data?.profile) return <p className="error">Player not found.</p>;
  const p = data.profile;

  const act = async (fn: () => Promise<unknown>, ok: string) => {
    try {
      await fn();
      toast(ok);
      reload();
    } catch (err) {
      toast(errorText(err), true);
    }
  };

  return (
    <>
      <h1>{p.display_name}</h1>
      <div className="grid">
        <div className="panel stat">
          <div className="label">Games</div>
          <div className="value">{p.games_played}</div>
        </div>
        <div className="panel stat">
          <div className="label">Prizes</div>
          <div className="value">{p.prizes_won}</div>
        </div>
        <div className="panel stat">
          <div className="label">Won</div>
          <div className="value">{inr(p.amount_won)}</div>
        </div>
        <div className="panel stat">
          <div className="label">Coins</div>
          <div className="value">🪙 {Number(p.coins ?? 0).toLocaleString('en-IN')}</div>
        </div>
      </div>
      <div className="spacer" />
      {/* Play coins: give (e.g. a player who ran out) or take back. Logged in the audit log. */}
      <div className="panel" style={{ display: 'grid', gap: 10, maxWidth: 520 }}>
        <b>Adjust coins</b>
        <div className="row">
          <input type="number" placeholder="Amount (e.g. 500 or -200)" value={coinDelta} onChange={(e) => setCoinDelta(e.target.value)} style={{ maxWidth: 200 }} />
          <input placeholder="Note (optional)" value={coinNote} onChange={(e) => setCoinNote(e.target.value)} style={{ flex: 1, minWidth: 160 }} />
          <button
            className="btn"
            disabled={!Number(coinDelta)}
            onClick={() =>
              act(async () => {
                await rpc('admin_adjust_coins', { p_user: p.id, p_delta: Number(coinDelta), p_note: coinNote || null });
                setCoinDelta('');
                setCoinNote('');
              }, 'Coins updated')
            }
          >
            Apply
          </button>
        </div>
        <span className="muted" style={{ fontSize: 12 }}>
          Positive gives coins, negative takes them (never below 0). Coins are for play only — they have no money value.
        </span>
      </div>
      <div className="spacer" />
      {/* ₹ Amount rooms (scores only — players settle among themselves outside the app). */}
      <div className="panel" style={{ display: 'grid', gap: 10, maxWidth: 520 }}>
        <b>₹ Amount rooms</b>
        <div className="row">
          {[
            [0, 'No access'],
            [1, 'Can join'],
            [2, 'Can create + join'],
          ].map(([level, label]) => (
            <button
              key={level}
              className={'btn' + (access.data === level ? ' success' : ' ghost')}
              onClick={() =>
                act(async () => {
                  await rpc('admin_set_amount_access', { p_user: p.id, p_level: level });
                  access.reload();
                }, 'Access updated')
              }
            >
              {label}
            </button>
          ))}
        </div>
        <span className="muted" style={{ fontSize: 12 }}>
          Only approved numbers see the ₹ Amount option. Amounts are for scoring only — the app never collects or pays money.
        </span>
      </div>
      <div className="spacer" />
      <div className="panel">
        <p>
          <b>Phone:</b> {p.phone ?? '—'} · <b>Role:</b> {p.role} · <b>Guest:</b> {p.is_guest ? 'yes' : 'no'} · <b>Joined:</b>{' '}
          {when(p.created_at)}
          <br />
          <b>Id:</b> <code>{p.id}</code>
        </p>
        <div className="row">
          {p.is_banned ? (
            <button className="btn success" onClick={() => act(() => rpc('admin_set_ban', { p_user: p.id, p_banned: false }), 'Unbanned')}>
              Unban
            </button>
          ) : (
            <button
              className="btn danger"
              onClick={() => {
                const reason = prompt('Ban reason (shown to the player):');
                if (reason) act(() => rpc('admin_set_ban', { p_user: p.id, p_banned: true, p_reason: reason }), 'Banned');
              }}
            >
              Ban player
            </button>
          )}
          <button
            className="btn ghost"
            onClick={() => {
              const role = p.role === 'admin' ? 'player' : 'admin';
              if (confirm(`Make this account ${role}?`)) act(() => rpc('admin_set_role', { p_user: p.id, p_role: role }), 'Role updated');
            }}
          >
            {p.role === 'admin' ? 'Remove admin' : 'Make admin'}
          </button>
          {p.is_banned ? <span className="error">Banned: {p.banned_reason}</span> : null}
        </div>
      </div>
      <div className="spacer" />
      <div className="panel table-wrap">
        <h2>Rooms</h2>
        <table>
          <thead>
            <tr>
              <th>Joined</th>
              <th>Room</th>
              <th>Type</th>
              <th>Status</th>
            </tr>
          </thead>
          <tbody>
            {data.rooms.map((r) => (
              <tr key={r.id}>
                <td className="small">{when(r.joinedAt)}</td>
                <td>
                  {r.title} <span className="muted small">{r.code}</span> {r.isHost ? <span className="badge admin">host</span> : null}
                </td>
                <td>{r.kind}</td>
                <td>{r.status}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="spacer" />
      <div className="panel table-wrap">
        <h2>Wins</h2>
        <table>
          <thead>
            <tr>
              <th>When</th>
              <th>Prize</th>
              <th>Amount</th>
            </tr>
          </thead>
          <tbody>
            {data.wins.map((w, i) => (
              <tr key={i}>
                <td className="small">{when(w.createdAt)}</td>
                <td>{w.prize}</td>
                <td>{inr(w.amount)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  );
}
