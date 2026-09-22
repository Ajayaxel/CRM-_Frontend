'use client';

/**
 * Agent profile — the complete business record of one introducer.
 *
 * A record page, not a dashboard: identity, then what they have brought in over
 * their lifetime, then a month, then the products inside that month, then the
 * policies themselves. Every figure comes from
 * GET /insurance/agent-business/:agentId — none of it is recomputed here,
 * because the frontend disagreeing with the ledger is the one failure this
 * screen exists to avoid.
 *
 *   Net profit = payout - agent commission - executive commission
 *
 * Premium is business volume and appears nowhere in that formula.
 */

import { useState } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { useQuery } from '@tanstack/react-query';
import { ArrowLeft, ChevronDown, ChevronRight, Users } from 'lucide-react';
import { api, apiErrorMessage } from '@/lib/api';
import { fmtOrgMoney } from '@/lib/org-locale';
import { Badge, Card, EmptyState, Skeleton, humanStatus } from '../ui/kit';
import { PeriodPicker, emptyPeriod, periodQuery, type PeriodValue } from '../ui/period-picker';

const money = (n?: number | null) => fmtOrgMoney(n ?? 0);

interface Money {
  policies: number; premiumInr: number; payoutInr: number;
  agentCommissionInr: number; execCommissionInr: number; companyProfitInr: number;
}
interface PolicyRow extends Money {
  id: string; policyNo: string; clientId: string; clientName: string; companyName: string;
  productName: string; productGroup: string; category: string; status: string;
}
interface Category { category: string; label: string; total: Money; policies: PolicyRow[] }
interface Group { group: string; label: string; total: Money; categories: Category[] }
interface Profile {
  agent: { id: string; code: string; name: string; status: string; agency?: string | null };
  lifetime: Money;
  months: (Money & { month: string; label: string })[];
  selectedMonth: string | null;
  selectedMonthLabel: string | null;
  // The period's own figures, whatever shape it was asked for. Reading them
  // off `months` only ever worked while a period WAS a month.
  periodLabel: string | null;
  periodTotals: Money;
  breakdown: Group[];
  policies: PolicyRow[];
}

/** Money is ink. The exception is a negative profit — it must not be hunted for. */
function Profit({ v, bold }: { v: number; bold?: boolean }) {
  return (
    <span className="ds-num" style={{ fontWeight: bold ? 600 : undefined, color: v < 0 ? 'var(--tone-expired)' : 'var(--ink)' }}>
      {money(v)}
    </span>
  );
}

function Figures({ m, label }: { m: Money; label: string }) {
  const cells: [string, React.ReactNode][] = [
    ['Policies', <span className="ds-num">{m.policies}</span>],
    ['Premium', <span className="ds-num">{money(m.premiumInr)}</span>],
    ['Payout', <span className="ds-num">{money(m.payoutInr)}</span>],
    ['Agent commission', <span className="ds-num">{money(m.agentCommissionInr)}</span>],
    ['Executive commission', <span className="ds-num">{money(m.execCommissionInr)}</span>],
    ['Net profit', <Profit v={m.companyProfitInr} bold />],
  ];
  return (
    <div>
      <p className="ds-caption-upper" style={{ marginBottom: 10 }}>{label}</p>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0 40px' }}>
        {cells.map(([k, v]) => (
          <div key={k} style={{ minWidth: 120 }}>
            <div className="ds-caption" style={{ marginBottom: 3 }}>{k}</div>
            <div style={{ fontSize: 17 }}>{v}</div>
          </div>
        ))}
      </div>
    </div>
  );
}

