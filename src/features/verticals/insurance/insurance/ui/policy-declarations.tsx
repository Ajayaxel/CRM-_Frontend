'use client';

import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { FileSignature } from 'lucide-react';
import { toast } from 'sonner';
import { api, apiErrorMessage } from '@/lib/api';
import { useAuthStore } from '@/features/foundation/auth/store/auth-store';
import { openDocument } from './open-document';
import { Badge, Card, Skeleton } from './kit';
import { DeclarationDrawer } from './declarations-panel';
import { declarationTypeForCategory } from './declaration-types';

/**
 * The signed declaration, listed among the policy's documents.
 *
 * It is NOT a file and there is no upload for it. The row is the record; the
 * PDF is rendered from that row on demand by the printer added in fd84e74. A
 * stored copy would be a second artefact able to disagree with the record it
 * came from, and the one somebody opens years later would be whichever they
 * happened to click — so this shows the declaration where people look for the
 * paperwork while keeping exactly one source of truth.
 *
 * Sits beside DocumentsPanel rather than inside it: that panel is about
 * uploading and deleting objects in a bucket, and neither verb applies here.
 *
 * It also RAISES one, which the quote panel cannot do once its quote has
 * converted. Raising at the quote is the right shape for new business, but a
 * quote-scoped declaration created after issue is stamped with `quoteId` and no
 * `policyId` — so it never appears here, and "which declaration backs this
 * policy?" answers none. `POST policies/:id/declaration` is the honest path for
 * anything collected after cover was written, and until now nothing in the UI
 * called it.
 */
export function PolicyDeclarations({
  clientId, policyId, category,
}: { clientId?: string | null; policyId: string; category?: string | null }) {
  const qc = useQueryClient();
  const [openId, setOpenId] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const token = useAuthStore((s) => s.accessToken);

  const q = useQuery({
    queryKey: ['ins-client-documents', clientId],
    queryFn: async () => (await api.get(`/insurance/clients/${clientId}/documents`)).data,
    enabled: !!clientId,
  });

  const raise = useMutation({
    mutationFn: async () => (await api.post(`/insurance/policies/${policyId}/declaration`)).data,
    onSuccess: () => {
      toast.success('Declaration raised against this policy — send it to the customer next');
      qc.invalidateQueries({ queryKey: ['ins-client-documents', clientId] });
      qc.invalidateQueries({ queryKey: ['ins-client-declarations', clientId] });
    },
    onError: (e) => toast.error(apiErrorMessage(e)),
  });

  if (!clientId) return null;
  if (q.isLoading) return <Skeleton rows={1} height={70} />;

  const policy = (q.data?.policies ?? []).find((p: any) => p.id === policyId);
  const rows: any[] = policy?.declarations ?? [];
  // The category the API reports for this policy is the authority; the prop is
  // only there for callers that render before the documents call lands.
  const type = declarationTypeForCategory(policy?.category ?? category);
  // Signed disclosures on this client that carry no policy. One of them may well
  // be this policy's — raised on the quote after it converted — but nothing in
  // the data says which, so this names the situation instead of guessing.
  const unlinked: any[] = q.data?.unlinkedDeclarations ?? [];

  // Nothing to show and nothing to offer: a product that takes no declaration.
  if (!rows.length && !type) return null;

  if (!rows.length) {
    return (
      <Card>
        <div className="ds-caption-upper" style={{ marginBottom: 10 }}>Declarations</div>
        <p className="ds-caption" style={{ marginTop: 0 }}>
          No declaration is linked to this policy.
          {unlinked.length > 0 && (
            <> {unlinked.length === 1 ? 'One signed declaration' : `${unlinked.length} signed declarations`} on this
            client {unlinked.length === 1 ? 'is' : 'are'} held against a quote rather than a policy
            ({unlinked.map((d) => d.reference).join(', ')}) — raised after the cover was written, so
            {unlinked.length === 1 ? ' it' : ' they'} never carried onto it.</>
          )}
        </p>
        <button className="btn-primary btn-sm" disabled={raise.isPending} onClick={() => raise.mutate()}>
          {raise.isPending ? 'Raising…' : `Raise ${type === 'MOTOR' ? 'motor' : 'health'} declaration`}
        </button>
      </Card>
    );
  }

  return (
    <>
      <Card>
        <div className="ds-caption-upper" style={{ marginBottom: 10 }}>Declarations</div>
        <div style={{ display: 'grid', gap: 10 }}>
          {rows.map((d) => (
            <div key={d.id} style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <FileSignature size={15} aria-hidden="true" style={{ color: 'var(--ink-3)' }} />
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontWeight: 600 }}>{d.name}</div>
                <div className="ds-caption">
                  {d.reference}
                  {d.version > 1 ? ` · revision ${d.version}` : ''}
                  {' · signed by the customer, not uploaded'}
                </div>
              </div>
              <Badge tone={d.status === 'REVIEWED' ? 'active' : 'sales'}>{d.status}</Badge>
              <button className="btn-secondary btn-sm" onClick={() => setOpenId(d.id)}>View declaration</button>
              <button
                className="btn-secondary btn-sm"
                disabled={busy === d.id}
                onClick={async () => {
                  setBusy(d.id);
                  try {
                    await openDocument(`/api${d.href}`, token);
                  } catch (e: any) {
                    toast.error(e?.message ?? 'Could not open the declaration');
                  } finally {
                    setBusy(null);
                  }
                }}
              >
                {busy === d.id ? 'Opening…' : 'Download PDF'}
              </button>
            </div>
          ))}
        </div>
      </Card>
      <DeclarationDrawer id={openId} open={!!openId} onClose={() => setOpenId(null)} />
    </>
  );
}
