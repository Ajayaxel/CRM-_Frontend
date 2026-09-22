'use client';

import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { MessageCircle, Zap, Plus, Trash2, X, Play, UserPlus, Sparkles, MousePointerClick, Copy } from 'lucide-react';
import { omniApi, CommentRule, CommentAction, SocialPlatform, SocialEvent, SocialStats, WhatsAppAd } from '../omni-client';

const card: React.CSSProperties = { background: 'var(--surface)', border: '1px solid var(--line-soft)', borderRadius: 16 };
const PLATFORM_META: Record<SocialPlatform, { label: string; icon: string }> = {
  FACEBOOK: { label: 'Facebook', icon: '💠' },
  INSTAGRAM: { label: 'Instagram', icon: '📸' },
};
const ACTION_LABEL: Record<CommentAction, string> = { REPLY: 'Public reply', DM: 'Send DM', REPLY_AND_DM: 'Reply + DM' };

export function SocialFeature() {
  const [tab, setTab] = useState<'rules' | 'activity' | 'ads'>('rules');
  const { data: stats } = useQuery({ queryKey: ['omni-social-stats'], queryFn: async () => (await omniApi.get<SocialStats>('/social/stats')).data });

  return (
    <div style={{ animation: 'fadeUp .4s ease' }}>
      <div style={{ marginBottom: 18 }}>
        <h1 style={{ fontSize: 26, fontWeight: 700, letterSpacing: '-.02em', margin: 0 }}>Social Automation</h1>
        <p style={{ fontSize: 14, color: 'var(--ink-2)', margin: '6px 0 0' }}>Auto-reply to Facebook &amp; Instagram comments and capture Lead-Ads straight into your CRM.</p>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 14, marginBottom: 18 }}>
        <StatCard icon={<MessageCircle size={18} />} label="Comments handled" value={stats?.comments ?? 0} />
        <StatCard icon={<UserPlus size={18} />} label="Lead-Ads captured" value={stats?.leads ?? 0} accent="var(--success)" />
        <StatCard icon={<Zap size={18} />} label="Active rules" value={stats?.activeRules ?? 0} accent="var(--brand,#132376)" />
      </div>

      <div style={{ display: 'flex', gap: 6, marginBottom: 18 }}>
        <Tab active={tab === 'rules'} onClick={() => setTab('rules')} icon={<Zap size={15} />}>Comment Rules</Tab>
        <Tab active={tab === 'ads'} onClick={() => setTab('ads')} icon={<MousePointerClick size={15} />}>Click-to-WhatsApp</Tab>
        <Tab active={tab === 'activity'} onClick={() => setTab('activity')} icon={<MessageCircle size={15} />}>Activity</Tab>
      </div>

      {tab === 'rules' && <Rules />}
      {tab === 'ads' && <WhatsAppAds />}
      {tab === 'activity' && <Activity />}
    </div>
  );
}

