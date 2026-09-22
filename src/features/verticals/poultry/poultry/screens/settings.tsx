'use client';

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { api, apiErrorMessage } from '@/lib/api';
import { useAuth } from '@/features/foundation/auth';
import {
  Badge, Card, DataTable, DataTableColumn, EmptyState, Field, FormSection, Modal,
  SectionTitle, Segmented, StatCard, humanStatus,
} from '../ui/kit';
import { PageHead, Pagination, SearchBox, fmtDate, fmtDateTime, money, useListState } from '../ui/common';
import { EXPENSE_GROUPS, FEED_STAGES, STAFF_ROLES, paiseRate } from '../ui/tone';

const VIEWS = ['Rules', 'Regions', 'Staff', 'Feed programs', 'Vaccine programme', 'Rate board', 'FCR slabs', 'Categories', 'Vehicles'];

export function PoultrySettings() {
  const [view, setView] = useState('Rules');
  return (
    <div className="ds-page">
      <PageHead title="Poultry settings" subtitle="The rules the cycle runs on, and the masters everything else names" />
      <div style={{ marginBottom: 16, overflowX: 'auto' }}>
        <Segmented options={VIEWS} value={view} onChange={setView} />
      </div>
      {view === 'Rules' && <RulesView />}
      {view === 'Regions' && <RegionsView />}
      {view === 'Staff' && <StaffView />}
      {view === 'Feed programs' && <FeedProgramsView />}
      {view === 'Vaccine programme' && <VaccineProgrammeView />}
      {view === 'Rate board' && <RateBoardView />}
      {view === 'FCR slabs' && <FcrSlabsView />}
      {view === 'Categories' && <CategoriesView />}
      {view === 'Vehicles' && <VehiclesView />}
    </div>
  );
}

// ============================================================ Rules

interface Settings {
  productionDays: number; restDays: number; placementWindowDays: number;
  pickupAlertLeadDays: number; feedAlertLeadDays: number; supervisionPaisePerBird: number;
  approvalThresholdInr: number; dailyReportHour: number;
  kgPerBag: number; plannedFcr: number;
}

const EMPTY_RULES = {
  productionDays: '', restDays: '', placementWindowDays: '', pickupAlertLeadDays: '',
  feedAlertLeadDays: '', supervisionRupees: '', approvalThresholdInr: '', dailyReportHour: '',
  kgPerBag: '', plannedFcr: '',
};

function RulesView() {
  const qc = useQueryClient();
  const { hasPermission } = useAuth();
  const canManage = hasPermission('poultry.manage');
  const [form, setForm] = useState(EMPTY_RULES);

  const { data } = useQuery({
    queryKey: ['py-settings'],
    queryFn: async () => (await api.get<Settings>('/poultry/settings')).data,
  });

  React.useEffect(() => {
    if (!data) return;
    setForm({
      productionDays: String(data.productionDays),
      restDays: String(data.restDays),
      placementWindowDays: String(data.placementWindowDays),
      pickupAlertLeadDays: String(data.pickupAlertLeadDays),
      feedAlertLeadDays: String(data.feedAlertLeadDays),
      supervisionRupees: String(data.supervisionPaisePerBird / 100),
      approvalThresholdInr: String(data.approvalThresholdInr),
      dailyReportHour: String(data.dailyReportHour),
      kgPerBag: String(data.kgPerBag),
      plannedFcr: String(data.plannedFcr),
    });
  }, [data]);

  const save = useMutation({
    mutationFn: () => api.patch('/poultry/settings', {
      productionDays: Number(form.productionDays),
      restDays: Number(form.restDays),
      placementWindowDays: Number(form.placementWindowDays),
      pickupAlertLeadDays: Number(form.pickupAlertLeadDays),
      feedAlertLeadDays: Number(form.feedAlertLeadDays),
      supervisionPaisePerBird: Math.round(Number(form.supervisionRupees) * 100),
      approvalThresholdInr: Number(form.approvalThresholdInr),
      dailyReportHour: Number(form.dailyReportHour),
      kgPerBag: Number(form.kgPerBag),
      plannedFcr: Number(form.plannedFcr),
    }),
    onSuccess: () => {
      toast.success('Rules saved');
      qc.invalidateQueries({ queryKey: ['py-settings'] });
      qc.invalidateQueries({ queryKey: ['py-dashboard'] });
    },
    onError: (e) => toast.error(apiErrorMessage(e)),
  });

  return (
    <Card>
      <SectionTitle sub="Running batches keep the rules they were placed under — changes apply to future placements only.">
        Cycle rules
      </SectionTitle>
      <FormSection title="The cycle">
        <Field label="Production days">
          <input className="input" type="number" min={1} disabled={!canManage} value={form.productionDays} onChange={(e) => setForm({ ...form, productionDays: e.target.value })} />
        </Field>
        <Field label="Rest days">
          <input className="input" type="number" min={0} disabled={!canManage} value={form.restDays} onChange={(e) => setForm({ ...form, restDays: e.target.value })} />
        </Field>
        <Field label="Placement window (days)" hint="Planning window after rest completes">
          <input className="input" type="number" min={1} disabled={!canManage} value={form.placementWindowDays} onChange={(e) => setForm({ ...form, placementWindowDays: e.target.value })} />
        </Field>
        <Field label="Supervision (₹ per bird)">
          <input className="input" type="number" min={0} step="0.01" disabled={!canManage} value={form.supervisionRupees} onChange={(e) => setForm({ ...form, supervisionRupees: e.target.value })} />
        </Field>
        <Field label="Feed bag weight (kg)" hint="Drives FCR; batches snapshot it at placement">
          <input className="input" type="number" min={1} disabled={!canManage} value={form.kgPerBag} onChange={(e) => setForm({ ...form, kgPerBag: e.target.value })} />
        </Field>
        <Field label="Planned FCR" hint="Target feed conversion ratio">
          <input className="input" type="number" min={0} step="0.01" disabled={!canManage} value={form.plannedFcr} onChange={(e) => setForm({ ...form, plannedFcr: e.target.value })} />
        </Field>
      </FormSection>
      <FormSection title="Alerts & control">
        <Field label="Pickup alert lead (days)">
          <input className="input" type="number" min={0} disabled={!canManage} value={form.pickupAlertLeadDays} onChange={(e) => setForm({ ...form, pickupAlertLeadDays: e.target.value })} />
        </Field>
        <Field label="Feed alert lead (days)" hint="Alert when coverage drops to this many days">
          <input className="input" type="number" min={0} disabled={!canManage} value={form.feedAlertLeadDays} onChange={(e) => setForm({ ...form, feedAlertLeadDays: e.target.value })} />
        </Field>
        <Field label="Approval threshold (₹)" hint="Expenses at or above wait for approval">
          <input className="input" type="number" min={0} disabled={!canManage} value={form.approvalThresholdInr} onChange={(e) => setForm({ ...form, approvalThresholdInr: e.target.value })} />
        </Field>
        <Field label="Daily report hour" hint="Local hour the evening report generates">
          <input className="input" type="number" min={0} max={23} disabled={!canManage} value={form.dailyReportHour} onChange={(e) => setForm({ ...form, dailyReportHour: e.target.value })} />
        </Field>
      </FormSection>
      {canManage && (
        <button className="btn-primary" disabled={save.isPending} onClick={() => save.mutate()}>
          {save.isPending ? 'Saving…' : 'Save rules'}
        </button>
      )}
    </Card>
  );
}

