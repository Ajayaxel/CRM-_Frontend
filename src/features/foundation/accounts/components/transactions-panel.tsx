'use client';

// §2/§3/§4 — the unified ledger and its drawer.
//
// The drawer is deliberately three layers deep: the money view is open, the
// linked record is open, and the journal is COLLAPSED. A clinic owner should
// never have to learn what a credit is to read their own day-book; an
// accountant is one click from the entry. Both are served by the same row.

import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import {
  ArrowDownLeft, ArrowUpRight, ArrowRightLeft, Undo2, SlidersHorizontal,
  X, Search, ChevronDown, ChevronUp, Link2, AlertTriangle,
} from 'lucide-react';
import { api } from '@/lib/api';
import {
  Txn, TxnPage, TxnDetail, MoneyType, money, fmtDate, fmtDateTime, TYPE_META,
} from '../accounts-client';

const card: React.CSSProperties = { background: 'var(--surface)', border: '1px solid var(--line-soft)', borderRadius: 16 };
const th: React.CSSProperties = { textAlign: 'left', fontSize: 11, letterSpacing: '.05em', textTransform: 'uppercase', color: 'var(--ink-3)', fontWeight: 700, padding: '9px 12px', borderBottom: '1px solid var(--line-soft)', whiteSpace: 'nowrap' };
const td: React.CSSProperties = { padding: '10px 12px', fontSize: 13.5, borderBottom: '1px solid var(--line-soft)', verticalAlign: 'middle' };
const num: React.CSSProperties = { ...td, textAlign: 'right', fontVariantNumeric: 'tabular-nums', whiteSpace: 'nowrap' };

const TYPE_ICON: Record<MoneyType, any> = {
  IN: ArrowDownLeft, OUT: ArrowUpRight, TRANSFER: ArrowRightLeft, REFUND: Undo2, ADJUSTMENT: SlidersHorizontal,
};
const DIRECTIONS: (MoneyType | '')[] = ['', 'IN', 'OUT', 'TRANSFER', 'REFUND', 'ADJUSTMENT'];
const PAGE = 100;

