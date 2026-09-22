'use client';

/**
 * The supervisor's daily workflow.
 *
 * They enter three things: the date, the weight they sampled, and the birds
 * that died. Day number, live birds, cumulative mortality, the percentage, the
 * target and the variance are all shown but never typed — a number a person
 * enters is a number that can disagree with the register it should have come
 * from.
 *
 * Built narrow-first, because it is used standing in a shed on a phone.
 */

import React, { useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { AlertTriangle, Check, MessageSquareWarning, Syringe } from 'lucide-react';
import { toast } from 'sonner';
import { api } from '@/lib/api';
import {
  Badge, Card, Field, FormSection, Modal, SectionTitle, Skeleton, StatCard, Status,
} from '../ui/kit';
import { PageHead, fmtDate, money } from '../ui/common';

interface Board {
  batch: {
    id: string; code: string; breed: string | null; placementDate: string;
    expectedPickupDate: string; kgPerBag: number; plannedFcr: number; phase: string;
  };
  farm: { id: string; code: string; name: string } | null;
  date: string;
  board: {
    ageDays: number; liveBirds: number; cumulativeMortality: number; mortalityPct: number;
    avgWeightGrams: number | null; previousWeightGrams: number | null; gainGrams: number | null;
    targetWeightGrams: number | null; weightVarianceGrams: number | null; weightVariancePct: number | null;
    targetCumFeedGrams: number | null; targetFcr: number | null; actualFcr: number | null;
  };
  birds: { placed: number; died: number; picked: number; live: number; impossible: boolean };
  feed: { bagsIssued: number; bagsReturned: number; bagsConsumed: number; feedConsumedKg: number };
  today: { id: string; avgWeightGrams: number | null; notes: string | null; feedbackCount: number } | null;
  vaccines: { scheduleItemId: string; name: string; dayDue: number; dueOn: string; daysLate: number; given: boolean }[];
  hasStandard: boolean;
}

interface BatchOption { id: string; code: string; farm?: { name: string } | null; status: string }
type Tone = 'active' | 'renewal' | 'expired' | 'neutral';

const CATEGORIES = [
  ['FEED_QUALITY', 'Feed quality'], ['WATER', 'Water'], ['BIRD_HEALTH', 'Bird health'],
  ['SHED_CONDITION', 'Shed condition'], ['MEDICINE', 'Medicine'], ['PAYMENT', 'Payment'],
  ['SUPERVISION', 'Supervision'], ['OTHER', 'Other'],
];

const today = () => new Date().toISOString().slice(0, 10);

export function DailyLiveScreen({ initialBatchId }: { initialBatchId?: string }) {
  const qc = useQueryClient();
  const [batchId, setBatchId] = useState(initialBatchId ?? '');
  const [date, setDate] = useState(today());
  const [weight, setWeight] = useState('');
  const [mortality, setMortality] = useState('');
  const [mortalityReason, setReason] = useState('');
  const [obs, setObs] = useState<Record<string, string>>({});
  const [notes, setNotes] = useState('');
  const [feedback, setFeedback] = useState<{ category: string; description: string; actionRequired: string; severity: string }[]>([]);
  const [feedbackOpen, setFeedbackOpen] = useState(false);

  const batches = useQuery({
    queryKey: ['py', 'batches', 'active'],
    queryFn: async () => (await api.get<{ data: BatchOption[] }>('/poultry/batches', { params: { status: 'ACTIVE', limit: 200 } })).data,
  });
  const options = useMemo<BatchOption[]>(() => batches.data?.data ?? [], [batches.data]);

  const board = useQuery({
    queryKey: ['py', 'daily-board', batchId, date],
    queryFn: async () => (await api.get<Board>(`/poultry/batches/${batchId}/daily-board`, { params: { date } })).data,
    enabled: !!batchId,
  });

  const submit = useMutation({
    mutationFn: async () => (await api.post('/poultry/daily-live', {
      batchId, date,
      avgWeightGrams: weight ? Number(weight) : undefined,
      mortalityBirds: mortality ? Number(mortality) : undefined,
      mortalityReason: mortalityReason || undefined,
      observations: Object.keys(obs).length ? obs : undefined,
      notes: notes || undefined,
      feedback: feedback.length ? feedback : undefined,
    })).data,
    onSuccess: () => {
      toast.success('Inspection recorded');
      setMortality(''); setReason(''); setFeedback([]); setNotes('');
      qc.invalidateQueries({ queryKey: ['py'] });
    },
    onError: (e: any) => toast.error(e?.response?.data?.message ?? 'Could not record the inspection'),
  });

  const b = board.data?.board;
  const varianceTone: Tone = b?.weightVariancePct == null ? 'neutral'
    : b.weightVariancePct <= -7 ? 'expired' : b.weightVariancePct < 0 ? 'renewal' : 'active';

  return (
    <div className="ds-page">
      <PageHead
        title="Daily farm live"
        subtitle="Enter the weight and the deaths. Day number, live birds, mortality % and the target come from the registers."
      />

      <Card>
        <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', alignItems: 'flex-end' }}>
          <Field label="Batch" required>
            <select className="input" style={{ minWidth: 240 }} value={batchId} onChange={(e) => setBatchId(e.target.value)}>
              <option value="">Choose a batch…</option>
              {options.map((o: BatchOption) => (
                <option key={o.id} value={o.id}>{o.code}{o.farm ? ` · ${o.farm.name}` : ''}</option>
              ))}
            </select>
          </Field>
          <Field label="Date" required>
            <input className="input" type="date" value={date} onChange={(e) => setDate(e.target.value)} max={today()} />
          </Field>
        </div>
      </Card>

      {!batchId ? null : board.isLoading || !board.data ? (
        <div style={{ marginTop: 16 }}><Skeleton rows={3} height={92} /></div>
      ) : (
        <>
          {board.data.birds.impossible && (
            <div style={{ marginTop: 16 }}>
              <Card tone="expired">
                <SectionTitle sub={`${board.data.birds.placed} placed · ${board.data.birds.died} dead · ${board.data.birds.picked} picked. One of those figures is wrong — a shed cannot hold a negative number of birds.`}>
                  This batch reconciles to {board.data.birds.live} birds
                </SectionTitle>
              </Card>
            </div>
          )}

          <div className="ds-grid ds-grid-kpi" style={{ marginTop: 16 }}>
            <StatCard label="Farm day" value={`Day ${b!.ageDays}`} hint={`placed ${fmtDate(board.data.batch.placementDate)}`} />
            <StatCard label="Live birds" value={b!.liveBirds.toLocaleString('en-IN')} hint={`${board.data.birds.placed.toLocaleString('en-IN')} placed`} />
            <StatCard
              label="Mortality"
              value={`${b!.mortalityPct}%`}
              hint={`${b!.cumulativeMortality.toLocaleString('en-IN')} birds cumulative`}
              tone={b!.mortalityPct >= 5 ? 'expired' : b!.mortalityPct >= 3 ? 'renewal' : 'active'}
            />
            <StatCard
              label="Feed consumed"
              value={`${board.data.feed.bagsConsumed} bags`}
              hint={`${board.data.feed.bagsIssued} issued − ${board.data.feed.bagsReturned} returned`}
            />
          </div>

          <div style={{ display: 'grid', gap: 16, gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', marginTop: 16 }}>
            <Card>
              <SectionTitle sub="Three numbers. Everything else on this page is worked out from them.">Today&apos;s entry</SectionTitle>
              <FormSection title="Observed">
                <Field label="Average weight (grams)" hint={b!.previousWeightGrams ? `Last weighed at ${b!.previousWeightGrams}g` : 'First weighing of the cycle.'}>
                  <input className="input" type="number" inputMode="numeric" value={weight} onChange={(e) => setWeight(e.target.value)} placeholder="1850" />
                </Field>
                <Field label="Deaths today">
                  <input className="input" type="number" inputMode="numeric" value={mortality} onChange={(e) => setMortality(e.target.value)} placeholder="0" />
                </Field>
                {Number(mortality) > 0 && (
                  <Field label="Reason" span={2}>
                    <input className="input" value={mortalityReason} onChange={(e) => setReason(e.target.value)} placeholder="Heat / culling / unknown" />
                  </Field>
                )}
              </FormSection>
              <FormSection title="Inspection">
                {[['feed', 'Feed'], ['water', 'Water'], ['birdCondition', 'Bird condition'], ['droppings', 'Droppings']].map(([k, label]) => (
                  <Field key={k} label={label}>
                    <select className="input" value={obs[k] ?? ''} onChange={(e) => setObs({ ...obs, [k]: e.target.value })}>
                      <option value="">—</option>
                      <option value="GOOD">Good</option>
                      <option value="FAIR">Fair</option>
                      <option value="POOR">Poor</option>
                    </select>
                  </Field>
                ))}
                <Field label="Needs" span={2} hint="Raise a requisition afterwards; this only flags it.">
                  <div style={{ display: 'flex', gap: 14, flexWrap: 'wrap' }}>
                    {[['needsMedicine', 'Medicine'], ['needsVaccine', 'Vaccine'], ['needsSupplement', 'Supplement']].map(([k, label]) => (
                      <label key={k} style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                        <input
                          type="checkbox"
                          checked={obs[k] === 'YES'}
                          onChange={(e) => setObs({ ...obs, [k]: e.target.checked ? 'YES' : '' })}
                        />
                        <span>{label}</span>
                      </label>
                    ))}
                  </div>
                </Field>
                <Field label="Observation" span={2}>
                  <textarea className="input" rows={2} value={notes} onChange={(e) => setNotes(e.target.value)} />
                </Field>
              </FormSection>

              <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap', marginTop: 4 }}>
                <button className="btn-secondary" onClick={() => setFeedbackOpen(true)}>
                  <MessageSquareWarning size={14} /> Farmer feedback{feedback.length ? ` (${feedback.length})` : ''}
                </button>
                <button
                  className="btn-primary"
                  style={{ marginLeft: 'auto' }}
                  disabled={submit.isPending || (!weight && !mortality && !feedback.length)}
                  onClick={() => submit.mutate()}
                >
                  {submit.isPending ? 'Recording…' : 'Submit inspection'}
                </button>
              </div>
            </Card>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
              <Card>
                <SectionTitle sub={board.data.hasStandard ? 'From the performance standard for this bird.' : 'No performance standard is configured, so there is nothing to compare against.'}>
                  Against target
                </SectionTitle>
                {board.data.hasStandard ? (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                    <Row label="Target weight" value={b!.targetWeightGrams ? `${b!.targetWeightGrams} g` : '—'} />
                    <Row label="Actual weight" value={b!.avgWeightGrams ? `${b!.avgWeightGrams} g` : 'not weighed today'} />
                    <Row
                      label="Variance"
                      value={b!.weightVarianceGrams === null ? '—' : `${b!.weightVarianceGrams > 0 ? '+' : ''}${b!.weightVarianceGrams} g (${b!.weightVariancePct}%)`}
                      tone={varianceTone}
                    />
                    <div style={{ height: 1, background: 'var(--hairline-soft)' }} />
                    <Row label="Gain since last weighing" value={b!.gainGrams === null ? '—' : `${b!.gainGrams} g`} />
                    <Row label="Target cumulative feed" value={b!.targetCumFeedGrams ? `${(b!.targetCumFeedGrams / 1000).toFixed(2)} kg/bird` : '—'} />
                    <Row label="Target FCR" value={b!.targetFcr ? String(b!.targetFcr) : '—'} />
                    <Row label="Live-weight FCR now" value={b!.actualFcr ? String(b!.actualFcr) : '—'} />
                  </div>
                ) : (
                  <p className="ds-caption">
                    Add one under settings — day, target weight, daily and cumulative feed, target FCR. It is
                    master data on purpose: a Cobb target is not a Ross target.
                  </p>
                )}
              </Card>

              <Card>
                <SectionTitle sub="Derived from the programme and what was actually given — nobody has to remember that day 12 was Tuesday.">
                  Vaccination
                </SectionTitle>
                {board.data.vaccines.length === 0 ? (
                  <p className="ds-caption">No vaccine programme configured.</p>
                ) : (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                    {board.data.vaccines.map((v) => (
                      <div key={v.scheduleItemId} style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                        {v.given
                          ? <Check size={15} style={{ color: 'var(--tone-active)' }} />
                          : <Syringe size={15} style={{ color: v.daysLate > 0 ? 'var(--tone-expired)' : 'var(--ink-3)' }} />}
                        <span style={{ fontWeight: v.given ? 400 : 600 }}>{v.name}</span>
                        <span className="ds-caption">day {v.dayDue}</span>
                        <span style={{ marginLeft: 'auto' }}>
                          {v.given
                            ? <Status tone="active">given</Status>
                            : v.daysLate > 0
                              ? <Badge tone="expired">{v.daysLate}d late</Badge>
                              : b!.ageDays >= v.dayDue
                                ? <Badge tone="renewal">due</Badge>
                                : <span className="ds-caption">{fmtDate(v.dueOn)}</span>}
                        </span>
                      </div>
                    ))}
                  </div>
                )}
              </Card>
            </div>
          </div>
        </>
      )}

      <FeedbackModal
        open={feedbackOpen}
        onClose={() => setFeedbackOpen(false)}
        items={feedback}
        onChange={setFeedback}
      />
    </div>
  );
}

function Row({ label, value, tone }: { label: string; value: string; tone?: Tone }) {
  const colour = tone === 'expired' ? 'var(--tone-expired)' : tone === 'renewal' ? 'var(--tone-renewal)' : tone === 'active' ? 'var(--tone-active)' : 'var(--ink-1)';
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12 }}>
      <span className="ds-caption">{label}</span>
      <span style={{ fontVariantNumeric: 'tabular-nums', color: colour, fontWeight: tone && tone !== 'neutral' ? 600 : 400 }}>{value}</span>
    </div>
  );
}

