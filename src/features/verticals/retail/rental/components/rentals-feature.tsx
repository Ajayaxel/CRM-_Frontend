'use client';

import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { CalendarDays, Plus, X, LogOut, LogIn, AlertTriangle, CreditCard } from 'lucide-react';
import { api, apiErrorMessage } from '@/lib/api';
import {
  Booking, FleetVehicle, RENTAL_COLS, RENTAL_META, RentalStatus, RentalStats, dFmt, money,
} from '../rental-client';

const card: React.CSSProperties = { background: 'var(--surface)', border: '1px solid var(--line-soft)', borderRadius: 16 };

export function RentalsFeature() {
  const qc = useQueryClient();
  const [compose, setCompose] = useState(false);
  const [open, setOpen] = useState<string | null>(null);
  const { data: stats } = useQuery({ queryKey: ['rental-stats'], queryFn: async () => (await api.get<RentalStats>('/rental/stats')).data });
  const { data: board } = useQuery({ queryKey: ['rental-board'], queryFn: async () => (await api.get<{ status: RentalStatus; bookings: Booking[] }[]>('/rental/bookings/board')).data });
  const refresh = () => { qc.invalidateQueries({ queryKey: ['rental-board'] }); qc.invalidateQueries({ queryKey: ['rental-stats'] }); qc.invalidateQueries({ queryKey: ['rental-fleet'] }); };
  const columns = board ?? RENTAL_COLS.map((status) => ({ status, bookings: [] as Booking[] }));

  return (
    <div style={{ animation: 'fadeUp .4s ease' }}>
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 18 }}>
        <div>
          <h1 style={{ fontSize: 26, fontWeight: 700, letterSpacing: '-.02em', margin: 0 }}>Rentals</h1>
          <p style={{ fontSize: 14, color: 'var(--ink-2)', margin: '6px 0 0' }}>Bookings from reservation through check-out, return and settlement.</p>
        </div>
        <button className="btn-primary" onClick={() => setCompose(true)}><Plus size={15} /> New booking</button>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 12, marginBottom: 18 }}>
        <Stat label="Active bookings" value={stats?.activeBookings ?? 0} accent="var(--brand,#132376)" />
        <Stat label="On rent now" value={stats?.rented ?? 0} />
        <Stat label="Completed (mo)" value={stats?.completedThisMonth ?? 0} accent="var(--success)" />
        <Stat label="Revenue (mo)" value={money(stats?.revenueThisMonth ?? 0)} accent="var(--gold,#c67c1e)" />
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,minmax(0,1fr))', gap: 12, alignItems: 'start' }}>
        {columns.map((col) => (
          <div key={col.status}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 8, padding: '0 2px' }}>
              <span style={{ width: 8, height: 8, borderRadius: '50%', background: RENTAL_META[col.status].color }} />
              <span style={{ fontSize: 12, fontWeight: 700, color: 'var(--ink-2)' }}>{RENTAL_META[col.status].label}</span>
              <span style={{ fontSize: 11, color: 'var(--ink-3)', marginLeft: 'auto' }}>{col.bookings.length}</span>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {col.bookings.map((b) => (
                <div key={b.id} style={{ ...card, padding: 13, cursor: 'pointer' }} onClick={() => setOpen(b.id)}>
                  <div style={{ display: 'flex', justifyContent: 'space-between' }}><span style={{ fontFamily: 'var(--mono)', fontSize: 10.5, color: 'var(--ink-3)' }}>{b.reference}</span><span style={{ fontSize: 11, color: 'var(--ink-3)' }}>{b.days}d</span></div>
                  <div style={{ fontWeight: 700, fontSize: 13.5, marginTop: 3 }}>{b.customerName}</div>
                  <div style={{ fontSize: 11.5, color: 'var(--ink-3)', marginTop: 2 }}>{b.fleetVehicle ? `${b.fleetVehicle.make} ${b.fleetVehicle.model} · ${b.fleetVehicle.plateNo}` : ''}</div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 8 }}>
                    <span style={{ fontSize: 11.5, color: 'var(--ink-3)' }}>{dFmt(b.pickupAt)} → {dFmt(b.returnAt)}</span>
                    <span style={{ fontWeight: 700, fontSize: 13 }}>{money(b.totalInr)}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>

      {compose && <BookingModal onClose={() => setCompose(false)} onDone={refresh} />}
      {open && <BookingDrawer id={open} onClose={() => setOpen(null)} onChanged={refresh} />}
    </div>
  );
}

function Stat({ label, value, accent }: { label: string; value: number | string; accent?: string }) {
  return <div style={{ ...card, padding: 16 }}><div style={{ fontSize: 19, fontWeight: 800, color: accent ?? 'var(--ink-1)' }}>{value}</div><div style={{ fontSize: 12, color: 'var(--ink-3)', marginTop: 2 }}>{label}</div></div>;
}

