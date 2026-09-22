'use client';

import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { AlertTriangle } from 'lucide-react';
import { platformApi } from '@/features/platform/platform-client';
import { RequireCapability } from '@/features/platform/require-capability';

const card: React.CSSProperties = {
  background: 'var(--surface)', border: '1px solid var(--line-soft)', borderRadius: 16, boxShadow: 'var(--shadow-1)',
};
const mono: React.CSSProperties = {
  fontFamily: 'var(--mono)', fontSize: 10, letterSpacing: '.1em', textTransform: 'uppercase', color: 'var(--ink-3)',
};

interface AuditRow {
  id: string;
  actorEmail: string; actorName: string; actorRole: string;
  action: string; targetType: string; targetId: string;
  organizationId: string | null; organizationName: string | null;
  previousValue: Record<string, unknown> | null;
  newValue: Record<string, unknown> | null;
  reason: string | null; ipAddress: string | null;
  createdAt: string;
}

const PAGE = 50;

/**
 * The audit log Step 2 has been writing, finally readable.
 *
 * The endpoint and the rows existed; nothing rendered them, so verifying that
 * a suspension was recorded meant opening psql. That is a poor place to keep
 * the only evidence of who did what.
 *
 * SUPER_ADMIN only, because `GET /audit` is — the rows name people and carry
 * before/after values, and the console must not offer a page that exists only
 * to be refused.
 */
export default function AuditPage() {
  return (
    <RequireCapability capability="audit.view">
      <AuditBody />
    </RequireCapability>
  );
}

/** Renders `{"status":"ACTIVE"}` as `status: ACTIVE` — readable, and never a raw blob. */
function ValueCell({ value }: { value: Record<string, unknown> | null }) {
  if (!value || Object.keys(value).length === 0) return <span style={{ color: 'var(--ink-3)' }}>—</span>;
  return (
    <span style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
      {Object.entries(value).map(([k, v]) => (
        <span key={k} style={{ fontSize: 12 }}>
          <span style={{ color: 'var(--ink-3)' }}>{k}: </span>
          <b style={{ fontWeight: 600 }}>{typeof v === 'object' ? JSON.stringify(v) : String(v)}</b>
        </span>
      ))}
    </span>
  );
}

