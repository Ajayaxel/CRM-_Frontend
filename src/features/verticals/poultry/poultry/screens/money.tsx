'use client';

import React, { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { Landmark } from 'lucide-react';
import { api, apiErrorMessage } from '@/lib/api';
import { useAuth } from '@/features/foundation/auth';
import {
  Badge, Card, DataTable, DataTableColumn, Drawer, EmptyState, Field, FormSection,
  Modal, SectionTitle, Segmented, StatCard, humanStatus,
} from '../ui/kit';
import {
  DateRange, Detail, DetailGrid, PERIODS, PageHead, Pagination, SearchBox, StatusSelect,
  fmtDate, fmtDateTime, money, toDateInput, useListState,
} from '../ui/common';
import { WITHDRAWAL_KINDS, toneForDocStatus } from '../ui/tone';

const TABS = ['Books', 'Accounts', 'Vouchers', 'Approvals', 'Withdrawals', 'Loans', 'Assets'];
const VOUCHER_TYPES = ['PAYMENT', 'RECEIPT', 'EXPENSE', 'ADJUSTMENT', 'WITHDRAWAL'];

interface MoneyAccount {
  id: string; ledgerCode: string; kind: 'CASH' | 'BANK'; name: string;
  bankName?: string | null; accountRef?: string | null; isActive: boolean;
  balance: number; moneyIn: number; moneyOut: number;
}

/** Row shape of AccountingService.transactions() — read from the source, not guessed. */
interface BookRow {
  id: string; date: string; memo: string; sourceType: string; sourceId: string | null;
  label: string; type: string; moneyIn: number; moneyOut: number; amount: number;
  account: string; accountIds: string[]; category: string; categoryCode: string | null;
  balance: number;
}

interface BooksData {
  accounts: MoneyAccount[];
  transactions: {
    rows: BookRow[]; total: number; truncated: boolean; opening: number; closing: number;
    accounts: { id: string; code: string; name: string; subtype: string | null }[];
  };
}

interface VoucherRow {
  id: string; voucherNo: string; type: string; date: string; amountInr: number;
  narration: string; status: string; refType?: string | null;
}

interface ApprovalRow {
  id: string; createdAt: string; entityType: string; action: string; status: string;
  reason?: string | null;
  payload?: { amountInr?: number; description?: string; personName?: string } | null;
}

interface WithdrawalRow {
  id: string; reference: string; date: string; personName: string; staffId?: string | null;
  amountInr: number; purpose: string; kind: string; mode: string; ledgerCode: string;
  voucherNo?: string | null; status: string; settledInr: number; notes?: string | null;
  rejectedReason?: string | null; createdAt: string;
}

interface LoanRow {
  id: string; reference: string; provider: string; principalInr: number; interestRatePct: number;
  emiInr: number; emiDueDay: number; startDate: string; endDate?: string | null; status: string;
  notes?: string | null;
  payments: { id: string; date: string; amountInr: number; principalInr: number; interestInr: number; ledgerCode: string; voucherNo?: string | null }[];
  principalPaidInr: number; interestPaidInr: number; outstandingInr: number;
}

interface AssetRow {
  id: string; reference: string; name: string; category?: string | null; acquisitionDate: string;
  costInr: number; location?: string | null; loanId?: string | null; status: string;
  disposalDate?: string | null; disposalProceedsInr?: number | null; notes?: string | null;
}

export function PoultryMoney() {
  const { hasPermission } = useAuth();
  const canFinance = hasPermission('poultry.finance');
  const [tab, setTab] = useState<string>(() => {
    if (typeof window === 'undefined') return 'Books';
    const t = (new URLSearchParams(window.location.search).get('tab') ?? '').toLowerCase();
    return TABS.find((x) => x.toLowerCase() === t) ?? 'Books';
  });

  if (!canFinance) {
    return (
      <div className="ds-page">
        <PageHead title="Money desk" />
        <Card>
          <EmptyState icon={Landmark} title="The money desk needs the finance permission." body="Ask an administrator for poultry.finance to read the books and move money." />
        </Card>
      </div>
    );
  }

  return (
    <div className="ds-page">
      <PageHead title="Money desk" subtitle="Books, accounts, vouchers, approvals — every rupee's paper trail" />
      <div style={{ marginBottom: 16, overflowX: 'auto' }}>
        <Segmented options={TABS} value={tab} onChange={setTab} />
      </div>
      {tab === 'Books' && <BooksView />}
      {tab === 'Accounts' && <AccountsView />}
      {tab === 'Vouchers' && <VouchersView />}
      {tab === 'Approvals' && <ApprovalsView />}
      {tab === 'Withdrawals' && <WithdrawalsView />}
      {tab === 'Loans' && <LoansView />}
      {tab === 'Assets' && <AssetsView />}
    </div>
  );
}

// ============================================================ Books

function BooksView() {
  const [ledgerCode, setLedgerCode] = useState('');
  const [period, setPeriod] = useState('this_month');

  const { data: accounts } = useQuery({
    queryKey: ['py-accounts'],
    queryFn: async () => (await api.get<MoneyAccount[]>('/poultry/accounts')).data,
  });
  const { data, isLoading } = useQuery({
    queryKey: ['py-books', ledgerCode, period],
    queryFn: async () => (await api.get<BooksData>('/poultry/books', {
      params: { ...(ledgerCode ? { ledgerCode } : {}), period },
    })).data,
  });

  const rows = data?.transactions.rows ?? [];
  const columns: DataTableColumn<BookRow>[] = [
    { key: 'date', header: 'Date', width: 100, render: (r) => fmtDate(r.date) },
    { key: 'memo', header: 'Particulars', render: (r) => (
      <div style={{ minWidth: 0 }}>
        <div>{r.memo}</div>
        <div className="ds-caption">{r.label}{r.type ? ` · ${humanStatus(r.type)}` : ''}</div>
      </div>
    ) },
    { key: 'account', header: 'Account', width: 160, render: (r) => r.account || <span className="ds-caption">—</span> },
    { key: 'category', header: 'Category', width: 160, render: (r) => r.category },
    { key: 'moneyIn', header: 'Money in', align: 'right', width: 110, render: (r) => (r.moneyIn ? money(r.moneyIn) : <span className="ds-caption">—</span>) },
    { key: 'moneyOut', header: 'Money out', align: 'right', width: 110, render: (r) => (r.moneyOut ? money(r.moneyOut) : <span className="ds-caption">—</span>) },
    { key: 'balance', header: 'Balance', align: 'right', width: 120, render: (r) => money(r.balance) },
  ];

  return (
    <div>
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 14 }}>
        <select className="input" style={{ maxWidth: 260 }} value={ledgerCode} aria-label="Account" onChange={(e) => setLedgerCode(e.target.value)}>
          <option value="">All cash & bank</option>
          {(accounts ?? []).map((a) => <option key={a.id} value={a.ledgerCode}>{`${a.name} (${a.ledgerCode})`}</option>)}
        </select>
        <select className="input" style={{ maxWidth: 170 }} value={period} aria-label="Period" onChange={(e) => setPeriod(e.target.value)}>
          {PERIODS.filter((p) => p.key !== 'custom').map((p) => <option key={p.key} value={p.key}>{p.label}</option>)}
        </select>
      </div>

      <div className="ds-grid ds-grid-kpi">
        <StatCard label="Opening" value={money(data?.transactions.opening)} hint="At the start of the period" />
        <StatCard label="Closing" value={money(data?.transactions.closing)} tone="active" hint={data?.transactions.truncated ? 'Window truncated at 2,000 postings' : `${data?.transactions.total ?? 0} postings`} />
        {(data?.accounts ?? []).map((a) => (
          <StatCard key={a.id} label={`${a.name} (${a.ledgerCode})`} value={money(a.balance)} hint={`${humanStatus(a.kind)} · in ${money(a.moneyIn)} · out ${money(a.moneyOut)}`} />
        ))}
      </div>

      <Card flush>
        <DataTable
          rows={rows}
          columns={columns}
          rowKey={(r) => r.id}
          loading={isLoading}
          dense
          empty={<EmptyState title="Nothing in the window" body="No cash or bank movement in this period." compact />}
        />
      </Card>
    </div>
  );
}

