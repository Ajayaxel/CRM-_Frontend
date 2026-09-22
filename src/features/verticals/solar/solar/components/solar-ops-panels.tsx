'use client';

import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { Package, HardHat, Receipt, TrendingUp, Check, Plus, Truck, ClipboardList, Sun, FileText, Sparkles, Copy, Send } from 'lucide-react';
import { api, apiErrorMessage } from '@/lib/api';
import { MR_STATUS_LABEL, MaterialRequest, Milestone, Profitability, WorkOrder, fmtMoney } from '../solar-client';

const card: React.CSSProperties = { background: 'var(--surface)', border: '1px solid var(--line-soft)', borderRadius: 16 };
const box: React.CSSProperties = { background: 'var(--surface-2)', borderRadius: 10, padding: '10px 12px', marginBottom: 8 };

function Head({ icon: Icon, title, action }: { icon: any; title: string; action?: React.ReactNode }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 9 }}>
      <Icon size={14} style={{ color: 'var(--ink-3)' }} />
      <div style={{ fontWeight: 700, fontSize: 13 }}>{title}</div>
      <div style={{ flex: 1 }} />
      {action}
    </div>
  );
}
const Muted = ({ children }: { children: React.ReactNode }) => <div style={{ fontSize: 12.5, color: 'var(--ink-3)' }}>{children}</div>;

// ================= E2/A4 · Site survey =================
/**
 * Survey capture. This is the gate to DESIGN: without a completed survey carrying
 * consumption and a usable roof area the project cannot be sized, so it has to be
 * fillable here rather than only over the API.
 */
