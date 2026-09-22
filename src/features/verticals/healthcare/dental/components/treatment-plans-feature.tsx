'use client';

import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { ClipboardList, Plus, X, Check, Ban, ChevronRight } from 'lucide-react';
import { api, apiErrorMessage } from '@/lib/api';
import { Patient, patientName } from '@/features/verticals/healthcare/practice';
import {
  DentalStats, ItemStatus, NEXT_ITEM, ITEM_META, PLAN_META, PlanStatus, TreatmentPlan, money,
} from '../dental-client';

const card: React.CSSProperties = { background: 'var(--surface)', border: '1px solid var(--line-soft)', borderRadius: 16 };

export function TreatmentPlansFeature() {
  const qc = useQueryClient();
  const [compose, setCompose] = useState(false);
  const { data: stats } = useQuery({ queryKey: ['dental-stats'], queryFn: async () => (await api.get<DentalStats>('/dental/stats')).data });
  const { data } = useQuery({ queryKey: ['dental-plans'], queryFn: async () => (await api.get<TreatmentPlan[]>('/dental/plans')).data });
  const refresh = () => { qc.invalidateQueries({ queryKey: ['dental-plans'] }); qc.invalidateQueries({ queryKey: ['dental-stats'] }); };
  const setStatus = useMutation({ mutationFn: ({ id, status }: { id: string; status: PlanStatus }) => api.patch(`/dental/plans/${id}/status`, { status }), onSuccess: (_d, v) => { refresh(); toast.success(v.status === 'ACCEPTED' ? 'Plan accepted' : `Marked ${v.status.toLowerCase()}`); } });
  const setItem = useMutation({ mutationFn: ({ id, status }: { id: string; status: ItemStatus }) => api.patch(`/dental/items/${id}/status`, { status }), onSuccess: refresh });

  return (
    <div style={{ animation: 'fadeUp .4s ease' }}>
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 18 }}>
        <div>
          <h1 style={{ fontSize: 26, fontWeight: 700, letterSpacing: '-.02em', margin: 0 }}>Treatment Plans</h1>
          <p style={{ fontSize: 14, color: 'var(--ink-2)', margin: '6px 0 0' }}>Propose procedures, get acceptance and track progress.</p>
        </div>
        <button className="btn-primary" onClick={() => setCompose(true)}><Plus size={15} /> New plan</button>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 12, marginBottom: 18 }}>
        <Stat label="Proposed" value={stats?.proposedPlans ?? 0} />
        <Stat label="Active" value={stats?.activePlans ?? 0} accent="var(--brand,#132376)" />
        <Stat label="Completed" value={stats?.completedPlans ?? 0} accent="var(--success)" />
        <Stat label="Accepted value" value={money(stats?.acceptedValue ?? 0)} accent="var(--gold,#E6A23C)" />
      </div>

      {(data ?? []).length === 0 && <div style={{ ...card, padding: 44, textAlign: 'center', color: 'var(--ink-3)' }}><ClipboardList size={30} style={{ opacity: 0.4 }} /><div style={{ marginTop: 10, fontSize: 14 }}>No treatment plans yet.</div></div>}

      <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        {(data ?? []).map((p) => {
          const m = PLAN_META[p.status];
          const done = p.items.filter((i) => i.status === 'DONE').length;
          const decided = p.status !== 'PROPOSED';
          return (
            <div key={p.id} style={{ ...card, padding: 18 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 12 }}>
                <div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                    <span style={{ fontWeight: 700, fontSize: 15 }}>{p.title}</span>
                    <span className="badge" style={{ background: m.bg, color: m.fg }}>{m.label}</span>
                  </div>
                  <div style={{ fontSize: 12.5, color: 'var(--ink-3)', marginTop: 3 }}>{p.patient ? `${patientName(p.patient)} · ${p.patient.mrn}` : ''} · {money(p.totalInr)} · {done}/{p.items.length} done</div>
                </div>
                <div style={{ display: 'flex', gap: 6, flexShrink: 0 }}>
                  {p.status === 'PROPOSED' && <>
                    <button className="btn-primary" style={{ height: 32 }} onClick={() => setStatus.mutate({ id: p.id, status: 'ACCEPTED' })}><Check size={13} /> Accept</button>
                    <button className="btn-secondary" style={{ height: 32 }} onClick={() => setStatus.mutate({ id: p.id, status: 'DECLINED' })}><Ban size={13} /></button>
                  </>}
                </div>
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginTop: 12 }}>
                {p.items.map((it) => {
                  const im = ITEM_META[it.status];
                  return (
                    <div key={it.id} style={{ display: 'flex', alignItems: 'center', gap: 8, background: 'var(--surface-2)', borderRadius: 9, padding: '8px 10px' }}>
                      <span style={{ width: 7, height: 7, borderRadius: '50%', background: im.color }} />
                      {it.tooth && <span style={{ fontFamily: 'var(--mono)', fontSize: 11, background: 'var(--surface)', borderRadius: 5, padding: '1px 6px', color: 'var(--ink-2)' }}>#{it.tooth}</span>}
                      <span style={{ fontSize: 13, fontWeight: 600, flex: 1 }}>{it.procedure}</span>
                      <span style={{ fontSize: 12.5, color: 'var(--ink-3)' }}>{money(it.priceInr)}</span>
                      {decided && p.status !== 'DECLINED' && NEXT_ITEM[it.status] && (
                        <button className="btn-secondary" style={{ height: 26, fontSize: 11 }} onClick={() => setItem.mutate({ id: it.id, status: NEXT_ITEM[it.status]! })}>{ITEM_META[NEXT_ITEM[it.status]!].label} <ChevronRight size={11} /></button>
                      )}
                      {it.status === 'DONE' && <span className="badge" style={{ background: 'var(--success-bg)', color: 'var(--success)' }}>Done</span>}
                    </div>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>

      {compose && <PlanModal onClose={() => setCompose(false)} onDone={refresh} />}
    </div>
  );
}

function Stat({ label, value, accent }: { label: string; value: number | string; accent?: string }) {
  return <div style={{ ...card, padding: 16 }}><div style={{ fontSize: 20, fontWeight: 800, color: accent ?? 'var(--ink-1)' }}>{value}</div><div style={{ fontSize: 12, color: 'var(--ink-3)', marginTop: 2 }}>{label}</div></div>;
}

function PlanModal({ onClose, onDone }: { onClose: () => void; onDone: () => void }) {
  const { data: patients } = useQuery({ queryKey: ['practice-patients', ''], queryFn: async () => (await api.get<Patient[]>('/practice/patients')).data });
  const [f, setF] = useState<any>({ patientId: '', title: 'Treatment plan' });
  const [items, setItems] = useState<{ tooth: string; procedure: string; priceInr: string }[]>([{ tooth: '', procedure: '', priceInr: '' }]);
  const set = (k: string, v: any) => setF((s: any) => ({ ...s, [k]: v }));
  const setItem = (i: number, k: string, v: string) => setItems((s) => s.map((it, idx) => (idx === i ? { ...it, [k]: v } : it)));
  const total = items.reduce((s, i) => s + (Number(i.priceInr) || 0), 0);
  const create = useMutation({
    mutationFn: () => api.post('/dental/plans', { patientId: f.patientId, title: f.title, items: items.filter((i) => i.procedure.trim()).map((i) => ({ tooth: i.tooth || undefined, procedure: i.procedure, priceInr: Number(i.priceInr) || 0 })) }),
    onSuccess: () => { onDone(); toast.success('Plan created'); onClose(); }, onError: (e) => toast.error(apiErrorMessage(e)),
  });
  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 60, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }}>
      <div style={{ position: 'absolute', inset: 0, background: 'rgba(20,15,12,.42)' }} onClick={onClose} />
      <div style={{ ...card, position: 'relative', zIndex: 1, width: 560, maxWidth: '100%', padding: 22, borderRadius: 18 }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}><div style={{ fontWeight: 700, fontSize: 16 }}>New treatment plan</div><button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--ink-3)' }}><X size={20} /></button></div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          <div style={{ display: 'flex', gap: 10 }}>
            <div style={{ flex: 1 }}><label className="label">Patient</label><select className="input" value={f.patientId} onChange={(e) => set('patientId', e.target.value)}><option value="">Select…</option>{(patients ?? []).map((p) => <option key={p.id} value={p.id}>{patientName(p)} · {p.mrn}</option>)}</select></div>
            <div style={{ flex: 1 }}><label className="label">Title</label><input className="input" value={f.title} onChange={(e) => set('title', e.target.value)} /></div>
          </div>
          <div>
            <label className="label">Procedures</label>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              {items.map((it, i) => (
                <div key={i} style={{ display: 'grid', gridTemplateColumns: '60px 1fr 100px', gap: 6 }}>
                  <input className="input" style={{ height: 36 }} value={it.tooth} onChange={(e) => setItem(i, 'tooth', e.target.value)} placeholder="#" />
                  <input className="input" style={{ height: 36 }} value={it.procedure} onChange={(e) => setItem(i, 'procedure', e.target.value)} placeholder="Root canal" />
                  <input className="input" style={{ height: 36 }} type="number" value={it.priceInr} onChange={(e) => setItem(i, 'priceInr', e.target.value)} placeholder="₹" />
                </div>
              ))}
            </div>
            <button className="btn-secondary" style={{ height: 30, fontSize: 12, marginTop: 8 }} onClick={() => setItems((s) => [...s, { tooth: '', procedure: '', priceInr: '' }])}><Plus size={12} /> Procedure</button>
          </div>
          <div style={{ textAlign: 'right', fontWeight: 800, fontSize: 16 }}>{money(total)}</div>
        </div>
        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10, marginTop: 18 }}><button className="btn-secondary" onClick={onClose}>Cancel</button><button className="btn-primary" disabled={!f.patientId || !total || create.isPending} onClick={() => create.mutate()}>Create</button></div>
      </div>
    </div>
  );
}
