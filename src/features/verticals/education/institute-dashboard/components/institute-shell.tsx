'use client';

import { useState } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import {
  BarChart3, TrendingUp, ClipboardList, Users, FileCheck, GraduationCap,
  CalendarDays, CalendarClock, Video, CheckCircle2, ClipboardCheck, BadgeCheck,
  Award, ShieldCheck, Star, CreditCard, Clock4, CheckSquare, Send,
  User as UserIcon, Receipt, Flag, BookOpen, CalendarCheck, Lock, Settings,
  ChevronDown, Search, Plus, Bell, LogOut, Menu, ChevronRight,
} from 'lucide-react';
import { useQuery } from '@tanstack/react-query';
import { api } from '@/lib/api';
import { useAuth } from '@/features/foundation/auth';
import { initials } from '@/lib/utils';
import { useCommandPalette, usePaletteHint } from '@/components/organisms/command-palette';
import { T } from '../dashboard-client';
import { academicYear } from './institute-dashboard';

/**
 * The AIMER / institute ERP shell — the teal, white-label navigation the Figma
 * design (nodes 974:4 sidebar, 974:196 top nav) wraps the dashboard in.
 *
 * It renders ONLY for the INSTITUTE vertical (the layout decides), so no other
 * tenant's shell is touched. The brand mark, product name and colour come from
 * the org: AIMER shows "AIMER ERP" in teal, and another institute shows its own
 * name in its own colour. Every nav row links to a route that exists, is gated
 * by the same permission the generic sidebar uses, and its badge count is a live
 * figure from /institute/dashboard/nav-summary — nothing here is decorative.
 */

type CountKey = 'leads' | 'admissions' | 'onboarding' | 'finance' | 'requests';
interface Item { label: string; href: string; icon: React.ComponentType<{ size?: number; color?: string; strokeWidth?: number }>; perm?: string; count?: CountKey }
interface Group { title: string; items: Item[] }

const NAV: Group[] = [
  { title: '', items: [{ label: 'Dashboard', href: '/dashboard', icon: BarChart3 }] },
  {
    title: 'Student lifecycle',
    items: [
      { label: 'Leads', href: '/leads', icon: TrendingUp, perm: 'lead.view', count: 'leads' },
      { label: 'Admissions', href: '/admissions', icon: ClipboardList, perm: 'admission.view', count: 'admissions' },
      { label: 'Students', href: '/students', icon: Users, perm: 'student.view' },
      { label: 'Onboarding', href: '/onboarding-access', icon: FileCheck, count: 'onboarding' },
    ],
  },
  {
    title: 'Academics',
    items: [
      { label: 'Programs', href: '/courses', icon: GraduationCap, perm: 'course.view' },
      { label: 'Academic Planning', href: '/session-plans', icon: CalendarDays },
      { label: 'Timetable', href: '/academics', icon: CalendarClock },
      { label: 'Sessions', href: '/calendar', icon: Video },
      { label: 'Attendance', href: '/attendance', icon: CheckCircle2 },
      { label: 'Evaluations', href: '/assessments', icon: ClipboardCheck },
      { label: 'Examinations', href: '/exams', icon: FileCheck, perm: 'exam.view' },
      { label: 'OBE', href: '/obe', icon: BadgeCheck },
    ],
  },
  {
    title: 'Student success',
    items: [
      { label: 'Development', href: '/student-success', icon: Award, perm: 'academic.view' },
      { label: 'Industry Programs', href: '/industry-programs', icon: ShieldCheck, perm: 'academic.view' },
      { label: 'Placement', href: '/placements', icon: Star },
    ],
  },
  {
    title: 'Finance',
    items: [
      { label: 'Finance', href: '/fees', icon: CreditCard, count: 'finance' },
    ],
  },
  {
    title: 'Operations',
    items: [
      { label: 'Requests', href: '/academic-requests', icon: Clock4, perm: 'academic.view' },
      { label: 'Tasks', href: '/tasks', icon: CheckSquare, perm: 'task.view' },
      { label: 'Communication', href: '/communication', icon: Send },
    ],
  },
  {
    title: 'People',
    items: [
      { label: 'Employees', href: '/employees', icon: UserIcon, perm: 'hr.view' },
      { label: 'HR', href: '/timesheets', icon: Receipt },
    ],
  },
  {
    title: 'Institution',
    items: [
      { label: 'Alumni', href: '/alumni', icon: Flag, perm: 'alumni.view' },
      { label: 'Library', href: '/library', icon: BookOpen, perm: 'library.view' },
      { label: 'Events', href: '/campus-events', icon: CalendarCheck, perm: 'event.view' },
    ],
  },
  {
    title: 'Administration',
    items: [
      { label: 'Users', href: '/users', icon: Users, perm: 'user.view' },
      { label: 'Roles & Permissions', href: '/organization', icon: Lock, perm: 'org.view' },
      { label: 'Settings', href: '/settings', icon: Settings },
    ],
  },
];

