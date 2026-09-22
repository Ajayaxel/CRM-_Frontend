'use client';

/**
 * Add-on services — printing, lockers, parking, mail handling, extra hours.
 *
 * `availableOn` decides where each one may be attached, so the booking form
 * offers the coffee and the membership form offers the mail handling, rather
 * than both offering everything.
 */

import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { Package, Plus, Trash2 } from 'lucide-react';
import { api, apiErrorMessage } from '@/lib/api';
import { Badge, Card, DataTable, Drawer, EmptyState, Field, FormSection, humanStatus, type DataTableColumn } from '../ui/kit';
import { SERVICE_UNITS } from '../ui/tone';
import { PageHead, Pagination, SearchBox, StatusSelect, money, useListState } from '../ui/common';

interface ServiceRow {
  id: string; name: string; code: string; category?: string | null; description?: string | null;
  priceInr: number; unit: string; taxPct: number; availableOn: string[]; status: string;
}

const SCOPES = ['BOOKING', 'MEMBERSHIP', 'CUSTOMER', 'INVOICE'];
const empty = {
  name: '', code: '', category: '', description: '', priceInr: '0', unit: 'FLAT', taxPct: '5',
  availableOn: SCOPES, status: 'ACTIVE',
};

export function CoworkingServices() {
  const qc = useQueryClient();
  const { state, set, params } = useListState();
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<ServiceRow | null>(null);
  const [form, setForm] = useState(empty);

  const { data, isLoading } = useQuery({
    queryKey: ['cw-services', params],
    queryFn: async () => (await api.get<{ data: ServiceRow[]; meta: { page: number; limit: number; total: number; totalPages: number } }>('/coworking/services', { params })).data,
  });

  const openEditor = (row?: ServiceRow) => {
    if (row) {
      setEditing(row);
      setForm({
        name: row.name, code: row.code, category: row.category ?? '', description: row.description ?? '',
        priceInr: String(row.priceInr), unit: row.unit, taxPct: String(row.taxPct),
        availableOn: row.availableOn, status: row.status,
      });
    } else { setEditing(null); setForm(empty); }
    setOpen(true);
  };

  const save = useMutation({
    mutationFn: () => {
      const body = {
        name: form.name.trim(), code: form.code.trim() || undefined,
        category: form.category.trim() || undefined,
        description: form.description.trim() || undefined,
        priceInr: Number(form.priceInr) || 0, unit: form.unit,
        taxPct: Number(form.taxPct) || 0, availableOn: form.availableOn, status: form.status,
      };
      return editing ? api.patch(`/coworking/services/${editing.id}`, body) : api.post('/coworking/services', body);
    },
    onSuccess: () => { toast.success('Saved'); setOpen(false); qc.invalidateQueries({ queryKey: ['cw-services'] }); },
    onError: (e) => toast.error(apiErrorMessage(e)),
  });

  const remove = useMutation({
    mutationFn: (id: string) => api.delete(`/coworking/services/${id}`),
    onSuccess: () => { toast.success('Removed'); qc.invalidateQueries({ queryKey: ['cw-services'] }); },
    onError: (e) => toast.error(apiErrorMessage(e)),
  });

  const columns: DataTableColumn<ServiceRow>[] = [
    {
      key: 'name', header: 'Service', sortable: true,
      render: (r) => (
        <span>
          <span style={{ display: 'block', fontWeight: 600 }}>{r.name}</span>
          <span className="ds-caption">{r.code}{r.category ? ` · ${r.category}` : ''}</span>
        </span>
      ),
    },
    { key: 'priceInr', header: 'Price', align: 'right', sortable: true, render: (r) => money(r.priceInr) },
    { key: 'unit', header: 'Per', render: (r) => humanStatus(r.unit) },
    { key: 'taxPct', header: 'Tax', align: 'right', render: (r) => `${r.taxPct}%` },
    { key: 'availableOn', header: 'Offered on', render: (r) => r.availableOn.map((a) => humanStatus(a)).join(', ') },
    { key: 'status', header: 'Status', render: (r) => <Badge tone={r.status === 'ACTIVE' ? 'active' : 'neutral'}>{humanStatus(r.status)}</Badge> },
    {
      key: 'actions', header: '', width: 120,
      render: (r) => (
        <div style={{ display: 'flex', gap: 4 }} onClick={(e) => e.stopPropagation()}>
          <button className="btn-ghost btn-sm" onClick={() => openEditor(r)}>Edit</button>
          <button className="btn-ghost btn-sm" onClick={() => remove.mutate(r.id)} aria-label="Remove"><Trash2 size={13} /></button>
        </div>
      ),
    },
  ];

  return (
    <div className="ds-page">
      <PageHead
        title="Services"
        subtitle="Add-ons you sell on bookings, memberships and invoices."
        actions={<button className="btn-primary" onClick={() => openEditor()}><Plus size={14} style={{ marginRight: 6 }} />New service</button>}
      />

      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 14 }}>
        <SearchBox value={state.search} onChange={(v) => set({ search: v })} placeholder="Search services…" />
        <StatusSelect value={state.status} onChange={(v) => set({ status: v })} options={['ACTIVE', 'INACTIVE']} />
      </div>

      <Card flush>
        <DataTable
          rows={data?.data ?? []}
          columns={columns}
          rowKey={(r) => r.id}
          loading={isLoading}
          empty={<EmptyState compact icon={Package} title="No services yet" body="Printing, lockers, parking, mail handling, refreshments." actionLabel="New service" onAction={() => openEditor()} />}
        />
      </Card>
      <Pagination meta={data?.meta} onPage={(p) => set({ page: p })} />

      <Drawer
        open={open} onClose={() => setOpen(false)} title={editing ? `Edit ${editing.name}` : 'New service'} width={520}
        actions={<button className="btn-primary btn-sm" disabled={!form.name.trim() || save.isPending} onClick={() => save.mutate()}>Save</button>}
      >
        <FormSection title="Service">
          <Field label="Name" required span={2}><input className="input" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="Colour printing" /></Field>
          <Field label="Code"><input className="input" value={form.code} onChange={(e) => setForm({ ...form, code: e.target.value })} /></Field>
          <Field label="Category"><input className="input" value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value })} placeholder="Business services" /></Field>
          <Field label="Description" span={2}><input className="input" value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} /></Field>
        </FormSection>
        <FormSection title="Price">
          <Field label="Price"><input className="input" type="number" min={0} value={form.priceInr} onChange={(e) => setForm({ ...form, priceInr: e.target.value })} /></Field>
          <Field label="Charged per">
            <select className="input" value={form.unit} onChange={(e) => setForm({ ...form, unit: e.target.value })}>
              {SERVICE_UNITS.map((u) => <option key={u} value={u}>{humanStatus(u)}</option>)}
            </select>
          </Field>
          <Field label="Tax %"><input className="input" type="number" min={0} max={100} value={form.taxPct} onChange={(e) => setForm({ ...form, taxPct: e.target.value })} /></Field>
          <Field label="Status">
            <select className="input" value={form.status} onChange={(e) => setForm({ ...form, status: e.target.value })}>
              <option value="ACTIVE">Active</option>
              <option value="INACTIVE">Inactive</option>
            </select>
          </Field>
        </FormSection>
        <FormSection title="Where it can be added">
          <div style={{ gridColumn: '1 / -1', display: 'flex', gap: 14, flexWrap: 'wrap' }}>
            {SCOPES.map((s) => (
              <label key={s} style={{ display: 'flex', gap: 7, alignItems: 'center', fontSize: 13 }}>
                <input
                  type="checkbox" checked={form.availableOn.includes(s)}
                  onChange={(e) => setForm({
                    ...form,
                    availableOn: e.target.checked ? [...form.availableOn, s] : form.availableOn.filter((x) => x !== s),
                  })}
                />
                {humanStatus(s)}
              </label>
            ))}
          </div>
        </FormSection>
      </Drawer>
    </div>
  );
}
