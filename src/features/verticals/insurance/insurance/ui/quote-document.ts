import { api } from '@/lib/api';
import { DOC_CSS, esc, fmtDate, human, money, type Benefit } from './schedule-document';

/**
 * The quotation a customer is sent, as a comparison rather than a price.
 *
 * A quote's whole value is that it puts insurers beside each other. The console
 * already does that on screen; until now nothing left the building — the broker
 * had a comparison and the customer got a number over the phone.
 *
 * Modelled on the insurer packs brokers already send (the ICICI Elevate quote),
 * with one deliberate difference: theirs compares one insurer's own tiers,
 * because that is all an insurer can offer. A broker's document compares
 * INSURERS, so the plans are the columns and the benefits are the rows, and the
 * customer can read across a line to see what changes.
 *
 * WHAT IS NOT HERE, AND WHY:
 *
 * The reference prints a tenure grid — 1 through 5 years against two sums
 * insured. Nothing in this book holds a multi-year premium: `InsQuoteLine` has
 * one `premiumInr` for one `sumInsuredInr`, and a 3-year figure is not 3× the
 * annual one — insurers discount long tenures on their own schedules. Printing
 * a multiplied guess would put a price on a customer document that no insurer
 * has quoted. So the grid is omitted until the line can carry real tenure
 * pricing, which is a schema change.
 */

export interface QuoteDocLine {
  id: string;
  productId?: string;
  companyName: string;
  productName: string;
  premiumInr: number;
  sumInsuredInr: number;
  coverage?: string | null;
  addOns?: string | null;
  exclusions?: string | null;
  recommended?: boolean;
}

export interface QuoteDoc {
  reference: string;
  category: string;
  status: string;
  createdAt: string;
  client?: { name?: string | null; phone?: string | null; email?: string | null } | null;
  requirement?: { sumInsuredInr?: number | null } | null;
  lines?: QuoteDocLine[];
}

/** Cover bought per rupee of premium — the ratio the recommendation is made on. */
const ratio = (l: QuoteDocLine) => (l.premiumInr > 0 ? l.sumInsuredInr / l.premiumInr : 0);

async function benefitsFor(productId?: string): Promise<Benefit[]> {
  if (!productId) return [];
  try {
    return (await api.get<Benefit[]>(`/insurance/products/${productId}/benefits`)).data ?? [];
  } catch {
    return [];
  }
}

/**
 * Benefit rows across every quoted plan, in the order the first plan that
 * mentions each one lists it.
 *
 * A union rather than an intersection: a benefit only one insurer offers is
 * exactly what a comparison is FOR, and dropping it because the others are
 * silent would quietly favour the plans with the shortest wording. Where a plan
 * says nothing the cell reads "—", which is honest — the master does not record
 * it, which is not the same as the insurer excluding it, and the footer says so.
 */
function matrix(perPlan: Benefit[][], section: 'COVERAGE' | 'WAITING') {
  const order: string[] = [];
  const seen = new Set<string>();
  for (const rows of perPlan) {
    for (const b of rows) {
      if (b.section !== section) continue;
      if (seen.has(b.label)) continue;
      seen.add(b.label);
      order.push(b.label);
    }
  }
  return order.map((label) => ({
    label,
    values: perPlan.map((rows) => rows.find((b) => b.section === section && b.label === label)?.value ?? null),
  }));
}

function matrixTable(
  rows: { label: string; values: (string | null)[] }[],
  lines: QuoteDocLine[],
  firstCol: string,
) {
  if (!rows.length) return '';
  return `<table class="cover"><thead><tr><th>${esc(firstCol)}</th>${
    lines.map((l) => `<th>${esc(l.companyName)}</th>`).join('')
  }</tr></thead><tbody>${
    rows.map((r) => `<tr><td>${esc(r.label)}</td>${
      r.values.map((v) => `<td>${v == null ? '<span class="muted">—</span>' : esc(v)}</td>`).join('')
    }</tr>`).join('')
  }</tbody></table>`;
}

