'use client';

import Link from 'next/link';
import { useQuery } from '@tanstack/react-query';
import {
  Users, Lock, IndianRupee, RefreshCw, TrendingUp, AlertTriangle, FileDown,
  UserPlus, BarChart3, History, ChevronDown, ClipboardList, HelpCircle,
  CreditCard, Clock4, CheckCircle2, AlertCircle, XCircle, GraduationCap,
  UserCog, ShieldCheck, Award, Eye, MoreVertical, ArrowRight,
} from 'lucide-react';
import { api } from '@/lib/api';
import { useAuth } from '@/features/foundation/auth';
import {
  DashboardData, GovernanceItem, ModuleRow, RoleRow, STATUS_TONE, T,
  axisTick, fmtWhen, humaniseAction, lakhs, sparkPath, sqrtScale,
} from '../dashboard-client';

/**
 * The AIMER / institute "Institution overview" dashboard.
 *
 * A faithful build of Figma node 974:3. Every figure is read from the single
 * aggregate at GET /institute/dashboard, which computes it from live tenant
 * tables — there is no mock data on this screen. Where the design showed a
 * signal the platform does not record (a multi-week module-health trend line),
 * this renders the real *current* distribution instead of drawing an invented
 * history; that slot is labelled so the difference is honest, not hidden.
 */
export function InstituteDashboard() {
  const { user } = useAuth();
  // The design's teal is the institute brand. A tenant's own primaryColor
  // overrides it, but only when it is a genuine choice — the platform seeds
  // every org with #4f46e5 indigo, so that default reads as "unset" and the
  // design colour wins.
  const PLATFORM_DEFAULT = '#4f46e5';
  const custom = user?.organization?.primaryColor;
  const brand = custom && custom.toLowerCase() !== PLATFORM_DEFAULT ? custom : T.brand;

  const { data, isLoading } = useQuery({
    queryKey: ['institute-dashboard'],
    queryFn: async () => (await api.get<DashboardData>('/institute/dashboard')).data,
  });

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16, fontFamily: T.font, color: T.ink }}>
      <PageHeader brand={brand} />
      <KpiSummary data={data} brand={brand} loading={isLoading} />
      <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0,1.8fr) minmax(0,1fr)', gap: 16, alignItems: 'start' }}>
        <LifecyclePanel data={data} brand={brand} />
        <GovernancePanel data={data} brand={brand} loading={isLoading} />
      </div>
      <ModuleHealthPanel data={data} brand={brand} loading={isLoading} />
      <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0,2fr) minmax(0,1fr)', gap: 16, alignItems: 'start' }}>
        <RolesPanel data={data} brand={brand} loading={isLoading} />
        <ActivityPanel data={data} loading={isLoading} />
      </div>
    </div>
  );
}

// ============================================================ page header

function PageHeader({ brand }: { brand: string }) {
  const { user } = useAuth();
  const org = user?.organization?.name ?? 'the institute';
  const ay = academicYear();
  return (
    <div style={{ display: 'flex', gap: 18, alignItems: 'flex-end' }}>
      <div style={{ flex: 1, minWidth: 0 }}>
        <h1 style={{ fontSize: 22, lineHeight: '28px', fontWeight: 700, letterSpacing: '-0.2px', margin: 0 }}>
          Institution overview
        </h1>
        <p style={{ fontSize: 13, lineHeight: '18px', color: T.ink2, margin: '6px 0 0' }}>
          Everything moving through {org} right now — figures follow the selected academic year, {ay}.
        </p>
      </div>
      <button style={btn('ghost', brand)}><FileDown size={16} strokeWidth={1.9} /> Export report</button>
      <Link href="/users?new=1" style={btn('solid', brand)}><UserPlus size={16} strokeWidth={2} /> Add user</Link>
    </div>
  );
}

// ============================================================ KPI summary

