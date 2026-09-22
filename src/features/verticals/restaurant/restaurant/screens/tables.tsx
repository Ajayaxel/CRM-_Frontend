'use client';

/**
 * JUSTPOS Tables — Figma 283:675 (light) / 283:1375 (dark),
 * with the table popover (283:1619) and the Merge Table modal (286:2093).
 *
 * The frame filters on Status, Floor and Zone and searches by name. Floors and
 * zones are real endpoints, so the two selects are populated rather than
 * hardcoded to the frame's "Floor: All / Zone: Indoor".
 *
 * Merging posts to /restaurant/seating-plan/merges. The modal in the frame asks
 * for a "Merge Type" and a table list; merge type is the API's `status`, whose
 * vocabulary is Capacity | Billing | Order | Closed (seating-rules.ts) and which
 * is REQUIRED on create — the frame's placeholder does not say that, so the
 * field is a real select here with the API's default preselected.
 */

import React, { useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { Armchair, Merge, Plus, Search, Users } from 'lucide-react';
import { RestaurantPage } from '../ui/page-shell';
import { Card, EmptyState, Field, Modal, Skeleton } from '../ui/kit';
import { LoadFailed } from '../ui/load-state';
import { apiErrorMessage } from '@/lib/api';
import { seating } from '../restaurant-client';
import type { RstTableRow } from '../restaurant-client';
import { SELECTABLE_TABLE_STATUSES, tableStatus } from '../ui/table-status';

/** `RST_MERGE_STATUSES` — required on create, defaulting to `Billing`. */
const MERGE_TYPES = ['Capacity', 'Billing', 'Order', 'Closed'] as const;
const MERGE_DEFAULT = 'Billing';

const ALL = 'ALL';

export function RestaurantTables() {
  const router = useRouter();
  const qc = useQueryClient();

  const [status, setStatus] = useState<string>(ALL);
  const [floorId, setFloorId] = useState<string>(ALL);
  const [zoneId, setZoneId] = useState<string>(ALL);
  const [term, setTerm] = useState('');
  const [selected, setSelected] = useState<RstTableRow | null>(null);
  const [merging, setMerging] = useState(false);

  const { data: tables = [], isLoading, error } = useQuery({
    queryKey: ['rst', 'tables'],
    queryFn: () => seating.tables(),
  });
  const { data: floors = [] } = useQuery({ queryKey: ['rst', 'floors'], queryFn: () => seating.floors() });
  const { data: zones = [] } = useQuery({ queryKey: ['rst', 'zones'], queryFn: () => seating.zones() });

  const shown = useMemo(() => {
    const q = term.trim().toLowerCase();
    return tables.filter((t) => {
      if (status !== ALL && (t.status ?? '').toLowerCase() !== status) return false;
      if (floorId !== ALL && t.floor_id !== floorId) return false;
      if (zoneId !== ALL && t.zone_id !== zoneId) return false;
      if (q && !t.name.toLowerCase().includes(q)) return false;
      return true;
    });
  }, [tables, status, floorId, zoneId, term]);

  const mergeMutation = useMutation({
    mutationFn: (body: { status: string; tables: string[] }) => seating.createMerge(body),
    onSuccess: () => {
      toast.success('Tables merged');
      qc.invalidateQueries({ queryKey: ['rst', 'tables'] });
      setMerging(false);
      setSelected(null);
    },
    onError: (e) => toast.error(apiErrorMessage(e)),
  });

  return (
    <RestaurantPage
      title="Tables"
      subtitle="Every table in the room, and what it is doing right now."
      actions={
        <button className="btn-secondary btn-sm" onClick={() => router.push('/restaurant/captain')}>
          <Armchair size={14} /> Open floor view
        </button>
      }
    >
      <Card pad={14}>
        <div className="rst-filters">
          <label className="rst-search">
            <Search size={15} aria-hidden />
            <input
              value={term}
              onChange={(e) => setTerm(e.target.value)}
              placeholder="Search tables"
              aria-label="Search tables by name"
            />
          </label>

          <select value={status} onChange={(e) => setStatus(e.target.value)} aria-label="Filter by status">
            <option value={ALL}>Status: All</option>
            {SELECTABLE_TABLE_STATUSES.map((s) => (
              <option key={s} value={s}>{tableStatus(s).label}</option>
            ))}
          </select>

          <select value={floorId} onChange={(e) => setFloorId(e.target.value)} aria-label="Filter by floor">
            <option value={ALL}>Floor: All</option>
            {floors.map((f) => <option key={f.id} value={f.id}>{f.name}</option>)}
          </select>

          <select value={zoneId} onChange={(e) => setZoneId(e.target.value)} aria-label="Filter by zone">
            <option value={ALL}>Zone: All</option>
            {zones.map((z) => <option key={z.id} value={z.id}>{z.name}</option>)}
          </select>

          <span className="ds-caption rst-filter-count">
            {isLoading ? '' : `${shown.length} of ${tables.length}`}
          </span>
        </div>
      </Card>

      {error ? (
        <Card pad={0}><LoadFailed what="the floor" /></Card>
      ) : isLoading ? (
        <Skeleton rows={4} height={96} />
      ) : shown.length === 0 ? (
        <Card pad={0}>
          <EmptyState
            icon={Armchair}
            title={tables.length ? 'No tables match these filters' : 'No tables yet'}
            body={tables.length
              ? 'Clear a filter to see the rest of the room.'
              : 'Add tables under Settings → Table & room configuration.'}
          />
        </Card>
      ) : (
        <div className="rst-table-grid">
          {shown.map((t) => {
            const s = tableStatus(t.status);
            return (
              <button
                key={t.id}
                type="button"
                className="rst-table-card"
                onClick={() => setSelected(t)}
                aria-label={`Table ${t.name}, ${s.label}`}
              >
                <div className="rst-table-card-top">
                  <span className="rst-table-name">{t.name}</span>
                  <span className="rst-table-status" style={{ color: s.fg }}>{s.label}</span>
                </div>
                <div className="rst-table-meta">
                  <span><Users size={13} aria-hidden /> Capacity: {t.capacity ?? '—'}</span>
                  <span>
                    {[t.zone?.name, t.floor?.name].filter(Boolean).join(' · ') || 'Unassigned'}
                  </span>
                </div>
              </button>
            );
          })}
        </div>
      )}

      {/* Table popover — Figma 283:1619. Merge Table / Create Order. */}
      {selected && !merging && (
        <Modal
          open
          onClose={() => setSelected(null)}
          title={selected.name}
          footer={
            <>
              <button className="btn-secondary btn-sm" onClick={() => setMerging(true)}>
                <Merge size={14} /> Merge table
              </button>
              <button
                className="btn-primary btn-sm"
                onClick={() => router.push(`/restaurant/order?tableId=${selected.id}`)}
              >
                <Plus size={14} /> Create order
              </button>
            </>
          }
        >
          <div className="rst-popover-grid">
            <div><span className="ds-caption">Capacity</span><strong>{selected.capacity ?? '—'}</strong></div>
            <div><span className="ds-caption">Floor</span><strong>{selected.floor?.name ?? '—'}</strong></div>
            <div><span className="ds-caption">Zone</span><strong>{selected.zone?.name ?? '—'}</strong></div>
            <div>
              <span className="ds-caption">Status</span>
              <strong style={{ color: tableStatus(selected.status).fg }}>
                {tableStatus(selected.status).label}
              </strong>
            </div>
          </div>
        </Modal>
      )}

      {/* Merge Table — Figma 286:2093. */}
      {selected && merging && (
        <MergeTableModal
          anchor={selected}
          tables={tables}
          busy={mergeMutation.isPending}
          onCancel={() => setMerging(false)}
          onMerge={(type, ids) => mergeMutation.mutate({ status: type, tables: ids })}
        />
      )}
    </RestaurantPage>
  );
}

function MergeTableModal({
  anchor, tables, busy, onCancel, onMerge,
}: {
  anchor: RstTableRow;
  tables: RstTableRow[];
  busy: boolean;
  onCancel: () => void;
  onMerge: (type: string, tableIds: string[]) => void;
}) {
  const [type, setType] = useState<string>(MERGE_DEFAULT);
  const [picked, setPicked] = useState<string[]>([]);

  // The merge takes its branch from the FIRST table in the list, so the table
  // the user opened must lead it — see seating-rules.ts.
  const ids = [anchor.id, ...picked];
  const others = tables.filter((t) => t.id !== anchor.id);

  return (
    <Modal
      open
      onClose={onCancel}
      title="Merge table"
      footer={
        <>
          <button className="btn-secondary btn-sm" onClick={onCancel} disabled={busy}>Cancel</button>
          <button
            className="btn-primary btn-sm"
            disabled={busy || picked.length === 0}
            onClick={() => onMerge(type, ids)}
          >
            {busy ? 'Merging…' : `Merge ${ids.length} tables`}
          </button>
        </>
      }
    >
      <Field label="Merge type">
        <select value={type} onChange={(e) => setType(e.target.value)}>
          {MERGE_TYPES.map((m) => <option key={m} value={m}>{m}</option>)}
        </select>
      </Field>

      <Field label={`Tables to merge into ${anchor.name}`}>
        <div className="rst-merge-picker">
          {others.length === 0 && <p className="ds-caption">There is no other table to merge with.</p>}
          {others.map((t) => {
            const on = picked.includes(t.id);
            return (
              <label key={t.id} className={`rst-merge-option${on ? ' is-on' : ''}`}>
                <input
                  type="checkbox"
                  checked={on}
                  onChange={() =>
                    setPicked((p) => (on ? p.filter((x) => x !== t.id) : [...p, t.id]))
                  }
                />
                <span>{t.name}</span>
                <span className="ds-caption">{t.floor?.name ?? '—'}</span>
              </label>
            );
          })}
        </div>
      </Field>
    </Modal>
  );
}