function AuditBody() {
  const [action, setAction] = useState('');
  const [page, setPage] = useState(0);

  const { data, isLoading } = useQuery({
    queryKey: ['pf-audit', action, page],
    queryFn: async () => {
      const q = new URLSearchParams({ take: String(PAGE), skip: String(page * PAGE) });
      if (action) q.set('action', action);
      return (await platformApi.get(`/audit?${q}`)).data as {
        items: AuditRow[]; total: number; take: number; skip: number; available: boolean;
      };
    },
  });

  // Built from what is on screen rather than a hard-coded list: a new action
  // type appears in this filter the day it is first recorded, and an action
  // that has never happened does not offer an empty filter for it.
  const actions = Array.from(new Set((data?.items ?? []).map((i) => i.action))).sort();
  const total = data?.total ?? 0;
  const pages = Math.max(1, Math.ceil(total / PAGE));
  // `available: false` means the table is not in this database — every write
  // is being dropped. Distinguishing that from an empty log is the entire
  // point: "no records" and "no record keeping" must never look alike.
  const unavailable = data !== undefined && data.available === false;

  return (
    <div style={{ animation: 'fadeUp .4s ease' }}>
      <div style={{ marginBottom: 22 }}>
        <h1 style={{ fontSize: 26, fontWeight: 700, letterSpacing: '-.02em', margin: 0 }}>Audit log</h1>
        <p style={{ fontSize: 14, color: 'var(--ink-2)', margin: '6px 0 0' }}>
          {unavailable
            ? 'Who took each platform action, and what changed.'
            : `Every platform action, with who took it and what changed. ${total} record${total === 1 ? '' : 's'}.`}
        </p>
      </div>

      {unavailable && (
        <div style={{
          display: 'flex', gap: 12, alignItems: 'flex-start', marginBottom: 18,
          background: 'var(--danger-bg)', border: '1px solid var(--danger)', borderRadius: 12, padding: '14px 16px',
        }}>
          <AlertTriangle size={18} style={{ color: 'var(--danger)', flexShrink: 0, marginTop: 1 }} />
          <div style={{ fontSize: 13, lineHeight: 1.6 }}>
            <b>Audit records are not being kept in this environment.</b><br />
            The audit table has not been deployed here, so platform actions are
            completing but nothing is being recorded. This is not an empty log —
            it is an absent one. Platform operations still work and are still
            authorised; only the history is missing.
          </div>
        </div>
      )}

      <div style={{ display: 'flex', gap: 10, marginBottom: 14, alignItems: 'center', flexWrap: 'wrap' }}>
        <select className="input" style={{ maxWidth: 280 }} value={action}
                onChange={(e) => { setAction(e.target.value); setPage(0); }}>
          <option value="">All actions</option>
          {actions.map((a) => <option key={a} value={a}>{a}</option>)}
        </select>
        {action && (
          <button className="btn-secondary" style={{ height: 38 }} onClick={() => { setAction(''); setPage(0); }}>
            Clear
          </button>
        )}
      </div>

      <div style={{ ...card, overflow: 'hidden' }}>
        <div style={{ display: 'grid', gridTemplateColumns: '1.5fr 1.3fr 1.2fr 1fr 1fr 0.9fr', gap: 12, padding: '13px 20px', borderBottom: '1px solid var(--line-soft)', ...mono }}>
          <div>Action</div><div>Actor</div><div>Organisation</div><div>Before</div><div>After</div><div style={{ textAlign: 'right' }}>When</div>
        </div>

        {isLoading && <div style={{ padding: 40, textAlign: 'center', color: 'var(--ink-3)' }}>Loading…</div>}

        {!isLoading && data?.items.length === 0 && (
          <div style={{ padding: 40, textAlign: 'center', color: 'var(--ink-3)' }}>
            {unavailable
              ? 'Nothing to show — the audit store is not deployed here.'
              : `No audit records${action ? ' for this action' : ' yet'}.`}
          </div>
        )}

        {data?.items.map((r) => (
          <div key={r.id} style={{ display: 'grid', gridTemplateColumns: '1.5fr 1.3fr 1.2fr 1fr 1fr 0.9fr', gap: 12, padding: '14px 20px', borderBottom: '1px solid var(--line-soft)', alignItems: 'start' }}>
            <div>
              <div style={{ fontWeight: 600, fontSize: 13 }}>{r.action}</div>
              <div style={{ fontSize: 11.5, color: 'var(--ink-3)' }}>{r.targetType}</div>
              {/* The operator typed this to explain the decision. Storing it and
                  not showing it is the same as not asking for it. */}
              {r.reason && (
                <div style={{ fontSize: 12, color: 'var(--ink-2)', marginTop: 6, fontStyle: 'italic', lineHeight: 1.45 }}>
                  &ldquo;{r.reason}&rdquo;
                </div>
              )}
            </div>
            <div>
              <div style={{ fontSize: 13 }}>{r.actorName}</div>
              <div style={{ fontSize: 11.5, color: 'var(--ink-3)' }}>{r.actorEmail} · {r.actorRole.replace('_', ' ').toLowerCase()}</div>
            </div>
            <div style={{ fontSize: 13 }}>
              {r.organizationName ?? <span style={{ color: 'var(--ink-3)' }}>Platform-wide</span>}
            </div>
            <div><ValueCell value={r.previousValue} /></div>
            <div><ValueCell value={r.newValue} /></div>
            <div style={{ textAlign: 'right', fontSize: 12, color: 'var(--ink-3)', whiteSpace: 'nowrap' }}>
              {new Date(r.createdAt).toLocaleString('en-IN', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })}
            </div>
          </div>
        ))}
      </div>

      {pages > 1 && (
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 12, marginTop: 16, fontSize: 13 }}>
          <button className="btn-secondary" disabled={page === 0} onClick={() => setPage((p) => p - 1)}>Previous</button>
          <span style={{ color: 'var(--ink-3)' }}>Page {page + 1} of {pages}</span>
          <button className="btn-secondary" disabled={page + 1 >= pages} onClick={() => setPage((p) => p + 1)}>Next</button>
        </div>
      )}
    </div>
  );
}
