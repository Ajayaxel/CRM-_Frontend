'use client';

/**
 * Deployments & automated technical events (spec §21, §22).
 *
 * Two audiences on one screen: a manager checking whether production is healthy,
 * and a lead who has to wire the pipeline up. The ingest-token panel therefore
 * sits beside the history, with the exact request a CI job needs to send.
 */

import React, { useMemo, useState } from 'react';
import { Copy, Plug, Plus, Rocket, Trash2 } from 'lucide-react';
import { toast } from 'sonner';
import { useAuth } from '@/features/foundation/auth';
import { apiErrorMessage } from '@/lib/api';
import {
  useCreateDeployment, useCreateWebhookToken, useDeployments, useProjects,
  useRevokeWebhookToken, useVerticals, useWebhookTokens, type Deployment,
} from '../api';
import { Table, type Column } from '../ui/table';
import { FilterBar, type ActiveFilter, type FilterDef } from '../ui/filters';
import { Empty, OptionList, Popover, Skeleton, Stat, fmtAgo, fmtDateTime, humanize } from '../ui/primitives';
import { Panel, Fields, Field } from '../ui/panel';
import { StatusChip, deploymentTone } from '../ui/cells';
import { Page } from './page';

const ENVIRONMENTS = ['DEV', 'STAGING', 'UAT', 'PRODUCTION'];
const STATUSES = ['QUEUED', 'RUNNING', 'SUCCESS', 'FAILED', 'ROLLED_BACK'];

