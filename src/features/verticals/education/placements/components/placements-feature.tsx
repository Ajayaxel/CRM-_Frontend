'use client';

import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import {
  Briefcase, Building2, Plus, Trash2, ChevronDown, ChevronRight, Users, MapPin,
  IndianRupee, Handshake, CalendarClock, X, Award, FileText, CheckCircle2,
} from 'lucide-react';
import { api, apiErrorMessage } from '@/lib/api';
import { useAuth } from '@/features/foundation/auth';
import { T } from '@/features/verticals/education/institute-dashboard';
import { CorporateTab } from './corporate-tab';
import {
  APP_META, APP_STAGES, Applicant, AppStatus, Company, Job, JOB_TYPE_LABEL, JobType,
  PlacementOverview, ctcLabel, Drive, DriveStatus, DRIVE_STATUS_LABEL,
} from '../placements-client';

/* ------------------------------------------------------------------ tokens */
const card: React.CSSProperties = { background: T.surface, border: `1px solid ${T.border}`, borderRadius: T.radius };
const inp: React.CSSProperties = { padding: '10px 12px', borderRadius: 10, border: `1px solid ${T.border}`, background: T.surface, fontSize: 13, fontFamily: T.font, color: T.ink, boxSizing: 'border-box', width: '100%' };
const primaryBtn: React.CSSProperties = { display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 7, height: 42, padding: '0 16px', borderRadius: 10, fontSize: 13, fontWeight: 600, cursor: 'pointer', fontFamily: T.font, border: 'none', background: T.brand, color: '#fff' };
const outlineBtn: React.CSSProperties = { display: 'inline-flex', alignItems: 'center', gap: 6, height: 36, padding: '0 12px', borderRadius: 10, fontSize: 12.5, fontWeight: 600, cursor: 'pointer', fontFamily: T.font, background: T.surface, color: T.ink, border: `1px solid ${T.border}` };

const DRIVE_TONE: Record<DriveStatus, { bg: string; fg: string }> = {
  SCHEDULED: { bg: T.brandSubtle, fg: T.brandText },
  CONFIRMED: { bg: T.successBg, fg: T.success },
  AWAITING_MOU: { bg: T.amberBg, fg: T.amberDeep },
  COMPLETED: { bg: '#f2f2f2', fg: T.ink3 },
  CANCELLED: { bg: T.dangerBg, fg: T.dangerText },
};
const TABS = [['jobs', 'Job openings', Briefcase], ['companies', 'Companies', Building2], ['corporate', 'Corporate relations', Handshake]] as const;

