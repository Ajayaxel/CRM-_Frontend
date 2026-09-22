export interface ProgramOutcome {
  id: string; courseId: string; code: string; statement: string; order: number;
  course?: { name: string; code: string };
  _count?: { coPoMaps: number };
}
export interface CourseOutcome {
  id: string; subjectId: string; code: string; statement: string; bloomLevel?: string | null;
  order: number; thresholdPct: number; targetPct: number;
  subject?: { name: string; code: string };
  _count?: { coPoMaps: number; outcomeMaps: number };
}
export interface CoPoMap { id: string; courseOutcomeId: string; programOutcomeId: string; strength: number }
export interface OutcomeMap {
  id: string; courseOutcomeId: string; weightPct: number;
  assessmentId?: string | null; assignmentId?: string | null; gradeComponentId?: string | null;
  courseOutcome?: { code: string; subjectId: string };
  assessment?: { title: string; kind: string } | null;
  assignment?: { title: string } | null;
  gradeComponent?: { name: string } | null;
}
export interface AttainmentSection {
  sectionId: string; section: string; evaluated: number; attained: number; attainedPct: number; level: number; computedAt: string;
}
export interface CoAttainmentRow {
  id: string; code: string; statement: string; thresholdPct: number; targetPct: number;
  instruments: string[]; sections: AttainmentSection[];
}
export interface PoAttainmentRow {
  id: string; code: string; statement: string;
  contributingCos: { code: string; subject: string; strength: number }[];
  sections: AttainmentSection[];
}
export interface StudentAttainment {
  id: string; studentId: string; scorePct: number; attained: boolean; evidenceCount: number; thresholdPct: number;
  student: { admissionNo: string; firstName: string; lastName?: string | null };
}
export interface SyllabusRow {
  subjectId: string; code: string; name: string; program: string | null; faculty: string | null;
  totalHours: number; planned: number; completed: number; pending: number; cancelled: number; overdue: number;
  completionPct: number | null; hoursDeliveredPct: number | null; hoursConfigured: boolean; warning: string | null; delayed: boolean;
}
export interface SessionPlan {
  id: string; subjectId: string; sectionId?: string | null; facultyId?: string | null; termId?: string | null;
  topic: string; description?: string | null; method: 'LECTURE' | 'CASE_STUDY' | 'ACTIVITY';
  plannedDate: string; plannedDurationMin: number; order: number;
  status: 'PLANNED' | 'PUBLISHED' | 'COMPLETED' | 'RESCHEDULED' | 'CANCELLED';
  completedAt?: string | null; actualDurationMin?: number | null; deviationReason?: string | null;
  subject?: { code: string; name: string };
  section?: { name: string; batch?: { name: string } } | null;
  faculty?: { name: string } | null;
  outcomes: { courseOutcome: { code: string } }[];
}
export interface FacultyPerf {
  facultyId: string; name: string; department?: string | null;
  sessionsPlanned: number; sessionsDelivered: number; deliveryRatePct: number | null;
  avgRating: number | null; ratings: number; classAttendancePct: number | null; effectivenessPct: number | null;
}
export interface WeakStudent {
  studentId: string; admissionNo: string; name: string; batch: string | null;
  reasons: string[]; avgCoPct?: number; attendancePct?: number;
}
export interface SubjectPerf { subjectId: string; code: string; name: string; students: number; passed: number; passPct: number | null; avgPct: number | null }
export interface ObeOverview {
  poCount: number; coCount: number; mapCount: number; instrumentMapCount: number;
  subjects: { id: string; code: string; name: string; totalHours: number; termId: string | null; _count: { courseOutcomes: number; sessionPlans: number } }[];
}

export const levelColor = (l: number) => (l >= 3 ? 'var(--success,#1e874b)' : l === 2 ? 'var(--gold,#c67c1e)' : l === 1 ? 'var(--gold,#c67c1e)' : 'var(--danger,#c0392b)');
export const attainColor = (pct: number, target: number) => (pct >= target ? 'var(--success,#1e874b)' : pct >= (target * 2) / 3 ? 'var(--gold,#c67c1e)' : 'var(--danger,#c0392b)');
export const METHOD_LABEL: Record<string, string> = { LECTURE: 'Lecture', CASE_STUDY: 'Case Study', ACTIVITY: 'Activity' };
export const STATUS_COLOR: Record<string, string> = {
  PLANNED: 'var(--ink-3)', PUBLISHED: 'var(--brand,#132376)', COMPLETED: 'var(--success,#1e874b)',
  RESCHEDULED: 'var(--gold,#c67c1e)', CANCELLED: 'var(--danger,#c0392b)',
};
