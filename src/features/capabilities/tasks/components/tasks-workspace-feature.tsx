'use client';

import { Suspense, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import {
  Search, Plus, CheckCircle, Clock, MessageSquare, AlertCircle, X,
  Trash2, User, LayoutGrid, ListFilter, ShieldAlert, Sparkles, Send, Calendar, CheckSquare
} from 'lucide-react';
import { api, apiErrorMessage } from '@/lib/api';
import { useAuth } from '@/features/foundation/auth';
import { Modal } from '@/components/molecules/modal';
import { Field } from '@/components/molecules/field';
import {
  TaskRow, TaskCommentRow, TASK_STATUSES, STATUS_LABELS,
  PRIORITY_LABELS, priorityBadgeStyle, statusBadgeStyle, TaskStatus, TaskPriority, RelatedEntity
} from '../tasks-utils';
import type { Paginated } from '@/lib/types';
import { avatarStyle, studentInitials } from '@/features/verticals/education/students/students-utils';
import { formatDate } from '@/lib/utils';

type ViewMode = 'kanban' | 'list';

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

function TasksInner() {
  const router = useRouter();
  const qc = useQueryClient();
  const { hasPermission, user: currentUser } = useAuth();

  // View settings
  const [viewMode, setViewMode] = useState<ViewMode>('kanban');
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [selectedTaskId, setSelectedTaskId] = useState<string | null>(null);

  // Filters
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [priorityFilter, setPriorityFilter] = useState('');
  const [assigneeFilter, setAssigneeFilter] = useState('');
  const [page, setPage] = useState(1);

  // Forms
  const [form, setForm] = useState({
    title: '',
    description: '',
    priority: 'MEDIUM' as TaskPriority,
    status: 'TODO' as TaskStatus,
    dueDate: '',
    assignedToId: '',
    relatedType: 'NONE' as RelatedEntity,
    relatedId: '',
  });

  const [commentDraft, setCommentDraft] = useState('');

  // Fetch tasks
  const { data: tasksData, isLoading: loadingTasks } = useQuery({
    queryKey: ['tasks', search, statusFilter, priorityFilter, assigneeFilter, page],
    queryFn: async () => {
      const p = new URLSearchParams();
      p.set('page', String(page));
      p.set('limit', '40'); // Fetch enough to show columns
      if (search) p.set('search', search);
      if (statusFilter) p.set('status', statusFilter);
      if (priorityFilter) p.set('priority', priorityFilter);
      if (assigneeFilter) p.set('assignedToId', assigneeFilter);
      return (await api.get<Paginated<TaskRow>>(`/tasks?${p.toString()}`)).data;
    },
  });

  // Fetch counselors
  const { data: users } = useQuery({
    queryKey: ['users-list'],
    queryFn: async () => {
      const res = await api.get<any>('/users');
      return Array.isArray(res.data) ? res.data : res.data?.data || [];
    },
  });

  // Fetch task detail (if selected)
  const { data: taskDetail } = useQuery({
    queryKey: ['task-detail', selectedTaskId],
    queryFn: async () => (await api.get<TaskRow>(`/tasks/${selectedTaskId}`)).data,
    enabled: Boolean(selectedTaskId),
  });

  // Fetch leads for relation linking
  const { data: leads } = useQuery({
    queryKey: ['leads-lite-tasks'],
    queryFn: async () => {
      const res = await api.get<any>('/leads?limit=100');
      return res.data?.data || [];
    },
    enabled: drawerOpen && form.relatedType === 'LEAD',
  });

  // Fetch students for relation linking
  const { data: students } = useQuery({
    queryKey: ['students-lite-tasks'],
    queryFn: async () => {
      const res = await api.get<any>('/students?limit=100');
      return res.data?.data || [];
    },
    enabled: drawerOpen && form.relatedType === 'STUDENT',
  });

  // Mutators
  const createTask = useMutation({
    mutationFn: () => api.post('/tasks', {
      ...form,
      dueDate: form.dueDate || undefined,
      assignedToId: form.assignedToId || undefined,
      relatedId: form.relatedType !== 'NONE' ? form.relatedId : undefined,
    }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['tasks'] });
      setDrawerOpen(false);
      setForm({ title: '', description: '', priority: 'MEDIUM', status: 'TODO', dueDate: '', assignedToId: '', relatedType: 'NONE', relatedId: '' });
      toast.success('Task created successfully');
    },
    onError: (e) => toast.error(apiErrorMessage(e)),
  });

  const updateTask = useMutation({
    mutationFn: (payload: any) => api.patch(`/tasks/${selectedTaskId}`, payload),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['tasks'] });
      qc.invalidateQueries({ queryKey: ['task-detail', selectedTaskId] });
      toast.success('Task updated');
    },
    onError: (e) => toast.error(apiErrorMessage(e)),
  });

  const deleteTask = useMutation({
    mutationFn: () => api.delete(`/tasks/${selectedTaskId}`),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['tasks'] });
      setSelectedTaskId(null);
      toast.success('Task deleted successfully');
    },
    onError: (e) => toast.error(apiErrorMessage(e)),
  });

  const addComment = useMutation({
    mutationFn: () => api.post(`/tasks/${selectedTaskId}/comments`, { body: commentDraft }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['task-detail', selectedTaskId] });
      qc.invalidateQueries({ queryKey: ['tasks'] });
      setCommentDraft('');
      toast.success('Comment posted');
    },
    onError: (e) => toast.error(apiErrorMessage(e)),
  });

  const isOverdue = (dueDate?: string | null, status?: TaskStatus) => {
    if (!dueDate || status === 'DONE') return false;
    return new Date(dueDate) < new Date();
  };

  const list = tasksData?.data || [];
  
  // Stats
  const completedCount = list.filter(t => t.status === 'DONE').length;
  const inProgressCount = list.filter(t => t.status === 'IN_PROGRESS').length;
  const overdueCount = list.filter(t => isOverdue(t.dueDate, t.status)).length;
  const totalTodo = list.filter(t => t.status === 'TODO').length;

  const kpis = [
    { label: 'To Do Tasks', value: String(totalTodo), icon: CheckSquare, tint: 'var(--surface-2)', color: 'var(--ink)' },
    { label: 'In Progress', value: String(inProgressCount), icon: Clock, tint: 'var(--gold-bg)', color: 'var(--gold-ink)' },
    { label: 'Completed Tasks', value: String(completedCount), icon: CheckCircle, tint: 'var(--success-bg)', color: 'var(--success)' },
    { label: 'Overdue Tasks', value: String(overdueCount), icon: AlertCircle, tint: 'var(--danger-bg)', color: 'var(--danger)' },
  ];

  const canManage = hasPermission('task.manage');
  const COLS = '2fr 1fr 1.2fr 1.2fr 1fr 0.8fr';

  return (
    <div style={{ animation: 'fadeUp .4s ease' }}>
      {/* Workspace Header */}
      <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', gap: 20, flexWrap: 'wrap', marginBottom: 22 }}>
        <div>
          <h1 style={{ fontSize: 28, fontWeight: 700, letterSpacing: '-.02em', margin: 0, lineHeight: 1.1 }}>Tasks Workspace</h1>
          <p style={{ fontSize: 14, color: 'var(--ink-2)', margin: '6px 0 0' }}>
            Coordinate counsellor operations, set follow-up targets, collaborate in threads, and monitor deadlines.
          </p>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <div style={{ display: 'flex', background: 'var(--surface-2)', padding: 3, borderRadius: 10, border: '1px solid var(--line-soft)' }}>
            <button
              onClick={() => setViewMode('kanban')}
              style={{
                display: 'flex', alignItems: 'center', gap: 6, border: 'none', padding: '6px 12px', borderRadius: 8, fontSize: 12.5, fontWeight: 600, cursor: 'pointer',
                background: viewMode === 'kanban' ? 'var(--surface)' : 'none', color: viewMode === 'kanban' ? 'var(--ink)' : 'var(--ink-3)',
                boxShadow: viewMode === 'kanban' ? 'var(--shadow-sm)' : 'none'
              }}
            >
              <LayoutGrid size={14} />Kanban
            </button>
            <button
              onClick={() => setViewMode('list')}
              style={{
                display: 'flex', alignItems: 'center', gap: 6, border: 'none', padding: '6px 12px', borderRadius: 8, fontSize: 12.5, fontWeight: 600, cursor: 'pointer',
                background: viewMode === 'list' ? 'var(--surface)' : 'none', color: viewMode === 'list' ? 'var(--ink)' : 'var(--ink-3)',
                boxShadow: viewMode === 'list' ? 'var(--shadow-sm)' : 'none'
              }}
            >
              <ListFilter size={14} />List View
            </button>
          </div>
          {canManage && (
            <button className="btn-primary" style={{ height: 40 }} onClick={() => setDrawerOpen(true)}>
              <Plus size={16} />Add Task
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

      {/* Filters */}
      <div style={{ display: 'flex', gap: 12, marginBottom: 20, flexWrap: 'wrap' }}>
        <div style={{ display: 'flex', flex: 1, minWidth: 260, position: 'relative' }}>
          <Search size={16} style={{ position: 'absolute', left: 14, top: 12, color: 'var(--ink-3)' }} />
          <input
            className="input"
            style={{ paddingLeft: 38 }}
            placeholder="Search tasks by title or details…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
        <div style={{ display: 'flex', gap: 10 }}>
          <select className="input" style={{ width: 140 }} value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}>
            <option value="">All Statuses</option>
            {TASK_STATUSES.map(s => <option key={s} value={s}>{STATUS_LABELS[s]}</option>)}
          </select>
          <select className="input" style={{ width: 140 }} value={priorityFilter} onChange={(e) => setPriorityFilter(e.target.value)}>
            <option value="">All Priorities</option>
            {Object.entries(PRIORITY_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
          </select>
          <select className="input" style={{ width: 180 }} value={assigneeFilter} onChange={(e) => setAssigneeFilter(e.target.value)}>
            <option value="">All Assignees</option>
            {users?.map((u: any) => <option key={u.id} value={u.id}>{u.firstName} {u.lastName ?? ''}</option>)}
          </select>
        </div>
      </div>

      {/* KANBAN BOARD */}
      {viewMode === 'kanban' && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 14, overflowX: 'auto', paddingBottom: 16 }}>
          {TASK_STATUSES.map((status) => {
            const statusTasks = list.filter(t => t.status === status);
            return (
              <div key={status} style={{ background: 'var(--surface-2)', borderRadius: 18, padding: 14, minWidth: 220, display: 'flex', flexDirection: 'column', gap: 10, border: '1px solid var(--line-soft)' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
                  <span style={{ fontSize: 11.5, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '.05em', color: 'var(--navy)' }}>
                    {STATUS_LABELS[status]}
                  </span>
                  <span style={{ fontSize: 11, background: 'var(--surface)', padding: '2px 7px', borderRadius: 9, fontWeight: 700 }}>
                    {statusTasks.length}
                  </span>
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', gap: 10, flex: 1, overflowY: 'auto', maxHeight: '55vh' }}>
                  {statusTasks.map((t) => {
                    const overdue = isOverdue(t.dueDate, t.status);
                    return (
                      <div
                        key={t.id}
                        onClick={() => setSelectedTaskId(t.id)}
                        style={{ ...card, borderRadius: 14, padding: 14, cursor: 'pointer', display: 'flex', flexDirection: 'column', gap: 8, transition: 'transform 0.15s ease', border: overdue ? '1px solid var(--danger)' : '1px solid var(--line-soft)' }}
                        onMouseEnter={(e) => e.currentTarget.style.transform = 'translateY(-2px)'}
                        onMouseLeave={(e) => e.currentTarget.style.transform = 'translateY(0)'}
                      >
                        <div style={{ fontWeight: 600, fontSize: 13.5, color: 'var(--ink)' }}>{t.title}</div>
                        {t.description && <p style={{ fontSize: 12, color: 'var(--ink-3)', margin: 0, overflow: 'hidden', textOverflow: 'ellipsis', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', lineHeight: 1.4 }}>{t.description}</p>}
                        
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10, marginTop: 4, flexWrap: 'wrap' }}>
                          <span style={priorityBadgeStyle(t.priority)}>{PRIORITY_LABELS[t.priority]}</span>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                            {t._count?.comments > 0 && (
                              <span style={{ display: 'inline-flex', alignItems: 'center', gap: 3, fontSize: 11.5, color: 'var(--ink-3)' }}>
                                <MessageSquare size={11} />{t._count.comments}
                              </span>
                            )}
                            {t.assignedTo ? (
                              <span style={avatarStyle(t.assignedTo.id, 24)} title={`Assigned to ${t.assignedTo.firstName}`}>{studentInitials(t.assignedTo)}</span>
                            ) : (
                              <span style={{ width: 24, height: 24, borderRadius: 99, background: 'var(--surface-2)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}><User size={11} color="var(--ink-3)" /></span>
                            )}
                          </div>
                        </div>

                        {t.dueDate && (
                          <div style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: 11.5, color: overdue ? 'var(--danger)' : 'var(--ink-3)', fontWeight: overdue ? 700 : 500, borderTop: '1px solid var(--line-soft)', paddingTop: 8, marginTop: 2 }}>
                            <Calendar size={11} />
                            Due: {formatDate(t.dueDate)}
                            {overdue && <span style={{ marginLeft: 'auto', fontSize: 10, background: 'var(--danger-bg)', color: 'var(--danger)', padding: '1px 5px', borderRadius: 4 }}>Overdue</span>}
                          </div>
                        )}
                      </div>
                    );
                  })}
                  {statusTasks.length === 0 && (
                    <div style={{ padding: '24px 10px', textAlign: 'center', color: 'var(--ink-3)', fontSize: 12, border: '1.5px dashed var(--line)', borderRadius: 12 }}>
                      No tasks
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* TABLE LIST VIEW */}
      {viewMode === 'list' && (
        <div className="card" style={{ overflow: 'hidden' }}>
          <div style={{ display: 'grid', gridTemplateColumns: COLS, gap: 12, padding: '14px 22px', borderBottom: '1px solid var(--line-soft)', fontFamily: 'var(--mono)', fontSize: 10, letterSpacing: '.1em', textTransform: 'uppercase', color: 'var(--ink-3)' }}>
            <div>Task Checklist</div>
            <div>Priority</div>
            <div>Due Date</div>
            <div>Assignee</div>
            <div>Status</div>
            <div style={{ textAlign: 'right' }}>Comments</div>
          </div>

          {loadingTasks && <div style={{ padding: 40, textAlign: 'center', color: 'var(--ink-3)' }}>Loading tasks…</div>}
          {list.length === 0 && <div style={{ padding: 40, textAlign: 'center', color: 'var(--ink-3)' }}>No tasks found.</div>}

          {list.map((t) => {
            const overdue = isOverdue(t.dueDate, t.status);
            return (
              <div
                key={t.id}
                onClick={() => setSelectedTaskId(t.id)}
                className="student-row"
                style={{ display: 'grid', gridTemplateColumns: COLS, gap: 12, padding: '14px 22px', borderBottom: '1px solid var(--line-soft)', alignItems: 'center', cursor: 'pointer' }}
              >
                <div>
                  <div style={{ fontWeight: 600, fontSize: 13.5 }}>{t.title}</div>
                  {t.description && <div style={{ fontSize: 11.5, color: 'var(--ink-3)', marginTop: 2, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{t.description}</div>}
                </div>
                <div><span style={priorityBadgeStyle(t.priority)}>{PRIORITY_LABELS[t.priority]}</span></div>
                <div style={{ fontSize: 12.5, color: overdue ? 'var(--danger)' : 'var(--ink-2)', fontWeight: overdue ? 700 : 500 }}>
                  {t.dueDate ? formatDate(t.dueDate) : '—'}
                  {overdue && <span style={{ marginLeft: 6, fontSize: 9.5, background: 'var(--danger-bg)', color: 'var(--danger)', padding: '2px 5px', borderRadius: 4 }}>Overdue</span>}
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  {t.assignedTo ? (
                    <>
                      <span style={avatarStyle(t.assignedTo.id, 24)}>{studentInitials(t.assignedTo)}</span>
                      <span style={{ fontSize: 13 }}>{t.assignedTo.firstName}</span>
                    </>
                  ) : (
                    <span style={{ fontSize: 12.5, color: 'var(--ink-3)' }}>Unassigned</span>
                  )}
                </div>
                <div><span style={statusBadgeStyle(t.status)}>{STATUS_LABELS[t.status]}</span></div>
                <div style={{ textAlign: 'right', fontSize: 12.5, color: 'var(--ink-3)', display: 'flex', alignItems: 'center', justifyContent: 'end', gap: 5 }}>
                  <MessageSquare size={13} /> {t._count?.comments ?? 0}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* CREATE NEW TASK DRAWER */}
      {drawerOpen && (
        <>
          <div onClick={() => setDrawerOpen(false)} style={{ position: 'fixed', inset: 0, zIndex: 60, background: 'rgba(20,15,12,.42)', backdropFilter: 'blur(2px)' }} />
          <div
            style={{
              position: 'fixed', top: 0, right: 0, bottom: 0, zIndex: 61, width: 440, maxWidth: '100%',
              background: 'var(--surface)', borderLeft: '1px solid var(--line)', boxShadow: '-24px 0 60px rgba(0,0,0,.14)',
              animation: 'slideIn .3s cubic-bezier(.2,.8,.2,1)', display: 'flex', flexDirection: 'column',
            }}
          >
            <div style={{ padding: '22px 24px', borderBottom: '1px solid var(--line-soft)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <div>
                <div style={{ fontWeight: 700, fontSize: 17 }}>Create New Task</div>
                <div style={{ fontSize: 12.5, color: 'var(--ink-3)' }}>Add checklist items or counsellor reminders</div>
              </div>
              <button onClick={() => setDrawerOpen(false)} style={{ width: 34, height: 34, borderRadius: 9, border: '1px solid var(--line)', background: 'var(--surface)', color: 'var(--ink-2)', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <X size={16} />
              </button>
            </div>

            <div style={{ flex: 1, overflowY: 'auto', padding: '22px 24px', display: 'flex', flexDirection: 'column', gap: 16 }}>
              <Field label="Task Title">
                <input className="input" value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} placeholder="e.g. Call back Priya Sharma" required />
              </Field>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                <Field label="Priority">
                  <select className="input" value={form.priority} onChange={(e) => setForm({ ...form, priority: e.target.value as TaskPriority })}>
                    <option value="LOW">Low</option>
                    <option value="MEDIUM">Medium</option>
                    <option value="HIGH">High</option>
                    <option value="URGENT">Urgent</option>
                  </select>
                </Field>
                <Field label="Initial Status">
                  <select className="input" value={form.status} onChange={(e) => setForm({ ...form, status: e.target.value as TaskStatus })}>
                    <option value="TODO">To Do</option>
                    <option value="IN_PROGRESS">In Progress</option>
                    <option value="DONE">Completed</option>
                    <option value="CANCELLED">Cancelled</option>
                  </select>
                </Field>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                <Field label="Due Date">
                  <input className="input" type="date" value={form.dueDate} onChange={(e) => setForm({ ...form, dueDate: e.target.value })} />
                </Field>
                <Field label="Assignee">
                  <select className="input" value={form.assignedToId} onChange={(e) => setForm({ ...form, assignedToId: e.target.value })}>
                    <option value="">Unassigned</option>
                    {users?.map((u: any) => <option key={u.id} value={u.id}>{u.firstName} {u.lastName ?? ''}</option>)}
                  </select>
                </Field>
              </div>

              <div style={{ borderTop: '1px solid var(--line-soft)', paddingTop: 16, marginTop: 4 }}>
                <div style={{ fontWeight: 600, fontSize: 13.5, marginBottom: 12 }}>Link Related Entity (CRM Context)</div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                  <Field label="Entity Type">
                    <select className="input" value={form.relatedType} onChange={(e) => setForm({ ...form, relatedType: e.target.value as RelatedEntity, relatedId: '' })}>
                      <option value="NONE">None</option>
                      <option value="LEAD">Leads Pipeline</option>
                      <option value="STUDENT">Students Directory</option>
                    </select>
                  </Field>

                  {form.relatedType === 'LEAD' && (
                    <Field label="Select Lead Prospect">
                      <select className="input" value={form.relatedId} onChange={(e) => setForm({ ...form, relatedId: e.target.value })}>
                        <option value="">Select lead…</option>
                        {leads?.map((l: any) => (
                          <option key={l.id} value={l.id}>{l.firstName} {l.lastName ?? ''} ({l.phone ?? 'No phone'})</option>
                        ))}
                      </select>
                    </Field>
                  )}

                  {form.relatedType === 'STUDENT' && (
                    <Field label="Select Student Profile">
                      <select className="input" value={form.relatedId} onChange={(e) => setForm({ ...form, relatedId: e.target.value })}>
                        <option value="">Select student…</option>
                        {students?.map((s: any) => (
                          <option key={s.id} value={s.id}>{s.firstName} {s.lastName ?? ''} ({s.admissionNo})</option>
                        ))}
                      </select>
                    </Field>
                  )}
                </div>
              </div>

              <Field label="Task Description">
                <textarea className="input" rows={3} placeholder="Notes, comments or checklists details…" value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} />
              </Field>
            </div>

            <div style={{ padding: '18px 24px', borderTop: '1px solid var(--line-soft)', display: 'flex', gap: 10 }}>
              <button className="btn-secondary" style={{ flex: 1 }} onClick={() => setDrawerOpen(false)}>Cancel</button>
              <button className="btn-primary" style={{ flex: 1.4 }} disabled={!form.title.trim() || createTask.isPending} onClick={() => createTask.mutate()}>
                {createTask.isPending ? 'Creating…' : 'Create Task'}
              </button>
            </div>
          </div>
        </>
      )}

      {/* DETAIL ACTION MODAL */}
      {selectedTaskId && taskDetail && (
        <Modal open={Boolean(selectedTaskId)} onClose={() => setSelectedTaskId(null)} title="Task Manager Details">
          <div style={{ display: 'grid', gridTemplateColumns: '1.2fr 1fr', gap: 22, minWidth: '70vw', maxWidth: '90vw' }}>
            {/* Left side details */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              <Field label="Task Title">
                <input className="input" value={taskDetail.title} onChange={(e) => updateTask.mutate({ title: e.target.value })} disabled={!canManage} />
              </Field>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                <Field label="Status">
                  <select className="input" value={taskDetail.status} onChange={(e) => updateTask.mutate({ status: e.target.value })} disabled={!canManage}>
                    {TASK_STATUSES.map(s => <option key={s} value={s}>{STATUS_LABELS[s]}</option>)}
                  </select>
                </Field>
                <Field label="Priority">
                  <select className="input" value={taskDetail.priority} onChange={(e) => updateTask.mutate({ priority: e.target.value })} disabled={!canManage}>
                    {Object.entries(PRIORITY_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
                  </select>
                </Field>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                <Field label="Due Date">
                  <input className="input" type="date" value={taskDetail.dueDate ? new Date(taskDetail.dueDate).toISOString().slice(0, 10) : ''} onChange={(e) => updateTask.mutate({ dueDate: e.target.value || null })} disabled={!canManage} />
                </Field>
                <Field label="Assignee">
                  <select className="input" value={taskDetail.assignedToId || ''} onChange={(e) => updateTask.mutate({ assignedToId: e.target.value || null })} disabled={!canManage}>
                    <option value="">Unassigned</option>
                    {users?.map((u: any) => <option key={u.id} value={u.id}>{u.firstName} {u.lastName ?? ''}</option>)}
                  </select>
                </Field>
              </div>

              <Field label="Description">
                <textarea className="input" rows={3} placeholder="No description details…" value={taskDetail.description || ''} onChange={(e) => updateTask.mutate({ description: e.target.value })} disabled={!canManage} />
              </Field>

              {taskDetail.relatedType !== 'NONE' && (
                <div style={{ background: 'var(--surface-2)', padding: 12, borderRadius: 10, border: '1px solid var(--line-soft)', fontSize: 13 }}>
                  <span style={{ fontWeight: 700, color: 'var(--navy)' }}>Related CRM Link:</span> {taskDetail.relatedType === 'LEAD' ? 'Lead Prospect' : 'Student Directory Profile'}
                  {taskDetail.relatedId && (
                    <button
                      onClick={() => {
                        setSelectedTaskId(null);
                        router.push(taskDetail.relatedType === 'LEAD' ? `/leads/${taskDetail.relatedId}` : `/students/${taskDetail.relatedId}`);
                      }}
                      style={{ display: 'block', marginTop: 4, background: 'none', border: 'none', padding: 0, color: 'var(--navy)', textDecoration: 'underline', fontWeight: 600, cursor: 'pointer' }}
                    >
                      View Linked Profile Details →
                    </button>
                  )}
                </div>
              )}

              {canManage && (
                <button className="btn-secondary" style={{ color: 'var(--danger)', marginTop: 'auto', display: 'flex', alignItems: 'center', gap: 6, width: 'fit-content' }} onClick={() => confirm('Delete this task checklist?') && deleteTask.mutate()}>
                  <Trash2 size={13} />Delete Task
                </button>
              )}
            </div>

            {/* Right side comments */}
            <div style={{ display: 'flex', flexDirection: 'column', borderLeft: '1px solid var(--line-soft)', paddingLeft: 18, maxHeight: '60vh' }}>
              <div className="eyebrow" style={{ marginBottom: 12 }}>Task Comments Feed</div>
              
              {/* Comment drafts */}
              <div style={{ display: 'flex', gap: 8, marginBottom: 14 }}>
                <input className="input" value={commentDraft} onChange={(e) => setCommentDraft(e.target.value)} placeholder="Write comment…" style={{ height: 36 }} />
                <button className="btn-primary" style={{ width: 36, height: 36, padding: 0 }} disabled={!commentDraft.trim() || addComment.isPending} onClick={() => addComment.mutate()}>
                  <Send size={13} />
                </button>
              </div>

              {/* Comment list */}
              <div style={{ flex: 1, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 10 }}>
                {taskDetail.comments?.map((c) => (
                  <div key={c.id} style={{ background: 'var(--surface-2)', padding: '10px 12px', borderRadius: 10 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, color: 'var(--ink-3)' }}>
                      <span style={{ fontWeight: 600, color: 'var(--ink)' }}>{c.author.firstName} {c.author.lastName ?? ''}</span>
                      <span>{formatDate(c.createdAt)}</span>
                    </div>
                    <div style={{ fontSize: 12.5, color: 'var(--ink-2)', marginTop: 4, lineHeight: 1.45 }}>{c.body}</div>
                  </div>
                ))}
                {(!taskDetail.comments || taskDetail.comments.length === 0) && (
                  <div style={{ padding: 20, textAlign: 'center', color: 'var(--ink-3)', fontSize: 12 }}>No comments yet.</div>
                )}
              </div>
            </div>
          </div>
        </Modal>
      )}

      <style>{`.student-row:hover{background:var(--surface-2);}`}</style>
    </div>
  );
}

export function TasksWorkspaceFeature() {
  return (
    <Suspense fallback={<div style={{ color: 'var(--ink-3)' }}>Loading…</div>}>
      <TasksInner />
    </Suspense>
  );
}