function BookingDrawer({ id, onClose, onChanged }: { id: string; onClose: () => void; onChanged: () => void }) {
  const qc = useQueryClient();
  const [modal, setModal] = useState<null | 'checkout' | 'checkin' | 'damage' | 'pay'>(null);
  const { data: b } = useQuery({ queryKey: ['rental-booking', id], queryFn: async () => (await api.get<Booking>(`/rental/bookings/${id}`)).data });
  const refresh = () => { qc.invalidateQueries({ queryKey: ['rental-booking', id] }); onChanged(); };
  if (!b) return null;
  const m = RENTAL_META[b.status];

  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 60, display: 'flex', justifyContent: 'flex-end' }}>
      <div style={{ position: 'absolute', inset: 0, background: 'rgba(20,15,12,.42)' }} onClick={onClose} />
      <div style={{ ...card, position: 'relative', zIndex: 1, width: 520, maxWidth: '100%', height: '100%', borderRadius: 0, padding: 24, overflowY: 'auto' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}><span style={{ fontFamily: 'var(--mono)', fontSize: 12 }}>{b.reference}</span><span className="badge" style={{ background: 'var(--surface-2)', color: m.color }}>{m.label}</span></div>
            <h2 style={{ fontSize: 19, fontWeight: 700, margin: '4px 0 0' }}>{b.customerName}</h2>
            <div style={{ fontSize: 13, color: 'var(--ink-3)', marginTop: 3 }}>{b.fleetVehicle ? `${b.fleetVehicle.make} ${b.fleetVehicle.model} · ${b.fleetVehicle.plateNo}` : ''}</div>
          </div>
          <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--ink-3)' }}><X size={20} /></button>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2,1fr)', gap: 8, margin: '18px 0' }}>
          <Mini label="Period" value={`${dFmt(b.pickupAt)} → ${dFmt(b.returnAt)}`} />
          <Mini label="Duration" value={`${b.days} day${b.days > 1 ? 's' : ''}`} />
          <Mini label="Total" value={money(b.totalInr)} />
          <Mini label="Deposit" value={money(b.depositInr)} />
          <Mini label="Paid" value={money(b.paidInr)} />
          <Mini label="Due" value={money(b.dueInr)} />
        </div>

        {b.agreement && (
          <div style={{ ...card, background: 'var(--surface-2)', border: 'none', padding: 14, marginBottom: 16 }}>
            <div className="eyebrow" style={{ marginBottom: 8 }}>Agreement</div>
            <div style={{ fontSize: 12.5, color: 'var(--ink-2)' }}>Out: {b.agreement.odoOut != null ? `${b.agreement.odoOut.toLocaleString('en-IN')} km` : '—'} · fuel {b.agreement.fuelOut ?? '—'}</div>
            <div style={{ fontSize: 12.5, color: 'var(--ink-2)', marginTop: 2 }}>In: {b.agreement.odoIn != null ? `${b.agreement.odoIn.toLocaleString('en-IN')} km` : '—'} · fuel {b.agreement.fuelIn ?? '—'}</div>
          </div>
        )}

        {(b.damages ?? []).length > 0 && (
          <div style={{ marginBottom: 16 }}>
            <div className="eyebrow" style={{ marginBottom: 8 }}>Damage &amp; deposit</div>
            {(b.damages ?? []).map((d) => <div key={d.id} style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12.5, background: 'var(--danger-bg,#fce8e8)', color: 'var(--danger,#c0392b)', borderRadius: 8, padding: '7px 10px', marginBottom: 5 }}><span>{d.description}</span><span style={{ fontWeight: 700 }}>{money(d.chargeInr)}</span></div>)}
            <div style={{ fontSize: 12.5, color: 'var(--ink-2)', marginTop: 4 }}>Deposit to refund: <b>{money(b.depositRefund)}</b> (₹{(b.depositInr).toLocaleString('en-IN')} − {money(b.damageTotal)} damages)</div>
          </div>
        )}

        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          {b.status === 'RESERVED' && <button className="btn-primary" onClick={() => setModal('checkout')}><LogOut size={14} /> Check out</button>}
          {b.status === 'CHECKED_OUT' && <button className="btn-primary" onClick={() => setModal('checkin')}><LogIn size={14} /> Check in</button>}
          {b.status !== 'RETURNED' && b.dueInr! > 0 && <button className="btn-secondary" onClick={() => setModal('pay')}><CreditCard size={14} /> Collect {money(b.dueInr)}</button>}
          {(b.status === 'CHECKED_OUT' || b.status === 'RETURNED') && <button className="btn-secondary" onClick={() => setModal('damage')}><AlertTriangle size={14} /> Log damage</button>}
        </div>

        {modal === 'checkout' && <CheckoutModal id={id} kind="checkout" onClose={() => setModal(null)} onDone={refresh} />}
        {modal === 'checkin' && <CheckoutModal id={id} kind="checkin" onClose={() => setModal(null)} onDone={refresh} />}
        {modal === 'damage' && <DamageModal id={id} onClose={() => setModal(null)} onDone={refresh} />}
        {modal === 'pay' && <PayModal id={id} due={b.dueInr ?? 0} onClose={() => setModal(null)} onDone={refresh} />}
      </div>
    </div>
  );
}