// ============================================================ Accounts

const EMPTY_ACCOUNT_FORM = { kind: 'CASH', name: '', bankName: '', accountRef: '', openingBalanceInr: '', isActive: true };

function AccountsView() {
  const qc = useQueryClient();
  const [creating, setCreating] = useState(false);
  const [editing, setEditing] = useState<MoneyAccount | null>(null);
  const [form, setForm] = useState(EMPTY_ACCOUNT_FORM);

  const { data: accounts, isLoading } = useQuery({
    queryKey: ['py-accounts'],
    queryFn: async () => (await api.get<MoneyAccount[]>('/poultry/accounts')).data,
  });

  const invalidate = () => {
    qc.invalidateQueries({ queryKey: ['py-accounts'] });
    qc.invalidateQueries({ queryKey: ['py-books'] });
    qc.invalidateQueries({ queryKey: ['py-dashboard'] });
  };

  const save = useMutation({
    mutationFn: async () => {
      if (editing) {
        return api.patch(`/poultry/accounts/${editing.id}`, {
          name: form.name,
          bankName: form.bankName || undefined,
          accountRef: form.accountRef || undefined,
          isActive: form.isActive,
        });
      }
      return api.post('/poultry/accounts', {
        kind: form.kind,
        name: form.name,
        bankName: form.bankName || undefined,
        accountRef: form.accountRef || undefined,
        openingBalanceInr: form.openingBalanceInr ? Number(form.openingBalanceInr) : undefined,
      });
    },
    onSuccess: () => {
      toast.success(editing ? 'Account updated' : 'Account added');
      setCreating(false); setEditing(null); setForm(EMPTY_ACCOUNT_FORM);
      invalidate();
    },
    onError: (e) => toast.error(apiErrorMessage(e)),
  });

  const openEdit = (a: MoneyAccount) => {
    setEditing(a);
    setForm({ kind: a.kind, name: a.name, bankName: a.bankName ?? '', accountRef: a.accountRef ?? '', openingBalanceInr: '', isActive: a.isActive });
  };

  return (
    <div>
      <SectionTitle
        sub="Balances are the ledger's answer, never a stored column"
        action={<button className="btn-primary btn-sm" onClick={() => { setEditing(null); setForm(EMPTY_ACCOUNT_FORM); setCreating(true); }}>New account</button>}
      >Money accounts</SectionTitle>

      {isLoading && <div className="ds-caption">Loading…</div>}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(240px,1fr))', gap: 14 }}>
        {(accounts ?? []).map((a) => (
          <Card key={a.id}>
            <div style={{ display: 'flex', alignItems: 'flex-start', gap: 10 }}>
              <div style={{ minWidth: 0, flex: 1 }}>
                <div style={{ fontWeight: 650 }}>{a.name}</div>
                <div className="ds-caption">
                  {[a.bankName, a.accountRef].filter(Boolean).join(' · ') || `Ledger ${a.ledgerCode}`}
                </div>
              </div>
              <Badge tone={a.kind === 'CASH' ? 'renewal' : 'info'}>{humanStatus(a.kind)}</Badge>
            </div>
            <div className="ds-display" style={{ marginTop: 12 }}>{money(a.balance)}</div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 10 }}>
              <span className="ds-caption">in {money(a.moneyIn)} · out {money(a.moneyOut)}</span>
              {!a.isActive && <Badge tone="expired">Inactive</Badge>}
              <button className="btn-ghost btn-sm" style={{ marginLeft: 'auto' }} onClick={() => openEdit(a)}>Edit</button>
            </div>
          </Card>
        ))}
      </div>

      <Modal
        open={creating || !!editing}
        onClose={() => { setCreating(false); setEditing(null); }}
        title={editing ? `Edit ${editing.name}` : 'New account'}
        subtitle={editing ? `Ledger ${editing.ledgerCode} — kind and code are the account's identity and cannot change` : 'Creates the ledger account and its profile together'}
        width={560}
        footer={(
          <>
            <button className="btn-secondary" onClick={() => { setCreating(false); setEditing(null); }}>Cancel</button>
            <button className="btn-primary" disabled={save.isPending || !form.name} onClick={() => save.mutate()}>
              {save.isPending ? 'Saving…' : editing ? 'Save changes' : 'Add account'}
            </button>
          </>
        )}
      >
        <FormSection title="The account">
          {!editing && (
            <Field label="Kind" required>
              <select className="input" value={form.kind} onChange={(e) => setForm({ ...form, kind: e.target.value })}>
                <option value="CASH">Cash</option>
                <option value="BANK">Bank</option>
              </select>
            </Field>
          )}
          <Field label="Name" required>
            <input className="input" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
          </Field>
          <Field label="Bank name">
            <input className="input" value={form.bankName} onChange={(e) => setForm({ ...form, bankName: e.target.value })} />
          </Field>
          <Field label="Account ref">
            <input className="input" value={form.accountRef} onChange={(e) => setForm({ ...form, accountRef: e.target.value })} />
          </Field>
          {!editing && (
            <Field label="Opening balance (₹)">
              <input className="input" type="number" min={0} value={form.openingBalanceInr} onChange={(e) => setForm({ ...form, openingBalanceInr: e.target.value })} />
            </Field>
          )}
          {editing && (
            <Field label="Status" span={2}>
              <label style={{ display: 'flex', gap: 8, alignItems: 'center', fontSize: 13 }}>
                <input type="checkbox" checked={form.isActive} onChange={(e) => setForm({ ...form, isActive: e.target.checked })} />
                Active — documents may pay from and into this account
              </label>
            </Field>
          )}
        </FormSection>
      </Modal>
    </div>
  );
}

