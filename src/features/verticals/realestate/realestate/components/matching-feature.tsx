'use client';

import { useState } from 'react';
import { useMutation, useQuery } from '@tanstack/react-query';
import { Sparkles, Users, BedDouble, Maximize, MapPin, TrendingUp, Wand2 } from 'lucide-react';
import { api } from '@/lib/api';
import { BuyerLead, PropertyMatch, PropertyPurpose, PropertyType, PROPERTY_TYPE_META, STATUS_META, money } from '../realestate-client';
import { cur } from '@/lib/org-locale';

const card: React.CSSProperties = { background: 'var(--surface)', border: '1px solid var(--line-soft)', borderRadius: 16 };
const TYPES: PropertyType[] = ['APARTMENT', 'VILLA', 'TOWNHOUSE', 'PENTHOUSE', 'OFFICE', 'SHOP', 'WAREHOUSE', 'LAND', 'STUDIO'];
const KIND_META: Record<string, { label: string; icon: string }> = {
  BUYER: { label: 'Buyer', icon: '🔑' }, INVESTOR: { label: 'Investor', icon: '📈' },
  TENANT: { label: 'Tenant', icon: '🏠' }, SELLER: { label: 'Seller', icon: '🏷️' }, LANDLORD: { label: 'Landlord', icon: '🗝️' },
};

interface Criteria { purpose: PropertyPurpose; budgetMinInr: string; budgetMaxInr: string; bedroomsWanted: string; preferredArea: string; propertyTypePref: string }
const EMPTY: Criteria = { purpose: 'BUY', budgetMinInr: '', budgetMaxInr: '', bedroomsWanted: '', preferredArea: '', propertyTypePref: '' };