// ---------------- Click-to-WhatsApp ads ----------------
function WhatsAppAds() {
  const qc = useQueryClient();
  const [compose, setCompose] = useState(false);
  const { data } = useQuery({ queryKey: ['omni-ctwa'], queryFn: async () => (await omniApi.get<WhatsAppAd[]>('/ctwa/ads')).data });
  const del = useMutation({
    mutationFn: (id: string) => omniApi.delete(`/ctwa/ads/${id}`),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['omni-ctwa'] }); toast.success('Ad deleted'); },
  });
  const linkFor = (ref: string) => `${typeof window !== 'undefined' ? window.location.origin : ''}/omni/ctwa/c/${ref}`;

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 14 }}>
        <button className="btn-primary" onClick={() => setCompose(true)}><Plus size={15} /> New ad link</button>
      </div>
      {(data ?? []).length === 0 && (
        <div style={{ ...card, padding: 40, textAlign: 'center', color: 'var(--ink-3)' }}>
          <MousePointerClick size={28} style={{ opacity: 0.4 }} />
          <div style={{ marginTop: 10, fontSize: 14 }}>No ad links yet. Create a trackable Click-to-WhatsApp link for your ads.</div>
        </div>
      )}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(340px,1fr))', gap: 14 }}>
        {(data ?? []).map((a) => {
          const conv = a.clicks ? Math.round((a.conversations / a.clicks) * 100) : 0;
          return (
            <div key={a.id} style={{ ...card, padding: 18 }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
                <span style={{ fontWeight: 700, fontSize: 15 }}>{a.name}</span>
                <button className="btn-secondary" style={{ height: 30, width: 30, padding: 0 }} onClick={() => del.mutate(a.id)}><Trash2 size={13} /></button>
              </div>
              <div style={{ display: 'flex', gap: 6, marginBottom: 12 }}>
                <div style={{ flex: 1, textAlign: 'center', background: 'var(--surface-2)', borderRadius: 10, padding: '8px 4px' }}>
                  <div style={{ fontWeight: 700, fontSize: 17 }}>{a.clicks}</div><div style={{ fontSize: 11, color: 'var(--ink-3)' }}>Clicks</div>
                </div>
                <div style={{ flex: 1, textAlign: 'center', background: 'var(--surface-2)', borderRadius: 10, padding: '8px 4px' }}>
                  <div style={{ fontWeight: 700, fontSize: 17, color: 'var(--success)' }}>{a.conversations}</div><div style={{ fontSize: 11, color: 'var(--ink-3)' }}>Chats</div>
                </div>
                <div style={{ flex: 1, textAlign: 'center', background: 'var(--surface-2)', borderRadius: 10, padding: '8px 4px' }}>
                  <div style={{ fontWeight: 700, fontSize: 17, color: 'var(--brand,#132376)' }}>{conv}%</div><div style={{ fontSize: 11, color: 'var(--ink-3)' }}>Conv.</div>
                </div>
              </div>
              <div style={{ fontSize: 11.5, color: a.metaAdId ? 'var(--success)' : 'var(--ink-3)', marginBottom: 6 }}>
                {a.metaAdId ? <>Meta ad <code>{a.metaAdId}</code> · real referral attribution on</> : 'No Meta ad ID — deep-link tracking only'}
              </div>
              <div style={{ fontSize: 11.5, color: 'var(--ink-3)', marginBottom: 4 }}>Ad button link · ref <code>{a.refCode}</code></div>
              <div style={{ display: 'flex', gap: 6 }}>
                <code style={{ flex: 1, fontSize: 11, background: 'var(--surface-3)', padding: '8px 9px', borderRadius: 8, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{linkFor(a.refCode)}</code>
                <button className="btn-secondary" style={{ height: 34, width: 36, padding: 0 }} onClick={() => { navigator.clipboard.writeText(linkFor(a.refCode)); toast.success('Link copied'); }}><Copy size={14} /></button>
              </div>
            </div>
          );
        })}
      </div>
      {compose && <AdModal onClose={() => setCompose(false)} />}
    </div>
  );
}

function AdModal({ onClose }: { onClose: () => void }) {
  const qc = useQueryClient();
  const [f, setF] = useState({ name: '', phone: '', platform: 'FACEBOOK', prefillText: '', metaAdId: '' });
  const create = useMutation({
    mutationFn: () => omniApi.post('/ctwa/ads', f),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['omni-ctwa'] }); toast.success('Ad link created'); onClose(); },
    onError: () => toast.error('Failed to create'),
  });
  return (
    <Overlay onClose={onClose} title="New Click-to-WhatsApp ad">
      <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        <div><label className="label">Ad name</label><input className="input" value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} placeholder="July FB Promo" /></div>
        <div style={{ display: 'flex', gap: 10 }}>
          <div style={{ flex: 1 }}><label className="label">WhatsApp number</label><input className="input" value={f.phone} onChange={(e) => setF({ ...f, phone: e.target.value })} placeholder="919812300000" /></div>
          <div style={{ width: 150 }}>
            <label className="label">Platform</label>
            <select className="input" value={f.platform} onChange={(e) => setF({ ...f, platform: e.target.value })}>
              <option value="FACEBOOK">Facebook</option>
              <option value="INSTAGRAM">Instagram</option>
              <option value="GOOGLE">Google</option>
            </select>
          </div>
        </div>
        <div><label className="label">Prefilled first message (optional)</label><input className="input" value={f.prefillText} onChange={(e) => setF({ ...f, prefillText: e.target.value })} placeholder="Auto-generated with a tracking ref if left blank" /></div>
        <div>
          <label className="label">Meta ad ID (optional)</label>
          <input className="input" value={f.metaAdId} onChange={(e) => setF({ ...f, metaAdId: e.target.value })} placeholder="120210000000000123 — from Ads Manager" />
        </div>
        <div style={{ fontSize: 11.5, color: 'var(--ink-3)' }}>
          Two ways to track. <b>Meta ad ID</b> is the real one: a click-to-WhatsApp ad sends us Meta&apos;s referral, so the chat, the lead
          and the revenue are attributed even if the visitor rewrites the message. The <b>link below</b> is the fallback for posters and
          link-in-bio — it works without an ad account, but the tracking ref is lost the moment someone edits the prefilled text.
        </div>
      </div>
      <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10, marginTop: 18 }}>
        <button className="btn-secondary" onClick={onClose}>Cancel</button>
        <button className="btn-primary" disabled={!f.name || !f.phone || create.isPending} onClick={() => create.mutate()}>Create link</button>
      </div>
    </Overlay>
  );
}

