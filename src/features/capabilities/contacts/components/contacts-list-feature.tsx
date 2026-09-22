'use client';

import { Suspense, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { Search, ShieldAlert, Check, Plus, Trash2, ArrowRight, User, Mail, Phone, Tag } from 'lucide-react';
import { api, apiErrorMessage } from '@/lib/api';
import { useAuth } from '@/features/foundation/auth';
import { Modal } from '@/components/molecules/modal';
import { Field } from '@/components/molecules/field';
import {
  GuardianRow, DuplicateContactGroup, TagRow, RELATION_LABELS, RELATION_OPTIONS
} from '../contacts-utils';
import type { Paginated } from '@/lib/types';
import { avatarStyle, studentInitials } from '@/features/verticals/education/students/students-utils';

type Tab = 'list' | 'duplicates' | 'tags';

const card: React.CSSProperties = {
  background: 'var(--surface)',
  border: '1px solid var(--line-soft)',
  borderRadius: 20,
  boxShadow: 'var(--shadow-1)',
};

const pastelColors = [
  { hex: '#64748b', name: 'Charcoal' },
  { hex: '#132376', name: 'Navy' },
  { hex: '#E6A23C', name: 'Gold' },
  { hex: '#4F8A6B', name: 'Sage' },
  { hex: '#C86B7A', name: 'Crimson' },
  { hex: '#5B8CA6', name: 'Teal' },
  { hex: '#8E7CC3', name: 'Lavender' },
];

function ContactsInner() {
  const router = useRouter();
  const qc = useQueryClient();
  const { hasPermission } = useAuth();
  const [tab, setTab] = useState<Tab>('list');

  // Search & Filter state
  const [search, setSearch] = useState('');
  const [relation, setRelation] = useState('');
  const [isEmergency, setIsEmergency] = useState('');
  const [page, setPage] = useState(1);

  // Merge modal state
  const [mergeGroup, setMergeGroup] = useState<DuplicateContactGroup | null>(null);
  const [primaryId, setPrimaryId] = useState('');
  const [duplicateId, setDuplicateId] = useState('');

  // Tag creation state
  const [newTagName, setNewTagName] = useState('');
  const [newTagColor, setNewTagColor] = useState(pastelColors[0].hex);

  // Fetch guardians
  const { data: guardiansData, isLoading: loadingGuardians } = useQuery({
    queryKey: ['guardians', search, relation, isEmergency, page],
    queryFn: async () => {
      const p = new URLSearchParams();
      p.set('page', String(page));
      p.set('limit', '10');
      if (search) p.set('search', search);
      if (relation) p.set('relation', relation);
      if (isEmergency) p.set('isEmergency', isEmergency);
      return (await api.get<Paginated<GuardianRow>>(`/contacts/guardians?${p.toString()}`)).data;
    },
    enabled: tab === 'list',
  });

  // Fetch duplicates
  const { data: duplicatesData, isLoading: loadingDuplicates, refetch: refetchDuplicates } = useQuery({
    queryKey: ['contacts-duplicates'],
    queryFn: async () => (await api.get<DuplicateContactGroup[]>('/contacts/duplicates')).data,
    enabled: tab === 'duplicates',
  });

  // Fetch tags
  const { data: tagsData, isLoading: loadingTags } = useQuery({
    queryKey: ['contacts-tags'],
    queryFn: async () => (await api.get<TagRow[]>('/contacts/tags')).data,
    enabled: tab === 'tags',
  });

  // Mutators
  const createTag = useMutation({
    mutationFn: () => api.post('/contacts/tags', { name: newTagName, color: newTagColor }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['contacts-tags'] });
      setNewTagName('');
      toast.success('Tag created successfully');
    },
    onError: (e) => toast.error(apiErrorMessage(e)),
  });

  const deleteTag = useMutation({
    mutationFn: (id: string) => api.delete(`/contacts/tags/${id}`),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['contacts-tags'] });
      toast.success('Tag deleted');
    },
    onError: (e) => toast.error(apiErrorMessage(e)),
  });

  const mergeContacts = useMutation({
    mutationFn: () => api.post('/contacts/merge', { primaryId, duplicateId }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['guardians'] });
      refetchDuplicates();
      setMergeGroup(null);
      setPrimaryId('');
      setDuplicateId('');
      toast.success('Contacts merged successfully');
    },
    onError: (e) => toast.error(apiErrorMessage(e)),
  });

  const handleOpenMerge = (group: DuplicateContactGroup) => {
    setMergeGroup(group);
    if (group.contacts.length >= 2) {
      setPrimaryId(group.contacts[0].id);
      setDuplicateId(group.contacts[1].id);
    }
  };

  const canManage = hasPermission('student.manage');
  const COLS = '2fr 1fr 2.2fr 1.6fr 1fr';

  return (
    <div style={{ animation: 'fadeUp .4s ease' }}>
      {/* Title Header */}
      <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', gap: 20, flexWrap: 'wrap', marginBottom: 22 }}>
        <div>
          <h1 style={{ fontSize: 28, fontWeight: 700, letterSpacing: '-.02em', margin: 0, lineHeight: 1.1 }}>Contact Management</h1>
          <p style={{ fontSize: 14, color: 'var(--ink-2)', margin: '6px 0 0' }}>
            Maintain parents/guardians, emergency records, scan for duplicates, and manage global tags.
          </p>
        </div>
      </div>

      {/* Tabs Selector */}
      <div style={{ display: 'flex', gap: 10, borderBottom: '1px solid var(--line-soft)', paddingBottom: 12, marginBottom: 20 }}>
        <button className={tab === 'list' ? 'btn-primary' : 'btn-secondary'} onClick={() => setTab('list')} style={{ height: 36, padding: '0 16px', fontSize: 13 }}>
          All Guardians
        </button>
        <button className={tab === 'duplicates' ? 'btn-primary' : 'btn-secondary'} onClick={() => setTab('duplicates')} style={{ height: 36, padding: '0 16px', fontSize: 13 }}>
          Duplicate Detection {duplicatesData && duplicatesData.length > 0 && <span style={{ marginLeft: 6, padding: '2px 6px', background: 'var(--danger-bg)', color: 'var(--danger)', borderRadius: 9, fontSize: 11, fontWeight: 700 }}>{duplicatesData.length}</span>}
        </button>
        <button className={tab === 'tags' ? 'btn-primary' : 'btn-secondary'} onClick={() => setTab('tags')} style={{ height: 36, padding: '0 16px', fontSize: 13 }}>
          Tags Manager
        </button>
      </div>

      {/* ALL GUARDIANS LIST TAB */}
      {tab === 'list' && (
        <div>
          {/* Search and Filters */}
          <div style={{ display: 'flex', gap: 12, marginBottom: 20, flexWrap: 'wrap' }}>
            <div style={{ display: 'flex', flex: 1, minWidth: 260, position: 'relative' }}>
              <Search size={16} style={{ position: 'absolute', left: 14, top: 12, color: 'var(--ink-3)' }} />
              <input
                className="input"
                style={{ paddingLeft: 38 }}
                placeholder="Search guardian name, email, or phone…"
                value={search}
                onChange={(e) => { setSearch(e.target.value); setPage(1); }}
              />
            </div>
            <div style={{ display: 'flex', gap: 10 }}>
              <select className="input" style={{ width: 160 }} value={relation} onChange={(e) => { setRelation(e.target.value); setPage(1); }}>
                <option value="">All Relations</option>
                {RELATION_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
              </select>
              <select className="input" style={{ width: 180 }} value={isEmergency} onChange={(e) => { setIsEmergency(e.target.value); setPage(1); }}>
                <option value="">Emergency Contact Status</option>
                <option value="true">Emergency Contact Only</option>
                <option value="false">Non-Emergency Contact Only</option>
              </select>
            </div>
          </div>

          {/* Table Card */}
          <div className="card" style={{ overflow: 'hidden' }}>
            <div style={{ display: 'grid', gridTemplateColumns: COLS, gap: 12, padding: '14px 22px', borderBottom: '1px solid var(--line-soft)', fontFamily: 'var(--mono)', fontSize: 10, letterSpacing: '.1em', textTransform: 'uppercase', color: 'var(--ink-3)' }}>
              <div>Guardian</div>
              <div>Relation</div>
              <div>Linked Students</div>
              <div>Phone & Email</div>
              <div style={{ textAlign: 'right' }}>Emergency</div>
            </div>

            {loadingGuardians && <div style={{ padding: 40, textAlign: 'center', color: 'var(--ink-3)' }}>Loading guardians…</div>}
            {guardiansData?.data.length === 0 && <div style={{ padding: 40, textAlign: 'center', color: 'var(--ink-3)' }}>No guardian contacts found.</div>}

            {guardiansData?.data.map((guardian) => (
              <div
                key={guardian.id}
                style={{ display: 'grid', gridTemplateColumns: COLS, gap: 12, padding: '15px 22px', borderBottom: '1px solid var(--line-soft)', alignItems: 'center' }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                  <span style={avatarStyle(guardian.id, 36)}>{studentInitials({ firstName: guardian.name })}</span>
                  <div>
                    <div style={{ fontWeight: 600, fontSize: 14 }}>{guardian.name}</div>
                    <div style={{ fontSize: 11, color: 'var(--ink-3)', marginTop: 2 }}>{guardian.occupation ?? '—'}</div>
                  </div>
                </div>
                <div>
                  <span style={{ fontSize: 12, fontWeight: 600, background: 'var(--surface-2)', padding: '3px 8px', borderRadius: 99, color: 'var(--ink)' }}>
                    {RELATION_LABELS[guardian.relation] ?? guardian.relation}
                  </span>
                </div>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                  {guardian.students.map(({ student, isEmergencyContact, isPrimary }) => (
                    <button
                      key={student.id}
                      onClick={() => router.push(`/students/${student.id}`)}
                      style={{
                        display: 'inline-flex', alignItems: 'center', gap: 5, background: 'rgba(19,35,118,.08)',
                        color: 'var(--navy)', border: 'none', padding: '3px 9px', borderRadius: 8, fontSize: 12,
                        fontWeight: 600, cursor: 'pointer'
                      }}
                    >
                      {student.firstName} {student.lastName ?? ''}
                      {isPrimary && <span style={{ fontSize: 9, opacity: 0.75, fontWeight: 700 }}>(P)</span>}
                    </button>
                  ))}
                  {guardian.students.length === 0 && <span style={{ color: 'var(--ink-3)', fontSize: 12.5 }}>No linked students</span>}
                </div>
                <div style={{ fontSize: 12.5 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}><Phone size={11} color="var(--ink-3)" />{guardian.phone ?? '—'}</div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 5, marginTop: 4, color: 'var(--ink-2)' }}><Mail size={11} color="var(--ink-3)" />{guardian.email ?? '—'}</div>
                </div>
                <div style={{ textAlign: 'right' }}>
                  {guardian.students.some(s => s.isEmergencyContact) ? (
                    <span style={{ fontSize: 11, background: 'var(--danger-bg)', color: 'var(--danger)', padding: '2px 8px', borderRadius: 99, fontWeight: 700 }}>Emergency</span>
                  ) : (
                    <span style={{ fontSize: 11, color: 'var(--ink-3)' }}>No</span>
                  )}
                </div>
              </div>
            ))}

            {/* Pagination */}
            {guardiansData && guardiansData.meta.totalPages > 1 && (
              <div style={{ padding: '12px 22px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: 'var(--surface-2)' }}>
                <button className="btn-secondary" style={{ padding: '6px 12px', fontSize: 12.5 }} disabled={page === 1} onClick={() => setPage(p => Math.max(1, p - 1))}>Previous</button>
                <span style={{ fontSize: 13, color: 'var(--ink-3)' }}>Page {page} of {guardiansData.meta.totalPages}</span>
                <button className="btn-secondary" style={{ padding: '6px 12px', fontSize: 12.5 }} disabled={page === guardiansData.meta.totalPages} onClick={() => setPage(p => p + 1)}>Next</button>
              </div>
            )}
          </div>
        </div>
      )}

      {/* DUPLICATE DETECTION TAB */}
      {tab === 'duplicates' && (
        <div style={{ animation: 'fadeUp .3s ease' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '12px 16px', background: 'rgba(231,0,11,.04)', border: '1px solid rgba(231,0,11,.16)', borderRadius: 14, marginBottom: 20 }}>
            <ShieldAlert size={16} color="var(--danger)" />
            <span style={{ fontSize: 13, color: 'var(--danger)', fontWeight: 600 }}>
              Scanning database for guardians with matching emails, phones, or identical names.
            </span>
          </div>

          {loadingDuplicates && <div style={{ color: 'var(--ink-3)' }}>Running deduplication scan…</div>}
          {duplicatesData?.length === 0 && <div className="card" style={{ padding: 40, textAlign: 'center', color: 'var(--ink-3)', borderRadius: 18 }}>No duplicate contact records found in this organization.</div>}

          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            {duplicatesData?.map((group, idx) => (
              <div key={idx} className="card" style={{ borderRadius: 18, padding: 22 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid var(--line-soft)', paddingBottom: 12, marginBottom: 16 }}>
                  <div>
                    <span style={{ fontSize: 11, background: 'rgba(19,35,118,.08)', color: 'var(--navy)', padding: '2px 8px', borderRadius: 99, fontWeight: 700, textTransform: 'uppercase' }}>
                      Match on {group.field}
                    </span>
                    <span style={{ fontSize: 14, fontWeight: 700, marginLeft: 10, color: 'var(--navy)' }}>"{group.value}"</span>
                  </div>
                  {canManage && (
                    <button className="btn-primary" style={{ padding: '6px 14px', fontSize: 12.5, height: 34 }} onClick={() => handleOpenMerge(group)}>
                      Merge Contacts
                    </button>
                  )}
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: 16 }}>
                  {group.contacts.map((contact) => (
                    <div key={contact.id} style={{ background: 'var(--surface-2)', padding: 14, borderRadius: 12, border: '1px solid var(--line-soft)' }}>
                      <div style={{ fontWeight: 600, fontSize: 14 }}>{contact.name}</div>
                      <div style={{ fontSize: 12, color: 'var(--ink-3)', marginTop: 2 }}>{contact.occupation || 'No Occupation'} · {RELATION_LABELS[contact.relation] ?? contact.relation}</div>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 4, marginTop: 10, fontSize: 12.5, color: 'var(--ink-2)' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}><Phone size={11} />{contact.phone ?? '—'}</div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}><Mail size={11} />{contact.email ?? '—'}</div>
                      </div>
                      <div style={{ borderTop: '1px solid var(--line-soft)', marginTop: 10, paddingTop: 8 }}>
                        <div style={{ fontSize: 11, color: 'var(--ink-3)', marginBottom: 4 }}>Linked Students:</div>
                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
                          {contact.students.map(({ student }) => (
                            <span key={student.id} style={{ background: 'var(--surface)', padding: '2px 6px', borderRadius: 6, fontSize: 11.5, fontWeight: 600, color: 'var(--navy)' }}>
                              {student.firstName} ({student.admissionNo})
                            </span>
                          ))}
                          {contact.students.length === 0 && <span style={{ fontSize: 11.5, color: 'var(--ink-3)' }}>None</span>}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* TAGS MANAGER TAB */}
      {tab === 'tags' && (
        <div style={{ display: 'grid', gridTemplateColumns: '1.2fr 1.8fr', gap: 24, animation: 'fadeUp .3s ease' }}>
          {/* Create tag Form */}
          {canManage && (
            <div className="card" style={{ borderRadius: 18, padding: 22 }}>
              <div style={{ fontWeight: 700, fontSize: 16, color: 'var(--navy)', marginBottom: 16 }}>Create New Tag</div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                <Field label="Tag Name">
                  <input className="input" placeholder="e.g. Hosteler, Growth-Prospect" value={newTagName} onChange={(e) => setNewTagName(e.target.value)} />
                </Field>
                <Field label="Select Color Theme">
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                    {pastelColors.map((c) => (
                      <button
                        key={c.hex}
                        type="button"
                        onClick={() => setNewTagColor(c.hex)}
                        style={{
                          width: 28, height: 28, borderRadius: 99, background: c.hex, cursor: 'pointer',
                          border: newTagColor === c.hex ? '2.5px solid var(--navy)' : '1px solid transparent',
                          boxShadow: 'inset 0 0 0 2px rgba(255,255,255,0.4)',
                        }}
                        title={c.name}
                      />
                    ))}
                  </div>
                </Field>
                <button className="btn-primary" style={{ marginTop: 6 }} disabled={!newTagName.trim() || createTag.isPending} onClick={() => createTag.mutate()}>
                  Create CRM Tag
                </button>
              </div>
            </div>
          )}

          {/* List tags */}
          <div className="card" style={{ borderRadius: 18, padding: 22 }}>
            <div className="eyebrow" style={{ marginBottom: 16 }}>All Configured Tags</div>
            {loadingTags && <div style={{ color: 'var(--ink-3)' }}>Loading system tags…</div>}
            {tagsData?.length === 0 && <div style={{ color: 'var(--ink-3)', fontSize: 13 }}>No tags defined yet.</div>}

            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
              {tagsData?.map((tag) => (
                <div
                  key={tag.id}
                  style={{
                    display: 'inline-flex', alignItems: 'center', gap: 6, background: tag.color || '#9A8F88',
                    color: '#fff', padding: '5px 12px', borderRadius: 99, fontSize: 13, fontWeight: 600
                  }}
                >
                  <Tag size={12} />
                  {tag.name}
                  {canManage && (
                    <button
                      onClick={() => confirm('Delete this tag?') && deleteTag.mutate(tag.id)}
                      style={{ background: 'none', border: 'none', padding: 0, cursor: 'pointer', color: 'rgba(255,255,255,0.8)', marginLeft: 4 }}
                    >
                      <Trash2 size={12} />
                    </button>
                  )}
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* MERGE CONFIRMATION MODAL */}
      {mergeGroup && (
        <Modal open={Boolean(mergeGroup)} onClose={() => setMergeGroup(null)} title="Execute Merge Action">
          <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            <p style={{ fontSize: 13, color: 'var(--ink-2)', lineHeight: 1.45, margin: 0 }}>
              You are merging duplicate parent/guardian records detected on matching **{mergeGroup.field}** ("{mergeGroup.value}").
            </p>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr auto 1fr', gap: 12, alignItems: 'center', background: 'var(--surface-2)', padding: 14, borderRadius: 12, border: '1px solid var(--line-soft)' }}>
              <div>
                <label style={{ fontSize: 11, color: 'var(--ink-3)', display: 'block', marginBottom: 5 }}>Primary (Keep)</label>
                <select className="input" style={{ fontSize: 12.5, height: 34, padding: '0 8px' }} value={primaryId} onChange={(e) => { setPrimaryId(e.target.value); if(e.target.value === duplicateId) setDuplicateId(mergeGroup.contacts.find(c => c.id !== e.target.value)?.id || ''); }}>
                  {mergeGroup.contacts.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
                </select>
              </div>
              <ArrowRight size={16} color="var(--ink-3)" style={{ marginTop: 16 }} />
              <div>
                <label style={{ fontSize: 11, color: 'var(--ink-3)', display: 'block', marginBottom: 5 }}>Duplicate (Delete)</label>
                <select className="input" style={{ fontSize: 12.5, height: 34, padding: '0 8px' }} value={duplicateId} onChange={(e) => { setDuplicateId(e.target.value); if(e.target.value === primaryId) setPrimaryId(mergeGroup.contacts.find(c => c.id !== e.target.value)?.id || ''); }}>
                  {mergeGroup.contacts.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
                </select>
              </div>
            </div>

            <div style={{ background: 'rgba(230,162,60,.04)', border: '1px solid rgba(230,162,60,.18)', padding: 12, borderRadius: 10, display: 'flex', gap: 8, fontSize: 12.5, color: 'var(--ink-2)' }}>
              <ShieldAlert size={16} color="var(--gold)" style={{ flexShrink: 0 }} />
              <span>
                **Warning**: This action is irreversible. All linked students of the duplicate record will be linked to the primary guardian record. Missing contact details will copy over to primary, and the duplicate contact will be deleted permanently.
              </span>
            </div>

            <div style={{ display: 'flex', justifyContent: 'end', gap: 10, marginTop: 10 }}>
              <button type="button" className="btn-secondary" onClick={() => setMergeGroup(null)}>Cancel</button>
              <button type="button" className="btn-primary" disabled={mergeContacts.isPending} onClick={() => mergeContacts.mutate()}>
                {mergeContacts.isPending ? 'Merging…' : 'Execute Merge'}
              </button>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
}

export function ContactsListFeature() {
  return (
    <Suspense fallback={<div style={{ color: 'var(--ink-3)' }}>Loading…</div>}>
      <ContactsInner />
    </Suspense>
  );
}
