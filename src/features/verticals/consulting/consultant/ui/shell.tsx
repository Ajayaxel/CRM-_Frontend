'use client';

/**
 * Workspace shell — compact rail, topbar, and the persistent workspace context.
 *
 * The rail collapses to icons and remembers the choice. Everything global lives
 * here once: ⌘K, the shortcut sheet, the notification centre, quick create and
 * the record peek panel, so no screen has to mount its own copy.
 */

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import {
  Activity, Bell, Bug, ChevronsLeft, ChevronsRight, FileText, Flag,
  FolderKanban, Inbox, Keyboard, LayoutGrid, Lightbulb, ListChecks, LogOut,
  Menu as MenuIcon, Plus, Rocket, Rows2, Rows3, Search, Settings, Users,
} from 'lucide-react';
import { useAuth } from '@/features/foundation/auth';
import { useMarkNotificationsRead, usePmNotifications } from '../api';
import { Avatar, Menu, Popover, fmtAgo, humanize } from './primitives';
import {
  WorkspaceCtx, type CreateDefaults, type CreateKind, type RecordKind, type RecordRef,
} from './workspace-context';
import { CommandMenu } from './command-menu';
import { ShortcutsHelp, useShortcuts } from './keyboard';
import { RecordPanels } from '../records/record-panels';
import { CreatePanels } from '../records/create-panels';

const RAIL_KEY = 'bmn.cw.rail-collapsed';
const DENSITY_KEY = 'bmn.cw.density';

interface NavEntry {
  label: string;
  href: string;
  icon: any;
  permission?: string;
  exact?: boolean;
}

const PRIMARY: NavEntry[] = [
  { label: 'Home', href: '/consultant', icon: LayoutGrid, permission: 'pm.vertical.view', exact: true },
  { label: 'My Work', href: '/consultant/my-work', icon: Inbox, permission: 'pm.task.view' },
];

const WORK: NavEntry[] = [
  { label: 'Product Lines', href: '/consultant/verticals', icon: LayoutGrid, permission: 'pm.vertical.view' },
  { label: 'Projects', href: '/consultant/projects', icon: FolderKanban, permission: 'pm.project.view' },
  { label: 'Tasks', href: '/consultant/tasks', icon: ListChecks, permission: 'pm.task.view' },
  { label: 'Issues', href: '/consultant/issues', icon: Bug, permission: 'pm.issue.view' },
  { label: 'Features', href: '/consultant/features', icon: Lightbulb, permission: 'pm.feature.view' },
  { label: 'Milestones', href: '/consultant/milestones', icon: Flag, permission: 'pm.milestone.view' },
];

const OPS: NavEntry[] = [
  { label: 'Team', href: '/consultant/team', icon: Users, permission: 'pm.vertical.view' },
  { label: 'Documents', href: '/consultant/documents', icon: FileText, permission: 'pm.document.view' },
  { label: 'Deployments', href: '/consultant/deployments', icon: Rocket, permission: 'pm.deployment.view' },
  { label: 'Activity', href: '/consultant/activity', icon: Activity, permission: 'pm.vertical.view' },
];

