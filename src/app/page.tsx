'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/features/foundation/auth';

export default function Home() {
  const { ready, user } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!ready) return;
    router.replace(user ? '/dashboard' : '/login');
  }, [ready, user, router]);

  return (
    <div className="flex min-h-screen items-center justify-center" style={{ color: 'var(--ink-2)' }}>
      Loading…
    </div>
  );
}
