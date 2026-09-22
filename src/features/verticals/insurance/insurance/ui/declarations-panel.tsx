'use client';

import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Car, CircleCheck, FileText, HeartPulse, PenLine, ShieldCheck } from 'lucide-react';
import { toast } from 'sonner';
import { api, apiErrorMessage } from '@/lib/api';
// The store's own module, NOT the '@/features/foundation/auth' barrel: that barrel also
// re-exports the login and register COMPONENTS, so importing through it pulls
// the whole auth tree into this chunk and closes a require cycle that breaks
// prerendering of /login with "Cannot read properties of undefined".
import { useAuthStore } from '@/features/foundation/auth/store/auth-store';
import { openDocument } from './open-document';
import { DECLARATION_LABEL, DECLARATION_SUBJECT, declarationTypeForCategory } from './declaration-types';
import { Badge, Card, Drawer, EmptyState, Skeleton, type Tone } from './kit';

/**
 * The signed declaration as a printable page, opened in its own tab.
 *
 * Rendered by the API from the stored row — never rebuilt from what this
 * component happens to be showing — so the copy the office prints is the same
 * document the customer can print, and neither can drift from the record.
 */
function DownloadDeclaration({ id, reference }: { id: string; reference?: string }) {
  const [busy, setBusy] = useState(false);
  const token = useAuthStore((s) => s.accessToken);
  return (
    <button
      className="btn-secondary btn-sm"
      disabled={busy}
      onClick={async () => {
        setBusy(true);
        try {
          await openDocument(`/api/insurance/declarations/${id}/print`, token);
        } catch (e: any) {
          toast.error(e?.message ?? 'Could not open the declaration');
        } finally {
          setBusy(false);
        }
      }}
    >
      <FileText size={13} style={{ marginRight: 5, verticalAlign: -2 }} />
      {busy ? 'Opening…' : `PDF${reference ? ` · ${reference}` : ''}`}
    </button>
  );
}

/**
 * What the client told us about their health, as the office needs to read it.
 *
 * Three depths on purpose, because the same record answers three different
 * questions:
 *
 *   OVERVIEW — "is anything outstanding, and is there anything I should know
 *   before I speak to this person?" A card, a status, a count.
 *
 *   TAB — "what have they declared over time?" One row per declaration,
 *   including superseded versions, because a changed answer is itself a fact.
 *
 *   FULL VIEW — "what exactly did they sign?" Every question, every detail, the
 *   confirmation they agreed to and the signature they drew.
 *
 * Dumping all sixteen questions into the Overview would bury the four numbers
 * that belong there, and medical detail should take a deliberate click rather
 * than appear on a screen somebody opened to check a phone number.
 */

export interface Declaration {
  id: string;
  reference: string;
  type: string;
  status: string;
  answers: Record<string, {
    declared: boolean; sinceWhen?: string | null; treatment?: string | null;
    medication?: string | null; hospitalised?: boolean | null; notes?: string | null;
  }>;
  formVersion: number;
  version: number;
  signedName?: string | null;
  signatureData?: string | null;
  signedAt?: string | null;
  submittedAt?: string | null;
  reviewedAt?: string | null;
  sentAt?: string | null;
  createdAt: string;
  client?: { id: string; name: string; phone?: string | null; email?: string | null } | null;
  quote?: { id?: string; reference?: string | null; category?: string | null } | null;
  policy?: { id?: string; policyNo?: string | null; productName?: string | null; companyName?: string | null } | null;
}

interface FormDef {
  questions: { key: string; label: string; labelMl?: string; group: string }[];
  confirmation: { ml: string; en: string };
  version: number;
}

export function statusTone(s: string): { label: string; tone: Tone } {
  switch (s) {
    case 'DRAFT': return { label: 'Not sent', tone: 'neutral' };
    case 'SENT': return { label: 'Awaiting customer', tone: 'renewal' };
    case 'IN_PROGRESS': return { label: 'Customer started', tone: 'info' };
    case 'SUBMITTED': return { label: 'Submitted', tone: 'sales' };
    case 'REVIEWED': return { label: 'Reviewed', tone: 'active' };
    default: return { label: s, tone: 'neutral' };
  }
}

