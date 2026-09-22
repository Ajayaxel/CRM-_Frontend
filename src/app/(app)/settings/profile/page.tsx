'use client';

import { useEffect, useState } from 'react';
import { useMutation } from '@tanstack/react-query';
import { toast } from 'sonner';
import { api, apiErrorMessage } from '@/lib/api';
import { useAuth } from '@/features/foundation/auth';
import { PageHeader } from '@/components/molecules/page-header';

export default function ProfilePage() {
  const { user, refreshUser } = useAuth();
  const [profile, setProfile] = useState({ firstName: '', lastName: '', phone: '' });
  const [pw, setPw] = useState({ currentPassword: '', newPassword: '' });

  useEffect(() => {
    if (user) setProfile({ firstName: user.firstName, lastName: user.lastName ?? '', phone: user.phone ?? '' });
  }, [user]);

  const saveProfile = useMutation({
    mutationFn: () => api.patch(`/users/${user!.id}`, profile),
    onSuccess: async () => {
      await refreshUser();
      toast.success('Profile updated');
    },
    onError: (e) => toast.error(apiErrorMessage(e)),
  });

  const changePw = useMutation({
    mutationFn: () => api.post('/auth/change-password', pw),
    onSuccess: () => {
      setPw({ currentPassword: '', newPassword: '' });
      toast.success('Password changed');
    },
    onError: (e) => toast.error(apiErrorMessage(e)),
  });

  return (
    <div>
      <PageHeader title="My Profile" description="Update your personal details and password." />

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <div className="card p-6">
          <h3 className="mb-4 font-semibold" style={{ color: 'var(--ink)' }}>Personal details</h3>
          <div className="space-y-4">
            <div>
              <label className="label">First name</label>
              <input className="input" value={profile.firstName}
                onChange={(e) => setProfile({ ...profile, firstName: e.target.value })} />
            </div>
            <div>
              <label className="label">Last name</label>
              <input className="input" value={profile.lastName}
                onChange={(e) => setProfile({ ...profile, lastName: e.target.value })} />
            </div>
            <div>
              <label className="label">Phone</label>
              <input className="input" value={profile.phone}
                onChange={(e) => setProfile({ ...profile, phone: e.target.value })} />
            </div>
            <button className="btn-primary" onClick={() => saveProfile.mutate()} disabled={saveProfile.isPending}>
              {saveProfile.isPending ? 'Saving…' : 'Save profile'}
            </button>
          </div>
        </div>

        <div className="card p-6">
          <h3 className="mb-4 font-semibold" style={{ color: 'var(--ink)' }}>Change password</h3>
          <div className="space-y-4">
            <div>
              <label className="label">Current password</label>
              <input className="input" type="password" value={pw.currentPassword}
                onChange={(e) => setPw({ ...pw, currentPassword: e.target.value })} />
            </div>
            <div>
              <label className="label">New password</label>
              <input className="input" type="password" value={pw.newPassword} minLength={8}
                onChange={(e) => setPw({ ...pw, newPassword: e.target.value })} />
            </div>
            <button
              className="btn-primary"
              onClick={() => changePw.mutate()}
              disabled={changePw.isPending || !pw.currentPassword || pw.newPassword.length < 8}
            >
              {changePw.isPending ? 'Updating…' : 'Update password'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
