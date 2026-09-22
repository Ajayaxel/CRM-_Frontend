'use client';

/**
 * JUSTPOS Home — Figma 75:2365 (light) / 98:1013 (dark).
 *
 * The frame shows three KPI tiles, a Recent Orders list, an Out of Stock panel
 * and four quick actions. There is NO dashboard endpoint behind any of it: the
 * ported API exposes orders, ingredients and seating, and nothing that
 * aggregates them. So every figure here is derived on the client from real list
 * calls, and each tile says what it counted.
 *
 * Two numbers in the frame are deliberately NOT reproduced:
 *
 *   "+12% from yesterday" on the sales tile, and "8 pending" under active
 *   orders. Neither has a source — there is no yesterday comparison in any
 *   response, and inventing one would make the tile lie in the exact place a
 *   manager trusts it most. StatCard already renders `hint` for this case, so
 *   the tiles say what they counted rather than showing a fabricated delta.
 */

import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { useRouter } from 'next/navigation';
import { Banknote, ClipboardList, PackageX, Plus, Printer, CreditCard, Soup, Receipt } from 'lucide-react';
import { RestaurantPage, RestaurantSection } from '../ui/page-shell';
import { Card, DataTable, EmptyState, Skeleton, StatCard, Status, money } from '../ui/kit';
import type { DataTableColumn, Tone } from '../ui/kit';
import { orders as ordersApi, inventory as inventoryApi, rstNum } from '../restaurant-client';
import { rstPrice } from '../ui/totals';
import type { RstOrderRow, RstIngredientRow } from '../restaurant-client';

