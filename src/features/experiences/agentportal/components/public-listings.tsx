'use client';

import { useEffect, useState } from 'react';
import { UserCircle2, Phone, Mail, Sparkles, Search } from 'lucide-react';
import { FilterOptions, MatchResult, Parsed, Property, money } from '../agentportal-client';
import { FilterBar, Filters, PropertyCard } from './shared';

const card: React.CSSProperties = { background: 'var(--surface)', border: '1px solid var(--line-soft)', borderRadius: 16 };

interface PublicData {
  agent: { name: string; slug: string; phone?: string; email?: string; photoUrl?: string; bio?: string };
  agency?: { name?: string; logoUrl?: string; primaryColor?: string; city?: string } | null;
  listings: Property[];
  options: FilterOptions;
}

async function pget(path: string) { const r = await fetch(`/api/agent-portal${path}`); if (!r.ok) throw new Error(String(r.status)); return r.json(); }

export function PublicListings({ slug }: { slug: string }) {
  const [data, setData] = useState<PublicData | null>(null);
  const [err, setErr] = useState(false);
  const [filters, setFilters] = useState<Filters>({});
  const [enquire, setEnquire] = useState(false);

  useEffect(() => {
    const qs = new URLSearchParams(Object.entries(filters).filter(([, v]) => v) as any).toString();
    pget(`/public/${slug}${qs ? `?${qs}` : ''}`).then(setData).catch(() => setErr(true));
  }, [slug, filters]);

  if (err) return <Shell><div style={{ textAlign: 'center', padding: 80, color: 'var(--ink-3)' }}>This agent page isn't available.</div></Shell>;
  if (!data) return <Shell><div style={{ textAlign: 'center', padding: 80, color: 'var(--ink-3)' }}>Loading…</div></Shell>;
  const a = data.agent;

  return (
    <Shell>
      {/* Agent hero */}
      <div style={{ ...card, padding: 22, marginBottom: 18, display: 'flex', gap: 18, alignItems: 'center', flexWrap: 'wrap' }}>
        <span style={{ width: 72, height: 72, borderRadius: 99, background: 'var(--brand-bg,#e9ecfb)', color: 'var(--brand,#132376)', display: 'flex', alignItems: 'center', justifyContent: 'center', overflow: 'hidden', flex: '0 0 72px' }}>
          {a.photoUrl ? <img src={a.photoUrl} alt={a.name} style={{ width: '100%', height: '100%', objectFit: 'cover' }} /> : <UserCircle2 size={40} />}
        </span>
        <div style={{ flex: 1, minWidth: 200 }}>
          <div style={{ fontSize: 11, letterSpacing: '.12em', textTransform: 'uppercase', color: 'var(--brand,#132376)', fontWeight: 700 }}>{data.agency?.name ?? 'Property Agent'}</div>
          <h1 style={{ fontSize: 24, fontWeight: 700, margin: '2px 0 0' }}>{a.name}</h1>
          {a.bio && <div style={{ fontSize: 13.5, color: 'var(--ink-2)', marginTop: 4 }}>{a.bio}</div>}
          <div style={{ display: 'flex', gap: 14, marginTop: 8, fontSize: 13, color: 'var(--ink-3)', flexWrap: 'wrap' }}>
            {a.phone && <span style={{ display: 'flex', alignItems: 'center', gap: 5 }}><Phone size={13} />{a.phone}</span>}
            {a.email && <span style={{ display: 'flex', alignItems: 'center', gap: 5 }}><Mail size={13} />{a.email}</span>}
          </div>
        </div>
        <button className="btn-primary" style={{ height: 42 }} onClick={() => setEnquire(true)}><Sparkles size={15} /> Tell us what you want</button>
      </div>

      <FilterBar options={data.options} value={filters} onChange={setFilters} />
      <div style={{ fontSize: 12.5, color: 'var(--ink-3)', marginBottom: 12 }}>{data.listings.length} available propert{data.listings.length === 1 ? 'y' : 'ies'}</div>
      {data.listings.length === 0 && <div style={{ ...card, padding: 40, textAlign: 'center', color: 'var(--ink-3)' }}>No listings match your filters.</div>}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(280px,1fr))', gap: 14 }}>
        {data.listings.map((p) => <PropertyCard key={p.id} p={p} />)}
      </div>

      {enquire && <EnquiryModal slug={slug} agentName={a.name} onClose={() => setEnquire(false)} />}
    </Shell>
  );
}

