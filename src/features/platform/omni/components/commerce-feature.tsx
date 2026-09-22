'use client';

import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { ShoppingBag, Package, Plus, Trash2, X, Link2, DownloadCloud, IndianRupee, CheckCircle2, Truck } from 'lucide-react';
import { omniApi, Product, Order, OrderStatus, CommerceStats, ChannelType, CHANNEL_META } from '../omni-client';

const card: React.CSSProperties = { background: 'var(--surface)', border: '1px solid var(--line-soft)', borderRadius: 16 };
const rupee = (n: number) => '₹' + Number(n).toLocaleString('en-IN');
const NEXT_STATUS: Partial<Record<OrderStatus, OrderStatus>> = { PENDING: 'CONFIRMED', CONFIRMED: 'PAID', PAID: 'SHIPPED', SHIPPED: 'DELIVERED' };
const STATUS_STYLE: Record<OrderStatus, { bg: string; fg: string }> = {
  PENDING: { bg: 'var(--surface-2)', fg: 'var(--ink-3)' },
  CONFIRMED: { bg: 'var(--warning-bg,#fdf2e2)', fg: 'var(--warning,#c67c1e)' },
  PAID: { bg: 'var(--success-bg)', fg: 'var(--success)' },
  SHIPPED: { bg: 'var(--brand-bg,#e9ecfb)', fg: 'var(--brand,#132376)' },
  DELIVERED: { bg: 'var(--success-bg)', fg: 'var(--success)' },
  CANCELLED: { bg: 'var(--danger-bg,#fce8e8)', fg: 'var(--danger,#c0392b)' },
};

export function CommerceFeature() {
  const [tab, setTab] = useState<'orders' | 'products'>('orders');
  const { data: stats } = useQuery({ queryKey: ['omni-commerce-stats'], queryFn: async () => (await omniApi.get<CommerceStats>('/commerce/stats')).data });

  return (
    <div style={{ animation: 'fadeUp .4s ease' }}>
      <div style={{ marginBottom: 18 }}>
        <h1 style={{ fontSize: 26, fontWeight: 700, letterSpacing: '-.02em', margin: 0 }}>Commerce</h1>
        <p style={{ fontSize: 14, color: 'var(--ink-2)', margin: '6px 0 0' }}>Sell courses over chat — catalogue, orders, payment links and automatic status updates.</p>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 14, marginBottom: 18 }}>
        <StatCard icon={<Package size={18} />} label="Products" value={stats?.products ?? 0} />
        <StatCard icon={<ShoppingBag size={18} />} label="Orders" value={stats?.orders ?? 0} />
        <StatCard icon={<CheckCircle2 size={18} />} label="Paid" value={stats?.paid ?? 0} accent="var(--success)" />
        <StatCard icon={<IndianRupee size={18} />} label="Revenue" value={rupee(stats?.revenue ?? 0)} accent="var(--brand,#132376)" />
      </div>

      <div style={{ display: 'flex', gap: 6, marginBottom: 18 }}>
        <Tab active={tab === 'orders'} onClick={() => setTab('orders')} icon={<ShoppingBag size={15} />}>Orders</Tab>
        <Tab active={tab === 'products'} onClick={() => setTab('products')} icon={<Package size={15} />}>Catalogue</Tab>
      </div>

      {tab === 'orders' ? <Orders /> : <Products />}
    </div>
  );
}

