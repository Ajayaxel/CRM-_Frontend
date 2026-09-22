'use client';

import { useEffect, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { api, apiErrorMessage } from '@/lib/api';
import { useAuth } from '@/features/foundation/auth';
import { PageHeader } from '@/components/molecules/page-header';

interface OrgProfile {
  name: string;
  email?: string;
  phone?: string;
  website?: string;
  address?: string;
  city?: string;
  state?: string;
  country?: string;
  gstin?: string;
  trn?: string;
  pan?: string;
  stateCode?: string;
  pincode?: string;
  taxRegime?: string;
  primaryColor?: string;
  _count: { users: number; branches: number; leads: number; students: number };
}

export default function OrganizationPage() {
  const qc = useQueryClient();
  const { refreshUser, hasPermission } = useAuth();
  const canManage = hasPermission('org.manage');

  const { data } = useQuery({
    queryKey: ['org-profile'],
    queryFn: async () => (await api.get<OrgProfile>('/organization')).data,
  });

  const [form, setForm] = useState<Partial<OrgProfile>>({});
  useEffect(() => {
    if (data) setForm(data);
  }, [data]);

  const save = useMutation({
    mutationFn: () =>
      api.patch('/organization', {
        name: form.name,
        email: form.email,
        phone: form.phone,
        website: form.website,
        address: form.address,
        city: form.city,
        state: form.state,
        // Tax identity. e-invoicing refuses without a seller GSTIN and the
        // invoice print falls back to a blank tax id, but until now nothing in
        // the product could write any of these.
        gstin: form.gstin || undefined,
        trn: form.trn || undefined,
        pan: form.pan || undefined,
        stateCode: form.stateCode || undefined,
        pincode: form.pincode || undefined,
      }),
    onSuccess: async () => {
      qc.invalidateQueries({ queryKey: ['org-profile'] });
      await refreshUser();
      toast.success('Organization updated');
    },
    onError: (e) => toast.error(apiErrorMessage(e)),
  });

  const set = (k: keyof OrgProfile) => (e: React.ChangeEvent<HTMLInputElement>) =>
    setForm({ ...form, [k]: e.target.value });

  return (
    <div>
      <PageHeader title="Organization" description="Your company profile, tax identity and branding." />

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        <div className="card p-6 lg:col-span-2">
          <h3 className="mb-4 font-semibold" style={{ color: 'var(--ink)' }}>Profile</h3>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <Field label="Company name" value={form.name} onChange={set('name')} disabled={!canManage} />
            <Field label="Email" value={form.email} onChange={set('email')} disabled={!canManage} />
            <Field label="Phone" value={form.phone} onChange={set('phone')} disabled={!canManage} />
            <Field label="Website" value={form.website} onChange={set('website')} disabled={!canManage} />
            <Field label="City" value={form.city} onChange={set('city')} disabled={!canManage} />
            <Field label="State" value={form.state} onChange={set('state')} disabled={!canManage} />
            <div className="sm:col-span-2">
              <Field label="Address" value={form.address} onChange={set('address')} disabled={!canManage} />
            </div>
            <Field label="Pincode" value={form.pincode} onChange={set('pincode')} disabled={!canManage} />
          </div>

          {/* Tax identity — what the invoice prints as the seller and what
              e-invoicing refuses to run without. */}
          <h3 className="mb-4 mt-8 font-semibold" style={{ color: 'var(--ink)' }}>Tax identity</h3>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            {data?.taxRegime === 'VAT' ? (
              <Field label="TRN (VAT registration)" value={form.trn} onChange={set('trn')} disabled={!canManage} />
            ) : (
              <>
                <Field label="GSTIN" value={form.gstin} onChange={set('gstin')} disabled={!canManage} />
                <Field label="PAN" value={form.pan} onChange={set('pan')} disabled={!canManage} />
                <Field label="State code (place of supply)" value={form.stateCode} onChange={set('stateCode')} disabled={!canManage} />
              </>
            )}
          </div>
          {canManage && (
            <div className="mt-6 flex justify-end">
              <button className="btn-primary" onClick={() => save.mutate()} disabled={save.isPending}>
                {save.isPending ? 'Saving…' : 'Save changes'}
              </button>
            </div>
          )}
        </div>

        <div className="card h-fit p-6">
          <h3 className="mb-4 font-semibold" style={{ color: 'var(--ink)' }}>At a glance</h3>
          <dl className="space-y-3 text-sm">
            <Stat label="Team members" value={data?._count.users} />
            <Stat label="Branches" value={data?._count.branches} />
            <Stat label="Leads" value={data?._count.leads} />
            <Stat label="Students" value={data?._count.students} />
          </dl>
        </div>
      </div>
    </div>
  );
}

function Field({
  label,
  value,
  onChange,
  disabled,
}: {
  label: string;
  value?: string;
  onChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
  disabled?: boolean;
}) {
  return (
    <div>
      <label className="label">{label}</label>
      <input className="input" value={value ?? ''} onChange={onChange} disabled={disabled} />
    </div>
  );
}

function Stat({ label, value }: { label: string; value?: number }) {
  return (
    <div className="flex items-center justify-between">
      <dt style={{ color: 'var(--ink-3)' }}>{label}</dt>
      <dd className="font-semibold" style={{ color: 'var(--ink)' }}>{value ?? '—'}</dd>
    </div>
  );
}
