'use client';

import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { Bot as BotIcon, BookOpen, Plus, Play, Pause, Trash2, X, Send, Sparkles, MessageSquare, Save } from 'lucide-react';
import { omniApi, CHANNEL_META, ChannelType, Bot, BotStatus, BotFallback, BotIntent, BotReply, KbArticle } from '../omni-client';

const card: React.CSSProperties = { background: 'var(--surface)', border: '1px solid var(--line-soft)', borderRadius: 16 };
const BOT_CHANNELS: ChannelType[] = ['WHATSAPP', 'WEB_CHAT', 'INSTAGRAM', 'FACEBOOK', 'TELEGRAM'];

export function AiBotsFeature() {
  const [tab, setTab] = useState<'bots' | 'kb'>('bots');
  return (
    <div style={{ animation: 'fadeUp .4s ease' }}>
      <div style={{ marginBottom: 18 }}>
        <h1 style={{ fontSize: 26, fontWeight: 700, letterSpacing: '-.02em', margin: 0 }}>AI Bots</h1>
        <p style={{ fontSize: 14, color: 'var(--ink-2)', margin: '6px 0 0' }}>No-code chatbots with intents and a knowledge base for AI (RAG) answers.</p>
      </div>
      <div style={{ display: 'flex', gap: 6, marginBottom: 18 }}>
        <Tab active={tab === 'bots'} onClick={() => setTab('bots')} icon={<BotIcon size={15} />}>Chatbots</Tab>
        <Tab active={tab === 'kb'} onClick={() => setTab('kb')} icon={<BookOpen size={15} />}>Knowledge Base</Tab>
      </div>
      {tab === 'bots' ? <Bots /> : <KnowledgeBase />}
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

// ---------------- Bots ----------------
function Bots() {
  const qc = useQueryClient();
  const [edit, setEdit] = useState<Bot | 'new' | null>(null);

  const { data } = useQuery({ queryKey: ['omni-bots'], queryFn: async () => (await omniApi.get<Bot[]>('/bots')).data });
  const status = useMutation({
    mutationFn: ({ id, status }: { id: string; status: BotStatus }) => omniApi.patch(`/bots/${id}`, { status }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['omni-bots'] }),
  });
  const del = useMutation({
    mutationFn: (id: string) => omniApi.delete(`/bots/${id}`),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['omni-bots'] }); toast.success('Bot deleted'); },
  });

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 14 }}>
        <button className="btn-primary" onClick={() => setEdit('new')}><Plus size={15} /> New bot</button>
      </div>
      {(data ?? []).length === 0 && (
        <div style={{ ...card, padding: 40, textAlign: 'center', color: 'var(--ink-3)' }}>
          <BotIcon size={28} style={{ opacity: 0.4 }} />
          <div style={{ marginTop: 10, fontSize: 14 }}>No bots yet. Build a chatbot to auto-answer inbound messages.</div>
        </div>
      )}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(320px,1fr))', gap: 14 }}>
        {(data ?? []).map((b) => (
          <div key={b.id} style={{ ...card, padding: 18 }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <span style={{ fontSize: 18 }}>{CHANNEL_META[b.channelType].icon}</span>
                <span style={{ fontWeight: 700, fontSize: 15 }}>{b.name}</span>
              </div>
              <span className="badge" style={{ background: b.status === 'ACTIVE' ? 'var(--success-bg)' : 'var(--surface-2)', color: b.status === 'ACTIVE' ? 'var(--success)' : 'var(--ink-3)' }}>{b.status}</span>
            </div>
            <div style={{ display: 'flex', gap: 6, marginBottom: 12, flexWrap: 'wrap' }}>
              <span className="badge" style={{ background: 'var(--surface-2)', color: 'var(--ink-3)' }}>{b.flow?.intents?.length ?? 0} intents</span>
              {b.kbEnabled && <span className="badge" style={{ background: 'var(--surface-2)', color: 'var(--ink-3)' }}><Sparkles size={11} style={{ marginRight: 3 }} />KB / RAG</span>}
              <span className="badge" style={{ background: 'var(--surface-2)', color: 'var(--ink-3)' }}>fallback: {b.fallbackMode}</span>
            </div>
            <div style={{ display: 'flex', gap: 8 }}>
              <button className="btn-secondary" style={{ flex: 1, height: 34, fontSize: 12.5 }} onClick={() => setEdit(b)}>Edit & test</button>
              {b.status !== 'ACTIVE'
                ? <button className="btn-secondary" style={{ height: 34, width: 34, padding: 0 }} title="Activate" onClick={() => status.mutate({ id: b.id, status: 'ACTIVE' })}><Play size={13} /></button>
                : <button className="btn-secondary" style={{ height: 34, width: 34, padding: 0 }} title="Pause" onClick={() => status.mutate({ id: b.id, status: 'PAUSED' })}><Pause size={13} /></button>}
              <button className="btn-secondary" style={{ height: 34, width: 34, padding: 0 }} onClick={() => del.mutate(b.id)}><Trash2 size={13} /></button>
            </div>
          </div>
        ))}
      </div>
      {edit && <BotEditor bot={edit === 'new' ? null : edit} onClose={() => setEdit(null)} />}
    </div>
  );
}

