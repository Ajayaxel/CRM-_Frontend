'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import {
  Settings as Cog, Mail, CreditCard, KeyRound, FileText, Lock,
  Plus, Trash2, Copy, ExternalLink, ChevronRight, ListPlus, Zap,
} from 'lucide-react';
import { api, apiErrorMessage } from '@/lib/api';
import { useAuth } from '@/features/foundation/auth';
import { SubscriptionPlans } from '@/features/foundation/subscription';
import { formatDate } from '@/lib/utils';
import {
  ApiKeyRow, AuditRow, EmailTemplate, EMAIL_TEMPLATE_LABELS, SettingsSection, prettyAction,
} from '../settings-utils';
import { CustomFieldsSection } from './custom-fields-section';
import { WorkflowsSection } from './workflows-section';

const card: React.CSSProperties = {
  background: 'var(--surface)', border: '1px solid var(--line-soft)',
  borderRadius: 18, boxShadow: 'var(--shadow-1)',
};

const NAV: { key: SettingsSection; label: string; icon: any; perm?: string }[] = [
  { key: 'general', label: 'General', icon: Cog },
  { key: 'email', label: 'Email & Notifications', icon: Mail, perm: 'settings.manage' },
  { key: 'customfields', label: 'Custom Fields', icon: ListPlus, perm: 'settings.manage' },
  { key: 'workflows', label: 'Workflow Automation', icon: Zap, perm: 'settings.manage' },
  { key: 'subscription', label: 'Subscription', icon: CreditCard },
  { key: 'apikeys', label: 'API Keys', icon: KeyRound, perm: 'settings.manage' },
  { key: 'audit', label: 'Audit Logs', icon: FileText, perm: 'audit.view' },
];

export function SettingsFeature() {
  const { hasPermission } = useAuth();
  const [section, setSection] = useState<SettingsSection>('general');
  const items = NAV.filter((n) => !n.perm || hasPermission(n.perm));

  return (
    <div style={{ animation: 'fadeUp .4s ease' }}>
      <div style={{ marginBottom: 22 }}>
        <h1 style={{ fontSize: 28, fontWeight: 700, letterSpacing: '-.02em', margin: 0 }}>Settings</h1>
        <p style={{ fontSize: 14, color: 'var(--ink-2)', margin: '6px 0 0' }}>Workspace configuration.</p>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '230px 1fr', gap: 20, alignItems: 'start' }}>
        <div style={{ ...card, padding: 8, display: 'flex', flexDirection: 'column', gap: 2 }}>
          {items.map((n) => {
            const Icon = n.icon;
            const active = section === n.key;
            return (
              <button
                key={n.key}
                onClick={() => setSection(n.key)}
                style={{
                  display: 'flex', alignItems: 'center', gap: 10, padding: '10px 13px', borderRadius: 10,
                  border: 'none', cursor: 'pointer', textAlign: 'left', fontSize: 13.5, fontWeight: 600,
                  background: active ? 'var(--surface-2)' : 'transparent',
                  color: active ? 'var(--ink)' : 'var(--ink-2)',
                }}
              >
                <Icon size={16} strokeWidth={1.8} /> {n.label}
              </button>
            );
          })}
          <div style={{ height: 1, background: 'var(--line-soft)', margin: '6px 4px' }} />
          <SideLink href="/users" label="Users & Roles" />
          <SideLink href="/organization" label="Branding & Branches" />
        </div>

        <div>
          {section === 'general' && <GeneralSection />}
          {section === 'email' && <EmailSection />}
          {section === 'customfields' && <CustomFieldsSection />}
          {section === 'workflows' && <WorkflowsSection />}
          {section === 'subscription' && <SubscriptionPlans />}
          {section === 'apikeys' && <ApiKeysSection />}
          {section === 'audit' && <AuditSection />}
        </div>
      </div>
    </div>
  );
}

function SideLink({ href, label }: { href: string; label: string }) {
  return (
    <Link href={href} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '10px 13px', borderRadius: 10, fontSize: 13.5, fontWeight: 600, color: 'var(--ink-2)' }}>
      <span style={{ display: 'flex', alignItems: 'center', gap: 10 }}><ExternalLink size={16} strokeWidth={1.8} /> {label}</span>
      <ChevronRight size={15} color="var(--ink-3)" />
    </Link>
  );
}

function SectionHead({ title, desc }: { title: string; desc?: string }) {
  return (
    <div style={{ marginBottom: 18 }}>
      <div style={{ fontWeight: 700, fontSize: 16 }}>{title}</div>
      {desc && <div style={{ fontSize: 12.5, color: 'var(--ink-3)', marginTop: 2 }}>{desc}</div>}
    </div>
  );
}

