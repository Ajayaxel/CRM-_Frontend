'use client';

import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { BookOpen, Scale, TrendingUp, Landmark, Receipt, RefreshCw, CheckCircle2, AlertTriangle, Users, Truck, Plus, X, Trash2, FileText, Download, Wallet, Sparkles, Layers, Building2, Banknote, NotebookPen, Undo2, Pencil, PlayCircle, Power, Lock, Unlock, Target, Percent, Hourglass } from 'lucide-react';
import { taxLabel, isIndia, isGstRegime, cur, orgLocale } from '@/lib/org-locale';
import { api, apiErrorMessage } from '@/lib/api';
import { money } from '../realestate-client';

const card: React.CSSProperties = { background: 'var(--surface)', border: '1px solid var(--line-soft)', borderRadius: 16 };
const th: React.CSSProperties = { textAlign: 'left', fontSize: 11, letterSpacing: '.05em', textTransform: 'uppercase', color: 'var(--ink-3)', fontWeight: 700, padding: '8px 12px', borderBottom: '1px solid var(--line-soft)' };
const td: React.CSSProperties = { padding: '9px 12px', fontSize: 13.5, borderBottom: '1px solid var(--line-soft)' };
const num: React.CSSProperties = { ...td, textAlign: 'right', fontVariantNumeric: 'tabular-nums' };
const iconBtn: React.CSSProperties = { display: 'inline-flex', alignItems: 'center', justifyContent: 'center', width: 28, height: 28, borderRadius: 8, border: '1px solid var(--line-soft)', background: 'var(--surface)', color: 'var(--ink-2)', cursor: 'pointer' };
const inp: React.CSSProperties = { width: '100%', padding: '9px 11px', borderRadius: 9, border: '1px solid var(--line-soft)', background: 'var(--surface)', fontSize: 13.5 };
const ACCOUNT_TYPES = ['ASSET', 'LIABILITY', 'EQUITY', 'INCOME', 'EXPENSE'];
const TYPE_LABEL: Record<string, string> = { ASSET: 'Assets', LIABILITY: 'Liabilities', EQUITY: 'Equity', INCOME: 'Income', EXPENSE: 'Expenses' };
const fmtDate = (s: string) => new Date(s).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: '2-digit' });

type Panel = 'dashboard' | 'ai' | 'commission' | 'bank' | 'trial' | 'pnl' | 'balance' | 'gst' | 'returns' | 'ledger' | 'parties' | 'purchases' | 'coa' | 'journal' | 'assets' | 'cashflow' | 'aging' | 'budget' | 'vat' | 'periods';
const tabsFor = (): { key: Panel; label: string; icon: any }[] => {
  const all: { key: Panel; label: string; icon: any }[] = [
  { key: 'dashboard', label: 'Dashboard', icon: TrendingUp },
  { key: 'ai', label: 'AI Insights', icon: Sparkles },
  { key: 'coa', label: 'Chart of Accounts', icon: Layers },
  { key: 'journal', label: 'Journal', icon: NotebookPen },
  { key: 'parties', label: 'Customers & Vendors', icon: Users },
  { key: 'purchases', label: 'Purchases', icon: Truck },
  { key: 'assets', label: 'Fixed Assets', icon: Building2 },
  { key: 'commission', label: 'Deals & Commission', icon: Landmark },
  { key: 'returns', label: `${taxLabel()} Returns`, icon: FileText },
  { key: 'trial', label: 'Trial Balance', icon: Scale },
  { key: 'pnl', label: 'Profit & Loss', icon: TrendingUp },
  { key: 'balance', label: 'Balance Sheet', icon: Landmark },
  { key: 'cashflow', label: 'Cash Flow', icon: Banknote },
  { key: 'aging', label: 'AR / AP Aging', icon: Hourglass },
  { key: 'budget', label: 'Budgeting', icon: Target },
  { key: 'gst', label: `${taxLabel()} Summary`, icon: Receipt },
  { key: 'vat', label: 'VAT Return', icon: Percent },
  { key: 'bank', label: 'Bank Reconciliation', icon: Wallet },
  { key: 'periods', label: 'Periods', icon: Lock },
  { key: 'ledger', label: 'Ledgers', icon: BookOpen },
  ];
  // "Deals & Commission" is the PROPERTY deal pipeline — deal value, offer to
  // handover, agent commission on a sale. This whole module is shared by every
  // vertical, so an insurance or coworking tenant was being shown a broking
  // surface for a business it is not in, next to its own commission screen that
  // means something else entirely. Ledgers, tax and statements are genuinely
  // universal; this one is not.
  const vertical = orgLocale().vertical;
  const propertyDesk = !vertical || vertical === 'REAL_ESTATE';
  // GSTR filings only exist under GST; the standalone VAT return only under VAT.
  return all.filter((t) => (
    t.key === 'commission' ? propertyDesk
      : t.key === 'returns' ? isGstRegime()
        : t.key === 'vat' ? !isGstRegime()
          : true
  ));
};

export function AccountingPanels() {
  const qc = useQueryClient();
  const [panel, setPanel] = useState<Panel>('dashboard');
  const backfill = useMutation({
    mutationFn: async () => (await api.post('/accounting/backfill')).data,
    onSuccess: (d: any) => { toast.success(`Posted ${d.posted} entries to the ledger`); qc.invalidateQueries(); },
    onError: (e) => toast.error(apiErrorMessage(e)),
  });

  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap', marginBottom: 16 }}>
        {tabsFor().map((t) => (
          <button key={t.key} onClick={() => setPanel(t.key)}
            style={{ display: 'inline-flex', alignItems: 'center', gap: 6, border: '1px solid var(--line-soft)', background: panel === t.key ? 'var(--brand,#132376)' : 'var(--surface)', color: panel === t.key ? '#fff' : 'var(--ink-2)', borderRadius: 10, padding: '7px 13px', fontSize: 13, fontWeight: 600, cursor: 'pointer' }}>
            <t.icon size={14} /> {t.label}
          </button>
        ))}
        <span style={{ flex: 1 }} />
        <button className="btn-secondary" style={{ height: 34 }} disabled={backfill.isPending} onClick={() => backfill.mutate()}>
          <RefreshCw size={14} /> {backfill.isPending ? 'Posting…' : 'Re-post ledger'}
        </button>
      </div>

      {panel === 'dashboard' && <DashboardPanel />}
      {panel === 'ai' && <AiPanel />}
      {panel === 'coa' && <CoaPanel />}
      {panel === 'journal' && <JournalPanel />}
      {panel === 'parties' && <PartiesPanel />}
      {panel === 'purchases' && <PurchasesPanel />}
      {panel === 'assets' && <FixedAssetsPanel />}
      {panel === 'commission' && <CommissionPanel />}
      {panel === 'trial' && <TrialBalancePanel />}
      {panel === 'pnl' && <PnlPanel />}
      {panel === 'balance' && <BalanceSheetPanel />}
      {panel === 'cashflow' && <CashFlowPanel />}
      {panel === 'aging' && <AgingPanel />}
      {panel === 'budget' && <BudgetPanel />}
      {panel === 'vat' && <VatPanel />}
      {panel === 'periods' && <PeriodsPanel />}
      {panel === 'gst' && <GstPanel />}
      {panel === 'returns' && <GstReturnsPanel />}
      {panel === 'bank' && <BankReconPanel />}
      {panel === 'ledger' && <LedgerPanel />}
    </div>
  );
}

function Empty() { return <div style={{ ...card, padding: 40, textAlign: 'center', color: 'var(--ink-3)', fontSize: 13.5 }}>No ledger activity yet — click <b>Re-post ledger</b> to post your invoices, payments and expenses.</div>; }

export function DashboardPanel() {
  const { data } = useQuery({ queryKey: ['acc-dash'], queryFn: async () => (await api.get('/accounting/dashboard')).data });
  if (!data) return null;
  const tiles = [
    { label: 'Revenue', value: data.revenue, accent: 'var(--success,#1e874b)' },
    { label: 'Expenses', value: data.expenses, accent: 'var(--danger,#c0392b)' },
    { label: 'Net profit', value: data.netProfit, accent: 'var(--brand,#132376)' },
    { label: `${taxLabel()} payable`, value: data.gstPayable, accent: 'var(--gold,#E6A23C)' },
    { label: 'Cash & bank', value: data.cash, accent: 'var(--ink-1)' },
    { label: 'Receivables', value: data.receivables, accent: 'var(--gold,#E6A23C)' },
    { label: 'Payables', value: data.payables, accent: 'var(--danger,#c0392b)' },
  ];
  return (
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(180px,1fr))', gap: 12 }}>
      {tiles.map((t) => (
        <div key={t.label} style={{ ...card, padding: 16 }}>
          <div style={{ fontSize: 12, color: 'var(--ink-3)', fontWeight: 600 }}>{t.label}</div>
          <div style={{ fontSize: 22, fontWeight: 800, marginTop: 6, color: t.accent }}>{money(t.value)}</div>
        </div>
      ))}
    </div>
  );
}

export function TrialBalancePanel() {
  const { data } = useQuery({ queryKey: ['acc-tb'], queryFn: async () => (await api.get('/accounting/trial-balance')).data });
  if (!data) return null;
  if (!data.rows.length) return <Empty />;
  return (
    <div style={{ ...card, overflow: 'hidden' }}>
      <div style={{ overflowX: 'auto' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead><tr><th style={th}>Code</th><th style={th}>Account</th><th style={{ ...th, textAlign: 'right' }}>Debit</th><th style={{ ...th, textAlign: 'right' }}>Credit</th></tr></thead>
          <tbody>
            {data.rows.map((r: any) => (
              <tr key={r.code}><td style={{ ...td, color: 'var(--ink-3)', fontVariantNumeric: 'tabular-nums' }}>{r.code}</td><td style={td}>{r.name}</td><td style={num}>{r.debit ? money(r.debit) : '—'}</td><td style={num}>{r.credit ? money(r.credit) : '—'}</td></tr>
            ))}
            <tr style={{ fontWeight: 800 }}><td style={td} /><td style={td}>Total</td><td style={num}>{money(data.totalDebit)}</td><td style={num}>{money(data.totalCredit)}</td></tr>
          </tbody>
        </table>
      </div>
      <BalancedBadge ok={data.balanced} label={data.balanced ? 'Trial balance is balanced (ΣDr = ΣCr)' : 'Out of balance'} />
    </div>
  );
}

export function PnlPanel() {
  const { data } = useQuery({ queryKey: ['acc-pnl'], queryFn: async () => (await api.get('/accounting/pnl')).data });
  if (!data) return null;
  const Section = ({ title, rows, total, color }: any) => (
    <div style={{ ...card, overflow: 'hidden' }}>
      <div style={{ padding: '10px 14px', fontWeight: 700, fontSize: 13.5, borderBottom: '1px solid var(--line-soft)' }}>{title}</div>
      <table style={{ width: '100%', borderCollapse: 'collapse' }}>
        <tbody>
          {rows.length ? rows.map((r: any) => <tr key={r.code}><td style={td}>{r.name}</td><td style={num}>{money(r.amount)}</td></tr>) : <tr><td style={{ ...td, color: 'var(--ink-3)' }}>None</td><td style={num}>—</td></tr>}
          <tr style={{ fontWeight: 800 }}><td style={td}>Total {title.toLowerCase()}</td><td style={{ ...num, color }}>{money(total)}</td></tr>
        </tbody>
      </table>
    </div>
  );
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
        <Section title="Income" rows={data.income} total={data.totalIncome} color="var(--success,#1e874b)" />
        <Section title="Expenses" rows={data.expense} total={data.totalExpense} color="var(--danger,#c0392b)" />
      </div>
      <div style={{ ...card, padding: 18, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <span style={{ fontWeight: 700, fontSize: 15 }}>Net {data.netProfit >= 0 ? 'Profit' : 'Loss'}</span>
        <span style={{ fontWeight: 800, fontSize: 22, color: data.netProfit >= 0 ? 'var(--success,#1e874b)' : 'var(--danger,#c0392b)' }}>{money(Math.abs(data.netProfit))}</span>
      </div>
    </div>
  );
}

export function BalanceSheetPanel() {
  const { data } = useQuery({ queryKey: ['acc-bs'], queryFn: async () => (await api.get('/accounting/balance-sheet')).data });
  if (!data) return null;
  const Group = ({ title, rows, total }: any) => (
    <div style={{ ...card, overflow: 'hidden' }}>
      <div style={{ padding: '10px 14px', fontWeight: 700, fontSize: 13.5, borderBottom: '1px solid var(--line-soft)' }}>{title}</div>
      <table style={{ width: '100%', borderCollapse: 'collapse' }}>
        <tbody>
          {rows.length ? rows.map((r: any, i: number) => <tr key={i}><td style={td}>{r.name}</td><td style={num}>{money(r.amount)}</td></tr>) : <tr><td style={{ ...td, color: 'var(--ink-3)' }}>None</td><td style={num}>—</td></tr>}
          <tr style={{ fontWeight: 800 }}><td style={td}>Total</td><td style={num}>{money(total)}</td></tr>
        </tbody>
      </table>
    </div>
  );
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14, alignItems: 'start' }}>
        <Group title="Assets" rows={data.assets} total={data.totalAssets} />
        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          <Group title="Liabilities" rows={data.liabilities} total={data.totalLiabilities} />
          <Group title="Equity" rows={data.equity} total={data.totalEquity} />
        </div>
      </div>
      <BalancedBadge ok={data.balanced} label={data.balanced ? `Balanced — Assets ${money(data.totalAssets)} = Liabilities + Equity` : 'Balance sheet does not tie out'} card />
    </div>
  );
}

