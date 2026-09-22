'use client';

import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { Plus, Shield, Trash2, Ban, CheckCircle2, KeyRound } from 'lucide-react';
import { api, apiErrorMessage } from '@/lib/api';
import { useAuth } from '@/features/foundation/auth';
import { PageHeader } from '@/components/molecules/page-header';
import { Modal } from '@/components/molecules/modal';
import { StatusBadge } from '@/components/atoms/status-badge';
import { RolePermissionsEditor } from '@/components/organisms/role-permissions-editor';
import { cn, formatDate, initials } from '@/lib/utils';
import type { Paginated, RoleRow, UserRow } from '@/lib/types';

export default function UsersPage() {
  const { hasPermission } = useAuth();
  const [tab, setTab] = useState<'members' | 'roles'>('members');

  return (
    <div>
      <PageHeader
        title="Users & Roles"
        description="Manage your team members and their access levels."
      />

      <div className="mb-5 flex gap-1 border-b" style={{ borderColor: 'var(--hairline)' }}>
        {(['members', 'roles'] as const).map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={cn(
              'border-b-2 px-4 py-2 text-sm font-medium capitalize transition',
              tab === t
                ? 'border-brand-600 text-brand-700'
                : 'border-transparent text-[var(--ink-3)] hover:text-[var(--ink)]',
            )}
          >
            {t}
          </button>
        ))}
      </div>

      {tab === 'members' ? <MembersTab canManage={hasPermission('user.manage')} /> : <RolesTab />}
    </div>
  );
}