export async function renderQuote(q: QuoteDoc, opts: { orgName?: string } = {}): Promise<string> {
  const lines = [...(q.lines ?? [])].sort((a, b) => ratio(b) - ratio(a));
  const perPlan = await Promise.all(lines.map((l) => benefitsFor(l.productId)));
  const org = opts.orgName || 'Insurance broking';
  const best = lines.find((l) => l.recommended) ?? lines[0];
  const anyBenefits = perPlan.some((r) => r.length);
  const asked = q.requirement?.sumInsuredInr ?? null;

  const priceRow = (label: string, cell: (l: QuoteDocLine, i: number) => string) =>
    `<tr><td>${esc(label)}</td>${lines.map((l, i) => `<td>${cell(l, i)}</td>`).join('')}</tr>`;

  return `<!doctype html><html><head><meta charset="utf-8"/>
<title>Quotation ${esc(q.reference)}</title><style>${DOC_CSS}
  .rec{display:inline-block;background:#132376;color:#fff;font-size:9.5px;letter-spacing:.08em;text-transform:uppercase;padding:2px 7px;border-radius:99px;font-weight:700;margin-left:6px}
  td.plan{font-weight:700}
</style></head><body>

<div class="masthead">
  <div>
    <div class="brand">${esc(org)}</div>
    <h1>Insurance quotation</h1>
    <div class="sub">${esc(human(q.category))} · ${lines.length} insurer${lines.length === 1 ? '' : 's'} compared</div>
  </div>
  <div class="ref">
    <div class="no">${esc(q.reference)}</div>
    <div class="sub">Prepared ${esc(fmtDate(new Date()))}</div>
  </div>
</div>

<h2>Prepared for</h2>
<table class="kv">
  <tr><th>Name</th><td>${esc(q.client?.name ?? '—')}</td></tr>
  <tr><th>Contact</th><td>${esc([q.client?.phone, q.client?.email].filter(Boolean).join(' · ') || '—')}</td></tr>
  <tr><th>Cover sought</th><td>${esc(human(q.category))}${asked ? ` · sum insured ${esc(money(asked))}` : ''}</td></tr>
</table>

${lines.length ? `
<h2>Premium options</h2>
<table class="cover">
  <thead><tr><th>&nbsp;</th>${lines.map((l) => `<th>${esc(l.companyName)}${l.id === best?.id ? '<span class="rec">Recommended</span>' : ''}</th>`).join('')}</tr></thead>
  <tbody>
    ${priceRow('Plan', (l) => `<span class="plan">${esc(l.productName)}</span>`)}
    ${priceRow('Sum insured', (l) => esc(money(l.sumInsuredInr)))}
    ${priceRow('Annual premium', (l) => `<strong>${esc(money(l.premiumInr))}</strong>`)}
    ${priceRow('Cover per ₹1 of premium', (l) => `${(ratio(l)).toFixed(1)}×`)}
  </tbody>
</table>
<p class="muted" style="margin-top:8px">
  The recommendation is the plan giving the most cover for each rupee of premium. It is not always the
  cheapest, and the cheapest is not always the best value.
</p>` : '<p class="muted">No plans have been added to this quotation yet.</p>'}

${anyBenefits ? `<h2>What each plan covers</h2>${matrixTable(matrix(perPlan, 'COVERAGE'), lines, 'Benefit')}` : ''}
${anyBenefits ? (() => { const w = matrix(perPlan, 'WAITING'); return w.length ? `<h2>Waiting periods</h2>${matrixTable(w, lines, 'Condition')}` : ''; })() : ''}
${!anyBenefits ? `<p class="muted" style="margin-top:18px">Benefit-level cover is not recorded against these products yet. Add it under Administration → Insurers → the product, and it will print here as a comparison.</p>` : ''}

${lines.some((l) => l.addOns || l.exclusions) ? `<h2>Noted on the quotation</h2>
<table class="kv">
  ${lines.filter((l) => l.addOns || l.exclusions).map((l) => `
    <tr><th>${esc(l.companyName)}</th><td>
      ${l.addOns ? `<div><strong>Add-ons:</strong> ${esc(l.addOns)}</div>` : ''}
      ${l.exclusions ? `<div><strong>Exclusions:</strong> ${esc(l.exclusions)}</div>` : ''}
    </td></tr>`).join('')}
</table>` : ''}

<div class="legal">
  This quotation is an indication of terms available through the broker and is not a contract of
  insurance. Premiums are subject to the insurer's underwriting and may change on the information
  disclosed; cover begins only when the insurer issues a policy. A blank cell means the benefit is not
  recorded against that plan here, which is not a statement that the insurer excludes it — the
  insurer's own policy wording governs in every case.
</div>

<div class="toolbar noprint"><button onclick="window.print()">Print / Save as PDF</button></div>
</body></html>`;
}

/** Open the quotation in a print window. Returns false if pop-ups are blocked. */
export async function openQuote(q: QuoteDoc, opts: { orgName?: string } = {}): Promise<boolean> {
  const w = window.open('', '_blank');
  if (!w) return false;
  w.document.write('<!doctype html><title>Preparing quotation…</title><body style="font-family:sans-serif;padding:34px;color:#6b6260">Preparing the quotation…</body>');
  const html = await renderQuote(q, opts);
  w.document.open();
  w.document.write(html);
  w.document.close();
  return true;
}