const fmt = (d?: string | null) =>
  d ? new Date(d).toLocaleString(undefined, { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' }) : '—';

const declaredKeys = (d: Declaration) =>
  Object.entries(d.answers ?? {}).filter(([, a]) => a?.declared).map(([k]) => k);

/** The subject of a declaration, in the words the office uses for it. */
const subjectOf = (d: Declaration) =>
  d.policy?.policyNo ?? d.quote?.reference ?? d.reference;

// -------------------------------------------------------------- full view

export function DeclarationDrawer({ id, open, onClose }: { id: string | null; open: boolean; onClose: () => void }) {
  const q = useQuery<Declaration>({
    queryKey: ['ins-declaration', id],
    queryFn: async () => (await api.get(`/insurance/declarations/${id}`)).data,
    enabled: open && !!id,
  });
  const d = q.data;
  // Keyed on the declaration's OWN type. Fetching a fixed form would render a
  // motor declaration against the medical questions — every answer would land
  // under the wrong label and read as a disclosure nobody made.
  const form = useQuery<FormDef>({
    queryKey: ['ins-declaration-form', d?.type ?? 'HEALTH'],
    queryFn: async () => (await api.get(`/insurance/declarations/form?type=${d?.type ?? 'HEALTH'}`)).data,
    enabled: open && !!d,
  });

  const s = d ? statusTone(d.status) : null;

  return (
    <Drawer
      open={open}
      onClose={onClose}
      title={d ? (DECLARATION_LABEL[(d.type as 'HEALTH' | 'MOTOR')] ?? 'Declaration') : 'Declaration'}
      subtitle={d ? `${d.reference}${d.version > 1 ? ` · revision ${d.version}` : ''}` : undefined}
      width={680}
    >
      {q.isLoading || form.isLoading ? <Skeleton rows={6} height={54} /> : !d || !form.data ? (
        <EmptyState icon={ShieldCheck} title="Could not load the declaration" body="Try again in a moment." />
      ) : (
        <div className="ds-stack">
          <Card>
            <InfoRow label="Customer" value={d.client?.name ?? '—'} />
            <InfoRow label="Policy" value={d.policy?.policyNo ? `${d.policy.policyNo} · ${d.policy.productName ?? ''}` : '—'} />
            <InfoRow label="Quote" value={d.quote?.reference ?? '—'} />
            <InfoRow label="Status" value={s!.label} />
            <InfoRow label="Submitted" value={fmt(d.submittedAt)} />
            <InfoRow label="Version" value={String(d.version)} />
          </Card>

          <Card>
            <div className="ds-caption-upper" style={{ marginBottom: 10 }}>What was declared</div>
            {/* Rendered from the QUESTION SET, not from the answers, so a
                question the customer never reached shows as unanswered rather
                than silently vanishing from the record. */}
            <div style={{ display: 'grid', gap: 10 }}>
              {form.data.questions.map((qq) => {
                const a = d.answers?.[qq.key];
                const yes = a?.declared === true;
                return (
                  <div key={qq.key} style={{ borderBottom: '1px solid var(--line-soft)', paddingBottom: 8 }}>
                    <div style={{ display: 'flex', alignItems: 'baseline', gap: 10 }}>
                      <span style={{ flex: 1, fontWeight: yes ? 650 : 500 }}>{qq.label}</span>
                      {a === undefined
                        ? <span className="ds-caption">not answered</span>
                        : <Badge tone={yes ? 'claim' : 'neutral'} dot={false}>{yes ? 'YES' : 'No'}</Badge>}
                    </div>
                    {yes && (
                      <div className="ds-caption" style={{ marginTop: 6, display: 'grid', gap: 3 }}>
                        {a?.sinceWhen && <span>Since: {a.sinceWhen}</span>}
                        {a?.treatment && <span>Treatment: {a.treatment}</span>}
                        {a?.medication && <span>Medication: {a.medication}</span>}
                        {a?.hospitalised != null && <span>Hospitalised: {a.hospitalised ? 'Yes' : 'No'}</span>}
                        {a?.notes && <span>{a.notes}</span>}
                        {!a?.sinceWhen && !a?.treatment && !a?.medication && !a?.notes && <span>No further detail given.</span>}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </Card>

          <Card>
            <div className="ds-caption-upper" style={{ marginBottom: 10 }}>Customer confirmation</div>
            {/* The exact wording that was agreed to, from the server. */}
            <p style={{ margin: 0, lineHeight: 1.7 }}>{form.data.confirmation.ml}</p>
            <p className="ds-caption" style={{ marginTop: 10, lineHeight: 1.6 }}>{form.data.confirmation.en}</p>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 12 }}>
              <CircleCheck size={15} aria-hidden="true" style={{ color: d.signedAt ? 'var(--tone-active)' : 'var(--ink-3)' }} />
              <span>{d.signedAt ? 'Customer confirmed and signed' : 'Not yet confirmed'}</span>
            </div>
            {d.signedAt && (
              <div style={{ marginTop: 12 }}>
                <InfoRow label="Signed by" value={d.signedName ?? '—'} />
                <InfoRow label="Signed on" value={fmt(d.signedAt)} />
                {d.signatureData && (
                  <div style={{ marginTop: 10 }}>
                    <div className="ds-caption" style={{ marginBottom: 6 }}>Signature</div>
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={d.signatureData}
                      alt={`Signature of ${d.signedName ?? 'the customer'}`}
                      style={{ maxWidth: '100%', border: '1px solid var(--hairline)', borderRadius: 8, background: '#fff' }}
                    />
                  </div>
                )}
              </div>
            )}
          </Card>
        </div>
      )}
    </Drawer>
  );
}

function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <div style={{ display: 'flex', gap: 12, padding: '5px 0' }}>
      <span className="ds-caption" style={{ minWidth: 110 }}>{label}</span>
      <span style={{ fontWeight: 550, minWidth: 0, wordBreak: 'break-word' }}>{value}</span>
    </div>
  );
}

// ---------------------------------------------------------------- overview

/**
 * The Overview highlight. Renders nothing when the client has never had one —
 * an empty "no declarations" card on a motor-only client is noise.
 */
export function DeclarationHighlight({
  clientId, healthQuotes = [], healthPolicies = [], onOpenTab,
}: {
  clientId: string;
  /** The client's OPEN quotes that call for a declaration — health or motor. */
  healthQuotes?: { id: string; reference?: string | null; category?: string | null }[];
  /** Their issued policies of those kinds, for back-filling a customer already covered. */
  healthPolicies?: { id: string; policyNo?: string | null; productName?: string | null; category?: string | null }[];
  onOpenTab?: () => void;
}) {
  const [openId, setOpenId] = useState<string | null>(null);
  const qc = useQueryClient();
  const q = useQuery<Declaration[]>({
    queryKey: ['ins-client-declarations', clientId],
    queryFn: async () => (await api.get(`/insurance/clients/${clientId}/declarations`)).data,
  });
  const raise = useMutation({
    mutationFn: async (t: { id: string; viaPolicy: boolean }) =>
      (await api.post(`/insurance/${t.viaPolicy ? 'policies' : 'quotes'}/${t.id}/declaration`)).data,
    onSuccess: () => {
      toast.success('Declaration raised — send it to the customer next');
      qc.invalidateQueries({ queryKey: ['ins-client-declarations', clientId] });
    },
    onError: (e) => toast.error(apiErrorMessage(e)),
  });

  // Raising it is only half the job: a DRAFT declaration has not reached the
  // customer at all. Both actions live here because a policy-raised one has no
  // quote panel to fall back to.
  const send = useMutation({
    mutationFn: async (id: string) => (await api.post(`/insurance/declarations/${id}/send`)).data,
    onSuccess: () => {
      toast.success('Marked as sent — it is now waiting in the customer’s portal');
      qc.invalidateQueries({ queryKey: ['ins-client-declarations', clientId] });
    },
    onError: (e) => toast.error(apiErrorMessage(e)),
  });
  const review = useMutation({
    mutationFn: async (id: string) => (await api.post(`/insurance/declarations/${id}/review`)).data,
    onSuccess: () => {
      toast.success('Marked as reviewed');
      qc.invalidateQueries({ queryKey: ['ins-client-declarations', clientId] });
    },
    onError: (e) => toast.error(apiErrorMessage(e)),
  });

  const rows = q.data ?? [];

  if (q.isLoading) return null;

  // Nothing at all for a client with no declarable business. A permanently
  // empty card on every profile is the kind of noise that teaches people to
  // stop reading the page.
  if (rows.length === 0 && healthQuotes.length === 0 && healthPolicies.length === 0) return null;

  // Declarable business, but nobody has asked them yet — which is exactly when
  // the ABSENCE is the thing worth showing.
  if (rows.length === 0) {
    // Prefer an open quote — that is the honest place to disclose. Fall back to
    // an issued policy so a customer who is already covered can still be asked.
    const quote = healthQuotes[0];
    const policy = healthPolicies[0];
    const target = quote ?? policy;
    const viaPolicy = !quote && !!policy;
    // The target's own category names the declaration, so a motor-only client
    // is offered the motor form and never the medical one.
    const t = declarationTypeForCategory(target?.category) ?? 'HEALTH';
    return (
      <Card>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 10 }}>
          <HeartPulse size={16} aria-hidden="true" style={{ color: 'var(--ink-3)' }} />
          <span className="ds-caption-upper" style={{ flex: 1 }}>{DECLARATION_LABEL[t]}</span>
          <Badge tone="renewal">Not raised</Badge>
        </div>
        <div className="ds-caption">
          This client has {DECLARATION_SUBJECT[t]} but has not been asked to declare yet.
        </div>
        <InfoRow
          label="For"
          value={(quote?.reference ?? policy?.policyNo ?? '—') + (viaPolicy && policy?.productName ? ` · ${policy.productName}` : '')}
        />
        {viaPolicy && (
          <div className="ds-caption" style={{ marginTop: 4 }}>
            Cover is already in force, so this will be recorded as collected after issue.
          </div>
        )}
        <div style={{ marginTop: 12 }}>
          <button
            className="btn-primary btn-sm"
            disabled={!target || raise.isPending}
            onClick={() => target && raise.mutate({ id: target.id, viaPolicy })}
          >
            {raise.isPending ? 'Raising…' : 'Raise declaration'}
          </button>
        </div>
      </Card>
    );
  }

  const latest = rows[0];
  const s = statusTone(latest.status);
  const declared = declaredKeys(latest);
  const outstanding = ['DRAFT', 'SENT', 'IN_PROGRESS'].includes(latest.status);

  return (
    <>
      <Card>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 10 }}>
          <HeartPulse size={16} aria-hidden="true" style={{ color: 'var(--ink-3)' }} />
          <span className="ds-caption-upper" style={{ flex: 1 }}>
            {DECLARATION_LABEL[(latest.type as 'HEALTH' | 'MOTOR')] ?? 'Declaration'}
          </span>
          <Badge tone={s.tone}>{s.label}</Badge>
        </div>
        <InfoRow label="For" value={subjectOf(latest)} />
        {outstanding ? (
          <div className="ds-caption" style={{ marginTop: 6 }}>
            {latest.status === 'DRAFT'
              ? 'Raised but not yet sent to the customer.'
              : latest.status === 'SENT'
                ? 'Waiting for the customer to complete it in their portal.'
                : 'The customer has started but not signed it.'}
          </div>
        ) : (
          <>
            <InfoRow label="Submitted" value={fmt(latest.submittedAt)} />
            <InfoRow
              label="Declared"
              value={declared.length === 0 ? 'Nothing declared' : `${declared.length} condition${declared.length === 1 ? '' : 's'}`}
            />
          </>
        )}
        <div style={{ display: 'flex', gap: 8, marginTop: 12, flexWrap: 'wrap' }}>
          {latest.status === 'DRAFT' && (
            <button className="btn-primary btn-sm" disabled={send.isPending} onClick={() => send.mutate(latest.id)}>
              {send.isPending ? 'Sending…' : 'Send to customer'}
            </button>
          )}
          {latest.status === 'SUBMITTED' && (
            <button className="btn-primary btn-sm" disabled={review.isPending} onClick={() => review.mutate(latest.id)}>
              {review.isPending ? 'Saving…' : 'Mark reviewed'}
            </button>
          )}
          <button className="btn-secondary btn-sm" onClick={() => setOpenId(latest.id)}>View declaration</button>
          {rows.length > 1 && onOpenTab && (
            <button className="btn-ghost btn-sm" onClick={onOpenTab}>All {rows.length}</button>
          )}
        </div>
      </Card>
      <DeclarationDrawer id={openId} open={!!openId} onClose={() => setOpenId(null)} />
    </>
  );
}

