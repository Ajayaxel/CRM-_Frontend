'use client';

/**
 * Search results page (spec §4).
 *
 * ⌘K covers most searching; this page exists for the times you want to keep
 * results on screen while working through them. Grouped by entity, because
 * "INS-102" and a document called "Insurance renewals" are not competing for
 * the same slot.
 */

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { Search as SearchIcon } from 'lucide-react';
import { usePmSearch, useVerticals } from '../api';
import { Avatar, Empty, OptionList, Popover, Skeleton, fmtDate, humanize } from '../ui/primitives';
import { StatusChip } from '../ui/cells';
import { useWorkspace } from '../ui/workspace-context';
import { Page, Section, SectionGrid } from './page';

export function SearchScreen() {
  const params = useSearchParams();
  const ws = useWorkspace();
  const [q, setQ] = useState(params.get('q') ?? '');
  const [debounced, setDebounced] = useState(q);
  const [verticalId, setVerticalId] = useState<string | null>(null);
  const { data: verticals = [] } = useVerticals();

  // Typing "insurance renewal" should not fire nine queries.
  useEffect(() => {
    const id = setTimeout(() => setDebounced(q), 220);
    return () => clearTimeout(id);
  }, [q]);

  const { data, isLoading } = usePmSearch(debounced, verticalId ?? undefined);
  const current = verticals.find((v: any) => v.id === verticalId);

  return (
    <Page
      crumbs={[{ label: 'Consultant', href: '/consultant' }, { label: 'Search' }]}
      title="Search"
      description="Product lines, projects, tasks, issues, features, milestones, documents, comments, deployments and people."
      actions={
        <Popover
          align="end"
          width={260}
          trigger={({ ref, onClick }) => (
            <button type="button" ref={ref as any} className="cw-btn" onClick={onClick}>
              {current ? `${(current as any).icon ?? ''} ${current.name}` : 'All product lines'}
            </button>
          )}
        >
          {({ close }) => (
            <OptionList
              searchable
              value={verticalId ?? undefined}
              options={verticals.map((v: any) => ({ value: v.id, label: `${v.icon ?? ''} ${v.name}`.trim() }))}
              onPick={(v) => { setVerticalId(v); close(); }}
              footer={verticalId ? <button type="button" className="cw-opt" onClick={() => { setVerticalId(null); close(); }}>All product lines</button> : undefined}
            />
          )}
        </Popover>
      }
    >
      <div style={{ position: 'relative', maxWidth: 520, margin: '10px 0 18px' }}>
        <SearchIcon size={14} style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', color: 'var(--cw-ink-3)' }} />
        <input
          className="cw-input"
          autoFocus
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Search everything…"
          style={{ paddingLeft: 32, height: 34 }}
        />
      </div>

      {debounced.trim().length < 2 ? (
        <Empty icon={SearchIcon} title="Type to search" body="Two characters is enough. Refs like INS-102 work too, and ⌘K does the same from anywhere." />
      ) : isLoading ? (
        <Skeleton rows={4} height={40} />
      ) : !data || data.total === 0 ? (
        <Empty icon={SearchIcon} title={`Nothing matches “${debounced}”`} body="Try a shorter term, or clear the product line filter." />
      ) : (
        <SectionGrid>
          <Group title="Product lines" rows={data.verticals} render={(v: any) => (
            <Link key={v.id} href={`/consultant/verticals/${v.id}`} className="cw-row">
              <span style={{ width: 16, textAlign: 'center', flex: 'none' }}>{v.icon ?? '▪'}</span>
              <span className="cw-truncate" style={{ flex: 1, fontWeight: 520 }}>{v.name}</span>
              <StatusChip kind="vertical" value={v.status} />
            </Link>
          )} />
          <Group title="Projects" rows={data.projects} render={(p: any) => (
            <Link key={p.id} href={`/consultant/projects/${p.id}`} className="cw-row">
              <span className="cw-truncate" style={{ flex: 1, fontWeight: 520 }}>{p.name}</span>
              <span className="cw-meta cw-truncate" style={{ maxWidth: 110 }}>{p.vertical?.name}</span>
              <StatusChip kind="project" value={p.status} />
            </Link>
          )} />
          <Group title="Tasks" rows={data.tasks} render={(t: any) => (
            <button key={t.id} type="button" className="cw-row" onClick={() => ws.openRecord('TASK', t.id)}>
              <span className="cw-mono">{t.ref}</span>
              <span className="cw-truncate" style={{ flex: 1 }}>{t.title}</span>
              <StatusChip kind="task" value={t.status} />
            </button>
          )} />
          <Group title="Issues" rows={data.issues} render={(i: any) => (
            <button key={i.id} type="button" className="cw-row" onClick={() => ws.openRecord('ISSUE', i.id)}>
              <span className="cw-mono">{i.ref}</span>
              <span className="cw-truncate" style={{ flex: 1 }}>{i.title}</span>
              <StatusChip kind="severity" value={i.severity} />
            </button>
          )} />
          <Group title="Features" rows={data.features} render={(f: any) => (
            <button key={f.id} type="button" className="cw-row" onClick={() => ws.openRecord('FEATURE', f.id)}>
              <span className="cw-mono">{f.ref}</span>
              <span className="cw-truncate" style={{ flex: 1 }}>{f.name}</span>
              <StatusChip kind="feature" value={f.status} />
            </button>
          )} />
          <Group title="Milestones" rows={data.milestones} render={(m: any) => (
            <button key={m.id} type="button" className="cw-row" onClick={() => ws.openRecord('MILESTONE', m.id)}>
              <span className="cw-truncate" style={{ flex: 1 }}>{m.name}</span>
              <span className="cw-meta cw-num">{fmtDate(m.targetDate)}</span>
            </button>
          )} />
          <Group title="Documents" rows={data.documents} render={(d: any) => (
            <Link key={d.id} href={`/consultant/documents/${d.id}`} className="cw-row">
              <span className="cw-truncate" style={{ flex: 1 }}>{d.title}</span>
              <span className="cw-meta">{humanize(d.type)}</span>
            </Link>
          )} />
          <Group title="People" rows={data.people} render={(p: any) => p && (
            <button key={p.id} type="button" className="cw-row" onClick={() => ws.openRecord('DEVELOPER', p.id)}>
              <Avatar name={p.name} size={20} />
              <span className="cw-truncate" style={{ flex: 1 }}>{p.name}</span>
              <span className="cw-meta cw-truncate" style={{ maxWidth: 150 }}>{p.email}</span>
            </button>
          )} />
          <Group title="Comments" rows={data.comments} render={(c: any) => (
            <div key={c.id} className="cw-row" style={{ cursor: 'default', alignItems: 'flex-start' }}>
              <Avatar name={c.author?.name} size={19} />
              <span style={{ minWidth: 0, flex: 1 }}>
                <span className="cw-truncate" style={{ display: 'block' }}>{c.body}</span>
                <span className="cw-meta">on {humanize(c.entityType)} · {fmtDate(c.createdAt)}</span>
              </span>
            </div>
          )} />
          <Group title="Deployments" rows={data.deployments} render={(d: any) => (
            <Link key={d.id} href="/consultant/deployments" className="cw-row">
              <span className="cw-truncate" style={{ flex: 1 }}>{d.version ?? 'Deployment'}</span>
              <span className="cw-meta">{humanize(d.environment)}</span>
              <StatusChip kind="deployment" value={d.status} />
            </Link>
          )} />
        </SectionGrid>
      )}
    </Page>
  );
}

function Group({ title, rows, render }: { title: string; rows?: any[]; render: (row: any) => React.ReactNode }) {
  if (!rows?.length) return null;
  return <Section title={title} count={rows.length}>{rows.map(render)}</Section>;
}