export function WorkspaceShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const { user, hasPermission, logout } = useAuth();

  const [collapsed, setCollapsed] = useState(false);
  const [mobileNavOpen, setMobileNavOpen] = useState(false);
  const [commandOpen, setCommandOpen] = useState(false);
  const [helpOpen, setHelpOpen] = useState(false);
  const [density, setDensityState] = useState<'comfortable' | 'compact'>('comfortable');
  const [creating, setCreating] = useState<{ kind: CreateKind; defaults?: CreateDefaults } | null>(null);

  // Record navigation is a stack with a cursor, so following a relationship is
  // reversible. `trail` holds every record visited in this chain.
  const [trail, setTrail] = useState<RecordRef[]>([]);
  const [cursor, setCursor] = useState(-1);
  const record = cursor >= 0 ? trail[cursor] ?? null : null;

  useEffect(() => {
    try {
      setCollapsed(window.localStorage.getItem(RAIL_KEY) === '1');
      const d = window.localStorage.getItem(DENSITY_KEY);
      if (d === 'compact' || d === 'comfortable') setDensityState(d);
    } catch { /* storage disabled */ }
  }, []);

  const toggleSidebar = useCallback(() => {
    setCollapsed((c) => {
      const next = !c;
      try { window.localStorage.setItem(RAIL_KEY, next ? '1' : '0'); } catch { /* noop */ }
      return next;
    });
  }, []);

  const setDensity = useCallback((d: 'comfortable' | 'compact') => {
    setDensityState(d);
    try { window.localStorage.setItem(DENSITY_KEY, d); } catch { /* noop */ }
  }, []);

  const openRecord = useCallback((kind: RecordKind, id: string) => {
    setTrail((t) => {
      const base = cursor >= 0 ? t.slice(0, cursor + 1) : [];
      // Re-opening the record already on screen must not stack a duplicate.
      const top = base[base.length - 1];
      if (top && top.kind === kind && top.id === id) return base;
      const next = [...base, { kind, id }];
      setCursor(next.length - 1);
      return next;
    });
    if (cursor < 0) setCursor(0);
  }, [cursor]);

  const closeRecord = useCallback(() => { setTrail([]); setCursor(-1); }, []);
  const back = useCallback(() => setCursor((c) => Math.max(0, c - 1)), []);
  const forward = useCallback(() => setCursor((c) => Math.min(trail.length - 1, c + 1)), [trail.length]);

  const api = useMemo(() => ({
    openRecord,
    closeRecord,
    record,
    back,
    forward,
    canBack: cursor > 0,
    canForward: cursor >= 0 && cursor < trail.length - 1,
    create: (kind: CreateKind, defaults?: CreateDefaults) => setCreating({ kind, defaults }),
    commandOpen,
    setCommandOpen,
    helpOpen,
    setHelpOpen,
    sidebarCollapsed: collapsed,
    toggleSidebar,
    density,
    setDensity,
  }), [openRecord, closeRecord, record, back, forward, cursor, trail.length, commandOpen, helpOpen, collapsed, toggleSidebar, density, setDensity]);

  // Global shortcuts. Panels and the command menu handle their own Escape, so
  // these stay out of the way while a modal surface is open.
  const modalOpen = commandOpen || helpOpen || Boolean(creating);
  useShortcuts({
    '?': () => setHelpOpen(true),
    '/': () => setCommandOpen(true),
    c: () => setCreating({ kind: 'TASK' }),
    'g h': () => router.push('/consultant'),
    'g m': () => router.push('/consultant/my-work'),
    'g v': () => router.push('/consultant/verticals'),
    'g p': () => router.push('/consultant/projects'),
    'g t': () => router.push('/consultant/tasks'),
    'g i': () => router.push('/consultant/issues'),
    'g f': () => router.push('/consultant/features'),
    'g d': () => router.push('/consultant/documents'),
    'g a': () => router.push('/consultant/activity'),
    '[': () => { if (cursor > 0) back(); },
    ']': () => { if (cursor >= 0 && cursor < trail.length - 1) forward(); },
  }, { enabled: !modalOpen });

  // Route changes close the peek so a back-button press does not leave a panel
  // hovering over an unrelated screen.
  useEffect(() => { closeRecord(); setMobileNavOpen(false); }, [pathname, closeRecord]);

  const isActive = (e: NavEntry) =>
    e.exact ? pathname === e.href : pathname === e.href || pathname.startsWith(`${e.href}/`);

  const renderGroup = (label: string | null, entries: NavEntry[]) => {
    const visible = entries.filter((e) => !e.permission || hasPermission(e.permission));
    if (!visible.length) return null;
    return (
      <div className="cw-nav-group">
        {label && <div className="cw-nav-label">{label}</div>}
        {visible.map((e) => (
          <Link
            key={e.href}
            href={e.href}
            className="cw-nav-item"
            data-active={isActive(e)}
            title={collapsed ? e.label : undefined}
            aria-current={isActive(e) ? 'page' : undefined}
          >
            <e.icon size={15} />
            <span className="cw-nav-text">{e.label}</span>
          </Link>
        ))}
      </div>
    );
  };

  return (
    <WorkspaceCtx.Provider value={api}>
      <div className="cw cw-app" data-density={density}>
        {mobileNavOpen && <div className="cw-rail-scrim cw-only-mobile" onClick={() => setMobileNavOpen(false)} />}
        <aside className="cw-rail" data-collapsed={collapsed} data-mobile-open={mobileNavOpen}>
          <div style={{ padding: '10px 10px 6px', display: 'flex', alignItems: 'center', gap: 8 }}>
            <span style={{
              width: 24, height: 24, borderRadius: 6, flex: 'none',
              background: 'linear-gradient(135deg,#1B2C8C,#0D1854)', color: '#fff',
              display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
              fontSize: 11, fontWeight: 800, letterSpacing: '-0.03em',
            }}>B</span>
            {!collapsed && (
              <Menu
                align="start"
                width={236}
                trigger={({ ref, onClick }) => (
                  <button type="button" ref={ref as any} onClick={onClick} className="cw-nav-item" style={{ height: 26, padding: '0 6px' }}>
                    <span className="cw-nav-text" style={{ fontWeight: 640, color: 'var(--cw-ink)' }}>Consultant</span>
                  </button>
                )}
                items={[
                  { label: 'Back to BMN Connect CRM', icon: <LayoutGrid size={14} />, onSelect: () => router.push('/dashboard') },
                  'separator',
                  { label: user?.organization?.name ?? 'Organisation', icon: <Settings size={14} />, onSelect: () => router.push('/organization') },
                ]}
              />
            )}
            <button
              type="button"
              className="cw-icon-btn"
              style={{ marginLeft: 'auto', width: 24, height: 24 }}
              onClick={toggleSidebar}
              aria-label={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
              title={collapsed ? 'Expand' : 'Collapse'}
            >
              {collapsed ? <ChevronsRight size={14} /> : <ChevronsLeft size={14} />}
            </button>
          </div>

          <div style={{ padding: '2px 10px 8px', display: 'flex', gap: 6 }}>
            <button
              type="button"
              className="cw-search"
              style={{ flex: 1, minWidth: 0, justifyContent: collapsed ? 'center' : undefined }}
              onClick={() => setCommandOpen(true)}
              title="Search (⌘K)"
            >
              <Search size={13} style={{ flex: 'none' }} />
              {!collapsed && <><span style={{ flex: 1, textAlign: 'left' }}>Search</span><span className="cw-kbd">⌘K</span></>}
            </button>
            {!collapsed && <QuickCreate onCreate={(k) => setCreating({ kind: k })} />}
          </div>

          <div style={{ flex: 1, minHeight: 0, overflowY: 'auto' }}>
            {renderGroup(null, PRIMARY)}
            {renderGroup('Work', WORK)}
            {renderGroup('Operations', OPS)}
          </div>

          <div style={{ borderTop: '1px solid var(--cw-line)', padding: 8 }}>
            <NotificationsButton collapsed={collapsed} />
            <Link href="/consultant/reports" className="cw-nav-item" title={collapsed ? 'Reports' : undefined}>
              <Activity size={15} /><span className="cw-nav-text">Reports</span>
            </Link>
            <button type="button" className="cw-nav-item" onClick={() => setHelpOpen(true)} title={collapsed ? 'Shortcuts' : undefined}>
              <Keyboard size={15} /><span className="cw-nav-text">Shortcuts</span><span className="cw-nav-trail">?</span>
            </button>
            <Menu
              align="start"
              width={230}
              trigger={({ ref, onClick }) => (
                <button type="button" ref={ref as any} className="cw-nav-item" onClick={onClick} title={collapsed ? user?.firstName : undefined}>
                  <Avatar name={[user?.firstName, user?.lastName].filter(Boolean).join(' ')} size={18} />
                  <span className="cw-nav-text">{[user?.firstName, user?.lastName].filter(Boolean).join(' ') || 'Account'}</span>
                </button>
              )}
              items={[
                {
                  label: density === 'compact' ? 'Comfortable rows' : 'Compact rows',
                  icon: density === 'compact' ? <Rows3 size={14} /> : <Rows2 size={14} />,
                  onSelect: () => setDensity(density === 'compact' ? 'comfortable' : 'compact'),
                },
                { label: 'Keyboard shortcuts', icon: <Keyboard size={14} />, onSelect: () => setHelpOpen(true), hint: '?' },
                'separator',
                { label: 'Organisation settings', icon: <Settings size={14} />, onSelect: () => router.push('/organization') },
                { label: 'Back to CRM', icon: <LayoutGrid size={14} />, onSelect: () => router.push('/dashboard') },
                'separator',
                { label: 'Sign out', icon: <LogOut size={14} />, onSelect: () => void logout(), danger: true },
              ]}
            />
          </div>
        </aside>

        <div className="cw-main">
          <div className="cw-topbar">
            <button
              type="button"
              className="cw-icon-btn cw-only-mobile"
              aria-label="Open navigation"
              onClick={() => setMobileNavOpen((o) => !o)}
            ><MenuIcon size={16} /></button>
            <div id="cw-crumb-slot" style={{ minWidth: 0, flex: 1, display: 'flex', alignItems: 'center' }} />
            <button type="button" className="cw-icon-btn" onClick={() => setCommandOpen(true)} aria-label="Search" title="Search (⌘K)">
              <Search size={15} />
            </button>
            <QuickCreate onCreate={(k) => setCreating({ kind: k })} compact />
          </div>
          <div className="cw-scroll">{children}</div>
        </div>

        <CommandMenu />
        <ShortcutsHelp open={helpOpen} onClose={() => setHelpOpen(false)} />
        <RecordPanels record={record} onClose={closeRecord} />
        <CreatePanels
          open={creating}
          onClose={() => setCreating(null)}
          onCreated={(kind, row) => {
            setCreating(null);
            if (kind === 'TASK' || kind === 'ISSUE' || kind === 'FEATURE' || kind === 'MILESTONE') {
              openRecord(kind as RecordKind, row.id);
            }
            if (kind === 'PROJECT') router.push(`/consultant/projects/${row.id}`);
            if (kind === 'VERTICAL') router.push(`/consultant/verticals/${row.id}`);
            if (kind === 'DOCUMENT') router.push(`/consultant/documents/${row.id}`);
          }}
        />
      </div>
    </WorkspaceCtx.Provider>
  );
}

