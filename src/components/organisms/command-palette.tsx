'use client';

/**
 * Command palette (⌘K / Ctrl-K).
 *
 * Reference: Linear. One input, a keyboard-driven result list, and a preview
 * pane that tells you what you are about to open before you open it. It is
 * mounted once in the app shell and opened either by the hotkey or by the
 * topbar's search control — there is deliberately only one search affordance.
 *
 * Navigation targets are read from NAV_ITEMS and filtered exactly the way the
 * sidebar filters them (permission + org vertical), so the palette can never
 * offer a page the current user cannot open.
 */

import React, {
  useCallback,
  useEffect,
  useId,
  useMemo,
  useRef,
  useState,
  useSyncExternalStore,
} from 'react';
import { useRouter, usePathname } from 'next/navigation';
import {
  Search,
  CornerDownLeft,
  ArrowUp,
  ArrowDown,
  FileText,
  Shield,
  ClipboardCheck,
  UserPlus,
  RefreshCw,
  Zap,
  type LucideIcon,
} from 'lucide-react';
import { NAV_ITEMS, navMatchesVertical, navMatchesProducts, type NavItem } from '@/lib/nav';
import { useAuth } from '@/features/foundation/auth';

// ============================================================ open/close store
//
// A three-line external store rather than a context provider: the topbar and
// the palette itself are siblings in the shell, and threading a provider
// between them would mean restructuring the layout for no gain.

let paletteOpen = false;
const listeners = new Set<() => void>();

function emit() {
  for (const l of listeners) l();
}

function subscribe(fn: () => void) {
  listeners.add(fn);
  return () => {
    listeners.delete(fn);
  };
}

function setPaletteOpen(next: boolean) {
  if (paletteOpen === next) return;
  paletteOpen = next;
  emit();
}

/** Open/close the palette from anywhere. No provider required. */
export function useCommandPalette() {
  const isOpen = useSyncExternalStore(
    subscribe,
    () => paletteOpen,
    () => false,
  );
  return useMemo(
    () => ({
      isOpen,
      open: () => setPaletteOpen(true),
      close: () => setPaletteOpen(false),
      toggle: () => setPaletteOpen(!paletteOpen),
    }),
    [isOpen],
  );
}

// ============================================================ recents

const RECENT_KEY = 'bmn.cmdk.recent';
const RECENT_MAX = 6;

function readRecent(): string[] {
  if (typeof window === 'undefined') return [];
  try {
    const raw = window.sessionStorage.getItem(RECENT_KEY);
    const parsed = raw ? JSON.parse(raw) : null;
    return Array.isArray(parsed) ? parsed.filter((h): h is string => typeof h === 'string') : [];
  } catch {
    return [];
  }
}

function pushRecent(href: string) {
  if (typeof window === 'undefined') return;
  try {
    const next = [href, ...readRecent().filter((h) => h !== href)].slice(0, RECENT_MAX);
    window.sessionStorage.setItem(RECENT_KEY, JSON.stringify(next));
  } catch {
    /* private mode / quota — recents are a nicety, never a hard dependency */
  }
}

// ============================================================ matching

/**
 * Subsequence match with a light score: consecutive runs and word-boundary
 * hits rank above scattered letters, so "inpo" finds "Insurance Policies"
 * ahead of "Portal Accounts". No dependency, no index.
 */
function fuzzyScore(text: string, query: string): number | null {
  if (!query) return 0;
  const t = text.toLowerCase();
  const q = query.toLowerCase();
  let ti = 0;
  let score = 0;
  let run = 0;
  for (let qi = 0; qi < q.length; qi++) {
    const ch = q[qi];
    if (ch === ' ') continue;
    const found = t.indexOf(ch, ti);
    if (found === -1) return null;
    const boundary = found === 0 || /[\s\-/&·]/.test(t[found - 1]);
    run = found === ti && ti > 0 ? run + 1 : 0;
    score += 1 + run * 2 + (boundary ? 3 : 0) - Math.min(found - ti, 4) * 0.4;
    ti = found + 1;
  }
  // A short label that matched is a better hit than a long one that also did.
  return score + Math.max(0, 12 - text.length) * 0.15;
}

// ============================================================ items

type ItemGroup = 'Recent' | 'Go to' | 'Actions';

