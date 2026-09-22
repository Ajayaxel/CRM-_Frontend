'use client';

/**
 * Cost centres and the allocation of shared cost.
 *
 * The screen has one job beyond CRUD: make it obvious that an allocation
 * DISTRIBUTES cost rather than creating it. So the run dialog shows the split
 * before it is posted, the list shows what each centre received, and the
 * performance table names the expense nobody tagged — because an untagged pile
 * is what makes a cost-centre report stop being trusted.
 */

import React, { useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Building2, GitBranch, Split } from 'lucide-react';
import { toast } from 'sonner';
import { api } from '@/lib/api';
import {
  Badge, Card, DataTable, EmptyState, Field, FormSection, Modal, SectionTitle, Segmented,
  Skeleton, StatCard, type DataTableColumn,
} from '@/features/verticals/insurance/insurance/ui/kit';
import { PageHead, TableNote, fmtDate, humanise, money, monthStart, pct, toDateInput } from '../ui';

interface Centre {
  id: string; code: string; name: string; description: string | null;
  kind: string; vertical: string | null; parentId: string | null; isActive: boolean;
  effectiveFrom: string | null; effectiveTo: string | null;
  parent?: { id: string; code: string; name: string } | null;
  _count?: { children: number };
}

interface PerfRow {
  id: string; code: string; name: string; kind: string; vertical: string | null;
  revenueInr: number; expenseInr: number; profitInr: number;
}

interface Rule {
  id: string; code: string; name: string; description: string | null; basis: string; isActive: boolean;
  effectiveFrom: string | null; effectiveTo: string | null;
  targets: { id: string; costCenterId: string; shareBps: number; costCenter: { id: string; code: string; name: string } }[];
}

interface Allocation {
  id: string; reference: string; accountCode: string; amountInr: number; status: string;
  periodFrom: string; periodTo: string; memo: string | null;
  rule: { name: string; basis: string };
  entries: { id: string; shareBps: number; amountInr: number; costCenter: { code: string; name: string } }[];
}

const VIEWS = ['Centres', 'Performance', 'Allocation'];
const KINDS = ['HEAD_OFFICE', 'PROJECT', 'BUSINESS_UNIT', 'WAREHOUSE', 'OUTLET', 'LOGISTICS', 'VEHICLE', 'OTHER'];
const KIND_LABELS: Record<string, string> = {
  HEAD_OFFICE: 'Head Office',
  PROJECT: 'Project / Property Site',
  BUSINESS_UNIT: 'Business Unit / Division',
  WAREHOUSE: 'Warehouse / Depot',
  OUTLET: 'Outlet / Showroom',
  LOGISTICS: 'Logistics',
  VEHICLE: 'Service Vehicle',
  OTHER: 'Other',
};

