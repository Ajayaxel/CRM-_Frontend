export type { HotelCategory, HotelPropertyRow } from './hooks/use-hotel-property';

/** Shapes the hospitality API returns. Kept in one file so screens agree. */

export type RoomOperationalStatus = 'AVAILABLE' | 'OCCUPIED' | 'RESERVED' | 'DIRTY' | 'OUT_OF_ORDER';
export type HousekeepingStatus = 'CLEAN' | 'DIRTY' | 'INSPECTED' | 'OUT_OF_ORDER';

export interface RoomRow {
  id: string;
  propertyId: string;
  roomNumber: string;
  floor: string | null;
  /** The housekeeping enum as stored. */
  status: HousekeepingStatus;
  housekeepingStatus: HousekeepingStatus;
  /** Derived on the server from reservations + housekeeping. Never stored. */
  derivedStatus: RoomOperationalStatus;
  category: { id: string; name: string; basePriceInr: number; capacity: number } | null;
  reservation: {
    id: string; status: string; guestName: string;
    checkInDate: string; checkOutDate: string;
  } | null;
}

export interface ReservationRow {
  id: string;
  status: 'CONFIRMED' | 'CHECKED_IN' | 'CHECKED_OUT' | 'CANCELLED' | 'NO_SHOW';
  checkInDate: string;
  checkOutDate: string;
  totalPriceInr: number;
  amountPaidInr: number;
  propertyId: string;
  guest: { id: string; firstName: string; lastName: string | null; phone: string | null; email: string | null };
  category: { id: string; name: string; basePriceInr: number } | null;
  room: { id: string; roomNumber: string } | null;
}

export interface ReceptionBoard {
  rooms: {
    total: number; available: number; occupied: number;
    reserved: number; dirty: number; outOfOrder: number;
    board: RoomRow[];
  };
  arrivals: ReservationRow[];
  departures: ReservationRow[];
  inHouse: ReservationRow[];
  upcoming: ReservationRow[];
  collection: { totalInr: number; byMethod: Record<string, number> };
}

export interface FolioCharge {
  lineId: string;
  chargeId: string | null;
  type: string;
  description: string;
  quantity: number;
  unitPriceInr: number;
  amountInr: number;
  voidable: boolean;
  voided: boolean;
}

export interface FolioView {
  folio: {
    id: string; number: string; status: string;
    subtotalInr: number; vatInr: number;
    cgstInr: number; sgstInr: number; igstInr: number;
    totalInr: number; amountPaidInr: number;
    hotelReservationId: string | null; propertyId: string | null;
    customerName: string;
  } | null;
  charges: FolioCharge[];
  payments: { id: string; amountInr: number; method: string; reference: string | null; note: string | null; paidAt: string }[];
  totalChargesInr: number;
  totalPaymentsInr: number;
  /**
   * The POSTED balance — charges actually on the folio, less payments. This is
   * ledger truth and stays that way; it is deliberately not the estimate.
   */
  balanceInr: number;

  // What is on the books.
  postedChargesInr: number;
  postedBalanceInr: number;

  // What the guest will owe. Projected on read, posted nowhere: room nights are
  // recognised at checkout, so mid-stay the posted balance can honestly read
  // ₹250 while the stay is three nights into ₹2,560.
  unpostedNights: number;
  estimatedAccommodationInr: number;
  estimatedTotalInr: number;
  estimatedBalanceInr: number;
}

export interface AvailabilityResult {
  from: string; to: string; nights: number;
  totalRooms: number; availableRooms: number;
  rooms: RoomRow[];
  /**
   * True when the stay starts today, so rooms awaiting housekeeping were held
   * back. Lets the picker explain a missing room instead of just omitting it.
   */
  excludesUncleanedRooms: boolean;
}
