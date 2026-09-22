'use client';

/**
 * PMS Reservation Modal
 *
 * Implements the standard hospitality booking workflow:
 * 1. Stay Dates (Check-in, Check-out, Nights)
 * 2. Room Type & Live Availability Feedback
 * 3. Guest Profile (Existing guest search / autofill + New guest details)
 * 4. Itemized Financial Summary (Room charge + Incidentals + GST - Advance = Balance)
 */

import { useState } from 'react';
import { useMutation, useQuery } from '@tanstack/react-query';
import { toast } from 'sonner';
import { BedDouble, Calendar, Check, Search, ShieldCheck, TriangleAlert, UserCheck, Users } from 'lucide-react';
import { api, apiErrorMessage } from '@/lib/api';
import { fmtOrgMoneyExact } from '@/lib/org-locale';
import { Field, Modal } from './kit';
import { StaySummary } from './stay-summary';
import { nightsBetween } from './pricing';
import type { AvailabilityResult, HotelCategory } from '../types';

const today = () => new Date().toISOString().slice(0, 10);
const plusDays = (n: number) => new Date(Date.now() + n * 86400000).toISOString().slice(0, 10);

interface GuestSearchHit {
  id: string;
  firstName: string;
  lastName: string | null;
  email: string | null;
  phone: string | null;
  stayCount: number;
}

