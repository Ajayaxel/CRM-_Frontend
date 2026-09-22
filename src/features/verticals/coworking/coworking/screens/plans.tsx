'use client';

/**
 * Membership plans — what a member buys.
 *
 * A plan carries its price, its cycle, what is included, how many people it
 * covers, what usage beyond the allowance costs, and the one-off money (setup
 * fee, deposit). Memberships COPY these numbers when they are sold, so raising
 * a price tomorrow does not restate what an existing member agreed to.
 */

import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { BadgeCheck, Plus, Trash2 } from 'lucide-react';
import { api, apiErrorMessage } from '@/lib/api';
import { Badge, Card, Drawer, EmptyState, Field, FormSection, Skeleton, humanStatus } from '../ui/kit';
import { BILLING_CYCLES, PLAN_TYPES, spaceTypeLabel } from '../ui/tone';
import { PageHead, SearchBox, money, useListState } from '../ui/common';

interface ServiceRow { id: string; name: string; priceInr: number; unit: string }
interface PlanRow {
  id: string; name: string; code: string; type: string; description?: string | null;
  priceInr: number; billingCycle: string; durationMonths: number; durationDays: number;
  includedHours: number; includedDays: number; includedPasses: number; userLimit: number;
  extraHourInr: number; extraDayInr: number; setupFeeInr: number; depositInr: number;
  discountPct: number; taxPct: number; autoRenew: boolean; isActive: boolean;
  services: { id: string; quantity: number; included: boolean; service: ServiceRow }[];
  _count: { memberships: number };
}

const emptyPlan = {
  name: '', code: '', type: 'HOT_DESK', description: '', priceInr: '0', billingCycle: 'MONTHLY',
  durationMonths: '1', durationDays: '0', includedHours: '0', includedDays: '0', includedPasses: '0',
  userLimit: '1', extraHourInr: '0', extraDayInr: '0', setupFeeInr: '0', depositInr: '0',
  discountPct: '0', taxPct: '5', autoRenew: true, isActive: true,
};

