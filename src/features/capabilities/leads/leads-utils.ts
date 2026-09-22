import { fmtOrgMoney } from '@/lib/org-locale';

export interface LeadStage {
  id: string;
  name: string;
  color?: string | null;
  order: number;
  isSystem: boolean;
  isWon: boolean;
  isLost: boolean;
}

export interface LeadRow {
  id: string;
  firstName: string;
  lastName?: string | null;
  email?: string | null;
  phone?: string | null;
  source: string;
  priority: string;
  score: number;
  expectedValue?: number | null;
  createdAt: string;
  lastActivityAt?: string | null;
  convertedAt?: string | null;
  stage: { id: string; name: string; color?: string | null; isWon: boolean; isLost: boolean };
  course?: { id: string; name: string; fee: number } | null;
  assignedTo?: { id: string; firstName: string; lastName?: string | null } | null;
}

export const SOURCE_LABELS: Record<string, string> = {
  WEBSITE: 'Website',
  WALK_IN: 'Walk-in',
  REFERRAL: 'Referral',
  SOCIAL_MEDIA: 'Social Media',
  PHONE: 'Phone',
  EMAIL: 'Email',
  ADVERTISEMENT: 'Ads',
  EVENT: 'Event',
  OTHER: 'Other',
};

export const SOURCE_OPTIONS = Object.entries(SOURCE_LABELS).map(([value, label]) => ({ value, label }));

const STAGE_META: Record<string, { dot: string; bg: string; fg: string }> = {
  New: { dot: '#9A8F88', bg: 'var(--surface-2)', fg: 'var(--ink-2)' },
  Contacted: { dot: '#132376', bg: 'rgba(19,35,118,.10)', fg: 'var(--navy)' },
  Interested: { dot: '#E6A23C', bg: 'var(--gold-bg)', fg: 'var(--gold-ink)' },
  'Follow-up': { dot: '#E6A23C', bg: 'var(--gold-bg)', fg: 'var(--gold-ink)' },
  'Admission Pending': { dot: '#132376', bg: 'rgba(19,35,118,.10)', fg: 'var(--navy)' }, // INSTITUTE stage name — inert elsewhere
  Converted: { dot: '#00A63E', bg: 'var(--success-bg)', fg: 'var(--success)' },
  Lost: { dot: '#E7000B', bg: 'var(--danger-bg)', fg: 'var(--danger)' },
};

export function stageMeta(name: string, color?: string | null) {
  return STAGE_META[name] ?? { dot: color ?? '#9A8F88', bg: 'var(--surface-2)', fg: 'var(--ink-2)' };
}

export function stageBadgeStyle(name: string, color?: string | null): React.CSSProperties {
  const m = stageMeta(name, color);
  return {
    display: 'inline-flex',
    alignItems: 'center',
    gap: 6,
    background: m.bg,
    color: m.fg,
    padding: '4px 10px',
    borderRadius: 99,
    fontSize: 12,
    fontWeight: 600,
    whiteSpace: 'nowrap',
  };
}

const AVATAR_COLORS = ['#7C8CE0', '#E6A23C', '#4F8A6B', '#C86B7A', '#5B8CA6', '#B08968', '#8E7CC3', '#D08770'];

export function avatarColor(seed: string) {
  let h = 0;
  for (let i = 0; i < seed.length; i++) h = (h * 31 + seed.charCodeAt(i)) >>> 0;
  return AVATAR_COLORS[h % AVATAR_COLORS.length];
}

export function leadName(l: { firstName: string; lastName?: string | null }) {
  return `${l.firstName} ${l.lastName ?? ''}`.trim();
}

export function leadInitials(l: { firstName: string; lastName?: string | null }) {
  return `${l.firstName?.[0] ?? ''}${l.lastName?.[0] ?? ''}`.toUpperCase() || '?';
}

export function scoreColor(score: number) {
  if (score >= 75) return 'var(--success)';
  if (score >= 45) return 'var(--gold)';
  return 'var(--ink-3)';
}

export type LeadGrade = 'HOT' | 'WARM' | 'COLD';

export function scoreGrade(score: number): LeadGrade {
  if (score >= 75) return 'HOT';
  if (score >= 45) return 'WARM';
  return 'COLD';
}

export const GRADE_META: Record<LeadGrade, { label: string; emoji: string; bg: string; fg: string }> = {
  HOT: { label: 'Hot', emoji: '🔥', bg: 'var(--success-bg)', fg: 'var(--success)' },
  WARM: { label: 'Warm', emoji: '🌤️', bg: 'var(--gold-bg)', fg: 'var(--gold-ink)' },
  COLD: { label: 'Cold', emoji: '❄️', bg: 'var(--surface-2)', fg: 'var(--ink-3)' },
};

export function gradeBadgeStyle(grade: LeadGrade): React.CSSProperties {
  const m = GRADE_META[grade];
  return {
    display: 'inline-flex', alignItems: 'center', gap: 4,
    background: m.bg, color: m.fg, padding: '2px 8px',
    borderRadius: 99, fontSize: 11, fontWeight: 700, whiteSpace: 'nowrap',
  };
}

export interface ScoreFactor { key: string; label: string; points: number; max: number; detail: string }
export interface ScoreBreakdown { score: number; grade: LeadGrade; factors: ScoreFactor[] }

export function formatValue(v?: number | null) {
  if (!v) return '—';
  return fmtOrgMoney(v);
}

export function avatarStyle(seed: string, size = 38): React.CSSProperties {
  return {
    width: size,
    height: size,
    borderRadius: 99,
    background: avatarColor(seed),
    color: '#fff',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    fontSize: size <= 36 ? 12 : 15,
    fontWeight: 700,
    flex: `0 0 ${size}px`,
  };
}
