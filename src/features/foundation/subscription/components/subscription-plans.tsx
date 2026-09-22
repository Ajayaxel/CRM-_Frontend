'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { Check } from 'lucide-react';
import { api, apiErrorMessage } from '@/lib/api';
import { useAuth } from '@/features/foundation/auth';
import { formatCurrencyInr } from '@/lib/utils';
import type { Plan, Subscription } from '@/lib/types';

const card: React.CSSProperties = {
  background: 'var(--surface)', border: '1px solid var(--line-soft)',
  borderRadius: 18, boxShadow: 'var(--shadow-1)',
};

const PLANS: { key: Plan; name: string; price: number; seats: string; features: string[] }[] = [
  { key: 'STARTER', name: 'Starter', price: 3000, seats: '3 users', features: ['Full CRM & Admissions', 'Tasks, Calendar, Documents', 'Basic Reports', 'Email Notifications'] },
  { key: 'GROWTH', name: 'Growth', price: 6000, seats: '10 users', features: ['Everything in Starter', 'Custom Stages, Fee & Batch Mgmt', 'Custom Fields & Roles', 'Analytics & Bulk Import'] },
  { key: 'PROFESSIONAL', name: 'Professional', price: 10000, seats: 'Unlimited', features: ['Everything in Growth', 'Multi-Branch & API Access', 'Attendance & Portals', 'Advanced Reports & White Label'] },
];

/**
 * The tenant's plan, from the API — the ONE place a plan is shown and changed.
 *
 * `/settings/billing` used to render its own copy with a fake mutation: it
 * reported "Upgraded … successfully!" without calling anything, over hard-coded
 * usage figures and prices that matched no plan the API sells.
 */
export function SubscriptionPlans() {
  const qc = useQueryClient();
  const { refreshUser, hasPermission } = useAuth();
  const canManage = hasPermission('subscription.manage');
  const { data: sub } = useQuery({
    queryKey: ['subscription'],
    queryFn: async () => (await api.get<Subscription>('/subscription')).data,
  });
  /** On a plan this screen does not sell — today that means ENTERPRISE. */
  const offCatalogue = !!sub && !PLANS.some((p) => p.key === sub.plan);
  const change = useMutation({
    mutationFn: (plan: Plan) => api.patch('/subscription', { plan }),
    onSuccess: async () => { qc.invalidateQueries({ queryKey: ['subscription'] }); await refreshUser(); toast.success('Plan updated'); },
    onError: (e) => toast.error(apiErrorMessage(e)),
  });

  return (
    <div>
      {sub && (
        <div style={{ ...card, padding: '20px 24px', marginBottom: 16, display: 'flex', justifyContent: 'space-between', flexWrap: 'wrap', gap: 12 }}>
          <div>
            <div className="eyebrow">Current plan</div>
            <div style={{ fontSize: 24, fontWeight: 800, marginTop: 4 }}>{sub.plan.charAt(0) + sub.plan.slice(1).toLowerCase()}</div>
          </div>
          <div style={{ textAlign: 'right', fontSize: 13, color: 'var(--ink-2)' }}>
            <div>{sub.seats >= 1000000 ? 'Unlimited seats' : `${sub.seats} seats`} · {formatCurrencyInr(sub.priceInr)}/mo</div>
            <div style={{ color: 'var(--ink-3)' }}>Status: {sub.status}</div>
          </div>
        </div>
      )}
      {/* An Enterprise tenant used to see three cards with none marked Current,
          a header reading "Enterprise", and three buttons any of which would
          have moved them off a ₹25,000 plan they could not get back to from
          this screen. The API refuses that now; this says why rather than
          leaving the grid looking broken. */}
      {offCatalogue && (
        <div style={{ ...card, padding: '14px 18px', marginBottom: 16, fontSize: 13, color: 'var(--ink-2)', lineHeight: 1.6 }}>
          You are on the <b>{sub.plan.charAt(0) + sub.plan.slice(1).toLowerCase()}</b> plan, which is
          arranged with our team rather than chosen here. The plans below are the
          self-service options — contact your account manager to change an
          {' '}{sub.plan.charAt(0) + sub.plan.slice(1).toLowerCase()} agreement.
        </div>
      )}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 16 }}>
        {PLANS.map((p) => {
          const current = sub?.plan === p.key;
          return (
            <div key={p.key} style={{ ...card, padding: 20, borderColor: current ? 'var(--navy)' : undefined, borderWidth: current ? 2 : 1, borderStyle: 'solid', display: 'flex', flexDirection: 'column' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div style={{ fontWeight: 700, fontSize: 16 }}>{p.name}</div>
                {current && <span className="badge" style={{ background: 'rgba(19,35,118,.1)', color: 'var(--navy)' }}>Current</span>}
              </div>
              <div style={{ fontSize: 26, fontWeight: 800, marginTop: 10 }}>{formatCurrencyInr(p.price)}<span style={{ fontSize: 13, fontWeight: 400, color: 'var(--ink-3)' }}>/mo</span></div>
              <div style={{ fontSize: 12, color: 'var(--ink-3)', marginTop: 2 }}>{p.seats}</div>
              <ul style={{ listStyle: 'none', padding: 0, margin: '14px 0 0', flex: 1, display: 'flex', flexDirection: 'column', gap: 8 }}>
                {p.features.map((f) => (
                  <li key={f} style={{ display: 'flex', gap: 8, fontSize: 12.5, color: 'var(--ink-2)' }}>
                    <Check size={15} color="var(--success)" style={{ flexShrink: 0, marginTop: 1 }} /> {f}
                  </li>
                ))}
              </ul>
              {canManage && offCatalogue !== true && (
                <button className={current ? 'btn-secondary' : 'btn-primary'} style={{ marginTop: 16 }} disabled={current || change.isPending} onClick={() => change.mutate(p.key)}>
                  {current ? 'Current plan' : `Switch to ${p.name}`}
                </button>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
