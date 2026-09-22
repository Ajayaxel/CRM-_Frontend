'use client';

/**
 * Insurance UI kit — the shared component layer for the console and portal.
 *
 * The rule these follow: hierarchy comes from type and space, colour comes
 * from status, and elevation is reserved for things that genuinely float.
 * Screens compose these rather than hand-rolling inline styles, which is how
 * the old console drifted into looking like an internal CRUD tool.
 */

import React, { useCallback, useEffect, useId, useRef, useState } from 'react';
import { ArrowDown, ArrowUp, Check, X } from 'lucide-react';

export type Tone = 'active' | 'renewal' | 'expired' | 'claim' | 'sales' | 'info' | 'neutral';

export const TONE: Record<Tone, { fg: string; bg: string; line: string }> = {
  active: { fg: 'var(--tone-active)', bg: 'var(--tone-active-bg)', line: 'var(--tone-active-line)' },
  renewal: { fg: 'var(--tone-renewal)', bg: 'var(--tone-renewal-bg)', line: 'var(--tone-renewal-line)' },
  expired: { fg: 'var(--tone-expired)', bg: 'var(--tone-expired-bg)', line: 'var(--tone-expired-line)' },
  claim: { fg: 'var(--tone-claim)', bg: 'var(--tone-claim-bg)', line: 'var(--tone-claim-line)' },
  sales: { fg: 'var(--tone-sales)', bg: 'var(--tone-sales-bg)', line: 'var(--tone-sales-line)' },
  info: { fg: 'var(--tone-info)', bg: 'var(--tone-info-bg)', line: 'var(--tone-info-line)' },
  neutral: { fg: 'var(--tone-neutral)', bg: 'var(--tone-neutral-bg)', line: 'var(--tone-neutral-line)' },
};

export function toneForPolicyStatus(status?: string): Tone {
  switch ((status ?? '').toUpperCase()) {
    case 'ACTIVE': return 'active';
    case 'RENEWED': return 'info';
    case 'LAPSED': return 'expired';
    case 'EXPIRED':
    case 'CANCELLED': return 'neutral';
    case 'PROPOSAL': return 'renewal';
    default: return 'neutral';
  }
}

export function toneForClaimStatus(status?: string): Tone {
  switch ((status ?? '').toUpperCase()) {
    case 'SETTLED':
    case 'APPROVED': return 'active';
    case 'REJECTED': return 'expired';
    case 'DOCS_PENDING': return 'renewal';
    case 'SUBMITTED':
    case 'UNDER_REVIEW': return 'claim';
    default: return 'neutral';
  }
}

/** Human policy/claim status text — SCREAMING_SNAKE is a database detail. */
export function humanStatus(s?: string) {
  if (!s) return '';
  return s.charAt(0) + s.slice(1).toLowerCase().replace(/_/g, ' ');
}

export function useIsNarrow(px = 720) {
  const [narrow, setNarrow] = useState(false);
  useEffect(() => {
    const mq = window.matchMedia(`(max-width: ${px}px)`);
    const on = () => setNarrow(mq.matches);
    on();
    mq.addEventListener('change', on);
    return () => mq.removeEventListener('change', on);
  }, [px]);
  return narrow;
}

// ============================================================ Surfaces

export function Card({
  children, pad, tone, interactive, onClick, style, className = '', flush,
}: {
  children: React.ReactNode; pad?: number; tone?: Tone; interactive?: boolean;
  onClick?: () => void; style?: React.CSSProperties; className?: string; flush?: boolean;
}) {
  const t = tone ? TONE[tone] : null;
  const cls = ['ds-card', flush ? 'ds-card-flush' : '', interactive || onClick ? 'ds-card-interactive' : '', className]
    .filter(Boolean).join(' ');
  return (
    <div
      className={cls}
      onClick={onClick}
      role={onClick ? 'button' : undefined}
      tabIndex={onClick ? 0 : undefined}
      onKeyDown={onClick ? (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onClick(); } } : undefined}
      style={{ ...(pad != null ? { padding: pad } : {}), ...(t ? { borderColor: t.line } : {}), ...style }}
    >
      {children}
    </div>
  );
}

export function SectionTitle({ children, sub, action }: { children: React.ReactNode; sub?: string; action?: React.ReactNode }) {
  return (
    <div style={{ display: 'flex', alignItems: 'baseline', gap: 12, marginBottom: sub ? 14 : 12 }}>
      <div style={{ minWidth: 0 }}>
        <h2 className="ds-h2">{children}</h2>
        {sub && <div className="ds-caption" style={{ marginTop: 3 }}>{sub}</div>}
      </div>
      {action && <div style={{ marginLeft: 'auto', flex: 'none' }}>{action}</div>}
    </div>
  );
}

export function Toolbar({ children }: { children: React.ReactNode }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap', marginBottom: 4 }}>
      {children}
    </div>
  );
}

// ============================================================ Status

export function Badge({ tone = 'neutral', children, dot = true }: { tone?: Tone; children: React.ReactNode; dot?: boolean }) {
  return (
    <span className={`ds-badge ${dot ? 'ds-badge-dot' : ''} ds-tone-${tone}`}>{children}</span>
  );
}

/** Quieter than a badge: a coloured dot plus text, for dense list rows. */
export function Status({ tone = 'neutral', children }: { tone?: Tone; children: React.ReactNode }) {
  return (
    <span className={`ds-status ds-fg-${tone}`}>
      <span className="ds-dot" />
      <span style={{ color: 'var(--ink-2)' }}>{children}</span>
    </span>
  );
}

