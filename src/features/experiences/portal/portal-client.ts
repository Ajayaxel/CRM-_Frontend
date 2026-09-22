'use client';

export type PortalType = 'STUDENT' | 'PARENT' | 'LECTURER' | 'SOLAR_CUSTOMER' | 'SOLAR_DEALER' | 'INSURANCE_CUSTOMER';
export interface PortalUser {
  id: string; type: PortalType; name: string; email: string; organizationId: string;
  studentId?: string | null; guardianId?: string | null; facultyId?: string | null;
  solarProjectId?: string | null; solarDealerId?: string | null; insClientId?: string | null;
}
export interface PortalMe {
  id: string; type: PortalType; name: string; email: string;
  organization?: { name?: string; primaryColor?: string; logoUrl?: string | null; tagline?: string | null } | null;
  linked?: any;
}

const KEY = 'bmn_portal_session';

export function savePortalSession(token: string, user: PortalUser) {
  if (typeof window !== 'undefined') localStorage.setItem(KEY, JSON.stringify({ token, user }));
}
export function getPortalSession(): { token: string; user: PortalUser } | null {
  if (typeof window === 'undefined') return null;
  try { const raw = localStorage.getItem(KEY); return raw ? JSON.parse(raw) : null; } catch { return null; }
}
export function clearPortalSession() {
  if (typeof window !== 'undefined') localStorage.removeItem(KEY);
}

/** Authenticated fetch against the portal API (adds the portal Bearer token). */
export async function portalApi<T = any>(path: string, opts: RequestInit = {}): Promise<T> {
  const s = getPortalSession();
  const r = await fetch(`/api${path}`, {
    ...opts,
    headers: { 'Content-Type': 'application/json', ...(s ? { Authorization: `Bearer ${s.token}` } : {}), ...(opts.headers || {}) },
  });
  if (!r.ok) {
    // The body was being thrown away and the status re-thrown as the message,
    // so every refusal reached the screen as the string "403" — including the
    // LMS gate, which goes to the trouble of explaining itself. Read it.
    const body = await r.json().catch(() => null) as { message?: string; gate?: string } | null;

    // A suspended organisation stops the whole portal, not one screen. Drop the
    // session and land on the login page with the explanation, rather than
    // leaving a student tapping through tabs that each fail on their own.
    if (r.status === 403 && body?.gate === 'ORGANIZATION_SUSPENDED') {
      clearPortalSession();
      if (typeof window !== 'undefined' && !window.location.pathname.startsWith('/portal/login')) {
        window.location.replace('/portal/login?suspended=1');
      }
    }
    throw new Error(body?.message || String(r.status));
  }
  return r.json();
}

export const PORTAL_META: Record<PortalType, { label: string; home: string; accent: string }> = {
  STUDENT: { label: 'Student', home: '/portal/dashboard', accent: '#132376' },
  PARENT: { label: 'Parent', home: '/portal/dashboard', accent: '#0f766e' },
  LECTURER: { label: 'Lecturer', home: '/portal/dashboard', accent: '#7c3aed' },
  SOLAR_CUSTOMER: { label: 'My system', home: '/portal/dashboard', accent: '#132376' },
  SOLAR_DEALER: { label: 'Channel partner', home: '/portal/dashboard', accent: '#0f766e' },
  INSURANCE_CUSTOMER: { label: 'Policyholder', home: '/portal/dashboard', accent: '#155e75' },
};
