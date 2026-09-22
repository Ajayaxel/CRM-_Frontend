'use client';

/**
 * The front desk — the visitor register and access credentials.
 *
 * There is no hardware pretence here. A credential is a token with a validity
 * window, a space list and a weekly schedule; the scan endpoint decides
 * granted/denied and logs BOTH, which is the half an incident investigation
 * actually needs. Wiring a real reader to it is configuration, not a rewrite.
 */

import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { DoorOpen, KeyRound, Plus, ScanLine, UserCheck } from 'lucide-react';
import { api, apiErrorMessage } from '@/lib/api';
import {
  Badge, Card, DataTable, Drawer, EmptyState, Field, FormSection, Modal, Segmented,
  StatCard, humanStatus, type DataTableColumn,
} from '../ui/kit';
import { toneForVisitStatus } from '../ui/tone';
import {
  DateRange, PageHead, Pagination, SearchBox, StatusSelect, fmtDateTime,
  toLocalInput, useListState,
} from '../ui/common';

interface VisitorRow {
  id: string; reference: string; name: string; phone?: string | null; email?: string | null;
  company?: string | null; hostName?: string | null; purpose?: string | null; badgeNo?: string | null;
  expectedAt?: string | null; checkInAt?: string | null; checkOutAt?: string | null; status: string;
  hostCustomer?: { id: string; name: string } | null;
  credential?: { id: string; code: string; status: string; validTo?: string | null } | null;
}

interface CredentialRow {
  id: string; reference: string; holderKind: string; holderName: string; method: string;
  code: string; cardNumber?: string | null; validFrom: string; validTo?: string | null;
  status: string; spaceIds: string[];
  customer?: { id: string; name: string } | null;
  _count: { logs: number };
}

interface LogRow {
  id: string; personName?: string | null; holderKind?: string | null; spaceId?: string | null;
  direction: string; method: string; result: string; reason?: string | null; at: string;
  credential?: { id: string; reference: string; holderKind: string } | null;
}

