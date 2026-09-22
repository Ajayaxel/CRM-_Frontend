'use client';

/**
 * Order / till — Figma 24:947 (dine-in), 179:1614 (takeaway), 179:2042 (delivery),
 * with the dark twins 49:1760 etc.
 *
 * Three panes, as drawn: category tiles, an item grid with steppers, and the
 * cart with totals and a payment method.
 *
 * WHAT THE FRAME GETS WRONG ABOUT MONEY, and what this does instead:
 *
 *  · The cart shows "Tax 5% / CGST 5% / GST 5%" stacked. That is not a real
 *    regime anywhere — CGST pairs with SGST, or IGST stands alone — and it
 *    triple-counts. Organization already carries country and taxRegime, so the
 *    line is labelled by `taxLabel()` and there is exactly one of it.
 *  · The frame prices in USD on the phone and INR on the tablet for the same
 *    product. Money renders through `rstPrice()` (org locale) throughout.
 *
 * AN OPEN POS SESSION IS A PRECONDITION, not an error to discover on submit:
 * both write endpoints require `session_id`. If none is open the screen says so
 * and disables the write, rather than letting a waiter build a cart that cannot
 * be saved.
 */

import React, { useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useRouter, useSearchParams } from 'next/navigation';
import { toast } from 'sonner';
import { CreditCard, Minus, Plus, Send, ShoppingCart, Trash2, Utensils } from 'lucide-react';
import { RestaurantPage } from '../ui/page-shell';
import { Card, EmptyState, Field, Skeleton, money } from '../ui/kit';
import { taxLabel } from '@/lib/org-locale';
import { LoadFailed } from '../ui/load-state';
import { apiErrorMessage } from '@/lib/api';
import {
  branches, menu, orders as ordersApi, pos, posAdmin, rstNum, seating, settings as settingsApi,
} from '../restaurant-client';
import type { OrderWriteBody, RstMenuItemRow } from '../restaurant-client';
import { computeTotals, rstPrice } from '../ui/totals';
import type { CartLine } from '../ui/totals';

/** `OrderTypeConsts` — the three the frames offer, of seven the API accepts. */
const ORDER_TYPES = [
  { value: 'dine_in', label: 'Dine in' },
  { value: 'takeaway', label: 'Takeaway' },
  { value: 'delivery', label: 'Delivery' },
] as const;

/** `payment_method` on the settle path — the frame draws Cash / Debit card / Online. */
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

