'use client';

/**
 * Space inventory — the master data the whole vertical reads.
 *
 * One screen covers buildings, floors, the spaces on them, their media, their
 * rules and their maintenance blocks, because they are one job: setting up what
 * you sell. Splitting them across five pages meant a new site took five visits.
 */

import { useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { Building2, Image as ImageIcon, Layers, Plus, Trash2, Wrench } from 'lucide-react';
import { api, apiErrorMessage } from '@/lib/api';
import {
  Badge, Card, DataTable, Drawer, EmptyState, Field, FormSection, Modal,
  Segmented, humanStatus, type DataTableColumn,
} from '../ui/kit';
import {
  COMMON_AMENITIES, SPACE_STATUSES, SPACE_TYPES, spaceTypeLabel, toneForSpaceStatus,
} from '../ui/tone';
import {
  DateRange, PageHead, Pagination, SearchBox, StatusSelect, fmtDateTime, money,
  toLocalInput, useListState,
} from '../ui/common';
import { SpaceDetailBody } from '../ui/space-detail';

interface SpaceRow {
  id: string; name: string; code: string; type: string; customType?: string | null;
  capacity: number; units: number; status: string; zone?: string | null;
  hourlyInr?: number | null; dailyInr?: number | null; monthlyInr?: number | null;
  depositInr: number; taxPct: number; amenities: string[]; coverUrl?: string | null;
  isActive: boolean;
  floor?: { id: string; name: string; level: number } | null;
  building?: { id: string; name: string } | null;
  _count: { bookings: number; memberships: number };
}
interface BuildingRow {
  id: string; name: string; code: string; city?: string | null; isActive: boolean;
  floors: { id: string; name: string; level: number; planImageUrl?: string | null; isActive: boolean }[];
  _count: { spaces: number };
}

const emptySpace = {
  name: '', code: '', type: 'HOT_DESK', customType: '', buildingId: '', floorId: '', zone: '',
  capacity: '1', units: '1', description: '', status: 'AVAILABLE',
  hourlyInr: '', halfDayInr: '', dailyInr: '', weeklyInr: '', monthlyInr: '',
  depositInr: '0', setupFeeInr: '0', taxPct: '5',
  minMinutes: '30', incrementMinutes: '30', bufferMinutes: '0', noticeHours: '0',
  cancellationHours: '24', cancellationPenaltyPct: '0', requiresApproval: false, membersOnly: false,
  openFrom: '09:00', openTo: '18:00', closedDays: [] as number[],
};

type SpaceForm = typeof emptySpace;

const DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

export function CoworkingSpaces() {
  const qc = useQueryClient();
  const { state, set, params } = useListState({ sort: 'name', dir: 'asc' });
  const [tab, setTab] = useState<'Spaces' | 'Buildings'>('Spaces');
  const [editing, setEditing] = useState<SpaceRow | null>(null);
  const [form, setForm] = useState<SpaceForm>(emptySpace);
  const [editorOpen, setEditorOpen] = useState(false);
  const [amenities, setAmenities] = useState<string[]>([]);
  const [amenityDraft, setAmenityDraft] = useState('');
  const [previewId, setPreviewId] = useState<string | null>(null);
  const [mediaFor, setMediaFor] = useState<SpaceRow | null>(null);
  const [blockFor, setBlockFor] = useState<SpaceRow | null>(null);

  const { data, isLoading } = useQuery({
    queryKey: ['cw-spaces', params],
    queryFn: async () => (await api.get<{ data: SpaceRow[]; meta: { page: number; limit: number; total: number; totalPages: number } }>('/coworking/spaces', { params })).data,
  });

  const { data: buildings } = useQuery({
    queryKey: ['cw-buildings'],
    queryFn: async () => (await api.get<BuildingRow[]>('/coworking/buildings')).data,
  });

  const floorOptions = useMemo(() => {
    const b = buildings?.find((x) => x.id === form.buildingId);
    return b?.floors ?? buildings?.flatMap((x) => x.floors) ?? [];
  }, [buildings, form.buildingId]);

  const openEditor = (row?: SpaceRow) => {
    if (row) {
      setEditing(row);
      setForm({
        ...emptySpace,
        name: row.name, code: row.code, type: row.type, customType: row.customType ?? '',
        buildingId: row.building?.id ?? '', floorId: row.floor?.id ?? '', zone: row.zone ?? '',
        capacity: String(row.capacity), units: String(row.units), status: row.status,
        hourlyInr: row.hourlyInr?.toString() ?? '', dailyInr: row.dailyInr?.toString() ?? '',
        monthlyInr: row.monthlyInr?.toString() ?? '', depositInr: String(row.depositInr),
        taxPct: String(row.taxPct),
      });
      setAmenities(row.amenities ?? []);
    } else {
      setEditing(null);
      setForm(emptySpace);
      setAmenities([]);
    }
    setEditorOpen(true);
  };

  const payload = () => {
    const num = (v: string) => (v === '' ? null : Number(v));
    const availability: Record<string, [string, string][]> = {};
    for (let d = 0; d < 7; d += 1) {
      availability[String(d)] = form.closedDays.includes(d) ? [] : [[form.openFrom, form.openTo]];
    }
    return {
      name: form.name.trim(),
      code: form.code.trim() || undefined,
      type: form.type,
      customType: form.type === 'CUSTOM' ? form.customType.trim() : undefined,
      buildingId: form.buildingId || undefined,
      floorId: form.floorId || undefined,
      zone: form.zone.trim() || undefined,
      capacity: Number(form.capacity) || 1,
      units: Number(form.units) || 1,
      description: form.description.trim() || undefined,
      status: form.status,
      hourlyInr: num(form.hourlyInr), halfDayInr: num(form.halfDayInr), dailyInr: num(form.dailyInr),
      weeklyInr: num(form.weeklyInr), monthlyInr: num(form.monthlyInr),
      depositInr: Number(form.depositInr) || 0,
      setupFeeInr: Number(form.setupFeeInr) || 0,
      taxPct: Number(form.taxPct) || 0,
      amenities,
      bookingRules: {
        minMinutes: Number(form.minMinutes) || 30,
        incrementMinutes: Number(form.incrementMinutes) || 30,
        bufferMinutes: Number(form.bufferMinutes) || 0,
        noticeHours: Number(form.noticeHours) || 0,
        cancellationHours: Number(form.cancellationHours) || 0,
        cancellationPenaltyPct: Number(form.cancellationPenaltyPct) || 0,
        requiresApproval: form.requiresApproval,
        membersOnly: form.membersOnly,
      },
      availability,
    };
  };

  const save = useMutation({
    mutationFn: () => (editing ? api.patch(`/coworking/spaces/${editing.id}`, payload()) : api.post('/coworking/spaces', payload())),
    onSuccess: () => {
      toast.success(editing ? 'Space updated' : 'Space added');
      setEditorOpen(false);
      qc.invalidateQueries({ queryKey: ['cw-spaces'] });
      qc.invalidateQueries({ queryKey: ['cw-floor-plan'] });
    },
    onError: (e) => toast.error(apiErrorMessage(e)),
  });

  const remove = useMutation({
    mutationFn: (id: string) => api.delete(`/coworking/spaces/${id}`),
    onSuccess: (res) => {
      const body = res.data as { retired?: boolean; message?: string };
      toast.success(body.message ?? (body.retired ? 'Space retired' : 'Space deleted'));
      qc.invalidateQueries({ queryKey: ['cw-spaces'] });
    },
    onError: (e) => toast.error(apiErrorMessage(e)),
  });

  const columns: DataTableColumn<SpaceRow>[] = [
    {
      key: 'name', header: 'Space', sortable: true,
      render: (r) => (
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, minWidth: 0 }}>
          <span style={{ width: 34, height: 26, borderRadius: 5, overflow: 'hidden', flex: 'none', background: 'var(--surface-2)' }}>
            {r.coverUrl && (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={r.coverUrl} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }} />
            )}
          </span>
          <span style={{ minWidth: 0 }}>
            <span style={{ display: 'block', fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{r.name}</span>
            <span className="ds-caption">{r.code} · {spaceTypeLabel(r.type, r.customType)}</span>
          </span>
        </div>
      ),
    },
    { key: 'location', header: 'Where', render: (r) => r.floor ? `${r.building?.name ?? ''} ${r.floor.name}${r.zone ? ` · ${r.zone}` : ''}`.trim() : '—' },
    { key: 'capacity', header: 'Seats', align: 'right', sortable: true, render: (r) => r.units > 1 ? `${r.capacity} × ${r.units}` : r.capacity },
    { key: 'hourlyInr', header: 'Hourly', align: 'right', sortable: true, render: (r) => r.hourlyInr != null ? money(r.hourlyInr) : '—' },
    { key: 'monthlyInr', header: 'Monthly', align: 'right', sortable: true, render: (r) => r.monthlyInr != null ? money(r.monthlyInr) : '—' },
    { key: 'status', header: 'Status', sortable: true, render: (r) => <Badge tone={toneForSpaceStatus(r.status)}>{humanStatus(r.status)}</Badge> },
    {
      key: 'actions', header: '', width: 190,
      render: (r) => (
        <div style={{ display: 'flex', gap: 4 }} onClick={(e) => e.stopPropagation()}>
          <button className="btn-ghost btn-sm" onClick={() => setMediaFor(r)} title="Photographs and video"><ImageIcon size={13} /></button>
          <button className="btn-ghost btn-sm" onClick={() => setBlockFor(r)} title="Block for maintenance"><Wrench size={13} /></button>
          <button className="btn-ghost btn-sm" onClick={() => openEditor(r)}>Edit</button>
          <button
            className="btn-ghost btn-sm"
            onClick={() => { if (window.confirm(`Remove ${r.name}?`)) remove.mutate(r.id); }}
            title="Delete"
          ><Trash2 size={13} /></button>
        </div>
      ),
    },
  ];

  return (
    <div className="ds-page">
      <PageHead
        title="Spaces"
        subtitle="Everything you sell, and where it sits."
        actions={
          <>
            <Segmented options={['Spaces', 'Buildings']} value={tab} onChange={(v) => setTab(v as 'Spaces' | 'Buildings')} />
            {tab === 'Spaces' && <button className="btn-primary" onClick={() => openEditor()}><Plus size={14} style={{ marginRight: 6 }} />Add space</button>}
          </>
        }
      />

      {tab === 'Buildings' ? (
        <BuildingsPanel buildings={buildings} />
      ) : (
        <>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center', marginBottom: 14 }}>
            <SearchBox value={state.search} onChange={(v) => set({ search: v })} placeholder="Search spaces…" />
            <StatusSelect value={state.status} onChange={(v) => set({ status: v })} options={SPACE_STATUSES} />
            <DateRange from={state.from} to={state.to} onChange={(p) => set(p)} />
          </div>

          <Card flush>
            <DataTable
              rows={data?.data ?? []}
              columns={columns}
              rowKey={(r) => r.id}
              loading={isLoading}
              onRowClick={(r) => setPreviewId(r.id)}
              empty={<EmptyState compact icon={Layers} title="No spaces yet" body="Add your first desk, office or meeting room." actionLabel="Add space" onAction={() => openEditor()} />}
            />
          </Card>
          <Pagination meta={data?.meta} onPage={(p) => set({ page: p })} />
        </>
      )}

      {/* ── Space editor ───────────────────────────────────────────── */}
      <Drawer
        open={editorOpen}
        onClose={() => setEditorOpen(false)}
        title={editing ? `Edit ${editing.name}` : 'Add a space'}
        width={620}
        actions={
          <button className="btn-primary btn-sm" disabled={!form.name.trim() || save.isPending} onClick={() => save.mutate()}>
            {save.isPending ? 'Saving…' : 'Save'}
          </button>
        }
      >
        <FormSection title="Identity">
          <Field label="Name" required span={2}>
            <input className="input" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="Meeting Room 2" />
          </Field>
          <Field label="Code" hint="Left blank, one is derived from the name.">
            <input className="input" value={form.code} onChange={(e) => setForm({ ...form, code: e.target.value })} />
          </Field>
          <Field label="Type">
            <select className="input" value={form.type} onChange={(e) => setForm({ ...form, type: e.target.value })}>
              {SPACE_TYPES.map((t) => <option key={t} value={t}>{spaceTypeLabel(t)}</option>)}
            </select>
          </Field>
          {form.type === 'CUSTOM' && (
            <Field label="Call it" required>
              <input className="input" value={form.customType} onChange={(e) => setForm({ ...form, customType: e.target.value })} placeholder="Podcast studio" />
            </Field>
          )}
          <Field label="Status">
            <select className="input" value={form.status} onChange={(e) => setForm({ ...form, status: e.target.value })}>
              {SPACE_STATUSES.map((s) => <option key={s} value={s}>{humanStatus(s)}</option>)}
            </select>
          </Field>
        </FormSection>

        <FormSection title="Where it is">
          <Field label="Building">
            <select className="input" value={form.buildingId} onChange={(e) => setForm({ ...form, buildingId: e.target.value, floorId: '' })}>
              <option value="">—</option>
              {(buildings ?? []).map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}
            </select>
          </Field>
          <Field label="Floor">
            <select className="input" value={form.floorId} onChange={(e) => setForm({ ...form, floorId: e.target.value })}>
              <option value="">—</option>
              {floorOptions.map((f) => <option key={f.id} value={f.id}>{f.name}</option>)}
            </select>
          </Field>
          <Field label="Zone"><input className="input" value={form.zone} onChange={(e) => setForm({ ...form, zone: e.target.value })} placeholder="North wing" /></Field>
          <Field label="Seats"><input className="input" type="number" min={1} value={form.capacity} onChange={(e) => setForm({ ...form, capacity: e.target.value })} /></Field>
          <Field label="Bookable units" hint="Six hot desks under one record.">
            <input className="input" type="number" min={1} value={form.units} onChange={(e) => setForm({ ...form, units: e.target.value })} />
          </Field>
          <Field label="Description" span={2}>
            <textarea className="input" rows={3} value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} />
          </Field>
        </FormSection>

        <FormSection title="Pricing" description="Leave a tier blank if you do not sell the space that way — the booking form disables it rather than offering it free.">
          <Field label="Hourly"><input className="input" type="number" min={0} value={form.hourlyInr} onChange={(e) => setForm({ ...form, hourlyInr: e.target.value })} /></Field>
          <Field label="Half day"><input className="input" type="number" min={0} value={form.halfDayInr} onChange={(e) => setForm({ ...form, halfDayInr: e.target.value })} /></Field>
          <Field label="Full day"><input className="input" type="number" min={0} value={form.dailyInr} onChange={(e) => setForm({ ...form, dailyInr: e.target.value })} /></Field>
          <Field label="Weekly"><input className="input" type="number" min={0} value={form.weeklyInr} onChange={(e) => setForm({ ...form, weeklyInr: e.target.value })} /></Field>
          <Field label="Monthly"><input className="input" type="number" min={0} value={form.monthlyInr} onChange={(e) => setForm({ ...form, monthlyInr: e.target.value })} /></Field>
          <Field label="Deposit"><input className="input" type="number" min={0} value={form.depositInr} onChange={(e) => setForm({ ...form, depositInr: e.target.value })} /></Field>
          <Field label="Set-up fee"><input className="input" type="number" min={0} value={form.setupFeeInr} onChange={(e) => setForm({ ...form, setupFeeInr: e.target.value })} /></Field>
          <Field label="Tax %"><input className="input" type="number" min={0} max={100} value={form.taxPct} onChange={(e) => setForm({ ...form, taxPct: e.target.value })} /></Field>
        </FormSection>

        <FormSection title="Amenities">
          <div style={{ gridColumn: '1 / -1' }}>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: 10 }}>
              {COMMON_AMENITIES.map((a) => {
                const on = amenities.includes(a);
                return (
                  <button
                    key={a} type="button" aria-pressed={on}
                    className={`ds-badge ${on ? 'ds-tone-info' : 'ds-tone-neutral'}`}
                    style={{ font: 'inherit', cursor: 'pointer', padding: '5px 10px' }}
                    onClick={() => setAmenities((list) => on ? list.filter((x) => x !== a) : [...list, a])}
                  >{a}</button>
                );
              })}
            </div>
            <div style={{ display: 'flex', gap: 8 }}>
              <input
                className="input" value={amenityDraft} placeholder="Something else…"
                onChange={(e) => setAmenityDraft(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && amenityDraft.trim()) {
                    e.preventDefault();
                    setAmenities((l) => [...new Set([...l, amenityDraft.trim()])]);
                    setAmenityDraft('');
                  }
                }}
              />
              <button
                className="btn-ghost btn-sm" type="button"
                onClick={() => { if (amenityDraft.trim()) { setAmenities((l) => [...new Set([...l, amenityDraft.trim()])]); setAmenityDraft(''); } }}
              >Add</button>
            </div>
            {amenities.filter((a) => !COMMON_AMENITIES.includes(a as never)).length > 0 && (
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginTop: 10 }}>
                {amenities.filter((a) => !COMMON_AMENITIES.includes(a as never)).map((a) => (
                  <button key={a} type="button" className="ds-badge ds-tone-info" style={{ font: 'inherit', cursor: 'pointer' }}
                    onClick={() => setAmenities((l) => l.filter((x) => x !== a))}>{a} ×</button>
                ))}
              </div>
            )}
          </div>
        </FormSection>

        <FormSection title="Booking rules" description="The availability engine enforces these — it refuses a request that breaks one rather than rounding it into shape.">
          <Field label="Minimum minutes"><input className="input" type="number" min={5} value={form.minMinutes} onChange={(e) => setForm({ ...form, minMinutes: e.target.value })} /></Field>
          <Field label="Increment minutes"><input className="input" type="number" min={5} value={form.incrementMinutes} onChange={(e) => setForm({ ...form, incrementMinutes: e.target.value })} /></Field>
          <Field label="Buffer minutes" hint="Dead time either side of a booking."><input className="input" type="number" min={0} value={form.bufferMinutes} onChange={(e) => setForm({ ...form, bufferMinutes: e.target.value })} /></Field>
          <Field label="Notice hours"><input className="input" type="number" min={0} value={form.noticeHours} onChange={(e) => setForm({ ...form, noticeHours: e.target.value })} /></Field>
          <Field label="Free cancellation (hours)"><input className="input" type="number" min={0} value={form.cancellationHours} onChange={(e) => setForm({ ...form, cancellationHours: e.target.value })} /></Field>
          <Field label="Late cancellation penalty %"><input className="input" type="number" min={0} max={100} value={form.cancellationPenaltyPct} onChange={(e) => setForm({ ...form, cancellationPenaltyPct: e.target.value })} /></Field>
          <div style={{ gridColumn: '1 / -1', display: 'flex', gap: 18, flexWrap: 'wrap' }}>
            <label style={{ display: 'flex', gap: 8, alignItems: 'center', fontSize: 13 }}>
              <input type="checkbox" checked={form.requiresApproval} onChange={(e) => setForm({ ...form, requiresApproval: e.target.checked })} />
              Bookings need approval
            </label>
            <label style={{ display: 'flex', gap: 8, alignItems: 'center', fontSize: 13 }}>
              <input type="checkbox" checked={form.membersOnly} onChange={(e) => setForm({ ...form, membersOnly: e.target.checked })} />
              Members only
            </label>
          </div>
        </FormSection>

        <FormSection title="Opening hours">
          <Field label="Opens"><input className="input" type="time" value={form.openFrom} onChange={(e) => setForm({ ...form, openFrom: e.target.value })} /></Field>
          <Field label="Closes"><input className="input" type="time" value={form.openTo} onChange={(e) => setForm({ ...form, openTo: e.target.value })} /></Field>
          <div style={{ gridColumn: '1 / -1' }}>
            <div className="label">Closed on</div>
            <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
              {DAYS.map((d, i) => {
                const off = form.closedDays.includes(i);
                return (
                  <button
                    key={d} type="button" aria-pressed={off}
                    className={`ds-badge ${off ? 'ds-tone-expired' : 'ds-tone-neutral'}`}
                    style={{ font: 'inherit', cursor: 'pointer', padding: '5px 10px' }}
                    onClick={() => setForm({
                      ...form,
                      closedDays: off ? form.closedDays.filter((x) => x !== i) : [...form.closedDays, i],
                    })}
                  >{d}</button>
                );
              })}
            </div>
          </div>
        </FormSection>
      </Drawer>

      <Modal open={!!previewId} onClose={() => setPreviewId(null)} title="Space" width={1040}>
        {previewId && <SpaceDetailBody spaceId={previewId} />}
      </Modal>

      {mediaFor && <MediaManager space={mediaFor} onClose={() => setMediaFor(null)} />}
      {blockFor && <BlockManager space={blockFor} onClose={() => setBlockFor(null)} />}
    </div>
  );
}

