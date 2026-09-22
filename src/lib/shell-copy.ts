import { labelFor } from './org-locale';

/**
 * Shell copy that has to change with the tenant's vertical. The chrome used to be
 * hardcoded to the institute product, so a solar or hotel tenant was told they were
 * running an admissions CRM and asked to "search leads, students, courses".
 */
export interface ShellCopy { product: string; searchPlaceholder: string }

/** Lead-screen vocabulary, resolved from the org-locale label packs. `interest`
 *  is null outside course-based verticals — the column/field is course-backed,
 *  so callers hide it rather than relabel it. */
export interface LeadVocab { interest: string | null; owner: string; expectedValue: string }
export const leadVocab = (vertical?: string | null): LeadVocab => ({
  interest: labelFor(vertical, 'lead.interest'),
  owner: labelFor(vertical, 'lead.owner') ?? 'Owner',
  expectedValue: labelFor(vertical, 'lead.expectedValue') ?? 'Expected value',
});

const DEFAULT_COPY: ShellCopy = { product: 'Business CRM', searchPlaceholder: 'Search…' };

const BY_VERTICAL: Record<string, ShellCopy> = {
  INSTITUTE: { product: 'Admissions CRM', searchPlaceholder: 'Search leads, students, courses…' },
  SOLAR: { product: 'Solar OS', searchPlaceholder: 'Search projects, customers, serials…' },
  REAL_ESTATE: { product: 'Property CRM', searchPlaceholder: 'Search properties, owners, tenants…' },
  DIGITAL_AGENCY: { product: 'Agency CRM', searchPlaceholder: 'Search clients, projects, invoices…' },
  STUDY_ABROAD: { product: 'Study Abroad CRM', searchPlaceholder: 'Search applicants, universities…' },
  CONSULTING: { product: 'Consulting CRM', searchPlaceholder: 'Search engagements, clients…' },
  TRAVEL: { product: 'Travel CRM', searchPlaceholder: 'Search bookings, packages…' },
  LEGAL: { product: 'Legal Practice', searchPlaceholder: 'Search matters, clients, hearings…' },
  HOTEL: { product: 'Hotel PMS', searchPlaceholder: 'Search reservations, guests, rooms…' },
  PHARMACY: { product: 'Pharmacy ERP', searchPlaceholder: 'Search drugs, batches…' },
  USED_CAR: { product: 'Motors CRM', searchPlaceholder: 'Search vehicles, buyers…' },
  CAR_RENTAL: { product: 'Rental CRM', searchPlaceholder: 'Search fleet, rentals…' },
  ECOMMERCE: { product: 'Commerce ERP', searchPlaceholder: 'Search products, orders…' },
  RETAIL: { product: 'Retail OS', searchPlaceholder: 'Search styles, SKUs, customers, orders…' },
  INSURANCE: { product: 'Broking OS', searchPlaceholder: 'Search clients, policies, claims…' },
  COWORKING: { product: 'BNO Connect', searchPlaceholder: 'Search spaces, members, bookings…' },
  POULTRY: { product: 'Poultry OS', searchPlaceholder: 'Search farms, batches, suppliers, parties…' },
  SUPERMARKET: { product: 'Supermarket ERP', searchPlaceholder: 'Search products, orders…' },
  RESTAURANT: { product: 'Restaurant ERP', searchPlaceholder: 'Search menu, tables, orders…' },
  CLINIC: { product: 'Clinic EHR', searchPlaceholder: 'Search patients, appointments…' },
  DENTAL: { product: 'Dental EHR', searchPlaceholder: 'Search patients, treatments…' },
  DERMATOLOGY: { product: 'Derma EHR', searchPlaceholder: 'Search patients, procedures…' },
  OPTOMETRY: { product: 'Optometry EHR', searchPlaceholder: 'Search patients, eye exams…' },
  DIAGNOSTIC_LAB: { product: 'Lab LIMS', searchPlaceholder: 'Search orders, tests, samples…' },
  NONE: { product: 'Team Inbox', searchPlaceholder: 'Search conversations…' },
};

export const shellCopy = (vertical?: string | null): ShellCopy =>
  (vertical && BY_VERTICAL[vertical]) || DEFAULT_COPY;
