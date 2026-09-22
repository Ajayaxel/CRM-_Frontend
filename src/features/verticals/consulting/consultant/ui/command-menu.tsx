'use client';

/**
 * Command menu (spec §4, §29).
 *
 * One surface for both "find something" and "do something": typing searches
 * every entity, an empty query shows actions and navigation. Arrow keys move,
 * Enter runs, Escape closes — the whole thing is reachable without the mouse,
 * which is the point.
 */

import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  ArrowRight, Bug, CalendarDays, CornerDownLeft, FileText, Flag, FolderKanban,
  Inbox, LayoutGrid, Lightbulb, ListChecks, Rocket, Search, Users,
} from 'lucide-react';
import { usePmSearch, useVerticals } from '../api';
import { Avatar, humanize } from './primitives';
import { useWorkspace } from './workspace-context';

interface Item {
  id: string;
  group: string;
  label: string;
  hint?: string;
  icon: React.ReactNode;
  run: () => void;
}

export function CommandMenu() {
  const router = useRouter();
  const ws = useWorkspace();
  const [q, setQ] = useState('');
  const [cursor, setCursor] = useState(0);
  const listRef = useRef<HTMLDivElement>(null);
  const { data: verticals = [] } = useVerticals();
  const { data: results } = usePmSearch(q, undefined);

  // ⌘K / Ctrl+K anywhere in the workspace.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        ws.setCommandOpen(!ws.commandOpen);
      }
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [ws]);

  useEffect(() => { if (ws.commandOpen) { setQ(''); setCursor(0); } }, [ws.commandOpen]);

  const go = (href: string) => { router.push(href); ws.setCommandOpen(false); };
  const act = (fn: () => void) => { fn(); ws.setCommandOpen(false); };

  const items = useMemo<Item[]>(() => {
    const term = q.trim();

    if (!term) {
      const nav: Item[] = [
        { id: 'n-home', group: 'Go to', label: 'Home', icon: <LayoutGrid size={14} />, run: () => go('/consultant') },
        { id: 'n-mywork', group: 'Go to', label: 'My work', icon: <Inbox size={14} />, run: () => go('/consultant/my-work') },
        { id: 'n-verticals', group: 'Go to', label: 'Product Lines', icon: <LayoutGrid size={14} />, run: () => go('/consultant/verticals') },
        { id: 'n-projects', group: 'Go to', label: 'Projects', icon: <FolderKanban size={14} />, run: () => go('/consultant/projects') },
        { id: 'n-tasks', group: 'Go to', label: 'Tasks', icon: <ListChecks size={14} />, run: () => go('/consultant/tasks') },
        { id: 'n-issues', group: 'Go to', label: 'Issues', icon: <Bug size={14} />, run: () => go('/consultant/issues') },
        { id: 'n-features', group: 'Go to', label: 'Features', icon: <Lightbulb size={14} />, run: () => go('/consultant/features') },
        { id: 'n-milestones', group: 'Go to', label: 'Milestones', icon: <Flag size={14} />, run: () => go('/consultant/milestones') },
        { id: 'n-team', group: 'Go to', label: 'Team', icon: <Users size={14} />, run: () => go('/consultant/team') },
        { id: 'n-docs', group: 'Go to', label: 'Documents', icon: <FileText size={14} />, run: () => go('/consultant/documents') },
        { id: 'n-deploy', group: 'Go to', label: 'Deployments', icon: <Rocket size={14} />, run: () => go('/consultant/deployments') },
        { id: 'n-cal', group: 'Go to', label: 'Calendar', icon: <CalendarDays size={14} />, run: () => go('/consultant/calendar') },
      ];
      const create: Item[] = [
        { id: 'c-task', group: 'Create', label: 'New task', hint: 'T', icon: <ListChecks size={14} />, run: () => act(() => ws.create('TASK')) },
        { id: 'c-issue', group: 'Create', label: 'New issue', hint: 'I', icon: <Bug size={14} />, run: () => act(() => ws.create('ISSUE')) },
        { id: 'c-feature', group: 'Create', label: 'New feature', hint: 'F', icon: <Lightbulb size={14} />, run: () => act(() => ws.create('FEATURE')) },
        { id: 'c-project', group: 'Create', label: 'New project', hint: 'P', icon: <FolderKanban size={14} />, run: () => act(() => ws.create('PROJECT')) },
        { id: 'c-milestone', group: 'Create', label: 'New milestone', icon: <Flag size={14} />, run: () => act(() => ws.create('MILESTONE')) },
        { id: 'c-doc', group: 'Create', label: 'New document', icon: <FileText size={14} />, run: () => act(() => ws.create('DOCUMENT')) },
        { id: 'c-vertical', group: 'Create', label: 'New product line', icon: <LayoutGrid size={14} />, run: () => act(() => ws.create('VERTICAL')) },
      ];
      const verts: Item[] = verticals.slice(0, 8).map((v: any) => ({
        id: `v-${v.id}`,
        group: 'Product Lines',
        label: `${v.icon ?? ''} ${v.name}`.trim(),
        hint: v.key,
        icon: <span style={{ width: 14, textAlign: 'center' }}>{v.icon ?? '▪'}</span>,
        run: () => go(`/consultant/verticals/${v.id}`),
      }));
      return [...create, ...nav, ...verts];
    }

    if (!results) return [];
    const out: Item[] = [];
    for (const v of results.verticals ?? []) {
      out.push({ id: `v${v.id}`, group: 'Product Lines', label: v.name, hint: v.key, icon: <span style={{ width: 14, textAlign: 'center' }}>{v.icon ?? '▪'}</span>, run: () => go(`/consultant/verticals/${v.id}`) });
    }
    for (const p of results.projects ?? []) {
      out.push({ id: `p${p.id}`, group: 'Projects', label: p.name, hint: p.vertical?.name, icon: <FolderKanban size={14} />, run: () => go(`/consultant/projects/${p.id}`) });
    }
    for (const t of results.tasks ?? []) {
      out.push({ id: `t${t.id}`, group: 'Tasks', label: t.title, hint: t.ref, icon: <ListChecks size={14} />, run: () => act(() => ws.openRecord('TASK', t.id)) });
    }
    for (const i of results.issues ?? []) {
      out.push({ id: `i${i.id}`, group: 'Issues', label: i.title, hint: i.ref, icon: <Bug size={14} />, run: () => act(() => ws.openRecord('ISSUE', i.id)) });
    }
    for (const f of results.features ?? []) {
      out.push({ id: `f${f.id}`, group: 'Features', label: f.name, hint: f.ref, icon: <Lightbulb size={14} />, run: () => act(() => ws.openRecord('FEATURE', f.id)) });
    }
    for (const m of results.milestones ?? []) {
      out.push({ id: `m${m.id}`, group: 'Milestones', label: m.name, hint: m.vertical?.name, icon: <Flag size={14} />, run: () => act(() => ws.openRecord('MILESTONE', m.id)) });
    }
    for (const d of results.documents ?? []) {
      out.push({ id: `d${d.id}`, group: 'Documents', label: d.title, hint: humanize(d.type), icon: <FileText size={14} />, run: () => go(`/consultant/documents/${d.id}`) });
    }
    for (const p of results.people ?? []) {
      if (!p) continue;
      out.push({ id: `u${p.id}`, group: 'People', label: p.name, hint: p.email, icon: <Avatar name={p.name} size={18} />, run: () => act(() => ws.openRecord('DEVELOPER', p.id)) });
    }
    for (const d of results.deployments ?? []) {
      out.push({ id: `dep${d.id}`, group: 'Deployments', label: d.version ?? 'Deployment', hint: d.vertical?.name, icon: <Rocket size={14} />, run: () => go('/consultant/deployments') });
    }
    return out;
  }, [q, results, verticals]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => { setCursor(0); }, [q]);
  useEffect(() => {
    listRef.current?.querySelector<HTMLElement>(`[data-i="${cursor}"]`)?.scrollIntoView({ block: 'nearest' });
  }, [cursor]);

  if (!ws.commandOpen) return null;

  const onKey = (e: React.KeyboardEvent) => {
    if (e.key === 'ArrowDown') { e.preventDefault(); setCursor((c) => Math.min(c + 1, items.length - 1)); }
    if (e.key === 'ArrowUp') { e.preventDefault(); setCursor((c) => Math.max(c - 1, 0)); }
    if (e.key === 'Enter') { e.preventDefault(); items[cursor]?.run(); }
    if (e.key === 'Escape') ws.setCommandOpen(false);
  };

  let lastGroup: string | undefined;

  return (
    <div className="cw-cmd-scrim" onClick={() => ws.setCommandOpen(false)}>
      <div className="cw-cmd cw" onClick={(e) => e.stopPropagation()}>
        <div className="cw-cmd-input">
          <Search size={16} style={{ color: 'var(--cw-ink-3)', flex: 'none' }} />
          <input
            autoFocus
            value={q}
            onChange={(e) => setQ(e.target.value)}
            onKeyDown={onKey}
            placeholder="Search work, or type a command…"
          />
          <span className="cw-kbd">ESC</span>
        </div>

        <div className="cw-cmd-body" ref={listRef}>
          {items.length === 0 && (
            <div className="cw-meta" style={{ padding: '22px 12px', textAlign: 'center' }}>
              {q.trim() ? `Nothing matches “${q.trim()}”` : 'Start typing…'}
            </div>
          )}
          {items.map((it, i) => {
            const header = it.group !== lastGroup ? it.group : null;
            lastGroup = it.group;
            return (
              <React.Fragment key={it.id}>
                {header && <div className="cw-pop-label">{header}</div>}
                <button
                  type="button"
                  data-i={i}
                  data-active={i === cursor}
                  className="cw-opt"
                  onMouseEnter={() => setCursor(i)}
                  onClick={it.run}
                >
                  <span style={{ color: 'var(--cw-ink-3)', display: 'inline-flex', flex: 'none' }}>{it.icon}</span>
                  <span className="cw-truncate" style={{ flex: 1 }}>{it.label}</span>
                  {it.hint && <span className="cw-opt-hint">{it.hint}</span>}
                  {i === cursor && <CornerDownLeft size={12} style={{ color: 'var(--cw-ink-4)', flex: 'none' }} />}
                </button>
              </React.Fragment>
            );
          })}
        </div>

        <div className="cw-cmd-foot">
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5 }}><span className="cw-kbd">↑</span><span className="cw-kbd">↓</span> navigate</span>
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5 }}><span className="cw-kbd">↵</span> open</span>
          <span style={{ marginLeft: 'auto', display: 'inline-flex', alignItems: 'center', gap: 5 }}>
            <ArrowRight size={11} /> {items.length} result{items.length === 1 ? '' : 's'}
          </span>
        </div>
      </div>
    </div>
  );
}
