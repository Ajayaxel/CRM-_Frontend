export type MaterialType = 'PDF' | 'SLIDES' | 'VIDEO' | 'LINK' | 'DOC' | 'OTHER';
export type LectureMode = 'LIVE' | 'RECORDED' | 'OFFLINE';

export interface ContentStats { lessons: number; materials: number; lectures: number; upcoming: number }
export interface Material { id: string; type: MaterialType; title: string; url: string; published: boolean; lessonId?: string | null }
export interface Lesson { id: string; title: string; description?: string | null; order: number; published: boolean; materials: Material[]; _count?: { materials: number } }
export interface Lecture {
  id: string; title: string; description?: string | null; scheduledAt: string; durationMin: number; mode: LectureMode;
  /** Where an online class is held. Null/absent for OFFLINE. See @/features/meetings. */
  meetingProvider?: 'IN_APP' | 'ZOOM' | 'GOOGLE_MEET' | 'MS_TEAMS' | 'OTHER' | null;
  joinUrl?: string | null; recordingUrl?: string | null; recordingAssetId?: string | null; published: boolean;
  subject?: { code: string; name: string } | null; faculty?: { name: string } | null; section?: { name: string } | null;
}

export const MATERIAL_META: Record<MaterialType, { icon: string; label: string }> = {
  PDF: { icon: '📄', label: 'PDF' }, SLIDES: { icon: '📊', label: 'Slides' }, VIDEO: { icon: '🎬', label: 'Video' },
  LINK: { icon: '🔗', label: 'Link' }, DOC: { icon: '📝', label: 'Doc' }, OTHER: { icon: '📎', label: 'File' },
};
export const fmtDateTime = (s: string) => new Date(s).toLocaleString('en-IN', { weekday: 'short', day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' });
