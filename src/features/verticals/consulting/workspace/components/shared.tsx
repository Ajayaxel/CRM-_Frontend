'use client';

import React from 'react';
import { humanEnum, KPI_COLOR, KpiStatus, PRIORITY_COLOR, CsPriority, isOverdue, shortDate } from '../workspace-client';

export const card: React.CSSProperties = {
  background: 'var(--surface)',
  border: '1px solid var(--line-soft)',
  borderRadius: 16,
};

/**
 * One number and what it means. Deliberately plain: spec §27 asks for calm, and
 * a dashboard where every tile shouts is one where nothing does.
 */
export function Stat({ label, value, accent, hint }: { label: string; value: React.ReactNode; accent?: string; hint?: string }) {
  return (
    <div style={{ ...card, padding: '14px 16px' }}>
      <div style={{ fontSize: 12, color: 'var(--ink-2)', letterSpacing: '.02em' }}>{label}</div>
      <div style={{ fontSize: 24, fontWeight: 700, marginTop: 4, color: accent ?? 'var(--ink-1)' }}>{value}</div>
      {hint ? <div style={{ fontSize: 11, color: 'var(--ink-3)', marginTop: 2 }}>{hint}</div> : null}
    </div>
  );
}

export function Pill({ children, color, title }: { children: React.ReactNode; color?: string; title?: string }) {
  return (
    <span
      title={title}
      style={{
        fontSize: 11, fontWeight: 600, padding: '2px 8px', borderRadius: 999,
        border: `1px solid ${color ?? 'var(--line-soft)'}`,
        color: color ?? 'var(--ink-2)', whiteSpace: 'nowrap',
      }}
    >
      {children}
    </span>
  );
}

export const PriorityPill = ({ p }: { p: CsPriority }) => <Pill color={PRIORITY_COLOR[p]}>{humanEnum(p)}</Pill>;
export const KpiPill = ({ s }: { s: KpiStatus }) => <Pill color={KPI_COLOR[s]}>{humanEnum(s)}</Pill>;

/** A due date that says so when it has passed. */
export function Due({ date }: { date?: string | null }) {
  if (!date) return <span style={{ color: 'var(--ink-3)' }}>—</span>;
  const late = isOverdue(date);
  return (
    <span style={{ color: late ? 'var(--danger,#d93025)' : 'var(--ink-2)', fontWeight: late ? 600 : 400 }}>
      {shortDate(date)}{late ? ' · overdue' : ''}
    </span>
  );
}

/**
 * What an empty screen says.
 *
 * Spec §37 asks for meaningful empty states, and the meaning here is always the
 * same: the next action, not an apology.
 */
export function Empty({ title, hint, action }: { title: string; hint?: string; action?: React.ReactNode }) {
  return (
    <div style={{ ...card, padding: '28px 20px', textAlign: 'center' }}>
      <div style={{ fontSize: 14, fontWeight: 600 }}>{title}</div>
      {hint ? <div style={{ fontSize: 13, color: 'var(--ink-2)', marginTop: 6 }}>{hint}</div> : null}
      {action ? <div style={{ marginTop: 12 }}>{action}</div> : null}
    </div>
  );
}

export function Loading({ label = 'Loading' }: { label?: string }) {
  return <div style={{ ...card, padding: 20, fontSize: 13, color: 'var(--ink-2)' }}>{label}…</div>;
}

export function SectionTitle({ children, right }: { children: React.ReactNode; right?: React.ReactNode }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', margin: '0 0 10px' }}>
      <h2 style={{ fontSize: 15, fontWeight: 700, margin: 0 }}>{children}</h2>
      {right}
    </div>
  );
}

/** A progress bar that admits when there is nothing to show. */
export function Progress({ value }: { value: number | null }) {
  if (value === null || value === undefined) {
    return <span style={{ fontSize: 12, color: 'var(--ink-3)' }}>not measured</span>;
  }
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 8, minWidth: 120 }}>
      <div style={{ flex: 1, height: 6, borderRadius: 999, background: 'var(--line-soft)', overflow: 'hidden' }}>
        <div style={{ width: `${Math.min(100, Math.max(0, value))}%`, height: '100%', background: 'var(--brand,#132376)' }} />
      </div>
      <span style={{ fontSize: 12, color: 'var(--ink-2)', width: 34, textAlign: 'right' }}>{value}%</span>
    </div>
  );
}

export function Row({ children, onClick }: { children: React.ReactNode; onClick?: () => void }) {
  return (
    <div
      onClick={onClick}
      style={{
        display: 'flex', alignItems: 'center', gap: 10, padding: '10px 14px',
        borderTop: '1px solid var(--line-soft)', cursor: onClick ? 'pointer' : 'default',
      }}
    >
      {children}
    </div>
  );
}
