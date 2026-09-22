'use client';

import { useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import {
  ChevronLeft, Phone, Mail, BookOpen, Calendar, Trash2, Check, Clock, FileText,
  UploadCloud, UserPlus, CreditCard, Award, Sparkles, Building, User, Download
} from 'lucide-react';
import { api, apiErrorMessage } from '@/lib/api';
import { openDocument } from '@/features/capabilities/documents/document-uploader';
import { useAuth } from '@/features/foundation/auth';
import { Modal } from '@/components/molecules/modal';
import { Field } from '@/components/molecules/field';
import {
  StudentStatus, studentStatusBadgeStyle, formatCurrency, studentName, studentInitials,
  avatarStyle, GENDER_LABELS
} from '../students-utils';
import { formatDate } from '@/lib/utils';

type Tab = 'profile' | 'contact' | 'parent' | 'course' | 'documents' | 'timeline';

export function StudentDetailFeature({ id }: { id: string }) {
  const router = useRouter();
  const qc = useQueryClient();
  const { hasPermission, user: currentUser } = useAuth();
  const [tab, setTab] = useState<Tab>('profile');

  // Modal Open States
  const [isEnrollModalOpen, setIsEnrollModalOpen] = useState(false);
  const [isPaymentModalOpen, setIsPaymentModalOpen] = useState(false);
  const [isGuardianModalOpen, setIsGuardianModalOpen] = useState(false);

  // Fetch Student
  const { data: student, isLoading } = useQuery({
    queryKey: ['student', id],
    queryFn: async () => (await api.get(`/students/${id}`)).data,
  });

  // Fetch courses list for enrollment dropdown
  const { data: courses } = useQuery({
    queryKey: ['courses-lite'],
    queryFn: async () => (await api.get<any[]>('/courses/lite')).data,
    enabled: isEnrollModalOpen,
  });

  const isGrowthOrPro = currentUser?.organization.plan !== 'STARTER';
  const isPro = currentUser?.organization.plan === 'PROFESSIONAL';

  const invalidate = () => {
    qc.invalidateQueries({ queryKey: ['student', id] });
    qc.invalidateQueries({ queryKey: ['student-timeline', id] });
    qc.invalidateQueries({ queryKey: ['student-notes', id] });
  };

  // Mutators
  const updateStudent = useMutation({
    mutationFn: (payload: any) => api.patch(`/students/${id}`, payload),
    onSuccess: () => { invalidate(); toast.success('Profile updated'); },
    onError: (e) => toast.error(apiErrorMessage(e)),
  });

  const enrollCourse = useMutation({
    mutationFn: (payload: any) => api.post(`/students/${id}/enroll`, payload),
    onSuccess: () => {
      invalidate();
      setIsEnrollModalOpen(false);
      toast.success('Student enrolled in course successfully');
    },
    onError: (e) => toast.error(apiErrorMessage(e)),
  });

  const recordPayment = useMutation({
    mutationFn: (payload: any) => api.post(`/students/${id}/payment`, payload),
    onSuccess: () => {
      invalidate();
      setIsPaymentModalOpen(false);
      toast.success('Payment recorded successfully');
    },
    onError: (e) => toast.error(apiErrorMessage(e)),
  });

  const linkGuardian = useMutation({
    mutationFn: (payload: any) => api.post(`/students/${id}/guardians`, payload),
    onSuccess: () => {
      invalidate();
      setIsGuardianModalOpen(false);
      toast.success('Guardian linked successfully');
    },
    onError: (e) => toast.error(apiErrorMessage(e)),
  });

  const deleteStudent = useMutation({
    mutationFn: () => api.delete(`/students/${id}`),
    onSuccess: () => {
      toast.success('Student record deleted');
      router.push('/students');
    },
    onError: (e) => toast.error(apiErrorMessage(e)),
  });

  if (isLoading || !student) {
    return <div style={{ color: 'var(--ink-3)' }}>Loading student profile…</div>;
  }

  const canManage = hasPermission('student.manage');

  return (
    <div style={{ animation: 'fadeUp .4s ease' }}>
      <button onClick={() => router.push('/students')} style={{ display: 'inline-flex', alignItems: 'center', gap: 7, background: 'none', border: 'none', color: 'var(--ink-2)', fontWeight: 600, fontSize: 13.5, cursor: 'pointer', marginBottom: 18, padding: 0 }}>
        <ChevronLeft size={16} strokeWidth={2} />Back to Students
      </button>

      {/* Header Card */}
      <div className="card" style={{ borderRadius: 20, padding: '24px 26px', marginBottom: 20 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 18, flexWrap: 'wrap' }}>
          <span style={avatarStyle(student.id, 60)}>{studentInitials(student)}</span>
          <div style={{ minWidth: 0, flex: 1 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
              <h1 style={{ fontSize: 24, fontWeight: 700, letterSpacing: '-.02em', margin: 0, whiteSpace: 'nowrap' }}>{studentName(student)}</h1>
              <span style={studentStatusBadgeStyle(student.status)}>{student.status}</span>
            </div>
            <div style={{ display: 'flex', gap: 18, flexWrap: 'wrap', marginTop: 7, fontSize: 13, color: 'var(--ink-2)' }}>
              <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}><Building size={14} strokeWidth={1.9} />{student.branch?.name ?? 'Main Branch'}</span>
              <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}><Phone size={14} strokeWidth={1.9} />{student.phone ?? '—'}</span>
              <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}><Mail size={14} strokeWidth={1.9} />{student.email ?? '—'}</span>
            </div>
          </div>
          {canManage && (
            <div style={{ display: 'flex', gap: 9, flexWrap: 'wrap' }}>
              {isGrowthOrPro && (
                <button className="btn-secondary" style={{ height: 40 }} onClick={() => setIsPaymentModalOpen(true)}>
                  <CreditCard size={15} strokeWidth={1.9} />Record Fee Payment
                </button>
              )}
              <button className="btn-secondary" style={{ height: 40 }} onClick={() => setIsEnrollModalOpen(true)}>
                <BookOpen size={15} strokeWidth={1.9} />Enroll Course
              </button>
              <button className="btn-secondary" style={{ height: 40, width: 40, padding: 0, color: 'var(--danger)' }} title="Delete Student" onClick={() => confirm('Delete this student?') && deleteStudent.mutate()}>
                <Trash2 size={15} strokeWidth={1.9} />
              </button>
            </div>
          )}
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 320px', gap: 20, alignItems: 'start' }}>
        {/* Left Side: Tabs Panel */}
        <div className="card" style={{ borderRadius: 20, overflow: 'hidden' }}>
          <div style={{ display: 'flex', padding: '6px 24px 0', borderBottom: '1px solid var(--line-soft)', overflowX: 'auto' }}>
            {(['profile', 'contact', 'parent', 'course', 'documents', 'timeline'] as Tab[]).map((t) => (
              <button
                key={t}
                onClick={() => setTab(t)}
                style={{
                  padding: '12px 14px', border: 'none', background: 'none', cursor: 'pointer', textTransform: 'capitalize',
                  fontWeight: 600, fontSize: 13.5,
                  color: tab === t ? 'var(--navy)' : 'var(--ink-2)',
                  borderBottom: tab === t ? '2px solid var(--navy)' : '2px solid transparent',
                  marginBottom: -1,
                }}
              >
                {t === 'parent' ? 'Guardians' : t}
              </button>
            ))}
          </div>

          <div style={{ padding: 24 }}>
            {tab === 'profile' && <ProfileTab student={student} onSave={updateStudent.mutate} canManage={canManage} />}
            {tab === 'contact' && <ContactTab student={student} onSave={updateStudent.mutate} canManage={canManage} />}
            {tab === 'parent' && <ParentTab student={student} onLink={() => setIsGuardianModalOpen(true)} canManage={canManage} />}
            {tab === 'course' && <CourseTab student={student} isGrowth={isGrowthOrPro} />}
            {tab === 'documents' && <DocumentsTab student={student} />}
            {tab === 'timeline' && <TimelineTab id={id} canManage={canManage} />}
          </div>
        </div>

        {/* Right Side: Quick info Cards */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          <div className="card" style={{ borderRadius: 18, padding: 20 }}>
            <div className="eyebrow" style={{ marginBottom: 14 }}>Student CRM Info</div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 13 }}>
              <Row label="Admission No" value={student.admissionNo} />
              <Row label="Date Joined" value={formatDate(student.createdAt)} />
              <Row label="Enrollment Date" value={student.enrollmentDate ? formatDate(student.enrollmentDate) : '—'} />
              <Row label="Gender" value={GENDER_LABELS[student.gender] ?? 'Not Specified'} />
            </div>
          </div>

          {/* Gated feature box for Student Portal */}
          <div className="card" style={{ borderRadius: 18, padding: 20, background: 'rgba(230,162,60,.04)', border: '1px solid rgba(230,162,60,.18)' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10 }}>
              <Sparkles size={16} color="var(--gold)" />
              <span style={{ fontSize: 12.5, fontWeight: 700, color: 'var(--gold)' }}>Professional Features</span>
            </div>
            <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 8 }}>Student & Parent Portal</div>
            <p style={{ fontSize: 12, color: 'var(--ink-3)', margin: 0, lineHeight: 1.45 }}>
              Enable student logins, portal tracking, and parents portal notifications. Available on the Professional Plan.
            </p>
          </div>
        </div>
      </div>

      {/* MODALS */}
      <EnrollModal
        open={isEnrollModalOpen}
        onClose={() => setIsEnrollModalOpen(false)}
        courses={courses || []}
        onEnroll={(dto) => enrollCourse.mutate(dto)}
        loading={enrollCourse.isPending}
      />

      <PaymentModal
        open={isPaymentModalOpen}
        onClose={() => setIsPaymentModalOpen(false)}
        enrollments={student.enrollments}
        onPay={(dto) => recordPayment.mutate(dto)}
        loading={recordPayment.isPending}
      />

      <GuardianModal
        open={isGuardianModalOpen}
        onClose={() => setIsGuardianModalOpen(false)}
        onLink={(dto) => linkGuardian.mutate(dto)}
        loading={linkGuardian.isPending}
      />
    </div>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', gap: 10 }}>
      <span style={{ fontSize: 12.5, color: 'var(--ink-3)' }}>{label}</span>
      <span style={{ fontSize: 13, fontWeight: 600, textAlign: 'right' }}>{value}</span>
    </div>
  );
}

