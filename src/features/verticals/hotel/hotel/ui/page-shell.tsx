'use client';

/**
 * The frame every hospitality screen sits in.
 *
 * Three problems it exists to solve, all of which were per-screen before:
 *
 *  1. WHICH PROPERTY. In a multi-property tenant the answer has to be
 *     unmissable, and it was eight-point grey text in a corner. It is now the
 *     first thing on the page, at heading weight, with the switcher attached to
 *     it rather than floating beside a title.
 *
 *  2. SPACING. The screens hardcoded `padding: 24`, `marginBottom: 20`,
 *     `gap: 12` inline. The design system already publishes a scale — `--s-1`
 *     to `--s-9`, `--pad-page`, `--gap-section` — and `ds-page` applies it
 *     including the narrow-viewport override. Bypassing it is why the spacing
 *     read as inconsistent between one hospitality screen and the next, and
 *     between hospitality and the rest of the product.
 *
 *  3. ACTIONS. Primary and secondary actions sat wherever each screen put them.
 *     There is one slot now, top right, primary last.
 *
 * The classes it uses are `ds-` rather than hospitality-specific on purpose:
 * "which workspace am I in" is a question every multi-tenant vertical has, and
 * restaurant, clinic and coworking should inherit this frame rather than each
 * inventing a header.
 */

import React from 'react';
import { Building2, ChevronDown } from 'lucide-react';
import { EmptyState, Skeleton } from './kit';
import { useHotelProperty } from '../hooks/use-hotel-property';

export function HospitalityPage({
  title, subtitle, actions, children,
}: {
  title: string;
  subtitle?: string;
  /** Secondary actions first, primary last — the shell does not reorder them. */
  actions?: React.ReactNode;
  children: React.ReactNode;
}) {
  const { properties, property, propertyId, needsPicker, select, isUnassigned, isLoading } = useHotelProperty();

  if (isLoading) {
    return <div className="ds-page"><Skeleton rows={4} /></div>;
  }

  // Fail-closed scope showing through to the UI. Saying so beats an empty
  // dashboard that reads like a quiet night.
  if (isUnassigned) {
    return (
      <div className="ds-page">
        <EmptyState
          icon={Building2}
          title="No property assigned to you"
          body="You can see a property's front desk once an administrator adds you to its staff roster. If you manage the whole group, ask for the tenant-wide hospitality permission."
        />
      </div>
    );
  }

  return (
    <div className="ds-page">
      <header className="ds-pagehead">
        <div className="ds-pagehead-main">
          <div className="ds-context">
            <Building2 size={18} strokeWidth={1.9} aria-hidden />
            {needsPicker ? (
              <div className="ds-context-switch">
                <select
                  aria-label="Switch property"
                  value={propertyId ?? ''}
                  onChange={(e) => select(e.target.value)}
                >
                  {properties.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
                </select>
                <span aria-hidden className="ds-context-name">
                  {property?.name}
                  <ChevronDown size={15} strokeWidth={2} />
                </span>
              </div>
            ) : (
              <span className="ds-context-name">{property?.name}</span>
            )}
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

/** A section inside a hospitality page: a heading, optional tools, a body. */
export function HospitalitySection({
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
