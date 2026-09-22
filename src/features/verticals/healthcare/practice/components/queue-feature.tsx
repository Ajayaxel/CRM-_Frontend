'use client';

import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { ListChecks, FilePlus2 } from 'lucide-react';
import { api } from '@/lib/api';
import { Appointment, AppointmentStatus, APPT_STATUS_META, patientName, timeOf } from '../practice-client';
import { EncounterModal } from './encounter-modal';

const card: React.CSSProperties = { background: 'var(--surface)', border: '1px solid var(--line-soft)', borderRadius: 16 };

export function QueueFeature() {
  const qc = useQueryClient();
  const [enc, setEnc] = useState<Appointment | null>(null);
  const { data } = useQuery({ queryKey: ['practice-queue'], queryFn: async () => (await api.get<Appointment[]>('/practice/queue')).data });
  const refresh = () => { qc.invalidateQueries({ queryKey: ['practice-queue'] }); qc.invalidateQueries({ queryKey: ['practice-appts'] }); qc.invalidateQueries({ queryKey: ['practice-stats'] }); };
  const setStatus = useMutation({ mutationFn: ({ id, status }: { id: string; status: AppointmentStatus }) => api.patch(`/practice/appointments/${id}/status`, { status }), onSuccess: () => { refresh(); toast.success('Updated'); } });

  return (
    <div style={{ animation: 'fadeUp .4s ease' }}>
      <div style={{ marginBottom: 18 }}>
        <h1 style={{ fontSize: 26, fontWeight: 700, letterSpacing: '-.02em', margin: 0 }}>Today's Queue</h1>
        <p style={{ fontSize: 14, color: 'var(--ink-2)', margin: '6px 0 0' }}>Patients checked in and waiting — start their consultation.</p>
      </div>

      {(data ?? []).length === 0 && <div style={{ ...card, padding: 44, textAlign: 'center', color: 'var(--ink-3)' }}><ListChecks size={30} style={{ opacity: 0.4 }} /><div style={{ marginTop: 10, fontSize: 14 }}>Queue is empty. Check patients in from Appointments.</div></div>}

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(300px,1fr))', gap: 12 }}>
        {(data ?? []).map((a, i) => {
          const m = APPT_STATUS_META[a.status];
          return (
            <div key={a.id} style={{ ...card, padding: 16 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  <span style={{ width: 30, height: 30, borderRadius: 8, background: 'var(--surface-2)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 800, fontSize: 13 }}>{i + 1}</span>
                  <div>
                    <div style={{ fontWeight: 700, fontSize: 14 }}>{patientName(a.patient)}</div>
                    <div style={{ fontSize: 11.5, color: 'var(--ink-3)' }}>{a.patient.mrn} · {timeOf(a.startAt)}</div>
                  </div>
                </div>
                <span className="badge" style={{ background: m.bg, color: m.fg }}>{m.label}</span>
              </div>
              {a.reason && <div style={{ fontSize: 12.5, color: 'var(--ink-2)', marginTop: 10 }}>{a.reason}</div>}
              <div style={{ display: 'flex', gap: 6, marginTop: 12 }}>
                {a.status === 'BOOKED' && <button className="btn-secondary" style={{ height: 30, fontSize: 12, flex: 1 }} onClick={() => setStatus.mutate({ id: a.id, status: 'ARRIVED' })}>Check in</button>}
                <button className="btn-primary" style={{ height: 30, fontSize: 12, flex: 1 }} onClick={() => setEnc(a)}><FilePlus2 size={13} /> Start encounter</button>
              </div>
            </div>
          );
        })}
      </div>

      {enc && <EncounterModal patientId={enc.patient.id} patientLabel={`${patientName(enc.patient)} · ${enc.patient.mrn}`} appointmentId={enc.id} onClose={() => setEnc(null)} onDone={refresh} />}
    </div>
  );
}
