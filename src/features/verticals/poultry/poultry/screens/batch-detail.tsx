'use client';

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { api, apiErrorMessage } from '@/lib/api';
import { useAuth } from '@/features/foundation/auth';
import { Badge, Card, DataTable, DataTableColumn, Field, FormSection, Modal, SectionTitle, Skeleton, StatCard, humanStatus } from '../ui/kit';
import { Detail, DetailGrid, PageHead, fmtDate, money, toDateInput } from '../ui/common';
import { FEED_STAGES, PAY_MODES, paiseRate, toneForBatchStatus, toneForFeedHealth, toneForPaidStatus } from '../ui/tone';

interface BirdRecon {
  placed: number; mortality: number; adjustments: number; picked: number;
  balance: number; mortalityPct: number; consistent: boolean;
}

interface StageRow {
  stage: string; plannedBags: number; actualBags: number; varianceBags: number; costInr: number;
}

interface BatchDetail {
  id: string; code: string; status: string; placementDate: string; chickQty: number;
  expectedPickupDate: string; productionDays: number; restDays: number;
  supervisionPaisePerBird: number; kgPerBag: number; plannedFcr: number; ageDays: number; notes?: string | null;
  farm: { id: string; name: string; code: string; region: { name: string }; supervisor?: { name: string } | null };
  placements: { id: string; date: string; quantity: number; costPaisePerChick: number; purchase?: { reference: string } | null }[];
  pickups: { id: string; reference: string; date: string; birds: number; weightKg: number; ratePaisePerKg: number; grossInr: number; deductionInr: number; netInr: number; partyName?: string | null; avgWeightKg: number }[];
  feedDispatches: { id: string; reference: string; date: string; stage: string; bags: number; ratePaisePerBag: number; amountInr: number; paidStatus: string; supplier: { name: string } }[];
  inventoryTxns: { id: string; date: string; qty: number; amountInr: number; item: { name: string; unit: string } }[];
  allocations: { id: string; amountInr: number; method: string; expense: { reference: string; description: string; date: string } }[];
  mortalities: { id: string; date: string; birds: number; kind: string; reason?: string | null; notes?: string | null }[];
  feedReturns?: { id: string; date: string; stage: string; bags: number; valueInr: number; reason?: string | null }[];
  vaccinations?: { id: string; date: string; ageDays: number; dose?: string | null; scheduleItem?: { name: string; dayDue: number } | null }[];
  costing: {
    birds: BirdRecon; mortalityBirds: number; mortalityPct: number; currentBirds: number;
    avgWeightKg: number; feedStages: StageRow[]; fcr: number | null; plannedFcr: number;
    fcrVariance: number | null; kgPerBag: number;
    chickCostInr: number; feedCostInr: number; feedBags: number; medicineCostInr: number;
    directExpenseInr: number; allocatedExpenseInr: number; supervisionInr: number; totalCostInr: number;
    grossOutputInr: number; deductionsInr: number; outputInr: number; profitInr: number;
    birdsPicked: number; weightPickedKg: number; costPerBirdInr: number;
    profitPerBirdInr: number; profitPerKgInr: number; costPerKgInr: number;
  };
  feed: {
    stage: string | null; currentStageBalanceBags: number; coverageDays: number | null;
    exhaustionDate: string | null; recommendedNextSupplyBags: number; shortfallBags: number;
    expectedToDateBags: number; suppliedTotalBags: number;
  };
}

