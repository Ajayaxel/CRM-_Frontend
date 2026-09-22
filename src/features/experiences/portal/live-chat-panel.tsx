'use client';

import { useEffect, useRef, useState } from 'react';
import { io, Socket } from 'socket.io-client';
import { Send, MessagesSquare } from 'lucide-react';
import { getPortalSession, portalApi } from './portal-client';

const apiOrigin = () => (process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4400/api').replace(/\/api\/?$/, '');

interface ChatMsg { name: string; moderator?: boolean; body: string; at: string }

// Live-class chat (spec §6.3) over OUR signaling gateway — one realtime layer.
// History loads from the lecture's persisted LIVE thread, live messages arrive
// over the socket, and everything sent is persisted server-side so the class
// chat survives the class.
export function LiveChatPanel({ lectureId, displayName, accent, externalSocket }: { lectureId: string; displayName: string; accent: string; externalSocket?: Socket | null }) {
  const [msgs, setMsgs] = useState<ChatMsg[]>([]);
  const [text, setText] = useState('');
  const socketRef = useRef<Socket | null>(null);
  const bottomRef = useRef<HTMLDivElement>(null);
  const room = `bmn-${lectureId}`;

  useEffect(() => {
    portalApi<any>(`/portal/me/live/${lectureId}/chat`).then((t) => {
      setMsgs((t.posts ?? []).map((p: any) => ({ name: p.authorName, moderator: p.authorType === 'LECTURER', body: p.body, at: p.createdAt })));
    }).catch(() => {});
    const onChat = (m: ChatMsg) => setMsgs((prev) => [...prev, m]);
    if (externalSocket) {
      // Reuse the room's existing signaling socket (already joined) — no extra presence slot.
      socketRef.current = externalSocket;
      externalSocket.on('chat', onChat);
      return () => { externalSocket.off('chat', onChat); };
    }
    const token = getPortalSession()?.token;
    const socket = io(`${apiOrigin()}/live`, { auth: { token, name: displayName }, reconnection: true });
    socketRef.current = socket;
    socket.on('connect', () => socket.emit('join', { room }));
    socket.on('chat', onChat);
    return () => { socket.emit('leave', { room }); socket.disconnect(); };
  }, [lectureId, externalSocket]);

  useEffect(() => { bottomRef.current?.scrollIntoView({ behavior: 'smooth' }); }, [msgs.length]);

  const send = () => {
    const body = text.trim();
    if (!body) return;
    socketRef.current?.emit('chat', { room, body });
    setText('');
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', minHeight: 0 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '10px 12px', fontSize: 12.5, fontWeight: 700, color: '#e7e9ee', borderBottom: '1px solid rgba(255,255,255,.07)', flex: '0 0 auto' }}>
        <MessagesSquare size={14} /> Class chat
      </div>
      <div style={{ flex: 1, overflowY: 'auto', padding: 10 }}>
        {msgs.length === 0 && <div style={{ color: '#8b90a0', fontSize: 12, textAlign: 'center', padding: 14 }}>Say hello — messages are saved to the class thread.</div>}
        {msgs.map((m, i) => (
          <div key={i} style={{ marginBottom: 8 }}>
            <span style={{ fontSize: 11.5, fontWeight: 700, color: m.moderator ? accent : '#c9cdd6' }}>{m.name}{m.moderator ? ' · Lecturer' : ''}</span>
            <div style={{ fontSize: 12.5, color: '#e7e9ee', whiteSpace: 'pre-wrap' }}>{m.body}</div>
          </div>
        ))}
        <div ref={bottomRef} />
      </div>
      <div style={{ display: 'flex', gap: 6, padding: 10, flex: '0 0 auto', borderTop: '1px solid rgba(255,255,255,.07)' }}>
        <input value={text} onChange={(e) => setText(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && send()} placeholder="Message the class…"
          style={{ flex: 1, background: 'rgba(255,255,255,.07)', border: '1px solid rgba(255,255,255,.12)', borderRadius: 8, color: '#fff', padding: '8px 10px', fontSize: 12.5 }} />
        <button onClick={send} style={{ background: accent, color: '#fff', border: 'none', borderRadius: 8, padding: '0 12px', cursor: 'pointer' }}><Send size={14} /></button>
      </div>
    </div>
  );
}
