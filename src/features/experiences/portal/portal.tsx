'use client';

import { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  GraduationCap, CalendarDays, ClipboardCheck, BookOpen, FileText, Award, Wallet, Bell,
  Users, Presentation, ClipboardList, LogOut, Loader2,
  Check, X, Plus, Video, Send, ChevronRight, CalendarClock, Pin, Clock, MapPin, Trash2,
  ScrollText, BadgeCheck, Copy, Download, Briefcase, IndianRupee, Radio, Zap, ShieldCheck,
  MessagesSquare, ThumbsUp, CheckCircle2, Captions, HardDrive,
} from 'lucide-react';
import { toast } from 'sonner';
import { PortalMe, PortalType, PORTAL_META, clearPortalSession, getPortalSession, portalApi, savePortalSession } from './portal-client';
import { SolarCustomerPortal, SolarDealerPortal } from '@/features/verticals/solar/solar/portal/solar-portal-screens';
import { InsuranceCustomerPortal } from '@/features/verticals/insurance/insurance/portal/insurance-portal-screens';
import { LiveClassroom } from './live-classroom';
import { tenantFromHost } from '@/lib/tenant-host';
import { LearnPlayer, DocViewer } from './learn-player';
import { RecordingPlayer } from './recording-player';

type PlayReq = { url: string; title: string };

const card: React.CSSProperties = { background: 'var(--surface)', border: '1px solid var(--line-soft)', borderRadius: 16 };

// Narrow-viewport detector for the PWA / mobile layout.
function useIsMobile(breakpoint = 720) {
  const [mobile, setMobile] = useState(false);
  useEffect(() => {
    const mq = window.matchMedia(`(max-width: ${breakpoint}px)`);
    const on = () => setMobile(mq.matches);
    on();
    mq.addEventListener('change', on);
    return () => mq.removeEventListener('change', on);
  }, [breakpoint]);
  return mobile;
}

// Menus per portal — Sprint 15 ships the shell; items land in Sprints 16–27.
const MENUS: Record<PortalType, { icon: any; label: string }[]> = {
  STUDENT: [
    { icon: CalendarDays, label: 'Timetable' }, { icon: ClipboardCheck, label: 'Attendance' },
    { icon: BookOpen, label: 'Materials' }, { icon: FileText, label: 'Assignments' },
    { icon: Award, label: 'Grades' }, { icon: Wallet, label: 'Fees' },
    { icon: ScrollText, label: 'Certificates' }, { icon: Briefcase, label: 'Placements' },
    { icon: MessagesSquare, label: 'Discussions' }, { icon: Bell, label: 'Notifications' },
  ],
  LECTURER: [
    { icon: Presentation, label: 'My Classes' }, { icon: CalendarDays, label: 'Timetable' },
    { icon: ClipboardCheck, label: 'Attendance' }, { icon: BookOpen, label: 'Materials' },
    { icon: FileText, label: 'Assignments' }, { icon: ClipboardList, label: 'Grading' },
    { icon: Radio, label: 'Live' }, { icon: MessagesSquare, label: 'Discussions' }, { icon: CalendarClock, label: 'PTM' }, { icon: Bell, label: 'Announcements' },
  ],
  PARENT: [
    { icon: Users, label: 'Children' }, { icon: ClipboardCheck, label: 'Attendance' },
    { icon: Award, label: 'Grades' }, { icon: Wallet, label: 'Fees' }, { icon: Bell, label: 'Announcements' },
    { icon: CalendarDays, label: 'PTM' },
  ],
  // Solar realms are single-view: everything they may see is on one screen, so there is
  // no menu to wander into and nothing that takes a record id.
  SOLAR_CUSTOMER: [],
  SOLAR_DEALER: [],
  // Insurance customers get one screen with its own tabs — same reasoning as solar.
  INSURANCE_CUSTOMER: [],
};

function Shell({ children, accent, agency, logo, tagline, icon: Icon = ShieldCheck }: { children: React.ReactNode; accent: string; agency?: string; logo?: string | null; tagline?: string | null; icon?: any }) {
  return (
    <div style={{ minHeight: '100vh', background: 'var(--surface-2)' }}>
      <div style={{ maxWidth: 860, margin: '0 auto', padding: '28px 20px 64px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 18 }}>
          {logo
            ? <img src={logo} alt={agency ?? 'logo'} style={{ width: 34, height: 34, borderRadius: 9, objectFit: 'cover' }} />
            : <span style={{ width: 34, height: 34, borderRadius: 9, background: accent, color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center' }}><Icon size={18} /></span>}
          <div><div style={{ fontWeight: 700, fontSize: 15 }}>{agency ?? 'BMN Connect'}</div><div style={{ fontSize: 11.5, color: 'var(--ink-3)' }}>{tagline || 'Customer portal'}</div></div>
        </div>
        {children}
      </div>
    </div>
  );
}

// ------------------------------- Login -------------------------------
export function PortalLogin() {
  const router = useRouter();
  const [f, setF] = useState({ email: '', password: '' });
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');
  // Passwordless sign-in needs to know WHOSE book to look in, and the portal is
  // addressed per tenant, so the subdomain is the answer. On the shared platform
  // host there is no tenant to name, and offering the option there would send a
  // code that could never arrive.
  const [slug, setSlug] = useState<string | null>(null);
  const [mode, setMode] = useState<'email' | 'phone'>('email');
  const [phone, setPhone] = useState('');
  const [code, setCode] = useState('');
  const [codeSent, setCodeSent] = useState(false);
  useEffect(() => { if (getPortalSession()) router.replace('/portal/dashboard'); }, [router]);
  useEffect(() => { setSlug(tenantFromHost(window.location.host)); }, []);
  // portalApi redirects here when the organisation is suspended. Arriving at a
  // blank login form after being signed out mid-session reads as a glitch; say
  // what happened instead.
  useEffect(() => {
    if (new URLSearchParams(window.location.search).get('suspended')) {
      setErr('Access to this workspace has been suspended. Please contact your administrator.');
    }
  }, []);

  const requestCode = async (e: React.FormEvent) => {
    e.preventDefault(); setBusy(true); setErr('');
    try {
      const r = await fetch('/api/portal/auth/otp/request', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ phone, orgSlug: slug }),
      });
      // A provider failure is the one thing that must not read as "code sent".
      if (!r.ok) throw new Error((await r.json().catch(() => ({}))).message || 'We could not send a code just now.');
      setCodeSent(true);
    } catch (e: any) { setErr(e.message); } finally { setBusy(false); }
  };

  const verifyCode = async (e: React.FormEvent) => {
    e.preventDefault(); setBusy(true); setErr('');
    try {
      const r = await fetch('/api/portal/auth/otp/verify', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ phone, code, orgSlug: slug }),
      });
      // Not every refusal here is a bad code — a suspended organisation is
      // refused at the moment the token would be signed, and telling that
      // person to request a new code sends them round a loop that cannot end.
      if (!r.ok) throw new Error((await r.json().catch(() => ({}))).message || 'That code is not valid. Request a new one.');
      const d = await r.json();
      savePortalSession(d.accessToken, d.user);
      router.replace('/portal/dashboard');
    } catch (e: any) { setErr(e.message); } finally { setBusy(false); }
  };

  const submit = async (e: React.FormEvent) => {
    e.preventDefault(); setBusy(true); setErr('');
    try {
      const r = await fetch('/api/portal/auth/login', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(f) });
      if (!r.ok) throw new Error((await r.json().catch(() => ({}))).message || 'Invalid email or password');
      const d = await r.json();
      savePortalSession(d.accessToken, d.user);
      router.replace('/portal/dashboard');
    } catch (e: any) { setErr(e.message || 'Login failed'); } finally { setBusy(false); }
  };

  return (
    <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'var(--surface-2)', padding: 16 }}>
      <div style={{ ...card, width: 420, maxWidth: '100%', padding: 30 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 18 }}>
          {/* Before sign-in we do not know the realm, so the mark must be neutral.
              A graduation cap told an insurance policyholder they were in the wrong product. */}
          <span style={{ width: 38, height: 38, borderRadius: 10, background: 'var(--brand,#132376)', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center' }}><ShieldCheck size={20} /></span>
          <div><div style={{ fontWeight: 800, fontSize: 17 }}>Portal</div><div style={{ fontSize: 12, color: 'var(--ink-3)' }}>Sign in to your account</div></div>
        </div>
        {slug && (
          <div style={{ display: 'flex', gap: 6, marginBottom: 14 }}>
            {(['email', 'phone'] as const).map((m) => (
              <button
                key={m} type="button"
                onClick={() => { setMode(m); setErr(''); setCodeSent(false); }}
                style={{
                  flex: 1, height: 34, borderRadius: 8, fontSize: 12.5, cursor: 'pointer',
                  border: '1px solid var(--hairline)',
                  background: mode === m ? 'var(--brand,#132376)' : 'transparent',
                  color: mode === m ? '#fff' : 'var(--ink-2)',
                  fontWeight: mode === m ? 600 : 400,
                }}
              >
                {m === 'email' ? 'Email & password' : 'Mobile number'}
              </button>
            ))}
          </div>
        )}

        {mode === 'email' ? (
          <>
            <form onSubmit={submit} style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              <div><label className="label">Email</label><input className="input" type="email" value={f.email} onChange={(e) => setF({ ...f, email: e.target.value })} placeholder="you@example.com" required /></div>
              <div><label className="label">Password</label><input className="input" type="password" value={f.password} onChange={(e) => setF({ ...f, password: e.target.value })} required /></div>
              {err && <div style={{ fontSize: 12.5, color: 'var(--danger,#c0392b)' }}>{err}</div>}
              <button className="btn-primary" style={{ height: 44, marginTop: 4 }} disabled={busy || !f.email || !f.password}>{busy ? <Loader2 size={16} className="spin" /> : 'Sign in'}</button>
            </form>
            <div style={{ fontSize: 11.5, color: 'var(--ink-3)', marginTop: 14, textAlign: 'center' }}>Have an invitation? Use the activation link you were sent.</div>
          </>
        ) : !codeSent ? (
          <form onSubmit={requestCode} style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            <div>
              <label className="label">Mobile number</label>
              <input className="input" type="tel" inputMode="numeric" value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="98765 43210" required />
              <div style={{ fontSize: 11.5, color: 'var(--ink-3)', marginTop: 5 }}>The number your policy is registered against.</div>
            </div>
            {err && <div style={{ fontSize: 12.5, color: 'var(--danger,#c0392b)' }}>{err}</div>}
            <button className="btn-primary" style={{ height: 44, marginTop: 4 }} disabled={busy || phone.replace(/\D/g, '').length < 10}>{busy ? <Loader2 size={16} className="spin" /> : 'Send me a code'}</button>
          </form>
        ) : (
          <form onSubmit={verifyCode} style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            {/* Deliberately conditional: the API never confirms that a number is
                on the book, and this screen must not either. */}
            <div style={{ fontSize: 12.5, color: 'var(--ink-3)' }}>
              If {phone} is registered with us, a six-digit code is on its way. It expires in five minutes.
            </div>
            <div>
              <label className="label">Code</label>
              <input className="input" inputMode="numeric" autoComplete="one-time-code" maxLength={6} value={code} onChange={(e) => setCode(e.target.value.replace(/\D/g, ''))} required />
            </div>
            {err && <div style={{ fontSize: 12.5, color: 'var(--danger,#c0392b)' }}>{err}</div>}
            <button className="btn-primary" style={{ height: 44 }} disabled={busy || code.length !== 6}>{busy ? <Loader2 size={16} className="spin" /> : 'Sign in'}</button>
            <button type="button" onClick={() => { setCodeSent(false); setCode(''); setErr(''); }} style={{ background: 'none', border: 0, color: 'var(--ink-3)', fontSize: 12, cursor: 'pointer' }}>
              Use a different number
            </button>
          </form>
        )}
      </div>
    </div>
  );
}

// ----------------------------- Activate ------------------------------
export function PortalActivate() {
  const router = useRouter();
  const [pw, setPw] = useState('');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');
  const [token, setToken] = useState('');
  useEffect(() => { setToken(new URLSearchParams(window.location.search).get('token') || ''); }, []);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault(); setBusy(true); setErr('');
    try {
      const r = await fetch('/api/portal/auth/activate', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ token, password: pw }) });
      if (!r.ok) throw new Error('This link is invalid or has expired');
      const d = await r.json();
      savePortalSession(d.accessToken, d.user);
      router.replace('/portal/dashboard');
    } catch (e: any) { setErr(e.message); } finally { setBusy(false); }
  };

  return (
    <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'var(--surface-2)', padding: 16 }}>
      <div style={{ ...card, width: 420, maxWidth: '100%', padding: 30 }}>
        <div style={{ fontWeight: 800, fontSize: 18, marginBottom: 4 }}>Set your password</div>
        <div style={{ fontSize: 13, color: 'var(--ink-3)', marginBottom: 16 }}>Choose a password to activate your portal account.</div>
        {!token && <div style={{ fontSize: 12.5, color: 'var(--danger,#c0392b)' }}>Missing activation token.</div>}
        <form onSubmit={submit} style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          <div><label className="label">New password</label><input className="input" type="password" value={pw} onChange={(e) => setPw(e.target.value)} minLength={8} required /></div>
          {err && <div style={{ fontSize: 12.5, color: 'var(--danger,#c0392b)' }}>{err}</div>}
          <button className="btn-primary" style={{ height: 44 }} disabled={busy || pw.length < 8 || !token}>{busy ? <Loader2 size={16} className="spin" /> : 'Activate & sign in'}</button>
        </form>
      </div>
    </div>
  );
}

