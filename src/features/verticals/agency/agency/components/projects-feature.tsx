'use client';

import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { FolderKanban, Plus, X, ChevronRight, Trash2 } from 'lucide-react';
import { api, apiErrorMessage } from '@/lib/api';
import { Project, Account, Deliverable, DeliverableStatus, DELIV_META, PROJECT_TYPES, PROJECT_STATUSES, ProjectStatus, money } from '../agency-client';

const card: React.CSSProperties = { background: 'var(--surface)', border: '1px solid var(--line-soft)', borderRadius: 16 };
const PS_META: Record<ProjectStatus, { bg: string; fg: string }> = {
  PLANNING: { bg: 'var(--surface-2)', fg: 'var(--ink-3)' }, ACTIVE: { bg: 'var(--brand-bg,#e9ecfb)', fg: 'var(--brand,#132376)' },
  REVIEW: { bg: 'var(--warning-bg,#fdf2e2)', fg: 'var(--warning,#c67c1e)' }, DELIVERED: { bg: 'var(--success-bg)', fg: 'var(--success)' },
};
const NEXT_DELIV: Partial<Record<DeliverableStatus, DeliverableStatus>> = { TODO: 'IN_PROGRESS', IN_PROGRESS: 'REVIEW', REVIEW: 'PUBLISHED' };

export function ProjectsFeature() {
  const qc = useQueryClient();
  const [compose, setCompose] = useState(false);
  const [open, setOpen] = useState<string | null>(null);
  const { data } = useQuery({ queryKey: ['agency-projects'], queryFn: async () => (await api.get<Project[]>('/agency/projects')).data });
  const setStatus = useMutation({ mutationFn: ({ id, status }: { id: string; status: ProjectStatus }) => api.patch(`/agency/projects/${id}/status`, { status }), onSuccess: () => { qc.invalidateQueries({ queryKey: ['agency-projects'] }); toast.success('Status updated'); } });

  return (
    <div style={{ animation: 'fadeUp .4s ease' }}>
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 18 }}>
        <div>
          <h1 style={{ fontSize: 26, fontWeight: 700, letterSpacing: '-.02em', margin: 0 }}>Projects</h1>
          <p style={{ fontSize: 14, color: 'var(--ink-2)', margin: '6px 0 0' }}>Campaign projects with a deliverables board per project.</p>
        </div>
        <button className="btn-primary" onClick={() => setCompose(true)}><Plus size={15} /> New project</button>
      </div>
      {(data ?? []).length === 0 && <div style={{ ...card, padding: 44, textAlign: 'center', color: 'var(--ink-3)' }}><FolderKanban size={30} style={{ opacity: 0.4 }} /><div style={{ marginTop: 10, fontSize: 14 }}>No projects. Create one for a client account.</div></div>}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        {(data ?? []).map((p) => {
          const st = PS_META[p.status]; const expanded = open === p.id;
          return (
            <div key={p.id} style={{ ...card, padding: 18 }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}>
                <div style={{ cursor: 'pointer', flex: 1 }} onClick={() => setOpen(expanded ? null : p.id)}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                    <span style={{ fontWeight: 700, fontSize: 15 }}>{p.name}</span>
                    <span className="badge" style={{ background: st.bg, color: st.fg }}>{p.status}</span>
                    <span className="badge" style={{ background: 'var(--surface-2)', color: 'var(--ink-3)' }}>{p.type}</span>
                    <span style={{ fontSize: 12.5, color: 'var(--ink-3)' }}>{p.account?.name}{p.budgetInr ? ` · ${money(p.budgetInr)}` : ''} · {p._count?.deliverables ?? 0} deliverables</span>
                  </div>
                </div>
                <select className="input" style={{ width: 130, height: 34 }} value={p.status} onChange={(e) => setStatus.mutate({ id: p.id, status: e.target.value as ProjectStatus })}>{PROJECT_STATUSES.map((s) => <option key={s} value={s}>{s[0] + s.slice(1).toLowerCase()}</option>)}</select>
              </div>
              {expanded && <DeliverableBoard projectId={p.id} />}
            </div>
          );
        })}
      </div>
      {compose && <ProjectModal onClose={() => setCompose(false)} onDone={() => qc.invalidateQueries({ queryKey: ['agency-projects'] })} />}
    </div>
  );
}

