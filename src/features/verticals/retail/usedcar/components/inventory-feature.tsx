'use client';

import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { Car, Plus, X, Gauge, Fuel, Cog, CircleDollarSign, CalendarPlus } from 'lucide-react';
import { api, apiErrorMessage } from '@/lib/api';
import {
  CarStats, COND_META, CONDITIONS, FUELS, VEHICLE_META, Vehicle, VehicleStatus, money, vehName,
} from '../usedcar-client';

const card: React.CSSProperties = { background: 'var(--surface)', border: '1px solid var(--line-soft)', borderRadius: 16 };

export function InventoryFeature() {
  const qc = useQueryClient();
  const [compose, setCompose] = useState(false);
  const [open, setOpen] = useState<string | null>(null);
  const { data: stats } = useQuery({ queryKey: ['car-stats'], queryFn: async () => (await api.get<CarStats>('/cars/stats')).data });
  const { data } = useQuery({ queryKey: ['car-inventory'], queryFn: async () => (await api.get<Vehicle[]>('/cars/inventory')).data });
  const refresh = () => { qc.invalidateQueries({ queryKey: ['car-inventory'] }); qc.invalidateQueries({ queryKey: ['car-stats'] }); };

  return (
    <div style={{ animation: 'fadeUp .4s ease' }}>
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 18 }}>
        <div>
          <h1 style={{ fontSize: 26, fontWeight: 700, letterSpacing: '-.02em', margin: 0 }}>Inventory</h1>
          <p style={{ fontSize: 14, color: 'var(--ink-2)', margin: '6px 0 0' }}>Your used-car stock — list, test-drive and sell.</p>
        </div>
        <button className="btn-primary" onClick={() => setCompose(true)}><Plus size={15} /> Add vehicle</button>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5,1fr)', gap: 12, marginBottom: 18 }}>
        <Stat label="Available" value={stats?.available ?? 0} accent="var(--success)" />
        <Stat label="Reserved" value={stats?.reserved ?? 0} accent="var(--gold,#c67c1e)" />
        <Stat label="Sold (mo)" value={stats?.soldThisMonth ?? 0} />
        <Stat label="Sales (mo)" value={money(stats?.salesThisMonth ?? 0)} accent="var(--brand,#132376)" />
        <Stat label="Test drives" value={stats?.testDrivesScheduled ?? 0} />
      </div>

      {(data ?? []).length === 0 && <div style={{ ...card, padding: 44, textAlign: 'center', color: 'var(--ink-3)' }}><Car size={30} style={{ opacity: 0.4 }} /><div style={{ marginTop: 10, fontSize: 14 }}>No vehicles in stock yet.</div></div>}

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(310px,1fr))', gap: 14 }}>
        {(data ?? []).map((v) => {
          const m = VEHICLE_META[v.status]; const cm = COND_META[v.condition];
          return (
            <div key={v.id} style={{ ...card, padding: 0, overflow: 'hidden', cursor: 'pointer' }} onClick={() => setOpen(v.id)}>
              <div style={{ height: 116, background: `linear-gradient(135deg, color-mix(in srgb, var(--brand,#132376) 14%, var(--surface)), var(--surface-2))`, display: 'flex', alignItems: 'center', justifyContent: 'center', position: 'relative' }}>
                <Car size={44} style={{ color: 'color-mix(in srgb, var(--brand,#132376) 45%, var(--ink-3))' }} strokeWidth={1.4} />
                <span className="badge" style={{ position: 'absolute', top: 10, right: 10, background: m.bg, color: m.fg }}>{m.label}</span>
                <span style={{ position: 'absolute', top: 10, left: 10, fontFamily: 'var(--mono)', fontSize: 10.5, color: 'var(--ink-3)', background: 'var(--surface)', borderRadius: 6, padding: '2px 7px' }}>{v.reference}</span>
              </div>
              <div style={{ padding: 15 }}>
                <div style={{ fontWeight: 700, fontSize: 15 }}>{vehName(v)}</div>
                <div style={{ display: 'flex', gap: 12, marginTop: 8, fontSize: 12, color: 'var(--ink-3)', flexWrap: 'wrap' }}>
                  <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}><Gauge size={13} />{v.mileageKm != null ? `${(v.mileageKm / 1000).toFixed(0)}k km` : '—'}</span>
                  <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}><Fuel size={13} />{v.fuel[0] + v.fuel.slice(1).toLowerCase()}</span>
                  <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}><Cog size={13} />{v.transmission[0] + v.transmission.slice(1).toLowerCase()}</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 12 }}>
                  <span style={{ fontSize: 19, fontWeight: 800, color: 'var(--brand,#132376)' }}>{v.status === 'SOLD' ? money(v.sellInr) : money(v.askingInr)}</span>
                  <span style={{ fontSize: 11.5, color: cm.color, fontWeight: 600 }}>{cm.label}</span>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {compose && <VehicleModal onClose={() => setCompose(false)} onDone={refresh} />}
      {open && <VehicleDrawer id={open} onClose={() => setOpen(null)} onChanged={refresh} />}
    </div>
  );
}

