import axios, { AxiosError, InternalAxiosRequestConfig } from 'axios';
import { useAuthStore } from '@/features/foundation/auth';

// Same-origin proxy (see next.config rewrites) so the httpOnly refresh cookie works.
export const api = axios.create({
  baseURL: '/api',
  withCredentials: true,
});

api.interceptors.request.use((config) => {
  const token = useAuthStore.getState().accessToken;
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

let refreshing: Promise<string | null> | null = null;

async function refreshAccessToken(): Promise<string | null> {
  try {
    const res = await axios.post('/api/auth/refresh', {}, { withCredentials: true });
    const token = res.data?.accessToken as string;
    useAuthStore.getState().setToken(token);
    return token;
  } catch {
    useAuthStore.getState().clear();
    return null;
  }
}

/**
 * A suspended workspace is answered once, not screen by screen.
 *
 * The backend refuses every request from a suspended organisation with a 403
 * carrying `gate: ORGANIZATION_SUSPENDED`. Left alone, that would surface as a
 * different error toast on whichever pages happen to be mounted, and a reload
 * would land on the login form with no explanation. So the first one wins: the
 * local session is dropped and the whole tab goes to the page that says what
 * happened.
 *
 * It is deliberately a 403 and therefore never refreshed. Suspension is not a
 * credential problem, and sending it round the refresh loop would spin against
 * a refusal no new token can satisfy.
 */
export const SUSPENDED_PATH = '/suspended';

/**
 * Pages this redirect must leave alone.
 *
 * The sign-in pages, because redirecting away from them turned one refusal
 * into a loop — and somebody whose workspace is suspended may legitimately
 * want to sign in as somebody else, or to come back after it is lifted.
 *
 * And the OTHER TWO SURFACES, because this interceptor belongs to the staff
 * client and the staff client is mounted app-wide. On /portal it was sending a
 * suspended student to the staff interstitial, complete with a "Back to sign
 * in" link to the staff login they have no account for; the portal answers its
 * own suspension in portal-client.ts. On /platform it would be worse — that is
 * the console an admin reactivates the organisation FROM, and bouncing it on a
 * tenant's suspension would take away the way out.
 */
const UNREDIRECTED = [
  SUSPENDED_PATH, '/login', '/register', '/forgot-password', '/reset-password', '/accept-invitation',
  '/portal', '/platform',
];
const isAuthRoute = (path: string) => UNREDIRECTED.some((r) => path === r || path.startsWith(r + '/'));

function isSuspensionRefusal(error: AxiosError): boolean {
  return error.response?.status === 403 &&
    (error.response?.data as { gate?: string } | undefined)?.gate === 'ORGANIZATION_SUSPENDED';
}

api.interceptors.response.use(
  (res) => res,
  async (error: AxiosError) => {
    const original = error.config as InternalAxiosRequestConfig & { _retry?: boolean };
    const isAuthEndpoint = original?.url?.includes('/auth/login') ||
      original?.url?.includes('/auth/refresh');

    // Not for /auth/login: the login form shows the refusal in place, which is
    // clearer than throwing someone who never got in onto an interstitial.
    if (isSuspensionRefusal(error) && !original?.url?.includes('/auth/login')) {
      useAuthStore.getState().clear();
      // Drop the refresh cookie too. Without this the bootstrap refresh on
      // EVERY page — including /login — comes back suspended and bounces
      // straight here, so "Back to sign in" was a button that returned you to
      // the page you pressed it on. /auth/logout is @Public and revokes
      // without minting anything, so it still works while suspended.
      // Fire-and-forget: this is cleanup, and failing it must not mask the
      // refusal being reported.
      void axios.post('/api/auth/logout', {}, { withCredentials: true }).catch(() => undefined);
      if (typeof window !== 'undefined' && !isAuthRoute(window.location.pathname)) {
        window.location.replace(SUSPENDED_PATH);
      }
      return Promise.reject(error);
    }

    if (error.response?.status === 401 && original && !original._retry && !isAuthEndpoint) {
      original._retry = true;
      refreshing = refreshing ?? refreshAccessToken();
      const token = await refreshing;
      refreshing = null;
      if (token) {
        original.headers.Authorization = `Bearer ${token}`;
        return api(original);
      }
    }
    return Promise.reject(error);
  },
);

export function apiErrorMessage(err: unknown): string {
  if (axios.isAxiosError(err)) {
    const data = err.response?.data;
    // Gated refusals — the entitlement guard and the student access gate — carry
    // `reasons`. Showing only the headline leaves the user with "not entitled"
    // and no idea what would change that.
    const reason = Array.isArray(data?.reasons) ? data.reasons[0] : undefined;
    const msg = data?.message;
    if (typeof msg === 'string' && reason) return `${msg} — ${reason}`;
    if (reason) return reason;
    if (Array.isArray(msg)) return msg.join(', ');
    if (typeof msg === 'string') return msg;
  }
  return 'Something went wrong. Please try again.';
}
