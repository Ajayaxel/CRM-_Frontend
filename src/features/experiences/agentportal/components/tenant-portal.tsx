'use client';

import { useEffect, useState } from 'react';
import { BadgeCheck, Clock, CreditCard, Home, Receipt, ShieldCheck, Wrench, X } from 'lucide-react';
import { OnboardingStatus, money } from '../agentportal-client';

const card: React.CSSProperties = { background: 'var(--surface)', border: '1px solid var(--line-soft)', borderRadius: 16 };
const ID_TYPES = ['Aadhaar', 'PAN', 'Passport', 'Driving Licence', 'Voter ID'];

interface RentInvoice { id: string; period: string; dueDate: string; amountInr: number; paidInr: number; status: string }
interface PortalState {
  id: string; tenantName: string; tenantEmail?: string; onboardingStatus: OnboardingStatus; status: string;
  rentInr: number; depositInr: number; startDate: string; endDate: string;
  property?: { reference: string; title: string; area?: string; city?: string } | null;
  agency?: { name?: string; phone?: string } | null;
  invoices?: RentInvoice[];
}

/**
 * The link's key lives in the URL FRAGMENT (#k=…). Browsers send a fragment to no
 * server and put it in no Referer, so it cannot land in an access log or leak to
 * another site; it reaches the API only as this header. The lease id in the path
 * opens nothing on its own.
 */
function linkHeaders(): Record<string, string> {
  if (typeof window === 'undefined') return {};
  const k = new URLSearchParams(window.location.hash.slice(1)).get('k');
  return k ? { 'x-bmn-capability': k } : {};
}

async function pget(path: string) { const r = await fetch(`/api/leases${path}`, { headers: linkHeaders() }); if (!r.ok) throw new Error(String(r.status)); return r.json(); }

export function TenantPortal({ leaseId }: { leaseId: string }) {
  const [state, setState] = useState<PortalState | null>(null);
  const [err, setErr] = useState(false);
  const load = () => pget(`/portal/${leaseId}`).then(setState).catch(() => setErr(true));
  useEffect(() => { load(); }, [leaseId]);

  if (err) return <Shell><div style={{ ...card, padding: 60, textAlign: 'center', color: 'var(--ink-3)' }}>This tenancy link isn't valid or has expired. Ask your agent for a new one.</div></Shell>;
  if (!state) return <Shell><div style={{ ...card, padding: 60, textAlign: 'center', color: 'var(--ink-3)' }}>Loading…</div></Shell>;

  return (
    <Shell agency={state.agency?.name}>
      <TenancyCard s={state} />
      {state.onboardingStatus === 'VERIFIED'
        ? <VerifiedPortal leaseId={leaseId} invoices={state.invoices ?? []} onPaid={load} />
        : state.onboardingStatus === 'SUBMITTED'
          ? <Awaiting />
          : <OnboardingForm s={state} onDone={load} />}
    </Shell>
  );
}

