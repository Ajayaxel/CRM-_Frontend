'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { ShieldCheck, LogOut, KeyRound, X } from 'lucide-react';
import { toast } from 'sonner';
import { apiErrorMessage } from '@/lib/api';
import {
  COOKIE_SESSION, platformApi, takeLegacyPlatformToken, usePlatformAuth,
} from '@/features/platform/platform-client';
import { navFor } from '@/features/platform/capabilities';

export default function PlatformLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const { admin, ready, token, setAdmin, setReady, setAuth, clear } = usePlatformAuth();
  const [changing, setChanging] = useState(false);
  const [booted, setBooted] = useState(false);
  const isLogin = pathname === '/platform/login';

  useEffect(() => {
    if (booted) return;
    setBooted(true);
    // The session is the httpOnly cookie; ask the API who it belongs to. A token
    // left in storage by the previous version is used once, in memory, and gone.
    const legacy = takeLegacyPlatformToken();
    (async () => {
      try {
        setAuth(legacy ?? COOKIE_SESSION, { id: '', email: '', name: '', role: '' });
        const me = await platformApi.get('/auth/me');
        setAdmin(me.data);
      } catch {
        clear();
      } finally {
        setReady(true);
      }
    })();
  }, [booted, clear, setAdmin, setAuth, setReady]);

  useEffect(() => {
    if (ready && !token && !isLogin) router.replace('/platform/login');
  }, [ready, token, isLogin, router]);

  if (isLogin) return <>{children}</>;

  // Children do not render until the ROLE is known, not merely the token.
  //
  // Every page below decides what to fetch from the role, and the boot seeds a
  // placeholder admin with an empty role so the interceptor has a token to
  // send. Rendering during that window would let a page fire its queries
  // against a role of '' — which the capability map answers "no" to, so the
  // page would settle into a permanently empty state instead of loading.
  if (!ready || !token || !admin?.role) {
    return <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--ink-3)' }}>Loading…</div>;
  }

  const nav = navFor(admin.role);

  return (
    <div style={{ minHeight: '100vh', background: 'var(--bg)' }}>
      <header style={{ height: 60, borderBottom: '1px solid var(--line-soft)', background: 'var(--surface)', display: 'flex', alignItems: 'center', padding: '0 32px', gap: 12 }}>
        <span style={{ width: 34, height: 34, borderRadius: 10, background: 'linear-gradient(135deg,#1B2C8C,#0D1854)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <ShieldCheck size={18} color="#fff" strokeWidth={1.9} />
        </span>
        <div style={{ lineHeight: 1.1 }}>
          <div style={{ fontWeight: 700, fontSize: 14 }}>BMN Connect</div>
          <div style={{ fontSize: 11, color: 'var(--ink-3)' }}>Platform Console</div>
        </div>
        <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 14 }}>
          <div style={{ textAlign: 'right', lineHeight: 1.2 }}>
            <div style={{ fontSize: 13, fontWeight: 600 }}>{admin?.name}</div>
            <div style={{ fontSize: 11, color: 'var(--ink-3)' }}>{admin?.role?.replace('_', ' ')}</div>
          </div>
          <button className="btn-secondary" style={{ height: 36 }} onClick={() => setChanging(true)}>
            <KeyRound size={15} /> Password
          </button>
          <button className="btn-secondary" style={{ height: 36 }} onClick={() => { platformApi.post('/auth/logout').catch(() => undefined).finally(() => { clear(); router.replace('/platform/login'); }); }}>
            <LogOut size={15} /> Sign out
          </button>
        </div>
      </header>
      {/* Only what this role can actually reach. The guard still refuses the
          rest; this stops the console advertising doors that do not open. */}
      <nav style={{ borderBottom: '1px solid var(--line-soft)', background: 'var(--surface)', padding: '0 32px', display: 'flex', gap: 4 }}>
        {nav.map((item) => {
          const active = item.href === '/platform' ? pathname === '/platform' : pathname?.startsWith(item.href);
          return (
            <Link key={item.href} href={item.href}
              style={{
                padding: '12px 14px', fontSize: 13.5, textDecoration: 'none',
                fontWeight: active ? 650 : 500,
                color: active ? 'var(--navy)' : 'var(--ink-2)',
                borderBottom: `2px solid ${active ? 'var(--navy)' : 'transparent'}`,
                marginBottom: -1,
              }}>
              {item.label}
            </Link>
          );
        })}
      </nav>
      <main style={{ maxWidth: 1240, margin: '0 auto', padding: '28px 32px 60px' }}>{children}</main>
      {changing && <ChangePasswordModal onClose={() => setChanging(false)} />}
    </div>
  );
}

