'use client';

import { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { Plus, X } from 'lucide-react';
import { api, apiErrorMessage } from '@/lib/api';
import { useAuth } from '@/features/foundation/auth';
import { card, Due, Empty, Loading, Pill, PriorityPill, Row, SectionTitle } from './shared';
import {
  CsAction, CsDecision, CsIssue, CsIssueCategory, CsIssueStatus, CsPriority, humanEnum, ISSUE_FLOW,
} from '../workspace-client';

const CATEGORIES: CsIssueCategory[] = [
  'STRATEGY', 'FINANCE', 'OPERATIONS', 'PEOPLE', 'SALES', 'MARKETING',
  'TECHNOLOGY', 'COMPLIANCE', 'SUPPLY_CHAIN', 'CUSTOMER', 'GOVERNANCE', 'OTHER',
];
const PRIORITIES: CsPriority[] = ['LOW', 'MEDIUM', 'HIGH', 'CRITICAL'];

/** Statuses that mean the issue is still live work. */
const OPEN: CsIssueStatus[] = ['IDENTIFIED', 'STUDYING', 'ANALYSIS', 'DECISION_REQUIRED', 'ACTION_PLANNED', 'IN_PROGRESS'];

/**
 * Issues, the decisions taken on them, and the actions those produced.
 *
 * One tab, because they are one workflow: an issue that reaches "decision
 * required" is waiting for a row in the middle column, and an approved decision
 * is what moves it on. Splitting them into three screens is how a consultant
 * ends up with issues nobody decided and decisions nobody did.
 */
export function WorkspaceLoop({ companyId, issues, decisions, actions, loading }: {
  companyId: string;
  issues: CsIssue[];
  decisions: CsDecision[];
  actions: CsAction[];
  loading: boolean;
}) {
  const qc = useQueryClient();
  const { hasPermission } = useAuth();
  const canManage = hasPermission('consulting.issue.manage');
  const canDecide = hasPermission('consulting.decision.approve');
  const [compose, setCompose] = useState(false);
  const [showClosed, setShowClosed] = useState(false);

  const refresh = () => {
    qc.invalidateQueries({ queryKey: ['cs-issues', companyId] });
    qc.invalidateQueries({ queryKey: ['cs-decisions', companyId] });
    qc.invalidateQueries({ queryKey: ['cs-actions', companyId] });
    qc.invalidateQueries({ queryKey: ['cs-strategy-dashboard', companyId] });
  };

  const createIssue = useMutation({
    mutationFn: (body: Record<string, unknown>) => api.post('/consulting/issues', { companyId, ...body }),
    onSuccess: () => { toast.success('Issue raised'); setCompose(false); refresh(); },
    onError: (e) => toast.error(apiErrorMessage(e)),
  });

  /**
   * Moving an issue along. The API refuses the shortcuts — no RESOLVED without
   * saying what was done, no CLOSED with action items still open — and the
   * message it returns is shown as-is, because it explains the rule better than
   * a generic "could not update" would.
   */
  const move = useMutation({
    mutationFn: ({ id, status, note }: { id: string; status: CsIssueStatus; note?: string }) =>
      api.patch(`/consulting/issues/${id}/status`, { status, ...(note ? { note } : {}) }),
    onSuccess: () => { toast.success('Issue moved'); refresh(); },
    onError: (e) => toast.error(apiErrorMessage(e)),
  });

  const decide = useMutation({
    mutationFn: ({ id, status }: { id: string; status: 'APPROVED' | 'REJECTED' | 'DEFERRED' }) =>
      api.patch(`/consulting/decisions/${id}/status`, { status }),
    onSuccess: () => { toast.success('Decision recorded'); refresh(); },
    onError: (e) => toast.error(apiErrorMessage(e)),
  });

  if (loading) return <Loading label="Reading the issues" />;

  const live = issues.filter((i) => OPEN.includes(i.status));
  const settled = issues.filter((i) => !OPEN.includes(i.status));
  const shown = showClosed ? settled : live;
  const pending = decisions.filter((d) => d.status === 'PROPOSED' || d.status === 'DEFERRED');
  const openActions = actions.filter((a) => a.status === 'OPEN' || a.status === 'IN_PROGRESS');

  return (
    <div>
      <SectionTitle
        right={
          <div style={{ display: 'flex', gap: 8 }}>
            <button className="btn-ghost" onClick={() => setShowClosed((v) => !v)}>
              {showClosed ? `Open (${live.length})` : `Settled (${settled.length})`}
            </button>
            {canManage ? <button className="btn-primary" onClick={() => setCompose(true)}><Plus size={14} /> Raise issue</button> : null}
          </div>
        }
      >
        {showClosed ? 'Settled issues' : 'Open issues'}
      </SectionTitle>

      {shown.length === 0 ? (
        <Empty
          title={showClosed ? 'Nothing settled yet' : 'No open issues'}
          hint={showClosed ? undefined : 'An issue is anything wrong or worth pursuing in the client’s business.'}
          action={canManage && !showClosed ? <button className="btn-primary" onClick={() => setCompose(true)}><Plus size={14} /> Raise the first</button> : undefined}
        />
      ) : (
        <div style={{ ...card, overflow: 'hidden', marginBottom: 20 }}>
          {shown.map((i) => (
            <Row key={i.id}>
              <span style={{ fontSize: 11, color: 'var(--ink-3)', width: 62 }}>{i.ref}</span>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 13, fontWeight: 600 }}>{i.title}</div>
                <div style={{ fontSize: 11, color: 'var(--ink-2)' }}>
                  {humanEnum(i.category)} · from {humanEnum(i.source).toLowerCase()}
                  {i._count ? ` · ${i._count.decisions} decision(s), ${i._count.actions} action(s)` : ''}
                </div>
              </div>
              <PriorityPill p={i.priority} />
              <Due date={i.dueDate} />
              {canManage ? (
                <select
                  className="input"
                  style={{ width: 168, fontSize: 12 }}
                  value={i.status}
                  onChange={(e) => {
                    const status = e.target.value as CsIssueStatus;
                    // The two transitions the API demands evidence for are asked
                    // for here rather than failing with a 400 the user has to
                    // decode.
                    const needsNote = status === 'RESOLVED' || status === 'EVALUATED';
                    if (!needsNote) { move.mutate({ id: i.id, status }); return; }
                    const note = (window.prompt(
                      status === 'RESOLVED' ? 'What was done to resolve it?' : 'Did it work? What was it worth?',
                    ) ?? '').trim();
                    // Cancelling the prompt leaves the issue where it is rather
                    // than sending a transition the API will refuse.
                    if (!note) return;
                    move.mutate({ id: i.id, status, note });
                  }}
                >
                  {ISSUE_FLOW.map((s) => <option key={s} value={s}>{humanEnum(s)}</option>)}
                </select>
              ) : (
                <Pill>{humanEnum(i.status)}</Pill>
              )}
            </Row>
          ))}
        </div>
      )}

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(320px,1fr))', gap: 16, alignItems: 'start' }}>
        <section>
          <SectionTitle>Decisions waiting</SectionTitle>
          {pending.length === 0 ? (
            <Empty title="Nothing waiting on a decision" />
          ) : (
            <div style={{ ...card, overflow: 'hidden' }}>
              {pending.map((d) => (
                <Row key={d.id}>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 13, fontWeight: 600 }}>{d.title}</div>
                    <div style={{ fontSize: 11, color: 'var(--ink-2)' }}>
                      {d.issue ? `${d.issue.ref} · ` : ''}{d.decision.slice(0, 90)}
                    </div>
                  </div>
                  {canDecide ? (
                    <div style={{ display: 'flex', gap: 6 }}>
                      <button className="btn-ghost" style={{ fontSize: 12 }} onClick={() => decide.mutate({ id: d.id, status: 'DEFERRED' })}>Defer</button>
                      <button className="btn-ghost" style={{ fontSize: 12 }} onClick={() => decide.mutate({ id: d.id, status: 'REJECTED' })}>Reject</button>
                      <button className="btn-primary" style={{ fontSize: 12 }} onClick={() => decide.mutate({ id: d.id, status: 'APPROVED' })}>Approve</button>
                    </div>
                  ) : <Pill>{humanEnum(d.status)}</Pill>}
                </Row>
              ))}
            </div>
          )}
        </section>

        <section>
          <SectionTitle>Action items</SectionTitle>
          {openActions.length === 0 ? (
            <Empty title="No open actions" hint="Close a meeting with action items and they appear here." />
          ) : (
            <div style={{ ...card, overflow: 'hidden' }}>
              {openActions.map((a) => (
                <Row key={a.id}>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 13, fontWeight: 600 }}>{a.title}</div>
                    <div style={{ fontSize: 11, color: 'var(--ink-2)' }}>
                      {a.meeting ? `${a.meeting.ref} · ` : ''}{humanEnum(a.status)}
                      {a.task ? ` · tracked as ${a.task.ref}` : ''}
                    </div>
                  </div>
                  <Due date={a.dueDate} />
                </Row>
              ))}
            </div>
          )}
        </section>
      </div>

      {compose ? (
        <ComposeIssue
          busy={createIssue.isPending}
          onClose={() => setCompose(false)}
          onSubmit={(body) => createIssue.mutate(body)}
        />
      ) : null}
    </div>
  );
}

