'use client';

import React, { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { IndianRupee } from 'lucide-react';
import { api, apiErrorMessage } from '@/lib/api';
import { useAuth } from '@/features/foundation/auth';
import {
  Badge, Card, DataTable, DataTableColumn, Drawer, EmptyState, Field, FormSection,
  Modal, SectionTitle, StatCard, Tone, humanStatus,
} from '../ui/kit';
import { Detail, DetailGrid, PageHead, Pagination, SearchBox, fmtDate, money, useListState } from '../ui/common';
import { paiseRate } from '../ui/tone';

interface FarmerRow {
  id: string; code: string; name: string; phone?: string | null; address?: string | null;
  bankDetails?: string | null; defaultGrowingPaisePerKg: number; isActive: boolean; notes?: string | null;
  _count: { farms: number; settlements: number };
}

interface FarmerStatement {
  farmer: FarmerRow & { farms: { id: string; code: string; name: string; status: string }[] };
  settlements: {
    id: string; reference: string; status: string; date: string; netInr: number;
    fcr: number | null; incentiveInr: number; grossInr: number;
    batch: { code: string; placementDate: string };
  }[];
  outstandingInr: number;
}

export function toneForSettlementStatus(s: string): Tone {
  switch (s) {
    case 'PAID': return 'active';
    case 'APPROVED': return 'renewal';
    default: return 'neutral';
  }
}

const DRAWER_TABS = ['Statement', 'Details'];

export function PoultryFarmers() {
  const qc = useQueryClient();
  const { hasPermission } = useAuth();
  const canManage = hasPermission('poultry.manage');
  const { state, set, params } = useListState({ sort: 'name', dir: 'asc' });
  const [active, setActive] = useState<FarmerRow | null>(null);
  const [tab, setTab] = useState('Statement');
  const [modal, setModal] = useState<'create' | 'edit' | null>(null);

  const { data, isLoading } = useQuery({
    queryKey: ['py-farmers', params],
    queryFn: async () => (await api.get<{ data: FarmerRow[]; meta: { page: number; limit: number; total: number; totalPages: number } }>(
      '/poultry/farmers', { params },
    )).data,
  });

  const invalidate = () => {
    qc.invalidateQueries({ queryKey: ['py-farmers'] });
    qc.invalidateQueries({ queryKey: ['py-farmer-statement'] });
    qc.invalidateQueries({ queryKey: ['py-dashboard'] });
  };

  const columns: DataTableColumn<FarmerRow>[] = [
    { key: 'code', header: 'Code', width: 100, render: (f) => <span style={{ fontWeight: 600 }}>{f.code}</span> },
    { key: 'name', header: 'Farmer', render: (f) => (
      <div style={{ minWidth: 0 }}>
        <div style={{ fontWeight: 600 }}>{f.name}</div>
        {f.address && <div className="ds-caption">{f.address}</div>}
      </div>
    ) },
    { key: 'phone', header: 'Phone', width: 130, render: (f) => f.phone ?? <span className="ds-caption">—</span> },
    { key: 'rate', header: 'Default rate', align: 'right', width: 110, render: (f) => (
      f.defaultGrowingPaisePerKg > 0 ? `${paiseRate(f.defaultGrowingPaisePerKg)}/kg` : <span className="ds-caption">—</span>
    ) },
    { key: 'farms', header: 'Farms', align: 'right', width: 80, render: (f) => f._count.farms },
    { key: 'settlements', header: 'Settlements', align: 'right', width: 110, render: (f) => f._count.settlements },
    { key: 'isActive', header: 'Status', width: 100, render: (f) => <Badge tone={f.isActive ? 'active' : 'expired'}>{f.isActive ? 'Active' : 'Inactive'}</Badge> },
  ];

  return (
    <div className="ds-page">
      <PageHead
        title="Growers"
        subtitle="Integration farmers — their farms, their settlements, and what the company still owes them"
        actions={canManage && (
          <button className="btn-primary" onClick={() => setModal('create')}>New farmer</button>
        )}
      />

      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 14 }}>
        <SearchBox value={state.search} onChange={(v) => set({ search: v })} placeholder="Search farmer, code, phone…" />
      </div>

      <Card flush>
        <DataTable
          rows={data?.data ?? []}
          columns={columns}
          rowKey={(f) => f.id}
          loading={isLoading}
          onRowClick={(f) => { setActive(f); setTab('Statement'); }}
          empty={<EmptyState title="No farmers yet" body="Add the integration farmers who grow your birds." actionLabel={canManage ? 'New farmer' : undefined} onAction={canManage ? () => setModal('create') : undefined} />}
        />
      </Card>
      <Pagination meta={data?.meta} onPage={(p) => set({ page: p })} />

      <Drawer
        open={!!active && modal !== 'edit'}
        onClose={() => setActive(null)}
        title={active?.name ?? ''}
        subtitle={active ? `${active.code}${active.phone ? ` · ${active.phone}` : ''}` : undefined}
        tabs={DRAWER_TABS}
        activeTab={tab}
        onTab={setTab}
        width={720}
      >
        {active && tab === 'Statement' && <FarmerStatementTab farmerId={active.id} />}
        {active && tab === 'Details' && (
          <FarmerDetails farmer={active} canEdit={canManage} onEdit={() => setModal('edit')} />
        )}
      </Drawer>

      <FarmerModal
        open={modal === 'create' || modal === 'edit'}
        editing={modal === 'edit' ? active : null}
        onClose={() => setModal(null)}
        onDone={(updated) => { invalidate(); if (updated) setActive(updated); }}
      />
    </div>
  );
}

