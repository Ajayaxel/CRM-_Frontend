'use client';

/**
 * Insurance — the Renewal Centre.
 *
 * A broker does not think in kanban columns, they think in deadlines: what has
 * to be closed today, what lands this week, what is already lost. So the primary
 * navigation here is a rail of time buckets computed from each policy's expiry
 * date, and the stage board survives as one view among them ("Pipeline").
 *
 * Every bucket is cumulative by deadline — the 7-day view contains the due-today
 * work, the 30-day view contains all of it — because that is how a workload is
 * actually planned. The caption under the rail states the rule for the bucket on
 * screen rather than leaving the broker to guess at the arithmetic.
 *
 * Endpoints and react-query keys are the ones the live console already uses
 * (`['ins-policies']`), so this screen shares a cache with the policy book and
 * the dashboard, and invalidations cross correctly.
 */

import React, { Suspense, useEffect, useMemo, useRef, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import Link from 'next/link';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { toast } from 'sonner';
import {
  AlertTriangle, Ban, CalendarCheck, CalendarClock, CalendarDays, Check,
  FileText, KanbanSquare, RefreshCw,
} from 'lucide-react';
import { api, apiErrorMessage } from '@/lib/api';
import { fmtOrgMoney, orgLocale } from '@/lib/org-locale';
import {
  Badge, BarList, Card, Drawer, EmptyState, Skeleton, StatCard, Toolbar,
  humanStatus, toneForPolicyStatus, type Tone,
} from '../ui/kit';

// ============================================================ domain

interface Policy {
  id: string;
  policyNo: string;
  companyName: string;
  productName: string;
  category: string;
  premiumInr: number;
  sumInsuredInr: number;
  startDate: string;
  endDate: string;
  graceDays?: number;
  status: string;
  renewalStage?: string | null;
  executiveName?: string | null;
  remindersSent?: unknown;
  renewedFromId?: string | null;
  createdAt?: string;
  updatedAt?: string;
  client?: { name?: string; phone?: string | null } | null;
  commission?: { netInr?: number; status?: string } | null;
}

const money = (n?: number | null) => fmtOrgMoney(n);

const DAY = 86_400_000;

/** Whole days from today to expiry; negative once the cover has run out. */
const daysToExpiry = (p: Policy) => Math.ceil((+new Date(p.endDate) - Date.now()) / DAY);

/** The window in which a renewal conversation should already be happening. */
const RENEWAL_WINDOW_DAYS = 45;

function fmtDate(d?: string | Date | null) {
  if (!d) return '—';
  return new Date(d).toLocaleDateString(orgLocale().locale || undefined, {
    day: '2-digit', month: 'short', year: 'numeric',
  });
}

/** "expired past due, renewal inside 15 days" — the only colour on a resting row. */
function daysTone(days: number): Tone {
  if (days < 0) return 'expired';
  if (days <= 15) return 'renewal';
  return 'neutral';
}

function daysLabel(days: number) {
  if (days < 0) return `${Math.abs(days)}d overdue`;
  if (days === 0) return 'due today';
  return `${days}d left`;
}

const STAGES = [
  { key: 'DUE', label: 'Due', tone: 'renewal' as Tone },
  { key: 'CONTACTED', label: 'Contacted', tone: 'sales' as Tone },
  { key: 'QUOTED', label: 'Quoted', tone: 'claim' as Tone },
  { key: 'RENEWED', label: 'Renewed', tone: 'active' as Tone },
  { key: 'LAPSED', label: 'Lapsed', tone: 'expired' as Tone },
];

const stageLabel = (k?: string | null) => STAGES.find((s) => s.key === k)?.label ?? (k ? humanStatus(k) : 'Not staged');
const stageTone = (k?: string | null): Tone => STAGES.find((s) => s.key === k)?.tone ?? 'neutral';

/** The reminder offsets the sweep has already sent for this policy. */
function remindersOf(p: Policy): number[] {
  const raw = p.remindersSent;
  if (!Array.isArray(raw)) return [];
  return raw.map(Number).filter((n) => Number.isFinite(n)).sort((a, b) => b - a);
}

const inThisMonth = (d?: string | Date | null) => {
  if (!d) return false;
  const x = new Date(d);
  const now = new Date();
  return x.getFullYear() === now.getFullYear() && x.getMonth() === now.getMonth();
};

const thisMonthName = () =>
  new Date().toLocaleDateString(orgLocale().locale || undefined, { month: 'long' });

// ============================================================ buckets

type ViewKey = 'today' | 'd15' | 'd30' | 'd45' | 'd60' | 'lost' | 'renewed' | 'pipeline';

const VIEWS: { key: ViewKey; label: string; rule: string }[] = [
  {
    key: 'today',
    label: 'Due today',
    rule: 'Active cover whose expiry date is today or already behind us — including anything still inside its grace period.',
  },
  {
    key: 'd15',
    label: '15 days',
    rule: 'Active cover expiring within 15 days, overdue included — the last window in which a quote can comfortably be placed.',
  },
  {
    key: 'd30',
    label: '30 days',
    rule: 'Active cover expiring within 30 days, overdue included — the full month of renewal work ahead.',
  },
  {
    key: 'd45',
    label: '45 days',
    rule: 'Active cover expiring within 45 days, overdue included — far enough out to re-quote the market rather than simply re-place.',
  },
  {
    key: 'd60',
    label: '60 days',
    rule: 'Active cover expiring within 60 days, overdue included — the full runway, and where a renewal conversation should start.',
  },
  {
    key: 'lost',
    label: 'Lost',
    rule: 'Cover marked lapsed, plus policies that expired without a successor policy ever being written.',
  },
  {
    key: 'renewed',
    label: 'Renewed',
    rule: `Renewals closed this month (${thisMonthName()}) — counted once per renewal, on the policy that carries the new term.`,
  },
  {
    key: 'pipeline',
    label: 'Pipeline',
    rule: 'The same book arranged by renewal stage. Drag a card, or use “Move to” — both write the stage back.',
  },
];

const isViewKey = (v: string | null | undefined): v is ViewKey =>
  !!v && VIEWS.some((x) => x.key === v);

interface Buckets {
  today: Policy[];
  d15: Policy[];
  d30: Policy[];
  d45: Policy[];
  d60: Policy[];
  lost: Policy[];
  renewed: Policy[];
  /** Days until the soonest active expiry still ahead of us — for empty-state copy. */
  nextDueInDays: number | null;
}

/**
 * The honest definitions, in one place:
 *
 *   Due today  — ACTIVE and daysLeft <= 0 (expiry reached; grace may still be running)
 *   15/30/45/60 — ACTIVE and daysLeft <= N (cumulative: each window contains the tighter ones)
 *   Lost       — LAPSED, or EXPIRED with no other policy chained back to it
 *   Renewed    — this month's renewals, keyed on the successor policy so one renewal
 *                (which writes a new policy AND flips the old one to RENEWED) counts once
 */
function bucketize(rows: Policy[]): Buckets {
  const successorOf = new Set(rows.map((p) => p.renewedFromId).filter(Boolean) as string[]);

  const byExpiry = (a: Policy, b: Policy) => +new Date(a.endDate) - +new Date(b.endDate);

  const active = rows.filter((p) => p.status === 'ACTIVE');
  const withDays = active.map((p) => ({ p, d: daysToExpiry(p) }));

  const upcoming = withDays.filter((x) => x.d > 0).map((x) => x.d).sort((a, b) => a - b);

  const lost = rows
    .filter((p) => p.status === 'LAPSED' || (p.status === 'EXPIRED' && !successorOf.has(p.id)))
    .sort((a, b) => +new Date(b.endDate) - +new Date(a.endDate));

  // A renewal writes a successor policy and flips its predecessor to RENEWED.
  // Count the successor where we have it, and fall back to the predecessor only
  // when its successor is outside the page we loaded — never both.
  const renewalDate = (p: Policy) => (p.renewedFromId ? p.createdAt : p.updatedAt);
  const renewed = rows
    .filter((p) => (p.renewedFromId ? true : p.status === 'RENEWED' && !successorOf.has(p.id)))
    .filter((p) => inThisMonth(renewalDate(p)))
    .sort((a, b) => +new Date(renewalDate(b) ?? 0) - +new Date(renewalDate(a) ?? 0));

  const within = (n: number) => withDays.filter((x) => x.d <= n).map((x) => x.p).sort(byExpiry);

  return {
    today: within(0),
    d15: within(15),
    d30: within(30),
    d45: within(45),
    d60: within(60),
    lost,
    renewed,
    nextDueInDays: upcoming.length ? upcoming[0] : null,
  };
}

/** A policy belongs on the stage board when it is staged, or expiry is close. */
function stageOf(p: Policy): string | null {
  if (p.renewalStage) return STAGES.some((s) => s.key === p.renewalStage) ? p.renewalStage : 'DUE';
  if (p.status === 'LAPSED') return 'LAPSED';
  if (p.status === 'ACTIVE' && daysToExpiry(p) <= RENEWAL_WINDOW_DAYS) return 'DUE';
  return null;
}

// ============================================================ data + actions

function usePolicies() {
  return useQuery({
    queryKey: ['ins-policies'],
    queryFn: async () => (await api.get<Policy[]>('/insurance/policies')).data,
  });
}

/** Renew, restage and sweep — the three writes this workspace owns. */
function useRenewalActions() {
  const qc = useQueryClient();

  const renew = useMutation({
    mutationFn: (id: string) => api.post(`/insurance/policies/${id}/renew`, {}),
    onSuccess: (r: any) => {
      toast.success(`Renewed as ${r.data.policyNo} — commission accrued`);
      qc.invalidateQueries({ queryKey: ['ins-policies'] });
      qc.invalidateQueries({ queryKey: ['ins-dash'] });
      qc.invalidateQueries({ queryKey: ['ins-analytics'] });
    },
    onError: (e) => toast.error(apiErrorMessage(e)),
  });

  const move = useMutation({
    mutationFn: (v: { id: string; stage: string }) =>
      api.patch(`/insurance/policies/${v.id}/renewal-stage`, { stage: v.stage }),
    onMutate: async (v) => {
      await qc.cancelQueries({ queryKey: ['ins-policies'] });
      const prev = qc.getQueryData<Policy[]>(['ins-policies']);
      if (prev) {
        qc.setQueryData<Policy[]>(['ins-policies'], prev.map((p) => (p.id === v.id ? { ...p, renewalStage: v.stage } : p)));
      }
      return { prev };
    },
    onError: (e, _v, ctx) => {
      if (ctx?.prev) qc.setQueryData(['ins-policies'], ctx.prev);
      toast.error(apiErrorMessage(e));
    },
    onSuccess: (_r, v) => { toast.success(`Moved to ${stageLabel(v.stage)}`); },
    onSettled: () => { qc.invalidateQueries({ queryKey: ['ins-policies'] }); },
  });

  const sweep = useMutation({
    mutationFn: () => api.post('/insurance/renewal-sweep', {}),
    onSuccess: (r: any) => {
      toast.success(`Sweep: ${r.data.reminded} reminded · ${r.data.lapsed} lapsed`);
      qc.invalidateQueries({ queryKey: ['ins-policies'] });
      qc.invalidateQueries({ queryKey: ['ins-dash'] });
    },
    onError: (e) => toast.error(apiErrorMessage(e)),
  });

  return { renew, move, sweep };
}

// ============================================================ small pieces

/**
 * A bucket headline: the count leads (it is the workload), the premium it
 * represents follows in caption type so the money never shouts over the work.
 */
function BucketStat({
  label, count, amount, tone, icon, onClick,
}: { label: string; count: number; amount: number; tone: Tone; icon: any; onClick: () => void }) {
  return (
    <StatCard
      label={label}
      tone={tone}
      icon={icon}
      onClick={onClick}
      value={(
        <span>
          {count}
          <span className="ds-caption" style={{ marginLeft: 'var(--s-2)' }}>{money(amount)}</span>
        </span>
      )}
    />
  );
}

/** What the customer has already been sent: the sweep stamps 30/15/7/1. */
function ReminderChips({ policy }: { policy: Policy }) {
  const sent = remindersOf(policy);
  if (!sent.length) return <span className="ds-caption">None sent</span>;
  return (
    <span style={{ display: 'inline-flex', gap: 'var(--s-1)', flexWrap: 'wrap' }}>
      {sent.map((o) => (
        <Badge key={o} tone="info" dot={false}>
          <Check size={11} /> {o}d
        </Badge>
      ))}
    </span>
  );
}

/** Keyboard/click path for restaging — a drag alone is not an interface. */
function StageMenu({ current, onMove, busy }: { current: string; onMove: (stage: string) => void; busy: boolean }) {
  const [open, setOpen] = useState(false);
  const wrap = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onDoc = (e: MouseEvent) => { if (!wrap.current?.contains(e.target as Node)) setOpen(false); };
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setOpen(false); };
    document.addEventListener('mousedown', onDoc);
    document.addEventListener('keydown', onKey);
    return () => { document.removeEventListener('mousedown', onDoc); document.removeEventListener('keydown', onKey); };
  }, [open]);

  return (
    <div ref={wrap} style={{ position: 'relative' }}>
      <button
        className="btn-ghost btn-sm"
        aria-haspopup="menu"
        aria-expanded={open}
        disabled={busy}
        onClick={() => setOpen((o) => !o)}
      >
        Move to
      </button>
      {open && (
        <div
          role="menu"
          className="ds-panel"
          style={{ position: 'absolute', right: 0, top: 'calc(100% + 4px)', zIndex: 20, padding: 'var(--s-1)', minWidth: 150 }}
        >
          {STAGES.filter((s) => s.key !== current).map((s) => (
            <button
              key={s.key}
              role="menuitem"
              className="btn-ghost btn-sm"
              style={{ width: '100%', justifyContent: 'flex-start' }}
              onClick={() => { setOpen(false); onMove(s.key); }}
            >
              <span className={`ds-dot ds-fg-${s.tone}`} /> {s.label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

// ============================================================ bucket rows

const canRenew = (p: Policy) => p.status === 'ACTIVE' || p.status === 'LAPSED';

/** An un-converted RENEWAL quote — while one is open it IS the renewal path. */
export type OpenRenewalQuote = { id: string; reference: string };

/**
 * The two ways to renew, honest about the one-path rule: while a renewal
 * quote is open, both buttons give way to a link to it — issuing or losing
 * the quote is the only way forward, and the server refuses everything else.
 */
function RenewalActions({
  policy, openQuote, onRenew, onCreateQuote, busy,
}: {
  policy: Policy; openQuote: OpenRenewalQuote | null;
  onRenew: () => void; onCreateQuote: () => void; busy: boolean;
}) {
  if (openQuote) {
    return (
      <Link
        className="btn-ghost btn-sm"
        href="/insurance/quotes"
        style={{ textDecoration: 'none', whiteSpace: 'nowrap' }}
        title={`Renewal quote ${openQuote.reference} is open — issue it or mark it lost`}
      >
        <FileText size={13} /> Quote {openQuote.reference} open
      </Link>
    );
  }
  if (!canRenew(policy)) return null;
  return (
    <>
      <button className="btn-secondary btn-sm" disabled={busy} onClick={onRenew}>
        <RefreshCw size={13} /> Renew
      </button>
      <button
        className="btn-ghost btn-sm"
        disabled={busy}
        title="Open a pre-filled quote to re-shop this renewal"
        onClick={onCreateQuote}
      >
        <FileText size={13} /> Quote
      </button>
    </>
  );
}

function RenewalRows({
  rows, onOpen, onRenew, onStage, busy, openQuoteOf, onCreateQuote,
}: {
  rows: Policy[];
  onOpen: (p: Policy) => void;
  onRenew: (p: Policy) => void;
  onStage: (p: Policy, stage: string) => void;
  busy: boolean;
  openQuoteOf: (p: Policy) => OpenRenewalQuote | null;
  onCreateQuote: (p: Policy) => void;
}) {
  return (
    <Card>
      <div className="ds-scroll-x">
        <table className="ds-table">
          <thead>
            <tr>
              <th>Client</th>
              <th>Expiry</th>
              <th>Reminders sent</th>
              <th className="ds-col-num">Premium</th>
              <th>Stage</th>
              <th aria-label="Actions" />
            </tr>
          </thead>
          <tbody>
            {rows.map((p) => {
              const days = daysToExpiry(p);
              return (
                <tr
                  key={p.id}
                  tabIndex={0}
                  style={{ cursor: 'pointer' }}
                  onClick={() => onOpen(p)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && e.target === e.currentTarget) { e.preventDefault(); onOpen(p); }
                  }}
                >
                  <td>
                    <div className="ds-h3" style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: 260 }}>
                      {p.client?.name ?? 'Unnamed client'}
                    </div>
                    <div className="ds-caption" style={{ marginTop: 2, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: 260 }}>
                      {p.productName} · {p.companyName}
                    </div>
                    <div className="ds-caption ds-num" style={{ marginTop: 2 }}>{p.policyNo}</div>
                  </td>
                  <td>
                    <div className="ds-small" style={{ whiteSpace: 'nowrap' }}>{fmtDate(p.endDate)}</div>
                    <div style={{ marginTop: 'var(--s-1)' }}>
                      <Badge tone={daysTone(days)}>{daysLabel(days)}</Badge>
                    </div>
                  </td>
                  <td><ReminderChips policy={p} /></td>
                  <td className="ds-col-num" style={{ whiteSpace: 'nowrap', fontWeight: 620 }}>{money(p.premiumInr)}</td>
                  <td>
                    <Badge tone={stageTone(p.renewalStage)} dot={!!p.renewalStage}>
                      {stageLabel(p.renewalStage)}
                    </Badge>
                  </td>
                  <td onClick={(e) => e.stopPropagation()}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--s-2)', justifyContent: 'flex-end' }}>
                      <RenewalActions
                        policy={p}
                        openQuote={openQuoteOf(p)}
                        onRenew={() => onRenew(p)}
                        onCreateQuote={() => onCreateQuote(p)}
                        busy={busy}
                      />
                      <select
                        className="input"
                        aria-label={`Renewal stage for ${p.policyNo}`}
                        style={{ width: 142 }}
                        value={p.renewalStage ?? ''}
                        disabled={busy}
                        onChange={(e) => { if (e.target.value) onStage(p, e.target.value); }}
                      >
                        <option value="" disabled>Set stage…</option>
                        {STAGES.map((s) => <option key={s.key} value={s.key}>{s.label}</option>)}
                      </select>
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </Card>
  );
}

// ============================================================ pipeline board

function RenewalCard({
  policy, stage, onMove, onOpen, busy, dragging, onDragStart, onDragEnd,
}: {
  policy: Policy; stage: string; onMove: (s: string) => void; onOpen: () => void; busy: boolean;
  dragging: boolean; onDragStart: () => void; onDragEnd: () => void;
}) {
  const days = daysToExpiry(policy);
  return (
    // Native HTML5 drag needs its props on the element itself, so this card is
    // the ds-card class rather than the kit <Card>.
    <div
      className="ds-card ds-card-interactive"
      draggable
      onClick={onOpen}
      onDragStart={(e) => { e.dataTransfer.effectAllowed = 'move'; e.dataTransfer.setData('text/plain', policy.id); onDragStart(); }}
      onDragEnd={onDragEnd}
      style={{ padding: 'var(--s-3)', cursor: 'grab', opacity: dragging ? 0.45 : 1 }}
    >
      <div className="ds-h3" style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
        {policy.client?.name ?? 'Unnamed client'}
      </div>
      <div className="ds-caption" style={{ marginTop: 2, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
        {policy.productName} · {policy.companyName}
      </div>
      <div className="ds-caption ds-num" style={{ marginTop: 'var(--s-2)' }}>{policy.policyNo}</div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--s-2)', marginTop: 'var(--s-3)' }}>
        <span className={`ds-status ds-fg-${daysTone(days)}`}>
          <span className="ds-dot" />
          <span style={{ color: 'var(--ink-2)' }}>{daysLabel(days)}</span>
        </span>
        <span onClick={(e) => e.stopPropagation()} style={{ marginLeft: 'auto', flex: 'none' }}>
          <StageMenu current={stage} onMove={onMove} busy={busy} />
        </span>
      </div>
    </div>
  );
}

function PipelineBoard({
  rows, onMove, onOpen, busy, onSweep,
}: {
  rows: Policy[];
  onMove: (id: string, stage: string) => void;
  onOpen: (p: Policy) => void;
  busy: boolean;
  onSweep: () => void;
}) {
  const [dragId, setDragId] = useState<string | null>(null);
  const [overStage, setOverStage] = useState<string | null>(null);

  const columns = useMemo(() => {
    const buckets: Record<string, Policy[]> = Object.fromEntries(STAGES.map((s) => [s.key, [] as Policy[]]));
    for (const p of rows) {
      const stage = stageOf(p);
      if (stage) buckets[stage].push(p);
    }
    for (const key of Object.keys(buckets)) {
      buckets[key].sort((a, b) => +new Date(a.endDate) - +new Date(b.endDate));
    }
    return buckets;
  }, [rows]);

  const total = STAGES.reduce((n, s) => n + columns[s.key].length, 0);

  const drop = (stage: string, transferred?: string) => {
    setOverStage(null);
    const id = dragId ?? (transferred || null);
    setDragId(null);
    if (!id) return;
    const current = rows.find((p) => p.id === id);
    if (!current || stageOf(current) === stage) return;
    onMove(id, stage);
  };

  if (total === 0) {
    return (
      <Card>
        <EmptyState
          icon={CalendarClock}
          title="Nothing in the renewal pipeline"
          body="Policies join the board when they come within 45 days of expiry, or as soon as the sweep stages them."
          actionLabel="Run renewal sweep"
          onAction={onSweep}
        />
      </Card>
    );
  }

  return (
    <div className="ds-stack">
      <Card>
        <h3 className="ds-h3" style={{ marginBottom: 'var(--s-4)' }}>Funnel</h3>
        <BarList items={STAGES.map((s) => ({ label: s.label, value: columns[s.key].length, tone: s.tone }))} />
      </Card>

      <div className="ds-scroll-x">
        <div style={{ display: 'flex', gap: 'var(--s-3)', alignItems: 'flex-start', minWidth: 'min-content' }}>
          {STAGES.map((s) => {
            const cards = columns[s.key];
            const isOver = overStage === s.key;
            return (
              <section
                key={s.key}
                aria-label={`${s.label} — ${cards.length} policies`}
                onDragOver={(e) => { e.preventDefault(); setOverStage(s.key); }}
                onDragLeave={() => setOverStage((v) => (v === s.key ? null : v))}
                onDrop={(e) => { e.preventDefault(); drop(s.key, e.dataTransfer.getData('text/plain')); }}
                className="ds-inset"
                style={{
                  width: 268, flex: 'none', padding: 'var(--s-3)',
                  background: isOver ? 'var(--tone-info-bg)' : 'var(--surface-2)',
                  outline: isOver ? '1px dashed var(--tone-info-line)' : '1px solid transparent',
                  transition: 'background 140ms ease',
                }}
              >
                <header style={{ display: 'flex', alignItems: 'center', gap: 'var(--s-2)', marginBottom: 'var(--s-3)' }}>
                  <span className={`ds-dot ds-fg-${s.tone}`} />
                  <span className="ds-h3">{s.label}</span>
                  <span className="ds-count" style={{ marginLeft: 'auto' }}>{cards.length}</span>
                </header>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--s-2)' }}>
                  {cards.length === 0 ? (
                    <div className="ds-caption" style={{ padding: 'var(--s-2) 0' }}>Nothing here.</div>
                  ) : cards.map((p) => (
                    <RenewalCard
                      key={p.id}
                      policy={p}
                      stage={s.key}
                      busy={busy}
                      dragging={dragId === p.id}
                      onOpen={() => onOpen(p)}
                      onDragStart={() => setDragId(p.id)}
                      onDragEnd={() => { setDragId(null); setOverStage(null); }}
                      onMove={(stage) => onMove(p.id, stage)}
                    />
                  ))}
                </div>
              </section>
            );
          })}
        </div>
      </div>
    </div>
  );
}

// ============================================================ drawer

function MetaRow({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="ds-list-row">
      <span className="ds-caption">{label}</span>
      <span className="ds-list-row-meta" style={{ fontWeight: 560, color: 'var(--ink)' }}>{value}</span>
    </div>
  );
}

function RenewalDrawer({
  policy, onClose, onRenew, onStage, busy, openQuote, onCreateQuote,
}: {
  policy: Policy;
  onClose: () => void;
  onRenew: () => void;
  onStage: (stage: string) => void;
  busy: boolean;
  openQuote: OpenRenewalQuote | null;
  onCreateQuote: () => void;
}) {
  const days = daysToExpiry(policy);
  const sent = remindersOf(policy);

  return (
    <Drawer
      open
      onClose={onClose}
      title={policy.client?.name ?? 'Unnamed client'}
      subtitle={`${policy.productName} · ${policy.companyName} · ${policy.policyNo}`}
      actions={
        <Link
          href={`/insurance/policies/${policy.id}`}
          className="btn-secondary btn-sm"
          style={{ textDecoration: 'none', flex: 'none' }}
        >
          Open full record
        </Link>
      }
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--s-2)', flexWrap: 'wrap', marginBottom: 'var(--s-5)' }}>
        <Badge tone={toneForPolicyStatus(policy.status)}>{humanStatus(policy.status)}</Badge>
        <Badge tone={daysTone(days)}>{daysLabel(days)}</Badge>
        <Badge tone={stageTone(policy.renewalStage)} dot={!!policy.renewalStage}>{stageLabel(policy.renewalStage)}</Badge>
      </div>

      <div className="ds-stack">
        <Card>
          <div className="ds-caption">Annual premium</div>
          <div className="ds-display" style={{ marginTop: 'var(--s-1)' }}>{money(policy.premiumInr)}</div>
          <div style={{ marginTop: 'var(--s-4)' }}>
            <MetaRow label="Sum insured" value={money(policy.sumInsuredInr)} />
            <MetaRow label="Cover starts" value={fmtDate(policy.startDate)} />
            <MetaRow label="Expires" value={fmtDate(policy.endDate)} />
            <MetaRow label="Grace period" value={`${policy.graceDays ?? 15} days`} />
            <MetaRow label="Category" value={humanStatus(policy.category)} />
            {policy.executiveName && <MetaRow label="Executive" value={policy.executiveName} />}
            {policy.client?.phone && <MetaRow label="Phone" value={policy.client.phone} />}
          </div>
        </Card>

        <Card>
          <h3 className="ds-h3">Reminders already sent</h3>
          <p className="ds-caption" style={{ marginTop: 'var(--s-1)', marginBottom: 'var(--s-3)' }}>
            The sweep contacts the customer at 30, 15, 7 and 1 days before expiry.
          </p>
          {sent.length === 0
            ? <div className="ds-caption">Nothing has gone out on this policy yet.</div>
            : <ReminderChips policy={policy} />}
        </Card>

        <Card>
          <h3 className="ds-h3">Renewal stage</h3>
          <div style={{ display: 'flex', gap: 'var(--s-2)', flexWrap: 'wrap', marginTop: 'var(--s-3)' }}>
            {STAGES.map((s) => (
              <button
                key={s.key}
                className={policy.renewalStage === s.key ? 'btn-secondary btn-sm' : 'btn-ghost btn-sm'}
                disabled={busy || policy.renewalStage === s.key}
                onClick={() => onStage(s.key)}
              >
                <span className={`ds-dot ds-fg-${s.tone}`} /> {s.label}
              </button>
            ))}
          </div>
        </Card>
      </div>

      <div style={{ display: 'flex', gap: 'var(--s-2)', flexWrap: 'wrap', marginTop: 'var(--s-6)' }}>
        {openQuote ? (
          <Link
            className="btn-primary btn-sm"
            href="/insurance/quotes"
            style={{ textDecoration: 'none' }}
            title="One renewal path at a time — issue the open quote or mark it lost"
          >
            <FileText size={13} /> Open renewal quote {openQuote.reference}
          </Link>
        ) : canRenew(policy) && (
          <>
            <button className="btn-primary btn-sm" disabled={busy} onClick={onRenew}>
              <RefreshCw size={13} /> Renew policy
            </button>
            <button
              className="btn-secondary btn-sm"
              disabled={busy}
              title="Open a pre-filled quote to re-shop this renewal — insurer, premium, agent, all editable"
              onClick={onCreateQuote}
            >
              <FileText size={13} /> Create renewal quote
            </button>
          </>
        )}
        <button className="btn-ghost btn-sm" onClick={onClose}>Close</button>
      </div>
    </Drawer>
  );
}

function SweepPrompt({ onClose, onRun, busy }: { onClose: () => void; onRun: () => void; busy: boolean }) {
  return (
    <Drawer open onClose={onClose} title="Run renewal sweep" subtitle="Reminders out, overdue cover marked lapsed">
      <div className="ds-stack">
        <p className="ds-body" style={{ margin: 0 }}>
          The sweep walks every active policy, sends the reminder due at 30, 15, 7 and 1 days before
          expiry, stages anything untouched as <b>Due</b>, and marks policies past their grace period
          as <b>Lapsed</b>. It runs nightly on its own — this is the manual pull.
        </p>
        <div style={{ display: 'flex', gap: 'var(--s-2)' }}>
          <button className="btn-primary btn-sm" disabled={busy} onClick={onRun}>
            <RefreshCw size={13} /> Run sweep now
          </button>
          <button className="btn-ghost btn-sm" onClick={onClose}>Not now</button>
        </div>
      </div>
    </Drawer>
  );
}

// ============================================================ the workspace

function RenewalWorkspace() {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();

  const { data, isLoading } = usePolicies();
  const { renew, move, sweep } = useRenewalActions();

  // The open RENEWAL quotes, mapped by the policy they would renew. While one
  // is open it IS that policy's renewal path — the actions defer to it.
  const quotesQ = useQuery({
    queryKey: ['ins-quotes'],
    queryFn: async () => (await api.get<any[]>('/insurance/quotes')).data,
  });
  const openRenewalQuotes = useMemo(() => {
    const m = new Map<string, OpenRenewalQuote>();
    for (const q of quotesQ.data ?? []) {
      if (q.type === 'RENEWAL' && q.sourcePolicyId && ['DRAFT', 'PRESENTED', 'APPROVED'].includes(q.status)) {
        m.set(q.sourcePolicyId, { id: q.id, reference: q.reference });
      }
    }
    return m;
  }, [quotesQ.data]);
  const openQuoteOf = (p: Policy) => openRenewalQuotes.get(p.id) ?? null;
  const createRenewalQuote = (p: Policy) => router.push(`/insurance/quotes?renewalOf=${p.id}`);

  const [openId, setOpenId] = useState<string | null>(null);
  const [sweepOpen, setSweepOpen] = useState(false);

  // Preserved from the old board: the quick-create entry point lands here, and
  // the only thing this workspace creates is a sweep.
  useEffect(() => { if (params?.get('new') === '1') setSweepOpen(true); }, [params]);

  const raw = params?.get('view');
  const view: ViewKey = isViewKey(raw) ? raw : 'today';
  const setView = (v: ViewKey) => {
    const next = new URLSearchParams(params?.toString() ?? '');
    next.set('view', v);
    router.replace(`${pathname}?${next.toString()}`, { scroll: false });
  };

  const rows = useMemo(() => data ?? [], [data]);
  const b = useMemo(() => bucketize(rows), [rows]);

  const pipelineCount = useMemo(() => rows.filter((p) => stageOf(p) !== null).length, [rows]);

  const counts: Record<ViewKey, number> = {
    today: b.today.length,
    d15: b.d15.length,
    d30: b.d30.length,
    d45: b.d45.length,
    d60: b.d60.length,
    lost: b.lost.length,
    renewed: b.renewed.length,
    pipeline: pipelineCount,
  };

  const sum = (list: Policy[]) => list.reduce((n, p) => n + (p.premiumInr ?? 0), 0);

  const openPolicy = openId ? rows.find((p) => p.id === openId) : undefined;
  const busy = renew.isPending || move.isPending;

  const visible: Policy[] =
    view === 'today' ? b.today
      : view === 'd15' ? b.d15
        : view === 'd30' ? b.d30
          : view === 'd45' ? b.d45
            : view === 'd60' ? b.d60
              : view === 'lost' ? b.lost
                : view === 'renewed' ? b.renewed
                  : [];

  const nextUp = b.nextDueInDays;
  const nextUpCopy = nextUp == null
    ? 'No active policy has an expiry date ahead of it right now.'
    : `The next renewal is in ${nextUp} day${nextUp === 1 ? '' : 's'}.`;

  const emptyCopy: Record<Exclude<ViewKey, 'pipeline'>, { title: string; body: string }> = {
    today: { title: 'Nothing due today', body: nextUpCopy },
    d15: { title: 'Nothing falling due in the next 15 days', body: nextUpCopy },
    d30: { title: 'A clear month ahead', body: `No active cover expires within 30 days. ${nextUpCopy}` },
    d45: { title: 'Nothing falling due in the next 45 days', body: nextUpCopy },
    d60: { title: 'A clear two months ahead', body: `No active cover expires within 60 days. ${nextUpCopy}` },
    lost: { title: 'Nothing lost', body: 'No policy has lapsed, and every expired policy on the book was replaced by a renewal.' },
    renewed: {
      title: `No renewals closed in ${thisMonthName()} yet`,
      body: 'Work the due-today list and the ones you close will land here.',
    },
  };

  const header = (
    <div className="ds-stack">
      <Toolbar>
        <div style={{ marginRight: 'auto', minWidth: 0 }}>
          <h1 className="ds-h1">Renewal centre</h1>
          <div className="ds-caption" style={{ marginTop: 'var(--s-1)' }}>
            Every policy arranged by the deadline it has to be closed against.
          </div>
        </div>
        <button className="btn-secondary btn-sm" disabled={sweep.isPending} onClick={() => sweep.mutate()}>
          <RefreshCw size={13} /> Run renewal sweep
        </button>
      </Toolbar>

      <div className="ds-grid ds-grid-kpi">
        <BucketStat label="Due today" count={b.today.length} amount={sum(b.today)} tone="expired" icon={AlertTriangle} onClick={() => setView('today')} />
        <BucketStat label="Due in 15 days" count={b.d15.length} amount={sum(b.d15)} tone="renewal" icon={CalendarClock} onClick={() => setView('d15')} />
        <BucketStat label="Due in 30 days" count={b.d30.length} amount={sum(b.d30)} tone="renewal" icon={CalendarDays} onClick={() => setView('d30')} />
        <BucketStat label="Due in 60 days" count={b.d60.length} amount={sum(b.d60)} tone="sales" icon={CalendarDays} onClick={() => setView('d60')} />
        <BucketStat label="Lapsed / lost" count={b.lost.length} amount={sum(b.lost)} tone="expired" icon={Ban} onClick={() => setView('lost')} />
        <BucketStat label={`Renewed in ${thisMonthName()}`} count={b.renewed.length} amount={sum(b.renewed)} tone="active" icon={CalendarCheck} onClick={() => setView('renewed')} />
      </div>

      <div>
        <div className="ds-subnav" role="tablist" aria-label="Renewal buckets">
          {VIEWS.map((v) => (
            <button
              key={v.key}
              role="tab"
              className="ds-subnav-item"
              data-active={view === v.key}
              aria-selected={view === v.key}
              onClick={() => setView(v.key)}
            >
              {v.key === 'pipeline' && <KanbanSquare size={14} />}
              {v.label}
              <span className="ds-count">{counts[v.key]}</span>
            </button>
          ))}
        </div>
        <div className="ds-caption" style={{ marginTop: 'var(--s-3)', maxWidth: '84ch' }}>
          {VIEWS.find((v) => v.key === view)?.rule}
        </div>
      </div>
    </div>
  );

  if (isLoading) {
    return (
      <div className="ds-stack">
        {header}
        <Skeleton rows={1} height={110} />
        <Skeleton rows={4} height={76} />
      </div>
    );
  }

  return (
    <div className="ds-stack">
      {header}

      {view === 'pipeline' ? (
        <PipelineBoard
          rows={rows}
          busy={busy}
          onMove={(id, stage) => move.mutate({ id, stage })}
          onOpen={(p) => setOpenId(p.id)}
          onSweep={() => sweep.mutate()}
        />
      ) : visible.length === 0 ? (
        <Card>
          <EmptyState
            icon={view === 'renewed' ? CalendarCheck : view === 'lost' ? Ban : CalendarClock}
            title={emptyCopy[view].title}
            body={emptyCopy[view].body}
            actionLabel={view === 'today' || view === 'lost' ? 'Run renewal sweep' : undefined}
            onAction={view === 'today' || view === 'lost' ? () => sweep.mutate() : undefined}
          />
        </Card>
      ) : (
        <RenewalRows
          rows={visible}
          busy={busy}
          onOpen={(p) => setOpenId(p.id)}
          onRenew={(p) => renew.mutate(p.id)}
          onStage={(p, stage) => move.mutate({ id: p.id, stage })}
          openQuoteOf={openQuoteOf}
          onCreateQuote={createRenewalQuote}
        />
      )}

      {openPolicy && (
        <RenewalDrawer
          policy={openPolicy}
          busy={busy}
          onClose={() => setOpenId(null)}
          onRenew={() => renew.mutate(openPolicy.id, { onSuccess: () => setOpenId(null) })}
          onStage={(stage) => move.mutate({ id: openPolicy.id, stage })}
          openQuote={openQuoteOf(openPolicy)}
          onCreateQuote={() => createRenewalQuote(openPolicy)}
        />
      )}

      {sweepOpen && (
        <SweepPrompt
          onClose={() => setSweepOpen(false)}
          busy={sweep.isPending}
          onRun={() => sweep.mutate(undefined, { onSuccess: () => setSweepOpen(false) })}
        />
      )}
    </div>
  );
}

/**
 * `useSearchParams` needs a Suspense boundary of its own, so the workspace
 * carries one rather than depending on whatever route mounts it.
 */
export function InsuranceRenewalCenter() {
  return (
    <Suspense fallback={<Skeleton rows={4} height={110} />}>
      <RenewalWorkspace />
    </Suspense>
  );
}