function ComposeIssue({ onClose, onSubmit, busy }: {
  onClose: () => void;
  onSubmit: (body: Record<string, unknown>) => void;
  busy: boolean;
}) {
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [category, setCategory] = useState<CsIssueCategory>('OPERATIONS');
  const [priority, setPriority] = useState<CsPriority>('MEDIUM');
  const [dueDate, setDueDate] = useState('');

  return (
    <div onClick={onClose} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,.35)', display: 'grid', placeItems: 'center', zIndex: 60, padding: 16 }}>
      <div onClick={(e) => e.stopPropagation()} style={{ ...card, width: 'min(560px,100%)', padding: 20 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
          <h2 style={{ fontSize: 17, fontWeight: 700, margin: 0 }}>Raise an issue</h2>
          <button className="btn-ghost" onClick={onClose}><X size={16} /></button>
        </div>

        <label style={{ fontSize: 12, color: 'var(--ink-2)' }}>What is wrong?</label>
        <input className="input" style={{ width: '100%', marginBottom: 10 }} value={title} onChange={(e) => setTitle(e.target.value)} autoFocus />

        <label style={{ fontSize: 12, color: 'var(--ink-2)' }}>What do you know so far?</label>
        <textarea className="input" style={{ width: '100%', marginBottom: 10, minHeight: 80 }} value={description} onChange={(e) => setDescription(e.target.value)} />

        <div style={{ display: 'flex', gap: 10, marginBottom: 16 }}>
          <div style={{ flex: 1 }}>
            <label style={{ fontSize: 12, color: 'var(--ink-2)' }}>Category</label>
            <select className="input" style={{ width: '100%' }} value={category} onChange={(e) => setCategory(e.target.value as CsIssueCategory)}>
              {CATEGORIES.map((c) => <option key={c} value={c}>{humanEnum(c)}</option>)}
            </select>
          </div>
          <div style={{ flex: 1 }}>
            <label style={{ fontSize: 12, color: 'var(--ink-2)' }}>Priority</label>
            <select className="input" style={{ width: '100%' }} value={priority} onChange={(e) => setPriority(e.target.value as CsPriority)}>
              {PRIORITIES.map((p) => <option key={p} value={p}>{humanEnum(p)}</option>)}
            </select>
          </div>
          <div style={{ flex: 1 }}>
            <label style={{ fontSize: 12, color: 'var(--ink-2)' }}>Due</label>
            <input type="date" className="input" style={{ width: '100%' }} value={dueDate} onChange={(e) => setDueDate(e.target.value)} />
          </div>
        </div>

        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
          <button className="btn-ghost" onClick={onClose}>Cancel</button>
          <button
            className="btn-primary"
            disabled={!title.trim() || busy}
            onClick={() => onSubmit({
              title: title.trim(),
              ...(description.trim() ? { description: description.trim() } : {}),
              category,
              priority,
              source: 'CONSULTANT_OBSERVATION',
              ...(dueDate ? { dueDate: new Date(dueDate).toISOString() } : {}),
            })}
          >
            {busy ? 'Raising…' : 'Raise issue'}
          </button>
        </div>
      </div>
    </div>
  );
}
