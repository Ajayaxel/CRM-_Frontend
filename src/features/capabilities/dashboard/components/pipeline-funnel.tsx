import React from 'react';

const cardStyle: React.CSSProperties = {
  background: 'var(--surface)',
  border: '1px solid var(--line-soft)',
  borderRadius: 20,
  boxShadow: 'var(--shadow-1)',
};

const FUNNEL = [
  { name: 'New', count: 38, pct: 100, color: '#9A8F88' },
  { name: 'Contacted', count: 29, pct: 76, color: '#132376' },
  { name: 'Interested', count: 22, pct: 58, color: '#E6A23C' },
  { name: 'Follow-up', count: 17, pct: 45, color: '#E6A23C' },
  { name: 'Admission Pending', count: 11, pct: 29, color: '#132376' },
  { name: 'Converted', count: 8, pct: 21, color: '#00A63E' },
];

export function PipelineFunnel({
  stages = [],
}: {
  stages: { name: string; count: number; color: string }[];
}) {
  const totalCount = stages.reduce((acc, s) => acc + s.count, 0);

  return (
    <div style={{ ...cardStyle, padding: '22px 24px' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 18 }}>
        <div>
          <div style={{ fontWeight: 700, fontSize: 15 }}>Lead Pipeline</div>
          <div style={{ fontSize: 12, color: 'var(--ink-3)' }}>
            {totalCount} leads across {stages.length} stages
          </div>
        </div>
      </div>
      {stages.map((s) => {
        const maxStageCount = Math.max(...stages.map((st) => st.count), 1);
        const pct = Math.round((s.count / maxStageCount) * 100);
        return (
          <div key={s.name} style={{ marginBottom: 13 }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', fontSize: 13, marginBottom: 6 }}>
              <span style={{ fontWeight: 600, color: 'var(--ink)' }}>{s.name}</span>
              <span style={{ color: 'var(--ink-3)', fontVariantNumeric: 'tabular-nums' }}>{s.count}</span>
            </div>
            <div style={{ height: 9, borderRadius: 99, background: 'var(--surface-2)', overflow: 'hidden' }}>
              <div style={{ height: '100%', width: `${pct}%`, background: s.color, borderRadius: 99 }} />
            </div>
          </div>
        );
      })}
      {stages.length === 0 && (
        <div style={{ color: 'var(--ink-3)', fontSize: 13, textAlign: 'center', padding: '30px 0' }}>
          No lead stages found.
        </div>
      )}
    </div>
  );
}

