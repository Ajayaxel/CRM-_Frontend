'use client';

import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { Users, Plus, X, FileText, LogOut } from 'lucide-react';
import { api, apiErrorMessage } from '@/lib/api';
import { useAuth } from '@/features/foundation/auth';
import { Employee, EmployeePage, STATUS_META, employeeName, EMPLOYEE_DOC_KINDS } from '../hr-client';
import { GenerateDocumentModal } from '@/features/capabilities/documents-studio';

const card: React.CSSProperties = { background: 'var(--surface)', border: '1px solid var(--line-soft)', borderRadius: 16 };
const money = (n: number) => `₹${(n ?? 0).toLocaleString('en-IN')}`;

/**
 * The people the organisation employs.
 *
 * Deliberately small. This is not an HR system — no leave, no attendance, no
 * appraisal. It exists because the offer letter, experience certificate and
 * salary request are all ABOUT somebody, and until there was a way to record
 * who works here those three documents had a contract and no subject.
 */
export function EmployeesFeature() {
  const qc = useQueryClient();
  const { hasPermission } = useAuth();
  const canManage = hasPermission('hr.manage');
  const [status, setStatus] = useState<'ACTIVE' | 'ALL'>('ACTIVE');
  const [adding, setAdding] = useState(false);
  const [docFor, setDocFor] = useState<Employee | null>(null);

  const { data, isLoading } = useQuery({
    queryKey: ['employees', status],
    queryFn: async () => (await api.get<EmployeePage>(`/hr/employees?status=${status}&take=200`)).data,
  });
  const refresh = () => qc.invalidateQueries({ queryKey: ['employees'] });

  const exit = useMutation({
    mutationFn: (id: string) => api.post(`/hr/employees/${id}/exit`),
    onSuccess: () => { refresh(); toast.success('Recorded as exited'); },
    onError: (e) => toast.error(apiErrorMessage(e)),
  });

  const rows = data?.data ?? [];

  return (
    <div style={{ animation: 'fadeUp .4s ease' }}>
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12, marginBottom: 18 }}>
        <div>
          <h1 style={{ fontSize: 26, fontWeight: 700, letterSpacing: '-.02em', margin: 0 }}>People</h1>
          <p style={{ fontSize: 14, color: 'var(--ink-2)', margin: '6px 0 0' }}>
            Who works here — and who an offer letter or certificate is about.
          </p>
        </div>
        {canManage && <button className="btn-primary" onClick={() => setAdding(true)}><Plus size={15} /> Add person</button>}
      </div>

      <div style={{ display: 'flex', gap: 6, marginBottom: 14 }}>
        {(['ACTIVE', 'ALL'] as const).map((s) => (
          <button key={s} className={status === s ? 'btn-primary' : 'btn-secondary'} style={{ height: 32, fontSize: 12.5 }}
            onClick={() => setStatus(s)}>{s === 'ACTIVE' ? 'Active' : 'Everyone'}</button>
        ))}
        <span style={{ marginLeft: 'auto', alignSelf: 'center', fontSize: 12, color: 'var(--ink-3)' }}>
          {isLoading ? 'Loading…' : `${data?.total ?? 0} on the books`}
        </span>
      </div>

      {!isLoading && rows.length === 0 && (
        <div style={{ ...card, padding: 44, textAlign: 'center', color: 'var(--ink-3)' }}>
          <Users size={30} style={{ opacity: 0.4 }} />
          <div style={{ marginTop: 10, fontSize: 14 }}>Nobody recorded yet.</div>
        </div>
      )}

      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        {rows.map((e) => {
          const st = STATUS_META[e.status] ?? STATUS_META.ACTIVE;
          return (
            <div key={e.id} style={{ ...card, padding: 14, display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
              <div style={{ flex: 1, minWidth: 180 }}>
                <div style={{ fontWeight: 650, fontSize: 14 }}>{employeeName(e)}</div>
                <div style={{ fontSize: 12, color: 'var(--ink-3)', marginTop: 2 }}>
                  {e.role} · joined {e.hireDate ? new Date(e.hireDate).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }) : '—'}
                </div>
              </div>
              <span className="badge" style={{ background: st.bg, color: st.fg, fontSize: 10.5 }}>{st.label}</span>
              <span style={{ fontSize: 13, minWidth: 100, textAlign: 'right' }}>{money(e.baseSalary)}</span>
              <button className="btn-secondary" style={{ height: 30, fontSize: 12 }} onClick={() => setDocFor(e)}>
                <FileText size={13} /> Document
              </button>
              {/* Exiting is a status, not a delete: somebody who has left is
                  exactly who needs an experience certificate. */}
              {canManage && e.status !== 'EXITED' && (
                <button className="btn-secondary" title="Record exit" style={{ height: 30, width: 32, padding: 0, color: 'var(--ink-3)' }}
                  onClick={() => exit.mutate(e.id)}><LogOut size={13} /></button>
              )}
            </div>
          );
        })}
      </div>

      {adding && <AddEmployeeModal onClose={() => setAdding(false)} onDone={refresh} />}
      {docFor && (
        <GenerateDocumentModal
          subjectId={docFor.id}
          subjectLabel={employeeName(docFor)}
          kinds={EMPLOYEE_DOC_KINDS.map((k) => ({ key: k.key, label: k.label }))}
          onClose={() => setDocFor(null)}
        />
      )}
    </div>
  );
}

