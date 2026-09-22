'use client';

import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { Plus, X, FileText, Receipt } from 'lucide-react';
import { api, apiErrorMessage } from '@/lib/api';
import { useAuth } from '@/features/foundation/auth';
import { GenerateDocumentModal } from '@/features/capabilities/documents-studio';
import { EngagementDocument, ENGAGEMENT_DOC_KINDS, Paged, money } from '../consulting-client';

const card: React.CSSProperties = { background: 'var(--surface)', border: '1px solid var(--line-soft)', borderRadius: 16 };

/**
 * Quotations, invoices and letters, where the work is.
 *
 * The list is one pile on purpose: a quotation, an ad-hoc invoice and the
 * invoice Phase 5 raises when a milestone is billed are three different code
 * paths and one question to the person looking at the engagement — what have we
 * sent this client?
 */
export function EngagementDocumentsPanel({ engagementId, clientName }: { engagementId: string; clientName: string }) {
  const qc = useQueryClient();
  const { hasPermission } = useAuth();
  const canSell = hasPermission('consulting.sales');
  const canBill = hasPermission('consulting.manage');
  const [raise, setRaise] = useState<'QUOTATION' | 'INVOICE' | null>(null);
  const [letters, setLetters] = useState(false);

  const { data } = useQuery({
    queryKey: ['engagement-documents', engagementId],
    queryFn: async () => (await api.get<Paged<EngagementDocument>>(`/consulting/engagements/${engagementId}/documents`)).data,
  });
  const refresh = () => qc.invalidateQueries({ queryKey: ['engagement-documents', engagementId] });
  const rows = data?.data ?? [];

  return (
    <div style={{ marginTop: 12, paddingTop: 12, borderTop: '1px solid var(--line-soft)' }} onClick={(e) => e.stopPropagation()}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 8, flexWrap: 'wrap' }}>
        <span style={{ fontSize: 11.5, fontWeight: 700, color: 'var(--ink-2)' }}>Documents</span>
        <div style={{ marginLeft: 'auto', display: 'flex', gap: 6 }}>
          {canSell && <button className="btn-secondary" style={{ height: 24, fontSize: 10.5 }} onClick={() => setRaise('QUOTATION')}><Plus size={10} /> Quotation</button>}
          {canBill && <button className="btn-secondary" style={{ height: 24, fontSize: 10.5 }} onClick={() => setRaise('INVOICE')}><Plus size={10} /> Invoice</button>}
          <button className="btn-secondary" style={{ height: 24, fontSize: 10.5 }} onClick={() => setLetters(true)}><FileText size={10} /> Letter</button>
        </div>
      </div>

      {rows.length === 0 && <div style={{ fontSize: 11, color: 'var(--ink-3)' }}>Nothing sent yet.</div>}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
        {rows.map((d) => (
          <div key={d.id} style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 11.5 }}>
            <Receipt size={11} style={{ color: 'var(--ink-3)', flexShrink: 0 }} />
            <span style={{ fontWeight: 650 }}>{d.number}</span>
            <span className="badge" style={{ background: 'var(--surface-2)', color: 'var(--ink-3)', fontSize: 9.5 }}>
              {d.kind === 'QUOTATION' ? 'quote' : 'invoice'}
            </span>
            {d.milestone && <span style={{ color: 'var(--ink-3)' }}>{d.milestone.title}</span>}
            <span style={{ marginLeft: 'auto', fontWeight: 600 }}>{money(d.totalInr)}</span>
          </div>
        ))}
      </div>

      {raise && (
        <RaiseDocumentModal
          engagementId={engagementId} kind={raise} clientName={clientName}
          onClose={() => setRaise(null)} onDone={refresh}
        />
      )}
      {letters && (
        <GenerateDocumentModal
          subjectId={engagementId} subjectLabel={clientName}
          kinds={ENGAGEMENT_DOC_KINDS.map((k) => ({ key: k.key, label: k.label }))}
          onClose={() => setLetters(false)}
        />
      )}
    </div>
  );
}

