'use client';

import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { Plus, Users, Filter, MessageSquareText, Trash2, Tag as TagIcon } from 'lucide-react';
import { omniApi, OmniContact, Segment, SavedReply, CHANNEL_META, contactColor, contactInitials, ChannelType } from '../omni-client';
import { formatDate } from '@/lib/utils';

const card: React.CSSProperties = { background: 'var(--surface)', border: '1px solid var(--line-soft)', borderRadius: 16 };
const mono: React.CSSProperties = { fontFamily: 'var(--mono)', fontSize: 10, letterSpacing: '.1em', textTransform: 'uppercase', color: 'var(--ink-3)' };

export function AudienceFeature() {
  const [tab, setTab] = useState<'contacts' | 'segments' | 'replies'>('contacts');
  return (
    <div style={{ animation: 'fadeUp .4s ease' }}>
      <div style={{ marginBottom: 18 }}>
        <h1 style={{ fontSize: 26, fontWeight: 700, letterSpacing: '-.02em', margin: 0 }}>Audience</h1>
        <p style={{ fontSize: 14, color: 'var(--ink-2)', margin: '6px 0 0' }}>Contacts, segments and saved replies powering your campaigns.</p>
      </div>
      <div style={{ display: 'flex', gap: 2, borderBottom: '1px solid var(--line-soft)', marginBottom: 18 }}>
        {([['contacts', 'Contacts', Users], ['segments', 'Segments', Filter], ['replies', 'Saved Replies', MessageSquareText]] as const).map(([k, label, Icon]) => (
          <button key={k} onClick={() => setTab(k)}
            style={{ display: 'inline-flex', alignItems: 'center', gap: 7, padding: '10px 14px', border: 'none', background: 'none', cursor: 'pointer',
              fontWeight: 600, fontSize: 13.5, color: tab === k ? 'var(--navy)' : 'var(--ink-2)',
              borderBottom: tab === k ? '2px solid var(--navy)' : '2px solid transparent', marginBottom: -1 }}>
            <Icon size={15} /> {label}
          </button>
        ))}
      </div>
      {tab === 'contacts' && <Contacts />}
      {tab === 'segments' && <Segments />}
      {tab === 'replies' && <Replies />}
    </div>
  );
}

function TagChip({ t }: { t: string }) {
  return <span className="badge" style={{ background: 'var(--surface-2)', color: 'var(--ink-2)', fontFamily: 'var(--mono)', fontSize: 10 }}>{t}</span>;
}

