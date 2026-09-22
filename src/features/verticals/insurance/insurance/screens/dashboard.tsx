'use client';

/**
 * Insurance → Executive workspace.
 *
 * Not a report card. Every block on this page is a piece of work with a way in:
 * the KPI strip clicks through to the ledger behind each number, the left column
 * is the queue (tasks, breached claims, renewals, quotes) and the right column is
 * the context you read while you work it (trend, people, what just happened).
 *
 * Endpoints, one per block:
 *   GET /insurance/dashboard              premium book · commission receivable · renewals · claims KPIs + 6-month spark
 *   GET /tasks?limit=100                  today's tasks (platform Task model; filtered client-side — ListTasksDto has no due-date filter)
 *   GET /insurance/claims/board           claims requiring action (SLA); falls back to /insurance/claims if not deployed yet
 *   GET /insurance/policies?status=ACTIVE renewals due (filtered to the next 30 days)
 *   GET /insurance/quotes                 pending quotes
 *   GET /insurance/analytics              executive performance (leaderboard)
 *   GET /insurance/activity?limit=30      recent activity
 *
 * Each query owns its own block: one slow or missing endpoint degrades that card
 * alone and never blanks the page.
 */

import React, { useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { useQuery } from '@tanstack/react-query';
import {
  Activity, ArrowRight, Banknote, CheckSquare, FilePlus2, FileText,
  Plus, RefreshCw, ShieldAlert, Trophy, Wallet,
} from 'lucide-react';

import { api } from '@/lib/api';
import { fmtOrgMoney } from '@/lib/org-locale';
import { useAuth } from '@/features/foundation/auth/hooks/auth-context';
import {
  Avatar, BarChart, Badge, Card, EmptyState, EntityIcon, QuickActions, SectionTitle,
  Skeleton, StatCard, Timeline, useIsNarrow, type Tone,
} from '../ui/kit';
import { slaText, stageMeta, TERMINAL_STAGES } from './claims-board';
import { SupportInbox } from './support-inbox';

// ---------------------------------------------------------------- shapes
// These mirror the API payloads key-for-key. A loose optional shape here once
// swallowed a rename (`trends.premium`) and every trend pill silently vanished
// in production, so the trend block is spelled out exactly as the service returns it.

interface DashboardTrends {
  policiesDelta: number | null;
  premiumDeltaPct: number | null;
  claimsDelta: number | null;
  commissionDeltaPct: number | null;
  renewalsDueDelta: number | null;
}

interface DashboardData {
  companies: number;
  clients: number;
  activePolicies: number;
  premiumBookInr: number;
  expiring30: number;
  openQuotes: number;
  openClaims: number;
  commissionPendingInr: number;
  trends: DashboardTrends;
  spark: { premium: number[] }; // exactly six months, oldest first
}

interface ActivityRow {
  id: string;
  at: string;
  kind: string;
  title: string;
  detail: string;
  clientName: string;
  tone: Tone;
}

interface TaskRow {
  id: string;
  title: string;
  priority: 'LOW' | 'MEDIUM' | 'HIGH' | 'URGENT';
  status: 'TODO' | 'IN_PROGRESS' | 'DONE' | 'CANCELLED';
  dueDate: string | null;
  relatedType: string;
  relatedId: string | null;
  assignedTo: { id: string; firstName: string | null; lastName: string | null } | null;
}

interface TaskPage { data: TaskRow[] }

interface PolicyRow {
  id: string;
  policyNo: string;
  productName: string;
  companyName: string;
  premiumInr: number;
  endDate: string;
  status: string;
  client: { name: string } | null;
}

interface QuoteRow {
  id: string;
  reference: string;
  category: string;
  status: string;
  createdAt: string;
  client: { name: string } | null;
  lines: { premiumInr: number }[];
}

interface LeaderboardRow { name: string; policies: number; premiumInr: number; commissionInr: number }
interface AnalyticsData { leaderboard: LeaderboardRow[] }

/** The stage-machine board. Shape per the claims board endpoint. */
interface BoardClaim {
  id: string;
  claimNo: string;
  clientName?: string | null;
  policyNo?: string | null;
  stage: string;
  stageDueAt?: string | null;
  slaBreached?: boolean;
}
interface BoardData { stages?: { stage: string; label?: string; slaDays?: number | null; count?: number; claims?: BoardClaim[] }[]; breached?: number }

/** The legacy claims list, used only when the board endpoint is not deployed. */
interface ClaimRow {
  id: string;
  claimNo: string;
  status: string;
  stage: string | null;
  stageDueAt: string | null;
  policy: { policyNo: string; companyName: string; client: { name: string } | null } | null;
}

/** One normalised claim needing attention, whichever endpoint answered. */
interface ActionableClaim {
  id: string;
  claimNo: string;
  who: string;
  policyNo: string;
  stage: string;
  stageDueAt: string | null;
  breached: boolean;
}

// ---------------------------------------------------------------- small helpers

const DAY = 86_400_000;
const ROWS = 5; // a launchpad shows the top of a queue, never the queue

/** "Good morning" / "Good afternoon" / "Good evening" for the local clock. */
function greetingFor(hour: number) {
  if (hour < 12) return 'Good morning';
  if (hour < 17) return 'Good afternoon';
  return 'Good evening';
}

/** Last six month abbreviations, oldest first — the x-axis of the trend chart. */
function lastSixMonths(): string[] {
  return Array.from({ length: 6 }, (_, i) => {
    const d = new Date();
    d.setDate(1);
    d.setMonth(d.getMonth() - (5 - i));
    return d.toLocaleDateString(undefined, { month: 'short' });
  });
}

/** Whole calendar days from today to a date — negative once it is in the past. */
function daysTo(at?: string | null): number | null {
  if (!at) return null;
  const d = new Date(at);
  if (Number.isNaN(+d)) return null;
  const now = new Date();
  return Math.round(
    (Date.UTC(d.getFullYear(), d.getMonth(), d.getDate())
      - Date.UTC(now.getFullYear(), now.getMonth(), now.getDate())) / DAY,
  );
}

/** "Overdue 3 days" / "Due today" / "In 12 days" — with the tone that says it. */
function dueChip(at?: string | null): { text: string; tone: Tone } | null {
  const days = daysTo(at);
  if (days == null) return null;
  if (days < 0) {
    const over = Math.abs(days);
    return { text: `Overdue ${over} day${over === 1 ? '' : 's'}`, tone: 'expired' };
  }
  if (days === 0) return { text: 'Due today', tone: 'renewal' };
  return { text: `${days} day${days === 1 ? '' : 's'}`, tone: days <= 7 ? 'renewal' : 'neutral' };
}

const pct = (n: number) => `${n}%`;

const fullName = (p?: { firstName: string | null; lastName: string | null } | null) =>
  [p?.firstName, p?.lastName].filter(Boolean).join(' ').trim();

/** What a task hangs off, in the words the desk uses. */
const RELATED_LABEL: Record<string, string> = {
  LEAD: 'Lead', STUDENT: 'Student', ADMISSION: 'Admission', COURSE: 'Course',
  BATCH: 'Batch', TASK: 'Task', INS_CLAIM: 'Claim', INS_POLICY: 'Policy', INS_CLIENT: 'Client',
};

/** Where a task row should take you — the record it is about, not a task screen. */
function taskHref(t: TaskRow): string {
  if (!t.relatedId) return '/tasks';
  switch (t.relatedType) {
    case 'INS_CLAIM': return `/insurance/claims/${t.relatedId}`;
    case 'INS_POLICY': return `/insurance/policies/${t.relatedId}`;
    case 'INS_CLIENT': return `/insurance/clients/${t.relatedId}`;
    default: return '/tasks';
  }
}

// ---------------------------------------------------------------- block scaffolding

/**
 * One block of the workspace: a titled card that owns its own loading, empty and
 * populated states so a slow neighbour never blanks it.
 */
function Block({
  title, sub, icon, tone, viewAll, onViewAll, loading, skeletonRows, isEmpty, empty, children,
}: {
  title: string;
  sub?: string;
  icon?: any;
  tone?: Tone;
  viewAll?: string;
  onViewAll?: () => void;
  loading?: boolean;
  skeletonRows?: number;
  isEmpty?: boolean;
  empty?: React.ReactNode;
  children?: React.ReactNode;
}) {
  return (
    <Card>
      <SectionTitle
        sub={sub}
        action={viewAll && onViewAll ? (
          <button className="ds-viewall" onClick={onViewAll}>
            {viewAll} <ArrowRight size={13} />
          </button>
        ) : undefined}
      >
        <span className="ds-row" style={{ gap: 'var(--s-2)' }}>
          {icon && <EntityIcon icon={icon} tone={tone ?? 'neutral'} />}
          {title}
        </span>
      </SectionTitle>
      {loading ? <Skeleton rows={skeletonRows ?? 3} height={52} /> : isEmpty ? empty : children}
    </Card>
  );
}

/**
 * An actionable row: icon, what it is, who/what it belongs to, and a status chip.
 * The whole row is the target — a link buried at one end is a worse affordance.
 */
function WorkRow({
  icon, tone = 'neutral', title, meta, chip, chipTone = 'neutral', trailing, divider, onClick,
}: {
  icon: any;
  tone?: Tone;
  title: string;
  meta?: React.ReactNode;
  chip?: string;
  chipTone?: Tone;
  trailing?: React.ReactNode;
  /** Hairline above the row. Passed explicitly rather than by sibling selector —
   *  styled-jsx may emit its style node between rows, which breaks adjacency. */
  divider?: boolean;
  onClick: () => void;
}) {
  return (
    <>
      <button className={`ds-work-row${divider ? ' ds-work-row-divided' : ''}`} onClick={onClick}>
        <EntityIcon icon={icon} tone={tone} />
        <span className="ds-work-row-body">
          <span className="ds-h3">{title}</span>
          {meta && <span className="ds-caption">{meta}</span>}
        </span>
        {trailing && <span className="ds-work-row-trail">{trailing}</span>}
        {chip && <Badge tone={chipTone}>{chip}</Badge>}
      </button>
      <style jsx>{`
        .ds-work-row {
          display: flex;
          align-items: center;
          gap: var(--s-3);
          width: calc(100% + var(--s-4));
          margin: 0 calc(var(--s-2) * -1);
          padding: var(--s-3) var(--s-2);
          text-align: left;
          font: inherit;
          background: none;
          border: 0;
          border-radius: var(--r-sm);
          cursor: pointer;
          transition: background 130ms ease;
        }
        .ds-work-row-divided {
          box-shadow: inset 0 1px 0 var(--hairline-soft);
        }
        .ds-work-row:hover {
          background: var(--surface-2);
        }
        .ds-work-row:focus-visible {
          outline: 2px solid var(--navy);
          outline-offset: -2px;
        }
        .ds-work-row-body {
          display: flex;
          flex-direction: column;
          gap: 2px;
          min-width: 0;
          flex: 1;
        }
        .ds-work-row-body :global(.ds-h3),
        .ds-work-row-body :global(.ds-caption) {
          overflow: hidden;
          text-overflow: ellipsis;
          white-space: nowrap;
        }
        .ds-work-row-trail {
          flex: none;
          white-space: nowrap;
        }
        @media (prefers-reduced-motion: reduce) {
          .ds-work-row { transition: none; }
        }
      `}</style>
    </>
  );
}

/** A ranked executive: avatar, name, premium written, and their share of the book. */
function ExecRow({ rank, row, max, total }: { rank: number; row: LeaderboardRow; max: number; total: number }) {
  const share = total > 0 ? Math.round((row.premiumInr / total) * 100) : 0;
  const tone: Tone = rank === 0 ? 'active' : rank === 1 ? 'sales' : 'info';
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--s-2)', padding: 'var(--s-3) 0' }}>
      <div className="ds-row" style={{ gap: 'var(--s-3)' }}>
        <Avatar name={row.name} />
        <div style={{ minWidth: 0, flex: 1 }}>
          <div className="ds-h3" style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{row.name}</div>
          <div className="ds-caption">
            {row.policies} polic{row.policies === 1 ? 'y' : 'ies'} · {share}% of book
          </div>
        </div>
        <div className="ds-h3 ds-num" style={{ flex: 'none' }}>{fmtOrgMoney(row.premiumInr)}</div>
      </div>
      <div style={{ height: 6, borderRadius: 'var(--r-pill)', background: 'var(--surface-2)', overflow: 'hidden' }}>
        <div
          style={{
            width: `${max > 0 ? Math.max((row.premiumInr / max) * 100, 2) : 0}%`,
            height: '100%',
            borderRadius: 'var(--r-pill)',
            background: `var(--tone-${tone})`,
            opacity: 0.85,
            transition: 'width 320ms cubic-bezier(.4,0,.2,1)',
          }}
        />
      </div>
    </div>
  );
}

