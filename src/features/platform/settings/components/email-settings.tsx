'use client';

/**
 * Email settings for a tenant.
 *
 * Mail to a broker's customers should come from the broker. This is where they
 * put their own SMTP so invitations, renewal notices and statements arrive from
 * their domain rather than the platform's.
 *
 * The password is typed here and goes straight to the server encrypted. It is
 * never read back — the API returns only the last four characters — so this
 * form can show that a credential is saved without ever being able to reveal it.
 */

import { useEffect, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { Mail, Send, ShieldAlert, CheckCircle2, AlertTriangle } from 'lucide-react';
import { api, apiErrorMessage } from '@/lib/api';

type Account = {
  host: string; port: number; secure: boolean; username: string;
  passwordLast4: string | null; passwordSet: boolean;
  fromName: string; fromEmail: string; replyTo: string | null;
  status: 'UNVERIFIED' | 'VERIFIED' | 'FAILING';
  lastError: string | null; verifiedAt: string | null;
};

/** Known providers, so nobody has to hunt for a host name. */
const PRESETS: Record<string, { host: string; port: number; hint: string }> = {
  Hostinger: { host: 'smtp.hostinger.com', port: 465, hint: 'Use the full mailbox address as the username.' },
  'Zoho (India)': { host: 'smtp.zoho.in', port: 465, hint: 'Needs an app-specific password, not your login password.' },
  'Zoho (global)': { host: 'smtp.zoho.com', port: 465, hint: 'Needs an app-specific password.' },
  'Google Workspace': { host: 'smtp.gmail.com', port: 465, hint: 'Requires 2FA and an App Password.' },
  'Microsoft 365': { host: 'smtp.office365.com', port: 587, hint: 'Port 587 with STARTTLS.' },
};

export function EmailSettings() {
  const qc = useQueryClient();
  const [f, setF] = useState({
    host: '', port: 465, username: '', password: '',
    fromName: '', fromEmail: '', replyTo: '',
  });
  const [testTo, setTestTo] = useState('');

  const { data: status } = useQuery<any>({
    queryKey: ['email-status'],
    queryFn: async () => (await api.get('/email-account/status')).data,
  });
  const { data: acc } = useQuery<Account | null>({
    queryKey: ['email-account'],
    queryFn: async () => (await api.get('/email-account')).data,
  });

  useEffect(() => {
    if (!acc) return;
    setF((c) => ({
      ...c,
      host: acc.host, port: acc.port, username: acc.username,
      fromName: acc.fromName, fromEmail: acc.fromEmail, replyTo: acc.replyTo ?? '',
      password: '', // never prefilled; the server cannot supply it and should not
    }));
    setTestTo((t) => t || acc.fromEmail);
  }, [acc]);

  const save = useMutation({
    mutationFn: () => api.post('/email-account', { ...f, password: f.password || undefined }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['email-account'] });
      qc.invalidateQueries({ queryKey: ['email-status'] });
      setF((c) => ({ ...c, password: '' }));
      toast.success('Saved — now send a test to prove it works');
    },
    onError: (e) => toast.error(apiErrorMessage(e)),
  });

  const test = useMutation({
    mutationFn: () => api.post('/email-account/test', { to: testTo }),
    onSuccess: (r: any) => {
      qc.invalidateQueries({ queryKey: ['email-account'] });
      qc.invalidateQueries({ queryKey: ['email-status'] });
      toast.success(`Sent to ${r.data.to} from ${r.data.from}`);
    },
    onError: (e) => toast.error(apiErrorMessage(e)),
  });

  const set = (k: keyof typeof f) => (e: React.ChangeEvent<HTMLInputElement>) =>
    setF({ ...f, [k]: k === 'port' ? Number(e.target.value) || 0 : e.target.value });

  const applyPreset = (name: string) => {
    const p = PRESETS[name];
    if (p) setF((c) => ({ ...c, host: p.host, port: p.port }));
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16, maxWidth: '44rem' }}>
      <StatusBanner status={status} acc={acc} />

      <div className="ds-card" style={{ padding: 20, display: 'flex', flexDirection: 'column', gap: 13 }}>
        <div>
          <label className="label">Provider</label>
          <select className="input" defaultValue="" onChange={(e) => applyPreset(e.target.value)}>
            <option value="">Choose a provider to fill the host…</option>
            {Object.keys(PRESETS).map((k) => <option key={k} value={k}>{k}</option>)}
          </select>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: 10 }}>
          <div>
            <label className="label">SMTP host</label>
            <input className="input" value={f.host} onChange={set('host')} placeholder="smtp.hostinger.com" />
          </div>
          <div>
            <label className="label">Port</label>
            <input className="input" type="number" value={f.port} onChange={set('port')} />
            <div className="ds-caption" style={{ marginTop: 4 }}>
              {f.port === 465 ? 'Implicit TLS' : f.port === 587 ? 'STARTTLS' : 'Unusual port'}
            </div>
          </div>
        </div>

        <div>
          <label className="label">Username</label>
          <input className="input" value={f.username} onChange={set('username')} placeholder="noreply@yourdomain.com" />
          <div className="ds-caption" style={{ marginTop: 4 }}>Usually the full mailbox address.</div>
        </div>

        <div>
          <label className="label">Password</label>
          <input
            className="input" type="password" autoComplete="new-password"
            value={f.password} onChange={set('password')}
            placeholder={acc?.passwordSet ? `Saved — ends ${acc.passwordLast4 ?? '••••'}. Leave blank to keep it.` : 'Mailbox or app password'}
          />
          <div className="ds-caption" style={{ marginTop: 4 }}>
            Encrypted before it is stored, and never shown again. Leave blank to keep the current one.
          </div>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
          <div>
            <label className="label">From name</label>
            <input className="input" value={f.fromName} onChange={set('fromName')} placeholder="Avera Solutions" />
          </div>
          <div>
            <label className="label">From address</label>
            <input className="input" value={f.fromEmail} onChange={set('fromEmail')} placeholder="accounts@yourdomain.com" />
          </div>
        </div>

        <div>
          <label className="label">Reply-to <span style={{ fontWeight: 400, color: 'var(--ink-3)' }}>(optional)</span></label>
          <input className="input" value={f.replyTo} onChange={set('replyTo')} placeholder="someone@yourdomain.com" />
          <div className="ds-caption" style={{ marginTop: 4 }}>
            Where customer replies land, if different from the From address.
          </div>
        </div>

        <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
          <button className="btn-primary" disabled={save.isPending} onClick={() => save.mutate()}>
            {save.isPending ? 'Saving…' : 'Save settings'}
          </button>
        </div>
      </div>

      {/* Proving it works is a separate, deliberate step. */}
      <div className="ds-card" style={{ padding: 20 }}>
        <div style={{ fontWeight: 600, marginBottom: 4 }}>Send a test</div>
        <p className="ds-caption" style={{ marginTop: 0, marginBottom: 12 }}>
          A real message, not just a connection check — that is the only way to know your provider
          will accept mail from this address.
        </p>
        <div style={{ display: 'flex', gap: 10 }}>
          <input className="input" value={testTo} onChange={(e) => setTestTo(e.target.value)} placeholder="you@yourdomain.com" />
          <button className="btn-secondary" disabled={!acc || !testTo || test.isPending} onClick={() => test.mutate()}>
            <Send size={15} /> {test.isPending ? 'Sending…' : 'Send test'}
          </button>
        </div>
      </div>
    </div>
  );
}