function Shell({ children, agency }: { children: React.ReactNode; agency?: string }) {
  return (
    <div style={{ minHeight: '100vh', background: 'var(--surface-2)' }}>
      <div style={{ maxWidth: 720, margin: '0 auto', padding: '28px 20px 64px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 18 }}>
          <span style={{ width: 34, height: 34, borderRadius: 9, background: 'var(--brand,#132376)', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center' }}><Home size={17} /></span>
          <div><div style={{ fontWeight: 700, fontSize: 15 }}>{agency ?? 'Tenant Portal'}</div><div style={{ fontSize: 11.5, color: 'var(--ink-3)' }}>Tenant portal</div></div>
        </div>
        {children}
      </div>
    </div>
  );
}

function TenancyCard({ s }: { s: PortalState }) {
  return (
    <div style={{ ...card, padding: 20, marginBottom: 16 }}>
      <div style={{ fontSize: 11, letterSpacing: '.1em', textTransform: 'uppercase', color: 'var(--ink-3)', fontWeight: 700 }}>Your tenancy</div>
      <h1 style={{ fontSize: 20, fontWeight: 700, margin: '4px 0 2px' }}>{s.property?.title ?? 'Property'}</h1>
      <div style={{ fontSize: 13, color: 'var(--ink-3)' }}>{[s.property?.area, s.property?.city].filter(Boolean).join(', ')} · {s.property?.reference}</div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 8, marginTop: 14 }}>
        <Mini label="Rent" value={`${money(s.rentInr)}/mo`} />
        <Mini label="Deposit" value={money(s.depositInr)} />
        <Mini label="Term" value={`${new Date(s.startDate).toLocaleDateString('en-IN', { month: 'short', year: '2-digit' })} – ${new Date(s.endDate).toLocaleDateString('en-IN', { month: 'short', year: '2-digit' })}`} />
      </div>
    </div>
  );
}
function Mini({ label, value }: { label: string; value: string }) {
  return <div style={{ background: 'var(--surface-2)', borderRadius: 10, padding: '9px 11px' }}><div style={{ fontSize: 10, letterSpacing: '.06em', textTransform: 'uppercase', color: 'var(--ink-3)', fontWeight: 700 }}>{label}</div><div style={{ fontSize: 13.5, fontWeight: 600, marginTop: 2 }}>{value}</div></div>;
}

function OnboardingForm({ s, onDone }: { s: PortalState; onDone: () => void }) {
  const [f, setF] = useState({ tenantName: s.tenantName || '', tenantEmail: s.tenantEmail || '', idType: 'Aadhaar', idNumber: '', docUrl: '' });
  const [busy, setBusy] = useState(false);
  const set = (k: string, v: string) => setF((x) => ({ ...x, [k]: v }));
  const [error, setError] = useState<string | null>(null);
  const submit = async () => {
    setBusy(true); setError(null);
    try {
      const r = await fetch(`/api/leases/portal/${s.id}/submit`, { method: 'POST', headers: { 'Content-Type': 'application/json', ...linkHeaders() }, body: JSON.stringify(f) });
      // The server decides whether it was accepted. A refusal must not read as "submitted".
      if (!r.ok) { setError((await r.json().catch(() => null))?.message ?? 'Your details could not be submitted. Please try again.'); return; }
      onDone();
    } catch { setError('Your details could not be submitted. Check your connection and try again.'); } finally { setBusy(false); }
  };
  return (
    <div style={{ ...card, padding: 22 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4, fontWeight: 700, fontSize: 16 }}><ShieldCheck size={18} style={{ color: 'var(--brand,#132376)' }} /> Complete your onboarding</div>
      <div style={{ fontSize: 13, color: 'var(--ink-3)', marginBottom: 16 }}>Confirm your details and submit an ID for verification. Your agent will review and activate the tenancy.</div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        <div style={{ display: 'flex', gap: 10 }}>
          <div style={{ flex: 1 }}><label className="label">Full name</label><input className="input" value={f.tenantName} onChange={(e) => set('tenantName', e.target.value)} /></div>
          <div style={{ flex: 1 }}><label className="label">Email</label><input className="input" value={f.tenantEmail} onChange={(e) => set('tenantEmail', e.target.value)} /></div>
        </div>
        <div style={{ display: 'flex', gap: 10 }}>
          <div style={{ width: 170 }}><label className="label">ID type</label><select className="input" value={f.idType} onChange={(e) => set('idType', e.target.value)}>{ID_TYPES.map((t) => <option key={t} value={t}>{t}</option>)}</select></div>
          <div style={{ flex: 1 }}><label className="label">ID number</label><input className="input" value={f.idNumber} onChange={(e) => set('idNumber', e.target.value)} placeholder="XXXX-XXXX-XXXX" /></div>
        </div>
        <div><label className="label">ID document link <span style={{ color: 'var(--ink-3)', fontWeight: 400 }}>(optional)</span></label><input className="input" value={f.docUrl} onChange={(e) => set('docUrl', e.target.value)} placeholder="https://… (scan / photo)" /></div>
      </div>
      {error && <div role="alert" style={{ marginTop: 12, fontSize: 13, color: 'var(--danger,#c0392b)' }}>{error}</div>}
      <button className="btn-primary" style={{ marginTop: 16, width: '100%', height: 42 }} disabled={!f.tenantName || !f.idNumber || busy} onClick={submit}>{busy ? 'Submitting…' : 'Submit for verification'}</button>
    </div>
  );
}

function Awaiting() {
  return (
    <div style={{ ...card, padding: 34, textAlign: 'center' }}>
      <span style={{ width: 52, height: 52, borderRadius: 99, background: 'var(--gold-bg,#fdf2e2)', color: 'var(--gold,#c67c1e)', display: 'inline-flex', alignItems: 'center', justifyContent: 'center' }}><Clock size={26} /></span>
      <div style={{ fontWeight: 700, fontSize: 17, marginTop: 12 }}>Thanks — you're all set!</div>
      <div style={{ fontSize: 13.5, color: 'var(--ink-3)', marginTop: 4, maxWidth: '46ch', marginInline: 'auto' }}>Your details are with the agent for verification. Once approved, your tenancy goes active and you can raise requests here.</div>
    </div>
  );
}

function VerifiedPortal({ leaseId, invoices, onPaid }: { leaseId: string; invoices: RentInvoice[]; onPaid: () => void }) {
  const [tickets, setTickets] = useState<any[]>([]);
  const [open, setOpen] = useState(false);
  const load = () => fetch(`/api/complaints/portal/${leaseId}`, { headers: linkHeaders() }).then((r) => r.ok ? r.json() : []).then((d) => setTickets(Array.isArray(d) ? d : d.data ?? [])).catch(() => {});
  useEffect(() => { load(); }, [leaseId]);
  return (
    <>
    <RentSection leaseId={leaseId} invoices={invoices} onPaid={onPaid} />
    <div style={{ ...card, padding: 22 }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontWeight: 700, fontSize: 16 }}><BadgeCheck size={18} style={{ color: 'var(--success)' }} /> Verified tenant</div>
        <button className="btn-primary" style={{ height: 34 }} onClick={() => setOpen(true)}><Wrench size={14} /> Raise a request</button>
      </div>
      <div style={{ fontSize: 13, color: 'var(--ink-3)', marginBottom: 14 }}>Report maintenance issues or complaints — your agent is notified instantly.</div>
      {tickets.length === 0 && <div style={{ fontSize: 13, color: 'var(--ink-3)' }}>No requests yet.</div>}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        {tickets.map((t) => (
          <div key={t.id} style={{ background: 'var(--surface-2)', borderRadius: 10, padding: '10px 12px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div><div style={{ fontWeight: 600, fontSize: 13 }}>{t.title}</div><div style={{ fontSize: 11.5, color: 'var(--ink-3)' }}>{t.category ?? ''}{t.reference ? ` · ${t.reference}` : ''}</div></div>
            <span className="badge" style={{ background: 'var(--surface)', color: 'var(--ink-2)' }}>{t.status}</span>
          </div>
        ))}
      </div>
      {open && <ComplaintModal leaseId={leaseId} onClose={() => setOpen(false)} onDone={() => { setOpen(false); load(); }} />}
    </div>
    </>
  );
}

const RINV_META: Record<string, { label: string; bg: string; fg: string }> = {
  PAID: { label: 'Paid', bg: 'var(--success-bg,#e6f4ea)', fg: 'var(--success,#1e874b)' },
  PARTIAL: { label: 'Part-paid', bg: 'var(--gold-bg,#fdf2e2)', fg: 'var(--gold,#c67c1e)' },
  OVERDUE: { label: 'Overdue', bg: 'var(--danger-bg,#fce8e8)', fg: 'var(--danger,#c0392b)' },
  DUE: { label: 'Due', bg: 'var(--surface)', fg: 'var(--ink-2)' },
};

function RentSection({ leaseId, invoices, onPaid }: { leaseId: string; invoices: RentInvoice[]; onPaid: () => void }) {
  const [payingId, setPayingId] = useState<string | null>(null);
  /**
   * What the SERVER said about the last payment attempt, per invoice. The button
   * used to POST, ignore the answer, and reload — so a refusal looked like a
   * page that had simply not updated yet. Paid is shown only from the reloaded
   * invoice status, never from this component's own belief.
   */
  const [outcome, setOutcome] = useState<Record<string, { tone: 'info' | 'error'; text: string }>>({});
  const now = Date.now();
  const norm = invoices.map((i) => ({ ...i, status: i.status === 'DUE' && +new Date(i.dueDate) < now ? 'OVERDUE' : i.status }));
  const outstanding = norm.filter((i) => i.status !== 'PAID').reduce((s, i) => s + (i.amountInr - i.paidInr), 0);
  const nextDue = norm.find((i) => i.status !== 'PAID');
  const pay = async (id: string) => {
    setPayingId(id);
    setOutcome((o) => { const next = { ...o }; delete next[id]; return next; });
    try {
      const r = await fetch(`/api/leases/portal/${leaseId}/invoices/${id}/pay`, { method: 'POST', headers: { 'Content-Type': 'application/json', ...linkHeaders() }, body: '{}' });
      if (r.status === 403) {
        setOutcome((o) => ({ ...o, [id]: { tone: 'info', text: 'Online payment is not available. Pay your landlord as usual; they will record it here.' } }));
        return;
      }
      if (!r.ok) {
        setOutcome((o) => ({ ...o, [id]: { tone: 'error', text: 'The payment did not go through. Nothing was recorded.' } }));
        return;
      }
      onPaid(); // the reloaded invoice status is what shows "Paid"
    } catch {
      setOutcome((o) => ({ ...o, [id]: { tone: 'error', text: 'The payment could not be sent. Check your connection. Nothing was recorded.' } }));
    } finally { setPayingId(null); }
  };
  return (
    <div style={{ ...card, padding: 22, marginBottom: 16 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontWeight: 700, fontSize: 16, marginBottom: 4 }}><Receipt size={18} style={{ color: 'var(--brand,#132376)' }} /> Rent &amp; payments</div>
      <div style={{ fontSize: 13, color: 'var(--ink-3)', marginBottom: 14 }}>
        {outstanding > 0
          ? <>You have <b style={{ color: 'var(--ink-1)' }}>{money(outstanding)}</b> outstanding{nextDue ? <> — next: {nextDue.period}, due {new Date(nextDue.dueDate).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}</> : ''}.</>
          : 'You’re all paid up. Thank you!'}
      </div>
      {norm.length === 0 && <div style={{ fontSize: 13, color: 'var(--ink-3)' }}>No rent invoices yet.</div>}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        {norm.map((i) => {
          const m = RINV_META[i.status] ?? RINV_META.DUE;
          return (
            <div key={i.id} style={{ background: 'var(--surface-2)', borderRadius: 10, padding: '10px 12px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 10 }}>
              <div style={{ minWidth: 0 }}>
                <div style={{ fontWeight: 600, fontSize: 13 }}>{i.period}</div>
                <div style={{ fontSize: 11.5, color: 'var(--ink-3)' }}>Due {new Date(i.dueDate).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}{i.paidInr > 0 && i.status !== 'PAID' ? ` · ${money(i.paidInr)} paid` : ''}</div>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <div style={{ textAlign: 'right' }}><div style={{ fontWeight: 700, fontSize: 13.5 }}>{money(i.amountInr)}</div></div>
                <span className="badge" style={{ background: m.bg, color: m.fg }}>{m.label}</span>
                {i.status !== 'PAID' && <button className="btn-primary" style={{ height: 32, fontSize: 12.5 }} disabled={payingId === i.id} onClick={() => pay(i.id)}>{payingId === i.id ? 'Sending…' : <><CreditCard size={13} /> Pay {money(i.amountInr - i.paidInr)}</>}</button>}
              </div>
              {outcome[i.id] && <div role={outcome[i.id].tone === 'error' ? 'alert' : 'status'} style={{ flexBasis: '100%', fontSize: 12, color: outcome[i.id].tone === 'error' ? 'var(--danger,#c0392b)' : 'var(--ink-3)' }}>{outcome[i.id].text}</div>}
            </div>
          );
        })}
      </div>
    </div>
  );
}

function ComplaintModal({ leaseId, onClose, onDone }: { leaseId: string; onClose: () => void; onDone: () => void }) {
  const [f, setF] = useState({ title: '', description: '', category: 'PLUMBING', priority: 'MEDIUM' });
  const [busy, setBusy] = useState(false);
  const set = (k: string, v: string) => setF((x) => ({ ...x, [k]: v }));
  const [error, setError] = useState<string | null>(null);
  const submit = async () => {
    setBusy(true); setError(null);
    try {
      const r = await fetch('/api/complaints/portal', { method: 'POST', headers: { 'Content-Type': 'application/json', ...linkHeaders() }, body: JSON.stringify({ leaseId, ...f }) });
      if (!r.ok) { setError((await r.json().catch(() => null))?.message ?? 'Your request could not be raised. Please try again.'); return; }
      onDone();
    } catch { setError('Your request could not be raised. Check your connection and try again.'); } finally { setBusy(false); }
  };
  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 60, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }}>
      <div style={{ position: 'absolute', inset: 0, background: 'rgba(20,15,12,.5)' }} onClick={onClose} />
      <div style={{ ...card, position: 'relative', zIndex: 1, width: 460, maxWidth: '100%', padding: 22, borderRadius: 18 }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}><div style={{ fontWeight: 700, fontSize: 16 }}>Raise a request</div><button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--ink-3)' }}><X size={20} /></button></div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          <div><label className="label">Title</label><input className="input" value={f.title} onChange={(e) => set('title', e.target.value)} placeholder="Leaking kitchen tap" /></div>
          <div style={{ display: 'flex', gap: 10 }}>
            <div style={{ flex: 1 }}><label className="label">Category</label><select className="input" value={f.category} onChange={(e) => set('category', e.target.value)}>{['PLUMBING', 'ELECTRICAL', 'HVAC', 'APPLIANCE', 'PEST', 'CLEANING', 'SECURITY', 'OTHER'].map((c) => <option key={c} value={c}>{c[0] + c.slice(1).toLowerCase()}</option>)}</select></div>
            <div style={{ flex: 1 }}><label className="label">Priority</label><select className="input" value={f.priority} onChange={(e) => set('priority', e.target.value)}>{['LOW', 'MEDIUM', 'HIGH', 'EMERGENCY'].map((p) => <option key={p} value={p}>{p[0] + p.slice(1).toLowerCase()}</option>)}</select></div>
          </div>
          <div><label className="label">Details</label><textarea className="input" style={{ minHeight: 80, paddingTop: 8, resize: 'vertical' }} value={f.description} onChange={(e) => set('description', e.target.value)} /></div>
        </div>
        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10, marginTop: 18 }}><button className="btn-secondary" onClick={onClose}>Cancel</button><button className="btn-primary" disabled={!f.title || !f.description || busy} onClick={submit}>Submit</button></div>
      </div>
    </div>
  );
}