export function DeploymentsScreen({
  verticalId, projectId, embedded,
}: { verticalId?: string; projectId?: string; embedded?: boolean }) {
  const { hasPermission } = useAuth();
  const [filters, setFilters] = useState<ActiveFilter[]>([]);
  const [recording, setRecording] = useState(false);
  const [tokensOpen, setTokensOpen] = useState(false);

  const statusFilter = filters.find((f) => f.key === 'status');
  const { data, isLoading } = useDeployments({ verticalId, projectId, limit: 200, status: statusFilter?.values.join(',') });

  const canManage = hasPermission('pm.deployment.manage');
  const rows = data?.data ?? [];
  const recent = rows.slice(0, 30);

  const defs = useMemo<FilterDef[]>(() => [
    { key: 'status', label: 'Status', type: 'enum', options: STATUSES.map((s) => ({ value: s, label: humanize(s), tone: deploymentTone(s) })) },
    { key: 'environment', label: 'Environment', type: 'enum', options: ENVIRONMENTS.map((e) => ({ value: e, label: humanize(e) })) },
  ], []);

  const filtered = useMemo(() => {
    const env = filters.find((f) => f.key === 'environment');
    if (!env?.values.length) return rows;
    return rows.filter((d) => env.values.includes(d.environment));
  }, [rows, filters]);

  const columns = useMemo<Column<Deployment>[]>(() => [
    {
      key: 'version', header: 'Release', width: 300, minWidth: 180, locked: true, sortValue: (d) => d.version,
      render: (d) => (
        <span style={{ minWidth: 0, display: 'block' }}>
          <span className="cw-truncate" style={{ fontWeight: 560 }}>{d.version ?? 'Deployment'}</span>
          {d.commitMsg && <span className="cw-truncate cw-meta" style={{ display: 'block' }}>{d.commitMsg}</span>}
        </span>
      ),
    },
    { key: 'status', header: 'Status', width: 128, sortValue: (d) => d.status, render: (d) => <StatusChip kind="deployment" value={d.status} /> },
    { key: 'environment', header: 'Environment', width: 122, sortValue: (d) => d.environment, render: (d) => <span className="cw-meta">{humanize(d.environment)}</span> },
    ...(!verticalId ? [{
      key: 'vertical', header: 'Product line', width: 150, sortValue: (d: Deployment) => d.vertical?.name,
      render: (d: Deployment) => <span className="cw-truncate cw-meta">{d.vertical.icon} {d.vertical.name}</span>,
    } as Column<Deployment>] : []),
    { key: 'source', header: 'Source', width: 130, sortValue: (d) => d.source, render: (d) => <span className="cw-meta">{d.source}</span> },
    { key: 'commitSha', header: 'Commit', width: 96, sortValue: (d) => d.commitSha, render: (d) => d.commitSha ? <span className="cw-mono">{d.commitSha.slice(0, 7)}</span> : <span className="cw-cell-empty">—</span> },
    { key: 'startedAt', header: 'When', width: 96, align: 'right', sortValue: (d) => d.startedAt, render: (d) => <span className="cw-meta" title={fmtDateTime(d.startedAt)}>{fmtAgo(d.startedAt)}</span> },
    {
      key: 'links', header: '', width: 96, sortable: false,
      render: (d) => (
        <span style={{ display: 'inline-flex', gap: 8 }}>
          {d.url && <a href={d.url} target="_blank" rel="noreferrer" className="cw-meta" onClick={(e) => e.stopPropagation()}>Open</a>}
          {d.logUrl && <a href={d.logUrl} target="_blank" rel="noreferrer" className="cw-meta" onClick={(e) => e.stopPropagation()}>Logs</a>}
        </span>
      ),
    },
  ], [verticalId]);

  const body = (
    <>
      {!embedded && (
        <div style={{ display: 'flex', gap: 28, flexWrap: 'wrap', padding: '4px 0 14px' }}>
          <Stat label="Recent" value={recent.length} />
          <Stat label="Failures" value={recent.filter((d) => d.status === 'FAILED').length} tone={recent.some((d) => d.status === 'FAILED') ? 'red' : 'green'} />
          <Stat label="To production" value={recent.filter((d) => d.environment === 'PRODUCTION').length} />
          <Stat label="Automated" value={recent.filter((d) => d.source !== 'manual').length} />
        </div>
      )}

      <FilterBar
        defs={defs}
        filters={filters}
        onChange={setFilters}
        right={canManage ? (
          <span style={{ display: 'inline-flex', gap: 6 }}>
            <button className="cw-btn" onClick={() => setTokensOpen(true)}><Plug size={13} /> Ingest tokens</button>
            <button className="cw-btn cw-btn-primary" onClick={() => setRecording(true)}><Plus size={13} /> Record</button>
          </span>
        ) : undefined}
      />

      <Table
        id={`deployments:${projectId ?? verticalId ?? 'global'}`}
        rows={filtered}
        columns={columns}
        rowKey={(d) => d.id}
        loading={isLoading}
        toolbarSlot={<span className="cw-meta">{filtered.length} deployment{filtered.length === 1 ? '' : 's'}</span>}
        empty={
          <Empty
            icon={Rocket}
            title="No deployments recorded"
            body="Connect your CI/CD pipeline with an ingest token, or record a release by hand."
            action={canManage ? <button className="cw-btn cw-btn-primary" onClick={() => setTokensOpen(true)}>Set up ingest</button> : undefined}
          />
        }
      />

      <RecordDeployment open={recording} onClose={() => setRecording(false)} verticalId={verticalId} projectId={projectId} />
      <IngestTokens open={tokensOpen} onClose={() => setTokensOpen(false)} />
    </>
  );

  if (embedded) return body;
  return (
    <Page
      crumbs={[{ label: 'Consultant', href: '/consultant' }, { label: 'Deployments' }]}
      title="Deployments"
      description="Releases, incidents and infrastructure events."
    >
      {body}
    </Page>
  );
}

