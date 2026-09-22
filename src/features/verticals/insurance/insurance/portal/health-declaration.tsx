'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { AlertTriangle, Check, CircleCheck, FileText, Loader2, PenLine, ShieldCheck, X } from 'lucide-react';
import { toast } from 'sonner';
import { getPortalSession, portalApi } from '@/features/experiences/portal/portal-client';
import { openDocument } from '@/features/verticals/insurance/insurance/ui/open-document';
import { Badge, Card, EmptyState, Skeleton, type Tone } from '@/features/verticals/insurance/insurance/ui/kit';

/**
 * The declaration named by its own type.
 *
 * The customer may hold both kinds, and a motor form headed "Health
 * declaration" is not a cosmetic error — it tells them they are answering
 * about the wrong thing.
 */
const DECL_LABEL = (t?: string | null) => (String(t ?? '').toUpperCase() === 'MOTOR' ? 'Motor declaration' : 'Health declaration');

/**
 * The policyholder's own health declaration.
 *
 * This is the customer typing facts about their body into a phone, and the
 * record it produces decides whether a claim gets paid years later. Two things
 * follow from that and shape everything here.
 *
 * IT MUST BE EASY TO BE ACCURATE. Sixteen conditions is a long form on a 375px
 * screen, so the questions are one per card with two big targets, the detail box
 * appears only when there is something to say, and progress is saved so nobody
 * has to finish in one sitting with a policy waiting.
 *
 * AND IT MUST NOT LIE. Every rule the screen appears to enforce is enforced by
 * the API as well — no submit without the tick, none without a signature, no
 * edit after submission. The UI states them early because being told at the end
 * is worse, not because the UI is where they hold.
 *
 * Nothing here is public. It renders inside the portal the customer already
 * signs into, and every call carries their session.
 */

type Answer = {
  declared: boolean;
  sinceWhen?: string | null;
  treatment?: string | null;
  medication?: string | null;
  hospitalised?: boolean | null;
  notes?: string | null;
};

interface Question { key: string; label: string; labelMl?: string; group: string; details?: string[] }
interface DeclarationForm {
  type: string;
  version: number;
  questions: Question[];
  confirmation: { ml: string; en: string };
}
export interface Declaration {
  id: string;
  reference: string;
  /** HEALTH or MOTOR — decides which question set this is answered against. */
  type?: string;
  status: string;
  answers: Record<string, Answer>;
  signedName?: string | null;
  signedAt?: string | null;
  submittedAt?: string | null;
  version: number;
  quote?: { reference?: string | null } | null;
  policy?: { policyNo?: string | null } | null;
}

/**
 * What the customer is told the state is.
 *
 * The API's statuses describe the OFFICE's workflow — sent, in progress,
 * reviewed. A customer does not care whether the office has read it; they care
 * whether anything is being asked of them. So DRAFT and SENT both read as
 * action required, and REVIEWED reads as signed and done.
 */
export function customerStatus(s: string): { label: string; tone: Tone; actionable: boolean } {
  switch (s) {
    case 'DRAFT':
    case 'SENT': return { label: 'Action required', tone: 'renewal', actionable: true };
    case 'IN_PROGRESS': return { label: 'Draft saved', tone: 'info', actionable: true };
    case 'SUBMITTED': return { label: 'Submitted', tone: 'active', actionable: false };
    case 'REVIEWED': return { label: 'Signed', tone: 'active', actionable: false };
    default: return { label: s, tone: 'neutral', actionable: false };
  }
}

