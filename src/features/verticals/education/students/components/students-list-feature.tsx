'use client';

import { Suspense, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useQuery } from '@tanstack/react-query';
import { Filter, Download, Plus, Search, Users, ShieldAlert, GraduationCap, CheckCircle } from 'lucide-react';
import { api } from '@/lib/api';
import { useAuth } from '@/features/foundation/auth';
import { NewStudentDrawer } from './new-student-drawer';
import {
  StudentRow, STATUS_LABELS, avatarStyle, studentInitials, studentName,
  studentStatusBadgeStyle, formatCurrency, STATUS_OPTIONS
} from '../students-utils';
import type { Paginated } from '@/lib/types';

const card: React.CSSProperties = {
  background: 'var(--surface)',
  border: '1px solid var(--line-soft)',
  borderRadius: 20,
  boxShadow: 'var(--shadow-1)',
};

const mono: React.CSSProperties = {
  fontFamily: 'var(--mono)', fontSize: 10, letterSpacing: '.1em',
  textTransform: 'uppercase', color: 'var(--ink-3)',
};

function StudentsInner() {
  const router = useRouter();
  const params = useSearchParams();
  const { hasPermission } = useAuth();
  const [drawer, setDrawer] = useState(false);
  
  // Search & Filter state
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState<string>('');
  const [branchId, setBranchId] = useState<string>('');
  const [page, setPage] = useState(1);

  // Fetch branches for filters
  const { data: branches } = useQuery({
    queryKey: ['branches-lite'],
    queryFn: async () => (await api.get<{ id: string; name: string }[]>('/organization/branches')).data,
  });

  // Fetch Paginated Students
  const { data: studentsData, isLoading } = useQuery({
    queryKey: ['students', search, status, branchId, page],
    queryFn: async () => {
      const p = new URLSearchParams();
      p.set('page', String(page));
      p.set('limit', '10');
      if (search) p.set('search', search);
      if (status) p.set('status', status);
      if (branchId) p.set('branchId', branchId);
      return (await api.get<Paginated<StudentRow>>(`/students?${p.toString()}`)).data;
    },
  });

  // Calculate live stats
  const totalStudents = studentsData?.meta.total ?? 0;
  
  // Export to CSV
  const exportCsv = async () => {
    const p = new URLSearchParams();
    if (search) p.set('search', search);
    if (status) p.set('status', status);
    if (branchId) p.set('branchId', branchId);
    
    const res = await api.get(`/students/export?${p.toString()}`, { responseType: 'blob' });
    const url = URL.createObjectURL(res.data as Blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'students.csv';
    a.click();
    URL.revokeObjectURL(url);
  };

  const kpis = [
    { label: 'Total Students', value: String(totalStudents), icon: Users, tint: 'var(--gold-bg)', color: 'var(--gold-ink)' },
    { label: 'Active Profiles', value: String(studentsData?.data.filter(s => s.status === 'ACTIVE').length ?? 0), icon: CheckCircle, tint: 'var(--success-bg)', color: 'var(--success)' },
    { label: 'Graduates', value: String(studentsData?.data.filter(s => s.status === 'GRADUATED').length ?? 0), icon: GraduationCap, tint: 'rgba(19,35,118,.09)', color: 'var(--navy)' },
    { label: 'Suspended', value: String(studentsData?.data.filter(s => s.status === 'SUSPENDED').length ?? 0), icon: ShieldAlert, tint: 'var(--danger-bg)', color: 'var(--danger)' },
  ];

  const COLS = '2.2fr 1.2fr 1fr 1.2fr 1.6fr 0.9fr';

  return (
    <div style={{ animation: 'fadeUp .4s ease' }}>
      {/* Title Header */}
      <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', gap: 20, flexWrap: 'wrap', marginBottom: 22 }}>
        <div>
          <h1 style={{ fontSize: 28, fontWeight: 700, letterSpacing: '-.02em', margin: 0, lineHeight: 1.1 }}>Student CRM</h1>
          <p style={{ fontSize: 14, color: 'var(--ink-2)', margin: '6px 0 0' }}>
            Manage active student profiles, course enrollments, fee history, and parent relations.
          </p>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <button className="btn-secondary" style={{ height: 40 }} onClick={exportCsv}>
            <Download size={15} strokeWidth={1.9} />Export
          </button>
          {hasPermission('student.manage') && (
            <button className="btn-primary" style={{ height: 40 }} onClick={() => setDrawer(true)}>
              <Plus size={16} strokeWidth={2} />New Student
            </button>
          )}
        </div>
      </div>

      {/* KPI Cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 18, marginBottom: 24 }}>
        {kpis.map((k) => {
          const Icon = k.icon;
          return (
            <div key={k.label} style={{ ...card, borderRadius: 18, padding: '18px 20px' }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
                <div style={mono}>{k.label}</div>
                <div style={{ width: 32, height: 32, borderRadius: 9, background: k.tint, color: k.color, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <Icon size={16} strokeWidth={2} />
                </div>
              </div>
              <div style={{ fontSize: 30, fontWeight: 700, letterSpacing: '-.02em', lineHeight: 1 }}>{k.value}</div>
            </div>
          );
        })}
      </div>

      {/* Search and Filters Bar */}
      <div style={{ display: 'flex', gap: 12, marginBottom: 20, flexWrap: 'wrap' }}>
        <div style={{ display: 'flex', flex: 1, minWidth: 260, position: 'relative' }}>
          <Search size={16} style={{ position: 'absolute', left: 14, top: 12, color: 'var(--ink-3)' }} />
          <input
            className="input"
            style={{ paddingLeft: 38 }}
            placeholder="Search by name, email, phone or admission no…"
            value={search}
            onChange={(e) => { setSearch(e.target.value); setPage(1); }}
          />
        </div>
        <div style={{ display: 'flex', gap: 10 }}>
          <select className="input" style={{ width: 160 }} value={status} onChange={(e) => { setStatus(e.target.value); setPage(1); }}>
            <option value="">All Statuses</option>
            {STATUS_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
          </select>
          <select className="input" style={{ width: 180 }} value={branchId} onChange={(e) => { setBranchId(e.target.value); setPage(1); }}>
            <option value="">All Branches</option>
            {branches?.map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}
          </select>
        </div>
      </div>

      {/* Table Card */}
      <div className="card" style={{ overflow: 'hidden' }}>
        <div style={{ display: 'grid', gridTemplateColumns: COLS, gap: 12, padding: '14px 22px', borderBottom: '1px solid var(--line-soft)', fontFamily: 'var(--mono)', fontSize: 10, letterSpacing: '.1em', textTransform: 'uppercase', color: 'var(--ink-3)' }}>
          <div>Student</div>
          <div>Admission No</div>
          <div>Status</div>
          <div>Branch</div>
          <div>Enrolled Courses</div>
          <div style={{ textAlign: 'right' }}>Date Joined</div>
        </div>

        {isLoading && <div style={{ padding: 40, textAlign: 'center', color: 'var(--ink-3)' }}>Loading students…</div>}
        {studentsData?.data.length === 0 && <div style={{ padding: 40, textAlign: 'center', color: 'var(--ink-3)' }}>No students found.</div>}

        {studentsData?.data.map((student) => {
          const coursesList = student.enrollments.map(e => e.course.name).join(', ') || 'None';
          return (
            <div
              key={student.id}
              onClick={() => router.push(`/students/${student.id}`)}
              className="student-row"
              style={{ display: 'grid', gridTemplateColumns: COLS, gap: 12, padding: '15px 22px', borderBottom: '1px solid var(--line-soft)', alignItems: 'center', cursor: 'pointer' }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: 12, minWidth: 0 }}>
                <span style={avatarStyle(student.id, 38)}>{studentInitials(student)}</span>
                <div style={{ minWidth: 0 }}>
                  <div style={{ fontWeight: 600, fontSize: 14, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{studentName(student)}</div>
                  <div style={{ fontSize: 12, color: 'var(--ink-3)' }}>{student.phone ?? '—'}</div>
                </div>
              </div>
              <div style={{ fontSize: 13, fontFamily: 'var(--mono)', fontWeight: 600, color: 'var(--navy)' }}>{student.admissionNo}</div>
              <div><span style={studentStatusBadgeStyle(student.status)}>{STATUS_LABELS[student.status] ?? student.status}</span></div>
              <div style={{ fontSize: 13.5, color: 'var(--ink-2)' }}>{student.branch?.name ?? 'Main Branch'}</div>
              <div style={{ fontSize: 13.5, color: 'var(--ink-2)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={coursesList}>{coursesList}</div>
              <div style={{ textAlign: 'right', fontSize: 12.5, color: 'var(--ink-3)' }}>{new Date(student.createdAt).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}</div>
            </div>
          );
        })}
        
        {/* Pagination Bar */}
        {studentsData && studentsData.meta.totalPages > 1 && (
          <div style={{ padding: '12px 22px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderTop: '1px solid var(--line-soft)', background: 'var(--surface-2)' }}>
            <button className="btn-secondary" style={{ padding: '6px 12px', fontSize: 12.5 }} disabled={page === 1} onClick={() => setPage(p => Math.max(1, p - 1))}>Previous</button>
            <span style={{ fontSize: 13, color: 'var(--ink-3)' }}>Page {page} of {studentsData.meta.totalPages}</span>
            <button className="btn-secondary" style={{ padding: '6px 12px', fontSize: 12.5 }} disabled={page === studentsData.meta.totalPages} onClick={() => setPage(p => p + 1)}>Next</button>
          </div>
        )}
      </div>

      <NewStudentDrawer open={drawer} onClose={() => setDrawer(false)} />
      <style>{`.student-row:hover{background:var(--surface-2);}`}</style>
    </div>
  );
}

export function StudentsListFeature() {
  return (
    <Suspense fallback={<div style={{ color: 'var(--ink-3)' }}>Loading…</div>}>
      <StudentsInner />
    </Suspense>
  );
}