function RecordDeployment({
  open, onClose, verticalId, projectId,
}: { open: boolean; onClose: () => void; verticalId?: string; projectId?: string }) {
  const create = useCreateDeployment();
  const { data: verticals = [] } = useVerticals();
  const [vId, setVId] = useState<string | null>(verticalId ?? null);
  const { data: projects } = useProjects({ verticalId: vId ?? undefined, limit: 100 });
  const [form, setForm] = useState<Record<string, any>>({
    environment: 'PRODUCTION', status: 'SUCCESS', version: '', commitSha: '', commitMsg: '', url: '', logUrl: '', projectId: projectId ?? null,
  });

  if (!open) return null;

  return (
    <Panel open onClose={onClose} title="Record a deployment" width={480}>
      <div style={{ display: 'grid', gap: 16 }}>
        <Fields>
          {!verticalId && (
            <Field label="Product line">
              <Popover
                width={272}
                trigger={({ ref, onClick }) => (
                  <button type="button" ref={ref as any} className="cw-cell-edit" onClick={onClick}>
                    {verticals.find((v: any) => v.id === vId)?.name ?? <span className="cw-cell-empty">Choose a product line</span>}
                  </button>
                )}
              >
                {({ close }) => (
                  <OptionList
                    searchable
                    value={vId ?? undefined}
                    options={verticals.map((v: any) => ({ value: v.id, label: `${v.icon ?? ''} ${v.name}`.trim() }))}
                    onPick={(v) => { setVId(v); close(); }}
                  />
                )}
              </Popover>
            </Field>
          )}
          <Field label="Environment">
            <select className="cw-input" value={form.environment} onChange={(e) => setForm({ ...form, environment: e.target.value })}>
              {ENVIRONMENTS.map((x) => <option key={x} value={x}>{humanize(x)}</option>)}
            </select>
          </Field>
          <Field label="Status">
            <select className="cw-input" value={form.status} onChange={(e) => setForm({ ...form, status: e.target.value })}>
              {STATUSES.map((x) => <option key={x} value={x}>{humanize(x)}</option>)}
            </select>
          </Field>
          <Field label="Version"><input className="cw-input" value={form.version} onChange={(e) => setForm({ ...form, version: e.target.value })} placeholder="v2.4.1" /></Field>
          <Field label="Commit SHA"><input className="cw-input" value={form.commitSha} onChange={(e) => setForm({ ...form, commitSha: e.target.value })} /></Field>
        </Fields>

        <div>
          <label className="cw-label">Commit message</label>
          <input className="cw-input" value={form.commitMsg} onChange={(e) => setForm({ ...form, commitMsg: e.target.value })} />
        </div>
        <Fields>
          <Field label="Deployed URL"><input className="cw-input" value={form.url} onChange={(e) => setForm({ ...form, url: e.target.value })} /></Field>
          <Field label="Log URL"><input className="cw-input" value={form.logUrl} onChange={(e) => setForm({ ...form, logUrl: e.target.value })} /></Field>
        </Fields>

        <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', borderTop: '1px solid var(--cw-line)', paddingTop: 14 }}>
          <button className="cw-btn" onClick={onClose}>Cancel</button>
          <button
            className="cw-btn cw-btn-primary"
            disabled={!vId || create.isPending}
            onClick={() => create.mutate(
              {
                verticalId: vId, projectId: form.projectId ?? undefined,
                environment: form.environment, status: form.status,
                version: form.version || undefined, commitSha: form.commitSha || undefined,
                commitMsg: form.commitMsg || undefined, url: form.url || undefined, logUrl: form.logUrl || undefined,
              },
              { onSuccess: () => { toast.success('Deployment recorded'); onClose(); }, onError: (e) => toast.error(apiErrorMessage(e)) },
            )}
          >Record</button>
        </div>
      </div>
    </Panel>
  );
}

