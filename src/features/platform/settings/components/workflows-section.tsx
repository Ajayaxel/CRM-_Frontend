'use client';

import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { Plus, Trash2, Lock, Zap } from 'lucide-react';
import { api, apiErrorMessage } from '@/lib/api';
import { useAuth } from '@/features/foundation/auth';

const card: React.CSSProperties = {
  background: 'var(--surface)', border: '1px solid var(--line-soft)', borderRadius: 18, boxShadow: 'var(--shadow-1)',
};

interface WorkflowRule {
  id: string; name: string; enabled: boolean; trigger: string;
  conditions: { field?: string; value?: string }; actions: { type: string; config?: any }[]; runCount: number;
}
interface Staff { id: string; firstName: string; lastName?: string | null }

const SOURCES = ['WEBSITE', 'WALK_IN', 'REFERRAL', 'SOCIAL_MEDIA', 'PHONE', 'EMAIL', 'ADVERTISEMENT', 'EVENT', 'OTHER'];

export function WorkflowsSection() {
  const qc = useQueryClient();
  const { user } = useAuth();
  const isGrowthPlus = user?.organization.plan !== 'STARTER';
  const [form, setForm] = useState({
    name: '', trigger: 'LEAD_CREATED', condField: '', condValue: '',
    actionType: 'CREATE_TASK', taskTitle: '', dueInDays: '1', assignedToId: '',
  });

  const { data } = useQuery({
    queryKey: ['workflows'],
    queryFn: async () => (await api.get<WorkflowRule[]>('/workflows')).data,
    enabled: isGrowthPlus,
  });
  const { data: staff } = useQuery({
    queryKey: ['staff-lite'],
    queryFn: async () => (await api.get<{ data: Staff[] }>('/users?limit=100')).data.data,
    enabled: isGrowthPlus,
  });

  const create = useMutation({
    mutationFn: () => {
      const conditions = form.condField ? { field: form.condField, op: 'equals', value: form.condValue } : {};
      const config: any = {};
      if (form.actionType === 'CREATE_TASK') {
        config.title = form.taskTitle || 'Follow up';
        if (form.dueInDays) config.dueInDays = Number(form.dueInDays);
        if (form.assignedToId) config.assignedToId = form.assignedToId;
      } else if (form.actionType === 'ASSIGN_LEAD') {
        config.assignedToId = form.assignedToId;
      } else if (form.actionType === 'NOTIFY') {
        config.title = form.taskTitle || 'Workflow triggered';
        if (form.assignedToId) config.userId = form.assignedToId;
      }
      return api.post('/workflows', {
        name: form.name,
        trigger: form.trigger,
        conditions: JSON.stringify(conditions),
        actions: JSON.stringify([{ type: form.actionType, config }]),
      });
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['workflows'] }); setForm({ ...form, name: '', condValue: '', taskTitle: '' }); toast.success('Workflow created'); },
    onError: (e) => toast.error(apiErrorMessage(e)),
  });
  const toggle = useMutation({
    mutationFn: (r: WorkflowRule) => api.patch(`/workflows/${r.id}`, { enabled: !r.enabled }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['workflows'] }),
    onError: (e) => toast.error(apiErrorMessage(e)),
  });
  const remove = useMutation({
    mutationFn: (id: string) => api.delete(`/workflows/${id}`),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['workflows'] }); toast.success('Workflow removed'); },
    onError: (e) => toast.error(apiErrorMessage(e)),
  });

  if (!isGrowthPlus) {
    return (
      <div style={{ ...card, padding: 40, textAlign: 'center' }}>
        <span style={{ width: 48, height: 48, borderRadius: 99, background: 'var(--gold-bg)', color: 'var(--gold-ink)', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', marginBottom: 14 }}><Lock size={22} /></span>
        <div style={{ fontWeight: 700, fontSize: 16 }}>Workflow Automation is a Growth feature</div>
        <div style={{ fontSize: 13, color: 'var(--ink-3)', marginTop: 6, maxWidth: 360, margin: '6px auto 0' }}>Auto-assign leads, create tasks and send notifications when leads come in or change stage.</div>
      </div>
    );
  }

  const needsValue = !!form.condField;
  const showAssignee = form.actionType !== 'NOTIFY' || true;
  return (
    <div style={{ ...card, padding: '22px 24px' }}>
      <div style={{ fontWeight: 700, fontSize: 16, marginBottom: 2 }}>Workflow Automation</div>
      <div style={{ fontSize: 12.5, color: 'var(--ink-3)', marginBottom: 18 }}>Trigger actions automatically as leads move through your pipeline.</div>

      <div style={{ background: 'var(--surface-2)', borderRadius: 14, padding: 16, marginBottom: 18 }}>
        <input className="input" placeholder="Workflow name (e.g. Instagram → counsellor)" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} style={{ marginBottom: 12 }} />
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
          <div><label className="label">When</label>
            <select className="input" value={form.trigger} onChange={(e) => setForm({ ...form, trigger: e.target.value })}>
              <option value="LEAD_CREATED">A lead is created</option>
              <option value="LEAD_STAGE_CHANGED">A lead changes stage</option>
            </select>
          </div>
          <div><label className="label">If (optional)</label>
            <select className="input" value={form.condField} onChange={(e) => setForm({ ...form, condField: e.target.value, condValue: '' })}>
              <option value="">Always</option>
              <option value="source">Source is…</option>
              <option value="priority">Priority is…</option>
              <option value="stageName">Stage is…</option>
            </select>
          </div>
        </div>
        {needsValue && (
          <div style={{ marginTop: 10 }}>
            <label className="label">Value</label>
            {form.condField === 'source' ? (
              <select className="input" value={form.condValue} onChange={(e) => setForm({ ...form, condValue: e.target.value })}>
                <option value="">Select…</option>{SOURCES.map((s) => <option key={s} value={s}>{s}</option>)}
              </select>
            ) : form.condField === 'priority' ? (
              <select className="input" value={form.condValue} onChange={(e) => setForm({ ...form, condValue: e.target.value })}>
                <option value="">Select…</option><option value="LOW">LOW</option><option value="MEDIUM">MEDIUM</option><option value="HIGH">HIGH</option>
              </select>
            ) : (
              <input className="input" placeholder="e.g. Admission Pending" value={form.condValue} onChange={(e) => setForm({ ...form, condValue: e.target.value })} />
            )}
          </div>
        )}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginTop: 10 }}>
          <div><label className="label">Then</label>
            <select className="input" value={form.actionType} onChange={(e) => setForm({ ...form, actionType: e.target.value })}>
              <option value="CREATE_TASK">Create a task</option>
              <option value="ASSIGN_LEAD">Assign the lead</option>
              <option value="NOTIFY">Send a notification</option>
            </select>
          </div>
          {showAssignee && (
            <div><label className="label">{form.actionType === 'ASSIGN_LEAD' ? 'Assign to' : 'For'}</label>
              <select className="input" value={form.assignedToId} onChange={(e) => setForm({ ...form, assignedToId: e.target.value })}>
                <option value="">{form.actionType === 'ASSIGN_LEAD' ? 'Select…' : 'Lead owner'}</option>
                {staff?.map((u) => <option key={u.id} value={u.id}>{u.firstName} {u.lastName ?? ''}</option>)}
              </select>
            </div>
          )}
        </div>
        {(form.actionType === 'CREATE_TASK' || form.actionType === 'NOTIFY') && (
          <input className="input" placeholder={form.actionType === 'CREATE_TASK' ? 'Task title' : 'Notification title'} value={form.taskTitle} onChange={(e) => setForm({ ...form, taskTitle: e.target.value })} style={{ marginTop: 10 }} />
        )}
        <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 12 }}>
          <button className="btn-primary" style={{ height: 38 }} disabled={!form.name.trim() || create.isPending} onClick={() => create.mutate()}><Plus size={15} /> Create workflow</button>
        </div>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        {data?.map((r) => (
          <div key={r.id} style={{ display: 'flex', alignItems: 'center', gap: 12, border: '1px solid var(--line-soft)', borderRadius: 12, padding: '12px 15px' }}>
            <span style={{ width: 32, height: 32, borderRadius: 9, background: 'var(--gold-bg)', color: 'var(--gold-ink)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}><Zap size={16} /></span>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontWeight: 600, fontSize: 13.5 }}>{r.name}</div>
              <div style={{ fontSize: 12, color: 'var(--ink-3)' }}>
                {r.trigger === 'LEAD_CREATED' ? 'On lead created' : 'On stage change'}
                {r.conditions?.field ? ` · if ${r.conditions.field} = ${r.conditions.value}` : ''}
                {' · '}{r.actions?.[0]?.type?.replace('_', ' ').toLowerCase()} · ran {r.runCount}×
              </div>
            </div>
            <button onClick={() => toggle.mutate(r)} title={r.enabled ? 'Enabled' : 'Disabled'}
              style={{ width: 40, height: 22, borderRadius: 99, border: 'none', cursor: 'pointer', position: 'relative', background: r.enabled ? 'var(--success)' : 'var(--surface-2)', flexShrink: 0 }}>
              <span style={{ position: 'absolute', top: 2, left: r.enabled ? 20 : 2, width: 18, height: 18, borderRadius: 99, background: '#fff', transition: 'left .15s' }} />
            </button>
            <button className="btn-secondary" style={{ height: 32, width: 32, padding: 0, color: 'var(--danger)', flexShrink: 0 }} onClick={() => remove.mutate(r.id)}><Trash2 size={14} /></button>
          </div>
        ))}
        {data?.length === 0 && <div style={{ color: 'var(--ink-3)', fontSize: 13 }}>No workflows yet.</div>}
      </div>
    </div>
  );
}
