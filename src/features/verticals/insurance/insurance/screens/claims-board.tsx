'use client';

/**
 * Claims board — the stage machine as a working surface.
 *
 * A claim is a file that has to keep moving; a card grid says what exists but
 * not what is stuck. The board answers the only two questions a claims desk
 * asks all day: what is at each stage, and what has blown its SLA.
 *
 * Endpoints (the claims stage machine):
 *   GET  /insurance/claims/board          -> { stages: [{ stage, label, slaDays, count, claims }], breached }
 *   POST /insurance/claims/:id/stage      { stage }
 *
 * Moving a card is a drag OR the "Move to" menu on every card. Drag alone is
 * inaccessible and unusable on touch, so the menu is the real control and the
 * drag is the shortcut.
 */

import { useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { AlertTriangle, FileText, LayoutGrid, ShieldCheck } from 'lucide-react';
import { api, apiErrorMessage } from '@/lib/api';
import { fmtOrgMoney } from '@/lib/org-locale';
import { Card, EmptyState, Skeleton, Toolbar, type Tone } from '../ui/kit';

// ============================================================ the stage machine

export type StageMeta = { key: string; label: string; slaDays: number | null; tone: Tone };

/** Ordered exactly as the machine runs; CLOSED and REJECTED are terminal and sit last. */
export const CLAIM_STAGES: StageMeta[] = [
  { key: 'REGISTERED', label: 'Registered', slaDays: 1, tone: 'info' },
  { key: 'DOC_COLLECTION', label: 'Document collection', slaDays: 5, tone: 'renewal' },
  { key: 'DOCS_VERIFIED', label: 'Documents verified', slaDays: 2, tone: 'sales' },
  { key: 'SURVEY_SCHEDULED', label: 'Survey scheduled', slaDays: 3, tone: 'claim' },
  { key: 'SURVEY_COMPLETED', label: 'Survey completed', slaDays: 2, tone: 'claim' },
  { key: 'INSURER_REVIEW', label: 'Insurer review', slaDays: 7, tone: 'sales' },
  { key: 'ADDITIONAL_DOCS', label: 'Additional documents', slaDays: 5, tone: 'renewal' },
  { key: 'APPROVED', label: 'Approved', slaDays: 3, tone: 'active' },
  { key: 'SETTLEMENT', label: 'Settlement', slaDays: 7, tone: 'active' },
  { key: 'CLOSED', label: 'Closed', slaDays: null, tone: 'neutral' },
  { key: 'REJECTED', label: 'Rejected', slaDays: null, tone: 'expired' },
];

export const stageMeta = (key?: string | null): StageMeta =>
  CLAIM_STAGES.find((s) => s.key === (key ?? '').toUpperCase())
  ?? { key: (key ?? '').toUpperCase(), label: key ? key.charAt(0) + key.slice(1).toLowerCase().replace(/_/g, ' ') : 'Unknown', slaDays: null, tone: 'neutral' };

export const TERMINAL_STAGES = ['CLOSED', 'REJECTED'];

const stageOrder = (key: string) => {
  const i = CLAIM_STAGES.findIndex((s) => s.key === key.toUpperCase());
  return i === -1 ? CLAIM_STAGES.length : i;
};

// ============================================================ types

type BoardClaim = {
  id: string;
  claimNo: string;
  clientName?: string | null;
  policyNo?: string | null;
  productName?: string | null;
  stage: string;
  stageDueAt?: string | null;
  slaBreached?: boolean;
  ownerName?: string | null;
  docsIn?: number;
  docsTotal?: number;
  incidentDate?: string | null;
  settledInr?: number | null;
};

type BoardColumn = {
  stage: string;
  label?: string;
  slaDays?: number | null;
  count?: number;
  claims?: BoardClaim[];
};

type BoardData = { stages?: BoardColumn[]; breached?: number };

// ============================================================ SLA

const DAY = 86400000;

/** Whole days between today and a due date, floor'd to calendar days. */
function daysTo(due?: string | null): number | null {
  if (!due) return null;
  const d = new Date(due);
  if (Number.isNaN(+d)) return null;
  const today = new Date();
  const a = Date.UTC(d.getFullYear(), d.getMonth(), d.getDate());
  const b = Date.UTC(today.getFullYear(), today.getMonth(), today.getDate());
  return Math.round((a - b) / DAY);
}

/** "2 days left" / "overdue 3 days" — the sentence a claims handler would say. */
export function slaText(dueAt?: string | null, breached?: boolean): { text: string; tone: Tone } | null {
  const days = daysTo(dueAt);
  if (days == null) return breached ? { text: 'SLA breached', tone: 'expired' } : null;
  if (breached || days < 0) {
    const over = Math.max(1, Math.abs(days));
    return { text: `overdue ${over} day${over === 1 ? '' : 's'}`, tone: 'expired' };
  }
  if (days === 0) return { text: 'due today', tone: 'renewal' };
  return { text: `${days} day${days === 1 ? '' : 's'} left`, tone: days <= 2 ? 'renewal' : 'neutral' };
}

// ============================================================ move menu

/** Keyboard and touch path for moving a card — drag alone is not an interface. */
function MoveMenu({ current, onMove, busy }: { current: string; onMove: (stage: string) => void; busy: boolean }) {
  const [open, setOpen] = useState(false);
  const wrap = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onDoc = (e: MouseEvent) => { if (!wrap.current?.contains(e.target as Node)) setOpen(false); };
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setOpen(false); };
    document.addEventListener('mousedown', onDoc);
    document.addEventListener('keydown', onKey);
    return () => { document.removeEventListener('mousedown', onDoc); document.removeEventListener('keydown', onKey); };
  }, [open]);

  return (
    <div ref={wrap} style={{ position: 'relative' }}>
      <button
        className="btn-ghost btn-sm"
        aria-haspopup="menu"
        aria-expanded={open}
        disabled={busy}
        onClick={() => setOpen((o) => !o)}
      >
        Move to
      </button>
      {open && (
        <div
          role="menu"
          className="ds-panel"
          style={{
            position: 'absolute', right: 0, top: 'calc(100% + 4px)', zIndex: 20,
            padding: 'var(--s-1)', minWidth: 210, maxHeight: 300, overflowY: 'auto',
          }}
        >
          {CLAIM_STAGES.filter((s) => s.key !== current.toUpperCase()).map((s) => (
            <button
              key={s.key}
              role="menuitem"
              className="btn-ghost btn-sm"
              style={{ width: '100%', justifyContent: 'flex-start' }}
              onClick={() => { setOpen(false); onMove(s.key); }}
            >
              <span className={`ds-dot ds-fg-${s.tone}`} /> {s.label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

// ============================================================ card

function BoardCard({
  claim, busy, dragging, onDragStart, onDragEnd, onMove,
}: {
  claim: BoardClaim; busy: boolean; dragging: boolean;
  onDragStart: () => void; onDragEnd: () => void; onMove: (stage: string) => void;
}) {
  const sla = slaText(claim.stageDueAt, claim.slaBreached);
  const total = claim.docsTotal ?? 0;
  const done = claim.docsIn ?? 0;
  const docsTone: Tone = total > 0 && done >= total ? 'active' : 'neutral';

  return (
    // Native HTML5 drag needs the props on the element itself, so this card is
    // the ds-card class rather than the kit <Card>.
    <div
      className="ds-card"
      draggable
      onDragStart={(e) => {
        e.dataTransfer.effectAllowed = 'move';
        e.dataTransfer.setData('text/plain', claim.id);
        onDragStart();
      }}
      onDragEnd={onDragEnd}
      style={{ padding: 'var(--s-3)', cursor: 'grab', opacity: dragging ? 0.45 : 1 }}
    >
      <Link
        href={`/insurance/claims/${claim.id}`}
        draggable={false}
        className="ds-h3 ds-num"
        style={{ display: 'block', color: 'var(--ink)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}
      >
        {claim.claimNo}
      </Link>
      <div
        className="ds-small"
        style={{ marginTop: 2, color: 'var(--ink)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}
      >
        {claim.clientName ?? 'Client'}
      </div>
      <div
        className="ds-caption"
        style={{ marginTop: 2, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}
      >
        {[claim.productName, claim.policyNo].filter(Boolean).join(' · ') || '—'}
      </div>

      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 'var(--s-2)', marginTop: 'var(--s-3)' }}>
        {sla && <span className={`ds-badge ds-tone-${sla.tone}`}>{sla.text}</span>}
        {total > 0 && (
          <span className={`ds-badge ds-tone-${docsTone}`} title={`${done} of ${total} documents in`}>
            <FileText size={11} /> {done}/{total}
          </span>
        )}
        {claim.settledInr != null && (
          <span className="ds-badge ds-tone-active ds-num">{fmtOrgMoney(claim.settledInr)}</span>
        )}
      </div>

      <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--s-2)', marginTop: 'var(--s-3)' }}>
        <span className="ds-caption" style={{ minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          {claim.ownerName ?? 'Unassigned'}
        </span>
        <span style={{ marginLeft: 'auto', flex: 'none' }}>
          <MoveMenu current={claim.stage} onMove={onMove} busy={busy} />
        </span>
      </div>
    </div>
  );
}

// ============================================================ screen

export function InsuranceClaimsBoard() {
  const qc = useQueryClient();
  const [dragId, setDragId] = useState<string | null>(null);
  const [overStage, setOverStage] = useState<string | null>(null);
  const [onlyBreached, setOnlyBreached] = useState(false);

  const { data, isLoading, isError } = useQuery({
    queryKey: ['ins-claims-board'],
    // The stage machine is a newer endpoint than the claims list; if it is not
    // there yet the board says so rather than throwing the screen away.
    retry: false,
    queryFn: async () => (await api.get<BoardData>('/insurance/claims/board')).data,
  });

  const move = useMutation({
    mutationFn: (v: { id: string; stage: string }) =>
      api.post(`/insurance/claims/${v.id}/stage`, { stage: v.stage }),
    onMutate: async (v) => {
      await qc.cancelQueries({ queryKey: ['ins-claims-board'] });
      const prev = qc.getQueryData<BoardData>(['ins-claims-board']);
      if (prev?.stages) {
        let moved: BoardClaim | undefined;
        const stripped = prev.stages.map((col) => {
          const found = (col.claims ?? []).find((c) => c.id === v.id);
          if (found) moved = found;
          const claims = (col.claims ?? []).filter((c) => c.id !== v.id);
          return { ...col, claims, count: claims.length };
        });
        if (moved) {
          const placed = stripped.map((col) => (
            col.stage.toUpperCase() === v.stage
              ? { ...col, claims: [{ ...moved!, stage: v.stage }, ...(col.claims ?? [])], count: (col.claims?.length ?? 0) + 1 }
              : col
          ));
          qc.setQueryData<BoardData>(['ins-claims-board'], { ...prev, stages: placed });
        }
      }
      return { prev };
    },
    onError: (e, _v, ctx) => {
      if (ctx?.prev) qc.setQueryData(['ins-claims-board'], ctx.prev);
      toast.error(apiErrorMessage(e));
    },
    onSuccess: (_r, v) => toast.success(`Moved to ${stageMeta(v.stage).label}`),
    onSettled: (_r, _e, v) => {
      qc.invalidateQueries({ queryKey: ['ins-claims-board'] });
      qc.invalidateQueries({ queryKey: ['ins-claims'] });
      qc.invalidateQueries({ queryKey: ['ins-claim', v.id] });
    },
  });

  /** Server order is trusted for content, machine order for layout. */
  const columns = useMemo(() => {
    const server = data?.stages ?? [];
    const byKey = new Map(server.map((c) => [c.stage.toUpperCase(), c]));
    const known = CLAIM_STAGES.map((meta) => {
      const col = byKey.get(meta.key);
      return {
        meta,
        label: col?.label ?? meta.label,
        slaDays: col?.slaDays ?? meta.slaDays,
        claims: col?.claims ?? [],
      };
    });
    // Anything the server knows about and the front end does not still gets a column.
    const extra = server
      .filter((c) => !CLAIM_STAGES.some((s) => s.key === c.stage.toUpperCase()))
      .map((c) => ({ meta: stageMeta(c.stage), label: c.label ?? stageMeta(c.stage).label, slaDays: c.slaDays ?? null, claims: c.claims ?? [] }));
    return [...known, ...extra].sort((a, b) => stageOrder(a.meta.key) - stageOrder(b.meta.key));
  }, [data]);

  const allClaims = useMemo(() => columns.flatMap((c) => c.claims), [columns]);
  const openCount = useMemo(
    () => columns.filter((c) => !TERMINAL_STAGES.includes(c.meta.key)).reduce((n, c) => n + c.claims.length, 0),
    [columns],
  );
  const breachedCount = data?.breached ?? allClaims.filter((c) => c.slaBreached).length;

  const drop = (stage: string, transferred?: string) => {
    setOverStage(null);
    const id = dragId ?? (transferred || null);
    setDragId(null);
    if (!id) return;
    const current = allClaims.find((c) => c.id === id);
    if (!current || current.stage.toUpperCase() === stage) return;
    move.mutate({ id, stage });
  };

  if (isLoading) {
    return (
      <div className="ds-stack">
        <Skeleton rows={1} height={76} />
        <Skeleton rows={1} height={320} />
      </div>
    );
  }

  if (isError) {
    return (
      <Card>
        <EmptyState
          icon={LayoutGrid}
          title="The stage board is not available yet"
          body="This console could not reach the claims stage machine. The List view has every claim in the book in the meantime."
        />
      </Card>
    );
  }

  if (allClaims.length === 0) {
    return (
      <Card>
        <EmptyState
          icon={ShieldCheck}
          title="No claims on the board"
          body="Register a claim and it starts at Registered, then moves along the stages as the file progresses."
        />
      </Card>
    );
  }

  return (
    <div className="ds-stack">
      {/* ------------------------------------------------------ top strip */}
      <Toolbar>
        <div style={{ marginRight: 'auto' }}>
          <h2 className="ds-h2">Claims board</h2>
          <div className="ds-caption" style={{ marginTop: 2 }}>
            Drag a card, or use “Move to” — both write the stage back with its SLA clock.
          </div>
        </div>
        <span className="ds-badge ds-tone-info ds-num">{openCount} open</span>
        <button
          className={`ds-badge ds-tone-${breachedCount > 0 ? 'expired' : 'neutral'}`}
          aria-pressed={onlyBreached}
          onClick={() => setOnlyBreached((v) => !v)}
          style={{
            font: 'inherit', fontSize: 'var(--t-caption)', fontWeight: 620,
            cursor: 'pointer', gap: 5,
            outline: onlyBreached ? '2px solid var(--tone-expired)' : 'none',
            outlineOffset: 2,
          }}
        >
          <AlertTriangle size={11} />
          <span className="ds-num">{breachedCount}</span> SLA breached
        </button>
      </Toolbar>

      {onlyBreached && (
        <div className="ds-caption">
          Showing only claims past their stage SLA. <button className="btn-ghost btn-sm" onClick={() => setOnlyBreached(false)}>Show everything</button>
        </div>
      )}

      {/* ---------------------------------------------------------- board */}
      <div className="ds-scroll-x">
        <div style={{ display: 'flex', gap: 'var(--s-3)', alignItems: 'flex-start', minWidth: 'min-content' }}>
          {columns.map((col) => {
            const rows = onlyBreached ? col.claims.filter((c) => c.slaBreached) : col.claims;
            const isOver = overStage === col.meta.key;
            return (
              <section
                key={col.meta.key}
                aria-label={`${col.label} — ${rows.length} claims`}
                onDragOver={(e) => { e.preventDefault(); setOverStage(col.meta.key); }}
                onDragLeave={() => setOverStage((v) => (v === col.meta.key ? null : v))}
                onDrop={(e) => { e.preventDefault(); drop(col.meta.key, e.dataTransfer.getData('text/plain')); }}
                className="ds-inset"
                style={{
                  width: 268, flex: 'none', padding: 'var(--s-3)',
                  background: isOver ? 'var(--tone-info-bg)' : 'var(--surface-2)',
                  outline: isOver ? '1px dashed var(--tone-info-line)' : '1px solid transparent',
                  transition: 'background 140ms ease',
                }}
              >
                <header style={{ marginBottom: 'var(--s-3)' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--s-2)' }}>
                    <span className={`ds-dot ds-fg-${col.meta.tone}`} />
                    <span className="ds-h3" style={{ minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {col.label}
                    </span>
                    <span className="ds-count" style={{ marginLeft: 'auto', flex: 'none' }}>{rows.length}</span>
                  </div>
                  <div className="ds-caption" style={{ marginTop: 'var(--s-1)' }}>
                    {col.slaDays != null ? `${col.slaDays} day SLA` : 'No SLA — terminal stage'}
                  </div>
                </header>

                <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--s-2)' }}>
                  {rows.length === 0 ? (
                    <div className="ds-caption" style={{ padding: 'var(--s-2) 0' }}>
                      {onlyBreached ? 'Nothing breached here.' : 'Nothing at this stage.'}
                    </div>
                  ) : rows.map((c) => (
                    <BoardCard
                      key={c.id}
                      claim={c}
                      busy={move.isPending}
                      dragging={dragId === c.id}
                      onDragStart={() => setDragId(c.id)}
                      onDragEnd={() => { setDragId(null); setOverStage(null); }}
                      onMove={(stage) => move.mutate({ id: c.id, stage })}
                    />
                  ))}
                </div>
              </section>
            );
          })}
        </div>
      </div>
    </div>
  );
}