// ============================================================ Vouchers

function VouchersView() {
  const { state, set, params } = useListState();
  const [type, setType] = useState('');

  const { data, isLoading } = useQuery({
    queryKey: ['py-vouchers', params, type],
    queryFn: async () => (await api.get<{ data: VoucherRow[]; meta: { page: number; limit: number; total: number; totalPages: number } }>(
      '/poultry/vouchers', { params: { ...params, ...(type ? { type } : {}) } },
    )).data,
  });

  const columns: DataTableColumn<VoucherRow>[] = [
    { key: 'voucherNo', header: 'Voucher', width: 150, render: (v) => <span style={{ fontWeight: 600 }}>{v.voucherNo}</span> },
    { key: 'type', header: 'Type', width: 120, render: (v) => humanStatus(v.type) },
    { key: 'date', header: 'Date', width: 110, render: (v) => fmtDate(v.date) },
    { key: 'amountInr', header: 'Amount', align: 'right', width: 110, render: (v) => money(v.amountInr) },
    { key: 'narration', header: 'Narration', render: (v) => v.narration },
    { key: 'status', header: 'Status', width: 110, render: (v) => <Badge tone={toneForDocStatus(v.status)}>{humanStatus(v.status)}</Badge> },
    { key: 'refType', header: 'Covers', width: 150, render: (v) => v.refType ?? <span className="ds-caption">—</span> },
  ];

  return (
    <div>
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 14, alignItems: 'center' }}>
        <SearchBox value={state.search} onChange={(v) => set({ search: v })} placeholder="Search voucher, narration…" />
        <select className="input" style={{ maxWidth: 180 }} value={type} aria-label="Voucher type" onChange={(e) => { setType(e.target.value); set({ page: 1 }); }}>
          <option value="">All types</option>
          {VOUCHER_TYPES.map((t) => <option key={t} value={t}>{humanStatus(t)}</option>)}
        </select>
        <DateRange from={state.from} to={state.to} onChange={(patch) => set(patch)} />
      </div>
      <Card flush>
        <DataTable
          rows={data?.data ?? []}
          columns={columns}
          rowKey={(v) => v.id}
          loading={isLoading}
          dense
          empty={<EmptyState title="No vouchers" body="Vouchers mint automatically as money documents post." compact />}
        />
      </Card>
      <Pagination meta={data?.meta} onPage={(p) => set({ page: p })} />
    </div>
  );
}

// ============================================================ Approvals

