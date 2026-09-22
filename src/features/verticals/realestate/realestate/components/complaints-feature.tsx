'use client';

import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { Wrench, Plus, X, AlertTriangle, Clock, CheckCircle2, Star, UserCog, MessageSquarePlus, Link2, Check, HardHat } from 'lucide-react';
import { api, apiErrorMessage } from '@/lib/api';
import {
  Complaint, ComplaintStats, ComplaintStatus, ComplaintCategory, ComplaintPriority, Vendor,
  COMPLAINT_STATUS_META, PRIORITY_META, CATEGORY_ICON, money,
} from '../realestate-client';

const card: React.CSSProperties = { background: 'var(--surface)', border: '1px solid var(--line-soft)', borderRadius: 16 };
const CATEGORIES: ComplaintCategory[] = ['PLUMBING', 'ELECTRICAL', 'HVAC', 'APPLIANCE', 'STRUCTURAL', 'PEST', 'CLEANING', 'SECURITY', 'INTERNET', 'OTHER'];
const STATUSES: ComplaintStatus[] = ['OPEN', 'ASSIGNED', 'IN_PROGRESS', 'ON_HOLD', 'RESOLVED', 'CLOSED', 'CANCELLED'];
const NEXT: Partial<Record<ComplaintStatus, ComplaintStatus>> = { OPEN: 'ASSIGNED', ASSIGNED: 'IN_PROGRESS', IN_PROGRESS: 'RESOLVED', ON_HOLD: 'IN_PROGRESS' };
const fmtDate = (s: string) => new Date(s).toLocaleString('en-IN', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' });

export function ComplaintsFeature() {
  const qc = useQueryClient();
  const [compose, setCompose] = useState(false);
  const [openId, setOpenId] = useState<string | null>(null);
  const [status, setStatus] = useState<ComplaintStatus | ''>('');

  const { data: stats } = useQuery({ queryKey: ['complaint-stats'], queryFn: async () => (await api.get<ComplaintStats>('/complaints/stats')).data });
  const { data } = useQuery({ queryKey: ['complaints', status], queryFn: async () => (await api.get<{ data: Complaint[] }>('/complaints', { params: { status: status || undefined, limit: 60 } })).data.data });

  return (
    <div style={{ animation: 'fadeUp .4s ease' }}>
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 18 }}>
        <div>
          <h1 style={{ fontSize: 26, fontWeight: 700, letterSpacing: '-.02em', margin: 0 }}>Complaint Desk</h1>
          <p style={{ fontSize: 14, color: 'var(--ink-2)', margin: '6px 0 0' }}>Tenant maintenance tickets with SLA, assignment and a full timeline.</p>
        </div>
        <button className="btn-primary" onClick={() => setCompose(true)}><Plus size={15} /> New ticket</button>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 12, marginBottom: 18 }}>
        <Stat icon={<Wrench size={18} />} label="Open tickets" value={stats?.open ?? 0} />
        <Stat icon={<AlertTriangle size={18} />} label="Overdue (SLA)" value={stats?.overdue ?? 0} accent="var(--danger,#c0392b)" />
        <Stat icon={<CheckCircle2 size={18} />} label="Resolved this month" value={stats?.resolvedThisMonth ?? 0} accent="var(--success)" />
        <Stat icon={<Clock size={18} />} label="Avg resolution" value={`${stats?.avgResolutionHours ?? 0}h`} />
      </div>

      <div style={{ display: 'flex', gap: 8, marginBottom: 14 }}>
        <button className="btn-secondary" style={{ height: 34, fontSize: 12.5, borderColor: status === '' ? 'var(--brand,#132376)' : undefined }} onClick={() => setStatus('')}>All</button>
        {(['OPEN', 'ASSIGNED', 'IN_PROGRESS', 'RESOLVED'] as ComplaintStatus[]).map((s) => (
          <button key={s} className="btn-secondary" style={{ height: 34, fontSize: 12.5, borderColor: status === s ? 'var(--brand,#132376)' : undefined }} onClick={() => setStatus(s)}>{COMPLAINT_STATUS_META[s].label}</button>
        ))}
      </div>

      {(data ?? []).length === 0 && (
        <div style={{ ...card, padding: 44, textAlign: 'center', color: 'var(--ink-3)' }}>
          <Wrench size={30} style={{ opacity: 0.4 }} />
          <div style={{ marginTop: 10, fontSize: 14 }}>No tickets. Tenants can raise them from their portal, or add one here.</div>
        </div>
      )}

      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        {(data ?? []).map((c) => {
          const st = COMPLAINT_STATUS_META[c.status]; const pr = PRIORITY_META[c.priority];
          return (
            <div key={c.id} onClick={() => setOpenId(c.id)} style={{ ...card, padding: 16, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 14 }}>
              <div style={{ width: 42, height: 42, borderRadius: 11, background: 'var(--surface-2)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 20, flexShrink: 0 }}>{CATEGORY_ICON[c.category]}</div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                  <span style={{ fontWeight: 700, fontSize: 14.5 }}>{c.title}</span>
                  <span className="badge" style={{ background: st.bg, color: st.fg }}>{st.label}</span>
                  <span className="badge" style={{ background: pr.bg, color: pr.fg }}>{pr.label}</span>
                  {c.overdue && <span className="badge" style={{ background: 'var(--danger-bg,#fce8e8)', color: 'var(--danger,#c0392b)' }}><AlertTriangle size={11} style={{ marginRight: 3 }} />Overdue</span>}
                </div>
                <div style={{ fontSize: 12, color: 'var(--ink-3)', marginTop: 4 }}>
                  {c.ticketNo} · {c.tenantName}{c.property ? ` · ${c.property.reference}` : ''}{c.assignedTo ? ` · 👷 ${c.assignedTo}` : ''}
                </div>
              </div>
              {c.feedbackRating != null && <div style={{ fontSize: 12.5, color: 'var(--gold,#E6A23C)', fontWeight: 700, flexShrink: 0 }}><Star size={12} style={{ fill: 'var(--gold,#E6A23C)', verticalAlign: -1 }} /> {c.feedbackRating}</div>}
            </div>
          );
        })}
      </div>

      {compose && <ComplaintModal onClose={() => setCompose(false)} onDone={() => { qc.invalidateQueries({ queryKey: ['complaints'] }); qc.invalidateQueries({ queryKey: ['complaint-stats'] }); }} />}
      {openId && <ComplaintDrawer id={openId} onClose={() => setOpenId(null)} />}
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

function ComplaintDrawer({ id, onClose }: { id: string; onClose: () => void }) {
  const qc = useQueryClient();
  const [vendorId, setVendorId] = useState('');
  const [assignName, setAssignName] = useState('');
  const [note, setNote] = useState('');
  const { data: c } = useQuery({ queryKey: ['complaint', id], queryFn: async () => (await api.get<Complaint>(`/complaints/${id}`)).data });
  const { data: vendors } = useQuery({ queryKey: ['vendors'], queryFn: async () => (await api.get<Vendor[]>('/maintenance/vendors')).data });
  const refresh = () => { qc.invalidateQueries({ queryKey: ['complaint', id] }); qc.invalidateQueries({ queryKey: ['complaints'] }); qc.invalidateQueries({ queryKey: ['complaint-stats'] }); };

  const assign = useMutation({
    mutationFn: () => api.patch(`/complaints/${id}/assign`, vendorId === '__manual__'
      ? { assignedTo: assignName, assignedType: 'TECHNICIAN' }
      : { vendorId }),
    onSuccess: () => { refresh(); setVendorId(''); setAssignName(''); toast.success('Assigned'); },
    onError: (e) => toast.error(apiErrorMessage(e)),
  });
  const setStatus = useMutation({ mutationFn: (status: ComplaintStatus) => api.patch(`/complaints/${id}/status`, { status }), onSuccess: () => { refresh(); toast.success('Status updated'); } });
  const addNote = useMutation({ mutationFn: () => api.post(`/complaints/${id}/notes`, { message: note }), onSuccess: () => { refresh(); setNote(''); toast.success('Note added'); } });

  if (!c) return null;
  const st = COMPLAINT_STATUS_META[c.status]; const next = NEXT[c.status];

  return (
    <>
      <div onClick={onClose} style={{ position: 'fixed', inset: 0, zIndex: 60, background: 'rgba(20,15,12,.42)' }} />
      <div style={{ position: 'fixed', top: 0, right: 0, bottom: 0, zIndex: 61, width: 480, maxWidth: '100%', background: 'var(--surface)', borderLeft: '1px solid var(--line-soft)', overflowY: 'auto', animation: 'slideIn .3s cubic-bezier(.2,.8,.2,1)' }}>
        <div style={{ padding: 22 }}>
          <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 14 }}>
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <span style={{ fontSize: 22 }}>{CATEGORY_ICON[c.category]}</span>
                <span style={{ fontWeight: 700, fontSize: 17 }}>{c.title}</span>
              </div>
              <div style={{ fontSize: 12.5, color: 'var(--ink-3)', marginTop: 4 }}>{c.ticketNo} · {c.tenantName}{c.tenantPhone ? ` · ${c.tenantPhone}` : ''}</div>
            </div>
            <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--ink-3)' }}><X size={20} /></button>
          </div>

          <div style={{ display: 'flex', gap: 6, marginBottom: 14, flexWrap: 'wrap' }}>
            <span className="badge" style={{ background: st.bg, color: st.fg }}>{st.label}</span>
            <span className="badge" style={{ background: PRIORITY_META[c.priority].bg, color: PRIORITY_META[c.priority].fg }}>{PRIORITY_META[c.priority].label}</span>
            {c.overdue && <span className="badge" style={{ background: 'var(--danger-bg,#fce8e8)', color: 'var(--danger,#c0392b)' }}>Overdue</span>}
            {c.property && <span className="badge" style={{ background: 'var(--surface-2)', color: 'var(--ink-3)' }}>{c.property.reference}</span>}
          </div>

          <div style={{ ...card, padding: 14, marginBottom: 14, fontSize: 13, color: 'var(--ink-2)', background: 'var(--surface-2)' }}>{c.description}</div>

          {/* Assigned vendor + shareable portal link */}
          {c.assignedTo && (
            <div style={{ ...card, padding: '10px 12px', marginBottom: 8, background: 'var(--surface-2)', display: 'flex', alignItems: 'center', gap: 10 }}>
              <HardHat size={16} style={{ color: 'var(--brand,#132376)', flexShrink: 0 }} />
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 13, fontWeight: 600 }}>{c.assignedTo}</div>
                <div style={{ fontSize: 11, color: 'var(--ink-3)' }}>{c.assignedType === 'VENDOR' ? 'Vendor' : 'Technician'}{c.vendorId ? ' · portal-enabled' : ''}</div>
              </div>
              {c.vendorId && <VendorPortalLink vendorId={c.vendorId} />}
            </div>
          )}

          {/* Actions — assign from the vendor directory or a manual name */}
          <div style={{ display: 'flex', gap: 8, marginBottom: 8 }}>
            <select className="input" style={{ flex: 1 }} value={vendorId} onChange={(e) => setVendorId(e.target.value)}>
              <option value="">{c.assignedTo ? 'Reassign…' : 'Assign vendor / technician…'}</option>
              {(vendors ?? []).filter((v) => v.active).map((v) => <option key={v.id} value={v.id}>{v.name} · {v.trade}</option>)}
              <option value="__manual__">✏️ Manual entry…</option>
            </select>
            <button className="btn-secondary" disabled={(vendorId === '__manual__' ? !assignName : !vendorId) || assign.isPending} onClick={() => assign.mutate()}><UserCog size={14} /> Assign</button>
          </div>
          {vendorId === '__manual__' && (
            <input className="input" style={{ width: '100%', marginBottom: 8 }} placeholder="Technician / vendor name…" value={assignName} onChange={(e) => setAssignName(e.target.value)} />
          )}
          {(vendors ?? []).length === 0 && vendorId !== '__manual__' && (
            <div style={{ fontSize: 11.5, color: 'var(--ink-3)', marginBottom: 8 }}>No vendors yet — add them under <b>Maintenance → Vendors</b>, or use manual entry.</div>
          )}
          {next && <button className="btn-primary" style={{ width: '100%', marginBottom: 8 }} onClick={() => setStatus.mutate(next)}>Move to {COMPLAINT_STATUS_META[next].label}</button>}
          <div style={{ display: 'flex', gap: 8, marginBottom: 16 }}>
            <input className="input" style={{ flex: 1 }} placeholder="Add internal note…" value={note} onChange={(e) => setNote(e.target.value)} />
            <button className="btn-secondary" disabled={!note || addNote.isPending} onClick={() => addNote.mutate()}><MessageSquarePlus size={14} /></button>
          </div>

          {/* Timeline */}
          <div style={{ fontWeight: 700, fontSize: 13, marginBottom: 10 }}>Timeline</div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 0 }}>
            {(c.events ?? []).map((e, i) => (
              <div key={e.id} style={{ display: 'flex', gap: 10 }}>
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                  <div style={{ width: 9, height: 9, borderRadius: '50%', background: e.type === 'FEEDBACK' ? 'var(--gold,#E6A23C)' : e.type === 'STATUS' ? 'var(--brand,#132376)' : 'var(--ink-3)', marginTop: 5 }} />
                  {i < (c.events?.length ?? 0) - 1 && <div style={{ width: 2, flex: 1, background: 'var(--line-soft)' }} />}
                </div>
                <div style={{ paddingBottom: 14 }}>
                  <div style={{ fontSize: 13, color: 'var(--ink-1)' }}>{e.message}</div>
                  <div style={{ fontSize: 11, color: 'var(--ink-3)', marginTop: 2 }}>{e.author} · {fmtDate(e.createdAt)}</div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </>
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
    <button className="btn-secondary" style={{ height: 30, fontSize: 12, flexShrink: 0 }}
      onClick={copy}>
      {copied ? <><Check size={12} /> Copied</> : <><Link2 size={12} /> Portal link</>}
    </button>
  );
}

function ComplaintModal({ onClose, onDone }: { onClose: () => void; onDone: () => void }) {
  const [f, setF] = useState<any>({ title: '', description: '', tenantName: '', tenantPhone: '', category: 'PLUMBING', priority: 'MEDIUM', emergency: false });
  const set = (k: string, v: any) => setF((s: any) => ({ ...s, [k]: v }));
  const create = useMutation({
    mutationFn: () => api.post('/complaints', { ...f }),
    onSuccess: () => { onDone(); toast.success('Ticket created'); onClose(); },
    onError: (e) => toast.error(apiErrorMessage(e)),
  });
  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 60, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }}>
      <div style={{ position: 'absolute', inset: 0, background: 'rgba(20,15,12,.42)' }} onClick={onClose} />
      <div style={{ ...card, position: 'relative', zIndex: 1, width: 540, maxWidth: '100%', maxHeight: '92vh', overflow: 'auto', padding: 22, borderRadius: 18 }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
          <div style={{ fontWeight: 700, fontSize: 16 }}>New maintenance ticket</div>
          <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--ink-3)' }}><X size={20} /></button>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          <div><label className="label">Title</label><input className="input" value={f.title} onChange={(e) => set('title', e.target.value)} placeholder="AC not cooling" /></div>
          <div><label className="label">Description</label><textarea className="input" rows={3} style={{ resize: 'vertical' }} value={f.description} onChange={(e) => set('description', e.target.value)} /></div>
          <div style={{ display: 'flex', gap: 10 }}>
            <div style={{ flex: 1 }}><label className="label">Tenant name</label><input className="input" value={f.tenantName} onChange={(e) => set('tenantName', e.target.value)} /></div>
            <div style={{ flex: 1 }}><label className="label">Tenant phone</label><input className="input" value={f.tenantPhone} onChange={(e) => set('tenantPhone', e.target.value)} /></div>
          </div>
          <div style={{ display: 'flex', gap: 10 }}>
            <div style={{ flex: 1 }}><label className="label">Category</label><select className="input" value={f.category} onChange={(e) => set('category', e.target.value)}>{CATEGORIES.map((c) => <option key={c} value={c}>{CATEGORY_ICON[c]} {c[0] + c.slice(1).toLowerCase()}</option>)}</select></div>
            <div style={{ flex: 1 }}><label className="label">Priority</label><select className="input" value={f.priority} onChange={(e) => set('priority', e.target.value)} disabled={f.emergency}>{(['LOW', 'MEDIUM', 'HIGH'] as ComplaintPriority[]).map((p) => <option key={p} value={p}>{p[0] + p.slice(1).toLowerCase()}</option>)}</select></div>
          </div>
          <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, color: 'var(--ink-2)' }}>
            <input type="checkbox" checked={f.emergency} onChange={(e) => set('emergency', e.target.checked)} /> 🚨 Emergency (4h SLA)
          </label>
        </div>
        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10, marginTop: 18 }}>
          <button className="btn-secondary" onClick={onClose}>Cancel</button>
          <button className="btn-primary" disabled={!f.title || !f.description || !f.tenantName || create.isPending} onClick={() => create.mutate()}>Create ticket</button>
        </div>
      </div>
    </div>
  );
}
