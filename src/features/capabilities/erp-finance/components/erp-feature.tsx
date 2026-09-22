'use client';

import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { TrendingUp, Users, Receipt, Package, ShoppingCart, Plus, X, Trash2, Check, PlayCircle, PackageCheck, FileText, ArrowDownToLine, ArrowUpFromLine } from 'lucide-react';
import { api, apiErrorMessage } from '@/lib/api';
import { useAuth } from '@/features/foundation/auth';
import { EXP_META, ErpStats, Expense, PO_META, Payslip, PayrollRun, Pnl, PurchaseOrder, Staff, StockItem, Supplier, money } from '../erp-client';
import { t } from '@/lib/org-locale';

const card: React.CSSProperties = { background: 'var(--surface)', border: '1px solid var(--line-soft)', borderRadius: 16 };

// Staff roles suited to each business type; free-text under the hood so any label works.
const ROLES_BY_VERTICAL: Record<string, string[]> = {
  DIGITAL_AGENCY: ['Developer', 'Designer', 'Project Manager', 'QA Engineer', 'DevOps', 'Marketing', 'Sales', 'HR', 'Admin', 'Support'],
  CONSULTING: ['Consultant', 'Analyst', 'Project Manager', 'Sales', 'HR', 'Admin', 'Support'],
  INSTITUTE: ['Teaching', 'Admin', 'Support'],
  STUDY_ABROAD: ['Counsellor', 'Visa Officer', 'Sales', 'Admin', 'Support'],
  REAL_ESTATE: ['Agent', 'Sales', 'Property Manager', 'Admin', 'Support'],
  HOTEL: ['Front Desk', 'Housekeeping', 'F&B', 'Maintenance', 'Management', 'Admin'],
  LEGAL: ['Lawyer', 'Paralegal', 'Clerk', 'Admin', 'Support'],
};
const DEFAULT_ROLES = ['Manager', 'Staff', 'Sales', 'Operations', 'HR', 'Admin', 'Support'];
const rolesFor = (vertical?: string) => ROLES_BY_VERTICAL[vertical ?? ''] ?? DEFAULT_ROLES;
const TABS = [['overview', 'P&L', TrendingUp], ['payroll', 'Payroll', Users], ['expenses', 'Expenses', Receipt], ['procurement', 'Procurement', ShoppingCart], ['inventory', 'Inventory', Package]] as const;

export function ErpFeature() {
  const [tab, setTab] = useState<(typeof TABS)[number][0]>('overview');
  return (
    <div style={{ animation: 'fadeUp .4s ease' }}>
      <div style={{ marginBottom: 18 }}>
        <h1 style={{ fontSize: 26, fontWeight: 700, letterSpacing: '-.02em', margin: 0 }}>Finance & ERP</h1>
        <p style={{ fontSize: 14, color: 'var(--ink-2)', margin: '6px 0 0' }}>Payroll, expenses, procurement and inventory — with a live P&L drawn from fees, payroll and expenses.</p>
      </div>
      <div style={{ display: 'flex', gap: 6, marginBottom: 16, flexWrap: 'wrap' }}>
        {TABS.map(([k, l, Ic]) => <button key={k} className="btn-secondary" style={{ height: 36, fontSize: 12.5, borderColor: tab === k ? 'var(--brand,#132376)' : undefined, color: tab === k ? 'var(--brand,#132376)' : undefined }} onClick={() => setTab(k)}><Ic size={14} /> {l}</button>)}
      </div>
      {tab === 'overview' && <OverviewTab />}
      {tab === 'payroll' && <PayrollTab />}
      {tab === 'expenses' && <ExpensesTab />}
      {tab === 'procurement' && <ProcurementTab />}
      {tab === 'inventory' && <InventoryTab />}
    </div>
  );
}