export function CostCentersScreen() {
  const qc = useQueryClient();
  const [view, setView] = useState(VIEWS[0]);
  const [from, setFrom] = useState(monthStart());
  const [to, setTo] = useState(toDateInput());
  const [editing, setEditing] = useState<Centre | null>(null);
  const [creating, setCreating] = useState(false);
  const [rulesOpen, setRulesOpen] = useState(false);
  const [runOpen, setRunOpen] = useState(false);

  const centres = useQuery({
    queryKey: ['core', 'cost-centers'],
    queryFn: async () => (await api.get<Centre[]>('/core/cost-centers')).data,
  });
  const performance = useQuery({
    queryKey: ['core', 'cc-performance', from, to],
    queryFn: async () => (await api.get<{ rows: PerfRow[]; untaggedExpenseInr: number }>('/core/cost-centers/performance', { params: { from, to } })).data,
    enabled: view === 'Performance',
  });
  const rules = useQuery({
    queryKey: ['core', 'allocation-rules'],
    queryFn: async () => (await api.get<Rule[]>('/core/allocation-rules')).data,
    enabled: view === 'Allocation' || rulesOpen || runOpen,
  });
  const allocations = useQuery({
    queryKey: ['core', 'allocations'],
    queryFn: async () => (await api.get<Allocation[]>('/core/allocations')).data,
    enabled: view === 'Allocation',
  });

  const invalidate = () => qc.invalidateQueries({ queryKey: ['core'] });
  const save = useMutation({
    mutationFn: async (body: any) =>
      editing ? (await api.patch(`/core/cost-centers/${editing.id}`, body)).data : (await api.post('/core/cost-centers', body)).data,
    onSuccess: () => { toast.success(editing ? 'Cost centre updated' : 'Cost centre created'); setCreating(false); setEditing(null); invalidate(); },
    onError: (e: any) => toast.error(e?.response?.data?.message ?? 'Could not save'),
  });
  const reverse = useMutation({
    mutationFn: async (id: string) => (await api.post(`/core/allocations/${id}/reverse`)).data,
    onSuccess: () => { toast.success('Allocation reversed'); invalidate(); },
    onError: (e: any) => toast.error(e?.response?.data?.message ?? 'Could not reverse'),
  });

  const columns: DataTableColumn<Centre>[] = [
    {
      key: 'code', header: 'Centre', sortable: true,
      render: (c) => (
        <div style={{ display: 'flex', gap: 8, alignItems: 'center', minWidth: 0 }}>
          <Building2 size={15} style={{ color: 'var(--ink-3)', flex: 'none' }} />
          <div style={{ minWidth: 0 }}>
            <div style={{ fontWeight: 600 }}>{c.code} · {c.name}</div>
            <div className="ds-caption">
              {KIND_LABELS[c.kind] || humanise(c.kind)}
              {c.parent ? ` · under ${c.parent.code}` : ''}
              {c._count?.children ? ` · ${c._count.children} below` : ''}
            </div>
          </div>
        </div>
      ),
    },
    { key: 'vertical', header: 'Business', sortable: true, render: (c) => (c.vertical ? humanise(c.vertical) : <span className="ds-caption">Shared</span>) },
    {
      key: 'effectiveFrom', header: 'Open', sortable: true,
      render: (c) => (c.effectiveFrom || c.effectiveTo ? `${fmtDate(c.effectiveFrom)} → ${c.effectiveTo ? fmtDate(c.effectiveTo) : 'open'}` : '—'),
    },
    { key: 'isActive', header: '', render: (c) => (c.isActive ? <Badge tone="active">Active</Badge> : <Badge tone="neutral">Inactive</Badge>) },
  ];

  return (
    <div className="ds-page">
      <PageHead
        title="Cost centres"
        subtitle="A management dimension inside this company's books — a site, a branch, a warehouse, Head Office. Never a separate legal entity."
        actions={(
          <>
            <button className="btn-secondary" onClick={() => setRulesOpen(true)}>Allocation rules</button>
            <button className="btn-primary" onClick={() => { setEditing(null); setCreating(true); }}>New cost centre</button>
          </>
        )}
      />

      <div style={{ marginBottom: 14 }}>
        <Segmented options={VIEWS} value={view} onChange={setView} />
      </div>

      {view === 'Centres' && (
        centres.isLoading ? <Skeleton rows={4} /> : (centres.data ?? []).length === 0 ? (
          <Card>
            <EmptyState
              icon={Building2}
              title="No cost centres yet"
              body="Add one per site, branch, depot or project office to organize expenses and revenues."
              actionLabel="New cost centre"
              onAction={() => setCreating(true)}
            />
          </Card>
        ) : (
          <Card flush>
            <DataTable columns={columns} rows={centres.data ?? []} rowKey={(c) => c.id} onRowClick={(c) => setEditing(c)} />
            <TableNote>
              A cost centre keeps no separate book. Every transaction it tags still belongs to this company —
              which is exactly why splitting an operating unit into its own company instead would create
              statutory books and inter-company trade to eliminate.
            </TableNote>
          </Card>
        )
      )}

      {view === 'Performance' && (
        <>
          <div style={{ display: 'flex', gap: 8, alignItems: 'flex-end', marginBottom: 14, flexWrap: 'wrap' }}>
            <Field label="From"><input className="input" type="date" value={from} onChange={(e) => setFrom(e.target.value)} /></Field>
            <Field label="To"><input className="input" type="date" value={to} onChange={(e) => setTo(e.target.value)} /></Field>
          </div>
          {performance.isLoading ? <Skeleton rows={3} /> : (
            <>
              {(performance.data?.untaggedExpenseInr ?? 0) > 0 && (
                <div style={{ marginBottom: 14 }}>
                  <StatCard
                    label="Expense with no cost centre"
                    value={money(performance.data!.untaggedExpenseInr)}
                    hint="Not attributed to any centre — the figures below do not include it"
                    tone="renewal"
                  />
                </div>
              )}
              <Card flush>
                <DataTable
                  columns={[
                    { key: 'code', header: 'Centre', sortable: true, render: (r: PerfRow) => <span style={{ fontWeight: 600 }}>{r.code} · {r.name}</span> },
                    { key: 'kind', header: 'Kind', sortable: true, render: (r: PerfRow) => KIND_LABELS[r.kind] || humanise(r.kind) },
                    { key: 'revenueInr', header: 'Revenue', align: 'right', sortable: true, render: (r: PerfRow) => money(r.revenueInr) },
                    { key: 'expenseInr', header: 'Cost', align: 'right', sortable: true, render: (r: PerfRow) => money(r.expenseInr) },
                    { key: 'profitInr', header: 'Profit', align: 'right', sortable: true, render: (r: PerfRow) => money(r.profitInr) },
                  ] as DataTableColumn<PerfRow>[]}
                  rows={performance.data?.rows ?? []}
                  rowKey={(r) => r.id}
                  empty="Nothing was tagged to a cost centre in this period."
                />
                <TableNote>
                  Read straight from the ledger lines tagged with each centre — nothing here is stored, so it
                  cannot drift from the transactions that produced it.
                </TableNote>
              </Card>
            </>
          )}
        </>
      )}

      {view === 'Allocation' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          <Card>
            <SectionTitle
              sub="An allocation moves cost between centres inside one expense account. The company's profit does not change by a rupee — only which centre carries it."
              action={<button className="btn-primary" onClick={() => setRunOpen(true)}>Run an allocation</button>}
            >
              Shared cost
            </SectionTitle>
            {(rules.data ?? []).length === 0 ? (
              <EmptyState
                icon={Split}
                title="No allocation rules yet"
                body="A rule says how a shared cost is split — e.g. 50% Property Care, 25% Project Consulting, and so on. Define one before spreading corporate overhead."
                actionLabel="Define a rule"
                onAction={() => setRulesOpen(true)}
                compact
              />
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                {(rules.data ?? []).map((r) => (
                  <div key={r.id} style={{ display: 'flex', gap: 12, alignItems: 'baseline', flexWrap: 'wrap' }}>
                    <span style={{ fontWeight: 600 }}>{r.name}</span>
                    <span className="ds-caption">{r.basis === 'EQUAL' ? 'Split evenly' : 'Fixed shares'}</span>
                    <span className="ds-caption">
                      {r.targets.map((t) => `${t.costCenter.code} ${pct(t.shareBps)}`).join(' · ')}
                    </span>
                    {!r.isActive && <Badge tone="neutral">Inactive</Badge>}
                  </div>
                ))}
              </div>
            )}
          </Card>

          {allocations.isLoading ? <Skeleton rows={3} /> : (
            <Card flush>
              <DataTable
                columns={[
                  { key: 'reference', header: 'Reference', sortable: true, render: (a: Allocation) => <span style={{ fontWeight: 600 }}>{a.reference}</span> },
                  { key: 'rule', header: 'Rule', render: (a: Allocation) => a.rule.name },
                  { key: 'accountCode', header: 'Account', render: (a: Allocation) => a.accountCode },
                  { key: 'period', header: 'Period', render: (a: Allocation) => `${fmtDate(a.periodFrom)} → ${fmtDate(a.periodTo)}` },
                  { key: 'amountInr', header: 'Amount', align: 'right', sortable: true, render: (a: Allocation) => money(a.amountInr) },
                  { key: 'split', header: 'Split', render: (a: Allocation) => (
                    <span className="ds-caption">
                      {a.entries.map((e) => `${e.costCenter.code} ${money(e.amountInr)}`).join(' · ')}
                    </span>
                  ) },
                  { key: 'status', header: '', render: (a: Allocation) => (
                    a.status === 'REVERSED'
                      ? <Badge tone="neutral">Reversed</Badge>
                      : <button className="btn-secondary" onClick={() => reverse.mutate(a.id)}>Reverse</button>
                  ) },
                ] as DataTableColumn<Allocation>[]}
                rows={allocations.data ?? []}
                rowKey={(a) => a.id}
                empty="No shared cost has been allocated yet."
              />
              <TableNote>
                Reversing posts the mirror entry; the original stays on the record. Corrections never
                overwrite history here, for the same reason they do not in the commission ledger.
              </TableNote>
            </Card>
          )}
        </div>
      )}

      <CentreModal
        open={creating || !!editing}
        centre={editing}
        centres={centres.data ?? []}
        busy={save.isPending}
        onClose={() => { setCreating(false); setEditing(null); }}
        onSubmit={(v) => save.mutate(v)}
      />
      <RulesModal open={rulesOpen} onClose={() => setRulesOpen(false)} centres={centres.data ?? []} onSaved={invalidate} />
      <RunModal open={runOpen} onClose={() => setRunOpen(false)} rules={rules.data ?? []} centres={centres.data ?? []} onSaved={invalidate} />
    </div>
  );
}

