'use client';

/**
 * The dispatch trail.
 *
 *   farm → batch → load → weighing groups → net weight
 *        → invoice or internal transfer → outlet receipt
 *
 * Source and destination are shown independently, and where they disagree the
 * variance is stated with what to do about it. Nothing on this screen corrects
 * anything: a button that could adjust stock or accounting to make a row agree
 * would destroy the only evidence that the two ends disagree.
 */

import React, { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useRouter } from 'next/navigation';
import { ArrowRight, Route } from 'lucide-react';
import { api } from '@/lib/api';
import { Badge, Card, DataTable, Field, Modal, SectionTitle, Skeleton, StatCard, type DataTableColumn, type Tone } from '../ui/kit';
import { PageHead, fmtDate, money } from '../ui/common';

interface Group { groupNo: number; boxCount: number; birds: number; grossKg: number; tareKg: number; netKg: number; weighedAt: string }

interface TrailRow {
  pickupId: string; reference: string; dispatchedAt: string;
  farm: { id: string; code: string; name: string };
  batch: { id: string; code: string };
  requestedBirds: number | null; requestedKg: number | null; birds: number;
  weighingGroups: Group[];
  groupNetKg: number | null; sourceNetKg: number; weightMismatchKg: number | null;
  ratePaisePerKg: number;
  destination: string;
  invoice: { id: string; reference: string; date: string; party: string; amountInr: number; interCompany: boolean; collectedInr: number; outstandingInr: number } | null;
  transfer: { outlet: { id: string; code: string; name: string }; receivedKg: number; receivedAt: string | null; varianceKg: number | null } | null;
  party: { id: string; name: string; interCompany: boolean } | null;
  status: string;
  action: string | null;
}

interface Trail {
  window: { from: string; to: string };
  rows: TrailRow[];
  statuses: string[];
  totals: {
    loads: number; dispatchedKg: number; receivedKg: number; invoicedInr: number; outstandingInr: number;
    matched: number; pendingInvoice: number; pendingReceipt: number;
    receivingMismatch: number; weightMismatch: number; unresolved: number;
  };
  note: string;
}

const TONE: Record<string, Tone> = {
  MATCHED: 'active',
  PENDING_INVOICE: 'expired',
  PENDING_RECEIPT: 'renewal',
  RECEIVING_MISMATCH: 'expired',
  WEIGHT_MISMATCH: 'expired',
  UNRESOLVED: 'renewal',
};

const label = (s: string) => s.replace(/_/g, ' ').toLowerCase();
const monthStart = () => { const n = new Date(); return new Date(n.getFullYear(), n.getMonth(), 1).toISOString().slice(0, 10); };