// --------------------------------------------------------------------- tab

export function DeclarationsTab({
  clientId, healthQuotes = [], healthPolicies = [], onOpenQuotes,
}: {
  clientId: string;
  healthQuotes?: { id: string; reference?: string | null; category?: string | null }[];
  healthPolicies?: { id: string; policyNo?: string | null; productName?: string | null; category?: string | null }[];
  onOpenQuotes?: () => void;
}) {
  const [openId, setOpenId] = useState<string | null>(null);
  const qc = useQueryClient();
  const q = useQuery<Declaration[]>({
    queryKey: ['ins-client-declarations', clientId],
    queryFn: async () => (await api.get(`/insurance/clients/${clientId}/declarations`)).data,
  });
  const raiseFromTab = useMutation({
    mutationFn: async (t: { id: string; viaPolicy: boolean }) =>
      (await api.post(`/insurance/${t.viaPolicy ? 'policies' : 'quotes'}/${t.id}/declaration`)).data,
    onSuccess: () => {
      toast.success('Declaration raised — send it to the customer from the quote');
      qc.invalidateQueries({ queryKey: ['ins-client-declarations', clientId] });
    },
    onError: (e) => toast.error(apiErrorMessage(e)),
  });

  const sendFromTab = useMutation({
    mutationFn: async (id: string) => (await api.post(`/insurance/declarations/${id}/send`)).data,
    onSuccess: () => {
      toast.success('Marked as sent — it is now waiting in the customer’s portal');
      qc.invalidateQueries({ queryKey: ['ins-client-declarations', clientId] });
    },
    onError: (e) => toast.error(apiErrorMessage(e)),
  });
  const reviewFromTab = useMutation({
    mutationFn: async (id: string) => (await api.post(`/insurance/declarations/${id}/review`)).data,
    onSuccess: () => {
      toast.success('Marked as reviewed');
      qc.invalidateQueries({ queryKey: ['ins-client-declarations', clientId] });
    },
    onError: (e) => toast.error(apiErrorMessage(e)),
  });

  if (q.isLoading) return <Skeleton rows={3} height={90} />;
  const rows = q.data ?? [];
  if (!rows.length) {
    // A dead end is worse than an empty list. Either there is a quote to raise
    // this against — in which case say which — or there is not, and the next
    // step is a quote, not a declaration.
    const t = declarationTypeForCategory(healthQuotes[0]?.category ?? healthPolicies[0]?.category) ?? 'HEALTH';
    const subject = DECLARATION_SUBJECT[t];
    return (
      <Card>
        <EmptyState
          icon={HeartPulse}
          title={healthQuotes.length || healthPolicies.length ? 'No declarations yet' : `No ${subject}`}
          body={healthQuotes.length
            ? `A declaration is created from a ${subject} quote, then completed and signed by the customer in their own portal.`
            : healthPolicies.length
              ? 'This client already holds cover. A declaration can still be collected against the policy — it will be recorded as taken after issue.'
              : 'Declarations are raised against a health or motor quote. This client has neither.'}
        />
        {healthQuotes.length > 0 && (
          <div style={{ marginTop: 4 }}>
            <div className="ds-caption" style={{ marginBottom: 8 }}>
              {healthQuotes.length === 1 ? 'Their quote' : 'Their quotes'}
            </div>
            <div style={{ display: 'grid', gap: 8 }}>
              {healthQuotes.map((hq) => (
                <div key={hq.id} style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  <span style={{ flex: 1, fontFamily: 'var(--mono)' }}>{hq.reference ?? hq.id}</span>
                  <button
                    className="btn-secondary btn-sm"
                    disabled={raiseFromTab.isPending}
                    onClick={() => raiseFromTab.mutate({ id: hq.id, viaPolicy: false })}
                  >
                    Raise declaration
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}
        {healthQuotes.length === 0 && healthPolicies.length > 0 && (
          <div style={{ marginTop: 4 }}>
            <div className="ds-caption" style={{ marginBottom: 8 }}>Their health policies</div>
            <div style={{ display: 'grid', gap: 8 }}>
              {healthPolicies.map((hp) => (
                <div key={hp.id} style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  <span style={{ flex: 1 }}>
                    <span style={{ fontFamily: 'var(--mono)' }}>{hp.policyNo ?? hp.id}</span>
                    {hp.productName ? <span className="ds-caption"> · {hp.productName}</span> : null}
                  </span>
                  <button
                    className="btn-secondary btn-sm"
                    disabled={raiseFromTab.isPending}
                    onClick={() => raiseFromTab.mutate({ id: hp.id, viaPolicy: true })}
                  >
                    Raise declaration
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}
        {healthQuotes.length === 0 && healthPolicies.length === 0 && onOpenQuotes && (
          <div style={{ marginTop: 4 }}>
            <button className="btn-secondary btn-sm" onClick={onOpenQuotes}>View quotes</button>
          </div>
        )}
      </Card>
    );
  }

  return (
    <>
      <div className="ds-stack">
        {rows.map((d) => {
          const s = statusTone(d.status);
          const declared = declaredKeys(d);
          return (
            <Card key={d.id}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                {d.type === 'MOTOR'
                  ? <Car size={15} aria-hidden="true" style={{ color: 'var(--ink-3)' }} />
                  : <HeartPulse size={15} aria-hidden="true" style={{ color: 'var(--ink-3)' }} />}
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontWeight: 650 }}>{subjectOf(d)}</div>
                  <div className="ds-caption">
                    {DECLARATION_LABEL[(d.type as 'HEALTH' | 'MOTOR')] ?? d.type}
                    {' · '}{d.reference}{d.version > 1 ? ` · revision ${d.version}` : ''}
                    {d.policy?.productName ? ` · ${d.policy.productName}` : ''}
                  </div>
                </div>
                <Badge tone={s.tone}>{s.label}</Badge>
              </div>

              <div style={{ marginTop: 10 }}>
                <InfoRow label="Submitted" value={fmt(d.submittedAt)} />
                {d.reviewedAt && <InfoRow label="Reviewed" value={fmt(d.reviewedAt)} />}
              </div>

              {declared.length > 0 && (
                <div style={{ marginTop: 8 }}>
                  <div className="ds-caption" style={{ marginBottom: 5 }}>Declared conditions</div>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                    {declared.map((k) => <Badge key={k} tone="claim" dot={false}>{k}</Badge>)}
                  </div>
                </div>
              )}
              {d.submittedAt && declared.length === 0 && (
                <div className="ds-caption" style={{ marginTop: 8 }}>Nothing declared.</div>
              )}

              <div style={{ marginTop: 12, display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                {d.status === 'DRAFT' && (
                  <button className="btn-primary btn-sm" disabled={sendFromTab.isPending} onClick={() => sendFromTab.mutate(d.id)}>
                    {sendFromTab.isPending ? 'Sending…' : 'Send to customer'}
                  </button>
                )}
                {d.status === 'SUBMITTED' && (
                  <button className="btn-primary btn-sm" disabled={reviewFromTab.isPending} onClick={() => reviewFromTab.mutate(d.id)}>
                    {reviewFromTab.isPending ? 'Saving…' : 'Mark reviewed'}
                  </button>
                )}
                <button className="btn-secondary btn-sm" onClick={() => setOpenId(d.id)}>View full declaration</button>
                <DownloadDeclaration id={d.id} reference={d.reference} />
              </div>
            </Card>
          );
        })}
      </div>
      <DeclarationDrawer id={openId} open={!!openId} onClose={() => setOpenId(null)} />
    </>
  );
}
