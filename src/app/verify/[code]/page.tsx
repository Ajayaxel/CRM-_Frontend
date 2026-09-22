'use client';

import { use, useEffect, useState } from 'react';
import { BadgeCheck, XCircle, ShieldCheck } from 'lucide-react';

interface VerifyResult {
  valid: boolean; revoked: boolean; serial: string; code: string; type: string; title: string;
  grade?: string | null; issuedOn: string; student: string; admissionNo: string; course?: string | null; organization: string;
  brandColor?: string | null; brandLogo?: string | null;
}

export default function VerifyPage({ params }: { params: Promise<{ code: string }> }) {
  const { code } = use(params);
  const [state, setState] = useState<'loading' | 'notfound' | 'ok'>('loading');
  const [data, setData] = useState<VerifyResult | null>(null);

  useEffect(() => {
    fetch(`/api/certificates/verify/${encodeURIComponent(code)}`)
      .then((r) => (r.ok ? r.json() : Promise.reject(r.status)))
      .then((d) => { setData(d); setState('ok'); })
      .catch(() => setState('notfound'));
  }, [code]);

  const wrap: React.CSSProperties = { minHeight: '100vh', background: 'var(--surface-2,#f5f5f4)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 };
  const box: React.CSSProperties = { background: 'var(--surface,#fff)', border: '1px solid var(--line-soft,#e7e5e4)', borderRadius: 18, width: 560, maxWidth: '100%', padding: 32, boxShadow: '0 12px 40px rgba(0,0,0,.08)' };

  if (state === 'loading') return <div style={wrap}><div style={{ ...box, textAlign: 'center', color: 'var(--ink-3,#78716c)' }}>Verifying…</div></div>;

  if (state === 'notfound') return (
    <div style={wrap}>
      <div style={{ ...box, textAlign: 'center' }}>
        <XCircle size={44} style={{ color: '#c0392b' }} />
        <h1 style={{ fontSize: 20, fontWeight: 800, margin: '14px 0 6px' }}>Certificate not found</h1>
        <p style={{ fontSize: 14, color: 'var(--ink-3,#78716c)' }}>No certificate matches the code <b style={{ fontFamily: 'monospace' }}>{code}</b>. Please check the link and try again.</p>
      </div>
    </div>
  );

  const d = data!;
  const invalid = d.revoked || !d.valid;
  const accent = d.brandColor || '#132376';
  return (
    <div style={wrap}>
      <div style={box}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, justifyContent: 'center', color: invalid ? '#c0392b' : '#1e874b', fontWeight: 800, fontSize: 13, letterSpacing: '.04em', textTransform: 'uppercase' }}>
          {invalid ? <XCircle size={18} /> : <ShieldCheck size={18} />} {invalid ? 'Revoked certificate' : 'Verified authentic'}
        </div>
        <div style={{ border: `2px solid ${invalid ? '#c0392b' : accent}`, borderRadius: 14, padding: '34px 40px', textAlign: 'center', marginTop: 18, opacity: invalid ? 0.7 : 1 }}>
          {d.brandLogo && <img src={d.brandLogo} alt={d.organization} style={{ height: 40, objectFit: 'contain', marginBottom: 10 }} />}
          <div style={{ fontSize: 12, letterSpacing: '.18em', textTransform: 'uppercase', color: 'var(--ink-3,#78716c)', fontWeight: 700 }}>{d.organization}</div>
          <div style={{ width: 46, height: 3, background: accent, margin: '14px auto' }} />
          <div style={{ display: 'inline-flex', alignItems: 'center', gap: 8, fontSize: 23, fontWeight: 800, color: accent }}><BadgeCheck size={22} /> {d.title}</div>
          <div style={{ fontSize: 13, color: 'var(--ink-3,#78716c)', marginTop: 16 }}>Awarded to</div>
          <div style={{ fontSize: 26, fontWeight: 800, margin: '6px 0' }}>{d.student}</div>
          {d.course && <div style={{ fontSize: 14, color: 'var(--ink-2,#44403c)' }}>for <b>{d.course}</b></div>}
          {d.grade && <div style={{ fontSize: 13.5, marginTop: 6 }}>Grade: <b style={{ color: accent }}>{d.grade}</b></div>}
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 10, marginTop: 16, fontSize: 12 }}>
          {[['Serial', d.serial], ['Issued', new Date(d.issuedOn).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })], ['Code', d.code]].map(([l, v]) => (
            <div key={l} style={{ background: 'var(--surface-2,#f5f5f4)', borderRadius: 10, padding: '10px 12px', textAlign: 'center' }}>
              <div style={{ fontWeight: 700, fontFamily: 'monospace', fontSize: 12.5 }}>{v}</div>
              <div style={{ color: 'var(--ink-3,#78716c)', fontSize: 11 }}>{l}</div>
            </div>
          ))}
        </div>
        <div style={{ textAlign: 'center', marginTop: 16, fontSize: 11.5, color: 'var(--ink-3,#78716c)' }}>Verified via BMN Connect · admission {d.admissionNo}</div>
      </div>
    </div>
  );
}
