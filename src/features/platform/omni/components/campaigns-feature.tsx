'use client';

import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { Megaphone, FileText, Plus, Send, Trash2, X, Users, CheckCircle2, Info, Clock, FileEdit, AlertTriangle } from 'lucide-react';
import {
  omniApi, CHANNEL_META, ChannelType, MessageTemplate, Broadcast, Segment, TemplateCategory, BroadcastStatus,
} from '../omni-client';

const card: React.CSSProperties = { background: 'var(--surface)', border: '1px solid var(--line-soft)', borderRadius: 16 };

/**
 * A template's real state with WhatsApp.
 *
 * This used to be a fixed green tick reading "APPROVED" for every template,
 * because the backend stamped APPROVED on create and nothing ever asked Meta.
 * DRAFT is the honest state for anything we have not submitted.
 */
const TEMPLATE_STATUS: Record<string, { label: string; bg: string; fg: string; icon: any; title: string }> = {
  DRAFT: {
    label: 'Not submitted', bg: 'var(--surface-2)', fg: 'var(--ink-3)', icon: FileEdit,
    title: 'Saved in BMN. Not yet sent to WhatsApp for approval.',
  },
  PENDING: {
    label: 'In review', bg: 'var(--gold-bg)', fg: 'var(--gold-ink)', icon: Clock,
    title: 'Submitted to WhatsApp and awaiting their decision.',
  },
  APPROVED: {
    label: 'Approved', bg: 'var(--success-bg)', fg: 'var(--success)', icon: CheckCircle2,
    title: 'Approved by WhatsApp — can open new conversations.',
  },
  REJECTED: {
    label: 'Rejected', bg: 'var(--danger-bg)', fg: 'var(--danger)', icon: AlertTriangle,
    title: 'WhatsApp rejected this template.',
  },
};

function TemplateStatusBadge({ status }: { status: string }) {
  const m = TEMPLATE_STATUS[status] ?? TEMPLATE_STATUS.DRAFT;
  const Icon = m.icon;
  return (
    <span className="badge" style={{ background: m.bg, color: m.fg, whiteSpace: 'nowrap', flex: 'none' }} title={m.title}>
      <Icon size={11} style={{ marginRight: 3 }} />{m.label}
    </span>
  );
}
const BROADCAST_CHANNELS: ChannelType[] = ['WHATSAPP', 'SMS', 'EMAIL', 'INSTAGRAM', 'FACEBOOK'];

const STATUS_STYLE: Record<BroadcastStatus, { bg: string; fg: string }> = {
  DRAFT: { bg: 'var(--surface-2)', fg: 'var(--ink-3)' },
  SCHEDULED: { bg: 'var(--warning-bg,#fdf2e2)', fg: 'var(--warning,#c67c1e)' },
  SENDING: { bg: 'var(--warning-bg,#fdf2e2)', fg: 'var(--warning,#c67c1e)' },
  SENT: { bg: 'var(--success-bg)', fg: 'var(--success)' },
  FAILED: { bg: 'var(--danger-bg,#fce8e8)', fg: 'var(--danger,#c0392b)' },
};

export function CampaignsFeature() {
  const [tab, setTab] = useState<'broadcasts' | 'templates'>('broadcasts');

  return (
    <div style={{ animation: 'fadeUp .4s ease' }}>
      <div style={{ marginBottom: 18 }}>
        <h1 style={{ fontSize: 26, fontWeight: 700, letterSpacing: '-.02em', margin: 0 }}>Campaigns</h1>
        <p style={{ fontSize: 14, color: 'var(--ink-2)', margin: '6px 0 0' }}>Broadcast to your segments and track delivery.</p>
      </div>

      <div style={{ display: 'flex', gap: 6, marginBottom: 18 }}>
        <Tab active={tab === 'broadcasts'} onClick={() => setTab('broadcasts')} icon={<Megaphone size={15} />}>Broadcasts</Tab>
        <Tab active={tab === 'templates'} onClick={() => setTab('templates')} icon={<FileText size={15} />}>Templates</Tab>
      </div>

      {tab === 'broadcasts' ? <Broadcasts /> : <Templates />}
    </div>
  );
}

