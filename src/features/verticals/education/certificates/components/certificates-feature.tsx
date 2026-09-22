'use client';

import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { Award, Plus, Copy, Ban, RotateCcw, Search, BadgeCheck } from 'lucide-react';
import { api, apiErrorMessage } from '@/lib/api';
import { CERT_TYPE_LABEL, CertType, Certificate } from '../certificates-client';

const card: React.CSSProperties = { background: 'var(--surface)', border: '1px solid var(--line-soft)', borderRadius: 16 };
const brand = 'var(--brand,#132376)';
const inp: React.CSSProperties = { padding: '9px 11px', borderRadius: 9, border: '1px solid var(--line-soft)', background: 'var(--surface)', fontSize: 13 };

export function CertificatesFeature() {
  const qc = useQueryClient();
  const [search, setSearch] = useState('');
  const [form, setForm] = useState({ studentId: '', courseId: '', type: 'COMPLETION' as CertType, grade: '' });

  const { data: certs = [], isLoading } = useQuery({ queryKey: ['certificates'], queryFn: async () => (await api.get<Certificate[]>('/certificates')).data });
  const { data: students } = useQuery({ queryKey: ['cert-students', search], queryFn: async () => (await api.get<{ data: any[] }>('/students', { params: { limit: 50, search: search || undefined } })).data });
  const { data: courses } = useQuery({ queryKey: ['cert-courses'], queryFn: async () => { const r = (await api.get<any>('/courses', { params: { limit: 100 } })).data; return r?.data ?? r; } });

  const issue = useMutation({
    mutationFn: async () => (await api.post('/certificates', { studentId: form.studentId, courseId: form.courseId || undefined, type: form.type, grade: form.grade || undefined })).data,
    onSuccess: () => { toast.success('Certificate issued'); setForm({ ...form, grade: '' }); qc.invalidateQueries({ queryKey: ['certificates'] }); },
    onError: (e) => toast.error(apiErrorMessage(e)),
  });
  const revoke = useMutation({
    mutationFn: async (id: string) => (await api.post(`/certificates/${id}/revoke`)).data,
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['certificates'] }); },
    onError: (e) => toast.error(apiErrorMessage(e)),
  });

  const verifyUrl = (code: string) => (typeof window !== 'undefined' ? window.location.origin : '') + '/verify/' + code;
  const studentList = students?.data ?? [];
  const active = certs.filter((c) => !c.revoked).length;

  return (
    <div style={{ animation: 'fadeUp .4s ease' }}>
      <div style={{ marginBottom: 18 }}>
        <h1 style={{ fontSize: 26, fontWeight: 700, letterSpacing: '-.02em', margin: 0 }}>Certificates</h1>
        <p style={{ fontSize: 14, color: 'var(--ink-2)', margin: '6px 0 0' }}>Issue verifiable credentials — each carries a public verification link.</p>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '340px 1fr', gap: 16, alignItems: 'start' }}>
        <div style={{ ...card, padding: 18 }}>
          <div style={{ fontWeight: 700, fontSize: 15, marginBottom: 12 }}>Issue certificate</div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            <div style={{ position: 'relative' }}>
              <Search size={14} style={{ position: 'absolute', left: 10, top: 11, color: 'var(--ink-3)' }} />
              <input placeholder="Search student…" value={search} onChange={(e) => setSearch(e.target.value)} style={{ ...inp, width: '100%', paddingLeft: 32 }} />
            </div>
            <select value={form.studentId} onChange={(e) => setForm({ ...form, studentId: e.target.value })} style={inp} size={1}>
              <option value="">Select student…</option>
              {studentList.map((s: any) => <option key={s.id} value={s.id}>{s.firstName} {s.lastName ?? ''} · {s.admissionNo}</option>)}
            </select>
            <select value={form.courseId} onChange={(e) => setForm({ ...form, courseId: e.target.value })} style={inp}>
              <option value="">No specific course</option>
              {(courses ?? []).map((c: any) => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
            <select value={form.type} onChange={(e) => setForm({ ...form, type: e.target.value as CertType })} style={inp}>
              {(Object.keys(CERT_TYPE_LABEL) as CertType[]).map((t) => <option key={t} value={t}>{CERT_TYPE_LABEL[t]}</option>)}
            </select>
            <input placeholder="Grade (optional, e.g. A+)" value={form.grade} onChange={(e) => setForm({ ...form, grade: e.target.value })} style={inp} />
            <button className="btn-primary" style={{ background: brand }} disabled={!form.studentId || issue.isPending} onClick={() => issue.mutate()}><Plus size={14} /> Issue</button>
          </div>
        </div>

        <div>
          <div style={{ fontSize: 12.5, color: 'var(--ink-3)', marginBottom: 8 }}>{active} active · {certs.length - active} revoked</div>
          <div style={{ ...card, overflow: 'hidden' }}>
            {isLoading ? <div style={{ padding: 40, textAlign: 'center', color: 'var(--ink-3)' }}>Loading…</div>
              : certs.length === 0 ? <div style={{ padding: 40, textAlign: 'center', color: 'var(--ink-3)' }}>No certificates issued yet.</div>
              : certs.map((c) => (
                <div key={c.id} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '12px 14px', borderTop: '1px solid var(--line-soft)', opacity: c.revoked ? 0.55 : 1 }}>
                  <span style={{ width: 38, height: 38, borderRadius: 10, background: 'color-mix(in srgb,' + brand + ' 12%, var(--surface))', color: brand, display: 'flex', alignItems: 'center', justifyContent: 'center' }}><BadgeCheck size={18} /></span>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontWeight: 600, fontSize: 13.5 }}>{c.student?.firstName} {c.student?.lastName ?? ''} <span style={{ color: 'var(--ink-3)', fontWeight: 400, fontSize: 12 }}>· {c.title}</span></div>
                    <div style={{ fontSize: 11.5, color: 'var(--ink-3)' }}>{c.serial} · {c.course?.name ?? 'General'}{c.grade ? ` · Grade ${c.grade}` : ''} · {new Date(c.issuedOn).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })}</div>
                  </div>
                  <span className="badge" style={{ background: 'var(--surface-2)', color: 'var(--ink-3)' }}>{CERT_TYPE_LABEL[c.type]}</span>
                  {c.revoked && <span className="badge" style={{ background: 'var(--danger-bg,#fce8e8)', color: 'var(--danger,#c0392b)' }}>Revoked</span>}
                  <button className="btn-secondary" style={{ height: 30, fontSize: 12 }} onClick={() => { navigator.clipboard?.writeText(verifyUrl(c.code)); toast.success('Verify link copied'); }}><Copy size={13} /> Link</button>
                  <button className="btn-secondary" style={{ height: 30, fontSize: 12, color: c.revoked ? 'var(--ink-2)' : 'var(--danger,#c0392b)' }} onClick={() => revoke.mutate(c.id)}>{c.revoked ? <><RotateCcw size={13} /> Restore</> : <><Ban size={13} /> Revoke</>}</button>
                </div>
              ))}
          </div>
        </div>
      </div>
    </div>
  );
}
