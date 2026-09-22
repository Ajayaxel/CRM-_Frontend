'use client';

import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { Briefcase, Plus, X, ChevronRight, Clock, Target, UserRound } from 'lucide-react';
import { api, apiErrorMessage } from '@/lib/api';
import { useAuth } from '@/features/foundation/auth';
import { EngagementDocumentsPanel } from './engagement-documents-panel';
import {
  Engagement, EngagementDetail, EngagementStatus, ConsultingStats, ConsultingUser,
  ENG_COLS, ENG_META, ENGAGEMENT_TYPES, FEE_MODELS, MILESTONE_META, MilestoneStatus, NEXT_MILESTONE,
  money, userLabel, timesheetWho,
} from '../consulting-client';

const card: React.CSSProperties = { background: 'var(--surface)', border: '1px solid var(--line-soft)', borderRadius: 16 };

/**
 * The organisation's users, for the owner and log-for-someone-else pickers.
 *
 * GET /users is deliberately unguarded API-side ("used in Assign Counsellor /
 * Assignee dropdowns app-wide"), but it is only fetched here when the viewer
 * holds consulting.manage — the permission that may actually assign.
 */
function useOrgUsers(enabled: boolean) {
  const { data } = useQuery({
    queryKey: ['consulting-org-users'],
    enabled,
    queryFn: async () => (await api.get<{ data: ConsultingUser[] }>('/users?limit=100')).data.data,
  });
  return data ?? [];
}

function UserSelect({ value, onChange, users, placeholder, style }: { value: string; onChange: (v: string) => void; users: ConsultingUser[]; placeholder: string; style?: React.CSSProperties }) {
  return (
    <select className="input" style={style} value={value} onChange={(e) => onChange(e.target.value)}>
      <option value="">{placeholder}</option>
      {users.map((u) => <option key={u.id} value={u.id}>{userLabel(u)}</option>)}
    </select>
  );
}