// ============================================================ Regions

interface Region { id: string; name: string; state?: string | null; isActive: boolean; _count: { farms: number } }

function RegionsView() {
  const qc = useQueryClient();
  const { hasPermission } = useAuth();
  const canManage = hasPermission('poultry.manage');
  const [creating, setCreating] = useState(false);
  const [editing, setEditing] = useState<Region | null>(null);
  const [form, setForm] = useState({ name: '', state: '', isActive: true });

  const { data: regions, isLoading } = useQuery({
    queryKey: ['py-regions'],
    queryFn: async () => (await api.get<Region[]>('/poultry/regions')).data,
  });

  const save = useMutation({
    mutationFn: async () => {
      const body = { name: form.name, state: form.state || undefined, ...(editing ? { isActive: form.isActive } : {}) };
      if (editing) return api.patch(`/poultry/regions/${editing.id}`, body);
      return api.post('/poultry/regions', body);
    },
    onSuccess: () => {
      toast.success(editing ? 'Region updated' : 'Region added');
      setCreating(false); setEditing(null);
      qc.invalidateQueries({ queryKey: ['py-regions'] });
    },
    onError: (e) => toast.error(apiErrorMessage(e)),
  });

  const columns: DataTableColumn<Region>[] = [
    { key: 'name', header: 'Region', render: (r) => <span style={{ fontWeight: 600 }}>{r.name}</span> },
    { key: 'state', header: 'State', width: 150, render: (r) => r.state ?? <span className="ds-caption">—</span> },
    { key: 'farms', header: 'Farms', align: 'right', width: 90, render: (r) => r._count.farms },
    { key: 'isActive', header: 'Status', width: 100, render: (r) => <Badge tone={r.isActive ? 'active' : 'expired'}>{r.isActive ? 'Active' : 'Inactive'}</Badge> },
    ...(canManage ? [{ key: 'actions', header: '', width: 80, render: (r: Region) => (
      <button className="btn-ghost btn-sm" onClick={(e) => { e.stopPropagation(); setEditing(r); setForm({ name: r.name, state: r.state ?? '', isActive: r.isActive }); }}>Edit</button>
    ) }] : []),
  ];

  return (
    <div>
      <SectionTitle
        sub="Farms group under a region for planning and reporting"
        action={canManage ? <button className="btn-primary btn-sm" onClick={() => { setEditing(null); setForm({ name: '', state: '', isActive: true }); setCreating(true); }}>New region</button> : undefined}
      >Regions</SectionTitle>
      <Card flush>
        <DataTable
          rows={regions ?? []}
          columns={columns}
          rowKey={(r) => r.id}
          loading={isLoading}
          dense
          empty={<EmptyState title="No regions" body="Add regions before adding farms." compact />}
        />
      </Card>

      <Modal
        open={creating || !!editing}
        onClose={() => { setCreating(false); setEditing(null); }}
        title={editing ? `Edit ${editing.name}` : 'New region'}
        width={480}
        footer={(
          <>
            <button className="btn-secondary" onClick={() => { setCreating(false); setEditing(null); }}>Cancel</button>
            <button className="btn-primary" disabled={save.isPending || !form.name} onClick={() => save.mutate()}>
              {save.isPending ? 'Saving…' : editing ? 'Save changes' : 'Add region'}
            </button>
          </>
        )}
      >
        <FormSection title="The region">
          <Field label="Name" required>
            <input className="input" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
          </Field>
          <Field label="State">
            <input className="input" value={form.state} onChange={(e) => setForm({ ...form, state: e.target.value })} />
          </Field>
          {editing && (
            <Field label="Status" span={2}>
              <label style={{ display: 'flex', gap: 8, alignItems: 'center', fontSize: 13 }}>
                <input type="checkbox" checked={form.isActive} onChange={(e) => setForm({ ...form, isActive: e.target.checked })} />
                Active
              </label>
            </Field>
          )}
        </FormSection>
      </Modal>
    </div>
  );
}

// ============================================================ Staff

interface StaffRow {
  id: string; name: string; role: string; phone?: string | null; monthlySalaryInr: number;
  isActive: boolean; notes?: string | null; _count: { farms: number };
}

const EMPTY_STAFF_FORM = { name: '', role: 'WORKER', phone: '', monthlySalaryInr: '', isActive: true, notes: '' };

