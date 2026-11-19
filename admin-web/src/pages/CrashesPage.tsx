import { useState } from 'react';
import { rpc, when } from '@/lib/supabase';
import { useAsync } from '@/lib/useAsync';

interface CrashRow {
  id: number;
  createdAt: string;
  fatal: boolean;
  source: 'js' | 'boundary' | 'promise';
  message: string;
  stack: string | null;
  screen: string | null;
  appVersion: string | null;
  updateId: string | null;
  platform: string | null;
  osVersion: string | null;
  userId: string | null;
  userName: string | null;
}

const PAGE = 100;
const SOURCE_LABEL: Record<CrashRow['source'], string> = { js: 'App error', boundary: 'Screen crash', promise: 'Background error' };

/** JavaScript crashes sent by the app (kept 30 days). Native crashes: Play Console → Android vitals. */
export function CrashesPage() {
  const [page, setPage] = useState(0);
  const [open, setOpen] = useState<number | null>(null);
  const { data, loading, reload } = useAsync(
    () => rpc<{ total: number; last24h: number; rows: CrashRow[] }>('admin_list_crashes', { p_limit: PAGE, p_offset: page * PAGE }),
    [page],
  );

  return (
    <>
      <div className="row" style={{ justifyContent: 'space-between', marginBottom: 14 }}>
        <div className="muted">
          {data ? `${data.total} reports · ${data.last24h} in the last 24 hours` : ' '}
        </div>
        <button className="btn ghost small" onClick={reload}>
          Refresh
        </button>
      </div>
      <div className="panel">
        {loading && !data ? <p className="muted">Loading…</p> : null}
        {data && data.rows.length === 0 ? <p className="muted">No crashes reported. 🎉</p> : null}
        {data?.rows.map((c) => (
          <div key={c.id} style={{ borderBottom: '1px solid rgba(127,127,127,0.2)', padding: '10px 0' }}>
            <div className="row" style={{ justifyContent: 'space-between', gap: 10, cursor: 'pointer' }} onClick={() => setOpen(open === c.id ? null : c.id)}>
              <div style={{ minWidth: 0 }}>
                <strong style={{ color: c.fatal ? '#ef4444' : undefined }}>{c.fatal ? 'FATAL · ' : ''}{SOURCE_LABEL[c.source]}</strong>
                <div style={{ wordBreak: 'break-word' }}>{c.message}</div>
                <div className="muted" style={{ fontSize: 12 }}>
                  {when(c.createdAt)} · {c.userName ?? 'signed out'} · {c.screen ?? '—'} · v{c.appVersion ?? '?'} · {c.platform ?? '?'} {c.osVersion ?? ''}
                </div>
              </div>
              <span className="muted">{open === c.id ? '▲' : '▼'}</span>
            </div>
            {open === c.id ? (
              <pre style={{ whiteSpace: 'pre-wrap', fontSize: 11, marginTop: 8, maxHeight: 320, overflow: 'auto' }}>
                {c.stack ?? 'No stack trace'}
                {'\n\nUpdate: '}
                {c.updateId ?? '—'}
              </pre>
            ) : null}
          </div>
        ))}
      </div>
      <div className="row" style={{ gap: 8, marginTop: 12 }}>
        <button className="btn ghost small" disabled={page === 0} onClick={() => setPage((p) => p - 1)}>
          Previous
        </button>
        <button className="btn ghost small" disabled={!data || (page + 1) * PAGE >= data.total} onClick={() => setPage((p) => p + 1)}>
          Next
        </button>
      </div>
    </>
  );
}
