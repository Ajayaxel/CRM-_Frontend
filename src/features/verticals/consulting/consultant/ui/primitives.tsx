'use client';

/**
 * Consultant workspace primitives.
 *
 * Small, unstyled-by-default building blocks that all share one popover engine.
 * Everything visual lives in workspace.css under `.cw`, so these components stay
 * readable and nothing here can affect another vertical's surfaces.
 */

import React, {
  createContext, useCallback, useContext, useEffect, useLayoutEffect,
  useMemo, useRef, useState,
} from 'react';
import { createPortal } from 'react-dom';
import { Check, ChevronRight, Search } from 'lucide-react';

// ============================================================ Tones

export type Tone = 'green' | 'amber' | 'red' | 'blue' | 'violet' | 'slate';

export const TONE_VAR: Record<Tone, string> = {
  green: 'var(--cw-green)',
  amber: 'var(--cw-amber)',
  red: 'var(--cw-red)',
  blue: 'var(--cw-blue)',
  violet: 'var(--cw-violet)',
  slate: 'var(--cw-slate)',
};

/**
 * Enum keys that must not be sentence-cased — "UAT" reading as "Uat" is the
 * kind of detail that makes an interface feel machine-generated.
 */
const ACRONYMS = new Set(['UAT', 'QA', 'API', 'SOP', 'PM', 'UI', 'UX', 'CI', 'CD', 'DNS', 'SSL', 'MVP', 'ERP', 'CRM', 'POS', 'SHA']);

/** "IN_PROGRESS" → "In progress"; "UAT" → "UAT"; "READY_FOR_RELEASE" → "Ready for release". */
export function humanize(v?: string | null): string {
  if (!v) return '';
  const words = v.split('_');
  return words
    .map((w, i) => {
      if (ACRONYMS.has(w.toUpperCase())) return w.toUpperCase();
      const lower = w.toLowerCase();
      return i === 0 ? lower.charAt(0).toUpperCase() + lower.slice(1) : lower;
    })
    .join(' ');
}

// ============================================================ Popover engine

interface PopoverCtx {
  close: () => void;
}
const PopCtx = createContext<PopoverCtx>({ close: () => {} });
export const usePopover = () => useContext(PopCtx);

/**
 * Anchored popover.
 *
 * Rendered in a portal and positioned against the trigger's rect, so a popover
 * opened from inside a horizontally-scrolling table is never clipped by it —
 * which is the failure mode of absolutely-positioned dropdowns in dense grids.
 */
export function Popover({
  trigger, children, align = 'start', width, onOpenChange, disabled,
}: {
  trigger: (props: { open: boolean; ref: React.Ref<any>; onClick: (e: React.MouseEvent) => void }) => React.ReactNode;
  children: React.ReactNode | ((ctx: PopoverCtx) => React.ReactNode);
  align?: 'start' | 'end';
  width?: number;
  onOpenChange?: (open: boolean) => void;
  disabled?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const anchorRef = useRef<HTMLElement | null>(null);
  const popRef = useRef<HTMLDivElement | null>(null);
  const [pos, setPos] = useState<{ top: number; left: number; width: number } | null>(null);

  const set = useCallback((v: boolean) => { setOpen(v); onOpenChange?.(v); }, [onOpenChange]);
  const close = useCallback(() => set(false), [set]);

  useLayoutEffect(() => {
    if (!open || !anchorRef.current) return;
    const place = () => {
      const a = anchorRef.current!.getBoundingClientRect();
      const w = width ?? Math.max(a.width, 210);
      const popH = popRef.current?.offsetHeight ?? 260;
      // Flip above when there is not enough room below.
      const below = window.innerHeight - a.bottom;
      const top = below < popH + 12 && a.top > popH + 12 ? a.top - popH - 4 : a.bottom + 4;
      let left = align === 'end' ? a.right - w : a.left;
      left = Math.min(Math.max(8, left), window.innerWidth - w - 8);
      setPos({ top, left, width: w });
    };
    place();
    window.addEventListener('resize', place);
    window.addEventListener('scroll', place, true);
    return () => {
      window.removeEventListener('resize', place);
      window.removeEventListener('scroll', place, true);
    };
  }, [open, align, width]);

  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      const t = e.target as Node;
      if (popRef.current?.contains(t) || anchorRef.current?.contains(t)) return;
      close();
    };
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') { e.stopPropagation(); close(); } };
    document.addEventListener('mousedown', onDown);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onDown);
      document.removeEventListener('keydown', onKey);
    };
  }, [open, close]);

  return (
    <>
      {trigger({
        open,
        ref: anchorRef,
        onClick: (e) => { e.stopPropagation(); if (!disabled) set(!open); },
      })}
      {open && pos && typeof document !== 'undefined' && createPortal(
        <PopCtx.Provider value={{ close }}>
          {/* `cw` must be repeated here: the portal target is document.body,
              outside the workspace root, so without it every --cw-* variable
              resolves to nothing and the popover renders unstyled. */}
          <div
            ref={popRef}
            className="cw cw-pop"
            style={{ top: pos.top, left: pos.left, width: pos.width }}
            onClick={(e) => e.stopPropagation()}
          >
            {typeof children === 'function' ? (children as any)({ close }) : children}
          </div>
        </PopCtx.Provider>,
        document.body,
      )}
    </>
  );
}