function StaffView() {
  const qc = useQueryClient();
  const { hasPermission } = useAuth();
  const canManage = hasPermission('poultry.manage');
  const { state, set, params } = useListState();
  const [role, setRole] = useState('');
  const [creating, setCreating] = useState(false);
  const [editing, setEditing] = useState<StaffRow | null>(null);
  const [form, setForm] = useState(EMPTY_STAFF_FORM);

  const { data, isLoading } = useQuery({
    queryKey: ['py-staff', params, role],
    queryFn: async () => (await api.get<{ data: StaffRow[]; meta: { page: number; limit: number; total: number; totalPages: number } }>(
      '/poultry/staff', { params: { ...params, ...(role ? { kind: role } : {}) } },
    )).data,
  });

  const save = useMutation({
    mutationFn: async () => {
      const body = {
        name: form.name,
        role: form.role,
        phone: form.phone || undefined,
        monthlySalaryInr: form.monthlySalaryInr ? Number(form.monthlySalaryInr) : 0,
        notes: form.notes || undefined,
        ...(editing ? { isActive: form.isActive } : {}),
      };
      if (editing) return api.patch(`/poultry/staff/${editing.id}`, body);
      return api.post('/poultry/staff', body);
    },
    onSuccess: () => {
      toast.success(editing ? 'Staff updated' : 'Staff added');
      setCreating(false); setEditing(null); setForm(EMPTY_STAFF_FORM);
      qc.invalidateQueries({ queryKey: ['py-staff'] });
    },
    onError: (e) => toast.error(apiErrorMessage(e)),
  });

  const columns: DataTableColumn<StaffRow>[] = [
    { key: 'name', header: 'Name', render: (s) => <span style={{ fontWeight: 600 }}>{s.name}</span> },
    { key: 'role', header: 'Role', width: 130, render: (s) => humanStatus(s.role) },
    { key: 'phone', header: 'Phone', width: 140, render: (s) => s.phone ?? <span className="ds-caption">—</span> },
    { key: 'monthlySalaryInr', header: 'Salary', align: 'right', width: 110, render: (s) => money(s.monthlySalaryInr) },
    { key: 'farms', header: 'Farms', align: 'right', width: 80, render: (s) => s._count.farms },
    { key: 'isActive', header: 'Status', width: 100, render: (s) => <Badge tone={s.isActive ? 'active' : 'expired'}>{s.isActive ? 'Active' : 'Inactive'}</Badge> },
    ...(canManage ? [{ key: 'actions', header: '', width: 80, render: (s: StaffRow) => (
      <button className="btn-ghost btn-sm" onClick={(e) => {
        e.stopPropagation();
        setEditing(s);
        setForm({ name: s.name, role: s.role, phone: s.phone ?? '', monthlySalaryInr: String(s.monthlySalaryInr || ''), isActive: s.isActive, notes: s.notes ?? '' });
      }}>Edit</button>
    ) }] : []),
  ];

  return (
    <div>
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 14, alignItems: 'center' }}>
        <SearchBox value={state.search} onChange={(v) => set({ search: v })} placeholder="Search name, phone…" />
        <select className="input" style={{ maxWidth: 170 }} value={role} aria-label="Role" onChange={(e) => { setRole(e.target.value); set({ page: 1 }); }}>
          <option value="">All roles</option>
          {STAFF_ROLES.map((r) => <option key={r} value={r}>{humanStatus(r)}</option>)}
        </select>
        {canManage && (
          <button className="btn-primary" style={{ marginLeft: 'auto' }} onClick={() => { setEditing(null); setForm(EMPTY_STAFF_FORM); setCreating(true); }}>New staff</button>
        )}
      </div>
      <Card flush>
        <DataTable
          rows={data?.data ?? []}
          columns={columns}
          rowKey={(s) => s.id}
          loading={isLoading}
          dense
          empty={<EmptyState title="No staff" body="Supervisors, drivers and workers live here." compact />}
        />
      </Card>
      <Pagination meta={data?.meta} onPage={(p) => set({ page: p })} />

      <Modal
        open={creating || !!editing}
        onClose={() => { setCreating(false); setEditing(null); }}
        title={editing ? `Edit ${editing.name}` : 'New staff member'}
        width={560}
        footer={(
          <>
            <button className="btn-secondary" onClick={() => { setCreating(false); setEditing(null); }}>Cancel</button>
            <button className="btn-primary" disabled={save.isPending || !form.name} onClick={() => save.mutate()}>
              {save.isPending ? 'Saving…' : editing ? 'Save changes' : 'Add staff'}
            </button>
          </>
        )}
      >
        <FormSection title="The person">
          <Field label="Name" required>
            <input className="input" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
          </Field>
          <Field label="Role" required>
            <select className="input" value={form.role} onChange={(e) => setForm({ ...form, role: e.target.value })}>
              {STAFF_ROLES.map((r) => <option key={r} value={r}>{humanStatus(r)}</option>)}
            </select>
          </Field>
          <Field label="Phone">
            <input className="input" value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} />
          </Field>
          <Field label="Monthly salary (₹)">
            <input className="input" type="number" min={0} value={form.monthlySalaryInr} onChange={(e) => setForm({ ...form, monthlySalaryInr: e.target.value })} />
          </Field>
          <Field label="Notes" span={2}>
            <input className="input" value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} />
          </Field>
          {editing && (
            <Field label="Status" span={2}>
              <label style={{ display: 'flex', gap: 8, alignItems: 'center', fontSize: 13 }}>
                <input type="checkbox" checked={form.isActive} onChange={(e) => setForm({ ...form, isActive: e.target.checked })} />
                Active
              </label>
            </Field>
          )}
        </FormSection>
      </Modal>
    </div>
  );
}

// ============================================================ Feed programs

interface FeedProgram {
  id: string; name: string; isDefault: boolean; isActive: boolean;
  lines: { id: string; stage: string; ageFromDay: number; ageToDay: number; bagsPer1000: number }[];
}

type LineForm = { stage: string; ageFromDay: string; ageToDay: string; bagsPer1000: string };

const EMPTY_LINE: LineForm = { stage: 'PRE_STARTER', ageFromDay: '', ageToDay: '', bagsPer1000: '' };

