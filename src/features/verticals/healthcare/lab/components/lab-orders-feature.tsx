'use client';

import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { ClipboardList, Plus, X, TestTube, FileCheck2, Send, Beaker } from 'lucide-react';
import { api, apiErrorMessage } from '@/lib/api';
import { Patient, patientName } from '@/features/verticals/healthcare/practice';
import {
  COLLECTION_LABEL, FLAG_META, LAB_COLS, LabOrder, LabOrderStatus, LabStats, LabTest, STATUS_META, money,
} from '../lab-client';

const card: React.CSSProperties = { background: 'var(--surface)', border: '1px solid var(--line-soft)', borderRadius: 16 };

export function LabOrdersFeature() {
  const qc = useQueryClient();
  const [compose, setCompose] = useState(false);
  const [open, setOpen] = useState<string | null>(null);
  const { data: stats } = useQuery({ queryKey: ['lab-stats'], queryFn: async () => (await api.get<LabStats>('/lab/stats')).data });
  const { data: board } = useQuery({ queryKey: ['lab-board'], queryFn: async () => (await api.get<{ status: LabOrderStatus; orders: LabOrder[] }[]>('/lab/orders/board')).data });
  const refresh = () => { qc.invalidateQueries({ queryKey: ['lab-board'] }); qc.invalidateQueries({ queryKey: ['lab-stats'] }); };
  const columns = board ?? LAB_COLS.map((status) => ({ status, orders: [] as LabOrder[] }));

  return (
    <div style={{ animation: 'fadeUp .4s ease' }}>
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 18 }}>
        <div>
          <h1 style={{ fontSize: 26, fontWeight: 700, letterSpacing: '-.02em', margin: 0 }}>Lab Orders</h1>
          <p style={{ fontSize: 14, color: 'var(--ink-2)', margin: '6px 0 0' }}>Order → specimen → result → verified report → delivery.</p>
        </div>
        <button className="btn-primary" onClick={() => setCompose(true)}><Plus size={15} /> New order</button>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 12, marginBottom: 18 }}>
        <Stat label="Tests" value={stats?.tests ?? 0} />
        <Stat label="In pipeline" value={stats?.pendingOrders ?? 0} accent="var(--brand,#132376)" />
        <Stat label="Reports delivered" value={stats?.reportsDelivered ?? 0} accent="var(--success)" />
        <Stat label="Revenue (mo)" value={money(stats?.revenueThisMonth ?? 0)} accent="var(--gold,#E6A23C)" />
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(6,minmax(0,1fr))', gap: 10, alignItems: 'start' }}>
        {columns.map((col) => (
          <div key={col.status}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 8, padding: '0 2px' }}>
              <span style={{ width: 8, height: 8, borderRadius: '50%', background: STATUS_META[col.status].color }} />
              <span style={{ fontSize: 11.5, fontWeight: 700, color: 'var(--ink-2)' }}>{STATUS_META[col.status].label}</span>
              <span style={{ fontSize: 11, color: 'var(--ink-3)', marginLeft: 'auto' }}>{col.orders.length}</span>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {col.orders.map((o) => (
                <div key={o.id} style={{ ...card, padding: 11, cursor: 'pointer' }} onClick={() => setOpen(o.id)}>
                  <div style={{ fontFamily: 'var(--mono)', fontSize: 11, color: 'var(--ink-3)' }}>{o.reference}</div>
                  <div style={{ fontWeight: 700, fontSize: 12.5, marginTop: 2 }}>{o.patient ? patientName(o.patient) : ''}</div>
                  <div style={{ fontSize: 10.5, color: 'var(--ink-3)', marginTop: 4 }}>{o.items.length} test{o.items.length > 1 ? 's' : ''} · {money(o.totalInr)}</div>
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>

      {compose && <OrderModal onClose={() => setCompose(false)} onDone={refresh} />}
      {open && <OrderDrawer id={open} onClose={() => setOpen(null)} onChanged={refresh} />}
    </div>
  );
}

function Stat({ label, value, accent }: { label: string; value: number | string; accent?: string }) {
  return <div style={{ ...card, padding: 16 }}><div style={{ fontSize: 20, fontWeight: 800, color: accent ?? 'var(--ink-1)' }}>{value}</div><div style={{ fontSize: 12, color: 'var(--ink-3)', marginTop: 2 }}>{label}</div></div>;
}

function OrderDrawer({ id, onClose, onChanged }: { id: string; onClose: () => void; onChanged: () => void }) {
  const qc = useQueryClient();
  const [addResult, setAddResult] = useState(false);
  const { data: o } = useQuery({ queryKey: ['lab-order', id], queryFn: async () => (await api.get<LabOrder>(`/lab/orders/${id}`)).data });
  const refresh = () => { qc.invalidateQueries({ queryKey: ['lab-order', id] }); onChanged(); };
  const act = useMutation({ mutationFn: (path: string) => api.post(`/lab/orders/${id}/${path}`, {}), onSuccess: (_d, path) => { refresh(); toast.success(path === 'collect' ? 'Specimen collected' : path === 'verify' ? 'Report verified' : 'Report delivered'); }, onError: (e) => toast.error(apiErrorMessage(e)) });
  if (!o) return null;
  const st = STATUS_META[o.status];

  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 60, display: 'flex', justifyContent: 'flex-end' }}>
      <div style={{ position: 'absolute', inset: 0, background: 'rgba(20,15,12,.42)' }} onClick={onClose} />
      <div style={{ ...card, position: 'relative', zIndex: 1, width: 520, maxWidth: '100%', height: '100%', borderRadius: 0, padding: 24, overflowY: 'auto' }}>
        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 4 }}>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}><span style={{ fontFamily: 'var(--mono)', fontSize: 13 }}>{o.reference}</span><span className="badge" style={{ background: 'var(--surface-2)', color: st.color }}>{st.label}</span></div>
            <div style={{ fontSize: 13, color: 'var(--ink-3)', marginTop: 4 }}>{o.patient ? `${patientName(o.patient)} · ${o.patient.mrn}` : ''} · {COLLECTION_LABEL[o.collectionType]}</div>
          </div>
          <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--ink-3)' }}><X size={20} /></button>
        </div>

        <div className="eyebrow" style={{ margin: '18px 0 8px' }}>Tests ordered</div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
          {o.items.map((it, i) => <div key={i} style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, background: 'var(--surface-2)', borderRadius: 8, padding: '7px 10px' }}><span><span style={{ fontFamily: 'var(--mono)', fontSize: 11, color: 'var(--ink-3)', marginRight: 6 }}>{it.code}</span>{it.name}</span><span>{money(it.priceInr)}</span></div>)}
        </div>

        {(o.specimens ?? []).length > 0 && (
          <>
            <div className="eyebrow" style={{ margin: '18px 0 8px' }}>Specimen</div>
            {(o.specimens ?? []).map((s) => <div key={s.id} style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 12.5 }}><Beaker size={14} style={{ color: 'var(--ink-3)' }} /><span style={{ fontFamily: 'var(--mono)' }}>{s.barcode}</span><span style={{ color: 'var(--ink-3)' }}>· {s.sampleType} · {s.status}</span></div>)}
          </>
        )}

        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', margin: '18px 0 8px' }}>
          <span className="eyebrow">Results</span>
          {o.status !== 'DELIVERED' && <button className="btn-secondary" style={{ height: 28, fontSize: 12 }} onClick={() => setAddResult(true)}><Plus size={12} /> Enter result</button>}
        </div>
        {(o.results ?? []).length === 0 && <div style={{ fontSize: 12.5, color: 'var(--ink-3)' }}>No results entered yet.</div>}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
          {(o.results ?? []).map((r) => {
            const fm = FLAG_META[r.flag];
            return (
              <div key={r.id} style={{ display: 'flex', alignItems: 'center', gap: 8, background: 'var(--surface-2)', borderRadius: 8, padding: '7px 10px' }}>
                <span style={{ fontSize: 12.5, fontWeight: 600, flex: 1 }}>{r.testName}</span>
                <span style={{ fontSize: 13, fontWeight: 700, fontFamily: 'var(--mono)' }}>{r.value}{r.unit ? ` ${r.unit}` : ''}</span>
                {r.refRange && <span style={{ fontSize: 10.5, color: 'var(--ink-3)', fontFamily: 'var(--mono)' }}>({r.refRange})</span>}
                <span className="badge" style={{ background: fm.bg, color: fm.fg }}>{fm.label}</span>
              </div>
            );
          })}
        </div>

        {/* Workflow actions */}
        <div style={{ display: 'flex', gap: 8, marginTop: 22, flexWrap: 'wrap' }}>
          {o.status === 'ORDERED' && <button className="btn-primary" onClick={() => act.mutate('collect')}><TestTube size={14} /> Collect specimen</button>}
          {(o.status === 'RESULTED' || o.status === 'PROCESSING' || o.status === 'COLLECTED') && (o.results ?? []).length > 0 && <button className="btn-primary" onClick={() => act.mutate('verify')}><FileCheck2 size={14} /> Verify report</button>}
          {o.status === 'VERIFIED' && <>
            {o.reportUrl && <span style={{ fontSize: 12, color: 'var(--ink-3)', alignSelf: 'center', fontFamily: 'var(--mono)' }}>{o.reportUrl}</span>}
            <button className="btn-primary" onClick={() => act.mutate('deliver')}><Send size={14} /> Deliver report</button>
          </>}
          {o.status === 'DELIVERED' && <span style={{ fontSize: 13, color: 'var(--success)', fontWeight: 600 }}>✓ Report delivered</span>}
        </div>

        {addResult && <ResultModal orderId={id} tests={o.items} onClose={() => setAddResult(false)} onDone={refresh} />}
      </div>
    </div>
  );
}