export function GstPanel() {
  const { data } = useQuery({ queryKey: ['acc-gst'], queryFn: async () => (await api.get('/accounting/gst-summary')).data });
  if (!data) return null;
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
      <div style={{ ...card, overflow: 'hidden' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead><tr><th style={th}>Account</th><th style={th}>Type</th><th style={{ ...th, textAlign: 'right' }}>Amount</th></tr></thead>
          <tbody>
            {data.rows.length ? data.rows.map((r: any) => <tr key={r.code}><td style={td}>{r.name}</td><td style={{ ...td, color: 'var(--ink-3)' }}>{r.kind === 'INPUT_GST' ? 'Input (ITC)' : 'Output'}</td><td style={num}>{money(r.amount)}</td></tr>) : <tr><td style={{ ...td, color: 'var(--ink-3)' }} colSpan={3}>No tax posted yet.</td></tr>}
          </tbody>
        </table>
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 12 }}>
        <div style={{ ...card, padding: 16 }}><div style={{ fontSize: 12, color: 'var(--ink-3)', fontWeight: 600 }}>Output tax collected</div><div style={{ fontSize: 20, fontWeight: 800, marginTop: 4 }}>{money(data.outputTax)}</div></div>
        <div style={{ ...card, padding: 16 }}><div style={{ fontSize: 12, color: 'var(--ink-3)', fontWeight: 600 }}>Input tax credit</div><div style={{ fontSize: 20, fontWeight: 800, marginTop: 4 }}>{money(data.inputTaxCredit)}</div></div>
        <div style={{ ...card, padding: 16, background: 'color-mix(in srgb, var(--gold,#E6A23C) 10%, var(--surface))' }}><div style={{ fontSize: 12, color: 'var(--ink-3)', fontWeight: 600 }}>Net {taxLabel()} payable</div><div style={{ fontSize: 20, fontWeight: 800, marginTop: 4, color: 'var(--gold,#b8791f)' }}>{money(data.netPayable)}</div></div>
      </div>
    </div>
  );
}

export function GstReturnsPanel() {
  const gst = isGstRegime();
  const { data: g1 } = useQuery({ queryKey: ['gstr1'], enabled: gst, queryFn: async () => (await api.get('/accounting/gstr1')).data });
  const { data: g3 } = useQuery({ queryKey: ['gstr3b'], enabled: gst, queryFn: async () => (await api.get('/accounting/gstr3b')).data });
  if (!gst) return <div style={{ ...card, padding: 24, color: 'var(--ink-3)' }}>GSTR filings apply to GST-registered (Indian) organizations. This organization files under {taxLabel()} — use the {taxLabel()} Summary tab instead.</div>;
  const download = (name: string, obj: any) => {
    const blob = new Blob([JSON.stringify(obj, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob); const a = document.createElement('a');
    a.href = url; a.download = `${name}-${new Date().toISOString().slice(0, 10)}.json`; a.click(); URL.revokeObjectURL(url);
  };
  if (!g1 || !g3) return null;
  const gRow = (r: any, cols: any[]) => <tr>{cols.map((c, i) => <td key={i} style={c.num ? num : td}>{c.v}</td>)}</tr>;
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
      {/* GSTR-3B summary */}
      <div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
          <div style={{ fontWeight: 800, fontSize: 15 }}>GSTR-3B <span style={{ color: 'var(--ink-3)', fontWeight: 500, fontSize: 12.5 }}>· monthly summary</span></div>
          <span style={{ flex: 1 }} />
          <button className="btn-secondary" style={{ height: 30, fontSize: 12.5 }} onClick={() => download('GSTR-3B', g3)}><Download size={13} /> Export JSON</button>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 12 }}>
          <SummaryCard label="3.1(a) Outward tax" value={g3.outwardTaxableSupplies.total} sub={`Taxable ${money(g3.outwardTaxableSupplies.taxableValue)}`} />
          <SummaryCard label="4. Eligible ITC" value={g3.eligibleITC.total} sub={`On ${money(g3.eligibleITC.taxableValue)} purchases`} />
          <SummaryCard label="5.1 Net tax payable" value={g3.netTaxPayable.total} highlight sub={`IGST ${money(g3.netTaxPayable.igst)} · CGST ${money(g3.netTaxPayable.cgst)} · SGST ${money(g3.netTaxPayable.sgst)}`} />
        </div>
      </div>
      {/* GSTR-1 detail */}
      <div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
          <div style={{ fontWeight: 800, fontSize: 15 }}>GSTR-1 <span style={{ color: 'var(--ink-3)', fontWeight: 500, fontSize: 12.5 }}>· outward supplies · {g1.totals.invoices} invoices</span></div>
          <span style={{ flex: 1 }} />
          <button className="btn-secondary" style={{ height: 30, fontSize: 12.5 }} onClick={() => download('GSTR-1', g1)}><Download size={13} /> Export JSON</button>
        </div>
        <div style={{ ...card, overflow: 'hidden', marginBottom: 12 }}>
          <div style={{ padding: '8px 14px', fontSize: 12, fontWeight: 700, color: 'var(--ink-3)', letterSpacing: '.05em', textTransform: 'uppercase' }}>B2B — registered customers</div>
          <div style={{ overflowX: 'auto' }}><table style={{ width: '100%', borderCollapse: 'collapse', minWidth: 640 }}>
            <thead><tr><th style={th}>GSTIN</th><th style={th}>Customer</th><th style={{ ...th, textAlign: 'right' }}>Rate</th><th style={{ ...th, textAlign: 'right' }}>Taxable</th><th style={{ ...th, textAlign: 'right' }}>CGST</th><th style={{ ...th, textAlign: 'right' }}>SGST</th><th style={{ ...th, textAlign: 'right' }}>IGST</th></tr></thead>
            <tbody>{g1.b2b.length ? g1.b2b.map((r: any, i: number) => gRow(r, [{ v: r.gstin }, { v: r.customer }, { v: `${r.rate}%`, num: true }, { v: money(r.taxable), num: true }, { v: money(r.cgst), num: true }, { v: money(r.sgst), num: true }, { v: money(r.igst), num: true }])) : <tr><td style={{ ...td, color: 'var(--ink-3)' }} colSpan={7}>No B2B (GSTIN) invoices in this period.</td></tr>}</tbody>
          </table></div>
        </div>
        <div style={{ ...card, overflow: 'hidden' }}>
          <div style={{ padding: '8px 14px', fontSize: 12, fontWeight: 700, color: 'var(--ink-3)', letterSpacing: '.05em', textTransform: 'uppercase' }}>B2C — by rate & place of supply</div>
          <div style={{ overflowX: 'auto' }}><table style={{ width: '100%', borderCollapse: 'collapse', minWidth: 560 }}>
            <thead><tr><th style={th}>Rate</th><th style={th}>Place of supply</th><th style={{ ...th, textAlign: 'right' }}>Invoices</th><th style={{ ...th, textAlign: 'right' }}>Taxable</th><th style={{ ...th, textAlign: 'right' }}>CGST</th><th style={{ ...th, textAlign: 'right' }}>SGST</th><th style={{ ...th, textAlign: 'right' }}>IGST</th></tr></thead>
            <tbody>{g1.b2c.length ? g1.b2c.map((r: any, i: number) => gRow(r, [{ v: `${r.rate}%` }, { v: r.placeOfSupply }, { v: r.invoices, num: true }, { v: money(r.taxable), num: true }, { v: money(r.cgst), num: true }, { v: money(r.sgst), num: true }, { v: money(r.igst), num: true }])) : <tr><td style={{ ...td, color: 'var(--ink-3)' }} colSpan={7}>No B2C invoices in this period.</td></tr>}</tbody>
          </table></div>
        </div>
      </div>
    </div>
  );
}

function SummaryCard({ label, value, sub, highlight }: { label: string; value: number; sub?: string; highlight?: boolean }) {
  return (
    <div style={{ ...card, padding: 16, background: highlight ? 'color-mix(in srgb, var(--gold,#E6A23C) 10%, var(--surface))' : undefined }}>
      <div style={{ fontSize: 12, color: 'var(--ink-3)', fontWeight: 600 }}>{label}</div>
      <div style={{ fontSize: 22, fontWeight: 800, marginTop: 4, color: highlight ? 'var(--gold,#b8791f)' : undefined }}>{money(value)}</div>
      {sub && <div style={{ fontSize: 11, color: 'var(--ink-3)', marginTop: 4 }}>{sub}</div>}
    </div>
  );
}

export function LedgerPanel() {
  const { data: accounts } = useQuery({ queryKey: ['acc-coa'], queryFn: async () => (await api.get('/accounting/accounts')).data });
  const [accId, setAccId] = useState<string>('');
  const id = accId || accounts?.[0]?.id;
  const { data } = useQuery({ queryKey: ['acc-ledger', id], enabled: !!id, queryFn: async () => (await api.get(`/accounting/ledger/${id}`)).data });
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      <select value={id ?? ''} onChange={(e) => setAccId(e.target.value)} style={{ padding: '9px 12px', borderRadius: 10, border: '1px solid var(--line-soft)', background: 'var(--surface)', fontSize: 13.5, maxWidth: 340 }}>
        {(accounts ?? []).map((a: any) => <option key={a.id} value={a.id}>{a.code} — {a.name}</option>)}
      </select>
      <div style={{ ...card, overflow: 'hidden' }}>
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: 560 }}>
            <thead><tr><th style={th}>Date</th><th style={th}>Particulars</th><th style={{ ...th, textAlign: 'right' }}>Debit</th><th style={{ ...th, textAlign: 'right' }}>Credit</th><th style={{ ...th, textAlign: 'right' }}>Balance</th></tr></thead>
            <tbody>
              {data?.entries?.length ? data.entries.map((e: any, i: number) => (
                <tr key={i}><td style={{ ...td, color: 'var(--ink-3)', whiteSpace: 'nowrap' }}>{new Date(e.date).toLocaleDateString('en-IN', { day: '2-digit', month: 'short' })}</td><td style={td}>{e.memo}</td><td style={num}>{e.debit ? money(e.debit) : '—'}</td><td style={num}>{e.credit ? money(e.credit) : '—'}</td><td style={{ ...num, fontWeight: 700 }}>{money(e.balance)}</td></tr>
              )) : <tr><td style={{ ...td, color: 'var(--ink-3)' }} colSpan={5}>No entries in this account.</td></tr>}
            </tbody>
          </table>
        </div>
        {data && <div style={{ padding: '10px 14px', borderTop: '1px solid var(--line-soft)', display: 'flex', justifyContent: 'space-between', fontWeight: 700 }}><span>Closing balance</span><span style={{ fontVariantNumeric: 'tabular-nums' }}>{money(data.closingBalance)}</span></div>}
      </div>
    </div>
  );
}

