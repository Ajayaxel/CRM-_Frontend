'use client';

import { useState, Suspense } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import {
  Sun, Plus, X, Zap, Wallet, Leaf, TrendingUp, AlertTriangle, CheckCircle2, ArrowRight, Trash2, Calculator,
} from 'lucide-react';
import { api, apiErrorMessage } from '@/lib/api';
import {
  BomResult, METERING_LABEL, MeteringType, PanelLayout, SavingsResult, SizingResult, SolarProject, SolarStats,
  STAGE_LABEL, STAGE_ORDER, SolarStage, fmtKwh, fmtMoney, fmtPayback, fmtDate,
} from '../solar-client';
import { BillingPanel, MaterialsPanel, ProposalPanel, SurveyPanel, WorkOrdersPanel } from './solar-ops-panels';
import { SolarTelemetryView } from './SolarTelemetryView';
import { SolarFaultManagementView } from './SolarFaultManagementView';
import { SolarSubscriptionView } from './SolarSubscriptionView';
import { SolarAiCopilotView } from './SolarAiCopilotView';
import { SolarCeoAnalyticsView } from './SolarCeoAnalyticsView';
import { SolarNotificationEngineView } from './SolarNotificationEngineView';
import { SolarCustomerMobileAppView } from '../portal/SolarCustomerMobileAppView';
import { SolarFleetView } from './SolarFleetView';
import { SolarWarehouseDepthView } from './SolarWarehouseDepthView';
import { SolarDocumentVersionView } from './SolarDocumentVersionView';

import { useSearchParams } from 'next/navigation';

/**
 * The Suspense boundary is required, not stylistic.
 *
 * SolarFeatureInner calls useSearchParams(), which opts the route out of static
 * prerendering unless it sits inside a boundary. Without one `next build` fails
 * at export — and it aborts the ENTIRE build, so every other vertical stops
 * shipping too, which is how a security-headers deploy ended up blocked behind
 * a solar page.
 *
 * Owned here rather than at the page so a new caller cannot forget it.
 */
export function SolarFeature() {
  return (
    <Suspense fallback={null}>
      <SolarFeatureInner />
    </Suspense>
  );
}

const card: React.CSSProperties = { background: 'var(--surface)', border: '1px solid var(--line-soft)', borderRadius: 16 };

function SolarFeatureInner() {
  const searchParams = useSearchParams();
  const activeTab = searchParams.get('tab');

  const qc = useQueryClient();
  const [stage, setStage] = useState<SolarStage | ''>('');
  const [add, setAdd] = useState(false);
  const [openId, setOpenId] = useState<string | null>(null);
  const [calc, setCalc] = useState(false);

  const { data: stats } = useQuery({ queryKey: ['solar-stats'], queryFn: async () => (await api.get<SolarStats>('/solar/stats')).data });
  const { data: projects, isLoading } = useQuery({
    queryKey: ['solar-projects', stage],
    queryFn: async () => (await api.get<SolarProject[]>('/solar/projects', { params: stage ? { stage } : {} })).data,
  });
  const refresh = () => { qc.invalidateQueries({ queryKey: ['solar-projects'] }); qc.invalidateQueries({ queryKey: ['solar-stats'] }); };

  if (activeTab === 'telemetry') return <SolarTelemetryView />;
  if (activeTab === 'faults') return <SolarFaultManagementView />;
  if (activeTab === 'subscriptions') return <SolarSubscriptionView />;
  if (activeTab === 'copilot') return <SolarAiCopilotView />;
  if (activeTab === 'analytics') return <SolarCeoAnalyticsView />;
  if (activeTab === 'portal') return <SolarCustomerMobileAppView />;
  if (activeTab === 'notifications') return <SolarNotificationEngineView />;
  if (activeTab === 'fleet') return <SolarFleetView />;
  if (activeTab === 'warehouse') return <SolarWarehouseDepthView />;
  if (activeTab === 'documents') return <SolarDocumentVersionView />;

  return (
    <div style={{ animation: 'fadeUp .4s ease' }}>
      <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12, marginBottom: 18 }}>
        <div style={{ flex: 1 }}>
          <h1 style={{ fontSize: 26, fontWeight: 700, letterSpacing: '-.02em', margin: 0 }}>Solar Projects</h1>
          <p style={{ fontSize: 14, color: 'var(--ink-2)', margin: '6px 0 0' }}>Enquiry to lifetime generation — survey, design, quote, install, monitor.</p>
        </div>
        <button className="btn-secondary" onClick={() => setCalc(true)}><Calculator size={15} /> Sizing calculator</button>
        <button className="btn-primary" onClick={() => setAdd(true)}><Plus size={15} /> New project</button>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(150px,1fr))', gap: 12, marginBottom: 16 }}>
        <Stat icon={Sun} label="Designed capacity" value={`${stats?.designedKwp ?? 0} kWp`} />
        <Stat icon={TrendingUp} label="Won projects" value={String(stats?.wonProjects ?? 0)} />
        <Stat icon={Wallet} label="Contracted" value={fmtMoney(stats?.contractValueInr ?? 0)} />
        <Stat icon={CheckCircle2} label="Commissioned" value={String(stats?.commissioned ?? 0)} />
        <Stat icon={AlertTriangle} label="Open alerts" value={String(stats?.openAlerts ?? 0)} accent={stats?.openAlerts ? 'var(--danger,#c0392b)' : undefined} />
      </div>

      <div style={{ display: 'flex', gap: 6, marginBottom: 14, flexWrap: 'wrap' }}>
        <Chip active={stage === ''} onClick={() => setStage('')}>All</Chip>
        {STAGE_ORDER.map((s) => (
          <Chip key={s} active={stage === s} onClick={() => setStage(s)}>
            {STAGE_LABEL[s]}{stats?.pipeline?.[s] ? ` ${stats.pipeline[s]}` : ''}
          </Chip>
        ))}
      </div>

      {isLoading && <Empty text="Loading projects…" />}
      {!isLoading && !projects?.length && <Empty text={stage ? `Nothing at the ${STAGE_LABEL[stage as SolarStage].toLowerCase()} stage.` : 'No solar projects yet. Create one from an enquiry.'} />}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        {(projects ?? []).map((p) => (
          <button key={p.id} onClick={() => setOpenId(p.id)} style={{ ...card, padding: 16, display: 'flex', alignItems: 'center', gap: 12, textAlign: 'left', cursor: 'pointer', width: '100%' }}>
            <Sun size={18} style={{ color: 'var(--gold,#c67c1e)' }} />
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontWeight: 600, fontSize: 14 }}>{p.code} · {p.customerName}</div>
              <div style={{ fontSize: 12, color: 'var(--ink-3)' }}>
                {p.city ? `${p.city} · ` : ''}{p.siteAddress || 'No site address'}
                {p.contractValueInr > 0 && <> · {fmtMoney(p.contractValueInr, p.currency)}</>}
              </div>
            </div>
            <StageBadge stage={p.stage} />
            <ArrowRight size={15} style={{ color: 'var(--ink-3)' }} />
          </button>
        ))}
      </div>

      {add && <NewProjectModal onClose={() => setAdd(false)} onDone={(id) => { setAdd(false); refresh(); setOpenId(id); }} />}
      {openId && <ProjectDrawer id={openId} onClose={() => setOpenId(null)} onChange={refresh} />}
      {calc && <SizingCalculator onClose={() => setCalc(false)} />}
    </div>
  );
}

