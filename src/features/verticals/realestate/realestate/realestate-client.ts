export type PropertyType = 'APARTMENT' | 'VILLA' | 'TOWNHOUSE' | 'PENTHOUSE' | 'OFFICE' | 'SHOP' | 'WAREHOUSE' | 'LAND' | 'STUDIO' | 'HOUSE' | 'COMMERCIAL' | 'BUILDING' | 'OTHER';
export type PropertyListingType = 'SALE' | 'RENT' | 'BOTH';
export type PropertyStatus = 'AVAILABLE' | 'RESERVED' | 'UNDER_OFFER' | 'SOLD' | 'RENTED' | 'OFF_MARKET';

export interface Property {
  id: string;
  reference: string;
  title: string;
  description?: string | null;
  type: PropertyType;
  listingType: PropertyListingType;
  status: PropertyStatus;
  building?: string | null;
  unitNumber?: string | null;
  floor?: string | null;
  bedrooms: number;
  bathrooms: number;
  areaSqft: number;
  parking: number;
  amenities: string[];
  images: string[];
  priceInr?: number | null;
  rentInr?: number | null;
  depositInr?: number | null;
  commissionPct?: number | null;
  ownerName?: string | null;
  ownerPhone?: string | null;
  city?: string | null;
  area?: string | null;
  roiPct?: number | null;
  rentalYieldPct?: number | null;
  featured: boolean;
  createdAt: string;
}

export interface PropertyStats {
  total: number;
  byStatus: Record<PropertyStatus, number>;
  portfolioValue: number;
  monthlyRentRoll: number;
  occupancyPct: number;
}

export const PROPERTY_TYPE_META: Record<string, { label: string; icon: string }> = {
  APARTMENT: { label: 'Apartment', icon: '🏢' },
  VILLA: { label: 'Villa', icon: '🏡' },
  TOWNHOUSE: { label: 'Townhouse', icon: '🏘️' },
  PENTHOUSE: { label: 'Penthouse', icon: '🌆' },
  OFFICE: { label: 'Office', icon: '🏬' },
  SHOP: { label: 'Retail / Shop', icon: '🏪' },
  WAREHOUSE: { label: 'Warehouse', icon: '🏭' },
  LAND: { label: 'Land / Plot', icon: '🌄' },
  STUDIO: { label: 'Studio', icon: '🛋️' },
  HOUSE: { label: 'House', icon: '🏠' },
  COMMERCIAL: { label: 'Commercial', icon: '🏢' },
  BUILDING: { label: 'Building', icon: '🏢' },
  OTHER: { label: 'Other', icon: '🏠' },
};

export const STATUS_META: Record<PropertyStatus, { label: string; bg: string; fg: string }> = {
  AVAILABLE: { label: 'Available', bg: 'var(--success-bg)', fg: 'var(--success)' },
  RESERVED: { label: 'Reserved', bg: 'var(--warning-bg,#fdf2e2)', fg: 'var(--warning,#c67c1e)' },
  UNDER_OFFER: { label: 'Under offer', bg: 'var(--warning-bg,#fdf2e2)', fg: 'var(--warning,#c67c1e)' },
  SOLD: { label: 'Sold', bg: 'var(--brand-bg,#e9ecfb)', fg: 'var(--brand,#132376)' },
  RENTED: { label: 'Rented', bg: 'var(--brand-bg,#e9ecfb)', fg: 'var(--brand,#132376)' },
  OFF_MARKET: { label: 'Off-market', bg: 'var(--surface-2)', fg: 'var(--ink-3)' },
};

export type RealEstateLeadKind = 'BUYER' | 'SELLER' | 'INVESTOR' | 'TENANT' | 'LANDLORD';
export type PropertyPurpose = 'BUY' | 'RENT' | 'INVEST';

