'use client';

import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { Megaphone, CalendarClock, Pin, Trash2, Plus, Clock, Sparkles, Loader2 } from 'lucide-react';
import { api, apiErrorMessage } from '@/lib/api';
import { AUDIENCE_META, Announcement, Audience, FacultyLite, PTM_META, PtmSlot, fmtWhen } from '../communication-client';

const card: React.CSSProperties = { background: 'var(--surface)', border: '1px solid var(--line-soft)', borderRadius: 16 };
const brand = 'var(--brand,#132376)';
const inp: React.CSSProperties = { padding: '9px 11px', borderRadius: 9, border: '1px solid var(--line-soft)', background: 'var(--surface)', fontSize: 13 };
const TABS = [['announcements', 'Announcements', Megaphone], ['ptm', 'Parent meetings', CalendarClock]] as const;

export function CommunicationFeature() {
  const [tab, setTab] = useState<(typeof TABS)[number][0]>('announcements');
  return (
    <div style={{ animation: 'fadeUp .4s ease' }}>
      <div style={{ marginBottom: 18 }}>
        <h1 style={{ fontSize: 26, fontWeight: 700, letterSpacing: '-.02em', margin: 0 }}>Communication</h1>
        <p style={{ fontSize: 14, color: 'var(--ink-2)', margin: '6px 0 0' }}>Broadcast announcements and coordinate parent–teacher meetings across the portal.</p>
      </div>
      <div style={{ display: 'flex', gap: 6, marginBottom: 16, flexWrap: 'wrap' }}>
        {TABS.map(([k, l, Ic]) => <button key={k} className="btn-secondary" style={{ height: 36, fontSize: 12.5, borderColor: tab === k ? brand : undefined, color: tab === k ? brand : undefined }} onClick={() => setTab(k)}><Ic size={14} /> {l}</button>)}
      </div>
      {tab === 'announcements' ? <AnnouncementsTab /> : <PtmTab />}
    </div>
  );
}

