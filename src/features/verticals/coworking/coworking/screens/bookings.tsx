'use client';

/**
 * Bookings — the list, the day calendar and the record.
 *
 * Cancellation shows what it will cost BEFORE it is confirmed, from the same
 * endpoint that charges it, so the number on the dialog is the number applied.
 */

import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { CalendarDays, Plus, Receipt } from 'lucide-react';
import { api, apiErrorMessage } from '@/lib/api';
import {
  Badge, Card, DataTable, Drawer, EmptyState, Field, Modal, Segmented, Skeleton,
  Timeline, humanStatus, type DataTableColumn,
} from '../ui/kit';
import { BOOKING_STATUSES, toneForBookingStatus, spaceTypeLabel } from '../ui/tone';
import {
  DateRange, Detail, DetailGrid, PageHead, Pagination, SearchBox, StatusSelect,
  fmtDate, fmtDateTime, fmtTime, money, toDateInput, useListState,
} from '../ui/common';
import { BookingWizard, type BookingWizardSpace } from '../ui/booking-wizard';
import { SpacePicker } from '../ui/space-picker';
import { DeskBookingFlow, type DeskSpace } from '../ui/desk-booking';

const DESK_TYPES = new Set(['HOT_DESK', 'DEDICATED_DESK']);
type PickedSpace = BookingWizardSpace & {
  media?: { url: string }[] | null;
  floor?: { name: string } | null;
  building?: { name: string } | null;
};

interface BookingRow {
  id: string; reference: string; startAt: string; endAt: string; status: string; mode: string;
  contactName: string; contactPhone?: string | null; contactEmail?: string | null;
  totalInr: number; paidInr: number; coveredByMembership: boolean; invoiceId?: string | null;
  guests: number; notes?: string | null; cancelReason?: string | null; cancellationFeeInr: number;
  space: { id: string; name: string; code: string; type: string };
  customer?: { id: string; name: string; reference: string } | null;
  membership?: { id: string; reference: string } | null;
}

interface CalendarResponse {
  bookings: (BookingRow & { space: { id: string; name: string; code: string; type: string } })[];
  blocks: { id: string; kind: string; startAt: string; endAt: string; reason?: string | null; space: { id: string; name: string } }[];
}

