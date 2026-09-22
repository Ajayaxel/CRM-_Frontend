export type SolarStage =
  | 'LEAD' | 'SURVEY' | 'DESIGN' | 'PROPOSAL' | 'WON' | 'PROCUREMENT'
  | 'INSTALLATION' | 'COMMISSIONING' | 'MONITORING' | 'AMC' | 'LOST';

export type MeteringType = 'NET' | 'GROSS' | 'NONE';

/** The lifecycle in order — the UI never offers a stage out of sequence (A4). */
export const STAGE_ORDER: SolarStage[] = [
  'LEAD', 'SURVEY', 'DESIGN', 'PROPOSAL', 'WON', 'PROCUREMENT', 'INSTALLATION', 'COMMISSIONING', 'MONITORING', 'AMC',
];
export const STAGE_LABEL: Record<SolarStage, string> = {
  LEAD: 'Lead', SURVEY: 'Site survey', DESIGN: 'Design', PROPOSAL: 'Proposal', WON: 'Won',
  PROCUREMENT: 'Procurement', INSTALLATION: 'Installation', COMMISSIONING: 'Commissioning',
  MONITORING: 'Monitoring', AMC: 'AMC', LOST: 'Lost',
};
export const METERING_LABEL: Record<MeteringType, string> = {
  NET: 'Net metering — export credited',
  GROSS: 'Gross metering — all output sold',
  NONE: 'No export — self-consumption only',
};

export interface SolarProject {
  id: string; code: string; customerName: string; phone?: string | null; email?: string | null;
  siteAddress?: string | null; city?: string | null; country: string; currency: string;
  stage: SolarStage; lostReason?: string | null;
  tariffMinorPerKwh: number; exportRateMinorPerKwh: number; metering: MeteringType;
  contractValueInr: number; subsidyInr: number; dealerPct: number;
  wonAt?: string | null; commissionedAt?: string | null; createdAt: string;
  _count?: { designs: number; proposals: number; tickets: number };
}

export interface SizingResult {
  annualConsumptionKwh: number; pshHours: number; performanceRatio: number;
  kwp: number; panelWattage: number; panelCount: number; panelAreaSqm: number;
  requiredAreaSqm: number; usableAreaSqm: number | null;
  inverterKw: number; dcAcRatio: number; inverterLoading: number;
  stringSize: number | null; batteryKwh: number;
  valid: boolean; errors: string[]; warnings: string[];
}
export interface BomLineOut {
  component: string; description: string; quantity: number; unit: string; unitRateInr: number; amountInr: number;
}
export interface BomResult {
  lines: BomLineOut[]; materialsInr: number; installInr: number; overheadInr: number; marginInr: number; systemCostInr: number;
}
export interface SavingsResult {
  annualGenerationKwh: number; selfConsumedKwh: number; exportedKwh: number; curtailedKwh: number;
  annualSavingsInr: number; netSystemCostInr: number; paybackMonths: number | null;
  lifetimeSavingsInr: number; co2OffsetKgPerYear: number; horizonYears: number;
  yearly: { year: number; generationKwh: number; savingsInr: number; cumulativeInr: number }[];
}
export interface SystemDesign {
  id: string; kwp: number; panelCount: number; panelWattage: number; inverterKw: number;
  requiredAreaSqm: number; batteryKwh: number; valid: boolean; validationNotes: string[];
  materialsInr: number; installInr: number; overheadInr: number; marginInr: number; systemCostInr: number;
  bom?: BomLineOut[];
}
export interface SolarStats {
  pipeline: Partial<Record<SolarStage, number>>;
  wonProjects: number; contractValueInr: number; commissioned: number; designedKwp: number;
  openTickets: number; openAlerts: number; overdueVisits: number;
}

export const fmtMoney = (n: number, currency = 'AED') =>
  `${currency} ${Math.round(n).toLocaleString('en-AE')}`;