function Stat({ icon: Icon, label, value, accent }: { icon: any; label: string; value: string; accent?: string }) {
  return (
    <div style={{ ...card, padding: '14px 16px' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 11.5, color: 'var(--ink-3)' }}><Icon size={12} /> {label}</div>
      <div style={{ fontSize: 19, fontWeight: 800, marginTop: 4, color: accent }}>{value}</div>
    </div>
  );
}
function Chip({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button onClick={onClick} className="btn-secondary" style={{ height: 30, fontSize: 12, padding: '0 11px', borderColor: active ? 'var(--brand,#132376)' : undefined, color: active ? 'var(--brand,#132376)' : undefined }}>
      {children}
    </button>
  );
}
function StageBadge({ stage }: { stage: SolarStage }) {
  const tone = stage === 'LOST' ? { bg: 'var(--danger-bg,#fce8e8)', fg: 'var(--danger,#c0392b)' }
    : stage === 'MONITORING' || stage === 'AMC' ? { bg: 'var(--success-bg,#e6f4ea)', fg: 'var(--success,#1e874b)' }
    : { bg: 'var(--surface-2)', fg: 'var(--ink-2)' };
  return <span className="badge" style={{ background: tone.bg, color: tone.fg, whiteSpace: 'nowrap' }}>{STAGE_LABEL[stage]}</span>;
}
function Empty({ text }: { text: string }) {
  return <div style={{ ...card, padding: 40, textAlign: 'center', color: 'var(--ink-3)', fontSize: 13.5 }}>{text}</div>;
}

