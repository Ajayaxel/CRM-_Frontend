'use client';

import { useEffect, useRef, useState } from 'react';
import { X, Loader2 } from 'lucide-react';

const isHls = (url: string) => /\.m3u8(\?|$)/i.test(url);

// Streams HLS recordings in ~4s chunks with adaptive bitrate (hls.js), so the
// viewer only downloads the resolution/segments they need. Falls back to a
// native <video> for plain MP4.
export function RecordingPlayer({ url, title, accent, onClose }: { url: string; title: string; accent: string; onClose: () => void }) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [levels, setLevels] = useState<{ height: number; index: number }[]>([]);
  const [current, setCurrent] = useState(-1); // -1 = Auto
  const [loading, setLoading] = useState(true);
  const hlsRef = useRef<any>(null);

  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;
    let disposed = false;

    (async () => {
      if (isHls(url)) {
        const Hls = (await import('hls.js')).default;
        if (disposed) return;
        // Prefer hls.js (reliable MSE playback in Chrome/Firefox/Edge); fall back
        // to native HLS only where hls.js can't run (Safari / iOS).
        if (Hls.isSupported()) {
          const hls = new Hls({ capLevelToPlayerSize: true });
          hlsRef.current = hls;
          hls.loadSource(url);
          hls.attachMedia(video);
          hls.on(Hls.Events.MANIFEST_PARSED, (_e: any, data: any) => {
            setLevels(data.levels.map((l: any, index: number) => ({ height: l.height, index })).sort((a: any, b: any) => b.height - a.height));
            setLoading(false);
          });
          hls.on(Hls.Events.ERROR, (_e: any, data: any) => { if (data.fatal) setLoading(false); });
        } else if (video.canPlayType('application/vnd.apple.mpegurl')) {
          video.src = url; setLoading(false);
        } else { video.src = url; setLoading(false); }
      } else {
        video.src = url; setLoading(false);
      }
    })();

    return () => { disposed = true; try { hlsRef.current?.destroy(); } catch { /* noop */ } };
  }, [url]);

  const setQuality = (idx: number) => { setCurrent(idx); if (hlsRef.current) hlsRef.current.currentLevel = idx; };

  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 90, background: '#0b0b10', display: 'flex', flexDirection: 'column' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 14px', background: '#14141c', color: '#fff', flex: '0 0 auto' }}>
        <div style={{ flex: 1, minWidth: 0, fontWeight: 700, fontSize: 14, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{title}</div>
        {levels.length > 0 && (
          <select value={current} onChange={(e) => setQuality(Number(e.target.value))} style={{ background: 'rgba(255,255,255,.1)', color: '#fff', border: 'none', borderRadius: 8, padding: '6px 10px', fontSize: 12.5, cursor: 'pointer' }}>
            <option value={-1}>Auto</option>
            {levels.map((l) => <option key={l.index} value={l.index}>{l.height}p</option>)}
          </select>
        )}
        <button onClick={onClose} style={{ background: 'rgba(255,255,255,.1)', border: 'none', color: '#fff', cursor: 'pointer', borderRadius: 8, padding: '7px 12px', fontSize: 13, fontWeight: 600, display: 'inline-flex', alignItems: 'center', gap: 6 }}><X size={15} /> Close</button>
      </div>
      <div style={{ flex: 1, position: 'relative', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <video ref={videoRef} controls autoPlay playsInline style={{ maxWidth: '100%', maxHeight: '100%', width: '100%', height: '100%', objectFit: 'contain', background: '#000' }} />
        {loading && <div style={{ position: 'absolute', display: 'flex', alignItems: 'center', gap: 8, color: '#c9cdd6' }}><Loader2 size={22} className="spin" /> <span style={{ fontSize: 13 }}>Loading video…</span></div>}
      </div>
    </div>
  );
}