export function CoworkingPlans() {
  const qc = useQueryClient();
  const { state, set, params } = useListState();
  const [editing, setEditing] = useState<PlanRow | null>(null);
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState(emptyPlan);
  const [services, setServices] = useState<Record<string, boolean>>({});

  const { data, isLoading } = useQuery({
    queryKey: ['cw-plans', params],
    queryFn: async () => (await api.get<{ data: PlanRow[] }>('/coworking/plans', { params: { ...params, limit: 100 } })).data,
  });

  const { data: serviceList } = useQuery({
    queryKey: ['cw-services-all'],
    queryFn: async () => (await api.get<{ data: ServiceRow[] }>('/coworking/services', { params: { limit: 100, status: 'ACTIVE' } })).data.data,
  });

  const openEditor = (plan?: PlanRow) => {
    if (plan) {
      setEditing(plan);
      setForm({
        name: plan.name, code: plan.code, type: plan.type, description: plan.description ?? '',
        priceInr: String(plan.priceInr), billingCycle: plan.billingCycle,
        durationMonths: String(plan.durationMonths), durationDays: String(plan.durationDays),
        includedHours: String(plan.includedHours), includedDays: String(plan.includedDays),
        includedPasses: String(plan.includedPasses), userLimit: String(plan.userLimit),
        extraHourInr: String(plan.extraHourInr), extraDayInr: String(plan.extraDayInr),
        setupFeeInr: String(plan.setupFeeInr), depositInr: String(plan.depositInr),
        discountPct: String(plan.discountPct), taxPct: String(plan.taxPct),
        autoRenew: plan.autoRenew, isActive: plan.isActive,
      });
      setServices(Object.fromEntries(plan.services.map((s) => [s.service.id, true])));
    } else {
      setEditing(null); setForm(emptyPlan); setServices({});
    }
    setOpen(true);
  };

  const save = useMutation({
    mutationFn: () => {
      const body = {
        name: form.name.trim(), code: form.code.trim() || undefined, type: form.type,
        description: form.description.trim() || undefined,
        priceInr: Number(form.priceInr) || 0, billingCycle: form.billingCycle,
        durationMonths: Number(form.durationMonths) || 0, durationDays: Number(form.durationDays) || 0,
        includedHours: Number(form.includedHours) || 0, includedDays: Number(form.includedDays) || 0,
        includedPasses: Number(form.includedPasses) || 0, userLimit: Number(form.userLimit) || 1,
        extraHourInr: Number(form.extraHourInr) || 0, extraDayInr: Number(form.extraDayInr) || 0,
        setupFeeInr: Number(form.setupFeeInr) || 0, depositInr: Number(form.depositInr) || 0,
        discountPct: Number(form.discountPct) || 0, taxPct: Number(form.taxPct) || 0,
        autoRenew: form.autoRenew, isActive: form.isActive,
        services: Object.entries(services).filter(([, on]) => on).map(([serviceId]) => ({ serviceId, included: true })),
      };
      return editing ? api.patch(`/coworking/plans/${editing.id}`, body) : api.post('/coworking/plans', body);
    },
    onSuccess: () => { toast.success(editing ? 'Plan updated' : 'Plan created'); setOpen(false); qc.invalidateQueries({ queryKey: ['cw-plans'] }); },
    onError: (e) => toast.error(apiErrorMessage(e)),
  });

  const remove = useMutation({
    mutationFn: (id: string) => api.delete(`/coworking/plans/${id}`),
    onSuccess: (res) => {
      const body = res.data as { retired?: boolean; message?: string };
      toast.success(body.message ?? (body.retired ? 'Plan retired' : 'Plan deleted'));
      qc.invalidateQueries({ queryKey: ['cw-plans'] });
    },
    onError: (e) => toast.error(apiErrorMessage(e)),
  });

  return (
    <div className="ds-page">
      <PageHead
        title="Plans"
        subtitle="What a membership costs, covers and includes."
        actions={<button className="btn-primary" onClick={() => openEditor()}><Plus size={14} style={{ marginRight: 6 }} />New plan</button>}
      />

      <div style={{ marginBottom: 14 }}>
        <SearchBox value={state.search} onChange={(v) => set({ search: v })} placeholder="Search plans…" />
      </div>

      {isLoading ? <Skeleton rows={3} height={120} /> : !data?.data.length ? (
        <EmptyState icon={BadgeCheck} title="No plans yet" body="A plan is what turns a desk into recurring revenue." actionLabel="New plan" onAction={() => openEditor()} />
      ) : (
        <div className="ds-grid ds-grid-cards">
          {data.data.map((p) => (
            <Card key={p.id} pad={18}>
              <div style={{ display: 'flex', alignItems: 'flex-start', gap: 10 }}>
                <div style={{ minWidth: 0, flex: 1 }}>
                  <div style={{ fontSize: 14.5, fontWeight: 680 }}>{p.name}</div>
                  <div className="ds-caption" style={{ marginTop: 2 }}>{spaceTypeLabel(p.type)} · {p.code}</div>
                </div>
                <Badge tone={p.isActive ? 'active' : 'neutral'}>{p.isActive ? 'Selling' : 'Retired'}</Badge>
              </div>

              <div style={{ display: 'flex', alignItems: 'baseline', gap: 6, marginTop: 14 }}>
                <span className="ds-display" style={{ fontSize: 26 }}>{money(p.priceInr)}</span>
                <span className="ds-caption">/ {humanStatus(p.billingCycle).toLowerCase()}</span>
              </div>

              <div style={{ display: 'grid', gap: 4, marginTop: 12 }}>
                <span className="ds-caption">{p.userLimit} user{p.userLimit === 1 ? '' : 's'}</span>
                {p.includedHours > 0 && <span className="ds-caption">{p.includedHours} included hours{p.extraHourInr ? ` · ${money(p.extraHourInr)}/hr after` : ''}</span>}
                {p.includedDays > 0 && <span className="ds-caption">{p.includedDays} included days{p.extraDayInr ? ` · ${money(p.extraDayInr)}/day after` : ''}</span>}
                {p.setupFeeInr > 0 && <span className="ds-caption">Setup {money(p.setupFeeInr)}</span>}
                {p.depositInr > 0 && <span className="ds-caption">Deposit {money(p.depositInr)}</span>}
                {p.services.length > 0 && <span className="ds-caption">Includes {p.services.map((s) => s.service.name).join(', ')}</span>}
              </div>

              <div style={{ display: 'flex', gap: 6, marginTop: 14, alignItems: 'center' }}>
                <span className="ds-caption">{p._count.memberships} member(s)</span>
                <button className="btn-ghost btn-sm" style={{ marginLeft: 'auto' }} onClick={() => openEditor(p)}>Edit</button>
                <button className="btn-ghost btn-sm" onClick={() => { if (window.confirm(`Remove ${p.name}?`)) remove.mutate(p.id); }} aria-label="Remove plan"><Trash2 size={13} /></button>
              </div>
            </Card>
          ))}
        </div>
      )}

      <Drawer
        open={open} onClose={() => setOpen(false)} title={editing ? `Edit ${editing.name}` : 'New plan'} width={580}
        actions={<button className="btn-primary btn-sm" disabled={!form.name.trim() || save.isPending} onClick={() => save.mutate()}>Save</button>}
      >
        <FormSection title="The plan">
          <Field label="Name" required span={2}><input className="input" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="Dedicated Desk — Monthly" /></Field>
          <Field label="Code"><input className="input" value={form.code} onChange={(e) => setForm({ ...form, code: e.target.value })} /></Field>
          <Field label="Type">
            <select className="input" value={form.type} onChange={(e) => setForm({ ...form, type: e.target.value })}>
              {PLAN_TYPES.map((t) => <option key={t} value={t}>{humanStatus(t)}</option>)}
            </select>
          </Field>
          <Field label="Description" span={2}><textarea className="input" rows={2} value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} /></Field>
        </FormSection>

        <FormSection title="Money">
          <Field label="Price"><input className="input" type="number" min={0} value={form.priceInr} onChange={(e) => setForm({ ...form, priceInr: e.target.value })} /></Field>
          <Field label="Billing cycle">
            <select className="input" value={form.billingCycle} onChange={(e) => setForm({ ...form, billingCycle: e.target.value })}>
              {BILLING_CYCLES.map((c) => <option key={c} value={c}>{humanStatus(c)}</option>)}
            </select>
          </Field>
          <Field label="Term (months)" hint="0 rolls until cancelled."><input className="input" type="number" min={0} value={form.durationMonths} onChange={(e) => setForm({ ...form, durationMonths: e.target.value })} /></Field>
          <Field label="Term (extra days)"><input className="input" type="number" min={0} value={form.durationDays} onChange={(e) => setForm({ ...form, durationDays: e.target.value })} /></Field>
          <Field label="Setup fee"><input className="input" type="number" min={0} value={form.setupFeeInr} onChange={(e) => setForm({ ...form, setupFeeInr: e.target.value })} /></Field>
          <Field label="Deposit" hint="Collected once, untaxed, refundable."><input className="input" type="number" min={0} value={form.depositInr} onChange={(e) => setForm({ ...form, depositInr: e.target.value })} /></Field>
          <Field label="Discount %"><input className="input" type="number" min={0} max={100} value={form.discountPct} onChange={(e) => setForm({ ...form, discountPct: e.target.value })} /></Field>
          <Field label="Tax %"><input className="input" type="number" min={0} max={100} value={form.taxPct} onChange={(e) => setForm({ ...form, taxPct: e.target.value })} /></Field>
        </FormSection>

        <FormSection title="What is included" description="Beyond the allowance, usage bills at the extra rate.">
          <Field label="Users allowed"><input className="input" type="number" min={1} value={form.userLimit} onChange={(e) => setForm({ ...form, userLimit: e.target.value })} /></Field>
          <Field label="Included hours"><input className="input" type="number" min={0} value={form.includedHours} onChange={(e) => setForm({ ...form, includedHours: e.target.value })} /></Field>
          <Field label="Included days"><input className="input" type="number" min={0} value={form.includedDays} onChange={(e) => setForm({ ...form, includedDays: e.target.value })} /></Field>
          <Field label="Day passes"><input className="input" type="number" min={0} value={form.includedPasses} onChange={(e) => setForm({ ...form, includedPasses: e.target.value })} /></Field>
          <Field label="Extra hour rate"><input className="input" type="number" min={0} value={form.extraHourInr} onChange={(e) => setForm({ ...form, extraHourInr: e.target.value })} /></Field>
          <Field label="Extra day rate"><input className="input" type="number" min={0} value={form.extraDayInr} onChange={(e) => setForm({ ...form, extraDayInr: e.target.value })} /></Field>
        </FormSection>

        {!!serviceList?.length && (
          <FormSection title="Bundled services">
            <div style={{ gridColumn: '1 / -1', display: 'grid', gap: 6 }}>
              {serviceList.map((s) => (
                <label key={s.id} style={{ display: 'flex', gap: 8, alignItems: 'center', fontSize: 13 }}>
                  <input type="checkbox" checked={!!services[s.id]} onChange={(e) => setServices({ ...services, [s.id]: e.target.checked })} />
                  {s.name} <span className="ds-caption">({money(s.priceInr)})</span>
                </label>
              ))}
            </div>
          </FormSection>
        )}

        <FormSection title="Behaviour">
          <div style={{ gridColumn: '1 / -1', display: 'flex', gap: 18, flexWrap: 'wrap' }}>
            <label style={{ display: 'flex', gap: 8, alignItems: 'center', fontSize: 13 }}>
              <input type="checkbox" checked={form.autoRenew} onChange={(e) => setForm({ ...form, autoRenew: e.target.checked })} />
              Renew automatically
            </label>
            <label style={{ display: 'flex', gap: 8, alignItems: 'center', fontSize: 13 }}>
              <input type="checkbox" checked={form.isActive} onChange={(e) => setForm({ ...form, isActive: e.target.checked })} />
              Still selling
            </label>
          </div>
        </FormSection>
      </Drawer>
    </div>
  );
}
