'use client';

/**
 * Field operations: what a shed asked for, what was sent, what came back, and
 * the work that was paid for.
 *
 * The screen is built around the rule the business is most emphatic about —
 * ISSUED IS NOT CONSUMED. So the consumption column is issued minus returned
 * everywhere, and the returns are as prominent as the issues.
 */

import React, { useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { HardHat, PackageOpen, Undo2 } from 'lucide-react';
import { toast } from 'sonner';
import { api } from '@/lib/api';
import {
  Badge, Card, DataTable, EmptyState, Field, FormSection, Modal, SectionTitle, Segmented,
  Skeleton, StatCard, type DataTableColumn, type Tone,
} from '../ui/kit';
import { PageHead, fmtDate, money } from '../ui/common';

interface RequestItem { id: string; itemId: string | null; description: string; uom: string; qty: number; issuedQty: number; returnedQty: number }
interface FarmRequest {
  id: string; batchId: string; reference: string; kind: string; status: string; neededOn: string | null; notes: string | null;
  batch: { code: string; farm: { id: string; name: string } };
  items: RequestItem[];
}
interface Issue {
  id: string; reference: string; direction: string; date: string;
  request?: { reference: string; kind: string } | null;
  lines: { id: string; description: string; uom: string; qty: number; valueInr: number; batchNo: string | null }[];
}
interface LabourRate { id: string; code: string; name: string; workType: string; uom: string; ratePaisePerUnit: number; isActive: boolean }
interface LabourEntry {
  id: string; reference: string; date: string; crew: string | null; workers: number;
  quantity: number; ratePaisePerUnit: number; amountInr: number; status: string;
  rate: { code: string; name: string; uom: string; workType: string };
}
interface BatchOption { id: string; code: string; farm?: { name: string } | null }
interface Item { id: string; code: string; name: string; uom: string; onHandQty: number }

const VIEWS = ['Requests', 'Movements', 'Labour'];

const statusTone = (s: string): Tone =>
  s === 'APPROVED' || s === 'ISSUED' || s === 'VERIFIED' || s === 'PAID' ? 'active'
    : s === 'REJECTED' || s === 'CANCELLED' ? 'expired'
      : s === 'SUBMITTED' || s === 'PENDING' ? 'renewal' : 'info';

const today = () => new Date().toISOString().slice(0, 10);

export function FieldOpsScreen() {
  const qc = useQueryClient();
  const [view, setView] = useState(VIEWS[0]);
  const [requestOpen, setRequestOpen] = useState(false);
  const [issuing, setIssuing] = useState<FarmRequest | null>(null);
  const [returning, setReturning] = useState(false);
  const [labourOpen, setLabourOpen] = useState(false);
  const [ratesOpen, setRatesOpen] = useState(false);

  const requests = useQuery({
    queryKey: ['py', 'farm-requests'],
    queryFn: async () => (await api.get<FarmRequest[]>('/poultry/farm-requests')).data,
  });
  const issues = useQuery({
    queryKey: ['py', 'farm-issues'],
    queryFn: async () => (await api.get<Issue[]>('/poultry/farm-issues')).data,
    enabled: view === 'Movements',
  });
  const labour = useQuery({
    queryKey: ['py', 'labour'],
    queryFn: async () => (await api.get<LabourEntry[]>('/poultry/labour')).data,
    enabled: view === 'Labour',
  });
  const rates = useQuery({
    queryKey: ['py', 'labour-rates'],
    queryFn: async () => (await api.get<LabourRate[]>('/poultry/labour-rates')).data,
    enabled: view === 'Labour' || labourOpen || ratesOpen,
  });

  const invalidate = () => qc.invalidateQueries({ queryKey: ['py'] });
  const decide = useMutation({
    mutationFn: async ({ id, approve }: { id: string; approve: boolean }) =>
      (await api.post(`/poultry/farm-requests/${id}/${approve ? 'approve' : 'reject'}`, {})).data,
    onSuccess: (_d, v) => { toast.success(v.approve ? 'Request approved' : 'Request rejected'); invalidate(); },
    onError: (e: any) => toast.error(e?.response?.data?.message ?? 'Could not decide'),
  });
  const verify = useMutation({
    mutationFn: async (id: string) => (await api.post(`/poultry/labour/${id}/verify`, {})).data,
    onSuccess: () => { toast.success('Work verified and posted'); invalidate(); },
    onError: (e: any) => toast.error(e?.response?.data?.message ?? 'Could not verify'),
  });

  const pendingLabourInr = (labour.data ?? []).filter((l) => l.status === 'PENDING').reduce((s, l) => s + l.amountInr, 0);

  return (
    <div className="ds-page">
      <PageHead
        title="Field operations"
        subtitle="What the shed asked for, what went out, what came back, and the work that was paid for. Consumption is always issued minus returned."
        actions={(
          <>
            <button className="btn-secondary" onClick={() => { setReturning(true); setIssuing(null); }}>Record a return</button>
            <button className="btn-primary" onClick={() => setRequestOpen(true)}>New request</button>
          </>
        )}
      />

      <div style={{ marginBottom: 14 }}>
        <Segmented options={VIEWS} value={view} onChange={setView} />
      </div>

      {view === 'Requests' && (requests.isLoading ? <Skeleton rows={3} /> : (requests.data ?? []).length === 0 ? (
        <Card>
          <EmptyState
            icon={PackageOpen}
            title="No farm requests"
            body="A supervisor raises one for feed, medicine, vaccine or a supplement. Somebody else approves it — never the person who raised it."
            actionLabel="New request"
            onAction={() => setRequestOpen(true)}
          />
        </Card>
      ) : (
        <Card flush>
          <DataTable
            columns={[
              { key: 'reference', header: 'Request', sortable: true, render: (r: FarmRequest) => (
                <div>
                  <div style={{ fontWeight: 600 }}>{r.reference}</div>
                  <div className="ds-caption">{r.batch.code} · {r.batch.farm.name}</div>
                </div>
              ) },
              { key: 'kind', header: 'For', sortable: true, render: (r: FarmRequest) => r.kind },
              { key: 'lines', header: 'Lines', align: 'right', render: (r: FarmRequest) => String(r.items.length) },
              { key: 'progress', header: 'Issued', align: 'right', render: (r: FarmRequest) => {
                const asked = r.items.reduce((s, i) => s + i.qty, 0);
                const out = r.items.reduce((s, i) => s + i.issuedQty, 0);
                const back = r.items.reduce((s, i) => s + i.returnedQty, 0);
                return (
                  <div>
                    <div style={{ fontVariantNumeric: 'tabular-nums' }}>{out} / {asked}</div>
                    {back > 0 && <div className="ds-caption">{back} returned</div>}
                  </div>
                );
              } },
              { key: 'neededOn', header: 'Needed', sortable: true, render: (r: FarmRequest) => fmtDate(r.neededOn) },
              { key: 'status', header: 'Status', render: (r: FarmRequest) => <Badge tone={statusTone(r.status)}>{r.status.replace(/_/g, ' ').toLowerCase()}</Badge> },
              { key: 'actions', header: '', render: (r: FarmRequest) => (
                r.status === 'SUBMITTED' ? (
                  <div style={{ display: 'flex', gap: 6 }}>
                    <button className="btn-primary" onClick={() => decide.mutate({ id: r.id, approve: true })}>Approve</button>
                    <button className="btn-secondary" onClick={() => decide.mutate({ id: r.id, approve: false })}>Reject</button>
                  </div>
                ) : r.status === 'APPROVED' || r.status === 'PARTIALLY_ISSUED' ? (
                  <button className="btn-primary" onClick={() => setIssuing(r)}>Issue</button>
                ) : null
              ) },
            ] as DataTableColumn<FarmRequest>[]}
            rows={requests.data ?? []}
            rowKey={(r) => r.id}
          />
          <p className="ds-caption" style={{ padding: '12px 16px', borderTop: '1px solid var(--hairline-soft)' }}>
            Approving your own request is refused by the server, not merely hidden here.
          </p>
        </Card>
      ))}

      {view === 'Movements' && (issues.isLoading ? <Skeleton rows={3} /> : (
        <Card flush>
          <DataTable
            columns={[
              { key: 'reference', header: 'Document', sortable: true, render: (r: Issue) => <span style={{ fontWeight: 600 }}>{r.reference}</span> },
              { key: 'direction', header: '', render: (r: Issue) => (
                r.direction === 'ISSUE'
                  ? <Badge tone="info">to the shed</Badge>
                  : <Badge tone="active">back to store</Badge>
              ) },
              { key: 'date', header: 'Date', sortable: true, render: (r: Issue) => fmtDate(r.date) },
              { key: 'request', header: 'Against', render: (r: Issue) => r.request?.reference ?? <span className="ds-caption">direct</span> },
              { key: 'lines', header: 'Items', align: 'right', render: (r: Issue) => String(r.lines.length) },
              { key: 'qty', header: 'Quantity', align: 'right', render: (r: Issue) => String(r.lines.reduce((s, l) => s + l.qty, 0)) },
              { key: 'value', header: 'Value', align: 'right', render: (r: Issue) => money(r.lines.reduce((s, l) => s + l.valueInr, 0)) },
            ] as DataTableColumn<Issue>[]}
            rows={issues.data ?? []}
            rowKey={(r) => r.id}
            empty="Nothing has gone out to a shed yet."
          />
          <p className="ds-caption" style={{ padding: '12px 16px', borderTop: '1px solid var(--hairline-soft)' }}>
            Bags that came back unopened were never eaten. Costing them would inflate the cycle&apos;s FCR and,
            because the incentive is paid on FCR, quietly underpay the farmer.
          </p>
        </Card>
      ))}

      {view === 'Labour' && (labour.isLoading ? <Skeleton rows={3} /> : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          <div className="ds-grid ds-grid-kpi">
            <StatCard label="Awaiting verification" value={money(pendingLabourInr)} hint="unposted until somebody confirms the work happened" tone={pendingLabourInr > 0 ? 'renewal' : 'neutral'} />
            <StatCard label="Rates configured" value={String((rates.data ?? []).filter((r) => r.isActive).length)} hint="₹ per unit handled" onClick={() => setRatesOpen(true)} />
          </div>
          <Card flush>
            <div style={{ padding: '14px 16px 0', display: 'flex', gap: 8, alignItems: 'baseline' }}>
              <SectionTitle sub="Paid for what was handled, not for hours present — the HR module already owns the hours.">
                Work recorded
              </SectionTitle>
              <button className="btn-primary" style={{ marginLeft: 'auto' }} onClick={() => setLabourOpen(true)}>Record work</button>
            </div>
            <DataTable
              columns={[
                { key: 'reference', header: 'Entry', sortable: true, render: (r: LabourEntry) => <span style={{ fontWeight: 600 }}>{r.reference}</span> },
                { key: 'date', header: 'Date', sortable: true, render: (r: LabourEntry) => fmtDate(r.date) },
                { key: 'work', header: 'Work', render: (r: LabourEntry) => (
                  <div>
                    <div>{r.rate.name}</div>
                    <div className="ds-caption">{r.crew ?? '—'}{r.workers ? ` · ${r.workers} workers` : ''}</div>
                  </div>
                ) },
                { key: 'quantity', header: 'Handled', align: 'right', render: (r: LabourEntry) => `${r.quantity} ${r.rate.uom}` },
                { key: 'rate', header: 'Rate', align: 'right', render: (r: LabourEntry) => `₹${(r.ratePaisePerUnit / 100).toFixed(2)}` },
                { key: 'amountInr', header: 'Amount', align: 'right', sortable: true, render: (r: LabourEntry) => money(r.amountInr) },
                { key: 'status', header: 'Status', render: (r: LabourEntry) => <Badge tone={statusTone(r.status)}>{r.status.toLowerCase()}</Badge> },
                { key: 'actions', header: '', render: (r: LabourEntry) => (
                  r.status === 'PENDING' ? <button className="btn-primary" onClick={() => verify.mutate(r.id)}>Verify</button> : null
                ) },
              ] as DataTableColumn<LabourEntry>[]}
              rows={labour.data ?? []}
              rowKey={(r) => r.id}
              empty="No work recorded."
            />
            <p className="ds-caption" style={{ padding: '12px 16px', borderTop: '1px solid var(--hairline-soft)' }}>
              The rate is snapshotted onto the entry, so raising it next month never re-prices work already done.
            </p>
          </Card>
        </div>
      ))}

      <RequestModal open={requestOpen} onClose={() => setRequestOpen(false)} onSaved={invalidate} />
      <IssueModal
        request={issuing}
        returning={returning}
        onClose={() => { setIssuing(null); setReturning(false); }}
        onSaved={invalidate}
      />
      <LabourModal open={labourOpen} onClose={() => setLabourOpen(false)} rates={rates.data ?? []} onSaved={invalidate} />
      <RatesModal open={ratesOpen} onClose={() => setRatesOpen(false)} rates={rates.data ?? []} onSaved={invalidate} />
    </div>
  );
}

