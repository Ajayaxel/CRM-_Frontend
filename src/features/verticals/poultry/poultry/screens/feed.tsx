'use client';

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { api, apiErrorMessage } from '@/lib/api';
import { useAuth } from '@/features/foundation/auth';
import { Badge, Card, DataTable, DataTableColumn, EmptyState, Field, FormSection, Modal, Segmented, humanStatus } from '../ui/kit';
import { DateRange, PageHead, Pagination, SearchBox, StatusSelect, fmtDate, money, toDateInput, useListState } from '../ui/common';
import { FEED_STAGES, PAID_STATUSES, PAY_MODES, paiseRate, toneForFeedHealth, toneForPaidStatus } from '../ui/tone';

interface FeedBoardRow {
  batchId: string; batchCode: string;
  farm: { id: string; name: string; code: string; region: string };
  birds: number; ageDays: number; status: string;
  health: 'OK' | 'LOW' | 'SHORTFALL';
  feed: {
    stage: string | null; currentStageBalanceBags: number; coverageDays: number | null;
    exhaustionDate: string | null; recommendedNextSupplyBags: number; shortfallBags: number;
    expectedToDateBags: number; suppliedTotalBags: number;
  };
}

interface FeedLoadRow {
  id: string; reference: string; date: string; stage: string; bags: number;
  ratePaisePerBag: number; amountInr: number; paidStatus: string;
  supplier: { name: string };
  batch: { code: string; farm: { name: string } };
}

interface FeedCompanyRow {
  supplierId: string; name: string; code: string; loads: number; bags: number;
  purchasedInr: number; paidOnDocsInr: number; separatePaymentsInr: number;
}

const VIEWS = ['Board', 'Loads', 'Companies'];