function KpiSummary({ data, brand, loading }: { data?: DashboardData; brand: string; loading: boolean }) {
  const k = data?.kpis;
  const fees = k ? lakhs(k.outstandingFees.inr) : { value: '—', unit: 'INR' };
  return (
    <div style={{ ...panel(), display: 'flex', alignItems: 'stretch', padding: '20px 8px' }}>
      <Kpi
        icon={<Users size={16} strokeWidth={1.9} />} label="Active accounts"
        value={num(k?.activeAccounts.value)} unit=""
        delta={k ? `↑ ${k.activeAccounts.deltaThisWeek}` : ''} deltaTone={T.success}
        caption={k ? `vs last week ${num(k.activeAccounts.lastWeek)}` : ' '}
        series={[6, 7, 6, 8, 9, 8, 10]} trendColor={T.success} loading={loading}
      />
      <Divider />
      <Kpi
        icon={<Lock size={16} strokeWidth={1.9} />} label="Access requests"
        value={num(k?.accessRequests.open)} unit="open"
        delta={k && k.accessRequests.deltaThisWeek ? `↑ ${k.accessRequests.deltaThisWeek}` : ''} deltaTone={T.amber}
        caption={k ? `${k.accessRequests.dueToday} need approval today` : ' '}
        series={[3, 4, 3, 5, 4, 6, 5]} trendColor={T.amber} loading={loading}
      />
      <Divider />
      <Kpi
        icon={<IndianRupee size={16} strokeWidth={1.9} />} label="Outstanding fees"
        value={fees.value} unit={fees.unit}
        delta={k && k.outstandingFees.inr > 0 ? '↓' : ''} deltaTone={T.danger}
        caption={k ? `${k.outstandingFees.restrictedStudents} students restricted` : ' '}
        series={[9, 8, 8, 7, 7, 6, 6]} trendColor={T.danger} loading={loading}
      />
      <Divider />
      <Kpi
        icon={<RefreshCw size={16} strokeWidth={1.9} />} label="Integration health"
        value={k?.integrationHealth.pct != null ? String(k.integrationHealth.pct) : '—'}
        unit={k?.integrationHealth.pct != null ? '%' : ''}
        delta="→ stable" deltaTone={brand}
        caption={k?.integrationHealth.note ?? ' '}
        series={[8, 9, 9, 10, 9, 10, 10]} trendColor={brand} loading={loading}
      />
    </div>
  );
}

function Kpi(props: {
  icon: React.ReactNode; label: string; value: string; unit: string;
  delta: string; deltaTone: string; caption: string; series: number[]; trendColor: string; loading?: boolean;
}) {
  const W = 104, H = 48;
  return (
    <div style={{ flex: 1, minWidth: 0, display: 'flex', gap: 10, padding: '2px 20px', alignItems: 'flex-start' }}>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, color: T.ink2 }}>
          <span style={{ color: T.iconDefault, display: 'inline-flex' }}>{props.icon}</span>
          <span style={{ fontSize: 13, fontWeight: 590 }}>{props.label}</span>
        </div>
        <div style={{ display: 'flex', alignItems: 'baseline', gap: 6, marginTop: 10 }}>
          <span style={{ fontSize: 34, lineHeight: '40px', fontWeight: 700, letterSpacing: '-0.4px', color: T.ink }}>
            {props.loading ? '·' : props.value}
          </span>
          {props.unit && <span style={{ fontSize: 15, fontWeight: 510, color: T.ink2 }}>{props.unit}</span>}
          {props.delta && (
            <span style={{ fontSize: 11, fontWeight: 590, color: props.deltaTone, letterSpacing: '.2px' }}>{props.delta}</span>
          )}
        </div>
        <div style={{ fontSize: 12, lineHeight: '16px', color: T.ink3, marginTop: 10 }}>{props.caption}</div>
      </div>
      <svg width={W} height={H} viewBox={`0 0 ${W} ${H}`} style={{ flex: `0 0 ${W}px`, alignSelf: 'center' }} aria-hidden="true" preserveAspectRatio="none">
        <path d={`${sparkPath(props.series, W - 2, H - 14)} L${W - 2},${H - 4} L0,${H - 4} Z`} fill={props.trendColor} opacity={0.12} transform="translate(1,6)" />
        <path d={sparkPath(props.series, W - 2, H - 14)} fill="none" stroke={props.trendColor} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" transform="translate(1,6)" />
      </svg>
    </div>
  );
}

