'use client';

/**
 * Filters and saved views (spec §23).
 *
 * Filters are compact chips rather than a row of dropdowns, so the current
 * question the table is answering stays readable at a glance: "Status is In
 * progress · Assignee is Athul · Due before 20 Aug". Views are named
 * combinations of those chips, persisted per user in localStorage — the server
 * has no opinion about them, which keeps the feature free of a migration.
 */

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Bookmark, ListFilter, Plus, Trash2, X } from 'lucide-react';
import { Menu, OptionList, Popover, humanize, type Opt } from './primitives';
import { Avatar } from './primitives';

export type FilterType = 'enum' | 'person' | 'date' | 'text' | 'toggle';
export type FilterOp = 'is' | 'is_not' | 'before' | 'after' | 'contains' | 'on';

export interface FilterDef {
  key: string;
  label: string;
  type: FilterType;
  options?: Opt[];
  /** Maps this filter onto the API query. */
  toQuery?: (f: ActiveFilter) => Record<string, unknown>;
}

export interface ActiveFilter {
  key: string;
  op: FilterOp;
  values: string[];
}

export interface SavedView {
  id: string;
  name: string;
  filters: ActiveFilter[];
  builtIn?: boolean;
}

const OPS_FOR: Record<FilterType, FilterOp[]> = {
  enum: ['is', 'is_not'],
  person: ['is', 'is_not'],
  date: ['before', 'after', 'on'],
  text: ['contains'],
  toggle: ['is'],
};

const OP_LABEL: Record<FilterOp, string> = {
  is: 'is',
  is_not: 'is not',
  before: 'before',
  after: 'after',
  on: 'on',
  contains: 'contains',
};

/** Turn the chip list into the API's flat query params. */
export function filtersToQuery(defs: FilterDef[], filters: ActiveFilter[]): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const f of filters) {
    const def = defs.find((d) => d.key === f.key);
    if (!def || !f.values.length) continue;
    if (def.toQuery) {
      Object.assign(out, def.toQuery(f));
      continue;
    }
    // Default mapping: `is` becomes a comma list the API already understands.
    if (f.op === 'is') out[f.key] = f.values.join(',');
  }
  return out;
}

/** Client-side pass for filters the API cannot express (mostly `is not`). */
export function applyClientFilters<T extends Record<string, any>>(
  rows: T[],
  defs: FilterDef[],
  filters: ActiveFilter[],
  read: (row: T, key: string) => unknown,
): T[] {
  const local = filters.filter((f) => f.op === 'is_not' || f.op === 'before' || f.op === 'after' || f.op === 'on');
  if (!local.length) return rows;
  return rows.filter((row) =>
    local.every((f) => {
      const v = read(row, f.key);
      if (f.op === 'is_not') return !f.values.includes(String(v ?? ''));
      const d = v ? new Date(v as string).setHours(0, 0, 0, 0) : null;
      const target = new Date(f.values[0]).setHours(0, 0, 0, 0);
      if (d == null) return false;
      if (f.op === 'before') return d < target;
      if (f.op === 'after') return d > target;
      return d === target;
    }),
  );
}

function labelFor(def: FilterDef, f: ActiveFilter): string {
  if (def.type === 'date') return new Date(f.values[0]).toLocaleDateString(undefined, { day: 'numeric', month: 'short' });
  if (def.type === 'toggle') return 'yes';
  const names = f.values.map((v) => def.options?.find((o) => o.value === v)?.label ?? humanize(v));
  return names.length <= 2 ? names.join(', ') : `${names.length} selected`;
}