export interface BuyerLead {
  id: string;
  firstName: string;
  lastName?: string | null;
  phone?: string | null;
  email?: string | null;
  leadKind?: RealEstateLeadKind | null;
  purpose?: PropertyPurpose | null;
  budgetMinInr?: number | null;
  budgetMaxInr?: number | null;
  bedroomsWanted?: number | null;
  preferredArea?: string | null;
  propertyTypePref?: PropertyType | null;
  stage?: { name: string } | null;
}

export interface PropertyMatch {
  property: Property;
  score: number;
  matchPct: number;
  reasons: string[];
}

export type LeaseStatus = 'PENDING' | 'ACTIVE' | 'EXPIRING' | 'EXPIRED' | 'TERMINATED' | 'RENEWED';
export type RentInvoiceStatus = 'DUE' | 'PAID' | 'OVERDUE' | 'PARTIAL';

export interface RentInvoice {
  id: string;
  period: string;
  dueDate: string;
  amountInr: number;
  status: RentInvoiceStatus;
  paidInr: number;
  lateFeeInr: number;
  paidAt?: string | null;
}

export interface Lease {
  id: string;
  tenantName: string;
  tenantPhone?: string | null;
  startDate: string;
  endDate: string;
  rentInr: number;
  depositInr: number;
  frequency: string;
  escalationPct: number;
  status: LeaseStatus;
  property?: { reference: string; title: string } | null;
  invoices?: RentInvoice[];
  nextDue?: { period?: string; dueDate: string; amountInr: number } | null;
  overdue?: boolean;
  daysToExpiry?: number;
}

export interface LeaseStats {
  activeLeases: number;
  depositsHeld: number;
  monthlyRentRoll: number;
  outstanding: number;
  overdue: number;
  expiringSoon: number;
}

export const LEASE_STATUS_META: Record<LeaseStatus, { label: string; bg: string; fg: string }> = {
  PENDING: { label: 'Starts soon', bg: 'var(--brand-bg,#e9ecfb)', fg: 'var(--brand,#132376)' },
  ACTIVE: { label: 'Active', bg: 'var(--success-bg)', fg: 'var(--success)' },
  EXPIRING: { label: 'Expiring', bg: 'var(--warning-bg,#fdf2e2)', fg: 'var(--warning,#c67c1e)' },
  EXPIRED: { label: 'Expired', bg: 'var(--surface-2)', fg: 'var(--ink-3)' },
  TERMINATED: { label: 'Terminated', bg: 'var(--danger-bg,#fce8e8)', fg: 'var(--danger,#c0392b)' },
  RENEWED: { label: 'Renewed', bg: 'var(--brand-bg,#e9ecfb)', fg: 'var(--brand,#132376)' },
};

export const RENT_STATUS_META: Record<RentInvoiceStatus, { label: string; bg: string; fg: string }> = {
  DUE: { label: 'Due', bg: 'var(--surface-2)', fg: 'var(--ink-3)' },
  PAID: { label: 'Paid', bg: 'var(--success-bg)', fg: 'var(--success)' },
  OVERDUE: { label: 'Overdue', bg: 'var(--danger-bg,#fce8e8)', fg: 'var(--danger,#c0392b)' },
  PARTIAL: { label: 'Partial', bg: 'var(--warning-bg,#fdf2e2)', fg: 'var(--warning,#c67c1e)' },
};

export type ComplaintCategory = 'PLUMBING' | 'ELECTRICAL' | 'HVAC' | 'APPLIANCE' | 'STRUCTURAL' | 'PEST' | 'CLEANING' | 'SECURITY' | 'INTERNET' | 'OTHER';
export type ComplaintPriority = 'LOW' | 'MEDIUM' | 'HIGH' | 'EMERGENCY';
export type ComplaintStatus = 'OPEN' | 'ASSIGNED' | 'IN_PROGRESS' | 'ON_HOLD' | 'RESOLVED' | 'CLOSED' | 'CANCELLED';

