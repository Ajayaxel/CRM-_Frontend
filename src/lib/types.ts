export type Plan = 'STARTER' | 'GROWTH' | 'PROFESSIONAL';
/**
 * Mirrors enum OrgVertical in apps/api/prisma/schema.prisma exactly.
 *
 * It had drifted by twelve values, INSURANCE among them — so a correct
 * `vertical === 'INSURANCE'` was a type ERROR while a comparison against a
 * vertical that no longer mattered still compiled. A union that lags the schema
 * does not merely miss mistakes, it reports the wrong ones.
 *
 * scripts/vertical-union-sync.py fails the build if these two diverge again.
 */
export type OrgVertical =
  | 'INSTITUTE' | 'REAL_ESTATE' | 'NONE'
  | 'STUDY_ABROAD' | 'DIGITAL_AGENCY' | 'CONSULTING' | 'TRAVEL'
  | 'ECOMMERCE' | 'RETAIL' | 'SUPERMARKET' | 'RESTAURANT'
  | 'LEGAL'
  | 'CLINIC' | 'DENTAL' | 'DERMATOLOGY' | 'OPTOMETRY' | 'DIAGNOSTIC_LAB'
  | 'PHARMACY'
  | 'USED_CAR' | 'CAR_RENTAL' | 'HOTEL'
  | 'SOLAR' | 'INSURANCE' | 'COWORKING'
  | 'POULTRY';

export interface CurrentUser {
  id: string;
  email: string;
  firstName: string;
  lastName?: string | null;
  phone?: string | null;
  avatarUrl?: string | null;
  status: 'INVITED' | 'ACTIVE' | 'SUSPENDED';
  role: { id: string; name: string; isSystem: boolean };
  permissions: string[];
  branch?: { id: string; name: string } | null;
  organization: {
    id: string;
    name: string;
    slug: string;
    vertical?: OrgVertical;
    logoUrl?: string | null;
    primaryColor?: string | null;
    plan: Plan;
    subscriptionStatus: string;
  };
}

export interface Paginated<T> {
  data: T[];
  meta: { page: number; limit: number; total: number; totalPages: number };
}

export interface UserRow {
  /** Whether this account holds a credential. Never the credential itself. */
  hasPassword?: boolean;
  id: string;
  email: string;
  firstName: string;
  lastName?: string | null;
  phone?: string | null;
  status: 'INVITED' | 'ACTIVE' | 'SUSPENDED';
  lastLoginAt?: string | null;
  createdAt: string;
  branch?: { id: string; name: string } | null;
  role: { id: string; name: string; isSystem: boolean };
}

export interface RoleRow {
  id: string;
  name: string;
  description?: string | null;
  isSystem: boolean;
  userCount: number;
  permissions: string[];
}

export interface Subscription {
  plan: Plan;
  status: string;
  seats: number;
  priceInr: number;
  trialEndsAt?: string | null;
  currentPeriodEnd?: string | null;
  features: string[];
}
