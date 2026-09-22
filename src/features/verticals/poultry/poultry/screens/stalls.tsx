'use client';

import React, { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { api, apiErrorMessage } from '@/lib/api';
import { useAuth } from '@/features/foundation/auth';
import {
  Badge, Card, DataTable, DataTableColumn, EmptyState, Field, FormSection, Modal,
  SectionTitle, Skeleton, StatCard, Tone, humanStatus,
} from '../ui/kit';
import { PageHead, Pagination, fmtDate, money, toDateInput } from '../ui/common';
import { STALL_TXN_KINDS, toneForStallDayStatus } from '../ui/tone';

interface Stall { id: string; code: string; name: string; location?: string | null; isActive: boolean }

interface StallDayRow {
  id: string; date: string; status: string; openingStockKg: number; closingStockKg: number;
  salesInr: number; expensesInr: number; soldKg: number;
  stall: { name: string; code: string };
}

interface StallTxn {
  id: string; kind: string; qtyKg: number; birds: number; amountInr: number;
  mode?: string | null; ledgerCode?: string | null; note?: string | null;
  isCorrection: boolean; correctionReason?: string | null; createdAt: string;
}

interface StallDayDetail {
  id: string; date: string; status: string; openingStockKg: number; closingStockKg: number;
  reviewNote?: string | null;
  stall: Stall;
  txns: StallTxn[];
  totals: {
    inwardKg: number; saleKg: number; outwardKg: number; wastageKg: number; adjustmentKg: number;
    cashSalesInr: number; bankSalesInr: number; expensesInr: number; cashExpensesInr: number; salesInr: number;
  };
  computedClosingStockKg: number;
  dailyResultInr: number;
}

/** Local map — there is no stall-txn tone in tone.ts and this screen is its only consumer. */
function toneForTxnKind(k: string): Tone {
  switch (k) {
    case 'INWARD': return 'sales';
    case 'SALE': return 'active';
    case 'OUTWARD': return 'info';
    case 'WASTAGE': return 'expired';
    case 'ADJUSTMENT': return 'renewal';
    case 'EXPENSE': return 'claim';
    default: return 'neutral';
  }
}

export function PoultryStalls() {
  const qc = useQueryClient();
  const { hasPermission } = useAuth();
  const canStall = hasPermission('poultry.stall');
  const canFinance = hasPermission('poultry.finance');
  const [stallId, setStallId] = useState('');
  const [page, setPage] = useState(1);
  const [dayId, setDayId] = useState<string | null>(null);
  const [modal, setModal] = useState<'open' | 'entry' | null>(null);
  const [reviewNote, setReviewNote] = useState('');

  const { data: stalls } = useQuery({
    queryKey: ['py-stalls'],
    queryFn: async () => (await api.get<Stall[]>('/poultry/stalls')).data,
  });
  const effectiveStallId = stallId || stalls?.[0]?.id || '';
  const stall = (stalls ?? []).find((s) => s.id === effectiveStallId);

  const { data: days, isLoading } = useQuery({
    queryKey: ['py-stall-days', effectiveStallId, page],
    queryFn: async () => (await api.get<{ data: StallDayRow[]; meta: { page: number; limit: number; total: number; totalPages: number } }>(
      '/poultry/stall-days', { params: { stallId: effectiveStallId, page, limit: 25 } },
    )).data,
    enabled: !!effectiveStallId,
  });

  const { data: day } = useQuery({
    queryKey: ['py-stall-day', dayId],
    queryFn: async () => (await api.get<StallDayDetail>(`/poultry/stall-days/${dayId}`)).data,
    enabled: !!dayId,
  });

  const invalidate = () => {
    qc.invalidateQueries({ queryKey: ['py-stall-days'] });
    qc.invalidateQueries({ queryKey: ['py-stall-day'] });
    qc.invalidateQueries({ queryKey: ['py-dashboard'] });
  };

  const closeDay = useMutation({
    mutationFn: () => api.post(`/poultry/stall-days/${dayId}/close`),
    onSuccess: () => { toast.success('Day closed — evening report ready'); invalidate(); },
    onError: (e) => toast.error(apiErrorMessage(e)),
  });

  const finalizeDay = useMutation({
    mutationFn: () => api.post(`/poultry/stall-days/${dayId}/finalize`, { reviewNote: reviewNote || undefined }),
    onSuccess: () => { toast.success('Day finalized'); setReviewNote(''); invalidate(); },
    onError: (e) => toast.error(apiErrorMessage(e)),
  });

  const columns: DataTableColumn<StallDayRow>[] = [
    { key: 'date', header: 'Date', width: 110, render: (d) => <span style={{ fontWeight: 600 }}>{fmtDate(d.date)}</span> },
    { key: 'status', header: 'Status', width: 110, render: (d) => <Badge tone={toneForStallDayStatus(d.status)}>{humanStatus(d.status)}</Badge> },
    { key: 'openingStockKg', header: 'Opening kg', align: 'right', width: 100, render: (d) => d.openingStockKg.toLocaleString('en-IN') },
    { key: 'closingStockKg', header: 'Closing kg', align: 'right', width: 100, render: (d) => d.closingStockKg.toLocaleString('en-IN') },
    { key: 'salesInr', header: 'Sales', align: 'right', width: 110, render: (d) => money(d.salesInr) },
    { key: 'expensesInr', header: 'Expenses', align: 'right', width: 110, render: (d) => money(d.expensesInr) },
  ];

  const txnColumns: DataTableColumn<StallTxn>[] = [
    { key: 'kind', header: 'Kind', width: 120, render: (t) => <Badge tone={toneForTxnKind(t.kind)}>{humanStatus(t.kind)}</Badge> },
    { key: 'qtyKg', header: 'Kg', align: 'right', width: 80, render: (t) => (t.qtyKg ? t.qtyKg.toLocaleString('en-IN') : <span className="ds-caption">—</span>) },
    { key: 'amountInr', header: 'Amount', align: 'right', width: 110, render: (t) => (t.amountInr ? money(t.amountInr) : <span className="ds-caption">—</span>) },
    { key: 'mode', header: 'Mode', width: 90, render: (t) => (t.mode ? humanStatus(t.mode) : <span className="ds-caption">—</span>) },
    { key: 'note', header: 'Note', render: (t) => (
      <div style={{ minWidth: 0 }}>
        <span>{t.note ?? '—'}</span>
        {t.isCorrection && <Badge tone="claim">Correction</Badge>}
        {t.correctionReason && <div className="ds-caption">{t.correctionReason}</div>}
      </div>
    ) },
  ];

  const firstDay = (days?.meta.total ?? 0) === 0;

  return (
    <div className="ds-page">
      <PageHead
        title="Stalls"
        subtitle="The C-section day book — open the day, record the movement, close, review"
        actions={canStall && effectiveStallId && (
          <button className="btn-primary" onClick={() => setModal('open')}>Open day</button>
        )}
      />

      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 14 }}>
        <select
          className="input" style={{ maxWidth: 260 }} value={effectiveStallId} aria-label="Stall"
          onChange={(e) => { setStallId(e.target.value); setPage(1); setDayId(null); }}
        >
          {(stalls ?? []).map((s) => <option key={s.id} value={s.id}>{s.code} · {s.name}</option>)}
        </select>
      </div>

      {!stalls?.length && (
        <Card>
          <EmptyState title="No stalls yet" body="Add a stall from Settings before opening a business day." compact />
        </Card>
      )}

      {!!effectiveStallId && (
        <>
          <Card flush>
            <DataTable
              rows={days?.data ?? []}
              columns={columns}
              rowKey={(d) => d.id}
              loading={isLoading}
              onRowClick={(d) => setDayId(d.id)}
              empty={<EmptyState title="No days recorded" body={`Open ${stall?.name ?? 'this stall'}'s first day to start the book.`} actionLabel={canStall ? 'Open day' : undefined} onAction={canStall ? () => setModal('open') : undefined} />}
            />
          </Card>
          <Pagination meta={days?.meta} onPage={setPage} />
        </>
      )}

      {dayId && !day && <Skeleton rows={2} height={92} />}

      {day && (
        <div style={{ marginTop: 18 }}>
          <SectionTitle
            sub="Opening + Inward − Sales − Outward − Wastage + Adjustments = Closing"
            action={(
              <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                <Badge tone={toneForStallDayStatus(day.status)}>{humanStatus(day.status)}</Badge>
                {canStall && day.status === 'OPEN' && (
                  <>
                    <button className="btn-secondary btn-sm" onClick={() => setModal('entry')}>Add entry</button>
                    <button className="btn-primary btn-sm" disabled={closeDay.isPending} onClick={() => closeDay.mutate()}>
                      {closeDay.isPending ? 'Closing…' : 'Close day'}
                    </button>
                  </>
                )}
                {canStall && day.status === 'CLOSED' && (
                  <button className="btn-secondary btn-sm" onClick={() => setModal('entry')}>Add entry</button>
                )}
                {canFinance && day.status === 'FINALIZED' && (
                  <button className="btn-secondary btn-sm" onClick={() => setModal('entry')}>Add correction</button>
                )}
              </div>
            )}
          >
            {`${day.stall.name} · ${fmtDate(day.date)}`}
          </SectionTitle>

          {day.status === 'CLOSED' && (
            <Card tone="renewal">
              <div style={{ display: 'flex', gap: 12, alignItems: 'center', flexWrap: 'wrap' }}>
                <Badge tone="renewal">Awaiting morning review</Badge>
                <span style={{ fontSize: 13 }}>The evening figures are frozen; corrections still land with a note until the day is finalized.</span>
                {canFinance && (
                  <div style={{ display: 'flex', gap: 8, marginLeft: 'auto', alignItems: 'center', flexWrap: 'wrap' }}>
                    <input
                      className="input" style={{ maxWidth: 240 }} placeholder="Review note (optional)"
                      value={reviewNote} onChange={(e) => setReviewNote(e.target.value)} aria-label="Review note"
                    />
                    <button className="btn-primary btn-sm" disabled={finalizeDay.isPending} onClick={() => finalizeDay.mutate()}>
                      {finalizeDay.isPending ? 'Finalizing…' : 'Finalize'}
                    </button>
                  </div>
                )}
              </div>
            </Card>
          )}

          {day.status === 'FINALIZED' && (
            <Card tone="active">
              <div style={{ display: 'flex', gap: 12, alignItems: 'center', flexWrap: 'wrap' }}>
                <Badge tone="active">Finalized</Badge>
                <span style={{ fontSize: 13 }}>
                  The day is locked{day.reviewNote ? ` — “${day.reviewNote}”` : ''}. Only a finance correction with a reason can change it.
                </span>
              </div>
            </Card>
          )}

          <div className="ds-grid ds-grid-kpi">
            <StatCard label="Opening" value={`${day.openingStockKg.toLocaleString('en-IN')} kg`} />
            <StatCard label="Inward" value={`${day.totals.inwardKg.toLocaleString('en-IN')} kg`} />
            <StatCard label="Sales" value={`${day.totals.saleKg.toLocaleString('en-IN')} kg`} hint={money(day.totals.salesInr)} tone="active" />
            <StatCard label="Wastage" value={`${day.totals.wastageKg.toLocaleString('en-IN')} kg`} tone={day.totals.wastageKg > 0 ? 'claim' : 'neutral'} />
            <StatCard label="Closing" value={`${day.computedClosingStockKg.toLocaleString('en-IN')} kg`} />
            <StatCard
              label="Daily result"
              value={money(day.dailyResultInr)}
              tone={day.dailyResultInr >= 0 ? 'active' : 'expired'}
              hint={`expenses ${money(day.totals.expensesInr)}`}
            />
          </div>

          <Card flush>
            <DataTable
              rows={day.txns}
              columns={txnColumns}
              rowKey={(t) => t.id}
              dense
              empty={<div className="ds-caption" style={{ padding: 16 }}>Nothing recorded on this day yet.</div>}
            />
          </Card>
        </div>
      )}

      <OpenDayModal
        open={modal === 'open'}
        onClose={() => setModal(null)}
        stalls={stalls ?? []}
        stallId={effectiveStallId}
        firstDay={firstDay}
        onDone={invalidate}
      />
      {day && (
        <AddEntryModal
          open={modal === 'entry'}
          onClose={() => setModal(null)}
          day={day}
          requireReason={day.status === 'FINALIZED'}
          onDone={invalidate}
        />
      )}
    </div>
  );
}

