'use client';

/**
 * The shape every record shares.
 *
 * Task, Issue, Feature, Milestone, Project and Developer all render through
 * `RecordShell`, so the identifier sits in the same place, the field rail is the
 * same width, tabs behave the same and the activity tab is always last. The
 * point is that learning one record teaches you all of them.
 */

import React, { useEffect, useRef } from 'react';
import { ArrowLeft, ArrowRight } from 'lucide-react';
import { Tabs } from './primitives';
import { useWorkspace } from './workspace-context';
import type { RecordKind } from './workspace-context';

// ============================================================ Header

export function RecordHeader({
  identifier, title, onTitleChange, editable, context, status, actions,
}: {
  /** The stable human ref — INS-102. Absent for records that have no ref. */
  identifier?: React.ReactNode;
  title: string;
  onTitleChange?: (v: string) => void;
  editable?: boolean;
  /** Breadcrumb-ish relationship chips: vertical, project, milestone. */
  context?: React.ReactNode;
  status?: React.ReactNode;
  actions?: React.ReactNode;
}) {
  const ref = useRef<HTMLTextAreaElement>(null);

  // Title is a textarea so a long task name wraps instead of scrolling
  // sideways; height follows content.
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    el.style.height = 'auto';
    el.style.height = `${el.scrollHeight}px`;
  }, [title]);

  return (
    <div>
      {(identifier || context) && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap', marginBottom: 6 }}>
          {identifier && <span className="cw-mono">{identifier}</span>}
          {context}
        </div>
      )}
      <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12 }}>
        <div style={{ minWidth: 0, flex: 1 }}>
          {editable && onTitleChange ? (
            <textarea
              ref={ref}
              className="cw-record-title"
              defaultValue={title}
              rows={1}
              onBlur={(e) => e.target.value.trim() && e.target.value !== title && onTitleChange(e.target.value.trim())}
              onKeyDown={(e) => {
                if (e.key === 'Enter') { e.preventDefault(); (e.target as HTMLTextAreaElement).blur(); }
                if (e.key === 'Escape') { (e.target as HTMLTextAreaElement).value = title; (e.target as HTMLTextAreaElement).blur(); }
              }}
            />
          ) : (
            <h1 className="cw-record-title" style={{ cursor: 'default' }}>{title}</h1>
          )}
        </div>
        {(status || actions) && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, flex: 'none', paddingTop: 2 }}>
            {status}
            {actions}
          </div>
        )}
      </div>
    </div>
  );
}

// ============================================================ Field rail

export function Fields({ children }: { children: React.ReactNode }) {
  return <div className="cw-fields">{children}</div>;
}

export function Field({ label, children, hint }: { label: string; children: React.ReactNode; hint?: string }) {
  return (
    <>
      <div className="cw-field-label">{label}</div>
      <div style={{ minWidth: 0, padding: '2px 0' }}>
        {children}
        {hint && <div className="cw-meta" style={{ marginTop: 3 }}>{hint}</div>}
      </div>
    </>
  );
}

/** Long-form field that spans both columns — description, resolution, criteria. */
export function Prose({
  label, value, onCommit, editable, placeholder, rows = 5, hint, autoFocusKey,
}: {
  label: string;
  value?: string | null;
  onCommit: (v: string) => void;
  editable?: boolean;
  placeholder?: string;
  rows?: number;
  hint?: string;
  /** Changing this focuses the field — used by the `e` shortcut. */
  autoFocusKey?: number;
}) {
  const ref = useRef<HTMLTextAreaElement>(null);
  useEffect(() => {
    if (autoFocusKey) ref.current?.focus();
  }, [autoFocusKey]);

  return (
    <div>
      <div className="cw-label">{label}</div>
      {editable ? (
        <textarea
          ref={ref}
          className="cw-input"
          rows={rows}
          defaultValue={value ?? ''}
          placeholder={placeholder}
          onBlur={(e) => e.target.value !== (value ?? '') && onCommit(e.target.value)}
        />
      ) : (
        <div style={{ whiteSpace: 'pre-wrap', color: value ? 'var(--cw-ink)' : 'var(--cw-ink-4)', lineHeight: 1.6 }}>
          {value || placeholder || '—'}
        </div>
      )}
      {hint && <div className="cw-meta" style={{ marginTop: 5 }}>{hint}</div>}
    </div>
  );
}

