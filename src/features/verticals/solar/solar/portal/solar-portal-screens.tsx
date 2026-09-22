'use client';

import { useEffect, useState } from 'react';
import { Sun, Zap, Wallet, ShieldCheck, AlertTriangle, FileText, Users2, TrendingUp } from 'lucide-react';
import { portalApi } from '@/features/experiences/portal/portal-client';

/**
 * E10 — the customer and dealer screens.
 *
 * Thin, read-mostly views over endpoints that derive their subject from the session.
 * Nothing here passes an id: there is no id to pass, which is what makes these safe by
 * construction rather than by careful rendering. No link on these pages carries a
 * record id either.
 */

const card: React.CSSProperties = { background: 'var(--surface,#fff)', border: '1px solid var(--line-soft,#e4e7ee)', borderRadius: 14, padding: 16 };
const money = (n: number, c = 'AED') => `${c} ${Math.round(n ?? 0).toLocaleString('en-AE')}`;
const day = (d?: string | null) => (d ? new Date(d).toLocaleDateString('en-AE', { day: '2-digit', month: 'short', year: 'numeric' }) : '—');

function useFetch<T>(path: string) {
  const [data, setData] = useState<T | null>(null);
  const [error, setError] = useState<string | null>(null);
  useEffect(() => {
    let live = true;
    portalApi<T>(path)
      .then((d) => live && setData(d))
      .catch((e: any) => live && setError(e?.message ?? 'Could not load'));
    return () => { live = false; };
  }, [path]);
  return { data, error };
}