function Mini({ label, value }: { label: string; value: string }) {
  return <div style={{ background: 'var(--surface-2)', borderRadius: 10, padding: '9px 11px' }}><div style={{ fontSize: 10.5, letterSpacing: '.08em', textTransform: 'uppercase', color: 'var(--ink-3)', fontWeight: 700 }}>{label}</div><div style={{ fontSize: 13.5, fontWeight: 600, marginTop: 2 }}>{value}</div></div>;
}

function BookingModal({ onClose, onDone }: { onClose: () => void; onDone: () => void }) {
  const [range, setRange] = useState({ pickup: '2026-07-10', ret: '2026-07-13' });
  const iso = (d: string) => new Date(`${d}T10:00:00`).toISOString();
  const { data: avail } = useQuery({ queryKey: ['rental-avail', range.pickup, range.ret], enabled: !!range.pickup && !!range.ret && range.ret > range.pickup, queryFn: async () => (await api.get<FleetVehicle[]>(`/rental/availability?pickupAt=${iso(range.pickup)}&returnAt=${iso(range.ret)}`)).data });
  const [f, setF] = useState<any>({ fleetVehicleId: '', customerName: '', customerPhone: '', depositInr: '5000' });
  const set = (k: string, v: any) => setF((s: any) => ({ ...s, [k]: v }));
  const create = useMutation({ mutationFn: () => api.post('/rental/bookings', { fleetVehicleId: f.fleetVehicleId, customerName: f.customerName, customerPhone: f.customerPhone || undefined, pickupAt: iso(range.pickup), returnAt: iso(range.ret), depositInr: f.depositInr ? Number(f.depositInr) : undefined }), onSuccess: () => { onDone(); toast.success('Booking created'); onClose(); }, onError: (e) => toast.error(apiErrorMessage(e)) });
  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 70, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }}>
      <div style={{ position: 'absolute', inset: 0, background: 'rgba(20,15,12,.42)' }} onClick={onClose} />
      <div style={{ ...card, position: 'relative', zIndex: 1, width: 520, maxWidth: '100%', padding: 22, borderRadius: 18 }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}><div style={{ fontWeight: 700, fontSize: 16 }}>New booking</div><button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--ink-3)' }}><X size={20} /></button></div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          <div style={{ display: 'flex', gap: 10 }}>
            <div style={{ flex: 1 }}><label className="label">Pickup</label><input className="input" type="date" value={range.pickup} onChange={(e) => setRange((r) => ({ ...r, pickup: e.target.value }))} /></div>
            <div style={{ flex: 1 }}><label className="label">Return</label><input className="input" type="date" value={range.ret} onChange={(e) => setRange((r) => ({ ...r, ret: e.target.value }))} /></div>
          </div>
          <div>
            <label className="label">Available vehicle <span style={{ color: 'var(--ink-3)', fontWeight: 400 }}>({(avail ?? []).length} free for these dates)</span></label>
            <select className="input" value={f.fleetVehicleId} onChange={(e) => set('fleetVehicleId', e.target.value)}><option value="">Select…</option>{(avail ?? []).map((v) => <option key={v.id} value={v.id}>{v.year} {v.make} {v.model} · {v.plateNo} · {money(v.dailyRateInr)}/day</option>)}</select>
          </div>
          <div style={{ display: 'flex', gap: 10 }}>
            <div style={{ flex: 1 }}><label className="label">Customer</label><input className="input" value={f.customerName} onChange={(e) => set('customerName', e.target.value)} /></div>
            <div style={{ flex: 1 }}><label className="label">Phone</label><input className="input" value={f.customerPhone} onChange={(e) => set('customerPhone', e.target.value)} /></div>
            <div style={{ width: 110 }}><label className="label">Deposit ₹</label><input className="input" type="number" value={f.depositInr} onChange={(e) => set('depositInr', e.target.value)} /></div>
          </div>
        </div>
        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10, marginTop: 18 }}><button className="btn-secondary" onClick={onClose}>Cancel</button><button className="btn-primary" disabled={!f.fleetVehicleId || !f.customerName || create.isPending} onClick={() => create.mutate()}>Book</button></div>
      </div>
    </div>
  );
}

