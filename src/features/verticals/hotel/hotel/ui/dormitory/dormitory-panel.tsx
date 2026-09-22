'use client';

/**
 * The centre column when the chosen room type is a shared room.
 *
 * Same anatomy as the private-room floor map — heading, a count, the map, a
 * legend — so a receptionist who has booked a room already knows how to read
 * this. What changes is the unit: doors become mattresses, and the count in
 * the corner counts beds rather than rooms.
 *
 * Every number on this panel is server truth for THIS window. Nothing is
 * hardcoded and nothing is inferred from the room's own status alone: a bed
 * free tonight can be taken on the 20th, so occupancy is asked per stay.
 */

import type { CSSProperties } from 'react';
import { useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { BedDouble, Building2, Layers } from 'lucide-react';
import { api } from '@/lib/api';
import { EmptyState, Skeleton } from '../kit';
import { BunkBed } from './bunk-bed';
import type { Bedspace, BedspaceBoard, BedspaceStatus, Bunk, DormitoryRow } from './types';

/** Which dormitory of the property we are looking into. */
function DormitorySelector({
  dorms, value, onChange,
}: { dorms: DormitoryRow[]; value: string | null; onChange: (id: string) => void }) {
  if (dorms.length === 1) {
    return <span className="hs-dorm-single">{dorms[0].name}</span>;
  }
  return (
    <select className="input hs-dorm-select" value={value ?? ''}
            onChange={(e) => onChange(e.target.value)} aria-label="Choose dormitory">
      {dorms.map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}
    </select>
  );
}

/**
 * What this dormitory is, in the three facts that decide whether it suits the
 * guest in front of you: how many beds, how they are arranged, which floor.
 */
function BedspaceStats({ board, loading }: { board: BedspaceBoard | undefined; loading: boolean }) {
  if (!board) return null;
  const d = board.dormitory;
  const n = board.window.nights;
  return (
    <div className="hs-dorm-meta">
      <span><BedDouble size={14} /> {d.capacity} bed spaces</span>
      <span><Layers size={14} /> {d.bunkCount} bunk beds (Top/Bottom)</span>
      <span><Building2 size={14} /> {d.floor ? `Floor ${d.floor}` : 'Unassigned floor'}</span>
      <strong className="hs-dorm-free">
        {loading ? 'Checking availability…'
          : `${board.totals.available} of ${board.totals.total} beds free for ${n} night${n === 1 ? '' : 's'}`}
      </strong>
    </div>
  );
}

/**
 * The dormitory itself — every bunk in the room, laid out dense.
 *
 * Density is the message. A twenty-four bunk dormitory drawn six to a screen
 * reads as a small hotel; drawn eight to a row it reads as a hostel, which is
 * what it is. So the grid packs as many bunks per row as the panel can fit at a
 * legible bunk width and lets the canvas scroll, rather than shrinking the beds
 * until the mattresses stop being recognisable.
 *
 * Small rooms are the exception: four bunks spread across eight columns would
 * leave half a row of air, so anything under the target simply uses its own
 * count and the grid centres it.
 */
const BUNKS_PER_ROW = 8;

function bunkColumns(n: number): number {
  return Math.max(1, Math.min(BUNKS_PER_ROW, n));
}

function BunkBedGrid({
  bunks, selectedCode, onSelect,
}: { bunks: Bunk[]; selectedCode: string | null; onSelect: (s: Bedspace) => void }) {
  return (
    <div className="hs-bunk-grid"
         style={{ '--bunk-cols': bunkColumns(bunks.length) } as CSSProperties}>
      {bunks.map((b) => (
        <BunkBed key={b.id} bunk={b} pad={String(bunks.length).length}
                 selectedCode={selectedCode} onSelect={onSelect} />
      ))}
    </div>
  );
}

const LEGEND: { status: BedspaceStatus; label: string }[] = [
  { status: 'available', label: 'Available' },
  { status: 'occupied', label: 'Occupied / reserved' },
  { status: 'needs_cleaning', label: 'Needs cleaning' },
  { status: 'out_of_order', label: 'Out of order' },
];

const LEGEND_TONE: Record<string, string> = {
  available: 'var(--tone-active)',
  occupied: 'var(--tone-sales)',
  needs_cleaning: 'var(--tone-renewal)',
  out_of_order: 'var(--tone-expired)',
};

function BedspaceLegend() {
  return (
    <div className="hs-bunk-legend ds-card">
      {LEGEND.map((l) => (
        <span key={l.status}>
          <i className="hs-key" style={{ background: LEGEND_TONE[l.status] }} /> {l.label}
        </span>
      ))}
    </div>
  );
}

export function DormitoryPanel({
  propertyId, categoryId, dormitoryId, onDormitoryChange, from, to,
  selectedCode, onSelect, onBoard,
}: {
  propertyId: string | null;
  /** Narrow to the room type the receptionist picked, when they picked one. */
  categoryId: string;
  dormitoryId: string | null;
  onDormitoryChange: (id: string) => void;
  from: string;
  to: string;
  selectedCode: string | null;
  onSelect: (space: Bedspace, board: BedspaceBoard) => void;
  onBoard: (board: BedspaceBoard) => void;
}) {
  const { data: allDorms = [], isLoading: dormsLoading } = useQuery<DormitoryRow[]>({
    queryKey: ['hotel-dormitories', propertyId],
    queryFn: async () => (await api.get('/hotel/dormitories', { params: { propertyId } })).data,
    enabled: Boolean(propertyId),
  });

  const dorms = categoryId ? allDorms.filter((d) => d.categoryId === categoryId) : allDorms;
  const activeId = dorms.some((d) => d.id === dormitoryId) ? dormitoryId : dorms[0]?.id ?? null;

  const { data: board, isFetching } = useQuery<BedspaceBoard>({
    queryKey: ['hotel-bedspaces', activeId, from, to],
    queryFn: async () => (await api.get('/hotel/dormitories/bedspaces', {
      params: { roomId: activeId, from, to },
    })).data,
    enabled: Boolean(activeId) && Boolean(from) && Boolean(to) && to > from,
  });

  // The parent needs the dormitory's identity and rate to price the stay and to
  // name the room on the reservation. It is told once per board rather than
  // during render, so the flow never re-renders itself in a loop.
  useEffect(() => { if (board) onBoard(board); }, [board]); // eslint-disable-line react-hooks/exhaustive-deps

  if (dormsLoading) {
    return <div className="hs-floor-canvas"><Skeleton rows={3} /></div>;
  }

  if (dorms.length === 0) {
    return (
      <div className="hs-floor-canvas">
        <EmptyState
          icon={BedDouble}
          title="No shared rooms at this property"
          body="A dormitory is a room whose type sleeps three or more. Add one from the Rooms screen, then set the room type's capacity to the number of beds."
        />
      </div>
    );
  }

  return (
    <>
      <div className="hs-floor-head">
        <div className="hs-dorm-title">
          <h2 className="ds-h3" style={{ margin: 0 }}>Dormitory – Bed Spaces</h2>
          <span className="ds-caption">Shared room · sold by the bed</span>
        </div>
        <DormitorySelector dorms={dorms} value={activeId} onChange={onDormitoryChange} />
      </div>

      <BedspaceStats board={board} loading={isFetching} />

      <div className="hs-floor-canvas">
        {!board ? <Skeleton rows={3} /> : (
          <BunkBedGrid bunks={board.bunks} selectedCode={selectedCode}
                       onSelect={(space) => onSelect(space, board)} />
        )}
      </div>

      <BedspaceLegend />
    </>
  );
}