// ============================================================ Option list

export interface Opt {
  value: string;
  label: string;
  hint?: string;
  tone?: Tone;
  icon?: React.ReactNode;
  group?: string;
}

/**
 * The list body every popover shares: optional search, keyboard navigation,
 * grouped headings, and a check on the current value.
 */
export function OptionList({
  options, value, values, onPick, searchable, placeholder = 'Search…', footer, emptyText = 'No matches',
}: {
  options: Opt[];
  value?: string | null;
  values?: string[];
  onPick: (v: string) => void;
  searchable?: boolean;
  placeholder?: string;
  footer?: React.ReactNode;
  emptyText?: string;
}) {
  const [q, setQ] = useState('');
  const [cursor, setCursor] = useState(0);
  const listRef = useRef<HTMLDivElement>(null);

  const filtered = useMemo(() => {
    const s = q.trim().toLowerCase();
    if (!s) return options;
    return options.filter((o) => o.label.toLowerCase().includes(s) || o.hint?.toLowerCase().includes(s));
  }, [options, q]);

  useEffect(() => { setCursor(0); }, [q]);

  const onKey = (e: React.KeyboardEvent) => {
    if (e.key === 'ArrowDown') { e.preventDefault(); setCursor((c) => Math.min(c + 1, filtered.length - 1)); }
    if (e.key === 'ArrowUp') { e.preventDefault(); setCursor((c) => Math.max(c - 1, 0)); }
    if (e.key === 'Enter' && filtered[cursor]) { e.preventDefault(); onPick(filtered[cursor].value); }
  };

  useEffect(() => {
    listRef.current?.querySelector<HTMLElement>(`[data-i="${cursor}"]`)?.scrollIntoView({ block: 'nearest' });
  }, [cursor]);

  let lastGroup: string | undefined;

  return (
    <>
      {searchable && (
        <div className="cw-pop-search">
          <Search size={13} style={{ color: 'var(--cw-ink-3)', flex: 'none' }} />
          <input autoFocus value={q} onChange={(e) => setQ(e.target.value)} onKeyDown={onKey} placeholder={placeholder} />
        </div>
      )}
      <div className="cw-pop-list" ref={listRef} onKeyDown={searchable ? undefined : onKey} tabIndex={searchable ? undefined : 0}>
        {filtered.length === 0 && <div className="cw-meta" style={{ padding: '12px 9px' }}>{emptyText}</div>}
        {filtered.map((o, i) => {
          const header = o.group && o.group !== lastGroup ? o.group : null;
          lastGroup = o.group;
          const on = values ? values.includes(o.value) : o.value === value;
          return (
            <React.Fragment key={o.value}>
              {header && <div className="cw-pop-label">{header}</div>}
              <button
                type="button"
                data-i={i}
                data-active={i === cursor}
                className="cw-opt"
                onMouseEnter={() => setCursor(i)}
                onClick={() => onPick(o.value)}
              >
                {o.icon ?? (o.tone ? <span className="cw-chip-dot" style={{ color: TONE_VAR[o.tone] }} /> : null)}
                <span className="cw-truncate" style={{ flex: 1 }}>{o.label}</span>
                {o.hint && <span className="cw-opt-hint">{o.hint}</span>}
                {on && <Check size={13} style={{ color: 'var(--cw-accent)', flex: 'none' }} />}
              </button>
            </React.Fragment>
          );
        })}
      </div>
      {footer && <div style={{ borderTop: '1px solid var(--cw-line-soft)', padding: 4 }}>{footer}</div>}
    </>
  );
}

