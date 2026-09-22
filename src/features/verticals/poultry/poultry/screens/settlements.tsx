'use client';

import React, { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { api, apiErrorMessage } from '@/lib/api';
import { useAuth } from '@/features/foundation/auth';
import {
  Badge, Card, DataTable, DataTableColumn, Drawer, EmptyState, Field, FormSection,
  Modal, SectionTitle, humanStatus,
} from '../ui/kit';
import { Detail, DetailGrid, PageHead, Pagination, SearchBox, fmtDate, money, useListState } from '../ui/common';
import { paiseRate } from '../ui/tone';
import { toneForSettlementStatus } from './farmers';

interface SettlementRow {
  id: string; reference: string; status: string; date: string;
  outputWeightKg: number; growingPaisePerKg: number; grossInr: number;
  fcr: number | null; incentivePaisePerKg: number | null; incentiveInr: number; incentiveManual: boolean;
  feedCostInr: number; medicineCostInr: number; otherCostInr: number; netInr: number;
  voucherNo?: string | null; paidLedgerCode?: string | null; notes?: string | null;
  farmer: { name: string; code: string };
  batch: { code: string };
}

const SETTLEMENT_STATUSES = ['DRAFT', 'APPROVED', 'PAID'] as const;

export function PoultrySettlements() {
  const qc = useQueryClient();
  const { hasPermission } = useAuth();
  const canFinance = hasPermission('poultry.finance');
  const { state, set, params } = useListState();
  const [activeId, setActiveId] = useState<string | null>(null);
  const [generating, setGenerating] = useState(false);

  const { data, isLoading } = useQuery({
    queryKey: ['py-settlements', params],
    queryFn: async () => (await api.get<{ data: SettlementRow[]; meta: { page: number; limit: number; total: number; totalPages: number } }>(
      '/poultry/settlements', { params },
    )).data,
    enabled: canFinance,
  });

  const invalidate = () => {
    qc.invalidateQueries({ queryKey: ['py-settlements'] });
    qc.invalidateQueries({ queryKey: ['py-settlement'] });
    qc.invalidateQueries({ queryKey: ['py-farmers'] });
    qc.invalidateQueries({ queryKey: ['py-farmer-statement'] });
    qc.invalidateQueries({ queryKey: ['py-dashboard'] });
  };

  if (!canFinance) {
    return (
      <div className="ds-page">
        <PageHead title="Grower settlements" />
        <Card>
          <EmptyState title="Finance access needed" body="Settlements move real money — the poultry.finance permission is required to view them." compact />
        </Card>
      </div>
    );
  }

  const columns: DataTableColumn<SettlementRow>[] = [
    { key: 'reference', header: 'Ref', width: 110, render: (s) => <span style={{ fontWeight: 600 }}>{s.reference}</span> },
    { key: 'farmer', header: 'Farmer', render: (s) => (
      <div style={{ minWidth: 0 }}>
        <div style={{ fontWeight: 600 }}>{s.farmer.name}</div>
        <div className="ds-caption">{s.farmer.code}</div>
      </div>
    ) },
    { key: 'batch', header: 'Batch', width: 100, render: (s) => s.batch.code },
    { key: 'date', header: 'Date', width: 100, render: (s) => fmtDate(s.date) },
    { key: 'outputWeightKg', header: 'Output (kg)', align: 'right', width: 100, render: (s) => s.outputWeightKg.toLocaleString('en-IN') },
    { key: 'fcr', header: 'FCR', align: 'right', width: 70, render: (s) => (s.fcr != null ? s.fcr.toFixed(2) : '—') },
    { key: 'grossInr', header: 'Gross', align: 'right', width: 100, render: (s) => money(s.grossInr) },
    { key: 'incentiveInr', header: 'Incentive', align: 'right', width: 100, render: (s) => money(s.incentiveInr) },
    { key: 'netInr', header: 'Net', align: 'right', width: 110, render: (s) => (
      <strong style={{ color: s.netInr >= 0 ? 'var(--tone-active)' : 'var(--tone-expired)' }}>{money(s.netInr)}</strong>
    ) },
    { key: 'status', header: 'Status', width: 110, render: (s) => <Badge tone={toneForSettlementStatus(s.status)}>{humanStatus(s.status)}</Badge> },
  ];

  return (
    <div className="ds-page">
      <PageHead
        title="Grower settlements"
        subtitle="What each batch earned its grower — drafted, approved by a second person, then paid"
        actions={<button className="btn-primary" onClick={() => setGenerating(true)}>Generate settlement</button>}
      />

      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 14 }}>
        <SearchBox value={state.search} onChange={(v) => set({ search: v })} placeholder="Search reference, farmer, batch…" />
        <select className="input" style={{ maxWidth: 170 }} value={state.status} aria-label="Status" onChange={(e) => set({ status: e.target.value })}>
          <option value="">All statuses</option>
          {SETTLEMENT_STATUSES.map((s) => <option key={s} value={s}>{humanStatus(s)}</option>)}
        </select>
      </div>

      <Card flush>
        <DataTable
          rows={data?.data ?? []}
          columns={columns}
          rowKey={(s) => s.id}
          loading={isLoading}
          onRowClick={(s) => setActiveId(s.id)}
          empty={<EmptyState title="No settlements yet" body="Generate a settlement from a completed batch to see the grower's payout." actionLabel="Generate settlement" onAction={() => setGenerating(true)} />}
        />
      </Card>
      <Pagination meta={data?.meta} onPage={(p) => set({ page: p })} />

      <SettlementDrawer id={activeId} onClose={() => setActiveId(null)} onDone={invalidate} />
      <GenerateModal open={generating} onClose={() => setGenerating(false)} onDone={invalidate} />
    </div>
  );
}

