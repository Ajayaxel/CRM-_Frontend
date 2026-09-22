'use client';

import { useEffect, useState } from 'react';
import { HardHat, Wrench, CalendarClock, AlertTriangle, Star, Phone, Mail, CheckCircle2, PlayCircle, PauseCircle, MessageSquarePlus } from 'lucide-react';

const card: React.CSSProperties = { background: 'var(--surface)', border: '1px solid var(--line-soft)', borderRadius: 16 };

const CAT_ICON: Record<string, string> = {
  PLUMBING: '🚰', ELECTRICAL: '💡', HVAC: '❄️', APPLIANCE: '🔌', STRUCTURAL: '🧱',
  PEST: '🐜', CLEANING: '🧽', SECURITY: '🔒', INTERNET: '📶', OTHER: '🔧',
};
const C_STATUS: Record<string, { label: string; bg: string; fg: string }> = {
  OPEN: { label: 'Open', bg: 'var(--gold-bg,#fdf2e2)', fg: 'var(--gold,#c67c1e)' },
  ASSIGNED: { label: 'Assigned', bg: 'color-mix(in srgb, var(--brand,#132376) 12%, var(--surface))', fg: 'var(--brand,#132376)' },
  IN_PROGRESS: { label: 'In progress', bg: 'color-mix(in srgb, var(--brand,#132376) 12%, var(--surface))', fg: 'var(--brand,#132376)' },
  ON_HOLD: { label: 'On hold', bg: 'var(--surface-2)', fg: 'var(--ink-2)' },
  RESOLVED: { label: 'Resolved', bg: 'var(--success-bg,#e6f4ea)', fg: 'var(--success,#1e874b)' },
  CLOSED: { label: 'Closed', bg: 'var(--success-bg,#e6f4ea)', fg: 'var(--success,#1e874b)' },
  CANCELLED: { label: 'Cancelled', bg: 'var(--surface-2)', fg: 'var(--ink-3)' },
};
const PRIO: Record<string, { label: string; bg: string; fg: string }> = {
  EMERGENCY: { label: 'Emergency', bg: 'var(--danger-bg,#fce8e8)', fg: 'var(--danger,#c0392b)' },
  HIGH: { label: 'High', bg: 'var(--danger-bg,#fce8e8)', fg: 'var(--danger,#c0392b)' },
  MEDIUM: { label: 'Medium', bg: 'var(--gold-bg,#fdf2e2)', fg: 'var(--gold,#c67c1e)' },
  LOW: { label: 'Low', bg: 'var(--surface-2)', fg: 'var(--ink-2)' },
};
const J_STATUS: Record<string, { label: string; bg: string; fg: string }> = {
  SCHEDULED: { label: 'Scheduled', bg: 'var(--gold-bg,#fdf2e2)', fg: 'var(--gold,#c67c1e)' },
  IN_PROGRESS: { label: 'In progress', bg: 'color-mix(in srgb, var(--brand,#132376) 12%, var(--surface))', fg: 'var(--brand,#132376)' },
  DONE: { label: 'Done', bg: 'var(--success-bg,#e6f4ea)', fg: 'var(--success,#1e874b)' },
  CANCELLED: { label: 'Cancelled', bg: 'var(--surface-2)', fg: 'var(--ink-3)' },
};
const fmtDate = (s?: string | null) => s ? new Date(s).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' }) : '—';

interface Ticket {
  id: string; ticketNo: string; title: string; description: string; category: string; priority: string; status: string;
  tenantName: string; tenantPhone?: string | null; dueAt?: string | null; createdAt: string; overdue?: boolean;
  property?: { reference: string; title: string; area?: string; city?: string } | null;
}
interface Job {
  id: string; title: string; description?: string | null; category: string; type: string; status: string;
  scheduledFor: string; completedAt?: string | null; costInr?: number | null; overdue?: boolean;
  property?: { reference: string; title: string } | null;
}
interface PortalData {
  vendor: { id: string; name: string; trade: string; phone?: string | null; email?: string | null; rating: number; active: boolean; agency?: { name?: string } | null };
  summary: { openComplaints: number; openJobs: number; total: number };
  complaints: Ticket[];
  jobs: Job[];
}