export function EngagementsFeature() {
  const qc = useQueryClient();
  const [compose, setCompose] = useState(false);
  const [open, setOpen] = useState<string | null>(null);
  const { data: stats } = useQuery({ queryKey: ['consulting-stats'], queryFn: async () => (await api.get<ConsultingStats>('/consulting/stats')).data });
  const { data: board } = useQuery({ queryKey: ['consulting-board'], queryFn: async () => (await api.get<{ status: EngagementStatus; engagements: Engagement[] }[]>('/consulting/engagements/board')).data });
  const refresh = () => { qc.invalidateQueries({ queryKey: ['consulting-board'] }); qc.invalidateQueries({ queryKey: ['consulting-stats'] }); };
  const setStatus = useMutation({ mutationFn: ({ id, status }: { id: string; status: EngagementStatus }) => api.patch(`/consulting/engagements/${id}/status`, { status }), onSuccess: () => { refresh(); toast.success('Stage updated'); } });

  const columns = board ?? ENG_COLS.map((status) => ({ status, engagements: [] as Engagement[] }));

  return (
    <div style={{ animation: 'fadeUp .4s ease' }}>
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 18 }}>
        <div>
          <h1 style={{ fontSize: 26, fontWeight: 700, letterSpacing: '-.02em', margin: 0 }}>Engagements</h1>
          <p style={{ fontSize: 14, color: 'var(--ink-2)', margin: '6px 0 0' }}>Your advisory pipeline — milestones, timesheets and utilisation.</p>
        </div>
        <button className="btn-primary" onClick={() => setCompose(true)}><Plus size={15} /> New engagement</button>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5,1fr)', gap: 12, marginBottom: 18 }}>
        <Stat label="Active" value={stats?.activeEngagements ?? 0} accent="var(--brand,#132376)" />
        <Stat label="Pipeline" value={money(stats?.pipelineValue ?? 0)} accent="var(--gold,#E6A23C)" />
        <Stat label="Proposals out" value={stats?.proposalsOut ?? 0} />
        <Stat label="Hours (mo)" value={stats?.hoursThisMonth ?? 0} />
        <Stat label="Utilisation" value={`${stats?.utilisationPct ?? 0}%`} accent="var(--success)" />
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5,minmax(0,1fr))', gap: 10, alignItems: 'start' }}>
        {columns.map((col) => (
          <div key={col.status}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 8, padding: '0 2px' }}>
              <span style={{ width: 8, height: 8, borderRadius: '50%', background: ENG_META[col.status].color }} />
              <span style={{ fontSize: 12, fontWeight: 700, color: 'var(--ink-2)' }}>{ENG_META[col.status].label}</span>
              <span style={{ fontSize: 11, color: 'var(--ink-3)', marginLeft: 'auto' }}>{col.engagements.length}</span>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {col.engagements.map((e) => (
                <div key={e.id} style={{ ...card, padding: 12, cursor: 'pointer' }} onClick={() => setOpen(open === e.id ? null : e.id)}>
                  <div style={{ fontWeight: 700, fontSize: 13.5 }}>{e.title}</div>
                  <div style={{ fontSize: 11.5, color: 'var(--ink-3)', marginTop: 2 }}>{e.clientName}</div>
                  <div style={{ display: 'flex', gap: 5, marginTop: 8, flexWrap: 'wrap' }}>
                    <span className="badge" style={{ background: 'var(--surface-2)', color: 'var(--ink-3)', fontSize: 10 }}>{e.type}</span>
                    {e.valueInr > 0 && <span className="badge" style={{ background: 'var(--surface-2)', color: 'var(--ink-3)', fontSize: 10 }}>{money(e.valueInr)}</span>}
                    {(e._count?.milestones ?? 0) > 0 && <span className="badge" style={{ background: 'var(--surface-2)', color: 'var(--ink-3)', fontSize: 10 }}><Target size={9} style={{ marginRight: 2 }} />{e._count?.milestones}</span>}
                  </div>
                  <div style={{ fontSize: 11, color: e.assignedTo ? 'var(--ink-3)' : 'var(--gold,#E6A23C)', marginTop: 4, display: 'flex', alignItems: 'center', gap: 4 }}>
                    <UserRound size={10} />{userLabel(e.assignedTo) ?? 'Unassigned'}
                  </div>
                  <select className="input" style={{ width: '100%', height: 30, marginTop: 8, fontSize: 11.5 }} value={e.status} onClick={(ev) => ev.stopPropagation()} onChange={(ev) => setStatus.mutate({ id: e.id, status: ev.target.value as EngagementStatus })}>
                    {ENG_COLS.map((s) => <option key={s} value={s}>{ENG_META[s].label}</option>)}
                  </select>
                  {open === e.id && <EngagementDetailPanel id={e.id} onChanged={refresh} />}
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>

      {compose && <EngagementModal onClose={() => setCompose(false)} onDone={refresh} />}
    </div>
  );
}

function Stat({ label, value, accent }: { label: string; value: number | string; accent?: string }) {
  return <div style={{ ...card, padding: 16 }}><div style={{ fontSize: 20, fontWeight: 800, color: accent ?? 'var(--ink-1)' }}>{value}</div><div style={{ fontSize: 12, color: 'var(--ink-3)', marginTop: 2 }}>{label}</div></div>;
}

function EngagementDetailPanel({ id, onChanged }: { id: string; onChanged: () => void }) {
  const qc = useQueryClient();
  const { hasPermission } = useAuth();
  const canManage = hasPermission('consulting.manage');
  const [addMs, setAddMs] = useState(false);
  const [addTs, setAddTs] = useState(false);
  const { data } = useQuery({ queryKey: ['consulting-eng', id], queryFn: async () => (await api.get<EngagementDetail>(`/consulting/engagements/${id}`)).data });
  const refresh = () => { qc.invalidateQueries({ queryKey: ['consulting-eng', id] }); onChanged(); };
  const moveMs = useMutation({ mutationFn: ({ msId, status }: { msId: string; status: MilestoneStatus }) => api.patch(`/consulting/milestones/${msId}/status`, { status }), onSuccess: refresh });
  // Empty string means un-assign, and the API takes null for that rather than
  // treating it as "not supplied" and quietly keeping the previous owner.
  const assign = useMutation({
    mutationFn: (assignedToId: string) => api.patch(`/consulting/engagements/${id}/assignee`, { assignedToId: assignedToId || null }),
    onSuccess: () => { refresh(); toast.success('Owner updated'); },
    onError: (e) => toast.error(apiErrorMessage(e)),
  });
  const users = useOrgUsers(canManage);

  return (
    <div style={{ marginTop: 12, paddingTop: 12, borderTop: '1px solid var(--line-soft)' }} onClick={(e) => e.stopPropagation()}>
      <div style={{ display: 'flex', gap: 10, fontSize: 11.5, color: 'var(--ink-3)', marginBottom: 10 }}>
        <span><Clock size={11} style={{ marginRight: 3 }} />{data?.loggedHours ?? 0}h logged</span>
        <span>{money(data?.billableValue ?? 0)} billable</span>
      </div>

      <div style={{ marginBottom: 10 }}>
        <span style={{ fontSize: 11.5, fontWeight: 700, color: 'var(--ink-2)' }}>Owner</span>
        {canManage
          ? <UserSelect style={{ height: 30, fontSize: 11.5, marginTop: 4 }} value={data?.assignedToId ?? ''} users={users} placeholder="Unassigned" onChange={(v) => assign.mutate(v)} />
          : <div style={{ fontSize: 11.5, color: 'var(--ink-3)', marginTop: 4 }}>{userLabel(data?.assignedTo) ?? 'Unassigned'}</div>}
      </div>

      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
        <span style={{ fontSize: 11.5, fontWeight: 700, color: 'var(--ink-2)' }}>Milestones</span>
        <button className="btn-secondary" style={{ height: 24, fontSize: 10.5 }} onClick={() => setAddMs(true)}><Plus size={10} /> Add</button>
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 5, marginBottom: 10 }}>
        {(data?.milestones ?? []).length === 0 && <div style={{ fontSize: 11, color: 'var(--ink-3)' }}>No milestones yet.</div>}
        {(data?.milestones ?? []).map((m) => (
          <div key={m.id} style={{ background: 'var(--surface-2)', borderRadius: 8, padding: '6px 8px', display: 'flex', alignItems: 'center', gap: 6 }}>
            <span style={{ width: 6, height: 6, borderRadius: '50%', background: MILESTONE_META[m.status].color }} />
            <span style={{ fontSize: 11.5, fontWeight: 600, flex: 1 }}>{m.title}</span>
            {m.amountInr > 0 && <span style={{ fontSize: 10.5, color: 'var(--ink-3)' }}>{money(m.amountInr)}</span>}
            {NEXT_MILESTONE[m.status] && <button className="btn-secondary" style={{ height: 22, fontSize: 10, padding: '0 6px' }} onClick={() => moveMs.mutate({ msId: m.id, status: NEXT_MILESTONE[m.status]! })}>{MILESTONE_META[NEXT_MILESTONE[m.status]!].label} <ChevronRight size={9} /></button>}
          </div>
        ))}
      </div>

      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
        <span style={{ fontSize: 11.5, fontWeight: 700, color: 'var(--ink-2)' }}>Timesheets</span>
        <button className="btn-secondary" style={{ height: 24, fontSize: 10.5 }} onClick={() => setAddTs(true)}><Plus size={10} /> Log</button>
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
        {(data?.timesheets ?? []).length === 0 && <div style={{ fontSize: 11, color: 'var(--ink-3)' }}>No hours logged.</div>}
        {(data?.timesheets ?? []).map((t) => (
          <div key={t.id} style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 11.5 }}>
            <span style={{ fontWeight: 600 }}>{t.hours}h</span>
            <span style={{ color: 'var(--ink-3)' }}>{timesheetWho(t)}</span>
            {t.billable ? <span className="badge" style={{ background: 'var(--success-bg)', color: 'var(--success)', fontSize: 9 }}>billable</span> : <span className="badge" style={{ background: 'var(--surface-2)', color: 'var(--ink-3)', fontSize: 9 }}>non-bill</span>}
            <span style={{ marginLeft: 'auto', color: 'var(--ink-3)' }}>{t.billable && t.rateInr > 0 ? money(t.hours * t.rateInr) : ''}</span>
          </div>
        ))}
      </div>

      <EngagementDocumentsPanel engagementId={id} clientName={data?.clientName ?? ''} />

      {addMs && <MilestoneModal engagementId={id} onClose={() => setAddMs(false)} onDone={refresh} />}
      {addTs && <TimesheetModal engagementId={id} canLogForOthers={canManage} users={users} onClose={() => setAddTs(false)} onDone={refresh} />}
    </div>
  );
}

