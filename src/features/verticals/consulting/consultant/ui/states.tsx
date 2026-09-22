'use client';

/**
 * Loading, empty and error states — one vocabulary for the whole workspace.
 *
 * Before this every screen hand-rolled its own `isLoading ? <Skeleton/> : …` and
 * none of them handled `isError` at all, so a failed request rendered as "no
 * tasks" — the worst possible lie for a work tracker. `QueryState` makes the
 * error branch impossible to forget, because it is the same call as the loading
 * branch.
 */

import React from 'react';
import { AlertCircle, RefreshCw, WifiOff } from 'lucide-react';
import { apiErrorMessage } from '@/lib/api';

// ============================================================ Skeletons

export type SkeletonKind = 'table' | 'list' | 'panel' | 'board' | 'cards' | 'text';

/**
 * Loading placeholders that match the shape of what is arriving. A table that
 * loads into a block of grey bars and then reflows feels broken; matching the
 * row rhythm makes the swap invisible.
 */
export function Loading({ kind = 'list', rows = 6 }: { kind?: SkeletonKind; rows?: number }) {
  if (kind === 'table') {
    return (
      <div style={{ borderTop: '1px solid var(--cw-line)' }} aria-busy="true" aria-live="polite">
        <div style={{ display: 'flex', gap: 12, padding: '9px 10px', borderBottom: '1px solid var(--cw-line)' }}>
          {[130, 90, 110, 80, 70].map((w, i) => <div key={i} className="cw-skel" style={{ width: w, height: 9 }} />)}
        </div>
        {Array.from({ length: rows }).map((_, i) => (
          <div key={i} style={{ display: 'flex', gap: 12, alignItems: 'center', height: 'var(--cw-row-h)', padding: '0 10px', borderBottom: '1px solid var(--cw-line-soft)', opacity: 1 - i * 0.09 }}>
            <div className="cw-skel" style={{ width: 200, height: 10 }} />
            <div className="cw-skel" style={{ width: 74, height: 16, borderRadius: 4 }} />
            <div className="cw-skel" style={{ width: 100, height: 10 }} />
            <div className="cw-skel" style={{ width: 60, height: 10 }} />
            <div className="cw-skel" style={{ width: 80, height: 6, borderRadius: 3, marginLeft: 'auto' }} />
          </div>
        ))}
      </div>
    );
  }

  if (kind === 'board') {
    return (
      <div className="cw-board" aria-busy="true">
        {[0, 1, 2, 3].map((c) => (
          <div key={c} className="cw-col" style={{ opacity: 1 - c * 0.12 }}>
            <div className="cw-skel" style={{ width: 90, height: 10, marginBottom: 10 }} />
            {[0, 1, 2].map((i) => <div key={i} className="cw-skel" style={{ height: 62, marginBottom: 7 }} />)}
          </div>
        ))}
      </div>
    );
  }

  if (kind === 'panel') {
    return (
      <div style={{ display: 'grid', gap: 14 }} aria-busy="true">
        {Array.from({ length: rows }).map((_, i) => (
          <div key={i} style={{ display: 'grid', gridTemplateColumns: '116px 1fr', gap: 10, alignItems: 'center' }}>
            <div className="cw-skel" style={{ height: 9, width: 72 }} />
            <div className="cw-skel" style={{ height: 16, width: `${45 + ((i * 17) % 40)}%`, borderRadius: 4 }} />
          </div>
        ))}
        <div className="cw-skel" style={{ height: 90, marginTop: 6 }} />
      </div>
    );
  }

  if (kind === 'cards') {
    return (
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(240px,1fr))', gap: 10 }} aria-busy="true">
        {Array.from({ length: rows }).map((_, i) => <div key={i} className="cw-skel" style={{ height: 92, opacity: 1 - i * 0.08 }} />)}
      </div>
    );
  }

  if (kind === 'text') {
    return (
      <div style={{ display: 'grid', gap: 8 }} aria-busy="true">
        {Array.from({ length: rows }).map((_, i) => (
          <div key={i} className="cw-skel" style={{ height: 11, width: `${92 - ((i * 13) % 45)}%` }} />
        ))}
      </div>
    );
  }

  return (
    <div style={{ display: 'grid', gap: 7 }} aria-busy="true">
      {Array.from({ length: rows }).map((_, i) => (
        <div key={i} className="cw-skel" style={{ height: 32, opacity: 1 - i * 0.09 }} />
      ))}
    </div>
  );
}

