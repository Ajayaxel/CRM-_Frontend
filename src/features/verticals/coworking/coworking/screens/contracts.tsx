'use client';

/**
 * Contracts — signature is what makes one active, and nothing else does.
 *
 * Terminating a contract cancels the membership under it, because a membership
 * without its contract is a seat nobody agreed to.
 */

import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { FileSignature, Plus } from 'lucide-react';
import { api, apiErrorMessage } from '@/lib/api';
import {
  Badge, Card, DataTable, Drawer, EmptyState, Field, FormSection, Modal, Skeleton,
  Timeline, humanStatus, type DataTableColumn,
} from '../ui/kit';
import { toneForContractStatus } from '../ui/tone';
import {
  DateRange, Detail, DetailGrid, PageHead, Pagination, SearchBox, StatusSelect,
  fmtDate, money, relativeDays, toDateInput, useListState,
} from '../ui/common';

interface ContractRow {
  id: string; reference: string; status: string; startDate: string; endDate: string;
  valueInr: number; depositInr: number; renewalDate?: string | null; autoRenew: boolean;
  signedAt?: string | null; signedByName?: string | null;
  customer: { id: string; name: string; reference: string; email?: string | null };
  plan?: { id: string; name: string } | null;
  quotation?: { id: string; reference: string } | null;
  membership?: { id: string; reference: string; status: string } | null;
}

export function CoworkingContracts() {
  const qc = useQueryClient();
  const { state, set, params } = useListState();
  const [openId, setOpenId] = useState<string | null>(null);
  const [newOpen, setNewOpen] = useState(false);

  const { data, isLoading } = useQuery({
    queryKey: ['cw-contracts', params],
    queryFn: async () => (await api.get<{ data: ContractRow[]; meta: { page: number; limit: number; total: number; totalPages: number } }>('/coworking/contracts', { params })).data,
  });

  const columns: DataTableColumn<ContractRow>[] = [
    {
      key: 'reference', header: 'Contract', sortable: true,
      render: (r) => (
        <span>
          <span style={{ display: 'block', fontWeight: 600 }}>{r.reference}</span>
          <span className="ds-caption">{r.customer.name}</span>
        </span>
      ),
    },
    { key: 'plan', header: 'Plan', render: (r) => r.plan?.name ?? '—' },
    { key: 'term', header: 'Term', render: (r) => `${fmtDate(r.startDate)} → ${fmtDate(r.endDate)}` },
    { key: 'valueInr', header: 'Value', align: 'right', sortable: true, render: (r) => money(r.valueInr) },
    { key: 'endDate', header: 'Ends', sortable: true, render: (r) => relativeDays(r.endDate) },
    { key: 'status', header: 'Status', render: (r) => <Badge tone={toneForContractStatus(r.status)}>{humanStatus(r.status)}</Badge> },
  ];

  return (
    <div className="ds-page">
      <PageHead
        title="Contracts"
        subtitle="Signed agreements and what they commit to."
        actions={<button className="btn-primary" onClick={() => setNewOpen(true)}><Plus size={14} style={{ marginRight: 6 }} />New contract</button>}
      />

      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center', marginBottom: 14 }}>
        <SearchBox value={state.search} onChange={(v) => set({ search: v })} placeholder="Reference or customer…" />
        <StatusSelect value={state.status} onChange={(v) => set({ status: v })} options={['DRAFT', 'PENDING_SIGNATURE', 'ACTIVE', 'EXPIRING', 'EXPIRED', 'TERMINATED']} />
        <DateRange from={state.from} to={state.to} onChange={(p) => set(p)} />
      </div>

      <Card flush>
        <DataTable
          rows={data?.data ?? []}
          columns={columns}
          rowKey={(r) => r.id}
          loading={isLoading}
          onRowClick={(r) => setOpenId(r.id)}
          empty={<EmptyState compact icon={FileSignature} title="No contracts yet" body="Accept a quotation and the contract is raised from it." />}
        />
      </Card>
      <Pagination meta={data?.meta} onPage={(p) => set({ page: p })} />

      {newOpen && <NewContract onClose={() => setNewOpen(false)} onDone={() => { setNewOpen(false); qc.invalidateQueries({ queryKey: ['cw-contracts'] }); }} />}
      {openId && <ContractRecord id={openId} onClose={() => setOpenId(null)} />}
    </div>
  );
}

