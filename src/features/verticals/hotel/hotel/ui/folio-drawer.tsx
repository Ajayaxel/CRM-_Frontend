'use client';

/**
 * High-Speed Receptionist Folio Drawer
 *
 * Designed for quick front-desk actions:
 * - Prominent Room & Guest Header with current balance alert badge
 * - Itemized Charges Table with void capability
 * - Instant Quick-Add presets for incidentals (Coffee, Tea, Water, Laundry, Extra Bed, Minibar)
 * - Recorded Payments Table
 * - Record Payment & Checkout Actions
 * - 1-Click Print GST Invoice
 */

import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import {
  Ban,
  CheckCircle2,
  Coffee,
  DollarSign,
  Droplet,
  LogOut,
  Moon,
  Plus,
  Printer,
  Receipt,
  Shirt,
  Sparkles,
  Undo2,
  UtensilsCrossed,
  Wallet,
  X,
} from 'lucide-react';
import { api, apiErrorMessage } from '@/lib/api';
import { fmtOrgMoneyExact } from '@/lib/org-locale';
import { useAuthStore } from '@/features/foundation/auth';
import { Badge, Card, Drawer, EmptyState, Field, Skeleton } from './kit';
import { GSTInvoiceModal } from './gst-invoice-modal';
import type { FolioView, ReservationRow } from '../types';

const CHARGE_PRESETS = [
  { label: 'Coffee (₹100)', cat: 'COFFEE', desc: 'Coffee', unit: 100, icon: Coffee },
  { label: 'Tea (₹40)', cat: 'TEA', desc: 'Tea', unit: 40, icon: Coffee },
  { label: 'Mineral Water (₹20)', cat: 'WATER', desc: 'Packaged Drinking Water', unit: 20, icon: Droplet },
  { label: 'Laundry (₹250)', cat: 'LAUNDRY', desc: 'Laundry Service', unit: 250, icon: Shirt },
  { label: 'Extra Bed (₹500)', cat: 'EXTRA_BED', desc: 'Extra Rollaway Bed', unit: 500, icon: Moon },
  { label: 'Minibar (₹150)', cat: 'MINIBAR', desc: 'Minibar Snacks & Drinks', unit: 150, icon: UtensilsCrossed },
];