function StatCard({ icon, label, value, accent }: { icon: React.ReactNode; label: string; value: number; accent?: string }) {
  return (
    <div style={{ ...card, padding: 16, display: 'flex', alignItems: 'center', gap: 12 }}>
      <div style={{ width: 40, height: 40, borderRadius: 10, background: 'var(--surface-2)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: accent ?? 'var(--ink-2)' }}>{icon}</div>
      <div>
        <div style={{ fontSize: 22, fontWeight: 700, color: accent ?? 'var(--ink-1)' }}>{value}</div>
        <div style={{ fontSize: 12, color: 'var(--ink-3)' }}>{label}</div>
      </div>
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

// ---------------- Rules ----------------
function Rules() {
  const qc = useQueryClient();
  const [compose, setCompose] = useState(false);
  const [sim, setSim] = useState(false);

  const { data } = useQuery({ queryKey: ['omni-social-rules'], queryFn: async () => (await omniApi.get<CommentRule[]>('/social/rules')).data });
  const toggle = useMutation({
    mutationFn: ({ id, active }: { id: string; active: boolean }) => omniApi.patch(`/social/rules/${id}`, { active }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['omni-social-rules'] }),
  });
  const del = useMutation({
    mutationFn: (id: string) => omniApi.delete(`/social/rules/${id}`),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['omni-social-rules'] }); toast.success('Rule deleted'); },
  });

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10, marginBottom: 14 }}>
        <button className="btn-secondary" onClick={() => setSim(true)}><Play size={14} /> Simulate</button>
        <button className="btn-primary" onClick={() => setCompose(true)}><Plus size={15} /> New rule</button>
      </div>

      {(data ?? []).length === 0 && (
        <div style={{ ...card, padding: 40, textAlign: 'center', color: 'var(--ink-3)' }}>
          <Zap size={28} style={{ opacity: 0.4 }} />
          <div style={{ marginTop: 10, fontSize: 14 }}>No rules yet. Auto-reply to comments containing keywords.</div>
        </div>
      )}

      <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        {(data ?? []).map((r) => (
          <div key={r.id} style={{ ...card, padding: 18, opacity: r.active ? 1 : 0.6 }}>
            <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12 }}>
              <div style={{ minWidth: 0, flex: 1 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                  <span style={{ fontSize: 16 }}>{PLATFORM_META[r.platform].icon}</span>
                  <span style={{ fontWeight: 700, fontSize: 15 }}>{r.name}</span>
                  <span className="badge" style={{ background: 'var(--surface-2)', color: 'var(--ink-3)' }}>{ACTION_LABEL[r.action]}</span>
                  <span className="badge" style={{ background: 'var(--surface-2)', color: 'var(--ink-3)' }}>{r.matchCount} matches</span>
                </div>
                <div style={{ display: 'flex', gap: 5, flexWrap: 'wrap', marginTop: 8 }}>
                  {r.keywords.length ? r.keywords.map((k) => <span key={k} className="badge" style={{ background: 'var(--brand,#132376)', color: '#fff' }}>{k}</span>) : <span style={{ fontSize: 12, color: 'var(--ink-3)' }}>matches all comments</span>}
                </div>
                {r.replyText && <div style={{ fontSize: 12.5, color: 'var(--ink-2)', marginTop: 8 }}><b>Reply:</b> {r.replyText}</div>}
                {r.dmText && <div style={{ fontSize: 12.5, color: 'var(--ink-2)', marginTop: 4 }}><b>DM:</b> {r.dmText}</div>}
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexShrink: 0 }}>
                <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, color: 'var(--ink-3)' }}>
                  <input type="checkbox" checked={r.active} onChange={(e) => toggle.mutate({ id: r.id, active: e.target.checked })} /> Active
                </label>
                <button className="btn-secondary" style={{ height: 34, width: 34, padding: 0 }} onClick={() => del.mutate(r.id)}><Trash2 size={13} /></button>
              </div>
            </div>
          </div>
        ))}
      </div>

      {compose && <RuleModal onClose={() => setCompose(false)} />}
      {sim && <SimulateModal onClose={() => setSim(false)} />}
    </div>
  );
}