// PROFILE TAB
function ProfileTab({ student, onSave, canManage }: { student: any; onSave: (val: any) => void; canManage: boolean }) {
  const [form, setForm] = useState({
    firstName: student.firstName,
    lastName: student.lastName ?? '',
    gender: student.gender ?? 'MALE',
    dateOfBirth: student.dateOfBirth ? new Date(student.dateOfBirth).toISOString().slice(0, 10) : '',
  });

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    onSave(form);
  };

  return (
    <form onSubmit={submit} style={{ display: 'flex', flexDirection: 'column', gap: 16, animation: 'fadeUp .3s ease' }}>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
        <Field label="First Name">
          <input className="input" value={form.firstName} onChange={(e) => setForm({ ...form, firstName: e.target.value })} disabled={!canManage} required />
        </Field>
        <Field label="Last Name">
          <input className="input" value={form.lastName} onChange={(e) => setForm({ ...form, lastName: e.target.value })} disabled={!canManage} />
        </Field>
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
        <Field label="Gender">
          <select className="input" value={form.gender} onChange={(e) => setForm({ ...form, gender: e.target.value })} disabled={!canManage}>
            <option value="MALE">Male</option>
            <option value="FEMALE">Female</option>
            <option value="OTHER">Other</option>
          </select>
        </Field>
        <Field label="Date of birth">
          <input className="input" type="date" value={form.dateOfBirth} onChange={(e) => setForm({ ...form, dateOfBirth: e.target.value })} disabled={!canManage} />
        </Field>
      </div>
      {canManage && (
        <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 8 }}>
          <button type="submit" className="btn-primary" style={{ padding: '8px 24px' }}>Save Changes</button>
        </div>
      )}
    </form>
  );
}

