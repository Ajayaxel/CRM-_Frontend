/**
 * KDS types and status vocabulary, shared by the two boards.
 *
 * TWO SURFACES, TWO VOCABULARIES, ONE COLUMN — RST-PARITY-005 → B.
 *
 * `orders.kitchen_status` is written by both source surfaces with different
 * strings. The port stores the captain's five and maps the web's three onto
 * them, so neither client loses a state it can reach:
 *
 *   stored (canonical)   new | preparing | ready | accepted | dispatched
 *   web KDS wire         pending | cooking | completed
 *
 * The API does the translating — `/restaurant/kitchen-view` answers the web
 * vocabulary, `/restaurant/captain/kds` answers the canonical one — so each
 * board here speaks only its own and neither translates. That is deliberate: a
 * second mapping in the client is exactly how the two would drift apart again.
 *
 * The web board cannot see `accepted` or `dispatched` (RST_WEB_KDS_VISIBLE is
 * new|preparing|ready). That is not an oversight to fix in the UI — the source
 * web KDS could never render them either, and the collapse to `completed` is
 * lossy by decision.
 */

/** What `/restaurant/captain/kds` puts on the wire. */
export const CAPTAIN_KDS_STATUSES = ['new', 'preparing', 'ready', 'accepted', 'dispatched'] as const;
export type CaptainKdsStatus = (typeof CAPTAIN_KDS_STATUSES)[number];

/** What `/restaurant/kitchen-view` puts on the wire. */
export const WEB_KDS_STATUSES = ['pending', 'cooking', 'completed'] as const;
export type WebKdsStatus = (typeof WEB_KDS_STATUSES)[number];

export interface KdsItem {
  id: string;
  name: string;
  quantity: number;
  /** A NEGATIVE source quantity is a cancellation instruction, not negative food. */
  status: 'added' | 'cancelled';
  /** True only for positive lines on a follow-up docket — never the opening one. */
  is_new: boolean;
  kot_number: string;
  kot_time: string | null;
  kot_status: string | null;
  note: string | null;
}

export interface KdsTicket {
  id: string;
  number: string | null;
  time: string | null;
  type: string | null;
  table: string | null;
  status: string;
  branch_id: string | null;
  items: KdsItem[];
  notes: string | null;
}

interface StatusStyle { label: string; fg: string; bg: string }

const STYLE: Record<string, StatusStyle> = {
  // canonical / captain
  new: { label: 'New', fg: 'var(--rst-brand)', bg: 'var(--rst-brand-tint)' },
  preparing: { label: 'Preparing', fg: 'var(--rst-warn)', bg: 'var(--rst-warn-tint)' },
  ready: { label: 'Ready', fg: 'var(--rst-info)', bg: 'var(--rst-info-tint)' },
  accepted: { label: 'Accepted', fg: 'var(--rst-good)', bg: 'var(--rst-good-tint)' },
  dispatched: { label: 'Dispatched', fg: 'var(--rst-good)', bg: 'var(--rst-good-tint-strong)' },
  // web wire
  pending: { label: 'Pending', fg: 'var(--rst-brand)', bg: 'var(--rst-brand-tint)' },
  cooking: { label: 'Cooking', fg: 'var(--rst-warn)', bg: 'var(--rst-warn-tint)' },
  completed: { label: 'Completed', fg: 'var(--rst-good)', bg: 'var(--rst-good-tint)' },
};

export function kdsStatus(raw?: string | null): StatusStyle {
  if (!raw) return { label: 'Unknown', fg: 'var(--rst-ink-2)', bg: 'var(--rst-surface-2)' };
  return STYLE[raw.toLowerCase()] ?? { label: raw, fg: 'var(--rst-ink-2)', bg: 'var(--rst-surface-2)' };
}

/**
 * The next step a ticket can take, per surface. Returning null means the board
 * offers no action — the captain board ends at `dispatched`, and the web board
 * ends at `completed` because it cannot express anything past it.
 */
export function nextWebStatus(current: string): WebKdsStatus | null {
  const s = current.toLowerCase();
  if (s === 'pending') return 'cooking';
  if (s === 'cooking') return 'completed';
  return null;
}

export function nextCaptainStatus(current: string): CaptainKdsStatus | null {
  const s = current.toLowerCase();
  if (s === 'new') return 'preparing';
  if (s === 'preparing') return 'ready';
  if (s === 'ready') return 'accepted';
  return null; // `dispatched` is reached by its own endpoint, not by /status
}

export const WEB_ACTION_LABEL: Record<string, string> = {
  cooking: 'Start cooking',
  completed: 'Mark done',
};

export const CAPTAIN_ACTION_LABEL: Record<string, string> = {
  preparing: 'Start cooking',
  ready: 'Mark ready',
  accepted: 'Accept order',
};
