'use client';

/**
 * Company setup — is this company ready to operate?
 *
 * Read-only. The server checks every master the operation depends on and says
 * which are done, which are missing and whether a missing one stops the day.
 * Nothing here seeds data: each row links to the screen where the company's
 * own record is entered.
 */

import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { useRouter } from 'next/navigation';
import { ArrowRight } from 'lucide-react';
import { api } from '@/lib/api';
import { Badge, Card, SectionTitle, Skeleton, StatCard } from '../ui/kit';
import { PageHead } from '../ui/common';

interface SetupItem {
  key: string; area: string; label: string; required: boolean;
  status: 'DONE' | 'MISSING' | 'WARNING' | 'INFO'; count: number; detail: string; href: string;
}
interface Setup {
  organization: { name: string; slug: string } | null;
  verdict: 'READY_TO_OPERATE' | 'SETUP_INCOMPLETE';
  counts: { done: number; missing: number; warnings: number; total: number };
  missing: { key: string; label: string; detail: string }[];
  items: SetupItem[];
  note: string;
}

const AREAS: [string, string][] = [
  ['COMPANY', 'Company'], ['FARMS', 'Farms and sheds'], ['PEOPLE', 'People'], ['TRADING', 'Suppliers and customers'],
  ['FINANCE', 'Money and cost centres'], ['RULES', 'Operating rules'], ['STOCK', 'Stock'], ['OPENING', 'Opening position'],
];

const TONE: Record<SetupItem['status'], 'active' | 'expired' | 'renewal' | undefined> = {
  DONE: 'active', MISSING: 'expired', WARNING: 'renewal', INFO: undefined,
};

export function CompanySetupScreen() {
  const router = useRouter();
  const setup = useQuery({
    queryKey: ['py', 'company-setup'],
    queryFn: async () => (await api.get<Setup>('/poultry/company-setup')).data,
  });

  if (setup.isLoading) return <div className="ds-page"><PageHead title="Company setup" /><Skeleton rows={5} height={60} /></div>;
  if (setup.isError || !setup.data) {
    return (
      <div className="ds-page">
        <PageHead title="Company setup" />
        <Card><p>The setup check could not be loaded. Reload the page; if it persists, the API is unavailable.</p></Card>
      </div>
    );
  }
  const s = setup.data;

  return (
    <div className="ds-page">
      <PageHead
        title="Company setup"
        subtitle={`${s.organization?.name ?? 'This company'} — every master the operation depends on, checked against the company's own records.`}
      />

      <div className="ds-grid ds-grid-kpi">
        <StatCard
          label="Status"
          value={s.verdict === 'READY_TO_OPERATE' ? 'Ready to operate' : 'Setup incomplete'}
          tone={s.verdict === 'READY_TO_OPERATE' ? 'active' : 'expired'}
          hint={s.verdict === 'READY_TO_OPERATE' ? 'every required master is in place' : `${s.counts.missing} required item(s) missing`}
        />
        <StatCard label="Done" value={`${s.counts.done} / ${s.counts.total}`} hint="checks passing" />
        <StatCard label="Warnings" value={String(s.counts.warnings)} hint="worth completing; they do not stop the day" tone={s.counts.warnings ? 'renewal' : 'neutral'} />
      </div>

      {s.missing.length > 0 && (
        <Card tone="expired">
          <SectionTitle sub="Each of these stops operation until it is entered.">Required and missing</SectionTitle>
          <ul style={{ margin: 0, paddingLeft: 18 }}>
            {s.missing.map((m) => <li key={m.key}><strong>{m.label}</strong> — {m.detail}</li>)}
          </ul>
        </Card>
      )}

      {AREAS.map(([area, title]) => {
        const rows = s.items.filter((i) => i.area === area);
        if (!rows.length) return null;
        return (
          <Card key={area}>
            <SectionTitle>{title}</SectionTitle>
            {rows.map((i) => (
              <div
                key={i.key}
                onClick={() => router.push(i.href)}
                style={{ display: 'grid', gridTemplateColumns: '1fr auto auto', gap: 12, alignItems: 'center', padding: '8px 0', borderBottom: '1px solid var(--ds-border, rgba(0,0,0,.06))', cursor: 'pointer' }}
              >
                <div>
                  <strong>{i.label}</strong>{i.required && <span className="ds-caption"> · required</span>}
                  <div className="ds-caption">{i.detail}</div>
                </div>
                <Badge tone={TONE[i.status]}>{i.status === 'DONE' ? 'done' : i.status === 'MISSING' ? 'missing' : i.status === 'WARNING' ? 'incomplete' : 'info'}</Badge>
                <ArrowRight size={14} style={{ color: 'var(--ink-3)' }} />
              </div>
            ))}
          </Card>
        );
      })}

      <p className="ds-caption">{s.note}</p>
    </div>
  );
}