function OrderItemImage({ src, alt, size = 32 }: { src?: string | null; alt: string; size?: number }) {
  const [failed, setFailed] = React.useState(false);

  React.useEffect(() => {
    setFailed(false);
  }, [src]);

  const cleanSrc = React.useMemo(() => {
    if (!src) return '';
    let url = src;
    if (url.startsWith('/tenancy/assets/http')) url = url.replace('/tenancy/assets/', '');
    if (url.startsWith('/tenancy/assets/data:')) url = url.replace('/tenancy/assets/', '');
    return url;
  }, [src]);

  if (!cleanSrc || failed) {
    return (
      <div style={{ width: size, height: size, borderRadius: 6, background: '#f3f4f6', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#9ca3af', flexShrink: 0 }}>
        <Receipt size={Math.round(size * 0.45)} />
      </div>
    );
  }

  return (
    <img
      src={cleanSrc}
      alt={alt}
      style={{ width: size, height: size, borderRadius: 6, objectFit: 'cover', background: '#f3f4f6', flexShrink: 0 }}
      onError={() => setFailed(true)}
    />
  );
}

/** Ticket states that mean "still being worked on". */
const OPEN_STATES = new Set(['PENDING', 'NEW', 'COOKING', 'IN_PROGRESS', 'PREPARING', 'READY']);

const isOpen = (o: RstOrderRow) => OPEN_STATES.has((o.status ?? '').toUpperCase());

function toneForOrder(status?: string | null): Tone {
  const s = (status ?? '').toUpperCase();
  if (s === 'COMPLETED' || s === 'PAID' || s === 'SERVED') return 'active';
  if (s === 'READY') return 'info';
  if (s === 'CANCELLED' || s === 'VOID') return 'expired';
  return 'renewal';
}

/** Today, in the browser's zone — the same day boundary the till operator sees. */
function isToday(iso?: string | null): boolean {
  if (!iso) return false;
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return false;
  const now = new Date();
  return d.getFullYear() === now.getFullYear()
    && d.getMonth() === now.getMonth()
    && d.getDate() === now.getDate();
}

export function RestaurantHome() {
  const router = useRouter();
  const { data: list = [], isLoading: ordersLoading, error: ordersError } = useQuery({
    queryKey: ['rst', 'orders', 'recent'],
    queryFn: () => ordersApi.allList(),
  });
  const { data: ingredients = [], isLoading: stockLoading } = useQuery({
    queryKey: ['rst', 'ingredients'],
    queryFn: () => inventoryApi.ingredients({ per_page: 200 }),
  });

  const today = list.filter((o) => isToday(o.created_at));
  const takings = today.reduce((sum, o) => sum + rstNum(o.total), 0);
  const active = list.filter(isOpen);

  /**
   * Out of stock is the only stock claim the schema supports.
   *
   * There is no per-ingredient threshold anywhere — see the note on
   * `RstIngredientRow.quantity` — so "low stock" cannot be computed, and this
   * tile used to gate on `i.threshold` and therefore always read zero.
   */
  const out = ingredients.filter((i) => i.quantity != null && rstNum(i.quantity) <= 0);

  const columns: DataTableColumn<RstOrderRow>[] = [
    {
      key: 'table',
      header: 'Table',
      width: 96,
      render: (o) => (
        <span className="rst-chip" aria-label={o.table?.name ? `Table ${o.table.name}` : 'No table'}>
          {/* `OrderTypeConsts` values are lower snake — `delivery`, never `DELIVERY`. */}
          {o.table?.name ?? (o.order_type === 'delivery' ? 'Delivery' : '—')}
        </span>
      ),
    },
    {
      key: 'code',
      header: 'Order',
      render: (o) => {
        const items = (o.items ?? (o as any).orderItems) ?? [];
        const itemWithImage = items.find((i: any) => i.image_path || i.image_full_path || i.image_url || i.image || i.menuItem?.imagePath);
        const imageSrc = itemWithImage?.image_path || itemWithImage?.image_full_path || itemWithImage?.image_url || itemWithImage?.image || itemWithImage?.menuItem?.imagePath;
        const refText = o.code ?? o.reference_no ?? o.id.slice(0, 8);
        return (
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <OrderItemImage src={imageSrc} alt={refText} size={32} />
            <span style={{ fontWeight: 600 }}>{refText}</span>
          </div>
        );
      },
    },
    { key: 'customer', header: 'Customer', render: (o) => o.customer_name ?? '—' },
    /**
     * No item count. `GET /orders` loads branch, user, discount and customer —
     * NOT items, which is the source's own relation set — so `o.items` is
     * always undefined here and the column rendered a hard `0` for every order.
     * A column that can only ever say zero is worse than no column: it reads as
     * a fact about the order rather than an absence in the response.
     *
     * The count exists on `GET /orders/{id}`, which is dead in the source
     * (RST-PARITY: it eager-loads a relation Order does not define), so there is
     * nowhere honest to get it for a list.
     */
    {
      key: 'total',
      header: 'Total',
      align: 'right',
      width: 110,
      // A ledger figure, not a headline tile — `money()` rounds 13.20 to ₹13.
      render: (o) => rstPrice(o.total),
    },
    {
      key: 'status',
      header: 'Status',
      width: 140,
      render: (o) => <Status tone={toneForOrder(o.status)}>{o.status ?? 'Unknown'}</Status>,
    },
  ];

  return (
    <RestaurantPage
      title="Today"
      subtitle="Takings, open tickets and stock that needs attention."
      actions={
        <button className="btn-primary btn-sm" onClick={() => router.push('/restaurant/order')}>
          <Plus size={16} /> New order
        </button>
      }
    >
      <div className="ds-grid ds-grid-kpi">
        <StatCard
          label="Today's takings"
          value={ordersLoading ? '—' : money(takings)}
          hint={ordersLoading ? undefined : `${today.length} order${today.length === 1 ? '' : 's'} today`}
          tone="sales"
          icon={Banknote}
        />
        <StatCard
          label="Active orders"
          value={ordersLoading ? '—' : active.length}
          hint={ordersLoading ? undefined : 'Tickets not yet completed'}
          tone="info"
          icon={ClipboardList}
          onClick={() => router.push('/restaurant/kds')}
        />
        <StatCard
          label="Out of stock"
          value={stockLoading ? '—' : out.length}
          hint={stockLoading ? undefined : 'Nothing on hand'}
          tone={out.length ? 'expired' : 'neutral'}
          icon={PackageX}
          onClick={() => router.push('/restaurant/inventory')}
        />
      </div>

      <div className="rst-home-split">
        <RestaurantSection title="Recent orders">
          {ordersError ? (
            <EmptyState
              icon={ClipboardList}
              title="Orders could not be loaded"
              body="The till is still usable — this panel only reads history."
            />
          ) : (
            <DataTable
              rows={list.slice(0, 12)}
              columns={columns}
              rowKey={(o) => o.id}
              loading={ordersLoading}
              onRowClick={(o) => router.push(`/restaurant/order?id=${o.id}`)}
              empty={<EmptyState icon={ClipboardList} title="No orders yet today" compact />}
            />
          )}
        </RestaurantSection>

        <div className="ds-stack">
          <RestaurantSection title="Out of stock">
            {stockLoading ? (
              <Skeleton rows={3} height={38} />
            ) : out.length === 0 ? (
              <EmptyState icon={PackageX} title="Everything in stock" compact />
            ) : (
              <ul className="rst-stock-list">
                {out.map((i: RstIngredientRow) => (
                  <li key={i.id}>
                    <span>{i.name}</span>
                    <Status tone="expired">
                      {i.quantity ?? 0} {i.unit?.name ?? ''}
                    </Status>
                  </li>
                ))}
              </ul>
            )}
          </RestaurantSection>

          <Card pad={18}>
            <div className="ds-h3" style={{ marginBottom: 12 }}>Quick actions</div>
            <div className="rst-quick">
              <button className="btn-primary btn-sm" onClick={() => router.push('/restaurant/order')}>
                <Plus size={15} /> New order
              </button>
              <button className="btn-secondary btn-sm" onClick={() => router.push('/restaurant/kds')}>
                <Soup size={15} /> Kitchen
              </button>
              <button className="btn-secondary btn-sm" onClick={() => router.push('/restaurant/tables')}>
                <CreditCard size={15} /> Checkout
              </button>
              <button className="btn-secondary btn-sm" disabled title="Reprint needs a configured printer (Settings → Integrations & devices)">
                <Printer size={15} /> Reprint bill
              </button>
            </div>
          </Card>
        </div>
      </div>
    </RestaurantPage>
  );
}
