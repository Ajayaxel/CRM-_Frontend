'use client';

import React from 'react';
import { TrendingUp, DollarSign, Activity, Users, ShieldCheck, Clock, Layers, ArrowUpRight, BarChart3 } from 'lucide-react';

export function SolarCeoAnalyticsView() {
  const mrrInr = 450;
  const arrInr = 5400;
  const conversionRate = 68;
  const fleetUptime = 99.4;
  const activeSubs = 4;
  const avgSlaHours = 4.2;
  const cashFlowInr = 124500;

  const funnel = [
    { stage: 'LEAD', count: 18, value: 'AED 340,000' },
    { stage: 'SURVEY', count: 12, value: 'AED 230,000' },
    { stage: 'PROPOSAL', count: 8, value: 'AED 160,000' },
    { stage: 'WON', count: 6, value: 'AED 124,500' },
  ];

  return (
    <div
      className="space-y-6 p-6 rounded-2xl border shadow-2xl"
      style={{ background: 'var(--surface)', color: 'var(--ink)', borderColor: 'var(--hairline)' }}
    >
      {/* Header */}
      <div className="flex items-center justify-between border-b pb-4" style={{ borderColor: 'var(--hairline)' }}>
        <div>
          <div className="flex items-center gap-2">
            <span className="px-2.5 py-1 text-xs font-semibold rounded-full flex items-center gap-1" style={{ background: 'var(--tone-active-bg)', color: 'var(--tone-active)', border: '1px solid var(--tone-active-line)' }}>
              <BarChart3 className="w-3.5 h-3.5" /> EXECUTIVE BI (#25)
            </span>
          </div>
          <h2 className="text-xl font-bold mt-1" style={{ color: 'var(--ink)' }}>CEO Executive Analytics & Lifetime Revenue Dashboard</h2>
        </div>
      </div>

      {/* Primary KPI Grid */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="backdrop-blur-md p-4 rounded-xl border" style={{ background: 'var(--surface-2)', borderColor: 'var(--hairline)' }}>
          <div className="flex items-center justify-between text-xs" style={{ color: 'var(--ink-2)' }}>
            <span>Monthly Recurring Revenue</span>
            <DollarSign className="w-4 h-4" style={{ color: 'var(--tone-active)' }} />
          </div>
          <div className="mt-2">
            <div className="text-2xl font-black font-mono" style={{ color: 'var(--ink)' }}>AED {mrrInr}</div>
            <div className="text-xs mt-0.5 font-semibold" style={{ color: 'var(--tone-active)' }}>ARR: AED {arrInr.toLocaleString()}</div>
          </div>
        </div>

        <div className="backdrop-blur-md p-4 rounded-xl border" style={{ background: 'var(--surface-2)', borderColor: 'var(--hairline)' }}>
          <div className="flex items-center justify-between text-xs" style={{ color: 'var(--ink-2)' }}>
            <span>Deal Conversion Funnel</span>
            <TrendingUp className="w-4 h-4" style={{ color: 'var(--tone-renewal)' }} />
          </div>
          <div className="mt-2">
            <div className="text-2xl font-black font-mono" style={{ color: 'var(--tone-renewal)' }}>{conversionRate}%</div>
            <div className="text-xs mt-0.5" style={{ color: 'var(--ink-2)' }}>Proposal to Won Conversion</div>
          </div>
        </div>

        <div className="backdrop-blur-md p-4 rounded-xl border" style={{ background: 'var(--surface-2)', borderColor: 'var(--hairline)' }}>
          <div className="flex items-center justify-between text-xs" style={{ color: 'var(--ink-2)' }}>
            <span>Fleet Generation Uptime</span>
            <Activity className="w-4 h-4" style={{ color: 'var(--tone-sales)' }} />
          </div>
          <div className="mt-2">
            <div className="text-2xl font-black font-mono" style={{ color: 'var(--tone-sales)' }}>{fleetUptime}%</div>
            <div className="text-xs mt-0.5" style={{ color: 'var(--ink-2)' }}>Across {activeSubs} Monitored Plants</div>
          </div>
        </div>

        <div className="backdrop-blur-md p-4 rounded-xl border" style={{ background: 'var(--surface-2)', borderColor: 'var(--hairline)' }}>
          <div className="flex items-center justify-between text-xs" style={{ color: 'var(--ink-2)' }}>
            <span>SLA Resolution Time</span>
            <Clock className="w-4 h-4" style={{ color: 'var(--tone-info)' }} />
          </div>
          <div className="mt-2">
            <div className="text-2xl font-black font-mono" style={{ color: 'var(--tone-info)' }}>{avgSlaHours} hrs</div>
            <div className="text-xs mt-0.5" style={{ color: 'var(--ink-2)' }}>Benchmark SLA Target (&lt;12h)</div>
          </div>
        </div>
      </div>

      {/* Conversion Funnel Grid */}
      <div className="p-5 rounded-xl border space-y-4" style={{ background: 'var(--surface-2)', borderColor: 'var(--hairline)' }}>
        <h3 className="text-sm font-semibold flex items-center gap-2" style={{ color: 'var(--ink)' }}>
          <Layers className="w-4 h-4" style={{ color: 'var(--tone-renewal)' }} /> Pipeline Stage Conversion Funnel
        </h3>

        <div className="grid grid-cols-1 sm:grid-cols-4 gap-3">
          {funnel.map((f, idx) => (
            <div key={idx} className="p-4 rounded-lg border flex flex-col justify-between" style={{ background: 'var(--surface)', borderColor: 'var(--hairline)' }}>
              <div className="text-xs font-semibold" style={{ color: 'var(--ink-2)' }}>{f.stage} STAGE</div>
              <div className="mt-2">
                <div className="text-xl font-bold font-mono" style={{ color: 'var(--ink)' }}>{f.count} deals</div>
                <div className="text-xs font-mono mt-0.5" style={{ color: 'var(--tone-renewal)' }}>{f.value}</div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
