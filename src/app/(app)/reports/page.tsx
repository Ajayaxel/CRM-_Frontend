'use client';

import { ReportsFeature } from '@/features/platform/reports';
import { useAuth } from '@/features/foundation/auth';
import Link from 'next/link';

// The admissions/counsellor analytics are an education product. Other verticals
// have their own report surfaces — send a direct URL hit there instead of
// showing an institute screen.
export default function ReportsPage() {
  const { user } = useAuth();
  const vertical = user?.organization?.vertical;
  if (vertical === 'INSTITUTE' || vertical === 'STUDY_ABROAD' || !vertical) return <ReportsFeature />;
  const home = vertical === 'SOLAR' ? '/solar/reports' : vertical === 'RETAIL' ? '/retail' : '/dashboard';
  return (
    <div className="card" style={{ padding: 32, textAlign: 'center', color: 'var(--ink-2)' }}>
      <div style={{ fontWeight: 700, fontSize: 16, marginBottom: 6 }}>Reports live in your vertical&apos;s own section</div>
      <p style={{ fontSize: 13.5, margin: '0 0 16px' }}>This screen covers admissions analytics for education tenants.</p>
      <Link href={home} className="btn-primary" style={{ display: 'inline-flex', alignItems: 'center', height: 38, padding: '0 18px' }}>Go to your reports</Link>
    </div>
  );
}