function MembersTab({ canManage }: { canManage: boolean }) {
  const qc = useQueryClient();
  const { user: me } = useAuth();
  const [inviteOpen, setInviteOpen] = useState(false);
  const [transferFrom, setTransferFrom] = useState<UserRow | null>(null);
  /** Conferring Owner — by transfer or by role change — needs an Owner. */
  const iAmOwner = me?.role.name === 'Owner';

  const { data, isLoading } = useQuery({
    queryKey: ['users'],
    queryFn: async () => (await api.get<Paginated<UserRow>>('/users?limit=100')).data,
  });
  const { data: roles } = useQuery({
    queryKey: ['roles'],
    queryFn: async () => (await api.get<RoleRow[]>('/roles')).data,
  });

  const setStatus = useMutation({
    mutationFn: ({ id, status }: { id: string; status: string }) =>
      api.patch(`/users/${id}/status`, { status }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['users'] });
      toast.success('User updated');
    },
    onError: (e) => toast.error(apiErrorMessage(e)),
  });

  const remove = useMutation({
    mutationFn: (id: string) => api.delete(`/users/${id}`),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['users'] });
      toast.success('User removed');
    },
    onError: (e) => toast.error(apiErrorMessage(e)),
  });

  return (
    <div>
      {canManage && (
        <div className="mb-4 flex justify-end">
          <button className="btn-primary" onClick={() => setInviteOpen(true)}>
            <Plus className="h-4 w-4" /> Invite user
          </button>
        </div>
      )}

      <div className="card overflow-hidden">
        <table className="w-full text-sm">
          <thead
            className="border-b text-left text-xs uppercase tracking-wider"
            style={{ borderColor: 'var(--hairline)', background: 'var(--surface-2)', color: 'var(--ink-3)' }}
          >
            <tr>
              <th className="px-5 py-3 font-medium">Name</th>
              <th className="px-5 py-3 font-medium">Role</th>
              <th className="px-5 py-3 font-medium">Status</th>
              <th className="px-5 py-3 font-medium">Last login</th>
              {canManage && <th className="px-5 py-3 font-medium text-right">Actions</th>}
            </tr>
          </thead>
          <tbody className="divide-y [&>tr]:border-[var(--hairline)]">
            {isLoading && (
              <tr><td colSpan={5} className="px-5 py-8 text-center" style={{ color: 'var(--ink-2)' }}>Loading…</td></tr>
            )}
            {data?.data.map((u) => (
              <tr key={u.id} className="hover:bg-[var(--surface-2)]">
                <td className="px-5 py-3">
                  <div className="flex items-center gap-3">
                    <span className="flex h-8 w-8 items-center justify-center rounded-full bg-brand-100 text-xs font-semibold text-brand-700">
                      {initials(u.firstName, u.lastName)}
                    </span>
                    <div>
                      <div className="font-medium" style={{ color: 'var(--ink)' }}>
                        {u.firstName} {u.lastName}
                        {u.id === me?.id && <span className="ml-2 text-xs" style={{ color: 'var(--ink-2)' }}>(You)</span>}
                      </div>
                      <div className="text-xs" style={{ color: 'var(--ink-3)' }}>{u.email}</div>
                    </div>
                  </div>
                </td>
                <td className="px-5 py-3">
                  <span className="inline-flex items-center gap-1" style={{ color: 'var(--ink)' }}>
                    <Shield className="h-3.5 w-3.5" style={{ color: 'var(--ink-2)' }} /> {u.role.name}
                  </span>
                </td>
                <td className="px-5 py-3"><StatusBadge status={u.status} /></td>
                <td className="px-5 py-3" style={{ color: 'var(--ink-3)' }}>{formatDate(u.lastLoginAt)}</td>
                {canManage && (
                  <td className="px-5 py-3">
                    <div className="flex items-center justify-end gap-1">
                      {/* An Owner cannot be suspended or removed — those are
                          refused server-side — so the row offered nothing at
                          all. Handing ownership on is the operation that DOES
                          apply to it, and it was reachable only by calling the
                          API twice in the right order. */}
                      {u.role.name === 'Owner' && iAmOwner && (
                        <button
                          className="btn-ghost px-2 py-1"
                          onClick={() => setTransferFrom(u)}
                          title="Transfer ownership"
                        >
                          <KeyRound className="h-4 w-4" />
                        </button>
                      )}
                      {u.role.name !== 'Owner' && u.id !== me?.id && (
                        <>
                          {u.status === 'SUSPENDED' ? (
                            <button
                              className="btn-ghost px-2 py-1 text-emerald-600"
                              onClick={() => setStatus.mutate({ id: u.id, status: 'ACTIVE' })}
                              title="Reactivate"
                            >
                              <CheckCircle2 className="h-4 w-4" />
                            </button>
                          ) : (
                            <button
                              className="btn-ghost px-2 py-1 text-amber-600"
                              onClick={() => setStatus.mutate({ id: u.id, status: 'SUSPENDED' })}
                              title="Suspend"
                            >
                              <Ban className="h-4 w-4" />
                            </button>
                          )}
                          <button
                            className="btn-ghost px-2 py-1 text-red-600"
                            onClick={() => {
                              if (confirm(`Remove ${u.firstName}?`)) remove.mutate(u.id);
                            }}
                            title="Remove"
                          >
                            <Trash2 className="h-4 w-4" />
                          </button>
                        </>
                      )}
                    </div>
                  </td>
                )}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <InviteModal open={inviteOpen} onClose={() => setInviteOpen(false)} roles={roles ?? []} />
      <TransferOwnershipModal
        from={transferFrom}
        onClose={() => setTransferFrom(null)}
        members={data?.data ?? []}
        roles={roles ?? []}
      />
    </div>
  );
}

function InviteModal({
  open,
  onClose,
  roles,
}: {
  open: boolean;
  onClose: () => void;
  roles: RoleRow[];
}) {
  const qc = useQueryClient();
  const [email, setEmail] = useState('');
  const [roleId, setRoleId] = useState('');

  const invite = useMutation({
    mutationFn: () => api.post('/users/invite', { email, roleId: roleId || roles[0]?.id }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['users'] });
      toast.success('Invitation sent');
      setEmail('');
      onClose();
    },
    onError: (e) => toast.error(apiErrorMessage(e)),
  });

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Invite a team member"
      footer={
        <>
          <button className="btn-secondary" onClick={onClose}>Cancel</button>
          <button
            className="btn-primary"
            disabled={!email || invite.isPending}
            onClick={() => invite.mutate()}
          >
            {invite.isPending ? 'Sending…' : 'Send invite'}
          </button>
        </>
      }
    >
      <div className="space-y-4">
        <div>
          <label className="label">Email address</label>
          <input
            className="input"
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="name@institute.edu"
          />
        </div>
        <div>
          <label className="label">Role</label>
          <select className="input" value={roleId} onChange={(e) => setRoleId(e.target.value)}>
            {roles
              /* Owner is never offered here, and the server now refuses it
                 from anyone who is not already an Owner. Ownership moves
                 through the transfer flow, not through an invitation. */
              .filter((r) => r.name !== 'Owner')
              .map((r) => (
                <option key={r.id} value={r.id}>{r.name}</option>
              ))}
          </select>
        </div>
      </div>
    </Modal>
  );
}