// ================= Overview / P&L =================
function OverviewTab() {
  const { data: pnl } = useQuery({ queryKey: ['erp-pnl'], queryFn: async () => (await api.get<Pnl>('/erp/pnl')).data });
  const { data: stats } = useQuery({ queryKey: ['erp-stats'], queryFn: async () => (await api.get<ErpStats>('/erp/stats')).data });
  const profit = pnl?.netProfit ?? 0;
  return (
    <div>
      <div style={{ display: 'grid', gridTemplateColumns: '1.4fr 1fr', gap: 16, marginBottom: 16 }}>
        <div style={{ ...card, padding: 20 }}>
          <div style={{ fontWeight: 700, fontSize: 15, marginBottom: 14 }}>Profit &amp; Loss</div>
          <Row label={`${t('finance.income')} (income)`} value={money(pnl?.income.total)} color="var(--success,#1e874b)" bold />
          <div style={{ height: 1, background: 'var(--line-soft)', margin: '10px 0' }} />
          <Row label="Payroll" value={'– ' + money(pnl?.expense.payroll)} />
          <Row label="Expenses" value={'– ' + money(pnl?.expense.expenses)} />
          <Row label="Procurement (billed)" value={'– ' + money(pnl?.expense.procurement)} />
          <Row label="Total expense" value={'– ' + money(pnl?.expense.total)} color="var(--danger,#c0392b)" bold />
          <div style={{ height: 1, background: 'var(--line-soft)', margin: '10px 0' }} />
          <Row label="Net profit" value={money(profit)} color={profit >= 0 ? 'var(--success,#1e874b)' : 'var(--danger,#c0392b)'} bold big />
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          <MiniStat label="Active staff" value={stats?.staff ?? 0} />
          <MiniStat label="Monthly payroll" value={money(stats?.monthlyPayroll)} />
          <MiniStat label="Pending expenses" value={stats?.pendingExpenses ?? 0} accent="var(--gold,#c67c1e)" />
          <MiniStat label="Low-stock items" value={stats?.lowStock ?? 0} accent="var(--danger,#c0392b)" />
        </div>
      </div>
      <div style={{ fontSize: 12, color: 'var(--ink-3)' }}>Income is drawn from fee receipts; expenses from paid payroll, approved expenses and billed purchase orders — the report reconciles to the underlying transactions.</div>
    </div>
  );
}
function Row({ label, value, color, bold, big }: { label: string; value: string; color?: string; bold?: boolean; big?: boolean }) {
  return <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '4px 0' }}><span style={{ fontSize: big ? 15 : 13.5, fontWeight: bold ? 700 : 400, color: 'var(--ink-2)' }}>{label}</span><span style={{ fontSize: big ? 20 : 14, fontWeight: bold ? 800 : 600, color: color ?? 'var(--ink-1)' }}>{value}</span></div>;
}
function MiniStat({ label, value, accent }: { label: string; value: number | string; accent?: string }) {
  return <div style={{ ...card, padding: 16 }}><div style={{ fontSize: 20, fontWeight: 800, color: accent }}>{value}</div><div style={{ fontSize: 12, color: 'var(--ink-3)' }}>{label}</div></div>;
}