function GeneralSection() {
  const { user } = useAuth();
  const org = user?.organization;
  return (
    <div style={{ ...card, padding: '22px 24px' }}>
      <SectionHead title="Organization" desc="Your institute identity across the workspace." />
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
        <Readonly label="Institute name" value={org?.name} />
        <Readonly label="Workspace slug" value={org?.slug} />
        <Readonly label="Plan" value={org?.plan} />
        <Readonly label="Subscription" value={org?.subscriptionStatus} />
      </div>
      <Link href="/organization" className="btn-secondary" style={{ marginTop: 18, height: 40 }}>
        Edit organization profile
      </Link>
    </div>
  );
}

function Readonly({ label, value }: { label: string; value?: string | null }) {
  return (
    <div style={{ background: 'var(--surface-2)', borderRadius: 12, padding: 14 }}>
      <div className="eyebrow" style={{ marginBottom: 6 }}>{label}</div>
      <div style={{ fontSize: 15, fontWeight: 600 }}>{value ?? '—'}</div>
    </div>
  );
}

function EmailSection() {
  const qc = useQueryClient();
  const { data } = useQuery({
    queryKey: ['email-templates'],
    queryFn: async () => (await api.get<EmailTemplate[]>('/settings/email-templates')).data,
  });
  const [editing, setEditing] = useState<EmailTemplate | null>(null);

  const save = useMutation({
    mutationFn: (t: EmailTemplate) =>
      api.patch(`/settings/email-templates/${t.id}`, { subject: t.subject, bodyHtml: t.bodyHtml, enabled: t.enabled }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['email-templates'] }); setEditing(null); toast.success('Template saved'); },
    onError: (e) => toast.error(apiErrorMessage(e)),
  });
  const toggle = useMutation({
    mutationFn: (t: EmailTemplate) => api.patch(`/settings/email-templates/${t.id}`, { enabled: !t.enabled }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['email-templates'] }); },
    onError: (e) => toast.error(apiErrorMessage(e)),
  });

  return (
    <div style={{ ...card, padding: '22px 24px' }}>
      <SectionHead title="Email & Notifications" desc="Templates sent to your team and applicants." />
      <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        {data?.map((t) => (
          <div key={t.id} style={{ border: '1px solid var(--line-soft)', borderRadius: 12, padding: 16 }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10 }}>
              <div style={{ minWidth: 0 }}>
                <div style={{ fontWeight: 600, fontSize: 14 }}>{EMAIL_TEMPLATE_LABELS[t.key] ?? t.key}</div>
                <div style={{ fontSize: 12.5, color: 'var(--ink-3)', marginTop: 2, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{t.subject}</div>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexShrink: 0 }}>
                <button onClick={() => toggle.mutate(t)} title={t.enabled ? 'Enabled' : 'Disabled'}
                  style={{ width: 40, height: 22, borderRadius: 99, border: 'none', cursor: 'pointer', position: 'relative', background: t.enabled ? 'var(--success)' : 'var(--surface-2)' }}>
                  <span style={{ position: 'absolute', top: 2, left: t.enabled ? 20 : 2, width: 18, height: 18, borderRadius: 99, background: '#fff', transition: 'left .15s' }} />
                </button>
                <button className="btn-secondary" style={{ height: 34, padding: '0 12px', fontSize: 12.5 }} onClick={() => setEditing(t)}>Edit</button>
              </div>
            </div>
          </div>
        ))}
      </div>

      {editing && (
        <div style={{ position: 'fixed', inset: 0, zIndex: 50, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }}>
          <div style={{ position: 'absolute', inset: 0, background: 'rgba(20,15,12,.42)' }} onClick={() => setEditing(null)} />
          <div style={{ ...card, position: 'relative', zIndex: 1, width: 560, maxWidth: '100%', padding: 24 }}>
            <SectionHead title={EMAIL_TEMPLATE_LABELS[editing.key] ?? editing.key} />
            <label className="label">Subject</label>
            <input className="input" value={editing.subject} onChange={(e) => setEditing({ ...editing, subject: e.target.value })} />
            <label className="label" style={{ marginTop: 14 }}>Body (HTML)</label>
            <textarea className="input" rows={6} style={{ resize: 'vertical', fontFamily: 'monospace', fontSize: 13 }}
              value={editing.bodyHtml} onChange={(e) => setEditing({ ...editing, bodyHtml: e.target.value })} />
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10, marginTop: 18 }}>
              <button className="btn-secondary" onClick={() => setEditing(null)}>Cancel</button>
              <button className="btn-primary" disabled={save.isPending} onClick={() => save.mutate(editing)}>Save template</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function ApiKeysSection() {
  const qc = useQueryClient();
  const { user } = useAuth();
  const isPro = user?.organization.plan === 'PROFESSIONAL';
  const [name, setName] = useState('');
  const [created, setCreated] = useState<{ key: string; name: string } | null>(null);

  const { data } = useQuery({
    queryKey: ['api-keys'],
    queryFn: async () => (await api.get<ApiKeyRow[]>('/settings/api-keys')).data,
    enabled: isPro,
  });
  const create = useMutation({
    mutationFn: () => api.post('/settings/api-keys', { name }),
    onSuccess: (r) => { qc.invalidateQueries({ queryKey: ['api-keys'] }); setCreated({ key: r.data.key, name: r.data.name }); setName(''); },
    onError: (e) => toast.error(apiErrorMessage(e)),
  });
  const revoke = useMutation({
    mutationFn: (id: string) => api.delete(`/settings/api-keys/${id}`),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['api-keys'] }); toast.success('Key revoked'); },
    onError: (e) => toast.error(apiErrorMessage(e)),
  });

  if (!isPro) {
    return (
      <div style={{ ...card, padding: 40, textAlign: 'center' }}>
        <span style={{ width: 48, height: 48, borderRadius: 99, background: 'var(--gold-bg)', color: 'var(--gold-ink)', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', marginBottom: 14 }}><Lock size={22} /></span>
        <div style={{ fontWeight: 700, fontSize: 16 }}>API Access is a Professional feature</div>
        <div style={{ fontSize: 13, color: 'var(--ink-3)', marginTop: 6, maxWidth: 340, margin: '6px auto 0' }}>Generate API keys to integrate BMN Connect with your website, payment gateway and other tools.</div>
      </div>
    );
  }

  return (
    <div style={{ ...card, padding: '22px 24px' }}>
      <SectionHead title="API Keys" desc="Keys are shown once at creation — store them securely." />
      <div style={{ display: 'flex', gap: 10, marginBottom: 18 }}>
        <input className="input" placeholder="Key name (e.g. Website integration)" value={name} onChange={(e) => setName(e.target.value)} />
        <button className="btn-primary" style={{ flexShrink: 0 }} disabled={!name.trim() || create.isPending} onClick={() => create.mutate()}><Plus size={16} /> Create</button>
      </div>

      {created && (
        <div style={{ background: 'var(--success-bg)', border: '1px solid var(--success)', borderRadius: 12, padding: 14, marginBottom: 16 }}>
          <div style={{ fontSize: 12.5, fontWeight: 600, marginBottom: 6 }}>Copy your new key for “{created.name}” — it won’t be shown again:</div>
          <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
            <code style={{ flex: 1, fontSize: 12.5, background: 'var(--surface)', padding: '8px 10px', borderRadius: 8, overflow: 'auto' }}>{created.key}</code>
            <button className="btn-secondary" style={{ height: 36 }} onClick={() => { navigator.clipboard.writeText(created.key); toast.success('Copied'); }}><Copy size={14} /></button>
          </div>
        </div>
      )}

      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        {data?.map((k) => (
          <div key={k.id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', border: '1px solid var(--line-soft)', borderRadius: 12, padding: '12px 15px' }}>
            <div>
              <div style={{ fontWeight: 600, fontSize: 14 }}>{k.name}</div>
              <div style={{ fontSize: 12, color: 'var(--ink-3)', fontFamily: 'monospace' }}>{k.prefix}••••••••</div>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
              <span style={{ fontSize: 12, color: 'var(--ink-3)' }}>{formatDate(k.createdAt)}</span>
              <button className="btn-secondary" style={{ height: 34, width: 34, padding: 0, color: 'var(--danger)' }} title="Revoke" onClick={() => confirm(`Revoke ${k.name}?`) && revoke.mutate(k.id)}><Trash2 size={14} /></button>
            </div>
          </div>
        ))}
        {data?.length === 0 && <div style={{ color: 'var(--ink-3)', fontSize: 13 }}>No API keys yet.</div>}
      </div>
    </div>
  );
}

function AuditSection() {
  const { data } = useQuery({
    queryKey: ['audit'],
    queryFn: async () => (await api.get('/settings/audit?limit=40')).data as { data: AuditRow[]; meta: { total: number } },
  });
  return (
    <div style={{ ...card, padding: '22px 24px' }}>
      <SectionHead title="Audit Logs" desc={data ? `${data.meta.total} recorded events` : 'Loading…'} />
      <div style={{ display: 'flex', flexDirection: 'column' }}>
        {data?.data.map((a) => (
          <div key={a.id} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '11px 0', borderBottom: '1px solid var(--line-soft)' }}>
            <span style={{ width: 8, height: 8, borderRadius: 99, background: 'var(--navy)', flexShrink: 0 }} />
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: 13.5, fontWeight: 600 }}>{prettyAction(a.action)}</div>
              <div style={{ fontSize: 12, color: 'var(--ink-3)' }}>{a.actor ? `${a.actor.firstName} ${a.actor.lastName ?? ''}` : 'System'}</div>
            </div>
            <span style={{ fontSize: 12, color: 'var(--ink-3)', whiteSpace: 'nowrap' }}>{formatDate(a.createdAt)}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
