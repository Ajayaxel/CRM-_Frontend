import type { Tone } from './kit';

/**
 * Status → tone maps and the enum vocabularies the toolbars feed from. A
 * status never picks its colour at the render site — every screen asks here,
 * so BCH-0007's "PICKUP_DUE" is amber on every screen it appears on.
 */

export function toneForFarmStatus(s: string): Tone {
  switch (s) {
    case 'AVAILABLE': return 'active';
    case 'PLACED': return 'sales';
    case 'GROWING': return 'renewal';
    case 'PICKUP_DUE': return 'claim';
    case 'PICKED_UP': return 'info';
    case 'RESTING': return 'neutral';
    default: return 'neutral';
  }
}

export function toneForBatchStatus(s: string): Tone {
  switch (s) {
    case 'ACTIVE': return 'active';
    case 'PICKUP_DUE': return 'claim';
    case 'COMPLETED': return 'info';
    case 'CLOSED': return 'neutral';
    case 'CANCELLED': return 'expired';
    default: return 'neutral';
  }
}

export function toneForPaidStatus(s: string): Tone {
  switch (s) {
    case 'PAID': return 'active';
    case 'PARTIAL': return 'renewal';
    default: return 'expired';
  }
}

export function toneForDocStatus(s: string): Tone {
  switch (s) {
    case 'POSTED': return 'active';
    case 'APPROVED': return 'active';
    case 'SUBMITTED': return 'renewal';
    case 'DRAFT': return 'neutral';
    case 'REJECTED': return 'expired';
    default: return 'neutral';
  }
}

export function toneForAlertSeverity(s: string): Tone {
  switch (s) {
    case 'CRITICAL': return 'expired';
    case 'WARNING': return 'renewal';
    default: return 'info';
  }
}

export function toneForStallDayStatus(s: string): Tone {
  switch (s) {
    case 'OPEN': return 'sales';
    case 'CLOSED': return 'renewal';
    case 'FINALIZED': return 'active';
    default: return 'neutral';
  }
}

export function toneForFeedHealth(s: string): Tone {
  switch (s) {
    case 'OK': return 'active';
    case 'LOW': return 'renewal';
    case 'SHORTFALL': return 'expired';
    default: return 'neutral';
  }
}

export const FARM_STATUSES = ['AVAILABLE', 'PLACED', 'GROWING', 'PICKUP_DUE', 'PICKED_UP', 'RESTING', 'INACTIVE'] as const;
export const BATCH_STATUSES = ['ACTIVE', 'PICKUP_DUE', 'COMPLETED', 'CLOSED', 'CANCELLED'] as const;
export const FEED_STAGES = ['PRE_STARTER', 'STARTER', 'FINISHER'] as const;
export const PAY_MODES = ['CASH', 'BANK', 'UPI', 'CREDIT'] as const;
export const PAID_STATUSES = ['UNPAID', 'PARTIAL', 'PAID'] as const;
export const SUPPLIER_CATEGORIES = ['CHICK', 'FEED', 'MEDICINE', 'MATERIAL', 'OTHER'] as const;
export const INV_CATEGORIES = ['MEDICINE', 'VACCINE', 'MATERIAL', 'CONSUMABLE'] as const;
export const EXPENSE_GROUPS = ['VEHICLE', 'OFFICE', 'STAFF', 'OPERATIONS', 'OTHER'] as const;
export const COST_SCOPES = ['DIRECT', 'DIVISION', 'OVERHEAD'] as const;
export const DIVISIONS = ['INTEGRATION', 'SUPPLY', 'STALL'] as const;
export const STAFF_ROLES = ['SUPERVISOR', 'DRIVER', 'MANAGER', 'WORKER', 'OTHER'] as const;
export const WITHDRAWAL_KINDS = ['BUSINESS_EXPENSE', 'ADVANCE', 'OWNER_DRAWING'] as const;
export const ALLOC_METHODS = ['BIRD_COUNT', 'FARM_COUNT', 'EQUAL', 'MANUAL'] as const;
export const STALL_TXN_KINDS = ['INWARD', 'SALE', 'OUTWARD', 'WASTAGE', 'ADJUSTMENT', 'EXPENSE'] as const;

/** ₹ from a paise-per-unit rate for display (rates are fractional). */
export const paiseRate = (paise?: number | null) => `₹${((paise ?? 0) / 100).toFixed(2)}`;