function BalancedBadge({ ok, label, card: asCard }: { ok: boolean; label: string; card?: boolean }) {
  const inner = (
    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 12.5, fontWeight: 600, color: ok ? 'var(--success,#1e874b)' : 'var(--danger,#c0392b)' }}>
      {ok ? <CheckCircle2 size={14} /> : <AlertTriangle size={14} />} {label}
    </span>
  );
  return asCard ? <div style={{ ...card, padding: '12px 16px' }}>{inner}</div> : <div style={{ padding: '10px 14px', borderTop: '1px solid var(--line-soft)' }}>{inner}</div>;
}

// ---- Customers & Vendors (party master) ----
export function PartiesPanel() {
  const qc = useQueryClient();
  const [kind, setKind] = useState<'CUSTOMER' | 'VENDOR'>('CUSTOMER');
  const [open, setOpen] = useState(false);
  const { data } = useQuery({ queryKey: ['acc-parties', kind], queryFn: async () => (await api.get('/purchasing/parties', { params: { kind } })).data });
  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 14 }}>
        {(['CUSTOMER', 'VENDOR'] as const).map((k) => (
          <button key={k} onClick={() => setKind(k)} style={{ border: '1px solid var(--line-soft)', background: kind === k ? 'var(--surface-2)' : 'var(--surface)', color: kind === k ? 'var(--brand,#132376)' : 'var(--ink-2)', borderRadius: 9, padding: '6px 14px', fontSize: 13, fontWeight: 600, cursor: 'pointer' }}>{k === 'CUSTOMER' ? 'Customers' : 'Vendors'}</button>
        ))}
        <span style={{ flex: 1 }} />
        <button className="btn-primary" onClick={() => setOpen(true)}><Plus size={15} /> New {kind === 'CUSTOMER' ? 'customer' : 'vendor'}</button>
      </div>
      {!(data ?? []).length ? <div style={{ ...card, padding: 34, textAlign: 'center', color: 'var(--ink-3)', fontSize: 13.5 }}>No {kind.toLowerCase()}s yet.</div> : (
        <div style={{ ...card, overflow: 'hidden' }}>
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: 560 }}>
              <thead><tr><th style={th}>Name</th><th style={th}>GSTIN</th><th style={th}>PAN</th><th style={th}>Phone</th><th style={{ ...th, textAlign: 'right' }}>{kind === 'CUSTOMER' ? 'Credit limit' : 'Terms'}</th></tr></thead>
              <tbody>
                {data.map((p: any) => (
                  <tr key={p.id}><td style={{ ...td, fontWeight: 600 }}>{p.name}</td><td style={{ ...td, fontVariantNumeric: 'tabular-nums' }}>{p.gstin ?? '—'}</td><td style={td}>{p.pan ?? '—'}</td><td style={td}>{p.phone ?? '—'}</td><td style={num}>{kind === 'CUSTOMER' ? money(p.creditLimitInr) : `${p.paymentTermsDays}d`}</td></tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
      {open && <PartyModal kind={kind} onClose={() => setOpen(false)} onDone={() => { qc.invalidateQueries({ queryKey: ['acc-parties'] }); setOpen(false); }} />}
    </div>
  );
}

function PartyModal({ kind, onClose, onDone }: { kind: string; onClose: () => void; onDone: () => void }) {
  const [f, setF] = useState<any>({ name: '', gstin: '', pan: '', phone: '', email: '', stateCode: '', creditLimitInr: '', paymentTermsDays: '', bankDetails: '' });
  const save = useMutation({
    mutationFn: async () => (await api.post('/purchasing/parties', { kind, name: f.name, gstin: f.gstin || undefined, pan: f.pan || undefined, phone: f.phone || undefined, email: f.email || undefined, stateCode: f.stateCode || undefined, bankDetails: f.bankDetails || undefined, creditLimitInr: Number(f.creditLimitInr) || 0, paymentTermsDays: Number(f.paymentTermsDays) || 0 })).data,
    onSuccess: () => { toast.success(`${kind === 'CUSTOMER' ? 'Customer' : 'Vendor'} saved`); onDone(); },
    onError: (e) => toast.error(apiErrorMessage(e)),
  });
  const inp: React.CSSProperties = { width: '100%', padding: '9px 11px', borderRadius: 9, border: '1px solid var(--line-soft)', background: 'var(--surface)', fontSize: 13.5 };
  return (
    <Modal title={`New ${kind === 'CUSTOMER' ? 'customer' : 'vendor'}`} onClose={onClose}>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
        <div style={{ gridColumn: '1 / -1' }}><L>Name</L><input style={inp} value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} /></div>
        <div><L>GSTIN</L><input style={inp} value={f.gstin} onChange={(e) => setF({ ...f, gstin: e.target.value.toUpperCase() })} placeholder="27AAECA1234F1Z5" /></div>
        <div><L>PAN</L><input style={inp} value={f.pan} onChange={(e) => setF({ ...f, pan: e.target.value.toUpperCase() })} /></div>
        <div><L>Phone</L><input style={inp} value={f.phone} onChange={(e) => setF({ ...f, phone: e.target.value })} /></div>
        <div><L>State code</L><input style={inp} value={f.stateCode} onChange={(e) => setF({ ...f, stateCode: e.target.value })} placeholder="27" /></div>
        {kind === 'CUSTOMER'
          ? <div><L>Credit limit ({cur()})</L><input style={inp} value={f.creditLimitInr} onChange={(e) => setF({ ...f, creditLimitInr: e.target.value })} /></div>
          : <div><L>Bank / UPI</L><input style={inp} value={f.bankDetails} onChange={(e) => setF({ ...f, bankDetails: e.target.value })} /></div>}
        <div><L>Payment terms (days)</L><input style={inp} value={f.paymentTermsDays} onChange={(e) => setF({ ...f, paymentTermsDays: e.target.value })} /></div>
      </div>
      <button className="btn-primary" style={{ marginTop: 14, width: '100%' }} disabled={!f.name || save.isPending} onClick={() => save.mutate()}>{save.isPending ? 'Saving…' : 'Save'}</button>
    </Modal>
  );
}

// ---- Purchase bills (payables) ----
export function PurchasesPanel() {
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [payFor, setPayFor] = useState<any>(null);
  const { data } = useQuery({ queryKey: ['acc-bills'], queryFn: async () => (await api.get('/purchasing/bills')).data });
  const STATUS: Record<string, { bg: string; fg: string }> = { UNPAID: { bg: 'var(--danger-bg,#fce8e8)', fg: 'var(--danger,#c0392b)' }, PARTIAL: { bg: 'var(--warn-bg,#fdf3e3)', fg: 'var(--gold,#b8791f)' }, PAID: { bg: 'var(--success-bg,#e6f4ea)', fg: 'var(--success,#1e874b)' } };
  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', marginBottom: 14 }}>
        <div style={{ fontSize: 13.5, color: 'var(--ink-3)' }}>Vendor bills post Input GST (ITC) and Accounts Payable to the ledger.</div>
        <span style={{ flex: 1 }} />
        <button className="btn-primary" onClick={() => setOpen(true)}><Plus size={15} /> New bill</button>
      </div>
      {!(data ?? []).length ? <div style={{ ...card, padding: 34, textAlign: 'center', color: 'var(--ink-3)', fontSize: 13.5 }}>No purchase bills yet.</div> : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {data.map((b: any) => (
            <div key={b.id} style={{ ...card, padding: 15, display: 'flex', alignItems: 'center', gap: 14 }}>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <span style={{ fontWeight: 700, fontSize: 14.5 }}>{b.billNumber}</span>
                  <span className="badge" style={{ background: STATUS[b.status]?.bg, color: STATUS[b.status]?.fg }}>{b.status}</span>
                  {b.interState ? <span className="badge" style={{ background: 'var(--surface-2)', color: 'var(--ink-3)' }}>IGST</span> : <span className="badge" style={{ background: 'var(--surface-2)', color: 'var(--ink-3)' }}>CGST+SGST</span>}
                </div>
                <div style={{ fontSize: 12, color: 'var(--ink-3)', marginTop: 3 }}>{b.vendor?.name} · tax {money(b.cgstInr + b.sgstInr + b.igstInr)} · {b._count?.items ?? 0} items</div>
              </div>
              <div style={{ textAlign: 'right' }}>
                <div style={{ fontWeight: 800, fontSize: 16, color: 'var(--brand,#132376)' }}>{money(b.totalInr)}</div>
                {b.amountPaidInr > 0 && b.status !== 'PAID' && <div style={{ fontSize: 11.5, color: 'var(--ink-3)' }}>{money(b.amountPaidInr)} paid</div>}
              </div>
              {b.status !== 'PAID' && <button className="btn-secondary" style={{ height: 32 }} onClick={() => setPayFor(b)}>Pay</button>}
            </div>
          ))}
        </div>
      )}
      {open && <BillModal onClose={() => setOpen(false)} onDone={() => { qc.invalidateQueries({ queryKey: ['acc-bills'] }); setOpen(false); }} />}
      {payFor && <PayBillModal bill={payFor} onClose={() => setPayFor(null)} onDone={() => { qc.invalidateQueries({ queryKey: ['acc-bills'] }); setPayFor(null); }} />}
    </div>
  );
}

function BillModal({ onClose, onDone }: { onClose: () => void; onDone: () => void }) {
  const { data: vendors } = useQuery({ queryKey: ['acc-parties', 'VENDOR'], queryFn: async () => (await api.get('/purchasing/parties', { params: { kind: 'VENDOR' } })).data });
  const [vendorId, setVendorId] = useState('');
  const [interState, setInterState] = useState(false);
  const [items, setItems] = useState<any[]>([{ description: '', quantity: 1, unitPriceInr: '', gstRate: 18 }]);
  const save = useMutation({
    mutationFn: async () => (await api.post('/purchasing/bills', { vendorId, interState, items: items.map((i) => ({ description: i.description, hsnSac: i.hsnSac || undefined, quantity: Number(i.quantity) || 1, unitPriceInr: Number(i.unitPriceInr) || 0, gstRate: Number(i.gstRate) || 18 })) })).data,
    onSuccess: () => { toast.success('Bill posted'); onDone(); }, onError: (e) => toast.error(apiErrorMessage(e)),
  });
  const inp: React.CSSProperties = { width: '100%', padding: '8px 10px', borderRadius: 8, border: '1px solid var(--line-soft)', background: 'var(--surface)', fontSize: 13 };
  const sub = items.reduce((s, i) => s + (Number(i.quantity) || 1) * (Number(i.unitPriceInr) || 0), 0);
  const tax = items.reduce((s, i) => s + Math.round(((Number(i.quantity) || 1) * (Number(i.unitPriceInr) || 0) * (Number(i.gstRate) || 18)) / 100), 0);
  return (
    <Modal title="New purchase bill" onClose={onClose} wide>
      <div style={{ display: 'flex', gap: 10, marginBottom: 10 }}>
        <div style={{ flex: 1 }}><L>Vendor</L><select style={inp} value={vendorId} onChange={(e) => setVendorId(e.target.value)}><option value="">Select vendor…</option>{(vendors ?? []).map((v: any) => <option key={v.id} value={v.id}>{v.name}</option>)}</select></div>
        <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 13, alignSelf: 'flex-end', paddingBottom: 8 }}><input type="checkbox" checked={interState} onChange={(e) => setInterState(e.target.checked)} /> Inter-state (IGST)</label>
      </div>
      {items.map((it, idx) => (
        <div key={idx} style={{ display: 'grid', gridTemplateColumns: '2fr 1fr 1fr 0.8fr auto', gap: 6, marginBottom: 6 }}>
          <input style={inp} placeholder="Description" value={it.description} onChange={(e) => setItems(items.map((x, i) => i === idx ? { ...x, description: e.target.value } : x))} />
          <input style={inp} placeholder="Qty" value={it.quantity} onChange={(e) => setItems(items.map((x, i) => i === idx ? { ...x, quantity: e.target.value } : x))} />
          <input style={inp} placeholder="Unit price" value={it.unitPriceInr} onChange={(e) => setItems(items.map((x, i) => i === idx ? { ...x, unitPriceInr: e.target.value } : x))} />
          <input style={inp} placeholder="GST%" value={it.gstRate} onChange={(e) => setItems(items.map((x, i) => i === idx ? { ...x, gstRate: e.target.value } : x))} />
          <button onClick={() => setItems(items.filter((_, i) => i !== idx))} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--ink-3)' }}><Trash2 size={15} /></button>
        </div>
      ))}
      <button className="btn-secondary" style={{ height: 30, fontSize: 12.5, marginTop: 2 }} onClick={() => setItems([...items, { description: '', quantity: 1, unitPriceInr: '', gstRate: 18 }])}><Plus size={13} /> Add line</button>
      <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 18, marginTop: 12, fontSize: 13.5 }}>
        <span style={{ color: 'var(--ink-3)' }}>Subtotal {money(sub)}</span><span style={{ color: 'var(--ink-3)' }}>GST {money(tax)}</span><span style={{ fontWeight: 800 }}>Total {money(sub + tax)}</span>
      </div>
      <button className="btn-primary" style={{ marginTop: 12, width: '100%' }} disabled={!vendorId || save.isPending || sub <= 0} onClick={() => save.mutate()}>{save.isPending ? 'Posting…' : 'Post bill'}</button>
    </Modal>
  );
}