export function MatchingFeature() {
  const [criteria, setCriteria] = useState<Criteria>({ ...EMPTY });
  const [matches, setMatches] = useState<PropertyMatch[] | null>(null);
  const [activeBuyer, setActiveBuyer] = useState<string | null>(null);

  const { data: buyers } = useQuery({ queryKey: ['buyers'], queryFn: async () => (await api.get<BuyerLead[]>('/realestate/buyers')).data });

  const run = useMutation({
    mutationFn: () => api.post<PropertyMatch[]>('/realestate/match', {
      purpose: criteria.purpose,
      budgetMinInr: criteria.budgetMinInr ? Number(criteria.budgetMinInr) : undefined,
      budgetMaxInr: criteria.budgetMaxInr ? Number(criteria.budgetMaxInr) : undefined,
      bedroomsWanted: criteria.bedroomsWanted ? Number(criteria.bedroomsWanted) : undefined,
      preferredArea: criteria.preferredArea || undefined,
      propertyTypePref: criteria.propertyTypePref || undefined,
    }).then((r) => r.data),
    onSuccess: (d) => setMatches(d),
  });

  const loadBuyer = (b: BuyerLead) => {
    setActiveBuyer(b.id);
    setCriteria({
      purpose: (b.purpose ?? 'BUY') as PropertyPurpose,
      budgetMinInr: b.budgetMinInr?.toString() ?? '', budgetMaxInr: b.budgetMaxInr?.toString() ?? '',
      bedroomsWanted: b.bedroomsWanted?.toString() ?? '', preferredArea: b.preferredArea ?? '',
      propertyTypePref: b.propertyTypePref ?? '',
    });
    setMatches(null);
  };

  const set = (k: keyof Criteria, v: string) => { setCriteria((c) => ({ ...c, [k]: v })); setActiveBuyer(null); };

  return (
    <div style={{ animation: 'fadeUp .4s ease' }}>
      <div style={{ marginBottom: 18 }}>
        <h1 style={{ fontSize: 26, fontWeight: 700, letterSpacing: '-.02em', margin: 0, display: 'flex', alignItems: 'center', gap: 10 }}>
          <Sparkles size={24} style={{ color: 'var(--gold,#E6A23C)' }} /> Property Matching
        </h1>
        <p style={{ fontSize: 14, color: 'var(--ink-2)', margin: '6px 0 0' }}>AI recommendation — rank available listings against a buyer's requirements.</p>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '300px 1fr', gap: 16 }}>
        {/* Left: buyers + criteria */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          <div style={{ ...card, padding: 16 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 7, fontWeight: 700, fontSize: 13.5, marginBottom: 10 }}><Users size={15} /> Buyers &amp; requirements</div>
            {(buyers ?? []).length === 0 && <div style={{ fontSize: 12.5, color: 'var(--ink-3)' }}>No buyer leads yet.</div>}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {(buyers ?? []).map((b) => (
                <button key={b.id} onClick={() => loadBuyer(b)} style={{
                  textAlign: 'left', padding: 10, borderRadius: 10, cursor: 'pointer',
                  border: '1px solid ' + (activeBuyer === b.id ? 'var(--brand,#132376)' : 'var(--line-soft)'),
                  background: activeBuyer === b.id ? 'var(--brand-bg,#e9ecfb)' : 'var(--surface-2)',
                }}>
                  <div style={{ fontWeight: 600, fontSize: 13 }}>{KIND_META[b.leadKind ?? 'BUYER']?.icon} {b.firstName} {b.lastName ?? ''}</div>
                  <div style={{ fontSize: 11.5, color: 'var(--ink-3)', marginTop: 2 }}>
                    {money(b.budgetMinInr)}–{money(b.budgetMaxInr)}{b.bedroomsWanted ? ` · ${b.bedroomsWanted}BR` : ''}{b.preferredArea ? ` · ${b.preferredArea}` : ''}
                  </div>
                </button>
              ))}
            </div>
          </div>

          <div style={{ ...card, padding: 16 }}>
            <div style={{ fontWeight: 700, fontSize: 13.5, marginBottom: 12 }}>Criteria</div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              <div><label className="label">Purpose</label><select className="input" value={criteria.purpose} onChange={(e) => set('purpose', e.target.value)}><option value="BUY">Buy</option><option value="RENT">Rent</option><option value="INVEST">Invest</option></select></div>
              <div style={{ display: 'flex', gap: 8 }}>
                <div style={{ flex: 1 }}><label className="label">Budget min ({cur()})</label><input className="input" type="number" value={criteria.budgetMinInr} onChange={(e) => set('budgetMinInr', e.target.value)} /></div>
                <div style={{ flex: 1 }}><label className="label">Budget max ({cur()})</label><input className="input" type="number" value={criteria.budgetMaxInr} onChange={(e) => set('budgetMaxInr', e.target.value)} /></div>
              </div>
              <div style={{ display: 'flex', gap: 8 }}>
                <div style={{ flex: 1 }}><label className="label">Bedrooms</label><input className="input" type="number" value={criteria.bedroomsWanted} onChange={(e) => set('bedroomsWanted', e.target.value)} /></div>
                <div style={{ flex: 1 }}><label className="label">Type</label><select className="input" value={criteria.propertyTypePref} onChange={(e) => set('propertyTypePref', e.target.value)}><option value="">Any</option>{TYPES.map((t) => <option key={t} value={t}>{PROPERTY_TYPE_META[t].label}</option>)}</select></div>
              </div>
              <div><label className="label">Preferred area</label><input className="input" value={criteria.preferredArea} onChange={(e) => set('preferredArea', e.target.value)} placeholder="Bandra" /></div>
              <button className="btn-primary" disabled={run.isPending} onClick={() => run.mutate()}><Wand2 size={15} /> Find matches</button>
            </div>
          </div>
        </div>

        {/* Right: results */}
        <div>
          {matches == null && (
            <div style={{ ...card, padding: 50, textAlign: 'center', color: 'var(--ink-3)' }}>
              <Sparkles size={30} style={{ opacity: 0.4 }} />
              <div style={{ marginTop: 12, fontSize: 14 }}>Pick a buyer or set criteria, then run the matcher.</div>
            </div>
          )}
          {matches != null && matches.length === 0 && (
            <div style={{ ...card, padding: 50, textAlign: 'center', color: 'var(--ink-3)' }}>No matching available listings. Try widening the budget or area.</div>
          )}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            {(matches ?? []).map((m) => (
              <div key={m.property.id} style={{ ...card, padding: 16, display: 'flex', gap: 16, alignItems: 'center' }}>
                <MatchRing pct={m.matchPct} />
                <div style={{ width: 60, height: 60, borderRadius: 12, background: 'linear-gradient(135deg,var(--brand,#132376),#2a3a9e)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 26, flexShrink: 0 }}>{PROPERTY_TYPE_META[m.property.type].icon}</div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <span style={{ fontWeight: 700, fontSize: 15 }}>{m.property.title}</span>
                    <span className="badge" style={{ background: STATUS_META[m.property.status].bg, color: STATUS_META[m.property.status].fg }}>{STATUS_META[m.property.status].label}</span>
                  </div>
                  <div style={{ fontSize: 12, color: 'var(--ink-3)', marginTop: 3, display: 'flex', gap: 12 }}>
                    <span>{m.property.reference}</span>
                    {m.property.bedrooms > 0 && <span style={{ display: 'flex', alignItems: 'center', gap: 3 }}><BedDouble size={12} /> {m.property.bedrooms}</span>}
                    {m.property.areaSqft > 0 && <span style={{ display: 'flex', alignItems: 'center', gap: 3 }}><Maximize size={12} /> {m.property.areaSqft.toLocaleString('en-IN')} ft²</span>}
                    {(m.property.area || m.property.city) && <span style={{ display: 'flex', alignItems: 'center', gap: 3 }}><MapPin size={12} /> {[m.property.area, m.property.city].filter(Boolean).join(', ')}</span>}
                  </div>
                  <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginTop: 8 }}>
                    {m.reasons.map((r) => <span key={r} className="badge" style={{ background: 'var(--success-bg)', color: 'var(--success)' }}>{r}</span>)}
                  </div>
                </div>
                <div style={{ textAlign: 'right', flexShrink: 0 }}>
                  <div style={{ fontWeight: 800, fontSize: 17, color: 'var(--brand,#132376)' }}>{money(m.property.priceInr ?? m.property.rentInr)}</div>
                  {m.property.roiPct != null && <div style={{ fontSize: 11.5, color: 'var(--success)', display: 'flex', alignItems: 'center', gap: 3, justifyContent: 'flex-end', marginTop: 2 }}><TrendingUp size={11} /> {m.property.roiPct}% ROI</div>}
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

function MatchRing({ pct }: { pct: number }) {
  const color = pct >= 80 ? 'var(--success)' : pct >= 50 ? 'var(--gold,#E6A23C)' : 'var(--ink-3)';
  return (
    <div style={{ width: 54, height: 54, borderRadius: '50%', flexShrink: 0, background: `conic-gradient(${color} ${pct * 3.6}deg, var(--surface-2) 0)`, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <div style={{ width: 42, height: 42, borderRadius: '50%', background: 'var(--surface)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 800, fontSize: 13, color }}>{pct}%</div>
    </div>
  );
}
