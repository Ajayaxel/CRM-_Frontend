import { cur, orgLocale } from '@/lib/org-locale';
import { rstNum } from '../restaurant-client';
/**
 * Cart totals — a client-side PREVIEW that mirrors the server exactly.
 *
 * The server is authoritative (`computeOrderTotals` in order-rules.ts); this
 * exists so the cart can show a running total before the write. It therefore
 * has to reproduce two rules that a "cleaner" implementation gets wrong, and
 * both are deliberate on the server side:
 *
 *  1. TAX IS COMPUTED ON THE UNDISCOUNTED SUBTOTAL, then the discount is
 *     subtracted. A discount does not reduce the tax charged.
 *  2. A PERCENTAGE discount is rounded to 2dp; a FLAT one is NOT. A flat
 *     discount of 10.005 subtracts 10.005 and only the final total rounds.
 *
 * If these drift from the server, the number on the screen stops matching the
 * number on the receipt — which is the one discrepancy a till cannot have.
 */

export interface CartLine { id: string; name: string; quantity: number; price: number }
export interface DiscountLike { discount_type: 'percentage' | 'amount' | string; value: number }

const round2 = (v: number) => Math.round(v * 100) / 100;

export function computeTotals(
  items: CartLine[],
  taxRatePercent: number,
  discount?: DiscountLike | null,
): { subtotal: number; taxAmount: number; discountAmount: number; total: number } {
  let subtotal = 0;
  // `rstNum`, not `Number`: a decimal that arrives malformed gives NaN through
  // `Number` and poisons every figure downstream, where `rstNum` floors it at 0.
  // The line types say `number`, but these values originate at the wire.
  for (const i of items) subtotal += rstNum(i.price) * rstNum(i.quantity);

  // Rule 1 — on the UNDISCOUNTED subtotal.
  const taxAmount = round2(subtotal * (taxRatePercent / 100));

  // Rule 2 — percentage rounds, flat does not.
  let discountAmount = 0;
  if (discount) {
    discountAmount = discount.discount_type === 'percentage'
      ? round2(subtotal * (rstNum(discount.value) / 100))
      : rstNum(discount.value);
  }

  return { subtotal, taxAmount, discountAmount, total: round2(subtotal + taxAmount - discountAmount) };
}

/**
 * A price, with its minor units intact.
 *
 * `fmtOrgMoney` and `fmtOrgMoneyExact` both `Math.round`, which is right for a
 * headline tile and a ledger balance and wrong for a PRICE: a menu item costing
 * 3.50 rendered as "₹4", and a customer reading that is being told the wrong
 * number. The rounding was found on the menu list during the screen walk.
 *
 * The currency and locale still come from the org — never a hardcoded symbol,
 * for the same reason the rest of this feature does not format money itself.
 * Two decimals rather than the currency's real minor-unit count: every currency
 * this platform carries today uses two, and guessing for one that does not
 * would be a worse error than the rounding this replaces.
 */
export function rstPrice(v: unknown): string {
  const n = typeof v === 'number' ? v : Number(v);
  if (v == null || !Number.isFinite(n)) return '—';
  const { currency, locale } = orgLocale();
  const body = Math.abs(n).toLocaleString(
    locale || (currency === 'INR' ? 'en-IN' : 'en-AE'),
    { minimumFractionDigits: 2, maximumFractionDigits: 2 },
  );
  const sym = cur();
  const sign = n < 0 ? '-' : '';
  return sym === currency ? `${sign}${currency} ${body}` : `${sign}${sym}${body}`;
}
