'use client';

/**
 * The frame every JUSTPOS console screen sits in.
 *
 * WHY THIS IS NOT THE FIGMA RAIL. The designs draw their own left rail — Home,
 * Order, Inventory, KDS, Reports, Settings — inside each 1194x834 frame. That
 * rail is navigation, not chrome unique to the POS, and the platform already
 * has one that knows the tenant's vertical, the user's permissions and the
 * command palette. Rebuilding it inside the page would give a restaurant user
 * two sidebars, and would drop permission filtering on the second. So the rail
 * ships as nav entries (lib/nav.ts, vertical RESTAURANT) and each frame becomes
 * an ordinary page in this shell.
 *
 * The captain floor app is the opposite case and deliberately does NOT use this
 * shell: it is a standing-up tablet app, not a console page. See captain-shell.
 */

import React from 'react';
import { ChefHat } from 'lucide-react';

export function RestaurantPage({
  title, subtitle, actions, children,
}: {
  title: string;
  subtitle?: string;
  /** Secondary actions first, primary last — the shell does not reorder them. */
  actions?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <div className="rst ds-page">
      <header className="ds-pagehead">
        <div className="ds-pagehead-main">
          <div className="ds-context">
            <ChefHat size={18} strokeWidth={1.9} aria-hidden />
            <span className="ds-context-name">Point of sale</span>
          </div>
          <h1 className="ds-h1">{title}</h1>
          {subtitle && <p className="ds-caption ds-pagehead-sub">{subtitle}</p>}
        </div>
        {actions && <div className="ds-pagehead-actions">{actions}</div>}
      </header>
      {children}
    </div>
  );
}

/** A section inside a POS page: a heading, optional tools, a body. */
export function RestaurantSection({
  title, tools, children,
}: { title: string; tools?: React.ReactNode; children: React.ReactNode }) {
  return (
    <section className="ds-card ds-section">
      <div className="ds-section-head">
        <h2 className="ds-h3">{title}</h2>
        {tools && <div className="ds-row ds-section-tools">{tools}</div>}
      </div>
      {children}
    </section>
  );
}
