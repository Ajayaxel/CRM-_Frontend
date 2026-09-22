'use client';

import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { Flag, AlertTriangle, ChevronRight, Trash2 } from 'lucide-react';
import { api, apiErrorMessage } from '@/lib/api';
import { useAuth } from '@/features/foundation/auth';
import {
  MilestoneRow, MilestoneStatus, Paged, MILESTONE_META, NEXT_MILESTONE,
  money, dueLabel, userLabel,
} from '../consulting-client';

const card: React.CSSProperties = { background: 'var(--surface)', border: '1px solid var(--line-soft)', borderRadius: 16 };
const FILTERS = ['all', 'open', 'overdue', 'done'] as const;
type Filter = (typeof FILTERS)[number];

/**
 * Delivery across every engagement, which until now could only be seen one
 * engagement at a time by expanding a card. "What is overdue?" is asked of the
 * API — the browser never sees the milestones that do not match.
 */
export function MilestonesFeature() {
  const qc = useQueryClient();
  const { hasPermission } = useAuth();
  const canManage = hasPermission('consulting.manage');
  const [filter, setFilter] = useState<Filter>('open');
  const [page, setPage] = useState(0);
  const TAKE = 50;

  const params = new URLSearchParams({ take: String(TAKE), skip: String(page * TAKE) });
  if (filter === 'overdue') params.set('overdue', 'true');
  if (filter === 'done') params.set('status', 'DONE');

  const { data, isLoading } = useQuery({
    queryKey: ['consulting-milestones', filter, page],
    queryFn: async () => (await api.get<Paged<MilestoneRow>>(`/consulting/milestones?${params}`)).data,
  });
  const refresh = () => qc.invalidateQueries({ queryKey: ['consulting-milestones'] });

  const move = useMutation({
    mutationFn: ({ id, status }: { id: string; status: MilestoneStatus }) => api.patch(`/consulting/milestones/${id}/status`, { status }),
    onSuccess: () => { refresh(); toast.success('Milestone moved'); },
    onError: (e) => toast.error(apiErrorMessage(e)),
  });
  const remove = useMutation({
    mutationFn: (id: string) => api.delete(`/consulting/milestones/${id}`),
    onSuccess: () => { refresh(); toast.success('Milestone deleted'); },
    onError: (e) => toast.error(apiErrorMessage(e)),
  });

  // `open` has no server-side flag: it is everything not finished, which the
  // status filter cannot express in one value. Filtering the page is honest
  // here because the page is what is shown — the count below says so.
  const rows = (data?.data ?? []).filter((m) => (filter === 'open' ? m.status === 'PENDING' || m.status === 'IN_PROGRESS' : true));
  const total = data?.total ?? 0;

  return (
    <div style={{ animation: 'fadeUp .4s ease' }}>
      <div style={{ marginBottom: 18 }}>
        <h1 style={{ fontSize: 26, fontWeight: 700, letterSpacing: '-.02em', margin: 0 }}>Milestones</h1>
        <p style={{ fontSize: 14, color: 'var(--ink-2)', margin: '6px 0 0' }}>Delivery across every active engagement.</p>
      </div>

      <div style={{ display: 'flex', gap: 6, marginBottom: 14, flexWrap: 'wrap' }}>
        {FILTERS.map((f) => (
          <button key={f} className={filter === f ? 'btn-primary' : 'btn-secondary'} style={{ height: 32, fontSize: 12.5, textTransform: 'capitalize' }}
            onClick={() => { setFilter(f); setPage(0); }}>{f}</button>
        ))}
        <span style={{ marginLeft: 'auto', alignSelf: 'center', fontSize: 12, color: 'var(--ink-3)' }}>
          {isLoading ? 'Loading…' : `${rows.length} shown · ${total} matching`}
        </span>
      </div>

      {!isLoading && rows.length === 0 && (
        <div style={{ ...card, padding: 44, textAlign: 'center', color: 'var(--ink-3)' }}>
          <Flag size={30} style={{ opacity: 0.4 }} />
          <div style={{ marginTop: 10, fontSize: 14 }}>Nothing here. Milestones are added from an engagement.</div>
        </div>
      )}

      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        {rows.map((m) => {
          const due = dueLabel(m.dueAt);
          const meta = MILESTONE_META[m.status];
          const next = NEXT_MILESTONE[m.status];
          return (
            <div key={m.id} style={{ ...card, padding: 14, display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
              <span style={{ width: 8, height: 8, borderRadius: '50%', background: meta.color, flexShrink: 0 }} />
              <div style={{ flex: 1, minWidth: 200 }}>
                <div style={{ fontWeight: 650, fontSize: 14 }}>{m.title}</div>
                <div style={{ fontSize: 12, color: 'var(--ink-3)', marginTop: 2 }}>
                  {m.engagement?.clientName} · {m.engagement?.title}
                  {m.engagement?.assignedTo && <> · {userLabel(m.engagement.assignedTo)}</>}
                </div>
              </div>
              <span className="badge" style={{ background: 'var(--surface-2)', color: meta.color, fontSize: 10.5 }}>{meta.label}</span>
              {m.amountInr > 0 && <span style={{ fontSize: 12.5, color: 'var(--ink-2)' }}>{money(m.amountInr)}</span>}
              <span style={{ fontSize: 12, color: due.overdue ? 'var(--danger,#c0392b)' : 'var(--ink-3)', display: 'flex', alignItems: 'center', gap: 3, minWidth: 90 }}>
                {due.overdue && <AlertTriangle size={11} />}{due.text}
              </span>
              {canManage && next && (
                <button className="btn-secondary" style={{ height: 28, fontSize: 11 }} onClick={() => move.mutate({ id: m.id, status: next })}>
                  {MILESTONE_META[next].label} <ChevronRight size={10} />
                </button>
              )}
              {/* INVOICED refuses server-side; the button is hidden rather than
                  offered and then rejected. */}
              {canManage && m.status !== 'INVOICED' && (
                <button className="btn-secondary" title="Delete milestone" style={{ height: 28, width: 30, padding: 0, color: 'var(--danger,#c0392b)' }}
                  onClick={() => remove.mutate(m.id)}><Trash2 size={12} /></button>
              )}
            </div>
          );
        })}
      </div>

      {total > TAKE && (
        <div style={{ display: 'flex', gap: 8, justifyContent: 'center', marginTop: 16 }}>
          <button className="btn-secondary" disabled={page === 0} onClick={() => setPage((p) => p - 1)}>Previous</button>
          <span style={{ alignSelf: 'center', fontSize: 12.5, color: 'var(--ink-3)' }}>Page {page + 1} of {Math.ceil(total / TAKE)}</span>
          <button className="btn-secondary" disabled={(page + 1) * TAKE >= total} onClick={() => setPage((p) => p + 1)}>Next</button>
        </div>
      )}
    </div>
  );
}
