'use client';

import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { CreditCard, ShieldCheck, Gift, Phone, Plus, Copy, CheckCircle2, Download, Trash2, TrendingUp } from 'lucide-react';
import { omniApi, WabaAccount, OmniBilling, CreditTransaction, ComplianceStats, AffiliateAccount, OmniContact } from '../omni-client';

const card: React.CSSProperties = { background: 'var(--surface)', border: '1px solid var(--line-soft)', borderRadius: 16 };
const rupee = (n: number) => '₹' + Number(n).toLocaleString('en-IN');
const QUALITY: Record<string, { bg: string; fg: string; label: string }> = {
  GREEN: { bg: 'var(--success-bg)', fg: 'var(--success)', label: 'High quality' },
  YELLOW: { bg: 'var(--warning-bg,#fdf2e2)', fg: 'var(--warning,#c67c1e)', label: 'Medium' },
  RED: { bg: 'var(--danger-bg,#fce8e8)', fg: 'var(--danger,#c0392b)', label: 'Low' },
  UNKNOWN: { bg: 'var(--surface-2)', fg: 'var(--ink-3)', label: 'Not rated' },
};

export function AdminFeature() {
  const [tab, setTab] = useState<'billing' | 'waba' | 'compliance' | 'affiliate'>('billing');
  return (
    <div style={{ animation: 'fadeUp .4s ease' }}>
      <div style={{ marginBottom: 18 }}>
        <h1 style={{ fontSize: 26, fontWeight: 700, letterSpacing: '-.02em', margin: 0 }}>Admin</h1>
        <p style={{ fontSize: 14, color: 'var(--ink-2)', margin: '6px 0 0' }}>WhatsApp Business account, conversation credits, compliance and your affiliate program.</p>
      </div>
      <div style={{ display: 'flex', gap: 6, marginBottom: 18, flexWrap: 'wrap' }}>
        <Tab active={tab === 'billing'} onClick={() => setTab('billing')} icon={<CreditCard size={15} />}>Billing &amp; Credits</Tab>
        <Tab active={tab === 'waba'} onClick={() => setTab('waba')} icon={<Phone size={15} />}>WhatsApp Account</Tab>
        <Tab active={tab === 'compliance'} onClick={() => setTab('compliance')} icon={<ShieldCheck size={15} />}>Compliance</Tab>
        <Tab active={tab === 'affiliate'} onClick={() => setTab('affiliate')} icon={<Gift size={15} />}>Affiliate</Tab>
      </div>
      {tab === 'billing' && <Billing />}
      {tab === 'waba' && <Waba />}
      {tab === 'compliance' && <Compliance />}
      {tab === 'affiliate' && <Affiliate />}
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

// ---------------- Billing ----------------
function Billing() {
  const qc = useQueryClient();
  const { data: b } = useQuery({ queryKey: ['omni-billing'], queryFn: async () => (await omniApi.get<OmniBilling>('/admin/billing')).data });
  const { data: ledger } = useQuery({ queryKey: ['omni-ledger'], queryFn: async () => (await omniApi.get<CreditTransaction[]>('/admin/billing/ledger')).data });
  const topup = useMutation({
    mutationFn: (credits: number) => omniApi.post('/admin/billing/topup', { credits }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['omni-billing'] }); qc.invalidateQueries({ queryKey: ['omni-ledger'] }); toast.success('Credits added'); },
  });
  const usedPct = b ? Math.min(100, Math.round((b.usedCredits / Math.max(1, b.includedCredits)) * 100)) : 0;

  return (
    <div style={{ display: 'grid', gridTemplateColumns: '1.3fr 1fr', gap: 14 }}>
      <div style={{ ...card, padding: 20 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
          <span style={{ fontSize: 13, color: 'var(--ink-3)' }}>Conversation credits · {b?.planName} plan</span>
          <span className="badge" style={{ background: 'var(--success-bg)', color: 'var(--success)' }}>Active</span>
        </div>
        <div style={{ fontSize: 38, fontWeight: 800, letterSpacing: '-.02em', color: 'var(--brand,#132376)' }}>{b?.balanceCredits ?? 0}</div>
        <div style={{ fontSize: 12.5, color: 'var(--ink-3)', marginBottom: 14 }}>credits remaining</div>
        <div style={{ height: 10, background: 'var(--surface-2)', borderRadius: 20, overflow: 'hidden' }}>
          <div style={{ height: '100%', width: `${usedPct}%`, background: usedPct > 85 ? 'var(--danger,#c0392b)' : 'var(--brand,#132376)' }} />
        </div>
        <div style={{ fontSize: 12, color: 'var(--ink-3)', marginTop: 6 }}>{b?.usedCredits ?? 0} of {b?.includedCredits ?? 0} included credits used</div>
        <div style={{ display: 'flex', gap: 8, marginTop: 16 }}>
          <button className="btn-secondary" style={{ height: 36, fontSize: 12.5 }} disabled={topup.isPending} onClick={() => topup.mutate(500)}><Plus size={13} /> 500</button>
          <button className="btn-secondary" style={{ height: 36, fontSize: 12.5 }} disabled={topup.isPending} onClick={() => topup.mutate(1000)}><Plus size={13} /> 1,000</button>
          <button className="btn-primary" style={{ height: 36, fontSize: 12.5 }} disabled={topup.isPending} onClick={() => topup.mutate(5000)}><Plus size={13} /> 5,000 credits</button>
        </div>
      </div>
      <div style={{ ...card, padding: 18 }}>
        <div style={{ fontWeight: 700, fontSize: 14.5, marginBottom: 12 }}>Transaction history</div>
        {(ledger ?? []).length === 0 && <div style={{ fontSize: 13, color: 'var(--ink-3)' }}>No transactions yet.</div>}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {(ledger ?? []).map((t) => (
            <div key={t.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: 13 }}>
              <span style={{ color: 'var(--ink-2)' }}>{t.note}</span>
              <span style={{ fontWeight: 700, color: t.credits >= 0 ? 'var(--success)' : 'var(--danger,#c0392b)' }}>{t.credits >= 0 ? '+' : ''}{t.credits}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

// ---------------- WABA ----------------
function Waba() {
  const { data } = useQuery({ queryKey: ['omni-waba'], queryFn: async () => (await omniApi.get<WabaAccount[]>('/admin/waba')).data });
  return (
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(320px,1fr))', gap: 14 }}>
      {(data ?? []).length === 0 && (
        <div style={{ ...card, padding: 40, textAlign: 'center', color: 'var(--ink-3)', gridColumn: '1/-1' }}>
          <Phone size={28} style={{ opacity: 0.4 }} />
          <div style={{ marginTop: 10, fontSize: 14 }}>No WhatsApp numbers. Connect one from Channels.</div>
        </div>
      )}
      {(data ?? []).map((w) => {
        const q = QUALITY[w.qualityRating] ?? QUALITY.UNKNOWN;
        return (
          <div key={w.id} style={{ ...card, padding: 18 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
              <span style={{ fontSize: 22 }}>🟢</span>
              {w.connected
                ? <span className="badge" style={{ background: 'var(--success-bg)', color: 'var(--success)' }}><CheckCircle2 size={12} style={{ marginRight: 3 }} /> Connected</span>
                : <span className="badge" style={{ background: 'var(--surface-2)', color: 'var(--ink-3)' }}>Not connected</span>}
            </div>
            <div style={{ fontWeight: 700, fontSize: 15 }}>{w.verifiedName}</div>
            <div style={{ fontSize: 12.5, color: 'var(--ink-3)', marginTop: 2 }}>Number {w.displayNumber ?? '—'}</div>
            <div style={{ display: 'flex', gap: 8, marginTop: 12 }}>
              <span className="badge" style={{ background: q.bg, color: q.fg }}>Quality: {q.label}</span>
              {w.phoneNumberId && <span className="badge" style={{ background: 'var(--surface-2)', color: 'var(--ink-3)' }}>ID {w.phoneNumberId}</span>}
            </div>
          </div>
        );
      })}
    </div>
  );
}

// ---------------- Compliance ----------------
function Compliance() {
  const qc = useQueryClient();
  const { data: stats } = useQuery({ queryKey: ['omni-comp-stats'], queryFn: async () => (await omniApi.get<ComplianceStats>('/admin/compliance/stats')).data });
  const { data: optOuts } = useQuery({ queryKey: ['omni-optouts'], queryFn: async () => (await omniApi.get<OmniContact[]>('/admin/compliance/opt-outs')).data });

  const reopt = useMutation({
    mutationFn: (id: string) => omniApi.patch(`/admin/compliance/contacts/${id}/opt-in`, { optIn: true }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['omni-optouts'] }); qc.invalidateQueries({ queryKey: ['omni-comp-stats'] }); toast.success('Contact opted back in'); },
  });
  const erase = useMutation({
    mutationFn: (id: string) => omniApi.delete(`/admin/compliance/contacts/${id}`),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['omni-optouts'] }); qc.invalidateQueries({ queryKey: ['omni-comp-stats'] }); toast.success('Contact data erased (GDPR)'); },
  });
  const exportContact = async (id: string, name?: string | null) => {
    const { data } = await omniApi.get(`/admin/compliance/contacts/${id}/export`);
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = `gdpr-${(name ?? 'contact').replace(/\s+/g, '-')}.json`; a.click();
    toast.success('Data exported');
  };

  return (
    <div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 14, marginBottom: 16 }}>
        <StatCard label="Total contacts" value={stats?.total ?? 0} />
        <StatCard label="Opted in" value={stats?.optedIn ?? 0} accent="var(--success)" />
        <StatCard label="Opted out / DND" value={stats?.optedOut ?? 0} accent="var(--danger,#c0392b)" />
      </div>
      <div style={{ ...card, padding: 18 }}>
        <div style={{ fontWeight: 700, fontSize: 14.5, marginBottom: 4 }}>Opt-out &amp; GDPR</div>
        <div style={{ fontSize: 12.5, color: 'var(--ink-3)', marginBottom: 14 }}>Opted-out contacts are excluded from broadcasts &amp; journeys. Export or erase any contact's data on request.</div>
        {(optOuts ?? []).length === 0 && <div style={{ fontSize: 13, color: 'var(--ink-3)' }}>No opted-out contacts. 🎉</div>}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {(optOuts ?? []).map((c) => (
            <div key={c.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: 10, background: 'var(--surface-2)', borderRadius: 10 }}>
              <div><div style={{ fontWeight: 600, fontSize: 13.5 }}>{c.name ?? c.handle}</div><div style={{ fontSize: 12, color: 'var(--ink-3)' }}>{c.phone ?? c.email ?? c.handle}</div></div>
              <div style={{ display: 'flex', gap: 6 }}>
                <button className="btn-secondary" style={{ height: 30, fontSize: 12 }} onClick={() => reopt.mutate(c.id)}>Re-opt-in</button>
                <button className="btn-secondary" style={{ height: 30, width: 30, padding: 0 }} title="Export data (GDPR)" onClick={() => exportContact(c.id, c.name)}><Download size={13} /></button>
                <button className="btn-secondary" style={{ height: 30, width: 30, padding: 0 }} title="Erase data (GDPR)" onClick={() => erase.mutate(c.id)}><Trash2 size={13} /></button>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

// ---------------- Affiliate ----------------
function Affiliate() {
  const qc = useQueryClient();
  const { data: a } = useQuery({ queryKey: ['omni-affiliate'], queryFn: async () => (await omniApi.get<AffiliateAccount>('/admin/affiliate')).data });
  const sim = useMutation({
    mutationFn: (kind: 'visit' | 'signup') => omniApi.post('/admin/affiliate/simulate', { kind }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['omni-affiliate'] }); toast.success('Referral recorded'); },
  });
  const link = a ? `${typeof window !== 'undefined' ? window.location.origin : ''}/?ref=${a.code}` : '';

  return (
    <div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 14, marginBottom: 16 }}>
        <StatCard label="Referral visits" value={a?.visits ?? 0} />
        <StatCard label="Signups" value={a?.signups ?? 0} accent="var(--brand,#132376)" />
        <StatCard label="Earnings" value={rupee(a?.earningsInr ?? 0)} accent="var(--success)" />
        <StatCard label="Pending payout" value={rupee(a?.payoutPending ?? 0)} accent="var(--warning,#c67c1e)" />
      </div>
      <div style={{ ...card, padding: 20 }}>
        <div style={{ fontWeight: 700, fontSize: 14.5, marginBottom: 4 }}>Your referral link</div>
        <div style={{ fontSize: 12.5, color: 'var(--ink-3)', marginBottom: 14 }}>Share this link — earn {rupee(1500)} for every institute that subscribes.</div>
        <div style={{ display: 'flex', gap: 6, marginBottom: 16 }}>
          <code style={{ flex: 1, fontSize: 12.5, background: 'var(--surface-3)', padding: '11px 12px', borderRadius: 8 }}>{link}</code>
          <button className="btn-secondary" style={{ height: 42 }} onClick={() => { navigator.clipboard.writeText(link); toast.success('Link copied'); }}><Copy size={15} /></button>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <button className="btn-secondary" style={{ height: 36, fontSize: 12.5 }} onClick={() => sim.mutate('visit')}><TrendingUp size={13} /> Simulate visit</button>
          <button className="btn-primary" style={{ height: 36, fontSize: 12.5 }} onClick={() => sim.mutate('signup')}><Gift size={13} /> Simulate signup</button>
        </div>
      </div>
    </div>
  );
}

function StatCard({ label, value, accent }: { label: string; value: number | string; accent?: string }) {
  return (
    <div style={{ ...card, padding: 16 }}>
      <div style={{ fontSize: 24, fontWeight: 800, color: accent ?? 'var(--ink-1)' }}>{value}</div>
      <div style={{ fontSize: 12, color: 'var(--ink-3)', marginTop: 2 }}>{label}</div>
    </div>
  );
}