export const fmtKwh = (n: number) => `${Math.round(n).toLocaleString('en-AE')} kWh`;
/** Payback reads better as "6 yr 4 mo" than as 76 months. */
export const fmtPayback = (months: number | null) => {
  if (months == null || months <= 0) return '—';
  const y = Math.floor(months / 12), m = months % 12;
  return y ? `${y} yr${m ? ` ${m} mo` : ''}` : `${m} mo`;
};
export const fmtDate = (s?: string | null) =>
  s ? new Date(s).toLocaleDateString('en-AE', { day: '2-digit', month: 'short', year: 'numeric' }) : '—';

// ---- E5–E10 ----
export type MaterialRequestStatus = 'DRAFT' | 'ALLOCATED' | 'SHORT' | 'ORDERED' | 'ISSUED';
export type WorkOrderStatus = 'SCHEDULED' | 'IN_PROGRESS' | 'COMPLETE';
export type MilestoneStatus = 'PENDING' | 'INVOICED' | 'PAID';

export interface MaterialRequestLine {
  id: string; component: string; description: string; requiredQty: number;
  allocatedQty: number; shortfallQty: number; unit: string; unitRateInr: number;
}
export interface MaterialRequest {
  id: string; status: MaterialRequestStatus; procurementOrderId?: string | null;
  issuedAt?: string | null; createdAt: string; lines: MaterialRequestLine[];
  supplierRef?: string | null; blAwbNumber?: string | null;
  etaDate?: string | null; customsClearedAt?: string | null;
}
export interface PanelLayout {
  columns: number; rows: number; placed: number; unplaced: number;
  rowLengthM: number; totalDepthM: number; rowCounts: number[]; notes: string[];
}
export interface ChecklistItem { id: string; label: string; done: boolean; note?: string | null; order: number }
export interface WorkOrder {
  id: string; title: string; teamName?: string | null; scheduledFor?: string | null;
  status: WorkOrderStatus; safetySignedBy?: string | null; report?: string | null;
  completedAt?: string | null; checklist: ChecklistItem[];
}
export interface Milestone {
  id: string; name: string; pct: number; amountInr: number; order: number;
  status: MilestoneStatus; invoiceId?: string | null; invoicedAt?: string | null;
}
export interface Profitability {
  contractValueInr: number; invoicedInr: number; collectedInr: number; outstandingInr: number;
  billedPct: number; materialCostInr: number; labourInr: number; overheadInr: number;
  commissionInr: number; costInr: number;
  expectedProfitInr: number; expectedMarginPct: number | null;
  billedProfitInr: number; revenueInr: number;
}
export const MR_STATUS_LABEL: Record<MaterialRequestStatus, string> = {
  DRAFT: 'Draft', ALLOCATED: 'Covered from stock', SHORT: 'Short', ORDERED: 'On order', ISSUED: 'Issued',
};

export interface SolarFaultEvent {
  id: string;
  projectId: string;
  faultType: 'INVERTER_DOWN' | 'UNDERPERFORMANCE' | 'STRING_FAULT' | 'BATTERY_DEGRADE' | 'OVERHEAT' | 'COMMS_FAILURE';
  severity: 'HIGH' | 'MEDIUM' | 'LOW';
  status: 'OPEN' | 'RESOLVED';
  firstSeenAt: string;
  lastSeenAt: string;
  resolvedAt?: string | null;
  serviceTicketId?: string | null;
  detail?: string | null;
}

export interface SolarSubscriptionPlan {
  id: string;
  name: string;
  price: number;
  currency: string;
  cycle: 'MONTHLY' | 'QUARTERLY' | 'YEARLY';
  covers?: string[];
  active: boolean;
}

export interface SolarSubscription {
  id: string;
  customerId: string;
  projectId?: string | null;
  planId: string;
  plan?: SolarSubscriptionPlan;
  startDate: string;
  nextBillingDate: string;
  status: 'ACTIVE' | 'PAUSED' | 'CANCELLED' | 'SUSPENDED';
  autoCharge: boolean;
  gracePeriodDays: number;
  invoices?: SolarSubscriptionInvoice[];
}

export interface SolarSubscriptionInvoice {
  id: string;
  subscriptionId: string;
  period: string;
  amount: number;
  taxAmount: number;
  currency: string;
  status: 'DRAFT' | 'ISSUED' | 'PAID' | 'OVERDUE' | 'VOID';
  dueDate: string;
  paidAt?: string | null;
}