// ================= New project =================
function NewProjectModal({ onClose, onDone }: { onClose: () => void; onDone: (id: string) => void }) {
  const [f, setF] = useState({ customerName: '', phone: '', email: '', siteAddress: '', city: '', country: 'AE', currency: 'AED', tariff: '0.45', exportRate: '0.20', metering: 'NET' as MeteringType });
  const set = (k: string, v: string) => setF((s) => ({ ...s, [k]: v }));
  const create = useMutation({
    mutationFn: async () => (await api.post<SolarProject>('/solar/projects', {
      customerName: f.customerName, phone: f.phone || undefined, email: f.email || undefined,
      siteAddress: f.siteAddress || undefined, city: f.city || undefined,
      country: f.country, currency: f.currency,
      // The API stores per-kWh rates in minor units; the form collects the real rate.
      tariffMinorPerKwh: Math.round(Number(f.tariff) * 100),
      exportRateMinorPerKwh: Math.round(Number(f.exportRate) * 100),
      metering: f.metering,
    })).data,
    onSuccess: (p) => { toast.success(`${p.code} created`); onDone(p.id); },
    onError: (e) => toast.error(apiErrorMessage(e)),
  });
  return (
    <Overlay title="New solar project" onClose={onClose}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        <div><label className="label">Customer</label><input className="input" value={f.customerName} onChange={(e) => set('customerName', e.target.value)} /></div>
        <div style={{ display: 'flex', gap: 10 }}>
          <div style={{ flex: 1 }}><label className="label">Phone</label><input className="input" value={f.phone} onChange={(e) => set('phone', e.target.value)} /></div>
          <div style={{ flex: 1 }}><label className="label">Email</label><input className="input" value={f.email} onChange={(e) => set('email', e.target.value)} /></div>
        </div>
        <div><label className="label">Site address</label><input className="input" value={f.siteAddress} onChange={(e) => set('siteAddress', e.target.value)} /></div>
        <div style={{ display: 'flex', gap: 10 }}>
          <div style={{ flex: 1 }}><label className="label">City</label><input className="input" value={f.city} onChange={(e) => set('city', e.target.value)} /></div>
          <div style={{ width: 110 }}><label className="label">Country</label>
            <select className="input" value={f.country} onChange={(e) => { const c = e.target.value; setF((s) => ({ ...s, country: c, currency: c === 'AE' ? 'AED' : c === 'SA' ? 'SAR' : 'INR' })); }}>
              <option value="AE">UAE</option><option value="SA">Saudi</option><option value="IN">India</option>
            </select>
          </div>
          <div style={{ width: 100 }}><label className="label">Currency</label><input className="input" value={f.currency} onChange={(e) => set('currency', e.target.value)} /></div>
        </div>
        <div style={{ display: 'flex', gap: 10 }}>
          <div style={{ flex: 1 }}><label className="label">Tariff / kWh</label><input className="input" type="number" step="0.01" value={f.tariff} onChange={(e) => set('tariff', e.target.value)} /></div>
          <div style={{ flex: 1 }}><label className="label">Export rate / kWh</label><input className="input" type="number" step="0.01" value={f.exportRate} onChange={(e) => set('exportRate', e.target.value)} disabled={f.metering === 'NONE'} /></div>
        </div>
        <div><label className="label">Metering</label>
          <select className="input" value={f.metering} onChange={(e) => set('metering', e.target.value)}>
            {(Object.keys(METERING_LABEL) as MeteringType[]).map((m) => <option key={m} value={m}>{METERING_LABEL[m]}</option>)}
          </select>
        </div>
      </div>
      <Actions onClose={onClose} disabled={!f.customerName || create.isPending} onSubmit={() => create.mutate()} label="Create project" />
    </Overlay>
  );
}

// ================= Sizing calculator (A1 + A2 preview) =================
/**
 * Runs the real engine server-side via dryRun, so the numbers a salesperson sees
 * here are identical to the ones a saved design and proposal will produce.
 */
