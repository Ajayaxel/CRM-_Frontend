'use client';

// §8 + §9 — Receivables and Payables.
//
// Both are the same shape of question ("who owes whom, and how late is it"), so
// they are one component with two configurations rather than two screens that
// drift apart. The figures come from the existing ar-aging / ap-aging endpoints,
// which read the open invoices and bills directly — not a cached balance.

import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { HandCoins, ReceiptText, ChevronDown, ChevronUp } from 'lucide-react';
import { api } from '@/lib/api';
import { Aging, money } from '../accounts-client';

const card: React.CSSProperties = { background: 'var(--surface)', border: '1px solid var(--line-soft)', borderRadius: 16 };
const th: React.CSSProperties = { textAlign: 'left', fontSize: 11, letterSpacing: '.05em', textTransform: 'uppercase', color: 'var(--ink-3)', fontWeight: 700, padding: '9px 12px', borderBottom: '1px solid var(--line-soft)', whiteSpace: 'nowrap' };
const td: React.CSSProperties = { padding: '10px 12px', fontSize: 13.5, borderBottom: '1px solid var(--line-soft)' };
const num: React.CSSProperties = { ...td, textAlign: 'right', fontVariantNumeric: 'tabular-nums', whiteSpace: 'nowrap' };

// The four ageing buckets, plus the status each one means in plain words. The
// spec asks for statuses (Current / Due Soon / Overdue); ageing already carries
// that information — this is the same fact, named the way an owner reads it.
const BUCKETS: { key: keyof Aging['totals']; label: string; status: string; fg: string; bg: string }[] = [
  { key: 'current', label: 'Not yet due', status: 'Current', fg: 'var(--success)', bg: 'var(--success-bg)' },
  { key: 'd1_30', label: '1–30 days', status: 'Due Soon', fg: 'var(--gold-ink)', bg: 'var(--gold-bg)' },
  { key: 'd31_60', label: '31–60 days', status: 'Overdue', fg: 'var(--danger)', bg: 'var(--danger-bg)' },
  { key: 'd61_90', label: '61–90 days', status: 'Overdue', fg: 'var(--danger)', bg: 'var(--danger-bg)' },
  { key: 'd90_plus', label: '90+ days', status: 'Overdue', fg: 'var(--danger)', bg: 'var(--danger-bg)' },
];

export function ReceivablesPanel() {
  return (
    <OutstandingPanel
      endpoint="/accounting/ar-aging" queryKey="acct-ar"
      title="Receivables" partyLabel="Customer"
      blurb="Money expected from customers, insurers and organisations — open invoices, aged from their due date."
      icon={<HandCoins size={17} />}
      emptyText="Nothing outstanding. Every invoice raised has been paid."
    />
  );
}

export function PayablesPanel() {
  return (
    <OutstandingPanel
      endpoint="/accounting/ap-aging" queryKey="acct-ap"
      title="Payables" partyLabel="Payee"
      blurb="Money the organisation owes — vendor bills, payouts and expenses awaiting payment."
      icon={<ReceiptText size={17} />}
      emptyText="Nothing owed. Every bill entered has been settled."
    />
  );
}

