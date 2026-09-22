'use client';

/**
 * The workspace table.
 *
 * This is the primary interface, so it carries real table affordances rather
 * than being a styled list: sticky header, sticky first column, sortable
 * headers, drag-to-resize, drag-to-reorder, show/hide columns, and row
 * selection. Layout preferences persist per table id in localStorage — a
 * manager who hides four columns should not have to hide them again tomorrow.
 */

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ArrowDown, ArrowUp, Check, Columns3, GripVertical, RotateCcw } from 'lucide-react';
import { Popover } from './primitives';
import { Loading } from './states';
import { useListCursor } from './keyboard';

export interface Column<T> {
  key: string;
  header: string;
  width?: number;
  minWidth?: number;
  align?: 'left' | 'right';
  sortable?: boolean;
  /** Value used for client-side sorting when the column renders custom markup. */
  sortValue?: (row: T) => string | number | Date | null | undefined;
  render: (row: T) => React.ReactNode;
  /** Columns the user may not hide (the identity column). */
  locked?: boolean;
  defaultHidden?: boolean;
}

interface Layout {
  order: string[];
  hidden: string[];
  widths: Record<string, number>;
}

type Sort = { key: string; dir: 'asc' | 'desc' } | null;

const STORE_PREFIX = 'bmn.cw.table.';

