'use client';

/**
 * Housekeeping Operations Console
 *
 * Real-time room cleaning queue, turn-down tasks, and inspection controls.
 */

import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import {
  BedDouble,
  CheckCircle2,
  ClipboardCheck,
  Plus,
  RefreshCw,
  Search,
  Sparkles,
  TriangleAlert,
  UserCheck,
} from 'lucide-react';
import { api, apiErrorMessage } from '@/lib/api';
import { Badge, EmptyState, Skeleton, StatCard } from '../ui/kit';
import { HospitalityPage, HospitalitySection } from '../ui/page-shell';
import { ROOM_LABEL, ROOM_TONE } from '../ui/tone';
import { useHotelProperty } from '../hooks/use-hotel-property';
import type { RoomRow } from '../types';

export function HousekeepingFeature() {
  const qc = useQueryClient();
  const { propertyId } = useHotelProperty();
  const [filter, setFilter] = useState<'ALL' | 'DIRTY' | 'CLEAN' | 'INSPECTED'>('ALL');

  const { data: rooms = [], isLoading, refetch, isFetching } = useQuery<RoomRow[]>({
    queryKey: ['hotel-rooms-housekeeping', propertyId],
    queryFn: async () => (await api.get('/hotel/rooms', { params: { propertyId } })).data,
    enabled: Boolean(propertyId),
  });

  const setStatus = useMutation({
    mutationFn: async ({ id, status }: { id: string; status: string }) =>
      (await api.post(`/hotel/rooms/${id}/status`, { status })).data,
    onSuccess: (_, vars) => {
      toast.success(`Room status updated to ${vars.status.toLowerCase()}`);
      qc.invalidateQueries({ queryKey: ['hotel-rooms'] });
      qc.invalidateQueries({ queryKey: ['hotel-rooms-housekeeping'] });
      qc.invalidateQueries({ queryKey: ['hotel-reception'] });
    },
    onError: (e) => toast.error(apiErrorMessage(e)),
  });

  const dirtyRooms = rooms.filter((r) => r.housekeepingStatus === 'DIRTY' || r.derivedStatus === 'DIRTY');
  const cleanRooms = rooms.filter((r) => r.housekeepingStatus === 'CLEAN' && r.derivedStatus !== 'DIRTY');
  const inspectedRooms = rooms.filter((r) => r.housekeepingStatus === 'INSPECTED');

  const displayedRooms = rooms.filter((r) => {
    if (filter === 'DIRTY') return r.housekeepingStatus === 'DIRTY' || r.derivedStatus === 'DIRTY';
    if (filter === 'CLEAN') return r.housekeepingStatus === 'CLEAN' && r.derivedStatus !== 'DIRTY';
    if (filter === 'INSPECTED') return r.housekeepingStatus === 'INSPECTED';
    return true;
  });

  return (
    <HospitalityPage
      title="Housekeeping"
      subtitle={`${rooms.length} rooms total · ${dirtyRooms.length} dirty / needs cleaning · ${cleanRooms.length} clean · ${inspectedRooms.length} inspected`}
      actions={
        <button
          className="btn-secondary btn-sm"
          onClick={() => refetch()}
          disabled={isFetching}
        >
          <RefreshCw size={14} className={isFetching ? 'animate-spin' : ''} /> Refresh
        </button>
      }
    >
      {/* KPI Cards */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(170px, 1fr))',
          gap: 12,
          marginBottom: 16,
        }}
      >
        <div
          onClick={() => setFilter('DIRTY')}
          className="ds-card"
          style={{
            padding: '12px 14px',
            cursor: 'pointer',
            border: filter === 'DIRTY' ? '2px solid var(--tone-renewal)' : '1px solid var(--border)',
            background: filter === 'DIRTY' ? 'var(--tone-renewal-bg)' : 'var(--surface)',
          }}
        >
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span className="ds-caption-upper" style={{ fontWeight: 600 }}>Needs Cleaning</span>
            <Sparkles size={16} color="var(--tone-renewal)" />
          </div>
          <div style={{ fontSize: 24, fontWeight: 700, margin: '4px 0 2px', color: 'var(--tone-renewal)' }}>
            {dirtyRooms.length}
          </div>
          <div className="ds-caption">Checkout cleaning required</div>
        </div>

        <div
          onClick={() => setFilter('CLEAN')}
          className="ds-card"
          style={{
            padding: '12px 14px',
            cursor: 'pointer',
            border: filter === 'CLEAN' ? '2px solid var(--tone-active)' : '1px solid var(--border)',
            background: filter === 'CLEAN' ? 'var(--tone-active-bg)' : 'var(--surface)',
          }}
        >
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span className="ds-caption-upper" style={{ fontWeight: 600 }}>Cleaned</span>
            <CheckCircle2 size={16} color="var(--tone-active)" />
          </div>
          <div style={{ fontSize: 24, fontWeight: 700, margin: '4px 0 2px', color: 'var(--tone-active)' }}>
            {cleanRooms.length}
          </div>
          <div className="ds-caption">Ready for inspection/guest</div>
        </div>

        <div
          onClick={() => setFilter('INSPECTED')}
          className="ds-card"
          style={{
            padding: '12px 14px',
            cursor: 'pointer',
            border: filter === 'INSPECTED' ? '2px solid var(--tone-info)' : '1px solid var(--border)',
            background: filter === 'INSPECTED' ? 'var(--tone-info-bg)' : 'var(--surface)',
          }}
        >
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span className="ds-caption-upper" style={{ fontWeight: 600 }}>Inspected</span>
            <ClipboardCheck size={16} color="var(--tone-info)" />
          </div>
          <div style={{ fontSize: 24, fontWeight: 700, margin: '4px 0 2px' }}>
            {inspectedRooms.length}
          </div>
          <div className="ds-caption">Supervised &amp; verified</div>
        </div>
      </div>

      {/* Housekeeping Tasks & Room Board */}
      <HospitalitySection
        title="Cleaning &amp; Housekeeping Queue"
        tools={
          <div style={{ display: 'flex', gap: 6 }}>
            {(['ALL', 'DIRTY', 'CLEAN', 'INSPECTED'] as const).map((s) => (
              <button
                key={s}
                className={filter === s ? 'btn-primary btn-sm' : 'btn-ghost btn-sm'}
                style={{ fontSize: 12 }}
                onClick={() => setFilter(s)}
              >
                {s === 'ALL' ? 'All Rooms' : s[0] + s.slice(1).toLowerCase()}
              </button>
            ))}
          </div>
        }
      >
        {isLoading ? (
          <Skeleton rows={6} />
        ) : displayedRooms.length === 0 ? (
          <EmptyState
            icon={Sparkles}
            title={filter === 'DIRTY' ? 'All Rooms Cleaned!' : 'No Rooms in this Category'}
            body="Housekeeping schedule is clear. Every room meets residency standards."
          />
        ) : (
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))',
              gap: 14,
            }}
          >
            {displayedRooms.map((r) => {
              const isDirty = r.housekeepingStatus === 'DIRTY' || r.derivedStatus === 'DIRTY';
              return (
                <div
                  key={r.id}
                  className="ds-card"
                  style={{
                    padding: 16,
                    borderRadius: 'var(--radius-md, 8px)',
                    border: isDirty
                      ? '1.5px solid var(--tone-renewal-line)'
                      : '1px solid var(--border)',
                    background: isDirty ? 'var(--tone-renewal-bg)' : 'var(--surface)',
                    display: 'flex',
                    flexDirection: 'column',
                    justifyContent: 'space-between',
                    gap: 10,
                  }}
                >
                  <div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <strong className="ds-num" style={{ fontSize: 20 }}>
                        Room {r.roomNumber}
                      </strong>
                      <Badge tone={ROOM_TONE[r.derivedStatus] ?? 'neutral'}>
                        {ROOM_LABEL[r.derivedStatus] ?? r.derivedStatus}
                      </Badge>
                    </div>
                    <div className="ds-caption" style={{ marginTop: 2 }}>
                      {r.category?.name ?? 'Standard'} {r.floor ? `· Floor ${r.floor}` : ''}
                    </div>
                    {r.reservation && (
                      <div className="ds-caption" style={{ marginTop: 6, color: 'var(--ink)' }}>
                        Guest: <strong>{r.reservation.guestName}</strong>
                      </div>
                    )}
                  </div>

                  {/* Actions */}
                  <div
                    style={{
                      borderTop: '1px solid rgba(0,0,0,0.06)',
                      paddingTop: 10,
                      display: 'flex',
                      gap: 6,
                    }}
                  >
                    {isDirty ? (
                      <button
                        className="btn-primary btn-sm"
                        style={{ width: '100%', justifyContent: 'center' }}
                        disabled={setStatus.isPending}
                        onClick={() => setStatus.mutate({ id: r.id, status: 'CLEAN' })}
                      >
                        <Sparkles size={13} /> Mark Clean
                      </button>
                    ) : (
                      <>
                        <button
                          className="btn-secondary btn-sm"
                          style={{ flex: 1, justifyContent: 'center', fontSize: 11.5 }}
                          disabled={setStatus.isPending}
                          onClick={() => setStatus.mutate({ id: r.id, status: 'INSPECTED' })}
                        >
                          <ClipboardCheck size={13} /> Inspected
                        </button>
                        <button
                          className="btn-ghost btn-sm"
                          style={{ fontSize: 11.5 }}
                          disabled={setStatus.isPending}
                          onClick={() => setStatus.mutate({ id: r.id, status: 'DIRTY' })}
                        >
                          Set Dirty
                        </button>
                      </>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </HospitalitySection>
    </HospitalityPage>
  );
}
