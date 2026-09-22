import React from 'react';

export interface SegmentedOption {
  v: string;
  l: string;
}

export interface SegmentedProps {
  value: string;
  onChange: (v: string) => void;
  options: SegmentedOption[];
}

export function Segmented({ value, onChange, options }: SegmentedProps) {
  return (
    <div style={{ display: 'flex', background: 'var(--surface-2)', borderRadius: 11, padding: 4, gap: 3 }}>
      {options.map((o) => {
        const active = o.v === value;
        return (
          <button
            key={o.v}
            onClick={() => onChange(o.v)}
            style={{
              padding: '8px 16px', borderRadius: 9, border: 'none', cursor: 'pointer',
              fontWeight: 600, fontSize: 12.5,
              background: active ? 'var(--surface)' : 'transparent',
              color: active ? 'var(--ink)' : 'var(--ink-2)',
              boxShadow: active ? 'var(--shadow-1)' : 'none',
            }}
          >
            {o.l}
          </button>
        );
      })}
    </div>
  );
}