function AddEmployeeModal({ onClose, onDone }: { onClose: () => void; onDone: () => void }) {
  const [f, setF] = useState({ firstName: '', lastName: '', role: '', baseSalary: '', hireDate: '' });
  const set = (k: keyof typeof f, v: string) => setF((s) => ({ ...s, [k]: v }));
  const create = useMutation({
    mutationFn: () => api.post('/hr/employees', {
      firstName: f.firstName, lastName: f.lastName, role: f.role,
      baseSalary: f.baseSalary ? Number(f.baseSalary) : undefined,
      hireDate: f.hireDate || undefined,
    }),
    onSuccess: () => { onDone(); toast.success('Added'); onClose(); },
    onError: (e) => toast.error(apiErrorMessage(e)),
  });
  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 60, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }}>
      <div style={{ position: 'absolute', inset: 0, background: 'rgba(20,15,12,.42)' }} onClick={onClose} />
      <div style={{ ...card, position: 'relative', zIndex: 1, width: 520, maxWidth: '100%', padding: 22, borderRadius: 18 }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
          <div style={{ fontWeight: 700, fontSize: 16 }}>Add person</div>
          <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--ink-3)' }}><X size={20} /></button>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          <div style={{ display: 'flex', gap: 10 }}>
            <div style={{ flex: 1 }}><label className="label">First name</label><input className="input" value={f.firstName} onChange={(e) => set('firstName', e.target.value)} /></div>
            <div style={{ flex: 1 }}><label className="label">Last name</label><input className="input" value={f.lastName} onChange={(e) => set('lastName', e.target.value)} /></div>
          </div>
          <div><label className="label">Job title</label><input className="input" value={f.role} onChange={(e) => set('role', e.target.value)} placeholder="Senior consultant" /></div>
          <div style={{ display: 'flex', gap: 10 }}>
            <div style={{ flex: 1 }}><label className="label">Annual salary ₹</label><input className="input" type="number" value={f.baseSalary} onChange={(e) => set('baseSalary', e.target.value)} /></div>
            <div style={{ flex: 1 }}><label className="label">Joined</label><input className="input" type="date" value={f.hireDate} onChange={(e) => set('hireDate', e.target.value)} /></div>
          </div>
        </div>
        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10, marginTop: 18 }}>
          <button className="btn-secondary" onClick={onClose}>Cancel</button>
          <button className="btn-primary" disabled={!f.firstName || !f.lastName || !f.role || create.isPending} onClick={() => create.mutate()}>Add</button>
        </div>
      </div>
    </div>
  );
}
