'use client';

import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { Building2, Plus, Trash2, X, BedDouble, Bath, Maximize, Car, MapPin, Star, TrendingUp, FileText } from 'lucide-react';
import { api, apiErrorMessage } from '@/lib/api';
import { Property, PropertyStats, PropertyType, PropertyListingType, PropertyStatus, PROPERTY_TYPE_META, STATUS_META, money } from '../realestate-client';
import { cur } from '@/lib/org-locale';

const card: React.CSSProperties = { background: 'var(--surface)', border: '1px solid var(--line-soft)', borderRadius: 16 };
const TYPES: PropertyType[] = ['APARTMENT', 'VILLA', 'TOWNHOUSE', 'PENTHOUSE', 'OFFICE', 'SHOP', 'WAREHOUSE', 'LAND', 'STUDIO'];
const STATUSES: PropertyStatus[] = ['AVAILABLE', 'RESERVED', 'UNDER_OFFER', 'SOLD', 'RENTED', 'OFF_MARKET'];

export function PropertiesFeature() {
  const qc = useQueryClient();
  const [compose, setCompose] = useState(false);
  const [status, setStatus] = useState<PropertyStatus | ''>('');
  const [type, setType] = useState<PropertyType | ''>('');
  const [search, setSearch] = useState('');

  const { data: stats } = useQuery({ queryKey: ['prop-stats'], queryFn: async () => (await api.get<PropertyStats>('/properties/stats')).data });
  const { data } = useQuery({
    queryKey: ['properties', status, type, search],
    queryFn: async () => (await api.get<{ data: Property[]; meta: any }>('/properties', { params: { status: status || undefined, type: type || undefined, search: search || undefined, limit: 60 } })).data,
  });
  const del = useMutation({
    mutationFn: (id: string) => api.delete(`/properties/${id}`),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['properties'] }); qc.invalidateQueries({ queryKey: ['prop-stats'] }); toast.success('Property removed'); },
  });

  return (
    <div style={{ animation: 'fadeUp .4s ease' }}>
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 18 }}>
        <div>
          <h1 style={{ fontSize: 26, fontWeight: 700, letterSpacing: '-.02em', margin: 0 }}>Property Inventory</h1>
          <p style={{ fontSize: 14, color: 'var(--ink-2)', margin: '6px 0 0' }}>Your listings for sale and rent — with pricing, ROI and availability.</p>
        </div>
        <button className="btn-primary" onClick={() => setCompose(true)}><Plus size={15} /> Add property</button>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5,1fr)', gap: 12, marginBottom: 18 }}>
        <Stat label="Total listings" value={stats?.total ?? 0} />
        <Stat label="Available" value={stats?.byStatus?.AVAILABLE ?? 0} accent="var(--success)" />
        <Stat label="Portfolio value" value={money(stats?.portfolioValue ?? 0)} accent="var(--brand,#132376)" />
        <Stat label="Monthly rent roll" value={money(stats?.monthlyRentRoll ?? 0)} accent="var(--gold,#E6A23C)" />
        <Stat label="Occupancy" value={`${stats?.occupancyPct ?? 0}%`} />
      </div>

      <div style={{ display: 'flex', gap: 8, marginBottom: 16, flexWrap: 'wrap' }}>
        <input className="input" style={{ maxWidth: 260 }} placeholder="Search title, ref, area…" value={search} onChange={(e) => setSearch(e.target.value)} />
        <select className="input" style={{ width: 150 }} value={type} onChange={(e) => setType(e.target.value as any)}>
          <option value="">All types</option>
          {TYPES.map((t) => <option key={t} value={t}>{PROPERTY_TYPE_META[t].label}</option>)}
        </select>
        <select className="input" style={{ width: 150 }} value={status} onChange={(e) => setStatus(e.target.value as any)}>
          <option value="">All statuses</option>
          {STATUSES.map((s) => <option key={s} value={s}>{STATUS_META[s].label}</option>)}
        </select>
      </div>

      {(data?.data ?? []).length === 0 && (
        <div style={{ ...card, padding: 44, textAlign: 'center', color: 'var(--ink-3)' }}>
          <Building2 size={30} style={{ opacity: 0.4 }} />
          <div style={{ marginTop: 10, fontSize: 14 }}>No properties match. Add your first listing.</div>
        </div>
      )}

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(320px,1fr))', gap: 16 }}>
        {(data?.data ?? []).map((p) => {
          const st = STATUS_META[p.status] || { label: p.status || 'Available', bg: 'var(--success-bg)', fg: 'var(--success)' };
          const typeMeta = PROPERTY_TYPE_META[p.type] || { label: p.type || 'Property', icon: '🏠' };
          return (
            <div key={p.id} style={{ ...card, overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
              <div style={{ height: 120, background: p.images?.[0] ? `url(${p.images[0]}) center/cover` : `linear-gradient(135deg, var(--brand,#132376), #2a3a9e)`, position: 'relative', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                {!p.images?.[0] && <span style={{ fontSize: 44 }}>{typeMeta.icon}</span>}
                {p.featured && <span className="badge" style={{ position: 'absolute', top: 10, left: 10, background: 'rgba(255,255,255,.92)', color: 'var(--brand,#132376)' }}><Star size={11} style={{ marginRight: 3, fill: 'var(--gold,#E6A23C)', color: 'var(--gold,#E6A23C)' }} /> Featured</span>}
                <span className="badge" style={{ position: 'absolute', top: 10, right: 10, background: st.bg, color: st.fg }}>{st.label}</span>
              </div>
              <div style={{ padding: 16, flex: 1, display: 'flex', flexDirection: 'column' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 8 }}>
                  <div style={{ minWidth: 0 }}>
                    <div style={{ fontWeight: 700, fontSize: 15, lineHeight: 1.3 }}>{p.title}</div>
                    <div style={{ fontSize: 11.5, color: 'var(--ink-3)', marginTop: 2 }}>{p.reference} · {typeMeta.label}</div>
                  </div>
                  <div style={{ display: 'flex', gap: 6, flexShrink: 0 }}>
                    <a className="btn-secondary" style={{ height: 30, width: 30, padding: 0, display: 'inline-flex', alignItems: 'center', justifyContent: 'center' }} title="Brochure" href={`/brochure.html?id=${p.id}`} target="_blank" rel="noreferrer"><FileText size={13} /></a>
                    <button className="btn-secondary" style={{ height: 30, width: 30, padding: 0 }} onClick={() => del.mutate(p.id)}><Trash2 size={13} /></button>
                  </div>
                </div>
                {(p.area || p.city) && <div style={{ fontSize: 12, color: 'var(--ink-3)', marginTop: 6, display: 'flex', alignItems: 'center', gap: 4 }}><MapPin size={12} /> {[p.area, p.city].filter(Boolean).join(', ')}</div>}
                <div style={{ display: 'flex', gap: 14, marginTop: 10, fontSize: 12, color: 'var(--ink-2)' }}>
                  {p.bedrooms > 0 && <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}><BedDouble size={13} /> {p.bedrooms}</span>}
                  {p.bathrooms > 0 && <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}><Bath size={13} /> {p.bathrooms}</span>}
                  {p.areaSqft > 0 && <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}><Maximize size={13} /> {p.areaSqft.toLocaleString('en-IN')} ft²</span>}
                  {p.parking > 0 && <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}><Car size={13} /> {p.parking}</span>}
                </div>
                {p.amenities.length > 0 && <div style={{ display: 'flex', gap: 5, flexWrap: 'wrap', marginTop: 10 }}>{p.amenities.slice(0, 4).map((a) => <span key={a} className="badge" style={{ background: 'var(--surface-2)', color: 'var(--ink-3)' }}>{a}</span>)}</div>}
                <div style={{ marginTop: 'auto', paddingTop: 12, display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between' }}>
                  <div>
                    {p.priceInr != null && <div style={{ fontWeight: 800, fontSize: 18, color: 'var(--brand,#132376)' }}>{money(p.priceInr)}</div>}
                    {p.rentInr != null && <div style={{ fontSize: 12.5, color: 'var(--ink-2)' }}>{money(p.rentInr)}/mo</div>}
                  </div>
                  {p.roiPct != null && <span className="badge" style={{ background: 'var(--success-bg)', color: 'var(--success)' }}><TrendingUp size={11} style={{ marginRight: 3 }} /> {p.roiPct}% ROI</span>}
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {compose && <PropertyModal onClose={() => setCompose(false)} onDone={() => { qc.invalidateQueries({ queryKey: ['properties'] }); qc.invalidateQueries({ queryKey: ['prop-stats'] }); }} />}
    </div>
  );
}

function Stat({ label, value, accent }: { label: string; value: number | string; accent?: string }) {
  return (
    <div style={{ ...card, padding: 16 }}>
      <div style={{ fontSize: 22, fontWeight: 800, color: accent ?? 'var(--ink-1)', letterSpacing: '-.02em' }}>{value}</div>
      <div style={{ fontSize: 12, color: 'var(--ink-3)', marginTop: 2 }}>{label}</div>
    </div>
  );
}

function PropertyModal({ onClose, onDone }: { onClose: () => void; onDone: () => void }) {
  const [f, setF] = useState<any>({
    title: '', type: 'APARTMENT' as PropertyType, listingType: 'SALE' as PropertyListingType, status: 'AVAILABLE' as PropertyStatus,
    bedrooms: 2, bathrooms: 2, areaSqft: '', parking: 1, priceInr: '', rentInr: '', city: '', area: '', amenities: '', roiPct: '', ownerName: '', ownerPhone: '', featured: false,
  });
  const set = (k: string, v: any) => setF((s: any) => ({ ...s, [k]: v }));

  const create = useMutation({
    mutationFn: () => api.post('/properties', {
      title: f.title, type: f.type, listingType: f.listingType, status: f.status,
      bedrooms: Number(f.bedrooms) || 0, bathrooms: Number(f.bathrooms) || 0, areaSqft: Number(f.areaSqft) || 0, parking: Number(f.parking) || 0,
      priceInr: f.priceInr ? Number(f.priceInr) : undefined, rentInr: f.rentInr ? Number(f.rentInr) : undefined,
      city: f.city || undefined, area: f.area || undefined, roiPct: f.roiPct ? Number(f.roiPct) : undefined,
      ownerName: f.ownerName || undefined, ownerPhone: f.ownerPhone || undefined, featured: f.featured,
      amenities: f.amenities ? String(f.amenities).split(',').map((a: string) => a.trim()).filter(Boolean) : [],
    }),
    onSuccess: () => { onDone(); toast.success('Property added'); onClose(); },
    onError: (e) => toast.error(apiErrorMessage(e)),
  });

  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 60, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }}>
      <div style={{ position: 'absolute', inset: 0, background: 'rgba(20,15,12,.42)' }} onClick={onClose} />
      <div style={{ ...card, position: 'relative', zIndex: 1, width: 620, maxWidth: '100%', maxHeight: '92vh', overflow: 'auto', padding: 22, borderRadius: 18 }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
          <div style={{ fontWeight: 700, fontSize: 16 }}>Add property</div>
          <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--ink-3)' }}><X size={20} /></button>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          <div><label className="label">Title</label><input className="input" value={f.title} onChange={(e) => set('title', e.target.value)} placeholder="2BR Marina View Apartment" /></div>
          <div style={{ display: 'flex', gap: 10 }}>
            <div style={{ flex: 1 }}><label className="label">Type</label><select className="input" value={f.type} onChange={(e) => set('type', e.target.value)}>{TYPES.map((t) => <option key={t} value={t}>{PROPERTY_TYPE_META[t].label}</option>)}</select></div>
            <div style={{ flex: 1 }}><label className="label">Listing</label><select className="input" value={f.listingType} onChange={(e) => set('listingType', e.target.value)}><option value="SALE">For sale</option><option value="RENT">For rent</option><option value="BOTH">Sale &amp; rent</option></select></div>
            <div style={{ flex: 1 }}><label className="label">Status</label><select className="input" value={f.status} onChange={(e) => set('status', e.target.value)}>{STATUSES.map((s) => <option key={s} value={s}>{STATUS_META[s].label}</option>)}</select></div>
          </div>
          <div style={{ display: 'flex', gap: 10 }}>
            <div style={{ flex: 1 }}><label className="label">Bedrooms</label><input className="input" type="number" value={f.bedrooms} onChange={(e) => set('bedrooms', e.target.value)} /></div>
            <div style={{ flex: 1 }}><label className="label">Bathrooms</label><input className="input" type="number" value={f.bathrooms} onChange={(e) => set('bathrooms', e.target.value)} /></div>
            <div style={{ flex: 1 }}><label className="label">Area (ft²)</label><input className="input" type="number" value={f.areaSqft} onChange={(e) => set('areaSqft', e.target.value)} /></div>
            <div style={{ flex: 1 }}><label className="label">Parking</label><input className="input" type="number" value={f.parking} onChange={(e) => set('parking', e.target.value)} /></div>
          </div>
          <div style={{ display: 'flex', gap: 10 }}>
            <div style={{ flex: 1 }}><label className="label">Sale price ({cur()})</label><input className="input" type="number" value={f.priceInr} onChange={(e) => set('priceInr', e.target.value)} placeholder="9500000" /></div>
            <div style={{ flex: 1 }}><label className="label">Monthly rent ({cur()})</label><input className="input" type="number" value={f.rentInr} onChange={(e) => set('rentInr', e.target.value)} placeholder="65000" /></div>
            <div style={{ flex: 1 }}><label className="label">ROI %</label><input className="input" type="number" value={f.roiPct} onChange={(e) => set('roiPct', e.target.value)} placeholder="8.2" /></div>
          </div>
          <div style={{ display: 'flex', gap: 10 }}>
            <div style={{ flex: 1 }}><label className="label">Area / locality</label><input className="input" value={f.area} onChange={(e) => set('area', e.target.value)} placeholder="Bandra West" /></div>
            <div style={{ flex: 1 }}><label className="label">City</label><input className="input" value={f.city} onChange={(e) => set('city', e.target.value)} placeholder="Mumbai" /></div>
          </div>
          <div><label className="label">Amenities (comma separated)</label><input className="input" value={f.amenities} onChange={(e) => set('amenities', e.target.value)} placeholder="Pool, Gym, Security, Parking" /></div>
          <div style={{ display: 'flex', gap: 10 }}>
            <div style={{ flex: 1 }}><label className="label">Owner name</label><input className="input" value={f.ownerName} onChange={(e) => set('ownerName', e.target.value)} /></div>
            <div style={{ flex: 1 }}><label className="label">Owner phone</label><input className="input" value={f.ownerPhone} onChange={(e) => set('ownerPhone', e.target.value)} /></div>
          </div>
          <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, color: 'var(--ink-2)' }}>
            <input type="checkbox" checked={f.featured} onChange={(e) => set('featured', e.target.checked)} /> Feature this listing
          </label>
        </div>
        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10, marginTop: 18 }}>
          <button className="btn-secondary" onClick={onClose}>Cancel</button>
          <button className="btn-primary" disabled={!f.title || create.isPending} onClick={() => create.mutate()}>Add property</button>
        </div>
      </div>
    </div>
  );
}