// ----------------------------- Dashboard -----------------------------
export function PortalDashboard() {
  const router = useRouter();
  const [me, setMe] = useState<PortalMe | null>(null);
  const [err, setErr] = useState(false);
  const [active, setActive] = useState('Dashboard');
  const [liveLecture, setLiveLecture] = useState<string | null>(null);
  const [playing, setPlaying] = useState<PlayReq | null>(null);
  const isMobile = useIsMobile();

  useEffect(() => {
    if (!getPortalSession()) { router.replace('/portal/login'); return; }
    portalApi<PortalMe>('/portal/auth/me').then(setMe).catch(() => setErr(true));
  }, [router]);

  // Session expired / invalid → clear the stale token and bounce to login.
  useEffect(() => {
    if (!err) return;
    clearPortalSession();
    const t = setTimeout(() => router.replace('/portal/login'), 1200);
    return () => clearTimeout(t);
  }, [err, router]);

  // End the session on the server first: clearing the browser's copy alone left the
  // token valid for the rest of its 8 hours wherever else it had been copied.
  const logout = async () => {
    await portalApi('/portal/auth/logout', { method: 'POST' }).catch(() => undefined);
    clearPortalSession();
    router.replace('/portal/login');
  };

  if (err) return <Shell accent="#132376"><div style={{ ...card, padding: 50, textAlign: 'center', color: 'var(--ink-3)' }}>Your session expired — taking you to sign in…</div></Shell>;
  if (!me) return <Shell accent="#132376"><div style={{ ...card, padding: 50, textAlign: 'center', color: 'var(--ink-3)' }}>Loading…</div></Shell>;

  const meta = PORTAL_META[me.type];
  const menu = MENUS[me.type];
  const typeIcon = me.type === 'INSURANCE_CUSTOMER' ? ShieldCheck : me.type === 'SOLAR_CUSTOMER' || me.type === 'SOLAR_DEALER' ? Zap : GraduationCap;
  const accent = me.organization?.primaryColor || meta.accent; // white-label: tenant brand colour
  const children = me.linked?.children as { firstName: string; lastName?: string; admissionNo: string }[] | undefined;

  return (
    <Shell accent={accent} agency={me.organization?.name} logo={me.organization?.logoUrl} tagline={me.organization?.tagline} icon={typeIcon}>
      {/* Identity header */}
      <div style={{ ...card, padding: 20, marginBottom: 16, display: 'flex', alignItems: 'center', gap: 14 }}>
        <span style={{ width: 52, height: 52, borderRadius: 14, background: accent, color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 800, fontSize: 20 }}>{me.name.slice(0, 1)}</span>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <h1 style={{ fontSize: 20, fontWeight: 700, margin: 0 }}>{me.name}</h1>
            <span className="badge" style={{ background: 'color-mix(in srgb, ' + accent + ' 14%, var(--surface))', color: accent }}>{meta.label}</span>
          </div>
          <div style={{ fontSize: 13, color: 'var(--ink-3)' }}>
            {me.type === 'STUDENT' && me.linked?.admissionNo ? `Admission ${me.linked.admissionNo}` : ''}
            {me.type === 'LECTURER' && me.linked?.department ? `${me.linked.designation ?? 'Lecturer'} · ${me.linked.department}` : ''}
            {me.type === 'PARENT' && children ? `${children.length} child${children.length === 1 ? '' : 'ren'}` : ''}
            {' · '}{me.email}
          </div>
        </div>
        <button className="btn-secondary" style={{ height: 36 }} onClick={logout}><LogOut size={14} /> Sign out</button>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : '210px 1fr', gap: 16, alignItems: 'start' }}>
        {/* Scoped sidebar — a horizontal scroller on mobile, a rail on desktop */}
        <div style={{ ...card, padding: isMobile ? 6 : 10, display: 'flex', flexDirection: isMobile ? 'row' : 'column', gap: isMobile ? 4 : 0, overflowX: isMobile ? 'auto' : 'visible', WebkitOverflowScrolling: 'touch' }}>
          {[{ icon: typeIcon, label: 'Dashboard' }, ...menu].map((m) => (
            <button key={m.label} onClick={() => setActive(m.label)} style={{
              width: isMobile ? 'auto' : '100%', flex: isMobile ? '0 0 auto' : undefined, whiteSpace: 'nowrap',
              display: 'flex', alignItems: 'center', gap: isMobile ? 6 : 10, padding: '9px 11px', borderRadius: 9,
              border: 'none', cursor: 'pointer', fontSize: 13.5, fontWeight: 600, textAlign: 'left',
              background: active === m.label ? 'color-mix(in srgb, ' + accent + ' 12%, var(--surface))' : 'transparent',
              color: active === m.label ? accent : 'var(--ink-2)',
            }}><m.icon size={16} /> {m.label}</button>
          ))}
        </div>

        {/* Content */}
        <div style={{ ...card, padding: isMobile ? 16 : 24, minHeight: 320 }}>
          {me.type === 'INSURANCE_CUSTOMER' ? (
            <InsuranceCustomerPortal accent={accent} />
          ) : me.type === 'SOLAR_CUSTOMER' ? (
            <SolarCustomerPortal accent={accent} />
          ) : me.type === 'SOLAR_DEALER' ? (
            <SolarDealerPortal accent={accent} />
          ) : active === 'Dashboard' ? (
            <>
              {me.type === 'STUDENT' && <PortalLectureBanner accent={accent} onJoin={setLiveLecture} />}
              {me.type === 'STUDENT' && <PortalRecordings accent={accent} onPlay={setPlaying} />}
              {me.type === 'LECTURER' && <LecturerDashboardCards accent={accent} onGo={setActive} />}
              <div style={{ fontWeight: 700, fontSize: 17 }}>Welcome, {me.name.split(' ')[0]} 👋</div>
              <div style={{ fontSize: 13.5, color: 'var(--ink-3)', marginTop: 6, maxWidth: '58ch' }}>
                Your {meta.label.toLowerCase()} portal is ready — jump into your timetable, attendance, materials, assignments, grades and fees from the shortcuts below or the menu.
              </div>
              {me.type === 'PARENT' && children && children.length > 0 && (
                <div style={{ marginTop: 18 }}>
                  <div style={{ fontSize: 11, letterSpacing: '.08em', textTransform: 'uppercase', color: 'var(--ink-3)', fontWeight: 700, marginBottom: 8 }}>Your children</div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                    {children.map((c) => (
                      <div key={c.admissionNo} style={{ background: 'var(--surface-2)', borderRadius: 10, padding: '10px 12px', display: 'flex', justifyContent: 'space-between' }}>
                        <span style={{ fontWeight: 600, fontSize: 13.5 }}>{c.firstName} {c.lastName ?? ''}</span>
                        <span style={{ fontSize: 12, color: 'var(--ink-3)' }}>{c.admissionNo}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
              <div style={{ display: me.type === 'LECTURER' ? 'none' : 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(150px,1fr))', gap: 10, marginTop: 20 }}>
                {menu.filter((m) => m.label !== 'Dashboard').slice(0, 6).map((m) => (
                  <button key={m.label} onClick={() => setActive(m.label)} style={{ textAlign: 'left', cursor: 'pointer', border: '1px solid var(--line-soft)', background: 'var(--surface-2)', borderRadius: 12, padding: 14 }}>
                    <m.icon size={18} style={{ color: accent }} />
                    <div style={{ fontWeight: 600, fontSize: 13.5, marginTop: 8 }}>{m.label}</div>
                    <div style={{ fontSize: 11.5, color: accent }}>Open →</div>
                  </button>
                ))}
              </div>
            </>
          ) : active === 'Timetable' && me.type === 'STUDENT' ? (
            <StudentTimetable accent={accent} />
          ) : active === 'Attendance' && me.type === 'STUDENT' ? (
            <PortalAttendance accent={accent} />
          ) : active === 'Materials' && me.type === 'STUDENT' ? (
            <PortalMaterials accent={accent} />
          ) : active === 'Assignments' && me.type === 'STUDENT' ? (
            <PortalAssignments accent={accent} />
          ) : active === 'Grades' && me.type === 'STUDENT' ? (
            <PortalGrades accent={accent} />
          ) : active === 'Fees' && me.type === 'STUDENT' ? (
            <PortalFees accent={accent} />
          ) : active === 'Certificates' && me.type === 'STUDENT' ? (
            <PortalCertificates accent={accent} />
          ) : active === 'Placements' && me.type === 'STUDENT' ? (
            <PortalPlacements accent={accent} />
          ) : me.type === 'LECTURER' && active === 'My Classes' ? (
            <LecturerClasses accent={accent} />
          ) : me.type === 'LECTURER' && active === 'Timetable' ? (
            <LecturerTimetable accent={accent} />
          ) : me.type === 'LECTURER' && active === 'Attendance' ? (
            <LecturerAttendance accent={accent} />
          ) : me.type === 'LECTURER' && active === 'Materials' ? (
            <LecturerMaterials accent={accent} />
          ) : me.type === 'LECTURER' && (active === 'Grading' || active === 'Assignments') ? (
            <LecturerGrading accent={accent} />
          ) : me.type === 'LECTURER' && active === 'Live' ? (
            <LecturerLive accent={accent} onJoin={setLiveLecture} onPlay={setPlaying} />
          ) : me.type === 'LECTURER' && active === 'PTM' ? (
            <LecturerPTM accent={accent} />
          ) : me.type === 'PARENT' && (active === 'Attendance' || active === 'Grades' || active === 'Fees') ? (
            <ParentSection accent={accent} tab={active as 'Attendance' | 'Grades' | 'Fees'} />
          ) : me.type === 'PARENT' && active === 'PTM' ? (
            <ParentPTM accent={accent} />
          ) : me.type === 'PARENT' && active === 'Children' ? (
            <ParentChildrenOverview accent={accent} onGo={setActive} />
          ) : active === 'Discussions' && (me.type === 'STUDENT' || me.type === 'LECTURER') ? (
            <PortalDiscussions accent={accent} isStudent={me.type === 'STUDENT'} />
          ) : active === 'Notifications' ? (
            <PortalNotifications accent={accent} onOpenDiscussions={() => setActive('Discussions')} />
          ) : active === 'Announcements' ? (
            <PortalAnnouncements accent={accent} />
          ) : (
            <div style={{ textAlign: 'center', padding: '60px 20px', color: 'var(--ink-3)' }}>
              <div style={{ fontWeight: 700, fontSize: 16, color: 'var(--ink-1)' }}>{active}</div>
              <div style={{ fontSize: 13, marginTop: 6 }}>This section is coming soon in an upcoming release.</div>
            </div>
          )}
        </div>
      </div>
      {liveLecture && <LiveClassroom lectureId={liveLecture} accent={accent} onClose={() => setLiveLecture(null)} />}
      {playing && <RecordingPlayer url={playing.url} title={playing.title} accent={accent} onClose={() => setPlaying(null)} />}
    </Shell>
  );
}

// Student portal — my attendance (Sprint 17)
function PortalAttendance({ accent, path = '/portal/me/attendance' }: { accent: string; path?: string }) {
  const [d, setD] = useState<any>(null);
  const [err, setErr] = useState(false);
  useEffect(() => { portalApi(path).then(setD).catch(() => setErr(true)); }, [path]);
  if (err) return <div style={{ padding: 40, textAlign: 'center', color: 'var(--ink-3)' }}>Couldn’t load attendance.</div>;
  if (!d) return <div style={{ padding: 40, textAlign: 'center', color: 'var(--ink-3)' }}>Loading…</div>;
  const col = (p: number | null) => p == null ? 'var(--ink-3)' : p < 75 ? 'var(--danger,#c0392b)' : p < 85 ? 'var(--gold,#c67c1e)' : 'var(--success,#1e874b)';
  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 16, marginBottom: 18 }}>
        <div style={{ position: 'relative', width: 86, height: 86, borderRadius: '50%', background: `conic-gradient(${col(d.overallPct)} ${(d.overallPct ?? 0) * 3.6}deg, var(--surface-2) 0)`, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <div style={{ width: 66, height: 66, borderRadius: '50%', background: 'var(--surface)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 800, fontSize: 20, color: col(d.overallPct) }}>{d.overallPct ?? '—'}%</div>
        </div>
        <div>
          <div style={{ fontWeight: 700, fontSize: 16 }}>Overall attendance</div>
          <div style={{ fontSize: 13, color: 'var(--ink-3)' }}>{d.attended} of {d.total} classes attended</div>
          {d.overallPct != null && d.overallPct < 75 && <div style={{ fontSize: 12.5, color: 'var(--danger,#c0392b)', marginTop: 4 }}>⚠ Below the 75% requirement</div>}
        </div>
      </div>
      <div style={{ fontSize: 11, letterSpacing: '.08em', textTransform: 'uppercase', color: 'var(--ink-3)', fontWeight: 700, marginBottom: 8 }}>By subject</div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        {(d.subjects ?? []).map((s: any) => (
          <div key={s.code} style={{ display: 'flex', alignItems: 'center', gap: 12, background: 'var(--surface-2)', borderRadius: 10, padding: '10px 12px' }}>
            <div style={{ flex: 1 }}><div style={{ fontWeight: 600, fontSize: 13 }}>{s.code} · {s.name}</div><div style={{ fontSize: 11, color: 'var(--ink-3)' }}>{s.attended}/{s.total}</div></div>
            <div style={{ width: 120, height: 7, borderRadius: 99, background: 'var(--surface)', overflow: 'hidden' }}><div style={{ width: `${s.pct ?? 0}%`, height: '100%', background: col(s.pct) }} /></div>
            <div style={{ width: 44, textAlign: 'right', fontWeight: 700, color: col(s.pct) }}>{s.pct ?? '—'}%</div>
          </div>
        ))}
      </div>
    </div>
  );
}

/**
 * The join affordance for a lecture, decided by the SERVER.
 *
 * It used to branch on `lec.joinUrl` being present, which conflated two
 * different things: an in-app room (a route that keeps the student here) and
 * somebody else's meeting (a destination that sends them away). It also gave an
 * upcoming in-app class no button at all, because in-app lectures store no URL —
 * their room is derived from the id.
 *
 * `meetingProvider` / `isExternalMeeting` / `joinLabel` come from
 * common/meeting-link.ts, so this component never has to know that a Meet link
 * starts with https and a room path does not.
 */
const PROVIDER_LABEL: Record<string, string> = {
  IN_APP: 'BMN Connect',
  GOOGLE_MEET: 'Google Meet',
  ZOOM: 'Zoom',
  MS_TEAMS: 'Microsoft Teams',
  OTHER: 'Online meeting',
};

function LectureJoinAction({ lec, live, accent, onJoin }: { lec: any; live: boolean; accent: string; onJoin?: (id: string) => void }) {
  const provider: string | null = lec?.meetingProvider ?? null;
  // No provider at all means an in-person class. There is nothing to join, and
  // an empty button that does nothing is worse than no button.
  if (!provider) return null;

  const external = !!lec?.isExternalMeeting;
  const label = PROVIDER_LABEL[provider] ?? 'Online meeting';
  const bg = live ? 'var(--danger,#c0392b)' : accent;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 4 }}>
      <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--ink-3)' }}>Online · {label}</div>
      {external ? (
        lec.joinTarget ? (
          <a href={lec.joinTarget} target="_blank" rel="noopener noreferrer" className="btn-primary" style={{ height: 38, background: bg }}>
            <Video size={15} /> {live ? 'Join now' : 'Join meeting'}
          </a>
        ) : null
      ) : onJoin ? (
        <button className="btn-primary" style={{ height: 38, background: bg }} onClick={() => onJoin(lec.id)}>
          <Video size={15} /> {live ? 'Join now' : 'Join in BMN Connect'}
        </button>
      ) : null}
    </div>
  );
}

// Student portal — live / next lecture banner (Sprint 18)
function PortalLectureBanner({ accent, onJoin }: { accent: string; onJoin?: (lectureId: string) => void }) {
  const [d, setD] = useState<any>(null);
  useEffect(() => { portalApi('/portal/me/lectures').then(setD).catch(() => {}); }, []);
  const lec = d?.live ?? d?.upcoming?.[0];
  if (!lec) return null;
  const live = !!d?.live;
  const when = new Date(lec.scheduledAt).toLocaleString('en-IN', { weekday: 'short', day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' });
  return (
    <div style={{ ...card, padding: 16, marginBottom: 16, background: live ? 'color-mix(in srgb, var(--danger,#c0392b) 8%, var(--surface))' : 'var(--surface-2)', border: live ? '1px solid color-mix(in srgb, var(--danger,#c0392b) 30%, var(--line-soft))' : '1px solid var(--line-soft)', display: 'flex', alignItems: 'center', gap: 12 }}>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 11, fontWeight: 800, letterSpacing: '.06em', textTransform: 'uppercase', color: live ? 'var(--danger,#c0392b)' : 'var(--ink-3)' }}>{live ? '🔴 Live now' : 'Next class'}</div>
        <div style={{ fontWeight: 700, fontSize: 15, marginTop: 2 }}>{lec.subject?.code} · {lec.title}</div>
        <div style={{ fontSize: 12.5, color: 'var(--ink-3)' }}>{when}{lec.faculty ? ` · ${lec.faculty.name}` : ''}</div>
      </div>
      <LectureJoinAction lec={lec} live={live} accent={accent} onJoin={onJoin} />
    </div>
  );
}

// Student portal — course content (Sprint 18)
function PortalMaterials({ accent }: { accent: string }) {
  const [subjects, setSubjects] = useState<any[] | null>(null);
  const [open, setOpen] = useState<string | null>(null);
  const [content, setContent] = useState<any>(null);
  const [play, setPlay] = useState<any>(null);   // LearnPlayer item
  const [view, setView] = useState<any>(null);   // DocViewer item
  useEffect(() => { portalApi('/portal/me/subjects').then(setSubjects).catch(() => setSubjects([])); }, []);
  const openSubject = (id: string) => { setOpen(id); setContent(null); portalApi(`/portal/me/subjects/${id}/content`).then(setContent).catch(() => {}); };
  const reload = () => { if (open) portalApi(`/portal/me/subjects/${open}/content`).then(setContent).catch(() => {}); };
  const ICON: Record<string, string> = { PDF: '📄', SLIDES: '📊', VIDEO: '🎬', LINK: '🔗', DOC: '📝', AUDIO: '🎧', IMAGE: '🖼️', OTHER: '📎' };
  const fmt = (s: number) => `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, '0')}`;

  const openItem = (m: any) => {
    if (m.type === 'VIDEO' || m.type === 'AUDIO') setPlay(m);
    else if (m.type === 'LINK') window.open(m.url, '_blank', 'noopener');
    else setView(m);
  };

  const ItemRow = ({ m }: { m: any }) => {
    const p = content?.progress?.[m.id];
    return (
      <button onClick={() => openItem(m)} style={{ display: 'flex', alignItems: 'center', gap: 10, width: '100%', textAlign: 'left', background: 'var(--surface-2)', border: 'none', borderRadius: 10, padding: '9px 12px', cursor: 'pointer', color: 'var(--ink-1)', fontSize: 13 }}>
        <span style={{ fontSize: 16 }}>{ICON[m.type] ?? ICON.OTHER}</span>
        <span style={{ flex: 1, fontWeight: 600 }}>{m.title}</span>
        {m.mediaAsset?.durationSec ? <span style={{ fontSize: 11.5, color: 'var(--ink-3)' }}>{fmt(m.mediaAsset.durationSec)}</span> : null}
        {p?.completed ? <span className="badge" style={{ background: 'var(--success-bg,#e6f4ea)', color: 'var(--success,#1e874b)' }}>✓ Done</span>
          : p?.lastPositionSec > 2 ? <span className="badge" style={{ background: 'color-mix(in srgb, ' + accent + ' 12%, var(--surface))', color: accent }}>▶ {fmt(p.lastPositionSec)}</span>
          : null}
      </button>
    );
  };

  if (!subjects) return <div style={{ padding: 40, textAlign: 'center', color: 'var(--ink-3)' }}>Loading…</div>;
  if (open) {
    const lessonsByModule: Record<string, any[]> = {};
    const noModule: any[] = [];
    (content?.lessons ?? []).forEach((l: any) => { if (l.moduleId) (lessonsByModule[l.moduleId] ??= []).push(l); else noModule.push(l); });
    const renderLesson = (l: any) => (
      <div key={l.id} style={{ marginBottom: 12 }}>
        <div style={{ fontWeight: 600, fontSize: 13.5 }}>{l.title}</div>
        {l.description && <div style={{ fontSize: 12, color: 'var(--ink-3)' }}>{l.description}</div>}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 5, marginTop: 6 }}>
          {l.materials.map((m: any) => <ItemRow key={m.id} m={m} />)}
          {l.materials.length === 0 && <div style={{ fontSize: 12, color: 'var(--ink-3)' }}>No materials.</div>}
        </div>
      </div>
    );
    return (
      <div>
        <button className="btn-secondary" style={{ height: 30, fontSize: 12.5, marginBottom: 14 }} onClick={() => { setOpen(null); setContent(null); }}>← Back to subjects</button>
        {!content ? <div style={{ padding: 30, textAlign: 'center', color: 'var(--ink-3)' }}>Loading…</div> : (
          <div>
            <div style={{ fontWeight: 700, fontSize: 16, marginBottom: 12 }}>{content.subject.code} · {content.subject.name}</div>
            {(content.modules ?? []).map((mod: any) => (
              <div key={mod.id} style={{ marginBottom: 16 }}>
                <div style={{ fontSize: 11, letterSpacing: '.08em', textTransform: 'uppercase', color: accent, fontWeight: 800, marginBottom: 8 }}>{mod.title}</div>
                {(lessonsByModule[mod.id] ?? []).map(renderLesson)}
                {(lessonsByModule[mod.id] ?? []).length === 0 && <div style={{ fontSize: 12, color: 'var(--ink-3)' }}>Nothing here yet.</div>}
              </div>
            ))}
            {noModule.length > 0 && (content.modules ?? []).length > 0 && <div style={{ fontSize: 11, letterSpacing: '.08em', textTransform: 'uppercase', color: 'var(--ink-3)', fontWeight: 700, marginBottom: 8 }}>More lessons</div>}
            {noModule.map(renderLesson)}
            {content.materials.length > 0 && (
              <div style={{ marginTop: 6 }}>
                <div style={{ fontSize: 11, letterSpacing: '.08em', textTransform: 'uppercase', color: 'var(--ink-3)', fontWeight: 700, marginBottom: 6 }}>Subject resources</div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>{content.materials.map((m: any) => <ItemRow key={m.id} m={m} />)}</div>
              </div>
            )}
            {content.lessons.length === 0 && content.materials.length === 0 && <div style={{ color: 'var(--ink-3)', fontSize: 13 }}>No content published yet.</div>}
          </div>
        )}
        {play && <LearnPlayer item={play} accent={accent} isStudent onClose={() => { setPlay(null); reload(); }} />}
        {view && <DocViewer item={view} onClose={() => setView(null)} />}
      </div>
    );
  }
  return (
    <div>
      <div style={{ fontWeight: 700, fontSize: 16, marginBottom: 12 }}>My subjects</div>
      {subjects.length === 0 && <div style={{ color: 'var(--ink-3)', fontSize: 13 }}>No subjects yet.</div>}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(200px,1fr))', gap: 10 }}>
        {subjects.map((s) => (
          <button key={s.id} onClick={() => openSubject(s.id)} style={{ textAlign: 'left', background: 'var(--surface-2)', border: '1px solid var(--line-soft)', borderRadius: 12, padding: 14, cursor: 'pointer' }}>
            <div style={{ fontWeight: 700, fontSize: 13.5 }}>{s.code}</div>
            <div style={{ fontSize: 12, color: 'var(--ink-2)', marginTop: 2 }}>{s.name}</div>
            <div style={{ fontSize: 11.5, color: 'var(--ink-3)', marginTop: 8 }}>{s.lessons} lessons · {s.materials} materials</div>
          </button>
        ))}
      </div>
    </div>
  );
}

