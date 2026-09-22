'use client';

import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { Play, RefreshCw, Settings2, ListChecks, AlertCircle } from 'lucide-react';
import { api, apiErrorMessage } from '@/lib/api';

const card: React.CSSProperties = { background: 'var(--surface)', border: '1px solid var(--line-soft)', borderRadius: 16 };
const th: React.CSSProperties = { padding: '10px 10px', fontSize: 11, letterSpacing: '.04em', textTransform: 'uppercase', color: 'var(--ink-3)', fontWeight: 700, textAlign: 'left', borderBottom: '1px solid var(--line-soft)', whiteSpace: 'nowrap' };
const td: React.CSSProperties = { padding: '8px 10px', borderBottom: '1px solid var(--line-soft)', fontSize: 13 };

interface Job { key: string; label: string; cron: string; lastRunAt: string | null; success: number; failed: number; skipped: number; retrying: number }
interface Execution { id: string; jobKey: string; action: string; status: string; entityType?: string | null; entityId?: string | null; detail?: string | null; createdAt: string }
interface Settings { attendanceThresholdPct: number; attendanceSevereGapPct: number; feeDueSoonDays: number; leadFollowupHours: number; leadInactiveDays: number }

const STATUS_COLOR: Record<string, string> = { SUCCESS: 'var(--success,#1e874b)', FAILED: 'var(--danger,#c0392b)', SKIPPED: 'var(--ink-3)', RETRYING: 'var(--gold,#c67c1e)' };

