'use client';

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api, apiErrorMessage } from '@/lib/api';
import { toast } from 'sonner';
import { ShieldCheck, Building, Plus, Search, CheckCircle2, Clock, User, X } from 'lucide-react';
import { cur } from '@/lib/org-locale';
import { PropertyType, PropertyListingType, PropertyStatus, PROPERTY_TYPE_META, STATUS_META, money } from '../realestate-client';

const card: React.CSSProperties = { background: 'var(--surface)', border: '1px solid var(--line-soft)', borderRadius: 16 };
const TYPES: PropertyType[] = ['APARTMENT', 'VILLA', 'TOWNHOUSE', 'PENTHOUSE', 'OFFICE', 'SHOP', 'WAREHOUSE', 'LAND', 'STUDIO'];
const STATUSES: PropertyStatus[] = ['AVAILABLE', 'RESERVED', 'UNDER_OFFER', 'SOLD', 'RENTED', 'OFF_MARKET'];

export function PropertyCarePlansFeature() {
  const qc = useQueryClient();
  const [search, setSearch] = useState('');
  const [showAddPlanModal, setShowAddPlanModal] = useState(false);
  const [showAddPropertyModal, setShowAddPropertyModal] = useState(false);

  const [propertyId, setPropertyId] = useState('');
  const [planName, setPlanName] = useState('Annual Property Care Plan');
  const [priceInr, setPriceInr] = useState('5000');
  const [startDate, setStartDate] = useState(new Date().toISOString().split('T')[0]);

  const { data: properties = [] } = useQuery({
    queryKey: ['properties'],
    queryFn: async () => (await api.get('/properties')).data.data || [],
  });

  const { data: contracts = [] } = useQuery({
    queryKey: ['property-care-plans'],
    queryFn: async () => (await api.get('/property-care/plans')).data || [],
  });

  const { data: stats } = useQuery({
    queryKey: ['property-care-dashboard'],
    queryFn: async () => (await api.get('/property-care/dashboard')).data || {},
  });

  const selectedProperty = properties.find((p: any) => p.id === propertyId);

  const createContract = useMutation({
    mutationFn: () =>
      api.post('/property-care/plans', {
        propertyId,
        customerId: selectedProperty?.customerId || undefined,
        planName,
        price: Number(priceInr),
        startDate: new Date(startDate).toISOString(),
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['property-care-plans'] });
      qc.invalidateQueries({ queryKey: ['property-care-dashboard'] });
      toast.success('Property Care Plan registered successfully!');
      setShowAddPlanModal(false);
    },
    onError: (e) => toast.error(apiErrorMessage(e)),
  });

  const careProperties = properties.filter((p: any) => Boolean(p.customerId || p.ownerName));
  const dropdownProperties = careProperties.length > 0 ? careProperties : properties;

  const filteredContracts = contracts.filter((c: any) =>
    (c.planName || '').toLowerCase().includes(search.toLowerCase()) ||
    (c.status || '').toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div style={{ animation: 'fadeUp .4s ease' }}>
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 18 }}>
        <div>
          <div style={{ display: 'inline-flex', alignItems: 'center', gap: 6, padding: '4px 10px', borderRadius: 100, background: 'var(--brand-soft)', color: 'var(--brand)', fontSize: 12, fontWeight: 600, marginBottom: 8 }}>
            <ShieldCheck size={14} /> NMK Property Care ERP
          </div>
          <h1 style={{ fontSize: 26, fontWeight: 700, letterSpacing: '-.02em', margin: 0 }}>Annual Property Care Plans</h1>
          <p style={{ fontSize: 14, color: 'var(--ink-2)', margin: '6px 0 0', maxWidth: 600 }}>
            Dedicated property management & coordination service for customer portfolios across multi-location properties.
          </p>
        </div>
        <div style={{ display: 'flex', gap: 10 }}>
          <button className="btn-secondary" onClick={() => setShowAddPropertyModal(true)}><Plus size={15} /> Register Property</button>
          <button className="btn-primary" onClick={() => setShowAddPlanModal(true)}><Plus size={15} /> Subscribe Plan</button>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 12, marginBottom: 18 }}>
        <Stat label="Total Properties" value={stats?.totalProperties || properties.length || 0} hint="Multi-location portfolio assets" />
        <Stat label="Active Care Plans" value={stats?.activeContracts || contracts.length || 0} hint={`${cur()}5,000 / year base plans`} accent="var(--success)" />
        <Stat label="Annual Plan Revenue" value={money(stats?.annualPlanRevenueInr || 0)} hint="Management coordination fees" accent="var(--brand,#132376)" />
        <Stat label="Maintenance Total" value={money(stats?.totalMaintenanceChargesInr || 0)} hint="Itemized maintenance tasks" accent="var(--gold,#E6A23C)" />
      </div>

      <div style={{ ...card, padding: 20 }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
          <div style={{ fontWeight: 600, fontSize: 16, display: 'flex', alignItems: 'center', gap: 8 }}>
            <ShieldCheck size={18} color="var(--brand)" /> Registered Property Care Contracts
          </div>
          <input className="input" style={{ width: 260 }} placeholder="Search plan or status..." value={search} onChange={(e) => setSearch(e.target.value)} />
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(320px,1fr))', gap: 16 }}>
          {filteredContracts.map((c: any) => {
            const prop = properties.find((p: any) => p.id === c.propertyId);
            return (
              <div key={c.id} style={{ ...card, padding: 16, display: 'flex', flexDirection: 'column', gap: 12, background: 'var(--surface-2)' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                  <div>
                    <span className="badge" style={{ background: 'var(--success-bg)', color: 'var(--success)', marginBottom: 6 }}>{c.status || 'ACTIVE'}</span>
                    <div style={{ fontWeight: 600, fontSize: 15 }}>{prop?.title || 'Property Care Asset'}</div>
                    <div style={{ fontSize: 12, color: 'var(--ink-3)', display: 'flex', alignItems: 'center', gap: 4, marginTop: 4 }}>
                      <User size={12} /> {prop?.ownerName || 'Customer'}
                    </div>
                  </div>
                  <div style={{ fontWeight: 700, color: 'var(--brand)', fontSize: 16 }}>
                    {money(c.priceInr || 5000)}<span style={{ fontSize: 12, color: 'var(--ink-3)', fontWeight: 400 }}>/yr</span>
                  </div>
                </div>

                <div style={{ background: 'var(--surface)', padding: 12, borderRadius: 10, border: '1px solid var(--line-soft)', fontSize: 12, color: 'var(--ink-2)', display: 'flex', flexDirection: 'column', gap: 6 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                    <span>Plan Type:</span> <strong style={{ color: 'var(--ink-1)' }}>{c.planName}</strong>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                    <span>Start Date:</span> <span>{c.startDate ? new Date(c.startDate).toLocaleDateString() : '—'}</span>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                    <span>Expiry Date:</span> <span>{c.expiryDate ? new Date(c.expiryDate).toLocaleDateString() : '—'}</span>
                  </div>
                </div>
                <div style={{ fontSize: 11, color: 'var(--ink-3)', fontStyle: 'italic', marginTop: 'auto' }}>
                  * Annual management & coordination service. Maintenance charged separately.
                </div>
              </div>
            );
          })}
          {filteredContracts.length === 0 && (
            <div style={{ gridColumn: '1 / -1', padding: 40, textAlign: 'center', color: 'var(--ink-3)' }}>
              No property care plans found. Subscribe a property to get started.
            </div>
          )}
        </div>
      </div>

      {showAddPlanModal && (
        <div style={{ position: 'fixed', inset: 0, zIndex: 60, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }}>
          <div style={{ position: 'absolute', inset: 0, background: 'rgba(20,15,12,.42)' }} onClick={() => setShowAddPlanModal(false)} />
          <div style={{ ...card, position: 'relative', zIndex: 1, width: 480, maxWidth: '100%', padding: 22, borderRadius: 18 }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
              <div style={{ fontWeight: 700, fontSize: 16 }}>Subscribe Property Care Plan</div>
              <button onClick={() => setShowAddPlanModal(false)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--ink-3)' }}><X size={20} /></button>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              <div>
                <label className="label">Select Property</label>
                <select className="input" value={propertyId} onChange={(e) => setPropertyId(e.target.value)}>
                  <option value="">-- Choose Registered Care Property --</option>
                  {dropdownProperties.map((p: any) => (
                    <option key={p.id} value={p.id}>
                      {p.title} {p.customerId ? `(Customer: ${p.customerId})` : p.ownerName ? `(Owner: ${p.ownerName})` : ''}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="label">Plan Name</label>
                <input className="input" value={planName} onChange={(e) => setPlanName(e.target.value)} />
              </div>
              <div style={{ display: 'flex', gap: 10 }}>
                <div style={{ flex: 1 }}><label className="label">Annual Fee ({cur()})</label><input className="input" type="number" value={priceInr} onChange={(e) => setPriceInr(e.target.value)} /></div>
                <div style={{ flex: 1 }}><label className="label">Start Date</label><input className="input" type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} /></div>
              </div>
            </div>
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10, marginTop: 18 }}>
              <button className="btn-secondary" onClick={() => setShowAddPlanModal(false)}>Cancel</button>
              <button className="btn-primary" disabled={!propertyId || createContract.isPending} onClick={() => createContract.mutate()}>Create Annual Plan</button>
            </div>
          </div>
        </div>
      )}

      {showAddPropertyModal && <PropertyModal onClose={() => setShowAddPropertyModal(false)} onDone={() => { qc.invalidateQueries({ queryKey: ['properties'] }); }} />}
    </div>
  );
}

function Stat({ label, value, hint, accent }: { label: string; value: number | string; hint?: string; accent?: string }) {
  return (
    <div style={{ ...card, padding: 16 }}>
      <div style={{ fontSize: 22, fontWeight: 800, color: accent ?? 'var(--ink-1)', letterSpacing: '-.02em' }}>{value}</div>
      <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--ink-2)', marginTop: 2 }}>{label}</div>
      {hint && <div style={{ fontSize: 11, color: 'var(--ink-3)', marginTop: 4 }}>{hint}</div>}
    </div>
  );
}

function PropertyModal({ onClose, onDone }: { onClose: () => void; onDone: () => void }) {
  const [f, setF] = useState<any>({
    title: '', customerId: '', type: 'HOUSE' as PropertyType, 
    address: '', city: '', state: '', country: 'India', postalCode: ''
  });
  const set = (k: string, v: any) => setF((s: any) => ({ ...s, [k]: v }));

  const create = useMutation({
    mutationFn: () => api.post('/properties', {
      title: f.title, 
      customerId: f.customerId, 
      type: f.type, 
      address: f.address,
      city: f.city,
      state: f.state,
      country: f.country,
      postalCode: f.postalCode
    }),
    onSuccess: () => { 
      onDone(); 
      toast.success('Care Property registered successfully'); 
      onClose(); 
    },
    onError: (e) => toast.error(apiErrorMessage(e)),
  });

  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 60, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }}>
      <div style={{ position: 'absolute', inset: 0, background: 'rgba(20,15,12,.42)' }} onClick={onClose} />
      <div style={{ ...card, position: 'relative', zIndex: 1, width: 500, maxWidth: '100%', maxHeight: '92vh', overflow: 'auto', padding: 22, borderRadius: 18 }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
          <div style={{ fontWeight: 700, fontSize: 16 }}>Register Care Property</div>
          <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--ink-3)' }}><X size={20} /></button>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          <div><label className="label">Property Name</label><input className="input" value={f.title} onChange={(e) => set('title', e.target.value)} placeholder="Kochi House" /></div>
          <div><label className="label">Customer ID / Name</label><input className="input" value={f.customerId} onChange={(e) => set('customerId', e.target.value)} placeholder="CUST-001 or John Doe" /></div>
          <div><label className="label">Type</label><select className="input" value={f.type} onChange={(e) => set('type', e.target.value)}>{TYPES.map((t) => <option key={t} value={t}>{PROPERTY_TYPE_META[t]?.label || t}</option>)}</select></div>
          <div><label className="label">Address</label><input className="input" value={f.address} onChange={(e) => set('address', e.target.value)} placeholder="Kakkanad" /></div>
          <div style={{ display: 'flex', gap: 10 }}>
            <div style={{ flex: 1 }}><label className="label">City</label><input className="input" value={f.city} onChange={(e) => set('city', e.target.value)} placeholder="Kochi" /></div>
            <div style={{ flex: 1 }}><label className="label">State</label><input className="input" value={f.state} onChange={(e) => set('state', e.target.value)} placeholder="Kerala" /></div>
          </div>
          <div style={{ display: 'flex', gap: 10 }}>
            <div style={{ flex: 1 }}><label className="label">Country</label><input className="input" value={f.country} onChange={(e) => set('country', e.target.value)} placeholder="India" /></div>
            <div style={{ flex: 1 }}><label className="label">Postal Code</label><input className="input" value={f.postalCode} onChange={(e) => set('postalCode', e.target.value)} placeholder="682030" /></div>
          </div>
        </div>
        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10, marginTop: 18 }}>
          <button className="btn-secondary" onClick={onClose}>Cancel</button>
          <button className="btn-primary" disabled={!f.title || create.isPending} onClick={() => create.mutate()}>Register Property</button>
        </div>
      </div>
    </div>
  );
}
