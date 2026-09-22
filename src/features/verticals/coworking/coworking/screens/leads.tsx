'use client';

/**
 * BNO Connect — the lead pipeline.
 *
 * A board, not a contact list: stages are the tenant's own (editable, and the
 * eight defaults are seeded on first read), every move writes to the activity
 * rail, and a lead carries what a coworking sale actually needs — the space
 * type they want, how many people, the budget and when they want to start.
 */

import { useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import {
  ArrowRight, CalendarPlus, FileText, Phone, Plus, Settings2, UserPlus, Users2,
} from 'lucide-react';
import { api, apiErrorMessage } from '@/lib/api';
import {
  Badge, Card, DataTable, Drawer, EmptyState, Field, FormSection, Modal, Segmented,
  Skeleton, Timeline, humanStatus, type DataTableColumn,
} from '../ui/kit';
import { LEAD_SOURCES, SPACE_TYPES, spaceTypeLabel } from '../ui/tone';
import {
  Detail, DetailGrid, PageHead, Pagination, SearchBox, fmtDate, fmtDateTime,
  money, relativeDays, toDateInput, useListState,
} from '../ui/common';

interface Stage { id: string; name: string; order: number; color?: string | null; isWon: boolean; isLost: boolean; isSystem: boolean }
interface Lead {
  id: string; reference: string; name: string; company?: string | null; email?: string | null; phone?: string | null;
  source: string; stageId: string; outcome: string; priority: string;
  interestedType?: string | null; capacityNeeded?: number | null; budgetInr?: number | null;
  expectedStartDate?: string | null; followUpAt?: string | null; lastContactAt?: string | null;
  nextAction?: string | null; notes?: string | null; lostReason?: string | null;
  convertedCustomerId?: string | null; createdAt: string;
  stage?: Stage;
  _count?: { siteVisits: number; quotations: number; activities: number };
}
interface Board { stages: (Stage & { leads: Lead[]; count: number; valueInr: number })[]; total: number }

const emptyLead = {
  name: '', company: '', email: '', phone: '', source: 'WALK_IN', priority: 'MEDIUM',
  interestedType: '', capacityNeeded: '', budgetInr: '', expectedStartDate: '', nextAction: '', notes: '',
};

export function CoworkingLeads() {
  const qc = useQueryClient();
  const [view, setView] = useState<'Board' | 'List'>('Board');
  const { state, set, params } = useListState({ sort: 'createdAt', dir: 'desc' });
  const [openId, setOpenId] = useState<string | null>(null);
  const [newOpen, setNewOpen] = useState(false);
  const [form, setForm] = useState(emptyLead);
  const [stagesOpen, setStagesOpen] = useState(false);
  const [selected, setSelected] = useState<string[]>([]);

  const { data: stages } = useQuery({
    queryKey: ['cw-stages'],
    queryFn: async () => (await api.get<Stage[]>('/coworking/stages')).data,
  });

  const { data: board, isLoading: boardLoading } = useQuery({
    queryKey: ['cw-lead-board', state.search],
    queryFn: async () => (await api.get<Board>('/coworking/leads/board', { params: state.search ? { search: state.search } : {} })).data,
    enabled: view === 'Board',
  });

  const { data: list, isLoading: listLoading } = useQuery({
    queryKey: ['cw-leads', params],
    queryFn: async () => (await api.get<{ data: Lead[]; meta: { page: number; limit: number; total: number; totalPages: number } }>('/coworking/leads', { params })).data,
    enabled: view === 'List',
  });

  const invalidate = () => {
    qc.invalidateQueries({ queryKey: ['cw-lead-board'] });
    qc.invalidateQueries({ queryKey: ['cw-leads'] });
    qc.invalidateQueries({ queryKey: ['cw-dashboard'] });
  };

  const create = useMutation({
    mutationFn: () => api.post('/coworking/leads', {
      name: form.name.trim(),
      company: form.company.trim() || undefined,
      email: form.email.trim() || undefined,
      phone: form.phone.trim() || undefined,
      source: form.source,
      priority: form.priority,
      interestedType: form.interestedType || undefined,
      capacityNeeded: form.capacityNeeded ? Number(form.capacityNeeded) : undefined,
      budgetInr: form.budgetInr ? Number(form.budgetInr) : undefined,
      expectedStartDate: form.expectedStartDate ? new Date(form.expectedStartDate).toISOString() : undefined,
      nextAction: form.nextAction.trim() || undefined,
      notes: form.notes.trim() || undefined,
    }),
    onSuccess: () => { toast.success('Lead added'); setNewOpen(false); setForm(emptyLead); invalidate(); },
    onError: (e) => toast.error(apiErrorMessage(e)),
  });

  const move = useMutation({
    mutationFn: ({ id, stageId, lostReason }: { id: string; stageId: string; lostReason?: string }) =>
      api.post(`/coworking/leads/${id}/move`, { stageId, lostReason }),
    onSuccess: () => { toast.success('Moved'); invalidate(); },
    onError: (e) => toast.error(apiErrorMessage(e)),
  });

  const bulk = useMutation({
    mutationFn: (patch: { stageId?: string; priority?: string }) =>
      api.post('/coworking/leads/bulk', { ids: selected, ...patch }),
    onSuccess: () => { toast.success(`${selected.length} lead(s) updated`); setSelected([]); invalidate(); },
    onError: (e) => toast.error(apiErrorMessage(e)),
  });

  const columns: DataTableColumn<Lead>[] = [
    {
      key: 'select', header: '', width: 40,
      render: (r) => (
        <input
          type="checkbox" aria-label={`Select ${r.name}`}
          checked={selected.includes(r.id)}
          onClick={(e) => e.stopPropagation()}
          onChange={() => setSelected((s) => s.includes(r.id) ? s.filter((x) => x !== r.id) : [...s, r.id])}
        />
      ),
    },
    {
      key: 'name', header: 'Lead', sortable: true,
      render: (r) => (
        <span>
          <span style={{ display: 'block', fontWeight: 600 }}>{r.name}</span>
          <span className="ds-caption">{r.company || r.phone || r.email || r.reference}</span>
        </span>
      ),
    },
    { key: 'source', header: 'Source', render: (r) => humanStatus(r.source) },
    { key: 'interestedType', header: 'Wants', render: (r) => r.interestedType ? `${spaceTypeLabel(r.interestedType)}${r.capacityNeeded ? ` × ${r.capacityNeeded}` : ''}` : '—' },
    { key: 'budgetInr', header: 'Budget', align: 'right', sortable: true, render: (r) => r.budgetInr ? money(r.budgetInr) : '—' },
    { key: 'stage', header: 'Stage', render: (r) => <Badge tone={r.outcome === 'WON' ? 'active' : r.outcome === 'LOST' ? 'expired' : 'info'}>{r.stage?.name ?? '—'}</Badge> },
    { key: 'followUpAt', header: 'Follow up', sortable: true, render: (r) => r.followUpAt ? relativeDays(r.followUpAt) : '—' },
  ];

  return (
    <div className="ds-page">
      <PageHead
        title="BNO Connect"
        subtitle="Enquiries from every channel, worked to a decision."
        actions={
          <>
            <Segmented options={['Board', 'List']} value={view} onChange={(v) => setView(v as 'Board' | 'List')} />
            <button className="btn-ghost" onClick={() => setStagesOpen(true)}><Settings2 size={14} style={{ marginRight: 6 }} />Stages</button>
            <button className="btn-primary" onClick={() => setNewOpen(true)}><Plus size={14} style={{ marginRight: 6 }} />New lead</button>
          </>
        }
      />

      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center', marginBottom: 14 }}>
        <SearchBox value={state.search} onChange={(v) => set({ search: v })} placeholder="Name, company, phone…" />
        {selected.length > 0 && (
          <>
            <span className="ds-caption">{selected.length} selected</span>
            <select className="input" style={{ maxWidth: 190 }} defaultValue="" aria-label="Move selected to stage"
              onChange={(e) => { if (e.target.value) bulk.mutate({ stageId: e.target.value }); e.target.value = ''; }}>
              <option value="">Move to stage…</option>
              {(stages ?? []).filter((s) => !s.isLost).map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
            </select>
            <button className="btn-ghost btn-sm" onClick={() => setSelected([])}>Clear</button>
          </>
        )}
      </div>

      {view === 'Board' ? (
        boardLoading ? (
          <Skeleton rows={2} height={180} />
        ) : !board?.total ? (
          <EmptyState icon={Users2} title="No leads yet" body="Every enquiry — website, WhatsApp, walk-in — starts here." actionLabel="New lead" onAction={() => setNewOpen(true)} />
        ) : (
          <div className="ds-scroll-x" style={{ display: 'flex', gap: 12, alignItems: 'flex-start', paddingBottom: 8 }}>
            {board.stages.map((s) => (
              <div key={s.id} style={{ flex: '0 0 268px', minWidth: 268 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8, padding: '0 2px' }}>
                  <span style={{ width: 8, height: 8, borderRadius: 3, background: s.color ?? 'var(--ink-3)' }} />
                  <span style={{ fontSize: 13, fontWeight: 650 }}>{s.name}</span>
                  <span className="ds-count">{s.count}</span>
                  {s.valueInr > 0 && <span className="ds-caption" style={{ marginLeft: 'auto' }}>{money(s.valueInr)}</span>}
                </div>
                <div style={{ display: 'grid', gap: 8 }}>
                  {s.leads.map((l) => (
                    <button
                      key={l.id} type="button" className="ds-card ds-card-interactive"
                      style={{ padding: 12, textAlign: 'left', font: 'inherit', width: '100%' }}
                      onClick={() => setOpenId(l.id)}
                    >
                      <div style={{ fontSize: 13, fontWeight: 640, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{l.name}</div>
                      {l.company && <div className="ds-caption" style={{ marginTop: 1 }}>{l.company}</div>}
                      <div style={{ display: 'flex', gap: 6, marginTop: 8, flexWrap: 'wrap', alignItems: 'center' }}>
                        <span className="ds-badge ds-tone-neutral" style={{ fontSize: 10.5 }}>{humanStatus(l.source)}</span>
                        {l.interestedType && <span className="ds-caption">{spaceTypeLabel(l.interestedType)}</span>}
                      </div>
                      {(l.budgetInr || l.followUpAt) && (
                        <div style={{ display: 'flex', gap: 8, marginTop: 8, alignItems: 'center' }}>
                          {l.budgetInr ? <span style={{ fontSize: 12, fontWeight: 650 }}>{money(l.budgetInr)}</span> : null}
                          {l.followUpAt && <span className="ds-caption" style={{ marginLeft: 'auto' }}>{relativeDays(l.followUpAt)}</span>}
                        </div>
                      )}
                    </button>
                  ))}
                  {!s.leads.length && <div className="ds-caption" style={{ padding: '10px 2px' }}>Empty</div>}
                </div>
              </div>
            ))}
          </div>
        )
      ) : (
        <>
          <Card flush>
            <DataTable
              rows={list?.data ?? []}
              columns={columns}
              rowKey={(r) => r.id}
              loading={listLoading}
              onRowClick={(r) => setOpenId(r.id)}
              empty={<EmptyState compact icon={Users2} title="No leads match" />}
            />
          </Card>
          <Pagination meta={list?.meta} onPage={(p) => set({ page: p })} />
        </>
      )}

      {/* ── New lead ────────────────────────────────────────────── */}
      <Drawer
        open={newOpen} onClose={() => setNewOpen(false)} title="New lead" width={540}
        actions={<button className="btn-primary btn-sm" disabled={!form.name.trim() || create.isPending} onClick={() => create.mutate()}>Save</button>}
      >
        <FormSection title="Who">
          <Field label="Name" required><input className="input" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} /></Field>
          <Field label="Company"><input className="input" value={form.company} onChange={(e) => setForm({ ...form, company: e.target.value })} /></Field>
          <Field label="Email"><input className="input" type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} /></Field>
          <Field label="Phone"><input className="input" value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} /></Field>
          <Field label="Source">
            <select className="input" value={form.source} onChange={(e) => setForm({ ...form, source: e.target.value })}>
              {LEAD_SOURCES.map((s) => <option key={s} value={s}>{humanStatus(s)}</option>)}
            </select>
          </Field>
          <Field label="Priority">
            <select className="input" value={form.priority} onChange={(e) => setForm({ ...form, priority: e.target.value })}>
              {['LOW', 'MEDIUM', 'HIGH', 'URGENT'].map((p) => <option key={p} value={p}>{humanStatus(p)}</option>)}
            </select>
          </Field>
        </FormSection>

        <FormSection title="What they want">
          <Field label="Space type">
            <select className="input" value={form.interestedType} onChange={(e) => setForm({ ...form, interestedType: e.target.value })}>
              <option value="">—</option>
              {SPACE_TYPES.map((t) => <option key={t} value={t}>{spaceTypeLabel(t)}</option>)}
            </select>
          </Field>
          <Field label="How many people"><input className="input" type="number" min={1} value={form.capacityNeeded} onChange={(e) => setForm({ ...form, capacityNeeded: e.target.value })} /></Field>
          <Field label="Budget"><input className="input" type="number" min={0} value={form.budgetInr} onChange={(e) => setForm({ ...form, budgetInr: e.target.value })} /></Field>
          <Field label="Wants to start"><input className="input" type="date" value={form.expectedStartDate} onChange={(e) => setForm({ ...form, expectedStartDate: e.target.value })} /></Field>
          <Field label="Next action" span={2}><input className="input" value={form.nextAction} onChange={(e) => setForm({ ...form, nextAction: e.target.value })} placeholder="Call back Thursday with a quote" /></Field>
          <Field label="Notes" span={2}><textarea className="input" rows={3} value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} /></Field>
        </FormSection>
      </Drawer>

      {stagesOpen && <StageEditor stages={stages ?? []} onClose={() => setStagesOpen(false)} />}
      {openId && <LeadRecord id={openId} stages={stages ?? []} onClose={() => setOpenId(null)} onMove={(stageId, lostReason) => move.mutate({ id: openId, stageId, lostReason })} />}
    </div>
  );
}