function PayBillModal({ bill, onClose, onDone }: { bill: any; onClose: () => void; onDone: () => void }) {
  const due = bill.totalInr - bill.amountPaidInr;
  const [amount, setAmount] = useState(String(due));
  const [method, setMethod] = useState('BANK');
  const pay = useMutation({
    mutationFn: async () => (await api.post(`/purchasing/bills/${bill.id}/pay`, { amountInr: Number(amount), method })).data,
    onSuccess: () => { toast.success('Payment recorded'); onDone(); }, onError: (e) => toast.error(apiErrorMessage(e)),
  });
  const inp: React.CSSProperties = { width: '100%', padding: '9px 11px', borderRadius: 9, border: '1px solid var(--line-soft)', background: 'var(--surface)', fontSize: 13.5 };
  return (
    <Modal title={`Pay ${bill.billNumber}`} onClose={onClose}>
      <div style={{ fontSize: 13, color: 'var(--ink-3)', marginBottom: 10 }}>Outstanding: <b>{money(due)}</b></div>
      <L>Amount ({cur()})</L><input style={inp} value={amount} onChange={(e) => setAmount(e.target.value)} />
      <div style={{ marginTop: 10 }}><L>Method</L><select style={inp} value={method} onChange={(e) => setMethod(e.target.value)}>{['BANK', 'CASH', 'UPI', 'CHEQUE'].map((m) => <option key={m}>{m}</option>)}</select></div>
      <button className="btn-primary" style={{ marginTop: 14, width: '100%' }} disabled={pay.isPending || Number(amount) <= 0} onClick={() => pay.mutate()}>{pay.isPending ? 'Recording…' : `Pay ${money(Number(amount) || 0)}`}</button>
    </Modal>
  );
}

function Modal({ title, onClose, children, wide }: { title: string; onClose: () => void; children: React.ReactNode; wide?: boolean }) {
  return (
    <div onClick={onClose} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,.4)', zIndex: 100, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }}>
      <div onClick={(e) => e.stopPropagation()} style={{ ...card, width: wide ? 640 : 440, maxWidth: '100%', maxHeight: '90vh', overflowY: 'auto', padding: 20 }}>
        <div style={{ display: 'flex', alignItems: 'center', marginBottom: 14 }}><h3 style={{ margin: 0, fontSize: 17, fontWeight: 700 }}>{title}</h3><span style={{ flex: 1 }} /><button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--ink-3)' }}><X size={18} /></button></div>
        {children}
      </div>
    </div>
  );
}
function L({ children }: { children: React.ReactNode }) { return <label style={{ display: 'block', fontSize: 11.5, fontWeight: 600, color: 'var(--ink-3)', marginBottom: 4 }}>{children}</label>; }

export function CommissionPanel() {
  const qc = useQueryClient();
  const { data: sum } = useQuery({ queryKey: ['comm-sum'], queryFn: async () => (await api.get('/commission/summary')).data });
  const { data: deals } = useQuery({ queryKey: ['comm-deals'], queryFn: async () => (await api.get('/commission/deals')).data });
  const [form, setForm] = useState<any>({ clientName: '', agentName: '', dealType: 'SALE', dealValueInr: '', agencyCommissionPct: 2, agentCommissionPct: 30, referralCommissionPct: 0, gstPct: 18 });
  const [show, setShow] = useState(false);
  const inval = () => qc.invalidateQueries();
  const create = useMutation({ mutationFn: async () => (await api.post('/commission/deals', { ...form, dealValueInr: Number(form.dealValueInr) })).data, onSuccess: () => { setShow(false); setForm({ ...form, clientName: '', dealValueInr: '' }); inval(); toast.success('Deal created'); }, onError: (e) => toast.error(apiErrorMessage(e)) });
  const close = useMutation({ mutationFn: async (id: string) => (await api.post(`/commission/deals/${id}/close`)).data, onSuccess: () => { inval(); toast.success('Deal closed — brokerage invoiced, commission accrued'); }, onError: (e) => toast.error(apiErrorMessage(e)) });
  const payout = useMutation({ mutationFn: async ({ id, amt }: { id: string; amt: number }) => (await api.post(`/commission/deals/${id}/payout`, { amountInr: amt })).data, onSuccess: () => { inval(); toast.success('Commission paid out'); }, onError: (e) => toast.error(apiErrorMessage(e)) });
  const book = useMutation({ mutationFn: async (id: string) => (await api.post(`/commission/deals/${id}/book`, { reservationFeeInr: 0 })).data, onSuccess: () => { inval(); toast.success('Booked'); }, onError: (e) => toast.error(apiErrorMessage(e)) });
  const contract = useMutation({ mutationFn: async (id: string) => (await api.post(`/commission/deals/${id}/contract`)).data, onSuccess: () => { inval(); toast.success('Contract signed'); }, onError: (e) => toast.error(apiErrorMessage(e)) });
  const handover = useMutation({ mutationFn: async (id: string) => (await api.post(`/commission/deals/${id}/handover`)).data, onSuccess: () => { inval(); toast.success('Handed over'); }, onError: (e) => toast.error(apiErrorMessage(e)) });
  const STAGES = ['OFFER', 'BOOKING', 'CONTRACT', 'CLOSED', 'HANDOVER'];
  const inp: React.CSSProperties = { padding: '9px 11px', borderRadius: 9, border: '1px solid var(--line-soft)', background: 'var(--surface)', fontSize: 13 };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 12 }}>
        <div style={{ ...card, padding: 16 }}><div style={{ fontSize: 12, color: 'var(--ink-3)', fontWeight: 600 }}>Brokerage income</div><div style={{ fontSize: 20, fontWeight: 800, marginTop: 4 }}>{money(sum?.brokerageIncome ?? 0)}</div></div>
        <div style={{ ...card, padding: 16 }}><div style={{ fontSize: 12, color: 'var(--ink-3)', fontWeight: 600 }}>Commission payable</div><div style={{ fontSize: 20, fontWeight: 800, marginTop: 4, color: 'var(--danger,#c0392b)' }}>{money(sum?.commissionPayable ?? 0)}</div></div>
        <div style={{ ...card, padding: 16 }}><div style={{ fontSize: 12, color: 'var(--ink-3)', fontWeight: 600 }}>Open pipeline</div><div style={{ fontSize: 20, fontWeight: 800, marginTop: 4 }}>{money(sum?.pipelineValue ?? 0)}</div><div style={{ fontSize: 11, color: 'var(--ink-3)' }}>{sum?.openDeals ?? 0} open deals</div></div>
        <div style={{ ...card, padding: 16 }}><div style={{ fontSize: 12, color: 'var(--ink-3)', fontWeight: 600 }}>Closed value</div><div style={{ fontSize: 20, fontWeight: 800, marginTop: 4 }}>{money(sum?.closedValue ?? 0)}</div><div style={{ fontSize: 11, color: 'var(--ink-3)' }}>{sum?.closedDeals ?? 0} closed</div></div>
      </div>

      <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
        <button className="btn-primary" onClick={() => setShow((v) => !v)}>{show ? <X size={15} /> : <Plus size={15} />} {show ? 'Cancel' : 'New deal'}</button>
      </div>
      {show && (
        <div style={{ ...card, padding: 16, display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 10 }}>
          <input placeholder="Client name" value={form.clientName} onChange={(e) => setForm({ ...form, clientName: e.target.value })} style={inp} />
          <input placeholder="Agent name" value={form.agentName} onChange={(e) => setForm({ ...form, agentName: e.target.value })} style={inp} />
          <select value={form.dealType} onChange={(e) => setForm({ ...form, dealType: e.target.value })} style={inp}><option value="SALE">Sale</option><option value="RENT">Rent</option></select>
          <input placeholder="Deal value" type="number" value={form.dealValueInr} onChange={(e) => setForm({ ...form, dealValueInr: e.target.value })} style={inp} />
          <input placeholder="Agency %" type="number" value={form.agencyCommissionPct} onChange={(e) => setForm({ ...form, agencyCommissionPct: Number(e.target.value) })} style={inp} />
          <input placeholder="Agent share %" type="number" value={form.agentCommissionPct} onChange={(e) => setForm({ ...form, agentCommissionPct: Number(e.target.value) })} style={inp} />
          <button className="btn-primary" style={{ gridColumn: '1 / -1' }} disabled={create.isPending || !form.clientName || !form.dealValueInr} onClick={() => create.mutate()}>Create deal</button>
        </div>
      )}

      <div style={{ ...card, overflow: 'hidden' }}>
        <div style={{ overflowX: 'auto' }}><table style={{ width: '100%', borderCollapse: 'collapse', minWidth: 780 }}>
          <thead><tr><th style={th}>Ref</th><th style={th}>Client</th><th style={th}>Type</th><th style={{ ...th, textAlign: 'right' }}>Value</th><th style={{ ...th, textAlign: 'right' }}>Agency</th><th style={{ ...th, textAlign: 'right' }}>Payable</th><th style={th}>Pipeline</th><th style={th}></th></tr></thead>
          <tbody>{(deals ?? []).length ? deals.map((d: any) => {
            const payable = d.agentCommissionInr + d.referralCommissionInr - d.commissionPaidInr;
            return (
              <tr key={d.id}>
                <td style={{ ...td, fontWeight: 700 }}>{d.reference}</td><td style={td}>{d.clientName}{d.agentName ? <span style={{ color: 'var(--ink-3)', fontSize: 12 }}> · {d.agentName}</span> : null}</td>
                <td style={{ ...td, color: 'var(--ink-3)' }}>{d.dealType}</td><td style={num}>{money(d.dealValueInr)}</td>
                <td style={num}>{d.status === 'CLOSED' ? money(d.agencyCommissionInr) : `${d.agencyCommissionPct}%`}</td>
                <td style={{ ...num, color: payable > 0 ? 'var(--danger,#c0392b)' : 'var(--ink-3)' }}>{d.status === 'CLOSED' ? money(payable) : '—'}</td>
                <td style={td}>
                  {d.status === 'CANCELLED' ? <span className="badge" style={{ background: 'var(--danger-bg,#fce8e8)', color: 'var(--danger,#c0392b)' }}>Cancelled</span> : (
                    <div style={{ display: 'inline-flex', gap: 3, alignItems: 'center' }}>
                      {STAGES.map((sname) => { const at = STAGES.indexOf(d.stage ?? 'OFFER'); const i = STAGES.indexOf(sname); const done = i <= at; return <span key={sname} title={sname} style={{ width: 22, height: 5, borderRadius: 99, background: done ? (d.stage === 'HANDOVER' ? 'var(--success,#1e874b)' : 'var(--brand,#132376)') : 'var(--surface-2)' }} />; })}
                      <span style={{ fontSize: 11, color: 'var(--ink-3)', marginLeft: 4 }}>{(d.stage ?? 'OFFER').charAt(0) + (d.stage ?? 'OFFER').slice(1).toLowerCase()}</span>
                    </div>
                  )}
                </td>
                <td style={{ ...td, textAlign: 'right', whiteSpace: 'nowrap' }}>
                  {d.status !== 'CANCELLED' && d.stage === 'OFFER' && <button className="btn-secondary" style={{ height: 28, fontSize: 12 }} disabled={book.isPending} onClick={() => book.mutate(d.id)}>Book →</button>}
                  {d.stage === 'BOOKING' && <button className="btn-secondary" style={{ height: 28, fontSize: 12 }} disabled={contract.isPending} onClick={() => contract.mutate(d.id)}>Contract →</button>}
                  {d.stage === 'CONTRACT' && <button className="btn-secondary" style={{ height: 28, fontSize: 12 }} disabled={close.isPending} onClick={() => close.mutate(d.id)}>Close →</button>}
                  {d.stage === 'CLOSED' && (payable > 0
                    ? <button className="btn-secondary" style={{ height: 28, fontSize: 12 }} disabled={payout.isPending} onClick={() => payout.mutate({ id: d.id, amt: payable })}>Pay {money(payable)}</button>
                    : <button className="btn-secondary" style={{ height: 28, fontSize: 12 }} disabled={handover.isPending} onClick={() => handover.mutate(d.id)}>Handover →</button>)}
                </td>
              </tr>
            );
          }) : <tr><td style={{ ...td, color: 'var(--ink-3)' }} colSpan={8}>No deals yet — create one to start the commission pipeline.</td></tr>}</tbody>
        </table></div>
      </div>
    </div>
  );
}

