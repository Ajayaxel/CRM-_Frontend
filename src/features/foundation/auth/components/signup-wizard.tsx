'use client';

import { useState } from 'react';
import Link from 'next/link';
import { toast } from 'sonner';
import { useAuth } from '../hooks/auth-context';
import { apiErrorMessage } from '@/lib/api';
import { GROUP_META, OrgVertical, VERTICAL_LIST, verticalConfig } from '@/lib/verticals';

type Plan = 'STARTER' | 'GROWTH' | 'PROFESSIONAL';

const card: React.CSSProperties = { border: '1px solid var(--line-soft)', borderRadius: 14, padding: 16, cursor: 'pointer', transition: 'border-color .12s, background .12s', background: 'var(--surface)' };
const selCard = (on: boolean): React.CSSProperties => ({ ...card, borderColor: on ? 'var(--brand,#132376)' : 'var(--line-soft)', background: on ? 'color-mix(in srgb, var(--brand,#132376) 10%, var(--surface))' : 'var(--surface)', boxShadow: on ? '0 0 0 1px var(--brand,#132376)' : 'none' });

const PLANS: { key: Plan; name: string; price: string; bullets: string[] }[] = [
  { key: 'STARTER', name: 'Starter', price: '₹3,000/mo', bullets: ['3 seats', 'Core modules', 'Email support'] },
  { key: 'GROWTH', name: 'Growth', price: '₹6,000/mo', bullets: ['10 seats', 'Automation + AI', 'Priority support'] },
  { key: 'PROFESSIONAL', name: 'Professional', price: '₹10,000/mo', bullets: ['Unlimited seats', 'All features', 'Dedicated success'] },
];

