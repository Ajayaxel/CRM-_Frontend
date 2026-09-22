'use client';

/**
 * The desk booking flow — full screen, floor first.
 *
 * Rooms keep the modal wizard; a desk is a PLACE, so choosing one gets the
 * whole screen: schedule on the left, an architectural floor map in the
 * middle, the money on the right. Four steps run across the top —
 * Choose Space (done before this opens) → Choose Desk → Your Details →
 * Review & Pay — and the map is the star of step two.
 *
 * Everything money- or availability-shaped comes from the server: freeUnits
 * for the chosen window paints the taken desks, POST /bookings/quote prices
 * the summary, and the booking create is the same call the modal wizard
 * makes. Desk identity stays advisory — the engine holds unit counts, the
 * picked codes ride the booking note, and the map says so in plain words
 * ("desks are taken in order from A-1"). No fake holds: there is no
 * reservation timer in the engine, so none is shown.
 */

import { useEffect, useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { AlertTriangle, Armchair, Check, CreditCard, Headset, Lock, Maximize2, Minus, Plus, Receipt, X } from 'lucide-react';
import { api, apiErrorMessage } from '@/lib/api';
import { Badge, EmptyState, Field, Skeleton, humanStatus } from './kit';
import { Detail, DetailGrid, fmtDate, fmtTime, money, toDateInput, toLocalInput } from './common';
import type { BookingWizardSpace } from './booking-wizard';

const STEPS = ['Choose Space', 'Choose Desk', 'Your Details', 'Review & Pay'];

export interface DeskSpace extends BookingWizardSpace {
  coverUrl?: string | null;
  building?: string | null;
  floorName?: string | null;
}

interface SeatConfig {
  seatLabels?: string[];
  premiumSeats?: number[];
  premiumNote?: string;
  orientationTop?: string;
  orientationBottom?: string;
}

interface WindowAvailability {
  spaces: { id: string; units: number; freeUnits?: number; available: boolean; reason?: string | null }[];
}
interface ServiceRow { id: string; name: string; priceInr: number; unit: string; availableOn: string[] }
interface CustomerRow { id: string; name: string; reference: string; email?: string | null; phone?: string | null }
interface MembershipRow {
  id: string; plan: { name: string }; customer: { id: string; name: string };
  includedHours: number; usedHours: number;
}
interface QuoteResponse {
  space: { id: string; name: string; code: string };
  quote: {
    mode: string; chargeableUnits: number; taxPct: number; taxInr: number; totalInr: number;
    coveredByMembership: boolean; discountInr: number;
    lines: { label: string; quantity: number; unitPriceInr: number; amountInr: number }[];
  };
  bookable: boolean; reason?: string | null;
}

/** Row-lettered display labels: two facing rows — A window side, B interior. Small clusters (≤4) stay one row. */
function deskLabels(units: number, cfg: SeatConfig): { n: number; label: string; row: 'A' | 'B' }[] {
  const aCount = units > 4 ? Math.min(Math.ceil(units / 2), 6) : units;
  return Array.from({ length: units }, (_, i) => {
    const n = i + 1;
    const row = n <= aCount ? 'A' : 'B';
    const idx = row === 'A' ? n : n - aCount;
    return { n, row, label: cfg.seatLabels?.[i] ?? `${row}-${idx}` };
  });
}

/** A desk drawn as furniture: label chip, desk top, chair. */
function Desk({
  label, state, premium, premiumNote, onClick,
}: {
  label: string;
  state: 'free' | 'taken' | 'selected' | 'blocked';
  premium: boolean;
  premiumNote?: string;
  onClick: () => void;
}) {
  const deskFace =
    state === 'selected'
      ? { background: 'var(--tone-active-bg)', border: '2.5px solid var(--tone-active)', boxShadow: '0 0 0 4px color-mix(in srgb, var(--tone-active) 18%, transparent), 0 4px 10px rgba(58,47,42,0.14)' }
      : state === 'taken'
        ? {
            background: 'repeating-linear-gradient(45deg, var(--tone-expired-bg), var(--tone-expired-bg) 5px, color-mix(in srgb, var(--tone-expired) 14%, transparent) 5px, color-mix(in srgb, var(--tone-expired) 14%, transparent) 8px)',
            border: '1px solid var(--tone-expired-line)',
          }
        : state === 'blocked'
          ? { background: 'var(--surface-2)', border: '1px solid var(--line)' }
          : { background: 'var(--surface)', border: '2px solid var(--tone-active-line)' };
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={state === 'taken' || state === 'blocked'}
      className="cwdb-desk"
      title={state === 'taken' ? `${label} — taken for this window` : premium ? `${label} — ${premiumNote ?? 'Premium desk'}` : label}
      aria-label={`Desk ${label}, ${state === 'free' ? 'available' : state}`}
      style={{
        display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 0, width: '100%',
        background: 'transparent', border: 'none', padding: 0, font: 'inherit',
        cursor: state === 'free' || state === 'selected' ? 'pointer' : 'not-allowed',
      }}
    >
      <span style={{
        fontSize: 13, fontWeight: 800, background: 'var(--surface)', border: '1px solid var(--line)',
        borderRadius: 7, padding: '4px 13px', marginBottom: 7, color: 'var(--ink)',
        boxShadow: 'var(--shadow-1)',
      }}>{label}</span>
      <span style={{ width: '100%', maxWidth: 118, minWidth: 64, aspectRatio: '5 / 3', borderRadius: 10, position: 'relative', display: 'block', boxShadow: '0 4px 10px rgba(58,47,42,0.14)', ...deskFace }}>
        {state === 'selected' && (
          <Check size={16} style={{ position: 'absolute', top: 5, right: 5, color: 'var(--tone-active)' }} />
        )}
        {premium && state !== 'selected' && (
          <span style={{ position: 'absolute', top: 5, right: 5, width: 8, height: 8, borderRadius: 99, background: 'var(--gold)' }} />
        )}
      </span>
      <span style={{
        width: 54, height: 20, borderRadius: '7px 7px 14px 14px', marginTop: 5,
        background: state === 'taken' || state === 'blocked' ? 'var(--line)' : 'var(--ink-2)', opacity: 0.55, display: 'block',
      }} />
    </button>
  );
}