export function PoultryFeed() {
  const router = useRouter();
  const qc = useQueryClient();
  const { hasPermission } = useAuth();
  const canManage = hasPermission('poultry.manage');
  const [view, setView] = useState('Board');
  const [recording, setRecording] = useState(false);
  const { state, set, params } = useListState();
  const [stageFilter, setStageFilter] = useState('');
  const [paidFilter, setPaidFilter] = useState('');

  const { data: board, isLoading: boardLoading } = useQuery({
    queryKey: ['py-feed-board'],
    queryFn: async () => (await api.get<FeedBoardRow[]>('/poultry/feed/board')).data,
    enabled: view === 'Board',
  });

  const { data: loads, isLoading: loadsLoading } = useQuery({
    queryKey: ['py-feed-dispatches', params, stageFilter, paidFilter],
    queryFn: async () => (await api.get<{ data: FeedLoadRow[]; meta: { page: number; limit: number; total: number; totalPages: number } }>(
      '/poultry/feed-dispatches',
      { params: { ...params, ...(stageFilter ? { stage: stageFilter } : {}), ...(paidFilter ? { paidStatus: paidFilter } : {}) } },
    )).data,
    enabled: view === 'Loads',
  });

  const { data: companies, isLoading: companiesLoading } = useQuery({
    queryKey: ['py-feed-companies'],
    queryFn: async () => (await api.get<FeedCompanyRow[]>('/poultry/feed/companies')).data,
    enabled: view === 'Companies',
  });

  const invalidate = () => {
    qc.invalidateQueries({ queryKey: ['py-feed-dispatches'] });
    qc.invalidateQueries({ queryKey: ['py-feed-board'] });
    qc.invalidateQueries({ queryKey: ['py-feed-companies'] });
    qc.invalidateQueries({ queryKey: ['py-batches'] });
    qc.invalidateQueries({ queryKey: ['py-dashboard'] });
  };

  const boardColumns: DataTableColumn<FeedBoardRow>[] = [
    { key: 'batchCode', header: 'Batch', width: 110, render: (r) => <span style={{ fontWeight: 600 }}>{r.batchCode}</span> },
    { key: 'farm', header: 'Farm', render: (r) => (
      <div style={{ minWidth: 0 }}>
        <div style={{ fontWeight: 600 }}>{r.farm.name}</div>
        <div className="ds-caption">{r.farm.code} · {r.farm.region}</div>
      </div>
    ) },
    { key: 'birds', header: 'Birds', align: 'right', width: 90, render: (r) => r.birds.toLocaleString('en-IN') },
    { key: 'ageDays', header: 'Age', align: 'right', width: 70, render: (r) => `${r.ageDays}d` },
    { key: 'stage', header: 'Stage', width: 110, render: (r) => r.feed.stage ? humanStatus(r.feed.stage) : <span className="ds-caption">past plan</span> },
    { key: 'balance', header: 'Balance', align: 'right', width: 90, render: (r) => `${r.feed.currentStageBalanceBags} bags` },
    { key: 'coverage', header: 'Cover', align: 'right', width: 80, render: (r) => r.feed.coverageDays != null ? `${r.feed.coverageDays}d` : '—' },
    { key: 'exhaustion', header: 'Runs out', width: 110, render: (r) => fmtDate(r.feed.exhaustionDate) },
    { key: 'shortfall', header: 'Shortfall', align: 'right', width: 90, render: (r) => r.feed.shortfallBags > 0
      ? <span style={{ color: 'var(--tone-expired)', fontWeight: 600 }}>{r.feed.shortfallBags} bags</span>
      : <span className="ds-caption">—</span> },
    { key: 'recommended', header: 'Order next', align: 'right', width: 100, render: (r) => r.feed.recommendedNextSupplyBags > 0 ? `${r.feed.recommendedNextSupplyBags} bags` : '—' },
    { key: 'health', header: 'Health', width: 110, render: (r) => <Badge tone={toneForFeedHealth(r.health)}>{humanStatus(r.health)}</Badge> },
  ];

  const loadColumns: DataTableColumn<FeedLoadRow>[] = [
    { key: 'reference', header: 'Load', width: 100, render: (r) => <span style={{ fontWeight: 600 }}>{r.reference}</span> },
    { key: 'date', header: 'Date', width: 110, render: (r) => fmtDate(r.date) },
    { key: 'batch', header: 'Farm · batch', render: (r) => (
      <div style={{ minWidth: 0 }}>
        <div style={{ fontWeight: 600 }}>{r.batch.farm.name}</div>
        <div className="ds-caption">{r.batch.code}</div>
      </div>
    ) },
    { key: 'stage', header: 'Stage', width: 110, render: (r) => humanStatus(r.stage) },
    { key: 'bags', header: 'Bags', align: 'right', width: 80 },
    { key: 'rate', header: 'Rate/bag', align: 'right', width: 100, render: (r) => paiseRate(r.ratePaisePerBag) },
    { key: 'amountInr', header: 'Amount', align: 'right', width: 110, render: (r) => money(r.amountInr) },
    { key: 'supplier', header: 'Supplier', render: (r) => r.supplier.name },
    { key: 'paidStatus', header: 'Paid', width: 100, render: (r) => <Badge tone={toneForPaidStatus(r.paidStatus)}>{humanStatus(r.paidStatus)}</Badge> },
  ];

  const companyColumns: DataTableColumn<FeedCompanyRow>[] = [
    { key: 'code', header: 'Code', width: 90, render: (r) => <span style={{ fontWeight: 600 }}>{r.code}</span> },
    { key: 'name', header: 'Feed company' },
    { key: 'loads', header: 'Loads', align: 'right', width: 80 },
    { key: 'bags', header: 'Bags', align: 'right', width: 90, render: (r) => r.bags.toLocaleString('en-IN') },
    { key: 'purchasedInr', header: 'Purchased', align: 'right', width: 120, render: (r) => money(r.purchasedInr) },
    { key: 'paidOnDocsInr', header: 'Paid on docs', align: 'right', width: 120, render: (r) => money(r.paidOnDocsInr) },
    { key: 'separatePaymentsInr', header: 'Separate payments', align: 'right', width: 140, render: (r) => money(r.separatePaymentsInr) },
  ];

  return (
    <div className="ds-page">
      <PageHead
        title="Feed"
        subtitle="Stage balances against the plan, loads received, and company exposure"
        actions={canManage && (
          <button className="btn-primary" onClick={() => setRecording(true)}>Record load</button>
        )}
      />

      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 14 }}>
        <Segmented options={VIEWS} value={view} onChange={setView} />
        {view === 'Loads' && (
          <>
            <SearchBox value={state.search} onChange={(v) => set({ search: v })} placeholder="Search reference, supplier…" />
            <StatusSelect value={stageFilter} onChange={setStageFilter} options={FEED_STAGES} label="All stages" />
            <StatusSelect value={paidFilter} onChange={setPaidFilter} options={PAID_STATUSES} label="All paid states" />
            <DateRange from={state.from} to={state.to} onChange={(patch) => set(patch)} />
          </>
        )}
      </div>

      {view === 'Board' && (
        <Card flush>
          <DataTable
            rows={board ?? []}
            columns={boardColumns}
            rowKey={(r) => r.batchId}
            loading={boardLoading}
            onRowClick={(r) => router.push(`/poultry/batches/${r.batchId}`)}
            empty={<EmptyState title="No active batches" body="Feed positions appear here once batches are placed." compact />}
          />
        </Card>
      )}

      {view === 'Loads' && (
        <>
          <Card flush>
            <DataTable
              rows={loads?.data ?? []}
              columns={loadColumns}
              rowKey={(r) => r.id}
              loading={loadsLoading}
              empty={<EmptyState title="No feed loads" body="Loads recorded against batches show up here." compact />}
            />
          </Card>
          <Pagination meta={loads?.meta} onPage={(p) => set({ page: p })} />
        </>
      )}

      {view === 'Companies' && (
        <Card flush>
          <DataTable
            rows={companies ?? []}
            columns={companyColumns}
            rowKey={(r) => r.supplierId}
            loading={companiesLoading}
            empty={<EmptyState title="No feed companies" body="Feed purchases build this comparison." compact />}
          />
        </Card>
      )}

      <RecordLoadModal open={recording} onClose={() => setRecording(false)} onDone={invalidate} />
    </div>
  );
}

