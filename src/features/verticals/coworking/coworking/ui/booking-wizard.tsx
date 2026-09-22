'use client';

/**
 * The booking flow, end to end.
 *
 *   Space → Availability → Date/Time → Customer → Membership/Type → Add-ons
 *         → Discount → Tax → Review → Payment → Confirmation → Invoice
 *
 * Two things it will not do. It will not price anything itself — every figure
 * comes from POST /coworking/bookings/quote, so the number on the review step is
 * the number the server will charge. And it will not offer a slot the server
 * would refuse: the grid is drawn from the same availability endpoint the write
 * checks against, and the quote step re-checks before "Confirm" is enabled.
 */

import { useEffect, useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { AlertTriangle, Check, CreditCard, Receipt } from 'lucide-react';
import { api, apiErrorMessage } from '@/lib/api';
import { Badge, EmptyState, Field, Modal, Skeleton, Stepper, humanStatus } from './kit';
import { BOOKING_MODES } from './tone';
import { Detail, DetailGrid, fmtDate, fmtTime, money, toDateInput, toLocalInput } from './common';

const STEPS = ['Schedule', 'Details', 'Review', 'Payment'];
/** Desk-type spaces get one extra step: after the window is known, the exact
 *  desk is chosen on a seat map. Availability is per-window (freeUnits from
 *  the availability endpoint); the engine books unit COUNTS, so the chosen
 *  desk codes ride on the booking note for the front desk while capacity is
 *  what the server enforces. */
const SEAT_STEPS = ['Choose desk', 'Details', 'Review', 'Payment'];
const SEAT_TYPES = new Set(['HOT_DESK', 'DEDICATED_DESK']);

interface SeatConfig {
  seatLabels?: string[];
  premiumSeats?: number[]; // 1-based seat numbers
  premiumNote?: string;
  orientationTop?: string; // e.g. "Window · natural light"
  orientationBottom?: string; // e.g. "Entrance"
}

interface WindowAvailability {
  spaces: { id: string; units: number; freeUnits?: number; available: boolean; reason?: string | null }[];
}

interface SlotRow { start: string; end: string; available: boolean }
interface SlotResponse {
  spaceId: string; date: string; slotMinutes: number;
  openWindows: { start: string; end: string }[];
  busy: { start: string; end: string; reason: string }[];
  slots: SlotRow[];
}
interface ServiceRow { id: string; name: string; priceInr: number; unit: string; availableOn: string[]; status: string }
interface CustomerRow { id: string; name: string; reference: string; email?: string | null; phone?: string | null }
interface MembershipRow {
  id: string; reference: string; status: string; endDate: string;
  plan: { id: string; name: string }; customer: { id: string; name: string };
  includedHours: number; usedHours: number;
}
interface QuoteResponse {
  space: { id: string; name: string; code: string; type: string; capacity: number };
  quote: {
    mode: string; hours: number; chargeableUnits: number; rateInr: number;
    baseInr: number; addOnsInr: number; discountInr: number; taxPct: number; taxInr: number; totalInr: number;
    coveredHours: number; coveredDays: number; coveredByMembership: boolean;
    lines: { label: string; quantity: number; unitPriceInr: number; amountInr: number }[];
    error?: string;
  };
  bookable: boolean; reason?: string | null; reasonCode?: string | null;
  membership?: { id: string; reference: string; hoursLeft: number; daysLeft: number } | null;
}

export interface BookingWizardSpace {
  id: string; name: string; code: string; type: string; capacity: number;
  units?: number; zone?: string | null;
  bookingRules?: Record<string, unknown> | null;
  hourlyInr?: number | null; halfDayInr?: number | null; dailyInr?: number | null;
  weeklyInr?: number | null; monthlyInr?: number | null;
}

export function BookingWizard({
  space, open, onClose, onBooked,
}: {
  space: BookingWizardSpace | null;
  open: boolean;
  onClose: () => void;
  onBooked?: (bookingId: string) => void;
}) {
  const qc = useQueryClient();
  const [step, setStep] = useState(0);
  const [seats, setSeats] = useState<number[]>([]); // 1-based seat numbers
  const [date, setDate] = useState(toDateInput());
  const [startAt, setStartAt] = useState('');
  const [endAt, setEndAt] = useState('');
  const [mode, setMode] = useState('');
  const [customerId, setCustomerId] = useState('');
  const [contactName, setContactName] = useState('');
  const [contactPhone, setContactPhone] = useState('');
  const [contactEmail, setContactEmail] = useState('');
  const [membershipId, setMembershipId] = useState('');
  const [guests, setGuests] = useState(1);
  const [addOns, setAddOns] = useState<Record<string, number>>({});
  const [discountPct, setDiscountPct] = useState('');
  const [discountInr, setDiscountInr] = useState('');
  const [recurrence, setRecurrence] = useState('NONE');
  const [recurCount, setRecurCount] = useState('4');
  const [notes, setNotes] = useState('');
  const [payNow, setPayNow] = useState(true);
  const [paymentMethod, setPaymentMethod] = useState('CARD');
  const [createInvoice, setCreateInvoice] = useState(true);
  const [confirmed, setConfirmed] = useState<{ bookingId: string; reference: string; invoiceNumber?: string } | null>(null);

  // A fresh wizard every time: leftover state from the last booking is how a
  // walk-in ends up charged to the previous customer.
  useEffect(() => {
    if (!open) return;
    setStep(0); setDate(toDateInput()); setStartAt(''); setEndAt(''); setMode('');
    setCustomerId(''); setContactName(''); setContactPhone(''); setContactEmail('');
    setMembershipId(''); setGuests(1); setAddOns({}); setDiscountPct(''); setDiscountInr('');
    setRecurrence('NONE'); setRecurCount('4'); setNotes(''); setPayNow(true);
    setPaymentMethod('CARD'); setCreateInvoice(true); setConfirmed(null); setSeats([]);
  }, [open, space?.id]);

  const units = space?.units ?? 1;
  const seatMap = !!space && SEAT_TYPES.has(space.type) && units > 1;
  const steps = seatMap ? SEAT_STEPS : STEPS;
  const stepKey = steps[step];
  const seatCfg: SeatConfig = (space?.bookingRules as SeatConfig | null) ?? {};
  const seatLabel = (n: number) => seatCfg.seatLabels?.[n - 1] ?? `${space?.code ?? 'D'}-${String(n).padStart(2, '0')}`;

  // Free desks for the chosen window — the availability endpoint's freeUnits,
  // which weighs every overlapping booking at the busiest instant.
  const windowValid = !!startAt && !!endAt && new Date(endAt) > new Date(startAt);
  const { data: windowAvail, isLoading: availLoading } = useQuery({
    queryKey: ['cw-window-avail', space?.id, startAt, endAt],
    queryFn: async () => (await api.get<WindowAvailability>('/coworking/availability', {
      params: { spaceId: space!.id, from: new Date(startAt).toISOString(), to: new Date(endAt).toISOString() },
    })).data,
    enabled: open && seatMap && windowValid && stepKey === 'Choose desk',
  });
  const freeUnits = windowAvail?.spaces?.[0]?.freeUnits ?? null;

  const { data: slots, isLoading: slotsLoading } = useQuery({
    queryKey: ['cw-slots', space?.id, date],
    queryFn: async () => (await api.get<SlotResponse>(`/coworking/spaces/${space!.id}/slots`, { params: { date, slotMinutes: 60 } })).data,
    enabled: open && !!space?.id && !!date,
  });

  const { data: services } = useQuery({
    queryKey: ['cw-services-active'],
    queryFn: async () => (await api.get<{ data: ServiceRow[] }>('/coworking/services', { params: { status: 'ACTIVE', limit: 100 } })).data.data,
    enabled: open,
  });

  const { data: customers } = useQuery({
    queryKey: ['cw-customers-picker'],
    queryFn: async () => (await api.get<{ data: CustomerRow[] }>('/coworking/customers', { params: { limit: 200 } })).data.data,
    enabled: open,
  });

  const { data: memberships } = useQuery({
    queryKey: ['cw-memberships-picker', customerId],
    queryFn: async () => (await api.get<{ data: MembershipRow[] }>('/coworking/memberships', {
      params: { status: 'ACTIVE', limit: 100, ...(customerId ? { customerId } : {}) },
    })).data.data,
    enabled: open && step >= steps.indexOf('Details'),
  });

  const addOnList = useMemo(
    () => (services ?? []).filter((s) => s.availableOn.includes('BOOKING')),
    [services],
  );

  const quotePayload = useMemo(() => {
    if (!space || !startAt || !endAt) return null;
    return {
      spaceId: space.id,
      startAt: new Date(startAt).toISOString(),
      endAt: new Date(endAt).toISOString(),
      ...(mode ? { mode } : {}),
      ...(seatMap && seats.length ? { units: seats.length } : {}),
      ...(membershipId ? { membershipId } : {}),
      addOns: Object.entries(addOns).filter(([, q]) => q > 0).map(([serviceId, quantity]) => ({ serviceId, quantity })),
      ...(discountPct ? { discountPct: Number(discountPct) } : {}),
      ...(discountInr ? { discountInr: Number(discountInr) } : {}),
    };
  }, [space, startAt, endAt, mode, membershipId, addOns, discountPct, discountInr, seatMap, seats.length]);

  const { data: quote, isFetching: quoting } = useQuery({
    queryKey: ['cw-quote', quotePayload],
    queryFn: async () => (await api.post<QuoteResponse>('/coworking/bookings/quote', quotePayload)).data,
    enabled: open && !!quotePayload && step >= steps.indexOf('Review') - 1,
  });

  const book = useMutation({
    mutationFn: async () => {
      const res = await api.post<{ booking: { id: string; reference: string }; occurrences: number }>('/coworking/bookings', {
        ...quotePayload,
        ...(customerId ? { customerId } : {}),
        contactName: contactName.trim() || undefined,
        contactPhone: contactPhone.trim() || undefined,
        contactEmail: contactEmail.trim() || undefined,
        guests,
        notes: [seatMap && seats.length ? `Desks: ${seats.map(seatLabel).join(', ')}` : '', notes.trim()]
          .filter(Boolean).join(' · ') || undefined,
        source: 'CONSOLE',
        ...(recurrence !== 'NONE' ? { recurrence, recurrenceRule: { count: Number(recurCount) || 4 } } : {}),
      });
      const booking = res.data.booking;

      let invoiceNumber: string | undefined;
      // A membership-covered booking has nothing to invoice, so asking for one
      // would fail — the flow simply skips the step rather than showing an error.
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

  if (!space) return null;

  const pickSlot = (slot: SlotRow) => {
    setStartAt(toLocalInput(slot.start));
    setEndAt(toLocalInput(slot.end));
  };

  const canAdvance = () => {
    if (stepKey === 'Schedule') return windowValid;
    if (stepKey === 'Choose desk') return windowValid && seats.length > 0;
    if (stepKey === 'Details') return !!customerId || contactName.trim().length > 1;
    if (stepKey === 'Review') return !!quote?.bookable;
    return true;
  };

  const footer = confirmed ? (
    <>
      <button className="btn-ghost" onClick={onClose}>Close</button>
      <button className="btn-primary" style={{ marginLeft: 'auto' }} onClick={onClose}>Done</button>
    </>
  ) : (
    <>
      <button className="btn-ghost" onClick={step === 0 ? onClose : () => setStep((s) => s - 1)}>
        {step === 0 ? 'Cancel' : 'Back'}
      </button>
      <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 12 }}>
        {quote && step >= steps.indexOf('Review') && (
          <span style={{ fontSize: 14, fontWeight: 700 }}>
            {quote.quote.coveredByMembership ? 'Covered by membership' : money(quote.quote.totalInr)}
          </span>
        )}
        {step < steps.length - 1 ? (
          <button className="btn-primary" disabled={!canAdvance()} onClick={() => setStep((s) => s + 1)}>
            {stepKey === 'Choose desk' && seats.length > 0
              ? (seats.length === 1 ? `Continue with ${seatLabel(seats[0])}` : `Continue with ${seats.length} desks`)
              : 'Continue'}
          </button>
        ) : (
          <button className="btn-primary" disabled={!quote?.bookable || book.isPending} onClick={() => book.mutate()}>
            {book.isPending ? 'Confirming…' : 'Confirm booking'}
          </button>
        )}
      </div>
    </>
  );

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={confirmed ? 'Booking confirmed' : `Book ${space.name}`}
      subtitle={confirmed ? undefined : `${space.code} · seats ${space.capacity}`}
      width={880}
      footer={footer}
    >
      {confirmed ? (
        <div style={{ display: 'grid', gap: 18, justifyItems: 'center', textAlign: 'center', padding: '18px 0' }}>
          <span style={{
            width: 54, height: 54, borderRadius: '50%', display: 'inline-flex', alignItems: 'center',
            justifyContent: 'center', background: 'var(--tone-active-bg)', color: 'var(--tone-active)',
          }}><Check size={26} /></span>
          <div>
            <div className="ds-h2">{confirmed.reference}</div>
            <div className="ds-caption" style={{ marginTop: 4 }}>
              {space.name} · {fmtDate(startAt)} {fmtTime(startAt)}–{fmtTime(endAt)}
            </div>
          </div>
          <DetailGrid>
            <Detail label="Customer" value={contactName || customers?.find((c) => c.id === customerId)?.name} />
            <Detail label="Total" value={quote?.quote.coveredByMembership ? 'Included in membership' : money(quote?.quote.totalInr)} />
            <Detail label="Invoice" value={confirmed.invoiceNumber ?? 'Not raised'} />
            <Detail label="Payment" value={confirmed.invoiceNumber && payNow ? `Paid by ${humanStatus(paymentMethod)}` : 'Outstanding'} />
          </DetailGrid>
          <p className="ds-caption" style={{ maxWidth: '46ch' }}>
            A confirmation has been sent to the customer if an email address was recorded, and the front desk
            has been notified in-app.
          </p>
        </div>
      ) : (
        <div style={{ display: 'grid', gap: 22 }}>
          <Stepper steps={steps} current={step} />

          {stepKey === 'Schedule' && (
            <div style={{ display: 'grid', gap: 16 }}>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(180px,1fr))', gap: 14 }}>
                <Field label="Date">
                  <input className="input" type="date" value={date} onChange={(e) => setDate(e.target.value)} />
                </Field>
                <Field label="Booking type" hint="Leave on Automatic and the rate follows the length.">
                  <select className="input" value={mode} onChange={(e) => setMode(e.target.value)}>
                    <option value="">Automatic</option>
                    {BOOKING_MODES.map((m) => <option key={m} value={m}>{humanStatus(m)}</option>)}
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
                {recurrence !== 'NONE' && (
                  <Field label="Occurrences">
                    <input className="input" type="number" min={2} max={52} value={recurCount} onChange={(e) => setRecurCount(e.target.value)} />
                  </Field>
                )}
              </div>

              <div>
                <div className="ds-caption" style={{ marginBottom: 8 }}>Available slots</div>
                {slotsLoading ? (
                  <Skeleton rows={2} height={40} />
                ) : !slots?.slots.length ? (
                  <EmptyState compact title="Closed that day" body="Pick another date, or change the space's opening hours." />
                ) : (
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                    {slots.slots.map((s) => {
                      const selected = startAt === toLocalInput(s.start);
                      return (
                        <button
                          key={s.start}
                          type="button"
                          disabled={!s.available}
                          onClick={() => pickSlot(s)}
                          className={`ds-badge ${selected ? 'ds-tone-info' : 'ds-tone-neutral'}`}
                          style={{
                            font: 'inherit', fontSize: 12.5, padding: '7px 11px',
                            cursor: s.available ? 'pointer' : 'not-allowed',
                            opacity: s.available ? 1 : 0.42,
                            border: selected ? '1px solid var(--tone-info)' : undefined,
                          }}
                          title={s.available ? 'Available' : 'Already taken'}
                        >
                          {fmtTime(s.start)}
                        </button>
                      );
                    })}
                  </div>
                )}
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(190px,1fr))', gap: 14 }}>
                <Field label="Starts" required>
                  <input className="input" type="datetime-local" value={startAt} onChange={(e) => setStartAt(e.target.value)} />
                </Field>
                <Field label="Ends" required>
                  <input className="input" type="datetime-local" value={endAt} onChange={(e) => setEndAt(e.target.value)} />
                </Field>
                <Field label="Guests">
                  <input className="input" type="number" min={1} max={space.capacity} value={guests} onChange={(e) => setGuests(Number(e.target.value) || 1)} />
                </Field>
              </div>
            </div>
          )}

          {stepKey === 'Choose desk' && (
            <div style={{ display: 'grid', gap: 16 }}>
              {/* When — compact controls; the floor below re-reads on every change */}
              <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'flex-end' }}>
                <Field label="Date">
                  <input className="input" type="date" value={date} onChange={(e) => { setDate(e.target.value); setSeats([]);
                    if (startAt) { const t = startAt.slice(11); setStartAt(`${e.target.value}T${t}`); }
                    if (endAt) { const t = endAt.slice(11); setEndAt(`${e.target.value}T${t}`); } }} />
                </Field>
                <Field label="Arrival">
                  <select className="input" value={startAt ? startAt.slice(11, 16) : ''} onChange={(e) => {
                    const hm = e.target.value; if (!hm) return;
                    const st = `${date}T${hm}`;
                    setStartAt(st); setSeats([]);
                    if (endAt && endAt <= st) setEndAt('');
                  }}>
                    <option value="">Pick…</option>
                    {['07:00','08:00','09:00','10:00','11:00','12:00','13:00','14:00','15:00','16:00','17:00','18:00'].map((h) => <option key={h} value={h}>{h}</option>)}
                  </select>
                </Field>
                <Field label="Duration">
                  <select className="input" value={windowValid ? String((new Date(endAt).getTime() - new Date(startAt).getTime()) / 3600000) : ''} onChange={(e) => {
                    const hrs = Number(e.target.value); if (!hrs || !startAt) return;
                    const d = new Date(startAt); d.setHours(d.getHours() + hrs);
                    setEndAt(toLocalInput(d.toISOString())); setSeats([]);
                  }} disabled={!startAt}>
                    <option value="">Pick…</option>
                    <option value="2">2 hours</option>
                    <option value="4">Half day · 4h</option>
                    <option value="8">Full day · 8h</option>
                    <option value="10">Extended · 10h</option>
                  </select>
                </Field>
                {windowValid && (
                  <span className="ds-caption" style={{ paddingBottom: 10 }}>
                    {fmtDate(startAt)} · {fmtTime(startAt)}–{fmtTime(endAt)}
                  </span>
                )}
              </div>

              {!windowValid ? (
                <EmptyState compact title="When are you coming in?" body="Pick a date, arrival time and duration — the floor below shows what's free for exactly that window." />
              ) : availLoading || freeUnits == null ? (
                <Skeleton rows={2} height={80} />
              ) : freeUnits === 0 ? (
                <EmptyState compact title="No desks free for this window" body={windowAvail?.spaces?.[0]?.reason ?? 'Every desk is taken for that time — try another slot.'} />
              ) : (
                <div style={{ background: 'var(--surface-2)', borderRadius: 'var(--r-panel)', padding: '18px 20px 14px' }}>
                  {seatCfg.orientationTop && (
                    <div style={{ textAlign: 'center', marginBottom: 14 }}>
                      <div style={{ height: 8, borderRadius: 999, background: 'linear-gradient(90deg, var(--tone-sales-bg), var(--gold-bg))', marginBottom: 5 }} />
                      <span className="ds-caption" style={{ letterSpacing: '0.12em', textTransform: 'uppercase' }}>{seatCfg.orientationTop}</span>
                    </div>
                  )}

                  <div style={{ background: 'var(--surface)', border: '1px solid var(--line-soft)', borderRadius: 'var(--r-card)', padding: '16px 18px', display: 'grid', gap: 12 }}>
                    <div className="ds-caption" style={{ display: 'flex', justifyContent: 'space-between' }}>
                      <span>{space.zone ?? space.name}</span>
                      <span>{freeUnits} of {units} desks free</span>
                    </div>
                    {Array.from({ length: Math.ceil(units / 5) }, (_, row) => (
                      <div key={row} style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
                        <span className="ds-caption" style={{ width: 14, fontWeight: 700 }}>{String.fromCharCode(65 + row)}</span>
                        <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
                          {Array.from({ length: Math.min(5, units - row * 5) }, (_, i) => {
                            const n = row * 5 + i + 1;
                            const taken = n <= units - freeUnits;
                            const selected = seats.includes(n);
                            const premium = seatCfg.premiumSeats?.includes(n) ?? false;
                            const toggle = () => {
                              if (taken) return;
                              setSeats((prev) => prev.includes(n)
                                ? prev.filter((x) => x !== n)
                                : prev.length < freeUnits ? [...prev, n].sort((a, b) => a - b) : prev);
                            };
                            return (
                              <button
                                key={n} type="button" onClick={toggle} disabled={taken}
                                title={taken ? 'Taken for this window' : premium ? (seatCfg.premiumNote ?? 'Premium desk') : `Desk ${seatLabel(n)}`}
                                aria-label={`Desk ${seatLabel(n)}${taken ? ', taken' : selected ? ', selected' : ', available'}`}
                                style={{
                                  width: 64, minHeight: 52, borderRadius: '10px 10px 4px 4px',
                                  font: 'inherit', display: 'flex', flexDirection: 'column',
                                  alignItems: 'center', justifyContent: 'center', gap: 1, padding: '6px 4px',
                                  cursor: taken ? 'not-allowed' : 'pointer', transition: 'transform 120ms ease, box-shadow 120ms ease',
                                  ...(selected
                                    ? { background: 'var(--navy)', border: '1.5px solid var(--navy)', color: '#fff', boxShadow: '0 0 0 3px color-mix(in srgb, var(--gold) 45%, transparent)' }
                                    : taken
                                      ? { background: 'repeating-linear-gradient(45deg, var(--surface-2), var(--surface-2) 4px, var(--line-soft) 4px, var(--line-soft) 6px)', border: '1px solid var(--line)', color: 'var(--ink-3)' }
                                      : premium
                                        ? { background: 'var(--gold-bg)', border: '1.5px solid var(--gold)', color: 'var(--gold-ink)' }
                                        : { background: 'var(--surface)', border: '1.5px solid var(--tone-active)', color: 'var(--ink)' }),
                                }}
                              >
                                <span style={{ fontSize: 13, fontWeight: 800, display: 'flex', alignItems: 'center', gap: 4 }}>
                                  {selected && <Check size={12} />}{n}
                                </span>
                                <span style={{ fontSize: 9, fontWeight: 600, opacity: 0.85 }}>
                                  {premium ? (seatCfg.premiumNote ?? 'Premium') : seatLabel(n)}
                                </span>
                              </button>
                            );
                          })}
                        </div>
                      </div>
                    ))}
                    {units > 10 && (
                      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                        <div style={{ flex: 1, height: 1, background: 'var(--line-soft)' }} />
                        <span className="ds-caption" style={{ letterSpacing: '0.12em', textTransform: 'uppercase' }}>Walkway</span>
                        <div style={{ flex: 1, height: 1, background: 'var(--line-soft)' }} />
                      </div>
                    )}
                  </div>

                  {seatCfg.orientationBottom && (
                    <div className="ds-caption" style={{ textAlign: 'center', marginTop: 12, letterSpacing: '0.12em', textTransform: 'uppercase' }}>{seatCfg.orientationBottom}</div>
                  )}

                  <div style={{ display: 'flex', gap: 14, flexWrap: 'wrap', alignItems: 'center', marginTop: 14 }}>
                    <span className="ds-caption" style={{ display: 'inline-flex', alignItems: 'center', gap: 5 }}><span style={{ width: 10, height: 10, borderRadius: 3, background: 'var(--surface)', border: '1.5px solid var(--tone-active)', display: 'inline-block' }} />Available</span>
                    <span className="ds-caption" style={{ display: 'inline-flex', alignItems: 'center', gap: 5 }}><span style={{ width: 10, height: 10, borderRadius: 3, background: 'var(--navy)', display: 'inline-block' }} />Selected</span>
                    {(seatCfg.premiumSeats?.length ?? 0) > 0 && (
                      <span className="ds-caption" style={{ display: 'inline-flex', alignItems: 'center', gap: 5 }}><span style={{ width: 10, height: 10, borderRadius: 3, background: 'var(--gold-bg)', border: '1.5px solid var(--gold)', display: 'inline-block' }} />{seatCfg.premiumNote ?? 'Premium'}</span>
                    )}
                    <span className="ds-caption" style={{ display: 'inline-flex', alignItems: 'center', gap: 5 }}><span style={{ width: 10, height: 10, borderRadius: 3, background: 'repeating-linear-gradient(45deg, var(--surface-2), var(--surface-2) 3px, var(--line) 3px, var(--line) 4px)', border: '1px solid var(--line)', display: 'inline-block' }} />Taken</span>
                    <span style={{ marginLeft: 'auto', fontSize: 13, fontWeight: 700 }}>
                      {seats.length === 0
                        ? <span className="ds-caption">Select a desk</span>
                        : `${seats.map(seatLabel).join(', ')}${space.hourlyInr != null ? ` · ${money(space.hourlyInr)}/hr each` : space.dailyInr != null ? ` · ${money(space.dailyInr)}/day each` : ''}`}
                    </span>
                  </div>
                </div>
              )}
              <p className="ds-caption" style={{ margin: 0 }}>
                Desk allocation is confirmed on arrival — your picks are noted for the front desk, and the count is held for the whole window.
              </p>
            </div>
          )}

          {stepKey === 'Details' && (<div style={{ display: 'grid', gap: 22 }}>
          {true && (
            <div style={{ display: 'grid', gap: 16 }}>
              <Field label="Existing customer" hint="Leave blank for a walk-in and fill in the contact details below.">
                <select
                  className="input"
                  value={customerId}
                  onChange={(e) => {
                    setCustomerId(e.target.value);
                    const c = customers?.find((x) => x.id === e.target.value);
                    if (c) { setContactName(c.name); setContactPhone(c.phone ?? ''); setContactEmail(c.email ?? ''); }
                    setMembershipId('');
                  }}
                >
                  <option value="">Walk-in / new contact</option>
                  {(customers ?? []).map((c) => <option key={c.id} value={c.id}>{c.name} ({c.reference})</option>)}
                </select>
              </Field>

              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(190px,1fr))', gap: 14 }}>
                <Field label="Contact name" required>
                  <input className="input" value={contactName} onChange={(e) => setContactName(e.target.value)} placeholder="Who is the booking for?" />
                </Field>
                <Field label="Phone">
                  <input className="input" value={contactPhone} onChange={(e) => setContactPhone(e.target.value)} />
                </Field>
                <Field label="Email" hint="The confirmation goes here.">
                  <input className="input" type="email" value={contactEmail} onChange={(e) => setContactEmail(e.target.value)} />
                </Field>
              </div>

              <Field label="Book against a membership" hint="Included hours are used before anything is charged.">
                <select className="input" value={membershipId} onChange={(e) => setMembershipId(e.target.value)}>
                  <option value="">No membership — pay as you go</option>
                  {(memberships ?? []).map((m) => (
                    <option key={m.id} value={m.id}>
                      {m.customer.name} · {m.plan.name} ({Math.max(0, m.includedHours - m.usedHours)}h left)
                    </option>
                  ))}
                </select>
              </Field>
            </div>
          )}

          {true && (
            <div style={{ display: 'grid', gap: 18 }}>
              <div>
                <div className="ds-caption" style={{ marginBottom: 8 }}>Add-ons</div>
                {!addOnList.length ? (
                  <div className="ds-caption">No services are set up yet. Add them under Services.</div>
                ) : (
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(220px,1fr))', gap: 10 }}>
                    {addOnList.map((s) => (
                      <div key={s.id} className="ds-card" style={{ padding: 12, display: 'flex', alignItems: 'center', gap: 10 }}>
                        <div style={{ minWidth: 0, flex: 1 }}>
                          <div style={{ fontSize: 13, fontWeight: 600 }}>{s.name}</div>
                          <div className="ds-caption">{money(s.priceInr)} · {humanStatus(s.unit)}</div>
                        </div>
                        <input
                          className="input" type="number" min={0} max={99} style={{ width: 68 }}
                          aria-label={`${s.name} quantity`}
                          value={addOns[s.id] ?? 0}
                          onChange={(e) => setAddOns((a) => ({ ...a, [s.id]: Math.max(0, Number(e.target.value) || 0) }))}
                        />
                      </div>
                    ))}
                  </div>
                )}
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(190px,1fr))', gap: 14 }}>
                <Field label="Discount %" hint="Tax is charged on the amount after discount.">
                  <input className="input" type="number" min={0} max={100} value={discountPct} onChange={(e) => setDiscountPct(e.target.value)} />
                </Field>
                <Field label="Discount amount">
                  <input className="input" type="number" min={0} value={discountInr} onChange={(e) => setDiscountInr(e.target.value)} />
                </Field>
                <Field label="Notes" span={2}>
                  <input className="input" value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Anything the front desk should know" />
                </Field>
              </div>
            </div>
          )}

          </div>)}

          {stepKey === 'Review' && (
            <div style={{ display: 'grid', gap: 16 }}>
              {quoting && <Skeleton rows={2} height={44} />}
              {quote && !quote.bookable && (
                <div className="ds-card" style={{ padding: 14, display: 'flex', gap: 10, alignItems: 'flex-start', borderColor: 'var(--tone-expired-line)' }}>
                  <AlertTriangle size={16} style={{ color: 'var(--tone-expired)', flex: 'none', marginTop: 1 }} />
                  <div>
                    <div style={{ fontWeight: 650, fontSize: 13 }}>This slot cannot be booked</div>
                    <div className="ds-caption" style={{ marginTop: 2 }}>{quote.reason ?? 'Pick another time.'}</div>
                  </div>
                </div>
              )}
              {quote && (
                <>
                  <DetailGrid>
                    <Detail label="Space" value={`${quote.space.name} (${quote.space.code})`} />
                    <Detail label="When" value={`${fmtDate(startAt)} ${fmtTime(startAt)}–${fmtTime(endAt)}`} />
                    <Detail label="Customer" value={contactName || '—'} />
                    <Detail label="Charged as" value={`${humanStatus(quote.quote.mode)} × ${quote.quote.chargeableUnits}${seatMap && seats.length > 1 ? ` · ${seats.length} desks` : ''}`} />
                    {seatMap && seats.length > 0 && (
                      <Detail label="Workspace" value={seats.map(seatLabel).join(', ')} />
                    )}
                  </DetailGrid>

                  <table className="ds-table">
                    <thead>
                      <tr><th>Item</th><th className="ds-col-num">Qty</th><th className="ds-col-num">Rate</th><th className="ds-col-num">Amount</th></tr>
                    </thead>
                    <tbody>
                      {quote.quote.lines.map((l, i) => (
                        <tr key={`${l.label}-${i}`}>
                          <td>{l.label}</td>
                          <td className="ds-col-num">{l.quantity}</td>
                          <td className="ds-col-num">{money(l.unitPriceInr)}</td>
                          <td className="ds-col-num">{money(l.amountInr)}</td>
                        </tr>
                      ))}
                      {quote.quote.coveredHours > 0 && (
                        <tr><td colSpan={3}>Covered by membership</td><td className="ds-col-num">{quote.quote.coveredHours}h</td></tr>
                      )}
                      {quote.quote.discountInr > 0 && (
                        <tr><td colSpan={3}>Discount</td><td className="ds-col-num">−{money(quote.quote.discountInr)}</td></tr>
                      )}
                      <tr><td colSpan={3}>Tax ({quote.quote.taxPct}%)</td><td className="ds-col-num">{money(quote.quote.taxInr)}</td></tr>
                      <tr>
                        <td colSpan={3} style={{ fontWeight: 700 }}>Total</td>
                        <td className="ds-col-num" style={{ fontWeight: 700 }}>{money(quote.quote.totalInr)}</td>
                      </tr>
                    </tbody>
                  </table>

                  {recurrence !== 'NONE' && (
                    <div className="ds-caption">
                      This will create {recurCount} bookings. Every occurrence is checked for conflicts before any of them is written.
                    </div>
                  )}
                </>
              )}
            </div>
          )}

          {stepKey === 'Payment' && (
            <div style={{ display: 'grid', gap: 16 }}>
              {quote?.quote.coveredByMembership ? (
                <div className="ds-card" style={{ padding: 16, display: 'flex', gap: 10, alignItems: 'center' }}>
                  <Badge tone="active">Covered</Badge>
                  <span style={{ fontSize: 13 }}>
                    This booking comes out of the membership allowance. Nothing to collect, and no invoice is raised.
                  </span>
                </div>
              ) : (
                <>
                  <label style={{ display: 'flex', gap: 10, alignItems: 'center', fontSize: 13.5 }}>
                    <input type="checkbox" checked={createInvoice} onChange={(e) => setCreateInvoice(e.target.checked)} />
                    <Receipt size={15} style={{ color: 'var(--ink-3)' }} />
                    Raise an invoice for {money(quote?.quote.totalInr)}
                  </label>
                  <label style={{ display: 'flex', gap: 10, alignItems: 'center', fontSize: 13.5, opacity: createInvoice ? 1 : 0.5 }}>
                    <input type="checkbox" checked={payNow} disabled={!createInvoice} onChange={(e) => setPayNow(e.target.checked)} />
                    <CreditCard size={15} style={{ color: 'var(--ink-3)' }} />
                    Record payment in full now
                  </label>
                  {createInvoice && payNow && (
                    <Field label="Payment method">
                      <select className="input" style={{ maxWidth: 220 }} value={paymentMethod} onChange={(e) => setPaymentMethod(e.target.value)}>
                        {['CASH', 'CARD', 'BANK', 'ONLINE', 'CHEQUE'].map((m) => <option key={m} value={m}>{humanStatus(m)}</option>)}
                      </select>
                    </Field>
                  )}
                  <p className="ds-caption" style={{ maxWidth: '56ch' }}>
                    Leaving payment off still confirms the booking — the invoice stays outstanding and appears in
                    Billing → Outstanding until it is settled.
                  </p>
                </>
              )}
            </div>
          )}
        </div>
      )}
    </Modal>
  );
}