function Plant() {
  return (
    <svg width="20" height="22" viewBox="0 0 20 22" aria-hidden style={{ alignSelf: 'flex-end', opacity: 0.9 }}>
      <path d="M10 12C10 7 6 5 3 5c0 4 3 7 7 7Zm0 0c0-5 4-7 7-7 0 4-3 7-7 7Z" fill="var(--tone-active)" opacity="0.55" />
      <path d="M10 12v4" stroke="var(--tone-active)" strokeWidth="1.4" />
      <path d="M6.5 16h7l-.8 5h-5.4l-.8-5Z" fill="var(--gold)" opacity="0.7" />
    </svg>
  );
}

export function DeskBookingFlow({
  space, open, onClose, onBack, onBooked,
}: {
  space: DeskSpace | null;
  open: boolean;
  onClose: () => void;
  /** "← Back to spaces" — closes this flow and reopens the picker. */
  onBack: () => void;
  onBooked?: (bookingId: string) => void;
}) {
  const qc = useQueryClient();
  const [step, setStep] = useState(1); // index into STEPS; 0 is done before open
  const [date, setDate] = useState(toDateInput());
  const [arrival, setArrival] = useState('10:00');
  const [durationH, setDurationH] = useState('8');
  const [mode, setMode] = useState('');
  const [recurrence, setRecurrence] = useState('NONE');
  const [recurCount, setRecurCount] = useState('4');
  const [seats, setSeats] = useState<number[]>([]);
  const [zoom, setZoom] = useState(1);
  const [customerId, setCustomerId] = useState('');
  const [contactName, setContactName] = useState('');
  const [contactPhone, setContactPhone] = useState('');
  const [contactEmail, setContactEmail] = useState('');
  const [membershipId, setMembershipId] = useState('');
  const [addOns, setAddOns] = useState<Record<string, number>>({});
  const [discountPct, setDiscountPct] = useState('');
  const [notes, setNotes] = useState('');
  const [payNow, setPayNow] = useState(true);
  const [paymentMethod, setPaymentMethod] = useState('CARD');
  const [createInvoice, setCreateInvoice] = useState(true);
  const [confirmed, setConfirmed] = useState<{ reference: string; invoiceNumber?: string; occurrences?: number } | null>(null);

  useEffect(() => {
    if (!open) return;
    setStep(1); setDate(toDateInput()); setArrival('10:00'); setDurationH('8'); setSeats([]);
    setMode(''); setRecurrence('NONE'); setRecurCount('4');
    setZoom(1); setCustomerId(''); setContactName(''); setContactPhone(''); setContactEmail('');
    setMembershipId(''); setAddOns({}); setDiscountPct(''); setNotes(''); setPayNow(true);
    setPaymentMethod('CARD'); setCreateInvoice(true); setConfirmed(null);
  }, [open, space?.id]);

  const units = space?.units ?? 1;
  const cfg: SeatConfig = (space?.bookingRules as SeatConfig | null) ?? {};
  const labels = useMemo(() => deskLabels(units, cfg), [units, space?.id]); // eslint-disable-line react-hooks/exhaustive-deps
  const labelOf = (n: number) => labels.find((l) => l.n === n)?.label ?? String(n);

  const startAt = date && arrival ? `${date}T${arrival}` : '';
  const endAt = useMemo(() => {
    if (!startAt || !durationH) return '';
    const d = new Date(startAt); d.setHours(d.getHours() + Number(durationH));
    return toLocalInput(d.toISOString());
  }, [startAt, durationH]);
  const windowValid = !!startAt && !!endAt;

  const { data: avail, isLoading: availLoading } = useQuery({
    queryKey: ['cw-window-avail', space?.id, startAt, endAt],
    queryFn: async () => (await api.get<WindowAvailability>('/coworking/availability', {
      params: { spaceId: space!.id, from: new Date(startAt).toISOString(), to: new Date(endAt).toISOString() },
    })).data,
    enabled: open && !!space && windowValid,
  });
  const freeUnits = avail?.spaces?.[0]?.freeUnits ?? null;
  const takenCount = freeUnits == null ? 0 : Math.max(0, units - freeUnits);

  // Window changes redraw the floor; stale picks don't survive it.
  useEffect(() => { setSeats([]); }, [startAt, endAt]);

  const { data: services } = useQuery({
    queryKey: ['cw-services-active'],
    queryFn: async () => (await api.get<{ data: ServiceRow[] }>('/coworking/services', { params: { status: 'ACTIVE', limit: 100 } })).data.data,
    enabled: open && step >= 2,
  });
  const { data: customers } = useQuery({
    queryKey: ['cw-customers-picker'],
    queryFn: async () => (await api.get<{ data: CustomerRow[] }>('/coworking/customers', { params: { limit: 200 } })).data.data,
    enabled: open && step >= 2,
  });
  const { data: memberships } = useQuery({
    queryKey: ['cw-memberships-picker', customerId],
    queryFn: async () => (await api.get<{ data: MembershipRow[] }>('/coworking/memberships', {
      params: { status: 'ACTIVE', limit: 100, ...(customerId ? { customerId } : {}) },
    })).data.data,
    enabled: open && step >= 2,
  });
  const addOnList = useMemo(() => (services ?? []).filter((s) => s.availableOn.includes('BOOKING')), [services]);

  const quotePayload = useMemo(() => {
    if (!space || !windowValid || seats.length === 0) return null;
    return {
      spaceId: space.id,
      startAt: new Date(startAt).toISOString(),
      endAt: new Date(endAt).toISOString(),
      units: seats.length,
      ...(mode ? { mode } : {}),
      ...(membershipId ? { membershipId } : {}),
      addOns: Object.entries(addOns).filter(([, q]) => q > 0).map(([serviceId, quantity]) => ({ serviceId, quantity })),
      ...(discountPct ? { discountPct: Number(discountPct) } : {}),
    };
  }, [space, windowValid, startAt, endAt, seats.length, mode, membershipId, addOns, discountPct]);

  const { data: quote, isFetching: quoting } = useQuery({
    queryKey: ['cw-quote', quotePayload],
    queryFn: async () => (await api.post<QuoteResponse>('/coworking/bookings/quote', quotePayload)).data,
    enabled: open && !!quotePayload,
  });

  const book = useMutation({
    mutationFn: async () => {
      const res = await api.post<{ booking: { id: string; reference: string }; occurrences: number }>('/coworking/bookings', {
        ...quotePayload,
        ...(customerId ? { customerId } : {}),
        contactName: contactName.trim() || undefined,
        contactPhone: contactPhone.trim() || undefined,
        contactEmail: contactEmail.trim() || undefined,
        guests: seats.length,
        notes: [`Desks: ${seats.map(labelOf).join(', ')}`, notes.trim()].filter(Boolean).join(' · '),
        source: 'CONSOLE',
        ...(recurrence !== 'NONE' ? { recurrence, recurrenceRule: { count: Number(recurCount) || 4 } } : {}),
      });
      const booking = res.data.booking;
      let invoiceNumber: string | undefined;
      if (createInvoice && !quote?.quote.coveredByMembership && (quote?.quote.totalInr ?? 0) > 0) {
        const inv = await api.post<{ id: string; number: string; totalInr: number }>(`/coworking/bookings/${booking.id}/invoice`, {});
        invoiceNumber = inv.data.number;
        if (payNow) {
          await api.post(`/coworking/invoices/${inv.data.id}/payments`, {
            amountInr: inv.data.totalInr, method: paymentMethod, reference: `Booking ${booking.reference}`,
          });
        }
      }
      return { bookingId: booking.id, reference: booking.reference, invoiceNumber, occurrences: res.data.occurrences };
    },
    onSuccess: (r) => {
      setConfirmed(r);
      toast.success(r.occurrences > 1 ? `${r.occurrences} bookings confirmed` : `Booking ${r.reference} confirmed`);
      qc.invalidateQueries({ queryKey: ['cw-bookings'] });
      qc.invalidateQueries({ queryKey: ['cw-floor-plan'] });
      qc.invalidateQueries({ queryKey: ['cw-dashboard'] });
      onBooked?.(r.bookingId);
    },
    onError: (e) => toast.error(apiErrorMessage(e)),
  });

  if (!open || !space) return null;

  const toggleSeat = (n: number) => {
    if (freeUnits == null) return;
    setSeats((prev) => prev.includes(n)
      ? prev.filter((x) => x !== n)
      : prev.length < freeUnits ? [...prev, n].sort((a, b) => a - b) : prev);
  };
  const seatState = (n: number): 'free' | 'taken' | 'selected' => {
    if (seats.includes(n)) return 'selected';
    if (n <= takenCount) return 'taken';
    return 'free';
  };

  const canContinue =
    step === 1 ? windowValid && seats.length > 0
      : step === 2 ? (!!customerId || contactName.trim().length > 1)
        : !!quote?.bookable && !book.isPending;

  const ctaLabel =
    step === 1
      ? seats.length === 0 ? 'Select a desk'
        : seats.length === 1 ? `Continue with ${labelOf(seats[0])}` : `Continue with ${seats.length} desks`
      : step === 2 ? 'Continue to review'
        : book.isPending ? 'Confirming…' : 'Confirm & pay';

  const rowA = labels.filter((l) => l.row === 'A');
  const rowB = labels.filter((l) => l.row === 'B');
  const rate = space.hourlyInr != null ? `${money(space.hourlyInr)} / hr` : space.dailyInr != null ? `${money(space.dailyInr)} / day` : '—';

  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 80, background: 'var(--bg)', display: 'flex', flexDirection: 'column' }}>
      {/* ── Progress header ── */}
      <div style={{
        height: 72, background: 'var(--surface)', borderBottom: '1px solid var(--line)',
        display: 'flex', alignItems: 'center', gap: 22, padding: '0 26px', flexShrink: 0,
      }}>
        <span style={{ fontWeight: 800, fontSize: 15, letterSpacing: '-0.015em' }}>
          BMN <span style={{ color: 'var(--ink-3)', fontWeight: 700 }}>| COWORKING</span>
        </span>
        <div style={{ flex: 1, display: 'flex', justifyContent: 'center', gap: 6, alignItems: 'center', flexWrap: 'wrap' }}>
          {STEPS.map((s, i) => {
            const idx = confirmed ? STEPS.length : step;
            const done = i < idx;
            const active = i === idx;
            return (
              <span key={s} style={{ display: 'inline-flex', alignItems: 'center', gap: 7 }}>
                <span style={{
                  width: 30, height: 30, borderRadius: 99, display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
                  fontSize: 13.5, fontWeight: 800,
                  background: done || active ? 'var(--tone-active)' : 'var(--surface-2)',
                  color: done || active ? '#fff' : 'var(--ink-3)',
                }}>{done ? <Check size={15} /> : i + 1}</span>
                <span style={{ fontSize: 14, fontWeight: active ? 800 : 600, color: active ? 'var(--ink)' : done ? 'var(--ink-2)' : 'var(--ink-3)' }}>{s}</span>
                {i < STEPS.length - 1 && <span style={{ color: 'var(--ink-3)', margin: '0 10px' }}>›</span>}
              </span>
            );
          })}
        </div>
        <button className="btn-ghost btn-sm" onClick={onClose} aria-label="Close booking"><X size={16} /></button>
      </div>

      {/* ── Body ── */}
      <div className="cwdb-body" style={{ flex: 1, display: 'flex', gap: 0, minHeight: 0, overflow: 'auto' }}>
        {/* Left — context & schedule */}
        <div className="cwdb-left" style={{ width: 'clamp(320px, 25vw, 400px)', flexShrink: 0, padding: 22, display: 'flex', flexDirection: 'column', gap: 16, overflowY: 'auto' }}>
          <button className="btn-ghost btn-sm" style={{ alignSelf: 'flex-start' }} onClick={onBack}>← Back to spaces</button>

          <div className="ds-card" style={{ padding: 0, overflow: 'hidden' }}>
            {space.coverUrl && (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={space.coverUrl} alt="" style={{ width: '100%', height: 110, objectFit: 'cover', display: 'block' }} />
            )}
            <div style={{ padding: 18 }}>
              <div style={{ fontWeight: 800, fontSize: 17.5 }}>{space.name}</div>
              <div className="ds-caption" style={{ marginTop: 2 }}>
                {space.building ?? 'BMN Connects Tower'}{space.floorName ? ` · ${space.floorName}` : ''}
              </div>
              <div className="ds-caption" style={{ marginTop: 6, display: 'flex', gap: 12 }}>
                <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5 }}><Armchair size={12} /> {units} desks</span>
                <span>{rate}</span>
              </div>
            </div>
          </div>

          <div className="ds-card" style={{ padding: 20, display: 'grid', gap: 14, boxShadow: 'var(--shadow-1)' }}>
            <div style={{ fontWeight: 800, fontSize: 15.5 }}>When are you coming?</div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
              <Field label="Date">
                <input className="input" type="date" value={date} onChange={(e) => setDate(e.target.value)} />
              </Field>
              <Field label="Arrival time">
                <select className="input" value={arrival} onChange={(e) => setArrival(e.target.value)}>
                  {['07:00', '08:00', '09:00', '10:00', '11:00', '12:00', '13:00', '14:00', '15:00', '16:00', '17:00', '18:00'].map((h) => <option key={h} value={h}>{h}</option>)}
                </select>
              </Field>
            </div>
            <Field label="Duration">
              <select className="input" value={durationH} onChange={(e) => setDurationH(e.target.value)}>
                <option value="2">2 hours</option>
                <option value="4">Half day (4h)</option>
                <option value="8">Full day (8h)</option>
                <option value="10">Extended (10h)</option>
              </select>
            </Field>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
              <Field label="Booking type" hint="Automatic follows the length.">
                <select className="input" value={mode} onChange={(e) => setMode(e.target.value)}>
                  <option value="">Automatic</option>
                  <option value="HOURLY">Hourly</option>
                  <option value="HALF_DAY">Half day</option>
                  <option value="FULL_DAY">Full day</option>
                  <option value="DAILY">Daily</option>
                </select>
              </Field>
              <Field label="Repeats">
                <select className="input" value={recurrence} onChange={(e) => setRecurrence(e.target.value)}>
                  <option value="NONE">Does not repeat</option>
                  <option value="DAILY">Daily</option>
                  <option value="WEEKLY">Weekly</option>
                  <option value="MONTHLY">Monthly</option>
                </select>
              </Field>
            </div>
            {recurrence !== 'NONE' && (
              <Field label="Occurrences" hint="Every occurrence is conflict-checked before any is written.">
                <input className="input" type="number" min={2} max={52} value={recurCount} onChange={(e) => setRecurCount(e.target.value)} />
              </Field>
            )}
            {windowValid && <span className="ds-caption">Until {fmtTime(endAt)}</span>}
          </div>

          <div className="ds-card" style={{ padding: 20, display: 'grid', gap: 12, boxShadow: 'var(--shadow-1)' }}>
            {availLoading || freeUnits == null ? (
              <Skeleton rows={1} height={44} />
            ) : (
              <>
                <div style={{ fontSize: 34, fontWeight: 800, letterSpacing: '-0.02em', lineHeight: 1.1 }}>{freeUnits} of {units}<br /><span style={{ fontSize: 18 }}>desks free</span></div>
                <div className="ds-caption" style={{ marginTop: -6 }}>in selected time window</div>
              </>
            )}
            <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
              <span className="ds-caption" style={{ display: 'inline-flex', alignItems: 'center', gap: 5 }}><span style={{ width: 10, height: 10, borderRadius: 3, background: 'var(--tone-active)', display: 'inline-block' }} />Available</span>
              <span className="ds-caption" style={{ display: 'inline-flex', alignItems: 'center', gap: 5 }}><span style={{ width: 10, height: 10, borderRadius: 3, background: 'repeating-linear-gradient(45deg, var(--tone-expired-bg), var(--tone-expired-bg) 3px, var(--tone-expired-line) 3px, var(--tone-expired-line) 5px)', border: '1px solid var(--tone-expired-line)', display: 'inline-block' }} />Taken (booked)</span>
              <span className="ds-caption" style={{ display: 'inline-flex', alignItems: 'center', gap: 5 }}><span style={{ width: 10, height: 10, borderRadius: 3, background: 'var(--surface-2)', border: '1px solid var(--line)', display: 'inline-block' }} />Unavailable</span>
            </div>
          </div>

          <div className="ds-card" style={{ padding: 14, display: 'grid', gap: 8, marginTop: 'auto' }}>
            <div style={{ fontWeight: 700, fontSize: 13 }}>Need help?</div>
            <div className="ds-caption">Our team is here to assist you.</div>
            <a className="btn-ghost btn-sm" href="/coworking/front-desk" style={{ display: 'inline-flex', alignItems: 'center', gap: 7, width: 'fit-content' }}>
              <Headset size={13} /> Contact support
            </a>
          </div>
        </div>

        {/* Center */}
        <div style={{ flex: 1, minWidth: 0, padding: '24px 20px 24px 4px', display: 'flex', flexDirection: 'column', gap: 12, overflowY: 'auto' }}>
          {step === 1 && (
            <>
              <div style={{ display: 'flex', alignItems: 'baseline', gap: 10 }}>
                <h2 className="ds-h1" style={{ margin: 0 }}>Floor map — {space.floorName ?? 'Ground Floor'}</h2>
                <span style={{ marginLeft: 'auto', paddingRight: 12 }} className="ds-caption" title="North">
                  <svg width="20" height="24" viewBox="0 0 20 24"><path d="M10 2 14 16l-4-3-4 3L10 2Z" fill="var(--ink)" opacity="0.75" /><text x="10" y="23" textAnchor="middle" fontSize="8" fill="var(--ink-2)">N</text></svg>
                </span>
              </div>

              {/* The room */}
              <div style={{ position: 'relative', flex: 1, minHeight: 0, display: 'flex' }}>
                <div style={{
                  position: 'relative', margin: '0 auto', maxWidth: 1120, width: '100%', minHeight: 460,
                  display: 'flex', flexDirection: 'column',
                  border: '3px solid var(--ink)', borderRadius: 6, overflow: 'hidden',
                  background: 'repeating-linear-gradient(90deg, transparent 0 84px, rgba(58,47,42,0.05) 84px 86px), linear-gradient(180deg, #f8f1e4 0%, #f2e6d2 100%)',
                  transform: `scale(${zoom})`, transformOrigin: 'top center', transition: 'transform 140ms ease',
                }}>
                  {/* window band */}
                  <div style={{ height: 20, margin: '8px 12px 0', borderRadius: 3, background: 'linear-gradient(90deg, var(--tone-sales-bg), #dff0fb 40%, var(--tone-sales-bg))', border: '1px solid var(--tone-sales-line)', display: 'flex' }}>
                    {Array.from({ length: 8 }, (_, i) => <span key={i} style={{ flex: 1, borderRight: i < 7 ? '1px solid var(--tone-sales-line)' : 'none' }} />)}
                  </div>
                  <div style={{ textAlign: 'center', marginTop: 8 }}>
                    <span style={{ fontSize: 10, fontWeight: 800, letterSpacing: '0.1em', background: 'var(--tone-active-bg)', color: 'var(--tone-active)', border: '1px solid var(--tone-active-line)', borderRadius: 999, padding: '3px 12px' }}>
                      {(cfg.orientationTop ?? 'WINDOW SIDE').toUpperCase()}
                    </span>
                  </div>

                  {/* storage room in the top-left corner, with the entrance door swinging in below it */}
                  <div aria-hidden style={{
                    position: 'absolute', left: 10, top: 36, width: 100, height: 92, zIndex: 1,
                    background: 'var(--surface-2)', border: '2px solid var(--ink-2)', borderRadius: 2, opacity: 0.9,
                  }} />
                  <span aria-hidden style={{
                    position: 'absolute', left: 10, top: 134, width: 36, height: 36, opacity: 0.55,
                    borderRight: '2px solid var(--ink-2)', borderTop: '2px solid var(--ink-2)', borderRadius: '0 36px 0 0',
                  }} />

                  {/* entrance side pill */}
                  <span style={{
                    position: 'absolute', left: 8, top: '46%', transform: 'rotate(180deg)', writingMode: 'vertical-rl',
                    fontSize: 9.5, fontWeight: 800, letterSpacing: '0.1em', background: 'var(--tone-expired-bg)',
                    color: 'var(--tone-expired)', border: '1px solid var(--tone-expired-line)', borderRadius: 999, padding: '10px 3px', zIndex: 2,
                  }}>{(cfg.orientationBottom ?? 'ENTRANCE SIDE').toUpperCase()}</span>

                  {/* rows */}
                  <div style={{ padding: '18px 48px 92px', display: 'grid', gap: 4, flex: 1, alignContent: 'center' }}>
                    <div style={{ display: 'flex', justifyContent: 'center', gap: 'clamp(10px, 1.5vw, 24px)', alignItems: 'flex-end', flexWrap: 'nowrap' }}>
                      <Plant />
                      {rowA.map((l) => (
                        <span key={l.n} style={{ position: 'relative', flex: '0 1 140px', minWidth: 76, display: 'flex', justifyContent: 'center' }}>
                          <Desk
                            label={l.label} premium={cfg.premiumSeats?.includes(l.n) ?? false} premiumNote={cfg.premiumNote}
                            state={seatState(l.n)} onClick={() => toggleSeat(l.n)}
                          />
                          {seats.length > 0 && seats[0] === l.n && (
                            <span style={{
                              position: 'absolute', top: '100%', left: '50%', transform: 'translateX(-50%)', marginTop: 6,
                              background: 'var(--tone-active)', color: '#fff', borderRadius: 9, padding: '6px 13px',
                              fontSize: 11, fontWeight: 700, whiteSpace: 'nowrap', zIndex: 3, boxShadow: 'var(--shadow-2)',
                              textAlign: 'center', lineHeight: 1.35,
                            }}>You selected<br /><span style={{ fontSize: 13, fontWeight: 800 }}>{seats.map(labelOf).join(', ')}</span></span>
                          )}
                        </span>
                      ))}
                      <Plant />
                    </div>

                    <div style={{ textAlign: 'center', fontWeight: 800, fontSize: 23, letterSpacing: '-0.01em', color: 'var(--ink)', margin: '16px 0 10px' }}>{space.name}</div>

                    {rowB.length > 0 && (
                      <div style={{ display: 'flex', justifyContent: 'center', gap: 'clamp(10px, 1.5vw, 24px)', alignItems: 'flex-end', flexWrap: 'nowrap' }}>
                        <Plant />
                        {rowB.map((l) => (
                          <span key={l.n} style={{ position: 'relative', flex: '0 1 140px', minWidth: 76, display: 'flex', justifyContent: 'center' }}>
                            <Desk
                              label={l.label} premium={cfg.premiumSeats?.includes(l.n) ?? false} premiumNote={cfg.premiumNote}
                              state={seatState(l.n)} onClick={() => toggleSeat(l.n)}
                            />
                            {seats.length > 0 && seats[0] === l.n && (
                              <span style={{
                                position: 'absolute', top: '100%', left: '50%', transform: 'translateX(-50%)', marginTop: 6,
                                background: 'var(--tone-active)', color: '#fff', borderRadius: 8, padding: '5px 10px',
                                fontSize: 11, fontWeight: 700, whiteSpace: 'nowrap', zIndex: 3, boxShadow: 'var(--shadow-2)',
                              }}>You selected {seats.map(labelOf).join(', ')}</span>
                            )}
                          </span>
                        ))}
                        <Plant />
                      </div>
                    )}
                  </div>

                  <div style={{ textAlign: 'center', paddingBottom: 12 }}>
                    <span style={{ fontSize: 10, fontWeight: 800, letterSpacing: '0.1em', background: 'var(--tone-claim-bg)', color: 'var(--tone-claim)', border: '1px solid var(--tone-claim-line)', borderRadius: 999, padding: '3px 12px' }}>
                      INTERIOR SIDE
                    </span>
                  </div>

                  {/* floating legend — inside the floor, lower-left */}
                  <div className="ds-card" style={{ position: 'absolute', left: 14, bottom: 14, padding: '12px 14px', display: 'grid', gap: 7, boxShadow: 'var(--e-float)', zIndex: 4 }}>
                    <span className="ds-caption" style={{ fontWeight: 800 }}>Legend</span>
                    <span className="ds-caption" style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}><span style={{ width: 12, height: 12, borderRadius: 3, background: 'var(--surface)', border: '2px solid var(--tone-active-line)' }} />Available</span>
                    <span className="ds-caption" style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}><span style={{ width: 12, height: 12, borderRadius: 3, background: 'repeating-linear-gradient(45deg, var(--tone-expired-bg), var(--tone-expired-bg) 3px, var(--tone-expired-line) 3px, var(--tone-expired-line) 5px)' }} />Taken (booked)</span>
                    <span className="ds-caption" style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}><span style={{ width: 12, height: 12, borderRadius: 3, background: 'var(--surface-2)', border: '1px solid var(--line)' }} />Unavailable</span>
                    <span className="ds-caption" style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}><span style={{ width: 12, height: 12, borderRadius: 3, background: 'var(--tone-active-bg)', border: '2px solid var(--tone-active)' }} />Selected</span>
                  </div>

                  {/* zoom — inside the floor, lower-right */}
                  <div style={{ position: 'absolute', right: 14, bottom: 14, display: 'grid', gap: 6, zIndex: 4 }}>
                    <button className="btn-ghost btn-sm ds-card" style={{ padding: 9 }} aria-label="Zoom in" onClick={() => setZoom((z) => Math.min(1.3, +(z + 0.1).toFixed(2)))}><Plus size={15} /></button>
                    <button className="btn-ghost btn-sm ds-card" style={{ padding: 9 }} aria-label="Zoom out" onClick={() => setZoom((z) => Math.max(0.7, +(z - 0.1).toFixed(2)))}><Minus size={15} /></button>
                    <button className="btn-ghost btn-sm ds-card" style={{ padding: 9 }} aria-label="Fit to view" title="Fit to view" onClick={() => setZoom(1)}><Maximize2 size={15} /></button>
                  </div>

                  {/* door arc */}
                  <span style={{ position: 'absolute', right: -3, bottom: 60, width: 46, height: 46, borderLeft: '2px solid var(--ink-2)', borderBottom: '2px solid var(--ink-2)', borderRadius: '0 0 0 46px', opacity: 0.5 }} />
                </div>

              </div>

              <div className="ds-caption" style={{ textAlign: 'center' }}>
                Tip: desks are taken in order from {labels[0]?.label ?? 'A-1'} onwards in this area — your pick is noted for the front desk.
              </div>
            </>
          )}

          {step === 2 && (
            <div style={{ maxWidth: 840, width: '100%', margin: '0 auto', display: 'grid', gap: 20 }}>
              <h2 className="ds-h1" style={{ margin: 0 }}>Your details</h2>

              <div className="ds-card" style={{ padding: 20, display: 'grid', gap: 16, boxShadow: 'var(--shadow-1)' }}>
                <div style={{ fontWeight: 800, fontSize: 15.5 }}>Booking for</div>
                <Field label="Existing customer" hint="Leave blank for a walk-in and fill in the contact below.">
                  <select className="input" value={customerId} onChange={(e) => {
                    setCustomerId(e.target.value);
                    const c = customers?.find((x) => x.id === e.target.value);
                    if (c) { setContactName(c.name); setContactPhone(c.phone ?? ''); setContactEmail(c.email ?? ''); }
                    setMembershipId('');
                  }}>
                    <option value="">Walk-in / new contact</option>
                    {(customers ?? []).map((c) => <option key={c.id} value={c.id}>{c.name} ({c.reference})</option>)}
                  </select>
                </Field>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(200px,1fr))', gap: 14 }}>
                  <Field label="Contact name" required>
                    <input className="input" value={contactName} onChange={(e) => setContactName(e.target.value)} placeholder="Who is the booking for?" />
                  </Field>
                  <Field label="Phone"><input className="input" value={contactPhone} onChange={(e) => setContactPhone(e.target.value)} /></Field>
                  <Field label="Email"><input className="input" type="email" value={contactEmail} onChange={(e) => setContactEmail(e.target.value)} /></Field>
                </div>
              </div>

              <div className="ds-card" style={{ padding: 20, display: 'grid', gap: 12, boxShadow: 'var(--shadow-1)' }}>
                <div style={{ fontWeight: 800, fontSize: 15.5 }}>Membership</div>
                <Field label="Book against a membership" hint="Included hours are used before anything is charged — the total updates on the next step.">
                  <select className="input" value={membershipId} onChange={(e) => setMembershipId(e.target.value)}>
                    <option value="">No membership — pay as you go</option>
                    {(memberships ?? []).map((m) => (
                      <option key={m.id} value={m.id}>{m.customer.name} · {m.plan.name} ({Math.max(0, m.includedHours - m.usedHours)}h left)</option>
                    ))}
                  </select>
                </Field>
              </div>

              {addOnList.length > 0 && (
                <div className="ds-card" style={{ padding: 20, display: 'grid', gap: 12, boxShadow: 'var(--shadow-1)' }}>
                  <div style={{ display: 'flex', alignItems: 'baseline', gap: 8 }}>
                    <span style={{ fontWeight: 800, fontSize: 15.5 }}>Add-ons</span>
                    <span className="ds-caption">optional</span>
                  </div>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(220px,1fr))', gap: 10 }}>
                    {addOnList.map((sv) => {
                      const qty = addOns[sv.id] ?? 0;
                      const setQty = (n: number) => setAddOns((a) => ({ ...a, [sv.id]: Math.max(0, Math.min(99, n)) }));
                      return (
                        <div key={sv.id} style={{
                          display: 'flex', alignItems: 'center', gap: 10, padding: '10px 12px',
                          borderRadius: 'var(--r-control)',
                          border: qty > 0 ? '1.5px solid var(--tone-active)' : '1px solid var(--line-soft)',
                          background: qty > 0 ? 'var(--tone-active-bg)' : 'var(--surface)',
                        }}>
                          <div style={{ minWidth: 0, flex: 1 }}>
                            <div style={{ fontSize: 13.5, fontWeight: 650 }}>{sv.name}</div>
                            <div className="ds-caption">{money(sv.priceInr)} · {humanStatus(sv.unit)}</div>
                          </div>
                          <div style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
                            <button type="button" className="btn-ghost btn-sm" aria-label={`Fewer ${sv.name}`} style={{ padding: '4px 8px' }} onClick={() => setQty(qty - 1)} disabled={qty === 0}><Minus size={13} /></button>
                            <span style={{ width: 20, textAlign: 'center', fontWeight: 700, fontSize: 13.5 }}>{qty}</span>
                            <button type="button" className="btn-ghost btn-sm" aria-label={`More ${sv.name}`} style={{ padding: '4px 8px' }} onClick={() => setQty(qty + 1)}><Plus size={13} /></button>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              <div className="ds-card" style={{ padding: 20, display: 'grid', gap: 12, boxShadow: 'var(--shadow-1)' }}>
                <div style={{ fontWeight: 800, fontSize: 15.5 }}>Additional information</div>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(200px,1fr))', gap: 14 }}>
                  <Field label="Discount %"><input className="input" type="number" min={0} max={100} value={discountPct} onChange={(e) => setDiscountPct(e.target.value)} /></Field>
                  <Field label="Notes"><input className="input" value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Anything the front desk should know" /></Field>
                </div>
              </div>
            </div>
          )}

          {step === 3 && (
            <div style={{ maxWidth: 800, width: '100%', margin: '0 auto', display: 'grid', gap: 18 }}>
              <h2 className="ds-h1" style={{ margin: 0 }}>{confirmed ? 'Booking confirmed' : 'Review & pay'}</h2>
              {!confirmed && (
                <div className="ds-card" style={{ padding: 18, boxShadow: 'var(--shadow-1)' }}>
                  <DetailGrid>
                    <Detail label="Space" value={space.name} />
                    <Detail label="Desk" value={seats.map(labelOf).join(', ') || '—'} />
                    <Detail label="When" value={`${fmtDate(startAt)} · ${fmtTime(startAt)}–${fmtTime(endAt)}`} />
                    <Detail label="Customer" value={contactName || '—'} />
                  </DetailGrid>
                  {recurrence !== 'NONE' && (
                    <div className="ds-caption" style={{ marginTop: 10 }}>
                      Repeats {humanStatus(recurrence).toLowerCase()} — this will create {recurCount} bookings, each conflict-checked before any is written.
                    </div>
                  )}
                </div>
              )}
              {confirmed ? (
                <div className="ds-card" style={{ padding: 24, display: 'grid', gap: 14, justifyItems: 'center', textAlign: 'center' }}>
                  <span style={{ width: 52, height: 52, borderRadius: 99, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', background: 'var(--tone-active-bg)', color: 'var(--tone-active)' }}><Check size={24} /></span>
                  <div className="ds-h2">{confirmed.reference}</div>
                  <DetailGrid>
                    <Detail label="Desks" value={seats.map(labelOf).join(', ')} />
                    <Detail label="When" value={`${fmtDate(startAt)} ${fmtTime(startAt)}–${fmtTime(endAt)}`} />
                    {(confirmed.occurrences ?? 1) > 1 && <Detail label="Series" value={`${confirmed.occurrences} bookings, ${humanStatus(recurrence).toLowerCase()}`} />}
                    <Detail label="Invoice" value={confirmed.invoiceNumber ?? 'Not raised'} />
                    <Detail label="Payment" value={confirmed.invoiceNumber && payNow ? `Paid by ${humanStatus(paymentMethod)}` : 'Outstanding'} />
                  </DetailGrid>
                  <button className="btn-primary" onClick={onClose} style={{ background: 'var(--tone-active)', borderColor: 'var(--tone-active)' }}>Done</button>
                </div>
              ) : (
                <>
                  {quoting && <Skeleton rows={2} height={44} />}
                  {quote && !quote.bookable && (
                    <div className="ds-card" style={{ padding: 14, display: 'flex', gap: 10, borderColor: 'var(--tone-expired-line)' }}>
                      <AlertTriangle size={16} style={{ color: 'var(--tone-expired)', flex: 'none' }} />
                      <div className="ds-caption">{quote.reason ?? 'This slot can no longer be booked — go back and pick another.'}</div>
                    </div>
                  )}
                  {quote && (
                    <div className="ds-card" style={{ padding: 18, display: 'grid', gap: 14 }}>
                      <table className="ds-table">
                        <tbody>
                          {quote.quote.lines.map((l, i) => (
                            <tr key={i}><td>{l.label}</td><td className="ds-col-num">{l.quantity}</td><td className="ds-col-num">{money(l.amountInr)}</td></tr>
                          ))}
                          {quote.quote.discountInr > 0 && <tr><td colSpan={2}>Discount</td><td className="ds-col-num">−{money(quote.quote.discountInr)}</td></tr>}
                          <tr><td colSpan={2}>VAT ({quote.quote.taxPct}%)</td><td className="ds-col-num">{money(quote.quote.taxInr)}</td></tr>
                          <tr><td colSpan={2} style={{ fontWeight: 800, fontSize: 15 }}>Total (incl. VAT)</td><td className="ds-col-num" style={{ fontWeight: 800, fontSize: 20, color: 'var(--tone-active)' }}>{money(quote.quote.totalInr)}</td></tr>
                        </tbody>
                      </table>
                      {quote.quote.coveredByMembership ? (
                        <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
                          <Badge tone="active">Covered</Badge>
                          <span className="ds-caption">Comes out of the membership allowance — nothing to collect.</span>
                        </div>
                      ) : (
                        <>
                          <label style={{ display: 'flex', gap: 10, alignItems: 'center', fontSize: 13.5 }}>
                            <input type="checkbox" checked={createInvoice} onChange={(e) => setCreateInvoice(e.target.checked)} />
                            <Receipt size={15} style={{ color: 'var(--ink-3)' }} /> Raise an invoice for {money(quote.quote.totalInr)}
                          </label>
                          <label style={{ display: 'flex', gap: 10, alignItems: 'center', fontSize: 13.5, opacity: createInvoice ? 1 : 0.5 }}>
                            <input type="checkbox" checked={payNow} disabled={!createInvoice} onChange={(e) => setPayNow(e.target.checked)} />
                            <CreditCard size={15} style={{ color: 'var(--ink-3)' }} /> Record payment in full now
                          </label>
                          {createInvoice && payNow && (
                            <Field label="Payment method">
                              <select className="input" style={{ maxWidth: 200 }} value={paymentMethod} onChange={(e) => setPaymentMethod(e.target.value)}>
                                {['CASH', 'CARD', 'BANK', 'ONLINE', 'CHEQUE'].map((m) => <option key={m} value={m}>{humanStatus(m)}</option>)}
                              </select>
                            </Field>
                          )}
                        </>
                      )}
                    </div>
                  )}
                </>
              )}
            </div>
          )}
        </div>

        {/* Right — selection & money */}
        <div className="cwdb-right" style={{ width: 'clamp(320px, 23vw, 384px)', flexShrink: 0, padding: 22, display: 'flex', flexDirection: 'column', gap: 16, overflowY: 'auto' }}>
          <div className="ds-card" style={{ padding: 18, display: 'grid', gap: 12, boxShadow: 'var(--shadow-1)' }}>
            <div style={{ fontWeight: 800, fontSize: 15.5 }}>Selected desk{seats.length > 1 ? 's' : ''}</div>
            {seats.length === 0 ? (
              <EmptyState compact icon={Armchair} title="No desk selected" body="Pick a free desk on the floor map to continue." />
            ) : (
              <div style={{ background: 'var(--tone-active-bg)', border: '1px solid var(--tone-active-line)', borderRadius: 'var(--r-card)', padding: 20, display: 'flex', gap: 14, alignItems: 'center' }}>
                <span style={{ width: 52, height: 52, borderRadius: 13, background: 'var(--surface)', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', color: 'var(--tone-active)' }}><Armchair size={22} /></span>
                <div>
                  <div style={{ fontWeight: 800, fontSize: 26, letterSpacing: '-0.01em' }}>{seats.map(labelOf).join(', ')}</div>
                  <div className="ds-caption">{space.name}</div>
                  <div className="ds-caption">{space.floorName ?? 'Ground Floor'}</div>
                </div>
              </div>
            )}
          </div>

          <div className="ds-card" style={{ padding: 18, display: 'grid', gap: 10, boxShadow: 'var(--shadow-1)' }}>
            <div style={{ fontWeight: 800, fontSize: 15.5 }}>Booking summary</div>
            <div style={{ display: 'grid', gap: 13, fontSize: 14 }}>
              <span style={{ display: 'flex', justifyContent: 'space-between' }}><span className="ds-caption">Date</span><span style={{ fontWeight: 600 }}>{date ? fmtDate(`${date}T00:00`) : '—'}</span></span>
              <span style={{ display: 'flex', justifyContent: 'space-between' }}><span className="ds-caption">Arrival</span><span style={{ fontWeight: 600 }}>{startAt ? fmtTime(startAt) : '—'}</span></span>
              <span style={{ display: 'flex', justifyContent: 'space-between' }}><span className="ds-caption">Duration</span><span style={{ fontWeight: 600 }}>{durationH} hours</span></span>
              <span style={{ display: 'flex', justifyContent: 'space-between' }}><span className="ds-caption">Desk</span><span style={{ fontWeight: 600 }}>{seats.length ? seats.map(labelOf).join(', ') : '—'}</span></span>
              <span style={{ display: 'flex', justifyContent: 'space-between' }}><span className="ds-caption">Rate</span><span style={{ fontWeight: 600 }}>{rate}</span></span>
            </div>
            <div style={{ borderTop: '1px solid var(--line)', paddingTop: 12, marginTop: 2, display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
              <span style={{ fontWeight: 800, fontSize: 14.5 }}>Total <span className="ds-caption">(incl. VAT)</span></span>
              <span style={{ fontWeight: 800, fontSize: 24, color: 'var(--tone-active)' }}>{quote ? money(quote.quote.totalInr) : '—'}</span>
            </div>
          </div>

          <div className="ds-card" style={{ padding: 14, display: 'flex', gap: 10, alignItems: 'flex-start', background: 'var(--tone-active-bg)', borderColor: 'var(--tone-active-line)' }}>
            <Check size={15} style={{ color: 'var(--tone-active)', flex: 'none', marginTop: 1 }} />
            <span className="ds-caption" style={{ color: 'var(--ink)' }}>
              Availability is confirmed at checkout — the desk count is held for your whole window once you confirm.
            </span>
          </div>

          <div style={{ marginTop: 'auto', display: 'grid', gap: 8 }}>
            {!confirmed && (
              <button
                className="btn-primary"
                style={{ background: 'var(--tone-active)', borderColor: 'var(--tone-active)', padding: '19px 16px', fontSize: 16, fontWeight: 800, width: '100%', opacity: canContinue ? 1 : 0.5, cursor: canContinue ? 'pointer' : 'not-allowed' }}
                disabled={!canContinue}
                onClick={() => (step < 3 ? setStep((s) => s + 1) : book.mutate())}
              >
                {ctaLabel}
              </button>
            )}
            {step > 1 && !confirmed && (
              <button className="btn-ghost btn-sm" onClick={() => setStep((s) => s - 1)}>Back</button>
            )}
            <span className="ds-caption" style={{ display: 'inline-flex', alignItems: 'center', gap: 6, justifyContent: 'center' }}>
              <Lock size={11} /> Secure booking. You can review your details next.
            </span>
          </div>
        </div>
      </div>

      <style jsx>{`
        :global(.cwdb-desk) { transition: transform 130ms ease; }
        :global(.cwdb-desk:focus-visible) { outline: 2px solid var(--tone-active); outline-offset: 3px; border-radius: 8px; }
        :global(.cwdb-desk:hover:not(:disabled)) { transform: translateY(-2px); }
        @media (max-width: 980px) {
          .cwdb-body { flex-direction: column; overflow-y: auto; }
          .cwdb-left, .cwdb-right { width: 100% !important; overflow-y: visible !important; }
        }
      `}</style>
    </div>
  );
}