export function EntityIcon({ icon: Icon, tone = 'neutral', size = 'md' }: { icon: any; tone?: Tone; size?: 'md' | 'lg' }) {
  const t = TONE[tone];
  return (
    <span
      className={`ds-entity-icon${size === 'lg' ? ' ds-entity-icon-lg' : ''}`}
      style={{ color: t.fg, background: t.bg }}
    >
      <Icon size={size === 'lg' ? 18 : 15} />
    </span>
  );
}

/** Initials avatar — deterministic tint so the same person keeps a colour. */
export function Avatar({ name, size = 32 }: { name: string; size?: number }) {
  const tones: Tone[] = ['sales', 'claim', 'active', 'renewal', 'info'];
  const t = TONE[tones[[...(name || '?')].reduce((a, c) => a + c.charCodeAt(0), 0) % tones.length]];
  const initials = (name || '?').split(/\s+/).slice(0, 2).map((w) => w[0]).join('').toUpperCase();
  return (
    <span
      style={{
        width: size, height: size, borderRadius: size / 3, flex: 'none',
        display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
        background: t.bg, color: t.fg, fontWeight: 700, fontSize: size * 0.36,
      }}
    >{initials}</span>
  );
}

// ============================================================ Stats

export function StatCard({
  label, value, hint, delta, deltaLabel, tone = 'neutral', icon: Icon, spark, onClick, format,
}: {
  label: string; value: React.ReactNode; hint?: string; delta?: number; deltaLabel?: string;
  tone?: Tone; icon?: any; spark?: number[]; onClick?: () => void; format?: (n: number) => string;
}) {
  const t = TONE[tone];
  const hasDelta = typeof delta === 'number' && Number.isFinite(delta);
  const up = hasDelta && delta! > 0;
  const flat = hasDelta && delta === 0;
  const deltaFg = flat ? 'var(--ink-3)' : up ? 'var(--tone-active)' : 'var(--tone-expired)';
  const deltaBg = flat ? 'var(--tone-neutral-bg)' : up ? 'var(--tone-active-bg)' : 'var(--tone-expired-bg)';

  return (
    <Card onClick={onClick} pad={18}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
        {Icon && (
          <span style={{
            width: 26, height: 26, borderRadius: 7, display: 'inline-flex', alignItems: 'center',
            justifyContent: 'center', background: t.bg, color: t.fg, flex: 'none',
          }}><Icon size={14} /></span>
        )}
        <span className="ds-caption" style={{ minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{label}</span>
      </div>

      <div style={{ display: 'flex', alignItems: 'flex-end', gap: 10 }}>
        <div style={{ minWidth: 0, flex: 1 }}>
          <div className="ds-display" style={{ whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{value}</div>
          {/* Says why a tile is empty, so it reads as "nothing to show" rather
              than as a number that failed to load. */}
          {hint && <div className="ds-caption" style={{ marginTop: 6, whiteSpace: 'normal' }}>{hint}</div>}
          {/* A bare "vs last month" with no figure beside it reads as broken, so the
              comparison line only appears once there is a comparison to show. */}
          {hasDelta && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 8, flexWrap: 'wrap' }}>
              {(
                <span style={{
                  display: 'inline-flex', alignItems: 'center', gap: 3, padding: '2px 6px',
                  borderRadius: 'var(--r-pill)', background: deltaBg, color: deltaFg,
                  fontSize: 11.5, fontWeight: 650, fontVariantNumeric: 'tabular-nums',
                }}>
                  {!flat && (up ? <ArrowUp size={10} /> : <ArrowDown size={10} />)}
                  {up ? '+' : ''}{format ? format(delta!) : delta}
                </span>
              )}
              {deltaLabel && <span className="ds-caption">{deltaLabel}</span>}
            </div>
          )}
        </div>
        {spark && spark.length > 1 && (
          <div style={{ flex: 'none', paddingBottom: 2 }}>
            <Sparkline data={spark} tone={tone === 'neutral' ? 'info' : tone} />
          </div>
        )}
      </div>
    </Card>
  );
}

// ============================================================ Charts (hand-rolled SVG — no chart dependency)

export function Sparkline({ data, tone = 'info', height = 30, width = 74 }: { data: number[]; tone?: Tone; height?: number; width?: number }) {
  if (!data || data.length < 2) return null;
  const t = TONE[tone];
  const max = Math.max(...data), min = Math.min(...data);
  const span = max - min || 1;
  const pts = data.map((v, i) => [
    (i / (data.length - 1)) * (width - 2) + 1,
    height - 2 - ((v - min) / span) * (height - 5),
  ] as const);
  const line = pts.map((p, i) => `${i ? 'L' : 'M'}${p[0].toFixed(1)},${p[1].toFixed(1)}`).join(' ');
  const area = `${line} L${pts[pts.length - 1][0].toFixed(1)},${height} L${pts[0][0].toFixed(1)},${height} Z`;
  const gid = `sp${Math.round(data.reduce((a, b) => a + b, 0))}${data.length}`;
  const last = pts[pts.length - 1];
  return (
    <svg width={width} height={height} viewBox={`0 0 ${width} ${height}`} aria-hidden="true" style={{ display: 'block', color: t.fg }}>
      <defs>
        <linearGradient id={gid} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="currentColor" stopOpacity="0.22" />
          <stop offset="100%" stopColor="currentColor" stopOpacity="0" />
        </linearGradient>
      </defs>
      <path d={area} fill={`url(#${gid})`} />
      <path d={line} fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
      <circle cx={last[0]} cy={last[1]} r="2.2" fill="currentColor" />
    </svg>
  );
}

export function BarChart({
  data, height = 190, tone = 'info', format,
}: { data: { label: string; value: number }[]; height?: number; tone?: Tone; format?: (n: number) => string }) {
  if (!data?.length) return null;
  const t = TONE[tone];
  const max = Math.max(...data.map((d) => d.value), 1);
  const gridlines = [0, 0.25, 0.5, 0.75, 1];
  return (
    <div>
      <div style={{ position: 'relative', height, display: 'flex', alignItems: 'flex-end', gap: 10 }}>
        {/* faint baseline grid */}
        <div style={{ position: 'absolute', inset: 0, pointerEvents: 'none' }}>
          {gridlines.map((g) => (
            <div key={g} style={{
              position: 'absolute', left: 0, right: 0, bottom: `${g * 100}%`,
              borderTop: '1px solid var(--hairline-soft)',
            }} />
          ))}
        </div>
        {data.map((d, i) => {
          const isLast = i === data.length - 1;
          return (
            <div key={`${d.label}-${i}`} style={{ flex: 1, display: 'flex', flexDirection: 'column', justifyContent: 'flex-end', height: '100%', position: 'relative', minWidth: 0 }}>
              <div
                title={`${d.label}: ${format ? format(d.value) : d.value}`}
                style={{
                  height: `${Math.max((d.value / max) * 100, d.value > 0 ? 2 : 0)}%`,
                  // Softened rather than fully solid: a young book has one tall bar
                  // beside five empty months, and a solid block reads as a bug.
                  background: isLast ? `color-mix(in srgb, ${t.fg} 72%, transparent)` : t.bg,
                  border: `1px solid ${isLast ? t.fg : t.line}`,
                  borderRadius: '6px 6px 3px 3px',
                  transition: 'height 320ms cubic-bezier(.4,0,.2,1)',
                  // Empty months keep a faint stub so the axis still reads as a series.
                  minHeight: d.value > 0 ? 3 : 2,
                  ...(d.value === 0 ? { background: 'var(--hairline)', border: 'none' } : {}),
                }}
              />
            </div>
          );
        })}
      </div>
      <div style={{ display: 'flex', gap: 10, marginTop: 9 }}>
        {data.map((d, i) => (
          <div key={`${d.label}-l-${i}`} className="ds-caption" style={{ flex: 1, textAlign: 'center', minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {d.label}
          </div>
        ))}
      </div>
    </div>
  );
}

/** Proportional horizontal bars — funnels, status splits, share of book. */
export function BarList({
  items, format,
}: { items: { label: string; value: number; tone?: Tone; meta?: string }[]; format?: (n: number) => string }) {
  const max = Math.max(...items.map((i) => i.value), 1);
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 11 }}>
      {items.map((it, i) => {
        const t = TONE[it.tone ?? 'info'];
        return (
          <div key={`${it.label}-${i}`}>
            <div style={{ display: 'flex', alignItems: 'baseline', gap: 8, marginBottom: 5 }}>
              <span style={{ fontSize: 13, fontWeight: 560, color: 'var(--ink)', minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{it.label}</span>
              <span style={{ marginLeft: 'auto', fontSize: 12.5, fontWeight: 650, color: 'var(--ink)', fontVariantNumeric: 'tabular-nums', flex: 'none' }}>
                {format ? format(it.value) : it.value}
              </span>
              {it.meta && <span className="ds-caption" style={{ flex: 'none' }}>{it.meta}</span>}
            </div>
            <div style={{ height: 7, borderRadius: 4, background: 'var(--surface-2)', overflow: 'hidden' }}>
              <div style={{ width: `${(it.value / max) * 100}%`, height: '100%', background: t.fg, opacity: 0.85, borderRadius: 4, transition: 'width 320ms cubic-bezier(.4,0,.2,1)' }} />
            </div>
          </div>
        );
      })}
    </div>
  );
}

// ============================================================ Empty state

export function EmptyState({
  icon: Icon, title, body, actionLabel, onAction, compact,
}: { icon?: any; title: string; body?: string; actionLabel?: string; onAction?: () => void; compact?: boolean }) {
  return (
    <div style={{
      display: 'flex', flexDirection: 'column', alignItems: 'center', textAlign: 'center',
      padding: compact ? '28px 20px' : '52px 24px', gap: 4,
    }}>
      {Icon && (
        <span style={{
          width: 46, height: 46, borderRadius: 14, display: 'inline-flex', alignItems: 'center',
          justifyContent: 'center', background: 'var(--surface-2)', color: 'var(--ink-3)', marginBottom: 10,
        }}><Icon size={21} /></span>
      )}
      <div className="ds-h2">{title}</div>
      {body && <div className="ds-body" style={{ maxWidth: '42ch' }}>{body}</div>}
      {actionLabel && onAction && (
        <button className="btn-primary" style={{ marginTop: 14 }} onClick={onAction}>{actionLabel}</button>
      )}
    </div>
  );
}

/**
 * The example incident to show in a claim form, for the class of cover it is.
 *
 * A placeholder is a hint about what to write, so a motor example on a health
 * policy hints at the wrong thing — and the person filling it in is usually a
 * customer describing the worst day of their year. Every writable category is
 * covered; anything unrecognised gets a neutral prompt rather than a guess.
 */
export function claimExample(category?: string | null) {
  switch ((category ?? '').toUpperCase()) {
    case 'PRIVATE_CAR':
    case 'COMMERCIAL_VEHICLE':
    case 'MOTOR':
      return 'Rear-end collision on the ring road';
    case 'TWO_WHEELER':
    case 'BIKE':
      return 'Skidded on a wet road, front fairing damaged';
    case 'HEALTH':
      return 'Admitted for three nights with dengue';
    case 'TRAVEL':
      return 'Baggage lost on the connecting flight';
    case 'FIRE':
      return 'Fire in the godown, stock destroyed';
    case 'MARINE':
      return 'Consignment damaged by seawater in transit';
    case 'PROPERTY':
      return 'Roof and ceiling damaged in the storm';
    case 'LIFE':
      return 'Death claim — certificate and nomination attached';
    case 'ACCIDENT':
      return 'Fell at work, fractured wrist';
    case 'BUSINESS':
      return 'Premises shut for eleven days after the flood';
    default:
      return 'What happened, in a sentence';
  }
}

// ============================================================ Timeline

function relativeDay(at: string | Date, dateOnly?: boolean) {
  const d = new Date(at);
  const now = new Date();
  // A date-only value is UTC midnight, so its LOCAL calendar day is a timezone
  // artefact — west of Greenwich it reads as the day before. Group those by the
  // day they actually name, which is the UTC one.
  const dayParts: [number, number, number] = dateOnly
    ? [d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()]
    : [d.getFullYear(), d.getMonth(), d.getDate()];
  const days = Math.floor((new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime()
    - new Date(...dayParts).getTime()) / 86400000);
  if (days <= 0) return 'Today';
  if (days === 1) return 'Yesterday';
  if (days < 7) return `${days} days ago`;
  if (days < 30) return `${Math.floor(days / 7)} week${days < 14 ? '' : 's'} ago`;
  return d.toLocaleDateString(undefined, { day: '2-digit', month: 'short', year: 'numeric' });
}

/**
 * `dateOnly` marks a row whose `at` is a DATE, not an instant.
 *
 * A cover start is a calendar date. Stored as `2026-08-19` it becomes UTC
 * midnight, and printing a clock beside it renders 5:30 AM in IST — a time
 * nothing happened at, and one that would read as the previous evening for a
 * viewer in the Gulf. The row keeps its place on the rail and simply does not
 * claim an hour it never had.
 */
export function Timeline({
  items, dense,
}: {
  items: { at: string | Date; title: string; detail?: string; tone?: Tone; icon?: any; dateOnly?: boolean }[];
  dense?: boolean;
}) {
  if (!items?.length) return null;
  // Group by relative day so the rail reads as a story, not a log.
  const groups: { day: string; rows: typeof items }[] = [];
  for (const it of items) {
    const day = relativeDay(it.at, it.dateOnly);
    const last = groups[groups.length - 1];
    if (last && last.day === day) last.rows.push(it);
    else groups.push({ day, rows: [it] });
  }
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: dense ? 14 : 20 }}>
      {groups.map((g) => (
        <div key={g.day}>
          <div className="ds-caption" style={{ fontWeight: 620, color: 'var(--ink-2)', marginBottom: 9 }}>{g.day}</div>
          <div style={{ display: 'flex', flexDirection: 'column' }}>
            {g.rows.map((it, i) => {
              const t = TONE[it.tone ?? 'neutral'];
              const Icon = it.icon;
              const last = i === g.rows.length - 1;
              return (
                <div key={`${it.title}-${i}`} style={{ display: 'flex', gap: 11, position: 'relative' }}>
                  <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', flex: 'none' }}>
                    <span style={{
                      width: 22, height: 22, borderRadius: '50%', display: 'inline-flex',
                      alignItems: 'center', justifyContent: 'center', background: t.bg, color: t.fg,
                      border: `1px solid ${t.line}`, flex: 'none',
                    }}>
                      {Icon ? <Icon size={11} /> : <span style={{ width: 5, height: 5, borderRadius: '50%', background: 'currentColor' }} />}
                    </span>
                    {!last && <span style={{ flex: 1, width: 1, background: 'var(--hairline)', margin: '3px 0' }} />}
                  </div>
                  <div style={{ paddingBottom: last ? 0 : dense ? 12 : 16, minWidth: 0, flex: 1 }}>
                    <div style={{ display: 'flex', alignItems: 'baseline', gap: 8 }}>
                      <span style={{ fontSize: 13, fontWeight: 560, color: 'var(--ink)' }}>{it.title}</span>
                      <span className="ds-caption" style={{ marginLeft: 'auto', flex: 'none' }}>
                        {it.dateOnly
                          ? new Date(it.at).toLocaleDateString(undefined, { day: '2-digit', month: 'short' })
                          : new Date(it.at).toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' })}
                      </span>
                    </div>
                    {it.detail && <div className="ds-small" style={{ color: 'var(--ink-3)', marginTop: 2 }}>{it.detail}</div>}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      ))}
    </div>
  );
}

// ============================================================ Drawer (slide-over)

export function Drawer({
  open, onClose, title, subtitle, tabs, activeTab, onTab, actions, width = 560, children, counts,
}: {
  open: boolean; onClose: () => void; title: React.ReactNode; subtitle?: React.ReactNode;
  tabs?: string[]; activeTab?: string; onTab?: (t: string) => void; actions?: React.ReactNode;
  width?: number; children: React.ReactNode; counts?: Record<string, number | undefined>;
}) {
  const panelRef = useRef<HTMLDivElement>(null);
  const returnTo = useRef<HTMLElement | null>(null);
  const labelId = useId();
  const narrow = useIsNarrow();

  // Every call site passes onClose as an inline arrow, so its identity changes
  // on every render. Depending on it made this an OPEN/CLOSE effect that re-ran
  // on every keystroke: the cleanup threw focus back to the button that opened
  // the drawer and the timeout then grabbed it for the panel — so you typed one
  // character and had to click the field again. It is held in a ref instead, and
  // the effect keys on `open` alone, which is the thing that actually changed.
  const onCloseRef = useRef(onClose);
  useEffect(() => { onCloseRef.current = onClose; });

  useEffect(() => {
    if (!open) return;
    returnTo.current = document.activeElement as HTMLElement;
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onCloseRef.current(); };
    document.addEventListener('keydown', onKey);
    const id = window.setTimeout(() => panelRef.current?.focus(), 20);
    return () => {
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = prevOverflow;
      window.clearTimeout(id);
      returnTo.current?.focus?.();
    };
  }, [open]);

  if (!open) return null;

  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 80, display: 'flex', justifyContent: 'flex-end' }}>
      <div
        onClick={onClose}
        style={{ position: 'absolute', inset: 0, background: 'rgba(28,22,18,0.32)', backdropFilter: 'blur(1.5px)' }}
      />
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={labelId}
        tabIndex={-1}
        className="ds-drawer-panel"
        style={{
          position: 'relative', width: narrow ? '100%' : width, maxWidth: '100%', height: '100%',
          background: 'var(--surface)', boxShadow: 'var(--e-float)', display: 'flex', flexDirection: 'column',
          outline: 'none', borderLeft: '1px solid var(--hairline)',
        }}
      >
        <div style={{
          padding: '18px 20px 0', borderBottom: tabs?.length ? 'none' : '1px solid var(--hairline)',
          flex: 'none', background: 'var(--surface)',
        }}>
          <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12 }}>
            <div style={{ minWidth: 0, flex: 1 }}>
              <div id={labelId} className="ds-h1" style={{ fontSize: 19 }}>{title}</div>
              {subtitle && <div className="ds-caption" style={{ marginTop: 3 }}>{subtitle}</div>}
            </div>
            {actions}
            <button
              onClick={onClose}
              aria-label="Close"
              className="btn-ghost btn-sm"
              style={{ flex: 'none', width: 30, padding: 0 }}
            ><X size={15} /></button>
          </div>
          {tabs?.length ? (
            <div className="ds-subnav" style={{ marginTop: 14 }}>
              {tabs.map((t) => (
                <button key={t} className="ds-subnav-item" data-active={activeTab === t} onClick={() => onTab?.(t)}>
                  {t}
                  {counts?.[t] != null && <span className="ds-count">{counts[t]}</span>}
                </button>
              ))}
            </div>
          ) : null}
        </div>
        <div style={{ padding: 20, overflowY: 'auto', flex: 1 }}>{children}</div>
      </div>
      <style jsx>{`
        .ds-drawer-panel {
          animation: dsSlideIn 220ms cubic-bezier(0.32, 0.72, 0, 1);
        }
        @keyframes dsSlideIn {
          from { transform: translateX(24px); opacity: 0.4; }
          to { transform: none; opacity: 1; }
        }
        @media (prefers-reduced-motion: reduce) {
          .ds-drawer-panel { animation: none; }
        }
      `}</style>
    </div>
  );
}