function useBatches(enabled: boolean) {
  return useQuery({
    queryKey: ['py', 'batches', 'active'],
    queryFn: async () => {
      const r = await api.get<any>('/poultry/batches', { params: { status: 'ACTIVE', limit: 200 } });
      return (r.data?.data ?? r.data ?? []) as BatchOption[];
    },
    enabled,
  });
}

function useItems(enabled: boolean) {
  return useQuery({
    queryKey: ['core', 'items'],
    queryFn: async () => (await api.get<Item[]>('/core/items', { params: { status: 'active' } })).data,
    enabled,
  });
}

function RequestModal({ open, onClose, onSaved }: { open: boolean; onClose: () => void; onSaved: () => void }) {
  const [batchId, setBatchId] = useState('');
  const [kind, setKind] = useState('FEED');
  const [neededOn, setNeededOn] = useState('');
  const [lines, setLines] = useState([{ itemId: '', description: '', uom: 'bag', qty: '' }]);
  const batches = useBatches(open);
  const items = useItems(open);

  const save = useMutation({
    mutationFn: async () => (await api.post('/poultry/farm-requests', {
      batchId, kind, neededOn: neededOn || undefined,
      items: lines.filter((l) => (l.description.trim() || l.itemId) && Number(l.qty) > 0).map((l) => ({
        itemId: l.itemId || undefined,
        description: l.description.trim() || (items.data ?? []).find((i) => i.id === l.itemId)?.name || 'Item',
        uom: l.uom, qty: Number(l.qty),
      })),
    })).data,
    onSuccess: () => { toast.success('Request submitted'); setLines([{ itemId: '', description: '', uom: 'bag', qty: '' }]); onSaved(); onClose(); },
    onError: (e: any) => toast.error(e?.response?.data?.message ?? 'Could not submit'),
  });

  return (
    <Modal
      open={open} onClose={onClose} title="Farm request" width={860}
      subtitle="For the shed, from the store. Somebody other than you approves it."
      footer={(
        <>
          <button className="btn-secondary" onClick={onClose}>Cancel</button>
          <button className="btn-primary" disabled={save.isPending || !batchId || !lines.some((l) => Number(l.qty) > 0)} onClick={() => save.mutate()}>
            {save.isPending ? 'Submitting…' : 'Submit'}
          </button>
        </>
      )}
    >
      <FormSection title="Request">
        <Field label="Batch" required>
          <select className="input" value={batchId} onChange={(e) => setBatchId(e.target.value)}>
            <option value="">Choose…</option>
            {(batches.data ?? []).map((b) => <option key={b.id} value={b.id}>{b.code}{b.farm ? ` · ${b.farm.name}` : ''}</option>)}
          </select>
        </Field>
        <Field label="For">
          <select className="input" value={kind} onChange={(e) => setKind(e.target.value)}>
            {['FEED', 'MEDICINE', 'VACCINE', 'SUPPLEMENT', 'CONSUMABLE'].map((k) => <option key={k} value={k}>{k.toLowerCase()}</option>)}
          </select>
        </Field>
        <Field label="Needed on"><input className="input" type="date" value={neededOn} onChange={(e) => setNeededOn(e.target.value)} /></Field>
      </FormSection>
      <FormSection title="Lines">
        <div style={{ gridColumn: '1 / -1', display: 'flex', flexDirection: 'column', gap: 8 }}>
          {lines.map((l, i) => (
            <div key={i} style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
              <select
                className="input" style={{ flex: 2, minWidth: 200 }}
                value={l.itemId}
                onChange={(e) => {
                  const it = (items.data ?? []).find((x) => x.id === e.target.value);
                  setLines(lines.map((x, j) => (j === i ? { ...x, itemId: e.target.value, description: it?.name ?? x.description, uom: it?.uom ?? x.uom } : x)));
                }}
              >
                <option value="">Free text…</option>
                {(items.data ?? []).map((it) => <option key={it.id} value={it.id}>{it.name} ({it.onHandQty} {it.uom})</option>)}
              </select>
              {!l.itemId && (
                <input className="input" style={{ flex: 2, minWidth: 160 }} placeholder="Description" value={l.description} onChange={(e) => setLines(lines.map((x, j) => (j === i ? { ...x, description: e.target.value } : x)))} />
              )}
              <input className="input" style={{ width: 90 }} placeholder="Unit" value={l.uom} onChange={(e) => setLines(lines.map((x, j) => (j === i ? { ...x, uom: e.target.value } : x)))} />
              <input className="input" style={{ width: 110 }} type="number" step="0.001" placeholder="Qty" value={l.qty} onChange={(e) => setLines(lines.map((x, j) => (j === i ? { ...x, qty: e.target.value } : x)))} />
              <button className="btn-secondary" disabled={lines.length === 1} onClick={() => setLines(lines.filter((_, j) => j !== i))}>−</button>
            </div>
          ))}
          <button className="btn-secondary" style={{ alignSelf: 'flex-start' }} onClick={() => setLines([...lines, { itemId: '', description: '', uom: 'bag', qty: '' }])}>Add a line</button>
        </div>
      </FormSection>
    </Modal>
  );
}

