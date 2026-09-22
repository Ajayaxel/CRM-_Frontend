import React from 'react';
import { ArrowUpRight } from 'lucide-react';
import Link from 'next/link';

/**
 * Your pipeline at a glance.
 *
 * This card used to claim "Your Conversion Rank #8, +6, compared to 50
 * counsellors" with a progress bar at 84% and four counters — every one of
 * those a hardcoded literal, rendered beside KPIs that read zero. There is no
 * ranking anywhere in the platform to compute a rank from, so the honest card
 * is the one that shows the numbers we DO hold.
 */
export function ConversionRank({
  totalLeads = 0,
  convertedLeads = 0,
  followUpsDue = 0,
  conversionRate = 0,
  ownerLabel = 'Owner',
}: {
  totalLeads?: number;
  convertedLeads?: number;
  followUpsDue?: number;
  conversionRate?: number;
  ownerLabel?: string;
}) {
  const open = Math.max(totalLeads - convertedLeads, 0);
  const pct = Math.max(0, Math.min(100, Math.round(conversionRate)));

  const rows = [
    { c: 'rgba(255,255,255,.5)', l: 'Open leads', v: open },
    { c: 'var(--gold)', l: 'Follow-ups due', v: followUpsDue },
    { c: '#5DD39E', l: 'Converted', v: convertedLeads },
  ];

  return (
    <div style={{ position: 'relative', overflow: 'hidden', borderRadius: 20, background: 'linear-gradient(150deg,#1B2C8C,#0D1854)', color: '#fff', padding: 24, boxShadow: '0 18px 40px rgba(13,24,84,.28)' }}>
      <div style={{ position: 'absolute', inset: 0, backgroundImage: 'radial-gradient(circle 1px at 50% 50%,rgba(255,255,255,.13) 1px,transparent 0)', backgroundSize: '15px 15px' }} />
      <div style={{ position: 'relative' }}>
        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between' }}>
          <div>
            <div style={{ fontWeight: 600, fontSize: 14 }}>Your pipeline</div>
            <div style={{ fontSize: 12, color: 'rgba(255,255,255,.6)', marginTop: 2 }}>
              {totalLeads > 0 ? `${totalLeads} lead${totalLeads === 1 ? '' : 's'} in the book` : 'No leads yet'}
            </div>
          </div>
          <Link
            href="/leads"
            aria-label="Open leads"
            style={{ width: 32, height: 32, borderRadius: 99, background: 'rgba(255,255,255,.12)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
          >
            <ArrowUpRight size={15} color="#fff" strokeWidth={2} />
          </Link>
        </div>

        <div style={{ display: 'flex', alignItems: 'baseline', gap: 8, margin: '20px 0 8px' }}>
          <span style={{ fontSize: 52, fontWeight: 800, letterSpacing: '-.03em', lineHeight: .9, fontVariantNumeric: 'tabular-nums' }}>{pct}</span>
          <span style={{ fontSize: 20, fontWeight: 700, color: 'rgba(255,255,255,.7)' }}>%</span>
          <span style={{ fontSize: 12.5, color: 'rgba(255,255,255,.6)', marginLeft: 4 }}>converted</span>
        </div>

        <div style={{ height: 6, borderRadius: 99, background: 'rgba(255,255,255,.16)', position: 'relative', margin: '14px 0 6px' }}>
          <div style={{ position: 'absolute', left: 0, top: 0, height: '100%', width: `${pct}%`, background: 'var(--gold)', borderRadius: 99, transition: 'width 320ms cubic-bezier(.4,0,.2,1)' }} />
        </div>
        <div style={{ fontSize: 11, color: 'rgba(255,255,255,.55)', marginBottom: 18 }}>
          {convertedLeads} of {totalLeads} converted{ownerLabel ? ` · you are the ${ownerLabel.toLowerCase()}` : ''}
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 11 }}>
          {rows.map((r) => (
            <div key={r.l} style={{ display: 'flex', alignItems: 'center', gap: 10, fontSize: 13 }}>
              <span style={{ width: 8, height: 8, borderRadius: 99, background: r.c }} />
              <span style={{ flex: 1, color: 'rgba(255,255,255,.85)' }}>{r.l}</span>
              <span style={{ fontWeight: 700, fontVariantNumeric: 'tabular-nums' }}>{r.v}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
