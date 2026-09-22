// Accounts control centre — shared types, formatting and the global date filter.
//
// Everything here reads the SAME double-entry ledger the accounting module has
// always used. There is no second set of balances: a "transaction" is a ledger
// txn that moved a cash or bank account, and "Money In" is the debit side of
// those same rows. That is why the dashboard can never disagree with the trial
// balance — it is the trial balance, summed the way an owner reads it.

import { fmtOrgMoney, fmtOrgMoneyExact } from '@/lib/org-locale';

export type MoneyType = 'IN' | 'OUT' | 'TRANSFER' | 'REFUND' | 'ADJUSTMENT';

export type Txn = {
  id: string;
  date: string;
  memo: string;
  sourceType: string;
  sourceId: string | null;
  label: string;
  type: MoneyType;
  moneyIn: number;
  moneyOut: number;
  amount: number;
  account: string;
  accountIds: string[];
  category: string;
  categoryCode: string | null;
  balance: number;
};

export type TxnPage = {
  rows: Txn[];
  total: number;
  truncated: boolean;
  opening: number;
  closing: number;
  accounts: { id: string; code: string; name: string; subtype: string | null }[];
};

export type JournalSide = { code: string; name: string; amount: number };

export type TxnDetail = Txn & {
  createdAt: string;
  journal: { debits: JournalSide[]; credits: JournalSide[]; totalDebit: number; totalCredit: number };
  source: null | {
    kind: string; reference?: string | null; party?: string | null; amountInr?: number;
    status?: string; method?: string; category?: string; approvedBy?: string | null;
    dueDate?: string | null; paidAt?: string | null; href?: string;
  };
};

export type CashAccount = {
  id: string; code: string; name: string; subtype: string | null;
  isSystem: boolean; isActive: boolean;
  opening: number; moneyIn: number; moneyOut: number; balance: number;
};

export type Overview = {
  moneyIn: number; moneyOut: number; netCashFlow: number; totalBalance: number;
  receivable: number; payable: number; cash: number; bank: number;
  accounts: CashAccount[];
  previous: { moneyIn: number; moneyOut: number; netCashFlow: number } | null;
  recent: Txn[];
};

export type Aging = {
  rows: { party: string; current: number; d1_30: number; d31_60: number; d61_90: number; d90_plus: number; total: number }[];
  totals: { current: number; d1_30: number; d31_60: number; d61_90: number; d90_plus: number; total: number };
};

/* ------------------------------------------------------------------ money ---
 * Every figure in this module is exact. fmtOrgMoney() abbreviates large INR to
 * lakh/crore shorthand, which is right on a marketing tile and wrong in a
 * ledger: a running balance rounded to one decimal place cannot be reconciled
 * against anything. The currency glyph itself lives only in lib/org-locale.
 */
export function money(n?: number | null): string {
  return fmtOrgMoneyExact(n);
}

/** Signed, for net cash flow: a leading + or − reads as a direction, not a value. */
export function signedMoney(n?: number | null): string {
  if (n == null) return '—';
  return `${n > 0 ? '+' : n < 0 ? '−' : ''}${money(Math.abs(n))}`;
}

export const compactMoney = fmtOrgMoney;

export const fmtDate = (s?: string | null) =>
  s ? new Date(s).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }) : '—';

export const fmtDateTime = (s?: string | null) =>
  s ? new Date(s).toLocaleString('en-IN', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' }) : '—';

/* ------------------------------------------------------------ date filter ---
 * One filter drives every figure on Overview, Transactions and Cash & Bank.
 * Ranges are half-open in intent but sent inclusive: `to` is pushed to 23:59:59
 * so a same-day range still contains today's transactions.
 */
export type RangeKey = 'today' | 'yesterday' | 'week' | 'month' | 'last-month' | 'year' | 'all' | 'custom';

export const RANGE_LABEL: Record<RangeKey, string> = {
  today: 'Today', yesterday: 'Yesterday', week: 'This Week', month: 'This Month',
  'last-month': 'Last Month', year: 'This Year', all: 'All Time', custom: 'Custom Range',
};

export const RANGE_ORDER: RangeKey[] = ['today', 'yesterday', 'week', 'month', 'last-month', 'year', 'all', 'custom'];

/** Local calendar date as YYYY-MM-DD. Deliberately NOT an ISO instant: the
 *  server resolves the boundary in the ORGANISATION's timezone, so sending
 *  2026-08-01 means "the tenant's 1 August" wherever the browser happens to be.
 *  Sending an instant would have baked the browser's zone into the question. */
const ymd = (d: Date) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;

/**
 * Resolve a preset into the date-only bounds the API expects.
 *
 * This used to return ISO instants computed with startOfDay()/endOfDay() on the
 * browser clock, which meant a laptop in another timezone asked for a different
 * August from the one the Reports module reported on — same books, two answers,
 * both plausible. The boundary arithmetic now happens once, server-side, in the
 * tenant's zone.
 */
export function resolveRange(key: RangeKey, custom?: { from?: string; to?: string }): { from?: string; to?: string } {
  const now = new Date();
  switch (key) {
    case 'today': return { from: ymd(now), to: ymd(now) };
    case 'yesterday': {
      const y = new Date(now); y.setDate(y.getDate() - 1);
      return { from: ymd(y), to: ymd(y) };
    }
    case 'week': {
      // Week starts Monday — the working week every business day-book assumes.
      const s = new Date(now); const dow = (s.getDay() + 6) % 7; s.setDate(s.getDate() - dow);
      return { from: ymd(s), to: ymd(now) };
    }
    case 'month': return { from: ymd(new Date(now.getFullYear(), now.getMonth(), 1)), to: ymd(now) };
    case 'last-month': {
      const s = new Date(now.getFullYear(), now.getMonth() - 1, 1);
      const e = new Date(now.getFullYear(), now.getMonth(), 0);
      return { from: ymd(s), to: ymd(e) };
    }
    case 'year': return { from: ymd(new Date(now.getFullYear(), 0, 1)), to: ymd(now) };
    case 'all': return {};
    case 'custom':
      // The date inputs already produce YYYY-MM-DD; pass them through untouched.
      return { from: custom?.from || undefined, to: custom?.to || undefined };
  }
}

/* --------------------------------------------------------- transaction kind -
 * Never colour alone (§2): each kind carries an icon and a written label, so it
 * survives greyscale printing and colour-blind readers.
 */
export const TYPE_META: Record<MoneyType, { label: string; fg: string; bg: string }> = {
  IN: { label: 'Money In', fg: 'var(--success)', bg: 'var(--success-bg)' },
  OUT: { label: 'Money Out', fg: 'var(--danger)', bg: 'var(--danger-bg)' },
  TRANSFER: { label: 'Transfer', fg: 'var(--navy)', bg: 'var(--surface-2)' },
  REFUND: { label: 'Refund', fg: 'var(--gold-ink)', bg: 'var(--gold-bg)' },
  ADJUSTMENT: { label: 'Adjustment', fg: 'var(--ink-2)', bg: 'var(--surface-2)' },
};

/** Percentage change vs the previous window — null when there is nothing to compare. */
export function delta(current: number, previous?: number | null): number | null {
  if (previous == null || previous === 0) return null;
  return ((current - previous) / Math.abs(previous)) * 100;
}
