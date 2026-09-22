'use client';

/**
 * Captain floor — Figma 440:6212 / 616:1860 (dark), with the table-create modal
 * (440:7101) and the "Cancel this table?" confirm (453:7460).
 *
 * This is the one POS surface that is NOT a console page. It is a portrait
 * tablet held by a waiter crossing a room, so it drops the platform sidebar and
 * topbar entirely (the /travel precedent in the (app) layout) and pays for that
 * with big touch targets and a colour-first grid: the whole card is tinted, so
 * the room reads at arm's length without anyone parsing a label.
 *
 * The card counts TIME IN STATUS, which is what the frames show — "5 min" on a
 * blue card is five minutes into being cleaned, not five minutes into a meal.
 * `RstTable` has no timestamp for the last status change, so the clock falls
 * back to `updatedAt`; that is honest for a table whose last write WAS the
 * status change, and it is why the label says "in status" rather than "seated".
 *
 * The red badge in the corner of each occupied card is the cancel affordance —
 * it maps onto `cancelledAt` / `cancelledByUserId` / `cancellationReason` on
 * RstTable, which is why the confirm asks for a reason.
 */

import React, { useEffect, useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { ArrowLeft, Bell, Moon, Plus, Search, ShoppingCart, Sun, X } from 'lucide-react';
import { Card, Field, Modal, Skeleton, EmptyState } from '../ui/kit';
import { LoadFailed } from '../ui/load-state';
import { apiErrorMessage } from '@/lib/api';
import { seating } from '../restaurant-client';
import type { RstTableRow } from '../restaurant-client';
import {
  SELECTABLE_TABLE_STATUSES, formatDwell, minutesInStatus, tableStatus,
} from '../ui/table-status';
import { useAuth } from '@/features/foundation/auth/hooks/auth-context';

/** `RST_TABLE_SHAPES` — the create modal's Shape select. */
const SHAPES = ['square', 'rectangle', 'round', 'oval', 'l_shape', 'u_shape', 'booth', 'bar_stool'] as const;
const shapeLabel = (s: string) => s.replace(/_/g, '-').replace(/\b\w/g, (c) => c.toUpperCase());

/** Labels verbatim from the frame — it writes "Dine In", not "Dine-in". */
const SERVICE_TYPES = ['Dine In', 'Takeaway', 'Delivery'] as const;

export function CaptainFloor() {
  const router = useRouter();
  const qc = useQueryClient();
  const { user: currentUser } = useAuth();

  const [service, setService] = useState<string>('Dine In');
  const [term, setTerm] = useState('');
  // Every JUSTPOS frame is drawn light AND dark; the moon in the top bar is how
  // the frame switches. Local to this surface — it must not repaint the console.
  const [dark, setDark] = useState(false);
  const [creating, setCreating] = useState(false);
  const [cancelling, setCancelling] = useState<RstTableRow | null>(null);

  // The cards show a live clock, so the grid re-renders on its own minute tick
  // rather than only when data changes.
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 30_000);
    return () => clearInterval(id);
  }, []);

  const { data: tables = [], isLoading, error } = useQuery({
    queryKey: ['rst', 'tables'],
    queryFn: () => seating.tables(),
    // A floor view that is thirty seconds stale is misleading to someone
    // standing in the room deciding where to seat a party.
    refetchInterval: 30_000,
  });
  const { data: floors = [] } = useQuery({ queryKey: ['rst', 'floors'], queryFn: () => seating.floors() });
  const { data: zones = [] } = useQuery({ queryKey: ['rst', 'zones'], queryFn: () => seating.zones() });

  const shown = useMemo(() => {
    const q = term.trim().toLowerCase();
    return q ? tables.filter((t) => t.name.toLowerCase().includes(q)) : tables;
  }, [tables, term]);

  // Counts describe the WHOLE room, not the filtered view — a legend that
  // changed as you typed would stop being a picture of the floor.
  const counts = useMemo(() => {
    const c: Record<string, number> = {};
    for (const t of tables) {
      const k = tableStatus(t.status).label;
      c[k] = (c[k] ?? 0) + 1;
    }
    return c;
  }, [tables]);

  const createMutation = useMutation({
    mutationFn: (body: Record<string, unknown>) => seating.createTable(body),
    onSuccess: () => {
      toast.success('Table created');
      qc.invalidateQueries({ queryKey: ['rst', 'tables'] });
      setCreating(false);
    },
    onError: (e) => toast.error(apiErrorMessage(e)),
  });

  const cancelMutation = useMutation({
    mutationFn: ({ id, reason }: { id: string; reason: string }) =>
      seating.cancelTable(id, { cancellation_reason: reason }),
    onSuccess: () => {
      toast.success('Table cleared');
      qc.invalidateQueries({ queryKey: ['rst', 'tables'] });
      setCancelling(null);
    },
    onError: (e) => toast.error(apiErrorMessage(e)),
  });

  return (
    <div className={`rst rst-captain${dark ? ' rst-dark' : ''}`}>
      {/* Row 1 of the frame: back to the console, search, then the icon cluster.
          The frame's leftmost control is a grid glyph that returns to the
          console, so it is a real Back rather than decoration. The moon toggles
          the dark variant every JUSTPOS frame is drawn in. */}
      <header className="rst-captain-bar rst-captain-bar-top">
        <button className="rst-icon-btn" onClick={() => router.push('/restaurant/tables')} aria-label="Back to console">
          <ArrowLeft size={20} />
        </button>

        <label className="rst-search rst-search-lg">
          <Search size={17} aria-hidden />
          <input
            value={term}
            onChange={(e) => setTerm(e.target.value)}
            placeholder="Search"
            aria-label="Search tables"
          />
        </label>

        <button
          className="rst-icon-btn"
          onClick={() => setDark((d) => !d)}
          aria-label={dark ? 'Switch to light theme' : 'Switch to dark theme'}
          aria-pressed={dark}
        >
          {dark ? <Sun size={19} /> : <Moon size={19} />}
        </button>
        <button className="rst-icon-btn" aria-label="Notifications"><Bell size={19} /></button>
      </header>

      <header className="rst-captain-bar">
        <div className="rst-seg" role="tablist" aria-label="Service type">
          {SERVICE_TYPES.map((s) => (
            <button
              key={s}
              role="tab"
              aria-selected={service === s}
              className={`rst-seg-item${service === s ? ' is-on' : ''}`}
              onClick={() => setService(s)}
            >
              {s}
            </button>
          ))}
        </div>

        <div className="rst-legend" aria-hidden>
          {SELECTABLE_TABLE_STATUSES.map((s) => {
            const st = tableStatus(s);
            return (
              <span key={s} className="rst-legend-item">
                <i style={{ background: st.card, borderColor: st.fg }} />
                {st.label}
                {counts[st.label] ? <b>{counts[st.label]}</b> : null}
              </span>
            );
          })}
        </div>
      </header>

      {error ? (
        <Card pad={0}><LoadFailed what="the floor" /></Card>
      ) : isLoading ? (
        <div className="rst-captain-body"><Skeleton rows={6} height={92} /></div>
      ) : tables.length === 0 ? (
        <div className="rst-captain-body">
          <EmptyState
            icon={Plus}
            title="No tables on this floor yet"
            body="Add the first one and it will appear here immediately."
            actionLabel="Add table"
            onAction={() => setCreating(true)}
          />
        </div>
      ) : (
        <div className="rst-captain-body">
          <div className="rst-floor-grid">
            {shown.map((t) => {
              const s = tableStatus(t.status);
              const mins = minutesInStatus(t.updated_at, now);
              const occupied = (t.status ?? '').toLowerCase() === 'occupied';
              
              const isLocked = t.locked_until != null &&
                new Date(t.locked_until).getTime() > Date.now() &&
                t.locked_by_user_id !== currentUser?.id;

              return (
                <div key={t.id} className="rst-floor-cell" style={{ position: 'relative' }}>
                  <button
                    type="button"
                    className="rst-floor-card"
                    style={{ background: s.card }}
                    onClick={() => {
                      if (isLocked) {
                        toast.error('Table is currently being edited by another waiter');
                        return;
                      }
                      router.push(`/restaurant/captain/order?tableId=${t.id}`);
                    }}
                    aria-label={`Table ${t.name}, ${s.label}, ${formatDwell(mins)} in status`}
                  >
                    <span className="rst-floor-top">
                      <span className="rst-floor-dwell">{formatDwell(mins)}</span>
                      <span className="rst-floor-cap">Capacity: {t.capacity ?? '—'}</span>
                    </span>
                    <span className="rst-floor-name">{t.name}</span>
                    <span className="rst-floor-where">
                      {[t.zone?.name, t.floor?.name].filter(Boolean).join(' · ') || 'Unassigned'}
                    </span>
                  </button>
                  
                  {isLocked && (
                    <div style={{ position: 'absolute', top: 8, right: 8, color: 'var(--rst-warn)' }}>
                      🔒
                    </div>
                  )}

                  {occupied && (
                    <button
                      type="button"
                      className="rst-floor-cancel"
                      onClick={() => setCancelling(t)}
                      aria-label={`Clear table ${t.name}`}
                    >
                      <X size={13} strokeWidth={3} />
                    </button>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}

      <button className="rst-fab" onClick={() => setCreating(true)} aria-label="Add a table">
        <ShoppingCart size={22} />
      </button>

      {creating && (
        <TableFormModal
          floors={floors}
          zones={zones}
          busy={createMutation.isPending}
          onCancel={() => setCreating(false)}
          onCreate={(body) => createMutation.mutate(body)}
        />
      )}

      {cancelling && (
        <CancelTableModal
          table={cancelling}
          busy={cancelMutation.isPending}
          onClose={() => setCancelling(null)}
          onConfirm={(reason) => cancelMutation.mutate({ id: cancelling.id, reason })}
        />
      )}
    </div>
  );
}

/** Table Information — Figma 440:7101. */
function TableFormModal({
  floors, zones, busy, onCancel, onCreate,
}: {
  floors: { id: string; name: string; branch_id?: string | null }[];
  zones: { id: string; name: string; floor_id?: string | null }[];
  busy: boolean;
  onCancel: () => void;
  onCreate: (body: Record<string, unknown>) => void;
}) {
  const [name, setName] = useState('');
  const [shape, setShape] = useState<string>('square');
  const [zone, setZone] = useState('');
  const [capacity, setCapacity] = useState('4');
  const [floor, setFloor] = useState('');
  const [active, setActive] = useState(true);

  return (
    <Modal
      open
      onClose={onCancel}
      title="Table information"
      width={520}
      footer={
        <>
          <button className="btn-secondary btn-sm" onClick={onCancel} disabled={busy}>Cancel</button>
          <button
            className="btn-primary btn-sm"
            disabled={busy || !name.trim()}
            onClick={() =>
              onCreate(tableCreateBody({ name, shape, capacity, zone, floor, active, floors, zones }))
            }
          >
            {busy ? 'Creating…' : 'Create'}
          </button>
        </>
      }
    >
      <Field label="Table name" required>
        <input className="input" value={name} onChange={(e) => setName(e.target.value)} placeholder="T07" />
      </Field>
      <Field label="Shape">
        <select className="input" value={shape} onChange={(e) => setShape(e.target.value)}>
          {SHAPES.map((s) => <option key={s} value={s}>{shapeLabel(s)}</option>)}
        </select>
      </Field>
      <Field label="Zone">
        <select className="input" value={zone} onChange={(e) => setZone(e.target.value)}>
          <option value="">Unassigned</option>
          {zones.map((z) => <option key={z.id} value={z.id}>{z.name}</option>)}
        </select>
      </Field>
      <Field label="Capacity">
        <input className="input" value={capacity} inputMode="numeric" onChange={(e) => setCapacity(e.target.value)} />
      </Field>
      <Field label="Floor">
        <select className="input" value={floor} onChange={(e) => setFloor(e.target.value)}>
          <option value="">Unassigned</option>
          {floors.map((f) => <option key={f.id} value={f.id}>{f.name}</option>)}
        </select>
      </Field>
      <Field label="Active">
        <input type="checkbox" checked={active} onChange={(e) => setActive(e.target.checked)} />
      </Field>
    </Modal>
  );
}

/**
 * The body `POST /restaurant/seating-plan/tables` accepts. Its DTO is snake_case
 * and `forbidNonWhitelisted`, so the camelCase keys this form used to send
 * (`zoneId`, `floorId`, `isActive`) were a 422 and no table could be created
 * from the product. `shape_id` is the 1-based position in RST_TABLE_SHAPES,
 * which SHAPES mirrors; the API derives the shape name from it. The branch comes
 * from the chosen floor (or the chosen zone's floor), so the table belongs to
 * the same branch as the room it is placed in.
 */
export function tableCreateBody(input: {
  name: string; shape: string; capacity: string; zone: string; floor: string; active: boolean;
  floors: { id: string; branch_id?: string | null }[];
  zones: { id: string; floor_id?: string | null }[];
}) {
  const floorId = input.floor || input.zones.find((z) => z.id === input.zone)?.floor_id || null;
  const branchId = input.floors.find((f) => f.id === floorId)?.branch_id ?? null;
  return {
    name: input.name.trim(),
    shape_id: SHAPES.indexOf(input.shape as (typeof SHAPES)[number]) + 1,
    // `capacity` is a STRING column on RstTable, not an int.
    capacity: String(input.capacity),
    zone_id: input.zone || null,
    floor_id: floorId,
    branch_id: branchId,
    is_active: input.active,
    status: 'available',
  };
}

/** "Cancel this table?" — Figma 453:7460. */
function CancelTableModal({
  table, busy, onClose, onConfirm,
}: { table: RstTableRow; busy: boolean; onClose: () => void; onConfirm: (reason: string) => void }) {
  const [reason, setReason] = useState('');
  return (
    <Modal
      open
      onClose={onClose}
      title={`Clear ${table.name}?`}
      width={460}
      footer={
        <>
          <button className="btn-secondary btn-sm" onClick={onClose} disabled={busy}>Cancel</button>
          <button
            className="btn-danger btn-sm"
            disabled={busy || !reason.trim()}
            onClick={() => onConfirm(reason.trim())}
          >
            {busy ? 'Clearing…' : 'Submit'}
          </button>
        </>
      }
    >
      <Field
        label="Reason"
        hint="Stored against the table, so a cleared cover can be explained later."
        required
      >
        <input
          className="input"
          value={reason}
          onChange={(e) => setReason(e.target.value)}
          placeholder="Eg. Customer left suddenly. Clear all orders?"
        />
      </Field>
    </Modal>
  );
}
