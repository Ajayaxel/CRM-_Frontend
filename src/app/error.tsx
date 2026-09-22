'use client';

import { useEffect } from 'react';

/** Segment-level twin of global-error: auto-recover stale-build chunk errors,
 *  clean retry card for everything else. */
const isStaleBuild = (e: Error) =>
  /ChunkLoadError|Loading chunk|dynamically imported module|import\(\)|text\/html/i.test(`${e?.name} ${e?.message}`);

export default function AppError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    try {
      if (isStaleBuild(error) && !sessionStorage.getItem('bmn-reloaded')) {
        sessionStorage.setItem('bmn-reloaded', '1');
        // cache-busting param defeats a browser cache that keeps serving the
        // stale document (Safari does this) — the server ignores it
        const u = new URL(window.location.href);
        u.searchParams.set('v', String(Date.now()));
        window.location.replace(u.toString());
      } else {
        sessionStorage.removeItem('bmn-reloaded');
      }
    } catch {
      // storage unavailable (private mode) — leave the manual card visible
    }
  }, [error]);

  return (
    <div style={{ minHeight: '60vh', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <div style={{ textAlign: 'center', padding: 32, maxWidth: 420 }}>
        <div style={{ fontSize: 34, marginBottom: 10 }}>⟳</div>
        <div style={{ fontSize: 17, fontWeight: 700, marginBottom: 6 }}>Something needed a refresh</div>
        <p style={{ color: 'var(--ink-3,#5a6377)', fontSize: 13.5, margin: '0 0 18px' }}>
          If the app was just updated, reloading picks up the new version.
        </p>
        <button className="btn-primary" style={{ height: 40, padding: '0 22px' }} onClick={() => { try { sessionStorage.removeItem('bmn-reloaded'); } catch {} const u = new URL(window.location.href); u.searchParams.set('v', String(Date.now())); window.location.replace(u.toString()); }}>
          Reload
        </button>
        <button className="btn-secondary" style={{ height: 40, padding: '0 16px', marginLeft: 8 }} onClick={() => reset()}>
          Try again
        </button>
      </div>
    </div>
  );
}