export function BankReconPanel() {
  const qc = useQueryClient();
  const { data } = useQuery({ queryKey: ['bank-rec'], queryFn: async () => (await api.get('/accounting/bank/reconciliation')).data });
  const [csv, setCsv] = useState('');
  const [showImport, setShowImport] = useState(false);
  const inval = () => qc.invalidateQueries({ queryKey: ['bank-rec'] });
  const doImport = useMutation({
    mutationFn: async () => {
      const lines = csv.split('\n').map((r) => r.trim()).filter(Boolean).map((r) => {
        const [date, description, amountInr, reference] = r.split(',').map((x) => x.trim());
        return { date, description, amountInr: Number(amountInr), reference };
      });
      return (await api.post('/accounting/bank/import', { lines })).data;
    },
    onSuccess: (d: any) => { setShowImport(false); setCsv(''); inval(); toast.success(`Imported ${d.imported} lines`); }, onError: (e) => toast.error(apiErrorMessage(e)),
  });
  const auto = useMutation({ mutationFn: async () => (await api.post('/accounting/bank/auto-match')).data, onSuccess: (d: any) => { inval(); toast.success(`Auto-matched ${d.matched} lines`); }, onError: (e) => toast.error(apiErrorMessage(e)) });
  const match = useMutation({ mutationFn: async ({ id, txnId }: { id: string; txnId: string }) => (await api.post(`/accounting/bank/lines/${id}/match`, { txnId })).data, onSuccess: () => { inval(); toast.success('Matched'); }, onError: (e) => toast.error(apiErrorMessage(e)) });
  const unmatch = useMutation({ mutationFn: async (id: string) => (await api.post(`/accounting/bank/lines/${id}/unmatch`)).data, onSuccess: () => { inval(); }, onError: (e) => toast.error(apiErrorMessage(e)) });
  const adjust = useMutation({ mutationFn: async ({ id, code }: { id: string; code: string }) => (await api.post(`/accounting/bank/lines/${id}/adjust`, { accountCode: code })).data, onSuccess: () => { inval(); toast.success('Posted to the ledger & reconciled'); }, onError: (e) => toast.error(apiErrorMessage(e)) });
  if (!data) return null;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 12 }}>
        <SummaryCard label="Book balance (ledger)" value={data.bookBalance} sub="Bank a/c 1010" />
        <SummaryCard label="Statement balance" value={data.statementBalance} sub={`${data.statementLines.length} lines`} />
        <SummaryCard label="Uncleared / opening" value={data.unclearedNet} sub="Book items not on statement" />
        <div style={{ ...card, padding: 16, background: data.reconciled ? 'var(--success-bg,#e6f4ea)' : 'color-mix(in srgb, var(--gold,#E6A23C) 10%, var(--surface))' }}>
          <div style={{ fontSize: 12, color: 'var(--ink-3)', fontWeight: 600 }}>Status</div>
          <div style={{ fontSize: 18, fontWeight: 800, marginTop: 6, color: data.reconciled ? 'var(--success,#1e874b)' : 'var(--gold,#b8791f)' }}>{data.reconciled ? '✓ Reconciled' : `${data.unmatchedStatementLines} to clear`}</div>
        </div>
      </div>

      <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
        <button className="btn-secondary" disabled={auto.isPending} onClick={() => auto.mutate()}><RefreshCw size={14} /> Auto-match</button>
        <button className="btn-primary" onClick={() => setShowImport((v) => !v)}>{showImport ? <X size={15} /> : <Plus size={15} />} {showImport ? 'Cancel' : 'Import statement'}</button>
      </div>
      {showImport && (
        <div style={{ ...card, padding: 16, display: 'flex', flexDirection: 'column', gap: 8 }}>
          <div style={{ fontSize: 12, color: 'var(--ink-3)' }}>One line per row: <code>date, description, amount, reference</code> — amount positive for money in, negative for money out.</div>
          <textarea rows={4} placeholder={'2026-07-10, NEFT credit, 33663, UTR001\n2026-07-12, Bank charges, -236'} value={csv} onChange={(e) => setCsv(e.target.value)} style={{ padding: '9px 11px', borderRadius: 9, border: '1px solid var(--line-soft)', background: 'var(--surface)', fontSize: 13, fontFamily: 'monospace', resize: 'vertical' }} />
          <button className="btn-primary" style={{ alignSelf: 'flex-start' }} disabled={doImport.isPending || !csv.trim()} onClick={() => doImport.mutate()}>Import</button>
        </div>
      )}

      <div style={{ ...card, overflow: 'hidden' }}>
        <div style={{ padding: '8px 14px', fontSize: 12, fontWeight: 700, color: 'var(--ink-3)', letterSpacing: '.05em', textTransform: 'uppercase' }}>Bank statement lines</div>
        <div style={{ overflowX: 'auto' }}><table style={{ width: '100%', borderCollapse: 'collapse', minWidth: 720 }}>
          <thead><tr><th style={th}>Date</th><th style={th}>Description</th><th style={{ ...th, textAlign: 'right' }}>Amount</th><th style={th}>Status</th><th style={th}></th></tr></thead>
          <tbody>{data.statementLines.length ? data.statementLines.map((l: any) => {
            const bm = data.bookMovements.find((m: any) => m.txnId === l.suggestedTxnId);
            return (
              <tr key={l.id}>
                <td style={{ ...td, color: 'var(--ink-3)', whiteSpace: 'nowrap' }}>{new Date(l.date).toLocaleDateString('en-IN', { day: '2-digit', month: 'short' })}</td>
                <td style={td}>{l.description}{l.reference ? <span style={{ color: 'var(--ink-3)', fontSize: 12 }}> · {l.reference}</span> : null}</td>
                <td style={{ ...num, color: l.amountInr < 0 ? 'var(--danger,#c0392b)' : 'var(--success,#1e874b)' }}>{l.amountInr < 0 ? '−' : '+'}{money(Math.abs(l.amountInr))}</td>
                <td style={td}>{l.reconciled ? <span className="badge" style={{ background: 'var(--success-bg,#e6f4ea)', color: 'var(--success,#1e874b)' }}>✓ Cleared</span> : <span className="badge" style={{ background: 'var(--surface-2)', color: 'var(--ink-3)' }}>Unmatched</span>}</td>
                <td style={{ ...td, textAlign: 'right', whiteSpace: 'nowrap' }}>
                  {l.reconciled ? <button className="btn-secondary" style={{ height: 26, fontSize: 11 }} onClick={() => unmatch.mutate(l.id)}>Unmatch</button>
                    : l.suggestedTxnId ? <button className="btn-secondary" style={{ height: 26, fontSize: 11 }} title={bm?.memo} onClick={() => match.mutate({ id: l.id, txnId: l.suggestedTxnId })}>Match “{(bm?.memo ?? '').slice(0, 18)}”</button>
                    : <button className="btn-secondary" style={{ height: 26, fontSize: 11 }} onClick={() => adjust.mutate({ id: l.id, code: l.amountInr < 0 ? '5900' : '4100' })}>Post {l.amountInr < 0 ? 'as expense' : 'as income'}</button>}
                </td>
              </tr>
            );
          }) : <tr><td style={{ ...td, color: 'var(--ink-3)' }} colSpan={5}>Import a bank statement to start reconciling.</td></tr>}</tbody>
        </table></div>
      </div>
    </div>
  );
}

export function AiPanel() {
  const { data: fc } = useQuery({ queryKey: ['ai-cashflow'], queryFn: async () => (await api.get('/accounting/ai/cashflow-forecast')).data });
  const { data: ins } = useQuery({ queryKey: ['ai-insights'], queryFn: async () => (await api.get('/accounting/ai/insights')).data });
  if (!fc || !ins) return null;
  const maxAbs = Math.max(1, ...fc.weeks.map((w: any) => Math.abs(w.closingBalance)));
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      <div style={{ ...card, padding: 16 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10 }}>
          <Sparkles size={16} style={{ color: 'var(--gold,#E6A23C)' }} />
          <div style={{ fontWeight: 800, fontSize: 15 }}>Financial insights</div>
          <span className="badge" style={{ background: 'var(--surface-2)', color: 'var(--ink-3)' }}>{ins.aiProvider === 'ANTHROPIC' ? 'AI' : 'Rule-based'}</span>
        </div>
        <ul style={{ margin: 0, paddingLeft: 18, display: 'flex', flexDirection: 'column', gap: 6 }}>
          {ins.insights.map((i: string, k: number) => <li key={k} style={{ fontSize: 13.5 }}>{i}</li>)}
        </ul>
      </div>

      <div style={{ ...card, padding: 16 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
          <div style={{ fontWeight: 800, fontSize: 15 }}>8-week cash-flow forecast</div>
          <span style={{ flex: 1 }} />
          <span style={{ fontSize: 12, color: 'var(--ink-3)' }}>Opening {money(fc.openingCash)}</span>
        </div>
        <div style={{ fontSize: 12, color: fc.minBalance < 0 ? 'var(--danger,#c0392b)' : 'var(--ink-3)', marginBottom: 12 }}>
          Lowest projected balance <b>{money(fc.minBalance)}</b> in week {fc.minBalanceWeek} · receipts {money(fc.totalInflow)} · payments {money(fc.totalOutflow)}
        </div>
        <div style={{ display: 'flex', alignItems: 'flex-end', gap: 6, height: 120 }}>
          {fc.weeks.map((w: any, k: number) => {
            const h = Math.max(3, Math.round((Math.abs(w.closingBalance) / maxAbs) * 108));
            const neg = w.closingBalance < 0;
            return (
              <div key={k} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4 }} title={`Week ${k + 1}: ${money(w.closingBalance)} (in ${money(w.inflow)} / out ${money(w.outflow)})`}>
                <div style={{ width: '100%', height: h, borderRadius: 6, background: neg ? 'var(--danger,#c0392b)' : 'var(--brand,#132376)', opacity: k === fc.minBalanceWeek - 1 ? 1 : 0.75 }} />
                <div style={{ fontSize: 10, color: 'var(--ink-3)' }}>W{k + 1}</div>
              </div>
            );
          })}
        </div>
        <ul style={{ margin: '12px 0 0', paddingLeft: 18, display: 'flex', flexDirection: 'column', gap: 6 }}>
          {fc.insights.map((i: string, k: number) => <li key={k} style={{ fontSize: 13 }}>{i}</li>)}
        </ul>
      </div>
    </div>
  );
}

