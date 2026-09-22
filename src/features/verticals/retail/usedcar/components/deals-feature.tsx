'use client';

import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { Repeat2, Landmark, Plus, X, ChevronRight } from 'lucide-react';
import { api, apiErrorMessage } from '@/lib/api';
import {
  FIN_META, FinanceLead, FinanceStatus, TRADEIN_META, TradeIn, TradeInStatus, money,
} from '../usedcar-client';

const card: React.CSSProperties = { background: 'var(--surface)', border: '1px solid var(--line-soft)', borderRadius: 16 };
const NEXT_TI: Partial<Record<TradeInStatus, TradeInStatus>> = { EVALUATING: 'OFFERED', OFFERED: 'ACCEPTED' };
const NEXT_FIN: Partial<Record<FinanceStatus, FinanceStatus>> = { SUBMITTED: 'APPROVED', APPROVED: 'DISBURSED' };

export function DealsFeature() {
  const qc = useQueryClient();
  const [modal, setModal] = useState<null | 'tradein' | 'finance'>(null);
  const { data: tradeIns } = useQuery({ queryKey: ['car-tradeins'], queryFn: async () => (await api.get<TradeIn[]>('/cars/trade-ins')).data });
  const { data: finance } = useQuery({ queryKey: ['car-finance'], queryFn: async () => (await api.get<FinanceLead[]>('/cars/finance')).data });
  const setTi = useMutation({ mutationFn: ({ id, status }: { id: string; status: TradeInStatus }) => api.patch(`/cars/trade-ins/${id}/status`, { status }), onSuccess: () => { qc.invalidateQueries({ queryKey: ['car-tradeins'] }); toast.success('Updated'); } });
  const setFin = useMutation({ mutationFn: ({ id, status }: { id: string; status: FinanceStatus }) => api.patch(`/cars/finance/${id}/status`, { status }), onSuccess: () => { qc.invalidateQueries({ queryKey: ['car-finance'] }); qc.invalidateQueries({ queryKey: ['car-stats'] }); toast.success('Updated'); } });

  return (
    <div style={{ animation: 'fadeUp .4s ease' }}>
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 18 }}>
        <div>
          <h1 style={{ fontSize: 26, fontWeight: 700, letterSpacing: '-.02em', margin: 0 }}>Trade-ins &amp; Finance</h1>
          <p style={{ fontSize: 14, color: 'var(--ink-2)', margin: '6px 0 0' }}>Trade-in valuations and buyer finance applications.</p>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <button className="btn-secondary" onClick={() => setModal('tradein')}><Repeat2 size={15} /> Trade-in</button>
          <button className="btn-primary" onClick={() => setModal('finance')}><Landmark size={15} /> Finance lead</button>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, alignItems: 'start' }}>
        <div>
          <div className="eyebrow" style={{ marginBottom: 10, display: 'flex', alignItems: 'center', gap: 6 }}><Repeat2 size={13} /> Trade-in valuations</div>
          {(tradeIns ?? []).length === 0 && <div style={{ ...card, padding: 20, color: 'var(--ink-3)', fontSize: 13 }}>No trade-ins.</div>}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {(tradeIns ?? []).map((t) => {
              const m = TRADEIN_META[t.status];
              return (
                <div key={t.id} style={{ ...card, padding: 14 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                    <div><div style={{ fontWeight: 700, fontSize: 13.5 }}>{t.vehicleDesc}</div><div style={{ fontSize: 12, color: 'var(--ink-3)', marginTop: 1 }}>{t.customerName}</div></div>
                    <span className="badge" style={{ background: m.bg, color: m.fg }}>{m.label}</span>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 10 }}>
                    <span style={{ fontWeight: 800, fontSize: 15 }}>{money(t.offerInr)}</span>
                    {NEXT_TI[t.status] && <button className="btn-secondary" style={{ height: 28, fontSize: 11.5 }} onClick={() => setTi.mutate({ id: t.id, status: NEXT_TI[t.status]! })}>{TRADEIN_META[NEXT_TI[t.status]!].label} <ChevronRight size={11} /></button>}
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        <div>
          <div className="eyebrow" style={{ marginBottom: 10, display: 'flex', alignItems: 'center', gap: 6 }}><Landmark size={13} /> Finance applications</div>
          {(finance ?? []).length === 0 && <div style={{ ...card, padding: 20, color: 'var(--ink-3)', fontSize: 13 }}>No finance leads.</div>}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {(finance ?? []).map((fl) => {
              const m = FIN_META[fl.status];
              return (
                <div key={fl.id} style={{ ...card, padding: 14 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                    <div><div style={{ fontWeight: 700, fontSize: 13.5 }}>{fl.customerName}</div><div style={{ fontSize: 12, color: 'var(--ink-3)', marginTop: 1 }}>{fl.vehicleLabel ?? 'Vehicle finance'} · {fl.tenureMonths} mo</div></div>
                    <span className="badge" style={{ background: m.bg, color: m.fg }}>{m.label}</span>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 10 }}>
                    <span style={{ fontWeight: 800, fontSize: 15 }}>{money(fl.amountInr)}</span>
                    {NEXT_FIN[fl.status] && <button className="btn-secondary" style={{ height: 28, fontSize: 11.5 }} onClick={() => setFin.mutate({ id: fl.id, status: NEXT_FIN[fl.status]! })}>{FIN_META[NEXT_FIN[fl.status]!].label} <ChevronRight size={11} /></button>}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {modal === 'tradein' && <TradeInModal onClose={() => setModal(null)} onDone={() => qc.invalidateQueries({ queryKey: ['car-tradeins'] })} />}
      {modal === 'finance' && <FinanceModal onClose={() => setModal(null)} onDone={() => { qc.invalidateQueries({ queryKey: ['car-finance'] }); qc.invalidateQueries({ queryKey: ['car-stats'] }); }} />}
    </div>
  );
}

function TradeInModal({ onClose, onDone }: { onClose: () => void; onDone: () => void }) {
  const [f, setF] = useState<any>({ customerName: '', vehicleDesc: '', offerInr: '' });
  const set = (k: string, v: any) => setF((s: any) => ({ ...s, [k]: v }));
  const create = useMutation({ mutationFn: () => api.post('/cars/trade-ins', { customerName: f.customerName, vehicleDesc: f.vehicleDesc, offerInr: f.offerInr ? Number(f.offerInr) : undefined }), onSuccess: () => { onDone(); toast.success('Trade-in added'); onClose(); }, onError: (e) => toast.error(apiErrorMessage(e)) });
  return <Overlay title="New trade-in" onClose={onClose}>
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      <div><label className="label">Customer</label><input className="input" value={f.customerName} onChange={(e) => set('customerName', e.target.value)} /></div>
      <div><label className="label">Their vehicle</label><input className="input" value={f.vehicleDesc} onChange={(e) => set('vehicleDesc', e.target.value)} placeholder="2018 Hyundai i20 · 45k km" /></div>
      <div style={{ width: 160 }}><label className="label">Offer ₹</label><input className="input" type="number" value={f.offerInr} onChange={(e) => set('offerInr', e.target.value)} /></div>
    </div>
    <Actions disabled={!f.customerName || !f.vehicleDesc || create.isPending} onClose={onClose} onSubmit={() => create.mutate()} label="Add" />
  </Overlay>;
}

function FinanceModal({ onClose, onDone }: { onClose: () => void; onDone: () => void }) {
  const [f, setF] = useState<any>({ customerName: '', vehicleLabel: '', amountInr: '', tenureMonths: '60' });
  const set = (k: string, v: any) => setF((s: any) => ({ ...s, [k]: v }));
  const create = useMutation({ mutationFn: () => api.post('/cars/finance', { customerName: f.customerName, vehicleLabel: f.vehicleLabel || undefined, amountInr: Number(f.amountInr), tenureMonths: f.tenureMonths ? Number(f.tenureMonths) : undefined }), onSuccess: () => { onDone(); toast.success('Finance lead added'); onClose(); }, onError: (e) => toast.error(apiErrorMessage(e)) });
  return <Overlay title="New finance lead" onClose={onClose}>
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      <div><label className="label">Customer</label><input className="input" value={f.customerName} onChange={(e) => set('customerName', e.target.value)} /></div>
      <div><label className="label">Vehicle</label><input className="input" value={f.vehicleLabel} onChange={(e) => set('vehicleLabel', e.target.value)} placeholder="2021 Maruti Swift ZXi" /></div>
      <div style={{ display: 'flex', gap: 10 }}>
        <div style={{ flex: 1 }}><label className="label">Loan amount ₹</label><input className="input" type="number" value={f.amountInr} onChange={(e) => set('amountInr', e.target.value)} /></div>
        <div style={{ width: 120 }}><label className="label">Tenure (mo)</label><input className="input" type="number" value={f.tenureMonths} onChange={(e) => set('tenureMonths', e.target.value)} /></div>
      </div>
    </div>
    <Actions disabled={!f.customerName || !f.amountInr || create.isPending} onClose={onClose} onSubmit={() => create.mutate()} label="Add" />
  </Overlay>;
}

function Actions({ disabled, onClose, onSubmit, label }: { disabled: boolean; onClose: () => void; onSubmit: () => void; label: string }) {
  return <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10, marginTop: 18 }}><button className="btn-secondary" onClick={onClose}>Cancel</button><button className="btn-primary" disabled={disabled} onClick={onSubmit}>{label}</button></div>;
}
function Overlay({ children, onClose, title }: { children: React.ReactNode; onClose: () => void; title: string }) {
  return <div style={{ position: 'fixed', inset: 0, zIndex: 70, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }}>
    <div style={{ position: 'absolute', inset: 0, background: 'rgba(20,15,12,.42)' }} onClick={onClose} />
    <div style={{ ...card, position: 'relative', zIndex: 1, width: 480, maxWidth: '100%', padding: 22, borderRadius: 18 }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}><div style={{ fontWeight: 700, fontSize: 16 }}>{title}</div><button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--ink-3)' }}><X size={20} /></button></div>
      {children}
    </div>
  </div>;
}
