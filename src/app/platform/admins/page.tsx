'use client';

import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { Plus, X, Copy, ShieldCheck } from 'lucide-react';
import { platformApi, usePlatformAuth } from '@/features/platform/platform-client';
import { PLATFORM_ROLES, PlatformRoleName } from '@/features/platform/capabilities';
import { RequireCapability } from '@/features/platform/require-capability';
import { apiErrorMessage } from '@/lib/api';

const card: React.CSSProperties = {
  background: 'var(--surface)', border: '1px solid var(--line-soft)', borderRadius: 16, boxShadow: 'var(--shadow-1)',
};
const mono: React.CSSProperties = {
  fontFamily: 'var(--mono)', fontSize: 10, letterSpacing: '.1em', textTransform: 'uppercase', color: 'var(--ink-3)',
};

interface Admin {
  id: string; email: string; name: string; role: PlatformRoleName;
  active: boolean; lastLoginAt: string | null; createdAt: string;
}

const ROLE_BLURB: Record<PlatformRoleName, string> = {
  SUPER_ADMIN: 'Everything, including plans, entitlements, suspension and this page.',
  ONBOARDING: 'Provision organisations and work the onboarding funnel.',
  SUPPORT: 'Read organisations. No changes.',
};

/**
 * Who can get into the console, and as what.
 *
 * The endpoints have existed since Step 1 and nothing called them, so the only
 * ways to add a colleague or revoke a leaver were a shell script and a database
 * client. Neither leaves a trace anybody reads — and both are things a person
 * does at the moment they are least inclined to be careful.
 */
export default function AdminsPage() {
  return (
    <RequireCapability capability="admins.manage">
      <AdminsBody />
    </RequireCapability>
  );
}

function AdminsBody() {
  const qc = useQueryClient();
  const meId = usePlatformAuth((s) => s.admin?.id);
  const [creating, setCreating] = useState(false);

  const { data: admins, isLoading } = useQuery({
    queryKey: ['pf-admins'],
    queryFn: async () => (await platformApi.get('/admins')).data as Admin[],
  });

  const setRole = useMutation({
    mutationFn: ({ id, role }: { id: string; role: PlatformRoleName }) =>
      platformApi.patch(`/admins/${id}/role`, { role }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['pf-admins'] });
      qc.invalidateQueries({ queryKey: ['pf-audit'] });
      // Your OWN role may have just changed, and the nav, landing page and
      // every control derive from it. Re-read rather than leave the console
      // describing a role you no longer hold.
      qc.invalidateQueries({ queryKey: ['pf-me'] });
      platformApi.get('/auth/me').then((r) => usePlatformAuth.getState().setAdmin(r.data)).catch(() => undefined);
      toast.success('Role updated');
    },
    // The server refuses to demote the last active super admin. Show its
    // reason: it explains a policy, not a mistake.
    onError: (e) => toast.error(apiErrorMessage(e)),
  });

  const setActive = useMutation({
    mutationFn: ({ id, active }: { id: string; active: boolean }) =>
      platformApi.patch(`/admins/${id}/active`, { active }),
    onSuccess: (_r, v) => {
      qc.invalidateQueries({ queryKey: ['pf-admins'] });
      qc.invalidateQueries({ queryKey: ['pf-audit'] });
      toast.success(v.active ? 'Administrator reactivated' : 'Administrator deactivated');
    },
    // The server refuses to deactivate the last active admin. Show the reason
    // it gives rather than a generic failure — it is the one message here that
    // explains a policy instead of a mistake.
    onError: (e) => toast.error(apiErrorMessage(e)),
  });

  const activeCount = (admins ?? []).filter((a) => a.active).length;
  const activeSupers = (admins ?? []).filter((a) => a.active && a.role === 'SUPER_ADMIN').length;
  /** The server enforces this; disabling the control saves finding out by trying. */
  const onlySuper = (a: Admin) => a.active && a.role === 'SUPER_ADMIN' && activeSupers === 1;

  return (
    <div style={{ animation: 'fadeUp .4s ease' }}>
      <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', gap: 16, marginBottom: 22 }}>
        <div>
          <h1 style={{ fontSize: 26, fontWeight: 700, letterSpacing: '-.02em', margin: 0 }}>Administrators</h1>
          <p style={{ fontSize: 14, color: 'var(--ink-2)', margin: '6px 0 0' }}>
            Who can sign in to this console, and what each of them may do.
          </p>
        </div>
        <button className="btn-primary" onClick={() => setCreating(true)}><Plus size={16} /> Add administrator</button>
      </div>

      <div style={{ ...card, overflow: 'hidden' }}>
        <div style={{ display: 'grid', gridTemplateColumns: '1.8fr 1.4fr 1fr 1fr', gap: 12, padding: '13px 20px', borderBottom: '1px solid var(--line-soft)', ...mono }}>
          <div>Administrator</div><div>Role</div><div>Last signed in</div><div style={{ textAlign: 'right' }}>Access</div>
        </div>

        {isLoading && <div style={{ padding: 40, textAlign: 'center', color: 'var(--ink-3)' }}>Loading…</div>}

        {admins?.map((a) => {
          const isSelf = a.id === meId;
          // The server also refuses this; disabling the control means the
          // operator does not have to click to find out.
          const lastActive = a.active && activeCount === 1;
          return (
            <div key={a.id} style={{ display: 'grid', gridTemplateColumns: '1.8fr 1.4fr 1fr 1fr', gap: 12, padding: '14px 20px', borderBottom: '1px solid var(--line-soft)', alignItems: 'center' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 11, minWidth: 0 }}>
                <span style={{ width: 34, height: 34, borderRadius: 9, background: 'var(--surface-2)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--ink-2)', flexShrink: 0 }}>
                  <ShieldCheck size={16} />
                </span>
                <div style={{ minWidth: 0 }}>
                  <div style={{ fontWeight: 600, fontSize: 14 }}>
                    {a.name}{isSelf && <span style={{ fontSize: 11.5, color: 'var(--ink-3)', fontWeight: 400 }}> · you</span>}
                  </div>
                  <div style={{ fontSize: 12, color: 'var(--ink-3)', overflow: 'hidden', textOverflow: 'ellipsis' }}>{a.email}</div>
                </div>
              </div>
              <div>
                <select
                  className="input"
                  style={{ height: 32, fontSize: 12.5, maxWidth: 170 }}
                  value={a.role}
                  disabled={setRole.isPending || onlySuper(a)}
                  title={onlySuper(a)
                    ? 'The only active super admin — changing this role would leave nobody able to administer the platform.'
                    : undefined}
                  onChange={(e) => setRole.mutate({ id: a.id, role: e.target.value as PlatformRoleName })}>
                  {PLATFORM_ROLES.map((r) => <option key={r} value={r}>{r.replace('_', ' ')}</option>)}
                </select>
              </div>
              <div style={{ fontSize: 12.5, color: 'var(--ink-3)' }}>
                {a.lastLoginAt ? new Date(a.lastLoginAt).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: '2-digit' }) : 'Never'}
              </div>
              <div style={{ textAlign: 'right' }}>
                <button
                  className="btn-secondary"
                  style={{ height: 32, fontSize: 12.5, color: a.active ? 'var(--danger)' : undefined }}
                  disabled={setActive.isPending || lastActive}
                  title={lastActive ? 'The only active administrator cannot be deactivated.' : undefined}
                  onClick={() => setActive.mutate({ id: a.id, active: !a.active })}>
                  {a.active ? 'Deactivate' : 'Reactivate'}
                </button>
              </div>
            </div>
          );
        })}
      </div>

      {creating && <CreateAdminModal onClose={() => setCreating(false)} />}
    </div>
  );
}