function ApprovalsView() {
  const [status, setStatus] = useState('PENDING');
  const [page, setPage] = useState(1);

  const { data, isLoading } = useQuery({
    queryKey: ['py-approvals', status, page],
    queryFn: async () => (await api.get<{ data: ApprovalRow[]; meta: { page: number; limit: number; total: number; totalPages: number } }>(
      '/poultry/approvals', { params: { page, limit: 25, status } },
    )).data,
  });

  const columns: DataTableColumn<ApprovalRow>[] = [
    { key: 'createdAt', header: 'Raised', width: 140, render: (a) => fmtDateTime(a.createdAt) },
    { key: 'entityType', header: 'Entity', width: 150, render: (a) => a.entityType },
    { key: 'action', header: 'Action', width: 170, render: (a) => humanStatus(a.action) },
    { key: 'payload', header: 'Summary', render: (a) => {
      const p = a.payload;
      if (!p) return <span className="ds-caption">—</span>;
      const bits = [
        p.amountInr != null ? money(p.amountInr) : null,
        p.personName ?? null,
        p.description ?? null,
      ].filter(Boolean);
      return bits.length ? bits.join(' · ') : <span className="ds-caption">—</span>;
    } },
    { key: 'status', header: 'Status', width: 110, render: (a) => <Badge tone={toneForDocStatus(a.status === 'PENDING' ? 'SUBMITTED' : a.status)}>{humanStatus(a.status)}</Badge> },
  ];

  return (
    <div>
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 14 }}>
        <select className="input" style={{ maxWidth: 170 }} value={status} aria-label="Approval status" onChange={(e) => { setStatus(e.target.value); setPage(1); }}>
          {['PENDING', 'APPROVED', 'REJECTED'].map((s) => <option key={s} value={s}>{humanStatus(s)}</option>)}
        </select>
      </div>
      <Card flush>
        <DataTable
          rows={data?.data ?? []}
          columns={columns}
          rowKey={(a) => a.id}
          loading={isLoading}
          dense
          empty={<EmptyState title="Nothing waiting" body="Large expenses and withdrawals queue here until someone decides them." compact />}
        />
      </Card>
      <Pagination meta={data?.meta} onPage={setPage} />
      <p className="ds-caption" style={{ marginTop: 10 }}>
        This is the who-asked/who-decided trail. Decisions happen on the expense or withdrawal itself — approve or reject from the Withdrawals tab or the Expenses screen.
      </p>
    </div>
  );
}

// ============================================================ Withdrawals

const EMPTY_WITHDRAWAL_FORM = { date: toDateInput(), personName: '', staffId: '', amountInr: '', purpose: '', kind: 'BUSINESS_EXPENSE', mode: 'CASH', ledgerCode: '' };