/* ───────────────────────────────────────────────────── stage editor */

function StageEditor({ stages, onClose }: { stages: Stage[]; onClose: () => void }) {
  const qc = useQueryClient();
  const [name, setName] = useState('');

  const refresh = () => qc.invalidateQueries({ queryKey: ['cw-stages'] });

  const add = useMutation({
    mutationFn: () => api.post('/coworking/stages', { name: name.trim() }),
    onSuccess: () => { toast.success('Stage added'); setName(''); refresh(); },
    onError: (e) => toast.error(apiErrorMessage(e)),
  });

  const rename = useMutation({
    mutationFn: ({ id, value }: { id: string; value: string }) => api.patch(`/coworking/stages/${id}`, { name: value }),
    onSuccess: refresh,
    onError: (e) => toast.error(apiErrorMessage(e)),
  });

  const remove = useMutation({
    mutationFn: (id: string) => api.delete(`/coworking/stages/${id}`),
    onSuccess: () => { toast.success('Stage removed'); refresh(); },
    onError: (e) => toast.error(apiErrorMessage(e)),
  });

  const reorder = useMutation({
    mutationFn: (ids: string[]) => api.post('/coworking/stages/reorder', { ids }),
    onSuccess: refresh,
    onError: (e) => toast.error(apiErrorMessage(e)),
  });

  const move = (index: number, delta: number) => {
    const ids = stages.map((s) => s.id);
    const target = index + delta;
    if (target < 0 || target >= ids.length) return;
    [ids[index], ids[target]] = [ids[target], ids[index]];
    reorder.mutate(ids);
  };

  return (
    <Drawer open onClose={onClose} title="Pipeline stages" subtitle="Rename, reorder or add your own" width={460}>
      <div style={{ display: 'grid', gap: 8, marginBottom: 20 }}>
        {stages.map((s, i) => (
          <div key={s.id} className="ds-list-row" style={{ gap: 8 }}>
            <span style={{ width: 8, height: 8, borderRadius: 3, background: s.color ?? 'var(--ink-3)', flex: 'none' }} />
            <input
              className="input" defaultValue={s.name} style={{ flex: 1 }}
              onBlur={(e) => { if (e.target.value.trim() && e.target.value !== s.name) rename.mutate({ id: s.id, value: e.target.value.trim() }); }}
            />
            {s.isWon && <span className="ds-badge ds-tone-active">Won</span>}
            {s.isLost && <span className="ds-badge ds-tone-expired">Lost</span>}
            <button className="btn-ghost btn-sm" onClick={() => move(i, -1)} disabled={i === 0} aria-label="Move up">↑</button>
            <button className="btn-ghost btn-sm" onClick={() => move(i, 1)} disabled={i === stages.length - 1} aria-label="Move down">↓</button>
            <button className="btn-ghost btn-sm" onClick={() => remove.mutate(s.id)} aria-label="Remove stage">×</button>
          </div>
        ))}
      </div>
      <div style={{ display: 'flex', gap: 8 }}>
        <input className="input" placeholder="New stage name" value={name} onChange={(e) => setName(e.target.value)} />
        <button className="btn-primary btn-sm" disabled={!name.trim() || add.isPending} onClick={() => add.mutate()}>Add</button>
      </div>
      <p className="ds-caption" style={{ marginTop: 14 }}>
        A stage still holding leads cannot be removed — move them first, so nothing falls off the board.
      </p>
    </Drawer>
  );
}