export function CoworkingFrontDesk() {
  const qc = useQueryClient();
  const [tab, setTab] = useState<'Visitors' | 'Credentials' | 'Access log'>('Visitors');
  const { state, set, params } = useListState();
  const [newVisitor, setNewVisitor] = useState(false);
  const [issueOpen, setIssueOpen] = useState(false);
  const [scanOpen, setScanOpen] = useState(false);

  const { data: onSite } = useQuery({
    queryKey: ['cw-on-site'],
    queryFn: async () => (await api.get<{ visitors: { id: string; name: string; company?: string | null; hostName?: string | null; checkInAt: string; badgeNo?: string | null }[]; bookings: { id: string; reference: string; contactName: string; space: { name: string } }[]; total: number }>('/coworking/visitors/on-site')).data,
  });

  const { data: visitors, isLoading: vLoading } = useQuery({
    queryKey: ['cw-visitors', params],
    queryFn: async () => (await api.get<{ data: VisitorRow[]; meta: { page: number; limit: number; total: number; totalPages: number } }>('/coworking/visitors', { params })).data,
    enabled: tab === 'Visitors',
  });

  const { data: credentials, isLoading: cLoading } = useQuery({
    queryKey: ['cw-credentials', params],
    queryFn: async () => (await api.get<{ data: CredentialRow[]; meta: { page: number; limit: number; total: number; totalPages: number } }>('/coworking/credentials', { params })).data,
    enabled: tab === 'Credentials',
  });

  const { data: logs, isLoading: lLoading } = useQuery({
    queryKey: ['cw-access-logs', params],
    queryFn: async () => (await api.get<{ data: LogRow[]; meta: { page: number; limit: number; total: number; totalPages: number } }>('/coworking/access/logs', { params })).data,
    enabled: tab === 'Access log',
  });

  const setStatus = useMutation({
    mutationFn: ({ id, status }: { id: string; status: string }) => api.patch(`/coworking/visitors/${id}/status`, { status }),
    onSuccess: () => {
      toast.success('Updated');
      qc.invalidateQueries({ queryKey: ['cw-visitors'] });
      qc.invalidateQueries({ queryKey: ['cw-on-site'] });
    },
    onError: (e) => toast.error(apiErrorMessage(e)),
  });

  const revoke = useMutation({
    mutationFn: (id: string) => api.patch(`/coworking/credentials/${id}/status`, { status: 'REVOKED' }),
    onSuccess: () => { toast.success('Revoked'); qc.invalidateQueries({ queryKey: ['cw-credentials'] }); },
    onError: (e) => toast.error(apiErrorMessage(e)),
  });

  const visitorColumns: DataTableColumn<VisitorRow>[] = [
    {
      key: 'name', header: 'Visitor',
      render: (r) => (
        <span>
          <span style={{ display: 'block', fontWeight: 600 }}>{r.name}</span>
          <span className="ds-caption">{r.company || r.reference}</span>
        </span>
      ),
    },
    { key: 'hostName', header: 'Host', render: (r) => r.hostName ?? r.hostCustomer?.name ?? '—' },
    { key: 'purpose', header: 'Purpose', render: (r) => r.purpose ?? '—' },
    { key: 'expectedAt', header: 'Expected', render: (r) => fmtDateTime(r.expectedAt) },
    { key: 'status', header: 'Status', render: (r) => <Badge tone={toneForVisitStatus(r.status)}>{humanStatus(r.status)}</Badge> },
    {
      key: 'actions', header: '', width: 180,
      render: (r) => (
        <div style={{ display: 'flex', gap: 4 }} onClick={(e) => e.stopPropagation()}>
          {r.status === 'EXPECTED' && <button className="btn-primary btn-sm" onClick={() => setStatus.mutate({ id: r.id, status: 'CHECKED_IN' })}>Check in</button>}
          {r.status === 'CHECKED_IN' && <button className="btn-ghost btn-sm" onClick={() => setStatus.mutate({ id: r.id, status: 'CHECKED_OUT' })}>Check out</button>}
        </div>
      ),
    },
  ];

  const credentialColumns: DataTableColumn<CredentialRow>[] = [
    {
      key: 'holderName', header: 'Holder',
      render: (r) => (
        <span>
          <span style={{ display: 'block', fontWeight: 600 }}>{r.holderName}</span>
          <span className="ds-caption">{humanStatus(r.holderKind)} · {r.reference}</span>
        </span>
      ),
    },
    { key: 'method', header: 'Method', render: (r) => humanStatus(r.method) },
    { key: 'validTo', header: 'Valid until', render: (r) => r.validTo ? fmtDateTime(r.validTo) : 'No expiry' },
    { key: 'spaceIds', header: 'Scope', render: (r) => r.spaceIds.length ? `${r.spaceIds.length} space(s)` : 'Everywhere' },
    { key: '_count', header: 'Scans', align: 'right', render: (r) => r._count.logs },
    { key: 'status', header: 'Status', render: (r) => <Badge tone={r.status === 'ACTIVE' ? 'active' : r.status === 'SUSPENDED' ? 'renewal' : 'expired'}>{humanStatus(r.status)}</Badge> },
    {
      key: 'actions', header: '', width: 100,
      render: (r) => r.status === 'ACTIVE' ? (
        <button className="btn-ghost btn-sm" onClick={(e) => { e.stopPropagation(); revoke.mutate(r.id); }}>Revoke</button>
      ) : null,
    },
  ];

  const logColumns: DataTableColumn<LogRow>[] = [
    { key: 'at', header: 'When', render: (r) => fmtDateTime(r.at) },
    { key: 'personName', header: 'Who', render: (r) => r.personName ?? <span className="ds-caption">Unknown credential</span> },
    { key: 'direction', header: 'Direction', render: (r) => r.direction === 'OUT' ? 'Out' : 'In' },
    { key: 'method', header: 'Method', render: (r) => humanStatus(r.method) },
    {
      key: 'result', header: 'Result',
      render: (r) => (
        <span>
          <Badge tone={r.result === 'GRANTED' ? 'active' : r.result === 'EXPIRED' ? 'renewal' : 'expired'}>{humanStatus(r.result)}</Badge>
          {r.reason && r.result !== 'GRANTED' && <span className="ds-caption" style={{ display: 'block', marginTop: 2 }}>{r.reason}</span>}
        </span>
      ),
    },
  ];

  return (
    <div className="ds-page">
      <PageHead
        title="Front desk"
        subtitle="Who is in the building, and who may be."
        actions={
          <>
            <Segmented options={['Visitors', 'Credentials', 'Access log']} value={tab} onChange={(v) => { setTab(v as typeof tab); set({ page: 1, status: '' }); }} />
            <button className="btn-ghost" onClick={() => setScanOpen(true)}><ScanLine size={14} style={{ marginRight: 6 }} />Scan</button>
            {tab === 'Credentials'
              ? <button className="btn-primary" onClick={() => setIssueOpen(true)}><Plus size={14} style={{ marginRight: 6 }} />Issue credential</button>
              : <button className="btn-primary" onClick={() => setNewVisitor(true)}><Plus size={14} style={{ marginRight: 6 }} />Register visitor</button>}
          </>
        }
      />

      {onSite && (
        <div className="ds-grid ds-grid-kpi" style={{ marginBottom: 20 }}>
          <StatCard label="On site now" value={onSite.total} icon={UserCheck} tone="sales" />
          <StatCard label="Visitors checked in" value={onSite.visitors.length} icon={DoorOpen} tone="info" />
          <StatCard label="Bookings in progress" value={onSite.bookings.length} tone="active" />
        </div>
      )}

      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center', marginBottom: 14 }}>
        <SearchBox value={state.search} onChange={(v) => set({ search: v })} placeholder="Name, company, badge…" />
        {tab === 'Visitors' && <StatusSelect value={state.status} onChange={(v) => set({ status: v })} options={['EXPECTED', 'CHECKED_IN', 'CHECKED_OUT', 'CANCELLED', 'NO_SHOW']} />}
        {tab === 'Credentials' && <StatusSelect value={state.status} onChange={(v) => set({ status: v })} options={['ACTIVE', 'SUSPENDED', 'REVOKED', 'EXPIRED']} />}
        {tab === 'Access log' && <StatusSelect value={state.status} onChange={(v) => set({ status: v })} options={['GRANTED', 'DENIED', 'EXPIRED', 'UNKNOWN']} label="Any result" />}
        {tab === 'Access log' && <DateRange from={state.from} to={state.to} onChange={(p) => set(p)} />}
      </div>

      <Card flush>
        {tab === 'Visitors' && (
          <DataTable
            rows={visitors?.data ?? []} columns={visitorColumns} rowKey={(r) => r.id} loading={vLoading}
            empty={<EmptyState compact icon={DoorOpen} title="No visitors" body="Register someone expected, and their host is told when they arrive." actionLabel="Register visitor" onAction={() => setNewVisitor(true)} />}
          />
        )}
        {tab === 'Credentials' && (
          <DataTable
            rows={credentials?.data ?? []} columns={credentialColumns} rowKey={(r) => r.id} loading={cLoading}
            empty={<EmptyState compact icon={KeyRound} title="No credentials issued" body="A credential is a QR token with a validity window and a space list." actionLabel="Issue credential" onAction={() => setIssueOpen(true)} />}
          />
        )}
        {tab === 'Access log' && (
          <DataTable
            rows={logs?.data ?? []} columns={logColumns} rowKey={(r) => r.id} loading={lLoading}
            empty={<EmptyState compact icon={ScanLine} title="No scans yet" body="Every scan — granted or refused — is recorded here." />}
          />
        )}
      </Card>
      <Pagination
        meta={tab === 'Visitors' ? visitors?.meta : tab === 'Credentials' ? credentials?.meta : logs?.meta}
        onPage={(p) => set({ page: p })}
      />

      {newVisitor && <RegisterVisitor onClose={() => setNewVisitor(false)} onDone={() => { setNewVisitor(false); qc.invalidateQueries({ queryKey: ['cw-visitors'] }); }} />}
      {issueOpen && <IssueCredential onClose={() => setIssueOpen(false)} onDone={() => { setIssueOpen(false); qc.invalidateQueries({ queryKey: ['cw-credentials'] }); }} />}
      {scanOpen && <ScanDialog onClose={() => setScanOpen(false)} />}
    </div>
  );
}