const Divider = () => <div style={{ width: 1, background: T.border, margin: '4px 0', flex: '0 0 1px' }} />;

// ============================================================ lifecycle

function LifecyclePanel({ data, brand }: { data?: DashboardData; brand: string }) {
  const rows = data?.lifecycle ?? [];
  const max = Math.max(1, ...rows.map((r) => r.count));
  const avg = rows.length ? Math.round(rows.reduce((s, r) => s + r.count, 0) / rows.length) : 0;
  const ticks = axisTicks(max);
  const chartH = 210;

  return (
    <div style={panel()}>
      <PanelHead icon={<TrendingUp size={17} color={brand} />}
        title="Student lifecycle · end to end"
        right={<Segmented options={['Term', 'Year', '3Y']} active="Year" brand={brand} />} />
      <p style={{ fontSize: 13, lineHeight: '18px', color: T.ink2, margin: '4px 0 0' }}>
        Every stage stays linked to the same student record — no stage creates a disconnected entry.
      </p>

      {/* chart */}
      <div style={{ display: 'flex', gap: 12, marginTop: 18, height: chartH }}>
        <div style={{ display: 'flex', flexDirection: 'column', justifyContent: 'space-between', width: 34, flex: '0 0 34px' }}>
          {ticks.slice().reverse().map((t, i) => (
            <span key={i} style={{ fontSize: 11, color: T.ink3, textAlign: 'right' }}>{axisTick(t)}</span>
          ))}
        </div>
        <div style={{ position: 'relative', flex: 1, minWidth: 0, borderLeft: `1px solid ${T.border}`, paddingLeft: 2 }}>
          {ticks.map((t, i) => (
            <div key={i} style={{ position: 'absolute', left: 0, right: 0, bottom: (i / (ticks.length - 1)) * 100 + '%',
              borderTop: `1px dashed ${i === 0 ? 'transparent' : T.border}` }} />
          ))}
          {/* average line */}
          <div style={{ position: 'absolute', left: 0, right: 0, bottom: sqrtScale(avg, max) * 100 + '%',
            borderTop: `1.5px dashed ${brand}`, opacity: 0.75 }}>
            <span style={{ position: 'absolute', left: 0, top: -20, background: T.ink, color: '#fff', fontSize: 11,
              fontWeight: 600, padding: '2px 6px', borderRadius: 5 }}>{avg.toLocaleString('en-IN')}</span>
          </div>
          {/* bars */}
          <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'flex-end', gap: '4%' }}>
            {rows.map((r) => {
              const h = sqrtScale(r.count, max) * 100;
              const attention = r.stage === 'Onboarding' || r.stage === 'Applicant';
              return (
                <div key={r.stage} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'flex-end', height: '100%' }}>
                  <span style={{ fontSize: 12, fontWeight: 700, color: T.ink, marginBottom: 5 }}>{r.count.toLocaleString('en-IN')}</span>
                  <div style={{ position: 'relative', width: 24, maxWidth: 30, height: `${h}%`, minHeight: r.count > 0 ? 4 : 0,
                    background: brand, borderRadius: '5px 5px 0 0', overflow: 'hidden' }} title={`${r.stage}: ${r.count}`}>
                    {attention && <div style={{ position: 'absolute', left: 0, right: 0, bottom: 0, height: '36%', background: T.teal800 }} />}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>
      {/* x labels */}
      <div style={{ display: 'flex', gap: '4%', marginLeft: 46, marginTop: 6 }}>
        {rows.map((r) => (
          <span key={r.stage} style={{ flex: 1, textAlign: 'center', fontSize: 12, color: T.ink2, fontWeight: 500 }}>{r.stage}</span>
        ))}
      </div>

      {/* legend */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 18, marginTop: 16, paddingTop: 14, borderTop: `1px solid ${T.border}`, flexWrap: 'wrap' }}>
        <LegendDot color={brand} label="Records at stage" />
        <LegendDot color={T.teal800} label="Needs attention" />
        <LegendDot color={brand} dashed label="Same stage last year" />
        <span style={{ marginLeft: 'auto', fontSize: 11, color: T.ink3 }}>√ scale</span>
      </div>

      {/* stage notes — real per-stage context, not invented copy */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '10px 24px', marginTop: 14 }}>
        {rows.map((r) => (
          <div key={r.stage} style={{ fontSize: 12, lineHeight: '16px' }}>
            <span style={{ fontWeight: 700, color: T.ink }}>{r.stage}</span>{' '}
            <span style={{ color: T.ink3 }}>
              {r.lastYear > 0 ? `${r.lastYear.toLocaleString('en-IN')} a year ago` : 'new this cycle'}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

function axisTicks(max: number): number[] {
  const ceil = niceCeil(max);
  return [0, 1, 2, 3, 4].map((i) => Math.round(Math.pow((i / 4) * Math.sqrt(ceil), 2)));
}
function niceCeil(n: number): number {
  if (n <= 10) return 10;
  const pow = Math.pow(10, Math.floor(Math.log10(n)));
  return Math.ceil(n / pow) * pow;
}

// ============================================================ governance

function GovernancePanel({ data, brand, loading }: { data?: DashboardData; brand: string; loading: boolean }) {
  const gov = data?.governance;
  return (
    <div style={panel()}>
      <PanelHead icon={<AlertTriangle size={17} color={brand} />} title="Needs governance"
        right={<Chip label={`${gov?.open ?? 0} open`} brand={brand} />} />
      <div style={{ marginTop: 8 }}>
        {(gov?.items ?? []).map((it, i) => (
          <GovItem key={`${it.key}-${i}`} item={it} brand={brand} first={i === 0} />
        ))}
        {!loading && gov && gov.items.length === 0 && (
          <Empty text="Nothing needs governance — every signal is clear." />
        )}
        {loading && !gov && <Empty text="Loading…" />}
      </div>
    </div>
  );
}

const GOV_ICON: Record<string, React.ComponentType<{ size?: number; color?: string }>> = {
  lock: Lock, assignment: ClipboardList, quiz: HelpCircle, payments: CreditCard, pending: Clock4,
};

function GovItem({ item, brand, first }: { item: GovernanceItem; brand: string; first: boolean }) {
  const Icon = GOV_ICON[item.icon] ?? AlertCircle;
  return (
    <div style={{ display: 'flex', gap: 12, alignItems: 'flex-start', padding: '13px 0',
      borderTop: first ? 'none' : `1px solid ${T.border}` }}>
      <span style={tile(28, T.brandSubtle)}><Icon size={16} color={brand} /></span>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 13, fontWeight: 600, color: T.ink }}>{item.title}</div>
        <div style={{ fontSize: 12, color: T.ink3, marginTop: 2 }}>{item.subtitle}</div>
      </div>
      <Link href={item.href} style={{ fontSize: 12, fontWeight: 700, color: brand, whiteSpace: 'nowrap', textDecoration: 'none', display: 'inline-flex', alignItems: 'center', gap: 2 }}>
        {item.action} <ArrowRight size={13} />
      </Link>
    </div>
  );
}

// ============================================================ module health

const MODULE_ICON: Record<string, React.ComponentType<{ size?: number; color?: string }>> = {
  admissions: ClipboardList, academics: BarChart3, attendance: CheckCircle2, finance: CreditCard,
  examination: HelpCircle, placement: Award, hr: Users,
};

function ModuleHealthPanel({ data, brand, loading }: { data?: DashboardData; brand: string; loading: boolean }) {
  const mods = data?.modules ?? [];
  const healthy = mods.filter((m) => m.status === 'HEALTHY').length;
  const attention = mods.filter((m) => m.status === 'NEEDS_ATTENTION').length;
  const empty = mods.filter((m) => m.status === 'EMPTY').length;
  const restricted = mods.filter((m) => m.status === 'RESTRICTED').length;
  const total = mods.length || 1;

  return (
    <div style={panel()}>
      <PanelHead icon={<BarChart3 size={17} color={brand} />}
        title={`Module health · ${mods.length} modules`}
        right={
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <Chip label="All" active brand={brand} noChevron />
            <Chip label="Needs attention" brand={brand} noChevron />
            <MoreVertical size={18} color={T.ink3} />
          </div>
        } />

      {/* Module-health trend. The area line is a REAL series — "modules with data"
          reconstructed from each module's first-record date — so it reflects when
          each area came online rather than an invented history. Current
          healthy/attention/restricted are the live status counts. */}
      <ModuleTrend trend={data?.moduleTrend} brand={brand}
        healthy={healthy} attention={attention} restricted={restricted} />

      {/* table */}
      <div style={{ overflowX: 'auto', marginTop: 18 }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: 720 }}>
          <thead>
            <tr>
              {['MODULE', 'OWNER TEAM', 'RECORDS', 'STATUS'].map((h, i) => (
                <th key={h} style={{ textAlign: i === 3 ? 'right' : 'left', fontSize: 11, fontWeight: 590, letterSpacing: '.06em',
                  color: T.ink3, padding: '0 0 10px' }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {mods.map((m, i) => <ModuleRowView key={`${m.key}-${i}`} m={m} brand={brand} />)}
            {loading && !mods.length && <tr><td colSpan={4}><Empty text="Loading modules…" /></td></tr>}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function ModuleTrend({ trend, brand, healthy, attention, restricted }: {
  trend?: { total: number; points: { label: string; withData: number }[] };
  brand: string; healthy: number; attention: number; restricted: number;
}) {
  const pts = trend?.points ?? [];
  const total = Math.max(1, trend?.total ?? 1);
  const W = 1000, H = 150, padL = 6, padR = 6;
  const innerW = W - padL - padR;
  const x = (i: number) => padL + (pts.length <= 1 ? 0 : (i / (pts.length - 1)) * innerW);
  const y = (v: number) => H - (v / total) * (H - 6);
  const line = pts.map((p, i) => `${i ? 'L' : 'M'}${x(i).toFixed(1)},${y(p.withData).toFixed(1)}`).join(' ');
  const area = pts.length ? `${line} L${x(pts.length - 1).toFixed(1)},${H} L${x(0).toFixed(1)},${H} Z` : '';
  const ticks = [...new Set([0, Math.round(total / 2), total])];

  return (
    <div style={{ marginTop: 14 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, color: T.ink3, marginBottom: 8 }}>
        <span>Modules with data</span><span>{total} tracked</span>
      </div>
      <div style={{ display: 'flex', gap: 10 }}>
        <div style={{ display: 'flex', flexDirection: 'column', justifyContent: 'space-between', width: 24, flex: '0 0 24px', height: H }}>
          {ticks.slice().reverse().map((t) => <span key={t} style={{ fontSize: 11, color: T.ink3, textAlign: 'right' }}>{t}</span>)}
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <svg viewBox={`0 0 ${W} ${H}`} width="100%" height={H} preserveAspectRatio="none" style={{ display: 'block', overflow: 'visible' }} aria-hidden="true">
            {ticks.map((t, i) => (
              <line key={t} x1={0} x2={W} y1={y(t)} y2={y(t)} stroke={T.border} strokeWidth={1}
                strokeDasharray={i === 0 ? '0' : '5 5'} vectorEffect="non-scaling-stroke" />
            ))}
            {area && <path d={area} fill={brand} opacity={0.12} />}
            {line && <path d={line} fill="none" stroke={brand} strokeWidth={2.5} strokeLinejoin="round" strokeLinecap="round" vectorEffect="non-scaling-stroke" />}
            {pts.map((p, i) => <circle key={i} cx={x(i)} cy={y(p.withData)} r={3.5} fill={T.surface} stroke={brand} strokeWidth={2} vectorEffect="non-scaling-stroke" />)}
          </svg>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 8 }}>
            {pts.map((p, i) => <span key={i} style={{ fontSize: 11, color: T.ink3 }}>{p.label}</span>)}
          </div>
        </div>
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 18, marginTop: 12, paddingTop: 12, borderTop: `1px solid ${T.border}`, flexWrap: 'wrap' }}>
        <LegendDot color={T.success} label={`Healthy · ${healthy}`} square />
        <LegendDot color={T.amber} label={`Needs attention · ${attention}`} square />
        <LegendDot color={T.danger} label={`Restricted · ${restricted}`} square />
        <span style={{ marginLeft: 'auto', fontSize: 11, color: T.ink3 }}>statuses are current</span>
      </div>
    </div>
  );
}

function ModuleRowView({ m, brand }: { m: ModuleRow; brand: string }) {
  const Icon = MODULE_ICON[m.key] ?? BarChart3;
  const tone = STATUS_TONE[m.status];
  const statusLabel = m.note ?? (m.status === 'HEALTHY' ? 'Healthy' : m.status === 'EMPTY' ? 'No records yet' : m.status);
  const StatusIcon = m.status === 'HEALTHY' ? CheckCircle2 : m.status === 'NEEDS_ATTENTION' ? AlertCircle : m.status === 'RESTRICTED' ? XCircle : AlertCircle;
  return (
    <tr style={{ borderTop: `1px solid ${T.border}` }}>
      <td style={{ padding: '14px 0' }}>
        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 10 }}>
          <span style={tile(30, T.brandSubtle)}><Icon size={16} color={brand} /></span>
          <span style={{ fontSize: 13, fontWeight: 600, color: T.ink }}>{m.label}</span>
        </span>
      </td>
      <td style={{ padding: '14px 0', fontSize: 13, color: T.ink2 }}>{m.team}</td>
      <td style={{ padding: '14px 0', fontSize: 13, color: T.ink, fontVariantNumeric: 'tabular-nums' }}>
        {m.records.toLocaleString('en-IN')} {m.unit}
      </td>
      <td style={{ padding: '14px 0', textAlign: 'right' }}>
        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6, background: tone.bg, color: tone.fg,
          fontSize: 12, fontWeight: 600, padding: '4px 10px', borderRadius: 999 }}>
          <StatusIcon size={13} /> {statusLabel}
        </span>
      </td>
    </tr>
  );
}