function Shell({ children }: { children: React.ReactNode }) {
  return (
    <div style={{ minHeight: '100vh', background: 'var(--surface-2)' }}>
      <div style={{ maxWidth: 1120, margin: '0 auto', padding: '28px 20px 64px' }}>{children}</div>
    </div>
  );
}

function EnquiryModal({ slug, agentName, onClose }: { slug: string; agentName: string; onClose: () => void }) {
  const [f, setF] = useState({ name: '', phone: '', message: '' });
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<{ matches: MatchResult[]; parsed: Parsed } | null>(null);
  const set = (k: string, v: string) => setF((s) => ({ ...s, [k]: v }));
  const submit = async () => {
    setBusy(true);
    try {
      const r = await fetch(`/api/agent-portal/public/${slug}/enquiry`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(f) });
      const d = await r.json();
      setResult({ matches: d.matches ?? [], parsed: d.parsed });
    } finally { setBusy(false); }
  };
  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 60, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }}>
      <div style={{ position: 'absolute', inset: 0, background: 'rgba(20,15,12,.5)' }} onClick={onClose} />
      <div style={{ ...card, position: 'relative', zIndex: 1, width: 560, maxWidth: '100%', maxHeight: '92vh', overflowY: 'auto', padding: 24, borderRadius: 18 }}>
        {!result ? (
          <>
            <div style={{ fontWeight: 700, fontSize: 17 }}>What are you looking for?</div>
            <div style={{ fontSize: 13, color: 'var(--ink-3)', margin: '4px 0 16px' }}>Describe it in your words — {agentName} will get back to you, and we'll show instant matches.</div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              <div style={{ display: 'flex', gap: 10 }}>
                <div style={{ flex: 1 }}><label className="label">Your name</label><input className="input" value={f.name} onChange={(e) => set('name', e.target.value)} /></div>
                <div style={{ flex: 1 }}><label className="label">Phone</label><input className="input" value={f.phone} onChange={(e) => set('phone', e.target.value)} /></div>
              </div>
              <div><label className="label">What you want</label><textarea className="input" style={{ minHeight: 90, paddingTop: 10, resize: 'vertical' }} value={f.message} onChange={(e) => set('message', e.target.value)} placeholder="e.g. 3 BHK apartment in Bandra under 2.5 cr, ready to move" /></div>
            </div>
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10, marginTop: 18 }}><button className="btn-secondary" onClick={onClose}>Cancel</button><button className="btn-primary" disabled={!f.name || !f.message || busy} onClick={submit}><Search size={15} /> {busy ? 'Finding…' : 'Find matches'}</button></div>
          </>
        ) : (
          <>
            <div style={{ fontWeight: 700, fontSize: 17 }}>Thanks, {f.name.split(' ')[0]}! 🎉</div>
            <div style={{ fontSize: 13, color: 'var(--ink-3)', margin: '4px 0 14px' }}>{agentName} has your enquiry. Here are {result.matches.length} matches based on what you described:</div>
            {result.matches.length === 0 && <div style={{ fontSize: 13.5, color: 'var(--ink-2)' }}>No exact matches right now — the agent will reach out with options.</div>}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(220px,1fr))', gap: 12 }}>
              {result.matches.map((m) => <PropertyCard key={m.property.id} p={m.property} matchPct={m.matchPct} reasons={m.reasons} />)}
            </div>
            <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 16 }}><button className="btn-primary" onClick={onClose}>Done</button></div>
          </>
        )}
      </div>
    </div>
  );
}