function QuickCreate({ onCreate, compact }: { onCreate: (k: CreateKind) => void; compact?: boolean }) {
  return (
    <Menu
      align="end"
      width={224}
      trigger={({ ref, onClick }) => (
        <button
          type="button"
          ref={ref as any}
          className={compact ? 'cw-btn cw-btn-primary' : 'cw-btn'}
          onClick={onClick}
          style={compact ? undefined : { width: 28, padding: 0, flex: 'none' }}
          aria-label="Create"
        >
          <Plus size={14} />{compact && 'New'}
        </button>
      )}
      items={[
        { label: 'New task', icon: <ListChecks size={14} />, onSelect: () => onCreate('TASK'), hint: 'c' },
        { label: 'New issue', icon: <Bug size={14} />, onSelect: () => onCreate('ISSUE') },
        { label: 'New feature', icon: <Lightbulb size={14} />, onSelect: () => onCreate('FEATURE') },
        'separator',
        { label: 'New project', icon: <FolderKanban size={14} />, onSelect: () => onCreate('PROJECT') },
        { label: 'New milestone', icon: <Flag size={14} />, onSelect: () => onCreate('MILESTONE') },
        { label: 'New document', icon: <FileText size={14} />, onSelect: () => onCreate('DOCUMENT') },
        'separator',
        { label: 'New product line', icon: <LayoutGrid size={14} />, onSelect: () => onCreate('VERTICAL') },
      ]}
    />
  );
}

