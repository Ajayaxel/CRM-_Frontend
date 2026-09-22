'use client';

/**
 * Claim record page — the desk you live at while a file is open.
 *
 * The claim now has a real stage machine behind it, so this page is built on
 * the per-claim endpoint rather than on a lookup through the list:
 *   GET   /insurance/claims/:id              -> claim + policy + client + events
 *   POST  /insurance/claims/:id/stage        { stage, note?, surveyorName?, surveyAt? }
 *   POST  /insurance/claims/:id/events       { kind, title, detail?, customerVisible? }
 *   PATCH /insurance/claims/:id/docs         { key, received }
 *   POST  /insurance/claims/:id/submit
 *   PATCH /insurance/claims/:id/status       { status, settledInr? }
 *
 * If the per-claim endpoint is not reachable the page falls back to the claims
 * list, so an older API build degrades to the previous behaviour instead of an
 * error screen.
 */

import { useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import {
  ArrowLeft, ArrowRight, Banknote, Building2, Check, ClipboardCheck, Download,
  FileText, Link2, Mail, MessageCircle, Phone, Send, ShieldCheck, StickyNote,
  Trash2, UploadCloud,
} from 'lucide-react';
import { api, apiErrorMessage } from '@/lib/api';
import { fmtOrgMoney } from '@/lib/org-locale';
import { openDocument, useStorageStatus } from '@/features/capabilities/documents/document-uploader';
import {
  Badge, Card, Drawer, EmptyState, Field, SectionTitle, Segmented, Skeleton, Stepper,
  Timeline, humanStatus, toneForClaimStatus, useIsNarrow, type Tone,
} from '../ui/kit';
import { DocumentsPanel } from '../ui/documents-panel';
import { CLAIM_STAGES, slaText, stageMeta } from './claims-board';

const money = (n?: number | null) => fmtOrgMoney(n);

const fmtDate = (d?: string | Date | null) =>
  d ? new Date(d).toLocaleDateString(undefined, { day: '2-digit', month: 'short', year: 'numeric' }) : '—';

/** "12 Aug" — for the SLA sentence, where the year is noise. */
const fmtShort = (d?: string | Date | null) =>
  d ? new Date(d).toLocaleDateString(undefined, { day: 'numeric', month: 'short' }) : null;

// ============================================================ the stage machine

/**
 * The rail shows the path a healthy claim walks. ADDITIONAL_DOCS is a loop back
 * out of insurer review, and REJECTED leaves the path altogether, so neither is
 * a position on it.
 */
const MAIN_PATH = CLAIM_STAGES.filter((s) => s.key !== 'ADDITIONAL_DOCS' && s.key !== 'REJECTED');

/** What "advance" means at each stage — machine order alone would send a file into the additional-documents loop. */
const NEXT_STAGE: Record<string, string | null> = {
  REGISTERED: 'DOC_COLLECTION',
  DOC_COLLECTION: 'DOCS_VERIFIED',
  DOCS_VERIFIED: 'SURVEY_SCHEDULED',
  SURVEY_SCHEDULED: 'SURVEY_COMPLETED',
  SURVEY_COMPLETED: 'INSURER_REVIEW',
  INSURER_REVIEW: 'APPROVED',
  ADDITIONAL_DOCS: 'INSURER_REVIEW',
  APPROVED: 'SETTLEMENT',
  SETTLEMENT: 'CLOSED',
  CLOSED: null,
  REJECTED: null,
};

/** Older claims carry only the legacy status; place them on the machine honestly. */
const STAGE_FROM_STATUS: Record<string, string> = {
  DOCS_PENDING: 'DOC_COLLECTION',
  REGISTERED: 'REGISTERED',
  SUBMITTED: 'INSURER_REVIEW',
  UNDER_REVIEW: 'INSURER_REVIEW',
  APPROVED: 'APPROVED',
  SETTLED: 'CLOSED',
  REJECTED: 'REJECTED',
};

function stepIndex(stage: string) {
  if (stage === 'ADDITIONAL_DOCS') return MAIN_PATH.findIndex((s) => s.key === 'INSURER_REVIEW');
  return MAIN_PATH.findIndex((s) => s.key === stage);
}

// ============================================================ events

const EVENT_ICON: Record<string, any> = {
  NOTE: StickyNote,
  CALL: Phone,
  EMAIL: Mail,
  WHATSAPP: MessageCircle,
  DOC: FileText,
  SURVEY: ClipboardCheck,
  INSURER: Building2,
  SETTLEMENT: Banknote,
  STAGE: ArrowRight,
};

const EVENT_TONE: Record<string, Tone> = {
  NOTE: 'neutral',
  CALL: 'sales',
  EMAIL: 'sales',
  WHATSAPP: 'active',
  DOC: 'renewal',
  SURVEY: 'claim',
  INSURER: 'info',
  SETTLEMENT: 'active',
  STAGE: 'info',
};

const TONES: Tone[] = ['active', 'renewal', 'expired', 'claim', 'sales', 'info', 'neutral'];
const toneOf = (ev: any): Tone => (TONES.includes(ev?.tone) ? ev.tone : EVENT_TONE[String(ev?.kind ?? '').toUpperCase()] ?? 'neutral');

// ============================================================ docs

/** Docs are only collectable before the file goes to the insurer. */
const docsEditable = (status?: string) => ['DOCS_PENDING', 'REGISTERED'].includes((status ?? '').toUpperCase());

/**
 * The server resolves each slot against the actual Document rows: `satisfied`
 * and `source` say whether and HOW the requirement is met — an uploaded file,
 * an existing client/policy document referenced by id, or the manual tick.
 * `received` survives as the raw manual flag (and as the whole answer when an
 * older API responds, which is what the ?? fallback is for).
 */
type SlotFile = { id: string; name?: string | null; fileName?: string | null; mimeType?: string | null; sizeBytes?: number | null };
type Doc = {
  key: string; label: string; received?: boolean; documentId?: string | null;
  satisfied?: boolean; source?: 'claim' | 'client' | 'policy' | 'manual' | null;
  document?: SlotFile | null;
};
const slotIn = (d: Doc) => d.satisfied ?? !!d.received;
const docsOf = (claim: any): Doc[] => (Array.isArray(claim?.docs) ? (claim.docs as Doc[]) : []);
const allDocsIn = (claim: any) => { const d = docsOf(claim); return d.length > 0 && d.every(slotIn); };

const TABS = ['Overview', 'Documents', 'Timeline', 'Notes'] as const;
type Tab = (typeof TABS)[number];

// ============================================================ small pieces

/** A labelled fact. Used in the overview grid and the right rail. */
function Fact({ label, value, tone }: { label: string; value: React.ReactNode; tone?: Tone }) {
  return (
    <div>
      <div className="ds-caption">{label}</div>
      <div className="ds-h3 ds-num" style={{ marginTop: 'var(--s-1)', color: tone ? `var(--tone-${tone})` : undefined }}>
        {value}
      </div>
    </div>
  );
}

/** Percentage bar for the document completion summary. */
function Progress({ pct, tone = 'active' }: { pct: number; tone?: Tone }) {
  return (
    <div className="ds-inset" style={{ height: 'var(--s-2)', overflow: 'hidden', borderRadius: 'var(--r-pill)' }}>
      <div
        style={{
          width: `${Math.max(pct, 0)}%`, height: '100%', borderRadius: 'var(--r-pill)',
          background: `var(--tone-${tone})`, opacity: 0.9,
          transition: 'width 320ms cubic-bezier(.4,0,.2,1)',
        }}
      />
    </div>
  );
}

/** What stands behind a satisfied slot, said plainly. */
const SOURCE_LABEL: Record<string, string> = {
  claim: 'Claim document',
  client: 'Existing client document',
  policy: 'Existing policy document',
  manual: 'Received manually',
};

/** A document already on the client/policy that could satisfy a slot. */
type Candidate = {
  id: string; kind?: string | null; name?: string | null; fileName?: string | null;
  sizeBytes?: number | null; createdAt?: string; source: 'client' | 'policy';
};

/**
 * One checklist slot: what is asked for, what (if anything) answers it, and the
 * ways to answer it — upload a file, point at a document already on file, or
 * record that the paper was collected by hand. A file always outranks a tick.
 */
function SlotRow({
  doc, locked, busy, candidates, canUpload, accept, maxBytes,
  onTick, onUpload, onUseExisting, onDeleteFile,
}: {
  doc: Doc; locked: boolean; busy: boolean; candidates: Candidate[];
  canUpload: boolean; accept?: string; maxBytes: number;
  onTick: (received: boolean) => void;
  onUpload: (file: File, key: string) => void;
  onUseExisting: (documentId: string | null) => void;
  onDeleteFile: (documentId: string) => void;
}) {
  const fileRef = useRef<HTMLInputElement>(null);
  const [showCandidates, setShowCandidates] = useState(false);
  const done = slotIn(doc);
  const source = doc.satisfied ? doc.source : doc.received ? 'manual' : null;
  const file = doc.document ?? null;

  return (
    <div style={{ borderBottom: '1px solid var(--hairline-soft)', padding: 'var(--s-3) 0' }}>
      <div style={{ display: 'flex', alignItems: 'flex-start', gap: 'var(--s-3)' }}>
        <span
          aria-hidden="true"
          style={{
            width: 'var(--s-4)', height: 'var(--s-4)', borderRadius: 'var(--r-sm)', flex: 'none', marginTop: 2,
            display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
            border: `1px solid ${done ? 'var(--tone-active)' : 'var(--hairline-strong)'}`,
            background: done ? 'var(--tone-active)' : 'transparent',
          }}
        >
          {done && <Check size={11} strokeWidth={3.5} color="var(--surface)" />}
        </span>

        <div style={{ minWidth: 0, flex: 1 }}>
          <div style={{ display: 'flex', alignItems: 'baseline', gap: 'var(--s-2)', flexWrap: 'wrap' }}>
            <span className="ds-body" style={{ color: 'var(--ink)' }}>{doc.label}</span>
            {source && <Badge tone={source === 'manual' ? 'neutral' : 'active'} dot={false}>{SOURCE_LABEL[source]}</Badge>}
            {!done && <span className="ds-list-row-meta">Outstanding</span>}
          </div>

          {/* The evidence, when it is a real file. */}
          {file && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--s-2)', marginTop: 'var(--s-1)' }}>
              <FileText size={13} style={{ color: 'var(--ink-3)', flexShrink: 0 }} aria-hidden="true" />
              <span className="ds-caption" style={{ minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={file.fileName ?? ''}>
                {file.fileName ?? file.name}
              </span>
              <button className="btn-ghost btn-sm" title="Download" onClick={() => openDocument(file.id)}>
                <Download size={13} />
              </button>
              {/* Claim uploads can be removed here; a referenced client/policy
                  document is UNLINKED instead — the file itself stays where it
                  lives, untouched. */}
              {source === 'claim' && !locked && (
                <button
                  className="btn-ghost btn-sm" title="Remove this file" style={{ color: 'var(--tone-expired)' }}
                  disabled={busy}
                  onClick={() => confirm(`Remove the uploaded ${doc.label.toLowerCase()}?`) && onDeleteFile(file.id)}
                >
                  <Trash2 size={13} />
                </button>
              )}
              {(source === 'client' || source === 'policy') && !locked && (
                <button className="btn-ghost btn-sm" disabled={busy} onClick={() => onUseExisting(null)}>
                  Unlink
                </button>
              )}
            </div>
          )}
          {source === 'manual' && (
            <div className="ds-caption" style={{ marginTop: 'var(--s-1)' }}>
              Ticked by staff — no file attached yet. An upload will become the evidence.
            </div>
          )}

          {/* The ways to fill an open slot. */}
          {!locked && source !== 'claim' && (
            <div style={{ display: 'flex', gap: 'var(--s-2)', flexWrap: 'wrap', marginTop: 'var(--s-2)' }}>
              {canUpload && (
                <>
                  <input
                    ref={fileRef}
                    type="file"
                    style={{ display: 'none' }}
                    accept={accept}
                    onChange={(e) => {
                      const f = e.target.files?.[0];
                      e.target.value = '';
                      if (!f) return;
                      if (f.size > maxBytes) {
                        toast.error(`That file is ${(f.size / 1048576).toFixed(1)}MB; the limit is ${Math.round(maxBytes / 1048576)}MB.`);
                        return;
                      }
                      onUpload(f, doc.key);
                    }}
                  />
                  <button className="btn-secondary btn-sm" disabled={busy} onClick={() => fileRef.current?.click()}>
                    <UploadCloud size={13} /> Upload
                  </button>
                </>
              )}
              {candidates.length > 0 && !done && (
                <button className="btn-ghost btn-sm" disabled={busy} onClick={() => setShowCandidates((s) => !s)}>
                  <Link2 size={13} /> Use existing
                </button>
              )}
              {!done && (
                <button className="btn-ghost btn-sm" disabled={busy} onClick={() => onTick(true)}>
                  Mark received manually
                </button>
              )}
              {source === 'manual' && (
                <button className="btn-ghost btn-sm" disabled={busy} onClick={() => onTick(false)}>
                  Undo manual tick
                </button>
              )}
            </div>
          )}

          {/* Paperwork already on file that would answer this slot — one
              physical document, referenced rather than uploaded again. */}
          {showCandidates && !done && (
            <div className="ds-inset" style={{ marginTop: 'var(--s-2)', borderRadius: 'var(--r-md)', padding: 'var(--s-2)' }}>
              {candidates.map((c) => (
                <div key={c.id} style={{ display: 'flex', alignItems: 'center', gap: 'var(--s-2)', padding: 'var(--s-1) var(--s-2)' }}>
                  <FileText size={13} style={{ color: 'var(--ink-3)', flexShrink: 0 }} aria-hidden="true" />
                  <span className="ds-caption" style={{ flex: 1, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={c.fileName ?? ''}>
                    {c.name ?? c.fileName}
                  </span>
                  <span className="ds-caption ds-muted">{c.source === 'policy' ? 'on the policy' : 'on the client'}</span>
                  <button
                    className="btn-secondary btn-sm" disabled={busy}
                    onClick={() => { setShowCandidates(false); onUseExisting(c.id); }}
                  >
                    Use
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

/** Jump to any stage — the escape hatch beside the one-click advance. */
function StagePicker({ current, onPick, busy }: { current: string; onPick: (stage: string) => void; busy: boolean }) {
  const [open, setOpen] = useState(false);
  return (
    <div style={{ position: 'relative' }}>
      <button
        className="btn-secondary"
        aria-haspopup="menu"
        aria-expanded={open}
        disabled={busy}
        onClick={() => setOpen((o) => !o)}
      >
        Change stage
      </button>
      {open && (
        <>
          <div style={{ position: 'fixed', inset: 0, zIndex: 19 }} onClick={() => setOpen(false)} />
          <div
            role="menu"
            className="ds-panel"
            style={{
              position: 'absolute', right: 0, top: 'calc(100% + 4px)', zIndex: 20,
              padding: 'var(--s-1)', minWidth: 220, maxHeight: 320, overflowY: 'auto',
            }}
          >
            {CLAIM_STAGES.filter((s) => s.key !== current).map((s) => (
              <button
                key={s.key}
                role="menuitem"
                className="btn-ghost btn-sm"
                style={{ width: '100%', justifyContent: 'flex-start' }}
                onClick={() => { setOpen(false); onPick(s.key); }}
              >
                <span className={`ds-dot ds-fg-${s.tone}`} /> {s.label}
              </button>
            ))}
          </div>
        </>
      )}
    </div>
  );
}

// ============================================================ screen

export function InsuranceClaimDetail({ id }: { id: string }) {
  const qc = useQueryClient();
  const params = useSearchParams();
  const narrow = useIsNarrow(900);
  const [settleAmt, setSettleAmt] = useState('');
  const [stageForm, setStageForm] = useState<
    { stage: string; note: string; surveyorName: string; surveyAt: string } | null
  >(null);
  const [noteKind, setNoteKind] = useState('Internal note');
  const [noteForm, setNoteForm] = useState({ title: '', detail: '' });

  /* ------------------------------------------------------------- data */
  const detail = useQuery({
    queryKey: ['ins-claim', id],
    // A few minutes of an older API build should degrade, not crash.
    retry: false,
    queryFn: async () => (await api.get<any>(`/insurance/claims/${id}`)).data,
  });
  const degraded = detail.isError;

  const list = useQuery({
    queryKey: ['ins-claims'],
    enabled: degraded,
    queryFn: async () => (await api.get<any[]>('/insurance/claims')).data,
  });
  const policies = useQuery({
    queryKey: ['ins-policies'],
    enabled: degraded,
    queryFn: async () => (await api.get<any[]>('/insurance/policies')).data,
  });

  const refresh = () => {
    qc.invalidateQueries({ queryKey: ['ins-claim', id] });
    qc.invalidateQueries({ queryKey: ['ins-claims'] });
    qc.invalidateQueries({ queryKey: ['ins-claims-board'] });
    qc.invalidateQueries({ queryKey: ['ins-claim-docs', id] });
    qc.invalidateQueries({ queryKey: ['ins-docs', 'INS_CLAIM', id] });
  };

  const storage = useStorageStatus();

  // Which existing client/policy documents could satisfy each open slot.
  const docOptions = useQuery<{ candidates: Record<string, Candidate[]> }>({
    queryKey: ['ins-claim-docs', id],
    enabled: !degraded,
    queryFn: async () => (await api.get(`/insurance/claims/${id}/documents`)).data,
  });

  const tick = useMutation({
    mutationFn: ({ key, received }: { key: string; received: boolean }) =>
      api.patch(`/insurance/claims/${id}/docs`, { key, received }),
    onSuccess: refresh,
    onError: (e) => toast.error(apiErrorMessage(e)),
  });

  // The same three-step flow every other upload in the product uses: authorise,
  // PUT straight to R2, confirm. The claim routes only add the claim context.
  const uploadSlot = useMutation({
    mutationFn: async ({ file, key }: { file: File; key: string }) => {
      const intent = (
        await api.post(`/insurance/claims/${id}/documents/upload-intent`, {
          kind: key, fileName: file.name, mimeType: file.type, sizeBytes: file.size,
        })
      ).data;
      const put = await fetch(intent.uploadUrl, { method: 'PUT', body: file, headers: intent.requiredHeaders });
      if (!put.ok) {
        throw new Error(
          put.status === 403
            ? 'Storage rejected the upload — the bucket may not allow uploads from this site.'
            : `Upload failed (${put.status})`,
        );
      }
      return (await api.post(`/insurance/claims/${id}/documents/${intent.documentId}/complete`, {})).data;
    },
    onSuccess: () => { toast.success('Document uploaded'); refresh(); },
    onError: (e: any) => toast.error(e?.message ?? apiErrorMessage(e)),
  });

  const useExisting = useMutation({
    mutationFn: ({ key, documentId }: { key: string; documentId: string | null }) =>
      api.post(`/insurance/claims/${id}/docs/use-existing`, { key, documentId }),
    onSuccess: (_r, v) => { toast.success(v.documentId ? 'Using the document already on file' : 'Unlinked'); refresh(); },
    onError: (e) => toast.error(apiErrorMessage(e)),
  });

  const deleteSlotFile = useMutation({
    mutationFn: (documentId: string) => api.delete(`/documents/${documentId}`),
    onSuccess: () => { toast.success('File removed'); refresh(); },
    onError: (e) => toast.error(apiErrorMessage(e)),
  });

  const submit = useMutation({
    mutationFn: () => api.post(`/insurance/claims/${id}/submit`, {}),
    onSuccess: () => { toast.success('Submitted to the insurer'); refresh(); },
    onError: (e) => toast.error(apiErrorMessage(e)),
  });

  const setStatus = useMutation({
    mutationFn: ({ status, settledInr }: { status: string; settledInr?: number }) =>
      api.patch(`/insurance/claims/${id}/status`, { status, ...(settledInr != null ? { settledInr } : {}) }),
    onSuccess: (_r, v) => {
      toast.success(v.status === 'SETTLED' ? 'Settlement recorded' : `Marked ${humanStatus(v.status).toLowerCase()}`);
      setSettleAmt('');
      refresh();
    },
    onError: (e) => toast.error(apiErrorMessage(e)),
  });

  const advance = useMutation({
    mutationFn: (v: { stage: string; note?: string; surveyorName?: string; surveyAt?: string }) =>
      api.post(`/insurance/claims/${id}/stage`, {
        stage: v.stage,
        ...(v.note ? { note: v.note } : {}),
        ...(v.surveyorName ? { surveyorName: v.surveyorName } : {}),
        ...(v.surveyAt ? { surveyAt: new Date(v.surveyAt).toISOString() } : {}),
      }),
    onSuccess: (r, v) => {
      toast.success(`Moved to ${stageMeta(v.stage).label}`);
      if (r?.data?.id) qc.setQueryData(['ins-claim', id], r.data);
      setStageForm(null);
      refresh();
    },
    onError: (e) => toast.error(apiErrorMessage(e)),
  });

  const logEvent = useMutation({
    mutationFn: (v: { kind: string; title: string; detail?: string; customerVisible?: boolean }) =>
      api.post(`/insurance/claims/${id}/events`, v),
    onSuccess: (_r, v) => {
      toast.success(v.kind === 'CALL' ? 'Call logged' : 'Note added');
      setNoteForm({ title: '', detail: '' });
      qc.invalidateQueries({ queryKey: ['ins-claim', id] });
    },
    onError: (e) => toast.error(apiErrorMessage(e)),
  });

  /* -------------------------------------------------------- view model */
  const fallbackClaim = degraded ? (list.data ?? []).find((c) => c.id === id) : undefined;
  const claim = detail.data ?? fallbackClaim;
  const busy = tick.isPending || submit.isPending || setStatus.isPending || advance.isPending
    || uploadSlot.isPending || useExisting.isPending || deleteSlotFile.isPending;

  const events: any[] = useMemo(
    () => (Array.isArray(claim?.events) ? claim.events : []),
    [claim],
  );

  const loading = detail.isLoading || (degraded && (list.isLoading || (!!fallbackClaim && policies.isLoading)));

  if (loading) {
    return (
      <div className="ds-stack" style={{ gap: 'var(--gap-section)' }}>
        <Skeleton rows={1} height={92} />
        <Skeleton rows={1} height={78} />
        <Skeleton rows={2} height={210} />
      </div>
    );
  }

  if (!claim) {
    return (
      <Card>
        <EmptyState
          icon={ShieldCheck}
          title="That claim is no longer in the book"
          body="It may have been removed, or the link is out of date. The claims list has everything currently open."
        />
        <div style={{ display: 'flex', justifyContent: 'center' }}>
          <Link className="btn-secondary" href="/insurance/claims">Back to claims</Link>
        </div>
      </Card>
    );
  }

  const status = String(claim.status ?? '').toUpperCase();
  const stage = String(claim.stage ?? STAGE_FROM_STATUS[status] ?? '').toUpperCase();
  const meta = stageMeta(stage);
  const rejected = stage === 'REJECTED' || status === 'REJECTED';

  // The detail endpoint returns the whole policy; the list fallback carries only
  // a fragment, so it is topped up from the policies list.
  const listPolicy = !detail.data ? (policies.data ?? []).find((p) => p.id === claim.policyId) : undefined;
  const policy: any = { ...(listPolicy ?? {}), ...(claim.policy ?? {}) };
  const policyId = policy.id ?? claim.policyId ?? null;
  const client: any = claim.client ?? claim.policy?.client ?? null;
  const clientName = client?.name ?? 'Client';
  const policyNo = policy.policyNo ?? '';

  const docs = docsOf(claim);
  const done = docs.filter(slotIn).length;
  const missing = docs.filter((d) => !slotIn(d));
  const pctIn = docs.length ? Math.round((done / docs.length) * 100) : 0;
  const editable = docsEditable(status);
  const readyToSubmit = allDocsIn(claim) && editable;

  const requested = params?.get('tab');
  const tab: Tab = (TABS as readonly string[]).includes(requested ?? '') ? (requested as Tab) : 'Overview';
  const tabHref = (t: Tab) => `/insurance/claims/${id}?tab=${encodeURIComponent(t)}`;

  const nextStage = NEXT_STAGE[stage] ?? null;
  const sla = slaText(claim.stageDueAt, claim.slaBreached);
  const noteEvents = events.filter((e) => ['NOTE', 'CALL', 'EMAIL'].includes(String(e.kind ?? '').toUpperCase()));

  const openStage = (target: string) => setStageForm({
    stage: target,
    note: '',
    surveyorName: claim.surveyorName ?? '',
    surveyAt: claim.surveyAt ? String(claim.surveyAt).slice(0, 16) : '',
  });

  /* ------------------------------------------------- status controls (legacy) */
  const statusControls = () => {
    const canReview = status === 'SUBMITTED';
    const canApprove = status === 'SUBMITTED' || status === 'UNDER_REVIEW';
    const canSettle = ['SUBMITTED', 'UNDER_REVIEW', 'APPROVED'].includes(status);
    if (!canReview && !canApprove && !canSettle) {
      return (
        <div className="ds-caption">
          {status === 'SETTLED' ? 'Settled and closed — nothing further to do.'
            : status === 'REJECTED' ? 'The insurer rejected this claim.'
              : 'Collect the documents, then submit the file to the insurer.'}
        </div>
      );
    }
    return (
      <div className="ds-stack">
        <div style={{ display: 'flex', gap: 'var(--s-2)', flexWrap: 'wrap' }}>
          {canReview && (
            <button className="btn-secondary btn-sm" disabled={busy}
              onClick={() => setStatus.mutate({ status: 'UNDER_REVIEW' })}>Mark under review</button>
          )}
          {canApprove && (
            <button className="btn-secondary btn-sm" disabled={busy}
              onClick={() => setStatus.mutate({ status: 'APPROVED' })}>Approve</button>
          )}
          {canSettle && (
            <button className="btn-secondary btn-sm" disabled={busy}
              onClick={() => setStatus.mutate({ status: 'REJECTED' })}>Reject</button>
          )}
        </div>
        {canSettle && (
          <div style={{ display: 'flex', gap: 'var(--s-3)', alignItems: 'flex-end', flexWrap: 'wrap' }}>
            <div style={{ flex: 1, minWidth: 180 }}>
              <Field label="Settlement amount" hint="What the insurer actually paid out.">
                <input
                  className="input" inputMode="numeric" placeholder="0"
                  value={settleAmt}
                  onChange={(e) => setSettleAmt(e.target.value.replace(/[^\d.]/g, ''))}
                />
              </Field>
            </div>
            <button
              className="btn-primary"
              disabled={busy || !Number(settleAmt)}
              onClick={() => setStatus.mutate({ status: 'SETTLED', settledInr: Number(settleAmt) })}
            >Record settlement</button>
          </div>
        )}
      </div>
    );
  };

  /* ------------------------------------------------------------ panes */
  const overview = (
    <div className="ds-stack" style={{ gap: 'var(--gap-section)' }}>
      <Card>
        <SectionTitle sub="What was claimed, and against which policy.">The incident</SectionTitle>
        <div className="ds-grid" style={{ gridTemplateColumns: 'repeat(auto-fit,minmax(150px,1fr))' }}>
          <Fact label="Incident date" value={fmtDate(claim.incidentDate)} />
          <Fact label="Registered" value={fmtDate(claim.createdAt)} />
          <Fact label="Sum insured" value={policy?.sumInsuredInr != null ? money(policy.sumInsuredInr) : '—'} />
          <Fact
            label="Settled amount"
            value={claim.settledInr != null ? money(claim.settledInr) : '—'}
            tone={claim.settledInr != null ? 'active' : undefined}
          />
        </div>
        {claim.description && (
          <>
            <hr className="ds-divider" style={{ margin: 'var(--s-5) 0 var(--s-4)' }} />
            <div className="ds-caption" style={{ marginBottom: 'var(--s-2)' }}>What happened</div>
            <p className="ds-body" style={{ margin: 0 }}>{claim.description}</p>
          </>
        )}
      </Card>

      <Card>
        <SectionTitle sub="The cover this claim is made against, and who it belongs to.">Policy and client</SectionTitle>
        <div className="ds-grid" style={{ gridTemplateColumns: 'repeat(auto-fit,minmax(150px,1fr))' }}>
          <Fact
            label="Client"
            value={client?.id
              ? <Link href={`/insurance/clients/${client.id}`} style={{ color: 'var(--ink)' }}>{clientName}</Link>
              : clientName}
          />
          <Fact
            label="Policy number"
            value={policyId && policyNo
              ? <Link href={`/insurance/policies/${policyId}`} style={{ color: 'var(--ink)' }}>{policyNo}</Link>
              : (policyNo || '—')}
          />
          <Fact label="Insurer" value={policy?.companyName ?? '—'} />
          <Fact label="Product" value={policy?.productName ?? '—'} />
          <Fact label="Premium" value={policy?.premiumInr != null ? money(policy.premiumInr) : '—'} />
          <Fact
            label="Cover period"
            value={policy?.startDate ? `${fmtDate(policy.startDate)} – ${fmtDate(policy.endDate)}` : '—'}
          />
          <Fact label="Phone" value={client?.phone ?? '—'} />
          <Fact label="Email" value={client?.email ?? '—'} />
        </div>
      </Card>

      <Card>
        <SectionTitle sub="Who is carrying the file, and where the money ended up.">Handling and settlement</SectionTitle>
        <div className="ds-grid" style={{ gridTemplateColumns: 'repeat(auto-fit,minmax(150px,1fr))' }}>
          <Fact label="Owner" value={claim.ownerName ?? 'Unassigned'} />
          <Fact label="Surveyor" value={claim.surveyorName ?? '—'} />
          <Fact label="Survey appointment" value={claim.surveyAt ? fmtDate(claim.surveyAt) : '—'} />
          <Fact label="Insurer reference" value={claim.insurerRef ?? '—'} />
          <Fact
            label="Settled"
            value={claim.settledInr != null ? money(claim.settledInr) : '—'}
            tone={claim.settledInr != null ? 'active' : undefined}
          />
          <Fact label="Settled on" value={claim.settledAt ? fmtDate(claim.settledAt) : '—'} />
        </div>
      </Card>

      <Card>
        <SectionTitle sub="Every move is recorded against the claim and shows on the board.">Move this claim on</SectionTitle>
        {statusControls()}
      </Card>
    </div>
  );

  const documents = (
    <div className="ds-stack" style={{ gap: 'var(--gap-section)' }}>
      <Card>
        <SectionTitle sub="The checklist comes from the product this policy was sold on.">
          Document checklist
        </SectionTitle>

        {docs.length === 0 ? (
          <EmptyState
            compact
            icon={FileText}
            title="No checklist on this claim"
            body="The product it was registered against carries no claim documents."
          />
        ) : (
          <>
            <div style={{ display: 'flex', alignItems: 'baseline', gap: 'var(--s-3)', marginBottom: 'var(--s-2)' }}>
              <span className="ds-h3">{done} of {docs.length} documents in</span>
              <span className="ds-caption ds-num" style={{ marginLeft: 'auto' }}>{pctIn}%</span>
            </div>
            <Progress pct={pctIn} tone={pctIn === 100 ? 'active' : 'renewal'} />

            {!editable && (
              <div className="ds-caption" style={{ marginTop: 'var(--s-3)' }}>
                The file is already with the insurer, so the checklist is locked.
              </div>
            )}

            <div style={{ marginTop: 'var(--s-4)' }}>
              {docs.map((d) => (
                <SlotRow
                  key={d.key}
                  doc={d}
                  locked={!editable}
                  busy={busy}
                  candidates={docOptions.data?.candidates?.[d.key] ?? []}
                  canUpload={storage.data?.configured ?? false}
                  accept={storage.data?.allowedMimeTypes?.join(',')}
                  maxBytes={storage.data?.maxBytes ?? 20 * 1024 * 1024}
                  onTick={(received) => tick.mutate({ key: d.key, received })}
                  onUpload={(file, key) => uploadSlot.mutate({ file, key })}
                  onUseExisting={(documentId) => useExisting.mutate({ key: d.key, documentId })}
                  onDeleteFile={(documentId) => deleteSlotFile.mutate(documentId)}
                />
              ))}
            </div>

            {readyToSubmit && (
              <button
                className="btn-primary"
                style={{ marginTop: 'var(--s-5)' }}
                disabled={busy}
                onClick={() => submit.mutate()}
              ><Send size={14} /> Submit to insurer</button>
            )}
          </>
        )}
      </Card>

      {missing.length > 0 && (
        <Card tone="renewal">
          <SectionTitle sub="The insurer will not open the file until these are in.">
            Missing
          </SectionTitle>
          <div className="ds-stack" style={{ gap: 0 }}>
            {missing.map((d) => (
              <div key={d.key} className="ds-list-row">
                <span className="ds-badge ds-tone-renewal">Outstanding</span>
                <span className="ds-body" style={{ color: 'var(--ink)', minWidth: 0 }}>{d.label}</span>
              </div>
            ))}
          </div>
        </Card>
      )}

      {/* Anything that does not answer a checklist slot — correspondence, a
          survey report, extra photos — still lives with the claim. Slotted
          files are hidden here so nothing appears twice on one screen. */}
      <Card>
        <DocumentsPanel relatedType="INS_CLAIM" relatedId={claim.id} title="Other files on this claim" unfiledOnly />
      </Card>
    </div>
  );

  const timeline = (
    <Card>
      <SectionTitle sub="Every stage move, call, document and insurer exchange, newest first.">History</SectionTitle>
      {events.length === 0 ? (
        <EmptyState
          compact
          icon={FileText}
          title="Nothing recorded yet"
          body="Stage moves are written here automatically; calls and notes land here as you log them."
        />
      ) : (
        <Timeline
          items={events.map((e) => ({
            at: e.at,
            title: e.title,
            detail: [e.detail, e.actorName ? `— ${e.actorName}` : null].filter(Boolean).join(' ') || undefined,
            tone: toneOf(e),
            icon: EVENT_ICON[String(e.kind ?? '').toUpperCase()] ?? StickyNote,
          }))}
        />
      )}
    </Card>
  );

  const isCall = noteKind === 'Log a call';
  const notes = (
    <div className="ds-stack" style={{ gap: 'var(--gap-section)' }}>
      <Card>
        <SectionTitle sub="Internal by default — nothing here reaches the client unless you say so.">
          Add to the file
        </SectionTitle>
        <div style={{ marginBottom: 'var(--s-4)' }}>
          <Segmented options={['Internal note', 'Log a call']} value={noteKind} onChange={setNoteKind} />
        </div>
        <div className="ds-stack">
          <Field label={isCall ? 'What the call was about' : 'Summary'} required>
            <input
              className="input"
              placeholder={isCall ? 'Called the client about the surveyor visit' : 'Insurer asked for the FIR copy'}
              value={noteForm.title}
              onChange={(e) => setNoteForm({ ...noteForm, title: e.target.value })}
            />
          </Field>
          <Field label="Detail" hint="Optional — the context the next person picking this file up will need.">
            <textarea
              className="input" rows={4}
              value={noteForm.detail}
              onChange={(e) => setNoteForm({ ...noteForm, detail: e.target.value })}
            />
          </Field>
          <div style={{ display: 'flex', gap: 'var(--s-2)' }}>
            <button
              className="btn-primary"
              disabled={logEvent.isPending || !noteForm.title.trim()}
              onClick={() => logEvent.mutate({
                kind: isCall ? 'CALL' : 'NOTE',
                title: noteForm.title.trim(),
                ...(noteForm.detail.trim() ? { detail: noteForm.detail.trim() } : {}),
                customerVisible: false,
              })}
            >{isCall ? <><Phone size={14} /> Log the call</> : <><StickyNote size={14} /> Add note</>}</button>
            {(noteForm.title || noteForm.detail) && (
              <button className="btn-ghost" onClick={() => setNoteForm({ title: '', detail: '' })}>Clear</button>
            )}
          </div>
        </div>
      </Card>

      <Card>
        <SectionTitle sub="Notes, calls and emails on this file.">Conversation</SectionTitle>
        {noteEvents.length === 0 ? (
          <EmptyState
            compact
            icon={StickyNote}
            title="No notes yet"
            body="Anything you log here stays with the claim, so the next person picking it up has the history."
          />
        ) : (
          <div className="ds-stack" style={{ gap: 0 }}>
            {noteEvents.map((e) => {
              const Icon = EVENT_ICON[String(e.kind ?? '').toUpperCase()] ?? StickyNote;
              return (
                <div key={e.id} className="ds-list-row" style={{ alignItems: 'flex-start' }}>
                  <span className={`ds-entity-icon ds-tone-${toneOf(e)}`}><Icon size={15} /></span>
                  <div style={{ minWidth: 0, flex: 1 }}>
                    <div style={{ display: 'flex', alignItems: 'baseline', gap: 'var(--s-2)', flexWrap: 'wrap' }}>
                      <span className="ds-h3">{e.title}</span>
                      <Badge tone={e.customerVisible ? 'info' : 'neutral'} dot={false}>
                        {e.customerVisible ? 'Visible to client' : 'Internal only'}
                      </Badge>
                    </div>
                    {e.detail && <div className="ds-small ds-muted" style={{ marginTop: 'var(--s-1)' }}>{e.detail}</div>}
                    <div className="ds-caption" style={{ marginTop: 'var(--s-1)' }}>
                      {fmtDate(e.at)}{e.actorName ? ` · ${e.actorName}` : ''}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </Card>

      {/* The checklist says WHICH documents are needed; this is where the
          actual files live. Both matter — a ticked box with no file attached
          is what a claim gets rejected over. */}
      <Card>
        <DocumentsPanel relatedType="INS_CLAIM" relatedId={claim.id} title="Files on this claim" />
      </Card>
    </div>
  );

  /* ----------------------------------------------------------- rail */
  const rail = (
    <div className="ds-stack" style={{ gap: 'var(--s-3)' }}>
      <Card>
        <SectionTitle>At a glance</SectionTitle>
        <div className="ds-stack" style={{ gap: 0 }}>
          {[
            ['Stage', meta.label],
            ['Status', humanStatus(claim.status)],
            ['Owner', claim.ownerName ?? 'Unassigned'],
            ['Client', clientName],
            ['Policy', policyNo || '—'],
            ['Insurer', policy?.companyName ?? '—'],
            ['Incident', fmtDate(claim.incidentDate)],
            ['Registered', fmtDate(claim.createdAt)],
            ['Documents', docs.length ? `${done} of ${docs.length}` : '—'],
            ['Surveyor', claim.surveyorName ?? '—'],
            ['Insurer reference', claim.insurerRef ?? '—'],
            ['Settled', claim.settledInr != null ? money(claim.settledInr) : '—'],
            ['Settled on', claim.settledAt ? fmtDate(claim.settledAt) : '—'],
          ].map(([label, value]) => (
            <div className="ds-list-row" key={label}>
              <span className="ds-small">{label}</span>
              <span className="ds-list-row-meta">{value}</span>
            </div>
          ))}
        </div>
      </Card>

      {docs.length > 0 && (
        <Card>
          <div style={{ display: 'flex', alignItems: 'baseline', gap: 'var(--s-2)', marginBottom: 'var(--s-3)' }}>
            <span className="ds-caption">Checklist</span>
            <span className="ds-caption ds-num" style={{ marginLeft: 'auto' }}>{pctIn}%</span>
          </div>
          <Progress pct={pctIn} tone={pctIn === 100 ? 'active' : 'renewal'} />
          <div className="ds-caption" style={{ marginTop: 'var(--s-3)' }}>
            {missing.length === 0
              ? 'Everything is in — the file can go to the insurer.'
              : `${missing.length} still outstanding.`}
          </div>
        </Card>
      )}
    </div>
  );

  const stageTarget = stageForm ? stageMeta(stageForm.stage) : null;

  return (
    <div className="ds-stack" style={{ gap: 'var(--gap-section)' }}>
      {/* ------------------------------------------------- record header */}
      <div>
        <Link href="/insurance/claims" className="ds-viewall" style={{ marginBottom: 'var(--s-3)' }}>
          <ArrowLeft size={13} /> All claims
        </Link>
        <div style={{ display: 'flex', alignItems: 'flex-start', gap: 'var(--s-4)', flexWrap: 'wrap' }}>
          <div style={{ minWidth: 0, flex: 1 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--s-3)', flexWrap: 'wrap' }}>
              <h1 className="ds-h1">{claim.claimNo}</h1>
              <Badge tone={meta.tone}>{meta.label}</Badge>
              <Badge tone={toneForClaimStatus(claim.status)}>{humanStatus(claim.status)}</Badge>
            </div>
            <div className="ds-caption" style={{ marginTop: 'var(--s-2)' }}>
              {client?.id
                ? <Link href={`/insurance/clients/${client.id}`} style={{ color: 'var(--ink-2)' }}>{clientName}</Link>
                : clientName}
              {policyNo && (
                <>
                  {' · '}
                  <Link href={`/insurance/policies/${policyId}`} style={{ color: 'var(--ink-2)' }}>
                    {policyNo}
                  </Link>
                </>
              )}
            </div>

            {/* The SLA sentence: which stage, since when, due when. */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--s-2)', flexWrap: 'wrap', marginTop: 'var(--s-3)' }}>
              <span className="ds-small">
                In <b style={{ color: 'var(--ink)' }}>{meta.label}</b>
                {claim.stageEnteredAt ? ` since ${fmtShort(claim.stageEnteredAt)}` : ''}
                {claim.stageDueAt ? ` · due ${fmtShort(claim.stageDueAt)}` : ''}
                {!claim.stageEnteredAt && !claim.stageDueAt && meta.slaDays != null ? ` · ${meta.slaDays} day SLA` : ''}
              </span>
              {claim.slaBreached
                ? <Badge tone="expired">SLA breached</Badge>
                : sla && <Badge tone={sla.tone}>{sla.text}</Badge>}
            </div>
          </div>

          <div style={{ flex: 'none', display: 'flex', gap: 'var(--s-2)', flexWrap: 'wrap' }}>
            {readyToSubmit && (
              <button className="btn-secondary" disabled={busy} onClick={() => submit.mutate()}>
                <Send size={14} /> Submit to insurer
              </button>
            )}
            {nextStage && (
              <button className="btn-primary" disabled={busy} onClick={() => openStage(nextStage)}>
                Move to {stageMeta(nextStage).label} <ArrowRight size={14} />
              </button>
            )}
            <StagePicker current={stage} onPick={openStage} busy={busy} />
          </div>
        </div>
      </div>

      {/* ---------------------------------------------------- lifecycle */}
      <Card>
        {rejected ? (
          <div className="ds-stack" style={{ gap: 'var(--s-2)' }}>
            <div className="ds-h3 ds-fg-expired">The insurer rejected this claim</div>
            <p className="ds-body" style={{ margin: 0, maxWidth: '62ch' }}>
              A rejected file leaves the lifecycle rather than sitting somewhere on it, so the stage rail is
              not shown. If new evidence comes in, take it up with the insurer and move the claim back onto
              the machine with “Change stage”.
            </p>
          </div>
        ) : (
          <>
            <div className="ds-scroll-x" style={{ paddingBottom: 'var(--s-2)' }}>
              <div style={{ minWidth: 700 }}>
                <Stepper steps={MAIN_PATH.map((s) => s.label)} current={Math.max(stepIndex(stage), 0)} />
              </div>
            </div>
            {stage === 'ADDITIONAL_DOCS' && (
              <div className="ds-caption" style={{ marginTop: 'var(--s-3)' }}>
                The insurer has asked for additional documents, so the file has looped back out of review —
                it sits beside Insurer review rather than past it.
              </div>
            )}
          </>
        )}
      </Card>

      {/* --------------------------------------------------------- tabs */}
      <div className="ds-subnav">
        {TABS.map((t) => (
          <Link
            key={t}
            href={tabHref(t)}
            scroll={false}
            className="ds-subnav-item"
            data-active={tab === t}
            aria-current={tab === t}
          >
            {t}
            {t === 'Documents' && docs.length > 0 && <span className="ds-count">{done}/{docs.length}</span>}
            {t === 'Timeline' && events.length > 0 && <span className="ds-count">{events.length}</span>}
            {t === 'Notes' && noteEvents.length > 0 && <span className="ds-count">{noteEvents.length}</span>}
          </Link>
        ))}
      </div>

      {/* --------------------------------------------------------- body */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: narrow ? '1fr' : 'minmax(0,1fr) 300px',
          gap: 'var(--gap-section)',
          alignItems: 'start',
        }}
      >
        <div style={{ minWidth: 0 }}>
          {tab === 'Overview' && overview}
          {tab === 'Documents' && documents}
          {tab === 'Timeline' && timeline}
          {tab === 'Notes' && notes}
        </div>
        {rail}
      </div>

      {/* ------------------------------------------------- stage drawer */}
      <Drawer
        open={!!stageForm}
        onClose={() => setStageForm(null)}
        title={stageTarget ? `Move to ${stageTarget.label}` : 'Move stage'}
        subtitle={stageTarget?.slaDays != null
          ? `The stage clock restarts — ${stageTarget.slaDays} day${stageTarget.slaDays === 1 ? '' : 's'} to clear it.`
          : 'A terminal stage — the SLA clock stops here.'}
        width={480}
      >
        {stageForm && (
          <div className="ds-stack">
            <Field label="Note" hint="Optional. It lands on the timeline against this move.">
              <textarea
                className="input" rows={3}
                placeholder="Surveyor confirmed for Tuesday morning."
                value={stageForm.note}
                onChange={(e) => setStageForm({ ...stageForm, note: e.target.value })}
              />
            </Field>

            {stageForm.stage === 'SURVEY_SCHEDULED' && (
              <>
                <Field label="Surveyor" required hint="Who the insurer appointed.">
                  <input
                    className="input"
                    placeholder="R. Menon"
                    value={stageForm.surveyorName}
                    onChange={(e) => setStageForm({ ...stageForm, surveyorName: e.target.value })}
                  />
                </Field>
                <Field label="Survey appointment" required>
                  <input
                    type="datetime-local"
                    className="input"
                    value={stageForm.surveyAt}
                    onChange={(e) => setStageForm({ ...stageForm, surveyAt: e.target.value })}
                  />
                </Field>
              </>
            )}

            <div style={{ display: 'flex', gap: 'var(--s-2)' }}>
              <button
                className="btn-primary"
                disabled={advance.isPending
                  || (stageForm.stage === 'SURVEY_SCHEDULED' && (!stageForm.surveyorName.trim() || !stageForm.surveyAt))}
                onClick={() => advance.mutate({
                  stage: stageForm.stage,
                  note: stageForm.note.trim() || undefined,
                  surveyorName: stageForm.stage === 'SURVEY_SCHEDULED' ? stageForm.surveyorName.trim() : undefined,
                  surveyAt: stageForm.stage === 'SURVEY_SCHEDULED' ? stageForm.surveyAt : undefined,
                })}
              >Move to {stageTarget?.label}</button>
              <button className="btn-secondary" onClick={() => setStageForm(null)}>Cancel</button>
            </div>
          </div>
        )}
      </Drawer>
    </div>
  );
}