function IssueModal({ request, returning, onClose, onSaved }: {
  request: FarmRequest | null; returning: boolean; onClose: () => void; onSaved: () => void;
}) {
  const open = !!request || returning;
  const [batchId, setBatchId] = useState('');
  const [date, setDate] = useState(today());
  const [reason, setReason] = useState('');
  const [rows, setRows] = useState<Record<string, string>>({});
  const [freeLines, setFreeLines] = useState([{ itemId: '', description: '', uom: 'bag', qty: '', batchNo: '' }]);
  const batches = useBatches(open);
  const items = useItems(open);

  React.useEffect(() => {
    if (request) {
      setBatchId('');
      setRows(Object.fromEntries(request.items.map((i) => [i.id, String(Math.max(0, i.qty - i.issuedQty))])));
    }
  }, [request]);

  const save = useMutation({
    mutationFn: async () => {
      const body = request
        ? {
          batchId: request.batchId,
          requestId: request.id,
          direction: 'ISSUE',
          date,
          lines: request.items
            .filter((i) => Number(rows[i.id]) > 0)
            .map((i) => ({ requestItemId: i.id, itemId: i.itemId ?? undefined, description: i.description, uom: i.uom, qty: Number(rows[i.id]) })),
        }
        : {
          batchId,
          direction: 'RETURN',
          date,
          reason: reason || undefined,
          lines: freeLines.filter((l) => Number(l.qty) > 0).map((l) => ({
            itemId: l.itemId || undefined,
            description: l.description.trim() || (items.data ?? []).find((i) => i.id === l.itemId)?.name || 'Item',
            uom: l.uom, qty: Number(l.qty), batchNo: l.batchNo || undefined,
          })),
        };
      return (await api.post('/poultry/farm-issues', body)).data;
    },
    onSuccess: () => { toast.success(returning ? 'Return recorded — stock is back' : 'Issued to the shed'); onSaved(); onClose(); },
    onError: (e: any) => toast.error(e?.response?.data?.message ?? 'Could not record the movement'),
  });

  if (!open) return null;
  return (
    <Modal
      open={open}
      onClose={onClose}
      title={returning ? 'Record a return' : `Issue against ${request!.reference}`}
      width={820}
      subtitle={returning
        ? 'Bags that came back unopened were never eaten. Recording the return is what keeps the cycle’s FCR honest.'
        : 'Stock leaves the store through the shared inventory engine, and the cost lands on this farm’s cost centre.'}
      footer={(
        <>
          <button className="btn-secondary" onClick={onClose}>Cancel</button>
          <button className="btn-primary" disabled={save.isPending || (returning && !batchId)} onClick={() => save.mutate()}>
            {save.isPending ? 'Recording…' : returning ? 'Record return' : 'Issue'}
          </button>
        </>
      )}
    >
      {returning ? (
        <>
          <FormSection title="Return">
            <Field label="Batch" required>
              <select className="input" value={batchId} onChange={(e) => setBatchId(e.target.value)}>
                <option value="">Choose…</option>
                {(batches.data ?? []).map((b) => <option key={b.id} value={b.id}>{b.code}{b.farm ? ` · ${b.farm.name}` : ''}</option>)}
              </select>
            </Field>
            <Field label="Date" required><input className="input" type="date" value={date} onChange={(e) => setDate(e.target.value)} /></Field>
            <Field label="Reason" span={2}><input className="input" value={reason} onChange={(e) => setReason(e.target.value)} placeholder="Unused at cycle end" /></Field>
          </FormSection>
          <FormSection title="Coming back">
            <div style={{ gridColumn: '1 / -1', display: 'flex', flexDirection: 'column', gap: 8 }}>
              {freeLines.map((l, i) => (
                <div key={i} style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                  <select className="input" style={{ flex: 2, minWidth: 200 }} value={l.itemId} onChange={(e) => setFreeLines(freeLines.map((x, j) => (j === i ? { ...x, itemId: e.target.value } : x)))}>
                    <option value="">Free text…</option>
                    {(items.data ?? []).map((it) => <option key={it.id} value={it.id}>{it.name}</option>)}
                  </select>
                  <input className="input" style={{ width: 90 }} placeholder="Unit" value={l.uom} onChange={(e) => setFreeLines(freeLines.map((x, j) => (j === i ? { ...x, uom: e.target.value } : x)))} />
                  <input className="input" style={{ width: 110 }} type="number" step="0.001" placeholder="Qty" value={l.qty} onChange={(e) => setFreeLines(freeLines.map((x, j) => (j === i ? { ...x, qty: e.target.value } : x)))} />
                  <input className="input" style={{ width: 130 }} placeholder="Batch no" value={l.batchNo} onChange={(e) => setFreeLines(freeLines.map((x, j) => (j === i ? { ...x, batchNo: e.target.value } : x)))} />
                  <button className="btn-secondary" disabled={freeLines.length === 1} onClick={() => setFreeLines(freeLines.filter((_, j) => j !== i))}>−</button>
                </div>
              ))}
              <button className="btn-secondary" style={{ alignSelf: 'flex-start' }} onClick={() => setFreeLines([...freeLines, { itemId: '', description: '', uom: 'bag', qty: '', batchNo: '' }])}>Add a line</button>
            </div>
          </FormSection>
        </>
      ) : (
        <>
          <FormSection title="Issue">
            <Field label="Date" required><input className="input" type="date" value={date} onChange={(e) => setDate(e.target.value)} /></Field>
          </FormSection>
          <FormSection title="Lines">
            <div style={{ gridColumn: '1 / -1', display: 'flex', flexDirection: 'column', gap: 10 }}>
              {request!.items.map((i) => (
                <div key={i.id} style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
                  <div style={{ flex: 2, minWidth: 200 }}>
                    <div style={{ fontWeight: 600 }}>{i.description}</div>
                    <div className="ds-caption">
                      {i.qty} {i.uom} asked · {i.issuedQty} issued
                      {i.returnedQty > 0 ? ` · ${i.returnedQty} returned` : ''}
                    </div>
                  </div>
                  <input
                    className="input" style={{ width: 130 }} type="number" step="0.001"
                    value={rows[i.id] ?? ''}
                    onChange={(e) => setRows({ ...rows, [i.id]: e.target.value })}
                  />
                </div>
              ))}
            </div>
          </FormSection>
        </>
      )}
    </Modal>
  );
}