// CONTACT TAB
function ContactTab({ student, onSave, canManage }: { student: any; onSave: (val: any) => void; canManage: boolean }) {
  const [form, setForm] = useState({
    email: student.email ?? '',
    phone: student.phone ?? '',
    address: student.address ?? '',
    city: student.city ?? '',
    state: student.state ?? '',
    country: student.country ?? 'India',
  });

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    onSave(form);
  };

  return (
    <form onSubmit={submit} style={{ display: 'flex', flexDirection: 'column', gap: 16, animation: 'fadeUp .3s ease' }}>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
        <Field label="Email Address">
          <input className="input" type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} disabled={!canManage} />
        </Field>
        <Field label="Phone Number">
          <input className="input" value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} disabled={!canManage} />
        </Field>
      </div>
      <Field label="Street Address">
        <input className="input" value={form.address} onChange={(e) => setForm({ ...form, address: e.target.value })} disabled={!canManage} />
      </Field>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 14 }}>
        <Field label="City">
          <input className="input" value={form.city} onChange={(e) => setForm({ ...form, city: e.target.value })} disabled={!canManage} />
        </Field>
        <Field label="State">
          <input className="input" value={form.state} onChange={(e) => setForm({ ...form, state: e.target.value })} disabled={!canManage} />
        </Field>
        <Field label="Country">
          <input className="input" value={form.country} onChange={(e) => setForm({ ...form, country: e.target.value })} disabled={!canManage} />
        </Field>
      </div>
      {canManage && (
        <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 8 }}>
          <button type="submit" className="btn-primary" style={{ padding: '8px 24px' }}>Save Contact Info</button>
        </div>
      )}
    </form>
  );
}