function CentreModal({ open, centre, centres, busy, onClose, onSubmit }: {
  open: boolean; centre: Centre | null; centres: Centre[]; busy: boolean;
  onClose: () => void; onSubmit: (v: any) => void;
}) {
  const blank = { code: '', name: '', description: '', kind: 'OTHER', parentId: '', isActive: true, effectiveFrom: '', effectiveTo: '' };
  const [form, setForm] = useState<any>(blank);
  React.useEffect(() => {
    setForm(centre
      ? {
        code: centre.code, name: centre.name, description: centre.description ?? '', kind: centre.kind,
        parentId: centre.parentId ?? '', isActive: centre.isActive,
        effectiveFrom: centre.effectiveFrom ? centre.effectiveFrom.slice(0, 10) : '',
        effectiveTo: centre.effectiveTo ? centre.effectiveTo.slice(0, 10) : '',
      }
      : blank);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [centre, open]);

  const submit = () => onSubmit({
    code: form.code.trim(), name: form.name.trim(),
    description: form.description || undefined,
    kind: form.kind,
    parentId: form.parentId || undefined,
    isActive: form.isActive,
    effectiveFrom: form.effectiveFrom || undefined,
    effectiveTo: form.effectiveTo || undefined,
  });

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={centre ? `${centre.code} · ${centre.name}` : 'New cost centre'}
      width={720}
      footer={(
        <>
          <button className="btn-secondary" onClick={onClose}>Cancel</button>
          <button className="btn-primary" disabled={busy || !form.code.trim() || form.name.trim().length < 2} onClick={submit}>
            {busy ? 'Saving…' : centre ? 'Save changes' : 'Create'}
          </button>
        </>
      )}
    >
      <FormSection title="Identity">
        <Field label="Code" required hint="Short and stable — it appears on every report.">
          <input className="input" value={form.code} onChange={(e) => setForm({ ...form, code: e.target.value.toUpperCase() })} placeholder="CC-KC01" />
        </Field>
        <Field label="Name" required>
          <input className="input" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="Kochi Central Office" />
        </Field>
        <Field label="Kind">
          <select className="input" value={form.kind} onChange={(e) => setForm({ ...form, kind: e.target.value })}>
            {KINDS.map((k) => <option key={k} value={k}>{KIND_LABELS[k] || humanise(k)}</option>)}
          </select>
        </Field>
        <Field label="Sits under" hint="Leave empty for a top-level centre.">
          <select className="input" value={form.parentId} onChange={(e) => setForm({ ...form, parentId: e.target.value })}>
            <option value="">—</option>
            {centres.filter((c) => c.id !== centre?.id).map((c) => <option key={c.id} value={c.id}>{c.code} · {c.name}</option>)}
          </select>
        </Field>
        <Field label="Description" span={2}>
          <input className="input" value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} />
        </Field>
      </FormSection>
      <FormSection title="When it is open">
        <Field label="From" hint="A posting dated before this is refused.">
          <input className="input" type="date" value={form.effectiveFrom} onChange={(e) => setForm({ ...form, effectiveFrom: e.target.value })} />
        </Field>
        <Field label="To" hint="Leave empty while it is still running.">
          <input className="input" type="date" value={form.effectiveTo} onChange={(e) => setForm({ ...form, effectiveTo: e.target.value })} />
        </Field>
        <Field label="Active">
          <select className="input" value={form.isActive ? 'yes' : 'no'} onChange={(e) => setForm({ ...form, isActive: e.target.value === 'yes' })}>
            <option value="yes">Active</option>
            <option value="no">Inactive</option>
          </select>
        </Field>
      </FormSection>
    </Modal>
  );
}

