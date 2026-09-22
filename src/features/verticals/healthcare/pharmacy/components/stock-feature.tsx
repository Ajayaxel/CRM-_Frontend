'use client';

import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { PackagePlus, Plus, X, AlertTriangle } from 'lucide-react';
import { api, apiErrorMessage } from '@/lib/api';
import { Drug, DrugBatch, expFmt, money } from '../pharmacy-client';

const card: React.CSSProperties = { background: 'var(--surface)', border: '1px solid var(--line-soft)', borderRadius: 16 };

export function StockFeature() {
  const qc = useQueryClient();
  const [compose, setCompose] = useState(false);
  const { data } = useQuery({ queryKey: ['pharm-expiry'], queryFn: async () => (await api.get<DrugBatch[]>('/pharmacy/expiry?days=180')).data });

  return (
    <div style={{ animation: 'fadeUp .4s ease' }}>
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 18 }}>
        <div>
          <h1 style={{ fontSize: 26, fontWeight: 700, letterSpacing: '-.02em', margin: 0 }}>Stock &amp; Expiry</h1>
          <p style={{ fontSize: 14, color: 'var(--ink-2)', margin: '6px 0 0' }}>Receive stock in batches and watch expiry — sold first-expiry-first-out.</p>
        </div>
        <button className="btn-primary" onClick={() => setCompose(true)}><PackagePlus size={15} /> Receive stock</button>
      </div>

      <div className="eyebrow" style={{ marginBottom: 10 }}>Expiring within 6 months</div>
      {(data ?? []).length === 0 && <div style={{ ...card, padding: 44, textAlign: 'center', color: 'var(--ink-3)', fontSize: 14 }}>No batches expiring soon. Add stock to get started.</div>}
      <div style={{ ...card, overflow: 'hidden' }}>
        {(data ?? []).map((b, i) => (
          <div key={b.id} style={{ display: 'grid', gridTemplateColumns: '1.6fr 1fr 0.8fr 1fr', gap: 12, padding: '13px 18px', borderTop: i > 0 ? '1px solid var(--line-soft)' : 'none', alignItems: 'center' }}>
            <div>
              <div style={{ fontWeight: 600, fontSize: 13.5 }}>{b.drug?.brand ?? b.drug?.genericName}</div>
              <div style={{ fontSize: 11.5, color: 'var(--ink-3)', fontFamily: 'var(--mono)' }}>{b.drug?.code} · {b.batchNo}</div>
            </div>
            <div style={{ fontSize: 13 }}>
              <span style={{ color: b.expired ? 'var(--danger,#c0392b)' : 'var(--ink-2)', fontWeight: b.expired ? 700 : 400 }}>{b.expired ? 'EXPIRED' : `Exp ${expFmt(b.expiryDate)}`}</span>
            </div>
            <div style={{ fontSize: 13, fontWeight: 700 }}>{b.quantity}</div>
            <div style={{ textAlign: 'right' }}>
              {b.expired
                ? <span className="badge" style={{ background: 'var(--danger,#c0392b)', color: '#fff' }}><AlertTriangle size={11} style={{ marginRight: 3 }} />Remove</span>
                : <span className="badge" style={{ background: 'var(--gold-bg,#fdf2e2)', color: 'var(--gold,#c67c1e)' }}>Expiring</span>}
            </div>
          </div>
        ))}
      </div>

      {compose && <BatchModal onClose={() => setCompose(false)} onDone={() => { qc.invalidateQueries({ queryKey: ['pharm-expiry'] }); qc.invalidateQueries({ queryKey: ['pharm-drugs'] }); qc.invalidateQueries({ queryKey: ['pharm-stats'] }); }} />}
    </div>
  );
}

function BatchModal({ onClose, onDone }: { onClose: () => void; onDone: () => void }) {
  const { data: drugs } = useQuery({ queryKey: ['pharm-drugs'], queryFn: async () => (await api.get<Drug[]>('/pharmacy/drugs')).data });
  const [f, setF] = useState<any>({ drugId: '', batchNo: '', expiryDate: '2027-01-01', quantity: '', mrpInr: '' });
  const set = (k: string, v: any) => setF((s: any) => ({ ...s, [k]: v }));
  const create = useMutation({ mutationFn: () => api.post('/pharmacy/batches', { drugId: f.drugId, batchNo: f.batchNo, expiryDate: f.expiryDate, quantity: Number(f.quantity) || 0, mrpInr: f.mrpInr ? Number(f.mrpInr) : undefined }), onSuccess: () => { onDone(); toast.success('Stock received'); onClose(); }, onError: (e) => toast.error(apiErrorMessage(e)) });
  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 60, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }}>
      <div style={{ position: 'absolute', inset: 0, background: 'rgba(20,15,12,.42)' }} onClick={onClose} />
      <div style={{ ...card, position: 'relative', zIndex: 1, width: 480, maxWidth: '100%', padding: 22, borderRadius: 18 }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}><div style={{ fontWeight: 700, fontSize: 16 }}>Receive stock</div><button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--ink-3)' }}><X size={20} /></button></div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          <div><label className="label">Drug</label><select className="input" value={f.drugId} onChange={(e) => set('drugId', e.target.value)}><option value="">Select…</option>{(drugs ?? []).map((d) => <option key={d.id} value={d.id}>{d.brand ?? d.genericName} · {d.code}</option>)}</select></div>
          <div style={{ display: 'flex', gap: 10 }}>
            <div style={{ flex: 1 }}><label className="label">Batch no.</label><input className="input" value={f.batchNo} onChange={(e) => set('batchNo', e.target.value)} placeholder="B2406" /></div>
            <div style={{ flex: 1 }}><label className="label">Expiry</label><input className="input" type="date" value={f.expiryDate} onChange={(e) => set('expiryDate', e.target.value)} /></div>
          </div>
          <div style={{ display: 'flex', gap: 10 }}>
            <div style={{ flex: 1 }}><label className="label">Quantity</label><input className="input" type="number" value={f.quantity} onChange={(e) => set('quantity', e.target.value)} /></div>
            <div style={{ flex: 1 }}><label className="label">MRP ₹</label><input className="input" type="number" value={f.mrpInr} onChange={(e) => set('mrpInr', e.target.value)} /></div>
          </div>
        </div>
        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10, marginTop: 18 }}><button className="btn-secondary" onClick={onClose}>Cancel</button><button className="btn-primary" disabled={!f.drugId || !f.batchNo || !f.quantity || create.isPending} onClick={() => create.mutate()}>Receive</button></div>
      </div>
    </div>
  );
}
