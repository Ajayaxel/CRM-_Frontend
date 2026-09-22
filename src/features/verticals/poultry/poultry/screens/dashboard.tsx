'use client';

import React from 'react';
import { useRouter } from 'next/navigation';
import { useQuery } from '@tanstack/react-query';
import { Bird, CalendarClock, Landmark, PackageCheck, Store, Truck, Users2, Wallet } from 'lucide-react';
import { api } from '@/lib/api';
import { useAuth } from '@/features/foundation/auth';
import { Badge, Card, QuickActions, SectionTitle, Skeleton, StatCard, Timeline } from '../ui/kit';
import { PageHead, fmtDate, money } from '../ui/common';
import { toneForAlertSeverity } from '../ui/tone';

interface DashboardData {
  integration: {
    farmsByStatus: Record<string, number>;
    activeBatches: number;
    activeBirds: number;
    capacityBirds: number;
    utilizationPct: number;
    upcomingPickups: { batchId: string; code: string; farm: string; ageDays: number; expectedPickupDate: string; birds: number }[];
    monthOutputInr: number;
    monthBirdsPicked: number;
  };
  supply: { monthSalesInr: number; partyReceivableInr: number };
  stall: { monthSalesInr: number; monthExpensesInr: number };
  finance: {
    cashBank: { code: string; name: string; subtype: string; balanceInr: number }[];
    totalCashBankInr: number;
    supplierPayableInr: number;
    partyReceivableInr: number;
    loanOutstandingInr: number;
    monthExpensesInr: number;
  };
  alerts: { id: string; severity: string; type: string; title: string; message: string; date: string }[];
  pendingApprovals: number;
}