// PARENT/GUARDIAN TAB
function ParentTab({ student, onLink, canManage }: { student: any; onLink: () => void; canManage: boolean }) {
  return (
    <div style={{ animation: 'fadeUp .3s ease' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
        <div className="eyebrow">Linked Parents & Guardians</div>
        {canManage && (
          <button className="btn-secondary" style={{ padding: '6px 12px', fontSize: 12.5 }} onClick={onLink}>
            <UserPlus size={14} style={{ marginRight: 5 }} />Link Guardian
          </button>
        )}
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
        {student.guardians?.map(({ guardian, isPrimary, isEmergencyContact }: any) => (
          <div key={guardian.id} style={{ background: 'var(--surface-2)', borderRadius: 14, padding: 18, border: '1px solid var(--line-soft)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: 10 }}>
              <div>
                <div style={{ fontWeight: 700, fontSize: 14.5 }}>{guardian.name}</div>
                <div style={{ fontSize: 12, color: 'var(--ink-3)', marginTop: 2, textTransform: 'capitalize', fontWeight: 600 }}>{guardian.relation.toLowerCase()}</div>
              </div>
              <div style={{ display: 'flex', gap: 6 }}>
                {isPrimary && <span style={{ fontSize: 11, background: 'rgba(19,35,118,.09)', color: 'var(--navy)', padding: '2px 8px', borderRadius: 99, fontWeight: 700 }}>Primary</span>}
                {isEmergencyContact && <span style={{ fontSize: 11, background: 'var(--danger-bg)', color: 'var(--danger)', padding: '2px 8px', borderRadius: 99, fontWeight: 700 }}>Emergency Contact</span>}
              </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14, marginTop: 14, borderTop: '1px solid var(--line-soft)', paddingTop: 12, fontSize: 13 }}>
              <div>
                <div style={{ color: 'var(--ink-3)', fontSize: 11.5, marginBottom: 2 }}>Contact Details</div>
                <div>{guardian.phone ?? 'No Phone'} · {guardian.email ?? 'No Email'}</div>
              </div>
              <div>
                <div style={{ color: 'var(--ink-3)', fontSize: 11.5, marginBottom: 2 }}>Occupation & Address</div>
                <div>{guardian.occupation ?? '—'} · {guardian.address ?? '—'}</div>
              </div>
            </div>
          </div>
        ))}

        {(!student.guardians || student.guardians.length === 0) && (
          <div style={{ padding: 32, textCombineUpright: 'center', textAlign: 'center', color: 'var(--ink-3)', border: '1.5px dashed var(--line)', borderRadius: 14 }}>
            No parents or guardians linked yet.
          </div>
        )}
      </div>
    </div>
  );
}

// COURSE ENROLLMENTS TAB
function CourseTab({ student, isGrowth }: { student: any; isGrowth: boolean }) {
  return (
    <div style={{ animation: 'fadeUp .3s ease' }}>
      <div className="eyebrow" style={{ marginBottom: 16 }}>Course Enrollments</div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
        {student.enrollments?.map((e: any) => {
          const unpaid = Math.max(0, e.feeAmount - e.feePaid);
          const pct = e.feeAmount > 0 ? Math.min(100, Math.round((e.feePaid / e.feeAmount) * 100)) : 0;
          return (
            <div key={e.id} style={{ background: 'var(--surface-2)', borderRadius: 14, padding: 18, border: '1px solid var(--line-soft)' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div>
                  <div style={{ fontWeight: 700, fontSize: 15, color: 'var(--navy)' }}>{e.course.name}</div>
                  <div style={{ fontSize: 12, color: 'var(--ink-3)', marginTop: 2 }}>Code: {e.course.code} · Enrolled on {new Date(e.enrolledAt).toLocaleDateString()}</div>
                </div>
                <span style={{ fontSize: 12.5, fontWeight: 700, background: 'var(--surface)', color: 'var(--ink)', padding: '4px 10px', borderRadius: 10 }}>
                  {e.status}
                </span>
              </div>

              {/* Gated Fee Tracking info */}
              <div style={{ borderTop: '1px solid var(--line-soft)', marginTop: 14, paddingTop: 14 }}>
                {isGrowth ? (
                  <div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, fontWeight: 600, marginBottom: 8 }}>
                      <span>Fee Payments Progress ({pct}%)</span>
                      <span>{formatCurrency(e.feePaid)} / {formatCurrency(e.feeAmount)} paid</span>
                    </div>
                    {/* Progress bar */}
                    <div style={{ height: 8, background: 'var(--surface)', borderRadius: 99, overflow: 'hidden' }}>
                      <div style={{ width: `${pct}%`, height: '100%', background: 'var(--success)' }} />
                    </div>
                    {unpaid > 0 ? (
                      <div style={{ fontSize: 12, color: 'var(--danger)', marginTop: 8, fontWeight: 600 }}>
                        Outstanding Balance: {formatCurrency(unpaid)}
                      </div>
                    ) : (
                      <div style={{ fontSize: 12, color: 'var(--success)', marginTop: 8, fontWeight: 600 }}>
                        Fees Fully Settled
                      </div>
                    )}
                  </div>
                ) : (
                  <div style={{ background: 'rgba(230,162,60,.04)', border: '1.5px dashed rgba(230,162,60,.18)', padding: 12, borderRadius: 10, display: 'flex', alignItems: 'center', gap: 10 }}>
                    <Sparkles size={16} color="var(--gold)" />
                    <span style={{ fontSize: 12.5, color: 'var(--ink-2)' }}>
                      Upgrade to **Growth** plan to enable dynamic Fee Tracking, payments progress, and ledger entries.
                    </span>
                  </div>
                )}
              </div>
            </div>
          );
        })}

        {(!student.enrollments || student.enrollments.length === 0) && (
          <div style={{ padding: 32, textAlign: 'center', color: 'var(--ink-3)', border: '1.5px dashed var(--line)', borderRadius: 14 }}>
            No active course enrollments yet.
          </div>
        )}
      </div>
    </div>
  );
}

// TIMELINE TAB
function TimelineTab({ id, canManage }: { id: string; canManage: boolean }) {
  const qc = useQueryClient();
  const [draft, setDraft] = useState('');

  const { data: timeline } = useQuery({
    queryKey: ['student-timeline', id],
    queryFn: async () => (await api.get(`/students/${id}/timeline`)).data as any[],
  });

  const { data: notes } = useQuery({
    queryKey: ['student-notes', id],
    queryFn: async () => (await api.get(`/students/${id}/notes`)).data as any[],
  });

  const add = useMutation({
    mutationFn: () => api.post(`/students/${id}/notes`, { body: draft }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['student-notes', id] });
      setDraft('');
      toast.success('Note added');
    },
    onError: (e) => toast.error(apiErrorMessage(e)),
  });

  return (
    <div style={{ display: 'grid', gridTemplateColumns: '1.2fr 1fr', gap: 24, animation: 'fadeUp .3s ease' }}>
      {/* Timeline logs */}
      <div>
        <div className="eyebrow" style={{ marginBottom: 16 }}>Timeline Logs</div>
        <div style={{ position: 'relative', paddingLeft: 6 }}>
          <div style={{ position: 'absolute', left: 21, top: 6, bottom: 6, width: 2, background: 'var(--line-soft)' }} />
          <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
            {timeline?.map((e) => (
              <div key={e.id} style={{ display: 'flex', gap: 14, position: 'relative' }}>
                <span style={{ width: 32, height: 32, borderRadius: 99, background: 'var(--surface)', color: 'var(--navy)', display: 'flex', alignItems: 'center', justifyContent: 'center', flex: '0 0 32px', zIndex: 1, boxShadow: '0 0 0 4px var(--surface)', border: '1px solid var(--line)' }}>
                  <Clock size={15} strokeWidth={1.9} />
                </span>
                <div style={{ minWidth: 0, background: 'var(--surface-2)', borderRadius: 14, padding: '12px 14px', flex: 1 }}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10 }}>
                    <div style={{ fontSize: 13, fontWeight: 600 }}>{prettyAction(e.action)}</div>
                    <div style={{ fontSize: 11, color: 'var(--ink-3)', whiteSpace: 'nowrap' }}>{formatDate(e.createdAt)}</div>
                  </div>
                  {e.actor && <div style={{ fontSize: 11, color: 'var(--ink-3)', marginTop: 4 }}>— {e.actor.firstName} {e.actor.lastName ?? ''}</div>}
                </div>
              </div>
            ))}
            {(!timeline || timeline.length === 0) && (
              <div style={{ color: 'var(--ink-3)', fontSize: 13 }}>No logs.</div>
            )}
          </div>
        </div>
      </div>

      {/* Notes */}
      <div>
        <div className="eyebrow" style={{ marginBottom: 16 }}>Notes & Comments</div>
        {canManage && (
          <div style={{ marginBottom: 18 }}>
            <textarea className="input" value={draft} onChange={(e) => setDraft(e.target.value)} placeholder="Type a note…" rows={3} style={{ resize: 'none', marginBottom: 8 }} />
            <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
              <button className="btn-primary" style={{ padding: '6px 14px', fontSize: 12.5, height: 34 }} disabled={!draft.trim() || add.isPending} onClick={() => add.mutate()}>Add Note</button>
            </div>
          </div>
        )}

        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {notes?.map((n) => (
            <div key={n.id} style={{ background: 'var(--surface-2)', borderRadius: 12, padding: 14 }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', fontSize: 11.5, color: 'var(--ink-3)' }}>
                <span style={{ fontWeight: 600, color: 'var(--ink)' }}>{n.author?.firstName} {n.author?.lastName ?? ''}</span>
                <span>{formatDate(n.createdAt)}</span>
              </div>
              <div style={{ fontSize: 13, color: 'var(--ink-2)', marginTop: 6, lineHeight: 1.45 }}>{n.body}</div>
            </div>
          ))}
          {(!notes || notes.length === 0) && (
            <div style={{ color: 'var(--ink-3)', fontSize: 13, textAlign: 'center', padding: 20 }}>No notes yet.</div>
          )}
        </div>
      </div>
    </div>
  );
}