function Tab({ active, onClick, icon, children }: { active: boolean; onClick: () => void; icon: React.ReactNode; children: React.ReactNode }) {
  return (
    <button onClick={onClick} style={{
      display: 'flex', alignItems: 'center', gap: 7, padding: '9px 16px', borderRadius: 10, fontSize: 13.5, fontWeight: 600,
      cursor: 'pointer', border: '1px solid ' + (active ? 'transparent' : 'var(--line-soft)'),
      background: active ? 'var(--brand,#132376)' : 'var(--surface)', color: active ? '#fff' : 'var(--ink-2)',
    }}>{icon}{children}</button>
  );
}

// ---------------- Broadcasts ----------------
function Broadcasts() {
  const qc = useQueryClient();
  const [compose, setCompose] = useState(false);

  const { data } = useQuery({ queryKey: ['omni-broadcasts'], queryFn: async () => (await omniApi.get<Broadcast[]>('/campaigns/broadcasts')).data });

  const send = useMutation({
    mutationFn: (id: string) => omniApi.post(`/campaigns/broadcasts/${id}/send`),
    onSuccess: (r: any) => { qc.invalidateQueries({ queryKey: ['omni-broadcasts'] }); toast.success(`Sent to ${r.data.sentCount} recipients`); },
    onError: (e: any) => toast.error(e?.response?.data?.message ?? 'Send failed'),
  });
  const del = useMutation({
    mutationFn: (id: string) => omniApi.delete(`/campaigns/broadcasts/${id}`),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['omni-broadcasts'] }); toast.success('Broadcast deleted'); },
  });

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 14 }}>
        <button className="btn-primary" onClick={() => setCompose(true)}><Plus size={15} /> New broadcast</button>
      </div>

      {(data ?? []).length === 0 && (
        <div style={{ ...card, padding: 40, textAlign: 'center', color: 'var(--ink-3)' }}>
          <Megaphone size={28} style={{ opacity: 0.4 }} />
          <div style={{ marginTop: 10, fontSize: 14 }}>No broadcasts yet. Create one to reach a segment.</div>
        </div>
      )}

      <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        {(data ?? []).map((b) => {
          const st = STATUS_STYLE[b.status];
          return (
            <div key={b.id} style={{ ...card, padding: 18 }}>
              <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12 }}>
                <div style={{ minWidth: 0, flex: 1 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <span style={{ fontSize: 18 }}>{CHANNEL_META[b.channelType].icon}</span>
                    <span style={{ fontWeight: 700, fontSize: 15.5 }}>{b.name}</span>
                    <span className="badge" style={{ background: st.bg, color: st.fg }}>{b.status}</span>
                    {b.template && <span className="badge" style={{ background: 'var(--surface-2)', color: 'var(--ink-3)' }}><FileText size={11} style={{ marginRight: 3 }} />{b.template.name}</span>}
                  </div>
                  <div style={{ fontSize: 13, color: 'var(--ink-2)', marginTop: 8, whiteSpace: 'pre-wrap' }}>{b.body}</div>
                  {(b.status === 'SENT' || b.status === 'SENDING') && (
                    <div style={{ display: 'flex', gap: 18, marginTop: 12, fontSize: 12.5 }}>
                      <Stat label="Recipients" value={b.recipientCount} />
                      <Stat label="Sent" value={b.sentCount} />
                      <Stat label="Delivered" value={b.deliveredCount} accent="var(--success)" />
                      <Stat label="Read" value={b.readCount} accent="var(--brand,#132376)" />
                      <Stat label="Failed" value={b.failedCount} accent="var(--danger,#c0392b)" />
                    </div>
                  )}
                </div>
                <div style={{ display: 'flex', gap: 8, flexShrink: 0 }}>
                  {(b.status === 'DRAFT' || b.status === 'SCHEDULED' || b.status === 'FAILED') && (
                    <button className="btn-primary" style={{ height: 34, fontSize: 12.5 }} disabled={send.isPending} onClick={() => send.mutate(b.id)}><Send size={13} /> Send now</button>
                  )}
                  <button className="btn-secondary" style={{ height: 34, width: 34, padding: 0 }} onClick={() => del.mutate(b.id)}><Trash2 size={13} /></button>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {compose && <ComposeModal onClose={() => setCompose(false)} />}
    </div>
  );
}

function Stat({ label, value, accent }: { label: string; value: number; accent?: string }) {
  return (
    <div>
      <div style={{ fontWeight: 700, fontSize: 15, color: accent ?? 'var(--ink-1)' }}>{value}</div>
      <div style={{ color: 'var(--ink-3)', fontSize: 11.5 }}>{label}</div>
    </div>
  );
}

function ComposeModal({ onClose }: { onClose: () => void }) {
  const qc = useQueryClient();
  const [f, setF] = useState<{ name: string; channelType: ChannelType; templateId: string; segmentId: string; body: string; scheduledAt: string }>(
    { name: '', channelType: 'WHATSAPP', templateId: '', segmentId: '', body: '', scheduledAt: '' },
  );

  const { data: templates } = useQuery({ queryKey: ['omni-templates'], queryFn: async () => (await omniApi.get<MessageTemplate[]>('/campaigns/templates')).data });
  const { data: segments } = useQuery({ queryKey: ['omni-segments'], queryFn: async () => (await omniApi.get<Segment[]>('/audience/segments')).data });

  const tpl = templates?.find((t) => t.id === f.templateId);
  const bodyPreview = tpl ? tpl.body : f.body;

  const create = useMutation({
    mutationFn: () => omniApi.post('/campaigns/broadcasts', {
      name: f.name, channelType: f.channelType, templateId: f.templateId || undefined,
      segmentId: f.segmentId || undefined, body: f.body, scheduledAt: f.scheduledAt || undefined,
    }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['omni-broadcasts'] }); toast.success('Broadcast created'); onClose(); },
    onError: (err: any) => {
      const msg = err?.response?.data?.message;
      toast.error(typeof msg === 'string' ? msg : 'Failed to create broadcast');
    },
  });

  return (
    <Overlay onClose={onClose} title="New broadcast">
      <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        <div><label className="label">Campaign name</label><input className="input" value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} placeholder="July intake reminder" /></div>
        <div style={{ display: 'flex', gap: 10 }}>
          <div style={{ flex: 1 }}>
            <label className="label">Channel</label>
            <select className="input" value={f.channelType} onChange={(e) => setF({ ...f, channelType: e.target.value as ChannelType })}>
              {BROADCAST_CHANNELS.map((c) => <option key={c} value={c}>{CHANNEL_META[c].label}</option>)}
            </select>
          </div>
          <div style={{ flex: 1 }}>
            <label className="label">Segment</label>
            <select className="input" value={f.segmentId} onChange={(e) => setF({ ...f, segmentId: e.target.value })}>
              <option value="">All opted-in contacts</option>
              {(segments ?? []).map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
            </select>
          </div>
        </div>
        <div>
          <label className="label">Template (optional)</label>
          <select className="input" value={f.templateId} onChange={(e) => setF({ ...f, templateId: e.target.value })}>
            <option value="">— Custom message —</option>
            {(templates ?? []).map((t) => (
              <option key={t.id} value={t.id}>
                {t.name} ({t.category}){t.status !== 'APPROVED' ? ' · not approved by WhatsApp' : ''}
              </option>
            ))}
          </select>
          {/* WhatsApp only lets an approved template OPEN a conversation. Warning here is
              the difference between a rejected send and a surprised customer. */}
          {f.channelType === 'WHATSAPP' && tpl && tpl.status !== 'APPROVED' && (
            <div style={{
              display: 'flex', gap: 8, alignItems: 'flex-start', marginTop: 8, padding: '10px 12px',
              background: 'var(--gold-bg)', border: '1px solid var(--gold)', borderRadius: 10,
            }}>
              <AlertTriangle size={14} style={{ color: 'var(--gold)', flex: 'none', marginTop: 1 }} />
              <div style={{ fontSize: 12, color: 'var(--ink-2)', lineHeight: 1.5 }}>
                <b>WhatsApp has not approved this template.</b> It will reach contacts who messaged you in
                the last 24 hours, but WhatsApp will reject it for anyone else.
              </div>
            </div>
          )}
        </div>
        {!f.templateId && (
          <div><label className="label">Message body</label><textarea className="input" rows={4} style={{ resize: 'vertical' }} value={f.body} onChange={(e) => setF({ ...f, body: e.target.value })} placeholder="Hi {{name}}, our July batch starts soon!" /></div>
        )}
        {tpl && (
          <div style={{ background: 'var(--surface-3)', borderRadius: 10, padding: 12, fontSize: 13, whiteSpace: 'pre-wrap', color: 'var(--ink-2)' }}>
            {tpl.header && <div style={{ fontWeight: 700, marginBottom: 4 }}>{tpl.header}</div>}
            {bodyPreview}
            {tpl.footer && <div style={{ fontSize: 11.5, color: 'var(--ink-3)', marginTop: 6 }}>{tpl.footer}</div>}
          </div>
        )}
        <div><label className="label">Schedule (optional)</label><input className="input" type="datetime-local" value={f.scheduledAt} onChange={(e) => setF({ ...f, scheduledAt: e.target.value })} /></div>
        <div style={{ fontSize: 11.5, color: 'var(--ink-3)' }}><Users size={11} style={{ marginRight: 4, verticalAlign: -1 }} />Use <code>{'{{name}}'}</code> to personalize with each contact's name.</div>
      </div>
      <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10, marginTop: 18 }}>
        <button className="btn-secondary" onClick={onClose}>Cancel</button>
        <button className="btn-primary" disabled={!f.name || (!f.templateId && !f.body) || create.isPending} onClick={() => create.mutate()}>Create broadcast</button>
      </div>
    </Overlay>
  );
}

