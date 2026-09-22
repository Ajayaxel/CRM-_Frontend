'use client';

import { useState } from 'react';
import Link from 'next/link';
import { toast } from 'sonner';
import { api, apiErrorMessage } from '@/lib/api';

export function ForgotPasswordForm() {
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      await api.post('/auth/forgot-password', { email });
      setSent(true);
    } catch (err) {
      toast.error(apiErrorMessage(err));
    } finally {
      setLoading(false);
    }
  };

  if (sent) {
    return (
      <div>
        <h2 className="text-2xl font-bold" style={{ color: 'var(--ink)' }}>Check your email</h2>
        <p className="mt-2 text-sm" style={{ color: 'var(--ink-3)' }}>
          If an account exists for <strong>{email}</strong>, we&apos;ve sent a password reset link.
          It expires in 1 hour.
        </p>
        <Link href="/login" className="btn-secondary mt-6 w-full">Back to sign in</Link>
      </div>
    );
  }

  return (
    <div>
      <h2 className="text-2xl font-bold" style={{ color: 'var(--ink)' }}>Forgot password?</h2>
      <p className="mt-1 text-sm" style={{ color: 'var(--ink-3)' }}>
        Enter your email and we&apos;ll send you a reset link.
      </p>
      <form onSubmit={onSubmit} className="mt-8 space-y-4">
        <div>
          <label className="label">Email</label>
          <input className="input" type="email" value={email} onChange={(e) => setEmail(e.target.value)} required />
        </div>
        <button type="submit" className="btn-primary w-full" disabled={loading}>
          {loading ? 'Sending…' : 'Send reset link'}
        </button>
      </form>
      <p className="mt-6 text-center text-sm" style={{ color: 'var(--ink-3)' }}>
        <Link href="/login" className="font-medium text-brand-600 hover:underline">Back to sign in</Link>
      </p>
    </div>
  );
}
