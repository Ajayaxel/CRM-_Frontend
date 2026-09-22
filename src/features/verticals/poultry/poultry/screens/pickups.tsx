'use client';

import React, { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { Bird, IndianRupee, Scale } from 'lucide-react';
import { api, apiErrorMessage } from '@/lib/api';
import { useAuth } from '@/features/foundation/auth';
import { Card, DataTable, DataTableColumn, EmptyState, Field, FormSection, Modal, StatCard } from '../ui/kit';
import { DateRange, PageHead, Pagination, SearchBox, fmtDate, money, toDateInput, useListState } from '../ui/common';
import { paiseRate } from '../ui/tone';

interface PickupRow {
  id: string; reference: string; date: string; birds: number; weightKg: number;
  ratePaisePerKg: number; grossInr: number; deductionInr: number; netInr: number;
  batch: { code: string; farm: { name: string } };
}

interface MonthlyReport {
  integration: { birdsPicked: number; weightPickedKg: number; outputInr: number };
}

export function PoultryPickups() {
  const qc = useQueryClient();
  const { hasPermission } = useAuth();
  const canManage = hasPermission('poultry.manage');
  const { state, set, params } = useListState();
  const [recording, setRecording] = useState(false);

  const { data, isLoading } = useQuery({
    queryKey: ['py-pickups', params],
    queryFn: async () => (await api.get<{ data: PickupRow[]; meta: { page: number; limit: number; total: number; totalPages: number } }>(
      '/poultry/pickups', { params },
    )).data,
  });

  const { data: monthly } = useQuery({
    queryKey: ['py-report-monthly'],
    queryFn: async () => (await api.get<MonthlyReport>('/poultry/reports/monthly')).data,
  });

  const invalidate = () => {
    qc.invalidateQueries({ queryKey: ['py-pickups'] });
    qc.invalidateQueries({ queryKey: ['py-batches'] });
    qc.invalidateQueries({ queryKey: ['py-report-monthly'] });
    qc.invalidateQueries({ queryKey: ['py-dashboard'] });
  };

  const columns: DataTableColumn<PickupRow>[] = [
    { key: 'reference', header: 'Ref', width: 100, render: (p) => <span style={{ fontWeight: 600 }}>{p.reference}</span> },
    { key: 'date', header: 'Date', width: 110, render: (p) => fmtDate(p.date) },
    { key: 'batch', header: 'Batch', render: (p) => (
      <div style={{ minWidth: 0 }}>
        <div style={{ fontWeight: 600 }}>{p.batch.code}</div>
        <div className="ds-caption">{p.batch.farm.name}</div>
      </div>
    ) },
    { key: 'birds', header: 'Birds', align: 'right', width: 90, render: (p) => p.birds.toLocaleString('en-IN') },
    { key: 'weightKg', header: 'Weight (kg)', align: 'right', width: 110, render: (p) => p.weightKg.toLocaleString('en-IN') },
    { key: 'rate', header: 'Rate/kg', align: 'right', width: 100, render: (p) => paiseRate(p.ratePaisePerKg) },
    { key: 'grossInr', header: 'Gross', align: 'right', width: 110, render: (p) => money(p.grossInr) },
    { key: 'deductionInr', header: 'Deductions', align: 'right', width: 110, render: (p) => money(p.deductionInr) },
    { key: 'netInr', header: 'Net', align: 'right', width: 110, render: (p) => <strong>{money(p.netInr)}</strong> },
  ];

  return (
    <div className="ds-page">
      <PageHead
        title="Pickups"
        subtitle="Birds out of farms — the integration's output line"
        actions={canManage && (
          <button className="btn-primary" onClick={() => setRecording(true)}>Record pickup</button>
        )}
      />

      <div className="ds-grid ds-grid-kpi">
        <StatCard label="Birds picked (this month)" value={(monthly?.integration.birdsPicked ?? 0).toLocaleString('en-IN')} icon={Bird} />
        <StatCard label="Weight picked (this month)" value={`${Math.round(monthly?.integration.weightPickedKg ?? 0).toLocaleString('en-IN')} kg`} icon={Scale} />
        <StatCard label="Output (this month)" value={money(monthly?.integration.outputInr)} icon={IndianRupee} tone="active" />
      </div>

      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 14 }}>
        <SearchBox value={state.search} onChange={(v) => set({ search: v })} placeholder="Search reference, batch…" />
        <DateRange from={state.from} to={state.to} onChange={(patch) => set(patch)} />
      </div>

      <Card flush>
        <DataTable
          rows={data?.data ?? []}
          columns={columns}
          rowKey={(p) => p.id}
          loading={isLoading}
          empty={<EmptyState title="No pickups yet" body="Recorded pickups show here with their rates and net value." actionLabel={canManage ? 'Record pickup' : undefined} onAction={canManage ? () => setRecording(true) : undefined} />}
        />
      </Card>
      <Pagination meta={data?.meta} onPage={(p) => set({ page: p })} />

      <RecordPickupModal open={recording} onClose={() => setRecording(false)} onDone={invalidate} />
    </div>
  );
}