export function PlacementsFeature() {
  const [tab, setTab] = useState<(typeof TABS)[number][0]>('jobs');
  const { hasPermission } = useAuth();
  const canManage = hasPermission('placement.manage');
  const canCorporate = hasPermission('corporate.manage');
  const { data: ov } = useQuery({ queryKey: ['placement-overview'], queryFn: async () => (await api.get<PlacementOverview>('/placements/overview')).data });

  const kpis = [
    { label: 'Companies', value: ov?.companies, icon: <Building2 size={16} />, fg: T.brandText },
    { label: 'Offers', value: ov?.offers, icon: <Award size={16} />, fg: T.amberDeep },
    { label: 'Applications', value: ov?.applications, icon: <FileText size={16} />, fg: T.brandText },
    { label: 'Placed', value: ov?.placed, icon: <CheckCircle2 size={16} />, fg: T.success },
  ];

  return (
    <div style={{ animation: 'fadeUp .4s ease', fontFamily: T.font, color: T.ink }}>
      <div style={{ marginBottom: 18 }}>
        <h1 style={{ fontSize: 26, fontWeight: 700, letterSpacing: '-.02em', margin: 0 }}>Placements</h1>
        <p style={{ fontSize: 14, color: T.ink2, margin: '6px 0 0' }}>Manage recruiters, post openings and move students through the hiring pipeline.</p>
      </div>

      <div style={{ ...card, padding: 4, marginBottom: 16 }}>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(180px,1fr))' }}>
          {kpis.map((k, i) => (
            <div key={k.label} style={{ padding: '16px 20px', borderLeft: i ? `1px solid ${T.border}` : undefined }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 7, fontSize: 12.5, color: T.ink2, fontWeight: 600 }}>
                <span style={{ color: k.fg }}>{k.icon}</span> {k.label}
              </div>
              <div style={{ fontSize: 30, fontWeight: 800, marginTop: 6, color: T.ink }}>{k.value == null ? '—' : k.value.toLocaleString()}</div>
            </div>
          ))}
        </div>
      </div>

      <div style={{ display: 'flex', gap: 8, marginBottom: 16, flexWrap: 'wrap' }}>
        {TABS.map(([k, l, Ic]) => (
          <button key={k} onClick={() => setTab(k)} style={{
            display: 'inline-flex', alignItems: 'center', gap: 7, height: 38, padding: '0 14px', borderRadius: 10,
            fontSize: 13, fontWeight: 600, cursor: 'pointer', fontFamily: T.font,
            color: tab === k ? T.brandText : T.ink2, background: tab === k ? T.brandSubtle : 'transparent', border: `1px solid ${tab === k ? T.brand : T.border}`,
          }}><Ic size={14} /> {l}</button>
        ))}
      </div>

      {tab === 'jobs' ? <JobsTab canManage={canManage} /> : tab === 'companies' ? <CompaniesTab canManage={canManage} /> : <CorporateTab canManage={canCorporate} />}
    </div>
  );
}

function CompaniesTab({ canManage }: { canManage: boolean }) {
  const qc = useQueryClient();
  const [f, setF] = useState({ name: '', industry: '', contactName: '', contactEmail: '' });
  const { data: companies = [], isLoading } = useQuery({ queryKey: ['placement-companies'], queryFn: async () => (await api.get<Company[]>('/placements/companies')).data });
  const create = useMutation({
    mutationFn: async () => (await api.post('/placements/companies', { name: f.name, industry: f.industry || undefined, contactName: f.contactName || undefined, contactEmail: f.contactEmail || undefined })).data,
    onSuccess: () => { toast.success('Company added'); setF({ name: '', industry: '', contactName: '', contactEmail: '' }); qc.invalidateQueries({ queryKey: ['placement-companies'] }); qc.invalidateQueries({ queryKey: ['placement-overview'] }); },
    onError: (e) => toast.error(apiErrorMessage(e)),
  });
  const remove = useMutation({ mutationFn: async (id: string) => (await api.delete(`/placements/companies/${id}`)).data, onSuccess: () => { toast.success('Removed'); qc.invalidateQueries({ queryKey: ['placement-companies'] }); qc.invalidateQueries({ queryKey: ['placement-overview'] }); }, onError: (e) => toast.error(apiErrorMessage(e)) });

  return (
    <div style={{ display: 'grid', gridTemplateColumns: '340px 1fr', gap: 18, alignItems: 'start' }}>
      {canManage && (
        <div style={{ ...card, padding: 20 }}>
          <div style={{ fontWeight: 700, fontSize: 16, marginBottom: 14 }}>Add company</div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            <input placeholder="Company name" value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} style={inp} />
            <input placeholder="Industry" value={f.industry} onChange={(e) => setF({ ...f, industry: e.target.value })} style={inp} />
            <input placeholder="Contact person" value={f.contactName} onChange={(e) => setF({ ...f, contactName: e.target.value })} style={inp} />
            <input placeholder="Contact email" value={f.contactEmail} onChange={(e) => setF({ ...f, contactEmail: e.target.value })} style={inp} />
            <button style={{ ...primaryBtn, opacity: !f.name || create.isPending ? 0.6 : 1 }} disabled={!f.name || create.isPending} onClick={() => create.mutate()}><Plus size={15} /> Add company</button>
          </div>
        </div>
      )}
      <div style={{ ...card, overflow: 'hidden' }}>
        {isLoading ? <Empty text="Loading…" />
          : companies.length === 0 ? <Empty text="No companies yet." />
          : companies.map((c, i) => (
            <div key={c.id} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '13px 16px', borderTop: i ? `1px solid ${T.border}` : undefined }}>
              <span style={{ width: 38, height: 38, borderRadius: 10, background: T.brandSubtle, color: T.brandText, display: 'grid', placeItems: 'center', fontWeight: 800, fontSize: 14 }}>{c.name.slice(0, 1)}</span>
              <div style={{ flex: 1 }}><div style={{ fontWeight: 600, fontSize: 14 }}>{c.name}</div><div style={{ fontSize: 12, color: T.ink3 }}>{[c.industry, c.contactEmail].filter(Boolean).join(' · ') || '—'}</div></div>
              <span style={{ fontSize: 12, color: T.ink3 }}>{c._count?.jobs ?? 0} roles</span>
              {canManage && <button style={{ ...outlineBtn, height: 32, width: 34, padding: 0, justifyContent: 'center', color: T.danger }} onClick={() => remove.mutate(c.id)}><Trash2 size={14} /></button>}
            </div>
          ))}
      </div>
    </div>
  );
}