// ============================================================ Modal

/**
 * A centred dialog, for work that is too wide to read down a 560px drawer.
 *
 * The drawer is the right shape for inspecting ONE record — it slides in beside
 * the list you came from and keeps it in view. It is the wrong shape for
 * comparing several, which is what building a quote is: three plans side by
 * side need horizontal room, and in a drawer they stack into a column where
 * nothing lines up with anything.
 *
 * Behaviour is deliberately identical to Drawer — escape to close, scroll lock,
 * focus moved in and handed back on close, `onClose` held in a ref so an inline
 * arrow at the call site does not re-run the effect on every keystroke. That
 * bug cost a character-at-a-time typing experience once already; it is not
 * worth rediscovering in a second component.
 */
export function Modal({
  open, onClose, title, subtitle, footer, width = 1000, children,
}: {
  open: boolean; onClose: () => void; title: React.ReactNode; subtitle?: React.ReactNode;
  footer?: React.ReactNode; width?: number; children: React.ReactNode;
}) {
  const panelRef = useRef<HTMLDivElement>(null);
  const returnTo = useRef<HTMLElement | null>(null);
  const labelId = useId();
  const narrow = useIsNarrow();

  const onCloseRef = useRef(onClose);
  useEffect(() => { onCloseRef.current = onClose; });

  useEffect(() => {
    if (!open) return;
    returnTo.current = document.activeElement as HTMLElement;
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onCloseRef.current(); };
    document.addEventListener('keydown', onKey);
    const id = window.setTimeout(() => panelRef.current?.focus(), 20);
    return () => {
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = prevOverflow;
      window.clearTimeout(id);
      returnTo.current?.focus?.();
    };
  }, [open]);

  if (!open) return null;

  return (
    <div style={{
      position: 'fixed', inset: 0, zIndex: 80,
      display: 'flex', alignItems: narrow ? 'stretch' : 'center', justifyContent: 'center',
      padding: narrow ? 0 : 24,
    }}>
      <div
        onClick={onClose}
        style={{ position: 'absolute', inset: 0, background: 'rgba(28,22,18,0.32)', backdropFilter: 'blur(1.5px)' }}
      />
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={labelId}
        tabIndex={-1}
        className="ds-modal-panel"
        style={{
          position: 'relative', width: narrow ? '100%' : width, maxWidth: '100%',
          maxHeight: narrow ? '100%' : 'calc(100vh - 48px)',
          background: 'var(--surface)', boxShadow: 'var(--e-float)',
          display: 'flex', flexDirection: 'column', outline: 'none',
          border: '1px solid var(--hairline)', borderRadius: narrow ? 0 : 'var(--r-lg, 12px)',
        }}
      >
        <div style={{ padding: '18px 22px 14px', borderBottom: '1px solid var(--hairline)', flex: 'none' }}>
          <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12 }}>
            <div style={{ minWidth: 0, flex: 1 }}>
              <div id={labelId} className="ds-h1" style={{ fontSize: 19 }}>{title}</div>
              {subtitle && <div className="ds-caption" style={{ marginTop: 3 }}>{subtitle}</div>}
            </div>
            <button
              onClick={onClose}
              aria-label="Close"
              className="btn-ghost btn-sm"
              style={{ flex: 'none', width: 30, padding: 0 }}
            ><X size={15} /></button>
          </div>
        </div>
        <div style={{ padding: 22, overflowY: 'auto', flex: 1 }}>{children}</div>
        {footer && (
          <div style={{
            padding: '14px 22px', borderTop: '1px solid var(--hairline)', flex: 'none',
            display: 'flex', alignItems: 'center', gap: 10, background: 'var(--surface)',
          }}>{footer}</div>
        )}
      </div>
      <style jsx>{`
        .ds-modal-panel { animation: dsModalIn 200ms cubic-bezier(0.32, 0.72, 0, 1); }
        @keyframes dsModalIn {
          from { transform: translateY(12px) scale(0.99); opacity: 0.5; }
          to { transform: none; opacity: 1; }
        }
        @media (prefers-reduced-motion: reduce) {
          .ds-modal-panel { animation: none; }
        }
      `}</style>
    </div>
  );
}

