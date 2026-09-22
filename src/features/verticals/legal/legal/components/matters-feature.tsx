'use client';

import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { Scale, Plus, X, Clock, Gavel, Landmark, ChevronRight } from 'lucide-react';
import { api, apiErrorMessage } from '@/lib/api';
import {
  AREA_LABEL, LegalStats, Matter, MATTER_COLS, MATTER_META, MatterDetail, MatterStatus,
  PRACTICE_AREAS, TRUST_META, dateFmt, money,
} from '../legal-client';

const card: React.CSSProperties = { background: 'var(--surface)', border: '1px solid var(--line-soft)', borderRadius: 16 };

export function MattersFeature() {
  const qc = useQueryClient();
  const [compose, setCompose] = useState(false);
  const [open, setOpen] = useState<string | null>(null);
  const { data: stats } = useQuery({ queryKey: ['legal-stats'], queryFn: async () => (await api.get<LegalStats>('/legal/stats')).data });
  const { data: board } = useQuery({ queryKey: ['legal-board'], queryFn: async () => (await api.get<{ status: MatterStatus; matters: Matter[] }[]>('/legal/matters/board')).data });
  const refresh = () => { qc.invalidateQueries({ queryKey: ['legal-board'] }); qc.invalidateQueries({ queryKey: ['legal-stats'] }); };
  const columns = board ?? MATTER_COLS.map((status) => ({ status, matters: [] as Matter[] }));

  return (
    <div style={{ animation: 'fadeUp .4s ease' }}>
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 18 }}>
        <div>
          <h1 style={{ fontSize: 26, fontWeight: 700, letterSpacing: '-.02em', margin: 0 }}>Matters</h1>
          <p style={{ fontSize: 14, color: 'var(--ink-2)', margin: '6px 0 0' }}>Cases, hearings, billable time and the client trust ledger.</p>
        </div>
        <button className="btn-primary" onClick={() => setCompose(true)}><Plus size={15} /> New matter</button>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5,1fr)', gap: 12, marginBottom: 18 }}>
        <Stat label="Open matters" value={stats?.openMatters ?? 0} accent="var(--brand,#132376)" />
        <Stat label="Upcoming hearings" value={stats?.upcomingHearings ?? 0} accent="var(--gold,#E6A23C)" />
        <Stat label="Hours (mo)" value={stats?.hoursThisMonth ?? 0} />
        <Stat label="Billable (mo)" value={money(stats?.billableValue ?? 0)} accent="var(--success)" />
        <Stat label="Trust balance" value={money(stats?.trustBalance ?? 0)} />
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,minmax(0,1fr))', gap: 12, alignItems: 'start' }}>
        {columns.map((col) => (
          <div key={col.status}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 8, padding: '0 2px' }}>
              <span style={{ width: 8, height: 8, borderRadius: '50%', background: MATTER_META[col.status].color }} />
              <span style={{ fontSize: 12, fontWeight: 700, color: 'var(--ink-2)' }}>{MATTER_META[col.status].label}</span>
              <span style={{ fontSize: 11, color: 'var(--ink-3)', marginLeft: 'auto' }}>{col.matters.length}</span>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {col.matters.map((m) => (
                <div key={m.id} style={{ ...card, padding: 14, cursor: 'pointer' }} onClick={() => setOpen(m.id)}>
                  <div style={{ fontFamily: 'var(--mono)', fontSize: 10.5, color: 'var(--ink-3)' }}>{m.reference}</div>
                  <div style={{ fontWeight: 700, fontSize: 13.5, marginTop: 2 }}>{m.title}</div>
                  <div style={{ fontSize: 12, color: 'var(--ink-3)', marginTop: 2 }}>{m.clientName}</div>
                  <div style={{ display: 'flex', gap: 5, marginTop: 8, flexWrap: 'wrap' }}>
                    <span className="badge" style={{ background: 'var(--surface-2)', color: 'var(--ink-3)', fontSize: 10 }}>{AREA_LABEL[m.practiceArea]}</span>
                    {(m._count?.hearings ?? 0) > 0 && <span className="badge" style={{ background: 'var(--surface-2)', color: 'var(--ink-3)', fontSize: 10 }}><Gavel size={9} style={{ marginRight: 2 }} />{m._count?.hearings}</span>}
                    {(m._count?.timeEntries ?? 0) > 0 && <span className="badge" style={{ background: 'var(--surface-2)', color: 'var(--ink-3)', fontSize: 10 }}><Clock size={9} style={{ marginRight: 2 }} />{m._count?.timeEntries}</span>}
                  </div>
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>

      {compose && <MatterModal onClose={() => setCompose(false)} onDone={refresh} />}
      {open && <MatterDrawer id={open} onClose={() => setOpen(null)} onChanged={refresh} />}
    </div>
  );
}

function Stat({ label, value, accent }: { label: string; value: number | string; accent?: string }) {
  return <div style={{ ...card, padding: 16 }}><div style={{ fontSize: 19, fontWeight: 800, color: accent ?? 'var(--ink-1)' }}>{value}</div><div style={{ fontSize: 12, color: 'var(--ink-3)', marginTop: 2 }}>{label}</div></div>;
}

function MatterDrawer({ id, onClose, onChanged }: { id: string; onClose: () => void; onChanged: () => void }) {
  const qc = useQueryClient();
  const [modal, setModal] = useState<null | 'hearing' | 'time' | 'trust'>(null);
  const { data: m } = useQuery({ queryKey: ['legal-matter', id], queryFn: async () => (await api.get<MatterDetail>(`/legal/matters/${id}`)).data });
  const refresh = () => { qc.invalidateQueries({ queryKey: ['legal-matter', id] }); onChanged(); };
  const setStatus = useMutation({ mutationFn: (status: MatterStatus) => api.patch(`/legal/matters/${id}/status`, { status }), onSuccess: () => { refresh(); toast.success('Status updated'); } });
  if (!m) return null;

  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 60, display: 'flex', justifyContent: 'flex-end' }}>
      <div style={{ position: 'absolute', inset: 0, background: 'rgba(20,15,12,.42)' }} onClick={onClose} />
      <div style={{ ...card, position: 'relative', zIndex: 1, width: 560, maxWidth: '100%', height: '100%', borderRadius: 0, padding: 24, overflowY: 'auto' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
          <div>
            <div style={{ fontFamily: 'var(--mono)', fontSize: 12, color: 'var(--ink-3)' }}>{m.reference}</div>
            <h2 style={{ fontSize: 19, fontWeight: 700, margin: '2px 0 0' }}>{m.title}</h2>
            <div style={{ fontSize: 13, color: 'var(--ink-3)', marginTop: 3 }}>{m.clientName} · {AREA_LABEL[m.practiceArea]}{m.court ? ` · ${m.court}` : ''}{m.caseNumber ? ` · ${m.caseNumber}` : ''}</div>
          </div>
          <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--ink-3)' }}><X size={20} /></button>
        </div>

        <div style={{ display: 'flex', gap: 8, marginTop: 12 }}>
          <select className="input" style={{ width: 130, height: 34 }} value={m.status} onChange={(e) => setStatus.mutate(e.target.value as MatterStatus)}>
            {MATTER_COLS.map((s) => <option key={s} value={s}>{MATTER_META[s].label}</option>)}
          </select>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 8, margin: '16px 0' }}>
          <Mini label="Logged" value={`${m.loggedHours}h`} />
          <Mini label="Billable" value={money(m.billableValue)} />
          <Mini label="Trust" value={money(m.trustBalance)} />
        </div>

        {/* Hearings */}
        <Section title="Court dates" icon={<Gavel size={13} />} action={<button className="btn-secondary" style={{ height: 26, fontSize: 11 }} onClick={() => setModal('hearing')}><Plus size={11} /> Add</button>}>
          {m.hearings.length === 0 && <Empty>No hearings scheduled.</Empty>}
          {m.hearings.map((h) => (
            <div key={h.id} style={{ background: 'var(--surface-2)', borderRadius: 8, padding: '8px 10px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12.5 }}><span style={{ fontWeight: 600 }}>{dateFmt(h.at)}</span><span style={{ color: 'var(--ink-3)' }}>{h.court}</span></div>
              {h.purpose && <div style={{ fontSize: 12, color: 'var(--ink-2)', marginTop: 2 }}>{h.purpose}</div>}
              {h.outcome && <div style={{ fontSize: 11.5, color: 'var(--success)', marginTop: 2 }}>Outcome: {h.outcome}{h.nextAt ? ` · next ${dateFmt(h.nextAt)}` : ''}</div>}
            </div>
          ))}
        </Section>

        {/* Time */}
        <Section title="Time entries" icon={<Clock size={13} />} action={<button className="btn-secondary" style={{ height: 26, fontSize: 11 }} onClick={() => setModal('time')}><Plus size={11} /> Log</button>}>
          {m.timeEntries.length === 0 && <Empty>No time logged.</Empty>}
          {m.timeEntries.map((t) => (
            <div key={t.id} style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 12.5 }}>
              <span style={{ fontWeight: 700 }}>{t.hours}h</span>
              <span style={{ color: 'var(--ink-3)', flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{t.narrative ?? t.userName}</span>
              {t.billable ? <span style={{ color: 'var(--ink-2)' }}>{money(t.hours * t.rateInr)}</span> : <span className="badge" style={{ background: 'var(--surface-2)', color: 'var(--ink-3)', fontSize: 9 }}>non-bill</span>}
            </div>
          ))}
        </Section>

        {/* Trust ledger */}
        <Section title="Trust ledger" icon={<Landmark size={13} />} action={<button className="btn-secondary" style={{ height: 26, fontSize: 11 }} onClick={() => setModal('trust')}><Plus size={11} /> Entry</button>}>
          {m.trustEntries.length === 0 && <Empty>No trust movements.</Empty>}
          {m.trustEntries.map((e) => {
            const tm = TRUST_META[e.type];
            return (
              <div key={e.id} style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 12.5 }}>
                <span className="badge" style={{ background: 'var(--surface-2)', color: tm.color }}>{tm.label}</span>
                <span style={{ color: tm.color, fontWeight: 700 }}>{tm.sign}{money(e.amountInr)}</span>
                <span style={{ marginLeft: 'auto', color: 'var(--ink-3)' }}>bal {money(e.balanceInr)}</span>
              </div>
            );
          })}
        </Section>

        {modal === 'hearing' && <HearingModal matterId={id} onClose={() => setModal(null)} onDone={refresh} />}
        {modal === 'time' && <TimeModal matterId={id} onClose={() => setModal(null)} onDone={refresh} />}
        {modal === 'trust' && <TrustModal matterId={id} onClose={() => setModal(null)} onDone={refresh} />}
      </div>
    </div>
  );
}