// ---- Chart of Accounts (§2) ----
export function CoaPanel() {
  const qc = useQueryClient();
  const [modal, setModal] = useState<null | { edit?: any }>(null);
  const { data: accounts } = useQuery({ queryKey: ['coa'], queryFn: async () => (await api.get<any[]>('/accounting/accounts')).data });
  const inval = () => qc.invalidateQueries({ queryKey: ['coa'] });
  const del = useMutation({ mutationFn: (id: string) => api.delete(`/accounting/accounts/${id}`), onSuccess: () => { inval(); toast.success('Account deleted'); }, onError: (e) => toast.error(apiErrorMessage(e)) });
  const toggle = useMutation({ mutationFn: (a: any) => api.patch(`/accounting/accounts/${a.id}`, { isActive: a.isActive === false }), onSuccess: () => inval(), onError: (e) => toast.error(apiErrorMessage(e)) });
  if (!accounts) return null;
  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12, gap: 10, flexWrap: 'wrap' }}>
        <div style={{ fontSize: 13, color: 'var(--ink-3)' }}>{accounts.length} accounts across the five heads. System accounts are protected from edits and deletion.</div>
        <button className="btn-primary" style={{ height: 34 }} onClick={() => setModal({})}><Plus size={14} /> Add account</button>
      </div>
      {ACCOUNT_TYPES.map((type) => {
        const rows = accounts.filter((a) => a.type === type);
        if (!rows.length) return null;
        return (
          <div key={type} style={{ ...card, overflow: 'hidden', marginBottom: 12 }}>
            <div style={{ padding: '8px 12px', fontWeight: 700, fontSize: 12, background: 'var(--surface-2)', textTransform: 'uppercase', letterSpacing: '.04em', color: 'var(--ink-2)' }}>{TYPE_LABEL[type]}</div>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <tbody>
                {rows.map((a) => (
                  <tr key={a.id} style={{ opacity: a.isActive === false ? 0.5 : 1 }}>
                    <td style={{ ...td, color: 'var(--ink-3)', width: 64, fontVariantNumeric: 'tabular-nums' }}>{a.code}</td>
                    <td style={td}>{a.name}{a.subtype && <span style={{ fontSize: 11, color: 'var(--ink-3)' }}> · {a.subtype}</span>}{a.isActive === false && <span style={{ fontSize: 11, color: 'var(--danger,#c0392b)' }}> · inactive</span>}</td>
                    <td style={{ ...td, textAlign: 'right', width: 130 }}>
                      {a.isSystem ? <span style={{ fontSize: 11, color: 'var(--ink-3)' }}>System</span> : (
                        <span style={{ display: 'inline-flex', gap: 6 }}>
                          <button title="Edit" onClick={() => setModal({ edit: a })} style={iconBtn}><Pencil size={13} /></button>
                          <button title={a.isActive === false ? 'Reactivate' : 'Deactivate'} onClick={() => toggle.mutate(a)} style={iconBtn}><Power size={13} /></button>
                          <button title="Delete" onClick={() => del.mutate(a.id)} style={{ ...iconBtn, color: 'var(--danger,#c0392b)' }}><Trash2 size={13} /></button>
                        </span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        );
      })}
      {modal && <AccountModal edit={modal.edit} onClose={() => setModal(null)} onDone={() => { setModal(null); inval(); }} />}
    </div>
  );
}

function AccountModal({ edit, onClose, onDone }: { edit?: any; onClose: () => void; onDone: () => void }) {
  const [f, setF] = useState<any>({ name: edit?.name ?? '', type: edit?.type ?? 'EXPENSE', code: edit?.code ?? '', subtype: edit?.subtype ?? '' });
  const save = useMutation({
    mutationFn: () => edit
      ? api.patch(`/accounting/accounts/${edit.id}`, { name: f.name, subtype: f.subtype || null })
      : api.post('/accounting/accounts', { name: f.name, type: f.type, code: f.code || undefined, subtype: f.subtype || undefined }),
    onSuccess: () => { toast.success(edit ? 'Account updated' : 'Account created'); onDone(); },
    onError: (e) => toast.error(apiErrorMessage(e)),
  });
  return (
    <Modal title={edit ? 'Edit account' : 'Add account'} onClose={onClose}>
      <div style={{ display: 'grid', gap: 10 }}>
        <div><L>Name</L><input style={inp} value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} placeholder="e.g. Marketing Expenses" /></div>
        {!edit && (
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
            <div><L>Head</L><select style={inp} value={f.type} onChange={(e) => setF({ ...f, type: e.target.value })}>{ACCOUNT_TYPES.map((t) => <option key={t} value={t}>{TYPE_LABEL[t]}</option>)}</select></div>
            <div><L>Code (optional)</L><input style={inp} value={f.code} onChange={(e) => setF({ ...f, code: e.target.value })} placeholder="auto" /></div>
          </div>
        )}
        <div><L>Subtype (optional)</L><input style={inp} value={f.subtype} onChange={(e) => setF({ ...f, subtype: e.target.value })} /></div>
        <button className="btn-primary" style={{ marginTop: 4, width: '100%' }} disabled={!f.name.trim() || save.isPending} onClick={() => save.mutate()}>{save.isPending ? 'Saving…' : (edit ? 'Save' : 'Add account')}</button>
      </div>
    </Modal>
  );
}

// ---- Journal: manual entries, report & reversal (§4) ----
export function JournalPanel() {
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const { data } = useQuery({ queryKey: ['journal-report'], queryFn: async () => (await api.get('/accounting/journal-report')).data });
  const reverse = useMutation({ mutationFn: (id: string) => api.post(`/accounting/journal/${id}/reverse`), onSuccess: () => { qc.invalidateQueries(); toast.success('Entry reversed'); }, onError: (e) => toast.error(apiErrorMessage(e)) });
  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
        <div style={{ fontSize: 13, color: 'var(--ink-3)' }}>{data?.count ?? 0} journal entries. Post a manual balanced entry or reverse any transaction.</div>
        <button className="btn-primary" style={{ height: 34 }} onClick={() => setOpen(true)}><Plus size={14} /> Post journal</button>
      </div>
      {!data?.entries?.length ? <Empty /> : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {data.entries.slice().reverse().map((e: any) => (
            <div key={e.id} style={{ ...card, overflow: 'hidden' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '8px 12px', background: 'var(--surface-2)' }}>
                <div style={{ fontSize: 13 }}><b>{e.memo}</b> <span style={{ color: 'var(--ink-3)', fontSize: 12 }}>· {fmtDate(e.date)} · {e.source}</span></div>
                {e.source !== 'REVERSAL' && <button title="Reverse" onClick={() => reverse.mutate(e.id)} style={{ ...iconBtn, width: 'auto', padding: '0 10px', gap: 5, fontSize: 12, color: 'var(--danger,#c0392b)' }}><Undo2 size={13} /> Reverse</button>}
              </div>
              <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                <tbody>
                  {e.lines.map((l: any, i: number) => (
                    <tr key={i}><td style={{ ...td, color: 'var(--ink-3)', width: 64 }}>{l.code}</td><td style={td}>{l.name}</td><td style={num}>{l.debit ? money(l.debit) : ''}</td><td style={num}>{l.credit ? money(l.credit) : ''}</td></tr>
                  ))}
                </tbody>
              </table>
            </div>
          ))}
        </div>
      )}
      {open && <JournalModal onClose={() => setOpen(false)} onDone={() => { setOpen(false); qc.invalidateQueries(); }} />}
    </div>
  );
}

