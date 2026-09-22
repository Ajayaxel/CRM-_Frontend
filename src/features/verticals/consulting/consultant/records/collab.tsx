'use client';

/**
 * Comments, @mentions, attachments and the activity rail (spec §20, §21, §23).
 *
 * Shared by every record panel and record page, so a task, an issue and a
 * project all discuss and log the same way.
 */

import React, { useMemo, useRef, useState } from 'react';
import {
  AtSign, Bot, Link2, Paperclip, Reply, Rocket, Trash2, Zap,
} from 'lucide-react';
import { toast } from 'sonner';
import { useAuth } from '@/features/foundation/auth';
import { apiErrorMessage } from '@/lib/api';
import {
  useActivity, useAttachments, useComments, useCreateAttachment, useCreateComment,
  useDeleteComment, useOrgUsers, type Activity as ActivityRow, type Comment, type PmEntityType,
} from '../api';
import { Avatar, Empty, Skeleton, TONE_VAR, fmtAgo, fmtDateTime, humanize, type Tone } from '../ui/primitives';

const MENTION_RE = /@\[([^\]]*)\]\(([a-z0-9_-]+)\)/gi;

function Body({ text }: { text: string }) {
  const parts = useMemo(() => {
    const out: React.ReactNode[] = [];
    let last = 0;
    let m: RegExpExecArray | null;
    const re = new RegExp(MENTION_RE.source, 'gi');
    while ((m = re.exec(text))) {
      if (m.index > last) out.push(text.slice(last, m.index));
      out.push(
        <span key={`${m.index}-${m[2]}`} style={{ fontWeight: 620, color: 'var(--cw-accent)' }}>@{m[1]}</span>,
      );
      last = m.index + m[0].length;
    }
    if (last < text.length) out.push(text.slice(last));
    return out;
  }, [text]);
  return <div style={{ whiteSpace: 'pre-wrap', wordBreak: 'break-word', lineHeight: 1.55 }}>{parts}</div>;
}

/** Composer with @mention autocomplete driven off the caret. */
function Composer({
  onSubmit, pending, placeholder = 'Comment… @ to mention', autoFocus, compact,
}: { onSubmit: (body: string) => void; pending?: boolean; placeholder?: string; autoFocus?: boolean; compact?: boolean }) {
  const [value, setValue] = useState('');
  const [query, setQuery] = useState<string | null>(null);
  const ref = useRef<HTMLTextAreaElement>(null);
  const { data: users = [] } = useOrgUsers();

  const matches = useMemo(() => {
    if (query == null) return [];
    const q = query.toLowerCase();
    return users.filter((u) => u.name.toLowerCase().includes(q) || u.email.toLowerCase().includes(q)).slice(0, 6);
  }, [query, users]);

  const change = (v: string) => {
    setValue(v);
    const caret = ref.current?.selectionStart ?? v.length;
    const m = v.slice(0, caret).match(/(?:^|\s)@([\w.\- ]{0,24})$/);
    setQuery(m ? m[1] : null);
  };

  const insert = (u: { id: string; name: string }) => {
    const caret = ref.current?.selectionStart ?? value.length;
    const before = value.slice(0, caret).replace(/@[\w.\- ]*$/, '');
    setValue(`${before}@[${u.name}](${u.id}) ${value.slice(caret)}`);
    setQuery(null);
    requestAnimationFrame(() => ref.current?.focus());
  };

  const send = () => {
    const body = value.trim();
    if (!body) return;
    onSubmit(body);
    setValue('');
    setQuery(null);
  };

  return (
    <div style={{ position: 'relative' }}>
      <textarea
        ref={ref}
        className="cw-input"
        autoFocus={autoFocus}
        rows={compact ? 2 : 3}
        value={value}
        placeholder={placeholder}
        onChange={(e) => change(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === 'Enter' && !e.shiftKey && !query) { e.preventDefault(); send(); }
          if (e.key === 'Escape') setQuery(null);
        }}
      />
      {query != null && matches.length > 0 && (
        <div style={{
          position: 'absolute', bottom: 'calc(100% + 4px)', left: 0, zIndex: 40, minWidth: 230,
          background: 'var(--cw-bg)', border: '1px solid var(--cw-line)', borderRadius: 'var(--cw-r-lg)',
          boxShadow: 'var(--cw-pop)', overflow: 'hidden', padding: 4,
        }}>
          {matches.map((u) => (
            <button key={u.id} type="button" className="cw-opt" onClick={() => insert(u)}>
              <Avatar name={u.name} size={19} />
              <span style={{ flex: 1 }}>{u.name}</span>
              <span className="cw-opt-hint">{u.email}</span>
            </button>
          ))}
        </div>
      )}
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 6 }}>
        <span className="cw-meta" style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
          <AtSign size={11} /> mention to notify
        </span>
        <button className="cw-btn cw-btn-primary" style={{ marginLeft: 'auto' }} onClick={send} disabled={!value.trim() || pending}>
          {pending ? 'Posting…' : 'Comment'}
        </button>
      </div>
    </div>
  );
}

