'use client';

import { useEffect, useState } from 'react';
import { use } from 'react';

/**
 * The customer's signing page. Deliberately outside the authenticated shell: the token
 * in the URL is the authorisation, and the page only ever shows the one proposal it
 * resolves to. No session, no nav, nothing else reachable from here.
 */
export default function SignPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = use(params);
  // Same-origin through the app's /api proxy — the in-app pages all work this way.
  // Calling the API's own origin from here dies on CORS, which no curl test can see.
  const base = '/api';

  const [data, setData] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);
  const [name, setName] = useState('');
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState<any>(null);

  useEffect(() => {
    fetch(`${base}/public/solar/proposals/${encodeURIComponent(token)}/data`)
      .then(async (r) => {
        const body = await r.json().catch(() => ({}));
        if (!r.ok) throw new Error(Array.isArray(body?.message) ? body.message[0] : body?.message ?? 'This link is not valid');
        return body;
      })
      .then(setData)
      .catch((e) => setError(e.message));
  }, [base, token]);

  const sign = async () => {
    if (!name.trim()) return setError('Please enter your name to accept');
    setBusy(true); setError(null);
    try {
      const r = await fetch(`${base}/public/solar/proposals/${encodeURIComponent(token)}/sign`, {
        method: 'POST', headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ signedName: name.trim() }),
      });
      const body = await r.json().catch(() => ({}));
      if (!r.ok) throw new Error(Array.isArray(body?.message) ? body.message[0] : body?.message ?? 'Could not accept');
      setDone(body);
    } catch (e: any) { setError(e.message); } finally { setBusy(false); }
  };

  const money = (n: number) => `${data?.currency ?? ''} ${Math.round(n ?? 0).toLocaleString('en-AE')}`;
  const payback = data?.paybackMonths > 0
    ? `${Math.floor(data.paybackMonths / 12)} yr ${data.paybackMonths % 12} mo` : '—';

  if (error && !data) return <Shell><Msg tone="bad" title="This link cannot be opened">{error}</Msg></Shell>;
  if (!data) return <Shell><Msg title="Loading your proposal…">One moment.</Msg></Shell>;

  if (done || data.signed) {
    const who = done?.signedName ?? data.signedName;
    return (
      <Shell company={data.company}>
        <Msg tone="good" title="Thank you — your proposal is accepted">
          Accepted by <strong>{who}</strong>. We&apos;ll be in touch to arrange the installation.
          {done?.project && <div style={{ marginTop: 8, opacity: .85 }}>Reference {done.project.code}</div>}
        </Msg>
      </Shell>
    );
  }

  return (
    <Shell company={data.company}>
      <div style={{ padding: '4px 4px 0' }}>
        <div style={{ fontSize: 12.5, letterSpacing: '.06em', textTransform: 'uppercase', color: '#8b93a7' }}>{data.code}{data.version ? ` · proposal V${data.version}` : ''}</div>
        <h1 style={{ fontSize: 26, letterSpacing: '-.02em', margin: '6px 0 2px' }}>Your solar proposal</h1>
        <p style={{ color: '#5a6377', margin: 0 }}>{data.customerName}{data.siteAddress ? ` · ${data.siteAddress}` : ''}</p>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(140px,1fr))', gap: 10, margin: '22px 0' }}>
        <Kpi label="System size" value={`${data.system.kwp} kWp`} hero />
        <Kpi label="Annual output" value={`${Math.round(data.annualGenerationKwh).toLocaleString('en-AE')} kWh`} />
        <Kpi label="Annual saving" value={money(data.annualSavingsInr)} />
        <Kpi label="Pays back in" value={payback} />
      </div>

      <Section title="What you're getting">
        <Row k="Solar panels" v={`${data.system.panelCount} × ${data.system.panelWattage} W`} />
        <Row k="Inverter" v={`${data.system.inverterKw} kW`} />
        {data.system.batteryKwh > 0 && <Row k="Battery storage" v={`${data.system.batteryKwh} kWh`} />}
        <Row k={`${data.horizonYears}-year saving`} v={money(data.lifetimeSavingsInr)} />
        <Row k="CO₂ avoided each year" v={`${Math.round(data.co2OffsetKgPerYear).toLocaleString('en-AE')} kg`} />
      </Section>

      <Section title="Investment">
        {(data.bom ?? []).map((l: any, i: number) => (
          <Row key={i} k={l.description} v={money(l.amountInr)} muted />
        ))}
        {data.subsidyInr > 0 && <Row k="Subsidy" v={`− ${money(data.subsidyInr)}`} muted />}
        <div style={{ display: 'flex', justifyContent: 'space-between', borderTop: '2px solid #141a2e', marginTop: 8, paddingTop: 10, fontWeight: 800, fontSize: 17 }}>
          <span>Total</span><span>{money(Math.max(0, data.systemCostInr - (data.subsidyInr ?? 0)))}</span>
        </div>
      </Section>

      {data.paymentLink && (
        <a href={data.paymentLink} target="_blank" rel="noreferrer" style={{ display: 'block', textAlign: 'center', border: '1.5px dashed #c67c1e', borderRadius: 12, padding: '13px 16px', margin: '18px 0 0', color: '#c67c1e', fontWeight: 700, textDecoration: 'none' }}>
          Pay the booking amount online →
        </a>
      )}

      {data.narrative && (
        <div style={{ background: '#f7f8fb', borderLeft: '3px solid #c67c1e', borderRadius: '0 10px 10px 0', padding: '13px 16px', color: '#4a5268', fontSize: 14.5, margin: '18px 0' }}>
          {data.narrative}
        </div>
      )}

      <div style={{ border: '1px solid #e4e7ee', borderRadius: 14, padding: 20, marginTop: 22 }}>
        <div style={{ fontWeight: 700, fontSize: 16, marginBottom: 4 }}>Accept this proposal</div>
        <p style={{ color: '#5a6377', fontSize: 14, margin: '0 0 14px' }}>
          Type your full name to accept. This is your electronic signature and forms the contract.
        </p>
        <input
          value={name} onChange={(e) => setName(e.target.value)} placeholder="Your full name"
          style={{ width: '100%', padding: '14px 15px', fontSize: 16, borderRadius: 11, border: '1px solid #d9dde6', marginBottom: 12 }}
        />
        {error && <div style={{ color: '#c0392b', fontSize: 14, marginBottom: 12 }}>{error}</div>}
        <button
          onClick={sign} disabled={busy || !name.trim()}
          style={{
            width: '100%', height: 54, borderRadius: 12, border: 'none', cursor: busy || !name.trim() ? 'default' : 'pointer',
            background: busy || !name.trim() ? '#a8b0c4' : '#132376', color: '#fff', fontSize: 16.5, fontWeight: 700,
          }}
        >
          {busy ? 'Accepting…' : 'Accept proposal'}
        </button>
        {data.expiresAt && (
          <div style={{ fontSize: 12.5, color: '#8b93a7', textAlign: 'center', marginTop: 10 }}>
            This link is valid until {new Date(data.expiresAt).toLocaleDateString('en-AE', { day: '2-digit', month: 'long', year: 'numeric' })}.
          </div>
        )}
      </div>
    </Shell>
  );
}

