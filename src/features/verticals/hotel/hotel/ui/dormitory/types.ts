/** Shapes the dormitory endpoints return. Kept beside the components that read them. */

export type BedspaceStatus =
  | 'available' | 'occupied' | 'reserved' | 'needs_cleaning' | 'out_of_order';

export interface Bedspace {
  id: string;
  /** "1-TOP", "4-BOTTOM" — the mattress, which is the unit of sale. */
  code: string;
  tier: 'TOP' | 'BOTTOM';
  status: BedspaceStatus;
  selectable: boolean;
  guestName: string | null;
  /** Why housekeeping flagged it, when they did. */
  note?: string | null;
}

export interface Bunk {
  id: string;
  number: number;
  top?: Bedspace | null;
  bottom?: Bedspace | null;
}

export interface DormitoryRow {
  id: string;
  roomNumber: string;
  floor: string | null;
  name: string;
  capacity: number;
  bunks: number;
  nightlyInr: number;
  categoryId: string;
  categoryName: string;
  housekeepingStatus: string;
}

export interface BedspaceBoard {
  dormitory: {
    id: string; roomNumber: string; name: string; categoryName: string;
    floor: string | null; capacity: number; bunkCount: number;
    nightlyInr: number; propertyName: string;
  };
  window: { from: string; to: string; nights: number };
  bunks: Bunk[];
  totals: { total: number; available: number };
}