// ================= Payroll =================
function PayrollTab() {
  const qc = useQueryClient();
  const { data: staff } = useQuery({ queryKey: ['erp-staff'], queryFn: async () => (await api.get<Staff[]>('/erp/staff')).data });
  const { data: runs } = useQuery({ queryKey: ['erp-runs'], queryFn: async () => (await api.get<PayrollRun[]>('/erp/payroll')).data });
  const [addStaff, setAddStaff] = useState(false);
  const [runModal, setRunModal] = useState(false);
  const [viewRun, setViewRun] = useState<string | null>(null);
  const refresh = () => { qc.invalidateQueries({ queryKey: ['erp-staff'] }); qc.invalidateQueries({ queryKey: ['erp-runs'] }); qc.invalidateQueries({ queryKey: ['erp-pnl'] }); qc.invalidateQueries({ queryKey: ['erp-stats'] }); };
  const delStaff = useMutation({ mutationFn: (id: string) => api.delete(`/erp/staff/${id}`), onSuccess: () => { refresh(); toast.success('Removed'); } });
  const payRun = useMutation({ mutationFn: (id: string) => api.post(`/erp/payroll/${id}/pay`), onSuccess: () => { refresh(); toast.success('Payroll marked paid — posted to ledger'); } });
  return (
    <div style={{ display: 'grid', gridTemplateColumns: '1.2fr 1fr', gap: 16, alignItems: 'start' }}>
      <div>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}><div style={{ fontWeight: 700, fontSize: 15 }}>Staff & salaries</div><button className="btn-secondary" style={{ height: 32, fontSize: 12 }} onClick={() => setAddStaff(true)}><Plus size={13} /> Staff</button></div>
        <div style={{ ...card, padding: 0, overflow: 'hidden' }}>
          {(staff ?? []).map((s, i) => (
            <div key={s.id} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 14px', borderTop: i ? '1px solid var(--line-soft)' : 'none' }}>
              <div style={{ flex: 1 }}><div style={{ fontWeight: 600, fontSize: 13.5 }}>{s.name}</div><div style={{ fontSize: 11.5, color: 'var(--ink-3)' }}>{s.role}</div></div>
              <div style={{ fontWeight: 700, fontSize: 13.5 }}>{money(s.monthlySalaryInr)}<span style={{ fontSize: 11, color: 'var(--ink-3)' }}>/mo</span></div>
              <button className="btn-secondary" style={{ height: 26, width: 26, padding: 0 }} onClick={() => delStaff.mutate(s.id)}><Trash2 size={12} /></button>
            </div>
          ))}
          {!(staff ?? []).length && <div style={{ padding: 24, textAlign: 'center', color: 'var(--ink-3)', fontSize: 13 }}>No staff yet.</div>}
        </div>
      </div>
      <div>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}><div style={{ fontWeight: 700, fontSize: 15 }}>Payroll runs</div><button className="btn-primary" style={{ height: 32, fontSize: 12 }} onClick={() => setRunModal(true)}><PlayCircle size={13} /> Run payroll</button></div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {(runs ?? []).map((r) => (
            <div key={r.id} style={{ ...card, padding: 14 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <div style={{ flex: 1 }}><div style={{ fontWeight: 700, fontSize: 14 }}>{r.period}</div><div style={{ fontSize: 11.5, color: 'var(--ink-3)' }}>{r._count?.payslips ?? 0} payslips · {money(r.totalInr)}</div></div>
                <span className="badge" style={{ background: r.status === 'PAID' ? 'var(--success-bg,#e6f4ea)' : 'var(--gold-bg,#fdf2e2)', color: r.status === 'PAID' ? 'var(--success,#1e874b)' : 'var(--gold,#c67c1e)' }}>{r.status}</span>
                <button className="btn-secondary" style={{ height: 28, fontSize: 12 }} onClick={() => setViewRun(r.id)}>Payslips</button>
                {r.status !== 'PAID' && <button className="btn-secondary" style={{ height: 28, fontSize: 12 }} onClick={() => payRun.mutate(r.id)}>Mark paid</button>}
              </div>
            </div>
          ))}
          {!(runs ?? []).length && <Empty text="No payroll runs yet." />}
        </div>
      </div>
      {addStaff && <StaffModal onClose={() => setAddStaff(false)} onDone={() => { setAddStaff(false); refresh(); }} />}
      {runModal && <RunModal onClose={() => setRunModal(false)} onDone={() => { setRunModal(false); refresh(); }} />}
      {viewRun && <PayslipsDrawer runId={viewRun} onClose={() => setViewRun(null)} />}
    </div>
  );
}
function StaffModal({ onClose, onDone }: { onClose: () => void; onDone: () => void }) {
  const { user } = useAuth();
  const roles = rolesFor(user?.organization?.vertical);
  const [f, setF] = useState({ name: '', role: roles[0], monthlySalaryInr: '', email: '' });
  const set = (k: string, v: string) => setF((s) => ({ ...s, [k]: v }));
  const create = useMutation({ mutationFn: () => api.post('/erp/staff', { name: f.name, role: f.role, monthlySalaryInr: Number(f.monthlySalaryInr) || 0, email: f.email || undefined }), onSuccess: () => { toast.success('Staff added'); onDone(); }, onError: (e) => toast.error(apiErrorMessage(e)) });
  return (
    <Overlay title="New staff member" onClose={onClose}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        <div style={{ display: 'flex', gap: 10 }}><div style={{ flex: 1 }}><label className="label">Name</label><input className="input" value={f.name} onChange={(e) => set('name', e.target.value)} /></div><div style={{ width: 150 }}><label className="label">Role</label><select className="input" value={f.role} onChange={(e) => set('role', e.target.value)}>{roles.map((r) => <option key={r}>{r}</option>)}</select></div></div>
        <div style={{ display: 'flex', gap: 10 }}><div style={{ flex: 1 }}><label className="label">Monthly salary</label><input className="input" type="number" value={f.monthlySalaryInr} onChange={(e) => set('monthlySalaryInr', e.target.value)} /></div><div style={{ flex: 1 }}><label className="label">Email</label><input className="input" value={f.email} onChange={(e) => set('email', e.target.value)} /></div></div>
      </div>
      <Actions onClose={onClose} disabled={!f.name || !f.monthlySalaryInr || create.isPending} onSubmit={() => create.mutate()} label="Add staff" />
    </Overlay>
  );
}
function RunModal({ onClose, onDone }: { onClose: () => void; onDone: () => void }) {
  const [period, setPeriod] = useState('');
  const create = useMutation({ mutationFn: () => api.post('/erp/payroll/run', { period }), onSuccess: (r: any) => { toast.success('Payroll processed'); onDone(); }, onError: (e) => toast.error(apiErrorMessage(e)) });
  return (
    <Overlay title="Run payroll" onClose={onClose}>
      <div><label className="label">Period</label><input className="input" value={period} onChange={(e) => setPeriod(e.target.value)} placeholder="Aug 2026" /></div>
      <div style={{ fontSize: 12, color: 'var(--ink-3)', marginTop: 8 }}>Generates a payslip for every active staff member.</div>
      <Actions onClose={onClose} disabled={!period || create.isPending} onSubmit={() => create.mutate()} label="Process payroll" />
    </Overlay>
  );
}
function PayslipsDrawer({ runId, onClose }: { runId: string; onClose: () => void }) {
  const { data } = useQuery({ queryKey: ['erp-run', runId], queryFn: async () => (await api.get<{ period: string; payslips: Payslip[] }>(`/erp/payroll/${runId}`)).data });
  return (
    <>
      <div onClick={onClose} style={{ position: 'fixed', inset: 0, zIndex: 60, background: 'rgba(20,15,12,.42)' }} />
      <div style={{ position: 'fixed', top: 0, right: 0, bottom: 0, zIndex: 61, width: 460, maxWidth: '100%', background: 'var(--surface)', borderLeft: '1px solid var(--line-soft)', overflowY: 'auto', padding: 22 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}><div style={{ fontWeight: 700, fontSize: 16 }}>Payslips — {data?.period}</div><button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--ink-3)' }}><X size={20} /></button></div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {(data?.payslips ?? []).map((p) => (
            <div key={p.id} style={{ ...card, padding: 12 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}><div style={{ fontWeight: 600, fontSize: 13.5 }}>{p.staffName}</div><div style={{ fontWeight: 800 }}>{money(p.netInr)}</div></div>
              <div style={{ fontSize: 11.5, color: 'var(--ink-3)', marginTop: 4 }}>Basic {money(p.basicInr)} + Allow {money(p.allowancesInr)} − Ded {money(p.deductionsInr)} · <b>{p.status}</b></div>
            </div>
          ))}
        </div>
      </div>
    </>
  );
}

