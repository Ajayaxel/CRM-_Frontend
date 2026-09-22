'use client';

import { EmailSettings } from '@/features/platform/settings/components/email-settings';

export default function EmailSettingsPage() {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
      <div>
        <h1 className="ds-h1">Email</h1>
        <p className="ds-body" style={{ color: 'var(--ink-2)', maxWidth: '44rem', margin: '4px 0 0' }}>
          Connect your own mailbox so invitations, renewal notices and statements reach your
          customers from your domain — not from the platform.
        </p>
      </div>
      <EmailSettings />
    </div>
  );
}