/** Dropdown menu — same list, but items are actions rather than values. */
export function Menu({
  trigger, items, align = 'end', width = 210,
}: {
  trigger: (p: { open: boolean; ref: React.Ref<any>; onClick: (e: React.MouseEvent) => void }) => React.ReactNode;
  items: ({ label: string; icon?: React.ReactNode; onSelect: () => void; danger?: boolean; hint?: string } | 'separator')[];
  align?: 'start' | 'end';
  width?: number;
}) {
  return (
    <Popover trigger={trigger} align={align} width={width}>
      {({ close }) => (
        <div className="cw-pop-list">
          {items.map((it, i) =>
            it === 'separator' ? (
              <div key={`s${i}`} className="cw-pop-sep" />
            ) : (
              <button
                key={it.label}
                type="button"
                className="cw-opt"
                style={it.danger ? { color: 'var(--cw-red)' } : undefined}
                onClick={() => { it.onSelect(); close(); }}
              >
                {it.icon}
                <span style={{ flex: 1 }}>{it.label}</span>
                {it.hint && <span className="cw-opt-hint">{it.hint}</span>}
              </button>
            ),
          )}
        </div>
      )}
    </Popover>
  );
}

// ============================================================ Display bits

export function Chip({ tone = 'slate', dot = true, children }: { tone?: Tone; dot?: boolean; children: React.ReactNode }) {
  return (
    <span className={`cw-chip cw-tone-${tone}`}>
      {dot && <span className="cw-chip-dot" />}
      <span className="cw-truncate">{children}</span>
    </span>
  );
}

export function Tag({ children }: { children: React.ReactNode }) {
  return <span className="cw-tag">{children}</span>;
}

/** Deterministic initials avatar — the same person keeps the same tint. */
export function Avatar({ name, size = 20 }: { name?: string | null; size?: number }) {
  const tones: Tone[] = ['blue', 'violet', 'green', 'amber', 'slate'];
  const seed = [...(name || '?')].reduce((a, c) => a + c.charCodeAt(0), 0);
  const tone = tones[seed % tones.length];
  const initials = (name || '?').split(/\s+/).slice(0, 2).map((w) => w[0]).join('').toUpperCase();
  return (
    <span
      aria-hidden="true"
      className={`cw-tone-${tone}`}
      style={{
        width: size, height: size, borderRadius: Math.max(3, size / 3.4), flex: 'none',
        display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
        fontWeight: 650, fontSize: size * 0.42, letterSpacing: '-0.02em',
      }}
    >{initials}</span>
  );
}

export function AvatarStack({ people, max = 3, size = 20 }: { people: { id: string; name: string }[]; max?: number; size?: number }) {
  if (!people.length) return <span className="cw-cell-empty">—</span>;
  return (
    <span style={{ display: 'inline-flex', alignItems: 'center' }}>
      {people.slice(0, max).map((p, i) => (
        <span key={p.id} title={p.name} style={{ marginLeft: i ? -6 : 0, boxShadow: '0 0 0 1.5px var(--cw-bg)', borderRadius: 6, display: 'inline-flex' }}>
          <Avatar name={p.name} size={size} />
        </span>
      ))}
      {people.length > max && (
        <span className="cw-meta" style={{ marginLeft: 5 }}>+{people.length - max}</span>
      )}
    </span>
  );
}

export function Person({ person, size = 20, muted }: { person?: { name: string } | null; size?: number; muted?: boolean }) {
  if (!person) return <span className="cw-cell-empty">Unassigned</span>;
  return (
    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6, minWidth: 0 }}>
      <Avatar name={person.name} size={size} />
      <span className="cw-truncate" style={{ color: muted ? 'var(--cw-ink-2)' : 'var(--cw-ink)', fontWeight: 500 }}>{person.name}</span>
    </span>
  );
}

export function ProgressBar({ value, tone = 'blue', width }: { value: number; tone?: Tone; width?: number }) {
  const v = Math.max(0, Math.min(100, Math.round(value || 0)));
  return (
    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 7, width: width ?? '100%', minWidth: 0 }}>
      <span className="cw-bar" style={{ flex: 1 }}>
        <span style={{ width: `${v}%`, background: TONE_VAR[tone] }} />
      </span>
      <span className="cw-num cw-meta" style={{ flex: 'none', fontWeight: 600, color: 'var(--cw-ink-2)', minWidth: 26, textAlign: 'right' }}>{v}%</span>
    </span>
  );
}

