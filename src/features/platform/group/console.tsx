'use client';

/**
 * The group console.
 *
 * It shows one thing no company screen can: what the GROUP earned from outside
 * itself. Every other figure exists to make that number auditable — the gross
 * total it started from, the internal legs removed from it, and the trades
 * where one company has not yet booked its side.
 *
 * The tier is reporting-only. Nothing here writes to any company's books, and
 * the screen says so, because an owner reading a consolidated statement is
 * entitled to know whether it is a view or a second set of accounts.
 */

import React, { useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { AlertTriangle, ArrowLeftRight, Building2, Layers3 } from 'lucide-react';
import { toast } from 'sonner';
import { api } from '@/lib/api';
import {
  Badge, Card, DataTable, EmptyState, Field, FormSection, Modal, SectionTitle, Segmented,
  Skeleton, StatCard, type DataTableColumn,
} from '@/features/verticals/insurance/insurance/ui/kit';
import { PageHead, money } from '@/features/verticals/poultry/poultry/ui/common';

interface MyGroup { id: string; name: string; slug: string; baseCurrency: string; role: 'VIEWER' | 'CONTROLLER' }

interface CompanyRow {
  organizationId: string; name: string; vertical: string; currency: string; consolidated: boolean;
  revenueInr: number; expenseInr: number; profitInr: number;
  internalRevenueInr: number; externalRevenueInr: number;
  internalExpenseInr: number; externalExpenseInr: number;
  cashBankInr: number; receivableInr: number; payableInr: number;
  contributionPct: number | null;
}

interface Overview {
  group: { id: string; name: string; baseCurrency: string };
  window: { from: string; to: string; label: string };
  totals: {
    companies: number; consolidatedCompanies: number; excludedCompanies: string[];
    grossRevenueInr: number; grossExpenseInr: number;
    eliminatedRevenueInr: number; eliminatedExpenseInr: number;
    revenueInr: number; expenseInr: number; profitInr: number;
    cashBankInr: number; grossReceivableInr: number; grossPayableInr: number;
    eliminatedReceivableInr: number; eliminatedPayableInr: number;
    receivableInr: number; payableInr: number;
  };
  companies: CompanyRow[];
}

interface Pair { aName: string; bName: string; aSoldToBInr: number; bBoughtFromAInr: number; mismatchInr: number; matched: boolean }
interface InternalTxn { id: string; date: string; memo: string | null; sourceType: string; fromCompany: string; toCompany: string; revenueInr: number; expenseInr: number }

interface InterCompany {
  window: { label: string };
  transactions: InternalTxn[];
  pairs: Pair[];
  exceptions: { between: string; detail: string; mismatchInr: number }[];
  clean: boolean;
}

interface VerticalRow { vertical: string; companies: number; revenueInr: number; expenseInr: number; profitInr: number }

const VIEWS = ['Companies', 'By business', 'Between companies'];

const humanVertical = (v: string) => v.replace(/_/g, ' ').toLowerCase().replace(/^./, (c) => c.toUpperCase());

/** The last six months, so nobody types dates to see last month. */
function recentMonths(n = 6) {
  const out: { value: string; label: string }[] = [];
  const now = new Date();
  for (let i = 0; i < n; i += 1) {
    const m = new Date(now.getFullYear(), now.getMonth() - i, 1);
    out.push({
      value: `${m.getFullYear()}-${String(m.getMonth() + 1).padStart(2, '0')}`,
      label: m.toLocaleDateString(undefined, { month: 'short', year: 'numeric' }),
    });
  }
  return out;
}

export function GroupConsole() {
  const qc = useQueryClient();
  const months = useMemo(() => recentMonths(), []);
  const [month, setMonth] = useState(months[0].value);
  const [view, setView] = useState(VIEWS[0]);
  // The API echoes the month it was given ("2026-09"); the picker already holds
  // the readable form, so show that rather than the wire value.
  const monthLabel = months.find((m) => m.value === month)?.label ?? month;
  const [creating, setCreating] = useState(false);
  const [linking, setLinking] = useState(false);

  const me = useQuery({
    queryKey: ['group', 'me'],
    queryFn: async () => (await api.get<MyGroup | null>('/group/me')).data,
  });
  const hasGroup = !!me.data;

  const overview = useQuery({
    queryKey: ['group', 'overview', month],
    queryFn: async () => (await api.get<Overview>('/group/overview', { params: { month } })).data,
    enabled: hasGroup,
  });
  const inter = useQuery({
    queryKey: ['group', 'inter-company', month],
    queryFn: async () => (await api.get<InterCompany>('/group/inter-company', { params: { month } })).data,
    enabled: hasGroup && view === 'Between companies',
  });
  const verticals = useQuery({
    queryKey: ['group', 'by-vertical', month],
    queryFn: async () => (await api.get<{ verticals: VerticalRow[] }>('/group/by-vertical', { params: { month } })).data,
    enabled: hasGroup && view === 'By business',
  });

  const createGroup = useMutation({
    mutationFn: async (body: { name: string; baseCurrency?: string }) => (await api.post('/group', body)).data,
    onSuccess: () => { toast.success('Group created'); setCreating(false); qc.invalidateQueries({ queryKey: ['group'] }); },
    onError: (e: any) => toast.error(e?.response?.data?.message ?? 'Could not create the group'),
  });
  const linkCompany = useMutation({
    mutationFn: async (body: { organizationId: string }) => (await api.post('/group/companies', body)).data,
    onSuccess: () => { toast.success('Company added to the group'); setLinking(false); qc.invalidateQueries({ queryKey: ['group'] }); },
    onError: (e: any) => toast.error(e?.response?.data?.message ?? 'Could not add that company'),
  });

  if (me.isLoading) {
    return <div className="ds-page"><PageHead title="Group" /><Skeleton rows={3} height={92} /></div>;
  }

  if (!hasGroup) {
    return (
      <div className="ds-page">
        <PageHead title="Group" />
        <Card>
          <EmptyState
            icon={Layers3}
            title="This company is not part of a group"
            body={
              'A group sits above companies and reports them together: one consolidated revenue, '
              + 'expense and profit, with trade between the companies removed. It keeps no books of its '
              + 'own — every figure is read from the companies’ own ledgers, and nothing here ever posts '
              + 'to them.'
            }
            actionLabel="Create a group"
            onAction={() => setCreating(true)}
          />
        </Card>
        <CreateGroupModal open={creating} onClose={() => setCreating(false)} onSubmit={(v) => createGroup.mutate(v)} busy={createGroup.isPending} />
      </div>
    );
  }

  const t = overview.data?.totals;

  return (
    <div className="ds-page">
      <PageHead
        title={me.data!.name}
        subtitle={`Consolidated in ${me.data!.baseCurrency} · reporting only — the group posts nothing to any company's ledger`}
        actions={(
          <>
            <select className="input" style={{ width: 160 }} value={month} onChange={(e) => setMonth(e.target.value)}>
              {months.map((m) => <option key={m.value} value={m.value}>{m.label}</option>)}
            </select>
            {me.data!.role === 'CONTROLLER' && (
              <button className="btn-secondary" onClick={() => setLinking(true)}>Add company</button>
            )}
          </>
        )}
      />

      {overview.isLoading || !t ? (
        <Skeleton rows={3} height={92} />
      ) : (
        <>
          <div className="ds-grid ds-grid-kpi">
            <StatCard label="Group revenue" value={money(t.revenueInr)} hint="earned outside the group" />
            <StatCard label="Group expenses" value={money(t.expenseInr)} hint="paid outside the group" />
            <StatCard label="Group profit" value={money(t.profitInr)} hint={monthLabel} tone={t.profitInr >= 0 ? 'active' : 'expired'} />
            <StatCard label="Cash & bank" value={money(t.cashBankInr)} hint="every consolidated company" />
          </div>

          {/* The audit trail for the headline. Without it the owner is asked to
              trust a number smaller than the sum of the parts. */}
          <Card>
            <SectionTitle sub="Internal trade moves nothing out of the group, so both its legs are removed — never one.">
              How the group figure was reached
            </SectionTitle>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              <Line label="Sum of every company's revenue" value={money(t.grossRevenueInr)} />
              <Line label="Less: sales to other group companies" value={`− ${money(t.eliminatedRevenueInr)}`} muted />
              <Line label="Group revenue" value={money(t.revenueInr)} strong />
              <Rule />
              <Line label="Sum of every company's expenses" value={money(t.grossExpenseInr)} />
              <Line label="Less: purchases from other group companies" value={`− ${money(t.eliminatedExpenseInr)}`} muted />
              <Line label="Group expenses" value={money(t.expenseInr)} strong />
              <Rule />
              <Line label="Group profit" value={money(t.profitInr)} strong />
            </div>
            {t.excludedCompanies.length > 0 && (
              <p className="ds-caption" style={{ marginTop: 14, display: 'flex', gap: 8, alignItems: 'flex-start' }}>
                <AlertTriangle size={14} style={{ marginTop: 2, flex: 'none' }} />
                <span>
                  Not consolidated: {t.excludedCompanies.join(', ')} — these report in another currency and
                  are listed rather than converted at a rate nobody has set.
                </span>
              </p>
            )}
          </Card>

          <div className="ds-grid ds-grid-kpi">
            <StatCard
              label="Receivable (external)"
              value={money(t.receivableInr)}
              hint={`${money(t.eliminatedReceivableInr)} of it is owed between group companies`}
            />
            <StatCard
              label="Payable (external)"
              value={money(t.payableInr)}
              hint={`${money(t.eliminatedPayableInr)} of it is owed between group companies`}
            />
            <StatCard label="Companies" value={String(t.companies)} hint={`${t.consolidatedCompanies} consolidated`} />
          </div>

          <div style={{ margin: '18px 0 12px' }}>
            <Segmented options={VIEWS} value={view} onChange={setView} />
          </div>

          {view === 'Companies' && <CompaniesTable rows={overview.data!.companies} />}
          {view === 'By business' && (
            verticals.isLoading
              ? <Skeleton rows={3} />
              : <VerticalsTable rows={verticals.data?.verticals ?? []} groupProfitInr={t.profitInr} />
          )}
          {view === 'Between companies' && (
            inter.isLoading ? <Skeleton rows={3} /> : <InternalPanel data={inter.data} />
          )}
        </>
      )}

      <LinkCompanyModal open={linking} onClose={() => setLinking(false)} onSubmit={(v) => linkCompany.mutate(v)} busy={linkCompany.isPending} />
    </div>
  );
}

function Rule() {
  return <div style={{ height: 1, background: 'var(--hairline-soft)' }} />;
}

function Line({ label, value, strong, muted }: { label: string; value: string; strong?: boolean; muted?: boolean }) {
  return (
    <div style={{
      display: 'flex', justifyContent: 'space-between', gap: 16,
      fontWeight: strong ? 600 : 400,
      color: muted ? 'var(--ink-3)' : 'var(--ink-1)',
    }}>
      <span>{label}</span>
      <span style={{ fontVariantNumeric: 'tabular-nums', whiteSpace: 'nowrap' }}>{value}</span>
    </div>
  );
}

function CompaniesTable({ rows }: { rows: CompanyRow[] }) {
  const columns: DataTableColumn<CompanyRow>[] = [
    {
      key: 'name',
      header: 'Company',
      sortable: true,
      render: (r) => (
        <div style={{ display: 'flex', gap: 8, alignItems: 'center', minWidth: 0 }}>
          <Building2 size={15} style={{ color: 'var(--ink-3)', flex: 'none' }} />
          <div style={{ minWidth: 0 }}>
            <div style={{ fontWeight: 600 }}>{r.name}</div>
            <div className="ds-caption">{humanVertical(r.vertical)}</div>
          </div>
        </div>
      ),
    },
    { key: 'revenueInr', header: 'Own revenue', align: 'right', sortable: true, render: (r) => money(r.revenueInr) },
    {
      key: 'externalRevenueInr',
      header: 'Of which external',
      align: 'right',
      sortable: true,
      render: (r) => (
        <div>
          <div style={{ fontVariantNumeric: 'tabular-nums' }}>{money(r.externalRevenueInr)}</div>
          {r.internalRevenueInr > 0 && <div className="ds-caption">{money(r.internalRevenueInr)} within the group</div>}
        </div>
      ),
    },
    { key: 'expenseInr', header: 'Own cost', align: 'right', sortable: true, render: (r) => money(r.expenseInr) },
    { key: 'profitInr', header: 'Own profit', align: 'right', sortable: true, render: (r) => money(r.profitInr) },
    {
      key: 'contributionPct',
      header: 'Share of group profit',
      align: 'right',
      sortable: true,
      render: (r) => (r.contributionPct === null ? '—' : `${r.contributionPct}%`),
    },
    {
      key: 'consolidated',
      header: '',
      render: (r) => (r.consolidated
        ? <Badge tone="active">Consolidated</Badge>
        : <Badge tone="renewal">{r.currency} — excluded</Badge>),
    },
  ];
  return (
    <Card flush>
      <DataTable columns={columns} rows={rows} rowKey={(r) => r.organizationId} />
      <p className="ds-caption" style={{ padding: '12px 16px', borderTop: '1px solid var(--hairline-soft)' }}>
        “Own” figures are each company’s books exactly as that company reports them. The group view
        reads them; it never rewrites them.
      </p>
    </Card>
  );
}

function VerticalsTable({ rows, groupProfitInr }: { rows: VerticalRow[]; groupProfitInr: number }) {
  const sum = rows.reduce((s, r) => s + r.profitInr, 0);
  const columns: DataTableColumn<VerticalRow>[] = [
    { key: 'vertical', header: 'Business', sortable: true, render: (r) => <span style={{ fontWeight: 600 }}>{humanVertical(r.vertical)}</span> },
    { key: 'companies', header: 'Companies', align: 'right', sortable: true, render: (r) => String(r.companies) },
    { key: 'revenueInr', header: 'External revenue', align: 'right', sortable: true, render: (r) => money(r.revenueInr) },
    { key: 'expenseInr', header: 'External cost', align: 'right', sortable: true, render: (r) => money(r.expenseInr) },
    { key: 'profitInr', header: 'Profit', align: 'right', sortable: true, render: (r) => money(r.profitInr) },
  ];
  return (
    <Card flush>
      <DataTable columns={columns} rows={rows} rowKey={(r) => r.vertical} empty="No consolidated company reported this period." />
      <p className="ds-caption" style={{ padding: '12px 16px', borderTop: '1px solid var(--hairline-soft)' }}>
        {sum === groupProfitInr
          ? `Both legs of every internal trade are removed here too, which is why these profits add up to the group's ${money(groupProfitInr)}.`
          : `These profits total ${money(sum)} against a group profit of ${money(groupProfitInr)}. A breakdown that does not reconcile to its headline means one of the two figures is wrong — report it before acting on either.`}
      </p>
    </Card>
  );
}

function InternalPanel({ data }: { data?: InterCompany }) {
  if (!data) return null;
  if (!data.transactions.length) {
    return (
      <Card>
        <EmptyState
          icon={ArrowLeftRight}
          title="No trade between group companies this period"
          body="Nothing was eliminated, so the group total is simply the sum of the companies."
        />
      </Card>
    );
  }

  const pairColumns: DataTableColumn<Pair>[] = [
    { key: 'between', header: 'Between', render: (p) => `${p.aName} ↔ ${p.bName}` },
    { key: 'aSoldToBInr', header: 'Sales booked', align: 'right', render: (p) => money(p.aSoldToBInr) },
    { key: 'bBoughtFromAInr', header: 'Purchases booked', align: 'right', render: (p) => money(p.bBoughtFromAInr) },
    { key: 'mismatchInr', header: 'Gap', align: 'right', render: (p) => (p.matched ? '—' : money(Math.abs(p.mismatchInr))) },
    { key: 'matched', header: '', render: (p) => (p.matched ? <Badge tone="active">Both sides</Badge> : <Badge tone="expired">One side only</Badge>) },
  ];

  const txnColumns: DataTableColumn<InternalTxn>[] = [
    { key: 'date', header: 'Date', sortable: true, render: (r) => new Date(r.date).toLocaleDateString(undefined, { day: '2-digit', month: 'short' }) },
    { key: 'fromCompany', header: 'Booked by', render: (r) => r.fromCompany },
    { key: 'toCompany', header: 'Counterparty', render: (r) => r.toCompany },
    { key: 'memo', header: 'Memo', render: (r) => r.memo ?? r.sourceType },
    { key: 'revenueInr', header: 'Revenue', align: 'right', render: (r) => (r.revenueInr ? money(r.revenueInr) : '—') },
    { key: 'expenseInr', header: 'Cost', align: 'right', render: (r) => (r.expenseInr ? money(r.expenseInr) : '—') },
  ];

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      {!data.clean && (
        <Card tone="expired">
          <SectionTitle sub="Eliminated from the group total anyway — the group must never report revenue that did not leave it — and listed here so the missing entry gets made.">
            {data.exceptions.length} internal trade{data.exceptions.length === 1 ? '' : 's'} booked on one side only
          </SectionTitle>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            {data.exceptions.map((e) => (
              <div key={e.between} className="ds-caption">
                <strong>{e.between}</strong> — {e.detail}
              </div>
            ))}
          </div>
        </Card>
      )}

      <Card flush>
        <DataTable columns={pairColumns} rows={data.pairs} rowKey={(p) => `${p.aName}|${p.bName}`} />
      </Card>

      <Card flush>
        <DataTable columns={txnColumns} rows={data.transactions} rowKey={(r) => r.id} dense />
      </Card>
    </div>
  );
}