function FeedProgramsView() {
  const qc = useQueryClient();
  const { hasPermission } = useAuth();
  const canManage = hasPermission('poultry.manage');
  const [creating, setCreating] = useState(false);
  const [editing, setEditing] = useState<FeedProgram | null>(null);
  const [form, setForm] = useState<{ name: string; isDefault: boolean; lines: LineForm[] }>({ name: '', isDefault: false, lines: [EMPTY_LINE] });

  const { data: programs, isLoading } = useQuery({
    queryKey: ['py-feed-programs'],
    queryFn: async () => (await api.get<FeedProgram[]>('/poultry/feed-programs')).data,
  });

  const save = useMutation({
    mutationFn: async () => {
      const body = {
        name: form.name,
        isDefault: form.isDefault,
        lines: form.lines.map((l) => ({
          stage: l.stage,
          ageFromDay: Number(l.ageFromDay),
          ageToDay: Number(l.ageToDay),
          bagsPer1000: Number(l.bagsPer1000),
        })),
      };
      if (editing) return api.patch(`/poultry/feed-programs/${editing.id}`, body);
      return api.post('/poultry/feed-programs', body);
    },
    onSuccess: () => {
      toast.success(editing ? 'Program updated' : 'Program added');
      setCreating(false); setEditing(null);
      qc.invalidateQueries({ queryKey: ['py-feed-programs'] });
    },
    onError: (e) => toast.error(apiErrorMessage(e)),
  });

  const openEdit = (p: FeedProgram) => {
    setEditing(p);
    setForm({
      name: p.name,
      isDefault: p.isDefault,
      lines: p.lines.map((l) => ({ stage: l.stage, ageFromDay: String(l.ageFromDay), ageToDay: String(l.ageToDay), bagsPer1000: String(l.bagsPer1000) })),
    });
  };

  const setLine = (i: number, patch: Partial<LineForm>) => {
    setForm((f) => ({ ...f, lines: f.lines.map((l, j) => (j === i ? { ...l, ...patch } : l)) }));
  };

  const linesValid = form.lines.length > 0 && form.lines.every((l) => l.ageFromDay !== '' && l.ageToDay !== '' && l.bagsPer1000 !== '');

  return (
    <div>
      <SectionTitle
        sub="Batches snapshot the plan at placement — edits never rewrite a running batch."
        action={canManage ? <button className="btn-primary btn-sm" onClick={() => { setEditing(null); setForm({ name: '', isDefault: false, lines: [EMPTY_LINE] }); setCreating(true); }}>New program</button> : undefined}
      >Feed programs</SectionTitle>

      {isLoading && <div className="ds-caption">Loading…</div>}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(300px,1fr))', gap: 14 }}>
        {(programs ?? []).map((p) => (
          <Card key={p.id}>
            <div style={{ display: 'flex', alignItems: 'flex-start', gap: 10, marginBottom: 12 }}>
              <div style={{ fontWeight: 650, minWidth: 0, flex: 1 }}>{p.name}</div>
              {p.isDefault && <Badge tone="active">Default</Badge>}
              {!p.isActive && <Badge tone="expired">Inactive</Badge>}
              {canManage && <button className="btn-ghost btn-sm" onClick={() => openEdit(p)}>Edit</button>}
            </div>
            <Card flush>
              <DataTable
                rows={p.lines}
                columns={[
                  { key: 'stage', header: 'Stage', render: (l) => humanStatus(l.stage) },
                  { key: 'ageFromDay', header: 'Days', width: 100, render: (l) => `${l.ageFromDay}–${l.ageToDay}` },
                  { key: 'bagsPer1000', header: 'Bags / 1000', align: 'right', width: 110 },
                ] as DataTableColumn<FeedProgram['lines'][number]>[]}
                rowKey={(l) => l.id}
                dense
              />
            </Card>
          </Card>
        ))}
      </div>

      <Modal
        open={creating || !!editing}
        onClose={() => { setCreating(false); setEditing(null); }}
        title={editing ? `Edit ${editing.name}` : 'New feed program'}
        subtitle="Bags per 1,000 birds across each age band — bands must not overlap."
        width={680}
        footer={(
          <>
            <button className="btn-secondary" onClick={() => { setCreating(false); setEditing(null); }}>Cancel</button>
            <button className="btn-primary" disabled={save.isPending || !form.name || !linesValid} onClick={() => save.mutate()}>
              {save.isPending ? 'Saving…' : editing ? 'Save changes' : 'Add program'}
            </button>
          </>
        )}
      >
        <FormSection title="The plan">
          <Field label="Name" required>
            <input className="input" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
          </Field>
          <Field label="Default" hint="New batches use the default when none is chosen">
            <label style={{ display: 'flex', gap: 8, alignItems: 'center', fontSize: 13, minHeight: 34 }}>
              <input type="checkbox" checked={form.isDefault} onChange={(e) => setForm({ ...form, isDefault: e.target.checked })} />
              Make this the default program
            </label>
          </Field>
        </FormSection>
        <SectionTitle sub="One row per stage band">Lines</SectionTitle>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {form.lines.map((l, i) => (
            <div key={i} style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
              <select className="input" style={{ maxWidth: 150 }} value={l.stage} aria-label="Stage" onChange={(e) => setLine(i, { stage: e.target.value })}>
                {FEED_STAGES.map((s) => <option key={s} value={s}>{humanStatus(s)}</option>)}
              </select>
              <input className="input" style={{ maxWidth: 110 }} type="number" min={0} placeholder="From day" aria-label="From day" value={l.ageFromDay} onChange={(e) => setLine(i, { ageFromDay: e.target.value })} />
              <input className="input" style={{ maxWidth: 110 }} type="number" min={0} placeholder="To day" aria-label="To day" value={l.ageToDay} onChange={(e) => setLine(i, { ageToDay: e.target.value })} />
              <input className="input" style={{ maxWidth: 130 }} type="number" min={0} step="0.5" placeholder="Bags / 1000" aria-label="Bags per 1000" value={l.bagsPer1000} onChange={(e) => setLine(i, { bagsPer1000: e.target.value })} />
              <button
                className="btn-ghost btn-sm" aria-label="Remove line"
                disabled={form.lines.length === 1}
                onClick={() => setForm((f) => ({ ...f, lines: f.lines.filter((_, j) => j !== i) }))}
              >Remove</button>
            </div>
          ))}
          <div>
            <button className="btn-secondary btn-sm" onClick={() => setForm((f) => ({ ...f, lines: [...f.lines, EMPTY_LINE] }))}>Add line</button>
          </div>
        </div>
      </Modal>
    </div>
  );
}

// ============================================================ Vaccine programme

interface ScheduleItem { id: string; name: string; dayDue: number; dose?: string | null; notes?: string | null; isActive: boolean }

const EMPTY_SCHEDULE_FORM = { name: '', dayDue: '', dose: '', notes: '', isActive: true };