// ---------------- Templates ----------------
function Templates() {
  const qc = useQueryClient();
  const [compose, setCompose] = useState(false);

  const { data } = useQuery({ queryKey: ['omni-templates'], queryFn: async () => (await omniApi.get<MessageTemplate[]>('/campaigns/templates')).data });
  const del = useMutation({
    mutationFn: (id: string) => omniApi.delete(`/campaigns/templates/${id}`),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['omni-templates'] }); toast.success('Template deleted'); },
  });

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 14 }}>
        <button className="btn-primary" onClick={() => setCompose(true)}><Plus size={15} /> New template</button>
      </div>

      {(data ?? []).length === 0 && (
        <div style={{ ...card, padding: 40, textAlign: 'center', color: 'var(--ink-3)' }}>
          <FileText size={28} style={{ opacity: 0.4 }} />
          <div style={{ marginTop: 10, fontSize: 14 }}>No templates yet. Create a reusable, approved message.</div>
        </div>
      )}

      {/* Until Meta template submission exists, every template here is local only.
          Saying so plainly is the difference between a limitation and a lie. */}
      <div style={{
        display: 'flex', alignItems: 'flex-start', gap: 10, padding: '12px 14px', marginBottom: 14,
        background: 'var(--surface-2)', border: '1px solid var(--hairline)', borderRadius: 12,
      }}>
        <Info size={15} style={{ color: 'var(--ink-3)', flex: 'none', marginTop: 1 }} />
        <div style={{ fontSize: 12.5, color: 'var(--ink-2)', lineHeight: 1.5 }}>
          <b>These templates are saved in BMN only.</b> Submitting them to WhatsApp for approval is not
          connected yet, so Meta has not reviewed them. You can use them on web chat and internal channels;
          a WhatsApp broadcast that opens a new conversation will be rejected until the template is approved
          by Meta.
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(300px,1fr))', gap: 14 }}>
        {(data ?? []).map((t) => (
          <div key={t.id} style={{ ...card, padding: 18, display: 'flex', flexDirection: 'column' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 7, minWidth: 0, flex: 1 }}>
                <span style={{ fontSize: 16, flex: 'none' }}>{CHANNEL_META[t.channelType].icon}</span>
                {/* Template names are user-chosen and can be long; truncate the name
                    rather than letting it push the status badge onto a second line. */}
                <span
                  title={t.name}
                  style={{ fontWeight: 700, fontSize: 14.5, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}
                >{t.name}</span>
              </div>
              <TemplateStatusBadge status={t.status} />
            </div>
            <div style={{ display: 'flex', gap: 6, marginBottom: 10 }}>
              <span className="badge" style={{ background: 'var(--surface-2)', color: 'var(--ink-3)' }}>{t.category}</span>
              <span className="badge" style={{ background: 'var(--surface-2)', color: 'var(--ink-3)' }}>{t.language}</span>
            </div>
            <div style={{ background: 'var(--surface-3)', borderRadius: 10, padding: 11, fontSize: 12.5, whiteSpace: 'pre-wrap', color: 'var(--ink-2)', flex: 1 }}>
              {t.header && <div style={{ fontWeight: 700, marginBottom: 4 }}>{t.header}</div>}
              {t.body}
              {t.footer && <div style={{ fontSize: 11, color: 'var(--ink-3)', marginTop: 6 }}>{t.footer}</div>}
            </div>
            {t.variables.length > 0 && <div style={{ fontSize: 11, color: 'var(--ink-3)', marginTop: 8 }}>Variables: {t.variables.map((v) => `{{${v}}}`).join(', ')}</div>}
            <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 10 }}>
              <button className="btn-secondary" style={{ height: 32, width: 32, padding: 0 }} onClick={() => del.mutate(t.id)}><Trash2 size={13} /></button>
            </div>
          </div>
        ))}
      </div>

      {compose && <TemplateModal onClose={() => setCompose(false)} />}
    </div>
  );
}

