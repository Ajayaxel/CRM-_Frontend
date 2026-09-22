'use client';

import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { Briefcase, Plus, X, Trash2, HeartPulse, FolderKanban, Link2, Check } from 'lucide-react';
import { api, apiErrorMessage } from '@/lib/api';
import { Account, AgencyStats, ACCOUNT_STATUS_META, money } from '../agency-client';

/**
 * Client portal links are issued by the API — signed, bound to this account and
 * tenant, expiring in 90 days. `/c/<accountId>` on its own opens nothing.
 */
function CopyLink({ accountId }: { accountId: string }) {
  const [copied, setCopied] = useState(false);
  const copy = async () => {
    try {
      const r = await api.post<{ path: string }>(`/agency/accounts/${accountId}/portal-link`);
      const link = `${window.location.origin}${r.data.path}`;
      try { await navigator.clipboard.writeText(link); } catch { window.prompt('Copy this link', link); }
      setCopied(true); toast.success('Client portal link copied · valid 90 days'); setTimeout(() => setCopied(false), 1200);
    } catch (e) { toast.error(apiErrorMessage(e)); }
  };
  return <button className="btn-secondary" style={{ height: 30, fontSize: 12 }} onClick={copy}>{copied ? <><Check size={12} /> Copied</> : <><Link2 size={12} /> Portal link</>}</button>;
}

const card: React.CSSProperties = { background: 'var(--surface)', border: '1px solid var(--line-soft)', borderRadius: 16 };

export function AccountsFeature() {
  const qc = useQueryClient();
  const [compose, setCompose] = useState(false);
  const { data: stats } = useQuery({ queryKey: ['agency-stats'], queryFn: async () => (await api.get<AgencyStats>('/agency/stats')).data });
  const { data } = useQuery({ queryKey: ['agency-accounts'], queryFn: async () => (await api.get<Account[]>('/agency/accounts')).data });
  const del = useMutation({ mutationFn: (id: string) => api.delete(`/agency/accounts/${id}`), onSuccess: () => { qc.invalidateQueries({ queryKey: ['agency-accounts'] }); qc.invalidateQueries({ queryKey: ['agency-stats'] }); toast.success('Removed'); } });

  return (
    <div style={{ animation: 'fadeUp .4s ease' }}>
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 18 }}>
        <div>
          <h1 style={{ fontSize: 26, fontWeight: 700, letterSpacing: '-.02em', margin: 0 }}>Client Accounts</h1>
          <p style={{ fontSize: 14, color: 'var(--ink-2)', margin: '6px 0 0' }}>Your brand clients, retainers and account health.</p>
        </div>
        <button className="btn-primary" onClick={() => setCompose(true)}><Plus size={15} /> New account</button>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 12, marginBottom: 18 }}>
        <Stat label="Clients" value={stats?.accounts ?? 0} />
        <Stat label="Active" value={stats?.activeAccounts ?? 0} accent="var(--success)" />
        <Stat label="Live projects" value={stats?.liveProjects ?? 0} accent="var(--brand,#132376)" />
        <Stat label="Retainer MRR" value={money(stats?.mrr ?? 0)} accent="var(--gold,#E6A23C)" />
      </div>

      {(data ?? []).length === 0 && <div style={{ ...card, padding: 44, textAlign: 'center', color: 'var(--ink-3)' }}><Briefcase size={30} style={{ opacity: 0.4 }} /><div style={{ marginTop: 10, fontSize: 14 }}>No client accounts yet. Add your first brand.</div></div>}

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(320px,1fr))', gap: 14 }}>
        {(data ?? []).map((a) => {
          const st = ACCOUNT_STATUS_META[a.status];
          const mrr = (a.retainers ?? []).reduce((s, r) => s + r.monthlyFeeInr, 0);
          const hc = a.healthScore >= 75 ? 'var(--success)' : a.healthScore >= 50 ? 'var(--gold,#E6A23C)' : 'var(--danger,#c0392b)';
          return (
            <div key={a.id} style={{ ...card, padding: 18 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                <div><div style={{ fontWeight: 700, fontSize: 15 }}>{a.name}</div><div style={{ fontSize: 12, color: 'var(--ink-3)', marginTop: 2 }}>{a.industry ?? '—'}{a.primaryContact ? ` · ${a.primaryContact}` : ''}</div></div>
                <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                  <CopyLink accountId={a.id} />
                  <button className="btn-secondary" style={{ height: 30, width: 30, padding: 0 }} onClick={() => del.mutate(a.id)}><Trash2 size={13} /></button>
                </div>
              </div>
              <div style={{ display: 'flex', gap: 6, marginTop: 12, flexWrap: 'wrap' }}>
                <span className="badge" style={{ background: st.bg, color: st.fg }}>{st.label}</span>
                <span className="badge" style={{ background: 'var(--surface-2)', color: 'var(--ink-3)' }}><FolderKanban size={11} style={{ marginRight: 3 }} />{a._count?.projects ?? 0} projects</span>
                {mrr > 0 && <span className="badge" style={{ background: 'var(--surface-2)', color: 'var(--ink-3)' }}>{money(mrr)}/mo</span>}
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 12 }}>
                <HeartPulse size={14} style={{ color: hc }} />
                <div style={{ flex: 1, height: 7, background: 'var(--surface-2)', borderRadius: 20, overflow: 'hidden' }}><div style={{ width: `${a.healthScore}%`, height: '100%', background: hc, borderRadius: 20 }} /></div>
                <span style={{ fontSize: 12, fontWeight: 700, color: hc }}>{a.healthScore}</span>
              </div>
            </div>
          );
        })}
      </div>

      {compose && <AccountModal onClose={() => setCompose(false)} onDone={() => { qc.invalidateQueries({ queryKey: ['agency-accounts'] }); qc.invalidateQueries({ queryKey: ['agency-stats'] }); }} />}
    </div>
  );
}

