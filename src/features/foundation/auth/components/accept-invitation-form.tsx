'use client';

import { Suspense, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { toast } from 'sonner';
import { api, apiErrorMessage } from '@/lib/api';
import { useAuthStore } from '../store/auth-store';

function AcceptFormInner() {
  const params = useSearchParams();
  const router = useRouter();
  const token = params.get('token') ?? '';
  const { setAuth } = useAuthStore();
  const [form, setForm] = useState({ firstName: '', lastName: '', password: '' });
  const [loading, setLoading] = useState(false);

  const set = (k: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement>) =>
    setForm({ ...form, [k]: e.target.value });

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      const res = await api.post('/auth/accept-invitation', { token, ...form });
      setAuth(res.data.accessToken, res.data.user);
      toast.success('Welcome to the team!');
      router.push('/dashboard');
    } catch (err) {
      toast.error(apiErrorMessage(err));
    } finally {
      setLoading(false);
    }
  };

  if (!token) {
    return <p className="text-sm" style={{ color: 'var(--ink-3)' }}>This invitation link is invalid.</p>;
  }

  return (
    <div>
      <h2 className="text-2xl font-bold" style={{ color: 'var(--ink)' }}>Accept your invitation</h2>
      <p className="mt-1 text-sm" style={{ color: 'var(--ink-3)' }}>Set up your profile to get started.</p>
      <form onSubmit={onSubmit} className="mt-8 space-y-4">
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="label">First name</label>
            <input className="input" value={form.firstName} onChange={set('firstName')} required />
          </div>
          <div>
            <label className="label">Last name</label>
            <input className="input" value={form.lastName} onChange={set('lastName')} />
          </div>
        </div>
        <div>
          <label className="label">Create password</label>
          <input className="input" type="password" value={form.password} onChange={set('password')} required minLength={8} />
        </div>
        <button type="submit" className="btn-primary w-full" disabled={loading}>
          {loading ? 'Setting up…' : 'Join organization'}
        </button>
      </form>
    </div>
  );
}

export function AcceptInvitationForm() {
  return (
    <Suspense fallback={<div style={{ color: 'var(--ink-2)' }}>Loading…</div>}>
      <AcceptFormInner />
    </Suspense>
  );
}
