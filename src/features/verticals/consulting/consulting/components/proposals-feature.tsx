'use client';

import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { FileText, Plus, X, Check, Ban, Send } from 'lucide-react';
import { api, apiErrorMessage } from '@/lib/api';
import { Proposal, ProposalStatus, PROPOSAL_META, money } from '../consulting-client';

const card: React.CSSProperties = { background: 'var(--surface)', border: '1px solid var(--line-soft)', borderRadius: 16 };

export function ProposalsFeature() {
  const qc = useQueryClient();
  const [compose, setCompose] = useState(false);
  const { data } = useQuery({ queryKey: ['consulting-proposals'], queryFn: async () => (await api.get<Proposal[]>('/consulting/proposals')).data });
  const refresh = () => { qc.invalidateQueries({ queryKey: ['consulting-proposals'] }); qc.invalidateQueries({ queryKey: ['consulting-board'] }); qc.invalidateQueries({ queryKey: ['consulting-stats'] }); };
  const decide = useMutation({ mutationFn: ({ id, status }: { id: string; status: ProposalStatus }) => api.patch(`/consulting/proposals/${id}/decision`, { status }), onSuccess: (_d, v) => { refresh(); toast.success(v.status === 'ACCEPTED' ? 'Accepted — engagement created' : `Marked ${v.status.toLowerCase()}`); } });

  const list = data ?? [];

  return (
    <div style={{ animation: 'fadeUp .4s ease' }}>
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 18 }}>
        <div>
          <h1 style={{ fontSize: 26, fontWeight: 700, letterSpacing: '-.02em', margin: 0 }}>Proposals</h1>
          <p style={{ fontSize: 14, color: 'var(--ink-2)', margin: '6px 0 0' }}>Scope & fee proposals. Accepting one spins up an active engagement.</p>
        </div>
        <button className="btn-primary" onClick={() => setCompose(true)}><Plus size={15} /> New proposal</button>
      </div>

      {list.length === 0 && <div style={{ ...card, padding: 44, textAlign: 'center', color: 'var(--ink-3)' }}><FileText size={30} style={{ opacity: 0.4 }} /><div style={{ marginTop: 10, fontSize: 14 }}>No proposals yet. Draft your first scope & fee.</div></div>}

      <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        {list.map((p) => {
          const st = PROPOSAL_META[p.status];
          const decided = p.status === 'ACCEPTED' || p.status === 'REJECTED';
          return (
            <div key={p.id} style={{ ...card, padding: 18 }}>
              <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12 }}>
                <div style={{ flex: 1 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                    <span style={{ fontWeight: 700, fontSize: 15 }}>{p.title}</span>
                    <span className="badge" style={{ background: st.bg, color: st.fg }}>{st.label}</span>
                  </div>
                  <div style={{ fontSize: 12.5, color: 'var(--ink-3)', marginTop: 3 }}>{p.clientName} · {money(p.amountInr)}</div>
                  {p.scope && <div style={{ fontSize: 13, color: 'var(--ink-2)', marginTop: 8 }}>{p.scope}</div>}
                </div>
                <div style={{ display: 'flex', gap: 6, flexShrink: 0 }}>
                  {p.status === 'DRAFT' && <button className="btn-secondary" style={{ height: 32 }} onClick={() => decide.mutate({ id: p.id, status: 'SENT' })}><Send size={13} /> Send</button>}
                  {!decided && <>
                    <button className="btn-primary" style={{ height: 32 }} onClick={() => decide.mutate({ id: p.id, status: 'ACCEPTED' })}><Check size={13} /> Accept</button>
                    <button className="btn-secondary" style={{ height: 32 }} onClick={() => decide.mutate({ id: p.id, status: 'REJECTED' })}><Ban size={13} /></button>
                  </>}
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {compose && <ProposalModal onClose={() => setCompose(false)} onDone={refresh} />}
    </div>
  );
}

function ProposalModal({ onClose, onDone }: { onClose: () => void; onDone: () => void }) {
  const [f, setF] = useState<any>({ clientName: '', title: '', scope: '', amountInr: '' });
  const set = (k: string, v: any) => setF((s: any) => ({ ...s, [k]: v }));
  const create = useMutation({ mutationFn: () => api.post('/consulting/proposals', { clientName: f.clientName, title: f.title, scope: f.scope || undefined, amountInr: Number(f.amountInr) }), onSuccess: () => { onDone(); toast.success('Proposal drafted'); onClose(); }, onError: (e) => toast.error(apiErrorMessage(e)) });
  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 60, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }}>
      <div style={{ position: 'absolute', inset: 0, background: 'rgba(20,15,12,.42)' }} onClick={onClose} />
      <div style={{ ...card, position: 'relative', zIndex: 1, width: 520, maxWidth: '100%', padding: 22, borderRadius: 18 }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}><div style={{ fontWeight: 700, fontSize: 16 }}>New proposal</div><button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--ink-3)' }}><X size={20} /></button></div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          <div style={{ display: 'flex', gap: 10 }}>
            <div style={{ flex: 1 }}><label className="label">Client</label><input className="input" value={f.clientName} onChange={(e) => set('clientName', e.target.value)} placeholder="Nimbus Foods" /></div>
            <div style={{ width: 140 }}><label className="label">Fee ₹</label><input className="input" type="number" value={f.amountInr} onChange={(e) => set('amountInr', e.target.value)} /></div>
          </div>
          <div><label className="label">Title</label><input className="input" value={f.title} onChange={(e) => set('title', e.target.value)} placeholder="Ops transformation" /></div>
          <div><label className="label">Scope</label><textarea className="input" style={{ minHeight: 88, paddingTop: 8, resize: 'vertical' }} value={f.scope} onChange={(e) => set('scope', e.target.value)} placeholder="90-day operations overhaul…" /></div>
        </div>
        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10, marginTop: 18 }}><button className="btn-secondary" onClick={onClose}>Cancel</button><button className="btn-primary" disabled={!f.clientName || !f.title || !f.amountInr || create.isPending} onClick={() => create.mutate()}>Create</button></div>
      </div>
    </div>
  );
}
