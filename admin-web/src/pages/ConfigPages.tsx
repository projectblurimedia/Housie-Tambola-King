/**
 * App settings and the audit log. Settings are written directly through supabase-js; RLS
 * only lets admins write, and a DB trigger audit-logs every change.
 */
import { supabase, errorText, when } from '@/lib/supabase';
import { useAsync } from '@/lib/useAsync';
import { useToast } from '@/components/Toast';

async function must<T>(p: PromiseLike<{ data: T | null; error: unknown }>): Promise<T> {
  const { data, error } = await p;
  if (error) throw error;
  return data as T;
}

interface Settings {
  min_app_version: string;
  maintenance_message: string | null;
}

export function SettingsPage() {
  const toast = useToast();
  const { data, setData } = useAsync(() => must<Settings>(supabase.from('app_settings').select('*').eq('id', 1).single()));
  if (!data) return <p className="muted">Loading…</p>;
  const save = async () => {
    try {
      await must(
        supabase
          .from('app_settings')
          .update({
            min_app_version: data.min_app_version,
            maintenance_message: data.maintenance_message || null,
            updated_at: new Date().toISOString(),
          })
          .eq('id', 1),
      );
      toast('Settings saved');
    } catch (err) {
      toast(errorText(err), true);
    }
  };
  return (
    <>
      <h1>Settings</h1>
      <div className="panel" style={{ maxWidth: 640, display: 'grid', gap: 14 }}>
        <label className="field">
          Minimum app version
          <input value={data.min_app_version} onChange={(e) => setData({ ...data, min_app_version: e.target.value })} />
        </label>
        <label className="field">
          Notice shown on the app home screen (empty = none)
          <textarea
            rows={3}
            value={data.maintenance_message ?? ''}
            onChange={(e) => setData({ ...data, maintenance_message: e.target.value })}
          />
        </label>
        <div>
          <button className="btn" onClick={save}>
            Save settings
          </button>
        </div>
      </div>
    </>
  );
}

interface AuditRow {
  id: number;
  actor_id: string | null;
  action: string;
  target: string | null;
  details: unknown;
  created_at: string;
}

export function AuditPage() {
  const { data } = useAsync(() => must<AuditRow[]>(supabase.from('audit_log').select('*').order('id', { ascending: false }).limit(200)));
  return (
    <>
      <h1>Audit Log</h1>
      <p className="muted">Append-only record of admin actions and config changes (latest 200).</p>
      <div className="panel table-wrap">
        <table>
          <thead>
            <tr>
              <th>When</th>
              <th>Action</th>
              <th>Target</th>
              <th>Actor</th>
              <th>Details</th>
            </tr>
          </thead>
          <tbody>
            {(data ?? []).map((a) => (
              <tr key={a.id}>
                <td className="small">{when(a.created_at)}</td>
                <td>
                  <b>{a.action}</b>
                </td>
                <td className="small">{a.target}</td>
                <td className="small muted">{a.actor_id?.slice(0, 8)}</td>
                <td>
                  <pre>{JSON.stringify(a.details)}</pre>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  );
}
