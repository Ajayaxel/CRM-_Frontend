'use client';

/**
 * The pieces the three core screens share. Small on purpose — everything
 * visual comes from the platform design system, and this file only holds the
 * page furniture and the formatters.
 */

import React from 'react';
import { fmtOrgMoney } from '@/lib/org-locale';

export const money = (n?: number | null) => fmtOrgMoney(n ?? 0);

/** Paise are the unit rates are kept in; rupees are what people read. */
export const fromPaise = (p?: number | null) => fmtOrgMoney(Math.round((p ?? 0) / 100));

export const qty = (n?: number | null, uom?: string | null) => {
  const v = Number(n ?? 0);
  const shown = Number.isInteger(v) ? v.toLocaleString('en-IN') : v.toFixed(3).replace(/\.?0+$/, '');
  return uom ? `${shown} ${uom}` : shown;
};

export function fmtDate(d?: string | Date | null) {
  if (!d) return '—';
  const x = new Date(d);
  if (Number.isNaN(x.getTime())) return '—';
  return x.toLocaleDateString(undefined, { day: '2-digit', month: 'short', year: 'numeric' });
}

export const pct = (bps: number) => `${(bps / 100).toFixed(bps % 100 === 0 ? 0 : 2)}%`;

export const humanise = (v?: string | null) =>
  (v ?? '').replace(/_/g, ' ').toLowerCase().replace(/^./, (c) => c.toUpperCase());

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

/** A caption under a table that explains what the numbers are, once. */
export function TableNote({ children }: { children: React.ReactNode }) {
  return (
    <p className="ds-caption" style={{ padding: '12px 16px', borderTop: '1px solid var(--hairline-soft)' }}>
      {children}
    </p>
  );
}

export function toDateInput(d?: Date | string | null) {
  const x = d ? new Date(d) : new Date();
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${x.getFullYear()}-${pad(x.getMonth() + 1)}-${pad(x.getDate())}`;
}

/** First day of the current month, for the default reporting window. */
export function monthStart() {
  const n = new Date();
  return toDateInput(new Date(n.getFullYear(), n.getMonth(), 1));
}
