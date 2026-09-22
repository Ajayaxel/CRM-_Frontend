'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { CalendarClock, Check, XCircle } from 'lucide-react';
import { api } from '@/lib/api';
import { TD_META, TestDrive, TestDriveStatus, dtFmt } from '../usedcar-client';

const card: React.CSSProperties = { background: 'var(--surface)', border: '1px solid var(--line-soft)', borderRadius: 16 };

export function TestDrivesFeature() {
  const qc = useQueryClient();
  const { data } = useQuery({ queryKey: ['car-testdrives'], queryFn: async () => (await api.get<TestDrive[]>('/cars/test-drives')).data });
  const setStatus = useMutation({ mutationFn: ({ id, status }: { id: string; status: TestDriveStatus }) => api.patch(`/cars/test-drives/${id}/status`, { status }), onSuccess: () => { qc.invalidateQueries({ queryKey: ['car-testdrives'] }); qc.invalidateQueries({ queryKey: ['car-stats'] }); toast.success('Updated'); } });

  const groups: Record<string, TestDrive[]> = {};
  for (const t of data ?? []) { const d = new Date(t.at).toLocaleDateString('en-IN', { weekday: 'short', day: 'numeric', month: 'short' }); (groups[d] ??= []).push(t); }

  return (
    <div style={{ animation: 'fadeUp .4s ease' }}>
      <div style={{ marginBottom: 18 }}>
        <h1 style={{ fontSize: 26, fontWeight: 700, letterSpacing: '-.02em', margin: 0 }}>Test Drives</h1>
        <p style={{ fontSize: 14, color: 'var(--ink-2)', margin: '6px 0 0' }}>Scheduled test drives across your inventory.</p>
      </div>

      {(data ?? []).length === 0 && <div style={{ ...card, padding: 44, textAlign: 'center', color: 'var(--ink-3)' }}><CalendarClock size={30} style={{ opacity: 0.4 }} /><div style={{ marginTop: 10, fontSize: 14 }}>No test drives booked. Book one from a vehicle.</div></div>}

      <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
        {Object.entries(groups).map(([day, tds]) => (
          <div key={day}>
            <div className="eyebrow" style={{ marginBottom: 8 }}>{day}</div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {tds.map((t) => {
                const m = TD_META[t.status];
                return (
                  <div key={t.id} style={{ ...card, padding: '14px 18px', display: 'flex', alignItems: 'center', gap: 14 }}>
                    <div style={{ width: 84, fontWeight: 700, fontSize: 13 }}>{new Date(t.at).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', hour12: true })}</div>
                    <div style={{ flex: 1 }}>
                      <div style={{ fontWeight: 700, fontSize: 14 }}>{t.customerName} {t.customerPhone && <span style={{ fontSize: 12, color: 'var(--ink-3)', fontWeight: 400 }}>· {t.customerPhone}</span>}</div>
                      <div style={{ fontSize: 12.5, color: 'var(--ink-3)' }}>{t.vehicle ? `${t.vehicle.year} ${t.vehicle.make} ${t.vehicle.model} · ${t.vehicle.reference}` : ''}</div>
                    </div>
                    <span className="badge" style={{ background: m.bg, color: m.fg }}>{m.label}</span>
                    {t.status === 'SCHEDULED' && <>
                      <button className="btn-secondary" style={{ height: 30, fontSize: 12 }} onClick={() => setStatus.mutate({ id: t.id, status: 'COMPLETED' })}><Check size={13} /> Done</button>
                      <button className="btn-secondary" style={{ height: 30, width: 30, padding: 0 }} onClick={() => setStatus.mutate({ id: t.id, status: 'NO_SHOW' })}><XCircle size={13} /></button>
                    </>}
                  </div>
                );
              })}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