// ================= Expenses =================
function ExpensesTab() {
  const qc = useQueryClient();
  const { data } = useQuery({ queryKey: ['erp-expenses'], queryFn: async () => (await api.get<Expense[]>('/erp/expenses')).data });
  const [add, setAdd] = useState(false);
  const [editExp, setEditExp] = useState<Expense | null>(null);
  const refresh = () => { qc.invalidateQueries({ queryKey: ['erp-expenses'] }); qc.invalidateQueries({ queryKey: ['erp-pnl'] }); qc.invalidateQueries({ queryKey: ['erp-stats'] }); };
  const status = useMutation({ mutationFn: ({ id, s }: { id: string; s: string }) => api.post(`/erp/expenses/${id}/status`, { status: s }), onSuccess: () => { refresh(); toast.success('Updated'); } });
  const del = useMutation({ mutationFn: (id: string) => api.delete(`/erp/expenses/${id}`), onSuccess: () => { refresh(); toast.success('Expense deleted'); }, onError: (e) => toast.error(apiErrorMessage(e)) });
  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 12 }}><button className="btn-primary" onClick={() => setAdd(true)}><Plus size={15} /> New expense</button></div>
      {!data?.length && <Empty text="No expenses yet." />}
      <div style={{ ...card, padding: 0, overflow: 'hidden' }}>
        {(data ?? []).map((e, i) => { const m = EXP_META[e.status]; return (
          <div key={e.id} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '12px 16px', borderTop: i ? '1px solid var(--line-soft)' : 'none' }}>
            <div style={{ flex: 1 }}><div style={{ fontWeight: 600, fontSize: 13.5 }}>{e.title}</div><div style={{ fontSize: 11.5, color: 'var(--ink-3)' }}>{e.category}{e.vendorName ? ` · ${e.vendorName}` : ''}</div></div>
            <div style={{ fontWeight: 700 }}>{money(e.amountInr)}</div>
            <span className="badge" style={{ background: m.bg, color: m.fg, minWidth: 68, justifyContent: 'center' }}>{e.status}</span>
            {e.status === 'PENDING' && <><button className="btn-secondary" style={{ height: 28, fontSize: 12 }} onClick={() => status.mutate({ id: e.id, s: 'APPROVED' })}><Check size={12} /> Approve</button><button className="btn-secondary" style={{ height: 28, width: 28, padding: 0 }} onClick={() => status.mutate({ id: e.id, s: 'REJECTED' })}><X size={13} /></button></>}
            {e.status === 'APPROVED' && <button className="btn-secondary" style={{ height: 28, fontSize: 12 }} onClick={() => status.mutate({ id: e.id, s: 'PAID' })}>Mark paid</button>}
            {e.status !== 'PAID' && <button className="btn-secondary" title="Edit" style={{ height: 28, width: 28, padding: 0 }} onClick={() => setEditExp(e)}><FileText size={13} /></button>}
            <button className="btn-secondary" title="Delete" style={{ height: 28, width: 28, padding: 0, color: 'var(--danger,#c0392b)' }} disabled={del.isPending} onClick={() => { if (confirm(`Delete "${e.title}" (${money(e.amountInr)})? Its ledger entry will be reversed.`)) del.mutate(e.id); }}><Trash2 size={13} /></button>
          </div>
        ); })}
      </div>
      {(add || editExp) && <ExpenseModal edit={editExp ?? undefined} onClose={() => { setAdd(false); setEditExp(null); }} onDone={() => { setAdd(false); setEditExp(null); refresh(); }} />}
    </div>
  );
}
function ExpenseModal({ onClose, onDone, edit }: { onClose: () => void; onDone: () => void; edit?: Expense }) {
  const [f, setF] = useState(edit
    ? { category: edit.category, title: edit.title, amountInr: String(edit.amountInr), vendorName: edit.vendorName ?? '' }
    : { category: 'General', title: '', amountInr: '', vendorName: '' });
  const set = (k: string, v: string) => setF((s) => ({ ...s, [k]: v }));
  const create = useMutation({
    mutationFn: () => {
      const body = { category: f.category, title: f.title, amountInr: Number(f.amountInr) || 0, vendorName: f.vendorName || undefined };
      return edit ? api.patch(`/erp/expenses/${edit.id}`, body) : api.post('/erp/expenses', body);
    },
    onSuccess: () => { toast.success(edit ? 'Expense updated' : 'Expense logged'); onDone(); }, onError: (e) => toast.error(apiErrorMessage(e)),
  });
  return (
    <Overlay title={edit ? 'Edit expense' : 'New expense'} onClose={onClose}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        <div><label className="label">Title</label><input className="input" value={f.title} onChange={(e) => set('title', e.target.value)} /></div>
        <div style={{ display: 'flex', gap: 10 }}><div style={{ flex: 1 }}><label className="label">Category</label><input className="input" value={f.category} onChange={(e) => set('category', e.target.value)} /></div><div style={{ width: 130 }}><label className="label">Amount</label><input className="input" type="number" value={f.amountInr} onChange={(e) => set('amountInr', e.target.value)} /></div></div>
        <div><label className="label">Vendor <span style={{ color: 'var(--ink-3)', fontWeight: 400 }}>(optional)</span></label><input className="input" value={f.vendorName} onChange={(e) => set('vendorName', e.target.value)} /></div>
      </div>
      <Actions onClose={onClose} disabled={!f.title || !f.amountInr || create.isPending} onSubmit={() => create.mutate()} label={edit ? 'Save changes' : 'Log expense'} />
    </Overlay>
  );
}

