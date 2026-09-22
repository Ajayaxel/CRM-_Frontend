'use client';

/**
 * Site visits — the step between an enquiry and a proposal.
 *
 * Booking one moves the lead to Site Visit Scheduled and completing one moves it
 * to Site Visit Completed, so the board reflects what happened without anybody
 * having to remember a second click.
 */

import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { CalendarClock, Plus } from 'lucide-react';
import { api, apiErrorMessage } from '@/lib/api';
import {
  Badge, Card, DataTable, Drawer, EmptyState, Field, FormSection, humanStatus, type DataTableColumn,
} from '../ui/kit';
import { toneForVisitStatus } from '../ui/tone';
import {
  DateRange, PageHead, Pagination, SearchBox, StatusSelect, fmtDateTime, toDateInput, useListState,
} from '../ui/common';

interface VisitRow {
  id: string; reference: string; visitorName: string; visitorPhone?: string | null; visitorEmail?: string | null;
  scheduledAt: string; durationMin: number; status: string; headcount: number;
  requirements?: string | null; staffName?: string | null; feedback?: string | null; rating?: number | null;
  outcome?: string | null; followUpAt?: string | null;
  lead?: { id: string; name: string; reference: string } | null;
  customer?: { id: string; name: string; reference: string } | null;
}

export function CoworkingSiteVisits() {
  const qc = useQueryClient();
  const { state, set, params } = useListState();
  const [open, setOpen] = useState<VisitRow | null>(null);
  const [newOpen, setNewOpen] = useState(false);
  const [form, setForm] = useState({
    leadId: '', visitorName: '', visitorPhone: '', visitorEmail: '',
    scheduledAt: `${toDateInput()}T11:00`, durationMin: '45', headcount: '1', requirements: '', notes: '',
  });

  const { data, isLoading } = useQuery({
    queryKey: ['cw-site-visits', params],
    queryFn: async () => (await api.get<{ data: VisitRow[]; meta: { page: number; limit: number; total: number; totalPages: number } }>('/coworking/site-visits', { params })).data,
  });

  const { data: leads } = useQuery({
    queryKey: ['cw-leads-picker'],
    queryFn: async () => (await api.get<{ data: { id: string; name: string; reference: string; phone?: string | null; email?: string | null }[] }>('/coworking/leads', { params: { limit: 200 } })).data.data,
    enabled: newOpen,
  });

  const create = useMutation({
    mutationFn: () => api.post('/coworking/site-visits', {
      leadId: form.leadId || undefined,
      visitorName: form.visitorName.trim(),
      visitorPhone: form.visitorPhone.trim() || undefined,
      visitorEmail: form.visitorEmail.trim() || undefined,
      scheduledAt: new Date(form.scheduledAt).toISOString(),
      durationMin: Number(form.durationMin) || 45,
      headcount: Number(form.headcount) || 1,
      requirements: form.requirements.trim() || undefined,
      notes: form.notes.trim() || undefined,
    }),
    onSuccess: () => {
      toast.success('Site visit booked');
      setNewOpen(false);
      qc.invalidateQueries({ queryKey: ['cw-site-visits'] });
      qc.invalidateQueries({ queryKey: ['cw-lead-board'] });
    },
    onError: (e) => toast.error(apiErrorMessage(e)),
  });

  const columns: DataTableColumn<VisitRow>[] = [
    {
      key: 'visitorName', header: 'Visitor', sortable: true,
      render: (r) => (
        <span>
          <span style={{ display: 'block', fontWeight: 600 }}>{r.visitorName}</span>
          <span className="ds-caption">{r.reference}{r.lead ? ` · ${r.lead.reference}` : ''}</span>
        </span>
      ),
    },
    { key: 'scheduledAt', header: 'When', sortable: true, render: (r) => fmtDateTime(r.scheduledAt) },
    { key: 'headcount', header: 'People', align: 'right' },
    { key: 'staffName', header: 'Shown by', render: (r) => r.staffName ?? '—' },
    { key: 'status', header: 'Status', render: (r) => <Badge tone={toneForVisitStatus(r.status)}>{humanStatus(r.status)}</Badge> },
  ];

  return (
    <div className="ds-page">
      <PageHead
        title="Site visits"
        subtitle="Who is coming to look round, and what came of it."
        actions={<button className="btn-primary" onClick={() => setNewOpen(true)}><Plus size={14} style={{ marginRight: 6 }} />Book a visit</button>}
      />

      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center', marginBottom: 14 }}>
        <SearchBox value={state.search} onChange={(v) => set({ search: v })} placeholder="Visitor or reference…" />
        <StatusSelect value={state.status} onChange={(v) => set({ status: v })} options={['SCHEDULED', 'CONFIRMED', 'COMPLETED', 'RESCHEDULED', 'CANCELLED', 'NO_SHOW']} />
        <DateRange from={state.from} to={state.to} onChange={(p) => set(p)} />
      </div>

      <Card flush>
        <DataTable
          rows={data?.data ?? []}
          columns={columns}
          rowKey={(r) => r.id}
          loading={isLoading}
          onRowClick={(r) => setOpen(r)}
          empty={<EmptyState compact icon={CalendarClock} title="No visits booked" body="Book one from a lead, or directly here." actionLabel="Book a visit" onAction={() => setNewOpen(true)} />}
        />
      </Card>
      <Pagination meta={data?.meta} onPage={(p) => set({ page: p })} />

      <Drawer
        open={newOpen} onClose={() => setNewOpen(false)} title="Book a site visit" width={500}
        actions={<button className="btn-primary btn-sm" disabled={!form.visitorName.trim() || create.isPending} onClick={() => create.mutate()}>Book</button>}
      >
        <FormSection title="Who is coming">
          <Field label="From a lead" span={2}>
            <select className="input" value={form.leadId} onChange={(e) => {
              const l = leads?.find((x) => x.id === e.target.value);
              setForm({
                ...form, leadId: e.target.value,
                visitorName: l?.name ?? form.visitorName,
                visitorPhone: l?.phone ?? form.visitorPhone,
                visitorEmail: l?.email ?? form.visitorEmail,
              });
            }}>
              <option value="">Not linked to a lead</option>
              {(leads ?? []).map((l) => <option key={l.id} value={l.id}>{l.name} ({l.reference})</option>)}
            </select>
          </Field>
          <Field label="Name" required><input className="input" value={form.visitorName} onChange={(e) => setForm({ ...form, visitorName: e.target.value })} /></Field>
          <Field label="Phone"><input className="input" value={form.visitorPhone} onChange={(e) => setForm({ ...form, visitorPhone: e.target.value })} /></Field>
          <Field label="Email"><input className="input" type="email" value={form.visitorEmail} onChange={(e) => setForm({ ...form, visitorEmail: e.target.value })} /></Field>
          <Field label="How many people"><input className="input" type="number" min={1} value={form.headcount} onChange={(e) => setForm({ ...form, headcount: e.target.value })} /></Field>
        </FormSection>
        <FormSection title="When">
          <Field label="Date and time"><input className="input" type="datetime-local" value={form.scheduledAt} onChange={(e) => setForm({ ...form, scheduledAt: e.target.value })} /></Field>
          <Field label="Minutes"><input className="input" type="number" min={5} value={form.durationMin} onChange={(e) => setForm({ ...form, durationMin: e.target.value })} /></Field>
          <Field label="What they are looking for" span={2}>
            <textarea className="input" rows={3} value={form.requirements} onChange={(e) => setForm({ ...form, requirements: e.target.value })} placeholder="6-seat private office, ground floor, parking" />
          </Field>
        </FormSection>
      </Drawer>

      {open && <VisitDrawer visit={open} onClose={() => setOpen(null)} onDone={() => { setOpen(null); qc.invalidateQueries({ queryKey: ['cw-site-visits'] }); }} />}
    </div>
  );
}

