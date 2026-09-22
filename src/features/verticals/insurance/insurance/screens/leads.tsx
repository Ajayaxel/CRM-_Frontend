'use client';

/**
 * Insurance → Leads. The front of the broker funnel: Lead → Client → Quote → Policy.
 *
 * The generic /leads screen converts a lead into an *Admission*, which is an
 * institute concept — a broker needs an InsClient. `InsClient.leadId` has been in
 * the schema (and rendered on the client profile as "Converted from a CRM lead")
 * since day one with nothing ever writing it. "Convert to client" here is the
 * headline action precisely because it is the write that closes that link.
 *
 * Endpoints:
 *   GET   /insurance/leads                  -> leads + { converted, client } per lead
 *   POST  /insurance/leads/:id/convert      -> { client, lead, created }
 *   GET   /leads/stats · /leads/stages
 *   PATCH /leads/:id/stage · /leads/:id/assign
 *   POST  /leads · GET /leads/:id/timeline · /leads/:id/notes (GET+POST)
 *   GET   /tasks?relatedType=LEAD&relatedId=:id
 *
 * Moving a card is a drag OR the "Move to" menu on every card — same rule as the
 * claims board: drag alone is inaccessible and unusable on touch, so the menu is
 * the real control and the drag is the shortcut.
 */

import { useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import {
  Activity, CheckSquare, Contact, KanbanSquare, Plus, Search, ShieldAlert,
  StickyNote, TrendingUp, UserPlus, Users2, Wallet,
} from 'lucide-react';
import { api, apiErrorMessage } from '@/lib/api';
import { useAuth } from '@/features/foundation/auth';
import { fmtOrgMoney, labelFor, orgLocale } from '@/lib/org-locale';
import {
  Avatar, Badge, Card, DataTable, Drawer, EmptyState, Field, FormSection, Segmented,
  Skeleton, StatCard, Timeline, Toolbar, humanStatus, type DataTableColumn, type Tone,
} from '../ui/kit';

// ============================================================ domain

interface Stage {
  id: string;
  name: string;
  color?: string | null;
  order: number;
  isWon: boolean;
  isLost: boolean;
}

interface Lead {
  id: string;
  firstName: string;
  lastName?: string | null;
  email?: string | null;
  phone?: string | null;
  source: string;
  priority: string;
  score: number;
  expectedValue?: number | null;
  createdAt: string;
  lastActivityAt?: string | null;
  convertedAt?: string | null;
  stageId: string;
  stage?: Stage | null;
  assignedTo?: { id: string; firstName: string; lastName?: string | null } | null;
  /** Written by the insurance API: does an InsClient already carry this lead's id? */
  converted?: boolean;
  client?: { id: string; name: string } | null;
}

interface Staff { id: string; firstName: string; lastName?: string | null }

const SOURCE_LABELS: Record<string, string> = {
  WEBSITE: 'Website',
  WALK_IN: 'Walk-in',
  REFERRAL: 'Referral',
  SOCIAL_MEDIA: 'Social media',
  PHONE: 'Phone',
  EMAIL: 'Email',
  ADVERTISEMENT: 'Advertisement',
  EVENT: 'Event',
  OTHER: 'Other',
};
const SOURCE_OPTIONS = Object.entries(SOURCE_LABELS).map(([value, label]) => ({ value, label }));

const PRIORITY_TONE: Record<string, Tone> = {
  HIGH: 'expired',
  MEDIUM: 'renewal',
  LOW: 'neutral',
};

const leadName = (l: { firstName: string; lastName?: string | null }) =>
  `${l.firstName} ${l.lastName ?? ''}`.trim();

const fmtDate = (d?: string | Date | null) =>
  d == null ? '—' : new Date(d).toLocaleDateString(orgLocale().locale || undefined, {
    day: '2-digit', month: 'short', year: 'numeric',
  });

const staffName = (s?: { firstName: string; lastName?: string | null } | null) =>
  s ? `${s.firstName} ${s.lastName ?? ''}`.trim() : null;

/** A stage's colour band. Won reads as a win, lost as a loss, the rest are neutral work. */
const stageTone = (s?: Stage | null): Tone => (s?.isWon ? 'active' : s?.isLost ? 'expired' : 'info');

/** Score is a signal, not a grade — only the strong end earns colour. */
const scoreTone = (n: number): Tone => (n >= 75 ? 'active' : n >= 45 ? 'renewal' : 'neutral');

const VIEWS = ['Pipeline', 'List'];

// ============================================================ screen

export function InsuranceLeads() {
  const qc = useQueryClient();
  const params = useSearchParams();
  const { user } = useAuth();
  const vertical = user?.organization?.vertical ?? 'INSURANCE';
  const ownerLabel = labelFor(vertical, 'lead.owner') ?? 'Owner';

  const [view, setView] = useState('Pipeline');
  const [search, setSearch] = useState('');
  // ?new=1 opens the composer directly — same convention as Clients.
  const [addOpen, setAddOpen] = useState(() => params.get('new') === '1');
  const [openId, setOpenId] = useState<string | null>(null);

  const leadsQuery = useQuery({
    queryKey: ['ins-leads'],
    queryFn: async () => (await api.get<Lead[]>('/insurance/leads')).data,
  });

  const stagesQuery = useQuery({
    queryKey: ['lead-stages'],
    queryFn: async () => (await api.get<Stage[]>('/leads/stages')).data,
  });

  const statsQuery = useQuery({
    queryKey: ['leads-stats'],
    queryFn: async () => (await api.get<{ total: number; newThisWeek: number; funnel: any[] }>('/leads/stats')).data,
  });

  const leads = leadsQuery.data ?? [];
  const stages = useMemo(
    () => [...(stagesQuery.data ?? [])].sort((a, b) => a.order - b.order),
    [stagesQuery.data],
  );

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return leads;
    return leads.filter((l) =>
      [leadName(l), l.phone ?? '', l.email ?? '', SOURCE_LABELS[l.source] ?? l.source]
        .join(' ').toLowerCase().includes(q));
  }, [leads, search]);

  const moveStage = useMutation({
    mutationFn: (v: { id: string; stageId: string }) => api.patch(`/leads/${v.id}/stage`, { stageId: v.stageId }),
    onMutate: async (v) => {
      await qc.cancelQueries({ queryKey: ['ins-leads'] });
      const prev = qc.getQueryData<Lead[]>(['ins-leads']);
      const stage = stages.find((s) => s.id === v.stageId);
      if (prev) {
        qc.setQueryData<Lead[]>(['ins-leads'], prev.map((l) => (
          l.id === v.id ? { ...l, stageId: v.stageId, stage: stage ?? l.stage } : l
        )));
      }
      return { prev };
    },
    onError: (e, _v, ctx) => {
      if (ctx?.prev) qc.setQueryData(['ins-leads'], ctx.prev);
      toast.error(apiErrorMessage(e));
    },
    onSuccess: (_r, v) => toast.success(`Moved to ${stages.find((s) => s.id === v.stageId)?.name ?? 'the new stage'}`),
    onSettled: () => {
      qc.invalidateQueries({ queryKey: ['ins-leads'] });
      qc.invalidateQueries({ queryKey: ['leads-stats'] });
    },
  });

  // ---------------------------------------------------------- stat strip
  const converted = leads.filter((l) => l.converted).length;
  const openLeads = leads.filter((l) => !l.stage?.isWon && !l.stage?.isLost);
  const openValue = openLeads.reduce((a, l) => a + (l.expectedValue ?? 0), 0);

  if (leadsQuery.isLoading || stagesQuery.isLoading) {
    return (
      <div className="ds-stack">
        <div className="ds-grid ds-grid-kpi"><Skeleton rows={4} height={104} /></div>
        <Skeleton rows={1} height={340} />
      </div>
    );
  }

  if (leadsQuery.isError) {
    return (
      <Card>
        <EmptyState
          icon={ShieldAlert}
          title="Couldn't load your leads"
          body={apiErrorMessage(leadsQuery.error)}
          actionLabel="Try again"
          onAction={() => leadsQuery.refetch()}
        />
      </Card>
    );
  }

  return (
    <div className="ds-stack">
      <div className="ds-grid ds-grid-kpi">
        <StatCard
          label="Leads in the book"
          value={statsQuery.data?.total ?? leads.length}
          icon={Users2}
          tone="info"
        />
        <StatCard
          label="New this week"
          value={statsQuery.data?.newThisWeek ?? '—'}
          icon={TrendingUp}
          tone="sales"
        />
        {/* A tile that reads "—" for the whole book is furniture. When nobody
            has put a value on a lead yet, say so instead of showing a dash. */}
        <StatCard
          label="Open pipeline value"
          value={openValue ? fmtOrgMoney(openValue) : 'Not tracked'}
          hint={openValue ? undefined : 'Put an expected value on a lead and it adds up here'}
          icon={Wallet}
          tone="renewal"
        />
        <StatCard
          label="Converted to clients"
          value={converted}
          icon={Contact}
          tone="active"
        />
      </div>

      <Toolbar>
        <div style={{ position: 'relative', flex: 1, minWidth: 220, maxWidth: 340 }}>
          <Search
            size={15}
            aria-hidden="true"
            style={{
              position: 'absolute', left: 'var(--s-3)', top: '50%', transform: 'translateY(-50%)',
              color: 'var(--ink-3)', pointerEvents: 'none',
            }}
          />
          <input
            className="input"
            style={{ paddingLeft: 'var(--s-8)' }}
            placeholder="Search name, phone, email or source"
            aria-label="Search leads"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
        <Segmented options={VIEWS} value={view} onChange={setView} />
        <div style={{ marginLeft: 'auto' }}>
          <button className="btn-primary" onClick={() => setAddOpen(true)}>
            <Plus size={15} /> New lead
          </button>
        </div>
      </Toolbar>

      {leads.length === 0 ? (
        <Card>
          <EmptyState
            icon={Users2}
            title="No leads yet — add your first"
            body="Every policy in the book starts as an enquiry. Capture it here, work it along the pipeline, then convert it into a client."
            actionLabel="New lead"
            onAction={() => setAddOpen(true)}
          />
        </Card>
      ) : filtered.length === 0 ? (
        <Card>
          <EmptyState
            icon={Search}
            title="Nothing matches that"
            body="Try a different name, phone number or email — or clear the search."
          />
        </Card>
      ) : view === 'Pipeline' ? (
        <PipelineView
          leads={filtered}
          stages={stages}
          ownerLabel={ownerLabel}
          busy={moveStage.isPending}
          onMove={(id, stageId) => moveStage.mutate({ id, stageId })}
          onOpen={setOpenId}
        />
      ) : (
        <ListView leads={filtered} ownerLabel={ownerLabel} onOpen={setOpenId} />
      )}

      {addOpen && <NewLeadDrawer onClose={() => setAddOpen(false)} ownerLabel={ownerLabel} />}

      {openId && (
        <LeadDrawer
          id={openId}
          stages={stages}
          ownerLabel={ownerLabel}
          onClose={() => setOpenId(null)}
          onMove={(stageId) => moveStage.mutate({ id: openId, stageId })}
        />
      )}
    </div>
  );
}

