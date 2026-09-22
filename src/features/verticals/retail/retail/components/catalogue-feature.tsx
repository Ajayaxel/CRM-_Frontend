'use client';

import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { ChevronDown, ChevronRight, Package, Plus, X } from 'lucide-react';
import { api, apiErrorMessage } from '@/lib/api';
import { cur } from '@/lib/org-locale';
import { retailApi, money, StyleRow, VariantRow } from '../retail-client';

/**
 * The colour × size matrix. Each variant row shows SKU (the Shopify join key),
 * price and per-store availability, with inline stock receiving — every
 * adjustment flows out to Shopify because BMN is the inventory master.
 */
export function CatalogueFeature() {
  const qc = useQueryClient();
  const [q, setQ] = useState('');
  const [open, setOpen] = useState<string | null>(null);
  const [showNew, setShowNew] = useState(false);
  const { data: styles, isLoading } = useQuery({ queryKey: ['retail-styles', q], queryFn: () => retailApi.styles(q || undefined) });
  const { data: branches } = useQuery({ queryKey: ['retail-branches'], queryFn: retailApi.branches });

  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 16 }}>
        <h1 style={{ fontSize: 22, letterSpacing: '-.02em', margin: 0 }}>Catalogue</h1>
        <span style={{ flex: 1 }} />
        <input className="input" placeholder="Search styles or SKUs…" value={q} onChange={(e) => setQ(e.target.value)} style={{ width: 240, height: 36 }} />
        <button className="btn-primary" style={{ height: 36 }} onClick={() => setShowNew(true)}><Plus size={15} /> New style</button>
      </div>

      {isLoading && <div style={{ padding: 40, textAlign: 'center', color: 'var(--ink-3)' }}>Loading…</div>}
      {styles?.length === 0 && (
        <div className="card" style={{ padding: 40, textAlign: 'center', color: 'var(--ink-3)' }}>
          No styles yet. Create one with its colour/size matrix — or connect Shopify and import the storefront catalogue.
        </div>
      )}

      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        {styles?.map((s) => (
          <StyleCard key={s.id} style={s} open={open === s.id} onToggle={() => setOpen(open === s.id ? null : s.id)} branches={branches ?? []} onChanged={() => qc.invalidateQueries({ queryKey: ['retail-styles'] })} />
        ))}
      </div>

      {showNew && <NewStyleDrawer onClose={() => { setShowNew(false); qc.invalidateQueries({ queryKey: ['retail-styles'] }); }} />}
    </div>
  );
}