type Line = { description: string; quantity: string; unitPriceInr: string };

/**
 * No total field, deliberately. Tax and totals are computed server-side from
 * the tenant's regime — a client-supplied total is a number nobody checked, and
 * the API would ignore it anyway.
 */
function RaiseDocumentModal({
  engagementId, kind, clientName, onClose, onDone,
}: { engagementId: string; kind: 'QUOTATION' | 'INVOICE'; clientName: string; onClose: () => void; onDone: () => void }) {
  const [lines, setLines] = useState<Line[]>([{ description: '', quantity: '1', unitPriceInr: '' }]);
  const [notes, setNotes] = useState('');
  const setLine = (i: number, k: keyof Line, v: string) =>
    setLines((s) => s.map((l, j) => (i === j ? { ...l, [k]: v } : l)));

  const create = useMutation({
    mutationFn: () => api.post(`/consulting/engagements/${engagementId}/${kind === 'QUOTATION' ? 'quotation' : 'invoice'}`, {
      notes: notes || undefined,
      items: lines
        .filter((l) => l.description.trim() && l.unitPriceInr)
        .map((l) => ({ description: l.description, quantity: Number(l.quantity || 1), unitPriceInr: Number(l.unitPriceInr) })),
    }),
    onSuccess: () => { onDone(); toast.success(kind === 'QUOTATION' ? 'Quotation raised' : 'Invoice raised'); onClose(); },
    onError: (e) => toast.error(apiErrorMessage(e)),
  });

  const net = lines.reduce((s, l) => s + (Number(l.quantity || 1) * Number(l.unitPriceInr || 0)), 0);
  const usable = lines.some((l) => l.description.trim() && l.unitPriceInr);

  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 70, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }}>
      <div style={{ position: 'absolute', inset: 0, background: 'rgba(20,15,12,.42)' }} onClick={onClose} />
      <div style={{ ...card, position: 'relative', zIndex: 1, width: 640, maxWidth: '100%', padding: 22, borderRadius: 18 }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 4 }}>
          <div style={{ fontWeight: 700, fontSize: 16 }}>New {kind === 'QUOTATION' ? 'quotation' : 'invoice'}</div>
          <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--ink-3)' }}><X size={20} /></button>
        </div>
        <div style={{ fontSize: 12.5, color: 'var(--ink-3)', marginBottom: 14 }}>for {clientName}</div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {lines.map((l, i) => (
            <div key={i} style={{ display: 'flex', gap: 8 }}>
              <input className="input" style={{ flex: 1 }} placeholder="Description" value={l.description} onChange={(e) => setLine(i, 'description', e.target.value)} />
              <input className="input" style={{ width: 70 }} type="number" placeholder="Qty" value={l.quantity} onChange={(e) => setLine(i, 'quantity', e.target.value)} />
              <input className="input" style={{ width: 120 }} type="number" placeholder="Rate ₹" value={l.unitPriceInr} onChange={(e) => setLine(i, 'unitPriceInr', e.target.value)} />
            </div>
          ))}
        </div>
        <button className="btn-secondary" style={{ height: 28, fontSize: 11.5, marginTop: 8 }}
          onClick={() => setLines((s) => [...s, { description: '', quantity: '1', unitPriceInr: '' }])}>
          <Plus size={11} /> Add line
        </button>

        <div style={{ marginTop: 12 }}>
          <label className="label">Notes</label>
          <textarea className="input" style={{ minHeight: 60, paddingTop: 8, resize: 'vertical' }} value={notes} onChange={(e) => setNotes(e.target.value)} />
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginTop: 16 }}>
          <div style={{ fontSize: 12.5, color: 'var(--ink-3)' }}>
            Net {money(net)} · tax added by the books
          </div>
          <div style={{ marginLeft: 'auto', display: 'flex', gap: 10 }}>
            <button className="btn-secondary" onClick={onClose}>Cancel</button>
            <button className="btn-primary" disabled={!usable || create.isPending} onClick={() => create.mutate()}>Raise</button>
          </div>
        </div>
      </div>
    </div>
  );
}