// ============================================================ shared bits

function ConvertedMark({ client }: { client?: { id: string; name: string } | null }) {
  if (!client) return null;
  return (
    <Link
      href={`/insurance/clients/${client.id}`}
      onClick={(e) => e.stopPropagation()}
      title={`Converted to client ${client.name}`}
      className="ds-badge ds-tone-active"
      style={{ textDecoration: 'none', maxWidth: 170, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}
    >
      <Contact size={11} /> {client.name}
    </Link>
  );
}

/** Keyboard and touch path for moving a lead — drag alone is not an interface. */
function MoveMenu({
  stages, current, onMove, busy,
}: { stages: Stage[]; current: string; onMove: (stageId: string) => void; busy: boolean }) {
  const [open, setOpen] = useState(false);
  const wrap = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onDoc = (e: MouseEvent) => { if (!wrap.current?.contains(e.target as Node)) setOpen(false); };
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setOpen(false); };
    document.addEventListener('mousedown', onDoc);
    document.addEventListener('keydown', onKey);
    return () => { document.removeEventListener('mousedown', onDoc); document.removeEventListener('keydown', onKey); };
  }, [open]);

  return (
    <div ref={wrap} style={{ position: 'relative' }} onClick={(e) => e.stopPropagation()}>
      <button
        className="btn-ghost btn-sm"
        aria-haspopup="menu"
        aria-expanded={open}
        disabled={busy}
        onClick={() => setOpen((o) => !o)}
      >
        Move to
      </button>
      {open && (
        <div
          role="menu"
          className="ds-panel"
          style={{
            position: 'absolute', right: 0, top: 'calc(100% + 4px)', zIndex: 20,
            padding: 'var(--s-1)', minWidth: 200, maxHeight: 300, overflowY: 'auto',
          }}
        >
          {stages.filter((s) => s.id !== current).map((s) => (
            <button
              key={s.id}
              role="menuitem"
              className="btn-ghost btn-sm"
              style={{ width: '100%', justifyContent: 'flex-start' }}
              onClick={() => { setOpen(false); onMove(s.id); }}
            >
              <span className={`ds-dot ds-fg-${stageTone(s)}`} /> {s.name}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

// ============================================================ pipeline (kanban)

function PipelineView({
  leads, stages, ownerLabel, busy, onMove, onOpen,
}: {
  leads: Lead[]; stages: Stage[]; ownerLabel: string; busy: boolean;
  onMove: (id: string, stageId: string) => void; onOpen: (id: string) => void;
}) {
  const [dragId, setDragId] = useState<string | null>(null);
  const [overStage, setOverStage] = useState<string | null>(null);

  if (stages.length === 0) {
    return (
      <Card>
        <EmptyState
          icon={KanbanSquare}
          title="No lead stages configured"
          body="The pipeline needs stages to lay out. Set them up under lead settings, then this board fills itself in. The List view has every lead in the meantime."
        />
      </Card>
    );
  }

  const drop = (stageId: string, transferred?: string) => {
    setOverStage(null);
    const id = dragId ?? (transferred || null);
    setDragId(null);
    if (!id) return;
    const lead = leads.find((l) => l.id === id);
    if (!lead || lead.stageId === stageId) return;
    onMove(id, stageId);
  };

  return (
    <div className="ds-scroll-x">
      <div style={{ display: 'flex', gap: 'var(--s-3)', alignItems: 'flex-start', minWidth: 'min-content' }}>
        {stages.map((stage) => {
          const rows = leads.filter((l) => l.stageId === stage.id);
          const isOver = overStage === stage.id;
          const value = rows.reduce((a, l) => a + (l.expectedValue ?? 0), 0);
          return (
            <section
              key={stage.id}
              aria-label={`${stage.name} — ${rows.length} leads`}
              onDragOver={(e) => { e.preventDefault(); setOverStage(stage.id); }}
              onDragLeave={() => setOverStage((v) => (v === stage.id ? null : v))}
              onDrop={(e) => { e.preventDefault(); drop(stage.id, e.dataTransfer.getData('text/plain')); }}
              className="ds-inset"
              style={{
                width: 272, flex: 'none', padding: 'var(--s-3)',
                background: isOver ? 'var(--tone-info-bg)' : 'var(--surface-2)',
                outline: isOver ? '1px dashed var(--tone-info-line)' : '1px solid transparent',
                transition: 'background 140ms ease',
              }}
            >
              <header style={{ marginBottom: 'var(--s-3)' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--s-2)' }}>
                  <span className={`ds-dot ds-fg-${stageTone(stage)}`} />
                  <span className="ds-h3" style={{ minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {stage.name}
                  </span>
                  <span className="ds-count" style={{ marginLeft: 'auto', flex: 'none' }}>{rows.length}</span>
                </div>
                <div className="ds-caption" style={{ marginTop: 'var(--s-1)' }}>
                  {value > 0 ? `${fmtOrgMoney(value)} expected` : 'No value recorded'}
                </div>
              </header>

              <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--s-2)' }}>
                {rows.length === 0 ? (
                  <div className="ds-caption" style={{ padding: 'var(--s-2) 0' }}>Nothing at this stage.</div>
                ) : rows.map((l) => (
                  <PipelineCard
                    key={l.id}
                    lead={l}
                    stages={stages}
                    ownerLabel={ownerLabel}
                    busy={busy}
                    dragging={dragId === l.id}
                    onDragStart={() => setDragId(l.id)}
                    onDragEnd={() => { setDragId(null); setOverStage(null); }}
                    onMove={(stageId) => onMove(l.id, stageId)}
                    onOpen={() => onOpen(l.id)}
                  />
                ))}
              </div>
            </section>
          );
        })}
      </div>
    </div>
  );
}

function PipelineCard({
  lead: l, stages, ownerLabel, busy, dragging, onDragStart, onDragEnd, onMove, onOpen,
}: {
  lead: Lead; stages: Stage[]; ownerLabel: string; busy: boolean; dragging: boolean;
  onDragStart: () => void; onDragEnd: () => void; onMove: (stageId: string) => void; onOpen: () => void;
}) {
  const owner = staffName(l.assignedTo);
  return (
    // Native HTML5 drag needs the props on the element itself, so this card is
    // the ds-card class rather than the kit <Card>.
    <div
      className="ds-card ds-card-interactive"
      draggable
      role="button"
      tabIndex={0}
      onClick={onOpen}
      onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onOpen(); } }}
      onDragStart={(e) => {
        e.dataTransfer.effectAllowed = 'move';
        e.dataTransfer.setData('text/plain', l.id);
        onDragStart();
      }}
      onDragEnd={onDragEnd}
      style={{ padding: 'var(--s-3)', cursor: 'grab', opacity: dragging ? 0.45 : 1 }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--s-2)' }}>
        <Avatar name={leadName(l)} size={30} />
        <div style={{ minWidth: 0, flex: 1 }}>
          <div className="ds-h3" style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {leadName(l)}
          </div>
          <div className="ds-caption" style={{ marginTop: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {l.phone ?? l.email ?? 'No contact details'}
          </div>
        </div>
      </div>

      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 'var(--s-2)', marginTop: 'var(--s-3)' }}>
        <span className="ds-badge ds-tone-neutral">{SOURCE_LABELS[l.source] ?? humanStatus(l.source)}</span>
        <span className={`ds-badge ds-tone-${PRIORITY_TONE[l.priority] ?? 'neutral'}`}>{humanStatus(l.priority)}</span>
        <span className={`ds-badge ds-tone-${scoreTone(l.score)} ds-num`} title="Lead score">{l.score}</span>
        {l.expectedValue != null && l.expectedValue > 0 && (
          <span className="ds-badge ds-tone-info ds-num">{fmtOrgMoney(l.expectedValue)}</span>
        )}
        {l.converted && <ConvertedMark client={l.client} />}
      </div>

      <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--s-2)', marginTop: 'var(--s-3)' }}>
        <span
          className="ds-caption"
          title={ownerLabel}
          style={{ minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}
        >
          {owner ?? `No ${ownerLabel.toLowerCase()} yet`}
        </span>
        <span style={{ marginLeft: 'auto', flex: 'none' }}>
          <MoveMenu stages={stages} current={l.stageId} onMove={onMove} busy={busy} />
        </span>
      </div>
    </div>
  );
}

// ============================================================ list

interface ListRow {
  id: string;
  name: string;
  phone: string;
  source: string;
  priority: string;
  score: number;
  expectedValue: number | null;
  owner: string;
  stageName: string;
  converted: string;
  lead: Lead;
}

function ListView({ leads, ownerLabel, onOpen }: { leads: Lead[]; ownerLabel: string; onOpen: (id: string) => void }) {
  const rows: ListRow[] = useMemo(
    () => leads.map((l) => ({
      id: l.id,
      name: leadName(l),
      phone: l.phone ?? '',
      source: SOURCE_LABELS[l.source] ?? humanStatus(l.source),
      priority: humanStatus(l.priority),
      score: l.score,
      expectedValue: l.expectedValue ?? null,
      owner: staffName(l.assignedTo) ?? '',
      stageName: l.stage?.name ?? '',
      converted: l.converted ? (l.client?.name ?? 'Yes') : '',
      lead: l,
    })),
    [leads],
  );

  const columns: DataTableColumn<ListRow>[] = [
    {
      key: 'name',
      header: 'Lead',
      sortable: true,
      render: (r) => (
        <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--s-2)', minWidth: 0 }}>
          <Avatar name={r.name} size={30} />
          <div style={{ minWidth: 0 }}>
            <div style={{ fontWeight: 600, color: 'var(--ink)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {r.name}
            </div>
            <div className="ds-caption">{r.phone || r.lead.email || '—'}</div>
          </div>
        </div>
      ),
    },
    { key: 'source', header: 'Source', sortable: true, render: (r) => <Badge tone="neutral" dot={false}>{r.source}</Badge> },
    {
      key: 'stageName',
      header: 'Stage',
      sortable: true,
      render: (r) => (r.stageName ? <Badge tone={stageTone(r.lead.stage)}>{r.stageName}</Badge> : '—'),
    },
    {
      key: 'priority',
      header: 'Priority',
      sortable: true,
      render: (r) => <Badge tone={PRIORITY_TONE[r.lead.priority] ?? 'neutral'} dot={false}>{r.priority}</Badge>,
    },
    { key: 'owner', header: ownerLabel, sortable: true, render: (r) => r.owner || <span className="ds-caption">Unassigned</span> },
    {
      key: 'expectedValue',
      header: 'Expected value',
      sortable: true,
      align: 'right',
      render: (r) => <span className="ds-num">{fmtOrgMoney(r.expectedValue)}</span>,
    },
    {
      key: 'score',
      header: 'Score',
      sortable: true,
      align: 'right',
      render: (r) => <span className={`ds-badge ds-tone-${scoreTone(r.score)} ds-num`}>{r.score}</span>,
    },
    {
      key: 'converted',
      header: 'Client',
      sortable: true,
      render: (r) => (r.lead.converted
        ? <ConvertedMark client={r.lead.client} />
        : <span className="ds-caption">Not converted</span>),
    },
  ];

  return (
    <Card flush>
      <DataTable
        rows={rows}
        columns={columns}
        rowKey={(r) => r.id}
        onRowClick={(r) => onOpen(r.id)}
        empty="No leads match this view."
      />
    </Card>
  );
}

// ============================================================ new lead

function NewLeadDrawer({ onClose, ownerLabel }: { onClose: () => void; ownerLabel: string }) {
  const qc = useQueryClient();
  const [f, setF] = useState({
    name: '', phone: '', email: '', source: 'WEBSITE', priority: 'MEDIUM',
    expectedValue: '', assignedToId: '', notes: '',
  });
  const set = (k: keyof typeof f) => (e: { target: { value: string } }) => setF((p) => ({ ...p, [k]: e.target.value }));

  const staff = useQuery({
    queryKey: ['staff-lite'],
    queryFn: async () => (await api.get<{ data: Staff[] }>('/users?limit=100')).data.data,
  });

  const create = useMutation({
    mutationFn: () => {
      const [firstName, ...rest] = f.name.trim().split(/\s+/);
      const value = Number(f.expectedValue);
      return api.post('/leads', {
        firstName: firstName || f.name.trim(),
        lastName: rest.join(' ') || undefined,
        phone: f.phone.trim() || undefined,
        email: f.email.trim() || undefined,
        source: f.source,
        priority: f.priority,
        expectedValue: Number.isFinite(value) && value > 0 ? Math.round(value) : undefined,
        assignedToId: f.assignedToId || undefined,
        notes: f.notes.trim() || undefined,
      });
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['ins-leads'] });
      qc.invalidateQueries({ queryKey: ['leads-stats'] });
      toast.success('Lead created');
      onClose();
    },
    onError: (e) => toast.error(apiErrorMessage(e)),
  });

  const valid = f.name.trim().length > 0;

  return (
    <Drawer
      open
      onClose={onClose}
      width={520}
      title="New lead"
      subtitle="It enters at the first stage of your pipeline, and can be converted into a client once it is won."
    >
      <form onSubmit={(e) => { e.preventDefault(); if (valid && !create.isPending) create.mutate(); }}>
        <FormSection title="Who is enquiring" description="A name is enough to start; the rest can follow.">
          <Field label="Full name" required span={2}>
            <input className="input" autoFocus value={f.name} onChange={set('name')} placeholder="Aisha Rahman" />
          </Field>
          <Field label="Phone">
            <input className="input" value={f.phone} onChange={set('phone')} inputMode="tel" placeholder="+971 50 000 0000" />
          </Field>
          <Field label="Email">
            <input className="input" type="email" value={f.email} onChange={set('email')} placeholder="name@example.com" />
          </Field>
        </FormSection>

        <FormSection title="Qualification" description="How the enquiry arrived and what it is worth.">
          <Field label="Source">
            <select className="input" value={f.source} onChange={set('source')}>
              {SOURCE_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
            </select>
          </Field>
          <Field label="Priority">
            <select className="input" value={f.priority} onChange={set('priority')}>
              <option value="HIGH">High</option>
              <option value="MEDIUM">Medium</option>
              <option value="LOW">Low</option>
            </select>
          </Field>
          <Field label="Expected value" hint="Annual premium you expect to place.">
            <input className="input" value={f.expectedValue} onChange={set('expectedValue')} inputMode="numeric" placeholder="0" />
          </Field>
          <Field label={ownerLabel}>
            <select className="input" value={f.assignedToId} onChange={set('assignedToId')}>
              <option value="">Unassigned</option>
              {(staff.data ?? []).map((s) => (
                <option key={s.id} value={s.id}>{staffName(s)}</option>
              ))}
            </select>
          </Field>
          <Field label="Opening note" span={2} hint="Saved as the first note on the lead.">
            <textarea className="input" rows={3} value={f.notes} onChange={set('notes')} style={{ resize: 'vertical' }} placeholder="Asked about family health cover for four." />
          </Field>
        </FormSection>

        <div
          style={{
            display: 'flex', gap: 'var(--s-2)', justifyContent: 'flex-end',
            borderTop: '1px solid var(--hairline)', paddingTop: 'var(--s-4)',
          }}
        >
          <button type="button" className="btn-secondary" onClick={onClose}>Cancel</button>
          <button type="submit" className="btn-primary" disabled={!valid || create.isPending}>
            {create.isPending ? 'Creating…' : 'Create lead'}
          </button>
        </div>
      </form>
    </Drawer>
  );
}

// ============================================================ lead drawer

const TABS = ['Overview', 'Timeline', 'Tasks', 'Notes'];

function LeadDrawer({
  id, stages, ownerLabel, onClose, onMove,
}: { id: string; stages: Stage[]; ownerLabel: string; onClose: () => void; onMove: (stageId: string) => void }) {
  const qc = useQueryClient();
  const router = useRouter();
  const [tab, setTab] = useState('Overview');

  const leadQuery = useQuery({
    queryKey: ['lead', id],
    queryFn: async () => (await api.get<any>(`/leads/${id}`)).data,
  });

  // The convert state lives on the insurance list, which is the only place that
  // knows whether an InsClient carries this lead's id. Read it through useQuery
  // rather than getQueryData so the drawer re-renders the moment the conversion
  // lands — a stale "Convert to client" button after converting is a lie.
  const insLeads = useQuery({
    queryKey: ['ins-leads'],
    queryFn: async () => (await api.get<Lead[]>('/insurance/leads')).data,
  });
  const listed = insLeads.data?.find((l) => l.id === id);

  const timeline = useQuery({
    queryKey: ['lead-timeline', id],
    enabled: tab === 'Timeline',
    retry: false,
    queryFn: async () => (await api.get<any[]>(`/leads/${id}/timeline`)).data,
  });

  const tasks = useQuery({
    queryKey: ['lead-tasks', id],
    enabled: tab === 'Tasks',
    retry: false,
    // Verified in apps/api/src/tasks: ListTasksDto accepts relatedType + relatedId.
    queryFn: async () => (await api.get<{ data: any[] }>('/tasks', {
      params: { relatedType: 'LEAD', relatedId: id, limit: 50 },
    })).data.data,
  });

  const notes = useQuery({
    queryKey: ['lead-notes', id],
    enabled: tab === 'Notes',
    retry: false,
    queryFn: async () => (await api.get<any[]>(`/leads/${id}/notes`)).data,
  });

  const lead = leadQuery.data;
  const name = lead ? leadName(lead) : 'Lead';
  const client = listed?.client ?? null;
  const isConverted = !!listed?.converted;

  const convert = useMutation({
    mutationFn: async () => (await api.post<{ client: { id: string; name: string }; created: boolean }>(
      `/insurance/leads/${id}/convert`, {},
    )).data,
    onSuccess: (r) => {
      // Never imply a new client was made when an existing person was matched.
      toast.success(
        r.created
          ? `Client created — ${r.client.name}`
          : `Matched an existing client — ${r.client.name}. The lead is now linked to it.`,
        { action: { label: 'Open client', onClick: () => router.push(`/insurance/clients/${r.client.id}`) } },
      );
      qc.invalidateQueries({ queryKey: ['ins-leads'] });
      qc.invalidateQueries({ queryKey: ['ins-clients'] });
      qc.invalidateQueries({ queryKey: ['lead', id] });
      qc.invalidateQueries({ queryKey: ['leads-stats'] });
    },
    onError: (e) => toast.error(apiErrorMessage(e)),
  });

  return (
    <Drawer
      open
      onClose={onClose}
      width={600}
      title={name}
      subtitle={lead ? [lead.phone, lead.email].filter(Boolean).join(' · ') || 'No contact details on file' : undefined}
      tabs={TABS}
      activeTab={tab}
      onTab={setTab}
      actions={
        <Link href={`/leads/${id}`} className="btn-secondary btn-sm" style={{ textDecoration: 'none', flex: 'none' }}>
          Full record
        </Link>
      }
    >
      {leadQuery.isLoading ? (
        <Skeleton rows={4} height={84} />
      ) : leadQuery.isError ? (
        <EmptyState icon={ShieldAlert} title="Couldn't load this lead" body={apiErrorMessage(leadQuery.error)} />
      ) : (
        <>
          {tab === 'Overview' && (
            <OverviewTab
              lead={lead}
              stages={stages}
              ownerLabel={ownerLabel}
              client={client}
              isConverted={isConverted}
              converting={convert.isPending}
              onConvert={() => convert.mutate()}
              onMove={onMove}
            />
          )}
          {tab === 'Timeline' && <TimelineTab query={timeline} />}
          {tab === 'Tasks' && <TasksTab query={tasks} />}
          {tab === 'Notes' && <NotesTab id={id} query={notes} />}
        </>
      )}
    </Drawer>
  );
}

function InfoRow({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="ds-list-row">
      <span className="ds-caption">{label}</span>
      <span className="ds-list-row-meta" style={{ color: 'var(--ink)' }}>{value ?? '—'}</span>
    </div>
  );
}

function OverviewTab({
  lead, stages, ownerLabel, client, isConverted, converting, onConvert, onMove,
}: {
  lead: any; stages: Stage[]; ownerLabel: string; client: { id: string; name: string } | null;
  isConverted: boolean; converting: boolean; onConvert: () => void; onMove: (stageId: string) => void;
}) {
  const qc = useQueryClient();
  const [assignee, setAssignee] = useState<string>(lead?.assignedToId ?? '');

  const staff = useQuery({
    queryKey: ['staff-lite'],
    queryFn: async () => (await api.get<{ data: Staff[] }>('/users?limit=100')).data.data,
  });

  const assign = useMutation({
    mutationFn: (assignedToId: string) => api.patch(`/leads/${lead.id}/assign`, { assignedToId }),
    onSuccess: () => {
      toast.success(`${ownerLabel} updated`);
      qc.invalidateQueries({ queryKey: ['ins-leads'] });
      qc.invalidateQueries({ queryKey: ['lead', lead.id] });
    },
    onError: (e) => toast.error(apiErrorMessage(e)),
  });

  return (
    <div className="ds-stack">
      {/* --------------------------------------------------- the headline act */}
      <Card tone={isConverted ? 'active' : 'sales'}>
        <div className="ds-row" style={{ alignItems: 'flex-start' }}>
          <div style={{ minWidth: 0, flex: 1 }}>
            <div className="ds-h3">{isConverted ? 'Converted to a client' : 'Convert to client'}</div>
            <div className="ds-caption" style={{ marginTop: 3 }}>
              {isConverted
                ? 'Quotes, policies and claims for this person hang off the client record.'
                : 'Creates the insurance client this lead becomes — reusing an existing client if the phone or email already matches one.'}
            </div>
          </div>
        </div>
        <div style={{ display: 'flex', gap: 'var(--s-2)', marginTop: 'var(--s-4)', flexWrap: 'wrap' }}>
          {isConverted && client ? (
            <Link href={`/insurance/clients/${client.id}`} className="btn-primary" style={{ textDecoration: 'none' }}>
              <Contact size={15} /> Open {client.name}
            </Link>
          ) : (
            <button className="btn-primary" disabled={converting} onClick={onConvert}>
              <UserPlus size={15} /> {converting ? 'Converting…' : 'Convert to client'}
            </button>
          )}
        </div>
      </Card>

      {/* ------------------------------------------------------------- facts */}
      <Card>
        <div className="ds-h3" style={{ marginBottom: 'var(--s-2)' }}>Contact</div>
        <InfoRow label="Phone" value={lead?.phone || '—'} />
        <InfoRow label="Email" value={lead?.email || '—'} />
        <InfoRow label="Source" value={SOURCE_LABELS[lead?.source] ?? humanStatus(lead?.source)} />
        <InfoRow label="Priority" value={humanStatus(lead?.priority)} />
        <InfoRow label="Score" value={<span className="ds-num">{lead?.score ?? 0}</span>} />
        <InfoRow label={labelFor(orgLocale().vertical, 'lead.expectedValue') ?? 'Expected value'} value={fmtOrgMoney(lead?.expectedValue)} />
        <InfoRow label="Created" value={fmtDate(lead?.createdAt)} />
        <InfoRow label="Last activity" value={fmtDate(lead?.lastActivityAt)} />
      </Card>

      {/* ----------------------------------------------------------- actions */}
      <Card>
        <div className="ds-h3" style={{ marginBottom: 'var(--s-3)' }}>Working the lead</div>
        <div className="ds-grid" style={{ gridTemplateColumns: 'repeat(auto-fit,minmax(200px,1fr))' }}>
          <div>
            <label className="label" htmlFor="lead-stage">Stage</label>
            <select
              id="lead-stage"
              className="input"
              value={lead?.stageId ?? ''}
              onChange={(e) => onMove(e.target.value)}
            >
              {stages.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
            </select>
          </div>
          <div>
            <label className="label" htmlFor="lead-owner">{ownerLabel}</label>
            <select
              id="lead-owner"
              className="input"
              value={assignee}
              disabled={assign.isPending}
              onChange={(e) => { setAssignee(e.target.value); if (e.target.value) assign.mutate(e.target.value); }}
            >
              <option value="">Unassigned</option>
              {(staff.data ?? []).map((s) => <option key={s.id} value={s.id}>{staffName(s)}</option>)}
            </select>
          </div>
        </div>
      </Card>
    </div>
  );
}

function TimelineTab({ query }: { query: { isLoading: boolean; isError: boolean; data?: any[] } }) {
  if (query.isLoading) return <Skeleton rows={4} height={54} />;
  const items = Array.isArray(query.data) ? query.data : [];
  if (query.isError || items.length === 0) {
    return (
      <EmptyState
        icon={Activity}
        title="Nothing on the timeline yet"
        body="Stage moves, assignments and the conversion to a client all land here as they happen."
        compact
      />
    );
  }
  return (
    <Timeline
      items={items.map((it) => ({
        at: it.createdAt ?? new Date(),
        title: humanStatus(String(it.action ?? 'activity').replace(/[._]/g, ' ')),
        detail: [
          it.actor ? staffName(it.actor) : null,
          it.meta && typeof it.meta === 'object'
            ? Object.entries(it.meta).map(([k, v]) => `${k}: ${String(v)}`).join(' · ') || null
            : null,
        ].filter(Boolean).join(' — ') || undefined,
        tone: String(it.action ?? '').includes('convert') ? 'active' as Tone : 'info' as Tone,
      }))}
    />
  );
}

function TasksTab({ query }: { query: { isLoading: boolean; isError: boolean; data?: any[] } }) {
  if (query.isLoading) return <Skeleton rows={3} height={62} />;
  const items = Array.isArray(query.data) ? query.data : [];
  if (query.isError || items.length === 0) {
    return (
      <EmptyState
        icon={CheckSquare}
        title="No tasks against this lead"
        body="Follow-up calls and reminders created in Tasks and linked to this lead will show up here."
        compact
      />
    );
  }
  return (
    <div className="ds-stack">
      {items.map((t) => (
        <Card key={t.id}>
          <div className="ds-row" style={{ alignItems: 'flex-start' }}>
            <div style={{ minWidth: 0, flex: 1 }}>
              <div className="ds-h3">{t.title}</div>
              {t.description && <div className="ds-caption" style={{ marginTop: 3 }}>{t.description}</div>}
            </div>
            <Badge tone={String(t.status).toUpperCase() === 'COMPLETED' ? 'active' : 'renewal'}>
              {humanStatus(t.status)}
            </Badge>
          </div>
          <hr className="ds-divider" style={{ margin: 'var(--s-3) 0' }} />
          <div className="ds-row">
            <span className="ds-caption">{t.dueDate ? `Due ${fmtDate(t.dueDate)}` : 'No due date'}</span>
            <span className="ds-caption" style={{ marginLeft: 'auto' }}>
              {staffName(t.assignedTo) ?? 'Unassigned'}
            </span>
          </div>
        </Card>
      ))}
    </div>
  );
}

function NotesTab({ id, query }: { id: string; query: { isLoading: boolean; isError: boolean; data?: any[] } }) {
  const qc = useQueryClient();
  const [body, setBody] = useState('');

  const add = useMutation({
    mutationFn: () => api.post(`/leads/${id}/notes`, { body: body.trim() }),
    onSuccess: () => {
      setBody('');
      toast.success('Note added');
      qc.invalidateQueries({ queryKey: ['lead-notes', id] });
      qc.invalidateQueries({ queryKey: ['lead-timeline', id] });
    },
    onError: (e) => toast.error(apiErrorMessage(e)),
  });

  const items = Array.isArray(query.data) ? query.data : [];

  return (
    <div className="ds-stack">
      <Card>
        <form onSubmit={(e) => { e.preventDefault(); if (body.trim() && !add.isPending) add.mutate(); }}>
          <label className="label" htmlFor="lead-note">Add a note</label>
          <textarea
            id="lead-note"
            className="input"
            rows={3}
            value={body}
            onChange={(e) => setBody(e.target.value)}
            style={{ resize: 'vertical' }}
            placeholder="Called back — wants a motor quote for the new car by Friday."
          />
          <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 'var(--s-3)' }}>
            <button type="submit" className="btn-primary btn-sm" disabled={!body.trim() || add.isPending}>
              {add.isPending ? 'Saving…' : 'Add note'}
            </button>
          </div>
        </form>
      </Card>

      {query.isLoading ? (
        <Skeleton rows={2} height={70} />
      ) : items.length === 0 ? (
        <EmptyState
          icon={StickyNote}
          title="No notes yet"
          body="Whatever you learn on a call belongs here — it travels with the lead into the client record."
          compact
        />
      ) : (
        items.map((n) => (
          <Card key={n.id}>
            <div className="ds-body" style={{ whiteSpace: 'pre-wrap' }}>{n.body}</div>
            <hr className="ds-divider" style={{ margin: 'var(--s-3) 0' }} />
            <div className="ds-row">
              <span className="ds-caption">{staffName(n.author) ?? 'Someone'}</span>
              <span className="ds-caption" style={{ marginLeft: 'auto' }}>{fmtDate(n.createdAt)}</span>
            </div>
          </Card>
        ))
      )}
    </div>
  );
}