export function FolioDrawer({
  reservation,
  onClose,
  onCheckedOut,
}: {
  reservation: ReservationRow | null;
  onClose: () => void;
  onCheckedOut?: () => void;
}) {
  const qc = useQueryClient();
  const canWaive = useAuthStore((s) => s.hasPermission('hotel.finance'));
  const [showAddCharge, setShowAddCharge] = useState(false);
  const [showRecordPayment, setShowRecordPayment] = useState(false);
  const [showGSTInvoice, setShowGSTInvoice] = useState(false);

  // Charge form state
  const [chargeCat, setChargeCat] = useState('COFFEE');
  const [chargeDesc, setChargeDesc] = useState('');
  const [chargeQty, setChargeQty] = useState(1);
  const [chargeUnit, setChargeUnit] = useState<number | ''>('');

  // Payment form state
  const [payAmount, setPayAmount] = useState<number | ''>('');
  const [payMethod, setPayMethod] = useState('CASH');
  const [payRef, setPayRef] = useState('');

  const { data, isLoading } = useQuery<FolioView>({
    queryKey: ['hotel-folio', reservation?.id],
    queryFn: async () => (await api.get(`/hotel/reservations/${reservation!.id}/folio`)).data,
    enabled: Boolean(reservation?.id),
  });

  const folioId = data?.folio?.id ?? null;
  // POSTED is ledger truth; ESTIMATED is what the guest will owe at checkout.
  // Room nights are recognised at checkout, so an in-house guest's posted
  // balance can honestly read ₹250 while the stay is three nights into ₹2,560.
  // Quoting the posted figure at the desk is how a guest gets a surprise.
  const balance = data?.postedBalanceInr ?? data?.balanceInr ?? 0;
  const projectedNights = data?.unpostedNights ?? 0;
  const projectedRoomInr = data?.estimatedAccommodationInr ?? 0;
  const estimatedBalance = data?.estimatedBalanceInr ?? balance;
  // Only a live stay with nights still to charge needs the projection shown.
  const showProjection = projectedNights > 0;
  const headlineInr = showProjection ? estimatedBalance : balance;
  const guestFullName = reservation
    ? `${reservation.guest.firstName} ${reservation.guest.lastName ?? ''}`.trim()
    : data?.folio?.customerName ?? 'Guest';

  const refresh = () => {
    qc.invalidateQueries({ queryKey: ['hotel-folio', reservation?.id] });
    qc.invalidateQueries({ queryKey: ['hotel-reception'] });
    qc.invalidateQueries({ queryKey: ['hotel-reservations'] });
    qc.invalidateQueries({ queryKey: ['hotel-folios'] });
  };

  const addCharge = useMutation({
    mutationFn: async ({
      category,
      description,
      quantity,
      unitAmountInr,
    }: {
      category: string;
      description?: string;
      quantity: number;
      unitAmountInr: number;
    }) =>
      (
        await api.post(`/hotel/folios/${folioId}/charges`, {
          category,
          description: description || undefined,
          quantity,
          unitAmountInr,
        })
      ).data,
    onSuccess: () => {
      toast.success('Charge posted to folio');
      setChargeDesc('');
      setChargeQty(1);
      setChargeUnit('');
      setShowAddCharge(false);
      refresh();
    },
    onError: (e) => toast.error(apiErrorMessage(e)),
  });

  const voidCharge = useMutation({
    mutationFn: async (chargeId: string) =>
      (
        await api.post(`/hotel/folios/${folioId}/charges/${chargeId}/void`, {
          reason: 'Voided at front desk',
        })
      ).data,
    onSuccess: () => {
      toast.success('Charge reversed & credited');
      refresh();
    },
    onError: (e) => toast.error(apiErrorMessage(e)),
  });

  const recordPayment = useMutation({
    mutationFn: async () =>
      (
        // The hospitality route, not the generic finance one. /finance/invoices
        // refuses anything that is not kind INVOICE — a folio is kind FOLIO, so
        // Record Payment returned 400 "Payments apply to invoices only" every
        // time it was pressed. This route knows what a folio is, checks the
        // property scope, and sits on the front-desk permission.
        await api.post(`/hotel/folios/${folioId}/payments`, {
          amountInr: payAmount === '' ? balance : payAmount,
          method: payMethod,
          reference: payRef || undefined,
        })
      ).data,
    onSuccess: () => {
      toast.success('Payment recorded successfully');
      setPayAmount('');
      setPayRef('');
      setShowRecordPayment(false);
      refresh();
    },
    onError: (e) => toast.error(apiErrorMessage(e)),
  });

  const checkOut = useMutation({
    mutationFn: async (opts: { payment?: { amountInr: number; method: string }; allowOutstanding?: boolean }) =>
      (await api.post(`/hotel/reservations/${reservation!.id}/check-out`, opts)).data,
    onSuccess: (res: any) => {
      toast.success(`Guest checked out — Folio ${res.folio.status.toLowerCase()}, room released for housekeeping`);
      refresh();
      if (onCheckedOut) onCheckedOut();
      onClose();
    },
    onError: (e) => toast.error(apiErrorMessage(e)),
  });

  const postPreset = (preset: typeof CHARGE_PRESETS[0]) => {
    addCharge.mutate({
      category: preset.cat,
      description: preset.desc,
      quantity: 1,
      unitAmountInr: preset.unit,
    });
  };

  return (
    <Drawer
      open={Boolean(reservation)}
      onClose={onClose}
      title={
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <span>{reservation?.room?.roomNumber ? `Room ${reservation.room.roomNumber}` : 'Guest Folio'}</span>
          <span style={{ color: 'var(--ink-muted)', fontWeight: 400 }}>·</span>
          <span>{guestFullName}</span>
        </div>
      }
      subtitle={
        data?.folio
          ? `Folio ${data.folio.number} · ${data.folio.status}`
          : 'Guest Billing & Settlement'
      }
      width={640}
    >
      {isLoading ? (
        <Skeleton rows={6} />
      ) : !data?.folio ? (
        <EmptyState
          icon={Receipt}
          title="No Folio Open Yet"
          body="A folio is opened automatically when the room is assigned or when charges are posted."
        />
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          {/* Prominent Balance Banner */}
          <div
            className="ds-card"
            style={{
              padding: '16px 20px',
              borderRadius: 'var(--radius-lg, 10px)',
              background:
                balance > 0
                  ? 'var(--tone-renewal-bg)'
                  : 'var(--tone-active-bg)',
              border: `1.5px solid ${
                balance > 0
                  ? 'var(--tone-renewal-line)'
                  : 'var(--tone-active-line)'
              }`,
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
            }}
          >
            <div>
              <span
                style={{
                  fontSize: 11.5,
                  fontWeight: 700,
                  textTransform: 'uppercase',
                  letterSpacing: '0.06em',
                  color: balance > 0 ? 'var(--tone-renewal)' : 'var(--tone-active)',
                }}
              >
                Current Folio Balance
              </span>
              <div
                className="ds-num"
                style={{
                  fontSize: 28,
                  fontWeight: 800,
                  lineHeight: 1.1,
                  marginTop: 4,
                  color: balance > 0 ? 'var(--tone-renewal)' : 'var(--tone-active)',
                }}
              >
                {fmtOrgMoneyExact(headlineInr)}
              </div>
              <div className="ds-caption" style={{ color: balance > 0 ? 'var(--tone-renewal)' : 'var(--tone-active)', marginTop: 2 }}>
                {showProjection
                  ? 'Estimated balance at checkout'
                  : balance > 0 ? 'Outstanding balance to collect' : 'All charges paid in full'}
              </div>

              {/* The arithmetic behind the headline, so nobody has to trust it.
                  Accommodation is a PROJECTION — it is not on the folio and has
                  not been posted to the ledger, and the note says so rather than
                  letting the guest discover it at checkout. */}
              {showProjection && (
                <dl className="hs-projection">
                  <div><dt>Charges posted so far</dt><dd className="ds-num">{fmtOrgMoneyExact(data!.postedChargesInr)}</dd></div>
                  <div>
                    <dt>
                      {projectedNights} night{projectedNights === 1 ? '' : 's'} not yet charged
                    </dt>
                    <dd className="ds-num">{fmtOrgMoneyExact(projectedRoomInr)}</dd>
                  </div>
                  <div><dt>Payments received</dt><dd className="ds-num">{fmtOrgMoneyExact(data!.totalPaymentsInr)}</dd></div>
                  <div className="hs-projection-note">
                    Room nights are billed at checkout, so they are not on the folio yet.
                  </div>
                </dl>
              )}
            </div>

            {/* Quick Action Button Group */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6, alignItems: 'flex-end' }}>
              <button
                className="btn-secondary btn-sm"
                style={{ background: 'var(--surface)', fontSize: 12 }}
                onClick={() => setShowGSTInvoice(true)}
              >
                <Printer size={13} /> Print GST Invoice
              </button>

              {balance > 0 && (
                <button
                  className="btn-primary btn-sm"
                  onClick={() => {
                    setPayAmount(balance);
                    setShowRecordPayment(true);
                  }}
                >
                  <Wallet size={13} /> Record Payment
                </button>
              )}
            </div>
          </div>

          {/* Quick Incidental Charge Presets */}
          <div
            className="ds-card"
            style={{
              padding: 14,
              border: '1px solid var(--border)',
              borderRadius: 'var(--radius-md, 8px)',
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
              <span
                style={{
                  fontSize: 11.5,
                  fontWeight: 700,
                  textTransform: 'uppercase',
                  letterSpacing: '0.05em',
                  color: 'var(--ink-secondary)',
                }}
              >
                Quick Add Charge (1-Click)
              </span>
              <button
                className="btn-ghost btn-sm"
                style={{ fontSize: 12 }}
                onClick={() => setShowAddCharge(!showAddCharge)}
              >
                <Plus size={13} /> Custom Charge
              </button>
            </div>

            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
              {CHARGE_PRESETS.map((p) => {
                const Icon = p.icon;
                return (
                  <button
                    key={p.cat}
                    className="btn-secondary btn-sm"
                    disabled={addCharge.isPending}
                    style={{ fontSize: 12, display: 'flex', alignItems: 'center', gap: 5 }}
                    onClick={() => postPreset(p)}
                  >
                    <Icon size={13} /> {p.label}
                  </button>
                );
              })}
            </div>

            {/* Custom Charge Form Collapsible */}
            {showAddCharge && (
              <div
                style={{
                  marginTop: 12,
                  padding: 12,
                  background: 'var(--surface-sunken, #f8fafc)',
                  borderRadius: 6,
                  border: '1px solid var(--border)',
                }}
              >
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                  <Field label="Description / Item">
                    <input
                      className="input"
                      value={chargeDesc}
                      onChange={(e) => setChargeDesc(e.target.value)}
                      placeholder="e.g. Room Service, Ironing"
                    />
                  </Field>
                  <Field label="Amount (₹)">
                    <input
                      className="input"
                      type="number"
                      min={1}
                      value={chargeUnit}
                      placeholder="e.g. 150"
                      onChange={(e) => setChargeUnit(e.target.value === '' ? '' : Number(e.target.value))}
                    />
                  </Field>
                </div>
                <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, marginTop: 10 }}>
                  <button className="btn-ghost btn-sm" onClick={() => setShowAddCharge(false)}>
                    Cancel
                  </button>
                  <button
                    className="btn-primary btn-sm"
                    disabled={!chargeDesc.trim() || !chargeUnit || addCharge.isPending}
                    onClick={() =>
                      addCharge.mutate({
                        category: chargeCat,
                        description: chargeDesc,
                        quantity: 1,
                        unitAmountInr: Number(chargeUnit),
                      })
                    }
                  >
                    Post Charge
                  </button>
                </div>
              </div>
            )}
          </div>

          {/* Record Payment Form Modal / Section */}
          {showRecordPayment && (
            <div
              className="ds-card"
              style={{
                padding: 14,
                border: '1.5px solid var(--tone-info-line)',
                background: 'var(--tone-info-bg)',
                borderRadius: 'var(--radius-md, 8px)',
              }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                <strong style={{ fontSize: 13.5, color: 'var(--tone-sales)' }}>Record Payment</strong>
                <button className="btn-ghost btn-sm" onClick={() => setShowRecordPayment(false)}>
                  <X size={14} />
                </button>
              </div>

              <div className="ds-field-pair" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                <Field label="Payment Amount (₹)">
                  <input
                    className="input"
                    type="number"
                    min={1}
                    value={payAmount}
                    onChange={(e) => setPayAmount(e.target.value === '' ? '' : Number(e.target.value))}
                  />
                </Field>
                <Field label="Payment Method">
                  <select className="input" value={payMethod} onChange={(e) => setPayMethod(e.target.value)}>
                    {['CASH', 'UPI', 'CARD', 'ONLINE', 'BANK', 'CHEQUE'].map((m) => (
                      <option key={m} value={m}>
                        {m}
                      </option>
                    ))}
                  </select>
                </Field>
              </div>

              <div style={{ marginTop: 8 }}>
                <Field label="Reference / Transaction ID (Optional)">
                  <input
                    className="input"
                    value={payRef}
                    onChange={(e) => setPayRef(e.target.value)}
                    placeholder="e.g. UPI / GooglePay Ref #"
                  />
                </Field>
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, marginTop: 10 }}>
                <button
                  className="btn-ghost btn-sm"
                  onClick={() => {
                    setPayAmount(balance);
                  }}
                >
                  Pay Full Balance ({fmtOrgMoneyExact(balance)})
                </button>
                <button
                  className="btn-primary btn-sm"
                  disabled={!payAmount || recordPayment.isPending}
                  onClick={() => recordPayment.mutate()}
                >
                  {recordPayment.isPending ? 'Recording…' : `Collect ${fmtOrgMoneyExact(payAmount || 0)}`}
                </button>
              </div>
            </div>
          )}

          {/* Charges Table */}
          <div className="ds-card" style={{ overflow: 'hidden' }}>
            <div
              style={{
                padding: '10px 14px',
                background: 'var(--surface-sunken, #f8fafc)',
                borderBottom: '1px solid var(--border)',
                fontWeight: 600,
                fontSize: 13,
              }}
            >
              Itemized Folio Charges
            </div>
            <table className="ds-table" style={{ width: '100%' }}>
              <thead>
                <tr>
                  <th>Description</th>
                  <th style={{ textAlign: 'center', width: 60 }}>Qty</th>
                  <th style={{ textAlign: 'right', width: 100 }}>Amount</th>
                  <th style={{ width: 40 }}></th>
                </tr>
              </thead>
              <tbody>
                {(data.charges ?? []).map((c) => (
                  <tr
                    key={c.lineId}
                    style={c.voided ? { opacity: 0.45, textDecoration: 'line-through' } : undefined}
                  >
                    <td>
                      <div style={{ fontWeight: 500 }}>{c.description}</div>
                      <div className="ds-caption">{c.type}</div>
                    </td>
                    <td style={{ textAlign: 'center' }}>{c.quantity || 1}</td>
                    <td style={{ textAlign: 'right', whiteSpace: 'nowrap' }} className="ds-num">
                      {fmtOrgMoneyExact(c.amountInr)}
                    </td>
                    <td style={{ textAlign: 'right' }}>
                      {c.voidable && !c.voided && canWaive && (
                        <button
                          className="btn-ghost btn-sm"
                          title="Reverse this charge"
                          disabled={voidCharge.isPending}
                          onClick={() => voidCharge.mutate(c.chargeId!)}
                        >
                          <Undo2 size={13} />
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr>
                  <td>Subtotal</td>
                  <td />
                  <td style={{ textAlign: 'right' }} className="ds-num">
                    {fmtOrgMoneyExact(data.folio.subtotalInr)}
                  </td>
                  <td />
                </tr>
                <tr>
                  <td>GST ({data.folio.igstInr > 0 ? 'IGST 18%' : 'CGST + SGST 18%'})</td>
                  <td />
                  <td style={{ textAlign: 'right' }} className="ds-num">
                    {fmtOrgMoneyExact(data.folio.vatInr)}
                  </td>
                  <td />
                </tr>
                <tr style={{ fontWeight: 700 }}>
                  <td>Total Folio Value</td>
                  <td />
                  <td style={{ textAlign: 'right' }} className="ds-num">
                    {fmtOrgMoneyExact(data.folio.totalInr)}
                  </td>
                  <td />
                </tr>
                <tr style={{ color: 'var(--tone-active)' }}>
                  <td>Total Payments Received</td>
                  <td />
                  <td style={{ textAlign: 'right' }} className="ds-num">
                    − {fmtOrgMoneyExact(data.totalPaymentsInr)}
                  </td>
                  <td />
                </tr>
                <tr style={{ fontWeight: 800, fontSize: 14, background: 'var(--surface-sunken)' }}>
                  <td>Net Balance</td>
                  <td />
                  <td style={{ textAlign: 'right' }}>
                    <Badge tone={balance > 0 ? 'renewal' : 'active'}>{fmtOrgMoneyExact(balance)}</Badge>
                  </td>
                  <td />
                </tr>
              </tfoot>
            </table>
          </div>

          {/* Payments Record List */}
          {data.payments.length > 0 && (
            <div className="ds-card" style={{ padding: 14 }}>
              <div style={{ fontSize: 12, fontWeight: 700, textTransform: 'uppercase', color: 'var(--ink-secondary)', marginBottom: 8 }}>
                Recorded Payments ({data.payments.length})
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                {data.payments.map((p) => (
                  <div
                    key={p.id}
                    style={{
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center',
                      fontSize: 12.5,
                      padding: '4px 0',
                      borderBottom: '1px dashed var(--border)',
                    }}
                  >
                    <div>
                      <span className="badge" style={{ fontSize: 11, marginRight: 6 }}>
                        {p.method}
                      </span>
                      <span>{p.reference ? `Ref: ${p.reference}` : 'Payment received'}</span>
                    </div>
                    <strong className="ds-num">{fmtOrgMoneyExact(p.amountInr)}</strong>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Receptionist Checkout Action Bar */}
          {reservation?.status === 'CHECKED_IN' && (
            <div
              style={{
                borderTop: '1.5px solid var(--border)',
                paddingTop: 16,
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                flexWrap: 'wrap',
                gap: 10,
              }}
            >
              <div className="ds-caption" style={{ maxWidth: 280 }}>
                {balance > 0
                  ? 'Collect the remaining balance to finalize checkout, or check out with permission.'
                  : 'Folio is fully settled. Room will be released for housekeeping upon checkout.'}
              </div>

              <div style={{ display: 'flex', gap: 8 }}>
                {balance > 0 && canWaive && (
                  <button
                    className="btn-secondary"
                    disabled={checkOut.isPending}
                    onClick={() => checkOut.mutate({ allowOutstanding: true })}
                    title="Checkout guest leaving balance on accounts receivable"
                  >
                    Checkout Owing {fmtOrgMoneyExact(balance)}
                  </button>
                )}

                <button
                  className="btn-primary"
                  disabled={checkOut.isPending}
                  onClick={() =>
                    checkOut.mutate(
                      balance > 0
                        ? { payment: { amountInr: balance, method: payMethod } }
                        : {}
                    )
                  }
                >
                  <LogOut size={15} />
                  {balance > 0
                    ? `Collect ${fmtOrgMoneyExact(balance)} & Checkout`
                    : 'Checkout Guest & Release Room'}
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* GST Invoice Modal */}
      <GSTInvoiceModal
        open={showGSTInvoice}
        onClose={() => setShowGSTInvoice(false)}
        folioData={data ?? null}
        reservation={reservation}
      />
    </Drawer>
  );
}