export function TransactionsPanel({ window, preset }: {
  window: { from?: string; to?: string };
  preset: { direction?: MoneyType; accountId?: string } | null;
}) {
  const [direction, setDirection] = useState<MoneyType | ''>(preset?.direction ?? '');
  const [accountId, setAccountId] = useState<string>(preset?.accountId ?? '');
  const [q, setQ] = useState('');
  const [page, setPage] = useState(0);
  const [openId, setOpenId] = useState<string | null>(null);

  const params = {
    ...window,
    direction: direction || undefined,
    accountId: accountId || undefined,
    q: q.trim() || undefined,
    limit: PAGE,
    offset: page * PAGE,
  };
  const { data, isLoading } = useQuery({
    queryKey: ['acct-txns', params],
    queryFn: async () => (await api.get<TxnPage>('/accounting/transactions', { params })).data,
  });

  const rows = data?.rows ?? [];
  const totalIn = rows.reduce((s, r) => s + r.moneyIn, 0);
  const totalOut = rows.reduce((s, r) => s + r.moneyOut, 0);

  const sel: React.CSSProperties = { padding: '7px 10px', borderRadius: 9, border: '1px solid var(--line-soft)', background: 'var(--surface)', fontSize: 13 };

  return (
    <div>
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center', marginBottom: 12 }}>
        {DIRECTIONS.map((dkey) => {
          const on = direction === dkey;
          const label = dkey === '' ? 'All' : TYPE_META[dkey].label;
          return (
            <button key={dkey || 'all'} onClick={() => { setDirection(dkey); setPage(0); }}
              style={{
                border: '1px solid var(--line-soft)', borderRadius: 9, padding: '6px 12px', fontSize: 12.5,
                fontWeight: on ? 700 : 500, cursor: 'pointer',
                background: on ? 'var(--navy)' : 'var(--surface)', color: on ? '#fff' : 'var(--ink-2)',
              }}>
              {label}
            </button>
          );
        })}
        <span style={{ flex: 1 }} />
        <select style={sel} value={accountId} onChange={(e) => { setAccountId(e.target.value); setPage(0); }}>
          <option value="">All accounts</option>
          {(data?.accounts ?? []).map((a) => <option key={a.id} value={a.id}>{a.name}</option>)}
        </select>
        <span style={{ position: 'relative', display: 'inline-flex', alignItems: 'center' }}>
          <Search size={14} style={{ position: 'absolute', left: 9, color: 'var(--ink-3)' }} />
          <input placeholder="Search transactions" value={q} onChange={(e) => { setQ(e.target.value); setPage(0); }}
            style={{ ...sel, paddingLeft: 28, minWidth: 190 }} />
        </span>
      </div>

      {data?.truncated && (
        <div style={{ ...card, padding: '10px 14px', marginBottom: 10, display: 'flex', gap: 8, alignItems: 'center', fontSize: 12.5, color: 'var(--ink-2)' }}>
          <AlertTriangle size={14} style={{ color: 'var(--gold)' }} />
          Only the first 2,000 transactions in this range were read. Narrow the date filter for a complete view.
        </div>
      )}

      <div style={{ ...card, overflow: 'hidden' }}>
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: 880 }}>
            <thead>
              <tr>
                <th style={th}>Date</th>
                <th style={th}>Transaction</th>
                <th style={th}>Type</th>
                <th style={{ ...th, textAlign: 'right' }}>Money In</th>
                <th style={{ ...th, textAlign: 'right' }}>Money Out</th>
                <th style={th}>Account</th>
                <th style={th}>Category</th>
                <th style={{ ...th, textAlign: 'right' }}>Balance</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((t) => <Row key={t.id} t={t} onOpen={() => setOpenId(t.id)} />)}
            </tbody>
            {rows.length > 0 && (
              <tfoot>
                <tr>
                  <td style={{ ...td, fontWeight: 700 }} colSpan={3}>Shown on this page</td>
                  <td style={{ ...num, fontWeight: 700, color: 'var(--success)' }}>{money(totalIn)}</td>
                  <td style={{ ...num, fontWeight: 700, color: 'var(--danger)' }}>{money(totalOut)}</td>
                  <td style={td} colSpan={2} />
                  <td style={{ ...num, fontWeight: 700 }}>{money(data?.closing ?? 0)}</td>
                </tr>
              </tfoot>
            )}
          </table>
        </div>

        {isLoading && <div style={{ padding: 34, textAlign: 'center', color: 'var(--ink-3)', fontSize: 13.5 }}>Loading…</div>}
        {!isLoading && rows.length === 0 && (
          <div style={{ padding: 40, textAlign: 'center', color: 'var(--ink-3)', fontSize: 13.5 }}>
            No transactions match this filter.
          </div>
        )}
      </div>

      {(data?.total ?? 0) > PAGE && (
        <div style={{ display: 'flex', gap: 8, alignItems: 'center', justifyContent: 'flex-end', marginTop: 12, fontSize: 12.5, color: 'var(--ink-3)' }}>
          <span>{page * PAGE + 1}–{Math.min((page + 1) * PAGE, data!.total)} of {data!.total}</span>
          <button className="btn-secondary" style={{ height: 30, fontSize: 12.5 }} disabled={page === 0} onClick={() => setPage((p) => p - 1)}>Previous</button>
          <button className="btn-secondary" style={{ height: 30, fontSize: 12.5 }} disabled={(page + 1) * PAGE >= data!.total} onClick={() => setPage((p) => p + 1)}>Next</button>
        </div>
      )}

      {openId && <TxnDrawer id={openId} onClose={() => setOpenId(null)} />}
    </div>
  );
}