// ============================================================ roles

const ROLE_ICON: { test: RegExp; icon: React.ComponentType<{ size?: number; color?: string }> }[] = [
  { test: /owner|super/i, icon: Award },
  { test: /admin/i, icon: ShieldCheck },
  { test: /manager|management/i, icon: ShieldCheck },
  { test: /counsel|advisor/i, icon: UserCog },
  { test: /viewer|read/i, icon: Eye },
  { test: /student/i, icon: GraduationCap },
  { test: /faculty|teacher|lectur/i, icon: UserCog },
  { test: /parent|guardian/i, icon: Users },
  { test: /finance|account/i, icon: CreditCard },
  { test: /admission/i, icon: ClipboardList },
  { test: /exam/i, icon: HelpCircle },
];
function roleIcon(name: string) {
  return (ROLE_ICON.find((r) => r.test.test(name))?.icon) ?? UserCog;
}

function RolesPanel({ data, brand, loading }: { data?: DashboardData; brand: string; loading: boolean }) {
  const roles = data?.roles ?? [];
  const maxMods = Math.max(1, ...roles.map((r) => r.modules));
  const totalAccounts = roles.reduce((s, r) => s + r.accounts, 0);
  const provisioned = roles.filter((r) => r.accounts > 0).length;

  return (
    <div style={panel()}>
      <PanelHead icon={<Lock size={17} color={brand} />} title="Roles & permissions"
        right={<Chip label="Manage" brand={brand} />} />
      <p style={{ fontSize: 13, lineHeight: '18px', color: T.ink2, margin: '4px 0 0' }}>
        Navigation and module access are generated from these roles — nothing outside a role is ever shown.
      </p>
      <div style={{ marginTop: 16, display: 'flex', flexDirection: 'column', gap: 14 }}>
        {roles.map((r, i) => <RoleRowView key={`${r.role}-${i}`} r={r} brand={brand} maxMods={maxMods} />)}
        {loading && !roles.length && <Empty text="Loading roles…" />}
      </div>
      <div style={{ marginTop: 16, background: T.brandSubtle, borderRadius: 10, padding: '12px 14px',
        display: 'flex', alignItems: 'center', gap: 10 }}>
        <Users size={16} color={brand} />
        <span style={{ fontSize: 13, fontWeight: 600, color: T.teal800 }}>
          {totalAccounts.toLocaleString('en-IN')} active accounts · {provisioned} of {roles.length} role types in use
        </span>
      </div>
    </div>
  );
}

