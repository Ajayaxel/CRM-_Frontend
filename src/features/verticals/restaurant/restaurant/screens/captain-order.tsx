'use client';

/**
 * Captain order + payment — Figma 453:8591 (menu) and 457:9625 (review & pay).
 *
 * The portrait companion to the console till. Same contract, different posture:
 * one thumb, standing next to a table, so the catalogue is a coarse grid and
 * the cart is a sheet that slides over it rather than a column beside it.
 *
 * It shares the cart maths with the console screen (ui/totals) rather than
 * re-deriving them — the server's two quirks (tax on the UNDISCOUNTED subtotal,
 * flat discounts unrounded) have to hold identically on both surfaces or the
 * captain and the till quote different totals for the same basket.
 */

import React, { useEffect, useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useRouter, useSearchParams } from 'next/navigation';
import { toast } from 'sonner';
import { ArrowLeft, Check, CreditCard, Minus, Plus, ShoppingCart, Sliders, Trash2 } from 'lucide-react';
import { Field, Skeleton, EmptyState, money } from '../ui/kit';
import { taxLabel } from '@/lib/org-locale';
import { LoadFailed } from '../ui/load-state';
import { apiErrorMessage } from '@/lib/api';
import {
  branches, menu, orders as ordersApi, pos, rstNum, seating, settings as settingsApi,
} from '../restaurant-client';
import type { OrderWriteBody, RstMenuItemRow } from '../restaurant-client';
import { ItemModifierSheet } from '../components/item-modifier-sheet';
import { computeTotals, rstPrice } from '../ui/totals';
import type { CartLine } from '../ui/totals';

const PAYMENT_METHODS = [
  { value: 'cash', label: 'Cash' },
  { value: 'card', label: 'Debit card' },
  { value: 'mobile_wallet', label: 'Online' },
] as const;

/**
 * How many items each category holds, counted from the item list this screen
 * already loaded.
 *
 * `GET /menu/categories` does not send a count — the client used to declare an
 * `itemsCount` field the API has never returned, so this label rendered as an
 * empty string on every category. Counting here is honest and free: the items
 * are in hand, and an item can sit in a category through EITHER the scalar
 * `menu_item_category_id` or the `categories` pivot, so both are counted and
 * the item is counted once.
 */
function countItemsByCategory(items: RstMenuItemRow[]): Map<string, number> {
  const counts = new Map<string, number>();
  for (const i of items) {
    const ids = new Set<string>();
    if (i.menu_item_category_id) ids.add(i.menu_item_category_id);
    for (const c of i.categories ?? []) ids.add(c.id);
    for (const id of ids) counts.set(id, (counts.get(id) ?? 0) + 1);
  }
  return counts;
}

