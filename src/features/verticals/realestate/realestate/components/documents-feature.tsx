'use client';

import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { FolderOpen, Plus, X, Trash2, FileText, ExternalLink, GitBranch } from 'lucide-react';
import { api, apiErrorMessage } from '@/lib/api';
import { Property } from '../realestate-client';

const card: React.CSSProperties = { background: 'var(--surface)', border: '1px solid var(--line-soft)', borderRadius: 16 };
const DOC_TYPES = ['TITLE_DEED', 'LEASE_AGREEMENT', 'KYC', 'PASSPORT', 'EMIRATES_ID', 'NOC', 'CONTRACT', 'INVOICE', 'RECEIPT', 'OTHER'];
const DOC_META: Record<string, { label: string; icon: string }> = {
  TITLE_DEED: { label: 'Title deed', icon: '📜' }, LEASE_AGREEMENT: { label: 'Lease agreement', icon: '📝' }, KYC: { label: 'KYC', icon: '🪪' },
  PASSPORT: { label: 'Passport', icon: '🛂' }, EMIRATES_ID: { label: 'Emirates ID', icon: '🆔' }, NOC: { label: 'NOC', icon: '✅' },
  CONTRACT: { label: 'Contract', icon: '🤝' }, INVOICE: { label: 'Invoice', icon: '🧾' }, RECEIPT: { label: 'Receipt', icon: '💳' }, OTHER: { label: 'Other', icon: '📄' },
};
interface Doc { id: string; name: string; docType: string; url?: string | null; version: number; propertyRef?: string | null; updatedAt: string }

export function DocumentsFeature() {
  const qc = useQueryClient();
  const [compose, setCompose] = useState(false);
  const [filter, setFilter] = useState('');
  const { data } = useQuery({ queryKey: ['re-docs', filter], queryFn: async () => (await api.get<Doc[]>('/realestate/documents', { params: { docType: filter || undefined } })).data });
  const { data: stats } = useQuery({ queryKey: ['re-doc-stats'], queryFn: async () => (await api.get<{ total: number; byType: { docType: string; count: number }[] }>('/realestate/documents/stats')).data });
  const invalidate = () => { qc.invalidateQueries({ queryKey: ['re-docs'] }); qc.invalidateQueries({ queryKey: ['re-doc-stats'] }); };
  const del = useMutation({ mutationFn: (id: string) => api.delete(`/realestate/documents/${id}`), onSuccess: () => { invalidate(); toast.success('Document removed'); } });
  const bump = useMutation({ mutationFn: (id: string) => api.patch(`/realestate/documents/${id}/version`, {}), onSuccess: () => { invalidate(); toast.success('New version saved'); } });

  return (
    <div style={{ animation: 'fadeUp .4s ease' }}>
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 18 }}>
        <div>
          <h1 style={{ fontSize: 26, fontWeight: 700, letterSpacing: '-.02em', margin: 0 }}>Documents</h1>
          <p style={{ fontSize: 14, color: 'var(--ink-2)', margin: '6px 0 0' }}>Title deeds, leases, KYC & contracts — versioned and linked to properties.</p>
        </div>
        <button className="btn-primary" onClick={() => setCompose(true)}><Plus size={15} /> Add document</button>
      </div>

      <div style={{ display: 'flex', gap: 8, marginBottom: 16, flexWrap: 'wrap' }}>
        <button className="btn-secondary" style={{ height: 32, fontSize: 12.5, borderColor: filter === '' ? 'var(--brand,#132376)' : undefined }} onClick={() => setFilter('')}>All ({stats?.total ?? 0})</button>
        {(stats?.byType ?? []).map((t) => (
          <button key={t.docType} className="btn-secondary" style={{ height: 32, fontSize: 12.5, borderColor: filter === t.docType ? 'var(--brand,#132376)' : undefined }} onClick={() => setFilter(t.docType)}>{DOC_META[t.docType]?.icon} {DOC_META[t.docType]?.label} ({t.count})</button>
        ))}
      </div>

      {(data ?? []).length === 0 && (
        <div style={{ ...card, padding: 44, textAlign: 'center', color: 'var(--ink-3)' }}>
          <FolderOpen size={30} style={{ opacity: 0.4 }} />
          <div style={{ marginTop: 10, fontSize: 14 }}>No documents. Add title deeds, leases, KYC and contracts here.</div>
        </div>
      )}

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(300px,1fr))', gap: 12 }}>
        {(data ?? []).map((d) => (
          <div key={d.id} style={{ ...card, padding: 16 }}>
            <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 8 }}>
              <div style={{ display: 'flex', gap: 10, minWidth: 0 }}>
                <span style={{ fontSize: 24 }}>{DOC_META[d.docType]?.icon ?? '📄'}</span>
                <div style={{ minWidth: 0 }}>
                  <div style={{ fontWeight: 700, fontSize: 13.5, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{d.name}</div>
                  <div style={{ fontSize: 11.5, color: 'var(--ink-3)', marginTop: 2 }}>{DOC_META[d.docType]?.label}{d.propertyRef ? ` · ${d.propertyRef}` : ''}</div>
                </div>
              </div>
              <span className="badge" style={{ background: 'var(--surface-2)', color: 'var(--ink-3)', flexShrink: 0 }}>v{d.version}</span>
            </div>
            <div style={{ display: 'flex', gap: 6, marginTop: 12 }}>
              {d.url && <a className="btn-secondary" style={{ flex: 1, height: 32, fontSize: 12 }} href={d.url} target="_blank" rel="noreferrer"><ExternalLink size={13} /> Open</a>}
              <button className="btn-secondary" style={{ height: 32, fontSize: 12 }} onClick={() => bump.mutate(d.id)}><GitBranch size={13} /> New version</button>
              <button className="btn-secondary" style={{ height: 32, width: 32, padding: 0 }} onClick={() => del.mutate(d.id)}><Trash2 size={13} /></button>
            </div>
          </div>
        ))}
      </div>

      {compose && <DocModal onClose={() => setCompose(false)} onDone={invalidate} />}
    </div>
  );
}

