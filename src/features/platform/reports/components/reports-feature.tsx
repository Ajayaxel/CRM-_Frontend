'use client';

import { useQuery } from '@tanstack/react-query';
import { Lock } from 'lucide-react';
import { api } from '@/lib/api';
import { useAuth } from '@/features/foundation/auth';
import {
  ReportOverview, SourceRow, CounsellorRow,
  formatInrCompact, barColor, avatarColor, personInitials,
} from '../reports-utils';

const card: React.CSSProperties = {
  background: 'var(--surface)', border: '1px solid var(--line-soft)',
  borderRadius: 20, boxShadow: 'var(--shadow-1)',
};
const mono: React.CSSProperties = {
  fontFamily: 'var(--mono)', fontSize: 10, letterSpacing: '.1em',
  textTransform: 'uppercase', color: 'var(--ink-3)',
};

export function ReportsFeature() {
  const { user } = useAuth();
  const isGrowthPlus = user?.organization.plan !== 'STARTER';

  const { data: overview } = useQuery({
    queryKey: ['report-overview'],
    queryFn: async () => (await api.get<ReportOverview>('/reports/overview')).data,
  });
  const { data: sources } = useQuery({
    queryKey: ['report-sources'],
    queryFn: async () => (await api.get<SourceRow[]>('/reports/leads-by-source')).data,
  });
  const { data: counsellors } = useQuery({
    queryKey: ['report-counsellors'],
    queryFn: async () => (await api.get<CounsellorRow[]>('/reports/counsellor-performance')).data,
    enabled: isGrowthPlus,
  });

  const kpis = [
    { label: 'Total Leads', value: overview ? overview.totalLeads.toLocaleString('en-IN') : '—', sub: `${overview?.converted ?? 0} converted` },
    { label: 'Conversion Rate', value: overview ? `${overview.conversionRate}%` : '—', sub: 'won / total' },
    { label: 'Admissions', value: overview ? String(overview.admissions) : '—', sub: 'applications' },
    { label: 'Revenue', value: overview ? formatInrCompact(overview.revenue) : '—', sub: `${formatInrCompact(overview?.pipelineValue ?? 0)} pipeline` },
  ];

  const maxSource = Math.max(1, ...(sources ?? []).map((s) => s.count));

  return (
    <div style={{ animation: 'fadeUp .4s ease' }}>
      <div style={{ marginBottom: 22 }}>
        <h1 style={{ fontSize: 28, fontWeight: 700, letterSpacing: '-.02em', margin: 0 }}>Reports &amp; Analytics</h1>
        <p style={{ fontSize: 14, color: 'var(--ink-2)', margin: '6px 0 0' }}>Lead, admission &amp; revenue insights.</p>
      </div>

      {/* KPI strip */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 18, marginBottom: 20 }}>
        {kpis.map((k) => (
          <div key={k.label} style={{ ...card, borderRadius: 18, padding: '18px 20px' }}>
            <div style={mono}>{k.label}</div>
            <div style={{ fontSize: 28, fontWeight: 800, letterSpacing: '-.02em', marginTop: 10 }}>{k.value}</div>
            <div style={{ fontSize: 12, color: 'var(--success)', marginTop: 5 }}>{k.sub}</div>
          </div>
        ))}
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1.4fr 1fr', gap: 20 }}>
        {/* Leads by Source */}
        <div style={{ ...card, padding: '22px 24px' }}>
          <div style={{ fontWeight: 700, fontSize: 15, marginBottom: 4 }}>Leads by Source</div>
          <div style={{ fontSize: 12, color: 'var(--ink-3)', marginBottom: 20 }}>Where enquiries come from</div>
          <div style={{ display: 'flex', alignItems: 'flex-end', gap: 20, height: 180, padding: '0 6px' }}>
            {(sources ?? []).map((s, i) => {
              const bc = barColor(i);
              return (
                <div key={s.source} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8, height: '100%', justifyContent: 'flex-end' }}>
                  <div style={{ fontSize: 12, fontWeight: 700 }}>{s.count}</div>
                  <div style={{ width: '100%', maxWidth: 44, height: `${Math.max(6, (s.count / maxSource) * 82)}%`, background: bc.background, opacity: bc.opacity, borderRadius: '8px 8px 0 0' }} />
                  <span style={{ fontSize: 11, color: 'var(--ink-3)' }}>{s.label}</span>
                </div>
              );
            })}
            {(!sources || sources.length === 0) && <div style={{ color: 'var(--ink-3)', fontSize: 13, margin: 'auto' }}>No lead data yet.</div>}
          </div>
        </div>

        {/* Counsellor Performance (Growth) */}
        <div style={{ ...card, padding: '22px 24px' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
            <div style={{ fontWeight: 700, fontSize: 15 }}>Counsellor Performance</div>
            {!isGrowthPlus && <span className="badge" style={{ background: 'var(--gold-bg)', color: 'var(--gold-ink)' }}>Growth</span>}
          </div>

          {!isGrowthPlus ? (
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '30px 10px', textAlign: 'center' }}>
              <span style={{ width: 44, height: 44, borderRadius: 99, background: 'var(--gold-bg)', color: 'var(--gold-ink)', display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: 12 }}>
                <Lock size={20} />
              </span>
              <div style={{ fontWeight: 600, fontSize: 14 }}>Counsellor analytics is a Growth feature</div>
              <div style={{ fontSize: 12.5, color: 'var(--ink-3)', marginTop: 4, maxWidth: 240 }}>Upgrade to compare conversion rates and revenue across your team.</div>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 15 }}>
              {counsellors?.map((c) => (
                <div key={c.userId} style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                  <span style={{ width: 36, height: 36, borderRadius: 99, background: avatarColor(c.userId), color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 13, fontWeight: 700, flex: '0 0 36px' }}>{personInitials(c.name)}</span>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13 }}>
                      <span style={{ fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{c.name}</span>
                      <span style={{ fontWeight: 700 }}>{c.conversionRate}%</span>
                    </div>
                    <div style={{ height: 6, borderRadius: 99, background: 'var(--surface-2)', marginTop: 5, overflow: 'hidden' }}>
                      <div style={{ width: `${c.conversionRate}%`, height: '100%', background: 'var(--success)', borderRadius: 99 }} />
                    </div>
                    <div style={{ fontSize: 11, color: 'var(--ink-3)', marginTop: 3 }}>{c.converted}/{c.assigned} converted · {formatInrCompact(c.revenue)}</div>
                  </div>
                </div>
              ))}
              {counsellors?.length === 0 && <div style={{ color: 'var(--ink-3)', fontSize: 13 }}>No assigned leads yet.</div>}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