export function RestaurantOrder() {
  const router = useRouter();
  const qc = useQueryClient();
  const params = useSearchParams();

  const [orderType, setOrderType] = useState<string>('dine_in');
  const [tableId, setTableId] = useState<string>(params.get('tableId') ?? '');
  const [category, setCategory] = useState<string>('');
  const [payment, setPayment] = useState<string>('cash');
  const [cart, setCart] = useState<CartLine[]>([]);

  const { data: categories = [] } = useQuery({ queryKey: ['rst', 'categories'], queryFn: () => menu.categories() });
  const { data: items = [], isLoading: itemsLoading, error: itemsError } = useQuery({
    queryKey: ['rst', 'items'], queryFn: () => menu.allItems(),
  });

  const countByCategory = useMemo(() => countItemsByCategory(items), [items]);
  const { data: tables = [] } = useQuery({ queryKey: ['rst', 'tables'], queryFn: () => seating.tables() });
  const { data: branchList = [] } = useQuery({ queryKey: ['rst', 'branches'], queryFn: () => branches.searchActive() });
  const { data: sessions = [], isLoading: sessionsLoading } = useQuery({
    queryKey: ['rst', 'sessions'], queryFn: () => pos.sessions(),
  });

  // An open session and a branch are both required by the write contract.
  /**
   * `closed_at`, not `closedAt` — the session list sends the column name, and
   * the source renders an ABSENT close time as `''` rather than null, so both
   * have to count as open.
   *
   * Read as `closedAt` this was always undefined, so the primary signal was
   * dead and only the status string stood between the till and a closed
   * session. Found on the screen walk; the same class the client interfaces
   * carried, in an inline type the field gate did not scan until now.
   */
  const openSession = (sessions as { id: string; status?: string; closed_at?: string | null }[])
    .find((s) => !s.closed_at && (s.status ?? '').toLowerCase() !== 'closed');
  const branchId = branchList[0]?.id ?? '';
  const canWrite = Boolean(openSession && branchId);

  const shownItems = useMemo(() => {
    if (!category) return items;
    return items.filter((i) =>
      i.menu_item_category_id === category || i.categories?.some((c) => c.id === category));
  }, [items, category]);

  const qtyOf = (id: string) => cart.find((l) => l.id === id)?.quantity ?? 0;

  function bump(item: RstMenuItemRow, delta: number) {
    setCart((prev) => {
      const at = prev.findIndex((l) => l.id === item.id);
      if (at === -1) {
        if (delta <= 0) return prev;
        return [...prev, { id: item.id, name: item.name, quantity: delta, price: Number(item.price ?? 0) }];
      }
      const next = [...prev];
      const q = next[at].quantity + delta;
      if (q <= 0) next.splice(at, 1);
      else next[at] = { ...next[at], quantity: q };
      return next;
    });
  }

  /**
   * The rate the SERVER will charge, read from the same place it reads.
   *
   * `settle()` computes tax as `settings.taxRate` — one branch rate, no
   * per-item tax on the write contract. This was hardcoded to 0 under a comment
   * claiming it was "the org's own rate", so the cart previewed GST as ₹0.00
   * while the server charged 10% of the subtotal. A preview that understates
   * the bill is worse than no preview: the customer is shown a total they will
   * not be charged.
   *
   * Undefined while settings load, so the preview shows no tax rather than a
   * wrong tax, and settles to the real figure the moment it arrives.
   */
  const { data: settingsRow } = useQuery({
    queryKey: ['rst', 'settings'],
    queryFn: () => settingsApi.get(),
  });
  const taxRate = rstNum((settingsRow as { tax_rate?: string | number | null } | undefined)?.tax_rate);
  const totals = computeTotals(cart, taxRate);

  const body = (): OrderWriteBody => ({
    branch_id: branchId,
    order_type: orderType,
    // The server discards table_id unless the type is dine_in; sending it
    // anyway would be harmless but misleading to read back.
    table_id: orderType === 'dine_in' ? (tableId || null) : null,
    payment_method: payment,
    session_id: openSession!.id,
    items: cart.map((l) => ({ id: l.id, name: l.name, quantity: l.quantity, price: l.price })),
  });

  const done = (verb: string) => (r: { reference_no?: string } | undefined) => {
    toast.success(r?.reference_no ? `${verb} — ${r.reference_no}` : verb);
    setCart([]);
    qc.invalidateQueries({ queryKey: ['rst'] });
  };

  const settle = useMutation({
    mutationFn: () => ordersApi.saveAndPrint(body()),
    onSuccess: done('Order placed'),
    onError: (e) => toast.error(apiErrorMessage(e)),
  });

  const sendToKitchen = useMutation({
    mutationFn: () => ordersApi.kotAndPrint(body()),
    onSuccess: done('Sent to kitchen'),
    onError: (e) => toast.error(apiErrorMessage(e)),
  });

  const openSessionMutation = useMutation({
    mutationFn: async () => {
      const regList = (await pos.registers()) as { id: string }[];
      let regId = regList[0]?.id;
      if (!regId) {
        const createdReg = (await posAdmin.createRegister({ name: 'Main POS Register', code: 'REG-01', branch_id: branchId })) as { id: string };
        regId = createdReg.id;
      }
      return pos.openSession({ branch_id: branchId, pos_register_id: regId, opening_float: 1000 });
    },
    onSuccess: () => {
      toast.success('POS Session opened successfully');
      qc.invalidateQueries({ queryKey: ['rst'] });
    },
    onError: (e) => toast.error(apiErrorMessage(e)),
  });

  const busy = settle.isPending || sendToKitchen.isPending;

  return (
    <RestaurantPage
      title="New order"
      subtitle="Build the cart, send it to the kitchen, then settle."
      actions={
        <button className="btn-secondary btn-sm" onClick={() => router.push('/restaurant/tables')}>
          <Utensils size={14} /> Tables
        </button>
      }
    >
      {!sessionsLoading && !canWrite && (
        <Card pad={14}>
          <div className="rst-warnbar" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 12 }}>
            <div>
              <strong>{!branchId ? 'No active branch' : 'No POS session is open'}</strong>
              <span style={{ display: 'block', marginTop: 2 }}>
                {!branchId
                  ? 'A branch must exist before an order can be written.'
                  : 'Both order endpoints require an open session before taking payment.'}
              </span>
            </div>
            {branchId && !openSession && (
              <button
                className="btn-primary btn-sm"
                disabled={openSessionMutation.isPending}
                onClick={() => openSessionMutation.mutate()}
              >
                {openSessionMutation.isPending ? 'Opening…' : 'Open POS Session'}
              </button>
            )}
          </div>
        </Card>
      )}

      <div className="rst-order-layout">
        {/* Categories */}
        <Card pad={12}>
          <div className="rst-cat-grid">
            <button
              className={`rst-cat${category === '' ? ' is-on' : ''}`}
              onClick={() => setCategory('')}
            >
              <span className="rst-cat-name">All</span>
              <span className="rst-cat-count">{items.length} items</span>
            </button>
            {categories.map((c) => (
              <button
                key={c.id}
                className={`rst-cat${category === c.id ? ' is-on' : ''}`}
                onClick={() => setCategory(c.id)}
              >
                <span className="rst-cat-name">{c.name}</span>
                <span className="rst-cat-count">{countByCategory.get(c.id) ?? ''}</span>
              </button>
            ))}
          </div>

          {itemsError ? (
            /* An empty grid would read as "this restaurant sells nothing"
               rather than "the menu did not load". */
            <LoadFailed what="the menu" />
          ) : itemsLoading ? (
            <Skeleton rows={4} height={72} />
          ) : shownItems.length === 0 ? (
            <EmptyState icon={ShoppingCart} title="No items in this category" compact />
          ) : (
            <div className="rst-item-grid">
              {shownItems.map((i) => {
                const q = qtyOf(i.id);
                const imageSrc = i.image_path || (i as any).image_full_path || (i as any).image_url;
                return (
                  <div
                    key={i.id}
                    className={`rst-item${q ? ' is-in-cart' : ''}`}
                    onClick={() => bump(i, 1)}
                    style={{ cursor: 'pointer' }}
                  >
                    {imageSrc && (
                      <div className="rst-item-img-wrap" style={{ width: '100%', height: 110, borderRadius: 'var(--rst-r, 6px)', overflow: 'hidden', background: '#f3f4f6', marginBottom: 4 }}>
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
                      <button onClick={(e) => { e.stopPropagation(); bump(i, -1); }} disabled={!q} aria-label={`Remove one ${i.name}`}>
                        <Minus size={14} />
                      </button>
                      <span aria-live="polite">{q}</span>
                      <button onClick={(e) => { e.stopPropagation(); bump(i, 1); }} aria-label={`Add one ${i.name}`}>
                        <Plus size={14} />
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </Card>

        {/* Cart */}
        <Card pad={0}>
          <div className="rst-cart">
            <div className="rst-seg rst-seg-sm rst-cart-types" role="tablist" aria-label="Order type">
              {ORDER_TYPES.map((t) => (
                <button
                  key={t.value}
                  role="tab"
                  aria-selected={orderType === t.value}
                  className={`rst-seg-item${orderType === t.value ? ' is-on' : ''}`}
                  onClick={() => setOrderType(t.value)}
                >
                  {t.label}
                </button>
              ))}
            </div>

            {orderType === 'dine_in' && (
              <div className="rst-cart-field">
                <Field label="Table">
                  <select value={tableId} onChange={(e) => setTableId(e.target.value)}>
                    <option value="">Unassigned</option>
                    {tables.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}
                  </select>
                </Field>
              </div>
            )}

            <ul className="rst-cart-lines">
              {cart.length === 0 && <li className="ds-caption rst-cart-empty">The cart is empty.</li>}
              {cart.map((l) => (
                <li key={l.id}>
                  <span className="rst-cart-qty">x{l.quantity}</span>
                  <span className="rst-cart-name">{l.name}</span>
                  <span className="rst-cart-amt">{rstPrice(l.price * l.quantity)}</span>
                  <button
                    className="rst-cart-del"
                    onClick={() => setCart((p) => p.filter((x) => x.id !== l.id))}
                    aria-label={`Remove ${l.name}`}
                  >
                    <Trash2 size={13} />
                  </button>
                </li>
              ))}
            </ul>

            <dl className="rst-totals">
              <div><dt>Subtotal</dt><dd>{rstPrice(totals.subtotal)}</dd></div>
              {/* ONE tax line, named by the org's regime — not the frame's
                  triple-counted Tax + CGST + GST stack. */}
              <div><dt>{taxLabel()}</dt><dd>{rstPrice(totals.taxAmount)}</dd></div>
              {totals.discountAmount > 0 && (
                <div><dt>Discount</dt><dd>−{rstPrice(totals.discountAmount)}</dd></div>
              )}
              <div className="rst-total"><dt>Total</dt><dd>{rstPrice(totals.total)}</dd></div>
            </dl>

            <div className="rst-pay">
              <span className="ds-caption">Payment method</span>
              <div className="rst-pay-grid">
                {PAYMENT_METHODS.map((m) => (
                  <button
                    key={m.value}
                    className={`rst-pay-btn${payment === m.value ? ' is-on' : ''}`}
                    onClick={() => setPayment(m.value)}
                    aria-pressed={payment === m.value}
                  >
                    <CreditCard size={15} aria-hidden />
                    {m.label}
                  </button>
                ))}
              </div>
            </div>

            <div className="rst-cart-actions">
              <button
                className="btn-secondary btn-sm"
                disabled={!canWrite || busy || cart.length === 0}
                onClick={() => sendToKitchen.mutate()}
              >
                <Send size={14} /> {sendToKitchen.isPending ? 'Sending…' : 'Send to kitchen'}
              </button>
              <button
                className="btn-primary btn-sm"
                disabled={!canWrite || busy || cart.length === 0}
                onClick={() => settle.mutate()}
              >
                {settle.isPending ? 'Placing…' : 'Place order'}
              </button>
            </div>
          </div>
        </Card>
      </div>
    </RestaurantPage>
  );
}
