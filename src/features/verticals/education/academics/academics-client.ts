export const DAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

export interface AcademicYear { id: string; name: string; startDate?: string | null; endDate?: string | null; isCurrent: boolean; terms?: Term[]; _count?: { terms: number } }
export interface Term { id: string; name: string; academicYearId: string; isCurrent: boolean; startDate?: string | null; endDate?: string | null; academicYear?: { name: string } }
export interface Subject { id: string; code: string; name: string; credits: number; courseId?: string | null; facultyId?: string | null; course?: { name: string; code: string } | null; faculty?: { name: string } | null }
export interface Section { id: string; name: string; capacity: number; batchId: string; students?: number; batch?: { name: string; code: string; courseId?: string | null; course?: { name: string } | null } | null }
export interface Room { id: string; name: string; code?: string | null; type: string; capacity: number; _count?: { timetableEntries: number } }
export interface TimeSlot { id: string; name: string; startTime: string; endTime: string; order: number }
export interface TimetableEntry {
  id: string; dayOfWeek: number; sectionId: string; subjectId: string; facultyId: string; roomId?: string | null; timeSlotId: string;
  kind?: 'REGULAR' | 'LAB' | 'TUTORIAL' | 'EXTRA' | 'REPLACEMENT';
  subject?: { code: string; name: string } | null;
  faculty?: { id: string; name: string } | null;
  room?: { name: string; code?: string | null } | null;
  timeSlot?: { id: string; name: string; startTime: string; endTime: string; order: number } | null;
  section?: { id: string; name: string } | null;
}
export interface Faculty { id: string; name: string; email?: string | null; department?: string | null; designation?: string | null; active: boolean; portalUser?: { id: string; status: string; lastLoginAt?: string | null } | null }
export interface CourseLite { id: string; name: string; code: string }
export interface BatchLite { id: string; name: string; code: string; course?: { name: string } | null }
export interface AcademicsStats { years: number; terms: number; subjects: number; sections: number; rooms: number; slots: number; entries: number; faculty: number }