function EngagementModal({ onClose, onDone }: { onClose: () => void; onDone: () => void }) {
  const [f, setF] = useState<any>({ clientName: '', title: '', type: 'STRATEGY', feeModel: 'FIXED', valueInr: '', assignedToId: '' });
  const set = (k: string, v: any) => setF((s: any) => ({ ...s, [k]: v }));
  const users = useOrgUsers(true);
  const create = useMutation({ mutationFn: () => api.post('/consulting/engagements', { clientName: f.clientName, title: f.title, type: f.type, feeModel: f.feeModel, valueInr: f.valueInr ? Number(f.valueInr) : undefined, assignedToId: f.assignedToId || undefined }), onSuccess: () => { onDone(); toast.success('Engagement created'); onClose(); }, onError: (e) => toast.error(apiErrorMessage(e)) });
  return <Overlay title="New engagement" onClose={onClose}>
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      <div><label className="label">Client</label><input className="input" value={f.clientName} onChange={(e) => set('clientName', e.target.value)} placeholder="Nimbus Foods" /></div>
      <div><label className="label">Engagement title</label><input className="input" value={f.title} onChange={(e) => set('title', e.target.value)} placeholder="Ops transformation" /></div>
      <div style={{ display: 'flex', gap: 10 }}>
        <div style={{ flex: 1 }}><label className="label">Type</label><select className="input" value={f.type} onChange={(e) => set('type', e.target.value)}>{ENGAGEMENT_TYPES.map((t) => <option key={t} value={t}>{t}</option>)}</select></div>
        <div style={{ flex: 1 }}><label className="label">Fee model</label><select className="input" value={f.feeModel} onChange={(e) => set('feeModel', e.target.value)}>{FEE_MODELS.map((t) => <option key={t} value={t}>{t}</option>)}</select></div>
      </div>
      <div style={{ display: 'flex', gap: 10 }}>
        <div style={{ width: 160 }}><label className="label">Value ₹</label><input className="input" type="number" value={f.valueInr} onChange={(e) => set('valueInr', e.target.value)} /></div>
        <div style={{ flex: 1 }}><label className="label">Owner</label><UserSelect value={f.assignedToId} users={users} placeholder="Unassigned" onChange={(v) => set('assignedToId', v)} /></div>
      </div>
    </div>
    <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10, marginTop: 18 }}><button className="btn-secondary" onClick={onClose}>Cancel</button><button className="btn-primary" disabled={!f.clientName || !f.title || create.isPending} onClick={() => create.mutate()}>Create</button></div>
  </Overlay>;
}

