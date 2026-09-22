'use client';

import { useEffect } from 'react';

/**
 * Last-resort error boundary. The most common client-side crash in production
 * is a stale tab after a redeploy: its HTML references hashed chunks that no
 * longer exist, so the first navigation throws a chunk-load error. That case
 * is self-inflicted and self-healing — reload once to pick up the new build.
 * Anything else gets a clean retry screen instead of Next's raw crash text.
 */
const isStaleBuild = (e: Error) =>
  /ChunkLoadError|Loading chunk|dynamically imported module|import\(\)|text\/html/i.test(`${e?.name} ${e?.message}`);

export default function GlobalError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
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
    <html>
      <body style={{ margin: 0, minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#f6f7fa', color: '#141a2e', font: '15px/1.55 ui-sans-serif,-apple-system,"Segoe UI",Roboto,Helvetica,Arial,sans-serif' }}>
        <div style={{ textAlign: 'center', padding: 32, maxWidth: 420 }}>
          <div style={{ fontSize: 40, marginBottom: 12 }}>⟳</div>
          <h1 style={{ fontSize: 20, margin: '0 0 8px' }}>A newer version of BMN Connect is available</h1>
          <p style={{ color: '#5a6377', margin: '0 0 20px', fontSize: 14 }}>
            The app updated while this tab was open. Reload to continue where you left off.
          </p>
          <button
            onClick={() => { try { sessionStorage.removeItem('bmn-reloaded'); } catch {} const u = new URL(window.location.href); u.searchParams.set('v', String(Date.now())); window.location.replace(u.toString()); }}
            style={{ height: 44, padding: '0 26px', borderRadius: 11, border: 'none', cursor: 'pointer', background: '#132376', color: '#fff', fontSize: 15, fontWeight: 700 }}
          >
            Reload
          </button>
          <button
            onClick={() => reset()}
            style={{ height: 44, padding: '0 18px', marginLeft: 10, borderRadius: 11, border: '1px solid #d9dde6', cursor: 'pointer', background: '#fff', color: '#141a2e', fontSize: 14 }}
          >
            Try again
          </button>
        </div>
      </body>
    </html>
  );
}
