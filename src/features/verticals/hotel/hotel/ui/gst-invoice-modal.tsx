'use client';

/**
 * GST Tax Invoice Modal & Print View for Hotel Folios
 *
 * Fully compliant with Indian GST requirements for hospitality:
 * - SAC 996311 (Room Accommodation Services)
 * - SAC 996331 (Food, Beverage & Incidentals)
 * - Split CGST (9%) + SGST (9%) or IGST (18%)
 * - Itemized charges, payment receipts, and balance footers
 * - Standard letterhead & browser print preview
 */

import { useRef } from 'react';
import { Printer, X, Download, Building2, CheckCircle2 } from 'lucide-react';
import { fmtOrgMoneyExact, useOrgConfig } from '@/lib/org-locale';
import { Badge, fmtDate } from './kit';
import type { FolioView, ReservationRow } from '../types';

interface GSTInvoiceModalProps {
  open: boolean;
  onClose: () => void;
  folioData: FolioView | null;
  reservation: ReservationRow | null;
}

export function GSTInvoiceModal({ open, onClose, folioData, reservation }: GSTInvoiceModalProps) {
  const org = useOrgConfig();
  const printRef = useRef<HTMLDivElement>(null);

  if (!open || !folioData || !folioData.folio) return null;

  const { folio, charges, payments } = folioData;
  const balance = folioData.balanceInr ?? 0;
  const guestName = folio.customerName || (reservation ? `${reservation.guest.firstName} ${reservation.guest.lastName ?? ''}`.trim() : 'Guest');

  const handlePrint = () => {
    window.print();
  };

  return (
    <div
      onClick={onClose}
      style={{
        position: 'fixed',
        inset: 0,
        backgroundColor: 'rgba(0, 0, 0, 0.65)',
        zIndex: 9999,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: 16,
        overflowY: 'auto',
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          background: 'var(--surface, #ffffff)',
          color: 'var(--ink, #0f172a)',
          width: 'min(760px, 100%)',
          maxHeight: '92vh',
          borderRadius: 'var(--radius-lg, 10px)',
          boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.2), 0 8px 10px -6px rgba(0, 0, 0, 0.1)',
          display: 'flex',
          flexDirection: 'column',
          overflow: 'hidden',
        }}
      >
        {/* Modal Action Bar (Hidden on Print) */}
        <div
          className="no-print"
          style={{
            padding: '12px 20px',
            borderBottom: '1px solid var(--border)',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            background: 'var(--surface-sunken, #f8fafc)',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <strong style={{ fontSize: 15 }}>GST Tax Invoice</strong>
            <span className="badge" style={{ fontSize: 11, background: 'var(--tone-active-bg)', color: 'var(--tone-active)' }}>
              {folio.number}
            </span>
          </div>

          <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
            <button className="btn-primary btn-sm" onClick={handlePrint}>
              <Printer size={14} /> Print Invoice
            </button>
            <button className="btn-ghost btn-sm" onClick={onClose}>
              <X size={16} />
            </button>
          </div>
        </div>

        {/* Printable Invoice Body */}
        <div
          ref={printRef}
          style={{
            padding: 32,
            overflowY: 'auto',
            fontFamily: 'inherit',
            fontSize: 13,
            lineHeight: 1.5,
          }}
        >
          {/* Header */}
          <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '2px solid #0f172a', paddingBottom: 18, marginBottom: 20 }}>
            <div>
              <div style={{ fontSize: 22, fontWeight: 800, letterSpacing: '-0.02em', color: 'var(--ink)' }}>
                BMN CONNECT RESIDENCY
              </div>
              <div className="ds-caption" style={{ fontSize: 12, marginTop: 4, color: 'var(--ink-2)' }}>
                Hospitality &amp; Accommodation Services
              </div>
              <div className="ds-caption" style={{ fontSize: 11.5, color: 'var(--ink-3)' }}>
                GSTIN: 32AABCU9603R1ZM · SAC: 996311 / 996331
              </div>
            </div>

            <div style={{ textAlign: 'right' }}>
              <div style={{ fontSize: 16, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em', color: 'var(--ink)' }}>
                TAX INVOICE
              </div>
              <div style={{ fontSize: 14, fontWeight: 600, marginTop: 4 }}>
                {folio.number}
              </div>
              <div className="ds-caption" style={{ color: 'var(--ink-3)' }}>
                Date: {new Date().toLocaleDateString(org.locale, { year: 'numeric', month: 'short', day: 'numeric' })}
              </div>
            </div>
          </div>

          {/* Guest & Stay Meta Grid */}
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: '1fr 1fr',
              gap: 20,
              padding: 14,
              background: '#f8fafc',
              borderRadius: 6,
              border: '1px solid #e2e8f0',
              marginBottom: 20,
            }}
          >
            <div>
              <div style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', color: 'var(--ink-3)', marginBottom: 4 }}>
                Billed To (Guest)
              </div>
              <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--ink)' }}>{guestName}</div>
              {reservation?.guest.phone && (
                <div style={{ fontSize: 12, color: 'var(--ink-2)' }}>Phone: {reservation.guest.phone}</div>
              )}
              {reservation?.guest.email && (
                <div style={{ fontSize: 12, color: 'var(--ink-2)' }}>Email: {reservation.guest.email}</div>
              )}
            </div>

            <div>
              <div style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', color: 'var(--ink-3)', marginBottom: 4 }}>
                Stay Details
              </div>
              <div style={{ fontSize: 13, fontWeight: 600 }}>
                Room: {reservation?.room?.roomNumber ? `Room ${reservation.room.roomNumber}` : 'Standard Room'}
              </div>
              {reservation?.checkInDate && (
                <div style={{ fontSize: 12, color: 'var(--ink-2)' }}>
                  Period: {fmtDate(reservation.checkInDate)} → {fmtDate(reservation.checkOutDate)}
                </div>
              )}
              <div style={{ fontSize: 12, color: 'var(--ink-2)' }}>
                Status: <strong style={{ color: balance <= 0 ? 'var(--tone-active)' : 'var(--tone-renewal)' }}>{folio.status}</strong>
              </div>
            </div>
          </div>

          {/* Itemized Charges Table */}
          <table style={{ width: '100%', borderCollapse: 'collapse', marginBottom: 20 }}>
            <thead>
              <tr style={{ borderBottom: '1.5px solid #0f172a', background: '#f1f5f9' }}>
                <th style={{ textAlign: 'left', padding: '8px 10px', fontSize: 12 }}>Description</th>
                <th style={{ textAlign: 'center', padding: '8px 10px', fontSize: 12, width: 80 }}>SAC Code</th>
                <th style={{ textAlign: 'center', padding: '8px 10px', fontSize: 12, width: 60 }}>Qty</th>
                <th style={{ textAlign: 'right', padding: '8px 10px', fontSize: 12, width: 100 }}>Rate</th>
                <th style={{ textAlign: 'right', padding: '8px 10px', fontSize: 12, width: 110 }}>Amount (₹)</th>
              </tr>
            </thead>
            <tbody>
              {charges.filter((c) => !c.voided).map((c, idx) => (
                <tr key={c.lineId || idx} style={{ borderBottom: '1px solid #e2e8f0' }}>
                  <td style={{ padding: '8px 10px', fontWeight: 500 }}>{c.description}</td>
                  <td style={{ padding: '8px 10px', textAlign: 'center', color: 'var(--ink-3)', fontSize: 11.5 }}>
                    {c.description.toLowerCase().includes('room') ? '996311' : '996331'}
                  </td>
                  <td style={{ padding: '8px 10px', textAlign: 'center' }}>{c.quantity || 1}</td>
                  <td style={{ padding: '8px 10px', textAlign: 'right' }} className="ds-num">
                    {fmtOrgMoneyExact(c.unitPriceInr || c.amountInr)}
                  </td>
                  <td style={{ padding: '8px 10px', textAlign: 'right', fontWeight: 600 }} className="ds-num">
                    {fmtOrgMoneyExact(c.amountInr)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>

          {/* Financial Calculation Footer */}
          <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 24 }}>
            <div style={{ width: 320, display: 'flex', flexDirection: 'column', gap: 6 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13 }}>
                <span style={{ color: 'var(--ink-2)' }}>Taxable Subtotal</span>
                <span className="ds-num" style={{ fontWeight: 500 }}>{fmtOrgMoneyExact(folio.subtotalInr)}</span>
              </div>

              {folio.cgstInr > 0 ? (
                <>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12.5, color: 'var(--ink-3)' }}>
                    <span>CGST (9%)</span>
                    <span className="ds-num">{fmtOrgMoneyExact(folio.cgstInr)}</span>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12.5, color: 'var(--ink-3)' }}>
                    <span>SGST (9%)</span>
                    <span className="ds-num">{fmtOrgMoneyExact(folio.sgstInr)}</span>
                  </div>
                </>
              ) : folio.igstInr > 0 ? (
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12.5, color: 'var(--ink-3)' }}>
                  <span>IGST (18%)</span>
                  <span className="ds-num">{fmtOrgMoneyExact(folio.igstInr)}</span>
                </div>
              ) : (
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12.5, color: 'var(--ink-3)' }}>
                  <span>GST (18%)</span>
                  <span className="ds-num">{fmtOrgMoneyExact(folio.vatInr)}</span>
                </div>
              )}

              <div
                style={{
                  borderTop: '1.5px solid #0f172a',
                  paddingTop: 8,
                  marginTop: 4,
                  display: 'flex',
                  justifyContent: 'space-between',
                  fontSize: 15,
                  fontWeight: 800,
                }}
              >
                <span>Grand Total</span>
                <span className="ds-num">{fmtOrgMoneyExact(folio.totalInr)}</span>
              </div>

              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, color: 'var(--tone-active)', fontWeight: 600 }}>
                <span>Total Amount Paid</span>
                <span className="ds-num">− {fmtOrgMoneyExact(folioData.totalPaymentsInr)}</span>
              </div>

              <div
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  fontSize: 14,
                  fontWeight: 700,
                  background: '#f8fafc',
                  padding: '6px 10px',
                  borderRadius: 4,
                  border: '1px solid #cbd5e1',
                }}
              >
                <span>Balance Due</span>
                <span className="ds-num" style={{ color: balance > 0 ? 'var(--tone-renewal)' : 'var(--tone-active)' }}>
                  {fmtOrgMoneyExact(balance)}
                </span>
              </div>
            </div>
          </div>

          {/* Payment Receipts History */}
          {payments.length > 0 && (
            <div style={{ borderTop: '1px solid #e2e8f0', paddingTop: 14, marginBottom: 20 }}>
              <div style={{ fontSize: 11.5, fontWeight: 700, textTransform: 'uppercase', color: 'var(--ink-3)', marginBottom: 6 }}>
                Payments Recorded
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                {payments.map((p) => (
                  <div
                    key={p.id}
                    style={{
                      display: 'flex',
                      justifyContent: 'space-between',
                      fontSize: 12,
                      color: 'var(--ink-2)',
                    }}
                  >
                    <span>
                      {p.method} Payment {p.reference ? `(Ref: ${p.reference})` : ''} · {fmtDate(p.paidAt)}
                    </span>
                    <strong className="ds-num">{fmtOrgMoneyExact(p.amountInr)}</strong>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Footer declaration */}
          <div style={{ borderTop: '1px dashed #cbd5e1', paddingTop: 14, textAlign: 'center', fontSize: 11, color: 'var(--ink-3)' }}>
            Thank you for staying with BMN Connect Residency. This is a computer generated tax invoice.
          </div>
        </div>
      </div>
    </div>
  );
}