function OpenDayModal({ open, onClose, stalls, stallId, firstDay, onDone }: {
  open: boolean; onClose: () => void; stalls: Stall[]; stallId: string; firstDay: boolean; onDone: () => void;
}) {
  const [form, setForm] = useState({ stallId: '', date: toDateInput(), openingStockKg: '', openingCashInr: '' });
  React.useEffect(() => {
    if (open) setForm({ stallId, date: toDateInput(), openingStockKg: '', openingCashInr: '' });
  }, [open, stallId]);

  const save = useMutation({
    mutationFn: () => api.post('/poultry/stall-days', {
      stallId: form.stallId,
      date: form.date,
      ...(firstDay && form.openingStockKg ? { openingStockKg: Number(form.openingStockKg) } : {}),
      ...(form.openingCashInr !== '' ? { openingCashInr: Math.round(Number(form.openingCashInr)) } : {}),
    }),
    onSuccess: () => { toast.success('Day opened'); onClose(); onDone(); },
    onError: (e) => toast.error(apiErrorMessage(e)),
  });

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Open day"
      subtitle="Opening stock carries from the previous day's closing; the till float carries from the last cash count."
      width={520}
      footer={(
        <>
          <button className="btn-secondary" onClick={onClose}>Cancel</button>
          <button className="btn-primary" disabled={save.isPending || !form.stallId || !form.date} onClick={() => save.mutate()}>
            {save.isPending ? 'Saving…' : 'Open day'}
          </button>
        </>
      )}
    >
      <FormSection title="The day">
        <Field label="Stall" required>
          <select className="input" value={form.stallId} onChange={(e) => setForm({ ...form, stallId: e.target.value })}>
            {stalls.map((s) => <option key={s.id} value={s.id}>{s.code} · {s.name}</option>)}
          </select>
        </Field>
        <Field label="Date" required>
          <input className="input" type="date" value={form.date} onChange={(e) => setForm({ ...form, date: e.target.value })} />
        </Field>
        <Field
          label="Opening cash in the till (₹)"
          hint={firstDay
            ? 'The float the till starts with. Expected cash every day is built on it.'
            : 'Leave blank to carry the last counted cash. Needed only if the last day closed without a count.'}
        >
          <input className="input" type="number" min={0} step="1" value={form.openingCashInr} onChange={(e) => setForm({ ...form, openingCashInr: e.target.value })} />
        </Field>
        {firstDay && (
          <Field label="Opening stock (kg)" hint="Only the stall's first day starts from a typed figure">
            <input className="input" type="number" min={0} step="0.1" value={form.openingStockKg} onChange={(e) => setForm({ ...form, openingStockKg: e.target.value })} />
          </Field>
        )}
      </FormSection>
    </Modal>
  );
}

