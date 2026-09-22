/**
 * What a period picker holds, and the query string it becomes.
 *
 * Deliberately free of React so the offline gate can test it. The rule it
 * enforces is the client half of the server's refusal: `month` and `from`/`to`
 * are mutually exclusive, and the API rejects being handed both — so a picker
 * that leaked a stale month alongside a new range would turn every request into
 * a 400 the moment somebody switched modes.
 */

export interface PeriodValue {
  mode: 'month' | 'range';
  month: string;
  from: string;
  to: string;
}

export const emptyPeriod: PeriodValue = { mode: 'month', month: '', from: '', to: '' };

/**
 * The query string for a value, or '' for "ask for nothing" — which each
 * endpoint answers with its own default rather than an empty screen.
 *
 * A half-filled range is still sent: "since 1 April" and "up to the 30th" are
 * real questions, and the server treats an open end as open rather than as an
 * error.
 */
export function periodQuery(v: PeriodValue): string {
  if (v.mode === 'month') return v.month ? `?month=${encodeURIComponent(v.month)}` : '';
  const parts: string[] = [];
  if (v.from) parts.push(`from=${encodeURIComponent(v.from)}`);
  if (v.to) parts.push(`to=${encodeURIComponent(v.to)}`);
  return parts.length ? `?${parts.join('&')}` : '';
}

/**
 * Switching mode clears the other mode's fields. Doing this in one place keeps
 * the two screens from drifting into sending both.
 */
export function switchMode(v: PeriodValue, mode: PeriodValue['mode']): PeriodValue {
  return mode === 'month'
    ? { ...v, mode, from: '', to: '' }
    : { ...v, mode, month: '' };
}
