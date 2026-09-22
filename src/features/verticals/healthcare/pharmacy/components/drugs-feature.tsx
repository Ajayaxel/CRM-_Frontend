'use client';

import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { Pill, Plus, X, Trash2 } from 'lucide-react';
import { api, apiErrorMessage } from '@/lib/api';
import { Drug, FORMS, FORM_LABEL, PharmacyStats, SCHEDULES, SCHEDULE_META, money } from '../pharmacy-client';

const card: React.CSSProperties = { background: 'var(--surface)', border: '1px solid var(--line-soft)', borderRadius: 16 };

export function DrugsFeature() {
  const qc = useQueryClient();
  const [compose, setCompose] = useState(false);
  const { data: stats } = useQuery({ queryKey: ['pharm-stats'], queryFn: async () => (await api.get<PharmacyStats>('/pharmacy/stats')).data });
  const { data } = useQuery({ queryKey: ['pharm-drugs'], queryFn: async () => (await api.get<Drug[]>('/pharmacy/drugs')).data });
  const del = useMutation({ mutationFn: (id: string) => api.delete(`/pharmacy/drugs/${id}`), onSuccess: () => { qc.invalidateQueries({ queryKey: ['pharm-drugs'] }); toast.success('Removed'); } });

  return (
    <div style={{ animation: 'fadeUp .4s ease' }}>
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 18 }}>
        <div>
          <h1 style={{ fontSize: 26, fontWeight: 700, letterSpacing: '-.02em', margin: 0 }}>Drug Catalogue</h1>
          <p style={{ fontSize: 14, color: 'var(--ink-2)', margin: '6px 0 0' }}>Your formulary with drug-schedule flags, pricing and live stock.</p>
        </div>
        <button className="btn-primary" onClick={() => setCompose(true)}><Plus size={15} /> New drug</button>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 12, marginBottom: 18 }}>
        <Stat label="Drugs" value={stats?.drugs ?? 0} />
        <Stat label="Rx pending" value={stats?.rxPending ?? 0} accent="var(--brand,#132376)" />
        <Stat label="Expiring batches" value={stats?.expiringBatches ?? 0} accent="var(--danger,#c0392b)" />
        <Stat label="Sales (mo)" value={money(stats?.salesThisMonth ?? 0)} accent="var(--success)" />
      </div>

      {(data ?? []).length === 0 && <div style={{ ...card, padding: 44, textAlign: 'center', color: 'var(--ink-3)' }}><Pill size={30} style={{ opacity: 0.4 }} /><div style={{ marginTop: 10, fontSize: 14 }}>No drugs yet.</div></div>}

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(300px,1fr))', gap: 12 }}>
        {(data ?? []).map((d) => {
          const sm = SCHEDULE_META[d.schedule];
          return (
            <div key={d.id} style={{ ...card, padding: 16 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                <div>
                  <div style={{ fontWeight: 700, fontSize: 14.5 }}>{d.brand ?? d.genericName}</div>
                  <div style={{ fontSize: 12, color: 'var(--ink-3)', marginTop: 2 }}>{[d.genericName !== d.brand ? d.genericName : null, FORM_LABEL[d.form], d.strength].filter(Boolean).join(' · ')}</div>
                </div>
                <button className="btn-secondary" style={{ height: 28, width: 28, padding: 0 }} onClick={() => del.mutate(d.id)}><Trash2 size={12} /></button>
              </div>
              <div style={{ display: 'flex', gap: 6, marginTop: 10, flexWrap: 'wrap', alignItems: 'center' }}>
                <span className="badge" style={{ background: sm.bg, color: sm.fg }}>{sm.label}</span>
                {d.rxRequired && <span className="badge" style={{ background: 'var(--surface-2)', color: 'var(--ink-3)' }}>Rx required</span>}
                <span style={{ marginLeft: 'auto', fontWeight: 800, color: 'var(--brand,#132376)' }}>{money(d.priceInr)}</span>
              </div>
              <div style={{ marginTop: 10, fontSize: 12.5, color: d.stock > 0 ? 'var(--ink-2)' : 'var(--danger,#c0392b)' }}>{d.stock} in stock</div>
            </div>
          );
        })}
      </div>

      {compose && <DrugModal onClose={() => setCompose(false)} onDone={() => { qc.invalidateQueries({ queryKey: ['pharm-drugs'] }); qc.invalidateQueries({ queryKey: ['pharm-stats'] }); }} />}
    </div>
  );
}

