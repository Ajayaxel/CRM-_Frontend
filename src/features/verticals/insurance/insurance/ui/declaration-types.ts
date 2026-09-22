/**
 * Which declaration a product requires — the web side of the same rule.
 *
 * A deliberate mirror of `declarationTypeForCategory` in
 * apps/api/src/insurance/declaration-forms.ts, kept in step by
 * scripts/declaration-offline.ts, which reads both files and fails if the
 * category lists drift apart. Same arrangement as commission-split.
 *
 * It is duplicated rather than fetched because the screen needs it before any
 * request: it decides whether to offer the button at all, and a panel that has
 * to ask the server what it is cannot render until it has.
 *
 * The UI copy is NOT the authority. The server re-derives the type from the
 * category and refuses a mismatch, so the worst a stale bundle can do is offer
 * a button that then gets a clear refusal — never attach the wrong questions.
 */

export type DeclarationType = 'HEALTH' | 'MOTOR';

const HEALTH_CATEGORIES = ['HEALTH'];

// BIKE and the bare MOTOR are the legacy spellings still on the live book.
const MOTOR_CATEGORIES = ['MOTOR', 'PRIVATE_CAR', 'TWO_WHEELER', 'COMMERCIAL_VEHICLE', 'BIKE'];

export function declarationTypeForCategory(category?: string | null): DeclarationType | null {
  const c = String(category ?? '').toUpperCase();
  if (HEALTH_CATEGORIES.includes(c)) return 'HEALTH';
  if (MOTOR_CATEGORIES.includes(c)) return 'MOTOR';
  return null;
}

/** How each type is named on screen. */
export const DECLARATION_LABEL: Record<DeclarationType, string> = {
  HEALTH: 'Health declaration',
  MOTOR: 'Motor declaration',
};

/** The one-line reason the customer is being asked, per type. */
export const DECLARATION_WHY: Record<DeclarationType, string> = {
  HEALTH: 'Health cover needs the customer’s own account of their health before it is placed',
  MOTOR: 'Motor cover needs the customer’s own account of the vehicle and how it is used',
};

/** What the empty state should point at when there is nothing to declare against. */
export const DECLARATION_SUBJECT: Record<DeclarationType, string> = {
  HEALTH: 'health insurance',
  MOTOR: 'motor insurance',
};
