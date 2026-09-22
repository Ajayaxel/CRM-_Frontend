'use client';

import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { CalendarClock, Plus, X, Check, LogIn, Flame, Star, Ban, UserX, Building2, Phone, MessageSquarePlus } from 'lucide-react';
import { api, apiErrorMessage } from '@/lib/api';
import { SiteVisit, SiteVisitStatus, SiteVisitSummary, InterestLevel, VISIT_STATUS_META, INTEREST_META, Property } from '../realestate-client';

const card: React.CSSProperties = { background: 'var(--surface)', border: '1px solid var(--line-soft)', borderRadius: 16 };
const label: React.CSSProperties = { fontSize: 12, fontWeight: 600, color: 'var(--ink-3)', marginBottom: 4, display: 'block' };
const input: React.CSSProperties = { width: '100%', padding: '9px 11px', borderRadius: 10, border: '1px solid var(--line)', background: 'var(--surface)', color: 'var(--ink)', fontSize: 14 };
const BRAND = 'var(--brand,#132376)';
const STATUSES: SiteVisitStatus[] = ['SCHEDULED', 'CONFIRMED', 'CHECKED_IN', 'COMPLETED', 'CANCELLED', 'NO_SHOW'];
const fmt = (s?: string | null) => (s ? new Date(s).toLocaleString('en-IN', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' }) : '—');

function Badge({ meta }: { meta: { label: string; bg: string; fg: string } }) {
  return <span style={{ fontSize: 12, fontWeight: 600, padding: '2px 9px', borderRadius: 999, background: meta.bg, color: meta.fg }}>{meta.label}</span>;
}

export function SiteVisitsFeature() {
  const qc = useQueryClient();
  const [compose, setCompose] = useState(false);
  const [openId, setOpenId] = useState<string | null>(null);
  const [status, setStatus] = useState<SiteVisitStatus | ''>('');
  const { data: summary } = useQuery({ queryKey: ['visit-summary'], queryFn: async () => (await api.get<SiteVisitSummary>('/site-visits/summary')).data });
  const { data: visits } = useQuery({ queryKey: ['visits', status], queryFn: async () => (await api.get<SiteVisit[]>('/site-visits', { params: { status: status || undefined } })).data });

  const list = visits ?? [];
  return (
    <div style={{ animation: 'fadeUp .4s ease' }}>
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 18, gap: 12, flexWrap: 'wrap' }}>
        <div>
          <h1 style={{ fontSize: 24, fontWeight: 700, display: 'flex', alignItems: 'center', gap: 10 }}><CalendarClock size={24} /> Site Visits</h1>
          <p style={{ color: 'var(--ink-3)', marginTop: 4, fontSize: 14 }}>Book viewings, check clients in on arrival, and capture feedback that feeds the deal.</p>
        </div>
        <button onClick={() => setCompose(true)} style={{ display: 'inline-flex', alignItems: 'center', gap: 6, background: BRAND, color: '#fff', border: 'none', borderRadius: 10, padding: '10px 16px', fontWeight: 600, cursor: 'pointer' }}>
          <Plus size={16} /> Schedule visit
        </button>
      </div>

      {summary && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(120px,1fr))', gap: 12, marginBottom: 18 }}>
          <Stat label="Upcoming" value={summary.upcoming} accent={BRAND} />
          <Stat label="Checked in" value={summary.checkedIn} accent="var(--warning,#c67c1e)" />
          <Stat label="Completed" value={summary.completed} accent="var(--success)" />
          <Stat label="Hot leads" value={summary.hotLeads} accent="var(--danger,#c0392b)" />
          <Stat label="Avg rating" value={summary.avgRating != null ? `${summary.avgRating}★` : '—'} />
        </div>
      )}

      <div style={{ display: 'flex', gap: 8, marginBottom: 14, flexWrap: 'wrap' }}>
        <FilterChip active={status === ''} onClick={() => setStatus('')}>All</FilterChip>
        {STATUSES.map((s) => <FilterChip key={s} active={status === s} onClick={() => setStatus(s)}>{VISIT_STATUS_META[s].label}</FilterChip>)}
      </div>

      {list.length === 0 ? (
        <div style={{ ...card, padding: 48, textAlign: 'center', color: 'var(--ink-3)' }}>No visits{status ? ` at ${VISIT_STATUS_META[status as SiteVisitStatus].label}` : ''} yet.</div>
      ) : (
        <div style={{ ...card, overflow: 'hidden' }}>
          {list.map((v, i) => (
            <button key={v.id} onClick={() => setOpenId(v.id)} style={{ display: 'grid', gridTemplateColumns: '1fr auto', alignItems: 'center', gap: 12, width: '100%', textAlign: 'left', padding: '14px 18px', background: 'transparent', border: 'none', borderTop: i ? '1px solid var(--line-soft)' : 'none', cursor: 'pointer' }}>
              <div style={{ minWidth: 0 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                  <span style={{ fontWeight: 600 }}>{v.clientName}</span>
                  <span style={{ fontSize: 12, color: 'var(--ink-3)', fontFamily: 'monospace' }}>{v.reference}</span>
                  <Badge meta={VISIT_STATUS_META[v.status]} />
                  {v.interestLevel && <Badge meta={INTEREST_META[v.interestLevel]} />}
                </div>
                <div style={{ fontSize: 13, color: 'var(--ink-3)', marginTop: 3, display: 'flex', gap: 14, flexWrap: 'wrap' }}>
                  {v.property && <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}><Building2 size={12} />{v.property.title}</span>}
                  <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}><CalendarClock size={12} />{fmt(v.scheduledAt)}</span>
                  {v.agentName && <span>Agent: {v.agentName}</span>}
                </div>
              </div>
              {v.rating != null && <span style={{ display: 'inline-flex', alignItems: 'center', gap: 3, fontSize: 13, color: 'var(--warning,#c67c1e)', fontWeight: 600 }}><Star size={13} fill="currentColor" />{v.rating}</span>}
            </button>
          ))}
        </div>
      )}

      {compose && <ComposeVisit onClose={() => setCompose(false)} onDone={() => { setCompose(false); qc.invalidateQueries({ queryKey: ['visits'] }); qc.invalidateQueries({ queryKey: ['visit-summary'] }); }} />}
      {openId && <VisitDetail id={openId} onClose={() => setOpenId(null)} />}
    </div>
  );
}