function Stat({ label, value, accent }: { label: string; value: number | string; accent?: string }) {
  return <div style={{ ...card, padding: 16 }}><div style={{ fontSize: 22, fontWeight: 800, color: accent ?? 'var(--ink-1)' }}>{value}</div><div style={{ fontSize: 12, color: 'var(--ink-3)', marginTop: 2 }}>{label}</div></div>;
}

function AccountModal({ onClose, onDone }: { onClose: () => void; onDone: () => void }) {
  const [f, setF] = useState<any>({ name: '', industry: '', primaryContact: '', phone: '', healthScore: '80' });
  const set = (k: string, v: any) => setF((s: any) => ({ ...s, [k]: v }));
  const create = useMutation({ mutationFn: () => api.post('/agency/accounts', { name: f.name, industry: f.industry || undefined, primaryContact: f.primaryContact || undefined, phone: f.phone || undefined, healthScore: f.healthScore ? Number(f.healthScore) : undefined }), onSuccess: () => { onDone(); toast.success('Account added'); onClose(); }, onError: (e) => toast.error(apiErrorMessage(e)) });
  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 60, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }}>
      <div style={{ position: 'absolute', inset: 0, background: 'rgba(20,15,12,.42)' }} onClick={onClose} />
      <div style={{ ...card, position: 'relative', zIndex: 1, width: 500, maxWidth: '100%', padding: 22, borderRadius: 18 }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}><div style={{ fontWeight: 700, fontSize: 16 }}>New client account</div><button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--ink-3)' }}><X size={20} /></button></div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          <div><label className="label">Brand name</label><input className="input" value={f.name} onChange={(e) => set('name', e.target.value)} /></div>
          <div style={{ display: 'flex', gap: 10 }}>
            <div style={{ flex: 1 }}><label className="label">Industry</label><input className="input" value={f.industry} onChange={(e) => set('industry', e.target.value)} /></div>
            <div style={{ flex: 1 }}><label className="label">Primary contact</label><input className="input" value={f.primaryContact} onChange={(e) => set('primaryContact', e.target.value)} /></div>
          </div>
          <div style={{ width: 140 }}><label className="label">Health score</label><input className="input" type="number" max="100" value={f.healthScore} onChange={(e) => set('healthScore', e.target.value)} /></div>
        </div>
        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10, marginTop: 18 }}><button className="btn-secondary" onClick={onClose}>Cancel</button><button className="btn-primary" disabled={!f.name || create.isPending} onClick={() => create.mutate()}>Add</button></div>
      </div>
    </div>
  );
}