export function DispatchTrailScreen() {
  const router = useRouter();
  const [from, setFrom] = useState(monthStart());
  const [to, setTo] = useState(new Date().toISOString().slice(0, 10));
  const [filter, setFilter] = useState('');
  const [open, setOpen] = useState<TrailRow | null>(null);

  const trail = useQuery({
    queryKey: ['py', 'dispatch-trail', from, to],
    queryFn: async () => (await api.get<Trail>('/poultry/dispatch-trail', { params: { from, to } })).data,
  });

  const rows = useMemo(
    () => (trail.data?.rows ?? []).filter((r) => !filter || r.status === filter),
    [trail.data, filter],
  );
  const t = trail.data?.totals;

  const columns: DataTableColumn<TrailRow>[] = [
    {
      key: 'reference', header: 'Load', sortable: true,
      render: (r) => (
        <div>
          <div style={{ fontWeight: 600 }}>{r.reference}</div>
          <div className="ds-caption">{fmtDate(r.dispatchedAt)} · {r.batch.code}</div>
        </div>
      ),
    },
    { key: 'farm', header: 'From', sortable: true, render: (r) => r.farm.name },
    {
      key: 'sourceNetKg', header: 'Dispatched', align: 'right', sortable: true,
      render: (r) => (
        <div>
          <div style={{ fontVariantNumeric: 'tabular-nums' }}>{r.sourceNetKg} kg</div>
          <div className="ds-caption">
            {r.weighingGroups.length
              ? `${r.weighingGroups.length} group${r.weighingGroups.length === 1 ? '' : 's'}`
              : 'not weighed'}
            {r.weightMismatchKg !== null ? ` · groups net ${r.groupNetKg}` : ''}
          </div>
        </div>
      ),
    },
    {
      key: 'destination', header: 'To', sortable: true,
      render: (r) => (
        <div>
          <div>{r.transfer ? r.transfer.outlet.name : r.party ? r.party.name : <span className="ds-caption">unassigned</span>}</div>
          <div className="ds-caption">
            {r.transfer ? 'internal transfer' : r.party ? (r.party.interCompany ? 'group company' : 'customer') : '—'}
          </div>
        </div>
      ),
    },
    {
      key: 'received', header: 'Arrived', align: 'right',
      render: (r) => (
        r.transfer
          ? (
            <div>
              <div style={{ fontVariantNumeric: 'tabular-nums' }}>{r.transfer.receivedKg} kg</div>
              {r.transfer.varianceKg !== null && Math.abs(r.transfer.varianceKg) > 0.1 && (
                <div className="ds-caption" style={{ color: 'var(--tone-expired)' }}>
                  {r.transfer.varianceKg > 0 ? '+' : ''}{r.transfer.varianceKg} kg
                </div>
              )}
            </div>
          )
          : r.invoice
            ? (
              <div>
                <div style={{ fontVariantNumeric: 'tabular-nums' }}>{money(r.invoice.amountInr)}</div>
                <div className="ds-caption">{r.invoice.reference}</div>
              </div>
            )
            : <span className="ds-caption">—</span>
      ),
    },
    { key: 'status', header: '', render: (r) => <Badge tone={TONE[r.status] ?? 'neutral'}>{label(r.status)}</Badge> },
  ];

  return (
    <div className="ds-page">
      <PageHead
        title="Dispatch trail"
        subtitle="Farm to counter, load by load. Source and destination are read independently — nothing here corrects stock or accounting."
        actions={(
          <>
            <Field label="From"><input className="input" type="date" value={from} onChange={(e) => setFrom(e.target.value)} /></Field>
            <Field label="To"><input className="input" type="date" value={to} onChange={(e) => setTo(e.target.value)} /></Field>
          </>
        )}
      />

      {trail.isLoading || !t ? <Skeleton rows={3} height={92} /> : (
        <>
          <div className="ds-grid ds-grid-kpi">
            <StatCard label="Loads" value={String(t.loads)} hint={`${t.dispatchedKg.toLocaleString('en-IN')} kg dispatched`} />
            <StatCard label="Reconciled" value={String(t.matched)} hint="source and destination agree" tone={t.matched === t.loads ? 'active' : 'neutral'} />
            <StatCard
              label="Unbilled"
              value={String(t.pendingInvoice)}
              hint="left a farm for a customer, never invoiced"
              tone={t.pendingInvoice > 0 ? 'expired' : 'active'}
            />
            <StatCard
              label="Mismatched"
              value={String(t.receivingMismatch + t.weightMismatch)}
              hint="dispatch and arrival, or header and groups"
              tone={t.receivingMismatch + t.weightMismatch > 0 ? 'expired' : 'active'}
            />
          </div>

          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', margin: '18px 0 14px' }}>
            <button className={filter === '' ? 'btn-primary' : 'btn-secondary'} onClick={() => setFilter('')}>
              All {trail.data!.rows.length}
            </button>
            {trail.data!.statuses.map((s) => {
              const n = trail.data!.rows.filter((r) => r.status === s).length;
              if (!n) return null;
              return (
                <button key={s} className={filter === s ? 'btn-primary' : 'btn-secondary'} onClick={() => setFilter(s)}>
                  {label(s)} {n}
                </button>
              );
            })}
          </div>

          <Card flush>
            <DataTable
              columns={columns}
              rows={rows}
              rowKey={(r) => r.pickupId}
              onRowClick={(r) => setOpen(r)}
              empty="No load dispatched in this window."
            />
            <p className="ds-caption" style={{ padding: '12px 16px', borderTop: '1px solid var(--hairline-soft)' }}>
              {trail.data!.note}
            </p>
          </Card>
        </>
      )}

      <TrailDetail row={open} onClose={() => setOpen(null)} onGo={(href) => { setOpen(null); router.push(href); }} />
    </div>
  );
}