function SizingCalculator({ onClose, projectId, currency, onSaved }: { onClose: () => void; projectId?: string; currency?: string; onSaved?: () => void }) {
  const [f, setF] = useState({ monthlyBill: '900', usableArea: '120', panelWattage: '550', backupLoadKw: '', backupHours: '', roofWidthM: '', roofDepthM: '' });
  const set = (k: string, v: string) => setF((s) => ({ ...s, [k]: v }));
  // Component rates are the tenant's price book, not constants — they differ per market.
  const [rates, setRates] = useState({ panelPerW: '0.4', inverterPerKw: '300', mountingPerPanel: '120', cablingPerKwp: '200', accessoriesPerKwp: '100', installPerKwp: '500', overheadPct: '10', marginPct: '20' });
  const setRate = (k: string, v: string) => setRates((s) => ({ ...s, [k]: v }));
  const [showRates, setShowRates] = useState(false);
  const [out, setOut] = useState<{ sizing: SizingResult; bom: BomResult; layout?: PanelLayout | null } | null>(null);
  const [errs, setErrs] = useState<string[]>([]);

  const body = (dryRun: boolean) => ({
    monthlyBillInr: Number(f.monthlyBill) || undefined,
    usableAreaSqm: Number(f.usableArea) || undefined,
    panelWattage: Number(f.panelWattage) || undefined,
    backupLoadKw: Number(f.backupLoadKw) || undefined,
    backupHours: Number(f.backupHours) || undefined,
    roofWidthM: Number(f.roofWidthM) || undefined,
    roofDepthM: Number(f.roofDepthM) || undefined,
    dryRun,
    rates: Object.fromEntries(Object.entries(rates).map(([k, v]) => [k, Number(v) || 0])),
  });
  const run = useMutation({
    mutationFn: async () => (await api.post<{ sizing: SizingResult; bom: BomResult; layout?: PanelLayout | null }>(`/solar/projects/${projectId}/designs`, body(true))).data,
    onSuccess: (d) => { setOut(d); setErrs(d.sizing.errors); },
    onError: (e) => { setErrs([apiErrorMessage(e)]); setOut(null); },
  });
  // Previewing is not the job — a design has to be saveable or it can never be quoted.
  const save = useMutation({
    mutationFn: async () => (await api.post(`/solar/projects/${projectId}/designs`, body(false))).data,
    onSuccess: () => { toast.success('Design saved'); onSaved?.(); onClose(); },
    onError: (e) => { setErrs([apiErrorMessage(e)]); },
  });

  return (
    <Overlay title="Sizing calculator" onClose={onClose} wide>
      {!projectId && (
        <div style={{ fontSize: 12.5, color: 'var(--ink-3)', background: 'var(--surface-2)', borderRadius: 9, padding: '10px 12px', marginBottom: 12 }}>
          Open a project to size a system — the calculator uses that site's tariff, country and survey measurements so the figures match the proposal.
        </div>
      )}
      <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
        <Field label="Monthly bill" value={f.monthlyBill} onChange={(v) => set('monthlyBill', v)} />
        <Field label="Usable roof m²" value={f.usableArea} onChange={(v) => set('usableArea', v)} />
        <Field label="Panel Wp" value={f.panelWattage} onChange={(v) => set('panelWattage', v)} />
        <Field label="Backup kW" value={f.backupLoadKw} onChange={(v) => set('backupLoadKw', v)} />
        <Field label="Backup hours" value={f.backupHours} onChange={(v) => set('backupHours', v)} />
        <Field label="Roof width m" value={f.roofWidthM} onChange={(v) => set('roofWidthM', v)} />
        <Field label="Roof depth m" value={f.roofDepthM} onChange={(v) => set('roofDepthM', v)} />
      </div>
      <button className="btn-secondary" style={{ height: 28, fontSize: 12, marginTop: 10 }} onClick={() => setShowRates((v) => !v)}>
        {showRates ? 'Hide' : 'Edit'} component rates
      </button>
      {showRates && (
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginTop: 8 }}>
          {([['panelPerW', `Panel / W`], ['inverterPerKw', 'Inverter / kW'], ['mountingPerPanel', 'Mounting / panel'],
             ['cablingPerKwp', 'Cabling / kWp'], ['accessoriesPerKwp', 'Accessories / kWp'], ['installPerKwp', 'Install / kWp'],
             ['overheadPct', 'Overhead %'], ['marginPct', 'Margin %']] as const).map(([k, label]) => (
            <div key={k} style={{ flex: '1 1 110px' }}>
              <label className="label" style={{ fontSize: 10.5 }}>{label}</label>
              <input className="input" style={{ height: 30, fontSize: 12 }} type="number" value={(rates as any)[k]} onChange={(e) => setRate(k, e.target.value)} />
            </div>
          ))}
        </div>
      )}
      <div style={{ display: 'flex', gap: 8, marginTop: 12 }}>
        <button className="btn-secondary" disabled={!projectId || run.isPending} onClick={() => run.mutate()}>
          <Calculator size={14} /> {run.isPending ? 'Sizing…' : 'Preview'}
        </button>
        <button className="btn-primary" disabled={!projectId || save.isPending || !out?.sizing.valid} onClick={() => save.mutate()}>
          {save.isPending ? 'Saving…' : 'Save design'}
        </button>
      </div>

      {errs.length > 0 && (
        <div style={{ marginTop: 12, fontSize: 12.5, color: 'var(--danger,#c0392b)', background: 'var(--danger-bg,#fce8e8)', borderRadius: 9, padding: '10px 12px' }}>
          {errs.map((e, i) => <div key={i}>• {e}</div>)}
        </div>
      )}
      {out?.sizing && <SizingReadout sizing={out.sizing} bom={out.sizing.valid ? out.bom : undefined} currency={currency} layout={out.layout} />}
    </Overlay>
  );
}
function Field({ label, value, onChange }: { label: string; value: string; onChange: (v: string) => void }) {
  return <div style={{ flex: '1 1 130px' }}><label className="label">{label}</label><input className="input" type="number" value={value} onChange={(e) => onChange(e.target.value)} /></div>;
}

