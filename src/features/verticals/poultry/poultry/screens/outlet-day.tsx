'use client';

/**
 * The outlet's day: stock, cash and profit.
 *
 * Both reconciliations work the same way and for the same reason — the
 * EXPECTED figure is derived from the day's own movements and only the COUNTED
 * figure is entered. Nothing on this screen lets somebody close a gap by
 * editing the number it is measured against.
 */

import React, { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Banknote, PackageCheck, Scale } from 'lucide-react';
import { toast } from 'sonner';
import { api } from '@/lib/api';
import { Badge, Card, Field, FormSection, Modal, SectionTitle, Skeleton, StatCard } from '../ui/kit';
import { PageHead, fmtDate, money } from '../ui/common';

interface Position {
  day: { id: string; date: string; status: string; stall: { id: string; code: string; name: string }; openingStockKg: number };
  stock: {
    openingKg: number; receivedKg: number; soldKg: number; wasteKg: number;
    transferredOutKg: number; adjustmentKg: number;
    expectedClosingKg: number; countedClosingKg: number | null;
    varianceKg: number | null; varianceNote: string | null; wastePct: number;
  };
  cash: {
    openingInr: number; cashInInr: number; cashOutInr: number;
    expectedInr: number; countedInr: number | null; varianceInr: number | null; short: boolean;
  };
  money: { cashSalesInr: number; creditSalesInr: number; collectionsInr: number; withdrawalsInr: number; expensesInr: number };
  profit: {
    revenueInr: number; chickenCostInr: number; wasteCostInr: number; expensesInr: number;
    grossMarginInr: number; profitInr: number; avgCostPaisePerKg: number; avgSellPaisePerKg: number;
  };
}

interface StallDay { id: string; date: string; status: string; stall?: { name: string } | null }

const rupees = (paise: number) => `₹${(paise / 100).toFixed(2)}`;

