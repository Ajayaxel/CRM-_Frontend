'use client';

import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { Award, CalendarCheck, CheckCircle2, ClipboardCheck, ShieldCheck, XCircle } from 'lucide-react';
import { api, apiErrorMessage } from '@/lib/api';

/** SolarOS Phase 1 — QA inspection, commissioning chain, warranty claims, AMC visits. */

const box: React.CSSProperties = { border: '1px solid var(--line-soft)', borderRadius: 12, padding: '12px 14px', marginTop: 8 };

function Head({ icon: Icon, title, action }: { icon: any; title: string; action?: React.ReactNode }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 8, margin: '18px 0 4px' }}>
      <Icon size={15} style={{ color: 'var(--ink-3)' }} />
      <div style={{ fontWeight: 700, fontSize: 14 }}>{title}</div>
      <div style={{ flex: 1 }} />
      {action}
    </div>
  );
}
const Muted = ({ children }: { children: React.ReactNode }) => <div style={{ fontSize: 12.5, color: 'var(--ink-3)', marginTop: 6 }}>{children}</div>;

// ============================================================ #12 QA

export function QaPanel({ projectId }: { projectId: string }) {
  const qc = useQueryClient();
  const key = ['solar-qa', projectId];
  const { data } = useQuery({ queryKey: key, queryFn: async () => (await api.get<any[]>(`/solar/projects/${projectId}/qa`)).data });
  const refresh = () => qc.invalidateQueries({ queryKey: key });
  const [inspector, setInspector] = useState('');

  const create = useMutation({
    mutationFn: () => api.post(`/solar/projects/${projectId}/qa`, {}),
    onSuccess: () => { toast.success('Inspection opened — work through the checklist'); refresh(); },
    onError: (e) => toast.error(apiErrorMessage(e)),
  });
  const tick = useMutation({
    mutationFn: ({ id, key: k, ok }: { id: string; key: string; ok: boolean }) => api.patch(`/solar/qa/${id}/tick`, { key: k, ok }),
    onSuccess: refresh, onError: (e) => toast.error(apiErrorMessage(e)),
  });
  const submit = useMutation({
    mutationFn: (id: string) => api.post(`/solar/qa/${id}/submit`, { inspectedBy: inspector }),
    onSuccess: (r: any) => {
      r.data?.status === 'FAIL' || r.data?.reworkWorkOrderId
        ? toast.warning('QA FAILED — a rework job with the failed items was created')
        : toast.success('QA passed — commissioning is unlocked');
      refresh();
    },
    onError: (e) => toast.error(apiErrorMessage(e)),
  });

  const open = (data ?? []).find((i) => i.status === 'PENDING');
  const last = (data ?? []).find((i) => i.status !== 'PENDING');

  return (
    <div>
      <Head icon={ClipboardCheck} title="Quality inspection" action={
        !open && <button className="btn-secondary" style={{ height: 28, fontSize: 12 }} disabled={create.isPending} onClick={() => create.mutate()}>New inspection</button>} />
      {!open && !last && <Muted>No inspections yet — QA must pass before commissioning.</Muted>}
      {last && !open && (
        <div style={{ ...box, display: 'flex', alignItems: 'center', gap: 8 }}>
          {last.status === 'PASS' ? <CheckCircle2 size={15} color="#1e874b" /> : <XCircle size={15} color="#c0392b" />}
          <span style={{ fontSize: 13 }}>
            <b>{last.status}</b> · {last.inspectedBy} · {new Date(last.inspectedAt).toLocaleDateString()}
            {last.status === 'FAIL' && <span style={{ color: 'var(--ink-3)' }}> — rework job created</span>}
          </span>
        </div>
      )}
      {open && (
        <div style={box}>
          {(open.items as any[]).map((i) => (
            <div key={i.key} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '5px 0', fontSize: 12.5 }}>
              <span style={{ flex: 1 }}>{i.label}</span>
              <button className={i.ok === true ? 'btn-primary' : 'btn-secondary'} style={{ height: 24, fontSize: 11, padding: '0 8px' }} onClick={() => tick.mutate({ id: open.id, key: i.key, ok: true })}>Pass</button>
              <button className={i.ok === false ? 'btn-primary' : 'btn-secondary'} style={{ height: 24, fontSize: 11, padding: '0 8px', ...(i.ok === false ? { background: 'var(--danger,#c0392b)' } : {}) }} onClick={() => tick.mutate({ id: open.id, key: i.key, ok: false })}>Fail</button>
            </div>
          ))}
          <div style={{ display: 'flex', gap: 8, marginTop: 10 }}>
            <input className="input" style={{ height: 30, fontSize: 12.5, flex: 1 }} placeholder="Inspector name" value={inspector} onChange={(e) => setInspector(e.target.value)} />
            <button className="btn-primary" style={{ height: 30, fontSize: 12.5 }} disabled={!inspector.trim() || submit.isPending} onClick={() => submit.mutate(open.id)}>Submit inspection</button>
          </div>
        </div>
      )}
    </div>
  );
}

