'use client';

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { api, apiErrorMessage } from '@/lib/api';
import { useAuth } from '@/features/foundation/auth';
import { Badge, Card, DataTable, DataTableColumn, EmptyState, Field, FormSection, Modal, humanStatus } from '../ui/kit';
import { PageHead, Pagination, SearchBox, StatusSelect, toDateInput, useListState } from '../ui/common';
import { BATCH_STATUSES, toneForBatchStatus } from '../ui/tone';

interface BatchRow {
  id: string; code: string; status: string; placementDate: string; chickQty: number;
  expectedPickupDate: string; ageDays: number; productionDays: number;
  farm: { id: string; name: string; code: string };
  shed?: { id: string; code: string; name: string } | null;
}

interface ShedOption {
  id: string; code: string; name: string; capacityBirds: number; isActive: boolean; occupied: boolean;
  currentBatch: { code: string } | null;
}

const EMPTY_PLACEMENT = {
  farmId: '', shedId: '', date: toDateInput(), quantity: '', purchaseId: '', programId: '',
  costPaisePerChick: '', notes: '', override: false, overrideReason: '',
};

export function PoultryBatches() {
  const router = useRouter();
  const qc = useQueryClient();
  const { hasPermission } = useAuth();
  const canManage = hasPermission('poultry.manage');
  const { state, set, params } = useListState({});
  const [placing, setPlacing] = useState(false);
  const [form, setForm] = useState(EMPTY_PLACEMENT);

  const { data, isLoading } = useQuery({
    queryKey: ['py-batches', params],
    queryFn: async () => (await api.get<{ data: BatchRow[]; meta: { page: number; limit: number; total: number; totalPages: number } }>(
      '/poultry/batches', { params },
    )).data,
  });
  const { data: farms } = useQuery({
    queryKey: ['py-farms-for-placement'],
    queryFn: async () => (await api.get<{ data: { id: string; name: string; code: string; status: string; capacityBirds: number }[] }>(
      '/poultry/farms', { params: { limit: 200 } },
    )).data.data,
    enabled: placing,
  });
  // Sheds on the chosen farm. Once a farm has sheds the server requires one,
  // so the form asks for it rather than letting the request fail.
  const { data: sheds } = useQuery({
    queryKey: ['py-farm-sheds', form.farmId],
    queryFn: async () => (await api.get<ShedOption[]>(`/poultry/farms/${form.farmId}/sheds`)).data,
    enabled: placing && !!form.farmId,
  });
  const activeSheds = (sheds ?? []).filter((x) => x.isActive);
  const { data: purchases } = useQuery({
    queryKey: ['py-open-purchases'],
    queryFn: async () => (await api.get<{ data: { id: string; reference: string; quantity: number; ratePaisePerChick: number; supplier: { name: string } }[] }>(
      '/poultry/chick-purchases', { params: { limit: 50 } },
    )).data.data,
    enabled: placing,
  });
  const { data: programs } = useQuery({
    queryKey: ['py-feed-programs'],
    queryFn: async () => (await api.get<{ id: string; name: string; isDefault: boolean }[]>('/poultry/feed-programs')).data,
    enabled: placing,
  });

  const place = useMutation({
    mutationFn: () => api.post('/poultry/placements', {
      farmId: form.farmId,
      shedId: form.shedId || undefined,
      date: form.date,
      quantity: Number(form.quantity),
      purchaseId: form.purchaseId || undefined,
      programId: form.programId || undefined,
      costPaisePerChick: form.costPaisePerChick ? Math.round(Number(form.costPaisePerChick) * 100) : undefined,
      notes: form.notes || undefined,
      override: form.override || undefined,
      overrideReason: form.overrideReason || undefined,
    }),
    onSuccess: () => {
      toast.success('Chicks placed — batch started');
      setPlacing(false); setForm(EMPTY_PLACEMENT);
      qc.invalidateQueries({ queryKey: ['py-batches'] });
      qc.invalidateQueries({ queryKey: ['py-farms'] });
      qc.invalidateQueries({ queryKey: ['py-dashboard'] });
      qc.invalidateQueries({ queryKey: ['py-calendar'] });
    },
    onError: (e) => toast.error(apiErrorMessage(e)),
  });

  const columns: DataTableColumn<BatchRow>[] = [
    { key: 'code', header: 'Batch', width: 110, render: (b) => <span style={{ fontWeight: 600 }}>{b.code}</span> },
    { key: 'farm', header: 'Farm · shed', render: (b) => (
      <div><div style={{ fontWeight: 600 }}>{b.farm.name}</div><div className="ds-caption">{b.farm.code}{b.shed ? ` · ${b.shed.name}` : ''}</div></div>
    ) },
    { key: 'status', header: 'Status', width: 130, render: (b) => <Badge tone={toneForBatchStatus(b.status)}>{humanStatus(b.status)}</Badge> },
    { key: 'chickQty', header: 'Birds', align: 'right', width: 100, render: (b) => b.chickQty.toLocaleString('en-IN') },
    { key: 'ageDays', header: 'Age', align: 'right', width: 90, render: (b) => (
      <span>{b.ageDays}d <span className="ds-caption">/ {b.productionDays}</span></span>
    ) },
    { key: 'placementDate', header: 'Placed', width: 120, render: (b) => new Date(b.placementDate).toLocaleDateString(undefined, { day: '2-digit', month: 'short' }) },
    { key: 'expectedPickupDate', header: 'Pickup due', width: 120, render: (b) => new Date(b.expectedPickupDate).toLocaleDateString(undefined, { day: '2-digit', month: 'short' }) },
  ];

  return (
    <div className="ds-page">
      <PageHead
        title="Batches"
        subtitle="Every production cycle — age runs from the placement date, never typed in"
        actions={canManage && <button className="btn-primary" onClick={() => { setForm(EMPTY_PLACEMENT); setPlacing(true); }}>Place chicks</button>}
      />

      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 14 }}>
        <SearchBox value={state.search} onChange={(v) => set({ search: v })} placeholder="Search batch or farm…" />
        <StatusSelect value={state.status} onChange={(v) => set({ status: v })} options={BATCH_STATUSES as unknown as string[]} />
      </div>

      <Card flush>
        <DataTable
          rows={data?.data ?? []}
          columns={columns}
          rowKey={(b) => b.id}
          loading={isLoading}
          onRowClick={(b) => router.push(`/poultry/batches/${b.id}`)}
          empty={<EmptyState title="No batches yet" body="Placing chicks into a farm starts the first batch and its 40-day clock." actionLabel={canManage ? 'Place chicks' : undefined} onAction={canManage ? () => setPlacing(true) : undefined} />}
        />
      </Card>
      <Pagination meta={data?.meta} onPage={(p) => set({ page: p })} />

      <Modal
        open={placing}
        onClose={() => setPlacing(false)}
        title="Place chicks"
        subtitle="Starts (or tops up) a batch. The batch snapshots today's rules — production days, rest days, supervision rate and the feed plan."
        width={720}
        footer={(
          <>
            <button className="btn-secondary" onClick={() => setPlacing(false)}>Cancel</button>
            <button
              className="btn-primary"
              disabled={place.isPending || !form.farmId || !form.date || !form.quantity || (activeSheds.length > 0 && !form.shedId)}
              onClick={() => place.mutate()}
            >
              {place.isPending ? 'Placing…' : 'Place chicks'}
            </button>
          </>
        )}
      >
        <FormSection title="Where and how many">
          <Field label="Farm" required hint="Occupied or resting farms need an authorized override">
            <select className="input" value={form.farmId} onChange={(e) => setForm({ ...form, farmId: e.target.value, shedId: '' })}>
              <option value="">Choose…</option>
              {(farms ?? []).map((farm) => (
                <option key={farm.id} value={farm.id}>
                  {farm.name} · {humanStatus(farm.status)} · cap {farm.capacityBirds.toLocaleString('en-IN')}
                </option>
              ))}
            </select>
          </Field>
          {activeSheds.length > 0 && (
            <Field label="Shed" required hint="This farm has sheds — a flock goes into one house, and that house's capacity applies">
              <select className="input" value={form.shedId} onChange={(e) => setForm({ ...form, shedId: e.target.value })}>
                <option value="">Choose…</option>
                {activeSheds.map((x) => (
                  <option key={x.id} value={x.id} disabled={x.occupied && !form.override}>
                    {x.name} · cap {x.capacityBirds.toLocaleString('en-IN')}{x.occupied ? ` · holds ${x.currentBatch?.code}` : ' · empty'}
                  </option>
                ))}
              </select>
            </Field>
          )}
          <Field label="Placement date" required>
            <input className="input" type="date" value={form.date} onChange={(e) => setForm({ ...form, date: e.target.value })} />
          </Field>
          <Field label="Quantity (chicks)" required>
            <input className="input" type="number" min={1} value={form.quantity} onChange={(e) => setForm({ ...form, quantity: e.target.value })} />
          </Field>
          <Field label="Rate per chick (₹)" hint="Defaults to the linked purchase's rate">
            <input className="input" type="number" min={0} step="0.01" value={form.costPaisePerChick} onChange={(e) => setForm({ ...form, costPaisePerChick: e.target.value })} />
          </Field>
        </FormSection>
        <FormSection title="Source & plan">
          <Field label="From chick purchase" hint="Links the placement to the purchase for reconciliation">
            <select className="input" value={form.purchaseId} onChange={(e) => setForm({ ...form, purchaseId: e.target.value })}>
              <option value="">Not linked</option>
              {(purchases ?? []).map((p) => (
                <option key={p.id} value={p.id}>{p.reference} · {p.supplier.name} · {p.quantity.toLocaleString('en-IN')} chicks</option>
              ))}
            </select>
          </Field>
          <Field label="Feed program" hint="Defaults to the tenant's default program">
            <select className="input" value={form.programId} onChange={(e) => setForm({ ...form, programId: e.target.value })}>
              <option value="">Default program</option>
              {(programs ?? []).map((p) => <option key={p.id} value={p.id}>{p.name}{p.isDefault ? ' (default)' : ''}</option>)}
            </select>
          </Field>
          <Field label="Notes" span={2}>
            <textarea className="input" rows={2} value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} />
          </Field>
          <Field label="Override" span={2}>
            <div style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
              <label style={{ display: 'flex', gap: 8, alignItems: 'center', fontSize: 13 }}>
                <input type="checkbox" checked={form.override} onChange={(e) => setForm({ ...form, override: e.target.checked })} />
                Force placement into an occupied / ineligible farm (audited)
              </label>
              {form.override && (
                <input className="input" style={{ flex: 1, minWidth: 200 }} placeholder="Override reason (required)" value={form.overrideReason} onChange={(e) => setForm({ ...form, overrideReason: e.target.value })} />
              )}
            </div>
          </Field>
        </FormSection>
      </Modal>
    </div>
  );
}
