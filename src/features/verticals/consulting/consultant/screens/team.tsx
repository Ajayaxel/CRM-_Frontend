'use client';

/**
 * Team & workload (spec §26).
 *
 * Sorted by active work, because the question this screen is opened with is
 * "who is drowning?" — the answer should be the first row. Clicking a person
 * opens their record.
 */

import React, { useMemo, useState } from 'react';
import { UserPlus, Users } from 'lucide-react';
import { toast } from 'sonner';
import { useAuth } from '@/features/foundation/auth';
import { apiErrorMessage } from '@/lib/api';
import {
  useOrgUsers, useRemoveMember, useSetMember, useTeam, type TeamRole, type WorkloadRow,
} from '../api';
import { Table, type Column } from '../ui/table';
import { Avatar, Empty, OptionList, Person, Popover, ProgressBar, TONE_VAR, humanize } from '../ui/primitives';
import { Panel, Fields, Field } from '../ui/panel';
import { TEAM_ROLES } from '../ui/cells';
import { useWorkspace } from '../ui/workspace-context';
import { Page } from './page';

export function TeamScreen({ verticalId, embedded }: { verticalId?: string; embedded?: boolean }) {
  const { hasPermission } = useAuth();
  const ws = useWorkspace();
  const { data, isLoading } = useTeam(verticalId);
  const { data: users = [] } = useOrgUsers();
  const setMember = useSetMember();
  const removeMember = useRemoveMember();
  const [adding, setAdding] = useState(false);
  const [newUser, setNewUser] = useState<string | null>(null);
  const [newRole, setNewRole] = useState<TeamRole>('DEVELOPER');

  const canManage = hasPermission('pm.vertical.manage') && Boolean(verticalId);
  const rows = data ?? [];

  // The busiest person sets the scale: an absolute bar is meaningless when one
  // team runs 3 tasks each and another runs 30.
  const peak = useMemo(() => Math.max(1, ...rows.map((r) => r.activeTasks)), [rows]);

  const columns = useMemo<Column<WorkloadRow>[]>(() => [
    {
      key: 'user', header: 'Person', width: 232, minWidth: 160, locked: true, sortValue: (r) => r.user.name,
      render: (r) => <Person person={r.user} size={22} />,
    },
    {
      key: 'role', header: 'Role', width: 168, sortValue: (r) => r.role,
      render: (r) => (canManage && r.role ? (
        <Popover
          width={200}
          trigger={({ ref, onClick }) => (
            <button type="button" ref={ref as any} className="cw-cell-edit" onClick={onClick}>
              <span className="cw-truncate">{humanize(r.role!)}</span>
            </button>
          )}
        >
          {({ close }) => (
            <OptionList
              value={r.role ?? undefined}
              options={TEAM_ROLES.map((x) => ({ value: x, label: humanize(x) }))}
              onPick={(v) => {
                setMember.mutate({ verticalId: verticalId!, userId: r.user.id, role: v as TeamRole }, { onError: (e) => toast.error(apiErrorMessage(e)) });
                close();
              }}
            />
          )}
        </Popover>
      ) : <span className="cw-meta">{r.role ? humanize(r.role) : 'Not on this team'}</span>),
    },
    {
      key: 'activeTasks', header: 'Load', width: 168, sortValue: (r) => r.activeTasks,
      render: (r) => (
        <span style={{ display: 'flex', alignItems: 'center', gap: 8, minWidth: 0 }}>
          <span className="cw-bar" style={{ flex: 1 }}>
            <span style={{
              width: `${(r.activeTasks / peak) * 100}%`,
              background: r.overdueTasks ? TONE_VAR.red : r.activeTasks > peak * 0.75 ? TONE_VAR.amber : TONE_VAR.blue,
            }} />
          </span>
          <span className="cw-num" style={{ fontWeight: 650, minWidth: 20, textAlign: 'right' }}>{r.activeTasks}</span>
        </span>
      ),
    },
    { key: 'overdueTasks', header: 'Overdue', width: 90, align: 'right', sortValue: (r) => r.overdueTasks, render: (r) => <Num n={r.overdueTasks} tone="red" /> },
    { key: 'blockedTasks', header: 'Blocked', width: 90, align: 'right', sortValue: (r) => r.blockedTasks, render: (r) => <Num n={r.blockedTasks} tone="amber" /> },
    { key: 'inReview', header: 'In review', width: 96, align: 'right', sortValue: (r) => r.inReview, render: (r) => <Num n={r.inReview} /> },
    { key: 'openIssues', header: 'Issues', width: 84, align: 'right', sortValue: (r) => r.openIssues, render: (r) => <Num n={r.openIssues} tone="amber" /> },
    { key: 'estimatedHours', header: 'Est. h', width: 84, align: 'right', defaultHidden: true, sortValue: (r) => r.estimatedHours, render: (r) => <span className="cw-num cw-meta">{r.estimatedHours ? r.estimatedHours.toFixed(1) : '—'}</span> },
    { key: 'completedTasks', header: 'Completed', width: 104, align: 'right', sortValue: (r) => r.completedTasks, render: (r) => <Num n={r.completedTasks} tone="green" /> },
  ], [canManage, peak, verticalId]); // eslint-disable-line react-hooks/exhaustive-deps

  const body = (
    <>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '8px 0' }}>
        <span className="cw-meta">{rows.length} people</span>
        <span style={{ flex: 1 }} />
        {canManage && (
          <button className="cw-btn cw-btn-primary" onClick={() => setAdding(true)}><UserPlus size={13} /> Add to team</button>
        )}
      </div>

      <Table
        id={`team:${verticalId ?? 'global'}`}
        rows={rows}
        columns={columns}
        rowKey={(r) => r.user.id}
        loading={isLoading}
        onRowClick={(r) => ws.openRecord('DEVELOPER', r.user.id)}
        empty={
          <Empty
            icon={Users}
            title="No team yet"
            body="Add the project manager, technical lead and developers so work can be assigned and workload rolls up."
            action={canManage ? <button className="cw-btn cw-btn-primary" onClick={() => setAdding(true)}>Add someone</button> : undefined}
          />
        }
      />

      <Panel open={adding} onClose={() => setAdding(false)} title="Add to team" width={430}>
        <div style={{ display: 'grid', gap: 16 }}>
          <Fields>
            <Field label="Person">
              <Popover
                width={272}
                trigger={({ ref, onClick }) => (
                  <button type="button" ref={ref as any} className="cw-cell-edit" onClick={onClick}>
                    {newUser
                      ? <span style={{ display: 'inline-flex', gap: 6, alignItems: 'center' }}><Avatar name={users.find((u) => u.id === newUser)?.name} size={19} />{users.find((u) => u.id === newUser)?.name}</span>
                      : <span className="cw-cell-empty">Choose someone</span>}
                  </button>
                )}
              >
                {({ close }) => (
                  <OptionList
                    searchable
                    value={newUser ?? undefined}
                    options={users.map((u) => ({ value: u.id, label: u.name, hint: u.role ?? undefined, icon: <Avatar name={u.name} size={19} /> }))}
                    onPick={(v) => { setNewUser(v); close(); }}
                  />
                )}
              </Popover>
            </Field>
            <Field label="Role">
              <select className="cw-input" value={newRole} onChange={(e) => setNewRole(e.target.value as TeamRole)}>
                {TEAM_ROLES.map((r) => <option key={r} value={r}>{humanize(r)}</option>)}
              </select>
            </Field>
          </Fields>

          <div className="cw-meta">
            This sets who appears in assignee pickers and whose workload rolls up here. It does not change their
            sign-in permissions — those come from their organisation role.
          </div>

          <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
            <button className="cw-btn" onClick={() => setAdding(false)}>Cancel</button>
            <button
              className="cw-btn cw-btn-primary"
              disabled={!newUser || setMember.isPending}
              onClick={() => setMember.mutate(
                { verticalId: verticalId!, userId: newUser!, role: newRole },
                { onSuccess: () => { toast.success('Added to team'); setAdding(false); setNewUser(null); }, onError: (e) => toast.error(apiErrorMessage(e)) },
              )}
            >Add</button>
          </div>
        </div>
      </Panel>
    </>
  );

  if (embedded) return body;
  return (
    <Page
      crumbs={[{ label: 'Consultant', href: '/consultant' }, { label: 'Team' }]}
      title="Developers & team"
      description="Who is working on what, and how much of it."
    >
      {body}
    </Page>
  );
}

function Num({ n, tone }: { n: number; tone?: 'red' | 'amber' | 'green' }) {
  if (!n) return <span className="cw-cell-empty">—</span>;
  return <span className="cw-num" style={{ fontWeight: 620, color: tone ? TONE_VAR[tone] : 'var(--cw-ink)' }}>{n}</span>;
}
