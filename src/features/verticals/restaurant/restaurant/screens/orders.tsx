'use client';

/**
 * Orders — the console's order register.
 *
 * The Laravel screen (Sales/Orders.vue) lists customer, branch, type, status,
 * payment status, mode, amount, cashier, created-at and bill discount, with a
 * detail view. This carries the same columns from the same endpoint; the layout
 * is this product's, the data is the source's.
 *
 * `GET /orders` loads branch, user, discount and customer — and NOT items. So
 * there is no line detail here and no item count: the source's own order detail
 * route is dead (it eager-loads a `payments` relation `Order` does not define),
 * which means the lines are unreachable from the admin API at all. The drawer
 * shows what the list carries rather than pretending to a detail endpoint that
 * 500s on every request.
 */

import React, { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { toast } from 'sonner';
import { Receipt, CircleDollarSign, Ban, Printer, FileText } from 'lucide-react';
import { RestaurantPage } from '../ui/page-shell';
import { Card, DataTable, Drawer, EmptyState, Skeleton, StatCard, Status } from '../ui/kit';
import type { DataTableColumn, Tone } from '../ui/kit';
import { orders as ordersApi, rstNum } from '../restaurant-client';
import type { RstOrderRow } from '../restaurant-client';
import { LoadFailed } from '../ui/load-state';
import { rstPrice } from '../ui/totals';

const ALL = '__all__';

function toneForStatus(s?: string | null): Tone {
  const v = (s ?? '').toLowerCase();
  if (v === 'completed') return 'active';
  if (v === 'cancelled') return 'expired';
  if (v === 'pending') return 'renewal';
  return 'neutral';
}

/** `dine_in` reads as "Dine in" — the wire keeps the column's own spelling. */
const human = (v?: string | null) =>
  !v ? '—' : v.replace(/_/g, ' ').replace(/^./, (c) => c.toUpperCase());

function OrderItemImage({ src, alt, size = 36 }: { src?: string | null; alt: string; size?: number }) {
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

export function RestaurantOrders() {
  const [status, setStatus] = useState<string>(ALL);
  const [branch, setBranch] = useState<string>(ALL);
  const [type, setType] = useState<string>(ALL);
  const [payment, setPayment] = useState<string>(ALL);
  const [from, setFrom] = useState<string>('');
  const [to, setTo] = useState<string>('');
  const [q, setQ] = useState<string>('');
  const [open, setOpen] = useState<RstOrderRow | null>(null);

  const { data: rows = [], isLoading, error } = useQuery({
    queryKey: ['rst', 'orders', 'all'],
    queryFn: () => ordersApi.allList(),
  });

  const statuses = useMemo(
    () => [...new Set(rows.map((o) => o.status).filter(Boolean) as string[])].sort(),
    [rows],
  );
  /** The vocabularies actually present, not a hardcoded list — the column is
   *  free text and a tenant's spellings are its own. */
  const distinct = (pick: (o: RstOrderRow) => string | null | undefined) =>
    [...new Set(rows.map(pick).filter(Boolean) as string[])].sort();
  const branches = useMemo(() => {
    const m = new Map<string, string>();
    for (const o of rows) if (o.branch?.id) m.set(o.branch.id, o.branch.name ?? o.branch.id);
    return [...m.entries()].sort((a, b) => a[1].localeCompare(b[1]));
  }, [rows]);
  const types = useMemo(() => distinct((o) => o.order_type), [rows]);
  const payments = useMemo(() => distinct((o) => o.payment_method), [rows]);

  const localDay = (iso?: string | null) => {
    if (!iso) return '';
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) return '';
    const p = (n: number) => String(n).padStart(2, '0');
    return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
  };

  const shown = useMemo(() => {
    const needle = q.trim().toLowerCase();
    return rows.filter((o) => {
      if (status !== ALL && o.status !== status) return false;
      if (branch !== ALL && o.branch?.id !== branch) return false;
      if (type !== ALL && o.order_type !== type) return false;
      if (payment !== ALL && o.payment_method !== payment) return false;
      const day = localDay(o.created_at);
      if (from && (!day || day < from)) return false;
      if (to && (!day || day > to)) return false;
      if (needle) {
        const hay = [o.reference_no, o.code, o.customer_name, o.customer_phone, o.branch?.name]
          .filter(Boolean).join(' ').toLowerCase();
        if (!hay.includes(needle)) return false;
      }
      return true;
    });
  }, [rows, status, branch, type, payment, from, to, q]);

  const filtered = shown.length !== rows.length;
  const clearAll = () => {
    setStatus(ALL); setBranch(ALL); setType(ALL); setPayment(ALL);
    setFrom(''); setTo(''); setQ('');
  };

  const takings = rows
    .filter((o) => (o.status ?? '').toLowerCase() !== 'cancelled')
    .reduce((sum, o) => sum + rstNum(o.total), 0);
  const cancelled = rows.filter((o) => (o.status ?? '').toLowerCase() === 'cancelled');

  const columns: DataTableColumn<RstOrderRow>[] = [
    {
      key: 'ref',
      header: 'Order',
      render: (o) => {
        const items = (o.items ?? (o as any).orderItems) ?? [];
        const itemWithImage = items.find((i: any) => i.image_path || i.image_full_path || i.image_url || i.image || i.menuItem?.imagePath);
        const imageSrc = itemWithImage?.image_path || itemWithImage?.image_full_path || itemWithImage?.image_url || itemWithImage?.image || itemWithImage?.menuItem?.imagePath;
        const itemNames = items.map((i: any) => i.name).filter(Boolean).join(', ');
        return (
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <OrderItemImage src={imageSrc} alt={o.reference_no ?? 'Order'} size={36} />
            <div>
              <div style={{ fontWeight: 600 }}>{o.reference_no ?? o.code ?? o.id.slice(0, 8)}</div>
              {itemNames && (
                <div style={{ fontSize: 11, opacity: 0.7, maxWidth: 200, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {itemNames}
                </div>
              )}
            </div>
          </div>
        );
      },
    },
    { key: 'customer', header: 'Customer', render: (o) => o.customer_name ?? '—' },
    { key: 'branch', header: 'Branch', render: (o) => o.branch?.name ?? '—' },
    { key: 'type', header: 'Type', width: 110, render: (o) => human(o.order_type) },
    {
      key: 'payment', header: 'Payment', width: 120,
      render: (o) => human(o.payment_method),
    },
    { key: 'total', header: 'Amount', align: 'right', width: 120, render: (o) => rstPrice(o.total) },
    {
      key: 'status', header: 'Status', width: 130,
      render: (o) => <Status tone={toneForStatus(o.status)}>{human(o.status)}</Status>,
    },
  ];

  const handlePrintBill = async (orderId: string) => {
    try {
      toast.loading('Fetching receipt for printer...', { id: 'print' });
      const data = await ordersApi.printReceipt(orderId);
      toast.dismiss('print');
      if (data?.html_content) {
        const printWin = window.open('', '_blank', 'width=400,height=600');
        if (printWin) {
          printWin.document.write(data.html_content);
          printWin.document.close();
          printWin.focus();
          setTimeout(() => {
            printWin.print();
          }, 300);
        } else {
          toast.error('Pop-up blocked. Please allow pop-ups to print receipt.');
        }
      } else {
        toast.error('Failed to generate receipt content');
      }
    } catch (err: any) {
      toast.dismiss('print');
      toast.error(err.message || 'Error printing receipt');
    }
  };

  const handlePrintInvoice = async (orderId: string) => {
    try {
      toast.loading('Generating tax invoice...', { id: 'invoice' });
      const data = await ordersApi.invoice(orderId);
      toast.dismiss('invoice');
      if (data?.html_content) {
        const invoiceWin = window.open('', '_blank', 'width=900,height=800');
        if (invoiceWin) {
          invoiceWin.document.write(data.html_content);
          invoiceWin.document.close();
          invoiceWin.focus();
          setTimeout(() => {
            invoiceWin.print();
          }, 300);
        } else {
          toast.error('Pop-up blocked. Please allow pop-ups to view invoice.');
        }
      } else {
        toast.error('Failed to generate invoice content');
      }
    } catch (err: any) {
      toast.dismiss('invoice');
      toast.error(err.message || 'Error loading invoice');
    }
  };

  return (
    <RestaurantPage title="Orders" subtitle="Every order the till has written.">
      <div className="ds-grid ds-grid-kpi">
        <StatCard
          label="Orders" value={isLoading ? '—' : rows.length}
          hint={isLoading ? undefined : `${statuses.length} distinct statuses`}
          tone="info" icon={Receipt}
        />
        <StatCard
          label="Takings" value={isLoading ? '—' : rstPrice(takings)}
          hint={isLoading ? undefined : 'Excludes cancelled'}
          tone="sales" icon={CircleDollarSign}
        />
        <StatCard
          label="Cancelled" value={isLoading ? '—' : cancelled.length}
          tone={cancelled.length ? 'renewal' : 'neutral'} icon={Ban}
        />
      </div>

      <Card pad={14}>
        <div className="rst-filters">
          <div className="rst-seg rst-seg-sm" role="tablist" aria-label="Status filter">
            <button
              role="tab" aria-selected={status === ALL}
              className={`rst-seg-item${status === ALL ? ' is-on' : ''}`}
              onClick={() => setStatus(ALL)}
            >
              All
            </button>
            {statuses.map((s) => (
              <button
                key={s} role="tab" aria-selected={status === s}
                className={`rst-seg-item${status === s ? ' is-on' : ''}`}
                onClick={() => setStatus(s)}
              >
                {human(s)}
              </button>
            ))}
          </div>
        </div>

        {/* Branch, type, payment method and a date range — the same set the
            Laravel register filters on, over the whole list rather than a page. */}
        <div className="rst-filterbar">
          <input
            type="search" value={q} onChange={(e) => setQ(e.target.value)}
            placeholder="Search reference, customer, phone" aria-label="Search orders"
          />
          <select value={branch} onChange={(e) => setBranch(e.target.value)} aria-label="Branch">
            <option value={ALL}>All branches</option>
            {branches.map(([id, name]) => <option key={id} value={id}>{name}</option>)}
          </select>
          <select value={type} onChange={(e) => setType(e.target.value)} aria-label="Order type">
            <option value={ALL}>All types</option>
            {types.map((t) => <option key={t} value={t}>{human(t)}</option>)}
          </select>
          <select value={payment} onChange={(e) => setPayment(e.target.value)} aria-label="Payment method">
            <option value={ALL}>All payments</option>
            {payments.map((pm) => <option key={pm} value={pm}>{human(pm)}</option>)}
          </select>
          <input type="date" value={from} onChange={(e) => setFrom(e.target.value)} aria-label="From date" />
          <input type="date" value={to} onChange={(e) => setTo(e.target.value)} aria-label="To date" />
          {filtered && (
            <button className="btn-ghost btn-sm" onClick={clearAll}>
              Clear ({shown.length} of {rows.length})
            </button>
          )}
        </div>
        {error ? (
          <LoadFailed what="the order register" />
        ) : isLoading ? (
          <Skeleton rows={6} />
        ) : (
          <DataTable
            rows={shown}
            columns={columns}
            rowKey={(o) => o.id}
            onRowClick={(o) => setOpen(o)}
            empty={<EmptyState icon={Receipt} title="No orders in this status" compact />}
          />
        )}
      </Card>

      <Drawer
        open={!!open}
        onClose={() => setOpen(null)}
        title={open?.reference_no ?? 'Order Details'}
      >
        {open && (() => {
          const listItems = (open.items ?? (open as any).orderItems) ?? [];
          return (
            <div>
              <dl className="rst-deflist">
                <div><dt>Status</dt><dd>{human(open.status)}</dd></div>
                <div><dt>Type</dt><dd>{human(open.order_type)}</dd></div>
                <div><dt>Payment</dt><dd>{human(open.payment_method)}</dd></div>
                <div><dt>Customer</dt><dd>{open.customer_name ?? '—'}</dd></div>
                <div><dt>Branch</dt><dd>{open.branch?.name ?? '—'}</dd></div>
                <div><dt>Subtotal</dt><dd>{rstPrice(open.subtotal)}</dd></div>
                <div><dt>Discount</dt><dd>{rstPrice(open.discount_amount)}</dd></div>
                <div><dt>Total</dt><dd>{rstPrice(open.total)}</dd></div>
              </dl>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginTop: 16 }}>
                <button
                  className="btn-primary btn-sm"
                  style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6, width: '100%', height: 38 }}
                  onClick={() => handlePrintBill(open.id)}
                >
                  <Printer size={15} /> Print Bill
                </button>
                <button
                  className="btn-secondary btn-sm"
                  style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6, width: '100%', height: 38 }}
                  onClick={() => handlePrintInvoice(open.id)}
                >
                  <FileText size={15} /> Invoice
                </button>
              </div>

              <div style={{ marginTop: 24, paddingTop: 16, borderTop: '1px solid var(--border, #e5e7eb)' }}>
                <h4 style={{ fontSize: 14, fontWeight: 600, marginBottom: 12, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <span>Ordered Items</span>
                  <span style={{ fontSize: 12, fontWeight: 400, opacity: 0.7 }}>{listItems.length} item(s)</span>
                </h4>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                  {listItems.length === 0 ? (
                    <div style={{ fontSize: 13, color: 'var(--ink-3, #9ca3af)' }}>No items listed</div>
                  ) : (
                    listItems.map((i: any, idx: number) => {
                      const imageSrc = i.image_path || i.image_full_path || i.image_url || i.image || i.menuItem?.imagePath;
                      return (
                        <div
                          key={i.id || idx}
                          style={{
                            display: 'flex',
                            alignItems: 'center',
                            gap: 12,
                            padding: '10px 12px',
                            borderRadius: 8,
                            background: 'var(--bg-subtle, #f9fafb)',
                            border: '1px solid var(--border, #e5e7eb)',
                          }}
                        >
                          <OrderItemImage src={imageSrc} alt={i.name ?? 'Item'} size={44} />
                          <div style={{ flex: 1, minWidth: 0 }}>
                            <div style={{ fontWeight: 600, fontSize: 13 }}>{i.name}</div>
                            <div style={{ fontSize: 12, opacity: 0.7 }}>
                              Qty: {i.quantity} × {rstPrice(i.unit_price ?? i.unitPrice)}
                            </div>
                          </div>
                          <div style={{ fontWeight: 600, fontSize: 13 }}>
                            {rstPrice(i.line_total ?? i.lineTotal ?? (Number(i.unit_price ?? i.unitPrice ?? 0) * (i.quantity ?? 1)))}
                          </div>
                        </div>
                      );
                    })
                  )}
                </div>
              </div>
            </div>
          );
        })()}
      </Drawer>
    </RestaurantPage>
  );
}
