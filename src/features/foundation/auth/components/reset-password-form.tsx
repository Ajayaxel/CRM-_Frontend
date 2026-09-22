'use client';

import { Suspense, useState } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { toast } from 'sonner';
import { api, apiErrorMessage } from '@/lib/api';

function ResetFormInner() {
  const params = useSearchParams();
  const router = useRouter();
  const token = params.get('token') ?? '';
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      await api.post('/auth/reset-password', { token, password });
      toast.success('Password reset. Please sign in.');
      router.push('/login');
    } catch (err) {
      toast.error(apiErrorMessage(err));
    } finally {
      setLoading(false);
    }
  };

  if (!token) {
    return (
      <div>
        <h2 className="text-2xl font-bold" style={{ color: 'var(--ink)' }}>Invalid link</h2>
        <p className="mt-2 text-sm" style={{ color: 'var(--ink-3)' }}>This reset link is missing or invalid.</p>
        <Link href="/forgot-password" className="btn-secondary mt-6 w-full">Request a new link</Link>
      </div>
    );
  }

  return (
    <div>
      <h2 className="text-2xl font-bold" style={{ color: 'var(--ink)' }}>Set a new password</h2>
      <form onSubmit={onSubmit} className="mt-8 space-y-4">
        <div>
          <label className="label">New password</label>
          <input
            className="input"
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            minLength={8}
          />
        </div>
        <button type="submit" className="btn-primary w-full" disabled={loading}>
          {loading ? 'Saving…' : 'Reset password'}
        </button>
      </form>
    </div>
  );
}

export function ResetPasswordForm() {
  return (
    <Suspense fallback={<div style={{ color: 'var(--ink-2)' }}>Loading…</div>}>
      <ResetFormInner />
    </Suspense>
  );
}
