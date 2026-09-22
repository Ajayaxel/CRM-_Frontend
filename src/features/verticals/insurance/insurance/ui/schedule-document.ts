import { api } from '@/lib/api';
import { fmtOrgMoney, orgLocale } from '@/lib/org-locale';

/**
 * The policy schedule as a document a customer is willing to receive.
 *
 * What this replaces was four tables and a print button — accurate, and
 * indistinguishable from a database dump. An insurer's own pack (the ICICI
 * Elevate quote this is modelled on) opens with who is covered, states the
 * money once and plainly, then spends most of its length on WHAT IS ACTUALLY
 * COVERED, because that is the only part the customer cannot work out for
 * themselves.
 *
 * So the layout is deliberate rather than decorative:
 *
 *   - one masthead carrying the broker, the plan and the reference
 *   - the headline figures as figures, not as rows of a table
 *   - Summary of Coverage and Waiting periods as their own sections, from
 *     InsProductBenefit, printed only when the product master has them
 *   - the regulatory line last, where the insurer's own document puts it
 *
 * Rendered into a print window rather than generated server-side: the browser's
 * own print dialog is the PDF path, it needs no endpoint and no stored file,
 * and the document therefore cannot disagree with the record it was made from.
 * Same mechanism the customer portal already uses.
 */

export const money = (n?: number | null) => fmtOrgMoney(n);

export function fmtDate(d?: string | Date | null) {
  if (!d) return '—';
  return new Date(d).toLocaleDateString(orgLocale().locale || undefined, {
    day: '2-digit', month: 'short', year: 'numeric',
  });
}

/** HTML-escape everything interpolated: this is customer data going into markup. */
export function esc(s: unknown): string {
  return String(s ?? '')
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
}

export interface Benefit { id: string; section: string; label: string; value: string }

export const human = (s?: string) => (!s ? '' : s.charAt(0) + s.slice(1).toLowerCase().replace(/_/g, ' '));

export interface SchedulePolicy {
  policyNo: string;
  productName: string;
  companyName: string;
  category: string;
  status: string;
  premiumInr: number;
  sumInsuredInr: number;
  startDate: string;
  endDate: string;
  graceDays?: number;
  productId?: string;
  executiveName?: string | null;
  client?: { name?: string; phone?: string | null; email?: string | null } | null;
}

export interface ScheduleClaim {
  claimNo: string; incidentDate: string; status: string; settledInr?: number | null;
}

export const DOC_CSS = `
  @page { margin: 16mm; }
  *{box-sizing:border-box}
  body{font-family:-apple-system,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;color:#1c1612;margin:0;padding:34px;font-size:13px;line-height:1.5}
  .masthead{display:flex;justify-content:space-between;align-items:flex-start;gap:24px;padding-bottom:16px;border-bottom:3px solid #132376}
  .brand{font-size:11px;letter-spacing:.14em;text-transform:uppercase;color:#132376;font-weight:700}
  h1{font-size:23px;margin:6px 0 3px;letter-spacing:-.01em}
  .sub{color:#6b6260;font-size:12px}
  .ref{text-align:right;white-space:nowrap}
  .ref .no{font-size:17px;font-weight:700;letter-spacing:.02em}
  .figures{display:flex;gap:0;margin:22px 0 6px;border:1px solid #e2dcd4;border-radius:8px;overflow:hidden}
  .fig{flex:1;padding:14px 16px;border-right:1px solid #e2dcd4}
  .fig:last-child{border-right:0}
  .fig .k{font-size:10.5px;letter-spacing:.09em;text-transform:uppercase;color:#6b6260;font-weight:600}
  .fig .v{font-size:18px;font-weight:700;margin-top:4px}
  .fig .n{font-size:11px;color:#6b6260;margin-top:2px}
  h2{font-size:12px;letter-spacing:.1em;text-transform:uppercase;color:#132376;margin:26px 0 9px;font-weight:700}
  table{width:100%;border-collapse:collapse}
  th,td{padding:8px 11px;border:1px solid #e2dcd4;text-align:left;font-size:12.5px;vertical-align:top}
  th{background:#f7f4f0;font-size:10.5px;text-transform:uppercase;letter-spacing:.06em;color:#4a423e;font-weight:700;white-space:nowrap}
  table.kv th{width:26%}
  table.cover th:first-child{width:56%;white-space:normal}
  tbody tr:nth-child(even) td{background:#fcfaf8}
  .muted{color:#6b6260;font-size:11.5px}
  .legal{margin-top:26px;padding-top:12px;border-top:1px solid #e2dcd4;color:#6b6260;font-size:10.5px;line-height:1.6}
  .toolbar{margin-top:28px}
  .toolbar button{padding:10px 20px;font-size:13px;cursor:pointer;border:1px solid #132376;background:#132376;color:#fff;border-radius:6px;font-weight:600}
  @media print { .noprint{display:none} body{padding:0} }
`;

function kv(rows: [string, string][]) {
  return `<table class="kv">${rows.map(([k, v]) => `<tr><th>${esc(k)}</th><td>${v}</td></tr>`).join('')}</table>`;
}