export function SchedulerFeature() {
  const qc = useQueryClient();
  const [tab, setTab] = useState<'jobs' | 'log' | 'settings'>('jobs');
  const { data: jobs, isLoading } = useQuery({ queryKey: ['auto-jobs'], queryFn: async () => (await api.get<Job[]>('/automation/jobs')).data, refetchInterval: 30000 });
  const run = useMutation({
    mutationFn: (key: string) => api.post(`/automation/jobs/${key}/run`),
    onSuccess: (_r, key) => { toast.success(`${key} ran`); qc.invalidateQueries({ queryKey: ['auto-jobs'] }); qc.invalidateQueries({ queryKey: ['auto-execs'] }); },
    onError: (e) => toast.error(apiErrorMessage(e)),
  });
  const failing = (jobs ?? []).reduce((a, j) => a + j.failed, 0);
  return (
    <div style={{ animation: 'fadeUp .4s ease' }}>
      <div style={{ marginBottom: 18 }}>
        <h1 style={{ fontSize: 26, fontWeight: 700, letterSpacing: '-.02em', margin: 0 }}>Automation & Scheduler</h1>
        <p style={{ fontSize: 14, color: 'var(--ink-2)', margin: '6px 0 0' }}>Every reminder, escalation and sweep the institute runs on — with the receipts. Nothing fires twice for the same occasion.</p>
      </div>
      {failing > 0 && (
        <div style={{ ...card, borderColor: 'var(--danger,#c0392b)', padding: '12px 16px', marginBottom: 12, display: 'flex', gap: 10, alignItems: 'center' }}>
          <AlertCircle size={16} style={{ color: 'var(--danger,#c0392b)' }} />
          <div style={{ fontSize: 12.5 }}>{failing} execution{failing > 1 ? 's' : ''} failed — check the log tab.</div>
        </div>
      )}
      <div style={{ display: 'flex', gap: 8, marginBottom: 14 }}>
        {([['jobs', 'Jobs', RefreshCw], ['log', 'Execution Log', ListChecks], ['settings', 'Thresholds', Settings2]] as const).map(([k, l, Ic]) => (
          <button key={k} className="btn-secondary" style={{ height: 36, fontSize: 12.5, borderColor: tab === k ? 'var(--brand,#132376)' : undefined, color: tab === k ? 'var(--brand,#132376)' : undefined }} onClick={() => setTab(k)}><Ic size={14} /> {l}</button>
        ))}
      </div>
      {tab === 'jobs' && (
        <div style={{ ...card, padding: 0, overflowX: 'auto' }}>
          {isLoading && <div style={{ padding: 30, color: 'var(--ink-3)', fontSize: 13, textAlign: 'center' }}>Loading jobs…</div>}
          {!isLoading && (
            <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: 720 }}>
              <thead><tr><th style={th}>Job</th><th style={th}>Schedule</th><th style={th}>Last run</th><th style={{ ...th, textAlign: 'center' }}>Success</th><th style={{ ...th, textAlign: 'center' }}>Skipped</th><th style={{ ...th, textAlign: 'center' }}>Failed</th><th style={{ ...th, textAlign: 'right' }}></th></tr></thead>
              <tbody>
                {(jobs ?? []).map((j) => (
                  <tr key={j.key}>
                    <td style={td}><div style={{ fontWeight: 600 }}>{j.label}</div><div style={{ fontSize: 11, color: 'var(--ink-3)' }}>{j.key}</div></td>
                    <td style={td}>{j.cron}</td>
                    <td style={td}>{j.lastRunAt ? new Date(j.lastRunAt).toLocaleString('en-IN', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' }) : <span style={{ color: 'var(--ink-3)' }}>never</span>}</td>
                    <td style={{ ...td, textAlign: 'center', color: 'var(--success,#1e874b)', fontWeight: 700 }}>{j.success}</td>
                    <td style={{ ...td, textAlign: 'center', color: 'var(--ink-3)' }}>{j.skipped}</td>
                    <td style={{ ...td, textAlign: 'center', color: j.failed ? 'var(--danger,#c0392b)' : 'var(--ink-3)', fontWeight: j.failed ? 700 : 400 }}>{j.failed}</td>
                    <td style={{ ...td, textAlign: 'right' }}><button className="btn-secondary" style={{ height: 30, fontSize: 12 }} disabled={run.isPending} onClick={() => run.mutate(j.key)}><Play size={12} /> Run now</button></td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      )}
      {tab === 'log' && <ExecutionLog />}
      {tab === 'settings' && <ThresholdSettings />}
    </div>
  );
}

function ExecutionLog() {
  const [status, setStatus] = useState('');
  const [jobKey, setJobKey] = useState('');
  const { data, isLoading } = useQuery({
    queryKey: ['auto-execs', status, jobKey],
    queryFn: async () => (await api.get<Execution[]>('/automation/executions', { params: { ...(status ? { status } : {}), ...(jobKey ? { jobKey } : {}) } })).data,
    refetchInterval: 30000,
  });
  return (
    <div>
      <div style={{ display: 'flex', gap: 10, marginBottom: 12 }}>
        <select className="input" style={{ height: 36, width: 160 }} value={status} onChange={(e) => setStatus(e.target.value)}>
          <option value="">All statuses</option>
          {['SUCCESS', 'FAILED', 'SKIPPED', 'RETRYING'].map((s) => <option key={s} value={s}>{s}</option>)}
        </select>
        <input className="input" style={{ height: 36, width: 220 }} placeholder="Filter by job key…" value={jobKey} onChange={(e) => setJobKey(e.target.value)} />
      </div>
      <div style={{ ...card, padding: 0, overflowX: 'auto' }}>
        {isLoading && <div style={{ padding: 30, color: 'var(--ink-3)', fontSize: 13, textAlign: 'center' }}>Loading executions…</div>}
        {!isLoading && !data?.length && <div style={{ padding: 30, color: 'var(--ink-3)', fontSize: 13, textAlign: 'center' }}>No executions match. The scheduler writes a row for every action it takes.</div>}
        {!!data?.length && (
          <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: 720 }}>
            <thead><tr><th style={th}>When</th><th style={th}>Job</th><th style={th}>Action</th><th style={th}>Entity</th><th style={th}>Status</th><th style={th}>Detail</th></tr></thead>
            <tbody>
              {data.map((e) => (
                <tr key={e.id}>
                  <td style={{ ...td, whiteSpace: 'nowrap' }}>{new Date(e.createdAt).toLocaleString('en-IN', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })}</td>
                  <td style={td}>{e.jobKey}</td>
                  <td style={td}>{e.action}</td>
                  <td style={td}>{e.entityType ? `${e.entityType}` : '—'}</td>
                  <td style={td}><span className="badge" style={{ background: 'var(--surface-2)', color: STATUS_COLOR[e.status] ?? 'var(--ink-2)' }}>{e.status}</span></td>
                  <td style={{ ...td, fontSize: 12, color: 'var(--ink-2)', maxWidth: 320, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={e.detail ?? ''}>{e.detail ?? '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}

function ThresholdSettings() {
  const qc = useQueryClient();
  const { data } = useQuery({ queryKey: ['auto-settings'], queryFn: async () => (await api.get<Settings>('/automation/settings')).data });
  const [edits, setEdits] = useState<Partial<Record<keyof Settings, string>>>({});
  const save = useMutation({
    mutationFn: () => api.post('/automation/settings', Object.fromEntries(Object.entries(edits).map(([k, v]) => [k, Number(v)]))),
    onSuccess: () => { setEdits({}); qc.invalidateQueries({ queryKey: ['auto-settings'] }); toast.success('Thresholds saved'); },
    onError: (e) => toast.error(apiErrorMessage(e)),
  });
  if (!data) return <div style={{ ...card, padding: 30, textAlign: 'center', color: 'var(--ink-3)', fontSize: 13 }}>Loading…</div>;
  const FIELDS: [keyof Settings, string, string][] = [
    ['attendanceThresholdPct', 'Attendance shortage threshold (%)', 'Below this → student + parent alert. BRD default 80.'],
    ['attendanceSevereGapPct', 'Severe band (points below threshold)', 'This far below threshold → management escalation.'],
    ['feeDueSoonDays', 'Fee due-soon window (days)', 'Reminders start this many days before the due date.'],
    ['leadFollowupHours', 'Lead follow-up window (hours)', 'No activity within this window → counsellor reminder.'],
    ['leadInactiveDays', 'Lead inactivity escalation (days)', 'No activity for this long → management escalation.'],
  ];
  return (
    <div style={{ ...card, padding: 20, maxWidth: 560 }}>
      <div style={{ fontSize: 12, color: 'var(--ink-3)', marginBottom: 14 }}>These are institute policy, not fixed product behaviour. Changes apply from the next scheduled sweep.</div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
        {FIELDS.map(([key, label, help]) => (
          <div key={key} style={{ display: 'flex', gap: 14, alignItems: 'center' }}>
            <div style={{ flex: 1 }}><div style={{ fontSize: 13.5, fontWeight: 600 }}>{label}</div><div style={{ fontSize: 11.5, color: 'var(--ink-3)' }}>{help}</div></div>
            <input className="input" style={{ width: 90, height: 36, textAlign: 'center' }} type="number" value={edits[key] ?? String(data[key])} onChange={(e) => setEdits((s) => ({ ...s, [key]: e.target.value }))} />
          </div>
        ))}
      </div>
      <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 16 }}>
        <button className="btn-primary" style={{ height: 38 }} disabled={!Object.keys(edits).length || save.isPending} onClick={() => save.mutate()}>Save thresholds</button>
      </div>
    </div>
  );
}
