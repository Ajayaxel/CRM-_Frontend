'use client';

import { Suspense, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { Table2, Kanban, Filter, Download, Upload, Plus } from 'lucide-react';
import { api, apiErrorMessage } from '@/lib/api';
import { useAuth } from '@/features/foundation/auth';
import { leadVocab } from '@/lib/shell-copy';
import { NewLeadDrawer } from './new-lead-drawer';
import {
  LeadRow, LeadStage, SOURCE_LABELS, avatarStyle, leadInitials, leadName,
  scoreColor, scoreGrade, GRADE_META, gradeBadgeStyle, stageBadgeStyle, stageMeta,
} from '../leads-utils';
import type { Paginated } from '@/lib/types';

function LeadsInner() {
  const router = useRouter();
  const params = useSearchParams();
  const { hasPermission } = useAuth();
  const [view, setView] = useState<'table' | 'kanban'>('table');
  const [drawer, setDrawer] = useState(params.get('new') === '1');
  const [importOpen, setImportOpen] = useState(false);

  const { data: stats } = useQuery({
    queryKey: ['leads-stats'],
    queryFn: async () => (await api.get('/leads/stats')).data as { total: number; newThisWeek: number },
  });

  const exportCsv = async () => {
    const res = await api.get('/leads/export', { responseType: 'blob' });
    const url = URL.createObjectURL(res.data as Blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'leads.csv';
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div style={{ animation: 'fadeUp .4s ease' }}>
      <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', gap: 20, flexWrap: 'wrap', marginBottom: 22 }}>
        <div>
          <h1 style={{ fontSize: 28, fontWeight: 700, letterSpacing: '-.02em', margin: 0, lineHeight: 1.1 }}>Leads</h1>
          <p style={{ fontSize: 14, color: 'var(--ink-2)', margin: '6px 0 0' }}>
            {stats ? `${stats.total} total · ${stats.newThisWeek} new this week` : 'Loading…'}
          </p>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <div style={{ display: 'flex', background: 'var(--surface-2)', borderRadius: 11, padding: 4, gap: 3 }}>
            <ViewBtn active={view === 'table'} onClick={() => setView('table')} icon={<Table2 size={15} strokeWidth={1.9} />}>Table</ViewBtn>
            <ViewBtn active={view === 'kanban'} onClick={() => setView('kanban')} icon={<Kanban size={15} strokeWidth={1.9} />}>Kanban</ViewBtn>
          </div>
          <button className="btn-secondary" style={{ height: 40 }}><Filter size={15} strokeWidth={1.9} />Filter</button>
          {hasPermission('lead.import') && (
            <>
              <button className="btn-secondary" style={{ height: 40 }} onClick={() => setImportOpen(true)}><Upload size={15} strokeWidth={1.9} />Import</button>
              <button className="btn-secondary" style={{ height: 40 }} onClick={exportCsv}><Download size={15} strokeWidth={1.9} />Export</button>
            </>
          )}
          {hasPermission('lead.manage') && (
            <button className="btn-primary" style={{ height: 40 }} onClick={() => setDrawer(true)}><Plus size={16} strokeWidth={2} />New Lead</button>
          )}
        </div>
      </div>

      {view === 'table' ? <TableView onOpen={(id) => router.push(`/leads/${id}`)} /> : <KanbanView onOpen={(id) => router.push(`/leads/${id}`)} />}

      <NewLeadDrawer open={drawer} onClose={() => { setDrawer(false); router.replace('/leads'); }} />
      <ImportModal open={importOpen} onClose={() => setImportOpen(false)} />
    </div>
  );
}

function ViewBtn({ active, onClick, icon, children }: { active: boolean; onClick: () => void; icon: React.ReactNode; children: React.ReactNode }) {
  return (
    <button
      onClick={onClick}
      style={{
        display: 'inline-flex', alignItems: 'center', gap: 5, padding: '8px 14px', borderRadius: 9, border: 'none', cursor: 'pointer',
        fontWeight: 600, fontSize: 12.5,
        background: active ? 'var(--surface)' : 'transparent',
        color: active ? 'var(--ink)' : 'var(--ink-2)',
        boxShadow: active ? 'var(--shadow-1)' : 'none',
      }}
    >
      {icon}{children}
    </button>
  );
}

function TableView({ onOpen }: { onOpen: (id: string) => void }) {
  const { user } = useAuth();
  const vocab = leadVocab(user?.organization?.vertical);
  // No interest column at all when the vertical has no course-shaped concept.
  const COLS = vocab.interest ? '2.2fr 1.4fr 1.2fr 1fr 1fr 0.9fr' : '2.4fr 1.3fr 1.4fr 1.1fr 0.9fr';
  const { data, isLoading } = useQuery({
    queryKey: ['leads'],
    queryFn: async () => (await api.get<Paginated<LeadRow>>('/leads?limit=100')).data,
  });

  return (
    <div className="card" style={{ overflow: 'hidden' }}>
      <div style={{ display: 'grid', gridTemplateColumns: COLS, gap: 12, padding: '14px 22px', borderBottom: '1px solid var(--line-soft)', fontFamily: 'var(--mono)', fontSize: 10, letterSpacing: '.1em', textTransform: 'uppercase', color: 'var(--ink-3)' }}>
        <div>Lead</div>{vocab.interest && <div>{vocab.interest}</div>}<div>Source</div><div>{vocab.owner}</div><div>Stage</div><div style={{ textAlign: 'right' }}>Score</div>
      </div>
      {isLoading && <div style={{ padding: 40, textAlign: 'center', color: 'var(--ink-3)' }}>Loading…</div>}
      {data?.data.length === 0 && <div style={{ padding: 40, textAlign: 'center', color: 'var(--ink-3)' }}>No leads yet.</div>}
      {data?.data.map((l) => (
        <div
          key={l.id}
          onClick={() => onOpen(l.id)}
          className="lead-row"
          style={{ display: 'grid', gridTemplateColumns: COLS, gap: 12, padding: '15px 22px', borderBottom: '1px solid var(--line-soft)', alignItems: 'center', cursor: 'pointer' }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, minWidth: 0 }}>
            <span style={avatarStyle(l.id, 38)}>{leadInitials(l)}</span>
            <div style={{ minWidth: 0 }}>
              <div style={{ fontWeight: 600, fontSize: 14, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{leadName(l)}</div>
              <div style={{ fontSize: 12, color: 'var(--ink-3)' }}>{l.phone ?? '—'}</div>
            </div>
          </div>
          {vocab.interest && <div style={{ fontSize: 13.5, color: 'var(--ink-2)' }}>{l.course?.name ?? '—'}</div>}
          <div style={{ fontSize: 13 }}><span style={{ fontFamily: 'var(--mono)', fontSize: 11, background: 'var(--surface-2)', color: 'var(--ink-2)', padding: '3px 9px', borderRadius: 7 }}>{SOURCE_LABELS[l.source] ?? l.source}</span></div>
          <div style={{ fontSize: 13.5, color: 'var(--ink-2)' }}>{l.assignedTo ? `${l.assignedTo.firstName} ${l.assignedTo.lastName ?? ''}` : 'Unassigned'}</div>
          <div><span style={stageBadgeStyle(l.stage.name, l.stage.color)}><span style={{ width: 7, height: 7, borderRadius: 99, background: stageMeta(l.stage.name, l.stage.color).dot }} />{l.stage.name}</span></div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, justifyContent: 'flex-end' }}>
            <span style={gradeBadgeStyle(scoreGrade(l.score))}>{GRADE_META[scoreGrade(l.score)].emoji} {GRADE_META[scoreGrade(l.score)].label}</span>
            <span style={{ fontWeight: 700, fontSize: 14, color: scoreColor(l.score), minWidth: 22, textAlign: 'right' }}>{l.score}</span>
          </div>
        </div>
      ))}
      <style>{`.lead-row:hover{background:var(--surface-2);}`}</style>
    </div>
  );
}

function KanbanView({ onOpen }: { onOpen: (id: string) => void }) {
  const { data } = useQuery({
    queryKey: ['leads-board'],
    queryFn: async () => (await api.get('/leads/board')).data as { stage: LeadStage; leads: LeadRow[] }[],
  });

  return (
    <div style={{ display: 'flex', gap: 16, overflowX: 'auto', paddingBottom: 10 }}>
      {data?.map((col) => (
        <div key={col.stage.id} style={{ flex: '0 0 268px', width: 268 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12, padding: '0 4px' }}>
            <span style={{ width: 9, height: 9, borderRadius: 99, background: stageMeta(col.stage.name, col.stage.color).dot }} />
            <span style={{ fontWeight: 700, fontSize: 13.5 }}>{col.stage.name}</span>
            <span style={{ fontFamily: 'var(--mono)', fontSize: 10, color: 'var(--ink-3)', background: 'var(--surface-2)', padding: '2px 8px', borderRadius: 99 }}>{col.leads.length}</span>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {col.leads.map((c) => (
              <div
                key={c.id}
                onClick={() => onOpen(c.id)}
                className="kanban-card"
                style={{ background: 'var(--surface)', border: '1px solid var(--line-soft)', borderRadius: 14, padding: 14, boxShadow: 'var(--shadow-1)', cursor: 'pointer', transition: 'box-shadow .15s, transform .15s' }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 10 }}>
                  <span style={avatarStyle(c.id, 34)}>{leadInitials(c)}</span>
                  <div style={{ minWidth: 0, flex: 1 }}>
                    <div style={{ fontWeight: 600, fontSize: 13.5, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{leadName(c)}</div>
                    <div style={{ fontSize: 11.5, color: 'var(--ink-3)' }}>{c.course?.name ?? SOURCE_LABELS[c.source]}</div>
                  </div>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <span style={{ fontFamily: 'var(--mono)', fontSize: 11, background: 'var(--surface-2)', color: 'var(--ink-2)', padding: '3px 9px', borderRadius: 7 }}>{SOURCE_LABELS[c.source] ?? c.source}</span>
                  <span style={{ fontSize: 12.5, fontWeight: 700, color: 'var(--ink)' }}>{c.score}</span>
                </div>
              </div>
            ))}
            {col.leads.length === 0 && <div style={{ fontSize: 12, color: 'var(--ink-3)', padding: '8px 4px' }}>No leads</div>}
          </div>
        </div>
      ))}
      <style>{`.kanban-card:hover{box-shadow:var(--shadow-2);transform:translateY(-2px);}`}</style>
    </div>
  );
}

function ImportModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const qc = useQueryClient();
  const [csv, setCsv] = useState('');
  const [result, setResult] = useState<{ created: number; skipped: number; total: number } | null>(null);

  const run = useMutation({
    mutationFn: () => api.post('/leads/import', { csv }),
    onSuccess: (r) => {
      setResult(r.data);
      qc.invalidateQueries({ queryKey: ['leads'] });
      qc.invalidateQueries({ queryKey: ['leads-board'] });
      qc.invalidateQueries({ queryKey: ['leads-stats'] });
      toast.success(`Imported ${r.data.created} lead(s)`);
    },
    onError: (e) => toast.error(apiErrorMessage(e)),
  });

  const onFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    if (!f) return;
    const reader = new FileReader();
    reader.onload = () => setCsv(String(reader.result));
    reader.readAsText(f);
  };

  if (!open) return null;
  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 60, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }}>
      <div style={{ position: 'absolute', inset: 0, background: 'rgba(20,15,12,.42)' }} onClick={onClose} />
      <div className="card" style={{ position: 'relative', zIndex: 1, width: 560, maxWidth: '100%', padding: 24, borderRadius: 18 }}>
        <div style={{ fontWeight: 700, fontSize: 17 }}>Import Leads</div>
        <div style={{ fontSize: 12.5, color: 'var(--ink-3)', marginTop: 2, marginBottom: 16 }}>
          Upload or paste a CSV with headers: <code>Name, Email, Phone, Source, Course</code>
        </div>

        {!result ? (
          <>
            <input type="file" accept=".csv,text/csv" onChange={onFile} style={{ marginBottom: 12, fontSize: 13 }} />
            <textarea
              className="input"
              rows={7}
              placeholder={'Name,Email,Phone,Source,Course\nAarav Sharma,aarav@mail.com,+91…,Website,Data Science & AI'}
              value={csv}
              onChange={(e) => setCsv(e.target.value)}
              style={{ resize: 'vertical', fontFamily: 'monospace', fontSize: 12.5 }}
            />
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10, marginTop: 18 }}>
              <button className="btn-secondary" onClick={onClose}>Cancel</button>
              <button className="btn-primary" disabled={!csv.trim() || run.isPending} onClick={() => run.mutate()}>
                {run.isPending ? 'Importing…' : 'Import'}
              </button>
            </div>
          </>
        ) : (
          <>
            <div style={{ background: 'var(--success-bg)', borderRadius: 12, padding: 16, textAlign: 'center' }}>
              <div style={{ fontSize: 28, fontWeight: 800, color: 'var(--success)' }}>{result.created}</div>
              <div style={{ fontSize: 13, color: 'var(--ink-2)' }}>leads imported{result.skipped ? ` · ${result.skipped} skipped` : ''}</div>
            </div>
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10, marginTop: 18 }}>
              <button className="btn-primary" onClick={() => { setResult(null); setCsv(''); onClose(); }}>Done</button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

export function LeadsListFeature() {
  return (
    <Suspense fallback={<div style={{ color: 'var(--ink-3)' }}>Loading…</div>}>
      <LeadsInner />
    </Suspense>
  );
}
