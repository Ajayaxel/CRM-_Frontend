'use client';

// §1 + §6 + §16 — the landing screen. Six numbers, then the last movements,
// and every number is a door: click it and you are in a filtered transaction
// list. That is the whole "one or two clicks" requirement.

import { useQuery } from '@tanstack/react-query';
import {
  ArrowDownLeft, ArrowUpRight, TrendingUp, Wallet, HandCoins, ReceiptText,
  ChevronRight, ArrowRight,
} from 'lucide-react';
import { api } from '@/lib/api';
import { Overview, MoneyType, money, signedMoney, delta, fmtDate, TYPE_META } from '../accounts-client';
import type { Section } from './accounts-feature';

const card: React.CSSProperties = { background: 'var(--surface)', border: '1px solid var(--line-soft)', borderRadius: 16 };

export function OverviewPanel({ window, onDrill }: {
  window: { from?: string; to?: string };
  onDrill: (s: Section, p?: { direction?: MoneyType; accountId?: string }) => void;
}) {
  const { data, isLoading } = useQuery({
    queryKey: ['acct-overview', window.from, window.to],
    queryFn: async () => (await api.get<Overview>('/accounting/overview', { params: window })).data,
  });

  if (isLoading) return <div style={{ ...card, padding: 40, textAlign: 'center', color: 'var(--ink-3)', fontSize: 13.5 }}>Loading…</div>;
  if (!data) return null;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(210px, 1fr))', gap: 12 }}>
        <Card
          icon={<ArrowDownLeft size={17} />} label="Money In" value={money(data.moneyIn)}
          accent="var(--success)" change={delta(data.moneyIn, data.previous?.moneyIn)}
          onClick={() => onDrill('transactions', { direction: 'IN' })}
        />
        <Card
          icon={<ArrowUpRight size={17} />} label="Money Out" value={money(data.moneyOut)}
          accent="var(--danger)" change={delta(data.moneyOut, data.previous?.moneyOut)} invertChange
          onClick={() => onDrill('transactions', { direction: 'OUT' })}
        />
        <Card
          icon={<TrendingUp size={17} />} label="Net Cash Flow" value={signedMoney(data.netCashFlow)}
          accent={data.netCashFlow >= 0 ? 'var(--success)' : 'var(--danger)'}
          change={delta(data.netCashFlow, data.previous?.netCashFlow)}
          onClick={() => onDrill('transactions')}
        />
        <Card
          icon={<Wallet size={17} />} label="Total Available Balance" value={money(data.totalBalance)}
          accent="var(--navy)"
          sub={`Cash ${money(data.cash)} · Bank ${money(data.bank)}`}
          onClick={() => onDrill('cash-bank')}
        />
        <Card
          icon={<HandCoins size={17} />} label="Accounts Receivable" value={money(data.receivable)}
          accent="var(--gold)" sub="Expected from customers"
          onClick={() => onDrill('receivables')}
        />
        <Card
          icon={<ReceiptText size={17} />} label="Accounts Payable" value={money(data.payable)}
          accent="var(--gold)" sub="Owed to vendors & staff"
          onClick={() => onDrill('payables')}
        />
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: 12 }}>
        {data.accounts.map((a) => (
          <button key={a.id} onClick={() => onDrill('transactions', { accountId: a.id })}
            style={{ ...card, padding: 14, textAlign: 'left', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 12 }}>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: 12.5, color: 'var(--ink-3)' }}>{a.name}</div>
              <div style={{ fontSize: 19, fontWeight: 800, marginTop: 3, fontVariantNumeric: 'tabular-nums' }}>{money(a.balance)}</div>
              <div style={{ fontSize: 11.5, color: 'var(--ink-3)', marginTop: 3 }}>
                In {money(a.moneyIn)} · Out {money(a.moneyOut)}
              </div>
            </div>
            <ChevronRight size={16} style={{ color: 'var(--ink-3)', flexShrink: 0 }} />
          </button>
        ))}
      </div>

      <div style={{ ...card, overflow: 'hidden' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '13px 16px', borderBottom: '1px solid var(--line-soft)' }}>
          <span style={{ fontWeight: 700, fontSize: 14.5 }}>Recent transactions</span>
          <button className="btn-secondary" style={{ height: 30, fontSize: 12.5 }} onClick={() => onDrill('transactions')}>
            View all <ArrowRight size={13} />
          </button>
        </div>
        {data.recent.length === 0 ? (
          <div style={{ padding: 34, textAlign: 'center', color: 'var(--ink-3)', fontSize: 13.5 }}>
            No money has moved in this period.
          </div>
        ) : (
          <div>
            {data.recent.map((t) => {
              const meta = TYPE_META[t.type];
              return (
                <div key={t.id} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '11px 16px', borderBottom: '1px solid var(--line-soft)' }}>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 13.5, fontWeight: 600, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{t.memo}</div>
                    <div style={{ fontSize: 11.5, color: 'var(--ink-3)', marginTop: 2 }}>{fmtDate(t.date)} · {t.account} · {t.category}</div>
                  </div>
                  <span className="badge" style={{ background: meta.bg, color: meta.fg, flexShrink: 0 }}>{meta.label}</span>
                  <div style={{ fontWeight: 700, fontSize: 14, fontVariantNumeric: 'tabular-nums', flexShrink: 0, minWidth: 92, textAlign: 'right', color: t.moneyIn ? 'var(--success)' : t.moneyOut ? 'var(--danger)' : 'var(--ink-2)' }}>
                    {t.moneyIn ? `+${money(t.moneyIn)}` : t.moneyOut ? `−${money(t.moneyOut)}` : money(t.amount)}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}

function Card({ icon, label, value, accent, sub, change, invertChange, onClick }: {
  icon: React.ReactNode; label: string; value: string; accent?: string; sub?: string;
  change?: number | null; invertChange?: boolean; onClick?: () => void;
}) {
  // On "Money Out", a rise is not good news — the arrow direction stays honest
  // but the colour follows the meaning, not the sign.
  const good = change == null ? null : invertChange ? change < 0 : change > 0;
  return (
    <button onClick={onClick} style={{ ...card, padding: 15, textAlign: 'left', cursor: onClick ? 'pointer' : 'default', display: 'block', width: '100%' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, color: accent ?? 'var(--ink-2)' }}>
        {icon}
        <span style={{ fontSize: 12.5, color: 'var(--ink-3)', fontWeight: 600 }}>{label}</span>
      </div>
      <div style={{ fontSize: 24, fontWeight: 800, marginTop: 8, letterSpacing: '-.02em', fontVariantNumeric: 'tabular-nums', color: accent }}>{value}</div>
      {change != null && (
        <div style={{ fontSize: 11.5, marginTop: 5, color: good ? 'var(--success)' : 'var(--danger)' }}>
          {change > 0 ? '▲' : '▼'} {Math.abs(change).toFixed(1)}% vs previous period
        </div>
      )}
      {sub && <div style={{ fontSize: 11.5, marginTop: 5, color: 'var(--ink-3)' }}>{sub}</div>}
    </button>
  );
}
