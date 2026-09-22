'use client';

/**
 * Hotel Folios Register — Guest Bills & GST Settlements
 *
 * Matches the BMN Connect Finance visual structure:
 * Folio # | Guest | Room | Stay Period | Total | Paid | Balance | Status | Actions
 * Open → Print GST Invoice → Record Payment
 */

import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import {
  DollarSign,
  Eye,
  Filter,
  Printer,
  Receipt,
  Search,
  Wallet,
} from 'lucide-react';
import { api } from '@/lib/api';
import { fmtOrgMoneyExact } from '@/lib/org-locale';
import { Badge, EmptyState, Segmented, Skeleton, fmtDate, type DataTableColumn } from '../ui/kit';
import { HospitalityPage, HospitalitySection } from '../ui/page-shell';
import { useHotelProperty } from '../hooks/use-hotel-property';
import { FolioDrawer } from '../ui/folio-drawer';
import { GSTInvoiceModal } from '../ui/gst-invoice-modal';
import type { FolioView, ReservationRow } from '../types';

interface FolioRow {
  id: string;
  number: string;
  status: string;
  customerName: string;
  roomNumber: string | null;
  reservationId: string | null;
  reservationStatus: string | null;
  checkInDate: string | null;
  checkOutDate: string | null;
  totalInr: number;
  paidInr: number;
  balanceInr: number;
  issueDate: string;
}

const STATUS_TONE: Record<string, string> = {
  PAID: 'active',
  PARTIAL: 'renewal',
  SENT: 'sales',
  DRAFT: 'neutral',
  OVERDUE: 'expired',
  CANCELLED: 'expired',
};