function Row({ t, onOpen }: { t: Txn; onOpen: () => void }) {
  const meta = TYPE_META[t.type];
  const Icon = TYPE_ICON[t.type];
  return (
    <tr onClick={onOpen} style={{ cursor: 'pointer' }}>
      <td style={{ ...td, whiteSpace: 'nowrap', color: 'var(--ink-2)' }}>{fmtDate(t.date)}</td>
      <td style={td}>
        <div style={{ fontWeight: 600 }}>{t.memo}</div>
        {/* A transfer is neither money in nor money out, so both money columns
            stay empty — but the amount still has to be readable, so it rides
            along with the label rather than being coloured as spending. */}
        <div style={{ fontSize: 11.5, color: 'var(--ink-3)', marginTop: 2 }}>
          {t.label}{t.type === 'TRANSFER' && t.amount ? ` · ${money(t.amount)}` : ''}
        </div>
      </td>
      <td style={td}>
        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5, background: meta.bg, color: meta.fg, borderRadius: 7, padding: '3px 8px', fontSize: 11.5, fontWeight: 700, whiteSpace: 'nowrap' }}>
          <Icon size={12} /> {meta.label}
        </span>
      </td>
      <td style={{ ...num, color: t.moneyIn ? 'var(--success)' : 'var(--ink-3)', fontWeight: t.moneyIn ? 700 : 400 }}>{t.moneyIn ? money(t.moneyIn) : '—'}</td>
      <td style={{ ...num, color: t.moneyOut ? 'var(--danger)' : 'var(--ink-3)', fontWeight: t.moneyOut ? 700 : 400 }}>{t.moneyOut ? money(t.moneyOut) : '—'}</td>
      <td style={{ ...td, color: 'var(--ink-2)' }}>{t.account || '—'}</td>
      <td style={{ ...td, color: 'var(--ink-2)' }}>{t.category}</td>
      <td style={{ ...num, fontWeight: 600 }}>{money(t.balance)}</td>
    </tr>
  );
}

/* ------------------------------------------------------------------ drawer -- */

