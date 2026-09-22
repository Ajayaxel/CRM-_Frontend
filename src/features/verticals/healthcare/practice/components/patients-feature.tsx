'use client';

import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { Users, Plus, X, Search, ChevronLeft, AlertTriangle, Pill, Receipt, Stethoscope, FilePlus2 } from 'lucide-react';
import { api, apiErrorMessage } from '@/lib/api';
import {
  Patient, PatientDetail, PracticeStats, INVOICE_META, age, money, patientName, timeOf,
} from '../practice-client';
import { EncounterModal } from './encounter-modal';

const card: React.CSSProperties = { background: 'var(--surface)', border: '1px solid var(--line-soft)', borderRadius: 16 };

export function PatientsFeature() {
  const qc = useQueryClient();
  const [q, setQ] = useState('');
  const [compose, setCompose] = useState(false);
  const [open, setOpen] = useState<string | null>(null);
  const { data: stats } = useQuery({ queryKey: ['practice-stats'], queryFn: async () => (await api.get<PracticeStats>('/practice/stats')).data });
  const { data } = useQuery({ queryKey: ['practice-patients', q], queryFn: async () => (await api.get<Patient[]>(`/practice/patients${q ? `?q=${encodeURIComponent(q)}` : ''}`)).data });

  if (open) return <PatientEHR id={open} onBack={() => setOpen(null)} />;

  return (
    <div style={{ animation: 'fadeUp .4s ease' }}>
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 18 }}>
        <div>
          <h1 style={{ fontSize: 26, fontWeight: 700, letterSpacing: '-.02em', margin: 0 }}>Patients</h1>
          <p style={{ fontSize: 14, color: 'var(--ink-2)', margin: '6px 0 0' }}>Your patient register — records, history and prescriptions.</p>
        </div>
        <button className="btn-primary" onClick={() => setCompose(true)}><Plus size={15} /> Register patient</button>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 12, marginBottom: 18 }}>
        <Stat label="Patients" value={stats?.patients ?? 0} />
        <Stat label="Today's appts" value={stats?.todayAppointments ?? 0} accent="var(--brand,#132376)" />
        <Stat label="Encounters (mo)" value={stats?.encountersThisMonth ?? 0} />
        <Stat label="Revenue (mo)" value={money(stats?.revenueThisMonth ?? 0)} accent="var(--success)" />
      </div>

      <div style={{ position: 'relative', marginBottom: 14, maxWidth: 340 }}>
        <Search size={15} style={{ position: 'absolute', left: 12, top: 11, color: 'var(--ink-3)' }} />
        <input className="input" style={{ paddingLeft: 34 }} value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search name, MRN or phone…" />
      </div>

      {(data ?? []).length === 0 && <div style={{ ...card, padding: 44, textAlign: 'center', color: 'var(--ink-3)' }}><Users size={30} style={{ opacity: 0.4 }} /><div style={{ marginTop: 10, fontSize: 14 }}>No patients yet.</div></div>}

      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        {(data ?? []).map((p) => (
          <div key={p.id} className="lead-row" style={{ ...card, padding: '14px 18px', display: 'flex', alignItems: 'center', gap: 14, cursor: 'pointer' }} onClick={() => setOpen(p.id)}>
            <span style={{ fontFamily: 'var(--mono)', fontSize: 11, color: 'var(--ink-3)', width: 78 }}>{p.mrn}</span>
            <div style={{ flex: 1 }}>
              <div style={{ fontWeight: 700, fontSize: 14 }}>{patientName(p)}</div>
              <div style={{ fontSize: 12, color: 'var(--ink-3)' }}>{[p.gender, age(p.dob), p.phone].filter(Boolean).join(' · ')}</div>
            </div>
            {p.allergies?.length > 0 && <span className="badge" style={{ background: 'var(--danger-bg,#fce8e8)', color: 'var(--danger,#c0392b)' }}><AlertTriangle size={11} style={{ marginRight: 3 }} />{p.allergies.length} allergy</span>}
            {p.bloodGroup && <span className="badge" style={{ background: 'var(--surface-2)', color: 'var(--ink-2)' }}>{p.bloodGroup}</span>}
          </div>
        ))}
      </div>
      <style>{`.lead-row:hover{background:var(--surface-2);}`}</style>

      {compose && <PatientModal onClose={() => setCompose(false)} onDone={() => { qc.invalidateQueries({ queryKey: ['practice-patients'] }); qc.invalidateQueries({ queryKey: ['practice-stats'] }); }} />}
    </div>
  );
}