// ============================================================ Relationship chips

/**
 * A link to another record.
 *
 * Everything relational uses this so hops look identical whether the target is
 * a page (project, vertical) or a peek (task, issue, milestone, person).
 */
export function RecordLink({
  label, icon, href, kind, id, muted,
}: {
  label?: string | null;
  icon?: React.ReactNode;
  href?: string;
  kind?: RecordKind;
  id?: string;
  muted?: boolean;
}) {
  const ws = useWorkspace();
  if (!label) return <span className="cw-cell-empty">—</span>;

  const inner = (
    <>
      {icon}
      <span className="cw-truncate">{label}</span>
    </>
  );

  const style: React.CSSProperties = {
    display: 'inline-flex', alignItems: 'center', gap: 5, minWidth: 0, maxWidth: '100%',
    color: muted ? 'var(--cw-ink-2)' : 'var(--cw-ink)', textDecoration: 'none',
  };

  if (href) return <a href={href} className="cw-reclink" style={style}>{inner}</a>;
  if (kind && id) {
    return (
      <button type="button" className="cw-reclink" style={{ ...style, border: 0, background: 'transparent', font: 'inherit', cursor: 'pointer', padding: 0 }} onClick={() => ws.openRecord(kind, id)}>
        {inner}
      </button>
    );
  }
  return <span style={style}>{inner}</span>;
}

/** The muted relationship row under a record title. */
export function RecordContext({ items }: { items: React.ReactNode[] }) {
  const shown = items.filter(Boolean);
  if (!shown.length) return null;
  return (
    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 7, flexWrap: 'wrap', minWidth: 0 }}>
      {shown.map((it, i) => (
        <React.Fragment key={i}>
          {i > 0 && <span style={{ color: 'var(--cw-ink-4)' }}>·</span>}
          {it}
        </React.Fragment>
      ))}
    </span>
  );
}

// ============================================================ Body

/** Standard record body: tabs, then whatever the active tab renders. */
export function RecordBody({
  tabs, active, onTab, counts, children,
}: {
  tabs: readonly string[];
  active: string;
  onTab: (t: string) => void;
  counts?: Record<string, number | undefined>;
  children: React.ReactNode;
}) {
  return (
    <>
      <div style={{ marginTop: 14 }}>
        <Tabs tabs={tabs} active={active} onChange={onTab} counts={counts} />
      </div>
      <div style={{ paddingTop: 16 }}>{children}</div>
    </>
  );
}

/** Back / forward through the relationship trail. */
export function RecordNav() {
  const ws = useWorkspace();
  if (!ws.canBack && !ws.canForward) return null;
  return (
    <span style={{ display: 'inline-flex', gap: 2 }}>
      <button
        type="button"
        className="cw-icon-btn"
        aria-label="Back to previous record"
        title="Back  ["
        disabled={!ws.canBack}
        onClick={ws.back}
        style={{ opacity: ws.canBack ? 1 : 0.35 }}
      ><ArrowLeft size={14} /></button>
      <button
        type="button"
        className="cw-icon-btn"
        aria-label="Forward"
        title="Forward  ]"
        disabled={!ws.canForward}
        onClick={ws.forward}
        style={{ opacity: ws.canForward ? 1 : 0.35 }}
      ><ArrowRight size={14} /></button>
    </span>
  );
}

/** Created/updated footer, identical on every record. */
export function RecordFooter({ items }: { items: { label: string; value?: string | null }[] }) {
  const shown = items.filter((i) => i.value);
  if (!shown.length) return null;
  return (
    <div className="cw-meta" style={{ display: 'flex', gap: 16, flexWrap: 'wrap', borderTop: '1px solid var(--cw-line)', paddingTop: 10, marginTop: 4 }}>
      {shown.map((i) => <span key={i.label}>{i.label} {i.value}</span>)}
    </div>
  );
}