// ============================================================ Stepper

export function Stepper({ steps, current }: { steps: string[]; current: number }) {
  return (
    <div style={{ display: 'flex', alignItems: 'flex-start' }}>
      {steps.map((s, i) => {
        const done = i < current;
        const now = i === current;
        const fg = done || now ? 'var(--tone-active)' : 'var(--ink-3)';
        return (
          <div key={s} style={{ flex: i === steps.length - 1 ? '0 0 auto' : 1, display: 'flex', alignItems: 'flex-start', minWidth: 0 }}>
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6, flex: 'none', width: 74 }}>
              <span style={{
                width: 22, height: 22, borderRadius: '50%', display: 'inline-flex', alignItems: 'center',
                justifyContent: 'center', fontSize: 11, fontWeight: 700,
                background: done ? 'var(--tone-active)' : now ? 'var(--tone-active-bg)' : 'var(--surface-2)',
                color: done ? '#fff' : fg,
                border: now ? '2px solid var(--tone-active)' : '1px solid var(--hairline)',
              }}>
                {done ? <Check size={12} /> : i + 1}
              </span>
              <span style={{
                fontSize: 10.5, fontWeight: now ? 650 : 520, color: now ? 'var(--ink)' : 'var(--ink-3)',
                textAlign: 'center', lineHeight: 1.25,
              }}>{s}</span>
            </div>
            {i < steps.length - 1 && (
              <span style={{ flex: 1, height: 1, background: done ? 'var(--tone-active)' : 'var(--hairline)', marginTop: 11, minWidth: 8 }} />
            )}
          </div>
        );
      })}
    </div>
  );
}

