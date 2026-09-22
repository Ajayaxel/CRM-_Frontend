'use client';

import { useEffect, useState } from 'react';
import { LiveKitRoom, VideoConference, useDataChannel, useLocalParticipant } from '@livekit/components-react';
import '@livekit/components-styles';
import { toast } from 'sonner';
import { Hand, Radio, ShieldCheck, X, Check } from 'lucide-react';
import { portalApi } from './portal-client';
import { LiveChatPanel } from './live-chat-panel';

interface SfuInfo { url: string; token: string; title: string; subject?: { code: string; name: string }; faculty?: string | null; moderator: boolean }

// Class-scale room via our self-hosted LiveKit SFU. Simulcast + adaptive stream +
// dynacast keep egress sane; students join receive-only and raise a hand to speak.
export function NativeSfuRoom({ info, lectureId, accent, onClose }: { info: SfuInfo; lectureId: string; accent: string; onClose: () => void }) {
  const [chatOpen, setChatOpen] = useState(true);
  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 90, background: '#0b0b10', display: 'flex', flexDirection: 'column' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 14px', background: '#14141c', color: '#fff', flex: '0 0 auto' }}>
        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 12, fontWeight: 800, color: '#ff5a5f' }}><Radio size={14} /> LIVE</span>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontWeight: 700, fontSize: 14, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{info.title}</div>
          <div style={{ fontSize: 11.5, color: '#9aa0ad' }}>{info.subject ? `${info.subject.code} · ${info.subject.name}` : ''}{info.faculty ? ` · ${info.faculty}` : ''} · Self-hosted SFU</div>
        </div>
        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, fontSize: 11, color: '#9ae6b4', background: 'rgba(46,160,90,.16)', borderRadius: 99, padding: '3px 10px' }}><ShieldCheck size={11} /> Own SFU</span>
        <button onClick={() => setChatOpen((v) => !v)} style={{ background: 'rgba(255,255,255,.1)', border: 'none', color: '#fff', cursor: 'pointer', borderRadius: 8, padding: '7px 12px', fontSize: 13, fontWeight: 600 }}>{chatOpen ? 'Hide chat' : 'Chat'}</button>
        <button onClick={onClose} style={{ background: 'rgba(255,255,255,.1)', border: 'none', color: '#fff', cursor: 'pointer', borderRadius: 8, padding: '7px 12px', fontSize: 13, fontWeight: 600, display: 'inline-flex', alignItems: 'center', gap: 6 }}><X size={15} /> Leave</button>
      </div>
      <div style={{ flex: 1, display: 'flex', minHeight: 0 }}>
      <div style={{ flex: 1, position: 'relative' }} data-lk-theme="default">
        <LiveKitRoom
          serverUrl={info.url}
          token={info.token}
          connect
          audio={info.moderator}
          video={info.moderator}
          onDisconnected={onClose}
          options={{ adaptiveStream: true, dynacast: true, publishDefaults: { simulcast: true } }}
          style={{ height: '100%' }}
        >
          <VideoConference />
          <StageControls lectureId={lectureId} moderator={info.moderator} accent={accent} />
        </LiveKitRoom>
      </div>
      {chatOpen && (
        <div style={{ width: 300, flex: '0 0 300px', background: '#14141c', borderLeft: '1px solid rgba(255,255,255,.07)', display: 'flex', flexDirection: 'column', minHeight: 0 }}>
          <LiveChatPanel lectureId={lectureId} displayName={info.moderator ? (info.faculty ?? 'Lecturer') : 'Student'} accent={accent} />
        </div>
      )}
      </div>
    </div>
  );
}

// Raise-hand (students) + promote/demote (lecturer), coordinated over LiveKit data.
function StageControls({ lectureId, moderator, accent }: { lectureId: string; moderator: boolean; accent: string }) {
  const { localParticipant } = useLocalParticipant();
  const { message, send } = useDataChannel('stage');
  const [raised, setRaised] = useState(false);
  const [requests, setRequests] = useState<{ identity: string; name: string }[]>([]);
  const [busy, setBusy] = useState<string | null>(null);
  const enc = (o: any) => new TextEncoder().encode(JSON.stringify(o));

  useEffect(() => {
    if (!message || !moderator) return;
    try {
      const d = JSON.parse(new TextDecoder().decode(message.payload));
      const identity = message.from?.identity || d.identity;
      if (!identity) return;
      if (d.type === 'raise') setRequests((r) => (r.some((x) => x.identity === identity) ? r : [...r, { identity, name: d.name || message.from?.name || 'Student' }]));
      if (d.type === 'lower') setRequests((r) => r.filter((x) => x.identity !== identity));
    } catch { /* ignore */ }
  }, [message, moderator]);

  const canPublish = !!localParticipant?.permissions?.canPublish;

  const raiseHand = () => {
    const next = !raised; setRaised(next);
    send(enc({ type: next ? 'raise' : 'lower', name: localParticipant?.name || 'Student' }), { reliable: true });
  };
  const promote = async (identity: string) => {
    setBusy(identity);
    try { await portalApi(`/portal/me/live/${lectureId}/promote`, { method: 'POST', body: JSON.stringify({ identity, canPublish: true }) }); setRequests((r) => r.filter((x) => x.identity !== identity)); toast.success('Promoted to the stage'); }
    catch (e: any) { toast.error(e?.message || 'Could not promote'); } finally { setBusy(null); }
  };

  // Lecturer: pending-requests panel.
  if (moderator) {
    if (requests.length === 0) return null;
    return (
      <div style={{ position: 'absolute', top: 12, right: 12, zIndex: 5, width: 260, background: '#14141c', border: '1px solid rgba(255,255,255,.1)', borderRadius: 12, padding: 12, color: '#fff' }}>
        <div style={{ fontSize: 12, fontWeight: 700, marginBottom: 8, display: 'flex', alignItems: 'center', gap: 6 }}><Hand size={14} style={{ color: '#f5c451' }} /> Raised hands ({requests.length})</div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          {requests.map((r) => (
            <div key={r.identity} style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13 }}>
              <span style={{ flex: 1, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{r.name}</span>
              <button onClick={() => promote(r.identity)} disabled={busy === r.identity} style={{ background: accent, border: 'none', color: '#fff', borderRadius: 7, padding: '4px 10px', fontSize: 12, fontWeight: 600, cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: 4 }}><Check size={12} /> Let speak</button>
            </div>
          ))}
        </div>
      </div>
    );
  }

  // Student: raise-hand button (hidden once promoted).
  if (canPublish) return null;
  return (
    <button onClick={raiseHand} style={{ position: 'absolute', bottom: 88, right: 16, zIndex: 5, display: 'inline-flex', alignItems: 'center', gap: 6, border: 'none', cursor: 'pointer', borderRadius: 99, padding: '10px 16px', fontSize: 13, fontWeight: 700, background: raised ? '#f5c451' : 'rgba(255,255,255,.14)', color: raised ? '#1a1a1a' : '#fff' }}>
      <Hand size={16} /> {raised ? 'Hand raised — waiting' : 'Raise hand'}
    </button>
  );
}