function CheckoutModal({ id, kind, onClose, onDone }: { id: string; kind: 'checkout' | 'checkin'; onClose: () => void; onDone: () => void }) {
  const [f, setF] = useState<any>({ odo: '', fuel: 'Full' });
  const set = (k: string, v: any) => setF((s: any) => ({ ...s, [k]: v }));
  const save = useMutation({ mutationFn: () => api.post(`/rental/bookings/${id}/${kind}`, kind === 'checkout' ? { odoOut: f.odo ? Number(f.odo) : undefined, fuelOut: f.fuel || undefined } : { odoIn: f.odo ? Number(f.odo) : undefined, fuelIn: f.fuel || undefined }), onSuccess: () => { onDone(); toast.success(kind === 'checkout' ? 'Checked out' : 'Checked in'); onClose(); }, onError: (e) => toast.error(apiErrorMessage(e)) });
  return <Overlay title={kind === 'checkout' ? 'Check out vehicle' : 'Check in vehicle'} onClose={onClose}>
    <div style={{ display: 'flex', gap: 10 }}>
      <div style={{ flex: 1 }}><label className="label">Odometer km</label><input className="input" type="number" value={f.odo} onChange={(e) => set('odo', e.target.value)} /></div>
      <div style={{ flex: 1 }}><label className="label">Fuel level</label><select className="input" value={f.fuel} onChange={(e) => set('fuel', e.target.value)}>{['Full', '3/4', '1/2', '1/4', 'Empty'].map((x) => <option key={x} value={x}>{x}</option>)}</select></div>
    </div>
    <Actions disabled={save.isPending} onClose={onClose} onSubmit={() => save.mutate()} label={kind === 'checkout' ? 'Check out' : 'Check in'} />
  </Overlay>;
}

function DamageModal({ id, onClose, onDone }: { id: string; onClose: () => void; onDone: () => void }) {
  const [f, setF] = useState<any>({ description: '', chargeInr: '' });
  const set = (k: string, v: any) => setF((s: any) => ({ ...s, [k]: v }));
  const save = useMutation({ mutationFn: () => api.post(`/rental/bookings/${id}/damage`, { description: f.description, chargeInr: f.chargeInr ? Number(f.chargeInr) : undefined }), onSuccess: () => { onDone(); toast.success('Damage logged'); onClose(); }, onError: (e) => toast.error(apiErrorMessage(e)) });
  return <Overlay title="Log damage" onClose={onClose}>
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      <div><label className="label">Description</label><input className="input" value={f.description} onChange={(e) => set('description', e.target.value)} placeholder="Scratch on rear bumper" /></div>
      <div style={{ width: 160 }}><label className="label">Charge ₹</label><input className="input" type="number" value={f.chargeInr} onChange={(e) => set('chargeInr', e.target.value)} /></div>
    </div>
    <Actions disabled={!f.description || save.isPending} onClose={onClose} onSubmit={() => save.mutate()} label="Log" />
  </Overlay>;
}

function PayModal({ id, due, onClose, onDone }: { id: string; due: number; onClose: () => void; onDone: () => void }) {
  const [amt, setAmt] = useState(String(due));
  const save = useMutation({ mutationFn: () => api.post(`/rental/bookings/${id}/pay`, { amountInr: Number(amt) }), onSuccess: () => { onDone(); toast.success('Payment recorded'); onClose(); }, onError: (e) => toast.error(apiErrorMessage(e)) });
  return <Overlay title="Collect payment" onClose={onClose}>
    <div><label className="label">Amount ₹</label><input className="input" type="number" value={amt} onChange={(e) => setAmt(e.target.value)} /></div>
    <Actions disabled={!amt || save.isPending} onClose={onClose} onSubmit={() => save.mutate()} label="Record" />
  </Overlay>;
}

function Actions({ disabled, onClose, onSubmit, label }: { disabled: boolean; onClose: () => void; onSubmit: () => void; label: string }) {
  return <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10, marginTop: 18 }}><button className="btn-secondary" onClick={onClose}>Cancel</button><button className="btn-primary" disabled={disabled} onClick={onSubmit}>{label}</button></div>;
}
function Overlay({ children, onClose, title }: { children: React.ReactNode; onClose: () => void; title: string }) {
  return <div style={{ position: 'fixed', inset: 0, zIndex: 80, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }}>
    <div style={{ position: 'absolute', inset: 0, background: 'rgba(20,15,12,.42)' }} onClick={onClose} />
    <div style={{ ...card, position: 'relative', zIndex: 1, width: 440, maxWidth: '100%', padding: 22, borderRadius: 18 }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}><div style={{ fontWeight: 700, fontSize: 16 }}>{title}</div><button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--ink-3)' }}><X size={20} /></button></div>
      {children}
    </div>
  </div>;
}
