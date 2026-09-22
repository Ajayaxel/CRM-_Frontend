'use client';

/**
 * Agent business, company-wide — one month across every introducer.
 *
 * The company counterpart to the agent record: what the office wrote, which
 * products it came from, and who brought it in. Every figure comes from
 * GET /insurance/agent-business/company and none is recomputed here.
 *
 *   Net profit = payout - agent commission - executive commission
 *
 * Negative totals are shown as they are. AGT-0002 legitimately contributes
 * -2,300 because POL-0016 carries a real 3,800 payment against a policy with no
 * commission record — an open business question, not a number to tidy away.
 */

import { useState } from 'react';
import Link from 'next/link';
import { useQuery } from '@tanstack/react-query';
import { Banknote } from 'lucide-react';
import { api, apiErrorMessage } from '@/lib/api';
import { fmtOrgMoney } from '@/lib/org-locale';
import { Card, EmptyState, Skeleton } from '../ui/kit';
import { PeriodPicker, emptyPeriod, periodQuery, type PeriodValue } from '../ui/period-picker';

const money = (n?: number | null) => fmtOrgMoney(n ?? 0);

interface Money {
  policies: number; premiumInr: number; payoutInr: number;
  agentCommissionInr: number; execCommissionInr: number; companyProfitInr: number;
}
interface Category { category: string; label: string; total: Money }
interface Group { group: string; label: string; total: Money; categories: Category[] }
interface Ranked extends Money { id: string; code: string; name: string }
interface CompanyBusiness {
  month: string | null;
  monthLabel: string | null;
  // What the server actually scoped to, however it was asked. `monthLabel` is
  // null for a range, so headings read this instead.
  periodLabel: string | null;
  periodBasis: string;
  availableMonths: { month: string; label: string }[];
  agentCount: number;
  totals: Money;
  breakdown: Group[];
  ranking: Ranked[];
}

function Profit({ v, bold }: { v: number; bold?: boolean }) {
  return (
    <span className="ds-num" style={{ fontWeight: bold ? 600 : undefined, color: v < 0 ? 'var(--tone-expired)' : 'var(--ink)' }}>
      {money(v)}
    </span>
  );
}

const COLS: [keyof Money, string][] = [
  ['policies', 'Policies'], ['premiumInr', 'Premium'], ['payoutInr', 'Payout'],
  ['agentCommissionInr', 'Agent'], ['execCommissionInr', 'Executive'], ['companyProfitInr', 'Net profit'],
];

