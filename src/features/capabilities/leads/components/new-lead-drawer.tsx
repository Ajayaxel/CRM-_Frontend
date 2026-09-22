'use client';

import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { X } from 'lucide-react';
import { leadVocab } from '@/lib/shell-copy';
import { useAuth } from '@/features/foundation/auth';
import { api, apiErrorMessage } from '@/lib/api';
import { SOURCE_OPTIONS } from '../leads-utils';
import { Field } from '@/components/molecules/field';

interface Course { id: string; name: string }
interface Staff { id: string; firstName: string; lastName?: string | null }

export function NewLeadDrawer({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { user } = useAuth();
  const vocab = leadVocab(user?.organization?.vertical);
  const qc = useQueryClient();
  const [form, setForm] = useState({
    name: '', phone: '', email: '', courseId: '', source: 'WEBSITE', assignedToId: '', notes: '',
  });

  const { data: courses } = useQuery({
    queryKey: ['courses-lite'],
    queryFn: async () => (await api.get<{ data?: Course[] } | Course[]>('/courses').catch(() => ({ data: [] }))).data ?? [],
    enabled: open,
  });
  const { data: staff } = useQuery({
    queryKey: ['staff-lite'],
    queryFn: async () => (await api.get<{ data: Staff[] }>('/users?limit=100')).data.data,
    enabled: open,
  });

  const courseList: Course[] = Array.isArray(courses) ? courses : (courses as any)?.data ?? [];

  const create = useMutation({
    mutationFn: () => {
      const [firstName, ...rest] = form.name.trim().split(' ');
      return api.post('/leads', {
        firstName: firstName || form.name,
        lastName: rest.join(' ') || undefined,
        phone: form.phone || undefined,
        email: form.email || undefined,
        courseId: form.courseId || undefined,
        source: form.source,
        assignedToId: form.assignedToId || undefined,
        notes: form.notes || undefined,
      });
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['leads'] });
      qc.invalidateQueries({ queryKey: ['leads-board'] });
      qc.invalidateQueries({ queryKey: ['leads-stats'] });
      toast.success('Lead created');
      setForm({ name: '', phone: '', email: '', courseId: '', source: 'WEBSITE', assignedToId: '', notes: '' });
      onClose();
    },
    onError: (e) => toast.error(apiErrorMessage(e)),
  });

  if (!open) return null;
  const set = (k: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) =>
    setForm({ ...form, [k]: e.target.value });

  return (
    <>
      <div onClick={onClose} style={{ position: 'fixed', inset: 0, zIndex: 60, background: 'rgba(20,15,12,.42)', backdropFilter: 'blur(2px)' }} />
      <div
        style={{
          position: 'fixed', top: 0, right: 0, bottom: 0, zIndex: 61, width: 420, maxWidth: '100%',
          background: 'var(--surface)', borderLeft: '1px solid var(--line)', boxShadow: '-24px 0 60px rgba(0,0,0,.14)',
          animation: 'slideIn .3s cubic-bezier(.2,.8,.2,1)', display: 'flex', flexDirection: 'column',
        }}
      >
        <div style={{ padding: '22px 24px', borderBottom: '1px solid var(--line-soft)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div>
            <div style={{ fontWeight: 700, fontSize: 17 }}>New Lead</div>
            <div style={{ fontSize: 12.5, color: 'var(--ink-3)' }}>Add a prospective student</div>
          </div>
          <button onClick={onClose} style={{ width: 34, height: 34, borderRadius: 9, border: '1px solid var(--line)', background: 'var(--surface)', color: 'var(--ink-2)', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <X size={16} />
          </button>
        </div>

        <div style={{ flex: 1, overflowY: 'auto', padding: '22px 24px', display: 'flex', flexDirection: 'column', gap: 16 }}>
          <Field label="Full name">
            <input className="input" value={form.name} onChange={set('name')} placeholder="e.g. Aarav Sharma" />
          </Field>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <Field label="Phone"><input className="input" value={form.phone} onChange={set('phone')} placeholder="+91 …" /></Field>
            <Field label="Email"><input className="input" value={form.email} onChange={set('email')} placeholder="name@mail.com" /></Field>
          </div>
          {vocab.interest && (
            <Field label={vocab.interest}>
              <select className="input" value={form.courseId} onChange={set('courseId')}>
                <option value="">Select…</option>
                {courseList.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
            </Field>
          )}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <Field label="Source">
              <select className="input" value={form.source} onChange={set('source')}>
                {SOURCE_OPTIONS.map((s) => <option key={s.value} value={s.value}>{s.label}</option>)}
              </select>
            </Field>
            <Field label="Assign to">
              <select className="input" value={form.assignedToId} onChange={set('assignedToId')}>
                <option value="">Unassigned</option>
                {staff?.map((u) => <option key={u.id} value={u.id}>{u.firstName} {u.lastName ?? ''}</option>)}
              </select>
            </Field>
          </div>
          <Field label="Notes">
            <textarea className="input" value={form.notes} onChange={set('notes')} placeholder="Context about this lead…" rows={4} style={{ resize: 'vertical' }} />
          </Field>
        </div>

        <div style={{ padding: '18px 24px', borderTop: '1px solid var(--line-soft)', display: 'flex', gap: 10 }}>
          <button className="btn-secondary" style={{ flex: 1 }} onClick={onClose}>Cancel</button>
          <button className="btn-primary" style={{ flex: 1.4 }} disabled={!form.name.trim() || create.isPending} onClick={() => create.mutate()}>
            {create.isPending ? 'Creating…' : 'Create Lead'}
          </button>
        </div>
      </div>
    </>
  );
}
