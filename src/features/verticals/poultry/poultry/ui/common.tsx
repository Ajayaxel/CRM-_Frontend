'use client';

/**
 * The pieces every coworking list screen needs, written once.
 *
 * PHASE 24 asks for search, filters, sorting, pagination and date/status
 * filtering on thirteen different lists. Thirteen hand-rolled toolbars is
 * thirteen chances for one of them to page differently from the rest, so the
 * behaviour lives here and each screen supplies only what is specific to it.
 */

import React, { useEffect, useMemo, useState } from 'react';
import { Search, X } from 'lucide-react';
import { fmtOrgMoney } from '@/lib/org-locale';
import { humanStatus } from './kit';

export const money = (n?: number | null) => fmtOrgMoney(n ?? 0);

export function fmtDate(d?: string | Date | null) {
  if (!d) return '—';
  const x = new Date(d);
  if (Number.isNaN(x.getTime())) return '—';
  return x.toLocaleDateString(undefined, { day: '2-digit', month: 'short', year: 'numeric' });
}

export function fmtDateTime(d?: string | Date | null) {
  if (!d) return '—';
  const x = new Date(d);
  if (Number.isNaN(x.getTime())) return '—';
  return x.toLocaleString(undefined, { day: '2-digit', month: 'short', hour: 'numeric', minute: '2-digit' });
}

export function fmtTime(d?: string | Date | null) {
  if (!d) return '—';
  const x = new Date(d);
  if (Number.isNaN(x.getTime())) return '—';
  return x.toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' });
}

/** "in 12 days" / "6 days ago" — the phrasing a renewal queue actually needs. */
export function relativeDays(d?: string | Date | null) {
  if (!d) return '—';
  const days = Math.ceil((new Date(d).getTime() - Date.now()) / 86400000);
  if (Number.isNaN(days)) return '—';
  if (days === 0) return 'today';
  if (days === 1) return 'tomorrow';
  if (days === -1) return 'yesterday';
  return days > 0 ? `in ${days} days` : `${Math.abs(days)} days ago`;
}

export const toLocalInput = (d?: Date | string | null) => {
  const x = d ? new Date(d) : new Date();
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${x.getFullYear()}-${pad(x.getMonth() + 1)}-${pad(x.getDate())}T${pad(x.getHours())}:${pad(x.getMinutes())}`;
};

export const toDateInput = (d?: Date | string | null) => {
  const x = d ? new Date(d) : new Date();
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${x.getFullYear()}-${pad(x.getMonth() + 1)}-${pad(x.getDate())}`;
};

/** Debounced so a search box does not fire a request per keystroke. */
export function useDebounced<T>(value: T, ms = 300): T {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const id = window.setTimeout(() => setDebounced(value), ms);
    return () => window.clearTimeout(id);
  }, [value, ms]);
  return debounced;
}

export interface ListState {
  page: number;
  search: string;
  status: string;
  sort: string;
  dir: 'asc' | 'desc';
  from: string;
  to: string;
}

export function useListState(initial: Partial<ListState> = {}) {
  const [state, setState] = useState<ListState>({
    page: 1, search: '', status: '', sort: '', dir: 'desc', from: '', to: '', ...initial,
  });
  const debouncedSearch = useDebounced(state.search);
  // Any filter change returns to page one — otherwise a filter that narrows the
  // result set leaves you on page 7 of 2, looking at an empty screen.
  const set = (patch: Partial<ListState>) =>
    setState((s) => ({ ...s, ...patch, page: patch.page ?? 1 }));
  const params = useMemo(() => {
    const p: Record<string, string | number> = { page: state.page, limit: 25 };
    if (debouncedSearch.trim()) p.search = debouncedSearch.trim();
    if (state.status) p.status = state.status;
    if (state.sort) { p.sort = state.sort; p.dir = state.dir; }
    if (state.from) p.from = new Date(state.from).toISOString();
    if (state.to) p.to = new Date(`${state.to}T23:59:59`).toISOString();
    return p;
  }, [state.page, debouncedSearch, state.status, state.sort, state.dir, state.from, state.to]);
  return { state, set, params };
}