// Student portal — assignments + quizzes (Sprint 19)
function PortalAssignments({ accent }: { accent: string }) {
  const [tab, setTab] = useState<'assignments' | 'quizzes'>('assignments');
  const [assignments, setAssignments] = useState<any[] | null>(null);
  const [quizzes, setQuizzes] = useState<any[] | null>(null);
  const [submitFor, setSubmitFor] = useState<any>(null);
  const [quiz, setQuiz] = useState<any>(null);
  const load = () => { portalApi('/portal/me/assignments').then(setAssignments).catch(() => setAssignments([])); portalApi('/portal/me/assessments').then(setQuizzes).catch(() => setQuizzes([])); };
  useEffect(() => { load(); }, []);
  return (
    <div>
      <div style={{ display: 'inline-flex', background: 'var(--surface-2)', borderRadius: 10, padding: 3, marginBottom: 14 }}>
        {(['assignments', 'quizzes'] as const).map((t) => <button key={t} onClick={() => setTab(t)} style={{ border: 'none', cursor: 'pointer', borderRadius: 8, padding: '7px 16px', fontSize: 13, fontWeight: 600, background: tab === t ? 'var(--surface)' : 'transparent', color: tab === t ? 'var(--ink-1)' : 'var(--ink-3)' }}>{t === 'assignments' ? 'Assignments' : 'Quizzes'}</button>)}
      </div>
      {tab === 'assignments' ? (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {(assignments ?? []).length === 0 && <div style={{ color: 'var(--ink-3)', fontSize: 13 }}>No assignments.</div>}
          {(assignments ?? []).map((a) => (
            <div key={a.id} style={{ ...card, padding: 14, display: 'flex', alignItems: 'center', gap: 10 }}>
              <div style={{ flex: 1, minWidth: 0 }}><div style={{ fontWeight: 600, fontSize: 13.5 }}>{a.subject?.code} · {a.title}</div><div style={{ fontSize: 11.5, color: 'var(--ink-3)' }}>Due {a.dueAt ? new Date(a.dueAt).toLocaleDateString('en-IN') : '—'} · {a.maxMarks} marks{a.overdue ? ' · ⚠ overdue' : ''}</div></div>
              {a.submission ? (a.submission.status === 'GRADED'
                ? <span className="badge" style={{ background: 'var(--success-bg,#e6f4ea)', color: 'var(--success,#1e874b)' }}>{a.submission.marks}/{a.maxMarks}</span>
                : <span className="badge" style={{ background: 'var(--surface-2)', color: 'var(--ink-2)' }}>{a.submission.isLate ? 'Submitted late' : 'Submitted'}</span>)
                : <button className="btn-primary" style={{ height: 32, fontSize: 12.5, background: accent }} onClick={() => setSubmitFor(a)}>Submit</button>}
            </div>
          ))}
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {(quizzes ?? []).length === 0 && <div style={{ color: 'var(--ink-3)', fontSize: 13 }}>No quizzes.</div>}
          {(quizzes ?? []).map((q) => {
            const at = q.attempt;
            const resumable = at?.status === 'IN_PROGRESS';
            const scored = at && at.status !== 'IN_PROGRESS' && !at.needsGrading;
            return (
              <div key={q.id} style={{ ...card, padding: 14, display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontWeight: 600, fontSize: 13.5 }}>{q.subject?.code} · {q.title}</div>
                  <div style={{ fontSize: 11.5, color: 'var(--ink-3)' }}>
                    {q.durationMin}min · {q.questionCount} questions · {q.totalMarks} marks
                    {q.passMarks > 0 && <> · pass {q.passMarks}</>}
                    {q.maxAttempts > 1 && <> · attempt {Math.min(q.attemptsUsed + (resumable ? 0 : 1), q.maxAttempts)} of {q.maxAttempts}</>}
                    {q.closed && <> · <span style={{ color: 'var(--danger,#c0392b)' }}>closed</span></>}
                  </div>
                </div>
                {scored && <span className="badge" style={{ background: at.passed === false ? 'var(--danger-bg,#fce8e8)' : 'var(--success-bg,#e6f4ea)', color: at.passed === false ? 'var(--danger,#c0392b)' : 'var(--success,#1e874b)' }}>
                  {at.passed === false ? 'Fail' : at.passed === true ? 'Pass' : ''} {at.totalScore ?? at.autoScore}/{q.totalMarks}
                </span>}
                {at?.needsGrading && <span className="badge" style={{ background: 'var(--gold-bg,#fdf2e2)', color: 'var(--gold,#c67c1e)' }}>Awaiting grade</span>}
                {q.canStart && <button className="btn-primary" style={{ height: 32, fontSize: 12.5, background: accent }} onClick={() => setQuiz(q)}>
                  {resumable ? 'Resume' : q.attemptsUsed > 0 ? 'Retake' : 'Start'}
                </button>}
                {!q.canStart && !at && <span className="badge" style={{ background: 'var(--surface-2)', color: 'var(--ink-3)' }}>Closed</span>}
              </div>
            );
          })}
        </div>
      )}
      {submitFor && <SubmitModal assignment={submitFor} accent={accent} onClose={() => setSubmitFor(null)} onDone={() => { setSubmitFor(null); load(); }} />}
      {quiz && <QuizRunner quiz={quiz} accent={accent} onClose={() => setQuiz(null)} onDone={() => { setQuiz(null); load(); }} />}
    </div>
  );
}
function SubmitModal({ assignment, accent, onClose, onDone }: { assignment: any; accent: string; onClose: () => void; onDone: () => void }) {
  const [text, setText] = useState('');
  const [busy, setBusy] = useState(false);
  const submit = async () => { setBusy(true); try { await portalApi(`/portal/me/assignments/${assignment.id}/submit`, { method: 'POST', body: JSON.stringify({ text }) }); onDone(); } catch { setBusy(false); } };
  return (
    <PortalOverlay title={assignment.title} onClose={onClose}>
      {assignment.instructions && <div style={{ fontSize: 12.5, color: 'var(--ink-3)', marginBottom: 12 }}>{assignment.instructions}</div>}
      <label className="label">Your submission</label>
      <textarea className="input" rows={6} style={{ resize: 'vertical', width: '100%' }} value={text} onChange={(e) => setText(e.target.value)} placeholder="Paste your work or a link…" />
      <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10, marginTop: 16 }}><button className="btn-secondary" onClick={onClose}>Cancel</button><button className="btn-primary" style={{ background: accent }} disabled={!text || busy} onClick={submit}>{busy ? 'Submitting…' : 'Submit'}</button></div>
    </PortalOverlay>
  );
}
/** correctAnswer is stored pipe-encoded ("9.81|0.05", "paris|city of paris") — never show that raw. */
function fmtKey(type: string, raw?: string | null) {
  const parts = String(raw ?? '').split('|').map((s) => s.trim()).filter(Boolean);
  if (!parts.length) return '—';
  if (type === 'NUMERIC') return parts[1] ? `${parts[0]} (± ${parts[1]})` : parts[0];
  return parts.join(' or ');
}
function QuizRunner({ quiz, accent, onClose, onDone }: { quiz: any; accent: string; onClose: () => void; onDone: () => void }) {
  const [data, setData] = useState<any>(null);
  const [answers, setAnswers] = useState<Record<string, any>>({});
  const [left, setLeft] = useState(0);
  const [result, setResult] = useState<any>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [confirmGaps, setConfirmGaps] = useState(false);
  // The countdown's submit() closure is created once per data/result change, so it would
  // otherwise capture an empty `answers` and hand in a blank paper at time-up.
  const answersRef = useRef<Record<string, any>>({});
  answersRef.current = answers;

  useEffect(() => {
    portalApi(`/portal/me/assessments/${quiz.id}/start`, { method: 'POST' })
      .then((d) => {
        setData(d);
        // Resuming: the clock keeps running from when the attempt was first started.
        const elapsed = Math.floor((Date.now() - new Date(d.startedAt).getTime()) / 1000);
        setLeft(Math.max(0, d.durationMin * 60 - elapsed));
      })
      .catch((e: any) => setError(e?.message || 'Could not start this quiz.'));
  }, []); // eslint-disable-line
  useEffect(() => { if (!data || result) return; const t = setInterval(() => setLeft((x) => { if (x <= 1) { clearInterval(t); submit(true); return 0; } return x - 1; }), 1000); return () => clearInterval(t); }, [data, result]); // eslint-disable-line

  const isBlank = (v: any) => v == null || v === '' || (Array.isArray(v) && v.length === 0);
  const answered = data ? data.questions.filter((q: any) => !isBlank(answers[q.id])).length : 0;
  const unanswered = data ? data.questions.length - answered : 0;

  const submit = async (auto = false) => {
    if (busy || result) return;
    if (!auto && unanswered > 0 && !confirmGaps) { setConfirmGaps(true); return; }
    setBusy(true);
    try {
      const r = await portalApi(`/portal/me/assessments/${quiz.id}/submit`, {
        method: 'POST',
        body: JSON.stringify({ answers: data.questions.map((q: any) => ({ questionId: q.id, answer: answersRef.current[q.id] ?? null })) }),
      });
      setResult(r);
    } catch (e: any) { setError(e?.message || 'Could not submit.'); } finally { setBusy(false); }
  };
  const mmss = (s: number) => `${String(Math.floor(s / 60)).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`;
  const toggleMulti = (qid: string, i: number) => setAnswers((a) => {
    const cur: number[] = Array.isArray(a[qid]) ? a[qid] : [];
    return { ...a, [qid]: cur.includes(i) ? cur.filter((x) => x !== i) : [...cur, i] };
  });

  if (error && !data) return (
    <PortalOverlay title={quiz.title} onClose={onClose}>
      <div style={{ padding: '16px 0', textAlign: 'center' }}>
        <div style={{ fontSize: 13.5, color: 'var(--danger,#c0392b)' }}>{error}</div>
        <button className="btn-primary" style={{ marginTop: 16, width: '100%', background: accent }} onClick={onClose}>Close</button>
      </div>
    </PortalOverlay>
  );
  if (!data) return <PortalOverlay title="Loading…" onClose={onClose}><div style={{ padding: 20, textAlign: 'center', color: 'var(--ink-3)' }}>Starting quiz…</div></PortalOverlay>;

  if (result) {
    const pct = result.totalMarks ? Math.round(((result.totalScore ?? result.autoScore) / result.totalMarks) * 100) : 0;
    const passed = result.passed;
    const reviewBy = new Map<string, any>((result.review ?? []).map((r: any) => [r.questionId, r]));
    const scoreBy = new Map<string, any>((result.perQuestion ?? []).map((p: any) => [p.questionId, p]));
    return (
      <PortalOverlay title="Your result" onClose={onDone}>
        <div style={{ textAlign: 'center', padding: '10px 0 4px' }}>
          {result.needsGrading ? (
            <>
              <div style={{ fontSize: 15, fontWeight: 700 }}>Submitted for grading</div>
              <div style={{ fontSize: 13, color: 'var(--ink-3)', marginTop: 6 }}>Objective score {result.autoScore}/{result.totalMarks}. Your written answers will be marked by your lecturer.</div>
            </>
          ) : (
            <>
              <div style={{ fontSize: 34, fontWeight: 800, color: passed === false ? 'var(--danger,#c0392b)' : accent }}>{result.totalScore ?? result.autoScore}<span style={{ fontSize: 18, color: 'var(--ink-3)' }}>/{result.totalMarks}</span></div>
              <div style={{ fontSize: 13, color: 'var(--ink-3)', marginTop: 2 }}>{pct}%{result.passMarks > 0 && <> · pass mark {result.passMarks}</>}</div>
              {passed != null && (
                <div style={{ display: 'inline-block', marginTop: 9, padding: '4px 14px', borderRadius: 20, fontSize: 12.5, fontWeight: 700, background: passed ? 'var(--success-bg,#e6f4ea)' : 'var(--danger-bg,#fce8e8)', color: passed ? 'var(--success,#1e874b)' : 'var(--danger,#c0392b)' }}>
                  {passed ? 'Passed' : 'Not passed'}
                </div>
              )}
              {result.maxAttempts > result.attemptNo && <div style={{ fontSize: 12, color: 'var(--ink-3)', marginTop: 8 }}>You have {result.maxAttempts - result.attemptNo} attempt{result.maxAttempts - result.attemptNo > 1 ? 's' : ''} left.</div>}
            </>
          )}
        </div>

        {result.lateSubmit && <div style={{ fontSize: 12, color: 'var(--gold,#c67c1e)', background: 'var(--gold-bg,#fdf2e2)', borderRadius: 8, padding: '8px 10px', marginTop: 12 }}>This paper was handed in after its time was up, and has been flagged for your lecturer.</div>}
        {!result.review && result.showAnswers && !result.needsGrading && (
          <div style={{ fontSize: 12, color: 'var(--ink-3)', textAlign: 'center', marginTop: 12 }}>The answers are revealed once you've used your final attempt.</div>
        )}
        {result.review && (
          <div style={{ marginTop: 16, borderTop: '1px solid var(--line-soft)', paddingTop: 14 }}>
            <div style={{ fontWeight: 700, fontSize: 13.5, marginBottom: 10 }}>Review</div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12, maxHeight: '42vh', overflowY: 'auto' }}>
              {data.questions.map((q: any, i: number) => {
                const rev = reviewBy.get(q.id); const sc = scoreBy.get(q.id);
                if (!rev) return null;
                const mine = answers[q.id];
                const opts: any[] = rev.options ?? [];
                const label = (v: any) => Array.isArray(v) ? v.map((x) => opts[x]?.text ?? x).join(', ') : (opts[v]?.text ?? String(v ?? ''));
                return (
                  <div key={q.id} style={{ background: 'var(--surface-2)', borderRadius: 10, padding: '10px 12px' }}>
                    <div style={{ display: 'flex', gap: 7, alignItems: 'flex-start' }}>
                      <span style={{ fontSize: 12.5, fontWeight: 700, color: 'var(--ink-3)' }}>{i + 1}.</span>
                      <div style={{ flex: 1, fontSize: 13, fontWeight: 600 }}>{q.text}</div>
                      {sc?.needsGrading
                        ? <span style={{ fontSize: 11.5, color: 'var(--gold,#c67c1e)', whiteSpace: 'nowrap' }}>to be marked</span>
                        : <span style={{ fontSize: 11.5, fontWeight: 700, whiteSpace: 'nowrap', color: sc?.correct ? 'var(--success,#1e874b)' : 'var(--danger,#c0392b)' }}>{sc?.score ?? 0}/{q.marks}</span>}
                    </div>
                    {!sc?.needsGrading && (
                      <div style={{ fontSize: 12, marginTop: 6, display: 'flex', flexDirection: 'column', gap: 3 }}>
                        <div style={{ color: 'var(--ink-2)' }}>Your answer: <b>{isBlank(mine) ? '—' : label(mine)}</b></div>
                        {!sc?.correct && (
                          <div style={{ color: 'var(--success,#1e874b)' }}>
                            Correct: <b>{opts.length ? opts.filter((o) => o.correct).map((o) => o.text).join(', ') : fmtKey(rev.type, rev.correctAnswer)}</b>
                          </div>
                        )}
                      </div>
                    )}
                    {rev.explanation && <div style={{ fontSize: 11.5, color: 'var(--ink-3)', marginTop: 6, fontStyle: 'italic' }}>{rev.explanation}</div>}
                  </div>
                );
              })}
            </div>
          </div>
        )}
        <button className="btn-primary" style={{ marginTop: 16, width: '100%', background: accent }} onClick={onDone}>Done</button>
      </PortalOverlay>
    );
  }

  const low = left < 60;
  return (
    <PortalOverlay title={data.title} onClose={onClose} headerRight={<span style={{ fontWeight: 800, fontFamily: 'var(--mono)', color: low ? 'var(--danger,#c0392b)' : 'var(--ink-1)' }}>⏱ {mmss(left)}</span>}>
      {data.instructions && <div style={{ fontSize: 12.5, color: 'var(--ink-3)', marginBottom: 10 }}>{data.instructions}</div>}
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 12 }}>
        <div style={{ flex: 1, height: 5, borderRadius: 4, background: 'var(--surface-2)', overflow: 'hidden' }}>
          <div style={{ width: `${data.questions.length ? (answered / data.questions.length) * 100 : 0}%`, height: '100%', background: accent, transition: 'width .2s' }} />
        </div>
        <span style={{ fontSize: 11.5, color: 'var(--ink-3)', whiteSpace: 'nowrap' }}>{answered}/{data.questions.length} answered</span>
      </div>
      {data.negativeMarkPct > 0 && <div style={{ fontSize: 11.5, color: 'var(--gold,#c67c1e)', marginBottom: 10 }}>Negative marking: a wrong answer loses {data.negativeMarkPct}% of that question's marks. Leaving it blank costs nothing.</div>}

      <div style={{ display: 'flex', flexDirection: 'column', gap: 16, maxHeight: '55vh', overflowY: 'auto' }}>
        {data.questions.map((q: any, i: number) => (
          <div key={q.id}>
            <div style={{ fontWeight: 600, fontSize: 13.5 }}>
              {i + 1}. {q.text} <span style={{ color: 'var(--ink-3)', fontWeight: 400 }}>({q.marks} mk)</span>
              {q.type === 'MULTI' && <span style={{ color: 'var(--ink-3)', fontWeight: 400, fontSize: 12 }}> — select all that apply</span>}
            </div>
            {(q.type === 'MCQ' || q.type === 'TRUE_FALSE') && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 5, marginTop: 6 }}>
                {/* o.i is the option's ORIGINAL index — the key the server grades against, so shuffling is safe. */}
                {q.options.map((o: any) => (
                  <label key={o.i} style={{ display: 'flex', alignItems: 'center', gap: 8, background: answers[q.id] === o.i ? `color-mix(in srgb, ${accent} 10%, var(--surface))` : 'var(--surface-2)', borderRadius: 8, padding: '8px 11px', cursor: 'pointer', fontSize: 13 }}>
                    <input type="radio" name={q.id} checked={answers[q.id] === o.i} onChange={() => setAnswers((a) => ({ ...a, [q.id]: o.i }))} /> {o.text}
                  </label>
                ))}
              </div>
            )}
            {q.type === 'MULTI' && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 5, marginTop: 6 }}>
                {q.options.map((o: any) => {
                  const on = Array.isArray(answers[q.id]) && answers[q.id].includes(o.i);
                  return (
                    <label key={o.i} style={{ display: 'flex', alignItems: 'center', gap: 8, background: on ? `color-mix(in srgb, ${accent} 10%, var(--surface))` : 'var(--surface-2)', borderRadius: 8, padding: '8px 11px', cursor: 'pointer', fontSize: 13 }}>
                      <input type="checkbox" checked={on} onChange={() => toggleMulti(q.id, o.i)} /> {o.text}
                    </label>
                  );
                })}
              </div>
            )}
            {q.type === 'NUMERIC' && (
              <input className="input" type="number" step="any" style={{ width: '100%', marginTop: 6 }} value={answers[q.id] ?? ''} onChange={(e) => setAnswers((a) => ({ ...a, [q.id]: e.target.value }))} placeholder="Enter a number…" />
            )}
            {(q.type === 'SHORT' || q.type === 'LONG') && (
              <textarea className="input" rows={q.type === 'LONG' ? 5 : 2} style={{ resize: 'vertical', width: '100%', marginTop: 6 }} value={answers[q.id] ?? ''} onChange={(e) => setAnswers((a) => ({ ...a, [q.id]: e.target.value }))} placeholder="Your answer…" />
            )}
          </div>
        ))}
      </div>

      {error && <div style={{ fontSize: 12.5, color: 'var(--danger,#c0392b)', marginTop: 12 }}>{error}</div>}
      {confirmGaps && unanswered > 0 && (
        <div style={{ fontSize: 12.5, color: 'var(--gold,#c67c1e)', background: 'var(--gold-bg,#fdf2e2)', borderRadius: 8, padding: '9px 11px', marginTop: 12 }}>
          {unanswered} question{unanswered > 1 ? 's are' : ' is'} still unanswered. Press submit again to hand in anyway.
        </div>
      )}
      <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10, marginTop: 16 }}>
        <button className="btn-primary" style={{ background: accent }} disabled={busy} onClick={() => submit()}>{busy ? 'Submitting…' : 'Submit quiz'}</button>
      </div>
    </PortalOverlay>
  );
}
function PortalOverlay({ title, children, onClose, headerRight }: { title: string; children: React.ReactNode; onClose: () => void; headerRight?: React.ReactNode }) {
  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 60, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }}>
      <div style={{ position: 'absolute', inset: 0, background: 'rgba(20,15,12,.5)' }} onClick={onClose} />
      <div style={{ ...card, position: 'relative', zIndex: 1, width: 560, maxWidth: '100%', maxHeight: '92vh', overflowY: 'auto', padding: 22, borderRadius: 18 }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14, gap: 10 }}><div style={{ fontWeight: 700, fontSize: 15 }}>{title}</div><div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>{headerRight}<button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--ink-3)' }}>✕</button></div></div>
        {children}
      </div>
    </div>
  );
}

