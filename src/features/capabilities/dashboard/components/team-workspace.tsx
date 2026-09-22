import React from 'react';
import Link from 'next/link';
import { ArrowUpRight } from 'lucide-react';

/**
 * Shortcut into the team inbox.
 *
 * This card used to claim "Updated today at 3:45 PM" and show three presence
 * avatars (PN / MW / SR) — a fabricated timestamp and three people who may not
 * work here. There is no presence service to back either, so the card now says
 * only what is true: it is a way into the shared inbox.
 */
export function TeamWorkspace({ headline = 'Talk it through with your team' }: { headline?: string }) {
  return (
    <Link
      href="/inbox"
      style={{
        position: 'relative', overflow: 'hidden', borderRadius: 20, padding: 22,
        background: 'linear-gradient(155deg,#D8DEF4 0%,#F3EAD6 55%,#F6E7A8 100%)',
        color: '#2A2620', minHeight: 210, display: 'flex', flexDirection: 'column',
        textDecoration: 'none',
      }}
    >
      <div style={{ fontWeight: 600, fontSize: 14 }}>Team Workspace</div>
      <div style={{ fontSize: 12, color: 'rgba(42,38,32,.6)', marginTop: 2 }}>Shared inbox and conversations</div>
      <div style={{ marginTop: 'auto' }}>
        <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', gap: 12 }}>
          <div style={{ fontSize: 22, fontWeight: 700, letterSpacing: '-.02em', lineHeight: 1.2 }}>{headline}</div>
          <span style={{ width: 36, height: 36, borderRadius: 99, background: 'rgba(42,38,32,.9)', display: 'flex', alignItems: 'center', justifyContent: 'center', flex: '0 0 36px' }}>
            <ArrowUpRight size={16} color="#fff" strokeWidth={2} />
          </span>
        </div>
      </div>
    </Link>
  );
}
