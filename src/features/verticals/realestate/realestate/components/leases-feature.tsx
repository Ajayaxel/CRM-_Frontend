'use client';

import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { FileText, Plus, X, RefreshCw, CheckCircle2, AlertTriangle, CalendarClock, Wallet } from 'lucide-react';
import { api, apiErrorMessage } from '@/lib/api';
import { Lease, LeaseStats, RentInvoice, Property, LEASE_STATUS_META, RENT_STATUS_META, money } from '../realestate-client';
import { cur } from '@/lib/org-locale';

const card: React.CSSProperties = { background: 'var(--surface)', border: '1px solid var(--line-soft)', borderRadius: 16 };
const fmtDate = (s: string) => new Date(s).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });

export function LeasesFeature() {
  const qc = useQueryClient();
  const [compose, setCompose] = useState(false);
  const [open, setOpen] = useState<string | null>(null);

  const { data: stats } = useQuery({ queryKey: ['lease-stats'], queryFn: async () => (await api.get<LeaseStats>('/leases/stats')).data });
  const { data } = useQuery({ queryKey: ['leases'], queryFn: async () => (await api.get<{ data: Lease[] }>('/leases', { params: { limit: 50 } })).data.data });

  const invalidate = () => { qc.invalidateQueries({ queryKey: ['leases'] }); qc.invalidateQueries({ queryKey: ['lease-stats'] }); qc.invalidateQueries({ queryKey: ['prop-stats'] }); };
  const renew = useMutation({ mutationFn: (id: string) => api.post(`/leases/${id}/renew`, {}), onSuccess: () => { invalidate(); toast.success('Lease renewed with escalation'); } });
  const terminate = useMutation({ mutationFn: (id: string) => api.delete(`/leases/${id}`), onSuccess: () => { invalidate(); toast.success('Lease terminated'); } });

  return (
    <div style={{ animation: 'fadeUp .4s ease' }}>
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 18 }}>
        <div>
          <h1 style={{ fontSize: 26, fontWeight: 700, letterSpacing: '-.02em', margin: 0 }}>Leases &amp; Rentals</h1>
          <p style={{ fontSize: 14, color: 'var(--ink-2)', margin: '6px 0 0' }}>Active tenancies, rent schedules, renewals and collections.</p>
        </div>
        <button className="btn-primary" onClick={() => setCompose(true)}><Plus size={15} /> New lease</button>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(6,1fr)', gap: 12, marginBottom: 18 }}>
        <Stat label="Active leases" value={stats?.activeLeases ?? 0} />
        <Stat label="Rent roll / mo" value={money(stats?.monthlyRentRoll ?? 0)} accent="var(--brand,#132376)" />
        <Stat label="Deposits held" value={money(stats?.depositsHeld ?? 0)} />
        <Stat label="Outstanding" value={money(stats?.outstanding ?? 0)} accent="var(--gold,#E6A23C)" />
        <Stat label="Overdue" value={money(stats?.overdue ?? 0)} accent="var(--danger,#c0392b)" />
        <Stat label="Expiring ≤60d" value={stats?.expiringSoon ?? 0} accent="var(--warning,#c67c1e)" />
      </div>

      {(data ?? []).length === 0 && (
        <div style={{ ...card, padding: 44, textAlign: 'center', color: 'var(--ink-3)' }}>
          <FileText size={30} style={{ opacity: 0.4 }} />
          <div style={{ marginTop: 10, fontSize: 14 }}>No leases yet. Create one to start a tenancy and rent schedule.</div>
        </div>
      )}

      <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        {(data ?? []).map((l) => {
          const st = LEASE_STATUS_META[l.status] ?? { label: l.status, bg: 'var(--surface-2)', fg: 'var(--ink-2)' };
          const expanded = open === l.id;
          return (
            <div key={l.id} style={{ ...card, padding: 18 }}>
              <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12 }}>
                <div style={{ flex: 1, minWidth: 0, cursor: 'pointer' }} onClick={() => setOpen(expanded ? null : l.id)}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                    <span style={{ fontWeight: 700, fontSize: 15.5 }}>{l.tenantName}</span>
                    <span className="badge" style={{ background: st.bg, color: st.fg }}>{st.label}</span>
                    {l.overdue && <span className="badge" style={{ background: 'var(--danger-bg,#fce8e8)', color: 'var(--danger,#c0392b)' }}><AlertTriangle size={11} style={{ marginRight: 3 }} /> Overdue</span>}
                    {l.property && <span style={{ fontSize: 12, color: 'var(--ink-3)' }}>{l.property.reference} · {l.property.title}</span>}
                  </div>
                  <div style={{ display: 'flex', gap: 18, marginTop: 8, fontSize: 12.5, color: 'var(--ink-2)' }}>
                    <span><Wallet size={12} style={{ verticalAlign: -2, marginRight: 4 }} />{money(l.rentInr)}/mo</span>
                    <span><CalendarClock size={12} style={{ verticalAlign: -2, marginRight: 4 }} />{fmtDate(l.startDate)} → {fmtDate(l.endDate)}</span>
                    {l.nextDue && <span>Next due: {fmtDate(l.nextDue.dueDate)} ({money(l.nextDue.amountInr)})</span>}
                    {typeof l.daysToExpiry === 'number' && l.daysToExpiry > 0 && <span>{l.daysToExpiry}d to expiry</span>}
                  </div>
                </div>
                <div style={{ display: 'flex', gap: 8, flexShrink: 0 }}>
                  {(l.status === 'ACTIVE' || l.status === 'EXPIRING') && <>
                    <button className="btn-secondary" style={{ height: 34, fontSize: 12.5 }} onClick={() => renew.mutate(l.id)}><RefreshCw size={13} /> Renew</button>
                    <button className="btn-secondary" style={{ height: 34, fontSize: 12.5 }} onClick={() => terminate.mutate(l.id)}>End</button>
                  </>}
                </div>
              </div>
              {expanded && <LeaseSchedule id={l.id} onPaid={invalidate} />}
            </div>
          );
        })}
      </div>

      {compose && <LeaseModal onClose={() => setCompose(false)} onDone={invalidate} />}
    </div>
  );
}

