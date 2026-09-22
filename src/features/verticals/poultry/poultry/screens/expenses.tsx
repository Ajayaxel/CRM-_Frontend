'use client';

import React, { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { api, apiErrorMessage } from '@/lib/api';
import { useAuth } from '@/features/foundation/auth';
import { Badge, Card, DataTable, DataTableColumn, Drawer, EmptyState, Field, FormSection, Modal, SectionTitle, humanStatus } from '../ui/kit';
import { DateRange, Detail, DetailGrid, PageHead, Pagination, SearchBox, StatusSelect, fmtDate, money, toDateInput, useListState } from '../ui/common';
import { COST_SCOPES, DIVISIONS, PAY_MODES, toneForDocStatus } from '../ui/tone';

interface ExpenseRow {
  id: string; reference: string; date: string; description?: string | null;
  scope: string; division?: string | null; amountInr: number; status: string;
  voucherNo?: string | null;
  category: { name: string };
  batch?: { code: string } | null;
  farm?: { name: string } | null;
  vehicle?: { name: string } | null;
  stall?: { name: string } | null;
}

interface ExpenseDetail extends ExpenseRow {
  allocations: { id: string; amountInr: number; method: string; batch?: { code: string } | null }[];
}

const EXPENSE_STATUSES = ['SUBMITTED', 'APPROVED', 'POSTED', 'REJECTED'];
const SIMPLE_ALLOC_METHODS = ['BIRD_COUNT', 'EQUAL', 'FARM_COUNT'];

export function PoultryExpenses() {
  const qc = useQueryClient();
  const { hasPermission } = useAuth();
  const canManage = hasPermission('poultry.manage');
  const canFinance = hasPermission('poultry.finance');
  const { state, set, params } = useListState();
  const [scopeFilter, setScopeFilter] = useState('');
  const [creating, setCreating] = useState(false);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [rejectReason, setRejectReason] = useState('');
  const [allocMethod, setAllocMethod] = useState('BIRD_COUNT');

  const { data, isLoading } = useQuery({
    queryKey: ['py-expenses', params, scopeFilter],
    queryFn: async () => (await api.get<{ data: ExpenseRow[]; meta: { page: number; limit: number; total: number; totalPages: number } }>(
      '/poultry/expenses',
      { params: { ...params, ...(scopeFilter ? { scope: scopeFilter } : {}) } },
    )).data,
  });

  const { data: detail } = useQuery({
    queryKey: ['py-expense', selectedId],
    queryFn: async () => (await api.get<ExpenseDetail>(`/poultry/expenses/${selectedId}`)).data,
    enabled: !!selectedId,
  });

  const invalidate = () => {
    qc.invalidateQueries({ queryKey: ['py-expenses'] });
    if (selectedId) qc.invalidateQueries({ queryKey: ['py-expense', selectedId] });
    qc.invalidateQueries({ queryKey: ['py-dashboard'] });
  };

  const approve = useMutation({
    mutationFn: (id: string) => api.post(`/poultry/expenses/${id}/approve`),
    onSuccess: () => { toast.success('Expense approved'); invalidate(); },
    onError: (e) => toast.error(apiErrorMessage(e)),
  });
  const reject = useMutation({
    mutationFn: (id: string) => api.post(`/poultry/expenses/${id}/reject`, { reason: rejectReason }),
    onSuccess: () => { toast.success('Expense rejected'); setRejectReason(''); invalidate(); },
    onError: (e) => toast.error(apiErrorMessage(e)),
  });
  const allocate = useMutation({
    mutationFn: (id: string) => api.post(`/poultry/expenses/${id}/allocate`, { method: allocMethod }),
    onSuccess: () => { toast.success('Allocated to batches'); invalidate(); },
    onError: (e) => toast.error(apiErrorMessage(e)),
  });

  const columns: DataTableColumn<ExpenseRow>[] = [
    { key: 'reference', header: 'Ref', width: 100, render: (r) => <span style={{ fontWeight: 600 }}>{r.reference}</span> },
    { key: 'date', header: 'Date', width: 110, render: (r) => fmtDate(r.date) },
    { key: 'category', header: 'Category', width: 140, render: (r) => r.category.name },
    { key: 'description', header: 'Description', render: (r) => r.description ?? <span className="ds-caption">—</span> },
    { key: 'scope', header: 'Scope', width: 140, render: (r) => (
      <span>{humanStatus(r.scope)}{r.division ? <span className="ds-caption"> · {humanStatus(r.division)}</span> : null}</span>
    ) },
    { key: 'amountInr', header: 'Amount', align: 'right', width: 110, render: (r) => money(r.amountInr) },
    { key: 'status', header: 'Status', width: 110, render: (r) => <Badge tone={toneForDocStatus(r.status)}>{humanStatus(r.status)}</Badge> },
    { key: 'voucherNo', header: 'Voucher', width: 100, render: (r) => r.voucherNo ?? <span className="ds-caption">—</span> },
  ];

  return (
    <div className="ds-page">
      <PageHead
        title="Expenses"
        subtitle="Vehicle, office and operations spend — approved, posted and shared out to batches"
        actions={canManage && (
          <button className="btn-primary" onClick={() => setCreating(true)}>New expense</button>
        )}
      />

      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 14 }}>
        <SearchBox value={state.search} onChange={(v) => set({ search: v })} placeholder="Search reference, description…" />
        <StatusSelect value={state.status} onChange={(v) => set({ status: v })} options={EXPENSE_STATUSES} />
        <StatusSelect value={scopeFilter} onChange={setScopeFilter} options={COST_SCOPES} label="All scopes" />
        <DateRange from={state.from} to={state.to} onChange={(patch) => set(patch)} />
      </div>

      <Card flush>
        <DataTable
          rows={data?.data ?? []}
          columns={columns}
          rowKey={(r) => r.id}
          loading={isLoading}
          onRowClick={(r) => setSelectedId(r.id)}
          empty={<EmptyState title="No expenses" body="Record spend here — direct costs hit their batch, shared costs get allocated." actionLabel={canManage ? 'New expense' : undefined} onAction={canManage ? () => setCreating(true) : undefined} />}
        />
      </Card>
      <Pagination meta={data?.meta} onPage={(p) => set({ page: p })} />

      <Drawer
        open={!!selectedId}
        onClose={() => setSelectedId(null)}
        title={detail?.reference ?? 'Expense'}
        subtitle={detail ? `${detail.category.name} · ${fmtDate(detail.date)}` : undefined}
        width={640}
        actions={detail && <Badge tone={toneForDocStatus(detail.status)}>{humanStatus(detail.status)}</Badge>}
      >
        {detail && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
            <DetailGrid>
              <Detail label="Amount" value={<strong>{money(detail.amountInr)}</strong>} />
              <Detail label="Scope" value={humanStatus(detail.scope)} />
              {detail.division && <Detail label="Division" value={humanStatus(detail.division)} />}
              {detail.batch && <Detail label="Batch" value={detail.batch.code} />}
              {detail.farm && <Detail label="Farm" value={detail.farm.name} />}
              {detail.vehicle && <Detail label="Vehicle" value={detail.vehicle.name} />}
              {detail.stall && <Detail label="Stall" value={detail.stall.name} />}
              <Detail label="Voucher" value={detail.voucherNo ?? '—'} />
              <Detail label="Description" value={detail.description ?? '—'} />
            </DetailGrid>

            {detail.status === 'SUBMITTED' && canFinance && (
              <Card tone="renewal">
                <SectionTitle sub="This expense waits on finance">Approval</SectionTitle>
                <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
                  <button className="btn-primary btn-sm" disabled={approve.isPending} onClick={() => approve.mutate(detail.id)}>
                    {approve.isPending ? 'Saving…' : 'Approve'}
                  </button>
                  <input className="input" style={{ flex: '1 1 160px' }} placeholder="Reason for rejection" value={rejectReason} onChange={(e) => setRejectReason(e.target.value)} />
                  <button className="btn-danger btn-sm" disabled={reject.isPending || !rejectReason} onClick={() => reject.mutate(detail.id)}>
                    {reject.isPending ? 'Saving…' : 'Reject'}
                  </button>
                </div>
              </Card>
            )}

            <div>
              <SectionTitle sub="How this cost was shared to batches">Allocations</SectionTitle>
              {detail.allocations.length === 0 ? (
                <div className="ds-caption">Not allocated yet.</div>
              ) : (
                <Card flush>
                  <DataTable
                    rows={detail.allocations}
                    columns={[
                      { key: 'batch', header: 'Batch', render: (a) => a.batch?.code ?? '—' },
                      { key: 'method', header: 'Method', width: 130, render: (a) => humanStatus(a.method) },
                      { key: 'amountInr', header: 'Share', align: 'right', width: 110, render: (a) => money(a.amountInr) },
                    ] as DataTableColumn<ExpenseDetail['allocations'][number]>[]}
                    rowKey={(a) => a.id}
                    dense
                  />
                </Card>
              )}
              {detail.scope !== 'DIRECT' && canFinance && (
                <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap', marginTop: 12 }}>
                  <select className="input" style={{ maxWidth: 180 }} value={allocMethod} onChange={(e) => setAllocMethod(e.target.value)} aria-label="Allocation method">
                    {SIMPLE_ALLOC_METHODS.map((m) => <option key={m} value={m}>{humanStatus(m)}</option>)}
                  </select>
                  <button className="btn-secondary btn-sm" disabled={allocate.isPending} onClick={() => allocate.mutate(detail.id)}>
                    {allocate.isPending ? 'Saving…' : 'Allocate to batches'}
                  </button>
                </div>
              )}
            </div>
          </div>
        )}
      </Drawer>

      <NewExpenseModal open={creating} onClose={() => setCreating(false)} onDone={invalidate} />
    </div>
  );
}

