'use client';

/**
 * Premium collection on one policy.
 *
 * The money question a broker is asked every day and the console could not
 * answer: has this customer actually paid, and how much of what I am holding
 * still belongs to the insurer?
 *
 * The distinction the whole screen turns on is that premium is NOT the broker's
 * money. "Held for insurer" is the figure that matters — it is somebody else's
 * cash sitting in the broker's account until it is remitted.
 */

import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { Banknote, Check, Send, Undo2, AlertTriangle } from 'lucide-react';
import { api, apiErrorMessage } from '@/lib/api';
import { fmtOrgMoney } from '@/lib/org-locale';
import { Badge } from './kit';

const money = (n?: number | null) => fmtOrgMoney(n);

const MODES = [
  ['CASH', 'Cash'],
  ['UPI', 'UPI'],
  ['BANK_TRANSFER', 'Bank transfer'],
  ['CHEQUE', 'Cheque'],
  ['CARD', 'Card'],
  ['ONLINE', 'Online / gateway'],
] as const;

type Receipt = {
  id: string; receiptNo: string; amountInr: number; mode: string;
  reference?: string | null; receivedAt: string; note?: string | null;
  remittedAt?: string | null; remittanceRef?: string | null;
  voidedAt?: string | null; voidedReason?: string | null;
  collectedBy?: { firstName: string; lastName?: string | null } | null;
};

type Status = {
  collection: 'DIRECT_TO_INSURER' | 'VIA_BROKER';
  premiumInr: number; collectedInr: number; outstandingInr: number;
  heldInr: number; remittedInr: number; receipts: Receipt[];
};