/* ───────────────────────────────────────────────────── lead record */

interface LeadDetail extends Lead {
  siteVisits: { id: string; reference: string; scheduledAt: string; status: string }[];
  quotations: { id: string; reference: string; status: string; totalInr: number }[];
  activities: { id: string; kind: string; title: string; body?: string | null; at: string }[];
  customer?: { id: string; name: string; reference: string } | null;
}

function LeadRecord({
  id, stages, onClose, onMove,
}: { id: string; stages: Stage[]; onClose: () => void; onMove: (stageId: string, lostReason?: string) => void }) {
  const qc = useQueryClient();
  const [tab, setTab] = useState('Overview');
  const [note, setNote] = useState('');
  const [noteKind, setNoteKind] = useState('NOTE');
  const [lostReason, setLostReason] = useState('');
  const [visitOpen, setVisitOpen] = useState(false);
  const [visitAt, setVisitAt] = useState(`${toDateInput()}T11:00`);

  const { data: lead, isLoading } = useQuery({
    queryKey: ['cw-lead', id],
    queryFn: async () => (await api.get<LeadDetail>(`/coworking/leads/${id}`)).data,
  });

  const invalidate = () => {
    qc.invalidateQueries({ queryKey: ['cw-lead', id] });
    qc.invalidateQueries({ queryKey: ['cw-lead-board'] });
    qc.invalidateQueries({ queryKey: ['cw-leads'] });
  };

  const logActivity = useMutation({
    mutationFn: () => api.post('/coworking/activities', { kind: noteKind, title: note.trim(), leadId: id }),
    onSuccess: () => { toast.success('Logged'); setNote(''); invalidate(); },
    onError: (e) => toast.error(apiErrorMessage(e)),
  });

  const convert = useMutation({
    mutationFn: () => api.post(`/coworking/leads/${id}/convert`, {}),
    onSuccess: (res) => {
      const body = res.data as { alreadyConverted: boolean; customer: { reference: string } };
      toast.success(body.alreadyConverted ? `Already a customer (${body.customer.reference})` : `Converted to ${body.customer.reference}`);
      invalidate();
      qc.invalidateQueries({ queryKey: ['cw-customers'] });
    },
    onError: (e) => toast.error(apiErrorMessage(e)),
  });

  const scheduleVisit = useMutation({
    mutationFn: () => api.post('/coworking/site-visits', {
      leadId: id,
      visitorName: lead?.name ?? 'Visitor',
      visitorPhone: lead?.phone ?? undefined,
      visitorEmail: lead?.email ?? undefined,
      scheduledAt: new Date(visitAt).toISOString(),
      headcount: lead?.capacityNeeded ?? 1,
    }),
    onSuccess: () => { toast.success('Site visit booked'); setVisitOpen(false); invalidate(); qc.invalidateQueries({ queryKey: ['cw-site-visits'] }); },
    onError: (e) => toast.error(apiErrorMessage(e)),
  });

  const currentStage = useMemo(() => stages.find((s) => s.id === lead?.stageId), [stages, lead]);
  const nextStage = useMemo(() => {
    if (!currentStage) return null;
    return stages.find((s) => s.order > currentStage.order && !s.isLost) ?? null;
  }, [stages, currentStage]);

  return (
    <Drawer
      open onClose={onClose}
      title={lead?.name ?? 'Lead'}
      subtitle={lead ? `${lead.reference} · ${humanStatus(lead.source)}` : undefined}
      tabs={['Overview', 'Timeline', 'Proposals']}
      activeTab={tab} onTab={setTab}
      counts={{ Timeline: lead?.activities.length, Proposals: lead?.quotations.length }}
      width={580}
      actions={lead && <Badge tone={lead.outcome === 'WON' ? 'active' : lead.outcome === 'LOST' ? 'expired' : 'info'}>{currentStage?.name ?? humanStatus(lead.outcome)}</Badge>}
    >
      {isLoading || !lead ? (
        <Skeleton rows={4} height={60} />
      ) : tab === 'Overview' ? (
        <div style={{ display: 'grid', gap: 22 }}>
          <DetailGrid>
            <Detail label="Company" value={lead.company} />
            <Detail label="Phone" value={lead.phone} />
            <Detail label="Email" value={lead.email} />
            <Detail label="Wants" value={lead.interestedType ? spaceTypeLabel(lead.interestedType) : '—'} />
            <Detail label="People" value={lead.capacityNeeded} />
            <Detail label="Budget" value={lead.budgetInr ? money(lead.budgetInr) : '—'} />
            <Detail label="Wants to start" value={fmtDate(lead.expectedStartDate)} />
            <Detail label="Last contact" value={lead.lastContactAt ? relativeDays(lead.lastContactAt) : 'Never'} />
            <Detail label="Follow up" value={lead.followUpAt ? relativeDays(lead.followUpAt) : '—'} />
            <Detail label="Priority" value={humanStatus(lead.priority)} />
          </DetailGrid>

          {lead.nextAction && (
            <Card pad={14}>
              <div className="ds-caption">Next action</div>
              <div style={{ fontSize: 13.5, marginTop: 3 }}>{lead.nextAction}</div>
            </Card>
          )}

          <div>
            <h3 className="ds-h3" style={{ marginBottom: 8 }}>Move the lead on</h3>
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
              {nextStage && (
                <button className="btn-primary btn-sm" onClick={() => onMove(nextStage.id)}>
                  {nextStage.name} <ArrowRight size={13} style={{ marginLeft: 6 }} />
                </button>
              )}
              <select className="input btn-sm" style={{ maxWidth: 190 }} value="" aria-label="Move to stage"
                onChange={(e) => { if (e.target.value) onMove(e.target.value); }}>
                <option value="">Move to…</option>
                {stages.filter((s) => !s.isLost).map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
              </select>
            </div>
            {stages.some((s) => s.isLost) && lead.outcome === 'OPEN' && (
              <div style={{ display: 'flex', gap: 8, marginTop: 10 }}>
                <input className="input" placeholder="Why was it lost?" value={lostReason} onChange={(e) => setLostReason(e.target.value)} />
                <button
                  className="btn-danger btn-sm"
                  disabled={!lostReason.trim()}
                  onClick={() => onMove(stages.find((s) => s.isLost)!.id, lostReason.trim())}
                >Mark lost</button>
              </div>
            )}
          </div>

          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            <button className="btn-ghost btn-sm" onClick={() => setVisitOpen(true)}>
              <CalendarPlus size={13} style={{ marginRight: 6 }} />Book a site visit
            </button>
            {!lead.convertedCustomerId ? (
              <button className="btn-ghost btn-sm" disabled={convert.isPending} onClick={() => convert.mutate()}>
                <UserPlus size={13} style={{ marginRight: 6 }} />Convert to customer
              </button>
            ) : (
              <span className="ds-caption" style={{ alignSelf: 'center' }}>Converted to {lead.customer?.reference}</span>
            )}
          </div>

          <div>
            <h3 className="ds-h3" style={{ marginBottom: 8 }}>Log an activity</h3>
            <div style={{ display: 'flex', gap: 8 }}>
              <select className="input" style={{ maxWidth: 140 }} value={noteKind} onChange={(e) => setNoteKind(e.target.value)} aria-label="Activity kind">
                {['CALL', 'EMAIL', 'WHATSAPP', 'MEETING', 'NOTE', 'FOLLOW_UP'].map((k) => <option key={k} value={k}>{humanStatus(k)}</option>)}
              </select>
              <input className="input" placeholder="What happened?" value={note} onChange={(e) => setNote(e.target.value)} />
              <button className="btn-primary btn-sm" disabled={!note.trim() || logActivity.isPending} onClick={() => logActivity.mutate()}>Log</button>
            </div>
          </div>

          {lead.notes && (
            <div>
              <h3 className="ds-h3" style={{ marginBottom: 6 }}>Notes</h3>
              <p className="ds-body">{lead.notes}</p>
            </div>
          )}

          {lead.lostReason && (
            <Card pad={14} tone="expired">
              <div className="ds-caption">Lost because</div>
              <div style={{ fontSize: 13.5, marginTop: 3 }}>{lead.lostReason}</div>
            </Card>
          )}

          {visitOpen && (
            <Modal
              open onClose={() => setVisitOpen(false)} title="Book a site visit" width={460}
              footer={
                <>
                  <button className="btn-ghost" onClick={() => setVisitOpen(false)}>Cancel</button>
                  <button className="btn-primary" style={{ marginLeft: 'auto' }} disabled={scheduleVisit.isPending} onClick={() => scheduleVisit.mutate()}>Book it</button>
                </>
              }
            >
              <Field label="When" hint="The lead moves to Site Visit Scheduled automatically.">
                <input className="input" type="datetime-local" value={visitAt} onChange={(e) => setVisitAt(e.target.value)} />
              </Field>
            </Modal>
          )}
        </div>
      ) : tab === 'Timeline' ? (
        !lead.activities.length ? (
          <EmptyState compact icon={Phone} title="Nothing logged yet" body="Calls, emails, visits and stage changes all appear here." />
        ) : (
          <Timeline
            items={lead.activities.map((a) => ({
              at: a.at, title: a.title, detail: a.body ?? undefined,
              tone: a.kind === 'STATUS_CHANGE' ? 'renewal' : a.kind === 'SITE_VISIT' ? 'sales' : 'neutral',
            }))}
          />
        )
      ) : (
        <div style={{ display: 'grid', gap: 10 }}>
          {lead.siteVisits.map((v) => (
            <div key={v.id} className="ds-list-row">
              <CalendarPlus size={14} style={{ color: 'var(--ink-3)' }} />
              <span style={{ fontSize: 13 }}>{v.reference}</span>
              <span className="ds-caption" style={{ marginLeft: 'auto' }}>{fmtDateTime(v.scheduledAt)} · {humanStatus(v.status)}</span>
            </div>
          ))}
          {lead.quotations.map((q) => (
            <div key={q.id} className="ds-list-row">
              <FileText size={14} style={{ color: 'var(--ink-3)' }} />
              <span style={{ fontSize: 13 }}>{q.reference}</span>
              <span className="ds-caption" style={{ marginLeft: 'auto' }}>{money(q.totalInr)} · {humanStatus(q.status)}</span>
            </div>
          ))}
          {!lead.siteVisits.length && !lead.quotations.length && (
            <EmptyState compact icon={FileText} title="No visits or proposals yet" />
          )}
        </div>
      )}
    </Drawer>
  );
}
