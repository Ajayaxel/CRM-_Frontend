/**
 * What each platform role can do — one map, mirroring the backend policy.
 *
 * The console had no role model at all. It called `/stats` (SUPER_ADMIN only)
 * on every load, so an ONBOARDING or SUPPORT admin opened it to a dashboard of
 * dashes and a 403 in the console; it rendered "New Institute" to SUPPORT, who
 * cannot provision; and the organisation drawer offered plan, vertical, Omni
 * and suspend controls to all three roles, four buttons that only SUPER_ADMIN
 * could actually press.
 *
 * THIS IS NOT A SECOND AUTHORIZATION SYSTEM. PlatformAuthGuard decides; it
 * refuses anything it finds no policy on and no browser can talk it round.
 * What this map buys is a console that does not ask questions it knows the
 * answer to: no forbidden background calls, no controls that fail on click, no
 * navigation into a page that will only refuse.
 *
 * Every capability names the ROUTES it governs, and `scripts/platform-console-
 * offline.ts` reads those names out of platform.controller.ts and compares the
 * roles. So this file cannot quietly drift from the guard — if someone widens
 * or narrows a route's @PlatformRoles, the gate fails until this agrees. That
 * is the property that makes a frontend policy safe to keep at all: it is a
 * reflection of the backend one, checked, not a second opinion.
 */
export type PlatformRoleName = 'SUPER_ADMIN' | 'ONBOARDING' | 'SUPPORT';

export const PLATFORM_ROLES: PlatformRoleName[] = ['SUPER_ADMIN', 'ONBOARDING', 'SUPPORT'];

export type Capability =
  | 'stats'
  | 'organizations.view'
  | 'organizations.create'
  | 'organizations.plan'
  | 'organizations.products'
  | 'organizations.status'
  | 'organizations.billing'
  | 'onboarding.funnel'
  | 'onboarding.nudge'
  | 'admins.manage'
  | 'audit.view'
  | 'self.profile';

export interface CapabilitySpec {
  /** Roles the BACKEND admits. Verified against the controller by the gate. */
  roles: PlatformRoleName[];
  /** `METHOD path` exactly as the controller declares it. */
  routes: string[];
  /** Used in refusal copy, so a blocked page can name what it needed. */
  label: string;
}

const ALL: PlatformRoleName[] = ['SUPER_ADMIN', 'ONBOARDING', 'SUPPORT'];
const PROVISIONERS: PlatformRoleName[] = ['SUPER_ADMIN', 'ONBOARDING'];
const OWNER: PlatformRoleName[] = ['SUPER_ADMIN'];

export const CAPABILITIES: Record<Capability, CapabilitySpec> = {
  // Global MRR across every tenant — commercial data, deliberately narrow.
  'stats': { roles: OWNER, routes: ['GET /stats'], label: 'Platform statistics' },

  'organizations.view': {
    roles: ALL,
    routes: ['GET /institutes', 'GET /institutes/:id'],
    label: 'View organisations',
  },
  'organizations.create': {
    roles: PROVISIONERS,
    routes: ['POST /tenants', 'POST /institutes'],
    label: 'Create organisations',
  },
  'organizations.plan': {
    roles: OWNER,
    routes: ['PATCH /institutes/:id/plan'],
    label: 'Change plans',
  },
  'organizations.products': {
    roles: OWNER,
    routes: ['PATCH /institutes/:id/products', 'PATCH /tenants/:id/products'],
    label: 'Change vertical and products',
  },
  'organizations.status': {
    roles: OWNER,
    routes: ['PATCH /institutes/:id/status'],
    label: 'Suspend and reactivate',
  },
  // The tenant's COMMERCIAL standing — deliberately a separate capability from
  // access, because they are separate decisions with separate consequences.
  // Grouped with plan under the same SUPER_ADMIN authority.
  'organizations.billing': {
    roles: OWNER,
    routes: ['PATCH /institutes/:id/subscription-status'],
    label: 'Record billing status',
  },

  'onboarding.funnel': {
    roles: PROVISIONERS,
    routes: ['GET /onboarding-funnel'],
    label: 'Onboarding funnel',
  },
  'onboarding.nudge': {
    roles: PROVISIONERS,
    routes: ['POST /onboarding-nudge-run'],
    label: 'Send onboarding nudges',
  },

  'admins.manage': {
    roles: OWNER,
    routes: ['GET /admins', 'POST /admins', 'PATCH /admins/:id/active', 'PATCH /admins/:id/role'],
    label: 'Manage platform administrators',
  },
  'audit.view': { roles: OWNER, routes: ['GET /audit'], label: 'Platform audit log' },

  // Everyone has a profile and everyone must be able to rotate their password.
  'self.profile': {
    roles: ALL,
    routes: ['GET /auth/me', 'POST /auth/change-password'],
    label: 'Your profile',
  },
};

/**
 * An unknown role holds nothing.
 *
 * The console seeds an empty role on boot while `/auth/me` is in flight, and a
 * role could be removed while somebody is signed in. Both must read as "no",
 * not as "not yet decided" — a maybe here becomes a forbidden request.
 */
export function can(role: string | null | undefined, capability: Capability): boolean {
  if (!role) return false;
  return CAPABILITIES[capability].roles.includes(role as PlatformRoleName);
}

export interface PlatformNavItem {
  href: string;
  label: string;
  /** Absent means every signed-in admin sees it. */
  capability?: Capability;
}

export const PLATFORM_NAV: PlatformNavItem[] = [
  { href: '/platform', label: 'Organisations', capability: 'organizations.view' },
  { href: '/platform/onboarding', label: 'Onboarding', capability: 'onboarding.funnel' },
  { href: '/platform/audit', label: 'Audit log', capability: 'audit.view' },
  { href: '/platform/admins', label: 'Administrators', capability: 'admins.manage' },
];

export function navFor(role: string | null | undefined): PlatformNavItem[] {
  return PLATFORM_NAV.filter((i) => !i.capability || can(role, i.capability));
}

/**
 * Where a role lands.
 *
 * All three can view organisations, so all three land there — and that is the
 * honest answer rather than three near-identical dashboards. For SUPPORT the
 * organisation list IS the job: find a tenant and read its state. What differs
 * is what the page then shows, not which page it is.
 */
export function landingFor(role: string | null | undefined): string {
  const nav = navFor(role);
  return nav[0]?.href ?? '/platform';
}
