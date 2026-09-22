'use client';

/**
 * Documentation (spec §20).
 *
 * A library list plus a block editor. Documents autosave; the body round-trips
 * through HTML so the existing sanitising API stays unchanged.
 */

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { FileText, History, Pin, Plus, Save } from 'lucide-react';
import { toast } from 'sonner';
import { useAuth } from '@/features/foundation/auth';
import { apiErrorMessage } from '@/lib/api';
import { useDocument, useDocuments, useUpdateDocument, type DocumentSummary } from '../api';
import { Table, type Column } from '../ui/table';
import { FilterBar, type ActiveFilter, type FilterDef } from '../ui/filters';
import {
  Empty, ErrorState, Loading, OptionList, Person, Popover, fmtAgo, fmtDateTime, humanize,
} from '../ui/primitives';
import { BlockEditor } from '../records/block-editor';
import { DocumentLinks } from '../records/document-links';
import { Panel } from '../ui/panel';
import { DOC_TYPES } from '../records/create-constants';
import { useWorkspace } from '../ui/workspace-context';
import { Page } from './page';

export function DocumentsScreen({
  verticalId, projectId, embedded,
}: { verticalId?: string; projectId?: string; embedded?: boolean }) {
  const router = useRouter();
  const { hasPermission } = useAuth();
  const ws = useWorkspace();
  const [filters, setFilters] = useState<ActiveFilter[]>([]);
  const [search, setSearch] = useState('');

  const typeFilter = filters.find((f) => f.key === 'type');
  const { data, isLoading } = useDocuments({
    verticalId, projectId, limit: 200,
    search: search.trim() || undefined,
    type: typeFilter?.values.join(','),
  });

  const canCreate = hasPermission('pm.document.create');

  const defs = useMemo<FilterDef[]>(() => [
    { key: 'type', label: 'Type', type: 'enum', options: DOC_TYPES.map((t) => ({ value: t, label: humanize(t) })) },
  ], []);

  const columns = useMemo<Column<DocumentSummary>[]>(() => [
    {
      key: 'title', header: 'Document', width: 340, minWidth: 200, locked: true, sortValue: (d) => d.title,
      render: (d) => (
        <span style={{ display: 'flex', alignItems: 'center', gap: 8, minWidth: 0 }}>
          {d.pinned && <Pin size={11} style={{ color: 'var(--cw-amber)', flex: 'none' }} />}
          <span style={{ minWidth: 0 }}>
            <span className="cw-truncate" style={{ fontWeight: 560 }}>{d.title}</span>
            {d.summary && <span className="cw-truncate cw-meta" style={{ display: 'block' }}>{d.summary}</span>}
          </span>
        </span>
      ),
    },
    { key: 'type', header: 'Type', width: 168, sortValue: (d) => d.type, render: (d) => <span className="cw-meta">{humanize(d.type)}</span> },
    { key: 'version', header: 'Version', width: 84, align: 'right', sortValue: (d) => d.version, render: (d) => <span className="cw-num cw-meta">v{d.version}</span> },
    { key: 'updatedBy', header: 'Updated by', width: 178, sortValue: (d) => d.updatedBy?.name, render: (d) => <Person person={d.updatedBy ?? d.author} size={19} muted /> },
    ...(!verticalId ? [{
      key: 'vertical', header: 'Product line', width: 150, sortValue: (d: DocumentSummary) => d.vertical?.name,
      render: (d: DocumentSummary) => <span className="cw-truncate cw-meta">{d.vertical.icon} {d.vertical.name}</span>,
    } as Column<DocumentSummary>] : []),
    { key: 'links', header: 'Links', width: 74, align: 'right', defaultHidden: true, sortValue: (d) => d._count?.links ?? 0, render: (d) => <span className="cw-num cw-meta">{d._count?.links ?? 0}</span> },
    { key: 'updatedAt', header: 'Updated', width: 96, align: 'right', sortValue: (d) => d.updatedAt, render: (d) => <span className="cw-meta">{fmtAgo(d.updatedAt)}</span> },
  ], [verticalId]);

  const body = (
    <>
      <FilterBar
        defs={defs}
        filters={filters}
        onChange={setFilters}
        right={
          <span style={{ display: 'inline-flex', gap: 6 }}>
            <input className="cw-input" style={{ width: 220 }} placeholder="Search documents…" value={search} onChange={(e) => setSearch(e.target.value)} />
            {canCreate && (
              <button className="cw-btn cw-btn-primary" onClick={() => ws.create('DOCUMENT', { verticalId, projectId })}>
                <Plus size={13} /> New document
              </button>
            )}
          </span>
        }
      />
      <Table
        id={`documents:${verticalId ?? 'global'}`}
        rows={data?.data ?? []}
        columns={columns}
        rowKey={(d) => d.id}
        loading={isLoading}
        onRowClick={(d) => router.push(`/consultant/documents/${d.id}`)}
        toolbarSlot={<span className="cw-meta">{data?.meta.total ?? 0} document{data?.meta.total === 1 ? '' : 's'}</span>}
        empty={
          <Empty
            icon={FileText}
            title="No documents yet"
            body="Requirements, architecture notes, SOPs, runbooks and decision records live here — linked to the work they describe."
            action={canCreate ? <button className="cw-btn cw-btn-primary" onClick={() => ws.create('DOCUMENT', { verticalId, projectId })}>Write the first one</button> : undefined}
          />
        }
      />
    </>
  );

  if (embedded) return body;
  return (
    <Page
      crumbs={[{ label: 'Consultant', href: '/consultant' }, { label: 'Documents' }]}
      title="Documentation"
      description="The written record behind the work."
    >
      {body}
    </Page>
  );
}


