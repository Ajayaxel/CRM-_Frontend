'use client';

/**
 * The visual space explorer.
 *
 * A floor is a background plate plus a rectangle per space, both stored on the
 * row — so the plan is drawn from the database and a space added tonight
 * appears on it without a deploy. Clicking a hotspot opens the detail modal for
 * THAT space; clicking another one changes the id and every panel re-reads.
 * There is no per-space markup anywhere in this file.
 *
 * A floor with no plan image still works: the hotspots fall back to a grid of
 * cards, which is the same data drawn differently rather than a dead end.
 */

import { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Building2, LayoutGrid, Map as MapIcon, RefreshCw } from 'lucide-react';
import { api } from '@/lib/api';
import { Badge, EmptyState, Segmented, Skeleton, humanStatus } from '../ui/kit';
import { SPACE_STATUSES, SPACE_TYPES, spaceTypeLabel, toneForSpaceStatus } from '../ui/tone';
import { PageHead, money } from '../ui/common';
import { SpaceDetailModal, type SpaceDetail } from '../ui/space-detail';
import { BookingWizard, type BookingWizardSpace } from '../ui/booking-wizard';

interface PlanSpace {
  id: string; name: string; code: string; type: string; customType?: string | null;
  zone?: string | null; capacity: number; units: number; status: string; liveStatus: string;
  planX?: number | null; planY?: number | null; planW?: number | null; planH?: number | null; planShape: string;
  coverUrl?: string | null; amenities: string[];
  hourlyInr?: number | null; dailyInr?: number | null; monthlyInr?: number | null;
  occupiedBy?: string | null; occupiedUntil?: string | null;
}

interface FloorPlanResponse {
  floor: {
    id: string; name: string; level: number;
    planImageUrl?: string | null; planWidth: number; planHeight: number;
    zones: { key: string; label: string; color?: string }[];
    building: { id: string; name: string; code: string; city?: string | null };
  };
  spaces: PlanSpace[];
}

interface FloorRow {
  id: string; name: string; level: number; planImageUrl?: string | null;
  building: { id: string; name: string; code: string };
  _count: { spaces: number };
}

const STATUS_FILL: Record<string, string> = {
  AVAILABLE: 'var(--tone-active)',
  OCCUPIED: 'var(--tone-sales)',
  RESERVED: 'var(--tone-renewal)',
  MAINTENANCE: 'var(--tone-claim)',
  BLOCKED: 'var(--tone-expired)',
  INACTIVE: 'var(--ink-3)',
};

const DESK_TYPES = new Set(['HOT_DESK', 'DEDICATED_DESK']);

function countLabel(space: PlanSpace): string {
  if (DESK_TYPES.has(space.type)) return `${space.units} ${space.units === 1 ? 'desk' : 'desks'}`;
  return `${space.capacity} ${space.capacity === 1 ? 'seat' : 'seats'}`;
}

function Hotspot({
  space, floorW, floorH, onOpen,
}: { space: PlanSpace; floorW: number; floorH: number; onOpen: () => void }) {
  const x = ((space.planX ?? 0) / floorW) * 100;
  const y = ((space.planY ?? 0) / floorH) * 100;
  const w = ((space.planW ?? 120) / floorW) * 100;
  const h = ((space.planH ?? 90) / floorH) * 100;
  const fill = STATUS_FILL[space.liveStatus] ?? 'var(--ink-3)';

  return (
    <button
      type="button"
      onClick={onOpen}
      title={`${space.name} — ${humanStatus(space.liveStatus)}`}
      aria-label={`${space.name}, ${humanStatus(space.liveStatus)}, ${countLabel(space)}`}
      className="cw-hotspot"
      style={{
        position: 'absolute',
        left: `${x}%`, top: `${y}%`, width: `${w}%`, height: `${h}%`,
        borderRadius: space.planShape === 'circle' ? '50%' : 5,
        border: `2px solid ${fill}`,
        boxShadow: `inset 0 0 0 1.5px color-mix(in srgb, ${fill} 30%, transparent), var(--shadow-1, 0 1px 2px rgba(0,0,0,0.06))`,
        background: `linear-gradient(180deg, color-mix(in srgb, var(--surface) 94%, ${fill}) 0%, color-mix(in srgb, var(--surface) 82%, ${fill}) 100%)`,
        cursor: 'pointer', padding: '6px 8px', overflow: 'hidden',
        display: 'flex', flexDirection: 'column', justifyContent: 'flex-end', gap: 1,
        textAlign: 'left', font: 'inherit',
      }}
    >
      {/* door notch on the room's lower-left wall */}
      {space.planShape !== 'circle' && (
        <span aria-hidden style={{
          position: 'absolute', left: -2, bottom: 12, width: 3, height: 18,
          background: 'var(--surface)', borderTop: `2px solid ${fill}`, borderBottom: `2px solid ${fill}`,
        }} />
      )}
      <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5, minWidth: 0 }}>
        <span aria-hidden style={{ width: 7, height: 7, borderRadius: '50%', background: fill, flexShrink: 0 }} />
        <span style={{
          fontSize: 11.5, fontWeight: 750, color: 'var(--ink)', lineHeight: 1.2,
          overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
        }}>{space.name}</span>
      </span>
      <span style={{ fontSize: 10, fontWeight: 600, color: 'var(--ink-2)', display: 'block' }}>
        {spaceTypeLabel(space.type, space.customType)} · {countLabel(space)}
      </span>
    </button>
  );
}