interface PaletteItem {
  id: string;
  group: ItemGroup;
  label: string;
  href: string;
  icon: LucideIcon;
  /** Nav section or action verb — shown as the trailing hint and in the preview. */
  context: string;
  detail: string;
  keywords: string;
}

/**
 * Each action names the route it lands on. That route must be visible to the
 * user for the action to be offered, which gives the actions the same
 * vertical + permission filtering as navigation for free.
 */
const ACTIONS: { label: string; route: string; href: string; icon: LucideIcon; detail: string; keywords?: string }[] = [
  {
    label: 'New quote',
    route: '/insurance/quotes',
    href: '/insurance/quotes?new=1',
    icon: FileText,
    detail: 'Opens the quotes board with the new-quote composer already open.',
    keywords: 'create quotation insurance',
  },
  {
    label: 'New policy',
    route: '/insurance/policies',
    href: '/insurance/policies?new=1',
    icon: Shield,
    detail: 'Opens the policy pipeline ready to book new business.',
    keywords: 'create bind issue',
  },
  {
    label: 'Register claim',
    route: '/insurance/claims',
    href: '/insurance/claims?new=1',
    icon: ClipboardCheck,
    detail: 'Opens the claims queue with the registration form ready.',
    keywords: 'fnol new loss notify',
  },
  {
    label: 'Add client',
    route: '/insurance/clients',
    href: '/insurance/clients?new=1',
    icon: UserPlus,
    detail: 'Opens the client book to add a new insured.',
    keywords: 'create customer insured contact',
  },
  {
    label: 'Run renewal sweep',
    route: '/insurance/renewals',
    href: '/insurance/renewals?new=1',
    icon: RefreshCw,
    detail: 'Opens the renewal centre and starts a sweep across the expiring book.',
    keywords: 'expiring batch chase',
  },
  {
    label: 'Add lead',
    route: '/leads',
    href: '/leads?new=1',
    icon: Zap,
    detail: 'Opens the lead list with the capture drawer open.',
    keywords: 'create enquiry prospect new',
  },
];

// ============================================================ component