// ============================================================ Empty

export function Empty({
  icon: Icon, title, body, action, compact,
}: { icon?: any; title: string; body?: string; action?: React.ReactNode; compact?: boolean }) {
  return (
    <div className="cw-empty" style={compact ? { padding: '26px 20px' } : undefined}>
      {Icon && <Icon size={compact ? 17 : 20} style={{ color: 'var(--cw-ink-4)', marginBottom: 5 }} />}
      <div className="cw-empty-title">{title}</div>
      {body && <div className="cw-meta" style={{ maxWidth: '46ch' }}>{body}</div>}
      {action && <div style={{ marginTop: 12 }}>{action}</div>}
    </div>
  );
}

// ============================================================ Error

/**
 * Errors say what failed and offer the one useful action. A 403 is not a
 * failure the user can retry their way out of, so it reads differently from a
 * dropped connection.
 */
export function ErrorState({
  error, onRetry, compact, what = 'this',
}: { error: unknown; onRetry?: () => void; compact?: boolean; what?: string }) {
  const status = (error as any)?.response?.status;
  const offline = typeof navigator !== 'undefined' && !navigator.onLine;

  const forbidden = status === 403;
  const missing = status === 404;

  const title = offline
    ? 'You are offline'
    : forbidden
      ? 'You do not have access'
      : missing
        ? 'Not found'
        : `Could not load ${what}`;

  const body = offline
    ? 'Reconnect and try again — nothing you have typed is lost.'
    : forbidden
      ? 'Your role does not include permission for this. Ask a Consultant Admin if you need it.'
      : missing
        ? 'It may have been deleted or archived since this screen was opened.'
        : apiErrorMessage(error);

  return (
    <div className="cw-empty" style={compact ? { padding: '26px 20px' } : undefined} role="alert">
      <span style={{ color: forbidden ? 'var(--cw-amber)' : 'var(--cw-red)', marginBottom: 5, display: 'inline-flex' }}>
        {offline ? <WifiOff size={compact ? 17 : 20} /> : <AlertCircle size={compact ? 17 : 20} />}
      </span>
      <div className="cw-empty-title">{title}</div>
      <div className="cw-meta" style={{ maxWidth: '48ch' }}>{body}</div>
      {onRetry && !forbidden && (
        <button type="button" className="cw-btn" style={{ marginTop: 12 }} onClick={onRetry}>
          <RefreshCw size={12} /> Try again
        </button>
      )}
    </div>
  );
}

// ============================================================ QueryState

export interface QueryLike<T> {
  data: T | undefined;
  isLoading: boolean;
  isError?: boolean;
  error?: unknown;
  refetch?: () => void;
}

/**
 * Renders the right branch for a react-query result.
 *
 * `isEmpty` is a predicate rather than a boolean so callers pass the check, not
 * the answer — that keeps the empty test next to the data shape it describes.
 */
export function QueryState<T>({
  query, skeleton = 'list', rows, what, empty, isEmpty, children,
}: {
  query: QueryLike<T>;
  skeleton?: SkeletonKind;
  rows?: number;
  what?: string;
  empty?: React.ReactNode;
  isEmpty?: (data: T) => boolean;
  children: (data: T) => React.ReactNode;
}) {
  if (query.isLoading) return <Loading kind={skeleton} rows={rows} />;
  if (query.isError || (!query.data && !query.isLoading)) {
    return <ErrorState error={query.error} what={what} onRetry={query.refetch} />;
  }
  const data = query.data as T;
  if (empty && isEmpty?.(data)) return <>{empty}</>;
  return <>{children(data)}</>;
}

/** Small inline error for panels and sections, where a full state is too loud. */
export function InlineError({ error, onRetry }: { error: unknown; onRetry?: () => void }) {
  return (
    <div style={{
      display: 'flex', alignItems: 'center', gap: 8, padding: '8px 10px',
      borderRadius: 'var(--cw-r)', background: 'var(--cw-red-bg)', color: 'var(--cw-red)',
    }} role="alert">
      <AlertCircle size={13} style={{ flex: 'none' }} />
      <span className="cw-truncate" style={{ flex: 1, fontSize: 12.5 }}>{apiErrorMessage(error)}</span>
      {onRetry && (
        <button type="button" className="cw-btn cw-btn-ghost" style={{ height: 22 }} onClick={onRetry}>Retry</button>
      )}
    </div>
  );
}
