/**
 * Industry Programs — the institution-wide industry-engagement tracker: guest
 * talks (events), industry workshops and industry visits.
 *
 * Everything the screen shows is served by `/industry-programs/*`. Status is
 * derived on the server from the clock, so the client never re-derives it.
 */
export type ProgramType = 'EVENT' | 'WORKSHOP' | 'INDUSTRY_VISIT';
export type ProgramStatus = 'UPCOMING' | 'ONGOING' | 'COMPLETED' | 'SCHEDULED';

export const TYPE_LABEL: Record<ProgramType, string> = {
  EVENT: 'Event', WORKSHOP: 'Workshop', INDUSTRY_VISIT: 'Industry Visit',
};

export interface Program {
  id: string;
  type: ProgramType;
  title: string;
  description?: string | null;
  startsAt: string;
  endsAt?: string | null;
  venue?: string | null;
  speakerName?: string | null;
  speakerAffiliation?: string | null;
  partner?: string | null;
  participants: number;
  courseId?: string | null;
  department?: string | null;
  facultyInChargeId?: string | null;
  facultyInCharge?: string | null;
  status: ProgramStatus;
}

export interface ProgramListResponse {
  items: Program[];
  total: number;
  page: number;
  pageSize: number;
}

export interface ProgramStats {
  upcoming: number;
  ongoing: number;
  completed: number;
  totalParticipants: number;
  total: number;
}

export interface TopDepartment {
  courseId: string | null;
  department: string;
  participants: number;
}

export interface ProgramImpact {
  totalParticipants: number;
  industryCollaborations: number;
  /** Null when there is no rating source — shown as an honest empty, never faked. */
  studentSatisfaction: number | null;
}