function TxnDrawer({ id, onClose }: { id: string; onClose: () => void }) {
  const [showJournal, setShowJournal] = useState(false);
  const { data, isLoading } = useQuery({
    queryKey: ['acct-txn', id],
    queryFn: async () => (await api.get<TxnDetail>(`/accounting/transactions/${id}`)).data,
  });

  const meta = data ? TYPE_META[data.type] : null;

  return (
    <div onClick={onClose} style={{ position: 'fixed', inset: 0, background: 'rgba(10,12,25,.42)', zIndex: 60, display: 'flex', justifyContent: 'flex-end' }}>
      <div onClick={(e) => e.stopPropagation()}
        style={{ width: 'min(520px, 100%)', height: '100%', background: 'var(--surface)', borderLeft: '1px solid var(--line-soft)', overflowY: 'auto', animation: 'slideIn .22s ease' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '15px 18px', borderBottom: '1px solid var(--line-soft)', position: 'sticky', top: 0, background: 'var(--surface)', zIndex: 1 }}>
          <span style={{ fontWeight: 700, fontSize: 15.5 }}>Transaction</span>
          <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--ink-3)' }}><X size={18} /></button>
        </div>

        {isLoading && <div style={{ padding: 40, textAlign: 'center', color: 'var(--ink-3)' }}>Loading…</div>}

        {data && (
          <div style={{ padding: 18, display: 'flex', flexDirection: 'column', gap: 18 }}>
            {/* Level 1 — what happened, in money */}
            <div>
              <div style={{ fontSize: 18, fontWeight: 700 }}>{data.memo}</div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 8, flexWrap: 'wrap' }}>
                <span className="badge" style={{ background: meta!.bg, color: meta!.fg }}>{meta!.label}</span>
                <span className="badge" style={{ background: 'var(--surface-2)', color: 'var(--ink-3)' }}>{data.label}</span>
              </div>
              <div style={{ fontSize: 30, fontWeight: 800, marginTop: 12, letterSpacing: '-.02em', color: data.moneyIn ? 'var(--success)' : data.moneyOut ? 'var(--danger)' : 'var(--ink-1)' }}>
                {data.moneyIn ? `+${money(data.moneyIn)}` : data.moneyOut ? `−${money(data.moneyOut)}` : money(data.amount)}
              </div>
            </div>

            <Section title="Details">
              <Field label="Transaction ID" value={data.id} mono />
              <Field label="Date" value={fmtDateTime(data.date)} />
              <Field label="Recorded" value={fmtDateTime(data.createdAt)} />
              <Field label="Type" value={meta!.label} />
              <Field label={data.type === 'TRANSFER' ? 'From → To' : 'Account'} value={data.account || '—'} />
              <Field label="Category" value={data.categoryCode ? `${data.category} (${data.categoryCode})` : data.category} />
            </Section>

            {/* Level 2 — the business record behind it */}
            {data.source && (
              <Section title="Linked record">
                <Field label="Document" value={data.source.reference ?? '—'} />
                {data.source.party && <Field label="Party" value={data.source.party} />}
                {data.source.amountInr != null && <Field label="Document amount" value={money(data.source.amountInr)} />}
                {data.source.status && <Field label="Status" value={data.source.status} />}
                {data.source.method && <Field label="Payment method" value={data.source.method} />}
                {data.source.category && <Field label="Expense category" value={data.source.category} />}
                {data.source.approvedBy && <Field label="Approved by" value={data.source.approvedBy} />}
                {data.source.dueDate && <Field label="Due" value={fmtDate(data.source.dueDate)} />}
                {data.source.href && (
                  <a href={data.source.href} style={{ display: 'inline-flex', alignItems: 'center', gap: 5, fontSize: 12.5, color: 'var(--navy)', fontWeight: 600, marginTop: 4 }}>
                    <Link2 size={13} /> Open the source document
                  </a>
                )}
              </Section>
            )}

            {/* Level 3 — the accounting, only when asked for */}
            <div style={{ border: '1px solid var(--line-soft)', borderRadius: 12, overflow: 'hidden' }}>
              <button onClick={() => setShowJournal((v) => !v)}
                style={{ width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '11px 14px', background: 'var(--surface-2)', border: 'none', cursor: 'pointer', fontSize: 13, fontWeight: 700, color: 'var(--ink-2)' }}>
                Accounting Details
                {showJournal ? <ChevronUp size={15} /> : <ChevronDown size={15} />}
              </button>
              {showJournal && (
                <div style={{ padding: 14 }}>
                  <div style={{ fontSize: 11, letterSpacing: '.06em', textTransform: 'uppercase', color: 'var(--ink-3)', fontWeight: 700, marginBottom: 7 }}>Journal Entry</div>
                  <JournalSideBlock title="Debit" rows={data.journal.debits} />
                  <div style={{ height: 10 }} />
                  <JournalSideBlock title="Credit" rows={data.journal.credits} />
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 12, paddingTop: 10, borderTop: '1px solid var(--line-soft)', fontSize: 12.5, fontWeight: 700 }}>
                    <span style={{ color: 'var(--ink-3)' }}>Total</span>
                    <span style={{ fontVariantNumeric: 'tabular-nums' }}>
                      Dr {money(data.journal.totalDebit)} · Cr {money(data.journal.totalCredit)}
                    </span>
                  </div>
                  {data.journal.totalDebit !== data.journal.totalCredit && (
                    <div style={{ marginTop: 8, fontSize: 12, color: 'var(--danger)', display: 'flex', gap: 6, alignItems: 'center' }}>
                      <AlertTriangle size={13} /> This entry does not balance — report it to your accountant.
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function JournalSideBlock({ title, rows }: { title: string; rows: { code: string; name: string; amount: number }[] }) {
  return (
    <div>
      <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--ink-2)', marginBottom: 4 }}>{title}</div>
      {rows.length === 0 && <div style={{ fontSize: 12.5, color: 'var(--ink-3)' }}>—</div>}
      {rows.map((r, i) => (
        <div key={`${r.code}-${i}`} style={{ display: 'flex', justifyContent: 'space-between', gap: 12, fontSize: 13, padding: '3px 0' }}>
          <span style={{ color: 'var(--ink-2)' }}>{r.name} <span style={{ color: 'var(--ink-3)', fontSize: 11.5 }}>{r.code}</span></span>
          <span style={{ fontVariantNumeric: 'tabular-nums', fontWeight: 600 }}>{money(r.amount)}</span>
        </div>
      ))}
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div>
      <div style={{ fontSize: 11, letterSpacing: '.06em', textTransform: 'uppercase', color: 'var(--ink-3)', fontWeight: 700, marginBottom: 8 }}>{title}</div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 7 }}>{children}</div>
    </div>
  );
}

function Field({ label, value, mono }: { label: string; value: string; mono?: boolean }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', gap: 14, fontSize: 13 }}>
      <span style={{ color: 'var(--ink-3)', flexShrink: 0 }}>{label}</span>
      <span style={{ fontWeight: 600, textAlign: 'right', wordBreak: 'break-all', fontFamily: mono ? 'ui-monospace, SFMono-Regular, monospace' : undefined, fontSize: mono ? 11.5 : undefined }}>{value}</span>
    </div>
  );
}