export interface ComplaintEvent {
  id: string;
  type: 'CREATED' | 'ASSIGNED' | 'STATUS' | 'NOTE' | 'COMMENT' | 'FEEDBACK';
  message: string;
  author: string;
  createdAt: string;
}

export interface Complaint {
  id: string;
  ticketNo: string;
  tenantName: string;
  tenantPhone?: string | null;
  title: string;
  description: string;
  category: ComplaintCategory;
  priority: ComplaintPriority;
  status: ComplaintStatus;
  emergency: boolean;
  assignedTo?: string | null;
  assignedType?: string | null;
  vendorId?: string | null;
  slaHours: number;
  dueAt?: string | null;
  resolvedAt?: string | null;
  feedbackRating?: number | null;
  overdue?: boolean;
  property?: { reference: string; title: string } | null;
  events?: ComplaintEvent[];
  createdAt: string;
}

export interface ComplaintStats {
  open: number;
  overdue: number;
  resolvedThisMonth: number;
  avgResolutionHours: number;
  byCategory: { category: ComplaintCategory; count: number }[];
}

export const COMPLAINT_STATUS_META: Record<ComplaintStatus, { label: string; bg: string; fg: string }> = {
  OPEN: { label: 'Open', bg: 'var(--warning-bg,#fdf2e2)', fg: 'var(--warning,#c67c1e)' },
  ASSIGNED: { label: 'Assigned', bg: 'var(--brand-bg,#e9ecfb)', fg: 'var(--brand,#132376)' },
  IN_PROGRESS: { label: 'In progress', bg: 'var(--brand-bg,#e9ecfb)', fg: 'var(--brand,#132376)' },
  ON_HOLD: { label: 'On hold', bg: 'var(--surface-2)', fg: 'var(--ink-3)' },
  RESOLVED: { label: 'Resolved', bg: 'var(--success-bg)', fg: 'var(--success)' },
  CLOSED: { label: 'Closed', bg: 'var(--success-bg)', fg: 'var(--success)' },
  CANCELLED: { label: 'Cancelled', bg: 'var(--danger-bg,#fce8e8)', fg: 'var(--danger,#c0392b)' },
};

export const PRIORITY_META: Record<ComplaintPriority, { label: string; bg: string; fg: string }> = {
  LOW: { label: 'Low', bg: 'var(--surface-2)', fg: 'var(--ink-3)' },
  MEDIUM: { label: 'Medium', bg: 'var(--surface-2)', fg: 'var(--ink-2)' },
  HIGH: { label: 'High', bg: 'var(--warning-bg,#fdf2e2)', fg: 'var(--warning,#c67c1e)' },
  EMERGENCY: { label: 'Emergency', bg: 'var(--danger-bg,#fce8e8)', fg: 'var(--danger,#c0392b)' },
};

export const CATEGORY_ICON: Record<ComplaintCategory, string> = {
  PLUMBING: '🚿', ELECTRICAL: '⚡', HVAC: '❄️', APPLIANCE: '🔌', STRUCTURAL: '🏗️',
  PEST: '🐜', CLEANING: '🧹', SECURITY: '🔒', INTERNET: '📶', OTHER: '🔧',
};

export type MaintenanceType = 'PREVENTIVE' | 'CORRECTIVE';
export type MaintenanceStatus = 'SCHEDULED' | 'IN_PROGRESS' | 'DONE' | 'CANCELLED';