// ============================================================ Quick actions

export function QuickActions({ actions }: { actions: { icon?: any; label: string; onClick: () => void; tone?: Tone }[] }) {
  return (
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(155px,1fr))', gap: 10 }}>
      {actions.map((a) => {
        const t = TONE[a.tone ?? 'info'];
        const Icon = a.icon;
        return (
          <button
            key={a.label}
            onClick={a.onClick}
            className="ds-card ds-card-interactive"
            style={{
              display: 'flex', alignItems: 'center', gap: 10, padding: '13px 14px',
              textAlign: 'left', font: 'inherit',
            }}
          >
            {Icon && (
              <span style={{
                width: 28, height: 28, borderRadius: 8, display: 'inline-flex', alignItems: 'center',
                justifyContent: 'center', background: t.bg, color: t.fg, flex: 'none',
              }}><Icon size={15} /></span>
            )}
            <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--ink)' }}>{a.label}</span>
          </button>
        );
      })}
    </div>
  );
}

// ============================================================ Segmented control

export function Segmented({ options, value, onChange }: { options: string[]; value: string; onChange: (v: string) => void }) {
  return (
    <div style={{
      display: 'inline-flex', padding: 2, gap: 2, background: 'var(--surface-2)',
      borderRadius: 'var(--r-control)', border: '1px solid var(--hairline-soft)',
    }}>
      {options.map((o) => {
        const on = o === value;
        return (
          <button
            key={o}
            onClick={() => onChange(o)}
            style={{
              padding: '5px 11px', borderRadius: 7, border: 0, cursor: 'pointer',
              fontSize: 12.5, fontWeight: on ? 650 : 540,
              background: on ? 'var(--surface)' : 'transparent',
              color: on ? 'var(--ink)' : 'var(--ink-3)',
              boxShadow: on ? 'var(--e-hover)' : 'none',
              transition: 'background 140ms ease, color 140ms ease',
            }}
          >{o}</button>
        );
      })}
    </div>
  );
}

