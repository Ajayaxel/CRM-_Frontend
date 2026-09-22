'use client';

import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { AlertTriangle, BookOpen, ChevronRight, Library, Plus, Undo2, X } from 'lucide-react';
import { api, apiErrorMessage } from '@/lib/api';
import { useAuth } from '@/features/foundation/auth';
import {
  BookDetail, COPY_STATUS_LABEL, COPY_TONE, LibraryBook, LibraryOverview,
  LibraryPolicy, Loan, dueText, fmtDate, fmtInr,
} from '../library-client';

const card: React.CSSProperties = { background: 'var(--surface)', border: '1px solid var(--line-soft)', borderRadius: 16 };

export function LibraryFeature() {
  const [tab, setTab] = useState<'catalogue' | 'loans'>('catalogue');

  /**
   * Circulation is a separate key from cataloguing: issuing a book is what a
   * library assistant does all day, while adding a title changes what the
   * institute owns. Both are enforced again on the route.
   */
  const { hasPermission } = useAuth();
  const canCirculate = hasPermission('library.circulate');
  const canManage = hasPermission('library.manage');

  const { data: ov } = useQuery({
    queryKey: ['library-overview'],
    queryFn: async () => (await api.get<LibraryOverview>('/library/overview')).data,
  });

  return (
    <div style={{ animation: 'fadeUp .4s ease' }}>
      <div style={{ marginBottom: 18 }}>
        <h1 style={{ fontSize: 26, fontWeight: 700, letterSpacing: '-.02em', margin: 0 }}>Library</h1>
        <p style={{ fontSize: 14, color: 'var(--ink-2)', margin: '6px 0 0' }}>
          The catalogue, the copies on the shelf, and who is holding what.
        </p>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5,1fr)', gap: 12, marginBottom: 16 }}>
        <Stat label="Titles" value={ov?.titles ?? 0} />
        <Stat label="Copies" value={ov?.copies ?? 0} />
        <Stat label="On loan" value={ov?.issued ?? 0} accent="var(--info,#1a56db)" />
        <Stat label="Overdue" value={ov?.overdue ?? 0} accent="var(--danger,#c0392b)" />
        <Stat label="Fines charged" value={fmtInr(ov?.finesCollectedInr ?? 0)} accent="var(--brand,#132376)" />
      </div>

      <div style={{ display: 'flex', gap: 8, marginBottom: 14, flexWrap: 'wrap' }}>
        {([['catalogue', 'Catalogue', BookOpen], ['loans', 'Loans', Library]] as const).map(([k, l, Ic]) => (
          <button
            key={k} className="btn-secondary"
            style={{ height: 36, fontSize: 12.5, borderColor: tab === k ? 'var(--brand,#132376)' : undefined, color: tab === k ? 'var(--brand,#132376)' : undefined }}
            onClick={() => setTab(k)}
          >
            <Ic size={14} /> {l}
          </button>
        ))}
      </div>

      {tab === 'catalogue'
        ? <Catalogue canManage={canManage} canCirculate={canCirculate} />
        : <Loans canCirculate={canCirculate} />}
    </div>
  );
}

function Stat({ label, value, accent }: { label: string; value: number | string; accent?: string }) {
  return (
    <div style={{ ...card, padding: '14px 16px' }}>
      <div style={{ fontSize: 20, fontWeight: 800, color: accent }}>{value}</div>
      <div style={{ fontSize: 12, color: 'var(--ink-3)' }}>{label}</div>
    </div>
  );
}

function Empty({ text }: { text: string }) {
  return <div style={{ ...card, padding: 28, textAlign: 'center', color: 'var(--ink-3)', fontSize: 13.5 }}>{text}</div>;
}

function Pill({ text, tone }: { text: string; tone: { bg: string; fg: string } }) {
  return (
    <span style={{ background: tone.bg, color: tone.fg, fontSize: 11.5, fontWeight: 700, padding: '3px 9px', borderRadius: 999, whiteSpace: 'nowrap' }}>
      {text}
    </span>
  );
}