function CreateAdminModal({ onClose }: { onClose: () => void }) {
  const qc = useQueryClient();
  const [form, setForm] = useState<{ name: string; email: string; role: PlatformRoleName }>({
    name: '', email: '', role: 'ONBOARDING',
  });
  const [created, setCreated] = useState<{ email: string; temporaryPassword: string } | null>(null);

  const create = useMutation({
    // No password field: the server generates one and returns it once. Asking
    // an operator to invent a colleague's password produces weak ones and puts
    // a credential in a request body that did not need to carry it.
    mutationFn: () => platformApi.post('/admins', form),
    onSuccess: (r) => {
      qc.invalidateQueries({ queryKey: ['pf-admins'] });
      qc.invalidateQueries({ queryKey: ['pf-audit'] });
      setCreated(r.data);
    },
    onError: (e) => toast.error(apiErrorMessage(e)),
  });

  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 60, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }}>
      <div style={{ position: 'absolute', inset: 0, background: 'rgba(20,15,12,.42)' }} onClick={onClose} />
      <div style={{ ...card, position: 'relative', zIndex: 1, width: 460, maxWidth: '100%', padding: 24, borderRadius: 18 }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
          <div style={{ fontWeight: 700, fontSize: 16 }}>{created ? 'Administrator added' : 'Add administrator'}</div>
          <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--ink-3)' }}><X size={18} /></button>
        </div>

        {created ? (
          <>
            <p style={{ fontSize: 13.5, color: 'var(--ink-2)', lineHeight: 1.6, marginTop: 0 }}>
              This password is shown once and is not stored anywhere in readable form.
              Send it to <b>{created.email}</b> and have them change it on first sign-in.
            </p>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, background: 'var(--surface-2)', borderRadius: 10, padding: '12px 14px', fontFamily: 'var(--mono)', fontSize: 14 }}>
              <span style={{ flex: 1, wordBreak: 'break-all' }}>{created.temporaryPassword}</span>
              <button className="btn-secondary" style={{ height: 30 }}
                onClick={() => { navigator.clipboard.writeText(created.temporaryPassword); toast.success('Copied'); }}>
                <Copy size={13} />
              </button>
            </div>
            <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 18 }}>
              <button className="btn-primary" onClick={onClose}>Done</button>
            </div>
          </>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            <div>
              <label className="label">Name</label>
              <input className="input" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
            </div>
            <div>
              <label className="label">Email</label>
              <input className="input" type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />
            </div>
            <div>
              <label className="label">Role</label>
              <select className="input" value={form.role} onChange={(e) => setForm({ ...form, role: e.target.value as PlatformRoleName })}>
                {PLATFORM_ROLES.map((r) => <option key={r} value={r}>{r.replace('_', ' ')}</option>)}
              </select>
              <div style={{ fontSize: 11.5, color: 'var(--ink-3)', marginTop: 6, lineHeight: 1.5 }}>{ROLE_BLURB[form.role]}</div>
            </div>
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10, marginTop: 6 }}>
              <button className="btn-secondary" onClick={onClose}>Cancel</button>
              <button className="btn-primary" disabled={!form.name.trim() || !form.email.trim() || create.isPending}
                      onClick={() => create.mutate()}>
                {create.isPending ? 'Adding…' : 'Add administrator'}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