export function CoworkingBookings() {
  const qc = useQueryClient();
  const { state, set, params } = useListState({ sort: 'startAt', dir: 'desc' });
  const [view, setView] = useState<'List' | 'Calendar'>('List');
  const [day, setDay] = useState(toDateInput());
  const [openId, setOpenId] = useState<string | null>(null);
  const [newBookingSpace, setNewBookingSpace] = useState<BookingWizardSpace | null>(null);
  const [deskSpace, setDeskSpace] = useState<DeskSpace | null>(null);
  const [spacePickerOpen, setSpacePickerOpen] = useState(false);

  const { data, isLoading } = useQuery({
    queryKey: ['cw-bookings', params],
    queryFn: async () => (await api.get<{ data: BookingRow[]; meta: { page: number; limit: number; total: number; totalPages: number } }>('/coworking/bookings', { params })).data,
    enabled: view === 'List',
  });

  const { data: calendar, isLoading: calLoading } = useQuery({
    queryKey: ['cw-calendar', day],
    queryFn: async () => (await api.get<CalendarResponse>('/coworking/calendar', {
      params: { from: new Date(`${day}T00:00:00`).toISOString(), to: new Date(`${day}T23:59:59`).toISOString() },
    })).data,
    enabled: view === 'Calendar',
  });

  const columns: DataTableColumn<BookingRow>[] = [
    { key: 'reference', header: 'Reference', sortable: true, width: 120 },
    {
      key: 'space', header: 'Space',
      render: (r) => (
        <span>
          <span style={{ display: 'block', fontWeight: 560 }}>{r.space.name}</span>
          <span className="ds-caption">{spaceTypeLabel(r.space.type)}</span>
        </span>
      ),
    },
    {
      key: 'contactName', header: 'Customer',
      render: (r) => (
        <span>
          <span style={{ display: 'block' }}>{r.contactName}</span>
          {r.customer && <span className="ds-caption">{r.customer.reference}</span>}
        </span>
      ),
    },
    {
      key: 'startAt', header: 'When', sortable: true,
      render: (r) => (
        <span>
          <span style={{ display: 'block' }}>{fmtDate(r.startAt)}</span>
          <span className="ds-caption">{fmtTime(r.startAt)}–{fmtTime(r.endAt)}</span>
        </span>
      ),
    },
    {
      key: 'totalInr', header: 'Total', align: 'right', sortable: true,
      render: (r) => r.coveredByMembership ? <span className="ds-caption">Membership</span> : money(r.totalInr),
    },
    { key: 'status', header: 'Status', sortable: true, render: (r) => <Badge tone={toneForBookingStatus(r.status)}>{humanStatus(r.status)}</Badge> },
  ];

  return (
    <div className="ds-page">
      <PageHead
        title="Bookings"
        subtitle="Every reservation, one-off and recurring."
        actions={
          <>
            <Segmented options={['List', 'Calendar']} value={view} onChange={(v) => setView(v as 'List' | 'Calendar')} />
            <button className="btn-primary" onClick={() => setSpacePickerOpen(true)}><Plus size={14} style={{ marginRight: 6 }} />New booking</button>
          </>
        }
      />

      {view === 'List' ? (
        <>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center', marginBottom: 14 }}>
            <SearchBox value={state.search} onChange={(v) => set({ search: v })} placeholder="Reference, customer, space…" />
            <StatusSelect value={state.status} onChange={(v) => set({ status: v })} options={BOOKING_STATUSES} />
            <DateRange from={state.from} to={state.to} onChange={(p) => set(p)} />
          </div>

          <Card flush>
            <DataTable
              rows={data?.data ?? []}
              columns={columns}
              rowKey={(r) => r.id}
              loading={isLoading}
              onRowClick={(r) => setOpenId(r.id)}
              empty={<EmptyState compact icon={CalendarDays} title="No bookings yet" body="Open the floor plan and book a space." />}
            />
          </Card>
          <Pagination meta={data?.meta} onPage={(p) => set({ page: p })} />
        </>
      ) : (
        <>
          <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginBottom: 14 }}>
            <input className="input" style={{ maxWidth: 180 }} type="date" value={day} onChange={(e) => setDay(e.target.value)} aria-label="Day" />
            <button className="btn-ghost btn-sm" onClick={() => setDay(toDateInput())}>Today</button>
          </div>
          {calLoading ? (
            <Skeleton rows={3} height={70} />
          ) : !calendar || (!calendar.bookings.length && !calendar.blocks.length) ? (
            <EmptyState icon={CalendarDays} title="Nothing on that day" body="No bookings and no maintenance." />
          ) : (
            <Card pad={18}>
              <Timeline
                items={[
                  ...calendar.bookings.map((b) => ({
                    at: b.startAt,
                    title: `${b.space.name} — ${b.contactName}`,
                    detail: `${fmtTime(b.startAt)}–${fmtTime(b.endAt)} · ${humanStatus(b.status)}${b.coveredByMembership ? ' · membership' : ` · ${money(b.totalInr)}`}`,
                    tone: toneForBookingStatus(b.status),
                  })),
                  ...calendar.blocks.map((b) => ({
                    at: b.startAt,
                    title: `${b.space.name} — ${humanStatus(b.kind)}`,
                    detail: `${fmtTime(b.startAt)}–${fmtTime(b.endAt)}${b.reason ? ` · ${b.reason}` : ''}`,
                    tone: 'claim' as const,
                  })),
                ].sort((a, b) => new Date(a.at).getTime() - new Date(b.at).getTime())}
              />
            </Card>
          )}
        </>
      )}

      <SpacePicker
        open={spacePickerOpen}
        onClose={() => setSpacePickerOpen(false)}
        onPick={(picked) => {
          setSpacePickerOpen(false);
          const s = picked as PickedSpace;
          if (DESK_TYPES.has(s.type) && (s.units ?? 1) > 1) {
            setDeskSpace({ ...s, coverUrl: s.media?.[0]?.url ?? null, floorName: s.floor?.name ?? null, building: s.building?.name ?? null });
          } else setNewBookingSpace(s);
        }}
      />

      <BookingWizard
        space={newBookingSpace}
        open={!!newBookingSpace}
        onClose={() => setNewBookingSpace(null)}
        onBooked={() => qc.invalidateQueries({ queryKey: ['cw-bookings'] })}
      />

      <DeskBookingFlow
        space={deskSpace}
        open={!!deskSpace}
        onClose={() => setDeskSpace(null)}
        onBack={() => { setDeskSpace(null); setSpacePickerOpen(true); }}
        onBooked={() => qc.invalidateQueries({ queryKey: ['cw-bookings'] })}
      />

      {openId && <BookingRecord id={openId} onClose={() => setOpenId(null)} />}
    </div>
  );
}