export function InsuranceCompanyBusiness() {
  const [period, setPeriod] = useState<PeriodValue>(emptyPeriod);
  const query = periodQuery(period);

  const q = useQuery<CompanyBusiness>({
    queryKey: ['ins-company-business', query],
    queryFn: async () => (await api.get(`/insurance/agent-business/company${query}`)).data,
  });

  if (q.isLoading && !q.data) return <Skeleton rows={5} height={70} />;
  if (q.isError && !q.data) {
    return (
      <Card>
        <EmptyState icon={Banknote} title="Business data unavailable"
          body={`The company figures could not be loaded — ${apiErrorMessage(q.error)}. This is missing data, not zero.`} />
      </Card>
    );
  }
  const d = q.data!;
  const t = d.totals;

  return (
    <div className="ds-stack" style={{ gap: 'var(--gap-section)' }}>
      <div style={{ display: 'flex', alignItems: 'flex-end', gap: 16, flexWrap: 'wrap' }}>
        <div>
          <h1 className="ds-h1">Agent business</h1>
          <p className="ds-caption" style={{ marginTop: 4 }}>
            Company-wide, {d.periodLabel ?? 'no period'} &middot; {d.agentCount} agent{d.agentCount === 1 ? '' : 's'} with business
          </p>
        </div>
        <span style={{ flex: 1 }} />
        <PeriodPicker
          id="company"
          value={period}
          onChange={setPeriod}
          months={d.availableMonths}
          selectedMonth={d.month}
        />
      </div>

      {!d.periodLabel ? (
        <Card><EmptyState icon={Banknote} title="No business recorded yet"
          body="Policies attributed to an agent will appear here, month by month." /></Card>
      ) : (
        <>
          <Card>
            <p className="ds-caption-upper" style={{ marginBottom: 10 }}>{d.periodLabel}</p>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0 40px' }}>
              {COLS.map(([k, label]) => (
                <div key={k} style={{ minWidth: 120 }}>
                  <div className="ds-caption" style={{ marginBottom: 3 }}>{label}</div>
                  <div style={{ fontSize: 17 }}>
                    {k === 'companyProfitInr' ? <Profit v={t[k]} bold />
                      : <span className="ds-num">{k === 'policies' ? t[k] : money(t[k])}</span>}
                  </div>
                </div>
              ))}
            </div>
          </Card>

          {/* A range CAN legitimately be empty — that is an answer to the
              question asked, not a broken screen. Two tables of headers with no
              rows under them would read as a failure instead. */}
          {t.policies === 0 ? (
            <Card>
              <EmptyState compact icon={Banknote} title="No business in this period"
                body="Nothing was written between these dates. Widen the range, or choose another month." />
            </Card>
          ) : (
          <>
          <Card flush>
            <div style={{ padding: '14px 18px', borderBottom: '1px solid var(--line-soft)' }}>
              <h3 className="ds-h3" style={{ margin: 0 }}>Category performance</h3>
            </div>
            <div style={{ overflowX: 'auto' }}>
              <table className="ds-table">
                <thead>
                  <tr>
                    <th>Category</th>
                    {COLS.map(([k, l]) => <th key={k} style={{ textAlign: 'right' }}>{l}</th>)}
                  </tr>
                </thead>
                <tbody>
                  {d.breakdown.flatMap((g) => [
                    <tr key={g.group} style={{ background: 'var(--surface-2)' }}>
                      <td style={{ fontWeight: 650 }}>{g.label}</td>
                      {COLS.map(([k]) => (
                        <td key={k} style={{ textAlign: 'right' }}>
                          {k === 'companyProfitInr' ? <Profit v={g.total[k]} bold />
                            : <span className="ds-num">{k === 'policies' ? g.total[k] : money(g.total[k])}</span>}
                        </td>
                      ))}
                    </tr>,
                    ...g.categories.map((c) => (
                      <tr key={`${g.group}:${c.category}`}>
                        <td style={{ paddingLeft: 28 }}>{c.label}</td>
                        {COLS.map(([k]) => (
                          <td key={k} style={{ textAlign: 'right' }}>
                            {k === 'companyProfitInr' ? <Profit v={c.total[k]} />
                              : <span className="ds-num">{k === 'policies' ? c.total[k] : money(c.total[k])}</span>}
                          </td>
                        ))}
                      </tr>
                    )),
                  ])}
                </tbody>
              </table>
            </div>
          </Card>

          <Card flush>
            <div style={{ padding: '14px 18px', borderBottom: '1px solid var(--line-soft)' }}>
              <h3 className="ds-h3" style={{ margin: 0 }}>Agent ranking</h3>
              {/* The API orders by premium, then policy count. Saying so beats a
                  net-profit column that silently is not what the order follows. */}
              <p className="ds-caption" style={{ marginTop: 3, marginBottom: 0 }}>Ordered by premium written</p>
            </div>
            <div style={{ overflowX: 'auto' }}>
              <table className="ds-table">
                <thead>
                  <tr>
                    <th style={{ width: 44, textAlign: 'right' }}>#</th>
                    <th>Agent</th>
                    {COLS.map(([k, l]) => <th key={k} style={{ textAlign: 'right' }}>{l}</th>)}
                  </tr>
                </thead>
                <tbody>
                  {d.ranking.map((r, i) => (
                    <tr key={r.id}>
                      <td className="ds-num" style={{ textAlign: 'right', color: 'var(--ink-3)' }}>{i + 1}</td>
                      <td>
                        <Link href={`/insurance/agents/${r.id}`} style={{ fontWeight: 600 }}>{r.name}</Link>
                        <div className="ds-caption ds-num">{r.code}</div>
                      </td>
                      {COLS.map(([k]) => (
                        <td key={k} style={{ textAlign: 'right' }}>
                          {k === 'companyProfitInr' ? <Profit v={r[k]} bold />
                            : <span className="ds-num">{k === 'policies' ? r[k] : money(r[k])}</span>}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Card>
          </>
          )}
        </>
      )}

      <p className="ds-caption">
        Net profit is the payout less both commissions. A negative total is shown as it is &mdash;
        it means more was committed to an agent or executive than the insurer paid for that business.
      </p>
    </div>
  );
}