export function PoultryBatchDetail({ id }: { id: string }) {
  const qc = useQueryClient();
  const { hasPermission } = useAuth();
  const canManage = hasPermission('poultry.manage');
  const canFinance = hasPermission('poultry.finance');
  const [modal, setModal] = useState<'feed' | 'pickup' | 'issue' | 'close' | 'mortality' | 'daily' | 'feedReturn' | 'vaccination' | null>(null);
  const router = useRouter();

  const { data: batch, isLoading } = useQuery({
    queryKey: ['py-batch', id],
    queryFn: async () => (await api.get<BatchDetail>(`/poultry/batches/${id}`)).data,
  });

  const invalidate = () => {
    qc.invalidateQueries({ queryKey: ['py-batch', id] });
    qc.invalidateQueries({ queryKey: ['py-batches'] });
    qc.invalidateQueries({ queryKey: ['py-dashboard'] });
    qc.invalidateQueries({ queryKey: ['py-feed-board'] });
  };

  if (isLoading || !batch) {
    return <div className="ds-page"><PageHead title="Batch" /><Skeleton rows={4} height={92} /></div>;
  }

  const c = batch.costing;
  const fd = batch.feed;
  const health = fd.shortfallBags > 0 ? 'SHORTFALL' : fd.coverageDays != null && fd.coverageDays <= 2 ? 'LOW' : 'OK';

  return (
    <div className="ds-page">
      <PageHead
        title={`${batch.code} · ${batch.farm.name}`}
        subtitle={`${batch.farm.region.name} · supervisor ${batch.farm.supervisor?.name ?? '—'} · rules snapshot: ${batch.productionDays}d production, ${batch.restDays}d rest, ${paiseRate(batch.supervisionPaisePerBird)}/bird supervision`}
        actions={(
          <>
            <Badge tone={toneForBatchStatus(batch.status)}>{humanStatus(batch.status)}</Badge>
            <button className="btn-secondary" onClick={() => router.push(`/poultry/batches/${id}/statement`)}>Register</button>
            {canManage && batch.status !== 'CLOSED' && batch.status !== 'CANCELLED' && (
              <>
                <button className="btn-secondary" onClick={() => setModal('daily')}>Daily entry</button>
                <button className="btn-secondary" onClick={() => setModal('mortality')}>Mortality</button>
                <button className="btn-secondary" onClick={() => setModal('feed')}>Feed load</button>
                <button className="btn-secondary" onClick={() => setModal('feedReturn')}>Return feed</button>
                <button className="btn-secondary" onClick={() => setModal('issue')}>Issue medicine</button>
                <button className="btn-primary" onClick={() => setModal('pickup')}>Record pickup</button>
              </>
            )}
            {canFinance && batch.status === 'COMPLETED' && (
              <button className="btn-secondary" onClick={() => router.push('/poultry/settlements')}>Settlement</button>
            )}
            {canManage && batch.status === 'COMPLETED' && (
              <button className="btn-secondary" onClick={() => setModal('close')}>Close batch</button>
            )}
          </>
        )}
      />

      <div className="ds-grid ds-grid-kpi">
        <StatCard label="Age" value={`${batch.ageDays}d`} hint={`of ${batch.productionDays} · pickup ${fmtDate(batch.expectedPickupDate)}`} />
        <StatCard
          label="Birds standing"
          value={c.currentBirds.toLocaleString('en-IN')}
          hint={`${c.mortalityBirds.toLocaleString('en-IN')} lost (${c.mortalityPct}%) · ${c.birdsPicked.toLocaleString('en-IN')} picked of ${batch.chickQty.toLocaleString('en-IN')}`}
          tone={c.birds.consistent ? 'neutral' : 'expired'}
        />
        <StatCard
          label={`Feed — ${fd.stage ? humanStatus(fd.stage) : 'past plan'}`}
          value={fd.coverageDays != null ? `${fd.coverageDays}d cover` : '—'}
          hint={`${fd.currentStageBalanceBags} bags left${fd.exhaustionDate ? ` · out ${fmtDate(fd.exhaustionDate)}` : ''}`}
          tone={toneForFeedHealth(health)}
        />
        <StatCard
          label="FCR"
          value={c.fcr != null ? c.fcr.toFixed(2) : '—'}
          hint={c.fcr != null ? `planned ${c.plannedFcr.toFixed(2)} · ${c.fcrVariance != null && c.fcrVariance > 0 ? '+' : ''}${c.fcrVariance ?? 0} · ${c.kgPerBag}kg/bag` : 'awaiting pickup weight'}
          tone={c.fcr == null ? 'neutral' : c.fcr <= c.plannedFcr ? 'active' : 'claim'}
        />
        <StatCard label="Profit / loss" value={money(c.profitInr)} tone={c.profitInr >= 0 ? 'active' : 'expired'} hint={`output ${money(c.outputInr)} · cost ${money(c.totalCostInr)}`} />
      </div>

      {!c.birds.consistent && (
        <Card tone="claim">
          <div style={{ display: 'flex', gap: 12, alignItems: 'center', flexWrap: 'wrap' }}>
            <Badge tone="expired">Bird count mismatch</Badge>
            <span style={{ fontSize: 13 }}>
              Placed {c.birds.placed.toLocaleString('en-IN')} − lost {c.birds.mortality.toLocaleString('en-IN')}
              {c.birds.adjustments !== 0 && <> {c.birds.adjustments > 0 ? '+' : ''}{c.birds.adjustments} adjusted</>} − picked {c.birds.picked.toLocaleString('en-IN')} = <strong>{c.birds.balance.toLocaleString('en-IN')}</strong>.
              {c.birds.balance > 0 ? ' Record the mortality or an authorized adjustment.' : ' More birds left than were placed — check the entries.'}
            </span>
            {canManage && <button className="btn-primary btn-sm" style={{ marginLeft: 'auto' }} onClick={() => setModal('mortality')}>Record mortality</button>}
          </div>
        </Card>
      )}

      {(fd.shortfallBags > 0 || (fd.coverageDays != null && fd.coverageDays <= 2)) && (
        <Card tone="claim">
          <div style={{ display: 'flex', gap: 12, alignItems: 'center', flexWrap: 'wrap' }}>
            <Badge tone={toneForFeedHealth(health)}>{health === 'SHORTFALL' ? 'Feed shortfall' : 'Feed low'}</Badge>
            <span style={{ fontSize: 13 }}>
              {fd.shortfallBags > 0 && <>Supply trails the plan by <strong>{fd.shortfallBags} bags</strong> (expected {fd.expectedToDateBags}, received {fd.suppliedTotalBags}). </>}
              {fd.coverageDays != null && fd.coverageDays <= 2 && <>Current stage covers <strong>{fd.coverageDays} day{fd.coverageDays === 1 ? '' : 's'}</strong>; order ~<strong>{fd.recommendedNextSupplyBags} bags</strong>.</>}
            </span>
            {canManage && <button className="btn-primary btn-sm" style={{ marginLeft: 'auto' }} onClick={() => setModal('feed')}>Order feed</button>}
          </div>
        </Card>
      )}

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: 18 }}>
        <Card>
          <SectionTitle sub="Live — recomputed from documents on every view">Cost sheet</SectionTitle>
          <DetailGrid>
            <Detail label="Chicks" value={money(c.chickCostInr)} />
            <Detail label={`Feed (${c.feedBags} bags)`} value={money(c.feedCostInr)} />
            <Detail label="Medicine & materials" value={money(c.medicineCostInr)} />
            <Detail label="Direct expenses" value={money(c.directExpenseInr)} />
            <Detail label="Allocated share" value={money(c.allocatedExpenseInr)} />
            <Detail label="Supervision" value={money(c.supervisionInr)} />
            <Detail label="Total cost" value={<strong>{money(c.totalCostInr)}</strong>} />
            <Detail label="Cost per bird" value={money(c.costPerBirdInr)} />
          </DetailGrid>
        </Card>
        <Card>
          <SectionTitle sub="Gross, deductions, and what actually landed">Output</SectionTitle>
          <DetailGrid>
            <Detail label="Birds picked" value={c.birdsPicked.toLocaleString('en-IN')} />
            <Detail label="Total weight" value={`${Math.round(c.weightPickedKg).toLocaleString('en-IN')} kg`} />
            <Detail label="Average weight" value={c.avgWeightKg > 0 ? `${c.avgWeightKg} kg/bird` : '—'} />
            <Detail label="Gross value" value={money(c.grossOutputInr)} />
            <Detail label="Deductions" value={money(c.deductionsInr)} />
            <Detail label="Net output" value={<strong>{money(c.outputInr)}</strong>} />
            <Detail label="Profit / loss" value={<strong style={{ color: c.profitInr >= 0 ? 'var(--tone-active)' : 'var(--tone-expired)' }}>{money(c.profitInr)}</strong>} />
            <Detail label="Profit / bird" value={money(c.profitPerBirdInr)} />
            <Detail label="Profit / kg" value={`₹${c.profitPerKgInr.toLocaleString('en-IN')}`} />
          </DetailGrid>
        </Card>
        <Card>
          <SectionTitle sub="Placed − lost ± adjustments − picked = standing">Bird register</SectionTitle>
          <DetailGrid>
            <Detail label="Placed" value={c.birds.placed.toLocaleString('en-IN')} />
            <Detail label="Mortality" value={`${c.birds.mortality.toLocaleString('en-IN')} (${c.mortalityPct}%)`} />
            <Detail label="Adjustments" value={c.birds.adjustments === 0 ? '—' : `${c.birds.adjustments > 0 ? '+' : ''}${c.birds.adjustments}`} />
            <Detail label="Picked / sold" value={c.birds.picked.toLocaleString('en-IN')} />
            <Detail label="Standing" value={<strong>{c.birds.balance.toLocaleString('en-IN')}</strong>} />
            <Detail label="Register" value={<Badge tone={c.birds.consistent ? 'active' : 'expired'}>{c.birds.consistent ? 'Reconciles' : 'Mismatch'}</Badge>} />
          </DetailGrid>
          {batch.mortalities.length > 0 && (
            <div style={{ marginTop: 14 }}>
              <DataTable
                rows={batch.mortalities}
                columns={[
                  { key: 'date', header: 'Date', width: 110, render: (m) => fmtDate(m.date) },
                  { key: 'kind', header: 'Kind', width: 110, render: (m) => humanStatus(m.kind) },
                  { key: 'birds', header: 'Birds', align: 'right', width: 80, render: (m) => (m.kind === 'ADJUSTMENT' && m.birds > 0 ? `+${m.birds}` : m.birds) },
                  { key: 'reason', header: 'Reason', render: (m) => m.reason ?? '—' },
                ] as DataTableColumn<BatchDetail['mortalities'][number]>[]}
                rowKey={(m) => m.id}
                dense
              />
            </div>
          )}
        </Card>
      </div>

      <SectionTitle sub="Plan from the batch's snapshot vs what actually arrived">Feed stages</SectionTitle>
      <Card flush>
        <DataTable
          rows={c.feedStages}
          columns={[
            { key: 'stage', header: 'Stage', width: 130, render: (s) => humanStatus(s.stage) },
            { key: 'plannedBags', header: 'Planned bags', align: 'right', width: 120 },
            { key: 'actualBags', header: 'Actual bags', align: 'right', width: 120 },
            { key: 'varianceBags', header: 'Variance', align: 'right', width: 110, render: (s) => (
              <span style={{ color: s.varianceBags < 0 ? 'var(--tone-expired)' : 'var(--ink)' }}>
                {s.varianceBags > 0 ? '+' : ''}{s.varianceBags}
              </span>
            ) },
            { key: 'costInr', header: 'Cost', align: 'right', width: 120, render: (s) => money(s.costInr) },
          ] as DataTableColumn<StageRow>[]}
          rowKey={(s) => s.stage}
          dense
        />
      </Card>

      <SectionTitle sub="Feed loads booked to this batch">Feed dispatches</SectionTitle>
      <Card flush>
        <DataTable
          rows={batch.feedDispatches}
          columns={[
            { key: 'reference', header: 'Load', width: 100, render: (d) => <span style={{ fontWeight: 600 }}>{d.reference}</span> },
            { key: 'date', header: 'Date', width: 110, render: (d) => fmtDate(d.date) },
            { key: 'stage', header: 'Stage', width: 120, render: (d) => humanStatus(d.stage) },
            { key: 'bags', header: 'Bags', align: 'right', width: 80 },
            { key: 'rate', header: 'Rate/bag', align: 'right', width: 100, render: (d) => paiseRate(d.ratePaisePerBag) },
            { key: 'amountInr', header: 'Amount', align: 'right', width: 110, render: (d) => money(d.amountInr) },
            { key: 'supplier', header: 'Supplier', render: (d) => d.supplier.name },
            { key: 'paidStatus', header: 'Paid', width: 100, render: (d) => <Badge tone={toneForPaidStatus(d.paidStatus)}>{humanStatus(d.paidStatus)}</Badge> },
          ] as DataTableColumn<BatchDetail['feedDispatches'][number]>[]}
          rowKey={(d) => d.id}
          empty={<div className="ds-caption" style={{ padding: 16 }}>No feed dispatched yet.</div>}
          dense
        />
      </Card>

      {!!batch.feedReturns?.length && (
        <>
          <SectionTitle sub="Bags sent back — off the batch's cost sheet">Feed returns</SectionTitle>
          <Card flush>
            <DataTable
              rows={batch.feedReturns}
              columns={[
                { key: 'date', header: 'Date', width: 110, render: (r) => fmtDate(r.date) },
                { key: 'stage', header: 'Stage', width: 120, render: (r) => humanStatus(r.stage) },
                { key: 'bags', header: 'Bags', align: 'right', width: 80 },
                { key: 'valueInr', header: 'Value', align: 'right', width: 110, render: (r) => money(r.valueInr) },
                { key: 'reason', header: 'Reason', render: (r) => r.reason ?? '—' },
              ] as DataTableColumn<NonNullable<BatchDetail['feedReturns']>[number]>[]}
              rowKey={(r) => r.id}
              dense
            />
          </Card>
        </>
      )}

      {batch.vaccinations && (
        <>
          <SectionTitle
            sub="Doses given against the programme"
            action={canManage && batch.status !== 'CLOSED' && batch.status !== 'CANCELLED'
              ? <button className="btn-primary btn-sm" onClick={() => setModal('vaccination')}>Add</button>
              : undefined}
          >Vaccinations</SectionTitle>
          <Card flush>
            <DataTable
              rows={batch.vaccinations}
              columns={[
                { key: 'date', header: 'Date', width: 110, render: (v) => fmtDate(v.date) },
                { key: 'scheduleItem', header: 'Vaccine', render: (v) => v.scheduleItem?.name ?? '—' },
                { key: 'ageDays', header: 'Day', align: 'right', width: 80, render: (v) => v.ageDays },
                { key: 'dose', header: 'Dose', width: 160, render: (v) => v.dose ?? '—' },
              ] as DataTableColumn<NonNullable<BatchDetail['vaccinations']>[number]>[]}
              rowKey={(v) => v.id}
              dense
              empty={<div className="ds-caption" style={{ padding: 16 }}>No vaccinations recorded yet.</div>}
            />
          </Card>
        </>
      )}

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: 18 }}>
        <div>
          <SectionTitle sub="Chicks in">Placements</SectionTitle>
          <Card flush>
            <DataTable
              rows={batch.placements}
              columns={[
                { key: 'date', header: 'Date', width: 110, render: (p) => fmtDate(p.date) },
                { key: 'quantity', header: 'Chicks', align: 'right', render: (p) => p.quantity.toLocaleString('en-IN') },
                { key: 'rate', header: 'Rate', align: 'right', render: (p) => paiseRate(p.costPaisePerChick) },
                { key: 'purchase', header: 'Purchase', render: (p) => p.purchase?.reference ?? '—' },
              ] as DataTableColumn<BatchDetail['placements'][number]>[]}
              rowKey={(p) => p.id}
              dense
              empty={<div className="ds-caption" style={{ padding: 16 }}>No placements.</div>}
            />
          </Card>
        </div>
        <div>
          <SectionTitle sub="Birds out">Pickups</SectionTitle>
          <Card flush>
            <DataTable
              rows={batch.pickups}
              columns={[
                { key: 'reference', header: 'Ref', width: 100, render: (p) => <span style={{ fontWeight: 600 }}>{p.reference}</span> },
                { key: 'date', header: 'Date', width: 110, render: (p) => fmtDate(p.date) },
                { key: 'party', header: 'Party', render: (p) => p.partyName ?? '—' },
                { key: 'birds', header: 'Birds', align: 'right', render: (p) => p.birds.toLocaleString('en-IN') },
                { key: 'weightKg', header: 'Kg', align: 'right', render: (p) => p.weightKg.toLocaleString('en-IN') },
                { key: 'avgWeightKg', header: 'Avg', align: 'right', width: 70, render: (p) => p.avgWeightKg },
                { key: 'rate', header: 'Rate', align: 'right', width: 90, render: (p) => paiseRate(p.ratePaisePerKg) },
                { key: 'netInr', header: 'Net', align: 'right', render: (p) => money(p.netInr) },
              ] as DataTableColumn<BatchDetail['pickups'][number]>[]}
              rowKey={(p) => p.id}
              dense
              empty={<div className="ds-caption" style={{ padding: 16 }}>No pickups yet.</div>}
            />
          </Card>
        </div>
      </div>

      {batch.inventoryTxns.length > 0 && (
        <>
          <SectionTitle sub="Issued from the central store to this batch">Medicine & materials</SectionTitle>
          <Card flush>
            <DataTable
              rows={batch.inventoryTxns}
              columns={[
                { key: 'date', header: 'Date', width: 110, render: (t) => fmtDate(t.date) },
                { key: 'item', header: 'Item', render: (t) => t.item.name },
                { key: 'qty', header: 'Qty', align: 'right', width: 90, render: (t) => `${t.qty} ${t.item.unit}` },
                { key: 'amountInr', header: 'Value', align: 'right', width: 110, render: (t) => money(t.amountInr) },
              ] as DataTableColumn<BatchDetail['inventoryTxns'][number]>[]}
              rowKey={(t) => t.id}
              dense
            />
          </Card>
        </>
      )}

      <FeedLoadModal open={modal === 'feed'} onClose={() => setModal(null)} batchId={id} onDone={invalidate} />
      <PickupModal open={modal === 'pickup'} onClose={() => setModal(null)} batch={batch} onDone={invalidate} />
      <IssueModal open={modal === 'issue'} onClose={() => setModal(null)} batchId={id} onDone={invalidate} />
      <CloseModal open={modal === 'close'} onClose={() => setModal(null)} batchId={id} onDone={invalidate} />
      <MortalityModal open={modal === 'mortality'} onClose={() => setModal(null)} batch={batch} onDone={invalidate} />
      <DailyEntryModal open={modal === 'daily'} onClose={() => setModal(null)} batchId={id} onDone={invalidate} />
      <FeedReturnModal open={modal === 'feedReturn'} onClose={() => setModal(null)} batch={batch} onDone={invalidate} />
      <VaccinationModal open={modal === 'vaccination'} onClose={() => setModal(null)} batchId={id} onDone={invalidate} />
    </div>
  );
}

