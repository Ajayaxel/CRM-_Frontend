'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { ShieldCheck } from 'lucide-react';
import { platformApi, usePlatformAuth } from '@/features/platform/platform-client';
import { apiErrorMessage } from '@/lib/api';

export default function PlatformLoginPage() {
  const router = useRouter();
  const { setAuth } = usePlatformAuth();
  const [email, setEmail] = useState('admin@bmntech.io');
  const [password, setPassword] = useState('Platform123!');
  const [loading, setLoading] = useState(false);

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      const res = await platformApi.post('/auth/login', { email, password });
      setAuth(res.data.accessToken, res.data.admin);
      router.push('/platform');
    } catch (err) {
      toast.error(apiErrorMessage(err));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'linear-gradient(150deg,#1B2C8C,#0D1854)', padding: 20 }}>
      <div style={{ width: '100%', maxWidth: 400, background: 'var(--surface)', borderRadius: 20, padding: 32, boxShadow: '0 24px 60px rgba(0,0,0,.3)' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 11, marginBottom: 24 }}>
          <span style={{ width: 40, height: 40, borderRadius: 12, background: 'linear-gradient(135deg,#1B2C8C,#0D1854)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <ShieldCheck size={22} color="#fff" strokeWidth={1.9} />
          </span>
          <div>
            <div style={{ fontWeight: 700, fontSize: 16 }}>BMN Connect</div>
            <div style={{ fontSize: 12, color: 'var(--ink-3)' }}>Platform Console</div>
          </div>
        </div>
        <h1 style={{ fontSize: 22, fontWeight: 700, margin: '0 0 4px' }}>Admin sign in</h1>
        <p style={{ fontSize: 13.5, color: 'var(--ink-3)', margin: '0 0 22px' }}>Manage your institute clients.</p>
        <form onSubmit={onSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          <div>
            <label className="label">Email</label>
            <input className="input" type="email" value={email} onChange={(e) => setEmail(e.target.value)} required />
          </div>
          <div>
            <label className="label">Password</label>
            <input className="input" type="password" value={password} onChange={(e) => setPassword(e.target.value)} required />
          </div>
          <button type="submit" className="btn-primary" style={{ width: '100%' }} disabled={loading}>
            {loading ? 'Signing in…' : 'Sign in'}
          </button>
        </form>
      </div>
    </div>
  );
}
