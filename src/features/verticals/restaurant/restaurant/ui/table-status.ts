/**
 * The one place table status is interpreted, shared by both table surfaces.
 *
 * `cleaning` IS part of the vocabulary — RST-PARITY-021.
 *
 * It was not, until 2026-08-25. `TableStatusConsts::LIST` came across from the
 * source POS as available|reserved|occupied|inactive, which left the designs
 * unbuildable: Cleaning is one of three legend entries on the captain floor and
 * tints roughly a third of the grid, and without it a table being reset looks
 * exactly like one ready to seat — the single question that view exists to
 * answer at a glance. It was added to RST_TABLE_STATUSES with the divergence
 * recorded, and it is now storable, filterable and settable like any other.
 *
 * The remaining asymmetry is the other direction and is NOT a bug: `reserved`
 * and `inactive` are real, storable states that appear in no frame. They are
 * offered here anyway, because a state the API accepts and the UI hides is how
 * rows appear that no screen can explain.
 *
 * Colours come from the frames. The two surfaces use them differently and both
 * are honoured: the console tints the LABEL over a neutral card, the captain
 * grid tints the WHOLE CARD so a waiter can read the room at arm's length.
 */

/** Mirrors RST_TABLE_STATUSES in apps/api/src/restaurant/common/rst-vocabularies.ts. */
export const RST_TABLE_STATUSES = ['available', 'reserved', 'occupied', 'inactive', 'cleaning'] as const;
export type RstTableStatus = (typeof RST_TABLE_STATUSES)[number];

export interface TableStatusStyle {
  /** Sentence-case label, as the frames write it. */
  label: string;
  /** Badge/label colour — the console surface. */
  fg: string;
  /** Whole-card fill — the captain surface. */
  card: string;
  /** True for the states the API accepts, so forms and filters can offer them. */
  selectable: boolean;
}

const STYLE: Record<string, TableStatusStyle> = {
  // Design: grey card, green label. Both taken from the frames.
  available: { label: 'Available', fg: 'var(--rst-good)', card: 'var(--rst-table-available)', selectable: true },
  // Design: salmon card, brand-red label.
  occupied: { label: 'Occupied', fg: 'var(--rst-brand)', card: 'var(--rst-table-occupied)', selectable: true },
  // Real, but absent from every frame — so it has no design colour and takes the
  // file's own warning tone rather than a colour invented for it.
  reserved: { label: 'Reserved', fg: 'var(--rst-warn)', card: 'var(--rst-warn-tint)', selectable: true },
  // Likewise absent. A table switched off is not an alert, so it reads as muted.
  inactive: { label: 'Inactive', fg: 'var(--rst-ink-2)', card: 'var(--rst-surface-2)', selectable: true },
  // Design: blue card, info-blue label. Both from the frames' legend swatch.
  cleaning: { label: 'Cleaning', fg: 'var(--rst-info)', card: 'var(--rst-table-cleaning)', selectable: true },
};

const UNKNOWN: TableStatusStyle = {
  label: 'Unknown',
  fg: 'var(--rst-ink-2)',
  card: 'var(--rst-surface-2)',
  selectable: false,
};

/** Status is a free-text column, so anything may arrive. Never throws. */
export function tableStatus(raw?: string | null): TableStatusStyle {
  if (!raw) return UNKNOWN;
  return STYLE[raw.trim().toLowerCase()] ?? { ...UNKNOWN, label: raw };
}

/** The states a filter or a form may offer. */
export const SELECTABLE_TABLE_STATUSES = RST_TABLE_STATUSES.filter(
  (s) => STYLE[s]?.selectable,
);

/**
 * "12 min" — time in the current status, which is what the captain cards count.
 * The frames show "0 min" on an available table, so zero is rendered, not hidden.
 */
export function minutesInStatus(since?: string | null, now = Date.now()): number | null {
  if (!since) return null;
  const t = new Date(since).getTime();
  if (Number.isNaN(t)) return null;
  return Math.max(0, Math.floor((now - t) / 60000));
}

export function formatDwell(mins: number | null): string {
  if (mins == null) return '—';
  if (mins < 60) return `${mins} min`;
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  return m ? `${h}h ${m}m` : `${h}h`;
}