function SizingReadout({ sizing, bom, currency, layout }: { sizing: SizingResult; bom?: BomResult; currency?: string; layout?: PanelLayout | null }) {
  return (
    <div style={{ marginTop: 14 }}>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(120px,1fr))', gap: 10 }}>
        <Readout label="System size" value={`${sizing.kwp} kWp`} strong />
        <Readout label="Panels" value={`${sizing.panelCount} × ${sizing.panelWattage} W`} />
        <Readout label="Inverter" value={`${sizing.inverterKw} kW`} />
        <Readout label="Roof needed" value={`${sizing.requiredAreaSqm} m²`} />
        {sizing.batteryKwh > 0 && <Readout label="Battery" value={`${sizing.batteryKwh} kWh`} />}
        {sizing.stringSize && <Readout label="Per string" value={`${sizing.stringSize} panels`} />}
      </div>
      {layout && layout.rowCounts.length > 0 && <LayoutPlan layout={layout} />}
      {sizing.warnings.map((w, i) => (
        <div key={i} style={{ marginTop: 8, fontSize: 12, color: 'var(--gold,#c67c1e)' }}><AlertTriangle size={11} style={{ verticalAlign: -1 }} /> {w}</div>
      ))}
      {bom && bom.lines.length > 0 && (
        <div style={{ marginTop: 14 }}>
          <div style={{ fontWeight: 700, fontSize: 13, marginBottom: 8 }}>Bill of materials</div>
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', fontSize: 12.5, borderCollapse: 'collapse' }}>
              <tbody>
                {bom.lines.map((l, i) => (
                  <tr key={i} style={{ borderBottom: '1px solid var(--line-soft)' }}>
                    <td style={{ padding: '6px 0' }}>{l.description}</td>
                    <td style={{ padding: '6px 8px', color: 'var(--ink-3)', whiteSpace: 'nowrap' }}>{l.quantity} {l.unit}</td>
                    <td style={{ padding: '6px 0', textAlign: 'right', fontVariantNumeric: 'tabular-nums' }}>{fmtMoney(l.amountInr, currency)}</td>
                  </tr>
                ))}
                <tr><td style={{ padding: '6px 0', color: 'var(--ink-3)' }}>Installation</td><td /><td style={{ textAlign: 'right', fontVariantNumeric: 'tabular-nums' }}>{fmtMoney(bom.installInr, currency)}</td></tr>
                <tr><td style={{ padding: '6px 0', color: 'var(--ink-3)' }}>Overhead & margin</td><td /><td style={{ textAlign: 'right', fontVariantNumeric: 'tabular-nums' }}>{fmtMoney(bom.overheadInr + bom.marginInr, currency)}</td></tr>
                <tr style={{ borderTop: '2px solid var(--line-soft)', fontWeight: 700 }}>
                  <td style={{ padding: '8px 0' }}>System cost</td><td /><td style={{ textAlign: 'right', fontVariantNumeric: 'tabular-nums' }}>{fmtMoney(bom.systemCostInr, currency)}</td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
/** A plan view of the array — one block per panel, laid out in its actual rows. */
function LayoutPlan({ layout }: { layout: PanelLayout }) {
  return (
    <div style={{ marginTop: 14 }}>
      <div style={{ fontWeight: 700, fontSize: 13, marginBottom: 3 }}>Roof layout</div>
      <div style={{ fontSize: 11.5, color: 'var(--ink-3)', marginBottom: 8 }}>
        {layout.rowCounts.length} row{layout.rowCounts.length === 1 ? '' : 's'} · {layout.columns} across ·
        {' '}{layout.placed} panel{layout.placed === 1 ? '' : 's'} placed
        {layout.unplaced > 0 && <span style={{ color: 'var(--danger,#c0392b)' }}> · {layout.unplaced} will not fit</span>}
        {' '}· rows {layout.rowLengthM} m long, {layout.totalDepthM} m deep
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 4, background: 'var(--surface-2)', borderRadius: 10, padding: 10, overflowX: 'auto' }}>
        {layout.rowCounts.map((n, r) => (
          <div key={r} style={{ display: 'flex', gap: 3 }}>
            {Array.from({ length: n }).map((_, c) => (
              <div key={c} title={`Row ${r + 1}, panel ${c + 1}`}
                style={{ width: 13, height: 20, borderRadius: 2, background: 'var(--brand,#132376)', opacity: 0.82, flexShrink: 0 }} />
            ))}
          </div>
        ))}
      </div>
    </div>
  );
}

function Readout({ label, value, strong }: { label: string; value: string; strong?: boolean }) {
  return (
    <div style={{ background: 'var(--surface-2)', borderRadius: 10, padding: '9px 11px' }}>
      <div style={{ fontSize: 10.5, color: 'var(--ink-3)' }}>{label}</div>
      <div style={{ fontSize: strong ? 17 : 14, fontWeight: strong ? 800 : 600, marginTop: 2 }}>{value}</div>
    </div>
  );
}

// ================= Project drawer =================
function ProjectDrawer({ id, onClose, onChange }: { id: string; onClose: () => void; onChange: () => void }) {
  const qc = useQueryClient();
  const { data } = useQuery({ queryKey: ['solar-project', id], queryFn: async () => (await api.get<any>(`/solar/projects/${id}`)).data });
  const [calc, setCalc] = useState(false);
  const refresh = () => { qc.invalidateQueries({ queryKey: ['solar-project', id] }); onChange(); };

  const advance = useMutation({
    mutationFn: (stage: SolarStage) => api.post(`/solar/projects/${id}/stage`, { stage }),
    onSuccess: () => { toast.success('Stage updated'); refresh(); },
    onError: (e) => toast.error(apiErrorMessage(e)),
  });
  const del = useMutation({
    mutationFn: () => api.delete(`/solar/projects/${id}`),
    onSuccess: () => { toast.success('Project deleted'); onClose(); onChange(); },
    onError: (e) => toast.error(apiErrorMessage(e)),
  });

  const p: SolarProject | undefined = data;
  const idx = p ? STAGE_ORDER.indexOf(p.stage) : -1;
  const next = idx >= 0 && idx < STAGE_ORDER.length - 1 ? STAGE_ORDER[idx + 1] : null;
  const latestProposal = data?.proposals?.[0];

  return (
    <>
      <div onClick={onClose} style={{ position: 'fixed', inset: 0, zIndex: 60, background: 'rgba(20,15,12,.42)' }} />
      <div style={{ position: 'fixed', top: 0, right: 0, bottom: 0, zIndex: 61, width: 620, maxWidth: '100%', background: 'var(--surface)', borderLeft: '1px solid var(--line-soft)', overflowY: 'auto', padding: 22 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 14, gap: 10 }}>
          <div>
            <div style={{ fontWeight: 700, fontSize: 17 }}>{p?.code} · {p?.customerName}</div>
            <div style={{ fontSize: 12.5, color: 'var(--ink-3)', marginTop: 3 }}>{p?.siteAddress || 'No site address'}{p?.city ? ` · ${p.city}` : ''}</div>
          </div>
          <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--ink-3)' }}><X size={20} /></button>
        </div>

        {p && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 16, flexWrap: 'wrap' }}>
            <StageBadge stage={p.stage} />
            {next && p.stage !== 'LOST' && (
              <button className="btn-primary" style={{ height: 32, fontSize: 12.5 }} disabled={advance.isPending} onClick={() => advance.mutate(next)}>
                Advance to {STAGE_LABEL[next]} <ArrowRight size={13} />
              </button>
            )}
            {p.stage !== 'LOST' && <button className="btn-secondary" style={{ height: 32, fontSize: 12.5 }} onClick={() => advance.mutate('LOST')}>Mark lost</button>}
            <div style={{ flex: 1 }} />
            <button className="btn-secondary" style={{ height: 32, width: 32, padding: 0 }} onClick={() => del.mutate()} title="Delete project"><Trash2 size={13} /></button>
          </div>
        )}

        {p?.lostReason && <div style={{ fontSize: 12.5, color: 'var(--danger,#c0392b)', marginBottom: 12 }}>Lost: {p.lostReason}</div>}

        {p && <TariffSection project={p} onSaved={refresh} />}

        <SurveyPanel projectId={id} onChanged={refresh} />

        <Section title="Designs" action={<button className="btn-secondary" style={{ height: 28, fontSize: 12 }} onClick={() => setCalc(true)}><Calculator size={12} /> Size a system</button>}>
          {!data?.designs?.length && <Muted>No design yet — size a system from the survey measurements.</Muted>}
          {(data?.designs ?? []).map((d: any) => (
            <div key={d.id} style={{ background: 'var(--surface-2)', borderRadius: 10, padding: '10px 12px', marginBottom: 8 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <Zap size={14} style={{ color: 'var(--gold,#c67c1e)' }} />
                <b style={{ fontSize: 13.5 }}>{d.kwp} kWp</b>
                <span style={{ fontSize: 12, color: 'var(--ink-3)' }}>{d.panelCount} × {d.panelWattage} W · {d.inverterKw} kW inverter</span>
                <div style={{ flex: 1 }} />
                {d.valid
                  ? <span className="badge" style={{ background: 'var(--success-bg,#e6f4ea)', color: 'var(--success,#1e874b)' }}>Valid</span>
                  : <span className="badge" style={{ background: 'var(--danger-bg,#fce8e8)', color: 'var(--danger,#c0392b)' }}>Rejected</span>}
              </div>
              {(d.validationNotes ?? []).length > 0 && (
                <div style={{ fontSize: 11.5, color: d.valid ? 'var(--gold,#c67c1e)' : 'var(--danger,#c0392b)', marginTop: 6 }}>
                  {(d.validationNotes as string[]).map((n, i) => <div key={i}>• {n}</div>)}
                </div>
              )}
              {d.valid && d.systemCostInr > 0 && (
                <div style={{ fontSize: 11.5, color: 'var(--ink-3)', marginTop: 6 }}>
                  {fmtMoney(d.systemCostInr, p?.currency)} — materials {fmtMoney(d.materialsInr, p?.currency)}
                  {' '}· install {fmtMoney(d.installInr, p?.currency)}
                  {' '}· overhead &amp; margin {fmtMoney(d.overheadInr + d.marginInr, p?.currency)}
                </div>
              )}
            </div>
          ))}
        </Section>

        {latestProposal && (
          <Section title="Latest proposal">
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(120px,1fr))', gap: 10 }}>
              <Readout label="Annual output" value={fmtKwh(latestProposal.annualGenerationKwh)} />
              <Readout label="Annual saving" value={fmtMoney(latestProposal.annualSavingsInr, p?.currency)} strong />
              <Readout label="Payback" value={fmtPayback(latestProposal.paybackMonths)} />
              <Readout label={`${latestProposal.horizonYears}-yr saving`} value={fmtMoney(latestProposal.lifetimeSavingsInr, p?.currency)} />
              <Readout label="CO₂ / year" value={`${latestProposal.co2OffsetKgPerYear} kg`} />
            </div>
          </Section>
        )}

        <ProposalPanel projectId={id} currency={p?.currency} designs={data?.designs ?? []} proposals={data?.proposals ?? []} onChanged={refresh} />

        <MaterialsPanel projectId={id} currency={p?.currency} />
        <WorkOrdersPanel projectId={id} />
        <BillingPanel projectId={id} currency={p?.currency} />

        <Section title="Phase 2A — Live IoT Telemetry & Ingestion">
          <SolarTelemetryView projectId={id} projectCode={p?.code} customerName={p?.customerName} />
        </Section>

        <Section title="Phase 2B — AI Fault Engine & Service Tickets">
          <SolarFaultManagementView projectId={id} />
        </Section>

        <Section title="Phase 2C — Subscription & AMC Billing Engine">
          <SolarSubscriptionView />
        </Section>

        <Section title="Phase 3 — AI Copilot & Natural Platform Actions (#24)">
          <SolarAiCopilotView />
        </Section>

        <Section title="Phase 3 — CEO Executive Analytics Dashboard (#25)">
          <SolarCeoAnalyticsView />
        </Section>

        <Section title="Phase 3 — Customer PWA Mobile App & Portal (#26)">
          <SolarCustomerMobileAppView />
        </Section>

        <Section title="Phase 3 — Multi-Channel Notification Event Engine (#27)">
          <SolarNotificationEngineView />
        </Section>

        <Section title="Phase 4 — Crew Installation Fleet & GPS Odometer (#22)">
          <SolarFleetView />
        </Section>

        <Section title="Phase 4 — Multi-Warehouse Transfers & Solar Items (#10 & #9)">
          <SolarWarehouseDepthView />
        </Section>

        <Section title="Phase 4 — Document Version Control & Revision Tree (#23)">
          <SolarDocumentVersionView />
        </Section>

        {(data?.alerts ?? []).length > 0 && (
          <Section title="Open alerts">
            {data.alerts.map((a: any) => (
              <div key={a.id} style={{ fontSize: 12.5, color: 'var(--danger,#c0392b)', background: 'var(--danger-bg,#fce8e8)', borderRadius: 9, padding: '8px 11px', marginBottom: 6 }}>
                <AlertTriangle size={12} style={{ verticalAlign: -2 }} /> <b>{a.kind.replace(/_/g, ' ').toLowerCase()}</b> — {a.detail}
              </div>
            ))}
          </Section>
        )}

        {(data?.tickets ?? []).length > 0 && (
          <Section title="Service tickets">
            {data.tickets.map((t: any) => (
              <div key={t.id} style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 12.5, padding: '6px 0', borderBottom: '1px solid var(--line-soft)' }}>
                <span style={{ flex: 1 }}>{t.subject}</span>
                {t.underWarranty === true && <span className="badge" style={{ background: 'var(--success-bg,#e6f4ea)', color: 'var(--success,#1e874b)' }}>In warranty</span>}
                {t.underWarranty === false && <span className="badge" style={{ background: 'var(--surface-2)', color: 'var(--ink-3)' }}>Out of warranty</span>}
                <span style={{ fontSize: 11.5, color: 'var(--ink-3)' }}>{t.status.replace('_', ' ').toLowerCase()}</span>
              </div>
            ))}
          </Section>
        )}
      </div>
      {calc && <SizingCalculator projectId={id} currency={p?.currency} onSaved={refresh} onClose={() => { setCalc(false); refresh(); }} />}
    </>
  );
}

