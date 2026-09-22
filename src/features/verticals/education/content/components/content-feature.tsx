'use client';

import { useEffect, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { useRef } from 'react';
import { BookOpen, Video, Plus, X, Trash2, ExternalLink, Eye, EyeOff, CalendarClock, Radio, Play, Upload, Loader2, Check, Zap } from 'lucide-react';
import { api, apiErrorMessage } from '@/lib/api';
import { RecordingPlayer } from '@/features/experiences/portal';
import { Section, Subject } from '@/features/verticals/education/academics';
import { ContentStats, Lecture, Lesson, MATERIAL_META, MaterialType, fmtDateTime } from '../content-client';

const card: React.CSSProperties = { background: 'var(--surface)', border: '1px solid var(--line-soft)', borderRadius: 16 };

export function ContentFeature() {
  const { data: subjects } = useQuery({ queryKey: ['acad-subjects'], queryFn: async () => (await api.get<Subject[]>('/academics/subjects')).data });
  const { data: stats } = useQuery({ queryKey: ['content-stats'], queryFn: async () => (await api.get<ContentStats>('/content/stats')).data });
  const [subjectId, setSubjectId] = useState('');
  useEffect(() => { if (!subjectId && subjects?.length) setSubjectId(subjects[0].id); }, [subjects, subjectId]);

  return (
    <div style={{ animation: 'fadeUp .4s ease' }}>
      <div style={{ marginBottom: 18 }}>
        <h1 style={{ fontSize: 26, fontWeight: 700, letterSpacing: '-.02em', margin: 0 }}>Course Content</h1>
        <p style={{ fontSize: 14, color: 'var(--ink-2)', margin: '6px 0 0' }}>Lessons, materials and lectures per subject — published content flows to student portals.</p>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 12, marginBottom: 16 }}>
        <Stat label="Lessons" value={stats?.lessons ?? 0} />
        <Stat label="Materials" value={stats?.materials ?? 0} />
        <Stat label="Lectures" value={stats?.lectures ?? 0} />
        <Stat label="Upcoming" value={stats?.upcoming ?? 0} />
      </div>

      <select className="input" style={{ height: 42, maxWidth: 380, marginBottom: 16 }} value={subjectId} onChange={(e) => setSubjectId(e.target.value)}>
        {(subjects ?? []).map((s) => <option key={s.id} value={s.id}>{s.code} · {s.name}</option>)}
      </select>

      {subjectId && (
        <div style={{ display: 'grid', gridTemplateColumns: '1.2fr 1fr', gap: 16, alignItems: 'start' }}>
          <LessonsPanel subjectId={subjectId} />
          <LecturesPanel subjectId={subjectId} />
        </div>
      )}
    </div>
  );
}

function Stat({ label, value }: { label: string; value: number }) {
  return <div style={{ ...card, padding: '14px 16px' }}><div style={{ fontSize: 22, fontWeight: 800 }}>{value}</div><div style={{ fontSize: 12, color: 'var(--ink-3)' }}>{label}</div></div>;
}

