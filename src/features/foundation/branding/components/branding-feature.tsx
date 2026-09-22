'use client';

import { useEffect, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { Palette, GraduationCap, Check, Wallet, Award } from 'lucide-react';
import { api, apiErrorMessage } from '@/lib/api';

const card: React.CSSProperties = { background: 'var(--surface)', border: '1px solid var(--line-soft)', borderRadius: 16 };
const inp: React.CSSProperties = { padding: '9px 11px', borderRadius: 9, border: '1px solid var(--line-soft)', background: 'var(--surface)', fontSize: 13, width: '100%' };
const isHex = (s: string) => /^#([0-9a-fA-F]{6})$/.test(s);

interface OrgProfile { name: string; logoUrl?: string | null; primaryColor?: string | null; tagline?: string | null }

export function BrandingFeature() {
  const qc = useQueryClient();
  const { data: org } = useQuery({ queryKey: ['org-profile'], queryFn: async () => (await api.get<OrgProfile>('/organization')).data });
  const [f, setF] = useState({ logoUrl: '', primaryColor: '#4f46e5', tagline: '' });
  useEffect(() => { if (org) setF({ logoUrl: org.logoUrl ?? '', primaryColor: org.primaryColor || '#4f46e5', tagline: org.tagline ?? '' }); }, [org]);

  const save = useMutation({
    mutationFn: async () => (await api.patch('/organization/branding', { logoUrl: f.logoUrl || undefined, primaryColor: isHex(f.primaryColor) ? f.primaryColor : undefined, tagline: f.tagline || undefined })).data,
    onSuccess: () => { toast.success('Branding saved — portals now use it'); qc.invalidateQueries({ queryKey: ['org-profile'] }); },
    onError: (e) => toast.error(apiErrorMessage(e)),
  });

  const accent = isHex(f.primaryColor) ? f.primaryColor : '#4f46e5';
  const name = org?.name ?? 'Your Institute';

  return (
    <div style={{ animation: 'fadeUp .4s ease' }}>
      <div style={{ marginBottom: 18 }}>
        <h1 style={{ fontSize: 26, fontWeight: 700, letterSpacing: '-.02em', margin: 0 }}>Branding</h1>
        <p style={{ fontSize: 14, color: 'var(--ink-2)', margin: '6px 0 0' }}>White-label the student, parent and lecturer portals and public certificate pages with your identity.</p>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '360px 1fr', gap: 16, alignItems: 'start' }}>
        <div style={{ ...card, padding: 20 }}>
          <div style={{ fontWeight: 700, fontSize: 15, marginBottom: 14 }}>Identity</div>
          <label style={{ fontSize: 12, color: 'var(--ink-3)', fontWeight: 600 }}>Logo URL
            <input placeholder="https://…/logo.png" value={f.logoUrl} onChange={(e) => setF({ ...f, logoUrl: e.target.value })} style={{ ...inp, marginTop: 5 }} />
          </label>
          <label style={{ fontSize: 12, color: 'var(--ink-3)', fontWeight: 600, display: 'block', marginTop: 14 }}>Primary colour
            <div style={{ display: 'flex', gap: 8, marginTop: 5, alignItems: 'center' }}>
              <input type="color" value={accent} onChange={(e) => setF({ ...f, primaryColor: e.target.value })} style={{ width: 44, height: 38, borderRadius: 9, border: '1px solid var(--line-soft)', background: 'none', cursor: 'pointer', padding: 2 }} />
              <input value={f.primaryColor} onChange={(e) => setF({ ...f, primaryColor: e.target.value })} style={{ ...inp, fontFamily: 'var(--mono)' }} />
            </div>
            {!isHex(f.primaryColor) && <span style={{ fontSize: 11, color: 'var(--danger,#c0392b)' }}>Enter a 6-digit hex like #4f46e5</span>}
          </label>
          <label style={{ fontSize: 12, color: 'var(--ink-3)', fontWeight: 600, display: 'block', marginTop: 14 }}>Portal tagline
            <input placeholder="e.g. Learning portal" value={f.tagline} onChange={(e) => setF({ ...f, tagline: e.target.value })} style={{ ...inp, marginTop: 5 }} />
          </label>
          <button className="btn-primary" style={{ background: accent, marginTop: 18, width: '100%' }} disabled={save.isPending || !isHex(f.primaryColor)} onClick={() => save.mutate()}><Check size={14} /> Save branding</button>
        </div>

        {/* Live preview */}
        <div>
          <div style={{ fontSize: 11, letterSpacing: '.08em', textTransform: 'uppercase', color: 'var(--ink-3)', fontWeight: 700, marginBottom: 8 }}>Live preview</div>
          <div style={{ ...card, overflow: 'hidden' }}>
            <div style={{ background: 'var(--surface-2)', padding: 20 }}>
              {/* portal header */}
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 16 }}>
                {f.logoUrl
                  ? <img src={f.logoUrl} alt="logo" style={{ width: 34, height: 34, borderRadius: 9, objectFit: 'cover' }} />
                  : <span style={{ width: 34, height: 34, borderRadius: 9, background: accent, color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center' }}><GraduationCap size={18} /></span>}
                <div><div style={{ fontWeight: 700, fontSize: 15 }}>{name}</div><div style={{ fontSize: 11.5, color: 'var(--ink-3)' }}>{f.tagline || 'Learning portal'}</div></div>
              </div>
              {/* identity card */}
              <div style={{ ...card, padding: 16, display: 'flex', alignItems: 'center', gap: 12 }}>
                <span style={{ width: 46, height: 46, borderRadius: 13, background: accent, color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 800, fontSize: 18 }}>A</span>
                <div style={{ flex: 1 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}><span style={{ fontWeight: 700, fontSize: 16 }}>Aarav Sharma</span><span className="badge" style={{ background: 'color-mix(in srgb, ' + accent + ' 14%, var(--surface))', color: accent }}>Student</span></div>
                  <div style={{ fontSize: 12.5, color: 'var(--ink-3)' }}>Admission ADM-A-001</div>
                </div>
              </div>
              {/* sample controls */}
              <div style={{ display: 'flex', gap: 8, marginTop: 12, alignItems: 'center' }}>
                <button style={{ border: 'none', cursor: 'default', borderRadius: 9, padding: '9px 16px', fontSize: 13, fontWeight: 600, background: accent, color: '#fff', display: 'inline-flex', gap: 6, alignItems: 'center' }}><Wallet size={14} /> Pay fees</button>
                <span className="badge" style={{ background: 'color-mix(in srgb, ' + accent + ' 12%, var(--surface))', color: accent, display: 'inline-flex', gap: 4, alignItems: 'center' }}><Award size={12} /> Grade A</span>
                <div style={{ flex: 1, height: 7, borderRadius: 99, background: 'var(--surface)', overflow: 'hidden' }}><div style={{ width: '82%', height: '100%', background: accent }} /></div>
              </div>
            </div>
          </div>
          <div style={{ fontSize: 12, color: 'var(--ink-3)', marginTop: 10 }}>This is exactly how the accent, logo and tagline appear across the learning portals and the public certificate verification page.</div>
        </div>
      </div>
    </div>
  );
}