const fmtDate = (d?: string | null) =>
  d ? new Date(d).toLocaleString(undefined, { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' }) : '';

// ---------------------------------------------------------------- signature

/**
 * Draw-to-sign, on whatever the customer is holding.
 *
 * Pointer events rather than mouse or touch, so a finger, a stylus and a mouse
 * are the same code path. The canvas is sized to its box in DEVICE pixels —
 * drawn at CSS pixels a signature is a blurry smear on a phone, which is not
 * what you want to be holding up as evidence.
 */
function SignaturePad({ onChange, disabled }: { onChange: (dataUrl: string | null) => void; disabled?: boolean }) {
  const ref = useRef<HTMLCanvasElement>(null);
  const drawing = useRef(false);
  const dirty = useRef(false);

  useEffect(() => {
    const c = ref.current;
    if (!c) return;
    const dpr = window.devicePixelRatio || 1;
    const rect = c.getBoundingClientRect();
    c.width = Math.round(rect.width * dpr);
    c.height = Math.round(rect.height * dpr);
    const ctx = c.getContext('2d');
    if (!ctx) return;
    ctx.scale(dpr, dpr);
    ctx.lineWidth = 2;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.strokeStyle = '#1c1612';
  }, []);

  const pos = (e: React.PointerEvent<HTMLCanvasElement>) => {
    const r = e.currentTarget.getBoundingClientRect();
    return { x: e.clientX - r.left, y: e.clientY - r.top };
  };

  const down = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (disabled) return;
    e.currentTarget.setPointerCapture(e.pointerId);
    const ctx = ref.current?.getContext('2d');
    if (!ctx) return;
    drawing.current = true;
    const { x, y } = pos(e);
    ctx.beginPath();
    ctx.moveTo(x, y);
  };
  const move = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (!drawing.current || disabled) return;
    const ctx = ref.current?.getContext('2d');
    if (!ctx) return;
    const { x, y } = pos(e);
    ctx.lineTo(x, y);
    ctx.stroke();
    dirty.current = true;
  };
  const up = () => {
    if (!drawing.current) return;
    drawing.current = false;
    // Only report a signature once something was actually drawn — an empty
    // canvas still serialises to a perfectly valid PNG of nothing.
    onChange(dirty.current ? (ref.current?.toDataURL('image/png') ?? null) : null);
  };

  const clear = () => {
    const c = ref.current;
    const ctx = c?.getContext('2d');
    if (!c || !ctx) return;
    ctx.clearRect(0, 0, c.width, c.height);
    dirty.current = false;
    onChange(null);
  };

  return (
    <div>
      <canvas
        ref={ref}
        onPointerDown={down}
        onPointerMove={move}
        onPointerUp={up}
        onPointerLeave={up}
        aria-label="Draw your signature"
        style={{
          width: '100%', height: 160, touchAction: 'none', display: 'block',
          border: '1px dashed var(--line-soft)', borderRadius: 10, background: 'var(--surface)',
          cursor: disabled ? 'not-allowed' : 'crosshair',
        }}
      />
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginTop: 8 }}>
        <span className="ds-caption" style={{ flex: 1 }}>Draw your signature above</span>
        <button type="button" className="btn-ghost btn-sm" onClick={clear} disabled={disabled}>Clear</button>
      </div>
    </div>
  );
}

// ------------------------------------------------------------------- the form