function StatusBanner({ status, acc }: { status: any; acc: Account | null | undefined }) {
  if (!status) return null;

  const tone =
    acc?.status === 'VERIFIED' ? { bg: 'var(--tone-active-bg)', fg: 'var(--tone-active)', Icon: CheckCircle2 }
    : acc?.status === 'FAILING' ? { bg: 'var(--tone-expired-bg)', fg: 'var(--tone-expired)', Icon: ShieldAlert }
    : status.configured ? { bg: 'var(--tone-renewal-bg)', fg: 'var(--tone-renewal)', Icon: AlertTriangle }
    : { bg: 'var(--tone-expired-bg)', fg: 'var(--tone-expired)', Icon: AlertTriangle };

  const line =
    acc?.status === 'FAILING' ? `Sending is failing: ${acc.lastError}`
    : acc?.status === 'VERIFIED' ? `Verified — mail is sent as ${status.from}`
    : status.note;

  return (
    <div style={{ background: tone.bg, color: tone.fg, borderRadius: 10, padding: '11px 14px', display: 'flex', gap: 10, alignItems: 'flex-start' }}>
      <tone.Icon size={17} style={{ flexShrink: 0, marginTop: 1 }} />
      <div style={{ fontSize: 13.5, lineHeight: 1.5 }}>
        <div style={{ fontWeight: 600 }}>
          {acc?.status === 'VERIFIED' ? 'Email is working'
            : acc?.status === 'FAILING' ? 'Email is not working'
            : status.configured ? 'Not yet proven' : 'Email not configured'}
        </div>
        <div>{line}</div>
      </div>
    </div>
  );
}
