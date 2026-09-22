'use client';

import { useEffect, useRef, useState } from 'react';
import { X, Loader2, Radio, ShieldCheck, Lock } from 'lucide-react';
import { portalApi } from './portal-client';
import { NativeLiveRoom } from './native-live-room';
import { NativeSfuRoom } from './native-sfu-room';
import { RecordingPlayer } from './recording-player';

interface RoomInfo { provider?: 'daily' | 'native'; mediaMode?: 'mesh' | 'sfu' | 'watch'; room?: string; roomUrl?: string; url?: string; token?: string; watchUrl?: string; iceServers?: any[]; title: string; subject?: { code: string; name: string }; faculty?: string | null; displayName: string; moderator: boolean; live: boolean; secured?: boolean }

// Live classroom entry point. Default is our own self-hosted WebRTC room
// (mesh or SFU) — no third-party video. Daily.co is an optional managed
// provider (LIVE_PROVIDER=daily); everything else routes to our own room.
export function LiveClassroom({ lectureId, accent, onClose }: { lectureId: string; accent: string; onClose: () => void }) {
  const containerRef = useRef<HTMLDivElement>(null);
  const apiRef = useRef<any>(null);
  const [info, setInfo] = useState<RoomInfo | null>(null);
  const [state, setState] = useState<'loading' | 'ready' | 'error'>('loading');
  const [err, setErr] = useState('');

  useEffect(() => {
    let disposed = false;
    (async () => {
      try {
        const room = await portalApi<RoomInfo>(`/portal/me/live/${lectureId}/room`);
        if (disposed) return;
        setInfo(room);

        // Our own WebRTC classroom (mesh or SFU) — handled in render.
        if (room.provider === 'native') { setState('ready'); return; }

        // Daily.co — optional managed provider (private, token-gated rooms).
        if (room.provider === 'daily' && room.roomUrl) {
          const DailyIframe = (await import('@daily-co/daily-js')).default;
          if (disposed || !containerRef.current) return;
          const frame = DailyIframe.createFrame(containerRef.current, {
            iframeStyle: { position: 'absolute', top: '0', left: '0', width: '100%', height: '100%', border: '0' },
            showLeaveButton: true, showFullscreenButton: true,
          });
          apiRef.current = { dispose: () => frame.destroy() };
          frame.on('left-meeting', () => onClose());
          if (!room.moderator) frame.on('joined-meeting', () => { portalApi(`/portal/me/live/${lectureId}/attended`, { method: 'POST' }).catch(() => {}); });
          await frame.join({ url: room.roomUrl, ...(room.token ? { token: room.token } : {}) });
          setState('ready');
          return;
        }

        // Any other shape falls through to our own room.
        setState('ready');
      } catch (e: any) {
        if (!disposed) { setErr(e?.message || 'Could not join the class'); setState('error'); }
      }
    })();
    return () => { disposed = true; try { apiRef.current?.dispose(); } catch { /* noop */ } };
  }, [lectureId]);

  // Our own WebRTC classroom renders its own full-screen room.
  if (info?.provider === 'native') {
    if (info.mediaMode === 'watch' && info.watchUrl) return <RecordingPlayer url={info.watchUrl} title={`🔴 LIVE · ${info.title}`} accent={accent} onClose={onClose} />;
    return info.mediaMode === 'sfu'
      ? <NativeSfuRoom info={info as any} lectureId={lectureId} accent={accent} onClose={onClose} />
      : <NativeLiveRoom info={info as any} accent={accent} onClose={onClose} />;
  }

  // Daily.co iframe host.
  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 90, background: '#0b0b10', display: 'flex', flexDirection: 'column' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 14px', background: '#14141c', color: '#fff', flex: '0 0 auto' }}>
        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 12, fontWeight: 800, color: '#ff5a5f' }}><Radio size={14} /> LIVE</span>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontWeight: 700, fontSize: 14, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{info?.title ?? 'Live class'}</div>
          <div style={{ fontSize: 11.5, color: '#9aa0ad' }}>{info?.subject ? `${info.subject.code} · ${info.subject.name}` : ''}{info?.faculty ? ` · ${info.faculty}` : ''}</div>
        </div>
        {info?.secured && <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, fontSize: 11, color: '#9ae6b4', background: 'rgba(46,160,90,.16)', borderRadius: 99, padding: '3px 10px' }} title="Private, token-gated room"><Lock size={11} /> Secured</span>}
        {info?.moderator && <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, fontSize: 11, color: '#c9cdd6', background: 'rgba(255,255,255,.08)', borderRadius: 99, padding: '3px 10px' }}><ShieldCheck size={12} /> Host</span>}
        <button onClick={onClose} style={{ background: 'rgba(255,255,255,.1)', border: 'none', color: '#fff', cursor: 'pointer', borderRadius: 8, padding: '7px 12px', fontSize: 13, fontWeight: 600, display: 'inline-flex', alignItems: 'center', gap: 6 }}><X size={15} /> Leave</button>
      </div>
      <div style={{ flex: 1, position: 'relative' }}>
        <div ref={containerRef} style={{ position: 'absolute', inset: 0 }} />
        {state !== 'ready' && (
          <div style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 10, color: '#c9cdd6' }}>
            {state === 'loading' ? <><Loader2 size={26} className="spin" /><span style={{ fontSize: 13.5 }}>Connecting to the classroom…</span></>
              : <><span style={{ fontSize: 30 }}>📵</span><span style={{ fontSize: 14, fontWeight: 600, color: '#fff' }}>{err}</span><button onClick={onClose} style={{ marginTop: 6, background: accent, border: 'none', color: '#fff', borderRadius: 8, padding: '8px 16px', cursor: 'pointer', fontSize: 13 }}>Close</button></>}
          </div>
        )}
      </div>
    </div>
  );
}
