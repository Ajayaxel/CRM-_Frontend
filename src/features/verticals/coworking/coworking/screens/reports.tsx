'use client';

/**
 * Reports.
 *
 * Space utilisation, occupancy, revenue by space/plan/customer, booking trends,
 * lead conversion and source performance, retention and renewal rate, MRR/ARR,
 * and add-on revenue — every one of them counted from the records on request.
 *
 * Utilisation divides booked hours by the space's OWN opening hours rather than
 * by 24×7: a room open eight hours a day and booked for six is 75% utilised,
 * not 25%, and the second number would quietly make every operator look idle.
 */

import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { BarChart3 } from 'lucide-react';
import { api } from '@/lib/api';
import { BarChart, BarList, Card, DataTable, EmptyState, SectionTitle, Segmented, Skeleton, StatCard, humanStatus } from '../ui/kit';
import { spaceTypeLabel } from '../ui/tone';
import { PERIODS, PageHead, money } from '../ui/common';

type Period = (typeof PERIODS)[number]['key'];

export function CoworkingReports() {
  const [period, setPeriod] = useState<Period>('this_month');
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const [tab, setTab] = useState<'Space' | 'Revenue' | 'Sales' | 'Retention'>('Space');

  const params = period === 'custom' ? { period, from, to } : { period };

  const utilisation = useQuery({
    queryKey: ['cw-report-utilisation', params],
    queryFn: async () => (await api.get<{
      period: { label: string };
      rows: { spaceId: string; name: string; code: string; type: string; bookings: number; bookedHours: number; bookableHours: number; utilisationPct: number; revenueInr: number }[];
      totals: { bookedHours: number; bookableHours: number; revenueInr: number; averageUtilisationPct: number };
    }>('/coworking/reports/utilisation', { params })).data,
    enabled: tab === 'Space',
  });

  const occupancy = useQuery({
    queryKey: ['cw-report-occupancy'],
    queryFn: async () => (await api.get<{ type: string; spaces: number; capacity: number; occupied: number; vacant: number; occupancyPct: number }[]>('/coworking/reports/occupancy')).data,
    enabled: tab === 'Space',
  });

  const bookings = useQuery({
    queryKey: ['cw-report-bookings', params],
    queryFn: async () => (await api.get<{
      series: { date: string; bookings: number; revenueInr: number; cancelled: number }[];
      byType: { label: string; value: number }[];
      byMode: { label: string; value: number }[];
      byStatus: { label: string; value: number }[];
      total: number;
    }>('/coworking/reports/bookings', { params })).data,
    enabled: tab === 'Space',
  });

  const revenue = useQuery({
    queryKey: ['cw-report-revenue', params],
    queryFn: async () => (await api.get<{
      bySpace: { id: string; label: string; amountInr: number; count: number }[];
      byMembership: { id: string; label: string; amountInr: number; count: number }[];
      byCustomer: { id: string; label: string; amountInr: number; count: number }[];
      invoiced: { billedInr: number; collectedInr: number; outstandingInr: number };
    }>('/coworking/reports/revenue', { params })).data,
    enabled: tab === 'Revenue',
  });

  const recurring = useQuery({
    queryKey: ['cw-report-recurring'],
    queryFn: async () => (await api.get<{
      mrrInr: number; arrInr: number; members: number; seats: number; arpuInr: number;
      plans: { planId: string; name: string; members: number; seats: number; mrrInr: number; arrInr: number }[];
    }>('/coworking/reports/recurring')).data,
    enabled: tab === 'Revenue',
  });

  const addOns = useQuery({
    queryKey: ['cw-report-addons', params],
    queryFn: async () => (await api.get<{
      rows: { serviceId: string; name: string; category: string | null; unit: string; quantity: number; amountInr: number }[];
      totalInr: number;
    }>('/coworking/reports/add-ons', { params })).data,
    enabled: tab === 'Revenue',
  });

  const leads = useQuery({
    queryKey: ['cw-report-leads', params],
    queryFn: async () => (await api.get<{
      funnel: { stageId: string; name: string; count: number }[];
      totals: { leads: number; won: number; lost: number; open: number; conversionPct: number; pipelineInr: number };
      bySource: { source: string; leads: number; won: number; conversionPct: number; pipelineInr: number }[];
      siteVisits: { scheduled: number; completed: number; noShow: number; wonAfterVisit: number; visitConversionPct: number };
      quotations: { raised: number; accepted: number; rejected: number; valueInr: number; acceptedValueInr: number };
    }>('/coworking/reports/leads', { params })).data,
    enabled: tab === 'Sales',
  });

  const retention = useQuery({
    queryKey: ['cw-report-retention', params],
    queryFn: async () => (await api.get<{
      renewals: { due: number; renewed: number; lapsed: number; pending: number; renewalRatePct: number; renewedValueInr: number };
      retention: { startingCustomers: number; retainedCustomers: number; churnedCustomers: number; retentionPct: number };
    }>('/coworking/reports/retention', { params })).data,
    enabled: tab === 'Retention',
  });

  return (
    <div className="ds-page">
      <PageHead
        title="Reports"
        subtitle="Counted from your records on every request — nothing is cached or seeded."
        actions={<Segmented options={['Space', 'Revenue', 'Sales', 'Retention']} value={tab} onChange={(v) => setTab(v as typeof tab)} />}
      />

      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center', marginBottom: 20 }}>
        <select className="input" style={{ maxWidth: 180 }} value={period} onChange={(e) => setPeriod(e.target.value as Period)} aria-label="Period">
          {PERIODS.map((p) => <option key={p.key} value={p.key}>{p.label}</option>)}
        </select>
        {period === 'custom' && (
          <>
            <input className="input" style={{ width: 150 }} type="date" value={from} onChange={(e) => setFrom(e.target.value)} aria-label="From" />
            <span className="ds-caption">to</span>
            <input className="input" style={{ width: 150 }} type="date" value={to} onChange={(e) => setTo(e.target.value)} aria-label="To" />
          </>
        )}
      </div>

      {tab === 'Space' && (
        <div style={{ display: 'grid', gap: 26 }}>
          {utilisation.isLoading ? <Skeleton rows={3} height={80} /> : utilisation.data && (
            <>
              <div className="ds-grid ds-grid-kpi">
                <StatCard label="Average utilisation" value={`${utilisation.data.totals.averageUtilisationPct}%`} tone="info" />
                <StatCard label="Booked hours" value={utilisation.data.totals.bookedHours} tone="sales" />
                <StatCard label="Bookable hours" value={utilisation.data.totals.bookableHours} tone="neutral" />
                <StatCard label="Booking revenue" value={money(utilisation.data.totals.revenueInr)} tone="active" />
              </div>

              <div>
                <SectionTitle sub="Booked hours over the space's own opening hours">Space utilisation</SectionTitle>
                <Card flush>
                  <DataTable
                    rows={utilisation.data.rows}
                    columns={[
                      { key: 'name', header: 'Space', render: (r) => <span><span style={{ display: 'block', fontWeight: 560 }}>{r.name}</span><span className="ds-caption">{spaceTypeLabel(r.type)}</span></span> },
                      { key: 'bookings', header: 'Bookings', align: 'right', sortable: true },
                      { key: 'bookedHours', header: 'Booked h', align: 'right', sortable: true },
                      { key: 'bookableHours', header: 'Bookable h', align: 'right' },
                      { key: 'utilisationPct', header: 'Utilisation', align: 'right', sortable: true, render: (r) => `${r.utilisationPct}%` },
                      { key: 'revenueInr', header: 'Revenue', align: 'right', sortable: true, render: (r) => money(r.revenueInr) },
                    ]}
                    rowKey={(r) => r.spaceId}
                    empty={<EmptyState compact icon={BarChart3} title="Nothing booked in this period" />}
                  />
                </Card>
              </div>
            </>
          )}

          {occupancy.data && occupancy.data.length > 0 && (
            <div>
              <SectionTitle sub="Seats committed to a membership, by space type">Occupancy</SectionTitle>
              <Card pad={18}>
                <BarList
                  items={occupancy.data.map((o) => ({
                    label: `${spaceTypeLabel(o.type)} — ${o.occupied}/${o.capacity}`,
                    value: o.occupancyPct,
                    tone: o.occupancyPct > 85 ? 'expired' : o.occupancyPct > 60 ? 'renewal' : 'active',
                    meta: `${o.vacant} vacant`,
                  }))}
                  format={(n) => `${n}%`}
                />
              </Card>
            </div>
          )}

          {bookings.data && bookings.data.total > 0 && (
            <div>
              <SectionTitle sub={`${bookings.data.total} bookings`}>Booking trends</SectionTitle>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(300px,1fr))', gap: 18 }}>
                <Card pad={18}>
                  <BarChart
                    data={bookings.data.series.slice(-14).map((d) => ({ label: d.date.slice(5), value: d.bookings }))}
                    tone="info"
                  />
                </Card>
                <Card pad={18}>
                  <BarList items={bookings.data.byType.map((t) => ({ label: spaceTypeLabel(t.label), value: t.value, tone: 'sales' }))} />
                </Card>
              </div>
            </div>
          )}
        </div>
      )}

      {tab === 'Revenue' && (
        <div style={{ display: 'grid', gap: 26 }}>
          {recurring.data && (
            <div className="ds-grid ds-grid-kpi">
              <StatCard label="MRR" value={money(recurring.data.mrrInr)} tone="active" />
              <StatCard label="ARR" value={money(recurring.data.arrInr)} tone="active" />
              <StatCard label="Members" value={recurring.data.members} tone="info" />
              <StatCard label="Seats" value={recurring.data.seats} tone="info" />
              <StatCard label="ARPU" value={money(recurring.data.arpuInr)} tone="sales" />
            </div>
          )}

          {revenue.data && (
            <>
              <div className="ds-grid ds-grid-kpi">
                <StatCard label="Billed" value={money(revenue.data.invoiced.billedInr)} tone="info" />
                <StatCard label="Collected" value={money(revenue.data.invoiced.collectedInr)} tone="active" />
                <StatCard label="Outstanding" value={money(revenue.data.invoiced.outstandingInr)} tone="renewal" />
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(300px,1fr))', gap: 18 }}>
                <div>
                  <SectionTitle>By space</SectionTitle>
                  <Card pad={18}>
                    {revenue.data.bySpace.length ? (
                      <BarList items={revenue.data.bySpace.slice(0, 10).map((r) => ({ label: r.label, value: r.amountInr, tone: 'info', meta: `${r.count}` }))} format={money} />
                    ) : <div className="ds-caption">No booking revenue in this period.</div>}
                  </Card>
                </div>
                <div>
                  <SectionTitle>By plan</SectionTitle>
                  <Card pad={18}>
                    {revenue.data.byMembership.length ? (
                      <BarList items={revenue.data.byMembership.slice(0, 10).map((r) => ({ label: r.label, value: r.amountInr, tone: 'active', meta: `${r.count}` }))} format={money} />
                    ) : <div className="ds-caption">No membership revenue in this period.</div>}
                  </Card>
                </div>
                <div>
                  <SectionTitle>By customer</SectionTitle>
                  <Card pad={18}>
                    {revenue.data.byCustomer.length ? (
                      <BarList items={revenue.data.byCustomer.slice(0, 10).map((r) => ({ label: r.label, value: r.amountInr, tone: 'sales' }))} format={money} />
                    ) : <div className="ds-caption">Nothing yet.</div>}
                  </Card>
                </div>
                {addOns.data && (
                  <div>
                    <SectionTitle sub={`${money(addOns.data.totalInr)} in total`}>Add-on revenue</SectionTitle>
                    <Card pad={18}>
                      {addOns.data.rows.length ? (
                        <BarList items={addOns.data.rows.slice(0, 10).map((r) => ({ label: r.name, value: r.amountInr, tone: 'renewal', meta: `${r.quantity}` }))} format={money} />
                      ) : <div className="ds-caption">No add-ons sold in this period.</div>}
                    </Card>
                  </div>
                )}
              </div>

              {recurring.data && recurring.data.plans.length > 0 && (
                <div>
                  <SectionTitle sub="Normalised to a month so an annual plan and a monthly one can be added together">MRR by plan</SectionTitle>
                  <Card flush>
                    <DataTable
                      rows={recurring.data.plans}
                      columns={[
                        { key: 'name', header: 'Plan' },
                        { key: 'members', header: 'Members', align: 'right', sortable: true },
                        { key: 'seats', header: 'Seats', align: 'right' },
                        { key: 'mrrInr', header: 'MRR', align: 'right', sortable: true, render: (r) => money(r.mrrInr) },
                        { key: 'arrInr', header: 'ARR', align: 'right', render: (r) => money(r.arrInr) },
                      ]}
                      rowKey={(r) => r.planId}
                    />
                  </Card>
                </div>
              )}
            </>
          )}
        </div>
      )}

      {tab === 'Sales' && leads.data && (
        <div style={{ display: 'grid', gap: 26 }}>
          <div className="ds-grid ds-grid-kpi">
            <StatCard label="Leads" value={leads.data.totals.leads} tone="info" />
            <StatCard label="Won" value={leads.data.totals.won} tone="active" />
            <StatCard label="Lost" value={leads.data.totals.lost} tone="expired" />
            <StatCard label="Conversion" value={`${leads.data.totals.conversionPct}%`} tone="sales" />
            <StatCard label="Open pipeline" value={money(leads.data.totals.pipelineInr)} tone="renewal" />
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(300px,1fr))', gap: 18 }}>
            <div>
              <SectionTitle>Funnel</SectionTitle>
              <Card pad={18}>
                <BarList items={leads.data.funnel.map((f) => ({ label: f.name, value: f.count, tone: 'info' }))} />
              </Card>
            </div>
            <div>
              <SectionTitle sub="Which channels actually convert">Lead sources</SectionTitle>
              <Card flush>
                <DataTable
                  rows={leads.data.bySource}
                  columns={[
                    { key: 'source', header: 'Source', render: (r) => humanStatus(r.source) },
                    { key: 'leads', header: 'Leads', align: 'right', sortable: true },
                    { key: 'won', header: 'Won', align: 'right', sortable: true },
                    { key: 'conversionPct', header: 'Conversion', align: 'right', sortable: true, render: (r) => `${r.conversionPct}%` },
                    { key: 'pipelineInr', header: 'Pipeline', align: 'right', render: (r) => money(r.pipelineInr) },
                  ]}
                  rowKey={(r) => r.source}
                  empty="No leads in this period."
                />
              </Card>
            </div>
          </div>

          <div className="ds-grid ds-grid-kpi">
            <StatCard label="Visits scheduled" value={leads.data.siteVisits.scheduled} tone="info" />
            <StatCard label="Visits completed" value={leads.data.siteVisits.completed} tone="active" />
            <StatCard label="No-shows" value={leads.data.siteVisits.noShow} tone="expired" />
            <StatCard label="Won after a visit" value={`${leads.data.siteVisits.visitConversionPct}%`} tone="sales" />
            <StatCard label="Proposals raised" value={leads.data.quotations.raised} tone="renewal" />
            <StatCard label="Proposals accepted" value={money(leads.data.quotations.acceptedValueInr)} tone="active" />
          </div>
        </div>
      )}

      {tab === 'Retention' && retention.data && (
        <div style={{ display: 'grid', gap: 26 }}>
          <div className="ds-grid ds-grid-kpi">
            <StatCard label="Renewals due" value={retention.data.renewals.due} tone="info" />
            <StatCard label="Renewed" value={retention.data.renewals.renewed} tone="active" />
            <StatCard label="Renewal rate" value={`${retention.data.renewals.renewalRatePct}%`} tone="sales" />
            <StatCard label="Renewed value" value={money(retention.data.renewals.renewedValueInr)} tone="active" />
            <StatCard label="Lapsed" value={retention.data.renewals.lapsed} tone="expired" />
          </div>

          <div>
            <SectionTitle sub="Customers who had a membership at the start of the period and still had one at the end">Retention</SectionTitle>
            <Card pad={18}>
              <BarList
                items={[
                  { label: 'Started the period', value: retention.data.retention.startingCustomers, tone: 'info' },
                  { label: 'Retained', value: retention.data.retention.retainedCustomers, tone: 'active' },
                  { label: 'Churned', value: retention.data.retention.churnedCustomers, tone: 'expired' },
                ]}
              />
              <div style={{ marginTop: 16, paddingTop: 14, borderTop: '1px solid var(--hairline)' }}>
                <span className="ds-caption">Retention</span>
                <div style={{ fontSize: 24, fontWeight: 700 }}>{retention.data.retention.retentionPct}%</div>
              </div>
            </Card>
          </div>
        </div>
      )}
    </div>
  );
}
