'use client';

import { useState, useRef, useEffect } from 'react';
import { useMutation, useQuery } from '@tanstack/react-query';
import { Sparkles, Send, Wand2, UserPlus, Search, CalendarClock, BookOpen, ShoppingBag, CheckCircle2, AlertTriangle } from 'lucide-react';
import { omniApi, AgentTool, AgentRunResult, AgentAction } from '../omni-client';

const card: React.CSSProperties = { background: 'var(--surface)', border: '1px solid var(--line-soft)', borderRadius: 16 };
const TOOL_ICON: Record<string, React.ReactNode> = {
  create_lead: <UserPlus size={13} />, search_leads: <Search size={13} />, schedule_followup: <CalendarClock size={13} />,
  search_students: <Search size={13} />, kb_search: <BookOpen size={13} />, create_order: <ShoppingBag size={13} />,
};
const EXAMPLES = [
  'Create a new lead for Rohan Mehta 9876500011 interested in Data Science and schedule a follow-up',
  'Find any leads named Priya',
  'Create an order for the Data Science Bootcamp for Anita',
  'How much are the course fees and is there a scholarship?',
];

interface Turn { role: 'user' | 'agent'; text: string; actions?: AgentAction[] }

export function AgentFeature() {
  const [log, setLog] = useState<Turn[]>([]);
  const [text, setText] = useState('');
  const scrollRef = useRef<HTMLDivElement>(null);

  const { data: tools } = useQuery({ queryKey: ['omni-agent-tools'], queryFn: async () => (await omniApi.get<AgentTool[]>('/agent/tools')).data });

  const run = useMutation({
    mutationFn: (message: string) => omniApi.post<AgentRunResult>('/agent/run', { message }).then((r) => r.data),
    onSuccess: (r, message) => setLog((l) => [...l, { role: 'user', text: message }, { role: 'agent', text: r.reply, actions: r.actions }]),
  });

  useEffect(() => { scrollRef.current?.scrollTo(0, scrollRef.current.scrollHeight); }, [log, run.isPending]);
  const submit = (msg?: string) => { const m = (msg ?? text).trim(); if (m) { run.mutate(m); setText(''); } };

  return (
    <div style={{ animation: 'fadeUp .4s ease' }}>
      <div style={{ marginBottom: 18 }}>
        <h1 style={{ fontSize: 26, fontWeight: 700, letterSpacing: '-.02em', margin: 0, display: 'flex', alignItems: 'center', gap: 10 }}>
          <Sparkles size={24} style={{ color: 'var(--gold,#E6A23C)' }} /> AI Copilot
        </h1>
        <p style={{ fontSize: 14, color: 'var(--ink-2)', margin: '6px 0 0' }}>An autonomous agent that plans and takes actions across your CRM, commerce and knowledge base.</p>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 260px', gap: 14 }}>
        <div style={{ ...card, padding: 0, display: 'flex', flexDirection: 'column', height: 560 }}>
          <div ref={scrollRef} style={{ flex: 1, overflowY: 'auto', padding: 18, display: 'flex', flexDirection: 'column', gap: 14 }}>
            {log.length === 0 && (
              <div style={{ margin: 'auto', textAlign: 'center', color: 'var(--ink-3)', maxWidth: 420 }}>
                <Wand2 size={30} style={{ opacity: 0.4 }} />
                <div style={{ marginTop: 12, fontSize: 14 }}>Ask the copilot to do something. It will plan the steps and act.</div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginTop: 16 }}>
                  {EXAMPLES.map((e) => (
                    <button key={e} onClick={() => submit(e)} style={{ ...card, padding: '10px 12px', textAlign: 'left', fontSize: 12.5, color: 'var(--ink-2)', cursor: 'pointer', background: 'var(--surface-2)' }}>{e}</button>
                  ))}
                </div>
              </div>
            )}
            {log.map((t, i) => (
              <div key={i} style={{ alignSelf: t.role === 'user' ? 'flex-end' : 'flex-start', maxWidth: '85%' }}>
                <div style={{ background: t.role === 'user' ? 'var(--brand,#132376)' : 'var(--surface-3)', color: t.role === 'user' ? '#fff' : 'var(--ink-1)', padding: '10px 13px', borderRadius: 13, fontSize: 13, whiteSpace: 'pre-wrap' }}>{t.text}</div>
                {t.actions && t.actions.length > 0 && (
                  <div style={{ marginTop: 8, display: 'flex', flexDirection: 'column', gap: 6 }}>
                    {t.actions.map((a, j) => (
                      <div key={j} style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 11.5, color: 'var(--ink-3)', background: 'var(--surface-2)', padding: '6px 9px', borderRadius: 9 }}>
                        {a.ok ? <CheckCircle2 size={13} style={{ color: 'var(--success)' }} /> : <AlertTriangle size={13} style={{ color: 'var(--warning,#c67c1e)' }} />}
                        <span className="badge" style={{ background: 'var(--surface)', color: 'var(--ink-2)', display: 'inline-flex', alignItems: 'center', gap: 4 }}>{TOOL_ICON[a.tool]} {a.tool}</span>
                        <span style={{ minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{a.summary}</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            ))}
            {run.isPending && <div style={{ alignSelf: 'flex-start', fontSize: 12.5, color: 'var(--ink-3)' }}>🤖 Planning &amp; acting…</div>}
          </div>
          <div style={{ borderTop: '1px solid var(--line-soft)', padding: 12, display: 'flex', gap: 8 }}>
            <input className="input" style={{ flex: 1 }} value={text} onChange={(e) => setText(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && submit()} placeholder="Tell the copilot what to do…" />
            <button className="btn-primary" style={{ width: 44, padding: 0 }} disabled={run.isPending} onClick={() => submit()}><Send size={16} /></button>
          </div>
        </div>

        <div style={{ ...card, padding: 16, alignSelf: 'flex-start' }}>
          <div style={{ fontWeight: 700, fontSize: 13.5, marginBottom: 10 }}>Agent tools</div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {(tools ?? []).map((t) => (
              <div key={t.name} style={{ display: 'flex', gap: 8, alignItems: 'flex-start', opacity: t.allowed === false ? 0.55 : 1 }}>
                <span style={{ color: 'var(--brand,#132376)', marginTop: 2 }}>{TOOL_ICON[t.name] ?? <Wand2 size={13} />}</span>
                <div>
                  <div style={{ fontSize: 12.5, fontWeight: 600 }}>{t.name}</div>
                  <div style={{ fontSize: 11.5, color: 'var(--ink-3)' }}>{t.desc}</div>
                  {t.allowed === false && <div style={{ fontSize: 11, color: 'var(--ink-3)', marginTop: 2 }}>Needs {t.permission} — the agent will not run this for you</div>}
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
