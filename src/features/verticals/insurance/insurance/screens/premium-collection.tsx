'use client';

/**
 * The collection desk: premium across the whole book.
 *
 * Commission answers "what have we earned". This answers the two questions a
 * broker who collects premium has to answer to anybody — the insurer, an
 * auditor, themselves: who still owes us, and how much of somebody else's money
 * are we sitting on?
 *
 * Only policies the office actually collects for appear. Where the customer
 * pays the insurer directly there is nothing to hold and nothing to chase.
 */

import { useMemo, useState } from 'react';
import Link from 'next/link';
import { useQuery } from '@tanstack/react-query';
import { Banknote, ShieldAlert } from 'lucide-react';
import { api, apiErrorMessage } from '@/lib/api';
import { fmtOrgMoney } from '@/lib/org-locale';
import { Badge, Card, EmptyState, Skeleton, StatCard } from '../ui/kit';

const money = (n?: number | null) => fmtOrgMoney(n);

type Row = {
  id: string; policyNo: string; premiumInr: number; companyName: string; productName: string;
  status: string; startDate: string; clientName: string;
  collectedInr: number; outstandingInr: number; heldInr: number;
};

const FILTERS = ['Outstanding', 'Held for insurer', 'Settled', 'All'] as const;
type Filter = (typeof FILTERS)[number];

export function InsurancePremiumCollection() {
  const [filter, setFilter] = useState<Filter>('Outstanding');

  const { data, isLoading, isError, error } = useQuery<{ rows: Row[]; totals: any }>({
    queryKey: ['ins-premium-board'],
    queryFn: async () => (await api.get('/insurance/premium-collection')).data,
  });

  const rows = useMemo(() => {
    const all = data?.rows ?? [];
    if (filter === 'Outstanding') return all.filter((r) => r.outstandingInr > 0);
    if (filter === 'Held for insurer') return all.filter((r) => r.heldInr > 0);
    if (filter === 'Settled') return all.filter((r) => r.outstandingInr === 0 && r.heldInr === 0);
    return all;
  }, [data, filter]);

  if (isLoading) return <Skeleton rows={6} height={64} />;
  if (isError) return <EmptyState icon={ShieldAlert} title="Couldn't load premium collection" body={apiErrorMessage(error)} />;

  const t = data!.totals;

  return (
    <div className="ds-stack" style={{ gap: 'var(--gap-section)' }}>
      <div>
        <h1 className="ds-h1">Premium collection</h1>
        <p className="ds-caption" style={{ marginTop: 'var(--s-1)' }}>
          Policies this office collects premium for. Money held is the insurer&rsquo;s, not ours.
        </p>
      </div>

      <div className="ds-grid" style={{ gridTemplateColumns: 'repeat(auto-fit,minmax(190px,1fr))' }}>
        <StatCard label="Premium on the book" value={money(t.premiumInr)} icon={Banknote} tone="info" />
        <StatCard label="Collected" value={money(t.collectedInr)} tone="active" />
        <StatCard label="Outstanding" value={money(t.outstandingInr)} tone={t.outstandingInr ? 'renewal' : 'neutral'} />
        {/* Must agree with the 2400 balance in the trial balance. */}
        <StatCard label="Held for insurers" value={money(t.heldInr)} tone={t.heldInr ? 'claim' : 'neutral'} />
      </div>

      <div className="ds-subnav">
        {FILTERS.map((f) => (
          <button
            key={f}
            className="ds-subnav-item"
            data-active={filter === f}
            onClick={() => setFilter(f)}
            style={{ background: 'none', border: 0, cursor: 'pointer' }}
          >
            {f}
          </button>
        ))}
      </div>

      {!rows.length ? (
        <Card>
          <EmptyState
            icon={Banknote}
            title={filter === 'Outstanding' ? 'Nothing outstanding' : 'Nothing here'}
            body={
              (data!.rows.length === 0)
                ? 'No policy is marked as collected through this office. Open a policy and use the Premium tab if you take the money yourself.'
                : filter === 'Outstanding'
                  ? 'Every policy collected through this office is paid up.'
                  : 'No policy matches this filter.'
            }
            compact
          />
        </Card>
      ) : (
        <Card>
          <div style={{ overflowX: 'auto' }}>
            <table className="ds-table">
              <thead>
                <tr>
                  <th>Policy</th><th>Client</th><th>Insurer</th>
                  <th style={{ textAlign: 'right' }}>Premium</th>
                  <th style={{ textAlign: 'right' }}>Collected</th>
                  <th style={{ textAlign: 'right' }}>Outstanding</th>
                  <th style={{ textAlign: 'right' }}>Held</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => (
                  <tr key={r.id}>
                    <td>
                      <Link href={`/insurance/policies/${r.id}?tab=premium`} style={{ fontWeight: 600 }}>{r.policyNo}</Link>
                      <div className="ds-caption">{r.productName}</div>
                    </td>
                    <td>{r.clientName}</td>
                    <td>{r.companyName}</td>
                    <td className="ds-num" style={{ textAlign: 'right' }}>{money(r.premiumInr)}</td>
                    <td className="ds-num" style={{ textAlign: 'right' }}>{money(r.collectedInr)}</td>
                    <td className="ds-num" style={{ textAlign: 'right' }}>
                      {r.outstandingInr > 0
                        ? <Badge tone="renewal">{money(r.outstandingInr)}</Badge>
                        : <span className="ds-caption">—</span>}
                    </td>
                    <td className="ds-num" style={{ textAlign: 'right' }}>
                      {r.heldInr > 0
                        ? <Badge tone="claim">{money(r.heldInr)}</Badge>
                        : <span className="ds-caption">—</span>}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      )}
    </div>
  );
}