export function OutletDayScreen() {
  const qc = useQueryClient();
  const [dayId, setDayId] = useState('');
  const [countStockOpen, setCountStock] = useState(false);
  const [countCashOpen, setCountCash] = useState(false);
  const [receiveOpen, setReceive] = useState(false);

  const days = useQuery({
    queryKey: ['py', 'stall-days'],
    queryFn: async () => {
      const r = await api.get<any>('/poultry/stall-days', { params: { limit: 60 } });
      return (r.data?.data ?? r.data ?? []) as StallDay[];
    },
  });
  const position = useQuery({
    queryKey: ['py', 'day-position', dayId],
    queryFn: async () => (await api.get<Position>(`/poultry/stall-days/${dayId}/position`)).data,
    enabled: !!dayId,
  });

  const invalidate = () => qc.invalidateQueries({ queryKey: ['py'] });
  const p = position.data;

  return (
    <div className="ds-page">
      <PageHead
        title="Outlet day"
        subtitle="Opening + received − sold − waste ± adjustments = expected closing. Only the counted figure is entered."
        actions={(
          <>
            <button className="btn-secondary" disabled={!dayId} onClick={() => setReceive(true)}>Receive stock</button>
            <button className="btn-secondary" disabled={!dayId} onClick={() => setCountStock(true)}>Count the floor</button>
            <button className="btn-primary" disabled={!dayId} onClick={() => setCountCash(true)}>Count the till</button>
          </>
        )}
      />

      <Card>
        <Field label="Outlet day" required>
          <select className="input" style={{ minWidth: 320 }} value={dayId} onChange={(e) => setDayId(e.target.value)}>
            <option value="">Choose a day…</option>
            {(days.data ?? []).map((d) => (
              <option key={d.id} value={d.id}>{d.stall?.name ?? 'Outlet'} · {fmtDate(d.date)} · {d.status.toLowerCase()}</option>
            ))}
          </select>
        </Field>
      </Card>

      {!dayId ? null : position.isLoading || !p ? (
        <div style={{ marginTop: 16 }}><Skeleton rows={3} height={92} /></div>
      ) : (
        <>
          <div className="ds-grid ds-grid-kpi" style={{ marginTop: 16 }}>
            <StatCard label="Revenue" value={money(p.profit.revenueInr)} hint={`${p.stock.soldKg} kg sold`} />
            <StatCard label="Chicken cost" value={money(p.profit.chickenCostInr)} hint={`at ${rupees(p.profit.avgCostPaisePerKg)}/kg in`} />
            <StatCard
              label="Day profit"
              value={money(p.profit.profitInr)}
              hint={`sold at ${rupees(p.profit.avgSellPaisePerKg)}/kg`}
              tone={p.profit.profitInr >= 0 ? 'active' : 'expired'}
            />
            <StatCard
              label="Waste"
              value={`${p.stock.wasteKg} kg`}
              hint={`${money(p.profit.wasteCostInr)} · ${p.stock.wastePct}% of stock`}
              tone={p.stock.wastePct >= 3 ? 'expired' : p.stock.wastePct > 0 ? 'renewal' : 'neutral'}
            />
          </div>

          <div style={{ display: 'grid', gap: 16, gridTemplateColumns: 'repeat(auto-fit, minmax(330px, 1fr))', marginTop: 16 }}>
            <Card tone={p.stock.varianceKg ? 'expired' : undefined}>
              <SectionTitle sub="Derived from the day's movements. The counted figure never overwrites it.">
                <Scale size={15} style={{ verticalAlign: -2 }} /> Stock
              </SectionTitle>
              <Line label="Opening" value={`${p.stock.openingKg} kg`} />
              <Line label="Received" value={`+ ${p.stock.receivedKg} kg`} />
              <Line label="Sold" value={`− ${p.stock.soldKg} kg`} muted />
              <Line label="Waste" value={`− ${p.stock.wasteKg} kg`} muted />
              {p.stock.transferredOutKg > 0 && <Line label="Transferred out" value={`− ${p.stock.transferredOutKg} kg`} muted />}
              {p.stock.adjustmentKg !== 0 && <Line label="Adjustments" value={`${p.stock.adjustmentKg > 0 ? '+' : ''}${p.stock.adjustmentKg} kg`} muted />}
              <Rule />
              <Line label="Expected closing" value={`${p.stock.expectedClosingKg} kg`} strong />
              <Line label="Counted" value={p.stock.countedClosingKg === null ? 'not counted' : `${p.stock.countedClosingKg} kg`} />
              {p.stock.varianceKg !== null && (
                <>
                  <Rule />
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span>Variance</span>
                    {p.stock.varianceKg === 0
                      ? <Badge tone="active">reconciles</Badge>
                      : <Badge tone="expired">{p.stock.varianceKg < 0 ? 'short' : 'over'} {Math.abs(p.stock.varianceKg)} kg</Badge>}
                  </div>
                  {p.stock.varianceNote && <p className="ds-caption" style={{ marginTop: 6 }}>{p.stock.varianceNote}</p>}
                </>
              )}
            </Card>

            <Card tone={p.cash.varianceInr ? 'expired' : undefined}>
              <SectionTitle sub="Collections are cash in without being revenue; withdrawals are cash out without being an expense.">
                <Banknote size={15} style={{ verticalAlign: -2 }} /> Till
              </SectionTitle>
              <Line label="Opening" value={money(p.cash.openingInr)} />
              <Line label="Cash sales" value={`+ ${money(p.money.cashSalesInr)}`} />
              <Line label="Collections" value={`+ ${money(p.money.collectionsInr)}`} />
              <Line label="Expenses" value={`− ${money(p.money.expensesInr)}`} muted />
              <Line label="Withdrawals" value={`− ${money(p.money.withdrawalsInr)}`} muted />
              <Rule />
              <Line label="Expected" value={money(p.cash.expectedInr)} strong />
              <Line label="Counted" value={p.cash.countedInr === null ? 'not counted' : money(p.cash.countedInr)} />
              {p.cash.varianceInr !== null && (
                <>
                  <Rule />
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span>Variance</span>
                    {p.cash.varianceInr === 0
                      ? <Badge tone="active">reconciles</Badge>
                      : <Badge tone="expired">{p.cash.short ? 'short' : 'over'} {money(Math.abs(p.cash.varianceInr))}</Badge>}
                  </div>
                </>
              )}
              {p.money.creditSalesInr > 0 && (
                <p className="ds-caption" style={{ marginTop: 8 }}>
                  {money(p.money.creditSalesInr)} sold on credit — revenue today, cash later.
                </p>
              )}
            </Card>

            <Card>
              <SectionTitle sub="Waste is costed apart from sales, so a waste problem does not read as a pricing problem.">
                Day profit
              </SectionTitle>
              <Line label="Revenue" value={money(p.profit.revenueInr)} />
              <Line label="Chicken sold, at cost" value={`− ${money(p.profit.chickenCostInr)}`} muted />
              <Rule />
              <Line label="Gross margin" value={money(p.profit.grossMarginInr)} strong />
              <Line label="Waste, at cost" value={`− ${money(p.profit.wasteCostInr)}`} muted />
              <Line label="Expenses" value={`− ${money(p.profit.expensesInr)}`} muted />
              <Rule />
              <Line label="Day profit" value={money(p.profit.profitInr)} strong />
            </Card>
          </div>
        </>
      )}

      <CountModal
        open={countStockOpen}
        onClose={() => setCountStock(false)}
        title="Count the floor"
        subtitle={p ? `Expected ${p.stock.expectedClosingKg} kg from the day's movements.` : ''}
        label="Counted closing stock (kg)"
        expected={p?.stock.expectedClosingKg ?? 0}
        submit={async (value, note) => {
          await api.post(`/poultry/stall-days/${dayId}/count-stock`, { countedClosingKg: value, note });
        }}
        onSaved={invalidate}
      />
      <CountModal
        open={countCashOpen}
        onClose={() => setCountCash(false)}
        title="Count the till"
        subtitle={p ? `Expected ${money(p.cash.expectedInr)} from opening, sales, collections, expenses and withdrawals.` : ''}
        label="Counted cash (₹)"
        expected={p?.cash.expectedInr ?? 0}
        submit={async (value, note) => {
          await api.post(`/poultry/stall-days/${dayId}/cash`, { countedCashInr: Math.round(value), note });
        }}
        onSaved={invalidate}
      />
      <ReceiveModal open={receiveOpen} onClose={() => setReceive(false)} stallDayId={dayId} onSaved={invalidate} />
    </div>
  );
}