// Student portal — grades: report cards + transcript (Sprint 20)
function PortalGrades({ accent, path = '/portal/me/report-cards' }: { accent: string; path?: string }) {
  const [d, setD] = useState<any>(null);
  const [view, setView] = useState<any>(null);
  useEffect(() => { portalApi(path).then(setD).catch(() => setD({ cards: [], transcript: [] })); }, [path]);
  const col = (p: number) => p < 40 ? 'var(--danger,#c0392b)' : p < 60 ? 'var(--gold,#c67c1e)' : 'var(--success,#1e874b)';
  if (!d) return <div style={{ padding: 40, textAlign: 'center', color: 'var(--ink-3)' }}>Loading…</div>;
  if (!d.cards.length) return <div style={{ color: 'var(--ink-3)', fontSize: 13 }}>No published report cards yet.</div>;
  return (
    <div>
      {d.transcript.length > 1 && (
        <div style={{ marginBottom: 18 }}>
          <div style={{ fontSize: 11, letterSpacing: '.08em', textTransform: 'uppercase', color: 'var(--ink-3)', fontWeight: 700, marginBottom: 8 }}>Transcript</div>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>{d.transcript.map((t: any, i: number) => <div key={i} style={{ background: 'var(--surface-2)', borderRadius: 10, padding: '8px 14px' }}><div style={{ fontSize: 11.5, color: 'var(--ink-3)' }}>{t.term}</div><div style={{ fontWeight: 700 }}>{t.overallPct}% <span style={{ color: col(t.overallPct) }}>{t.grade}</span></div></div>)}</div>
        </div>
      )}
      <div style={{ fontSize: 11, letterSpacing: '.08em', textTransform: 'uppercase', color: 'var(--ink-3)', fontWeight: 700, marginBottom: 8 }}>Report cards</div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        {d.cards.map((c: any) => (
          <div key={c.id} style={{ ...card, padding: 14, display: 'flex', alignItems: 'center', gap: 12 }}>
            <div style={{ flex: 1 }}><div style={{ fontWeight: 700, fontSize: 14 }}>{c.data?.term?.name}</div><div style={{ fontSize: 12, color: 'var(--ink-3)' }}>GPA {c.gpa} · {(c.data?.subjects || []).length} subjects</div></div>
            <div style={{ fontWeight: 800, fontSize: 16, color: col(c.overallPct) }}>{c.overallPct}%</div>
            <span className="badge" style={{ background: 'var(--surface-2)', color: col(c.overallPct) }}>{c.overallGrade}</span>
            <button className="btn-primary" style={{ height: 32, fontSize: 12.5, background: accent }} onClick={() => setView(c)}>View</button>
          </div>
        ))}
      </div>
      {view && <PortalReportCard card={view} accent={accent} onClose={() => setView(null)} />}
    </div>
  );
}
function PortalReportCard({ card, accent, onClose }: { card: any; accent: string; onClose: () => void }) {
  const subjects = card.data?.subjects ?? [];
  const col = (p: number) => p < 40 ? 'var(--danger,#c0392b)' : p < 60 ? 'var(--gold,#c67c1e)' : 'var(--success,#1e874b)';
  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 60, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }}>
      <div style={{ position: 'absolute', inset: 0, background: 'rgba(20,15,12,.5)' }} onClick={onClose} />
      <div style={{ background: 'var(--surface)', border: '1px solid var(--line-soft)', borderRadius: 16, position: 'relative', zIndex: 1, width: 620, maxWidth: '100%', maxHeight: '92vh', overflowY: 'auto', padding: 26 }}>
        <button onClick={onClose} style={{ position: 'absolute', top: 16, right: 16, background: 'none', border: 'none', cursor: 'pointer', color: 'var(--ink-3)' }}>✕</button>
        <div style={{ textAlign: 'center', marginBottom: 16 }}>
          <div style={{ fontWeight: 800, fontSize: 18 }}>Report Card — {card.data?.term?.name}</div>
          <div style={{ fontSize: 13, color: 'var(--ink-3)' }}>{card.data?.student?.name} · {card.data?.student?.admissionNo}</div>
        </div>
        <div style={{ display: 'flex', gap: 10, justifyContent: 'center', marginBottom: 16 }}>
          {[['Overall', card.overallPct + '%'], ['Grade', card.overallGrade], ['GPA', card.gpa]].map(([l, v]) => <div key={l as string} style={{ textAlign: 'center', background: 'var(--surface-2)', borderRadius: 12, padding: '10px 20px' }}><div style={{ fontWeight: 800, fontSize: 20, color: accent }}>{v}</div><div style={{ fontSize: 11, color: 'var(--ink-3)' }}>{l}</div></div>)}
        </div>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12.5 }}>
          <thead><tr><th style={{ textAlign: 'left', padding: '8px 8px', fontSize: 11, textTransform: 'uppercase', color: 'var(--ink-3)', borderBottom: '1px solid var(--line-soft)' }}>Subject</th>{subjects[0]?.components.map((c: any) => <th key={c.name} style={{ textAlign: 'center', padding: 8, fontSize: 10, color: 'var(--ink-3)', borderBottom: '1px solid var(--line-soft)' }}>{c.name.split(' ')[0]}</th>)}<th style={{ textAlign: 'center', padding: 8, fontSize: 11, color: 'var(--ink-3)', borderBottom: '1px solid var(--line-soft)' }}>%</th><th style={{ textAlign: 'center', padding: 8, fontSize: 11, color: 'var(--ink-3)', borderBottom: '1px solid var(--line-soft)' }}>Grade</th></tr></thead>
          <tbody>{subjects.map((s: any) => <tr key={s.subjectId}><td style={{ padding: 8, borderBottom: '1px solid var(--line-soft)' }}><b>{s.code}</b></td>{s.components.map((c: any) => <td key={c.name} style={{ textAlign: 'center', padding: 8, borderBottom: '1px solid var(--line-soft)' }}>{c.obtained}</td>)}<td style={{ textAlign: 'center', padding: 8, borderBottom: '1px solid var(--line-soft)', fontWeight: 700, color: col(s.percent) }}>{s.percent}</td><td style={{ textAlign: 'center', padding: 8, borderBottom: '1px solid var(--line-soft)' }}>{s.grade}</td></tr>)}</tbody>
        </table>
        <button className="btn-secondary" style={{ marginTop: 16, width: '100%' }} onClick={() => window.print()}>Print / Save PDF</button>
      </div>
    </div>
  );
}