function WithdrawalsView() {
  const qc = useQueryClient();
  const { state, set, params } = useListState();
  const [kind, setKind] = useState('');
  const [creating, setCreating] = useState(false);
  const [active, setActive] = useState<WithdrawalRow | null>(null);
  const [form, setForm] = useState(EMPTY_WITHDRAWAL_FORM);
  const [reason, setReason] = useState('');
  const [settleAmount, setSettleAmount] = useState('');

  const { data, isLoading } = useQuery({
    queryKey: ['py-withdrawals', params, kind],
    queryFn: async () => (await api.get<{ data: WithdrawalRow[]; meta: { page: number; limit: number; total: number; totalPages: number } }>(
      '/poultry/withdrawals', { params: { ...params, ...(kind ? { kind } : {}) } },
    )).data,
  });
  const { data: staff } = useQuery({
    queryKey: ['py-staff-all'],
    queryFn: async () => (await api.get<{ data: { id: string; name: string }[] }>('/poultry/staff', { params: { limit: 200 } })).data.data,
    enabled: creating,
  });
  const { data: accounts } = useQuery({
    queryKey: ['py-accounts'],
    queryFn: async () => (await api.get<MoneyAccount[]>('/poultry/accounts')).data,
    enabled: creating,
  });

  const invalidate = () => {
    qc.invalidateQueries({ queryKey: ['py-withdrawals'] });
    qc.invalidateQueries({ queryKey: ['py-approvals'] });
    qc.invalidateQueries({ queryKey: ['py-vouchers'] });
    qc.invalidateQueries({ queryKey: ['py-books'] });
    qc.invalidateQueries({ queryKey: ['py-dashboard'] });
  };

  const create = useMutation({
    mutationFn: () => api.post('/poultry/withdrawals', {
      date: form.date,
      personName: form.personName,
      staffId: form.staffId || undefined,
      amountInr: Number(form.amountInr),
      purpose: form.purpose,
      kind: form.kind,
      mode: form.mode,
      ledgerCode: form.ledgerCode,
    }),
    onSuccess: () => {
      toast.success('Withdrawal raised — it waits for approval');
      setCreating(false); setForm(EMPTY_WITHDRAWAL_FORM);
      invalidate();
    },
    onError: (e) => toast.error(apiErrorMessage(e)),
  });

  const decide = useMutation({
    mutationFn: (approve: boolean) => api.post(`/poultry/withdrawals/${active!.id}/${approve ? 'approve' : 'reject'}`, {
      reason: reason || undefined,
    }),
    onSuccess: (_r, approve) => {
      toast.success(approve ? 'Withdrawal approved' : 'Withdrawal rejected');
      setActive(null); setReason('');
      invalidate();
    },
    onError: (e) => toast.error(apiErrorMessage(e)),
  });

  const settle = useMutation({
    mutationFn: () => api.post(`/poultry/withdrawals/${active!.id}/settle`, { amountInr: Number(settleAmount) }),
    onSuccess: () => {
      toast.success('Advance settled');
      setActive(null); setSettleAmount('');
      invalidate();
    },
    onError: (e) => toast.error(apiErrorMessage(e)),
  });

  const columns: DataTableColumn<WithdrawalRow>[] = [
    { key: 'reference', header: 'Ref', width: 110, render: (w) => <span style={{ fontWeight: 600 }}>{w.reference}</span> },
    { key: 'date', header: 'Date', width: 110, render: (w) => fmtDate(w.date) },
    { key: 'personName', header: 'Person', width: 150, render: (w) => w.personName },
    { key: 'kind', header: 'Kind', width: 150, render: (w) => humanStatus(w.kind) },
    { key: 'purpose', header: 'Purpose', render: (w) => w.purpose },
    { key: 'amountInr', header: 'Amount', align: 'right', width: 110, render: (w) => money(w.amountInr) },
    { key: 'status', header: 'Status', width: 110, render: (w) => <Badge tone={toneForDocStatus(w.status)}>{humanStatus(w.status)}</Badge> },
    { key: 'voucherNo', header: 'Voucher', width: 140, render: (w) => w.voucherNo ?? <span className="ds-caption">—</span> },
  ];

  const remaining = active ? active.amountInr - active.settledInr : 0;

  return (
    <div>
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 14, alignItems: 'center' }}>
        <SearchBox value={state.search} onChange={(v) => set({ search: v })} placeholder="Search person, purpose…" />
        <StatusSelect value={state.status} onChange={(v) => set({ status: v })} options={['SUBMITTED', 'POSTED', 'REJECTED']} />
        <select className="input" style={{ maxWidth: 190 }} value={kind} aria-label="Withdrawal kind" onChange={(e) => { setKind(e.target.value); set({ page: 1 }); }}>
          <option value="">All kinds</option>
          {WITHDRAWAL_KINDS.map((k) => <option key={k} value={k}>{humanStatus(k)}</option>)}
        </select>
        <button className="btn-primary" style={{ marginLeft: 'auto' }} onClick={() => { setForm(EMPTY_WITHDRAWAL_FORM); setCreating(true); }}>New withdrawal</button>
      </div>

      <Card flush>
        <DataTable
          rows={data?.data ?? []}
          columns={columns}
          rowKey={(w) => w.id}
          loading={isLoading}
          onRowClick={(w) => { setActive(w); setReason(''); setSettleAmount(''); }}
          dense
          empty={<EmptyState title="No withdrawals" body="Money leaving for people — expenses, advances, drawings — is raised here and waits for approval." compact />}
        />
      </Card>
      <Pagination meta={data?.meta} onPage={(p) => set({ page: p })} />

      <Drawer
        open={!!active}
        onClose={() => setActive(null)}
        title={active ? `${active.reference} · ${active.personName}` : ''}
        subtitle={active ? `${humanStatus(active.kind)} · ${fmtDate(active.date)}` : undefined}
        actions={active ? <Badge tone={toneForDocStatus(active.status)}>{humanStatus(active.status)}</Badge> : undefined}
      >
        {active && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
            <DetailGrid>
              <Detail label="Amount" value={money(active.amountInr)} />
              <Detail label="Purpose" value={active.purpose} />
              <Detail label="Mode" value={humanStatus(active.mode)} />
              <Detail label="Account" value={active.ledgerCode} />
              <Detail label="Voucher" value={active.voucherNo ?? '—'} />
              <Detail label="Raised" value={fmtDateTime(active.createdAt)} />
              {active.kind === 'ADVANCE' && <Detail label="Settled" value={`${money(active.settledInr)} of ${money(active.amountInr)}`} />}
              {active.rejectedReason && <Detail label="Rejected because" value={active.rejectedReason} />}
              {active.notes && <Detail label="Notes" value={active.notes} />}
            </DetailGrid>

            {active.status === 'SUBMITTED' && (
              <div>
                <SectionTitle sub="Approving mints the voucher and posts the books">Decision</SectionTitle>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                  <input
                    className="input" placeholder="Reason (required to reject)"
                    value={reason} onChange={(e) => setReason(e.target.value)} aria-label="Decision reason"
                  />
                  <div style={{ display: 'flex', gap: 8 }}>
                    <button className="btn-primary" disabled={decide.isPending} onClick={() => decide.mutate(true)}>
                      {decide.isPending ? 'Saving…' : 'Approve'}
                    </button>
                    <button className="btn-danger" disabled={decide.isPending || !reason.trim()} onClick={() => decide.mutate(false)}>
                      {decide.isPending ? 'Saving…' : 'Reject'}
                    </button>
                  </div>
                </div>
              </div>
            )}

            {active.status === 'POSTED' && active.kind === 'ADVANCE' && remaining > 0 && (
              <div>
                <SectionTitle sub={`${money(remaining)} still unsettled — settlement converts advance into expense`}>Settle advance</SectionTitle>
                <div style={{ display: 'flex', gap: 8 }}>
                  <input
                    className="input" type="number" min={1} max={remaining} placeholder="Amount (₹)"
                    value={settleAmount} onChange={(e) => setSettleAmount(e.target.value)} aria-label="Settlement amount"
                  />
                  <button className="btn-primary" disabled={settle.isPending || !settleAmount} onClick={() => settle.mutate()}>
                    {settle.isPending ? 'Saving…' : 'Settle'}
                  </button>
                </div>
              </div>
            )}
          </div>
        )}
      </Drawer>

      <Modal
        open={creating}
        onClose={() => setCreating(false)}
        title="New withdrawal"
        subtitle="Always waits for approval — money leaving without a trace is the failure mode."
        width={640}
        footer={(
          <>
            <button className="btn-secondary" onClick={() => setCreating(false)}>Cancel</button>
            <button
              className="btn-primary"
              disabled={create.isPending || !form.personName || !form.amountInr || !form.purpose || !form.ledgerCode}
              onClick={() => create.mutate()}
            >{create.isPending ? 'Saving…' : 'Raise withdrawal'}</button>
          </>
        )}
      >
        <FormSection title="Who and why">
          <Field label="Date" required>
            <input className="input" type="date" value={form.date} onChange={(e) => setForm({ ...form, date: e.target.value })} />
          </Field>
          <Field label="Person" required>
            <input className="input" value={form.personName} onChange={(e) => setForm({ ...form, personName: e.target.value })} />
          </Field>
          <Field label="Staff member" hint="Optional — links the withdrawal to a staff record">
            <select className="input" value={form.staffId} onChange={(e) => setForm({ ...form, staffId: e.target.value })}>
              <option value="">Not on staff</option>
              {(staff ?? []).map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
            </select>
          </Field>
          <Field label="Kind" required hint="Drawing is equity out; an advance is an asset until settled">
            <select className="input" value={form.kind} onChange={(e) => setForm({ ...form, kind: e.target.value })}>
              {WITHDRAWAL_KINDS.map((k) => <option key={k} value={k}>{humanStatus(k)}</option>)}
            </select>
          </Field>
          <Field label="Purpose" required span={2}>
            <input className="input" value={form.purpose} onChange={(e) => setForm({ ...form, purpose: e.target.value })} />
          </Field>
        </FormSection>
        <FormSection title="The money">
          <Field label="Amount (₹)" required>
            <input className="input" type="number" min={1} value={form.amountInr} onChange={(e) => setForm({ ...form, amountInr: e.target.value })} />
          </Field>
          <Field label="Mode" required>
            <select className="input" value={form.mode} onChange={(e) => setForm({ ...form, mode: e.target.value })}>
              {['CASH', 'BANK', 'UPI'].map((m) => <option key={m} value={m}>{humanStatus(m)}</option>)}
            </select>
          </Field>
          <Field label="From account" required>
            <select className="input" value={form.ledgerCode} onChange={(e) => setForm({ ...form, ledgerCode: e.target.value })}>
              <option value="">Choose…</option>
              {(accounts ?? []).map((a) => <option key={a.ledgerCode} value={a.ledgerCode}>{a.name}</option>)}
            </select>
          </Field>
        </FormSection>
      </Modal>
    </div>
  );
}