// ============================================================ Document record

/**
 * The writing surface.
 *
 * Autosaves on a debounce rather than behind a Save button — a runbook nobody
 * remembered to save is worse than no runbook. The button remains for people
 * who want the reassurance, and ⌘S still works.
 */
export function DocumentRecord({ documentId }: { documentId: string }) {
  const { hasPermission } = useAuth();
  const query = useDocument(documentId);
  const doc = query.data;
  const update = useUpdateDocument();

  const [title, setTitle] = useState('');
  const [body, setBody] = useState('');
  const [dirty, setDirty] = useState(false);
  const [savedAt, setSavedAt] = useState<Date | null>(null);
  const [versionsOpen, setVersionsOpen] = useState(false);

  const canEdit = hasPermission('pm.document.update');

  useEffect(() => {
    if (!doc) return;
    setTitle(doc.title);
    setBody(doc.body ?? '');
    setDirty(false);
  }, [doc?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  const latest = useRef({ title, body });
  latest.current = { title, body };

  const save = useCallback(() => {
    if (!canEdit) return;
    update.mutate(
      { id: documentId, title: latest.current.title.trim() || 'Untitled', body: latest.current.body },
      {
        onSuccess: () => { setDirty(false); setSavedAt(new Date()); },
        onError: (e) => toast.error(apiErrorMessage(e)),
      },
    );
  }, [canEdit, documentId, update]);

  // Debounced autosave. Two seconds is long enough that a paragraph is one
  // revision rather than twenty, and short enough to survive a closed tab.
  useEffect(() => {
    if (!dirty) return;
    const id = window.setTimeout(save, 2000);
    return () => window.clearTimeout(id);
  }, [dirty, title, body, save]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 's') { e.preventDefault(); if (dirty) save(); }
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [dirty, save]);

  if (query.isLoading) return <Page><Loading kind="text" rows={8} /></Page>;
  if (query.isError || !doc) {
    return <Page><ErrorState error={query.error} what="this document" onRetry={query.refetch} /></Page>;
  }

  return (
    <Page
      crumbs={[
        { label: 'Consultant', href: '/consultant' },
        { label: doc.vertical.name, href: `/consultant/verticals/${doc.vertical.id}` },
        { label: 'Documents', href: '/consultant/documents' },
        { label: doc.title },
      ]}
      actions={
        <>
          <span className="cw-meta" aria-live="polite" style={{ marginRight: 4 }}>
            {update.isPending ? 'Saving…' : dirty ? 'Unsaved' : savedAt ? `Saved ${fmtAgo(savedAt)}` : `v${doc.version}`}
          </span>
          <button className="cw-btn cw-btn-ghost" onClick={() => setVersionsOpen(true)}><History size={13} /> History</button>
          {canEdit && (
            <>
              <button className="cw-btn cw-btn-ghost" onClick={() => update.mutate({ id: documentId, pinned: !doc.pinned })}>
                <Pin size={13} /> {doc.pinned ? 'Unpin' : 'Pin'}
              </button>
              <button className="cw-btn cw-btn-primary" onClick={save} disabled={!dirty || update.isPending}>
                <Save size={13} /> Save
              </button>
            </>
          )}
        </>
      }
    >
      <div style={{ maxWidth: 760, margin: '0 auto', paddingTop: 14 }}>
        <input
          value={title}
          disabled={!canEdit}
          onChange={(e) => { setTitle(e.target.value); setDirty(true); }}
          className="cw-doc-title"
          placeholder="Untitled"
          aria-label="Document title"
        />

        <div style={{ display: 'flex', alignItems: 'center', gap: 8, margin: '6px 0 20px', flexWrap: 'wrap' }}>
          <DocTypePicker
            value={doc.type}
            editable={canEdit}
            onChange={(t) => update.mutate({ id: documentId, type: t })}
          />
          <span className="cw-meta">
            updated {fmtDateTime(doc.updatedAt)} by {doc.updatedBy?.name ?? doc.author?.name ?? 'unknown'}
          </span>
          {doc.links.length > 0 && <span className="cw-meta">· linked to {doc.links.length} record{doc.links.length === 1 ? '' : 's'}</span>}
        </div>

        <BlockEditor
          value={body}
          editable={canEdit}
          onChange={(html) => { setBody(html); setDirty(true); }}
        />

        <DocumentLinks documentId={documentId} verticalId={doc.vertical.id} links={doc.links} />
      </div>

      <Panel open={versionsOpen} onClose={() => setVersionsOpen(false)} title="Version history" width={420}>
        {!doc.versions?.length ? (
          <Empty compact title="No earlier versions" body="This document has not been revised yet." />
        ) : doc.versions.map((v) => (
          <div key={v.id} className="cw-row" style={{ cursor: 'default' }}>
            <span className="cw-num" style={{ fontWeight: 650, width: 32, flex: 'none' }}>v{v.version}</span>
            <span style={{ minWidth: 0, flex: 1 }}>
              <span className="cw-truncate" style={{ display: 'block' }}>{v.title}</span>
              {v.note && <span className="cw-meta">{v.note}</span>}
            </span>
            <span className="cw-meta">{fmtDateTime(v.createdAt)}</span>
          </div>
        ))}
      </Panel>
    </Page>
  );
}

function DocTypePicker({
  value, editable, onChange,
}: { value: string; editable: boolean; onChange: (t: string) => void }) {
  if (!editable) return <span className="cw-tag">{humanize(value)}</span>;
  return (
    <Popover
      width={230}
      trigger={({ ref, onClick }) => (
        <button type="button" ref={ref as any} className="cw-tag" onClick={onClick} style={{ cursor: 'pointer', gap: 4 }}>
          {humanize(value)}
        </button>
      )}
    >
      {({ close }) => (
        <OptionList
          value={value}
          options={DOC_TYPES.map((t) => ({ value: t, label: humanize(t) }))}
          onPick={(v) => { onChange(v); close(); }}
        />
      )}
    </Popover>
  );
}