// Student portal — fees: dues, invoices, pay online, receipts (Sprint 21)
function PortalFees({ accent, path = '/portal/me/fees', payPath = '/portal/me/fees/pay' }: { accent: string; path?: string; payPath?: string }) {
  const [d, setD] = useState<any>(null);
  const [paying, setPaying] = useState<string | null>(null);
  const money = (n: number) => '₹' + (n ?? 0).toLocaleString('en-IN');
  const load = () => portalApi(path).then(setD).catch(() => setD({ summary: {}, invoices: [] }));
  useEffect(() => { load(); }, [path]);
  // What the server said, per invoice. A refusal used to be swallowed and the list
  // reloaded unchanged, which read as a payment that had not shown up yet.
  const [note, setNote] = useState<Record<string, string>>({});
  const pay = async (inv: any) => {
    setPaying(inv.id);
    setNote((n) => { const next = { ...n }; delete next[inv.id]; return next; });
    try { await portalApi(payPath, { method: 'POST', body: JSON.stringify({ invoiceId: inv.id }) }); await load(); }
    catch (e) { setNote((n) => ({ ...n, [inv.id]: (e as Error)?.message || 'The payment did not go through. Nothing was recorded.' })); }
    finally { setPaying(null); }
  };
  const SM: Record<string, { bg: string; fg: string }> = { DUE: { bg: 'var(--surface-2)', fg: 'var(--ink-2)' }, PARTIAL: { bg: 'var(--gold-bg,#fdf2e2)', fg: 'var(--gold,#c67c1e)' }, PAID: { bg: 'var(--success-bg,#e6f4ea)', fg: 'var(--success,#1e874b)' }, OVERDUE: { bg: 'var(--danger-bg,#fce8e8)', fg: 'var(--danger,#c0392b)' } };
  if (!d) return <div style={{ padding: 40, textAlign: 'center', color: 'var(--ink-3)' }}>Loading…</div>;
  if (!d.invoices?.length) return <div style={{ color: 'var(--ink-3)', fontSize: 13 }}>No fee invoices yet.</div>;
  const s = d.summary;
  return (
    <div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 10, marginBottom: 18 }}>
        {[['Billed', s.totalBilled, 'var(--ink-1)'], ['Paid', s.totalPaid, 'var(--success,#1e874b)'], ['Due', s.totalDue, s.totalDue > 0 ? 'var(--danger,#c0392b)' : 'var(--ink-1)']].map(([l, v, c]) => (
          <div key={l as string} style={{ ...card, padding: 14, textAlign: 'center' }}><div style={{ fontSize: 18, fontWeight: 800, color: c as string }}>{money(v as number)}</div><div style={{ fontSize: 11.5, color: 'var(--ink-3)' }}>{l}</div></div>
        ))}
      </div>
      <div style={{ fontSize: 11, letterSpacing: '.08em', textTransform: 'uppercase', color: 'var(--ink-3)', fontWeight: 700, marginBottom: 8 }}>Invoices</div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        {d.invoices.map((inv: any) => {
          const m = SM[inv.status] ?? SM.DUE; const bal = inv.amountInr - inv.paidInr;
          return (
            <div key={inv.id} style={{ ...card, padding: 14 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <div style={{ flex: 1, minWidth: 0 }}><div style={{ fontWeight: 600, fontSize: 13.5 }}>{inv.title} <span style={{ fontFamily: 'var(--mono)', fontSize: 11, color: 'var(--ink-3)' }}>{inv.number}</span></div><div style={{ fontSize: 11.5, color: 'var(--ink-3)' }}>Due {inv.dueDate ? new Date(inv.dueDate).toLocaleDateString('en-IN') : '—'} · {money(inv.amountInr)}{inv.paidInr > 0 ? ` · paid ${money(inv.paidInr)}` : ''}</div></div>
                <span className="badge" style={{ background: m.bg, color: m.fg }}>{inv.status}</span>
                {inv.status !== 'PAID' && <button className="btn-primary" style={{ height: 32, fontSize: 12.5, background: accent }} disabled={paying === inv.id} onClick={() => pay(inv)}>{paying === inv.id ? 'Paying…' : `Pay ${money(bal)}`}</button>}
              </div>
              {note[inv.id] && <div role="status" style={{ marginTop: 8, fontSize: 12, color: 'var(--ink-3)' }}>{note[inv.id]}</div>}
              {inv.payments?.length > 0 && (
                <div style={{ marginTop: 8, display: 'flex', flexDirection: 'column', gap: 3 }}>
                  {inv.payments.map((p: any) => <div key={p.id} style={{ fontSize: 11.5, color: 'var(--ink-3)', display: 'flex', justifyContent: 'space-between' }}><span>🧾 {p.number} · {p.method}</span><span>{money(p.amountInr)}</span></div>)}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ============================ Lecturer portal (Sprint 23) ============================
const DAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
const lecCard: React.CSSProperties = { background: 'var(--surface-2)', borderRadius: 12, padding: '12px 14px' };
const attColors: Record<string, string> = { PRESENT: '#16a34a', ABSENT: '#dc2626', LATE: '#d97706', EXCUSED: '#0891b2' };

function LecSpinner() { return <div style={{ textAlign: 'center', padding: 40, color: 'var(--ink-3)' }}><Loader2 size={20} className="spin" /></div>; }
function LecHeader({ icon: Icon, title, sub, accent }: { icon: any; title: string; sub?: string; accent: string }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 16 }}>
      <span style={{ width: 34, height: 34, borderRadius: 9, background: 'color-mix(in srgb,' + accent + ' 14%, var(--surface))', color: accent, display: 'flex', alignItems: 'center', justifyContent: 'center' }}><Icon size={17} /></span>
      <div><div style={{ fontWeight: 700, fontSize: 16 }}>{title}</div>{sub && <div style={{ fontSize: 12.5, color: 'var(--ink-3)' }}>{sub}</div>}</div>
    </div>
  );
}

function LecturerDashboardCards({ accent, onGo }: { accent: string; onGo: (t: string) => void }) {
  const [d, setD] = useState<any>(null);
  useEffect(() => { portalApi('/portal/me/lecturer/dashboard').then(setD).catch(() => setD({ todayClasses: [], stats: {} })); }, []);
  if (!d) return null;
  const stats = [
    { label: 'Subjects', value: d.stats.subjects ?? 0, go: 'My Classes' },
    { label: 'Sections', value: d.stats.sections ?? 0, go: 'Timetable' },
    { label: 'Pending grading', value: d.stats.pendingGrading ?? 0, go: 'Grading' },
  ];
  return (
    <div style={{ marginBottom: 22 }}>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 10 }}>
        {stats.map((s) => (
          <button key={s.label} onClick={() => onGo(s.go)} style={{ ...lecCard, border: 'none', cursor: 'pointer', textAlign: 'left' }}>
            <div style={{ fontSize: 26, fontWeight: 800, color: accent }}>{s.value}</div>
            <div style={{ fontSize: 12.5, color: 'var(--ink-3)', fontWeight: 600 }}>{s.label}</div>
          </button>
        ))}
      </div>
      <div style={{ fontSize: 11, letterSpacing: '.08em', textTransform: 'uppercase', color: 'var(--ink-3)', fontWeight: 700, margin: '18px 0 8px' }}>Today's classes</div>
      {d.todayClasses.length === 0 ? (
        <div style={{ ...lecCard, color: 'var(--ink-3)', fontSize: 13 }}>No classes scheduled for today.</div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {d.todayClasses.map((c: any) => (
            <button key={c.timetableEntryId} onClick={() => onGo('Attendance')} style={{ ...lecCard, border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 10, textAlign: 'left' }}>
              <span style={{ fontWeight: 700, fontSize: 13, color: accent, minWidth: 54 }}>{c.subject.code}</span>
              <span style={{ flex: 1, fontSize: 13 }}>{c.subject.name} · Sec {c.section.name}</span>
              {c.slot && <span style={{ fontSize: 12, color: 'var(--ink-3)' }}>{c.slot.startTime}–{c.slot.endTime}</span>}
              <ChevronRight size={15} style={{ color: 'var(--ink-3)' }} />
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

function LecturerClasses({ accent }: { accent: string }) {
  const [subs, setSubs] = useState<any[] | null>(null);
  useEffect(() => { portalApi('/portal/me/lecturer/subjects').then(setSubs).catch(() => setSubs([])); }, []);
  if (!subs) return <LecSpinner />;
  return (
    <div>
      <LecHeader icon={Presentation} title="My classes" sub={`${subs.length} subject${subs.length === 1 ? '' : 's'} you teach`} accent={accent} />
      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        {subs.map((s) => (
          <div key={s.id} style={{ ...lecCard, display: 'flex', alignItems: 'center', gap: 12 }}>
            <span style={{ width: 42, height: 42, borderRadius: 11, background: accent, color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 800, fontSize: 12 }}>{s.code}</span>
            <div style={{ flex: 1 }}>
              <div style={{ fontWeight: 700, fontSize: 14 }}>{s.name}</div>
              <div style={{ fontSize: 12, color: 'var(--ink-3)' }}>{s.credits} credits</div>
            </div>
            <div style={{ display: 'flex', gap: 14, fontSize: 12, color: 'var(--ink-3)' }}>
              <span><b style={{ color: 'var(--ink-1)' }}>{s._count.lessons}</b> lessons</span>
              <span><b style={{ color: 'var(--ink-1)' }}>{s._count.materials}</b> materials</span>
              <span><b style={{ color: 'var(--ink-1)' }}>{s._count.lectures}</b> lectures</span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function LecturerTimetable({ accent }: { accent: string }) {
  const [rows, setRows] = useState<any[] | null>(null);
  useEffect(() => { portalApi('/portal/me/lecturer/timetable').then(setRows).catch(() => setRows([])); }, []);
  if (!rows) return <LecSpinner />;
  const byDay: Record<number, any[]> = {};
  rows.forEach((r) => { (byDay[r.dayOfWeek] ??= []).push(r); });
  return (
    <div>
      <LecHeader icon={CalendarDays} title="Weekly timetable" sub={`${rows.length} periods`} accent={accent} />
      <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
        {DAYS.map((day, i) => (byDay[i]?.length ? (
          <div key={day}>
            <div style={{ fontSize: 11, letterSpacing: '.08em', textTransform: 'uppercase', color: 'var(--ink-3)', fontWeight: 700, marginBottom: 6 }}>{day}</div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              {byDay[i].map((r) => (
                <div key={r.id} style={{ ...lecCard, display: 'flex', alignItems: 'center', gap: 10, padding: '10px 12px' }}>
                  <span style={{ fontSize: 12, color: 'var(--ink-3)', minWidth: 96 }}>{r.timeSlot ? `${r.timeSlot.startTime}–${r.timeSlot.endTime}` : '—'}</span>
                  <span style={{ fontWeight: 700, fontSize: 13, color: accent, minWidth: 52 }}>{r.subject.code}</span>
                  <span style={{ flex: 1, fontSize: 13 }}>{r.subject.name}</span>
                  <span style={{ fontSize: 12, color: 'var(--ink-3)' }}>Sec {r.section.name}{r.room ? ` · ${r.room.name}` : ''}</span>
                </div>
              ))}
            </div>
          </div>
        ) : null))}
      </div>
    </div>
  );
}

function LecturerAttendance({ accent }: { accent: string }) {
  const today = new Date().toISOString().slice(0, 10);
  const [date, setDate] = useState(today);
  const [data, setData] = useState<any>(null);
  const [session, setSession] = useState<any>(null);
  const [marks, setMarks] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);
  const load = (dt: string) => { setData(null); setSession(null); portalApi(`/portal/me/lecturer/attendance?date=${dt}`).then(setData).catch(() => setData({ classes: [] })); };
  useEffect(() => { load(date); }, [date]);

  const open = async (timetableEntryId: string) => {
    setBusy(true);
    try {
      const s = await portalApi<any>('/portal/me/lecturer/attendance/open', { method: 'POST', body: JSON.stringify({ timetableEntryId, date }) });
      setSession(s);
      const init: Record<string, string> = {};
      s.roster.forEach((r: any) => { init[r.id] = r.status ?? 'PRESENT'; });
      setMarks(init);
    } finally { setBusy(false); }
  };
  const save = async () => {
    setBusy(true);
    try {
      await portalApi(`/portal/me/lecturer/attendance/${session.session.id}/mark`, { method: 'POST', body: JSON.stringify({ records: Object.entries(marks).map(([studentId, status]) => ({ studentId, status })) }) });
      setSession(null); load(date);
    } finally { setBusy(false); }
  };

  if (session) {
    const present = Object.values(marks).filter((s) => s === 'PRESENT').length;
    return (
      <div>
        <LecHeader icon={ClipboardCheck} title={`${session.class.subject.code} · Sec ${session.class.section.name}`} sub={`${date} · ${present}/${session.roster.length} present`} accent={accent} />
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          {session.roster.map((st: any) => (
            <div key={st.id} style={{ ...lecCard, display: 'flex', alignItems: 'center', gap: 10, padding: '9px 12px' }}>
              <span style={{ flex: 1, fontSize: 13.5, fontWeight: 600 }}>{st.firstName} {st.lastName ?? ''} <span style={{ color: 'var(--ink-3)', fontWeight: 400, fontSize: 12 }}>{st.admissionNo}</span></span>
              <div style={{ display: 'flex', gap: 4 }}>
                {['PRESENT', 'ABSENT', 'LATE'].map((s) => (
                  <button key={s} onClick={() => setMarks((m) => ({ ...m, [st.id]: s }))} style={{
                    border: 'none', cursor: 'pointer', borderRadius: 7, padding: '5px 10px', fontSize: 11.5, fontWeight: 700,
                    background: marks[st.id] === s ? attColors[s] : 'var(--surface)', color: marks[st.id] === s ? '#fff' : 'var(--ink-3)',
                  }}>{s[0]}</button>
                ))}
              </div>
            </div>
          ))}
        </div>
        <div style={{ display: 'flex', gap: 8, marginTop: 16 }}>
          <button className="btn-secondary" onClick={() => setSession(null)} disabled={busy}>Cancel</button>
          <button className="btn-primary" onClick={save} disabled={busy} style={{ background: accent }}>{busy ? <Loader2 size={14} className="spin" /> : <Check size={14} />} Save attendance</button>
        </div>
      </div>
    );
  }

  return (
    <div>
      <LecHeader icon={ClipboardCheck} title="Mark attendance" sub="Pick a class to open its register" accent={accent} />
      <input type="date" value={date} onChange={(e) => setDate(e.target.value)} style={{ marginBottom: 14, padding: '7px 10px', borderRadius: 8, border: '1px solid var(--line-soft)', background: 'var(--surface)', fontSize: 13 }} />
      {!data ? <LecSpinner /> : data.classes.length === 0 ? (
        <div style={{ ...lecCard, color: 'var(--ink-3)', fontSize: 13 }}>No classes scheduled on this day.</div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {data.classes.map((c: any) => (
            <div key={c.timetableEntryId} style={{ ...lecCard, display: 'flex', alignItems: 'center', gap: 10 }}>
              <span style={{ fontWeight: 700, fontSize: 13, color: accent, minWidth: 52 }}>{c.subject.code}</span>
              <span style={{ flex: 1, fontSize: 13 }}>{c.subject.name} · Sec {c.section.name}{c.slot ? ` · ${c.slot.startTime}–${c.slot.endTime}` : ''}</span>
              <span className="badge" style={{ background: c.status === 'MARKED' ? 'color-mix(in srgb,#16a34a 14%, var(--surface))' : 'var(--surface)', color: c.status === 'MARKED' ? '#16a34a' : 'var(--ink-3)' }}>{c.status === 'MARKED' ? `Marked (${c.markedCount})` : 'Not marked'}</span>
              <button className="btn-secondary" style={{ height: 32 }} onClick={() => open(c.timetableEntryId)} disabled={busy}>{c.status === 'MARKED' ? 'Edit' : 'Open'}</button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function LecturerMaterials({ accent }: { accent: string }) {
  const [subs, setSubs] = useState<any[] | null>(null);
  const [mode, setMode] = useState<'material' | 'lecture'>('material');
  const [f, setF] = useState<any>({ subjectId: '', title: '', url: '', scheduledAt: '', joinUrl: '' });
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState('');
  const [uploading, setUploading] = useState<string | null>(null); // status text while an asset processes
  const [assetId, setAssetId] = useState<string | null>(null);     // READY asset waiting to be attached
  const [assetKind, setAssetKind] = useState<string | null>(null);
  const [capState, setCapState] = useState<string | null>(null);   // captions attach status
  const [usage, setUsage] = useState<any>(null);
  const fileInput = useRef<HTMLInputElement>(null);
  const capInput = useRef<HTMLInputElement>(null);
  const loadUsage = () => portalApi('/portal/me/media/usage').then(setUsage).catch(() => {});
  const reload = () => portalApi('/portal/me/lecturer/subjects').then((s: any) => { setSubs(s); setF((p: any) => ({ ...p, subjectId: p.subjectId || s[0]?.id || '' })); }).catch(() => setSubs([]));
  useEffect(() => { reload(); loadUsage(); }, []);

  const uploadCaptions = async (file: File) => {
    if (!assetId) return;
    setCapState('Uploading captions…');
    try {
      const token = getPortalSession()?.token;
      const fd = new FormData(); fd.append('file', file);
      const res = await fetch(`/api/portal/me/media/${assetId}/captions`, { method: 'POST', headers: { Authorization: `Bearer ${token}` }, body: fd });
      if (!res.ok) throw new Error((await res.json().catch(() => ({})))?.message || 'Captions upload failed');
      setCapState('✓ Captions attached'); toast.success('Captions attached');
    } catch (e: any) { setCapState(null); toast.error(e?.message || 'Captions upload failed'); }
  };

  const uploadFile = async (file: File) => {
    setUploading('Uploading…'); setAssetId(null);
    try {
      const token = getPortalSession()?.token;
      const fd = new FormData(); fd.append('file', file);
      const res = await fetch('/api/portal/me/media/upload', { method: 'POST', headers: { Authorization: `Bearer ${token}` }, body: fd });
      if (!res.ok) throw new Error('Upload failed');
      const asset = await res.json();
      setUploading('Processing (transcoding)…');
      // poll until READY
      for (let i = 0; i < 90; i++) {
        await new Promise((r) => setTimeout(r, 2000));
        const a = await portalApi<any>(`/portal/me/media/${asset.id}`);
        if (a.status === 'READY') { setAssetId(a.id); setAssetKind(a.kind); setCapState(null); setUploading(null); loadUsage(); if (!f.title) setF((p: any) => ({ ...p, title: file.name.replace(/\.[^.]+$/, '') })); toast.success('Processed — ready to publish'); return; }
        if (a.status === 'FAILED') throw new Error(a.error || 'Processing failed');
      }
      throw new Error('Processing timed out');
    } catch (e: any) { setUploading(null); toast.error(e?.message || 'Upload failed'); }
  };

  if (!subs) return <LecSpinner />;

  const submit = async () => {
    setBusy(true); setMsg('');
    try {
      if (mode === 'material') { await portalApi('/portal/me/lecturer/materials', { method: 'POST', body: JSON.stringify({ subjectId: f.subjectId, title: f.title, url: f.url || undefined, mediaAssetId: assetId || undefined }) }); setMsg('Material added ✓'); setAssetId(null); setAssetKind(null); setCapState(null); loadUsage(); }
      else { await portalApi('/portal/me/lecturer/lectures', { method: 'POST', body: JSON.stringify({ subjectId: f.subjectId, title: f.title, scheduledAt: new Date(f.scheduledAt).toISOString(), joinUrl: f.joinUrl || undefined }) }); setMsg('Lecture scheduled ✓'); }
      setF((p: any) => ({ ...p, title: '', url: '', scheduledAt: '', joinUrl: '' })); reload();
    } catch { setMsg('Something went wrong'); } finally { setBusy(false); }
  };
  const inp: React.CSSProperties = { width: '100%', padding: '9px 11px', borderRadius: 9, border: '1px solid var(--line-soft)', background: 'var(--surface)', fontSize: 13, marginTop: 8 };
  const canSubmit = f.subjectId && f.title && (mode === 'material' ? (f.url || assetId) : f.scheduledAt);

  return (
    <div>
      <LecHeader icon={BookOpen} title="Publish content" sub="Add materials or schedule live lectures for your subjects" accent={accent} />
      <div style={{ display: 'inline-flex', background: 'var(--surface-2)', borderRadius: 10, padding: 4, marginBottom: 4 }}>
        {(['material', 'lecture'] as const).map((t) => (
          <button key={t} onClick={() => { setMode(t); setMsg(''); }} style={{ border: 'none', cursor: 'pointer', borderRadius: 8, padding: '7px 16px', fontSize: 13, fontWeight: 600, background: mode === t ? 'var(--surface)' : 'transparent', color: mode === t ? accent : 'var(--ink-3)' }}>{t === 'material' ? 'Material' : 'Live lecture'}</button>
        ))}
      </div>
      <select value={f.subjectId} onChange={(e) => setF({ ...f, subjectId: e.target.value })} style={inp}>
        {subs.map((s) => <option key={s.id} value={s.id}>{s.code} — {s.name}</option>)}
      </select>
      <input placeholder="Title" value={f.title} onChange={(e) => setF({ ...f, title: e.target.value })} style={inp} />
      {mode === 'material' && usage && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, margin: '8px 2px 0', fontSize: 11.5, color: 'var(--ink-3)' }}>
          <HardDrive size={12} />
          <div style={{ flex: 1, height: 6, borderRadius: 99, background: 'var(--surface-2)', overflow: 'hidden' }}>
            <div style={{ width: `${Math.min(100, usage.usedPct)}%`, height: '100%', background: usage.usedPct >= 90 ? 'var(--danger,#c0392b)' : accent }} />
          </div>
          <span style={{ fontVariantNumeric: 'tabular-nums' }}>{(usage.usedBytes / 1073741824).toFixed(1)} / {(usage.capBytes / 1073741824).toFixed(0)} GB · {usage.plan}</span>
        </div>
      )}
      {mode === 'material' ? (
        <>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 8 }}>
            <button className="btn-secondary" style={{ height: 34, fontSize: 12.5 }} disabled={!!uploading} onClick={() => fileInput.current?.click()}>
              {uploading ? <Loader2 size={13} className="spin" /> : <Video size={13} />} {uploading ?? (assetId ? 'Replace file' : 'Upload video / PDF / slides…')}
            </button>
            {assetId && <span className="badge" style={{ background: 'var(--success-bg,#e6f4ea)', color: 'var(--success,#1e874b)' }}>✓ Processed & attached</span>}
            <input ref={fileInput} type="file" accept="video/*,audio/*,application/pdf,image/*,.ppt,.pptx,.doc,.docx,.md" style={{ display: 'none' }} onChange={(e) => { const file = e.target.files?.[0]; if (file) uploadFile(file); e.target.value = ''; }} />
          </div>
          {assetId && (assetKind === 'VIDEO' || assetKind === 'AUDIO') && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 8 }}>
              <button className="btn-secondary" style={{ height: 30, fontSize: 12 }} onClick={() => capInput.current?.click()}><Captions size={12} /> {capState ?? 'Add captions (.vtt)'}</button>
              <input ref={capInput} type="file" accept=".vtt,text/vtt" style={{ display: 'none' }} onChange={(e) => { const file = e.target.files?.[0]; if (file) uploadCaptions(file); e.target.value = ''; }} />
            </div>
          )}
          <div style={{ fontSize: 11, color: 'var(--ink-3)', margin: '6px 2px 0' }}>or paste a link</div>
          <input placeholder="Resource URL (optional when a file is uploaded)" value={f.url} onChange={(e) => setF({ ...f, url: e.target.value })} style={inp} />
        </>
      ) : (
        <>
          <input type="datetime-local" value={f.scheduledAt} onChange={(e) => setF({ ...f, scheduledAt: e.target.value })} style={inp} />
          <input placeholder="Join URL (Zoom / Meet / Teams) — optional" value={f.joinUrl} onChange={(e) => setF({ ...f, joinUrl: e.target.value })} style={inp} />
        </>
      )}
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginTop: 14 }}>
        <button className="btn-primary" onClick={submit} disabled={busy || !canSubmit} style={{ background: accent }}>{busy ? <Loader2 size={14} className="spin" /> : mode === 'material' ? <Plus size={14} /> : <Video size={14} />} {mode === 'material' ? 'Add material' : 'Schedule lecture'}</button>
        {msg && <span style={{ fontSize: 13, color: msg.includes('✓') ? '#16a34a' : '#dc2626' }}>{msg}</span>}
      </div>
    </div>
  );
}

function LecturerGrading({ accent }: { accent: string }) {
  const [tab, setTab] = useState<'submissions' | 'quizzes'>('submissions');
  const [subs, setSubs] = useState<any[] | null>(null);
  const [attempts, setAttempts] = useState<any[] | null>(null);
  const [grading, setGrading] = useState<any>(null);
  const [marks, setMarks] = useState('');
  const [essayMarks, setEssayMarks] = useState<Record<string, string>>({});
  const [feedback, setFeedback] = useState('');
  const [busy, setBusy] = useState(false);
  const load = () => {
    portalApi('/portal/me/lecturer/submissions').then(setSubs).catch(() => setSubs([]));
    portalApi('/portal/me/lecturer/grading-queue').then(setAttempts).catch(() => setAttempts([]));
  };
  useEffect(() => { load(); }, []);

  const gradeSub = async (id: string) => {
    setBusy(true);
    try { await portalApi(`/portal/me/lecturer/submissions/${id}/grade`, { method: 'POST', body: JSON.stringify({ marks: Number(marks), feedback: feedback || undefined }) }); setGrading(null); setMarks(''); setFeedback(''); load(); }
    finally { setBusy(false); }
  };
  const gradeAttempt = async (a: any) => {
    setBusy(true);
    try {
      const grades = (a.toGrade ?? []).map((it: any) => ({ questionId: it.questionId, marks: Number(essayMarks[it.questionId]) || 0 }));
      await portalApi(`/portal/me/lecturer/attempts/${a.id}/grade`, { method: 'POST', body: JSON.stringify({ grades }) });
      setGrading(null); setEssayMarks({}); load();
    } finally { setBusy(false); }
  };

  return (
    <div>
      <LecHeader icon={ClipboardList} title="Grading" sub="Assignment submissions and quiz attempts awaiting marks" accent={accent} />
      <div style={{ display: 'inline-flex', background: 'var(--surface-2)', borderRadius: 10, padding: 4, marginBottom: 14 }}>
        {(['submissions', 'quizzes'] as const).map((t) => (
          <button key={t} onClick={() => setTab(t)} style={{ border: 'none', cursor: 'pointer', borderRadius: 8, padding: '7px 16px', fontSize: 13, fontWeight: 600, background: tab === t ? 'var(--surface)' : 'transparent', color: tab === t ? accent : 'var(--ink-3)' }}>
            {t === 'submissions' ? `Assignments${subs ? ` (${subs.length})` : ''}` : `Quizzes${attempts ? ` (${attempts.length})` : ''}`}
          </button>
        ))}
      </div>

      {tab === 'submissions' ? (
        !subs ? <LecSpinner /> : subs.length === 0 ? <div style={{ ...lecCard, color: 'var(--ink-3)', fontSize: 13 }}>Nothing to grade. 🎉</div> : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {subs.map((s) => (
              <div key={s.id} style={lecCard}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  <span style={{ fontWeight: 700, fontSize: 12, color: accent }}>{s.assignment.subject.code}</span>
                  <span style={{ flex: 1, fontSize: 13 }}>{s.student.firstName} {s.student.lastName ?? ''} · {s.assignment.title}</span>
                  <span style={{ fontSize: 12, color: 'var(--ink-3)' }}>/{s.assignment.maxMarks}</span>
                  <button className="btn-secondary" style={{ height: 30 }} onClick={() => { setGrading({ kind: 'sub', ...s }); setMarks(''); setFeedback(''); }}>Grade</button>
                </div>
                {grading?.kind === 'sub' && grading.id === s.id && (
                  <div style={{ marginTop: 10, display: 'flex', flexDirection: 'column', gap: 8 }}>
                    <input type="number" placeholder={`Marks (max ${s.assignment.maxMarks})`} value={marks} onChange={(e) => setMarks(e.target.value)} style={{ padding: '8px 10px', borderRadius: 8, border: '1px solid var(--line-soft)', background: 'var(--surface)', fontSize: 13 }} />
                    <textarea placeholder="Feedback (optional)" value={feedback} onChange={(e) => setFeedback(e.target.value)} rows={2} style={{ padding: '8px 10px', borderRadius: 8, border: '1px solid var(--line-soft)', background: 'var(--surface)', fontSize: 13, resize: 'vertical' }} />
                    <div style={{ display: 'flex', gap: 8 }}>
                      <button className="btn-secondary" style={{ height: 32 }} onClick={() => setGrading(null)}><X size={13} /> Cancel</button>
                      <button className="btn-primary" style={{ height: 32, background: accent }} disabled={busy || marks === ''} onClick={() => gradeSub(s.id)}>{busy ? <Loader2 size={13} className="spin" /> : <Send size={13} />} Submit grade</button>
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>
        )
      ) : (
        !attempts ? <LecSpinner /> : attempts.length === 0 ? <div style={{ ...lecCard, color: 'var(--ink-3)', fontSize: 13 }}>No quiz attempts need manual grading.</div> : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {attempts.map((a) => (
              <div key={a.id} style={lecCard}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  <span style={{ fontWeight: 700, fontSize: 12, color: accent }}>{a.assessment.subject.code}</span>
                  <span style={{ flex: 1, fontSize: 13 }}>{a.student.firstName} {a.student.lastName ?? ''} · {a.assessment.title}</span>
                  <span style={{ fontSize: 12, color: 'var(--ink-3)' }}>auto {a.autoScore}/{a.assessment.totalMarks}</span>
                  <button className="btn-secondary" style={{ height: 30 }} onClick={() => { setGrading({ kind: 'att', ...a }); setEssayMarks({}); }}>Grade</button>
                </div>
                {grading?.kind === 'att' && grading.id === a.id && (
                  <div style={{ marginTop: 10, display: 'flex', flexDirection: 'column', gap: 10 }}>
                    {(a.toGrade ?? []).length === 0 && <div style={{ fontSize: 12.5, color: 'var(--ink-3)' }}>No written answers on this attempt.</div>}
                    {(a.toGrade ?? []).map((it: any) => (
                      <div key={it.questionId} style={{ background: 'var(--surface-2)', borderRadius: 9, padding: '10px 12px' }}>
                        <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 6 }}>{it.text}</div>
                        <div style={{ fontSize: 12.5, color: 'var(--ink-2)', background: 'var(--surface)', borderRadius: 7, padding: '8px 10px', whiteSpace: 'pre-wrap', maxHeight: 150, overflow: 'auto' }}>
                          {String(it.answer ?? '').trim() || <span style={{ color: 'var(--ink-3)', fontStyle: 'italic' }}>Left blank</span>}
                        </div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 8 }}>
                          <input type="number" min={0} max={it.marks} step={1} placeholder="0" value={essayMarks[it.questionId] ?? ''} onChange={(e) => setEssayMarks((m) => ({ ...m, [it.questionId]: e.target.value }))} style={{ width: 90, padding: '7px 10px', borderRadius: 8, border: '1px solid var(--line-soft)', background: 'var(--surface)', fontSize: 13 }} />
                          <span style={{ fontSize: 12, color: 'var(--ink-3)' }}>out of {it.marks}</span>
                        </div>
                      </div>
                    ))}
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <span style={{ flex: 1, fontSize: 12.5, color: 'var(--ink-3)' }}>
                        Final: <b style={{ color: 'var(--ink-1)' }}>{a.autoScore + (a.toGrade ?? []).reduce((s: number, it: any) => s + (Number(essayMarks[it.questionId]) || 0), 0)}</b>/{a.assessment.totalMarks}
                      </span>
                      <button className="btn-secondary" style={{ height: 34 }} onClick={() => setGrading(null)}><X size={13} /></button>
                      <button className="btn-primary" style={{ height: 34, background: accent }} disabled={busy || (a.toGrade ?? []).some((it: any) => (Number(essayMarks[it.questionId]) || 0) > it.marks)} onClick={() => gradeAttempt(a)}>{busy ? <Loader2 size={13} className="spin" /> : <Send size={13} />} Finalize</button>
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>
        )
      )}
    </div>
  );
}

// ============================ Parent portal (Sprint 25) ============================
// Parents see each linked child's attendance, grades and fees — reusing the student
// views pointed at the guardian-scoped /portal/me/children/:id/* routes.
function ParentSection({ accent, tab }: { accent: string; tab: 'Attendance' | 'Grades' | 'Fees' }) {
  const [kids, setKids] = useState<any[] | null>(null);
  const [sel, setSel] = useState<string | null>(null);
  useEffect(() => { portalApi<any[]>('/portal/me/children').then((k) => { setKids(k); setSel((s) => s ?? k[0]?.id ?? null); }).catch(() => setKids([])); }, []);
  if (!kids) return <LecSpinner />;
  if (!kids.length) return <div style={{ ...lecCard, color: 'var(--ink-3)', fontSize: 13 }}>No children are linked to your account yet.</div>;
  const child = kids.find((k) => k.id === sel) ?? kids[0];
  const base = `/portal/me/children/${child.id}`;
  return (
    <div>
      <LecHeader icon={tab === 'Attendance' ? ClipboardCheck : tab === 'Grades' ? Award : Wallet}
        title={tab === 'Attendance' ? 'Attendance' : tab === 'Grades' ? 'Grades & report cards' : 'Fees'}
        sub={`${child.firstName} ${child.lastName ?? ''} · ${child.admissionNo}`} accent={accent} />
      {kids.length > 1 && (
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 16 }}>
          {kids.map((k) => (
            <button key={k.id} onClick={() => setSel(k.id)} style={{
              border: 'none', cursor: 'pointer', borderRadius: 99, padding: '7px 14px', fontSize: 13, fontWeight: 600,
              background: k.id === child.id ? accent : 'var(--surface-2)', color: k.id === child.id ? '#fff' : 'var(--ink-2)',
            }}>{k.firstName} {k.lastName ?? ''}</button>
          ))}
        </div>
      )}
      {tab === 'Attendance' ? <PortalAttendance key={child.id} accent={accent} path={`${base}/attendance`} />
        : tab === 'Grades' ? <PortalGrades key={child.id} accent={accent} path={`${base}/report-cards`} />
        : <PortalFees key={child.id} accent={accent} path={`${base}/fees`} payPath={`${base}/fees/pay`} />}
    </div>
  );
}

// ============================ Communication: Announcements + PTM (Sprint 27) ============================
const fmtDateTime = (s: string) => new Date(s).toLocaleString('en-IN', { weekday: 'short', day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' });
const fmtDay = (s: string) => new Date(s).toLocaleDateString('en-IN', { weekday: 'long', day: '2-digit', month: 'short' });
const fmtTime = (s: string) => new Date(s).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' });

// Shared announcements feed (students, parents, lecturers).
function PortalAnnouncements({ accent }: { accent: string }) {
  const [items, setItems] = useState<any[] | null>(null);
  useEffect(() => { portalApi('/portal/me/announcements').then(setItems).catch(() => setItems([])); }, []);
  if (!items) return <LecSpinner />;
  return (
    <div>
      <LecHeader icon={Bell} title="Announcements" sub="Notices from your institute" accent={accent} />
      {items.length === 0 ? <div style={{ ...lecCard, color: 'var(--ink-3)', fontSize: 13 }}>No announcements right now.</div> : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {items.map((a) => (
            <div key={a.id} style={{ ...lecCard, borderLeft: `3px solid ${a.pinned ? accent : 'transparent'}` }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                {a.pinned && <Pin size={13} style={{ color: accent }} />}
                <div style={{ fontWeight: 700, fontSize: 14, flex: 1 }}>{a.title}</div>
                <div style={{ fontSize: 11.5, color: 'var(--ink-3)' }}>{new Date(a.publishedAt).toLocaleDateString('en-IN', { day: '2-digit', month: 'short' })}</div>
              </div>
              <div style={{ fontSize: 13, color: 'var(--ink-2)', marginTop: 6, whiteSpace: 'pre-wrap', lineHeight: 1.5 }}>{a.body}</div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// Parent: browse open PTM slots, book for a child, see & cancel bookings.
function ParentPTM({ accent }: { accent: string }) {
  const [tab, setTab] = useState<'book' | 'mine'>('book');
  const [kids, setKids] = useState<any[]>([]);
  const [slots, setSlots] = useState<any[] | null>(null);
  const [mine, setMine] = useState<any[] | null>(null);
  const [booking, setBooking] = useState<any>(null);
  const [child, setChild] = useState('');
  const [note, setNote] = useState('');
  const [busy, setBusy] = useState(false);
  const load = () => {
    portalApi('/portal/me/children').then((k: any) => { setKids(k); setChild((c) => c || k[0]?.id || ''); }).catch(() => setKids([]));
    portalApi('/portal/me/ptm/slots').then(setSlots).catch(() => setSlots([]));
    portalApi('/portal/me/ptm/mine').then(setMine).catch(() => setMine([]));
  };
  useEffect(() => { load(); }, []);

  const book = async () => {
    setBusy(true);
    try { await portalApi(`/portal/me/ptm/slots/${booking.id}/book`, { method: 'POST', body: JSON.stringify({ studentId: child, note: note || undefined }) }); setBooking(null); setNote(''); load(); }
    finally { setBusy(false); }
  };
  const cancel = async (id: string) => { await portalApi(`/portal/me/ptm/slots/${id}/cancel`, { method: 'POST' }); load(); };

  // group open slots by day
  const byDay: Record<string, any[]> = {};
  (slots ?? []).forEach((s) => { (byDay[fmtDay(s.startsAt)] ??= []).push(s); });

  return (
    <div>
      <LecHeader icon={CalendarClock} title="Parent–teacher meetings" sub="Book a time with your child's lecturers" accent={accent} />
      <div style={{ display: 'inline-flex', background: 'var(--surface-2)', borderRadius: 10, padding: 4, marginBottom: 14 }}>
        {(['book', 'mine'] as const).map((t) => <button key={t} onClick={() => setTab(t)} style={{ border: 'none', cursor: 'pointer', borderRadius: 8, padding: '7px 16px', fontSize: 13, fontWeight: 600, background: tab === t ? 'var(--surface)' : 'transparent', color: tab === t ? accent : 'var(--ink-3)' }}>{t === 'book' ? 'Available slots' : `My meetings${mine ? ` (${mine.length})` : ''}`}</button>)}
      </div>

      {tab === 'book' ? (
        !slots ? <LecSpinner /> : slots.length === 0 ? <div style={{ ...lecCard, color: 'var(--ink-3)', fontSize: 13 }}>No open slots right now. Please check back later.</div> : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            {Object.entries(byDay).map(([day, list]) => (
              <div key={day}>
                <div style={{ fontSize: 11, letterSpacing: '.08em', textTransform: 'uppercase', color: 'var(--ink-3)', fontWeight: 700, marginBottom: 6 }}>{day}</div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                  {list.map((s) => (
                    <div key={s.id} style={{ ...lecCard, display: 'flex', alignItems: 'center', gap: 10 }}>
                      <Clock size={15} style={{ color: accent }} />
                      <span style={{ fontWeight: 700, fontSize: 13, minWidth: 62 }}>{fmtTime(s.startsAt)}</span>
                      <div style={{ flex: 1 }}><div style={{ fontSize: 13, fontWeight: 600 }}>{s.faculty?.name}</div><div style={{ fontSize: 11.5, color: 'var(--ink-3)' }}>{s.durationMin} min · {s.mode === 'LIVE' ? 'Online' : 'In person'}{s.location ? ` · ${s.location}` : ''}</div></div>
                      <button className="btn-primary" style={{ height: 32, background: accent }} onClick={() => { setBooking(s); setNote(''); }}>Book</button>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        )
      ) : (
        !mine ? <LecSpinner /> : mine.length === 0 ? <div style={{ ...lecCard, color: 'var(--ink-3)', fontSize: 13 }}>You have no booked meetings.</div> : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {mine.map((s) => (
              <div key={s.id} style={{ ...lecCard, display: 'flex', alignItems: 'center', gap: 10 }}>
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: 13, fontWeight: 700 }}>{s.faculty?.name} <span style={{ fontWeight: 400, color: 'var(--ink-3)', fontSize: 12 }}>· {s.student?.firstName} {s.student?.lastName ?? ''}</span></div>
                  <div style={{ fontSize: 11.5, color: 'var(--ink-3)' }}>{fmtDateTime(s.startsAt)} · {s.mode === 'LIVE' ? 'Online' : 'In person'}{s.location ? ` · ${s.location}` : ''}</div>
                  {s.note && <div style={{ fontSize: 12, color: 'var(--ink-2)', marginTop: 3 }}>“{s.note}”</div>}
                </div>
                <span className="badge" style={{ background: s.status === 'DONE' ? 'var(--success-bg,#e6f4ea)' : 'color-mix(in srgb,' + accent + ' 12%, var(--surface))', color: s.status === 'DONE' ? 'var(--success,#1e874b)' : accent }}>{s.status === 'DONE' ? 'Completed' : 'Booked'}</span>
                {s.status === 'BOOKED' && <button className="btn-secondary" style={{ height: 30, fontSize: 12, color: 'var(--danger,#c0392b)' }} onClick={() => cancel(s.id)}>Cancel</button>}
              </div>
            ))}
          </div>
        )
      )}

      {booking && (
        <div style={{ position: 'fixed', inset: 0, zIndex: 60, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }}>
          <div style={{ position: 'absolute', inset: 0, background: 'rgba(20,15,12,.5)' }} onClick={() => setBooking(null)} />
          <div style={{ ...card, position: 'relative', zIndex: 1, width: 440, maxWidth: '100%', padding: 24 }}>
            <div style={{ fontWeight: 700, fontSize: 16 }}>Book meeting</div>
            <div style={{ fontSize: 13, color: 'var(--ink-3)', marginTop: 4 }}>{booking.faculty?.name} · {fmtDateTime(booking.startsAt)}</div>
            <div style={{ fontSize: 12, color: 'var(--ink-3)', margin: '14px 0 6px', fontWeight: 600 }}>For which child?</div>
            <select value={child} onChange={(e) => setChild(e.target.value)} style={{ width: '100%', padding: '9px 11px', borderRadius: 9, border: '1px solid var(--line-soft)', background: 'var(--surface)', fontSize: 13 }}>
              {kids.map((k) => <option key={k.id} value={k.id}>{k.firstName} {k.lastName ?? ''} · {k.admissionNo}</option>)}
            </select>
            <textarea placeholder="What would you like to discuss? (optional)" value={note} onChange={(e) => setNote(e.target.value)} rows={2} style={{ width: '100%', marginTop: 10, padding: '9px 11px', borderRadius: 9, border: '1px solid var(--line-soft)', background: 'var(--surface)', fontSize: 13, resize: 'vertical' }} />
            <div style={{ display: 'flex', gap: 8, marginTop: 16 }}>
              <button className="btn-secondary" onClick={() => setBooking(null)} disabled={busy}>Cancel</button>
              <button className="btn-primary" style={{ background: accent }} onClick={book} disabled={busy || !child}>{busy ? <Loader2 size={14} className="spin" /> : <Check size={14} />} Confirm booking</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// Lecturer: open PTM slots, see bookings, mark done.
function LecturerPTM({ accent }: { accent: string }) {
  const [d, setD] = useState<any>(null);
  const [adding, setAdding] = useState(false);
  const [f, setF] = useState<any>({ date: '', times: '', durationMin: 15, mode: 'OFFLINE', location: '' });
  const [busy, setBusy] = useState(false);
  const load = () => portalApi('/portal/me/ptm/host').then(setD).catch(() => setD({ open: [], booked: [], done: [] }));
  useEffect(() => { load(); }, []);

  const openSlots = async () => {
    const times = f.times.split(',').map((t: string) => t.trim()).filter(Boolean);
    if (!f.date || !times.length) return;
    setBusy(true);
    try { await portalApi('/portal/me/ptm/host/slots', { method: 'POST', body: JSON.stringify({ date: f.date, times, durationMin: Number(f.durationMin) || 15, mode: f.mode, location: f.location || undefined }) }); setAdding(false); setF({ date: '', times: '', durationMin: 15, mode: 'OFFLINE', location: '' }); load(); }
    finally { setBusy(false); }
  };
  const markDone = async (id: string) => { await portalApi(`/portal/me/ptm/host/${id}/done`, { method: 'POST', body: JSON.stringify({}) }); load(); };
  if (!d) return <LecSpinner />;
  const inp: React.CSSProperties = { padding: '8px 10px', borderRadius: 9, border: '1px solid var(--line-soft)', background: 'var(--surface)', fontSize: 13 };

  const Section = ({ title, list, kind }: { title: string; list: any[]; kind: 'open' | 'booked' | 'done' }) => (
    list.length === 0 ? null : (
      <div style={{ marginTop: 14 }}>
        <div style={{ fontSize: 11, letterSpacing: '.08em', textTransform: 'uppercase', color: 'var(--ink-3)', fontWeight: 700, marginBottom: 6 }}>{title} ({list.length})</div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {list.map((s) => (
            <div key={s.id} style={{ ...lecCard, display: 'flex', alignItems: 'center', gap: 10 }}>
              <Clock size={15} style={{ color: accent }} />
              <div style={{ minWidth: 150 }}><div style={{ fontSize: 13, fontWeight: 600 }}>{fmtDay(s.startsAt)}</div><div style={{ fontSize: 11.5, color: 'var(--ink-3)' }}>{fmtTime(s.startsAt)} · {s.durationMin}min · {s.mode === 'LIVE' ? 'Online' : 'In person'}</div></div>
              <div style={{ flex: 1, fontSize: 12.5 }}>
                {kind === 'open' ? <span style={{ color: 'var(--ink-3)' }}>{s.location || 'Awaiting booking'}</span>
                  : <><span style={{ fontWeight: 600 }}>{s.student?.firstName} {s.student?.lastName ?? ''}</span>{s.guardian?.name ? <span style={{ color: 'var(--ink-3)' }}> · {s.guardian.name}</span> : ''}{s.note ? <div style={{ color: 'var(--ink-3)' }}>“{s.note}”</div> : ''}</>}
              </div>
              {kind === 'booked' && <button className="btn-primary" style={{ height: 30, fontSize: 12, background: accent }} onClick={() => markDone(s.id)}><Check size={13} /> Complete</button>}
              {kind === 'done' && <span className="badge" style={{ background: 'var(--success-bg,#e6f4ea)', color: 'var(--success,#1e874b)' }}>Completed</span>}
            </div>
          ))}
        </div>
      </div>
    )
  );

  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 4 }}>
        <LecHeader icon={CalendarClock} title="Parent meetings" sub="Open slots and meet parents" accent={accent} />
        <button className="btn-primary" style={{ background: accent }} onClick={() => setAdding((v) => !v)}>{adding ? <X size={14} /> : <Plus size={14} />} {adding ? 'Cancel' : 'Open slots'}</button>
      </div>
      {adding && (
        <div style={{ ...lecCard, marginBottom: 8, display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
          <label style={{ fontSize: 11.5, color: 'var(--ink-3)' }}>Date<input type="date" value={f.date} onChange={(e) => setF({ ...f, date: e.target.value })} style={{ ...inp, width: '100%', marginTop: 4 }} /></label>
          <label style={{ fontSize: 11.5, color: 'var(--ink-3)' }}>Duration (min)<input type="number" value={f.durationMin} onChange={(e) => setF({ ...f, durationMin: e.target.value })} style={{ ...inp, width: '100%', marginTop: 4 }} /></label>
          <label style={{ fontSize: 11.5, color: 'var(--ink-3)', gridColumn: '1 / -1' }}>Times (comma-separated, e.g. 10:00, 10:20, 10:40)<input placeholder="10:00, 10:20, 10:40" value={f.times} onChange={(e) => setF({ ...f, times: e.target.value })} style={{ ...inp, width: '100%', marginTop: 4 }} /></label>
          <label style={{ fontSize: 11.5, color: 'var(--ink-3)' }}>Mode<select value={f.mode} onChange={(e) => setF({ ...f, mode: e.target.value })} style={{ ...inp, width: '100%', marginTop: 4 }}><option value="OFFLINE">In person</option><option value="LIVE">Online</option></select></label>
          <label style={{ fontSize: 11.5, color: 'var(--ink-3)' }}>Room / link<input placeholder="Room 101 or meeting link" value={f.location} onChange={(e) => setF({ ...f, location: e.target.value })} style={{ ...inp, width: '100%', marginTop: 4 }} /></label>
          <div style={{ gridColumn: '1 / -1' }}><button className="btn-primary" style={{ background: accent }} disabled={busy || !f.date || !f.times} onClick={openSlots}>{busy ? <Loader2 size={14} className="spin" /> : <Plus size={14} />} Open {f.times.split(',').filter((t: string) => t.trim()).length || ''} slots</button></div>
        </div>
      )}
      {d.open.length + d.booked.length + d.done.length === 0 && !adding && <div style={{ ...lecCard, color: 'var(--ink-3)', fontSize: 13, marginTop: 10 }}>No PTM slots yet. Click “Open slots” to offer meeting times to parents.</div>}
      <Section title="Booked" list={d.booked} kind="booked" />
      <Section title="Open" list={d.open} kind="open" />
      <Section title="Completed" list={d.done} kind="done" />
    </div>
  );
}

// ============================ Certificates (Sprint 28) ============================
const CERT_LABEL: Record<string, string> = { COMPLETION: 'Completion', MERIT: 'Merit', PARTICIPATION: 'Participation', INTERNSHIP: 'Internship' };

function PortalCertificates({ accent }: { accent: string }) {
  const [items, setItems] = useState<any[] | null>(null);
  const [view, setView] = useState<any>(null);
  useEffect(() => { portalApi('/portal/me/certificates').then(setItems).catch(() => setItems([])); }, []);
  if (!items) return <LecSpinner />;
  return (
    <div>
      <LecHeader icon={ScrollText} title="Certificates" sub="Your verifiable credentials" accent={accent} />
      {items.length === 0 ? <div style={{ ...lecCard, color: 'var(--ink-3)', fontSize: 13 }}>No certificates issued yet.</div> : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {items.map((c) => (
            <div key={c.id} style={{ ...lecCard, display: 'flex', alignItems: 'center', gap: 12 }}>
              <span style={{ width: 42, height: 42, borderRadius: 11, background: 'color-mix(in srgb,' + accent + ' 14%, var(--surface))', color: accent, display: 'flex', alignItems: 'center', justifyContent: 'center' }}><BadgeCheck size={20} /></span>
              <div style={{ flex: 1 }}>
                <div style={{ fontWeight: 700, fontSize: 14 }}>{c.title}</div>
                <div style={{ fontSize: 11.5, color: 'var(--ink-3)' }}>{c.course?.name ? `${c.course.name} · ` : ''}{c.serial} · {new Date(c.issuedOn).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })}</div>
              </div>
              {c.grade && <span className="badge" style={{ background: 'color-mix(in srgb,' + accent + ' 12%, var(--surface))', color: accent }}>Grade {c.grade}</span>}
              <button className="btn-primary" style={{ height: 32, background: accent }} onClick={() => setView(c)}>View</button>
            </div>
          ))}
        </div>
      )}
      {view && <CertificateModal cert={view} accent={accent} onClose={() => setView(null)} />}
    </div>
  );
}

function CertificateModal({ cert, accent, onClose }: { cert: any; accent: string; onClose: () => void }) {
  const d = cert.data ?? {};
  const verifyUrl = (typeof window !== 'undefined' ? window.location.origin : '') + '/verify/' + cert.code;
  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 60, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }}>
      <div style={{ position: 'absolute', inset: 0, background: 'rgba(20,15,12,.5)' }} onClick={onClose} />
      <div style={{ background: 'var(--surface)', border: '1px solid var(--line-soft)', borderRadius: 16, position: 'relative', zIndex: 1, width: 640, maxWidth: '100%', maxHeight: '92vh', overflowY: 'auto', padding: 8 }}>
        <button onClick={onClose} style={{ position: 'absolute', top: 14, right: 14, background: 'none', border: 'none', cursor: 'pointer', color: 'var(--ink-3)', zIndex: 2 }}><X size={18} /></button>
        {/* The certificate itself */}
        <div id="cert-print" style={{ border: `2px solid ${accent}`, borderRadius: 12, padding: '38px 44px', textAlign: 'center', margin: 6, background: 'var(--surface)' }}>
          <div style={{ fontSize: 12, letterSpacing: '.18em', textTransform: 'uppercase', color: 'var(--ink-3)', fontWeight: 700 }}>{d.orgName ?? 'BMN Connect'}</div>
          <div style={{ width: 46, height: 3, background: accent, margin: '14px auto' }} />
          <div style={{ fontSize: 25, fontWeight: 800, color: accent, letterSpacing: '-.01em' }}>{cert.title}</div>
          <div style={{ fontSize: 13, color: 'var(--ink-3)', marginTop: 18 }}>This is proudly presented to</div>
          <div style={{ fontSize: 28, fontWeight: 800, margin: '8px 0' }}>{d.studentName ?? '—'}</div>
          {d.courseName && <div style={{ fontSize: 14, color: 'var(--ink-2)', marginTop: 6 }}>for successfully completing <b>{d.courseName}</b></div>}
          {cert.grade && <div style={{ fontSize: 13.5, color: 'var(--ink-2)', marginTop: 8 }}>Grade achieved: <b style={{ color: accent }}>{cert.grade}</b></div>}
          <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 34, fontSize: 11.5, color: 'var(--ink-3)' }}>
            <div style={{ textAlign: 'left' }}><div style={{ fontWeight: 700, color: 'var(--ink-2)' }}>{cert.serial}</div>Serial no.</div>
            <div style={{ textAlign: 'right' }}><div style={{ fontWeight: 700, color: 'var(--ink-2)' }}>{new Date(cert.issuedOn).toLocaleDateString('en-IN', { day: '2-digit', month: 'long', year: 'numeric' })}</div>Issued on</div>
          </div>
        </div>
        {/* Verification */}
        <div style={{ padding: '12px 14px 16px' }}>
          <div style={{ fontSize: 11, letterSpacing: '.06em', textTransform: 'uppercase', color: 'var(--ink-3)', fontWeight: 700, marginBottom: 6 }}>Verify authenticity</div>
          <div style={{ display: 'flex', gap: 8 }}>
            <input readOnly value={verifyUrl} style={{ flex: 1, padding: '9px 11px', borderRadius: 9, border: '1px solid var(--line-soft)', background: 'var(--surface-2)', fontSize: 12, fontFamily: 'var(--mono)' }} />
            <button className="btn-secondary" onClick={() => { navigator.clipboard?.writeText(verifyUrl); toast.success('Verification link copied'); }}><Copy size={14} /> Copy</button>
            <button className="btn-primary" style={{ background: accent }} onClick={() => window.print()}><Download size={14} /> Print</button>
          </div>
          <div style={{ fontSize: 11.5, color: 'var(--ink-3)', marginTop: 8 }}>Anyone can confirm this certificate at the link above using code <b style={{ fontFamily: 'var(--mono)' }}>{cert.code}</b>.</div>
        </div>
      </div>
    </div>
  );
}

// ============================ Placements (Sprint 28b) ============================
const JOB_TYPE_LABEL: Record<string, string> = { FULL_TIME: 'Full-time', PART_TIME: 'Part-time', INTERNSHIP: 'Internship', APPRENTICESHIP: 'Apprenticeship' };
const APP_STATUS: Record<string, { label: string; bg: string; fg: string }> = {
  APPLIED: { label: 'Applied', bg: 'var(--surface)', fg: 'var(--ink-3)' },
  SHORTLISTED: { label: 'Shortlisted', bg: 'var(--gold-bg,#fdf2e2)', fg: 'var(--gold,#c67c1e)' },
  INTERVIEW: { label: 'Interview', bg: 'color-mix(in srgb,#0891b2 14%, var(--surface))', fg: '#0891b2' },
  OFFERED: { label: 'Offered', bg: 'color-mix(in srgb,#7c3aed 14%, var(--surface))', fg: '#7c3aed' },
  PLACED: { label: 'Placed', bg: 'var(--success-bg,#e6f4ea)', fg: 'var(--success,#1e874b)' },
  REJECTED: { label: 'Not selected', bg: 'var(--danger-bg,#fce8e8)', fg: 'var(--danger,#c0392b)' },
};
const ctc = (n?: number | null) => (n ? '₹' + (n / 100000).toLocaleString('en-IN', { maximumFractionDigits: 2 }) + ' LPA' : null);

function PortalPlacements({ accent }: { accent: string }) {
  const [tab, setTab] = useState<'jobs' | 'mine'>('jobs');
  const [jobs, setJobs] = useState<any[] | null>(null);
  const [mine, setMine] = useState<any[] | null>(null);
  const [applying, setApplying] = useState<any>(null);
  const [note, setNote] = useState('');
  const [busy, setBusy] = useState(false);
  const load = () => {
    portalApi('/portal/me/jobs').then(setJobs).catch(() => setJobs([]));
    portalApi('/portal/me/applications').then(setMine).catch(() => setMine([]));
  };
  useEffect(() => { load(); }, []);

  const apply = async () => {
    setBusy(true);
    try { await portalApi(`/portal/me/jobs/${applying.id}/apply`, { method: 'POST', body: JSON.stringify({ note: note || undefined }) }); setApplying(null); setNote(''); load(); }
    catch (e: any) { toast.error(e?.message || 'Could not apply'); }
    finally { setBusy(false); }
  };

  return (
    <div>
      <LecHeader icon={Briefcase} title="Placements" sub="Campus job openings and your applications" accent={accent} />
      <div style={{ display: 'inline-flex', background: 'var(--surface-2)', borderRadius: 10, padding: 4, marginBottom: 14 }}>
        {(['jobs', 'mine'] as const).map((t) => <button key={t} onClick={() => setTab(t)} style={{ border: 'none', cursor: 'pointer', borderRadius: 8, padding: '7px 16px', fontSize: 13, fontWeight: 600, background: tab === t ? 'var(--surface)' : 'transparent', color: tab === t ? accent : 'var(--ink-3)' }}>{t === 'jobs' ? `Open roles${jobs ? ` (${jobs.length})` : ''}` : `My applications${mine ? ` (${mine.length})` : ''}`}</button>)}
      </div>

      {tab === 'jobs' ? (
        !jobs ? <LecSpinner /> : jobs.length === 0 ? <div style={{ ...lecCard, color: 'var(--ink-3)', fontSize: 13 }}>No open roles right now.</div> : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {jobs.map((j) => (
              <div key={j.id} style={{ ...lecCard }}>
                <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12 }}>
                  <span style={{ width: 42, height: 42, borderRadius: 11, background: 'color-mix(in srgb,' + accent + ' 14%, var(--surface))', color: accent, display: 'flex', alignItems: 'center', justifyContent: 'center' }}><Briefcase size={19} /></span>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontWeight: 700, fontSize: 14.5 }}>{j.title}</div>
                    <div style={{ fontSize: 12.5, color: 'var(--ink-2)' }}>{j.companyName}</div>
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10, marginTop: 6, fontSize: 12, color: 'var(--ink-3)' }}>
                      <span className="badge" style={{ background: 'var(--surface)', color: 'var(--ink-2)' }}>{JOB_TYPE_LABEL[j.type]}</span>
                      {j.location && <span style={{ display: 'inline-flex', alignItems: 'center', gap: 3 }}><MapPin size={12} /> {j.location}</span>}
                      {ctc(j.ctcInr) && <span style={{ display: 'inline-flex', alignItems: 'center', gap: 2 }}><IndianRupee size={12} /> {ctc(j.ctcInr)}</span>}
                      {j.deadline && <span>Apply by {new Date(j.deadline).toLocaleDateString('en-IN', { day: '2-digit', month: 'short' })}</span>}
                    </div>
                    {j.eligibility && <div style={{ fontSize: 12, color: 'var(--ink-3)', marginTop: 6 }}>Eligibility: {j.eligibility}</div>}
                  </div>
                  {j.myStatus ? <span className="badge" style={{ background: APP_STATUS[j.myStatus].bg, color: APP_STATUS[j.myStatus].fg }}>{APP_STATUS[j.myStatus].label}</span>
                    : <button className="btn-primary" style={{ height: 34, background: accent }} onClick={() => { setApplying(j); setNote(''); }}>Apply</button>}
                </div>
              </div>
            ))}
          </div>
        )
      ) : (
        !mine ? <LecSpinner /> : mine.length === 0 ? <div style={{ ...lecCard, color: 'var(--ink-3)', fontSize: 13 }}>You haven't applied to any roles yet.</div> : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {mine.map((a) => (
              <div key={a.id} style={{ ...lecCard, display: 'flex', alignItems: 'center', gap: 10 }}>
                <div style={{ flex: 1 }}>
                  <div style={{ fontWeight: 600, fontSize: 13.5 }}>{a.job.title} <span style={{ color: 'var(--ink-3)', fontWeight: 400, fontSize: 12 }}>· {a.job.companyName}</span></div>
                  <div style={{ fontSize: 11.5, color: 'var(--ink-3)' }}>Applied {new Date(a.appliedAt).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })}{a.job.location ? ` · ${a.job.location}` : ''}{ctc(a.job.ctcInr) ? ` · ${ctc(a.job.ctcInr)}` : ''}</div>
                </div>
                <span className="badge" style={{ background: APP_STATUS[a.status].bg, color: APP_STATUS[a.status].fg }}>{APP_STATUS[a.status].label}</span>
              </div>
            ))}
          </div>
        )
      )}

      {applying && (
        <div style={{ position: 'fixed', inset: 0, zIndex: 60, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }}>
          <div style={{ position: 'absolute', inset: 0, background: 'rgba(20,15,12,.5)' }} onClick={() => setApplying(null)} />
          <div style={{ ...card, position: 'relative', zIndex: 1, width: 460, maxWidth: '100%', padding: 24 }}>
            <div style={{ fontWeight: 700, fontSize: 16 }}>Apply — {applying.title}</div>
            <div style={{ fontSize: 13, color: 'var(--ink-3)', marginTop: 4 }}>{applying.companyName}{ctc(applying.ctcInr) ? ` · ${ctc(applying.ctcInr)}` : ''}</div>
            <textarea placeholder="A short note to the recruiter (optional)" value={note} onChange={(e) => setNote(e.target.value)} rows={3} style={{ width: '100%', marginTop: 14, padding: '9px 11px', borderRadius: 9, border: '1px solid var(--line-soft)', background: 'var(--surface)', fontSize: 13, resize: 'vertical' }} />
            <div style={{ display: 'flex', gap: 8, marginTop: 16 }}>
              <button className="btn-secondary" onClick={() => setApplying(null)} disabled={busy}>Cancel</button>
              <button className="btn-primary" style={{ background: accent }} onClick={apply} disabled={busy}>{busy ? <Loader2 size={14} className="spin" /> : <Send size={14} />} Submit application</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ============================ Lecturer live classes (Sprint 29) ============================
function LiveRow({ l, accent, busy, onAct, onJoin, onReload, onPlay }: { l: any; accent: string; busy: string | null; onAct: (id: string, a: 'go-live' | 'end-live') => void; onJoin: (id: string) => void; onReload: () => void; onPlay: (p: PlayReq) => void }) {
  const [openAtt, setOpenAtt] = useState(false);
  const [att, setAtt] = useState<any[] | null>(null);
  const [rec, setRec] = useState(l.recordingUrl ?? '');
  const [recOpen, setRecOpen] = useState(false);
  const [savingRec, setSavingRec] = useState(false);
  const [transcoding, setTranscoding] = useState(false);
  const [uploadPct, setUploadPct] = useState<number | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const adaptive = /\.m3u8(\?|$)/i.test(l.recordingUrl || '');
  const uploadFile = async (file: File) => {
    setUploadPct(0);
    try {
      const { uploadUrl } = await portalApi<{ uploadUrl: string }>(`/portal/me/live/${l.id}/upload-url`, { method: 'POST', body: JSON.stringify({}) });
      await new Promise<void>((resolve, reject) => {
        const xhr = new XMLHttpRequest();
        xhr.open('PUT', uploadUrl);
        xhr.upload.onprogress = (e) => e.lengthComputable && setUploadPct(Math.round((e.loaded / e.total) * 100));
        xhr.onload = () => (xhr.status < 300 ? resolve() : reject(new Error('upload failed')));
        xhr.onerror = () => reject(new Error('upload failed'));
        xhr.send(file);
      });
      toast.success('Uploaded — transcoding to adaptive HD'); onReload();
    } catch (e: any) { toast.error(e?.message || 'Upload failed'); }
    finally { setUploadPct(null); }
  };
  const toggleAtt = () => { const n = !openAtt; setOpenAtt(n); if (n && !att) portalApi(`/portal/me/live/${l.id}/attendees`).then(setAtt).catch(() => setAtt([])); };
  const saveRec = async () => { setSavingRec(true); try { await portalApi(`/portal/me/live/${l.id}/recording`, { method: 'POST', body: JSON.stringify({ url: rec }) }); setRecOpen(false); onReload(); toast.success('Recording saved'); } catch { toast.error('Failed'); } finally { setSavingRec(false); } };
  const makeAdaptive = async () => {
    setTranscoding(true);
    try { await portalApi(`/portal/me/live/${l.id}/transcode`, { method: 'POST', body: JSON.stringify({ sourceUrl: l.recordingUrl }) }); toast.success('Transcoding to adaptive HD — it will switch over shortly'); setTimeout(() => { onReload(); setTranscoding(false); }, 6000); }
    catch { toast.error('Could not start transcoding'); setTranscoding(false); }
  };

  return (
    <div style={lecCard}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
        <span style={{ width: 38, height: 38, borderRadius: 10, background: l.liveActive ? 'color-mix(in srgb,#c0392b 16%, var(--surface))' : 'color-mix(in srgb,' + accent + ' 12%, var(--surface))', color: l.liveActive ? '#c0392b' : accent, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>{l.liveActive ? <Radio size={17} /> : <Video size={17} />}</span>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontWeight: 600, fontSize: 13.5 }}>{l.title} <span style={{ color: 'var(--ink-3)', fontWeight: 400, fontSize: 12 }}>· {l.subject?.code}{l.section ? ` · Sec ${l.section.name}` : ''}</span></div>
          <div style={{ fontSize: 11.5, color: 'var(--ink-3)' }}>{new Date(l.scheduledAt).toLocaleString('en-IN', { weekday: 'short', day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })} · {l.durationMin} min{l.soon && !l.liveActive ? ' · starts soon' : ''}</div>
        </div>
        <button onClick={toggleAtt} title="Attendance" style={{ display: 'inline-flex', alignItems: 'center', gap: 4, fontSize: 12, fontWeight: 600, color: l.attendeeCount ? accent : 'var(--ink-3)', background: 'var(--surface)', border: '1px solid var(--line-soft)', borderRadius: 8, padding: '5px 9px', cursor: 'pointer' }}><Users size={13} /> {l.attendeeCount ?? 0}</button>
        {l.liveActive ? (
          <>
            <button className="btn-primary" style={{ height: 32, background: accent }} onClick={() => onJoin(l.id)}><Video size={13} /> Join</button>
            <button className="btn-secondary" style={{ height: 32, color: 'var(--danger,#c0392b)' }} disabled={busy === l.id} onClick={() => onAct(l.id, 'end-live')}>End</button>
          </>
        ) : (
          <button className="btn-primary" style={{ height: 32, background: '#c0392b' }} disabled={busy === l.id} onClick={() => onAct(l.id, 'go-live')}>{busy === l.id ? <Loader2 size={13} className="spin" /> : <Radio size={13} />} Go live</button>
        )}
      </div>
      {openAtt && (
        <div style={{ marginTop: 10, paddingTop: 10, borderTop: '1px solid var(--line-soft)' }}>
          <div style={{ fontSize: 11, letterSpacing: '.06em', textTransform: 'uppercase', color: 'var(--ink-3)', fontWeight: 700, marginBottom: 6 }}>Attended ({att?.length ?? '…'})</div>
          {!att ? <div style={{ fontSize: 12.5, color: 'var(--ink-3)' }}>Loading…</div>
            : att.length === 0 ? <div style={{ fontSize: 12.5, color: 'var(--ink-3)' }}>No one has joined yet.</div>
            : <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>{att.map((a) => <span key={a.id} style={{ fontSize: 12, background: 'var(--surface)', border: '1px solid var(--line-soft)', borderRadius: 99, padding: '4px 10px' }}>{a.student.firstName} {a.student.lastName ?? ''} <span style={{ color: 'var(--ink-3)' }}>· {new Date(a.joinedAt).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })}</span></span>)}</div>}
          <div style={{ marginTop: 10 }}>
            {uploadPct !== null ? (
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <span style={{ fontSize: 12, color: 'var(--ink-3)', minWidth: 96 }}>Uploading {uploadPct}%</span>
                <div style={{ flex: 1, height: 6, borderRadius: 99, background: 'var(--surface)', overflow: 'hidden' }}><div style={{ width: `${uploadPct}%`, height: '100%', background: accent, transition: 'width .2s' }} /></div>
              </div>
            ) : l.recordingProcessing ? (
              <div style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 12.5, color: 'var(--ink-3)' }}><Loader2 size={13} className="spin" /> Transcoding to adaptive HD…</div>
            ) : l.recordingUrl && !recOpen ? (
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, fontSize: 12.5, flexWrap: 'wrap' }}>
                <button onClick={() => onPlay({ url: l.recordingUrl, title: `${l.subject?.code} — ${l.title}` })} style={{ display: 'inline-flex', alignItems: 'center', gap: 5, background: 'none', border: 'none', color: accent, cursor: 'pointer', fontWeight: 600 }}><Video size={13} /> Play recording</button>
                {adaptive ? <span className="badge" style={{ background: 'var(--success-bg,#e6f4ea)', color: 'var(--success,#1e874b)' }}>Adaptive HD</span>
                  : <button onClick={makeAdaptive} disabled={transcoding} style={{ display: 'inline-flex', alignItems: 'center', gap: 5, background: 'none', border: 'none', color: 'var(--ink-2)', cursor: 'pointer', textDecoration: 'underline' }}>{transcoding ? <Loader2 size={12} className="spin" /> : <Zap size={12} />} Make adaptive (HLS)</button>}
                <button onClick={() => setRecOpen(true)} style={{ background: 'none', border: 'none', color: 'var(--ink-3)', cursor: 'pointer', fontSize: 12, textDecoration: 'underline' }}>edit</button>
              </div>
            ) : recOpen || !l.recordingUrl ? (
              <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', alignItems: 'center' }}>
                <input placeholder="Recording URL (paste after class)" value={rec} onChange={(e) => setRec(e.target.value)} style={{ flex: 1, minWidth: 180, padding: '7px 10px', borderRadius: 8, border: '1px solid var(--line-soft)', background: 'var(--surface)', fontSize: 12.5 }} />
                <button className="btn-secondary" style={{ height: 32, fontSize: 12 }} disabled={savingRec} onClick={saveRec}>{savingRec ? <Loader2 size={12} className="spin" /> : <Check size={12} />} Save</button>
                <span style={{ fontSize: 11.5, color: 'var(--ink-3)' }}>or</span>
                <button className="btn-secondary" style={{ height: 32, fontSize: 12 }} onClick={() => fileRef.current?.click()}><Video size={12} /> Upload file</button>
                <input ref={fileRef} type="file" accept="video/*" style={{ display: 'none' }} onChange={(e) => { const f = e.target.files?.[0]; if (f) uploadFile(f); e.target.value = ''; }} />
              </div>
            ) : null}
          </div>
        </div>
      )}
    </div>
  );
}

function LecturerLive({ accent, onJoin, onPlay }: { accent: string; onJoin: (lectureId: string) => void; onPlay: (p: PlayReq) => void }) {
  const [rows, setRows] = useState<any[] | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const load = () => portalApi('/portal/me/live/mine/lectures').then(setRows).catch(() => setRows([]));
  useEffect(() => { load(); }, []);
  const act = async (id: string, action: 'go-live' | 'end-live') => {
    setBusy(id);
    try { await portalApi(`/portal/me/live/${id}/${action}`, { method: 'POST' }); await load(); if (action === 'go-live') onJoin(id); }
    catch (e: any) { toast.error(e?.message || 'Failed'); } finally { setBusy(null); }
  };
  if (!rows) return <LecSpinner />;
  const liveOnes = rows.filter((r) => r.liveActive);
  const rest = rows.filter((r) => !r.liveActive);

  return (
    <div>
      <LecHeader icon={Radio} title="Live classes" sub="Start an in-app video class — students join from their portal" accent={accent} />
      {rows.length === 0 ? <div style={{ ...lecCard, color: 'var(--ink-3)', fontSize: 13 }}>No lectures scheduled yet. Schedule one under Materials → Live lecture.</div> : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          {liveOnes.length > 0 && (
            <div>
              <div style={{ fontSize: 11, letterSpacing: '.08em', textTransform: 'uppercase', color: '#c0392b', fontWeight: 700, marginBottom: 6 }}>● Live now</div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>{liveOnes.map((l) => <LiveRow key={l.id} l={l} accent={accent} busy={busy} onAct={act} onJoin={onJoin} onReload={load} onPlay={onPlay} />)}</div>
            </div>
          )}
          <div>
            <div style={{ fontSize: 11, letterSpacing: '.08em', textTransform: 'uppercase', color: 'var(--ink-3)', fontWeight: 700, marginBottom: 6 }}>Scheduled</div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>{rest.map((l) => <LiveRow key={l.id} l={l} accent={accent} busy={busy} onAct={act} onJoin={onJoin} onReload={load} onPlay={onPlay} />)}</div>
          </div>
        </div>
      )}
    </div>
  );
}

// Student — recorded classes (Sprint 29c/29d). Adaptive HLS playback in-app.
function PortalRecordings({ accent, onPlay }: { accent: string; onPlay: (p: PlayReq) => void }) {
  const [items, setItems] = useState<any[] | null>(null);
  useEffect(() => { portalApi('/portal/me/live/mine/recordings').then(setItems).catch(() => setItems([])); }, []);
  if (!items || items.length === 0) return null;
  return (
    <div style={{ marginBottom: 16 }}>
      <div style={{ fontSize: 11, letterSpacing: '.08em', textTransform: 'uppercase', color: 'var(--ink-3)', fontWeight: 700, marginBottom: 8 }}>Recorded classes</div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        {items.slice(0, 5).map((r) => {
          const adaptive = /\.m3u8(\?|$)/i.test(r.recordingUrl || '');
          return (
            <button key={r.id} onClick={() => onPlay({ url: r.recordingUrl, title: `${r.subject?.code} — ${r.title}` })} style={{ ...lecCard, display: 'flex', alignItems: 'center', gap: 10, border: '1px solid var(--line-soft)', cursor: 'pointer', textAlign: 'left', background: 'var(--surface-2)' }}>
              <span style={{ width: 36, height: 36, borderRadius: 10, background: 'color-mix(in srgb,' + accent + ' 14%, var(--surface))', color: accent, display: 'flex', alignItems: 'center', justifyContent: 'center' }}><Video size={17} /></span>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontWeight: 600, fontSize: 13.5 }}>{r.title} <span style={{ color: 'var(--ink-3)', fontWeight: 400, fontSize: 12 }}>· {r.subject?.code}</span></div>
                <div style={{ fontSize: 11.5, color: 'var(--ink-3)' }}>{new Date(r.scheduledAt).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })}{r.faculty ? ` · ${r.faculty}` : ''}{adaptive ? ' · adaptive HD' : ''}</div>
              </div>
              <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, fontSize: 12.5, fontWeight: 600, color: accent }}><Video size={13} /> Watch</span>
            </button>
          );
        })}
      </div>
    </div>
  );
}