export interface Vendor {
  id: string; name: string; trade: string; phone?: string | null; email?: string | null;
  rating: number; active: boolean; _count?: { jobs: number; contracts: number };
}
export interface AmcContract {
  id: string; title: string; category: ComplaintCategory; startDate: string; endDate: string;
  costInr: number; frequency: string; status: string; expiringSoon?: boolean;
  vendor?: { name: string } | null; property?: { reference: string } | null;
}
export interface MaintenanceJob {
  id: string; title: string; type: MaintenanceType; category: ComplaintCategory;
  status: MaintenanceStatus; scheduledFor: string; completedAt?: string | null;
  costInr?: number | null; assignedTo?: string | null; overdue?: boolean;
  vendor?: { name: string } | null; property?: { reference: string } | null;
}
export interface MaintenanceStats {
  scheduled: number; overdue: number; doneThisMonth: number; costThisMonth: number;
  activeVendors: number; activeContracts: number;
}
export const JOB_STATUS_META: Record<MaintenanceStatus, { label: string; bg: string; fg: string }> = {
  SCHEDULED: { label: 'Scheduled', bg: 'var(--warning-bg,#fdf2e2)', fg: 'var(--warning,#c67c1e)' },
  IN_PROGRESS: { label: 'In progress', bg: 'var(--brand-bg,#e9ecfb)', fg: 'var(--brand,#132376)' },
  DONE: { label: 'Done', bg: 'var(--success-bg)', fg: 'var(--success)' },
  CANCELLED: { label: 'Cancelled', bg: 'var(--danger-bg,#fce8e8)', fg: 'var(--danger,#c0392b)' },
};

export type InvoiceKind = 'QUOTATION' | 'INVOICE';
export type InvoiceCategory = 'RENT' | 'MAINTENANCE' | 'COMMISSION' | 'SALE' | 'SERVICE' | 'DEPOSIT' | 'CONSULTING' | 'DEVELOPMENT' | 'DESIGN' | 'SUBSCRIPTION' | 'RETAINER' | 'SUPPORT' | 'HOSTING' | 'LICENSE' | 'PRODUCT' | 'OTHER';
export type InvoiceStatus = 'DRAFT' | 'SENT' | 'PARTIAL' | 'PAID' | 'OVERDUE' | 'CANCELLED';
export type PaymentMethod = 'CASH' | 'BANK' | 'ONLINE' | 'CARD' | 'CHEQUE';

export interface InvoiceItem { id?: string; description: string; quantity: number; unitPriceInr: number; amountInr?: number }
export interface Payment { id: string; amountInr: number; method: PaymentMethod; reference?: string | null; paidAt: string }
export interface Invoice {
  id: string; number: string; kind: InvoiceKind; category: InvoiceCategory; status: InvoiceStatus;
  customerName: string; customerPhone?: string | null; issueDate: string; dueDate?: string | null; notes?: string | null;
  subtotalInr: number; vatPct: number; vatInr: number; totalInr: number; amountPaidInr: number;
  overdue?: boolean; items?: InvoiceItem[]; payments?: Payment[]; _count?: { items: number };
}
export interface FinanceStats {
  outstanding: number; overdue: number; collectedThisMonth: number; quotations: number; drafts: number;
  byCategory: { category: string; total: number }[];
}
export const INVOICE_STATUS_META: Record<InvoiceStatus, { label: string; bg: string; fg: string }> = {
  DRAFT: { label: 'Draft', bg: 'var(--surface-2)', fg: 'var(--ink-3)' },
  SENT: { label: 'Sent', bg: 'var(--brand-bg,#e9ecfb)', fg: 'var(--brand,#132376)' },
  PARTIAL: { label: 'Partial', bg: 'var(--warning-bg,#fdf2e2)', fg: 'var(--warning,#c67c1e)' },
  PAID: { label: 'Paid', bg: 'var(--success-bg)', fg: 'var(--success)' },
  OVERDUE: { label: 'Overdue', bg: 'var(--danger-bg,#fce8e8)', fg: 'var(--danger,#c0392b)' },
  CANCELLED: { label: 'Cancelled', bg: 'var(--surface-2)', fg: 'var(--ink-3)' },
};

import { fmtOrgMoney } from '@/lib/org-locale';
export function money(n?: number | null) {
  // Delegates to the org locale — rupee/lakh for Indian tenants, the org currency elsewhere.
  return fmtOrgMoney(n);
}

