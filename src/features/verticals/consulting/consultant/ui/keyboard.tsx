'use client';

/**
 * Keyboard layer.
 *
 * Two rules make this safe to have everywhere: nothing fires while the user is
 * typing in a field or a contentEditable, and nothing fires while a modal
 * surface (command menu, panel) has priority. Sequences like `g` then `t` are
 * supported because single-letter go-to shortcuts are the fastest way around a
 * workspace with fourteen destinations.
 */

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { X } from 'lucide-react';

export type Handler = (e: KeyboardEvent) => void;

/** True when focus is somewhere that should swallow plain-letter shortcuts. */
export function isTypingTarget(el: EventTarget | null): boolean {
  const node = el as HTMLElement | null;
  if (!node || !node.tagName) return false;
  const tag = node.tagName.toLowerCase();
  if (tag === 'input' || tag === 'textarea' || tag === 'select') return true;
  if (node.isContentEditable) return true;
  return false;
}

/**
 * Register shortcuts. Keys are either a single token ("j", "?", "Escape") or a
 * two-key sequence ("g h") pressed within a short window.
 */
export function useShortcuts(
  map: Record<string, Handler | undefined>,
  { enabled = true, allowInInputs = [] as string[] } = {},
) {
  const mapRef = useRef(map);
  mapRef.current = map;
  const pending = useRef<{ key: string; at: number } | null>(null);

  useEffect(() => {
    if (!enabled) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.metaKey || e.ctrlKey || e.altKey) return;

      const typing = isTypingTarget(e.target);
      const key = e.key;

      // Sequence continuation, e.g. `g` then `t`.
      const now = Date.now();
      if (pending.current && now - pending.current.at < 900) {
        const combo = `${pending.current.key} ${key}`;
        pending.current = null;
        const seqHandler = mapRef.current[combo];
        if (seqHandler && !typing) { e.preventDefault(); seqHandler(e); return; }
      }

      const handler = mapRef.current[key];
      if (!handler) {
        // Start a sequence only if some registered shortcut begins with this key.
        if (!typing && Object.keys(mapRef.current).some((k) => k.startsWith(`${key} `))) {
          pending.current = { key, at: now };
        }
        return;
      }
      if (typing && !allowInInputs.includes(key)) return;
      e.preventDefault();
      handler(e);
    };

    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [enabled, allowInInputs]);
}

/**
 * Roving cursor for a list or table.
 *
 * Keeps an index, moves it with j/k and the arrows, and exposes it so the row
 * can render a focus ring. Enter opens; the caller decides what "open" means.
 */
export function useListCursor<T>({
  items, onOpen, onToggleSelect, enabled = true,
}: {
  items: T[];
  onOpen?: (item: T, index: number) => void;
  onToggleSelect?: (item: T, index: number) => void;
  enabled?: boolean;
}) {
  const [index, setIndex] = useState(-1);

  // Keep the cursor inside the list when it shrinks under a filter.
  useEffect(() => {
    setIndex((i) => (i >= items.length ? items.length - 1 : i));
  }, [items.length]);

  const move = useCallback((delta: number) => {
    setIndex((i) => {
      const next = Math.min(Math.max(i + delta, 0), items.length - 1);
      return Number.isFinite(next) ? next : 0;
    });
  }, [items.length]);

  useShortcuts({
    j: () => move(1),
    ArrowDown: () => move(1),
    k: () => move(-1),
    ArrowUp: () => move(-1),
    Enter: () => { if (index >= 0 && items[index] && onOpen) onOpen(items[index], index); },
    x: () => { if (index >= 0 && items[index] && onToggleSelect) onToggleSelect(items[index], index); },
    Escape: () => setIndex(-1),
  }, { enabled });

  return { index, setIndex };
}

// ============================================================ Help overlay

export interface ShortcutDoc {
  group: string;
  keys: string[];
  label: string;
}

export const SHORTCUTS: ShortcutDoc[] = [
  { group: 'General', keys: ['⌘', 'K'], label: 'Search and commands' },
  { group: 'General', keys: ['/'], label: 'Search this list' },
  { group: 'General', keys: ['c'], label: 'Create' },
  { group: 'General', keys: ['?'], label: 'Keyboard shortcuts' },
  { group: 'General', keys: ['Esc'], label: 'Close panel or clear focus' },
  { group: 'Navigate', keys: ['g', 'h'], label: 'Home' },
  { group: 'Navigate', keys: ['g', 'm'], label: 'My work' },
  { group: 'Navigate', keys: ['g', 'v'], label: 'Product Lines' },
  { group: 'Navigate', keys: ['g', 'p'], label: 'Projects' },
  { group: 'Navigate', keys: ['g', 't'], label: 'Tasks' },
  { group: 'Navigate', keys: ['g', 'i'], label: 'Issues' },
  { group: 'Navigate', keys: ['g', 'f'], label: 'Features' },
  { group: 'Navigate', keys: ['g', 'd'], label: 'Documents' },
  { group: 'Navigate', keys: ['g', 'a'], label: 'Activity' },
  { group: 'Lists', keys: ['j'], label: 'Move down' },
  { group: 'Lists', keys: ['k'], label: 'Move up' },
  { group: 'Lists', keys: ['↵'], label: 'Open the highlighted row' },
  { group: 'Lists', keys: ['x'], label: 'Select the highlighted row' },
  { group: 'Record', keys: ['['], label: 'Back to the previous record' },
  { group: 'Record', keys: [']'], label: 'Forward' },
  { group: 'Record', keys: ['e'], label: 'Focus the description' },
];

export function ShortcutsHelp({ open, onClose }: { open: boolean; onClose: () => void }) {
  const groups = useMemo(() => {
    const m = new Map<string, ShortcutDoc[]>();
    for (const s of SHORTCUTS) m.set(s.group, [...(m.get(s.group) ?? []), s]);
    return [...m.entries()];
  }, []);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  if (!open || typeof document === 'undefined') return null;

  return createPortal(
    <div className="cw-cmd-scrim" onClick={onClose} style={{ paddingTop: '9vh' }}>
      <div
        className="cw cw-cmd"
        style={{ width: 620, maxHeight: '74vh' }}
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-label="Keyboard shortcuts"
      >
        <div className="cw-cmd-input" style={{ padding: '12px 15px' }}>
          <span className="cw-h2" style={{ flex: 1 }}>Keyboard shortcuts</span>
          <button type="button" className="cw-icon-btn" aria-label="Close" onClick={onClose}><X size={15} /></button>
        </div>
        <div className="cw-cmd-body" style={{ padding: 14 }}>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(250px,1fr))', gap: '0 28px' }}>
            {groups.map(([group, list]) => (
              <div key={group} style={{ marginBottom: 16 }}>
                <div className="cw-pop-label" style={{ padding: '0 0 6px' }}>{group}</div>
                {list.map((s) => (
                  <div key={s.label} style={{ display: 'flex', alignItems: 'center', gap: 10, minHeight: 26 }}>
                    <span style={{ flex: 1, minWidth: 0 }} className="cw-truncate">{s.label}</span>
                    <span style={{ display: 'inline-flex', gap: 3, flex: 'none' }}>
                      {s.keys.map((k, i) => <kbd key={i} className="cw-kbd">{k}</kbd>)}
                    </span>
                  </div>
                ))}
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>,
    document.body,
  );
}