/**
 * Site & tariff, editable in place. A project converted from a lead arrives with no
 * tariff, and without one a proposal rightly refuses to quote — so the tariff has to
 * be settable here, not only at project creation.
 */
function TariffSection({ project: p, onSaved }: { project: SolarProject; onSaved: () => void }) {
  const [edit, setEdit] = useState(false);
  const [f, setF] = useState({ tariff: '', exportRate: '', metering: p.metering as MeteringType });
  const save = useMutation({
    mutationFn: () => api.patch(`/solar/projects/${p.id}`, {
      tariffMinorPerKwh: Math.round(Number(f.tariff) * 100),
      exportRateMinorPerKwh: Math.round(Number(f.exportRate) * 100),
      metering: f.metering,
    }),
    onSuccess: () => { toast.success('Tariff saved'); setEdit(false); onSaved(); },
    onError: (e) => toast.error(apiErrorMessage(e)),
  });
  const open = () => { setF({ tariff: (p.tariffMinorPerKwh / 100).toFixed(2), exportRate: (p.exportRateMinorPerKwh / 100).toFixed(2), metering: p.metering }); setEdit(true); };

  return (
    <Section title="Site & tariff" action={!edit && <button className="btn-secondary" style={{ height: 26, fontSize: 11.5 }} onClick={open}>Edit</button>}>
      {!edit ? (
        <>
          <KV k="Metering" v={METERING_LABEL[p.metering]} />
          <KV k="Tariff" v={p.tariffMinorPerKwh > 0 ? `${(p.tariffMinorPerKwh / 100).toFixed(2)} ${p.currency}/kWh` : 'not set — needed before a proposal'} />
          {p.metering !== 'NONE' && <KV k="Export rate" v={`${(p.exportRateMinorPerKwh / 100).toFixed(2)} ${p.currency}/kWh`} />}
          {!!p.contractValueInr && <KV k="Contract value" v={fmtMoney(p.contractValueInr, p.currency)} />}
          {p.commissionedAt && <KV k="Commissioned" v={fmtDate(p.commissionedAt)} />}
        </>
      ) : (
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'flex-end' }}>
          <div style={{ flex: '1 1 110px' }}><label className="label" style={{ fontSize: 10.5 }}>Tariff / kWh</label>
            <input className="input" style={{ height: 32, fontSize: 12.5 }} type="number" step="0.01" value={f.tariff} onChange={(e) => setF({ ...f, tariff: e.target.value })} /></div>
          <div style={{ flex: '1 1 110px' }}><label className="label" style={{ fontSize: 10.5 }}>Export / kWh</label>
            <input className="input" style={{ height: 32, fontSize: 12.5 }} type="number" step="0.01" value={f.exportRate} onChange={(e) => setF({ ...f, exportRate: e.target.value })} disabled={f.metering === 'NONE'} /></div>
          <div style={{ flex: '2 1 180px' }}><label className="label" style={{ fontSize: 10.5 }}>Metering</label>
            <select className="input" style={{ height: 32, fontSize: 12.5 }} value={f.metering} onChange={(e) => setF({ ...f, metering: e.target.value as MeteringType })}>
              {(Object.keys(METERING_LABEL) as MeteringType[]).map((m) => <option key={m} value={m}>{METERING_LABEL[m]}</option>)}
            </select></div>
          <button className="btn-secondary" style={{ height: 32, fontSize: 12 }} onClick={() => setEdit(false)}>Cancel</button>
          <button className="btn-primary" style={{ height: 32, fontSize: 12 }} disabled={save.isPending} onClick={() => save.mutate()}>Save</button>
        </div>
      )}
    </Section>
  );
}

