import type { Tone } from './kit';

/**
 * Status → colour, in one place.
 *
 * The console has eight booking statuses, seven membership statuses and six
 * renewal statuses, and every screen shows some of them. Mapping each one where
 * it is rendered is how a CANCELLED booking ends up green on one screen and red
 * on another.
 */

export function toneForSpaceStatus(status?: string): Tone {
  switch ((status ?? '').toUpperCase()) {
    case 'AVAILABLE': return 'active';
    case 'OCCUPIED': return 'sales';
    case 'RESERVED': return 'renewal';
    case 'MAINTENANCE': return 'claim';
    case 'BLOCKED': return 'expired';
    default: return 'neutral';
  }
}

export function toneForBookingStatus(status?: string): Tone {
  switch ((status ?? '').toUpperCase()) {
    case 'CONFIRMED': return 'info';
    case 'CHECKED_IN': return 'sales';
    case 'COMPLETED': return 'active';
    case 'PENDING': return 'renewal';
    case 'DRAFT': return 'neutral';
    case 'CANCELLED':
    case 'NO_SHOW':
    case 'EXPIRED': return 'expired';
    default: return 'neutral';
  }
}

export function toneForMembershipStatus(status?: string): Tone {
  switch ((status ?? '').toUpperCase()) {
    case 'ACTIVE': return 'active';
    case 'EXPIRING': return 'renewal';
    case 'PENDING':
    case 'DRAFT': return 'info';
    case 'SUSPENDED': return 'claim';
    case 'EXPIRED':
    case 'CANCELLED': return 'expired';
    default: return 'neutral';
  }
}

export function toneForRenewalStatus(status?: string): Tone {
  switch ((status ?? '').toUpperCase()) {
    case 'RENEWED': return 'active';
    case 'DUE': return 'claim';
    case 'IN_PROGRESS': return 'sales';
    case 'UPCOMING': return 'renewal';
    case 'EXPIRED':
    case 'CANCELLED': return 'expired';
    default: return 'neutral';
  }
}

export function toneForInvoiceStatus(status?: string): Tone {
  switch ((status ?? '').toUpperCase()) {
    case 'PAID': return 'active';
    case 'PARTIAL': return 'renewal';
    case 'SENT': return 'info';
    case 'OVERDUE': return 'expired';
    case 'REFUNDED': return 'claim';
    default: return 'neutral';
  }
}

export function toneForQuotationStatus(status?: string): Tone {
  switch ((status ?? '').toUpperCase()) {
    case 'ACCEPTED': return 'active';
    case 'SENT': return 'info';
    case 'VIEWED': return 'sales';
    case 'DRAFT': return 'neutral';
    case 'REJECTED':
    case 'EXPIRED': return 'expired';
    default: return 'neutral';
  }
}

export function toneForContractStatus(status?: string): Tone {
  switch ((status ?? '').toUpperCase()) {
    case 'ACTIVE': return 'active';
    case 'EXPIRING': return 'renewal';
    case 'PENDING_SIGNATURE': return 'claim';
    case 'DRAFT': return 'neutral';
    case 'EXPIRED':
    case 'TERMINATED': return 'expired';
    default: return 'neutral';
  }
}

export function toneForVisitStatus(status?: string): Tone {
  switch ((status ?? '').toUpperCase()) {
    case 'COMPLETED':
    case 'CHECKED_OUT': return 'active';
    case 'CONFIRMED':
    case 'CHECKED_IN': return 'sales';
    case 'SCHEDULED':
    case 'EXPECTED': return 'info';
    case 'RESCHEDULED': return 'renewal';
    case 'CANCELLED':
    case 'NO_SHOW': return 'expired';
    default: return 'neutral';
  }
}

/** The space-type vocabulary, in the operator's words rather than the enum's. */
export const SPACE_TYPES = [
  'HOT_DESK', 'DEDICATED_DESK', 'PRIVATE_OFFICE', 'CABIN', 'MEETING_ROOM',
  'CONFERENCE_ROOM', 'TRAINING_ROOM', 'EVENT_SPACE', 'VIRTUAL_OFFICE', 'DAY_PASS', 'CUSTOM',
] as const;

export const SPACE_TYPE_LABEL: Record<string, string> = {
  HOT_DESK: 'Hot desk', DEDICATED_DESK: 'Dedicated desk', PRIVATE_OFFICE: 'Private office',
  CABIN: 'Cabin', MEETING_ROOM: 'Meeting room', CONFERENCE_ROOM: 'Conference room',
  TRAINING_ROOM: 'Training room', EVENT_SPACE: 'Event space', VIRTUAL_OFFICE: 'Virtual office',
  DAY_PASS: 'Day pass', CUSTOM: 'Custom',
};

export const SPACE_STATUSES = ['AVAILABLE', 'OCCUPIED', 'RESERVED', 'MAINTENANCE', 'BLOCKED', 'INACTIVE'] as const;
export const BOOKING_STATUSES = ['DRAFT', 'PENDING', 'CONFIRMED', 'CHECKED_IN', 'COMPLETED', 'CANCELLED', 'NO_SHOW', 'EXPIRED'] as const;
export const BOOKING_MODES = ['HOURLY', 'HALF_DAY', 'FULL_DAY', 'DAILY', 'WEEKLY', 'MONTHLY', 'DAY_PASS', 'CUSTOM'] as const;
export const PLAN_TYPES = ['HOT_DESK', 'DEDICATED_DESK', 'PRIVATE_OFFICE', 'VIRTUAL_OFFICE', 'MEETING_ROOM', 'DAY_PASS', 'WEEKLY', 'MONTHLY', 'QUARTERLY', 'ANNUAL', 'CUSTOM'] as const;
export const BILLING_CYCLES = ['ONE_TIME', 'DAILY', 'WEEKLY', 'MONTHLY', 'QUARTERLY', 'HALF_YEARLY', 'ANNUAL', 'CUSTOM'] as const;
export const LEAD_SOURCES = ['WEBSITE', 'WHATSAPP', 'PHONE', 'WALK_IN', 'FACEBOOK', 'INSTAGRAM', 'LINKEDIN', 'GOOGLE', 'REFERRAL', 'PARTNER', 'OTHER'] as const;
export const SERVICE_UNITS = ['FLAT', 'PER_UNIT', 'PER_HOUR', 'PER_DAY', 'PER_MONTH', 'PER_PAGE', 'PER_PERSON'] as const;

/** The amenities most operators start from. Free text is still accepted. */
export const COMMON_AMENITIES = [
  'Wi-Fi', 'Air conditioning', 'Projector', 'TV screen', 'Whiteboard', 'Video conferencing',
  'Phone booth', 'Standing desk', 'Ergonomic chair', 'Natural light', 'Lockable', 'Storage',
  'Printer access', 'Tea & coffee', 'Water dispenser', 'Parking', 'Wheelchair accessible',
] as const;

export const spaceTypeLabel = (t?: string | null, custom?: string | null) =>
  t === 'CUSTOM' ? custom || 'Custom' : SPACE_TYPE_LABEL[t ?? ''] ?? (t ?? '');
