'use client';

/**
 * Walk-in Guest Counter Workflow
 *
 * Fast 60-second front desk check-in for guests arriving at the counter:
 * 1. Stay Period (Checking in now -> Select Check-out date)
 * 2. Room Selection (Live available rooms list with immediate room assignment)
 * 3. Guest Profile (Name, Phone, Email, ID details)
 * 4. Advance Collection & Instant Check-in
 */

import { useState } from 'react';
import { useMutation, useQuery } from '@tanstack/react-query';
import { toast } from 'sonner';
import { BedDouble, Check, KeyRound, TriangleAlert, UserCheck, Users, Wallet } from 'lucide-react';
import { api, apiErrorMessage } from '@/lib/api';
import { fmtOrgMoneyExact } from '@/lib/org-locale';
import { Field, Modal } from './kit';
import { StaySummary } from './stay-summary';
import { nightsBetween } from './pricing';
import type { AvailabilityResult, HotelCategory } from '../types';

const today = () => new Date().toISOString().slice(0, 10);
const plusDays = (n: number) => new Date(Date.now() + n * 86400000).toISOString().slice(0, 10);

export function WalkInModal({
  open,
  onClose,
  propertyId,
  categories,
  onDone,
  preselectedRoomId,
}: {
  open: boolean;
  onClose: () => void;
  propertyId: string | null;
  categories: HotelCategory[];
  onDone: () => void;
  preselectedRoomId?: string;
}) {
  const [to, setTo] = useState(plusDays(1));
  const [categoryId, setCategoryId] = useState(categories[0]?.id ?? '');
  const [roomId, setRoomId] = useState(preselectedRoomId ?? '');
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');
  const [advance, setAdvance] = useState<number | ''>('');
  const [advanceMethod, setAdvanceMethod] = useState('CASH');

  const nights = Math.max(1, nightsBetween(today(), to));
  const category = categories.find((c) => c.id === categoryId) ?? categories[0];

  const { data: avail, isFetching } = useQuery<AvailabilityResult>({
    queryKey: ['hotel-availability-walkin', propertyId, to, categoryId],
    queryFn: async () =>
      (
        await api.get('/hotel/availability', {
          params: { propertyId, from: new Date().toISOString(), to, categoryId: categoryId || undefined },
        })
      ).data,
    enabled: open && Boolean(propertyId) && Boolean(categoryId) && Boolean(to),
  });

  const rooms = avail?.rooms ?? [];

  const create = useMutation({
    mutationFn: async () =>
      (
        await api.post('/hotel/walk-in', {
          propertyId,
          categoryId: category?.id ?? categoryId,
          roomId,
          guestName: name.trim(),
          guestEmail: email.trim() || undefined,
          guestPhone: phone.trim() || undefined,
          checkOutDate: to,
          advanceInr: advance === '' ? undefined : advance,
          advanceMethod: advance === '' ? undefined : advanceMethod,
        })
      ).data,
    onSuccess: (res: any) => {
      const assignedRoom = rooms.find((r) => r.id === roomId)?.roomNumber ?? '';
      toast.success(`Guest checked in to Room ${assignedRoom} successfully!`);
      reset();
      onDone();
    },
    onError: (e) => toast.error(apiErrorMessage(e)),
  });

  const reset = () => {
    setName('');
    setPhone('');
    setEmail('');
    setRoomId('');
    setAdvance('');
  };

  const canCheckIn = Boolean(name.trim()) && Boolean(roomId) && !create.isPending;

  return (
    <Modal
      open={open}
      onClose={() => {
        reset();
        onClose();
      }}
      width={620}
      title="Walk-in Guest Check-in"
      subtitle="Creates guest record, opens stay folio, and assigns room key immediately"
      footer={
        <>
          <button
            className="btn-secondary"
            onClick={() => {
              reset();
              onClose();
            }}
          >
            Cancel
          </button>
          <button className="btn-primary" disabled={!canCheckIn} onClick={() => create.mutate()}>
            {create.isPending ? 'Checking in…' : `Check In Guest Now (Room ${rooms.find((r) => r.id === roomId)?.roomNumber ?? '…'})`}
          </button>
        </>
      }
    >
      <div className="ds-formflow" style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
        {/* Stay Section */}
        <section
          style={{
            background: 'var(--surface-sunken, rgba(0,0,0,0.02))',
            padding: 12,
            borderRadius: 'var(--radius-md, 8px)',
            border: '1px solid var(--border)',
          }}
        >
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span className="ds-caption-upper" style={{ fontWeight: 700 }}>Stay Duration (Checking in Today)</span>
            <span className="badge" style={{ background: 'var(--tone-active-bg)', color: 'var(--tone-active)', fontSize: 11 }}>
              {nights} Night{nights === 1 ? '' : 's'}
            </span>
          </div>
          <div style={{ marginTop: 8 }}>
            <Field label="Expected Check-out Date" required>
              <input className="input" type="date" min={today()} value={to} onChange={(e) => setTo(e.target.value)} />
            </Field>
          </div>
        </section>

        {/* Room Selection */}
        <section
          style={{
            background: 'var(--surface-sunken, rgba(0,0,0,0.02))',
            padding: 12,
            borderRadius: 'var(--radius-md, 8px)',
            border: '1px solid var(--border)',
          }}
        >
          <span className="ds-caption-upper" style={{ fontWeight: 700, display: 'flex', alignItems: 'center', gap: 6 }}>
            <KeyRound size={14} /> Room Assignment
          </span>
          <div className="ds-field-pair" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginTop: 8 }}>
            <Field label="Room Category" required>
              <select
                className="input"
                value={categoryId}
                onChange={(e) => {
                  setCategoryId(e.target.value);
                  setRoomId('');
                }}
              >
                {categories.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name} — {fmtOrgMoneyExact(c.basePriceInr)}/night
                  </option>
                ))}
              </select>
            </Field>
            <Field label="Assign Clean Room" required>
              <select
                className="input"
                value={roomId}
                onChange={(e) => setRoomId(e.target.value)}
                disabled={!rooms.length}
              >
                <option value="">{rooms.length ? 'Select room…' : 'No clean rooms free'}</option>
                {rooms.map((r) => (
                  <option key={r.id} value={r.id}>
                    Room {r.roomNumber} {r.floor ? `(Floor ${r.floor})` : ''}
                  </option>
                ))}
              </select>
            </Field>
          </div>
          <div
            style={{
              marginTop: 8,
              fontSize: 12,
              display: 'flex',
              alignItems: 'center',
              gap: 6,
              color: rooms.length > 0 ? 'var(--tone-active)' : 'var(--tone-expired)',
            }}
          >
            {rooms.length > 0 ? (
              <>
                <Check size={14} /> {rooms.length} clean room{rooms.length === 1 ? '' : 's'} available right now
              </>
            ) : (
              <>
                <TriangleAlert size={14} /> No clean rooms of this type are available
              </>
            )}
          </div>
        </section>

        {/* Guest Details */}
        <section
          style={{
            background: 'var(--surface-sunken, rgba(0,0,0,0.02))',
            padding: 12,
            borderRadius: 'var(--radius-md, 8px)',
            border: '1px solid var(--border)',
          }}
        >
          <span className="ds-caption-upper" style={{ fontWeight: 700, display: 'flex', alignItems: 'center', gap: 6 }}>
            <Users size={14} /> Guest Information
          </span>
          <div style={{ marginTop: 8 }}>
            <Field label="Full Name" required>
              <input className="input" value={name} onChange={(e) => setName(e.target.value)} placeholder="Guest name" />
            </Field>
          </div>
          <div className="ds-field-pair" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginTop: 8 }}>
            <Field label="Phone">
              <input className="input" value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="+91 …" />
            </Field>
            <Field label="Email">
              <input className="input" type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="Optional" />
            </Field>
          </div>
        </section>

        {/* Advance Collection */}
        <section
          style={{
            background: 'var(--surface-sunken, rgba(0,0,0,0.02))',
            padding: 12,
            borderRadius: 'var(--radius-md, 8px)',
            border: '1px solid var(--border)',
          }}
        >
          <span className="ds-caption-upper" style={{ fontWeight: 700, display: 'flex', alignItems: 'center', gap: 6 }}>
            <Wallet size={14} /> Advance Payment (Optional)
          </span>
          <div className="ds-field-pair" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginTop: 8 }}>
            <Field label="Advance Amount (₹)">
              <input
                className="input"
                type="number"
                min={0}
                value={advance}
                placeholder="0"
                onChange={(e) => setAdvance(e.target.value === '' ? '' : Number(e.target.value))}
              />
            </Field>
            <Field label="Payment Method">
              <select className="input" value={advanceMethod} onChange={(e) => setAdvanceMethod(e.target.value)}>
                {['CASH', 'UPI', 'CARD', 'ONLINE', 'BANK'].map((m) => (
                  <option key={m} value={m}>
                    {m}
                  </option>
                ))}
              </select>
            </Field>
          </div>
        </section>

        {category && nights > 0 && (
          <StaySummary
            nightlyInr={category.basePriceInr}
            nights={nights}
            roomTypeName={category.name}
            advanceInr={advance === '' ? 0 : advance}
          />
        )}
      </div>
    </Modal>
  );
}
