'use client';

import { SubscriptionPlans } from './subscription-plans';

/**
 * SaaS billing. The plan, seats, price and status all come from `GET /subscription`;
 * a change goes through `PATCH /subscription`, which accepts self-serve plans only.
 * There is no usage metering API, so this page shows no usage figures rather than
 * invented ones.
 */
export function SubscriptionDashboard() {
  return (
    <div style={{ animation: 'fadeUp .4s ease', padding: 24, maxWidth: 1000, margin: '0 auto' }}>
      <div style={{ marginBottom: 24 }}>
        <h1 style={{ fontSize: 26, fontWeight: 700, letterSpacing: '-.02em', margin: 0 }}>Subscription &amp; Billing</h1>
        <p style={{ fontSize: 14, color: 'var(--ink-2)', marginTop: 6 }}>Your plan, seats and price. Enterprise agreements are arranged with our team.</p>
      </div>
      <SubscriptionPlans />
    </div>
  );
}
