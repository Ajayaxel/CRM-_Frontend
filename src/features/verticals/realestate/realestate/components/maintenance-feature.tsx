'use client';

import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { Wrench, CalendarClock, HardHat, ScrollText, Plus, X, Trash2, CheckCircle2, AlertTriangle, Star, Zap, Link2, Check } from 'lucide-react';
import { api, apiErrorMessage } from '@/lib/api';
import { cur } from '@/lib/org-locale';
import {
  MaintenanceJob, MaintenanceStats, Vendor, AmcContract, MaintenanceType, MaintenanceStatus,
  JOB_STATUS_META, CATEGORY_ICON, ComplaintCategory, Property, money,
} from '../realestate-client';

const card: React.CSSProperties = { background: 'var(--surface)', border: '1px solid var(--line-soft)', borderRadius: 16 };
const CATS: ComplaintCategory[] = ['PLUMBING', 'ELECTRICAL', 'HVAC', 'APPLIANCE', 'STRUCTURAL', 'PEST', 'CLEANING', 'SECURITY', 'INTERNET', 'OTHER'];
const fmtDate = (s: string) => new Date(s).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });

export function MaintenanceFeature() {
  const [tab, setTab] = useState<'jobs' | 'vendors' | 'amc'>('jobs');
  const { data: stats } = useQuery({ queryKey: ['maint-stats'], queryFn: async () => (await api.get<MaintenanceStats>('/maintenance/stats')).data });

  return (
    <div style={{ animation: 'fadeUp .4s ease' }}>
      <div style={{ marginBottom: 18 }}>
        <h1 style={{ fontSize: 26, fontWeight: 700, letterSpacing: '-.02em', margin: 0 }}>Maintenance</h1>
        <p style={{ fontSize: 14, color: 'var(--ink-2)', margin: '6px 0 0' }}>Preventive &amp; corrective jobs, AMC contracts, vendors and cost.</p>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 12, marginBottom: 18 }}>
        <Stat icon={<CalendarClock size={18} />} label="Scheduled" value={stats?.scheduled ?? 0} />
        <Stat icon={<AlertTriangle size={18} />} label="Overdue" value={stats?.overdue ?? 0} accent="var(--danger,#c0392b)" />
        <Stat icon={<CheckCircle2 size={18} />} label="Done this month" value={stats?.doneThisMonth ?? 0} accent="var(--success)" />
        <Stat icon={<Wrench size={18} />} label="Cost this month" value={money(stats?.costThisMonth ?? 0)} accent="var(--brand,#132376)" />
      </div>

      <div style={{ display: 'flex', gap: 6, marginBottom: 18 }}>
        <Tab active={tab === 'jobs'} onClick={() => setTab('jobs')} icon={<CalendarClock size={15} />}>Schedule</Tab>
        <Tab active={tab === 'vendors'} onClick={() => setTab('vendors')} icon={<HardHat size={15} />}>Vendors</Tab>
        <Tab active={tab === 'amc'} onClick={() => setTab('amc')} icon={<ScrollText size={15} />}>AMC Contracts</Tab>
      </div>

      {tab === 'jobs' && <Jobs />}
      {tab === 'vendors' && <Vendors />}
      {tab === 'amc' && <Amc />}
    </div>
  );
}

