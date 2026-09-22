'use client';

/**
 * Opens a server-rendered document in a new tab, carrying the caller's token.
 *
 * A plain `<a href>` cannot be used: both realms authenticate with a Bearer
 * token held in memory (staff) or localStorage (portal), not a cookie, so a
 * link to `/api/…/print` arrives unauthenticated and 401s. So the HTML is
 * fetched with the header attached and written into a tab we opened.
 *
 * The tab is opened SYNCHRONOUSLY, before the await. A `window.open` that
 * happens after an await has lost the user's click as far as the popup blocker
 * is concerned, and the document silently never appears.
 *
 * Written into the tab rather than handed over as a blob URL because the
 * document's own "Print / Save as PDF" button has to work, and because a blob
 * URL for a page carrying medical disclosures is one more handle to that data
 * sitting in the browser waiting to be revoked.
 */
export async function openDocument(url: string, token?: string | null): Promise<void> {
  const tab = typeof window !== 'undefined' ? window.open('', '_blank', 'noopener') : null;
  try {
    const r = await fetch(url, {
      credentials: 'include',
      headers: token ? { Authorization: `Bearer ${token}` } : {},
    });
    if (!r.ok) throw new Error(r.status === 401 || r.status === 403 ? 'Not allowed' : `Failed (${r.status})`);
    const html = await r.text();
    if (!tab) throw new Error('Allow pop-ups for this site to open the document.');
    tab.document.open();
    tab.document.write(html);
    tab.document.close();
  } catch (e) {
    tab?.close();
    throw e;
  }
}
