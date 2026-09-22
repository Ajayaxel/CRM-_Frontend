'use client';

import { useEffect, useRef, useState } from 'react';
import { X, Loader2, StickyNote, MessagesSquare, Plus, ThumbsUp, CheckCircle2, Pin, Send, Trash2, Bookmark, Captions } from 'lucide-react';
import { toast } from 'sonner';
import { portalApi } from './portal-client';

const isHls = (url: string) => /\.m3u8(\?|$)/i.test(url);
const fmtTs = (s: number) => `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, '0')}`;

export interface LearnItem {
  id: string; title: string; type: string; url: string;
  mediaAsset?: { hlsManifestUrl?: string | null; originalUrl?: string | null; thumbnailUrl?: string | null; durationSec?: number | null; captionsUrl?: string | null } | null;
}

// Parse WebVTT text into timed cues for the interactive transcript.
function parseVtt(raw: string): { start: number; text: string }[] {
  const toSec = (ts: string) => { const p = ts.trim().split(':').map(Number); return p.length === 3 ? p[0] * 3600 + p[1] * 60 + p[2] : p.length === 2 ? p[0] * 60 + p[1] : Number(ts) || 0; };
  const cues: { start: number; text: string }[] = [];
  for (const block of raw.replace(/\r/g, '').split('\n\n')) {
    const lines = block.split('\n').filter(Boolean);
    const tline = lines.find((l) => l.includes('-->'));
    if (!tline) continue;
    const text = lines.slice(lines.indexOf(tline) + 1).join(' ').trim();
    if (text) cues.push({ start: toSec(tline.split('-->')[0].trim().split(' ')[0]), text });
  }
  return cues;
}

