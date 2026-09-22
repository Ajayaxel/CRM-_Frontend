'use client';

/**
 * Executives — the internal staff who source the business.
 *
 * An EXECUTIVE is not an agent. The executive is on the payroll and their share
 * comes out of the insurer's brokerage (ledger 5400); an agent is an outside
 * introducer paid their own percentage of the premium (5420). Both can sit on
 * the same policy, and the labels here keep them apart deliberately.
 *
 * This screen exists because the attribution used to be free text on the policy.
 * That let one person hold two rows on the leaderboard ("Meera J" and "Meera
 * Joshi"), and let policies be attributed to nobody at all. The master fixes it
 * by storing an identity: renaming somebody here corrects every policy they ever
 * sourced, which is the exact opposite of how an agent's commission percentage
 * behaves — a percentage is a money term that must freeze at issue, a name is an
 * identity that must follow the person.
 *
 *   GET   /insurance/executives                (key ins-executives)
 *   POST  /insurance/executives
 *   GET   /insurance/executives/duplicates
 *   POST  /insurance/executives/backfill
 *   POST  /insurance/executives/:id/merge
 *   GET   /insurance/executives/:id            (key ins-executive, id)
 *   PATCH /insurance/executives/:id
 */

import { useState } from 'react';
import Link from 'next/link';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { GitMerge, Plus, TriangleAlert, UserRoundCheck, Users } from 'lucide-react';
import { api, apiErrorMessage } from '@/lib/api';
import { fmtOrgMoney } from '@/lib/org-locale';
import {
  Badge, Card, DataTable, Drawer, EmptyState, Field, FormSection, Skeleton,
  StatCard, humanStatus,
} from '../ui/kit';

type Executive = {
  id: string;
  code: string;
  name: string;
  status: string;
  email?: string | null;
  phone?: string | null;
  userId?: string | null;
  user?: { id: string; firstName: string; lastName?: string | null; email: string } | null;
};

type Suggestion = {
  a: { id: string; name: string };
  b: { id: string; name: string };
  why: string;
};

