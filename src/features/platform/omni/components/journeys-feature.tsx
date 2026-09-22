'use client';

import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { Workflow, Plus, Play, Pause, UserPlus, Zap, Trash2, X, Clock, ArrowDown } from 'lucide-react';
import { omniApi, CHANNEL_META, ChannelType, Journey, JourneyStatus, Segment, MessageTemplate } from '../omni-client';

const card: React.CSSProperties = { background: 'var(--surface)', border: '1px solid var(--line-soft)', borderRadius: 16 };
const JOURNEY_CHANNELS: ChannelType[] = ['WHATSAPP', 'SMS', 'EMAIL', 'INSTAGRAM', 'FACEBOOK'];

const STATUS_STYLE: Record<JourneyStatus, { bg: string; fg: string }> = {
  DRAFT: { bg: 'var(--surface-2)', fg: 'var(--ink-3)' },
  ACTIVE: { bg: 'var(--success-bg)', fg: 'var(--success)' },
  PAUSED: { bg: 'var(--warning-bg,#fdf2e2)', fg: 'var(--warning,#c67c1e)' },
  ARCHIVED: { bg: 'var(--surface-2)', fg: 'var(--ink-3)' },
};

export function JourneysFeature() {
  const qc = useQueryClient();
  const [compose, setCompose] = useState(false);
  const [open, setOpen] = useState<string | null>(null);

  const { data } = useQuery({ queryKey: ['omni-journeys'], queryFn: async () => (await omniApi.get<Journey[]>('/journeys')).data });

  const status = useMutation({
    mutationFn: ({ id, status }: { id: string; status: JourneyStatus }) => omniApi.patch(`/journeys/${id}/status`, { status }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['omni-journeys'] }),
  });
  const enroll = useMutation({
    mutationFn: (id: string) => omniApi.post(`/journeys/${id}/enroll`),
    onSuccess: (r: any) => { qc.invalidateQueries({ queryKey: ['omni-journeys'] }); toast.success(`Enrolled ${r.data.enrolled} contacts`); },
    onError: (e: any) => toast.error(e?.response?.data?.message ?? 'Enroll failed'),
  });
  const runNow = useMutation({
    mutationFn: (id: string) => omniApi.post(`/journeys/${id}/run-now`),
    onSuccess: (r: any) => { qc.invalidateQueries({ queryKey: ['omni-journeys'] }); toast.success(`Processed ${r.data.processed} due steps`); },
  });
  const del = useMutation({
    mutationFn: (id: string) => omniApi.delete(`/journeys/${id}`),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['omni-journeys'] }); toast.success('Journey deleted'); },
  });

  return (
    <div style={{ animation: 'fadeUp .4s ease' }}>
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 18 }}>
        <div>
          <h1 style={{ fontSize: 26, fontWeight: 700, letterSpacing: '-.02em', margin: 0 }}>Journeys</h1>
          <p style={{ fontSize: 14, color: 'var(--ink-2)', margin: '6px 0 0' }}>Multi-step drip sequences that follow up with contacts automatically.</p>
        </div>
        <button className="btn-primary" onClick={() => setCompose(true)}><Plus size={15} /> New journey</button>
      </div>

      {(data ?? []).length === 0 && (
        <div style={{ ...card, padding: 40, textAlign: 'center', color: 'var(--ink-3)' }}>
          <Workflow size={28} style={{ opacity: 0.4 }} />
          <div style={{ marginTop: 10, fontSize: 14 }}>No journeys yet. Build an automated follow-up sequence.</div>
        </div>
      )}

      <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        {(data ?? []).map((j) => {
          const st = STATUS_STYLE[j.status];
          const expanded = open === j.id;
          return (
            <div key={j.id} style={{ ...card, padding: 18 }}>
              <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12 }}>
                <div style={{ minWidth: 0, flex: 1, cursor: 'pointer' }} onClick={() => setOpen(expanded ? null : j.id)}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                    <span style={{ fontSize: 18 }}>{CHANNEL_META[j.channelType].icon}</span>
                    <span style={{ fontWeight: 700, fontSize: 15.5 }}>{j.name}</span>
                    <span className="badge" style={{ background: st.bg, color: st.fg }}>{j.status}</span>
                    <span className="badge" style={{ background: 'var(--surface-2)', color: 'var(--ink-3)' }}>{j._count?.steps ?? 0} steps</span>
                    <span className="badge" style={{ background: 'var(--surface-2)', color: 'var(--ink-3)' }}><UserPlus size={11} style={{ marginRight: 3 }} />{j._count?.enrollments ?? 0} enrolled</span>
                  </div>
                  {j.description && <div style={{ fontSize: 13, color: 'var(--ink-2)', marginTop: 6 }}>{j.description}</div>}
                </div>
                <div style={{ display: 'flex', gap: 8, flexShrink: 0 }}>
                  {j.status !== 'ACTIVE'
                    ? <button className="btn-secondary" style={{ height: 34, fontSize: 12.5 }} onClick={() => status.mutate({ id: j.id, status: 'ACTIVE' })}><Play size={13} /> Activate</button>
                    : <button className="btn-secondary" style={{ height: 34, fontSize: 12.5 }} onClick={() => status.mutate({ id: j.id, status: 'PAUSED' })}><Pause size={13} /> Pause</button>}
                  <button className="btn-secondary" style={{ height: 34, fontSize: 12.5 }} disabled={j.status !== 'ACTIVE' || enroll.isPending} onClick={() => enroll.mutate(j.id)}><UserPlus size={13} /> Enroll</button>
                  <button className="btn-secondary" style={{ height: 34, width: 34, padding: 0 }} title="Run due steps now" onClick={() => runNow.mutate(j.id)}><Zap size={13} /></button>
                  <button className="btn-secondary" style={{ height: 34, width: 34, padding: 0 }} onClick={() => del.mutate(j.id)}><Trash2 size={13} /></button>
                </div>
              </div>

              {expanded && <JourneyDetail id={j.id} />}
            </div>
          );
        })}
      </div>

      {compose && <ComposeModal onClose={() => setCompose(false)} />}
    </div>
  );
}