// The learning surface (spec §4): first-party player with resume, speed,
// quality — plus timestamped notes, bookmarks and lecture-anchored discussion
// beside the video. Students get notes/progress; lecturers get moderation.
export function LearnPlayer({ item, accent, isStudent, onClose }: { item: LearnItem; accent: string; isStudent: boolean; onClose: () => void }) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const hlsRef = useRef<any>(null);
  const [loading, setLoading] = useState(true);
  const [levels, setLevels] = useState<{ height: number; index: number }[]>([]);
  const [quality, setQuality] = useState(-1);
  const [speed, setSpeed] = useState(1);
  const hasCaptions = !!item.mediaAsset?.captionsUrl;
  const [tab, setTab] = useState<'notes' | 'discuss' | 'transcript'>(isStudent ? 'notes' : 'discuss');
  const url = item.mediaAsset?.hlsManifestUrl || item.url;
  const lastBeat = useRef(0);

  // ---- player ----
  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;
    let disposed = false;
    (async () => {
      if (isHls(url)) {
        const Hls = (await import('hls.js')).default;
        if (disposed) return;
        if (Hls.isSupported()) {
          const hls = new Hls({ capLevelToPlayerSize: true });
          hlsRef.current = hls;
          hls.loadSource(url); hls.attachMedia(video);
          hls.on(Hls.Events.MANIFEST_PARSED, (_e: any, d: any) => { setLevels(d.levels.map((l: any, index: number) => ({ height: l.height, index })).sort((a: any, b: any) => b.height - a.height)); setLoading(false); });
          hls.on(Hls.Events.ERROR, (_e: any, d: any) => { if (d.fatal) setLoading(false); });
        } else { video.src = url; setLoading(false); }
      } else { video.src = url; setLoading(false); }
    })();
    return () => { disposed = true; try { hlsRef.current?.destroy(); } catch { /* noop */ } };
  }, [url]);

  // ---- resume + heartbeat (students) ----
  useEffect(() => {
    if (!isStudent) return;
    const video = videoRef.current;
    if (!video) return;
    let resumed = false;
    portalApi<any>(`/portal/me/items/${item.id}/learning`).then((d) => {
      if (!resumed && d.progress?.lastPositionSec > 2 && video.duration !== undefined) {
        video.currentTime = d.progress.lastPositionSec;
        toast.message(`Resumed at ${fmtTs(d.progress.lastPositionSec)}`);
      }
      resumed = true;
    }).catch(() => {});
    const beat = setInterval(() => {
      if (video.paused || !video.duration) return;
      const pos = Math.floor(video.currentTime);
      const delta = Math.min(15, Math.max(0, pos - lastBeat.current === 0 ? 10 : 10));
      lastBeat.current = pos;
      const completed = video.duration > 0 && video.currentTime / video.duration > 0.9;
      portalApi(`/portal/me/items/${item.id}/progress`, { method: 'POST', body: JSON.stringify({ positionSec: pos, deltaSec: delta, completed }) }).catch(() => {});
    }, 10000);
    return () => clearInterval(beat);
  }, [item.id, isStudent]);

  const seekTo = (s: number) => { const v = videoRef.current; if (v) { v.currentTime = s; v.play().catch(() => {}); } };
  const setQ = (i: number) => { setQuality(i); if (hlsRef.current) hlsRef.current.currentLevel = i; };
  const setRate = (r: number) => { setSpeed(r); if (videoRef.current) videoRef.current.playbackRate = r; };
  const now = () => Math.floor(videoRef.current?.currentTime ?? 0);

  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 90, background: '#0b0b10', display: 'flex', flexDirection: 'column' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 14px', background: '#14141c', color: '#fff', flex: '0 0 auto' }}>
        <div style={{ flex: 1, minWidth: 0, fontWeight: 700, fontSize: 14, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{item.title}</div>
        <select value={speed} onChange={(e) => setRate(Number(e.target.value))} style={sel}>{[0.5, 0.75, 1, 1.25, 1.5, 2].map((r) => <option key={r} value={r}>{r}×</option>)}</select>
        {levels.length > 0 && (
          <select value={quality} onChange={(e) => setQ(Number(e.target.value))} style={sel}>
            <option value={-1}>Auto</option>
            {levels.map((l) => <option key={l.index} value={l.index}>{l.height}p</option>)}
          </select>
        )}
        <button onClick={onClose} style={{ background: 'rgba(255,255,255,.1)', border: 'none', color: '#fff', cursor: 'pointer', borderRadius: 8, padding: '7px 12px', fontSize: 13, fontWeight: 600, display: 'inline-flex', alignItems: 'center', gap: 6 }}><X size={15} /> Close</button>
      </div>

      <div style={{ flex: 1, display: 'flex', minHeight: 0 }}>
        <div style={{ flex: 1, position: 'relative', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <video ref={videoRef} controls playsInline poster={item.mediaAsset?.thumbnailUrl ?? undefined} crossOrigin="anonymous" style={{ width: '100%', height: '100%', maxHeight: '100%', background: '#000' }}>
            {hasCaptions && <track kind="subtitles" srcLang="en" label="Captions" src={item.mediaAsset!.captionsUrl!} default />}
          </video>
          {loading && <div style={{ position: 'absolute', color: '#c9cdd6', display: 'flex', gap: 8, alignItems: 'center' }}><Loader2 size={20} className="spin" /> Loading…</div>}
        </div>

        {/* Side panel: notes | discussion | transcript */}
        <div style={{ width: 340, flex: '0 0 340px', background: '#14141c', color: '#e7e9ee', display: 'flex', flexDirection: 'column', borderLeft: '1px solid rgba(255,255,255,.07)' }}>
          <div style={{ display: 'flex', flex: '0 0 auto' }}>
            {isStudent && <button onClick={() => setTab('notes')} style={tabBtn(tab === 'notes', accent)}><StickyNote size={14} /> Notes</button>}
            {hasCaptions && <button onClick={() => setTab('transcript')} style={tabBtn(tab === 'transcript', accent)}><Captions size={14} /> Transcript</button>}
            <button onClick={() => setTab('discuss')} style={tabBtn(tab === 'discuss', accent)}><MessagesSquare size={14} /> Discussion</button>
          </div>
          {tab === 'transcript' && hasCaptions ? <TranscriptPanel captionsUrl={item.mediaAsset!.captionsUrl!} accent={accent} videoRef={videoRef} />
            : tab === 'notes' && isStudent ? <NotesPanel itemId={item.id} accent={accent} now={now} seekTo={seekTo} />
            : <DiscussPanel itemId={item.id} accent={accent} isStudent={isStudent} now={now} seekTo={seekTo} />}
        </div>
      </div>
    </div>
  );
}

const sel: React.CSSProperties = { background: 'rgba(255,255,255,.1)', color: '#fff', border: 'none', borderRadius: 8, padding: '6px 8px', fontSize: 12.5 };
const tabBtn = (active: boolean, accent: string): React.CSSProperties => ({ flex: 1, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 6, padding: '10px 0', fontSize: 12.5, fontWeight: 700, cursor: 'pointer', background: 'transparent', color: active ? '#fff' : '#8b90a0', border: 'none', borderBottom: active ? `2px solid ${accent}` : '2px solid transparent' });
const inputStyle: React.CSSProperties = { width: '100%', background: 'rgba(255,255,255,.07)', border: '1px solid rgba(255,255,255,.12)', borderRadius: 8, color: '#fff', padding: '8px 10px', fontSize: 12.5, resize: 'vertical' };

// ---- Timestamped notes + bookmarks ----
function NotesPanel({ itemId, accent, now, seekTo }: { itemId: string; accent: string; now: () => number; seekTo: (s: number) => void }) {
  const [state, setState] = useState<any>(null);
  const [body, setBody] = useState('');
  const load = () => portalApi<any>(`/portal/me/items/${itemId}/learning`).then(setState).catch(() => setState({ notes: [], bookmarks: [] }));
  useEffect(() => { load(); }, [itemId]);

  const addNote = async () => {
    if (!body.trim()) return;
    await portalApi(`/portal/me/items/${itemId}/notes`, { method: 'POST', body: JSON.stringify({ body, timestampSec: now() }) });
    setBody(''); load();
  };
  const addBookmark = async () => {
    await portalApi(`/portal/me/items/${itemId}/bookmarks`, { method: 'POST', body: JSON.stringify({ timestampSec: now(), label: `Moment ${fmtTs(now())}` }) });
    toast.success('Bookmarked'); load();
  };
  const delNote = async (id: string) => { await portalApi(`/portal/me/notes/${id}`, { method: 'DELETE' }); load(); };

  return (
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minHeight: 0 }}>
      <div style={{ padding: 12, flex: '0 0 auto' }}>
        <textarea rows={2} placeholder={`Note at ${fmtTs(now())}…`} value={body} onChange={(e) => setBody(e.target.value)} style={inputStyle} />
        <div style={{ display: 'flex', gap: 6, marginTop: 8 }}>
          <button onClick={addNote} style={{ flex: 1, background: accent, color: '#fff', border: 'none', borderRadius: 8, padding: '8px 0', fontSize: 12.5, fontWeight: 700, cursor: 'pointer', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 6 }}><Plus size={13} /> Note @ {fmtTs(now())}</button>
          <button onClick={addBookmark} title="Bookmark this moment" style={{ background: 'rgba(255,255,255,.1)', color: '#fff', border: 'none', borderRadius: 8, padding: '0 12px', cursor: 'pointer' }}><Bookmark size={14} /></button>
        </div>
      </div>
      <div style={{ flex: 1, overflowY: 'auto', padding: '0 12px 12px' }}>
        {!state ? <div style={{ color: '#8b90a0', fontSize: 12.5, textAlign: 'center', padding: 16 }}><Loader2 size={14} className="spin" /></div> : (
          <>
            {state.bookmarks?.length > 0 && (
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: 10 }}>
                {state.bookmarks.map((b: any) => <button key={b.id} onClick={() => seekTo(b.timestampSec)} style={{ background: 'rgba(255,255,255,.08)', border: 'none', color: '#e7e9ee', borderRadius: 99, padding: '4px 10px', fontSize: 11.5, cursor: 'pointer' }}>🔖 {fmtTs(b.timestampSec)}</button>)}
              </div>
            )}
            {(state.notes ?? []).length === 0 ? <div style={{ color: '#8b90a0', fontSize: 12.5, textAlign: 'center', padding: 12 }}>No notes yet — capture a thought at the exact moment.</div> :
              state.notes.map((n: any) => (
                <div key={n.id} style={{ background: 'rgba(255,255,255,.06)', borderRadius: 10, padding: '8px 10px', marginBottom: 8 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                    {n.timestampSec != null && <button onClick={() => seekTo(n.timestampSec)} style={{ background: 'none', border: 'none', color: accent, fontWeight: 800, fontSize: 12, cursor: 'pointer', padding: 0 }}>{fmtTs(n.timestampSec)}</button>}
                    <span style={{ flex: 1 }} />
                    <button onClick={() => delNote(n.id)} style={{ background: 'none', border: 'none', color: '#8b90a0', cursor: 'pointer', padding: 0 }}><Trash2 size={12} /></button>
                  </div>
                  <div style={{ fontSize: 12.5, marginTop: 3, whiteSpace: 'pre-wrap' }}>{n.body}</div>
                </div>
              ))}
          </>
        )}
      </div>
    </div>
  );
}

