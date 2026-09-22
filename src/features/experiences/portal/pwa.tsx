'use client';

import { useEffect, useState } from 'react';
import { Download, X } from 'lucide-react';

// Registers the portal service worker and offers a native install prompt.
export function PortalPwa() {
  const [prompt, setPrompt] = useState<any>(null);
  const [dismissed, setDismissed] = useState(false);

  useEffect(() => {
    if ('serviceWorker' in navigator) {
      // The ?v= makes each deploy a DIFFERENT worker URL, so the browser installs it
      // and the activate handler purges the previous build's caches.
      const v = process.env.NEXT_PUBLIC_BUILD_ID || 'dev';
      navigator.serviceWorker.register(`/sw.js?v=${v}`, { scope: '/portal' })
        .then((reg) => { reg.update().catch(() => {}); })
        .catch(() => {});
    }
    const onPrompt = (e: Event) => { e.preventDefault(); setPrompt(e); };
    window.addEventListener('beforeinstallprompt', onPrompt);
    const onInstalled = () => { setPrompt(null); setDismissed(true); };
    window.addEventListener('appinstalled', onInstalled);
    return () => { window.removeEventListener('beforeinstallprompt', onPrompt); window.removeEventListener('appinstalled', onInstalled); };
  }, []);

  if (!prompt || dismissed) return null;

  const install = async () => {
    try { prompt.prompt(); await prompt.userChoice; } finally { setPrompt(null); }
  };

  return (
    <div style={{ position: 'fixed', left: 16, right: 16, bottom: 16, zIndex: 80, display: 'flex', justifyContent: 'center', pointerEvents: 'none' }}>
      <div style={{ pointerEvents: 'auto', display: 'flex', alignItems: 'center', gap: 12, background: 'var(--surface)', border: '1px solid var(--line-soft)', borderRadius: 14, padding: '10px 12px 10px 16px', boxShadow: '0 10px 30px rgba(0,0,0,.14)', maxWidth: 460, width: '100%' }}>
        <div style={{ flex: 1 }}>
          {/* Deliberately vertical-neutral. This banner shows on the activation
              page, before anyone has signed in, so there is no organisation to
              ask what it should be called — and "learning portal" was appearing
              to an insurance broker's customers. */}
          <div style={{ fontWeight: 700, fontSize: 13.5 }}>Install this portal</div>
          <div style={{ fontSize: 12, color: 'var(--ink-3)' }}>Add it to your home screen for one-tap access.</div>
        </div>
        <button className="btn-primary" style={{ height: 34 }} onClick={install}><Download size={14} /> Install</button>
        <button onClick={() => setDismissed(true)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--ink-3)', padding: 4 }} aria-label="Dismiss"><X size={16} /></button>
      </div>
    </div>
  );
}