function StyleCard({ style: s, open, onToggle, branches, onChanged }: { style: StyleRow; open: boolean; onToggle: () => void; branches: { id: string; name: string }[]; onChanged: () => void }) {
  const totalStock = s.variants.reduce((t, v) => t + v.stock.reduce((a, x) => a + x.onHand - x.reserved, 0), 0);
  return (
    <div className="card" style={{ overflow: 'hidden' }}>
      <div onClick={onToggle} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '14px 18px', cursor: 'pointer' }}>
        {open ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
        <Package size={16} color="var(--ink-3)" />
        <div style={{ fontWeight: 700, fontSize: 14.5 }}>{s.name}</div>
        {s.category && <span style={{ fontSize: 11.5, fontFamily: 'var(--mono)', background: 'var(--surface-2)', padding: '3px 8px', borderRadius: 7, color: 'var(--ink-2)' }}>{s.category}</span>}
        <span style={{ flex: 1 }} />
        <span style={{ fontSize: 12.5, color: 'var(--ink-3)' }}>{s.variants.length} variant{s.variants.length === 1 ? '' : 's'}</span>
        <span style={{ fontSize: 12.5, fontWeight: 700, color: totalStock > 0 ? '#1e874b' : 'var(--ink-3)' }}>{totalStock} available</span>
      </div>
      {open && (
        <div style={{ borderTop: '1px solid var(--line-soft)', overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: 640 }}>
            <thead>
              <tr style={{ fontFamily: 'var(--mono)', fontSize: 10, letterSpacing: '.08em', textTransform: 'uppercase', color: 'var(--ink-3)' }}>
                <th style={th}>Colour</th><th style={th}>Size</th><th style={th}>SKU</th><th style={{ ...th, textAlign: 'right' }}>Price</th>
                <th style={{ ...th, textAlign: 'right' }}>Available</th><th style={{ ...th, textAlign: 'right' }}>Receive</th>
              </tr>
            </thead>
            <tbody>
              {s.variants.map((v) => <VariantLine key={v.id} v={v} branches={branches} onChanged={onChanged} />)}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

const th: React.CSSProperties = { textAlign: 'left', padding: '9px 18px', borderBottom: '1px solid var(--line-soft)' };
const td: React.CSSProperties = { padding: '9px 18px', borderBottom: '1px solid var(--line-soft)', fontSize: 13.5 };

function VariantLine({ v, branches, onChanged }: { v: VariantRow; branches: { id: string; name: string }[]; onChanged: () => void }) {
  const [qty, setQty] = useState('');
  const [branchId, setBranchId] = useState(branches[0]?.id ?? '');
  const available = v.stock.reduce((a, x) => a + x.onHand - x.reserved, 0);
  const receive = useMutation({
    mutationFn: async () => api.post('/retail/stock/adjust', { variantId: v.id, branchId: branchId || branches[0]?.id, delta: Number(qty) }),
    onSuccess: () => { toast.success(`Received ${qty} — Shopify push queued`); setQty(''); onChanged(); },
    onError: (e) => toast.error(apiErrorMessage(e)),
  });
  return (
    <tr>
      <td style={td}>{v.colour ?? '—'}</td>
      <td style={td}>{v.size ?? '—'}</td>
      <td style={{ ...td, fontFamily: 'var(--mono)', fontSize: 12 }}>{v.sku ?? <span style={{ color: '#c0392b' }}>no sku</span>}</td>
      <td style={{ ...td, textAlign: 'right', fontVariantNumeric: 'tabular-nums' }}>{money(v.priceInr)}</td>
      <td style={{ ...td, textAlign: 'right', fontWeight: 700, color: available > 0 ? '#1e874b' : 'var(--ink-3)' }}>{available}</td>
      <td style={{ ...td, textAlign: 'right' }}>
        <span style={{ display: 'inline-flex', gap: 6, alignItems: 'center' }}>
          {branches.length > 1 && (
            <select className="input" style={{ height: 28, fontSize: 12, width: 110 }} value={branchId} onChange={(e) => setBranchId(e.target.value)}>
              {branches.map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}
            </select>
          )}
          <input className="input" style={{ height: 28, width: 64, fontSize: 12.5 }} inputMode="numeric" placeholder="qty" value={qty} onChange={(e) => setQty(e.target.value.replace(/[^0-9-]/g, ''))} />
          <button className="btn-secondary" style={{ height: 28, fontSize: 12 }} disabled={!qty || receive.isPending} onClick={() => receive.mutate()}>Add</button>
        </span>
      </td>
    </tr>
  );
}

function NewStyleDrawer({ onClose }: { onClose: () => void }) {
  const [f, setF] = useState({ name: '', category: '', priceInr: '', skuPrefix: '', colours: '', sizes: '' });
  const create = useMutation({
    mutationFn: async () =>
      api.post('/retail/styles', {
        name: f.name,
        category: f.category || undefined,
        priceInr: f.priceInr ? Number(f.priceInr) : undefined,
        skuPrefix: f.skuPrefix || undefined,
        colours: f.colours ? f.colours.split(',').map((x) => x.trim()).filter(Boolean) : undefined,
        sizes: f.sizes ? f.sizes.split(',').map((x) => x.trim()).filter(Boolean) : undefined,
      }),
    onSuccess: () => { toast.success('Style created with its variant matrix'); onClose(); },
    onError: (e) => toast.error(apiErrorMessage(e)),
  });
  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(10,14,25,.45)', zIndex: 60, display: 'flex', justifyContent: 'flex-end' }} onClick={onClose}>
      <div className="card" style={{ width: 420, maxWidth: '92vw', height: '100%', borderRadius: 0, padding: 24, overflowY: 'auto' }} onClick={(e) => e.stopPropagation()}>
        <div style={{ display: 'flex', alignItems: 'center', marginBottom: 18 }}>
          <div style={{ fontWeight: 800, fontSize: 17 }}>New style</div>
          <span style={{ flex: 1 }} />
          <button className="btn-secondary" style={{ height: 32, width: 32, padding: 0 }} onClick={onClose}><X size={15} /></button>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          <div><label className="label">Style name</label><input className="input" value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} placeholder="Linen Shirt Relaxed" /></div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
            <div><label className="label">Category</label><input className="input" value={f.category} onChange={(e) => setF({ ...f, category: e.target.value })} placeholder="Shirts" /></div>
            <div><label className="label">Price ({cur()})</label><input className="input" inputMode="numeric" value={f.priceInr} onChange={(e) => setF({ ...f, priceInr: e.target.value.replace(/[^0-9]/g, '') })} placeholder="129" /></div>
          </div>
          <div><label className="label">SKU prefix</label><input className="input" value={f.skuPrefix} onChange={(e) => setF({ ...f, skuPrefix: e.target.value.toUpperCase() })} placeholder="LNSHIRT (auto if blank)" /></div>
          <div><label className="label">Colours (comma-separated)</label><input className="input" value={f.colours} onChange={(e) => setF({ ...f, colours: e.target.value })} placeholder="White, Sand, Navy" /></div>
          <div><label className="label">Sizes (comma-separated)</label><input className="input" value={f.sizes} onChange={(e) => setF({ ...f, sizes: e.target.value })} placeholder="S, M, L, XL" /></div>
          <div style={{ fontSize: 12.5, color: 'var(--ink-3)' }}>
            Every colour × size combination becomes a variant with its own SKU — the join key Shopify maps to. Edit any SKU afterwards to match the storefront.
          </div>
          <button className="btn-primary" style={{ height: 42 }} disabled={!f.name || create.isPending} onClick={() => create.mutate()}>
            {create.isPending ? 'Creating…' : 'Create style + variants'}
          </button>
        </div>
      </div>
    </div>
  );
}
