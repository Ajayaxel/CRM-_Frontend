/**
 * Sprint A — the platform locale layer.
 *
 * Organization carries `country`, `currency`, `taxRegime` and `locale`; this is the
 * single place display code asks "what currency, what tax regime, what words" — set
 * once from the session in the sidebar, read everywhere, inherited by every vertical
 * rather than patched per feature.
 */

export type TaxRegime = 'GST' | 'VAT' | 'NONE';

export interface OrgLocale {
  currency: string;
  country: string; // ISO-3166 alpha-2
  taxRegime: TaxRegime;
  locale: string;
  vertical: string | null;
}

let active: OrgLocale = { currency: 'INR', country: 'IN', taxRegime: 'GST', locale: 'en-IN', vertical: null };

export function setOrgLocale(
  org?: { currency?: string | null; country?: string | null; taxRegime?: string | null; locale?: string | null; vertical?: string | null } | null,
) {
  if (!org) return;
  const currency = org.currency || 'INR';
  active = {
    currency,
    country: org.country || 'IN',
    // Session payloads from an older API build may not carry the regime yet —
    // fall back to the currency, which has always implied it on this platform.
    taxRegime: (org.taxRegime as TaxRegime) || (currency === 'INR' ? 'GST' : 'VAT'),
    locale: org.locale || (currency === 'INR' ? 'en-IN' : 'en-AE'),
    vertical: org.vertical ?? null,
  };
}
export const orgLocale = (): OrgLocale => active;

export const isIndia = (country = active.country) => /^in$|india/i.test(country ?? '');
export const isGstRegime = () => active.taxRegime === 'GST';

/** What to call the tax on screen. NONE-regime orgs still label the (zero) line "Tax". */
export const taxLabel = () => (active.taxRegime === 'GST' ? 'GST' : active.taxRegime === 'VAT' ? 'VAT' : 'Tax');

const SYMBOL: Record<string, string> = { INR: '₹', USD: '$', EUR: '€', GBP: '£' };

/** The currency glyph if one exists, else the ISO code — for input labels like "Rent (AED)". */
export const cur = () => SYMBOL[active.currency] ?? active.currency;

/** "₹1,00,000" for INR, "AED 100,000" for currencies without a glyph. */
export function fmtOrgMoney(n?: number | null): string {
  if (n == null) return '—';
  const { currency, locale } = active;
  const sym = SYMBOL[currency];
  // Lakh/crore shorthand is an Indian convention — only use it for INR.
  if (currency === 'INR') {
    if (n >= 10000000) return `₹${(n / 10000000).toFixed(2)} Cr`;
    if (n >= 100000) return `₹${(n / 100000).toFixed(1)} L`;
  }
  const body = Math.round(n).toLocaleString(locale || 'en-AE');
  return sym ? `${sym}${body}` : `${currency} ${body}`;
}

/** The full figure, never abbreviated — "₹4,85,000", "AED 12,500".
 *  fmtOrgMoney()'s lakh/crore shorthand is right on a headline tile and wrong in
 *  a ledger: a running balance rounded to "₹4.9 L" cannot be reconciled against
 *  anything. Statements, journals and transaction tables use this one. */
export function fmtOrgMoneyExact(n?: number | null): string {
  if (n == null) return '—';
  const { currency, locale } = active;
  const sym = SYMBOL[currency];
  const body = Math.abs(Math.round(n)).toLocaleString(locale || (currency === 'INR' ? 'en-IN' : 'en-AE'));
  // The sign belongs OUTSIDE the currency symbol: an overdrawn bank account
  // reads as -AED 65,000, never as AED -65,000.
  const sign = n < 0 ? '-' : '';
  return sym ? `${sign}${sym}${body}` : `${sign}${currency} ${body}`;
}

/* ---------------------------------------------------------------- label packs
 * Vocabulary that must change with the vertical. A `null` value means the
 * concept does not exist for this tenant — callers hide the field/column
 * entirely rather than relabel it. Only the INSTITUTE pack may use education
 * words; the lint guard enforces that.
 */
export type LabelKey = 'lead.interest' | 'lead.owner' | 'lead.expectedValue' | 'lead.convert' | 'finance.income';

const DEFAULT_LABELS: Record<LabelKey, string | null> = {
  'lead.interest': null, // the column is course-backed — hide it where courses don't exist
  'lead.owner': 'Owner',
  'lead.expectedValue': 'Expected value',
  'lead.convert': null,
  'finance.income': 'Revenue',
};

const LABEL_PACKS: Record<string, Partial<Record<LabelKey, string | null>>> = {
  INSTITUTE: {
    'lead.interest': 'Course interest',
    'lead.owner': 'Counsellor',
    'lead.expectedValue': 'Expected fee',
    'lead.convert': 'Convert to admission',
    'finance.income': 'Fee collection',
  },
  STUDY_ABROAD: { 'lead.interest': 'Programme interest', 'lead.owner': 'Counsellor', 'lead.expectedValue': 'Expected fee' },
  SOLAR: { 'lead.owner': 'Salesperson' },
  INSURANCE: { 'lead.owner': 'Executive' },
  COWORKING: { 'lead.owner': 'Salesperson', 'lead.expectedValue': 'Budget' },
  REAL_ESTATE: { 'lead.owner': 'Agent' },
};

/** Resolve a label for an explicit vertical; `null` ⇒ hide the element. */
export function labelFor(vertical: string | null | undefined, key: LabelKey): string | null {
  const pack = vertical ? LABEL_PACKS[vertical] : undefined;
  return pack && key in pack ? (pack[key] as string | null) : DEFAULT_LABELS[key];
}

/** Resolve a label for the active vertical; `null` ⇒ hide the element. */
export const t = (key: LabelKey): string | null => labelFor(active.vertical, key);

/**
 * One-stop config for components: currency + regime + vocabulary. Reads the
 * module state seeded by the sidebar before any page renders, so it is safe in
 * every authed screen.
 */
export function useOrgConfig() {
  return { ...active, money: fmtOrgMoney, t, taxLabel: taxLabel(), isGst: isGstRegime() };
}