// ================= Announcements =================
function AnnouncementsTab() {
  const qc = useQueryClient();
  const [f, setF] = useState({ title: '', body: '', audience: 'ALL' as Audience, pinned: false });
  const [topic, setTopic] = useState('');
  const { data: items = [], isLoading } = useQuery({ queryKey: ['announcements'], queryFn: async () => (await api.get<Announcement[]>('/announcements')).data });

  const draft = useMutation({
    mutationFn: async () => (await api.post<{ title: string; body: string; provider: string }>('/ai/announcement-draft', { topic, audience: f.audience })).data,
    onSuccess: (d) => { setF((p) => ({ ...p, title: d.title, body: d.body })); toast.success(d.provider === 'STUB' ? 'Drafted a template (add ANTHROPIC_API_KEY for AI)' : 'Drafted with AI — review & edit'); },
    onError: (e) => toast.error(apiErrorMessage(e)),
  });

  const create = useMutation({
    mutationFn: async () => (await api.post('/announcements', f)).data,
    onSuccess: () => { toast.success('Announcement published'); setF({ title: '', body: '', audience: 'ALL', pinned: false }); qc.invalidateQueries({ queryKey: ['announcements'] }); },
    onError: (e) => toast.error(apiErrorMessage(e)),
  });
  const pin = useMutation({
    mutationFn: async (a: Announcement) => (await api.patch(`/announcements/${a.id}`, { pinned: !a.pinned })).data,
    onSuccess: () => qc.invalidateQueries({ queryKey: ['announcements'] }),
    onError: (e) => toast.error(apiErrorMessage(e)),
  });
  const remove = useMutation({
    mutationFn: async (id: string) => (await api.delete(`/announcements/${id}`)).data,
    onSuccess: () => { toast.success('Deleted'); qc.invalidateQueries({ queryKey: ['announcements'] }); },
    onError: (e) => toast.error(apiErrorMessage(e)),
  });

  return (
    <div style={{ display: 'grid', gridTemplateColumns: '340px 1fr', gap: 16, alignItems: 'start' }}>
      <div style={{ ...card, padding: 18 }}>
        <div style={{ fontWeight: 700, fontSize: 15, marginBottom: 12 }}>New announcement</div>
        <div style={{ background: 'color-mix(in srgb, ' + brand + ' 7%, var(--surface))', border: '1px dashed color-mix(in srgb, ' + brand + ' 35%, var(--line-soft))', borderRadius: 12, padding: 12, marginBottom: 12 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, fontWeight: 700, color: brand, marginBottom: 8 }}><Sparkles size={14} /> Draft with AI</div>
          <textarea placeholder="Describe the notice in a line or two — e.g. 'sports day Aug 20, register with class teacher by Aug 10'" value={topic} onChange={(e) => setTopic(e.target.value)} rows={2} style={{ ...inp, resize: 'vertical' }} />
          <button className="btn-secondary" style={{ height: 34, marginTop: 8, borderColor: brand, color: brand }} disabled={topic.trim().length < 3 || draft.isPending} onClick={() => draft.mutate()}>
            {draft.isPending ? <Loader2 size={14} className="spin" /> : <Sparkles size={14} />} Generate draft
          </button>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          <input placeholder="Title" value={f.title} onChange={(e) => setF({ ...f, title: e.target.value })} style={inp} />
          <textarea placeholder="Write your message…" value={f.body} onChange={(e) => setF({ ...f, body: e.target.value })} rows={5} style={{ ...inp, resize: 'vertical' }} />
          <select value={f.audience} onChange={(e) => setF({ ...f, audience: e.target.value as Audience })} style={inp}>
            {(['ALL', 'STUDENTS', 'PARENTS', 'LECTURERS'] as Audience[]).map((a) => <option key={a} value={a}>{AUDIENCE_META[a].label}</option>)}
          </select>
          <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, color: 'var(--ink-2)', cursor: 'pointer' }}>
            <input type="checkbox" checked={f.pinned} onChange={(e) => setF({ ...f, pinned: e.target.checked })} /> Pin to top
          </label>
          <button className="btn-primary" style={{ background: brand }} disabled={!f.title || !f.body || create.isPending} onClick={() => create.mutate()}><Plus size={14} /> Publish</button>
        </div>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        {isLoading ? <div style={{ ...card, padding: 40, textAlign: 'center', color: 'var(--ink-3)' }}>Loading…</div>
          : items.length === 0 ? <div style={{ ...card, padding: 40, textAlign: 'center', color: 'var(--ink-3)' }}>No announcements yet.</div>
          : items.map((a) => {
            const m = AUDIENCE_META[a.audience];
            return (
              <div key={a.id} style={{ ...card, padding: 16, borderLeft: a.pinned ? `3px solid ${brand}` : card.border as string }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  {a.pinned && <Pin size={14} style={{ color: brand }} />}
                  <div style={{ fontWeight: 700, fontSize: 14.5, flex: 1 }}>{a.title}</div>
                  <span className="badge" style={{ background: m.bg, color: m.fg }}>{m.label}</span>
                  <span style={{ fontSize: 11.5, color: 'var(--ink-3)' }}>{new Date(a.publishedAt).toLocaleDateString('en-IN', { day: '2-digit', month: 'short' })}</span>
                </div>
                <div style={{ fontSize: 13, color: 'var(--ink-2)', marginTop: 6, whiteSpace: 'pre-wrap', lineHeight: 1.5 }}>{a.body}</div>
                <div style={{ display: 'flex', gap: 8, marginTop: 10 }}>
                  <button className="btn-secondary" style={{ height: 30, fontSize: 12 }} onClick={() => pin.mutate(a)}><Pin size={13} /> {a.pinned ? 'Unpin' : 'Pin'}</button>
                  <button className="btn-secondary" style={{ height: 30, fontSize: 12, color: 'var(--danger,#c0392b)' }} onClick={() => remove.mutate(a.id)}><Trash2 size={13} /> Delete</button>
                </div>
              </div>
            );
          })}
      </div>
    </div>
  );
}