// ── Owner master + KYC (spec §3) ───────────────────────────────────────────
export type OwnerType = 'INDIVIDUAL' | 'COMPANY';
export type KycType = 'EMIRATES_ID' | 'PASSPORT' | 'PAN' | 'AADHAAR' | 'TRADE_LICENSE';
export const KYC_TYPES: KycType[] = ['EMIRATES_ID', 'PASSPORT', 'PAN', 'AADHAAR', 'TRADE_LICENSE'];
export const KYC_LABEL: Record<KycType, string> = {
  EMIRATES_ID: 'Emirates ID', PASSPORT: 'Passport', PAN: 'PAN', AADHAAR: 'Aadhaar', TRADE_LICENSE: 'Trade License',
};
export interface Owner {
  id: string; reference: string; name: string; ownerType: OwnerType;
  phone?: string | null; email?: string | null; nationality?: string | null; address?: string | null;
  kycType?: KycType | null; kycNumber?: string | null; kycVerified: boolean; kycExpiry?: string | null;
  bankName?: string | null; bankAccount?: string | null; bankIfsc?: string | null;
  agreementPct?: number | null; notes?: string | null; createdAt: string;
  propertyCount?: number;
  properties?: { id: string; reference: string; title: string; status: string; listingType: string; priceInr?: number | null; rentInr?: number | null }[];
}

// ── Site visits / viewings (spec §7) ───────────────────────────────────────
export type SiteVisitStatus = 'SCHEDULED' | 'CONFIRMED' | 'CHECKED_IN' | 'COMPLETED' | 'CANCELLED' | 'NO_SHOW';
export type InterestLevel = 'HOT' | 'WARM' | 'COLD';
export interface SiteVisit {
  id: string; reference: string; propertyId?: string | null; leadId?: string | null;
  clientName: string; clientPhone?: string | null; agentName?: string | null;
  scheduledAt: string; status: SiteVisitStatus; checkedInAt?: string | null; completedAt?: string | null;
  feedback?: string | null; rating?: number | null; interestLevel?: InterestLevel | null; followUpAt?: string | null;
  notes?: string | null;
  property?: { id: string; reference: string; title: string } | null;
}
export interface SiteVisitSummary {
  total: number; upcoming: number; checkedIn: number; completed: number; cancelled: number; noShow: number;
  hotLeads: number; avgRating: number | null;
}
export const VISIT_STATUS_META: Record<SiteVisitStatus, { label: string; bg: string; fg: string }> = {
  SCHEDULED: { label: 'Scheduled', bg: 'var(--surface-2)', fg: 'var(--ink-3)' },
  CONFIRMED: { label: 'Confirmed', bg: 'var(--brand-bg,#e9ecfb)', fg: 'var(--brand,#132376)' },
  CHECKED_IN: { label: 'Checked in', bg: 'var(--warning-bg,#fdf2e2)', fg: 'var(--warning,#c67c1e)' },
  COMPLETED: { label: 'Completed', bg: 'var(--success-bg)', fg: 'var(--success)' },
  CANCELLED: { label: 'Cancelled', bg: 'var(--surface-2)', fg: 'var(--ink-3)' },
  NO_SHOW: { label: 'No-show', bg: 'var(--danger-bg,#fce8e8)', fg: 'var(--danger,#c0392b)' },
};
export const INTEREST_META: Record<InterestLevel, { label: string; bg: string; fg: string }> = {
  HOT: { label: 'Hot', bg: 'var(--danger-bg,#fce8e8)', fg: 'var(--danger,#c0392b)' },
  WARM: { label: 'Warm', bg: 'var(--warning-bg,#fdf2e2)', fg: 'var(--warning,#c67c1e)' },
  COLD: { label: 'Cold', bg: 'var(--brand-bg,#e9ecfb)', fg: 'var(--brand,#132376)' },
};