export function InstituteShell({ children }: { children: React.ReactNode }) {
  const { user } = useAuth();
  const brand = brandColor(user?.organization?.primaryColor);

  return (
    <div style={{ display: 'flex', minHeight: '100vh', background: T.bg, fontFamily: T.font }}>
      <InstituteSidebar brand={brand} />
      <div id="crm-main" style={{ flex: 1, minWidth: 0, height: '100vh', overflowY: 'auto', display: 'flex', flexDirection: 'column' }}>
        <InstituteTopbar brand={brand} />
        {/* Fill the area to the right of the sidebar and stay left-aligned to
            it — this is an application shell, not a centred page. A capped,
            margin-auto'd main is what produced the large empty band between the
            sidebar and the content on viewports wider than the 1440 Figma frame.
            At 1440 this fills to the design's 1116 content width exactly; wider,
            it expands with the viewport. */}
        <main style={{ flex: 1, minWidth: 0, width: '100%', padding: '24px 28px 72px' }}>
          {children}
        </main>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------- sidebar

function InstituteSidebar({ brand }: { brand: string }) {
  const pathname = usePathname() ?? '';
  const { user, hasPermission } = useAuth();

  const { data: counts } = useQuery({
    queryKey: ['institute-nav-summary'],
    queryFn: async () => (await api.get<Record<CountKey, number>>('/institute/dashboard/nav-summary')).data,
    staleTime: 60_000,
  });

  const orgName = user?.organization?.name ?? 'Institute';
  const product = shortProduct(orgName);
  const roleName = (user as any)?.role?.name ?? 'Super Administrator';
  const logoUrl = user?.organization?.logoUrl;

  const visibleGroups = NAV
    .map((g) => ({ ...g, items: g.items.filter((i) => !i.perm || hasPermission(i.perm)) }))
    .filter((g) => g.items.length > 0);
  const visibleCount = visibleGroups.reduce((s, g) => s + g.items.length, 0);

  const isActive = (href: string) => {
    const hit = pathname === href || pathname.startsWith(href + '/');
    if (!hit) return false;
    // A parent yields to any sibling that matches more of the path.
    const beaten = visibleGroups.some((g) => g.items.some((o) =>
      o.href !== href && o.href.length > href.length && (pathname === o.href || pathname.startsWith(o.href + '/'))));
    return !beaten;
  };

  // Dark-teal rail palette (Figma sidebar fill is bg/brand-deep #004c5b, light
  // content on top). Kept local so the rest of the app's tokens are untouched.
  const SB = {
    bg: T.brandDeep,               // #004c5b
    text: 'rgba(255,255,255,0.86)',
    muted: 'rgba(255,255,255,0.50)',
    icon: 'rgba(255,255,255,0.72)',
    activeBg: 'rgba(255,255,255,0.13)',
    badgeBg: 'rgba(255,255,255,0.15)',
    footerBg: 'rgba(255,255,255,0.08)',
  };

  return (
    <aside style={{ width: 268, flex: '0 0 268px', background: SB.bg,
      height: '100vh', position: 'sticky', top: 0, display: 'flex', flexDirection: 'column' }}>
      {/* brand */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 11, padding: '20px 16px 14px' }}>
        <div style={{ width: 38, height: 38, borderRadius: 11, flex: '0 0 38px', background: '#ffffff',
          display: 'flex', alignItems: 'center', justifyContent: 'center', overflow: 'hidden' }}>
          {logoUrl
            ? <img src={logoUrl} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
            : <GraduationCap size={21} color={SB.bg} strokeWidth={2} />}
        </div>
        <div style={{ minWidth: 0, flex: 1 }}>
          <div style={{ fontSize: 15, fontWeight: 700, letterSpacing: '-0.2px', color: '#fff', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
            {product}
          </div>
          <div style={{ fontSize: 11, color: SB.muted, fontWeight: 500 }}>{roleName}</div>
        </div>
        <button title="Collapse" style={{ width: 30, height: 30, borderRadius: 8, border: 'none', background: 'rgba(255,255,255,0.08)', color: SB.icon, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <Menu size={16} />
        </button>
      </div>

      {/* nav */}
      <nav style={{ flex: 1, overflowY: 'auto', padding: '0 12px 12px' }}>
        {visibleGroups.map((g, gi) => (
          <div key={g.title || 'top'} style={{ marginTop: gi === 0 ? 2 : 12 }}>
            {g.title && (
              <div style={{ fontSize: 11, fontWeight: 590, letterSpacing: '0.8px', textTransform: 'uppercase',
                color: SB.muted, padding: '10px 12px 5px' }}>{g.title}</div>
            )}
            {g.items.map((it) => {
              const active = isActive(it.href);
              const Icon = it.icon;
              const count = it.count ? counts?.[it.count] : undefined;
              return (
                <Link key={it.label + it.href} href={it.href}
                  style={{ display: 'flex', alignItems: 'center', gap: 11, padding: '8px 12px', borderRadius: 9,
                    textDecoration: 'none', marginBottom: 2,
                    background: active ? SB.activeBg : 'transparent',
                    color: active ? '#fff' : SB.text }}>
                  <Icon size={17} color={active ? '#fff' : SB.icon} strokeWidth={1.8} />
                  <span style={{ flex: 1, minWidth: 0, fontSize: 13.5, fontWeight: active ? 700 : 500, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{it.label}</span>
                  {count != null && count > 0 && (
                    <span style={{ fontSize: 11, fontWeight: 700, color: '#fff',
                      background: SB.badgeBg, borderRadius: 999, padding: '1px 8px', minWidth: 24, textAlign: 'center' }}>
                      {count > 999 ? `${(count / 1000).toFixed(1)}K` : count}
                    </span>
                  )}
                </Link>
              );
            })}
          </div>
        ))}
      </nav>

      {/* role scope footer */}
      <div style={{ margin: 12, padding: '11px 12px', background: SB.footerBg, borderRadius: 10, display: 'flex', gap: 9, alignItems: 'center' }}>
        <ShieldCheck size={16} color="rgba(255,255,255,0.85)" />
        <span style={{ fontSize: 12, fontWeight: 600, color: 'rgba(255,255,255,0.85)', lineHeight: 1.3 }}>
          All {visibleCount} modules visible · {roleName}
        </span>
      </div>
    </aside>
  );
}

// ---------------------------------------------------------------- topbar

function InstituteTopbar({ brand }: { brand: string }) {
  const { user, logout } = useAuth();
  const pathname = usePathname() ?? '';
  const router = useRouter();
  const palette = useCommandPalette();
  const paletteHint = usePaletteHint();
  const [menu, setMenu] = useState(false);

  const crumb = crumbFor(pathname);
  const orgName = user?.organization?.name ?? 'Institute';
  const roleName = (user as any)?.role?.name ?? 'Super Admin';

  const iconBtn: React.CSSProperties = {
    width: 40, height: 40, borderRadius: 10, border: `1px solid ${T.border}`, background: T.surface,
    color: T.ink2, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center',
  };

  return (
    <header style={{ position: 'sticky', top: 0, zIndex: 30, height: 79, background: T.surface,
      borderBottom: `1px solid ${T.border}`, display: 'flex', alignItems: 'center', gap: 16, padding: '0 28px' }}>
      {/* breadcrumb */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 13, color: T.ink3, flex: '0 0 auto' }}>
        <span>Home</span>
        <ChevronRight size={14} />
        <span style={{ color: T.ink, fontWeight: 600 }}>{crumb}</span>
      </div>

      {/* global search → command palette */}
      <button onClick={palette.open} aria-haspopup="dialog"
        style={{ display: 'flex', alignItems: 'center', gap: 10, height: 40, flex: 1, maxWidth: 410,
          borderRadius: 10, border: `1px solid ${T.border}`, background: T.bg, padding: '0 14px', cursor: 'pointer', color: T.ink3 }}>
        <Search size={17} strokeWidth={1.8} />
        <span style={{ flex: 1, textAlign: 'left', fontSize: 13 }}>Search students, employees, records or settings</span>
        <kbd style={{ fontSize: 11, color: T.ink3, border: `1px solid ${T.border}`, borderRadius: 5, padding: '1px 6px', background: T.surface }}>{paletteHint}</kbd>
      </button>

      <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 10 }}>
        <ContextSelector label="Academic year" value={academicYear()} options={[academicYear()]} />
        <ContextSelector label="Campus" value="Main campus" options={['Main campus']} sub={orgName} />

        <Link href="/leads?new=1" title="Create" style={iconBtn}><Plus size={18} strokeWidth={2} /></Link>
        <button title="Notifications" style={{ ...iconBtn, position: 'relative' }}>
          <Bell size={18} strokeWidth={1.8} />
          <span style={{ position: 'absolute', top: 8, right: 9, width: 7, height: 7, borderRadius: 99, background: brand, border: `1.5px solid ${T.surface}` }} />
        </button>

        <div style={{ position: 'relative' }}>
          <button onClick={() => setMenu((v) => !v)}
            style={{ display: 'flex', alignItems: 'center', gap: 9, border: 'none', background: 'transparent', cursor: 'pointer', padding: 3 }}>
            <span style={{ width: 32, height: 32, borderRadius: 99, background: brand, color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 12, fontWeight: 700 }}>
              {initials(user?.firstName, user?.lastName)}
            </span>
            <span style={{ textAlign: 'left', lineHeight: 1.2 }}>
              <span style={{ display: 'block', fontSize: 13, fontWeight: 600, color: T.ink, whiteSpace: 'nowrap' }}>
                {`${user?.firstName ?? ''} ${user?.lastName ?? ''}`.trim() || user?.email}
              </span>
              <span style={{ display: 'block', fontSize: 11, color: T.ink3 }}>{roleName}</span>
            </span>
            <ChevronDown size={16} color={T.ink3} />
          </button>
          {menu && (
            <>
              <div style={{ position: 'fixed', inset: 0, zIndex: 10 }} onClick={() => setMenu(false)} />
              <div style={{ position: 'absolute', right: 0, marginTop: 8, width: 220, zIndex: 20, background: T.surface,
                border: `1px solid ${T.border}`, borderRadius: 12, boxShadow: T.shadow, padding: '4px 0' }}>
                <div style={{ padding: '10px 16px', borderBottom: `1px solid ${T.border}` }}>
                  <div style={{ fontSize: 13, fontWeight: 600, color: T.ink, overflow: 'hidden', textOverflow: 'ellipsis' }}>{user?.email}</div>
                  <div style={{ fontSize: 12, color: T.ink3 }}>{orgName}</div>
                </div>
                <button onClick={() => { setMenu(false); router.push('/settings/profile'); }} style={menuItem}>
                  <UserIcon size={16} /> My profile
                </button>
                <button onClick={logout} style={{ ...menuItem, color: T.danger }}>
                  <LogOut size={16} /> Sign out
                </button>
              </div>
            </>
          )}
        </div>
      </div>
    </header>
  );
}

function ContextSelector({ label, value, options, sub }: { label: string; value: string; options: string[]; sub?: string }) {
  const [open, setOpen] = useState(false);
  return (
    <div style={{ position: 'relative' }} className="ds-hide-sm">
      <button onClick={() => setOpen((v) => !v)}
        style={{ display: 'flex', alignItems: 'center', gap: 8, height: 47, padding: '0 12px', borderRadius: 10,
          border: `1px solid ${T.border}`, background: T.surface, cursor: 'pointer' }}>
        <span style={{ textAlign: 'left', lineHeight: 1.25 }}>
          <span style={{ display: 'block', fontSize: 11, color: T.ink3 }}>{label}</span>
          <span style={{ display: 'block', fontSize: 13, fontWeight: 600, color: T.ink, whiteSpace: 'nowrap' }}>{value}</span>
        </span>
        <ChevronDown size={16} color={T.ink3} />
      </button>
      {open && (
        <>
          <div style={{ position: 'fixed', inset: 0, zIndex: 10 }} onClick={() => setOpen(false)} />
          <div style={{ position: 'absolute', right: 0, marginTop: 6, minWidth: 180, zIndex: 20, background: T.surface,
            border: `1px solid ${T.border}`, borderRadius: 10, boxShadow: T.shadow, padding: 6 }}>
            {sub && <div style={{ fontSize: 11, color: T.ink3, padding: '4px 10px' }}>{sub}</div>}
            {options.map((o) => (
              <div key={o} style={{ fontSize: 13, fontWeight: o === value ? 700 : 500, color: o === value ? T.brandText : T.ink,
                padding: '8px 10px', borderRadius: 7, background: o === value ? T.brandSubtle : 'transparent' }}>{o}</div>
            ))}
          </div>
        </>
      )}
    </div>
  );
}

const menuItem: React.CSSProperties = {
  display: 'flex', width: '100%', alignItems: 'center', gap: 8, padding: '9px 16px',
  fontSize: 13, color: T.ink, background: 'transparent', border: 'none', cursor: 'pointer', textAlign: 'left',
};

// ---------------------------------------------------------------- helpers

const PLATFORM_DEFAULT = '#4f46e5';
function brandColor(primary?: string | null): string {
  return primary && primary.toLowerCase() !== PLATFORM_DEFAULT ? primary : T.brand;
}

/** "AIMER Institute of Management" → "AIMER ERP"; a generic name keeps its first word. */
function shortProduct(orgName: string): string {
  const first = orgName.trim().split(/\s+/)[0] || 'Institute';
  return `${first} ERP`;
}

const CRUMBS: Record<string, string> = {
  '/dashboard': 'Dashboard', '/leads': 'Leads', '/admissions': 'Admissions', '/students': 'Students',
  '/onboarding-access': 'Onboarding', '/courses': 'Programs', '/session-plans': 'Academic Planning',
  '/academics': 'Timetable', '/calendar': 'Sessions', '/attendance': 'Attendance', '/assessments': 'Evaluations',
  '/obe': 'OBE', '/student-success': 'Student success', '/placements': 'Placement', '/fees': 'Finance',
  '/exams': 'Examination', '/rms': 'Requests', '/academic-requests': 'Requests', '/tasks': 'Tasks', '/communication': 'Communication',
  '/employees': 'Employees', '/timesheets': 'HR', '/alumni': 'Alumni', '/library': 'Library',
  '/campus-events': 'Events', '/users': 'Users', '/organization': 'Roles & Permissions', '/settings': 'Settings',
};
function crumbFor(pathname: string): string {
  const base = '/' + (pathname.split('/')[1] ?? '');
  return CRUMBS[base] ?? (base === '/' ? 'Dashboard' : base.slice(1).replace(/^\w/, (c) => c.toUpperCase()));
}

function hexA(hex: string, alpha: number): string {
  const m = hex.replace('#', '');
  if (m.length !== 6) return `rgba(0,139,165,${alpha})`;
  const r = parseInt(m.slice(0, 2), 16), g = parseInt(m.slice(2, 4), 16), b = parseInt(m.slice(4, 6), 16);
  return `rgba(${r},${g},${b},${alpha})`;
}
