'use client';

import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { Users, GraduationCap, UserCog, Send, RotateCcw, Ban, Plus, X, Copy, ChevronRight, ChevronDown, Trash2, Search } from 'lucide-react';
import { api, apiErrorMessage } from '@/lib/api';
import { AdminFaculty, AdminGuardian, AdminStudent, InviteResult, PortalAccount, PortalStatus, PortalType, STATUS_META, TYPE_META, fmtDate } from '../portal-admin-client';

const card: React.CSSProperties = { background: 'var(--surface)', border: '1px solid var(--line-soft)', borderRadius: 16 };
const brand = 'var(--brand,#132376)';
const TABS = [['accounts', 'All accounts', UserCog], ['students', 'Students & parents', Users], ['lecturers', 'Lecturers', GraduationCap]] as const;

function StatusBadge({ status }: { status: PortalStatus }) {
  const m = STATUS_META[status];
  return <span className="badge" style={{ background: m.bg, color: m.fg }}>{m.label}</span>;
}
function TypeBadge({ type }: { type: PortalType }) {
  const m = TYPE_META[type];
  return <span className="badge" style={{ background: m.bg, color: m.fg }}>{m.label}</span>;
}

/** The portal lives in this same app, so rebase the API-generated link onto the
 *  origin the admin is actually browsing (dev :3401, prod domain, …) — a copied
 *  link then always works regardless of the server's WEB_ORIGIN setting. */
function localizeLink(url: string) {
  try {
    const u = new URL(url);
    return `${window.location.origin}${u.pathname}${u.search}`;
  } catch {
    return url;
  }
}

/** Activation links aren't emailed in demo — surface them so the admin can copy & share. */
function useInviteLink() {
  const [raw, setLink] = useState<InviteResult | null>(null);
  const link = raw ? { ...raw, link: localizeLink(raw.link) } : null;
  const node = link ? (
    <div style={{ position: 'fixed', inset: 0, zIndex: 60, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }}>
      <div style={{ position: 'absolute', inset: 0, background: 'rgba(20,15,12,.5)' }} onClick={() => setLink(null)} />
      <div style={{ ...card, position: 'relative', zIndex: 1, width: 520, maxWidth: '100%', padding: 24 }}>
        <button onClick={() => setLink(null)} style={{ position: 'absolute', top: 14, right: 14, background: 'none', border: 'none', cursor: 'pointer', color: 'var(--ink-3)' }}><X size={18} /></button>
        <div style={{ fontWeight: 700, fontSize: 16 }}>Activation link ready</div>
        <div style={{ fontSize: 13, color: 'var(--ink-3)', marginTop: 4 }}>{link.name ? `${link.name} · ` : ''}{link.email}</div>
        <div style={{ marginTop: 14, display: 'flex', gap: 8 }}>
          <input readOnly value={link.link} style={{ flex: 1, padding: '9px 11px', borderRadius: 9, border: '1px solid var(--line-soft)', background: 'var(--surface-2)', fontSize: 12.5, fontFamily: 'var(--mono)' }} />
          <button className="btn-primary" style={{ background: brand }} onClick={() => { navigator.clipboard?.writeText(link.link); toast.success('Link copied'); }}><Copy size={14} /> Copy</button>
        </div>
        <div style={{ fontSize: 11.5, color: 'var(--ink-3)', marginTop: 10 }}>Send this to the recipient — they set their password and their portal goes live.</div>
      </div>
    </div>
  ) : null;
  return { show: setLink, node };
}

export function PortalAdminFeature() {
  const [tab, setTab] = useState<(typeof TABS)[number][0]>('accounts');
  const invite = useInviteLink();
  return (
    <div style={{ animation: 'fadeUp .4s ease' }}>
      <div style={{ marginBottom: 18 }}>
        <h1 style={{ fontSize: 26, fontWeight: 700, letterSpacing: '-.02em', margin: 0 }}>Portal accounts</h1>
        <p style={{ fontSize: 14, color: 'var(--ink-2)', margin: '6px 0 0' }}>Invite and manage student, parent and lecturer logins for the learning portal.</p>
      </div>
      <div style={{ display: 'flex', gap: 6, marginBottom: 16, flexWrap: 'wrap' }}>
        {TABS.map(([k, l, Ic]) => <button key={k} className="btn-secondary" style={{ height: 36, fontSize: 12.5, borderColor: tab === k ? brand : undefined, color: tab === k ? brand : undefined }} onClick={() => setTab(k)}><Ic size={14} /> {l}</button>)}
      </div>
      {tab === 'accounts' && <AccountsTab onLink={invite.show} />}
      {tab === 'students' && <StudentsTab onLink={invite.show} />}
      {tab === 'lecturers' && <LecturersTab onLink={invite.show} />}
      {invite.node}
    </div>
  );
}

