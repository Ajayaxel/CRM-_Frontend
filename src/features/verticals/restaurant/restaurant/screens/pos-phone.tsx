'use client';

/**
 * Phone POS — Figma 1:2 (home), 4:192 (catalogue), 10:502 (modifier sheet),
 * 10:718 (cart bar).
 *
 * WHY THIS IS A SHELL AND NOT A THIRD APP. The iPhone set is drawn in its own
 * visual language — unbranded, USD, its own card style — but functionally it is
 * a SUBSET of what the captain surface already does: browse a catalogue,
 * configure an item, build a cart, pay. Building a second cart, a second
 * totals calculation and a second write path would repeat the `Cowork` versus
 * `Cw` mistake CLAUDE.md warns about: two implementations of one thing, drifting
 * apart until a push from either one destroys the other.
 *
 * So the genuinely new thing in this set — BOTTOM-TAB NAVIGATION, which no
 * other surface has — is what gets built here, and the tabs route to the
 * screens that already exist. The modifier sheet the phone frames introduce is
 * a shared component, used by the captain order too.
 *
 * The frame's own KPI wording ("Today Sale", "+12% from yesterday") is not
 * reproduced: the deltas have no source, exactly as on the console home.
 */

import React from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Home, Package, Settings, ShoppingBag } from 'lucide-react';

const TABS = [
  { href: '/restaurant', label: 'Home', icon: Home },
  { href: '/restaurant/captain/order', label: 'Order', icon: ShoppingBag },
  { href: '/restaurant/inventory', label: 'Inventory', icon: Package },
  { href: '/restaurant/settings', label: 'Settings', icon: Settings },
] as const;

/**
 * Rendered by the restaurant layout at phone widths only. It is navigation, so
 * it sits outside the scrolling content and clears the home indicator.
 */
export function PosTabBar() {
  const pathname = usePathname();
  return (
    <nav className="rst-tabbar" aria-label="Point of sale">
      {TABS.map((t) => {
        const active = t.href === '/restaurant'
          ? pathname === '/restaurant'
          : pathname?.startsWith(t.href);
        return (
          <Link key={t.href} href={t.href} className={`rst-tab${active ? ' is-on' : ''}`} aria-current={active ? 'page' : undefined}>
            <t.icon size={19} aria-hidden />
            <span>{t.label}</span>
          </Link>
        );
      })}
    </nav>
  );
}