function VaccineProgrammeView() {
  const qc = useQueryClient();
  const { hasPermission } = useAuth();
  const canManage = hasPermission('poultry.manage');
  const [creating, setCreating] = useState(false);
  const [editing, setEditing] = useState<ScheduleItem | null>(null);
  const [form, setForm] = useState(EMPTY_SCHEDULE_FORM);

  const { data: items, isLoading } = useQuery({
    queryKey: ['py-vaccine-schedule'],
    queryFn: async () => (await api.get<ScheduleItem[]>('/poultry/vaccine-schedule')).data,
  });

  const save = useMutation({
    mutationFn: async () => {
      const body = {
        name: form.name,
        dayDue: Number(form.dayDue),
        dose: form.dose || undefined,
        notes: form.notes || undefined,
        ...(editing ? { isActive: form.isActive } : {}),
      };
      if (editing) return api.patch(`/poultry/vaccine-schedule/${editing.id}`, body);
      return api.post('/poultry/vaccine-schedule', body);
    },
    onSuccess: () => {
      toast.success(editing ? 'Programme item updated' : 'Programme item added');
      setCreating(false); setEditing(null); setForm(EMPTY_SCHEDULE_FORM);
      qc.invalidateQueries({ queryKey: ['py-vaccine-schedule'] });
    },
    onError: (e) => toast.error(apiErrorMessage(e)),
  });

  const columns: DataTableColumn<ScheduleItem>[] = [
    { key: 'name', header: 'Vaccine', render: (s) => <span style={{ fontWeight: 600 }}>{s.name}</span> },
    { key: 'dayDue', header: 'Day due', align: 'right', width: 90, render: (s) => `day ${s.dayDue}` },
    { key: 'dose', header: 'Dose', width: 180, render: (s) => s.dose ?? <span className="ds-caption">—</span> },
    { key: 'isActive', header: 'Status', width: 100, render: (s) => <Badge tone={s.isActive ? 'active' : 'expired'}>{s.isActive ? 'Active' : 'Inactive'}</Badge> },
    ...(canManage ? [{ key: 'actions', header: '', width: 80, render: (s: ScheduleItem) => (
      <button className="btn-ghost btn-sm" onClick={(e) => {
        e.stopPropagation();
        setEditing(s);
        setForm({ name: s.name, dayDue: String(s.dayDue), dose: s.dose ?? '', notes: s.notes ?? '', isActive: s.isActive });
      }}>Edit</button>
    ) }] : []),
  ];

  return (
    <div>
      <SectionTitle
        sub="The doses every batch is due, by age in days — batch vaccinations record against these"
        action={canManage ? <button className="btn-primary btn-sm" onClick={() => { setEditing(null); setForm(EMPTY_SCHEDULE_FORM); setCreating(true); }}>New item</button> : undefined}
      >Vaccine programme</SectionTitle>
      <Card flush>
        <DataTable
          rows={items ?? []}
          columns={columns}
          rowKey={(s) => s.id}
          loading={isLoading}
          dense
          empty={<EmptyState title="No programme yet" body="Add the vaccines and the day each is due." compact />}
        />
      </Card>

      <Modal
        open={creating || !!editing}
        onClose={() => { setCreating(false); setEditing(null); }}
        title={editing ? `Edit ${editing.name}` : 'New programme item'}
        width={520}
        footer={(
          <>
            <button className="btn-secondary" onClick={() => { setCreating(false); setEditing(null); }}>Cancel</button>
            <button className="btn-primary" disabled={save.isPending || !form.name || form.dayDue === ''} onClick={() => save.mutate()}>
              {save.isPending ? 'Saving…' : editing ? 'Save changes' : 'Add item'}
            </button>
          </>
        )}
      >
        <FormSection title="The dose">
          <Field label="Vaccine" required>
            <input className="input" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="Lasota" />
          </Field>
          <Field label="Day due" required>
            <input className="input" type="number" min={0} value={form.dayDue} onChange={(e) => setForm({ ...form, dayDue: e.target.value })} />
          </Field>
          <Field label="Dose">
            <input className="input" value={form.dose} onChange={(e) => setForm({ ...form, dose: e.target.value })} placeholder="Via drinking water" />
          </Field>
          <Field label="Notes">
            <input className="input" value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} />
          </Field>
          {editing && (
            <Field label="Status" span={2}>
              <label style={{ display: 'flex', gap: 8, alignItems: 'center', fontSize: 13 }}>
                <input type="checkbox" checked={form.isActive} onChange={(e) => setForm({ ...form, isActive: e.target.checked })} />
                Active
              </label>
            </Field>
          )}
        </FormSection>
      </Modal>
    </div>
  );
}

// ============================================================ Rate board

interface RateRow { id: string; ratePaisePerKg: number; effectiveAt: string; note?: string | null }

