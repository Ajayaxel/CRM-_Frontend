'use client';

/**
 * Receivables, aged from real allocations.
 *
 * Every bucket here comes from knowing WHICH invoice a receipt paid. Where
 * that link does not exist the money is shown as unapplied rather than pushed
 * into a bucket — an ageing built on a guess looks precise and is wrong, which
 * is worse than admitting the balance cannot be aged.
 */

import React, { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { HandCoins, Link2 } from 'lucide-react';
import { toast } from 'sonner';
import { api } from '@/lib/api';
import { Badge, Card, DataTable, Field, FormSection, Modal, SectionTitle, Segmented, Skeleton, StatCard, type DataTableColumn, type Tone } from '../ui/kit';
import { PageHead, fmtDate, money } from '../ui/common';

interface AgeRow {
  partyId: string; code: string; name: string; paymentTermsDays: number; interCompany: boolean;
  openingInr: number; buckets: Record<string, number>;
  outstandingInr: number; unappliedInr: number; openInvoices: number; oldestDaysPastDue: number;
}

interface Ageing {
  asOf: string; buckets: string[]; rows: AgeRow[];
  totals: Record<string, number> & { outstandingInr: number; unappliedInr: number; openingInr: number; interCompanyInr: number; overdueInr: number };
  allocationsRecorded: number;
  note: string;
}

interface Invoice {
  saleId: string; reference: string; date: string; dueDate: string;
  party: { id: string; name: string }; interCompany: boolean;
  amountInr: number; allocatedInr: number; outstandingInr: number;
  paid: boolean; partlyPaid: boolean; paymentTermsDays: number; daysPastDue: number; bucket: string;
  receipts: { receiptId: string; reference: string; date: string; amountInr: number }[];
}

interface Unapplied {
  receiptId: string; reference: string; date: string; party: { id: string; name: string };
  amountInr: number; appliedInr: number; unappliedInr: number; mode: string; daysOld: number;
}

const BUCKET_LABEL: Record<string, string> = {
  NOT_DUE: 'Not due', CURRENT: 'Due today', D1_30: '1–30', D31_60: '31–60', D61_90: '61–90', D90_PLUS: '90+',
};
const BUCKET_TONE: Record<string, Tone> = {
  PAID: 'active', NOT_DUE: 'info', CURRENT: 'renewal',
  D1_30: 'renewal', D31_60: 'expired', D61_90: 'expired', D90_PLUS: 'expired',
};

const VIEWS = ['Ageing', 'Invoices', 'Unapplied receipts'];

export function ReceivablesScreen() {
  const qc = useQueryClient();
  const [view, setView] = useState(VIEWS[0]);
  const [applying, setApplying] = useState<Unapplied | null>(null);

  const ageing = useQuery({
    queryKey: ['py', 'ageing'],
    queryFn: async () => (await api.get<Ageing>('/poultry/receivables/ageing')).data,
  });
  const invoices = useQuery({
    queryKey: ['py', 'invoice-ledger'],
    queryFn: async () => (await api.get<Invoice[]>('/poultry/receivables/invoices')).data,
    enabled: view === 'Invoices',
  });
  const unapplied = useQuery({
    queryKey: ['py', 'unapplied'],
    queryFn: async () => (await api.get<Unapplied[]>('/poultry/receivables/unapplied')).data,
    enabled: view === 'Unapplied receipts' || !!applying,
  });

  const invalidate = () => qc.invalidateQueries({ queryKey: ['py'] });
  const t = ageing.data?.totals;

  return (
    <div className="ds-page">
      <PageHead
        title="Receivables"
        subtitle="Aged from actual receipt-to-invoice allocations, against each party's own payment terms."
      />

      {ageing.isLoading || !t ? <Skeleton rows={3} height={92} /> : (
        <>
          <div className="ds-grid ds-grid-kpi">
            <StatCard label="Outstanding" value={money(t.outstandingInr)} hint={`${ageing.data!.rows.length} parties`} />
            <StatCard
              label="Overdue"
              value={money(t.overdueInr)}
              hint="past each party's own terms"
              tone={t.overdueInr > 0 ? 'expired' : 'active'}
            />
            <StatCard
              label="Unapplied receipts"
              value={money(t.unappliedInr)}
              hint="money against no invoice"
              tone={t.unappliedInr > 0 ? 'renewal' : 'neutral'}
            />
            <StatCard label="Owed by group companies" value={money(t.interCompanyInr)} hint="real here; eliminated at group level" />
          </div>

          {ageing.data!.allocationsRecorded === 0 && (
            <div style={{ marginTop: 16 }}>
              <Card tone="renewal">
                <SectionTitle sub="Every invoice is ageing from its own date, which is correct — but nothing says which payment was meant for which bill. Apply the receipts below and the buckets become real.">
                  No receipt has been applied to an invoice yet
                </SectionTitle>
              </Card>
            </div>
          )}
        </>
      )}

      <div style={{ margin: '18px 0 14px' }}>
        <Segmented options={VIEWS} value={view} onChange={setView} />
      </div>

      {view === 'Ageing' && (ageing.isLoading ? <Skeleton rows={4} /> : (
        <Card flush>
          <DataTable
            columns={[
              { key: 'name', header: 'Party', sortable: true, render: (r: AgeRow) => (
                <div>
                  <div style={{ fontWeight: 600 }}>{r.name}</div>
                  <div className="ds-caption">
                    {r.code} · {r.paymentTermsDays > 0 ? `${r.paymentTermsDays}-day terms` : 'no agreed terms'}
                    {r.interCompany ? ' · group company' : ''}
                  </div>
                </div>
              ) },
              ...(ageing.data?.buckets ?? []).map((b) => ({
                key: b, header: BUCKET_LABEL[b] ?? b, align: 'right' as const, sortable: true,
                render: (r: AgeRow) => (r.buckets[b] ? money(r.buckets[b]) : <span className="ds-caption">—</span>),
              })),
              { key: 'outstandingInr', header: 'Total', align: 'right', sortable: true, render: (r: AgeRow) => <strong>{money(r.outstandingInr)}</strong> },
              { key: 'unappliedInr', header: 'Unapplied', align: 'right', render: (r: AgeRow) => (
                r.unappliedInr ? <Badge tone="renewal">{money(r.unappliedInr)}</Badge> : null
              ) },
            ] as DataTableColumn<AgeRow>[]}
            rows={ageing.data?.rows ?? []}
            rowKey={(r) => r.partyId}
            empty="Nobody owes anything."
          />
          <p className="ds-caption" style={{ padding: '12px 16px', borderTop: '1px solid var(--hairline-soft)' }}>
            {ageing.data?.note}
            {t && t.openingInr > 0
              ? ` Pre-system opening balances of ${money(t.openingInr)} are outside these buckets — they have no invoice behind them.`
              : ''}
          </p>
        </Card>
      ))}

      {view === 'Invoices' && (invoices.isLoading ? <Skeleton rows={4} /> : (
        <Card flush>
          <DataTable
            columns={[
              { key: 'reference', header: 'Invoice', sortable: true, render: (r: Invoice) => (
                <div>
                  <div style={{ fontWeight: 600 }}>{r.reference}</div>
                  <div className="ds-caption">{r.party.name} · {fmtDate(r.date)}</div>
                </div>
              ) },
              { key: 'dueDate', header: 'Due', sortable: true, render: (r: Invoice) => (
                <div>
                  <div>{fmtDate(r.dueDate)}</div>
                  <div className="ds-caption">{r.paymentTermsDays > 0 ? `${r.paymentTermsDays}-day terms` : 'on receipt'}</div>
                </div>
              ) },
              { key: 'amountInr', header: 'Value', align: 'right', sortable: true, render: (r: Invoice) => money(r.amountInr) },
              { key: 'allocatedInr', header: 'Paid', align: 'right', sortable: true, render: (r: Invoice) => (
                r.allocatedInr ? money(r.allocatedInr) : <span className="ds-caption">—</span>
              ) },
              { key: 'outstandingInr', header: 'Open', align: 'right', sortable: true, render: (r: Invoice) => (
                <strong>{money(r.outstandingInr)}</strong>
              ) },
              { key: 'bucket', header: '', render: (r: Invoice) => (
                <div style={{ display: 'flex', gap: 6, justifyContent: 'flex-end', flexWrap: 'wrap' }}>
                  {r.partlyPaid && <Badge tone="info">part paid</Badge>}
                  <Badge tone={BUCKET_TONE[r.bucket] ?? 'neutral'}>
                    {r.bucket === 'PAID' ? 'paid' : r.bucket === 'NOT_DUE' ? 'not due' : r.bucket === 'CURRENT' ? 'due today' : `${r.daysPastDue}d overdue`}
                  </Badge>
                </div>
              ) },
            ] as DataTableColumn<Invoice>[]}
            rows={invoices.data ?? []}
            rowKey={(r) => r.saleId}
            empty="No invoice raised yet."
          />
          <p className="ds-caption" style={{ padding: '12px 16px', borderTop: '1px solid var(--hairline-soft)' }}>
            Outstanding is the invoice value less what has actually been allocated to it — there is no paid flag
            to drift out of step.
          </p>
        </Card>
      ))}

      {view === 'Unapplied receipts' && (unapplied.isLoading ? <Skeleton rows={3} /> : (
        <Card flush>
          <DataTable
            columns={[
              { key: 'reference', header: 'Receipt', sortable: true, render: (r: Unapplied) => (
                <div>
                  <div style={{ fontWeight: 600 }}>{r.reference}</div>
                  <div className="ds-caption">{r.party.name} · {fmtDate(r.date)} · {r.mode.toLowerCase()}</div>
                </div>
              ) },
              { key: 'amountInr', header: 'Received', align: 'right', sortable: true, render: (r: Unapplied) => money(r.amountInr) },
              { key: 'appliedInr', header: 'Applied', align: 'right', render: (r: Unapplied) => (r.appliedInr ? money(r.appliedInr) : <span className="ds-caption">—</span>) },
              { key: 'unappliedInr', header: 'Unapplied', align: 'right', sortable: true, render: (r: Unapplied) => <strong>{money(r.unappliedInr)}</strong> },
              { key: 'daysOld', header: 'Age', align: 'right', sortable: true, render: (r: Unapplied) => `${r.daysOld}d` },
              { key: 'act', header: '', render: (r: Unapplied) => (
                <button className="btn-primary" onClick={() => setApplying(r)}>
                  <Link2 size={13} /> Apply
                </button>
              ) },
            ] as DataTableColumn<Unapplied>[]}
            rows={unapplied.data ?? []}
            rowKey={(r) => r.receiptId}
            empty="Every receipt is fully applied."
          />
          <p className="ds-caption" style={{ padding: '12px 16px', borderTop: '1px solid var(--hairline-soft)' }}>
            Money sitting against no invoice is an advance or a payment nobody matched. It is shown here rather
            than netted off the oldest bucket, which would make both the bucket and the receipt wrong.
          </p>
        </Card>
      ))}

      <ApplyModal receipt={applying} onClose={() => setApplying(null)} onSaved={invalidate} />
    </div>
  );
}

function ApplyModal({ receipt, onClose, onSaved }: { receipt: Unapplied | null; onClose: () => void; onSaved: () => void }) {
  const [amounts, setAmounts] = useState<Record<string, string>>({});

  const open = useQuery({
    queryKey: ['py', 'open-invoices', receipt?.party.id],
    queryFn: async () => (await api.get<Invoice[]>(`/poultry/parties/${receipt!.party.id}/open-invoices`)).data,
    enabled: !!receipt,
  });

  React.useEffect(() => { setAmounts({}); }, [receipt?.receiptId]);

  const allocated = Object.values(amounts).reduce((s, v) => s + (Number(v) || 0), 0);
  const left = (receipt?.unappliedInr ?? 0) - allocated;

  const apply = useMutation({
    mutationFn: async () => (await api.post(`/poultry/party-receipts/${receipt!.receiptId}/allocate`, {
      lines: Object.entries(amounts)
        .filter(([, v]) => Number(v) > 0)
        .map(([saleId, v]) => ({ saleId, amountInr: Math.round(Number(v)) })),
    })).data,
    onSuccess: () => { toast.success('Receipt applied'); onSaved(); onClose(); },
    onError: (e: any) => toast.error(e?.response?.data?.message ?? 'Could not apply the receipt'),
  });

  const auto = useMutation({
    mutationFn: async () => (await api.post(`/poultry/party-receipts/${receipt!.receiptId}/auto-allocate`, {})).data,
    onSuccess: (d: any) => {
      toast.success(d?.unappliedInr > 0 ? `Applied, ${d.unappliedInr} still unapplied` : 'Applied to the oldest invoices');
      onSaved(); onClose();
    },
    onError: (e: any) => toast.error(e?.response?.data?.message ?? 'Could not apply'),
  });

  if (!receipt) return null;
  return (
    <Modal
      open={!!receipt}
      onClose={onClose}
      title={`Apply ${receipt.reference}`}
      subtitle={`${receipt.party.name} · ${money(receipt.unappliedInr)} unapplied of ${money(receipt.amountInr)}`}
      width={820}
      footer={(
        <>
          <button className="btn-secondary" onClick={onClose}>Cancel</button>
          <button className="btn-secondary" disabled={auto.isPending} onClick={() => auto.mutate()}>
            {auto.isPending ? 'Applying…' : 'Oldest first'}
          </button>
          <button className="btn-primary" disabled={apply.isPending || allocated <= 0 || left < 0} onClick={() => apply.mutate()}>
            {apply.isPending ? 'Applying…' : `Apply ${money(allocated)}`}
          </button>
        </>
      )}
    >
      <FormSection title="Open invoices">
        <div style={{ gridColumn: '1 / -1', display: 'flex', flexDirection: 'column', gap: 10 }}>
          {(open.data ?? []).length === 0 && (
            <p className="ds-caption">This party has no open invoice. The money stays unapplied, which is correct — it is an advance.</p>
          )}
          {(open.data ?? []).map((inv) => (
            <div key={inv.saleId} style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
              <div style={{ flex: 2, minWidth: 220 }}>
                <div style={{ fontWeight: 600 }}>{inv.reference}</div>
                <div className="ds-caption">
                  {fmtDate(inv.date)} · due {fmtDate(inv.dueDate)} · {money(inv.outstandingInr)} open
                  {inv.partlyPaid ? ` (${money(inv.allocatedInr)} already paid)` : ''}
                </div>
              </div>
              <input
                className="input"
                style={{ width: 140 }}
                type="number"
                min={0}
                max={inv.outstandingInr}
                placeholder="0"
                value={amounts[inv.saleId] ?? ''}
                onChange={(e) => setAmounts({ ...amounts, [inv.saleId]: e.target.value })}
              />
              <button
                className="btn-secondary"
                onClick={() => setAmounts({ ...amounts, [inv.saleId]: String(Math.min(inv.outstandingInr, receipt.unappliedInr - allocated + (Number(amounts[inv.saleId]) || 0))) })}
              >
                Max
              </button>
            </div>
          ))}
          <div style={{ display: 'flex', justifyContent: 'space-between', borderTop: '1px solid var(--hairline-soft)', paddingTop: 8 }}>
            <span className="ds-caption">
              {left < 0
                ? 'This applies more than the receipt has left — the server will refuse it.'
                : `${money(left)} would remain unapplied.`}
            </span>
            <strong style={{ color: left < 0 ? 'var(--tone-expired)' : undefined }}>{money(allocated)}</strong>
          </div>
        </div>
      </FormSection>
    </Modal>
  );
}

export const ReceivablesIcon = HandCoins;