// ============================================================ #13 commissioning

const COMMISSION_STEPS: { key: string; label: string; at: string }[] = [
  { key: 'report', label: 'Commission report', at: 'reportAt' },
  { key: 'inverter', label: 'Inverter registered with maker', at: 'inverterRegisteredAt' },
  { key: 'monitoring', label: 'Monitoring activated', at: 'monitoringActivatedAt' },
  { key: 'warranty', label: 'Warranties registered on serials', at: 'warrantyRegisteredAt' },
];

export function CommissioningPanel({ projectId }: { projectId: string }) {
  const qc = useQueryClient();
  const key = ['solar-commissioning', projectId];
  const { data: rec } = useQuery({ queryKey: key, queryFn: async () => (await api.get<any>(`/solar/projects/${projectId}/commissioning`)).data });
  const step = useMutation({
    mutationFn: (s: string) => api.post(`/solar/projects/${projectId}/commissioning/${s}`, {}),
    onSuccess: () => qc.invalidateQueries({ queryKey: key }),
    onError: (e) => toast.error(apiErrorMessage(e)),
  });
  return (
    <div>
      <Head icon={Award} title="Commissioning" action={rec?.completedAt && <span style={{ fontSize: 11.5, color: '#1e874b', fontWeight: 700 }}>COMPLETE · {rec.reportRef}</span>} />
      <div style={box}>
        {COMMISSION_STEPS.map((s) => {
          const done = rec?.[s.at];
          return (
            <div key={s.key} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '5px 0', fontSize: 12.5 }}>
              {done ? <CheckCircle2 size={13} color="#1e874b" /> : <span style={{ width: 13, height: 13, borderRadius: 7, border: '1.5px solid var(--line)' }} />}
              <span style={{ flex: 1, color: done ? 'var(--ink-3)' : undefined }}>{s.label}</span>
              {done
                ? <span style={{ fontSize: 11, color: 'var(--ink-3)' }}>{new Date(done).toLocaleDateString()}</span>
                : <button className="btn-secondary" style={{ height: 24, fontSize: 11 }} disabled={step.isPending} onClick={() => step.mutate(s.key)}>Mark done</button>}
            </div>
          );
        })}
        <Muted>The warranty step stamps 12y/25y (panels) and 5y (inverter) onto every registered serial that lacks one.</Muted>
      </div>
    </div>
  );
}

// ============================================================ #18 warranty claims

