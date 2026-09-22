'use client';

import { useState } from 'react';
import { useMutation, useQuery } from '@tanstack/react-query';
import { toast } from 'sonner';
import { X, Printer, FileText } from 'lucide-react';
import { api, apiErrorMessage } from '@/lib/api';
import { DocKind, GeneratedDoc, splitTokens } from '../documents-client';

const card: React.CSSProperties = { background: 'var(--surface)', border: '1px solid var(--line-soft)', borderRadius: 16 };

/**
 * Produce one document about one record.
 *
 * The fields shown are the token contract minus everything the RECORD supplies —
 * because those are filled from the database and anything typed over them is
 * discarded server-side anyway. Showing a salary box that silently does nothing
 * would be worse than showing none.
 */
export function GenerateDocumentModal({
  subjectId, subjectLabel, kinds, onClose,
}: {
  subjectId: string;
  subjectLabel: string;
  kinds: { key: string; label: string }[];
  onClose: () => void;
}) {
  const [kind, setKind] = useState(kinds[0]?.key ?? '');
  const [fields, setFields] = useState<Record<string, string>>({});
  const [doc, setDoc] = useState<GeneratedDoc | null>(null);

  // The contract for the chosen kind, so the form asks for the right prose.
  // Cached under the same key the templates screen uses, so opening this modal
  // after visiting that screen costs no request at all.
  const { data: allKinds } = useQuery({
    queryKey: ['doc-kinds'],
    queryFn: async () => (await api.get<DocKind[]>('/documents/generated/kinds')).data,
  });
  const contract = (allKinds ?? []).find((k) => k.key === kind);
  // Record-supplied prefixes are filled from the database; asking for them here
  // would be a box whose value the server throws away.
  const RECORD = ['org.', 'doc.', 'client.', 'engagement.', 'employee.', 'invoice.', 'quotation.'];
  const asks = contract
    ? splitTokens(contract.tokens).scalars.filter((t) => !RECORD.some((p) => t.startsWith(p)))
    : [];

  const generate = useMutation({
    mutationFn: async () => (await api.post<GeneratedDoc>(`/documents/generated/${kind}/${subjectId}`, {
      tokens: fields,
    })).data,
    onSuccess: (d) => { setDoc(d); toast.success('Document ready'); },
    onError: (e) => toast.error(apiErrorMessage(e)),
  });

  const print = () => {
    if (!doc) return;
    const w = window.open('', '_blank');
    if (!w) { toast.error('Allow pop-ups to print'); return; }
    w.document.write(doc.html);
    w.document.close();
    w.focus();
    w.print();
  };

  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 70, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }}>
      <div style={{ position: 'absolute', inset: 0, background: 'rgba(20,15,12,.42)' }} onClick={onClose} />
      <div style={{ ...card, position: 'relative', zIndex: 1, width: 860, maxWidth: '100%', maxHeight: '88vh', overflow: 'auto', padding: 22, borderRadius: 18 }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
          <div>
            <div style={{ fontWeight: 700, fontSize: 16 }}>New document</div>
            <div style={{ fontSize: 12.5, color: 'var(--ink-3)' }}>for {subjectLabel}</div>
          </div>
          <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--ink-3)' }}><X size={20} /></button>
        </div>

        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 14 }}>
          {kinds.map((k) => (
            <button key={k.key} className={kind === k.key ? 'btn-primary' : 'btn-secondary'} style={{ height: 32, fontSize: 12.5 }}
              onClick={() => { setKind(k.key); setDoc(null); setFields({}); }}>{k.label}</button>
          ))}
        </div>

        {!doc && (
          <>
            {asks.length === 0 && (
              <div style={{ fontSize: 13, color: 'var(--ink-3)', marginBottom: 12 }}>
                Everything on this document comes from the record. Nothing to fill in.
              </div>
            )}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(240px,1fr))', gap: 10 }}>
              {asks.map((t) => (
                <div key={t}>
                  <label className="label">{t.split('.').pop()?.replace(/([A-Z])/g, ' $1')}</label>
                  <input className="input" value={fields[t] ?? ''} onChange={(e) => setFields((s) => ({ ...s, [t]: e.target.value }))} />
                </div>
              ))}
            </div>
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10, marginTop: 18 }}>
              <button className="btn-secondary" onClick={onClose}>Cancel</button>
              <button className="btn-primary" disabled={!kind || generate.isPending} onClick={() => generate.mutate()}>
                <FileText size={14} /> Produce
              </button>
            </div>
          </>
        )}

        {doc && (
          <>
            <div style={{ border: '1px solid var(--line-soft)', borderRadius: 10, padding: 22, background: '#fff', color: '#111', overflowX: 'auto' }}
              // Server-rendered from a template the API sanitised with an
              // allow-list on save, and every value escaped on the way out.
              dangerouslySetInnerHTML={{ __html: doc.html }} />
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10, marginTop: 16 }}>
              <button className="btn-secondary" onClick={() => setDoc(null)}>Back</button>
              <button className="btn-primary" onClick={print}><Printer size={14} /> Print</button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
