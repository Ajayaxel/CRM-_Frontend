'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Rocket } from 'lucide-react';
import { useOnboarding } from '../hooks/use-onboarding';

/** Persistent "Setup — N%" chip in the header until the tenant is activated or skips. */
export function SetupChip() {
  const pathname = usePathname();
  const { data } = useOnboarding();
  if (!data || data.skipped || data.activated || pathname === '/get-started') return null;

  return (
    <Link href="/get-started" style={{
      display: 'inline-flex', alignItems: 'center', gap: 7, height: 34, padding: '0 12px', borderRadius: 10,
      background: 'var(--brand-bg,#eef1fb)', color: 'var(--brand,#132376)', fontSize: 12.5, fontWeight: 700,
      textDecoration: 'none', border: '1px solid var(--brand,#132376)',
    }}>
      <Rocket size={14} /> Setup — {data.percent}%
    </Link>
  );
}