// ---- Lecture-anchored discussion ----
function DiscussPanel({ itemId, accent, isStudent, now, seekTo }: { itemId: string; accent: string; isStudent: boolean; now: () => number; seekTo: (s: number) => void }) {
  const [threads, setThreads] = useState<any[] | null>(null);
  const [open, setOpen] = useState<any>(null);
  const [title, setTitle] = useState('');
  const [body, setBody] = useState('');
  const [reply, setReply] = useState('');
  const load = () => portalApi<any[]>(`/portal/me/threads?scope=LECTURE&materialId=${itemId}`).then(setThreads).catch(() => setThreads([]));
  const openThread = (id: string) => portalApi<any>(`/portal/me/threads/${id}`).then(setOpen).catch(() => {});
  useEffect(() => { load(); }, [itemId]);

  const ask = async () => {
    if (!title.trim() || !body.trim()) return;
    await portalApi('/portal/me/threads', { method: 'POST', body: JSON.stringify({ scope: 'LECTURE', materialId: itemId, title, category: 'Doubts', body, timestampAnchorSec: now() }) });
    setTitle(''); setBody(''); load(); toast.success('Question posted');
  };
  const post = async () => {
    if (!reply.trim() || !open) return;
    await portalApi(`/portal/me/threads/${open.id}/posts`, { method: 'POST', body: JSON.stringify({ body: reply }) });
    setReply(''); openThread(open.id);
  };
  const upvote = async (pid: string) => { await portalApi(`/portal/me/posts/${pid}/upvote`, { method: 'POST' }); openThread(open.id); };
  const answer = async (pid: string) => { await portalApi(`/portal/me/posts/${pid}/answer`, { method: 'POST' }); openThread(open.id); toast.success('Marked as the answer'); };

  if (open) return (
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minHeight: 0 }}>
      <div style={{ padding: '10px 12px', flex: '0 0 auto', borderBottom: '1px solid rgba(255,255,255,.07)' }}>
        <button onClick={() => setOpen(null)} style={{ background: 'none', border: 'none', color: '#8b90a0', cursor: 'pointer', fontSize: 12, padding: 0 }}>← All questions</button>
        <div style={{ fontWeight: 700, fontSize: 13, marginTop: 4 }}>{open.title} {open.resolved && <CheckCircle2 size={13} style={{ color: '#3ecf8e', verticalAlign: -2 }} />}</div>
      </div>
      <div style={{ flex: 1, overflowY: 'auto', padding: 12 }}>
        {open.posts.map((p: any) => (
          <div key={p.id} style={{ background: p.isAnswer ? 'rgba(62,207,142,.12)' : 'rgba(255,255,255,.06)', border: p.isAnswer ? '1px solid rgba(62,207,142,.4)' : '1px solid transparent', borderRadius: 10, padding: '8px 10px', marginBottom: 8 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 11.5 }}>
              <b>{p.authorName}</b>
              <span style={{ color: '#8b90a0' }}>{p.authorType === 'LECTURER' ? '· Lecturer' : ''}</span>
              {p.timestampAnchorSec != null && <button onClick={() => seekTo(p.timestampAnchorSec)} style={{ background: 'none', border: 'none', color: accent, fontWeight: 800, cursor: 'pointer', padding: 0, fontSize: 11.5 }}>@ {fmtTs(p.timestampAnchorSec)}</button>}
              {p.isAnswer && <span style={{ color: '#3ecf8e', fontWeight: 700 }}>✓ Answer</span>}
              <span style={{ flex: 1 }} />
              <button onClick={() => upvote(p.id)} style={{ background: 'none', border: 'none', color: '#8b90a0', cursor: 'pointer', display: 'inline-flex', gap: 3, alignItems: 'center', fontSize: 11.5 }}><ThumbsUp size={11} /> {p.upvotes}</button>
              {!isStudent && !p.isAnswer && <button onClick={() => answer(p.id)} title="Mark as answer" style={{ background: 'none', border: 'none', color: '#3ecf8e', cursor: 'pointer', fontSize: 11.5 }}>✓</button>}
            </div>
            <div style={{ fontSize: 12.5, marginTop: 4, whiteSpace: 'pre-wrap' }}>{p.body}</div>
          </div>
        ))}
      </div>
      <div style={{ padding: 12, flex: '0 0 auto', display: 'flex', gap: 6 }}>
        <input placeholder="Reply…" value={reply} onChange={(e) => setReply(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && post()} style={{ ...inputStyle, flex: 1 }} />
        <button onClick={post} style={{ background: accent, color: '#fff', border: 'none', borderRadius: 8, padding: '0 12px', cursor: 'pointer' }}><Send size={14} /></button>
      </div>
    </div>
  );

  return (
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minHeight: 0 }}>
      {isStudent && (
        <div style={{ padding: 12, flex: '0 0 auto', borderBottom: '1px solid rgba(255,255,255,.07)' }}>
          <input placeholder="Question title…" value={title} onChange={(e) => setTitle(e.target.value)} style={{ ...inputStyle, marginBottom: 6 }} />
          <textarea rows={2} placeholder={`Ask about this moment (${fmtTs(now())})…`} value={body} onChange={(e) => setBody(e.target.value)} style={inputStyle} />
          <button onClick={ask} style={{ width: '100%', marginTop: 8, background: accent, color: '#fff', border: 'none', borderRadius: 8, padding: '8px 0', fontSize: 12.5, fontWeight: 700, cursor: 'pointer' }}>Ask @ {fmtTs(now())}</button>
        </div>
      )}
      <div style={{ flex: 1, overflowY: 'auto', padding: 12 }}>
        {!threads ? <div style={{ color: '#8b90a0', textAlign: 'center', padding: 16 }}><Loader2 size={14} className="spin" /></div>
          : threads.length === 0 ? <div style={{ color: '#8b90a0', fontSize: 12.5, textAlign: 'center', padding: 12 }}>No questions yet on this lecture.</div>
          : threads.map((t) => (
            <button key={t.id} onClick={() => openThread(t.id)} style={{ display: 'block', width: '100%', textAlign: 'left', background: 'rgba(255,255,255,.06)', border: 'none', borderRadius: 10, padding: '9px 10px', marginBottom: 8, cursor: 'pointer', color: '#e7e9ee' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12.5, fontWeight: 700 }}>
                {t.pinned && <Pin size={11} style={{ color: accent }} />}
                <span style={{ flex: 1 }}>{t.title}</span>
                {t.resolved && <CheckCircle2 size={13} style={{ color: '#3ecf8e' }} />}
              </div>
              <div style={{ fontSize: 11, color: '#8b90a0', marginTop: 2 }}>{t.createdByName} · {t._count?.posts ?? 0} repl{(t._count?.posts ?? 0) === 1 ? 'y' : 'ies'}</div>
            </button>
          ))}
      </div>
    </div>
  );
}

