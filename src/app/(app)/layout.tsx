'use client';

import { useEffect } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { useAuth } from '@/features/foundation/auth';
import { Sidebar } from '@/components/organisms/sidebar';
import { Topbar } from '@/components/organisms/topbar';
import { CommandPalette } from '@/components/organisms/command-palette';
import { InstituteShell } from '@/features/verticals/education/institute-dashboard';

export default function AppLayout({ children }: { children: React.ReactNode }) {
  const { ready, user } = useAuth();
  const router = useRouter();
  const pathname = usePathname();

  useEffect(() => {
    if (ready && !user) router.replace('/login');
  }, [ready, user, router]);

  if (!ready || !user) {
    return (
      <div className="flex min-h-screen items-center justify-center" style={{ color: 'var(--ink-2)' }}>
        Loading…
      </div>
    );
  }

  // Travel vertical has its own standalone workspace layout matching Consultancy OS
  if (pathname?.startsWith('/travel')) {
    return <>{children}</>;
  }

  // The captain floor app is a portrait tablet surface a waiter carries around
  // the room, not a console page: it needs the full screen, its own colour-first
  // grid and touch-sized targets. It keeps the auth gate above — only the
  // sidebar, topbar and centred page column are dropped.
  if (pathname?.startsWith('/restaurant/captain')) {
    return <>{children}</>;
  }

  // Institute tenants (AIMER and every white-label institute) get the dedicated
  // teal ERP shell from the Figma design — its own sidebar, top nav and academic
  // context. It replaces the generic shell for this vertical ONLY, so no other
  // tenant's navigation is touched. The command palette is still mounted so ⌘K
  // and the top-nav search keep working.
  if (user.organization?.vertical === 'INSTITUTE') {
    return (
      <>
        <InstituteShell>{children}</InstituteShell>
        <CommandPalette />
      </>
    );
  }

  return (
    <div style={{ display: 'flex', minHeight: '100vh', background: 'var(--bg)' }}>
      <Sidebar />
      <div id="crm-main" style={{ flex: 1, minWidth: 0, height: '100vh', overflowY: 'auto' }}>
        <Topbar />
        <main style={{ padding: '30px 40px 72px', maxWidth: 1360, margin: '0 auto' }}>{children}</main>
      </div>
      {/* Mounted once for the whole app shell: ⌘K works on every route. */}
      <CommandPalette />
    </div>
  );
}
