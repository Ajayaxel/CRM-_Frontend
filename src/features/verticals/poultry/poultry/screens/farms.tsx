'use client';

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { api, apiErrorMessage } from '@/lib/api';
import { useAuth } from '@/features/foundation/auth';
import { Badge, Card, DataTable, DataTableColumn, EmptyState, Field, FormSection, Modal, humanStatus } from '../ui/kit';
import { PageHead, Pagination, SearchBox, StatusSelect, useListState } from '../ui/common';
import { FARM_STATUSES, toneForFarmStatus } from '../ui/tone';

interface FarmRow {
  id: string; code: string; name: string; status: string; capacityBirds: number;
  location?: string | null; ownerName?: string | null; ownerPhone?: string | null;
  regionId: string; supervisorId?: string | null; notes?: string | null; isActive: boolean;
  region: { name: string; state?: string | null };
  supervisor?: { id: string; name: string } | null;
  currentBatch?: { id: string; code: string; chickQty: number; ageDays: number; expectedPickupDate: string } | null;
}

const EMPTY_FORM = {
  name: '', regionId: '', location: '', ownerName: '', ownerPhone: '',
  capacityBirds: '', supervisorId: '', notes: '',
};

export function PoultryFarms() {
  const router = useRouter();
  const qc = useQueryClient();
  const { hasPermission } = useAuth();
  const canManage = hasPermission('poultry.manage');
  const { state, set, params } = useListState({ sort: 'name', dir: 'asc' });
  const [regionFilter, setRegionFilter] = useState('');
  const [editing, setEditing] = useState<FarmRow | null>(null);
  const [creating, setCreating] = useState(false);
  const [form, setForm] = useState(EMPTY_FORM);

  const { data, isLoading } = useQuery({
    queryKey: ['py-farms', params, regionFilter],
    queryFn: async () => (await api.get<{ data: FarmRow[]; meta: { page: number; limit: number; total: number; totalPages: number } }>(
      '/poultry/farms', { params: { ...params, ...(regionFilter ? { regionId: regionFilter } : {}) } },
    )).data,
  });
  const { data: regions } = useQuery({
    queryKey: ['py-regions'],
    queryFn: async () => (await api.get<{ id: string; name: string }[]>('/poultry/regions')).data,
  });
  const { data: staff } = useQuery({
    queryKey: ['py-staff-supervisors'],
    queryFn: async () => (await api.get<{ data: { id: string; name: string }[] }>('/poultry/staff', { params: { kind: 'SUPERVISOR', limit: 200 } })).data.data,
  });

  const invalidate = () => {
    qc.invalidateQueries({ queryKey: ['py-farms'] });
    qc.invalidateQueries({ queryKey: ['py-dashboard'] });
    qc.invalidateQueries({ queryKey: ['py-calendar'] });
  };

  const save = useMutation({
    mutationFn: async () => {
      const body = {
        name: form.name,
        regionId: form.regionId,
        location: form.location || undefined,
        ownerName: form.ownerName || undefined,
        ownerPhone: form.ownerPhone || undefined,
        capacityBirds: form.capacityBirds ? Number(form.capacityBirds) : 0,
        supervisorId: form.supervisorId || undefined,
        notes: form.notes || undefined,
      };
      if (editing) return api.patch(`/poultry/farms/${editing.id}`, body);
      return api.post('/poultry/farms', body);
    },
    onSuccess: () => {
      toast.success(editing ? 'Farm updated' : 'Farm added');
      setCreating(false); setEditing(null); setForm(EMPTY_FORM);
      invalidate();
    },
    onError: (e) => toast.error(apiErrorMessage(e)),
  });

  const openEdit = (f: FarmRow) => {
    setEditing(f);
    setForm({
      name: f.name, regionId: f.regionId, location: f.location ?? '', ownerName: f.ownerName ?? '',
      ownerPhone: f.ownerPhone ?? '', capacityBirds: String(f.capacityBirds || ''), supervisorId: f.supervisorId ?? '', notes: f.notes ?? '',
    });
  };

  const columns: DataTableColumn<FarmRow>[] = [
    { key: 'code', header: 'Code', width: 90, render: (f) => <span style={{ fontWeight: 600 }}>{f.code}</span> },
    { key: 'name', header: 'Farm', render: (f) => (
      <div style={{ minWidth: 0 }}>
        <div style={{ fontWeight: 600 }}>{f.name}</div>
        <div className="ds-caption">{f.region.name}{f.location ? ` · ${f.location}` : ''}</div>
      </div>
    ) },
    { key: 'status', header: 'Status', width: 130, render: (f) => <Badge tone={toneForFarmStatus(f.status)}>{humanStatus(f.status)}</Badge> },
    { key: 'capacityBirds', header: 'Capacity', align: 'right', width: 110, render: (f) => f.capacityBirds.toLocaleString('en-IN') },
    { key: 'batch', header: 'Current batch', render: (f) => f.currentBatch
      ? <span>{f.currentBatch.code} · {f.currentBatch.chickQty.toLocaleString('en-IN')} birds · day {f.currentBatch.ageDays}</span>
      : <span className="ds-caption">—</span> },
    { key: 'supervisor', header: 'Supervisor', width: 140, render: (f) => f.supervisor?.name ?? <span className="ds-caption">—</span> },
  ];

  return (
    <div className="ds-page">
      <PageHead
        title="Farms"
        subtitle="Every farm in the integration, its cycle position and who runs it"
        actions={canManage && (
          <button className="btn-primary" onClick={() => { setEditing(null); setForm(EMPTY_FORM); setCreating(true); }}>
            New farm
          </button>
        )}
      />

      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 14 }}>
        <SearchBox value={state.search} onChange={(v) => set({ search: v })} placeholder="Search farm, code, owner…" />
        <StatusSelect value={state.status} onChange={(v) => set({ status: v })} options={FARM_STATUSES as unknown as string[]} />
        <select className="input" style={{ maxWidth: 200 }} value={regionFilter} onChange={(e) => { setRegionFilter(e.target.value); set({ page: 1 }); }}>
          <option value="">All regions</option>
          {(regions ?? []).map((r) => <option key={r.id} value={r.id}>{r.name}</option>)}
        </select>
      </div>

      <Card flush>
        <DataTable
          rows={data?.data ?? []}
          columns={columns}
          rowKey={(f) => f.id}
          loading={isLoading}
          onRowClick={(f) => router.push(`/poultry/farms/${f.id}`)}
          empty={<EmptyState title="No farms yet" body="Add your farms to start placing batches and planning cycles." actionLabel={canManage ? 'New farm' : undefined} onAction={canManage ? () => setCreating(true) : undefined} />}
        />
      </Card>
      <Pagination meta={data?.meta} onPage={(p) => set({ page: p })} />

      <Modal
        open={creating || !!editing}
        onClose={() => { setCreating(false); setEditing(null); }}
        title={editing ? `Edit ${editing.name}` : 'New farm'}
        width={720}
        footer={(
          <>
            <button className="btn-secondary" onClick={() => { setCreating(false); setEditing(null); }}>Cancel</button>
            <button className="btn-primary" disabled={save.isPending || !form.name || !form.regionId} onClick={() => save.mutate()}>
              {save.isPending ? 'Saving…' : editing ? 'Save changes' : 'Add farm'}
            </button>
          </>
        )}
      >
        <FormSection title="Identity">
          <Field label="Farm name" required>
            <input className="input" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="Kalpetta Farm 4" />
          </Field>
          <Field label="Region" required>
            <select className="input" value={form.regionId} onChange={(e) => setForm({ ...form, regionId: e.target.value })}>
              <option value="">Choose…</option>
              {(regions ?? []).map((r) => <option key={r.id} value={r.id}>{r.name}</option>)}
            </select>
          </Field>
          <Field label="Location">
            <input className="input" value={form.location} onChange={(e) => setForm({ ...form, location: e.target.value })} />
          </Field>
          <Field label="Capacity (birds)">
            <input className="input" type="number" min={0} value={form.capacityBirds} onChange={(e) => setForm({ ...form, capacityBirds: e.target.value })} />
          </Field>
        </FormSection>
        <FormSection title="People">
          <Field label="Farm owner">
            <input className="input" value={form.ownerName} onChange={(e) => setForm({ ...form, ownerName: e.target.value })} />
          </Field>
          <Field label="Owner phone">
            <input className="input" value={form.ownerPhone} onChange={(e) => setForm({ ...form, ownerPhone: e.target.value })} />
          </Field>
          <Field label="Supervisor">
            <select className="input" value={form.supervisorId} onChange={(e) => setForm({ ...form, supervisorId: e.target.value })}>
              <option value="">Unassigned</option>
              {(staff ?? []).map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
            </select>
          </Field>
          <Field label="Notes" span={2}>
            <textarea className="input" rows={2} value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} />
          </Field>
        </FormSection>
      </Modal>
    </div>
  );
}
