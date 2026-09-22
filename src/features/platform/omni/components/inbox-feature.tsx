'use client';

import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import {
  Send, Sparkles, StickyNote, Bot, CheckCircle2, UserPlus, FileText, Search, Link2, MessageSquareText,
} from 'lucide-react';
import { useAuth } from '@/features/foundation/auth';
import { formatDate } from '@/lib/utils';
import {
  omniApi, ConversationRow, ConversationThread, AiAgentConfig,
  CHANNEL_META, contactInitials, contactColor, OmniMessage, SavedReply,
} from '../omni-client';

const card: React.CSSProperties = { background: 'var(--surface)', border: '1px solid var(--line-soft)', borderRadius: 16 };

export function InboxFeature() {
  const { user } = useAuth();
  const qc = useQueryClient();
  const [selected, setSelected] = useState<string | null>(null);
  const [filter, setFilter] = useState<'all' | 'open' | 'unread'>('open');
  const [search, setSearch] = useState('');
  const [draft, setDraft] = useState('');
  const [noteMode, setNoteMode] = useState(false);
  const [repliesOpen, setRepliesOpen] = useState(false);

  const { data: replies } = useQuery({
    queryKey: ['omni-replies'],
    queryFn: async () => (await omniApi.get<SavedReply[]>('/audience/saved-replies')).data,
  });

  const { data: stats } = useQuery({
    queryKey: ['omni-stats'],
    queryFn: async () => (await omniApi.get('/inbox/stats')).data as { open: number; unassigned: number; unread: number },
    refetchInterval: 5000,
  });
  const { data: agent } = useQuery({
    queryKey: ['omni-agent'],
    queryFn: async () => (await omniApi.get<AiAgentConfig>('/inbox/agent')).data,
  });
  const { data: list } = useQuery({
    queryKey: ['omni-conversations'],
    queryFn: async () => (await omniApi.get<ConversationRow[]>('/inbox/conversations')).data,
    refetchInterval: 5000,
  });
  const { data: thread } = useQuery({
    queryKey: ['omni-thread', selected],
    queryFn: async () => (await omniApi.get<ConversationThread>(`/inbox/conversations/${selected}`)).data,
    enabled: !!selected,
    refetchInterval: selected ? 4000 : false,
  });

  const invalidate = () => {
    qc.invalidateQueries({ queryKey: ['omni-thread', selected] });
    qc.invalidateQueries({ queryKey: ['omni-conversations'] });
    qc.invalidateQueries({ queryKey: ['omni-stats'] });
  };

  const send = useMutation({
    mutationFn: () => omniApi.post(
      `/inbox/conversations/${selected}/${noteMode ? 'notes' : 'messages'}`, { body: draft }),
    onSuccess: () => { setDraft(''); invalidate(); },
    onError: () => toast.error('Failed to send'),
  });
  const aiDraft = useMutation({
    mutationFn: () => omniApi.post(`/inbox/conversations/${selected}/ai-draft`, {}),
    onSuccess: (r) => { setDraft(r.data.draft); setNoteMode(false); toast.success(`AI draft (${r.data.provider})`); },
    onError: () => toast.error('AI draft failed'),
  });
  const summarize = useMutation({
    mutationFn: () => omniApi.post(`/inbox/conversations/${selected}/summarize`, {}),
    onSuccess: () => { invalidate(); toast.success('Summarized'); },
    onError: () => toast.error('Summarize failed'),
  });
  const toggleAi = useMutation({
    mutationFn: (enabled: boolean) => omniApi.patch(`/inbox/conversations/${selected}/ai`, { enabled }),
    onSuccess: invalidate,
  });
  const assignMe = useMutation({
    mutationFn: () => omniApi.patch(`/inbox/conversations/${selected}/assign`, { assignedToId: user!.id }),
    onSuccess: () => { invalidate(); toast.success('Assigned to you'); },
  });
  const close = useMutation({
    mutationFn: () => omniApi.patch(`/inbox/conversations/${selected}/status`, { status: 'CLOSED' }),
    onSuccess: () => { invalidate(); toast.success('Conversation closed'); },
  });

  const filtered = (list ?? []).filter((c) => {
    if (filter === 'open' && c.status === 'CLOSED') return false;
    if (filter === 'unread' && !c.unread) return false;
    if (search && !(`${c.contactName} ${c.contactHandle} ${c.subject}`.toLowerCase().includes(search.toLowerCase()))) return false;
    return true;
  });

  return (
    <div style={{ animation: 'fadeUp .4s ease' }}>
      <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', marginBottom: 16, flexWrap: 'wrap', gap: 12 }}>
        <div>
          <h1 style={{ fontSize: 26, fontWeight: 700, letterSpacing: '-.02em', margin: 0 }}>Team Inbox</h1>
          <p style={{ fontSize: 14, color: 'var(--ink-2)', margin: '6px 0 0' }}>
            {stats ? `${stats.open} open · ${stats.unassigned} unassigned · ${stats.unread} unread` : 'Loading…'}
          </p>
        </div>
        {agent && (
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: 7, fontSize: 12.5, color: 'var(--ink-2)', background: 'var(--surface-2)', padding: '7px 12px', borderRadius: 99 }}>
            <Bot size={15} color="var(--gold)" /> AI {agent.enabled ? (agent.autoReply ? 'auto-reply' : 'assist') : 'off'}
            · {agent.providers.find((p) => p.configured)?.provider ?? 'stub'}
          </span>
        )}
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '320px 1fr 300px', gap: 14, height: 'calc(100vh - 210px)' }}>
        {/* ---- Conversation list ---- */}
        <div style={{ ...card, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
          <div style={{ padding: 12, borderBottom: '1px solid var(--line-soft)' }}>
            <div style={{ position: 'relative', marginBottom: 10 }}>
              <Search size={15} style={{ position: 'absolute', left: 11, top: '50%', transform: 'translateY(-50%)', color: 'var(--ink-3)' }} />
              <input className="input" style={{ height: 38, paddingLeft: 33, fontSize: 13 }} placeholder="Search conversations…" value={search} onChange={(e) => setSearch(e.target.value)} />
            </div>
            <div style={{ display: 'flex', gap: 4 }}>
              {(['open', 'unread', 'all'] as const).map((f) => (
                <button key={f} onClick={() => setFilter(f)}
                  style={{ flex: 1, padding: '6px 0', borderRadius: 8, border: 'none', cursor: 'pointer', fontSize: 12, fontWeight: 600, textTransform: 'capitalize',
                    background: filter === f ? 'var(--surface-2)' : 'transparent', color: filter === f ? 'var(--ink)' : 'var(--ink-3)' }}>{f}</button>
              ))}
            </div>
          </div>
          <div style={{ flex: 1, overflowY: 'auto' }}>
            {filtered.map((c) => {
              const meta = CHANNEL_META[c.channelType];
              const active = selected === c.id;
              return (
                <div key={c.id} onClick={() => { setSelected(c.id); setNoteMode(false); }}
                  style={{ display: 'flex', gap: 11, padding: '12px 14px', borderBottom: '1px solid var(--line-soft)', cursor: 'pointer', background: active ? 'var(--surface-2)' : 'transparent' }}>
                  <span style={{ position: 'relative', flexShrink: 0 }}>
                    <span style={{ width: 38, height: 38, borderRadius: 99, background: contactColor(c.id), color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700, fontSize: 13 }}>{contactInitials(c.contactName)}</span>
                    <span style={{ position: 'absolute', bottom: -2, right: -2, width: 16, height: 16, borderRadius: 99, background: 'var(--surface)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 9 }} title={meta.label}>{meta.icon}</span>
                  </span>
                  <div style={{ minWidth: 0, flex: 1 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', gap: 6 }}>
                      <span style={{ fontWeight: 600, fontSize: 13.5, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{c.contactName ?? 'Visitor'}</span>
                      {c.unread && <span style={{ width: 8, height: 8, borderRadius: 99, background: 'var(--gold)', flexShrink: 0, marginTop: 4 }} />}
                    </div>
                    <div style={{ fontSize: 12, color: 'var(--ink-3)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {c.lastMessage?.authorType === 'AI' ? '🤖 ' : ''}{c.lastMessage?.body ?? c.subject ?? '—'}
                    </div>
                  </div>
                </div>
              );
            })}
            {filtered.length === 0 && <div style={{ padding: 30, textAlign: 'center', color: 'var(--ink-3)', fontSize: 13 }}>No conversations.</div>}
          </div>
        </div>

        {/* ---- Thread ---- */}
        <div style={{ ...card, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
          {!thread ? (
            <div style={{ margin: 'auto', color: 'var(--ink-3)', fontSize: 14 }}>Select a conversation</div>
          ) : (
            <>
              <div style={{ padding: '14px 18px', borderBottom: '1px solid var(--line-soft)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <div>
                  <div style={{ fontWeight: 700, fontSize: 15 }}>{thread.contactName ?? 'Visitor'}</div>
                  <div style={{ fontSize: 12, color: 'var(--ink-3)' }}>{CHANNEL_META[thread.channelType].label}{thread.contactHandle ? ` · ${thread.contactHandle}` : ''}</div>
                </div>
                <div style={{ display: 'flex', gap: 8 }}>
                  <button className="btn-secondary" style={{ height: 34, fontSize: 12.5 }} onClick={() => summarize.mutate()} disabled={summarize.isPending}><Sparkles size={14} /> Summarize</button>
                  <button className="btn-secondary" style={{ height: 34, fontSize: 12.5 }} onClick={() => close.mutate()}><CheckCircle2 size={14} /> Close</button>
                </div>
              </div>

              <div style={{ flex: 1, overflowY: 'auto', padding: 18, display: 'flex', flexDirection: 'column', gap: 10 }}>
                {thread.messages.map((m) => <Bubble key={m.id} m={m} />)}
              </div>

              <div style={{ borderTop: '1px solid var(--line-soft)', padding: 12 }}>
                <div style={{ display: 'flex', gap: 8, marginBottom: 8, position: 'relative' }}>
                  <button onClick={() => setNoteMode(false)} style={pill(!noteMode)}>Reply</button>
                  <button onClick={() => setNoteMode(true)} style={pill(noteMode)}><StickyNote size={13} /> Note</button>
                  <button style={{ ...pill(false) }} onClick={() => setRepliesOpen((v) => !v)}><MessageSquareText size={13} /> Saved</button>
                  {repliesOpen && (
                    <>
                      <div style={{ position: 'fixed', inset: 0, zIndex: 9 }} onClick={() => setRepliesOpen(false)} />
                      <div className="card" style={{ position: 'absolute', bottom: 40, left: 0, zIndex: 10, width: 300, maxHeight: 240, overflowY: 'auto', boxShadow: 'var(--shadow-3)', padding: 4 }}>
                        {(replies ?? []).map((r) => (
                          <button key={r.id} onClick={() => { setDraft(r.body); setNoteMode(false); setRepliesOpen(false); }}
                            style={{ display: 'block', width: '100%', textAlign: 'left', border: 'none', background: 'transparent', cursor: 'pointer', padding: '8px 10px', borderRadius: 8 }}>
                            <div style={{ fontSize: 12.5, fontWeight: 600 }}>{r.title} {r.shortcut && <span style={{ color: 'var(--navy)', fontFamily: 'var(--mono)', fontSize: 10 }}>{r.shortcut}</span>}</div>
                            <div style={{ fontSize: 11.5, color: 'var(--ink-3)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{r.body}</div>
                          </button>
                        ))}
                        {(!replies || replies.length === 0) && <div style={{ padding: 12, fontSize: 12, color: 'var(--ink-3)' }}>No saved replies. Add them in Audience.</div>}
                      </div>
                    </>
                  )}
                  <button className="btn-secondary" style={{ height: 30, fontSize: 12, marginLeft: 'auto', color: 'var(--gold)' }} onClick={() => aiDraft.mutate()} disabled={aiDraft.isPending}>
                    <Sparkles size={13} /> {aiDraft.isPending ? 'Thinking…' : 'AI draft'}
                  </button>
                </div>
                <div style={{ display: 'flex', gap: 8, alignItems: 'flex-end' }}>
                  <textarea className="input" rows={2} style={{ resize: 'none', background: noteMode ? 'var(--gold-bg)' : 'var(--surface-3)' }}
                    placeholder={noteMode ? 'Internal note (not sent to the customer)…' : 'Type a reply…'} value={draft}
                    onChange={(e) => setDraft(e.target.value)}
                    onKeyDown={(e) => { if (e.key === 'Enter' && (e.metaKey || e.ctrlKey) && draft.trim()) send.mutate(); }} />
                  <button className="btn-primary" style={{ height: 44, flexShrink: 0 }} disabled={!draft.trim() || send.isPending} onClick={() => send.mutate()}><Send size={16} /></button>
                </div>
              </div>
            </>
          )}
        </div>

        {/* ---- Customer 360 ---- */}
        <div style={{ ...card, padding: 16, overflowY: 'auto' }}>
          {!thread ? <div style={{ color: 'var(--ink-3)', fontSize: 13 }}>—</div> : (
            <>
              <div style={{ textAlign: 'center', paddingBottom: 14, borderBottom: '1px solid var(--line-soft)' }}>
                <span style={{ width: 56, height: 56, borderRadius: 99, background: contactColor(thread.id), color: '#fff', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700, fontSize: 20, marginBottom: 8 }}>{contactInitials(thread.contactName)}</span>
                <div style={{ fontWeight: 700, fontSize: 15 }}>{thread.contactName ?? 'Visitor'}</div>
                <div style={{ fontSize: 12, color: 'var(--ink-3)' }}>{thread.contactHandle ?? CHANNEL_META[thread.channelType].label}</div>
              </div>

              <div style={{ display: 'flex', gap: 8, margin: '14px 0' }}>
                <button className="btn-secondary" style={{ flex: 1, height: 36, fontSize: 12.5 }} onClick={() => assignMe.mutate()}><UserPlus size={14} /> Assign me</button>
                <button style={{ ...pill(thread.aiEnabled), height: 36, flex: 1, justifyContent: 'center' }} onClick={() => toggleAi.mutate(!thread.aiEnabled)}>
                  <Bot size={14} /> AI {thread.aiEnabled ? 'on' : 'off'}
                </button>
              </div>

              {thread.aiSummary && (
                <div style={{ background: 'var(--gold-bg)', borderRadius: 12, padding: 12, marginBottom: 14 }}>
                  <div className="eyebrow" style={{ marginBottom: 6, display: 'flex', alignItems: 'center', gap: 5 }}><Sparkles size={12} /> AI Summary</div>
                  <div style={{ fontSize: 12.5, color: 'var(--ink-2)', lineHeight: 1.5, whiteSpace: 'pre-wrap' }}>{thread.aiSummary}</div>
                </div>
              )}

              <div className="eyebrow" style={{ marginBottom: 8 }}>Customer 360</div>
              {thread.lead ? (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8, fontSize: 13 }}>
                  <Row l="CRM Lead" v={`${thread.lead.firstName} ${thread.lead.lastName ?? ''}`} />
                  {thread.lead.stage && <Row l="Stage" v={thread.lead.stage.name} />}
                  {thread.lead.course && <Row l="Course" v={thread.lead.course.name} />}
                  {typeof thread.lead.score === 'number' && <Row l="Score" v={String(thread.lead.score)} />}
                  {thread.lead.phone && <Row l="Phone" v={thread.lead.phone} />}
                  <a className="btn-secondary" style={{ height: 34, fontSize: 12.5, marginTop: 4 }} href={`/leads/${thread.lead.id}`}><Link2 size={13} /> Open lead</a>
                </div>
              ) : (
                <div style={{ fontSize: 12.5, color: 'var(--ink-3)', display: 'flex', flexDirection: 'column', gap: 8 }}>
                  <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}><FileText size={13} /> Not linked to a CRM lead yet.</div>
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}

function Bubble({ m }: { m: OmniMessage }) {
  if (m.authorType === 'NOTE') {
    return (
      <div style={{ alignSelf: 'center', maxWidth: '80%', background: 'var(--gold-bg)', border: '1px solid var(--gold)', borderRadius: 10, padding: '8px 12px', fontSize: 12.5, color: 'var(--ink-2)' }}>
        <StickyNoteInline /> {m.body} <span style={{ color: 'var(--ink-3)' }}>— {m.authorName}</span>
      </div>
    );
  }
  const inbound = m.direction === 'INBOUND';
  const ai = m.authorType === 'AI';
  return (
    <div style={{ alignSelf: inbound ? 'flex-start' : 'flex-end', maxWidth: '72%' }}>
      <div style={{
        padding: '9px 13px', borderRadius: 14, fontSize: 13.5, lineHeight: 1.5,
        background: inbound ? 'var(--surface-2)' : ai ? 'var(--gold-bg)' : 'var(--navy)',
        color: inbound ? 'var(--ink)' : ai ? 'var(--ink)' : '#fff',
        border: ai ? '1px solid var(--gold)' : 'none',
        borderBottomLeftRadius: inbound ? 4 : 14, borderBottomRightRadius: inbound ? 14 : 4,
      }}>{m.body}</div>
      <div style={{ fontSize: 10.5, color: 'var(--ink-3)', marginTop: 3, textAlign: inbound ? 'left' : 'right' }}>
        {ai ? '🤖 AI' : m.authorName ?? (inbound ? 'Customer' : 'Agent')} · {formatDate(m.createdAt)}
      </div>
    </div>
  );
}

function StickyNoteInline() { return <span style={{ fontSize: 11 }}>📌</span>; }

function Row({ l, v }: { l: string; v: string }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', gap: 10 }}>
      <span style={{ color: 'var(--ink-3)' }}>{l}</span>
      <span style={{ fontWeight: 600, textAlign: 'right' }}>{v}</span>
    </div>
  );
}

function pill(active: boolean): React.CSSProperties {
  return {
    display: 'inline-flex', alignItems: 'center', gap: 5, height: 30, padding: '0 12px', borderRadius: 8,
    border: '1px solid var(--line)', cursor: 'pointer', fontSize: 12, fontWeight: 600,
    background: active ? 'var(--navy)' : 'var(--surface)', color: active ? '#fff' : 'var(--ink-2)',
  };
}