function Stat({ label, value, accent }: { label: string; value: number | string; accent?: string }) {
  return <div style={{ ...card, padding: 16 }}><div style={{ fontSize: 20, fontWeight: 800, color: accent ?? 'var(--ink-1)' }}>{value}</div><div style={{ fontSize: 12, color: 'var(--ink-3)', marginTop: 2 }}>{label}</div></div>;
}

function PatientEHR({ id, onBack }: { id: string; onBack: () => void }) {
  const qc = useQueryClient();
  const [enc, setEnc] = useState(false);
  const [inv, setInv] = useState(false);
  const { data: p } = useQuery({ queryKey: ['practice-patient', id], queryFn: async () => (await api.get<PatientDetail>(`/practice/patients/${id}`)).data });
  const refresh = () => { qc.invalidateQueries({ queryKey: ['practice-patient', id] }); qc.invalidateQueries({ queryKey: ['practice-stats'] }); };
  if (!p) return <div style={{ padding: 40, color: 'var(--ink-3)' }}>Loading…</div>;

  return (
    <div style={{ animation: 'fadeUp .3s ease' }}>
      <button className="btn-secondary" style={{ marginBottom: 14 }} onClick={onBack}><ChevronLeft size={15} /> Patients</button>

      <div style={{ ...card, padding: 20, marginBottom: 16 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 12 }}>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <h1 style={{ fontSize: 22, fontWeight: 700, margin: 0 }}>{patientName(p)}</h1>
              <span style={{ fontFamily: 'var(--mono)', fontSize: 12, color: 'var(--ink-3)' }}>{p.mrn}</span>
            </div>
            <div style={{ fontSize: 13, color: 'var(--ink-3)', marginTop: 4 }}>{[p.gender, age(p.dob), p.phone, p.email].filter(Boolean).join(' · ')}</div>
          </div>
          <div style={{ display: 'flex', gap: 8 }}>
            <button className="btn-secondary" onClick={() => setInv(true)}><Receipt size={14} /> Invoice</button>
            <button className="btn-primary" onClick={() => setEnc(true)}><FilePlus2 size={14} /> New encounter</button>
          </div>
        </div>
        <div style={{ display: 'flex', gap: 8, marginTop: 12, flexWrap: 'wrap' }}>
          {p.bloodGroup && <span className="badge" style={{ background: 'var(--surface-2)', color: 'var(--ink-2)' }}>Blood {p.bloodGroup}</span>}
          {(p.allergies ?? []).map((a) => <span key={a} className="badge" style={{ background: 'var(--danger-bg,#fce8e8)', color: 'var(--danger,#c0392b)' }}><AlertTriangle size={11} style={{ marginRight: 3 }} />{a}</span>)}
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1.6fr 1fr', gap: 16 }}>
        <div>
          <div className="eyebrow" style={{ marginBottom: 10, display: 'flex', alignItems: 'center', gap: 6 }}><Stethoscope size={13} /> Encounters</div>
          {p.encounters.length === 0 && <div style={{ ...card, padding: 20, color: 'var(--ink-3)', fontSize: 13 }}>No encounters yet.</div>}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {p.encounters.map((e) => (
              <div key={e.id} style={{ ...card, padding: 16 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
                  <span style={{ fontWeight: 700, fontSize: 13 }}>{e.provider?.displayName ?? 'Encounter'}</span>
                  <span style={{ fontSize: 11.5, color: 'var(--ink-3)' }}>{e.createdAt ? new Date(e.createdAt).toLocaleDateString('en-IN') : ''}</span>
                </div>
                {e.diagnoses?.length > 0 && <div style={{ display: 'flex', gap: 5, flexWrap: 'wrap', marginBottom: 8 }}>{e.diagnoses.map((d) => <span key={d} className="badge" style={{ background: 'var(--brand-bg,#e9ecfb)', color: 'var(--brand,#132376)' }}>{d}</span>)}</div>}
                {e.assessment && <SoapLine k="A" v={e.assessment} />}
                {e.plan && <SoapLine k="P" v={e.plan} />}
                {e.prescription?.items?.length ? (
                  <div style={{ marginTop: 8, paddingTop: 8, borderTop: '1px dashed var(--line-soft)' }}>
                    <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--ink-3)', marginBottom: 4, display: 'flex', alignItems: 'center', gap: 4 }}><Pill size={11} /> Rx</div>
                    {e.prescription.items.map((it) => (
                      <div key={it.id} style={{ fontSize: 12, color: 'var(--ink-2)' }}>• {it.drug}{it.dose ? ` — ${it.dose}` : ''}{it.frequency ? ` · ${it.frequency}` : ''}{it.durationDays ? ` · ${it.durationDays}d` : ''}</div>
                    ))}
                  </div>
                ) : null}
              </div>
            ))}
          </div>
        </div>

        <div>
          <div className="eyebrow" style={{ marginBottom: 10, display: 'flex', alignItems: 'center', gap: 6 }}><Receipt size={13} /> Invoices</div>
          {p.invoices.length === 0 && <div style={{ ...card, padding: 20, color: 'var(--ink-3)', fontSize: 13 }}>No invoices.</div>}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {p.invoices.map((iv) => {
              const m = INVOICE_META[iv.status];
              return (
                <div key={iv.id} style={{ ...card, padding: 14 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span style={{ fontFamily: 'var(--mono)', fontSize: 12 }}>{iv.reference}</span>
                    <span className="badge" style={{ background: m.bg, color: m.fg }}>{m.label}</span>
                  </div>
                  <div style={{ fontSize: 18, fontWeight: 800, marginTop: 6 }}>{money(iv.totalInr)}</div>
                  {iv.status !== 'PAID' && <PayButton id={iv.id} due={iv.totalInr - iv.paidInr} onDone={refresh} />}
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {enc && <EncounterModal patientId={id} patientLabel={`${patientName(p)} · ${p.mrn}`} onClose={() => setEnc(false)} onDone={refresh} />}
      {inv && <InvoiceModal patientId={id} onClose={() => setInv(false)} onDone={refresh} />}
    </div>
  );
}

function SoapLine({ k, v }: { k: string; v: string }) {
  return <div style={{ fontSize: 12.5, color: 'var(--ink-2)', marginBottom: 2 }}><span style={{ fontWeight: 700, color: 'var(--ink-3)' }}>{k}:</span> {v}</div>;
}

function PayButton({ id, due, onDone }: { id: string; due: number; onDone: () => void }) {
  const pay = useMutation({ mutationFn: () => api.post(`/practice/invoices/${id}/pay`, { amountInr: due }), onSuccess: () => { onDone(); toast.success('Payment recorded'); } });
  return <button className="btn-secondary" style={{ height: 28, fontSize: 12, marginTop: 8, width: '100%' }} disabled={pay.isPending} onClick={() => pay.mutate()}>Collect {money(due)}</button>;
}

function PatientModal({ onClose, onDone }: { onClose: () => void; onDone: () => void }) {
  const [f, setF] = useState<any>({ firstName: '', lastName: '', gender: '', dob: '', phone: '', bloodGroup: '', allergies: '' });
  const set = (k: string, v: any) => setF((s: any) => ({ ...s, [k]: v }));
  const create = useMutation({
    mutationFn: () => api.post('/practice/patients', {
      firstName: f.firstName, lastName: f.lastName || undefined, gender: f.gender || undefined,
      dob: f.dob || undefined, phone: f.phone || undefined, bloodGroup: f.bloodGroup || undefined,
      allergies: f.allergies ? f.allergies.split(',').map((s: string) => s.trim()).filter(Boolean) : undefined,
    }),
    onSuccess: () => { onDone(); toast.success('Patient registered'); onClose(); }, onError: (e) => toast.error(apiErrorMessage(e)),
  });
  return <Overlay title="Register patient" onClose={onClose}>
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      <div style={{ display: 'flex', gap: 10 }}>
        <div style={{ flex: 1 }}><label className="label">First name</label><input className="input" value={f.firstName} onChange={(e) => set('firstName', e.target.value)} /></div>
        <div style={{ flex: 1 }}><label className="label">Last name</label><input className="input" value={f.lastName} onChange={(e) => set('lastName', e.target.value)} /></div>
      </div>
      <div style={{ display: 'flex', gap: 10 }}>
        <div style={{ flex: 1 }}><label className="label">Gender</label><select className="input" value={f.gender} onChange={(e) => set('gender', e.target.value)}><option value="">—</option><option value="MALE">Male</option><option value="FEMALE">Female</option><option value="OTHER">Other</option></select></div>
        <div style={{ flex: 1 }}><label className="label">DOB</label><input className="input" type="date" value={f.dob} onChange={(e) => set('dob', e.target.value)} /></div>
        <div style={{ width: 90 }}><label className="label">Blood</label><input className="input" value={f.bloodGroup} onChange={(e) => set('bloodGroup', e.target.value)} placeholder="O+" /></div>
      </div>
      <div><label className="label">Phone</label><input className="input" value={f.phone} onChange={(e) => set('phone', e.target.value)} /></div>
      <div><label className="label">Allergies (comma-separated)</label><input className="input" value={f.allergies} onChange={(e) => set('allergies', e.target.value)} placeholder="Penicillin, Sulfa" /></div>
    </div>
    <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10, marginTop: 18 }}><button className="btn-secondary" onClick={onClose}>Cancel</button><button className="btn-primary" disabled={!f.firstName || create.isPending} onClick={() => create.mutate()}>Register</button></div>
  </Overlay>;
}

function InvoiceModal({ patientId, onClose, onDone }: { patientId: string; onClose: () => void; onDone: () => void }) {
  const [items, setItems] = useState<{ label: string; priceInr: string }[]>([{ label: 'Consultation', priceInr: '500' }]);
  const setItem = (i: number, k: string, v: string) => setItems((s) => s.map((it, idx) => (idx === i ? { ...it, [k]: v } : it)));
  const total = items.reduce((s, i) => s + (Number(i.priceInr) || 0), 0);
  const create = useMutation({
    mutationFn: () => api.post('/practice/invoices', { patientId, items: items.filter((i) => i.label.trim()).map((i) => ({ label: i.label, priceInr: Number(i.priceInr) || 0 })) }),
    onSuccess: () => { onDone(); toast.success('Invoice created'); onClose(); }, onError: (e) => toast.error(apiErrorMessage(e)),
  });
  return <Overlay title="New invoice" onClose={onClose}>
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
      {items.map((it, i) => (
        <div key={i} style={{ display: 'flex', gap: 8 }}>
          <input className="input" value={it.label} onChange={(e) => setItem(i, 'label', e.target.value)} placeholder="Service" />
          <input className="input" style={{ width: 110 }} type="number" value={it.priceInr} onChange={(e) => setItem(i, 'priceInr', e.target.value)} placeholder="₹" />
        </div>
      ))}
      <button className="btn-secondary" style={{ height: 30, fontSize: 12, alignSelf: 'flex-start' }} onClick={() => setItems((s) => [...s, { label: '', priceInr: '' }])}><Plus size={12} /> Line</button>
      <div style={{ textAlign: 'right', fontWeight: 800, fontSize: 16, marginTop: 4 }}>{money(total)}</div>
    </div>
    <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10, marginTop: 18 }}><button className="btn-secondary" onClick={onClose}>Cancel</button><button className="btn-primary" disabled={!total || create.isPending} onClick={() => create.mutate()}>Create</button></div>
  </Overlay>;
}

function Overlay({ children, onClose, title }: { children: React.ReactNode; onClose: () => void; title: string }) {
  return <div style={{ position: 'fixed', inset: 0, zIndex: 60, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }}>
    <div style={{ position: 'absolute', inset: 0, background: 'rgba(20,15,12,.42)' }} onClick={onClose} />
    <div style={{ ...card, position: 'relative', zIndex: 1, width: 500, maxWidth: '100%', padding: 22, borderRadius: 18 }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}><div style={{ fontWeight: 700, fontSize: 16 }}>{title}</div><button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--ink-3)' }}><X size={20} /></button></div>
      {children}
    </div>
  </div>;
}