function Mini({ label, value }: { label: string; value: string }) {
  return <div style={{ background: 'var(--surface-2)', borderRadius: 10, padding: 12 }}><div style={{ fontSize: 15, fontWeight: 800 }}>{value}</div><div style={{ fontSize: 11, color: 'var(--ink-3)' }}>{label}</div></div>;
}
function Section({ title, icon, action, children }: { title: string; icon: React.ReactNode; action: React.ReactNode; children: React.ReactNode }) {
  return (
    <div style={{ marginTop: 18 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
        <span className="eyebrow" style={{ display: 'flex', alignItems: 'center', gap: 6 }}>{icon} {title}</span>{action}
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>{children}</div>
    </div>
  );
}
function Empty({ children }: { children: React.ReactNode }) { return <div style={{ fontSize: 12, color: 'var(--ink-3)' }}>{children}</div>; }

function MatterModal({ onClose, onDone }: { onClose: () => void; onDone: () => void }) {
  const [f, setF] = useState<any>({ clientName: '', title: '', practiceArea: 'LITIGATION', court: '', caseNumber: '' });
  const set = (k: string, v: any) => setF((s: any) => ({ ...s, [k]: v }));
  const create = useMutation({ mutationFn: () => api.post('/legal/matters', { clientName: f.clientName, title: f.title, practiceArea: f.practiceArea, court: f.court || undefined, caseNumber: f.caseNumber || undefined }), onSuccess: () => { onDone(); toast.success('Matter opened'); onClose(); }, onError: (e) => toast.error(apiErrorMessage(e)) });
  return <Overlay title="New matter" onClose={onClose}>
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      <div><label className="label">Client</label><input className="input" value={f.clientName} onChange={(e) => set('clientName', e.target.value)} placeholder="Nimbus Foods Pvt Ltd" /></div>
      <div><label className="label">Matter title</label><input className="input" value={f.title} onChange={(e) => set('title', e.target.value)} placeholder="Shareholder dispute" /></div>
      <div style={{ display: 'flex', gap: 10 }}>
        <div style={{ flex: 1 }}><label className="label">Practice area</label><select className="input" value={f.practiceArea} onChange={(e) => set('practiceArea', e.target.value)}>{PRACTICE_AREAS.map((a) => <option key={a} value={a}>{AREA_LABEL[a]}</option>)}</select></div>
        <div style={{ flex: 1 }}><label className="label">Court</label><input className="input" value={f.court} onChange={(e) => set('court', e.target.value)} placeholder="High Court" /></div>
      </div>
      <div style={{ width: 200 }}><label className="label">Case number</label><input className="input" value={f.caseNumber} onChange={(e) => set('caseNumber', e.target.value)} /></div>
    </div>
    <Actions disabled={!f.clientName || !f.title || create.isPending} onClose={onClose} onSubmit={() => create.mutate()} label="Open" />
  </Overlay>;
}

function HearingModal({ matterId, onClose, onDone }: { matterId: string; onClose: () => void; onDone: () => void }) {
  const [f, setF] = useState<any>({ at: '2026-07-14', court: '', purpose: '' });
  const set = (k: string, v: any) => setF((s: any) => ({ ...s, [k]: v }));
  const create = useMutation({ mutationFn: () => api.post('/legal/hearings', { matterId, at: new Date(f.at).toISOString(), court: f.court || undefined, purpose: f.purpose || undefined }), onSuccess: () => { onDone(); toast.success('Hearing scheduled'); onClose(); }, onError: (e) => toast.error(apiErrorMessage(e)) });
  return <Overlay title="Schedule hearing" onClose={onClose}>
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      <div style={{ display: 'flex', gap: 10 }}>
        <div style={{ flex: 1 }}><label className="label">Date</label><input className="input" type="date" value={f.at} onChange={(e) => set('at', e.target.value)} /></div>
        <div style={{ flex: 1 }}><label className="label">Court</label><input className="input" value={f.court} onChange={(e) => set('court', e.target.value)} /></div>
      </div>
      <div><label className="label">Purpose</label><input className="input" value={f.purpose} onChange={(e) => set('purpose', e.target.value)} placeholder="First hearing / arguments" /></div>
    </div>
    <Actions disabled={create.isPending} onClose={onClose} onSubmit={() => create.mutate()} label="Schedule" />
  </Overlay>;
}

function TimeModal({ matterId, onClose, onDone }: { matterId: string; onClose: () => void; onDone: () => void }) {
  const [f, setF] = useState<any>({ userName: '', hours: '', billable: true, rateInr: '', narrative: '' });
  const set = (k: string, v: any) => setF((s: any) => ({ ...s, [k]: v }));
  const create = useMutation({ mutationFn: () => api.post('/legal/time', { matterId, userName: f.userName || undefined, hours: Number(f.hours), billable: f.billable, rateInr: f.rateInr ? Number(f.rateInr) : undefined, narrative: f.narrative || undefined }), onSuccess: () => { onDone(); toast.success('Time logged'); onClose(); }, onError: (e) => toast.error(apiErrorMessage(e)) });
  return <Overlay title="Log time" onClose={onClose}>
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      <div style={{ display: 'flex', gap: 10, alignItems: 'flex-end' }}>
        <div style={{ width: 90 }}><label className="label">Hours</label><input className="input" type="number" value={f.hours} onChange={(e) => set('hours', e.target.value)} /></div>
        <div style={{ flex: 1 }}><label className="label">Rate ₹/hr</label><input className="input" type="number" value={f.rateInr} onChange={(e) => set('rateInr', e.target.value)} /></div>
        <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 13, height: 40 }}><input type="checkbox" checked={f.billable} onChange={(e) => set('billable', e.target.checked)} /> Billable</label>
      </div>
      <div><label className="label">Narrative</label><input className="input" value={f.narrative} onChange={(e) => set('narrative', e.target.value)} placeholder="Drafted written statement" /></div>
    </div>
    <Actions disabled={!f.hours || create.isPending} onClose={onClose} onSubmit={() => create.mutate()} label="Log" />
  </Overlay>;
}