function VisitDrawer({ visit, onClose, onDone }: { visit: VisitRow; onClose: () => void; onDone: () => void }) {
  const [status, setStatus] = useState(visit.status);
  const [feedback, setFeedback] = useState(visit.feedback ?? '');
  const [rating, setRating] = useState(String(visit.rating ?? ''));
  const [outcome, setOutcome] = useState(visit.outcome ?? '');
  const [scheduledAt, setScheduledAt] = useState(visit.scheduledAt.slice(0, 16));

  const save = useMutation({
    mutationFn: () => api.patch(`/coworking/site-visits/${visit.id}/status`, {
      status,
      scheduledAt: status === 'RESCHEDULED' ? new Date(scheduledAt).toISOString() : undefined,
      feedback: feedback.trim() || undefined,
      rating: rating ? Number(rating) : undefined,
      outcome: outcome.trim() || undefined,
    }),
    onSuccess: () => { toast.success('Updated'); onDone(); },
    onError: (e) => toast.error(apiErrorMessage(e)),
  });

  return (
    <Drawer
      open onClose={onClose} title={visit.visitorName} subtitle={`${visit.reference} · ${fmtDateTime(visit.scheduledAt)}`} width={480}
      actions={<button className="btn-primary btn-sm" disabled={save.isPending} onClick={() => save.mutate()}>Save</button>}
    >
      <FormSection title="Outcome">
        <Field label="Status" span={2}>
          <select className="input" value={status} onChange={(e) => setStatus(e.target.value)}>
            {['SCHEDULED', 'CONFIRMED', 'COMPLETED', 'RESCHEDULED', 'CANCELLED', 'NO_SHOW'].map((s) => (
              <option key={s} value={s}>{humanStatus(s)}</option>
            ))}
          </select>
        </Field>
        {status === 'RESCHEDULED' && (
          <Field label="New date and time" span={2} required>
            <input className="input" type="datetime-local" value={scheduledAt} onChange={(e) => setScheduledAt(e.target.value)} />
          </Field>
        )}
        <Field label="Interest rating (1–5)"><input className="input" type="number" min={1} max={5} value={rating} onChange={(e) => setRating(e.target.value)} /></Field>
        <Field label="Outcome"><input className="input" value={outcome} onChange={(e) => setOutcome(e.target.value)} placeholder="Wants a proposal" /></Field>
        <Field label="Feedback" span={2}><textarea className="input" rows={4} value={feedback} onChange={(e) => setFeedback(e.target.value)} /></Field>
      </FormSection>

      {visit.requirements && (
        <Card pad={14}>
          <div className="ds-caption">What they asked for</div>
          <div style={{ fontSize: 13, marginTop: 3 }}>{visit.requirements}</div>
        </Card>
      )}
    </Drawer>
  );
}