function Rule() {
  return <div style={{ height: 1, background: 'var(--hairline-soft)', margin: '6px 0' }} />;
}

function Line({ label, value, strong, muted }: { label: string; value: string; strong?: boolean; muted?: boolean }) {
  return (
    <div style={{
      display: 'flex', justifyContent: 'space-between', gap: 12, padding: '3px 0',
      fontWeight: strong ? 600 : 400, color: muted ? 'var(--ink-3)' : 'var(--ink-1)',
    }}>
      <span>{label}</span>
      <span style={{ fontVariantNumeric: 'tabular-nums', whiteSpace: 'nowrap' }}>{value}</span>
    </div>
  );
}

function CountModal({ open, onClose, title, subtitle, label, expected, submit, onSaved }: {
  open: boolean; onClose: () => void; title: string; subtitle: string; label: string;
  expected: number; submit: (value: number, note?: string) => Promise<void>; onSaved: () => void;
}) {
  const [value, setValue] = useState('');
  const [note, setNote] = useState('');
  const variance = value === '' ? null : Number(value) - expected;

  const save = useMutation({
    mutationFn: async () => submit(Number(value), note || undefined),
    onSuccess: () => { toast.success('Counted'); setValue(''); setNote(''); onSaved(); onClose(); },
    onError: (e: any) => toast.error(e?.response?.data?.message ?? 'Could not record the count'),
  });

  return (
    <Modal
      open={open} onClose={onClose} title={title} subtitle={subtitle} width={620}
      footer={(
        <>
          <button className="btn-secondary" onClick={onClose}>Cancel</button>
          <button
            className="btn-primary"
            disabled={save.isPending || value === '' || (variance !== 0 && !note.trim())}
            onClick={() => save.mutate()}
          >
            {save.isPending ? 'Recording…' : 'Record the count'}
          </button>
        </>
      )}
    >
      <FormSection title="Count">
        <Field label={label} required>
          <input className="input" type="number" step="0.001" value={value} onChange={(e) => setValue(e.target.value)} autoFocus />
        </Field>
        {variance !== null && variance !== 0 && (
          <Field
            label="Explanation"
            required
            span={2}
            hint="A gap that can be closed without saying why is not a control."
          >
            <input className="input" value={note} onChange={(e) => setNote(e.target.value)} placeholder="Why the count differs" />
          </Field>
        )}
      </FormSection>
      {variance !== null && (
        <p className="ds-caption">
          {variance === 0
            ? 'This reconciles exactly.'
            : `${variance < 0 ? 'Short' : 'Over'} by ${Math.abs(variance)} against an expected ${expected}.`}
        </p>
      )}
    </Modal>
  );
}

