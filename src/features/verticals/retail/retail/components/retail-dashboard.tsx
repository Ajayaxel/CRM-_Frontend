'use client';

import Link from 'next/link';
import { useQuery } from '@tanstack/react-query';
import { AlertTriangle, ArrowRight, Plug, Shirt, ShoppingBag, Users2 } from 'lucide-react';
import { retailApi, money, custName, SALE_STATUS_META } from '../retail-client';

export function RetailDashboard() {
  const { data, isLoading } = useQuery({ queryKey: ['retail-dashboard'], queryFn: retailApi.dashboard });

  if (isLoading) return <div style={{ padding: 40, textAlign: 'center', color: 'var(--ink-3)' }}>Loading…</div>;
  if (!data) return null;

  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'baseline', gap: 10, marginBottom: 18 }}>
        <h1 style={{ fontSize: 22, letterSpacing: '-.02em', margin: 0 }}>Retail</h1>
        <span style={{ color: 'var(--ink-3)', fontSize: 13 }}>catalogue · stores · omni-channel sales</span>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(170px,1fr))', gap: 12, marginBottom: 16 }}>
        <Kpi icon={<Shirt size={15} />} label="Styles" value={String(data.styles)} sub={`${data.variants} variants`} />
        <Kpi icon={<Users2 size={15} />} label="Customers" value={String(data.customers)} />
        <Kpi icon={<ShoppingBag size={15} />} label="Sales" value={String(data.salesCount)} sub={money(data.salesTotalInr)} />
        <Kpi
          icon={<Plug size={15} />}
          label="Shopify"
          value={data.shopify ? (data.shopify.status === 'ACTIVE' ? 'Connected' : data.shopify.status) : 'Not connected'}
          sub={data.shopify?.shopDomain ?? undefined}
          tone={data.shopify?.status === 'ACTIVE' ? 'good' : undefined}
        />
      </div>

      {data.unmatchedSkus > 0 && (
        <Link href="/retail/shopify" style={{ textDecoration: 'none' }}>
          <div className="card" style={{ padding: '12px 16px', marginBottom: 16, display: 'flex', alignItems: 'center', gap: 10, borderLeft: '3px solid var(--gold,#E6A23C)' }}>
            <AlertTriangle size={16} color="var(--gold,#b8791f)" />
            <span style={{ fontSize: 13.5 }}>
              <strong>{data.unmatchedSkus}</strong> Shopify variant{data.unmatchedSkus === 1 ? '' : 's'} could not be matched by SKU — review them so nothing is silently mis-mapped.
            </span>
            <ArrowRight size={14} style={{ marginLeft: 'auto' }} />
          </div>
        </Link>
      )}

      <div className="card" style={{ overflow: 'hidden' }}>
        <div style={{ padding: '14px 20px', fontWeight: 700, fontSize: 14.5, borderBottom: '1px solid var(--line-soft)' }}>Recent sales</div>
        {(data.recent ?? []).length === 0 && <div style={{ padding: 32, textAlign: 'center', color: 'var(--ink-3)' }}>No sales yet — ring one up in the POS or connect Shopify.</div>}
        {(data.recent ?? []).map((s: any) => {
          const meta = SALE_STATUS_META[s.status] ?? { fg: 'var(--ink-2)', bg: 'var(--surface-2)' };
          return (
            <div key={s.id} style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr auto', gap: 12, padding: '12px 20px', borderBottom: '1px solid var(--line-soft)', alignItems: 'center', fontSize: 13.5 }}>
              <div style={{ fontFamily: 'var(--mono)', fontSize: 12 }}>{s.code}</div>
              <div>{custName(s.customer)}</div>
              <div><span style={{ fontFamily: 'var(--mono)', fontSize: 10.5, padding: '3px 8px', borderRadius: 7, color: meta.fg, background: meta.bg }}>{s.source} · {s.status}</span></div>
              <div style={{ fontVariantNumeric: 'tabular-nums', fontWeight: 600 }}>{money(s.totalInr ?? 0)}</div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function Kpi({ icon, label, value, sub, tone }: { icon: React.ReactNode; label: string; value: string; sub?: string; tone?: 'good' }) {
  return (
    <div className="card" style={{ padding: 16 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 7, fontSize: 12, color: 'var(--ink-3)', fontWeight: 600 }}>{icon}{label}</div>
      <div style={{ fontSize: 21, fontWeight: 800, marginTop: 5, letterSpacing: '-.02em', color: tone === 'good' ? '#1e874b' : undefined }}>{value}</div>
      {sub && <div style={{ fontSize: 12, color: 'var(--ink-3)', marginTop: 2 }}>{sub}</div>}
    </div>
  );
}