function MilestoneModal({ engagementId, onClose, onDone }: { engagementId: string; onClose: () => void; onDone: () => void }) {
  const [f, setF] = useState<any>({ title: '', amountInr: '', dueAt: '' });
  const set = (k: string, v: any) => setF((s: any) => ({ ...s, [k]: v }));
  const create = useMutation({ mutationFn: () => api.post('/consulting/milestones', { engagementId, title: f.title, amountInr: f.amountInr ? Number(f.amountInr) : undefined, dueAt: f.dueAt || undefined }), onSuccess: () => { onDone(); toast.success('Milestone added'); onClose(); }, onError: (e) => toast.error(apiErrorMessage(e)) });
  return <Overlay title="New milestone" onClose={onClose}>
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      <div><label className="label">Title</label><input className="input" value={f.title} onChange={(e) => set('title', e.target.value)} placeholder="Discovery phase" /></div>
      <div style={{ display: 'flex', gap: 10 }}>
        <div style={{ flex: 1 }}><label className="label">Amount ₹</label><input className="input" type="number" value={f.amountInr} onChange={(e) => set('amountInr', e.target.value)} /></div>
        <div style={{ flex: 1 }}><label className="label">Due</label><input className="input" type="date" value={f.dueAt} onChange={(e) => set('dueAt', e.target.value)} /></div>
      </div>
    </div>
    <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10, marginTop: 18 }}><button className="btn-secondary" onClick={onClose}>Cancel</button><button className="btn-primary" disabled={!f.title || create.isPending} onClick={() => create.mutate()}>Add</button></div>
  </Overlay>;
}