function Stat({ label, value, accent }: { label: string; value: number | string; accent?: string }) {
  return <div style={{ ...card, padding: 16 }}><div style={{ fontSize: 20, fontWeight: 800, color: accent ?? 'var(--ink-1)' }}>{value}</div><div style={{ fontSize: 12, color: 'var(--ink-3)', marginTop: 2 }}>{label}</div></div>;
}

function DrugModal({ onClose, onDone }: { onClose: () => void; onDone: () => void }) {
  const [f, setF] = useState<any>({ code: '', genericName: '', brand: '', form: 'TABLET', strength: '', schedule: 'OTC', rxRequired: false, priceInr: '' });
  const set = (k: string, v: any) => setF((s: any) => ({ ...s, [k]: v }));
  const create = useMutation({ mutationFn: () => api.post('/pharmacy/drugs', { code: f.code, genericName: f.genericName, brand: f.brand || undefined, form: f.form, strength: f.strength || undefined, schedule: f.schedule, rxRequired: f.rxRequired, priceInr: Number(f.priceInr) || 0 }), onSuccess: () => { onDone(); toast.success('Drug added'); onClose(); }, onError: (e) => toast.error(apiErrorMessage(e)) });
  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 60, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }}>
      <div style={{ position: 'absolute', inset: 0, background: 'rgba(20,15,12,.42)' }} onClick={onClose} />
      <div style={{ ...card, position: 'relative', zIndex: 1, width: 520, maxWidth: '100%', padding: 22, borderRadius: 18 }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}><div style={{ fontWeight: 700, fontSize: 16 }}>New drug</div><button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--ink-3)' }}><X size={20} /></button></div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          <div style={{ display: 'flex', gap: 10 }}>
            <div style={{ width: 120 }}><label className="label">Code</label><input className="input" value={f.code} onChange={(e) => set('code', e.target.value)} placeholder="PARA500" /></div>
            <div style={{ flex: 1 }}><label className="label">Generic name</label><input className="input" value={f.genericName} onChange={(e) => set('genericName', e.target.value)} placeholder="Paracetamol" /></div>
          </div>
          <div style={{ display: 'flex', gap: 10 }}>
            <div style={{ flex: 1 }}><label className="label">Brand</label><input className="input" value={f.brand} onChange={(e) => set('brand', e.target.value)} placeholder="Crocin" /></div>
            <div style={{ width: 110 }}><label className="label">Strength</label><input className="input" value={f.strength} onChange={(e) => set('strength', e.target.value)} placeholder="500mg" /></div>
          </div>
          <div style={{ display: 'flex', gap: 10 }}>
            <div style={{ flex: 1 }}><label className="label">Form</label><select className="input" value={f.form} onChange={(e) => set('form', e.target.value)}>{FORMS.map((x) => <option key={x} value={x}>{FORM_LABEL[x]}</option>)}</select></div>
            <div style={{ flex: 1 }}><label className="label">Schedule</label><select className="input" value={f.schedule} onChange={(e) => set('schedule', e.target.value)}>{SCHEDULES.map((x) => <option key={x} value={x}>{SCHEDULE_META[x].label}</option>)}</select></div>
            <div style={{ width: 100 }}><label className="label">Price ₹</label><input className="input" type="number" value={f.priceInr} onChange={(e) => set('priceInr', e.target.value)} /></div>
          </div>
          <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, cursor: 'pointer' }}><input type="checkbox" checked={f.rxRequired} onChange={(e) => set('rxRequired', e.target.checked)} /> Prescription required</label>
        </div>
        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10, marginTop: 18 }}><button className="btn-secondary" onClick={onClose}>Cancel</button><button className="btn-primary" disabled={!f.code || !f.genericName || create.isPending} onClick={() => create.mutate()}>Add</button></div>
      </div>
    </div>
  );
}