function RegisterVisitor({ onClose, onDone }: { onClose: () => void; onDone: () => void }) {
  const [form, setForm] = useState({
    name: '', phone: '', email: '', company: '', hostCustomerId: '', hostName: '',
    purpose: '', idType: '', idNumber: '', expectedAt: toLocalInput(), issueAccess: true,
  });

  const { data: customers } = useQuery({
    queryKey: ['cw-customers-picker'],
    queryFn: async () => (await api.get<{ data: { id: string; name: string }[] }>('/coworking/customers', { params: { limit: 200 } })).data.data,
  });

  const create = useMutation({
    mutationFn: () => api.post('/coworking/visitors', {
      name: form.name.trim(),
      phone: form.phone.trim() || undefined,
      email: form.email.trim() || undefined,
      company: form.company.trim() || undefined,
      hostCustomerId: form.hostCustomerId || undefined,
      hostName: form.hostName.trim() || undefined,
      purpose: form.purpose.trim() || undefined,
      idType: form.idType.trim() || undefined,
      idNumber: form.idNumber.trim() || undefined,
      expectedAt: new Date(form.expectedAt).toISOString(),
      issueAccess: form.issueAccess,
    }),
    onSuccess: () => { toast.success('Visitor registered'); onDone(); },
    onError: (e) => toast.error(apiErrorMessage(e)),
  });

  return (
    <Drawer
      open onClose={onClose} title="Register a visitor" width={500}
      actions={<button className="btn-primary btn-sm" disabled={!form.name.trim() || create.isPending} onClick={() => create.mutate()}>Register</button>}
    >
      <FormSection title="Visitor">
        <Field label="Name" required><input className="input" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} /></Field>
        <Field label="Company"><input className="input" value={form.company} onChange={(e) => setForm({ ...form, company: e.target.value })} /></Field>
        <Field label="Phone"><input className="input" value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} /></Field>
        <Field label="Email"><input className="input" type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} /></Field>
        <Field label="ID type"><input className="input" value={form.idType} onChange={(e) => setForm({ ...form, idType: e.target.value })} /></Field>
        <Field label="ID number"><input className="input" value={form.idNumber} onChange={(e) => setForm({ ...form, idNumber: e.target.value })} /></Field>
      </FormSection>
      <FormSection title="Visiting">
        <Field label="Host member">
          <select className="input" value={form.hostCustomerId} onChange={(e) => setForm({ ...form, hostCustomerId: e.target.value })}>
            <option value="">—</option>
            {(customers ?? []).map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>
        </Field>
        <Field label="Host name"><input className="input" value={form.hostName} onChange={(e) => setForm({ ...form, hostName: e.target.value })} /></Field>
        <Field label="Purpose" span={2}><input className="input" value={form.purpose} onChange={(e) => setForm({ ...form, purpose: e.target.value })} placeholder="Meeting, interview, delivery" /></Field>
        <Field label="Expected at"><input className="input" type="datetime-local" value={form.expectedAt} onChange={(e) => setForm({ ...form, expectedAt: e.target.value })} /></Field>
        <div style={{ gridColumn: '1 / -1' }}>
          <label style={{ display: 'flex', gap: 8, alignItems: 'center', fontSize: 13 }}>
            <input type="checkbox" checked={form.issueAccess} onChange={(e) => setForm({ ...form, issueAccess: e.target.checked })} />
            Issue a temporary QR credential, valid for 12 hours
          </label>
        </div>
      </FormSection>
    </Drawer>
  );
}