function Stat({ icon, label, value, accent }: { icon: React.ReactNode; label: string; value: number | string; accent?: string }) {
  return (
    <div style={{ ...card, padding: 16, display: 'flex', alignItems: 'center', gap: 12 }}>
      <div style={{ width: 40, height: 40, borderRadius: 10, background: 'var(--surface-2)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: accent ?? 'var(--ink-2)' }}>{icon}</div>
      <div><div style={{ fontSize: 20, fontWeight: 800, color: accent ?? 'var(--ink-1)' }}>{value}</div><div style={{ fontSize: 12, color: 'var(--ink-3)' }}>{label}</div></div>
    </div>
  );
}
function Tab({ active, onClick, icon, children }: { active: boolean; onClick: () => void; icon: React.ReactNode; children: React.ReactNode }) {
  return (
    <button onClick={onClick} style={{ display: 'flex', alignItems: 'center', gap: 7, padding: '9px 16px', borderRadius: 10, fontSize: 13.5, fontWeight: 600, cursor: 'pointer', border: '1px solid ' + (active ? 'transparent' : 'var(--line-soft)'), background: active ? 'var(--brand,#132376)' : 'var(--surface)', color: active ? '#fff' : 'var(--ink-2)' }}>{icon}{children}</button>
  );
}

// ---- Jobs ----
function Jobs() {
  const qc = useQueryClient();
  const [compose, setCompose] = useState(false);
  const { data } = useQuery({ queryKey: ['maint-jobs'], queryFn: async () => (await api.get<{ data: MaintenanceJob[] }>('/maintenance/jobs', { params: { limit: 100 } })).data.data });
  const invalidate = () => { qc.invalidateQueries({ queryKey: ['maint-jobs'] }); qc.invalidateQueries({ queryKey: ['maint-stats'] }); };
  const complete = useMutation({ mutationFn: (id: string) => api.post(`/maintenance/jobs/${id}/complete`, {}), onSuccess: () => { invalidate(); toast.success('Job completed'); } });
  const del = useMutation({ mutationFn: (id: string) => api.delete(`/maintenance/jobs/${id}`), onSuccess: () => { invalidate(); toast.success('Job removed'); } });

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 14 }}>
        <button className="btn-primary" onClick={() => setCompose(true)}><Plus size={15} /> New job</button>
      </div>
      {(data ?? []).length === 0 && <Empty icon={<CalendarClock size={28} />} text="No maintenance jobs. Schedule one or generate from an AMC." />}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        {(data ?? []).map((j) => {
          const st = JOB_STATUS_META[j.status];
          return (
            <div key={j.id} style={{ ...card, padding: 16, display: 'flex', alignItems: 'center', gap: 14 }}>
              <div style={{ width: 42, height: 42, borderRadius: 11, background: 'var(--surface-2)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 20 }}>{CATEGORY_ICON[j.category]}</div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                  <span style={{ fontWeight: 700, fontSize: 14.5 }}>{j.title}</span>
                  <span className="badge" style={{ background: j.type === 'PREVENTIVE' ? 'var(--success-bg)' : 'var(--surface-2)', color: j.type === 'PREVENTIVE' ? 'var(--success)' : 'var(--ink-3)' }}>{j.type === 'PREVENTIVE' ? 'Preventive' : 'Corrective'}</span>
                  <span className="badge" style={{ background: st.bg, color: st.fg }}>{st.label}</span>
                  {j.overdue && <span className="badge" style={{ background: 'var(--danger-bg,#fce8e8)', color: 'var(--danger,#c0392b)' }}>Overdue</span>}
                </div>
                <div style={{ fontSize: 12, color: 'var(--ink-3)', marginTop: 4 }}>{fmtDate(j.scheduledFor)}{j.vendor ? ` · ${j.vendor.name}` : ''}{j.property ? ` · ${j.property.reference}` : ''}{j.costInr != null ? ` · ${money(j.costInr)}` : ''}</div>
              </div>
              <div style={{ display: 'flex', gap: 8, flexShrink: 0 }}>
                {j.status !== 'DONE' && j.status !== 'CANCELLED' && <button className="btn-secondary" style={{ height: 32, fontSize: 12 }} onClick={() => complete.mutate(j.id)}><CheckCircle2 size={13} /> Done</button>}
                <button className="btn-secondary" style={{ height: 32, width: 32, padding: 0 }} onClick={() => del.mutate(j.id)}><Trash2 size={13} /></button>
              </div>
            </div>
          );
        })}
      </div>
      {compose && <JobModal onClose={() => setCompose(false)} onDone={invalidate} />}
    </div>
  );
}

function JobModal({ onClose, onDone }: { onClose: () => void; onDone: () => void }) {
  const { data: props } = useQuery({ queryKey: ['props-all'], queryFn: async () => (await api.get<{ data: Property[] }>('/properties', { params: { limit: 100 } })).data.data });
  const { data: vendors } = useQuery({ queryKey: ['maint-vendors'], queryFn: async () => (await api.get<Vendor[]>('/maintenance/vendors')).data });
  const [f, setF] = useState<any>({ title: '', type: 'CORRECTIVE' as MaintenanceType, category: 'PLUMBING', scheduledFor: '', propertyId: '', vendorId: '', costInr: '' });
  const set = (k: string, v: any) => setF((s: any) => ({ ...s, [k]: v }));
  const create = useMutation({
    mutationFn: () => api.post('/maintenance/jobs', { title: f.title, type: f.type, category: f.category, scheduledFor: f.scheduledFor, propertyId: f.propertyId || undefined, vendorId: f.vendorId || undefined, costInr: f.costInr ? Number(f.costInr) : undefined }),
    onSuccess: () => { onDone(); toast.success('Job scheduled'); onClose(); },
    onError: (e) => toast.error(apiErrorMessage(e)),
  });
  return (
    <Overlay onClose={onClose} title="Schedule maintenance job">
      <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        <div><label className="label">Title</label><input className="input" value={f.title} onChange={(e) => set('title', e.target.value)} placeholder="Quarterly AC service" /></div>
        <div style={{ display: 'flex', gap: 10 }}>
          <div style={{ flex: 1 }}><label className="label">Type</label><select className="input" value={f.type} onChange={(e) => set('type', e.target.value)}><option value="CORRECTIVE">Corrective</option><option value="PREVENTIVE">Preventive</option></select></div>
          <div style={{ flex: 1 }}><label className="label">Category</label><select className="input" value={f.category} onChange={(e) => set('category', e.target.value)}>{CATS.map((c) => <option key={c} value={c}>{CATEGORY_ICON[c]} {c[0] + c.slice(1).toLowerCase()}</option>)}</select></div>
        </div>
        <div style={{ display: 'flex', gap: 10 }}>
          <div style={{ flex: 1 }}><label className="label">Scheduled for</label><input className="input" type="date" value={f.scheduledFor} onChange={(e) => set('scheduledFor', e.target.value)} /></div>
          <div style={{ flex: 1 }}><label className="label">Est. cost ({cur()})</label><input className="input" type="number" value={f.costInr} onChange={(e) => set('costInr', e.target.value)} /></div>
        </div>
        <div style={{ display: 'flex', gap: 10 }}>
          <div style={{ flex: 1 }}><label className="label">Property</label><select className="input" value={f.propertyId} onChange={(e) => set('propertyId', e.target.value)}><option value="">—</option>{(props ?? []).map((p) => <option key={p.id} value={p.id}>{p.reference}</option>)}</select></div>
          <div style={{ flex: 1 }}><label className="label">Vendor</label><select className="input" value={f.vendorId} onChange={(e) => set('vendorId', e.target.value)}><option value="">—</option>{(vendors ?? []).map((v) => <option key={v.id} value={v.id}>{v.name}</option>)}</select></div>
        </div>
      </div>
      <Actions onClose={onClose} disabled={!f.title || !f.scheduledFor || create.isPending} onSubmit={() => create.mutate()} label="Schedule" />
    </Overlay>
  );
}

function VendorPortalLink({ vendorId }: { vendorId: string }) {
  const [copied, setCopied] = useState(false);
  // Issued by the API — signed, bound to this vendor, expiring in 90 days. The
  // vendor id alone opens nothing any more.
  const copy = async () => {
    try {
      const r = await api.post<{ path: string }>(`/vendor-portal/${vendorId}/links`);
      const link = `${window.location.origin}${r.data.path}`;
      try { await navigator.clipboard.writeText(link); } catch { window.prompt('Copy this link', link); }
      setCopied(true); toast.success('Vendor portal link copied · valid 90 days'); setTimeout(() => setCopied(false), 1200);
    } catch (e) { toast.error(apiErrorMessage(e)); }
  };
  return (
    <button className="btn-secondary" style={{ height: 32, fontSize: 12, width: '100%', marginTop: 12, justifyContent: 'center' }}
      onClick={copy}>
      {copied ? <><Check size={13} /> Copied</> : <><Link2 size={13} /> Copy portal link</>}
    </button>
  );
}

// ---- Vendors ----
function Vendors() {
  const qc = useQueryClient();
  const [compose, setCompose] = useState(false);
  const { data } = useQuery({ queryKey: ['maint-vendors'], queryFn: async () => (await api.get<Vendor[]>('/maintenance/vendors')).data });
  const invalidate = () => { qc.invalidateQueries({ queryKey: ['maint-vendors'] }); qc.invalidateQueries({ queryKey: ['maint-stats'] }); };
  const del = useMutation({ mutationFn: (id: string) => api.delete(`/maintenance/vendors/${id}`), onSuccess: () => { invalidate(); toast.success('Vendor removed'); } });
  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 14 }}><button className="btn-primary" onClick={() => setCompose(true)}><Plus size={15} /> New vendor</button></div>
      {(data ?? []).length === 0 && <Empty icon={<HardHat size={28} />} text="No vendors yet. Add technicians and service companies." />}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(280px,1fr))', gap: 14 }}>
        {(data ?? []).map((v) => (
          <div key={v.id} style={{ ...card, padding: 16 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
              <div><div style={{ fontWeight: 700, fontSize: 14.5 }}>{v.name}</div><span className="badge" style={{ background: 'var(--surface-2)', color: 'var(--ink-3)', marginTop: 4 }}>{v.trade}</span></div>
              <button className="btn-secondary" style={{ height: 30, width: 30, padding: 0 }} onClick={() => del.mutate(v.id)}><Trash2 size={13} /></button>
            </div>
            <div style={{ fontSize: 12.5, color: 'var(--ink-3)', marginTop: 10 }}>{v.phone ?? '—'}</div>
            <div style={{ display: 'flex', gap: 12, marginTop: 8, fontSize: 12.5 }}>
              <span style={{ color: 'var(--gold,#E6A23C)', fontWeight: 700 }}><Star size={12} style={{ fill: 'var(--gold,#E6A23C)', verticalAlign: -1 }} /> {v.rating}</span>
              <span style={{ color: 'var(--ink-3)' }}>{v._count?.jobs ?? 0} jobs · {v._count?.contracts ?? 0} AMC</span>
            </div>
            <VendorPortalLink vendorId={v.id} />
          </div>
        ))}
      </div>
      {compose && <VendorModal onClose={() => setCompose(false)} onDone={invalidate} />}
    </div>
  );
}
function VendorModal({ onClose, onDone }: { onClose: () => void; onDone: () => void }) {
  const [f, setF] = useState<any>({ name: '', trade: 'HVAC', phone: '', email: '', rating: '4.5' });
  const set = (k: string, v: any) => setF((s: any) => ({ ...s, [k]: v }));
  const create = useMutation({ mutationFn: () => api.post('/maintenance/vendors', { name: f.name, trade: f.trade, phone: f.phone || undefined, email: f.email || undefined, rating: f.rating ? Number(f.rating) : undefined }), onSuccess: () => { onDone(); toast.success('Vendor added'); onClose(); }, onError: (e) => toast.error(apiErrorMessage(e)) });
  return (
    <Overlay onClose={onClose} title="New vendor">
      <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        <div style={{ display: 'flex', gap: 10 }}>
          <div style={{ flex: 1 }}><label className="label">Name</label><input className="input" value={f.name} onChange={(e) => set('name', e.target.value)} placeholder="CoolAir Services" /></div>
          <div style={{ width: 130 }}><label className="label">Trade</label><input className="input" value={f.trade} onChange={(e) => set('trade', e.target.value)} placeholder="HVAC" /></div>
        </div>
        <div style={{ display: 'flex', gap: 10 }}>
          <div style={{ flex: 1 }}><label className="label">Phone</label><input className="input" value={f.phone} onChange={(e) => set('phone', e.target.value)} /></div>
          <div style={{ width: 90 }}><label className="label">Rating</label><input className="input" type="number" step="0.1" max="5" value={f.rating} onChange={(e) => set('rating', e.target.value)} /></div>
        </div>
        <div><label className="label">Email</label><input className="input" value={f.email} onChange={(e) => set('email', e.target.value)} /></div>
      </div>
      <Actions onClose={onClose} disabled={!f.name || !f.trade || create.isPending} onSubmit={() => create.mutate()} label="Add vendor" />
    </Overlay>
  );
}

