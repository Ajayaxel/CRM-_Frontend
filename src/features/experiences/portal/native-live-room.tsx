'use client';

import { useEffect, useRef, useState } from 'react';
import { io, Socket } from 'socket.io-client';
import { Mic, MicOff, Video as VideoIcon, VideoOff, PhoneOff, Radio, ShieldCheck, Loader2 } from 'lucide-react';
import { getPortalSession } from './portal-client';
import { LiveChatPanel } from './live-chat-panel';

interface NativeInfo { room: string; iceServers: any[]; title: string; subject?: { code: string; name: string }; faculty?: string | null; displayName: string; moderator: boolean }

const apiOrigin = () => (process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4400/api').replace(/\/api\/?$/, '');

// Our own WebRTC classroom: browser peer connections coordinated by our
// signaling gateway (no third-party media service). Mesh topology — best for
// small rooms (seminars / office hours / PTM).
export function NativeLiveRoom({ info, accent, onClose }: { info: NativeInfo; accent: string; onClose: () => void }) {
  const localRef = useRef<HTMLVideoElement>(null);
  const socketRef = useRef<Socket | null>(null);
  const pcs = useRef<Map<string, RTCPeerConnection>>(new Map());
  const localStream = useRef<MediaStream | null>(null);
  const [remotes, setRemotes] = useState<{ id: string; name: string; stream: MediaStream }[]>([]);
  const [state, setState] = useState<'init' | 'ready' | 'error'>('init');
  const [err, setErr] = useState('');
  const [micOn, setMicOn] = useState(true);
  const [camOn, setCamOn] = useState(true);
  const [chatSocket, setChatSocket] = useState<Socket | null>(null);

  useEffect(() => {
    let disposed = false;
    const addRemote = (id: string, name: string, stream: MediaStream) =>
      setRemotes((r) => (r.some((x) => x.id === id) ? r.map((x) => (x.id === id ? { ...x, stream } : x)) : [...r, { id, name, stream }]));
    const dropRemote = (id: string) => setRemotes((r) => r.filter((x) => x.id !== id));

    const newPc = (peerId: string, name: string, socket: Socket) => {
      const pc = new RTCPeerConnection({ iceServers: info.iceServers });
      localStream.current?.getTracks().forEach((t) => pc.addTrack(t, localStream.current!));
      pc.onicecandidate = (e) => e.candidate && socket.emit('signal', { to: peerId, data: { candidate: e.candidate } });
      pc.ontrack = (e) => addRemote(peerId, name, e.streams[0]);
      pc.onconnectionstatechange = () => { if (['failed', 'closed', 'disconnected'].includes(pc.connectionState)) dropRemote(peerId); };
      pcs.current.set(peerId, pc);
      return pc;
    };

    (async () => {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
        if (disposed) { stream.getTracks().forEach((t) => t.stop()); return; }
        localStream.current = stream;
        if (localRef.current) localRef.current.srcObject = stream;

        const token = getPortalSession()?.token;
        const socket = io(`${apiOrigin()}/live`, { auth: { token, name: info.displayName }, reconnection: true });
        socketRef.current = socket;
        setChatSocket(socket);

        socket.on('connect', () => socket.emit('join', { room: info.room }, (ack: any) => {
          // §9 — plan concurrency cap: the gateway can reject the join.
          if (ack?.error) { setErr(ack.error); setState('error'); socket.disconnect(); }
        }));
        setState('ready');

        // I'm the newcomer → initiate an offer to each existing peer.
        socket.on('peers', async (existing: { socketId: string; name: string }[]) => {
          for (const p of existing) {
            const pc = newPc(p.socketId, p.name, socket);
            const offer = await pc.createOffer();
            await pc.setLocalDescription(offer);
            socket.emit('signal', { to: p.socketId, data: { sdp: pc.localDescription } });
          }
        });
        // A newcomer joined → wait for their offer (create the pc lazily on signal).
        socket.on('peer-joined', (p: { socketId: string; name: string }) => { if (!pcs.current.has(p.socketId)) newPc(p.socketId, p.name, socket); });
        socket.on('peer-left', ({ socketId }: { socketId: string }) => { pcs.current.get(socketId)?.close(); pcs.current.delete(socketId); dropRemote(socketId); });

        socket.on('signal', async ({ from, data }: { from: string; data: any }) => {
          let pc = pcs.current.get(from);
          if (!pc) pc = newPc(from, 'Guest', socket);
          if (data.sdp) {
            await pc.setRemoteDescription(new RTCSessionDescription(data.sdp));
            if (data.sdp.type === 'offer') { const ans = await pc.createAnswer(); await pc.setLocalDescription(ans); socket.emit('signal', { to: from, data: { sdp: pc.localDescription } }); }
          } else if (data.candidate) {
            try { await pc.addIceCandidate(new RTCIceCandidate(data.candidate)); } catch { /* ignore */ }
          }
        });
      } catch (e: any) {
        if (!disposed) { setErr(e?.name === 'NotAllowedError' ? 'Camera/microphone permission denied' : (e?.message || 'Could not start the class')); setState('error'); }
      }
    })();

    return () => {
      disposed = true;
      socketRef.current?.emit('leave', { room: info.room });
      socketRef.current?.disconnect();
      pcs.current.forEach((pc) => pc.close()); pcs.current.clear();
      localStream.current?.getTracks().forEach((t) => t.stop());
    };
  }, [info.room]);

  const toggleMic = () => { const on = !micOn; localStream.current?.getAudioTracks().forEach((t) => (t.enabled = on)); setMicOn(on); };
  const toggleCam = () => { const on = !camOn; localStream.current?.getVideoTracks().forEach((t) => (t.enabled = on)); setCamOn(on); };

  const tiles = remotes.length + 1;
  const cols = tiles <= 1 ? 1 : tiles <= 4 ? 2 : 3;

  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 90, background: '#0b0b10', display: 'flex', flexDirection: 'column' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 14px', background: '#14141c', color: '#fff', flex: '0 0 auto' }}>
        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 12, fontWeight: 800, color: '#ff5a5f' }}><Radio size={14} /> LIVE</span>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontWeight: 700, fontSize: 14, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{info.title}</div>
          <div style={{ fontSize: 11.5, color: '#9aa0ad' }}>{info.subject ? `${info.subject.code} · ${info.subject.name}` : ''}{info.faculty ? ` · ${info.faculty}` : ''} · Self-hosted</div>
        </div>
        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, fontSize: 11, color: '#9ae6b4', background: 'rgba(46,160,90,.16)', borderRadius: 99, padding: '3px 10px' }}><ShieldCheck size={11} /> Own server</span>
      </div>

      <div style={{ flex: 1, display: 'flex', minHeight: 0 }}>
      <div style={{ flex: 1, position: 'relative', padding: 12, overflow: 'auto' }}>
        {state === 'error' ? (
          <div style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 10, color: '#c9cdd6' }}>
            <span style={{ fontSize: 30 }}>🎥</span><span style={{ fontSize: 14, fontWeight: 600, color: '#fff' }}>{err}</span>
            <button onClick={onClose} style={{ marginTop: 6, background: accent, border: 'none', color: '#fff', borderRadius: 8, padding: '8px 16px', cursor: 'pointer', fontSize: 13 }}>Close</button>
          </div>
        ) : (
          <div style={{ display: 'grid', gridTemplateColumns: `repeat(${cols}, 1fr)`, gap: 10, height: '100%' }}>
            <Tile label={`${info.displayName} (you)`} muted stream={null} videoRef={localRef} camOn={camOn} />
            {remotes.map((r) => <Tile key={r.id} label={r.name} stream={r.stream} camOn />)}
            {remotes.length === 0 && <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#6b7180', fontSize: 13, gridColumn: cols > 1 ? 'span 1' : 'auto' }}><Loader2 size={16} className="spin" style={{ marginRight: 8 }} /> Waiting for others to join…</div>}
          </div>
        )}
      </div>

      <div style={{ width: 300, flex: '0 0 300px', background: '#14141c', borderLeft: '1px solid rgba(255,255,255,.07)', display: 'flex', flexDirection: 'column', minHeight: 0 }}>
        <LiveChatPanel lectureId={info.room.replace(/^bmn-/, '')} displayName={info.displayName} accent={accent} externalSocket={chatSocket} />
      </div>
      </div>

      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10, padding: '12px 14px', background: '#14141c', flex: '0 0 auto' }}>
        <button onClick={toggleMic} title="Mic" style={ctrl(micOn)}>{micOn ? <Mic size={18} /> : <MicOff size={18} />}</button>
        <button onClick={toggleCam} title="Camera" style={ctrl(camOn)}>{camOn ? <VideoIcon size={18} /> : <VideoOff size={18} />}</button>
        <button onClick={onClose} title="Leave" style={{ ...ctrl(true), background: '#e11d48', width: 'auto', padding: '0 18px', gap: 6, fontSize: 13, fontWeight: 600 }}><PhoneOff size={17} /> Leave</button>
      </div>
    </div>
  );
}

