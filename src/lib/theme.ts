'use client';

import { create } from 'zustand';

type Theme = 'light' | 'dark';

interface ThemeState {
  theme: Theme;
  setTheme: (t: Theme) => void;
  toggle: () => void;
}

function apply(theme: Theme) {
  if (typeof document !== 'undefined') {
    document.documentElement.setAttribute('data-theme', theme);
  }
  if (typeof localStorage !== 'undefined') {
    localStorage.setItem('bmn-theme', theme);
  }
}

export const useTheme = create<ThemeState>((set, get) => ({
  theme: 'light',
  setTheme: (theme) => {
    apply(theme);
    set({ theme });
  },
  toggle: () => {
    const next = get().theme === 'light' ? 'dark' : 'light';
    apply(next);
    set({ theme: next });
  },
}));

/** Read persisted theme on first client render (called from ThemeInit). */
export function initTheme() {
  if (typeof localStorage === 'undefined') return;
  const saved = (localStorage.getItem('bmn-theme') as Theme) || 'light';
  document.documentElement.setAttribute('data-theme', saved);
  useTheme.setState({ theme: saved });
}
