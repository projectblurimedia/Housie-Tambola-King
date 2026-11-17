import { useState } from 'react';
import { errorText, rpc, rupees, when } from '@/lib/supabase';
import { useAsync } from '@/lib/useAsync';
import { useToast } from '@/components/Toast';

interface RoomRow {
  id: string;
  code: string;
  title: string;
  kind: 'normal' | 'series';
  visibility: 'public' | 'private';
  status: 'open' | 'ended';
  ticketPrice: number;
  memberCount: number;
  maxPlayers: number;
  gamesPlayed: number;
  totalGames: number;
  gameStatus: string | null;
  createdAt: string;
  hostName: string | null;
}

const PAGE = 50;

/** Every room (normal + series). Ending a room cancels its current game; standings stay. */
export function RoomsPage() {
  const toast = useToast();
  const [status, setStatus] = useState('');
  const [page, setPage] = useState(0);
  const { data, loading, reload } = useAsync(
    () => rpc<{ total: number; rows: RoomRow[] }>('admin_list_rooms', { p_status: status || null, p_limit: PAGE, p_offset: page * PAGE }),
    [status, page],
  );

  const end = async (r: RoomRow) => {
    const reason = prompt(`End room "${r.title}" (${r.code}) for everyone? Reason:`);
    if (!reason) return;
    try {
      await rpc('admin_end_room', { p_room: r.id, p_reason: reason });
      toast('Room ended');
      reload();
    } catch (err) {
      toast(errorText(err), true);
    }
  };

  return (
    <>
      <div className="row" style={{ justifyContent: 'space-between' }}>
        <h1>Rooms</h1>
        <button className="btn ghost small" onClick={reload}>
          Refresh
        </button>
      </div>
      <select
        value={status}
        onChange={(e) => {
          setPage(0);
          setStatus(e.target.value);
        }}
      >
        <option value="">All rooms</option>
        <option value="open">Open</option>
        <option value="ended">Ended</option>
      </select>
      <div className="spacer" />
      <div className="panel table-wrap">
        <table>
          <thead>
            <tr>
              <th>Room</th>
              <th>Type</th>
              <th>Status</th>
              <th>Players</th>
              <th>Games</th>
              <th>Ticket</th>
              <th>Created</th>
              <th />
            </tr>
          </thead>
          <tbody>
            {(data?.rows ?? []).map((r) => (
              <tr key={r.id}>
                <td>
                  <b>{r.title}</b>
                  <div className="small muted">
                    {r.code}
                    {r.hostName ? ` · host ${r.hostName}` : ''}
                  </div>
                </td>
                <td>
                  {r.kind} · {r.visibility}
                </td>
                <td>
                  <span className={`badge ${r.status === 'open' ? r.gameStatus ?? 'active' : 'cancelled'}`}>
                    {r.status === 'open' ? r.gameStatus ?? 'open' : 'ended'}
                  </span>
                </td>
                <td>
                  {r.memberCount}/{r.maxPlayers}
                </td>
                <td>
                  {r.gamesPlayed}/{r.totalGames}
                </td>
                <td>{rupees(Number(r.ticketPrice) * 100)}</td>
                <td className="small">{when(r.createdAt)}</td>
                <td>
                  {r.status === 'open' ? (
                    <button className="btn danger small" onClick={() => end(r)}>
                      End
                    </button>
                  ) : null}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {loading ? <p className="muted">Loading…</p> : null}
        <div className="pager">
          <span className="muted small">{data ? `${data.total} rooms` : ''}</span>
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