function DeliverableBoard({ projectId }: { projectId: string }) {
  const qc = useQueryClient();
  const [adding, setAdding] = useState(false);
  const { data } = useQuery({ queryKey: ['agency-board', projectId], queryFn: async () => (await api.get<{ columns: { status: DeliverableStatus; items: Deliverable[] }[] }>(`/agency/projects/${projectId}/board`)).data });
  const refresh = () => { qc.invalidateQueries({ queryKey: ['agency-board', projectId] }); qc.invalidateQueries({ queryKey: ['agency-projects'] }); };
  const move = useMutation({ mutationFn: ({ id, status }: { id: string; status: DeliverableStatus }) => api.patch(`/agency/deliverables/${id}/status`, { status }), onSuccess: refresh });
  const del = useMutation({ mutationFn: (id: string) => api.delete(`/agency/deliverables/${id}`), onSuccess: refresh });

  return (
    <div style={{ marginTop: 14, paddingTop: 14, borderTop: '1px solid var(--line-soft)' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
        <div style={{ fontWeight: 700, fontSize: 13 }}>Deliverables</div>
        <button className="btn-secondary" style={{ height: 30, fontSize: 12 }} onClick={() => setAdding(true)}><Plus size={12} /> Add</button>
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 8 }}>
        {(data?.columns ?? []).map((col) => (
          <div key={col.status}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 6 }}><span style={{ width: 7, height: 7, borderRadius: '50%', background: DELIV_META[col.status].color }} /><span style={{ fontSize: 11.5, fontWeight: 700, color: 'var(--ink-3)' }}>{DELIV_META[col.status].label}</span></div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              {col.items.map((d) => (
                <div key={d.id} style={{ background: 'var(--surface-2)', borderRadius: 9, padding: 8 }}>
                  <div style={{ fontSize: 12, fontWeight: 600 }}>{d.title}</div>
                  <div style={{ fontSize: 11, color: 'var(--ink-3)', marginTop: 2 }}>{d.channel ?? ''}{d.assignee ? ` · ${d.assignee}` : ''}</div>
                  <div style={{ display: 'flex', gap: 4, marginTop: 6 }}>
                    {NEXT_DELIV[col.status] && <button className="btn-secondary" style={{ height: 24, fontSize: 10.5, flex: 1 }} onClick={() => move.mutate({ id: d.id, status: NEXT_DELIV[col.status]! })}>{DELIV_META[NEXT_DELIV[col.status]!].label} <ChevronRight size={10} /></button>}
                    <button className="btn-secondary" style={{ height: 24, width: 24, padding: 0 }} onClick={() => del.mutate(d.id)}><Trash2 size={11} /></button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
      {adding && <DeliverableModal projectId={projectId} onClose={() => setAdding(false)} onDone={refresh} />}
    </div>
  );
}

function DeliverableModal({ projectId, onClose, onDone }: { projectId: string; onClose: () => void; onDone: () => void }) {
  const [f, setF] = useState<any>({ title: '', channel: '', assignee: '' });
  const set = (k: string, v: any) => setF((s: any) => ({ ...s, [k]: v }));
  const create = useMutation({ mutationFn: () => api.post('/agency/deliverables', { projectId, title: f.title, channel: f.channel || undefined, assignee: f.assignee || undefined }), onSuccess: () => { onDone(); toast.success('Added'); onClose(); } });
  return <Overlay title="New deliverable" onClose={onClose}>
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      <div><label className="label">Title</label><input className="input" value={f.title} onChange={(e) => set('title', e.target.value)} placeholder="IG reel x3" /></div>
      <div style={{ display: 'flex', gap: 10 }}>
        <div style={{ flex: 1 }}><label className="label">Channel</label><input className="input" value={f.channel} onChange={(e) => set('channel', e.target.value)} placeholder="Instagram" /></div>
        <div style={{ flex: 1 }}><label className="label">Assignee</label><input className="input" value={f.assignee} onChange={(e) => set('assignee', e.target.value)} /></div>
      </div>
    </div>
    <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10, marginTop: 18 }}><button className="btn-secondary" onClick={onClose}>Cancel</button><button className="btn-primary" disabled={!f.title || create.isPending} onClick={() => create.mutate()}>Add</button></div>
  </Overlay>;
}

function ProjectModal({ onClose, onDone }: { onClose: () => void; onDone: () => void }) {
  const { data: accounts } = useQuery({ queryKey: ['agency-accounts'], queryFn: async () => (await api.get<Account[]>('/agency/accounts')).data });
  const [f, setF] = useState<any>({ accountId: '', name: '', type: 'SOCIAL', budgetInr: '' });
  const set = (k: string, v: any) => setF((s: any) => ({ ...s, [k]: v }));
  const create = useMutation({ mutationFn: () => api.post('/agency/projects', { accountId: f.accountId, name: f.name, type: f.type, budgetInr: f.budgetInr ? Number(f.budgetInr) : undefined }), onSuccess: () => { onDone(); toast.success('Project created'); onClose(); }, onError: (e) => toast.error(apiErrorMessage(e)) });
  return <Overlay title="New project" onClose={onClose}>
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      <div><label className="label">Client account</label><select className="input" value={f.accountId} onChange={(e) => set('accountId', e.target.value)}><option value="">Select…</option>{(accounts ?? []).map((a) => <option key={a.id} value={a.id}>{a.name}</option>)}</select></div>
      <div><label className="label">Project name</label><input className="input" value={f.name} onChange={(e) => set('name', e.target.value)} placeholder="Diwali Campaign" /></div>
      <div style={{ display: 'flex', gap: 10 }}>
        <div style={{ flex: 1 }}><label className="label">Type</label><select className="input" value={f.type} onChange={(e) => set('type', e.target.value)}>{PROJECT_TYPES.map((t) => <option key={t} value={t}>{t}</option>)}</select></div>
        <div style={{ flex: 1 }}><label className="label">Budget ₹</label><input className="input" type="number" value={f.budgetInr} onChange={(e) => set('budgetInr', e.target.value)} /></div>
      </div>
    </div>
    <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10, marginTop: 18 }}><button className="btn-secondary" onClick={onClose}>Cancel</button><button className="btn-primary" disabled={!f.accountId || !f.name || create.isPending} onClick={() => create.mutate()}>Create</button></div>
  </Overlay>;
}

function Overlay({ children, onClose, title }: { children: React.ReactNode; onClose: () => void; title: string }) {
  return <div style={{ position: 'fixed', inset: 0, zIndex: 60, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }}>
    <div style={{ position: 'absolute', inset: 0, background: 'rgba(20,15,12,.42)' }} onClick={onClose} />
    <div style={{ ...card, position: 'relative', zIndex: 1, width: 500, maxWidth: '100%', padding: 22, borderRadius: 18 }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}><div style={{ fontWeight: 700, fontSize: 16 }}>{title}</div><button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--ink-3)' }}><X size={20} /></button></div>
      {children}
    </div>
  </div>;
}
