'use client';

// The Accounts control centre (§14, §16).
//
// Before this, "finance" was a strip of twenty equal-weight tabs — Trial
// Balance sat next to Budgeting sat next to GSTR-1, and nowhere did the screen
// answer the only questions an owner actually opens it to ask. The nav below is
// ordered by who is asking: money questions first, accounting second, filings
// last. The accountant loses nothing — every old panel is still here, reused
// verbatim, one level down.

import { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import {
  LayoutDashboard, ArrowLeftRight, Landmark, HandCoins, ReceiptText, BookOpen, NotebookPen,
  Layers, Banknote, TrendingUp, Scale, FileText, Wallet, Users, Truck, Building2,
  Target, Lock, Sparkles, Percent, RefreshCw, Hourglass,
} from 'lucide-react';
import { api, apiErrorMessage } from '@/lib/api';
import { taxLabel, isGstRegime } from '@/lib/org-locale';
// Reused verbatim from the existing accounting module — the accountant-level
// panels were already correct, they were just buried. Nothing is re-implemented.
import {
  CoaPanel, JournalPanel, LedgerPanel, CashFlowPanel, PnlPanel, BalanceSheetPanel,
  TrialBalancePanel, GstPanel, GstReturnsPanel, VatPanel, BankReconPanel, PeriodsPanel,
  BudgetPanel, FixedAssetsPanel, PartiesPanel, PurchasesPanel, AiPanel, AgingPanel,
} from '@/features/verticals/realestate/realestate/components/accounting-panels';
import { RangeKey, RANGE_ORDER, RANGE_LABEL, resolveRange, MoneyType } from '../accounts-client';
import { OverviewPanel } from './overview-panel';
import { TransactionsPanel } from './transactions-panel';
import { CashBankPanel } from './cash-bank-panel';
import { ReceivablesPanel, PayablesPanel } from './outstanding-panels';

export type Section =
  | 'overview' | 'transactions' | 'cash-bank' | 'receivables' | 'payables'
  | 'ledger' | 'journal' | 'coa'
  | 'cashflow' | 'pnl' | 'balance' | 'trial' | 'aging' | 'tax' | 'returns'
  | 'parties' | 'purchases' | 'assets' | 'bank' | 'budget' | 'periods' | 'ai';

type NavItem = { key: Section; label: string; icon: any };
type NavGroup = { title: string | null; items: NavItem[] };

const navGroups = (): NavGroup[] => [
  {
    title: null,
    items: [
      { key: 'overview', label: 'Overview', icon: LayoutDashboard },
      { key: 'transactions', label: 'Transactions', icon: ArrowLeftRight },
      { key: 'cash-bank', label: 'Cash & Bank', icon: Landmark },
      { key: 'receivables', label: 'Receivables', icon: HandCoins },
      { key: 'payables', label: 'Payables', icon: ReceiptText },
    ],
  },
  {
    title: 'Accounting',
    items: [
      { key: 'ledger', label: 'General Ledger', icon: BookOpen },
      { key: 'journal', label: 'Journal Entries', icon: NotebookPen },
      { key: 'coa', label: 'Chart of Accounts', icon: Layers },
    ],
  },
  {
    title: 'Reports',
    items: [
      { key: 'cashflow', label: 'Cash Flow', icon: Banknote },
      { key: 'pnl', label: 'Profit & Loss', icon: TrendingUp },
      { key: 'balance', label: 'Balance Sheet', icon: Scale },
      { key: 'trial', label: 'Trial Balance', icon: Scale },
      { key: 'aging', label: 'Ageing', icon: Hourglass },
      ...(isGstRegime()
        ? [{ key: 'returns' as Section, label: `${taxLabel()} Returns`, icon: FileText }]
        : [{ key: 'tax' as Section, label: `${taxLabel()} Return`, icon: Percent }]),
    ],
  },
  {
    title: 'Setup & Tools',
    items: [
      { key: 'parties', label: 'Customers & Vendors', icon: Users },
      { key: 'purchases', label: 'Purchases', icon: Truck },
      { key: 'assets', label: 'Fixed Assets', icon: Building2 },
      { key: 'bank', label: 'Bank Reconciliation', icon: Wallet },
      { key: 'budget', label: 'Budgeting', icon: Target },
      { key: 'periods', label: 'Periods', icon: Lock },
      { key: 'ai', label: 'AI Insights', icon: Sparkles },
    ],
  },
];

// Sections whose figures move with the global date filter. The accountant-level
// panels carry their own period controls, so the filter is hidden for them
// rather than shown doing nothing.
const DATED: Section[] = ['overview', 'transactions', 'cash-bank'];

export function AccountsFeature() {
  const qc = useQueryClient();
  const [section, setSection] = useState<Section>('overview');
  const [range, setRange] = useState<RangeKey>('month');
  const [custom, setCustom] = useState<{ from?: string; to?: string }>({});
  // Set when the user clicks a dashboard card (§6): open Transactions pre-filtered.
  const [preset, setPreset] = useState<{ direction?: MoneyType; accountId?: string } | null>(null);

  const window = resolveRange(range, custom);

  const backfill = useMutation({
    mutationFn: async () => (await api.post('/accounting/backfill')).data,
    onSuccess: (d: any) => { toast.success(`Posted ${d.posted} entries to the ledger`); qc.invalidateQueries(); },
    onError: (e) => toast.error(apiErrorMessage(e)),
  });

  const go = (s: Section, p?: { direction?: MoneyType; accountId?: string }) => { setPreset(p ?? null); setSection(s); };

  return (
    <div style={{ animation: 'fadeUp .4s ease' }}>
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 16, marginBottom: 14, flexWrap: 'wrap' }}>
        <div>
          <h1 style={{ fontSize: 26, fontWeight: 700, letterSpacing: '-.02em', margin: 0 }}>Accounts</h1>
          <p style={{ fontSize: 14, color: 'var(--ink-2)', margin: '6px 0 0' }}>
            How much money you have, where it came from, where it went, what is still coming in and what you still owe.
          </p>
        </div>
        <button className="btn-secondary" style={{ height: 34 }} disabled={backfill.isPending} onClick={() => backfill.mutate()}>
          <RefreshCw size={14} /> {backfill.isPending ? 'Posting…' : 'Re-post ledger'}
        </button>
      </div>

      {DATED.includes(section) && (
        <DateFilter range={range} setRange={setRange} custom={custom} setCustom={setCustom} />
      )}

      <div style={{ display: 'grid', gridTemplateColumns: 'minmax(180px, 210px) 1fr', gap: 20, alignItems: 'start' }}>
        <nav style={{ position: 'sticky', top: 12, display: 'flex', flexDirection: 'column', gap: 14 }}>
          {navGroups().map((g, gi) => (
            <div key={g.title ?? `g${gi}`}>
              {g.title && (
                <div style={{ fontSize: 10.5, letterSpacing: '.08em', textTransform: 'uppercase', color: 'var(--ink-3)', fontWeight: 700, padding: '0 10px 6px' }}>{g.title}</div>
              )}
              <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                {g.items.map((it) => {
                  const on = section === it.key;
                  return (
                    <button key={it.key} onClick={() => go(it.key)}
                      style={{
                        display: 'flex', alignItems: 'center', gap: 9, textAlign: 'left', width: '100%',
                        border: 'none', cursor: 'pointer', borderRadius: 9, padding: '8px 10px',
                        fontSize: 13.5, fontWeight: on ? 700 : 500,
                        background: on ? 'var(--navy)' : 'transparent',
                        color: on ? '#fff' : 'var(--ink-2)',
                      }}>
                      <it.icon size={15} style={{ flexShrink: 0 }} /> {it.label}
                    </button>
                  );
                })}
              </div>
            </div>
          ))}
        </nav>

        <div style={{ minWidth: 0 }}>
          {section === 'overview' && <OverviewPanel window={window} onDrill={go} />}
          {section === 'transactions' && <TransactionsPanel window={window} preset={preset} />}
          {section === 'cash-bank' && <CashBankPanel window={window} onDrill={go} />}
          {section === 'receivables' && <ReceivablesPanel />}
          {section === 'payables' && <PayablesPanel />}

          {section === 'ledger' && <LedgerPanel />}
          {section === 'journal' && <JournalPanel />}
          {section === 'coa' && <CoaPanel />}

          {section === 'cashflow' && <CashFlowPanel />}
          {section === 'pnl' && <PnlPanel />}
          {section === 'balance' && <BalanceSheetPanel />}
          {section === 'trial' && <TrialBalancePanel />}
          {section === 'aging' && <AgingPanel />}
          {section === 'returns' && <><GstPanel /><div style={{ height: 16 }} /><GstReturnsPanel /></>}
          {section === 'tax' && <VatPanel />}

          {section === 'parties' && <PartiesPanel />}
          {section === 'purchases' && <PurchasesPanel />}
          {section === 'assets' && <FixedAssetsPanel />}
          {section === 'bank' && <BankReconPanel />}
          {section === 'budget' && <BudgetPanel />}
          {section === 'periods' && <PeriodsPanel />}
          {section === 'ai' && <AiPanel />}
        </div>
      </div>
    </div>
  );
}

