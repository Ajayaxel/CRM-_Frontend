'use client';

/**
 * Page chrome shared by every screen.
 *
 * The breadcrumb goes into the topbar rather than repeating inside the content,
 * so the content area starts with the content. The page header itself is a
 * single line of type plus actions — no banner, no card.
 */

import React from 'react';
import { Crumbs } from '../ui/primitives';
import { TopbarSlot } from '../ui/shell';

export function Page({
  crumbs, title, description, actions, toolbar, children, wide,
}: {
  crumbs?: { label: string; href?: string }[];
  title?: React.ReactNode;
  description?: React.ReactNode;
  actions?: React.ReactNode;
  /** Row that sits under the title — filters, views, view switchers. */
  toolbar?: React.ReactNode;
  children: React.ReactNode;
  wide?: boolean;
}) {
  return (
    <>
      {crumbs && <TopbarSlot><Crumbs items={crumbs} /></TopbarSlot>}
      <div className={wide ? 'cw-body-wide' : 'cw-body'}>
        {(title || actions) && (
          <div style={{ display: 'flex', alignItems: 'flex-start', gap: 14, flexWrap: 'wrap', padding: '18px 0 4px' }}>
            <div style={{ minWidth: 0, flex: 1 }}>
              {title && <h1 className="cw-h1">{title}</h1>}
              {description && <div className="cw-meta" style={{ marginTop: 3, maxWidth: '72ch' }}>{description}</div>}
            </div>
            {actions && <div style={{ display: 'flex', gap: 6, alignItems: 'center', flex: 'none' }}>{actions}</div>}
          </div>
        )}
        {toolbar}
        {children}
      </div>
    </>
  );
}

/** Hairline-separated block used on record overviews instead of a card. */
export function Section({
  title, count, action, children,
}: { title: string; count?: number; action?: React.ReactNode; children: React.ReactNode }) {
  return (
    <section className="cw-section">
      <div className="cw-section-head">
        <h3 className="cw-h2">{title}</h3>
        {count != null && <span className="cw-tab-count">{count}</span>}
        {action && <span style={{ marginLeft: 'auto' }}>{action}</span>}
      </div>
      {children}
    </section>
  );
}

/** Two-up grid for record overview sections. */
export function SectionGrid({ children }: { children: React.ReactNode }) {
  return (
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(330px,1fr))', gap: '0 34px' }}>
      {children}
    </div>
  );
}