function RecordLoadModal({ open, onClose, onDone }: { open: boolean; onClose: () => void; onDone: () => void }) {
  const [form, setForm] = useState({ batchId: '', supplierId: '', date: toDateInput(), stage: 'STARTER', bags: '', rate: '', invoiceNo: '', loadRef: '', payMode: 'CREDIT', ledgerCode: '' });
  const { data: batches } = useQuery({
    queryKey: ['py-batches-active-lite'],
    queryFn: async () => (await api.get<{ data: { id: string; code: string; farm: { name: string } }[] }>('/poultry/batches', { params: { status: 'ACTIVE', limit: 200 } })).data.data,
    enabled: open,
  });
  const { data: suppliers } = useQuery({
    queryKey: ['py-feed-suppliers'],
    queryFn: async () => (await api.get<{ data: { id: string; name: string }[] }>('/poultry/suppliers', { params: { limit: 200 } })).data.data,
    enabled: open,
  });
  const { data: accounts } = useQuery({
    queryKey: ['py-accounts'],
    queryFn: async () => (await api.get<{ ledgerCode: string; name: string }[]>('/poultry/accounts')).data,
    enabled: open && form.payMode !== 'CREDIT',
  });
  const save = useMutation({
    mutationFn: () => api.post('/poultry/feed-dispatches', {
      supplierId: form.supplierId, batchId: form.batchId, date: form.date, stage: form.stage,
      bags: Number(form.bags), ratePaisePerBag: Math.round(Number(form.rate || 0) * 100),
      invoiceNo: form.invoiceNo || undefined, loadRef: form.loadRef || undefined,
      payMode: form.payMode, ledgerCode: form.payMode !== 'CREDIT' ? form.ledgerCode || undefined : undefined,
    }),
    onSuccess: () => { toast.success('Feed load recorded'); onClose(); onDone(); },
    onError: (e) => toast.error(apiErrorMessage(e)),
  });
  return (
    <Modal open={open} onClose={onClose} title="Record a feed load" width={640}
      footer={(<><button className="btn-secondary" onClick={onClose}>Cancel</button>
        <button className="btn-primary" disabled={save.isPending || !form.batchId || !form.supplierId || !form.bags} onClick={() => save.mutate()}>{save.isPending ? 'Saving…' : 'Record load'}</button></>)}>
      <FormSection title="The load">
        <Field label="Batch" required>
          <select className="input" value={form.batchId} onChange={(e) => setForm({ ...form, batchId: e.target.value })}>
            <option value="">Choose…</option>
            {(batches ?? []).map((b) => <option key={b.id} value={b.id}>{b.code} · {b.farm.name}</option>)}
          </select>
        </Field>
        <Field label="Feed company" required>
          <select className="input" value={form.supplierId} onChange={(e) => setForm({ ...form, supplierId: e.target.value })}>
            <option value="">Choose…</option>
            {(suppliers ?? []).map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
          </select>
        </Field>
        <Field label="Date" required><input className="input" type="date" value={form.date} onChange={(e) => setForm({ ...form, date: e.target.value })} /></Field>
        <Field label="Stage" required>
          <select className="input" value={form.stage} onChange={(e) => setForm({ ...form, stage: e.target.value })}>
            {FEED_STAGES.map((s) => <option key={s} value={s}>{humanStatus(s)}</option>)}
          </select>
        </Field>
        <Field label="Bags" required><input className="input" type="number" min={0.5} step="0.5" value={form.bags} onChange={(e) => setForm({ ...form, bags: e.target.value })} /></Field>
        <Field label="Rate per bag (₹)"><input className="input" type="number" min={0} step="0.01" value={form.rate} onChange={(e) => setForm({ ...form, rate: e.target.value })} /></Field>
        <Field label="Invoice no"><input className="input" value={form.invoiceNo} onChange={(e) => setForm({ ...form, invoiceNo: e.target.value })} /></Field>
        <Field label="Load ref"><input className="input" value={form.loadRef} onChange={(e) => setForm({ ...form, loadRef: e.target.value })} /></Field>
      </FormSection>
      <FormSection title="Payment">
        <Field label="Mode" hint="Credit raises the supplier's payable">
          <select className="input" value={form.payMode} onChange={(e) => setForm({ ...form, payMode: e.target.value })}>
            {PAY_MODES.map((m) => <option key={m} value={m}>{humanStatus(m)}</option>)}
          </select>
        </Field>
        {form.payMode !== 'CREDIT' && (
          <Field label="Paid from account" required>
            <select className="input" value={form.ledgerCode} onChange={(e) => setForm({ ...form, ledgerCode: e.target.value })}>
              <option value="">Choose…</option>
              {(accounts ?? []).map((a) => <option key={a.ledgerCode} value={a.ledgerCode}>{a.name}</option>)}
            </select>
          </Field>
        )}
      </FormSection>
    </Modal>
  );
}