function StatCard({ icon, label, value, accent }: { icon: React.ReactNode; label: string; value: number | string; accent?: string }) {
  return (
    <div style={{ ...card, padding: 16, display: 'flex', alignItems: 'center', gap: 12 }}>
      <div style={{ width: 40, height: 40, borderRadius: 10, background: 'var(--surface-2)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: accent ?? 'var(--ink-2)' }}>{icon}</div>
      <div>
        <div style={{ fontSize: 20, fontWeight: 700, color: accent ?? 'var(--ink-1)' }}>{value}</div>
        <div style={{ fontSize: 12, color: 'var(--ink-3)' }}>{label}</div>
      </div>
    </div>
  );
}

function Tab({ active, onClick, icon, children }: { active: boolean; onClick: () => void; icon: React.ReactNode; children: React.ReactNode }) {
  return (
    <button onClick={onClick} style={{
      display: 'flex', alignItems: 'center', gap: 7, padding: '9px 16px', borderRadius: 10, fontSize: 13.5, fontWeight: 600,
      cursor: 'pointer', border: '1px solid ' + (active ? 'transparent' : 'var(--line-soft)'),
      background: active ? 'var(--brand,#132376)' : 'var(--surface)', color: active ? '#fff' : 'var(--ink-2)',
    }}>{icon}{children}</button>
  );
}

// ---------------- Orders ----------------
function Orders() {
  const qc = useQueryClient();
  const [compose, setCompose] = useState(false);
  const { data } = useQuery({ queryKey: ['omni-orders'], queryFn: async () => (await omniApi.get<Order[]>('/commerce/orders')).data });

  const invalidate = () => { qc.invalidateQueries({ queryKey: ['omni-orders'] }); qc.invalidateQueries({ queryKey: ['omni-commerce-stats'] }); };
  const payLink = useMutation({
    mutationFn: (id: string) => omniApi.post<Order>(`/commerce/orders/${id}/pay-link`).then((r) => r.data),
    onSuccess: (o) => { invalidate(); navigator.clipboard?.writeText(`${location.origin}/pay.html?ref=${o.payLinkRef}`); toast.success('Pay link created, copied & sent to buyer'); },
  });
  const advance = useMutation({
    mutationFn: ({ id, status }: { id: string; status: OrderStatus }) => omniApi.patch(`/commerce/orders/${id}/status`, { status }),
    onSuccess: () => { invalidate(); toast.success('Status updated & buyer notified'); },
  });

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 14 }}>
        <button className="btn-primary" onClick={() => setCompose(true)}><Plus size={15} /> New order</button>
      </div>
      {(data ?? []).length === 0 && (
        <div style={{ ...card, padding: 40, textAlign: 'center', color: 'var(--ink-3)' }}>
          <ShoppingBag size={28} style={{ opacity: 0.4 }} />
          <div style={{ marginTop: 10, fontSize: 14 }}>No orders yet. Create one and send a payment link over chat.</div>
        </div>
      )}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        {(data ?? []).map((o) => {
          const st = STATUS_STYLE[o.status];
          const next = NEXT_STATUS[o.status];
          return (
            <div key={o.id} style={{ ...card, padding: 18 }}>
              <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12 }}>
                <div style={{ minWidth: 0, flex: 1 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                    <span style={{ fontWeight: 700, fontSize: 15 }}>{o.number}</span>
                    <span className="badge" style={{ background: st.bg, color: st.fg }}>{o.status}</span>
                    <span style={{ fontSize: 12.5, color: 'var(--ink-3)' }}>{CHANNEL_META[o.channelType].icon} {o.contactName ?? o.contactHandle ?? 'Walk-in'}</span>
                  </div>
                  <div style={{ fontSize: 12.5, color: 'var(--ink-2)', marginTop: 8 }}>
                    {o.items.map((i) => `${i.name} × ${i.quantity}`).join(' · ')}
                  </div>
                </div>
                <div style={{ textAlign: 'right', flexShrink: 0 }}>
                  <div style={{ fontWeight: 800, fontSize: 18, color: 'var(--brand,#132376)' }}>{rupee(o.subtotalInr)}</div>
                </div>
              </div>
              <div style={{ display: 'flex', gap: 8, marginTop: 14, flexWrap: 'wrap' }}>
                {!o.payLinkRef && o.status !== 'CANCELLED' && (
                  <button className="btn-secondary" style={{ height: 34, fontSize: 12.5 }} disabled={payLink.isPending} onClick={() => payLink.mutate(o.id)}><Link2 size={13} /> Send pay link</button>
                )}
                {o.payLinkRef && (
                  <a className="btn-secondary" style={{ height: 34, fontSize: 12.5 }} href={`/pay.html?ref=${o.payLinkRef}`} target="_blank" rel="noreferrer"><Link2 size={13} /> Open pay page</a>
                )}
                {next && <button className="btn-primary" style={{ height: 34, fontSize: 12.5 }} onClick={() => advance.mutate({ id: o.id, status: next })}>{next === 'SHIPPED' ? <Truck size={13} /> : <CheckCircle2 size={13} />} Mark {next}</button>}
              </div>
            </div>
          );
        })}
      </div>
      {compose && <OrderModal onClose={() => setCompose(false)} onDone={invalidate} />}
    </div>
  );
}