function MortalityModal({ open, onClose, batch, onDone }: { open: boolean; onClose: () => void; batch: BatchDetail; onDone: () => void }) {
  const [form, setForm] = useState({ date: toDateInput(), birds: '', kind: 'DEATH', reason: '', notes: '' });
  const save = useMutation({
    mutationFn: () => api.post(`/poultry/batches/${batch.id}/mortality`, {
      date: form.date,
      birds: Number(form.birds),
      kind: form.kind,
      reason: form.reason || undefined,
      notes: form.notes || undefined,
    }),
    onSuccess: () => { toast.success('Recorded'); onClose(); setForm({ date: toDateInput(), birds: '', kind: 'DEATH', reason: '', notes: '' }); onDone(); },
    onError: (e) => toast.error(apiErrorMessage(e)),
  });
  return (
    <Modal open={open} onClose={onClose} title="Record mortality / adjustment"
      subtitle={`${batch.costing.currentBirds.toLocaleString('en-IN')} birds standing in ${batch.code}. Mortality % is always derived from these records.`}
      width={520}
      footer={(<><button className="btn-secondary" onClick={onClose}>Cancel</button>
        <button className="btn-primary" disabled={save.isPending || !form.birds || (form.kind === 'ADJUSTMENT' && !form.reason.trim())} onClick={() => save.mutate()}>
          {save.isPending ? 'Saving…' : 'Record'}
        </button></>)}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        <label className="label">Date
          <input className="input" type="date" value={form.date} onChange={(e) => setForm({ ...form, date: e.target.value })} />
        </label>
        <label className="label">Kind
          <select className="input" value={form.kind} onChange={(e) => setForm({ ...form, kind: e.target.value })}>
            <option value="DEATH">Death</option>
            <option value="CULL">Cull</option>
            <option value="ADJUSTMENT">Count adjustment (signed, audited)</option>
          </select>
        </label>
        <label className="label">{form.kind === 'ADJUSTMENT' ? 'Birds (± signed)' : 'Birds'}
          <input className="input" type="number" value={form.birds} onChange={(e) => setForm({ ...form, birds: e.target.value })} />
        </label>
        <label className="label">Reason{form.kind === 'ADJUSTMENT' ? ' (required)' : ''}
          <input className="input" value={form.reason} onChange={(e) => setForm({ ...form, reason: e.target.value })} placeholder={form.kind === 'ADJUSTMENT' ? 'Why the count moved' : 'Heat stress, disease…'} />
        </label>
        <label className="label">Notes
          <textarea className="input" rows={2} value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} />
        </label>
      </div>
    </Modal>
  );
}

