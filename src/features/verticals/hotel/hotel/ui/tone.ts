import type { Tone } from './kit';

/**
 * The five operational room states, and how each reads on a floor plan.
 *
 * These are the DERIVED states the API computes — the housekeeping enum in the
 * database has no OCCUPIED, because occupancy is a fact the reservations
 * already hold. The board renders what the server derived; it does not
 * re-derive it, so two screens cannot disagree about whether 203 is free.
 */
export const ROOM_TONE: Record<string, Tone> = {
  AVAILABLE: 'active',
  OCCUPIED: 'info',
  RESERVED: 'renewal',
  DIRTY: 'claim',
  OUT_OF_ORDER: 'expired',
};

export const ROOM_LABEL: Record<string, string> = {
  AVAILABLE: 'Available',
  OCCUPIED: 'Occupied',
  RESERVED: 'Reserved',
  DIRTY: 'Needs cleaning',
  OUT_OF_ORDER: 'Out of order',
};

export const RESERVATION_TONE: Record<string, Tone> = {
  CONFIRMED: 'renewal',
  CHECKED_IN: 'active',
  CHECKED_OUT: 'neutral',
  CANCELLED: 'expired',
  NO_SHOW: 'expired',
};