function RulesModal({ open, onClose, centres, onSaved }: {
  open: boolean; onClose: () => void; centres: Centre[]; onSaved: () => void;
}) {
  const [name, setName] = useState('');
  const [basis, setBasis] = useState('PERCENT');
  const [rows, setRows] = useState<{ costCenterId: string; sharePct: string }[]>([{ costCenterId: '', sharePct: '' }]);

  const totalBps = useMemo(
    () => rows.reduce((s, r) => s + Math.round((Number(r.sharePct) || 0) * 100), 0),
    [rows],
  );
  const complete = basis === 'EQUAL' || totalBps === 10000;

  const create = useMutation({
    mutationFn: async () => (await api.post('/core/allocation-rules', {
      name: name.trim(),
      basis,
      targets: rows.filter((r) => r.costCenterId).map((r) => ({
        costCenterId: r.costCenterId,
        shareBps: Math.round((Number(r.sharePct) || 0) * 100),
      })),
    })).data,
    onSuccess: () => { toast.success('Allocation rule saved'); setName(''); setRows([{ costCenterId: '', sharePct: '' }]); onSaved(); onClose(); },
    onError: (e: any) => toast.error(e?.response?.data?.message ?? 'Could not save the rule'),
  });

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Allocation rule"
      subtitle="How a shared cost is split. Fixed shares must total 100% — an allocation distributes the whole cost, and a remainder would silently disappear."
      width={780}
      footer={(
        <>
          <button className="btn-secondary" onClick={onClose}>Close</button>
          <button className="btn-primary" disabled={create.isPending || name.trim().length < 2 || !complete} onClick={() => create.mutate()}>
            {create.isPending ? 'Saving…' : 'Save rule'}
          </button>
        </>
      )}
    >
      <FormSection title="Rule">
        <Field label="Name" required>
          <input className="input" value={name} onChange={(e) => setName(e.target.value)} placeholder="Corporate overhead 2026" />
        </Field>
        <Field label="Basis">
          <select className="input" value={basis} onChange={(e) => setBasis(e.target.value)}>
            <option value="PERCENT">Fixed shares</option>
            <option value="EQUAL">Split evenly</option>
          </select>
        </Field>
      </FormSection>
      <FormSection title="Targets">
        <div style={{ gridColumn: '1 / -1', display: 'flex', flexDirection: 'column', gap: 8 }}>
          {rows.map((r, i) => (
            <div key={i} style={{ display: 'flex', gap: 8 }}>
              <select
                className="input"
                style={{ flex: 1 }}
                value={r.costCenterId}
                onChange={(e) => setRows(rows.map((x, j) => (j === i ? { ...x, costCenterId: e.target.value } : x)))}
              >
                <option value="">Choose a cost centre…</option>
                {centres.map((c) => <option key={c.id} value={c.id}>{c.code} · {c.name}</option>)}
              </select>
              {basis === 'PERCENT' && (
                <input
                  className="input"
                  style={{ width: 110 }}
                  type="number"
                  min={0}
                  max={100}
                  step="0.01"
                  placeholder="%"
                  value={r.sharePct}
                  onChange={(e) => setRows(rows.map((x, j) => (j === i ? { ...x, sharePct: e.target.value } : x)))}
                />
              )}
              <button className="btn-secondary" onClick={() => setRows(rows.filter((_, j) => j !== i))} disabled={rows.length === 1}>−</button>
            </div>
          ))}
          <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
            <button className="btn-secondary" onClick={() => setRows([...rows, { costCenterId: '', sharePct: '' }])}>Add a target</button>
            {basis === 'PERCENT' && (
              <span className="ds-caption" style={{ color: complete ? 'var(--tone-active)' : 'var(--tone-expired)' }}>
                {pct(totalBps)} of 100%
              </span>
            )}
          </div>
        </div>
      </FormSection>
    </Modal>
  );
}