function loadLayout(id: string): Partial<Layout> | null {
  if (typeof window === 'undefined') return null;
  try {
    const raw = window.localStorage.getItem(STORE_PREFIX + id);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

function saveLayout(id: string, layout: Layout) {
  try {
    window.localStorage.setItem(STORE_PREFIX + id, JSON.stringify(layout));
  } catch {
    /* storage disabled — the table still works, it just forgets */
  }
}

export function useTableLayout<T>(id: string, columns: Column<T>[]) {
  const defaults = useMemo<Layout>(() => ({
    order: columns.map((c) => c.key),
    hidden: columns.filter((c) => c.defaultHidden).map((c) => c.key),
    widths: Object.fromEntries(columns.filter((c) => c.width).map((c) => [c.key, c.width!])),
  }), [columns]);

  const [layout, setLayout] = useState<Layout>(defaults);
  const [hydrated, setHydrated] = useState(false);

  // Read stored preferences after mount so server and first client render match.
  useEffect(() => {
    const stored = loadLayout(id);
    if (stored) {
      const known = new Set(columns.map((c) => c.key));
      const order = [
        ...(stored.order ?? []).filter((k) => known.has(k)),
        ...columns.map((c) => c.key).filter((k) => !(stored.order ?? []).includes(k)),
      ];
      setLayout({
        order,
        hidden: (stored.hidden ?? []).filter((k) => known.has(k)),
        widths: { ...defaults.widths, ...(stored.widths ?? {}) },
      });
    }
    setHydrated(true);
  }, [id]); // eslint-disable-line react-hooks/exhaustive-deps

  const update = useCallback((next: Layout) => {
    setLayout(next);
    saveLayout(id, next);
  }, [id]);

  const reset = useCallback(() => {
    setLayout(defaults);
    try { window.localStorage.removeItem(STORE_PREFIX + id); } catch { /* noop */ }
  }, [defaults, id]);

  return { layout, update, reset, hydrated };
}

export function Table<T>({
  id,
  rows,
  columns,
  rowKey,
  onRowClick,
  loading,
  empty,
  selectable,
  selected = [],
  onSelectedChange,
  activeRowKey,
  stickyFirst = true,
  toolbarSlot,
  keyboardNav = true,
}: {
  id: string;
  rows: T[];
  columns: Column<T>[];
  rowKey: (row: T) => string;
  onRowClick?: (row: T) => void;
  loading?: boolean;
  empty?: React.ReactNode;
  selectable?: boolean;
  selected?: string[];
  onSelectedChange?: (next: string[]) => void;
  activeRowKey?: string | null;
  stickyFirst?: boolean;
  /** Rendered to the left of the column menu, e.g. a row count. */
  toolbarSlot?: React.ReactNode;
  /** j/k + Enter navigation. Off for tables that are not the page's focus. */
  keyboardNav?: boolean;
}) {
  const { layout, update, reset } = useTableLayout(id, columns);
  const [sort, setSort] = useState<Sort>(null);
  const [dragKey, setDragKey] = useState<string | null>(null);
  const [dropKey, setDropKey] = useState<string | null>(null);
  const resizing = useRef<{ key: string; startX: number; startW: number } | null>(null);

  const byKey = useMemo(() => new Map(columns.map((c) => [c.key, c])), [columns]);
  const visible = useMemo(
    () => layout.order.map((k) => byKey.get(k)).filter((c): c is Column<T> => Boolean(c) && !layout.hidden.includes(c!.key)),
    [layout, byKey],
  );

  // Sorting is client-side over the current page: the server already ordered
  // the result set, and re-fetching on every header click makes a table feel
  // sluggish for what is usually a 50-row page.
  const sorted = useMemo(() => {
    if (!sort) return rows;
    const col = byKey.get(sort.key);
    if (!col) return rows;
    const get = col.sortValue ?? ((r: T) => (r as any)?.[sort.key]);
    const dir = sort.dir === 'asc' ? 1 : -1;
    return [...rows].sort((a, b) => compare(get(a), get(b)) * dir);
  }, [rows, sort, byKey]);

  // Roving keyboard cursor over the *sorted* rows, so j/k follows what is on
  // screen rather than the order the server sent.
  const { index: cursorIndex, setIndex: setCursorIndex } = useListCursor({
    items: sorted,
    enabled: Boolean(keyboardNav && onRowClick && !loading),
    onOpen: (row) => onRowClick?.(row),
    onToggleSelect: (row) => {
      if (!selectable || !onSelectedChange) return;
      const key = rowKey(row);
      onSelectedChange(selected.includes(key) ? selected.filter((k) => k !== key) : [...selected, key]);
    },
  });

  const cycleSort = (key: string) =>
    setSort((s) => (!s || s.key !== key ? { key, dir: 'asc' } : s.dir === 'asc' ? { key, dir: 'desc' } : null));

  useEffect(() => {
    const onMove = (e: MouseEvent) => {
      if (!resizing.current) return;
      const { key, startX, startW } = resizing.current;
      const min = byKey.get(key)?.minWidth ?? 70;
      const w = Math.max(min, startW + (e.clientX - startX));
      update({ ...layout, widths: { ...layout.widths, [key]: w } });
    };
    const onUp = () => { resizing.current = null; document.body.style.cursor = ''; };
    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup', onUp);
    return () => { window.removeEventListener('mousemove', onMove); window.removeEventListener('mouseup', onUp); };
  }, [layout, update, byKey]);

  const toggleHidden = (key: string) => {
    const hidden = layout.hidden.includes(key) ? layout.hidden.filter((k) => k !== key) : [...layout.hidden, key];
    update({ ...layout, hidden });
  };

  const reorder = (from: string, to: string) => {
    if (from === to) return;
    const order = layout.order.filter((k) => k !== from);
    order.splice(order.indexOf(to), 0, from);
    update({ ...layout, order });
  };

  const allSelected = selectable && rows.length > 0 && selected.length === rows.length;

  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, minHeight: 30 }}>
        {toolbarSlot}
        <span style={{ flex: 1 }} />
        <Popover
          align="end"
          width={236}
          trigger={({ ref, onClick }) => (
            <button type="button" ref={ref as any} className="cw-btn cw-btn-ghost" onClick={onClick}>
              <Columns3 size={13} /> Columns
            </button>
          )}
        >
          <div className="cw-pop-list">
            <div className="cw-pop-label">Visible columns</div>
            {layout.order.map((k) => {
              const c = byKey.get(k);
              if (!c) return null;
              const on = !layout.hidden.includes(k);
              return (
                <button
                  key={k}
                  type="button"
                  className="cw-opt"
                  disabled={c.locked}
                  onClick={() => !c.locked && toggleHidden(k)}
                  style={c.locked ? { opacity: 0.5, cursor: 'default' } : undefined}
                >
                  <span style={{ width: 14, display: 'inline-flex' }}>{on && <Check size={13} style={{ color: 'var(--cw-accent)' }} />}</span>
                  <span style={{ flex: 1 }}>{c.header}</span>
                </button>
              );
            })}
            <div className="cw-pop-sep" />
            <button type="button" className="cw-opt" onClick={reset}>
              <RotateCcw size={13} style={{ color: 'var(--cw-ink-3)' }} />
              <span>Reset layout</span>
            </button>
          </div>
        </Popover>
      </div>

      <div className={`cw-table-wrap ${stickyFirst ? 'cw-table-sticky-first' : ''}`}>
        <table className="cw-table cw-table-responsive" role="table">
          <colgroup>
            {selectable && <col style={{ width: 34 }} />}
            {visible.map((c) => <col key={c.key} style={{ width: layout.widths[c.key] ?? c.width }} />)}
          </colgroup>
          <thead>
            <tr>
              {selectable && (
                <th>
                  <input
                    type="checkbox"
                    aria-label="Select all"
                    checked={Boolean(allSelected)}
                    onChange={(e) => onSelectedChange?.(e.target.checked ? rows.map(rowKey) : [])}
                    style={{ width: 13, height: 13, accentColor: 'var(--cw-accent)' }}
                  />
                </th>
              )}
              {visible.map((c) => {
                const isSorted = sort?.key === c.key;
                return (
                  <th
                    role="columnheader"
                    key={c.key}
                    data-num={c.align === 'right'}
                    style={{ position: 'relative', opacity: dragKey === c.key ? 0.4 : 1, background: dropKey === c.key ? 'var(--cw-hover)' : undefined }}
                    aria-sort={isSorted ? (sort!.dir === 'asc' ? 'ascending' : 'descending') : undefined}
                    draggable={!c.locked}
                    onDragStart={() => setDragKey(c.key)}
                    onDragOver={(e) => { if (dragKey && dragKey !== c.key) { e.preventDefault(); setDropKey(c.key); } }}
                    onDragLeave={() => setDropKey((k) => (k === c.key ? null : k))}
                    onDrop={(e) => { e.preventDefault(); if (dragKey) reorder(dragKey, c.key); setDragKey(null); setDropKey(null); }}
                    onDragEnd={() => { setDragKey(null); setDropKey(null); }}
                  >
                    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, maxWidth: '100%' }}>
                      {!c.locked && (
                        <GripVertical size={11} style={{ color: 'var(--cw-ink-4)', opacity: 0.55, cursor: 'grab', flex: 'none' }} />
                      )}
                      {c.sortable !== false ? (
                        <button type="button" className="cw-th-btn" onClick={() => cycleSort(c.key)}>
                          <span className="cw-truncate">{c.header}</span>
                          {isSorted && (sort!.dir === 'asc' ? <ArrowUp size={11} /> : <ArrowDown size={11} />)}
                        </button>
                      ) : <span className="cw-truncate">{c.header}</span>}
                    </span>
                    <span
                      role="separator"
                      aria-orientation="vertical"
                      onMouseDown={(e) => {
                        e.preventDefault();
                        const th = (e.currentTarget.parentElement as HTMLElement);
                        resizing.current = { key: c.key, startX: e.clientX, startW: th.offsetWidth };
                        document.body.style.cursor = 'col-resize';
                      }}
                      style={{
                        position: 'absolute', top: 0, right: -3, width: 7, height: '100%',
                        cursor: 'col-resize', zIndex: 1,
                      }}
                    />
                  </th>
                );
              })}
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr>
                <td colSpan={visible.length + (selectable ? 1 : 0)} style={{ height: 'auto', padding: 0, borderBottom: 0 }}>
                  <Loading kind="table" rows={6} />
                </td>
              </tr>
            ) : sorted.length === 0 ? (
              <tr>
                <td colSpan={visible.length + (selectable ? 1 : 0)} style={{ height: 'auto', borderBottom: 0 }}>
                  {empty ?? <div className="cw-empty"><div className="cw-empty-title">Nothing here yet</div></div>}
                </td>
              </tr>
            ) : (
              sorted.map((row, rowIndex) => {
                const key = rowKey(row);
                const isSelected = selected.includes(key) || activeRowKey === key;
                return (
                  <tr
                    role="row"
                    key={key}
                    ref={(el) => { if (rowIndex === cursorIndex && el) el.scrollIntoView({ block: 'nearest' }); }}
                    data-selected={isSelected}
                    data-cursor={rowIndex === cursorIndex}
                    data-clickable={Boolean(onRowClick)}
                    onMouseEnter={() => keyboardNav && setCursorIndex(rowIndex)}
                    onClick={onRowClick ? () => onRowClick(row) : undefined}
                    onKeyDown={onRowClick ? (e) => { if (e.key === 'Enter') onRowClick(row); } : undefined}
                    tabIndex={onRowClick ? 0 : undefined}
                  >
                    {selectable && (
                      <td className="cw-col-select" role="cell" onClick={(e) => e.stopPropagation()}>
                        <input
                          type="checkbox"
                          aria-label={`Select row ${key}`}
                          checked={selected.includes(key)}
                          onChange={(e) =>
                            onSelectedChange?.(e.target.checked ? [...selected, key] : selected.filter((k) => k !== key))
                          }
                          style={{ width: 13, height: 13, accentColor: 'var(--cw-accent)' }}
                        />
                      </td>
                    )}
                    {visible.map((c, ci) => (
                      <td
                        key={c.key}
                        role="cell"
                        className={ci === 0 ? 'cw-col-identity' : undefined}
                        data-num={c.align === 'right'}
                        data-label={c.header}
                      >{c.render(row)}</td>
                    ))}
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function compare(a: unknown, b: unknown): number {
  const aEmpty = a == null || a === '';
  const bEmpty = b == null || b === '';
  if (aEmpty && bEmpty) return 0;
  if (aEmpty) return 1;
  if (bEmpty) return -1;
  if (a instanceof Date && b instanceof Date) return a.getTime() - b.getTime();
  if (typeof a === 'number' && typeof b === 'number') return a - b;
  const as = String(a);
  const bs = String(b);
  const an = Number(as);
  const bn = Number(bs);
  if (Number.isFinite(an) && Number.isFinite(bn)) return an - bn;
  if (/^\d{4}-\d{2}-\d{2}/.test(as) && /^\d{4}-\d{2}-\d{2}/.test(bs)) return Date.parse(as) - Date.parse(bs);
  return as.localeCompare(bs, undefined, { numeric: true, sensitivity: 'base' });
}
