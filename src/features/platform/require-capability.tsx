'use client';

import Link from 'next/link';
import { ShieldAlert } from 'lucide-react';
import { usePlatformAuth } from './platform-client';
import { Capability, CAPABILITIES, can, landingFor } from './capabilities';

/**
 * Guards a console page against DIRECT navigation.
 *
 * Hiding a nav link is not a control — anyone can type the URL, and a role can
 * change while a tab is open. The backend refuses either way; this exists so
 * the refusal arrives as a sentence instead of an empty page wired to queries
 * that will only 403. Nothing inside renders, so the page's requests are never
 * made in the first place.
 */
export function RequireCapability({
  capability, children,
}: { capability: Capability; children: React.ReactNode }) {
  const { admin } = usePlatformAuth();
  if (can(admin?.role, capability)) return <>{children}</>;

  return (
    <div style={{
      background: 'var(--surface)', border: '1px solid var(--line-soft)', borderRadius: 16,
      padding: '48px 32px', textAlign: 'center', maxWidth: 460, margin: '40px auto',
    }}>
      <span style={{
        width: 46, height: 46, borderRadius: 13, background: 'var(--danger-bg)', color: 'var(--danger)',
        display: 'inline-flex', alignItems: 'center', justifyContent: 'center', marginBottom: 16,
      }}>
        <ShieldAlert size={22} />
      </span>
      <div style={{ fontWeight: 700, fontSize: 17, marginBottom: 8 }}>Not available to your role</div>
      <p style={{ fontSize: 13.5, color: 'var(--ink-2)', lineHeight: 1.6, margin: '0 0 22px' }}>
        {CAPABILITIES[capability].label} is restricted. You are signed in as{' '}
        <b>{admin?.role?.replace('_', ' ').toLowerCase() ?? 'an unknown role'}</b>.
      </p>
      <Link href={landingFor(admin?.role)} className="btn-secondary" style={{ display: 'inline-block' }}>
        Back to the console
      </Link>
    </div>
  );
}
