'use client';

/**
 * Reservations — Future Stays, In-House Guests, and Booking History
 */

import { useMemo, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import {
  CalendarDays,
  CheckCircle2,
  LogIn,
  LogOut,
  Receipt,
  Search,
  UserPlus,
  Users,
} from 'lucide-react';
import { api } from '@/lib/api';
import { fmtOrgMoneyExact } from '@/lib/org-locale';
import { Badge, EmptyState, Segmented, Skeleton, fmtDate, type DataTableColumn } from '../ui/kit';
import { HospitalityPage, HospitalitySection } from '../ui/page-shell';
import { RESERVATION_TONE } from '../ui/tone';
import { useHotelProperty } from '../hooks/use-hotel-property';
import { RoomBookingFlow } from '../ui/room-booking-flow';
import { WalkInModal } from '../ui/walk-in-modal';
import { CheckInModal } from '../ui/check-in-modal';
import { FolioDrawer } from '../ui/folio-drawer';
import type { ReservationRow } from '../types';

export function ReservationsFeature() {
  const qc = useQueryClient();
  const { propertyId, categories, property } = useHotelProperty();
  const [newRes, setNewRes] = useState(false);
  const [walkIn, setWalkIn] = useState(false);
  const [checkingIn, setCheckingIn] = useState<ReservationRow | null>(null);
  const [folioFor, setFolioFor] = useState<ReservationRow | null>(null);
  const [filter, setFilter] = useState<'All' | 'Upcoming' | 'In House' | 'Completed' | 'Cancelled'>('All');
  const [search, setSearch] = useState('');

  const { data: reservations = [], isLoading } = useQuery<ReservationRow[]>({
    queryKey: ['hotel-reservations', propertyId],
    queryFn: async () => (await api.get('/hotel/reservations')).data,
    enabled: Boolean(propertyId),
  });

  const refresh = () => {
    qc.invalidateQueries({ queryKey: ['hotel-reservations'] });
    qc.invalidateQueries({ queryKey: ['hotel-reception'] });
    qc.invalidateQueries({ queryKey: ['hotel-folios'] });
  };

  const filteredRows = useMemo(() => {
    return reservations.filter((r) => {
      // Filter by status tab
      if (filter === 'Upcoming' && r.status !== 'CONFIRMED') return false;
      if (filter === 'In House' && r.status !== 'CHECKED_IN') return false;
      if (filter === 'Completed' && r.status !== 'CHECKED_OUT') return false;
      if (filter === 'Cancelled' && !['CANCELLED', 'NO_SHOW'].includes(r.status)) return false;

      // Filter by search term
      if (search.trim()) {
        const q = search.toLowerCase();
        const name = `${r.guest.firstName} ${r.guest.lastName ?? ''}`.toLowerCase();
        const phone = (r.guest.phone ?? '').toLowerCase();
        const email = (r.guest.email ?? '').toLowerCase();
        const room = (r.room?.roomNumber ?? '').toLowerCase();
        const category = (r.category?.name ?? '').toLowerCase();
        if (!name.includes(q) && !phone.includes(q) && !email.includes(q) && !room.includes(q) && !category.includes(q)) {
          return false;
        }
      }

      return true;
    });
  }, [reservations, filter, search]);

  const upcomingCount = reservations.filter((r) => r.status === 'CONFIRMED').length;
  const inHouseCount = reservations.filter((r) => r.status === 'CHECKED_IN').length;

  return (
    <HospitalityPage
      title="Reservations"
      subtitle={`${reservations.length} total booking${reservations.length === 1 ? '' : 's'} · ${inHouseCount} in house · ${upcomingCount} upcoming`}
      actions={
        <>
          <button className="btn-secondary" onClick={() => setWalkIn(true)}>
            <UserPlus size={15} /> Walk-in Guest
          </button>
          <button className="btn-primary" onClick={() => setNewRes(true)}>
            <LogIn size={15} /> New Reservation
          </button>
        </>
      }
    >
      <HospitalitySection
        title="Reservations Register"
        tools={
          <div style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
            <div style={{ position: 'relative' }}>
              <input
                className="input"
                placeholder="Search guest, phone, room…"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                style={{ width: 240, paddingLeft: 30 }}
              />
              <Search size={14} style={{ position: 'absolute', left: 10, top: 10, color: 'var(--ink-muted)' }} />
            </div>
            <Segmented
              options={['All', 'Upcoming', 'In House', 'Completed', 'Cancelled']}
              value={filter}
              onChange={(v) => setFilter(v as typeof filter)}
            />
          </div>
        }
      >
        {isLoading ? (
          <Skeleton rows={6} />
        ) : filteredRows.length === 0 ? (
          <EmptyState
            icon={CalendarDays}
            title={search ? 'No Matching Reservations' : filter === 'All' ? 'No Reservations Yet' : `No ${filter} Reservations`}
            body={
              search
                ? 'Try adjusting your search criteria.'
                : filter === 'All'
                ? 'Take a new reservation or check in a walk-in guest at the front desk.'
                : `No reservations currently have status '${filter.toLowerCase()}'.`
            }
            actionLabel={filter === 'All' && !search ? 'New Reservation' : undefined}
            onAction={filter === 'All' && !search ? () => setNewRes(true) : undefined}
          />
        ) : (
          <div className="ds-card" style={{ overflowX: 'auto' }}>
            <table className="ds-table" style={{ width: '100%' }}>
              <thead>
                <tr>
                  <th>Guest</th>
                  <th>Room Type</th>
                  <th>Room</th>
                  <th>Check-in</th>
                  <th>Check-out</th>
                  <th>Status</th>
                  <th style={{ textAlign: 'right' }}>Room Charge</th>
                  <th style={{ textAlign: 'right' }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {filteredRows.map((r) => {
                  const guestFullName = `${r.guest.firstName} ${r.guest.lastName ?? ''}`.trim();
                  return (
                    <tr key={r.id}>
                      <td>
                        <div style={{ fontWeight: 600 }}>{guestFullName}</div>
                        <div className="ds-caption" style={{ display: 'flex', gap: 6 }}>
                          {r.guest.phone && <span>{r.guest.phone}</span>}
                          {r.guest.phone && r.guest.email && <span>·</span>}
                          {r.guest.email && <span>{r.guest.email}</span>}
                        </div>
                      </td>
                      <td>
                        <span style={{ fontWeight: 500 }}>{r.category?.name ?? '—'}</span>
                        <div className="ds-caption">{fmtOrgMoneyExact(r.category?.basePriceInr ?? 0)} / night</div>
                      </td>
                      <td>
                        {r.room?.roomNumber ? (
                          <strong className="ds-num" style={{ fontSize: 13.5 }}>
                            Room {r.room.roomNumber}
                          </strong>
                        ) : (
                          <span className="badge" style={{ background: 'var(--tone-renewal-bg)', color: 'var(--tone-renewal)', fontSize: 11 }}>
                            Unassigned
                          </span>
                        )}
                      </td>
                      <td>
                        <div>{fmtDate(r.checkInDate)}</div>
                      </td>
                      <td>
                        <div>{fmtDate(r.checkOutDate)}</div>
                      </td>
                      <td>
                        <Badge tone={RESERVATION_TONE[r.status] ?? 'neutral'}>
                          {r.status.replace('_', ' ').toLowerCase()}
                        </Badge>
                      </td>
                      <td style={{ textAlign: 'right' }} className="ds-num">
                        {fmtOrgMoneyExact(r.totalPriceInr)}
                      </td>
                      <td style={{ textAlign: 'right', whiteSpace: 'nowrap' }}>
                        <div style={{ display: 'flex', gap: 6, justifyContent: 'flex-end' }}>
                          {r.status === 'CONFIRMED' && (
                            <button
                              className="btn-primary btn-sm"
                              onClick={() => setCheckingIn(r)}
                              title="Check in guest"
                            >
                              <LogIn size={13} /> Check in
                            </button>
                          )}
                          {r.status === 'CHECKED_IN' && (
                            <button
                              className="btn-secondary btn-sm"
                              onClick={() => setFolioFor(r)}
                              title="Manage charges and payments"
                            >
                              <Receipt size={13} /> Folio
                            </button>
                          )}
                          {['CHECKED_OUT', 'CANCELLED'].includes(r.status) && (
                            <button
                              className="btn-ghost btn-sm"
                              onClick={() => setFolioFor(r)}
                              title="View settled folio"
                            >
                              <Receipt size={13} /> View Folio
                            </button>
                          )}
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

      {/* Modals */}
      <RoomBookingFlow
        propertyName={property?.name}
        open={newRes}
        onClose={() => setNewRes(false)}
        propertyId={propertyId}
        categories={categories}
        onDone={() => {
          setNewRes(false);
          refresh();
        }}
      />
      <WalkInModal
        open={walkIn}
        onClose={() => setWalkIn(false)}
        propertyId={propertyId}
        categories={categories}
        onDone={() => {
          setWalkIn(false);
          refresh();
        }}
      />
      <CheckInModal
        reservation={checkingIn}
        onClose={() => setCheckingIn(null)}
        onDone={() => {
          setCheckingIn(null);
          refresh();
        }}
      />
      <FolioDrawer
        reservation={folioFor}
        onClose={() => setFolioFor(null)}
        onCheckedOut={() => {
          setFolioFor(null);
          refresh();
        }}
      />
    </HospitalityPage>
  );
}