// ============================================================ Forms

export function FormSection({ title, description, children }: { title: string; description?: string; children: React.ReactNode }) {
  return (
    <section style={{ marginBottom: 26 }}>
      <div style={{ marginBottom: 14 }}>
        <h3 className="ds-h3">{title}</h3>
        {description && <p className="ds-caption" style={{ marginTop: 3, marginBottom: 0 }}>{description}</p>}
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(210px,1fr))', gap: 14 }}>
        {children}
      </div>
    </section>
  );
}

/**
 * A labelled form control.
 *
 * The label is ATTACHED to the control, which it previously was not: no
 * htmlFor, and the input a sibling rather than a child. A label in that state
 * is decoration. Clicking it moves focus nowhere, so the next keystroke lands
 * in whichever field was focused before — you click "Sum insured", type, and
 * the digits silently append to "Premium". Screen readers get nothing either.
 *
 * The id is generated here and cloned onto the child, so all 70-odd call sites
 * stay unchanged. A child that already carries an id keeps it.
 */
export function Field({
  label, hint, required, span = 1, children,
}: { label: string; hint?: string; required?: boolean; span?: 1 | 2; children: React.ReactNode }) {
  const generatedId = useId();
  const hintId = `${generatedId}-hint`;

  // React.Children.only throws on anything but a single element, so the count
  // is checked first — a Field wrapping two controls (a radio group, say) has
  // no single thing to point at and is left alone rather than mislabelled.
  const single =
    React.Children.count(children) === 1 ? (React.Children.only(children) as React.ReactNode) : null;
  const element = React.isValidElement(single) ? (single as React.ReactElement<any>) : null;

  const controlId: string | undefined = element ? (element.props.id ?? generatedId) : undefined;
  const control = element
    ? React.cloneElement(element, {
        id: controlId,
        'aria-describedby': hint ? [element.props['aria-describedby'], hintId].filter(Boolean).join(' ') : element.props['aria-describedby'],
      })
    : children;

  return (
    <div style={{ gridColumn: span === 2 ? '1 / -1' : undefined, minWidth: 0 }}>
      <label className="label" htmlFor={controlId}>
        {label}
        {required && <span style={{ color: 'var(--tone-expired)', marginLeft: 3 }}>*</span>}
      </label>
      {control}
      {hint && <div className="ds-caption" id={hintId} style={{ marginTop: 5 }}>{hint}</div>}
    </div>
  );
}