// ================= Procurement =================
function ProcurementTab() {
  const qc = useQueryClient();
  const { data: suppliers } = useQuery({ queryKey: ['erp-suppliers'], queryFn: async () => (await api.get<Supplier[]>('/erp/suppliers')).data });
  const { data: pos } = useQuery({ queryKey: ['erp-pos'], queryFn: async () => (await api.get<PurchaseOrder[]>('/erp/purchase-orders')).data });
  const [addSup, setAddSup] = useState(false);
  const [addPO, setAddPO] = useState(false);
  const refresh = () => { qc.invalidateQueries({ queryKey: ['erp-suppliers'] }); qc.invalidateQueries({ queryKey: ['erp-pos'] }); qc.invalidateQueries({ queryKey: ['erp-inventory'] }); qc.invalidateQueries({ queryKey: ['erp-pnl'] }); };
  const receive = useMutation({ mutationFn: (id: string) => api.post(`/erp/purchase-orders/${id}/receive`), onSuccess: () => { refresh(); toast.success('Received → added to inventory'); } });
  const bill = useMutation({ mutationFn: (id: string) => api.post(`/erp/purchase-orders/${id}/bill`), onSuccess: () => { refresh(); toast.success('Billed → posted to expenses'); } });
  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
        <div style={{ fontWeight: 700, fontSize: 15 }}>Purchase orders</div>
        <div style={{ display: 'flex', gap: 8 }}><button className="btn-secondary" onClick={() => setAddSup(true)}><Plus size={14} /> Supplier</button><button className="btn-primary" onClick={() => setAddPO(true)}><Plus size={14} /> New PO</button></div>
      </div>
      {!pos?.length && <Empty text="No purchase orders yet." />}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 18 }}>
        {(pos ?? []).map((po) => { const m = PO_META[po.status]; return (
          <div key={po.id} style={{ ...card, padding: 14 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <div style={{ flex: 1 }}><div style={{ fontWeight: 600, fontSize: 13.5 }}><span style={{ fontFamily: 'var(--mono)', fontSize: 12 }}>{po.number}</span> · {po.supplier?.name ?? po.supplierName}</div><div style={{ fontSize: 11.5, color: 'var(--ink-3)' }}>{po.items.length} items · {money(po.totalInr)}</div></div>
              <span className="badge" style={{ background: m.bg, color: m.fg }}>{po.status}</span>
              {po.status === 'ORDERED' && <button className="btn-secondary" style={{ height: 28, fontSize: 12 }} onClick={() => receive.mutate(po.id)}><PackageCheck size={12} /> Receive</button>}
              {po.status === 'RECEIVED' && <button className="btn-secondary" style={{ height: 28, fontSize: 12 }} onClick={() => bill.mutate(po.id)}><FileText size={12} /> Bill</button>}
            </div>
          </div>
        ); })}
      </div>
      <div style={{ fontWeight: 700, fontSize: 15, marginBottom: 10 }}>Suppliers</div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(220px,1fr))', gap: 10 }}>
        {(suppliers ?? []).map((s) => <div key={s.id} style={{ ...card, padding: 14 }}><div style={{ fontWeight: 600, fontSize: 13.5 }}>{s.name}</div><div style={{ fontSize: 11.5, color: 'var(--ink-3)' }}>{s.category} · {s._count?.procurementOrders ?? 0} POs{s.gstNo ? ` · Tax ${s.gstNo}` : ''}</div></div>)}
      </div>
      {addSup && <SupplierModal onClose={() => setAddSup(false)} onDone={() => { setAddSup(false); refresh(); }} />}
      {addPO && <PoModal suppliers={suppliers ?? []} onClose={() => setAddPO(false)} onDone={() => { setAddPO(false); refresh(); }} />}
    </div>
  );
}
function SupplierModal({ onClose, onDone }: { onClose: () => void; onDone: () => void }) {
  const [f, setF] = useState({ name: '', category: 'General', phone: '', gstNo: '' });
  const set = (k: string, v: string) => setF((s) => ({ ...s, [k]: v }));
  const create = useMutation({ mutationFn: () => api.post('/erp/suppliers', { name: f.name, category: f.category, phone: f.phone || undefined, gstNo: f.gstNo || undefined }), onSuccess: () => { toast.success('Supplier added'); onDone(); }, onError: (e) => toast.error(apiErrorMessage(e)) });
  return (
    <Overlay title="New supplier" onClose={onClose}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        <div style={{ display: 'flex', gap: 10 }}><div style={{ flex: 1 }}><label className="label">Name</label><input className="input" value={f.name} onChange={(e) => set('name', e.target.value)} /></div><div style={{ width: 130 }}><label className="label">Category</label><input className="input" value={f.category} onChange={(e) => set('category', e.target.value)} /></div></div>
        <div style={{ display: 'flex', gap: 10 }}><div style={{ flex: 1 }}><label className="label">Phone</label><input className="input" value={f.phone} onChange={(e) => set('phone', e.target.value)} /></div><div style={{ flex: 1 }}><label className="label">Tax reg. no.</label><input className="input" value={f.gstNo} onChange={(e) => set('gstNo', e.target.value)} /></div></div>
      </div>
      <Actions onClose={onClose} disabled={!f.name || create.isPending} onSubmit={() => create.mutate()} label="Add" />
    </Overlay>
  );
}
function PoModal({ suppliers, onClose, onDone }: { suppliers: Supplier[]; onClose: () => void; onDone: () => void }) {
  const [supplierId, setSupplierId] = useState('');
  const [items, setItems] = useState<{ name: string; qty: string; rateInr: string }[]>([{ name: '', qty: '1', rateInr: '' }]);
  const setItem = (i: number, patch: any) => setItems((x) => x.map((it, j) => j === i ? { ...it, ...patch } : it));
  const total = items.reduce((s, i) => s + (Number(i.qty) || 0) * (Number(i.rateInr) || 0), 0);
  const create = useMutation({ mutationFn: () => api.post('/erp/purchase-orders', { supplierId: supplierId || undefined, items: items.filter((i) => i.name).map((i) => ({ name: i.name, qty: Number(i.qty) || 0, rateInr: Number(i.rateInr) || 0 })) }), onSuccess: () => { toast.success('PO created'); onDone(); }, onError: (e) => toast.error(apiErrorMessage(e)) });
  return (
    <Overlay title="New purchase order" onClose={onClose}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        <div><label className="label">Supplier</label><select className="input" value={supplierId} onChange={(e) => setSupplierId(e.target.value)}><option value="">Select supplier…</option>{suppliers.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}</select></div>
        <div>
          <label className="label">Items · total {money(total)}</label>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            {items.map((it, i) => (
              <div key={i} style={{ display: 'flex', gap: 6 }}>
                <input className="input" style={{ flex: 1 }} value={it.name} onChange={(e) => setItem(i, { name: e.target.value })} placeholder="Item" />
                <input className="input" style={{ width: 60 }} type="number" value={it.qty} onChange={(e) => setItem(i, { qty: e.target.value })} placeholder="Qty" />
                <input className="input" style={{ width: 90 }} type="number" value={it.rateInr} onChange={(e) => setItem(i, { rateInr: e.target.value })} placeholder="Rate" />
                {items.length > 1 && <button onClick={() => setItems((x) => x.filter((_, j) => j !== i))} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--ink-3)' }}><X size={14} /></button>}
              </div>
            ))}
          </div>
          <button className="btn-secondary" style={{ height: 28, fontSize: 12, marginTop: 6 }} onClick={() => setItems((x) => [...x, { name: '', qty: '1', rateInr: '' }])}><Plus size={12} /> Item</button>
        </div>
      </div>
      <Actions onClose={onClose} disabled={total === 0 || create.isPending} onSubmit={() => create.mutate()} label="Create PO" />
    </Overlay>
  );
}