const EMPTY_BOT = { name: '', channelType: 'WHATSAPP' as ChannelType, welcomeMessage: '', kbEnabled: true, fallbackMode: 'AI' as BotFallback, fallbackMessage: '', intents: [] as BotIntent[] };

function BotEditor({ bot, onClose }: { bot: Bot | null; onClose: () => void }) {
  const qc = useQueryClient();
  const [f, setF] = useState(() => bot ? {
    name: bot.name, channelType: bot.channelType, welcomeMessage: bot.welcomeMessage ?? '',
    kbEnabled: bot.kbEnabled, fallbackMode: bot.fallbackMode, fallbackMessage: bot.fallbackMessage ?? '',
    intents: bot.flow?.intents ?? [],
  } : { ...EMPTY_BOT });

  const setIntent = (i: number, patch: Partial<BotIntent>) => setF((s) => ({ ...s, intents: s.intents.map((x, idx) => idx === i ? { ...x, ...patch } : x) }));
  const addIntent = () => setF((s) => ({ ...s, intents: [...s.intents, { name: '', keywords: [], reply: '', action: 'reply' }] }));
  const removeIntent = (i: number) => setF((s) => ({ ...s, intents: s.intents.filter((_, idx) => idx !== i) }));

  const payload = () => ({
    name: f.name, channelType: f.channelType, welcomeMessage: f.welcomeMessage || undefined,
    kbEnabled: f.kbEnabled, fallbackMode: f.fallbackMode, fallbackMessage: f.fallbackMessage || undefined,
    flow: { intents: f.intents.map((i) => ({ ...i, keywords: (i.keywords as any as string[]).filter(Boolean) })) },
  });

  const save = useMutation({
    mutationFn: () => bot ? omniApi.patch(`/bots/${bot.id}`, payload()) : omniApi.post('/bots', payload()),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['omni-bots'] }); toast.success(bot ? 'Bot saved' : 'Bot created'); onClose(); },
    onError: () => toast.error('Failed to save bot'),
  });

  return (
    <Overlay onClose={onClose} title={bot ? `Edit ${bot.name}` : 'New chatbot'} wide>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 320px', gap: 18 }}>
        {/* Config */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12, minWidth: 0 }}>
          <div style={{ display: 'flex', gap: 10 }}>
            <div style={{ flex: 1 }}><label className="label">Bot name</label><input className="input" value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} placeholder="Admissions Assistant" /></div>
            <div style={{ width: 150 }}>
              <label className="label">Channel</label>
              <select className="input" value={f.channelType} onChange={(e) => setF({ ...f, channelType: e.target.value as ChannelType })}>
                {BOT_CHANNELS.map((c) => <option key={c} value={c}>{CHANNEL_META[c].label}</option>)}
              </select>
            </div>
          </div>
          <div><label className="label">Welcome message (optional)</label><input className="input" value={f.welcomeMessage} onChange={(e) => setF({ ...f, welcomeMessage: e.target.value })} placeholder="Hi! I'm the admissions assistant." /></div>

          <div>
            <label className="label">Intents</label>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {f.intents.map((intent, i) => (
                <div key={i} style={{ border: '1px solid var(--line-soft)', borderRadius: 12, padding: 12 }}>
                  <div style={{ display: 'flex', gap: 8, marginBottom: 8 }}>
                    <input className="input" style={{ flex: 1 }} value={intent.name} onChange={(e) => setIntent(i, { name: e.target.value })} placeholder="Intent name (e.g. Fees)" />
                    <select className="input" style={{ width: 120 }} value={intent.action} onChange={(e) => setIntent(i, { action: e.target.value as any })}>
                      <option value="reply">Reply</option>
                      <option value="handoff">Handoff</option>
                    </select>
                    <button onClick={() => removeIntent(i)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--ink-3)' }}><X size={16} /></button>
                  </div>
                  <input className="input" style={{ marginBottom: 8 }} value={(intent.keywords as string[]).join(', ')} onChange={(e) => setIntent(i, { keywords: e.target.value.split(',').map((k) => k.trim()) })} placeholder="Keywords, comma separated: fee, price, cost" />
                  <textarea className="input" rows={2} style={{ resize: 'vertical' }} value={intent.reply} onChange={(e) => setIntent(i, { reply: e.target.value })} placeholder="Reply to send when matched…" />
                </div>
              ))}
            </div>
            <button className="btn-secondary" style={{ marginTop: 10, height: 34, fontSize: 12.5 }} onClick={addIntent}><Plus size={13} /> Add intent</button>
          </div>

          <div style={{ borderTop: '1px solid var(--line-soft)', paddingTop: 12 }}>
            <label className="label">Fallback (no intent matched)</label>
            <div style={{ display: 'flex', gap: 10, alignItems: 'center', marginBottom: 8 }}>
              <select className="input" style={{ width: 200 }} value={f.fallbackMode} onChange={(e) => setF({ ...f, fallbackMode: e.target.value as BotFallback })}>
                <option value="AI">AI answer (knowledge base)</option>
                <option value="MESSAGE">Static message</option>
                <option value="HANDOFF">Hand off to a human</option>
              </select>
              <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12.5, color: 'var(--ink-2)' }}>
                <input type="checkbox" checked={f.kbEnabled} onChange={(e) => setF({ ...f, kbEnabled: e.target.checked })} /> Use knowledge base (RAG)
              </label>
            </div>
            {f.fallbackMode !== 'AI' && (
              <input className="input" value={f.fallbackMessage} onChange={(e) => setF({ ...f, fallbackMessage: e.target.value })} placeholder={f.fallbackMode === 'HANDOFF' ? 'Message before handoff…' : 'Fallback message…'} />
            )}
          </div>
        </div>

        {/* Test console */}
        <div style={{ borderLeft: '1px solid var(--line-soft)', paddingLeft: 18 }}>
          {bot ? <TestConsole botId={bot.id} /> : (
            <div style={{ fontSize: 12.5, color: 'var(--ink-3)', padding: 12, background: 'var(--surface-3)', borderRadius: 10 }}>
              Save the bot first to open the test console.
            </div>
          )}
        </div>
      </div>

      <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10, marginTop: 18 }}>
        <button className="btn-secondary" onClick={onClose}>Close</button>
        <button className="btn-primary" disabled={!f.name || save.isPending} onClick={() => save.mutate()}><Save size={14} /> {bot ? 'Save changes' : 'Create bot'}</button>
      </div>
    </Overlay>
  );
}