function JobsTab({ canManage }: { canManage: boolean }) {
  const qc = useQueryClient();
  const [f, setF] = useState({ companyId: '', title: '', type: 'FULL_TIME' as JobType, ctcInr: '', location: '', eligibility: '', seats: '1', deadline: '' });
  const [open, setOpen] = useState<string | null>(null);
  const { data: jobs = [], isLoading } = useQuery({ queryKey: ['placement-jobs'], queryFn: async () => (await api.get<Job[]>('/placements/jobs')).data });
  const { data: companies = [] } = useQuery({ queryKey: ['placement-companies'], queryFn: async () => (await api.get<Company[]>('/placements/companies')).data });

  const create = useMutation({
    mutationFn: async () => (await api.post('/placements/jobs', { companyId: f.companyId, title: f.title, type: f.type, ctcInr: f.ctcInr ? Number(f.ctcInr) : undefined, location: f.location || undefined, eligibility: f.eligibility || undefined, seats: Number(f.seats) || 1, deadline: f.deadline || undefined })).data,
    onSuccess: () => { toast.success('Opening posted'); setF({ ...f, title: '', ctcInr: '', location: '', eligibility: '', deadline: '' }); qc.invalidateQueries({ queryKey: ['placement-jobs'] }); qc.invalidateQueries({ queryKey: ['placement-overview'] }); },
    onError: (e) => toast.error(apiErrorMessage(e)),
  });
  const toggle = useMutation({ mutationFn: async (j: Job) => (await api.patch(`/placements/jobs/${j.id}/status`, { status: j.status === 'OPEN' ? 'CLOSED' : 'OPEN' })).data, onSuccess: () => { qc.invalidateQueries({ queryKey: ['placement-jobs'] }); qc.invalidateQueries({ queryKey: ['placement-overview'] }); }, onError: (e) => toast.error(apiErrorMessage(e)) });
  const remove = useMutation({ mutationFn: async (id: string) => (await api.delete(`/placements/jobs/${id}`)).data, onSuccess: () => { toast.success('Removed'); qc.invalidateQueries({ queryKey: ['placement-jobs'] }); qc.invalidateQueries({ queryKey: ['placement-overview'] }); }, onError: (e) => toast.error(apiErrorMessage(e)) });

  const lbl: React.CSSProperties = { fontSize: 11.5, color: T.ink3, fontWeight: 600 };

  return (
    <div style={{ display: 'grid', gridTemplateColumns: '340px 1fr', gap: 18, alignItems: 'start' }}>
      {canManage && (
        <div style={{ ...card, padding: 20 }}>
          <div style={{ fontWeight: 700, fontSize: 16, marginBottom: 14 }}>Post an opening</div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            <select value={f.companyId} onChange={(e) => setF({ ...f, companyId: e.target.value })} style={{ ...inp, cursor: 'pointer', color: f.companyId ? T.ink : T.ink3 }}>
              <option value="">Select company…</option>
              {companies.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
            <input placeholder="Role title" value={f.title} onChange={(e) => setF({ ...f, title: e.target.value })} style={inp} />
            <select value={f.type} onChange={(e) => setF({ ...f, type: e.target.value as JobType })} style={{ ...inp, cursor: 'pointer' }}>
              {(Object.keys(JOB_TYPE_LABEL) as JobType[]).map((t) => <option key={t} value={t}>{JOB_TYPE_LABEL[t]}</option>)}
            </select>
            <div style={{ display: 'flex', gap: 8 }}>
              <input placeholder="CTC / yr (₹)" value={f.ctcInr} onChange={(e) => setF({ ...f, ctcInr: e.target.value })} style={{ ...inp, flex: 1 }} />
              <input placeholder="1" title="Positions" value={f.seats} onChange={(e) => setF({ ...f, seats: e.target.value })} style={{ ...inp, width: 72 }} />
            </div>
            <input placeholder="Location" value={f.location} onChange={(e) => setF({ ...f, location: e.target.value })} style={inp} />
            <input placeholder="Eligibility" value={f.eligibility} onChange={(e) => setF({ ...f, eligibility: e.target.value })} style={inp} />
            <label style={{ display: 'flex', flexDirection: 'column', gap: 5 }}><span style={lbl}>Deadline</span>
              <input type="date" value={f.deadline} onChange={(e) => setF({ ...f, deadline: e.target.value })} style={inp} />
            </label>
            <button style={{ ...primaryBtn, opacity: !f.companyId || !f.title || create.isPending ? 0.6 : 1 }} disabled={!f.companyId || !f.title || create.isPending} onClick={() => create.mutate()}><Plus size={15} /> Post opening</button>
          </div>
        </div>
      )}

      <div style={{ display: 'grid', gap: 16, minWidth: 0 }}>
        <div style={{ ...card, overflow: 'hidden' }}>
          {isLoading ? <Empty text="Loading…" />
            : jobs.length === 0 ? <Empty text="No openings yet. Post one on the left." />
            : jobs.map((j, i) => (
              <div key={j.id} style={{ borderTop: i ? `1px solid ${T.border}` : undefined }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '13px 16px' }}>
                  <button onClick={() => setOpen(open === j.id ? null : j.id)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: T.ink3, display: 'flex' }}>{open === j.id ? <ChevronDown size={16} /> : <ChevronRight size={16} />}</button>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontWeight: 600, fontSize: 14 }}>{j.title} <span style={{ color: T.ink3, fontWeight: 400, fontSize: 12.5 }}>· {j.companyName}</span></div>
                    <div style={{ fontSize: 12, color: T.ink3, display: 'flex', gap: 12, flexWrap: 'wrap', marginTop: 2 }}>
                      <span>{JOB_TYPE_LABEL[j.type]}</span>
                      {j.location && <span style={{ display: 'inline-flex', alignItems: 'center', gap: 3 }}><MapPin size={11} /> {j.location}</span>}
                      {j.ctcInr ? <span style={{ display: 'inline-flex', alignItems: 'center', gap: 2 }}><IndianRupee size={11} /> {ctcLabel(j.ctcInr)}</span> : null}
                    </div>
                  </div>
                  <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, fontSize: 12, color: T.ink3 }}><Users size={13} /> {j._count?.applications ?? 0}</span>
                  <span style={{ fontSize: 11, fontWeight: 700, padding: '3px 9px', borderRadius: 999, background: j.status === 'OPEN' ? T.successBg : '#f2f2f2', color: j.status === 'OPEN' ? T.success : T.ink3 }}>{j.status === 'OPEN' ? 'Open' : 'Closed'}</span>
                  {canManage && <button style={{ ...outlineBtn, height: 30 }} onClick={() => toggle.mutate(j)}>{j.status === 'OPEN' ? 'Close' : 'Reopen'}</button>}
                  {canManage && <button style={{ ...outlineBtn, height: 30, width: 34, padding: 0, justifyContent: 'center', color: T.danger }} onClick={() => remove.mutate(j.id)}><Trash2 size={14} /></button>}
                </div>
                {open === j.id && <Applicants jobId={j.id} />}
              </div>
            ))}
        </div>

        <UpcomingDrives canManage={canManage} companies={companies} />
      </div>
    </div>
  );
}