function LeaseSchedule({ id, onPaid }: { id: string; onPaid: () => void }) {
  const qc = useQueryClient();
  const { data } = useQuery({ queryKey: ['lease', id], queryFn: async () => (await api.get<Lease>(`/leases/${id}`)).data });
  const pay = useMutation({
    mutationFn: (invoiceId: string) => api.post(`/leases/invoices/${invoiceId}/pay`, {}),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['lease', id] }); onPaid(); toast.success('Rent recorded as paid'); },
  });
  const invoices = data?.invoices ?? [];
  return (
    <div style={{ marginTop: 14, paddingTop: 14, borderTop: '1px solid var(--line-soft)' }}>
      <div style={{ fontWeight: 700, fontSize: 13, marginBottom: 10 }}>Rent schedule</div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(200px,1fr))', gap: 8 }}>
        {invoices.map((inv: RentInvoice) => {
          const st = RENT_STATUS_META[inv.status] ?? { label: inv.status, bg: 'var(--surface-2)', fg: 'var(--ink-2)' };
          return (
            <div key={inv.id} style={{ border: '1px solid var(--line-soft)', borderRadius: 10, padding: 10, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <div>
                <div style={{ fontSize: 12.5, fontWeight: 600 }}>{inv.period}</div>
                <div style={{ fontSize: 11.5, color: 'var(--ink-3)' }}>{money(inv.amountInr)}</div>
              </div>
              {inv.status === 'PAID'
                ? <span className="badge" style={{ background: st.bg, color: st.fg }}><CheckCircle2 size={11} style={{ marginRight: 3 }} />Paid</span>
                : <button className="btn-secondary" style={{ height: 28, fontSize: 11.5, color: st.fg }} disabled={pay.isPending} onClick={() => pay.mutate(inv.id)}>{st.label} · Pay</button>}
            </div>
          );
        })}
      </div>
    </div>
  );
}