function TestConsole({ botId }: { botId: string }) {
  const [log, setLog] = useState<{ role: 'user' | 'bot'; text: string; meta?: BotReply }[]>([]);
  const [text, setText] = useState('');

  const send = useMutation({
    mutationFn: (t: string) => omniApi.post<BotReply>(`/bots/${botId}/test`, { text: t }).then((r) => r.data),
    onSuccess: (r, t) => setLog((l) => [...l, { role: 'user', text: t }, { role: 'bot', text: r.reply, meta: r }]),
    onError: () => toast.error('Save the bot before testing its latest changes'),
  });

  const submit = () => { if (text.trim()) { send.mutate(text.trim()); setText(''); } };
  const SRC_COLOR: Record<string, string> = { intent: 'var(--success)', ai: 'var(--brand,#132376)', handoff: 'var(--warning,#c67c1e)', message: 'var(--ink-3)', welcome: 'var(--ink-3)' };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 7, fontWeight: 700, fontSize: 13.5, marginBottom: 10 }}><MessageSquare size={15} /> Test console</div>
      <div style={{ flex: 1, minHeight: 240, maxHeight: 340, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 10 }}>
        {log.length === 0 && <div style={{ fontSize: 12, color: 'var(--ink-3)' }}>Send a message to see how the bot responds. Save changes first to test them.</div>}
        {log.map((m, i) => (
          <div key={i} style={{ alignSelf: m.role === 'user' ? 'flex-end' : 'flex-start', maxWidth: '90%' }}>
            <div style={{
              background: m.role === 'user' ? 'var(--brand,#132376)' : 'var(--surface-3)',
              color: m.role === 'user' ? '#fff' : 'var(--ink-1)', padding: '8px 11px', borderRadius: 12, fontSize: 12.5, whiteSpace: 'pre-wrap',
            }}>{m.text}</div>
            {m.meta && (
              <div style={{ fontSize: 10.5, color: SRC_COLOR[m.meta.source] ?? 'var(--ink-3)', marginTop: 3, display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                <span style={{ fontWeight: 700, textTransform: 'uppercase' }}>{m.meta.source}</span>
                {m.meta.matchedIntent && <span>· {m.meta.matchedIntent}</span>}
                {m.meta.kbUsed?.length > 0 && <span>· KB: {m.meta.kbUsed.join(', ')}</span>}
                {m.meta.provider && <span>· {m.meta.provider}</span>}
              </div>
            )}
          </div>
        ))}
      </div>
      <div style={{ display: 'flex', gap: 6 }}>
        <input className="input" style={{ flex: 1 }} value={text} onChange={(e) => setText(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && submit()} placeholder="Type a customer message…" />
        <button className="btn-primary" style={{ width: 40, padding: 0 }} disabled={send.isPending} onClick={submit}><Send size={15} /></button>
      </div>
    </div>
  );
}

// ---------------- Knowledge Base ----------------
function KnowledgeBase() {
  const qc = useQueryClient();
  const [edit, setEdit] = useState<KbArticle | 'new' | null>(null);

  const { data } = useQuery({ queryKey: ['omni-kb'], queryFn: async () => (await omniApi.get<KbArticle[]>('/kb')).data });
  const del = useMutation({
    mutationFn: (id: string) => omniApi.delete(`/kb/${id}`),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['omni-kb'] }); toast.success('Article deleted'); },
  });

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 14 }}>
        <button className="btn-primary" onClick={() => setEdit('new')}><Plus size={15} /> New article</button>
      </div>
      {(data ?? []).length === 0 && (
        <div style={{ ...card, padding: 40, textAlign: 'center', color: 'var(--ink-3)' }}>
          <BookOpen size={28} style={{ opacity: 0.4 }} />
          <div style={{ marginTop: 10, fontSize: 14 }}>No articles yet. Add FAQs the AI can use to answer.</div>
        </div>
      )}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(320px,1fr))', gap: 14 }}>
        {(data ?? []).map((a) => (
          <div key={a.id} style={{ ...card, padding: 18, display: 'flex', flexDirection: 'column' }}>
            <div style={{ fontWeight: 700, fontSize: 14.5, marginBottom: 6 }}>{a.title}</div>
            <div style={{ fontSize: 12.5, color: 'var(--ink-2)', flex: 1, display: '-webkit-box', WebkitLineClamp: 4, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>{a.content}</div>
            {a.tags.length > 0 && <div style={{ display: 'flex', gap: 5, flexWrap: 'wrap', marginTop: 10 }}>{a.tags.map((t) => <span key={t} className="badge" style={{ background: 'var(--surface-2)', color: 'var(--ink-3)' }}>{t}</span>)}</div>}
            <div style={{ display: 'flex', gap: 8, marginTop: 12 }}>
              <button className="btn-secondary" style={{ flex: 1, height: 32, fontSize: 12.5 }} onClick={() => setEdit(a)}>Edit</button>
              <button className="btn-secondary" style={{ height: 32, width: 32, padding: 0 }} onClick={() => del.mutate(a.id)}><Trash2 size={13} /></button>
            </div>
          </div>
        ))}
      </div>
      {edit && <ArticleModal article={edit === 'new' ? null : edit} onClose={() => setEdit(null)} />}
    </div>
  );
}