// DOCUMENTS TAB
function DocumentsTab({ student }: { student: any }) {
  const qc = useQueryClient();
  const fileRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);

  // Fetch STUDENT-tagged documents
  const { data: studentDocs = [] } = useQuery({
    queryKey: ['student-docs', student?.id],
    enabled: !!student?.id,
    queryFn: async () => {
      const res = await api.get<any>(`/documents?relatedType=STUDENT&relatedId=${student.id}&limit=100`);
      return res.data?.data ?? res.data ?? [];
    },
  });

  // Fetch ADMISSION-tagged documents (uploaded during admissions pipeline)
  const { data: admissionDocs = [] } = useQuery({
    queryKey: ['admission-docs-for-student', student?.id],
    enabled: !!student?.id,
    queryFn: async () => {
      // student.admission is the linked admission record
      const admId = student?.admission?.id;
      if (!admId) return [];
      const res = await api.get<any>(`/documents?relatedType=ADMISSION&relatedId=${admId}&limit=100`);
      return res.data?.data ?? res.data ?? [];
    },
  });

  const allDocs: any[] = [
    ...studentDocs.map((d: any) => ({ ...d, _source: 'STUDENT' })),
    ...admissionDocs.map((d: any) => ({ ...d, _source: 'ADMISSION' })),
  ];

  const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    try {
      // Three steps: authorise, PUT straight to R2, then confirm. Without the
      // confirm the row stays PENDING and the upload silently does nothing.
      const intent = (await api.post('/documents/upload-intent', {
        fileName: file.name, mimeType: file.type, sizeBytes: file.size, name: file.name,
        folder: 'STUDENT', relatedType: 'STUDENT', relatedId: student.id,
      })).data;
      const put = await fetch(intent.uploadUrl, { method: 'PUT', body: file, headers: intent.requiredHeaders });
      if (!put.ok) throw new Error(`Storage rejected the upload (${put.status})`);
      await api.post(`/documents/${intent.documentId}/complete`, {});
      qc.invalidateQueries({ queryKey: ['student-docs', student?.id] });
      toast.success('Document uploaded');
    } catch (err: any) {
      toast.error(err?.response?.data?.message ?? err?.message ?? 'Upload failed');
    } finally {
      setUploading(false);
      if (fileRef.current) fileRef.current.value = '';
    }
  };

  const deleteDoc = useMutation({
    mutationFn: (id: string) => api.delete(`/documents/${id}`),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['student-docs', student?.id] });
      qc.invalidateQueries({ queryKey: ['admission-docs-for-student', student?.id] });
      toast.success('Document removed');
    },
    onError: (e) => toast.error(apiErrorMessage(e)),
  });

  return (
    <div style={{ animation: 'fadeUp .3s ease', display: 'flex', flexDirection: 'column', gap: 14 }}>
      {/* Upload area */}
      <div
        onClick={() => fileRef.current?.click()}
        style={{ border: '1.5px dashed var(--line)', borderRadius: 14, padding: 26, textAlign: 'center', cursor: 'pointer', transition: 'background .15s' }}
        onMouseEnter={(e) => (e.currentTarget.style.background = 'var(--surface-2)')}
        onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}
      >
        <input ref={fileRef} type="file" style={{ display: 'none' }} onChange={handleUpload} />
        <UploadCloud size={26} strokeWidth={1.6} color="var(--ink-3)" style={{ marginBottom: 8 }} />
        <div style={{ fontWeight: 600, fontSize: 14 }}>{uploading ? 'Uploading…' : 'Upload Student Documents'}</div>
        <div style={{ fontSize: 12.5, color: 'var(--ink-3)', marginTop: 3 }}>Click to browse · PDF, JPG, PNG · up to 10MB</div>
      </div>

      {/* File list */}
      {allDocs.length === 0 ? (
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '12px 15px', border: '1px solid var(--line-soft)', borderRadius: 13, color: 'var(--ink-3)', fontSize: 13 }}>
          <FileText size={16} /> No documents uploaded yet.
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {allDocs.map((doc) => (
            <div key={doc.id} style={{ display: 'flex', alignItems: 'center', gap: 10, background: 'var(--surface-2)', borderRadius: 11, padding: '9px 13px', border: '1px solid var(--line-soft)' }}>
              <FileText size={15} color="var(--navy)" style={{ flexShrink: 0 }} />
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 13, fontWeight: 500, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{doc.name || doc.fileName}</div>
                <div style={{ fontSize: 11, color: 'var(--ink-3)', marginTop: 1 }}>
                  {doc._source === 'ADMISSION' ? 'From Admission' : 'Student file'}
                  {doc.sizeBytes ? ` · ${(doc.sizeBytes / 1024).toFixed(0)} KB` : ''}
                </div>
              </div>
              {/* No permanent href: a fresh short-lived signed URL is fetched
                  per click, so there is no link to forward or leak. */}
              {doc.status !== 'MISSING' ? (
                <button
                  onClick={() => openDocument(doc.id)}
                  style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--navy)', display: 'flex', alignItems: 'center', padding: 4 }}
                  title="Download"
                >
                  <Download size={14} />
                </button>
              ) : (
                <span title="The file was lost with the old ephemeral storage — re-upload it"
                      style={{ color: 'var(--ink-3)', fontSize: 11, padding: 4 }}>
                  file missing
                </span>
              )}
              <button
                onClick={() => deleteDoc.mutate(doc.id)}
                style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--danger)', display: 'flex', padding: 4 }}
                title="Delete"
              >
                <Trash2 size={14} />
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function prettyAction(action: string) {
  const map: Record<string, string> = {
    'student.created': 'Student profile created',
    'student.updated': 'Profile updated',
    'student.enrolled': 'Enrolled in course',
    'student.payment_received': 'Payment registered',
    'student.guardian_linked': 'Guardian linked',
  };
  return map[action] ?? action.replace(/[._]/g, ' ');
}

// SUB MODAL COMPONENTS

function EnrollModal({ open, onClose, courses, onEnroll, loading }: { open: boolean; onClose: () => void; courses: any[]; onEnroll: (dto: any) => void; loading: boolean }) {
  const [courseId, setCourseId] = useState('');
  const [fee, setFee] = useState('');

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!courseId) return;
    onEnroll({ courseId, feeAmount: fee ? Number(fee) : undefined });
    setCourseId('');
    setFee('');
  };

  const handleCourseChange = (id: string) => {
    setCourseId(id);
    const selected = courses.find(c => c.id === id);
    if (selected) setFee(String(selected.fee));
  };

  return (
    <Modal open={open} onClose={onClose} title="Enroll in Course">
      <form onSubmit={submit} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
        <Field label="Select Course">
          <select className="input" value={courseId} onChange={(e) => handleCourseChange(e.target.value)} required>
            <option value="">Choose course…</option>
            {courses.map((c) => <option key={c.id} value={c.id}>{c.name} ({c.fee ? `₹${c.fee}` : 'Free'})</option>)}
          </select>
        </Field>
        {courseId && (
          <Field label="Custom Tuition Fee Amount (INR)">
            <input className="input" type="number" value={fee} onChange={(e) => setFee(e.target.value)} />
          </Field>
        )}
        <div style={{ display: 'flex', justifyContent: 'end', gap: 10, marginTop: 8 }}>
          <button type="button" className="btn-secondary" onClick={onClose}>Cancel</button>
          <button type="submit" className="btn-primary" disabled={!courseId || loading}>
            {loading ? 'Enrolling…' : 'Enroll Student'}
          </button>
        </div>
      </form>
    </Modal>
  );
}