function SpaceCard({ space, onOpen }: { space: PlanSpace; onOpen: () => void }) {
  return (
    <button
      type="button"
      onClick={onOpen}
      className="ds-card ds-card-interactive"
      style={{ padding: 0, overflow: 'hidden', textAlign: 'left', font: 'inherit', display: 'block', width: '100%' }}
    >
      <div style={{ height: 118, background: 'var(--surface-2)', position: 'relative' }}>
        {space.coverUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={space.coverUrl} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }} />
        ) : (
          <span style={{
            position: 'absolute', inset: 0, display: 'flex', alignItems: 'center',
            justifyContent: 'center', color: 'var(--ink-3)', fontSize: 12,
          }}>No photograph</span>
        )}
        <span style={{ position: 'absolute', top: 8, left: 8 }}>
          <Badge tone={toneForSpaceStatus(space.liveStatus)}>{humanStatus(space.liveStatus)}</Badge>
        </span>
      </div>
      <div style={{ padding: 12 }}>
        <div style={{ fontSize: 13.5, fontWeight: 650, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{space.name}</div>
        <div className="ds-caption" style={{ marginTop: 2 }}>
          {spaceTypeLabel(space.type, space.customType)} · {countLabel(space)}{space.zone ? ` · ${space.zone}` : ''}
        </div>
        <div style={{ fontSize: 12.5, fontWeight: 600, marginTop: 6, color: 'var(--ink-2)' }}>
          {space.hourlyInr != null ? `${money(space.hourlyInr)}/hr` : space.dailyInr != null ? `${money(space.dailyInr)}/day` : space.monthlyInr != null ? `${money(space.monthlyInr)}/mo` : 'Plan only'}
        </div>
      </div>
    </button>
  );
}

