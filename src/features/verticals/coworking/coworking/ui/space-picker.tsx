'use client';

/**
 * "Which space?" — step zero of a new booking.
 *
 * Two levels of inventory, two ways to choose. Rooms, cabins and whole spaces
 * are picked from a card the way they always were: one card is one bookable
 * thing, and a click selects it. Desk-type spaces (hot desks, dedicated desks,
 * day passes) are WHERE someone sits, so their cards hand over to the floor
 * map — the same hotspot canvas the explorer draws from the database — and the
 * click lands on the exact spot instead of an abstract list row.
 *
 * The wizard itself is untouched: whatever view chose the space, the result is
 * one BookingWizardSpace and the existing Date → Customer → Extras → Review →
 * Payment flow takes it from there. Availability is not enforced here — the
 * wizard's slot grid checks the actual date and time, so a space that is
 * occupied right now can still be booked for tomorrow.
 */

import { useEffect, useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { LayoutList, Map as MapIcon } from 'lucide-react';
import { api } from '@/lib/api';
import { Badge, EmptyState, Modal, Segmented, Skeleton, humanStatus } from './kit';
import { SPACE_STATUSES, spaceTypeLabel, toneForSpaceStatus } from './tone';
import { money } from './common';
import type { BookingWizardSpace } from './booking-wizard';

/** Space types booked as a seat rather than as a room. Day passes book the
 *  zone directly — the pass is for the zone, not a particular chair. */
const SEAT_TYPES = new Set(['HOT_DESK', 'DEDICATED_DESK']);

interface PickerSpace extends BookingWizardSpace {
  status: string; units: number; zone?: string | null; customType?: string | null;
  floorId?: string | null; planX?: number | null; planY?: number | null;
}

interface PlanSpace {
  id: string; name: string; code: string; type: string; customType?: string | null;
  capacity: number; units: number; liveStatus: string;
  planX?: number | null; planY?: number | null; planW?: number | null; planH?: number | null; planShape: string;
  hourlyInr?: number | null; dailyInr?: number | null; monthlyInr?: number | null;
}

interface FloorPlanResponse {
  floor: { id: string; name: string; planImageUrl?: string | null; planWidth: number; planHeight: number; building: { name: string } };
  spaces: PlanSpace[];
}

interface FloorRow { id: string; name: string; building: { name: string }; _count: { spaces: number } }

// The explorer's status palette (floor-plan.tsx keeps the twin of this map).
const STATUS_FILL: Record<string, string> = {
  AVAILABLE: 'var(--tone-active)',
  OCCUPIED: 'var(--tone-sales)',
  RESERVED: 'var(--tone-renewal)',
  MAINTENANCE: 'var(--tone-claim)',
  BLOCKED: 'var(--tone-expired)',
  INACTIVE: 'var(--ink-3)',
};

function priceLine(s: { hourlyInr?: number | null; dailyInr?: number | null; monthlyInr?: number | null }) {
  if (s.hourlyInr != null) return `${money(s.hourlyInr)}/hr`;
  if (s.dailyInr != null) return `${money(s.dailyInr)}/day`;
  if (s.monthlyInr != null) return `${money(s.monthlyInr)}/mo`;
  return 'Plan only';
}

export function SpacePicker({
  open, onClose, onPick,
}: {
  open: boolean;
  onClose: () => void;
  onPick: (space: BookingWizardSpace) => void;
}) {
  const [view, setView] = useState<'List' | 'Floor map'>('List');
  const [floorId, setFloorId] = useState('');
  const [focusSpaceId, setFocusSpaceId] = useState<string | null>(null);

  // A fresh open always starts at the list with nothing half-selected; the
  // floor choice survives, since List <-> Floor map inside one session should.
  useEffect(() => {
    if (open) { setView('List'); setFocusSpaceId(null); }
  }, [open]);

  const { data: spaces, isLoading } = useQuery({
    queryKey: ['cw-spaces-picker'],
    queryFn: async () => (await api.get<{ data: PickerSpace[] }>('/coworking/spaces', { params: { limit: 200 } })).data.data,
    enabled: open,
  });

  const { data: floors } = useQuery({
    queryKey: ['cw-floors'],
    queryFn: async () => (await api.get<FloorRow[]>('/coworking/floors')).data,
    enabled: open && view === 'Floor map',
  });
  const activeFloorId = floorId || floors?.[0]?.id || '';

  const { data: plan, isLoading: planLoading } = useQuery({
    queryKey: ['cw-floor-plan', activeFloorId],
    queryFn: async () => (await api.get<FloorPlanResponse>(`/coworking/floors/${activeFloorId}/plan`)).data,
    enabled: open && view === 'Floor map' && !!activeFloorId,
  });

  const bookable = useMemo(
    () => (spaces ?? []).filter((s) => s.status !== 'INACTIVE'),
    [spaces],
  );
  const rooms = bookable.filter((s) => !SEAT_TYPES.has(s.type));
  const desks = bookable.filter((s) => SEAT_TYPES.has(s.type));
  const positioned = (plan?.spaces ?? []).filter((s) => s.planX != null && s.planY != null);

  // Desk zones go straight to the wizard too: the exact desk is chosen on the
  // seat map AFTER date & time, because which desks are free depends on the
  // window. The picker's map view stays for spatial discovery.
  const pickDesk = (s: PickerSpace) => onPick(s);

  const pickFromPlan = (s: PlanSpace) => {
    if (s.liveStatus === 'INACTIVE') return;
    onPick({
      id: s.id, name: s.name, code: s.code, type: s.type, capacity: s.capacity, units: s.units,
      hourlyInr: s.hourlyInr, dailyInr: s.dailyInr, monthlyInr: s.monthlyInr,
    });
  };

  return (
    <Modal open={open} onClose={onClose} title="Which space?" width={960}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 14 }}>
        <Segmented options={['List', 'Floor map']} value={view} onChange={(v) => setView(v as 'List' | 'Floor map')} />
        {view === 'Floor map' && floors && floors.length > 1 && (
          <select className="input" style={{ maxWidth: 250 }} value={activeFloorId} onChange={(e) => setFloorId(e.target.value)} aria-label="Floor">
            {floors.map((f) => <option key={f.id} value={f.id}>{f.building.name} — {f.name} ({f._count.spaces})</option>)}
          </select>
        )}
        <span className="ds-caption" style={{ marginLeft: 'auto' }}>
          {view === 'List' ? 'Rooms book from a card; desks pick their spot on the map.' : 'Click a space to book it — the next step checks the date.'}
        </span>
      </div>

      {view === 'List' ? (
        isLoading ? (
          <Skeleton rows={2} height={90} />
        ) : !bookable.length ? (
          <EmptyState compact title="No bookable spaces" body="Add a space first, or check none of them are inactive." />
        ) : (
          <>
            {rooms.length > 0 && (
              <>
                <div style={{ marginBottom: 10, fontSize: 13.5, fontWeight: 750, color: 'var(--ink-2)', letterSpacing: '0.01em' }}>Rooms &amp; whole spaces</div>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(215px, 1fr))', gap: 12, marginBottom: desks.length ? 20 : 0 }}>
                  {rooms.map((s) => (
                    <button key={s.id} type="button" className="ds-card ds-card-interactive" style={{ padding: 16, textAlign: 'left', font: 'inherit' }} onClick={() => onPick(s)}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', gap: 8 }}>
                        <span style={{ fontWeight: 700, fontSize: 14.5, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{s.name}</span>
                        <Badge tone={toneForSpaceStatus(s.status)}>{humanStatus(s.status)}</Badge>
                      </div>
                      <div className="ds-caption" style={{ marginTop: 2 }}>{spaceTypeLabel(s.type, s.customType)} · {s.capacity} seats</div>
                      <div style={{ fontSize: 14, fontWeight: 750, marginTop: 9, color: 'var(--ink)' }}>{priceLine(s)}</div>
                    </button>
                  ))}
                </div>
              </>
            )}
            {desks.length > 0 && (
              <>
                <div style={{ marginBottom: 10, display: 'flex', alignItems: 'center', gap: 6, fontSize: 13.5, fontWeight: 750, color: 'var(--ink-2)', letterSpacing: '0.01em' }}>
                  <MapIcon size={13} /> Desks &amp; seats — pick the exact spot
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(215px, 1fr))', gap: 12 }}>
                  {desks.map((s) => (
                    <button key={s.id} type="button" className="ds-card ds-card-interactive" style={{ padding: 16, textAlign: 'left', font: 'inherit' }} onClick={() => pickDesk(s)}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', gap: 8 }}>
                        <span style={{ fontWeight: 700, fontSize: 14.5, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{s.name}</span>
                        <Badge tone={toneForSpaceStatus(s.status)}>{humanStatus(s.status)}</Badge>
                      </div>
                      <div className="ds-caption" style={{ marginTop: 2 }}>{spaceTypeLabel(s.type, s.customType)} · {s.units > 1 ? `${s.units} desks` : `${s.capacity} seats`}</div>
                      <div style={{ fontSize: 13, fontWeight: 650, marginTop: 8, color: 'var(--navy)', display: 'flex', alignItems: 'center', gap: 5 }}>
                        <MapIcon size={12} /> {priceLine(s)} · pick your desk after date &amp; time
                      </div>
                    </button>
                  ))}
                </div>
              </>
            )}
          </>
        )
      ) : planLoading || !plan ? (
        <Skeleton rows={2} height={180} />
      ) : !positioned.length ? (
        <EmptyState
          compact icon={LayoutList} title="Nothing placed on this floor yet"
          body="Give spaces a position under Spaces → Floors, or use the list view."
        />
      ) : (
        <>
          <div
            style={{
              position: 'relative', width: '100%',
              aspectRatio: `${plan.floor.planWidth} / ${plan.floor.planHeight}`,
              background: 'var(--surface-2)', borderRadius: 'var(--r-card)', overflow: 'hidden',
            }}
          >
            {plan.floor.planImageUrl && (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={plan.floor.planImageUrl} alt={`${plan.floor.name} plan`} style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'contain' }} />
            )}
            {positioned.map((s) => {
              const x = ((s.planX ?? 0) / plan.floor.planWidth) * 100;
              const y = ((s.planY ?? 0) / plan.floor.planHeight) * 100;
              const w = ((s.planW ?? 120) / plan.floor.planWidth) * 100;
              const h = ((s.planH ?? 90) / plan.floor.planHeight) * 100;
              const fill = STATUS_FILL[s.liveStatus] ?? 'var(--ink-3)';
              const focused = s.id === focusSpaceId;
              return (
                <button
                  key={s.id} type="button" className="cw-pick-hotspot"
                  onClick={() => pickFromPlan(s)}
                  title={`${s.name} — ${humanStatus(s.liveStatus)}`}
                  aria-label={`Book ${s.name}, ${humanStatus(s.liveStatus)}, seats ${s.capacity}`}
                  style={{
                    position: 'absolute', left: `${x}%`, top: `${y}%`, width: `${w}%`, height: `${h}%`,
                    borderRadius: s.planShape === 'circle' ? '50%' : 8,
                    border: `2px solid ${fill}`,
                    background: `color-mix(in srgb, ${fill} 22%, transparent)`,
                    cursor: s.liveStatus === 'INACTIVE' ? 'default' : 'pointer',
                    boxShadow: focused ? '0 0 0 3px var(--gold)' : undefined,
                    padding: 4, overflow: 'hidden',
                    display: 'flex', flexDirection: 'column', justifyContent: 'flex-end',
                    textAlign: 'left', font: 'inherit',
                  }}
                >
                  <span style={{ fontSize: 11, fontWeight: 700, color: 'var(--ink)', lineHeight: 1.2, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', display: 'block' }}>{s.name}</span>
                  <span style={{ fontSize: 10, color: 'var(--ink-2)', display: 'block' }}>{s.units > 1 ? `${s.units} desks` : `${s.capacity} seats`} · {priceLine(s)}</span>
                </button>
              );
            })}
          </div>
          <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', marginTop: 10 }}>
            {SPACE_STATUSES.map((st) => (
              <span key={st} style={{ display: 'inline-flex', alignItems: 'center', gap: 5, fontSize: 12, color: 'var(--ink-2)' }}>
                <span style={{ width: 9, height: 9, borderRadius: 3, background: STATUS_FILL[st], display: 'inline-block' }} />
                {humanStatus(st)}
              </span>
            ))}
            <span className="ds-caption" style={{ marginLeft: 'auto' }}>Occupied now can still be booked for later — the date step decides.</span>
          </div>
        </>
      )}
      <style jsx>{`
        :global(.cw-pick-hotspot) { transition: transform 140ms ease, box-shadow 140ms ease; }
        :global(.cw-pick-hotspot:hover), :global(.cw-pick-hotspot:focus-visible) {
          transform: scale(1.03);
          box-shadow: var(--e-float);
          z-index: 2;
        }
        @media (prefers-reduced-motion: reduce) {
          :global(.cw-pick-hotspot) { transition: none; }
          :global(.cw-pick-hotspot:hover) { transform: none; }
        }
      `}</style>
    </Modal>
  );
}