function RateBoardView() {
  const qc = useQueryClient();
  const { hasPermission } = useAuth();
  const canManage = hasPermission('poultry.manage');
  const [setting, setSetting] = useState(false);
  const [form, setForm] = useState({ rate: '', effectiveAt: '', note: '' });

  const { data: current } = useQuery({
    queryKey: ['py-rate-current'],
    queryFn: async () => (await api.get<RateRow | null>('/poultry/rates/current')).data,
  });
  const { data: rates, isLoading } = useQuery({
    queryKey: ['py-rates'],
    queryFn: async () => (await api.get<RateRow[]>('/poultry/rates')).data,
  });

  const save = useMutation({
    mutationFn: () => api.post('/poultry/rates', {
      ratePaisePerKg: Math.round(Number(form.rate) * 100),
      effectiveAt: form.effectiveAt ? new Date(form.effectiveAt).toISOString() : undefined,
      note: form.note || undefined,
    }),
    onSuccess: () => {
      toast.success('Rate posted');
      setSetting(false); setForm({ rate: '', effectiveAt: '', note: '' });
      qc.invalidateQueries({ queryKey: ['py-rates'] });
      qc.invalidateQueries({ queryKey: ['py-rate-current'] });
      qc.invalidateQueries({ queryKey: ['py-dashboard'] });
    },
    onError: (e) => toast.error(apiErrorMessage(e)),
  });

  return (
    <div>
      <SectionTitle
        sub="The market rate per kg that prefills pickups — history is append-only"
        action={canManage ? <button className="btn-primary btn-sm" onClick={() => { setForm({ rate: '', effectiveAt: '', note: '' }); setSetting(true); }}>Set new rate</button> : undefined}
      >Rate board</SectionTitle>

      <div className="ds-grid ds-grid-kpi" style={{ marginBottom: 16 }}>
        <StatCard
          label="Current rate"
          value={current ? `${paiseRate(current.ratePaisePerKg)}/kg` : '—'}
          tone={current ? 'active' : 'neutral'}
          hint={current ? `effective ${fmtDate(current.effectiveAt)}` : 'No rate posted yet'}
        />
      </div>

      <Card flush>
        <DataTable
          rows={rates ?? []}
          columns={[
            { key: 'effectiveAt', header: 'Effective', width: 160, render: (r) => fmtDateTime(r.effectiveAt) },
            { key: 'rate', header: 'Rate/kg', align: 'right', width: 100, render: (r) => paiseRate(r.ratePaisePerKg) },
            { key: 'note', header: 'Note', render: (r) => r.note ?? <span className="ds-caption">—</span> },
          ] as DataTableColumn<RateRow>[]}
          rowKey={(r) => r.id}
          loading={isLoading}
          dense
          empty={<EmptyState title="No rates yet" body="Post the day's market rate to prefill pickups." compact />}
        />
      </Card>

      <Modal
        open={setting}
        onClose={() => setSetting(false)}
        title="Set new rate"
        subtitle="Posts a new board rate — earlier rates stay on the history."
        width={480}
        footer={(
          <>
            <button className="btn-secondary" onClick={() => setSetting(false)}>Cancel</button>
            <button className="btn-primary" disabled={save.isPending || !form.rate} onClick={() => save.mutate()}>
              {save.isPending ? 'Posting…' : 'Post rate'}
            </button>
          </>
        )}
      >
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          <label className="label">Rate (₹/kg)
            <input className="input" type="number" min={0} step="0.01" value={form.rate} onChange={(e) => setForm({ ...form, rate: e.target.value })} />
          </label>
          <label className="label">Effective from (optional)
            <input className="input" type="datetime-local" value={form.effectiveAt} onChange={(e) => setForm({ ...form, effectiveAt: e.target.value })} />
          </label>
          <label className="label">Note
            <input className="input" value={form.note} onChange={(e) => setForm({ ...form, note: e.target.value })} placeholder="Market moved on festival demand" />
          </label>
        </div>
      </Modal>
    </div>
  );
}

// ============================================================ FCR slabs

interface FcrSlab { id: string; fromFcr: number; toFcr: number; ratePaisePerKg: number; isActive: boolean }

const EMPTY_SLAB_FORM = { fromFcr: '', toFcr: '', rate: '', isActive: true };

function FcrSlabsView() {
  const qc = useQueryClient();
  const { hasPermission } = useAuth();
  const canFinance = hasPermission('poultry.finance');
  const [creating, setCreating] = useState(false);
  const [editing, setEditing] = useState<FcrSlab | null>(null);
  const [form, setForm] = useState(EMPTY_SLAB_FORM);

  const { data: slabs, isLoading } = useQuery({
    queryKey: ['py-fcr-slabs'],
    queryFn: async () => (await api.get<FcrSlab[]>('/poultry/fcr-slabs')).data,
  });

  const save = useMutation({
    mutationFn: async () => {
      const body = {
        fromFcr: Number(form.fromFcr),
        toFcr: Number(form.toFcr),
        ratePaisePerKg: Math.round(Number(form.rate) * 100),
        ...(editing ? { isActive: form.isActive } : {}),
      };
      if (editing) return api.patch(`/poultry/fcr-slabs/${editing.id}`, body);
      return api.post('/poultry/fcr-slabs', body);
    },
    onSuccess: () => {
      toast.success(editing ? 'Slab updated' : 'Slab added');
      setCreating(false); setEditing(null); setForm(EMPTY_SLAB_FORM);
      qc.invalidateQueries({ queryKey: ['py-fcr-slabs'] });
    },
    onError: (e) => toast.error(apiErrorMessage(e)),
  });

  const columns: DataTableColumn<FcrSlab>[] = [
    { key: 'range', header: 'FCR range', render: (s) => <span style={{ fontWeight: 600 }}>{s.fromFcr.toFixed(2)} – {s.toFcr.toFixed(2)}</span> },
    { key: 'rate', header: 'Incentive/kg', align: 'right', width: 120, render: (s) => paiseRate(s.ratePaisePerKg) },
    { key: 'isActive', header: 'Status', width: 100, render: (s) => <Badge tone={s.isActive ? 'active' : 'expired'}>{s.isActive ? 'Active' : 'Inactive'}</Badge> },
    ...(canFinance ? [{ key: 'actions', header: '', width: 80, render: (s: FcrSlab) => (
      <button className="btn-ghost btn-sm" onClick={(e) => {
        e.stopPropagation();
        setEditing(s);
        setForm({ fromFcr: String(s.fromFcr), toFcr: String(s.toFcr), rate: String(s.ratePaisePerKg / 100), isActive: s.isActive });
      }}>Edit</button>
    ) }] : []),
  ];

  return (
    <div>
      <SectionTitle
        sub="Matched exact-range only — an FCR outside every slab needs a manual decision"
        action={canFinance ? <button className="btn-primary btn-sm" onClick={() => { setEditing(null); setForm(EMPTY_SLAB_FORM); setCreating(true); }}>New slab</button> : undefined}
      >FCR incentive slabs</SectionTitle>
      <Card flush>
        <DataTable
          rows={slabs ?? []}
          columns={columns}
          rowKey={(s) => s.id}
          loading={isLoading}
          dense
          empty={<EmptyState title="No slabs yet" body="Define the FCR bands and the incentive each pays per kg." compact />}
        />
      </Card>

      <Modal
        open={creating || !!editing}
        onClose={() => { setCreating(false); setEditing(null); }}
        title={editing ? 'Edit slab' : 'New slab'}
        width={520}
        footer={(
          <>
            <button className="btn-secondary" onClick={() => { setCreating(false); setEditing(null); }}>Cancel</button>
            <button className="btn-primary" disabled={save.isPending || form.fromFcr === '' || form.toFcr === '' || form.rate === ''} onClick={() => save.mutate()}>
              {save.isPending ? 'Saving…' : editing ? 'Save changes' : 'Add slab'}
            </button>
          </>
        )}
      >
        <FormSection title="The band">
          <Field label="From FCR" required>
            <input className="input" type="number" min={0} step="0.01" value={form.fromFcr} onChange={(e) => setForm({ ...form, fromFcr: e.target.value })} />
          </Field>
          <Field label="To FCR" required>
            <input className="input" type="number" min={0} step="0.01" value={form.toFcr} onChange={(e) => setForm({ ...form, toFcr: e.target.value })} />
          </Field>
          <Field label="Incentive (₹/kg)" required>
            <input className="input" type="number" min={0} step="0.01" value={form.rate} onChange={(e) => setForm({ ...form, rate: e.target.value })} />
          </Field>
          {editing && (
            <Field label="Status">
              <label style={{ display: 'flex', gap: 8, alignItems: 'center', fontSize: 13, minHeight: 34 }}>
                <input type="checkbox" checked={form.isActive} onChange={(e) => setForm({ ...form, isActive: e.target.checked })} />
                Active
              </label>
            </Field>
          )}
        </FormSection>
      </Modal>
    </div>
  );
}

