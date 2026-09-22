/**
 * Which tenant a request belongs to, from the hostname.
 *
 *   avera.bmnconnects.bmntechnology.com  ->  "avera"
 *   bmnconnects.bmntechnology.com        ->  null  (the platform itself)
 *   avera.localhost:3400                 ->  "avera"  (local development)
 *
 * The portal is addressed per tenant so each one is a genuinely separate
 * installable app. PWA install identity is keyed on origin and scope: while
 * every tenant shared one host, a browser treated them all as ONE app, and a
 * customer insured through two brokers would have had them collide.
 */

/** Hosts that are the platform, never a tenant. */
const PLATFORM_HOSTS = new Set([
  'bmnconnects.bmntechnology.com',
  'localhost',
  '127.0.0.1',
]);

/**
 * Subdomains that must never be read as a tenant slug. `www` is the obvious
 * one; the rest are reserved so a tenant cannot be provisioned with a slug that
 * would shadow infrastructure.
 */
export const RESERVED_SUBDOMAINS = new Set([
  'www', 'api', 'app', 'admin', 'portal', 'mail', 'smtp', 'imap',
  'static', 'assets', 'cdn', 'status', 'docs', 'help', 'support',
  'platform', 'staging', 'dev', 'test',
]);

export function tenantFromHost(host?: string | null): string | null {
  if (!host) return null;
  // Strip the port; a Host header carries one and the comparison must not.
  const clean = host.split(':')[0].toLowerCase().trim();
  if (!clean || PLATFORM_HOSTS.has(clean)) return null;

  const parts = clean.split('.');
  // A bare hostname with no dots cannot carry a subdomain.
  if (parts.length < 2) return null;

  const sub = parts[0];
  if (!sub || RESERVED_SUBDOMAINS.has(sub)) return null;

  // Railway's own generated domains (…​.up.railway.app) are not tenant hosts.
  if (clean.endsWith('.up.railway.app')) return null;

  // Local development: avera.localhost
  if (parts.length === 2 && parts[1] === 'localhost') return sub;

  // A tenant host has at least one label in front of the platform domain.
  if (parts.length >= 4) return sub;

  return null;
}

/** The canonical portal URL for a tenant, used when sending invitations. */
export function portalUrlFor(slug: string, path = '/portal', baseHost?: string) {
  const host = baseHost || process.env.NEXT_PUBLIC_PORTAL_HOST || 'bmnconnects.bmntechnology.com';
  const proto = host.startsWith('localhost') ? 'http' : 'https';
  return `${proto}://${slug}.${host}${path}`;
}
