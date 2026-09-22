'use client';

import Link from 'next/link';

/**
 * Where a suspended workspace lands.
 *
 * Without this page a suspension reads as a bug: every request 403s, each
 * screen renders its own error toast, and a user who reloads is bounced to the
 * login form with no idea why their password stopped working. One page, one
 * explanation, and no automatic retry — the backend refusal is the security
 * control, so this only has to be honest and stop.
 *
 * It says nothing about WHY. The platform records no suspension reason, so
 * there is nothing true to show, and guessing on the tenant's screen would be
 * worse than the silence.
 */
export default function SuspendedPage() {
  return (
    <div style={{ maxWidth: 420, margin: '0 auto', textAlign: 'center', padding: '48px 0' }}>
      <div
        aria-hidden
        style={{
          width: 56, height: 56, borderRadius: 16, margin: '0 auto 20px',
          display: 'grid', placeItems: 'center',
          background: 'var(--danger-bg)', color: 'var(--danger)', fontSize: 26,
        }}
      >
        !
      </div>
      <h1 style={{ fontSize: 22, fontWeight: 650, marginBottom: 10 }}>Workspace suspended</h1>
      <p style={{ color: 'var(--ink-2)', lineHeight: 1.6, marginBottom: 28 }}>
        Access to this workspace has been suspended. Your data has not been changed or
        removed. Please contact your administrator to have access restored.
      </p>
      <Link href="/login" className="btn-secondary" style={{ display: 'inline-block' }}>
        Back to sign in
      </Link>
    </div>
  );
}
