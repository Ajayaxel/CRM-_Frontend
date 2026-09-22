'use client';

import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { Search } from 'lucide-react';
import { api } from '@/lib/api';
import { Patient, patientName } from '@/features/verticals/healthcare/practice';
import { CONDITIONS, CONDITION_MAP, LOWER_ROW, UPPER_ROW, ToothChart } from '../dental-client';

const card: React.CSSProperties = { background: 'var(--surface)', border: '1px solid var(--line-soft)', borderRadius: 16 };

export function OdontogramFeature() {
  const [q, setQ] = useState('');
  const [patientId, setPatientId] = useState<string>('');
  const { data: patients } = useQuery({ queryKey: ['practice-patients', q], queryFn: async () => (await api.get<Patient[]>(`/practice/patients${q ? `?q=${encodeURIComponent(q)}` : ''}`)).data });

  return (
    <div style={{ animation: 'fadeUp .4s ease' }}>
      <div style={{ marginBottom: 18 }}>
        <h1 style={{ fontSize: 26, fontWeight: 700, letterSpacing: '-.02em', margin: 0 }}>Odontogram</h1>
        <p style={{ fontSize: 14, color: 'var(--ink-2)', margin: '6px 0 0' }}>Chart tooth conditions in FDI notation. Click a tooth to mark it.</p>
      </div>

      <div style={{ display: 'flex', gap: 10, marginBottom: 18, alignItems: 'flex-end', flexWrap: 'wrap' }}>
        <div style={{ position: 'relative', minWidth: 240 }}>
          <Search size={15} style={{ position: 'absolute', left: 12, top: 33, color: 'var(--ink-3)' }} />
          <label className="label">Find patient</label>
          <input className="input" style={{ paddingLeft: 34 }} value={q} onChange={(e) => setQ(e.target.value)} placeholder="Name / MRN / phone" />
        </div>
        <div style={{ minWidth: 240 }}>
          <label className="label">Patient</label>
          <select className="input" value={patientId} onChange={(e) => setPatientId(e.target.value)}>
            <option value="">Select…</option>
            {(patients ?? []).map((p) => <option key={p.id} value={p.id}>{patientName(p)} · {p.mrn}</option>)}
          </select>
        </div>
      </div>

      {!patientId && <div style={{ ...card, padding: 44, textAlign: 'center', color: 'var(--ink-3)', fontSize: 14 }}>Select a patient to chart their teeth.</div>}
      {patientId && <Chart patientId={patientId} />}
    </div>
  );
}

function Chart({ patientId }: { patientId: string }) {
  const qc = useQueryClient();
  const [active, setActive] = useState<string | null>(null);
  const { data } = useQuery({ queryKey: ['dental-chart', patientId], queryFn: async () => (await api.get<ToothChart>(`/dental/chart/${patientId}`)).data });
  const teeth = data?.teeth ?? {};
  const setTooth = useMutation({
    mutationFn: ({ tooth, condition }: { tooth: string; condition: string }) => api.patch(`/dental/chart/${patientId}`, { tooth, condition }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['dental-chart', patientId] }); setActive(null); toast.success('Charted'); },
  });

  const Tooth = ({ n }: { n: string }) => {
    const cond = teeth[n];
    const meta = cond ? CONDITION_MAP[cond] : null;
    const on = active === n;
    return (
      <button
        onClick={() => setActive(on ? null : n)}
        title={cond ? meta?.label : `Tooth ${n}`}
        style={{
          width: 40, height: 52, borderRadius: 8, cursor: 'pointer',
          border: on ? '2px solid var(--brand,#132376)' : '1px solid var(--line-soft)',
          background: meta ? `color-mix(in srgb, ${meta.color} 22%, var(--surface))` : 'var(--surface)',
          display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 2,
        }}
      >
        <span style={{ fontSize: 13, fontWeight: 700, color: meta ? meta.color : 'var(--ink-2)' }}>{meta?.abbr || ''}</span>
        <span style={{ fontSize: 9.5, color: 'var(--ink-3)', fontFamily: 'var(--mono)' }}>{n}</span>
      </button>
    );
  };

  const Row = ({ nums }: { nums: string[] }) => (
    <div style={{ display: 'flex', gap: 4, justifyContent: 'center' }}>
      {nums.map((n, i) => (
        <div key={n} style={{ marginLeft: i === 8 ? 14 : 0 }}><Tooth n={n} /></div>
      ))}
    </div>
  );

  return (
    <div style={{ ...card, padding: 22 }}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8, overflowX: 'auto', paddingBottom: 6 }}>
        <Row nums={UPPER_ROW} />
        <div style={{ height: 1, background: 'var(--line-soft)', margin: '4px 0' }} />
        <Row nums={LOWER_ROW} />
      </div>

      {active && (
        <div style={{ marginTop: 18, padding: 14, borderRadius: 12, background: 'var(--surface-2)' }}>
          <div style={{ fontSize: 12.5, fontWeight: 700, marginBottom: 10 }}>Tooth {active} — set condition</div>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            {CONDITIONS.map((c) => (
              <button key={c.key} className="btn-secondary" style={{ height: 34, borderColor: c.color, color: c.key === 'HEALTHY' ? 'var(--ink-2)' : c.color }} disabled={setTooth.isPending} onClick={() => setTooth.mutate({ tooth: active, condition: c.key })}>
                {c.abbr && <span style={{ width: 8, height: 8, borderRadius: '50%', background: c.color, display: 'inline-block', marginRight: 6 }} />}{c.label}
              </button>
            ))}
          </div>
        </div>
      )}

      <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', marginTop: 18, paddingTop: 14, borderTop: '1px solid var(--line-soft)' }}>
        {CONDITIONS.filter((c) => c.key !== 'HEALTHY').map((c) => (
          <span key={c.key} style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: 11.5, color: 'var(--ink-3)' }}>
            <span style={{ width: 10, height: 10, borderRadius: 3, background: c.color }} />{c.label}
          </span>
        ))}
      </div>
    </div>
  );
}
