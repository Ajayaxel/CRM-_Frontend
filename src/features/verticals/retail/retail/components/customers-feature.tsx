'use client';

import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { Award, Plus, ShoppingBag, X } from 'lucide-react';
import { api, apiErrorMessage } from '@/lib/api';
import { retailApi, money, custName, SALE_STATUS_META } from '../retail-client';

/** Customer 360 — online + walk-in as one profile, with the loyalty ledger. */
export function RetailCustomersFeature() {
  const qc = useQueryClient();
  const [q, setQ] = useState('');
  const [openId, setOpenId] = useState<string | null>(null);
  const [showNew, setShowNew] = useState(false);
  const { data: customers, isLoading } = useQuery({ queryKey: ['retail-customers', q], queryFn: () => retailApi.customers(q || undefined) });

  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 16 }}>
        <h1 style={{ fontSize: 22, letterSpacing: '-.02em', margin: 0 }}>Customers &amp; Loyalty</h1>
        <span style={{ flex: 1 }} />
        <input className="input" placeholder="Search name / phone / email…" value={q} onChange={(e) => setQ(e.target.value)} style={{ width: 250, height: 36 }} />
        <button className="btn-primary" style={{ height: 36 }} onClick={() => setShowNew(true)}><Plus size={15} /> New customer</button>
      </div>

      <div className="card" style={{ overflow: 'hidden' }}>
        <div style={{ display: 'grid', gridTemplateColumns: '1.6fr 1.2fr 1fr .8fr .8fr', gap: 12, padding: '12px 20px', borderBottom: '1px solid var(--line-soft)', fontFamily: 'var(--mono)', fontSize: 10, letterSpacing: '.1em', textTransform: 'uppercase', color: 'var(--ink-3)' }}>
          <div>Customer</div><div>Contact</div><div>Source</div><div style={{ textAlign: 'right' }}>Orders</div><div style={{ textAlign: 'right' }}>Points</div>
        </div>
        {isLoading && <div style={{ padding: 36, textAlign: 'center', color: 'var(--ink-3)' }}>Loading…</div>}
        {customers?.length === 0 && <div style={{ padding: 36, textAlign: 'center', color: 'var(--ink-3)' }}>No customers yet — they arrive with the first POS sale or Shopify order.</div>}
        {customers?.map((c) => (
          <div key={c.id} onClick={() => setOpenId(c.id)} style={{ display: 'grid', gridTemplateColumns: '1.6fr 1.2fr 1fr .8fr .8fr', gap: 12, padding: '13px 20px', borderBottom: '1px solid var(--line-soft)', alignItems: 'center', cursor: 'pointer', fontSize: 13.5 }}>
            <div style={{ fontWeight: 600 }}>
              {custName(c)}
              {c.mergeReview && <span style={{ marginLeft: 8, fontSize: 10.5, fontFamily: 'var(--mono)', color: '#b8791f', background: 'rgba(230,162,60,.14)', padding: '2px 7px', borderRadius: 6 }}>MERGE REVIEW</span>}
            </div>
            <div style={{ color: 'var(--ink-2)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{c.phone ?? c.email ?? '—'}</div>
            <div><span style={{ fontFamily: 'var(--mono)', fontSize: 10.5, background: 'var(--surface-2)', padding: '3px 8px', borderRadius: 7, color: 'var(--ink-2)' }}>{c.source}</span></div>
            <div style={{ textAlign: 'right' }}>{c._count?.sales ?? 0}</div>
            <div style={{ textAlign: 'right', fontWeight: 700, color: (c.loyalty?.pointsBalance ?? 0) > 0 ? '#b8791f' : 'var(--ink-3)' }}>{c.loyalty?.pointsBalance ?? 0}</div>
          </div>
        ))}
      </div>

      {openId && <CustomerDrawer id={openId} onClose={() => setOpenId(null)} />}
      {showNew && <NewCustomerDrawer onClose={() => { setShowNew(false); qc.invalidateQueries({ queryKey: ['retail-customers'] }); }} />}
    </div>
  );
}

