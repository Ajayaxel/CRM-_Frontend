/**
 * Academic requests — the operational layer over the timetable. Served by
 * `/academic-requests/*`. Everything (completion %, candidate slots) is derived
 * on the server; the client only renders it.
 */
export type RequestType = 'ADDITIONAL_CLASS' | 'PORTION_DELAY' | 'ROOM_ISSUE' | 'FACULTY_AVAILABILITY' | 'SCHEDULE_MODIFICATION';
export type RequestStatus = 'SUBMITTED' | 'UNDER_REVIEW' | 'APPROVED' | 'REJECTED' | 'SCHEDULED' | 'COMPLETED';
export type Priority = 'HIGH' | 'NORMAL' | 'LOW';

export const TYPE_LABEL: Record<RequestType, string> = {
  ADDITIONAL_CLASS: 'Additional Class', PORTION_DELAY: 'Portion Delay', ROOM_ISSUE: 'Room Issue',
  FACULTY_AVAILABILITY: 'Faculty Availability', SCHEDULE_MODIFICATION: 'Schedule Modification',
};
export const STATUS_LABEL: Record<RequestStatus, string> = {
  SUBMITTED: 'Submitted', UNDER_REVIEW: 'Under Review', APPROVED: 'Approved', REJECTED: 'Rejected', SCHEDULED: 'Scheduled', COMPLETED: 'Completed',
};
export const STATUS_ORDER: RequestStatus[] = ['SUBMITTED', 'UNDER_REVIEW', 'APPROVED', 'SCHEDULED', 'COMPLETED'];

export interface RequestRow {
  id: string; code: string; type: RequestType; status: RequestStatus; priority: Priority;
  subject: { code: string; name: string } | null;
  batch: { name: string; division: string; course: string | null } | null;
  faculty: string | null; hoursRequested: number | null; completionPct: number | null; submittedAt: string;
}
export interface QueueResponse { counts: Record<string, number>; items: RequestRow[] }

export interface Candidate { dayOfWeek: number; day: string; timeSlotId: string; slot: string; time: string; roomId: string; room: string; availability: string }
export interface RequestDetail {
  id: string; code: string; type: RequestType; status: RequestStatus; priority: Priority;
  reason: string | null; hoursRequested: number | null; requesterName: string | null;
  subject: { code: string; name: string } | null;
  batch: { name: string; division: string; course: string | null; courseCode: string | null } | null;
  faculty: string | null; term: string | null;
  timestamps: Record<string, string | null>;
  rejectionReason: string | null; resolutionNote: string | null;
  scheduled: { day: string; slot: string; time: string; room: string | null } | null;
  academic: {
    subject: string | null; plannedHours: number; completedHours: number; remainingHours: number;
    completionPct: number; additionalHours: number; plannedCompletion: string | null; behindHours: number | null;
  } | null;
  operational: { facultyFreePeriods: number; batchFreePeriods: number; facultyWeeklyLoad: number; batchWeeklyLoad: number; otherSubjects: string[] } | null;
  candidates: Candidate[];
  history: { from: string | null; to: string; actor: string | null; note: string | null; at: string }[];
}
