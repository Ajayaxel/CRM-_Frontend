'use client';

import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { Car, HeartPulse, Send } from 'lucide-react';
import { api, apiErrorMessage } from '@/lib/api';
import { Badge, Card, Skeleton } from './kit';
import { DeclarationDrawer, statusTone, type Declaration } from './declarations-panel';
import { DECLARATION_LABEL, DECLARATION_WHY, declarationTypeForCategory } from './declaration-types';

/**
 * Raising the health declaration, from the quote it belongs to.
 *
 * This is where it has to happen. A disclosure dated after issue describes
 * cover that was already written, so the moment to ask is while the quote is
 * still on the desk — and this panel is the only thing that makes that possible
 * without an API call.
 *
 * WHICH declaration is decided by the quote's category, never by this panel.
 * A health quote gets the medical set, a motor quote the vehicle set, and a
 * product that takes neither shows nothing at all — offering the wrong form
 * would collect the wrong facts convincingly, which is worse than collecting
 * none. The server re-derives the same rule and refuses a mismatch, so this is
 * only deciding what to OFFER.
 */
export function QuoteDeclarationPanel({
  quoteId, clientId, category, converted,
}: { quoteId: string; clientId?: string | null; category?: string | null; converted?: boolean }) {
  const qc = useQueryClient();
  const [openId, setOpenId] = useState<string | null>(null);

  const type = declarationTypeForCategory(category);

  // Read through the client's list rather than adding a by-quote endpoint: the
  // declaration a quote has is one of the client's, and one source is easier to
  // keep honest than two.
  const q = useQuery<Declaration[]>({
    queryKey: ['ins-client-declarations', clientId],
    queryFn: async () => (await api.get(`/insurance/clients/${clientId}/declarations`)).data,
    enabled: !!type && !!clientId,
  });

  const mine = (q.data ?? []).filter((d) => d.quote?.id === quoteId || d.quote?.reference != null);
  const existing = (q.data ?? []).find((d) => d.quote?.id === quoteId) ?? null;

  const raise = useMutation({
    mutationFn: async () => (await api.post(`/insurance/quotes/${quoteId}/declaration`)).data,
    onSuccess: () => {
      toast.success('Declaration raised — send it to the customer next');
      qc.invalidateQueries({ queryKey: ['ins-client-declarations', clientId] });
    },
    onError: (e) => toast.error(apiErrorMessage(e)),
  });

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

  if (!type) return null;
  if (q.isLoading) return <Skeleton rows={1} height={80} />;

  const s = existing ? statusTone(existing.status) : null;
  const declared = existing
    ? Object.values(existing.answers ?? {}).filter((a) => a?.declared).length
    : 0;

  return (
    <>
      <Card>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          {type === 'MOTOR'
            ? <Car size={16} aria-hidden="true" style={{ color: 'var(--ink-3)' }} />
            : <HeartPulse size={16} aria-hidden="true" style={{ color: 'var(--ink-3)' }} />}
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontWeight: 650 }}>{DECLARATION_LABEL[type]}</div>
            <div className="ds-caption">
              {existing
                ? `${existing.reference}${existing.version > 1 ? ` · revision ${existing.version}` : ''}`
                : DECLARATION_WHY[type]}
            </div>
          </div>
          {s && <Badge tone={s.tone}>{s.label}</Badge>}
        </div>

        {existing?.submittedAt && (
          <div className="ds-caption" style={{ marginTop: 8 }}>
            {declared === 0 ? 'Nothing declared' : `${declared} condition${declared === 1 ? '' : 's'} declared`}
            {' · '}signed by {existing.signedName ?? 'the customer'}
          </div>
        )}

        {/* Once the quote has produced a policy, raising here is the wrong half
            of a deliberate two-path design. `createForQuote` stamps `quoteId`
            and leaves `policyId` null, and the link that would fill it in runs
            at issue and has already been and gone — so the disclosure would
            hang off a converted quote and never appear on the cover it was
            collected for. The policy record calls `createForPolicy`, whose
            whole purpose is "collected after cover was written". */}
        {converted && !existing && (
          <p className="ds-caption" style={{ marginTop: 10, marginBottom: 0 }}>
            This quote has been issued. Raise the declaration from the policy record instead — one raised here now
            would be filed against the quote and would not appear on the policy.
          </p>
        )}

        <div style={{ display: 'flex', gap: 8, marginTop: 12, flexWrap: 'wrap' }}>
          {!existing && !converted && (
            <button className="btn-primary btn-sm" disabled={raise.isPending} onClick={() => raise.mutate()}>
              {raise.isPending ? 'Raising…' : `Raise ${type === 'MOTOR' ? 'motor' : 'health'} declaration`}
            </button>
          )}
          {existing && ['DRAFT'].includes(existing.status) && (
            <button className="btn-primary btn-sm" disabled={send.isPending} onClick={() => send.mutate(existing.id)}>
              <Send size={13} /> {send.isPending ? 'Sending…' : 'Send to customer'}
            </button>
          )}
          {existing && existing.status === 'SUBMITTED' && (
            <button className="btn-primary btn-sm" disabled={review.isPending} onClick={() => review.mutate(existing.id)}>
              {review.isPending ? 'Saving…' : 'Mark reviewed'}
            </button>
          )}
          {existing && (
            <button className="btn-secondary btn-sm" onClick={() => setOpenId(existing.id)}>View declaration</button>
          )}
        </div>

        {existing && ['SENT', 'IN_PROGRESS'].includes(existing.status) && (
          <p className="ds-caption" style={{ marginTop: 10, marginBottom: 0 }}>
            The customer completes this in their own portal — there is no public link to share, which is deliberate for
                        {type === 'MOTOR' ? 'the customer’s own information.' : 'medical information.'}
          </p>
        )}
      </Card>
      <DeclarationDrawer id={openId} open={!!openId} onClose={() => setOpenId(null)} />
    </>
  );
}