// ---- Synced transcript (spec §4.1): click a line to seek, active line follows playback ----
function TranscriptPanel({ captionsUrl, accent, videoRef }: { captionsUrl: string; accent: string; videoRef: React.RefObject<HTMLVideoElement | null> }) {
  const [cues, setCues] = useState<{ start: number; text: string }[] | null>(null);
  const [active, setActive] = useState(-1);
  const rowsRef = useRef<(HTMLButtonElement | null)[]>([]);

  useEffect(() => {
    fetch(captionsUrl).then((r) => r.text()).then((t) => setCues(parseVtt(t))).catch(() => setCues([]));
  }, [captionsUrl]);

  useEffect(() => {
    const v = videoRef.current;
    if (!v || !cues) return;
    const onTime = () => {
      const t = v.currentTime;
      let i = -1;
      for (let k = 0; k < cues.length; k++) { if (cues[k].start <= t) i = k; else break; }
      setActive((prev) => { if (prev !== i && i >= 0) rowsRef.current[i]?.scrollIntoView({ block: 'nearest' }); return i; });
    };
    v.addEventListener('timeupdate', onTime);
    return () => v.removeEventListener('timeupdate', onTime);
  }, [cues, videoRef]);

  const seek = (s: number) => { const v = videoRef.current; if (v) { v.currentTime = s; v.play().catch(() => {}); } };

  if (!cues) return <div style={{ flex: 1, color: '#8b90a0', fontSize: 12.5, textAlign: 'center', padding: 16 }}><Loader2 size={14} className="spin" /></div>;
  if (cues.length === 0) return <div style={{ flex: 1, color: '#8b90a0', fontSize: 12.5, textAlign: 'center', padding: 16 }}>No transcript available.</div>;
  return (
    <div style={{ flex: 1, overflowY: 'auto', padding: 10 }}>
      {cues.map((c, i) => (
        <button key={i} ref={(el) => { rowsRef.current[i] = el; }} onClick={() => seek(c.start)}
          style={{ display: 'flex', gap: 8, width: '100%', textAlign: 'left', background: i === active ? 'rgba(255,255,255,.1)' : 'transparent', border: 'none', cursor: 'pointer', color: i === active ? '#fff' : '#c9cdd6', borderRadius: 8, padding: '6px 8px', marginBottom: 2 }}>
          <span style={{ color: accent, fontVariantNumeric: 'tabular-nums', fontSize: 11.5, fontWeight: 700, flex: '0 0 auto' }}>{fmtTs(c.start)}</span>
          <span style={{ fontSize: 12.5 }}>{c.text}</span>
        </button>
      ))}
    </div>
  );
}

