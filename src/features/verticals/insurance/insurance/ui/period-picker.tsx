'use client';

/**
 * Choose a month, or any range of dates.
 *
 * One component for both agent-business screens on purpose. They ask the same
 * question of the same endpoint family, and two pickers that drifted apart
 * would let the company view and an agent's own record disagree about what
 * "April" means — which is the exact failure the UTC bounds on the server were
 * written to prevent.
 *
 * The month list is what the SERVER says has business in it, so the dropdown
 * can never offer an empty month. A custom range has no such list, which is the
 * point: a quarter, a fortnight, or the window between two rate changes are all
 * periods nobody could ask for before.
 *
 * `month` and `from`/`to` are mutually exclusive and the API refuses both, so
 * this only ever emits one of them.
 */

import { useState } from 'react';
import { switchMode, type PeriodValue } from './period';

export { emptyPeriod, periodQuery, type PeriodValue } from './period';

export function PeriodPicker({
  id,
  value,
  onChange,
  months,
  selectedMonth,
}: {
  /** Prefix for the field ids, so two pickers on one page stay distinct. */
  id: string;
  value: PeriodValue;
  onChange: (v: PeriodValue) => void;
  months: { month: string; label: string }[];
  /** What the server actually scoped to, so the dropdown shows the truth. */
  selectedMonth?: string | null;
}) {
  // Local so switching to Custom and back does not fire a request per keystroke
  // on a half-typed date.
  const [draft, setDraft] = useState({ from: value.from, to: value.to });

  const set = (patch: Partial<PeriodValue>) => onChange({ ...value, ...patch });

  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
      <label className="label" htmlFor={`${id}-mode`} style={{ margin: 0 }}>Period</label>
      <select
        id={`${id}-mode`}
        className="input"
        style={{ width: 'auto' }}
        value={value.mode}
        // Switching modes must not leave the other mode's fields on the
        // request — the API refuses a month and a range together.
        onChange={(e) => onChange(switchMode(value, e.target.value as PeriodValue['mode']))}
      >
        <option value="month">Month</option>
        <option value="range">Custom range</option>
      </select>

      {value.mode === 'month' ? (
        <select
          id={`${id}-month`}
          className="input"
          aria-label="Month"
          style={{ width: 'auto', minWidth: 170 }}
          value={value.month || selectedMonth || ''}
          onChange={(e) => set({ month: e.target.value })}
        >
          {months.map((m) => <option key={m.month} value={m.month}>{m.label}</option>)}
        </select>
      ) : (
        <>
          <input
            id={`${id}-from`}
            type="date"
            className="input"
            aria-label="From"
            style={{ width: 'auto' }}
            value={draft.from}
            onChange={(e) => setDraft((d) => ({ ...d, from: e.target.value }))}
            onBlur={() => set({ from: draft.from })}
          />
          <span className="ds-caption" aria-hidden="true">to</span>
          <input
            id={`${id}-to`}
            type="date"
            className="input"
            aria-label="To"
            style={{ width: 'auto' }}
            value={draft.to}
            onChange={(e) => setDraft((d) => ({ ...d, to: e.target.value }))}
            onBlur={() => set({ to: draft.to })}
          />
          {(draft.from || draft.to) && (
            <button
              type="button"
              className="btn-ghost btn-sm"
              onClick={() => { setDraft({ from: '', to: '' }); set({ mode: 'month', from: '', to: '' }); }}
            >
              Clear
            </button>
          )}
        </>
      )}
    </div>
  );
}