function TrustModal({ matterId, onClose, onDone }: { matterId: string; onClose: () => void; onDone: () => void }) {
  const [f, setF] = useState<any>({ type: 'DEPOSIT', amountInr: '', note: '' });
  const set = (k: string, v: any) => setF((s: any) => ({ ...s, [k]: v }));
  const create = useMutation({ mutationFn: () => api.post('/legal/trust', { matterId, type: f.type, amountInr: Number(f.amountInr), note: f.note || undefined }), onSuccess: () => { onDone(); toast.success('Trust entry recorded'); onClose(); }, onError: (e) => toast.error(apiErrorMessage(e)) });
  return <Overlay title="Trust entry" onClose={onClose}>
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      <div style={{ display: 'flex', gap: 10 }}>
        <div style={{ flex: 1 }}><label className="label">Type</label><select className="input" value={f.type} onChange={(e) => set('type', e.target.value)}><option value="DEPOSIT">Deposit</option><option value="WITHDRAWAL">Withdrawal</option><option value="FEE">Fee</option></select></div>
        <div style={{ flex: 1 }}><label className="label">Amount ₹</label><input className="input" type="number" value={f.amountInr} onChange={(e) => set('amountInr', e.target.value)} /></div>
      </div>
      <div><label className="label">Note</label><input className="input" value={f.note} onChange={(e) => set('note', e.target.value)} /></div>
    </div>
    <Actions disabled={!f.amountInr || create.isPending} onClose={onClose} onSubmit={() => create.mutate()} label="Record" />
  </Overlay>;
}

function Actions({ disabled, onClose, onSubmit, label }: { disabled: boolean; onClose: () => void; onSubmit: () => void; label: string }) {
  return <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10, marginTop: 18 }}><button className="btn-secondary" onClick={onClose}>Cancel</button><button className="btn-primary" disabled={disabled} onClick={onSubmit}>{label}</button></div>;
}
function Overlay({ children, onClose, title }: { children: React.ReactNode; onClose: () => void; title: string }) {
  return <div style={{ position: 'fixed', inset: 0, zIndex: 70, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }}>
    <div style={{ position: 'absolute', inset: 0, background: 'rgba(20,15,12,.42)' }} onClick={onClose} />
    <div style={{ ...card, position: 'relative', zIndex: 1, width: 500, maxWidth: '100%', padding: 22, borderRadius: 18 }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}><div style={{ fontWeight: 700, fontSize: 16 }}>{title}</div><button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--ink-3)' }}><X size={20} /></button></div>
      {children}
    </div>
  </div>;
}