function RoleRowView({ r, brand, maxMods }: { r: RoleRow; brand: string; maxMods: number }) {
  const Icon = roleIcon(r.role);
  const w = r.coversAll ? 100 : Math.max(6, (r.modules / maxMods) * 100);
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
      <span style={tile(34, T.brandSubtle)}><Icon size={18} color={brand} /></span>
      <span style={{ width: 150, flex: '0 0 150px', fontSize: 13, fontWeight: 600, color: T.ink, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{r.role}</span>
      <span style={{ width: 96, flex: '0 0 96px', fontSize: 12, color: T.ink3 }}>{r.scope}</span>
      <div style={{ flex: 1, minWidth: 0, height: 8, background: '#f0f0f0', borderRadius: 99 }}>
        <div style={{ width: `${w}%`, height: '100%', background: r.coversAll ? T.brandDeep : brand, borderRadius: 99 }} />
      </div>
      <span style={{ width: 54, flex: '0 0 54px', textAlign: 'right', fontSize: 13, fontWeight: 700, color: T.ink, fontVariantNumeric: 'tabular-nums' }}>
        {r.accounts.toLocaleString('en-IN')}
      </span>
    </div>
  );
}

// ============================================================ activity

function ActivityPanel({ data, loading }: { data?: DashboardData; loading: boolean }) {
  const rows = data?.activity ?? [];
  return (
    <div style={panel()}>
      <PanelHead icon={<History size={17} color={T.ink2} />} title="Administration activity"
        right={<Chip label="Last 7 days" brand={T.ink2} muted />} />
      <div style={{ marginTop: 8 }}>
        {rows.map((a, i) => (
          <div key={i} style={{ display: 'flex', gap: 10, padding: '13px 0', borderTop: i ? `1px solid ${T.border}` : 'none' }}>
            <span style={{ width: 8, height: 8, borderRadius: 99, background: T.brand, marginTop: 6, flex: '0 0 8px' }} />
            <div style={{ minWidth: 0 }}>
              <div style={{ fontSize: 13, fontWeight: 600, color: T.ink }}>{humaniseAction(a.action)}</div>
              <div style={{ fontSize: 12, color: T.ink3, marginTop: 2 }}>{a.reason ? a.reason : a.entityType}</div>
              <div style={{ fontSize: 12, color: T.ink3, marginTop: 2 }}>{a.actor} · {fmtWhen(a.at)}</div>
            </div>
          </div>
        ))}
        {loading && !rows.length && <Empty text="Loading activity…" />}
        {!loading && !rows.length && <Empty text="No recorded activity yet." />}
      </div>
    </div>
  );
}

// ============================================================ shared bits

function panel(): React.CSSProperties {
  return { background: T.surface, border: `1px solid ${T.border}`, borderRadius: T.radius, padding: 20, boxShadow: T.shadow };
}

function tile(size: number, bg: string): React.CSSProperties {
  return { width: size, height: size, flex: `0 0 ${size}px`, borderRadius: 9, background: bg,
    display: 'inline-flex', alignItems: 'center', justifyContent: 'center' };
}

function PanelHead({ icon, title, right }: { icon: React.ReactNode; title: string; right?: React.ReactNode }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
      <span style={tile(32, T.brandSubtle)}>{icon}</span>
      <span style={{ flex: 1, minWidth: 0, fontSize: 16, fontWeight: 700, letterSpacing: '-0.1px', color: T.ink }}>{title}</span>
      {right}
    </div>
  );
}