function Stat({ label, value, accent }: { label: string; value: number | string; accent?: string }) {
  return <div style={{ ...card, padding: 16 }}><div style={{ fontSize: 19, fontWeight: 800, color: accent ?? 'var(--ink-1)' }}>{value}</div><div style={{ fontSize: 12, color: 'var(--ink-3)', marginTop: 2 }}>{label}</div></div>;
}

function VehicleDrawer({ id, onClose, onChanged }: { id: string; onClose: () => void; onChanged: () => void }) {
  const qc = useQueryClient();
  const [modal, setModal] = useState<null | 'sell' | 'td'>(null);
  const { data: v } = useQuery({ queryKey: ['car-vehicle', id], queryFn: async () => (await api.get<Vehicle>(`/cars/inventory/${id}`)).data });
  const refresh = () => { qc.invalidateQueries({ queryKey: ['car-vehicle', id] }); onChanged(); };
  const setStatus = useMutation({ mutationFn: (status: VehicleStatus) => api.patch(`/cars/inventory/${id}/status`, { status }), onSuccess: () => { refresh(); toast.success('Status updated'); } });
  if (!v) return null;
  const m = VEHICLE_META[v.status];

  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 60, display: 'flex', justifyContent: 'flex-end' }}>
      <div style={{ position: 'absolute', inset: 0, background: 'rgba(20,15,12,.42)' }} onClick={onClose} />
      <div style={{ ...card, position: 'relative', zIndex: 1, width: 520, maxWidth: '100%', height: '100%', borderRadius: 0, padding: 24, overflowY: 'auto' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
          <div>
            <div style={{ fontFamily: 'var(--mono)', fontSize: 12, color: 'var(--ink-3)' }}>{v.reference}</div>
            <h2 style={{ fontSize: 20, fontWeight: 700, margin: '2px 0 0' }}>{vehName(v)}</h2>
            <div style={{ marginTop: 8 }}><span className="badge" style={{ background: m.bg, color: m.fg }}>{m.label}</span></div>
          </div>
          <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--ink-3)' }}><X size={20} /></button>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2,1fr)', gap: 8, margin: '18px 0' }}>
          <Spec label="Asking" value={money(v.askingInr)} />
          <Spec label="Cost" value={money(v.costInr)} />
          <Spec label="Mileage" value={v.mileageKm != null ? `${v.mileageKm.toLocaleString('en-IN')} km` : '—'} />
          <Spec label="Fuel · Trans" value={`${v.fuel[0] + v.fuel.slice(1).toLowerCase()} · ${v.transmission[0] + v.transmission.slice(1).toLowerCase()}`} />
          <Spec label="Condition" value={COND_META[v.condition].label} />
          <Spec label="VIN" value={v.vin ?? '—'} />
        </div>

        {v.status === 'SOLD' && <div style={{ ...card, background: 'var(--success-bg)', border: 'none', padding: 14, marginBottom: 16 }}>
          <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--success)' }}>Sold for {money(v.sellInr)}{v.soldTo ? ` to ${v.soldTo}` : ''}</div>
          {v.marginInr != null && <div style={{ fontSize: 12, color: 'var(--ink-2)', marginTop: 2 }}>Margin {money(v.marginInr)}</div>}
        </div>}

        <div className="eyebrow" style={{ margin: '4px 0 8px' }}>Test drives</div>
        {(v.testDrives ?? []).length === 0 && <div style={{ fontSize: 12.5, color: 'var(--ink-3)' }}>None booked.</div>}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          {(v.testDrives ?? []).map((td) => (
            <div key={td.id} style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12.5, background: 'var(--surface-2)', borderRadius: 8, padding: '7px 10px' }}>
              <span style={{ fontWeight: 600 }}>{td.customerName}</span><span style={{ color: 'var(--ink-3)' }}>{new Date(td.at).toLocaleString('en-IN', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })} · {td.status}</span>
            </div>
          ))}
        </div>

        <div style={{ display: 'flex', gap: 8, marginTop: 22, flexWrap: 'wrap' }}>
          {v.status !== 'SOLD' && <button className="btn-secondary" onClick={() => setModal('td')}><CalendarPlus size={14} /> Book test drive</button>}
          {v.status === 'AVAILABLE' && <button className="btn-secondary" onClick={() => setStatus.mutate('RESERVED')}>Reserve</button>}
          {v.status === 'RESERVED' && <button className="btn-secondary" onClick={() => setStatus.mutate('AVAILABLE')}>Un-reserve</button>}
          {v.status !== 'SOLD' && <button className="btn-primary" onClick={() => setModal('sell')}><CircleDollarSign size={14} /> Mark sold</button>}
        </div>

        {modal === 'td' && <TestDriveModal vehicleId={id} onClose={() => setModal(null)} onDone={refresh} />}
        {modal === 'sell' && <SellModal vehicle={v} onClose={() => setModal(null)} onDone={refresh} />}
      </div>
    </div>
  );
}