/** The link's key rides in the URL fragment and reaches the API only as a header. */
function linkHeaders(): Record<string, string> {
  if (typeof window === 'undefined') return {};
  const k = new URLSearchParams(window.location.hash.slice(1)).get('k');
  return k ? { 'x-bmn-capability': k } : {};
}

export function VendorPortal({ vendorId }: { vendorId: string }) {
  const [data, setData] = useState<PortalData | null>(null);
  const [err, setErr] = useState(false);
  const [tab, setTab] = useState<'complaints' | 'jobs'>('complaints');
  const load = () => fetch(`/api/vendor-portal/${vendorId}`, { headers: linkHeaders() }).then((r) => { if (!r.ok) throw new Error(); return r.json(); }).then(setData).catch(() => setErr(true));
  useEffect(() => { load(); }, [vendorId]);

  if (err) return <Shell><div style={{ ...card, padding: 60, textAlign: 'center', color: 'var(--ink-3)' }}>This vendor link isn’t valid or has expired. Ask the agency for a new one.</div></Shell>;
  if (!data) return <Shell><div style={{ ...card, padding: 60, textAlign: 'center', color: 'var(--ink-3)' }}>Loading…</div></Shell>;

  const { vendor, summary, complaints, jobs } = data;
  return (
    <Shell agency={vendor.agency?.name}>
      {/* Vendor header */}
      <div style={{ ...card, padding: 20, marginBottom: 16 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <span style={{ width: 46, height: 46, borderRadius: 12, background: 'var(--brand,#132376)', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}><HardHat size={22} /></span>
          <div style={{ flex: 1, minWidth: 0 }}>
            <h1 style={{ fontSize: 20, fontWeight: 700, margin: 0 }}>{vendor.name}</h1>
            <div style={{ fontSize: 13, color: 'var(--ink-3)' }}>{vendor.trade}{vendor.rating > 0 ? <> · <Star size={11} style={{ fill: 'var(--gold,#E6A23C)', color: 'var(--gold,#E6A23C)', verticalAlign: -1 }} /> {vendor.rating.toFixed(1)}</> : ''}</div>
          </div>
        </div>
        <div style={{ display: 'flex', gap: 14, marginTop: 12, flexWrap: 'wrap', fontSize: 12.5, color: 'var(--ink-2)' }}>
          {vendor.phone && <span style={{ display: 'flex', alignItems: 'center', gap: 5 }}><Phone size={13} /> {vendor.phone}</span>}
          {vendor.email && <span style={{ display: 'flex', alignItems: 'center', gap: 5 }}><Mail size={13} /> {vendor.email}</span>}
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2,1fr)', gap: 8, marginTop: 14 }}>
          <Mini label="Open tickets" value={summary.openComplaints} />
          <Mini label="Open jobs" value={summary.openJobs} />
        </div>
      </div>

      {/* Tabs */}
      <div style={{ display: 'inline-flex', background: 'var(--surface-2)', borderRadius: 10, padding: 3, marginBottom: 14 }}>
        {([['complaints', `Tickets (${complaints.length})`], ['jobs', `Scheduled jobs (${jobs.length})`]] as const).map(([k, lbl]) => (
          <button key={k} onClick={() => setTab(k)} style={{ border: 'none', cursor: 'pointer', borderRadius: 8, padding: '7px 16px', fontSize: 13, fontWeight: 600, background: tab === k ? 'var(--surface)' : 'transparent', color: tab === k ? 'var(--ink-1)' : 'var(--ink-3)' }}>{lbl}</button>
        ))}
      </div>

      {tab === 'complaints' ? (
        complaints.length === 0
          ? <div style={{ ...card, padding: 40, textAlign: 'center', color: 'var(--ink-3)' }}><Wrench size={28} style={{ opacity: 0.4 }} /><div style={{ marginTop: 8, fontSize: 13 }}>No tickets assigned to you.</div></div>
          : <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>{complaints.map((t) => <TicketCard key={t.id} vendorId={vendorId} t={t} onDone={load} />)}</div>
      ) : (
        jobs.length === 0
          ? <div style={{ ...card, padding: 40, textAlign: 'center', color: 'var(--ink-3)' }}><CalendarClock size={28} style={{ opacity: 0.4 }} /><div style={{ marginTop: 8, fontSize: 13 }}>No scheduled jobs.</div></div>
          : <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>{jobs.map((j) => <JobCard key={j.id} vendorId={vendorId} j={j} onDone={load} />)}</div>
      )}
    </Shell>
  );
}

function Shell({ children, agency }: { children: React.ReactNode; agency?: string }) {
  return (
    <div style={{ minHeight: '100vh', background: 'var(--surface-2)' }}>
      <div style={{ maxWidth: 720, margin: '0 auto', padding: '28px 20px 64px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 18 }}>
          <span style={{ width: 34, height: 34, borderRadius: 9, background: 'var(--brand,#132376)', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center' }}><HardHat size={17} /></span>
          <div><div style={{ fontWeight: 700, fontSize: 15 }}>{agency ?? 'Vendor Portal'}</div><div style={{ fontSize: 11.5, color: 'var(--ink-3)' }}>Vendor / technician portal</div></div>
        </div>
        {children}
      </div>
    </div>
  );
}
function Mini({ label, value }: { label: string; value: number | string }) {
  return <div style={{ background: 'var(--surface-2)', borderRadius: 10, padding: '9px 11px' }}><div style={{ fontSize: 20, fontWeight: 800 }}>{value}</div><div style={{ fontSize: 11, color: 'var(--ink-3)' }}>{label}</div></div>;
}

function TicketCard({ vendorId, t, onDone }: { vendorId: string; t: Ticket; onDone: () => void }) {
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState('');
  const st = C_STATUS[t.status] ?? C_STATUS.OPEN; const pr = PRIO[t.priority] ?? PRIO.MEDIUM;
  const closed = ['RESOLVED', 'CLOSED', 'CANCELLED'].includes(t.status);
  // The server decides whether an update landed. A refused one (expired link,
  // invalid status) used to clear the note and reload as if it had been saved.
  const [error, setError] = useState<string | null>(null);
  const act = async (path: string, body: any) => {
    setBusy(true); setError(null);
    try {
      const r = await fetch(`/api/vendor-portal/${vendorId}/complaints/${t.id}/${path}`, { method: 'POST', headers: { 'Content-Type': 'application/json', ...linkHeaders() }, body: JSON.stringify(body) });
      if (!r.ok) { setError((await r.json().catch(() => null))?.message ?? 'That update was not saved. Try again.'); return; }
      setNote(''); onDone();
    } catch { setError('That update could not be sent. Check your connection and try again.'); } finally { setBusy(false); }
  };
  return (
    <div style={{ ...card, padding: 16 }}>
      {error && <div role="alert" style={{ marginBottom: 10, fontSize: 12.5, color: 'var(--danger,#c0392b)' }}>{error}</div>}
      <div style={{ display: 'flex', gap: 12 }}>
        <div style={{ width: 40, height: 40, borderRadius: 11, background: 'var(--surface-2)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 19, flexShrink: 0 }}>{CAT_ICON[t.category] ?? '🔧'}</div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 7, flexWrap: 'wrap' }}>
            <span style={{ fontWeight: 700, fontSize: 14.5 }}>{t.title}</span>
            <span className="badge" style={{ background: st.bg, color: st.fg }}>{st.label}</span>
            <span className="badge" style={{ background: pr.bg, color: pr.fg }}>{pr.label}</span>
            {t.overdue && <span className="badge" style={{ background: 'var(--danger-bg,#fce8e8)', color: 'var(--danger,#c0392b)' }}><AlertTriangle size={11} style={{ marginRight: 3 }} />Overdue</span>}
          </div>
          <div style={{ fontSize: 12, color: 'var(--ink-3)', marginTop: 4 }}>{t.ticketNo} · {t.tenantName}{t.tenantPhone ? ` · ${t.tenantPhone}` : ''}{t.property ? ` · ${t.property.title}` : ''}</div>
          <div style={{ fontSize: 13, color: 'var(--ink-2)', marginTop: 8 }}>{t.description}</div>
        </div>
      </div>
      {!closed && (
        <div style={{ marginTop: 12, display: 'flex', flexDirection: 'column', gap: 8 }}>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            {t.status !== 'IN_PROGRESS' && <button className="btn-secondary" style={{ height: 34, fontSize: 12.5 }} disabled={busy} onClick={() => act('status', { status: 'IN_PROGRESS' })}><PlayCircle size={14} /> Start work</button>}
            <button className="btn-secondary" style={{ height: 34, fontSize: 12.5 }} disabled={busy} onClick={() => act('status', { status: 'ON_HOLD' })}><PauseCircle size={14} /> On hold</button>
            <button className="btn-primary" style={{ height: 34, fontSize: 12.5 }} disabled={busy} onClick={() => act('status', { status: 'RESOLVED', note: note || undefined })}><CheckCircle2 size={14} /> Mark resolved</button>
          </div>
          <div style={{ display: 'flex', gap: 8 }}>
            <input className="input" style={{ flex: 1, height: 36 }} placeholder="Add an update for the office…" value={note} onChange={(e) => setNote(e.target.value)} />
            <button className="btn-secondary" style={{ height: 36 }} disabled={!note || busy} onClick={() => act('note', { message: note })}><MessageSquarePlus size={14} /></button>
          </div>
        </div>
      )}
    </div>
  );
}

function JobCard({ vendorId, j, onDone }: { vendorId: string; j: Job; onDone: () => void }) {
  const [busy, setBusy] = useState(false);
  const st = J_STATUS[j.status] ?? J_STATUS.SCHEDULED;
  const done = j.status === 'DONE' || j.status === 'CANCELLED';
  const [error, setError] = useState<string | null>(null);
  const act = async (status: string) => {
    setBusy(true); setError(null);
    try {
      const r = await fetch(`/api/vendor-portal/${vendorId}/jobs/${j.id}/status`, { method: 'POST', headers: { 'Content-Type': 'application/json', ...linkHeaders() }, body: JSON.stringify({ status }) });
      if (!r.ok) { setError((await r.json().catch(() => null))?.message ?? 'That update was not saved. Try again.'); return; }
      onDone();
    } catch { setError('That update could not be sent. Check your connection and try again.'); } finally { setBusy(false); }
  };
  return (
    <div style={{ ...card, padding: 16 }}>
      {error && <div role="alert" style={{ marginBottom: 10, fontSize: 12.5, color: 'var(--danger,#c0392b)' }}>{error}</div>}
      <div style={{ display: 'flex', gap: 12 }}>
        <div style={{ width: 40, height: 40, borderRadius: 11, background: 'var(--surface-2)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 19, flexShrink: 0 }}>{CAT_ICON[j.category] ?? '🔧'}</div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 7, flexWrap: 'wrap' }}>
            <span style={{ fontWeight: 700, fontSize: 14.5 }}>{j.title}</span>
            <span className="badge" style={{ background: st.bg, color: st.fg }}>{st.label}</span>
            <span className="badge" style={{ background: 'var(--surface-2)', color: 'var(--ink-3)' }}>{j.type === 'PREVENTIVE' ? 'Preventive' : 'Corrective'}</span>
            {j.overdue && <span className="badge" style={{ background: 'var(--danger-bg,#fce8e8)', color: 'var(--danger,#c0392b)' }}>Overdue</span>}
          </div>
          <div style={{ fontSize: 12, color: 'var(--ink-3)', marginTop: 4 }}><CalendarClock size={12} style={{ verticalAlign: -2 }} /> {fmtDate(j.scheduledFor)}{j.property ? ` · ${j.property.title}` : ''}</div>
          {j.description && <div style={{ fontSize: 13, color: 'var(--ink-2)', marginTop: 8 }}>{j.description}</div>}
        </div>
      </div>
      {!done && (
        <div style={{ marginTop: 12, display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          {j.status !== 'IN_PROGRESS' && <button className="btn-secondary" style={{ height: 34, fontSize: 12.5 }} disabled={busy} onClick={() => act('IN_PROGRESS')}><PlayCircle size={14} /> Start</button>}
          <button className="btn-primary" style={{ height: 34, fontSize: 12.5 }} disabled={busy} onClick={() => act('DONE')}><CheckCircle2 size={14} /> Mark done</button>
        </div>
      )}
    </div>
  );
}