export function CoworkingFloorPlan() {
  const [floorId, setFloorId] = useState<string>('');
  const [view, setView] = useState<'Plan' | 'Grid'>('Plan');
  const [typeFilter, setTypeFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [openSpaceId, setOpenSpaceId] = useState<string | null>(null);
  const [bookingSpace, setBookingSpace] = useState<BookingWizardSpace | null>(null);

  const { data: floors, isLoading: floorsLoading } = useQuery({
    queryKey: ['cw-floors'],
    queryFn: async () => (await api.get<FloorRow[]>('/coworking/floors')).data,
  });

  const activeFloorId = floorId || floors?.[0]?.id || '';

  const { data: plan, isLoading, refetch, isFetching } = useQuery({
    queryKey: ['cw-floor-plan', activeFloorId],
    queryFn: async () => (await api.get<FloorPlanResponse>(`/coworking/floors/${activeFloorId}/plan`)).data,
    enabled: !!activeFloorId,
  });

  const spaces = useMemo(() => {
    let rows = plan?.spaces ?? [];
    if (typeFilter) rows = rows.filter((s) => s.type === typeFilter);
    if (statusFilter) rows = rows.filter((s) => s.liveStatus === statusFilter);
    return rows;
  }, [plan, typeFilter, statusFilter]);

  const positioned = spaces.filter((s) => s.planX != null && s.planY != null);
  const counts = useMemo(() => {
    const c: Record<string, number> = {};
    for (const s of plan?.spaces ?? []) c[s.liveStatus] = (c[s.liveStatus] ?? 0) + 1;
    return c;
  }, [plan]);

  if (floorsLoading) return <div className="ds-page"><Skeleton rows={3} height={90} /></div>;

  if (!floors?.length) {
    return (
      <div className="ds-page">
        <PageHead title="Floor plan" subtitle="The clickable map of your space." />
        <EmptyState
          icon={Building2}
          title="No floors yet"
          body="Add a building and a floor under Spaces, then place each space on the plan. The explorer draws itself from those rows."
        />
      </div>
    );
  }

  return (
    <div className="ds-page">
      <PageHead
        title="Floor plan"
        subtitle={plan ? `${plan.floor.building.name} · ${plan.floor.name}` : 'The clickable map of your space.'}
        actions={
          <>
            <button className="btn-ghost btn-sm" onClick={() => refetch()} disabled={isFetching}>
              <RefreshCw size={13} style={{ marginRight: 6 }} />{isFetching ? 'Refreshing…' : 'Refresh'}
            </button>
            <Segmented options={['Plan', 'Grid']} value={view} onChange={(v) => setView(v as 'Plan' | 'Grid')} />
          </>
        }
      />

      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center', marginBottom: 16 }}>
        <select className="input" style={{ maxWidth: 260 }} value={activeFloorId} onChange={(e) => setFloorId(e.target.value)} aria-label="Floor">
          {floors.map((f) => (
            <option key={f.id} value={f.id}>{f.building.name} — {f.name} ({f._count.spaces})</option>
          ))}
        </select>
        <select className="input" style={{ maxWidth: 190 }} value={typeFilter} onChange={(e) => setTypeFilter(e.target.value)} aria-label="Space type">
          <option value="">All types</option>
          {SPACE_TYPES.map((t) => <option key={t} value={t}>{spaceTypeLabel(t)}</option>)}
        </select>
        <select className="input" style={{ maxWidth: 180 }} value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)} aria-label="Status">
          <option value="">All statuses</option>
          {SPACE_STATUSES.map((s) => <option key={s} value={s}>{humanStatus(s)}</option>)}
        </select>

        <div style={{ marginLeft: 'auto', display: 'flex', gap: 10, flexWrap: 'wrap' }}>
          {SPACE_STATUSES.filter((s) => counts[s]).map((s) => (
            <span key={s} style={{ display: 'inline-flex', alignItems: 'center', gap: 5, fontSize: 12, color: 'var(--ink-2)' }}>
              <span style={{ width: 9, height: 9, borderRadius: 3, background: STATUS_FILL[s], display: 'inline-block' }} />
              {humanStatus(s)} {counts[s]}
            </span>
          ))}
        </div>
      </div>

      {isLoading ? (
        <Skeleton rows={2} height={220} />
      ) : !plan || plan.spaces.length === 0 ? (
        <EmptyState
          icon={LayoutGrid}
          title="Nothing on this floor yet"
          body="Add spaces and give each one a position on the plan, or switch to the grid view to work without a plan image."
        />
      ) : view === 'Plan' && (plan.floor.planImageUrl || positioned.length > 0) ? (
        <div className="ds-card" style={{ padding: 14 }}>
          <div
            style={{
              position: 'relative', width: '100%',
              aspectRatio: `${plan.floor.planWidth} / ${plan.floor.planHeight}`,
              borderRadius: 6, overflow: 'hidden',
              border: plan.floor.planImageUrl ? '1px solid var(--line)' : '3px solid var(--ink)',
              background: plan.floor.planImageUrl
                ? 'var(--surface-2)'
                : 'repeating-linear-gradient(90deg, transparent 0 110px, rgba(58,47,42,0.05) 110px 112px), linear-gradient(180deg, color-mix(in srgb, var(--gold-bg) 60%, var(--surface)) 0%, var(--gold-bg) 100%)',
            }}
          >
            {plan.floor.planImageUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={plan.floor.planImageUrl}
                alt={`${plan.floor.name} plan`}
                style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'contain' }}
              />
            ) : (
              <>
                {/* window band along the top wall */}
                <div aria-hidden style={{
                  position: 'absolute', top: 6, left: 10, right: 10, height: 14, borderRadius: 3,
                  background: 'linear-gradient(90deg, var(--tone-sales-bg), #dff0fb 40%, var(--tone-sales-bg))',
                  border: '1px solid var(--tone-sales-line)', display: 'flex',
                }}>
                  {Array.from({ length: 10 }, (_, i) => (
                    <span key={i} style={{ flex: 1, borderRight: i < 9 ? '1px solid var(--tone-sales-line)' : 'none' }} />
                  ))}
                </div>
                <span aria-hidden style={{
                  position: 'absolute', top: 26, left: '50%', transform: 'translateX(-50%)',
                  fontSize: 9.5, fontWeight: 800, letterSpacing: '0.1em', background: 'var(--tone-active-bg)',
                  color: 'var(--tone-active)', border: '1px solid var(--tone-active-line)', borderRadius: 999, padding: '2px 11px',
                  whiteSpace: 'nowrap',
                }}>WINDOW · NATURAL LIGHT</span>
                {/* entrance pill on the left wall */}
                <span aria-hidden style={{
                  position: 'absolute', left: 6, top: '48%', transform: 'rotate(180deg)', writingMode: 'vertical-rl',
                  fontSize: 9, fontWeight: 800, letterSpacing: '0.1em', background: 'var(--tone-expired-bg)',
                  color: 'var(--tone-expired)', border: '1px solid var(--tone-expired-line)', borderRadius: 999, padding: '9px 2px',
                }}>ENTRANCE</span>
              </>
            )}
            {positioned.map((s) => (
              <Hotspot
                key={s.id} space={s}
                floorW={plan.floor.planWidth} floorH={plan.floor.planHeight}
                onOpen={() => setOpenSpaceId(s.id)}
              />
            ))}
          </div>

          {spaces.length > positioned.length && (
            <div className="ds-caption" style={{ marginTop: 12 }}>
              {spaces.length - positioned.length} space(s) on this floor have no position on the plan yet — they appear in the grid view.
            </div>
          )}
        </div>
      ) : (
        <div className="ds-grid ds-grid-cards">
          {spaces.map((s) => <SpaceCard key={s.id} space={s} onOpen={() => setOpenSpaceId(s.id)} />)}
        </div>
      )}

      {view === 'Plan' && !plan?.floor.planImageUrl && positioned.length > 0 && (
        <div className="ds-caption" style={{ marginTop: 10, display: 'flex', gap: 6, alignItems: 'center' }}>
          <MapIcon size={13} /> No plan image on this floor — the hotspots are drawn on a blank canvas. Add one under Spaces → Floors.
        </div>
      )}

      <SpaceDetailModal
        spaceId={openSpaceId}
        onClose={() => setOpenSpaceId(null)}
        onBook={(space: SpaceDetail) => {
          setOpenSpaceId(null);
          setBookingSpace({
            id: space.id, name: space.name, code: space.code, type: space.type, capacity: space.capacity,
            units: space.units, zone: space.zone,
            hourlyInr: space.hourlyInr, halfDayInr: space.halfDayInr, dailyInr: space.dailyInr,
            weeklyInr: space.weeklyInr, monthlyInr: space.monthlyInr,
          });
        }}
      />

      <BookingWizard
        space={bookingSpace}
        open={!!bookingSpace}
        onClose={() => setBookingSpace(null)}
      />

      <style jsx>{`
        :global(.cw-hotspot) { transition: transform 140ms ease, box-shadow 140ms ease; }
        :global(.cw-hotspot:hover), :global(.cw-hotspot:focus-visible) {
          transform: scale(1.03);
          box-shadow: var(--e-float);
          z-index: 2;
        }
        @media (prefers-reduced-motion: reduce) {
          :global(.cw-hotspot) { transition: none; }
          :global(.cw-hotspot:hover) { transform: none; }
        }
      `}</style>
    </div>
  );
}