function Contacts() {
  const [search, setSearch] = useState('');
  const { data } = useQuery({
    queryKey: ['omni-contacts', search],
    queryFn: async () => (await omniApi.get(`/audience/contacts?limit=100${search ? `&search=${encodeURIComponent(search)}` : ''}`)).data as { data: OmniContact[]; meta: { total: number } },
  });
  const { data: tags } = useQuery({ queryKey: ['omni-tags'], queryFn: async () => (await omniApi.get('/audience/contacts/tags')).data as { tag: string; count: number }[] });

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, marginBottom: 12, flexWrap: 'wrap' }}>
        <input className="input" style={{ maxWidth: 320 }} placeholder="Search contacts…" value={search} onChange={(e) => setSearch(e.target.value)} />
        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', alignItems: 'center' }}>
          {tags?.slice(0, 6).map((t) => (
            <button key={t.tag} onClick={() => setSearch('')} style={{ border: 'none', background: 'var(--surface-2)', borderRadius: 99, padding: '4px 10px', fontSize: 11.5, color: 'var(--ink-2)', cursor: 'pointer' }}>
              <TagIcon size={11} style={{ verticalAlign: -1 }} /> {t.tag} · {t.count}
            </button>
          ))}
        </div>
      </div>
      <div className="card" style={{ overflow: 'hidden' }}>
        <div style={{ display: 'grid', gridTemplateColumns: '2fr 1.4fr 1.2fr 1fr 0.8fr', gap: 12, padding: '12px 20px', borderBottom: '1px solid var(--line-soft)', ...mono }}>
          <div>Contact</div><div>Handle</div><div>Channels</div><div>Tags</div><div style={{ textAlign: 'right' }}>Chats</div>
        </div>
        {data?.data.map((c) => (
          <div key={c.id} style={{ display: 'grid', gridTemplateColumns: '2fr 1.4fr 1.2fr 1fr 0.8fr', gap: 12, padding: '13px 20px', borderBottom: '1px solid var(--line-soft)', alignItems: 'center' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 11, minWidth: 0 }}>
              <span style={{ width: 34, height: 34, borderRadius: 99, background: contactColor(c.id), color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700, fontSize: 12, flexShrink: 0 }}>{contactInitials(c.name)}</span>
              <div style={{ minWidth: 0 }}>
                <div style={{ fontWeight: 600, fontSize: 13.5, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{c.name ?? 'Unknown'}</div>
                <div style={{ fontSize: 11.5, color: 'var(--ink-3)' }}>{c.optIn ? 'Opted in' : 'Opted out'} · seen {c.lastSeenAt ? formatDate(c.lastSeenAt) : '—'}</div>
              </div>
            </div>
            <div style={{ fontSize: 13, color: 'var(--ink-2)' }}>{c.handle ?? c.email ?? '—'}</div>
            <div style={{ display: 'flex', gap: 4 }}>{c.channels.map((ch) => <span key={ch} title={CHANNEL_META[ch as ChannelType]?.label}>{CHANNEL_META[ch as ChannelType]?.icon}</span>)}</div>
            <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>{c.tags.slice(0, 2).map((t) => <TagChip key={t} t={t} />)}</div>
            <div style={{ textAlign: 'right', fontWeight: 600, fontSize: 13 }}>{c._count?.conversations ?? 0}</div>
          </div>
        ))}
        {data?.data.length === 0 && <div style={{ padding: 36, textAlign: 'center', color: 'var(--ink-3)' }}>No contacts yet — they appear automatically as people message you.</div>}
      </div>
    </div>
  );
}