export function SurveyPanel({ projectId, onChanged }: { projectId: string; onChanged?: () => void }) {
  const qc = useQueryClient();
  const key = ['solar-project', projectId];
  const { data } = useQuery({ queryKey: key, queryFn: async () => (await api.get<any>(`/solar/projects/${projectId}`)).data });
  const surveys: any[] = data?.surveys ?? [];
  const latest = surveys[0];
  const done = surveys.find((x) => x.completedAt);

  const [open, setOpen] = useState(false);
  const [f, setF] = useState({ surveyorName: '', scheduledAt: '', consumptionMode: 'units' as 'units' | 'bill',
    monthlyUnitsKwh: '', monthlyBillInr: '', usableAreaSqm: '', tiltDeg: '', azimuthDeg: '', shadingPct: '', notes: '' });
  const set = (k: string, v: string) => setF((s2) => ({ ...s2, [k]: v }));
  const refresh = () => { qc.invalidateQueries({ queryKey: key }); onChanged?.(); };

  const create = useMutation({
    mutationFn: async () => {
      const body: any = {
        surveyorName: f.surveyorName || undefined,
        scheduledAt: f.scheduledAt ? new Date(f.scheduledAt).toISOString() : undefined,
        usableAreaSqm: Number(f.usableAreaSqm) || undefined,
        tiltDeg: f.tiltDeg ? Number(f.tiltDeg) : undefined,
        azimuthDeg: f.azimuthDeg ? Number(f.azimuthDeg) : undefined,
        shadingPct: f.shadingPct ? Number(f.shadingPct) : undefined,
        notes: f.notes || undefined,
      };
      if (f.consumptionMode === 'units') body.monthlyUnitsKwh = Number(f.monthlyUnitsKwh) || undefined;
      else body.monthlyBillInr = Number(f.monthlyBillInr) || undefined;
      const created = (await api.post<any>(`/solar/projects/${projectId}/surveys`, body)).data;
      // Recording and completing are one action here — a surveyor fills this in on site.
      return (await api.post(`/solar/surveys/${created.id}/complete`, {
        monthlyUnitsKwh: body.monthlyUnitsKwh, monthlyBillInr: body.monthlyBillInr,
        usableAreaSqm: body.usableAreaSqm, notes: body.notes,
      })).data;
    },
    onSuccess: () => { toast.success('Survey recorded — the design can now be sized'); setOpen(false); refresh(); },
    onError: (e) => toast.error(apiErrorMessage(e)),
  });

  const ready = (f.consumptionMode === 'units' ? Number(f.monthlyUnitsKwh) > 0 : Number(f.monthlyBillInr) > 0) && Number(f.usableAreaSqm) > 0;

  return (
    <div style={{ marginBottom: 18 }}>
      <Head icon={ClipboardList} title="Site survey" action={!open && (
        <button className="btn-secondary" style={{ height: 28, fontSize: 12 }} onClick={() => setOpen(true)}>
          <Plus size={12} /> {done ? 'New survey' : 'Record survey'}
        </button>)} />

      {done && !open && (
        <div style={box}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <Check size={14} style={{ color: 'var(--success,#1e874b)' }} />
            <b style={{ fontSize: 13 }}>Survey complete</b>
            {done.surveyorName && <span style={{ fontSize: 12, color: 'var(--ink-3)' }}>{done.surveyorName}</span>}
          </div>
          <div style={{ fontSize: 12, color: 'var(--ink-3)', marginTop: 6 }}>
            {done.monthlyUnitsKwh ? `${done.monthlyUnitsKwh} kWh/month` : done.monthlyBillInr ? `Bill ${done.monthlyBillInr}/month` : 'No consumption'}
            {done.usableAreaSqm ? ` · ${done.usableAreaSqm} m² usable roof` : ''}
            {done.shadingPct ? ` · ${done.shadingPct}% shading` : ''}
          </div>
        </div>
      )}
      {!done && !open && !latest && <Muted>No survey yet — the design cannot be sized until one is recorded.</Muted>}

      {open && (
        <div style={box}>
          <div style={{ display: 'flex', gap: 8, marginBottom: 10 }}>
            <F label="Surveyor"><input className="input" style={inpS} value={f.surveyorName} onChange={(e) => set('surveyorName', e.target.value)} /></F>
            <F label="Date"><input className="input" style={inpS} type="date" value={f.scheduledAt} onChange={(e) => set('scheduledAt', e.target.value)} /></F>
          </div>

          <div style={{ fontSize: 12, fontWeight: 600, marginBottom: 6 }}>Consumption</div>
          <div style={{ display: 'flex', gap: 6, marginBottom: 8 }}>
            {(['units', 'bill'] as const).map((m) => (
              <button key={m} className="btn-secondary" style={{ height: 28, fontSize: 11.5, borderColor: f.consumptionMode === m ? 'var(--brand,#132376)' : undefined, color: f.consumptionMode === m ? 'var(--brand,#132376)' : undefined }}
                onClick={() => setF((s2) => ({ ...s2, consumptionMode: m }))}>
                {m === 'units' ? 'Meter units' : 'Bill amount'}
              </button>
            ))}
          </div>
          {f.consumptionMode === 'units'
            ? <F label="Monthly units (kWh)"><input className="input" style={inpS} type="number" value={f.monthlyUnitsKwh} onChange={(e) => set('monthlyUnitsKwh', e.target.value)} /></F>
            : <F label="Monthly bill"><input className="input" style={inpS} type="number" value={f.monthlyBillInr} onChange={(e) => set('monthlyBillInr', e.target.value)} /></F>}

          <div style={{ fontSize: 12, fontWeight: 600, margin: '12px 0 6px' }}>Roof</div>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            <F label="Usable area m²"><input className="input" style={inpS} type="number" value={f.usableAreaSqm} onChange={(e) => set('usableAreaSqm', e.target.value)} /></F>
            <F label="Tilt °"><input className="input" style={inpS} type="number" value={f.tiltDeg} onChange={(e) => set('tiltDeg', e.target.value)} /></F>
            <F label="Azimuth °"><input className="input" style={inpS} type="number" value={f.azimuthDeg} onChange={(e) => set('azimuthDeg', e.target.value)} /></F>
            <F label="Shading %"><input className="input" style={inpS} type="number" value={f.shadingPct} onChange={(e) => set('shadingPct', e.target.value)} /></F>
          </div>
          <div style={{ marginTop: 10 }}>
            <F label="Notes"><textarea className="input" rows={2} style={{ ...inpS, resize: 'vertical' }} value={f.notes} onChange={(e) => set('notes', e.target.value)} /></F>
          </div>

          <div style={{ display: 'flex', gap: 8, marginTop: 12 }}>
            <button className="btn-secondary" style={{ height: 30, fontSize: 12 }} onClick={() => setOpen(false)}>Cancel</button>
            <button className="btn-primary" style={{ height: 30, fontSize: 12 }} disabled={!ready || create.isPending} onClick={() => create.mutate()}>
              {create.isPending ? 'Saving…' : 'Save survey'}
            </button>
            {!ready && <span style={{ fontSize: 11.5, color: 'var(--ink-3)', alignSelf: 'center' }}>Consumption and usable roof area are required</span>}
          </div>
        </div>
      )}
    </div>
  );
}
const inpS: React.CSSProperties = { height: 32, fontSize: 12.5, width: '100%' };
function F({ label, children }: { label: string; children: React.ReactNode }) {
  return <div style={{ flex: '1 1 110px' }}><label className="label" style={{ fontSize: 10.5 }}>{label}</label>{children}</div>;
}