// The consultant field used to be free text defaulting to "Consultant", which
// is why utilisation could not be attributed to anyone. Hours now belong to the
// signed-in user unless someone with consulting.manage logs them for a
// colleague, so there is nothing to type — and nothing to mistype.
function TimesheetModal({ engagementId, canLogForOthers, users, onClose, onDone }: { engagementId: string; canLogForOthers: boolean; users: ConsultingUser[]; onClose: () => void; onDone: () => void }) {
  const [f, setF] = useState<any>({ userId: '', hours: '', billable: true, rateInr: '' });
  const set = (k: string, v: any) => setF((s: any) => ({ ...s, [k]: v }));
  const create = useMutation({ mutationFn: () => api.post('/consulting/timesheets', { engagementId, userId: f.userId || undefined, hours: Number(f.hours), billable: f.billable, rateInr: f.rateInr ? Number(f.rateInr) : undefined }), onSuccess: () => { onDone(); toast.success('Hours logged'); onClose(); }, onError: (e) => toast.error(apiErrorMessage(e)) });
  return <Overlay title="Log hours" onClose={onClose}>
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      <div style={{ display: 'flex', gap: 10 }}>
        {canLogForOthers && <div style={{ flex: 1 }}><label className="label">Consultant</label><UserSelect value={f.userId} users={users} placeholder="Me" onChange={(v) => set('userId', v)} /></div>}
        <div style={{ width: 90 }}><label className="label">Hours</label><input className="input" type="number" value={f.hours} onChange={(e) => set('hours', e.target.value)} /></div>
      </div>
      <div style={{ display: 'flex', gap: 10, alignItems: 'flex-end' }}>
        <div style={{ flex: 1 }}><label className="label">Rate ₹/hr</label><input className="input" type="number" value={f.rateInr} onChange={(e) => set('rateInr', e.target.value)} /></div>
        <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 13, height: 40, cursor: 'pointer' }}><input type="checkbox" checked={f.billable} onChange={(e) => set('billable', e.target.checked)} /> Billable</label>
      </div>
    </div>
    <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10, marginTop: 18 }}><button className="btn-secondary" onClick={onClose}>Cancel</button><button className="btn-primary" disabled={!f.hours || create.isPending} onClick={() => create.mutate()}>Log</button></div>
  </Overlay>;
}

function Overlay({ children, onClose, title }: { children: React.ReactNode; onClose: () => void; title: string }) {
  return <div style={{ position: 'fixed', inset: 0, zIndex: 60, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }} onClick={(e) => e.stopPropagation()}>
    <div style={{ position: 'absolute', inset: 0, background: 'rgba(20,15,12,.42)' }} onClick={onClose} />
    <div style={{ ...card, position: 'relative', zIndex: 1, width: 500, maxWidth: '100%', padding: 22, borderRadius: 18 }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}><div style={{ fontWeight: 700, fontSize: 16 }}>{title}</div><button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--ink-3)' }}><X size={20} /></button></div>
      {children}
    </div>
  </div>;
}
