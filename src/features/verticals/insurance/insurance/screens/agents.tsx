'use client';

/**
 * Agents — the external introducers, and what the book owes them.
 *
 * An AGENT is not an executive. The executive is internal staff paid out of the
 * insurer's brokerage; an agent is an outside introducer paid their own
 * percentage of the premium. Both can sit on the same policy, and every label on
 * this screen keeps them apart on purpose — confusing the two is the single most
 * likely way this feature gets misread.
 *
 * The percentage here is a DEFAULT. Selecting an agent on a quote copies it onto
 * that quote line, issue freezes it onto the policy, and editing the default
 * afterwards changes only what the next quote copies. Nothing already written
 * moves.
 *
 *   GET   /insurance/agents                        (key ins-agents)
 *   POST  /insurance/agents
 *   GET   /insurance/agents/:id                    (key ins-agent, id)
 *   PATCH /insurance/agents/:id
 *   GET   /insurance/agents/:id/statement?from=&to=&otherDeductionsInr=
 *   POST  /insurance/agents/:id/settlements
 *   POST  /insurance/settlements/:id/pay
 */

import { useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import {
  BadgeCheck, Banknote, FileText, Plus, Search, UserRoundCheck, Users,
} from 'lucide-react';
import { api, apiErrorMessage } from '@/lib/api';
import { fmtOrgMoney, orgLocale } from '@/lib/org-locale';
import {
  Badge, Card, DataTable, Drawer, EmptyState, Field, FormSection, Skeleton,
  StatCard, Toolbar, Segmented, humanStatus, type Tone,
} from '../ui/kit';

// ============================================================ types

interface AgentRow {
  id: string;
  code: string;
  name: string;
  agency?: string | null;
  phone?: string | null;
  email?: string | null;
  panNumber?: string | null;
  defaultCommissionPct: number;
  status: string;
  notes?: string | null;
  policyCount: number;
  activePolicyCount: number;
  totalCommissionInr: number;
  payableInr: number;
  statementInr: number;
  paidInr: number;
}

/**
 * What the agent brought in, from /insurance/agent-business. Merged onto the row
 * rather than looked up at render, so the table's own sorting works on it.
 *
 * Net profit is the API's figure, not ours: it is payout minus BOTH the agent's
 * commission and the executive's, and it comes out of the payout — never the
 * premium, which is the insurer's money passing through.
 */
interface Business {
  policies: number;
  premiumInr: number;
  payoutInr: number;
  agentCommissionInr: number;
  execCommissionInr: number;
  companyProfitInr: number;
}

const NO_BUSINESS: Business = {
  policies: 0, premiumInr: 0, payoutInr: 0,
  agentCommissionInr: 0, execCommissionInr: 0, companyProfitInr: 0,
};

interface AgentPolicy {
  id: string;
  policyNo: string;
  clientName?: string | null;
  companyName: string;
  productName: string;
  premiumInr: number;
  startDate: string;
  status: string;
  agentCommissionPct?: number | null;
  agentCommissionInr?: number | null;
  agentCommissionStatus: string;
}

interface Settlement {
  id: string;
  reference: string;
  periodFrom: string;
  periodTo: string;
  grossInr: number;
  tdsInr: number;
  otherDeductionsInr: number;
  netInr: number;
  status: string;
  paidAt?: string | null;
  paidRef?: string | null;
}

interface AgentDetail extends Omit<AgentRow, 'policyCount' | 'activePolicyCount' | 'totalCommissionInr' | 'payableInr' | 'statementInr' | 'paidInr'> {
  policies: AgentPolicy[];
  settlements: Settlement[];
  totals: {
    policyCount: number;
    activePolicyCount: number;
    totalCommissionInr: number;
    payableInr: number;
    statementInr: number;
    paidInr: number;
  };
}

interface StatementLine {
  policyId: string;
  policyNo: string;
  clientName?: string | null;
  companyName: string;
  productName: string;
  startDate: string;
  premiumInr: number;
  commissionPct: number;
  commissionInr: number;
}

interface Statement {
  periodFrom: string;
  periodTo: string;
  lines: StatementLine[];
  totals: { grossInr: number; tdsInr: number; otherDeductionsInr: number; netInr: number };
  tds: { ratePct: number; section: string; panOnFile: boolean; note?: string | null };
}

const money = (n?: number | null) => fmtOrgMoney(n);
const pct = (n?: number | null) => (n == null ? '—' : `${Number(n)}%`);

function fmtDate(d?: string | Date | null) {
  if (!d) return '—';
  return new Date(d).toLocaleDateString(orgLocale().locale || undefined, {
    day: '2-digit', month: 'short', year: 'numeric',
  });
}

const agentTone = (status: string): Tone => (status === 'ACTIVE' ? 'active' : 'neutral');

/** The commission's own lifecycle, distinct from the policy's. */
function commissionTone(status?: string, policyStatus?: string): Tone {
  // Reversed is not money waiting to be paid, so it must not wear the payable tone.
  if (policyStatus === 'CANCELLED') return 'neutral';
  switch (status) {
    case 'PAID': return 'active';
    case 'STATEMENT': return 'renewal';
    case 'LOCKED': return 'info';
    default: return 'neutral';
  }
}

/**
 * The POLICY status has to be read alongside the commission status.
 *
 * A cancelled policy keeps agentCommissionStatus = 'LOCKED', because cancelling
 * reverses the money through an adjustment rather than moving the flag. The
 * payable total already excludes cancelled policies — see the `status !==
 * 'CANCELLED'` guard in insurance.service — so the arithmetic was never wrong.
 * The LABEL was: it read "Locked — payable" over cover that no longer exists,
 * telling the reader money was owed when none was.
 */
function commissionLabel(status?: string, policyStatus?: string) {
  if (policyStatus === 'CANCELLED' && (status === 'LOCKED' || status === 'STATEMENT')) {
    return 'Reversed — cancelled';
  }
  switch (status) {
    case 'LOCKED': return 'Locked — payable';
    case 'STATEMENT': return 'On statement';
    case 'PAID': return 'Paid';
    default: return 'No agent';
  }
}

const isoToday = () => new Date().toISOString().slice(0, 10);
const isoMonthsAgo = (n: number) => {
  const d = new Date();
  d.setMonth(d.getMonth() - n);
  return d.toISOString().slice(0, 10);
};

// ============================================================ small pieces

function MetaRow({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="ds-list-row">
      <span className="ds-caption">{label}</span>
      <span className="ds-list-row-meta" style={{ fontWeight: 560, color: 'var(--ink)' }}>{value}</span>
    </div>
  );
}

/**
 * A note that has to be read, not decorated away — used for the missing-PAN
 * warning, where the deduction on screen is knowingly understated.
 */
function Notice({ tone = 'renewal', children }: { tone?: Tone; children: React.ReactNode }) {
  return (
    <div
      className="ds-inset"
      style={{
        padding: 'var(--s-3)',
        background: `var(--tone-${tone}-bg)`,
        border: `1px solid var(--tone-${tone}-line)`,
      }}
    >
      <div className="ds-small" style={{ color: 'var(--ink)' }}>{children}</div>
    </div>
  );
}

// ============================================================ agent form (add / edit)

interface AgentForm {
  name: string; agency: string; phone: string; email: string;
  panNumber: string; defaultCommissionPct: string; notes: string; status: string;
}

const emptyForm: AgentForm = {
  name: '', agency: '', phone: '', email: '',
  panNumber: '', defaultCommissionPct: '10', notes: '', status: 'ACTIVE',
};

function AgentFields({ value, onChange, editing }: { value: AgentForm; onChange: (v: AgentForm) => void; editing: boolean }) {
  const set = (patch: Partial<AgentForm>) => onChange({ ...value, ...patch });
  return (
    <>
      <FormSection title="Agent" description="The external introducer, and the firm they represent.">
        <Field label="Name" required>
          <input className="input" value={value.name} onChange={(e) => set({ name: e.target.value })} placeholder="Ravi Menon" />
        </Field>
        <Field label="Agency">
          <input className="input" value={value.agency} onChange={(e) => set({ agency: e.target.value })} placeholder="Menon Associates" />
        </Field>
        <Field label="Phone">
          <input className="input" value={value.phone} onChange={(e) => set({ phone: e.target.value })} />
        </Field>
        <Field label="Email">
          <input className="input" value={value.email} onChange={(e) => set({ email: e.target.value })} />
        </Field>
      </FormSection>

      <FormSection
        title="Agent commission"
        description="The introducer's own cut of the premium — separate from the insurer's brokerage, and never shown to the customer."
      >
        <Field
          label="Default agent commission %"
          hint="A default only. It is copied onto each quote line when this agent is selected; changing it later never re-prices a policy already issued."
        >
          <input
            className="input" inputMode="decimal"
            value={value.defaultCommissionPct}
            onChange={(e) => set({ defaultCommissionPct: e.target.value })}
          />
        </Field>
        <Field label="PAN" hint="Needed to deduct TDS at the standard rate on their payout.">
          <input
            className="input" value={value.panNumber}
            onChange={(e) => set({ panNumber: e.target.value.toUpperCase() })}
            placeholder="ABCDE1234F"
          />
        </Field>
        {editing && (
          <Field label="Status" hint="An inactive agent cannot be placed on new business.">
            <select className="input" value={value.status} onChange={(e) => set({ status: e.target.value })}>
              <option value="ACTIVE">Active</option>
              <option value="INACTIVE">Inactive</option>
            </select>
          </Field>
        )}
        <Field label="Notes" span={2}>
          <input className="input" value={value.notes} onChange={(e) => set({ notes: e.target.value })} />
        </Field>
      </FormSection>
    </>
  );
}

// ============================================================ statement tab

function StatementPanel({ agentId, onSettled }: { agentId: string; onSettled: () => void }) {
  const qc = useQueryClient();
  const [from, setFrom] = useState(() => isoMonthsAgo(3));
  const [to, setTo] = useState(isoToday);
  const [other, setOther] = useState('0');

  const otherNum = Math.max(0, Number(other) || 0);
  const { data, isLoading, isError, error } = useQuery({
    queryKey: ['ins-agent-statement', agentId, from, to, otherNum],
    queryFn: async () =>
      (await api.get<Statement>(
        `/insurance/agents/${agentId}/statement?from=${from}&to=${to}&otherDeductionsInr=${otherNum}`,
      )).data,
    enabled: !!from && !!to,
  });

  const create = useMutation({
    mutationFn: () =>
      api.post(`/insurance/agents/${agentId}/settlements`, {
        periodFrom: from, periodTo: to, otherDeductionsInr: otherNum,
      }),
    onSuccess: (r: any) => {
      toast.success(`Statement ${r.data.reference} created — ${r.data.lines.length} policies locked to it`);
      qc.invalidateQueries({ queryKey: ['ins-agents'] });
      qc.invalidateQueries({ queryKey: ['ins-agent', agentId] });
      qc.invalidateQueries({ queryKey: ['ins-agent-statement', agentId] });
      onSettled();
    },
    onError: (e) => toast.error(apiErrorMessage(e)),
  });

  return (
    <div className="ds-stack">
      <Card>
        <h3 className="ds-h3">Period</h3>
        <div
          className="ds-grid"
          style={{ gridTemplateColumns: 'repeat(auto-fit,minmax(150px,1fr))', gap: 'var(--s-3)', marginTop: 'var(--s-3)' }}
        >
          <div>
            <label className="label" htmlFor="ins-stmt-from">From</label>
            <input id="ins-stmt-from" type="date" className="input" value={from} onChange={(e) => setFrom(e.target.value)} />
          </div>
          <div>
            <label className="label" htmlFor="ins-stmt-to">To</label>
            <input id="ins-stmt-to" type="date" className="input" value={to} onChange={(e) => setTo(e.target.value)} />
          </div>
          <div>
            <label className="label" htmlFor="ins-stmt-other">Other deductions</label>
            <input id="ins-stmt-other" className="input" inputMode="numeric" value={other} onChange={(e) => setOther(e.target.value)} />
          </div>
        </div>
        <div className="ds-caption" style={{ marginTop: 'var(--s-3)' }}>
          Policies are picked up by their cover start date, once the commission is locked at issue and
          not already carried by another statement. Cancelled policies are excluded.
        </div>
      </Card>

      {isLoading ? (
        <Skeleton rows={3} height={54} />
      ) : isError ? (
        <Card><div className="ds-body">{apiErrorMessage(error)}</div></Card>
      ) : !data ? null : (
        <>
          {data.tds.note && <Notice tone="expired">{data.tds.note}</Notice>}

          <Card flush>
            <DataTable
              rows={data.lines}
              rowKey={(l) => l.policyId}
              dense
              empty="Nothing payable in this period."
              columns={[
                { key: 'policyNo', header: 'Policy', render: (l) => <span className="ds-num">{l.policyNo}</span> },
                { key: 'clientName', header: 'Client', render: (l) => l.clientName ?? '—' },
                { key: 'premiumInr', header: 'Premium', align: 'right', render: (l) => money(l.premiumInr) },
                { key: 'commissionPct', header: 'Agent %', align: 'right', render: (l) => pct(l.commissionPct) },
                {
                  key: 'commissionInr', header: 'Agent commission', align: 'right',
                  render: (l) => <span style={{ fontWeight: 650 }}>{money(l.commissionInr)}</span>,
                },
              ]}
            />
          </Card>

          <Card>
            <h3 className="ds-h3">Payable</h3>
            <div style={{ marginTop: 'var(--s-2)' }}>
              <MetaRow label="Gross agent commission" value={money(data.totals.grossInr)} />
              <MetaRow label={`TDS §${data.tds.section} (${data.tds.ratePct}%)`} value={`− ${money(data.totals.tdsInr)}`} />
              <MetaRow label="Other deductions" value={`− ${money(data.totals.otherDeductionsInr)}`} />
              <MetaRow
                label="Net payable"
                value={<span className="ds-h3" style={{ fontWeight: 700 }}>{money(data.totals.netInr)}</span>}
              />
            </div>
            <button
              className="btn-primary btn-sm"
              style={{ marginTop: 'var(--s-4)' }}
              disabled={!data.lines.length || create.isPending}
              onClick={() => create.mutate()}
            >
              <FileText size={13} /> {create.isPending ? 'Creating…' : 'Create settlement statement'}
            </button>
            <div className="ds-caption" style={{ marginTop: 'var(--s-2)' }}>
              Creating the statement locks these policies to it, so the same commission cannot appear on a second payout.
            </div>
          </Card>
        </>
      )}
    </div>
  );
}

// ============================================================ settlements tab

function SettlementsPanel({ agent, onChanged }: { agent: AgentDetail; onChanged: () => void }) {
  const qc = useQueryClient();
  const [paying, setPaying] = useState<string | null>(null);
  const [paidRef, setPaidRef] = useState('');

  const pay = useMutation({
    mutationFn: (id: string) => api.post(`/insurance/settlements/${id}/pay`, { paidRef: paidRef.trim() }),
    onSuccess: (r: any) => {
      toast.success(`${r.data.reference} paid — ${money(r.data.netInr)} released`);
      setPaying(null);
      setPaidRef('');
      qc.invalidateQueries({ queryKey: ['ins-agents'] });
      qc.invalidateQueries({ queryKey: ['ins-agent', agent.id] });
      onChanged();
    },
    onError: (e) => toast.error(apiErrorMessage(e)),
  });

  if (!agent.settlements.length) {
    return (
      <Card>
        <EmptyState
          compact
          icon={Banknote}
          title="No settlements yet"
          body="Generate a statement for a period, then pay it. The payout clears the agent commission payable and books the TDS."
        />
      </Card>
    );
  }

  return (
    <div className="ds-stack">
      {agent.settlements.map((s) => (
        <Card key={s.id}>
          <div className="ds-row" style={{ alignItems: 'flex-start' }}>
            <div style={{ minWidth: 0, flex: 1 }}>
              <div className="ds-h3 ds-num">{s.reference}</div>
              <div className="ds-caption" style={{ marginTop: 'var(--s-1)' }}>
                {fmtDate(s.periodFrom)} → {fmtDate(s.periodTo)}
              </div>
            </div>
            <Badge tone={s.status === 'PAID' ? 'active' : 'renewal'}>{humanStatus(s.status)}</Badge>
          </div>

          <hr className="ds-divider" style={{ margin: 'var(--s-3) 0' }} />

          <MetaRow label="Gross agent commission" value={money(s.grossInr)} />
          <MetaRow label="TDS" value={`− ${money(s.tdsInr)}`} />
          <MetaRow label="Other deductions" value={`− ${money(s.otherDeductionsInr)}`} />
          <MetaRow label="Net payable" value={<span style={{ fontWeight: 700 }}>{money(s.netInr)}</span>} />
          {s.paidAt && <MetaRow label="Paid" value={`${fmtDate(s.paidAt)}${s.paidRef ? ` · ${s.paidRef}` : ''}`} />}

          {s.status !== 'PAID' && (
            <div style={{ marginTop: 'var(--s-3)' }}>
              {paying === s.id ? (
                <div style={{ display: 'flex', gap: 'var(--s-2)', flexWrap: 'wrap', alignItems: 'flex-end' }}>
                  <div style={{ flex: 1, minWidth: 180 }}>
                    <label className="label" htmlFor={`paidref-${s.id}`}>Payment reference</label>
                    <input
                      id={`paidref-${s.id}`} className="input" value={paidRef}
                      onChange={(e) => setPaidRef(e.target.value)} placeholder="NEFT / cheque no."
                    />
                  </div>
                  <button
                    className="btn-primary btn-sm"
                    disabled={!paidRef.trim() || pay.isPending}
                    onClick={() => pay.mutate(s.id)}
                  >
                    {pay.isPending ? 'Posting…' : 'Confirm payment'}
                  </button>
                  <button className="btn-ghost btn-sm" onClick={() => { setPaying(null); setPaidRef(''); }}>Cancel</button>
                </div>
              ) : (
                <button className="btn-secondary btn-sm" onClick={() => { setPaying(s.id); setPaidRef(''); }}>
                  <Banknote size={13} /> Mark paid
                </button>
              )}
            </div>
          )}
        </Card>
      ))}
    </div>
  );
}

// ============================================================ agent detail drawer

function AgentDrawer({ agentId, onClose }: { agentId: string; onClose: () => void }) {
  const qc = useQueryClient();
  const [tab, setTab] = useState('Overview');
  const [editing, setEditing] = useState(false);
  const [form, setForm] = useState<AgentForm>(emptyForm);

  const { data: agent, isLoading } = useQuery({
    queryKey: ['ins-agent', agentId],
    queryFn: async () => (await api.get<AgentDetail>(`/insurance/agents/${agentId}`)).data,
  });

  const save = useMutation({
    mutationFn: () =>
      api.patch(`/insurance/agents/${agentId}`, {
        name: form.name,
        agency: form.agency,
        phone: form.phone,
        email: form.email,
        panNumber: form.panNumber,
        notes: form.notes,
        status: form.status,
        defaultCommissionPct: Number(form.defaultCommissionPct),
      }),
    onSuccess: () => {
      toast.success('Agent updated — policies already issued keep their own percentage');
      setEditing(false);
      qc.invalidateQueries({ queryKey: ['ins-agents'] });
      qc.invalidateQueries({ queryKey: ['ins-agent', agentId] });
    },
    onError: (e) => toast.error(apiErrorMessage(e)),
  });

  const startEdit = () => {
    if (!agent) return;
    setForm({
      name: agent.name,
      agency: agent.agency ?? '',
      phone: agent.phone ?? '',
      email: agent.email ?? '',
      panNumber: agent.panNumber ?? '',
      defaultCommissionPct: String(agent.defaultCommissionPct),
      notes: agent.notes ?? '',
      status: agent.status,
    });
    setEditing(true);
  };

  const refetchAgent = () => { qc.invalidateQueries({ queryKey: ['ins-agent', agentId] }); };

  return (
    <Drawer
      open
      onClose={onClose}
      width={720}
      title={agent?.name ?? 'Agent'}
      subtitle={agent ? `${agent.code}${agent.agency ? ` · ${agent.agency}` : ''}` : undefined}
      tabs={['Overview', 'Policies', 'Statement', 'Settlements']}
      activeTab={tab}
      onTab={setTab}
      counts={{ Policies: agent?.policies.length, Settlements: agent?.settlements.length }}
    >
      {isLoading || !agent ? (
        <Skeleton rows={4} height={70} />
      ) : tab === 'Overview' ? (
        <div className="ds-stack">
          {editing ? (
            <Card>
              <AgentFields value={form} onChange={setForm} editing />
              <div className="ds-row">
                <button className="btn-primary btn-sm" disabled={!form.name.trim() || save.isPending} onClick={() => save.mutate()}>
                  {save.isPending ? 'Saving…' : 'Save agent'}
                </button>
                <button className="btn-ghost btn-sm" onClick={() => setEditing(false)}>Cancel</button>
              </div>
            </Card>
          ) : (
            <>
              <div className="ds-grid" style={{ gridTemplateColumns: 'repeat(auto-fit,minmax(160px,1fr))', gap: 'var(--s-3)' }}>
                <StatCard label="Default agent commission" value={pct(agent.defaultCommissionPct)} tone="sales" icon={UserRoundCheck} />
                <StatCard label="Payable now" value={money(agent.totals.payableInr)} tone="renewal" icon={Banknote} />
                <StatCard label="Paid to date" value={money(agent.totals.paidInr)} tone="active" icon={BadgeCheck} />
              </div>

              <Card>
                <h3 className="ds-h3">Agent</h3>
                <div style={{ marginTop: 'var(--s-2)' }}>
                  <MetaRow label="Code" value={<span className="ds-num">{agent.code}</span>} />
                  <MetaRow label="Agency" value={agent.agency ?? '—'} />
                  <MetaRow label="Phone" value={agent.phone ?? '—'} />
                  <MetaRow label="Email" value={agent.email ?? '—'} />
                  <MetaRow label="PAN" value={agent.panNumber ?? '—'} />
                  <MetaRow label="Status" value={<Badge tone={agentTone(agent.status)}>{humanStatus(agent.status)}</Badge>} />
                  {agent.notes && <MetaRow label="Notes" value={agent.notes} />}
                </div>
                <button className="btn-secondary btn-sm" style={{ marginTop: 'var(--s-4)' }} onClick={startEdit}>
                  Edit agent
                </button>
              </Card>

              {!agent.panNumber && (
                <Notice>
                  No PAN on file. A payout still deducts TDS at the standard rate, but without a PAN the
                  statutory rate is higher — add it before settling.
                </Notice>
              )}

              <Card>
                <h3 className="ds-h3">Book introduced</h3>
                <div style={{ marginTop: 'var(--s-2)' }}>
                  <MetaRow label="Policies" value={agent.totals.policyCount} />
                  <MetaRow label="Active policies" value={agent.totals.activePolicyCount} />
                  <MetaRow label="Agent commission — total" value={money(agent.totals.totalCommissionInr)} />
                  <MetaRow label="On an open statement" value={money(agent.totals.statementInr)} />
                </div>
              </Card>
            </>
          )}
        </div>
      ) : tab === 'Policies' ? (
        <Card flush>
          <DataTable
            rows={agent.policies}
            rowKey={(p) => p.id}
            dense
            empty="This agent has not introduced any business yet."
            columns={[
              { key: 'policyNo', header: 'Policy', render: (p) => <span className="ds-num">{p.policyNo}</span>, sortable: true },
              { key: 'clientName', header: 'Client', render: (p) => p.clientName ?? '—', sortable: true },
              { key: 'premiumInr', header: 'Premium', align: 'right', render: (p) => money(p.premiumInr), sortable: true },
              { key: 'agentCommissionPct', header: 'Agent %', align: 'right', render: (p) => pct(p.agentCommissionPct), sortable: true },
              { key: 'agentCommissionInr', header: 'Agent commission', align: 'right', render: (p) => money(p.agentCommissionInr), sortable: true },
              {
                key: 'agentCommissionStatus', header: 'Payout',
                render: (p) => <Badge tone={commissionTone(p.agentCommissionStatus, p.status)}>{commissionLabel(p.agentCommissionStatus, p.status)}</Badge>,
              },
            ]}
          />
        </Card>
      ) : tab === 'Statement' ? (
        <StatementPanel agentId={agent.id} onSettled={() => { refetchAgent(); setTab('Settlements'); }} />
      ) : (
        <SettlementsPanel agent={agent} onChanged={refetchAgent} />
      )}
    </Drawer>
  );
}

// ============================================================ screen

const STATUS_FILTERS = ['All', 'Active', 'Inactive'] as const;
type StatusFilter = (typeof STATUS_FILTERS)[number];

export function InsuranceAgents() {
  const qc = useQueryClient();
  const [q, setQ] = useState('');
  const [filter, setFilter] = useState<StatusFilter>('All');
  const [addOpen, setAddOpen] = useState(false);
  const [openId, setOpenId] = useState<string | null>(null);
  const [form, setForm] = useState<AgentForm>(emptyForm);

  const { data, isLoading } = useQuery({
    queryKey: ['ins-agents'],
    queryFn: async () => (await api.get<AgentRow[]>('/insurance/agents')).data,
  });

  // The book each agent has written. A separate call because the master and the
  // business are separate concerns — an agent exists before they introduce
  // anything, and must still appear when they have.
  const bizQ = useQuery({
    queryKey: ['ins-agent-business'],
    queryFn: async () =>
      (await api.get<{ rows: { id: string; lifetime: Business }[] }>('/insurance/agent-business')).data,
  });

  const add = useMutation({
    mutationFn: () =>
      api.post('/insurance/agents', {
        name: form.name,
        agency: form.agency,
        phone: form.phone,
        email: form.email,
        panNumber: form.panNumber,
        notes: form.notes,
        defaultCommissionPct: Number(form.defaultCommissionPct),
      }),
    onSuccess: () => {
      toast.success('Agent added');
      setForm(emptyForm);
      setAddOpen(false);
      qc.invalidateQueries({ queryKey: ['ins-agents'] });
    },
    onError: (e) => toast.error(apiErrorMessage(e)),
  });

  // A failed business call and an agent with no business are NOT the same
  // thing, and on a screen about money the difference matters more than the
  // number. When the call fails the figures read "—" and say why; a real zero
  // stays a real zero.
  // isError alone is not "no data": React Query keeps the last good response
  // when a REFETCH fails, and dashing out figures we still hold would replace
  // good numbers with a false claim that they are missing. Only a failure with
  // nothing cached means the business data is genuinely unavailable.
  const bizFailed = bizQ.isError && !bizQ.data;
  const dash = <span className="ds-caption">—</span>;
  const fig = (v: number) => (bizFailed ? dash : <span className="ds-num">{money(v)}</span>);

  const business = useMemo(() => {
    const m = new Map<string, Business>();
    for (const r of bizQ.data?.rows ?? []) m.set(r.id, r.lifetime);
    return m;
  }, [bizQ.data]);

  // An agent with nothing attributed keeps zeroes rather than blanks: no
  // business yet is a fact management wants to see, not a missing row.
  const agents = useMemo(
    () => (data ?? []).map((a) => ({ ...a, ...(business.get(a.id) ?? NO_BUSINESS) })),
    [data, business],
  );

  const shown = useMemo(() => {
    const needle = q.trim().toLowerCase();
    return agents.filter((a) => {
      if (filter === 'Active' && a.status !== 'ACTIVE') return false;
      if (filter === 'Inactive' && a.status === 'ACTIVE') return false;
      if (!needle) return true;
      return [a.name, a.code, a.agency, a.phone, a.email]
        .filter(Boolean)
        .some((v) => String(v).toLowerCase().includes(needle));
    });
  }, [agents, filter, q]);

  const totals = useMemo(() => ({
    active: agents.filter((a) => a.status === 'ACTIVE').length,
    commission: agents.reduce((s, a) => s + a.totalCommissionInr, 0),
    payable: agents.reduce((s, a) => s + a.payableInr, 0),
    paid: agents.reduce((s, a) => s + a.paidInr, 0),
  }), [agents]);

  return (
    <div className="ds-stack" style={{ gap: 'var(--gap-section)' }}>
      <Toolbar>
        <Segmented options={[...STATUS_FILTERS]} value={filter} onChange={(v) => setFilter(v as StatusFilter)} />
        <div style={{ position: 'relative', minWidth: 220, flex: '0 1 300px' }}>
          <Search
            size={14}
            aria-hidden="true"
            style={{
              position: 'absolute', left: 'var(--s-3)', top: '50%', transform: 'translateY(-50%)',
              color: 'var(--ink-3)', pointerEvents: 'none',
            }}
          />
          <input
            className="input"
            style={{ paddingLeft: 'var(--s-7)' }}
            placeholder="Search agents, agencies…"
            aria-label="Search agents"
            value={q}
            onChange={(e) => setQ(e.target.value)}
          />
        </div>
        <span style={{ flex: 1 }} />
        <button className="btn-primary" onClick={() => { setForm(emptyForm); setAddOpen(true); }}>
          <Plus size={15} /> Add agent
        </button>
      </Toolbar>

      {!isLoading && agents.length > 0 && (
        <div className="ds-grid" style={{ gridTemplateColumns: 'repeat(auto-fit,minmax(180px,1fr))', gap: 'var(--s-3)' }}>
          <StatCard label="Active agents" value={totals.active} tone="sales" icon={Users} />
          <StatCard label="Agent commission — total" value={money(totals.commission)} tone="info" icon={UserRoundCheck} />
          <StatCard label="Payable now" value={money(totals.payable)} tone="renewal" icon={Banknote} />
          <StatCard label="Paid to date" value={money(totals.paid)} tone="active" icon={BadgeCheck} />
        </div>
      )}

      {bizFailed && (
        <Card>
          <EmptyState
            compact
            icon={Banknote}
            title="Business figures could not be loaded"
            body={`The agents below are correct, but their policies, premium, payout, commission and profit are unavailable — ${apiErrorMessage(bizQ.error)}. The dashes are missing data, not zero.`}
          />
        </Card>
      )}

      {isLoading ? (
        <Skeleton rows={4} height={64} />
      ) : agents.length === 0 ? (
        <Card>
          <EmptyState
            icon={Users}
            title="No agents yet"
            body="External introducers earn their own percentage of the premium — separate from the insurer's brokerage, and never shown on a customer invoice. Add the first one."
            actionLabel="Add agent"
            onAction={() => { setForm(emptyForm); setAddOpen(true); }}
          />
        </Card>
      ) : shown.length === 0 ? (
        <Card>
          <EmptyState compact icon={Search} title="Nothing matches" body="No agent fits that search and status." />
        </Card>
      ) : (
        <Card flush>
          <DataTable
            rows={shown}
            rowKey={(a) => a.id}
            // The row opens the RECORD. The drawer remains for settlement detail,
            // reachable from the profile — a list row should go to the thing itself.
            onRowClick={(a) => { window.location.href = `/insurance/agents/${a.id}`; }}
            columns={[
              {
                key: 'name', header: 'Agent', sortable: true,
                render: (a) => (
                  <div style={{ minWidth: 0 }}>
                    <div style={{ fontWeight: 600, color: 'var(--ink)' }}>{a.name}</div>
                    <div className="ds-caption ds-num" style={{ marginTop: 2 }}>{a.code}</div>
                  </div>
                ),
              },
              {
                key: 'policies', header: 'Policies', align: 'right', sortable: true,
                render: (a) => (bizFailed ? dash : a.policies),
              },
              {
                key: 'premiumInr', header: 'Premium', align: 'right', sortable: true,
                render: (a) => fig(a.premiumInr),
              },
              {
                key: 'payoutInr', header: 'Payout', align: 'right', sortable: true,
                render: (a) => fig(a.payoutInr),
              },
              {
                key: 'agentCommissionInr', header: 'Agent commission', align: 'right', sortable: true,
                render: (a) => fig(a.agentCommissionInr),
              },
              {
                key: 'execCommissionInr', header: 'Executive commission', align: 'right', sortable: true,
                render: (a) => fig(a.execCommissionInr),
              },
              {
                // Money is ink. The one exception is a NEGATIVE net profit, which
                // means more was promised out than came in — the reader has to
                // see that without hunting for it.
                key: 'companyProfitInr', header: 'Net profit', align: 'right', sortable: true,
                render: (a) => (bizFailed ? dash : (
                  <span
                    className="ds-num"
                    style={{ fontWeight: 600, color: a.companyProfitInr < 0 ? 'var(--tone-expired)' : 'var(--ink)' }}
                  >
                    {money(a.companyProfitInr)}
                  </span>
                )),
              },
              {
                key: 'status', header: 'Status', sortable: true,
                render: (a) => <Badge tone={agentTone(a.status)}>{humanStatus(a.status)}</Badge>,
              },
            ]}
          />
        </Card>
      )}

      <div className="ds-caption">
        “Agent commission” is the external introducer’s cut of the premium. It is not the insurer’s
        brokerage, and not the internal executive share — a policy can carry all three, independently.
      </div>

      {/* ------------------------------------------------ add agent drawer */}
      <Drawer
        open={addOpen}
        onClose={() => setAddOpen(false)}
        title="Add agent"
        subtitle="An external introducer paid their own percentage of the premium."
      >
        <AgentFields value={form} onChange={setForm} editing={false} />
        <div className="ds-row">
          <button className="btn-primary" disabled={!form.name.trim() || add.isPending} onClick={() => add.mutate()}>
            {add.isPending ? 'Adding…' : 'Add agent'}
          </button>
          <button className="btn-secondary" onClick={() => setAddOpen(false)}>Cancel</button>
        </div>
      </Drawer>

      {openId && <AgentDrawer agentId={openId} onClose={() => setOpenId(null)} />}
    </div>
  );
}
