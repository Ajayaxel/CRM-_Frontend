'use client';

/**
 * Rooms — Visual Room Board & Inventory Management
 *
 * Provides both an intuitive Visual Room Board (PMS standard card grid)
 * and a detailed Table List View with floor and status filters.
 */

import { useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import {
  BedDouble,
  Building2,
  CheckCircle2,
  Filter,
  Grid3X3,
  KeyRound,
  LayoutGrid,
  List,
  Plus,
  Receipt,
  Sparkles,
  User,
  Wrench,
} from 'lucide-react';
import { api, apiErrorMessage } from '@/lib/api';
import { fmtOrgMoneyExact } from '@/lib/org-locale';
import { useAuthStore } from '@/features/foundation/auth';
import { Badge, EmptyState, Field, Modal, Segmented, Skeleton, fmtDate, type DataTableColumn } from '../ui/kit';
import { HospitalityPage, HospitalitySection } from '../ui/page-shell';
import { ROOM_LABEL, ROOM_TONE } from '../ui/tone';
import { useHotelProperty } from '../hooks/use-hotel-property';
import { FolioDrawer } from '../ui/folio-drawer';
import { WalkInModal } from '../ui/walk-in-modal';
import type { ReservationRow, RoomRow } from '../types';

const HOUSEKEEPING = ['CLEAN', 'DIRTY', 'INSPECTED', 'OUT_OF_ORDER'] as const;
const BOARD_STATES = ['ALL', 'AVAILABLE', 'OCCUPIED', 'RESERVED', 'DIRTY', 'OUT_OF_ORDER'] as const;

export function RoomManagementFeature() {
  const qc = useQueryClient();
  const canManage = useAuthStore((s) => s.hasPermission('hotel.manage'));
  const { propertyId, categories, isUnassigned } = useHotelProperty();
  const [viewMode, setViewMode] = useState<'board' | 'table'>('board');
  const [statusFilter, setStatusFilter] = useState<string>('ALL');
  const [floorFilter, setFloorFilter] = useState<string>('ALL');
  const [categoryFilter, setCategoryFilter] = useState<string>('ALL');
  const [view, setView] = useState<'Board' | 'List'>('Board');
  const [newProperty, setNewProperty] = useState(false);
  const [newCategory, setNewCategory] = useState(false);
  const [newRoom, setNewRoom] = useState(false);
  const [walkInRoomId, setWalkInRoomId] = useState<string | null>(null);
  const [folioFor, setFolioFor] = useState<ReservationRow | null>(null);

  const { data: rooms = [], isLoading } = useQuery<RoomRow[]>({
    queryKey: ['hotel-rooms', propertyId],
    queryFn: async () => (await api.get('/hotel/rooms', { params: { propertyId } })).data,
    enabled: Boolean(propertyId),
  });

  const refreshAll = () => {
    qc.invalidateQueries({ queryKey: ['hotel-properties'] });
    qc.invalidateQueries({ queryKey: ['hotel-rooms'] });
    qc.invalidateQueries({ queryKey: ['hotel-reception'] });
  };

  const setStatus = useMutation({
    mutationFn: async ({ id, status }: { id: string; status: string }) =>
      (await api.patch(`/hotel/rooms/${id}`, { status })).data,
    onSuccess: () => {
      toast.success('Room status updated');
      refreshAll();
    },
    onError: (e) => toast.error(apiErrorMessage(e)),
  });

  const markClean = useMutation({
    mutationFn: async (roomId: string) =>
      (await api.post(`/hotel/rooms/${roomId}/status`, { status: 'CLEAN' })).data,
    onSuccess: () => {
      toast.success('Room marked clean & ready');
      refreshAll();
    },
    onError: (e) => toast.error(apiErrorMessage(e)),
  });

  // Unique floors list for filtering
  const availableFloors = useMemo(() => {
    const floors = new Set<string>();
    rooms.forEach((r) => {
      if (r.floor) floors.add(r.floor);
    });
    return Array.from(floors).sort();
  }, [rooms]);

  // Filtered rooms
  const filteredRooms = useMemo(() => {
    return rooms.filter((r) => {
      if (statusFilter !== 'ALL' && r.derivedStatus !== statusFilter) return false;
      if (floorFilter !== 'ALL' && r.floor !== floorFilter) return false;
      if (categoryFilter !== 'ALL' && r.category?.id !== categoryFilter) return false;
      return true;
    });
  }, [rooms, statusFilter, floorFilter, categoryFilter]);

  // Statistics
  const availableCount = rooms.filter((r) => r.derivedStatus === 'AVAILABLE').length;
  const occupiedCount = rooms.filter((r) => r.derivedStatus === 'OCCUPIED').length;
  const dirtyCount = rooms.filter((r) => r.housekeepingStatus === 'DIRTY' || r.derivedStatus === 'DIRTY').length;
  const outOfOrderCount = rooms.filter((r) => r.housekeepingStatus === 'OUT_OF_ORDER' || r.derivedStatus === 'OUT_OF_ORDER').length;

  if (isUnassigned && canManage) {
    return (
      <div className="ds-page">
        <header className="ds-pagehead">
          <div className="ds-pagehead-main">
            <h1 className="ds-h1">Rooms &amp; Property Setup</h1>
            <p className="ds-caption ds-pagehead-sub">Set up your residency property to start managing rooms</p>
          </div>
        </header>
        <EmptyState
          icon={Building2}
          title="No Property Configured"
          body="Create your first residency property, configure room categories (Standard, Deluxe, Suite) with nightly rates, and add your rooms."
          actionLabel="Create Property"
          onAction={() => setNewProperty(true)}
        />
        <PropertyModal
          open={newProperty}
          onClose={() => setNewProperty(false)}
          onDone={() => {
            setNewProperty(false);
            refreshAll();
          }}
        />
      </div>
    );
  }

  const tableCols: DataTableColumn<RoomRow>[] = [
    {
      key: 'no',
      header: 'Room',
      width: 100,
      render: (r) => <strong className="ds-num" style={{ fontSize: 14 }}>{r.roomNumber}</strong>,
    },
    {
      key: 'floor',
      header: 'Floor',
      width: 80,
      render: (r) => r.floor ? `Floor ${r.floor}` : '—',
    },
    {
      key: 'type',
      header: 'Room Type',
      render: (r) =>
        r.category ? (
          <div>
            <div style={{ fontWeight: 500 }}>{r.category.name}</div>
            <div className="ds-caption">{fmtOrgMoneyExact(r.category.basePriceInr)} / night · Sleeps {r.category.capacity}</div>
          </div>
        ) : (
          '—'
        ),
    },
    {
      key: 'status',
      header: 'Current Status',
      render: (r) => (
        <Badge tone={ROOM_TONE[r.derivedStatus] ?? 'neutral'}>
          {ROOM_LABEL[r.derivedStatus] ?? r.derivedStatus}
        </Badge>
      ),
    },
    {
      key: 'who',
      header: 'Current Guest / Stay',
      render: (r) =>
        r.reservation ? (
          <div>
            <div style={{ fontWeight: 500 }}>{r.reservation.guestName}</div>
            <div className="ds-caption">Until {fmtDate(r.reservation.checkOutDate)}</div>
          </div>
        ) : (
          <span className="ds-caption">—</span>
        ),
    },
    ...(canManage
      ? [
          {
            key: 'act',
            header: 'Housekeeping Status',
            align: 'right' as const,
            render: (r: RoomRow) => (
              <select
                className="input"
                style={{ width: 150, fontSize: 12.5 }}
                value={r.housekeepingStatus}
                aria-label={`Housekeeping status for room ${r.roomNumber}`}
                onChange={(e) => setStatus.mutate({ id: r.id, status: e.target.value })}
                onClick={(e) => e.stopPropagation()}
              >
                {HOUSEKEEPING.map((st) => (
                  <option key={st} value={st}>
                    {st.replace('_', ' ').toLowerCase()}
                  </option>
                ))}
              </select>
            ),
          },
        ]
      : []),
  ];

  return (
    <HospitalityPage
      title="Rooms"
      subtitle={`${rooms.length} rooms (${availableCount} available · ${occupiedCount} occupied · ${dirtyCount} dirty · ${outOfOrderCount} out of order)`}
      actions={
        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          <Segmented
            options={['Board', 'Table']}
            value={viewMode === 'board' ? 'Board' : 'Table'}
            onChange={(v) => setViewMode(v === 'Board' ? 'board' : 'table')}
          />
          {canManage && (
            <>
              <button className="btn-secondary btn-sm" onClick={() => setNewProperty(true)}>
                <Building2 size={14} /> Property
              </button>
              <button className="btn-secondary btn-sm" onClick={() => setNewCategory(true)}>
                <Wrench size={14} /> Room Type
              </button>
              <button
                className="btn-primary btn-sm"
                disabled={categories.length === 0}
                onClick={() => setNewRoom(true)}
              >
                <Plus size={14} /> Add Room
              </button>
            </>
          )}
        </div>
      }
    >
      {canManage && categories.length === 0 && (
        <div
          className="ds-card"
          style={{
            padding: 14,
            background: 'var(--tone-renewal-bg)',
            border: '1px solid var(--tone-renewal-line)',
            color: 'var(--tone-renewal)',
            marginBottom: 16,
          }}
        >
          <strong>Add a room type first.</strong> Rooms belong to a room category (e.g. Standard, Deluxe, Suite), which specifies the base nightly rate.
        </div>
      )}

      {/* Filter Toolbar */}
      <div
        style={{
          display: 'flex',
          gap: 10,
          flexWrap: 'wrap',
          alignItems: 'center',
          background: 'var(--surface)',
          padding: '10px 14px',
          borderRadius: 'var(--radius-md, 8px)',
          border: '1px solid var(--border)',
          marginBottom: 16,
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <Filter size={14} style={{ color: 'var(--ink-muted)' }} />
          <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--ink-secondary)' }}>Filters:</span>
        </div>

        {/* Status Filter */}
        <select
          className="input"
          style={{ width: 140, fontSize: 12.5, height: 32 }}
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
        >
          <option value="ALL">All Statuses ({rooms.length})</option>
          <option value="AVAILABLE">🟢 Available ({availableCount})</option>
          <option value="OCCUPIED">🔵 Occupied ({occupiedCount})</option>
          <option value="DIRTY">🟠 Dirty ({dirtyCount})</option>
          <option value="OUT_OF_ORDER">🔴 Out of Order ({outOfOrderCount})</option>
        </select>

        {/* Floor Filter */}
        {availableFloors.length > 0 && (
          <select
            className="input"
            style={{ width: 130, fontSize: 12.5, height: 32 }}
            value={floorFilter}
            onChange={(e) => setFloorFilter(e.target.value)}
          >
            <option value="ALL">All Floors</option>
            {availableFloors.map((f) => (
              <option key={f} value={f}>
                Floor {f}
              </option>
            ))}
          </select>
        )}

        {/* Category Filter */}
        {categories.length > 0 && (
          <select
            className="input"
            style={{ width: 150, fontSize: 12.5, height: 32 }}
            value={categoryFilter}
            onChange={(e) => setCategoryFilter(e.target.value)}
          >
            <option value="ALL">All Room Types</option>
            {categories.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
        )}

        {(statusFilter !== 'ALL' || floorFilter !== 'ALL' || categoryFilter !== 'ALL') && (
          <button
            className="btn-ghost btn-sm"
            style={{ fontSize: 12 }}
            onClick={() => {
              setStatusFilter('ALL');
              setFloorFilter('ALL');
              setCategoryFilter('ALL');
            }}
          >
            Reset Filters
          </button>
        )}
      </div>

      {isLoading ? (
        <Skeleton rows={6} />
      ) : filteredRooms.length === 0 ? (
        <EmptyState
          icon={BedDouble}
          title="No Rooms Found"
          body={
            rooms.length === 0
              ? canManage
                ? 'Get started by adding your room types and rooms.'
                : 'No rooms configured yet.'
              : 'No rooms match the selected filters.'
          }
          actionLabel={rooms.length === 0 && canManage ? 'Add Room' : undefined}
          onAction={rooms.length === 0 && canManage ? () => setNewRoom(true) : undefined}
        />
      ) : viewMode === 'board' ? (
        /* Visual Room Board Grid */
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fill, minmax(210px, 1fr))',
            gap: 14,
          }}
        >
          {filteredRooms.map((r) => {
            const status = r.derivedStatus;
            const isDirty = r.housekeepingStatus === 'DIRTY' || status === 'DIRTY';
            const isOccupied = status === 'OCCUPIED';
            const isAvailable = status === 'AVAILABLE';
            const isOutOfOrder = status === 'OUT_OF_ORDER' || r.housekeepingStatus === 'OUT_OF_ORDER';
            const isReserved = status === 'RESERVED';

            return (
              <div
                key={r.id}
                className="ds-card"
                style={{
                  padding: 16,
                  borderRadius: 'var(--radius-lg, 10px)',
                  display: 'flex',
                  flexDirection: 'column',
                  justifyContent: 'space-between',
                  gap: 12,
                  border: isAvailable
                    ? '1.5px solid var(--tone-active-line)'
                    : isOccupied
                    ? '1.5px solid var(--tone-info-line)'
                    : isDirty
                    ? '1.5px solid var(--tone-renewal-line)'
                    : isOutOfOrder
                    ? '1.5px solid var(--tone-expired-line)'
                    : '1.5px solid var(--border)',
                  background: isAvailable
                    ? 'var(--tone-active-bg)'
                    : isOccupied
                    ? 'var(--tone-info-bg)'
                    : isDirty
                    ? 'var(--tone-renewal-bg)'
                    : isOutOfOrder
                    ? 'var(--tone-expired-bg)'
                    : 'var(--surface)',
                  transition: 'transform 0.15s ease, box-shadow 0.15s ease',
                }}
              >
                <div>
                  {/* Room Header */}
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                    <div>
                      <div
                        className="ds-num"
                        style={{
                          fontSize: 24,
                          fontWeight: 800,
                          letterSpacing: '-0.02em',
                          lineHeight: 1.1,
                          color: 'var(--ink)',
                        }}
                      >
                        {r.roomNumber}
                      </div>
                      <div className="ds-caption" style={{ marginTop: 2, fontSize: 11.5 }}>
                        {r.floor ? `Floor ${r.floor}` : 'Ground'} · {r.category?.name ?? 'Standard'}
                      </div>
                    </div>
                    <Badge tone={ROOM_TONE[status] ?? 'neutral'}>
                      {ROOM_LABEL[status] ?? status}
                    </Badge>
                  </div>

                  {/* Status Specific Content */}
                  <div style={{ marginTop: 12, minHeight: 44 }}>
                    {isAvailable && (
                      <div>
                        <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--tone-active)' }}>
                          {fmtOrgMoneyExact(r.category?.basePriceInr ?? 0)}
                          <span style={{ fontSize: 11, fontWeight: 400, color: 'var(--ink-secondary)' }}> / night</span>
                        </div>
                        <div className="ds-caption" style={{ marginTop: 2, color: 'var(--tone-active)' }}>
                          Ready for check-in
                        </div>
                      </div>
                    )}

                    {isOccupied && r.reservation && (
                      <div>
                        <div style={{ fontSize: 13, fontWeight: 600, display: 'flex', alignItems: 'center', gap: 4, color: 'var(--tone-info)' }}>
                          <User size={13} /> {r.reservation.guestName}
                        </div>
                        <div className="ds-caption" style={{ marginTop: 2 }}>
                          Departs {fmtDate(r.reservation.checkOutDate)}
                        </div>
                      </div>
                    )}

                    {isDirty && (
                      <div>
                        <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--tone-renewal)' }}>
                          Checkout completed
                        </div>
                        <div className="ds-caption" style={{ marginTop: 2, color: 'var(--tone-renewal)' }}>
                          Needs cleaning &amp; linen change
                        </div>
                      </div>
                    )}

                    {isOutOfOrder && (
                      <div>
                        <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--tone-expired)' }}>
                          Under Maintenance
                        </div>
                        <div className="ds-caption" style={{ marginTop: 2 }}>
                          Not available for booking
                        </div>
                      </div>
                    )}

                    {isReserved && r.reservation && (
                      <div>
                        <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--primary)' }}>
                          Arrival today: {r.reservation.guestName}
                        </div>
                        <div className="ds-caption" style={{ marginTop: 2 }}>
                          Pending check-in
                        </div>
                      </div>
                    )}
                  </div>
                </div>

                {/* Card Actions */}
                <div style={{ borderTop: '1px solid rgba(0,0,0,0.06)', paddingTop: 10 }}>
                  {isAvailable && (
                    <button
                      className="btn-secondary btn-sm"
                      style={{ width: '100%', justifyContent: 'center', background: 'var(--surface)', fontSize: 12 }}
                      onClick={() => setWalkInRoomId(r.id)}
                    >
                      <KeyRound size={13} /> Walk-in Check-in
                    </button>
                  )}

                  {isDirty && (
                    <button
                      className="btn-secondary btn-sm"
                      disabled={markClean.isPending}
                      style={{
                        width: '100%',
                        justifyContent: 'center',
                        background: 'var(--surface)',
                        borderColor: 'var(--tone-renewal)',
                        color: 'var(--tone-renewal)',
                        fontWeight: 600,
                        fontSize: 12,
                      }}
                      onClick={() => markClean.mutate(r.id)}
                    >
                      <Sparkles size={13} /> Mark Clean
                    </button>
                  )}

                  {isOccupied && r.reservation && (
                    <button
                      className="btn-secondary btn-sm"
                      style={{ width: '100%', justifyContent: 'center', background: 'var(--surface)', fontSize: 12 }}
                      onClick={() =>
                        setFolioFor({
                          id: r.reservation!.id,
                          status: 'CHECKED_IN',
                          checkInDate: r.reservation!.checkInDate,
                          checkOutDate: r.reservation!.checkOutDate,
                          totalPriceInr: 0,
                          amountPaidInr: 0,
                          propertyId: propertyId ?? '',
                          guest: { id: '', firstName: r.reservation!.guestName, lastName: null, phone: null, email: null },
                          category: null,
                          room: { id: r.id, roomNumber: r.roomNumber },
                        })
                      }
                    >
                      <Receipt size={13} /> Open Folio
                    </button>
                  )}

                  {isOutOfOrder && canManage && (
                    <button
                      className="btn-secondary btn-sm"
                      style={{ width: '100%', justifyContent: 'center', background: 'var(--surface)', fontSize: 12 }}
                      onClick={() => setStatus.mutate({ id: r.id, status: 'CLEAN' })}
                    >
                      <CheckCircle2 size={13} /> Set Ready
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        /* Table List View */
        <HospitalitySection title="All Rooms List">
          <div className="ds-card" style={{ overflowX: 'auto' }}>
            <table className="ds-table" style={{ width: '100%' }}>
              <thead>
                <tr>
                  <th>Room</th>
                  <th>Floor</th>
                  <th>Room Type</th>
                  <th>Status</th>
                  <th>Current Guest</th>
                  {canManage && <th style={{ textAlign: 'right' }}>Housekeeping Status</th>}
                </tr>
              </thead>
              <tbody>
                {filteredRooms.map((r) => (
                  <tr key={r.id}>
                    <td>
                      <strong className="ds-num" style={{ fontSize: 14 }}>
                        {r.roomNumber}
                      </strong>
                    </td>
                    <td>{r.floor ? `Floor ${r.floor}` : '—'}</td>
                    <td>
                      {r.category ? (
                        <div>
                          <div style={{ fontWeight: 500 }}>{r.category.name}</div>
                          <div className="ds-caption">
                            {fmtOrgMoneyExact(r.category.basePriceInr)} / night · Sleeps {r.category.capacity}
                          </div>
                        </div>
                      ) : (
                        '—'
                      )}
                    </td>
                    <td>
                      <Badge tone={ROOM_TONE[r.derivedStatus] ?? 'neutral'}>
                        {ROOM_LABEL[r.derivedStatus] ?? r.derivedStatus}
                      </Badge>
                    </td>
                    <td>
                      {r.reservation ? (
                        <div>
                          <div style={{ fontWeight: 500 }}>{r.reservation.guestName}</div>
                          <div className="ds-caption">Until {fmtDate(r.reservation.checkOutDate)}</div>
                        </div>
                      ) : (
                        <span className="ds-caption">—</span>
                      )}
                    </td>
                    {canManage && (
                      <td style={{ textAlign: 'right' }}>
                        <select
                          className="input"
                          style={{ width: 140, fontSize: 12 }}
                          value={r.housekeepingStatus}
                          aria-label={`Housekeeping status for room ${r.roomNumber}`}
                          onChange={(e) => setStatus.mutate({ id: r.id, status: e.target.value })}
                        >
                          {HOUSEKEEPING.map((st) => (
                            <option key={st} value={st}>
                              {st.replace('_', ' ').toLowerCase()}
                            </option>
                          ))}
                        </select>
                      </td>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </HospitalitySection>
      )}

      {/* Property, Category and Room Creation Modals */}
      <PropertyModal
        open={newProperty}
        onClose={() => setNewProperty(false)}
        onDone={() => {
          setNewProperty(false);
          refreshAll();
        }}
      />
      <CategoryModal
        open={newCategory}
        propertyId={propertyId}
        onClose={() => setNewCategory(false)}
        onDone={() => {
          setNewCategory(false);
          refreshAll();
        }}
      />
      <RoomModal
        open={newRoom}
        propertyId={propertyId}
        categories={categories}
        onClose={() => setNewRoom(false)}
        onDone={() => {
          setNewRoom(false);
          refreshAll();
        }}
      />
      <WalkInModal
        open={Boolean(walkInRoomId)}
        onClose={() => setWalkInRoomId(null)}
        propertyId={propertyId}
        categories={categories}
        preselectedRoomId={walkInRoomId ?? undefined}
        onDone={() => {
          setWalkInRoomId(null);
          refreshAll();
        }}
      />
      <FolioDrawer
        reservation={folioFor}
        onClose={() => setFolioFor(null)}
        onCheckedOut={() => {
          setFolioFor(null);
          refreshAll();
        }}
      />
    </HospitalityPage>
  );
}

function PropertyModal({ open, onClose, onDone }: { open: boolean; onClose: () => void; onDone: () => void }) {
  const [name, setName] = useState('');
  const [address, setAddress] = useState('');
  const save = useMutation({
    mutationFn: async () => (await api.post('/hotel/properties', { name, address: address || undefined })).data,
    onSuccess: () => {
      toast.success('Property created');
      setName('');
      setAddress('');
      onDone();
    },
    onError: (e) => toast.error(apiErrorMessage(e)),
  });
  return (
    <Modal
      open={open}
      onClose={onClose}
      width={520}
      title="Add Property"
      footer={
        <>
          <button className="btn-secondary" onClick={onClose}>
            Cancel
          </button>
          <button className="btn-primary" disabled={!name.trim() || save.isPending} onClick={() => save.mutate()}>
            Create Property
          </button>
        </>
      }
    >
      <div className="ds-formflow">
        <section>
          <Field label="Property Name" required>
            <input className="input" value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Residency Main Building" />
          </Field>
          <Field label="Address">
            <input className="input" value={address} onChange={(e) => setAddress(e.target.value)} placeholder="e.g. 12 Beach Road, Calicut" />
          </Field>
        </section>
      </div>
    </Modal>
  );
}

function CategoryModal({
  open,
  onClose,
  propertyId,
  onDone,
}: {
  open: boolean;
  onClose: () => void;
  propertyId: string | null;
  onDone: () => void;
}) {
  const [name, setName] = useState('');
  const [price, setPrice] = useState<number | ''>('');
  const [capacity, setCapacity] = useState(2);
  const save = useMutation({
    mutationFn: async () =>
      (
        await api.post(`/hotel/properties/${propertyId}/categories`, {
          name,
          basePriceInr: price === '' ? 0 : price,
          capacity,
        })
      ).data,
    onSuccess: () => {
      toast.success('Room category created');
      setName('');
      setPrice('');
      onDone();
    },
    onError: (e) => toast.error(apiErrorMessage(e)),
  });
  return (
    <Modal
      open={open}
      onClose={onClose}
      width={520}
      title="Add Room Category"
      subtitle="The nightly base rate a reservation of this type is priced from"
      footer={
        <>
          <button className="btn-secondary" onClick={onClose}>
            Cancel
          </button>
          <button className="btn-primary" disabled={!name.trim() || !price || save.isPending} onClick={() => save.mutate()}>
            Create Room Category
          </button>
        </>
      }
    >
      <div className="ds-formflow">
        <section>
          <Field label="Category Name" required>
            <input className="input" value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Deluxe Room" />
          </Field>
          <div className="ds-field-pair" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
            <Field label="Nightly Rate (₹)" required>
              <input
                className="input"
                type="number"
                min={1}
                value={price}
                placeholder="1500"
                onChange={(e) => setPrice(e.target.value === '' ? '' : Number(e.target.value))}
              />
            </Field>
            <Field label="Sleeps (Guests)">
              <input
                className="input"
                type="number"
                min={1}
                max={20}
                value={capacity}
                onChange={(e) => setCapacity(Number(e.target.value))}
              />
            </Field>
          </div>
        </section>
      </div>
    </Modal>
  );
}

function RoomModal({
  open,
  onClose,
  propertyId,
  categories,
  onDone,
}: {
  open: boolean;
  onClose: () => void;
  propertyId: string | null;
  categories: { id: string; name: string }[];
  onDone: () => void;
}) {
  const [roomNumber, setRoomNumber] = useState('');
  const [floor, setFloor] = useState('1');
  const [categoryId, setCategoryId] = useState(categories[0]?.id ?? '');
  const save = useMutation({
    mutationFn: async () =>
      (
        await api.post(`/hotel/properties/${propertyId}/rooms`, {
          roomNumber,
          floor: floor || undefined,
          categoryId,
        })
      ).data,
    onSuccess: () => {
      toast.success(`Room ${roomNumber} added`);
      setRoomNumber('');
      onDone();
    },
    onError: (e) => toast.error(apiErrorMessage(e)),
  });
  return (
    <Modal
      open={open}
      onClose={onClose}
      width={520}
      title="Add Room"
      footer={
        <>
          <button className="btn-secondary" onClick={onClose}>
            Cancel
          </button>
          <button className="btn-primary" disabled={!roomNumber.trim() || !categoryId || save.isPending} onClick={() => save.mutate()}>
            Add Room
          </button>
        </>
      }
    >
      <div className="ds-formflow">
        <section>
          <div className="ds-field-pair" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
            <Field label="Room Number" required hint="e.g. 201">
              <input className="input" value={roomNumber} onChange={(e) => setRoomNumber(e.target.value)} placeholder="201" />
            </Field>
            <Field label="Floor">
              <input className="input" value={floor} onChange={(e) => setFloor(e.target.value)} placeholder="2" />
            </Field>
          </div>
          <Field label="Room Category" required>
            <select className="input" value={categoryId} onChange={(e) => setCategoryId(e.target.value)}>
              {categories.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
          </Field>
        </section>
      </div>
    </Modal>
  );
}