function PaymentModal({ open, onClose, enrollments, onPay, loading }: { open: boolean; onClose: () => void; enrollments: any[]; onPay: (dto: any) => void; loading: boolean }) {
  const [courseId, setCourseId] = useState('');
  const [amount, setAmount] = useState('');

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!courseId || !amount) return;
    onPay({ courseId, amount: Number(amount) });
    setCourseId('');
    setAmount('');
  };

  return (
    <Modal open={open} onClose={onClose} title="Record Fee Payment">
      <form onSubmit={submit} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
        <Field label="Select Enrolled Course">
          <select className="input" value={courseId} onChange={(e) => setCourseId(e.target.value)} required>
            <option value="">Choose enrollment…</option>
            {enrollments.map((e) => {
              const pending = Math.max(0, e.feeAmount - e.feePaid);
              return (
                <option key={e.id} value={e.course.id}>
                  {e.course.name} ({pending > 0 ? `${formatCurrency(pending)} pending` : 'Paid'})
                </option>
              );
            })}
          </select>
        </Field>
        <Field label="Payment Amount (INR)">
          <input className="input" type="number" value={amount} onChange={(e) => setAmount(e.target.value)} placeholder="Enter amount to pay…" required min="1" />
        </Field>
        <div style={{ display: 'flex', justifyContent: 'end', gap: 10, marginTop: 8 }}>
          <button type="button" className="btn-secondary" onClick={onClose}>Cancel</button>
          <button type="submit" className="btn-primary" disabled={!courseId || !amount || loading}>
            {loading ? 'Recording…' : 'Record Payment'}
          </button>
        </div>
      </form>
    </Modal>
  );
}