function RuleModal({ onClose }: { onClose: () => void }) {
  const qc = useQueryClient();
  const [f, setF] = useState<{ platform: SocialPlatform; name: string; keywords: string; action: CommentAction; replyText: string; dmText: string }>(
    { platform: 'FACEBOOK', name: '', keywords: '', action: 'REPLY_AND_DM', replyText: '', dmText: '' },
  );

  const create = useMutation({
    mutationFn: () => omniApi.post('/social/rules', {
      platform: f.platform, name: f.name, keywords: f.keywords.split(',').map((k) => k.trim()).filter(Boolean),
      action: f.action, replyText: f.replyText || undefined, dmText: f.dmText || undefined,
    }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['omni-social-rules'] }); qc.invalidateQueries({ queryKey: ['omni-social-stats'] }); toast.success('Rule created'); onClose(); },
    onError: () => toast.error('Failed to create rule'),
  });

  return (
    <Overlay onClose={onClose} title="New comment rule">
      <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        <div style={{ display: 'flex', gap: 10 }}>
          <div style={{ flex: 1 }}><label className="label">Rule name</label><input className="input" value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} placeholder="Price enquiry" /></div>
          <div style={{ width: 140 }}>
            <label className="label">Platform</label>
            <select className="input" value={f.platform} onChange={(e) => setF({ ...f, platform: e.target.value as SocialPlatform })}>
              <option value="FACEBOOK">Facebook</option>
              <option value="INSTAGRAM">Instagram</option>
            </select>
          </div>
        </div>
        <div><label className="label">Keywords (comma separated — leave blank to match all)</label><input className="input" value={f.keywords} onChange={(e) => setF({ ...f, keywords: e.target.value })} placeholder="price, fee, cost, how much" /></div>
        <div>
          <label className="label">Action</label>
          <select className="input" value={f.action} onChange={(e) => setF({ ...f, action: e.target.value as CommentAction })}>
            <option value="REPLY">Public reply</option>
            <option value="DM">Send DM</option>
            <option value="REPLY_AND_DM">Public reply + DM</option>
          </select>
        </div>
        {(f.action === 'REPLY' || f.action === 'REPLY_AND_DM') && (
          <div><label className="label">Public reply</label><input className="input" value={f.replyText} onChange={(e) => setF({ ...f, replyText: e.target.value })} placeholder="Thanks! Check your inbox 📩" /></div>
        )}
        {(f.action === 'DM' || f.action === 'REPLY_AND_DM') && (
          <div><label className="label">Private DM</label><textarea className="input" rows={2} style={{ resize: 'vertical' }} value={f.dmText} onChange={(e) => setF({ ...f, dmText: e.target.value })} placeholder="Hi! Our courses start at ₹45,000. Want a callback?" /></div>
        )}
      </div>
      <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10, marginTop: 18 }}>
        <button className="btn-secondary" onClick={onClose}>Cancel</button>
        <button className="btn-primary" disabled={!f.name || create.isPending} onClick={() => create.mutate()}>Create rule</button>
      </div>
    </Overlay>
  );
}

