'use client';

/**
 * Contextual record panel.
 *
 * Opening a task from the board or the table must not cost the user their
 * place, so records peek in a right-hand sheet. The panel owns focus while it
 * is open and restores it on close; Escape always closes.
 *
 * `bare` hands the header to the content — record panels render their own
 * identifier/title/status block through RecordShell, and only the close and
 * navigation controls stay pinned here.
 */

import React, { useEffect, useId, useRef } from 'react';
import { createPortal } from 'react-dom';
import { ExternalLink, X } from 'lucide-react';
import { Tabs } from './primitives';

export function Panel({
  open, onClose, title, subtitle, tabs, activeTab, onTab, counts, actions, openHref,
  width = 620, bare, children,
}: {
  open: boolean;
  onClose: () => void;
  title: React.ReactNode;
  subtitle?: React.ReactNode;
  tabs?: readonly string[];
  activeTab?: string;
  onTab?: (t: string) => void;
  counts?: Record<string, number | undefined>;
  actions?: React.ReactNode;
  /** Shown as an "open full record" affordance when the record has its own page. */
  openHref?: string;
  width?: number;
  /** Content supplies its own header; only the controls row is rendered. */
  bare?: boolean;
  children: React.ReactNode;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const returnTo = useRef<HTMLElement | null>(null);
  const labelId = useId();

  useEffect(() => {
    if (!open) return;
    returnTo.current = document.activeElement as HTMLElement;
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') { onClose(); return; }
      // Keep Tab inside the dialog: a modal that lets focus wander into the
      // page behind it is unusable with a keyboard or a screen reader.
      if (e.key !== 'Tab' || !ref.current) return;
      const focusables = ref.current.querySelectorAll<HTMLElement>(
        'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [contenteditable="true"], [tabindex]:not([tabindex="-1"])',
      );
      if (!focusables.length) return;
      const first = focusables[0];
      const last = focusables[focusables.length - 1];
      const active = document.activeElement as HTMLElement | null;
      if (e.shiftKey && (active === first || active === ref.current)) { e.preventDefault(); last.focus(); }
      else if (!e.shiftKey && active === last) { e.preventDefault(); first.focus(); }
    };
    document.addEventListener('keydown', onKey);
    const id = window.setTimeout(() => ref.current?.focus(), 20);
    return () => {
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = prev;
      window.clearTimeout(id);
      returnTo.current?.focus?.();
    };
  }, [open, onClose]);

  if (!open || typeof document === 'undefined') return null;

  const controls = (
    <div style={{ display: 'flex', alignItems: 'center', gap: 4, flex: 'none' }}>
      {actions}
      {openHref && (
        <a href={openHref} className="cw-icon-btn" aria-label="Open full record" title="Open full record">
          <ExternalLink size={14} />
        </a>
      )}
      <button type="button" className="cw-icon-btn" aria-label="Close" title="Close  Esc" onClick={onClose}>
        <X size={15} />
      </button>
    </div>
  );

  return createPortal(
    <>
      <div className="cw-panel-scrim" onClick={onClose} />
      <div
        ref={ref}
        role="dialog"
        aria-modal="true"
        aria-labelledby={bare ? undefined : labelId}
        aria-label={bare ? 'Record' : undefined}
        tabIndex={-1}
        className="cw cw-panel"
        style={{ width }}
      >
        {bare ? (
          <>
            <div style={{
              flex: 'none', display: 'flex', justifyContent: 'flex-end',
              padding: '8px 12px 0', position: 'sticky', top: 0, zIndex: 5, background: 'var(--cw-bg)',
            }}>
              {controls}
            </div>
            <div className="cw-panel-body" style={{ paddingTop: 4 }}>{children}</div>
          </>
        ) : (
          <>
            <div className="cw-panel-head">
              <div style={{ display: 'flex', alignItems: 'flex-start', gap: 10 }}>
                <div style={{ minWidth: 0, flex: 1 }}>
                  <div id={labelId} className="cw-h1" style={{ fontSize: 16, lineHeight: 1.35 }}>{title}</div>
                  {subtitle && <div className="cw-meta" style={{ marginTop: 3 }}>{subtitle}</div>}
                </div>
                {controls}
              </div>
              {tabs && activeTab && onTab && (
                <div style={{ marginTop: 10, marginBottom: -12 }}>
                  <Tabs tabs={tabs} active={activeTab} onChange={onTab} counts={counts} />
                </div>
              )}
            </div>
            <div className="cw-panel-body">{children}</div>
          </>
        )}
      </div>
    </>,
    document.body,
  );
}

// Re-exported so form panels can import their layout from one module.
export { Fields, Field } from './record-shell';