function LabourModal({ open, onClose, rates, onSaved }: {
  open: boolean; onClose: () => void; rates: LabourRate[]; onSaved: () => void;
}) {
  const [rateId, setRateId] = useState('');
  const [date, setDate] = useState(today());
  const [batchId, setBatchId] = useState('');
  const [crew, setCrew] = useState('');
  const [workers, setWorkers] = useState('');
  const [quantity, setQuantity] = useState('');
  const batches = useBatches(open);
  const rate = rates.find((r) => r.id === rateId);
  const amount = rate && quantity ? Math.round((Number(quantity) * rate.ratePaisePerUnit) / 100) : 0;

  const save = useMutation({
    mutationFn: async () => (await api.post('/poultry/labour', {
      rateId, date, batchId: batchId || undefined,
      crew: crew || undefined, workers: workers ? Number(workers) : undefined,
      quantity: Number(quantity),
    })).data,
    onSuccess: () => { toast.success('Work recorded — it posts on verification'); setQuantity(''); onSaved(); onClose(); },
    onError: (e: any) => toast.error(e?.response?.data?.message ?? 'Could not record'),
  });

  return (
    <Modal
      open={open} onClose={onClose} title="Record work" width={720}
      subtitle="Quantity handled × the configured rate. Nothing posts until somebody other than you verifies it happened."
      footer={(
        <>
          <button className="btn-secondary" onClick={onClose}>Cancel</button>
          <button className="btn-primary" disabled={save.isPending || !rateId || !Number(quantity)} onClick={() => save.mutate()}>
            {save.isPending ? 'Recording…' : `Record · ${money(amount)}`}
          </button>
        </>
      )}
    >
      <FormSection title="Work">
        <Field label="Rate" required>
          <select className="input" value={rateId} onChange={(e) => setRateId(e.target.value)}>
            <option value="">Choose…</option>
            {rates.filter((r) => r.isActive).map((r) => (
              <option key={r.id} value={r.id}>{r.name} — ₹{(r.ratePaisePerUnit / 100).toFixed(2)}/{r.uom}</option>
            ))}
          </select>
        </Field>
        <Field label="Date" required><input className="input" type="date" value={date} onChange={(e) => setDate(e.target.value)} /></Field>
        <Field label={`Quantity${rate ? ` (${rate.uom})` : ''}`} required hint={rate ? `${quantity || 0} × ₹${(rate.ratePaisePerUnit / 100).toFixed(2)} = ${money(amount)}` : undefined}>
          <input className="input" type="number" step="0.001" value={quantity} onChange={(e) => setQuantity(e.target.value)} placeholder="500" />
        </Field>
        <Field label="Batch">
          <select className="input" value={batchId} onChange={(e) => setBatchId(e.target.value)}>
            <option value="">—</option>
            {(batches.data ?? []).map((b) => <option key={b.id} value={b.id}>{b.code}</option>)}
          </select>
        </Field>
        <Field label="Crew"><input className="input" value={crew} onChange={(e) => setCrew(e.target.value)} placeholder="Ravi's gang" /></Field>
        <Field label="Workers"><input className="input" type="number" value={workers} onChange={(e) => setWorkers(e.target.value)} /></Field>
      </FormSection>
    </Modal>
  );
}