function QuestionCard({
  q, answer, onChange, readOnly,
}: {
  q: Question; answer: Answer | undefined; onChange: (a: Answer) => void; readOnly: boolean;
}) {
  const declared = answer?.declared === true;
  const answered = answer !== undefined;
  return (
    <Card>
      <div style={{ fontWeight: 600 }}>{q.label}</div>
      {q.labelMl && <div className="ds-caption" style={{ marginTop: 2 }}>{q.labelMl}</div>}

      <div style={{ display: 'flex', gap: 10, marginTop: 12 }}>
        {[
          { yes: false, label: 'No' },
          { yes: true, label: 'Yes' },
        ].map((o) => {
          const on = answered && declared === o.yes;
          return (
            <button
              key={o.label}
              type="button"
              disabled={readOnly}
              aria-pressed={on}
              onClick={() => onChange(o.yes ? { ...(answer ?? {}), declared: true } : { declared: false })}
              style={{
                flex: 1, padding: '12px 10px', borderRadius: 10, cursor: readOnly ? 'default' : 'pointer',
                fontWeight: on ? 650 : 500,
                border: `1px solid ${on ? 'var(--accent)' : 'var(--hairline)'}`,
                background: on ? 'var(--surface-2)' : 'var(--surface)',
              }}
            >
              {o.label}
            </button>
          );
        })}
      </div>

      {/* Only when there is something to describe. A detail box under "No"
          invites an answer to a question nobody asked. */}
      {declared && (
        <div style={{ marginTop: 12, display: 'grid', gap: 8 }}>
          <div>
            <label className="label" style={{ margin: 0 }}>Since when</label>
            <input
              className="input" disabled={readOnly} placeholder="e.g. 2022"
              value={answer?.sinceWhen ?? ''}
              onChange={(e) => onChange({ ...(answer ?? { declared: true }), declared: true, sinceWhen: e.target.value })}
            />
          </div>
          <div>
            <label className="label" style={{ margin: 0 }}>Treatment or medication</label>
            <input
              className="input" disabled={readOnly} placeholder="e.g. Metformin, twice daily"
              value={answer?.treatment ?? ''}
              onChange={(e) => onChange({ ...(answer ?? { declared: true }), declared: true, treatment: e.target.value })}
            />
          </div>
          <div>
            <label className="label" style={{ margin: 0 }}>Anything else we should know</label>
            <textarea
              className="input" rows={2} disabled={readOnly}
              value={answer?.notes ?? ''}
              onChange={(e) => onChange({ ...(answer ?? { declared: true }), declared: true, notes: e.target.value })}
            />
          </div>
        </div>
      )}
    </Card>
  );
}

