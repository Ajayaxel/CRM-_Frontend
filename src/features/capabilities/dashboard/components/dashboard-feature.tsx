'use client';

import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import {
  Users2, Clock, GraduationCap, Target, IndianRupee, ChevronUp,
} from 'lucide-react';
import { api } from '@/lib/api';
import { useAuth } from '@/features/foundation/auth';
import { Segmented } from '@/components/molecules/segmented';
import { labelFor } from '@/lib/org-locale';
import { ConversionRank } from './conversion-rank';
import { Performance } from './performance';
import { TeamWorkspace } from './team-workspace';
import { RecentActivity } from './recent-activity';
import { PipelineFunnel } from './pipeline-funnel';
import { AdmissionRing } from './admission-ring';
import { TopCounsellor } from './top-counsellor';

interface OrgProfile {
  _count: { users: number; branches: number; leads: number; students: number };
}

const card: React.CSSProperties = {
  background: 'var(--surface)',
  border: '1px solid var(--line-soft)',
  borderRadius: 20,
  boxShadow: 'var(--shadow-1)',
};
const mono: React.CSSProperties = {
  fontFamily: 'var(--mono)', fontSize: 10, letterSpacing: '.1em',
  textTransform: 'uppercase', color: 'var(--ink-3)',
};

export function DashboardFeature() {
  const { user } = useAuth();
  const [period, setPeriod] = useState<'week' | 'month' | 'quarter'>('month');

  // Query live backend report metrics
  const { data: overview } = useQuery({
    queryKey: ['reports-overview'],
    queryFn: async () => (await api.get<any>('/reports/overview')).data,
  });

  // Query live due tasks for today
  const { data: tasksData } = useQuery({
    queryKey: ['dashboard-tasks-today'],
    queryFn: async () => {
      const todayStr = new Date().toISOString().split('T')[0];
      const res = await api.get<any>(`/tasks?dueDate=${todayStr}&limit=1`);
      return res.data;
    },
  });

  // This dashboard is the fallback for every vertical without a bespoke one, so
  // its vocabulary cannot assume an institute. "Admissions Overview" on a digital
  // agency tenant told the customer they had opened the wrong product.
  const vertical = user?.organization?.vertical;
  const isEducation = vertical === 'INSTITUTE' || vertical === 'STUDY_ABROAD';
  const convertedNoun = isEducation ? 'Admissions' : 'Converted';
  const pageTitle = isEducation ? 'Admissions Overview' : 'Business Overview';
  const ownerLabel = labelFor(vertical, 'lead.owner') ?? 'Owner';

  const totalLeads = overview?.totalLeads ?? 0;
  const admissions = overview?.admissions ?? 0;
  const revenue = overview?.revenue ?? 0;
  const conversionRate = overview?.conversionRate ?? 0;
  const todayTasksCount = tasksData?.total ?? tasksData?.data?.length ?? 0;

  const formatRevenue = (val: number) => {
    if (!val) return '₹0';
    if (val >= 100000) {
      return `₹${(val / 100000).toFixed(1)}L`;
    }
    if (val >= 1000) {
      return `₹${(val / 1000).toFixed(0)}K`;
    }
    return `₹${val}`;
  };

  const kpis = [
    { label: 'Total Leads', value: String(totalLeads), icon: Users2, tint: 'var(--gold-bg)', color: 'var(--gold-ink)', sub: `${conversionRate}% conversion rate`, good: true },
    { label: 'Tasks Due Today', value: String(todayTasksCount), icon: Clock, tint: 'var(--danger-bg)', color: 'var(--danger)', sub: todayTasksCount > 0 ? 'Action required' : 'All caught up!', good: todayTasksCount === 0 },
    { label: convertedNoun, value: String(admissions), icon: isEducation ? GraduationCap : Target, tint: 'var(--success-bg)', color: 'var(--success)', sub: 'converted profiles', good: true },
    { label: 'Revenue Collected', value: formatRevenue(revenue), icon: IndianRupee, tint: 'rgba(19,35,118,.09)', color: 'var(--navy)', sub: 'live payments total', good: true },
  ];

  return (
    <div style={{ animation: 'fadeUp .4s ease' }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', gap: 20, flexWrap: 'wrap', marginBottom: 24 }}>
        <div>
          <div style={{ ...mono, fontSize: 11, letterSpacing: '.14em', marginBottom: 8 }}>
            {new Date().toLocaleDateString('en-IN', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}
          </div>
          <h1 style={{ fontSize: 31, fontWeight: 700, letterSpacing: '-.02em', margin: 0, lineHeight: 1.1 }}>{pageTitle}</h1>
          <p style={{ fontSize: 15, color: 'var(--ink-2)', margin: '8px 0 0' }}>
            {/* Built from the same numbers the KPI strip shows. The old copy asserted
                "8 follow-ups are due today and 5 new leads came in overnight" on every
                render — beside KPIs reading zero. */}
            Welcome back, {user?.firstName}
            {todayTasksCount > 0
              ? ` — ${todayTasksCount} task${todayTasksCount === 1 ? '' : 's'} due today.`
              : totalLeads > 0
                ? ' — nothing is due today; your queue is clear.'
                : ' — your workspace is ready. Add a lead to get started.'}
          </p>
        </div>
        <Segmented
          value={period}
          onChange={(v) => setPeriod(v as typeof period)}
          options={[{ v: 'week', l: 'This Week' }, { v: 'month', l: 'This Month' }, { v: 'quarter', l: 'Quarter' }]}
        />
      </div>

      {/* KPI strip */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 18, marginBottom: 20 }}>
        {kpis.map((k) => {
          const Icon = k.icon;
          return (
            <div key={k.label} style={{ ...card, borderRadius: 18, padding: '18px 20px' }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
                <div style={mono}>{k.label}</div>
                <div style={{ width: 32, height: 32, borderRadius: 9, background: k.tint, color: k.color, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <Icon size={16} strokeWidth={2} />
                </div>
              </div>
              <div style={{ fontSize: 30, fontWeight: 700, letterSpacing: '-.02em', lineHeight: 1 }}>{k.value}</div>
              <div style={{ fontSize: 12.5, color: k.good ? 'var(--success)' : 'var(--ink-2)', marginTop: 6, display: 'flex', alignItems: 'center', gap: 4 }}>
                {k.good && <ChevronUp size={13} strokeWidth={2.4} />}{k.sub}
              </div>
            </div>
          );
        })}
      </div>

      {/* Main grid */}
      <div style={{ display: 'grid', gridTemplateColumns: '300px 1fr 320px', gap: 20, marginBottom: 20, alignItems: 'start' }}>
        <ConversionRank
          totalLeads={totalLeads}
          convertedLeads={admissions}
          followUpsDue={todayTasksCount}
          conversionRate={conversionRate}
          ownerLabel={ownerLabel}
        />
        <Performance
          pipelineValue={overview?.pipelineValue ?? 0}
          conversionRate={overview?.conversionRate ?? 0}
          avgFee={overview?.avgFee ?? 0}
          series={overview?.performanceSeries ?? []}
        />
        <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
          <TeamWorkspace />
          <RecentActivity />
        </div>
      </div>

      {/* Bottom row */}
      <div style={{ display: 'grid', gridTemplateColumns: '1.5fr 1fr 1fr', gap: 20 }}>
        <PipelineFunnel stages={overview?.pipelineStages ?? []} />
        <AdmissionRing
          enrolled={overview?.enrolledAdmissions ?? 0}
          inProcess={overview?.processingAdmissions ?? 0}
          noun={isEducation ? 'Admission' : 'Conversion'}
        />
        <TopCounsellor counsellor={overview?.topCounsellor} label={`Top ${ownerLabel.toLowerCase()}`} />
      </div>
    </div>
  );
}