// ---- AMC ----
function Amc() {
  const qc = useQueryClient();
  const [compose, setCompose] = useState(false);
  const { data } = useQuery({ queryKey: ['maint-amc'], queryFn: async () => (await api.get<AmcContract[]>('/maintenance/amc')).data });
  const invalidate = () => { qc.invalidateQueries({ queryKey: ['maint-amc'] }); qc.invalidateQueries({ queryKey: ['maint-jobs'] }); qc.invalidateQueries({ queryKey: ['maint-stats'] }); };
  const gen = useMutation({ mutationFn: (id: string) => api.post(`/maintenance/amc/${id}/generate`), onSuccess: (r: any) => { invalidate(); toast.success(`Generated ${r.data.created} preventive jobs`); } });
  const del = useMutation({ mutationFn: (id: string) => api.delete(`/maintenance/amc/${id}`), onSuccess: () => { invalidate(); toast.success('Contract removed'); } });
  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 14 }}><button className="btn-primary" onClick={() => setCompose(true)}><Plus size={15} /> New AMC</button></div>
      {(data ?? []).length === 0 && <Empty icon={<ScrollText size={28} />} text="No AMC contracts. Add annual maintenance contracts and auto-generate their schedule." />}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        {(data ?? []).map((c) => (
          <div key={c.id} style={{ ...card, padding: 16, display: 'flex', alignItems: 'center', gap: 14 }}>
            <div style={{ width: 42, height: 42, borderRadius: 11, background: 'var(--surface-2)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 20 }}>{CATEGORY_ICON[c.category]}</div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                <span style={{ fontWeight: 700, fontSize: 14.5 }}>{c.title}</span>
                <span className="badge" style={{ background: 'var(--surface-2)', color: 'var(--ink-3)' }}>{c.frequency}</span>
                {c.expiringSoon && <span className="badge" style={{ background: 'var(--warning-bg,#fdf2e2)', color: 'var(--warning,#c67c1e)' }}>Expiring soon</span>}
              </div>
              <div style={{ fontSize: 12, color: 'var(--ink-3)', marginTop: 4 }}>{fmtDate(c.startDate)} → {fmtDate(c.endDate)}{c.vendor ? ` · ${c.vendor.name}` : ''} · {money(c.costInr)}</div>
            </div>
            <div style={{ display: 'flex', gap: 8, flexShrink: 0 }}>
              <button className="btn-secondary" style={{ height: 32, fontSize: 12 }} onClick={() => gen.mutate(c.id)}><Zap size={13} /> Generate</button>
              <button className="btn-secondary" style={{ height: 32, width: 32, padding: 0 }} onClick={() => del.mutate(c.id)}><Trash2 size={13} /></button>
            </div>
          </div>
        ))}
      </div>
      {compose && <AmcModal onClose={() => setCompose(false)} onDone={invalidate} />}
    </div>
  );
}
function AmcModal({ onClose, onDone }: { onClose: () => void; onDone: () => void }) {
  const { data: props } = useQuery({ queryKey: ['props-all'], queryFn: async () => (await api.get<{ data: Property[] }>('/properties', { params: { limit: 100 } })).data.data });
  const { data: vendors } = useQuery({ queryKey: ['maint-vendors'], queryFn: async () => (await api.get<Vendor[]>('/maintenance/vendors')).data });
  const [f, setF] = useState<any>({ title: '', category: 'HVAC', startDate: '', endDate: '', costInr: '', frequency: 'QUARTERLY', vendorId: '', propertyId: '' });
  const set = (k: string, v: any) => setF((s: any) => ({ ...s, [k]: v }));
  const create = useMutation({ mutationFn: () => api.post('/maintenance/amc', { title: f.title, category: f.category, startDate: f.startDate, endDate: f.endDate, costInr: Number(f.costInr) || 0, frequency: f.frequency, vendorId: f.vendorId || undefined, propertyId: f.propertyId || undefined }), onSuccess: () => { onDone(); toast.success('AMC created'); onClose(); }, onError: (e) => toast.error(apiErrorMessage(e)) });
  return (
    <Overlay onClose={onClose} title="New AMC contract">
      <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        <div><label className="label">Title</label><input className="input" value={f.title} onChange={(e) => set('title', e.target.value)} placeholder="HVAC Annual AMC" /></div>
        <div style={{ display: 'flex', gap: 10 }}>
          <div style={{ flex: 1 }}><label className="label">Category</label><select className="input" value={f.category} onChange={(e) => set('category', e.target.value)}>{CATS.map((c) => <option key={c} value={c}>{c[0] + c.slice(1).toLowerCase()}</option>)}</select></div>
          <div style={{ flex: 1 }}><label className="label">Frequency</label><select className="input" value={f.frequency} onChange={(e) => set('frequency', e.target.value)}><option value="MONTHLY">Monthly</option><option value="QUARTERLY">Quarterly</option><option value="YEARLY">Yearly</option></select></div>
        </div>
        <div style={{ display: 'flex', gap: 10 }}>
          <div style={{ flex: 1 }}><label className="label">Start</label><input className="input" type="date" value={f.startDate} onChange={(e) => set('startDate', e.target.value)} /></div>
          <div style={{ flex: 1 }}><label className="label">End</label><input className="input" type="date" value={f.endDate} onChange={(e) => set('endDate', e.target.value)} /></div>
          <div style={{ width: 120 }}><label className="label">Cost ({cur()})</label><input className="input" type="number" value={f.costInr} onChange={(e) => set('costInr', e.target.value)} /></div>
        </div>
        <div style={{ display: 'flex', gap: 10 }}>
          <div style={{ flex: 1 }}><label className="label">Vendor</label><select className="input" value={f.vendorId} onChange={(e) => set('vendorId', e.target.value)}><option value="">—</option>{(vendors ?? []).map((v) => <option key={v.id} value={v.id}>{v.name}</option>)}</select></div>
          <div style={{ flex: 1 }}><label className="label">Property</label><select className="input" value={f.propertyId} onChange={(e) => set('propertyId', e.target.value)}><option value="">—</option>{(props ?? []).map((p) => <option key={p.id} value={p.id}>{p.reference}</option>)}</select></div>
        </div>
      </div>
      <Actions onClose={onClose} disabled={!f.title || !f.startDate || !f.endDate || create.isPending} onSubmit={() => create.mutate()} label="Create AMC" />
    </Overlay>
  );
}

