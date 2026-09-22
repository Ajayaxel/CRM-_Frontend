'use client';

/**
 * Consultant workspace layout.
 *
 * A sibling of the CRM `(app)` group rather than a child, so the workspace gets
 * the whole viewport and its own compact rail instead of nesting a second
 * sidebar inside the CRM shell. Every other vertical keeps the CRM shell
 * untouched.
 */

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/features/foundation/auth';
import { WorkspaceShell } from '@/features/verticals/consulting/consultant/ui/shell';
import '@/features/verticals/consulting/consultant/ui/workspace.css';

export default function ConsultantLayout({ children }: { children: React.ReactNode }) {
  const { ready, user } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (ready && !user) router.replace('/login');
  }, [ready, user, router]);

  if (!ready || !user) {
    return (
      <div style={{ display: 'flex', minHeight: '100vh', alignItems: 'center', justifyContent: 'center', color: 'var(--ink-3)' }}>
        Loading…
      </div>
    );
  }

  return <WorkspaceShell>{children}</WorkspaceShell>;
}