function SettlementDrawer({ id, onClose, onDone }: { id: string | null; onClose: () => void; onDone: () => void }) {
  const [paying, setPaying] = useState(false);

  const { data: s } = useQuery({
    queryKey: ['py-settlement', id],
    queryFn: async () => (await api.get<SettlementRow>(`/poultry/settlements/${id}`)).data,
    enabled: !!id,
  });

  const approve = useMutation({
    mutationFn: () => api.post(`/poultry/settlements/${id}/approve`, {}),
    onSuccess: () => { toast.success('Settlement approved'); onDone(); },
    onError: (e) => toast.error(apiErrorMessage(e)),
  });

  const outsideSlabs = !!s && s.fcr != null && s.incentivePaisePerKg == null;

  return (
    <Drawer
      open={!!id}
      onClose={onClose}
      title={s?.reference ?? ''}
      subtitle={s ? `${s.farmer.name} · ${s.batch.code} · ${fmtDate(s.date)}` : undefined}
      width={640}
    >
      {s && (
        <div>
          <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap', marginBottom: 16 }}>
            <Badge tone={toneForSettlementStatus(s.status)}>{humanStatus(s.status)}</Badge>
            {s.incentiveManual && <Badge tone="info">Manual incentive</Badge>}
            {outsideSlabs && <Badge tone="claim">Outside every slab — manual decision needed</Badge>}
          </div>

          <SectionTitle sub="Weight × growing rate, plus the FCR incentive">Earnings</SectionTitle>
          <DetailGrid>
            <Detail label="Output weight" value={`${s.outputWeightKg.toLocaleString('en-IN')} kg`} />
            <Detail label="Growing rate" value={`${paiseRate(s.growingPaisePerKg)}/kg`} />
            <Detail label="Gross" value={money(s.grossInr)} />
            <Detail label="FCR" value={s.fcr != null ? s.fcr.toFixed(2) : '—'} />
            <Detail
              label="Incentive slab rate"
              value={s.incentivePaisePerKg != null
                ? `${paiseRate(s.incentivePaisePerKg)}/kg`
                : s.fcr != null ? <Badge tone="claim">Outside every slab</Badge> : '—'}
            />
            <Detail label="Incentive" value={<>{money(s.incentiveInr)}{s.incentiveManual && <> <Badge tone="info">manual</Badge></>}</>} />
          </DetailGrid>

          <div style={{ marginTop: 16 }}>
            <SectionTitle sub="What the company holds back from the payout">Recoveries</SectionTitle>
            <DetailGrid>
              <Detail label="Feed" value={money(s.feedCostInr)} />
              <Detail label="Medicine" value={money(s.medicineCostInr)} />
              <Detail label="Other" value={money(s.otherCostInr)} />
              <Detail label="Net payable" value={<strong style={{ color: s.netInr >= 0 ? 'var(--tone-active)' : 'var(--tone-expired)' }}>{money(s.netInr)}</strong>} />
            </DetailGrid>
          </div>

          {s.notes && (
            <div style={{ marginTop: 16 }}>
              <Detail label="Notes" value={s.notes} />
            </div>
          )}

          <div style={{ marginTop: 20, display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
            {s.status === 'DRAFT' && (
              <>
                <span className="ds-caption">Drafts regenerate freely; approval locks the figures. A second person must approve.</span>
                <button className="btn-primary" style={{ marginLeft: 'auto' }} disabled={approve.isPending} onClick={() => approve.mutate()}>
                  {approve.isPending ? 'Approving…' : 'Approve'}
                </button>
              </>
            )}
            {s.status === 'APPROVED' && (
              <button className="btn-primary" style={{ marginLeft: 'auto' }} onClick={() => setPaying(true)}>Pay</button>
            )}
            {s.status === 'PAID' && (
              <DetailGrid>
                <Detail label="Voucher" value={s.voucherNo ?? '—'} />
                <Detail label="Paid from" value={s.paidLedgerCode ?? '—'} />
              </DetailGrid>
            )}
          </div>

          <PayModal open={paying} settlement={s} onClose={() => setPaying(false)} onDone={onDone} />
        </div>
      )}
    </Drawer>
  );
}

function PayModal({ open, settlement, onClose, onDone }: {
  open: boolean; settlement: SettlementRow; onClose: () => void; onDone: () => void;
}) {
  const [ledgerCode, setLedgerCode] = useState('');
  const { data: accounts } = useQuery({
    queryKey: ['py-accounts'],
    queryFn: async () => (await api.get<{ ledgerCode: string; name: string; kind: string }[]>('/poultry/accounts')).data,
    enabled: open,
  });
  const pay = useMutation({
    mutationFn: () => api.post(`/poultry/settlements/${settlement.id}/pay`, { ledgerCode }),
    onSuccess: () => { toast.success('Settlement paid'); onClose(); onDone(); },
    onError: (e) => toast.error(apiErrorMessage(e)),
  });
  return (
    <Modal
      open={open}
      onClose={onClose}
      title={`Pay ${settlement.reference}`}
      subtitle={`${money(settlement.netInr)} to ${settlement.farmer.name}`}
      width={480}
      footer={(
        <>
          <button className="btn-secondary" onClick={onClose}>Cancel</button>
          <button className="btn-primary" disabled={pay.isPending || !ledgerCode} onClick={() => pay.mutate()}>
            {pay.isPending ? 'Paying…' : 'Pay settlement'}
          </button>
        </>
      )}
    >
      <label className="label">Pay from account
        <select className="input" value={ledgerCode} onChange={(e) => setLedgerCode(e.target.value)}>
          <option value="">Choose…</option>
          {(accounts ?? []).map((a) => <option key={a.ledgerCode} value={a.ledgerCode}>{a.name}</option>)}
        </select>
      </label>
    </Modal>
  );
}

const EMPTY_GENERATE_FORM = { batchId: '', rate: '', recoverFeed: true, recoverMedicine: true, otherCost: '', manualIncentive: '', notes: '' };

function GenerateModal({ open, onClose, onDone }: { open: boolean; onClose: () => void; onDone: () => void }) {
  const [form, setForm] = useState(EMPTY_GENERATE_FORM);
  React.useEffect(() => { if (open) setForm(EMPTY_GENERATE_FORM); }, [open]);

  const { data: batches } = useQuery({
    queryKey: ['py-batches-completed'],
    queryFn: async () => (await api.get<{ data: { id: string; code: string; farm: { name: string } }[] }>(
      '/poultry/batches', { params: { status: 'COMPLETED', limit: 100 } },
    )).data.data,
    enabled: open,
  });

  const save = useMutation({
    mutationFn: () => api.post(`/poultry/batches/${form.batchId}/settlement`, {
      growingPaisePerKg: form.rate ? Math.round(Number(form.rate) * 100) : undefined,
      recoverFeed: form.recoverFeed,
      recoverMedicine: form.recoverMedicine,
      otherCostInr: form.otherCost ? Number(form.otherCost) : undefined,
      manualIncentivePaisePerKg: form.manualIncentive ? Math.round(Number(form.manualIncentive) * 100) : undefined,
      notes: form.notes || undefined,
    }),
    onSuccess: () => { toast.success('Draft settlement generated'); onClose(); onDone(); },
    onError: (e) => toast.error(apiErrorMessage(e)),
  });

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Generate settlement"
      subtitle="Drafts a settlement from a completed batch — regenerable until approved."
      width={640}
      footer={(
        <>
          <button className="btn-secondary" onClick={onClose}>Cancel</button>
          <button className="btn-primary" disabled={save.isPending || !form.batchId} onClick={() => save.mutate()}>
            {save.isPending ? 'Generating…' : 'Generate draft'}
          </button>
        </>
      )}
    >
      <FormSection title="The batch">
        <Field label="Completed batch" required>
          <select className="input" value={form.batchId} onChange={(e) => setForm({ ...form, batchId: e.target.value })}>
            <option value="">Choose…</option>
            {(batches ?? []).map((b) => <option key={b.id} value={b.id}>{`${b.code} · ${b.farm.name}`}</option>)}
          </select>
        </Field>
        <Field label="Growing rate (₹/kg)" hint="Blank uses the farmer's default rate">
          <input className="input" type="number" min={0} step="0.01" value={form.rate} onChange={(e) => setForm({ ...form, rate: e.target.value })} />
        </Field>
      </FormSection>
      <FormSection title="Recoveries & incentive">
        <Field label="Recoveries" span={2}>
          <div style={{ display: 'flex', gap: 18, flexWrap: 'wrap' }}>
            <label style={{ display: 'flex', gap: 8, alignItems: 'center', fontSize: 13 }}>
              <input type="checkbox" checked={form.recoverFeed} onChange={(e) => setForm({ ...form, recoverFeed: e.target.checked })} />
              Recover feed cost
            </label>
            <label style={{ display: 'flex', gap: 8, alignItems: 'center', fontSize: 13 }}>
              <input type="checkbox" checked={form.recoverMedicine} onChange={(e) => setForm({ ...form, recoverMedicine: e.target.checked })} />
              Recover medicine cost
            </label>
          </div>
        </Field>
        <Field label="Other cost (₹)">
          <input className="input" type="number" min={0} value={form.otherCost} onChange={(e) => setForm({ ...form, otherCost: e.target.value })} />
        </Field>
        <Field label="Manual incentive (₹/kg)" hint="Only read when the FCR is outside every slab">
          <input className="input" type="number" min={0} step="0.01" value={form.manualIncentive} onChange={(e) => setForm({ ...form, manualIncentive: e.target.value })} />
        </Field>
        <Field label="Notes" span={2}>
          <input className="input" value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} />
        </Field>
      </FormSection>
    </Modal>
  );
}