// ================= PTM =================
function PtmTab() {
  const qc = useQueryClient();
  const [f, setF] = useState({ facultyId: '', date: '', times: '', durationMin: 15, mode: 'OFFLINE', location: '' });
  const { data: slots = [], isLoading } = useQuery({ queryKey: ['ptm-slots'], queryFn: async () => (await api.get<PtmSlot[]>('/ptm/slots')).data });
  const { data: faculty = [] } = useQuery({ queryKey: ['admin-faculty'], queryFn: async () => (await api.get<FacultyLite[]>('/faculty')).data });

  const open = useMutation({
    mutationFn: async () => {
      const times = f.times.split(',').map((t) => t.trim()).filter(Boolean);
      return (await api.post('/ptm/slots', { facultyId: f.facultyId, date: f.date, times, durationMin: Number(f.durationMin) || 15, mode: f.mode, location: f.location || undefined })).data;
    },
    onSuccess: (d: any) => { toast.success(`${d.created} slots opened`); setF({ ...f, times: '', location: '' }); qc.invalidateQueries({ queryKey: ['ptm-slots'] }); },
    onError: (e) => toast.error(apiErrorMessage(e)),
  });
  const remove = useMutation({
    mutationFn: async (id: string) => (await api.delete(`/ptm/slots/${id}`)).data,
    onSuccess: () => { toast.success('Slot removed'); qc.invalidateQueries({ queryKey: ['ptm-slots'] }); },
    onError: (e) => toast.error(apiErrorMessage(e)),
  });

  const counts = { open: slots.filter((s) => s.status === 'OPEN').length, booked: slots.filter((s) => s.status === 'BOOKED').length, done: slots.filter((s) => s.status === 'DONE').length };

  return (
    <div style={{ display: 'grid', gridTemplateColumns: '340px 1fr', gap: 16, alignItems: 'start' }}>
      <div style={{ ...card, padding: 18 }}>
        <div style={{ fontWeight: 700, fontSize: 15, marginBottom: 12 }}>Open meeting slots</div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          <select value={f.facultyId} onChange={(e) => setF({ ...f, facultyId: e.target.value })} style={inp}>
            <option value="">Select lecturer…</option>
            {faculty.map((fac) => <option key={fac.id} value={fac.id}>{fac.name}{fac.department ? ` · ${fac.department}` : ''}</option>)}
          </select>
          <input type="date" value={f.date} onChange={(e) => setF({ ...f, date: e.target.value })} style={inp} />
          <input placeholder="Times: 10:00, 10:20, 10:40" value={f.times} onChange={(e) => setF({ ...f, times: e.target.value })} style={inp} />
          <div style={{ display: 'flex', gap: 8 }}>
            <input type="number" placeholder="Min" value={f.durationMin} onChange={(e) => setF({ ...f, durationMin: Number(e.target.value) })} style={{ ...inp, width: 90 }} />
            <select value={f.mode} onChange={(e) => setF({ ...f, mode: e.target.value })} style={{ ...inp, flex: 1 }}><option value="OFFLINE">In person</option><option value="LIVE">Online</option></select>
          </div>
          <input placeholder="Room / meeting link" value={f.location} onChange={(e) => setF({ ...f, location: e.target.value })} style={inp} />
          <button className="btn-primary" style={{ background: brand }} disabled={!f.facultyId || !f.date || !f.times || open.isPending} onClick={() => open.mutate()}><Plus size={14} /> Open slots</button>
        </div>
        <div style={{ display: 'flex', gap: 8, marginTop: 16 }}>
          {[['Open', counts.open], ['Booked', counts.booked], ['Done', counts.done]].map(([l, v]) => <div key={l as string} style={{ flex: 1, background: 'var(--surface-2)', borderRadius: 10, padding: '8px 10px', textAlign: 'center' }}><div style={{ fontWeight: 800, fontSize: 18 }}>{v as number}</div><div style={{ fontSize: 11, color: 'var(--ink-3)' }}>{l}</div></div>)}
        </div>
      </div>

      <div style={{ ...card, overflow: 'hidden' }}>
        {isLoading ? <div style={{ padding: 40, textAlign: 'center', color: 'var(--ink-3)' }}>Loading…</div>
          : slots.length === 0 ? <div style={{ padding: 40, textAlign: 'center', color: 'var(--ink-3)' }}>No PTM slots yet. Open some on the left.</div>
          : slots.map((s) => {
            const m = PTM_META[s.status];
            return (
              <div key={s.id} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '11px 14px', borderTop: '1px solid var(--line-soft)' }}>
                <Clock size={15} style={{ color: brand }} />
                <div style={{ minWidth: 170 }}><div style={{ fontSize: 13, fontWeight: 600 }}>{fmtWhen(s.startsAt)}</div><div style={{ fontSize: 11.5, color: 'var(--ink-3)' }}>{s.durationMin}min · {s.mode === 'LIVE' ? 'Online' : 'In person'}</div></div>
                <div style={{ flex: 1, fontSize: 12.5 }}>
                  <div style={{ fontWeight: 600 }}>{s.faculty?.name}</div>
                  {s.student ? <div style={{ color: 'var(--ink-3)' }}>with {s.student.firstName} {s.student.lastName ?? ''}{s.guardian?.name ? ` · ${s.guardian.name}` : ''}</div> : <div style={{ color: 'var(--ink-3)' }}>{s.location || 'Awaiting booking'}</div>}
                </div>
                <span className="badge" style={{ background: m.bg, color: m.fg }}>{m.label}</span>
                {s.status === 'OPEN' && <button className="btn-secondary" style={{ height: 30, width: 34, padding: 0, color: 'var(--danger,#c0392b)' }} onClick={() => remove.mutate(s.id)}><Trash2 size={13} /></button>}
              </div>
            );
          })}
      </div>
    </div>
  );
}