/* ─────────────────────────────────────────────────── buildings & floors */

function BuildingsPanel({ buildings }: { buildings?: BuildingRow[] }) {
  const qc = useQueryClient();
  const [bForm, setBForm] = useState({ name: '', code: '', city: '' });
  const [fForm, setFForm] = useState({ buildingId: '', name: '', level: '0', planImageUrl: '', planWidth: '1200', planHeight: '800' });

  const addBuilding = useMutation({
    mutationFn: () => api.post('/coworking/buildings', { name: bForm.name.trim(), code: bForm.code.trim() || undefined, city: bForm.city.trim() || undefined }),
    onSuccess: () => { toast.success('Building added'); setBForm({ name: '', code: '', city: '' }); qc.invalidateQueries({ queryKey: ['cw-buildings'] }); },
    onError: (e) => toast.error(apiErrorMessage(e)),
  });

  const addFloor = useMutation({
    mutationFn: () => api.post('/coworking/floors', {
      buildingId: fForm.buildingId || undefined,
      name: fForm.name.trim(),
      level: Number(fForm.level) || 0,
      planImageUrl: fForm.planImageUrl.trim() || undefined,
      planWidth: Number(fForm.planWidth) || 1200,
      planHeight: Number(fForm.planHeight) || 800,
    }),
    onSuccess: () => {
      toast.success('Floor added');
      setFForm({ ...fForm, name: '', planImageUrl: '' });
      qc.invalidateQueries({ queryKey: ['cw-buildings'] });
      qc.invalidateQueries({ queryKey: ['cw-floors'] });
    },
    onError: (e) => toast.error(apiErrorMessage(e)),
  });

  return (
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(300px,1fr))', gap: 18 }}>
      <Card pad={18}>
        <h3 className="ds-h3" style={{ marginBottom: 12 }}>Buildings</h3>
        {!buildings?.length ? (
          <EmptyState compact icon={Building2} title="No buildings yet" body="Add the site you operate." />
        ) : (
          <div style={{ display: 'grid', gap: 10, marginBottom: 16 }}>
            {buildings.map((b) => (
              <div key={b.id} className="ds-list-row">
                <div style={{ minWidth: 0 }}>
                  <div style={{ fontWeight: 600, fontSize: 13.5 }}>{b.name}</div>
                  <div className="ds-caption">{b.code}{b.city ? ` · ${b.city}` : ''} · {b.floors.length} floor(s) · {b._count.spaces} space(s)</div>
                </div>
              </div>
            ))}
          </div>
        )}
        <div style={{ display: 'grid', gap: 10 }}>
          <input className="input" placeholder="Building name" value={bForm.name} onChange={(e) => setBForm({ ...bForm, name: e.target.value })} />
          <div style={{ display: 'flex', gap: 8 }}>
            <input className="input" placeholder="Code" value={bForm.code} onChange={(e) => setBForm({ ...bForm, code: e.target.value })} />
            <input className="input" placeholder="City" value={bForm.city} onChange={(e) => setBForm({ ...bForm, city: e.target.value })} />
          </div>
          <button className="btn-primary btn-sm" disabled={!bForm.name.trim() || addBuilding.isPending} onClick={() => addBuilding.mutate()}>Add building</button>
        </div>
      </Card>

      <Card pad={18}>
        <h3 className="ds-h3" style={{ marginBottom: 12 }}>Floors</h3>
        <p className="ds-caption" style={{ marginBottom: 12 }}>
          The plan image is the background the explorer draws hotspots on. Give its natural pixel size so the
          rectangles stay over the rooms they mark at any screen width.
        </p>
        <div style={{ display: 'grid', gap: 10 }}>
          <select className="input" value={fForm.buildingId} onChange={(e) => setFForm({ ...fForm, buildingId: e.target.value })}>
            <option value="">First building</option>
            {(buildings ?? []).map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}
          </select>
          <div style={{ display: 'flex', gap: 8 }}>
            <input className="input" placeholder="Floor name" value={fForm.name} onChange={(e) => setFForm({ ...fForm, name: e.target.value })} />
            <input className="input" style={{ maxWidth: 90 }} type="number" placeholder="Level" value={fForm.level} onChange={(e) => setFForm({ ...fForm, level: e.target.value })} />
          </div>
          <input className="input" placeholder="Plan image URL" value={fForm.planImageUrl} onChange={(e) => setFForm({ ...fForm, planImageUrl: e.target.value })} />
          <div style={{ display: 'flex', gap: 8 }}>
            <input className="input" type="number" placeholder="Width" value={fForm.planWidth} onChange={(e) => setFForm({ ...fForm, planWidth: e.target.value })} />
            <input className="input" type="number" placeholder="Height" value={fForm.planHeight} onChange={(e) => setFForm({ ...fForm, planHeight: e.target.value })} />
          </div>
          <button className="btn-primary btn-sm" disabled={!fForm.name.trim() || !buildings?.length || addFloor.isPending} onClick={() => addFloor.mutate()}>Add floor</button>
          {!buildings?.length && <div className="ds-caption">Add a building first.</div>}
        </div>
      </Card>
    </div>
  );
}