function ReceiveModal({ open, onClose, stallDayId, onSaved }: {
  open: boolean; onClose: () => void; stallDayId: string; onSaved: () => void;
}) {
  const [pickupId, setPickupId] = useState('');
  const [qtyKg, setQty] = useState('');
  const [note, setNote] = useState('');

  const pickups = useQuery({
    queryKey: ['py', 'pickups', 'for-outlet'],
    queryFn: async () => {
      const r = await api.get<any>('/poultry/pickups', { params: { limit: 60 } });
      return (r.data?.data ?? r.data ?? []) as { id: string; reference: string; weightKg: number; stallId: string | null; saleId: string | null }[];
    },
    enabled: open,
  });

  const save = useMutation({
    mutationFn: async () => (await api.post('/poultry/outlet/receive', {
      stallDayId,
      pickupId: pickupId || undefined,
      qtyKg: Number(qtyKg),
      note: note || undefined,
    })).data,
    onSuccess: () => { toast.success('Stock received'); setQty(''); onSaved(); onClose(); },
    onError: (e: any) => toast.error(e?.response?.data?.message ?? 'Could not receive'),
  });

  const chosen = (pickups.data ?? []).find((p) => p.id === pickupId);

  return (
    <Modal
      open={open} onClose={onClose} title="Receive stock" width={640}
      subtitle="From our own farm this is a transfer and posts nothing — the stock simply moved. The load's rate becomes the outlet's cost basis."
      footer={(
        <>
          <button className="btn-secondary" onClick={onClose}>Cancel</button>
          <button className="btn-primary" disabled={save.isPending || !Number(qtyKg)} onClick={() => save.mutate()}>
            {save.isPending ? 'Receiving…' : 'Receive'}
          </button>
        </>
      )}
    >
      <FormSection title="Receipt">
        <Field label="Against a load" hint="Optional — a direct receipt needs its own cost basis.">
          <select
            className="input"
            value={pickupId}
            onChange={(e) => {
              setPickupId(e.target.value);
              const p = (pickups.data ?? []).find((x) => x.id === e.target.value);
              if (p) setQty(String(p.weightKg));
            }}
          >
            <option value="">Direct receipt</option>
            {(pickups.data ?? []).filter((p) => !p.saleId).map((p) => (
              <option key={p.id} value={p.id}>{p.reference} · {p.weightKg} kg</option>
            ))}
          </select>
        </Field>
        <Field label="Quantity (kg)" required hint={chosen ? `The load carried ${chosen.weightKg} kg.` : undefined}>
          <input className="input" type="number" step="0.001" value={qtyKg} onChange={(e) => setQty(e.target.value)} />
        </Field>
        <Field label="Note" span={2}>
          <input className="input" value={note} onChange={(e) => setNote(e.target.value)} />
        </Field>
      </FormSection>
      <p className="ds-caption">
        <PackageCheck size={13} style={{ verticalAlign: -2 }} /> Receiving less than the load carried leaves a gap the
        farm-to-outlet reconciliation will raise — that is deliberate.
      </p>
    </Modal>
  );
}
