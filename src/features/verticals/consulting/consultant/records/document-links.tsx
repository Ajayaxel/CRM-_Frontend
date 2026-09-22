'use client';

/**
 * Document ↔ record relationships.
 *
 * The other half of a two-way model: a task already shows the documents that
 * describe it, and this is where that link gets made from the document side.
 * Every related record opens in the same peek panel as everywhere else, so the
 * navigation history carries on rather than restarting.
 */

import React, { useMemo, useState } from 'react';
import { FileSymlink, FileText, Plus, Trash2, X } from 'lucide-react';
import { toast } from 'sonner';
import { useAuth } from '@/features/foundation/auth';
import { apiErrorMessage } from '@/lib/api';
import {
  useDocumentsFor, useFeatures, useIssues, useLinkDocument, useMilestones,
  useProjects, useTasks, useUnlinkDocument, useVerticals, type PmEntityType,
} from '../api';
import { Empty, OptionList, Popover, humanize } from '../ui/primitives';
import { StatusChip } from '../ui/cells';
import { useWorkspace, type RecordKind } from '../ui/workspace-context';

export interface DocumentLink {
  id: string;
  entityType: PmEntityType;
  entityId: string;
  label: string;
  ref?: string | null;
  status?: string | null;
}

/** Link types the picker offers, in the order the hierarchy reads. */
const LINKABLE: { type: PmEntityType; label: string }[] = [
  { type: 'VERTICAL', label: 'Product line' },
  { type: 'PROJECT', label: 'Project' },
  { type: 'MILESTONE', label: 'Milestone' },
  { type: 'TASK', label: 'Task' },
  { type: 'ISSUE', label: 'Issue' },
  { type: 'FEATURE', label: 'Feature' },
];

/** Which of those open in the peek panel rather than their own page. */
const PEEKABLE: Partial<Record<PmEntityType, RecordKind>> = {
  TASK: 'TASK',
  ISSUE: 'ISSUE',
  FEATURE: 'FEATURE',
  MILESTONE: 'MILESTONE',
  PROJECT: 'PROJECT',
};

const chipKind = (t: PmEntityType) =>
  t === 'TASK' ? 'task' : t === 'ISSUE' ? 'issue' : t === 'FEATURE' ? 'feature'
    : t === 'MILESTONE' ? 'milestone' : t === 'PROJECT' ? 'project' : 'vertical';

