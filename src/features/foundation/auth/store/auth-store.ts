import { create } from 'zustand';
import type { CurrentUser } from '@/lib/types';

interface AuthState {
  accessToken: string | null;
  user: CurrentUser | null;
  ready: boolean; // finished the initial refresh/bootstrap
  setAuth: (token: string, user: CurrentUser) => void;
  setToken: (token: string | null) => void;
  setUser: (user: CurrentUser | null) => void;
  setReady: (ready: boolean) => void;
  clear: () => void;
  hasPermission: (key: string) => boolean;
}

export const useAuthStore = create<AuthState>((set, get) => ({
  accessToken: null,
  user: null,
  ready: false,
  setAuth: (accessToken, user) => set({ accessToken, user }),
  setToken: (accessToken) => set({ accessToken }),
  setUser: (user) => set({ user }),
  setReady: (ready) => set({ ready }),
  clear: () => set({ accessToken: null, user: null }),
  hasPermission: (key) => get().user?.permissions.includes(key) ?? false,
}));
