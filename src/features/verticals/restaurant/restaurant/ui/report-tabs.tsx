'use client';

/**
 * The three reports the source groups under one Reports menu.
 *
 * `TenantSidebar` lists Sales Report, Cancel Order Report and Stock Report as
 * children of a single entry. They are one nav entry and three tabs here rather
 * than three sidebar rows, because the restaurant sidebar already carries
 * thirty-one links and the grouping is what carries the meaning.
 */

import React from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';

export const RST_REPORTS = [
  { href: '/restaurant/reports', label: 'Sales' },
  { href: '/restaurant/reports/cancelled', label: 'Cancelled orders' },
  { href: '/restaurant/reports/stock', label: 'Stock' },
];

export function ReportTabs() {
  const pathname = usePathname();
  return (
    <div className="rst-seg rst-seg-sm" role="tablist" aria-label="Report">
      {RST_REPORTS.map((r) => (
        <Link
          key={r.href}
          href={r.href}
          role="tab"
          aria-selected={pathname === r.href}
          className={`rst-seg-item${pathname === r.href ? ' is-on' : ''}`}
        >
          {r.label}
        </Link>
      ))}
    </div>
  );
}