export function Tabs({
  tabs, active, onChange, counts,
}: { tabs: readonly string[]; active: string; onChange: (t: string) => void; counts?: Record<string, number | undefined> }) {
  return (
    <div className="cw-tabs" role="tablist">
      {tabs.map((t) => (
        <button
          key={t}
          role="tab"
          aria-selected={t === active}
          data-active={t === active}
          className="cw-tab"
          onClick={() => onChange(t)}
        >
          {t}
          {counts?.[t] != null && <span className="cw-tab-count">{counts[t]}</span>}
        </button>
      ))}
    </div>
  );
}

export function Crumbs({ items }: { items: { label: string; href?: string }[] }) {
  return (
    <nav className="cw-crumbs" aria-label="Breadcrumb">
      {items.map((it, i) => (
        <React.Fragment key={`${it.label}-${i}`}>
          {i > 0 && <ChevronRight size={12} style={{ color: 'var(--cw-ink-4)', flex: 'none' }} />}
          {it.href ? (
            <a href={it.href} className="cw-truncate">{it.label}</a>
          ) : (
            <span className="cw-crumbs-current cw-truncate">{it.label}</span>
          )}
        </React.Fragment>
      ))}
    </nav>
  );
}

// Empty/Loading/Error live in ./states so every screen shares one vocabulary;
// re-exported here because most callers already import from primitives.
export { Empty, ErrorState, InlineError, Loading, QueryState } from './states';

export function Skeleton({ rows = 5, height = 34 }: { rows?: number; height?: number }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 6, padding: '8px 0' }}>
      {Array.from({ length: rows }).map((_, i) => (
        <div key={i} className="cw-skel" style={{ height, opacity: 1 - i * 0.08 }} />
      ))}
    </div>
  );
}

export function SectionHead({ title, count, action }: { title: string; count?: number; action?: React.ReactNode }) {
  return (
    <div className="cw-section-head">
      <h3 className="cw-h2">{title}</h3>
      {count != null && <span className="cw-tab-count">{count}</span>}
      {action && <span style={{ marginLeft: 'auto' }}>{action}</span>}
    </div>
  );
}

/** A single stat rendered as text, not a card — the whole point of §33. */
export function Stat({ label, value, tone }: { label: string; value: React.ReactNode; tone?: Tone }) {
  return (
    <div style={{ minWidth: 74 }}>
      <div className="cw-meta" style={{ marginBottom: 1 }}>{label}</div>
      <div className="cw-num" style={{ fontSize: 17, fontWeight: 650, letterSpacing: '-0.02em', color: tone ? TONE_VAR[tone] : 'var(--cw-ink)' }}>
        {value}
      </div>
    </div>
  );
}

/** Row of stats separated by hairlines. */
export function StatStrip({ stats }: { stats: { label: string; value: React.ReactNode; tone?: Tone }[] }) {
  return (
    <div style={{ display: 'flex', gap: 26, flexWrap: 'wrap', padding: '14px 0 16px', borderBottom: '1px solid var(--cw-line)' }}>
      {stats.map((s) => <Stat key={s.label} {...s} />)}
    </div>
  );
}

// ============================================================ Formatting

export function fmtDate(d?: string | Date | null): string {
  if (!d) return '';
  const date = new Date(d);
  const now = new Date();
  const sameYear = date.getFullYear() === now.getFullYear();
  return date.toLocaleDateString(undefined, sameYear ? { day: 'numeric', month: 'short' } : { day: 'numeric', month: 'short', year: 'numeric' });
}

export function fmtDateTime(d?: string | Date | null): string {
  if (!d) return '';
  return new Date(d).toLocaleString(undefined, { day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit' });
}

/** "2h", "3d", "just now" — the trailing column on almost every table. */
export function fmtAgo(d?: string | Date | null): string {
  if (!d) return '';
  const ms = Date.now() - new Date(d).getTime();
  const m = Math.floor(ms / 60000);
  if (m < 1) return 'just now';
  if (m < 60) return `${m}m`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h`;
  const days = Math.floor(h / 24);
  if (days < 30) return `${days}d`;
  return fmtDate(d);
}

export function daysUntil(d?: string | Date | null): number | null {
  if (!d) return null;
  const t = new Date(d); t.setHours(0, 0, 0, 0);
  const now = new Date(); now.setHours(0, 0, 0, 0);
  return Math.round((t.getTime() - now.getTime()) / 86400000);
}

const CLOSED = ['DONE', 'CANCELLED', 'COMPLETED', 'CLOSED', 'VERIFIED', 'RELEASED'];
export function isOverdue(date?: string | null, status?: string): boolean {
  if (!date || (status && CLOSED.includes(status))) return false;
  const n = daysUntil(date);
  return n != null && n < 0;
}
