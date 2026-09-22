'use client';

import { Suspense, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import {
  ChevronLeft, ChevronRight, Plus, Calendar, MapPin, Clock, X, Trash2,
  ListFilter, LayoutGrid, LayoutList, CheckSquare, MessageSquare, AlertCircle, User, Sparkles
} from 'lucide-react';
import { api, apiErrorMessage } from '@/lib/api';
import { useAuth } from '@/features/foundation/auth';
import { Modal } from '@/components/molecules/modal';
import { Field } from '@/components/molecules/field';
import {
  CalendarEventRow, EVENT_COLORS, EVENT_LABELS, getMonthDaysGrid, isSameDay, formatTimeSlot,
  EventType, RelatedEntity
} from '../calendar-utils';
import { avatarStyle, studentInitials } from '@/features/verticals/education/students/students-utils';
import { formatDate } from '@/lib/utils';

type ViewMode = 'month' | 'week' | 'day' | 'agenda';

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

function CalendarInner() {
  const router = useRouter();
  const qc = useQueryClient();
  const { hasPermission } = useAuth();

  // Current view date
  const [currentDate, setCurrentDate] = useState<Date>(new Date());
  const [viewMode, setViewMode] = useState<ViewMode>('month');
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [selectedEvent, setSelectedEvent] = useState<CalendarEventRow | null>(null);

  // Active filters
  const [typeFilters, setTypeFilters] = useState<Record<EventType, boolean>>({
    MEETING: true,
    TASK: true,
    FOLLOW_UP: true,
    ADMISSION: true,
    OTHER: true,
  });
  const [assigneeFilter, setAssigneeFilter] = useState('');

  // Create Form State
  const [form, setForm] = useState({
    title: '',
    description: '',
    type: 'MEETING' as EventType,
    startDate: '',
    startTime: '10:00',
    endDate: '',
    endTime: '11:00',
    location: '',
    assignedToId: '',
    relatedType: 'NONE' as RelatedEntity,
    relatedId: '',
  });

  // Calculate range bounds based on view date
  const getRangeBounds = () => {
    const year = currentDate.getFullYear();
    const month = currentDate.getMonth();

    if (viewMode === 'month') {
      const grid = getMonthDaysGrid(year, month);
      const start = grid[0].toISOString().split('T')[0];
      const end = grid[41].toISOString().split('T')[0];
      return { start, end };
    }

    if (viewMode === 'week') {
      const day = currentDate.getDay();
      const first = new Date(currentDate);
      first.setDate(currentDate.getDate() - day);
      const last = new Date(first);
      last.setDate(first.getDate() + 6);
      return {
        start: first.toISOString().split('T')[0],
        end: last.toISOString().split('T')[0],
      };
    }

    // day or agenda views
    const start = new Date(currentDate);
    start.setDate(start.getDate() - 7); // pull wider range for agenda list
    const end = new Date(currentDate);
    end.setDate(end.getDate() + 30);
    return {
      start: start.toISOString().split('T')[0],
      end: end.toISOString().split('T')[0],
    };
  };

  const { start: dateStart, end: dateEnd } = getRangeBounds();

  // Queries
  const { data: eventsList = [], isLoading: loadingEvents } = useQuery({
    queryKey: ['calendar-events', dateStart, dateEnd, assigneeFilter],
    queryFn: async () => {
      const p = new URLSearchParams();
      p.set('start', dateStart);
      p.set('end', dateEnd);
      if (assigneeFilter) p.set('assignedToId', assigneeFilter);
      return (await api.get<CalendarEventRow[]>(`/calendar/events?${p.toString()}`)).data;
    },
  });

  const { data: users } = useQuery({
    queryKey: ['users-list'],
    queryFn: async () => {
      const res = await api.get<any>('/users');
      return Array.isArray(res.data) ? res.data : res.data?.data || [];
    },
  });

  // Mutators
  const createEvent = useMutation({
    mutationFn: () => {
      const startAt = new Date(`${form.startDate}T${form.startTime}:00`).toISOString();
      const endAt = form.endDate ? new Date(`${form.endDate}T${form.endTime}:00`).toISOString() : undefined;
      return api.post('/calendar/events', {
        title: form.title,
        description: form.description || undefined,
        type: form.type,
        startAt,
        endAt,
        location: form.location || undefined,
        assignedToId: form.assignedToId || undefined,
        relatedType: form.relatedType !== 'NONE' ? form.relatedType : undefined,
        relatedId: form.relatedType !== 'NONE' ? form.relatedId : undefined,
      });
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['calendar-events'] });
      setDrawerOpen(false);
      setForm({ title: '', description: '', type: 'MEETING', startDate: '', startTime: '10:00', endDate: '', endTime: '11:00', location: '', assignedToId: '', relatedType: 'NONE', relatedId: '' });
      toast.success('Custom calendar event scheduled');
    },
    onError: (e) => toast.error(apiErrorMessage(e)),
  });

  const deleteCustomEvent = useMutation({
    mutationFn: (id: string) => api.delete(`/calendar/events/${id}`),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['calendar-events'] });
      setSelectedEvent(null);
      toast.success('Calendar event deleted');
    },
    onError: (e) => toast.error(apiErrorMessage(e)),
  });

  // Nav helpers
  const handleToday = () => setCurrentDate(new Date());
  
  const handlePrev = () => {
    const d = new Date(currentDate);
    if (viewMode === 'month') d.setMonth(d.getMonth() - 1);
    else if (viewMode === 'week') d.setDate(d.getDate() - 7);
    else d.setDate(d.getDate() - 1);
    setCurrentDate(d);
  };

  const handleNext = () => {
    const d = new Date(currentDate);
    if (viewMode === 'month') d.setMonth(d.getMonth() + 1);
    else if (viewMode === 'week') d.setDate(d.getDate() + 7);
    else d.setDate(d.getDate() + 1);
    setCurrentDate(d);
  };

  // Filter local events list
  const filteredEvents = eventsList.filter(e => typeFilters[e.type]);

  const canManage = hasPermission('task.manage');

  // Month grid calculations
  const monthDays = getMonthDaysGrid(currentDate.getFullYear(), currentDate.getMonth());
  const weekdays = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

  return (
    <div style={{ display: 'grid', gridTemplateColumns: '240px 1fr', gap: 24, animation: 'fadeUp .4s ease' }}>
      
      {/* SIDEBAR FILTERS */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
        {canManage && (
          <button
            className="btn-primary"
            style={{ width: '100%', height: 40 }}
            onClick={() => {
              setForm({ ...form, startDate: currentDate.toISOString().split('T')[0] });
              setDrawerOpen(true);
            }}
          >
            <Plus size={16} />Schedule Event
          </button>
        )}

        {/* Date view title */}
        <div style={{ ...card, borderRadius: 16, padding: '16px 18px', display: 'flex', flexDirection: 'column', gap: 14 }}>
          <div style={mono}>Current View</div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <Calendar size={18} color="var(--navy)" />
            <span style={{ fontSize: 15, fontWeight: 700 }}>
              {currentDate.toLocaleDateString('en-IN', { month: 'long', year: 'numeric' })}
            </span>
          </div>
        </div>

        {/* Filter categories */}
        <div style={{ ...card, borderRadius: 16, padding: '16px 18px', display: 'flex', flexDirection: 'column', gap: 14 }}>
          <div style={mono}>Event Categories</div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {(Object.keys(typeFilters) as EventType[]).map((t) => {
              const colors = EVENT_COLORS[t];
              return (
                <label key={t} style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, cursor: 'pointer' }}>
                  <input
                    type="checkbox"
                    checked={typeFilters[t]}
                    onChange={(e) => setTypeFilters({ ...typeFilters, [t]: e.target.checked })}
                    style={{ width: 15, height: 15, accentColor: colors.fg }}
                  />
                  <span style={{ width: 10, height: 10, borderRadius: 3, background: colors.bg, border: `1.5px solid ${colors.border}` }} />
                  {EVENT_LABELS[t]}
                </label>
              );
            })}
          </div>
        </div>

        {/* Assignee Filter */}
        <div style={{ ...card, borderRadius: 16, padding: '16px 18px', display: 'flex', flexDirection: 'column', gap: 10 }}>
          <div style={mono}>Assignee filter</div>
          <select className="input" style={{ height: 36, fontSize: 12.5 }} value={assigneeFilter} onChange={(e) => setAssigneeFilter(e.target.value)}>
            <option value="">All Counselors</option>
            {users?.map((u: any) => <option key={u.id} value={u.id}>{u.firstName} {u.lastName ?? ''}</option>)}
          </select>
        </div>
      </div>

      {/* CALENDAR DISPLAY PANEL */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
        
        {/* Navigation Toolbar */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 16, flexWrap: 'wrap' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <button onClick={handlePrev} style={{ width: 34, height: 34, borderRadius: 9, border: '1px solid var(--line)', background: 'var(--surface)', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <ChevronLeft size={16} />
            </button>
            <button onClick={handleToday} style={{ border: '1px solid var(--line)', padding: '0 12px', height: 34, borderRadius: 9, background: 'var(--surface)', fontSize: 12.5, fontWeight: 700, cursor: 'pointer' }}>
              Today
            </button>
            <button onClick={handleNext} style={{ width: 34, height: 34, borderRadius: 9, border: '1px solid var(--line)', background: 'var(--surface)', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <ChevronRight size={16} />
            </button>

            <h2 style={{ fontSize: 18, fontWeight: 700, letterSpacing: '-.02em', margin: '0 0 0 10px' }}>
              {viewMode === 'day' ? currentDate.toLocaleDateString('en-IN', { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' }) : currentDate.toLocaleDateString('en-IN', { month: 'long', year: 'numeric' })}
            </h2>
          </div>

          <div style={{ display: 'flex', background: 'var(--surface-2)', padding: 3, borderRadius: 10, border: '1px solid var(--line-soft)' }}>
            {(['month', 'week', 'day', 'agenda'] as ViewMode[]).map((v) => (
              <button
                key={v}
                onClick={() => setViewMode(v)}
                style={{
                  textTransform: 'capitalize', border: 'none', padding: '6px 12px', borderRadius: 8, fontSize: 12.5, fontWeight: 600, cursor: 'pointer',
                  background: viewMode === v ? 'var(--surface)' : 'none', color: viewMode === v ? 'var(--ink)' : 'var(--ink-3)',
                  boxShadow: viewMode === v ? 'var(--shadow-sm)' : 'none'
                }}
              >
                {v}
              </button>
            ))}
          </div>
        </div>

        {/* MONTH VIEW GRID */}
        {viewMode === 'month' && (
          <div className="card" style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: 1, background: 'var(--line-soft)', overflow: 'hidden' }}>
            {weekdays.map(w => (
              <div key={w} style={{ background: 'var(--surface-2)', padding: 10, textAlign: 'center', fontSize: 11, fontWeight: 700, textTransform: 'uppercase', color: 'var(--ink-3)', borderBottom: '1px solid var(--line-soft)' }}>
                {w}
              </div>
            ))}
            {monthDays.map((day, idx) => {
              const isCurrentMonth = day.getMonth() === currentDate.getMonth();
              const dayEvents = filteredEvents.filter(e => isSameDay(new Date(e.startAt), day));
              const isToday = isSameDay(day, new Date());
              return (
                <div
                  key={idx}
                  style={{
                    background: isCurrentMonth ? 'var(--surface)' : 'rgba(250,250,250,.4)', minHeight: 100, padding: 8, display: 'flex', flexDirection: 'column', gap: 6,
                    borderBottom: '1px solid var(--line-soft)', borderRight: '1px solid var(--line-soft)', position: 'relative'
                  }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span
                      style={{
                        fontSize: 12, fontWeight: 700, width: 22, height: 22, borderRadius: 99, display: 'flex', alignItems: 'center', justifyContent: 'center',
                        background: isToday ? 'var(--navy)' : 'none', color: isToday ? '#fff' : isCurrentMonth ? 'var(--ink)' : 'var(--ink-3)'
                      }}
                    >
                      {day.getDate()}
                    </span>
                  </div>

                  <div style={{ display: 'flex', flexDirection: 'column', gap: 4, flex: 1, overflowY: 'auto', maxHeight: 80 }}>
                    {dayEvents.slice(0, 3).map((e) => {
                      const colors = EVENT_COLORS[e.type];
                      return (
                        <div
                          key={e.id}
                          onClick={() => setSelectedEvent(e)}
                          style={{
                            fontSize: 10.5, padding: '2px 6px', borderRadius: 4, background: colors.bg, color: colors.fg, border: `1px solid ${colors.border}`,
                            fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', cursor: 'pointer'
                          }}
                          title={e.title}
                        >
                          {e.title}
                        </div>
                      );
                    })}
                    {dayEvents.length > 3 && (
                      <div style={{ fontSize: 10, color: 'var(--ink-3)', fontWeight: 700, paddingLeft: 4 }}>
                        +{dayEvents.length - 3} more
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* WEEK VIEW TIMELINE */}
        {viewMode === 'week' && (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: 10 }}>
            {Array.from({ length: 7 }).map((_, i) => {
              const startOfWeek = new Date(currentDate);
              startOfWeek.setDate(currentDate.getDate() - currentDate.getDay() + i);
              const dayEvents = filteredEvents.filter(e => isSameDay(new Date(e.startAt), startOfWeek));
              const isToday = isSameDay(startOfWeek, new Date());
              return (
                <div key={i} style={{ background: 'var(--surface-2)', borderRadius: 14, padding: 10, border: '1px solid var(--line-soft)', minHeight: 350, display: 'flex', flexDirection: 'column', gap: 10 }}>
                  <div style={{ borderBottom: '1px solid var(--line-soft)', paddingBottom: 6, display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                    <span style={{ fontSize: 11, textTransform: 'uppercase', color: 'var(--ink-3)' }}>{weekdays[i]}</span>
                    <span style={{ fontSize: 16, fontWeight: 700, marginTop: 2, color: isToday ? 'var(--navy)' : 'var(--ink)' }}>{startOfWeek.getDate()}</span>
                  </div>

                  <div style={{ display: 'flex', flexDirection: 'column', gap: 8, flex: 1, overflowY: 'auto' }}>
                    {dayEvents.map((e) => {
                      const colors = EVENT_COLORS[e.type];
                      return (
                        <div
                          key={e.id}
                          onClick={() => setSelectedEvent(e)}
                          style={{
                            padding: 8, borderRadius: 10, background: colors.bg, border: `1px solid ${colors.border}`, color: colors.fg,
                            cursor: 'pointer', display: 'flex', flexDirection: 'column', gap: 4
                          }}
                        >
                          <div style={{ fontWeight: 700, fontSize: 11.5, lineHeight: 1.25 }}>{e.title}</div>
                          {!e.allDay && (
                            <span style={{ fontSize: 9.5, display: 'inline-flex', alignItems: 'center', gap: 2 }}>
                              <Clock size={8} />{formatTimeSlot(e.startAt)}
                            </span>
                          )}
                        </div>
                      );
                    })}
                    {dayEvents.length === 0 && (
                      <div style={{ padding: '20px 10px', textAlign: 'center', color: 'var(--ink-3)', fontSize: 11.5 }}>No events</div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* DAY VIEW TIMELINE */}
        {viewMode === 'day' && (
          <div style={{ ...card, padding: 22, display: 'flex', flexDirection: 'column', gap: 14 }}>
            <div style={mono}>Schedule list for today</div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              {filteredEvents.filter(e => isSameDay(new Date(e.startAt), currentDate)).map((e) => {
                const colors = EVENT_COLORS[e.type];
                return (
                  <div
                    key={e.id}
                    onClick={() => setSelectedEvent(e)}
                    style={{
                      display: 'flex', alignItems: 'center', gap: 14, padding: 14, borderRadius: 14, background: colors.bg,
                      border: `1.5px solid ${colors.border}`, color: colors.fg, cursor: 'pointer'
                    }}
                  >
                    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', width: 68, borderRight: `1px solid ${colors.border}`, paddingRight: 10 }}>
                      <Clock size={15} />
                      <span style={{ fontSize: 11.5, fontWeight: 700, marginTop: 4 }}>
                        {e.allDay ? 'All Day' : formatTimeSlot(e.startAt)}
                      </span>
                    </div>
                    <div style={{ flex: 1 }}>
                      <div style={{ fontWeight: 700, fontSize: 14.5 }}>{e.title}</div>
                      {e.description && <div style={{ fontSize: 12.5, opacity: 0.85, marginTop: 3 }}>{e.description}</div>}
                    </div>
                    {e.assignedTo && (
                      <span style={avatarStyle(e.assignedTo.id, 28)} title={e.assignedTo.firstName}>{studentInitials(e.assignedTo)}</span>
                    )}
                  </div>
                );
              })}
              {filteredEvents.filter(e => isSameDay(new Date(e.startAt), currentDate)).length === 0 && (
                <div style={{ padding: 40, textAlign: 'center', color: 'var(--ink-3)', fontSize: 14 }}>
                  No event entries scheduled on this day.
                </div>
              )}
            </div>
          </div>
        )}

        {/* AGENDA TIMELINE LIST */}
        {viewMode === 'agenda' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
            {filteredEvents.map((e) => {
              const colors = EVENT_COLORS[e.type];
              return (
                <div
                  key={e.id}
                  onClick={() => setSelectedEvent(e)}
                  style={{
                    ...card, borderRadius: 16, padding: '14px 20px', display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                    gap: 16, cursor: 'pointer', transition: 'transform 0.15s ease', borderLeft: `5px solid ${colors.fg}`
                  }}
                  onMouseEnter={(e) => e.currentTarget.style.transform = 'translateX(2px)'}
                  onMouseLeave={(e) => e.currentTarget.style.transform = 'translateX(0)'}
                >
                  <div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                      <span style={{ fontSize: 11.5, background: colors.bg, color: colors.fg, padding: '1px 6px', borderRadius: 4, fontWeight: 700 }}>
                        {EVENT_LABELS[e.type]}
                      </span>
                      <span style={{ fontSize: 12.5, color: 'var(--ink-3)' }}>{formatDate(e.startAt)}</span>
                    </div>
                    <div style={{ fontWeight: 700, fontSize: 14.5, color: 'var(--ink)' }}>{e.title}</div>
                    {e.description && <div style={{ fontSize: 12.5, color: 'var(--ink-3)', marginTop: 2 }}>{e.description}</div>}
                  </div>

                  <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                    {!e.allDay && (
                      <span style={{ fontSize: 12.5, color: 'var(--ink-3)', display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                        <Clock size={13} /> {formatTimeSlot(e.startAt)}
                      </span>
                    )}
                    {e.location && (
                      <span style={{ fontSize: 12.5, color: 'var(--ink-3)', display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                        <MapPin size={13} /> {e.location}
                      </span>
                    )}
                    {e.assignedTo && (
                      <span style={avatarStyle(e.assignedTo.id, 28)} title={e.assignedTo.firstName}>{studentInitials(e.assignedTo)}</span>
                    )}
                  </div>
                </div>
              );
            })}
            {filteredEvents.length === 0 && (
              <div style={{ padding: 40, textAlign: 'center', color: 'var(--ink-3)', fontSize: 14 }}>
                No events in range.
              </div>
            )}
          </div>
        )}
      </div>

      {/* CREATE NEW CUSTOM EVENT DRAWER */}
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
                <div style={{ fontWeight: 700, fontSize: 17 }}>Schedule Event</div>
                <div style={{ fontSize: 12.5, color: 'var(--ink-3)' }}>Schedule direct meetings or calendar entries</div>
              </div>
              <button onClick={() => setDrawerOpen(false)} style={{ width: 34, height: 34, borderRadius: 9, border: '1px solid var(--line)', background: 'var(--surface)', color: 'var(--ink-2)', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <X size={16} />
              </button>
            </div>

            <div style={{ flex: 1, overflowY: 'auto', padding: '22px 24px', display: 'flex', flexDirection: 'column', gap: 16 }}>
              <Field label="Event Title">
                <input className="input" value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} placeholder="e.g. Counsellor Review Meeting" required />
              </Field>

              <div style={{ display: 'grid', gridTemplateColumns: '1.2fr 1fr', gap: 12 }}>
                <Field label="Start Date">
                  <input className="input" type="date" value={form.startDate} onChange={(e) => setForm({ ...form, startDate: e.target.value })} required />
                </Field>
                <Field label="Start Time">
                  <input className="input" type="time" value={form.startTime} onChange={(e) => setForm({ ...form, startTime: e.target.value })} required />
                </Field>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1.2fr 1fr', gap: 12 }}>
                <Field label="End Date">
                  <input className="input" type="date" value={form.endDate} onChange={(e) => setForm({ ...form, endDate: e.target.value })} />
                </Field>
                <Field label="End Time">
                  <input className="input" type="time" value={form.endTime} onChange={(e) => setForm({ ...form, endTime: e.target.value })} />
                </Field>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                <Field label="Location">
                  <input className="input" value={form.location} onChange={(e) => setForm({ ...form, location: e.target.value })} placeholder="Room 2B, Zoom…" />
                </Field>
                <Field label="Event Host">
                  <select className="input" value={form.assignedToId} onChange={(e) => setForm({ ...form, assignedToId: e.target.value })}>
                    <option value="">Choose host user…</option>
                    {users?.map((u: any) => <option key={u.id} value={u.id}>{u.firstName} {u.lastName ?? ''}</option>)}
                  </select>
                </Field>
              </div>

              <Field label="Description / Agenda details">
                <textarea className="input" rows={3} placeholder="Event descriptions, meeting notes, checklist links…" value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} />
              </Field>
            </div>

            <div style={{ padding: '18px 24px', borderTop: '1px solid var(--line-soft)', display: 'flex', gap: 10 }}>
              <button className="btn-secondary" style={{ flex: 1 }} onClick={() => setDrawerOpen(false)}>Cancel</button>
              <button className="btn-primary" style={{ flex: 1.4 }} disabled={!form.title.trim() || !form.startDate || createEvent.isPending} onClick={() => createEvent.mutate()}>
                {createEvent.isPending ? 'Scheduling…' : 'Schedule Event'}
              </button>
            </div>
          </div>
        </>
      )}

      {/* APPOINTMENT DETAILED MODAL */}
      {selectedEvent && (
        <Modal open={Boolean(selectedEvent)} onClose={() => setSelectedEvent(null)} title="Calendar Entry details">
          <div style={{ display: 'flex', flexDirection: 'column', gap: 14, minWidth: 400 }}>
            <div>
              <span style={{ fontSize: 11.5, background: EVENT_COLORS[selectedEvent.type].bg, color: EVENT_COLORS[selectedEvent.type].fg, padding: '2px 8px', borderRadius: 6, fontWeight: 700 }}>
                {EVENT_LABELS[selectedEvent.type]}
              </span>
            </div>
            
            <h3 style={{ fontSize: 18, fontWeight: 700, margin: 0 }}>{selectedEvent.title}</h3>
            
            {selectedEvent.description && (
              <p style={{ fontSize: 13.5, color: 'var(--ink-2)', margin: 0, background: 'var(--surface-2)', padding: 12, borderRadius: 10 }}>
                {selectedEvent.description}
              </p>
            )}

            <div style={{ display: 'flex', flexDirection: 'column', gap: 8, fontSize: 13, borderTop: '1px solid var(--line-soft)', paddingTop: 12, marginTop: 4 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span style={{ color: 'var(--ink-3)' }}>Scheduled Date</span>
                <span style={{ fontWeight: 600 }}>{formatDate(selectedEvent.startAt)}</span>
              </div>
              {!selectedEvent.allDay && (
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span style={{ color: 'var(--ink-3)' }}>Scheduled Time</span>
                  <span style={{ fontWeight: 600 }}>{formatTimeSlot(selectedEvent.startAt)}</span>
                </div>
              )}
              {selectedEvent.location && (
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span style={{ color: 'var(--ink-3)' }}>Location / Link</span>
                  <span style={{ fontWeight: 600 }}>{selectedEvent.location}</span>
                </div>
              )}
              {selectedEvent.assignedTo && (
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span style={{ color: 'var(--ink-3)' }}>Assigned Person</span>
                  <span style={{ fontWeight: 600, display: 'inline-flex', alignItems: 'center', gap: 5 }}>
                    <span style={avatarStyle(selectedEvent.assignedTo.id, 20)}>{studentInitials(selectedEvent.assignedTo)}</span>
                    {selectedEvent.assignedTo.firstName}
                  </span>
                </div>
              )}
            </div>

            {/* If it's a dynamic dynamic aggregated type task/admission, link to detail page */}
            {selectedEvent.id.startsWith('task-') && (
              <button
                className="btn-primary"
                style={{ width: '100%', marginTop: 10 }}
                onClick={() => {
                  const rawId = selectedEvent.id.replace('task-', '');
                  setSelectedEvent(null);
                  router.push(`/tasks`);
                }}
              >
                Go to Tasks Workspace →
              </button>
            )}

            {selectedEvent.id.startsWith('admission-') && (
              <button
                className="btn-primary"
                style={{ width: '100%', marginTop: 10 }}
                onClick={() => {
                  setSelectedEvent(null);
                  router.push(`/admissions`);
                }}
              >
                Go to Admissions Pipeline →
              </button>
            )}

            {selectedEvent.id.startsWith('followup-') && (
              <button
                className="btn-primary"
                style={{ width: '100%', marginTop: 10 }}
                onClick={() => {
                  setSelectedEvent(null);
                  router.push(`/leads`);
                }}
              >
                Go to Leads Desk →
              </button>
            )}

            {/* Custom meetings CRUD controls */}
            {!selectedEvent.id.startsWith('task-') && !selectedEvent.id.startsWith('followup-') && !selectedEvent.id.startsWith('admission-') && canManage && (
              <div style={{ display: 'flex', gap: 10, marginTop: 12 }}>
                <button
                  className="btn-secondary"
                  style={{ color: 'var(--danger)', width: '100%', border: '1px solid var(--danger-bg)' }}
                  onClick={() => confirm('Delete this calendar event?') && deleteCustomEvent.mutate(selectedEvent.id)}
                >
                  <Trash2 size={13} style={{ marginRight: 6 }} />Delete Event
                </button>
              </div>
            )}
          </div>
        </Modal>
      )}
    </div>
  );
}

export function CalendarWorkspaceFeature() {
  return (
    <Suspense fallback={<div style={{ color: 'var(--ink-3)' }}>Loading…</div>}>
      <CalendarInner />
    </Suspense>
  );
}
