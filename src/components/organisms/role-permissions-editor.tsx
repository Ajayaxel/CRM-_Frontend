'use client';

import { useEffect, useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { Shield, Lock, Check, Users2 } from 'lucide-react';
import { api, apiErrorMessage } from '@/lib/api';
import { useAuth } from '@/features/foundation/auth';
import type { RoleRow } from '@/lib/types';

interface PermCatalog { key: string; module: string; description: string }

const MODULE_LABELS: Record<string, string> = {
  org: 'Organization', subscription: 'Subscription', settings: 'Settings', audit: 'Audit Logs',
  user: 'Users', role: 'Roles & Permissions', lead: 'Leads', student: 'Students',
  course: 'Courses & Batches', admission: 'Admissions', task: 'Tasks', document: 'Documents', report: 'Reports',
};
const MODULE_ORDER = ['lead', 'student', 'course', 'admission', 'task', 'document', 'report', 'user', 'role', 'org', 'subscription', 'settings', 'audit'];

const card: React.CSSProperties = {
  background: 'var(--surface)', border: '1px solid var(--line-soft)', borderRadius: 16, boxShadow: 'var(--shadow-1)',
};

export function RolePermissionsEditor() {
  const qc = useQueryClient();
  const { user, hasPermission } = useAuth();
  const canManage = hasPermission('role.manage');
  const isGrowthPlus = user?.organization.plan !== 'STARTER';

  const { data: roles } = useQuery({
    queryKey: ['roles'],
    queryFn: async () => (await api.get<RoleRow[]>('/roles')).data,
  });
  const { data: catalog } = useQuery({
    queryKey: ['perm-catalog'],
    queryFn: async () => (await api.get<PermCatalog[]>('/roles/permissions')).data,
  });

  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [checked, setChecked] = useState<Set<string>>(new Set());

  const selected = roles?.find((r) => r.id === selectedId) ?? roles?.[0] ?? null;
  useEffect(() => {
    if (selected) setChecked(new Set(selected.permissions));
  }, [selected?.id, selected?.permissions.join(',')]); // eslint-disable-line react-hooks/exhaustive-deps

  const grouped = useMemo(() => {
    const map = new Map<string, PermCatalog[]>();
    (catalog ?? []).forEach((p) => {
      if (!map.has(p.module)) map.set(p.module, []);
      map.get(p.module)!.push(p);
    });
    return MODULE_ORDER.filter((m) => map.has(m)).map((m) => ({ module: m, perms: map.get(m)! }));
  }, [catalog]);

  const isOwner = selected?.name === 'Owner';
  const editable = canManage && isGrowthPlus && !isOwner;
  const dirty = selected && (checked.size !== selected.permissions.length || selected.permissions.some((p) => !checked.has(p)));

  const save = useMutation({
    mutationFn: () => api.patch(`/roles/${selected!.id}`, { permissionKeys: Array.from(checked) }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['roles'] }); toast.success('Permissions updated'); },
    onError: (e) => toast.error(apiErrorMessage(e)),
  });

  const toggle = (key: string) => {
    if (!editable) return;
    const next = new Set(checked);
    next.has(key) ? next.delete(key) : next.add(key);
    setChecked(next);
  };
  const toggleModule = (perms: PermCatalog[], on: boolean) => {
    if (!editable) return;
    const next = new Set(checked);
    perms.forEach((p) => (on ? next.add(p.key) : next.delete(p.key)));
    setChecked(next);
  };

  return (
    <div>
      {!isGrowthPlus && (
        <div style={{ ...card, padding: '14px 18px', marginBottom: 16, display: 'flex', alignItems: 'center', gap: 12 }}>
          <span style={{ width: 34, height: 34, borderRadius: 9, background: 'var(--gold-bg)', color: 'var(--gold-ink)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}><Lock size={17} /></span>
          <div style={{ fontSize: 13, color: 'var(--ink-2)' }}>
            <strong>Custom role permissions</strong> is a Growth feature. On Starter, the 5 built-in roles use their default access. Upgrade to approve features per role.
          </div>
        </div>
      )}

      <div style={{ display: 'grid', gridTemplateColumns: '230px 1fr', gap: 20, alignItems: 'start' }}>
        {/* Role list */}
        <div style={{ ...card, padding: 8, display: 'flex', flexDirection: 'column', gap: 2 }}>
          {roles?.map((r) => {
            const active = selected?.id === r.id;
            return (
              <button key={r.id} onClick={() => setSelectedId(r.id)}
                style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 12px', borderRadius: 10, border: 'none', cursor: 'pointer', textAlign: 'left', background: active ? 'var(--surface-2)' : 'transparent' }}>
                <Shield size={16} color={active ? 'var(--navy)' : 'var(--ink-3)'} strokeWidth={1.9} />
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 13.5, fontWeight: 600, color: active ? 'var(--ink)' : 'var(--ink-2)' }}>{r.name}</div>
                  <div style={{ fontSize: 11.5, color: 'var(--ink-3)' }}>{r.permissions.length} features · {r.userCount} user{r.userCount === 1 ? '' : 's'}</div>
                </div>
                {r.name === 'Owner' && <Lock size={13} color="var(--ink-3)" />}
              </button>
            );
          })}
        </div>

        {/* Permission checklist */}
        <div style={{ ...card, padding: '20px 22px' }}>
          <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12, marginBottom: 16 }}>
            <div>
              <div style={{ fontWeight: 700, fontSize: 16 }}>{selected?.name} — feature access</div>
              <div style={{ fontSize: 12.5, color: 'var(--ink-3)', marginTop: 2 }}>
                {isOwner ? 'The Owner always has full access to every feature.'
                  : editable ? 'Tick the features this role can use. Users with this role see only what you approve.'
                  : 'Read-only — you need the Roles permission on a Growth plan to edit.'}
              </div>
            </div>
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 12, color: 'var(--ink-3)', flexShrink: 0 }}>
              <Users2 size={14} /> {selected?.userCount ?? 0}
            </span>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px 24px' }}>
            {grouped.map(({ module, perms }) => {
              const allOn = perms.every((p) => isOwner || checked.has(p.key));
              return (
                <div key={module} style={{ paddingBottom: 6 }}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 }}>
                    <div style={{ fontFamily: 'var(--mono)', fontSize: 10, letterSpacing: '.1em', textTransform: 'uppercase', color: 'var(--ink-3)' }}>{MODULE_LABELS[module] ?? module}</div>
                    {editable && (
                      <button onClick={() => toggleModule(perms, !allOn)} style={{ fontSize: 11, color: 'var(--navy)', background: 'none', border: 'none', cursor: 'pointer', fontWeight: 600 }}>
                        {allOn ? 'Clear' : 'All'}
                      </button>
                    )}
                  </div>
                  {perms.map((p) => {
                    const on = isOwner || checked.has(p.key);
                    return (
                      <label key={p.key} onClick={(e) => { e.preventDefault(); toggle(p.key); }}
                        style={{ display: 'flex', alignItems: 'center', gap: 9, padding: '5px 0', cursor: editable ? 'pointer' : 'default' }}>
                        <span style={{ width: 18, height: 18, borderRadius: 5, flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center',
                          background: on ? 'var(--navy)' : 'var(--surface-3)', border: on ? 'none' : '1px solid var(--line)', opacity: editable ? 1 : 0.7 }}>
                          {on && <Check size={12} color="#fff" strokeWidth={3} />}
                        </span>
                        <span style={{ fontSize: 13, color: on ? 'var(--ink)' : 'var(--ink-3)' }}>{p.description}</span>
                      </label>
                    );
                  })}
                </div>
              );
            })}
          </div>

          {editable && (
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10, marginTop: 18, borderTop: '1px solid var(--line-soft)', paddingTop: 16 }}>
              <button className="btn-secondary" disabled={!dirty} onClick={() => setChecked(new Set(selected!.permissions))}>Reset</button>
              <button className="btn-primary" disabled={!dirty || save.isPending} onClick={() => save.mutate()}>
                {save.isPending ? 'Saving…' : `Save ${selected?.name} access`}
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