// ===================== All accounts =====================
function AccountsTab({ onLink }: { onLink: (r: InviteResult) => void }) {
  const qc = useQueryClient();
  const [filter, setFilter] = useState<'ALL' | PortalType>('ALL');
  const { data: accounts = [], isLoading } = useQuery({ queryKey: ['portal-accounts'], queryFn: async () => (await api.get<PortalAccount[]>('/portal-accounts')).data });

  const resend = useMutation({
    mutationFn: async (id: string) => (await api.post<{ link: string }>(`/portal-accounts/${id}/resend`)).data,
    onSuccess: (d, id) => { const a = accounts.find((x) => x.id === id); onLink({ link: d.link, name: a?.name, email: a?.email }); },
    onError: (e) => toast.error(apiErrorMessage(e)),
  });
  const revoke = useMutation({
    mutationFn: async (id: string) => (await api.post(`/portal-accounts/${id}/revoke`)).data,
    onSuccess: () => { toast.success('Access revoked'); qc.invalidateQueries({ queryKey: ['portal-accounts'] }); },
    onError: (e) => toast.error(apiErrorMessage(e)),
  });

  const counts = { total: accounts.length, active: accounts.filter((a) => a.status === 'ACTIVE').length, invited: accounts.filter((a) => a.status === 'INVITED').length, disabled: accounts.filter((a) => a.status === 'DISABLED').length };
  const rows = filter === 'ALL' ? accounts : accounts.filter((a) => a.type === filter);

  return (
    <div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 12, marginBottom: 16 }}>
        {[['Accounts', counts.total, 'var(--ink-1)'], ['Active', counts.active, 'var(--success,#1e874b)'], ['Invited', counts.invited, 'var(--gold,#c67c1e)'], ['Disabled', counts.disabled, 'var(--danger,#c0392b)']].map(([l, v, c]) => (
          <div key={l as string} style={{ ...card, padding: 16 }}><div style={{ fontSize: 26, fontWeight: 800, color: c as string }}>{v as number}</div><div style={{ fontSize: 12.5, color: 'var(--ink-3)', fontWeight: 600 }}>{l}</div></div>
        ))}
      </div>
      <div style={{ display: 'flex', gap: 6, marginBottom: 12 }}>
        {(['ALL', 'STUDENT', 'PARENT', 'LECTURER'] as const).map((t) => (
          <button key={t} onClick={() => setFilter(t)} style={{ border: 'none', cursor: 'pointer', borderRadius: 99, padding: '6px 14px', fontSize: 12.5, fontWeight: 600, background: filter === t ? brand : 'var(--surface-2)', color: filter === t ? '#fff' : 'var(--ink-2)' }}>{t === 'ALL' ? 'All' : TYPE_META[t].label}</button>
        ))}
      </div>
      <div style={{ ...card, overflow: 'hidden' }}>
        {isLoading ? <div style={{ padding: 40, textAlign: 'center', color: 'var(--ink-3)' }}>Loading…</div>
          : rows.length === 0 ? <div style={{ padding: 40, textAlign: 'center', color: 'var(--ink-3)' }}>No accounts yet. Invite students, parents and lecturers from the other tabs.</div>
          : (
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
              <thead><tr style={{ background: 'var(--surface-2)' }}>
                {['Name', 'Type', 'Status', 'Invited', 'Last login', ''].map((h) => <th key={h} style={{ textAlign: 'left', padding: '10px 14px', fontSize: 11, textTransform: 'uppercase', letterSpacing: '.05em', color: 'var(--ink-3)', fontWeight: 700 }}>{h}</th>)}
              </tr></thead>
              <tbody>
                {rows.map((a) => (
                  <tr key={a.id} style={{ borderTop: '1px solid var(--line-soft)' }}>
                    <td style={{ padding: '10px 14px' }}><div style={{ fontWeight: 600 }}>{a.name}</div><div style={{ fontSize: 11.5, color: 'var(--ink-3)' }}>{a.email}</div></td>
                    <td style={{ padding: '10px 14px' }}><TypeBadge type={a.type} /></td>
                    <td style={{ padding: '10px 14px' }}><StatusBadge status={a.status} /></td>
                    <td style={{ padding: '10px 14px', color: 'var(--ink-3)' }}>{fmtDate(a.invitedAt)}</td>
                    <td style={{ padding: '10px 14px', color: 'var(--ink-3)' }}>{fmtDate(a.lastLoginAt)}</td>
                    <td style={{ padding: '10px 14px', textAlign: 'right', whiteSpace: 'nowrap' }}>
                      <button className="btn-secondary" style={{ height: 30, fontSize: 12 }} disabled={resend.isPending} onClick={() => resend.mutate(a.id)}><RotateCcw size={13} /> Resend</button>
                      {a.status !== 'DISABLED' && <button className="btn-secondary" style={{ height: 30, fontSize: 12, marginLeft: 6, color: 'var(--danger,#c0392b)' }} disabled={revoke.isPending} onClick={() => revoke.mutate(a.id)}><Ban size={13} /> Revoke</button>}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
      </div>
    </div>
  );
}

// ===================== Students & parents =====================
function StudentsTab({ onLink }: { onLink: (r: InviteResult) => void }) {
  const qc = useQueryClient();
  const [search, setSearch] = useState('');
  const [expanded, setExpanded] = useState<string | null>(null);
  const { data, isLoading } = useQuery({ queryKey: ['admin-students', search], queryFn: async () => (await api.get<{ data: AdminStudent[] }>('/students', { params: { limit: 100, search: search || undefined } })).data });
  const { data: accounts = [] } = useQuery({ queryKey: ['portal-accounts'], queryFn: async () => (await api.get<PortalAccount[]>('/portal-accounts')).data });
  const byStudent = new Map(accounts.filter((a) => a.studentId).map((a) => [a.studentId, a]));
  const byGuardian = new Map(accounts.filter((a) => a.guardianId).map((a) => [a.guardianId, a]));

  const inviteStudent = useMutation({
    mutationFn: async (id: string) => (await api.post<InviteResult>(`/portal-accounts/students/${id}/invite`)).data,
    onSuccess: (d) => { onLink(d); qc.invalidateQueries({ queryKey: ['portal-accounts'] }); },
    onError: (e) => toast.error(apiErrorMessage(e)),
  });
  const students = data?.data ?? [];

  return (
    <div>
      <div style={{ position: 'relative', marginBottom: 12, maxWidth: 340 }}>
        <Search size={15} style={{ position: 'absolute', left: 11, top: 10, color: 'var(--ink-3)' }} />
        <input placeholder="Search students…" value={search} onChange={(e) => setSearch(e.target.value)} style={{ width: '100%', padding: '8px 11px 8px 34px', borderRadius: 9, border: '1px solid var(--line-soft)', background: 'var(--surface)', fontSize: 13 }} />
      </div>
      <div style={{ ...card, overflow: 'hidden' }}>
        {isLoading ? <div style={{ padding: 40, textAlign: 'center', color: 'var(--ink-3)' }}>Loading…</div>
          : students.length === 0 ? <div style={{ padding: 40, textAlign: 'center', color: 'var(--ink-3)' }}>No students found.</div>
          : students.map((s) => {
            const acc = byStudent.get(s.id);
            const open = expanded === s.id;
            return (
              <div key={s.id} style={{ borderTop: '1px solid var(--line-soft)' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 14px' }}>
                  <button onClick={() => setExpanded(open ? null : s.id)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--ink-3)', display: 'flex' }}>{open ? <ChevronDown size={16} /> : <ChevronRight size={16} />}</button>
                  <div style={{ flex: 1 }}><div style={{ fontWeight: 600, fontSize: 13.5 }}>{s.firstName} {s.lastName ?? ''} <span style={{ fontFamily: 'var(--mono)', fontSize: 11, color: 'var(--ink-3)' }}>{s.admissionNo}</span></div><div style={{ fontSize: 11.5, color: 'var(--ink-3)' }}>{s.email || 'no email on file'}</div></div>
                  {acc ? <StatusBadge status={acc.status} /> : <span className="badge" style={{ background: 'var(--surface-2)', color: 'var(--ink-3)' }}>No login</span>}
                  <button className="btn-secondary" style={{ height: 30, fontSize: 12 }} disabled={inviteStudent.isPending} onClick={() => inviteStudent.mutate(s.id)}><Send size={13} /> {acc ? 'Re-invite' : 'Invite'}</button>
                </div>
                {open && <GuardianRows studentId={s.id} byGuardian={byGuardian} onLink={onLink} />}
              </div>
            );
          })}
      </div>
    </div>
  );
}

function GuardianRows({ studentId, byGuardian, onLink }: { studentId: string; byGuardian: Map<any, PortalAccount>; onLink: (r: InviteResult) => void }) {
  const qc = useQueryClient();
  const { data, isLoading } = useQuery({ queryKey: ['admin-student-detail', studentId], queryFn: async () => (await api.get<any>(`/students/${studentId}`)).data });
  const inviteGuardian = useMutation({
    mutationFn: async (id: string) => (await api.post<InviteResult>(`/portal-accounts/guardians/${id}/invite`)).data,
    onSuccess: (d) => { onLink(d); qc.invalidateQueries({ queryKey: ['portal-accounts'] }); },
    onError: (e) => toast.error(apiErrorMessage(e)),
  });
  const guardians: AdminGuardian[] = (data?.guardians ?? []).map((g: any) => ({ id: g.guardian?.id ?? g.guardianId ?? g.id, name: g.guardian?.name ?? g.name, email: g.guardian?.email ?? g.email, relation: g.guardian?.relation ?? g.relation, isPrimary: g.isPrimary }));

  return (
    <div style={{ background: 'var(--surface-2)', padding: '4px 14px 12px 40px' }}>
      <div style={{ fontSize: 11, letterSpacing: '.06em', textTransform: 'uppercase', color: 'var(--ink-3)', fontWeight: 700, margin: '8px 0 6px' }}>Guardians</div>
      {isLoading ? <div style={{ fontSize: 12.5, color: 'var(--ink-3)' }}>Loading…</div>
        : guardians.length === 0 ? <div style={{ fontSize: 12.5, color: 'var(--ink-3)' }}>No guardians linked to this student.</div>
        : guardians.map((g) => {
          const acc = byGuardian.get(g.id);
          return (
            <div key={g.id} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '7px 0' }}>
              <div style={{ flex: 1 }}><div style={{ fontWeight: 600, fontSize: 13 }}>{g.name} {g.isPrimary && <span style={{ fontSize: 10.5, color: brand }}>· primary</span>}</div><div style={{ fontSize: 11.5, color: 'var(--ink-3)' }}>{g.relation ?? 'Guardian'} · {g.email || 'no email on file'}</div></div>
              {acc ? <StatusBadge status={acc.status} /> : <span className="badge" style={{ background: 'var(--surface)', color: 'var(--ink-3)' }}>No login</span>}
              <button className="btn-secondary" style={{ height: 28, fontSize: 11.5 }} disabled={inviteGuardian.isPending} onClick={() => inviteGuardian.mutate(g.id)}><Send size={12} /> {acc ? 'Re-invite' : 'Invite'}</button>
            </div>
          );
        })}
    </div>
  );
}

// ===================== Lecturers =====================
function LecturersTab({ onLink }: { onLink: (r: InviteResult) => void }) {
  const qc = useQueryClient();
  const [adding, setAdding] = useState(false);
  const [f, setF] = useState({ name: '', email: '', department: '', designation: '' });
  const { data: faculty = [], isLoading } = useQuery({ queryKey: ['admin-faculty'], queryFn: async () => (await api.get<AdminFaculty[]>('/faculty')).data });

  const create = useMutation({
    mutationFn: async () => (await api.post('/faculty', { name: f.name, email: f.email || undefined, department: f.department || undefined, designation: f.designation || undefined })).data,
    onSuccess: () => { toast.success('Lecturer added'); setF({ name: '', email: '', department: '', designation: '' }); setAdding(false); qc.invalidateQueries({ queryKey: ['admin-faculty'] }); },
    onError: (e) => toast.error(apiErrorMessage(e)),
  });
  const invite = useMutation({
    mutationFn: async (id: string) => (await api.post<InviteResult>(`/faculty/${id}/invite`)).data,
    onSuccess: (d) => { onLink(d); qc.invalidateQueries({ queryKey: ['admin-faculty'] }); },
    onError: (e) => toast.error(apiErrorMessage(e)),
  });
  const remove = useMutation({
    mutationFn: async (id: string) => (await api.delete(`/faculty/${id}`)).data,
    onSuccess: () => { toast.success('Lecturer removed'); qc.invalidateQueries({ queryKey: ['admin-faculty'] }); },
    onError: (e) => toast.error(apiErrorMessage(e)),
  });
  const inp: React.CSSProperties = { padding: '8px 10px', borderRadius: 9, border: '1px solid var(--line-soft)', background: 'var(--surface)', fontSize: 13 };

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 12 }}>
        <button className="btn-primary" style={{ background: brand }} onClick={() => setAdding((v) => !v)}>{adding ? <X size={14} /> : <Plus size={14} />} {adding ? 'Cancel' : 'Add lecturer'}</button>
      </div>
      {adding && (
        <div style={{ ...card, padding: 16, marginBottom: 14, display: 'grid', gridTemplateColumns: 'repeat(2,1fr)', gap: 10 }}>
          <input placeholder="Full name" value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} style={inp} />
          <input placeholder="Email" value={f.email} onChange={(e) => setF({ ...f, email: e.target.value })} style={inp} />
          <input placeholder="Department" value={f.department} onChange={(e) => setF({ ...f, department: e.target.value })} style={inp} />
          <input placeholder="Designation" value={f.designation} onChange={(e) => setF({ ...f, designation: e.target.value })} style={inp} />
          <div style={{ gridColumn: '1 / -1' }}><button className="btn-primary" style={{ background: brand }} disabled={!f.name || create.isPending} onClick={() => create.mutate()}><Plus size={14} /> Save lecturer</button></div>
        </div>
      )}
      <div style={{ ...card, overflow: 'hidden' }}>
        {isLoading ? <div style={{ padding: 40, textAlign: 'center', color: 'var(--ink-3)' }}>Loading…</div>
          : faculty.length === 0 ? <div style={{ padding: 40, textAlign: 'center', color: 'var(--ink-3)' }}>No lecturers yet.</div>
          : faculty.map((fac) => (
            <div key={fac.id} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '11px 14px', borderTop: '1px solid var(--line-soft)' }}>
              <span style={{ width: 36, height: 36, borderRadius: 10, background: TYPE_META.LECTURER.bg, color: TYPE_META.LECTURER.fg, display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 800, fontSize: 13 }}>{fac.name.slice(0, 1)}</span>
              <div style={{ flex: 1 }}><div style={{ fontWeight: 600, fontSize: 13.5 }}>{fac.name}</div><div style={{ fontSize: 11.5, color: 'var(--ink-3)' }}>{[fac.designation, fac.department].filter(Boolean).join(' · ') || 'Lecturer'} · {fac.email || 'no email on file'}</div></div>
              {fac.portalUser ? <StatusBadge status={fac.portalUser.status} /> : <span className="badge" style={{ background: 'var(--surface-2)', color: 'var(--ink-3)' }}>No login</span>}
              <button className="btn-secondary" style={{ height: 30, fontSize: 12 }} disabled={invite.isPending} onClick={() => invite.mutate(fac.id)}><Send size={13} /> {fac.portalUser ? 'Re-invite' : 'Invite'}</button>
              <button className="btn-secondary" style={{ height: 30, width: 34, padding: 0, color: 'var(--danger,#c0392b)' }} disabled={remove.isPending} onClick={() => remove.mutate(fac.id)}><Trash2 size={13} /></button>
            </div>
          ))}
      </div>
    </div>
  );
}