// ================= Inventory =================
function InventoryTab() {
  const qc = useQueryClient();
  const { data } = useQuery({ queryKey: ['erp-inventory'], queryFn: async () => (await api.get<StockItem[]>('/erp/inventory')).data });
  const [add, setAdd] = useState(false);
  const refresh = () => { qc.invalidateQueries({ queryKey: ['erp-inventory'] }); qc.invalidateQueries({ queryKey: ['erp-stats'] }); };
  const move = useMutation({ mutationFn: ({ id, type }: { id: string; type: string }) => api.post('/erp/inventory/move', { itemId: id, type, quantity: 1, reason: type === 'OUT' ? 'Issued' : 'Received' }), onSuccess: () => { refresh(); } });
  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 12 }}><button className="btn-primary" onClick={() => setAdd(true)}><Plus size={15} /> New item</button></div>
      {!data?.length && <Empty text="No inventory items. Receive a purchase order to stock up." />}
      <div style={{ ...card, padding: 0, overflow: 'hidden' }}>
        {(data ?? []).map((it, i) => { const low = it.minLevel > 0 && it.quantity <= it.minLevel; return (
          <div key={it.id} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '12px 16px', borderTop: i ? '1px solid var(--line-soft)' : 'none' }}>
            <div style={{ flex: 1 }}><div style={{ fontWeight: 600, fontSize: 13.5 }}>{it.name}</div><div style={{ fontSize: 11.5, color: 'var(--ink-3)' }}>{it.category} · min {it.minLevel}</div></div>
            {low && <span className="badge" style={{ background: 'var(--danger-bg,#fce8e8)', color: 'var(--danger,#c0392b)' }}>Low</span>}
            <div style={{ fontWeight: 800, fontSize: 15, minWidth: 48, textAlign: 'right', color: low ? 'var(--danger,#c0392b)' : 'var(--ink-1)' }}>{it.quantity}<span style={{ fontSize: 11, color: 'var(--ink-3)', fontWeight: 400 }}> {it.unit}</span></div>
            <button className="btn-secondary" style={{ height: 28, width: 28, padding: 0 }} title="Issue 1" onClick={() => move.mutate({ id: it.id, type: 'OUT' })}><ArrowUpFromLine size={13} /></button>
            <button className="btn-secondary" style={{ height: 28, width: 28, padding: 0 }} title="Receive 1" onClick={() => move.mutate({ id: it.id, type: 'IN' })}><ArrowDownToLine size={13} /></button>
          </div>
        ); })}
      </div>
      {add && <ItemModal onClose={() => setAdd(false)} onDone={() => { setAdd(false); refresh(); }} />}
    </div>
  );
}
function ItemModal({ onClose, onDone }: { onClose: () => void; onDone: () => void }) {
  const [f, setF] = useState({ name: '', category: 'General', unit: 'nos', quantity: '0', minLevel: '0' });
  const set = (k: string, v: string) => setF((s) => ({ ...s, [k]: v }));
  const create = useMutation({ mutationFn: () => api.post('/erp/inventory', { name: f.name, category: f.category, unit: f.unit, quantity: Number(f.quantity) || 0, minLevel: Number(f.minLevel) || 0 }), onSuccess: () => { toast.success('Item added'); onDone(); }, onError: (e) => toast.error(apiErrorMessage(e)) });
  return (
    <Overlay title="New inventory item" onClose={onClose}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        <div style={{ display: 'flex', gap: 10 }}><div style={{ flex: 1 }}><label className="label">Name</label><input className="input" value={f.name} onChange={(e) => set('name', e.target.value)} /></div><div style={{ width: 120 }}><label className="label">Category</label><select className="input" value={f.category} onChange={(e) => set('category', e.target.value)}>{['Library', 'Lab', 'Asset', 'General'].map((c) => <option key={c}>{c}</option>)}</select></div></div>
        <div style={{ display: 'flex', gap: 10 }}><div style={{ flex: 1 }}><label className="label">Quantity</label><input className="input" type="number" value={f.quantity} onChange={(e) => set('quantity', e.target.value)} /></div><div style={{ width: 90 }}><label className="label">Unit</label><input className="input" value={f.unit} onChange={(e) => set('unit', e.target.value)} /></div><div style={{ width: 100 }}><label className="label">Min level</label><input className="input" type="number" value={f.minLevel} onChange={(e) => set('minLevel', e.target.value)} /></div></div>
      </div>
      <Actions onClose={onClose} disabled={!f.name || create.isPending} onSubmit={() => create.mutate()} label="Add item" />
    </Overlay>
  );
}

// shared
function Empty({ text }: { text: string }) { return <div style={{ ...card, padding: 40, textAlign: 'center', color: 'var(--ink-3)', fontSize: 13.5 }}>{text}</div>; }
function Overlay({ title, children, onClose }: { title: string; children: React.ReactNode; onClose: () => void }) {
  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 62, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }}>
      <div style={{ position: 'absolute', inset: 0, background: 'rgba(20,15,12,.42)' }} onClick={onClose} />
      <div style={{ ...card, position: 'relative', zIndex: 1, width: 500, maxWidth: '100%', maxHeight: '92vh', overflowY: 'auto', padding: 22, borderRadius: 18 }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}><div style={{ fontWeight: 700, fontSize: 15 }}>{title}</div><button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--ink-3)' }}><X size={20} /></button></div>
        {children}
      </div>
    </div>
  );
}
function Actions({ onClose, onSubmit, disabled, label }: { onClose: () => void; onSubmit: () => void; disabled: boolean; label: string }) {
  return <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10, marginTop: 18 }}><button className="btn-secondary" onClick={onClose}>Cancel</button><button className="btn-primary" disabled={disabled} onClick={onSubmit}>{label}</button></div>;
}