export function PremiumPanel({ policyId, policyStatus }: { policyId: string; policyStatus?: string }) {
  const qc = useQueryClient();
  const key = ['ins-premium', policyId];
  const { data, isLoading } = useQuery<Status>({
    queryKey: key,
    queryFn: async () => (await api.get(`/insurance/policies/${policyId}/premium`)).data,
  });

  const [form, setForm] = useState({ amountInr: '', mode: 'UPI', reference: '', receivedAt: new Date().toISOString().slice(0, 10), note: '' });
  const [remitRef, setRemitRef] = useState('');

  const refresh = () => {
    qc.invalidateQueries({ queryKey: key });
    qc.invalidateQueries({ queryKey: ['ins-policies'] });
  };

  const record = useMutation({
    mutationFn: () => api.post(`/insurance/policies/${policyId}/receipts`, {
      amountInr: Number(form.amountInr),
      mode: form.mode,
      reference: form.reference || undefined,
      receivedAt: form.receivedAt || undefined,
      note: form.note || undefined,
    }),
    onSuccess: (r: any) => {
      toast.success(`Receipt ${r.data.receiptNo} recorded`);
      setForm((f) => ({ ...f, amountInr: '', reference: '', note: '' }));
      refresh();
    },
    onError: (e) => toast.error(apiErrorMessage(e)),
  });

  const remit = useMutation({
    mutationFn: (ids: string[]) => api.post('/insurance/receipts/remit', { receiptIds: ids, remittanceRef: remitRef }),
    onSuccess: (r: any) => { toast.success(`${r.data.remitted} receipt(s) remitted — ${money(r.data.totalInr)}`); setRemitRef(''); refresh(); },
    onError: (e) => toast.error(apiErrorMessage(e)),
  });

  const voidReceipt = useMutation({
    mutationFn: (v: { id: string; reason: string }) => api.post(`/insurance/receipts/${v.id}/void`, { reason: v.reason }),
    onSuccess: () => { toast.success('Receipt voided — a reversal was posted'); refresh(); },
    onError: (e) => toast.error(apiErrorMessage(e)),
  });

  const setCollection = useMutation({
    mutationFn: (mode: string) => api.patch(`/insurance/policies/${policyId}/premium-collection`, { mode }),
    onSuccess: () => { toast.success('Updated'); refresh(); },
    onError: (e) => toast.error(apiErrorMessage(e)),
  });

  if (isLoading || !data) return <div className="ds-caption" style={{ padding: 20 }}>Loading…</div>;

  const unremitted = data.receipts.filter((r) => !r.voidedAt && !r.remittedAt);
  const paidUp = data.outstandingInr === 0 && data.collectedInr > 0;
  const cancelled = policyStatus === 'CANCELLED';

  // The customer pays the insurer directly — the usual arrangement, and there
  // is nothing to track until somebody says otherwise.
  if (data.collection === 'DIRECT_TO_INSURER') {
    return (
      <div className="ds-stack" style={{ gap: 'var(--s-3)' }}>
        <div className="ds-card" style={{ padding: 'var(--s-4)' }}>
          <div className="ds-h3">The customer pays the insurer directly</div>
          <p className="ds-caption" style={{ marginTop: 'var(--s-2)', maxWidth: '38rem' }}>
            Nothing is collected through this office, so there is no premium to hold or remit.
            The brokerage on this policy is tracked separately under Commission.
          </p>
          <button
            className="btn-secondary btn-sm"
            style={{ marginTop: 'var(--s-3)' }}
            disabled={setCollection.isPending || cancelled}
            onClick={() => setCollection.mutate('VIA_BROKER')}
          >
            <Banknote size={14} /> We collect the premium for this policy
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="ds-stack" style={{ gap: 'var(--s-3)' }}>
      {/* ---- the four figures */}
      <div className="ds-grid" style={{ gridTemplateColumns: 'repeat(auto-fit,minmax(160px,1fr))', gap: 'var(--s-3)' }}>
        <Figure label="Premium" value={money(data.premiumInr)} />
        <Figure label="Collected" value={money(data.collectedInr)} />
        <Figure label="Outstanding" value={money(data.outstandingInr)} tone={data.outstandingInr > 0 ? 'renewal' : 'active'} />
        {/* The one figure that is not the broker's own money. */}
        <Figure label="Held for insurer" value={money(data.heldInr)} tone={data.heldInr > 0 ? 'info' : undefined} />
      </div>

      {paidUp && (
        <div style={{ display: 'flex', gap: 8, alignItems: 'center', padding: '10px 14px', borderRadius: 10, background: 'var(--tone-active-bg)', color: 'var(--tone-active)', fontSize: 13.5 }}>
          <Check size={16} /> Premium collected in full.
        </div>
      )}

      {/* ---- record a payment */}
      {!cancelled && data.outstandingInr > 0 && (
        <div className="ds-card" style={{ padding: 'var(--s-4)' }}>
          <div className="ds-h3" style={{ marginBottom: 'var(--s-3)' }}>Record a payment</div>
          <div className="ds-grid" style={{ gridTemplateColumns: 'repeat(auto-fit,minmax(150px,1fr))', gap: 'var(--s-3)' }}>
            <div>
              <label className="label">Amount</label>
              <input
                className="input" inputMode="numeric" value={form.amountInr}
                onChange={(e) => setForm({ ...form, amountInr: e.target.value.replace(/[^\d]/g, '') })}
                placeholder={String(data.outstandingInr)}
              />
            </div>
            <div>
              <label className="label">Mode</label>
              <select className="input" value={form.mode} onChange={(e) => setForm({ ...form, mode: e.target.value })}>
                {MODES.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
              </select>
            </div>
            <div>
              <label className="label">
                Reference {form.mode === 'CASH' && <span style={{ fontWeight: 400, color: 'var(--ink-3)' }}>(optional)</span>}
              </label>
              <input
                className="input" value={form.reference}
                onChange={(e) => setForm({ ...form, reference: e.target.value })}
                placeholder={form.mode === 'CHEQUE' ? 'Cheque number' : form.mode === 'CASH' ? '—' : 'UTR / transaction id'}
              />
            </div>
            <div>
              <label className="label">Received on</label>
              <input className="input" type="date" value={form.receivedAt} onChange={(e) => setForm({ ...form, receivedAt: e.target.value })} />
            </div>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--s-3)', marginTop: 'var(--s-3)' }}>
            <span className="ds-caption">
              Recorded against the insurer, not as income — the brokerage is the earning, this is money held.
            </span>
            <button
              className="btn-primary btn-sm"
              style={{ marginLeft: 'auto' }}
              disabled={record.isPending || !form.amountInr || Number(form.amountInr) <= 0}
              onClick={() => record.mutate()}
            >
              {record.isPending ? 'Saving…' : 'Record payment'}
            </button>
          </div>
        </div>
      )}

      {/* ---- remit what is held */}
      {unremitted.length > 0 && (
        <div className="ds-card" style={{ padding: 'var(--s-4)' }}>
          <div className="ds-h3">Remit to {`the insurer`}</div>
          <p className="ds-caption" style={{ marginTop: 'var(--s-1)', marginBottom: 'var(--s-3)' }}>
            {unremitted.length} receipt(s) totalling {money(unremitted.reduce((n, r) => n + r.amountInr, 0))} are still with us.
          </p>
          <div style={{ display: 'flex', gap: 'var(--s-2)', flexWrap: 'wrap' }}>
            <input
              className="input" style={{ flex: 1, minWidth: 200 }}
              value={remitRef} onChange={(e) => setRemitRef(e.target.value)}
              placeholder="Remittance reference — NEFT / UTR on the insurer's statement"
            />
            <button
              className="btn-secondary btn-sm"
              disabled={remit.isPending || !remitRef.trim()}
              onClick={() => remit.mutate(unremitted.map((r) => r.id))}
            >
              <Send size={14} /> {remit.isPending ? 'Remitting…' : 'Mark remitted'}
            </button>
          </div>
        </div>
      )}

      {/* ---- the receipts themselves */}
      <div className="ds-card" style={{ padding: 'var(--s-4)' }}>
        <div className="ds-h3" style={{ marginBottom: 'var(--s-3)' }}>Receipts</div>
        {!data.receipts.length ? (
          <div className="ds-caption">Nothing collected on this policy yet.</div>
        ) : (
          <div className="ds-stack" style={{ gap: 'var(--s-2)' }}>
            {data.receipts.map((r) => (
              <div
                key={r.id}
                style={{
                  display: 'flex', alignItems: 'center', gap: 'var(--s-3)', padding: '10px 12px',
                  border: '1px solid var(--hairline)', borderRadius: 10,
                  opacity: r.voidedAt ? 0.6 : 1,
                }}
              >
                <div style={{ minWidth: 0, flex: 1 }}>
                  <div style={{ fontSize: 13.5, fontWeight: 600, textDecoration: r.voidedAt ? 'line-through' : 'none' }}>
                    {money(r.amountInr)} · {MODES.find(([v]) => v === r.mode)?.[1] ?? r.mode}
                  </div>
                  <div className="ds-caption">
                    {r.receiptNo} · {new Date(r.receivedAt).toLocaleDateString()}
                    {r.reference ? ` · ${r.reference}` : ''}
                    {r.collectedBy ? ` · ${r.collectedBy.firstName}` : ''}
                    {/* A void without its reason is just a missing row. */}
                    {r.voidedAt ? ` · voided: ${r.voidedReason}` : ''}
                    {r.remittedAt ? ` · remitted ${r.remittanceRef}` : ''}
                  </div>
                </div>
                {r.voidedAt ? (
                  <Badge tone="expired">Void</Badge>
                ) : r.remittedAt ? (
                  <Badge tone="active">Remitted</Badge>
                ) : (
                  <>
                    <Badge tone="info">Held</Badge>
                    <button
                      className="btn-ghost btn-sm"
                      title="Void this receipt"
                      onClick={() => {
                        const reason = window.prompt(`Void ${r.receiptNo} (${money(r.amountInr)})? Give a reason — a reversal is posted to the ledger.`);
                        if (reason?.trim()) voidReceipt.mutate({ id: r.id, reason: reason.trim() });
                      }}
                    >
                      <Undo2 size={14} />
                    </button>
                  </>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      {data.heldInr > 0 && (
        <div style={{ display: 'flex', gap: 8, alignItems: 'flex-start', padding: '10px 14px', borderRadius: 10, background: 'var(--tone-renewal-bg)', color: 'var(--tone-renewal)', fontSize: 13 }}>
          <AlertTriangle size={15} style={{ flexShrink: 0, marginTop: 1 }} />
          <span>{money(data.heldInr)} of the insurer&rsquo;s money is still with us. It shows in the ledger as Premium Payable to Insurers until it is remitted.</span>
        </div>
      )}
    </div>
  );
}

function Figure({ label, value, tone }: { label: string; value: string; tone?: string }) {
  return (
    <div className="ds-card" style={{ padding: 'var(--s-3) var(--s-4)' }}>
      <div className="ds-caption">{label}</div>
      <div
        className="ds-num"
        style={{ fontSize: 19, fontWeight: 680, marginTop: 2, color: tone ? `var(--tone-${tone})` : 'var(--ink)' }}
      >
        {value}
      </div>
    </div>
  );
}