function RolesTab() {
  return <RolePermissionsEditor />;
}

/**
 * Ownership hand-over.
 *
 * Eligibility is shown BEFORE anything is clicked: only accounts that are
 * active and hold a credential can receive ownership, and the ones that cannot
 * are listed with the reason rather than offered and then refused. The server
 * applies the same test — this exists so the operator is not told "no" by a
 * failed request they could have been told about a moment earlier.
 */
function TransferOwnershipModal({
  from, onClose, members, roles,
}: { from: UserRow | null; onClose: () => void; members: UserRow[]; roles: RoleRow[] }) {
  const qc = useQueryClient();
  const [toUserId, setToUserId] = useState('');
  const [outgoingRoleId, setOutgoingRoleId] = useState('');

  const eligible = members.filter(
    (m) => m.id !== from?.id && m.status === 'ACTIVE' && m.hasPassword !== false && m.role.name !== 'Owner',
  );
  const ineligible = members.filter(
    (m) => m.id !== from?.id && m.role.name !== 'Owner' && !eligible.some((e) => e.id === m.id),
  );
  const outgoingRoles = roles.filter((r) => r.name !== 'Owner');

  const transfer = useMutation({
    mutationFn: () =>
      api.post('/users/transfer-ownership', { toUserId, fromUserId: from!.id, outgoingRoleId }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['users'] });
      toast.success('Ownership transferred');
      setToUserId(''); setOutgoingRoleId(''); onClose();
    },
    onError: (e) => toast.error(apiErrorMessage(e)),
  });

  return (
    <Modal open={!!from} onClose={onClose} title="Transfer ownership">
      <div className="space-y-4">
        <p className="text-sm" style={{ color: 'var(--ink-2)' }}>
          <b>{from?.firstName} {from?.lastName}</b> gives up the Owner role. Every
          organisation must keep an owner who can sign in, so this happens in one step.
        </p>

        <div>
          <label className="label">New owner</label>
          <select className="input" value={toUserId} onChange={(e) => setToUserId(e.target.value)}>
            <option value="">Choose a member…</option>
            {eligible.map((m) => (
              <option key={m.id} value={m.id}>{m.firstName} {m.lastName} · {m.email}</option>
            ))}
          </select>
          {eligible.length === 0 && (
            <div className="mt-2 text-xs" style={{ color: 'var(--danger)' }}>
              Nobody here can take ownership yet. An owner has to be able to sign in.
            </div>
          )}
          {ineligible.length > 0 && (
            <div className="mt-2 text-xs" style={{ color: 'var(--ink-3)' }}>
              Not eligible:{' '}
              {ineligible.map((m) => `${m.email} (${m.status === 'SUSPENDED' ? 'suspended' : 'has not accepted their invitation'})`).join(', ')}
            </div>
          )}
        </div>

        <div>
          <label className="label">{from?.firstName} becomes</label>
          <select className="input" value={outgoingRoleId} onChange={(e) => setOutgoingRoleId(e.target.value)}>
            <option value="">Choose a role…</option>
            {outgoingRoles.map((r) => <option key={r.id} value={r.id}>{r.name}</option>)}
          </select>
        </div>

        <div className="flex justify-end gap-2 pt-2">
          <button className="btn-secondary" onClick={onClose}>Cancel</button>
          <button
            className="btn-primary"
            disabled={!toUserId || !outgoingRoleId || transfer.isPending}
            onClick={() => transfer.mutate()}
          >
            {transfer.isPending ? 'Transferring…' : 'Transfer ownership'}
          </button>
        </div>
      </div>
    </Modal>
  );
}