/**
 * Self-service password change. Before this, the only way to change a platform
 * admin's password was re-running the bootstrap script with --reset, which needs
 * database access — so in practice nobody rotated one.
 */
function ChangePasswordModal({ onClose }: { onClose: () => void }) {
  const { admin, setAuth } = usePlatformAuth();
  const [current, setCurrent] = useState('');
  const [next, setNext] = useState('');
  const [confirm, setConfirm] = useState('');
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState<string | null>(null);

  // Checked here for a fast, clear message; the server enforces both again,
  // because a browser check is a courtesy and not a control.
  const tooShort = next.length > 0 && next.length < 12;
  const mismatch = confirm.length > 0 && next !== confirm;
  const canSubmit = current && next.length >= 12 && next === confirm && next !== current && !busy;

  const submit = async () => {
    setBusy(true);
    try {
      const r = await platformApi.post('/auth/change-password', { currentPassword: current, newPassword: next });
      // The change invalidated every token for this admin, including the one
      // this tab is holding. The server issues a replacement; adopt it or the
      // next request 401s and boots you to the login screen.
      if (r.data?.accessToken && admin) setAuth(r.data.accessToken, admin);
      setNote(r.data?.note ?? null);
      toast.success('Password changed');
      setCurrent(''); setNext(''); setConfirm('');
    } catch (e) {
      toast.error(apiErrorMessage(e));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div
      onClick={onClose}
      style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,.45)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 60, padding: 20 }}
    >
      <div onClick={(e) => e.stopPropagation()} style={{ background: 'var(--surface)', borderRadius: 16, padding: 22, width: 'min(420px,100%)', border: '1px solid var(--line-soft)' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
          <div style={{ fontWeight: 700, fontSize: 16 }}>Change your password</div>
          <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--ink-3)' }}><X size={18} /></button>
        </div>

        {note ? (
          <>
            <div style={{ background: 'var(--success-bg)', color: 'var(--ink)', borderRadius: 10, padding: 12, fontSize: 13 }}>
              Password changed. {note}
            </div>
            <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 16 }}>
              <button className="btn-primary" onClick={onClose}>Done</button>
            </div>
          </>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 11 }}>
            <div>
              <label className="label">Current password</label>
              <input className="input" type="password" autoComplete="current-password" value={current} onChange={(e) => setCurrent(e.target.value)} />
            </div>
            <div>
              <label className="label">New password</label>
              <input className="input" type="password" autoComplete="new-password" value={next} onChange={(e) => setNext(e.target.value)} />
              {tooShort && <div style={{ fontSize: 11.5, color: 'var(--danger)', marginTop: 4 }}>At least 12 characters.</div>}
            </div>
            <div>
              <label className="label">Confirm new password</label>
              <input className="input" type="password" autoComplete="new-password" value={confirm} onChange={(e) => setConfirm(e.target.value)} />
              {mismatch && <div style={{ fontSize: 11.5, color: 'var(--danger)', marginTop: 4 }}>These do not match.</div>}
            </div>
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10, marginTop: 6 }}>
              <button className="btn-secondary" onClick={onClose}>Cancel</button>
              <button className="btn-primary" disabled={!canSubmit} onClick={submit}>{busy ? 'Saving…' : 'Change password'}</button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
