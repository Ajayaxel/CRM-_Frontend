'use client';

import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { CalendarClock, Plus, X, Search, FilePlus2, LogIn } from 'lucide-react';
import { api, apiErrorMessage } from '@/lib/api';
import {
  Appointment, AppointmentStatus, Patient, Provider, APPT_TYPES, APPT_STATUS_META, patientName, timeOf,
} from '../practice-client';
import { EncounterModal } from './encounter-modal';

const card: React.CSSProperties = { background: 'var(--surface)', border: '1px solid var(--line-soft)', borderRadius: 16 };

export function AppointmentsFeature() {
  const qc = useQueryClient();
  const [compose, setCompose] = useState(false);
  const [enc, setEnc] = useState<Appointment | null>(null);
  const from = '2026-07-01', to = '2026-08-31';
  const { data } = useQuery({ queryKey: ['practice-appts', from, to], queryFn: async () => (await api.get<Appointment[]>(`/practice/appointments?from=${from}&to=${to}`)).data });
  const refresh = () => { qc.invalidateQueries({ queryKey: ['practice-appts'] }); qc.invalidateQueries({ queryKey: ['practice-queue'] }); qc.invalidateQueries({ queryKey: ['practice-stats'] }); };
  const setStatus = useMutation({ mutationFn: ({ id, status }: { id: string; status: AppointmentStatus }) => api.patch(`/practice/appointments/${id}/status`, { status }), onSuccess: () => { refresh(); toast.success('Updated'); } });

  // group by date
  const groups: Record<string, Appointment[]> = {};
  for (const a of data ?? []) {
    const day = new Date(a.startAt).toLocaleDateString('en-IN', { weekday: 'short', day: 'numeric', month: 'short' });
    (groups[day] ??= []).push(a);
  }

  return (
    <div style={{ animation: 'fadeUp .4s ease' }}>
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 18 }}>
        <div>
          <h1 style={{ fontSize: 26, fontWeight: 700, letterSpacing: '-.02em', margin: 0 }}>Appointments</h1>
          <p style={{ fontSize: 14, color: 'var(--ink-2)', margin: '6px 0 0' }}>Schedule, check-in and start consultations.</p>
        </div>
        <button className="btn-primary" onClick={() => setCompose(true)}><Plus size={15} /> Book appointment</button>
      </div>

      {(data ?? []).length === 0 && <div style={{ ...card, padding: 44, textAlign: 'center', color: 'var(--ink-3)' }}><CalendarClock size={30} style={{ opacity: 0.4 }} /><div style={{ marginTop: 10, fontSize: 14 }}>No appointments booked.</div></div>}

      <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
        {Object.entries(groups).map(([day, appts]) => (
          <div key={day}>
            <div className="eyebrow" style={{ marginBottom: 8 }}>{day}</div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {appts.map((a) => {
                const m = APPT_STATUS_META[a.status];
                return (
                  <div key={a.id} style={{ ...card, padding: '14px 18px', display: 'flex', alignItems: 'center', gap: 14 }}>
                    <div style={{ width: 78, fontWeight: 700, fontSize: 13 }}>{timeOf(a.startAt)}</div>
                    <div style={{ flex: 1 }}>
                      <div style={{ fontWeight: 700, fontSize: 14 }}>{patientName(a.patient)} <span style={{ fontFamily: 'var(--mono)', fontSize: 11, color: 'var(--ink-3)', fontWeight: 400 }}>{a.patient.mrn}</span></div>
                      <div style={{ fontSize: 12, color: 'var(--ink-3)' }}>{[a.provider?.displayName, a.type.replace('_', ' ').toLowerCase(), a.reason].filter(Boolean).join(' · ')}</div>
                    </div>
                    <span className="badge" style={{ background: m.bg, color: m.fg }}>{m.label}</span>
                    {a.status === 'BOOKED' && <button className="btn-secondary" style={{ height: 30, fontSize: 12 }} onClick={() => setStatus.mutate({ id: a.id, status: 'ARRIVED' })}><LogIn size={13} /> Arrive</button>}
                    {(a.status === 'ARRIVED' || a.status === 'IN_PROGRESS') && <button className="btn-primary" style={{ height: 30, fontSize: 12 }} onClick={() => setEnc(a)}><FilePlus2 size={13} /> Encounter</button>}
                  </div>
                );
              })}
            </div>
          </div>
        ))}
      </div>

      {compose && <BookModal onClose={() => setCompose(false)} onDone={refresh} />}
      {enc && <EncounterModal patientId={enc.patient.id} patientLabel={`${patientName(enc.patient)} · ${enc.patient.mrn}`} appointmentId={enc.id} onClose={() => setEnc(null)} onDone={refresh} />}
    </div>
  );
}

