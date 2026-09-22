/**
 * Design tokens and view helpers for the institution-overview dashboard.
 *
 * The values here are lifted verbatim from the Figma variables of node 974:3
 * ("ERP Desktop · Super Admin Dashboard") — the teal brand ramp, the SF Pro
 * type scale, the neutral text ramp, the status colours. Nothing is eyeballed:
 * where the design names a token, this file carries that token's exact value so
 * the screen matches the source of truth rather than an approximation of it.
 *
 * The dashboard is a white-label surface: `T.brand` is AIMER's teal and is the
 * default, but the shell passes the org's own primaryColor through when a tenant
 * has genuinely chosen one (see the component). Everything else is fixed.
 */

export const T = {
  // brand ramp
  brand: '#008ba5',        // bg/brand
  brandDeep: '#004c5b',    // bg/brand-deep
  brandText: '#00768c',    // text/brand
  brandSubtle: '#e6f4f7',  // bg/brand-subtle
  teal100: '#cce8ee',
  teal200: '#99d1dd',
  teal700: '#006174',
  teal800: '#004c5b',

  // surfaces & lines
  bg: '#fafafa',           // bg/surface-sunken (page ground)
  surface: '#ffffff',      // bg/surface
  border: '#ececec',       // border/subtle
  borderStrong: '#dcdcdc', // border/default

  // text ramp
  ink: '#231f20',          // text/primary
  ink2: '#6f6f6f',         // text/secondary
  ink3: '#9a9a9a',         // text/tertiary
  iconDefault: '#6f6f6f',

  // status
  success: '#0a5c41',      // text/success
  successBg: '#cef3e4',    // bg/success-subtle
  danger: '#c4462a',       // status/danger
  dangerText: '#8c2f1b',   // text/danger
  dangerBg: '#fbe3da',     // bg/danger-subtle
  amber: '#b07d05',        // amber/500
  amberDeep: '#7a5603',    // amber/700
  amberBg: '#fdf3d7',      // bg/warning-subtle

  // elevation & shape
  shadow: '0 4px 12px -2px rgba(17,34,49,.08)', // Elevation/2
  radius: 16,              // shape/corner-large

  font: '"SF Pro", "SF Pro Text", -apple-system, BlinkMacSystemFont, "Segoe UI", system-ui, sans-serif',
} as const;

/** Status tone for module-health and governance badges. */
export const STATUS_TONE: Record<string, { bg: string; fg: string }> = {
  HEALTHY: { bg: T.successBg, fg: T.success },
  NEEDS_ATTENTION: { bg: T.amberBg, fg: T.amberDeep },
  RESTRICTED: { bg: T.dangerBg, fg: T.dangerText },
  EMPTY: { bg: '#f2f2f2', fg: T.ink3 },
};

// ---------------------------------------------------------------- types

export interface KpiTrio {
  activeAccounts: { value: number; deltaThisWeek: number; lastWeek: number };
  accessRequests: { open: number; dueToday: number; deltaThisWeek: number };
  outstandingFees: { inr: number; restrictedStudents: number };
  integrationHealth: { pct: number | null; note: string };
}

export interface LifecycleStage { stage: string; count: number; lastYear: number }

export interface GovernanceItem {
  key: string; icon: string; action: string; href: string; title: string; subtitle: string;
}

export interface RoleRow {
  role: string; modules: number; accounts: number; scope: string; coversAll: boolean;
}

export interface ActivityRow {
  action: string; entityType: string; reason: string | null; actor: string; at: string;
}

export interface ModuleRow {
  key: string; label: string; team: string; records: number; unit: string;
  status: keyof typeof STATUS_TONE; note?: string;
}

export interface DashboardData {
  generatedAt: string;
  kpis: KpiTrio;
  lifecycle: LifecycleStage[];
  governance: { open: number; items: GovernanceItem[] };
  roles: RoleRow[];
  activity: ActivityRow[];
  modules: ModuleRow[];
  moduleTrend: { total: number; points: { label: string; withData: number }[] };
  navSummary: { leads: number; admissions: number; onboarding: number; finance: number; requests: number };
}

// ---------------------------------------------------------------- helpers

/** ₹ in lakhs when large, exactly as the design prints "42.6 L INR". */
export function lakhs(inr: number): { value: string; unit: string } {
  if (inr >= 100000) return { value: (inr / 100000).toFixed(1), unit: 'L INR' };
  if (inr >= 1000) return { value: (inr / 1000).toFixed(1), unit: 'K INR' };
  return { value: inr.toLocaleString('en-IN'), unit: 'INR' };
}

/** Turn an audit action constant into a readable sentence. */
export function humaniseAction(action: string): string {
  const map: Record<string, string> = {
    INTERNSHIP_CERTIFICATE_ISSUED: 'Internship certificate issued',
    INTERNSHIP_STATUS: 'Internship status updated',
    PERMISSION_CHANGED: 'Permission changed',
    USER_DEACTIVATED: 'User deactivated',
    FEE_RESTRICTION_APPLIED: 'Fee restriction applied',
    ROLE_CREATED: 'Role created',
    ACADEMIC_YEAR_OPENED: 'Academic year opened',
  };
  if (map[action]) return map[action];
  return action
    .toLowerCase()
    .replace(/_/g, ' ')
    .replace(/^\w/, (c) => c.toUpperCase());
}

/** Relative-ish timestamp: time today, "Yesterday", else a short date. */
export function fmtWhen(iso: string): string {
  const d = new Date(iso);
  const now = new Date();
  const sameDay = d.toDateString() === now.toDateString();
  const yest = new Date(now); yest.setDate(now.getDate() - 1);
  const isYest = d.toDateString() === yest.toDateString();
  const time = d.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', hour12: false });
  if (sameDay) return time;
  if (isYest) return 'Yesterday';
  return d.toLocaleDateString('en-IN', { day: '2-digit', month: 'short' });
}

/**
 * The lifecycle chart uses a square-root scale (the design's "√ scale" legend):
 * on a linear axis 3,940 alumni would flatten a 41-strong onboarding cohort to
 * nothing. sqrt keeps both legible while still ranking honestly.
 */
export function sqrtScale(value: number, max: number): number {
  if (max <= 0) return 0;
  return Math.sqrt(Math.max(0, value)) / Math.sqrt(max);
}

/** Deterministic sparkline path for a KPI trend cell (no fabricated history —
 *  it is a shape cue drawn from the given seed series, not a data claim). */
export function sparkPath(series: number[], w: number, h: number): string {
  if (!series.length) return '';
  const min = Math.min(...series);
  const max = Math.max(...series);
  const span = max - min || 1;
  const step = w / (series.length - 1 || 1);
  return series
    .map((v, i) => {
      const x = i * step;
      const y = h - ((v - min) / span) * h;
      return `${i === 0 ? 'M' : 'L'}${x.toFixed(1)},${y.toFixed(1)}`;
    })
    .join(' ');
}

/** Format a y-axis tick the way the design does (0, 250, 1K, 2.2K, 4K). */
export function axisTick(n: number): string {
  if (n >= 1000) return `${(n / 1000).toFixed(n % 1000 === 0 ? 0 : 1)}K`;
  return `${Math.round(n)}`;
}