export function Comments({ entityType, entityId }: { entityType: PmEntityType; entityId: string }) {
  const { user, hasPermission } = useAuth();
  const { data: comments, isLoading } = useComments(entityType, entityId);
  const create = useCreateComment();
  const remove = useDeleteComment();
  const [replyTo, setReplyTo] = useState<string | null>(null);

  const post = (body: string, parentId?: string) =>
    create.mutate({ entityType, entityId, body, ...(parentId ? { parentId } : {}) }, {
      onSuccess: () => setReplyTo(null),
      onError: (e) => toast.error(apiErrorMessage(e)),
    });

  const canModerate = hasPermission('pm.vertical.manage');

  const row = (c: Comment, reply = false) => (
    <div key={c.id} style={{ display: 'flex', gap: 9, paddingLeft: reply ? 28 : 0 }}>
      <Avatar name={c.author?.name} size={reply ? 20 : 24} />
      <div style={{ minWidth: 0, flex: 1 }}>
        <div style={{ display: 'flex', alignItems: 'baseline', gap: 7 }}>
          <span style={{ fontWeight: 620 }}>{c.author?.name ?? 'Unknown'}</span>
          <span className="cw-meta">{fmtAgo(c.createdAt)}{c.editedAt ? ' · edited' : ''}</span>
          <span style={{ marginLeft: 'auto', display: 'inline-flex', gap: 2, flex: 'none' }}>
            {!reply && (
              <button type="button" className="cw-icon-btn" style={{ width: 22, height: 22 }} aria-label="Reply" onClick={() => setReplyTo(replyTo === c.id ? null : c.id)}>
                <Reply size={12} />
              </button>
            )}
            {(c.author?.id === user?.id || canModerate) && (
              <button
                type="button"
                className="cw-icon-btn"
                style={{ width: 22, height: 22 }}
                aria-label="Delete comment"
                onClick={() => remove.mutate(c.id, { onError: (e) => toast.error(apiErrorMessage(e)) })}
              ><Trash2 size={12} /></button>
            )}
          </span>
        </div>
        <Body text={c.body} />
        {replyTo === c.id && (
          <div style={{ marginTop: 8 }}><Composer compact autoFocus pending={create.isPending} placeholder="Reply…" onSubmit={(b) => post(b, c.id)} /></div>
        )}
        {c.replies?.length ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12, marginTop: 12 }}>{c.replies.map((r) => row(r, true))}</div>
        ) : null}
      </div>
    </div>
  );

  return (
    <div>
      <div style={{ marginBottom: 16 }}><Composer pending={create.isPending} onSubmit={(b) => post(b)} /></div>
      {isLoading ? <Skeleton rows={2} height={40} />
        : !comments?.length ? <div className="cw-meta">No comments yet.</div>
          : <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>{comments.map((c) => row(c))}</div>}
    </div>
  );
}

export function Attachments({ entityType, entityId }: { entityType: PmEntityType; entityId: string }) {
  const { data, isLoading } = useAttachments(entityType, entityId);
  const create = useCreateAttachment();
  const [adding, setAdding] = useState(false);
  const [name, setName] = useState('');
  const [url, setUrl] = useState('');

  const add = () => {
    if (!name.trim() || !url.trim()) return;
    create.mutate({ entityType, entityId, name: name.trim(), url: url.trim() }, {
      onSuccess: () => { setAdding(false); setName(''); setUrl(''); },
      onError: (e) => toast.error(apiErrorMessage(e)),
    });
  };

  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10 }}>
        <span className="cw-h2">Attachments</span>
        <button className="cw-btn cw-btn-ghost" style={{ marginLeft: 'auto' }} onClick={() => setAdding((a) => !a)}>
          <Paperclip size={12} /> Attach link
        </button>
      </div>

      {adding && (
        <div style={{ display: 'grid', gap: 7, marginBottom: 12, padding: 10, border: '1px solid var(--cw-line)', borderRadius: 'var(--cw-r)' }}>
          <input className="cw-input" placeholder="Display name" value={name} onChange={(e) => setName(e.target.value)} />
          <input className="cw-input" placeholder="https://…" value={url} onChange={(e) => setUrl(e.target.value)} />
          <div style={{ display: 'flex', gap: 6, justifyContent: 'flex-end' }}>
            <button className="cw-btn cw-btn-ghost" onClick={() => setAdding(false)}>Cancel</button>
            <button className="cw-btn cw-btn-primary" onClick={add} disabled={create.isPending || !name.trim() || !url.trim()}>Attach</button>
          </div>
        </div>
      )}

      {isLoading ? <Skeleton rows={1} height={30} />
        : !data?.length ? <div className="cw-meta">Nothing attached.</div>
          : data.map((a) => (
            <a key={a.id} href={a.url} target="_blank" rel="noreferrer" className="cw-row">
              <Link2 size={13} style={{ color: 'var(--cw-ink-3)', flex: 'none' }} />
              <span className="cw-truncate" style={{ flex: 1 }}>{a.name}</span>
              <span className="cw-meta">{a.uploadedBy?.name} · {fmtAgo(a.createdAt)}</span>
            </a>
          ))}
    </div>
  );
}