function FarmerStatementTab({ farmerId }: { farmerId: string }) {
  const { data: statement } = useQuery({
    queryKey: ['py-farmer-statement', farmerId],
    queryFn: async () => (await api.get<FarmerStatement>(`/poultry/farmers/${farmerId}/statement`)).data,
  });

  const columns: DataTableColumn<FarmerStatement['settlements'][number]>[] = [
    { key: 'reference', header: 'Ref', width: 100, render: (s) => <span style={{ fontWeight: 600 }}>{s.reference}</span> },
    { key: 'batch', header: 'Batch', width: 100, render: (s) => s.batch.code },
    { key: 'date', header: 'Date', width: 100, render: (s) => fmtDate(s.date) },
    { key: 'fcr', header: 'FCR', align: 'right', width: 70, render: (s) => (s.fcr != null ? s.fcr.toFixed(2) : '—') },
    { key: 'grossInr', header: 'Gross', align: 'right', width: 100, render: (s) => money(s.grossInr) },
    { key: 'incentiveInr', header: 'Incentive', align: 'right', width: 100, render: (s) => money(s.incentiveInr) },
    { key: 'netInr', header: 'Net', align: 'right', width: 110, render: (s) => <strong>{money(s.netInr)}</strong> },
    { key: 'status', header: 'Status', width: 110, render: (s) => <Badge tone={toneForSettlementStatus(s.status)}>{humanStatus(s.status)}</Badge> },
  ];

  return (
    <div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(150px,1fr))', gap: 12, marginBottom: 16 }}>
        <StatCard
          label="Outstanding"
          value={money(statement?.outstandingInr)}
          icon={IndianRupee}
          tone={(statement?.outstandingInr ?? 0) > 0 ? 'sales' : 'active'}
          hint="Approved settlements awaiting payment"
        />
      </div>
      <SectionTitle sub="Every batch settled with this grower">Settlements</SectionTitle>
      <Card flush>
        <DataTable
          rows={statement?.settlements ?? []}
          columns={columns}
          rowKey={(s) => s.id}
          dense
          empty={<div className="ds-caption" style={{ padding: 16 }}>No settlements yet.</div>}
        />
      </Card>
    </div>
  );
}