function FeedLoadModal({ open, onClose, batchId, onDone }: { open: boolean; onClose: () => void; batchId: string; onDone: () => void }) {
  const [form, setForm] = useState({ supplierId: '', date: toDateInput(), stage: 'STARTER', bags: '', rate: '', invoiceNo: '', loadRef: '', payMode: 'CREDIT', ledgerCode: '' });
  const { data: suppliers } = useQuery({
    queryKey: ['py-feed-suppliers'],
    queryFn: async () => (await api.get<{ data: { id: string; name: string }[] }>('/poultry/suppliers', { params: { limit: 200 } })).data.data,
    enabled: open,
  });
  const { data: accounts } = useQuery({
    queryKey: ['py-accounts'],
    queryFn: async () => (await api.get<{ ledgerCode: string; name: string; kind: string }[]>('/poultry/accounts')).data,
    enabled: open && form.payMode !== 'CREDIT',
  });
  const save = useMutation({
    mutationFn: () => api.post('/poultry/feed-dispatches', {
      supplierId: form.supplierId, batchId, date: form.date, stage: form.stage,
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
        <button className="btn-primary" disabled={save.isPending || !form.supplierId || !form.bags} onClick={() => save.mutate()}>{save.isPending ? 'Saving…' : 'Record load'}</button></>)}>
      <FormSection title="The load">
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

function PickupModal({ open, onClose, batch, onDone }: { open: boolean; onClose: () => void; batch: BatchDetail; onDone: () => void }) {
  const [form, setForm] = useState({ date: toDateInput(), birds: '', weightKg: '', rate: '', deduction: '', deductionNote: '', partyId: '', stallId: '', completes: false });
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
  const save = useMutation({
    mutationFn: () => api.post('/poultry/pickups', {
      batchId: batch.id, date: form.date, birds: Number(form.birds), weightKg: Number(form.weightKg),
      ratePaisePerKg: Math.round(Number(form.rate || 0) * 100),
      deductionInr: form.deduction ? Number(form.deduction) : undefined,
      deductionNote: form.deductionNote || undefined,
      partyId: form.partyId || undefined, stallId: form.stallId || undefined,
      completesBatch: form.completes || undefined,
    }),
    onSuccess: () => { toast.success('Pickup recorded'); onClose(); onDone(); },
    onError: (e) => toast.error(apiErrorMessage(e)),
  });
  const remaining = batch.costing.currentBirds;
  return (
    <Modal open={open} onClose={onClose} title="Record pickup" subtitle={`${remaining.toLocaleString('en-IN')} birds remain in ${batch.code}`} width={640}
      footer={(<><button className="btn-secondary" onClick={onClose}>Cancel</button>
        <button className="btn-primary" disabled={save.isPending || !form.birds || !form.weightKg} onClick={() => save.mutate()}>{save.isPending ? 'Saving…' : 'Record pickup'}</button></>)}>
      <FormSection title="The catch">
        <Field label="Date" required><input className="input" type="date" value={form.date} onChange={(e) => setForm({ ...form, date: e.target.value })} /></Field>
        <Field label="Birds" required><input className="input" type="number" min={1} max={remaining} value={form.birds} onChange={(e) => setForm({ ...form, birds: e.target.value })} /></Field>
        <Field label="Weight (kg)" required><input className="input" type="number" min={0} step="0.1" value={form.weightKg} onChange={(e) => setForm({ ...form, weightKg: e.target.value })} /></Field>
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

function IssueModal({ open, onClose, batchId, onDone }: { open: boolean; onClose: () => void; batchId: string; onDone: () => void }) {
  const [form, setForm] = useState({ itemId: '', date: toDateInput(), qty: '' });
  const { data: items } = useQuery({
    queryKey: ['py-items-lite'],
    queryFn: async () => (await api.get<{ data: { id: string; name: string; unit: string; stockQty: number }[] }>('/poultry/inventory/items', { params: { limit: 200 } })).data.data,
    enabled: open,
  });
  const save = useMutation({
    mutationFn: () => api.post('/poultry/inventory/txns', {
      itemId: form.itemId, kind: 'ISSUE', date: form.date, qty: Number(form.qty), batchId,
    }),
    onSuccess: () => { toast.success('Issued to the batch'); onClose(); onDone(); },
    onError: (e) => toast.error(apiErrorMessage(e)),
  });
  const item = (items ?? []).find((i) => i.id === form.itemId);
  return (
    <Modal open={open} onClose={onClose} title="Issue medicine / material" subtitle="Moves stock from the central store onto this batch's cost sheet." width={520}
      footer={(<><button className="btn-secondary" onClick={onClose}>Cancel</button>
        <button className="btn-primary" disabled={save.isPending || !form.itemId || !form.qty} onClick={() => save.mutate()}>{save.isPending ? 'Issuing…' : 'Issue'}</button></>)}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        <label className="label">Item
          <select className="input" value={form.itemId} onChange={(e) => setForm({ ...form, itemId: e.target.value })}>
            <option value="">Choose…</option>
            {(items ?? []).map((i) => <option key={i.id} value={i.id}>{i.name} · {i.stockQty} {i.unit} in stock</option>)}
          </select>
        </label>
        <label className="label">Date
          <input className="input" type="date" value={form.date} onChange={(e) => setForm({ ...form, date: e.target.value })} />
        </label>
        <label className="label">Quantity{item ? ` (${item.unit})` : ''}
          <input className="input" type="number" min={0.01} step="0.01" value={form.qty} onChange={(e) => setForm({ ...form, qty: e.target.value })} />
        </label>
      </div>
    </Modal>
  );
}

function CloseModal({ open, onClose, batchId, onDone }: { open: boolean; onClose: () => void; batchId: string; onDone: () => void }) {
  const [reason, setReason] = useState('');
  const save = useMutation({
    mutationFn: () => api.post(`/poultry/batches/${batchId}/close`, { reason: reason || undefined }),
    onSuccess: () => { toast.success('Batch closed — costing frozen'); onClose(); onDone(); },
    onError: (e) => toast.error(apiErrorMessage(e)),
  });
  return (
    <Modal open={open} onClose={onClose} title="Close batch" subtitle="Freezes the cost sheet. Late costs after this need an adjustment." width={480}
      footer={(<><button className="btn-secondary" onClick={onClose}>Cancel</button>
        <button className="btn-danger" disabled={save.isPending} onClick={() => save.mutate()}>{save.isPending ? 'Closing…' : 'Close batch'}</button></>)}>
      <label className="label">Note
        <input className="input" value={reason} onChange={(e) => setReason(e.target.value)} placeholder="Optional closing note" />
      </label>
    </Modal>
  );
}

const OBS_KEYS = [
  { key: 'birdCondition', label: 'Bird condition' },
  { key: 'droppings', label: 'Droppings' },
  { key: 'feed', label: 'Feed' },
  { key: 'water', label: 'Water' },
] as const;

const EMPTY_DAILY_FORM = {
  date: '', avgWeightGrams: '', mortality: '', mortalityReason: '', feedBagsUsed: '', notes: '',
  birdCondition: '', droppings: '', feed: '', water: '',
};

function DailyEntryModal({ open, onClose, batchId, onDone }: { open: boolean; onClose: () => void; batchId: string; onDone: () => void }) {
  const qc = useQueryClient();
  const [form, setForm] = useState({ ...EMPTY_DAILY_FORM, date: toDateInput() });
  React.useEffect(() => { if (open) setForm({ ...EMPTY_DAILY_FORM, date: toDateInput() }); }, [open]);

  const save = useMutation({
    mutationFn: async () => {
      const observations: Record<string, string> = {};
      for (const { key } of OBS_KEYS) { if (form[key]) observations[key] = form[key]; }
      return api.post<{ birds: BirdRecon }>(`/poultry/batches/${batchId}/daily`, {
        date: form.date,
        avgWeightGrams: form.avgWeightGrams ? Number(form.avgWeightGrams) : undefined,
        mortality: form.mortality ? Number(form.mortality) : undefined,
        mortalityReason: form.mortalityReason || undefined,
        feedBagsUsed: form.feedBagsUsed ? Number(form.feedBagsUsed) : undefined,
        observations: Object.keys(observations).length ? observations : undefined,
        notes: form.notes || undefined,
      });
    },
    onSuccess: (res) => {
      toast.success(`Day recorded — ${res.data.birds.balance.toLocaleString('en-IN')} birds standing`);
      qc.invalidateQueries({ queryKey: ['py-batch-daily', batchId] });
      onClose(); onDone();
    },
    onError: (e) => toast.error(apiErrorMessage(e)),
  });

  return (
    <Modal open={open} onClose={onClose} title="Daily entry"
      subtitle="One row per day — weight, losses, feed used and how the shed looked." width={640}
      footer={(<><button className="btn-secondary" onClick={onClose}>Cancel</button>
        <button className="btn-primary" disabled={save.isPending || !form.date} onClick={() => save.mutate()}>{save.isPending ? 'Saving…' : 'Record day'}</button></>)}>
      <FormSection title="The day">
        <Field label="Date" required><input className="input" type="date" value={form.date} onChange={(e) => setForm({ ...form, date: e.target.value })} /></Field>
        <Field label="Average weight (grams)"><input className="input" type="number" min={0} value={form.avgWeightGrams} onChange={(e) => setForm({ ...form, avgWeightGrams: e.target.value })} /></Field>
        <Field label="Today's mortality"><input className="input" type="number" min={0} value={form.mortality} onChange={(e) => setForm({ ...form, mortality: e.target.value })} /></Field>
        <Field label="Mortality reason"><input className="input" value={form.mortalityReason} onChange={(e) => setForm({ ...form, mortalityReason: e.target.value })} placeholder="Heat stress, disease…" /></Field>
        <Field label="Feed bags used"><input className="input" type="number" min={0} step="0.5" value={form.feedBagsUsed} onChange={(e) => setForm({ ...form, feedBagsUsed: e.target.value })} /></Field>
      </FormSection>
      <FormSection title="Observations">
        {OBS_KEYS.map(({ key, label }) => (
          <Field key={key} label={label}>
            <select className="input" value={form[key]} onChange={(e) => setForm({ ...form, [key]: e.target.value })}>
              <option value="">Not checked</option>
              <option value="OK">OK</option>
              <option value="ATTENTION">Attention</option>
            </select>
          </Field>
        ))}
        <Field label="Notes" span={2}>
          <textarea className="input" rows={2} value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} />
        </Field>
      </FormSection>
    </Modal>
  );
}

const EMPTY_RETURN_FORM = { date: '', stage: 'STARTER', bags: '', returnToSupplier: false, dispatchId: '', reason: '' };

function FeedReturnModal({ open, onClose, batch, onDone }: { open: boolean; onClose: () => void; batch: BatchDetail; onDone: () => void }) {
  const [form, setForm] = useState({ ...EMPTY_RETURN_FORM, date: toDateInput() });
  React.useEffect(() => { if (open) setForm({ ...EMPTY_RETURN_FORM, date: toDateInput() }); }, [open]);

  const save = useMutation({
    mutationFn: () => api.post(`/poultry/batches/${batch.id}/feed-returns`, {
      date: form.date,
      stage: form.stage,
      bags: Number(form.bags),
      returnToSupplier: form.returnToSupplier || undefined,
      dispatchId: form.returnToSupplier && form.dispatchId ? form.dispatchId : undefined,
      reason: form.reason || undefined,
    }),
    onSuccess: () => { toast.success('Feed return recorded'); onClose(); onDone(); },
    onError: (e) => toast.error(apiErrorMessage(e)),
  });

  return (
    <Modal open={open} onClose={onClose} title="Return feed"
      subtitle="Takes the bags off this batch's cost sheet." width={560}
      footer={(<><button className="btn-secondary" onClick={onClose}>Cancel</button>
        <button className="btn-primary" disabled={save.isPending || !form.bags} onClick={() => save.mutate()}>{save.isPending ? 'Saving…' : 'Record return'}</button></>)}>
      <FormSection title="The return">
        <Field label="Date" required><input className="input" type="date" value={form.date} onChange={(e) => setForm({ ...form, date: e.target.value })} /></Field>
        <Field label="Stage" required>
          <select className="input" value={form.stage} onChange={(e) => setForm({ ...form, stage: e.target.value })}>
            {FEED_STAGES.map((s) => <option key={s} value={s}>{humanStatus(s)}</option>)}
          </select>
        </Field>
        <Field label="Bags" required><input className="input" type="number" min={0.5} step="0.5" value={form.bags} onChange={(e) => setForm({ ...form, bags: e.target.value })} /></Field>
        <Field label="Destination">
          <label style={{ display: 'flex', gap: 8, alignItems: 'center', fontSize: 13, minHeight: 34 }}>
            <input type="checkbox" checked={form.returnToSupplier} onChange={(e) => setForm({ ...form, returnToSupplier: e.target.checked, dispatchId: '' })} />
            Send back to the supplier
          </label>
        </Field>
        {form.returnToSupplier && (
          <Field label="Against load" hint="Names the supplier the bags go back to" span={2}>
            <select className="input" value={form.dispatchId} onChange={(e) => setForm({ ...form, dispatchId: e.target.value })}>
              <option value="">Not against a specific load</option>
              {batch.feedDispatches.map((d) => <option key={d.id} value={d.id}>{`${d.reference} · ${humanStatus(d.stage)} · ${d.bags} bags`}</option>)}
            </select>
          </Field>
        )}
        <Field label="Reason" span={2}>
          <input className="input" value={form.reason} onChange={(e) => setForm({ ...form, reason: e.target.value })} placeholder="Batch completed early, damp bags…" />
        </Field>
      </FormSection>
    </Modal>
  );
}

const EMPTY_VACC_FORM = { date: '', scheduleItemId: '', itemId: '', qty: '', dose: '', notes: '' };

function VaccinationModal({ open, onClose, batchId, onDone }: { open: boolean; onClose: () => void; batchId: string; onDone: () => void }) {
  const [form, setForm] = useState({ ...EMPTY_VACC_FORM, date: toDateInput() });
  React.useEffect(() => { if (open) setForm({ ...EMPTY_VACC_FORM, date: toDateInput() }); }, [open]);

  const { data: schedule } = useQuery({
    queryKey: ['py-vaccine-schedule'],
    queryFn: async () => (await api.get<{ id: string; name: string; dayDue: number; dose?: string | null; isActive: boolean }[]>('/poultry/vaccine-schedule')).data,
    enabled: open,
  });
  const { data: items } = useQuery({
    queryKey: ['py-items-lite'],
    queryFn: async () => (await api.get<{ data: { id: string; name: string; unit: string; stockQty: number; category: string }[] }>('/poultry/inventory/items', { params: { limit: 200 } })).data.data,
    enabled: open,
  });
  const issuable = (items ?? []).filter((i) => i.category === 'VACCINE' || i.category === 'MEDICINE');
  const item = issuable.find((i) => i.id === form.itemId);

  const save = useMutation({
    mutationFn: () => api.post(`/poultry/batches/${batchId}/vaccinations`, {
      date: form.date,
      scheduleItemId: form.scheduleItemId || undefined,
      itemId: form.itemId || undefined,
      qty: form.itemId && form.qty ? Number(form.qty) : undefined,
      dose: form.dose || undefined,
      notes: form.notes || undefined,
    }),
    onSuccess: () => { toast.success('Vaccination recorded'); onClose(); onDone(); },
    onError: (e) => toast.error(apiErrorMessage(e)),
  });

  return (
    <Modal open={open} onClose={onClose} title="Record vaccination"
      subtitle="Issuing from the store also puts the dose on the batch's cost sheet." width={560}
      footer={(<><button className="btn-secondary" onClick={onClose}>Cancel</button>
        <button className="btn-primary" disabled={save.isPending || !form.date} onClick={() => save.mutate()}>{save.isPending ? 'Saving…' : 'Record'}</button></>)}>
      <FormSection title="The dose">
        <Field label="Date" required><input className="input" type="date" value={form.date} onChange={(e) => setForm({ ...form, date: e.target.value })} /></Field>
        <Field label="Programme item">
          <select className="input" value={form.scheduleItemId} onChange={(e) => setForm({ ...form, scheduleItemId: e.target.value })}>
            <option value="">Off-programme</option>
            {(schedule ?? []).map((s) => <option key={s.id} value={s.id}>{`${s.name} · day ${s.dayDue}`}</option>)}
          </select>
        </Field>
        <Field label="Issue from store" hint="Moves stock and cost onto the batch">
          <select className="input" value={form.itemId} onChange={(e) => setForm({ ...form, itemId: e.target.value })}>
            <option value="">Nothing issued</option>
            {issuable.map((i) => <option key={i.id} value={i.id}>{`${i.name} · ${i.stockQty} ${i.unit} in stock`}</option>)}
          </select>
        </Field>
        {form.itemId && (
          <Field label={`Quantity${item ? ` (${item.unit})` : ''}`} required>
            <input className="input" type="number" min={0.01} step="0.01" value={form.qty} onChange={(e) => setForm({ ...form, qty: e.target.value })} />
          </Field>
        )}
        <Field label="Dose"><input className="input" value={form.dose} onChange={(e) => setForm({ ...form, dose: e.target.value })} placeholder="0.5ml via drinking water" /></Field>
        <Field label="Notes" span={2}>
          <input className="input" value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} />
        </Field>
      </FormSection>
    </Modal>
  );
}