/** Loading placeholder — a screen that renders nothing while fetching is a defect. */
export function Skeleton({ rows = 3, height = 62 }: { rows?: number; height?: number }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
      {Array.from({ length: rows }).map((_, i) => (
        <div key={i} className="ds-skel" style={{ height, borderRadius: 'var(--r-card)', background: 'var(--surface-2)' }} />
      ))}
      <style jsx>{`
        .ds-skel { animation: dsPulse 1.4s ease-in-out infinite; }
        @keyframes dsPulse { 0%,100% { opacity: 1 } 50% { opacity: 0.55 } }
        @media (prefers-reduced-motion: reduce) { .ds-skel { animation: none } }
      `}</style>
    </div>
  );
}

// ============================================================ Data table

export interface DataTableColumn<T> {
  key: string;
  header: string;
  width?: number;
  align?: 'left' | 'right';
  render?: (row: T) => React.ReactNode;
  sortable?: boolean;
}

type SortState = { key: string; dir: 'asc' | 'desc' } | null;

/**
 * Ordering for values we did not author: numbers numerically, ISO dates
 * chronologically, everything else naturally — and empties always last,
 * because a blank column floating to the top reads as a bug.
 */
function compareValues(a: unknown, b: unknown): number {
  const aEmpty = a == null || a === '';
  const bEmpty = b == null || b === '';
  if (aEmpty && bEmpty) return 0;
  if (aEmpty) return 1;
  if (bEmpty) return -1;
  if (a instanceof Date && b instanceof Date) return a.getTime() - b.getTime();
  if (typeof a === 'number' && typeof b === 'number') return a - b;
  if (typeof a === 'boolean' && typeof b === 'boolean') return (a ? 1 : 0) - (b ? 1 : 0);

  const as = String(a);
  const bs = String(b);
  const an = Number(as);
  const bn = Number(bs);
  if (Number.isFinite(an) && Number.isFinite(bn)) return an - bn;

  const iso = /^\d{4}-\d{2}-\d{2}([T ]|$)/;
  if (iso.test(as) && iso.test(bs)) return Date.parse(as) - Date.parse(bs);

  return as.localeCompare(bs, undefined, { numeric: true, sensitivity: 'base' });
}

/**
 * The table for genuinely tabular data. Sticky header, sortable columns
 * (client-side, tri-state), hoverable and keyboard-activatable rows, and its
 * own horizontal scroll so the page body never scrolls sideways.
 */