// ============================================================ Categories

interface Category { id: string; name: string; group: string; ledgerAccountCode: string; isActive: boolean }

const EMPTY_CATEGORY_FORM = { name: '', group: 'OPERATIONS', ledgerAccountCode: '5900', isActive: true };

function CategoriesView() {
  const qc = useQueryClient();
  const { hasPermission } = useAuth();
  const canFinance = hasPermission('poultry.finance');
  const [creating, setCreating] = useState(false);
  const [editing, setEditing] = useState<Category | null>(null);
  const [form, setForm] = useState(EMPTY_CATEGORY_FORM);

  const { data: categories, isLoading } = useQuery({
    queryKey: ['py-expense-categories'],
    queryFn: async () => (await api.get<Category[]>('/poultry/expense-categories')).data,
  });

  const save = useMutation({
    mutationFn: async () => {
      const body = {
        name: form.name,
        group: form.group,
        ledgerAccountCode: form.ledgerAccountCode,
        ...(editing ? { isActive: form.isActive } : {}),
      };
      if (editing) return api.patch(`/poultry/expense-categories/${editing.id}`, body);
      return api.post('/poultry/expense-categories', body);
    },
    onSuccess: () => {
      toast.success(editing ? 'Category updated' : 'Category added');
      setCreating(false); setEditing(null); setForm(EMPTY_CATEGORY_FORM);
      qc.invalidateQueries({ queryKey: ['py-expense-categories'] });
    },
    onError: (e) => toast.error(apiErrorMessage(e)),
  });

  const columns: DataTableColumn<Category>[] = [
    { key: 'name', header: 'Category', render: (c) => <span style={{ fontWeight: 600 }}>{c.name}</span> },
    { key: 'group', header: 'Group', width: 130, render: (c) => humanStatus(c.group) },
    { key: 'ledgerAccountCode', header: 'Ledger code', width: 120, render: (c) => c.ledgerAccountCode },
    { key: 'isActive', header: 'Status', width: 100, render: (c) => <Badge tone={c.isActive ? 'active' : 'expired'}>{c.isActive ? 'Active' : 'Inactive'}</Badge> },
    ...(canFinance ? [{ key: 'actions', header: '', width: 80, render: (c: Category) => (
      <button className="btn-ghost btn-sm" onClick={(e) => {
        e.stopPropagation();
        setEditing(c);
        setForm({ name: c.name, group: c.group, ledgerAccountCode: c.ledgerAccountCode, isActive: c.isActive });
      }}>Edit</button>
    ) }] : []),
  ];

  return (
    <div>
      <SectionTitle
        sub="Every expense names a category; the category names the ledger account it posts to"
        action={canFinance ? <button className="btn-primary btn-sm" onClick={() => { setEditing(null); setForm(EMPTY_CATEGORY_FORM); setCreating(true); }}>New category</button> : undefined}
      >Expense categories</SectionTitle>
      <Card flush>
        <DataTable
          rows={categories ?? []}
          columns={columns}
          rowKey={(c) => c.id}
          loading={isLoading}
          dense
          empty={<EmptyState title="No categories" body="The starter set seeds itself on first use." compact />}
        />
      </Card>

      <Modal
        open={creating || !!editing}
        onClose={() => { setCreating(false); setEditing(null); }}
        title={editing ? `Edit ${editing.name}` : 'New category'}
        width={520}
        footer={(
          <>
            <button className="btn-secondary" onClick={() => { setCreating(false); setEditing(null); }}>Cancel</button>
            <button className="btn-primary" disabled={save.isPending || !form.name || !form.ledgerAccountCode} onClick={() => save.mutate()}>
              {save.isPending ? 'Saving…' : editing ? 'Save changes' : 'Add category'}
            </button>
          </>
        )}
      >
        <FormSection title="The category">
          <Field label="Name" required>
            <input className="input" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
          </Field>
          <Field label="Group" required>
            <select className="input" value={form.group} onChange={(e) => setForm({ ...form, group: e.target.value })}>
              {EXPENSE_GROUPS.map((g) => <option key={g} value={g}>{humanStatus(g)}</option>)}
            </select>
          </Field>
          <Field label="Ledger account code" required hint="The 5xxx expense head it posts to">
            <input className="input" value={form.ledgerAccountCode} onChange={(e) => setForm({ ...form, ledgerAccountCode: e.target.value })} />
          </Field>
          {editing && (
            <Field label="Status">
              <label style={{ display: 'flex', gap: 8, alignItems: 'center', fontSize: 13, minHeight: 34 }}>
                <input type="checkbox" checked={form.isActive} onChange={(e) => setForm({ ...form, isActive: e.target.checked })} />
                Active
              </label>
            </Field>
          )}
        </FormSection>
      </Modal>
    </div>
  );
}

// ============================================================ Vehicles