function CustomerDrawer({ id, onClose }: { id: string; onClose: () => void }) {
  const { data: c } = useQuery({ queryKey: ['retail-customer', id], queryFn: () => retailApi.customer(id) });
  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(10,14,25,.45)', zIndex: 60, display: 'flex', justifyContent: 'flex-end' }} onClick={onClose}>
      <div className="card" style={{ width: 480, maxWidth: '94vw', height: '100%', borderRadius: 0, padding: 24, overflowY: 'auto' }} onClick={(e) => e.stopPropagation()}>
        {!c ? <div style={{ padding: 30, color: 'var(--ink-3)' }}>Loading…</div> : (
          <>
            <div style={{ display: 'flex', alignItems: 'center', marginBottom: 4 }}>
              <div style={{ fontWeight: 800, fontSize: 18 }}>{custName(c)}</div>
              <span style={{ flex: 1 }} />
              <button className="btn-secondary" style={{ height: 32, width: 32, padding: 0 }} onClick={onClose}><X size={15} /></button>
            </div>
            <div style={{ color: 'var(--ink-3)', fontSize: 13, marginBottom: 16 }}>{[c.phone, c.email].filter(Boolean).join(' · ') || 'No contact details'} · via {c.source}</div>

            <div className="card" style={{ padding: 14, marginBottom: 14, display: 'flex', alignItems: 'center', gap: 12, background: 'color-mix(in srgb, var(--gold,#E6A23C) 8%, var(--surface))' }}>
              <Award size={20} color="#b8791f" />
              <div>
                <div style={{ fontWeight: 800, fontSize: 17 }}>{c.loyalty?.pointsBalance ?? 0} points</div>
                <div style={{ fontSize: 12, color: 'var(--ink-3)' }}>{c.loyalty?.lifetimePoints ?? 0} lifetime · tier {c.loyalty?.tier ?? 'STANDARD'}</div>
              </div>
            </div>

            <div className="eyebrow" style={{ margin: '14px 0 8px' }}>Purchase history</div>
            {(c.sales ?? []).length === 0 && <div style={{ color: 'var(--ink-3)', fontSize: 13 }}>No purchases yet.</div>}
            {(c.sales ?? []).map((s: any) => {
              const meta = SALE_STATUS_META[s.status] ?? { fg: 'var(--ink-2)', bg: 'var(--surface-2)' };
              return (
                <div key={s.id} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '9px 0', borderBottom: '1px solid var(--line-soft)', fontSize: 13 }}>
                  <ShoppingBag size={13} color="var(--ink-3)" />
                  <span style={{ fontFamily: 'var(--mono)', fontSize: 11.5 }}>{s.code}</span>
                  <span style={{ fontFamily: 'var(--mono)', fontSize: 10, padding: '2px 7px', borderRadius: 6, color: meta.fg, background: meta.bg }}>{s.source}</span>
                  <span style={{ color: 'var(--ink-3)', fontSize: 12 }}>{new Date(s.placedAt).toLocaleDateString()}</span>
                  <span style={{ marginLeft: 'auto', fontWeight: 600, fontVariantNumeric: 'tabular-nums' }}>{money(s.totalInr)}</span>
                </div>
              );
            })}

            <div className="eyebrow" style={{ margin: '18px 0 8px' }}>Loyalty ledger</div>
            {(c.loyalty?.txns ?? []).length === 0 && <div style={{ color: 'var(--ink-3)', fontSize: 13 }}>No loyalty activity yet.</div>}
            {(c.loyalty?.txns ?? []).map((t: any) => (
              <div key={t.id} style={{ display: 'flex', justifyContent: 'space-between', padding: '7px 0', borderBottom: '1px solid var(--line-soft)', fontSize: 13 }}>
                <span style={{ color: 'var(--ink-2)' }}>{t.reason.replace(/_/g, ' ').toLowerCase()} · {new Date(t.createdAt).toLocaleDateString()}</span>
                <span style={{ fontWeight: 700, color: t.points >= 0 ? '#1e874b' : '#c0392b' }}>{t.points >= 0 ? `+${t.points}` : t.points}</span>
              </div>
            ))}
          </>
        )}
      </div>
    </div>
  );
}

function NewCustomerDrawer({ onClose }: { onClose: () => void }) {
  const [f, setF] = useState({ firstName: '', lastName: '', email: '', phone: '' });
  const create = useMutation({
    mutationFn: async () => api.post('/retail/customers', { firstName: f.firstName, lastName: f.lastName || undefined, email: f.email || undefined, phone: f.phone || undefined }),
    onSuccess: () => { toast.success('Customer added'); onClose(); },
    onError: (e) => toast.error(apiErrorMessage(e)),
  });
  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(10,14,25,.45)', zIndex: 60, display: 'flex', justifyContent: 'flex-end' }} onClick={onClose}>
      <div className="card" style={{ width: 400, maxWidth: '92vw', height: '100%', borderRadius: 0, padding: 24 }} onClick={(e) => e.stopPropagation()}>
        <div style={{ display: 'flex', alignItems: 'center', marginBottom: 18 }}>
          <div style={{ fontWeight: 800, fontSize: 17 }}>New customer</div>
          <span style={{ flex: 1 }} />
          <button className="btn-secondary" style={{ height: 32, width: 32, padding: 0 }} onClick={onClose}><X size={15} /></button>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
            <div><label className="label">First name</label><input className="input" value={f.firstName} onChange={(e) => setF({ ...f, firstName: e.target.value })} /></div>
            <div><label className="label">Last name</label><input className="input" value={f.lastName} onChange={(e) => setF({ ...f, lastName: e.target.value })} /></div>
          </div>
          <div><label className="label">Phone</label><input className="input" value={f.phone} onChange={(e) => setF({ ...f, phone: e.target.value })} /></div>
          <div><label className="label">Email</label><input className="input" value={f.email} onChange={(e) => setF({ ...f, email: e.target.value })} /></div>
          <div style={{ fontSize: 12, color: 'var(--ink-3)' }}>Phone/email is the dedup key — a Shopify shopper with the same contact becomes one profile, not two.</div>
          <button className="btn-primary" style={{ height: 42 }} disabled={!f.firstName || create.isPending} onClick={() => create.mutate()}>Add customer</button>
        </div>
      </div>
    </div>
  );
}