function JournalModal({ onClose, onDone }: { onClose: () => void; onDone: () => void }) {
  const { data: accounts } = useQuery({ queryKey: ['coa'], queryFn: async () => (await api.get<any[]>('/accounting/accounts')).data });
  const active = (accounts ?? []).filter((a) => a.isActive !== false);
  const [memo, setMemo] = useState('');
  const [lines, setLines] = useState<{ code: string; debit: string; credit: string }[]>([{ code: '', debit: '', credit: '' }, { code: '', debit: '', credit: '' }]);
  const setLine = (i: number, k: string, v: string) => setLines(lines.map((l, j) => (j === i ? { ...l, [k]: v } : l)));
  const totDr = lines.reduce((s, l) => s + (Number(l.debit) || 0), 0);
  const totCr = lines.reduce((s, l) => s + (Number(l.credit) || 0), 0);
  const balanced = totDr === totCr && totDr > 0;
  const ready = balanced && memo.trim() && lines.every((l) => (Number(l.debit) || Number(l.credit)) ? !!l.code : true);
  const save = useMutation({
    mutationFn: () => api.post('/accounting/journal', {
      memo, lines: lines.filter((l) => l.code && (Number(l.debit) || Number(l.credit))).map((l) => ({ code: l.code, debit: Number(l.debit) || 0, credit: Number(l.credit) || 0 })),
    }),
    onSuccess: () => { toast.success('Journal posted'); onDone(); }, onError: (e) => toast.error(apiErrorMessage(e)),
  });
  return (
    <Modal title="Post manual journal" onClose={onClose} wide>
      <div style={{ display: 'grid', gap: 10 }}>
        <div><L>Narration</L><input style={inp} value={memo} onChange={(e) => setMemo(e.target.value)} placeholder="e.g. Owner capital injection" /></div>
        <div style={{ ...card, overflow: 'hidden' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead><tr><th style={th}>Account</th><th style={{ ...th, textAlign: 'right', width: 120 }}>Debit</th><th style={{ ...th, textAlign: 'right', width: 120 }}>Credit</th><th style={{ ...th, width: 36 }} /></tr></thead>
            <tbody>
              {lines.map((l, i) => (
                <tr key={i}>
                  <td style={td}><select style={{ ...inp, padding: '6px 8px' }} value={l.code} onChange={(e) => setLine(i, 'code', e.target.value)}><option value="">— account —</option>{active.map((a) => <option key={a.id} value={a.code}>{a.code} · {a.name}</option>)}</select></td>
                  <td style={td}><input style={{ ...inp, textAlign: 'right', padding: '6px 8px' }} value={l.debit} onChange={(e) => setLine(i, 'debit', e.target.value.replace(/[^0-9]/g, ''))} inputMode="numeric" /></td>
                  <td style={td}><input style={{ ...inp, textAlign: 'right', padding: '6px 8px' }} value={l.credit} onChange={(e) => setLine(i, 'credit', e.target.value.replace(/[^0-9]/g, ''))} inputMode="numeric" /></td>
                  <td style={{ ...td, textAlign: 'center' }}>{lines.length > 2 && <button onClick={() => setLines(lines.filter((_, j) => j !== i))} style={{ ...iconBtn, width: 24, height: 24 }}><X size={12} /></button>}</td>
                </tr>
              ))}
              <tr style={{ fontWeight: 800 }}><td style={{ ...td, color: 'var(--ink-3)' }}>Totals</td><td style={num}>{money(totDr)}</td><td style={num}>{money(totCr)}</td><td style={td} /></tr>
            </tbody>
          </table>
        </div>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <button className="btn-secondary" style={{ height: 32 }} onClick={() => setLines([...lines, { code: '', debit: '', credit: '' }])}><Plus size={13} /> Add line</button>
          <span style={{ fontSize: 12.5, fontWeight: 600, color: balanced ? 'var(--success,#1e874b)' : 'var(--danger,#c0392b)' }}>{balanced ? 'Balanced ✓' : `Out of balance by ${money(Math.abs(totDr - totCr))}`}</span>
        </div>
        <button className="btn-primary" style={{ width: '100%' }} disabled={!ready || save.isPending} onClick={() => save.mutate()}>{save.isPending ? 'Posting…' : 'Post journal'}</button>
      </div>
    </Modal>
  );
}

// ---- Fixed Assets + depreciation (§14) ----
export function FixedAssetsPanel() {
  const qc = useQueryClient();
  const [modal, setModal] = useState(false);
  const [dispose, setDispose] = useState<any>(null);
  const { data: sum } = useQuery({ queryKey: ['fa-summary'], queryFn: async () => (await api.get('/fixed-assets/summary')).data });
  const { data: assets } = useQuery({ queryKey: ['fa-list'], queryFn: async () => (await api.get<any[]>('/fixed-assets')).data });
  const inval = () => { qc.invalidateQueries({ queryKey: ['fa-summary'] }); qc.invalidateQueries({ queryKey: ['fa-list'] }); };
  const run = useMutation({ mutationFn: () => api.post('/fixed-assets/run-depreciation', {}), onSuccess: (r: any) => { inval(); toast.success(r.data.assetsDepreciated ? `Depreciated ${r.data.assetsDepreciated} asset(s): ${money(r.data.totalCharge)}` : 'Nothing due for depreciation'); }, onError: (e) => toast.error(apiErrorMessage(e)) });
  const tiles = sum ? [
    { label: 'Assets', value: sum.active, plain: true, sub: `${sum.disposed} disposed` },
    { label: 'Gross cost', value: sum.grossCost },
    { label: 'Accum. depreciation', value: sum.accumulatedDepreciation },
    { label: 'Net book value', value: sum.netBookValue },
  ] : [];
  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12, gap: 10, flexWrap: 'wrap' }}>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(150px,1fr))', gap: 10, flex: 1 }}>
          {tiles.map((t) => (
            <div key={t.label} style={{ ...card, padding: 14 }}>
              <div style={{ fontSize: 11.5, color: 'var(--ink-3)', fontWeight: 600 }}>{t.label}</div>
              <div style={{ fontSize: 20, fontWeight: 800, marginTop: 4 }}>{t.plain ? t.value : money(t.value)}</div>
              {t.sub && <div style={{ fontSize: 11, color: 'var(--ink-3)' }}>{t.sub}</div>}
            </div>
          ))}
        </div>
      </div>
      <div style={{ display: 'flex', gap: 8, marginBottom: 12 }}>
        <button className="btn-primary" style={{ height: 34 }} onClick={() => setModal(true)}><Plus size={14} /> Add asset</button>
        <button className="btn-secondary" style={{ height: 34 }} disabled={run.isPending} onClick={() => run.mutate()}><PlayCircle size={14} /> {run.isPending ? 'Running…' : 'Run depreciation'}</button>
      </div>
      {!assets?.length ? <div style={{ ...card, padding: 40, textAlign: 'center', color: 'var(--ink-3)', fontSize: 13.5 }}>No fixed assets yet. Add one to start the register — its acquisition posts straight to the ledger.</div> : (
        <div style={{ ...card, overflow: 'hidden' }}>
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead><tr><th style={th}>Ref</th><th style={th}>Asset</th><th style={th}>Method</th><th style={{ ...th, textAlign: 'right' }}>Cost</th><th style={{ ...th, textAlign: 'right' }}>Accum. dep.</th><th style={{ ...th, textAlign: 'right' }}>Net book value</th><th style={th}>Status</th><th style={th} /></tr></thead>
              <tbody>
                {assets.map((a) => (
                  <tr key={a.id}>
                    <td style={{ ...td, color: 'var(--ink-3)' }}>{a.reference}</td>
                    <td style={td}><b>{a.name}</b>{a.category && <span style={{ fontSize: 11, color: 'var(--ink-3)' }}> · {a.category}</span>}</td>
                    <td style={{ ...td, fontSize: 12 }}>{a.method === 'WDV' ? `WDV ${a.depreciationRatePct}%` : `SLM ${a.usefulLifeMonths}mo`}</td>
                    <td style={num}>{money(a.costInr)}</td>
                    <td style={num}>{money(a.accumulatedDepreciationInr)}</td>
                    <td style={{ ...num, fontWeight: 700 }}>{money(a.netBookValueInr)}</td>
                    <td style={td}><span style={{ fontSize: 11.5, fontWeight: 700, color: a.status === 'ACTIVE' ? 'var(--success,#1e874b)' : 'var(--ink-3)' }}>{a.status}</span></td>
                    <td style={{ ...td, textAlign: 'right' }}>{a.status === 'ACTIVE' && <button className="btn-secondary" style={{ height: 28, fontSize: 12 }} onClick={() => setDispose(a)}>Dispose</button>}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
      {modal && <AssetModal onClose={() => setModal(false)} onDone={() => { setModal(false); inval(); }} />}
      {dispose && <DisposeModal asset={dispose} onClose={() => setDispose(null)} onDone={() => { setDispose(null); inval(); }} />}
    </div>
  );
}

function AssetModal({ onClose, onDone }: { onClose: () => void; onDone: () => void }) {
  const [f, setF] = useState<any>({ name: '', category: '', costInr: '', salvageValueInr: '', usefulLifeMonths: '60', method: 'STRAIGHT_LINE', depreciationRatePct: '', acquisitionDate: '', fundedBy: 'BANK' });
  const set = (k: string) => (e: any) => setF({ ...f, [k]: e.target.value });
  const save = useMutation({
    mutationFn: () => api.post('/fixed-assets', {
      name: f.name, category: f.category || undefined, costInr: Number(f.costInr), salvageValueInr: Number(f.salvageValueInr) || 0,
      usefulLifeMonths: Number(f.usefulLifeMonths) || 60, method: f.method, depreciationRatePct: f.method === 'WDV' ? Number(f.depreciationRatePct) : undefined,
      acquisitionDate: f.acquisitionDate || undefined, fundedBy: f.fundedBy,
    }),
    onSuccess: () => { toast.success('Asset added & acquisition posted'); onDone(); }, onError: (e) => toast.error(apiErrorMessage(e)),
  });
  const ok = f.name.trim() && Number(f.costInr) > 0 && (f.method !== 'WDV' || Number(f.depreciationRatePct) > 0);
  return (
    <Modal title="Add fixed asset" onClose={onClose} wide>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
        <div style={{ gridColumn: '1 / -1' }}><L>Name</L><input style={inp} value={f.name} onChange={set('name')} placeholder="e.g. Delivery Van" /></div>
        <div><L>Category</L><input style={inp} value={f.category} onChange={set('category')} placeholder="Vehicles" /></div>
        <div><L>Acquisition date</L><input style={inp} type="date" value={f.acquisitionDate} onChange={set('acquisitionDate')} /></div>
        <div><L>Cost ({cur()})</L><input style={inp} value={f.costInr} onChange={set('costInr')} inputMode="numeric" /></div>
        <div><L>Salvage value ({cur()})</L><input style={inp} value={f.salvageValueInr} onChange={set('salvageValueInr')} inputMode="numeric" /></div>
        <div><L>Method</L><select style={inp} value={f.method} onChange={set('method')}><option value="STRAIGHT_LINE">Straight-line</option><option value="WDV">Written-down value</option></select></div>
        {f.method === 'WDV'
          ? <div><L>Annual rate (%)</L><input style={inp} value={f.depreciationRatePct} onChange={set('depreciationRatePct')} inputMode="numeric" /></div>
          : <div><L>Useful life (months)</L><input style={inp} value={f.usefulLifeMonths} onChange={set('usefulLifeMonths')} inputMode="numeric" /></div>}
        <div><L>Funded by</L><select style={inp} value={f.fundedBy} onChange={set('fundedBy')}><option value="BANK">Bank</option><option value="CASH">Cash</option><option value="PAYABLE">On credit (payable)</option></select></div>
      </div>
      <button className="btn-primary" style={{ marginTop: 14, width: '100%' }} disabled={!ok || save.isPending} onClick={() => save.mutate()}>{save.isPending ? 'Saving…' : 'Add asset'}</button>
    </Modal>
  );
}

function DisposeModal({ asset, onClose, onDone }: { asset: any; onClose: () => void; onDone: () => void }) {
  const [f, setF] = useState<any>({ proceedsInr: '', date: '', method: 'BANK' });
  const proceeds = Number(f.proceedsInr) || 0;
  const gainLoss = proceeds - asset.netBookValueInr;
  const save = useMutation({
    mutationFn: () => api.post(`/fixed-assets/${asset.id}/dispose`, { proceedsInr: proceeds, date: f.date || undefined, method: f.method }),
    onSuccess: () => { toast.success('Asset disposed & posted'); onDone(); }, onError: (e) => toast.error(apiErrorMessage(e)),
  });
  return (
    <Modal title={`Dispose ${asset.reference}`} onClose={onClose}>
      <div style={{ display: 'grid', gap: 10 }}>
        <div style={{ fontSize: 13, color: 'var(--ink-3)' }}>{asset.name} — net book value <b style={{ color: 'var(--ink)' }}>{money(asset.netBookValueInr)}</b></div>
        <div><L>Sale proceeds ({cur()})</L><input style={inp} value={f.proceedsInr} onChange={(e) => setF({ ...f, proceedsInr: e.target.value.replace(/[^0-9]/g, '') })} inputMode="numeric" /></div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
          <div><L>Date</L><input style={inp} type="date" value={f.date} onChange={(e) => setF({ ...f, date: e.target.value })} /></div>
          <div><L>Received in</L><select style={inp} value={f.method} onChange={(e) => setF({ ...f, method: e.target.value })}><option value="BANK">Bank</option><option value="CASH">Cash</option></select></div>
        </div>
        {proceeds > 0 && <div style={{ fontSize: 13, fontWeight: 600, color: gainLoss >= 0 ? 'var(--success,#1e874b)' : 'var(--danger,#c0392b)' }}>{gainLoss >= 0 ? 'Gain' : 'Loss'} on disposal: {money(Math.abs(gainLoss))}</div>}
        <button className="btn-primary" style={{ width: '100%' }} disabled={save.isPending} onClick={() => save.mutate()}>{save.isPending ? 'Posting…' : 'Confirm disposal'}</button>
      </div>
    </Modal>
  );
}

// ---- Cash Flow Statement (§22) ----
export function CashFlowPanel() {
  const { data } = useQuery({ queryKey: ['cash-flow'], queryFn: async () => (await api.get('/accounting/cash-flow')).data });
  if (!data) return null;
  const rows = [
    { label: 'Opening cash & bank', value: data.opening, bold: true },
    { label: 'Operating activities', value: data.operating },
    { label: 'Investing activities', value: data.investing },
    { label: 'Financing activities', value: data.financing },
    { label: 'Net change in cash', value: data.netChange, bold: true, rule: true },
    { label: 'Closing cash & bank', value: data.closing, bold: true },
  ];
  return (
    <div style={{ ...card, overflow: 'hidden', maxWidth: 560 }}>
      <div style={{ padding: '10px 14px', fontWeight: 700, borderBottom: '1px solid var(--line-soft)' }}>Cash Flow Statement <span style={{ fontSize: 12, fontWeight: 500, color: 'var(--ink-3)' }}>· direct method</span></div>
      <table style={{ width: '100%', borderCollapse: 'collapse' }}>
        <tbody>
          {rows.map((r) => (
            <tr key={r.label} style={{ borderTop: r.rule ? '2px solid var(--line)' : undefined }}>
              <td style={{ ...td, fontWeight: r.bold ? 700 : 400 }}>{r.label}</td>
              <td style={{ ...num, fontWeight: r.bold ? 700 : 400, color: r.value < 0 ? 'var(--danger,#c0392b)' : 'var(--ink)' }}>{money(r.value)}</td>
            </tr>
          ))}
        </tbody>
      </table>
      <div style={{ padding: '8px 14px', fontSize: 12, color: 'var(--ink-3)' }}>Cash & bank movements classified by counter-account. Closing ties to the ledger cash balance.</div>
    </div>
  );
}

// ---- AR / AP Aging (§5/§6) ----
export function AgingPanel() {
  const [side, setSide] = useState<'ar' | 'ap'>('ar');
  const { data } = useQuery({ queryKey: ['aging', side], queryFn: async () => (await api.get(`/accounting/${side}-aging`)).data });
  const cols = [['current', 'Current'], ['d1_30', '1–30'], ['d31_60', '31–60'], ['d61_90', '61–90'], ['d90_plus', '90+']] as const;
  return (
    <div>
      <div style={{ display: 'flex', gap: 8, marginBottom: 12 }}>
        <button className={side === 'ar' ? 'btn-primary' : 'btn-secondary'} style={{ height: 32 }} onClick={() => setSide('ar')}>Receivable (AR)</button>
        <button className={side === 'ap' ? 'btn-primary' : 'btn-secondary'} style={{ height: 32 }} onClick={() => setSide('ap')}>Payable (AP)</button>
      </div>
      {!data?.rows?.length ? <div style={{ ...card, padding: 40, textAlign: 'center', color: 'var(--ink-3)', fontSize: 13.5 }}>No outstanding {side === 'ar' ? 'customer invoices' : 'vendor bills'}.</div> : (
        <div style={{ ...card, overflow: 'hidden' }}>
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead><tr><th style={th}>{side === 'ar' ? 'Customer' : 'Vendor'}</th>{cols.map(([, l]) => <th key={l} style={{ ...th, textAlign: 'right' }}>{l}</th>)}<th style={{ ...th, textAlign: 'right' }}>Total</th></tr></thead>
              <tbody>
                {data.rows.map((r: any, i: number) => (
                  <tr key={i}><td style={td}>{r.party}</td>{cols.map(([k]) => <td key={k} style={num}>{r[k] ? money(r[k]) : '—'}</td>)}<td style={{ ...num, fontWeight: 700 }}>{money(r.total)}</td></tr>
                ))}
                <tr style={{ fontWeight: 800 }}><td style={td}>Total</td>{cols.map(([k]) => <td key={k} style={num}>{money(data.totals[k])}</td>)}<td style={num}>{money(data.totals.total)}</td></tr>
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}

// ---- Budgeting (§16) ----
export function BudgetPanel() {
  const qc = useQueryClient();
  const [year, setYear] = useState(2026);
  const [modal, setModal] = useState(false);
  const { data } = useQuery({ queryKey: ['bva', year], queryFn: async () => (await api.get(`/accounting/budget-vs-actual?year=${year}`)).data });
  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12, gap: 10 }}>
        <div style={{ display: 'inline-flex', gap: 6, alignItems: 'center' }}>
          <span style={{ fontSize: 13, color: 'var(--ink-3)' }}>Fiscal year</span>
          <select style={{ ...inp, width: 'auto', padding: '6px 10px' }} value={year} onChange={(e) => setYear(Number(e.target.value))}>{[2025, 2026, 2027].map((y) => <option key={y} value={y}>{y}</option>)}</select>
        </div>
        <button className="btn-primary" style={{ height: 34 }} onClick={() => setModal(true)}><Plus size={14} /> Set budget</button>
      </div>
      <div style={{ ...card, overflow: 'hidden' }}>
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead><tr><th style={th}>Code</th><th style={th}>Account</th><th style={{ ...th, textAlign: 'right' }}>Budget</th><th style={{ ...th, textAlign: 'right' }}>Actual</th><th style={{ ...th, textAlign: 'right' }}>Variance</th><th style={{ ...th, textAlign: 'right' }}>Used</th></tr></thead>
            <tbody>
              {(data?.rows ?? []).map((r: any) => (
                <tr key={r.code}>
                  <td style={{ ...td, color: 'var(--ink-3)' }}>{r.code}</td>
                  <td style={td}>{r.name} <span style={{ fontSize: 11, color: 'var(--ink-3)' }}>· {r.kind === 'INCOME' ? 'income' : 'expense'}</span></td>
                  <td style={num}>{money(r.budget)}</td><td style={num}>{money(r.actual)}</td>
                  <td style={{ ...num, color: r.variance >= 0 ? 'var(--success,#1e874b)' : 'var(--danger,#c0392b)', fontWeight: 600 }}>{money(r.variance)}</td>
                  <td style={num}>{r.usedPct != null ? `${r.usedPct}%` : '—'}</td>
                </tr>
              ))}
              {!data?.rows?.length && <tr><td style={{ ...td, textAlign: 'center', color: 'var(--ink-3)' }} colSpan={6}>No budget or activity for {year} yet.</td></tr>}
            </tbody>
          </table>
        </div>
      </div>
      {modal && <BudgetModal year={year} onClose={() => setModal(false)} onDone={() => { setModal(false); qc.invalidateQueries({ queryKey: ['bva', year] }); }} />}
    </div>
  );
}

function BudgetModal({ year, onClose, onDone }: { year: number; onClose: () => void; onDone: () => void }) {
  const { data: accounts } = useQuery({ queryKey: ['coa'], queryFn: async () => (await api.get<any[]>('/accounting/accounts')).data });
  const pl = (accounts ?? []).filter((a) => a.type === 'INCOME' || a.type === 'EXPENSE');
  const [f, setF] = useState({ accountCode: '', amountInr: '' });
  const save = useMutation({
    mutationFn: () => api.post('/accounting/budgets', { fiscalYear: year, accountCode: f.accountCode, amountInr: Number(f.amountInr) || 0 }),
    onSuccess: () => { toast.success('Budget set'); onDone(); }, onError: (e) => toast.error(apiErrorMessage(e)),
  });
  return (
    <Modal title={`Set budget — ${year}`} onClose={onClose}>
      <div style={{ display: 'grid', gap: 10 }}>
        <div><L>Account</L><select style={inp} value={f.accountCode} onChange={(e) => setF({ ...f, accountCode: e.target.value })}><option value="">— account —</option>{pl.map((a) => <option key={a.id} value={a.code}>{a.code} · {a.name}</option>)}</select></div>
        <div><L>Annual budget ({cur()})</L><input style={inp} value={f.amountInr} onChange={(e) => setF({ ...f, amountInr: e.target.value.replace(/[^0-9]/g, '') })} inputMode="numeric" /></div>
        <button className="btn-primary" style={{ width: '100%' }} disabled={!f.accountCode || save.isPending} onClick={() => save.mutate()}>{save.isPending ? 'Saving…' : 'Set budget'}</button>
      </div>
    </Modal>
  );
}

// ---- UAE VAT return (§13) ----
export function VatPanel() {
  const { data } = useQuery({ queryKey: ['vat-return'], queryFn: async () => (await api.get('/accounting/vat-return')).data });
  if (!data) return null;
  const b = data.boxes;
  return (
    <div style={{ display: 'grid', gap: 12, maxWidth: 620 }}>
      <div style={{ ...card, padding: '12px 16px', display: 'flex', justifyContent: 'space-between', flexWrap: 'wrap', gap: 8 }}>
        <div><div style={{ fontSize: 12, color: 'var(--ink-3)' }}>Registered person</div><div style={{ fontWeight: 700 }}>{data.legalName ?? '—'}</div></div>
        <div style={{ textAlign: 'right' }}><div style={{ fontSize: 12, color: 'var(--ink-3)' }}>TRN</div><div style={{ fontWeight: 700, fontFamily: 'monospace' }}>{data.trn ?? 'not set'}</div></div>
      </div>
      <div style={{ ...card, overflow: 'hidden' }}>
        <div style={{ padding: '10px 14px', fontWeight: 700, borderBottom: '1px solid var(--line-soft)' }}>VAT Return</div>
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <tbody>
            <tr><td style={td}>Output VAT — on sales &amp; all other outputs</td><td style={num}>{money(b.outputVat)}</td></tr>
            <tr><td style={td}>Input VAT — on expenses &amp; all other inputs</td><td style={num}>{money(b.inputVat)}</td></tr>
            <tr style={{ fontWeight: 800, borderTop: '2px solid var(--line)' }}><td style={td}>Net VAT payable</td><td style={{ ...num, color: b.netVatPayable >= 0 ? 'var(--ink)' : 'var(--success,#1e874b)' }}>{money(b.netVatPayable)}</td></tr>
          </tbody>
        </table>
      </div>
      {!data.trn && <div style={{ fontSize: 12, color: 'var(--ink-3)' }}>Set your TRN in Organization settings to print a compliant return.</div>}
    </div>
  );
}

// ---- Financial periods & locking (§21) ----
export function PeriodsPanel() {
  const qc = useQueryClient();
  const [modal, setModal] = useState(false);
  const { data: periods } = useQuery({ queryKey: ['periods'], queryFn: async () => (await api.get<any[]>('/accounting/periods')).data });
  const inval = () => qc.invalidateQueries({ queryKey: ['periods'] });
  const setStatus = useMutation({ mutationFn: ({ id, status }: any) => api.patch(`/accounting/periods/${id}`, { status }), onSuccess: () => { inval(); toast.success('Period updated'); }, onError: (e) => toast.error(apiErrorMessage(e)) });
  const meta: Record<string, { bg: string; fg: string }> = {
    OPEN: { bg: 'var(--success-bg)', fg: 'var(--success)' }, LOCKED: { bg: 'var(--warning-bg,#fdf2e2)', fg: 'var(--warning,#c67c1e)' }, CLOSED: { bg: 'var(--surface-2)', fg: 'var(--ink-3)' },
  };
  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
        <div style={{ fontSize: 13, color: 'var(--ink-3)' }}>Lock a period to block back-dated postings into it. Closed periods are permanently sealed.</div>
        <button className="btn-primary" style={{ height: 34 }} onClick={() => setModal(true)}><Plus size={14} /> New period</button>
      </div>
      {!periods?.length ? <div style={{ ...card, padding: 40, textAlign: 'center', color: 'var(--ink-3)', fontSize: 13.5 }}>No periods defined. Create one to control back-dating.</div> : (
        <div style={{ ...card, overflow: 'hidden' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead><tr><th style={th}>Period</th><th style={th}>From</th><th style={th}>To</th><th style={th}>Status</th><th style={th} /></tr></thead>
            <tbody>
              {periods.map((p) => (
                <tr key={p.id}>
                  <td style={{ ...td, fontWeight: 600 }}>{p.name}</td>
                  <td style={td}>{fmtDate(p.startDate)}</td><td style={td}>{fmtDate(p.endDate)}</td>
                  <td style={td}><span style={{ fontSize: 11.5, fontWeight: 700, padding: '2px 9px', borderRadius: 999, ...meta[p.status] }}>{p.status}</span></td>
                  <td style={{ ...td, textAlign: 'right' }}>
                    <span style={{ display: 'inline-flex', gap: 6 }}>
                      {p.status === 'OPEN' && <button className="btn-secondary" style={{ height: 28, fontSize: 12 }} onClick={() => setStatus.mutate({ id: p.id, status: 'LOCKED' })}><Lock size={12} /> Lock</button>}
                      {p.status === 'LOCKED' && <button className="btn-secondary" style={{ height: 28, fontSize: 12 }} onClick={() => setStatus.mutate({ id: p.id, status: 'OPEN' })}><Unlock size={12} /> Unlock</button>}
                      {p.status !== 'CLOSED' && <button className="btn-secondary" style={{ height: 28, fontSize: 12 }} onClick={() => { if (confirm('Close this period permanently?')) setStatus.mutate({ id: p.id, status: 'CLOSED' }); }}>Close</button>}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      {modal && <PeriodModal onClose={() => setModal(false)} onDone={() => { setModal(false); inval(); }} />}
    </div>
  );
}

function PeriodModal({ onClose, onDone }: { onClose: () => void; onDone: () => void }) {
  const [f, setF] = useState({ name: '', startDate: '', endDate: '' });
  const save = useMutation({
    mutationFn: () => api.post('/accounting/periods', f),
    onSuccess: () => { toast.success('Period created'); onDone(); }, onError: (e) => toast.error(apiErrorMessage(e)),
  });
  const ok = f.name.trim() && f.startDate && f.endDate;
  return (
    <Modal title="New financial period" onClose={onClose}>
      <div style={{ display: 'grid', gap: 10 }}>
        <div><L>Name</L><input style={inp} value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} placeholder="e.g. FY 2026 / Q1 2026" /></div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
          <div><L>Start</L><input style={inp} type="date" value={f.startDate} onChange={(e) => setF({ ...f, startDate: e.target.value })} /></div>
          <div><L>End</L><input style={inp} type="date" value={f.endDate} onChange={(e) => setF({ ...f, endDate: e.target.value })} /></div>
        </div>
        <button className="btn-primary" style={{ width: '100%' }} disabled={!ok || save.isPending} onClick={() => save.mutate()}>{save.isPending ? 'Creating…' : 'Create period'}</button>
      </div>
    </Modal>
  );
}