function RatesModal({ open, onClose, rates, onSaved }: {
  open: boolean; onClose: () => void; rates: LabourRate[]; onSaved: () => void;
}) {
  const [name, setName] = useState('');
  const [workType, setWorkType] = useState('LOADING');
  const [uom, setUom] = useState('bag');
  const [rupees, setRupees] = useState('');
  const save = useMutation({
    mutationFn: async () => (await api.post('/poultry/labour-rates', {
      name: name.trim(), workType, uom, ratePaisePerUnit: Math.round(Number(rupees) * 100),
    })).data,
    onSuccess: () => { toast.success('Rate saved'); setName(''); setRupees(''); onSaved(); },
    onError: (e: any) => toast.error(e?.response?.data?.message ?? 'Could not save'),
  });
  return (
    <Modal
      open={open} onClose={onClose} title="Labour rates" width={760}
      subtitle="₹8 a bag lives here, not in code — the business changes it without a deploy."
      footer={<button className="btn-secondary" onClick={onClose}>Close</button>}
    >
      <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginBottom: 16 }}>
        {rates.map((r) => (
          <div key={r.id} style={{ display: 'flex', gap: 10, alignItems: 'baseline' }}>
            <HardHat size={14} style={{ color: 'var(--ink-3)' }} />
            <span style={{ fontWeight: 600 }}>{r.name}</span>
            <span className="ds-caption">{r.workType.toLowerCase()} · ₹{(r.ratePaisePerUnit / 100).toFixed(2)}/{r.uom}</span>
            {!r.isActive && <Badge tone="neutral">inactive</Badge>}
          </div>
        ))}
        {rates.length === 0 && <p className="ds-caption">No rates configured yet.</p>}
      </div>
      <FormSection title="Add a rate">
        <Field label="Name" required><input className="input" value={name} onChange={(e) => setName(e.target.value)} placeholder="Feed unloading — per bag" /></Field>
        <Field label="Work type">
          <select className="input" value={workType} onChange={(e) => setWorkType(e.target.value)}>
            {['LOADING', 'UNLOADING', 'CATCHING', 'CLEANING', 'OTHER'].map((w) => <option key={w} value={w}>{w.toLowerCase()}</option>)}
          </select>
        </Field>
        <Field label="Unit"><input className="input" value={uom} onChange={(e) => setUom(e.target.value)} placeholder="bag" /></Field>
        <Field label="Rate (₹ per unit)" required><input className="input" type="number" step="0.01" value={rupees} onChange={(e) => setRupees(e.target.value)} placeholder="8" /></Field>
        <div style={{ gridColumn: '1 / -1' }}>
          <button className="btn-primary" disabled={save.isPending || name.trim().length < 2 || !rupees} onClick={() => save.mutate()}>
            {save.isPending ? 'Saving…' : 'Add rate'}
          </button>
        </div>
      </FormSection>
    </Modal>
  );
}

export const FieldOpsIcon = Undo2;