/* ─────────────────────────────────────────────────────── the record */

interface BookingDetail extends BookingRow {
  addOns: { id: string; quantity: number; unitPriceInr: number; amountInr: number; service: { id: string; name: string; unit: string } }[];
  occurrences: { id: string; reference: string; startAt: string; endAt: string; status: string }[];
  activities: { id: string; kind: string; title: string; body?: string | null; at: string }[];
  baseInr: number; addOnsInr: number; discountInr: number; taxPct: number; taxInr: number;
  invoice?: { id: string; number: string; totalInr: number; amountPaidInr: number; status: string } | null;
}

function BookingRecord({ id, onClose }: { id: string; onClose: () => void }) {
  const qc = useQueryClient();
  const [cancelOpen, setCancelOpen] = useState(false);
  const [cancelReason, setCancelReason] = useState('');
  const [wholeSeries, setWholeSeries] = useState(false);

  const { data: booking, isLoading } = useQuery({
    queryKey: ['cw-booking', id],
    queryFn: async () => (await api.get<BookingDetail>(`/coworking/bookings/${id}`)).data,
  });

  const { data: preview } = useQuery({
    queryKey: ['cw-cancel-preview', id],
    queryFn: async () => (await api.get<{ feeInr: number; refundInr: number; free: boolean; hoursNotice: number }>(`/coworking/bookings/${id}/cancellation-preview`)).data,
    enabled: cancelOpen,
  });

  const invalidate = () => {
    qc.invalidateQueries({ queryKey: ['cw-booking', id] });
    qc.invalidateQueries({ queryKey: ['cw-bookings'] });
    qc.invalidateQueries({ queryKey: ['cw-dashboard'] });
  };

  const act = useMutation({
    mutationFn: (path: string) => api.post(`/coworking/bookings/${id}/${path}`, {}),
    onSuccess: () => { toast.success('Done'); invalidate(); },
    onError: (e) => toast.error(apiErrorMessage(e)),
  });

  const cancel = useMutation({
    mutationFn: () => api.post(`/coworking/bookings/${id}/cancel`, { reason: cancelReason.trim() || undefined, wholeSeries }),
    onSuccess: () => { toast.success('Cancelled'); setCancelOpen(false); invalidate(); },
    onError: (e) => toast.error(apiErrorMessage(e)),
  });

  const invoice = useMutation({
    mutationFn: () => api.post(`/coworking/bookings/${id}/invoice`, {}),
    onSuccess: () => { toast.success('Invoice raised'); invalidate(); },
    onError: (e) => toast.error(apiErrorMessage(e)),
  });

  return (
    <>
      <Drawer
        open
        onClose={onClose}
        title={booking?.reference ?? 'Booking'}
        subtitle={booking ? `${booking.space.name} · ${fmtDateTime(booking.startAt)}` : undefined}
        width={560}
        actions={booking && <Badge tone={toneForBookingStatus(booking.status)}>{humanStatus(booking.status)}</Badge>}
      >
        {isLoading || !booking ? (
          <Skeleton rows={4} height={60} />
        ) : (
          <div style={{ display: 'grid', gap: 22 }}>
            <DetailGrid>
              <Detail label="Customer" value={booking.contactName} />
              <Detail label="Phone" value={booking.contactPhone} />
              <Detail label="Email" value={booking.contactEmail} />
              <Detail label="Guests" value={booking.guests} />
              <Detail label="Charged as" value={humanStatus(booking.mode)} />
              <Detail label="Membership" value={booking.membership?.reference ?? 'None'} />
            </DetailGrid>

            <div>
              <h3 className="ds-h3" style={{ marginBottom: 8 }}>Money</h3>
              <table className="ds-table ds-table-dense">
                <tbody>
                  <tr><td>Base</td><td className="ds-col-num">{money(booking.baseInr)}</td></tr>
                  {booking.addOns.map((a) => (
                    <tr key={a.id}><td>{a.service.name} × {a.quantity}</td><td className="ds-col-num">{money(a.amountInr)}</td></tr>
                  ))}
                  {booking.discountInr > 0 && <tr><td>Discount</td><td className="ds-col-num">−{money(booking.discountInr)}</td></tr>}
                  <tr><td>Tax ({booking.taxPct}%)</td><td className="ds-col-num">{money(booking.taxInr)}</td></tr>
                  <tr><td style={{ fontWeight: 700 }}>Total</td><td className="ds-col-num" style={{ fontWeight: 700 }}>{money(booking.totalInr)}</td></tr>
                  {booking.cancellationFeeInr > 0 && (
                    <tr><td>Cancellation fee</td><td className="ds-col-num">{money(booking.cancellationFeeInr)}</td></tr>
                  )}
                </tbody>
              </table>
              {booking.coveredByMembership && (
                <div className="ds-caption" style={{ marginTop: 8 }}>Covered by the membership allowance — nothing was charged.</div>
              )}
              {booking.invoice ? (
                <div className="ds-list-row" style={{ marginTop: 12 }}>
                  <Receipt size={14} style={{ color: 'var(--ink-3)' }} />
                  <span style={{ fontSize: 13 }}>{booking.invoice.number}</span>
                  <span className="ds-caption" style={{ marginLeft: 'auto' }}>
                    {money(booking.invoice.amountPaidInr)} of {money(booking.invoice.totalInr)} · {humanStatus(booking.invoice.status)}
                  </span>
                </div>
              ) : !booking.coveredByMembership && booking.totalInr > 0 ? (
                <button className="btn-ghost btn-sm" style={{ marginTop: 12 }} disabled={invoice.isPending} onClick={() => invoice.mutate()}>
                  Raise the invoice
                </button>
              ) : null}
            </div>

            {booking.occurrences.length > 0 && (
              <div>
                <h3 className="ds-h3" style={{ marginBottom: 8 }}>Repeats</h3>
                <div style={{ display: 'grid', gap: 6 }}>
                  {booking.occurrences.map((o) => (
                    <div key={o.id} style={{ display: 'flex', gap: 8, fontSize: 12.5 }}>
                      <span>{o.reference}</span>
                      <span className="ds-caption" style={{ marginLeft: 'auto' }}>{fmtDateTime(o.startAt)} · {humanStatus(o.status)}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {booking.notes && (
              <div>
                <h3 className="ds-h3" style={{ marginBottom: 6 }}>Notes</h3>
                <p className="ds-body">{booking.notes}</p>
              </div>
            )}

            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
              {booking.status === 'CONFIRMED' && <button className="btn-primary btn-sm" onClick={() => act.mutate('check-in')}>Check in</button>}
              {booking.status === 'CHECKED_IN' && <button className="btn-primary btn-sm" onClick={() => act.mutate('check-out')}>Check out</button>}
              {['PENDING', 'CONFIRMED', 'CHECKED_IN', 'DRAFT'].includes(booking.status) && (
                <button className="btn-danger btn-sm" onClick={() => setCancelOpen(true)}>Cancel booking</button>
              )}
            </div>

            {booking.activities.length > 0 && (
              <div>
                <h3 className="ds-h3" style={{ marginBottom: 8 }}>History</h3>
                <Timeline dense items={booking.activities.map((a) => ({ at: a.at, title: a.title, detail: a.body ?? undefined }))} />
              </div>
            )}
          </div>
        )}
      </Drawer>

      <Modal
        open={cancelOpen}
        onClose={() => setCancelOpen(false)}
        title="Cancel this booking?"
        width={520}
        footer={
          <>
            <button className="btn-ghost" onClick={() => setCancelOpen(false)}>Keep it</button>
            <button className="btn-danger" style={{ marginLeft: 'auto' }} disabled={cancel.isPending} onClick={() => cancel.mutate()}>
              {cancel.isPending ? 'Cancelling…' : 'Cancel booking'}
            </button>
          </>
        }
      >
        <div style={{ display: 'grid', gap: 14 }}>
          {preview && (
            <div className="ds-card" style={{ padding: 14 }}>
              {preview.free ? (
                <span style={{ fontSize: 13.5 }}>Within the free-cancellation window — nothing will be charged.</span>
              ) : (
                <span style={{ fontSize: 13.5 }}>
                  Only {preview.hoursNotice.toFixed(1)} hours' notice. A cancellation fee of{' '}
                  <strong>{money(preview.feeInr)}</strong> applies; {money(preview.refundInr)} is refundable.
                </span>
              )}
            </div>
          )}
          <Field label="Reason">
            <input className="input" value={cancelReason} onChange={(e) => setCancelReason(e.target.value)} placeholder="Why is it being cancelled?" />
          </Field>
          <label style={{ display: 'flex', gap: 8, alignItems: 'center', fontSize: 13 }}>
            <input type="checkbox" checked={wholeSeries} onChange={(e) => setWholeSeries(e.target.checked)} />
            Cancel every future occurrence of this series
          </label>
        </div>
      </Modal>
    </>
  );
}