function ArticleModal({ article, onClose }: { article: KbArticle | null; onClose: () => void }) {
  const qc = useQueryClient();
  const [f, setF] = useState({ title: article?.title ?? '', content: article?.content ?? '', tags: (article?.tags ?? []).join(', ') });

  const save = useMutation({
    mutationFn: () => {
      const body = { title: f.title, content: f.content, tags: f.tags.split(',').map((t) => t.trim()).filter(Boolean) };
      return article ? omniApi.patch(`/kb/${article.id}`, body) : omniApi.post('/kb', body);
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['omni-kb'] }); toast.success(article ? 'Article saved' : 'Article added'); onClose(); },
    onError: () => toast.error('Failed to save'),
  });

  return (
    <Overlay onClose={onClose} title={article ? 'Edit article' : 'New knowledge article'}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        <div><label className="label">Title</label><input className="input" value={f.title} onChange={(e) => setF({ ...f, title: e.target.value })} placeholder="Course fees" /></div>
        <div><label className="label">Content</label><textarea className="input" rows={6} style={{ resize: 'vertical' }} value={f.content} onChange={(e) => setF({ ...f, content: e.target.value })} placeholder="Our Diploma costs ₹45,000 for 6 months. EMI available…" /></div>
        <div><label className="label">Tags (comma separated)</label><input className="input" value={f.tags} onChange={(e) => setF({ ...f, tags: e.target.value })} placeholder="fees, price, scholarship" /></div>
      </div>
      <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10, marginTop: 18 }}>
        <button className="btn-secondary" onClick={onClose}>Cancel</button>
        <button className="btn-primary" disabled={!f.title || !f.content || save.isPending} onClick={() => save.mutate()}>Save</button>
      </div>
    </Overlay>
  );
}

function Overlay({ children, onClose, title, wide }: { children: React.ReactNode; onClose: () => void; title: string; wide?: boolean }) {
  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 60, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }}>
      <div style={{ position: 'absolute', inset: 0, background: 'rgba(20,15,12,.42)' }} onClick={onClose} />
      <div style={{ ...card, position: 'relative', zIndex: 1, width: wide ? 900 : 520, maxWidth: '100%', maxHeight: '92vh', overflow: 'auto', padding: 22, borderRadius: 18 }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
          <div style={{ fontWeight: 700, fontSize: 16 }}>{title}</div>
          <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--ink-3)' }}><X size={20} /></button>
        </div>
        {children}
      </div>
    </div>
  );
}