function Catalogue({ canManage, canCirculate }: { canManage: boolean; canCirculate: boolean }) {
  const qc = useQueryClient();
  const [search, setSearch] = useState('');
  const [openId, setOpenId] = useState<string | null>(null);
  const [adding, setAdding] = useState(false);
  const [f, setF] = useState({ title: '', author: '', category: '', isbn: '' });

  const { data: books, isLoading } = useQuery({
    queryKey: ['library-books', search],
    queryFn: async () => (await api.get<LibraryBook[]>('/library/books', { params: search.trim() ? { search: search.trim() } : {} })).data,
  });

  const create = useMutation({
    mutationFn: async () => (await api.post('/library/books', { ...f, title: f.title.trim(), author: f.author.trim() })).data,
    onSuccess: () => {
      toast.success('Title added — now add its copies');
      setF({ title: '', author: '', category: '', isbn: '' }); setAdding(false);
      qc.invalidateQueries({ queryKey: ['library-books'] });
      qc.invalidateQueries({ queryKey: ['library-overview'] });
    },
    onError: (e) => toast.error(apiErrorMessage(e)),
  });

  return (
    <div>
      <div style={{ display: 'flex', gap: 8, marginBottom: 12, flexWrap: 'wrap', alignItems: 'center' }}>
        <input className="input" style={{ height: 34, width: 260 }} placeholder="Search title, author or ISBN" value={search} onChange={(e) => setSearch(e.target.value)} />
        <div style={{ flex: 1 }} />
        {canManage && !adding && (
          <button className="btn-primary" style={{ height: 34, fontSize: 12.5 }} onClick={() => setAdding(true)}>
            <Plus size={14} /> Add a title
          </button>
        )}
      </div>

      {adding && canManage && (
        <div style={{ ...card, padding: 12, marginBottom: 12, display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
          <input className="input" style={{ height: 34, width: 230 }} placeholder="Title" value={f.title} onChange={(e) => setF({ ...f, title: e.target.value })} autoFocus />
          <input className="input" style={{ height: 34, width: 180 }} placeholder="Author" value={f.author} onChange={(e) => setF({ ...f, author: e.target.value })} />
          <input className="input" style={{ height: 34, width: 150 }} placeholder="Category" value={f.category} onChange={(e) => setF({ ...f, category: e.target.value })} />
          <input className="input" style={{ height: 34, width: 160 }} placeholder="ISBN" value={f.isbn} onChange={(e) => setF({ ...f, isbn: e.target.value })} />
          <button className="btn-primary" style={{ height: 34, fontSize: 12.5 }} disabled={!f.title.trim() || !f.author.trim() || create.isPending} onClick={() => create.mutate()}>
            {create.isPending ? 'Adding…' : 'Add'}
          </button>
          <button className="btn-secondary" style={{ height: 34, width: 34, padding: 0 }} onClick={() => setAdding(false)}><X size={14} /></button>
        </div>
      )}

      {isLoading ? <Empty text="Searching the catalogue…" />
        : !books?.length ? <Empty text={search ? 'Nothing matches that search.' : 'The catalogue is empty. Add a title, then add the copies you hold.'} />
        : (
          <div style={{ display: 'grid', gap: 10 }}>
            {books.map((b) => (
              <div key={b.id} style={card}>
                <button
                  onClick={() => setOpenId(openId === b.id ? null : b.id)}
                  style={{ width: '100%', display: 'flex', alignItems: 'center', gap: 10, padding: '13px 16px', background: 'none', border: 'none', cursor: 'pointer', textAlign: 'left', flexWrap: 'wrap' }}
                >
                  <div style={{ flex: 1, minWidth: 220 }}>
                    <div style={{ fontSize: 14, fontWeight: 600 }}>{b.title}</div>
                    <div style={{ fontSize: 11.5, color: 'var(--ink-3)', marginTop: 2 }}>
                      {b.author}{b.category ? ` · ${b.category}` : ''}{b.isbn ? ` · ${b.isbn}` : ''}{b.shelf ? ` · shelf ${b.shelf}` : ''}
                    </div>
                  </div>
                  {/* Counted from the copies, so it cannot disagree with them. */}
                  <span style={{ fontSize: 12.5, fontWeight: 700, color: b.availableCopies ? 'var(--success,#1e874b)' : 'var(--ink-3)' }}>
                    {b.availableCopies} / {b.totalCopies} on shelf
                  </span>
                  <ChevronRight size={15} style={{ color: 'var(--ink-4,#9aa1ab)', transform: openId === b.id ? 'rotate(90deg)' : undefined, transition: 'transform .15s' }} />
                </button>
                {openId === b.id && <BookPanel bookId={b.id} canManage={canManage} canCirculate={canCirculate} />}
              </div>
            ))}
          </div>
        )}
    </div>
  );
}

function BookPanel({ bookId, canManage, canCirculate }: { bookId: string; canManage: boolean; canCirculate: boolean }) {
  const qc = useQueryClient();
  const [count, setCount] = useState(1);
  const [priceInr, setPriceInr] = useState('');
  const [borrower, setBorrower] = useState('');

  const { data } = useQuery({
    queryKey: ['library-book', bookId],
    queryFn: async () => (await api.get<BookDetail>(`/library/books/${bookId}`)).data,
  });
  const { data: policy } = useQuery({
    queryKey: ['library-policy'],
    queryFn: async () => (await api.get<LibraryPolicy>('/library/policy')).data,
  });

  const refresh = () => {
    qc.invalidateQueries({ queryKey: ['library-book', bookId] });
    qc.invalidateQueries({ queryKey: ['library-books'] });
    qc.invalidateQueries({ queryKey: ['library-overview'] });
    qc.invalidateQueries({ queryKey: ['library-loans'] });
  };

  const addCopies = useMutation({
    mutationFn: async () => (await api.post(`/library/books/${bookId}/copies`, { count, priceInr: priceInr ? Number(priceInr) : undefined })).data,
    onSuccess: (r: any) => { toast.success(`${Array.isArray(r) ? r.length : ''} copies accessioned`.trim()); setPriceInr(''); refresh(); },
    onError: (e) => toast.error(apiErrorMessage(e)),
  });

  const issue = useMutation({
    mutationFn: async (copyId: string) => (await api.post('/library/issue', { copyId, borrowerName: borrower.trim() })).data,
    onSuccess: () => { toast.success('Issued'); setBorrower(''); refresh(); },
    onError: (e) => toast.error(apiErrorMessage(e)),
  });

  const back = useMutation({
    mutationFn: async ({ loanId, lost }: { loanId: string; lost?: boolean }) =>
      (await api.post(`/library/loans/${loanId}/return`, lost ? { lost: true, note: 'Reported lost' } : {})).data,
    onSuccess: (r: any) => {
      toast.success(r?.fineCharged ? `Taken back — fine ${fmtInr(r.fineCharged)}` : 'Taken back');
      refresh();
    },
    onError: (e) => toast.error(apiErrorMessage(e)),
  });

  if (!data) return <div style={{ padding: '10px 16px', fontSize: 12.5, color: 'var(--ink-3)' }}>Loading copies…</div>;

  return (
    <div style={{ borderTop: '1px solid var(--line-soft)', padding: 16 }}>
      {canManage && (
        <div style={{ display: 'flex', gap: 8, marginBottom: 12, flexWrap: 'wrap', alignItems: 'center' }}>
          <input className="input" style={{ height: 32, width: 80 }} inputMode="numeric" value={count} onChange={(e) => setCount(Number(e.target.value) || 1)} title="How many copies" />
          <input className="input" style={{ height: 32, width: 130 }} inputMode="numeric" placeholder="Price each (₹)" value={priceInr} onChange={(e) => setPriceInr(e.target.value)} title="Charged if a copy is lost" />
          <button className="btn-secondary" style={{ height: 32, fontSize: 12 }} disabled={addCopies.isPending} onClick={() => addCopies.mutate()}>
            <Plus size={13} /> Accession copies
          </button>
          {policy && (
            <span style={{ fontSize: 11.5, color: 'var(--ink-3)' }}>
              Loans run {policy.loanDays} days, then {fmtInr(policy.finePerDayInr)} a day.
            </span>
          )}
        </div>
      )}

      {canCirculate && (
        <div style={{ display: 'flex', gap: 8, marginBottom: 10, flexWrap: 'wrap' }}>
          <input className="input" style={{ height: 32, width: 220 }} placeholder="Issue to (name)" value={borrower} onChange={(e) => setBorrower(e.target.value)} />
        </div>
      )}

      {!data.copies.length ? (
        <div style={{ fontSize: 12.5, color: 'var(--ink-3)' }}>
          No copies yet. A title with no copies is a catalogue entry, not a book anyone can borrow.
        </div>
      ) : (
        <div style={{ display: 'grid', gap: 6 }}>
          {data.copies.map((c) => (
            <div key={c.id} style={{ display: 'flex', gap: 10, alignItems: 'center', fontSize: 12.5, flexWrap: 'wrap' }}>
              <span style={{ width: 100, fontWeight: 600, fontVariantNumeric: 'tabular-nums' }}>{c.accessionNo}</span>
              <Pill text={COPY_STATUS_LABEL[c.status]} tone={COPY_TONE[c.status]} />
              {c.loan ? (
                <>
                  <span style={{ flex: 1, minWidth: 160 }}>
                    {c.loan.admissionNo ? `${c.loan.admissionNo} · ` : ''}{c.loan.borrowerName}
                  </span>
                  <span style={{ color: c.loan.overdueDays > 0 ? 'var(--danger,#c0392b)' : 'var(--ink-3)', fontWeight: c.loan.overdueDays > 0 ? 600 : 400 }}>
                    {dueText(c.loan.dueAt, c.loan.overdueDays)}
                  </span>
                  {canCirculate && (
                    <>
                      <button className="btn-secondary" style={{ height: 28, fontSize: 11 }} disabled={back.isPending} onClick={() => back.mutate({ loanId: c.loan!.id })}>
                        <Undo2 size={12} /> Take back
                      </button>
                      <button className="btn-secondary" style={{ height: 28, fontSize: 11, color: 'var(--danger,#c0392b)' }} disabled={back.isPending} onClick={() => back.mutate({ loanId: c.loan!.id, lost: true })} title="Charges the copy's price, not a daily fine">
                        Lost
                      </button>
                    </>
                  )}
                </>
              ) : (
                <>
                  <span style={{ flex: 1, minWidth: 160, color: 'var(--ink-3)' }}>{c.priceInr ? fmtInr(c.priceInr) : ''}</span>
                  {canCirculate && c.status === 'AVAILABLE' && (
                    <button
                      className="btn-secondary" style={{ height: 28, fontSize: 11 }}
                      disabled={!borrower.trim() || issue.isPending}
                      title={!borrower.trim() ? 'Type who it is going to first' : undefined}
                      onClick={() => issue.mutate(c.id)}
                    >
                      Issue
                    </button>
                  )}
                </>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function Loans({ canCirculate }: { canCirculate: boolean }) {
  const qc = useQueryClient();
  const [overdueOnly, setOverdueOnly] = useState(false);

  const { data: loans, isLoading } = useQuery({
    queryKey: ['library-loans', overdueOnly],
    queryFn: async () => (await api.get<Loan[]>('/library/loans', { params: overdueOnly ? { overdue: 'true' } : {} })).data,
  });

  const back = useMutation({
    mutationFn: async ({ loanId, waive }: { loanId: string; waive?: boolean }) =>
      (await api.post(`/library/loans/${loanId}/return`, waive ? { waive: true, note: 'Waived at the counter' } : {})).data,
    onSuccess: (r: any) => {
      toast.success(r?.fineWaivedFrom ? `Taken back — ${fmtInr(r.fineWaivedFrom)} waived` : r?.fineCharged ? `Taken back — fine ${fmtInr(r.fineCharged)}` : 'Taken back');
      qc.invalidateQueries({ queryKey: ['library-loans'] });
      qc.invalidateQueries({ queryKey: ['library-books'] });
      qc.invalidateQueries({ queryKey: ['library-overview'] });
    },
    onError: (e) => toast.error(apiErrorMessage(e)),
  });

  return (
    <div>
      <div style={{ marginBottom: 12 }}>
        <button
          className="btn-secondary"
          style={{ height: 34, fontSize: 12.5, borderColor: overdueOnly ? 'var(--danger,#c0392b)' : undefined, color: overdueOnly ? 'var(--danger,#c0392b)' : undefined }}
          onClick={() => setOverdueOnly(!overdueOnly)}
        >
          <AlertTriangle size={13} /> Overdue only
        </button>
      </div>

      {isLoading ? <Empty text="Loading loans…" />
        : !loans?.length ? <Empty text={overdueOnly ? 'Nothing is overdue.' : 'Nothing has been issued yet.'} />
        : (
          <div style={{ ...card, overflow: 'hidden' }}>
            {loans.map((l, i) => (
              <div key={l.id} style={{ display: 'flex', gap: 10, alignItems: 'center', padding: '11px 16px', borderTop: i ? '1px solid var(--line-soft)' : undefined, fontSize: 12.5, flexWrap: 'wrap' }}>
                <span style={{ width: 100, fontWeight: 600, fontVariantNumeric: 'tabular-nums' }}>{l.copy.accessionNo}</span>
                <div style={{ flex: 1, minWidth: 200 }}>
                  <div style={{ fontWeight: 600 }}>{l.copy.book.title}</div>
                  <div style={{ fontSize: 11.5, color: 'var(--ink-3)' }}>
                    {l.student?.admissionNo ? `${l.student.admissionNo} · ` : ''}{l.borrowerName} · issued {fmtDate(l.issuedAt)}
                  </div>
                </div>
                {l.status === 'ISSUED' ? (
                  <>
                    <span style={{ color: l.overdueDays > 0 ? 'var(--danger,#c0392b)' : 'var(--ink-3)', fontWeight: l.overdueDays > 0 ? 600 : 400, width: 130, textAlign: 'right' }}>
                      {dueText(l.dueAt, l.overdueDays)}
                    </span>
                    {/* Advisory: what it would cost right now. The charge is set at return. */}
                    <span style={{ width: 70, textAlign: 'right', color: l.accruedFineInr ? 'var(--danger,#c0392b)' : 'var(--ink-4,#9aa1ab)' }}>
                      {l.accruedFineInr ? fmtInr(l.accruedFineInr) : '—'}
                    </span>
                    {canCirculate && (
                      <>
                        <button className="btn-secondary" style={{ height: 28, fontSize: 11 }} disabled={back.isPending} onClick={() => back.mutate({ loanId: l.id })}>
                          <Undo2 size={12} /> Take back
                        </button>
                        {l.accruedFineInr > 0 && (
                          <button className="btn-secondary" style={{ height: 28, fontSize: 11 }} disabled={back.isPending} onClick={() => back.mutate({ loanId: l.id, waive: true })}>
                            Waive
                          </button>
                        )}
                      </>
                    )}
                  </>
                ) : (
                  <span style={{ color: 'var(--ink-3)' }}>
                    {l.status === 'LOST' ? 'Lost' : `Returned ${fmtDate(l.returnedAt)}`}
                    {l.fineWaived ? ' · fine waived' : l.fineInr ? ` · ${fmtInr(l.fineInr)}` : ''}
                  </span>
                )}
              </div>
            ))}
          </div>
        )}
    </div>
  );
}