// ===================== Customer =====================
export function SolarCustomerPortal({ accent = '#132376' }: { accent?: string }) {
  const { data: proj, error } = useFetch<any>('/portal/me/solar/project');
  const { data: proposal } = useFetch<any>('/portal/me/solar/proposal');
  const { data: invoices } = useFetch<any[]>('/portal/me/solar/invoices');
  const { data: gen } = useFetch<any>('/portal/me/solar/generation?days=30');

  if (error) return <Note tone="bad">{error}</Note>;
  if (!proj) return <Note>Loading your system…</Note>;
  const cur = proj.project?.currency ?? 'AED';

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
      <div>
        <h1 style={{ fontSize: 21, fontWeight: 700, margin: 0 }}>{proj.project.code} · your solar system</h1>
        <div style={{ fontSize: 13, color: 'var(--ink-3,#828a9e)', marginTop: 3 }}>
          {proj.project.siteAddress || proj.project.customerName} · {STAGE_LABEL[proj.project.stage] ?? proj.project.stage}
        </div>
      </div>

      {proj.system && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(130px,1fr))', gap: 10 }}>
          <Kpi icon={Sun} label="System size" value={`${proj.system.kwp} kWp`} accent={accent} />
          <Kpi icon={Zap} label="Panels" value={`${proj.system.panelCount} × ${proj.system.panelWattage} W`} />
          <Kpi icon={Zap} label="Inverter" value={`${proj.system.inverterKw} kW`} />
          {proj.system.batteryKwh > 0 && <Kpi icon={Zap} label="Battery" value={`${proj.system.batteryKwh} kWh`} />}
        </div>
      )}

      {(proj.alerts ?? []).length > 0 && (
        <div style={{ ...card, borderColor: '#f0c4c4', background: '#fce8e8' }}>
          <B icon={AlertTriangle}>Needs attention</B>
          {proj.alerts.map((a: any, i: number) => (
            <div key={i} style={{ fontSize: 13, color: '#c0392b', marginTop: 6 }}>{a.detail}</div>
          ))}
        </div>
      )}

      {/* Generation only exists once the system is live — say so rather than showing an empty chart. */}
      <div style={card}>
        <B icon={TrendingUp}>Generation</B>
        {!gen?.commissioned ? (
          <div style={{ fontSize: 13, color: 'var(--ink-3,#828a9e)', marginTop: 8 }}>
            Your system isn&apos;t generating yet — this fills in once it&apos;s commissioned.
          </div>
        ) : (
          <>
            <div style={{ display: 'flex', gap: 18, marginTop: 10, flexWrap: 'wrap' }}>
              <Fig label="Last 30 days" value={`${gen.totalKwh} kWh`} />
              <Fig label="Expected" value={`${gen.expectedKwh} kWh`} />
              <Fig label="Performance" value={gen.performancePct != null ? `${gen.performancePct}%` : '—'}
                   color={(gen.performancePct ?? 100) >= 85 ? '#1e874b' : '#c67c1e'} />
            </div>
            <Spark readings={gen.readings ?? []} accent={accent} />
          </>
        )}
      </div>

      {proposal && (
        <div style={card}>
          <B icon={FileText}>Your proposal</B>
          <div style={{ display: 'flex', gap: 18, marginTop: 10, flexWrap: 'wrap' }}>
            <Fig label="Annual output" value={`${Math.round(proposal.annualGenerationKwh).toLocaleString('en-AE')} kWh`} />
            <Fig label="Annual saving" value={money(proposal.annualSavingsInr, cur)} />
            <Fig label="Investment" value={money(proposal.systemCostInr, cur)} />
          </div>
          <div style={{ marginTop: 10, fontSize: 13 }}>
            {proposal.signedAt
              ? <span style={{ color: '#1e874b', fontWeight: 600 }}><ShieldCheck size={13} style={{ verticalAlign: -2 }} /> Accepted by {proposal.signedName} on {day(proposal.signedAt)}</span>
              : <span style={{ color: 'var(--ink-3,#828a9e)' }}>Sent — awaiting your acceptance</span>}
          </div>
          {proposal.narrative && <div style={{ fontSize: 13.5, color: 'var(--ink-2,#4a5268)', marginTop: 10, lineHeight: 1.5 }}>{proposal.narrative}</div>}
        </div>
      )}

      <div style={card}>
        <B icon={Wallet}>Payments</B>
        {!invoices?.length && <Muted>Nothing billed yet.</Muted>}
        {(invoices ?? []).map((m: any, i: number) => (
          <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '7px 0', borderBottom: '1px solid var(--line-soft,#e4e7ee)', fontSize: 13.5 }}>
            <span style={{ flex: 1 }}>{m.milestone}{m.invoice?.number ? ` · ${m.invoice.number}` : ''}</span>
            <span style={{ fontVariantNumeric: 'tabular-nums' }}>{money(m.amountInr, cur)}</span>
            <Pill tone={m.status === 'PAID' ? 'good' : m.status === 'INVOICED' ? 'warn' : 'plain'}>{m.status.toLowerCase()}</Pill>
          </div>
        ))}
      </div>

      {(proj.warranty ?? []).length > 0 && (
        <div style={card}>
          <B icon={ShieldCheck}>Warranty</B>
          {proj.warranty.map((a: any, i: number) => (
            <div key={i} style={{ display: 'flex', gap: 10, padding: '6px 0', fontSize: 13, borderBottom: '1px solid var(--line-soft,#e4e7ee)' }}>
              <span style={{ flex: 1 }}>{a.kind.toLowerCase()}{a.make ? ` · ${a.make}` : ''} <span style={{ color: 'var(--ink-3,#828a9e)' }}>{a.serial}</span></span>
              <span style={{ color: 'var(--ink-3,#828a9e)' }}>to {day(a.productWarrantyEnd)}</span>
            </div>
          ))}
        </div>
      )}

      {proj.amc && (
        <div style={card}>
          <B icon={ShieldCheck}>Maintenance visits</B>
          {proj.amc.visits.map((v: any, i: number) => (
            <div key={i} style={{ display: 'flex', gap: 10, padding: '5px 0', fontSize: 13 }}>
              <span style={{ flex: 1 }}>{day(v.dueAt)}</span>
              <Pill tone={v.status === 'DONE' ? 'good' : 'plain'}>{v.status.toLowerCase()}</Pill>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ===================== Dealer =====================
export function SolarDealerPortal({ accent = '#0f766e' }: { accent?: string }) {
  const { data: stmt, error } = useFetch<any>('/portal/me/solar/dealer/statement');
  const { data: leads } = useFetch<any>('/portal/me/solar/dealer/leads');

  if (error) return <Note tone="bad">{error}</Note>;
  if (!stmt) return <Note>Loading your book…</Note>;
  const t = stmt.totals ?? {};
  const cur = stmt.projects?.[0]?.currency ?? 'AED';

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
      <div>
        <h1 style={{ fontSize: 21, fontWeight: 700, margin: 0 }}>{stmt.dealer?.name}</h1>
        <div style={{ fontSize: 13, color: 'var(--ink-3,#828a9e)', marginTop: 3 }}>Your projects and commission</div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(130px,1fr))', gap: 10 }}>
        <Kpi icon={Users2} label="Projects" value={String(t.projects ?? 0)} accent={accent} />
        <Kpi icon={Wallet} label="Contracted" value={money(t.contractedInr ?? 0, cur)} />
        <Kpi icon={TrendingUp} label="Commission earned" value={money(t.accruedInr ?? 0, cur)} />
        <Kpi icon={Wallet} label="Paid to you" value={money(t.paidInr ?? 0, cur)} />
      </div>
      <div style={{ fontSize: 12, color: 'var(--ink-3,#828a9e)', marginTop: -6 }}>
        Commission is earned when a project is won and paid as the customer pays.
      </div>

      <div style={card}>
        <B icon={Sun}>Your projects</B>
        {!stmt.projects?.length && <Muted>No projects yet.</Muted>}
        {(stmt.projects ?? []).map((p: any) => (
          <div key={p.id} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '8px 0', borderBottom: '1px solid var(--line-soft,#e4e7ee)', fontSize: 13.5 }}>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontWeight: 600 }}>{p.code} · {p.customerName}</div>
              <div style={{ fontSize: 12, color: 'var(--ink-3,#828a9e)' }}>{STAGE_LABEL[p.stage] ?? p.stage}</div>
            </div>
            <div style={{ textAlign: 'right', fontVariantNumeric: 'tabular-nums' }}>
              <div>{money(p.accruedInr, p.currency ?? cur)}</div>
              <div style={{ fontSize: 11.5, color: 'var(--ink-3,#828a9e)' }}>paid {money(p.paidInr, p.currency ?? cur)}</div>
            </div>
          </div>
        ))}
      </div>

      {leads?.projects?.length > 0 && (
        <div style={card}>
          <B icon={Users2}>Pipeline you introduced</B>
          {leads.projects.map((p: any) => (
            <div key={p.code} style={{ display: 'flex', gap: 10, padding: '6px 0', fontSize: 13.5, borderBottom: '1px solid var(--line-soft,#e4e7ee)' }}>
              <span style={{ flex: 1 }}>{p.code} · {p.customerName}</span>
              <Pill tone={p.stage === 'LOST' ? 'bad' : p.wonAt ? 'good' : 'plain'}>{STAGE_LABEL[p.stage] ?? p.stage}</Pill>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ===================== bits =====================
const STAGE_LABEL: Record<string, string> = {
  LEAD: 'Enquiry', SURVEY: 'Site survey', DESIGN: 'Design', PROPOSAL: 'Proposal', WON: 'Confirmed',
  PROCUREMENT: 'Ordering', INSTALLATION: 'Installing', COMMISSIONING: 'Commissioning',
  MONITORING: 'Live', AMC: 'Under maintenance', LOST: 'Closed',
};

function Kpi({ icon: Icon, label, value, accent }: { icon: any; label: string; value: string; accent?: string }) {
  return (
    <div style={{ ...card, padding: '13px 15px' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 11, textTransform: 'uppercase', letterSpacing: '.05em', color: 'var(--ink-3,#828a9e)' }}>
        <Icon size={12} /> {label}
      </div>
      <div style={{ fontSize: 19, fontWeight: 800, marginTop: 4, color: accent }}>{value}</div>
    </div>
  );
}
function Fig({ label, value, color }: { label: string; value: string; color?: string }) {
  return (
    <div><div style={{ fontSize: 11, color: 'var(--ink-3,#828a9e)' }}>{label}</div>
    <div style={{ fontSize: 16, fontWeight: 700, color }}>{value}</div></div>
  );
}
function Spark({ readings, accent }: { readings: any[]; accent: string }) {
  if (!readings.length) return null;
  const max = Math.max(...readings.map((r) => Math.max(r.kwh ?? 0, r.expectedKwh ?? 0)), 1);
  return (
    <div style={{ display: 'flex', alignItems: 'flex-end', gap: 2, height: 64, marginTop: 14 }}>
      {readings.map((r, i) => (
        <div key={i} title={`${new Date(r.date).toLocaleDateString('en-AE')} · ${r.kwh} kWh`}
          style={{ flex: 1, minWidth: 3, height: `${((r.kwh ?? 0) / max) * 100}%`, background: accent, opacity: 0.85, borderRadius: '2px 2px 0 0' }} />
      ))}
    </div>
  );
}
function B({ icon: Icon, children }: { icon: any; children: React.ReactNode }) {
  return <div style={{ display: 'flex', alignItems: 'center', gap: 7, fontWeight: 700, fontSize: 13.5 }}><Icon size={14} /> {children}</div>;
}
function Pill({ tone, children }: { tone: 'good' | 'warn' | 'bad' | 'plain'; children: React.ReactNode }) {
  const c = tone === 'good' ? { bg: '#e6f4ea', fg: '#1e874b' } : tone === 'warn' ? { bg: '#fdf2e2', fg: '#c67c1e' } : tone === 'bad' ? { bg: '#fce8e8', fg: '#c0392b' } : { bg: 'var(--surface-2,#f2f4f8)', fg: 'var(--ink-3,#828a9e)' };
  return <span style={{ background: c.bg, color: c.fg, borderRadius: 20, padding: '2px 10px', fontSize: 11.5, fontWeight: 600, whiteSpace: 'nowrap' }}>{children}</span>;
}
const Muted = ({ children }: { children: React.ReactNode }) => <div style={{ fontSize: 13, color: 'var(--ink-3,#828a9e)', marginTop: 6 }}>{children}</div>;
function Note({ children, tone }: { children: React.ReactNode; tone?: 'bad' }) {
  return <div style={{ ...card, textAlign: 'center', color: tone === 'bad' ? '#c0392b' : 'var(--ink-3,#828a9e)', fontSize: 13.5 }}>{children}</div>;
}
