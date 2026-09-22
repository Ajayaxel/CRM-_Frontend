'use client';

import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { Car, Plus, X, Gauge, KeyRound, Wrench } from 'lucide-react';
import { api, apiErrorMessage } from '@/lib/api';
import { CATEGORIES, CAT_LABEL, FLEET_META, FleetStatus, FleetVehicle, RentalStats, money } from '../rental-client';

const card: React.CSSProperties = { background: 'var(--surface)', border: '1px solid var(--line-soft)', borderRadius: 16 };

export function FleetFeature() {
  const qc = useQueryClient();
  const [compose, setCompose] = useState(false);
  const { data: stats } = useQuery({ queryKey: ['rental-stats'], queryFn: async () => (await api.get<RentalStats>('/rental/stats')).data });
  const { data } = useQuery({ queryKey: ['rental-fleet'], queryFn: async () => (await api.get<FleetVehicle[]>('/rental/fleet')).data });
  const setStatus = useMutation({ mutationFn: ({ id, status }: { id: string; status: FleetStatus }) => api.patch(`/rental/fleet/${id}/status`, { status }), onSuccess: () => { qc.invalidateQueries({ queryKey: ['rental-fleet'] }); qc.invalidateQueries({ queryKey: ['rental-stats'] }); toast.success('Updated'); } });

  return (
    <div style={{ animation: 'fadeUp .4s ease' }}>
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 18 }}>
        <div>
          <h1 style={{ fontSize: 26, fontWeight: 700, letterSpacing: '-.02em', margin: 0 }}>Fleet</h1>
          <p style={{ fontSize: 14, color: 'var(--ink-2)', margin: '6px 0 0' }}>Your rental fleet — availability, daily rates and status.</p>
        </div>
        <button className="btn-primary" onClick={() => setCompose(true)}><Plus size={15} /> Add vehicle</button>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 12, marginBottom: 18 }}>
        <Stat label="Available" value={stats?.available ?? 0} accent="var(--success)" />
        <Stat label="Rented out" value={stats?.rented ?? 0} accent="var(--brand,#132376)" />
        <Stat label="Utilisation" value={`${stats?.utilisationPct ?? 0}%`} accent="var(--gold,#c67c1e)" />
        <Stat label="Revenue (mo)" value={money(stats?.revenueThisMonth ?? 0)} />
      </div>

      {(data ?? []).length === 0 && <div style={{ ...card, padding: 44, textAlign: 'center', color: 'var(--ink-3)' }}><Car size={30} style={{ opacity: 0.4 }} /><div style={{ marginTop: 10, fontSize: 14 }}>No fleet vehicles yet.</div></div>}

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(280px,1fr))', gap: 12 }}>
        {(data ?? []).map((v) => {
          const m = FLEET_META[v.status];
          return (
            <div key={v.id} style={{ ...card, padding: 16 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                <div>
                  <div style={{ fontWeight: 700, fontSize: 15 }}>{v.year} {v.make} {v.model}</div>
                  <div style={{ fontSize: 12, color: 'var(--ink-3)', marginTop: 2 }}><span style={{ fontFamily: 'var(--mono)' }}>{v.plateNo}</span> · {CAT_LABEL[v.category]}</div>
                </div>
                <span className="badge" style={{ background: m.bg, color: m.fg }}>{m.label}</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 12 }}>
                <span style={{ fontSize: 17, fontWeight: 800, color: 'var(--brand,#132376)' }}>{money(v.dailyRateInr)}<span style={{ fontSize: 12, color: 'var(--ink-3)', fontWeight: 500 }}>/day</span></span>
                <span style={{ fontSize: 12, color: 'var(--ink-3)', display: 'flex', alignItems: 'center', gap: 4 }}><Gauge size={13} />{(v.odometerKm / 1000).toFixed(0)}k km</span>
              </div>
              <div style={{ display: 'flex', gap: 6, marginTop: 12 }}>
                {v.status === 'AVAILABLE' && <button className="btn-secondary" style={{ height: 28, fontSize: 11.5, flex: 1 }} onClick={() => setStatus.mutate({ id: v.id, status: 'MAINTENANCE' })}><Wrench size={12} /> Servicing</button>}
                {v.status === 'MAINTENANCE' && <button className="btn-secondary" style={{ height: 28, fontSize: 11.5, flex: 1 }} onClick={() => setStatus.mutate({ id: v.id, status: 'AVAILABLE' })}><KeyRound size={12} /> Back in service</button>}
                {v.status === 'RENTED' && <span style={{ fontSize: 12, color: 'var(--ink-3)', padding: '4px 0' }}>On rent</span>}
              </div>
            </div>
          );
        })}
      </div>

      {compose && <FleetModal onClose={() => setCompose(false)} onDone={() => { qc.invalidateQueries({ queryKey: ['rental-fleet'] }); qc.invalidateQueries({ queryKey: ['rental-stats'] }); }} />}
    </div>
  );
}