export function DataTable<T>({
  rows, columns, rowKey, onRowClick, empty, loading, dense,
}: {
  rows: T[];
  columns: DataTableColumn<T>[];
  rowKey: (row: T) => string;
  onRowClick?: (row: T) => void;
  empty?: React.ReactNode;
  loading?: boolean;
  dense?: boolean;
}) {
  const [sort, setSort] = useState<SortState>(null);

  // Tri-state: asc → desc → unsorted, so a user can always get back to the
  // order the server sent without reloading the screen.
  const cycle = useCallback((key: string) => {
    setSort((s) => {
      if (!s || s.key !== key) return { key, dir: 'asc' };
      if (s.dir === 'asc') return { key, dir: 'desc' };
      return null;
    });
  }, []);

  const sorted = React.useMemo(() => {
    if (!sort) return rows;
    const dir = sort.dir === 'asc' ? 1 : -1;
    return [...rows].sort(
      (a, b) => compareValues((a as any)?.[sort.key], (b as any)?.[sort.key]) * dir,
    );
  }, [rows, sort]);

  const tableClass = ['ds-table', 'ds-table-sticky', dense ? 'ds-table-dense' : ''].filter(Boolean).join(' ');

  return (
    <div className="ds-scroll-x ds-table-wrap">
      <table className={tableClass}>
        {columns.some((c) => c.width) && (
          <colgroup>
            {columns.map((c) => (
              <col key={c.key} style={c.width ? { width: c.width } : undefined} />
            ))}
          </colgroup>
        )}
        <thead>
          <tr>
            {columns.map((c) => {
              const isSorted = sort?.key === c.key;
              const num = c.align === 'right';
              return (
                <th key={c.key} className={num ? 'ds-col-num' : undefined} scope="col"
                  aria-sort={isSorted ? (sort!.dir === 'asc' ? 'ascending' : 'descending') : c.sortable ? 'none' : undefined}
                >
                  {c.sortable ? (
                    <button type="button" className="ds-th-sort" data-sorted={isSorted} onClick={() => cycle(c.key)}>
                      {c.header}
                      <span className="ds-sort-caret" aria-hidden="true">
                        {isSorted && sort!.dir === 'desc' ? <ArrowDown size={11} /> : <ArrowUp size={11} />}
                      </span>
                    </button>
                  ) : c.header}
                </th>
              );
            })}
          </tr>
        </thead>
        <tbody>
          {loading ? (
            <tr>
              <td colSpan={columns.length} style={{ padding: '14px 0', borderBottom: 0 }}>
                <Skeleton rows={dense ? 6 : 4} height={dense ? 26 : 40} />
              </td>
            </tr>
          ) : sorted.length === 0 ? (
            <tr>
              <td colSpan={columns.length} className="ds-table-empty" style={{ borderBottom: 0 }}>
                {empty ?? 'Nothing to show yet.'}
              </td>
            </tr>
          ) : (
            sorted.map((row) => (
              <tr
                key={rowKey(row)}
                className={onRowClick ? 'ds-row-click' : undefined}
                tabIndex={onRowClick ? 0 : undefined}
                onClick={onRowClick ? () => onRowClick(row) : undefined}
                onKeyDown={onRowClick ? (e) => {
                  if (e.key === 'Enter') { e.preventDefault(); onRowClick(row); }
                } : undefined}
              >
                {columns.map((c) => (
                  <td key={c.key} className={c.align === 'right' ? 'ds-col-num' : undefined}>
                    {c.render ? c.render(row) : (((row as any)?.[c.key] ?? '') as React.ReactNode)}
                  </td>
                ))}
              </tr>
            ))
          )}
        </tbody>
      </table>
    </div>
  );
}

// ============================================================ Filter chips

/**
 * Multi-select chips instead of stacked dropdowns: every option and its count
 * is visible at rest, which is the whole point on a queue screen. Selected
 * chips take the option's tone, and "Clear all" only exists once there is
 * something to clear.
 */
export function FilterChips({
  groups, value, onChange, onClear,
}: {
  groups: { key: string; label: string; options: { value: string; label: string; count?: number; tone?: Tone }[] }[];
  value: Record<string, string[]>;
  onChange: (next: Record<string, string[]>) => void;
  onClear?: () => void;
}) {
  const selectedCount = Object.values(value ?? {}).reduce((n, v) => n + (v?.length ?? 0), 0);

  const toggle = (groupKey: string, option: string) => {
    const current = value?.[groupKey] ?? [];
    const next = current.includes(option) ? current.filter((v) => v !== option) : [...current, option];
    const out: Record<string, string[]> = { ...(value ?? {}) };
    // An empty array left behind makes callers write `?.length` everywhere.
    if (next.length) out[groupKey] = next;
    else delete out[groupKey];
    onChange(out);
  };

  return (
    <div className="ds-chips">
      {groups.map((g) => (
        <div key={g.key} className="ds-chip-group" role="group" aria-label={g.label}>
          {g.label && <span className="ds-chip-group-label">{g.label}</span>}
          {g.options.map((o) => {
            const on = (value?.[g.key] ?? []).includes(o.value);
            const cls = ['ds-chip', on ? `ds-tone-${o.tone ?? 'info'}` : ''].filter(Boolean).join(' ');
            return (
              <button
                key={o.value}
                type="button"
                className={cls}
                aria-pressed={on}
                onClick={() => toggle(g.key, o.value)}
              >
                {o.label}
                {o.count != null && <span className="ds-chip-count">{o.count}</span>}
              </button>
            );
          })}
        </div>
      ))}

      {selectedCount > 0 && (
        <button
          type="button"
          className="ds-chip-clear"
          onClick={() => (onClear ? onClear() : onChange({}))}
        >
          <X size={12} />
          Clear all
        </button>
      )}
    </div>
  );
}