/* ─────────────────────────────────────────────────────────── media */

function MediaManager({ space, onClose }: { space: SpaceRow; onClose: () => void }) {
  const qc = useQueryClient();
  const [form, setForm] = useState({ kind: 'IMAGE', url: '', caption: '', posterUrl: '' });

  const { data } = useQuery({
    queryKey: ['cw-space', space.id],
    queryFn: async () => (await api.get<{ media: { id: string; kind: string; url: string; caption?: string | null; isCover: boolean }[] }>(`/coworking/spaces/${space.id}`)).data,
  });

  const add = useMutation({
    mutationFn: () => api.post(`/coworking/spaces/${space.id}/media`, {
      kind: form.kind, url: form.url.trim(),
      caption: form.caption.trim() || undefined,
      posterUrl: form.posterUrl.trim() || undefined,
    }),
    onSuccess: () => {
      toast.success('Added');
      setForm({ ...form, url: '', caption: '', posterUrl: '' });
      qc.invalidateQueries({ queryKey: ['cw-space', space.id] });
      qc.invalidateQueries({ queryKey: ['cw-spaces'] });
    },
    onError: (e) => toast.error(apiErrorMessage(e)),
  });

  const setCover = useMutation({
    mutationFn: (id: string) => api.patch(`/coworking/media/${id}/cover`, {}),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['cw-space', space.id] }); qc.invalidateQueries({ queryKey: ['cw-spaces'] }); },
    onError: (e) => toast.error(apiErrorMessage(e)),
  });

  const remove = useMutation({
    mutationFn: (id: string) => api.delete(`/coworking/media/${id}`),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['cw-space', space.id] }); qc.invalidateQueries({ queryKey: ['cw-spaces'] }); },
    onError: (e) => toast.error(apiErrorMessage(e)),
  });

  return (
    <Drawer open onClose={onClose} title={`${space.name} — media`} subtitle="Photographs, video and the walkthrough" width={520}>
      <div style={{ display: 'grid', gap: 10, marginBottom: 20 }}>
        {(data?.media ?? []).map((m) => (
          <div key={m.id} className="ds-list-row" style={{ gap: 10 }}>
            <span style={{ width: 52, height: 38, borderRadius: 5, overflow: 'hidden', flex: 'none', background: 'var(--surface-2)' }}>
              {m.kind === 'IMAGE' ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={m.url} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }} />
              ) : (
                <span style={{ display: 'flex', width: '100%', height: '100%', alignItems: 'center', justifyContent: 'center', fontSize: 10, color: 'var(--ink-3)' }}>Video</span>
              )}
            </span>
            <div style={{ minWidth: 0, flex: 1 }}>
              <div style={{ fontSize: 12.5, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{m.caption || m.url}</div>
              <div className="ds-caption">{humanStatus(m.kind)}{m.isCover ? ' · cover' : ''}</div>
            </div>
            {!m.isCover && m.kind === 'IMAGE' && (
              <button className="btn-ghost btn-sm" onClick={() => setCover.mutate(m.id)}>Cover</button>
            )}
            <button className="btn-ghost btn-sm" onClick={() => remove.mutate(m.id)} aria-label="Remove"><Trash2 size={13} /></button>
          </div>
        ))}
        {!data?.media.length && <div className="ds-caption">Nothing yet. A space with no photograph shows a grey card on the explorer.</div>}
      </div>

      <FormSection title="Add media" description="Paste a URL — anything the browser can render. Videos take a poster image so the tile is not blank before it plays.">
        <Field label="Kind">
          <select className="input" value={form.kind} onChange={(e) => setForm({ ...form, kind: e.target.value })}>
            <option value="IMAGE">Photograph</option>
            <option value="WALKTHROUGH">Walkthrough</option>
            <option value="VIDEO">Video</option>
            <option value="FLOOR_PLAN">Floor plan</option>
          </select>
        </Field>
        <Field label="URL" required span={2}><input className="input" value={form.url} onChange={(e) => setForm({ ...form, url: e.target.value })} /></Field>
        <Field label="Caption"><input className="input" value={form.caption} onChange={(e) => setForm({ ...form, caption: e.target.value })} /></Field>
        {form.kind !== 'IMAGE' && (
          <Field label="Poster image URL"><input className="input" value={form.posterUrl} onChange={(e) => setForm({ ...form, posterUrl: e.target.value })} /></Field>
        )}
        <div style={{ gridColumn: '1 / -1' }}>
          <button className="btn-primary btn-sm" disabled={!form.url.trim() || add.isPending} onClick={() => add.mutate()}>Add</button>
        </div>
      </FormSection>
    </Drawer>
  );
}

