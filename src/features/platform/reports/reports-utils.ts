export interface ReportOverview {
  totalLeads: number;
  converted: number;
  conversionRate: number;
  admissions: number;
  revenue: number;
  pipelineValue: number;
}

export interface SourceRow {
  source: string;
  label: string;
  count: number;
}

export interface CounsellorRow {
  userId: string;
  name: string;
  role: string;
  assigned: number;
  converted: number;
  conversionRate: number;
  revenue: number;
}

export function formatInrCompact(v: number): string {
  if (!v) return '₹0';
  if (v >= 10000000) return `₹${(v / 10000000).toFixed(1)}Cr`;
  if (v >= 100000) return `₹${(v / 100000).toFixed(1)}L`;
  if (v >= 1000) return `₹${(v / 1000).toFixed(0)}K`;
  return `₹${v}`;
}

const BAR_COLORS = ['var(--navy)', 'var(--gold)', 'var(--navy)', 'var(--gold)', 'var(--navy)', 'var(--gold)', 'var(--navy)', 'var(--gold)', 'var(--navy)'];
export function barColor(i: number) {
  const c = BAR_COLORS[i % BAR_COLORS.length];
  const opacity = i < 2 ? 1 : Math.max(0.4, 1 - i * 0.12);
  return { background: c, opacity };
}

const AVATAR_COLORS = ['#7C8CE0', '#E6A23C', '#4F8A6B', '#C86B7A', '#5B8CA6', '#B08968', '#8E7CC3', '#D08770'];
export function avatarColor(seed: string) {
  let h = 0;
  for (let i = 0; i < seed.length; i++) h = (h * 31 + seed.charCodeAt(i)) >>> 0;
  return AVATAR_COLORS[h % AVATAR_COLORS.length];
}
export function personInitials(name: string) {
  const parts = name.trim().split(/\s+/);
  return ((parts[0]?.[0] ?? '') + (parts[1]?.[0] ?? '')).toUpperCase() || '?';
}
