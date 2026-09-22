'use client';

import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { X } from 'lucide-react';
import { api, apiErrorMessage } from '@/lib/api';
import { Field } from '@/components/molecules/field';

interface Branch { id: string; name: string }
interface Course { id: string; name: string; fee: number }

export function NewStudentDrawer({ open, onClose }: { open: boolean; onClose: () => void }) {
  const qc = useQueryClient();
  const [form, setForm] = useState({
    name: '',
    phone: '',
    email: '',
    gender: 'MALE',
    dateOfBirth: '',
    branchId: '',
    initialCourseId: '',
    initialFeeAmount: 0,
    address: '',
    city: '',
    state: '',
  });

  const { data: branches } = useQuery({
    queryKey: ['branches-lite'],
    queryFn: async () => (await api.get<Branch[]>('/organization/branches')).data,
    enabled: open,
  });

  const { data: courses } = useQuery({
    queryKey: ['courses-lite'],
    queryFn: async () => (await api.get<Course[]>('/courses/lite')).data,
    enabled: open,
  });

  const handleCourseChange = (courseId: string) => {
    const course = courses?.find((c) => c.id === courseId);
    setForm((f) => ({
      ...f,
      initialCourseId: courseId,
      initialFeeAmount: course ? course.fee : 0,
    }));
  };

  const create = useMutation({
    mutationFn: () => {
      const [firstName, ...rest] = form.name.trim().split(' ');
      return api.post('/students', {
        firstName: firstName || form.name,
        lastName: rest.join(' ') || undefined,
        phone: form.phone || undefined,
        email: form.email || undefined,
        gender: form.gender,
        dateOfBirth: form.dateOfBirth || undefined,
        branchId: form.branchId || undefined,
        initialCourseId: form.initialCourseId || undefined,
        initialFeeAmount: form.initialCourseId ? Number(form.initialFeeAmount) : undefined,
        address: form.address || undefined,
        city: form.city || undefined,
        state: form.state || undefined,
      });
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['students'] });
      toast.success('Student record created successfully');
      setForm({
        name: '',
        phone: '',
        email: '',
        gender: 'MALE',
        dateOfBirth: '',
        branchId: '',
        initialCourseId: '',
        initialFeeAmount: 0,
        address: '',
        city: '',
        state: '',
      });
      onClose();
    },
    onError: (e) => toast.error(apiErrorMessage(e)),
  });

  if (!open) return null;
  const set = (k: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) =>
    setForm({ ...form, [k]: e.target.value });

  return (
    <>
      <div onClick={onClose} style={{ position: 'fixed', inset: 0, zIndex: 60, background: 'rgba(20,15,12,.42)', backdropFilter: 'blur(2px)' }} />
      <div
        style={{
          position: 'fixed', top: 0, right: 0, bottom: 0, zIndex: 61, width: 440, maxWidth: '100%',
          background: 'var(--surface)', borderLeft: '1px solid var(--line)', boxShadow: '-24px 0 60px rgba(0,0,0,.14)',
          animation: 'slideIn .3s cubic-bezier(.2,.8,.2,1)', display: 'flex', flexDirection: 'column',
        }}
      >
        <div style={{ padding: '22px 24px', borderBottom: '1px solid var(--line-soft)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div>
            <div style={{ fontWeight: 700, fontSize: 17 }}>New Student</div>
            <div style={{ fontSize: 12.5, color: 'var(--ink-3)' }}>Create a student profile manually</div>
          </div>
          <button onClick={onClose} style={{ width: 34, height: 34, borderRadius: 9, border: '1px solid var(--line)', background: 'var(--surface)', color: 'var(--ink-2)', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <X size={16} />
          </button>
        </div>

        <div style={{ flex: 1, overflowY: 'auto', padding: '22px 24px', display: 'flex', flexDirection: 'column', gap: 16 }}>
          <Field label="Full name">
            <input className="input" value={form.name} onChange={set('name')} placeholder="e.g. Rahul Verma" required />
          </Field>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <Field label="Phone"><input className="input" value={form.phone} onChange={set('phone')} placeholder="+91 …" /></Field>
            <Field label="Email"><input className="input" type="email" value={form.email} onChange={set('email')} placeholder="rahul@example.com" /></Field>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <Field label="Gender">
              <select className="input" value={form.gender} onChange={set('gender')}>
                <option value="MALE">Male</option>
                <option value="FEMALE">Female</option>
                <option value="OTHER">Other</option>
              </select>
            </Field>
            <Field label="Date of birth">
              <input className="input" type="date" value={form.dateOfBirth} onChange={set('dateOfBirth')} />
            </Field>
          </div>

          <Field label="Branch">
            <select className="input" value={form.branchId} onChange={set('branchId')}>
              <option value="">Select a branch…</option>
              {branches?.map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}
            </select>
          </Field>

          <div style={{ borderTop: '1px solid var(--line-soft)', paddingTop: 16, marginTop: 4 }}>
            <div style={{ fontWeight: 600, fontSize: 14, marginBottom: 12, color: 'var(--navy)' }}>Initial Course Enrollment</div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              <Field label="Course">
                <select className="input" value={form.initialCourseId} onChange={(e) => handleCourseChange(e.target.value)}>
                  <option value="">Select course to enroll…</option>
                  {courses?.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
                </select>
              </Field>
              {form.initialCourseId && (
                <Field label="Enrollment Fee (INR)">
                  <input className="input" type="number" value={form.initialFeeAmount} onChange={(e) => setForm({ ...form, initialFeeAmount: Number(e.target.value) })} />
                </Field>
              )}
            </div>
          </div>

          <div style={{ borderTop: '1px solid var(--line-soft)', paddingTop: 16, marginTop: 4 }}>
            <div style={{ fontWeight: 600, fontSize: 14, marginBottom: 12, color: 'var(--navy)' }}>Address Particulars</div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              <Field label="Street Address">
                <input className="input" value={form.address} onChange={set('address')} placeholder="e.g. 12 Main St" />
              </Field>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                <Field label="City"><input className="input" value={form.city} onChange={set('city')} placeholder="Bengaluru" /></Field>
                <Field label="State"><input className="input" value={form.state} onChange={set('state')} placeholder="Karnataka" /></Field>
              </div>
            </div>
          </div>
        </div>

        <div style={{ padding: '18px 24px', borderTop: '1px solid var(--line-soft)', display: 'flex', gap: 10 }}>
          <button className="btn-secondary" style={{ flex: 1 }} onClick={onClose}>Cancel</button>
          <button className="btn-primary" style={{ flex: 1.4 }} disabled={!form.name.trim() || create.isPending} onClick={() => create.mutate()}>
            {create.isPending ? 'Creating…' : 'Create Profile'}
          </button>
        </div>
      </div>
    </>
  );
}