function NotificationsButton({ collapsed }: { collapsed: boolean }) {
  const router = useRouter();
  const ws = useWorkspaceSafe();
  const { data } = usePmNotifications();
  const markRead = useMarkNotificationsRead();
  const unread = data?.unread ?? 0;

  return (
    <Popover
      align="start"
      width={344}
      trigger={({ ref, onClick }) => (
        <button type="button" ref={ref as any} className="cw-nav-item" onClick={onClick} title={collapsed ? 'Notifications' : undefined}>
          <span style={{ position: 'relative', display: 'inline-flex', flex: 'none' }}>
            <Bell size={15} />
            {unread > 0 && (
              <span style={{
                position: 'absolute', top: -2, right: -3, width: 7, height: 7, borderRadius: '50%',
                background: 'var(--cw-red)', boxShadow: '0 0 0 1.5px var(--cw-rail)',
              }} />
            )}
          </span>
          <span className="cw-nav-text">Notifications</span>
          {unread > 0 && <span className="cw-nav-trail">{unread}</span>}
        </button>
      )}
    >
      {({ close }) => (
        <>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '9px 11px', borderBottom: '1px solid var(--cw-line-soft)' }}>
            <span className="cw-h2">Notifications</span>
            {unread > 0 && (
              <button type="button" className="cw-btn cw-btn-ghost" style={{ marginLeft: 'auto', height: 22 }} onClick={() => markRead.mutate(undefined)}>
                Mark all read
              </button>
            )}
          </div>
          <div className="cw-pop-list" style={{ maxHeight: 390 }}>
            {!data?.data.length ? (
              <div className="cw-meta" style={{ padding: '20px 12px', textAlign: 'center' }}>Nothing yet.</div>
            ) : data.data.slice(0, 30).map((n) => (
              <button
                key={n.id}
                type="button"
                className="cw-opt"
                style={{ alignItems: 'flex-start', paddingTop: 7, paddingBottom: 7 }}
                onClick={() => {
                  markRead.mutate([n.id]);
                  close();
                  // Peek the record where we can; fall back to a page.
                  const peek = PEEK_FOR[n.relatedType ?? ''];
                  if (peek && n.relatedId && ws) ws.openRecord(peek, n.relatedId);
                  else router.push(notificationHref(n.relatedType, n.relatedId));
                }}
              >
                <span style={{
                  width: 6, height: 6, borderRadius: '50%', marginTop: 6, flex: 'none',
                  background: n.readAt ? 'transparent' : 'var(--cw-accent)',
                }} />
                <span style={{ minWidth: 0, flex: 1 }}>
                  <span style={{ display: 'block', fontWeight: n.readAt ? 500 : 620 }}>{n.title}</span>
                  {n.body && <span className="cw-meta cw-truncate" style={{ display: 'block' }}>{n.body}</span>}
                  <span className="cw-meta" style={{ display: 'block', marginTop: 2 }}>
                    {humanize(n.type.replace(/^PM_/, ''))} · {fmtAgo(n.createdAt)}
                  </span>
                </span>
              </button>
            ))}
          </div>
        </>
      )}
    </Popover>
  );
}

const PEEK_FOR: Record<string, RecordKind | undefined> = {
  PM_TASK: 'TASK',
  PM_ISSUE: 'ISSUE',
  PM_FEATURE: 'FEATURE',
  PM_MILESTONE: 'MILESTONE',
};

function notificationHref(relatedType?: string, relatedId?: string | null): string {
  if (!relatedId) return '/consultant/activity';
  switch (relatedType) {
    case 'PM_PROJECT': return `/consultant/projects/${relatedId}`;
    case 'PM_VERTICAL': return `/consultant/verticals/${relatedId}`;
    case 'PM_DEPLOYMENT': return '/consultant/deployments';
    default: return '/consultant/activity';
  }
}

/** The rail renders inside the provider, but defensively tolerate its absence. */
function useWorkspaceSafe() {
  return React.useContext(WorkspaceCtx);
}

/**
 * Pages render their breadcrumb into the topbar rather than repeating a header
 * block, which is what keeps the content area starting at the content.
 */
export function TopbarSlot({ children }: { children: React.ReactNode }) {
  const [target, setTarget] = useState<HTMLElement | null>(null);
  useEffect(() => { setTarget(document.getElementById('cw-crumb-slot')); }, []);
  if (!target) return null;
  return createPortal(children, target);
}
