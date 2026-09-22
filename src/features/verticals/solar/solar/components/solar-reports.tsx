'use client';

import { useQuery } from '@tanstack/react-query';
import { HardHat, TrendingUp } from 'lucide-react';
import { api } from '@/lib/api';
import { fmtOrgMoney } from '@/lib/org-locale';

const card: React.CSSProperties = { background: 'var(--surface)', border: '1px solid var(--line-soft)', borderRadius: 16, padding: 18 };
const th: React.CSSProperties = { textAlign: 'right', fontWeight: 600, color: 'var(--ink-3)', fontSize: 11, textTransform: 'uppercase', letterSpacing: '.04em', padding: '0 0 8px 10px' };
const td: React.CSSProperties = { textAlign: 'right', padding: '7px 0 7px 10px', fontVariantNumeric: 'tabular-nums', borderTop: '1px solid var(--line-soft)' };

/** E10 — the report screens over the reconciled endpoints. */
export function SolarReportsFeature() {
  const { data: tech } = useQuery({ queryKey: ['solar-rep-tech'], queryFn: async () => (await api.get<any>('/solar/reports/technicians')).data });
  const { data: c360 } = useQuery({ queryKey: ['solar-360'], queryFn: async () => (await api.get<any[]>('/solar/customers-360')).data });
  const { data: prod } = useQuery({ queryKey: ['solar-rep-prod'], queryFn: async () => (await api.get<any>('/solar/reports/production')).data });

  return (
    <div style={{ animation: 'fadeUp .4s ease' }}>
      <h1 style={{ fontSize: 26, fontWeight: 700, letterSpacing: '-.02em', margin: '0 0 4px' }}>Reports</h1>
      <p style={{ fontSize: 14, color: 'var(--ink-2)', margin: '0 0 18px' }}>Technician performance and energy production — totals reconcile to the underlying records.</p>

      <div style={{ ...card, marginBottom: 14 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontWeight: 700, fontSize: 14, marginBottom: 12 }}><HardHat size={15} /> Technician performance <span style={{ fontWeight: 400, fontSize: 12, color: 'var(--ink-3)' }}>last 90 days</span></div>
        {!tech?.teams?.length ? <Muted>No work orders in the period.</Muted> : (
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', fontSize: 13, borderCollapse: 'collapse' }}>
              <thead><tr>
                <th style={{ ...th, textAlign: 'left', paddingLeft: 0 }}>Crew</th>
                <th style={th}>Jobs</th><th style={th}>Done</th><th style={th}>Open</th>
                <th style={th}>Installs</th><th style={th}>PM</th>
                <th style={th}>On time</th><th style={th}>Late</th><th style={th}>On-time %</th><th style={th}>Avg hrs</th>
              </tr></thead>
              <tbody>
                {tech.teams.map((t: any) => (
                  <tr key={t.team}>
                    <td style={{ ...td, textAlign: 'left', paddingLeft: 0, fontWeight: 600 }}>{t.team}</td>
                    <td style={td}>{t.jobs}</td><td style={td}>{t.completed}</td><td style={td}>{t.open}</td>
                    <td style={td}>{t.installs}</td><td style={td}>{t.preventiveMaintenance}</td>
                    <td style={td}>{t.onTime}</td><td style={td}>{t.late}</td>
                    <td style={td}>{t.onTimePct != null ? `${t.onTimePct}%` : '—'}</td>
                    <td style={td}>{t.avgDurationHours ?? '—'}</td>
                  </tr>
                ))}
                <tr style={{ fontWeight: 700 }}>
                  <td style={{ ...td, textAlign: 'left', paddingLeft: 0 }}>Total</td>
                  <td style={td}>{tech.totals.jobs}</td><td style={td}>{tech.totals.completed}</td><td style={td}>{tech.totals.open}</td>
                  <td style={td} colSpan={2}></td>
                  <td style={td}>{tech.totals.onTime}</td><td style={td}>{tech.totals.late}</td><td style={td} colSpan={2}></td>
                </tr>
              </tbody>
            </table>
          </div>
        )}
      </div>

      <div style={card}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontWeight: 700, fontSize: 14, marginBottom: 12 }}><TrendingUp size={15} /> Energy production <span style={{ fontWeight: 400, fontSize: 12, color: 'var(--ink-3)' }}>last 30 days · expected vs actual</span></div>
        {!prod?.projects?.length ? <Muted>No generation readings in the period.</Muted> : (
          <>
            <div style={{ fontSize: 13, marginBottom: 12 }}>
              Fleet: <b>{prod.totals.generatedKwh.toLocaleString('en-AE')} kWh</b> of {prod.totals.expectedKwh.toLocaleString('en-AE')} expected
              {prod.totals.performancePct != null && <> · <b style={{ color: prod.totals.performancePct >= 85 ? 'var(--success,#1e874b)' : 'var(--gold,#c67c1e)' }}>{prod.totals.performancePct}%</b></>}
              <span style={{ color: 'var(--ink-3)' }}> · {prod.totals.readings} readings</span>
            </div>
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', fontSize: 13, borderCollapse: 'collapse' }}>
                <thead><tr>
                  <th style={{ ...th, textAlign: 'left', paddingLeft: 0 }}>Project</th>
                  <th style={th}>Generated kWh</th><th style={th}>Expected kWh</th><th style={th}>Performance</th><th style={th}>Readings</th>
                </tr></thead>
                <tbody>
                  {prod.projects.map((p: any) => (
                    <tr key={p.projectId}>
                      <td style={{ ...td, textAlign: 'left', paddingLeft: 0 }}><b>{p.code}</b> <span style={{ color: 'var(--ink-3)' }}>{p.customerName}</span></td>
                      <td style={td}>{p.generatedKwh.toLocaleString('en-AE')}</td>
                      <td style={td}>{p.expectedKwh.toLocaleString('en-AE')}</td>
                      <td style={{ ...td, color: (p.performancePct ?? 100) >= 85 ? 'var(--success,#1e874b)' : 'var(--gold,#c67c1e)' }}>{p.performancePct != null ? `${p.performancePct}%` : '—'}</td>
                      <td style={td}>{p.readings}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </>
        )}
      </div>

      <div style={{ ...card, marginTop: 16 }}>
        <div style={{ fontWeight: 700, fontSize: 14.5, marginBottom: 4 }}>Customer 360</div>
        <div style={{ fontSize: 12, color: 'var(--ink-3)', marginBottom: 10 }}>Every customer across their sites — contracts, service load, warranty exposure.</div>
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: 640 }}>
            <thead><tr>
              <th style={{ ...th, textAlign: 'left', paddingLeft: 0 }}>Customer</th>
              <th style={{ ...th, textAlign: 'left' }}>Segment</th>
              <th style={th}>Sites</th><th style={th}>Contracts</th><th style={th}>Open tickets</th><th style={th}>AMC</th><th style={th}>Open claims</th>
            </tr></thead>
            <tbody>
              {(c360 ?? []).map((c: any) => (
                <tr key={c.name + (c.phone ?? '')}>
                  <td style={{ ...td, textAlign: 'left', paddingLeft: 0 }}>{c.name}<div style={{ fontSize: 11, color: 'var(--ink-3)' }}>{c.phone ?? c.email ?? ''}</div></td>
                  <td style={{ ...td, textAlign: 'left', fontSize: 11.5 }}>{c.segment}</td>
                  <td style={td}>{c.sites.length}</td>
                  <td style={td}>{fmtOrgMoney(c.totalContractInr)}</td>
                  <td style={{ ...td, color: c.openTickets ? '#b8791f' : undefined }}>{c.openTickets}</td>
                  <td style={td}>{c.activeAmc}</td>
                  <td style={{ ...td, color: c.openClaims ? '#c0392b' : undefined }}>{c.openClaims}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
const Muted = ({ children }: { children: React.ReactNode }) => <div style={{ fontSize: 13, color: 'var(--ink-3)' }}>{children}</div>;
