import type { Config } from 'tailwindcss';

const config: Config = {
  content: ['./src/**/*.{js,ts,jsx,tsx,mdx}'],
  theme: {
    extend: {
      colors: {
        // Semantic tokens backed by CSS variables (adapt to light/dark).
        bg: 'var(--bg)',
        surface: 'var(--surface)',
        'surface-2': 'var(--surface-2)',
        'surface-3': 'var(--surface-3)',
        ink: 'var(--ink)',
        'ink-2': 'var(--ink-2)',
        'ink-3': 'var(--ink-3)',
        line: 'var(--line)',
        'line-soft': 'var(--line-soft)',
        navy: 'var(--navy)',
        'navy-900': 'var(--navy-900)',
        gold: 'var(--gold)',
        success: 'var(--success)',
        danger: 'var(--danger)',
        // Legacy brand.* aliases → navy, so older markup restyles cleanly.
        brand: {
          50: 'var(--gold-bg)',
          100: 'rgba(19,35,118,0.10)',
          500: 'var(--navy)',
          600: 'var(--navy)',
          700: 'var(--navy-900)',
        },
      },
      fontFamily: {
        sans: ['var(--font)', 'system-ui', 'sans-serif'],
        mono: ['var(--mono)', 'ui-monospace', 'monospace'],
      },
    },
  },
  plugins: [],
};

export default config;