function TemplateModal({ onClose }: { onClose: () => void }) {
  const qc = useQueryClient();
  const [f, setF] = useState<{ name: string; category: TemplateCategory; channelType: ChannelType; language: string; header: string; body: string; footer: string }>(
    { name: '', category: 'MARKETING', channelType: 'WHATSAPP', language: 'en', header: '', body: '', footer: '' },
  );

  const create = useMutation({
    mutationFn: () => omniApi.post('/campaigns/templates', f),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['omni-templates'] }); toast.success('Template created'); onClose(); },
    onError: () => toast.error('Failed to create template'),
  });

  return (
    <Overlay onClose={onClose} title="New message template">
      <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        <div style={{ display: 'flex', gap: 10 }}>
          <div style={{ flex: 1 }}><label className="label">Name</label><input className="input" value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} placeholder="welcome_offer" /></div>
          <div style={{ width: 130 }}>
            <label className="label">Category</label>
            <select className="input" value={f.category} onChange={(e) => setF({ ...f, category: e.target.value as TemplateCategory })}>
              <option value="MARKETING">Marketing</option>
              <option value="UTILITY">Utility</option>
              <option value="AUTHENTICATION">Auth</option>
            </select>
          </div>
        </div>
        <div style={{ display: 'flex', gap: 10 }}>
          <div style={{ flex: 1 }}>
            <label className="label">Channel</label>
            <select className="input" value={f.channelType} onChange={(e) => setF({ ...f, channelType: e.target.value as ChannelType })}>
              {BROADCAST_CHANNELS.map((c) => <option key={c} value={c}>{CHANNEL_META[c].label}</option>)}
            </select>
          </div>
          <div style={{ width: 100 }}><label className="label">Language</label><input className="input" value={f.language} onChange={(e) => setF({ ...f, language: e.target.value })} /></div>
        </div>
        <div><label className="label">Header (optional)</label><input className="input" value={f.header} onChange={(e) => setF({ ...f, header: e.target.value })} placeholder="🎓 BMN Institute" /></div>
        <div><label className="label">Body</label><textarea className="input" rows={4} style={{ resize: 'vertical' }} value={f.body} onChange={(e) => setF({ ...f, body: e.target.value })} placeholder="Hi {{name}}, admissions for our July batch are now open!" /></div>
        <div><label className="label">Footer (optional)</label><input className="input" value={f.footer} onChange={(e) => setF({ ...f, footer: e.target.value })} placeholder="Reply STOP to opt out" /></div>
      </div>
      <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10, marginTop: 18 }}>
        <button className="btn-secondary" onClick={onClose}>Cancel</button>
        <button className="btn-primary" disabled={!f.name || !f.body || create.isPending} onClick={() => create.mutate()}>Create template</button>
      </div>
    </Overlay>
  );
}

function Overlay({ children, onClose, title }: { children: React.ReactNode; onClose: () => void; title: string }) {
  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 60, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }}>
      <div style={{ position: 'absolute', inset: 0, background: 'rgba(20,15,12,.42)' }} onClick={onClose} />
      <div style={{ ...card, position: 'relative', zIndex: 1, width: 520, maxWidth: '100%', maxHeight: '90vh', overflow: 'auto', padding: 22, borderRadius: 18 }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
          <div style={{ fontWeight: 700, fontSize: 16 }}>{title}</div>
          <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--ink-3)' }}><X size={20} /></button>
        </div>
        {children}
      </div>
    </div>
  );
}
