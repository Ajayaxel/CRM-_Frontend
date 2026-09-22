import React from 'react';

const cardStyle: React.CSSProperties = {
  background: 'var(--surface)',
  border: '1px solid var(--line-soft)',
  borderRadius: 20,
  boxShadow: 'var(--shadow-1)',
};

export function AdmissionRing({
  enrolled = 0,
  inProcess = 0,
  noun = 'Conversion',
}: {
  enrolled: number;
  inProcess: number;
  noun?: string;
}) {
  const total = enrolled + inProcess;
  const pct = total ? Math.round((enrolled / total) * 100) : 0;
  // Circumference = 2 * PI * r = 2 * 3.14159265 * 52 = 326.72
  const circ = 326.72;
  const strokeOffset = circ - (pct / 100) * circ;

  return (
    <div style={{ ...cardStyle, padding: '22px 24px', display: 'flex', flexDirection: 'column' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 }}>
        <div>
          <div style={{ fontWeight: 700, fontSize: 15 }}>{noun} funnel</div>
          <div style={{ fontSize: 12, color: 'var(--ink-3)' }}>
            {noun}s that completed, against those still in progress
          </div>
        </div>
      </div>
      <div style={{ flex: 1, display: 'flex', alignItems: 'center', gap: 18 }}>
        <div style={{ position: 'relative', width: 120, height: 120, flex: '0 0 120px' }}>
          <svg width="120" height="120" viewBox="0 0 120 120" style={{ transform: 'rotate(-90deg)' }}>
            <circle cx="60" cy="60" r="52" fill="none" stroke="var(--surface-2)" strokeWidth="12" />
            <circle cx="60" cy="60" r="52" fill="none" stroke="var(--gold)" strokeWidth="12" strokeLinecap="round" strokeDasharray={String(circ)} strokeDashoffset={strokeOffset} />
          </svg>
          <div style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
            <div style={{ fontSize: 26, fontWeight: 800, letterSpacing: '-.02em' }}>{pct}%</div>
          </div>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 7, fontSize: 12.5, color: 'var(--ink-2)' }}>
              <span style={{ width: 9, height: 9, borderRadius: 3, background: 'var(--gold)' }} />Enrolled
            </div>
            <div style={{ fontSize: 20, fontWeight: 700, marginTop: 2 }}>
              {enrolled}
              <span style={{ fontSize: 12, color: 'var(--ink-3)', fontWeight: 500 }}>/{total}</span>
            </div>
          </div>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 7, fontSize: 12.5, color: 'var(--ink-2)' }}>
              <span style={{ width: 9, height: 9, borderRadius: 3, background: 'var(--surface-2)', border: '1px solid var(--line)' }} />In Process
            </div>
            <div style={{ fontSize: 20, fontWeight: 700, marginTop: 2 }}>
              {inProcess}
              <span style={{ fontSize: 12, color: 'var(--ink-3)', fontWeight: 500 }}>/{total}</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