function Stat({ label, value, accent }: { label: string; value: number | string; accent?: string }) {
  return (
    <div style={{ ...card, padding: '14px 16px' }}>
      <div style={{ fontSize: 12, color: 'var(--ink-3)', fontWeight: 600 }}>{label}</div>
      <div style={{ fontSize: 22, fontWeight: 700, marginTop: 2, color: accent || 'var(--ink)' }}>{value}</div>
    </div>
  );
}
function FilterChip({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return <button onClick={onClick} style={{ padding: '6px 13px', borderRadius: 999, fontSize: 13, fontWeight: 600, cursor: 'pointer', border: '1px solid var(--line)', background: active ? BRAND : 'var(--surface)', color: active ? '#fff' : 'var(--ink-2)' }}>{children}</button>;
}

function ComposeVisit({ onClose, onDone }: { onClose: () => void; onDone: () => void }) {
  const [f, setF] = useState<any>({ clientName: '', clientPhone: '', agentName: '', propertyId: '', scheduledAt: '' });
  const set = (k: string) => (e: any) => setF({ ...f, [k]: e.target.value });
  const { data: props } = useQuery({ queryKey: ['props-all'], queryFn: async () => (await api.get<{ data: Property[] }>('/properties', { params: { limit: 100 } })).data.data });
  const save = useMutation({
    mutationFn: () => api.post('/site-visits', { ...f, propertyId: f.propertyId || undefined, scheduledAt: new Date(f.scheduledAt).toISOString() }),
    onSuccess: () => { toast.success('Visit scheduled'); onDone(); },
    onError: (e) => toast.error(apiErrorMessage(e)),
  });
  const ok = f.clientName.trim() && f.scheduledAt;
  return (
    <Drawer title="Schedule site visit" onClose={onClose}>
      <div style={{ display: 'grid', gap: 12 }}>
        <div><span style={label}>Client name *</span><input style={input} value={f.clientName} onChange={set('clientName')} placeholder="e.g. Aisha Khan" /></div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
          <div><span style={label}>Phone</span><input style={input} value={f.clientPhone} onChange={set('clientPhone')} placeholder="+971…" /></div>
          <div><span style={label}>Agent</span><input style={input} value={f.agentName} onChange={set('agentName')} placeholder="Assigned agent" /></div>
        </div>
        <div><span style={label}>Property</span>
          <select style={input} value={f.propertyId} onChange={set('propertyId')}>
            <option value="">— Select property —</option>
            {(props ?? []).map((p) => <option key={p.id} value={p.id}>{p.reference} · {p.title}</option>)}
          </select>
        </div>
        <div><span style={label}>Date &amp; time *</span><input style={input} type="datetime-local" value={f.scheduledAt} onChange={set('scheduledAt')} /></div>
        <button disabled={!ok || save.isPending} onClick={() => save.mutate()} style={{ background: BRAND, color: '#fff', border: 'none', borderRadius: 10, padding: '11px', fontWeight: 600, cursor: 'pointer', opacity: !ok || save.isPending ? 0.6 : 1 }}>
          {save.isPending ? 'Scheduling…' : 'Schedule visit'}
        </button>
      </div>
    </Drawer>
  );
}

function VisitDetail({ id, onClose }: { id: string; onClose: () => void }) {
  const qc = useQueryClient();
  const { data: v, refetch } = useQuery({ queryKey: ['visit', id], queryFn: async () => (await api.get<SiteVisit>(`/site-visits/${id}`)).data });
  const refresh = () => { refetch(); qc.invalidateQueries({ queryKey: ['visits'] }); qc.invalidateQueries({ queryKey: ['visit-summary'] }); };
  const act = (path: string, ok: string) => useMutation({ mutationFn: (body?: any) => api.post(`/site-visits/${id}/${path}`, body ?? {}), onSuccess: () => { refresh(); toast.success(ok); }, onError: (e) => toast.error(apiErrorMessage(e)) });
  const confirm_ = act('confirm', 'Visit confirmed');
  const checkIn = act('check-in', 'Client checked in');
  const cancel = act('cancel', 'Visit cancelled');
  const noShow = act('no-show', 'Marked as no-show');
  const complete = act('complete', 'Feedback saved');

  const [fb, setFb] = useState({ feedback: '', rating: 4, interestLevel: 'WARM' as InterestLevel, followUpAt: '' });
  const closed = v && ['COMPLETED', 'CANCELLED', 'NO_SHOW'].includes(v.status);

  return (
    <Drawer title={v ? v.clientName : 'Visit'} subtitle={v?.reference} onClose={onClose}>
      {!v ? <div style={{ color: 'var(--ink-3)' }}>Loading…</div> : (
        <div style={{ display: 'grid', gap: 16 }}>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
            <Badge meta={VISIT_STATUS_META[v.status]} />
            {v.interestLevel && <Badge meta={INTEREST_META[v.interestLevel]} />}
            {v.rating != null && <span style={{ display: 'inline-flex', alignItems: 'center', gap: 3, fontSize: 13, color: 'var(--warning,#c67c1e)', fontWeight: 600 }}><Star size={13} fill="currentColor" />{v.rating}/5</span>}
          </div>

          <div style={{ display: 'grid', gap: 4 }}>
            <Row k="Property" v={v.property ? `${v.property.reference} · ${v.property.title}` : null} />
            <Row k="Phone" v={v.clientPhone} /><Row k="Agent" v={v.agentName} />
            <Row k="Scheduled" v={fmt(v.scheduledAt)} />
            {v.checkedInAt && <Row k="Checked in" v={fmt(v.checkedInAt)} />}
            {v.completedAt && <Row k="Completed" v={fmt(v.completedAt)} />}
            {v.followUpAt && <Row k="Follow up" v={fmt(v.followUpAt)} />}
          </div>

          {v.feedback && <div style={{ ...card, padding: '11px 13px', fontSize: 13 }}><div style={{ ...label, marginBottom: 3 }}>Feedback</div>{v.feedback}</div>}

          {/* Lifecycle actions */}
          {!closed && (
            <div style={{ display: 'grid', gap: 10 }}>
              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                {v.status === 'SCHEDULED' && <ActBtn icon={<Check size={14} />} onClick={() => confirm_.mutate(undefined)} disabled={confirm_.isPending}>Confirm</ActBtn>}
                {v.status !== 'CHECKED_IN' && <ActBtn icon={<LogIn size={14} />} onClick={() => checkIn.mutate(undefined)} disabled={checkIn.isPending} tone="warn">Check in</ActBtn>}
                <ActBtn icon={<Ban size={14} />} onClick={() => cancel.mutate(undefined)} disabled={cancel.isPending} tone="ghost">Cancel</ActBtn>
                <ActBtn icon={<UserX size={14} />} onClick={() => noShow.mutate(undefined)} disabled={noShow.isPending} tone="ghost">No-show</ActBtn>
              </div>

              {/* Complete with feedback */}
              <div style={{ ...card, padding: 14, display: 'grid', gap: 10 }}>
                <div style={{ ...label, display: 'flex', alignItems: 'center', gap: 6, marginBottom: 0 }}><MessageSquarePlus size={13} /> Record feedback &amp; close out</div>
                <textarea style={{ ...input, minHeight: 60, resize: 'vertical' }} value={fb.feedback} onChange={(e) => setFb({ ...fb, feedback: e.target.value })} placeholder="What did the client think?" />
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                  <div><span style={label}>Interest</span>
                    <select style={input} value={fb.interestLevel} onChange={(e) => setFb({ ...fb, interestLevel: e.target.value as InterestLevel })}>
                      <option value="HOT">Hot</option><option value="WARM">Warm</option><option value="COLD">Cold</option>
                    </select>
                  </div>
                  <div><span style={label}>Rating</span>
                    <select style={input} value={fb.rating} onChange={(e) => setFb({ ...fb, rating: Number(e.target.value) })}>
                      {[5, 4, 3, 2, 1].map((n) => <option key={n} value={n}>{n} ★</option>)}
                    </select>
                  </div>
                </div>
                <div><span style={label}>Follow-up date</span><input style={input} type="datetime-local" value={fb.followUpAt} onChange={(e) => setFb({ ...fb, followUpAt: e.target.value })} /></div>
                <button disabled={complete.isPending} onClick={() => complete.mutate({ ...fb, followUpAt: fb.followUpAt ? new Date(fb.followUpAt).toISOString() : undefined })} style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 6, background: 'var(--success)', color: '#fff', border: 'none', borderRadius: 10, padding: '10px', fontWeight: 600, cursor: 'pointer' }}>
                  {fb.interestLevel === 'HOT' ? <Flame size={15} /> : <Check size={15} />} Complete visit
                </button>
              </div>
            </div>
          )}
        </div>
      )}
    </Drawer>
  );
}

