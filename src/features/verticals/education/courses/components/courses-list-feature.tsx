'use client';

import { Suspense, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { Search, Plus, Trash2, Edit3, Calendar, Layers, ShieldAlert, Sparkles, BookOpen, User } from 'lucide-react';
import { api, apiErrorMessage } from '@/lib/api';
import { useAuth } from '@/features/foundation/auth';
import { Modal } from '@/components/molecules/modal';
import { Field } from '@/components/molecules/field';
import {
  CourseRow, BatchRow, CategoryRow, DURATION_LABELS, BATCH_STATUS_LABELS,
  batchStatusBadgeStyle, courseStatusBadgeStyle
} from '../courses-utils';
import { formatCurrency } from '@/features/verticals/education/students/students-utils';
import type { Paginated } from '@/lib/types';
import { formatDate } from '@/lib/utils';

type Tab = 'courses' | 'batches' | 'categories';

const card: React.CSSProperties = {
  background: 'var(--surface)',
  border: '1px solid var(--line-soft)',
  borderRadius: 20,
  boxShadow: 'var(--shadow-1)',
};

function CoursesInner() {
  const qc = useQueryClient();
  const { hasPermission } = useAuth();
  const [tab, setTab] = useState<Tab>('courses');

  // Search & Filter state
  const [search, setSearch] = useState('');
  const [categoryId, setCategoryId] = useState('');
  const [courseFilter, setCourseFilter] = useState('');
  const [page, setPage] = useState(1);

  // Modal open states
  const [courseModal, setCourseModal] = useState<CourseRow | 'new' | null>(null);
  const [batchModal, setBatchModal] = useState<BatchRow | 'new' | null>(null);
  const [categoryModal, setCategoryModal] = useState(false);

  // Form states
  const [courseForm, setCourseForm] = useState({
    name: '',
    code: '',
    categoryId: '',
    description: '',
    durationValue: 1,
    durationUnit: 'MONTH',
    fee: 0,
    seats: 0,
    status: 'ACTIVE',
  });

  const [batchForm, setBatchForm] = useState({
    courseId: '',
    branchId: '',
    name: '',
    code: '',
    startDate: '',
    endDate: '',
    capacity: 0,
    status: 'UPCOMING',
  });

  const [categoryName, setCategoryName] = useState('');
  const [categoryDesc, setCategoryDesc] = useState('');

  // Fetch courses query
  const { data: coursesData, isLoading: loadingCourses } = useQuery({
    queryKey: ['courses', search, categoryId, page],
    queryFn: async () => {
      const p = new URLSearchParams();
      p.set('page', String(page));
      p.set('limit', '10');
      if (search) p.set('search', search);
      if (categoryId) p.set('categoryId', categoryId);
      return (await api.get<Paginated<CourseRow>>(`/courses?${p.toString()}`)).data;
    },
    enabled: tab === 'courses',
  });

  // Fetch batches query
  const { data: batchesData, isLoading: loadingBatches } = useQuery({
    queryKey: ['batches', search, courseFilter, page],
    queryFn: async () => {
      const p = new URLSearchParams();
      p.set('page', String(page));
      p.set('limit', '10');
      if (search) p.set('search', search);
      if (courseFilter) p.set('courseId', courseFilter);
      return (await api.get<Paginated<BatchRow>>(`/courses/batches?${p.toString()}`)).data;
    },
    enabled: tab === 'batches',
  });

  // Fetch categories query
  const { data: categoriesData, isLoading: loadingCategories } = useQuery({
    queryKey: ['categories'],
    queryFn: async () => (await api.get<CategoryRow[]>('/courses/categories')).data,
  });

  // Fetch branches for batches
  const { data: branches } = useQuery({
    queryKey: ['branches-lite'],
    queryFn: async () => (await api.get<any[]>('/organization/branches')).data,
    enabled: tab === 'batches' || Boolean(batchModal),
  });

  // Mutators
  const saveCourse = useMutation({
    mutationFn: () => {
      if (courseModal === 'new') {
        return api.post('/courses', courseForm);
      } else {
        return api.patch(`/courses/${courseModal!.id}`, courseForm);
      }
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['courses'] });
      qc.invalidateQueries({ queryKey: ['courses-lite'] });
      setCourseModal(null);
      toast.success(courseModal === 'new' ? 'Course created' : 'Course updated');
    },
    onError: (e) => toast.error(apiErrorMessage(e)),
  });

  const deleteCourse = useMutation({
    mutationFn: (id: string) => api.delete(`/courses/${id}`),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['courses'] });
      qc.invalidateQueries({ queryKey: ['courses-lite'] });
      toast.success('Course deleted successfully');
    },
    onError: (e) => toast.error(apiErrorMessage(e)),
  });

  const saveBatch = useMutation({
    mutationFn: () => {
      if (batchModal === 'new') {
        return api.post('/courses/batches', batchForm);
      } else {
        // courseId is not allowed in UpdateBatchDto — strip it before patching
        // eslint-disable-next-line @typescript-eslint/no-unused-vars
        const { courseId: _courseId, ...patchPayload } = batchForm;
        return api.patch(`/courses/batches/${batchModal!.id}`, patchPayload);
      }
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['batches'] });
      setBatchModal(null);
      toast.success(batchModal === 'new' ? 'Batch created' : 'Batch updated');
    },
    onError: (e) => toast.error(apiErrorMessage(e)),
  });

  const deleteBatch = useMutation({
    mutationFn: (id: string) => api.delete(`/courses/batches/${id}`),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['batches'] });
      toast.success('Batch deleted');
    },
    onError: (e) => toast.error(apiErrorMessage(e)),
  });

  const saveCategory = useMutation({
    mutationFn: () => api.post('/courses/categories', { name: categoryName, description: categoryDesc }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['categories'] });
      setCategoryName('');
      setCategoryDesc('');
      setCategoryModal(false);
      toast.success('Category created');
    },
    onError: (e) => toast.error(apiErrorMessage(e)),
  });

  const deleteCategory = useMutation({
    mutationFn: (id: string) => api.delete(`/courses/categories/${id}`),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['categories'] });
      toast.success('Category deleted');
    },
    onError: (e) => toast.error(apiErrorMessage(e)),
  });

  const handleOpenCourse = (c: CourseRow | 'new') => {
    if (c === 'new') {
      setCourseForm({
        name: '',
        code: '',
        categoryId: categoriesData?.[0]?.id || '',
        description: '',
        durationValue: 1,
        durationUnit: 'MONTH',
        fee: 0,
        seats: 0,
        status: 'ACTIVE',
      });
    } else {
      setCourseForm({
        name: c.name,
        code: c.code,
        categoryId: c.category?.id || '',
        description: c.description || '',
        durationValue: c.durationValue,
        durationUnit: c.durationUnit,
        fee: c.fee,
        seats: c.seats,
        status: c.status,
      });
    }
    setCourseModal(c);
  };

  const handleOpenBatch = (b: BatchRow | 'new') => {
    if (b === 'new') {
      setBatchForm({
        courseId: coursesData?.data?.[0]?.id || '',
        branchId: branches?.[0]?.id || '',
        name: '',
        code: '',
        startDate: '',
        endDate: '',
        capacity: 0,
        status: 'UPCOMING',
      });
    } else {
      setBatchForm({
        courseId: b.course.id,
        branchId: b.branch?.id || '',
        name: b.name,
        code: b.code,
        startDate: b.startDate ? new Date(b.startDate).toISOString().slice(0, 10) : '',
        endDate: b.endDate ? new Date(b.endDate).toISOString().slice(0, 10) : '',
        capacity: b.capacity,
        status: b.status,
      });
    }
    setBatchModal(b);
  };

  const canManage = hasPermission('course.manage');

  return (
    <div style={{ animation: 'fadeUp .4s ease' }}>
      {/* Title Header */}
      <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', gap: 20, flexWrap: 'wrap', marginBottom: 22 }}>
        <div>
          <h1 style={{ fontSize: 28, fontWeight: 700, letterSpacing: '-.02em', margin: 0, lineHeight: 1.1 }}>Course Workspace</h1>
          <p style={{ fontSize: 14, color: 'var(--ink-2)', margin: '6px 0 0' }}>
            Configure institute curriculums, organize upcoming batches, define tuition structures, and track cohort capacities.
          </p>
        </div>
        {canManage && (
          <div style={{ display: 'flex', gap: 8 }}>
            {tab === 'courses' && (
              <button className="btn-primary" onClick={() => handleOpenCourse('new')}>
                <Plus size={16} />Add Course
              </button>
            )}
            {tab === 'batches' && (
              <button className="btn-primary" onClick={() => handleOpenBatch('new')}>
                <Calendar size={16} style={{ marginRight: 6 }} />Add Batch
              </button>
            )}
            {tab === 'categories' && (
              <button className="btn-primary" onClick={() => setCategoryModal(true)}>
                <Layers size={16} style={{ marginRight: 6 }} />Add Category
              </button>
            )}
          </div>
        )}
      </div>

      {/* Workspace Tabs */}
      <div style={{ display: 'flex', gap: 10, borderBottom: '1px solid var(--line-soft)', paddingBottom: 12, marginBottom: 20 }}>
        <button className={tab === 'courses' ? 'btn-primary' : 'btn-secondary'} onClick={() => { setTab('courses'); setPage(1); }} style={{ height: 36, padding: '0 16px', fontSize: 13 }}>
          Courses
        </button>
        <button className={tab === 'batches' ? 'btn-primary' : 'btn-secondary'} onClick={() => { setTab('batches'); setPage(1); }} style={{ height: 36, padding: '0 16px', fontSize: 13 }}>
          Batches
        </button>
        <button className={tab === 'categories' ? 'btn-primary' : 'btn-secondary'} onClick={() => { setTab('categories'); setPage(1); }} style={{ height: 36, padding: '0 16px', fontSize: 13 }}>
          Categories
        </button>
      </div>

      {/* Search and filter toolbar */}
      {tab !== 'categories' && (
        <div style={{ display: 'flex', gap: 12, marginBottom: 20, flexWrap: 'wrap' }}>
          <div style={{ display: 'flex', flex: 1, minWidth: 260, position: 'relative' }}>
            <Search size={16} style={{ position: 'absolute', left: 14, top: 12, color: 'var(--ink-3)' }} />
            <input
              className="input"
              style={{ paddingLeft: 38 }}
              placeholder={tab === 'courses' ? 'Search by course name or code…' : 'Search by batch name or code…'}
              value={search}
              onChange={(e) => { setSearch(e.target.value); setPage(1); }}
            />
          </div>
          {tab === 'courses' && (
            <select className="input" style={{ width: 200 }} value={categoryId} onChange={(e) => { setCategoryId(e.target.value); setPage(1); }}>
              <option value="">All Categories</option>
              {categoriesData?.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
          )}
          {tab === 'batches' && (
            <select className="input" style={{ width: 220 }} value={courseFilter} onChange={(e) => { setCourseFilter(e.target.value); setPage(1); }}>
              <option value="">All Courses</option>
              {coursesData?.data?.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
          )}
        </div>
      )}

      {/* TAB CONTENTS: COURSES */}
      {tab === 'courses' && (
        <div>
          <div className="card" style={{ overflow: 'hidden' }}>
            <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr 1fr 1.2fr 1.6fr 1fr', gap: 12, padding: '14px 22px', borderBottom: '1px solid var(--line-soft)', fontFamily: 'var(--mono)', fontSize: 10, letterSpacing: '.1em', textTransform: 'uppercase', color: 'var(--ink-3)' }}>
              <div>Course Name & Code</div>
              <div>Category</div>
              <div>Duration</div>
              <div>Tuition Fee</div>
              <div>Seats Utilized</div>
              <div style={{ textAlign: 'right' }}>Actions</div>
            </div>

            {loadingCourses && <div style={{ padding: 40, textAlign: 'center', color: 'var(--ink-3)' }}>Loading courses…</div>}
            {coursesData?.data?.length === 0 && <div style={{ padding: 40, textAlign: 'center', color: 'var(--ink-3)' }}>No courses found.</div>}

            {coursesData?.data?.map((course) => {
              const enrolled = course._count?.enrollments ?? 0;
              const cap = course.seats;
              const pct = cap > 0 ? Math.min(100, Math.round((enrolled / cap) * 100)) : 0;
              const isFull = cap > 0 && enrolled >= cap;

              return (
                <div
                  key={course.id}
                  style={{ display: 'grid', gridTemplateColumns: '2fr 1fr 1fr 1.2fr 1.6fr 1fr', gap: 12, padding: '16px 22px', borderBottom: '1px solid var(--line-soft)', alignItems: 'center' }}
                >
                  <div>
                    <div style={{ fontWeight: 600, fontSize: 14.5 }}>{course.name}</div>
                    <div style={{ display: 'flex', gap: 8, marginTop: 4 }}>
                      <span style={{ fontFamily: 'var(--mono)', fontSize: 11.5, fontWeight: 700, color: 'var(--navy)' }}>{course.code}</span>
                      <span style={courseStatusBadgeStyle(course.status)}>{course.status}</span>
                    </div>
                  </div>
                  <div style={{ fontSize: 13, color: 'var(--ink-2)' }}>{course.category?.name ?? 'General'}</div>
                  <div style={{ fontSize: 13, color: 'var(--ink-2)' }}>{course.durationValue} {DURATION_LABELS[course.durationUnit]}</div>
                  <div style={{ fontSize: 13.5, fontWeight: 600 }}>{formatCurrency(course.fee)}</div>
                  <div>
                    {cap > 0 ? (
                      <div>
                        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, fontWeight: 600, marginBottom: 4, color: isFull ? 'var(--danger)' : 'var(--ink-3)' }}>
                          <span>{enrolled} / {cap} seats</span>
                          <span>{pct}% filled</span>
                        </div>
                        <div style={{ height: 6, background: 'var(--surface-2)', borderRadius: 9, overflow: 'hidden' }}>
                          <div style={{ width: `${pct}%`, height: '100%', background: isFull ? 'var(--danger)' : 'var(--success)' }} />
                        </div>
                      </div>
                    ) : (
                      <span style={{ fontSize: 12.5, color: 'var(--ink-3)' }}>Unlimited Seats</span>
                    )}
                  </div>
                  <div style={{ textAlign: 'right', display: 'flex', justifyContent: 'end', gap: 8 }}>
                    {canManage && (
                      <>
                        <button className="btn-secondary" style={{ padding: 6, height: 32, width: 32 }} title="Edit Course" onClick={() => handleOpenCourse(course)}>
                          <Edit3 size={14} />
                        </button>
                        <button className="btn-secondary" style={{ padding: 6, height: 32, width: 32, color: 'var(--danger)' }} title="Delete Course" onClick={() => confirm('Delete this course?') && deleteCourse.mutate(course.id)}>
                          <Trash2 size={14} />
                        </button>
                      </>
                    )}
                  </div>
                </div>
              );
            })}

            {/* Pagination */}
            {coursesData && coursesData.meta.totalPages > 1 && (
              <div style={{ padding: '12px 22px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: 'var(--surface-2)' }}>
                <button className="btn-secondary" style={{ padding: '6px 12px', fontSize: 12.5 }} disabled={page === 1} onClick={() => setPage(p => Math.max(1, p - 1))}>Previous</button>
                <span style={{ fontSize: 13, color: 'var(--ink-3)' }}>Page {page} of {coursesData.meta.totalPages}</span>
                <button className="btn-secondary" style={{ padding: '6px 12px', fontSize: 12.5 }} disabled={page === coursesData.meta.totalPages} onClick={() => setPage(p => p + 1)}>Next</button>
              </div>
            )}
          </div>
        </div>
      )}

      {/* TAB CONTENTS: BATCHES */}
      {tab === 'batches' && (
        <div>
          <div className="card" style={{ overflow: 'hidden' }}>
            <div style={{ display: 'grid', gridTemplateColumns: '1.8fr 1.6fr 1.2fr 1.4fr 1fr', gap: 12, padding: '14px 22px', borderBottom: '1px solid var(--line-soft)', fontFamily: 'var(--mono)', fontSize: 10, letterSpacing: '.1em', textTransform: 'uppercase', color: 'var(--ink-3)' }}>
              <div>Batch Code & Name</div>
              <div>Course</div>
              <div>Date Schedule</div>
              <div>Capacity Utilized</div>
              <div style={{ textAlign: 'right' }}>Actions</div>
            </div>

            {loadingBatches && <div style={{ padding: 40, textAlign: 'center', color: 'var(--ink-3)' }}>Loading batches…</div>}
            {batchesData?.data?.length === 0 && <div style={{ padding: 40, textAlign: 'center', color: 'var(--ink-3)' }}>No batches found.</div>}

            {batchesData?.data?.map((batch) => {
              const enrolled = batch._count?.enrollments ?? 0;
              const cap = batch.capacity;
              const pct = cap > 0 ? Math.min(100, Math.round((enrolled / cap) * 100)) : 0;
              const isFull = cap > 0 && enrolled >= cap;

              return (
                <div
                  key={batch.id}
                  style={{ display: 'grid', gridTemplateColumns: '1.8fr 1.6fr 1.2fr 1.4fr 1fr', gap: 12, padding: '16px 22px', borderBottom: '1px solid var(--line-soft)', alignItems: 'center' }}
                >
                  <div>
                    <div style={{ fontWeight: 600, fontSize: 14.5 }}>{batch.name}</div>
                    <div style={{ display: 'flex', gap: 8, marginTop: 4, alignItems: 'center' }}>
                      <span style={{ fontFamily: 'var(--mono)', fontSize: 11.5, fontWeight: 700, color: 'var(--navy)' }}>{batch.code}</span>
                      <span style={batchStatusBadgeStyle(batch.status)}>{BATCH_STATUS_LABELS[batch.status]}</span>
                    </div>
                  </div>
                  <div style={{ fontSize: 13, color: 'var(--ink-2)' }}>{batch.course.name}</div>
                  <div style={{ fontSize: 12.5, color: 'var(--ink-2)' }}>
                    <div>S: {batch.startDate ? formatDate(batch.startDate) : '—'}</div>
                    <div style={{ marginTop: 2 }}>E: {batch.endDate ? formatDate(batch.endDate) : '—'}</div>
                  </div>
                  <div>
                    {cap > 0 ? (
                      <div>
                        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, fontWeight: 600, marginBottom: 4, color: isFull ? 'var(--danger)' : 'var(--ink-3)' }}>
                          <span>{enrolled} / {cap} seats</span>
                          <span>{pct}% filled</span>
                        </div>
                        <div style={{ height: 6, background: 'var(--surface-2)', borderRadius: 9, overflow: 'hidden' }}>
                          <div style={{ width: `${pct}%`, height: '100%', background: isFull ? 'var(--danger)' : 'var(--success)' }} />
                        </div>
                      </div>
                    ) : (
                      <span style={{ fontSize: 12.5, color: 'var(--ink-3)' }}>No Capacity Limit</span>
                    )}
                  </div>
                  <div style={{ textAlign: 'right', display: 'flex', justifyContent: 'end', gap: 8 }}>
                    {canManage && (
                      <>
                        <button className="btn-secondary" style={{ padding: 6, height: 32, width: 32 }} title="Edit Batch" onClick={() => handleOpenBatch(batch)}>
                          <Edit3 size={14} />
                        </button>
                        <button className="btn-secondary" style={{ padding: 6, height: 32, width: 32, color: 'var(--danger)' }} title="Delete Batch" onClick={() => confirm('Delete this batch?') && deleteBatch.mutate(batch.id)}>
                          <Trash2 size={14} />
                        </button>
                      </>
                    )}
                  </div>
                </div>
              );
            })}

            {/* Pagination */}
            {batchesData && batchesData.meta.totalPages > 1 && (
              <div style={{ padding: '12px 22px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: 'var(--surface-2)' }}>
                <button className="btn-secondary" style={{ padding: '6px 12px', fontSize: 12.5 }} disabled={page === 1} onClick={() => setPage(p => Math.max(1, p - 1))}>Previous</button>
                <span style={{ fontSize: 13, color: 'var(--ink-3)' }}>Page {page} of {batchesData.meta.totalPages}</span>
                <button className="btn-secondary" style={{ padding: '6px 12px', fontSize: 12.5 }} disabled={page === batchesData.meta.totalPages} onClick={() => setPage(p => p + 1)}>Next</button>
              </div>
            )}
          </div>
        </div>
      )}

      {/* TAB CONTENTS: CATEGORIES */}
      {tab === 'categories' && (
        <div style={{ animation: 'fadeUp .3s ease' }}>
          <div className="card" style={{ overflow: 'hidden' }}>
            <div style={{ display: 'grid', gridTemplateColumns: '2fr 3fr 1fr 1fr', gap: 12, padding: '14px 22px', borderBottom: '1px solid var(--line-soft)', fontFamily: 'var(--mono)', fontSize: 10, letterSpacing: '.1em', textTransform: 'uppercase', color: 'var(--ink-3)' }}>
              <div>Category Name</div>
              <div>Description</div>
              <div>Course Count</div>
              <div style={{ textAlign: 'right' }}>Actions</div>
            </div>

            {loadingCategories && <div style={{ padding: 40, textAlign: 'center', color: 'var(--ink-3)' }}>Loading categories…</div>}
            {categoriesData?.length === 0 && <div style={{ padding: 40, textAlign: 'center', color: 'var(--ink-3)' }}>No categories created.</div>}

            {categoriesData?.map((cat) => (
              <div
                key={cat.id}
                style={{ display: 'grid', gridTemplateColumns: '2fr 3fr 1fr 1fr', gap: 12, padding: '16px 22px', borderBottom: '1px solid var(--line-soft)', alignItems: 'center' }}
              >
                <div style={{ fontWeight: 600, fontSize: 14.5 }}>{cat.name}</div>
                <div style={{ fontSize: 13, color: 'var(--ink-2)' }}>{cat.description || '—'}</div>
                <div style={{ fontSize: 13.5, fontWeight: 600 }}>{cat._count?.courses ?? 0} courses</div>
                <div style={{ textAlign: 'right' }}>
                  {canManage && (
                    <button className="btn-secondary" style={{ padding: 6, height: 32, width: 32, color: 'var(--danger)' }} title="Delete Category" onClick={() => confirm('Delete this category?') && deleteCategory.mutate(cat.id)}>
                      <Trash2 size={14} />
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* COURSE DRAWER MODAL */}
      {courseModal && (
        <Modal open={Boolean(courseModal)} onClose={() => setCourseModal(null)} title={courseModal === 'new' ? 'Add New Course' : 'Edit Course'}>
          <form onSubmit={(e) => { e.preventDefault(); saveCourse.mutate(); }} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: 12 }}>
              <Field label="Course Title">
                <input className="input" placeholder="e.g. Web Development" value={courseForm.name} onChange={(e) => setCourseForm({ ...courseForm, name: e.target.value })} required />
              </Field>
              <Field label="Code">
                <input className="input" placeholder="e.g. FSWD" value={courseForm.code} onChange={(e) => setCourseForm({ ...courseForm, code: e.target.value })} required />
              </Field>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
              <Field label="Category">
                <select className="input" value={courseForm.categoryId} onChange={(e) => setCourseForm({ ...courseForm, categoryId: e.target.value })}>
                  <option value="">Select category…</option>
                  {categoriesData?.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
                </select>
              </Field>
              <Field label="Course Status">
                <select className="input" value={courseForm.status} onChange={(e) => setCourseForm({ ...courseForm, status: e.target.value })}>
                  <option value="ACTIVE">Active</option>
                  <option value="INACTIVE">Inactive</option>
                </select>
              </Field>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1.2fr', gap: 12 }}>
              <Field label="Duration Value">
                <input className="input" type="number" min="1" value={courseForm.durationValue} onChange={(e) => setCourseForm({ ...courseForm, durationValue: Number(e.target.value) })} required />
              </Field>
              <Field label="Duration Unit">
                <select className="input" value={courseForm.durationUnit} onChange={(e) => setCourseForm({ ...courseForm, durationUnit: e.target.value })}>
                  <option value="DAY">Days</option>
                  <option value="WEEK">Weeks</option>
                  <option value="MONTH">Months</option>
                  <option value="YEAR">Years</option>
                </select>
              </Field>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
              <Field label="Tuition Fee (INR)">
                <input className="input" type="number" min="0" value={courseForm.fee} onChange={(e) => setCourseForm({ ...courseForm, fee: Number(e.target.value) })} required />
              </Field>
              <Field label="Total Seats Capacity">
                <input className="input" type="number" min="0" value={courseForm.seats} onChange={(e) => setCourseForm({ ...courseForm, seats: Number(e.target.value) })} required />
              </Field>
            </div>

            <Field label="Description">
              <textarea className="input" rows={2} placeholder="Optional details…" value={courseForm.description} onChange={(e) => setCourseForm({ ...courseForm, description: e.target.value })} />
            </Field>

            <div style={{ display: 'flex', justifyContent: 'end', gap: 10, marginTop: 10 }}>
              <button type="button" className="btn-secondary" onClick={() => setCourseModal(null)}>Cancel</button>
              <button type="submit" className="btn-primary" disabled={saveCourse.isPending}>
                {saveCourse.isPending ? 'Saving…' : 'Save Course'}
              </button>
            </div>
          </form>
        </Modal>
      )}

      {/* BATCH DRAWER MODAL */}
      {batchModal && (
        <Modal open={Boolean(batchModal)} onClose={() => setBatchModal(null)} title={batchModal === 'new' ? 'Add New Batch' : 'Edit Batch'}>
          <form onSubmit={(e) => { e.preventDefault(); saveBatch.mutate(); }} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            <div style={{ display: 'grid', gridTemplateColumns: '2fr 1.2fr', gap: 12 }}>
              <Field label="Batch Name">
                <input className="input" placeholder="e.g. Cohort-2026-Alpha" value={batchForm.name} onChange={(e) => setBatchForm({ ...batchForm, name: e.target.value })} required />
              </Field>
              <Field label="Code">
                <input className="input" placeholder="e.g. AL26" value={batchForm.code} onChange={(e) => setBatchForm({ ...batchForm, code: e.target.value })} required />
              </Field>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
              <Field label="Select Course">
                <select className="input" value={batchForm.courseId} onChange={(e) => setBatchForm({ ...batchForm, courseId: e.target.value })} disabled={batchModal !== 'new'} required>
                  <option value="">Select course…</option>
                  {coursesData?.data?.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
                </select>
              </Field>
              <Field label="Branch">
                <select className="input" value={batchForm.branchId} onChange={(e) => setBatchForm({ ...batchForm, branchId: e.target.value })}>
                  <option value="">Select branch…</option>
                  {branches?.map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}
                </select>
              </Field>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
              <Field label="Start Date">
                <input className="input" type="date" value={batchForm.startDate} onChange={(e) => setBatchForm({ ...batchForm, startDate: e.target.value })} />
              </Field>
              <Field label="End Date">
                <input className="input" type="date" value={batchForm.endDate} onChange={(e) => setBatchForm({ ...batchForm, endDate: e.target.value })} />
              </Field>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
              <Field label="Batch Capacity (seats)">
                <input className="input" type="number" min="0" value={batchForm.capacity} onChange={(e) => setBatchForm({ ...batchForm, capacity: Number(e.target.value) })} required />
              </Field>
              <Field label="Status">
                <select className="input" value={batchForm.status} onChange={(e) => setBatchForm({ ...batchForm, status: e.target.value })}>
                  <option value="UPCOMING">Upcoming</option>
                  <option value="ONGOING">Ongoing</option>
                  <option value="COMPLETED">Completed</option>
                  <option value="CANCELLED">Cancelled</option>
                </select>
              </Field>
            </div>

            <div style={{ display: 'flex', justifyContent: 'end', gap: 10, marginTop: 10 }}>
              <button type="button" className="btn-secondary" onClick={() => setBatchModal(null)}>Cancel</button>
              <button type="submit" className="btn-primary" disabled={saveBatch.isPending}>
                {saveBatch.isPending ? 'Saving…' : 'Save Batch'}
              </button>
            </div>
          </form>
        </Modal>
      )}

      {/* CATEGORY MODAL */}
      {categoryModal && (
        <Modal open={categoryModal} onClose={() => setCategoryModal(false)} title="Add Course Category">
          <form onSubmit={(e) => { e.preventDefault(); saveCategory.mutate(); }} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            <Field label="Category Title">
              <input className="input" placeholder="e.g. Design, Software Development" value={categoryName} onChange={(e) => setCategoryName(e.target.value)} required />
            </Field>
            <Field label="Description">
              <textarea className="input" rows={3} placeholder="Optional details…" value={categoryDesc} onChange={(e) => setCategoryDesc(e.target.value)} />
            </Field>
            <div style={{ display: 'flex', justifyContent: 'end', gap: 10, marginTop: 10 }}>
              <button type="button" className="btn-secondary" onClick={() => setCategoryModal(false)}>Cancel</button>
              <button type="submit" className="btn-primary" disabled={saveCategory.isPending}>
                {saveCategory.isPending ? 'Create Category' : 'Create Category'}
              </button>
            </div>
          </form>
        </Modal>
      )}
    </div>
  );
}

export function CoursesListFeature() {
  return (
    <Suspense fallback={<div style={{ color: 'var(--ink-3)' }}>Loading…</div>}>
      <CoursesInner />
    </Suspense>
  );
}