export function DocumentLinks({
  documentId, verticalId, links,
}: {
  documentId: string;
  /** Scopes the search so a picker does not list the whole organisation. */
  verticalId?: string;
  links: DocumentLink[];
}) {
  const { hasPermission } = useAuth();
  const ws = useWorkspace();
  const unlink = useUnlinkDocument();
  const [adding, setAdding] = useState(false);

  const canEdit = hasPermission('pm.document.update');

  const grouped = useMemo(() => {
    const m = new Map<PmEntityType, DocumentLink[]>();
    for (const l of links) m.set(l.entityType, [...(m.get(l.entityType) ?? []), l]);
    // Keep the hierarchy order rather than insertion order.
    return LINKABLE.map(({ type, label }) => ({ type, label, rows: m.get(type) ?? [] })).filter((g) => g.rows.length);
  }, [links]);

  const open = (l: DocumentLink) => {
    const kind = PEEKABLE[l.entityType];
    if (kind) ws.openRecord(kind, l.entityId);
    else if (l.entityType === 'VERTICAL') window.location.href = `/consultant/verticals/${l.entityId}`;
  };

  return (
    <section style={{ borderTop: '1px solid var(--cw-line)', paddingTop: 12, marginTop: 30 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
        <h3 className="cw-h2">Related records</h3>
        {links.length > 0 && <span className="cw-tab-count">{links.length}</span>}
        {canEdit && (
          <button type="button" className="cw-btn cw-btn-ghost" style={{ marginLeft: 'auto' }} onClick={() => setAdding(true)}>
            <Plus size={13} /> Add relation
          </button>
        )}
      </div>

      {links.length === 0 ? (
        <Empty
          compact
          icon={FileSymlink}
          title="Not linked to anything yet"
          body="Attach this document to the product line, project or work item it describes so it shows up where the work happens."
          action={canEdit ? <button type="button" className="cw-btn" onClick={() => setAdding(true)}>Add relation</button> : undefined}
        />
      ) : (
        <div>
          {grouped.map((g) => (
            <div key={g.type} style={{ marginBottom: 10 }}>
              <div className="cw-pop-label" style={{ padding: '4px 0 2px' }}>{g.label}</div>
              {g.rows.map((l) => (
                <div key={l.id} className="cw-row" style={{ cursor: 'default' }}>
                  <button
                    type="button"
                    onClick={() => open(l)}
                    style={{
                      display: 'flex', alignItems: 'center', gap: 8, flex: 1, minWidth: 0,
                      border: 0, background: 'transparent', font: 'inherit', color: 'inherit',
                      textAlign: 'left', cursor: 'pointer', padding: 0,
                    }}
                  >
                    {l.ref && <span className="cw-mono">{l.ref}</span>}
                    <span className="cw-truncate" style={{ flex: 1 }}>{l.label}</span>
                  </button>
                  {l.status && <StatusChip kind={chipKind(l.entityType) as any} value={l.status} />}
                  {canEdit && (
                    <button
                      type="button"
                      className="cw-icon-btn"
                      style={{ width: 22, height: 22 }}
                      aria-label={`Remove link to ${l.label}`}
                      onClick={() => unlink.mutate(
                        { id: documentId, linkId: l.id },
                        { onError: (e) => toast.error(apiErrorMessage(e)) },
                      )}
                    ><Trash2 size={12} /></button>
                  )}
                </div>
              ))}
            </div>
          ))}
        </div>
      )}

      {adding && (
        <AddRelation
          documentId={documentId}
          verticalId={verticalId}
          existing={links}
          onClose={() => setAdding(false)}
        />
      )}
    </section>
  );
}

/** Two-step picker: choose a record type, then search within it. */
function AddRelation({
  documentId, verticalId, existing, onClose,
}: {
  documentId: string;
  verticalId?: string;
  existing: DocumentLink[];
  onClose: () => void;
}) {
  const link = useLinkDocument();
  const [type, setType] = useState<PmEntityType>('TASK');
  const [search, setSearch] = useState('');

  const scoped = { verticalId, search: search.trim() || undefined, limit: 20 };
  const tasks = useTasks(scoped, { enabled: type === 'TASK' } as any);
  const issues = useIssues(type === 'ISSUE' ? scoped : { limit: 1 });
  const features = useFeatures(type === 'FEATURE' ? scoped : { limit: 1 });
  const projects = useProjects(type === 'PROJECT' ? scoped : { limit: 1 });
  const milestones = useMilestones(type === 'MILESTONE' ? { verticalId } : {});
  const { data: verticals = [] } = useVerticals();

  const taken = new Set(existing.map((l) => `${l.entityType}:${l.entityId}`));

  const options = useMemo(() => {
    const q = search.trim().toLowerCase();
    const match = (s: string) => !q || s.toLowerCase().includes(q);
    switch (type) {
      case 'TASK':
        return (tasks.data?.data ?? []).map((t) => ({ id: t.id, ref: t.ref, label: t.title }));
      case 'ISSUE':
        return (issues.data?.data ?? []).map((i) => ({ id: i.id, ref: i.ref, label: i.title }));
      case 'FEATURE':
        return (features.data?.data ?? []).map((f) => ({ id: f.id, ref: f.ref, label: f.name }));
      case 'PROJECT':
        return (projects.data?.data ?? []).map((p) => ({ id: p.id, ref: null, label: p.name }));
      case 'MILESTONE':
        return (milestones.data ?? []).filter((m) => match(m.name)).map((m) => ({ id: m.id, ref: null, label: m.name }));
      case 'VERTICAL':
        return verticals.filter((v: any) => match(v.name)).map((v: any) => ({ id: v.id, ref: v.key, label: `${v.icon ?? ''} ${v.name}`.trim() }));
      default:
        return [];
    }
  }, [type, search, tasks.data, issues.data, features.data, projects.data, milestones.data, verticals]);

  const add = (entityId: string) => {
    link.mutate(
      { id: documentId, entityType: type, entityId },
      {
        onSuccess: () => { toast.success('Linked'); onClose(); },
        onError: (e) => toast.error(apiErrorMessage(e)),
      },
    );
  };

  return (
    <div style={{
      marginTop: 10, padding: 12, border: '1px solid var(--cw-line)',
      borderRadius: 'var(--cw-r)', display: 'grid', gap: 10,
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        <span className="cw-label" style={{ margin: 0 }}>Link this document to a…</span>
        <button type="button" className="cw-icon-btn" style={{ marginLeft: 'auto', width: 22, height: 22 }} aria-label="Cancel" onClick={onClose}>
          <X size={13} />
        </button>
      </div>

      <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
        {LINKABLE.map((t) => (
          <button
            key={t.type}
            type="button"
            className="cw-chip"
            aria-pressed={type === t.type}
            onClick={() => { setType(t.type); setSearch(''); }}
            style={{
              height: 24, cursor: 'pointer',
              background: type === t.type ? 'var(--cw-ink)' : 'var(--cw-sunken)',
              color: type === t.type ? 'var(--cw-bg)' : 'var(--cw-ink-2)',
            }}
          >{t.label}</button>
        ))}
      </div>

      <input
        className="cw-input"
        autoFocus
        placeholder={`Search ${humanize(type).toLowerCase()}s…`}
        value={search}
        onChange={(e) => setSearch(e.target.value)}
      />

      <div style={{ maxHeight: 220, overflowY: 'auto', border: '1px solid var(--cw-line)', borderRadius: 'var(--cw-r)', padding: 4 }}>
        {options.length === 0 ? (
          <div className="cw-meta" style={{ padding: 10 }}>Nothing matches.</div>
        ) : options.map((o) => {
          const already = taken.has(`${type}:${o.id}`);
          return (
            <button
              key={o.id}
              type="button"
              className="cw-opt"
              disabled={already || link.isPending}
              onClick={() => add(o.id)}
              style={already ? { opacity: 0.5, cursor: 'default' } : undefined}
            >
              {o.ref && <span className="cw-mono">{o.ref}</span>}
              <span className="cw-truncate" style={{ flex: 1 }}>{o.label}</span>
              {already && <span className="cw-opt-hint">linked</span>}
            </button>
          );
        })}
      </div>
    </div>
  );
}

/**
 * The reverse view: documents attached to this record.
 *
 * Rendered identically wherever it appears — task, issue, feature, milestone,
 * project — so the relationship reads the same from either end.
 */
export function RelatedDocuments({
  entityType, entityId,
}: { entityType: PmEntityType; entityId: string }) {
  const { data, isLoading } = useDocumentsFor(entityType, entityId);
  const rows = data ?? [];

  if (isLoading) return null;

  return (
    <div>
      <div className="cw-h2" style={{ marginBottom: 8 }}>Documents</div>
      {!rows.length ? (
        <div className="cw-meta">
          No documents linked. Open a document and use <strong>Add relation</strong> to attach one here.
        </div>
      ) : rows.map((d) => (
        <a key={d.linkId} href={`/consultant/documents/${d.id}`} className="cw-row">
          <FileText size={13} style={{ color: 'var(--cw-ink-3)', flex: 'none' }} />
          <span style={{ minWidth: 0, flex: 1 }}>
            <span className="cw-truncate" style={{ display: 'block', fontWeight: 520 }}>{d.title}</span>
            {d.summary && <span className="cw-truncate cw-meta" style={{ display: 'block' }}>{d.summary}</span>}
          </span>
          <span className="cw-meta">{humanize(d.type)}</span>
        </a>
      ))}
    </div>
  );
}
