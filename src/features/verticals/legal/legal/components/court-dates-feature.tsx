'use client';

import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { Gavel, X } from 'lucide-react';
import { api, apiErrorMessage } from '@/lib/api';
import { Hearing, dateFmt } from '../legal-client';

const card: React.CSSProperties = { background: 'var(--surface)', border: '1px solid var(--line-soft)', borderRadius: 16 };

export function CourtDatesFeature() {
  const qc = useQueryClient();
  const [outcomeFor, setOutcomeFor] = useState<Hearing | null>(null);
  const { data } = useQuery({ queryKey: ['legal-hearings'], queryFn: async () => (await api.get<Hearing[]>('/legal/hearings')).data });

  // group by date
  const groups: Record<string, Hearing[]> = {};
  for (const h of data ?? []) { (groups[dateFmt(h.at)] ??= []).push(h); }

  return (
    <div style={{ animation: 'fadeUp .4s ease' }}>
      <div style={{ marginBottom: 18 }}>
        <h1 style={{ fontSize: 26, fontWeight: 700, letterSpacing: '-.02em', margin: 0 }}>Court Dates</h1>
        <p style={{ fontSize: 14, color: 'var(--ink-2)', margin: '6px 0 0' }}>Upcoming hearings across all matters — record outcomes as they conclude.</p>
      </div>

      {(data ?? []).length === 0 && <div style={{ ...card, padding: 44, textAlign: 'center', color: 'var(--ink-3)' }}><Gavel size={30} style={{ opacity: 0.4 }} /><div style={{ marginTop: 10, fontSize: 14 }}>No upcoming hearings.</div></div>}

      <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
        {Object.entries(groups).map(([day, hs]) => (
          <div key={day}>
            <div className="eyebrow" style={{ marginBottom: 8 }}>{day}</div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {hs.map((h) => (
                <div key={h.id} style={{ ...card, padding: '14px 18px', display: 'flex', alignItems: 'center', gap: 14 }}>
                  <span style={{ width: 40, height: 40, borderRadius: 10, background: 'var(--brand-bg,#e9ecfb)', color: 'var(--brand,#132376)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}><Gavel size={18} /></span>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontWeight: 700, fontSize: 14 }}>{h.matter?.title ?? 'Hearing'} <span style={{ fontFamily: 'var(--mono)', fontSize: 11, color: 'var(--ink-3)', fontWeight: 400 }}>{h.matter?.reference}</span></div>
                    <div style={{ fontSize: 12.5, color: 'var(--ink-3)' }}>{[h.matter?.clientName, h.court, h.purpose].filter(Boolean).join(' · ')}</div>
                  </div>
                  <button className="btn-secondary" style={{ height: 32 }} onClick={() => setOutcomeFor(h)}>Record outcome</button>
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>

      {outcomeFor && <OutcomeModal hearing={outcomeFor} onClose={() => setOutcomeFor(null)} onDone={() => { qc.invalidateQueries({ queryKey: ['legal-hearings'] }); qc.invalidateQueries({ queryKey: ['legal-stats'] }); }} />}
    </div>
  );
}

function OutcomeModal({ hearing, onClose, onDone }: { hearing: Hearing; onClose: () => void; onDone: () => void }) {
  const [f, setF] = useState<any>({ outcome: '', nextAt: '' });
  const set = (k: string, v: any) => setF((s: any) => ({ ...s, [k]: v }));
  const save = useMutation({ mutationFn: () => api.patch(`/legal/hearings/${hearing.id}/outcome`, { outcome: f.outcome, nextAt: f.nextAt ? new Date(f.nextAt).toISOString() : undefined }), onSuccess: () => { onDone(); toast.success('Outcome recorded'); onClose(); }, onError: (e) => toast.error(apiErrorMessage(e)) });
  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 60, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }}>
      <div style={{ position: 'absolute', inset: 0, background: 'rgba(20,15,12,.42)' }} onClick={onClose} />
      <div style={{ ...card, position: 'relative', zIndex: 1, width: 460, maxWidth: '100%', padding: 22, borderRadius: 18 }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}><div style={{ fontWeight: 700, fontSize: 16 }}>Record outcome</div><button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--ink-3)' }}><X size={20} /></button></div>
        <div style={{ fontSize: 12.5, color: 'var(--ink-3)', marginBottom: 12 }}>{hearing.matter?.title} · {dateFmt(hearing.at)}</div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          <div><label className="label">Outcome</label><input className="input" value={f.outcome} onChange={(e) => set('outcome', e.target.value)} placeholder="Adjourned / arguments heard" /></div>
          <div style={{ width: 180 }}><label className="label">Next hearing</label><input className="input" type="date" value={f.nextAt} onChange={(e) => set('nextAt', e.target.value)} /></div>
        </div>
        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10, marginTop: 18 }}><button className="btn-secondary" onClick={onClose}>Cancel</button><button className="btn-primary" disabled={!f.outcome || save.isPending} onClick={() => save.mutate()}>Save</button></div>
      </div>
    </div>
  );
}
