'use client';

/**
 * Farm profitability — read from the SHARED cost-centre ledger.
 *
 * Deliberately not a poultry-only calculation over the same documents. A
 * second arithmetic gives a second answer, and the number Accounts quotes has
 * to be the number the farm sees. What this screen adds is the operational
 * context — birds, weight, FCR — beside figures it did not compute.
 */

import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useRouter } from 'next/navigation';
import { Landmark } from 'lucide-react';
import { api } from '@/lib/api';
import { Card, DataTable, Field, Skeleton, StatCard, type DataTableColumn } from '../ui/kit';
import { PageHead, money } from '../ui/common';

interface Row {
  farmId: string; code: string; name: string; status: string; costCenterId: string | null;
  revenueInr: number; expenseInr: number; profitInr: number;
}

interface Report {
  window: { from: string; to: string };
  rows: Row[];
  totals: { revenueInr: number; expenseInr: number; profitInr: number };
  untaggedExpenseInr: number;
  source: string;
}

const monthStart = () => {
  const n = new Date();
  return new Date(n.getFullYear(), n.getMonth(), 1).toISOString().slice(0, 10);
};

export function FarmProfitabilityScreen() {
  const router = useRouter();
  const [from, setFrom] = useState(monthStart());
  const [to, setTo] = useState(new Date().toISOString().slice(0, 10));

  const report = useQuery({
    queryKey: ['py', 'farm-profitability', from, to],
    queryFn: async () => (await api.get<Report>('/poultry/farm-profitability', { params: { from, to } })).data,
  });

  const columns: DataTableColumn<Row>[] = [
    {
      key: 'name', header: 'Farm', sortable: true,
      render: (r) => (
        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          <Landmark size={15} style={{ color: 'var(--ink-3)', flex: 'none' }} />
          <div>
            <div style={{ fontWeight: 600 }}>{r.name}</div>
            <div className="ds-caption">{r.code} · {r.status.toLowerCase()}</div>
          </div>
        </div>
      ),
    },
    { key: 'revenueInr', header: 'Revenue', align: 'right', sortable: true, render: (r) => money(r.revenueInr) },
    { key: 'expenseInr', header: 'Cost', align: 'right', sortable: true, render: (r) => money(r.expenseInr) },
    { key: 'profitInr', header: 'Profit', align: 'right', sortable: true, render: (r) => (
      <span style={{ fontWeight: 600, color: r.profitInr < 0 ? 'var(--tone-expired)' : 'var(--ink-1)' }}>{money(r.profitInr)}</span>
    ) },
  ];

  return (
    <div className="ds-page">
      <PageHead
        title="Farm profitability"
        subtitle="Read from the shared cost-centre ledger — the same figures Accounts reads, not a second calculation over the same documents."
        actions={(
          <>
            <Field label="From"><input className="input" type="date" value={from} onChange={(e) => setFrom(e.target.value)} /></Field>
            <Field label="To"><input className="input" type="date" value={to} onChange={(e) => setTo(e.target.value)} /></Field>
          </>
        )}
      />

      {report.isLoading || !report.data ? <Skeleton rows={4} height={92} /> : (
        <>
          <div className="ds-grid ds-grid-kpi">
            <StatCard label="Revenue" value={money(report.data.totals.revenueInr)} hint="tagged to a farm" />
            <StatCard label="Cost" value={money(report.data.totals.expenseInr)} hint="tagged to a farm" />
            <StatCard
              label="Profit"
              value={money(report.data.totals.profitInr)}
              tone={report.data.totals.profitInr >= 0 ? 'active' : 'expired'}
            />
            <StatCard
              label="Untagged cost"
              value={money(report.data.untaggedExpenseInr)}
              hint="reached the ledger with no cost centre — not in the rows below"
              tone={report.data.untaggedExpenseInr > 0 ? 'renewal' : 'neutral'}
            />
          </div>

          <div style={{ marginTop: 16 }}>
            <Card flush>
              <DataTable
                columns={columns}
                rows={report.data.rows}
                rowKey={(r) => r.farmId}
                onRowClick={(r) => router.push(`/poultry/farms/${r.farmId}`)}
                empty="No farm carries a cost centre yet — one is created automatically when a farm is added."
              />
              <p className="ds-caption" style={{ padding: '12px 16px', borderTop: '1px solid var(--hairline-soft)' }}>
                {report.data.source} Untagged cost is named rather than spread, because quietly allocating it
                would make every farm look worse by an amount nobody chose.
              </p>
            </Card>
          </div>
        </>
      )}
    </div>
  );
}