function Spec({ label, value }: { label: string; value: string }) {
  return <div style={{ background: 'var(--surface-2)', borderRadius: 10, padding: '9px 11px' }}><div style={{ fontSize: 10.5, letterSpacing: '.08em', textTransform: 'uppercase', color: 'var(--faint,var(--ink-3))', fontWeight: 700 }}>{label}</div><div style={{ fontSize: 13.5, fontWeight: 600, marginTop: 2 }}>{value}</div></div>;
}

function VehicleModal({ onClose, onDone }: { onClose: () => void; onDone: () => void }) {
  const [f, setF] = useState<any>({ make: '', model: '', variant: '', year: '2021', mileageKm: '', fuel: 'PETROL', transmission: 'MANUAL', condition: 'GOOD', costInr: '', askingInr: '' });
  const set = (k: string, v: any) => setF((s: any) => ({ ...s, [k]: v }));
  const create = useMutation({ mutationFn: () => api.post('/cars/inventory', { make: f.make, model: f.model, variant: f.variant || undefined, year: Number(f.year), mileageKm: f.mileageKm ? Number(f.mileageKm) : undefined, fuel: f.fuel, transmission: f.transmission, condition: f.condition, costInr: f.costInr ? Number(f.costInr) : undefined, askingInr: Number(f.askingInr) || 0 }), onSuccess: () => { onDone(); toast.success('Vehicle added'); onClose(); }, onError: (e) => toast.error(apiErrorMessage(e)) });
  return <Overlay title="Add vehicle" onClose={onClose}>
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      <div style={{ display: 'flex', gap: 10 }}>
        <div style={{ flex: 1 }}><label className="label">Make</label><input className="input" value={f.make} onChange={(e) => set('make', e.target.value)} placeholder="Maruti" /></div>
        <div style={{ flex: 1 }}><label className="label">Model</label><input className="input" value={f.model} onChange={(e) => set('model', e.target.value)} placeholder="Swift" /></div>
        <div style={{ width: 90 }}><label className="label">Year</label><input className="input" type="number" value={f.year} onChange={(e) => set('year', e.target.value)} /></div>
      </div>
      <div style={{ display: 'flex', gap: 10 }}>
        <div style={{ flex: 1 }}><label className="label">Variant</label><input className="input" value={f.variant} onChange={(e) => set('variant', e.target.value)} placeholder="ZXi" /></div>
        <div style={{ flex: 1 }}><label className="label">Mileage (km)</label><input className="input" type="number" value={f.mileageKm} onChange={(e) => set('mileageKm', e.target.value)} /></div>
      </div>
      <div style={{ display: 'flex', gap: 10 }}>
        <div style={{ flex: 1 }}><label className="label">Fuel</label><select className="input" value={f.fuel} onChange={(e) => set('fuel', e.target.value)}>{FUELS.map((x) => <option key={x} value={x}>{x[0] + x.slice(1).toLowerCase()}</option>)}</select></div>
        <div style={{ flex: 1 }}><label className="label">Transmission</label><select className="input" value={f.transmission} onChange={(e) => set('transmission', e.target.value)}><option value="MANUAL">Manual</option><option value="AUTOMATIC">Automatic</option></select></div>
        <div style={{ flex: 1 }}><label className="label">Condition</label><select className="input" value={f.condition} onChange={(e) => set('condition', e.target.value)}>{CONDITIONS.map((x) => <option key={x} value={x}>{x[0] + x.slice(1).toLowerCase()}</option>)}</select></div>
      </div>
      <div style={{ display: 'flex', gap: 10 }}>
        <div style={{ flex: 1 }}><label className="label">Cost ₹</label><input className="input" type="number" value={f.costInr} onChange={(e) => set('costInr', e.target.value)} /></div>
        <div style={{ flex: 1 }}><label className="label">Asking ₹</label><input className="input" type="number" value={f.askingInr} onChange={(e) => set('askingInr', e.target.value)} /></div>
      </div>
    </div>
    <Actions disabled={!f.make || !f.model || !f.askingInr || create.isPending} onClose={onClose} onSubmit={() => create.mutate()} label="Add" />
  </Overlay>;
}

