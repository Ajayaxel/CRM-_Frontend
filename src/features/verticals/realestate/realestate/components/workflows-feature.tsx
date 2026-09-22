'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { Workflow, Zap, ArrowRight } from 'lucide-react';
import { api } from '@/lib/api';

const card: React.CSSProperties = { background: 'var(--surface)', border: '1px solid var(--line-soft)', borderRadius: 16 };
interface WF { key: string; name: string; trigger: string; steps: string[]; active: boolean }

export function WorkflowsFeature() {
  const qc = useQueryClient();
  const { data } = useQuery({ queryKey: ['re-workflows'], queryFn: async () => (await api.get<WF[]>('/realestate/workflows')).data });
  const toggle = useMutation({
    mutationFn: ({ key, active }: { key: string; active: boolean }) => api.patch(`/realestate/workflows/${key}`, { active }),
    onSuccess: (_r, v) => { qc.invalidateQueries({ queryKey: ['re-workflows'] }); toast.success(v.active ? 'Automation enabled' : 'Automation paused'); },
  });
  const activeCount = (data ?? []).filter((w) => w.active).length;

  return (
    <div style={{ animation: 'fadeUp .4s ease' }}>
      <div style={{ marginBottom: 18 }}>
        <h1 style={{ fontSize: 26, fontWeight: 700, letterSpacing: '-.02em', margin: 0 }}>Workflow Automation</h1>
        <p style={{ fontSize: 14, color: 'var(--ink-2)', margin: '6px 0 0' }}>Turn on no-code automations that run across your CRM, comms and finance. {activeCount} active.</p>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(360px,1fr))', gap: 14 }}>
        {(data ?? []).map((w) => (
          <div key={w.key} style={{ ...card, padding: 18, borderColor: w.active ? 'var(--brand,#132376)' : 'var(--line-soft)' }}>
            <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 10 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <div style={{ width: 34, height: 34, borderRadius: 9, background: 'var(--surface-2)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: w.active ? 'var(--brand,#132376)' : 'var(--ink-3)' }}><Workflow size={17} /></div>
                <div>
                  <div style={{ fontWeight: 700, fontSize: 14.5 }}>{w.name}</div>
                  <div style={{ fontSize: 11.5, color: 'var(--ink-3)' }}><Zap size={10} style={{ verticalAlign: -1, marginRight: 3 }} />{w.trigger}</div>
                </div>
              </div>
              <label style={{ position: 'relative', display: 'inline-block', width: 40, height: 22, cursor: 'pointer' }}>
                <input type="checkbox" checked={w.active} onChange={(e) => toggle.mutate({ key: w.key, active: e.target.checked })} style={{ opacity: 0, width: 0, height: 0 }} />
                <span style={{ position: 'absolute', inset: 0, borderRadius: 20, background: w.active ? 'var(--brand,#132376)' : 'var(--surface-3)', transition: '.15s' }} />
                <span style={{ position: 'absolute', top: 3, left: w.active ? 21 : 3, width: 16, height: 16, borderRadius: '50%', background: '#fff', transition: '.15s' }} />
              </label>
            </div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, alignItems: 'center' }}>
              {w.steps.map((s, i) => (
                <span key={i} style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
                  <span className="badge" style={{ background: 'var(--surface-2)', color: 'var(--ink-2)' }}>{s}</span>
                  {i < w.steps.length - 1 && <ArrowRight size={11} style={{ color: 'var(--ink-3)' }} />}
                </span>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