export function InsuranceExecutives() {
  const qc = useQueryClient();
  const [openId, setOpenId] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);
  const [form, setForm] = useState({ name: '', email: '', phone: '', userId: '' });
  const [mergeFrom, setMergeFrom] = useState<Suggestion | null>(null);

  const listQ = useQuery<Executive[]>({
    queryKey: ['ins-executives'],
    queryFn: async () => (await api.get('/insurance/executives')).data,
  });
  const dupQ = useQuery<Suggestion[]>({
    queryKey: ['ins-exec-duplicates'],
    queryFn: async () => (await api.get('/insurance/executives/duplicates')).data,
  });
  // /users is paginated ({ data, meta }) while the insurance endpoints return
  // bare arrays. Unwrapping here rather than at each call site, so a `.map` on
  // an object cannot take the whole screen down again.
  const usersQ = useQuery<any[]>({
    queryKey: ['org-users'],
    queryFn: async () => {
      const r = (await api.get('/users')).data;
      return Array.isArray(r) ? r : r?.data ?? [];
    },
  });
  const detailQ = useQuery<any>({
    queryKey: ['ins-executive', openId],
    queryFn: async () => (await api.get(`/insurance/executives/${openId}`)).data,
    enabled: !!openId,
  });

  const refresh = () => {
    qc.invalidateQueries({ queryKey: ['ins-executives'] });
    qc.invalidateQueries({ queryKey: ['ins-exec-duplicates'] });
    qc.invalidateQueries({ queryKey: ['ins-analytics'] });
  };

  const create = useMutation({
    mutationFn: () =>
      api.post('/insurance/executives', {
        name: form.name,
        email: form.email || undefined,
        phone: form.phone || undefined,
        userId: form.userId || null,
      }),
    onSuccess: () => {
      toast.success('Executive added');
      setCreating(false);
      setForm({ name: '', email: '', phone: '', userId: '' });
      refresh();
    },
    onError: (e) => toast.error(apiErrorMessage(e)),
  });

  const save = useMutation({
    mutationFn: (d: { id: string; patch: Record<string, unknown> }) =>
      api.patch(`/insurance/executives/${d.id}`, d.patch),
    onSuccess: () => {
      toast.success('Saved — every policy they sourced now reads the new details');
      refresh();
      qc.invalidateQueries({ queryKey: ['ins-executive', openId] });
    },
    onError: (e) => toast.error(apiErrorMessage(e)),
  });

  const merge = useMutation({
    mutationFn: (d: { id: string; intoId: string }) =>
      api.post(`/insurance/executives/${d.id}/merge`, { intoId: d.intoId }),
    onSuccess: (r: any) => {
      toast.success(
        `Merged into ${r.data.into.name} — ${r.data.policiesMoved} policies and ${r.data.commissionsMoved} commission rows moved`,
      );
      setMergeFrom(null);
      refresh();
    },
    onError: (e) => toast.error(apiErrorMessage(e)),
  });

  const backfill = useMutation({
    mutationFn: () => api.post('/insurance/executives/backfill', {}),
    onSuccess: (r: any) => {
      const d = r.data;
      toast.success(
        `Linked ${d.linkedPolicies} policies to ${d.created.length} executives` +
          (d.unattributedPolicies ? ` · ${d.unattributedPolicies} still have nobody` : ''),
      );
      refresh();
    },
    onError: (e) => toast.error(apiErrorMessage(e)),
  });

  const rows = listQ.data ?? [];
  const suggestions = dupQ.data ?? [];
  const active = rows.filter((r) => r.status === 'ACTIVE');
  const linked = rows.filter((r) => r.userId).length;

  if (listQ.isLoading) return <Skeleton />;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}>
        <div>
          <h1 className="ds-h1">Executives</h1>
          <p className="ds-caption" style={{ marginTop: 2 }}>
            Internal staff who source business. Paid from the brokerage — not the same as an agent.
          </p>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <button className="btn-secondary" onClick={() => backfill.mutate()} disabled={backfill.isPending}>
            {backfill.isPending ? 'Linking…' : 'Link legacy policies'}
          </button>
          <button className="btn-primary" onClick={() => setCreating(true)}>
            <Plus size={16} /> New executive
          </button>
        </div>
      </div>

      <div className="ds-grid ds-grid-kpi">
        <StatCard icon={Users} label="Executives" value={String(active.length)} />
        <StatCard icon={UserRoundCheck} label="Linked to a login" value={`${linked} of ${rows.length}`} />
        <StatCard icon={TriangleAlert} label="Possible duplicates" value={String(suggestions.length)} />
      </div>

      {/* Suggestions, never automatic. "Meera J" and "Meera Joshi" might be two
          people, and a wrong merge silently moves someone's book onto a
          colleague — so this asks rather than guesses. */}
      {suggestions.length > 0 && (
        <Card>
          <div style={{ padding: 16, display: 'flex', flexDirection: 'column', gap: 12 }}>
            <div className="ds-h3">These might be the same person</div>
            <div className="ds-caption">
              Nothing is merged automatically — a wrong merge moves one person&rsquo;s book onto another.
            </div>
            {suggestions.map((s, i) => (
              <div
                key={i}
                style={{
                  display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                  gap: 12, padding: '10px 0', borderTop: '1px solid var(--hairline)',
                }}
              >
                <div>
                  <div style={{ fontWeight: 600 }}>
                    {s.a.name} <span style={{ color: 'var(--ink-3)' }}>·</span> {s.b.name}
                  </div>
                  <div className="ds-caption">{s.why}</div>
                </div>
                <button className="btn-secondary btn-sm" onClick={() => setMergeFrom(s)}>
                  <GitMerge size={14} /> Review
                </button>
              </div>
            ))}
          </div>
        </Card>
      )}

      {rows.length === 0 ? (
        <EmptyState
          icon={Users}
          title="No executives yet"
          body="Add the staff who source policies, then pick one when issuing. Existing policies can be linked with “Link legacy policies”."
        />
      ) : (
        <DataTable
          rows={rows}
          rowKey={(r: Executive) => r.id}
          onRowClick={(r: Executive) => setOpenId(r.id)}
          columns={[
            { key: 'code', header: 'Code', render: (r: Executive) => <span className="ds-mono">{r.code}</span> },
            { key: 'name', header: 'Name', render: (r: Executive) => <strong>{r.name}</strong> },
            {
              key: 'user', header: 'Login',
              render: (r: Executive) =>
                r.user ? (
                  <span>{r.user.firstName} {r.user.lastName ?? ''}</span>
                ) : (
                  <span className="ds-caption">Not linked</span>
                ),
            },
            { key: 'phone', header: 'Phone', render: (r: Executive) => r.phone ?? '—' },
            {
              key: 'status', header: 'Status',
              render: (r: Executive) => (
                <Badge tone={r.status === 'ACTIVE' ? 'active' : 'neutral'}>{humanStatus(r.status)}</Badge>
              ),
            },
          ]}
        />
      )}

      {/* ---- create */}
      <Drawer open={creating} onClose={() => setCreating(false)} title="New executive">
        <FormSection title="Details">
          <Field label="Name">
            <input className="input" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
          </Field>
          <Field label="CRM login (optional)" hint="Link them to a user so the leaderboard can reach the person.">
            <select className="input" value={form.userId} onChange={(e) => setForm({ ...form, userId: e.target.value })}>
              <option value="">Not linked</option>
              {(usersQ.data ?? []).map((u: any) => (
                <option key={u.id} value={u.id}>
                  {u.firstName} {u.lastName ?? ''} · {u.email}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Email">
            <input className="input" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />
          </Field>
          <Field label="Phone">
            <input className="input" value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} />
          </Field>
          <button className="btn-primary" disabled={!form.name.trim() || create.isPending} onClick={() => create.mutate()}>
            {create.isPending ? 'Adding…' : 'Add executive'}
          </button>
        </FormSection>
      </Drawer>

      {/* ---- detail */}
      <Drawer open={!!openId} onClose={() => setOpenId(null)} title={detailQ.data?.name ?? 'Executive'}>
        {detailQ.isLoading ? (
          <Skeleton />
        ) : detailQ.data ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            <div className="ds-grid ds-grid-kpi">
              <StatCard label="Policies" value={String(detailQ.data.performance.policies)} />
              <StatCard label="Premium written" value={fmtOrgMoney(detailQ.data.performance.premiumInr)} />
              <StatCard label="Their share" value={fmtOrgMoney(detailQ.data.performance.execInr)} />
            </div>
            <FormSection title="Details">
              <Field label="Name" hint="Correcting a name updates every policy this person sourced.">
                <input
                  className="input"
                  defaultValue={detailQ.data.name}
                  onBlur={(e) =>
                    e.target.value.trim() !== detailQ.data.name &&
                    save.mutate({ id: detailQ.data.id, patch: { name: e.target.value } })
                  }
                />
              </Field>
              <Field label="CRM login">
                <select
                  className="input"
                  defaultValue={detailQ.data.userId ?? ''}
                  onChange={(e) => save.mutate({ id: detailQ.data.id, patch: { userId: e.target.value || null } })}
                >
                  <option value="">Not linked</option>
                  {(usersQ.data ?? []).map((u: any) => (
                    <option key={u.id} value={u.id}>
                      {u.firstName} {u.lastName ?? ''} · {u.email}
                    </option>
                  ))}
                </select>
              </Field>
              <Field label="Status">
                <select
                  className="input"
                  defaultValue={detailQ.data.status}
                  onChange={(e) => save.mutate({ id: detailQ.data.id, patch: { status: e.target.value } })}
                >
                  <option value="ACTIVE">Active</option>
                  <option value="INACTIVE">Inactive</option>
                </select>
              </Field>
            </FormSection>
            {detailQ.data.policies?.length > 0 && (
              <div>
                <div className="ds-h3" style={{ marginBottom: 8 }}>Recent policies</div>
                <DataTable
                  rows={detailQ.data.policies.slice(0, 25)}
                  rowKey={(p: any) => p.id}
                  columns={[
                    // The policy and the customer behind it both lead to their
                    // own record — an executive's business is business done
                    // with people, and a name you cannot click is a name
                    // somebody has to search for.
                    { key: 'policyNo', header: 'Policy', render: (p: any) => (
                      <Link href={`/insurance/policies/${p.id}`} className="ds-mono">{p.policyNo}</Link>
                    ) },
                    { key: 'client', header: 'Client', render: (p: any) => (
                      p.client?.id
                        ? <Link href={`/insurance/clients/${p.client.id}`}>{p.client.name}</Link>
                        : <span className="ds-muted">—</span>
                    ) },
                    { key: 'productName', header: 'Product' },
                    { key: 'premiumInr', header: 'Premium', render: (p: any) => fmtOrgMoney(p.premiumInr) },
                  ]}
                />
              </div>
            )}
          </div>
        ) : null}
      </Drawer>

      {/* ---- merge confirmation. Which way round matters, so it is spelled out. */}
      <Drawer open={!!mergeFrom} onClose={() => setMergeFrom(null)} title="Merge executives">
        {mergeFrom && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            <p className="ds-body">
              This moves every policy and commission row from one executive onto the other. The emptied
              record is kept and marked merged, so an old report that cites it still resolves to a person.
            </p>
            <p className="ds-caption">{mergeFrom.why}</p>
            <button
              className="btn-primary"
              disabled={merge.isPending}
              onClick={() => merge.mutate({ id: mergeFrom.a.id, intoId: mergeFrom.b.id })}
            >
              Move {mergeFrom.a.name} into {mergeFrom.b.name}
            </button>
            <button
              className="btn-secondary"
              disabled={merge.isPending}
              onClick={() => merge.mutate({ id: mergeFrom.b.id, intoId: mergeFrom.a.id })}
            >
              Move {mergeFrom.b.name} into {mergeFrom.a.name}
            </button>
            <button className="btn-ghost" onClick={() => setMergeFrom(null)}>
              They are different people — leave both
            </button>
          </div>
        )}
      </Drawer>
    </div>
  );
}