function FeedbackModal({ open, onClose, items, onChange }: {
  open: boolean; onClose: () => void;
  items: { category: string; description: string; actionRequired: string; severity: string }[];
  onChange: (v: typeof items) => void;
}) {
  const blank = { category: 'OTHER', description: '', actionRequired: '', severity: 'NORMAL' };
  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Farmer feedback"
      subtitle="One row per thing raised, with a category and an action — so the business can count them. A number buried in free text cannot be counted."
      width={760}
      footer={<button className="btn-primary" onClick={onClose}>Done</button>}
    >
      <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        {items.map((f, i) => (
          <div key={i} style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'flex-start' }}>
            <select className="input" style={{ width: 150 }} value={f.category} onChange={(e) => onChange(items.map((x, j) => (j === i ? { ...x, category: e.target.value } : x)))}>
              {CATEGORIES.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
            </select>
            <input className="input" style={{ flex: 2, minWidth: 200 }} placeholder="What the farmer said" value={f.description} onChange={(e) => onChange(items.map((x, j) => (j === i ? { ...x, description: e.target.value } : x)))} />
            <input className="input" style={{ flex: 1, minWidth: 160 }} placeholder="Action required" value={f.actionRequired} onChange={(e) => onChange(items.map((x, j) => (j === i ? { ...x, actionRequired: e.target.value } : x)))} />
            <select className="input" style={{ width: 110 }} value={f.severity} onChange={(e) => onChange(items.map((x, j) => (j === i ? { ...x, severity: e.target.value } : x)))}>
              <option value="NORMAL">Normal</option>
              <option value="HIGH">High</option>
            </select>
            <button className="btn-secondary" onClick={() => onChange(items.filter((_, j) => j !== i))}>−</button>
          </div>
        ))}
        <button className="btn-secondary" style={{ alignSelf: 'flex-start' }} onClick={() => onChange([...items, { ...blank }])}>
          Add feedback
        </button>
        {items.length === 0 && (
          <p className="ds-caption">
            <AlertTriangle size={13} style={{ verticalAlign: -2 }} /> Nothing raised today. Leave it empty if the
            farmer had nothing to say — an empty list is a real answer.
          </p>
        )}
      </div>
    </Modal>
  );
}