/* ──────────────────────────────────────────────────────────── blocks */

function BlockManager({ space, onClose }: { space: SpaceRow; onClose: () => void }) {
  const qc = useQueryClient();
  const [form, setForm] = useState({
    kind: 'MAINTENANCE',
    startAt: toLocalInput(new Date()),
    endAt: toLocalInput(new Date(Date.now() + 3600_000 * 4)),
    reason: '',
  });

  const { data } = useQuery({
    queryKey: ['cw-blocks', space.id],
    queryFn: async () => (await api.get<{ id: string; kind: string; startAt: string; endAt: string; reason?: string | null }[]>('/coworking/blocks', { params: { spaceId: space.id } })).data,
  });

  const add = useMutation({
    mutationFn: () => api.post(`/coworking/spaces/${space.id}/blocks`, {
      kind: form.kind,
      startAt: new Date(form.startAt).toISOString(),
      endAt: new Date(form.endAt).toISOString(),
      reason: form.reason.trim() || undefined,
    }),
    onSuccess: () => {
      toast.success('Blocked');
      qc.invalidateQueries({ queryKey: ['cw-blocks', space.id] });
      qc.invalidateQueries({ queryKey: ['cw-spaces'] });
      qc.invalidateQueries({ queryKey: ['cw-floor-plan'] });
    },
    onError: (e) => toast.error(apiErrorMessage(e)),
  });

  const remove = useMutation({
    mutationFn: (id: string) => api.delete(`/coworking/blocks/${id}`),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['cw-blocks', space.id] });
      qc.invalidateQueries({ queryKey: ['cw-spaces'] });
    },
    onError: (e) => toast.error(apiErrorMessage(e)),
  });

  return (
    <Drawer open onClose={onClose} title={`${space.name} — blocks`} subtitle="Maintenance, holidays and deliberate closures" width={520}>
      <div style={{ display: 'grid', gap: 10, marginBottom: 20 }}>
        {(data ?? []).map((b) => (
          <div key={b.id} className="ds-list-row">
            <div style={{ minWidth: 0, flex: 1 }}>
              <div style={{ fontSize: 13 }}>{humanStatus(b.kind)}{b.reason ? ` — ${b.reason}` : ''}</div>
              <div className="ds-caption">{fmtDateTime(b.startAt)} → {fmtDateTime(b.endAt)}</div>
            </div>
            <button className="btn-ghost btn-sm" onClick={() => remove.mutate(b.id)} aria-label="Remove block"><Trash2 size={13} /></button>
          </div>
        ))}
        {!data?.length && <div className="ds-caption">Nothing blocked. The space is bookable through its opening hours.</div>}
      </div>

      <FormSection title="Block a period" description="A period that already has a confirmed booking is refused rather than double-booked by proxy.">
        <Field label="Reason for the block">
          <select className="input" value={form.kind} onChange={(e) => setForm({ ...form, kind: e.target.value })}>
            <option value="MAINTENANCE">Maintenance</option>
            <option value="BLOCKED">Blocked</option>
            <option value="HOLIDAY">Holiday</option>
            <option value="INTERNAL">Internal use</option>
          </select>
        </Field>
        <Field label="Note"><input className="input" value={form.reason} onChange={(e) => setForm({ ...form, reason: e.target.value })} /></Field>
        <Field label="From"><input className="input" type="datetime-local" value={form.startAt} onChange={(e) => setForm({ ...form, startAt: e.target.value })} /></Field>
        <Field label="To"><input className="input" type="datetime-local" value={form.endAt} onChange={(e) => setForm({ ...form, endAt: e.target.value })} /></Field>
        <div style={{ gridColumn: '1 / -1' }}>
          <button className="btn-primary btn-sm" disabled={add.isPending} onClick={() => add.mutate()}>Block it</button>
        </div>
      </FormSection>
    </Drawer>
  );
}
