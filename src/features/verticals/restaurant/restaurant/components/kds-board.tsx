'use client';

/**
 * The ticket grid both KDS boards render.
 *
 * It knows nothing about either status vocabulary — the caller supplies the one
 * action a ticket can take next, so the in-house board and the aggregator board
 * share a layout without sharing a state machine.
 *
 * Two source quirks are load-bearing here and are rendered, not smoothed over:
 *
 *  · A line whose SOURCE quantity was negative is a CANCELLATION INSTRUCTION,
 *    not a negative amount of food. The API sends `abs(quantity)` with
 *    `status: 'cancelled'`, and it is struck through — a cook who reads it as
 *    "make -1 steak" is the failure this prevents.
 *  · `is_new` marks a line added on a FOLLOW-UP docket, never the opening one.
 *    It is the "this arrived after you started" flag, so it is badged.
 */

import React from 'react';
import { Clock, StickyNote } from 'lucide-react';
import { kdsStatus } from '../ui/kds';
import type { KdsTicket } from '../ui/kds';

export function KdsBoard({
  tickets, nextFor, busyId, extraActions,
}: {
  tickets: KdsTicket[];
  nextFor: (t: KdsTicket) => { label: string; run: () => void } | null;
  busyId?: string;
  /** The aggregator board adds Dispatch alongside the normal step. */
  extraActions?: (t: KdsTicket) => React.ReactNode;
}) {
  return (
    <div className="rst-kds-grid">
      {tickets.map((t) => {
        const s = kdsStatus(t.status);
        const next = nextFor(t);
        const busy = busyId === t.id;
        return (
          <article key={t.id} className="rst-ticket">
            <header className="rst-ticket-head" style={{ background: s.bg }}>
              <div className="rst-ticket-id">
                <strong>{t.number ?? t.id.slice(0, 8)}</strong>
                {t.time && <span><Clock size={12} aria-hidden /> {t.time}</span>}
              </div>
              <span className="rst-ticket-status" style={{ color: s.fg }}>{s.label}</span>
            </header>

            <div className="rst-ticket-where">
              <span>{t.table ? `Table ${t.table}` : (t.type ?? 'Order')}</span>
              {t.table && t.type && <span className="ds-caption">{t.type}</span>}
            </div>

            <ul className="rst-ticket-items">
              {t.items.map((i) => (
                <li key={i.id} className={i.status === 'cancelled' ? 'is-cancelled' : undefined}>
                  <span className="rst-qty">x{i.quantity}</span>
                  <span className="rst-item-name">
                    {i.name}
                    {i.is_new && <em className="rst-new">new</em>}
                  </span>
                  {i.note && (
                    <span className="rst-item-note" title={i.note}>
                      <StickyNote size={11} aria-hidden /> {i.note}
                    </span>
                  )}
                </li>
              ))}
              {t.items.length === 0 && <li className="ds-caption">No lines on this ticket.</li>}
            </ul>

            {t.notes && <p className="rst-ticket-note">{t.notes}</p>}

            <footer className="rst-ticket-foot">
              {extraActions?.(t)}
              {next ? (
                <button className="btn-primary btn-sm" disabled={busy} onClick={next.run}>
                  {busy ? 'Saving…' : next.label}
                </button>
              ) : (
                <span className="ds-caption">No further step here</span>
              )}
            </footer>
          </article>
        );
      })}
    </div>
  );
}