function TestDriveModal({ vehicleId, onClose, onDone }: { vehicleId: string; onClose: () => void; onDone: () => void }) {
  const [f, setF] = useState<any>({ customerName: '', customerPhone: '', date: '2026-07-10', time: '11:00' });
  const set = (k: string, v: any) => setF((s: any) => ({ ...s, [k]: v }));
  const create = useMutation({ mutationFn: () => api.post('/cars/test-drives', { vehicleId, customerName: f.customerName, customerPhone: f.customerPhone || undefined, at: new Date(`${f.date}T${f.time}:00`).toISOString() }), onSuccess: () => { onDone(); toast.success('Test drive booked'); onClose(); }, onError: (e) => toast.error(apiErrorMessage(e)) });
  return <Overlay title="Book test drive" onClose={onClose}>
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      <div style={{ display: 'flex', gap: 10 }}>
        <div style={{ flex: 1 }}><label className="label">Customer</label><input className="input" value={f.customerName} onChange={(e) => set('customerName', e.target.value)} /></div>
        <div style={{ flex: 1 }}><label className="label">Phone</label><input className="input" value={f.customerPhone} onChange={(e) => set('customerPhone', e.target.value)} /></div>
      </div>
      <div style={{ display: 'flex', gap: 10 }}>
        <div style={{ flex: 1 }}><label className="label">Date</label><input className="input" type="date" value={f.date} onChange={(e) => set('date', e.target.value)} /></div>
        <div style={{ width: 120 }}><label className="label">Time</label><input className="input" type="time" value={f.time} onChange={(e) => set('time', e.target.value)} /></div>
      </div>
    </div>
    <Actions disabled={!f.customerName || create.isPending} onClose={onClose} onSubmit={() => create.mutate()} label="Book" />
  </Overlay>;
}

function SellModal({ vehicle, onClose, onDone }: { vehicle: Vehicle; onClose: () => void; onDone: () => void }) {
  const [f, setF] = useState<any>({ sellInr: String(vehicle.askingInr), soldTo: '' });
  const set = (k: string, v: any) => setF((s: any) => ({ ...s, [k]: v }));
  const sell = useMutation({ mutationFn: () => api.post(`/cars/inventory/${vehicle.id}/sell`, { sellInr: Number(f.sellInr), soldTo: f.soldTo || undefined }), onSuccess: () => { onDone(); toast.success('Vehicle sold'); onClose(); }, onError: (e) => toast.error(apiErrorMessage(e)) });
  return <Overlay title="Mark as sold" onClose={onClose}>
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      <div><label className="label">Sale price ₹</label><input className="input" type="number" value={f.sellInr} onChange={(e) => set('sellInr', e.target.value)} /></div>
      <div><label className="label">Sold to</label><input className="input" value={f.soldTo} onChange={(e) => set('soldTo', e.target.value)} placeholder="Buyer name" /></div>
      {vehicle.costInr != null && <div style={{ fontSize: 12.5, color: 'var(--ink-3)' }}>Margin: {money((Number(f.sellInr) || 0) - vehicle.costInr)}</div>}
    </div>
    <Actions disabled={!f.sellInr || sell.isPending} onClose={onClose} onSubmit={() => sell.mutate()} label="Confirm sale" />
  </Overlay>;
}

function Actions({ disabled, onClose, onSubmit, label }: { disabled: boolean; onClose: () => void; onSubmit: () => void; label: string }) {
  return <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10, marginTop: 18 }}><button className="btn-secondary" onClick={onClose}>Cancel</button><button className="btn-primary" disabled={disabled} onClick={onSubmit}>{label}</button></div>;
}
function Overlay({ children, onClose, title }: { children: React.ReactNode; onClose: () => void; title: string }) {
  return <div style={{ position: 'fixed', inset: 0, zIndex: 70, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }}>
    <div style={{ position: 'absolute', inset: 0, background: 'rgba(20,15,12,.42)' }} onClick={onClose} />
    <div style={{ ...card, position: 'relative', zIndex: 1, width: 520, maxWidth: '100%', maxHeight: '92vh', overflowY: 'auto', padding: 22, borderRadius: 18 }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}><div style={{ fontWeight: 700, fontSize: 16 }}>{title}</div><button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--ink-3)' }}><X size={20} /></button></div>
      {children}
    </div>
  </div>;
}
