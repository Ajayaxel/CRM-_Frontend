'use client';

import axios from 'axios';
import { create } from 'zustand';

/**
 * Legacy storage key. The console used to keep its 8-hour token here, readable by
 * any script on the origin. The session is now an httpOnly cookie the API sets;
 * this key is only read once, to carry an already-open session across the
 * upgrade, and is deleted as it is read.
 */
const TOKEN_KEY = 'bmn-platform-token';

export interface PlatformAdmin {
  id: string;
  email: string;
  name: string;
  role: string;
}

interface PlatformAuthState {
  token: string | null;
  admin: PlatformAdmin | null;
  ready: boolean;
  setAuth: (token: string, admin: PlatformAdmin) => void;
  setAdmin: (admin: PlatformAdmin | null) => void;
  setReady: (ready: boolean) => void;
  clear: () => void;
}

export const usePlatformAuth = create<PlatformAuthState>((set) => ({
  token: null,
  admin: null,
  ready: false,
  // Memory only. A reload re-establishes the session from the cookie via /auth/me.
  setAuth: (token, admin) => set({ token, admin }),
  setAdmin: (admin) => set({ admin }),
  setReady: (ready) => set({ ready }),
  clear: () => {
    if (typeof localStorage !== 'undefined') localStorage.removeItem(TOKEN_KEY);
    set({ token: null, admin: null });
  },
}));

/** Takes a pre-cookie token out of storage — once. Returns null when there is none. */
export function takeLegacyPlatformToken(): string | null {
  try {
    if (typeof localStorage === 'undefined') return null;
    const t = localStorage.getItem(TOKEN_KEY);
    if (t) localStorage.removeItem(TOKEN_KEY);
    return t;
  } catch { return null; }
}

/** Marks the in-memory state as signed in when the cookie, not a token, is the session. */
export const COOKIE_SESSION = 'cookie-session';

// Separate axios instance for the platform console (its own bearer token).
export const platformApi = axios.create({
  baseURL: '/api/platform',
  withCredentials: true,
  // Required by the API before it honours the session cookie on a write.
  headers: { 'x-bmn-console': '1' },
});

platformApi.interceptors.request.use((config) => {
  const token = usePlatformAuth.getState().token;
  if (token && token !== COOKIE_SESSION) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

platformApi.interceptors.response.use(
  (res) => res,
  (error) => {
    if (error.response?.status === 401) {
      usePlatformAuth.getState().clear();
      if (typeof window !== 'undefined' && !window.location.pathname.endsWith('/platform/login')) {
        window.location.href = '/platform/login';
      }
    }
    // A 403 here means the console asked for something this role cannot have.
    // With the capability map in front of every query and control that should
    // not happen — so when it does, the map and the guard have drifted, or the
    // role changed under a session that is still open. Re-read the profile: if
    // the role moved, the nav, the landing page and every control follow it on
    // the next render instead of leaving a console that refuses at random.
    if (error.response?.status === 403 && !refreshingProfile) {
      refreshingProfile = true;
      platformApi
        .get('/auth/me')
        .then((r) => usePlatformAuth.getState().setAdmin(r.data))
        .catch(() => undefined)
        .finally(() => { refreshingProfile = false; });
    }
    return Promise.reject(error);
  },
);

/** One re-read at a time — a burst of 403s must not become a burst of /auth/me. */
let refreshingProfile = false;
