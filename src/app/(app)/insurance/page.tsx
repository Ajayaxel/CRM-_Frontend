import { redirect } from 'next/navigation';

/**
 * /dashboard resolves to the insurance dashboard for an insurance tenant, so
 * this page would be a second URL for the same screen — and it was showing up
 * as a second "Insurance Dashboard" entry beside "Dashboard" in the sidebar.
 *
 * Kept as a redirect rather than deleted: it is the natural guess for the
 * section root and may sit in somebody's bookmarks.
 */
export default function InsurancePage() {
  redirect('/dashboard');
}
