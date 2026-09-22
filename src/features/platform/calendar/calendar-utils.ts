export type EventType = 'TASK' | 'FOLLOW_UP' | 'ADMISSION' | 'MEETING' | 'OTHER';
export type RelatedEntity = 'NONE' | 'LEAD' | 'STUDENT';

export interface CalendarEventRow {
  id: string;
  title: string;
  description?: string | null;
  type: EventType;
  startAt: string;
  endAt?: string | null;
  allDay: boolean;
  location?: string | null;
  relatedType: string;
  relatedId?: string | null;
  assignedTo?: { id: string; firstName: string; lastName?: string | null } | null;
}

export const EVENT_COLORS: Record<EventType, { bg: string; fg: string; border: string }> = {
  MEETING: { bg: 'rgba(91,140,166,.1)', fg: 'var(--teal)', border: 'rgba(91,140,166,.3)' },
  TASK: { bg: 'rgba(235,161,27,.08)', fg: 'var(--gold)', border: 'rgba(235,161,27,.2)' },
  FOLLOW_UP: { bg: 'rgba(240,68,56,.06)', fg: 'var(--danger)', border: 'rgba(240,68,56,.15)' },
  ADMISSION: { bg: 'rgba(19,35,118,.06)', fg: 'var(--navy)', border: 'rgba(19,35,118,.15)' },
  OTHER: { bg: 'var(--surface-2)', fg: 'var(--ink-2)', border: 'var(--line-soft)' },
};

export const EVENT_LABELS: Record<EventType, string> = {
  MEETING: 'Meetings / Events',
  TASK: 'Task Reminders',
  FOLLOW_UP: 'Lead Follow-ups',
  ADMISSION: 'Admissions Applied',
  OTHER: 'Other Events',
};

// Generates the 35 or 42 grid dates representing the month view calendar page
export function getMonthDaysGrid(year: number, month: number): Date[] {
  const firstDayIndex = new Date(year, month, 1).getDay(); // 0 (Sunday) to 6 (Saturday)
  const startDate = new Date(year, month, 1 - firstDayIndex);
  
  const grid: Date[] = [];
  for (let i = 0; i < 42; i++) {
    const d = new Date(startDate);
    d.setDate(startDate.getDate() + i);
    grid.push(d);
  }
  return grid;
}

export function formatTimeSlot(dateStr: string): string {
  const d = new Date(dateStr);
  return d.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', hour12: true });
}

export function isSameDay(d1: Date, d2: Date): boolean {
  return d1.getFullYear() === d2.getFullYear() &&
         d1.getMonth() === d2.getMonth() &&
         d1.getDate() === d2.getDate();
}