function ResultModal({ orderId, tests, onClose, onDone }: { orderId: string; tests: { code: string; name: string }[]; onClose: () => void; onDone: () => void }) {
  const [f, setF] = useState<any>({ testName: tests[0]?.name ?? '', testCode: tests[0]?.code ?? '', value: '', unit: '', refRange: '', flag: '' });
  const set = (k: string, v: any) => setF((s: any) => ({ ...s, [k]: v }));
  const create = useMutation({ mutationFn: () => api.post(`/lab/orders/${orderId}/results`, { testName: f.testName, testCode: f.testCode || undefined, value: f.value, unit: f.unit || undefined, refRange: f.refRange || undefined, flag: f.flag || undefined }), onSuccess: () => { onDone(); toast.success('Result saved'); onClose(); }, onError: (e) => toast.error(apiErrorMessage(e)) });
  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 70, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }}>
      <div style={{ position: 'absolute', inset: 0, background: 'rgba(20,15,12,.42)' }} onClick={onClose} />
      <div style={{ ...card, position: 'relative', zIndex: 1, width: 460, maxWidth: '100%', padding: 22, borderRadius: 18 }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}><div style={{ fontWeight: 700, fontSize: 16 }}>Enter result</div><button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--ink-3)' }}><X size={20} /></button></div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          <div><label className="label">Test</label><select className="input" value={f.testName} onChange={(e) => { const t = tests.find((x) => x.name === e.target.value); set('testName', e.target.value); set('testCode', t?.code ?? ''); }}>{tests.map((t) => <option key={t.code} value={t.name}>{t.name}</option>)}</select></div>
          <div style={{ display: 'flex', gap: 10 }}>
            <div style={{ flex: 1 }}><label className="label">Value</label><input className="input" value={f.value} onChange={(e) => set('value', e.target.value)} placeholder="95" /></div>
            <div style={{ width: 90 }}><label className="label">Unit</label><input className="input" value={f.unit} onChange={(e) => set('unit', e.target.value)} placeholder="mg/dL" /></div>
          </div>
          <div style={{ display: 'flex', gap: 10 }}>
            <div style={{ flex: 1 }}><label className="label">Ref range</label><input className="input" value={f.refRange} onChange={(e) => set('refRange', e.target.value)} placeholder="70-100" /></div>
            <div style={{ flex: 1 }}><label className="label">Flag (auto)</label><select className="input" value={f.flag} onChange={(e) => set('flag', e.target.value)}><option value="">Auto</option><option value="NORMAL">Normal</option><option value="HIGH">High</option><option value="LOW">Low</option><option value="CRITICAL">Critical</option></select></div>
          </div>
        </div>
        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10, marginTop: 18 }}><button className="btn-secondary" onClick={onClose}>Cancel</button><button className="btn-primary" disabled={!f.value || create.isPending} onClick={() => create.mutate()}>Save</button></div>
      </div>
    </div>
  );
}

