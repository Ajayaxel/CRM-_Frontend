'use client';

/**
 * A bunk bed with two independently bookable mattresses.
 *
 * Drawn rather than boxed. The brief was explicit that this must not read as
 * two stacked cards, because a receptionist scanning a dormitory is looking for
 * a BED — so the frame has posts, each mattress has a pillow and a visible
 * thickness, and the top berth sits on rails above the bottom one.
 *
 * All of it is CSS and inline SVG: no images to load, it scales with the grid,
 * and it inherits the theme's tokens so it survives dark mode. Colour never
 * carries the state alone — every berth has a dot AND the word underneath.
 *
 * TOP and BOTTOM are separate buttons on purpose. A bunk is not the unit of
 * sale; a mattress is. If the top is taken the bottom must still be reachable,
 * by mouse and by keyboard.
 */

import { Check } from 'lucide-react';
import type { Bedspace, BedspaceStatus } from './types';

const TONE: Record<BedspaceStatus, { fg: string; bg: string; line: string; word: string }> = {
  available:      { fg: 'var(--tone-active)',  bg: 'var(--tone-active-bg)',  line: 'var(--tone-active-line)',  word: 'Available' },
  occupied:       { fg: 'var(--tone-sales)',   bg: 'var(--tone-sales-bg)',   line: 'var(--tone-sales-line)',   word: 'Occupied' },
  reserved:       { fg: 'var(--tone-sales)',   bg: 'var(--tone-sales-bg)',   line: 'var(--tone-sales-line)',   word: 'Reserved' },
  needs_cleaning: { fg: 'var(--tone-renewal)', bg: 'var(--tone-renewal-bg)', line: 'var(--tone-renewal-line)', word: 'Needs cleaning' },
  out_of_order:   { fg: 'var(--tone-expired)', bg: 'var(--tone-expired-bg)', line: 'var(--tone-expired-line)', word: 'Out of order' },
};

/** One mattress: pillow, ticking, and a state dot. */
function Berth({
  space, tier, label, selected, onSelect,
}: {
  space: Bedspace;
  tier: 'Top' | 'Bottom';
  /** The bunk as the receptionist reads it — "Bed 07". */
  label: string;
  selected: boolean;
  onSelect: () => void;
}) {
  const tone = TONE[space.status];
  const on = selected;
  const clickable = space.selectable;

  return (
    <button
      type="button"
      className={
        // replaceAll, not replace: `replace` swaps only the FIRST underscore, so
        // out_of_order became "is-out-of_order" and the strike-through rule —
        // the whole point of not leaning on colour — silently never matched.
        `hs-berth is-${space.status.replaceAll('_', '-')}` +
        (on ? ' is-selected' : '') + (clickable ? '' : ' is-locked')
      }
      onClick={clickable ? onSelect : undefined}
      // aria-disabled rather than disabled: a taken bed must still be reachable
      // by keyboard, because the reason it cannot be sold — who holds it — is
      // in this button's label and nowhere else. A `disabled` button drops out
      // of the tab order and takes that explanation with it.
      aria-disabled={!clickable}
      aria-pressed={clickable ? on : undefined}
      aria-label={
        `${tier} bedspace, ${label}, ${on ? 'selected' : tone.word}` +
        (space.guestName ? `, held by ${space.guestName}` : '') +
        (space.note ? `, ${space.note}` : '')
      }
      title={[`${label} · ${tier} — ${tone.word}`, space.guestName, space.note]
        .filter(Boolean).join(' · ')}
      style={{
        // Selection keeps the availability semantics: it is a stronger green,
        // not a different colour, so "selected" never reads as a new state.
        borderColor: on ? 'var(--tone-active)' : tone.line,
        background: on ? 'var(--tone-active-bg)' : space.status === 'available' ? 'var(--surface)' : tone.bg,
      }}
    >
      {/* pillow */}
      <span className="hs-berth-pillow" aria-hidden />
      {/* ticking — the quilted lines that make it read as a mattress */}
      <svg className="hs-berth-ticking" viewBox="0 0 100 26" preserveAspectRatio="none" aria-hidden>
        <path d="M0 13h100M0 20h100" stroke="currentColor" strokeWidth="0.8" opacity="0.25" />
      </svg>
      <span className="hs-berth-label">{tier}</span>
      <span className="hs-berth-dot" style={{ background: on ? 'var(--tone-active)' : tone.fg }} aria-hidden>
        {on && <Check size={9} strokeWidth={4} color="var(--surface)" />}
      </span>
    </button>
  );
}

export function BunkBed({
  bunk, pad, selectedCode, onSelect,
}: {
  bunk: { number: number; top?: Bedspace | null; bottom?: Bedspace | null };
  /** Zero-pad the number so a 24-bunk room's labels line up: Bed 07, Bed 21. */
  pad: number;
  selectedCode: string | null;
  onSelect: (space: Bedspace) => void;
}) {
  const label = `Bed ${String(bunk.number).padStart(pad, '0')}`;
  // No status word under the frame. Each mattress carries its own state, and a
  // single word for the bunk could only ever describe one of the two — a bunk
  // with a guest on top and a free bed below was being labelled "Reserved",
  // which is the opposite of what the receptionist needs to know.
  const spaces = [bunk.top, bunk.bottom].filter(Boolean) as Bedspace[];
  const anySelected = spaces.some((s) => s.code === selectedCode);

  return (
    <div className="hs-bunk">
      <span className={`hs-bunk-no${anySelected ? ' is-selected' : ''}`}
            style={anySelected ? { borderColor: 'var(--tone-active)', color: 'var(--tone-active)' } : undefined}>
        {label}
      </span>

      <div className="hs-bunk-frame">
        {/* posts — the uprights that make it a bunk rather than two beds */}
        <span className="hs-post hs-post-l" aria-hidden />
        <span className="hs-post hs-post-r" aria-hidden />

        <div className="hs-bunk-berths">
          {bunk.top && (
            <Berth space={bunk.top} tier="Top" label={label}
                   selected={bunk.top.code === selectedCode}
                   onSelect={() => onSelect(bunk.top!)} />
          )}
          {/* the rail the top berth stands on */}
          <span className="hs-bunk-rail" aria-hidden />
          {bunk.bottom && (
            <Berth space={bunk.bottom} tier="Bottom" label={label}
                   selected={bunk.bottom.code === selectedCode}
                   onSelect={() => onSelect(bunk.bottom!)} />
          )}
        </div>

        {/* feet */}
        <span className="hs-foot hs-foot-l" aria-hidden />
        <span className="hs-foot hs-foot-r" aria-hidden />
      </div>

    </div>
  );
}