const EMPTY_ENTRY = {
  kind: 'SALE', qtyKg: '', birds: '', amountInr: '', mode: 'CASH', ledgerCode: '',
  pickupId: '', categoryId: '', note: '', correctionReason: '',
};

function AddEntryModal({ open, onClose, day, requireReason, onDone }: {
  open: boolean; onClose: () => void; day: StallDayDetail; requireReason: boolean; onDone: () => void;
}) {
  const [form, setForm] = useState(EMPTY_ENTRY);
  React.useEffect(() => { if (open) setForm(EMPTY_ENTRY); }, [open]);

  const { data: pickups } = useQuery({
    queryKey: ['py-pickups-lite'],
    queryFn: async () => (await api.get<{ data: { id: string; reference: string; weightKg: number; batch: { code: string } }[] }>(
      '/poultry/pickups', { params: { limit: 50 } },
    )).data.data,
    enabled: open && form.kind === 'INWARD',
  });
  const { data: accounts } = useQuery({
    queryKey: ['py-accounts'],
    queryFn: async () => (await api.get<{ ledgerCode: string; name: string; kind: string }[]>('/poultry/accounts')).data,
    enabled: open && (form.kind === 'SALE' || form.kind === 'EXPENSE') && form.mode !== 'CASH',
  });
  const { data: categories } = useQuery({
    queryKey: ['py-expense-categories'],
    queryFn: async () => (await api.get<{ id: string; name: string; group: string }[]>('/poultry/expense-categories')).data,
    enabled: open && form.kind === 'EXPENSE',
  });

  const needsQty = ['INWARD', 'SALE', 'OUTWARD', 'WASTAGE', 'ADJUSTMENT'].includes(form.kind);
  const needsAmount = form.kind === 'SALE' || form.kind === 'EXPENSE';
  const needsMode = form.kind === 'SALE' || form.kind === 'EXPENSE';
  const needsAccount = needsMode && form.mode !== 'CASH';
  const valid = (!needsQty || !!form.qtyKg)
    && (!needsAmount || !!form.amountInr)
    && (form.kind !== 'EXPENSE' || !!form.categoryId)
    && (!needsAccount || !!form.ledgerCode)
    && (!requireReason || !!form.correctionReason.trim());

  const save = useMutation({
    mutationFn: () => api.post(`/poultry/stall-days/${day.id}/txns`, {
      kind: form.kind,
      ...(needsQty && form.qtyKg ? { qtyKg: Number(form.qtyKg) } : {}),
      ...(form.kind === 'INWARD' && form.birds ? { birds: Number(form.birds) } : {}),
      ...(needsAmount && form.amountInr ? { amountInr: Number(form.amountInr) } : {}),
      ...(needsMode ? { mode: form.mode } : {}),
      ...(needsAccount && form.ledgerCode ? { ledgerCode: form.ledgerCode } : {}),
      ...(form.kind === 'INWARD' && form.pickupId ? { pickupId: form.pickupId } : {}),
      ...(form.kind === 'EXPENSE' && form.categoryId ? { categoryId: form.categoryId } : {}),
      ...(form.note ? { note: form.note } : {}),
      ...(form.correctionReason.trim() ? { correctionReason: form.correctionReason.trim() } : {}),
    }),
    onSuccess: () => { toast.success(requireReason ? 'Correction recorded' : 'Entry recorded'); onClose(); onDone(); },
    onError: (e) => toast.error(apiErrorMessage(e)),
  });

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={requireReason ? 'Add correction' : 'Add entry'}
      subtitle={`${day.stall.name} · ${fmtDate(day.date)}${requireReason ? ' — the day is finalized, so a reason is required' : ''}`}
      width={620}
      footer={(
        <>
          <button className="btn-secondary" onClick={onClose}>Cancel</button>
          <button className="btn-primary" disabled={save.isPending || !valid} onClick={() => save.mutate()}>
            {save.isPending ? 'Saving…' : requireReason ? 'Record correction' : 'Record entry'}
          </button>
        </>
      )}
    >
      <FormSection title="The movement">
        <Field label="Kind" required>
          <select className="input" value={form.kind} onChange={(e) => setForm({ ...EMPTY_ENTRY, kind: e.target.value, correctionReason: form.correctionReason })}>
            {STALL_TXN_KINDS.map((k) => <option key={k} value={k}>{humanStatus(k)}</option>)}
          </select>
        </Field>
        {needsQty && (
          <Field label={form.kind === 'ADJUSTMENT' ? 'Quantity (kg, signed)' : 'Quantity (kg)'} required hint={form.kind === 'ADJUSTMENT' ? 'Negative removes stock' : undefined}>
            <input className="input" type="number" step="0.1" min={form.kind === 'ADJUSTMENT' ? undefined : 0} value={form.qtyKg} onChange={(e) => setForm({ ...form, qtyKg: e.target.value })} />
          </Field>
        )}
        {form.kind === 'INWARD' && (
          <>
            <Field label="Birds">
              <input className="input" type="number" min={0} value={form.birds} onChange={(e) => setForm({ ...form, birds: e.target.value })} />
            </Field>
            <Field label="From pickup">
              <select className="input" value={form.pickupId} onChange={(e) => setForm({ ...form, pickupId: e.target.value })}>
                <option value="">Not from a recorded pickup</option>
                {(pickups ?? []).map((p) => <option key={p.id} value={p.id}>{`${p.reference} · ${p.batch.code} · ${p.weightKg}kg`}</option>)}
              </select>
            </Field>
          </>
        )}
        {needsAmount && (
          <Field label="Amount (₹)" required>
            <input className="input" type="number" min={1} value={form.amountInr} onChange={(e) => setForm({ ...form, amountInr: e.target.value })} />
          </Field>
        )}
        {form.kind === 'EXPENSE' && (
          <Field label="Category" required>
            <select className="input" value={form.categoryId} onChange={(e) => setForm({ ...form, categoryId: e.target.value })}>
              <option value="">Choose…</option>
              {(categories ?? []).map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
          </Field>
        )}
        {needsMode && (
          <Field label="Mode" required>
            <select className="input" value={form.mode} onChange={(e) => setForm({ ...form, mode: e.target.value })}>
              {['CASH', 'BANK', 'UPI'].map((m) => <option key={m} value={m}>{humanStatus(m)}</option>)}
            </select>
          </Field>
        )}
        {needsAccount && (
          <Field label="Account" required>
            <select className="input" value={form.ledgerCode} onChange={(e) => setForm({ ...form, ledgerCode: e.target.value })}>
              <option value="">Choose…</option>
              {(accounts ?? []).map((a) => <option key={a.ledgerCode} value={a.ledgerCode}>{a.name}</option>)}
            </select>
          </Field>
        )}
        <Field label="Note" span={2}>
          <input className="input" value={form.note} onChange={(e) => setForm({ ...form, note: e.target.value })} />
        </Field>
        {requireReason && (
          <Field label="Correction reason" required span={2} hint="Audited — says why a finalized day changed">
            <input className="input" value={form.correctionReason} onChange={(e) => setForm({ ...form, correctionReason: e.target.value })} />
          </Field>
        )}
      </FormSection>
    </Modal>
  );
}
