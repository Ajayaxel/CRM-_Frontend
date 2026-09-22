export type PropertyType = 'APARTMENT' | 'VILLA' | 'TOWNHOUSE' | 'PENTHOUSE' | 'OFFICE' | 'SHOP' | 'WAREHOUSE' | 'LAND' | 'STUDIO';
export type ListingType = 'SALE' | 'RENT' | 'BOTH';
export type PropertyStatus = 'AVAILABLE' | 'RESERVED' | 'UNDER_OFFER' | 'SOLD' | 'RENTED' | 'OFF_MARKET';
export type Purpose = 'BUY' | 'RENT' | 'INVEST';

export interface Agent {
  id: string; slug: string; name: string; phone?: string | null; email?: string | null;
  photoUrl?: string | null; bio?: string | null; active: boolean;
  _count?: { properties: number };
  stats?: { listings: number; available: number; closed: number; activeTenants: number };
}
export interface Property {
  id: string; reference: string; title: string; type: PropertyType; listingType: ListingType; status: PropertyStatus;
  bedrooms: number; bathrooms?: number; areaSqft: number; priceInr?: number | null; rentInr?: number | null; depositInr?: number | null;
  city?: string | null; area?: string | null; images?: string[]; roiPct?: number | null;
  agent?: { id: string; name: string; slug: string } | null;
}
export interface MatchResult { property: Property; score: number; matchPct: number; reasons: string[] }
export interface Parsed {
  purpose: Purpose; leadKind: string; budgetMinInr?: number; budgetMaxInr?: number;
  bedroomsWanted?: number; propertyTypePref?: PropertyType | null; preferredArea?: string | null; notes: string[];
}
export interface FilterOptions { cities: string[]; areas: string[]; types: PropertyType[]; bedrooms: number[] }
export type OnboardingStatus = 'INVITED' | 'SUBMITTED' | 'VERIFIED' | 'REJECTED';
export interface AgentTenant {
  id: string; tenantName: string; tenantPhone?: string | null; rentInr: number; depositInr?: number | null;
  status: string; onboardingStatus: OnboardingStatus; endDate?: string | null; openComplaints: number;
  property?: { id: string; reference: string; title: string; area?: string | null } | null;
}
export interface ConvertibleLead { id: string; firstName: string; lastName?: string | null; phone?: string | null; email?: string | null; preferredArea?: string | null; budgetMaxInr?: number | null }

export const ONBOARD_META: Record<OnboardingStatus, { label: string; bg: string; fg: string }> = {
  INVITED: { label: 'Invited', bg: 'var(--surface-2)', fg: 'var(--ink-3)' },
  SUBMITTED: { label: 'Submitted · review', bg: 'var(--gold-bg,#fdf2e2)', fg: 'var(--gold,#c67c1e)' },
  VERIFIED: { label: 'Verified', bg: 'var(--success-bg)', fg: 'var(--success)' },
  REJECTED: { label: 'Rejected', bg: 'var(--danger-bg,#fce8e8)', fg: 'var(--danger,#c0392b)' },
};

export const TYPE_LABEL: Record<PropertyType, string> = { APARTMENT: 'Apartment', VILLA: 'Villa', TOWNHOUSE: 'Townhouse', PENTHOUSE: 'Penthouse', OFFICE: 'Office', SHOP: 'Shop', WAREHOUSE: 'Warehouse', LAND: 'Land', STUDIO: 'Studio' };
export const STATUS_META: Record<PropertyStatus, { label: string; bg: string; fg: string }> = {
  AVAILABLE: { label: 'Available', bg: 'var(--success-bg)', fg: 'var(--success)' },
  RESERVED: { label: 'Reserved', bg: 'var(--gold-bg,#fdf2e2)', fg: 'var(--gold,#c67c1e)' },
  UNDER_OFFER: { label: 'Under offer', bg: 'var(--gold-bg,#fdf2e2)', fg: 'var(--gold,#c67c1e)' },
  SOLD: { label: 'Sold', bg: 'var(--surface-2)', fg: 'var(--ink-3)' },
  RENTED: { label: 'Rented', bg: 'var(--brand-bg,#e9ecfb)', fg: 'var(--brand,#132376)' },
  OFF_MARKET: { label: 'Off-market', bg: 'var(--surface-2)', fg: 'var(--ink-3)' },
};

export function money(n?: number | null) {
  if (n == null) return '—';
  if (n >= 10000000) return `₹${(n / 10000000).toFixed(2)} Cr`;
  if (n >= 100000) return `₹${(n / 100000).toFixed(1)} L`;
  return `₹${n.toLocaleString('en-IN')}`;
}
export function priceOf(p: Property) {
  return p.listingType === 'RENT' ? p.rentInr : (p.priceInr ?? p.rentInr);
}
