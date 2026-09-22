'use client';

import { useQuery } from '@tanstack/react-query';
import { MessageSquare, Users, Bot, Clock, Megaphone, ShoppingBag, TrendingUp, Smile } from 'lucide-react';
import { omniApi, CHANNEL_META, ChannelType, AnalyticsOverview, ChannelStat, VolumePoint, SentimentStat } from '../omni-client';

const card: React.CSSProperties = { background: 'var(--surface)', border: '1px solid var(--line-soft)', borderRadius: 16 };
const rupee = (n: number) => '₹' + Number(n).toLocaleString('en-IN');

export function AnalyticsFeature() {
  const { data: o } = useQuery({ queryKey: ['omni-an-overview'], queryFn: async () => (await omniApi.get<AnalyticsOverview>('/analytics/overview')).data });
  const { data: channels } = useQuery({ queryKey: ['omni-an-channels'], queryFn: async () => (await omniApi.get<ChannelStat[]>('/analytics/channels')).data });
  const { data: volume } = useQuery({ queryKey: ['omni-an-volume'], queryFn: async () => (await omniApi.get<VolumePoint[]>('/analytics/volume')).data });
  const { data: sentiment } = useQuery({ queryKey: ['omni-an-sentiment'], queryFn: async () => (await omniApi.get<SentimentStat>('/analytics/sentiment')).data });

  const deliveryRate = o && o.broadcasts.sent ? Math.round((o.broadcasts.delivered / o.broadcasts.sent) * 100) : 0;
  const aiDeflection = o && o.conversations.total ? Math.round((o.aiHandledMessages / (o.aiHandledMessages + o.conversations.total)) * 100) : 0;

  return (
    <div style={{ animation: 'fadeUp .4s ease' }}>
      <div style={{ marginBottom: 18 }}>
        <h1 style={{ fontSize: 26, fontWeight: 700, letterSpacing: '-.02em', margin: 0 }}>Analytics</h1>
        <p style={{ fontSize: 14, color: 'var(--ink-2)', margin: '6px 0 0' }}>Conversation intelligence across every channel — response times, AI deflection, campaign &amp; commerce ROI.</p>
      </div>

      {/* KPI cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 14, marginBottom: 14 }}>
        <Kpi icon={<MessageSquare size={18} />} label="Conversations" value={o?.conversations.total ?? 0} sub={`${o?.conversations.open ?? 0} open`} />
        <Kpi icon={<Bot size={18} />} label="AI deflection" value={`${aiDeflection}%`} sub={`${o?.aiHandledMessages ?? 0} AI replies`} accent="var(--brand,#132376)" />
        <Kpi icon={<Clock size={18} />} label="First response" value={o ? fmtMins(o.firstResponseMins) : '—'} sub="avg time to reply" />
        <Kpi icon={<Users size={18} />} label="Contacts" value={o?.contacts ?? 0} sub="in audience book" />
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 14, marginBottom: 18 }}>
        <Kpi icon={<Megaphone size={18} />} label="Broadcast delivery" value={`${deliveryRate}%`} sub={`${o?.broadcasts.sent ?? 0} sent`} />
        <Kpi icon={<ShoppingBag size={18} />} label="Orders" value={o?.commerce.orders ?? 0} sub={rupee(o?.commerce.revenue ?? 0) + ' revenue'} accent="var(--success)" />
        <Kpi icon={<TrendingUp size={18} />} label="Lead-Ads" value={o?.leadAds ?? 0} sub="captured to CRM" />
        <Kpi icon={<Smile size={18} />} label="Sentiment" value={sentiment ? `${sentiment.score > 0 ? '+' : ''}${sentiment.score}` : '—'} sub="net positive index" accent={sentiment && sentiment.score >= 0 ? 'var(--success)' : 'var(--danger,#c0392b)'} />
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1.6fr 1fr', gap: 14, marginBottom: 14 }}>
        <div style={{ ...card, padding: 18 }}>
          <div style={{ fontWeight: 700, fontSize: 15, marginBottom: 4 }}>Message volume</div>
          <div style={{ fontSize: 12, color: 'var(--ink-3)', marginBottom: 14 }}>Last 14 days · inbound vs outbound</div>
          <VolumeChart data={volume ?? []} />
          <div style={{ display: 'flex', gap: 16, marginTop: 12, fontSize: 12, color: 'var(--ink-3)' }}>
            <Legend color="var(--brand,#132376)" label="Inbound" />
            <Legend color="var(--gold,#E6A23C)" label="Outbound" />
          </div>
        </div>

        <div style={{ ...card, padding: 18 }}>
          <div style={{ fontWeight: 700, fontSize: 15, marginBottom: 14 }}>Channel mix</div>
          <ChannelBars data={channels ?? []} />
        </div>
      </div>

      <div style={{ ...card, padding: 18 }}>
        <div style={{ fontWeight: 700, fontSize: 15, marginBottom: 14 }}>Customer sentiment</div>
        {sentiment && <SentimentBar s={sentiment} />}
      </div>
    </div>
  );
}

function Kpi({ icon, label, value, sub, accent }: { icon: React.ReactNode; label: string; value: number | string; sub?: string; accent?: string }) {
  return (
    <div style={{ ...card, padding: 16 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, color: 'var(--ink-3)', marginBottom: 10 }}>
        <span style={{ color: accent ?? 'var(--ink-2)' }}>{icon}</span>
        <span style={{ fontSize: 12.5 }}>{label}</span>
      </div>
      <div style={{ fontSize: 26, fontWeight: 800, color: accent ?? 'var(--ink-1)', letterSpacing: '-.02em' }}>{value}</div>
      {sub && <div style={{ fontSize: 11.5, color: 'var(--ink-3)', marginTop: 2 }}>{sub}</div>}
    </div>
  );
}

function VolumeChart({ data }: { data: VolumePoint[] }) {
  const max = Math.max(1, ...data.map((d) => Math.max(d.in, d.out)));
  const W = 560, H = 150, pad = 4;
  const bw = data.length ? (W - pad * 2) / data.length : 0;
  return (
    <svg viewBox={`0 0 ${W} ${H}`} style={{ width: '100%', height: 150 }}>
      {data.map((d, i) => {
        const x = pad + i * bw;
        const inH = (d.in / max) * (H - 20);
        const outH = (d.out / max) * (H - 20);
        const half = (bw - 6) / 2;
        return (
          <g key={d.date}>
            <rect x={x + 2} y={H - 16 - inH} width={half} height={inH} rx={2} fill="var(--brand,#132376)" />
            <rect x={x + 2 + half + 1} y={H - 16 - outH} width={half} height={outH} rx={2} fill="var(--gold,#E6A23C)" />
            {i % 2 === 0 && <text x={x + bw / 2} y={H - 3} textAnchor="middle" fontSize="8" fill="var(--ink-3)">{d.date.slice(5)}</text>}
          </g>
        );
      })}
    </svg>
  );
}

function ChannelBars({ data }: { data: ChannelStat[] }) {
  const max = Math.max(1, ...data.map((d) => d.count));
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      {data.length === 0 && <div style={{ fontSize: 13, color: 'var(--ink-3)' }}>No conversations yet.</div>}
      {data.map((d) => (
        <div key={d.channel}>
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12.5, marginBottom: 4 }}>
            <span>{CHANNEL_META[d.channel as ChannelType]?.icon} {CHANNEL_META[d.channel as ChannelType]?.label ?? d.channel}</span>
            <span style={{ fontWeight: 700 }}>{d.count}</span>
          </div>
          <div style={{ height: 8, background: 'var(--surface-2)', borderRadius: 20 }}>
            <div style={{ height: '100%', width: `${(d.count / max) * 100}%`, background: 'var(--brand,#132376)', borderRadius: 20 }} />
          </div>
        </div>
      ))}
    </div>
  );
}

function SentimentBar({ s }: { s: SentimentStat }) {
  const seg = (n: number) => `${(n / s.total) * 100}%`;
  return (
    <div>
      <div style={{ display: 'flex', height: 14, borderRadius: 20, overflow: 'hidden' }}>
        <div style={{ width: seg(s.positive), background: 'var(--success)' }} />
        <div style={{ width: seg(s.neutral), background: 'var(--surface-3)' }} />
        <div style={{ width: seg(s.negative), background: 'var(--danger,#c0392b)' }} />
      </div>
      <div style={{ display: 'flex', gap: 18, marginTop: 12, fontSize: 12.5 }}>
        <Legend color="var(--success)" label={`Positive ${s.positive}`} />
        <Legend color="var(--surface-3)" label={`Neutral ${s.neutral}`} />
        <Legend color="var(--danger,#c0392b)" label={`Negative ${s.negative}`} />
      </div>
    </div>
  );
}

function Legend({ color, label }: { color: string; label: string }) {
  return <span style={{ display: 'flex', alignItems: 'center', gap: 6, color: 'var(--ink-3)' }}><span style={{ width: 10, height: 10, borderRadius: 3, background: color, display: 'inline-block' }} />{label}</span>;
}

function fmtMins(m: number) {
  if (!m) return '<1m';
  if (m < 60) return `${m}m`;
  return `${Math.round(m / 60)}h`;
}
