'use client';

import { useQuery } from '@tanstack/react-query';
import { Building, KeyRound, Wallet, Wrench, TrendingUp, Users } from 'lucide-react';
import { api } from '@/lib/api';
import { useAuth } from '@/features/foundation/auth';
import { money } from '../realestate-client';

const card: React.CSSProperties = { background: 'var(--surface)', border: '1px solid var(--line-soft)', borderRadius: 16 };

interface RD {
  properties: { total: number; available: number; rented: number; portfolioValue: number; occupancyPct: number };
  rental: { activeLeases: number; monthlyRentRoll: number; expiringSoon: number; deposits: number };
  finance: { outstanding: number; collectedThisMonth: number };
  complaints: { open: number; overdue: number };
  maintenance: { scheduled: number; costThisMonth: number };
  pipeline: { buyerLeads: number };
  recentLeases: { tenant: string; rent: number; ref?: string; status: string; at: string }[];
  recentComplaints: { ticketNo: string; title: string; status: string; priority: string; createdAt: string }[];
}

export function RealEstateDashboard() {
  const { user } = useAuth();
  const { data: d } = useQuery({ queryKey: ['re-dashboard'], queryFn: async () => (await api.get<RD>('/realestate/dashboard')).data });
  const fmtDate = (s: string) => new Date(s).toLocaleDateString('en-IN', { day: '2-digit', month: 'short' });

  return (
    <div style={{ animation: 'fadeUp .4s ease' }}>
      <div style={{ marginBottom: 20 }}>
        <div style={{ fontSize: 12, letterSpacing: '.08em', color: 'var(--ink-3)', textTransform: 'uppercase' }}>{new Date().toLocaleDateString('en-IN', { weekday: 'long', day: 'numeric', month: 'long' })}</div>
        <h1 style={{ fontSize: 27, fontWeight: 700, letterSpacing: '-.02em', margin: '4px 0 0' }}>Portfolio Overview</h1>
        <p style={{ fontSize: 14, color: 'var(--ink-2)', margin: '6px 0 0' }}>Welcome back{user ? `, ${user.firstName}` : ''} — {d?.properties.total ?? 0} properties, {d?.rental.activeLeases ?? 0} active leases.</p>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 14, marginBottom: 14 }}>
        <Kpi icon={<Building size={18} />} label="Portfolio value" value={money(d?.properties.portfolioValue ?? 0)} sub={`${d?.properties.total ?? 0} properties`} accent="var(--brand,#132376)" />
        <Kpi icon={<TrendingUp size={18} />} label="Occupancy" value={`${d?.properties.occupancyPct ?? 0}%`} sub={`${d?.properties.rented ?? 0} rented · ${d?.properties.available ?? 0} available`} accent="var(--success)" />
        <Kpi icon={<KeyRound size={18} />} label="Monthly rent roll" value={money(d?.rental.monthlyRentRoll ?? 0)} sub={`${d?.rental.activeLeases ?? 0} leases`} accent="var(--gold,#E6A23C)" />
        <Kpi icon={<Wallet size={18} />} label="Outstanding" value={money(d?.finance.outstanding ?? 0)} sub={`${money(d?.finance.collectedThisMonth ?? 0)} collected`} />
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 14, marginBottom: 18 }}>
        <Kpi icon={<Users size={18} />} label="Buyer leads" value={d?.pipeline.buyerLeads ?? 0} sub="with requirements" />
        <Kpi icon={<Wrench size={18} />} label="Open complaints" value={d?.complaints.open ?? 0} sub={`${d?.complaints.overdue ?? 0} overdue SLA`} accent={d?.complaints.overdue ? 'var(--danger,#c0392b)' : undefined} />
        <Kpi icon={<Wrench size={18} />} label="Maintenance jobs" value={d?.maintenance.scheduled ?? 0} sub={`${money(d?.maintenance.costThisMonth ?? 0)} this month`} />
        <Kpi icon={<KeyRound size={18} />} label="Leases expiring" value={d?.rental.expiringSoon ?? 0} sub="within 60 days" accent={d?.rental.expiringSoon ? 'var(--warning,#c67c1e)' : undefined} />
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
        <div style={{ ...card, padding: 18 }}>
          <div style={{ fontWeight: 700, fontSize: 15, marginBottom: 12 }}>Recent leases</div>
          {(d?.recentLeases ?? []).length === 0 && <div style={{ fontSize: 13, color: 'var(--ink-3)' }}>No leases yet.</div>}
          {(d?.recentLeases ?? []).map((l, i) => (
            <div key={i} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '9px 0', borderTop: i ? '1px solid var(--line-soft)' : 'none' }}>
              <div><div style={{ fontWeight: 600, fontSize: 13.5 }}>{l.tenant}</div><div style={{ fontSize: 12, color: 'var(--ink-3)' }}>{l.ref} · {fmtDate(l.at)}</div></div>
              <div style={{ textAlign: 'right' }}><div style={{ fontWeight: 700, color: 'var(--brand,#132376)' }}>{money(l.rent)}/mo</div><span className="badge" style={{ background: 'var(--surface-2)', color: 'var(--ink-3)' }}>{l.status}</span></div>
            </div>
          ))}
        </div>
        <div style={{ ...card, padding: 18 }}>
          <div style={{ fontWeight: 700, fontSize: 15, marginBottom: 12 }}>Recent complaints</div>
          {(d?.recentComplaints ?? []).length === 0 && <div style={{ fontSize: 13, color: 'var(--ink-3)' }}>No complaints. 🎉</div>}
          {(d?.recentComplaints ?? []).map((c, i) => (
            <div key={i} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '9px 0', borderTop: i ? '1px solid var(--line-soft)' : 'none' }}>
              <div><div style={{ fontWeight: 600, fontSize: 13.5 }}>{c.title}</div><div style={{ fontSize: 12, color: 'var(--ink-3)' }}>{c.ticketNo} · {fmtDate(c.createdAt)}</div></div>
              <span className="badge" style={{ background: 'var(--surface-2)', color: 'var(--ink-3)' }}>{c.status}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function Kpi({ icon, label, value, sub, accent }: { icon: React.ReactNode; label: string; value: number | string; sub?: string; accent?: string }) {
  return (
    <div style={{ ...card, padding: 18 }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', color: 'var(--ink-3)', marginBottom: 10 }}>
        <span style={{ fontSize: 12.5, textTransform: 'uppercase', letterSpacing: '.04em' }}>{label}</span>
        <span style={{ color: accent ?? 'var(--ink-2)' }}>{icon}</span>
      </div>
      <div style={{ fontSize: 25, fontWeight: 800, color: accent ?? 'var(--ink-1)', letterSpacing: '-.02em' }}>{value}</div>
      {sub && <div style={{ fontSize: 12, color: 'var(--ink-3)', marginTop: 3 }}>{sub}</div>}
    </div>
  );
}