export function SignupWizard() {
  const { register } = useAuth();
  const [step, setStep] = useState(0);
  const [vertical, setVertical] = useState<OrgVertical>('INSTITUTE');
  const [omni, setOmni] = useState(false);
  const [plan, setPlan] = useState<Plan>('GROWTH');
  const [form, setForm] = useState({ organizationName: '', firstName: '', lastName: '', email: '', password: '' });
  const [loading, setLoading] = useState(false);

  const vcfg = verticalConfig(vertical);
  const baseProduct = vcfg?.product ?? null; // 'CRM' | 'ERP' | 'PRACTICE' | 'PMS' | null
  const products: ('CRM' | 'OMNI' | 'ERP' | 'PRACTICE' | 'PMS')[] = [...(baseProduct ? [baseProduct] : []), ...(omni ? ['OMNI' as const] : [])];

  // Steps: 0 business/vertical, 1 add-ons, 2 plan, 3 workspace.
  const steps = ['Business', 'Add-ons', 'Plan', 'Workspace'];
  const stepName = steps[step];

  const set = (k: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement>) => setForm({ ...form, [k]: e.target.value });

  const next = () => setStep((s) => Math.min(steps.length - 1, s + 1));
  const back = () => setStep((s) => Math.max(0, s - 1));

  const submit = async () => {
    setLoading(true);
    try {
      await register({
        organizationName: form.organizationName, firstName: form.firstName, lastName: form.lastName || undefined,
        email: form.email, password: form.password,
        products, vertical, plan,
      });
      toast.success('Your workspace is ready!');
      window.location.href = '/get-started';
    } catch (err) {
      toast.error(apiErrorMessage(err));
    } finally {
      setLoading(false);
    }
  };

  const canNext = true;
  const canSubmit = form.organizationName && form.firstName && form.email && form.password.length >= 8;

  return (
    <div style={{ maxWidth: 520 }}>
      <h2 className="text-2xl font-bold" style={{ color: 'var(--ink)' }}>Create your workspace</h2>
      <p className="mt-1 text-sm" style={{ color: 'var(--ink-3)' }}>14-day free trial · no card required.</p>

      {/* Progress dots */}
      <div style={{ display: 'flex', gap: 6, margin: '20px 0 22px' }}>
        {steps.map((s, i) => (
          <div key={s} style={{ flex: 1, height: 5, borderRadius: 20, background: i <= step ? 'var(--brand,#132376)' : 'var(--line-soft)' }} />
        ))}
      </div>

      {stepName === 'Business' && (
        <div>
          <div style={{ fontWeight: 700, fontSize: 15, marginBottom: 12 }}>What kind of business?</div>
          {(['service', 'healthcare', 'commerce'] as const).map((g) => (
            <div key={g} style={{ marginBottom: 16 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
                <span style={{ fontSize: 11, fontWeight: 700, letterSpacing: '.04em', color: 'var(--ink-3)', textTransform: 'uppercase' }}>{GROUP_META[g].label}</span>
                <span style={{ fontSize: 10.5, fontWeight: 700, color: 'var(--brand,#132376)', background: 'var(--brand-bg,#eef1fb)', borderRadius: 20, padding: '1px 8px' }}>{GROUP_META[g].product}</span>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                {VERTICAL_LIST.filter((v) => v.group === g).map((v) => (
                  <div key={v.key} style={selCard(vertical === v.key)} onClick={() => setVertical(v.key)}>
                    <div style={{ fontSize: 24 }}>{v.icon}</div>
                    <b style={{ fontSize: 14 }}>{v.label}</b>
                    <div style={{ fontSize: 11.5, color: 'var(--ink-3)', marginTop: 2 }}>{v.blurb}</div>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}

      {stepName === 'Add-ons' && (
        <div>
          <div style={{ fontWeight: 700, fontSize: 15, marginBottom: 4 }}>Your plan includes</div>
          <div style={{ ...selCard(true), cursor: 'default', marginBottom: 16 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <b>{vcfg?.icon} {vcfg?.label} · {baseProduct}</b><Check on />
            </div>
            <div style={{ fontSize: 12.5, color: 'var(--ink-3)', marginTop: 4 }}>{vcfg?.blurb}</div>
          </div>
          <div style={{ fontWeight: 700, fontSize: 15, marginBottom: 12 }}>Add omnichannel messaging &amp; AI?</div>
          <div style={selCard(omni)} onClick={() => setOmni((o) => !o)}>
            <div style={{ display: 'flex', justifyContent: 'space-between' }}><b>💬 Omnichannel + AI</b><Check on={omni} /></div>
            <div style={{ fontSize: 12.5, color: 'var(--ink-3)', marginTop: 4 }}>WhatsApp, social, web-chat, AI agents &amp; campaigns — bundled with your workspace.</div>
          </div>
          {omni && <div style={{ fontSize: 12, color: 'var(--brand,#132376)', fontWeight: 600, marginTop: 10 }}>✨ Best value — full {baseProduct} + Omni + AI.</div>}
        </div>
      )}

      {stepName === 'Plan' && (
        <div>
          <div style={{ fontWeight: 700, fontSize: 15, marginBottom: 12 }}>Choose a plan</div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {PLANS.map((p) => (
              <div key={p.key} style={selCard(plan === p.key)} onClick={() => setPlan(p.key)}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <b>{p.name}</b><span style={{ fontWeight: 700, color: 'var(--brand,#132376)' }}>{p.price}</span>
                </div>
                <div style={{ fontSize: 12, color: 'var(--ink-3)', marginTop: 4 }}>{p.bullets.join(' · ')}</div>
              </div>
            ))}
          </div>
        </div>
      )}

      {stepName === 'Workspace' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          <div><label className="label">Workspace name</label><input className="input" value={form.organizationName} onChange={set('organizationName')} placeholder={`${vcfg?.label ?? 'Acme'} workspace`} /></div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
            <div><label className="label">First name</label><input className="input" value={form.firstName} onChange={set('firstName')} /></div>
            <div><label className="label">Last name</label><input className="input" value={form.lastName} onChange={set('lastName')} /></div>
          </div>
          <div><label className="label">Work email</label><input className="input" type="email" value={form.email} onChange={set('email')} /></div>
          <div><label className="label">Password</label><input className="input" type="password" value={form.password} onChange={set('password')} minLength={8} placeholder="At least 8 characters" /></div>
        </div>
      )}

      {/* Nav */}
      <div style={{ display: 'flex', gap: 10, marginTop: 22 }}>
        {step > 0 && <button className="btn-secondary" onClick={back} disabled={loading}>Back</button>}
        {stepName !== 'Workspace'
          ? <button className="btn-primary" style={{ flex: 1 }} disabled={!canNext} onClick={next}>Continue</button>
          : <button className="btn-primary" style={{ flex: 1 }} disabled={!canSubmit || loading} onClick={submit}>{loading ? 'Creating…' : 'Create workspace'}</button>}
      </div>

      <p className="mt-6 text-center text-sm" style={{ color: 'var(--ink-3)' }}>
        Already have an account?{' '}
        <Link href="/login" className="font-medium text-brand-600 hover:underline">Sign in</Link>
      </p>
    </div>
  );
}

function Check({ on }: { on: boolean }) {
  return (
    <span style={{ width: 20, height: 20, borderRadius: '50%', border: '2px solid ' + (on ? 'var(--brand,#132376)' : 'var(--line-soft)'), background: on ? 'var(--brand,#132376)' : 'transparent', color: '#fff', fontSize: 12, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      {on ? '✓' : ''}
    </span>
  );
}
