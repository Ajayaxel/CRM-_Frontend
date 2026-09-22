'use client';

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useQuery } from '@tanstack/react-query';
import { CalendarClock, Egg, Moon, Truck } from 'lucide-react';
import { api } from '@/lib/api';
import { Badge, Card, EmptyState, Skeleton, StatCard, humanStatus } from '../ui/kit';
import { PageHead, SearchBox, StatusSelect, fmtDate, useListState } from '../ui/common';
import { FARM_STATUSES, toneForFarmStatus } from '../ui/tone';

interface CalendarFarm {
  id: string; code: string; name: string; status: string;
  region: string; supervisor: string;
  capacityBirds: number; currentBirds: number; occupancyPct: number;
  batch: null | {
    id: string; code: string; status: string; placementDate: string;
    ageDays: number; expectedPickupDate: string; pickupDueIn: number;
  };
  lastPickupDate: string | null; restEndsOn: string | null;
  nextPlacementBy: string | null; placementEligible: boolean;
}

export function PoultryCalendar() {
  const router = useRouter();
  const { state, set, params } = useListState();
  const [regionFilter, setRegionFilter] = useState('');

  const { data: farms, isLoading } = useQuery({
    queryKey: ['py-calendar', params, regionFilter],
    queryFn: async () => (await api.get<CalendarFarm[]>('/poultry/farms/calendar', {
      params: {
        ...(params.search ? { search: params.search } : {}),
        ...(params.status ? { status: params.status } : {}),
        ...(regionFilter ? { regionId: regionFilter } : {}),
      },
    })).data,
  });
  const { data: regions } = useQuery({
    queryKey: ['py-regions'],
    queryFn: async () => (await api.get<{ id: string; name: string }[]>('/poultry/regions')).data,
  });

  const rows = farms ?? [];
  const ready = rows.filter((f) => f.placementEligible).length;
  const growing = rows.filter((f) => f.status === 'GROWING').length;
  const pickupDue = rows.filter((f) => f.status === 'PICKUP_DUE').length;
  const resting = rows.filter((f) => f.status === 'RESTING').length;

  return (
    <div className="ds-page">
      <PageHead
        title="Cycle calendar"
        subtitle="Every farm's position in the place → grow → pickup → rest loop"
      />

      <div className="ds-grid ds-grid-kpi">
        <StatCard label="Ready for placement" value={ready} icon={Egg} tone="active" />
        <StatCard label="Growing" value={growing} icon={CalendarClock} tone="renewal" />
        <StatCard label="Pickup due" value={pickupDue} icon={Truck} tone="claim" />
        <StatCard label="Resting" value={resting} icon={Moon} tone="neutral" />
      </div>

      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 14 }}>
        <SearchBox value={state.search} onChange={(v) => set({ search: v })} placeholder="Search farm, code…" />
        <StatusSelect value={state.status} onChange={(v) => set({ status: v })} options={FARM_STATUSES} />
        <select className="input" style={{ maxWidth: 200 }} value={regionFilter} onChange={(e) => setRegionFilter(e.target.value)} aria-label="All regions">
          <option value="">All regions</option>
          {(regions ?? []).map((r) => <option key={r.id} value={r.id}>{r.name}</option>)}
        </select>
      </div>

      {isLoading ? (
        <Skeleton rows={4} height={110} />
      ) : rows.length === 0 ? (
        <Card><EmptyState title="No farms on the board" body="No farms match these filters." compact /></Card>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: 14 }}>
          {rows.map((f) => (
            <Card key={f.id} onClick={() => router.push(`/poultry/farms/${f.id}`)}>
              <div style={{ display: 'flex', alignItems: 'flex-start', gap: 8, marginBottom: 10 }}>
                <div style={{ minWidth: 0 }}>
                  <div style={{ fontWeight: 650 }}>{f.name}</div>
                  <div className="ds-caption">{f.code} · {f.region} · {f.supervisor || '—'}</div>
                </div>
                <div style={{ marginLeft: 'auto', display: 'flex', gap: 6, flexWrap: 'wrap', justifyContent: 'flex-end' }}>
                  <Badge tone={toneForFarmStatus(f.status)}>{humanStatus(f.status)}</Badge>
                  {f.placementEligible && <Badge tone="active">Ready for placement</Badge>}
                </div>
              </div>

              <div style={{ marginBottom: 10 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                  <span className="ds-caption">Occupancy</span>
                  <span className="ds-caption">
                    {f.currentBirds.toLocaleString('en-IN')} / {f.capacityBirds.toLocaleString('en-IN')} · {Math.round(f.occupancyPct)}%
                  </span>
                </div>
                <div style={{ height: 6, borderRadius: 4, background: 'var(--surface-2)', overflow: 'hidden' }}>
                  <div style={{
                    height: '100%', borderRadius: 4,
                    width: `${Math.min(100, Math.max(0, f.occupancyPct))}%`,
                    background: 'var(--tone-active)',
                  }} />
                </div>
              </div>

              {f.batch ? (
                <div style={{ fontSize: 13 }}>
                  <strong>{f.batch.code}</strong> · day {f.batch.ageDays} of cycle ·{' '}
                  {f.batch.pickupDueIn < 0
                    ? <span style={{ color: 'var(--tone-expired)', fontWeight: 600 }}>pickup overdue by {Math.abs(f.batch.pickupDueIn)}d</span>
                    : <span>pickup in {f.batch.pickupDueIn}d</span>}
                </div>
              ) : (
                <div className="ds-caption">
                  {f.restEndsOn ? `Rest ends ${fmtDate(f.restEndsOn)}` : 'No batch on the farm'}
                  {f.nextPlacementBy ? ` · next placement by ${fmtDate(f.nextPlacementBy)}` : ''}
                </div>
              )}
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
