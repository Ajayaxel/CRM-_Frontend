'use client';

/**
 * The coworking overview.
 *
 * Every tile is counted from the rows underneath it on each request — there is
 * no seeded number anywhere on this screen, which is why an empty tenant reads
 * zero rather than reading like a demo.
 */

import { useQuery } from '@tanstack/react-query';
import { useRouter } from 'next/navigation';
import {
  Armchair, BadgeCheck, Banknote, CalendarCheck, ClipboardList, DoorOpen,
  LayoutGrid, RefreshCw, TrendingUp, UserCheck, Users2,
} from 'lucide-react';
import { api } from '@/lib/api';
import { BarList, Card, QuickActions, SectionTitle, Skeleton, StatCard, Timeline } from '../ui/kit';
import { PageHead, money, relativeDays } from '../ui/common';

interface Dashboard {
  spaces: { total: number; available: number; occupied: number; reserved: number; maintenance: number; blocked: number; utilisationPct: number };
  bookings: { today: number; upcoming: number; completed: number; cancelled: number; noShow: number };
  revenue: { todayInr: number; monthInr: number; recurringInr: number; outstandingInr: number; overdueInr: number };
  members: { active: number; new: number; expiring: number; renewals: number };
  leads: { new: number; qualified: number; visits: number; proposals: number; won: number; lost: number; conversionPct: number };
  renewals: { today: number; thisWeek: number; thisMonth: number; expiringSoon: number };
  frontDesk: { visitorsOnSite: number };
}

interface ActivityRow {
  id: string; kind: string; title: string; body?: string | null; at: string;
  lead?: { id: string; name: string } | null; customer?: { id: string; name: string } | null;
}