export function HealthDeclarationFlow({
  declaration, onClose, onSaved,
}: {
  declaration: Declaration;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [form, setForm] = useState<DeclarationForm | null>(null);
  const [answers, setAnswers] = useState<Record<string, Answer>>(declaration.answers ?? {});
  const [stage, setStage] = useState<'questions' | 'sign' | 'done'>(
    ['SUBMITTED', 'REVIEWED'].includes(declaration.status) ? 'done' : 'questions');
  const [signedName, setSignedName] = useState(declaration.signedName ?? '');
  const [signature, setSignature] = useState<string | null>(null);
  const [confirmed, setConfirmed] = useState(false);
  const [busy, setBusy] = useState(false);
  const [current, setCurrent] = useState<Declaration>(declaration);

  const readOnly = ['SUBMITTED', 'REVIEWED'].includes(current.status);

  useEffect(() => {
    portalApi<DeclarationForm>(`/portal/me/insurance/declarations/form?type=${declaration.type ?? 'HEALTH'}`)
      .then(setForm)
      .catch(() => toast.error('Could not load the declaration form'));
  }, []);

  const save = useCallback(async (quiet = false) => {
    if (readOnly) return;
    setBusy(true);
    try {
      await portalApi(`/portal/me/insurance/declarations/${current.id}`, {
        method: 'PATCH',
        body: JSON.stringify({ answers }),
      });
      if (!quiet) toast.success('Saved — you can finish this later');
      onSaved();
    } catch {
      toast.error('Could not save your answers');
    } finally {
      setBusy(false);
    }
  }, [answers, current.id, onSaved, readOnly]);

  const submit = async () => {
    // Stated here as well as enforced by the API, because being told what was
    // missing after pressing Submit is the worst moment to find out.
    if (!confirmed) return toast.error('Please tick the confirmation — it is what you are signing');
    if (!signedName.trim()) return toast.error('Please type your name');
    if (!signature) return toast.error('Please draw your signature');
    setBusy(true);
    try {
      const d = await portalApi<Declaration>(`/portal/me/insurance/declarations/${current.id}/submit`, {
        method: 'POST',
        body: JSON.stringify({ answers, signedName, signatureData: signature, confirmed: true }),
      });
      setCurrent(d);
      setStage('done');
      onSaved();
    } catch {
      toast.error('Could not submit — please check your answers and try again');
    } finally {
      setBusy(false);
    }
  };

  const unanswered = (form?.questions ?? []).filter((q) => answers[q.key] === undefined);

  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 90, background: 'var(--bg)', overflowY: 'auto' }}>
      <div style={{
        position: 'sticky', top: 0, zIndex: 2, background: 'var(--surface)',
        borderBottom: '1px solid var(--hairline)', padding: '14px 16px',
        display: 'flex', alignItems: 'center', gap: 12,
      }}>
        <ShieldCheck size={18} aria-hidden="true" />
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontWeight: 650 }}>{DECL_LABEL(current.type)}</div>
          <div className="ds-caption">{current.reference}{current.version > 1 ? ` · revision ${current.version}` : ''}</div>
        </div>
        <button className="btn-ghost btn-sm" onClick={onClose} aria-label="Close" style={{ width: 32, padding: 0 }}>
          <X size={16} />
        </button>
      </div>

      <div style={{ padding: 16, display: 'grid', gap: 12, maxWidth: 640, margin: '0 auto' }}>
        {!form && <Skeleton rows={4} height={80} />}

        {/* ---------------------------------------------------- submitted */}
        {form && stage === 'done' && (
          <>
            <Card>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <CircleCheck size={20} aria-hidden="true" style={{ color: 'var(--tone-active)' }} />
                <div style={{ fontWeight: 650 }}>Declaration submitted</div>
              </div>
              <p className="ds-caption" style={{ marginTop: 8 }}>
                Your health declaration has been recorded against your insurance and cannot be changed. If something
                here is wrong, tell your broker — they will raise a correction rather than alter what you signed.
              </p>
              <div style={{ display: 'grid', gap: 6, marginTop: 12 }}>
                <Row label="Reference" value={current.reference} />
                {current.policy?.policyNo && <Row label="Policy" value={current.policy.policyNo} />}
                {current.quote?.reference && <Row label="Quote" value={current.quote.reference} />}
                <Row label="Submitted" value={fmtDate(current.submittedAt ?? current.signedAt)} />
                <Row label="Signed by" value={current.signedName ?? ''} />
              </div>
            </Card>
            <SectionHeading>What you declared</SectionHeading>
            {form.questions.map((q) => (
              <QuestionCard key={q.key} q={q} answer={answers[q.key]} onChange={() => {}} readOnly />
            ))}
          </>
        )}

        {/* ---------------------------------------------------- questions */}
        {form && stage === 'questions' && (
          <>
            <Card>
              <p className="ds-caption" style={{ margin: 0 }}>
                Please answer every question honestly. What you declare here is what your insurer relies on — anything
                left out can cost you a claim later. You can save and come back at any time before you sign.
              </p>
              {/* The healthy customer's shortcut. Most people answer No to every
                  question, and making them tap sixteen times to say "nothing is
                  wrong with me" is friction that teaches them to stop reading.

                  It only fills questions still UNANSWERED. Overwriting a Yes
                  already given would silently erase a disclosure the customer
                  made — the one outcome this whole form exists to prevent — so a
                  declared condition is never touched, and the count says exactly
                  how many answers this will set. Every answer stays editable
                  afterwards, and the signature step is unchanged: this fills the
                  form, it does not sign it. */}
              {!readOnly && unanswered.length > 0 && (
                <div style={{ marginTop: 12, display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
                  <button
                    className="btn-secondary btn-sm"
                    disabled={busy}
                    onClick={() => setAnswers((cur) => {
                      const next = { ...cur };
                      for (const q of form.questions) {
                        if (next[q.key] === undefined) next[q.key] = { declared: false };
                      }
                      return next;
                    })}
                  >
                    I have none of these
                  </button>
                  <span className="ds-caption">
                    Answers No to the {unanswered.length} question{unanswered.length === 1 ? '' : 's'} you have not
                    answered yet. Anything you have already marked Yes stays as it is.
                  </span>
                </div>
              )}
            </Card>
            {form.questions.map((q) => (
              <QuestionCard
                key={q.key}
                q={q}
                answer={answers[q.key]}
                readOnly={readOnly}
                onChange={(a) => setAnswers((cur) => ({ ...cur, [q.key]: a }))}
              />
            ))}
            <div style={{ display: 'flex', gap: 10, position: 'sticky', bottom: 0, padding: '12px 0', background: 'var(--bg)' }}>
              <button className="btn-secondary" disabled={busy} onClick={() => save(false)}>Save for later</button>
              <span style={{ flex: 1 }} />
              <button
                className="btn-primary"
                disabled={busy || unanswered.length > 0}
                onClick={async () => { await save(true); setStage('sign'); }}
              >
                {unanswered.length ? `${unanswered.length} left` : 'Continue'}
              </button>
            </div>
          </>
        )}

        {/* -------------------------------------------------------- sign */}
        {form && stage === 'sign' && (
          <>
            <Card>
              <div style={{ fontWeight: 650, marginBottom: 8 }}>Your confirmation</div>
              {/* Straight from the server: this is the wording being agreed to,
                  and it has to be reproducible from the record years later. */}
              <p style={{ margin: 0, lineHeight: 1.7 }}>{form.confirmation.ml}</p>
              <p className="ds-caption" style={{ marginTop: 10, lineHeight: 1.6 }}>{form.confirmation.en}</p>

              <label style={{ display: 'flex', alignItems: 'flex-start', gap: 10, marginTop: 14, cursor: 'pointer' }}>
                <input type="checkbox" checked={confirmed} onChange={(e) => setConfirmed(e.target.checked)} style={{ marginTop: 3 }} />
                <span>I confirm the information I have given is true and complete.</span>
              </label>
            </Card>

            <Card>
              <div style={{ display: 'grid', gap: 10 }}>
                <div>
                  <label className="label" style={{ margin: 0 }}>Your name</label>
                  <input className="input" value={signedName} onChange={(e) => setSignedName(e.target.value)} placeholder="As it appears on the policy" />
                </div>
                <div>
                  <label className="label" style={{ margin: 0 }}>Date</label>
                  <input className="input" value={new Date().toLocaleDateString(undefined, { day: '2-digit', month: 'short', year: 'numeric' })} readOnly />
                </div>
                <div>
                  <label className="label" style={{ margin: 0 }}>Signature</label>
                  <SignaturePad onChange={setSignature} />
                </div>
              </div>
            </Card>

            <div style={{ display: 'flex', gap: 10 }}>
              <button className="btn-secondary" onClick={() => setStage('questions')} disabled={busy}>Back</button>
              <span style={{ flex: 1 }} />
              <button className="btn-primary" onClick={submit} disabled={busy || !confirmed || !signedName.trim() || !signature}>
                {busy ? <Loader2 size={14} className="ip-spin" /> : null} Submit declaration
              </button>
            </div>
            <p className="ds-caption">
              Once submitted this cannot be edited. A correction is raised as a new version so the record of what you
              signed stays intact.
            </p>
          </>
        )}
      </div>
    </div>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div style={{ display: 'flex', gap: 12 }}>
      <span className="ds-caption" style={{ minWidth: 96 }}>{label}</span>
      <span style={{ fontWeight: 550 }}>{value}</span>
    </div>
  );
}
function SectionHeading({ children }: { children: React.ReactNode }) {
  return <div className="ds-caption-upper" style={{ marginTop: 6 }}>{children}</div>;
}

