/**
 * What a stay will cost, shown before it is taken.
 *
 * These rates MIRROR the server's — ROOM_GST_PCT and ROOM_SERVICE_CHARGE_PCT in
 * finance/hotel-folio.service.ts, which is what actually posts the nights. They
 * are duplicated here only so a receptionist can quote a total at the counter
 * without a round trip, and the pair must move together: if the server's rates
 * become per-property configuration, this estimate has to read them from the
 * API rather than keep its own copy.
 */
export const GST_PCT = 18;
export const ROOM_GST_PCT = GST_PCT;
export const SERVICE_PCT = 10;

export interface StayEstimate {
  nights: number;
  roomInr: number;
  gstInr: number;
  serviceInr: number;
  totalInr: number;
}

/** Nights between two ISO dates, floored at one — a same-day stay is a night. */
export function nightsBetween(from: string, to: string): number {
  if (!from || !to) return 0;
  const a = new Date(from);
  const b = new Date(to);
  if (Number.isNaN(a.getTime()) || Number.isNaN(b.getTime()) || b <= a) return 0;
  return Math.max(1, Math.round((b.getTime() - a.getTime()) / 86_400_000));
}

export function estimateStay(nightlyInr: number, nights: number): StayEstimate {
  const roomInr = nightlyInr * nights;
  // Charged on the room rate, not on rate + service — matching the server, so
  // the quote and the folio agree to the rupee.
  const gstInr = Math.round(nightlyInr * (GST_PCT / 100)) * nights;
  const serviceInr = Math.round(nightlyInr * (SERVICE_PCT / 100)) * nights;
  return { nights, roomInr, gstInr, serviceInr, totalInr: roomInr + gstInr + serviceInr };
}