interface Vehicle {
  id: string; code: string; name: string; regNo?: string | null; driverStaffId?: string | null;
  loanId?: string | null; isActive: boolean; notes?: string | null;
}

const EMPTY_VEHICLE_FORM = { name: '', regNo: '', driverStaffId: '', loanId: '', isActive: true, notes: '' };

function VehiclesView() {
  const router = useRouter();
  const qc = useQueryClient();
  const { hasPermission } = useAuth();
  const canManage = hasPermission('poultry.manage');
  const canFinance = hasPermission('poultry.finance');
  const [creating, setCreating] = useState(false);
  const [editing, setEditing] = useState<Vehicle | null>(null);
  const [form, setForm] = useState(EMPTY_VEHICLE_FORM);
  const modalOpen = creating || !!editing;

  const { data: vehicles, isLoading } = useQuery({
    queryKey: ['py-vehicles'],
    queryFn: async () => (await api.get<Vehicle[]>('/poultry/vehicles')).data,
  });
  const { data: staff } = useQuery({
    queryKey: ['py-staff-all'],
    queryFn: async () => (await api.get<{ data: { id: string; name: string }[] }>('/poultry/staff', { params: { limit: 200 } })).data.data,
    enabled: modalOpen,
  });
  const { data: loans } = useQuery({
    queryKey: ['py-loans'],
    queryFn: async () => (await api.get<{ id: string; reference: string; provider: string }[]>('/poultry/loans')).data,
    enabled: modalOpen && canFinance,
  });

  const save = useMutation({
    mutationFn: async () => {
      const body = {
        name: form.name,
        regNo: form.regNo || undefined,
        driverStaffId: form.driverStaffId || undefined,
        loanId: form.loanId || undefined,
        notes: form.notes || undefined,
        ...(editing ? { isActive: form.isActive } : {}),
      };
      if (editing) return api.patch(`/poultry/vehicles/${editing.id}`, body);
      return api.post('/poultry/vehicles', body);
    },
    onSuccess: () => {
      toast.success(editing ? 'Vehicle updated' : 'Vehicle added');
      setCreating(false); setEditing(null); setForm(EMPTY_VEHICLE_FORM);
      qc.invalidateQueries({ queryKey: ['py-vehicles'] });
    },
    onError: (e) => toast.error(apiErrorMessage(e)),
  });

  const columns: DataTableColumn<Vehicle>[] = [
    { key: 'code', header: 'Code', width: 100, render: (v) => <span style={{ fontWeight: 600 }}>{v.code}</span> },
    { key: 'name', header: 'Vehicle', render: (v) => v.name },
    { key: 'regNo', header: 'Reg no', width: 140, render: (v) => v.regNo ?? <span className="ds-caption">—</span> },
    { key: 'isActive', header: 'Status', width: 100, render: (v) => <Badge tone={v.isActive ? 'active' : 'expired'}>{v.isActive ? 'Active' : 'Inactive'}</Badge> },
    { key: 'costs', header: '', width: 90, render: () => (
      <button className="btn-ghost btn-sm" onClick={(e) => { e.stopPropagation(); router.push('/poultry/expenses'); }}>Costs</button>
    ) },
    ...(canManage ? [{ key: 'actions', header: '', width: 80, render: (v: Vehicle) => (
      <button className="btn-ghost btn-sm" onClick={(e) => {
        e.stopPropagation();
        setEditing(v);
        setForm({ name: v.name, regNo: v.regNo ?? '', driverStaffId: v.driverStaffId ?? '', loanId: v.loanId ?? '', isActive: v.isActive, notes: v.notes ?? '' });
      }}>Edit</button>
    ) }] : []),
  ];

  return (
    <div>
      <SectionTitle
        sub="Fuel, EMI and repairs report against the vehicle from the Expenses screen"
        action={canManage ? <button className="btn-primary btn-sm" onClick={() => { setEditing(null); setForm(EMPTY_VEHICLE_FORM); setCreating(true); }}>New vehicle</button> : undefined}
      >Vehicles</SectionTitle>
      <Card flush>
        <DataTable
          rows={vehicles ?? []}
          columns={columns}
          rowKey={(v) => v.id}
          loading={isLoading}
          dense
          empty={<EmptyState title="No vehicles" body="Add the pickup and delivery vehicles to track their running cost." compact />}
        />
      </Card>

      <Modal
        open={modalOpen}
        onClose={() => { setCreating(false); setEditing(null); }}
        title={editing ? `Edit ${editing.name}` : 'New vehicle'}
        width={560}
        footer={(
          <>
            <button className="btn-secondary" onClick={() => { setCreating(false); setEditing(null); }}>Cancel</button>
            <button className="btn-primary" disabled={save.isPending || !form.name} onClick={() => save.mutate()}>
              {save.isPending ? 'Saving…' : editing ? 'Save changes' : 'Add vehicle'}
            </button>
          </>
        )}
      >
        <FormSection title="The vehicle">
          <Field label="Name" required>
            <input className="input" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
          </Field>
          <Field label="Reg no">
            <input className="input" value={form.regNo} onChange={(e) => setForm({ ...form, regNo: e.target.value })} />
          </Field>
          <Field label="Driver">
            <select className="input" value={form.driverStaffId} onChange={(e) => setForm({ ...form, driverStaffId: e.target.value })}>
              <option value="">Unassigned</option>
              {(staff ?? []).map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
            </select>
          </Field>
          {canFinance && (
            <Field label="Financed by loan">
              <select className="input" value={form.loanId} onChange={(e) => setForm({ ...form, loanId: e.target.value })}>
                <option value="">Owned outright</option>
                {(loans ?? []).map((l) => <option key={l.id} value={l.id}>{l.reference} · {l.provider}</option>)}
              </select>
            </Field>
          )}
          <Field label="Notes" span={2}>
            <input className="input" value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} />
          </Field>
          {editing && (
            <Field label="Status" span={2}>
              <label style={{ display: 'flex', gap: 8, alignItems: 'center', fontSize: 13 }}>
                <input type="checkbox" checked={form.isActive} onChange={(e) => setForm({ ...form, isActive: e.target.checked })} />
                Active
              </label>
            </Field>
          )}
        </FormSection>
      </Modal>
    </div>
  );
}
