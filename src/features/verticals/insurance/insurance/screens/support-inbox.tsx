'use client';

import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { api, apiErrorMessage } from '@/lib/api';

const card: React.CSSProperties = { background: 'var(--surface)', border: '1px solid var(--line-soft)', borderRadius: 14, padding: 16 };
const chip = (fg: string, bg: string): React.CSSProperties => ({ fontFamily: 'var(--mono)', fontSize: 10.5, padding: '3px 8px', borderRadius: 7, color: fg, background: bg });

/** Requests raised by customers from the self-service portal. */
export function SupportInbox() {
  const qc = useQueryClient();
  const { data: tickets } = useQuery({ queryKey: ['ins-support'], queryFn: async () => (await api.get<any[]>('/insurance/support-tickets')).data });
  const [replies, setReplies] = useState<Record<string, string>>({});
  const respond = useMutation({
    mutationFn: ({ id, reply, status }: { id: string; reply?: string; status?: string }) => api.patch(`/insurance/support-tickets/${id}`, { reply, status }),
    onSuccess: () => { toast.success('Updated'); qc.invalidateQueries({ queryKey: ['ins-support'] }); },
    onError: (e) => toast.error(apiErrorMessage(e)),
  });
  const open = (tickets ?? []).filter((t) => t.status !== 'RESOLVED');
  if (!tickets || tickets.length === 0) return null;
  return (
    <div style={card}>
      <div style={{ fontWeight: 700, fontSize: 13.5, marginBottom: 10 }}>Portal support requests {open.length > 0 && <span style={chip('#9a6a00', '#fff7e6')}>{open.length} open</span>}</div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        {tickets.slice(0, 8).map((t) => (
          <div key={t.id} style={{ background: 'var(--surface-2)', borderRadius: 10, padding: '10px 12px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap', fontSize: 13 }}>
              <span style={{ fontWeight: 700, flex: 1, minWidth: 160 }}>{t.subject}</span>
              <span style={{ color: 'var(--ink-3)', fontSize: 12 }}>{t.client?.name ?? ''}{t.client?.phone ? ` · ${t.client.phone}` : ''}</span>
              {t.callback && <span style={chip('#1a56db', '#e8f0fe')}>Callback</span>}
              <span style={chip(t.status === 'RESOLVED' ? '#177245' : t.status === 'IN_PROGRESS' ? '#1a56db' : '#9a6a00', t.status === 'RESOLVED' ? '#e7f6ec' : t.status === 'IN_PROGRESS' ? '#e8f0fe' : '#fff7e6')}>{t.status.replace('_', ' ')}</span>
            </div>
            {t.detail && <div style={{ fontSize: 12, color: 'var(--ink-3)', marginTop: 4 }}>{t.detail}</div>}
            {t.reply && <div style={{ fontSize: 12.5, marginTop: 6 }}><b>Replied:</b> {t.reply}</div>}
            {t.status !== 'RESOLVED' && (
              <div style={{ display: 'flex', gap: 7, marginTop: 8, flexWrap: 'wrap' }}>
                <input className="input" style={{ height: 30, flex: 1, minWidth: 200 }} placeholder="Reply to the customer…" value={replies[t.id] ?? ''} onChange={(e) => setReplies({ ...replies, [t.id]: e.target.value })} />
                <button className="btn-secondary" style={{ height: 30 }} disabled={respond.isPending || !(replies[t.id] ?? '').trim()} onClick={() => respond.mutate({ id: t.id, reply: replies[t.id] })}>Reply</button>
                <button className="btn-secondary" style={{ height: 30 }} disabled={respond.isPending} onClick={() => respond.mutate({ id: t.id, reply: replies[t.id]?.trim() || undefined, status: 'RESOLVED' })}>Resolve</button>
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
