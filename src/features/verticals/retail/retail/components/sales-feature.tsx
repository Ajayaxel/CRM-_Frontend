'use client';

import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { Undo2, X } from 'lucide-react';
import { api, apiErrorMessage } from '@/lib/api';
import { taxLabel } from '@/lib/org-locale';
import { retailApi, money, custName, SALE_STATUS_META, SaleRow } from '../retail-client';

/** Sales across both channels, with the return/exchange flow on each sale. */
export function RetailSalesFeature() {
  const [source, setSource] = useState<string>('');
  const [openId, setOpenId] = useState<string | null>(null);
  const { data: sales, isLoading } = useQuery({ queryKey: ['retail-sales', source], queryFn: () => retailApi.sales(source || undefined) });
  const open = sales?.find((s) => s.id === openId) ?? null;

  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 16 }}>
        <h1 style={{ fontSize: 22, letterSpacing: '-.02em', margin: 0 }}>Sales &amp; Returns</h1>
        <span style={{ flex: 1 }} />
        {['', 'POS', 'SHOPIFY'].map((s) => (
          <button key={s || 'all'} className={source === s ? 'btn-primary' : 'btn-secondary'} style={{ height: 32, fontSize: 12.5 }} onClick={() => setSource(s)}>
            {s || 'All'}{s === 'SHOPIFY' ? ' (online)' : s === 'POS' ? ' (in-store)' : ''}
          </button>
        ))}
      </div>

      <div className="card" style={{ overflow: 'hidden' }}>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1.4fr .9fr 1.1fr .9fr .9fr', gap: 12, padding: '12px 20px', borderBottom: '1px solid var(--line-soft)', fontFamily: 'var(--mono)', fontSize: 10, letterSpacing: '.1em', textTransform: 'uppercase', color: 'var(--ink-3)' }}>
          <div>Sale</div><div>Customer</div><div>Channel</div><div>Status</div><div>Date</div><div style={{ textAlign: 'right' }}>Total</div>
        </div>
        {isLoading && <div style={{ padding: 36, textAlign: 'center', color: 'var(--ink-3)' }}>Loading…</div>}
        {sales?.length === 0 && <div style={{ padding: 36, textAlign: 'center', color: 'var(--ink-3)' }}>No sales on this channel yet.</div>}
        {sales?.map((s) => {
          const meta = SALE_STATUS_META[s.status] ?? { fg: 'var(--ink-2)', bg: 'var(--surface-2)' };
          return (
            <div key={s.id} onClick={() => setOpenId(s.id)} style={{ display: 'grid', gridTemplateColumns: '1fr 1.4fr .9fr 1.1fr .9fr .9fr', gap: 12, padding: '13px 20px', borderBottom: '1px solid var(--line-soft)', alignItems: 'center', cursor: 'pointer', fontSize: 13.5 }}>
              <div style={{ fontFamily: 'var(--mono)', fontSize: 12 }}>{s.code}{s.externalOrderNo ? <span style={{ color: 'var(--ink-3)' }}> {s.externalOrderNo}</span> : ''}</div>
              <div>{custName(s.customer)}</div>
              <div><span style={{ fontFamily: 'var(--mono)', fontSize: 10.5, background: s.source === 'SHOPIFY' ? 'rgba(90,110,80,.14)' : 'var(--surface-2)', padding: '3px 8px', borderRadius: 7 }}>{s.source}</span></div>
              <div><span style={{ fontFamily: 'var(--mono)', fontSize: 10.5, padding: '3px 8px', borderRadius: 7, color: meta.fg, background: meta.bg }}>{s.status.replace(/_/g, ' ')}</span></div>
              <div style={{ color: 'var(--ink-3)', fontSize: 12.5 }}>{new Date(s.placedAt).toLocaleDateString()}</div>
              <div style={{ textAlign: 'right', fontWeight: 600, fontVariantNumeric: 'tabular-nums' }}>{money(s.totalInr)}</div>
            </div>
          );
        })}
      </div>

      {open && <SaleDrawer sale={open} onClose={() => setOpenId(null)} />}
    </div>
  );
}