function SimulateModal({ onClose }: { onClose: () => void }) {
  const qc = useQueryClient();
  const [mode, setMode] = useState<'comment' | 'lead'>('comment');
  const [c, setC] = useState({ authorName: 'Neha Sharma', text: 'what is the price of the course?' });
  const [l, setL] = useState({ fullName: 'Rahul Verma', email: 'rahul@example.com', phone: '919800011122', courseInterest: 'Web Development Diploma' });
  const [result, setResult] = useState<string | null>(null);

  const runComment = useMutation({
    mutationFn: () => omniApi.post('/social/simulate/comment', { platform: 'FACEBOOK', ...c }).then((r) => r.data),
    onSuccess: (r: any) => { setResult(r.matched ? `✅ Matched "${r.rule}" → ${r.actionTaken}` : '➖ No rule matched'); refresh(); },
  });
  const runLead = useMutation({
    mutationFn: () => omniApi.post('/social/simulate/lead-ad', { platform: 'FACEBOOK', ...l }).then((r) => r.data),
    onSuccess: () => { setResult('✅ Lead created in CRM (source: Social Media)'); refresh(); },
  });
  const refresh = () => { qc.invalidateQueries({ queryKey: ['omni-social-stats'] }); qc.invalidateQueries({ queryKey: ['omni-social-events'] }); qc.invalidateQueries({ queryKey: ['omni-social-rules'] }); };

  return (
    <Overlay onClose={onClose} title="Simulate a Facebook event">
      <div style={{ display: 'flex', gap: 6, marginBottom: 14 }}>
        <MiniTab active={mode === 'comment'} onClick={() => { setMode('comment'); setResult(null); }}>Comment</MiniTab>
        <MiniTab active={mode === 'lead'} onClick={() => { setMode('lead'); setResult(null); }}>Lead-Ad</MiniTab>
      </div>
      {mode === 'comment' ? (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          <div><label className="label">Commenter name</label><input className="input" value={c.authorName} onChange={(e) => setC({ ...c, authorName: e.target.value })} /></div>
          <div><label className="label">Comment text</label><textarea className="input" rows={2} style={{ resize: 'vertical' }} value={c.text} onChange={(e) => setC({ ...c, text: e.target.value })} /></div>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          <div style={{ display: 'flex', gap: 10 }}>
            <div style={{ flex: 1 }}><label className="label">Full name</label><input className="input" value={l.fullName} onChange={(e) => setL({ ...l, fullName: e.target.value })} /></div>
            <div style={{ flex: 1 }}><label className="label">Phone</label><input className="input" value={l.phone} onChange={(e) => setL({ ...l, phone: e.target.value })} /></div>
          </div>
          <div style={{ display: 'flex', gap: 10 }}>
            <div style={{ flex: 1 }}><label className="label">Email</label><input className="input" value={l.email} onChange={(e) => setL({ ...l, email: e.target.value })} /></div>
            <div style={{ flex: 1 }}><label className="label">Course interest</label><input className="input" value={l.courseInterest} onChange={(e) => setL({ ...l, courseInterest: e.target.value })} /></div>
          </div>
        </div>
      )}
      {result && <div style={{ marginTop: 14, padding: 12, background: 'var(--surface-3)', borderRadius: 10, fontSize: 13, color: 'var(--ink-1)' }}>{result}</div>}
      <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10, marginTop: 18 }}>
        <button className="btn-secondary" onClick={onClose}>Close</button>
        {mode === 'comment'
          ? <button className="btn-primary" disabled={runComment.isPending} onClick={() => runComment.mutate()}><Sparkles size={14} /> Post comment</button>
          : <button className="btn-primary" disabled={runLead.isPending} onClick={() => runLead.mutate()}><UserPlus size={14} /> Submit Lead-Ad</button>}
      </div>
    </Overlay>
  );
}

