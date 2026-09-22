export interface ErpStats { staff: number; monthlyPayroll: number; pendingExpenses: number; lowStock: number; openPOs: number }
export interface Pnl { income: { feeCollection: number; total: number }; expense: { payroll: number; expenses: number; procurement: number; total: number }; netProfit: number }
export interface Staff { id: string; name: string; role: string; monthlySalaryInr: number; active: boolean; email?: string | null; phone?: string | null }
export interface PayrollRun { id: string; period: string; status: string; totalInr: number; _count?: { payslips: number } }
export interface Payslip { id: string; staffName: string; role?: string | null; basicInr: number; allowancesInr: number; deductionsInr: number; netInr: number; status: string }
export interface Expense { id: string; category: string; title: string; amountInr: number; vendorName?: string | null; status: string; spentAt: string }
export interface Supplier { id: string; name: string; category: string; phone?: string | null; gstNo?: string | null; _count?: { procurementOrders: number } }
export interface POItem { name: string; qty: number; rateInr: number; amountInr: number }
export interface PurchaseOrder { id: string; number: string; supplierName?: string | null; items: POItem[]; totalInr: number; status: string; supplier?: { name: string } | null }
export interface StockItem { id: string; name: string; category: string; unit: string; quantity: number; minLevel: number }

import { fmtOrgMoney } from '@/lib/org-locale';
export const money = (n?: number | null) => fmtOrgMoney(n ?? 0);
export const EXP_META: Record<string, { bg: string; fg: string }> = {
  PENDING: { bg: 'var(--surface-2)', fg: 'var(--ink-2)' }, APPROVED: { bg: 'color-mix(in srgb, var(--brand,#132376) 12%, var(--surface))', fg: 'var(--brand,#132376)' },
  PAID: { bg: 'var(--success-bg,#e6f4ea)', fg: 'var(--success,#1e874b)' }, REJECTED: { bg: 'var(--danger-bg,#fce8e8)', fg: 'var(--danger,#c0392b)' },
};
export const PO_META: Record<string, { bg: string; fg: string }> = {
  DRAFT: { bg: 'var(--surface-2)', fg: 'var(--ink-3)' }, ORDERED: { bg: 'var(--gold-bg,#fdf2e2)', fg: 'var(--gold,#c67c1e)' },
  RECEIVED: { bg: 'color-mix(in srgb, var(--brand,#132376) 12%, var(--surface))', fg: 'var(--brand,#132376)' }, BILLED: { bg: 'var(--success-bg,#e6f4ea)', fg: 'var(--success,#1e874b)' }, CANCELLED: { bg: 'var(--surface-2)', fg: 'var(--ink-3)' },
};