// ================= E5 · Materials =================
export function MaterialsPanel({ projectId, currency }: { projectId: string; currency?: string }) {
  const qc = useQueryClient();
  const key = ['solar-materials', projectId];
  const { data } = useQuery({ queryKey: key, queryFn: async () => (await api.get<MaterialRequest[]>(`/solar/projects/${projectId}/material-requests`)).data });
  const refresh = () => qc.invalidateQueries({ queryKey: key });
  const run = (fn: () => Promise<any>, msg: string) => ({
    mutationFn: fn, onSuccess: () => { toast.success(msg); refresh(); }, onError: (e: any) => toast.error(apiErrorMessage(e)),
  });
  const create = useMutation(run(() => api.post(`/solar/projects/${projectId}/material-requests`, {}), 'Material request created'));
  const req = data?.[0];
  const raisePo = useMutation(run(() => api.post(`/solar/material-requests/${req!.id}/purchase-order`, {}), 'Purchase order raised'));
  const receive = useMutation(run(() => api.post(`/solar/material-requests/${req!.id}/receive`, {}), 'Purchase order received into stock'));
  const issue = useMutation(run(() => api.post(`/solar/material-requests/${req!.id}/issue`, {}), 'Materials issued'));
  const [imp, setImp] = useState(false);
  const [ship, setShip] = useState({ supplierRef: '', blAwbNumber: '', etaDate: '', customsClearedAt: '' });
  const saveImport = useMutation({
    mutationFn: () => api.patch(`/solar/material-requests/${req!.id}/import`, {
      supplierRef: ship.supplierRef || undefined, blAwbNumber: ship.blAwbNumber || undefined,
      etaDate: ship.etaDate || undefined, customsClearedAt: ship.customsClearedAt || undefined,
    }),
    onSuccess: () => { toast.success('Shipment updated'); setImp(false); refresh(); },
    onError: (e) => toast.error(apiErrorMessage(e)),
  });

  return (
    <div style={{ marginBottom: 18 }}>
      <Head icon={Package} title="Materials" action={!req && <button className="btn-secondary" style={{ height: 28, fontSize: 12 }} disabled={create.isPending} onClick={() => create.mutate()}><Plus size={12} /> Request from BOM</button>} />
      {!req && <Muted>No material request yet — explode the design's BOM against stock.</Muted>}
      {req && (
        <div style={box}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
            <span className="badge" style={{ background: req.status === 'ISSUED' ? 'var(--success-bg,#e6f4ea)' : req.status === 'SHORT' ? 'var(--danger-bg,#fce8e8)' : 'var(--surface)', color: req.status === 'ISSUED' ? 'var(--success,#1e874b)' : req.status === 'SHORT' ? 'var(--danger,#c0392b)' : 'var(--ink-2)' }}>
              {MR_STATUS_LABEL[req.status]}
            </span>
            <div style={{ flex: 1 }} />
            {req.status === 'SHORT' && <button className="btn-secondary" style={{ height: 26, fontSize: 11.5 }} disabled={raisePo.isPending} onClick={() => raisePo.mutate()}><Truck size={11} /> Raise PO</button>}
            {req.status === 'ORDERED' && <button className="btn-secondary" style={{ height: 26, fontSize: 11.5 }} onClick={() => setImp((v) => !v)}><Truck size={11} /> Shipment</button>}
            {req.status === 'ORDERED' && <button className="btn-secondary" style={{ height: 26, fontSize: 11.5 }} disabled={receive.isPending} onClick={() => receive.mutate()}>Receive PO</button>}
            {req.status === 'ALLOCATED' && <button className="btn-secondary" style={{ height: 26, fontSize: 11.5 }} disabled={issue.isPending} onClick={() => issue.mutate()}>Issue</button>}
          </div>
          {(req.blAwbNumber || req.etaDate || req.supplierRef) && !imp && (
            <div style={{ fontSize: 11.5, color: 'var(--ink-3)', marginBottom: 8 }}>
              <Truck size={11} style={{ verticalAlign: -1 }} />{' '}
              {req.supplierRef && <>Ref {req.supplierRef} · </>}
              {req.blAwbNumber && <>BL/AWB {req.blAwbNumber} · </>}
              {req.etaDate && <>ETA {new Date(req.etaDate).toLocaleDateString('en-AE')}</>}
              {req.customsClearedAt && <> · cleared {new Date(req.customsClearedAt).toLocaleDateString('en-AE')}</>}
            </div>
          )}
          {imp && (
            <div style={{ background: 'var(--surface)', borderRadius: 9, padding: 10, marginBottom: 8 }}>
              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                <F label="Supplier ref"><input className="input" style={inpS} value={ship.supplierRef} onChange={(e) => setShip({ ...ship, supplierRef: e.target.value })} /></F>
                <F label="BL / AWB"><input className="input" style={inpS} value={ship.blAwbNumber} onChange={(e) => setShip({ ...ship, blAwbNumber: e.target.value })} /></F>
                <F label="ETA"><input className="input" style={inpS} type="date" value={ship.etaDate} onChange={(e) => setShip({ ...ship, etaDate: e.target.value })} /></F>
                <F label="Customs cleared"><input className="input" style={inpS} type="date" value={ship.customsClearedAt} onChange={(e) => setShip({ ...ship, customsClearedAt: e.target.value })} /></F>
              </div>
              <div style={{ display: 'flex', gap: 8, marginTop: 10 }}>
                <button className="btn-secondary" style={{ height: 28, fontSize: 12 }} onClick={() => setImp(false)}>Cancel</button>
                <button className="btn-primary" style={{ height: 28, fontSize: 12 }} disabled={saveImport.isPending} onClick={() => saveImport.mutate()}>Save shipment</button>
              </div>
            </div>
          )}
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', fontSize: 12, borderCollapse: 'collapse' }}>
              <thead><tr style={{ color: 'var(--ink-3)', textAlign: 'left' }}>
                <th style={{ padding: '3px 0', fontWeight: 500 }}>Component</th>
                <th style={{ padding: '3px 6px', fontWeight: 500, textAlign: 'right' }}>Need</th>
                <th style={{ padding: '3px 6px', fontWeight: 500, textAlign: 'right' }}>From stock</th>
                <th style={{ padding: '3px 0', fontWeight: 500, textAlign: 'right' }}>Short</th>
              </tr></thead>
              <tbody>
                {req.lines.map((l) => (
                  <tr key={l.id} style={{ borderTop: '1px solid var(--line-soft)' }}>
                    <td style={{ padding: '5px 0' }}>{l.description}</td>
                    <td style={{ padding: '5px 6px', textAlign: 'right', fontVariantNumeric: 'tabular-nums' }}>{l.requiredQty}</td>
                    <td style={{ padding: '5px 6px', textAlign: 'right', fontVariantNumeric: 'tabular-nums' }}>{l.allocatedQty}</td>
                    <td style={{ padding: '5px 0', textAlign: 'right', fontVariantNumeric: 'tabular-nums', color: l.shortfallQty ? 'var(--danger,#c0392b)' : 'var(--ink-3)' }}>{l.shortfallQty || '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}

// ================= E6 · Installation =================
export function WorkOrdersPanel({ projectId }: { projectId: string }) {
  const qc = useQueryClient();
  const key = ['solar-workorders', projectId];
  const { data } = useQuery({ queryKey: key, queryFn: async () => (await api.get<WorkOrder[]>(`/solar/projects/${projectId}/work-orders`)).data });
  const refresh = () => qc.invalidateQueries({ queryKey: key });
  const [title, setTitle] = useState('');
  const [team, setTeam] = useState('');
  const [closing, setClosing] = useState<string | null>(null);
  const [sign, setSign] = useState({ safetySignedBy: '', report: '' });

  const create = useMutation({
    mutationFn: () => api.post(`/solar/projects/${projectId}/work-orders`, { title: title || 'Installation', teamName: team || undefined }),
    onSuccess: () => { setTitle(''); setTeam(''); toast.success('Work order created'); refresh(); }, onError: (e) => toast.error(apiErrorMessage(e)),
  });
  const tick = useMutation({
    mutationFn: ({ id, done }: { id: string; done: boolean }) => api.patch(`/solar/checklist/${id}`, { done }),
    onSuccess: refresh, onError: (e) => toast.error(apiErrorMessage(e)),
  });
  const complete = useMutation({
    mutationFn: (id: string) => api.post(`/solar/work-orders/${id}/complete`, sign),
    onSuccess: () => { closeForm(); toast.success('Job closed'); refresh(); },
    onError: (e) => toast.error(apiErrorMessage(e)),
  });
  const [assigning, setAssigning] = useState<string | null>(null);
  const [crewName, setCrewName] = useState('');
  const { data: crews } = useQuery({ queryKey: ['solar-crews'], queryFn: async () => (await api.get<string[]>('/solar/crews')).data });
  const assign = useMutation({
    mutationFn: ({ id, teamName }: { id: string; teamName: string }) => api.patch(`/solar/work-orders/${id}/assign`, { teamName }),
    onSuccess: () => { setAssigning(null); setCrewName(''); toast.success('Crew assigned — it appears in their Installer App'); refresh(); qc.invalidateQueries({ queryKey: ['solar-crews'] }); },
    onError: (e) => toast.error(apiErrorMessage(e)),
  });
  // One sign-off form is shared by every job on the project, so it has to be cleared
  // whenever it opens or closes — otherwise one crew's name and report carry over to
  // the next job and get submitted against it.
  const closeForm = () => { setClosing(null); setSign({ safetySignedBy: '', report: '' }); };
  const openForm = (id: string) => { setSign({ safetySignedBy: '', report: '' }); setClosing(id); };

  return (
    <div style={{ marginBottom: 18 }}>
      <Head icon={HardHat} title="Installation" action={
        <div style={{ display: 'flex', gap: 6 }}>
          <input className="input" style={{ height: 28, fontSize: 12, width: 120 }} placeholder="Job title" value={title} onChange={(e) => setTitle(e.target.value)} />
          <input className="input" style={{ height: 28, fontSize: 12, width: 100 }} placeholder="Crew" value={team} onChange={(e) => setTeam(e.target.value)} />
          <button className="btn-secondary" style={{ height: 28, fontSize: 12 }} disabled={create.isPending} onClick={() => create.mutate()}><Plus size={12} /> Add</button>
        </div>} />
      {!data?.length && <Muted>No work orders yet.</Muted>}
      {(data ?? []).map((w) => {
        const done = w.checklist.filter((c) => c.done).length;
        return (
          <div key={w.id} style={box}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
              <b style={{ fontSize: 13 }}>{w.title}</b>
              {w.status !== 'COMPLETE' && (assigning === w.id ? (
                <span style={{ display: 'inline-flex', gap: 4 }}>
                  <input className="input" list="solar-crew-list" style={{ height: 24, fontSize: 11.5, width: 110 }} placeholder="Crew name" value={crewName} onChange={(e) => setCrewName(e.target.value)} autoFocus />
                  <datalist id="solar-crew-list">{(crews ?? []).map((c) => <option key={c} value={c} />)}</datalist>
                  <button className="btn-primary" style={{ height: 24, fontSize: 11 }} disabled={!crewName.trim() || assign.isPending} onClick={() => assign.mutate({ id: w.id, teamName: crewName.trim() })}>Set</button>
                  <button className="btn-secondary" style={{ height: 24, fontSize: 11 }} onClick={() => setAssigning(null)}>×</button>
                </span>
              ) : (
                <button className="btn-secondary" style={{ height: 22, fontSize: 11, padding: '0 8px' }} onClick={() => { setAssigning(w.id); setCrewName(w.teamName ?? ''); }}>
                  {w.teamName ? `Crew: ${w.teamName}` : 'Assign crew'}
                </button>
              ))}
              {w.status === 'COMPLETE' && w.teamName && <span style={{ fontSize: 11.5, color: 'var(--ink-3)' }}>{w.teamName}</span>}
              <div style={{ flex: 1 }} />
              <span className="badge" style={{ background: w.status === 'COMPLETE' ? 'var(--success-bg,#e6f4ea)' : 'var(--surface)', color: w.status === 'COMPLETE' ? 'var(--success,#1e874b)' : 'var(--ink-2)' }}>
                {done}/{w.checklist.length}
              </span>
            </div>
            {w.status !== 'COMPLETE' && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 3, marginTop: 8 }}>
                {w.checklist.map((c) => (
                  <label key={c.id} style={{ display: 'flex', alignItems: 'center', gap: 7, fontSize: 12, cursor: 'pointer' }}>
                    <input type="checkbox" checked={c.done} onChange={(e) => tick.mutate({ id: c.id, done: e.target.checked })} />
                    <span style={{ textDecoration: c.done ? 'line-through' : undefined, color: c.done ? 'var(--ink-3)' : undefined }}>{c.label}</span>
                  </label>
                ))}
              </div>
            )}
            {w.status === 'COMPLETE' ? (
              <div style={{ fontSize: 11.5, color: 'var(--ink-3)', marginTop: 7 }}>
                <Check size={11} style={{ verticalAlign: -1, color: 'var(--success,#1e874b)' }} /> Signed off by {w.safetySignedBy} · {w.report}
              </div>
            ) : closing === w.id ? (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginTop: 9 }}>
                <input className="input" style={{ height: 30, fontSize: 12 }} placeholder="Safety sign-off — who is signing?" value={sign.safetySignedBy} onChange={(e) => setSign({ ...sign, safetySignedBy: e.target.value })} />
                <textarea className="input" rows={2} style={{ fontSize: 12, resize: 'vertical' }} placeholder="Installation report" value={sign.report} onChange={(e) => setSign({ ...sign, report: e.target.value })} />
                <div style={{ display: 'flex', gap: 6 }}>
                  <button className="btn-secondary" style={{ height: 28, fontSize: 12 }} onClick={closeForm}>Cancel</button>
                  <button className="btn-primary" style={{ height: 28, fontSize: 12 }} disabled={complete.isPending} onClick={() => complete.mutate(w.id)}>Close job</button>
                </div>
              </div>
            ) : (
              <button className="btn-secondary" style={{ height: 26, fontSize: 11.5, marginTop: 8 }} onClick={() => openForm(w.id)}>Close job</button>
            )}
          </div>
        );
      })}
    </div>
  );
}

// ================= E7 · Billing & profitability =================
export function BillingPanel({ projectId, currency }: { projectId: string; currency?: string }) {
  const qc = useQueryClient();
  const msKey = ['solar-milestones', projectId];
  const pfKey = ['solar-profit', projectId];
  const { data: milestones } = useQuery({ queryKey: msKey, queryFn: async () => (await api.get<Milestone[]>(`/solar/projects/${projectId}/milestones`)).data });
  const { data: profit } = useQuery({ queryKey: pfKey, queryFn: async () => (await api.get<Profitability>(`/solar/projects/${projectId}/profitability`)).data });
  const refresh = () => { qc.invalidateQueries({ queryKey: msKey }); qc.invalidateQueries({ queryKey: pfKey }); };

  const schedule = useMutation({
    mutationFn: () => api.post(`/solar/projects/${projectId}/milestones`, {}),
    onSuccess: () => { toast.success('Milestone schedule created'); refresh(); }, onError: (e) => toast.error(apiErrorMessage(e)),
  });
  const invoice = useMutation({
    mutationFn: (id: string) => api.post(`/solar/milestones/${id}/invoice`, {}),
    onSuccess: () => { toast.success('Invoice raised'); refresh(); }, onError: (e) => toast.error(apiErrorMessage(e)),
  });

  return (
    <div style={{ marginBottom: 18 }}>
      <Head icon={Receipt} title="Billing" action={!milestones?.length && <button className="btn-secondary" style={{ height: 28, fontSize: 12 }} disabled={schedule.isPending} onClick={() => schedule.mutate()}><Plus size={12} /> Schedule milestones</button>} />
      {!milestones?.length && <Muted>No milestone schedule — bill 40/40/20 across advance, delivery and commissioning.</Muted>}
      {(milestones ?? []).map((m) => (
        <div key={m.id} style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 12.5, padding: '6px 0', borderBottom: '1px solid var(--line-soft)' }}>
          <span style={{ flex: 1 }}>{m.name} <span style={{ color: 'var(--ink-3)' }}>({m.pct}%)</span></span>
          <span style={{ fontVariantNumeric: 'tabular-nums' }}>{fmtMoney(m.amountInr, currency)}</span>
          {m.status === 'PENDING'
            ? <button className="btn-secondary" style={{ height: 24, fontSize: 11 }} disabled={invoice.isPending} onClick={() => invoice.mutate(m.id)}>Invoice</button>
            : <span className="badge" style={{ background: 'var(--success-bg,#e6f4ea)', color: 'var(--success,#1e874b)' }}>{m.status.toLowerCase()}</span>}
        </div>
      ))}

      {profit && profit.contractValueInr > 0 && (
        <div style={{ ...card, padding: 12, marginTop: 12 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, fontWeight: 700, marginBottom: 8 }}><TrendingUp size={12} /> Profitability</div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(110px,1fr))', gap: 8 }}>
            <Fig label="Contract" value={fmtMoney(profit.contractValueInr, currency)} />
            <Fig label="Total cost" value={fmtMoney(profit.costInr, currency)} />
            <Fig label="Expected profit" value={fmtMoney(profit.expectedProfitInr, currency)} strong
                 color={profit.expectedProfitInr >= 0 ? 'var(--success,#1e874b)' : 'var(--danger,#c0392b)'} />
            <Fig label="Expected margin" value={profit.expectedMarginPct != null ? `${profit.expectedMarginPct}%` : '—'}
                 color={(profit.expectedMarginPct ?? 0) >= 0 ? 'var(--success,#1e874b)' : 'var(--danger,#c0392b)'} />
          </div>
          <div style={{ marginTop: 10 }}>
            <div style={{ height: 5, borderRadius: 4, background: 'var(--surface-2)', overflow: 'hidden' }}>
              <div style={{ width: `${Math.min(100, profit.billedPct)}%`, height: '100%', background: 'var(--brand,#132376)' }} />
            </div>
            <div style={{ fontSize: 11.5, color: 'var(--ink-3)', marginTop: 5 }}>
              Billed {profit.billedPct}% — invoiced {fmtMoney(profit.invoicedInr, currency)}, collected {fmtMoney(profit.collectedInr, currency)}
              {profit.outstandingInr > 0 && <>, outstanding {fmtMoney(profit.outstandingInr, currency)}</>}
            </div>
            <div style={{ fontSize: 11, color: 'var(--ink-3)', marginTop: 4 }}>
              Costs are recognised in full once the design is priced, so profit only turns positive as milestones are billed.
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
function Fig({ label, value, strong, color }: { label: string; value: string; strong?: boolean; color?: string }) {
  return (
    <div style={{ background: 'var(--surface-2)', borderRadius: 9, padding: '8px 10px' }}>
      <div style={{ fontSize: 10.5, color: 'var(--ink-3)' }}>{label}</div>
      <div style={{ fontSize: strong ? 15 : 13, fontWeight: strong ? 800 : 600, marginTop: 2, color }}>{value}</div>
    </div>
  );
}

// ================= E4 · Proposal (create → AI narrative → send → sign link) =================
/**
 * The sales step the drawer was missing: without this, a proposal could only be
 * created over the API, so the browser flow stopped at the design.
 */
export function ProposalPanel({ projectId, currency, designs, proposals, onChanged }: {
  projectId: string; currency?: string; designs: any[]; proposals: any[]; onChanged: () => void;
}) {
  const latestValid = (designs ?? []).find((d) => d.valid);
  const latest = (proposals ?? [])[0];
  const [narrative, setNarrative] = useState<string>(latest?.narrative ?? '');
  const [aiWarn, setAiWarn] = useState<string | null>(null);

  const run = (fn: () => Promise<any>, msg: string) => ({
    mutationFn: fn, onSuccess: () => { toast.success(msg); onChanged(); }, onError: (e: any) => toast.error(apiErrorMessage(e)),
  });
  const create = useMutation(run(() => api.post(`/solar/projects/${projectId}/proposals`, { designId: latestValid?.id }), 'Proposal created'));
  const send = useMutation(run(() => api.post(`/solar/proposals/${latest?.id}/send`, {}), 'Proposal sent — signing link is live'));
  const save = useMutation(run(() => api.patch(`/solar/proposals/${latest?.id}/narrative`, { narrative }), 'Narrative saved'));
  const draft = useMutation({
    mutationFn: async () => (await api.post<any>(`/solar/proposals/${latest?.id}/narrative/draft`, {})).data,
    onSuccess: (d) => {
      setNarrative(d.narrative);
      setAiWarn(d.warning ?? null);
      toast.success(d.warning ? 'Draft ready — check the flagged number' : 'Draft ready — review and save');
    },
    onError: (e) => toast.error(apiErrorMessage(e)),
  });

  const signUrl = latest?.signToken && typeof window !== 'undefined'
    ? `${window.location.origin}/p/solar/sign/${latest.signToken}` : null;

  return (
    <div style={{ marginBottom: 18 }}>
      <Head icon={FileText} title="Proposal" action={
        !latest && latestValid && (
          <button className="btn-primary" style={{ height: 28, fontSize: 12 }} disabled={create.isPending} onClick={() => create.mutate()}>
            <Plus size={12} /> Create from design
          </button>
        )} />
      {!latestValid && !latest && <Muted>A validated design is needed before a proposal.</Muted>}

      {latest && (
        <div style={box}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8, flexWrap: 'wrap' }}>
            <span className="badge" style={{ background: latest.status === 'ACCEPTED' ? 'var(--success-bg,#e6f4ea)' : 'var(--surface)', color: latest.status === 'ACCEPTED' ? 'var(--success,#1e874b)' : 'var(--ink-2)' }}>
              {latest.status.toLowerCase()}
            </span>
            <span style={{ fontSize: 12, color: 'var(--ink-3)' }}>
              {fmtMoney(latest.systemCostInr, currency)} · saves {fmtMoney(latest.annualSavingsInr, currency)}/yr · payback {Math.floor((latest.paybackMonths ?? 0) / 12)} yr {(latest.paybackMonths ?? 0) % 12} mo
            </span>
            {latest.signedName && <span style={{ fontSize: 12, color: 'var(--success,#1e874b)' }}>signed by {latest.signedName}</span>}
          </div>

          {latest.status === 'DRAFT' && (
            <>
              <textarea className="input" rows={3} style={{ fontSize: 12.5, resize: 'vertical', width: '100%' }} value={narrative}
                onChange={(e) => setNarrative(e.target.value)} placeholder="A short summary for the customer — draft it with AI or write your own. The numbers always come from the design." />
              {aiWarn && <div style={{ fontSize: 11.5, color: 'var(--danger,#c0392b)', marginTop: 6 }}>{aiWarn}</div>}
              <div style={{ display: 'flex', gap: 8, marginTop: 8, flexWrap: 'wrap' }}>
                <button className="btn-secondary" style={{ height: 28, fontSize: 12 }} disabled={draft.isPending} onClick={() => draft.mutate()}>
                  <Sparkles size={12} /> {draft.isPending ? 'Drafting…' : 'Draft with AI'}
                </button>
                <button className="btn-secondary" style={{ height: 28, fontSize: 12 }} disabled={save.isPending} onClick={() => save.mutate()}>Save narrative</button>
                <button className="btn-primary" style={{ height: 28, fontSize: 12 }} disabled={send.isPending} onClick={() => send.mutate()}>
                  <Send size={12} /> Send to customer
                </button>
              </div>
            </>
          )}

          {signUrl && latest.status !== 'DRAFT' && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 8 }}>
              <input className="input" readOnly value={signUrl} style={{ height: 30, fontSize: 11.5, flex: 1 }} onFocus={(e) => e.target.select()} />
              <button className="btn-secondary" style={{ height: 30, fontSize: 12 }} onClick={() => { navigator.clipboard?.writeText(signUrl); toast.success('Signing link copied'); }}>
                <Copy size={12} /> Copy
              </button>
            </div>
          )}
          {latest.narrative && latest.status !== 'DRAFT' && (
            <div style={{ fontSize: 12.5, color: 'var(--ink-2)', marginTop: 8, lineHeight: 1.5 }}>{latest.narrative}</div>
          )}
        </div>
      )}
    </div>
  );
}