export function CaptainOrder() {
  const router = useRouter();
  const qc = useQueryClient();
  const params = useSearchParams();
  const tableId = params.get('tableId') ?? '';

  useEffect(() => {
    if (!tableId) return;
    seating.lockTable(tableId, true).catch(() => {});
    return () => {
      seating.lockTable(tableId, false).catch(() => {});
    };
  }, [tableId]);

  const [category, setCategory] = useState<string>('');
  const [cart, setCart] = useState<CartLine[]>([]);
  const [reviewing, setReviewing] = useState(false);
  const [configuring, setConfiguring] = useState<RstMenuItemRow | null>(null);
  const [payment, setPayment] = useState<string>('cash');

  const { data: categories = [] } = useQuery({ queryKey: ['rst', 'categories'], queryFn: () => menu.categories() });
  const { data: items = [], isLoading, error: itemsError } = useQuery({
    queryKey: ['rst', 'items'], queryFn: () => menu.allItems(),
  });

  const countByCategory = useMemo(() => countItemsByCategory(items), [items]);
  const { data: tables = [] } = useQuery({ queryKey: ['rst', 'tables'], queryFn: () => seating.tables() });
  const { data: branchList = [] } = useQuery({ queryKey: ['rst', 'branches'], queryFn: () => branches.searchActive() });
  const { data: sessions = [] } = useQuery({ queryKey: ['rst', 'sessions'], queryFn: () => pos.sessions() });

  /**
   * `closed_at`, not `closedAt` — see the note on the same check in
   * screens/order.tsx. The source renders an absent close time as `''`.
   */
  const openSession = (sessions as { id: string; closed_at?: string | null; status?: string }[])
    .find((s) => !s.closed_at && (s.status ?? '').toLowerCase() !== 'closed');
  const branchId = branchList[0]?.id ?? '';
  const canWrite = Boolean(openSession && branchId);
  const table = tables.find((t) => t.id === tableId);

  const shown = useMemo(() => {
    if (!category) return items;
    return items.filter((i) => i.menu_item_category_id === category || i.categories?.some((c) => c.id === category));
  }, [items, category]);

  const qtyOf = (item: RstMenuItemRow) =>
    cart.find((l) => l.id === item.id && l.name === item.name)?.quantity ?? 0;
  const count = cart.reduce((n, l) => n + l.quantity, 0);
  /**
   * The same rate the server charges — see the note in screens/order.tsx. This
   * was a literal `0`, so the captain's cart previewed no tax while settlement
   * applied the branch rate.
   */
  const { data: settingsRow } = useQuery({
    queryKey: ['rst', 'settings'],
    queryFn: () => settingsApi.get(),
  });
  const existingItems = useMemo(() => {
    if (!table?.active_order) return [];
    return ((table.active_order as any).items || []).map((i: any) => ({
      id: i.id,
      name: i.name,
      quantity: i.quantity,
      price: typeof i.price === 'string' ? parseFloat(i.price) : i.price,
      sent: true,
    }));
  }, [table]);

  const totals = computeTotals(
    [...existingItems, ...cart],
    rstNum((settingsRow as { tax_rate?: string | number | null } | undefined)?.tax_rate),
  );

  /**
   * A line added through the modifier sheet carries its configuration in its
   * NAME and PRICE, so identity is (id, name, price) — not id alone. Merging on
   * id would collapse a large latte and a small one into a single line and
   * charge one price for both.
   */
  function addConfigured(line: CartLine) {
    setCart((prev) => {
      const at = prev.findIndex((l) => l.id === line.id && l.name === line.name && l.price === line.price);
      if (at === -1) return [...prev, line];
      const next = [...prev];
      next[at] = { ...next[at], quantity: next[at].quantity + line.quantity };
      return next;
    });
  }

  function bump(item: RstMenuItemRow, delta: number) {
    setCart((prev) => {
      // Only the unconfigured line for this item — a configured one has a
      // different name and is stepped from the cart, not from the grid.
      const at = prev.findIndex((l) => l.id === item.id && l.name === item.name);
      if (at === -1) {
        if (delta <= 0) return prev;
        return [...prev, { id: item.id, name: item.name, quantity: delta, price: Number(item.price ?? 0) }];
      }
      const next = [...prev];
      const q = next[at].quantity + delta;
      if (q <= 0) next.splice(at, 1); else next[at] = { ...next[at], quantity: q };
      return next;
    });
  }

  const body = (): OrderWriteBody => ({
    branch_id: branchId,
    order_type: tableId ? 'dine_in' : 'takeaway',
    table_id: tableId || null,
    payment_method: payment,
    session_id: openSession!.id,
    items: cart.map((l) => ({ id: l.id, name: l.name, quantity: l.quantity, price: l.price })),
    ...(table?.active_order ? { order_id: (table.active_order as { id: string }).id } : {}),
  });

  const finish = (verb: string) => (r: { reference_no?: string } | undefined) => {
    toast.success(r?.reference_no ? `${verb} — ${r.reference_no}` : verb);
    setCart([]); setReviewing(false);
    qc.invalidateQueries({ queryKey: ['rst'] });
    router.push('/restaurant/captain');
  };

  const sendToKitchen = useMutation({
    mutationFn: () => ordersApi.kotAndPrint(body()),
    onSuccess: finish('Sent to kitchen'),
    onError: (e) => toast.error(apiErrorMessage(e)),
  });
  const settle = useMutation({
    mutationFn: () => ordersApi.saveAndPrint(body()),
    onSuccess: finish('Order placed'),
    onError: (e) => toast.error(apiErrorMessage(e)),
  });
  const busy = settle.isPending || sendToKitchen.isPending;

  return (
    <div className="rst rst-captain">
      <header className="rst-captain-bar rst-captain-bar-top">
        <button className="rst-icon-btn" onClick={() => router.push('/restaurant/captain')} aria-label="Back to floor">
          <ArrowLeft size={20} />
        </button>
        <div className="rst-capt-title">
          <strong>{table ? table.name : 'Takeaway'}</strong>
          <span>{table ? [table.zone?.name, table.floor?.name].filter(Boolean).join(' · ') : 'No table'}</span>
        </div>
      </header>

      {!canWrite && (
        <div className="rst-captain-body">
          <div className="rst-warnbar">
            <strong>{branchId ? 'No POS session is open' : 'No active branch'}</strong>
            <span>An order cannot be written until this is resolved.</span>
          </div>
        </div>
      )}

      <div className="rst-captain-body rst-capt-menu">
        <div className="rst-cat-grid">
          <button className={`rst-cat${category === '' ? ' is-on' : ''}`} onClick={() => setCategory('')}>
            <span className="rst-cat-name">All</span>
            <span className="rst-cat-count">{items.length} items</span>
          </button>
          {categories.map((c) => (
            <button key={c.id} className={`rst-cat${category === c.id ? ' is-on' : ''}`} onClick={() => setCategory(c.id)}>
              <span className="rst-cat-name">{c.name}</span>
              <span className="rst-cat-count">{countByCategory.get(c.id) ?? ''}</span>
            </button>
          ))}
        </div>

        {itemsError ? <LoadFailed what="the menu" />
          : isLoading ? <Skeleton rows={4} height={80} />
          : shown.length === 0 ? <EmptyState icon={ShoppingCart} title="Nothing in this category" compact />
          : (
            <div className="rst-item-grid rst-capt-items">
              {shown.map((i) => {
                const q = qtyOf(i);
                const imageSrc = i.image_path || (i as any).image_full_path || (i as any).image_url;
                return (
                  <div
                    key={i.id}
                    className={`rst-item${q ? ' is-in-cart' : ''}`}
                    onClick={() => bump(i, 1)}
                    style={{ cursor: 'pointer' }}
                  >
                    {imageSrc && (
                      <div className="rst-item-img-wrap" style={{ width: '100%', height: 100, borderRadius: 'var(--rst-r, 6px)', overflow: 'hidden', background: '#f3f4f6', marginBottom: 4 }}>
                        <img
                          src={imageSrc}
                          alt={i.name}
                          style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }}
                          onError={(e) => {
                            (e.target as HTMLElement).parentElement!.style.display = 'none';
                          }}
                        />
                      </div>
                    )}
                    <div className="rst-item-top">
                      <span className="rst-item-title">{i.name}</span>
                      <span className="rst-item-price">{rstPrice(Number(i.price ?? 0))}</span>
                    </div>
                    <div className="rst-stepper" onClick={(e) => e.stopPropagation()}>
                      <button onClick={(e) => { e.stopPropagation(); bump(i, -1); }} disabled={!q} aria-label={`Remove one ${i.name}`}><Minus size={16} /></button>
                      <span aria-live="polite">{q}</span>
                      <button onClick={(e) => { e.stopPropagation(); bump(i, 1); }} aria-label={`Add one ${i.name}`}><Plus size={16} /></button>
                      <button className="rst-customise" onClick={(e) => { e.stopPropagation(); setConfiguring(i); }} aria-label={`Customise ${i.name}`}>
                        <Sliders size={14} />
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
      </div>

      {/* The cart bar is the frame's persistent footer — it is how you get to pay. */}
      {count > 0 && !reviewing && (
        <button className="rst-cartbar" onClick={() => setReviewing(true)}>
          <span className="rst-cartbar-count">{count}</span>
          <span>Review order</span>
          <span className="rst-cartbar-total">{rstPrice(totals.total)}</span>
        </button>
      )}

      {configuring && (
        <ItemModifierSheet
          item={configuring}
          onClose={() => setConfiguring(null)}
          onAdd={addConfigured}
        />
      )}

      {/* Review & pay — Figma 457:9625 */}
      {reviewing && (
        <div className="rst-sheet" role="dialog" aria-label="Review order">
          <div className="rst-sheet-panel">
            <header className="rst-sheet-head">
              <strong>{table ? `Table ${table.name}` : 'Takeaway'}</strong>
              <button className="rst-icon-btn" onClick={() => setReviewing(false)} aria-label="Back to menu">
                <ArrowLeft size={18} />
              </button>
            </header>

            <ul className="rst-cart-lines">
              {existingItems.map((l: any) => (
                <li key={l.id} style={{ opacity: 0.7 }}>
                  <span className="rst-cart-qty">x{l.quantity}</span>
                  <span className="rst-cart-name">{l.name} (Sent)</span>
                  <span className="rst-cart-amt">{rstPrice(l.price * l.quantity)}</span>
                </li>
              ))}
              {cart.map((l) => (
                <li key={`${l.id}-${l.name}-${l.price}`}>
                  <span className="rst-cart-qty">x{l.quantity}</span>
                  <span className="rst-cart-name">{l.name}</span>
                  <span className="rst-cart-amt">{rstPrice(l.price * l.quantity)}</span>
                  <button
                    className="rst-cart-del"
                    onClick={() => setCart((p) => p.filter((x) => !(x.id === l.id && x.name === l.name && x.price === l.price)))}
                    aria-label={`Remove ${l.name}`}
                  >
                    <Trash2 size={14} />
                  </button>
                </li>
              ))}
            </ul>

            <dl className="rst-totals">
              <div><dt>Subtotal</dt><dd>{rstPrice(totals.subtotal)}</dd></div>
              <div><dt>{taxLabel()}</dt><dd>{rstPrice(totals.taxAmount)}</dd></div>
              <div className="rst-total"><dt>Total</dt><dd>{rstPrice(totals.total)}</dd></div>
            </dl>

            <div className="rst-pay">
              <span className="ds-caption">Payment method</span>
              <div className="rst-pay-grid">
                {PAYMENT_METHODS.map((m) => (
                  <button key={m.value} className={`rst-pay-btn${payment === m.value ? ' is-on' : ''}`}
                    onClick={() => setPayment(m.value)} aria-pressed={payment === m.value}>
                    <CreditCard size={16} aria-hidden />{m.label}
                  </button>
                ))}
              </div>
            </div>

            <div className="rst-cart-actions">
              <button className="btn-secondary btn-sm" disabled={!canWrite || busy} onClick={() => sendToKitchen.mutate()}>
                {sendToKitchen.isPending ? 'Sending…' : 'Send to kitchen'}
              </button>
              <button className="btn-primary btn-sm" disabled={!canWrite || busy} onClick={() => settle.mutate()}>
                <Check size={15} /> {settle.isPending ? 'Placing…' : 'Place order'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