export function CommandPalette() {
  const { isOpen, close } = useCommandPalette();
  const { user, hasPermission } = useAuth();
  const router = useRouter();
  const pathname = usePathname();

  const [query, setQuery] = useState('');
  const [active, setActive] = useState(0);
  const [recent, setRecent] = useState<string[]>([]);

  const baseId = useId();
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);
  const returnTo = useRef<HTMLElement | null>(null);

  const vertical = user?.organization?.vertical ?? 'INSTITUTE';

  // Same predicate the sidebar uses. Keeping it identical is the point:
  // the palette must never be a back door to a page the nav hides.
  const visibleNav = useMemo<NavItem[]>(
    () =>
      NAV_ITEMS.filter(
        (i) => (!i.permission || hasPermission(i.permission))
      && navMatchesVertical(i, vertical)
      && navMatchesProducts(i, (user?.organization as any)?.products),
      ),
    [hasPermission, vertical],
  );

  // Recents are derived from where the user has actually been this session,
  // recorded here because this component is mounted on every app route.
  useEffect(() => {
    if (!pathname) return;
    const hit = visibleNav.find((i) => i.href === pathname);
    if (hit) pushRecent(hit.href);
  }, [pathname, visibleNav]);

  const items = useMemo<PaletteItem[]>(() => {
    const navByHref = new Map(visibleNav.map((i) => [i.href, i]));

    const goTo: PaletteItem[] = visibleNav.map((i) => ({
      id: `nav:${i.section}:${i.href}:${i.label}`,
      group: 'Go to',
      label: i.label,
      href: i.href,
      icon: i.icon,
      context: i.section,
      detail: `Navigates to ${i.href}.`,
      keywords: `${i.section} ${i.href}`,
    }));

    const actions: PaletteItem[] = ACTIONS.filter((a) => navByHref.has(a.route)).map((a) => ({
      id: `action:${a.href}`,
      group: 'Actions',
      label: a.label,
      href: a.href,
      icon: a.icon,
      context: navByHref.get(a.route)!.label,
      detail: a.detail,
      keywords: a.keywords ?? '',
    }));

    // Recent only earns a section when the search box is empty — a stale
    // shortlist competing with live results is noise, and inventing one
    // when sessionStorage is empty would be worse.
    const recents: PaletteItem[] =
      query.trim() || !recent.length
        ? []
        : recent
            .filter((h) => h !== pathname)
            .map((h) => navByHref.get(h))
            .filter((i): i is NavItem => Boolean(i))
            .slice(0, 4)
            .map((i) => ({
              id: `recent:${i.href}`,
              group: 'Recent' as const,
              label: i.label,
              href: i.href,
              icon: i.icon,
              context: i.section,
              detail: `Visited earlier this session · ${i.href}`,
              keywords: '',
            }));

    return [...recents, ...actions, ...goTo];
  }, [visibleNav, recent, query, pathname]);

  const results = useMemo(() => {
    const q = query.trim();
    if (!q) {
      // Unfiltered, the list is long; the top of each section is what matters.
      return items.filter((i) => i.group !== 'Go to').concat(items.filter((i) => i.group === 'Go to'));
    }
    return items
      .map((item) => {
        const direct = fuzzyScore(item.label, q);
        const wide = direct != null ? null : fuzzyScore(`${item.label} ${item.context} ${item.keywords}`, q);
        const score = direct != null ? direct + 6 : wide;
        return score == null ? null : { item, score: score + (item.group === 'Actions' ? 2 : 0) };
      })
      .filter((r): r is { item: PaletteItem; score: number } => r !== null)
      .sort((a, b) => b.score - a.score)
      .slice(0, 40)
      .map((r) => r.item);
  }, [items, query]);

  // Group headers are rendered from the result order, so a group can appear
  // once and only where its first member landed.
  const groups = useMemo(() => {
    const out: { group: ItemGroup; items: PaletteItem[] }[] = [];
    for (const item of results) {
      const last = out[out.length - 1];
      if (last && last.group === item.group) last.items.push(item);
      else out.push({ group: item.group, items: [item] });
    }
    return out;
  }, [results]);

  const activeItem = results[Math.min(active, results.length - 1)];

  const run = useCallback(
    (item: PaletteItem | undefined) => {
      if (!item) return;
      setPaletteOpen(false);
      router.push(item.href);
    },
    [router],
  );

  // --- open/close side effects: focus capture, scroll lock, reset ----------
  useEffect(() => {
    if (!isOpen) return;
    returnTo.current = document.activeElement as HTMLElement | null;
    setQuery('');
    setActive(0);
    setRecent(readRecent());

    // The app shell scrolls in #crm-main, not on body, so both are locked.
    const main = document.getElementById('crm-main');
    const prevBody = document.body.style.overflow;
    const prevMain = main?.style.overflow ?? '';
    document.body.style.overflow = 'hidden';
    if (main) main.style.overflow = 'hidden';

    const id = window.setTimeout(() => inputRef.current?.focus(), 10);
    return () => {
      window.clearTimeout(id);
      document.body.style.overflow = prevBody;
      if (main) main.style.overflow = prevMain;
      returnTo.current?.focus?.();
    };
  }, [isOpen]);

  // --- global hotkey ------------------------------------------------------
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && (e.key === 'k' || e.key === 'K')) {
        e.preventDefault();
        setPaletteOpen(!paletteOpen);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  // Keep the highlighted row in view when the arrows walk past the fold.
  useEffect(() => {
    if (!isOpen) return;
    const el = listRef.current?.querySelector<HTMLElement>('[data-active="true"]');
    el?.scrollIntoView({ block: 'nearest' });
  }, [active, isOpen, results.length]);

  useEffect(() => {
    setActive(0);
  }, [query]);

  if (!isOpen) return null;

  const onKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setActive((i) => (results.length ? (i + 1) % results.length : 0));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setActive((i) => (results.length ? (i - 1 + results.length) % results.length : 0));
    } else if (e.key === 'Home') {
      e.preventDefault();
      setActive(0);
    } else if (e.key === 'End') {
      e.preventDefault();
      setActive(Math.max(0, results.length - 1));
    } else if (e.key === 'Enter') {
      e.preventDefault();
      run(activeItem);
    } else if (e.key === 'Escape') {
      e.preventDefault();
      close();
    }
  };

  const listId = `${baseId}-list`;
  const activeId = activeItem ? `${baseId}-opt-${Math.min(active, results.length - 1)}` : undefined;
  const ActiveIcon = activeItem?.icon;

  let index = -1;

  return (
    <div
      className="ds-cmdk-scrim"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) close();
      }}
    >
      <div
        className="ds-cmdk"
        role="dialog"
        aria-modal="true"
        aria-label="Command palette"
        onKeyDown={onKeyDown}
      >
        <div className="ds-cmdk-search">
          <Search size={17} strokeWidth={1.8} aria-hidden="true" />
          <input
            ref={inputRef}
            className="ds-cmdk-input"
            placeholder="Search pages and actions…"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            role="combobox"
            aria-expanded="true"
            aria-controls={listId}
            aria-activedescendant={activeId}
            aria-autocomplete="list"
            autoComplete="off"
            spellCheck={false}
          />
          <kbd className="ds-kbd">esc</kbd>
        </div>

        <div className="ds-cmdk-body">
          <div className="ds-cmdk-results" ref={listRef}>
            <div id={listId} role="listbox" aria-label="Results" aria-activedescendant={activeId}>
              {results.length === 0 && (
                <div className="ds-cmdk-empty">No matches for “{query.trim()}”.</div>
              )}
              {groups.map((g) => (
                <div key={g.group}>
                  <div className="ds-cmdk-group-label">{g.group}</div>
                  {g.items.map((item) => {
                    index += 1;
                    const i = index;
                    const Icon = item.icon;
                    return (
                      <div
                        key={item.id}
                        id={`${baseId}-opt-${i}`}
                        role="option"
                        aria-selected={i === active}
                        data-active={i === active}
                        className="ds-cmdk-item"
                        onMouseMove={() => setActive(i)}
                        onClick={() => run(item)}
                      >
                        <Icon size={16} strokeWidth={1.7} aria-hidden="true" />
                        <span className="ds-cmdk-item-label">{item.label}</span>
                        <span className="ds-cmdk-item-hint">{item.context}</span>
                      </div>
                    );
                  })}
                </div>
              ))}
            </div>
          </div>

          {/* Preview: what you are about to open, before you open it. */}
          <aside className="ds-cmdk-preview" aria-live="polite">
            {activeItem ? (
              <>
                <div className="ds-row" style={{ marginBottom: 12 }}>
                  {ActiveIcon && (
                    <span className="ds-entity-icon ds-entity-icon-lg">
                      <ActiveIcon size={18} strokeWidth={1.7} aria-hidden="true" />
                    </span>
                  )}
                  <div style={{ minWidth: 0 }}>
                    <div className="ds-h2">{activeItem.label}</div>
                    <div className="ds-caption">{activeItem.group} · {activeItem.context}</div>
                  </div>
                </div>
                <p className="ds-small" style={{ marginTop: 0 }}>{activeItem.detail}</p>
                <div className="ds-divider" style={{ margin: '16px 0' }} />
                <div className="ds-caption-upper" style={{ marginBottom: 6 }}>Destination</div>
                <div className="ds-small" style={{ fontFamily: 'var(--mono)', wordBreak: 'break-all' }}>
                  {activeItem.href}
                </div>
              </>
            ) : (
              <div className="ds-caption">Nothing to preview.</div>
            )}
          </aside>
        </div>

        <div className="ds-cmdk-foot">
          <span className="ds-cmdk-foot-hint">
            <kbd className="ds-kbd"><ArrowUp size={10} /></kbd>
            <kbd className="ds-kbd"><ArrowDown size={10} /></kbd>
            Navigate
          </span>
          <span className="ds-cmdk-foot-hint">
            <kbd className="ds-kbd"><CornerDownLeft size={10} /></kbd>
            Select
          </span>
          <span className="ds-cmdk-foot-hint">
            <kbd className="ds-kbd">esc</kbd>
            Close
          </span>
          <span className="ds-cmdk-foot-hint" style={{ marginLeft: 'auto' }}>
            {results.length} result{results.length === 1 ? '' : 's'}
          </span>
        </div>
      </div>
    </div>
  );
}

/** The hint the topbar shows in its search control. */
export function usePaletteHint() {
  const [hint, setHint] = useState('⌘K');
  useEffect(() => {
    const mac = /Mac|iPhone|iPad/i.test(navigator.platform || navigator.userAgent);
    if (!mac) setHint('Ctrl K');
  }, []);
  return hint;
}

export { CommandPalette as default };