function activityTone(a: ActivityRow): Tone {
  if (/fail|critical|blocked|incident/.test(a.action)) return 'red';
  if (/completed|approved|succeeded|done|resolved/.test(a.action)) return 'green';
  if (a.source === 'AUTOMATED') return 'blue';
  return 'slate';
}

/**
 * The activity rail. Automated rows carry a bolt so a CI event is never
 * mistaken for a decision somebody made (spec §21).
 */
export function ActivityRail({
  entityType, entityId, verticalId, limit = 40, source,
}: {
  entityType?: PmEntityType;
  entityId?: string;
  verticalId?: string;
  limit?: number;
  source?: 'MANUAL,SYSTEM' | 'AUTOMATED';
}) {
  const { data, isLoading } = useActivity({ entityType, entityId, verticalId, limit, source });

  if (isLoading) return <Skeleton rows={4} height={30} />;
  const rows = data?.data ?? [];
  if (!rows.length) return <Empty icon={Bot} title="No activity yet" body="Changes, assignments, comments and CI/CD events land here." />;

  return (
    <div style={{ display: 'flex', flexDirection: 'column' }}>
      {rows.map((a, i) => {
        const tone = activityTone(a);
        const automated = a.source === 'AUTOMATED';
        return (
          <div key={a.id} style={{ display: 'flex', gap: 10 }}>
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', flex: 'none', width: 18 }}>
              <span style={{
                width: 18, height: 18, borderRadius: '50%', display: 'inline-flex', alignItems: 'center',
                justifyContent: 'center', marginTop: 6, flex: 'none',
                background: automated ? 'var(--cw-blue-bg)' : 'var(--cw-sunken)',
                color: TONE_VAR[tone],
              }}>
                {automated
                  ? (a.action.startsWith('deployment') ? <Rocket size={9} /> : <Zap size={9} />)
                  : <span style={{ width: 5, height: 5, borderRadius: '50%', background: 'currentColor' }} />}
              </span>
              {i < rows.length - 1 && <span style={{ flex: 1, width: 1, background: 'var(--cw-line)', marginTop: 3 }} />}
            </div>
            <div style={{ minWidth: 0, flex: 1, padding: '5px 0 12px' }}>
              <div style={{ display: 'flex', alignItems: 'baseline', gap: 8 }}>
                <span style={{ minWidth: 0, lineHeight: 1.45 }}>{a.summary}</span>
                <span className="cw-meta" style={{ marginLeft: 'auto', flex: 'none' }} title={fmtDateTime(a.createdAt)}>{fmtAgo(a.createdAt)}</span>
              </div>
              <div className="cw-meta" style={{ marginTop: 1 }}>
                {automated
                  ? `Automated · ${String((a.meta as any)?.source ?? 'system')}`
                  : (a.actor?.name ?? 'System')}
                {a.vertical?.name ? ` · ${a.vertical.name}` : ''}
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}

/** Field-level audit table (spec §28). */
export function AuditTable({ verticalId }: { verticalId?: string }) {
  const { data, isLoading } = useActivity({ verticalId, limit: 100 });
  if (isLoading) return <Skeleton rows={5} height={30} />;
  const rows = (data?.data ?? []).filter((a) => a.field);
  if (!rows.length) return <Empty title="No field changes recorded yet" />;

  return (
    <div className="cw-table-wrap">
      <table className="cw-table">
        <thead>
          <tr><th>When</th><th>Who</th><th>Record</th><th>Field</th><th>From</th><th>To</th></tr>
        </thead>
        <tbody>
          {rows.map((a) => (
            <tr key={a.id}>
              <td style={{ whiteSpace: 'nowrap' }} className="cw-meta">{fmtDateTime(a.createdAt)}</td>
              <td>{a.actor?.name ?? (a.source === 'AUTOMATED' ? 'Automated' : 'System')}</td>
              <td><span className="cw-mono">{a.entityRef ?? humanize(a.entityType)}</span></td>
              <td className="cw-meta">{humanize(a.field ?? '')}</td>
              <td style={{ color: 'var(--cw-ink-3)' }}><span className="cw-truncate">{a.fromValue ?? '—'}</span></td>
              <td style={{ fontWeight: 600 }}><span className="cw-truncate">{a.toValue ?? '—'}</span></td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