export function FilterBar({
  defs, filters, onChange, right,
}: {
  defs: FilterDef[];
  filters: ActiveFilter[];
  onChange: (next: ActiveFilter[]) => void;
  right?: React.ReactNode;
}) {
  const set = (key: string, patch: Partial<ActiveFilter>) =>
    onChange(filters.map((f) => (f.key === key ? { ...f, ...patch } : f)));

  const remove = (key: string) => onChange(filters.filter((f) => f.key !== key));

  const add = (key: string) => {
    const def = defs.find((d) => d.key === key);
    if (!def || filters.some((f) => f.key === key)) return;
    onChange([...filters, { key, op: OPS_FOR[def.type][0], values: def.type === 'toggle' ? ['true'] : [] }]);
  };

  const unused = defs.filter((d) => !filters.some((f) => f.key === d.key));

  return (
    <div className="cw-filterbar">
      {filters.map((f) => {
        const def = defs.find((d) => d.key === f.key);
        if (!def) return null;
        return (
          <span key={f.key} className="cw-filter-chip">
            <span className="cw-filter-chip-key" style={{ padding: '0 6px 0 8px' }}>{def.label}</span>

            {OPS_FOR[def.type].length > 1 ? (
              <Menu
                width={150}
                align="start"
                trigger={({ ref, onClick }) => (
                  <button type="button" ref={ref as any} onClick={onClick} style={{ color: 'var(--cw-ink-3)' }}>
                    {OP_LABEL[f.op]}
                  </button>
                )}
                items={OPS_FOR[def.type].map((op) => ({ label: OP_LABEL[op], onSelect: () => set(f.key, { op }) }))}
              />
            ) : (
              <span className="cw-filter-chip-key" style={{ paddingRight: 6 }}>{OP_LABEL[f.op]}</span>
            )}

            {def.type === 'date' ? (
              <Popover
                width={220}
                trigger={({ ref, onClick }) => (
                  <button type="button" ref={ref as any} onClick={onClick} className="cw-filter-chip-val">
                    {f.values.length ? labelFor(def, f) : 'pick a date'}
                  </button>
                )}
              >
                {({ close }) => (
                  <div style={{ padding: 10 }}>
                    <input
                      type="date"
                      autoFocus
                      className="cw-input"
                      defaultValue={f.values[0] ?? ''}
                      onChange={(e) => { set(f.key, { values: e.target.value ? [e.target.value] : [] }); close(); }}
                    />
                  </div>
                )}
              </Popover>
            ) : def.type === 'toggle' ? (
              <span className="cw-filter-chip-val" style={{ padding: '0 8px 0 0' }}>yes</span>
            ) : (
              <Popover
                width={def.type === 'person' ? 260 : 220}
                trigger={({ ref, onClick }) => (
                  <button type="button" ref={ref as any} onClick={onClick} className="cw-filter-chip-val">
                    {f.values.length ? labelFor(def, f) : 'any'}
                  </button>
                )}
              >
                {() => (
                  <OptionList
                    searchable={(def.options?.length ?? 0) > 8}
                    options={def.options ?? []}
                    values={f.values}
                    onPick={(v) =>
                      set(f.key, { values: f.values.includes(v) ? f.values.filter((x) => x !== v) : [...f.values, v] })
                    }
                  />
                )}
              </Popover>
            )}

            <button type="button" className="cw-filter-chip-x" aria-label={`Remove ${def.label} filter`} onClick={() => remove(f.key)}>
              <X size={11} />
            </button>
          </span>
        );
      })}

      {unused.length > 0 && (
        <Popover
          width={220}
          trigger={({ ref, onClick }) => (
            <button type="button" ref={ref as any} className="cw-btn cw-btn-ghost" onClick={onClick}>
              <ListFilter size={13} /> {filters.length ? 'Filter' : 'Add filter'}
            </button>
          )}
        >
          {({ close }) => (
            <OptionList
              searchable={unused.length > 8}
              options={unused.map((d) => ({ value: d.key, label: d.label }))}
              onPick={(v) => { add(v); close(); }}
            />
          )}
        </Popover>
      )}

      {filters.length > 0 && (
        <button type="button" className="cw-btn cw-btn-ghost" onClick={() => onChange([])}>Clear</button>
      )}

      <span style={{ flex: 1 }} />
      {right}
    </div>
  );
}

// ============================================================ Saved views

const VIEW_KEY = 'bmn.cw.views.';

export function useSavedViews(scope: string, builtIn: SavedView[]) {
  const [custom, setCustom] = useState<SavedView[]>([]);

  useEffect(() => {
    try {
      const raw = window.localStorage.getItem(VIEW_KEY + scope);
      if (raw) setCustom(JSON.parse(raw));
    } catch { /* storage disabled */ }
  }, [scope]);

  const persist = useCallback((next: SavedView[]) => {
    setCustom(next);
    try { window.localStorage.setItem(VIEW_KEY + scope, JSON.stringify(next)); } catch { /* noop */ }
  }, [scope]);

  const save = useCallback((name: string, filters: ActiveFilter[]) => {
    const view: SavedView = { id: `v${Date.now()}`, name, filters };
    persist([...custom, view]);
    return view;
  }, [custom, persist]);

  const remove = useCallback((id: string) => persist(custom.filter((v) => v.id !== id)), [custom, persist]);

  const views = useMemo(() => [...builtIn.map((v) => ({ ...v, builtIn: true })), ...custom], [builtIn, custom]);

  return { views, save, remove };
}

export function ViewTabs({
  views, activeId, onSelect, onSave, onDelete, dirty,
}: {
  views: SavedView[];
  activeId: string;
  onSelect: (v: SavedView) => void;
  onSave: (name: string) => void;
  onDelete: (id: string) => void;
  dirty: boolean;
}) {
  const [naming, setNaming] = useState(false);
  const [name, setName] = useState('');

  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 2, overflowX: 'auto' }}>
      {views.map((v) => (
        <span key={v.id} style={{ display: 'inline-flex', alignItems: 'center' }}>
          <button
            type="button"
            className="cw-tab"
            data-active={v.id === activeId}
            onClick={() => onSelect(v)}
            style={{ height: 30 }}
          >
            {v.name}
          </button>
          {!v.builtIn && v.id === activeId && (
            <button
              type="button"
              className="cw-icon-btn"
              style={{ width: 22, height: 22 }}
              aria-label={`Delete view ${v.name}`}
              onClick={() => onDelete(v.id)}
            ><Trash2 size={11} /></button>
          )}
        </span>
      ))}

      {dirty && (
        naming ? (
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5, marginLeft: 6 }}>
            <input
              autoFocus
              className="cw-input"
              style={{ width: 150, height: 25 }}
              placeholder="View name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && name.trim()) { onSave(name.trim()); setName(''); setNaming(false); }
                if (e.key === 'Escape') setNaming(false);
              }}
            />
            <button className="cw-btn" onClick={() => { if (name.trim()) { onSave(name.trim()); setName(''); setNaming(false); } }}>Save</button>
          </span>
        ) : (
          <button type="button" className="cw-btn cw-btn-ghost" style={{ marginLeft: 6 }} onClick={() => setNaming(true)}>
            <Bookmark size={12} /> Save view
          </button>
        )
      )}
    </div>
  );
}

/** People options carrying avatars and current load, shared by every people filter. */
export function personOptions(people: { id: string; name: string; role?: string | null; activeTasks?: number }[]): Opt[] {
  return people.map((p) => ({
    value: p.id,
    label: p.name,
    hint: p.activeTasks != null ? `${p.activeTasks} active` : (p.role ?? undefined),
    icon: <Avatar name={p.name} size={18} />,
  }));
}
