export interface Band { min: number; grade: string; point: number }
export interface GradingScheme { id: string; name: string; bands: Band[]; isDefault: boolean }
export interface GradeComponent { id: string; name: string; weight: number; maxMarks: number; source: string; order: number }
export interface MarkRow { id: string; admissionNo: string; name: string; marks: Record<string, number | null> }
export interface MarksMatrix { components: GradeComponent[]; students: MarkRow[] }
export interface ReportCard {
  id: string; termId: string; studentId: string; overallPct: number; overallGrade?: string | null; gpa: number; published: boolean; publishedAt?: string | null; generatedAt: string;
  data: { term?: { name: string }; student?: { admissionNo: string; name: string }; subjects?: SubjectRow[] };
}
export interface SubjectRow { subjectId: string; code: string; name: string; percent: number; grade: string; point: number; components: { name: string; obtained: number; max: number }[] }
export interface GradebookStats { components: number; reportCards: number; published: number }
export const gradeColor = (pct: number) => pct < 40 ? 'var(--danger,#c0392b)' : pct < 60 ? 'var(--gold,#c67c1e)' : 'var(--success,#1e874b)';
