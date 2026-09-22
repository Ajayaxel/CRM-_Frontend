import React from 'react';

const cardStyle: React.CSSProperties = {
  background: 'var(--surface)',
  border: '1px solid var(--line-soft)',
  borderRadius: 20,
  boxShadow: 'var(--shadow-1)',
};

export function TopCounsellor({
  counsellor,
  label = 'Top performer',
}: {
  label?: string;
  counsellor?: {
    name: string;
    role: string;
    initials: string;
    conversions: number;
    rate: number;
    revenue: number;
  } | null;
}) {
  const formatRevenue = (val: number) => {
    if (!val) return '₹0';
    if (val >= 100000) return `₹${(val / 100000).toFixed(1)}L`;
    if (val >= 1000) return `₹${(val / 1000).toFixed(0)}K`;
    return `₹${val}`;
  };

  if (!counsellor) {
    return (
      <div style={{ ...cardStyle, padding: '22px 24px', display: 'flex', flexDirection: 'column', height: '100%', justifyContent: 'center' }}>
        <div style={{ fontWeight: 700, fontSize: 15, marginBottom: 4 }}>{label}</div>
        <div style={{ fontSize: 13, color: 'var(--ink-3)', textAlign: 'center', padding: '30px 0' }}>
          No conversions recorded yet.
        </div>
      </div>
    );
  }

  return (
    <div style={{ ...cardStyle, padding: '22px 24px' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
        <div>
          <div style={{ fontWeight: 700, fontSize: 15 }}>{label}</div>
          <div style={{ fontSize: 12, color: 'var(--ink-3)' }}>This month</div>
        </div>
        <span style={{ fontFamily: 'var(--mono)', fontSize: 9, letterSpacing: '.1em', background: 'var(--gold)', color: '#241D19', padding: '3px 8px', borderRadius: 99, fontWeight: 700 }}>#1</span>
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 13, marginBottom: 18 }}>
        <span style={{ width: 48, height: 48, borderRadius: 99, background: '#7C8CE0', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 17, fontWeight: 700, flex: '0 0 48px' }}>
          {counsellor.initials}
        </span>
        <div>
          <div style={{ fontWeight: 700, fontSize: 15 }}>{counsellor.name}</div>
          <div style={{ fontSize: 12, color: 'var(--ink-3)' }}>{counsellor.role}</div>
        </div>
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 11 }}>
        {[
          ['Conversions', String(counsellor.conversions), 'var(--ink)'],
          ['Conversion rate', `${counsellor.rate}%`, 'var(--success)'],
          ['Revenue', formatRevenue(counsellor.revenue), 'var(--ink)'],
        ].map(([l, v, c]) => (
          <div key={l} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <span style={{ fontSize: 12.5, color: 'var(--ink-2)' }}>{l}</span>
            <span style={{ fontWeight: 700, fontSize: 14, color: c }}>{v}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