function OrderModal({ onClose, onDone }: { onClose: () => void; onDone: () => void }) {
  const [f, setF] = useState<{ contactName: string; contactHandle: string; channelType: ChannelType }>({ contactName: '', contactHandle: '', channelType: 'WHATSAPP' });
  const [lines, setLines] = useState<{ productId: string; quantity: number }[]>([{ productId: '', quantity: 1 }]);
  const { data: products } = useQuery({ queryKey: ['omni-products'], queryFn: async () => (await omniApi.get<Product[]>('/commerce/products')).data });

  const setLine = (i: number, patch: Partial<{ productId: string; quantity: number }>) => setLines((l) => l.map((x, idx) => idx === i ? { ...x, ...patch } : x));
  const total = lines.reduce((s, l) => { const p = products?.find((x) => x.id === l.productId); return s + (p ? p.priceInr * l.quantity : 0); }, 0);

  const create = useMutation({
    mutationFn: () => omniApi.post('/commerce/orders', {
      contactName: f.contactName || undefined, contactHandle: f.contactHandle || undefined, channelType: f.channelType,
      items: lines.filter((l) => l.productId).map((l) => ({ productId: l.productId, quantity: l.quantity })),
    }),
    onSuccess: () => { onDone(); toast.success('Order created'); onClose(); },
    onError: (e: any) => toast.error(e?.response?.data?.message ?? 'Failed to create order'),
  });

  const valid = lines.some((l) => l.productId);

  return (
    <Overlay onClose={onClose} title="New order">
      <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        <div style={{ display: 'flex', gap: 10 }}>
          <div style={{ flex: 1 }}><label className="label">Buyer name</label><input className="input" value={f.contactName} onChange={(e) => setF({ ...f, contactName: e.target.value })} placeholder="Priya M" /></div>
          <div style={{ flex: 1 }}><label className="label">WhatsApp / handle</label><input className="input" value={f.contactHandle} onChange={(e) => setF({ ...f, contactHandle: e.target.value })} placeholder="919812345670" /></div>
        </div>
        <div>
          <label className="label">Items</label>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {lines.map((l, i) => (
              <div key={i} style={{ display: 'flex', gap: 8 }}>
                <select className="input" style={{ flex: 1 }} value={l.productId} onChange={(e) => setLine(i, { productId: e.target.value })}>
                  <option value="">Select product…</option>
                  {(products ?? []).map((p) => <option key={p.id} value={p.id}>{p.name} — {rupee(p.priceInr)}</option>)}
                </select>
                <input className="input" type="number" min={1} style={{ width: 70 }} value={l.quantity} onChange={(e) => setLine(i, { quantity: Number(e.target.value) })} />
                {lines.length > 1 && <button onClick={() => setLines((ls) => ls.filter((_, idx) => idx !== i))} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--ink-3)' }}><X size={16} /></button>}
              </div>
            ))}
          </div>
          <button className="btn-secondary" style={{ marginTop: 8, height: 32, fontSize: 12.5 }} onClick={() => setLines((l) => [...l, { productId: '', quantity: 1 }])}><Plus size={13} /> Add item</button>
        </div>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', paddingTop: 8, borderTop: '1px solid var(--line-soft)' }}>
          <span style={{ color: 'var(--ink-3)', fontSize: 13 }}>Total</span>
          <span style={{ fontWeight: 800, fontSize: 20, color: 'var(--brand,#132376)' }}>{rupee(total)}</span>
        </div>
      </div>
      <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10, marginTop: 18 }}>
        <button className="btn-secondary" onClick={onClose}>Cancel</button>
        <button className="btn-primary" disabled={!valid || create.isPending} onClick={() => create.mutate()}>Create order</button>
      </div>
    </Overlay>
  );
}