function TrailDetail({ row, onClose, onGo }: { row: TrailRow | null; onClose: () => void; onGo: (href: string) => void }) {
  if (!row) return null;
  return (
    <Modal
      open={!!row}
      onClose={onClose}
      title={`${row.reference} · ${row.farm.name}`}
      subtitle={`${row.batch.code} · dispatched ${fmtDate(row.dispatchedAt)}`}
      width={880}
      footer={(
        <>
          <button className="btn-secondary" onClick={onClose}>Close</button>
          <button className="btn-secondary" onClick={() => onGo(`/poultry/batches/${row.batch.id}`)}>Open the cycle</button>
          {row.status === 'PENDING_INVOICE' && (
            <button className="btn-primary" onClick={() => onGo('/poultry/pickups')}>Raise the invoice</button>
          )}
          {row.status === 'PENDING_RECEIPT' && (
            <button className="btn-primary" onClick={() => onGo('/poultry/outlet-day')}>Receive at the outlet</button>
          )}
          {row.status === 'WEIGHT_MISMATCH' && (
            <button className="btn-primary" onClick={() => onGo('/poultry/pickups')}>Re-record the weighing</button>
          )}
        </>
      )}
    >
      {row.action && (
        <Card tone={TONE[row.status] === 'active' ? undefined : (TONE[row.status] as never)}>
          <SectionTitle>{label(row.status)}</SectionTitle>
          <p>{row.action}</p>
        </Card>
      )}

      <div style={{ marginTop: 16 }}>
        <SectionTitle sub="The evidence the net weight was built on. Every component is kept, not just the answer.">
          Weighing
        </SectionTitle>
        {row.weighingGroups.length === 0 ? (
          <p className="ds-caption">
            This load was never weighed in groups — its net weight of {row.sourceNetKg} kg has no evidence behind it.
          </p>
        ) : (
          <Card flush>
            <DataTable
              dense
              columns={[
                { key: 'groupNo', header: 'Group', render: (g: Group) => `#${g.groupNo}` },
                { key: 'boxCount', header: 'Boxes', align: 'right', render: (g: Group) => String(g.boxCount) },
                { key: 'birds', header: 'Birds', align: 'right', render: (g: Group) => String(g.birds) },
                { key: 'grossKg', header: 'Gross', align: 'right', render: (g: Group) => `${g.grossKg} kg` },
                { key: 'tareKg', header: 'Tare', align: 'right', render: (g: Group) => `${g.tareKg} kg` },
                { key: 'netKg', header: 'Net', align: 'right', render: (g: Group) => <strong>{g.netKg} kg</strong> },
              ] as DataTableColumn<Group>[]}
              rows={row.weighingGroups}
              rowKey={(g) => String(g.groupNo)}
            />
          </Card>
        )}
        {row.weightMismatchKg !== null && (
          <p className="ds-caption" style={{ color: 'var(--tone-expired)', marginTop: 8 }}>
            The groups net to {row.groupNetKg} kg but the load header says {row.sourceNetKg} kg —
            a difference of {row.weightMismatchKg} kg. The invoice can only be built on one of them.
          </p>
        )}
      </div>

      <div style={{ marginTop: 20, display: 'grid', gap: 16, gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))' }}>
        <Card>
          <SectionTitle>Left the farm</SectionTitle>
          <Row label="Farm" value={row.farm.name} />
          <Row label="Batch" value={row.batch.code} />
          <Row label="Birds" value={row.birds.toLocaleString('en-IN')} />
          {row.requestedBirds !== null && (
            <Row
              label="Against a request for"
              value={`${row.requestedBirds.toLocaleString('en-IN')} birds`}
              muted
            />
          )}
          <Row label="Net weight" value={`${row.sourceNetKg} kg`} strong />
          <Row label="Rate" value={`₹${(row.ratePaisePerKg / 100).toFixed(2)}/kg`} />
        </Card>

        <Card>
          <SectionTitle>
            {row.transfer ? 'Arrived at the counter' : row.invoice ? 'Invoiced' : 'Destination'}
            <ArrowRight size={14} style={{ verticalAlign: -2, marginLeft: 6, color: 'var(--ink-3)' }} />
          </SectionTitle>
          {row.transfer ? (
            <>
              <Row label="Outlet" value={row.transfer.outlet.name} />
              <Row label="Received" value={`${row.transfer.receivedKg} kg`} strong />
              <Row label="Received at" value={row.transfer.receivedAt ? fmtDate(row.transfer.receivedAt) : 'not received'} />
              {row.transfer.varianceKg !== null && Math.abs(row.transfer.varianceKg) > 0.1 && (
                <Row
                  label="Variance"
                  value={`${row.transfer.varianceKg > 0 ? '+' : ''}${row.transfer.varianceKg} kg`}
                  strong
                />
              )}
              <p className="ds-caption" style={{ marginTop: 8 }}>
                A movement inside the company earns nothing — the stock moved shelf, and the load&apos;s rate
                became the counter&apos;s cost basis.
              </p>
            </>
          ) : row.invoice ? (
            <>
              <Row label="Invoice" value={row.invoice.reference} />
              <Row label="Party" value={row.invoice.party} />
              <Row label="Value" value={money(row.invoice.amountInr)} strong />
              <Row label="Collected" value={money(row.invoice.collectedInr)} />
              <Row label="Outstanding" value={money(row.invoice.outstandingInr)} strong />
              {row.invoice.interCompany && (
                <p className="ds-caption" style={{ marginTop: 8 }}>
                  Sold to a group company. Real revenue here; the group tier eliminates both legs.
                </p>
              )}
            </>
          ) : (
            <p className="ds-caption">This load has no customer and no outlet against it.</p>
          )}
        </Card>
      </div>
    </Modal>
  );
}

function Row({ label: l, value, strong, muted }: { label: string; value: string; strong?: boolean; muted?: boolean }) {
  return (
    <div style={{
      display: 'flex', justifyContent: 'space-between', gap: 12, padding: '3px 0',
      fontWeight: strong ? 600 : 400, color: muted ? 'var(--ink-3)' : 'var(--ink-1)',
    }}>
      <span>{l}</span>
      <span style={{ fontVariantNumeric: 'tabular-nums', whiteSpace: 'nowrap' }}>{value}</span>
    </div>
  );
}

export const DispatchTrailIcon = Route;
