'use client';

/**
 * Item modifier sheet — Figma 10:502.
 *
 * Size, add-ons and a special instruction, then Add to cart.
 *
 * THE WRITE CONTRACT HAS NOWHERE TO PUT ANY OF IT. `SettleOrderItemDto` is
 * exactly `{ id, name, quantity, price }` — no variation, no modifier list, no
 * per-line note — on both order-writing endpoints. So a structured selection
 * cannot be stored as structure.
 *
 * Rather than drop the feature or invent a field the API would silently
 * discard, the selection is FOLDED INTO THE LINE:
 *
 *   name   "Espresso (Large, Extra shot) — no sugar"
 *   price  base + every selected modifier's price
 *
 * That is lossy — nothing can later query "how many larges did we sell" — but
 * it is not silent: `name` is what the KOT prints, so the kitchen reads the
 * instruction, and `price` is what the customer is charged. The alternative,
 * sending a modifier array the DTO does not declare, would be accepted and
 * thrown away, and the kitchen would make the wrong drink.
 *
 * Fixing it properly means widening SettleOrderItemDto and the KOT item rows.
 */

import React, { useMemo, useState } from 'react';
import { X } from 'lucide-react';
import { rstPrice } from '../ui/totals';
import { rstNum } from '../restaurant-client';
import type { RstMenuItemRow } from '../restaurant-client';
import type { CartLine } from '../ui/totals';

export interface ModifierChoice { id: string; name: string; price: number }

/**
 * Items expose their options through `menuItemOptions` in the source shape.
 * The projection is not guaranteed, so every shape is read defensively and an
 * item with none simply gets a quantity and a note.
 */
function readGroups(item: RstMenuItemRow): { title: string; single: boolean; choices: ModifierChoice[] }[] {
  const groups: { title: string; single: boolean; choices: ModifierChoice[] }[] = [];

  const variations = (item as any).variations ?? [];
  if (Array.isArray(variations) && variations.length) {
    groups.push({
      title: 'Size',
      single: true,
      choices: variations.map((v: any) => ({
        id: String(v.id), name: String(v.name ?? 'Option'), price: Number(v.price ?? 0),
      })),
    });
  }

  const raw = (item as any).menuItemOptions ?? (item as any).modifiers ?? [];
  if (Array.isArray(raw) && raw.length) {
    groups.push({
      title: 'Add-ons',
      single: false,
      choices: raw.map((m: any) => ({
        id: String(m.id ?? m.menuOption?.id ?? Math.random()),
        name: String(m.name ?? m.menuOption?.name ?? 'Add-on'),
        price: Number(m.price ?? m.menuOption?.price ?? 0),
      })),
    });
  }

  return groups;
}

export function ItemModifierSheet({
  item, onClose, onAdd,
}: {
  item: RstMenuItemRow;
  onClose: () => void;
  onAdd: (line: CartLine) => void;
}) {
  const groups = useMemo(() => readGroups(item), [item]);
  const [picked, setPicked] = useState<Record<string, string[]>>({});
  const [note, setNote] = useState('');
  const [qty, setQty] = useState(1);

  const chosen: ModifierChoice[] = groups.flatMap((g) =>
    (picked[g.title] ?? []).map((id) => g.choices.find((c) => c.id === id)!).filter(Boolean));

  // Both sides originate at the wire as decimal STRINGS; `rstNum` is what keeps
  // a malformed one from turning the whole line price into NaN.
  const base = rstNum(item.price);
  const unit = base + chosen.reduce((s, c) => s + rstNum(c.price), 0);

  function toggle(groupTitle: string, single: boolean, id: string) {
    setPicked((p) => {
      const cur = p[groupTitle] ?? [];
      if (single) return { ...p, [groupTitle]: cur[0] === id ? [] : [id] };
      return { ...p, [groupTitle]: cur.includes(id) ? cur.filter((x) => x !== id) : [...cur, id] };
    });
  }

  function add() {
    const parts = chosen.map((c) => c.name);
    const label = parts.length ? `${item.name} (${parts.join(', ')})` : item.name;
    const withNote = note.trim() ? `${label} — ${note.trim()}` : label;
    onAdd({
      // The cart key must vary with the selection, or two differently
      // configured coffees would merge into one line.
      id: item.id,
      name: withNote,
      quantity: qty,
      price: unit,
    });
    onClose();
  }

  return (
    <div className="rst-sheet" role="dialog" aria-label={`Configure ${item.name}`}>
      <div className="rst-sheet-panel">
        <header className="rst-sheet-head">
          <div className="rst-capt-title">
            <strong>{item.name}</strong>
            <span>{rstPrice(base)}</span>
          </div>
          <button className="rst-icon-btn" onClick={onClose} aria-label="Close"><X size={18} /></button>
        </header>

        <div className="rst-sheet-body">
          {groups.map((g) => (
            <section key={g.title} className="rst-modgroup">
              <h3 className="ds-caption">{g.title}</h3>
              <div className="rst-modrow">
                {g.choices.map((c) => {
                  const on = (picked[g.title] ?? []).includes(c.id);
                  return (
                    <button
                      key={c.id}
                      className={`rst-modchip${on ? ' is-on' : ''}`}
                      onClick={() => toggle(g.title, g.single, c.id)}
                      aria-pressed={on}
                    >
                      {c.name}
                      {c.price > 0 && <em>+{rstPrice(c.price)}</em>}
                    </button>
                  );
                })}
              </div>
            </section>
          ))}

          <section className="rst-modgroup">
            <h3 className="ds-caption">Special instructions</h3>
            <input
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="Eg. less sugar, no ice"
              aria-label="Special instructions"
              className="rst-noteinput"
            />
            <p className="ds-caption rst-modnote">
              Printed on the kitchen ticket as part of the item line — the order contract has no
              separate note field.
            </p>
          </section>

          <section className="rst-modgroup">
            <h3 className="ds-caption">Quantity</h3>
            <div className="rst-stepper rst-stepper-lg">
              <button onClick={() => setQty((q) => Math.max(1, q - 1))} aria-label="One fewer">−</button>
              <span aria-live="polite">{qty}</span>
              <button onClick={() => setQty((q) => q + 1)} aria-label="One more">+</button>
            </div>
          </section>
        </div>

        <div className="rst-sheet-foot">
          <button className="btn-primary btn-sm rst-addbtn" onClick={add}>
            Add to cart · {rstPrice(unit * qty)}
          </button>
        </div>
      </div>
    </div>
  );
}
