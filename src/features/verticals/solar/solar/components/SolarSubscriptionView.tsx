'use client';

import React, { useState } from 'react';
import { CreditCard, Calendar, CheckCircle2, ShieldCheck, DollarSign, ArrowUpRight, AlertCircle, Sparkles } from 'lucide-react';
import { SolarSubscription, SolarSubscriptionInvoice } from '../solar-client';

interface SubViewProps {
  subscription?: SolarSubscription;
}

export function SolarSubscriptionView({ subscription: initialSub }: SubViewProps) {
  const [sub, setSub] = useState<SolarSubscription>(
    initialSub || {
      id: 'sub-2001',
      customerId: 'cust-991',
      planId: 'plan-pro',
      plan: {
        id: 'plan-pro',
        name: 'Enterprise Lifetime Monitoring & AMC',
        price: 450,
        currency: 'AED',
        cycle: 'MONTHLY',
        covers: ['Live IoT Monitoring', 'Preventive Maintenance AMC', 'Priority Service SLA', 'Fault Auto-Tickets'],
        active: true,
      },
      startDate: '2026-01-01T00:00:00.000Z',
      nextBillingDate: '2026-08-01T00:00:00.000Z',
      status: 'ACTIVE',
      autoCharge: true,
      gracePeriodDays: 7,
      invoices: [
        {
          id: 'inv-8801',
          subscriptionId: 'sub-2001',
          period: '2026-07',
          amount: 450,
          taxAmount: 22.5,
          currency: 'AED',
          status: 'PAID',
          dueDate: '2026-07-07T00:00:00.000Z',
          paidAt: '2026-07-01T08:30:00.000Z',
        },
        {
          id: 'inv-8802',
          subscriptionId: 'sub-2001',
          period: '2026-08',
          amount: 450,
          taxAmount: 22.5,
          currency: 'AED',
          status: 'ISSUED',
          dueDate: '2026-08-07T00:00:00.000Z',
        },
      ],
    }
  );

  const [payingInvId, setPayingInvId] = useState<string | null>(null);

  const handlePay = (invId: string) => {
    setPayingInvId(invId);
    setTimeout(() => {
      setSub((prev) => ({
        ...prev,
        invoices: prev.invoices?.map((inv) =>
          inv.id === invId ? { ...inv, status: 'PAID', paidAt: new Date().toISOString() } : inv
        ),
      }));
      setPayingInvId(null);
    }, 1200);
  };

  return (
    <div
      className="space-y-6 p-6 rounded-2xl border shadow-2xl"
      style={{ background: 'var(--surface)', color: 'var(--ink)', borderColor: 'var(--hairline)' }}
    >
      {/* Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 border-b pb-4" style={{ borderColor: 'var(--hairline)' }}>
        <div>
          <div className="flex items-center gap-2">
            <span className="px-2.5 py-1 text-xs font-semibold rounded-full flex items-center gap-1" style={{ background: 'var(--tone-active-bg)', color: 'var(--tone-active)', border: '1px solid var(--tone-active-line)' }}>
              <Sparkles className="w-3.5 h-3.5" /> RECURRING REVENUE (2C)
            </span>
            <span className="text-xs font-mono" style={{ color: 'var(--ink-2)' }}>25-Year Plant Lifetime Contract</span>
          </div>
          <h2 className="text-xl font-bold mt-1" style={{ color: 'var(--ink)' }}>Subscription & AMC Billing Engine</h2>
        </div>

        <div className="flex items-center gap-2">
          <span className="px-3 py-1 text-xs font-bold rounded-full flex items-center gap-1.5" style={{ background: 'var(--tone-active-bg)', color: 'var(--tone-active)', border: '1px solid var(--tone-active-line)' }}>
            <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse"></span> STATUS: {sub.status}
          </span>
        </div>
      </div>

      {/* Plan Card */}
      <div className="p-6 rounded-xl border relative overflow-hidden" style={{ background: 'var(--surface-2)', borderColor: 'var(--hairline)' }}>
        <div className="absolute top-0 right-0 p-8 opacity-10 pointer-events-none">
          <CreditCard className="w-48 h-48" style={{ color: 'var(--tone-active)' }} />
        </div>

        <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 relative z-10">
          <div>
            <div className="text-xs font-semibold uppercase tracking-wider" style={{ color: 'var(--tone-active)' }}>Active Monitoring Plan</div>
            <h3 className="text-2xl font-black mt-1" style={{ color: 'var(--ink)' }}>{sub.plan?.name}</h3>
            <p className="text-xs mt-1" style={{ color: 'var(--ink-2)' }}>Includes automatic Razorpay/UPI recurring charge & ledger posting</p>
          </div>

          <div className="text-left md:text-right">
            <div className="text-3xl font-black font-mono" style={{ color: 'var(--ink)' }}>
              {sub.plan?.currency} {sub.plan?.price}
              <span className="text-sm font-normal" style={{ color: 'var(--ink-2)' }}>/{sub.plan?.cycle.toLowerCase()}</span>
            </div>
            <div className="text-xs mt-1 flex items-center md:justify-end gap-1" style={{ color: 'var(--ink-2)' }}>
              <Calendar className="w-3.5 h-3.5" style={{ color: 'var(--ink-3)' }} /> Next Billing: {new Date(sub.nextBillingDate).toLocaleDateString()}
            </div>
          </div>
        </div>

        {/* Plan Covers Tags */}
        <div className="mt-6 pt-4 border-t flex flex-wrap gap-2" style={{ borderColor: 'var(--hairline)' }}>
          {sub.plan?.covers?.map((c, i) => (
            <span key={i} className="px-2.5 py-1 text-xs font-medium rounded-md border flex items-center gap-1.5" style={{ background: 'var(--surface)', color: 'var(--ink-2)', borderColor: 'var(--hairline)' }}>
              <ShieldCheck className="w-3.5 h-3.5" style={{ color: 'var(--tone-active)' }} /> {c}
            </span>
          ))}
        </div>
      </div>

      {/* Invoices List */}
      <div className="rounded-xl border p-5 space-y-4" style={{ background: 'var(--surface-2)', borderColor: 'var(--hairline)' }}>
        <h3 className="text-sm font-semibold flex items-center justify-between" style={{ color: 'var(--ink)' }}>
          <span className="flex items-center gap-2">
            <DollarSign className="w-4 h-4" style={{ color: 'var(--tone-active)' }} /> Recurring Ledger Invoices (Idempotent Key: subId + period)
          </span>
        </h3>

        <div className="space-y-2.5">
          {sub.invoices?.map((inv) => (
            <div key={inv.id} className="p-4 rounded-lg border flex flex-col sm:flex-row sm:items-center justify-between gap-4 transition-colors" style={{ background: 'var(--surface)', borderColor: 'var(--hairline)' }}>
              <div>
                <div className="flex items-center gap-2">
                  <span className="font-bold text-sm" style={{ color: 'var(--ink)' }}>Period {inv.period}</span>
                  {inv.status === 'PAID' ? (
                    <span className="px-2 py-0.5 text-xs font-medium rounded flex items-center gap-1" style={{ background: 'var(--tone-active-bg)', color: 'var(--tone-active)', border: '1px solid var(--tone-active-line)' }}>
                      <CheckCircle2 className="w-3 h-3 text-[var(--tone-active)]" /> PAID
                    </span>
                  ) : (
                    <span className="px-2 py-0.5 text-xs font-medium rounded flex items-center gap-1" style={{ background: 'var(--tone-renewal-bg)', color: 'var(--tone-renewal)', border: '1px solid var(--tone-renewal-line)' }}>
                      <AlertCircle className="w-3 h-3 text-[var(--tone-renewal)]" /> ISSUED (Due: {new Date(inv.dueDate).toLocaleDateString()})
                    </span>
                  )}
                </div>
                <div className="text-xs mt-1" style={{ color: 'var(--ink-2)' }}>
                  Base: {inv.currency} {inv.amount} + Tax: {inv.currency} {inv.taxAmount}
                </div>
              </div>

              <div className="flex items-center justify-between sm:justify-end gap-4">
                <div className="text-right">
                  <div className="text-base font-bold font-mono" style={{ color: 'var(--ink)' }}>
                    {inv.currency} {(inv.amount + inv.taxAmount).toFixed(2)}
                  </div>
                </div>

                {inv.status !== 'PAID' && (
                  <button
                    onClick={() => handlePay(inv.id)}
                    disabled={payingInvId === inv.id}
                    className="px-3.5 py-1.5 font-medium text-xs rounded-lg shadow transition-all flex items-center gap-1.5 disabled:opacity-50 hover:opacity-90"
                    style={{ background: 'var(--tone-active)', color: 'var(--surface)' }}
                  >
                    {payingInvId === inv.id ? 'Processing Gateway...' : 'Pay via Razorpay'}
                    <ArrowUpRight className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
