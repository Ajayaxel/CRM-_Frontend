'use client';

// §5 + §7 — every account the org holds money in, and moving money between them.
//
// A transfer is the one movement that must NOT read as income or expense. It is
// posted as Dr destination / Cr source, touching no income or expense head at
// all, so it cannot inflate Money In on the dashboard even though cash visibly
// arrived somewhere. The dashboard drops it from both totals for the same
// reason (see moneyTotals on the server).

import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { Landmark, Wallet, ArrowRightLeft, Plus, X, ChevronRight } from 'lucide-react';
import { api, apiErrorMessage } from '@/lib/api';
import { CashAccount, MoneyType, money } from '../accounts-client';
import { cur } from '@/lib/org-locale';
import type { Section } from './accounts-feature';

const card: React.CSSProperties = { background: 'var(--surface)', border: '1px solid var(--line-soft)', borderRadius: 16 };
const inp: React.CSSProperties = { width: '100%', padding: '9px 11px', borderRadius: 9, border: '1px solid var(--line-soft)', background: 'var(--surface)', fontSize: 13.5 };

export function CashBankPanel({ window, onDrill }: {
  window: { from?: string; to?: string };
  onDrill: (s: Section, p?: { direction?: MoneyType; accountId?: string }) => void;
}) {
  const qc = useQueryClient();
  const [transfer, setTransfer] = useState(false);
  const [addAccount, setAddAccount] = useState(false);

  const { data, isLoading } = useQuery({
    queryKey: ['acct-cash-bank', window.from, window.to],
    queryFn: async () => (await api.get<{ rows: CashAccount[]; total: number }>('/accounting/cash-bank', { params: window })).data,
  });

  const rows = data?.rows ?? [];
  const refresh = () => qc.invalidateQueries();

  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 14, flexWrap: 'wrap' }}>
        <div style={{ ...card, padding: '12px 16px', flex: 1, minWidth: 220 }}>
          <div style={{ fontSize: 12.5, color: 'var(--ink-3)' }}>Total available balance</div>
          <div style={{ fontSize: 24, fontWeight: 800, marginTop: 4, color: 'var(--navy)', fontVariantNumeric: 'tabular-nums' }}>{money(data?.total ?? 0)}</div>
        </div>
        <button className="btn-secondary" style={{ height: 36 }} onClick={() => setTransfer(true)}><ArrowRightLeft size={14} /> Transfer</button>
        <button className="btn-primary" onClick={() => setAddAccount(true)}><Plus size={15} /> Add account</button>
      </div>

      {isLoading && <div style={{ ...card, padding: 40, textAlign: 'center', color: 'var(--ink-3)', fontSize: 13.5 }}>Loading…</div>}

      {!isLoading && rows.length === 0 && (
        <div style={{ ...card, padding: 44, textAlign: 'center', color: 'var(--ink-3)', fontSize: 13.5 }}>
          No cash or bank accounts yet. Add one to start tracking balances.
        </div>
      )}

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: 12 }}>
        {rows.map((a) => (
          <button key={a.id} onClick={() => onDrill('transactions', { accountId: a.id })}
            style={{ ...card, padding: 16, textAlign: 'left', cursor: 'pointer', display: 'block', width: '100%', opacity: a.isActive ? 1 : 0.55 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <div style={{ width: 38, height: 38, borderRadius: 11, background: 'var(--surface-2)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--ink-2)' }}>
                {a.subtype === 'CASH' ? <Wallet size={18} /> : <Landmark size={18} />}
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontWeight: 700, fontSize: 14.5 }}>{a.name}</div>
                <div style={{ fontSize: 11.5, color: 'var(--ink-3)' }}>{a.subtype === 'CASH' ? 'Cash' : 'Bank'} · {a.code}{a.isActive ? '' : ' · inactive'}</div>
              </div>
              <ChevronRight size={16} style={{ color: 'var(--ink-3)' }} />
            </div>
            <div style={{ fontSize: 25, fontWeight: 800, margin: '13px 0 2px', letterSpacing: '-.02em', fontVariantNumeric: 'tabular-nums' }}>{money(a.balance)}</div>
            <div style={{ fontSize: 11.5, color: 'var(--ink-3)' }}>Current balance</div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 8, marginTop: 13, paddingTop: 12, borderTop: '1px solid var(--line-soft)' }}>
              <Mini label="Opening" value={money(a.opening)} />
              <Mini label="Money In" value={money(a.moneyIn)} color="var(--success)" />
              <Mini label="Money Out" value={money(a.moneyOut)} color="var(--danger)" />
            </div>
          </button>
        ))}
      </div>

      {transfer && <TransferModal accounts={rows} onClose={() => setTransfer(false)} onDone={refresh} />}
      {addAccount && <AccountModal onClose={() => setAddAccount(false)} onDone={refresh} />}
    </div>
  );
}