function OutstandingPanel({ endpoint, queryKey, title, partyLabel, blurb, icon, emptyText }: {
  endpoint: string; queryKey: string; title: string; partyLabel: string;
  blurb: string; icon: React.ReactNode; emptyText: string;
}) {
  const [expanded, setExpanded] = useState<string | null>(null);
  const { data, isLoading } = useQuery({
    queryKey: [queryKey],
    queryFn: async () => (await api.get<Aging>(endpoint)).data,
  });

  const rows = data?.rows ?? [];
  const totals = data?.totals;
  const overdue = totals ? totals.d1_30 + totals.d31_60 + totals.d61_90 + totals.d90_plus : 0;

  return (
    <div>
      <div style={{ marginBottom: 14 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 16, fontWeight: 700 }}>{icon} {title}</div>
        <p style={{ fontSize: 13, color: 'var(--ink-3)', margin: '5px 0 0' }}>{blurb}</p>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: 10, marginBottom: 14 }}>
        <Tile label="Total outstanding" value={money(totals?.total ?? 0)} accent="var(--navy)" />
        <Tile label="Not yet due" value={money(totals?.current ?? 0)} accent="var(--success)" />
        <Tile label="Past due" value={money(overdue)} accent="var(--danger)" />
        <Tile label="90+ days" value={money(totals?.d90_plus ?? 0)} accent="var(--danger)" />
      </div>

      <div style={{ ...card, overflow: 'hidden' }}>
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: 700 }}>
            <thead>
              <tr>
                <th style={th}>{partyLabel}</th>
                {BUCKETS.map((b) => <th key={b.key} style={{ ...th, textAlign: 'right' }}>{b.label}</th>)}
                <th style={{ ...th, textAlign: 'right' }}>Total</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => {
                const open = expanded === r.party;
                // The worst-aged bucket carrying money decides the row's status.
                const worst = [...BUCKETS].reverse().find((b) => (r as any)[b.key] > 0);
                return (
                  <>
                    <tr key={r.party} onClick={() => setExpanded(open ? null : r.party)} style={{ cursor: 'pointer' }}>
                      <td style={td}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
                          {open ? <ChevronUp size={14} style={{ color: 'var(--ink-3)' }} /> : <ChevronDown size={14} style={{ color: 'var(--ink-3)' }} />}
                          <span style={{ fontWeight: 600 }}>{r.party}</span>
                          {worst && <span className="badge" style={{ background: worst.bg, color: worst.fg }}>{worst.status}</span>}
                        </div>
                      </td>
                      {BUCKETS.map((b) => (
                        <td key={b.key} style={{ ...num, color: (r as any)[b.key] ? (b.key === 'current' ? 'var(--ink-1)' : b.fg) : 'var(--ink-3)' }}>
                          {(r as any)[b.key] ? money((r as any)[b.key]) : '—'}
                        </td>
                      ))}
                      <td style={{ ...num, fontWeight: 700 }}>{money(r.total)}</td>
                    </tr>
                    {open && (
                      <tr key={`${r.party}-detail`}>
                        <td style={{ ...td, background: 'var(--surface-2)' }} colSpan={BUCKETS.length + 2}>
                          <div style={{ fontSize: 12.5, color: 'var(--ink-2)' }}>
                            {BUCKETS.filter((b) => (r as any)[b.key] > 0).map((b) => (
                              <div key={b.key} style={{ display: 'flex', justifyContent: 'space-between', padding: '3px 0', maxWidth: 420 }}>
                                <span>{b.label} · {b.status}</span>
                                <span style={{ fontWeight: 700, fontVariantNumeric: 'tabular-nums' }}>{money((r as any)[b.key])}</span>
                              </div>
                            ))}
                          </div>
                        </td>
                      </tr>
                    )}
                  </>
                );
              })}
            </tbody>
            {rows.length > 0 && totals && (
              <tfoot>
                <tr>
                  <td style={{ ...td, fontWeight: 700 }}>Total</td>
                  {BUCKETS.map((b) => <td key={b.key} style={{ ...num, fontWeight: 700 }}>{money(totals[b.key])}</td>)}
                  <td style={{ ...num, fontWeight: 800 }}>{money(totals.total)}</td>
                </tr>
              </tfoot>
            )}
          </table>
        </div>
        {isLoading && <div style={{ padding: 34, textAlign: 'center', color: 'var(--ink-3)', fontSize: 13.5 }}>Loading…</div>}
        {!isLoading && rows.length === 0 && <div style={{ padding: 40, textAlign: 'center', color: 'var(--ink-3)', fontSize: 13.5 }}>{emptyText}</div>}
      </div>
    </div>
  );
}

function Tile({ label, value, accent }: { label: string; value: string; accent?: string }) {
  return (
    <div style={{ ...card, padding: 13 }}>
      <div style={{ fontSize: 11.5, color: 'var(--ink-3)', fontWeight: 600 }}>{label}</div>
      <div style={{ fontSize: 20, fontWeight: 800, marginTop: 5, color: accent, fontVariantNumeric: 'tabular-nums' }}>{value}</div>
    </div>
  );
}