function Segments() {
  const qc = useQueryClient();
  const { data } = useQuery({ queryKey: ['omni-segments'], queryFn: async () => (await omniApi.get('/audience/segments')).data as Segment[] });
  const [form, setForm] = useState({ name: '', tag: '', channel: '', optIn: 'any' });
  const [preview, setPreview] = useState<number | null>(null);

  const buildFilters = () => ({
    ...(form.tag ? { tags: [form.tag] } : {}),
    ...(form.channel ? { channel: form.channel } : {}),
    ...(form.optIn !== 'any' ? { optIn: form.optIn === 'yes' } : {}),
  });
  const doPreview = useMutation({
    mutationFn: () => omniApi.post('/audience/segments/preview', { filters: buildFilters() }),
    onSuccess: (r) => setPreview(r.data.count),
  });
  const create = useMutation({
    mutationFn: () => omniApi.post('/audience/segments', { name: form.name, filters: buildFilters() }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['omni-segments'] }); setForm({ name: '', tag: '', channel: '', optIn: 'any' }); setPreview(null); toast.success('Segment created'); },
  });
  const remove = useMutation({
    mutationFn: (id: string) => omniApi.delete(`/audience/segments/${id}`),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['omni-segments'] }),
  });

  return (
    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1.4fr', gap: 18, alignItems: 'start' }}>
      <div style={{ ...card, padding: 18 }}>
        <div style={{ fontWeight: 700, fontSize: 15, marginBottom: 14 }}>New segment</div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          <div><label className="label">Name</label><input className="input" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="e.g. WhatsApp opt-ins" /></div>
          <div><label className="label">Has tag</label><input className="input" value={form.tag} onChange={(e) => { setForm({ ...form, tag: e.target.value }); setPreview(null); }} placeholder="hot-lead" /></div>
          <div><label className="label">On channel</label>
            <select className="input" value={form.channel} onChange={(e) => { setForm({ ...form, channel: e.target.value }); setPreview(null); }}>
              <option value="">Any</option>{Object.entries(CHANNEL_META).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
            </select>
          </div>
          <div><label className="label">Opt-in</label>
            <select className="input" value={form.optIn} onChange={(e) => { setForm({ ...form, optIn: e.target.value }); setPreview(null); }}>
              <option value="any">Any</option><option value="yes">Opted in</option><option value="no">Opted out</option>
            </select>
          </div>
          <div style={{ display: 'flex', gap: 8, marginTop: 4 }}>
            <button className="btn-secondary" style={{ flex: 1 }} onClick={() => doPreview.mutate()}>Preview{preview !== null ? ` · ${preview}` : ''}</button>
            <button className="btn-primary" style={{ flex: 1 }} disabled={!form.name.trim() || create.isPending} onClick={() => create.mutate()}>Save</button>
          </div>
        </div>
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        {data?.map((s) => (
          <div key={s.id} style={{ ...card, padding: 16, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <div>
              <div style={{ fontWeight: 600, fontSize: 14 }}>{s.name}</div>
              <div style={{ fontSize: 12, color: 'var(--ink-3)', marginTop: 2 }}>
                {s.filters.tags?.length ? `tag: ${s.filters.tags.join(', ')}` : ''}
                {s.filters.channel ? ` · ${CHANNEL_META[s.filters.channel as ChannelType]?.label}` : ''}
                {typeof s.filters.optIn === 'boolean' ? ` · ${s.filters.optIn ? 'opted in' : 'opted out'}` : ''}
                {!s.filters.tags?.length && !s.filters.channel && s.filters.optIn === undefined ? 'all contacts' : ''}
              </div>
            </div>
            <button className="btn-secondary" style={{ height: 32, width: 32, padding: 0, color: 'var(--danger)' }} onClick={() => remove.mutate(s.id)}><Trash2 size={14} /></button>
          </div>
        ))}
        {data?.length === 0 && <div style={{ color: 'var(--ink-3)', fontSize: 13, padding: 20 }}>No segments yet.</div>}
      </div>
    </div>
  );
}

function Replies() {
  const qc = useQueryClient();
  const { data } = useQuery({ queryKey: ['omni-replies'], queryFn: async () => (await omniApi.get('/audience/saved-replies')).data as SavedReply[] });
  const [form, setForm] = useState({ title: '', shortcut: '', body: '' });
  const create = useMutation({
    mutationFn: () => omniApi.post('/audience/saved-replies', form),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['omni-replies'] }); setForm({ title: '', shortcut: '', body: '' }); toast.success('Reply saved'); },
  });
  const remove = useMutation({ mutationFn: (id: string) => omniApi.delete(`/audience/saved-replies/${id}`), onSuccess: () => qc.invalidateQueries({ queryKey: ['omni-replies'] }) });

  return (
    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1.4fr', gap: 18, alignItems: 'start' }}>
      <div style={{ ...card, padding: 18 }}>
        <div style={{ fontWeight: 700, fontSize: 15, marginBottom: 14 }}>New saved reply</div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          <div><label className="label">Title</label><input className="input" value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} placeholder="Fee structure" /></div>
          <div><label className="label">Shortcut</label><input className="input" value={form.shortcut} onChange={(e) => setForm({ ...form, shortcut: e.target.value })} placeholder="/fees" /></div>
          <div><label className="label">Message</label><textarea className="input" rows={4} style={{ resize: 'vertical' }} value={form.body} onChange={(e) => setForm({ ...form, body: e.target.value })} placeholder="Our fees start at…" /></div>
          <button className="btn-primary" disabled={!form.title.trim() || !form.body.trim() || create.isPending} onClick={() => create.mutate()}><Plus size={15} /> Save reply</button>
        </div>
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        {data?.map((r) => (
          <div key={r.id} style={{ ...card, padding: 16 }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <div style={{ fontWeight: 600, fontSize: 14 }}>{r.title} {r.shortcut && <span style={{ fontFamily: 'var(--mono)', fontSize: 11, color: 'var(--navy)' }}>{r.shortcut}</span>}</div>
              <button className="btn-secondary" style={{ height: 30, width: 30, padding: 0, color: 'var(--danger)' }} onClick={() => remove.mutate(r.id)}><Trash2 size={13} /></button>
            </div>
            <div style={{ fontSize: 13, color: 'var(--ink-2)', marginTop: 6, lineHeight: 1.5 }}>{r.body}</div>
          </div>
        ))}
        {data?.length === 0 && <div style={{ color: 'var(--ink-3)', fontSize: 13, padding: 20 }}>No saved replies yet.</div>}
      </div>
    </div>
  );
}
