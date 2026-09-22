export type AttStatus = 'PRESENT' | 'ABSENT' | 'LATE' | 'EXCUSED';

export interface TodayClass {
  timetableEntryId: string; sectionId: string;
  subject?: { code: string; name: string } | null;
  faculty?: { name: string } | null;
  room?: { name: string } | null;
  slot?: { name: string; startTime: string; endTime: string } | null;
  section?: { name: string; batch?: { name: string } | null } | null;
  sessionId: string | null; status: string; markedCount: number;
}
export interface TodayResponse { date: string; classes: TodayClass[] }
export interface RosterStudent { id: string; admissionNo: string; firstName: string; lastName?: string | null; photoUrl?: string | null; status: AttStatus | null }
export interface SessionOpen {
  session: { id: string; date: string; status: string; slotLabel?: string | null };
  class: { subject?: { code: string; name: string } | null; faculty?: { name: string } | null; section?: { name: string } | null };
  roster: RosterStudent[];
}
export interface OverviewStudent { id: string; admissionNo: string; name: string; total: number; attended: number; pct: number | null }
export interface SectionOverview { sessions: number; students: OverviewStudent[] }
export interface AttStats { todaySessions: number; markedToday: number; overallPct: number | null; totalRecords: number; belowThreshold: number }

export const STATUS_META: Record<AttStatus, { label: string; short: string; bg: string; fg: string }> = {
  PRESENT: { label: 'Present', short: 'P', bg: 'var(--success-bg,#e6f4ea)', fg: 'var(--success,#1e874b)' },
  ABSENT: { label: 'Absent', short: 'A', bg: 'var(--danger-bg,#fce8e8)', fg: 'var(--danger,#c0392b)' },
  LATE: { label: 'Late', short: 'L', bg: 'var(--gold-bg,#fdf2e2)', fg: 'var(--gold,#c67c1e)' },
  EXCUSED: { label: 'Excused', short: 'E', bg: 'var(--surface-2)', fg: 'var(--ink-2)' },
};
export const pctColor = (pct: number | null) => pct == null ? 'var(--ink-3)' : pct < 75 ? 'var(--danger,#c0392b)' : pct < 85 ? 'var(--gold,#c67c1e)' : 'var(--success,#1e874b)';
