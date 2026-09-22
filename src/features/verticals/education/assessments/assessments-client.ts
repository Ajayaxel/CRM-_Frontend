export type QuestionType = 'MCQ' | 'MULTI' | 'TRUE_FALSE' | 'NUMERIC' | 'SHORT' | 'LONG';
export type QuestionDifficulty = 'EASY' | 'MEDIUM' | 'HARD';
export type AssessmentKind = 'QUIZ' | 'EXAM';

export interface AsmtStats { assignments: number; submissions: number; questions: number; assessments: number; pendingGrading: number }
export interface Assignment {
  id: string; title: string; instructions?: string | null; dueAt?: string | null; maxMarks: number;
  subject?: { code: string; name: string } | null; _count?: { submissions: number };
}
export interface Submission {
  id: string; text?: string | null; fileUrl?: string | null; submittedAt: string; isLate: boolean; status: string;
  marks?: number | null; feedback?: string | null; duplicateFlag: boolean;
  student?: { admissionNo: string; firstName: string; lastName?: string | null } | null;
}
export interface QOption { text: string; correct?: boolean }
export interface Question {
  id: string; type: QuestionType; difficulty: QuestionDifficulty; text: string; options: QOption[];
  correctAnswer?: string | null; explanation?: string | null; marks: number;
}
export interface Assessment {
  id: string; title: string; kind: AssessmentKind; durationMin: number; totalMarks: number; passMarks: number;
  maxAttempts: number; shuffleQuestions: boolean; shuffleOptions: boolean; negativeMarkPct: number; showAnswers: boolean;
  dueAt?: string | null; subject?: { code: string; name: string } | null; _count?: { questions: number; attempts: number };
}
export interface Attempt {
  id: string; attemptNo: number; startedAt: string; submittedAt?: string | null; autoScore: number;
  manualScore?: number | null; totalScore?: number | null; passed?: boolean | null; lateSubmit?: boolean; status: string; needsGrading: boolean;
  answers?: { questionId: string; answer: any }[];
  student?: { admissionNo: string; firstName: string; lastName?: string | null } | null;
  assessment?: { title: string; subject?: { code: string } | null } | null;
}
export interface AttemptStats {
  submitted: number; inProgress: number; graded: number;
  avgScore: number | null; highest: number | null; lowest: number | null; passed: number; failed: number;
}
export interface ItemAnalysis {
  assessment: { id: string; title: string; totalMarks: number };
  items: { questionId: string; text: string; type: QuestionType; difficulty: QuestionDifficulty; marks: number; attempted: number; correct: number; correctPct: number | null }[];
}

export const QTYPE_LABEL: Record<QuestionType, string> = {
  MCQ: 'Multiple choice', MULTI: 'Multi-select', TRUE_FALSE: 'True / False',
  NUMERIC: 'Numeric', SHORT: 'Short answer', LONG: 'Long answer (essay)',
};
/** Types the server can mark on its own — everything except LONG. */
export const AUTO_GRADED: QuestionType[] = ['MCQ', 'MULTI', 'TRUE_FALSE', 'NUMERIC', 'SHORT'];
export const HAS_OPTIONS: QuestionType[] = ['MCQ', 'MULTI', 'TRUE_FALSE'];
export const DIFFICULTY_LABEL: Record<QuestionDifficulty, string> = { EASY: 'Easy', MEDIUM: 'Medium', HARD: 'Hard' };
export const DIFFICULTY_COLOR: Record<QuestionDifficulty, { bg: string; fg: string }> = {
  EASY: { bg: 'var(--success-bg,#e6f4ea)', fg: 'var(--success,#1e874b)' },
  MEDIUM: { bg: 'var(--gold-bg,#fdf2e2)', fg: 'var(--gold,#c67c1e)' },
  HARD: { bg: 'var(--danger-bg,#fce8e8)', fg: 'var(--danger,#c0392b)' },
};
export const fmtDate = (s?: string | null) => s ? new Date(s).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }) : '—';