// ============================================================ Loans

const EMPTY_LOAN_FORM = { provider: '', principalInr: '', interestRatePct: '', emiInr: '', emiDueDay: '', startDate: toDateInput(), notes: '' };
const EMPTY_LOAN_PAYMENT = { date: toDateInput(), amountInr: '', principalInr: '', interestInr: '', ledgerCode: '' };

function LoansView() {
  const qc = useQueryClient();
  const [creating, setCreating] = useState(false);
  const [paying, setPaying] = useState<LoanRow | null>(null);
  const [form, setForm] = useState(EMPTY_LOAN_FORM);
  const [payment, setPayment] = useState(EMPTY_LOAN_PAYMENT);

  const { data: loans, isLoading } = useQuery({
    queryKey: ['py-loans'],
    queryFn: async () => (await api.get<LoanRow[]>('/poultry/loans')).data,
  });
  const { data: accounts } = useQuery({
    queryKey: ['py-accounts'],
    queryFn: async () => (await api.get<MoneyAccount[]>('/poultry/accounts')).data,
    enabled: !!paying,
  });

  const invalidate = () => {
    qc.invalidateQueries({ queryKey: ['py-loans'] });
    qc.invalidateQueries({ queryKey: ['py-vouchers'] });
    qc.invalidateQueries({ queryKey: ['py-books'] });
    qc.invalidateQueries({ queryKey: ['py-dashboard'] });
  };

  const create = useMutation({
    mutationFn: () => api.post('/poultry/loans', {
      provider: form.provider,
      principalInr: Number(form.principalInr),
      interestRatePct: form.interestRatePct ? Number(form.interestRatePct) : undefined,
      emiInr: form.emiInr ? Number(form.emiInr) : undefined,
      emiDueDay: form.emiDueDay ? Number(form.emiDueDay) : undefined,
      startDate: form.startDate,
      notes: form.notes || undefined,
    }),
    onSuccess: () => {
      toast.success('Loan recorded');
      setCreating(false); setForm(EMPTY_LOAN_FORM);
      invalidate();
    },
    onError: (e) => toast.error(apiErrorMessage(e)),
  });

  const paymentSum = Number(payment.principalInr || 0) + Number(payment.interestInr || 0);
  const paymentMismatch = !!payment.amountInr && paymentSum !== Number(payment.amountInr);

  const pay = useMutation({
    mutationFn: () => api.post(`/poultry/loans/${paying!.id}/payments`, {
      date: payment.date,
      amountInr: Number(payment.amountInr),
      principalInr: Number(payment.principalInr || 0),
      interestInr: Number(payment.interestInr || 0),
      ledgerCode: payment.ledgerCode,
    }),
    onSuccess: () => {
      toast.success('Payment recorded');
      setPaying(null); setPayment(EMPTY_LOAN_PAYMENT);
      invalidate();
    },
    onError: (e) => toast.error(apiErrorMessage(e)),
  });

  return (
    <div>
      <SectionTitle
        sub="Outstanding is derived from payments, never stored"
        action={<button className="btn-primary btn-sm" onClick={() => { setForm(EMPTY_LOAN_FORM); setCreating(true); }}>New loan</button>}
      >Loans</SectionTitle>

      {isLoading && <div className="ds-caption">Loading…</div>}
      {!isLoading && !loans?.length && (
        <Card><EmptyState title="No loans" body="Record the loans behind vehicles and working capital to track EMIs." compact /></Card>
      )}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(280px,1fr))', gap: 14 }}>
        {(loans ?? []).map((l) => (
          <Card key={l.id}>
            <div style={{ display: 'flex', alignItems: 'flex-start', gap: 10 }}>
              <div style={{ minWidth: 0, flex: 1 }}>
                <div style={{ fontWeight: 650 }}>{l.provider}</div>
                <div className="ds-caption">{l.reference} · from {fmtDate(l.startDate)}</div>
              </div>
              <Badge tone={l.status === 'ACTIVE' ? 'renewal' : 'neutral'}>{humanStatus(l.status)}</Badge>
            </div>
            <DetailGrid>
              <Detail label="Principal" value={money(l.principalInr)} />
              <Detail label="EMI" value={l.emiInr ? `${money(l.emiInr)} · day ${l.emiDueDay}` : '—'} />
              <Detail label="Outstanding" value={<strong>{money(l.outstandingInr)}</strong>} />
              <Detail label="Paid" value={`${money(l.principalPaidInr)} + ${money(l.interestPaidInr)} interest`} />
            </DetailGrid>
            <div style={{ marginTop: 12 }}>
              <button className="btn-secondary btn-sm" onClick={() => { setPaying(l); setPayment(EMPTY_LOAN_PAYMENT); }}>Record payment</button>
            </div>
          </Card>
        ))}
      </div>

      <Modal
        open={creating}
        onClose={() => setCreating(false)}
        title="New loan"
        subtitle="Books the principal into the default bank against loans payable."
        width={640}
        footer={(
          <>
            <button className="btn-secondary" onClick={() => setCreating(false)}>Cancel</button>
            <button className="btn-primary" disabled={create.isPending || !form.provider || !form.principalInr || !form.startDate} onClick={() => create.mutate()}>
              {create.isPending ? 'Saving…' : 'Record loan'}
            </button>
          </>
        )}
      >
        <FormSection title="The loan">
          <Field label="Provider" required>
            <input className="input" value={form.provider} onChange={(e) => setForm({ ...form, provider: e.target.value })} />
          </Field>
          <Field label="Principal (₹)" required>
            <input className="input" type="number" min={1} value={form.principalInr} onChange={(e) => setForm({ ...form, principalInr: e.target.value })} />
          </Field>
          <Field label="Interest rate (%)">
            <input className="input" type="number" min={0} step="0.01" value={form.interestRatePct} onChange={(e) => setForm({ ...form, interestRatePct: e.target.value })} />
          </Field>
          <Field label="EMI (₹)">
            <input className="input" type="number" min={0} value={form.emiInr} onChange={(e) => setForm({ ...form, emiInr: e.target.value })} />
          </Field>
          <Field label="EMI due day">
            <input className="input" type="number" min={1} max={28} value={form.emiDueDay} onChange={(e) => setForm({ ...form, emiDueDay: e.target.value })} />
          </Field>
          <Field label="Start date" required>
            <input className="input" type="date" value={form.startDate} onChange={(e) => setForm({ ...form, startDate: e.target.value })} />
          </Field>
          <Field label="Notes" span={2}>
            <input className="input" value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} />
          </Field>
        </FormSection>
      </Modal>

      <Modal
        open={!!paying}
        onClose={() => setPaying(null)}
        title={paying ? `Payment — ${paying.provider}` : ''}
        subtitle={paying ? `${money(paying.outstandingInr)} outstanding on ${paying.reference}` : undefined}
        width={560}
        footer={(
          <>
            <button className="btn-secondary" onClick={() => setPaying(null)}>Cancel</button>
            <button
              className="btn-primary"
              disabled={pay.isPending || !payment.amountInr || !payment.ledgerCode || paymentMismatch}
              onClick={() => pay.mutate()}
            >{pay.isPending ? 'Saving…' : 'Record payment'}</button>
          </>
        )}
      >
        <FormSection title="The payment">
          <Field label="Date" required>
            <input className="input" type="date" value={payment.date} onChange={(e) => setPayment({ ...payment, date: e.target.value })} />
          </Field>
          <Field label="Amount (₹)" required>
            <input className="input" type="number" min={1} value={payment.amountInr} onChange={(e) => setPayment({ ...payment, amountInr: e.target.value })} />
          </Field>
          <Field label="Principal (₹)" required>
            <input className="input" type="number" min={0} value={payment.principalInr} onChange={(e) => setPayment({ ...payment, principalInr: e.target.value })} />
          </Field>
          <Field label="Interest (₹)" required>
            <input className="input" type="number" min={0} value={payment.interestInr} onChange={(e) => setPayment({ ...payment, interestInr: e.target.value })} />
          </Field>
          <Field label="Paid from account" required span={2}>
            <select className="input" value={payment.ledgerCode} onChange={(e) => setPayment({ ...payment, ledgerCode: e.target.value })}>
              <option value="">Choose…</option>
              {(accounts ?? []).map((a) => <option key={a.ledgerCode} value={a.ledgerCode}>{a.name}</option>)}
            </select>
          </Field>
        </FormSection>
        {paymentMismatch && (
          <p className="ds-caption" style={{ color: 'var(--tone-expired)' }}>
            Principal + interest must equal the payment amount ({money(paymentSum)} of {money(Number(payment.amountInr))}).
          </p>
        )}
      </Modal>
    </div>
  );
}