function GuardianModal({ open, onClose, onLink, loading }: { open: boolean; onClose: () => void; onLink: (dto: any) => void; loading: boolean }) {
  const [form, setForm] = useState({
    name: '',
    relation: 'FATHER',
    phone: '',
    email: '',
    occupation: '',
    address: '',
    isPrimary: false,
    isEmergencyContact: false,
  });

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    onLink(form);
    setForm({
      name: '',
      relation: 'FATHER',
      phone: '',
      email: '',
      occupation: '',
      address: '',
      isPrimary: false,
      isEmergencyContact: false,
    });
  };

  return (
    <Modal open={open} onClose={onClose} title="Link Parent / Guardian">
      <form onSubmit={submit} style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        <Field label="Full Name">
          <input className="input" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="e.g. Anand Verma" required />
        </Field>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
          <Field label="Relation">
            <select className="input" value={form.relation} onChange={(e) => setForm({ ...form, relation: e.target.value })} required>
              <option value="FATHER">Father</option>
              <option value="MOTHER">Mother</option>
              <option value="GUARDIAN">Guardian</option>
              <option value="SIBLING">Sibling</option>
              <option value="OTHER">Other</option>
            </select>
          </Field>
          <Field label="Occupation">
            <input className="input" value={form.occupation} onChange={(e) => setForm({ ...form, occupation: e.target.value })} placeholder="Business, Service, etc." />
          </Field>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
          <Field label="Phone"><input className="input" value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} placeholder="+91 …" /></Field>
          <Field label="Email"><input className="input" type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} placeholder="parent@mail.com" /></Field>
        </div>
        <Field label="Residential Address">
          <input className="input" value={form.address} onChange={(e) => setForm({ ...form, address: e.target.value })} placeholder="Check if same as student" />
        </Field>

        <div style={{ display: 'flex', gap: 16, marginTop: 8, fontSize: 13 }}>
          <label style={{ display: 'inline-flex', alignItems: 'center', gap: 6, cursor: 'pointer' }}>
            <input type="checkbox" checked={form.isPrimary} onChange={(e) => setForm({ ...form, isPrimary: e.target.checked })} />
            Primary Contact
          </label>
          <label style={{ display: 'inline-flex', alignItems: 'center', gap: 6, cursor: 'pointer' }}>
            <input type="checkbox" checked={form.isEmergencyContact} onChange={(e) => setForm({ ...form, isEmergencyContact: e.target.checked })} />
            Emergency Contact
          </label>
        </div>

        <div style={{ display: 'flex', justifyContent: 'end', gap: 10, marginTop: 12 }}>
          <button type="button" className="btn-secondary" onClick={onClose}>Cancel</button>
          <button type="submit" className="btn-primary" disabled={!form.name.trim() || loading}>
            {loading ? 'Linking…' : 'Link Guardian'}
          </button>
        </div>
      </form>
    </Modal>
  );
}