function ActBtn({ icon, children, onClick, disabled, tone }: { icon: React.ReactNode; children: React.ReactNode; onClick: () => void; disabled?: boolean; tone?: 'warn' | 'ghost' }) {
  const styles = tone === 'ghost'
    ? { background: 'transparent', color: 'var(--ink-2)', border: '1px solid var(--line)' }
    : tone === 'warn'
      ? { background: 'var(--warning-bg,#fdf2e2)', color: 'var(--warning,#c67c1e)', border: 'none' }
      : { background: 'var(--brand-bg,#e9ecfb)', color: BRAND, border: 'none' };
  return <button onClick={onClick} disabled={disabled} style={{ display: 'inline-flex', alignItems: 'center', gap: 5, borderRadius: 9, padding: '7px 13px', fontWeight: 600, fontSize: 13, cursor: 'pointer', ...styles }}>{icon}{children}</button>;
}
function Row({ k, v }: { k: string; v?: string | null }) {
  return <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13 }}><span style={{ color: 'var(--ink-3)' }}>{k}</span><span style={{ color: 'var(--ink)', fontWeight: 500, textAlign: 'right' }}>{v || '—'}</span></div>;
}
function Drawer({ title, subtitle, onClose, children }: { title: string; subtitle?: string | null; onClose: () => void; children: React.ReactNode }) {
  return (
    <div onClick={onClose} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,.35)', zIndex: 50, display: 'flex', justifyContent: 'flex-end' }}>
      <div onClick={(e) => e.stopPropagation()} style={{ width: 'min(520px,100%)', height: '100%', background: 'var(--bg,var(--surface))', borderLeft: '1px solid var(--line)', padding: 22, overflowY: 'auto', animation: 'slideIn .25s ease' }}>
        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 18 }}>
          <div><h2 style={{ fontSize: 19, fontWeight: 700 }}>{title}</h2>{subtitle && <div style={{ fontSize: 13, color: 'var(--ink-3)', fontFamily: 'monospace' }}>{subtitle}</div>}</div>
          <button onClick={onClose} style={{ background: 'transparent', border: 'none', cursor: 'pointer', color: 'var(--ink-3)' }}><X size={20} /></button>
        </div>
        {children}
      </div>
    </div>
  );
}