function Shell({ children, company }: { children: React.ReactNode; company?: string }) {
  return (
    <div style={{ minHeight: '100vh', background: '#f6f7fa', color: '#141a2e', font: '15px/1.55 ui-sans-serif,-apple-system,"Segoe UI",Roboto,Helvetica,Arial,sans-serif' }}>
      <div style={{ maxWidth: 660, margin: '0 auto', padding: '28px 18px 60px' }}>
        {company && <div style={{ fontWeight: 800, color: '#132376', fontSize: 18, marginBottom: 18 }}>{company}</div>}
        <div style={{ background: '#fff', borderRadius: 16, padding: 26, boxShadow: '0 2px 18px rgba(20,26,46,.07)' }}>{children}</div>
      </div>
    </div>
  );
}
function Msg({ title, children, tone }: { title: string; children: React.ReactNode; tone?: 'good' | 'bad' }) {
  const c = tone === 'good' ? { bg: '#e9f6ee', bd: '#bfe3cd', fg: '#1e874b' } : tone === 'bad' ? { bg: '#fce8e8', bd: '#f0c4c4', fg: '#c0392b' } : { bg: '#f7f8fb', bd: '#e4e7ee', fg: '#4a5268' };
  return (
    <div style={{ background: c.bg, border: `1px solid ${c.bd}`, borderRadius: 12, padding: 20, textAlign: 'center' }}>
      <div style={{ fontWeight: 700, fontSize: 17, color: c.fg, marginBottom: 6 }}>{title}</div>
      <div style={{ color: '#4a5268', fontSize: 14.5 }}>{children}</div>
    </div>
  );
}
function Kpi({ label, value, hero }: { label: string; value: string; hero?: boolean }) {
  return (
    <div style={{ background: '#f7f8fb', border: '1px solid #e4e7ee', borderRadius: 12, padding: '13px 15px' }}>
      <div style={{ fontSize: 11, textTransform: 'uppercase', letterSpacing: '.05em', color: '#8b93a7' }}>{label}</div>
      <div style={{ fontSize: hero ? 25 : 19, fontWeight: 800, marginTop: 3, letterSpacing: '-.02em', color: hero ? '#132376' : undefined }}>{value}</div>
    </div>
  );
}
function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div style={{ marginTop: 22 }}>
      <div style={{ fontSize: 15, fontWeight: 700, paddingBottom: 7, borderBottom: '1px solid #e4e7ee', marginBottom: 8 }}>{title}</div>
      {children}
    </div>
  );
}
function Row({ k, v, muted }: { k: string; v: string; muted?: boolean }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', gap: 14, padding: '6px 0', fontSize: 14.5, color: muted ? '#5a6377' : undefined }}>
      <span>{k}</span><span style={{ fontVariantNumeric: 'tabular-nums', whiteSpace: 'nowrap' }}>{v}</span>
    </div>
  );
}