export function FoliosFeature() {
  const { propertyId } = useHotelProperty();
  const [view, setView] = useState<'Open' | 'Paid' | 'All'>('Open');
  const [search, setSearch] = useState('');
  const [openFolioReservation, setOpenFolioReservation] = useState<ReservationRow | null>(null);
  const [printFolioId, setPrintFolioId] = useState<string | null>(null);

  const { data: folios = [], isLoading } = useQuery<FolioRow[]>({
    queryKey: ['hotel-folios', propertyId, view],
    queryFn: async () =>
      (
        await api.get('/hotel/folios', {
          params: { propertyId, open: view === 'Open' ? 'true' : undefined },
        })
      ).data,
    enabled: Boolean(propertyId),
  });

  // Query for printable GST invoice view when clicked
  const { data: printableFolioData } = useQuery<FolioView>({
    queryKey: ['hotel-folio-print', printFolioId],
    queryFn: async () => (await api.get(`/hotel/folios/${printFolioId}`)).data,
    enabled: Boolean(printFolioId),
  });

  const filteredFolios = folios.filter((f) => {
    if (view === 'Paid' && f.status !== 'PAID') return false;
    if (search.trim()) {
      const q = search.toLowerCase();
      const num = f.number.toLowerCase();
      const guest = f.customerName.toLowerCase();
      const room = (f.roomNumber ?? '').toLowerCase();
      if (!num.includes(q) && !guest.includes(q) && !room.includes(q)) return false;
    }
    return true;
  });

  const openFolioFor = (f: FolioRow) => {
    setOpenFolioReservation({
      id: f.reservationId ?? f.id,
      status: (f.reservationStatus ?? 'CHECKED_OUT') as ReservationRow['status'],
      checkInDate: f.checkInDate ?? '',
      checkOutDate: f.checkOutDate ?? '',
      totalPriceInr: f.totalInr,
      amountPaidInr: f.paidInr,
      propertyId: propertyId ?? '',
      guest: { id: '', firstName: f.customerName, lastName: null, phone: null, email: null },
      category: null,
      room: f.roomNumber ? { id: '', roomNumber: f.roomNumber } : null,
    });
  };

  const totalOutstanding = folios.reduce((sum, f) => sum + Math.max(0, f.balanceInr), 0);
  const totalSettled = folios.reduce((sum, f) => sum + f.paidInr, 0);

  return (
    <HospitalityPage
      title="Folios &amp; Invoices"
      subtitle={`${folios.length} folios · ${fmtOrgMoneyExact(totalOutstanding)} pending balance · ${fmtOrgMoneyExact(totalSettled)} collected`}
    >
      <HospitalitySection
        title="Guest Folios"
        tools={
          <div style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
            <div style={{ position: 'relative' }}>
              <input
                className="input"
                placeholder="Search folio, guest, room…"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                style={{ width: 240, paddingLeft: 30 }}
              />
              <Search size={14} style={{ position: 'absolute', left: 10, top: 10, color: 'var(--ink-muted)' }} />
            </div>
            <Segmented
              options={['Open', 'Paid', 'All']}
              value={view}
              onChange={(v) => setView(v as typeof view)}
            />
          </div>
        }
      >
        {isLoading ? (
          <Skeleton rows={6} />
        ) : filteredFolios.length === 0 ? (
          <EmptyState
            icon={Receipt}
            title={view === 'Open' ? 'No Open Folios' : 'No Folios Found'}
            body={
              view === 'Open'
                ? 'All guest bills have been fully settled.'
                : 'Folios are generated automatically when stays are created.'
            }
          />
        ) : (
          <div className="ds-card" style={{ overflowX: 'auto' }}>
            <table className="ds-table" style={{ width: '100%' }}>
              <thead>
                <tr>
                  <th>Folio #</th>
                  <th>Guest</th>
                  <th>Room</th>
                  <th>Stay Period</th>
                  <th style={{ textAlign: 'right' }}>Total</th>
                  <th style={{ textAlign: 'right' }}>Paid</th>
                  <th style={{ textAlign: 'right' }}>Balance</th>
                  <th>Status</th>
                  <th style={{ textAlign: 'right' }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {filteredFolios.map((f) => {
                  const hasBalance = f.balanceInr > 0;
                  return (
                    <tr key={f.id} onClick={() => openFolioFor(f)} style={{ cursor: 'pointer' }}>
                      <td>
                        <strong className="ds-num" style={{ fontSize: 13.5 }}>
                          {f.number}
                        </strong>
                      </td>
                      <td>
                        <div style={{ fontWeight: 600 }}>{f.customerName}</div>
                      </td>
                      <td>
                        {f.roomNumber ? (
                          <strong className="ds-num" style={{ fontSize: 13 }}>
                            Room {f.roomNumber}
                          </strong>
                        ) : (
                          <span className="ds-caption">—</span>
                        )}
                      </td>
                      <td>
                        {f.checkInDate ? (
                          <div>
                            {fmtDate(f.checkInDate)} → {fmtDate(f.checkOutDate)}
                          </div>
                        ) : (
                          <span className="ds-caption">—</span>
                        )}
                      </td>
                      <td style={{ textAlign: 'right' }} className="ds-num">
                        {fmtOrgMoneyExact(f.totalInr)}
                      </td>
                      <td style={{ textAlign: 'right' }} className="ds-num">
                        {fmtOrgMoneyExact(f.paidInr)}
                      </td>
                      <td style={{ textAlign: 'right' }}>
                        <span
                          className="badge"
                          style={{
                            background: hasBalance ? 'var(--tone-renewal-bg)' : 'var(--tone-active-bg)',
                            color: hasBalance ? 'var(--tone-renewal)' : 'var(--tone-active)',
                            fontWeight: 700,
                          }}
                        >
                          {hasBalance ? fmtOrgMoneyExact(f.balanceInr) : '₹0 (Settled)'}
                        </span>
                      </td>
                      <td>
                        <Badge tone={(STATUS_TONE[f.status] ?? 'neutral') as any}>
                          {f.status.toLowerCase()}
                        </Badge>
                      </td>
                      <td style={{ textAlign: 'right', whiteSpace: 'nowrap' }} onClick={(e) => e.stopPropagation()}>
                        <div style={{ display: 'flex', gap: 6, justifyContent: 'flex-end' }}>
                          <button
                            className="btn-ghost btn-sm"
                            title="Print GST Invoice"
                            onClick={() => setPrintFolioId(f.id)}
                          >
                            <Printer size={13} />
                          </button>
                          <button
                            className="btn-secondary btn-sm"
                            onClick={() => openFolioFor(f)}
                          >
                            <Eye size={13} /> Open
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </HospitalitySection>

      {/* Folio Drawer */}
      <FolioDrawer
        reservation={openFolioReservation}
        onClose={() => setOpenFolioReservation(null)}
        onCheckedOut={() => setOpenFolioReservation(null)}
      />

      {/* GST Invoice Modal Printer */}
      <GSTInvoiceModal
        open={Boolean(printFolioId)}
        onClose={() => setPrintFolioId(null)}
        folioData={printableFolioData ?? null}
        reservation={openFolioReservation}
      />
    </HospitalityPage>
  );
}