function FarmerDetails({ farmer, canEdit, onEdit }: { farmer: FarmerRow; canEdit: boolean; onEdit: () => void }) {
  return (
    <div>
      <SectionTitle action={canEdit ? <button className="btn-secondary btn-sm" onClick={onEdit}>Edit</button> : undefined}>
        Master record
      </SectionTitle>
      <DetailGrid>
        <Detail label="Code" value={farmer.code} />
        <Detail label="Name" value={farmer.name} />
        <Detail label="Phone" value={farmer.phone ?? '—'} />
        <Detail label="Address" value={farmer.address ?? '—'} />
        <Detail label="Bank details" value={farmer.bankDetails ?? '—'} />
        <Detail label="Default growing rate" value={farmer.defaultGrowingPaisePerKg > 0 ? `${paiseRate(farmer.defaultGrowingPaisePerKg)}/kg` : '—'} />
        <Detail label="Farms" value={farmer._count.farms} />
        <Detail label="Settlements" value={farmer._count.settlements} />
        <Detail label="Active" value={farmer.isActive ? 'Yes' : 'No'} />
        <Detail label="Notes" value={farmer.notes ?? '—'} />
      </DetailGrid>
    </div>
  );
}

const EMPTY_FARMER_FORM = { name: '', phone: '', address: '', bankDetails: '', defaultRate: '', isActive: true, notes: '' };

function FarmerModal({ open, editing, onClose, onDone }: {
  open: boolean; editing: FarmerRow | null; onClose: () => void; onDone: (updated: FarmerRow | null) => void;
}) {
  const [form, setForm] = useState(EMPTY_FARMER_FORM);
  React.useEffect(() => {
    if (!open) return;
    setForm(editing ? {
      name: editing.name, phone: editing.phone ?? '', address: editing.address ?? '',
      bankDetails: editing.bankDetails ?? '',
      defaultRate: editing.defaultGrowingPaisePerKg ? String(editing.defaultGrowingPaisePerKg / 100) : '',
      isActive: editing.isActive, notes: editing.notes ?? '',
    } : EMPTY_FARMER_FORM);
  }, [open, editing]);

  const save = useMutation({
    mutationFn: async () => {
      const body = {
        name: form.name,
        phone: form.phone || undefined,
        address: form.address || undefined,
        bankDetails: form.bankDetails || undefined,
        defaultGrowingPaisePerKg: form.defaultRate ? Math.round(Number(form.defaultRate) * 100) : 0,
        notes: form.notes || undefined,
        ...(editing ? { isActive: form.isActive } : {}),
      };
      if (editing) return (await api.patch<FarmerRow>(`/poultry/farmers/${editing.id}`, body)).data;
      return (await api.post<FarmerRow>('/poultry/farmers', body)).data;
    },
    onSuccess: (row) => {
      toast.success(editing ? 'Farmer updated' : 'Farmer added');
      onClose();
      onDone(editing ? row : null);
    },
    onError: (e) => toast.error(apiErrorMessage(e)),
  });

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={editing ? `Edit ${editing.name}` : 'New farmer'}
      width={680}
      footer={(
        <>
          <button className="btn-secondary" onClick={onClose}>Cancel</button>
          <button className="btn-primary" disabled={save.isPending || !form.name} onClick={() => save.mutate()}>
            {save.isPending ? 'Saving…' : editing ? 'Save changes' : 'Add farmer'}
          </button>
        </>
      )}
    >
      <FormSection title="Identity">
        <Field label="Name" required>
          <input className="input" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
        </Field>
        <Field label="Phone">
          <input className="input" value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} />
        </Field>
        <Field label="Address" span={2}>
          <input className="input" value={form.address} onChange={(e) => setForm({ ...form, address: e.target.value })} />
        </Field>
      </FormSection>
      <FormSection title="Terms">
        <Field label="Bank details" hint="Account and IFSC for settlement payouts">
          <input className="input" value={form.bankDetails} onChange={(e) => setForm({ ...form, bankDetails: e.target.value })} />
        </Field>
        <Field label="Default growing rate (₹/kg)" hint="Prefills the rate when a settlement is generated">
          <input className="input" type="number" min={0} step="0.01" value={form.defaultRate} onChange={(e) => setForm({ ...form, defaultRate: e.target.value })} />
        </Field>
        <Field label="Notes" span={2}>
          <textarea className="input" rows={2} value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} />
        </Field>
        {editing && (
          <Field label="Status" span={2}>
            <label style={{ display: 'flex', gap: 8, alignItems: 'center', fontSize: 13 }}>
              <input type="checkbox" checked={form.isActive} onChange={(e) => setForm({ ...form, isActive: e.target.checked })} />
              Active
            </label>
          </Field>
        )}
      </FormSection>
    </Modal>
  );
}
