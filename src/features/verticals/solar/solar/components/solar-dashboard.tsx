'use client';

import Link from 'next/link';
import { useMutation, useQuery } from '@tanstack/react-query';
import { Sun, Zap, Wallet, TrendingUp, AlertTriangle, Package, HardHat, CheckCircle2, ArrowRight } from 'lucide-react';
import { api, apiErrorMessage } from '@/lib/api';
import { toast } from 'sonner';
import { useState } from 'react';
import { useAuth } from '@/features/foundation/auth';
import { SolarProject, SolarStats, STAGE_LABEL, STAGE_ORDER, SolarStage, fmtMoney } from '../solar-client';

const card: React.CSSProperties = { background: 'var(--surface)', border: '1px solid var(--line-soft)', borderRadius: 16 };

interface Portfolio {
  projects: number; contractedInr: number;
  billing: Record<string, { count: number; amountInr: number }>;
  commission: { accruedInr: number; paidInr: number };
  workOrders: Record<string, number>;
  materialRequests: Record<string, number>;
}

export function SolarDashboard() {
  const { user } = useAuth();
  const currency = 'AED';
  const { data: stats } = useQuery({ queryKey: ['solar-stats'], queryFn: async () => (await api.get<SolarStats>('/solar/stats')).data });
  const { data: pf } = useQuery({ queryKey: ['solar-portfolio'], queryFn: async () => (await api.get<Portfolio>('/solar/portfolio')).data });
  const { data: projects } = useQuery({ queryKey: ['solar-projects', ''], queryFn: async () => (await api.get<SolarProject[]>('/solar/projects')).data });

  const today = new Date().toLocaleDateString('en-AE', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
  const pipeline = stats?.pipeline ?? {};
  const inFlight = STAGE_ORDER.filter((s) => (pipeline[s] ?? 0) > 0);
  const maxStage = Math.max(1, ...STAGE_ORDER.map((s) => pipeline[s] ?? 0));
  const invoiced = pf?.billing?.INVOICED?.amountInr ?? 0;
  const paid = pf?.billing?.PAID?.amountInr ?? 0;
  const pending = pf?.billing?.PENDING?.amountInr ?? 0;

  return (
    <div style={{ animation: 'fadeUp .4s ease' }}>
      <div style={{ marginBottom: 20 }}>
        <div style={{ fontSize: 11.5, letterSpacing: '.08em', textTransform: 'uppercase', color: 'var(--ink-3)' }}>{today}</div>
        <h1 style={{ fontSize: 31, fontWeight: 700, letterSpacing: '-.02em', margin: '6px 0 0', lineHeight: 1.1 }}>Solar Overview</h1>
        <p style={{ fontSize: 14.5, color: 'var(--ink-2)', margin: '8px 0 0' }}>
          Welcome back{user?.firstName ? `, ${user.firstName}` : ''} — {stats?.designedKwp ?? 0} kWp designed across {pf?.projects ?? 0} project{(pf?.projects ?? 0) === 1 ? '' : 's'}.
        </p>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(180px,1fr))', gap: 12, marginBottom: 16 }}>
        <Kpi icon={Zap} label="Designed capacity" value={`${stats?.designedKwp ?? 0} kWp`} sub="across all valid designs" />
        <Kpi icon={Wallet} label="Contracted" value={fmtMoney(pf?.contractedInr ?? 0, currency)} sub={`${stats?.wonProjects ?? 0} won project${(stats?.wonProjects ?? 0) === 1 ? '' : 's'}`} />
        <Kpi icon={CheckCircle2} label="Commissioned" value={String(stats?.commissioned ?? 0)} sub="systems generating" />
        <Kpi icon={AlertTriangle} label="Open alerts" value={String(stats?.openAlerts ?? 0)}
             sub={stats?.openTickets ? `${stats.openTickets} open ticket${stats.openTickets === 1 ? '' : 's'}` : 'no service tickets'}
             accent={stats?.openAlerts ? 'var(--danger,#c0392b)' : undefined} />
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0,1.4fr) minmax(0,1fr)', gap: 14, alignItems: 'start' }}>
        <div style={{ ...card, padding: 18 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 14 }}>
            <Sun size={15} style={{ color: 'var(--gold,#c67c1e)' }} />
            <div style={{ fontWeight: 700, fontSize: 14 }}>Pipeline</div>
            <div style={{ flex: 1 }} />
            <Link href="/solar" style={{ fontSize: 12.5, color: 'var(--brand,#132376)', fontWeight: 600, textDecoration: 'none' }}>
              All projects <ArrowRight size={12} style={{ verticalAlign: -1 }} />
            </Link>
          </div>
          {!inFlight.length && <Muted>Nothing in the pipeline yet — create a project from an enquiry to get started.</Muted>}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 7 }}>
            {inFlight.map((s) => (
              <div key={s} style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <div style={{ width: 118, fontSize: 12.5, color: 'var(--ink-2)' }}>{STAGE_LABEL[s]}</div>
                <div style={{ flex: 1, height: 8, borderRadius: 5, background: 'var(--surface-2)', overflow: 'hidden' }}>
                  <div style={{ width: `${((pipeline[s] ?? 0) / maxStage) * 100}%`, height: '100%', background: 'var(--brand,#132376)' }} />
                </div>
                <div style={{ width: 26, textAlign: 'right', fontSize: 12.5, fontWeight: 700, fontVariantNumeric: 'tabular-nums' }}>{pipeline[s]}</div>
              </div>
            ))}
          </div>
        </div>

        <div style={{ ...card, padding: 18 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 14 }}>
            <TrendingUp size={15} style={{ color: 'var(--ink-3)' }} />
            <div style={{ fontWeight: 700, fontSize: 14 }}>Billing & commission</div>
          </div>
          <Row label="Invoiced, awaiting payment" value={fmtMoney(invoiced, currency)} />
          <Row label="Collected" value={fmtMoney(paid, currency)} strong />
          <Row label="Still to bill" value={fmtMoney(pending, currency)} />
          <div style={{ borderTop: '1px solid var(--line-soft)', margin: '10px 0' }} />
          <Row label="Dealer commission accrued" value={fmtMoney(pf?.commission.accruedInr ?? 0, currency)} />
          <Row label="Paid to dealers" value={fmtMoney(pf?.commission.paidInr ?? 0, currency)} />
          <div style={{ fontSize: 11, color: 'var(--ink-3)', marginTop: 8 }}>Commission is earned on booking and paid as the customer pays.</div>
        </div>

        <DealersCard />
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(260px,1fr))', gap: 14, marginTop: 14 }}>
        <div style={{ ...card, padding: 18 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
            <HardHat size={15} style={{ color: 'var(--ink-3)' }} />
            <div style={{ fontWeight: 700, fontSize: 14 }}>Work on site</div>
          </div>
          <Row label="Scheduled" value={String(pf?.workOrders?.SCHEDULED ?? 0)} />
          <Row label="In progress" value={String(pf?.workOrders?.IN_PROGRESS ?? 0)} />
          <Row label="Completed" value={String(pf?.workOrders?.COMPLETE ?? 0)} />
          {(stats?.overdueVisits ?? 0) > 0 && (
            <div style={{ fontSize: 12, color: 'var(--gold,#c67c1e)', marginTop: 8 }}>
              <AlertTriangle size={11} style={{ verticalAlign: -1 }} /> {stats!.overdueVisits} AMC visit(s) overdue
            </div>
          )}
        </div>

        <div style={{ ...card, padding: 18 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
            <Package size={15} style={{ color: 'var(--ink-3)' }} />
            <div style={{ fontWeight: 700, fontSize: 14 }}>Materials</div>
          </div>
          <Row label="Short of stock" value={String(pf?.materialRequests?.SHORT ?? 0)} accent={(pf?.materialRequests?.SHORT ?? 0) > 0 ? 'var(--danger,#c0392b)' : undefined} />
          <Row label="On order" value={String(pf?.materialRequests?.ORDERED ?? 0)} />
          <Row label="Ready to issue" value={String(pf?.materialRequests?.ALLOCATED ?? 0)} />
          <Row label="Issued to site" value={String(pf?.materialRequests?.ISSUED ?? 0)} />
        </div>

        <div style={{ ...card, padding: 18 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
            <Sun size={15} style={{ color: 'var(--ink-3)' }} />
            <div style={{ fontWeight: 700, fontSize: 14 }}>Recent projects</div>
          </div>
          {!projects?.length && <Muted>No projects yet.</Muted>}
          {(projects ?? []).slice(0, 5).map((p) => (
            <Link key={p.id} href="/solar" style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '6px 0', textDecoration: 'none', color: 'inherit', borderBottom: '1px solid var(--line-soft)' }}>
              <span style={{ flex: 1, fontSize: 12.5, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{p.code} · {p.customerName}</span>
              <span className="badge" style={{ background: 'var(--surface-2)', color: 'var(--ink-3)', whiteSpace: 'nowrap' }}>{STAGE_LABEL[p.stage as SolarStage]}</span>
            </Link>
          ))}
        </div>
      </div>
    </div>
  );
}

function Kpi({ icon: Icon, label, value, sub, accent }: { icon: any; label: string; value: string; sub?: string; accent?: string }) {
  return (
    <div style={{ ...card, padding: '16px 18px' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 7, fontSize: 11.5, letterSpacing: '.04em', textTransform: 'uppercase', color: 'var(--ink-3)' }}>
        <Icon size={13} /> {label}
      </div>
      <div style={{ fontSize: 27, fontWeight: 800, marginTop: 6, color: accent, letterSpacing: '-.02em' }}>{value}</div>
      {sub && <div style={{ fontSize: 12, color: 'var(--ink-3)', marginTop: 2 }}>{sub}</div>}
    </div>
  );
}
function Row({ label, value, strong, accent }: { label: string; value: string; strong?: boolean; accent?: string }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '5px 0', fontSize: 12.5 }}>
      <span style={{ flex: 1, color: 'var(--ink-2)' }}>{label}</span>
      <span style={{ fontWeight: strong ? 800 : 600, color: accent, fontVariantNumeric: 'tabular-nums' }}>{value}</span>
    </div>
  );
}
const Muted = ({ children }: { children: React.ReactNode }) => <div style={{ fontSize: 12.5, color: 'var(--ink-3)' }}>{children}</div>;


/** Dealer roster with one-click portal invites — no SQL, no console. */
function DealersCard() {
  const { data: dealers } = useQuery({ queryKey: ['solar-dealers'], queryFn: async () => (await api.get<{ id: string; name: string; email: string | null; phone: string | null }[]>('/solar/dealers')).data });
  const [link, setLink] = useState<string | null>(null);
  const invite = useMutation({
    mutationFn: async (dealerId: string) => (await api.post<{ link: string; email: string }>(`/portal-accounts/solar-dealers/${dealerId}/invite`, {})).data,
    onSuccess: (r) => { setLink(r.link); toast.success(`Invite created for ${r.email} — share the link`); },
    onError: (e) => toast.error(apiErrorMessage(e)),
  });
  return (
    <div className="card" style={{ padding: 18 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
        <Wallet size={15} style={{ color: 'var(--ink-3)' }} />
        <div style={{ fontWeight: 700, fontSize: 14 }}>Dealers</div>
      </div>
      {(dealers ?? []).length === 0 && <div style={{ fontSize: 12.5, color: 'var(--ink-3)' }}>No dealers yet.</div>}
      {(dealers ?? []).map((d) => (
        <div key={d.id} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '7px 0', borderBottom: '1px solid var(--line-soft)', fontSize: 13 }}>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontWeight: 600 }}>{d.name}</div>
            <div style={{ fontSize: 11.5, color: 'var(--ink-3)', overflow: 'hidden', textOverflow: 'ellipsis' }}>{d.email ?? d.phone ?? ''}</div>
          </div>
          <button className="btn-secondary" style={{ height: 26, fontSize: 11.5 }} disabled={invite.isPending} onClick={() => invite.mutate(d.id)}>Invite to portal</button>
        </div>
      ))}
      {link && (
        <div style={{ display: 'flex', gap: 8, alignItems: 'center', background: 'var(--surface-2)', borderRadius: 9, padding: '8px 10px', marginTop: 10, fontSize: 12 }}>
          <span style={{ flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', fontFamily: 'var(--mono)' }}>{link}</span>
          <button className="btn-secondary" style={{ height: 24, fontSize: 11 }} onClick={() => { navigator.clipboard?.writeText(link); toast.success('Link copied'); }}>Copy</button>
        </div>
      )}
    </div>
  );
}
