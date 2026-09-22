'use client';

import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { X, Plus, Trash2, Pill } from 'lucide-react';
import { api, apiErrorMessage } from '@/lib/api';
import { Provider, RxItem } from '../practice-client';

const card: React.CSSProperties = { background: 'var(--surface)', border: '1px solid var(--line-soft)', borderRadius: 16 };

/** SOAP encounter + inline prescription builder. Reused from patient EHR, appointments and queue. */
export function EncounterModal({
  patientId, patientLabel, appointmentId, onClose, onDone,
}: { patientId: string; patientLabel: string; appointmentId?: string; onClose: () => void; onDone: () => void }) {
  const { data: providers } = useQuery({ queryKey: ['practice-providers'], queryFn: async () => (await api.get<Provider[]>('/practice/providers')).data });
  const [f, setF] = useState<any>({ providerId: '', subjective: '', objective: '', assessment: '', plan: '', bp: '', pulse: '', temp: '', spo2: '', diagnoses: '' });
  const [rx, setRx] = useState<RxItem[]>([]);
  const set = (k: string, v: any) => setF((s: any) => ({ ...s, [k]: v }));
  const addRx = () => setRx((r) => [...r, { drug: '', dose: '', frequency: '', durationDays: undefined }]);
  const setRxItem = (i: number, k: keyof RxItem, v: any) => setRx((r) => r.map((it, idx) => (idx === i ? { ...it, [k]: v } : it)));
  const rmRx = (i: number) => setRx((r) => r.filter((_, idx) => idx !== i));

  const save = useMutation({
    mutationFn: () => {
      const vitals: Record<string, unknown> = {};
      if (f.bp) vitals.bp = f.bp;
      if (f.pulse) vitals.pulse = Number(f.pulse);
      if (f.temp) vitals.temp = Number(f.temp);
      if (f.spo2) vitals.spo2 = Number(f.spo2);
      const prescription = rx.filter((r) => r.drug.trim()).map((r) => ({ ...r, durationDays: r.durationDays ? Number(r.durationDays) : undefined }));
      return api.post('/practice/encounters', {
        patientId, appointmentId, providerId: f.providerId || undefined,
        subjective: f.subjective || undefined, objective: f.objective || undefined,
        assessment: f.assessment || undefined, plan: f.plan || undefined,
        vitals, diagnoses: f.diagnoses ? f.diagnoses.split(',').map((s: string) => s.trim()).filter(Boolean) : [],
        prescription: prescription.length ? prescription : undefined,
      });
    },
    onSuccess: () => { onDone(); toast.success('Encounter saved'); onClose(); },
    onError: (e) => toast.error(apiErrorMessage(e)),
  });

  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 60, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }}>
      <div style={{ position: 'absolute', inset: 0, background: 'rgba(20,15,12,.42)' }} onClick={onClose} />
      <div style={{ ...card, position: 'relative', zIndex: 1, width: 640, maxWidth: '100%', maxHeight: '92vh', overflowY: 'auto', padding: 22, borderRadius: 18 }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 4 }}>
          <div style={{ fontWeight: 700, fontSize: 16 }}>New encounter</div>
          <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--ink-3)' }}><X size={20} /></button>
        </div>
        <div style={{ fontSize: 12.5, color: 'var(--ink-3)', marginBottom: 16 }}>{patientLabel}</div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          <div><label className="label">Provider</label><select className="input" value={f.providerId} onChange={(e) => set('providerId', e.target.value)}><option value="">Select…</option>{(providers ?? []).map((p) => <option key={p.id} value={p.id}>{p.displayName}{p.specialty ? ` · ${p.specialty}` : ''}</option>)}</select></div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 8 }}>
            <div><label className="label">BP</label><input className="input" value={f.bp} onChange={(e) => set('bp', e.target.value)} placeholder="120/80" /></div>
            <div><label className="label">Pulse</label><input className="input" type="number" value={f.pulse} onChange={(e) => set('pulse', e.target.value)} /></div>
            <div><label className="label">Temp °C</label><input className="input" type="number" value={f.temp} onChange={(e) => set('temp', e.target.value)} /></div>
            <div><label className="label">SpO₂</label><input className="input" type="number" value={f.spo2} onChange={(e) => set('spo2', e.target.value)} /></div>
          </div>

          <SoapField label="Subjective" hint="Complaints & history" value={f.subjective} onChange={(v) => set('subjective', v)} />
          <SoapField label="Objective" hint="Exam findings" value={f.objective} onChange={(v) => set('objective', v)} />
          <SoapField label="Assessment" hint="Impression" value={f.assessment} onChange={(v) => set('assessment', v)} />
          <SoapField label="Plan" hint="Management" value={f.plan} onChange={(v) => set('plan', v)} />
          <div><label className="label">Diagnoses (comma-separated)</label><input className="input" value={f.diagnoses} onChange={(e) => set('diagnoses', e.target.value)} placeholder="Viral pharyngitis, Dehydration" /></div>

          <div style={{ borderTop: '1px solid var(--line-soft)', paddingTop: 14 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
              <span style={{ fontWeight: 700, fontSize: 13, display: 'flex', alignItems: 'center', gap: 6 }}><Pill size={14} /> Prescription</span>
              <button className="btn-secondary" style={{ height: 28, fontSize: 12 }} onClick={addRx}><Plus size={12} /> Add drug</button>
            </div>
            {rx.length === 0 && <div style={{ fontSize: 12, color: 'var(--ink-3)' }}>No drugs added.</div>}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {rx.map((it, i) => (
                <div key={i} style={{ display: 'grid', gridTemplateColumns: '2fr 1fr 1fr 0.8fr 30px', gap: 6, alignItems: 'center' }}>
                  <input className="input" style={{ height: 34 }} value={it.drug} onChange={(e) => setRxItem(i, 'drug', e.target.value)} placeholder="Paracetamol 500mg" />
                  <input className="input" style={{ height: 34 }} value={it.dose ?? ''} onChange={(e) => setRxItem(i, 'dose', e.target.value)} placeholder="1 tab" />
                  <input className="input" style={{ height: 34 }} value={it.frequency ?? ''} onChange={(e) => setRxItem(i, 'frequency', e.target.value)} placeholder="TID" />
                  <input className="input" style={{ height: 34 }} type="number" value={it.durationDays ?? ''} onChange={(e) => setRxItem(i, 'durationDays', e.target.value)} placeholder="days" />
                  <button className="btn-secondary" style={{ height: 30, width: 30, padding: 0 }} onClick={() => rmRx(i)}><Trash2 size={12} /></button>
                </div>
              ))}
            </div>
          </div>
        </div>

        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10, marginTop: 18 }}>
          <button className="btn-secondary" onClick={onClose}>Cancel</button>
          <button className="btn-primary" disabled={save.isPending} onClick={() => save.mutate()}>{save.isPending ? 'Saving…' : 'Save encounter'}</button>
        </div>
      </div>
    </div>
  );
}

function SoapField({ label, hint, value, onChange }: { label: string; hint: string; value: string; onChange: (v: string) => void }) {
  return (
    <div>
      <label className="label">{label} <span style={{ color: 'var(--ink-3)', fontWeight: 400 }}>· {hint}</span></label>
      <textarea className="input" style={{ minHeight: 52, paddingTop: 8, resize: 'vertical' }} value={value} onChange={(e) => onChange(e.target.value)} />
    </div>
  );
}