// -------------------------------------------------------------------- list

/**
 * The customer's own copy of the declaration they signed.
 *
 * Same renderer as the office's copy, reached through the portal route that
 * binds the lookup to their session — so it is genuinely their record and not
 * a re-drawing of it, and there is no second document that could say something
 * different from the one the broker holds.
 */
function DownloadMyDeclaration({ id }: { id: string }) {
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  return (
    <>
      <button
        className="btn-secondary"
        disabled={busy}
        onClick={async () => {
          setBusy(true); setErr(null);
          try {
            const s = getPortalSession();
            await openDocument(`/api/portal/me/insurance/declarations/${id}/print`, s?.token);
          } catch (e: any) {
            setErr(e?.message ?? 'Could not open your declaration');
          } finally {
            setBusy(false);
          }
        }}
      >
        <FileText size={14} aria-hidden="true" style={{ marginRight: 6, verticalAlign: -2 }} />
        {busy ? 'Opening…' : 'Download PDF'}
      </button>
      {err && <span className="ds-caption" style={{ color: 'var(--tone-danger, #b91c1c)' }}>{err}</span>}
    </>
  );
}

export function DeclarationsPanel({ bump, onChanged }: { bump?: number; onChanged?: () => void }) {
  const [rows, setRows] = useState<Declaration[] | null>(null);
  const [open, setOpen] = useState<Declaration | null>(null);

  const load = useCallback(() => {
    portalApi<Declaration[]>('/portal/me/insurance/declarations')
      .then(setRows)
      .catch(() => setRows([]));
  }, []);
  useEffect(load, [load, bump]);

  if (!rows) return <Skeleton rows={2} height={90} />;
  if (!rows.length) {
    return (
      <Card>
        <EmptyState compact icon={ShieldCheck} title="No declarations to complete"
          body="If your broker needs a health declaration for a policy, it will appear here." />
      </Card>
    );
  }

  return (
    <>
      <div style={{ display: 'grid', gap: 10 }}>
        {rows.map((d) => {
          const s = customerStatus(d.status);
          const declared = Object.values(d.answers ?? {}).filter((a) => a?.declared).length;
          return (
            <Card key={d.id}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontWeight: 650 }}>{DECL_LABEL(d.type)}</div>
                  <div className="ds-caption">
                    {d.policy?.policyNo ?? d.quote?.reference ?? d.reference}
                    {d.version > 1 ? ` · revision ${d.version}` : ''}
                  </div>
                </div>
                <Badge tone={s.tone}>{s.label}</Badge>
              </div>
              {!s.actionable && (
                <div className="ds-caption" style={{ marginTop: 8 }}>
                  {declared} condition{declared === 1 ? '' : 's'} declared · {fmtDate(d.submittedAt ?? d.signedAt)}
                </div>
              )}
              {s.actionable && (
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 8 }}>
                  <AlertTriangle size={14} aria-hidden="true" style={{ color: 'var(--tone-renewal)' }} />
                  <span className="ds-caption">Complete this before your policy can be processed</span>
                </div>
              )}
              <div style={{ marginTop: 12, display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                <button className={s.actionable ? 'btn-primary' : 'btn-secondary'} onClick={() => setOpen(d)}>
                  {s.actionable ? (d.status === 'IN_PROGRESS' ? 'Continue' : 'Start declaration') : 'View'}
                </button>
                {/* Their own copy of what they signed — only once there is
                    something signed to give them. */}
                {!s.actionable && <DownloadMyDeclaration id={d.id} />}
              </div>
            </Card>
          );
        })}
      </div>
      {open && (
        <HealthDeclarationFlow
          declaration={open}
          onClose={() => setOpen(null)}
          onSaved={() => { load(); onChanged?.(); }}
        />
      )}
    </>
  );
}

/** The nudge on Home. Rendered only when something is actually being asked. */
export function DeclarationActionCard({ onOpen }: { onOpen: () => void }) {
  const [pending, setPending] = useState<Declaration[] | null>(null);
  useEffect(() => {
    portalApi<Declaration[]>('/portal/me/insurance/declarations')
      .then((r) => setPending(r.filter((d) => customerStatus(d.status).actionable)))
      .catch(() => setPending([]));
  }, []);
  if (!pending?.length) return null;
  return (
    <Card>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
        <PenLine size={18} aria-hidden="true" style={{ color: 'var(--tone-renewal)' }} />
        <div style={{ flex: 1 }}>
          <div style={{ fontWeight: 650 }}>{DECL_LABEL(pending[0]?.type)} needed</div>
          <div className="ds-caption">
            {pending.length === 1 ? 'One declaration is waiting for you' : `${pending.length} declarations are waiting for you`}
          </div>
        </div>
      </div>
      <div style={{ marginTop: 12 }}>
        <button className="btn-primary" onClick={onOpen}>Complete now</button>
      </div>
    </Card>
  );
}