export function ClaimsPanel({ projectId }: { projectId: string }) {
  const qc = useQueryClient();
  const key = ['solar-claims', projectId];
  const { data: claims } = useQuery({ queryKey: key, queryFn: async () => (await api.get<any[]>(`/solar/warranty-claims?projectId=${projectId}`)).data });
  const refresh = () => qc.invalidateQueries({ queryKey: key });
  const [f, setF] = useState({ serial: '', issue: '' });

  const create = useMutation({
    mutationFn: () => api.post('/solar/warranty-claims', { projectId, serial: f.serial.trim(), issue: f.issue.trim() }),
    onSuccess: (r: any) => { setF({ serial: '', issue: '' }); toast[r.data.underWarranty ? 'success' : 'warning'](r.data.underWarranty ? 'Validated — inside the warranty window' : 'Rejected — outside the warranty window'); refresh(); },
    onError: (e) => toast.error(apiErrorMessage(e)),
  });
  const vendor = useMutation({
    mutationFn: (id: string) => { const ref = window.prompt('Vendor claim reference?'); if (!ref) throw new Error('cancelled'); return api.post(`/solar/warranty-claims/${id}/vendor`, { vendorRef: ref }); },
    onSuccess: () => { toast.success('Filed with the vendor'); refresh(); }, onError: (e: any) => e.message !== 'cancelled' && toast.error(apiErrorMessage(e)),
  });
  const replace = useMutation({
    mutationFn: (id: string) => { const serial = window.prompt('Replacement serial number?'); if (!serial) throw new Error('cancelled'); return api.post(`/solar/warranty-claims/${id}/replace`, { replacementSerial: serial }); },
    onSuccess: () => { toast.success('Replacement recorded — new serial registered'); refresh(); }, onError: (e: any) => e.message !== 'cancelled' && toast.error(apiErrorMessage(e)),
  });
  const notify = useMutation({
    mutationFn: (id: string) => api.post(`/solar/warranty-claims/${id}/notify`, {}),
    onSuccess: () => { toast.success('Customer notified'); refresh(); }, onError: (e) => toast.error(apiErrorMessage(e)),
  });

  const STATUS_COLOR: Record<string, string> = { VALIDATED: '#b8791f', CLAIMED: '#132376', REPLACED: '#1e874b', REJECTED: '#c0392b', CLOSED: 'var(--ink-3)' };

  return (
    <div>
      <Head icon={ShieldCheck} title="Warranty claims" />
      <div style={{ display: 'flex', gap: 6, marginTop: 6 }}>
        <input className="input" style={{ height: 28, fontSize: 12, width: 150 }} placeholder="Serial" value={f.serial} onChange={(e) => setF({ ...f, serial: e.target.value })} />
        <input className="input" style={{ height: 28, fontSize: 12, flex: 1 }} placeholder="Issue (e.g. inverter display dead)" value={f.issue} onChange={(e) => setF({ ...f, issue: e.target.value })} />
        <button className="btn-secondary" style={{ height: 28, fontSize: 12 }} disabled={!f.serial.trim() || !f.issue.trim() || create.isPending} onClick={() => create.mutate()}>Validate</button>
      </div>
      {(claims ?? []).map((c) => (
        <div key={c.id} style={{ ...box, display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
          <span style={{ fontFamily: 'var(--mono)', fontSize: 11.5 }}>{c.serial}</span>
          <span style={{ fontSize: 12.5, flex: 1, minWidth: 120 }}>{c.issue}</span>
          <span style={{ fontSize: 10.5, fontFamily: 'var(--mono)', fontWeight: 700, color: STATUS_COLOR[c.status] ?? 'var(--ink-2)' }}>{c.status}{c.vendorRef ? ` · ${c.vendorRef}` : ''}{c.replacementSerial ? ` → ${c.replacementSerial}` : ''}</span>
          {c.status === 'VALIDATED' && <button className="btn-secondary" style={{ height: 24, fontSize: 11 }} onClick={() => vendor.mutate(c.id)}>File with vendor</button>}
          {c.status === 'CLAIMED' && <button className="btn-secondary" style={{ height: 24, fontSize: 11 }} onClick={() => replace.mutate(c.id)}>Record replacement</button>}
          {(c.status === 'REPLACED' || c.status === 'REJECTED') && !c.notifiedAt && <button className="btn-secondary" style={{ height: 24, fontSize: 11 }} onClick={() => notify.mutate(c.id)}>Notify customer</button>}
        </div>
      ))}
    </div>
  );
}

// ============================================================ #17 AMC visits

export function AmcVisitsPanel({ projectId }: { projectId: string }) {
  const qc = useQueryClient();
  const key = ['solar-amc-visits', projectId];
  const { data: amc } = useQuery({ queryKey: key, queryFn: async () => (await api.get<any>(`/solar/projects/${projectId}/amc`)).data });
  const [findings, setFindings] = useState<Record<string, string>>({});
  const complete = useMutation({
    mutationFn: (visitId: string) => api.post(`/solar/amc-visits/${visitId}/complete`, { findings: findings[visitId] || 'Routine preventive maintenance completed' }),
    onSuccess: () => { toast.success('Visit closed — report filed, invoice raised, next visit scheduled'); qc.invalidateQueries({ queryKey: key }); },
    onError: (e) => toast.error(apiErrorMessage(e)),
  });
  const visits = amc?.visits ?? amc?.contract?.visits ?? [];
  if (!amc && !visits.length) return null;
  return (
    <div>
      <Head icon={CalendarCheck} title="AMC visits" />
      {!visits.length && <Muted>No AMC visits scheduled.</Muted>}
      {visits.map((v: any) => (
        <div key={v.id} style={{ ...box, fontSize: 12.5 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <span style={{ fontWeight: 600 }}>{new Date(v.dueAt).toLocaleDateString()}</span>
            <span style={{ fontSize: 10.5, fontFamily: 'var(--mono)', color: v.status === 'DONE' ? '#1e874b' : v.status === 'MISSED' ? '#c0392b' : '#b8791f' }}>{v.status}</span>
            {v.reportRef && <span style={{ fontSize: 11, color: 'var(--ink-3)' }}>{v.reportRef}{v.invoiceId ? ' · invoiced' : ''}</span>}
            <div style={{ flex: 1 }} />
          </div>
          {v.status === 'DUE' && (
            <div style={{ display: 'flex', gap: 6, marginTop: 8 }}>
              <input className="input" style={{ height: 28, fontSize: 12, flex: 1 }} placeholder="Findings / inspection notes" value={findings[v.id] ?? ''} onChange={(e) => setFindings({ ...findings, [v.id]: e.target.value })} />
              <button className="btn-primary" style={{ height: 28, fontSize: 12 }} disabled={complete.isPending} onClick={() => complete.mutate(v.id)}>Complete visit</button>
            </div>
          )}
          {v.findings && <div style={{ marginTop: 6, color: 'var(--ink-3)' }}>{v.findings}</div>}
        </div>
      ))}
    </div>
  );
}