function benefitTable(rows: Benefit[], firstCol: string) {
  if (!rows.length) return '';
  return `<table class="cover"><thead><tr><th>${esc(firstCol)}</th><th>Coverage</th></tr></thead><tbody>${
    rows.map((b) => `<tr><td>${esc(b.label)}</td><td>${esc(b.value)}</td></tr>`).join('')
  }</tbody></table>`;
}

/**
 * Benefits are fetched, not passed in, so every call site gets the coverage
 * table without threading a second query through screens that do not otherwise
 * care. A failure here is swallowed on purpose: the schedule is the money and
 * the dates, and a customer waiting for their policy document should not be
 * refused it because the product master could not be read.
 */
async function loadBenefits(productId?: string): Promise<Benefit[]> {
  if (!productId) return [];
  try {
    return (await api.get<Benefit[]>(`/insurance/products/${productId}/benefits`)).data ?? [];
  } catch {
    return [];
  }
}

export async function renderSchedule(
  p: SchedulePolicy,
  claims: ScheduleClaim[],
  opts: { orgName?: string } = {},
): Promise<string> {
  const benefits = await loadBenefits(p.productId);
  const coverage = benefits.filter((b) => b.section !== 'WAITING');
  const waiting = benefits.filter((b) => b.section === 'WAITING');
  const org = opts.orgName || 'Policy schedule';

  return `<!doctype html><html><head><meta charset="utf-8"/>
<title>Policy ${esc(p.policyNo)} — ${esc(p.productName)}</title><style>${DOC_CSS}</style></head><body>

<div class="masthead">
  <div>
    <div class="brand">${esc(org)}</div>
    <h1>${esc(p.productName)}</h1>
    <div class="sub">${esc(p.companyName)} · ${esc(human(p.category))} · policy schedule</div>
  </div>
  <div class="ref">
    <div class="no">${esc(p.policyNo)}</div>
    <div class="sub">Generated ${esc(fmtDate(new Date()))}</div>
  </div>
</div>

<div class="figures">
  <div class="fig"><div class="k">Sum insured</div><div class="v">${esc(money(p.sumInsuredInr))}</div></div>
  <div class="fig"><div class="k">Annual premium</div><div class="v">${esc(money(p.premiumInr))}</div></div>
  <div class="fig"><div class="k">Cover period</div><div class="v" style="font-size:14px">${esc(fmtDate(p.startDate))} → ${esc(fmtDate(p.endDate))}</div><div class="n">${esc(p.graceDays ?? 15)} day grace period</div></div>
  <div class="fig"><div class="k">Status</div><div class="v" style="font-size:14px">${esc(human(p.status))}</div></div>
</div>

<h2>Insured</h2>
${kv([
  ['Name', esc(p.client?.name ?? '—')],
  ['Contact', esc([p.client?.phone, p.client?.email].filter(Boolean).join(' · ') || '—')],
  ...(p.executiveName ? [['Serviced by', esc(p.executiveName)] as [string, string]] : []),
])}

<h2>Cover</h2>
${kv([
  ['Insurer', esc(p.companyName)],
  ['Product', `${esc(p.productName)} (${esc(human(p.category))})`],
  ['Policy number', esc(p.policyNo)],
])}

${coverage.length ? `<h2>Summary of coverage</h2>${benefitTable(coverage, 'Benefit')}` : ''}
${waiting.length ? `<h2>Waiting periods</h2>${benefitTable(waiting, 'Condition')}` : ''}
${!benefits.length ? `<p class="muted" style="margin-top:18px">Benefit-level cover is not recorded against this product yet. Add it under Administration → Insurers → this product, and it will print here.</p>` : ''}

${claims.length ? `<h2>Claims on this policy</h2>
<table><thead><tr><th>Claim</th><th>Incident</th><th>Status</th><th>Settled</th></tr></thead><tbody>
${claims.map((c) => `<tr><td>${esc(c.claimNo)}</td><td>${esc(fmtDate(c.incidentDate))}</td><td>${esc(human(c.status))}</td><td>${c.settledInr != null ? esc(money(c.settledInr)) : '—'}</td></tr>`).join('')}
</tbody></table>` : ''}

<div class="legal">
  This schedule summarises the cover placed through the broker and is issued for information only.
  The insurer's own policy wording governs the contract of insurance; where this document and that
  wording differ, the wording prevails. Benefit descriptions are as recorded against the product at
  the time of printing.
</div>

<div class="toolbar noprint"><button onclick="window.print()">Print / Save as PDF</button></div>
</body></html>`;
}

/** Open the schedule in a print window. Returns false if pop-ups are blocked. */
export async function openSchedule(
  p: SchedulePolicy,
  claims: ScheduleClaim[],
  opts: { orgName?: string } = {},
): Promise<boolean> {
  const w = window.open('', '_blank');
  if (!w) return false;
  // Written before the await would resolve on a blocked-then-allowed window, so
  // the tab is never left blank while the benefits call is in flight.
  w.document.write('<!doctype html><title>Preparing schedule…</title><body style="font-family:sans-serif;padding:34px;color:#6b6260">Preparing the schedule…</body>');
  const html = await renderSchedule(p, claims, opts);
  w.document.open();
  w.document.write(html);
  w.document.close();
  return true;
}
