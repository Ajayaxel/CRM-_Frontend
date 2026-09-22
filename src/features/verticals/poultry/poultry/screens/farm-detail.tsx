'use client';

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { api, apiErrorMessage } from '@/lib/api';
import { useAuth } from '@/features/foundation/auth';
import { Badge, Card, DataTable, DataTableColumn, Modal, SectionTitle, Skeleton, StatCard, humanStatus } from '../ui/kit';
import { Detail, DetailGrid, PageHead, fmtDate, money } from '../ui/common';
import { FARM_STATUSES, toneForBatchStatus, toneForFarmStatus } from '../ui/tone';

interface Shed {
  id: string; code: string; name: string; capacityBirds: number; isActive: boolean; notes?: string | null;
  occupied: boolean;
  currentBatch: { id: string; code: string; chickQty: number; placementDate: string; status: string } | null;
}

const EMPTY_SHED = { name: '', capacityBirds: '', isActive: true, notes: '' };

interface FarmDetail {
  id: string; code: string; name: string; status: string; capacityBirds: number;
  location?: string | null; ownerName?: string | null; ownerPhone?: string | null; notes?: string | null;
  region: { name: string; state?: string | null };
  supervisor?: { name: string; phone?: string | null } | null;
  currentBatch?: { id: string; code: string; chickQty: number; ageDays: number; placementDate: string; expectedPickupDate: string; status: string } | null;
  recentBatches: { id: string; code: string; status: string; placementDate: string; chickQty: number; ageDays: number; expectedPickupDate: string }[];
  financials: {
    chickCostInr: number; feedCostInr: number; medicineCostInr: number; directExpenseInr: number;
    allocatedExpenseInr: number; supervisionInr: number; totalCostInr: number; outputInr: number;
    profitInr: number; birdsPlaced: number; birdsPicked: number; weightPickedKg: number;
  };
}

