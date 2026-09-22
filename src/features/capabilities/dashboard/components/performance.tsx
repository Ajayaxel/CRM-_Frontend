import React from 'react';

const cardStyle: React.CSSProperties = {
  background: 'var(--surface)',
  border: '1px solid var(--line-soft)',
  borderRadius: 20,
  boxShadow: 'var(--shadow-1)',
};

export function Performance({
  pipelineValue,
  conversionRate,
  avgFee,
  series = [],
}: {
  pipelineValue: number;
  conversionRate: number;
  avgFee: number;
  series: { label: string; value: number }[];
}) {
  const formatValue = (val: number, isCurrency: boolean = false) => {
    if (!val) return isCurrency ? '₹0' : '0';
    if (isCurrency) {
      if (val >= 100000) return `₹${(val / 100000).toFixed(1)}L`;
      if (val >= 1000) return `₹${(val / 1000).toFixed(0)}K`;
      return `₹${val}`;
    }
    return `${val}`;
  };

  const width = 640;
  const height = 180;
  const padding = 30;
  const graphHeight = height - padding;

  const maxValue = Math.max(...series.map((s) => s.value), 5);
  const points = series.map((s, idx) => {
    const x = idx * (width / Math.max(series.length - 1, 1));
    const y = height - (s.value / maxValue) * graphHeight;
    return { x, y, label: s.label };
  });

  const pathD = points.length > 0
    ? `M ${points.map((p) => `${p.x},${p.y}`).join(' L ')}`
    : '';

  const areaD = points.length > 0
    ? `${pathD} L ${width},${height} L 0,${height} Z`
    : '';

  return (
    <div style={{ ...cardStyle, padding: 24 }}>
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 20 }}>
        <div>
          <div style={{ fontWeight: 700, fontSize: 16 }}>Enrolment Performance</div>
          <div style={{ fontSize: 12, color: 'var(--ink-3)', marginTop: 2 }}>Dynamic 6-month admissions trend</div>
        </div>
        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 12, background: 'var(--gold-bg)', color: 'var(--gold-ink)', padding: '5px 10px', borderRadius: 99, fontWeight: 600 }}>
          <span style={{ width: 6, height: 6, borderRadius: 99, background: 'var(--gold)', animation: 'livepulse 1.6s infinite' }} />Live Data
        </span>
      </div>
      <div style={{ display: 'flex', gap: 44, marginBottom: 22 }}>
        {[
          [formatValue(pipelineValue, true), 'Pipeline Value'],
          [`${conversionRate}%`, 'Conversion Rate'],
          [formatValue(avgFee, true), 'Avg. Fee'],
        ].map(([v, l]) => (
          <div key={l}>
            <div style={{ fontSize: 30, fontWeight: 800, letterSpacing: '-.02em' }}>{v}</div>
            <div style={{ fontSize: 12, color: 'var(--ink-3)', marginTop: 3 }}>{l}</div>
          </div>
        ))}
      </div>
      <svg viewBox="0 0 640 220" width="100%" height="200" preserveAspectRatio="none" style={{ display: 'block', overflow: 'visible' }}>
        <defs>
          <linearGradient id="areaFill" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" stopColor="var(--gold)" stopOpacity=".38" />
            <stop offset="1" stopColor="var(--gold)" stopOpacity="0" />
          </linearGradient>
        </defs>
        <g stroke="var(--line-soft)" strokeWidth="1">
          <line x1="0" y1="30" x2="640" y2="30" strokeDasharray="4 5" />
          <line x1="0" y1="80" x2="640" y2="80" strokeDasharray="4 5" />
          <line x1="0" y1="130" x2="640" y2="130" strokeDasharray="4 5" />
          <line x1="0" y1="180" x2="640" y2="180" />
        </g>
        {areaD && <path d={areaD} fill="url(#areaFill)" />}
        {pathD && <path d={pathD} fill="none" stroke="var(--gold)" strokeWidth="2.5" strokeLinecap="round" />}
        {points.map((p, idx) => (
          <circle key={idx} cx={p.x} cy={p.y} r="5" fill="var(--surface)" stroke="var(--gold)" strokeWidth="3" />
        ))}
      </svg>
      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, color: 'var(--ink-3)', marginTop: 8, fontFamily: 'var(--mono)', letterSpacing: '.05em' }}>
        {points.map((p, idx) => <span key={idx}>{p.label}</span>)}
      </div>
    </div>
  );
}

