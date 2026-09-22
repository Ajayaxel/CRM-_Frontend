'use client';

import { fmtOrgMoneyExact } from '@/lib/org-locale';
import { ROOM_GST_PCT, SERVICE_PCT, estimateStay } from './pricing';

interface StaySummaryProps {
  nightlyInr: number;
  nights: number;
  additionalChargesInr?: number;
  advanceInr?: number;
  roomTypeName?: string;
}

/**
 * Standard PMS Financial Summary Box
 *
 * Shows full itemized transparency:
 * 2 nights × ₹1,500          ₹3,000
 * Additional charges             ₹0
 * Service charge (10%)         ₹300
 * GST (18% / SAC 996311)       ₹540
 * ─────────────────────────────────
 * Total                      ₹3,840
 * Advance received               ₹0
 * Balance                    ₹3,840
 *
 * The service charge is on this list because the FOLIO posts it — priceNight()
 * in finance/hotel-folio.service.ts writes a SERVICE_CHARGE line for every
 * night. A quote that left it out was not a rounder number, it was a smaller
 * one than the guest is going to be asked for at checkout, and the receptionist
 * would be the person discovering that at the desk.
 */
export function StaySummary({
  nightlyInr,
  nights,
  additionalChargesInr = 0,
  advanceInr = 0,
  roomTypeName,
}: StaySummaryProps) {
  if (!nightlyInr || !nights) return null;

  // Room money comes from the shared estimator so the quote, the footer's
  // Confirm button and the folio cannot drift apart.
  const stay = estimateStay(nightlyInr, nights);
  const roomSubtotal = stay.roomInr;
  const extraCharges = additionalChargesInr || 0;
  // Incidentals carry GST but no service charge — the server taxes them at
  // INCIDENTAL_GST_PCT and posts no service line against them.
  const gst = stay.gstInr + Math.round(extraCharges * (ROOM_GST_PCT / 100));
  const service = stay.serviceInr;
  const total = roomSubtotal + extraCharges + service + gst;
  const advance = advanceInr || 0;
  const balance = Math.max(0, total - advance);

  return (
    <div
      style={{
        background: 'var(--surface-sunken, rgba(0,0,0,0.03))',
        border: '1px solid var(--border)',
        borderRadius: 'var(--radius-md, 8px)',
        padding: '14px 16px',
        marginTop: 12,
        display: 'flex',
        flexDirection: 'column',
        gap: 8,
      }}
    >
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 2 }}>
        <span style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em', color: 'var(--ink-muted)' }}>
          Financial Summary {roomTypeName ? `· ${roomTypeName}` : ''}
        </span>
        <span className="ds-caption" style={{ color: 'var(--ink-muted)', fontSize: 11 }}>
          SAC 996311
        </span>
      </div>

      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13 }}>
        <span style={{ color: 'var(--ink-secondary)' }}>
          {nights} night{nights === 1 ? '' : 's'} × {fmtOrgMoneyExact(nightlyInr)}
        </span>
        <span className="ds-num" style={{ fontWeight: 500 }}>
          {fmtOrgMoneyExact(roomSubtotal)}
        </span>
      </div>

      {extraCharges > 0 && (
        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13 }}>
          <span style={{ color: 'var(--ink-secondary)' }}>Additional charges</span>
          <span className="ds-num">{fmtOrgMoneyExact(extraCharges)}</span>
        </div>
      )}

      {service > 0 && (
        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, color: 'var(--ink-secondary)' }}>
          <span>Service charge ({SERVICE_PCT}%)</span>
          <span className="ds-num">{fmtOrgMoneyExact(service)}</span>
        </div>
      )}

      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, color: 'var(--ink-secondary)' }}>
        <span>GST ({ROOM_GST_PCT}% CGST + SGST)</span>
        <span className="ds-num">{fmtOrgMoneyExact(gst)}</span>
      </div>

      <div
        style={{
          borderTop: '1px dashed var(--border-strong, var(--border))',
          paddingTop: 8,
          marginTop: 2,
          display: 'flex',
          justifyContent: 'space-between',
          fontSize: 14,
          fontWeight: 700,
        }}
      >
        <span>Total Estimated</span>
        <span className="ds-num" style={{ color: 'var(--primary)' }}>
          {fmtOrgMoneyExact(total)}
        </span>
      </div>

      {advance > 0 && (
        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, color: 'var(--tone-active)' }}>
          <span>Advance received</span>
          <span className="ds-num">− {fmtOrgMoneyExact(advance)}</span>
        </div>
      )}

      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          fontSize: 13.5,
          fontWeight: 600,
          background: 'var(--surface, #ffffff)',
          padding: '6px 10px',
          borderRadius: 'var(--radius-sm, 6px)',
          border: '1px solid var(--border)',
          marginTop: 2,
        }}
      >
        <span style={{ color: balance > 0 ? 'var(--ink)' : 'var(--tone-active)' }}>
          {balance > 0 ? 'Balance due at check-in' : 'Fully Settled'}
        </span>
        <span className="ds-num" style={{ color: balance > 0 ? 'var(--tone-renewal)' : 'var(--tone-active)' }}>
          {fmtOrgMoneyExact(balance)}
        </span>
      </div>

      <p className="ds-caption" style={{ margin: '4px 0 0', fontSize: 11, color: 'var(--ink-muted)' }}>
        Incidentals (coffee, tea, laundry, extra bed) will be posted to the guest folio during stay.
      </p>
    </div>
  );
}