function Section({ title, action, children }: { title: string; action?: React.ReactNode; children: React.ReactNode }) {
  return (
    <div style={{ marginBottom: 18 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 9 }}>
        <div style={{ fontWeight: 700, fontSize: 13 }}>{title}</div>
        <div style={{ flex: 1 }} />
        {action}
      </div>
      {children}
    </div>
  );
}
function KV({ k, v }: { k: string; v: string }) {
  return <div style={{ display: 'flex', fontSize: 12.5, padding: '4px 0' }}><span style={{ color: 'var(--ink-3)', width: 140 }}>{k}</span><span>{v}</span></div>;
}
function Muted({ children }: { children: React.ReactNode }) {
  return <div style={{ fontSize: 12.5, color: 'var(--ink-3)' }}>{children}</div>;
}

// shared
function Overlay({ title, children, onClose, wide }: { title: string; children: React.ReactNode; onClose: () => void; wide?: boolean }) {
  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 62, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }}>
      <div style={{ position: 'absolute', inset: 0, background: 'rgba(20,15,12,.42)' }} onClick={onClose} />
      <div style={{ ...card, position: 'relative', zIndex: 1, width: wide ? 620 : 480, maxWidth: '100%', maxHeight: '92vh', overflowY: 'auto', padding: 22, borderRadius: 18 }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
          <div style={{ fontWeight: 700, fontSize: 15 }}>{title}</div>
          <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--ink-3)' }}><X size={20} /></button>
        </div>
        {children}
      </div>
    </div>
  );
}
function Actions({ onClose, onSubmit, disabled, label }: { onClose: () => void; onSubmit: () => void; disabled: boolean; label: string }) {
  return <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10, marginTop: 18 }}><button className="btn-secondary" onClick={onClose}>Cancel</button><button className="btn-primary" disabled={disabled} onClick={onSubmit}>{label}</button></div>;
}