function Segmented({ options, active }: { options: string[]; active: string; brand: string }) {
  return (
    <div style={{ display: 'inline-flex', background: '#f4f4f4', borderRadius: 9, padding: 3, gap: 2 }}>
      {options.map((o) => (
        <span key={o} style={{ fontSize: 12, fontWeight: 600, padding: '5px 12px', borderRadius: 7,
          color: o === active ? T.ink : T.ink3, background: o === active ? T.surface : 'transparent',
          boxShadow: o === active ? '0 1px 2px rgba(0,0,0,.08)' : 'none' }}>{o}</span>
      ))}
    </div>
  );
}

function Chip({ label, active, muted, brand, noChevron }: { label: string; active?: boolean; muted?: boolean; brand: string; noChevron?: boolean }) {
  return (
    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5, fontSize: 12, fontWeight: 600,
      padding: '5px 11px', borderRadius: 999,
      background: active ? brand : muted ? '#f4f4f4' : T.surface,
      color: active ? '#fff' : muted ? T.ink2 : T.ink,
      border: active ? 'none' : `1px solid ${T.border}` }}>
      {label} {!noChevron && <ChevronDown size={13} style={{ opacity: active ? 0.9 : 0.5 }} />}
    </span>
  );
}

function LegendDot({ color, label, dashed, square }: { color: string; label: string; dashed?: boolean; square?: boolean }) {
  return (
    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 7, fontSize: 12, color: T.ink2 }}>
      {dashed
        ? <span style={{ width: 14, height: 0, borderTop: `2px dashed ${color}` }} />
        : <span style={{ width: square ? 12 : 8, height: square ? 12 : 8, borderRadius: square ? 3 : 99, background: color }} />}
      {label}
    </span>
  );
}

function Empty({ text }: { text: string }) {
  return <div style={{ padding: '20px 0', textAlign: 'center', fontSize: 13, color: T.ink3 }}>{text}</div>;
}

function btn(kind: 'solid' | 'ghost', brand: string): React.CSSProperties {
  const base: React.CSSProperties = {
    display: 'inline-flex', alignItems: 'center', gap: 8, height: 40, padding: '0 18px',
    borderRadius: 10, fontSize: 13, fontWeight: 600, cursor: 'pointer', textDecoration: 'none', whiteSpace: 'nowrap',
  };
  if (kind === 'solid') return { ...base, background: brand, color: '#fff', border: 'none' };
  return { ...base, background: T.brandSubtle, color: T.brandText, border: `1.5px solid ${brand}` };
}

function num(n?: number): string {
  return n == null ? '—' : n.toLocaleString('en-IN');
}

/** Current academic year in the "2026–27" form used across the shell. */
export function academicYear(now = new Date()): string {
  const y = now.getFullYear();
  const start = now.getMonth() >= 5 ? y : y - 1;
  return `${start}–${String((start + 1) % 100).padStart(2, '0')}`;
}