function BookModal({ onClose, onDone }: { onClose: () => void; onDone: () => void }) {
  const [pq, setPq] = useState('');
  const { data: patients } = useQuery({ queryKey: ['practice-patients', pq], queryFn: async () => (await api.get<Patient[]>(`/practice/patients${pq ? `?q=${encodeURIComponent(pq)}` : ''}`)).data });
  const { data: providers } = useQuery({ queryKey: ['practice-providers'], queryFn: async () => (await api.get<Provider[]>('/practice/providers')).data });
  const [f, setF] = useState<any>({ patientId: '', providerId: '', date: '2026-07-07', time: '10:30', type: 'CONSULTATION', reason: '' });
  const set = (k: string, v: any) => setF((s: any) => ({ ...s, [k]: v }));
  const create = useMutation({
    mutationFn: () => api.post('/practice/appointments', {
      patientId: f.patientId, providerId: f.providerId || undefined,
      startAt: new Date(`${f.date}T${f.time}:00`).toISOString(), type: f.type, reason: f.reason || undefined,
    }),
    onSuccess: () => { onDone(); toast.success('Appointment booked'); onClose(); }, onError: (e) => toast.error(apiErrorMessage(e)),
  });
  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 60, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }}>
      <div style={{ position: 'absolute', inset: 0, background: 'rgba(20,15,12,.42)' }} onClick={onClose} />
      <div style={{ ...card, position: 'relative', zIndex: 1, width: 520, maxWidth: '100%', padding: 22, borderRadius: 18 }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}><div style={{ fontWeight: 700, fontSize: 16 }}>Book appointment</div><button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--ink-3)' }}><X size={20} /></button></div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          <div>
            <label className="label">Patient</label>
            <div style={{ position: 'relative', marginBottom: 6 }}><Search size={14} style={{ position: 'absolute', left: 11, top: 11, color: 'var(--ink-3)' }} /><input className="input" style={{ paddingLeft: 32 }} value={pq} onChange={(e) => setPq(e.target.value)} placeholder="Search…" /></div>
            <select className="input" value={f.patientId} onChange={(e) => set('patientId', e.target.value)}><option value="">Select patient…</option>{(patients ?? []).map((p) => <option key={p.id} value={p.id}>{patientName(p)} · {p.mrn}</option>)}</select>
          </div>
          <div><label className="label">Provider</label><select className="input" value={f.providerId} onChange={(e) => set('providerId', e.target.value)}><option value="">Any</option>{(providers ?? []).map((p) => <option key={p.id} value={p.id}>{p.displayName}</option>)}</select></div>
          <div style={{ display: 'flex', gap: 10 }}>
            <div style={{ flex: 1 }}><label className="label">Date</label><input className="input" type="date" value={f.date} onChange={(e) => set('date', e.target.value)} /></div>
            <div style={{ width: 110 }}><label className="label">Time</label><input className="input" type="time" value={f.time} onChange={(e) => set('time', e.target.value)} /></div>
            <div style={{ flex: 1 }}><label className="label">Type</label><select className="input" value={f.type} onChange={(e) => set('type', e.target.value)}>{APPT_TYPES.map((t) => <option key={t} value={t}>{t.replace('_', ' ')}</option>)}</select></div>
          </div>
          <div><label className="label">Reason</label><input className="input" value={f.reason} onChange={(e) => set('reason', e.target.value)} placeholder="Fever & cough" /></div>
        </div>
        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10, marginTop: 18 }}><button className="btn-secondary" onClick={onClose}>Cancel</button><button className="btn-primary" disabled={!f.patientId || create.isPending} onClick={() => create.mutate()}>Book</button></div>
      </div>
    </div>
  );
}