function Empty({ icon, text }: { icon: React.ReactNode; text: string }) {
  return <div style={{ ...card, padding: 44, textAlign: 'center', color: 'var(--ink-3)' }}><div style={{ opacity: 0.4 }}>{icon}</div><div style={{ marginTop: 10, fontSize: 14 }}>{text}</div></div>;
}
function Actions({ onClose, disabled, onSubmit, label }: { onClose: () => void; disabled: boolean; onSubmit: () => void; label: string }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10, marginTop: 18 }}>
      <button className="btn-secondary" onClick={onClose}>Cancel</button>
      <button className="btn-primary" disabled={disabled} onClick={onSubmit}>{label}</button>
    </div>
  );
}
function Overlay({ children, onClose, title }: { children: React.ReactNode; onClose: () => void; title: string }) {
  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 60, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }}>
      <div style={{ position: 'absolute', inset: 0, background: 'rgba(20,15,12,.42)' }} onClick={onClose} />
      <div style={{ ...card, position: 'relative', zIndex: 1, width: 560, maxWidth: '100%', maxHeight: '92vh', overflow: 'auto', padding: 22, borderRadius: 18 }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
          <div style={{ fontWeight: 700, fontSize: 16 }}>{title}</div>
          <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--ink-3)' }}><X size={20} /></button>
        </div>
        {children}
      </div>
    </div>
  );
}