// ---------------- Lessons & materials ----------------
function LessonsPanel({ subjectId }: { subjectId: string }) {
  const qc = useQueryClient();
  const { data } = useQuery({ queryKey: ['lessons', subjectId], queryFn: async () => (await api.get<Lesson[]>('/content/lessons', { params: { subjectId } })).data });
  const [addLesson, setAddLesson] = useState(false);
  const [addMatFor, setAddMatFor] = useState<string | 'subject' | null>(null);
  const refresh = () => { qc.invalidateQueries({ queryKey: ['lessons', subjectId] }); qc.invalidateQueries({ queryKey: ['content-stats'] }); };
  const delLesson = useMutation({ mutationFn: (id: string) => api.delete(`/content/lessons/${id}`), onSuccess: () => { refresh(); toast.success('Lesson deleted'); } });
  const delMat = useMutation({ mutationFn: (id: string) => api.delete(`/content/materials/${id}`), onSuccess: () => { refresh(); toast.success('Removed'); } });
  const toggle = useMutation({ mutationFn: (id: string) => api.patch(`/content/materials/${id}/toggle`), onSuccess: () => refresh() });

  return (
    <div style={{ ...card, padding: 18 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
        <div style={{ fontWeight: 700, fontSize: 15, display: 'flex', alignItems: 'center', gap: 8 }}><BookOpen size={16} /> Syllabus & materials</div>
        <button className="btn-secondary" style={{ height: 32, fontSize: 12.5 }} onClick={() => setAddLesson(true)}><Plus size={13} /> Lesson</button>
      </div>
      {!data?.length && <div style={{ fontSize: 13, color: 'var(--ink-3)', padding: '10px 0' }}>No lessons yet.</div>}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        {(data ?? []).map((l) => (
          <div key={l.id} style={{ border: '1px solid var(--line-soft)', borderRadius: 12, padding: 12 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <div style={{ flex: 1 }}><div style={{ fontWeight: 600, fontSize: 13.5 }}>{l.title}</div>{l.description && <div style={{ fontSize: 11.5, color: 'var(--ink-3)' }}>{l.description}</div>}</div>
              <button className="btn-secondary" style={{ height: 26, fontSize: 11.5 }} onClick={() => setAddMatFor(l.id)}><Plus size={11} /> Material</button>
              <button className="btn-secondary" style={{ height: 26, width: 26, padding: 0 }} onClick={() => delLesson.mutate(l.id)}><Trash2 size={11} /></button>
            </div>
            {l.materials.length > 0 && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 5, marginTop: 8 }}>
                {l.materials.map((m) => (
                  <div key={m.id} style={{ display: 'flex', alignItems: 'center', gap: 8, background: 'var(--surface-2)', borderRadius: 8, padding: '6px 9px' }}>
                    <span>{MATERIAL_META[m.type].icon}</span>
                    <a href={m.url} target="_blank" rel="noopener" style={{ flex: 1, fontSize: 12.5, color: 'var(--ink-1)', textDecoration: 'none', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{m.title} <ExternalLink size={10} style={{ opacity: .5 }} /></a>
                    <button title={m.published ? 'Published' : 'Hidden'} onClick={() => toggle.mutate(m.id)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: m.published ? 'var(--success)' : 'var(--ink-3)' }}>{m.published ? <Eye size={13} /> : <EyeOff size={13} />}</button>
                    <button onClick={() => delMat.mutate(m.id)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--ink-3)' }}><X size={13} /></button>
                  </div>
                ))}
              </div>
            )}
          </div>
        ))}
      </div>
      {addLesson && <LessonModal subjectId={subjectId} onClose={() => setAddLesson(false)} onDone={() => { setAddLesson(false); refresh(); }} />}
      {addMatFor && <MaterialModal subjectId={subjectId} lessonId={addMatFor} onClose={() => setAddMatFor(null)} onDone={() => { setAddMatFor(null); refresh(); }} />}
    </div>
  );
}
function LessonModal({ subjectId, onClose, onDone }: { subjectId: string; onClose: () => void; onDone: () => void }) {
  const [f, setF] = useState({ title: '', description: '' });
  const create = useMutation({ mutationFn: () => api.post('/content/lessons', { subjectId, ...f }), onSuccess: () => { toast.success('Lesson added'); onDone(); }, onError: (e) => toast.error(apiErrorMessage(e)) });
  return (
    <Overlay title="New lesson" onClose={onClose}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        <div><label className="label">Title</label><input className="input" value={f.title} onChange={(e) => setF({ ...f, title: e.target.value })} placeholder="1. Introduction" /></div>
        <div><label className="label">Description</label><input className="input" value={f.description} onChange={(e) => setF({ ...f, description: e.target.value })} /></div>
      </div>
      <Actions onClose={onClose} disabled={!f.title || create.isPending} onSubmit={() => create.mutate()} label="Add lesson" />
    </Overlay>
  );
}
function MaterialModal({ subjectId, lessonId, onClose, onDone }: { subjectId: string; lessonId: string | 'subject'; onClose: () => void; onDone: () => void }) {
  const [f, setF] = useState<{ type: MaterialType; title: string; url: string }>({ type: 'LINK', title: '', url: '' });
  const set = (k: string, v: string) => setF((s) => ({ ...s, [k]: v }));
  const create = useMutation({ mutationFn: () => api.post('/content/materials', { subjectId, lessonId: lessonId === 'subject' ? undefined : lessonId, type: f.type, title: f.title, url: f.url }), onSuccess: () => { toast.success('Material added'); onDone(); }, onError: (e) => toast.error(apiErrorMessage(e)) });
  return (
    <Overlay title="Add material" onClose={onClose}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        <div style={{ display: 'flex', gap: 10 }}>
          <div style={{ width: 130 }}><label className="label">Type</label><select className="input" value={f.type} onChange={(e) => set('type', e.target.value)}>{(['PDF', 'SLIDES', 'VIDEO', 'LINK', 'DOC'] as MaterialType[]).map((t) => <option key={t} value={t}>{MATERIAL_META[t].icon} {MATERIAL_META[t].label}</option>)}</select></div>
          <div style={{ flex: 1 }}><label className="label">Title</label><input className="input" value={f.title} onChange={(e) => set('title', e.target.value)} placeholder="Lecture notes" /></div>
        </div>
        <div><label className="label">URL</label><input className="input" value={f.url} onChange={(e) => set('url', e.target.value)} placeholder="https://…" /></div>
      </div>
      <Actions onClose={onClose} disabled={!f.title || !f.url || create.isPending} onSubmit={() => create.mutate()} label="Add material" />
    </Overlay>
  );
}

// ---------------- Lectures ----------------
function LecturesPanel({ subjectId }: { subjectId: string }) {
  const qc = useQueryClient();
  const { data } = useQuery({ queryKey: ['lectures', subjectId], queryFn: async () => (await api.get<Lecture[]>('/content/lectures', { params: { subjectId } })).data });
  const { data: sections } = useQuery({ queryKey: ['acad-sections'], queryFn: async () => (await api.get<Section[]>('/academics/sections')).data });
  const [add, setAdd] = useState(false);
  const [play, setPlay] = useState<{ url: string; title: string } | null>(null);
  const [recFor, setRecFor] = useState<Lecture | null>(null);
  const refresh = () => { qc.invalidateQueries({ queryKey: ['lectures', subjectId] }); qc.invalidateQueries({ queryKey: ['content-stats'] }); };
  const del = useMutation({ mutationFn: (id: string) => api.delete(`/content/lectures/${id}`), onSuccess: () => { refresh(); toast.success('Lecture removed'); } });
  const now = Date.now();

  return (
    <div style={{ ...card, padding: 18 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
        <div style={{ fontWeight: 700, fontSize: 15, display: 'flex', alignItems: 'center', gap: 8 }}><Video size={16} /> Lectures</div>
        <button className="btn-secondary" style={{ height: 32, fontSize: 12.5 }} onClick={() => setAdd(true)}><Plus size={13} /> Schedule</button>
      </div>
      {!data?.length && <div style={{ fontSize: 13, color: 'var(--ink-3)', padding: '10px 0' }}>No lectures scheduled.</div>}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        {(data ?? []).map((l) => {
          const start = +new Date(l.scheduledAt); const live = now >= start && now <= start + l.durationMin * 60000; const past = start < now && !live;
          return (
            <div key={l.id} style={{ border: '1px solid var(--line-soft)', borderRadius: 10, padding: '10px 12px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                    <span style={{ fontWeight: 600, fontSize: 13 }}>{l.title}</span>
                    {live && <span className="badge" style={{ background: 'var(--danger-bg,#fce8e8)', color: 'var(--danger,#c0392b)' }}><Radio size={10} style={{ marginRight: 3 }} />Live</span>}
                  </div>
                  <div style={{ fontSize: 11.5, color: 'var(--ink-3)' }}>{fmtDateTime(l.scheduledAt)} · {l.durationMin}min{l.section ? ` · Sec ${l.section.name}` : ''}</div>
                </div>
                {!past && l.meetingProvider && l.meetingProvider !== 'IN_APP' && l.joinUrl && (
                  <a href={l.joinUrl} target="_blank" rel="noopener noreferrer" className="btn-secondary" style={{ height: 28, fontSize: 11.5 }}>
                    Join · {l.meetingProvider === 'GOOGLE_MEET' ? 'Meet' : l.meetingProvider === 'MS_TEAMS' ? 'Teams' : l.meetingProvider === 'ZOOM' ? 'Zoom' : 'Link'}
                  </a>
                )}
                {!past && l.meetingProvider === 'IN_APP' && (
                  <span style={{ fontSize: 11.5, color: 'var(--ink-3)' }}>BMN Connect</span>
                )}
                {l.recordingAssetId && !l.recordingUrl && <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, fontSize: 11.5, color: 'var(--ink-3)' }}><Loader2 size={12} className="spin" /> Processing</span>}
                {l.recordingUrl && <button className="btn-secondary" style={{ height: 28, fontSize: 11.5 }} onClick={() => setPlay({ url: l.recordingUrl!, title: `${l.subject?.code ?? ''} — ${l.title}` })}><Play size={12} /> Recording</button>}
                <button className="btn-secondary" style={{ height: 28, fontSize: 11.5 }} onClick={() => setRecFor(l)} title="Add or replace recording"><Upload size={12} /></button>
                <button className="btn-secondary" style={{ height: 28, width: 28, padding: 0 }} onClick={() => del.mutate(l.id)}><Trash2 size={12} /></button>
              </div>
            </div>
          );
        })}
      </div>
      {add && <LectureModal subjectId={subjectId} sections={sections ?? []} onClose={() => setAdd(false)} onDone={() => { setAdd(false); refresh(); }} />}
      {recFor && <RecordingManager lecture={recFor} onClose={() => setRecFor(null)} onDone={() => { setRecFor(null); refresh(); }} />}
      {play && <RecordingPlayer url={play.url} title={play.title} accent="var(--brand,#132376)" onClose={() => setPlay(null)} />}
    </div>
  );
}

// Attach a recording: upload a video file straight to Mux, transcode a source URL
// to adaptive HLS, or paste a ready URL. (Mux paths need MUX_TOKEN_ID/SECRET.)
function RecordingManager({ lecture, onClose, onDone }: { lecture: Lecture; onClose: () => void; onDone: () => void }) {
  const [url, setUrl] = useState(lecture.recordingUrl ?? '');
  const [uploadPct, setUploadPct] = useState<number | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const L = lecture.id;

  const save = async () => { setBusy('save'); try { await api.post(`/content/lectures/${L}/recording`, { url }); toast.success('Recording saved'); onDone(); } catch (e) { toast.error(apiErrorMessage(e)); } finally { setBusy(null); } };
  const transcode = async () => { setBusy('transcode'); try { const r = await api.post(`/content/lectures/${L}/transcode`, { sourceUrl: url }); toast.success(r.data?.provider === 'mux' ? 'Transcoding on Mux — the adaptive stream will appear shortly' : 'Transcoding to adaptive HD…'); onDone(); } catch (e) { toast.error(apiErrorMessage(e)); } finally { setBusy(null); } };
  const upload = async (file: File) => {
    setUploadPct(0);
    try {
      const { data } = await api.post<{ uploadUrl: string }>(`/content/lectures/${L}/upload-url`, {});
      await new Promise<void>((resolve, reject) => {
        const xhr = new XMLHttpRequest();
        xhr.open('PUT', data.uploadUrl);
        xhr.upload.onprogress = (e) => e.lengthComputable && setUploadPct(Math.round((e.loaded / e.total) * 100));
        xhr.onload = () => (xhr.status < 300 ? resolve() : reject(new Error('upload failed')));
        xhr.onerror = () => reject(new Error('upload failed'));
        xhr.send(file);
      });
      toast.success('Uploaded — transcoding to adaptive HD'); onDone();
    } catch (e) { toast.error(apiErrorMessage(e)); } finally { setUploadPct(null); }
  };

  return (
    <Overlay title="Lecture recording" onClose={onClose}>
      <div style={{ fontSize: 13, color: 'var(--ink-2)', marginBottom: 6 }}>{lecture.title}</div>
      <label className="label">Upload a video file</label>
      {uploadPct !== null ? (
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, margin: '4px 0 12px' }}>
          <span style={{ fontSize: 12, color: 'var(--ink-3)', minWidth: 90 }}>Uploading {uploadPct}%</span>
          <div style={{ flex: 1, height: 6, borderRadius: 99, background: 'var(--surface-2)', overflow: 'hidden' }}><div style={{ width: `${uploadPct}%`, height: '100%', background: 'var(--brand,#132376)' }} /></div>
        </div>
      ) : (
        <div style={{ margin: '4px 0 14px' }}>
          <button className="btn-secondary" onClick={() => fileRef.current?.click()}><Upload size={13} /> Choose video…</button>
          <input ref={fileRef} type="file" accept="video/*" style={{ display: 'none' }} onChange={(e) => { const f = e.target.files?.[0]; if (f) upload(f); e.target.value = ''; }} />
          <span style={{ fontSize: 11.5, color: 'var(--ink-3)', marginLeft: 8 }}>uploads straight to Mux, transcoded to adaptive HLS</span>
        </div>
      )}
      <label className="label">…or a video URL</label>
      <input className="input" value={url} onChange={(e) => setUrl(e.target.value)} placeholder="https://…/recording.mp4 or …/stream.m3u8" style={{ marginBottom: 10 }} />
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
        <button className="btn-secondary" disabled={!url || !!busy} onClick={save}>{busy === 'save' ? <Loader2 size={13} className="spin" /> : <Check size={13} />} Save URL</button>
        <button className="btn-primary" disabled={!url || !!busy} onClick={transcode}>{busy === 'transcode' ? <Loader2 size={13} className="spin" /> : <Zap size={13} />} Make adaptive (HLS)</button>
      </div>
    </Overlay>
  );
}
function LectureModal({ subjectId, sections, onClose, onDone }: { subjectId: string; sections: Section[]; onClose: () => void; onDone: () => void }) {
  const [f, setF] = useState({ title: '', scheduledAt: '', durationMin: '60', mode: 'LIVE', meetingProvider: 'IN_APP', joinUrl: '', sectionId: '' });
  const set = (k: string, v: string) => setF((s) => ({ ...s, [k]: v }));
  const create = useMutation({
    mutationFn: () => api.post('/content/lectures', {
      subjectId, title: f.title, scheduledAt: new Date(f.scheduledAt).toISOString(),
      durationMin: Number(f.durationMin) || 60, mode: f.mode,
      // OFFLINE is in person: no provider, no link. Sending IN_APP there would
      // put a Join button on a class held in a room.
      meetingProvider: f.mode === 'OFFLINE' ? undefined : f.meetingProvider,
      joinUrl: f.mode !== 'OFFLINE' && f.meetingProvider !== 'IN_APP' ? (f.joinUrl || undefined) : undefined,
      sectionId: f.sectionId || undefined,
    }),
    onSuccess: () => { toast.success('Lecture scheduled'); onDone(); }, onError: (e) => toast.error(apiErrorMessage(e)),
  });
  // The server refuses this too — this only saves the round trip and says which
  // field is at fault while the user is still looking at it.
  const needsLink = f.mode !== 'OFFLINE' && f.meetingProvider !== 'IN_APP';
  const canSave = !!f.title.trim() && !!f.scheduledAt && (!needsLink || !!f.joinUrl.trim());
  return (
    <Overlay title="Schedule lecture" onClose={onClose}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        <div><label className="label">Title</label><input className="input" value={f.title} onChange={(e) => set('title', e.target.value)} placeholder="Live class — Chapter 3" /></div>
        <div style={{ display: 'flex', gap: 10 }}>
          <div style={{ flex: 1 }}><label className="label">When</label><input className="input" type="datetime-local" value={f.scheduledAt} onChange={(e) => set('scheduledAt', e.target.value)} /></div>
          <div style={{ width: 100 }}><label className="label">Minutes</label><input className="input" type="number" value={f.durationMin} onChange={(e) => set('durationMin', e.target.value)} /></div>
        </div>
        <div style={{ display: 'flex', gap: 10 }}>
          <div style={{ width: 140 }}><label className="label">Mode</label><select className="input" value={f.mode} onChange={(e) => set('mode', e.target.value)}>{['LIVE', 'RECORDED', 'OFFLINE'].map((m) => <option key={m}>{m}</option>)}</select></div>
          <div style={{ flex: 1 }}><label className="label">Section <span style={{ color: 'var(--ink-3)', fontWeight: 400 }}>(all if blank)</span></label><select className="input" value={f.sectionId} onChange={(e) => set('sectionId', e.target.value)}><option value="">All sections</option>{sections.map((s) => <option key={s.id} value={s.id}>{s.batch?.name} · Sec {s.name}</option>)}</select></div>
        </div>
        {f.mode !== 'OFFLINE' && (
          <div style={{ display: 'flex', gap: 10 }}>
            <div style={{ width: 190 }}>
              <label className="label">Meeting</label>
              <select className="input" value={f.meetingProvider} onChange={(e) => set('meetingProvider', e.target.value)}>
                <option value="IN_APP">BMN Connect</option>
                <option value="GOOGLE_MEET">Google Meet</option>
                <option value="ZOOM">Zoom</option>
                <option value="MS_TEAMS">Microsoft Teams</option>
                <option value="OTHER">Other</option>
              </select>
            </div>
            {/*
              The link is REQUIRED for an external provider and hidden for the
              in-app room, whose join path is derived from the lecture id — a
              field here would invite somebody to paste a URL that is then
              silently discarded by the server.
            */}
            {f.meetingProvider !== 'IN_APP' && (
              <div style={{ flex: 1 }}>
                <label className="label">Meeting link <span style={{ color: 'var(--danger,#c0392b)' }}>*</span></label>
                <input className="input" value={f.joinUrl} onChange={(e) => set('joinUrl', e.target.value)}
                  placeholder={f.meetingProvider === 'ZOOM' ? 'https://…zoom.us/j/…' : f.meetingProvider === 'MS_TEAMS' ? 'https://teams.microsoft.com/…' : 'https://meet.google.com/…'} />
              </div>
            )}
          </div>
        )}
      </div>
      <Actions onClose={onClose} disabled={!canSave || create.isPending} onSubmit={() => create.mutate()} label="Schedule" />
    </Overlay>
  );
}

// ---------------- shared ----------------
function Overlay({ title, children, onClose }: { title: string; children: React.ReactNode; onClose: () => void }) {
  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 60, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }}>
      <div style={{ position: 'absolute', inset: 0, background: 'rgba(20,15,12,.42)' }} onClick={onClose} />
      <div style={{ ...card, position: 'relative', zIndex: 1, width: 500, maxWidth: '100%', maxHeight: '92vh', overflowY: 'auto', padding: 22, borderRadius: 18 }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}><div style={{ fontWeight: 700, fontSize: 15 }}>{title}</div><button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--ink-3)' }}><X size={20} /></button></div>
        {children}
      </div>
    </div>
  );
}
function Actions({ onClose, onSubmit, disabled, label }: { onClose: () => void; onSubmit: () => void; disabled: boolean; label: string }) {
  return <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10, marginTop: 18 }}><button className="btn-secondary" onClick={onClose}>Cancel</button><button className="btn-primary" disabled={disabled} onClick={onSubmit}>{label}</button></div>;
}
