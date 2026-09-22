import { NextRequest, NextResponse } from 'next/server';
import { tenantFromHost } from '@/lib/tenant-host';

/**
 * The PWA manifest, per tenant.
 *
 * This replaces a single static file that read:
 *
 *   "name": "BMN Connect — Learning Portal"
 *   "description": "Your institute's learning portal — attendance, materials,
 *                   assignments, grades, fees, certificates and placements."
 *
 * Every tenant's customers got that, so an insurance broker's client installing
 * the portal ended up with an attendance-and-grades app named after the
 * platform. The app inside was already white-labelled; only this wrapper was not.
 *
 * Resolved from the HOSTNAME because a manifest is fetched before anyone signs
 * in — there is no session to ask.
 */

// The manifest must not be cached across tenants by a shared proxy, and it
// changes when a tenant edits their branding.
const HEADERS = {
  'Content-Type': 'application/manifest+json',
  'Cache-Control': 'private, max-age=300',
};

const PLATFORM = {
  name: 'BMN Connect',
  short_name: 'BMN Connect',
  description: 'Business operations for your whole company.',
  theme_color: '#132376',
};

export async function GET(req: NextRequest) {
  const slug = tenantFromHost(req.headers.get('host'));

  let brand = PLATFORM;
  if (slug) {
    try {
      const api = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4400/api';
      const r = await fetch(`${api}/public/branding/${slug}`, { next: { revalidate: 300 } });
      if (r.ok) {
        const org = await r.json();
        brand = {
          name: org.name,
          short_name: org.name.length > 12 ? org.name.slice(0, 12).trim() : org.name,
          // Their own strapline when they have one. No invented description
          // about a business we know nothing about.
          description: org.tagline || `${org.name} customer portal`,
          theme_color: org.primaryColor || PLATFORM.theme_color,
        };
      }
    } catch {
      // A branding lookup failure must not leave the portal uninstallable, so
      // it falls back rather than erroring — but only to a neutral name, never
      // to the old institute wording.
    }
  }

  return NextResponse.json(
    {
      ...brand,
      start_url: '/portal/dashboard',
      // Scope stays /portal; it is the ORIGIN that now differs per tenant,
      // and origin is what actually separates one installed app from another.
      scope: '/portal',
      display: 'standalone',
      orientation: 'portrait',
      background_color: '#ffffff',
      icons: [
        { src: '/icons/icon-192.png', sizes: '192x192', type: 'image/png', purpose: 'any' },
        { src: '/icons/icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'any' },
        { src: '/icons/icon-512-maskable.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
      ],
    },
    { headers: HEADERS },
  );
}
