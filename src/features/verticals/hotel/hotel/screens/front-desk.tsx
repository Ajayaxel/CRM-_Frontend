'use client';

/**
 * Front Desk — The Receptionist's Operational Home
 *
 * Answers the 6 vital questions at a single glance:
 * 1. Who is checking in today? (Arrivals)
 * 2. Who is checking out today? (Departures)
 * 3. Who is currently staying? (In-House)
 * 4. Which rooms are available?
 * 5. Which rooms need cleaning? (Housekeeping)
 * 6. Any pending payments? (Folio Balances)
 */

import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import {
  BedDouble,
  CheckCircle2,
  Clock,
  DoorOpen,
  LogIn,
  LogOut,
  Phone,
  Plus,
  RefreshCw,
  Sparkles,
  UserCheck,
  UserPlus,
  Users2,
  Wallet,
  Receipt,
  AlertCircle,
  Coffee,
} from 'lucide-react';
import { api, apiErrorMessage } from '@/lib/api';
import { fmtOrgMoney, fmtOrgMoneyExact } from '@/lib/org-locale';
import { Badge, EmptyState, Skeleton, fmtDate, type DataTableColumn } from '../ui/kit';
import { HospitalityPage, HospitalitySection } from '../ui/page-shell';
import { ROOM_LABEL, ROOM_TONE, RESERVATION_TONE } from '../ui/tone';
import { useHotelProperty } from '../hooks/use-hotel-property';
import { FolioDrawer } from '../ui/folio-drawer';
import { CheckInModal } from '../ui/check-in-modal';
import { WalkInModal } from '../ui/walk-in-modal';
import { RoomBookingFlow } from '../ui/room-booking-flow';
import type { ReceptionBoard, ReservationRow, RoomRow } from '../types';

const guestName = (r: ReservationRow) => `${r.guest.firstName} ${r.guest.lastName ?? ''}`.trim();