function LeaseModal({ onClose, onDone }: { onClose: () => void; onDone: () => void }) {
  const { data: props } = useQuery({ queryKey: ['props-available'], queryFn: async () => (await api.get<{ data: Property[] }>('/properties', { params: { status: 'AVAILABLE', limit: 100 } })).data.data });
  const [f, setF] = useState<any>({ propertyId: '', tenantName: '', tenantPhone: '', startDate: '', endDate: '', rentInr: '', depositInr: '', escalationPct: '5', lateFeeInr: '' });
  const set = (k: string, v: any) => setF((s: any) => ({ ...s, [k]: v }));

  const create = useMutation({
    mutationFn: () => api.post('/leases', {
      propertyId: f.propertyId, tenantName: f.tenantName, tenantPhone: f.tenantPhone || undefined,
      startDate: f.startDate, endDate: f.endDate, rentInr: Number(f.rentInr) || 0,
      depositInr: f.depositInr ? Number(f.depositInr) : undefined, escalationPct: f.escalationPct ? Number(f.escalationPct) : undefined,
      lateFeeInr: f.lateFeeInr ? Number(f.lateFeeInr) : undefined,
    }),
    onSuccess: () => { onDone(); toast.success('Lease created & rent schedule generated'); onClose(); },
    onError: (e) => toast.error(apiErrorMessage(e)),
  });

  const valid = f.propertyId && f.tenantName && f.startDate && f.endDate && f.rentInr;

  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 60, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }}>
      <div style={{ position: 'absolute', inset: 0, background: 'rgba(20,15,12,.42)' }} onClick={onClose} />
      <div style={{ ...card, position: 'relative', zIndex: 1, width: 560, maxWidth: '100%', maxHeight: '92vh', overflow: 'auto', padding: 22, borderRadius: 18 }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
          <div style={{ fontWeight: 700, fontSize: 16 }}>New lease</div>
          <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--ink-3)' }}><X size={20} /></button>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          <div>
            <label className="label">Property (available)</label>
            <select className="input" value={f.propertyId} onChange={(e) => set('propertyId', e.target.value)}>
              <option value="">Select property…</option>
              {(props ?? []).map((p) => <option key={p.id} value={p.id}>{p.reference} — {p.title}</option>)}
            </select>
          </div>
          <div style={{ display: 'flex', gap: 10 }}>
            <div style={{ flex: 1 }}><label className="label">Tenant name</label><input className="input" value={f.tenantName} onChange={(e) => set('tenantName', e.target.value)} /></div>
            <div style={{ flex: 1 }}><label className="label">Tenant phone</label><input className="input" value={f.tenantPhone} onChange={(e) => set('tenantPhone', e.target.value)} /></div>
          </div>
          <div style={{ display: 'flex', gap: 10 }}>
            <div style={{ flex: 1 }}><label className="label">Start date</label><input className="input" type="date" value={f.startDate} onChange={(e) => set('startDate', e.target.value)} /></div>
            <div style={{ flex: 1 }}><label className="label">End date</label><input className="input" type="date" value={f.endDate} onChange={(e) => set('endDate', e.target.value)} /></div>
          </div>
          <div style={{ display: 'flex', gap: 10 }}>
            <div style={{ flex: 1 }}><label className="label">Monthly rent ({cur()})</label><input className="input" type="number" value={f.rentInr} onChange={(e) => set('rentInr', e.target.value)} placeholder="65000" /></div>
            <div style={{ flex: 1 }}><label className="label">Deposit ({cur()})</label><input className="input" type="number" value={f.depositInr} onChange={(e) => set('depositInr', e.target.value)} placeholder="130000" /></div>
          </div>
          <div style={{ display: 'flex', gap: 10 }}>
            <div style={{ flex: 1 }}><label className="label">Escalation %</label><input className="input" type="number" value={f.escalationPct} onChange={(e) => set('escalationPct', e.target.value)} /></div>
            <div style={{ flex: 1 }}><label className="label">Late fee ({cur()})</label><input className="input" type="number" value={f.lateFeeInr} onChange={(e) => set('lateFeeInr', e.target.value)} /></div>
          </div>
        </div>
        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10, marginTop: 18 }}>
          <button className="btn-secondary" onClick={onClose}>Cancel</button>
          <button className="btn-primary" disabled={!valid || create.isPending} onClick={() => create.mutate()}>Create lease</button>
        </div>
      </div>
    </div>
  );
}

function Stat({ label, value, accent }: { label: string; value: number | string; accent?: string }) {
  return (
    <div style={{ ...card, padding: 14 }}>
      <div style={{ fontSize: 19, fontWeight: 800, color: accent ?? 'var(--ink-1)', letterSpacing: '-.02em' }}>{value}</div>
      <div style={{ fontSize: 11.5, color: 'var(--ink-3)', marginTop: 2 }}>{label}</div>
    </div>
  );
}
