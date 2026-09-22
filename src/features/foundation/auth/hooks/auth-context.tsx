'use client';

import { createContext, useContext, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { api } from '@/lib/api';
import { useAuthStore } from '../store/auth-store';
import type { CurrentUser } from '@/lib/types';
import type { OrgVertical } from '@/lib/verticals';

interface AuthContextValue {
  user: CurrentUser | null;
  ready: boolean;
  login: (email: string, password: string) => Promise<void>;
  register: (payload: RegisterPayload) => Promise<void>;
  logout: () => Promise<void>;
  refreshUser: () => Promise<void>;
  hasPermission: (key: string) => boolean;
}

interface RegisterPayload {
  organizationName: string;
  firstName: string;
  lastName?: string;
  email: string;
  password: string;
  // Product/vertical-aware onboarding (OB3)
  products?: ('CRM' | 'OMNI' | 'ERP' | 'PRACTICE' | 'PMS')[];
  vertical?: OrgVertical;
  plan?: 'STARTER' | 'GROWTH' | 'PROFESSIONAL';
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const { user, ready, setAuth, setUser, setToken, setReady, clear } = useAuthStore();
  const [booted, setBooted] = useState(false);
  const router = useRouter();

  // Bootstrap: try to restore a session from the refresh cookie.
  useEffect(() => {
    if (booted) return;
    setBooted(true);
    (async () => {
      try {
        const res = await api.post('/auth/refresh');
        setToken(res.data.accessToken);
        const me = await api.get('/auth/me');
        setUser(me.data);
      } catch {
        clear();
      } finally {
        setReady(true);
      }
    })();
  }, [booted, clear, setReady, setToken, setUser]);

  const login = async (email: string, password: string) => {
    const res = await api.post('/auth/login', { email, password });
    setAuth(res.data.accessToken, res.data.user);
    router.push('/dashboard');
  };

  const register = async (payload: RegisterPayload) => {
    const res = await api.post('/auth/register', payload);
    setAuth(res.data.accessToken, res.data.user);
    router.push('/dashboard');
  };

  const logout = async () => {
    try {
      await api.post('/auth/logout');
    } finally {
      clear();
      router.push('/login');
    }
  };

  const refreshUser = async () => {
    const me = await api.get('/auth/me');
    setUser(me.data);
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        ready,
        login,
        register,
        logout,
        refreshUser,
        hasPermission: (key) => user?.permissions.includes(key) ?? false,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}