function NewExpenseModal({ open, onClose, onDone }: { open: boolean; onClose: () => void; onDone: () => void }) {
  const [form, setForm] = useState({
    date: toDateInput(), categoryId: '', amount: '', description: '', scope: 'DIRECT',
    batchId: '', farmId: '', division: 'INTEGRATION', vehicleId: '', stallId: '',
    payMode: 'CASH', ledgerCode: '',
  });
  const { data: categories } = useQuery({
    queryKey: ['py-expense-categories'],
    queryFn: async () => (await api.get<{ id: string; name: string; group: string }[]>('/poultry/expense-categories')).data,
    enabled: open,
  });
  const { data: batches } = useQuery({
    queryKey: ['py-batches-lite'],
    queryFn: async () => (await api.get<{ data: { id: string; code: string; status: string; farm: { name: string } }[] }>('/poultry/batches', { params: { limit: 200 } })).data.data,
    enabled: open && form.scope === 'DIRECT',
  });
  const { data: farms } = useQuery({
    queryKey: ['py-farms-lite'],
    queryFn: async () => (await api.get<{ data: { id: string; name: string }[] }>('/poultry/farms', { params: { limit: 200 } })).data.data,
    enabled: open && form.scope === 'DIRECT',
  });
  const { data: vehicles } = useQuery({
    queryKey: ['py-vehicles-lite'],
    queryFn: async () => (await api.get<{ id: string; name: string }[]>('/poultry/vehicles')).data,
    enabled: open,
  });
  const { data: stalls } = useQuery({
    queryKey: ['py-stalls-lite'],
    queryFn: async () => (await api.get<{ id: string; name: string }[]>('/poultry/stalls')).data,
    enabled: open,
  });
  const { data: accounts } = useQuery({
    queryKey: ['py-accounts'],
    queryFn: async () => (await api.get<{ ledgerCode: string; name: string }[]>('/poultry/accounts')).data,
    enabled: open && form.payMode !== 'CREDIT',
  });
  const save = useMutation({
    mutationFn: () => api.post('/poultry/expenses', {
      date: form.date,
      categoryId: form.categoryId,
      amountInr: Number(form.amount),
      description: form.description || undefined,
      scope: form.scope,
      batchId: form.scope === 'DIRECT' && form.batchId ? form.batchId : undefined,
      farmId: form.scope === 'DIRECT' && form.farmId ? form.farmId : undefined,
      division: form.scope === 'DIVISION' ? form.division : undefined,
      vehicleId: form.vehicleId || undefined,
      stallId: form.stallId || undefined,
      payMode: form.payMode,
      ledgerCode: form.payMode !== 'CREDIT' ? form.ledgerCode || undefined : undefined,
    }),
    onSuccess: () => { toast.success('Expense recorded'); onClose(); onDone(); },
    onError: (e) => toast.error(apiErrorMessage(e)),
  });
  return (
    <Modal open={open} onClose={onClose} title="New expense" width={720}
      footer={(<><button className="btn-secondary" onClick={onClose}>Cancel</button>
        <button className="btn-primary" disabled={save.isPending || !form.categoryId || !form.amount} onClick={() => save.mutate()}>{save.isPending ? 'Saving…' : 'Record expense'}</button></>)}>
      <FormSection title="The spend">
        <Field label="Date" required><input className="input" type="date" value={form.date} onChange={(e) => setForm({ ...form, date: e.target.value })} /></Field>
        <Field label="Category" required>
          <select className="input" value={form.categoryId} onChange={(e) => setForm({ ...form, categoryId: e.target.value })}>
            <option value="">Choose…</option>
            {(categories ?? []).map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>
        </Field>
        <Field label="Amount (₹)" required>
          <input className="input" type="number" min={1} step="1" value={form.amount} onChange={(e) => setForm({ ...form, amount: e.target.value })} />
        </Field>
        <Field label="Description">
          <input className="input" value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} />
        </Field>
      </FormSection>
      <FormSection title="Where it lands">
        <Field label="Scope" required hint="Direct hits one batch; division and overhead get allocated later">
          <select className="input" value={form.scope} onChange={(e) => setForm({ ...form, scope: e.target.value, batchId: '', farmId: '' })}>
            {COST_SCOPES.map((s) => <option key={s} value={s}>{humanStatus(s)}</option>)}
          </select>
        </Field>
        {form.scope === 'DIRECT' && (
          <>
            <Field label="Batch">
              <select className="input" value={form.batchId} onChange={(e) => setForm({ ...form, batchId: e.target.value, farmId: '' })}>
                <option value="">Choose…</option>
                {(batches ?? []).map((b) => <option key={b.id} value={b.id}>{b.code} · {b.farm.name}</option>)}
              </select>
            </Field>
            <Field label="Or farm">
              <select className="input" value={form.farmId} onChange={(e) => setForm({ ...form, farmId: e.target.value, batchId: '' })}>
                <option value="">Choose…</option>
                {(farms ?? []).map((f) => <option key={f.id} value={f.id}>{f.name}</option>)}
              </select>
            </Field>
          </>
        )}
        {form.scope === 'DIVISION' && (
          <Field label="Division" required>
            <select className="input" value={form.division} onChange={(e) => setForm({ ...form, division: e.target.value })}>
              {DIVISIONS.map((d) => <option key={d} value={d}>{humanStatus(d)}</option>)}
            </select>
          </Field>
        )}
        <Field label="Vehicle">
          <select className="input" value={form.vehicleId} onChange={(e) => setForm({ ...form, vehicleId: e.target.value })}>
            <option value="">None</option>
            {(vehicles ?? []).map((v) => <option key={v.id} value={v.id}>{v.name}</option>)}
          </select>
        </Field>
        <Field label="Stall">
          <select className="input" value={form.stallId} onChange={(e) => setForm({ ...form, stallId: e.target.value })}>
            <option value="">None</option>
            {(stalls ?? []).map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
          </select>
        </Field>
      </FormSection>
      <FormSection title="Payment">
        <Field label="Mode">
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
      <p className="ds-caption" style={{ marginTop: 4 }}>
        Expenses at or above the approval threshold wait for finance approval.
      </p>
    </Modal>
  );
}