export function SearchBox({ value, onChange, placeholder = 'Search…' }: { value: string; onChange: (v: string) => void; placeholder?: string }) {
  return (
    <div style={{ position: 'relative', minWidth: 200, flex: '1 1 220px', maxWidth: 340 }}>
      <Search size={14} style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', color: 'var(--ink-3)' }} />
      <input
        className="input"
        style={{ paddingLeft: 30, paddingRight: value ? 28 : undefined }}
        value={value}
        placeholder={placeholder}
        aria-label={placeholder}
        onChange={(e) => onChange(e.target.value)}
      />
      {value && (
        <button
          type="button" aria-label="Clear search" onClick={() => onChange('')}
          className="btn-ghost btn-sm"
          style={{ position: 'absolute', right: 2, top: '50%', transform: 'translateY(-50%)', width: 24, padding: 0 }}
        ><X size={12} /></button>
      )}
    </div>
  );
}

export function StatusSelect({
  value, onChange, options, label = 'All statuses',
}: { value: string; onChange: (v: string) => void; options: readonly string[]; label?: string }) {
  return (
    <select className="input" style={{ maxWidth: 190 }} value={value} onChange={(e) => onChange(e.target.value)} aria-label={label}>
      <option value="">{label}</option>
      {options.map((o) => <option key={o} value={o}>{humanStatus(o)}</option>)}
    </select>
  );
}

export function DateRange({
  from, to, onChange,
}: { from: string; to: string; onChange: (patch: { from?: string; to?: string }) => void }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
      <input className="input" style={{ width: 148 }} type="date" value={from} aria-label="From" onChange={(e) => onChange({ from: e.target.value })} />
      <span className="ds-caption">to</span>
      <input className="input" style={{ width: 148 }} type="date" value={to} aria-label="To" onChange={(e) => onChange({ to: e.target.value })} />
      {(from || to) && (
        <button type="button" className="btn-ghost btn-sm" onClick={() => onChange({ from: '', to: '' })}>Clear</button>
      )}
    </div>
  );
}

/** Named periods, the set every report screen offers. */
export const PERIODS = [
  { key: 'today', label: 'Today' },
  { key: 'yesterday', label: 'Yesterday' },
  { key: 'this_week', label: 'This week' },
  { key: 'this_month', label: 'This month' },
  { key: 'last_month', label: 'Last month' },
  { key: 'quarter', label: 'Quarter' },
  { key: 'year', label: 'Year' },
  { key: 'custom', label: 'Custom' },
] as const;

export function Pagination({
  meta, onPage,
}: { meta?: { page: number; limit: number; total: number; totalPages: number }; onPage: (p: number) => void }) {
  if (!meta || meta.total === 0) return null;
  const first = (meta.page - 1) * meta.limit + 1;
  const last = Math.min(meta.total, meta.page * meta.limit);
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginTop: 14, flexWrap: 'wrap' }}>
      <span className="ds-caption">{first}–{last} of {meta.total}</span>
      <div style={{ marginLeft: 'auto', display: 'flex', gap: 6 }}>
        <button className="btn-ghost btn-sm" disabled={meta.page <= 1} onClick={() => onPage(meta.page - 1)}>Previous</button>
        <span className="ds-caption" style={{ alignSelf: 'center' }}>Page {meta.page} of {meta.totalPages}</span>
        <button className="btn-ghost btn-sm" disabled={meta.page >= meta.totalPages} onClick={() => onPage(meta.page + 1)}>Next</button>
      </div>
    </div>
  );
}

/** The page frame — title, subtitle, actions — so every screen sits the same. */
export function PageHead({
  title, subtitle, actions,
}: { title: string; subtitle?: string; actions?: React.ReactNode }) {
  return (
    <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12, flexWrap: 'wrap', marginBottom: 18 }}>
      <div style={{ minWidth: 0 }}>
        <h1 className="ds-h1">{title}</h1>
        {subtitle && <p className="ds-caption" style={{ marginTop: 4 }}>{subtitle}</p>}
      </div>
      {actions && <div style={{ marginLeft: 'auto', display: 'flex', gap: 8, flexWrap: 'wrap' }}>{actions}</div>}
    </div>
  );
}

/** A read-only label/value pair, for detail panels. */
export function Detail({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div style={{ minWidth: 0 }}>
      <div className="ds-caption">{label}</div>
      <div style={{ fontSize: 13.5, fontWeight: 560, color: 'var(--ink)', marginTop: 2, wordBreak: 'break-word' }}>{value ?? '—'}</div>
    </div>
  );
}

export function DetailGrid({ children }: { children: React.ReactNode }) {
  return (
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(160px,1fr))', gap: 14 }}>{children}</div>
  );
}