export function NewReservationModal({
  open,
  onClose,
  propertyId,
  categories,
  onDone,
  initialGuest,
}: {
  open: boolean;
  onClose: () => void;
  propertyId: string | null;
  categories: HotelCategory[];
  onDone: () => void;
  initialGuest?: { firstName: string; lastName?: string | null; phone?: string | null; email?: string | null } | null;
}) {
  const [from, setFrom] = useState(today());
  const [to, setTo] = useState(plusDays(2));
  const [categoryId, setCategoryId] = useState(categories[0]?.id ?? '');
  const [name, setName] = useState(initialGuest?.firstName ? `${initialGuest.firstName} ${initialGuest.lastName ?? ''}`.trim() : '');
  const [phone, setPhone] = useState(initialGuest?.phone ?? '');
  const [email, setEmail] = useState(initialGuest?.email ?? '');
  const [idProof, setIdProof] = useState('');
  const [specialRequests, setSpecialRequests] = useState('');
  const [extraCharges, setExtraCharges] = useState<number | ''>('');
  const [advance, setAdvance] = useState<number | ''>('');
  const [guestSearchQuery, setGuestSearchQuery] = useState('');
  const [showGuestSearch, setShowGuestSearch] = useState(false);

  const nights = Math.max(1, nightsBetween(from, to));
  const category = categories.find((c) => c.id === categoryId) ?? categories[0];

  // Live availability query
  const { data: avail, isFetching: isCheckingAvail } = useQuery<AvailabilityResult>({
    queryKey: ['hotel-availability-new', propertyId, from, to, categoryId],
    queryFn: async () =>
      (
        await api.get('/hotel/availability', {
          params: { propertyId, from, to, categoryId: categoryId || undefined },
        })
      ).data,
    enabled: open && Boolean(propertyId) && nights > 0,
  });

  // Guest search query for returning guests
  const { data: guestSearchResults = [] } = useQuery<GuestSearchHit[]>({
    queryKey: ['hotel-guest-search', guestSearchQuery],
    queryFn: async () =>
      (await api.get('/hotel/guests', { params: { search: guestSearchQuery } })).data,
    enabled: showGuestSearch && guestSearchQuery.trim().length >= 2,
  });

  const selectExistingGuest = (g: GuestSearchHit) => {
    setName(`${g.firstName} ${g.lastName ?? ''}`.trim());
    setPhone(g.phone ?? '');
    setEmail(g.email ?? '');
    setShowGuestSearch(false);
    setGuestSearchQuery('');
    toast.success(`Selected returning guest: ${g.firstName} (${g.stayCount} prior stay${g.stayCount === 1 ? '' : 's'})`);
  };

  const create = useMutation({
    mutationFn: async () => {
      const { data: bk } = await api.post('/hotel-bookings', {
        propertyId,
        categoryId: category?.id ?? categoryId,
        guestName: name.trim(),
        guestEmail: email.trim() || undefined,
        guestPhone: phone.trim() || undefined,
        checkInDate: from,
        checkOutDate: to,
        notes: [idProof ? `ID: ${idProof}` : null, specialRequests ? `Notes: ${specialRequests}` : null].filter(Boolean).join(' | ') || undefined,
      });
      // Confirm booking in the PMS inventory
      return (await api.post(`/hotel-bookings/${bk.id}/confirm`)).data;
    },
    onSuccess: () => {
      toast.success('Reservation confirmed successfully');
      reset();
      onDone();
    },
    onError: (e) => toast.error(apiErrorMessage(e)),
  });

  const reset = () => {
    setName('');
    setPhone('');
    setEmail('');
    setIdProof('');
    setSpecialRequests('');
    setExtraCharges('');
    setAdvance('');
    setGuestSearchQuery('');
    setShowGuestSearch(false);
  };

  const freeRooms = avail?.availableRooms ?? 0;
  const isAvailable = freeRooms > 0;
  const canConfirm = Boolean(name.trim()) && Boolean(category) && nights > 0 && isAvailable && !create.isPending;

  return (
    <Modal
      open={open}
      onClose={() => {
        reset();
        onClose();
      }}
      width={640}
      title="New Reservation"
      subtitle="Create a confirmed booking and lock room inventory"
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
          <button className="btn-primary" disabled={!canConfirm} onClick={() => create.mutate()}>
            {create.isPending ? 'Confirming…' : `Confirm Reservation (${nights} Night${nights === 1 ? '' : 's'})`}
          </button>
        </>
      }
    >
      <div className="ds-formflow" style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
        {/* Step 1: Stay Dates */}
        <section
          style={{
            background: 'var(--surface-sunken, rgba(0,0,0,0.02))',
            padding: 14,
            borderRadius: 'var(--radius-md, 8px)',
            border: '1px solid var(--border)',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
            <h4
              style={{
                fontSize: 12,
                fontWeight: 700,
                textTransform: 'uppercase',
                letterSpacing: '0.06em',
                color: 'var(--ink-secondary)',
                margin: 0,
                display: 'flex',
                alignItems: 'center',
                gap: 6,
              }}
            >
              <Calendar size={14} /> 1. Stay Period
            </h4>
            <span
              className="badge"
              style={{
                background: 'var(--tone-info-bg)',
                color: 'var(--tone-info)',
                fontWeight: 600,
                padding: '2px 8px',
                borderRadius: 999,
                fontSize: 12,
              }}
            >
              {nights} Night{nights === 1 ? '' : 's'}
            </span>
          </div>
          <div className="ds-field-pair" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <Field label="Check-in Date" required>
              <input
                className="input"
                type="date"
                min={today()}
                value={from}
                onChange={(e) => {
                  setFrom(e.target.value);
                  if (to <= e.target.value) setTo(plusDays(1));
                }}
              />
            </Field>
            <Field label="Check-out Date" required>
              <input
                className="input"
                type="date"
                min={from}
                value={to}
                onChange={(e) => setTo(e.target.value)}
              />
            </Field>
          </div>
        </section>

        {/* Step 2: Room Selection & Live Availability */}
        <section
          style={{
            background: 'var(--surface-sunken, rgba(0,0,0,0.02))',
            padding: 14,
            borderRadius: 'var(--radius-md, 8px)',
            border: '1px solid var(--border)',
          }}
        >
          <h4
            style={{
              fontSize: 12,
              fontWeight: 700,
              textTransform: 'uppercase',
              letterSpacing: '0.06em',
              color: 'var(--ink-secondary)',
              margin: '0 0 10px',
              display: 'flex',
              alignItems: 'center',
              gap: 6,
            }}
          >
            <BedDouble size={14} /> 2. Room Type & Availability
          </h4>
          <Field label="Room Category" required>
            <select
              className="input"
              value={categoryId}
              onChange={(e) => setCategoryId(e.target.value)}
            >
              {categories.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name} — {fmtOrgMoneyExact(c.basePriceInr)} / night (Sleeps {c.capacity})
                </option>
              ))}
            </select>
          </Field>

          {/* PMS Availability Banner */}
          <div
            style={{
              marginTop: 10,
              padding: '10px 14px',
              borderRadius: 'var(--radius-sm, 6px)',
              border: `1px solid ${isAvailable ? 'var(--tone-active-line)' : 'var(--tone-expired-line)'}`,
              background: isAvailable ? 'var(--tone-active-bg)' : 'var(--tone-expired-bg)',
              color: isAvailable ? 'var(--tone-active)' : 'var(--tone-expired)',
              display: 'flex',
              alignItems: 'center',
              gap: 8,
              fontSize: 13,
              fontWeight: 600,
            }}
          >
            {isCheckingAvail ? (
              <span>Checking live room inventory…</span>
            ) : isAvailable ? (
              <>
                <Check size={16} strokeWidth={2.6} />
                <span>
                  ✓ Available — {freeRooms} {category?.name ?? 'Standard'} room{freeRooms === 1 ? '' : 's'} available for these dates
                </span>
              </>
            ) : (
              <>
                <TriangleAlert size={16} strokeWidth={2.4} />
                <span>
                  ⚠️ Sold Out — No {category?.name ?? 'Standard'} rooms free between {from} and {to}
                </span>
              </>
            )}
          </div>
        </section>

        {/* Step 3: Guest Profile & Details */}
        <section
          style={{
            background: 'var(--surface-sunken, rgba(0,0,0,0.02))',
            padding: 14,
            borderRadius: 'var(--radius-md, 8px)',
            border: '1px solid var(--border)',
          }}
        >
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
            <h4
              style={{
                fontSize: 12,
                fontWeight: 700,
                textTransform: 'uppercase',
                letterSpacing: '0.06em',
                color: 'var(--ink-secondary)',
                margin: 0,
                display: 'flex',
                alignItems: 'center',
                gap: 6,
              }}
            >
              <Users size={14} /> 3. Guest Profile
            </h4>
            <button
              type="button"
              className="btn-ghost btn-sm"
              style={{ fontSize: 12, display: 'flex', alignItems: 'center', gap: 4 }}
              onClick={() => setShowGuestSearch(!showGuestSearch)}
            >
              <Search size={13} /> {showGuestSearch ? 'Hide guest search' : 'Search existing guest'}
            </button>
          </div>

          {showGuestSearch && (
            <div
              style={{
                marginBottom: 12,
                padding: 10,
                background: 'var(--surface, #fff)',
                border: '1px solid var(--border)',
                borderRadius: 'var(--radius-sm, 6px)',
              }}
            >
              <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                <input
                  className="input"
                  placeholder="Search returning guest by name, phone or email…"
                  value={guestSearchQuery}
                  onChange={(e) => setGuestSearchQuery(e.target.value)}
                  autoFocus
                />
              </div>
              {guestSearchResults.length > 0 && (
                <div style={{ marginTop: 8, maxHeight: 150, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 4 }}>
                  {guestSearchResults.map((g) => (
                    <div
                      key={g.id}
                      onClick={() => selectExistingGuest(g)}
                      style={{
                        padding: '6px 10px',
                        borderRadius: 4,
                        cursor: 'pointer',
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'center',
                        fontSize: 12.5,
                        background: 'var(--surface-sunken, #f8fafc)',
                      }}
                      className="hover-bg"
                    >
                      <div>
                        <strong>{g.firstName} {g.lastName ?? ''}</strong>
                        <span className="ds-caption" style={{ marginLeft: 8 }}>{g.phone ?? g.email}</span>
                      </div>
                      <span className="badge" style={{ fontSize: 11 }}>
                        <UserCheck size={11} style={{ display: 'inline', marginRight: 3 }} />
                        {g.stayCount} stay{g.stayCount === 1 ? '' : 's'}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          <Field label="Guest Full Name" required>
            <input
              className="input"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Mishal Cheruveettil"
            />
          </Field>

          <div className="ds-field-pair" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginTop: 8 }}>
            <Field label="Phone Number">
              <input
                className="input"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                placeholder="+91 98765 43210"
              />
            </Field>
            <Field label="Email Address">
              <input
                className="input"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="guest@example.com"
              />
            </Field>
          </div>

          <div className="ds-field-pair" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginTop: 8 }}>
            <Field label="ID Proof / Aadhaar / Passport (Optional)">
              <input
                className="input"
                value={idProof}
                onChange={(e) => setIdProof(e.target.value)}
                placeholder="e.g. Aadhaar XXXX-XXXX"
              />
            </Field>
            <Field label="Special Requests / Notes">
              <input
                className="input"
                value={specialRequests}
                onChange={(e) => setSpecialRequests(e.target.value)}
                placeholder="e.g. Late check-in, quiet room"
              />
            </Field>
          </div>
        </section>

        {/* Step 4: PMS Financial Summary */}
        {category && nights > 0 && (
          <StaySummary
            nightlyInr={category.basePriceInr}
            nights={nights}
            roomTypeName={category.name}
            additionalChargesInr={extraCharges === '' ? 0 : extraCharges}
            advanceInr={advance === '' ? 0 : advance}
          />
        )}
      </div>
    </Modal>
  );
}