function DateFilter({ range, setRange, custom, setCustom }: {
  range: RangeKey; setRange: (r: RangeKey) => void;
  custom: { from?: string; to?: string }; setCustom: (c: { from?: string; to?: string }) => void;
}) {
  const inp: React.CSSProperties = { padding: '6px 9px', borderRadius: 8, border: '1px solid var(--line-soft)', background: 'var(--surface)', fontSize: 12.5 };
  return (
    <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', alignItems: 'center', marginBottom: 16 }}>
      {RANGE_ORDER.map((k) => (
        <button key={k} onClick={() => setRange(k)}
          style={{
            border: '1px solid var(--line-soft)', borderRadius: 8, padding: '6px 11px', fontSize: 12.5,
            fontWeight: range === k ? 700 : 500, cursor: 'pointer',
            background: range === k ? 'var(--navy)' : 'var(--surface)',
            color: range === k ? '#fff' : 'var(--ink-2)',
          }}>
          {RANGE_LABEL[k]}
        </button>
      ))}
      {range === 'custom' && (
        <span style={{ display: 'inline-flex', gap: 6, alignItems: 'center', marginLeft: 4 }}>
          <input type="date" style={inp} value={custom.from ?? ''} onChange={(e) => setCustom({ ...custom, from: e.target.value })} />
          <span style={{ color: 'var(--ink-3)', fontSize: 12.5 }}>to</span>
          <input type="date" style={inp} value={custom.to ?? ''} onChange={(e) => setCustom({ ...custom, to: e.target.value })} />
        </span>
      )}
    </div>
  );
}