function NewContract({ onClose, onDone }: { onClose: () => void; onDone: () => void }) {
  const [form, setForm] = useState({
    customerId: '', planId: '', startDate: toDateInput(),
    endDate: toDateInput(new Date(Date.now() + 365 * 86400000)),
    valueInr: '0', depositInr: '0', noticeDays: '30', autoRenew: true, terms: '',
  });

  const { data: customers } = useQuery({
    queryKey: ['cw-customers-picker'],
    queryFn: async () => (await api.get<{ data: { id: string; name: string; reference: string }[] }>('/coworking/customers', { params: { limit: 200 } })).data.data,
  });
  const { data: plans } = useQuery({
    queryKey: ['cw-plans-picker'],
    queryFn: async () => (await api.get<{ data: { id: string; name: string }[] }>('/coworking/plans', { params: { limit: 100 } })).data.data,
  });

  const create = useMutation({
    mutationFn: () => api.post('/coworking/contracts', {
      customerId: form.customerId,
      planId: form.planId || undefined,
      startDate: new Date(form.startDate).toISOString(),
      endDate: new Date(form.endDate).toISOString(),
      valueInr: Number(form.valueInr) || 0,
      depositInr: Number(form.depositInr) || 0,
      noticeDays: Number(form.noticeDays) || 30,
      autoRenew: form.autoRenew,
      terms: form.terms.trim() || undefined,
      status: 'PENDING_SIGNATURE',
    }),
    onSuccess: () => { toast.success('Contract created'); onDone(); },
    onError: (e) => toast.error(apiErrorMessage(e)),
  });

  return (
    <Drawer
      open onClose={onClose} title="New contract" width={540}
      actions={<button className="btn-primary btn-sm" disabled={!form.customerId || create.isPending} onClick={() => create.mutate()}>Create</button>}
    >
      <FormSection title="Parties and term">
        <Field label="Customer" required span={2}>
          <select className="input" value={form.customerId} onChange={(e) => setForm({ ...form, customerId: e.target.value })}>
            <option value="">Choose…</option>
            {(customers ?? []).map((c) => <option key={c.id} value={c.id}>{c.name} ({c.reference})</option>)}
          </select>
        </Field>
        <Field label="Plan">
          <select className="input" value={form.planId} onChange={(e) => setForm({ ...form, planId: e.target.value })}>
            <option value="">—</option>
            {(plans ?? []).map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
          </select>
        </Field>
        <Field label="Notice days"><input className="input" type="number" min={0} value={form.noticeDays} onChange={(e) => setForm({ ...form, noticeDays: e.target.value })} /></Field>
        <Field label="Starts"><input className="input" type="date" value={form.startDate} onChange={(e) => setForm({ ...form, startDate: e.target.value })} /></Field>
        <Field label="Ends"><input className="input" type="date" value={form.endDate} onChange={(e) => setForm({ ...form, endDate: e.target.value })} /></Field>
        <Field label="Contract value"><input className="input" type="number" min={0} value={form.valueInr} onChange={(e) => setForm({ ...form, valueInr: e.target.value })} /></Field>
        <Field label="Deposit"><input className="input" type="number" min={0} value={form.depositInr} onChange={(e) => setForm({ ...form, depositInr: e.target.value })} /></Field>
        <Field label="Terms" span={2}><textarea className="input" rows={5} value={form.terms} onChange={(e) => setForm({ ...form, terms: e.target.value })} /></Field>
        <div style={{ gridColumn: '1 / -1' }}>
          <label style={{ display: 'flex', gap: 8, alignItems: 'center', fontSize: 13 }}>
            <input type="checkbox" checked={form.autoRenew} onChange={(e) => setForm({ ...form, autoRenew: e.target.checked })} />
            Renews automatically unless notice is given
          </label>
        </div>
      </FormSection>
    </Drawer>
  );
}

interface ContractDetail extends ContractRow {
  terms?: string | null; noticeDays: number; signatureData?: string | null;
  terminatedAt?: string | null; terminationReason?: string | null;
  documents: { id: string; name: string; createdAt: string }[];
  invoices: { id: string; number: string; totalInr: number; status: string }[];
  activities: { id: string; title: string; body?: string | null; at: string }[];
  space?: { id: string; name: string } | null;
}

function ContractRecord({ id, onClose }: { id: string; onClose: () => void }) {
  const qc = useQueryClient();
  const [signOpen, setSignOpen] = useState(false);
  const [signedByName, setSignedByName] = useState('');
  const [signedByEmail, setSignedByEmail] = useState('');

  const { data: c, isLoading } = useQuery({
    queryKey: ['cw-contract', id],
    queryFn: async () => (await api.get<ContractDetail>(`/coworking/contracts/${id}`)).data,
  });

  const invalidate = () => {
    qc.invalidateQueries({ queryKey: ['cw-contract', id] });
    qc.invalidateQueries({ queryKey: ['cw-contracts'] });
  };

  const sign = useMutation({
    mutationFn: () => api.post(`/coworking/contracts/${id}/sign`, {
      signedByName: signedByName.trim(),
      signedByEmail: signedByEmail.trim() || undefined,
    }),
    onSuccess: () => { toast.success('Signed — the contract is now active'); setSignOpen(false); invalidate(); },
    onError: (e) => toast.error(apiErrorMessage(e)),
  });

  const terminate = useMutation({
    mutationFn: (reason: string) => api.post(`/coworking/contracts/${id}/terminate`, { reason }),
    onSuccess: () => { toast.success('Terminated'); invalidate(); qc.invalidateQueries({ queryKey: ['cw-memberships'] }); },
    onError: (e) => toast.error(apiErrorMessage(e)),
  });

  return (
    <>
      <Drawer
        open onClose={onClose}
        title={c?.reference ?? 'Contract'}
        subtitle={c?.customer.name}
        width={580}
        actions={c && <Badge tone={toneForContractStatus(c.status)}>{humanStatus(c.status)}</Badge>}
      >
        {isLoading || !c ? (
          <Skeleton rows={4} height={60} />
        ) : (
          <div style={{ display: 'grid', gap: 22 }}>
            <DetailGrid>
              <Detail label="Plan" value={c.plan?.name} />
              <Detail label="Space" value={c.space?.name} />
              <Detail label="Term" value={`${fmtDate(c.startDate)} → ${fmtDate(c.endDate)}`} />
              <Detail label="Ends" value={relativeDays(c.endDate)} />
              <Detail label="Value" value={money(c.valueInr)} />
              <Detail label="Deposit" value={money(c.depositInr)} />
              <Detail label="Notice" value={`${c.noticeDays} days`} />
              <Detail label="Auto-renew" value={c.autoRenew ? 'Yes' : 'No'} />
              <Detail label="Signed" value={c.signedAt ? `${c.signedByName} on ${fmtDate(c.signedAt)}` : 'Not yet'} />
              <Detail label="From quotation" value={c.quotation?.reference} />
              <Detail label="Membership" value={c.membership?.reference} />
            </DetailGrid>

            {c.terms && (
              <div>
                <h3 className="ds-h3" style={{ marginBottom: 6 }}>Terms</h3>
                <p className="ds-body" style={{ whiteSpace: 'pre-wrap' }}>{c.terms}</p>
              </div>
            )}

            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
              {!c.signedAt && c.status !== 'TERMINATED' && (
                <button className="btn-primary btn-sm" onClick={() => setSignOpen(true)}>
                  <FileSignature size={13} style={{ marginRight: 6 }} />Record the signature
                </button>
              )}
              {['ACTIVE', 'EXPIRING', 'PENDING_SIGNATURE'].includes(c.status) && (
                <button className="btn-danger btn-sm" onClick={() => {
                  const reason = window.prompt('Why is the contract being terminated?');
                  if (reason) terminate.mutate(reason);
                }}>Terminate</button>
              )}
            </div>

            {c.terminationReason && (
              <Card pad={14} tone="expired">
                <div className="ds-caption">Terminated {fmtDate(c.terminatedAt)}</div>
                <div style={{ fontSize: 13, marginTop: 3 }}>{c.terminationReason}</div>
              </Card>
            )}

            {c.invoices.length > 0 && (
              <div>
                <h3 className="ds-h3" style={{ marginBottom: 8 }}>Invoices</h3>
                {c.invoices.map((i) => (
                  <div key={i.id} className="ds-list-row">
                    <span style={{ fontSize: 13 }}>{i.number}</span>
                    <span className="ds-caption" style={{ marginLeft: 'auto' }}>{money(i.totalInr)} · {humanStatus(i.status)}</span>
                  </div>
                ))}
              </div>
            )}

            {c.activities.length > 0 && (
              <div>
                <h3 className="ds-h3" style={{ marginBottom: 8 }}>History</h3>
                <Timeline dense items={c.activities.map((a) => ({ at: a.at, title: a.title, detail: a.body ?? undefined }))} />
              </div>
            )}
          </div>
        )}
      </Drawer>

      <Modal
        open={signOpen} onClose={() => setSignOpen(false)} title="Record the signature" width={460}
        footer={
          <>
            <button className="btn-ghost" onClick={() => setSignOpen(false)}>Cancel</button>
            <button className="btn-primary" style={{ marginLeft: 'auto' }} disabled={!signedByName.trim() || sign.isPending} onClick={() => sign.mutate()}>
              Sign and activate
            </button>
          </>
        }
      >
        <div style={{ display: 'grid', gap: 14 }}>
          <Field label="Signed by" required><input className="input" value={signedByName} onChange={(e) => setSignedByName(e.target.value)} /></Field>
          <Field label="Email"><input className="input" type="email" value={signedByEmail} onChange={(e) => setSignedByEmail(e.target.value)} /></Field>
          <p className="ds-caption">Signing sets the contract ACTIVE. Nothing else does.</p>
        </div>
      </Modal>
    </>
  );
}