export function FrontDeskFeature() {
  const qc = useQueryClient();
  const { propertyId, categories, property } = useHotelProperty();
  const [checkingIn, setCheckingIn] = useState<ReservationRow | null>(null);
  const [folioFor, setFolioFor] = useState<ReservationRow | null>(null);
  const [walkIn, setWalkIn] = useState(false);
  const [newRes, setNewRes] = useState(false);
  const [activeTab, setActiveTab] = useState<'arrivals' | 'departures' | 'inHouse' | 'dirtyRooms'>('arrivals');

  const { data, isLoading, refetch, isFetching } = useQuery<ReceptionBoard>({
    queryKey: ['hotel-reception', propertyId],
    queryFn: async () => (await api.get('/hotel/reception', { params: { propertyId } })).data,
    enabled: Boolean(propertyId),
    refetchInterval: 30_000,
  });

  const refresh = () => {
    qc.invalidateQueries({ queryKey: ['hotel-reception'] });
    qc.invalidateQueries({ queryKey: ['hotel-rooms'] });
    qc.invalidateQueries({ queryKey: ['hotel-reservations'] });
    qc.invalidateQueries({ queryKey: ['hotel-folios'] });
  };

  const cleanMutation = useMutation({
    mutationFn: async (roomId: string) =>
      (await api.post(`/hotel/rooms/${roomId}/status`, { status: 'CLEAN' })).data,
    onSuccess: () => {
      toast.success('Room marked clean & ready for guests');
      refresh();
    },
    onError: (e) => toast.error(apiErrorMessage(e)),
  });

  const dirtyRooms = data?.rooms.board?.filter((r) => r.housekeepingStatus === 'DIRTY' || r.derivedStatus === 'DIRTY') ?? [];

  return (
    <HospitalityPage
      title="Front Desk"
      subtitle="Today's live operations, room status, and guest turnover"
      actions={
        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          <button
            className="btn-ghost btn-sm"
            onClick={() => refetch()}
            disabled={isFetching}
            title="Refresh front desk"
          >
            <RefreshCw size={14} className={isFetching ? 'animate-spin' : ''} />
          </button>
          <button className="btn-secondary" onClick={() => setWalkIn(true)}>
            <UserPlus size={15} /> Walk-in Check-in
          </button>
          <button className="btn-primary" onClick={() => setNewRes(true)}>
            <LogIn size={15} /> New Reservation
          </button>
        </div>
      }
    >
      {isLoading || !data ? (
        <Skeleton rows={6} />
      ) : (
        <>
          {/* Today's Operations KPI Banner */}
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(170px, 1fr))',
              gap: 12,
              marginBottom: 16,
            }}
          >
            {/* Arrivals */}
            <div
              onClick={() => setActiveTab('arrivals')}
              className="ds-card"
              style={{
                padding: '12px 14px',
                cursor: 'pointer',
                border: activeTab === 'arrivals' ? '2px solid var(--primary)' : '1px solid var(--border)',
                background: activeTab === 'arrivals' ? 'var(--surface-selected, rgba(0,0,0,0.02))' : 'var(--surface)',
                transition: 'all 0.15s ease',
              }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span className="ds-caption-upper" style={{ fontWeight: 600 }}>Arrivals Today</span>
                <LogIn size={16} color="var(--primary)" />
              </div>
              <div style={{ fontSize: 24, fontWeight: 700, margin: '4px 0 2px' }}>
                {data.arrivals.length}
              </div>
              <div className="ds-caption" style={{ color: 'var(--ink-secondary)', fontSize: 11.5 }}>
                {data.arrivals.length === 0 ? 'All checked in' : `${data.arrivals.length} pending check-in`}
              </div>
            </div>

            {/* Departures */}
            <div
              onClick={() => setActiveTab('departures')}
              className="ds-card"
              style={{
                padding: '12px 14px',
                cursor: 'pointer',
                border: activeTab === 'departures' ? '2px solid var(--primary)' : '1px solid var(--border)',
                background: activeTab === 'departures' ? 'var(--surface-selected, rgba(0,0,0,0.02))' : 'var(--surface)',
                transition: 'all 0.15s ease',
              }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span className="ds-caption-upper" style={{ fontWeight: 600 }}>Departures Today</span>
                <LogOut size={16} color="var(--tone-renewal)" />
              </div>
              <div style={{ fontSize: 24, fontWeight: 700, margin: '4px 0 2px' }}>
                {data.departures.length}
              </div>
              <div className="ds-caption" style={{ color: 'var(--ink-secondary)', fontSize: 11.5 }}>
                {data.departures.length === 0 ? 'No departures due' : `${data.departures.length} due out today`}
              </div>
            </div>

            {/* In House */}
            <div
              onClick={() => setActiveTab('inHouse')}
              className="ds-card"
              style={{
                padding: '12px 14px',
                cursor: 'pointer',
                border: activeTab === 'inHouse' ? '2px solid var(--primary)' : '1px solid var(--border)',
                background: activeTab === 'inHouse' ? 'var(--surface-selected, rgba(0,0,0,0.02))' : 'var(--surface)',
                transition: 'all 0.15s ease',
              }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span className="ds-caption-upper" style={{ fontWeight: 600 }}>In House</span>
                <BedDouble size={16} color="var(--tone-info)" />
              </div>
              <div style={{ fontSize: 24, fontWeight: 700, margin: '4px 0 2px' }}>
                {data.inHouse.length}
              </div>
              <div className="ds-caption" style={{ color: 'var(--ink-secondary)', fontSize: 11.5 }}>
                {data.rooms.occupied} of {data.rooms.total} rooms occupied
              </div>
            </div>

            {/* Available */}
            <div
              className="ds-card"
              style={{
                padding: '12px 14px',
                border: '1px solid var(--border)',
                background: 'var(--surface)',
              }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span className="ds-caption-upper" style={{ fontWeight: 600 }}>Available Rooms</span>
                <DoorOpen size={16} color="var(--tone-active)" />
              </div>
              <div style={{ fontSize: 24, fontWeight: 700, margin: '4px 0 2px', color: 'var(--tone-active)' }}>
                {data.rooms.available}
              </div>
              <div className="ds-caption" style={{ color: 'var(--ink-secondary)', fontSize: 11.5 }}>
                of {data.rooms.total} total rooms
              </div>
            </div>

            {/* Dirty / Needs Cleaning */}
            <div
              onClick={() => setActiveTab('dirtyRooms')}
              className="ds-card"
              style={{
                padding: '12px 14px',
                cursor: 'pointer',
                border: activeTab === 'dirtyRooms' ? '2px solid var(--primary)' : '1px solid var(--border)',
                background: activeTab === 'dirtyRooms' ? 'var(--surface-selected, rgba(0,0,0,0.02))' : 'var(--surface)',
                transition: 'all 0.15s ease',
              }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span className="ds-caption-upper" style={{ fontWeight: 600 }}>Needs Cleaning</span>
                <Sparkles size={16} color={dirtyRooms.length > 0 ? 'var(--tone-renewal)' : 'var(--ink-muted)'} />
              </div>
              <div
                style={{
                  fontSize: 24,
                  fontWeight: 700,
                  margin: '4px 0 2px',
                  color: dirtyRooms.length > 0 ? 'var(--tone-renewal)' : 'inherit',
                }}
              >
                {data.rooms.dirty}
              </div>
              <div className="ds-caption" style={{ color: 'var(--ink-secondary)', fontSize: 11.5 }}>
                {dirtyRooms.length === 0 ? 'All rooms inspected & clean' : `${dirtyRooms.length} room(s) to clean`}
              </div>
            </div>

            {/* Collected Today */}
            <div
              className="ds-card"
              style={{
                padding: '12px 14px',
                border: '1px solid var(--border)',
                background: 'var(--surface)',
              }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span className="ds-caption-upper" style={{ fontWeight: 600 }}>Collected Today</span>
                <Wallet size={16} color="var(--primary)" />
              </div>
              <div style={{ fontSize: 20, fontWeight: 700, margin: '4px 0 2px' }}>
                {fmtOrgMoney(data.collection.totalInr)}
              </div>
              <div className="ds-caption" style={{ color: 'var(--ink-secondary)', fontSize: 11 }}>
                {Object.entries(data.collection.byMethod)
                  .map(([m, v]) => `${m.toLowerCase()}: ${fmtOrgMoney(v)}`)
                  .join(' · ') || 'No payments recorded yet'}
              </div>
            </div>
          </div>

          {/* Operational Stream Tabs */}
          <div
            style={{
              display: 'flex',
              gap: 8,
              borderBottom: '1px solid var(--border)',
              paddingBottom: 8,
              marginBottom: 16,
            }}
          >
            <button
              className={activeTab === 'arrivals' ? 'btn-primary btn-sm' : 'btn-secondary btn-sm'}
              onClick={() => setActiveTab('arrivals')}
            >
              <LogIn size={13} /> Arrivals Today ({data.arrivals.length})
            </button>
            <button
              className={activeTab === 'departures' ? 'btn-primary btn-sm' : 'btn-secondary btn-sm'}
              onClick={() => setActiveTab('departures')}
            >
              <LogOut size={13} /> Departures Today ({data.departures.length})
            </button>
            <button
              className={activeTab === 'inHouse' ? 'btn-primary btn-sm' : 'btn-secondary btn-sm'}
              onClick={() => setActiveTab('inHouse')}
            >
              <BedDouble size={13} /> In-House Guests ({data.inHouse.length})
            </button>
            <button
              className={activeTab === 'dirtyRooms' ? 'btn-primary btn-sm' : 'btn-secondary btn-sm'}
              onClick={() => setActiveTab('dirtyRooms')}
            >
              <Sparkles size={13} /> Dirty Rooms ({dirtyRooms.length})
            </button>
          </div>

          {/* Tab 1: Arrivals Today */}
          {activeTab === 'arrivals' && (
            <HospitalitySection
              title="Arrivals Today"
              tools={<span className="ds-caption">Scheduled check-ins for today</span>}
            >
              {data.arrivals.length === 0 ? (
                <EmptyState
                  compact
                  icon={CheckCircle2}
                  title="No Pending Arrivals Today"
                  body="All guests booked for today have checked in or no more arrivals are scheduled."
                  actionLabel="Take Walk-in Guest"
                  onAction={() => setWalkIn(true)}
                />
              ) : (
                <div className="ds-card" style={{ overflowX: 'auto' }}>
                  <table className="ds-table" style={{ width: '100%' }}>
                    <thead>
                      <tr>
                        <th>Guest</th>
                        <th>Room Type</th>
                        <th>Assigned Room</th>
                        <th>Stay Duration</th>
                        <th>Status</th>
                        <th style={{ textAlign: 'right' }}>Action</th>
                      </tr>
                    </thead>
                    <tbody>
                      {data.arrivals.map((r) => (
                        <tr key={r.id}>
                          <td>
                            <div style={{ fontWeight: 600 }}>{guestName(r)}</div>
                            <div className="ds-caption" style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                              {r.guest.phone && <span>{r.guest.phone}</span>}
                              {r.guest.phone && r.guest.email && <span>·</span>}
                              {r.guest.email && <span>{r.guest.email}</span>}
                            </div>
                          </td>
                          <td>
                            <span style={{ fontWeight: 500 }}>{r.category?.name ?? 'Standard'}</span>
                            <div className="ds-caption">{fmtOrgMoneyExact(r.category?.basePriceInr ?? 0)}/night</div>
                          </td>
                          <td>
                            {r.room?.roomNumber ? (
                              <span className="badge" style={{ background: 'var(--tone-active-bg)', color: 'var(--tone-active)', fontWeight: 600 }}>
                                Room {r.room.roomNumber}
                              </span>
                            ) : (
                              <span className="badge" style={{ background: 'var(--tone-renewal-bg)', color: 'var(--tone-renewal)' }}>
                                Not Assigned
                              </span>
                            )}
                          </td>
                          <td>
                            <div>{fmtDate(r.checkInDate)} → {fmtDate(r.checkOutDate)}</div>
                            <div className="ds-caption">Due check-in today</div>
                          </td>
                          <td>
                            <Badge tone={RESERVATION_TONE[r.status] ?? 'neutral'}>
                              {r.status.replace('_', ' ').toLowerCase()}
                            </Badge>
                          </td>
                          <td style={{ textAlign: 'right' }}>
                            <button
                              className="btn-primary btn-sm"
                              onClick={() => setCheckingIn(r)}
                            >
                              <LogIn size={13} /> Check in
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </HospitalitySection>
          )}

          {/* Tab 2: Departures Today */}
          {activeTab === 'departures' && (
            <HospitalitySection
              title="Departures Today"
              tools={<span className="ds-caption">Check-outs scheduled for today</span>}
            >
              {data.departures.length === 0 ? (
                <EmptyState
                  compact
                  icon={CheckCircle2}
                  title="No Pending Departures"
                  body="No in-house guests are scheduled to check out today."
                />
              ) : (
                <div className="ds-card" style={{ overflowX: 'auto' }}>
                  <table className="ds-table" style={{ width: '100%' }}>
                    <thead>
                      <tr>
                        <th>Guest</th>
                        <th>Room</th>
                        <th>Stay Period</th>
                        <th style={{ textAlign: 'right' }}>Room Value</th>
                        <th style={{ textAlign: 'right' }}>Folio Balance</th>
                        <th style={{ textAlign: 'right' }}>Action</th>
                      </tr>
                    </thead>
                    <tbody>
                      {data.departures.map((r) => {
                        const balance = r.totalPriceInr - (r.amountPaidInr ?? 0);
                        return (
                          <tr key={r.id}>
                            <td>
                              <div style={{ fontWeight: 600 }}>{guestName(r)}</div>
                              <div className="ds-caption">{r.guest.phone ?? r.guest.email ?? '—'}</div>
                            </td>
                            <td>
                              <strong className="ds-num" style={{ fontSize: 14 }}>
                                Room {r.room?.roomNumber ?? '—'}
                              </strong>
                              <div className="ds-caption">{r.category?.name}</div>
                            </td>
                            <td>
                              <div>{fmtDate(r.checkInDate)} → {fmtDate(r.checkOutDate)}</div>
                              <div className="ds-caption" style={{ color: 'var(--tone-renewal)' }}>Departs today</div>
                            </td>
                            <td style={{ textAlign: 'right' }} className="ds-num">
                              {fmtOrgMoneyExact(r.totalPriceInr)}
                            </td>
                            <td style={{ textAlign: 'right' }}>
                              <span
                                className="badge"
                                style={{
                                  background: balance > 0 ? 'var(--tone-renewal-bg)' : 'var(--tone-active-bg)',
                                  color: balance > 0 ? 'var(--tone-renewal)' : 'var(--tone-active)',
                                  fontWeight: 700,
                                }}
                              >
                                {balance > 0 ? `${fmtOrgMoneyExact(balance)} Owed` : 'Settled (₹0)'}
                              </span>
                            </td>
                            <td style={{ textAlign: 'right' }}>
                              <button
                                className="btn-primary btn-sm"
                                onClick={() => setFolioFor(r)}
                              >
                                <LogOut size={13} /> Checkout
                              </button>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </HospitalitySection>
          )}

          {/* Tab 3: In-House Guests */}
          {activeTab === 'inHouse' && (
            <HospitalitySection
              title="In-House Guests"
              tools={<span className="ds-caption">Currently occupying rooms</span>}
            >
              {data.inHouse.length === 0 ? (
                <EmptyState
                  compact
                  icon={BedDouble}
                  title="Nobody In House"
                  body="No guests are currently checked into rooms."
                  actionLabel="Check in Walk-in"
                  onAction={() => setWalkIn(true)}
                />
              ) : (
                <div className="ds-card" style={{ overflowX: 'auto' }}>
                  <table className="ds-table" style={{ width: '100%' }}>
                    <thead>
                      <tr>
                        <th>Room</th>
                        <th>Guest</th>
                        <th>Check-in Date</th>
                        <th>Departs Date</th>
                        <th style={{ textAlign: 'right' }}>Room Rate</th>
                        <th style={{ textAlign: 'right' }}>Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {data.inHouse.map((r) => (
                        <tr key={r.id}>
                          <td>
                            <strong className="ds-num" style={{ fontSize: 14 }}>
                              Room {r.room?.roomNumber ?? '—'}
                            </strong>
                            <div className="ds-caption">{r.category?.name}</div>
                          </td>
                          <td>
                            <div style={{ fontWeight: 600 }}>{guestName(r)}</div>
                            <div className="ds-caption">{r.guest.phone ?? r.guest.email ?? '—'}</div>
                          </td>
                          <td>{fmtDate(r.checkInDate)}</td>
                          <td>{fmtDate(r.checkOutDate)}</td>
                          <td style={{ textAlign: 'right' }} className="ds-num">
                            {fmtOrgMoneyExact(r.totalPriceInr)}
                          </td>
                          <td style={{ textAlign: 'right', whiteSpace: 'nowrap' }}>
                            <div style={{ display: 'flex', gap: 6, justifyContent: 'flex-end' }}>
                              <button
                                className="btn-secondary btn-sm"
                                onClick={() => setFolioFor(r)}
                                title="Add coffee, laundry, or charges"
                              >
                                <Coffee size={13} /> + Charge
                              </button>
                              <button
                                className="btn-secondary btn-sm"
                                onClick={() => setFolioFor(r)}
                              >
                                <Receipt size={13} /> Open Folio
                              </button>
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </HospitalitySection>
          )}

          {/* Tab 4: Dirty Rooms / Housekeeping */}
          {activeTab === 'dirtyRooms' && (
            <HospitalitySection
              title="Rooms Needing Cleaning"
              tools={<span className="ds-caption">Turnover &amp; dirty rooms</span>}
            >
              {dirtyRooms.length === 0 ? (
                <EmptyState
                  compact
                  icon={Sparkles}
                  title="All Rooms Are Clean &amp; Ready"
                  body="Housekeeping is up to date. Every room is ready for check-in."
                />
              ) : (
                <div
                  style={{
                    display: 'grid',
                    gridTemplateColumns: 'repeat(auto-fill, minmax(240px, 1fr))',
                    gap: 12,
                  }}
                >
                  {dirtyRooms.map((r) => (
                    <div
                      key={r.id}
                      className="ds-card"
                      style={{
                        padding: 14,
                        border: '1px solid var(--tone-renewal-line)',
                        background: 'var(--tone-renewal-bg)',
                        display: 'flex',
                        flexDirection: 'column',
                        justifyContent: 'space-between',
                      }}
                    >
                      <div>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                          <strong style={{ fontSize: 18 }} className="ds-num">
                            Room {r.roomNumber}
                          </strong>
                          <span
                            className="badge"
                            style={{
                              background: 'var(--tone-renewal-bg)',
                              color: 'var(--tone-renewal)',
                              fontWeight: 700,
                              fontSize: 11,
                            }}
                          >
                            DIRTY
                          </span>
                        </div>
                        <div style={{ fontSize: 13, marginTop: 4 }}>
                          {r.category?.name ?? 'Standard'} {r.floor ? `· Floor ${r.floor}` : ''}
                        </div>
                        <p className="ds-caption" style={{ margin: '6px 0 10px', color: 'var(--tone-renewal)' }}>
                          Checkout completed. Ready for housekeeping.
                        </p>
                      </div>
                      <button
                        className="btn-secondary btn-sm"
                        disabled={cleanMutation.isPending}
                        onClick={() => cleanMutation.mutate(r.id)}
                        style={{
                          background: 'var(--surface)',
                          borderColor: 'var(--tone-renewal)',
                          color: 'var(--tone-renewal)',
                          fontWeight: 600,
                          width: '100%',
                          display: 'flex',
                          justifyContent: 'center',
                          gap: 6,
                        }}
                      >
                        <Sparkles size={14} /> Mark Clean &amp; Ready
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </HospitalitySection>
          )}

          {/* Mini Live Room Board Summary */}
          <HospitalitySection
            title="Live Room Board"
            tools={
              <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                {(['AVAILABLE', 'OCCUPIED', 'RESERVED', 'DIRTY', 'OUT_OF_ORDER'] as const).map((s) => (
                  <Badge key={s} tone={ROOM_TONE[s]}>
                    {ROOM_LABEL[s]}
                  </Badge>
                ))}
              </div>
            }
          >
            <div
              style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fill, minmax(130px, 1fr))',
                gap: 10,
              }}
            >
              {(data.rooms.board ?? []).map((r) => {
                const status = r.derivedStatus;
                const isDirty = r.housekeepingStatus === 'DIRTY' || status === 'DIRTY';
                const isOccupied = status === 'OCCUPIED';
                return (
                  <div
                    key={r.id}
                    className="ds-card"
                    style={{
                      padding: 10,
                      borderRadius: 'var(--radius-md, 8px)',
                      border: `1px solid ${
                        status === 'AVAILABLE'
                          ? 'var(--tone-active-line)'
                          : status === 'OCCUPIED'
                          ? 'var(--tone-info-line)'
                          : isDirty
                          ? 'var(--tone-renewal-line)'
                          : 'var(--border)'
                      }`,
                      background:
                        status === 'AVAILABLE'
                          ? 'var(--tone-active-bg)'
                          : status === 'OCCUPIED'
                          ? 'var(--tone-info-bg)'
                          : isDirty
                          ? 'var(--tone-renewal-bg)'
                          : 'var(--surface)',
                      display: 'flex',
                      flexDirection: 'column',
                      gap: 4,
                    }}
                  >
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <strong className="ds-num" style={{ fontSize: 16 }}>
                        {r.roomNumber}
                      </strong>
                      <span
                        style={{
                          width: 8,
                          height: 8,
                          borderRadius: '50%',
                          background:
                            status === 'AVAILABLE'
                              ? 'var(--tone-active)'
                              : status === 'OCCUPIED'
                              ? 'var(--tone-sales)'
                              : isDirty
                              ? 'var(--tone-renewal)'
                              : 'var(--tone-expired)',
                        }}
                      />
                    </div>
                    <div className="ds-caption" style={{ fontSize: 11, fontWeight: 500 }}>
                      {r.category?.name ?? 'Standard'}
                    </div>
                    <div
                      style={{
                        fontSize: 11,
                        fontWeight: 600,
                        color:
                          status === 'AVAILABLE'
                            ? 'var(--tone-active)'
                            : status === 'OCCUPIED'
                            ? 'var(--tone-sales)'
                            : isDirty
                            ? 'var(--tone-renewal)'
                            : 'var(--tone-expired)',
                      }}
                    >
                      {isDirty
                        ? 'Dirty'
                        : isOccupied
                        ? r.reservation?.guestName?.split(' ')[0] ?? 'Occupied'
                        : status === 'RESERVED'
                        ? 'Reserved'
                        : 'Available'}
                    </div>
                    {isDirty && (
                      <button
                        className="btn-ghost btn-sm"
                        style={{ fontSize: 10.5, padding: '2px 4px', marginTop: 2, height: 'auto', background: 'var(--surface)' }}
                        onClick={() => cleanMutation.mutate(r.id)}
                        title="Mark clean"
                      >
                        <Sparkles size={11} /> Clean
                      </button>
                    )}
                  </div>
                );
              })}
            </div>
          </HospitalitySection>
        </>
      )}

      {/* Modals & Drawers */}
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
    </HospitalityPage>
  );
}