function CreateGroupModal({ open, onClose, onSubmit, busy }: {
  open: boolean; onClose: () => void; onSubmit: (v: { name: string; baseCurrency?: string }) => void; busy: boolean;
}) {
  const [name, setName] = useState('');
  const [currency, setCurrency] = useState('INR');
  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Create a group"
      subtitle="The company you are in becomes its first member, and you its controller."
      width={560}
      footer={(
        <>
          <button className="btn-secondary" onClick={onClose}>Cancel</button>
          <button className="btn-primary" disabled={busy || name.trim().length < 2} onClick={() => onSubmit({ name: name.trim(), baseCurrency: currency })}>
            {busy ? 'Creating…' : 'Create group'}
          </button>
        </>
      )}
    >
      <FormSection title="Identity">
        <Field label="Group name" required>
          <input className="input" value={name} onChange={(e) => setName(e.target.value)} placeholder="NAS Group" />
        </Field>
        <Field label="Reporting currency" hint="Companies reporting in another currency are listed, not converted.">
          <input className="input" value={currency} onChange={(e) => setCurrency(e.target.value.toUpperCase().slice(0, 3))} />
        </Field>
      </FormSection>
    </Modal>
  );
}

function LinkCompanyModal({ open, onClose, onSubmit, busy }: {
  open: boolean; onClose: () => void; onSubmit: (v: { organizationId: string }) => void; busy: boolean;
}) {
  const [orgId, setOrgId] = useState('');
  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Add a company to the group"
      width={560}
      footer={(
        <>
          <button className="btn-secondary" onClick={onClose}>Cancel</button>
          <button className="btn-primary" disabled={busy || !orgId} onClick={() => onSubmit({ organizationId: orgId })}>
            {busy ? 'Adding…' : 'Add company'}
          </button>
        </>
      )}
    >
      <FormSection title="Company">
        <Field
          label="Company id"
          required
          span={2}
          hint="You can only add a company you already hold a seat in — joining a group never grants access to books you could not otherwise open."
        >
          <input className="input" value={orgId} onChange={(e) => setOrgId(e.target.value.trim())} placeholder="cmt…" />
        </Field>
      </FormSection>
    </Modal>
  );
}
