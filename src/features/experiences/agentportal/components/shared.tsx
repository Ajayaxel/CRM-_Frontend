'use client';

import { BedDouble, Maximize, MapPin } from 'lucide-react';
import { FilterOptions, Property, STATUS_META, TYPE_LABEL, money, priceOf } from '../agentportal-client';

const card: React.CSSProperties = { background: 'var(--surface)', border: '1px solid var(--line-soft)', borderRadius: 16 };

export type Filters = { type?: string; listingType?: string; city?: string; bedrooms?: string; minPrice?: string; maxPrice?: string; q?: string };

export function FilterBar({ options, value, onChange, showListing = true }: { options?: FilterOptions; value: Filters; onChange: (f: Filters) => void; showListing?: boolean }) {
  const set = (k: keyof Filters, v: string) => onChange({ ...value, [k]: v || undefined });
  return (
    <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center', marginBottom: 16 }}>
      <input className="input" style={{ height: 38, width: 190 }} value={value.q ?? ''} onChange={(e) => set('q', e.target.value)} placeholder="Search title / ref / area" />
      <select className="input" style={{ height: 38, width: 130 }} value={value.type ?? ''} onChange={(e) => set('type', e.target.value)}>
        <option value="">Any type</option>{(options?.types ?? []).map((t) => <option key={t} value={t}>{TYPE_LABEL[t]}</option>)}
      </select>
      {showListing && <select className="input" style={{ height: 38, width: 110 }} value={value.listingType ?? ''} onChange={(e) => set('listingType', e.target.value)}>
        <option value="">Buy/Rent</option><option value="SALE">Buy</option><option value="RENT">Rent</option>
      </select>}
      <select className="input" style={{ height: 38, width: 130 }} value={value.city ?? ''} onChange={(e) => set('city', e.target.value)}>
        <option value="">Any city</option>{(options?.cities ?? []).map((c) => <option key={c} value={c}>{c}</option>)}
      </select>
      <select className="input" style={{ height: 38, width: 100 }} value={value.bedrooms ?? ''} onChange={(e) => set('bedrooms', e.target.value)}>
        <option value="">BHK</option>{(options?.bedrooms ?? [1, 2, 3, 4, 5]).map((b) => <option key={b} value={b}>{b} BHK</option>)}
      </select>
      <input className="input" style={{ height: 38, width: 110 }} type="number" value={value.minPrice ?? ''} onChange={(e) => set('minPrice', e.target.value)} placeholder="Min ₹" />
      <input className="input" style={{ height: 38, width: 110 }} type="number" value={value.maxPrice ?? ''} onChange={(e) => set('maxPrice', e.target.value)} placeholder="Max ₹" />
      {Object.values(value).some(Boolean) && <button className="btn-secondary" style={{ height: 38 }} onClick={() => onChange({})}>Clear</button>}
    </div>
  );
}

export function PropertyCard({ p, footer, matchPct, reasons }: { p: Property; footer?: React.ReactNode; matchPct?: number; reasons?: string[] }) {
  const st = STATUS_META[p.status];
  const img = p.images?.[0];
  return (
    <div style={{ ...card, padding: 0, overflow: 'hidden' }}>
      <div style={{ height: 140, background: img ? `center/cover url(${img})` : `linear-gradient(135deg, color-mix(in srgb, var(--brand,#132376) 12%, var(--surface)), var(--surface-2))`, position: 'relative' }}>
        {!img && <MapPin size={30} style={{ position: 'absolute', top: '50%', left: '50%', transform: 'translate(-50%,-50%)', color: 'color-mix(in srgb, var(--brand,#132376) 40%, var(--ink-3))' }} />}
        <span className="badge" style={{ position: 'absolute', top: 10, left: 10, background: st.bg, color: st.fg }}>{st.label}</span>
        {matchPct != null && <span className="badge" style={{ position: 'absolute', top: 10, right: 10, background: 'var(--brand,#132376)', color: '#fff' }}>{matchPct}% match</span>}
        <span style={{ position: 'absolute', bottom: 10, right: 10, background: 'var(--surface)', borderRadius: 8, padding: '3px 9px', fontWeight: 800, fontSize: 14, color: 'var(--brand,#132376)' }}>{money(priceOf(p))}{p.listingType === 'RENT' ? '/mo' : ''}</span>
      </div>
      <div style={{ padding: 14 }}>
        <div style={{ fontWeight: 700, fontSize: 14.5, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{p.title}</div>
        <div style={{ fontSize: 12, color: 'var(--ink-3)', marginTop: 2 }}>{[TYPE_LABEL[p.type], [p.area, p.city].filter(Boolean).join(', ')].filter(Boolean).join(' · ')}</div>
        <div style={{ display: 'flex', gap: 14, marginTop: 10, fontSize: 12.5, color: 'var(--ink-2)' }}>
          {p.bedrooms > 0 && <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}><BedDouble size={14} />{p.bedrooms} BHK</span>}
          {p.areaSqft > 0 && <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}><Maximize size={13} />{p.areaSqft.toLocaleString('en-IN')} sqft</span>}
        </div>
        {reasons && reasons.length > 0 && <div style={{ display: 'flex', gap: 5, flexWrap: 'wrap', marginTop: 10 }}>{reasons.map((r, i) => <span key={i} className="badge" style={{ background: 'var(--surface-2)', color: 'var(--ink-3)', fontSize: 10.5 }}>{r}</span>)}</div>}
        {p.agent && <div style={{ fontSize: 11.5, color: 'var(--ink-3)', marginTop: 10 }}>Agent: {p.agent.name}</div>}
        {footer}
      </div>
    </div>
  );
}