// ============================================================ Assets

const EMPTY_ASSET_FORM = { name: '', category: '', acquisitionDate: toDateInput(), costInr: '', location: '', loanId: '', notes: '' };
const EMPTY_DISPOSE_FORM = { disposalDate: toDateInput(), disposalProceedsInr: '', reason: '' };

function AssetsView() {
  const qc = useQueryClient();
  const [creating, setCreating] = useState(false);
  const [disposing, setDisposing] = useState<AssetRow | null>(null);
  const [form, setForm] = useState(EMPTY_ASSET_FORM);
  const [dispose, setDispose] = useState(EMPTY_DISPOSE_FORM);

  const { data: assets, isLoading } = useQuery({
    queryKey: ['py-assets'],
    queryFn: async () => (await api.get<AssetRow[]>('/poultry/assets')).data,
  });
  const { data: loans } = useQuery({
    queryKey: ['py-loans'],
    queryFn: async () => (await api.get<LoanRow[]>('/poultry/loans')).data,
    enabled: creating,
  });

  const invalidate = () => {
    qc.invalidateQueries({ queryKey: ['py-assets'] });
    qc.invalidateQueries({ queryKey: ['py-dashboard'] });
  };

  const create = useMutation({
    mutationFn: () => api.post('/poultry/assets', {
      name: form.name,
      category: form.category || undefined,
      acquisitionDate: form.acquisitionDate,
      costInr: Number(form.costInr),
      location: form.location || undefined,
      loanId: form.loanId || undefined,
      notes: form.notes || undefined,
    }),
    onSuccess: () => {
      toast.success('Asset recorded');
      setCreating(false); setForm(EMPTY_ASSET_FORM);
      invalidate();
    },
    onError: (e) => toast.error(apiErrorMessage(e)),
  });

  const doDispose = useMutation({
    mutationFn: () => api.post(`/poultry/assets/${disposing!.id}/dispose`, {
      disposalDate: dispose.disposalDate,
      disposalProceedsInr: dispose.disposalProceedsInr ? Number(dispose.disposalProceedsInr) : undefined,
      reason: dispose.reason || undefined,
    }),
    onSuccess: () => {
      toast.success('Asset disposed');
      setDisposing(null); setDispose(EMPTY_DISPOSE_FORM);
      invalidate();
    },
    onError: (e) => toast.error(apiErrorMessage(e)),
  });

  const columns: DataTableColumn<AssetRow>[] = [
    { key: 'reference', header: 'Ref', width: 100, render: (a) => <span style={{ fontWeight: 600 }}>{a.reference}</span> },
    { key: 'name', header: 'Asset', render: (a) => a.name },
    { key: 'category', header: 'Category', width: 130, render: (a) => a.category ?? <span className="ds-caption">—</span> },
    { key: 'acquisitionDate', header: 'Acquired', width: 110, render: (a) => fmtDate(a.acquisitionDate) },
    { key: 'costInr', header: 'Cost', align: 'right', width: 110, render: (a) => money(a.costInr) },
    { key: 'location', header: 'Location', width: 140, render: (a) => a.location ?? <span className="ds-caption">—</span> },
    { key: 'status', header: 'Status', width: 110, render: (a) => <Badge tone={a.status === 'ACTIVE' ? 'active' : 'neutral'}>{humanStatus(a.status)}</Badge> },
    { key: 'actions', header: '', width: 100, render: (a) => a.status === 'ACTIVE' ? (
      <button className="btn-ghost btn-sm" onClick={(e) => { e.stopPropagation(); setDisposing(a); setDispose(EMPTY_DISPOSE_FORM); }}>Dispose</button>
    ) : null },
  ];

  return (
    <div>
      <SectionTitle
        sub="What the company owns — vehicles, equipment, office"
        action={<button className="btn-primary btn-sm" onClick={() => { setForm(EMPTY_ASSET_FORM); setCreating(true); }}>New asset</button>}
      >Assets</SectionTitle>

      <Card flush>
        <DataTable
          rows={assets ?? []}
          columns={columns}
          rowKey={(a) => a.id}
          loading={isLoading}
          dense
          empty={<EmptyState title="No assets" body="Record what the company owns so disposals leave a trail." compact />}
        />
      </Card>

      <Modal
        open={creating}
        onClose={() => setCreating(false)}
        title="New asset"
        width={640}
        footer={(
          <>
            <button className="btn-secondary" onClick={() => setCreating(false)}>Cancel</button>
            <button className="btn-primary" disabled={create.isPending || !form.name || !form.costInr || !form.acquisitionDate} onClick={() => create.mutate()}>
              {create.isPending ? 'Saving…' : 'Add asset'}
            </button>
          </>
        )}
      >
        <FormSection title="The asset">
          <Field label="Name" required>
            <input className="input" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
          </Field>
          <Field label="Category">
            <input className="input" placeholder="Vehicles, Equipment, Office…" value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value })} />
          </Field>
          <Field label="Acquired on" required>
            <input className="input" type="date" value={form.acquisitionDate} onChange={(e) => setForm({ ...form, acquisitionDate: e.target.value })} />
          </Field>
          <Field label="Cost (₹)" required>
            <input className="input" type="number" min={1} value={form.costInr} onChange={(e) => setForm({ ...form, costInr: e.target.value })} />
          </Field>
          <Field label="Location">
            <input className="input" value={form.location} onChange={(e) => setForm({ ...form, location: e.target.value })} />
          </Field>
          <Field label="Financed by loan">
            <select className="input" value={form.loanId} onChange={(e) => setForm({ ...form, loanId: e.target.value })}>
              <option value="">Owned outright</option>
              {(loans ?? []).map((l) => <option key={l.id} value={l.id}>{l.reference} · {l.provider}</option>)}
            </select>
          </Field>
          <Field label="Notes" span={2}>
            <input className="input" value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} />
          </Field>
        </FormSection>
      </Modal>

      <Modal
        open={!!disposing}
        onClose={() => setDisposing(null)}
        title={disposing ? `Dispose ${disposing.name}` : ''}
        subtitle="Marks the asset disposed with the proceeds — the record stays."
        width={520}
        footer={(
          <>
            <button className="btn-secondary" onClick={() => setDisposing(null)}>Cancel</button>
            <button className="btn-danger" disabled={doDispose.isPending || !dispose.disposalDate} onClick={() => doDispose.mutate()}>
              {doDispose.isPending ? 'Saving…' : 'Dispose'}
            </button>
          </>
        )}
      >
        <FormSection title="The disposal">
          <Field label="Date" required>
            <input className="input" type="date" value={dispose.disposalDate} onChange={(e) => setDispose({ ...dispose, disposalDate: e.target.value })} />
          </Field>
          <Field label="Proceeds (₹)">
            <input className="input" type="number" min={0} value={dispose.disposalProceedsInr} onChange={(e) => setDispose({ ...dispose, disposalProceedsInr: e.target.value })} />
          </Field>
          <Field label="Reason" span={2}>
            <input className="input" value={dispose.reason} onChange={(e) => setDispose({ ...dispose, reason: e.target.value })} />
          </Field>
        </FormSection>
      </Modal>
    </div>
  );
}