function SaleDrawer({ sale, onClose }: { sale: SaleRow; onClose: () => void }) {
  const qc = useQueryClient();
  const [returning, setReturning] = useState(false);
  const [retQty, setRetQty] = useState<Record<string, number>>({});
  const returnedQty = (lineId: string) => 0; // per-line returned quantities live in returns[].lines JSON — server enforces the cap

  const doReturn = useMutation({
    mutationFn: async () =>
      api.post('/retail/returns', {
        saleId: sale.id,
        lines: Object.entries(retQty).filter(([, q]) => q > 0).map(([saleLineId, quantity]) => ({ saleLineId, quantity })),
      }),
    onSuccess: () => {
      toast.success('Return processed — refund journal posted, loyalty reversed, stock restocked');
      setReturning(false); setRetQty({});
      qc.invalidateQueries({ queryKey: ['retail-sales'] });
      onClose();
    },
    onError: (e) => toast.error(apiErrorMessage(e)),
  });

  const anyReturn = Object.values(retQty).some((q) => q > 0);

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(10,14,25,.45)', zIndex: 60, display: 'flex', justifyContent: 'flex-end' }} onClick={onClose}>
      <div className="card" style={{ width: 500, maxWidth: '94vw', height: '100%', borderRadius: 0, padding: 24, overflowY: 'auto' }} onClick={(e) => e.stopPropagation()}>
        <div style={{ display: 'flex', alignItems: 'center', marginBottom: 4 }}>
          <div style={{ fontWeight: 800, fontSize: 18 }}>{sale.code}</div>
          {sale.externalOrderNo && <span style={{ marginLeft: 8, color: 'var(--ink-3)', fontSize: 13 }}>{sale.externalOrderNo} on Shopify</span>}
          <span style={{ flex: 1 }} />
          <button className="btn-secondary" style={{ height: 32, width: 32, padding: 0 }} onClick={onClose}><X size={15} /></button>
        </div>
        <div style={{ color: 'var(--ink-3)', fontSize: 13, marginBottom: 16 }}>
          {custName(sale.customer)} · {sale.source === 'SHOPIFY' ? 'online' : `in-store${sale.branch ? ` at ${sale.branch.name}` : ''}`} · {new Date(sale.placedAt).toLocaleString()}
        </div>

        <div className="eyebrow" style={{ marginBottom: 8 }}>Lines</div>
        {sale.lines.map((l) => (
          <div key={l.id} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '8px 0', borderBottom: '1px solid var(--line-soft)', fontSize: 13.5 }}>
            <div style={{ flex: 1 }}>
              <div>{l.description}</div>
              <div style={{ fontSize: 12, color: 'var(--ink-3)' }}>{l.quantity} × {money(l.unitPriceInr)}{l.variantId ? '' : ' · unmatched item'}</div>
            </div>
            {returning ? (
              <input
                className="input" style={{ width: 64, height: 30, fontSize: 13, textAlign: 'center' }} inputMode="numeric" placeholder="0"
                value={retQty[l.id] ?? ''} onChange={(e) => setRetQty({ ...retQty, [l.id]: Math.min(l.quantity - returnedQty(l.id), Number(e.target.value.replace(/\D/g, '')) || 0) })}
              />
            ) : (
              <div style={{ fontWeight: 600, fontVariantNumeric: 'tabular-nums' }}>{money(l.totalInr)}</div>
            )}
          </div>
        ))}

        <div style={{ margin: '14px 0', fontSize: 13.5 }}>
          <Row k="Subtotal" v={money(sale.subtotalInr)} />
          {sale.discountInr > 0 && <Row k="Discount" v={`− ${money(sale.discountInr)}`} />}
          {sale.shippingInr > 0 && <Row k="Shipping" v={money(sale.shippingInr)} />}
          <Row k={taxLabel()} v={money(sale.taxInr)} />
          <div style={{ display: 'flex', justifyContent: 'space-between', borderTop: '2px solid var(--line)', marginTop: 6, paddingTop: 8, fontWeight: 800, fontSize: 15 }}>
            <span>Total</span><span>{money(sale.totalInr)}</span>
          </div>
        </div>

        {sale.returns.length > 0 && (
          <>
            <div className="eyebrow" style={{ margin: '14px 0 8px' }}>Returns</div>
            {sale.returns.map((r) => (
              <div key={r.id} style={{ display: 'flex', justifyContent: 'space-between', padding: '7px 0', borderBottom: '1px solid var(--line-soft)', fontSize: 13 }}>
                <span style={{ color: 'var(--ink-2)' }}>{r.kind} · {new Date(r.createdAt).toLocaleDateString()}</span>
                <span style={{ fontWeight: 700, color: '#c0392b' }}>− {money(r.refundInr)}</span>
              </div>
            ))}
          </>
        )}

        {sale.status !== 'CANCELLED' && sale.status !== 'REFUNDED' && (
          returning ? (
            <div style={{ display: 'flex', gap: 8, marginTop: 16 }}>
              <button className="btn-secondary" style={{ height: 40, flex: 1 }} onClick={() => { setReturning(false); setRetQty({}); }}>Cancel</button>
              <button className="btn-primary" style={{ height: 40, flex: 2 }} disabled={!anyReturn || doReturn.isPending} onClick={() => doReturn.mutate()}>
                {doReturn.isPending ? 'Processing…' : 'Process return'}
              </button>
            </div>
          ) : (
            <button className="btn-secondary" style={{ height: 40, width: '100%', marginTop: 16 }} onClick={() => setReturning(true)}>
              <Undo2 size={14} /> Return items…
            </button>
          )
        )}
      </div>
    </div>
  );
}

function Row({ k, v }: { k: string; v: string }) {
  return <div style={{ display: 'flex', justifyContent: 'space-between', padding: '4px 0', color: 'var(--ink-2)' }}><span>{k}</span><span style={{ fontVariantNumeric: 'tabular-nums' }}>{v}</span></div>;
}