function OrderModal({ onClose, onDone }: { onClose: () => void; onDone: () => void }) {
  const { data: patients } = useQuery({ queryKey: ['practice-patients', ''], queryFn: async () => (await api.get<Patient[]>('/practice/patients')).data });
  const { data: tests } = useQuery({ queryKey: ['lab-tests'], queryFn: async () => (await api.get<LabTest[]>('/lab/tests')).data });
  const [patientId, setPatientId] = useState('');
  const [collectionType, setCollectionType] = useState('WALK_IN');
  const [picked, setPicked] = useState<string[]>([]);
  const toggle = (id: string) => setPicked((p) => (p.includes(id) ? p.filter((x) => x !== id) : [...p, id]));
  const items = (tests ?? []).filter((t) => picked.includes(t.id));
  const total = items.reduce((s, t) => s + t.priceInr, 0);
  const create = useMutation({
    mutationFn: () => api.post('/lab/orders', { patientId, collectionType, items: items.map((t) => ({ testId: t.id, code: t.code, name: t.name, priceInr: t.priceInr, sampleType: t.sampleType })) }),
    onSuccess: () => { onDone(); toast.success('Order created'); onClose(); }, onError: (e) => toast.error(apiErrorMessage(e)),
  });
  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 60, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }}>
      <div style={{ position: 'absolute', inset: 0, background: 'rgba(20,15,12,.42)' }} onClick={onClose} />
      <div style={{ ...card, position: 'relative', zIndex: 1, width: 520, maxWidth: '100%', maxHeight: '90vh', overflowY: 'auto', padding: 22, borderRadius: 18 }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}><div style={{ fontWeight: 700, fontSize: 16 }}>New lab order</div><button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--ink-3)' }}><X size={20} /></button></div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          <div style={{ display: 'flex', gap: 10 }}>
            <div style={{ flex: 1 }}><label className="label">Patient</label><select className="input" value={patientId} onChange={(e) => setPatientId(e.target.value)}><option value="">Select…</option>{(patients ?? []).map((p) => <option key={p.id} value={p.id}>{patientName(p)} · {p.mrn}</option>)}</select></div>
            <div style={{ flex: 1 }}><label className="label">Collection</label><select className="input" value={collectionType} onChange={(e) => setCollectionType(e.target.value)}><option value="WALK_IN">Walk-in</option><option value="HOME_COLLECTION">Home collection</option><option value="REFERRED">Referred</option></select></div>
          </div>
          <div>
            <label className="label">Tests</label>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 5, maxHeight: 220, overflowY: 'auto' }}>
              {(tests ?? []).map((t) => (
                <label key={t.id} style={{ display: 'flex', alignItems: 'center', gap: 8, background: picked.includes(t.id) ? 'var(--brand-bg,#e9ecfb)' : 'var(--surface-2)', borderRadius: 8, padding: '8px 10px', cursor: 'pointer', fontSize: 13 }}>
                  <input type="checkbox" checked={picked.includes(t.id)} onChange={() => toggle(t.id)} />
                  <span style={{ fontFamily: 'var(--mono)', fontSize: 11, color: 'var(--ink-3)' }}>{t.code}</span>
                  <span style={{ flex: 1 }}>{t.name}</span>
                  <span>{money(t.priceInr)}</span>
                </label>
              ))}
              {(tests ?? []).length === 0 && <div style={{ fontSize: 12.5, color: 'var(--ink-3)' }}>Add tests to your catalogue first.</div>}
            </div>
          </div>
          <div style={{ textAlign: 'right', fontWeight: 800, fontSize: 16 }}>{money(total)}</div>
        </div>
        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10, marginTop: 18 }}><button className="btn-secondary" onClick={onClose}>Cancel</button><button className="btn-primary" disabled={!patientId || !items.length || create.isPending} onClick={() => create.mutate()}>Create order</button></div>
      </div>
    </div>
  );
}