export function PoultryDashboard() {
  const router = useRouter();
  const { hasPermission } = useAuth();
  const { data, isLoading } = useQuery({
    queryKey: ['py-dashboard'],
    queryFn: async () => (await api.get<DashboardData>('/poultry/dashboard')).data,
  });
  const { data: activity } = useQuery({
    queryKey: ['py-activity'],
    queryFn: async () => (await api.get<{ id: string; title: string; body?: string; at: string; kind: string }[]>('/poultry/activity', { params: { limit: 12 } })).data,
  });

  if (isLoading || !data) {
    return (
      <div className="ds-page">
        <PageHead title="Poultry overview" />
        <Skeleton rows={4} height={92} />
      </div>
    );
  }

  const farms = data.integration.farmsByStatus;
  const totalFarms = Object.values(farms).reduce((s, n) => s + n, 0);

  return (
    <div className="ds-page">
      <PageHead title="Poultry overview" subtitle="Integration, supply and stalls — today's position" />

      <QuickActions
        actions={[
          { icon: CalendarClock, label: 'Cycle calendar', onClick: () => router.push('/poultry/calendar') },
          { icon: Truck, label: 'Feed board', onClick: () => router.push('/poultry/feed') },
          { icon: PackageCheck, label: 'Pickups', onClick: () => router.push('/poultry/pickups') },
          { icon: Users2, label: 'Party supply', onClick: () => router.push('/poultry/parties'), tone: 'sales' },
          ...(hasPermission('poultry.finance')
            ? [{ icon: Landmark, label: 'Money desk', onClick: () => router.push('/poultry/money'), tone: 'claim' as const }]
            : []),
        ]}
      />

      <SectionTitle sub={`${totalFarms} farms · ${data.integration.utilizationPct}% capacity used`}>Integration</SectionTitle>
      <div className="ds-grid ds-grid-kpi">
        <StatCard label="Active birds" value={data.integration.activeBirds.toLocaleString('en-IN')} hint={`of ${data.integration.capacityBirds.toLocaleString('en-IN')} capacity`} icon={Bird} onClick={() => router.push('/poultry/farms')} />
        <StatCard label="Active batches" value={data.integration.activeBatches} hint={`${farms.PICKUP_DUE ?? 0} due for pickup`} onClick={() => router.push('/poultry/batches')} />
        <StatCard label="Available farms" value={farms.AVAILABLE ?? 0} hint={`${farms.RESTING ?? 0} resting`} onClick={() => router.push('/poultry/calendar')} />
        <StatCard label="Month output" value={money(data.integration.monthOutputInr)} hint={`${data.integration.monthBirdsPicked.toLocaleString('en-IN')} birds picked`} tone="active" onClick={() => router.push('/poultry/pickups')} />
      </div>

      <SectionTitle sub="What the company owns and owes right now">Money</SectionTitle>
      <div className="ds-grid ds-grid-kpi">
        <StatCard label="Cash & bank" value={money(data.finance.totalCashBankInr)} icon={Wallet} tone="active" onClick={() => hasPermission('poultry.finance') && router.push('/poultry/money')} />
        <StatCard label="Supplier payable" value={money(data.finance.supplierPayableInr)} tone="claim" onClick={() => router.push('/poultry/suppliers')} />
        <StatCard label="Party receivable" value={money(data.finance.partyReceivableInr)} tone="sales" onClick={() => router.push('/poultry/parties')} />
        <StatCard label="Month expenses" value={money(data.finance.monthExpensesInr)} onClick={() => router.push('/poultry/expenses')} />
      </div>

      <SectionTitle sub="Sales channels this month">Supply & stalls</SectionTitle>
      <div className="ds-grid ds-grid-kpi">
        <StatCard label="Party supply" value={money(data.supply.monthSalesInr)} icon={Users2} onClick={() => router.push('/poultry/parties')} />
        <StatCard label="Stall sales" value={money(data.stall.monthSalesInr)} icon={Store} onClick={() => router.push('/poultry/stalls')} />
        <StatCard label="Stall expenses" value={money(data.stall.monthExpensesInr)} onClick={() => router.push('/poultry/stalls')} />
        <StatCard label="Pending approvals" value={data.pendingApprovals} tone={data.pendingApprovals > 0 ? 'claim' : 'neutral'} onClick={() => hasPermission('poultry.finance') && router.push('/poultry/money?tab=approvals')} />
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: 18 }}>
        <Card>
          <SectionTitle sub="Feed, pickups, payments and stock — worst first">Alerts</SectionTitle>
          {data.alerts.length === 0 ? (
            <div className="ds-caption" style={{ padding: '12px 0' }}>Nothing needs attention right now.</div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {data.alerts.map((a) => (
                <div key={a.id} style={{ display: 'flex', gap: 10, alignItems: 'flex-start', cursor: 'pointer' }} onClick={() => router.push('/poultry/alerts')}>
                  <Badge tone={toneForAlertSeverity(a.severity)} dot>{a.severity}</Badge>
                  <div style={{ minWidth: 0 }}>
                    <div style={{ fontWeight: 600, fontSize: 13 }}>{a.title}</div>
                    <div className="ds-caption" style={{ overflow: 'hidden', textOverflow: 'ellipsis' }}>{a.message}</div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </Card>
        <Card>
          <SectionTitle sub="Next cycles out of the sheds">Upcoming pickups</SectionTitle>
          {data.integration.upcomingPickups.length === 0 ? (
            <div className="ds-caption" style={{ padding: '12px 0' }}>No batches approaching pickup.</div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {data.integration.upcomingPickups.map((p) => (
                <div key={p.batchId} style={{ display: 'flex', justifyContent: 'space-between', gap: 10, cursor: 'pointer' }} onClick={() => router.push(`/poultry/batches/${p.batchId}`)}>
                  <div>
                    <div style={{ fontWeight: 600, fontSize: 13 }}>{p.code} · {p.farm}</div>
                    <div className="ds-caption">{p.birds.toLocaleString('en-IN')} birds · day {p.ageDays}</div>
                  </div>
                  <div className="ds-caption" style={{ whiteSpace: 'nowrap' }}>{fmtDate(p.expectedPickupDate)}</div>
                </div>
              ))}
            </div>
          )}
        </Card>
        <Card>
          <SectionTitle sub="The last things that happened">Activity</SectionTitle>
          <Timeline
            dense
            items={(activity ?? []).map((a) => ({ at: a.at, title: a.title, detail: a.body ?? undefined }))}
          />
        </Card>
      </div>
    </div>
  );
}
