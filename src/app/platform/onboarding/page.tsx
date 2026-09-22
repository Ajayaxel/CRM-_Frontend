'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { Send } from 'lucide-react';
import { platformApi, usePlatformAuth } from '@/features/platform/platform-client';
import { can } from '@/features/platform/capabilities';
import { RequireCapability } from '@/features/platform/require-capability';
import { apiErrorMessage } from '@/lib/api';

const card: React.CSSProperties = {
  background: 'var(--surface)', border: '1px solid var(--line-soft)', borderRadius: 16, boxShadow: 'var(--shadow-1)',
};
const mono: React.CSSProperties = {
  fontFamily: 'var(--mono)', fontSize: 10, letterSpacing: '.1em', textTransform: 'uppercase', color: 'var(--ink-3)',
};

interface Funnel {
  total: number; notStarted: number; inProgress: number; activated: number;
  skipped: number; activationRate: number; avgHoursToActivate: number;
}

/**
 * The onboarding funnel, on its own page.
 *
 * It used to sit on the organisations list, which meant SUPPORT — who cannot
 * read it — loaded a 403 on every visit to the console's front door. Giving it
 * a page lets the nav decide who goes there, and gives ONBOARDING somewhere
 * that is theirs rather than a strip on someone else's dashboard.
 */
export default function OnboardingPage() {
  return (
    <RequireCapability capability="onboarding.funnel">
      <OnboardingBody />
    </RequireCapability>
  );
}

function OnboardingBody() {
  const qc = useQueryClient();
  const role = usePlatformAuth((s) => s.admin?.role);
  const { data: funnel, isLoading } = useQuery({
    queryKey: ['pf-funnel'],
    queryFn: async () => (await platformApi.get('/onboarding-funnel')).data as Funnel,
  });
  const nudges = useMutation({
    mutationFn: () => platformApi.post('/onboarding-nudge-run'),
    onSuccess: (r) => {
      qc.invalidateQueries({ queryKey: ['pf-funnel'] });
      toast.success(`Sent ${r.data.sent} nudge${r.data.sent === 1 ? '' : 's'}`);
    },
    onError: (e) => toast.error(apiErrorMessage(e)),
  });

  return (
    <div style={{ animation: 'fadeUp .4s ease' }}>
      <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', gap: 16, marginBottom: 22 }}>
        <div>
          <h1 style={{ fontSize: 26, fontWeight: 700, letterSpacing: '-.02em', margin: 0 }}>Onboarding</h1>
          <p style={{ fontSize: 14, color: 'var(--ink-2)', margin: '6px 0 0' }}>
            How far new organisations get, and who has stalled.
          </p>
        </div>
        {can(role, 'onboarding.nudge') && (
          <button className="btn-secondary" disabled={nudges.isPending} onClick={() => nudges.mutate()}>
            <Send size={14} /> {nudges.isPending ? 'Sending…' : 'Run nudges'}
          </button>
        )}
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 16, marginBottom: 20 }}>
        {[
          { label: 'Organisations', value: funnel?.total },
          { label: 'Activated', value: funnel?.activated },
          { label: 'Activation rate', value: funnel === undefined ? undefined : `${funnel.activationRate}%` },
          { label: 'Avg hours to activate', value: funnel?.avgHoursToActivate },
        ].map((k) => (
          <div key={k.label} style={{ ...card, padding: '16px 18px' }}>
            <div style={mono}>{k.label}</div>
            <div style={{ fontSize: 26, fontWeight: 800, marginTop: 8 }}>
              {isLoading ? '…' : (k.value ?? '—')}
            </div>
          </div>
        ))}
      </div>

      <div style={{ ...card, padding: 18 }}>
        <div style={{ fontWeight: 700, fontSize: 15, marginBottom: 14 }}>Activation funnel</div>
        <div style={{ display: 'flex', height: 12, borderRadius: 20, overflow: 'hidden', marginBottom: 10, background: 'var(--surface-2)' }}>
          <Seg n={funnel?.activated} total={funnel?.total} color="var(--success)" />
          <Seg n={funnel?.inProgress} total={funnel?.total} color="var(--gold)" />
          <Seg n={funnel?.notStarted} total={funnel?.total} color="var(--surface-3)" />
          <Seg n={funnel?.skipped} total={funnel?.total} color="var(--ink-3)" />
        </div>
        <div style={{ display: 'flex', gap: 18, flexWrap: 'wrap', fontSize: 12.5 }}>
          <Legend color="var(--success)" label="Activated" n={funnel?.activated ?? 0} />
          <Legend color="var(--gold)" label="In progress" n={funnel?.inProgress ?? 0} />
          <Legend color="var(--surface-3)" label="Not started" n={funnel?.notStarted ?? 0} />
          <Legend color="var(--ink-3)" label="Skipped" n={funnel?.skipped ?? 0} />
        </div>
      </div>
    </div>
  );
}

function Seg({ n, total, color }: { n?: number; total?: number; color: string }) {
  const w = total ? ((n ?? 0) / total) * 100 : 0;
  return <div style={{ width: `${w}%`, background: color }} />;
}
function Legend({ color, label, n }: { color: string; label: string; n: number }) {
  return (
    <span style={{ display: 'flex', alignItems: 'center', gap: 6, color: 'var(--ink-2)' }}>
      <span style={{ width: 10, height: 10, borderRadius: 3, background: color }} />{label} <b>{n}</b>
    </span>
  );
}