function Stat({ label, value, accent }: { label: string; value: number | string; accent?: string }) {
  return <div style={{ ...card, padding: 16 }}><div style={{ fontSize: 20, fontWeight: 800, color: accent ?? 'var(--ink-1)' }}>{value}</div><div style={{ fontSize: 12, color: 'var(--ink-3)', marginTop: 2 }}>{label}</div></div>;
}

function FleetModal({ onClose, onDone }: { onClose: () => void; onDone: () => void }) {
  const [f, setF] = useState<any>({ make: '', model: '', year: '2022', plateNo: '', category: 'ECONOMY', dailyRateInr: '', odometerKm: '' });
  const set = (k: string, v: any) => setF((s: any) => ({ ...s, [k]: v }));
  const create = useMutation({ mutationFn: () => api.post('/rental/fleet', { make: f.make, model: f.model, year: Number(f.year), plateNo: f.plateNo, category: f.category, dailyRateInr: Number(f.dailyRateInr) || 0, odometerKm: f.odometerKm ? Number(f.odometerKm) : undefined }), onSuccess: () => { onDone(); toast.success('Vehicle added'); onClose(); }, onError: (e) => toast.error(apiErrorMessage(e)) });
  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 60, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }}>
      <div style={{ position: 'absolute', inset: 0, background: 'rgba(20,15,12,.42)' }} onClick={onClose} />
      <div style={{ ...card, position: 'relative', zIndex: 1, width: 500, maxWidth: '100%', padding: 22, borderRadius: 18 }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}><div style={{ fontWeight: 700, fontSize: 16 }}>Add fleet vehicle</div><button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--ink-3)' }}><X size={20} /></button></div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          <div style={{ display: 'flex', gap: 10 }}>
            <div style={{ flex: 1 }}><label className="label">Make</label><input className="input" value={f.make} onChange={(e) => set('make', e.target.value)} placeholder="Maruti" /></div>
            <div style={{ flex: 1 }}><label className="label">Model</label><input className="input" value={f.model} onChange={(e) => set('model', e.target.value)} placeholder="Dzire" /></div>
            <div style={{ width: 90 }}><label className="label">Year</label><input className="input" type="number" value={f.year} onChange={(e) => set('year', e.target.value)} /></div>
          </div>
          <div style={{ display: 'flex', gap: 10 }}>
            <div style={{ flex: 1 }}><label className="label">Plate no.</label><input className="input" value={f.plateNo} onChange={(e) => set('plateNo', e.target.value)} placeholder="KA01AB1234" /></div>
            <div style={{ flex: 1 }}><label className="label">Category</label><select className="input" value={f.category} onChange={(e) => set('category', e.target.value)}>{CATEGORIES.map((c) => <option key={c} value={c}>{CAT_LABEL[c]}</option>)}</select></div>
          </div>
          <div style={{ display: 'flex', gap: 10 }}>
            <div style={{ flex: 1 }}><label className="label">Daily rate ₹</label><input className="input" type="number" value={f.dailyRateInr} onChange={(e) => set('dailyRateInr', e.target.value)} /></div>
            <div style={{ flex: 1 }}><label className="label">Odometer km</label><input className="input" type="number" value={f.odometerKm} onChange={(e) => set('odometerKm', e.target.value)} /></div>
          </div>
        </div>
        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10, marginTop: 18 }}><button className="btn-secondary" onClick={onClose}>Cancel</button><button className="btn-primary" disabled={!f.make || !f.model || !f.plateNo || !f.dailyRateInr || create.isPending} onClick={() => create.mutate()}>Add</button></div>
      </div>
    </div>
  );
}