// ---------------- Products ----------------
function Products() {
  const qc = useQueryClient();
  const [compose, setCompose] = useState(false);
  const { data } = useQuery({ queryKey: ['omni-products'], queryFn: async () => (await omniApi.get<Product[]>('/commerce/products')).data });
  const invalidate = () => { qc.invalidateQueries({ queryKey: ['omni-products'] }); qc.invalidateQueries({ queryKey: ['omni-commerce-stats'] }); };

  const del = useMutation({ mutationFn: (id: string) => omniApi.delete(`/commerce/products/${id}`), onSuccess: () => { invalidate(); toast.success('Product deleted'); } });
  const importSample = useMutation({
    mutationFn: () => omniApi.post('/commerce/products/import-sample'),
    onSuccess: (r: any) => { invalidate(); toast.success(`Imported ${r.data.created} sample products`); },
  });

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10, marginBottom: 14 }}>
        <button className="btn-secondary" disabled={importSample.isPending} onClick={() => importSample.mutate()}><DownloadCloud size={14} /> Import sample</button>
        <button className="btn-primary" onClick={() => setCompose(true)}><Plus size={15} /> New product</button>
      </div>
      {(data ?? []).length === 0 && (
        <div style={{ ...card, padding: 40, textAlign: 'center', color: 'var(--ink-3)' }}>
          <Package size={28} style={{ opacity: 0.4 }} />
          <div style={{ marginTop: 10, fontSize: 14 }}>No products yet. Add courses or import a sample catalogue.</div>
        </div>
      )}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(280px,1fr))', gap: 14 }}>
        {(data ?? []).map((p) => (
          <div key={p.id} style={{ ...card, padding: 18, display: 'flex', flexDirection: 'column' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 8 }}>
              <div style={{ fontWeight: 700, fontSize: 14.5 }}>{p.name}</div>
              <button className="btn-secondary" style={{ height: 30, width: 30, padding: 0 }} onClick={() => del.mutate(p.id)}><Trash2 size={13} /></button>
            </div>
            {p.category && <span className="badge" style={{ background: 'var(--surface-2)', color: 'var(--ink-3)', marginTop: 6, alignSelf: 'flex-start' }}>{p.category}</span>}
            {p.description && <div style={{ fontSize: 12.5, color: 'var(--ink-2)', marginTop: 8, flex: 1 }}>{p.description}</div>}
            <div style={{ marginTop: 12, fontWeight: 800, fontSize: 18, color: 'var(--brand,#132376)' }}>{rupee(p.priceInr)}</div>
          </div>
        ))}
      </div>
      {compose && <ProductModal onClose={() => setCompose(false)} onDone={invalidate} />}
    </div>
  );
}

function ProductModal({ onClose, onDone }: { onClose: () => void; onDone: () => void }) {
  const [f, setF] = useState({ name: '', category: '', priceInr: '', description: '' });
  const create = useMutation({
    mutationFn: () => omniApi.post('/commerce/products', { name: f.name, category: f.category || undefined, priceInr: Number(f.priceInr) || 0, description: f.description || undefined }),
    onSuccess: () => { onDone(); toast.success('Product added'); onClose(); },
    onError: () => toast.error('Failed to add product'),
  });
  return (
    <Overlay onClose={onClose} title="New product">
      <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        <div style={{ display: 'flex', gap: 10 }}>
          <div style={{ flex: 1 }}><label className="label">Name</label><input className="input" value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} placeholder="Diploma in Web Development" /></div>
          <div style={{ width: 130 }}><label className="label">Price (₹)</label><input className="input" type="number" value={f.priceInr} onChange={(e) => setF({ ...f, priceInr: e.target.value })} placeholder="45000" /></div>
        </div>
        <div><label className="label">Category</label><input className="input" value={f.category} onChange={(e) => setF({ ...f, category: e.target.value })} placeholder="Diploma" /></div>
        <div><label className="label">Description</label><textarea className="input" rows={2} style={{ resize: 'vertical' }} value={f.description} onChange={(e) => setF({ ...f, description: e.target.value })} placeholder="6-month full-stack program" /></div>
      </div>
      <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10, marginTop: 18 }}>
        <button className="btn-secondary" onClick={onClose}>Cancel</button>
        <button className="btn-primary" disabled={!f.name || !f.priceInr || create.isPending} onClick={() => create.mutate()}>Add product</button>
      </div>
    </Overlay>
  );
}

function Overlay({ children, onClose, title }: { children: React.ReactNode; onClose: () => void; title: string }) {
  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 60, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }}>
      <div style={{ position: 'absolute', inset: 0, background: 'rgba(20,15,12,.42)' }} onClick={onClose} />
      <div style={{ ...card, position: 'relative', zIndex: 1, width: 520, maxWidth: '100%', maxHeight: '92vh', overflow: 'auto', padding: 22, borderRadius: 18 }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
          <div style={{ fontWeight: 700, fontSize: 16 }}>{title}</div>
          <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--ink-3)' }}><X size={20} /></button>
        </div>
        {children}
      </div>
    </div>
  );
}
