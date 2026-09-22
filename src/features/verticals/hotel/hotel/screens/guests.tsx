'use client';

/**
 * Guests — Guest Directory & Profile Management
 *
 * Scoped to the properties the user manages with stay history,
 * in-house status indicators, and one-click profile drawers.
 */

import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import {
  BedDouble,
  Calendar,
  Contact,
  Eye,
  Plus,
  Search,
  UserCheck,
  Users2,
} from 'lucide-react';
import { api } from '@/lib/api';
import { Badge, EmptyState, Skeleton, fmtDate, type DataTableColumn } from '../ui/kit';
import { HospitalityPage, HospitalitySection } from '../ui/page-shell';
import { useHotelProperty } from '../hooks/use-hotel-property';
import { GuestProfileDrawer, type GuestProfileData } from '../ui/guest-profile-drawer';
import { RoomBookingFlow } from '../ui/room-booking-flow';
import { FolioDrawer } from '../ui/folio-drawer';
import type { ReservationRow } from '../types';

export function GuestsFeature() {
  const { propertyId, categories, property } = useHotelProperty();
  const [search, setSearch] = useState('');
  const [selectedGuest, setSelectedGuest] = useState<GuestProfileData | null>(null);
  const [bookingForGuest, setBookingForGuest] = useState<GuestProfileData | null>(null);
  const [folioFor, setFolioFor] = useState<ReservationRow | null>(null);

  const { data: guests = [], isLoading } = useQuery<GuestProfileData[]>({
    queryKey: ['hotel-guests', search],
    queryFn: async () =>
      (await api.get('/hotel/guests', { params: { search: search || undefined } })).data,
  });

  const inHouseCount = guests.filter((g) => g.inHouse).length;
  const repeatCount = guests.filter((g) => g.stayCount > 1).length;
  const totalStays = guests.reduce((sum, g) => sum + g.stayCount, 0);

  return (
    <HospitalityPage
      title="Guests"
      subtitle={`${guests.length} registered guest${guests.length === 1 ? '' : 's'} · ${inHouseCount} currently in house · ${repeatCount} repeat visitors`}
      actions={
        <button className="btn-primary" onClick={() => setBookingForGuest({ id: '', firstName: '', lastName: null, email: null, phone: null, stayCount: 0, inHouse: false, lastStay: null })}>
          <Plus size={15} /> New Guest Booking
        </button>
      }
    >
      {/* KPI Cards */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))',
          gap: 12,
          marginBottom: 16,
        }}
      >
        <div className="ds-card" style={{ padding: '12px 14px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span className="ds-caption-upper" style={{ fontWeight: 600 }}>Total Guests</span>
            <Users2 size={16} color="var(--primary)" />
          </div>
          <div style={{ fontSize: 24, fontWeight: 700, margin: '4px 0 2px' }}>{guests.length}</div>
          <div className="ds-caption">Across all property stays</div>
        </div>

        <div className="ds-card" style={{ padding: '12px 14px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span className="ds-caption-upper" style={{ fontWeight: 600 }}>Currently In House</span>
            <BedDouble size={16} color="var(--tone-active)" />
          </div>
          <div style={{ fontSize: 24, fontWeight: 700, margin: '4px 0 2px', color: 'var(--tone-active)' }}>
            {inHouseCount}
          </div>
          <div className="ds-caption">Active room folios open</div>
        </div>

        <div className="ds-card" style={{ padding: '12px 14px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span className="ds-caption-upper" style={{ fontWeight: 600 }}>Repeat Visitors</span>
            <UserCheck size={16} color="var(--tone-info)" />
          </div>
          <div style={{ fontSize: 24, fontWeight: 700, margin: '4px 0 2px' }}>{repeatCount}</div>
          <div className="ds-caption">Guests with 2+ stays</div>
        </div>

        <div className="ds-card" style={{ padding: '12px 14px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span className="ds-caption-upper" style={{ fontWeight: 600 }}>Lifetime Stays</span>
            <Calendar size={16} color="var(--ink-secondary)" />
          </div>
          <div style={{ fontSize: 24, fontWeight: 700, margin: '4px 0 2px' }}>{totalStays}</div>
          <div className="ds-caption">Total reservations fulfilled</div>
        </div>
      </div>

      <HospitalitySection
        title="Guest Directory"
        tools={
          <div style={{ position: 'relative' }}>
            <input
              className="input"
              placeholder="Search name, phone or email…"
              aria-label="Search guests"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              style={{ width: 280, paddingLeft: 30 }}
            />
            <Search size={14} style={{ position: 'absolute', left: 10, top: 10, color: 'var(--ink-muted)' }} />
          </div>
        }
      >
        {isLoading ? (
          <Skeleton rows={6} />
        ) : guests.length === 0 ? (
          <EmptyState
            icon={Users2}
            title={search ? 'No Guests Match That Query' : 'No Registered Guests'}
            body={
              search
                ? 'Try searching with a different name, phone number, or email.'
                : 'Guests are registered automatically when they reserve or check in.'
            }
          />
        ) : (
          <div className="ds-card" style={{ overflowX: 'auto' }}>
            <table className="ds-table" style={{ width: '100%' }}>
              <thead>
                <tr>
                  <th>Guest</th>
                  <th>Status</th>
                  <th style={{ textAlign: 'center' }}>Total Stays</th>
                  <th>Last Stay</th>
                  <th style={{ textAlign: 'right' }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {guests.map((g) => {
                  const fullName = `${g.firstName} ${g.lastName ?? ''}`.trim();
                  return (
                    <tr
                      key={g.id}
                      onClick={() => setSelectedGuest(g)}
                      style={{ cursor: 'pointer' }}
                    >
                      <td>
                        <div style={{ fontWeight: 600, fontSize: 13.5 }}>{fullName}</div>
                        <div className="ds-caption" style={{ display: 'flex', gap: 6 }}>
                          {g.phone && <span>{g.phone}</span>}
                          {g.phone && g.email && <span>·</span>}
                          {g.email && <span>{g.email}</span>}
                        </div>
                      </td>
                      <td>
                        {g.inHouse ? (
                          <Badge tone="active">In House</Badge>
                        ) : g.stayCount > 1 ? (
                          <Badge tone="info">Repeat Guest</Badge>
                        ) : (
                          <Badge tone="neutral">Standard</Badge>
                        )}
                      </td>
                      <td style={{ textAlign: 'center' }}>
                        <span className="badge" style={{ fontSize: 12, fontWeight: 700 }}>
                          {g.stayCount}
                        </span>
                      </td>
                      <td>
                        {g.lastStay ? (
                          <div>
                            <div style={{ fontSize: 12.5, fontWeight: 500 }}>
                              {fmtDate(g.lastStay.checkInDate)} → {fmtDate(g.lastStay.checkOutDate)}
                            </div>
                            <div className="ds-caption">
                              {g.lastStay.category?.name ?? 'Room'}{' '}
                              {g.lastStay.room ? `· Room ${g.lastStay.room.roomNumber}` : ''}
                            </div>
                          </div>
                        ) : (
                          <span className="ds-caption">—</span>
                        )}
                      </td>
                      <td style={{ textAlign: 'right', whiteSpace: 'nowrap' }}>
                        <div
                          style={{ display: 'flex', gap: 6, justifyContent: 'flex-end' }}
                          onClick={(e) => e.stopPropagation()}
                        >
                          <button
                            className="btn-secondary btn-sm"
                            onClick={() => setSelectedGuest(g)}
                            title="View guest stay history"
                          >
                            <Eye size={13} /> View Profile
                          </button>
                          <button
                            className="btn-primary btn-sm"
                            onClick={() => setBookingForGuest(g)}
                            title="Book next stay"
                          >
                            <Plus size={13} /> Book Stay
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

      {/* Guest Profile Slide-over Drawer */}
      <GuestProfileDrawer
        guest={selectedGuest}
        onClose={() => setSelectedGuest(null)}
        onBookStay={(g) => {
          setSelectedGuest(null);
          setBookingForGuest(g);
        }}
        onOpenFolio={(resId) => {
          setSelectedGuest(null);
          setFolioFor({
            id: resId,
            status: 'CHECKED_IN',
            checkInDate: '',
            checkOutDate: '',
            totalPriceInr: 0,
            amountPaidInr: 0,
            propertyId: propertyId ?? '',
            guest: { id: selectedGuest?.id ?? '', firstName: selectedGuest?.firstName ?? '', lastName: selectedGuest?.lastName ?? null, phone: null, email: null },
            category: null,
            room: null,
          });
        }}
      />

      {/* Pre-filled Reservation Modal for Guest */}
      <RoomBookingFlow
        propertyName={property?.name}
        open={Boolean(bookingForGuest)}
        onClose={() => setBookingForGuest(null)}
        propertyId={propertyId}
        categories={categories}
        initialGuest={bookingForGuest}
        onDone={() => {
          setBookingForGuest(null);
        }}
      />

      {/* Folio Drawer */}
      <FolioDrawer
        reservation={folioFor}
        onClose={() => setFolioFor(null)}
        onCheckedOut={() => setFolioFor(null)}
      />
    </HospitalityPage>
  );
}