function UpcomingDrives({ canManage, companies }: { canManage: boolean; companies: Company[] }) {
  const qc = useQueryClient();
  const [all, setAll] = useState(false);
  const [showNew, setShowNew] = useState(false);
  const { data: drives = [], isLoading } = useQuery({
    queryKey: ['placement-drives', all],
    queryFn: async () => (await api.get<Drive[]>('/placements/drives', { params: all ? {} : { upcoming: '1', take: '3' } })).data,
  });
  const th: React.CSSProperties = { textAlign: 'left', fontSize: 10.5, letterSpacing: '.06em', fontWeight: 700, color: T.ink3, padding: '8px 10px' };
  const td: React.CSSProperties = { padding: '11px 10px', fontSize: 13, borderTop: `1px solid ${T.border}` };

  return (
    <div style={{ ...card, padding: 18 }}>
      <div style={{ display: 'flex', alignItems: 'flex-start', gap: 10, marginBottom: 10 }}>
        <span style={{ width: 30, height: 30, borderRadius: 8, background: T.brandSubtle, color: T.brandText, display: 'grid', placeItems: 'center', flexShrink: 0 }}><CalendarClock size={16} /></span>
        <div style={{ flex: 1 }}>
          <div style={{ fontSize: 15, fontWeight: 700 }}>{all ? 'All drives' : 'Upcoming drives'}</div>
          <div style={{ fontSize: 12, color: T.ink3 }}>{all ? 'Every scheduled campus drive' : 'Next three campus drives on the calendar'}</div>
        </div>
        {canManage && <button style={outlineBtn} onClick={() => setShowNew(true)}><Plus size={13} /> Schedule</button>}
      </div>

      {isLoading ? <div style={{ fontSize: 12.5, color: T.ink3, padding: '10px 0' }}>Loading…</div>
        : drives.length === 0 ? <div style={{ fontSize: 12.5, color: T.ink3, padding: '10px 0' }}>No drives on the calendar yet.</div>
        : (
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: 380 }}>
              <thead><tr><th style={th}>LANE</th><th style={th}>STATUS</th><th style={th}>OWNER</th>{all && <th style={th}>DATE</th>}{canManage && <th style={th}></th>}</tr></thead>
              <tbody>
                {drives.map((d) => {
                  const tone = DRIVE_TONE[d.status];
                  return (
                    <tr key={d.id}>
                      <td style={{ ...td, fontWeight: 600, color: T.ink }}>{d.lane}{d.company && <span style={{ display: 'block', fontSize: 11, color: T.ink3, fontWeight: 400 }}>{d.company}</span>}</td>
                      <td style={td}><span style={{ fontSize: 11, fontWeight: 700, padding: '3px 9px', borderRadius: 999, background: tone.bg, color: tone.fg }}>{DRIVE_STATUS_LABEL[d.status]}</span></td>
                      <td style={{ ...td, color: T.ink2 }}>{d.owner ?? '—'}</td>
                      {all && <td style={{ ...td, color: T.ink3 }}>{new Date(d.scheduledAt).toLocaleDateString([], { day: 'numeric', month: 'short' })}</td>}
                      {canManage && <td style={td}><DriveActions drive={d} onChanged={() => qc.invalidateQueries({ queryKey: ['placement-drives'] })} /></td>}
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}

      <button onClick={() => setAll((v) => !v)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: T.brandText, fontSize: 12.5, fontWeight: 600, padding: '10px 0 0', display: 'inline-flex', alignItems: 'center', gap: 4 }}>
        {all ? 'Show upcoming only' : 'View full drive calendar'} <ChevronRight size={14} />
      </button>

      {showNew && <ScheduleDriveModal companies={companies} onClose={() => setShowNew(false)} onDone={() => { setShowNew(false); qc.invalidateQueries({ queryKey: ['placement-drives'] }); }} />}
    </div>
  );
}

function DriveActions({ drive, onChanged }: { drive: Drive; onChanged: () => void }) {
  const setStatus = useMutation({ mutationFn: async (status: DriveStatus) => (await api.patch(`/placements/drives/${drive.id}/status`, { status })).data, onSuccess: onChanged, onError: (e) => toast.error(apiErrorMessage(e)) });
  const remove = useMutation({ mutationFn: async () => (await api.delete(`/placements/drives/${drive.id}`)).data, onSuccess: () => { toast.success('Drive removed'); onChanged(); }, onError: (e) => toast.error(apiErrorMessage(e)) });
  return (
    <div style={{ display: 'flex', gap: 4, alignItems: 'center' }}>
      <select value={drive.status} onChange={(e) => setStatus.mutate(e.target.value as DriveStatus)} style={{ ...inp, height: 28, padding: '2px 6px', fontSize: 11.5, width: 'auto' }}>
        {(Object.keys(DRIVE_STATUS_LABEL) as DriveStatus[]).map((s) => <option key={s} value={s}>{DRIVE_STATUS_LABEL[s]}</option>)}
      </select>
      <button style={{ ...outlineBtn, height: 28, width: 30, padding: 0, justifyContent: 'center', color: T.danger }} onClick={() => remove.mutate()}><Trash2 size={13} /></button>
    </div>
  );
}

function ScheduleDriveModal({ companies, onClose, onDone }: { companies: Company[]; onClose: () => void; onDone: () => void }) {
  const [f, setF] = useState({ lane: '', owner: '', companyId: '', status: 'SCHEDULED' as DriveStatus, scheduledAt: '' });
  const create = useMutation({
    mutationFn: async () => (await api.post('/placements/drives', { lane: f.lane, owner: f.owner || undefined, companyId: f.companyId || undefined, status: f.status, scheduledAt: f.scheduledAt })).data,
    onSuccess: () => { toast.success('Drive scheduled'); onDone(); },
    onError: (e) => toast.error(apiErrorMessage(e)),
  });
  const lbl: React.CSSProperties = { display: 'block', fontSize: 12.5, fontWeight: 600, color: T.ink2, marginBottom: 6 };
  return (
    <div onClick={onClose} style={{ position: 'fixed', inset: 0, background: 'rgba(17,34,49,.34)', display: 'grid', placeItems: 'center', zIndex: 60, padding: 20 }}>
      <div onClick={(e) => e.stopPropagation()} style={{ ...card, width: 440, maxWidth: '100%', boxShadow: T.shadow, padding: 22 }}>
        <div style={{ display: 'flex', alignItems: 'center', marginBottom: 16 }}>
          <h2 style={{ fontSize: 18, fontWeight: 700, margin: 0, flex: 1 }}>Schedule a drive</h2>
          <button style={{ ...outlineBtn, height: 34, width: 34, padding: 0, justifyContent: 'center' }} onClick={onClose}><X size={15} /></button>
        </div>
        <div style={{ display: 'grid', gap: 14 }}>
          <label><span style={lbl}>Lane / track</span><input style={inp} value={f.lane} onChange={(e) => setF({ ...f, lane: e.target.value })} placeholder="e.g. Core engineering" autoFocus /></label>
          <label><span style={lbl}>Company</span>
            <select style={{ ...inp, cursor: 'pointer' }} value={f.companyId} onChange={(e) => setF({ ...f, companyId: e.target.value })}>
              <option value="">Not set</option>{companies.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
          </label>
          <label><span style={lbl}>Owner (coordinator)</span><input style={inp} value={f.owner} onChange={(e) => setF({ ...f, owner: e.target.value })} placeholder="e.g. K. Rao" /></label>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <label><span style={lbl}>Status</span>
              <select style={{ ...inp, cursor: 'pointer' }} value={f.status} onChange={(e) => setF({ ...f, status: e.target.value as DriveStatus })}>
                {(Object.keys(DRIVE_STATUS_LABEL) as DriveStatus[]).map((s) => <option key={s} value={s}>{DRIVE_STATUS_LABEL[s]}</option>)}
              </select>
            </label>
            <label><span style={lbl}>Date</span><input type="date" style={inp} value={f.scheduledAt} onChange={(e) => setF({ ...f, scheduledAt: e.target.value })} /></label>
          </div>
        </div>
        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10, marginTop: 20 }}>
          <button style={outlineBtn} onClick={onClose}>Cancel</button>
          <button style={{ ...primaryBtn, height: 36, opacity: !f.lane.trim() || !f.scheduledAt || create.isPending ? 0.6 : 1 }} disabled={!f.lane.trim() || !f.scheduledAt || create.isPending} onClick={() => create.mutate()}>{create.isPending ? 'Scheduling…' : 'Schedule drive'}</button>
        </div>
      </div>
    </div>
  );
}

function Applicants({ jobId }: { jobId: string }) {
  const qc = useQueryClient();
  const { data, isLoading } = useQuery({ queryKey: ['job-applicants', jobId], queryFn: async () => (await api.get<{ applicants: Applicant[] }>(`/placements/jobs/${jobId}/applicants`)).data });
  const setStatus = useMutation({
    mutationFn: async ({ id, status }: { id: string; status: AppStatus }) => (await api.patch(`/placements/applications/${id}`, { status })).data,
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['job-applicants', jobId] }); qc.invalidateQueries({ queryKey: ['placement-overview'] }); },
    onError: (e) => toast.error(apiErrorMessage(e)),
  });
  const applicants = data?.applicants ?? [];
  return (
    <div style={{ background: T.bg, padding: '6px 16px 16px 42px' }}>
      <div style={{ fontSize: 11, letterSpacing: '.06em', textTransform: 'uppercase', color: T.ink3, fontWeight: 700, margin: '10px 0 6px' }}>Applicants ({applicants.length})</div>
      {isLoading ? <div style={{ fontSize: 12.5, color: T.ink3 }}>Loading…</div>
        : applicants.length === 0 ? <div style={{ fontSize: 12.5, color: T.ink3 }}>No applications yet.</div>
        : applicants.map((a) => (
          <div key={a.id} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '7px 0' }}>
            <div style={{ flex: 1 }}><div style={{ fontWeight: 600, fontSize: 13 }}>{a.student.firstName} {a.student.lastName ?? ''} <span style={{ color: T.ink3, fontWeight: 400, fontSize: 11.5 }}>{a.student.admissionNo}</span></div>{a.note && <div style={{ fontSize: 11.5, color: T.ink3 }}>“{a.note}”</div>}</div>
            <span style={{ fontSize: 11, fontWeight: 700, padding: '3px 9px', borderRadius: 999, background: APP_META[a.status].bg, color: APP_META[a.status].fg }}>{APP_META[a.status].label}</span>
            <select value={a.status} onChange={(e) => setStatus.mutate({ id: a.id, status: e.target.value as AppStatus })} style={{ ...inp, height: 30, padding: '4px 8px', fontSize: 12, width: 'auto' }}>
              {APP_STAGES.map((s) => <option key={s} value={s}>{APP_META[s].label}</option>)}
            </select>
          </div>
        ))}
    </div>
  );
}

function Empty({ text }: { text: string }) { return <div style={{ padding: 40, textAlign: 'center', color: T.ink3, fontSize: 13.5 }}>{text}</div>; }