export function PoultryFarmDetail({ id }: { id: string }) {
  const router = useRouter();
  const qc = useQueryClient();
  const { hasPermission } = useAuth();
  const canManage = hasPermission('poultry.manage');
  const [statusModal, setStatusModal] = useState(false);
  const [nextStatus, setNextStatus] = useState('');
  const [reason, setReason] = useState('');
  const [override, setOverride] = useState(false);

  const { data: farm, isLoading } = useQuery({
    queryKey: ['py-farm', id],
    queryFn: async () => (await api.get<FarmDetail>(`/poultry/farms/${id}`)).data,
  });
  const sheds = useQuery({
    queryKey: ['py-farm-sheds', id],
    queryFn: async () => (await api.get<Shed[]>(`/poultry/farms/${id}/sheds`)).data,
  });
  const [shedModal, setShedModal] = useState<Shed | 'new' | null>(null);
  const [shedForm, setShedForm] = useState(EMPTY_SHED);
  const saveShed = useMutation({
    mutationFn: () => {
      const body = {
        name: shedForm.name.trim(),
        capacityBirds: shedForm.capacityBirds === '' ? undefined : Number(shedForm.capacityBirds),
        isActive: shedForm.isActive,
        notes: shedForm.notes || undefined,
      };
      return shedModal === 'new' || !shedModal
        ? api.post(`/poultry/farms/${id}/sheds`, body)
        : api.patch(`/poultry/sheds/${shedModal.id}`, body);
    },
    onSuccess: () => {
      toast.success(shedModal === 'new' ? 'Shed added' : 'Shed updated');
      setShedModal(null);
      qc.invalidateQueries({ queryKey: ['py-farm-sheds', id] });
      qc.invalidateQueries({ queryKey: ['py-farm', id] });
      qc.invalidateQueries({ queryKey: ['py-farms'] });
    },
    onError: (e) => toast.error(apiErrorMessage(e)),
  });
  const openShed = (s: Shed | 'new') => {
    setShedForm(s === 'new' ? EMPTY_SHED : { name: s.name, capacityBirds: String(s.capacityBirds), isActive: s.isActive, notes: s.notes ?? '' });
    setShedModal(s);
  };

  const setStatus = useMutation({
    mutationFn: () => api.post(`/poultry/farms/${id}/status`, { status: nextStatus, reason: reason || undefined, override }),
    onSuccess: () => {
      toast.success('Farm status updated');
      setStatusModal(false); setReason(''); setOverride(false);
      qc.invalidateQueries({ queryKey: ['py-farm', id] });
      qc.invalidateQueries({ queryKey: ['py-farms'] });
      qc.invalidateQueries({ queryKey: ['py-calendar'] });
    },
    onError: (e) => toast.error(apiErrorMessage(e)),
  });

  if (isLoading || !farm) {
    return <div className="ds-page"><PageHead title="Farm" /><Skeleton rows={4} height={92} /></div>;
  }

  const f = farm.financials;
  const batchColumns: DataTableColumn<FarmDetail['recentBatches'][number]>[] = [
    { key: 'code', header: 'Batch', width: 110, render: (b) => <span style={{ fontWeight: 600 }}>{b.code}</span> },
    { key: 'status', header: 'Status', width: 120, render: (b) => <Badge tone={toneForBatchStatus(b.status)}>{humanStatus(b.status)}</Badge> },
    { key: 'placementDate', header: 'Placed', width: 120, render: (b) => fmtDate(b.placementDate) },
    { key: 'chickQty', header: 'Birds', align: 'right', width: 100, render: (b) => b.chickQty.toLocaleString('en-IN') },
    { key: 'ageDays', header: 'Age', align: 'right', width: 80, render: (b) => `${b.ageDays}d` },
    { key: 'expectedPickupDate', header: 'Expected pickup', width: 140, render: (b) => fmtDate(b.expectedPickupDate) },
  ];

  return (
    <div className="ds-page">
      <PageHead
        title={`${farm.name} · ${farm.code}`}
        subtitle={`${farm.region.name}${farm.location ? ` · ${farm.location}` : ''}`}
        actions={(
          <>
            <Badge tone={toneForFarmStatus(farm.status)}>{humanStatus(farm.status)}</Badge>
            {canManage && (
              <button className="btn-secondary" onClick={() => { setNextStatus(''); setStatusModal(true); }}>Change status</button>
            )}
          </>
        )}
      />

      <div className="ds-grid ds-grid-kpi">
        <StatCard label="Capacity" value={farm.capacityBirds.toLocaleString('en-IN')} hint="birds" />
        <StatCard
          label="Current birds"
          value={farm.currentBatch ? farm.currentBatch.chickQty.toLocaleString('en-IN') : '0'}
          hint={farm.currentBatch ? `batch ${farm.currentBatch.code} · day ${farm.currentBatch.ageDays}` : 'no active batch'}
        />
        <StatCard
          label="Expected pickup"
          value={farm.currentBatch ? fmtDate(farm.currentBatch.expectedPickupDate) : '—'}
          hint={farm.currentBatch ? `placed ${fmtDate(farm.currentBatch.placementDate)}` : undefined}
        />
        <StatCard label="Lifetime profit" value={money(f.profitInr)} tone={f.profitInr >= 0 ? 'active' : 'expired'} hint={`output ${money(f.outputInr)}`} />
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: 18 }}>
        <Card>
          <SectionTitle sub="Across every batch this farm has run">Farm financials</SectionTitle>
          <DetailGrid>
            <Detail label="Chick cost" value={money(f.chickCostInr)} />
            <Detail label="Feed cost" value={money(f.feedCostInr)} />
            <Detail label="Medicine & materials" value={money(f.medicineCostInr)} />
            <Detail label="Direct expenses" value={money(f.directExpenseInr)} />
            <Detail label="Allocated expenses" value={money(f.allocatedExpenseInr)} />
            <Detail label="Supervision" value={money(f.supervisionInr)} />
            <Detail label="Total cost" value={<strong>{money(f.totalCostInr)}</strong>} />
            <Detail label="Output value" value={<strong>{money(f.outputInr)}</strong>} />
            <Detail label="Profit / loss" value={<strong style={{ color: f.profitInr >= 0 ? 'var(--tone-active)' : 'var(--tone-expired)' }}>{money(f.profitInr)}</strong>} />
          </DetailGrid>
        </Card>
        <Card>
          <SectionTitle sub="The people behind the shed">Contacts & production</SectionTitle>
          <DetailGrid>
            <Detail label="Farm owner" value={farm.ownerName ?? '—'} />
            <Detail label="Owner phone" value={farm.ownerPhone ?? '—'} />
            <Detail label="Supervisor" value={farm.supervisor?.name ?? 'Unassigned'} />
            <Detail label="Supervisor phone" value={farm.supervisor?.phone ?? '—'} />
            <Detail label="Birds placed (lifetime)" value={f.birdsPlaced.toLocaleString('en-IN')} />
            <Detail label="Birds picked (lifetime)" value={f.birdsPicked.toLocaleString('en-IN')} />
            <Detail label="Weight picked" value={`${Math.round(f.weightPickedKg).toLocaleString('en-IN')} kg`} />
            <Detail label="Notes" value={farm.notes ?? '—'} />
          </DetailGrid>
        </Card>
      </div>

      <SectionTitle
        sub={(sheds.data?.length ?? 0) > 0
          ? 'Each shed takes one flock at a time. The farm\'s capacity is the sum of its active sheds.'
          : 'This farm has no sheds, so the farm itself is the unit a flock is placed into. Add sheds to place flocks house by house.'}
        action={canManage && <button className="btn-secondary btn-sm" onClick={() => openShed('new')}>Add shed</button>}
      >
        Sheds
      </SectionTitle>
      <Card flush>
        <DataTable
          rows={sheds.data ?? []}
          loading={sheds.isLoading}
          rowKey={(r) => r.id}
          onRowClick={canManage ? (r) => openShed(r) : undefined}
          columns={[
            { key: 'code', header: 'Shed', width: 180, render: (r) => <div><strong>{r.name}</strong><div className="ds-caption">{r.code}</div></div> },
            { key: 'capacity', header: 'Capacity', align: 'right', width: 120, render: (r) => r.capacityBirds.toLocaleString('en-IN') },
            { key: 'flock', header: 'Flock in it now', render: (r) => r.currentBatch
              ? <span>{r.currentBatch.code} · {r.currentBatch.chickQty.toLocaleString('en-IN')} birds · placed {fmtDate(r.currentBatch.placementDate)}</span>
              : <span className="ds-caption">empty</span> },
            { key: 'state', header: '', width: 120, render: (r) => !r.isActive
              ? <Badge>retired</Badge>
              : r.occupied ? <Badge tone="active">occupied</Badge> : <Badge>available</Badge> },
          ] as DataTableColumn<Shed>[]}
          empty={<div className="ds-caption" style={{ padding: 20 }}>No sheds yet.</div>}
        />
      </Card>

      <SectionTitle
        sub="Newest first — open a batch for its full cost sheet"
        action={farm.currentBatch && (
          <button className="btn-secondary btn-sm" onClick={() => router.push(`/poultry/batches/${farm.currentBatch!.id}`)}>Open current batch</button>
        )}
      >
        Production history
      </SectionTitle>
      <Card flush>
        <DataTable
          rows={farm.recentBatches}
          columns={batchColumns}
          rowKey={(b) => b.id}
          onRowClick={(b) => router.push(`/poultry/batches/${b.id}`)}
          empty={<div className="ds-caption" style={{ padding: 20 }}>No batches yet — place chicks to start the first cycle.</div>}
        />
      </Card>

      <Modal
        open={!!shedModal}
        onClose={() => setShedModal(null)}
        title={shedModal === 'new' ? 'Add shed' : `Edit ${shedModal?.name ?? 'shed'}`}
        subtitle="A shed with birds in it cannot be retired, or shrunk below the flock it holds."
        width={480}
        footer={(
          <>
            <button className="btn-secondary" onClick={() => setShedModal(null)}>Cancel</button>
            <button className="btn-primary" disabled={!shedForm.name.trim() || saveShed.isPending} onClick={() => saveShed.mutate()}>
              {saveShed.isPending ? 'Saving…' : 'Save shed'}
            </button>
          </>
        )}
      >
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          <label className="label">Name
            <input className="input" value={shedForm.name} onChange={(e) => setShedForm({ ...shedForm, name: e.target.value })} placeholder="Shed 1" />
          </label>
          <label className="label">Capacity (birds)
            <input className="input" type="number" min={0} value={shedForm.capacityBirds} onChange={(e) => setShedForm({ ...shedForm, capacityBirds: e.target.value })} />
          </label>
          <label className="label">Notes
            <input className="input" value={shedForm.notes} onChange={(e) => setShedForm({ ...shedForm, notes: e.target.value })} />
          </label>
          <label style={{ display: 'flex', gap: 8, alignItems: 'center', fontSize: 13 }}>
            <input type="checkbox" checked={shedForm.isActive} onChange={(e) => setShedForm({ ...shedForm, isActive: e.target.checked })} />
            In use
          </label>
        </div>
      </Modal>

      <Modal
        open={statusModal}
        onClose={() => setStatusModal(false)}
        title="Change farm status"
        subtitle="Off-lifecycle moves need an override and a reason, and are audited."
        width={520}
        footer={(
          <>
            <button className="btn-secondary" onClick={() => setStatusModal(false)}>Cancel</button>
            <button className="btn-primary" disabled={!nextStatus || setStatus.isPending} onClick={() => setStatus.mutate()}>
              {setStatus.isPending ? 'Saving…' : 'Update status'}
            </button>
          </>
        )}
      >
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          <label className="label">New status
            <select className="input" value={nextStatus} onChange={(e) => setNextStatus(e.target.value)}>
              <option value="">Choose…</option>
              {FARM_STATUSES.map((s) => <option key={s} value={s}>{humanStatus(s)}</option>)}
            </select>
          </label>
          <label className="label">Reason
            <input className="input" value={reason} onChange={(e) => setReason(e.target.value)} placeholder="Why this move?" />
          </label>
          <label style={{ display: 'flex', gap: 8, alignItems: 'center', fontSize: 13 }}>
            <input type="checkbox" checked={override} onChange={(e) => setOverride(e.target.checked)} />
            Authorized override (skip lifecycle rules — audited)
          </label>
        </div>
      </Modal>
    </div>
  );
}