// ---- In-app viewer for PDFs / images / docs (no bounce-outs) ----
export function DocViewer({ item, onClose }: { item: LearnItem; onClose: () => void }) {
  const src = item.mediaAsset?.originalUrl || item.url;
  const isImage = item.type === 'IMAGE';
  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 90, background: '#0b0b10', display: 'flex', flexDirection: 'column' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 14px', background: '#14141c', color: '#fff', flex: '0 0 auto' }}>
        <div style={{ flex: 1, fontWeight: 700, fontSize: 14, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{item.title}</div>
        <button onClick={onClose} style={{ background: 'rgba(255,255,255,.1)', border: 'none', color: '#fff', cursor: 'pointer', borderRadius: 8, padding: '7px 12px', fontSize: 13, fontWeight: 600, display: 'inline-flex', alignItems: 'center', gap: 6 }}><X size={15} /> Close</button>
      </div>
      <div style={{ flex: 1, background: '#1b1b24', display: 'flex', alignItems: 'center', justifyContent: 'center', overflow: 'auto' }}>
        {isImage ? <img src={src} alt={item.title} style={{ maxWidth: '100%', maxHeight: '100%' }} /> : <iframe src={src} title={item.title} style={{ width: '100%', height: '100%', border: 0, background: '#fff' }} />}
      </div>
    </div>
  );
}
