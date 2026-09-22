'use client';

import { useMemo, useRef, useState } from 'react';
import { useMutation, useQuery } from '@tanstack/react-query';
import { toast } from 'sonner';
import { CheckCircle2, ScanLine, ShoppingBag, Trash2, UserRound } from 'lucide-react';
import { api, apiErrorMessage } from '@/lib/api';
import { cur, taxLabel } from '@/lib/org-locale';
import { retailApi, money, custName } from '../retail-client';

interface CartLine { variantId: string; label: string; sku: string; unitPriceInr: number; quantity: number; available: number }

/**
 * The shop-floor till. Scan/type a SKU, take the money — stock leaves the shelf
 * immediately and the same quantity flows out to the Shopify storefront so the
 * last piece can never sell twice.
 */
export function PosFeature() {
  const [cart, setCart] = useState<CartLine[]>([]);
  const [skuInput, setSkuInput] = useState('');
  const [custQuery, setCustQuery] = useState('');
  const [customerId, setCustomerId] = useState<string | null>(null);
  const [discount, setDiscount] = useState('');
  const [receipt, setReceipt] = useState<any>(null);
  const skuRef = useRef<HTMLInputElement>(null);

  const { data: styles } = useQuery({ queryKey: ['retail-styles', ''], queryFn: () => retailApi.styles() });
  const { data: customers } = useQuery({ queryKey: ['retail-customers', custQuery], queryFn: () => retailApi.customers(custQuery || undefined), enabled: custQuery.length > 1 });
  const { data: branches } = useQuery({ queryKey: ['retail-branches'], queryFn: retailApi.branches });

  const variantIndex = useMemo(() => {
    const idx = new Map<string, { variantId: string; label: string; sku: string; priceInr: number; available: number }>();
    for (const s of styles ?? []) {
      for (const v of s.variants) {
        const label = `${s.name}${v.colour ? ` · ${v.colour}` : ''}${v.size ? ` / ${v.size}` : ''}`;
        const available = v.stock.reduce((a, x) => a + x.onHand - x.reserved, 0);
        if (v.sku) idx.set(v.sku.toLowerCase(), { variantId: v.id, label, sku: v.sku, priceInr: v.priceInr, available });
        if (v.barcode) idx.set(v.barcode.toLowerCase(), { variantId: v.id, label, sku: v.sku ?? v.barcode, priceInr: v.priceInr, available });
      }
    }
    return idx;
  }, [styles]);

  const addSku = () => {
    const key = skuInput.trim().toLowerCase();
    if (!key) return;
    const hit = variantIndex.get(key);
    if (!hit) { toast.error(`No item with SKU/barcode "${skuInput.trim()}"`); return; }
    setCart((c) => {
      const i = c.findIndex((l) => l.variantId === hit.variantId);
      if (i >= 0) return c.map((l, j) => (j === i ? { ...l, quantity: l.quantity + 1 } : l));
      return [...c, { variantId: hit.variantId, label: hit.label, sku: hit.sku, unitPriceInr: hit.priceInr, quantity: 1, available: hit.available }];
    });
    setSkuInput('');
    skuRef.current?.focus();
  };

  const subtotal = cart.reduce((s, l) => s + l.unitPriceInr * l.quantity, 0);
  const disc = Math.min(Number(discount) || 0, subtotal);

  const checkout = useMutation({
    mutationFn: async () =>
      (await api.post('/retail/sales/pos', {
        customerId: customerId ?? undefined,
        discountInr: disc || undefined,
        lines: cart.map((l) => ({ variantId: l.variantId, quantity: l.quantity })),
      })).data,
    onSuccess: (sale) => { setReceipt(sale); setCart([]); setDiscount(''); setCustomerId(null); setCustQuery(''); },
    onError: (e) => toast.error(apiErrorMessage(e)),
  });

  if (receipt) {
    return (
      <div style={{ maxWidth: 460, margin: '40px auto' }}>
        <div className="card" style={{ padding: 28, textAlign: 'center' }}>
          <CheckCircle2 size={38} color="#1e874b" style={{ margin: '0 auto 10px' }} />
          <div style={{ fontWeight: 800, fontSize: 19 }}>Sale {receipt.code} complete</div>
          <div style={{ color: 'var(--ink-3)', margin: '6px 0 16px', fontSize: 13.5 }}>
            {receipt.lines?.length} line{receipt.lines?.length === 1 ? '' : 's'} · {taxLabel()} {money(receipt.taxInr)} · journal posted · storefront stock updating
          </div>
          <div style={{ fontSize: 26, fontWeight: 800, marginBottom: 20 }}>{money(receipt.totalInr)}</div>
          <button className="btn-primary" style={{ height: 42, width: '100%' }} onClick={() => { setReceipt(null); setTimeout(() => skuRef.current?.focus(), 50); }}>
            New sale
          </button>
        </div>
      </div>
    );
  }

  const mainBranch = branches?.[0];

  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'baseline', gap: 10, marginBottom: 16 }}>
        <h1 style={{ fontSize: 22, letterSpacing: '-.02em', margin: 0 }}>POS</h1>
        <span style={{ color: 'var(--ink-3)', fontSize: 13 }}>{mainBranch ? `till at ${mainBranch.name}` : 'no store configured'}</span>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1.5fr 1fr', gap: 16, alignItems: 'start' }}>
        <div className="card" style={{ padding: 18 }}>
          <div style={{ display: 'flex', gap: 8 }}>
            <div style={{ position: 'relative', flex: 1 }}>
              <ScanLine size={15} style={{ position: 'absolute', left: 11, top: 11, color: 'var(--ink-3)' }} />
              <input
                ref={skuRef} className="input" style={{ paddingLeft: 34, height: 38 }} placeholder="Scan or type SKU / barcode, then Enter"
                value={skuInput} onChange={(e) => setSkuInput(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && addSku()}
              />
            </div>
            <button className="btn-secondary" style={{ height: 38 }} onClick={addSku}>Add</button>
          </div>

          <div style={{ marginTop: 14 }}>
            {cart.length === 0 && <div style={{ padding: 30, textAlign: 'center', color: 'var(--ink-3)', fontSize: 13.5 }}><ShoppingBag size={20} style={{ display: 'block', margin: '0 auto 8px' }} />Cart is empty</div>}
            {cart.map((l, i) => (
              <div key={l.variantId} style={{ display: 'grid', gridTemplateColumns: '1fr auto auto auto', gap: 10, alignItems: 'center', padding: '10px 0', borderBottom: '1px solid var(--line-soft)' }}>
                <div>
                  <div style={{ fontSize: 13.5, fontWeight: 600 }}>{l.label}</div>
                  <div style={{ fontFamily: 'var(--mono)', fontSize: 11, color: l.quantity > l.available ? '#c0392b' : 'var(--ink-3)' }}>
                    {l.sku} · {l.available} on shelf{l.quantity > l.available ? ' — not enough!' : ''}
                  </div>
                </div>
                <input className="input" style={{ width: 58, height: 30, fontSize: 13, textAlign: 'center' }} inputMode="numeric" value={l.quantity}
                  onChange={(e) => { const q = Math.max(1, Number(e.target.value.replace(/\D/g, '')) || 1); setCart((c) => c.map((x, j) => (j === i ? { ...x, quantity: q } : x))); }} />
                <div style={{ fontVariantNumeric: 'tabular-nums', fontWeight: 600, fontSize: 13.5, width: 90, textAlign: 'right' }}>{money(l.unitPriceInr * l.quantity)}</div>
                <button className="btn-secondary" style={{ height: 30, width: 30, padding: 0, color: 'var(--danger,#c0392b)' }} onClick={() => setCart((c) => c.filter((_, j) => j !== i))}><Trash2 size={13} /></button>
              </div>
            ))}
          </div>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          <div className="card" style={{ padding: 16 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 7, fontSize: 12.5, fontWeight: 700, color: 'var(--ink-2)', marginBottom: 8 }}><UserRound size={14} /> Customer (loyalty)</div>
            {customerId ? (
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <span style={{ fontSize: 13.5, fontWeight: 600 }}>{custName(customers?.find((c) => c.id === customerId))}</span>
                <button className="btn-secondary" style={{ height: 26, fontSize: 11.5, marginLeft: 'auto' }} onClick={() => { setCustomerId(null); setCustQuery(''); }}>Change</button>
              </div>
            ) : (
              <>
                <input className="input" style={{ height: 34 }} placeholder="Search phone / email / name…" value={custQuery} onChange={(e) => setCustQuery(e.target.value)} />
                {custQuery.length > 1 && (customers ?? []).slice(0, 5).map((c) => (
                  <div key={c.id} onClick={() => setCustomerId(c.id)} style={{ padding: '8px 4px', borderBottom: '1px solid var(--line-soft)', cursor: 'pointer', fontSize: 13 }}>
                    <strong>{custName(c)}</strong> <span style={{ color: 'var(--ink-3)' }}>{c.phone ?? c.email ?? ''}</span>
                    {c.loyalty && <span style={{ float: 'right', color: '#b8791f', fontWeight: 700 }}>{c.loyalty.pointsBalance} pts</span>}
                  </div>
                ))}
                <div style={{ fontSize: 11.5, color: 'var(--ink-3)', marginTop: 6 }}>Optional — attach to earn loyalty points on this sale.</div>
              </>
            )}
          </div>

          <div className="card" style={{ padding: 16 }}>
            <Row k="Subtotal" v={money(subtotal)} />
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '6px 0' }}>
              <span style={{ fontSize: 13.5, color: 'var(--ink-2)' }}>Discount ({cur()})</span>
              <input className="input" style={{ width: 90, height: 28, fontSize: 13, textAlign: 'right' }} inputMode="numeric" value={discount} onChange={(e) => setDiscount(e.target.value.replace(/\D/g, ''))} />
            </div>
            <Row k={`${taxLabel()} (computed at checkout)`} v="—" muted />
            <div style={{ borderTop: '2px solid var(--line)', marginTop: 8, paddingTop: 10, display: 'flex', justifyContent: 'space-between', fontWeight: 800, fontSize: 16 }}>
              <span>To collect</span><span>{money(subtotal - disc)} + {taxLabel().toLowerCase()}</span>
            </div>
            <button className="btn-primary" style={{ height: 46, width: '100%', marginTop: 14, fontSize: 15 }} disabled={!cart.length || checkout.isPending} onClick={() => checkout.mutate()}>
              {checkout.isPending ? 'Charging…' : 'Complete sale'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

function Row({ k, v, muted }: { k: string; v: string; muted?: boolean }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', padding: '6px 0', fontSize: 13.5, color: muted ? 'var(--ink-3)' : 'var(--ink-2)' }}>
      <span>{k}</span><span style={{ fontVariantNumeric: 'tabular-nums' }}>{v}</span>
    </div>
  );
}