function JourneyDetail({ id }: { id: string }) {
  const { data: j } = useQuery({ queryKey: ['omni-journey', id], queryFn: async () => (await omniApi.get<Journey>(`/journeys/${id}`)).data });
  if (!j) return null;
  return (
    <div style={{ marginTop: 14, paddingTop: 14, borderTop: '1px solid var(--line-soft)' }}>
      <div style={{ display: 'flex', gap: 20, marginBottom: 14, fontSize: 12.5 }}>
        <Stat label="Active" value={j.stats?.ACTIVE ?? 0} accent="var(--warning,#c67c1e)" />
        <Stat label="Completed" value={j.stats?.COMPLETED ?? 0} accent="var(--success)" />
        <Stat label="Messages sent" value={j.messagesSent ?? 0} accent="var(--brand,#132376)" />
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 0 }}>
        {(j.steps ?? []).map((s, i) => (
          <div key={s.id}>
            {i > 0 && (
              <div style={{ display: 'flex', alignItems: 'center', gap: 6, color: 'var(--ink-3)', fontSize: 11.5, padding: '4px 0 4px 14px' }}>
                <ArrowDown size={12} /> {s.delayMinutes > 0 ? `wait ${formatDelay(s.delayMinutes)}` : 'immediately'}
              </div>
            )}
            <div style={{ display: 'flex', gap: 10, alignItems: 'flex-start', background: 'var(--surface-3)', borderRadius: 10, padding: 11 }}>
              <div style={{ width: 22, height: 22, borderRadius: '50%', background: 'var(--brand,#132376)', color: '#fff', fontSize: 11, fontWeight: 700, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>{i + 1}</div>
              <div style={{ fontSize: 13, color: 'var(--ink-2)', whiteSpace: 'pre-wrap' }}>{s.body}</div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function formatDelay(min: number) {
  if (min < 60) return `${min} min`;
  if (min < 1440) return `${Math.round(min / 60)} h`;
  return `${Math.round(min / 1440)} d`;
}

function Stat({ label, value, accent }: { label: string; value: number; accent?: string }) {
  return (
    <div>
      <div style={{ fontWeight: 700, fontSize: 16, color: accent ?? 'var(--ink-1)' }}>{value}</div>
      <div style={{ color: 'var(--ink-3)', fontSize: 11.5 }}>{label}</div>
    </div>
  );
}

interface DraftStep { delayMinutes: number; body: string; templateId: string }

function ComposeModal({ onClose }: { onClose: () => void }) {
  const qc = useQueryClient();
  const [f, setF] = useState<{ name: string; description: string; channelType: ChannelType; segmentId: string }>(
    { name: '', description: '', channelType: 'WHATSAPP', segmentId: '' },
  );
  const [steps, setSteps] = useState<DraftStep[]>([{ delayMinutes: 0, body: '', templateId: '' }]);

  const { data: segments } = useQuery({ queryKey: ['omni-segments'], queryFn: async () => (await omniApi.get<Segment[]>('/audience/segments')).data });
  const { data: templates } = useQuery({ queryKey: ['omni-templates'], queryFn: async () => (await omniApi.get<MessageTemplate[]>('/campaigns/templates')).data });

  const setStep = (i: number, patch: Partial<DraftStep>) => setSteps((s) => s.map((x, idx) => (idx === i ? { ...x, ...patch } : x)));
  const addStep = () => setSteps((s) => [...s, { delayMinutes: 60, body: '', templateId: '' }]);
  const removeStep = (i: number) => setSteps((s) => s.filter((_, idx) => idx !== i));

  const create = useMutation({
    mutationFn: () => omniApi.post('/journeys', {
      name: f.name, description: f.description || undefined, channelType: f.channelType,
      segmentId: f.segmentId || undefined,
      steps: steps.map((s) => ({ delayMinutes: s.delayMinutes, body: s.body, templateId: s.templateId || undefined })),
    }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['omni-journeys'] }); toast.success('Journey created'); onClose(); },
    onError: () => toast.error('Failed to create journey'),
  });

  const valid = f.name && steps.length > 0 && steps.every((s) => s.body.trim() || s.templateId);

  return (
    <Overlay onClose={onClose} title="New journey">
      <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        <div><label className="label">Journey name</label><input className="input" value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} placeholder="New lead nurture" /></div>
        <div><label className="label">Description (optional)</label><input className="input" value={f.description} onChange={(e) => setF({ ...f, description: e.target.value })} placeholder="3-touch welcome over the first week" /></div>
        <div style={{ display: 'flex', gap: 10 }}>
          <div style={{ flex: 1 }}>
            <label className="label">Channel</label>
            <select className="input" value={f.channelType} onChange={(e) => setF({ ...f, channelType: e.target.value as ChannelType })}>
              {JOURNEY_CHANNELS.map((c) => <option key={c} value={c}>{CHANNEL_META[c].label}</option>)}
            </select>
          </div>
          <div style={{ flex: 1 }}>
            <label className="label">Enroll segment</label>
            <select className="input" value={f.segmentId} onChange={(e) => setF({ ...f, segmentId: e.target.value })}>
              <option value="">All opted-in contacts</option>
              {(segments ?? []).map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
            </select>
          </div>
        </div>

        <div style={{ marginTop: 4 }}>
          <label className="label">Steps</label>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {steps.map((s, i) => {
              const tpl = templates?.find((t) => t.id === s.templateId);
              return (
                <div key={i} style={{ border: '1px solid var(--line-soft)', borderRadius: 12, padding: 12 }}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
                    <span style={{ fontWeight: 700, fontSize: 13 }}>Step {i + 1}</span>
                    {steps.length > 1 && <button onClick={() => removeStep(i)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--ink-3)' }}><X size={16} /></button>}
                  </div>
                  {i > 0 && (
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
                      <Clock size={13} style={{ color: 'var(--ink-3)' }} />
                      <span style={{ fontSize: 12.5, color: 'var(--ink-3)' }}>Wait</span>
                      <input className="input" type="number" min={0} style={{ width: 90, height: 32 }} value={s.delayMinutes} onChange={(e) => setStep(i, { delayMinutes: Number(e.target.value) })} />
                      <span style={{ fontSize: 12.5, color: 'var(--ink-3)' }}>minutes before sending</span>
                    </div>
                  )}
                  <select className="input" style={{ marginBottom: 8 }} value={s.templateId} onChange={(e) => setStep(i, { templateId: e.target.value })}>
                    <option value="">— Custom message —</option>
                    {(templates ?? []).map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}
                  </select>
                  {!s.templateId
                    ? <textarea className="input" rows={2} style={{ resize: 'vertical' }} value={s.body} onChange={(e) => setStep(i, { body: e.target.value })} placeholder="Hi {{name}}, welcome to BMN Institute! 👋" />
                    : <div style={{ background: 'var(--surface-3)', borderRadius: 8, padding: 10, fontSize: 12.5, color: 'var(--ink-2)', whiteSpace: 'pre-wrap' }}>{tpl?.body}</div>}
                </div>
              );
            })}
          </div>
          <button className="btn-secondary" style={{ marginTop: 10, height: 34, fontSize: 12.5 }} onClick={addStep}><Plus size={13} /> Add step</button>
        </div>

        <div style={{ fontSize: 11.5, color: 'var(--ink-3)' }}>Use <code>{'{{name}}'}</code> to personalize. Step 1 fires on enrollment; later steps wait their delay.</div>
      </div>
      <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10, marginTop: 18 }}>
        <button className="btn-secondary" onClick={onClose}>Cancel</button>
        <button className="btn-primary" disabled={!valid || create.isPending} onClick={() => create.mutate()}>Create journey</button>
      </div>
    </Overlay>
  );
}

function Overlay({ children, onClose, title }: { children: React.ReactNode; onClose: () => void; title: string }) {
  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 60, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }}>
      <div style={{ position: 'absolute', inset: 0, background: 'rgba(20,15,12,.42)' }} onClick={onClose} />
      <div style={{ ...card, position: 'relative', zIndex: 1, width: 560, maxWidth: '100%', maxHeight: '90vh', overflow: 'auto', padding: 22, borderRadius: 18 }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
          <div style={{ fontWeight: 700, fontSize: 16 }}>{title}</div>
          <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--ink-3)' }}><X size={20} /></button>
        </div>
        {children}
      </div>
    </div>
  );
}
