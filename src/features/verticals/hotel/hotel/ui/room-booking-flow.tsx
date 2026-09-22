'use client';

/**
 * The room booking flow — full screen, floor first.
 *
 * Ported from the coworking desk booking (features/coworking/ui/desk-booking),
 * which had already learned the lesson this screen needed: a desk is a PLACE,
 * so choosing one deserves the whole screen rather than a dropdown in a modal.
 * A hotel room is the same kind of thing. A receptionist standing at the desk
 * thinks "which room shall I put them in", looking at the building — not
 * "select an option from a list of 18 cuids".
 *
 * Same three-column anatomy as the coworking flow: the stay on the left, the
 * floor in the middle, the money on the right, four steps across the top.
 *
 * What is deliberately DIFFERENT from coworking:
 *
 *  · Coworking desks are fungible — the engine holds unit counts and desk
 *    identity rides along as an advisory note. A hotel room is not: room 203
 *    is a specific room with a specific rate, and the reservation names it.
 *    So the map here is authoritative, not decorative.
 *
 *  · Every tile's state comes from the server. `GET /hotel/rooms` gives the
 *    whole floor with its derived status; `GET /hotel/availability` gives the
 *    subset actually free for THIS window. A room can be free tonight and
 *    taken on the 20th, so the two are intersected per window rather than the
 *    board's status being trusted on its own.
 *
 *  · Rooms awaiting housekeeping are shown, greyed, labelled "needs cleaning"
 *    — not hidden. The receptionist can see the room exists and why they
 *    cannot have it, which is the difference between "we are full" and "call
 *    housekeeping".
 */

import { useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { BedDouble, Check, TriangleAlert, X } from 'lucide-react';
import { api, apiErrorMessage } from '@/lib/api';
import { fmtOrgMoneyExact } from '@/lib/org-locale';
import { Badge, EmptyState, Field, Skeleton } from './kit';
import { StaySummary } from './stay-summary';
import { DormitoryPanel } from './dormitory/dormitory-panel';
import type { Bedspace, BedspaceBoard } from './dormitory/types';
import { estimateStay, nightsBetween } from './pricing';
import type { AvailabilityResult, HotelCategory, RoomRow } from '../types';

const STEPS = ['The stay', 'Choose room', 'Guest', 'Review & confirm'];

/**
 * A room type sleeping three or more is sold by the bed, not by the room.
 *
 * The same threshold the API uses (hotel/dormitory.service.ts). It is derived
 * from capacity rather than a flag because that is the fact that already
 * decides it: nobody sells half a double, and everybody sells one bunk of a
 * twelve-bed dorm. A second boolean would only be able to disagree with it.
 */
const DORMITORY_MIN_CAPACITY = 3;
const isShared = (c: { capacity: number } | null | undefined) =>
  Boolean(c && c.capacity >= DORMITORY_MIN_CAPACITY);

/**
 * "7-TOP" → "Top bed · Bed 07", which is how a receptionist says it out loud.
 *
 * `bunks` is the dormitory's bunk count, used only to pad the number to the
 * same width the grid uses — Bed 07 in the footer and Bed 07 on the bed.
 */
function bedspaceLabel(code: string | null, bunks = 0): string | null {
  if (!code) return null;
  const [bunk, tier] = code.split('-');
  const n = bunks > 0 ? bunk.padStart(String(bunks).length, '0') : bunk;
  return `${tier === 'TOP' ? 'Top' : 'Bottom'} bed · Bed ${n}`;
}

/** "7-TOP" → "Top · Bed 07" for the summary, where "bed" is already the row. */
function bedspaceSummary(code: string, bunks: number): string {
  const [bunk, tier] = code.split('-');
  return `${tier === 'TOP' ? 'Top' : 'Bottom'} · Bed ${bunk.padStart(String(bunks).length, '0')}`;
}

const today = () => new Date().toISOString().slice(0, 10);
const plusDays = (n: number) => new Date(Date.now() + n * 86400000).toISOString().slice(0, 10);

type TileState = 'free' | 'selected' | 'taken' | 'dirty' | 'blocked';

/**
 * A room on the floor map.
 *
 * Drawn as a door with a number plate above it, so a floor of eighteen reads
 * as a corridor rather than a spreadsheet. Colour never carries the meaning
 * alone — every tile states its condition in words underneath.
 */
function RoomTile({
  room, state, onClick,
}: { room: RoomRow; state: TileState; onClick: () => void }) {
  const face =
    state === 'selected'
      ? {
          background: 'var(--tone-active-bg)',
          border: '2.5px solid var(--tone-active)',
          boxShadow: '0 0 0 4px color-mix(in srgb, var(--tone-active) 18%, transparent), 0 4px 10px rgba(58,47,42,0.14)',
        }
      : state === 'taken'
        ? {
            background:
              'repeating-linear-gradient(45deg, var(--tone-info-bg), var(--tone-info-bg) 5px, color-mix(in srgb, var(--tone-info) 14%, transparent) 5px, color-mix(in srgb, var(--tone-info) 14%, transparent) 8px)',
            border: '1px solid var(--tone-info-line)',
          }
        : state === 'dirty'
          ? { background: 'var(--tone-renewal-bg)', border: '1.5px dashed var(--tone-renewal-line)' }
          : state === 'blocked'
            ? { background: 'var(--surface-2)', border: '1px solid var(--hairline-strong)' }
            : { background: 'var(--surface)', border: '2px solid var(--tone-active-line)' };

  const word =
    state === 'selected' ? 'Selected'
      : state === 'taken' ? 'Occupied'
        : state === 'dirty' ? 'Needs cleaning'
          : state === 'blocked' ? 'Out of order'
            : 'Available';

  const selectable = state === 'free' || state === 'selected';

  return (
    <button
      type="button"
      onClick={onClick}
      disabled={!selectable}
      title={
        state === 'dirty' ? `Room ${room.roomNumber} — housekeeping must release it first`
          : state === 'taken' ? `Room ${room.roomNumber} — taken for these dates`
            : `Room ${room.roomNumber}`
      }
      aria-label={`Room ${room.roomNumber}, ${room.category?.name ?? ''}, ${word}`}
      style={{
        display: 'flex', flexDirection: 'column', alignItems: 'center', width: '100%',
        background: 'transparent', border: 'none', padding: 0, font: 'inherit',
        cursor: selectable ? 'pointer' : 'not-allowed',
      }}
    >
      <span style={{
        fontSize: 13, fontWeight: 800, background: 'var(--surface)', border: '1px solid var(--hairline-strong)',
        borderRadius: 7, padding: '3px 12px', marginBottom: 7, color: 'var(--ink)',
      }}>{room.roomNumber}</span>

      {/* the door */}
      <span style={{
        width: '100%', maxWidth: 104, minWidth: 62, aspectRatio: '3 / 4', borderRadius: '8px 8px 3px 3px',
        position: 'relative', display: 'block', boxShadow: '0 4px 10px rgba(58,47,42,0.12)', ...face,
      }}>
        {state === 'selected' && <Check size={16} style={{ position: 'absolute', top: 6, right: 6, color: 'var(--tone-active)' }} />}
        {state === 'dirty' && <TriangleAlert size={14} style={{ position: 'absolute', top: 6, right: 6, color: 'var(--tone-renewal)' }} />}
        {/* handle */}
        <span style={{
          position: 'absolute', left: 8, top: '52%', width: 7, height: 7, borderRadius: 99,
          background: selectable ? 'var(--ink-2)' : 'var(--ink-3)', opacity: 0.6,
        }} />
      </span>

      <span className="ds-caption" style={{ marginTop: 6, textAlign: 'center', lineHeight: 1.25 }}>
        {room.category?.name ?? '—'}<br />
        <span style={{
          fontWeight: 600,
          color: state === 'free' || state === 'selected' ? 'var(--tone-active)'
            : state === 'dirty' ? 'var(--tone-renewal)'
              : state === 'taken' ? 'var(--tone-info)' : 'var(--ink-3)',
        }}>{word}</span>
      </span>
    </button>
  );
}

/** Enough of a guest to prefill the flow — the Guests screen's "Book next stay". */
export interface PrefilledGuest {
  firstName: string;
  lastName?: string | null;
  email?: string | null;
  phone?: string | null;
}

export function RoomBookingFlow({
  open, onClose, propertyId, propertyName, categories, initialGuest, onDone,
}: {
  open: boolean;
  onClose: () => void;
  propertyId: string | null;
  propertyName?: string;
  categories: HotelCategory[];
  /**
   * A known guest, from "Book next stay" on their profile. Their details are
   * filled in and the flow opens on the floor rather than asking again for a
   * name the system already has.
   */
  initialGuest?: PrefilledGuest | null;
  onDone: () => void;
}) {
  const qc = useQueryClient();
  const [step, setStep] = useState(0);
  const [from, setFrom] = useState(plusDays(1));
  const [to, setTo] = useState(plusDays(3));
  const [categoryId, setCategoryId] = useState('');
  const [roomId, setRoomId] = useState('');
  // A shared room is chosen twice: the dormitory, then the mattress inside it.
  const [dormId, setDormId] = useState<string | null>(null);
  const [bedspace, setBedspace] = useState<Bedspace | null>(null);
  const [dormInfo, setDormInfo] = useState<BedspaceBoard['dormitory'] | null>(null);
  const guestLabel = initialGuest
    ? `${initialGuest.firstName} ${initialGuest.lastName ?? ''}`.trim()
    : '';
  const [name, setName] = useState(guestLabel);
  const [phone, setPhone] = useState(initialGuest?.phone ?? '');
  const [email, setEmail] = useState(initialGuest?.email ?? '');

  // Reopening for a different guest must not show the previous one's details.
  const [seededFor, setSeededFor] = useState<string | null>(guestLabel || null);
  if (open && (guestLabel || null) !== seededFor) {
    setSeededFor(guestLabel || null);
    setName(guestLabel);
    setPhone(initialGuest?.phone ?? '');
    setEmail(initialGuest?.email ?? '');
  }

  const nights = nightsBetween(from, to);
  const windowValid = nights > 0;

  // The whole floor, whatever its state — so a taken room is drawn as taken
  // rather than silently missing.
  const { data: allRooms = [], isLoading: roomsLoading } = useQuery<RoomRow[]>({
    queryKey: ['hotel-rooms', propertyId],
    queryFn: async () => (await api.get('/hotel/rooms', { params: { propertyId } })).data,
    enabled: open && Boolean(propertyId),
  });

  // What is actually free for THIS window. A room free tonight can be taken on
  // the 20th, so the board's own status is never trusted on its own.
  const { data: avail, isFetching: availLoading } = useQuery<AvailabilityResult>({
    queryKey: ['hotel-availability-flow', propertyId, from, to, categoryId],
    queryFn: async () => (await api.get('/hotel/availability', {
      params: { propertyId, from, to, categoryId: categoryId || undefined },
    })).data,
    enabled: open && Boolean(propertyId) && windowValid,
  });

  const freeIds = useMemo(() => new Set((avail?.rooms ?? []).map((r) => r.id)), [avail]);

  /**
   * The door map shows rooms you can book WHOLE.
   *
   * A dormitory is not one of those, and drawing it as a door was actively
   * misleading: whole-room availability excludes any room holding a live
   * reservation, so a dorm with one bed sold rendered as a door marked
   * "Occupied" while forty-seven beds stood empty. It gets its own entry
   * below the map instead.
   */
  const sharedCategoryIds = useMemo(
    () => new Set(categories.filter(isShared).map((c) => c.id)),
    [categories],
  );

  const visible = useMemo(
    () => allRooms.filter((r) => (
      categoryId ? r.category?.id === categoryId : !sharedCategoryIds.has(r.category?.id ?? '')
    )),
    [allRooms, categoryId, sharedCategoryIds],
  );

  /** The shared rooms this property has, for the strip under the floor map. */
  const sharedCategories = useMemo(() => {
    const withRooms = new Set(allRooms.map((r) => r.category?.id).filter(Boolean) as string[]);
    return categories.filter((c) => isShared(c) && withRooms.has(c.id));
  }, [categories, allRooms]);

  const floors = useMemo(() => {
    const m = new Map<string, RoomRow[]>();
    for (const r of visible) {
      const k = r.floor?.trim() || '—';
      m.set(k, [...(m.get(k) ?? []), r]);
    }
    return [...m.entries()].sort((a, b) => a[0].localeCompare(b[0], undefined, { numeric: true }));
  }, [visible]);

  const stateOf = (r: RoomRow): TileState => {
    if (r.id === roomId) return 'selected';
    if (r.housekeepingStatus === 'OUT_OF_ORDER') return 'blocked';
    if (freeIds.has(r.id)) return 'free';
    if (r.housekeepingStatus === 'DIRTY') return 'dirty';
    return 'taken';
  };

  const category = categories.find((c) => c.id === categoryId)
    ?? allRooms.find((r) => r.id === roomId)?.category ?? null;
  const sharedMode = isShared(category);
  // In shared mode the price comes from the dormitory the API described, so a
  // rate change lands here without the flow having to be told about it.
  const nightlyInr = sharedMode ? (dormInfo?.nightlyInr ?? category?.basePriceInr ?? 0)
    : (category?.basePriceInr ?? 0);
  const room = allRooms.find((r) => r.id === roomId) ?? null;
  const freeCount = visible.filter((r) => freeIds.has(r.id)).length;

  const reset = () => {
    setStep(0); setRoomId(''); setCategoryId('');
    setDormId(null); setBedspace(null); setDormInfo(null);
    // Back to the prefill, not to blank — a known guest stays known.
    setName(guestLabel); setPhone(initialGuest?.phone ?? ''); setEmail(initialGuest?.email ?? '');
  };
  const close = () => { reset(); onClose(); };

  const create = useMutation({
    mutationFn: async () => {
      // A bed and a room are booked by different endpoints on purpose. The
      // room path guarantees one live reservation per ROOM; the bed path
      // guarantees one per MATTRESS. Folding them into one call would mean one
      // of those two promises quietly stops being checked.
      if (sharedMode) {
        if (!dormId || !bedspace) throw new Error('Choose a bed space first');
        return (await api.post('/hotel/dormitories/reserve', {
          roomId: dormId, bedspaceCode: bedspace.code,
          checkInDate: from, checkOutDate: to,
          guestName: name, guestEmail: email || undefined, guestPhone: phone || undefined,
        })).data;
      }
      const { data: bk } = await api.post('/hotel-bookings', {
        propertyId, categoryId: room?.category?.id ?? categoryId, guestName: name,
        guestEmail: email || undefined, guestPhone: phone || undefined,
        checkInDate: from, checkOutDate: to,
      });
      // Confirming is what turns the request into a claim on the inventory,
      // and it is the call that can still refuse with a 409.
      return (await api.post(`/hotel-bookings/${bk.id}/confirm`)).data;
    },
    onSuccess: () => {
      toast.success(sharedMode
        ? `Reservation confirmed — ${bedspaceLabel(bedspace?.code ?? null, dormInfo?.bunkCount)} in ${dormInfo?.name ?? 'the dormitory'}`
        : `Reservation confirmed — room ${room?.roomNumber ?? ''}`);
      qc.invalidateQueries({ queryKey: ['hotel-reservations'] });
      qc.invalidateQueries({ queryKey: ['hotel-reception'] });
      qc.invalidateQueries({ queryKey: ['hotel-rooms'] });
      qc.invalidateQueries({ queryKey: ['hotel-bedspaces'] });
      reset(); onDone();
    },
    onError: (e) => toast.error(apiErrorMessage(e)),
  });

  const canAdvance =
    step === 0 ? windowValid
      : step === 1 ? (sharedMode ? Boolean(bedspace) : Boolean(roomId))
        : step === 2 ? Boolean(name.trim())
          : true;

  if (!open) return null;

  return (
    <div className="hs-flow" role="dialog" aria-modal="true" aria-label="New reservation">
      <header className="hs-flow-head">
        <div>
          <h1 className="ds-h2" style={{ margin: 0 }}>New reservation</h1>
          <p className="ds-caption" style={{ margin: 0 }}>
            {propertyName ?? 'Property'}
            {guestLabel ? ` · next stay for ${guestLabel}` : ''}
          </p>
        </div>
        <ol className="hs-steps">
          {STEPS.map((s, i) => (
            <li key={s} className={i === step ? 'is-current' : i < step ? 'is-done' : ''}>
              <span className="hs-step-n">{i < step ? <Check size={13} strokeWidth={3} /> : i + 1}</span>
              <span className="hs-step-label">{s}</span>
            </li>
          ))}
        </ol>
        <button className="btn-ghost btn-sm" onClick={close} aria-label="Close"><X size={18} /></button>
      </header>

      <div className="hs-flow-body">
        {/* ── left: the stay ─────────────────────────────────────────────── */}
        <aside className="hs-flow-side">
          <div className="ds-card" style={{ padding: 'var(--pad-card)' }}>
            <h3 className="ds-h3" style={{ marginTop: 0 }}>The stay</h3>
            <div className="ds-field-pair">
              <Field label="Check-in" required>
                <input className="input" type="date" min={today()} value={from}
                       onChange={(e) => { setFrom(e.target.value); setRoomId(''); setBedspace(null); if (to <= e.target.value) setTo(plusDays(2)); }} />
              </Field>
              <Field label="Check-out" required>
                <input className="input" type="date" min={from} value={to}
                       onChange={(e) => { setTo(e.target.value); setRoomId(''); setBedspace(null); }} />
              </Field>
            </div>
            <p className="ds-caption" style={{ margin: '8px 0 0' }}>
              {windowValid ? `${nights} night${nights === 1 ? '' : 's'}` : 'Check-out must be after check-in'}
            </p>

            <div style={{ marginTop: 'var(--s-4)' }}>
              <Field label="Room type"
                     hint={sharedMode ? 'Sold by the bed — choose a bunk on the right'
                       : 'Leave blank to see the whole floor'}>
                <select className="input" value={categoryId}
                        onChange={(e) => {
                          setCategoryId(e.target.value);
                          setRoomId(''); setBedspace(null); setDormId(null); setDormInfo(null);
                        }}>
                  <option value="">All room types</option>
                  {categories.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name}{isShared(c) ? ' (Shared Room)' : ''} — {fmtOrgMoneyExact(c.basePriceInr)}
                      {isShared(c) ? ' per bed per night' : ' per night'}
                    </option>
                  ))}
                </select>
              </Field>
            </div>
          </div>

          {step >= 2 && (
            <div className="ds-card" style={{ padding: 'var(--pad-card)' }}>
              <h3 className="ds-h3" style={{ marginTop: 0 }}>Guest</h3>
              <Field label="Name" required>
                <input className="input" value={name} onChange={(e) => setName(e.target.value)} placeholder="Full name" />
              </Field>
              <Field label="Phone">
                <input className="input" value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="+91…" />
              </Field>
              <Field label="Email" hint="Recognises a returning guest">
                <input className="input" type="email" value={email} onChange={(e) => setEmail(e.target.value)} />
              </Field>
            </div>
          )}
        </aside>

        {/* ── middle: the floor ──────────────────────────────────────────── */}
        <section className="hs-flow-floor">
          {sharedMode ? (
            <DormitoryPanel
              propertyId={propertyId}
              categoryId={categoryId}
              dormitoryId={dormId}
              onDormitoryChange={(id) => { setDormId(id); setBedspace(null); }}
              from={from}
              to={to}
              selectedCode={bedspace?.code ?? null}
              onSelect={(space, board) => {
                setBedspace(space.code === bedspace?.code ? null : space);
                setDormId(board.dormitory.id);
                setDormInfo(board.dormitory);
                if (step === 0) setStep(1);
              }}
              onBoard={(board) => { setDormId(board.dormitory.id); setDormInfo(board.dormitory); }}
            />
          ) : (<>
          <div className="hs-floor-head">
            <h2 className="ds-h3" style={{ margin: 0 }}>
              {floors.length === 1 && floors[0][0] !== '—' ? `Floor ${floors[0][0]}` : 'Floor map'}
            </h2>
            <span className="ds-caption">
              {!windowValid ? 'Choose the dates first'
                : availLoading ? 'Checking availability…'
                  : `${freeCount} of ${visible.length} free for ${nights} night${nights === 1 ? '' : 's'}`}
            </span>
          </div>

          <div className="hs-floor-canvas">
            {roomsLoading ? <Skeleton rows={3} />
              : visible.length === 0 ? (
                <EmptyState icon={BedDouble} title="No rooms of this type"
                            body="Choose a different room type, or add rooms from the Rooms screen." />
              ) : floors.map(([floor, list]) => (
                <div key={floor} className="hs-floor-row">
                  {floors.length > 1 && (
                    <h4 className="ds-caption-upper" style={{ margin: 0 }}>
                      {floor === '—' ? 'Unassigned' : `Floor ${floor}`}
                    </h4>
                  )}
                  <div className="hs-floor-grid">
                    {list.map((r) => (
                      <RoomTile key={r.id} room={r} state={stateOf(r)}
                                onClick={() => { setRoomId(r.id === roomId ? '' : r.id); if (step === 0) setStep(1); }} />
                    ))}
                  </div>
                </div>
              ))}
          </div>

          {sharedCategories.length > 0 && !categoryId && (
            <div className="hs-shared-strip">
              <span className="ds-caption-upper">Also at this property — sold by the bed</span>
              <div className="hs-shared-row">
                {sharedCategories.map((c) => (
                  <button key={c.id} type="button" className="hs-shared-card"
                          onClick={() => { setCategoryId(c.id); setRoomId(''); setBedspace(null); if (step === 0) setStep(1); }}>
                    <span className="hs-shared-name">{c.name}</span>
                    <span className="ds-caption">
                      {c.capacity} bed spaces · {Math.ceil(c.capacity / 2)} bunks
                    </span>
                    <span className="hs-shared-rate">
                      {fmtOrgMoneyExact(c.basePriceInr)} per bed per night
                    </span>
                    <span className="hs-shared-cta">Choose a bed →</span>
                  </button>
                ))}
              </div>
            </div>
          )}

          <div className="hs-floor-legend ds-card">
            <span><i className="hs-key hs-key-free" /> Available</span>
            <span><i className="hs-key hs-key-taken" /> Occupied / reserved</span>
            <span><i className="hs-key hs-key-dirty" /> Needs cleaning</span>
            <span><i className="hs-key hs-key-blocked" /> Out of order</span>
          </div>
          </>)}
        </section>

        {/* ── right: the money ───────────────────────────────────────────── */}
        <aside className="hs-flow-side">
          <div className="ds-card" style={{ padding: 'var(--pad-card)' }}>
            <h3 className="ds-h3" style={{ marginTop: 0 }}>Summary</h3>
            <dl className="hs-projection" style={{ marginTop: 0 }}>
              <div><dt>Dates</dt><dd>{windowValid ? `${from} → ${to}` : '—'}</dd></div>
              <div><dt>Nights</dt><dd>{windowValid ? nights : '—'}</dd></div>
              {sharedMode ? (<>
                <div>
                  <dt>Dormitory</dt>
                  <dd>{dormInfo ? dormInfo.name : 'Not chosen'}</dd>
                </div>
                <div>
                  <dt>Bed space</dt>
                  <dd>{bedspace
                    ? bedspaceSummary(bedspace.code, dormInfo?.bunkCount ?? 0)
                    : 'Not chosen'}</dd>
                </div>
              </>) : (
                <div><dt>Room</dt><dd>{room ? `${room.roomNumber} · ${room.category?.name ?? ''}` : 'Not chosen'}</dd></div>
              )}
              <div><dt>Guest</dt><dd>{name.trim() || '—'}</dd></div>
            </dl>
          </div>

          {category && windowValid && nightlyInr > 0 && (
            <StaySummary nightlyInr={nightlyInr} nights={nights}
                         roomTypeName={sharedMode ? category.name : undefined} />
          )}

          {!sharedMode && windowValid && freeCount === 0 && !availLoading && (
            <div className="ds-card ds-tone-expired" style={{ padding: 'var(--pad-card)' }}>
              <strong>Nothing free for these dates.</strong>{' '}
              {avail?.excludesUncleanedRooms
                ? 'Rooms awaiting housekeeping are not offered — release one, or try other dates.'
                : 'Try other dates or another room type.'}
            </div>
          )}
        </aside>
      </div>

      <footer className="hs-flow-foot">
        <button className="btn-secondary" onClick={step === 0 ? close : () => setStep(step - 1)}>
          {step === 0 ? 'Cancel' : 'Back'}
        </button>
        <div className="ds-row" style={{ gap: 'var(--s-3)' }}>
          {sharedMode
            ? bedspace && <Badge tone="active">{bedspaceLabel(bedspace.code, dormInfo?.bunkCount)}</Badge>
            : room && <Badge tone="active">Room {room.roomNumber}</Badge>}
          {step < STEPS.length - 1 ? (
            <button className="btn-primary" disabled={!canAdvance} onClick={() => setStep(step + 1)}>
              {step === 1 && !(sharedMode ? bedspace : roomId)
                ? (sharedMode ? 'Choose a bed' : 'Choose a room') : 'Continue'}
            </button>
          ) : (
            <button className="btn-primary"
                    disabled={!name.trim() || !(sharedMode ? bedspace : roomId) || create.isPending}
                    onClick={() => create.mutate()}>
              {create.isPending ? 'Confirming…'
                : nightlyInr > 0 ? `Confirm · ${fmtOrgMoneyExact(estimateStay(nightlyInr, nights).totalInr)}`
                  : 'Confirm reservation'}
            </button>
          )}
        </div>
      </footer>
    </div>
  );
}