// ============================ Class discussion board (spec §6.2) ============================
// Shared subject board for students + lecturers: threads, categories, replies,
// upvotes, accepted answers — plus the persisted live-class chats (scope LIVE).
function PortalDiscussions({ accent, isStudent }: { accent: string; isStudent: boolean }) {
  const CATS = ['Doubts', 'General', 'Assignments', 'Exams'];
  const [subjects, setSubjects] = useState<any[] | null>(null);
  const [subjectId, setSubjectId] = useState('');
  const [threads, setThreads] = useState<any[] | null>(null);
  const [open, setOpen] = useState<any>(null);
  const [creating, setCreating] = useState(false);
  const [f, setF] = useState({ title: '', category: 'Doubts', body: '' });
  const [reply, setReply] = useState('');
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    portalApi<any[]>(isStudent ? '/portal/me/subjects' : '/portal/me/lecturer/subjects')
      .then((s) => { setSubjects(s); if (s[0]) setSubjectId((v) => v || s[0].id); })
      .catch(() => setSubjects([]));
  }, [isStudent]);

  const loadThreads = (sid: string) => {
    setThreads(null);
    Promise.all([
      portalApi<any[]>(`/portal/me/threads?scope=SUBJECT&subjectId=${sid}`),
      portalApi<any[]>(`/portal/me/threads?scope=LIVE&subjectId=${sid}`),
    ]).then(([a, b]) => setThreads([...a, ...b].sort((x, y) => (Number(y.pinned) - Number(x.pinned)) || (+new Date(y.createdAt) - +new Date(x.createdAt)))))
      .catch(() => setThreads([]));
  };
  useEffect(() => { if (subjectId) loadThreads(subjectId); }, [subjectId]);

  const openThread = (id: string) => portalApi<any>(`/portal/me/threads/${id}`).then(setOpen).catch(() => {});
  const create = async () => {
    if (!f.title.trim() || !f.body.trim()) return;
    setBusy(true);
    try { await portalApi('/portal/me/threads', { method: 'POST', body: JSON.stringify({ scope: 'SUBJECT', subjectId, title: f.title, category: f.category, body: f.body }) }); setCreating(false); setF({ title: '', category: 'Doubts', body: '' }); loadThreads(subjectId); }
    finally { setBusy(false); }
  };
  const post = async () => {
    if (!reply.trim() || !open) return;
    setBusy(true);
    try { await portalApi(`/portal/me/threads/${open.id}/posts`, { method: 'POST', body: JSON.stringify({ body: reply }) }); setReply(''); openThread(open.id); }
    finally { setBusy(false); }
  };
  const upvote = async (pid: string) => { await portalApi(`/portal/me/posts/${pid}/upvote`, { method: 'POST' }); openThread(open.id); };
  const answer = async (pid: string) => { await portalApi(`/portal/me/posts/${pid}/answer`, { method: 'POST' }); openThread(open.id); toast.success('Marked as the answer'); };
  const hidePost = async (pid: string) => { await portalApi(`/portal/me/posts/${pid}/hide`, { method: 'POST', body: JSON.stringify({}) }); openThread(open.id); };
  const pinThread = async () => { await portalApi(`/portal/me/threads/${open.id}/pin`, { method: 'POST', body: JSON.stringify({ pinned: !open.pinned }) }); openThread(open.id); loadThreads(subjectId); };

  if (!subjects) return <LecSpinner />;

  if (open) return (
    <div>
      <button className="btn-secondary" style={{ height: 30, fontSize: 12.5, marginBottom: 12 }} onClick={() => { setOpen(null); loadThreads(subjectId); }}>← All threads</button>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        <div style={{ fontWeight: 700, fontSize: 16, flex: 1 }}>{open.title} {open.resolved && <CheckCircle2 size={15} style={{ color: 'var(--success,#1e874b)', verticalAlign: -2 }} />}</div>
        {!isStudent && <button className="btn-secondary" style={{ height: 28, fontSize: 12 }} onClick={pinThread}><Pin size={12} /> {open.pinned ? 'Unpin' : 'Pin'}</button>}
      </div>
      <div style={{ fontSize: 12, color: 'var(--ink-3)', marginBottom: 12 }}>{open.category} · started by {open.createdByName}{open.scope === 'LIVE' ? ' · saved live-class chat' : ''}</div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        {open.posts.map((p: any) => (
          <div key={p.id} style={{ ...lecCard, border: p.isAnswer ? '1px solid var(--success,#1e874b)' : undefined, opacity: p.hidden ? 0.5 : 1 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 12 }}>
              <b>{p.authorName}</b>
              {p.authorType === 'LECTURER' && <span className="badge" style={{ background: 'color-mix(in srgb, ' + accent + ' 12%, var(--surface))', color: accent }}>Lecturer</span>}
              {p.isAnswer && <span className="badge" style={{ background: 'var(--success-bg,#e6f4ea)', color: 'var(--success,#1e874b)' }}>✓ Answer</span>}
              {p.hidden && <span className="badge" style={{ background: 'var(--danger-bg,#fce8e8)', color: 'var(--danger,#c0392b)' }}>Hidden</span>}
              <span style={{ flex: 1 }} />
              <button onClick={() => upvote(p.id)} style={{ background: 'none', border: 'none', color: 'var(--ink-3)', cursor: 'pointer', display: 'inline-flex', gap: 4, alignItems: 'center', fontSize: 12 }}><ThumbsUp size={12} /> {p.upvotes}</button>
              {!isStudent && !p.isAnswer && <button className="btn-secondary" style={{ height: 26, fontSize: 11 }} onClick={() => answer(p.id)}>✓ Answer</button>}
              {!isStudent && <button className="btn-secondary" style={{ height: 26, fontSize: 11, color: 'var(--danger,#c0392b)' }} onClick={() => hidePost(p.id)}>Hide</button>}
            </div>
            <div style={{ fontSize: 13.5, marginTop: 6, whiteSpace: 'pre-wrap' }}>{p.body}</div>
          </div>
        ))}
      </div>
      <div style={{ display: 'flex', gap: 8, marginTop: 12 }}>
        <input placeholder="Write a reply…" value={reply} onChange={(e) => setReply(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && post()} style={{ flex: 1, padding: '9px 11px', borderRadius: 9, border: '1px solid var(--line-soft)', background: 'var(--surface)', fontSize: 13 }} />
        <button className="btn-primary" style={{ background: accent }} disabled={busy || !reply.trim()} onClick={post}><Send size={14} /> Reply</button>
      </div>
    </div>
  );

  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 4 }}>
        <LecHeader icon={MessagesSquare} title="Class discussions" sub="Questions, doubts and saved live-class chats — students and lecturers together" accent={accent} />
        <span style={{ flex: 1 }} />
        <button className="btn-primary" style={{ background: accent }} onClick={() => setCreating((v) => !v)}>{creating ? <X size={14} /> : <Plus size={14} />} {creating ? 'Cancel' : 'New thread'}</button>
      </div>
      <select value={subjectId} onChange={(e) => setSubjectId(e.target.value)} style={{ padding: '8px 11px', borderRadius: 9, border: '1px solid var(--line-soft)', background: 'var(--surface)', fontSize: 13, marginBottom: 12 }}>
        {subjects.map((s: any) => <option key={s.id} value={s.id}>{s.code} — {s.name}</option>)}
      </select>
      {creating && (
        <div style={{ ...lecCard, marginBottom: 12, display: 'flex', flexDirection: 'column', gap: 8 }}>
          <input placeholder="Thread title" value={f.title} onChange={(e) => setF({ ...f, title: e.target.value })} style={{ padding: '9px 11px', borderRadius: 9, border: '1px solid var(--line-soft)', background: 'var(--surface)', fontSize: 13 }} />
          <select value={f.category} onChange={(e) => setF({ ...f, category: e.target.value })} style={{ padding: '8px 11px', borderRadius: 9, border: '1px solid var(--line-soft)', background: 'var(--surface)', fontSize: 13 }}>
            {CATS.map((c) => <option key={c} value={c}>{c}</option>)}
          </select>
          <textarea placeholder="What do you want to discuss?" rows={3} value={f.body} onChange={(e) => setF({ ...f, body: e.target.value })} style={{ padding: '9px 11px', borderRadius: 9, border: '1px solid var(--line-soft)', background: 'var(--surface)', fontSize: 13, resize: 'vertical' }} />
          <button className="btn-primary" style={{ background: accent, alignSelf: 'flex-start' }} disabled={busy || !f.title.trim() || !f.body.trim()} onClick={create}><Send size={14} /> Post thread</button>
        </div>
      )}
      {!threads ? <LecSpinner /> : threads.length === 0 ? <div style={{ ...lecCard, color: 'var(--ink-3)', fontSize: 13 }}>No threads yet — start the first discussion.</div> : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {threads.map((t) => (
            <button key={t.id} onClick={() => openThread(t.id)} style={{ ...lecCard, textAlign: 'left', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 10 }}>
              <span style={{ width: 36, height: 36, borderRadius: 10, background: 'color-mix(in srgb, ' + accent + ' 12%, var(--surface))', color: accent, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>{t.scope === 'LIVE' ? <Radio size={16} /> : <MessagesSquare size={16} />}</span>
              <span style={{ flex: 1, minWidth: 0 }}>
                <span style={{ display: 'flex', alignItems: 'center', gap: 6, fontWeight: 600, fontSize: 13.5 }}>
                  {t.pinned && <Pin size={12} style={{ color: accent }} />}
                  <span style={{ whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{t.title}</span>
                  {t.resolved && <CheckCircle2 size={13} style={{ color: 'var(--success,#1e874b)' }} />}
                </span>
                <span style={{ display: 'block', fontSize: 11.5, color: 'var(--ink-3)' }}>{t.scope === 'LIVE' ? 'Live-class chat' : t.category} · {t.createdByName} · {new Date(t.createdAt).toLocaleDateString('en-IN', { day: '2-digit', month: 'short' })}</span>
              </span>
              <span className="badge" style={{ background: 'var(--surface)', color: 'var(--ink-3)' }}>{t._count?.posts ?? 0} posts</span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

// ============================ Student weekly timetable ============================
function StudentTimetable({ accent }: { accent: string }) {
  const [data, setData] = useState<any>(null);
  useEffect(() => { portalApi('/portal/me/timetable').then(setData).catch(() => setData({ days: [], slots: [], entries: [] })); }, []);
  if (!data) return <LecSpinner />;

  const todayIdx = (new Date().getDay() + 6) % 7; // JS Sun=0 → Mon=0
  // Only weekdays that actually have classes, plus keep Mon–Fri visible.
  const usedDays = new Set<number>(data.entries.map((e: any) => e.dayOfWeek));
  const dayIdxs = data.days.map((_: string, i: number) => i).filter((i: number) => i < 5 || usedDays.has(i));
  const cell = (day: number, slotId: string) => data.entries.find((e: any) => e.dayOfWeek === day && e.timeSlotId === slotId);

  if (data.slots.length === 0 || data.entries.length === 0) {
    return (
      <div>
        <LecHeader icon={CalendarDays} title="My timetable" sub="Your weekly class schedule" accent={accent} />
        <div style={{ ...lecCard, color: 'var(--ink-3)', fontSize: 13, marginTop: 8 }}>No timetable has been published for your batch yet.</div>
      </div>
    );
  }

  return (
    <div>
      <LecHeader icon={CalendarDays} title="My timetable" sub="Your weekly class schedule" accent={accent} />
      <div style={{ overflowX: 'auto', marginTop: 10 }}>
        <table style={{ borderCollapse: 'separate', borderSpacing: 6, minWidth: 640 }}>
          <thead>
            <tr>
              <th style={{ textAlign: 'left', fontSize: 11, letterSpacing: '.06em', textTransform: 'uppercase', color: 'var(--ink-3)', padding: '4px 8px' }}>Period</th>
              {dayIdxs.map((di: number) => (
                <th key={di} style={{ fontSize: 12, fontWeight: 700, color: di === todayIdx ? accent : 'var(--ink-2)', padding: '4px 8px', minWidth: 120 }}>
                  {data.days[di].slice(0, 3)}{di === todayIdx ? ' • today' : ''}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {data.slots.map((slot: any) => (
              <tr key={slot.id}>
                <td style={{ fontSize: 11.5, color: 'var(--ink-3)', whiteSpace: 'nowrap', padding: '4px 8px', fontVariantNumeric: 'tabular-nums' }}>
                  <div style={{ fontWeight: 700, color: 'var(--ink-2)' }}>{slot.name}</div>
                  <div>{slot.startTime}–{slot.endTime}</div>
                </td>
                {dayIdxs.map((di: number) => {
                  const c = cell(di, slot.id);
                  return (
                    <td key={di} style={{ verticalAlign: 'top' }}>
                      {c ? (
                        <div style={{ background: di === todayIdx ? `color-mix(in srgb, ${accent} 10%, var(--surface-2))` : 'var(--surface-2)', border: `1px solid ${di === todayIdx ? accent : 'var(--line-soft)'}`, borderRadius: 10, padding: '8px 10px', minHeight: 52 }}>
                          <div style={{ fontWeight: 700, fontSize: 12.5 }}>{c.subject.code}</div>
                          <div style={{ fontSize: 11, color: 'var(--ink-2)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', maxWidth: 130 }}>{c.subject.name}</div>
                          <div style={{ fontSize: 10.5, color: 'var(--ink-3)', marginTop: 2 }}>{c.faculty ?? ''}{c.room ? ` · ${c.room}` : ''}</div>
                        </div>
                      ) : <div style={{ minHeight: 52, borderRadius: 10, border: '1px dashed var(--line-soft)' }} />}
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// ============================ Personal notifications feed ============================
// Real feed = announcements (institute-wide / batch) + replies & answers on the
// threads you started. Unread is tracked with a client-side "last seen" marker.
function PortalNotifications({ accent, onOpenDiscussions }: { accent: string; onOpenDiscussions: () => void }) {
  const [items, setItems] = useState<any[] | null>(null);
  const [lastSeen, setLastSeen] = useState<number>(() => { try { return Number(localStorage.getItem('bmn_notif_seen') || 0); } catch { return 0; } });

  useEffect(() => {
    Promise.all([
      portalApi<any[]>('/portal/me/announcements').catch(() => []),
      portalApi<any[]>('/portal/me/notifications').catch(() => []),
    ]).then(([anns, notes]) => {
      const feed = [
        ...anns.map((a) => ({ kind: 'announcement', title: a.title, body: a.body ?? '', at: a.publishedAt ?? a.createdAt, pinned: a.pinned })),
        ...notes.map((n) => ({ kind: n.kind, title: n.title, body: n.body, at: n.at, threadId: n.threadId })),
      ].sort((x, y) => +new Date(y.at) - +new Date(x.at));
      setItems(feed);
    });
  }, []);

  const markAllRead = () => { const now = Date.now(); localStorage.setItem('bmn_notif_seen', String(now)); setLastSeen(now); };
  const ICON: Record<string, string> = { announcement: '📢', reply: '💬', answer: '✅' };
  const unread = (items ?? []).filter((i) => +new Date(i.at) > lastSeen).length;

  if (!items) return <LecSpinner />;
  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 4 }}>
        <LecHeader icon={Bell} title="Notifications" sub="Announcements and activity on your discussions" accent={accent} />
        <span style={{ flex: 1 }} />
        {unread > 0 && <button className="btn-secondary" style={{ height: 30, fontSize: 12.5 }} onClick={markAllRead}>Mark all read</button>}
      </div>
      {items.length === 0 ? (
        <div style={{ ...lecCard, color: 'var(--ink-3)', fontSize: 13, marginTop: 8 }}>You&apos;re all caught up — no notifications yet.</div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginTop: 8 }}>
          {items.map((n, i) => {
            const isUnread = +new Date(n.at) > lastSeen;
            const clickable = n.kind === 'reply' || n.kind === 'answer';
            return (
              <div key={i} onClick={clickable ? onOpenDiscussions : undefined}
                style={{ ...lecCard, display: 'flex', gap: 10, cursor: clickable ? 'pointer' : 'default', borderLeft: isUnread ? `3px solid ${accent}` : '3px solid transparent' }}>
                <span style={{ fontSize: 18 }}>{ICON[n.kind] ?? '🔔'}</span>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                    <span style={{ fontWeight: 700, fontSize: 13.5 }}>{n.title}</span>
                    {n.pinned && <Pin size={12} style={{ color: accent }} />}
                    {isUnread && <span style={{ width: 7, height: 7, borderRadius: 99, background: accent }} />}
                  </div>
                  {n.body && <div style={{ fontSize: 12.5, color: 'var(--ink-2)', marginTop: 3, whiteSpace: 'pre-wrap' }}>{n.body}</div>}
                  <div style={{ fontSize: 11, color: 'var(--ink-3)', marginTop: 3 }}>{new Date(n.at).toLocaleString('en-IN', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })}</div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

// ============================ Parent — children overview ============================
function ParentChildrenOverview({ accent, onGo }: { accent: string; onGo: (tab: string) => void }) {
  const [rows, setRows] = useState<any[] | null>(null);
  useEffect(() => {
    portalApi<any[]>('/portal/me/children').then(async (kids) => {
      const withSummary = await Promise.all(kids.map(async (k) => {
        const [att, fees] = await Promise.all([
          portalApi<any>(`/portal/me/children/${k.id}/attendance`).catch(() => null),
          portalApi<any>(`/portal/me/children/${k.id}/fees`).catch(() => null),
        ]);
        return { ...k, attendancePct: att?.overallPct ?? null, feeDue: fees?.summary?.totalDue ?? 0 };
      }));
      setRows(withSummary);
    }).catch(() => setRows([]));
  }, []);

  if (!rows) return <LecSpinner />;
  return (
    <div>
      <LecHeader icon={Users} title="My children" sub="A quick summary for each child — tap through for detail" accent={accent} />
      {rows.length === 0 ? (
        <div style={{ ...lecCard, color: 'var(--ink-3)', fontSize: 13, marginTop: 8 }}>No children are linked to your account yet.</div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(260px,1fr))', gap: 12, marginTop: 10 }}>
          {rows.map((c) => (
            <div key={c.id} style={{ ...lecCard, display: 'flex', flexDirection: 'column', gap: 10 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <span style={{ width: 40, height: 40, borderRadius: 10, background: accent, color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 800 }}>{c.firstName?.[0] ?? '?'}</span>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontWeight: 700, fontSize: 14 }}>{c.firstName} {c.lastName ?? ''}</div>
                  <div style={{ fontSize: 11.5, color: 'var(--ink-3)' }}>{c.admissionNo}</div>
                </div>
              </div>
              <div style={{ display: 'flex', gap: 8 }}>
                <div style={{ flex: 1, background: 'var(--surface-2)', borderRadius: 8, padding: '8px 10px' }}>
                  <div style={{ fontSize: 10.5, letterSpacing: '.06em', textTransform: 'uppercase', color: 'var(--ink-3)', fontWeight: 700 }}>Attendance</div>
                  <div style={{ fontSize: 16, fontWeight: 800, color: c.attendancePct != null && c.attendancePct < 75 ? 'var(--danger,#c0392b)' : 'var(--ink-1)' }}>{c.attendancePct != null ? `${c.attendancePct}%` : '—'}</div>
                </div>
                <div style={{ flex: 1, background: 'var(--surface-2)', borderRadius: 8, padding: '8px 10px' }}>
                  <div style={{ fontSize: 10.5, letterSpacing: '.06em', textTransform: 'uppercase', color: 'var(--ink-3)', fontWeight: 700 }}>Fee due</div>
                  <div style={{ fontSize: 16, fontWeight: 800, color: c.feeDue > 0 ? 'var(--danger,#c0392b)' : 'var(--success,#1e874b)' }}>{c.feeDue > 0 ? `₹${c.feeDue.toLocaleString('en-IN')}` : 'Clear'}</div>
                </div>
              </div>
              <div style={{ display: 'flex', gap: 6 }}>
                {['Attendance', 'Grades', 'Fees'].map((t) => (
                  <button key={t} onClick={() => onGo(t)} style={{ flex: 1, border: '1px solid var(--line-soft)', background: 'var(--surface)', borderRadius: 8, padding: '6px 0', fontSize: 12, fontWeight: 600, cursor: 'pointer', color: 'var(--ink-2)' }}>{t}</button>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