function ctrl(on: boolean): React.CSSProperties {
  return { width: 46, height: 46, borderRadius: 12, border: 'none', cursor: 'pointer', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', color: '#fff', background: on ? 'rgba(255,255,255,.14)' : '#4b5563' };
}

function Tile({ label, stream, muted, camOn, videoRef }: { label: string; stream: MediaStream | null; muted?: boolean; camOn: boolean; videoRef?: React.RefObject<HTMLVideoElement | null> }) {
  const ref = useRef<HTMLVideoElement>(null);
  useEffect(() => { const v = videoRef?.current ?? ref.current; if (v && stream) v.srcObject = stream; }, [stream, videoRef]);
  return (
    <div style={{ position: 'relative', background: '#1b1b24', borderRadius: 12, overflow: 'hidden', minHeight: 160, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <video ref={videoRef ?? ref} autoPlay playsInline muted={muted} style={{ width: '100%', height: '100%', objectFit: 'cover', display: camOn ? 'block' : 'none' }} />
      {!camOn && <div style={{ width: 64, height: 64, borderRadius: '50%', background: '#374151', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 800, fontSize: 22 }}>{label.slice(0, 1).toUpperCase()}</div>}
      <div style={{ position: 'absolute', left: 8, bottom: 8, fontSize: 11.5, color: '#fff', background: 'rgba(0,0,0,.5)', borderRadius: 6, padding: '2px 8px' }}>{label}</div>
    </div>
  );
}
