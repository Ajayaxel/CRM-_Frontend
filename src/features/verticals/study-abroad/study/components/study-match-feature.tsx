'use client';

import { useState } from 'react';
import { useMutation } from '@tanstack/react-query';
import { Sparkles, Wand2, Globe, GraduationCap } from 'lucide-react';
import { api } from '@/lib/api';
import { ProgramMatch, LEVELS, ProgramLevel, money } from '../study-client';

const card: React.CSSProperties = { background: 'var(--surface)', border: '1px solid var(--line-soft)', borderRadius: 16 };

export function StudyMatchFeature() {
  const [f, setF] = useState<any>({ country: '', level: 'MASTERS', discipline: '', budgetInr: '', ielts: '' });
  const [res, setRes] = useState<ProgramMatch[] | null>(null);
  const set = (k: string, v: any) => setF((s: any) => ({ ...s, [k]: v }));
  const run = useMutation({
    mutationFn: () => api.post<ProgramMatch[]>('/study/match', { country: f.country || undefined, level: f.level || undefined, discipline: f.discipline || undefined, budgetInr: f.budgetInr ? Number(f.budgetInr) : undefined, ielts: f.ielts ? Number(f.ielts) : undefined }).then((r) => r.data),
    onSuccess: (d) => setRes(d),
  });
  return (
    <div style={{ animation: 'fadeUp .4s ease' }}>
      <div style={{ marginBottom: 18 }}>
        <h1 style={{ fontSize: 26, fontWeight: 700, letterSpacing: '-.02em', margin: 0, display: 'flex', alignItems: 'center', gap: 10 }}><Sparkles size={24} style={{ color: 'var(--gold,#E6A23C)' }} /> Program Match</h1>
        <p style={{ fontSize: 14, color: 'var(--ink-2)', margin: '6px 0 0' }}>AI-rank programs for a student's country, level, discipline, budget and IELTS.</p>
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: '300px 1fr', gap: 16 }}>
        <div style={{ ...card, padding: 16 }}>
          <div style={{ fontWeight: 700, fontSize: 13.5, marginBottom: 12 }}>Student preferences</div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            <div><label className="label">Country</label><input className="input" value={f.country} onChange={(e) => set('country', e.target.value)} placeholder="Canada" /></div>
            <div style={{ display: 'flex', gap: 8 }}>
              <div style={{ flex: 1 }}><label className="label">Level</label><select className="input" value={f.level} onChange={(e) => set('level', e.target.value)}><option value="">Any</option>{LEVELS.map((l) => <option key={l} value={l}>{l[0] + l.slice(1).toLowerCase()}</option>)}</select></div>
              <div style={{ width: 80 }}><label className="label">IELTS</label><input className="input" type="number" step="0.5" value={f.ielts} onChange={(e) => set('ielts', e.target.value)} /></div>
            </div>
            <div><label className="label">Discipline</label><input className="input" value={f.discipline} onChange={(e) => set('discipline', e.target.value)} placeholder="Computer" /></div>
            <div><label className="label">Budget ₹/yr</label><input className="input" type="number" value={f.budgetInr} onChange={(e) => set('budgetInr', e.target.value)} /></div>
            <button className="btn-primary" disabled={run.isPending} onClick={() => run.mutate()}><Wand2 size={15} /> Find programs</button>
          </div>
        </div>
        <div>
          {res == null && <div style={{ ...card, padding: 50, textAlign: 'center', color: 'var(--ink-3)' }}><Sparkles size={30} style={{ opacity: 0.4 }} /><div style={{ marginTop: 12, fontSize: 14 }}>Set preferences and run the matcher.</div></div>}
          {res != null && res.length === 0 && <div style={{ ...card, padding: 50, textAlign: 'center', color: 'var(--ink-3)' }}>No matching programs. Widen the criteria.</div>}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            {(res ?? []).map((m) => (
              <div key={m.program.id} style={{ ...card, padding: 16, display: 'flex', gap: 16, alignItems: 'center' }}>
                <Ring pct={m.matchPct} />
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                    <span style={{ fontWeight: 700, fontSize: 15 }}><GraduationCap size={14} style={{ verticalAlign: -2, marginRight: 4 }} />{m.program.name}</span>
                  </div>
                  <div style={{ fontSize: 12.5, color: 'var(--ink-3)', marginTop: 3 }}><Globe size={11} style={{ verticalAlign: -1, marginRight: 3 }} />{m.program.university.name} · {m.program.university.country}{m.program.university.ranking ? ` · #${m.program.university.ranking}` : ''}</div>
                  <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginTop: 8 }}>{m.reasons.map((r) => <span key={r} className="badge" style={{ background: 'var(--success-bg)', color: 'var(--success)' }}>{r}</span>)}</div>
                </div>
                <div style={{ fontWeight: 800, fontSize: 15, color: 'var(--brand,#132376)', flexShrink: 0 }}>{money(m.program.tuitionInr)}</div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
function Ring({ pct }: { pct: number }) {
  const color = pct >= 80 ? 'var(--success)' : pct >= 50 ? 'var(--gold,#E6A23C)' : 'var(--ink-3)';
  return <div style={{ width: 54, height: 54, borderRadius: '50%', flexShrink: 0, background: `conic-gradient(${color} ${pct * 3.6}deg, var(--surface-2) 0)`, display: 'flex', alignItems: 'center', justifyContent: 'center' }}><div style={{ width: 42, height: 42, borderRadius: '50%', background: 'var(--surface)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 800, fontSize: 13, color }}>{pct}%</div></div>;
}