function MiniTab({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button onClick={onClick} style={{
      padding: '7px 14px', borderRadius: 9, fontSize: 12.5, fontWeight: 600, cursor: 'pointer',
      border: '1px solid ' + (active ? 'transparent' : 'var(--line-soft)'),
      background: active ? 'var(--brand,#132376)' : 'var(--surface)', color: active ? '#fff' : 'var(--ink-2)',
    }}>{children}</button>
  );
}

// ---------------- Activity ----------------
function Activity() {
  const { data } = useQuery({ queryKey: ['omni-social-events'], queryFn: async () => (await omniApi.get<SocialEvent[]>('/social/events')).data });

  if ((data ?? []).length === 0) {
    return (
      <div style={{ ...card, padding: 40, textAlign: 'center', color: 'var(--ink-3)' }}>
        <MessageCircle size={28} style={{ opacity: 0.4 }} />
        <div style={{ marginTop: 10, fontSize: 14 }}>No activity yet. Simulate a comment or Lead-Ad to see events here.</div>
      </div>
    );
  }

  return (
    <div style={{ ...card, padding: 6 }}>
      {(data ?? []).map((e, i) => (
        <div key={e.id} style={{ display: 'flex', alignItems: 'flex-start', gap: 12, padding: 14, borderTop: i ? '1px solid var(--line-soft)' : 'none' }}>
          <div style={{ width: 34, height: 34, borderRadius: 9, background: e.type === 'LEAD_AD' ? 'var(--success-bg)' : 'var(--surface-2)', color: e.type === 'LEAD_AD' ? 'var(--success)' : 'var(--ink-2)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
            {e.type === 'LEAD_AD' ? <UserPlus size={16} /> : <MessageCircle size={16} />}
          </div>
          <div style={{ minWidth: 0, flex: 1 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
              <span style={{ fontWeight: 600, fontSize: 13.5 }}>{e.authorName ?? 'Unknown'}</span>
              <span className="badge" style={{ background: 'var(--surface-2)', color: 'var(--ink-3)' }}>{PLATFORM_META[e.platform].icon} {e.type === 'LEAD_AD' ? 'Lead-Ad' : 'Comment'}</span>
              {e.actionTaken && e.actionTaken !== 'none' && <span className="badge" style={{ background: 'var(--success-bg)', color: 'var(--success)' }}>{e.actionTaken}</span>}
              {e.leadId && <span className="badge" style={{ background: 'var(--brand,#132376)', color: '#fff' }}>CRM lead</span>}
            </div>
            <div style={{ fontSize: 13, color: 'var(--ink-2)', marginTop: 3 }}>{e.text}</div>
          </div>
        </div>
      ))}
    </div>
  );
}

function Overlay({ children, onClose, title }: { children: React.ReactNode; onClose: () => void; title: string }) {
  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 60, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }}>
      <div style={{ position: 'absolute', inset: 0, background: 'rgba(20,15,12,.42)' }} onClick={onClose} />
      <div style={{ ...card, position: 'relative', zIndex: 1, width: 520, maxWidth: '100%', maxHeight: '92vh', overflow: 'auto', padding: 22, borderRadius: 18 }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
          <div style={{ fontWeight: 700, fontSize: 16 }}>{title}</div>
          <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--ink-3)' }}><X size={20} /></button>
        </div>
        {children}
      </div>
    </div>
  );
}