function RecordPickupModal({ open, onClose, onDone }: { open: boolean; onClose: () => void; onDone: () => void }) {
  const [form, setForm] = useState({ batchId: '', date: toDateInput(), birds: '', weightKg: '', grossKg: '', tareKg: '', boxCount: '', rate: '', deduction: '', deductionNote: '', partyId: '', stallId: '', completes: false });
  const { data: currentRate } = useQuery({
    queryKey: ['py-rate-current'],
    queryFn: async () => (await api.get<{ id: string; ratePaisePerKg: number; effectiveAt: string } | null>('/poultry/rates/current')).data,
    enabled: open,
  });
  React.useEffect(() => {
    if (!open || !currentRate) return;
    setForm((f) => (f.rate === '' ? { ...f, rate: String(currentRate.ratePaisePerKg / 100) } : f));
  }, [open, currentRate]);
  const { data: batches } = useQuery({
    queryKey: ['py-batches-lite'],
    queryFn: async () => (await api.get<{ data: { id: string; code: string; status: string; farm: { name: string } }[] }>('/poultry/batches', { params: { limit: 200 } })).data.data,
    enabled: open,
  });
  const { data: parties } = useQuery({
    queryKey: ['py-parties-lite'],
    queryFn: async () => (await api.get<{ data: { id: string; name: string }[] }>('/poultry/parties', { params: { limit: 200 } })).data.data,
    enabled: open,
  });
  const { data: stalls } = useQuery({
    queryKey: ['py-stalls-lite'],
    queryFn: async () => (await api.get<{ id: string; name: string }[]>('/poultry/stalls')).data,
    enabled: open,
  });
  const pickable = (batches ?? []).filter((b) => b.status === 'ACTIVE' || b.status === 'PICKUP_DUE');
  const save = useMutation({
    mutationFn: () => api.post('/poultry/pickups', {
      batchId: form.batchId, date: form.date, birds: Number(form.birds), weightKg: Number(form.weightKg),
      grossKg: form.grossKg ? Number(form.grossKg) : undefined,
      tareKg: form.tareKg ? Number(form.tareKg) : undefined,
      boxCount: form.boxCount ? Number(form.boxCount) : undefined,
      ratePaisePerKg: Math.round(Number(form.rate || 0) * 100),
      deductionInr: form.deduction ? Number(form.deduction) : undefined,
      deductionNote: form.deductionNote || undefined,
      partyId: form.partyId || undefined, stallId: form.stallId || undefined,
      completesBatch: form.completes || undefined,
    }),
    onSuccess: () => { toast.success('Pickup recorded'); onClose(); onDone(); },
    onError: (e) => toast.error(apiErrorMessage(e)),
  });
  return (
    <Modal open={open} onClose={onClose} title="Record pickup" width={640}
      footer={(<><button className="btn-secondary" onClick={onClose}>Cancel</button>
        <button className="btn-primary" disabled={save.isPending || !form.batchId || !form.birds || !form.weightKg} onClick={() => save.mutate()}>{save.isPending ? 'Saving…' : 'Record pickup'}</button></>)}>
      <FormSection title="The catch">
        <Field label="Batch" required>
          <select className="input" value={form.batchId} onChange={(e) => setForm({ ...form, batchId: e.target.value })}>
            <option value="">Choose…</option>
            {pickable.map((b) => <option key={b.id} value={b.id}>{b.code} · {b.farm.name}</option>)}
          </select>
        </Field>
        <Field label="Date" required><input className="input" type="date" value={form.date} onChange={(e) => setForm({ ...form, date: e.target.value })} /></Field>
        <Field label="Birds" required><input className="input" type="number" min={1} value={form.birds} onChange={(e) => setForm({ ...form, birds: e.target.value })} /></Field>
        <Field label="Weight (kg)" required hint="Net must equal gross − tare when both are given"><input className="input" type="number" min={0} step="0.1" value={form.weightKg} onChange={(e) => setForm({ ...form, weightKg: e.target.value })} /></Field>
        <Field label="Gross kg"><input className="input" type="number" min={0} step="0.1" value={form.grossKg} onChange={(e) => setForm({ ...form, grossKg: e.target.value })} /></Field>
        <Field label="Tare kg (boxes)"><input className="input" type="number" min={0} step="0.1" value={form.tareKg} onChange={(e) => setForm({ ...form, tareKg: e.target.value })} /></Field>
        <Field label="Box count"><input className="input" type="number" min={0} value={form.boxCount} onChange={(e) => setForm({ ...form, boxCount: e.target.value })} /></Field>
        <Field label="Rate per kg (₹)" required><input className="input" type="number" min={0} step="0.01" value={form.rate} onChange={(e) => setForm({ ...form, rate: e.target.value })} /></Field>
        <Field label="Deductions (₹)"><input className="input" type="number" min={0} value={form.deduction} onChange={(e) => setForm({ ...form, deduction: e.target.value })} /></Field>
        <Field label="Deduction note"><input className="input" value={form.deductionNote} onChange={(e) => setForm({ ...form, deductionNote: e.target.value })} /></Field>
      </FormSection>
      <FormSection title="Where the birds go">
        <Field label="To party leader" hint="Bill it from Party supply afterwards">
          <select className="input" value={form.partyId} onChange={(e) => setForm({ ...form, partyId: e.target.value, stallId: '' })}>
            <option value="">Not a party sale</option>
            {(parties ?? []).map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
          </select>
        </Field>
        <Field label="To company stall">
          <select className="input" value={form.stallId} onChange={(e) => setForm({ ...form, stallId: e.target.value, partyId: '' })}>
            <option value="">Not to a stall</option>
            {(stalls ?? []).map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
          </select>
        </Field>
        <Field label="Cycle" span={2}>
          <label style={{ display: 'flex', gap: 8, alignItems: 'center', fontSize: 13 }}>
            <input type="checkbox" checked={form.completes} onChange={(e) => setForm({ ...form, completes: e.target.checked })} />
            This pickup empties the farm — complete the batch and start the rest period
          </label>
        </Field>
      </FormSection>
    </Modal>
  );
}
