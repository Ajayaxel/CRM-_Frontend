// Web-side mirror of apps/api/src/common/verticals.ts — the vertical catalogue
// used by the signup wizard and anywhere the UI needs vertical labels/icons.

export type OrgVertical =
  | 'INSTITUTE' | 'REAL_ESTATE' | 'STUDY_ABROAD' | 'DIGITAL_AGENCY' | 'CONSULTING' | 'TRAVEL' | 'LEGAL'
  | 'ECOMMERCE' | 'RETAIL' | 'SUPERMARKET' | 'RESTAURANT' | 'PHARMACY' | 'USED_CAR' | 'CAR_RENTAL'
  | 'SOLAR' | 'COWORKING' | 'POULTRY'
  | 'CLINIC' | 'DENTAL' | 'DERMATOLOGY' | 'OPTOMETRY' | 'DIAGNOSTIC_LAB' | 'NONE';

export type BaseProduct = 'CRM' | 'ERP' | 'PRACTICE' | 'PMS' | null;
export type VerticalGroup = 'service' | 'commerce' | 'healthcare' | 'none';

export interface VerticalConfig {
  key: OrgVertical;
  label: string;
  icon: string;
  blurb: string;
  product: BaseProduct;
  group: VerticalGroup;
}

export const VERTICAL_LIST: VerticalConfig[] = [
  { key: 'INSTITUTE', label: 'Institute', icon: '🎓', blurb: 'Courses, admissions, students.', product: 'CRM', group: 'service' },
  { key: 'REAL_ESTATE', label: 'Real Estate', icon: '🏢', blurb: 'Properties, matching, leases.', product: 'CRM', group: 'service' },
  { key: 'STUDY_ABROAD', label: 'Study Abroad', icon: '🌍', blurb: 'Universities, applications, visas.', product: 'CRM', group: 'service' },
  { key: 'DIGITAL_AGENCY', label: 'Digital Agency', icon: '📣', blurb: 'Clients, retainers, deliverables.', product: 'CRM', group: 'service' },
  { key: 'CONSULTING', label: 'Consulting', icon: '💼', blurb: 'Engagements, proposals, timesheets.', product: 'CRM', group: 'service' },
  { key: 'TRAVEL', label: 'Travel', icon: '✈️', blurb: 'Packages, bookings, itineraries.', product: 'CRM', group: 'service' },
  { key: 'LEGAL', label: 'Legal', icon: '⚖️', blurb: 'Matters, hearings, time & billing.', product: 'CRM', group: 'service' },
  { key: 'ECOMMERCE', label: 'Ecommerce', icon: '🛒', blurb: 'Catalogue, orders, fulfilment.', product: 'ERP', group: 'commerce' },
  { key: 'RETAIL', label: 'Retail', icon: '🏪', blurb: 'POS, inventory, stores.', product: 'ERP', group: 'commerce' },
  { key: 'SUPERMARKET', label: 'Supermarket', icon: '🛍️', blurb: 'Aisles, billing, stock.', product: 'ERP', group: 'commerce' },
  { key: 'RESTAURANT', label: 'Restaurant', icon: '🍽️', blurb: 'Menu, tables, kitchen.', product: 'ERP', group: 'commerce' },
  { key: 'PHARMACY', label: 'Pharmacy', icon: '💊', blurb: 'Drugs, batches, Rx dispensing.', product: 'ERP', group: 'commerce' },
  { key: 'USED_CAR', label: 'Used Car', icon: '🚗', blurb: 'Inventory, test drives, finance.', product: 'ERP', group: 'commerce' },
  { key: 'CAR_RENTAL', label: 'Rental Car', icon: '🔑', blurb: 'Fleet, bookings, agreements.', product: 'ERP', group: 'commerce' },
  { key: 'SOLAR', label: 'Solar EPC', icon: '\u2600\ufe0f', blurb: 'Design, install, monitor solar.', product: 'CRM', group: 'service' },
  { key: 'COWORKING', label: 'Coworking Space', icon: '\ud83e\ude91', blurb: 'Spaces, bookings, memberships.', product: 'CRM', group: 'service' },
  { key: 'POULTRY', label: 'Poultry Farming', icon: '\ud83d\udc14', blurb: 'Farms, batches, feed, supply.', product: 'ERP', group: 'commerce' },
  { key: 'CLINIC', label: 'Clinic', icon: '🏥', blurb: 'Patients, appointments, EHR.', product: 'PRACTICE', group: 'healthcare' },
  { key: 'DENTAL', label: 'Dental', icon: '🦷', blurb: 'Tooth charts, treatment plans.', product: 'PRACTICE', group: 'healthcare' },
  { key: 'DERMATOLOGY', label: 'Dermatology', icon: '✨', blurb: 'Procedures, packages, photos.', product: 'PRACTICE', group: 'healthcare' },
  { key: 'OPTOMETRY', label: 'Optometry', icon: '👁️', blurb: 'Eye exams, optical Rx, retail.', product: 'PRACTICE', group: 'healthcare' },
  { key: 'DIAGNOSTIC_LAB', label: 'Diagnostic Lab', icon: '🔬', blurb: 'Tests, specimens, reports.', product: 'PRACTICE', group: 'healthcare' },
];

export const GROUP_META: Record<Exclude<VerticalGroup, 'none'>, { label: string; product: 'CRM' | 'ERP' | 'PRACTICE' | 'PMS' }> = {
  service: { label: 'Service & CRM', product: 'CRM' },
  healthcare: { label: 'Healthcare & Practice', product: 'PRACTICE' },
  commerce: { label: 'Commerce & ERP', product: 'ERP' },
};

export function verticalConfig(v: OrgVertical): VerticalConfig | undefined {
  return VERTICAL_LIST.find((x) => x.key === v);
}