function IngestTokens({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { data: tokens, isLoading } = useWebhookTokens();
  const create = useCreateWebhookToken();
  const revoke = useRevokeWebhookToken();
  const [name, setName] = useState('');
  const [issued, setIssued] = useState<string | null>(null);

  const example = `curl -X POST "$API_URL/api/pm/ingest" \\
  -H "X-BMN-Token: $BMN_PM_TOKEN" \\
  -H 'Content-Type: application/json' \\
  -d '{
    "verticalKey": "SOLAR",
    "event": "deployment.succeeded",
    "environment": "PRODUCTION",
    "version": "v2.4.1",
    "commitSha": "'"$GITHUB_SHA"'",
    "source": "github-actions"
  }'`;

  if (!open) return null;

  return (
    <Panel open onClose={onClose} title="CI/CD ingest tokens" subtitle="Let pipelines and infrastructure post events into this workspace" width={600}>
      <div style={{ display: 'grid', gap: 20 }}>
        <div style={{ display: 'flex', gap: 8 }}>
          <input className="cw-input" placeholder="Token name — e.g. GitHub Actions" value={name} onChange={(e) => setName(e.target.value)} />
          <button
            className="cw-btn cw-btn-primary"
            disabled={!name.trim() || create.isPending}
            onClick={() => create.mutate({ name: name.trim() }, {
              onSuccess: (t) => { setIssued(t.token); setName(''); },
              onError: (e) => toast.error(apiErrorMessage(e)),
            })}
          >Create</button>
        </div>

        {issued && (
          <div style={{ padding: 12, borderRadius: 'var(--cw-r)', background: 'var(--cw-amber-bg)', border: '1px solid var(--cw-line)' }}>
            <div style={{ fontWeight: 620, marginBottom: 7, color: 'var(--cw-amber)' }}>Copy this now — it is not shown again</div>
            <div style={{ display: 'flex', gap: 7 }}>
              <code style={{
                flex: 1, minWidth: 0, fontSize: 11.5, background: 'var(--cw-bg)', padding: '7px 9px',
                borderRadius: 'var(--cw-r-sm)', overflowX: 'auto', whiteSpace: 'nowrap',
              }}>{issued}</code>
              <button className="cw-btn" onClick={() => { navigator.clipboard.writeText(issued); toast.success('Copied'); }}><Copy size={12} /></button>
            </div>
          </div>
        )}

        <div>
          <div className="cw-h2" style={{ marginBottom: 8 }}>Existing tokens</div>
          {isLoading ? <Skeleton rows={2} height={28} /> : !tokens?.length ? <div className="cw-meta">None yet.</div> : tokens.map((t) => (
            <div key={t.id} className="cw-row" style={{ cursor: 'default' }}>
              <span style={{ minWidth: 0, flex: 1 }}>
                <span className="cw-truncate" style={{ display: 'block', fontWeight: 550, textDecoration: t.revokedAt ? 'line-through' : 'none', opacity: t.revokedAt ? 0.5 : 1 }}>
                  {t.name}
                </span>
                <span className="cw-meta">{t.prefix}… · {t.lastUsedAt ? `last used ${fmtAgo(t.lastUsedAt)}` : 'never used'}</span>
              </span>
              {!t.revokedAt && (
                <button
                  type="button" className="cw-icon-btn" style={{ width: 24, height: 24 }} aria-label={`Revoke ${t.name}`}
                  onClick={() => revoke.mutate(t.id, { onSuccess: () => toast.success('Revoked'), onError: (e) => toast.error(apiErrorMessage(e)) })}
                ><Trash2 size={12} /></button>
              )}
            </div>
          ))}
        </div>

        <div>
          <div className="cw-h2" style={{ marginBottom: 8 }}>How a pipeline posts an event</div>
          <pre style={{
            background: 'var(--cw-sunken)', padding: 12, borderRadius: 'var(--cw-r)',
            fontSize: 11, lineHeight: 1.6, overflowX: 'auto', margin: 0,
          }}>{example}</pre>
          <div className="cw-meta" style={{ marginTop: 9, lineHeight: 1.6 }}>
            <strong>verticalKey</strong> is the short code on the product line (INS, SOLAR, RETAIL…). Any <code>event</code> starting
            <code> deployment.</code> becomes a deployment row; anything else — <code>incident.opened</code>, <code>dns.updated</code>,
            <code> ssl.renewed</code>, <code>migration.completed</code> — becomes an automated activity entry. Events that look like
            incidents also notify the product line&apos;s owner, PM and technical lead.
          </div>
        </div>
      </div>
    </Panel>
  );
}