function RunModal({ open, onClose, rules, centres, onSaved }: {
  open: boolean; onClose: () => void; rules: Rule[]; centres: Centre[]; onSaved: () => void;
}) {
  const [ruleId, setRuleId] = useState('');
  const [sourceCostCenterId, setSource] = useState('');
  const [accountCode, setAccountCode] = useState('5900');
  const [periodFrom, setFrom] = useState(monthStart());
  const [periodTo, setTo] = useState(toDateInput());
  const [amountInr, setAmount] = useState('');

  const rule = rules.find((r) => r.id === ruleId);
  // The preview is computed the same way the server will: floor each share,
  // then hand the remainder to the largest. Showing a different arithmetic here
  // would be worse than showing none.
  const preview = useMemo(() => {
    const amount = Number(amountInr);
    if (!rule || !amount || amount <= 0) return [];
    const total = rule.targets.reduce((s, t) => s + t.shareBps, 0) || 1;
    const slices = rule.targets.map((t) => ({
      code: t.costCenter.code,
      name: t.costCenter.name,
      shareBps: t.shareBps,
      amountInr: Math.floor((amount * t.shareBps) / total),
    }));
    let rem = amount - slices.reduce((s, x) => s + x.amountInr, 0);
    const order = [...slices].sort((a, b) => b.shareBps - a.shareBps);
    for (let i = 0; rem > 0; i = (i + 1) % order.length) { order[i].amountInr += 1; rem -= 1; }
    return slices;
  }, [rule, amountInr]);

  const run = useMutation({
    mutationFn: async () => (await api.post('/core/allocations', {
      ruleId, sourceCostCenterId, accountCode, periodFrom, periodTo,
      amountInr: amountInr ? Number(amountInr) : undefined,
    })).data,
    onSuccess: () => { toast.success('Allocation posted'); onSaved(); onClose(); },
    onError: (e: any) => toast.error(e?.response?.data?.message ?? 'Could not allocate'),
  });

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Allocate shared cost"
      subtitle="Posted as a reallocation inside one expense account: the target centres are debited and the source credited, so the company's profit is unchanged."
      width={720}
      footer={(
        <>
          <button className="btn-secondary" onClick={onClose}>Cancel</button>
          <button className="btn-primary" disabled={run.isPending || !ruleId || !sourceCostCenterId || !accountCode} onClick={() => run.mutate()}>
            {run.isPending ? 'Posting…' : 'Post allocation'}
          </button>
        </>
      )}
    >
      <FormSection title="What to spread">
        <Field label="Rule" required>
          <select className="input" value={ruleId} onChange={(e) => setRuleId(e.target.value)}>
            <option value="">Choose…</option>
            {rules.filter((r) => r.isActive).map((r) => <option key={r.id} value={r.id}>{r.name}</option>)}
          </select>
        </Field>
        <Field label="From which centre" required hint="Usually Corporate — the centre currently carrying the cost.">
          <select className="input" value={sourceCostCenterId} onChange={(e) => setSource(e.target.value)}>
            <option value="">Choose…</option>
            {centres.map((c) => <option key={c.id} value={c.id}>{c.code} · {c.name}</option>)}
          </select>
        </Field>
        <Field label="Expense account" required hint="The allocation stays inside this account; only the centre changes.">
          <input className="input" value={accountCode} onChange={(e) => setAccountCode(e.target.value)} placeholder="5900" />
        </Field>
        <Field label="Amount" hint="Leave empty to spread everything the source centre carries in the period.">
          <input className="input" type="number" min={0} value={amountInr} onChange={(e) => setAmount(e.target.value)} placeholder="100000" />
        </Field>
        <Field label="Period from" required>
          <input className="input" type="date" value={periodFrom} onChange={(e) => setFrom(e.target.value)} />
        </Field>
        <Field label="Period to" required>
          <input className="input" type="date" value={periodTo} onChange={(e) => setTo(e.target.value)} />
        </Field>
      </FormSection>

      {preview.length > 0 && (
        <FormSection title="How it will land">
          <div style={{ gridColumn: '1 / -1', display: 'flex', flexDirection: 'column', gap: 6 }}>
            {preview.map((p) => (
              <div key={p.code} style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span>{p.code} · {p.name} <span className="ds-caption">{pct(p.shareBps)}</span></span>
                <span style={{ fontVariantNumeric: 'tabular-nums' }}>{money(p.amountInr)}</span>
              </div>
            ))}
            <div style={{ display: 'flex', justifyContent: 'space-between', fontWeight: 600, borderTop: '1px solid var(--hairline-soft)', paddingTop: 6 }}>
              <span>Total</span>
              <span style={{ fontVariantNumeric: 'tabular-nums' }}>{money(preview.reduce((s, p) => s + p.amountInr, 0))}</span>
            </div>
            <p className="ds-caption">
              Rounding leaves at most a rupee per target; it goes to the largest share so the parts add
              back to the whole exactly.
            </p>
          </div>
        </FormSection>
      )}
    </Modal>
  );
}

export const CostCentreIcon = GitBranch;