function Mini({ label, value, color }: { label: string; value: string; color?: string }) {
  return (
    <div>
      <div style={{ fontSize: 10.5, color: 'var(--ink-3)', textTransform: 'uppercase', letterSpacing: '.05em', fontWeight: 700 }}>{label}</div>
      <div style={{ fontSize: 13, fontWeight: 700, marginTop: 3, color, fontVariantNumeric: 'tabular-nums' }}>{value}</div>
    </div>
  );
}

function TransferModal({ accounts, onClose, onDone }: { accounts: CashAccount[]; onClose: () => void; onDone: () => void }) {
  const [from, setFrom] = useState(accounts[0]?.id ?? '');
  const [to, setTo] = useState(accounts[1]?.id ?? '');
  const [amount, setAmount] = useState('');
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10));
  const [memo, setMemo] = useState('');

  const save = useMutation({
    mutationFn: async () => (await api.post('/accounting/transfer', {
      fromAccountId: from, toAccountId: to, amountInr: Number(amount),
      date: new Date(date).toISOString(), memo: memo.trim() || undefined,
    })).data,
    onSuccess: () => { toast.success('Transfer recorded'); onDone(); onClose(); },
    onError: (e) => toast.error(apiErrorMessage(e)),
  });

  const src = accounts.find((a) => a.id === from);
  const dst = accounts.find((a) => a.id === to);
  const amt = Number(amount) || 0;
  const invalid = !from || !to || from === to || amt <= 0;

  return (
    <Modal title="Transfer between accounts" onClose={onClose}>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
        <div>
          <L>From</L>
          <select style={inp} value={from} onChange={(e) => setFrom(e.target.value)}>
            {accounts.map((a) => <option key={a.id} value={a.id}>{a.name} — {money(a.balance)}</option>)}
          </select>
        </div>
        <div>
          <L>To</L>
          <select style={inp} value={to} onChange={(e) => setTo(e.target.value)}>
            {accounts.map((a) => <option key={a.id} value={a.id}>{a.name} — {money(a.balance)}</option>)}
          </select>
        </div>
        <div>
          <L>Amount ({cur()})</L>
          <input style={inp} type="number" min={1} value={amount} onChange={(e) => setAmount(e.target.value)} placeholder="10000" />
        </div>
        <div>
          <L>Date</L>
          <input style={inp} type="date" value={date} onChange={(e) => setDate(e.target.value)} />
        </div>
        <div style={{ gridColumn: '1 / -1' }}>
          <L>Note (optional)</L>
          <input style={inp} value={memo} onChange={(e) => setMemo(e.target.value)} placeholder="Cash deposited at branch" />
        </div>
      </div>

      {from === to && from && <Warn>Choose two different accounts.</Warn>}
      {src && amt > src.balance && <Warn>{src.name} only holds {money(src.balance)}. This transfer will overdraw it.</Warn>}

      {!invalid && src && dst && (
        <div style={{ marginTop: 14, padding: 12, borderRadius: 10, background: 'var(--surface-2)', fontSize: 12.5 }}>
          <div style={{ fontWeight: 700, marginBottom: 6, color: 'var(--ink-2)' }}>This will be recorded as</div>
          <div style={{ display: 'flex', justifyContent: 'space-between' }}><span>Debit · {dst.name}</span><span style={{ fontWeight: 700 }}>{money(amt)}</span></div>
          <div style={{ display: 'flex', justifyContent: 'space-between' }}><span>Credit · {src.name}</span><span style={{ fontWeight: 700 }}>{money(amt)}</span></div>
          <div style={{ marginTop: 6, color: 'var(--ink-3)' }}>Not counted as income or expense.</div>
        </div>
      )}

      <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, marginTop: 16 }}>
        <button className="btn-secondary" onClick={onClose}>Cancel</button>
        <button className="btn-primary" disabled={invalid || save.isPending} onClick={() => save.mutate()}>
          {save.isPending ? 'Recording…' : 'Record transfer'}
        </button>
      </div>
    </Modal>
  );
}

