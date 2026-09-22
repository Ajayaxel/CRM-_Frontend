/**
 * The commission split, for the screen.
 *
 * A deliberate mirror of apps/api/src/insurance/commission-split.ts. The two
 * are kept identical by scripts/commission-split-offline.ts, which computes the
 * same case through both and fails if they disagree.
 *
 * They are separate files rather than one import because the web bundle does
 * not reach into the API's source tree anywhere else, and adding a first
 * cross-package import for six lines of arithmetic would drag the API's module
 * graph into the browser build. The duplication is small, pinned by a test, and
 * cheaper than that.
 *
 * The agency is the REMAINDER. It is what is left after the two people who are
 * owed money are paid, which is the only definition that cannot drift out of
 * step with the other two — and it keeps
 * `Company Profit = Payout − Agent − Executive` true by construction.
 */

export interface Split {
  grossInr: number;
  agentInr: number;
  execInr: number;
  companyProfitInr: number;
  agentPct: number;
  execPct: number;
  companyProfitPct: number;
  overAllocated: boolean;
}

/**
 * Amounts win over percentages, mirroring the API. The compare screen types
 * rupees — commissions are agreed as figures, not always as rates — so the
 * amount is the input and the percentage is a reading of it.
 */
export function computeSplit(input: {
  premiumInr: number;
  brokerageRatePct: number;
  agentSharePct?: number | null;
  execSharePct?: number | null;
  agentInr?: number | null;
  execInr?: number | null;
}): Split {
  const premium = Math.max(0, Math.round(input.premiumInr || 0));
  const gross = Math.round((premium * (input.brokerageRatePct || 0)) / 100);
  const agentInr = input.agentInr != null
    ? Math.round(input.agentInr)
    : Math.round((gross * (input.agentSharePct ?? 0)) / 100);
  const execInr = input.execInr != null
    ? Math.round(input.execInr)
    : Math.round((gross * (input.execSharePct ?? 0)) / 100);
  const companyProfitInr = gross - agentInr - execInr;
  const pct = (n: number) => (gross > 0 ? Math.round((n / gross) * 10000) / 100 : 0);
  return {
    grossInr: gross,
    agentInr,
    execInr,
    companyProfitInr,
    agentPct: pct(agentInr),
    execPct: pct(execInr),
    companyProfitPct: pct(companyProfitInr),
    overAllocated: companyProfitInr < 0,
  };
}