export function CoworkingDashboard() {
  const router = useRouter();

  const { data, isLoading } = useQuery({
    queryKey: ['cw-dashboard'],
    queryFn: async () => (await api.get<Dashboard>('/coworking/dashboard')).data,
  });

  const { data: activity } = useQuery({
    queryKey: ['cw-activity'],
    queryFn: async () => (await api.get<ActivityRow[]>('/coworking/activity', { params: { limit: 25 } })).data,
  });

  if (isLoading || !data) {
    return <div className="ds-page"><PageHead title="Overview" /><Skeleton rows={4} height={92} /></div>;
  }

  const { spaces, bookings, revenue, members, leads, renewals, frontDesk } = data;

  return (
    <div className="ds-page">
      <PageHead
        title="Overview"
        subtitle="Every figure is counted from your own records, on this request."
      />

      <QuickActions
        actions={[
          { icon: LayoutGrid, label: 'Open the floor plan', tone: 'info', onClick: () => router.push('/coworking/floor-plan') },
          { icon: CalendarCheck, label: 'Bookings', tone: 'sales', onClick: () => router.push('/coworking/bookings') },
          { icon: Users2, label: 'BNO Connect leads', tone: 'renewal', onClick: () => router.push('/coworking/leads') },
          { icon: RefreshCw, label: 'Renewals due', tone: 'claim', onClick: () => router.push('/coworking/renewals') },
          { icon: DoorOpen, label: 'Front desk', tone: 'active', onClick: () => router.push('/coworking/front-desk') },
        ]}
      />

      <div style={{ marginTop: 26 }}>
        <SectionTitle sub="Right now, across every floor">Spaces</SectionTitle>
        <div className="ds-grid ds-grid-kpi">
          <StatCard label="Total spaces" value={spaces.total} icon={Armchair} tone="info" onClick={() => router.push('/coworking/spaces')} />
          <StatCard label="Available" value={spaces.available} icon={BadgeCheck} tone="active" />
          <StatCard label="Occupied" value={spaces.occupied} icon={UserCheck} tone="sales" />
          <StatCard
            label="Utilisation" value={`${spaces.utilisationPct}%`} tone="renewal" icon={TrendingUp}
            hint={spaces.total ? undefined : 'Add spaces to start measuring this.'}
          />
          <StatCard label="Maintenance" value={spaces.maintenance + spaces.blocked} tone="claim" />
        </div>
      </div>

      <div style={{ marginTop: 26 }}>
        <SectionTitle sub="This month, unless stated">Bookings</SectionTitle>
        <div className="ds-grid ds-grid-kpi">
          <StatCard label="Today" value={bookings.today} icon={CalendarCheck} tone="info" onClick={() => router.push('/coworking/bookings')} />
          <StatCard label="Upcoming" value={bookings.upcoming} tone="sales" />
          <StatCard label="Completed" value={bookings.completed} tone="active" />
          <StatCard label="Cancelled" value={bookings.cancelled} tone="expired" />
          <StatCard label="No-shows" value={bookings.noShow} tone="claim" />
        </div>
      </div>

      <div style={{ marginTop: 26 }}>
        <SectionTitle sub="Collected, committed and outstanding">Revenue</SectionTitle>
        <div className="ds-grid ds-grid-kpi">
          <StatCard label="Collected today" value={money(revenue.todayInr)} icon={Banknote} tone="active" />
          <StatCard label="Collected this month" value={money(revenue.monthInr)} tone="active" />
          <StatCard label="Recurring (MRR)" value={money(revenue.recurringInr)} tone="info" onClick={() => router.push('/coworking/reports')} />
          <StatCard label="Outstanding" value={money(revenue.outstandingInr)} tone="renewal" onClick={() => router.push('/coworking/billing')} />
          <StatCard label="Overdue" value={money(revenue.overdueInr)} tone="expired" onClick={() => router.push('/coworking/billing')} />
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(300px,1fr))', gap: 18, marginTop: 26 }}>
        <div>
          <SectionTitle sub="Recurring clients">Members</SectionTitle>
          <div className="ds-grid ds-grid-kpi">
            <StatCard label="Active" value={members.active} icon={Users2} tone="active" onClick={() => router.push('/coworking/memberships')} />
            <StatCard label="New this month" value={members.new} tone="info" />
            <StatCard label="Expiring in 30 days" value={members.expiring} tone="renewal" />
            <StatCard label="Renewals due" value={members.renewals} tone="claim" onClick={() => router.push('/coworking/renewals')} />
          </div>
        </div>

        <div>
          <SectionTitle sub="BNO Connect">Pipeline</SectionTitle>
          <Card pad={18}>
            <BarList
              items={[
                { label: 'New leads', value: leads.new, tone: 'info' },
                { label: 'Qualified', value: leads.qualified, tone: 'sales' },
                { label: 'Site visits', value: leads.visits, tone: 'renewal' },
                { label: 'Proposals out', value: leads.proposals, tone: 'claim' },
                { label: 'Won', value: leads.won, tone: 'active' },
                { label: 'Lost', value: leads.lost, tone: 'expired' },
              ]}
            />
            <div style={{ display: 'flex', gap: 18, marginTop: 16, paddingTop: 14, borderTop: '1px solid var(--hairline)' }}>
              <div>
                <div className="ds-caption">Conversion</div>
                <div style={{ fontSize: 20, fontWeight: 700 }}>{leads.conversionPct}%</div>
              </div>
              <div>
                <div className="ds-caption">Visitors on site</div>
                <div style={{ fontSize: 20, fontWeight: 700 }}>{frontDesk.visitorsOnSite}</div>
              </div>
              <button className="btn-ghost btn-sm" style={{ marginLeft: 'auto', alignSelf: 'center' }} onClick={() => router.push('/coworking/leads')}>
                Open the board
              </button>
            </div>
          </Card>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(300px,1fr))', gap: 18, marginTop: 26 }}>
        <div>
          <SectionTitle sub="Coming up">Renewals</SectionTitle>
          <Card pad={18}>
            <BarList
              items={[
                { label: 'Today', value: renewals.today, tone: 'claim' },
                { label: 'This week', value: renewals.thisWeek, tone: 'renewal' },
                { label: 'This month', value: renewals.thisMonth, tone: 'info' },
                { label: 'Memberships expiring soon', value: renewals.expiringSoon, tone: 'sales' },
              ]}
            />
          </Card>
        </div>

        <div>
          <SectionTitle sub="What happened lately" action={<ClipboardList size={15} style={{ color: 'var(--ink-3)' }} />}>Activity</SectionTitle>
          <Card pad={18}>
            {!activity?.length ? (
              <div className="ds-caption">Nothing recorded yet. Bookings, leads and payments all write here.</div>
            ) : (
              <Timeline
                dense
                items={activity.slice(0, 12).map((a) => ({
                  at: a.at,
                  title: a.title,
                  detail: [a.customer?.name ?? a.lead?.name, a.body].filter(Boolean).join(' · ') || undefined,
                  tone: a.kind === 'PAYMENT' ? 'active' : a.kind === 'BOOKING' ? 'info' : a.kind === 'STATUS_CHANGE' ? 'renewal' : 'neutral',
                }))}
              />
            )}
          </Card>
        </div>
      </div>

      {members.expiring > 0 && (
        <Card pad={16} style={{ marginTop: 22 }}>
          <div style={{ display: 'flex', gap: 12, alignItems: 'center', flexWrap: 'wrap' }}>
            <RefreshCw size={16} style={{ color: 'var(--tone-renewal)' }} />
            <span style={{ fontSize: 13.5 }}>
              {members.expiring} membership{members.expiring === 1 ? '' : 's'} expire within 30 days.
              Reminders go out automatically at 30, 15, 7 and 1 day{renewals.today ? `; ${renewals.today} renew ${relativeDays(new Date())}` : ''}.
            </span>
            <button className="btn-ghost btn-sm" style={{ marginLeft: 'auto' }} onClick={() => router.push('/coworking/renewals')}>
              Work the renewal queue
            </button>
          </div>
        </Card>
      )}
    </div>
  );
}