// ---------------------------------------------------------------- screen

export function InsuranceDashboard() {
  const router = useRouter();
  const { user } = useAuth();
  const narrow = useIsNarrow(900);

  const go = (href: string) => () => router.push(href);

  // Each block fetches on its own so one failure is one empty card, not a blank page.
  const dash = useQuery({
    queryKey: ['ins-dash'],
    queryFn: async () => (await api.get<DashboardData>('/insurance/dashboard')).data,
  });

  const activity = useQuery({
    queryKey: ['ins-activity'],
    queryFn: async () => (await api.get<ActivityRow[]>('/insurance/activity', { params: { limit: 30 } })).data,
    retry: false,
  });

  // ListTasksDto has no due-date filter, so the window is applied client-side over
  // the first page (already ordered by dueDate asc) rather than adding an endpoint.
  const tasks = useQuery({
    queryKey: ['ins-dash-tasks'],
    queryFn: async () => (await api.get<TaskPage>('/tasks', { params: { limit: 100 } })).data,
    retry: false,
  });

  const policies = useQuery({
    queryKey: ['ins-dash-policies'],
    queryFn: async () => (await api.get<PolicyRow[]>('/insurance/policies', { params: { status: 'ACTIVE' } })).data,
  });

  const quotes = useQuery({
    queryKey: ['ins-dash-quotes'],
    queryFn: async () => (await api.get<QuoteRow[]>('/insurance/quotes')).data,
  });

  const analytics = useQuery({
    queryKey: ['ins-dash-analytics'],
    queryFn: async () => (await api.get<AnalyticsData>('/insurance/analytics')).data,
    retry: false,
  });

  // The stage machine is the right source for "requiring action". It is newer than
  // this screen, so a 404 falls through to the plain claims list rather than retrying.
  const board = useQuery({
    queryKey: ['ins-dash-claims-board'],
    queryFn: async () => (await api.get<BoardData>('/insurance/claims/board')).data,
    retry: false,
  });

  const claimsFallback = useQuery({
    queryKey: ['ins-dash-claims'],
    queryFn: async () => (await api.get<ClaimRow[]>('/insurance/claims')).data,
    enabled: board.isError,
    retry: false,
  });

  const d = dash.data;
  const now = new Date();
  const firstName = user?.firstName?.trim() || 'there';

  // ------------------------------------------------------------ derived blocks

  const premiumSeries = useMemo(() => {
    const labels = lastSixMonths();
    const raw = d?.spark?.premium ?? [];
    const tail = raw.slice(-labels.length);
    // Right-align a short series so the newest month stays the last bar.
    const padded = [...Array.from({ length: labels.length - tail.length }, () => 0), ...tail];
    return labels.map((label, i) => ({ label, value: Number(padded[i]) || 0 }));
  }, [d?.spark?.premium]);

  const hasPremiumSeries = premiumSeries.some((p) => p.value > 0);

  /** Open tasks whose due date has arrived or passed — overdue first. */
  const todaysTasks = useMemo(() => {
    const endOfToday = new Date();
    endOfToday.setHours(23, 59, 59, 999);
    return (tasks.data?.data ?? [])
      .filter((t) => t.status !== 'DONE' && t.status !== 'CANCELLED')
      .filter((t) => Boolean(t.dueDate) && new Date(t.dueDate!) <= endOfToday)
      .sort((a, b) => +new Date(a.dueDate!) - +new Date(b.dueDate!))
      .slice(0, ROWS);
  }, [tasks.data]);

  /** Claims off their SLA or stalled — breached first, then soonest due. */
  const actionableClaims = useMemo<ActionableClaim[]>(() => {
    const fromBoard = (board.data?.stages ?? [])
      .filter((s) => !TERMINAL_STAGES.includes((s.stage ?? '').toUpperCase()))
      .flatMap((s) => (s.claims ?? []).map((c) => ({
        id: c.id,
        claimNo: c.claimNo,
        who: c.clientName ?? '—',
        policyNo: c.policyNo ?? '',
        stage: c.stage ?? s.stage,
        stageDueAt: c.stageDueAt ?? null,
        breached: Boolean(c.slaBreached) || (daysTo(c.stageDueAt) ?? 1) < 0,
      })));

    const fromList = (claimsFallback.data ?? [])
      .filter((c) => !['SETTLED', 'REJECTED'].includes((c.status ?? '').toUpperCase()))
      .filter((c) => !TERMINAL_STAGES.includes((c.stage ?? '').toUpperCase()))
      .map((c) => ({
        id: c.id,
        claimNo: c.claimNo,
        who: c.policy?.client?.name ?? '—',
        policyNo: c.policy?.policyNo ?? '',
        stage: c.stage ?? c.status,
        stageDueAt: c.stageDueAt,
        breached: (daysTo(c.stageDueAt) ?? 1) < 0,
      }));

    const rows = board.isError ? fromList : fromBoard;
    return rows
      .sort((a, b) => {
        if (a.breached !== b.breached) return a.breached ? -1 : 1;
        return (a.stageDueAt ? +new Date(a.stageDueAt) : Infinity) - (b.stageDueAt ? +new Date(b.stageDueAt) : Infinity);
      })
      .slice(0, ROWS);
  }, [board.data, board.isError, claimsFallback.data]);

  /** Active policies expiring inside the next thirty days, soonest first. */
  const renewalsDue = useMemo(() => {
    const horizon = Date.now() + 30 * DAY;
    return (policies.data ?? [])
      .filter((p) => {
        const end = +new Date(p.endDate);
        return Number.isFinite(end) && end >= Date.now() - DAY && end <= horizon;
      })
      .sort((a, b) => +new Date(a.endDate) - +new Date(b.endDate))
      .slice(0, ROWS);
  }, [policies.data]);

  /** Quotes still on the desk — drafted or presented, not yet won or lost. */
  const pendingQuotes = useMemo(
    () => (quotes.data ?? [])
      .filter((q) => ['DRAFT', 'PRESENTED', 'APPROVED'].includes((q.status ?? '').toUpperCase()))
      .sort((a, b) => +new Date(b.createdAt) - +new Date(a.createdAt))
      .slice(0, ROWS),
    [quotes.data],
  );

  const execs = useMemo(() => (analytics.data?.leaderboard ?? []).filter((e) => e.premiumInr > 0).slice(0, 6), [analytics.data]);
  const execMax = execs.length ? Math.max(...execs.map((e) => e.premiumInr)) : 0;
  const execTotal = (analytics.data?.leaderboard ?? []).reduce((n, e) => n + e.premiumInr, 0);

  const timeline = useMemo(
    () => (activity.data ?? [])
      .filter((a) => Boolean(a.at))
      .slice(0, 8)
      .map((a) => ({
        at: a.at,
        title: a.title,
        detail: [a.clientName, a.detail].filter(Boolean).join(' · '),
        tone: a.tone ?? 'neutral',
      })),
    [activity.data],
  );

  // ------------------------------------------------------------ render

  const workColumn = (
    <div className="ds-stack" style={{ gap: 'var(--gap-section)' }}>
      {/* ------------------------------------------------ today's tasks */}
      <Block
        title="Today's tasks"
        sub="Due today or already overdue"
        icon={CheckSquare}
        tone="renewal"
        viewAll="View all"
        onViewAll={go('/tasks')}
        loading={tasks.isLoading}
        isEmpty={todaysTasks.length === 0}
        empty={tasks.isError ? (
          <EmptyState
            compact
            icon={CheckSquare}
            title="Tasks are out of reach right now"
            body="We could not load the task list — your role may not include task access."
          />
        ) : (
          <EmptyState
            compact
            icon={CheckSquare}
            title="Nothing due today"
            body="Your queue is clear. Anything you schedule for today will land here."
            actionLabel="Open tasks"
            onAction={go('/tasks')}
          />
        )}
      >
        {todaysTasks.map((t, i) => {
          const chip = dueChip(t.dueDate);
          const assignee = fullName(t.assignedTo);
          const related = RELATED_LABEL[t.relatedType];
          return (
            <WorkRow
              key={t.id}
              icon={CheckSquare}
              tone={chip?.tone === 'expired' ? 'expired' : 'renewal'}
              title={t.title}
              meta={[related, assignee ? `Assigned to ${assignee}` : 'Unassigned'].filter(Boolean).join(' · ')}
              chip={chip?.text}
              chipTone={chip?.tone}
              divider={i > 0}
              onClick={go(taskHref(t))}
            />
          );
        })}
      </Block>

      {/* ------------------------------------------------ claims requiring action */}
      <Block
        title="Claims requiring action"
        sub={board.isError ? 'Open claims, oldest SLA first' : 'SLA breaches and stalled files first'}
        icon={ShieldAlert}
        tone="claim"
        viewAll="View all"
        onViewAll={go('/insurance/claims')}
        loading={board.isLoading || claimsFallback.isLoading}
        isEmpty={actionableClaims.length === 0}
        empty={(
          <EmptyState
            compact
            icon={ShieldAlert}
            title="Every claim is on time"
            body="Nothing has blown its service level. New claims appear here the moment their clock starts."
          />
        )}
      >
        {actionableClaims.map((c, i) => {
          const sla = slaText(c.stageDueAt, c.breached);
          return (
            <WorkRow
              key={c.id}
              icon={ShieldAlert}
              tone={c.breached ? 'expired' : 'claim'}
              title={`${c.claimNo} · ${c.who}`}
              meta={[stageMeta(c.stage).label, c.policyNo].filter(Boolean).join(' · ')}
              chip={sla?.text}
              chipTone={sla?.tone}
              divider={i > 0}
              onClick={go(`/insurance/claims/${c.id}`)}
            />
          );
        })}
      </Block>

      {/* ------------------------------------------------ renewals due */}
      <Block
        title="Renewals due"
        sub="Active policies expiring in the next 30 days"
        icon={RefreshCw}
        tone="renewal"
        viewAll="View all"
        onViewAll={go('/insurance/renewals')}
        loading={policies.isLoading}
        isEmpty={renewalsDue.length === 0}
        empty={(
          <EmptyState
            compact
            icon={RefreshCw}
            title="No renewals in the next month"
            body="Nothing expires inside thirty days. Policies drop in here as their end date approaches."
            actionLabel="Open renewals"
            onAction={go('/insurance/renewals')}
          />
        )}
      >
        {renewalsDue.map((p, i) => {
          const chip = dueChip(p.endDate);
          return (
            <WorkRow
              key={p.id}
              icon={RefreshCw}
              tone={chip?.tone === 'expired' ? 'expired' : 'renewal'}
              title={p.client?.name ?? p.policyNo}
              meta={[p.policyNo, p.productName, p.companyName].filter(Boolean).join(' · ')}
              trailing={<span className="ds-h3 ds-num">{fmtOrgMoney(p.premiumInr)}</span>}
              chip={chip?.text}
              chipTone={chip?.tone}
              divider={i > 0}
              onClick={go('/insurance/renewals')}
            />
          );
        })}
      </Block>

      {/* ------------------------------------------------ pending quotes */}
      <Block
        title="Pending quotes"
        sub="Drafted or presented, waiting on a decision"
        icon={FileText}
        tone="sales"
        viewAll="View all"
        onViewAll={go('/insurance/quotes')}
        loading={quotes.isLoading}
        isEmpty={pendingQuotes.length === 0}
        empty={(
          <EmptyState
            compact
            icon={FileText}
            title="No quotes waiting"
            body="Every quote has been converted or closed. Start the next one when a client asks."
            actionLabel="Start a quote"
            onAction={go('/insurance/quotes?new=1')}
          />
        )}
      >
        {pendingQuotes.map((q, i) => {
          const best = q.lines?.length ? Math.min(...q.lines.map((l) => l.premiumInr)) : null;
          return (
            <WorkRow
              key={q.id}
              icon={FileText}
              tone="sales"
              title={`${q.reference} · ${q.client?.name ?? 'Unnamed client'}`}
              meta={[q.category, `${q.lines?.length ?? 0} insurer option${(q.lines?.length ?? 0) === 1 ? '' : 's'}`].join(' · ')}
              trailing={best != null ? <span className="ds-h3 ds-num">{fmtOrgMoney(best)}</span> : undefined}
              chip={q.status === 'PRESENTED' ? 'Presented' : q.status === 'APPROVED' ? 'Approved' : 'Draft'}
              chipTone={q.status === 'DRAFT' ? 'neutral' : 'sales'}
              divider={i > 0}
              onClick={go('/insurance/quotes')}
            />
          );
        })}
      </Block>
    </div>
  );

  const contextColumn = (
    <div className="ds-stack" style={{ gap: 'var(--gap-section)' }}>
      {/* ------------------------------------------------ premium trend */}
      <Block
        title="Premium trend"
        sub="Gross written premium, last six months"
        icon={Wallet}
        tone="info"
        viewAll="View book"
        onViewAll={go('/insurance/policies')}
        loading={dash.isLoading}
        skeletonRows={1}
        isEmpty={!hasPremiumSeries}
        empty={(
          <EmptyState
            icon={FileText}
            title="Your premium story starts here"
            body="Issue the first policy and this chart will fill in month by month."
            actionLabel="Start a quote"
            onAction={go('/insurance/quotes?new=1')}
          />
        )}
      >
        <div style={{ paddingTop: 'var(--s-3)' }}>
          <BarChart data={premiumSeries} height={220} tone="info" format={fmtOrgMoney} />
        </div>
      </Block>

      {/* ------------------------------------------------ executive performance */}
      <Block
        title="Executive performance"
        sub="Premium written per executive, share of the book"
        icon={Trophy}
        tone="active"
        viewAll="Full analytics"
        onViewAll={go('/insurance/reports')}
        loading={analytics.isLoading}
        isEmpty={execs.length === 0}
        empty={(
          <EmptyState
            compact
            icon={Trophy}
            title="No executive has written business yet"
            body="Name the executive when you issue a policy and the ranking builds itself."
          />
        )}
      >
        {execs.map((e, i) => <ExecRow key={e.name} rank={i} row={e} max={execMax} total={execTotal} />)}
      </Block>

      {/* ------------------------------------------------ recent activity */}
      <Block
        title="Recent activity"
        sub="Across quotes, policies, renewals and claims"
        icon={Activity}
        tone="info"
        viewAll="View book"
        onViewAll={go('/insurance/policies')}
        loading={activity.isLoading}
        skeletonRows={4}
        isEmpty={timeline.length === 0}
        empty={(
          <EmptyState
            compact
            icon={Activity}
            title="Nothing has happened yet today"
            body="Quotes, issued policies, renewals and claims will appear here as your desk works."
          />
        )}
      >
        <Timeline items={timeline} dense />
      </Block>
    </div>
  );

  return (
    <div className="ds-page">
      {/* ---------------------------------------------------- greeting */}
      <header style={{ display: 'flex', alignItems: 'flex-end', gap: 'var(--s-4)', flexWrap: 'wrap' }}>
        <div style={{ minWidth: 0, flex: 1 }}>
          <h1 className="ds-greeting" suppressHydrationWarning>
            {greetingFor(now.getHours())}, {firstName}
          </h1>
          <div className="ds-body ds-muted" style={{ marginTop: 'var(--s-2)' }} suppressHydrationWarning>
            {now.toLocaleDateString(undefined, { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}
          </div>
        </div>
        <button className="btn-primary" onClick={go('/insurance/quotes?new=1')}>
          <Plus size={15} /> New quote
        </button>
      </header>

      {/* ---------------------------------------------------- KPI strip */}
      {dash.isLoading ? (
        <div className="ds-grid ds-grid-kpi">
          <Skeleton rows={1} height={116} />
          <Skeleton rows={1} height={116} />
          <Skeleton rows={1} height={116} />
          <Skeleton rows={1} height={116} />
        </div>
      ) : (
        <div className="ds-grid ds-grid-kpi">
          <StatCard
            label="Premium book"
            value={fmtOrgMoney(d?.premiumBookInr)}
            icon={Wallet}
            tone="info"
            spark={d?.spark?.premium}
            delta={d?.trends?.premiumDeltaPct ?? undefined}
            deltaLabel="vs last month"
            format={pct}
            onClick={go('/insurance/policies')}
          />
          <StatCard
            label="Commission receivable"
            value={fmtOrgMoney(d?.commissionPendingInr)}
            icon={Banknote}
            tone="active"
            delta={d?.trends?.commissionDeltaPct ?? undefined}
            deltaLabel="vs last month"
            format={pct}
            onClick={go('/insurance/commission')}
          />
          <StatCard
            label="Renewals due · 30d"
            value={d?.expiring30 ?? 0}
            icon={RefreshCw}
            tone="renewal"
            delta={d?.trends?.renewalsDueDelta ?? undefined}
            deltaLabel="vs last month"
            onClick={go('/insurance/renewals')}
          />
          <StatCard
            label="Open claims"
            value={d?.openClaims ?? 0}
            icon={ShieldAlert}
            tone="claim"
            delta={d?.trends?.claimsDelta ?? undefined}
            deltaLabel="vs last month"
            onClick={go('/insurance/claims')}
          />
        </div>
      )}

      {/* ---------------------------------------------------- working area */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: narrow ? '1fr' : 'minmax(0, 1.15fr) minmax(0, 1fr)',
          gap: 'var(--gap-section)',
          alignItems: 'start',
        }}
      >
        {workColumn}
        {contextColumn}
      </div>

      {/* ---------------------------------------------------- quick actions */}
      <section>
        <SectionTitle sub="The four things a broking desk does most">Jump back in</SectionTitle>
        <QuickActions
          actions={[
            { icon: FilePlus2, label: 'New quote', tone: 'sales', onClick: go('/insurance/quotes?new=1') },
            { icon: FileText, label: 'New policy', tone: 'active', onClick: go('/insurance/policies?new=1') },
            { icon: RefreshCw, label: 'Renew policy', tone: 'renewal', onClick: go('/insurance/renewals') },
            { icon: ShieldAlert, label: 'Register claim', tone: 'claim', onClick: go('/insurance/claims?new=1') },
          ]}
        />
      </section>

      {/* ---------------------------------------------------- portal support */}
      <SupportInbox />
    </div>
  );
}
