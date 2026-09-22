'use client';

import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { TrendingUp, TrendingDown, Zap, Calendar, DollarSign, BarChart2, RefreshCw, Brain } from 'lucide-react';
import { api } from '@/lib/api';
import { fmtOrgMoneyExact } from '@/lib/org-locale';
import { useHotelProperty } from '@/features/verticals/hotel/hotel';

// The *Inr columns hold WHOLE RUPEES, not paise. Dividing by 100 here showed a
// ₹2,000 room as "₹20" — harmless while the screen was wired to a property id
// that matched nothing, and a misquote at the counter the moment it was not.
const money = (v: number) => fmtOrgMoneyExact(v);
const pct = (v: number) => `${v.toFixed(1)}%`;

interface RevenueKpi {
  period: string;
  totalRevenueInr: number;
  roomRevenueInr: number;
  fbRevenueInr: number;
  adrInr: number;
  revparInr: number;
  gopparInr: number;
  occupancyPct: number;
}

interface AiSuggestion {
  averageOccupancy7Days: number;
  recommendation: string;
  suggestedAction: string;
  aiConfidenceScore: number;
}

export function RevenueDashboard() {
  const today = new Date().toISOString().split('T')[0];
  const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];

  // Mock property — in production comes from property context
  const { propertyId } = useHotelProperty();

  const { data: kpis = [], isLoading } = useQuery<RevenueKpi[]>({
    queryKey: ['revenue-kpis', propertyId],
    queryFn: async () => (await api.get('/hotel-revenue/kpis', {
      params: { propertyId, startDate: sevenDaysAgo, endDate: today }
    })).data,
  });

  const { data: aiSuggestion } = useQuery<AiSuggestion>({
    queryKey: ['ai-revenue-suggestions', propertyId],
    queryFn: async () => (await api.get('/hotel-ai/revenue/suggestions', { params: { propertyId } })).data,
  });

  const runDynamicPricing = useMutation({
    mutationFn: async () => (await api.post('/hotel-revenue/rates/run-dynamic-pricing', { propertyId, date: today })).data,
    onSuccess: (data: any) => {
      toast.success(`Dynamic pricing updated for ${data.pricingUpdates?.length || 0} room categories`);
    },
    onError: () => toast.error('Failed to run dynamic pricing'),
  });

  const calculateKpis = useMutation({
    mutationFn: async () => (await api.post('/hotel-revenue/kpis/calculate', { propertyId, date: today })).data,
    onSuccess: () => {
      toast.success("Today's KPIs calculated and saved");
    },
  });

  const latestKpi = kpis[kpis.length - 1];

  const SUGGESTION_COLOR: Record<string, string> = {
    INCREASE_RATES: 'var(--success)',
    TRIGGER_PROMO: 'var(--gold, #e6a23c)',
    KEEP_BASE: 'var(--ink-2)',
  };

  return (
    <div style={{ animation: 'fadeUp .4s ease', padding: 24, maxWidth: 1200, margin: '0 auto' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 24 }}>
        <div>
          <h1 style={{ fontSize: 26, fontWeight: 700, letterSpacing: '-.02em', margin: 0 }}>Revenue Management</h1>
          <p style={{ fontSize: 14, color: 'var(--ink-2)', margin: '6px 0 0' }}>ADR, RevPAR, GOPPAR, dynamic pricing, and AI optimization.</p>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <button
            onClick={() => calculateKpis.mutate()}
            disabled={calculateKpis.isPending}
            style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '10px 16px', borderRadius: 8, background: 'var(--surface)', border: '1px solid var(--line-soft)', fontSize: 13, fontWeight: 600, cursor: 'pointer' }}
          >
            <RefreshCw size={14} className={calculateKpis.isPending ? 'spin' : ''} /> Calculate KPIs
          </button>
          <button
            onClick={() => runDynamicPricing.mutate()}
            disabled={runDynamicPricing.isPending}
            style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '10px 16px', borderRadius: 8, background: 'var(--brand)', color: '#fff', border: 'none', fontSize: 13, fontWeight: 600, cursor: 'pointer' }}
          >
            <Zap size={14} /> Run Dynamic Pricing
          </button>
        </div>
      </div>

      {/* AI Recommendation Banner */}
      {aiSuggestion && (
        <div style={{
          background: 'var(--surface)', border: `2px solid ${SUGGESTION_COLOR[aiSuggestion.suggestedAction] || 'var(--brand)'}`,
          borderRadius: 12, padding: '16px 20px', marginBottom: 20,
          display: 'flex', alignItems: 'flex-start', gap: 14,
        }}>
          <Brain size={22} style={{ color: 'var(--brand)', flexShrink: 0, marginTop: 2 }} />
          <div style={{ flex: 1 }}>
            <div style={{ fontWeight: 600, fontSize: 14, marginBottom: 4 }}>Revenue AI Recommendation</div>
            <p style={{ fontSize: 13, color: 'var(--ink-2)', margin: 0 }}>{aiSuggestion.recommendation}</p>
          </div>
          <div style={{ textAlign: 'right', flexShrink: 0 }}>
            <div style={{ fontSize: 11, color: 'var(--ink-3)', marginBottom: 2 }}>7-day avg occupancy</div>
            <div style={{ fontSize: 22, fontWeight: 700, color: SUGGESTION_COLOR[aiSuggestion.suggestedAction] }}>
              {pct(aiSuggestion.averageOccupancy7Days)}
            </div>
          </div>
        </div>
      )}

      {/* Today's KPI cards */}
      {latestKpi && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 12, marginBottom: 24 }}>
          <KpiCard label="ADR" value={money(latestKpi.adrInr)} icon={<DollarSign size={18} />} color="var(--brand)" />
          <KpiCard label="RevPAR" value={money(latestKpi.revparInr)} icon={<BarChart2 size={18} />} color="var(--success)" />
          <KpiCard label="GOPPAR" value={money(latestKpi.gopparInr)} icon={<TrendingUp size={18} />} color="var(--gold, #e6a23c)" />
          <KpiCard label="Occupancy" value={pct(latestKpi.occupancyPct)} icon={<Calendar size={18} />} color="var(--danger)" />
        </div>
      )}

      {/* Revenue breakdown */}
      {latestKpi && (
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginBottom: 24 }}>
          <div style={{ background: 'var(--surface)', border: '1px solid var(--line-soft)', borderRadius: 12, padding: 20 }}>
            <h3 style={{ margin: '0 0 16px', fontSize: 15, fontWeight: 600 }}>Today's Revenue Breakdown</h3>
            <RevenueBar label="Room Revenue" value={latestKpi.roomRevenueInr} total={latestKpi.totalRevenueInr} color="var(--brand)" />
            <RevenueBar label="F&B Revenue" value={latestKpi.fbRevenueInr} total={latestKpi.totalRevenueInr} color="var(--success)" />
            <RevenueBar label="Other" value={latestKpi.totalRevenueInr - latestKpi.roomRevenueInr - latestKpi.fbRevenueInr} total={latestKpi.totalRevenueInr} color="var(--gold, #e6a23c)" />
          </div>

          <div style={{ background: 'var(--surface)', border: '1px solid var(--line-soft)', borderRadius: 12, padding: 20 }}>
            <h3 style={{ margin: '0 0 16px', fontSize: 15, fontWeight: 600 }}>7-Day Occupancy Trend</h3>
            {kpis.length === 0 ? (
              <p style={{ color: 'var(--ink-3)', fontSize: 13, textAlign: 'center', padding: 20 }}>No KPI data yet. Click "Calculate KPIs" to start.</p>
            ) : (
              <div style={{ display: 'flex', alignItems: 'flex-end', gap: 8, height: 100 }}>
                {kpis.map((k) => (
                  <div key={k.period} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4 }}>
                    <div
                      style={{
                        width: '100%',
                        height: `${Math.max(8, k.occupancyPct)}%`,
                        background: k.occupancyPct >= 70 ? 'var(--success)' : k.occupancyPct >= 40 ? 'var(--brand)' : 'var(--danger)',
                        borderRadius: 4,
                      }}
                    />
                    <div style={{ fontSize: 9, color: 'var(--ink-3)' }}>{k.period.slice(5)}</div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {!latestKpi && !isLoading && (
        <div style={{ background: 'var(--surface)', border: '1px solid var(--line-soft)', borderRadius: 12, padding: 40, textAlign: 'center' }}>
          <BarChart2 size={40} style={{ opacity: .3, marginBottom: 12 }} />
          <p style={{ color: 'var(--ink-2)', fontSize: 15 }}>No revenue KPI data available yet.</p>
          <p style={{ color: 'var(--ink-3)', fontSize: 13, marginTop: 4 }}>After guests check in and night audits run, click <strong>Calculate KPIs</strong> to build your revenue history.</p>
        </div>
      )}
    </div>
  );
}

function KpiCard({ label, value, icon, color }: { label: string; value: string; icon: React.ReactNode; color: string }) {
  return (
    <div style={{ background: 'var(--surface)', border: '1px solid var(--line-soft)', borderRadius: 12, padding: 20 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, color, marginBottom: 10 }}>
        {icon}
        <span style={{ fontSize: 12, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '.06em' }}>{label}</span>
      </div>
      <div style={{ fontSize: 22, fontWeight: 700 }}>{value}</div>
    </div>
  );
}

function RevenueBar({ label, value, total, color }: { label: string; value: number; total: number; color: string }) {
  const pct = total > 0 ? (value / total) * 100 : 0;
  return (
    <div style={{ marginBottom: 14 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, marginBottom: 6 }}>
        <span style={{ color: 'var(--ink-2)' }}>{label}</span>
        <span style={{ fontWeight: 600 }}>{money(value)}</span>
      </div>
      <div style={{ height: 6, background: 'var(--line-soft)', borderRadius: 4, overflow: 'hidden' }}>
        <div style={{ height: '100%', width: `${pct}%`, background: color, borderRadius: 4, transition: 'width .5s' }} />
      </div>
    </div>
  );
}
