'use client';

import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { Plus, Trash2, Lock } from 'lucide-react';
import { api, apiErrorMessage } from '@/lib/api';
import { useAuth } from '@/features/foundation/auth';

const card: React.CSSProperties = {
  background: 'var(--surface)', border: '1px solid var(--line-soft)', borderRadius: 18, boxShadow: 'var(--shadow-1)',
};

interface CustomField {
  id: string; entityType: string; key: string; label: string; type: string; options: string[]; required: boolean;
}
const TYPES = ['TEXT', 'NUMBER', 'DATE', 'BOOLEAN', 'SELECT', 'MULTISELECT', 'EMAIL', 'PHONE'];

export function CustomFieldsSection() {
  const qc = useQueryClient();
  const { user } = useAuth();
  const isGrowthPlus = user?.organization.plan !== 'STARTER';
  const [form, setForm] = useState({ entityType: 'LEAD', label: '', type: 'TEXT', options: '', required: false });

  const { data } = useQuery({
    queryKey: ['custom-fields'],
    queryFn: async () => (await api.get<CustomField[]>('/custom-fields')).data,
    enabled: isGrowthPlus,
  });

  const create = useMutation({
    mutationFn: () => {
      const key = form.label.trim().toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_+|_+$/g, '');
      return api.post('/custom-fields', {
        entityType: form.entityType,
        key,
        label: form.label,
        type: form.type,
        options: form.type === 'SELECT' || form.type === 'MULTISELECT'
          ? form.options.split(',').map((o) => o.trim()).filter(Boolean) : [],
        required: form.required,
      });
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['custom-fields'] }); setForm({ ...form, label: '', options: '' }); toast.success('Field added'); },
    onError: (e) => toast.error(apiErrorMessage(e)),
  });
  const remove = useMutation({
    mutationFn: (id: string) => api.delete(`/custom-fields/${id}`),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['custom-fields'] }); toast.success('Field removed'); },
    onError: (e) => toast.error(apiErrorMessage(e)),
  });

  if (!isGrowthPlus) {
    return (
      <div style={{ ...card, padding: 40, textAlign: 'center' }}>
        <span style={{ width: 48, height: 48, borderRadius: 99, background: 'var(--gold-bg)', color: 'var(--gold-ink)', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', marginBottom: 14 }}><Lock size={22} /></span>
        <div style={{ fontWeight: 700, fontSize: 16 }}>Custom Fields is a Growth feature</div>
        <div style={{ fontSize: 13, color: 'var(--ink-3)', marginTop: 6, maxWidth: 340, margin: '6px auto 0' }}>Capture extra data on leads and students — upgrade to Growth to define custom fields.</div>
      </div>
    );
  }

  const needsOptions = form.type === 'SELECT' || form.type === 'MULTISELECT';
  return (
    <div style={{ ...card, padding: '22px 24px' }}>
      <div style={{ fontWeight: 700, fontSize: 16, marginBottom: 2 }}>Custom Fields</div>
      <div style={{ fontSize: 12.5, color: 'var(--ink-3)', marginBottom: 18 }}>Extra fields captured on leads and students.</div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 10 }}>
        <div><label className="label">Applies to</label>
          <select className="input" value={form.entityType} onChange={(e) => setForm({ ...form, entityType: e.target.value })}>
            <option value="LEAD">Lead</option><option value="STUDENT">Student</option>
          </select>
        </div>
        <div><label className="label">Type</label>
          <select className="input" value={form.type} onChange={(e) => setForm({ ...form, type: e.target.value })}>
            {TYPES.map((t) => <option key={t} value={t}>{t[0] + t.slice(1).toLowerCase()}</option>)}
          </select>
        </div>
      </div>
      <div style={{ marginBottom: 10 }}><label className="label">Field label</label>
        <input className="input" placeholder="e.g. Budget Range" value={form.label} onChange={(e) => setForm({ ...form, label: e.target.value })} />
      </div>
      {needsOptions && (
        <div style={{ marginBottom: 10 }}><label className="label">Options (comma-separated)</label>
          <input className="input" placeholder="< 50k, 50k-1L, > 1L" value={form.options} onChange={(e) => setForm({ ...form, options: e.target.value })} />
        </div>
      )}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: 4 }}>
        <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, color: 'var(--ink-2)' }}>
          <input type="checkbox" checked={form.required} onChange={(e) => setForm({ ...form, required: e.target.checked })} /> Required
        </label>
        <button className="btn-primary" style={{ height: 38 }} disabled={!form.label.trim() || create.isPending} onClick={() => create.mutate()}><Plus size={15} /> Add field</button>
      </div>

      <div style={{ marginTop: 20, display: 'flex', flexDirection: 'column', gap: 8 }}>
        {data?.map((f) => (
          <div key={f.id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', border: '1px solid var(--line-soft)', borderRadius: 12, padding: '10px 14px' }}>
            <div>
              <div style={{ fontWeight: 600, fontSize: 13.5 }}>{f.label} {f.required && <span style={{ color: 'var(--gold)' }}>*</span>}</div>
              <div style={{ fontSize: 12, color: 'var(--ink-3)' }}>{f.entityType[0] + f.entityType.slice(1).toLowerCase()} · {f.type.toLowerCase()}{f.options.length ? ` · ${f.options.join(', ')}` : ''}</div>
            </div>
            <button className="btn-secondary" style={{ height: 32, width: 32, padding: 0, color: 'var(--danger)' }} onClick={() => remove.mutate(f.id)}><Trash2 size={14} /></button>
          </div>
        ))}
        {data?.length === 0 && <div style={{ color: 'var(--ink-3)', fontSize: 13 }}>No custom fields yet.</div>}
      </div>
    </div>
  );
}
