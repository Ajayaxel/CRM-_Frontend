'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Settings, ChevronDown, ShieldCheck } from 'lucide-react';
import { NAV_ITEMS, NAV_SECTIONS, navMatchesVertical, navMatchesProducts } from '@/lib/nav';
import { useAuth } from '@/features/foundation/auth';
import { shellCopy } from '@/lib/shell-copy';
import { setOrgLocale } from '@/lib/org-locale';

export function Sidebar() {
  const pathname = usePathname();
  const { user, hasPermission } = useAuth();

  const routeVertical =
    pathname?.startsWith('/travel') ? 'TRAVEL' :
    pathname?.startsWith('/insurance') ? 'INSURANCE' :
    pathname?.startsWith('/solar') ? 'SOLAR' :
    pathname?.startsWith('/coworking') ? 'COWORKING' :
    pathname?.startsWith('/poultry') ? 'POULTRY' :
    pathname?.startsWith('/retail') ? 'RETAIL' :
    pathname?.startsWith('/properties') || pathname?.startsWith('/agent') || pathname?.startsWith('/owners') ? 'REAL_ESTATE' :
    null;

  const vertical = routeVertical ?? user?.organization?.vertical ?? 'INSTITUTE';
  setOrgLocale(user?.organization as any);
  const visible = NAV_ITEMS.filter(
    (i) => (!i.permission || hasPermission(i.permission))
      && navMatchesVertical(i, vertical)
      && navMatchesProducts(i, (user?.organization as any)?.products),
  );

  const rowStyle = (active: boolean): React.CSSProperties => ({
    display: 'flex',
    alignItems: 'center',
    gap: 11,
    padding: '9px 12px',
    borderRadius: 10,
    fontSize: 13.5,
    fontWeight: 600,
    cursor: 'pointer',
    color: active ? 'var(--sb-ink)' : 'var(--sb-ink-2)',
    background: active ? 'var(--sb-active)' : 'transparent',
    boxShadow: active ? 'inset 2px 0 0 var(--gold)' : 'none',
    transition: 'background .12s, color .12s',
  });

  return (
    <aside
      style={{
        width: 250,
        flex: '0 0 250px',
        background: 'var(--sb)',
        color: 'var(--sb-ink)',
        position: 'sticky',
        top: 0,
        height: '100vh',
        display: 'flex',
        flexDirection: 'column',
        borderRight: '1px solid var(--sb-line)',
      }}
    >
      {/* Brand */}
      <div style={{ padding: '22px 20px 14px', display: 'flex', alignItems: 'center', gap: 11 }}>
        <div
          style={{
            width: 38,
            height: 38,
            borderRadius: 11,
            background: 'linear-gradient(135deg,#1B2C8C,#0D1854)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            flex: '0 0 38px',
            boxShadow: '0 4px 12px rgba(19,35,118,.45)',
          }}
        >
          <ShieldCheck size={20} color="#fff" strokeWidth={1.9} />
        </div>
        <div style={{ lineHeight: 1.15, minWidth: 0 }}>
          <div style={{ fontWeight: 700, fontSize: 15, letterSpacing: '-.01em', whiteSpace: 'nowrap' }}>
            BMN Connect
          </div>
          <div style={{ fontSize: 11, color: 'var(--sb-ink-2)', fontWeight: 500, whiteSpace: 'nowrap' }}>
            {shellCopy(vertical).product}
          </div>
        </div>
      </div>

      {/* Nav */}
      <nav style={{ flex: 1, overflowY: 'auto', padding: '10px 14px', display: 'flex', flexDirection: 'column', gap: 3 }}>
        {NAV_SECTIONS.map((section) => {
          const items = visible.filter((i) => i.section === section);
          if (!items.length) return null;
          return (
            <div key={section}>
              <div
                style={{
                  fontFamily: 'var(--mono)',
                  fontSize: 9.5,
                  letterSpacing: '.16em',
                  color: 'var(--sb-ink-2)',
                  textTransform: 'uppercase',
                  padding: '14px 12px 6px',
                }}
              >
                {section}
              </div>
              {items.map((item) => {
                // Prefix matching alone lights up a section root alongside its own
                // children — /insurance would highlight next to /insurance/policies.
                // A parent only claims the row when no sibling matches more of the path.
                const isPrefix = pathname === item.href || pathname.startsWith(item.href + '/');
                const beatenByDeeper = visible.some(
                  (o) => o.href !== item.href
                    && o.href.length > item.href.length
                    && (pathname === o.href || pathname.startsWith(o.href + '/')),
                );
                const active = isPrefix && !beatenByDeeper;
                const Icon = item.icon;
                return (
                  <Link key={item.href} href={item.href} style={rowStyle(active)}>
                    <Icon size={18} strokeWidth={1.7} />
                    <span>{item.label}</span>
                  </Link>
                );
              })}
            </div>
          );
        })}
      </nav>

      {/* Footer */}
      <div style={{ padding: 14, borderTop: '1px solid var(--sb-line)' }}>
        <Link href="/settings" style={rowStyle(pathname.startsWith('/settings'))}>
          <Settings size={18} strokeWidth={1.7} />
          <span>Settings</span>
        </Link>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 4px 4px' }}>
          <img
            src="/assets/avatar-user.jpg"
            alt=""
            style={{ width: 34, height: 34, borderRadius: 99, objectFit: 'cover' }}
          />
          <div style={{ minWidth: 0, flex: 1, lineHeight: 1.2 }}>
            <div
              style={{
                fontWeight: 600,
                fontSize: 13,
                color: 'var(--sb-ink)',
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                whiteSpace: 'nowrap',
              }}
            >
              {user?.firstName} {user?.lastName}
            </div>
            <div style={{ fontSize: 11, color: 'var(--sb-ink-2)' }}>
              {user?.role.name} · {user?.organization.name}
            </div>
          </div>
          <ChevronDown size={16} color="var(--sb-ink-2)" strokeWidth={1.7} />
        </div>
      </div>
    </aside>
  );
}