function AccountModal({ onClose, onDone }: { onClose: () => void; onDone: () => void }) {
  const [name, setName] = useState('');
  const [subtype, setSubtype] = useState<'BANK' | 'CASH'>('BANK');
  const [code, setCode] = useState('');

  const save = useMutation({
    // A cash/bank account IS a ledger account — created through the same chart
    // of accounts endpoint, so it appears in the trial balance like any other.
    mutationFn: async () => (await api.post('/accounting/accounts', { name: name.trim(), type: 'ASSET', subtype, code: code.trim() || undefined })).data,
    onSuccess: () => { toast.success('Account added'); onDone(); onClose(); },
    onError: (e) => toast.error(apiErrorMessage(e)),
  });

  return (
    <Modal title="Add a cash or bank account" onClose={onClose}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        <div>
          <L>Account name</L>
          <input style={inp} value={name} onChange={(e) => setName(e.target.value)} placeholder="HDFC Current Account" />
        </div>
        <div>
          <L>Kind</L>
          <select style={inp} value={subtype} onChange={(e) => setSubtype(e.target.value as 'BANK' | 'CASH')}>
            <option value="BANK">Bank</option>
            <option value="CASH">Cash in hand</option>
          </select>
        </div>
        <div>
          <L>Account code (optional — assigned automatically if blank)</L>
          <input style={inp} value={code} onChange={(e) => setCode(e.target.value)} placeholder="1020" />
        </div>
      </div>
      <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, marginTop: 16 }}>
        <button className="btn-secondary" onClick={onClose}>Cancel</button>
        <button className="btn-primary" disabled={!name.trim() || save.isPending} onClick={() => save.mutate()}>
          {save.isPending ? 'Adding…' : 'Add account'}
        </button>
      </div>
    </Modal>
  );
}

function Warn({ children }: { children: React.ReactNode }) {
  return <div style={{ marginTop: 12, fontSize: 12.5, color: 'var(--gold)' }}>{children}</div>;
}

function L({ children }: { children: React.ReactNode }) {
  return <label style={{ display: 'block', fontSize: 11.5, fontWeight: 600, color: 'var(--ink-3)', marginBottom: 4 }}>{children}</label>;
}

function Modal({ title, onClose, children }: { title: string; onClose: () => void; children: React.ReactNode }) {
  return (
    <div onClick={onClose} style={{ position: 'fixed', inset: 0, background: 'rgba(10,12,25,.42)', zIndex: 60, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }}>
      <div onClick={(e) => e.stopPropagation()} style={{ ...card, width: 'min(560px, 100%)', maxHeight: '90vh', overflowY: 'auto', padding: 20 }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
          <span style={{ fontWeight: 700, fontSize: 16 }}>{title}</span>
          <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--ink-3)' }}><X size={18} /></button>
        </div>
        {children}
      </div>
    </div>
  );
}
