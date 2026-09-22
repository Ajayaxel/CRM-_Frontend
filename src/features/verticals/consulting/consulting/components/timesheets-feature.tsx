'use client';

import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { Clock, Trash2 } from 'lucide-react';
import { api, apiErrorMessage } from '@/lib/api';
import { useAuth } from '@/features/foundation/auth';
import {
  TimesheetPage, TimesheetRow, ConsultingUser, EngagementRow, Paged,
  money, hours, timesheetWho, userLabel,
} from '../consulting-client';

const card: React.CSSProperties = { background: 'var(--surface)', border: '1px solid var(--line-soft)', borderRadius: 16 };
const iso = (d: Date) => d.toISOString().slice(0, 10);

/**
 * Hours across every engagement, with the totals coming from the API.
 *
 * The engagement detail panel shows the latest twenty rows and adds them up in
 * the browser, so its totals are wrong the moment an engagement passes twenty
 * entries. Here `totalHours` and `billableValue` are aggregated in the database
 * over the whole filter, not over the page being displayed.
 */
export function TimesheetsFeature() {
  const qc = useQueryClient();
  const { hasPermission, user } = useAuth();
  const canManage = hasPermission('consulting.manage');
  const [f, setF] = useState({
    from: iso(new Date(Date.now() - 29 * 86400000)),
    to: iso(new Date()),
    userId: '',
    engagementId: '',
    billable: '' as '' | 'true' | 'false',
  });
  const [page, setPage] = useState(0);
  const TAKE = 50;
  const set = (k: keyof typeof f, v: string) => { setF((s) => ({ ...s, [k]: v })); setPage(0); };

  const params = new URLSearchParams({ take: String(TAKE), skip: String(page * TAKE), from: f.from, to: `${f.to}T23:59:59.999Z` });
  if (f.userId) params.set('userId', f.userId);
  if (f.engagementId) params.set('engagementId', f.engagementId);
  if (f.billable) params.set('billable', f.billable);

  const { data, isLoading } = useQuery({
    queryKey: ['consulting-timesheets', f, page],
    queryFn: async () => (await api.get<TimesheetPage>(`/consulting/timesheets?${params}`)).data,
  });
  // Only fetched for the pickers, and only for someone who may filter by them.
  const { data: users } = useQuery({
    queryKey: ['consulting-org-users'], enabled: canManage,
    queryFn: async () => (await api.get<{ data: ConsultingUser[] }>('/users?limit=100')).data.data,
  });
  const { data: engs } = useQuery({
    queryKey: ['consulting-engagement-options'],
    queryFn: async () => (await api.get<Paged<EngagementRow>>('/consulting/engagements?take=200')).data.data,
  });

  const remove = useMutation({
    mutationFn: (id: string) => api.delete(`/consulting/timesheets/${id}`),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['consulting-timesheets'] }); toast.success('Entry deleted'); },
    onError: (e) => toast.error(apiErrorMessage(e)),
  });

  const rows = data?.data ?? [];
  const myId = user?.id;

  return (
    <div style={{ animation: 'fadeUp .4s ease' }}>
      <div style={{ marginBottom: 18 }}>
        <h1 style={{ fontSize: 26, fontWeight: 700, letterSpacing: '-.02em', margin: 0 }}>Timesheets</h1>
        <p style={{ fontSize: 14, color: 'var(--ink-2)', margin: '6px 0 0' }}>Hours logged across every engagement.</p>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(150px,1fr))', gap: 10, marginBottom: 14 }}>
        <div><label className="label">From</label><input className="input" type="date" value={f.from} onChange={(e) => set('from', e.target.value)} /></div>
        <div><label className="label">To</label><input className="input" type="date" value={f.to} onChange={(e) => set('to', e.target.value)} /></div>
        <div><label className="label">Engagement</label>
          <select className="input" value={f.engagementId} onChange={(e) => set('engagementId', e.target.value)}>
            <option value="">All</option>
            {(engs ?? []).map((e) => <option key={e.id} value={e.id}>{e.clientName} — {e.title}</option>)}
          </select>
        </div>
        {canManage && (
          <div><label className="label">Consultant</label>
            <select className="input" value={f.userId} onChange={(e) => set('userId', e.target.value)}>
              <option value="">Everyone</option>
              {(users ?? []).map((u) => <option key={u.id} value={u.id}>{userLabel(u)}</option>)}
            </select>
          </div>
        )}
        <div><label className="label">Billable</label>
          <select className="input" value={f.billable} onChange={(e) => set('billable', e.target.value)}>
            <option value="">Both</option><option value="true">Billable</option><option value="false">Non-billable</option>
          </select>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(150px,1fr))', gap: 10, marginBottom: 16 }}>
        <Stat label="Hours logged" value={hours(data?.totalHours)} />
        <Stat label="Billable hours" value={hours(data?.billableHours)} />
        <Stat label="Billable value" value={money(data?.billableValue)} accent="var(--success)" />
        <Stat label="Utilisation" value={data?.totalHours ? `${Math.round(((data.billableHours ?? 0) / data.totalHours) * 100)}%` : '—'} />
      </div>

      {!isLoading && rows.length === 0 && (
        <div style={{ ...card, padding: 44, textAlign: 'center', color: 'var(--ink-3)' }}>
          <Clock size={30} style={{ opacity: 0.4 }} />
          <div style={{ marginTop: 10, fontSize: 14 }}>No hours in this range.</div>
        </div>
      )}

      <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
        {rows.map((t: TimesheetRow) => (
          <div key={t.id} style={{ ...card, padding: '10px 14px', display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
            <span style={{ fontSize: 12, color: 'var(--ink-3)', minWidth: 78 }}>{t.date ? new Date(t.date).toLocaleDateString('en-IN', { day: '2-digit', month: 'short' }) : '—'}</span>
            <span style={{ fontWeight: 700, fontSize: 13.5, minWidth: 46 }}>{hours(t.hours)}</span>
            <span style={{ fontSize: 12.5, color: 'var(--ink-2)', minWidth: 110 }}>{timesheetWho(t)}</span>
            <div style={{ flex: 1, minWidth: 160, fontSize: 12.5, color: 'var(--ink-3)' }}>
              {t.engagement?.clientName} · {t.engagement?.title}
              {t.note && <span style={{ color: 'var(--ink-2)' }}> — {t.note}</span>}
            </div>
            {t.billable
              ? <span className="badge" style={{ background: 'var(--success-bg)', color: 'var(--success)', fontSize: 9.5 }}>billable</span>
              : <span className="badge" style={{ background: 'var(--surface-2)', color: 'var(--ink-3)', fontSize: 9.5 }}>non-bill</span>}
            <span style={{ fontSize: 12.5, minWidth: 76, textAlign: 'right', color: 'var(--ink-2)' }}>
              {t.billable && t.rateInr > 0 ? money(t.hours * t.rateInr) : ''}
            </span>
            {/* Your own row needs only consulting.time; anyone else's is
                refused by the API unless you hold consulting.manage. */}
            {(canManage || t.userId === myId) && (
              <button className="btn-secondary" title="Delete entry" style={{ height: 26, width: 28, padding: 0, color: 'var(--danger,#c0392b)' }}
                onClick={() => remove.mutate(t.id)}><Trash2 size={11} /></button>
            )}
          </div>
        ))}
      </div>

      {(data?.total ?? 0) > TAKE && (
        <div style={{ display: 'flex', gap: 8, justifyContent: 'center', marginTop: 16 }}>
          <button className="btn-secondary" disabled={page === 0} onClick={() => setPage((p) => p - 1)}>Previous</button>
          <span style={{ alignSelf: 'center', fontSize: 12.5, color: 'var(--ink-3)' }}>Page {page + 1} of {Math.ceil((data?.total ?? 0) / TAKE)}</span>
          <button className="btn-secondary" disabled={(page + 1) * TAKE >= (data?.total ?? 0)} onClick={() => setPage((p) => p + 1)}>Next</button>
        </div>
      )}
    </div>
  );
}

function Stat({ label, value, accent }: { label: string; value: string; accent?: string }) {
  return (
    <div style={{ ...card, padding: 14 }}>
      <div style={{ fontSize: 19, fontWeight: 800, color: accent ?? 'var(--ink-1)' }}>{value}</div>
      <div style={{ fontSize: 11.5, color: 'var(--ink-3)', marginTop: 2 }}>{label}</div>
    </div>
  );
}