export function InsuranceAgentProfile() {
  const params = useParams();
  const id = String(params?.id ?? '');
  const [period, setPeriod] = useState<PeriodValue>(emptyPeriod);
  const [open, setOpen] = useState<Record<string, boolean>>({});
  const query = periodQuery(period);

  const q = useQuery<Profile>({
    queryKey: ['ins-agent-profile', id, query],
    queryFn: async () => (await api.get(`/insurance/agent-business/${id}${query}`)).data,
    enabled: !!id,
  });

  if (q.isLoading && !q.data) return <Skeleton rows={5} height={70} />;
  if (q.isError && !q.data) {
    return <Card><EmptyState icon={Users} title="Could not load this agent" body={apiErrorMessage(q.error)} /></Card>;
  }
  const d = q.data!;

  return (
    <div className="ds-stack" style={{ gap: 'var(--gap-section)' }}>
      <div>
        <Link href="/insurance/agents" className="ds-caption" style={{ display: 'inline-flex', alignItems: 'center', gap: 5 }}>
          <ArrowLeft size={13} aria-hidden="true" /> Agents
        </Link>
        <div style={{ display: 'flex', alignItems: 'baseline', gap: 12, marginTop: 8, flexWrap: 'wrap' }}>
          <h1 className="ds-h1">{d.agent.name}</h1>
          <span className="ds-caption ds-num">{d.agent.code}</span>
          <Badge tone={d.agent.status === 'ACTIVE' ? 'active' : 'neutral'}>{humanStatus(d.agent.status)}</Badge>
          {d.agent.agency && <span className="ds-caption">{d.agent.agency}</span>}
        </div>
      </div>

      <Card><Figures m={d.lifetime} label="Lifetime" /></Card>

      {d.months.length === 0 ? (
        <Card>
          <EmptyState compact icon={Users} title="No business attributed yet"
            body="Policies introduced by this agent will appear here, month by month." />
        </Card>
      ) : (
        <>
          <PeriodPicker
            id="agent"
            value={period}
            onChange={setPeriod}
            months={d.months.map((m) => ({ month: m.month, label: m.label }))}
            selectedMonth={d.selectedMonth}
          />

          <Card>{d.periodTotals.policies > 0
            ? <Figures m={d.periodTotals} label={d.periodLabel ?? 'Selected period'} />
            : <EmptyState compact icon={Users} title="No business recorded for this period"
                body="This agent introduced nothing between these dates. Widen the range, or choose another month." />}
          </Card>

          {d.breakdown.map((g) => (
            <Card key={g.group} flush>
              <div style={{ padding: '14px 18px', borderBottom: '1px solid var(--line-soft)', display: 'flex', alignItems: 'baseline', gap: 12 }}>
                <h3 className="ds-h3" style={{ margin: 0 }}>{g.label}</h3>
                <span className="ds-caption ds-num">{g.total.policies} policies</span>
                <span style={{ flex: 1 }} />
                <Profit v={g.total.companyProfitInr} bold />
              </div>
              <div style={{ overflowX: 'auto' }}>
                <table className="ds-table">
                  <thead>
                    <tr>
                      <th>Category</th>
                      <th style={{ textAlign: 'right' }}>Policies</th>
                      <th style={{ textAlign: 'right' }}>Premium</th>
                      <th style={{ textAlign: 'right' }}>Payout</th>
                      <th style={{ textAlign: 'right' }}>Agent</th>
                      <th style={{ textAlign: 'right' }}>Executive</th>
                      <th style={{ textAlign: 'right' }}>Net profit</th>
                    </tr>
                  </thead>
                  <tbody>
                    {g.categories.map((c) => {
                      const key = `${g.group}:${c.category}`;
                      const isOpen = !!open[key];
                      return (
                        <>
                          <tr key={key}>
                            <td>
                              <button
                                type="button"
                                onClick={() => setOpen((o) => ({ ...o, [key]: !o[key] }))}
                                aria-expanded={isOpen}
                                style={{ background: 'none', border: 0, cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: 6, color: 'var(--ink)', font: 'inherit' }}
                              >
                                {isOpen ? <ChevronDown size={14} aria-hidden="true" /> : <ChevronRight size={14} aria-hidden="true" />}
                                {c.label}
                              </button>
                            </td>
                            <td className="ds-num" style={{ textAlign: 'right' }}>{c.total.policies}</td>
                            <td className="ds-num" style={{ textAlign: 'right' }}>{money(c.total.premiumInr)}</td>
                            <td className="ds-num" style={{ textAlign: 'right' }}>{money(c.total.payoutInr)}</td>
                            <td className="ds-num" style={{ textAlign: 'right' }}>{money(c.total.agentCommissionInr)}</td>
                            <td className="ds-num" style={{ textAlign: 'right' }}>{money(c.total.execCommissionInr)}</td>
                            <td style={{ textAlign: 'right' }}><Profit v={c.total.companyProfitInr} /></td>
                          </tr>
                          {isOpen && c.policies.map((p) => (
                            <tr key={p.id} style={{ background: 'var(--surface-2)' }}>
                              <td style={{ paddingLeft: 34 }}>
                                {/* Both ends of the attribution are records, so
                                    both lead to them: the policy that earned the
                                    money, and the customer it was earned from.
                                    A figure you cannot trace back is a figure
                                    somebody has to go and look up by hand. */}
                                <Link href={`/insurance/policies/${p.id}`} style={{ fontWeight: 600 }}>
                                  {p.policyNo}
                                </Link>
                                <div className="ds-caption">
                                  {p.clientId
                                    ? <Link href={`/insurance/clients/${p.clientId}`}>{p.clientName}</Link>
                                    : p.clientName}
                                  {' · '}{p.companyName}
                                  {p.status === 'CANCELLED' && <> · <Badge tone="neutral">Reversed &mdash; cancelled</Badge></>}
                                </div>
                              </td>
                              <td className="ds-num" style={{ textAlign: 'right' }}>1</td>
                              <td className="ds-num" style={{ textAlign: 'right' }}>{money(p.premiumInr)}</td>
                              <td className="ds-num" style={{ textAlign: 'right' }}>{money(p.payoutInr)}</td>
                              <td className="ds-num" style={{ textAlign: 'right' }}>{money(p.agentCommissionInr)}</td>
                              <td className="ds-num" style={{ textAlign: 'right' }}>{money(p.execCommissionInr)}</td>
                              <td style={{ textAlign: 'right' }}><Profit v={p.companyProfitInr} /></td>
                            </tr>
                          ))}
                        </>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </Card>
          ))}
        </>
      )}

      <p className="ds-caption">
        Net profit is the payout less both commissions &mdash; the agent&rsquo;s and the executive&rsquo;s.
        Premium is business volume and is not part of it.
      </p>
    </div>
  );
}
