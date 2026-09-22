export type FeeInvoiceStatus = 'DUE' | 'PARTIAL' | 'PAID' | 'OVERDUE' | 'CANCELLED';
export type ConcessionType = 'PERCENT' | 'FLAT';

export interface FeeStats { totalBilled: number; totalCollected: number; outstanding: number; overdueInvoices: number; receiptsTotal: number }
export interface FeeItem { name: string; amountInr: number }
export interface FeeHead { id: string; name: string }
export interface FeeStructure { id: string; name: string; totalInr: number; items: FeeItem[]; installments: number; courseId?: string | null; termId?: string | null; _count?: { studentFees: number } }
export interface Concession { id: string; name: string; type: ConcessionType; value: number }
export interface FeePayment { id: string; number: string; amountInr: number; method: string; paidAt: string; reference?: string | null }
export interface FeeInvoice { id: string; number: string; title: string; amountInr: number; paidInr: number; dueDate?: string | null; status: FeeInvoiceStatus; studentId: string; payments: FeePayment[] }

export const money = (n?: number | null) => '₹' + (n ?? 0).toLocaleString('en-IN');
export const STATUS_META: Record<FeeInvoiceStatus, { label: string; bg: string; fg: string }> = {
  DUE: { label: 'Due', bg: 'var(--surface-2)', fg: 'var(--ink-2)' },
  PARTIAL: { label: 'Partial', bg: 'var(--gold-bg,#fdf2e2)', fg: 'var(--gold,#c67c1e)' },
  PAID: { label: 'Paid', bg: 'var(--success-bg,#e6f4ea)', fg: 'var(--success,#1e874b)' },
  OVERDUE: { label: 'Overdue', bg: 'var(--danger-bg,#fce8e8)', fg: 'var(--danger,#c0392b)' },
  CANCELLED: { label: 'Cancelled', bg: 'var(--surface-2)', fg: 'var(--ink-3)' },
};
export const fmtDate = (s?: string | null) => s ? new Date(s).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }) : '—';