function DocModal({ onClose, onDone }: { onClose: () => void; onDone: () => void }) {
  const { data: props } = useQuery({ queryKey: ['props-all'], queryFn: async () => (await api.get<{ data: Property[] }>('/properties', { params: { limit: 100 } })).data.data });
  const [f, setF] = useState<any>({ name: '', docType: 'TITLE_DEED', url: '', propertyId: '' });
  const set = (k: string, v: any) => setF((s: any) => ({ ...s, [k]: v }));
  const create = useMutation({ mutationFn: () => api.post('/realestate/documents', { ...f, propertyId: f.propertyId || undefined }), onSuccess: () => { onDone(); toast.success('Document added'); onClose(); }, onError: (e) => toast.error(apiErrorMessage(e)) });
  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 60, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }}>
      <div style={{ position: 'absolute', inset: 0, background: 'rgba(20,15,12,.42)' }} onClick={onClose} />
      <div style={{ ...card, position: 'relative', zIndex: 1, width: 520, maxWidth: '100%', padding: 22, borderRadius: 18 }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
          <div style={{ fontWeight: 700, fontSize: 16 }}>Add document</div>
          <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--ink-3)' }}><X size={20} /></button>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          <div><label className="label">Name</label><input className="input" value={f.name} onChange={(e) => set('name', e.target.value)} placeholder="Title Deed - Marina 1204" /></div>
          <div style={{ display: 'flex', gap: 10 }}>
            <div style={{ flex: 1 }}><label className="label">Type</label><select className="input" value={f.docType} onChange={(e) => set('docType', e.target.value)}>{DOC_TYPES.map((t) => <option key={t} value={t}>{DOC_META[t]?.icon} {DOC_META[t]?.label}</option>)}</select></div>
            <div style={{ flex: 1 }}><label className="label">Property</label><select className="input" value={f.propertyId} onChange={(e) => set('propertyId', e.target.value)}><option value="">— None —</option>{(props ?? []).map((p) => <option key={p.id} value={p.id}>{p.reference}</option>)}</select></div>
          </div>
          <div><label className="label">File URL (link to storage)</label><input className="input" value={f.url} onChange={(e) => set('url', e.target.value)} placeholder="https://…" /></div>
        </div>
        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10, marginTop: 18 }}>
          <button className="btn-secondary" onClick={onClose}>Cancel</button>
          <button className="btn-primary" disabled={!f.name || create.isPending} onClick={() => create.mutate()}>Add</button>
        </div>
      </div>
    </div>
  );
}
