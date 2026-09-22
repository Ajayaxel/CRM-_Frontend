'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { CheckCircle2, Circle, ArrowRight, X, PartyPopper, Sparkles } from 'lucide-react';
import { api } from '@/lib/api';
import { useOnboarding } from '../hooks/use-onboarding';
import type { OnboardingStep, OnboardingTrack } from '../onboarding-client';

const card: React.CSSProperties = { background: 'var(--surface)', border: '1px solid var(--line-soft)', borderRadius: 16 };

export function OnboardingHome() {
  const router = useRouter();
  const qc = useQueryClient();
  const { data, isLoading } = useOnboarding();

  const refresh = () => qc.invalidateQueries({ queryKey: ['onboarding-state'] });
  const complete = useMutation({ mutationFn: (key: string) => api.post(`/onboarding/steps/${key}/complete`), onSuccess: () => { refresh(); toast.success('Marked done'); } });
  const dismiss = useMutation({ mutationFn: (key: string) => api.post(`/onboarding/steps/${key}/dismiss`), onSuccess: () => refresh() });
  const skip = useMutation({ mutationFn: () => api.post('/onboarding/skip', { skipped: true }), onSuccess: () => { refresh(); toast.success('Setup hidden — reach it any time from the Setup chip'); router.push('/dashboard'); } });

  if (isLoading || !data) return <div style={{ padding: 40, color: 'var(--ink-3)' }}>Loading your setup…</div>;

  const activeTracks = data.tracks;
  const nextStep = data.steps.find((s) => !s.done && !s.dismissed);

  return (
    <div style={{ animation: 'fadeUp .4s ease', maxWidth: 900 }}>
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 18 }}>
        <div>
          <h1 style={{ fontSize: 26, fontWeight: 700, letterSpacing: '-.02em', margin: 0, display: 'flex', alignItems: 'center', gap: 10 }}>
            <Sparkles size={22} style={{ color: 'var(--gold,#E6A23C)' }} /> Get started
          </h1>
          <p style={{ fontSize: 14, color: 'var(--ink-2)', margin: '6px 0 0' }}>A few steps to get your workspace live. Deep-links take you straight to each screen.</p>
        </div>
        <button className="btn-secondary" onClick={() => skip.mutate()}>Skip for now</button>
      </div>

      {data.activated && (
        <div style={{ ...card, padding: 18, marginBottom: 16, display: 'flex', alignItems: 'center', gap: 12, borderColor: 'var(--success)', background: 'var(--success-bg)' }}>
          <PartyPopper size={22} style={{ color: 'var(--success)' }} />
          <div><div style={{ fontWeight: 700 }}>You're live! 🎉</div><div style={{ fontSize: 13, color: 'var(--ink-2)' }}>Your workspace is activated. Finish any remaining steps whenever you like.</div></div>
        </div>
      )}

      {/* Progress rings per track */}
      <div style={{ display: 'flex', gap: 14, marginBottom: 18, flexWrap: 'wrap' }}>
        {activeTracks.map((t) => <TrackRing key={t.track} track={t} />)}
      </div>

      {/* Steps grouped by track */}
      {activeTracks.map((t) => {
        const steps = data.steps.filter((s) => s.track === t.track && !s.dismissed);
        if (!steps.length) return null;
        return (
          <div key={t.track} style={{ marginBottom: 18 }}>
            <div style={{ fontSize: 12.5, fontWeight: 700, color: 'var(--ink-3)', textTransform: 'uppercase', letterSpacing: '.04em', marginBottom: 10 }}>{t.label}</div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {steps.map((s) => (
                <StepCard key={s.key} step={s} highlight={nextStep?.key === s.key}
                  onComplete={() => complete.mutate(s.key)} onDismiss={() => dismiss.mutate(s.key)} />
              ))}
            </div>
          </div>
        );
      })}
    </div>
  );
}

function TrackRing({ track }: { track: OnboardingTrack }) {
  const pct = track.percent;
  const color = track.activated ? 'var(--success)' : 'var(--brand,#132376)';
  return (
    <div style={{ ...card, padding: 16, display: 'flex', alignItems: 'center', gap: 14, minWidth: 220 }}>
      <div style={{ width: 60, height: 60, borderRadius: '50%', background: `conic-gradient(${color} ${pct * 3.6}deg, var(--surface-2) 0)`, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
        <div style={{ width: 46, height: 46, borderRadius: '50%', background: 'var(--surface)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 800, fontSize: 14, color }}>{pct}%</div>
      </div>
      <div>
        <div style={{ fontWeight: 700, fontSize: 14 }}>{track.label}</div>
        <div style={{ fontSize: 12, color: 'var(--ink-3)' }}>{track.done} of {track.total} done{track.activated ? ' · live' : ''}</div>
      </div>
    </div>
  );
}

function StepCard({ step, highlight, onComplete, onDismiss }: { step: OnboardingStep; highlight: boolean; onComplete: () => void; onDismiss: () => void }) {
  return (
    <div style={{ ...card, padding: 16, display: 'flex', alignItems: 'center', gap: 14, borderColor: highlight ? 'var(--brand,#132376)' : 'var(--line-soft)', opacity: step.done ? 0.72 : 1 }}>
      {step.done ? <CheckCircle2 size={22} style={{ color: 'var(--success)', flexShrink: 0 }} /> : <Circle size={22} style={{ color: highlight ? 'var(--brand,#132376)' : 'var(--ink-3)', flexShrink: 0 }} />}
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontWeight: 700, fontSize: 14.5, textDecoration: step.done ? 'line-through' : 'none' }}>{step.label}</div>
        <div style={{ fontSize: 12.5, color: 'var(--ink-3)', marginTop: 2 }}>{step.why}</div>
      </div>
      {!step.done && (
        <div style={{ display: 'flex', gap: 8, flexShrink: 0 }}>
          <Link href={step.cta.href} className="btn-primary" style={{ height: 34, fontSize: 12.5, textDecoration: 'none', display: 'inline-flex', alignItems: 'center' }}>{step.cta.label} <ArrowRight size={13} style={{ marginLeft: 4 }} /></Link>
          {step.manualOnly && <button className="btn-secondary" style={{ height: 34, fontSize: 12.5 }} onClick={onComplete}>Mark done</button>}
          <button className="btn-secondary" style={{ height: 34, width: 34, padding: 0 }} title="Dismiss" onClick={onDismiss}><X size={14} /></button>
        </div>
      )}
    </div>
  );
}