function IssueCredential({ onClose, onDone }: { onClose: () => void; onDone: () => void }) {
  const [form, setForm] = useState({
    holderKind: 'MEMBER', customerId: '', holderName: '', method: 'QR',
    cardNumber: '', validTo: '', spaceIds: [] as string[], notes: '',
  });

  const { data: customers } = useQuery({
    queryKey: ['cw-customers-picker'],
    queryFn: async () => (await api.get<{ data: { id: string; name: string }[] }>('/coworking/customers', { params: { limit: 200 } })).data.data,
  });
  const { data: spaces } = useQuery({
    queryKey: ['cw-spaces-picker-all'],
    queryFn: async () => (await api.get<{ data: { id: string; name: string }[] }>('/coworking/spaces', { params: { limit: 200 } })).data.data,
  });

  const issue = useMutation({
    mutationFn: () => api.post('/coworking/credentials', {
      holderKind: form.holderKind,
      customerId: form.customerId || undefined,
      holderName: form.holderName.trim(),
      method: form.method,
      cardNumber: form.cardNumber.trim() || undefined,
      validTo: form.validTo ? new Date(form.validTo).toISOString() : undefined,
      spaceIds: form.spaceIds,
      notes: form.notes.trim() || undefined,
    }),
    onSuccess: (res) => {
      const c = res.data as { reference: string; code: string };
      toast.success(`${c.reference} issued`);
      onDone();
    },
    onError: (e) => toast.error(apiErrorMessage(e)),
  });

  return (
    <Drawer
      open onClose={onClose} title="Issue a credential" width={500}
      actions={<button className="btn-primary btn-sm" disabled={!form.holderName.trim() || issue.isPending} onClick={() => issue.mutate()}>Issue</button>}
    >
      <FormSection title="Holder">
        <Field label="Kind">
          <select className="input" value={form.holderKind} onChange={(e) => setForm({ ...form, holderKind: e.target.value })}>
            {['MEMBER', 'STAFF', 'VISITOR', 'CONTRACTOR'].map((k) => <option key={k} value={k}>{humanStatus(k)}</option>)}
          </select>
        </Field>
        <Field label="Customer">
          <select className="input" value={form.customerId} onChange={(e) => {
            const c = customers?.find((x) => x.id === e.target.value);
            setForm({ ...form, customerId: e.target.value, holderName: c?.name ?? form.holderName });
          }}>
            <option value="">—</option>
            {(customers ?? []).map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>
        </Field>
        <Field label="Name on the credential" required span={2}>
          <input className="input" value={form.holderName} onChange={(e) => setForm({ ...form, holderName: e.target.value })} />
        </Field>
      </FormSection>
      <FormSection title="Credential">
        <Field label="Method">
          <select className="input" value={form.method} onChange={(e) => setForm({ ...form, method: e.target.value })}>
            {['QR', 'CARD', 'PIN', 'MOBILE', 'BIOMETRIC'].map((m) => <option key={m} value={m}>{humanStatus(m)}</option>)}
          </select>
        </Field>
        <Field label="Card number"><input className="input" value={form.cardNumber} onChange={(e) => setForm({ ...form, cardNumber: e.target.value })} /></Field>
        <Field label="Valid until" hint="Blank means no expiry — use one for contractors."><input className="input" type="datetime-local" value={form.validTo} onChange={(e) => setForm({ ...form, validTo: e.target.value })} /></Field>
        <div style={{ gridColumn: '1 / -1' }}>
          <div className="label">Spaces it opens</div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
            {(spaces ?? []).map((s) => {
              const on = form.spaceIds.includes(s.id);
              return (
                <button
                  key={s.id} type="button" aria-pressed={on}
                  className={`ds-badge ${on ? 'ds-tone-info' : 'ds-tone-neutral'}`}
                  style={{ font: 'inherit', cursor: 'pointer', padding: '5px 10px' }}
                  onClick={() => setForm({ ...form, spaceIds: on ? form.spaceIds.filter((x) => x !== s.id) : [...form.spaceIds, s.id] })}
                >{s.name}</button>
              );
            })}
          </div>
          <div className="ds-caption" style={{ marginTop: 6 }}>Select none to grant access everywhere.</div>
        </div>
      </FormSection>
    </Drawer>
  );
}

function ScanDialog({ onClose }: { onClose: () => void }) {
  const [code, setCode] = useState('');
  const [direction, setDirection] = useState('IN');
  const [result, setResult] = useState<{ granted: boolean; reason?: string; holder?: string } | null>(null);
  const qc = useQueryClient();

  const scan = useMutation({
    mutationFn: () => api.post<{ granted: boolean; reason?: string; holder?: string }>('/coworking/access/scan', { code: code.trim(), direction }),
    onSuccess: (res) => {
      setResult(res.data);
      qc.invalidateQueries({ queryKey: ['cw-access-logs'] });
      qc.invalidateQueries({ queryKey: ['cw-on-site'] });
    },
    onError: (e) => toast.error(apiErrorMessage(e)),
  });

  return (
    <Modal
      open onClose={onClose} title="Scan a credential" width={460}
      footer={
        <>
          <button className="btn-ghost" onClick={onClose}>Close</button>
          <button className="btn-primary" style={{ marginLeft: 'auto' }} disabled={!code.trim() || scan.isPending} onClick={() => scan.mutate()}>Scan</button>
        </>
      }
    >
      <div style={{ display: 'grid', gap: 14 }}>
        <Field label="Credential code" hint="Paste what the reader or the QR gives you.">
          <input className="input" value={code} onChange={(e) => { setCode(e.target.value); setResult(null); }} autoFocus />
        </Field>
        <Field label="Direction">
          <select className="input" value={direction} onChange={(e) => setDirection(e.target.value)}>
            <option value="IN">Coming in</option>
            <option value="OUT">Going out</option>
          </select>
        </Field>
        {result && (
          <Card pad={16} tone={result.granted ? 'active' : 'expired'}>
            <div style={{ fontSize: 15, fontWeight: 700 }}>{result.granted ? `Granted — ${result.holder}` : 'Refused'}</div>
            {result.reason && <div className="ds-caption" style={{ marginTop: 4 }}>{result.reason}</div>}
          </Card>
        )}
        <p className="ds-caption">
          Every scan is written to the access log, whether it was granted or refused.
        </p>
      </div>
    </Modal>
  );
}
