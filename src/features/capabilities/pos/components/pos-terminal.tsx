'use client';

import { useState, useMemo } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import {
  UtensilsCrossed, Coffee, Wine, ShoppingBag, Sparkles,
  Plus, Minus, Trash2, CreditCard, BedDouble, Ban,
  Receipt, Search, X
} from 'lucide-react';
import { api } from '@/lib/api';
import { fmtOrgMoneyExact } from '@/lib/org-locale';
import { useHotelProperty } from '@/features/verticals/hotel/hotel';

/* ─── Types ─────────────────────────────────────────────────── */
interface MenuItem { id: string; name: string; category: string; priceInr: number; }
interface PosOrderItem { id: string; quantity: number; priceInr: number; totalInr: number; menuItem: MenuItem; }
interface PosOrder { id: string; tableNumber?: string; status: string; subtotalInr: number; taxInr: number; totalInr: number; items: PosOrderItem[]; createdAt: string; }

const CATEGORY_ICONS: Record<string, React.ReactNode> = {
  FOOD: <UtensilsCrossed size={16} />,
  BEVERAGE: <Coffee size={16} />,
  ALCOHOL: <Wine size={16} />,
  RETAIL: <ShoppingBag size={16} />,
  SPA: <Sparkles size={16} />,
};

const CATEGORIES = ['ALL', 'FOOD', 'BEVERAGE', 'ALCOHOL', 'RETAIL', 'SPA'];

// The *Inr columns hold WHOLE RUPEES, not paise. Dividing by 100 here showed a
// ₹2,000 room as "₹20" — harmless while the screen was wired to a property id
// that matched nothing, and a misquote at the counter the moment it was not.
const money = (v: number) => fmtOrgMoneyExact(v);

export function PosTerminal() {
  const qc = useQueryClient();
  const [selectedCategory, setSelectedCategory] = useState('ALL');
  const [activeOrder, setActiveOrder] = useState<PosOrder | null>(null);
  const [showChargeModal, setShowChargeModal] = useState(false);
  const [roomSearch, setRoomSearch] = useState('');

  // Use a mock propertyId — in production this comes from context
  const { propertyId } = useHotelProperty();

  const { data: menuItems = [] } = useQuery<MenuItem[]>({
    queryKey: ['pos-menu', propertyId],
    queryFn: async () => (await api.get('/pos/menu-items', { params: { propertyId } })).data,
  });

  const { data: orders = [] } = useQuery<PosOrder[]>({
    queryKey: ['pos-orders', propertyId],
    queryFn: async () => (await api.get('/pos/orders', { params: { propertyId, status: 'OPEN' } })).data,
  });

  const filteredMenu = useMemo(() =>
    selectedCategory === 'ALL' ? menuItems : menuItems.filter(m => m.category === selectedCategory),
    [menuItems, selectedCategory]
  );

  const createOrder = useMutation({
    mutationFn: async (tableNumber?: string) =>
      (await api.post('/pos/orders', { propertyId, tableNumber })).data,
    onSuccess: (order: PosOrder) => {
      setActiveOrder(order);
      qc.invalidateQueries({ queryKey: ['pos-orders'] });
      toast.success(`Order created${order.tableNumber ? ` — Table ${order.tableNumber}` : ''}`);
    },
  });

  const addItem = useMutation({
    mutationFn: async (menuItemId: string) => {
      if (!activeOrder) return;
      return (await api.post(`/pos/orders/${activeOrder.id}/items`, { menuItemId, quantity: 1 })).data;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['pos-orders'] });
      // Refresh active order
      if (activeOrder) {
        api.get('/pos/orders', { params: { propertyId, status: 'OPEN' } }).then(res => {
          const updated = (res.data as PosOrder[]).find(o => o.id === activeOrder.id);
          if (updated) setActiveOrder(updated);
        });
      }
    },
  });

  const removeItem = useMutation({
    mutationFn: async (itemId: string) => (await api.delete(`/pos/orders/items/${itemId}`)).data,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['pos-orders'] });
      if (activeOrder) {
        api.get('/pos/orders', { params: { propertyId, status: 'OPEN' } }).then(res => {
          const updated = (res.data as PosOrder[]).find(o => o.id === activeOrder.id);
          if (updated) setActiveOrder(updated);
        });
      }
    },
  });

  const settleOrder = useMutation({
    mutationFn: async () => {
      if (!activeOrder) return;
      return (await api.post(`/pos/orders/${activeOrder.id}/settle`)).data;
    },
    onSuccess: () => {
      toast.success('Payment received!');
      setActiveOrder(null);
      qc.invalidateQueries({ queryKey: ['pos-orders'] });
    },
  });

  const chargeToRoom = useMutation({
    mutationFn: async (reservationId: string) => {
      if (!activeOrder) return;
      return (await api.post(`/pos/orders/${activeOrder.id}/charge-to-room`, { reservationId })).data;
    },
    onSuccess: (data: any) => {
      toast.success(`Charged ${money(data.amountCharged)} to guest folio`);
      setActiveOrder(null);
      setShowChargeModal(false);
      qc.invalidateQueries({ queryKey: ['pos-orders'] });
    },
    onError: (err: any) => toast.error(err.response?.data?.message || 'Failed to charge to room'),
  });

  const voidOrder = useMutation({
    mutationFn: async () => {
      if (!activeOrder) return;
      return (await api.post(`/pos/orders/${activeOrder.id}/void`)).data;
    },
    onSuccess: () => {
      toast.success('Order voided');
      setActiveOrder(null);
      qc.invalidateQueries({ queryKey: ['pos-orders'] });
    },
  });

  return (
    <div style={{ display: 'flex', height: 'calc(100vh - 64px)', gap: 0, animation: 'fadeUp .4s ease' }}>
      {/* ─── LEFT: Menu Grid ─────────────────────────────────── */}
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', borderRight: '1px solid var(--line-soft)' }}>
        {/* Category tabs */}
        <div style={{ display: 'flex', gap: 6, padding: '16px 20px', borderBottom: '1px solid var(--line-soft)', overflowX: 'auto' }}>
          {CATEGORIES.map(cat => (
            <button
              key={cat}
              onClick={() => setSelectedCategory(cat)}
              style={{
                display: 'flex', alignItems: 'center', gap: 6,
                padding: '8px 16px', borderRadius: 20, fontSize: 13, fontWeight: 500, whiteSpace: 'nowrap',
                background: selectedCategory === cat ? 'var(--brand)' : 'var(--surface)',
                color: selectedCategory === cat ? '#fff' : 'var(--ink-2)',
                border: selectedCategory === cat ? 'none' : '1px solid var(--line-soft)',
                cursor: 'pointer', transition: 'all .2s',
              }}
            >
              {cat !== 'ALL' && CATEGORY_ICONS[cat]} {cat}
            </button>
          ))}
        </div>

        {/* Menu items grid */}
        <div style={{ flex: 1, overflow: 'auto', padding: 20 }}>
          {filteredMenu.length === 0 ? (
            <div style={{ textAlign: 'center', padding: 60, color: 'var(--ink-3)' }}>
              <UtensilsCrossed size={40} style={{ opacity: .3, marginBottom: 12 }} />
              <p style={{ fontSize: 15 }}>No menu items yet. Add items from the Menu Management panel.</p>
            </div>
          ) : (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(160px, 1fr))', gap: 12 }}>
              {filteredMenu.map(item => (
                <button
                  key={item.id}
                  onClick={() => activeOrder && addItem.mutate(item.id)}
                  disabled={!activeOrder}
                  style={{
                    background: 'var(--surface)', border: '1px solid var(--line-soft)', borderRadius: 12,
                    padding: 16, cursor: activeOrder ? 'pointer' : 'not-allowed',
                    opacity: activeOrder ? 1 : 0.5, transition: 'all .15s', textAlign: 'left',
                  }}
                  onMouseOver={e => { if (activeOrder) (e.currentTarget.style.borderColor = 'var(--brand)'); }}
                  onMouseOut={e => { e.currentTarget.style.borderColor = 'var(--line-soft)'; }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 8, color: 'var(--ink-3)', fontSize: 12 }}>
                    {CATEGORY_ICONS[item.category]} {item.category}
                  </div>
                  <div style={{ fontWeight: 600, fontSize: 14, marginBottom: 4 }}>{item.name}</div>
                  <div style={{ color: 'var(--brand)', fontWeight: 700, fontSize: 15 }}>{money(item.priceInr)}</div>
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Open orders bar */}
        <div style={{ borderTop: '1px solid var(--line-soft)', padding: '12px 20px', display: 'flex', gap: 8, alignItems: 'center', overflowX: 'auto' }}>
          <button
            onClick={() => {
              const table = prompt('Table number (optional):');
              createOrder.mutate(table || undefined);
            }}
            style={{
              background: 'var(--brand)', color: '#fff', border: 'none', borderRadius: 8,
              padding: '10px 16px', fontSize: 13, fontWeight: 600, cursor: 'pointer',
              display: 'flex', alignItems: 'center', gap: 6, whiteSpace: 'nowrap',
            }}
          >
            <Plus size={15} /> New Order
          </button>
          {orders.map(o => (
            <button
              key={o.id}
              onClick={() => setActiveOrder(o)}
              style={{
                background: activeOrder?.id === o.id ? 'var(--brand-soft)' : 'var(--surface)',
                border: activeOrder?.id === o.id ? '2px solid var(--brand)' : '1px solid var(--line-soft)',
                borderRadius: 8, padding: '8px 14px', fontSize: 12, fontWeight: 500, cursor: 'pointer',
                whiteSpace: 'nowrap',
              }}
            >
              {o.tableNumber ? `Table ${o.tableNumber}` : `#${o.id.slice(-4)}`} · {money(o.totalInr)}
            </button>
          ))}
        </div>
      </div>

      {/* ─── RIGHT: Active Ticket ────────────────────────────── */}
      <div style={{ width: 380, display: 'flex', flexDirection: 'column', background: 'var(--surface)' }}>
        {!activeOrder ? (
          <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', flexDirection: 'column', color: 'var(--ink-3)' }}>
            <Receipt size={48} style={{ opacity: .3, marginBottom: 16 }} />
            <p style={{ fontSize: 15, fontWeight: 500 }}>No active order</p>
            <p style={{ fontSize: 13, marginTop: 4 }}>Create a new order or select one below</p>
          </div>
        ) : (
          <>
            {/* Ticket header */}
            <div style={{ padding: '16px 20px', borderBottom: '1px solid var(--line-soft)' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <h3 style={{ margin: 0, fontSize: 16, fontWeight: 700 }}>
                  {activeOrder.tableNumber ? `Table ${activeOrder.tableNumber}` : `Order #${activeOrder.id.slice(-4)}`}
                </h3>
                <span style={{
                  padding: '4px 10px', borderRadius: 12, fontSize: 11, fontWeight: 600,
                  background: 'var(--success-soft, #e8f8f0)', color: 'var(--success)',
                }}>
                  OPEN
                </span>
              </div>
            </div>

            {/* Line items */}
            <div style={{ flex: 1, overflow: 'auto', padding: '12px 20px' }}>
              {(activeOrder.items ?? []).length === 0 ? (
                <p style={{ textAlign: 'center', color: 'var(--ink-3)', fontSize: 14, marginTop: 40 }}>
                  Tap menu items to add them
                </p>
              ) : (
                activeOrder.items.map(item => (
                  <div key={item.id} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 0', borderBottom: '1px solid var(--line-soft)' }}>
                    <div style={{ flex: 1 }}>
                      <div style={{ fontWeight: 500, fontSize: 14 }}>{item.menuItem.name}</div>
                      <div style={{ fontSize: 12, color: 'var(--ink-3)' }}>{item.quantity}x @ {money(item.priceInr)}</div>
                    </div>
                    <div style={{ fontWeight: 600, fontSize: 14, minWidth: 70, textAlign: 'right' }}>
                      {money(item.totalInr)}
                    </div>
                    <button
                      onClick={() => removeItem.mutate(item.id)}
                      style={{ background: 'none', border: 'none', color: 'var(--danger)', cursor: 'pointer', padding: 4 }}
                    >
                      <Trash2 size={14} />
                    </button>
                  </div>
                ))
              )}
            </div>

            {/* Totals */}
            <div style={{ padding: '16px 20px', borderTop: '1px solid var(--line-soft)', background: 'var(--bg)' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, color: 'var(--ink-2)', marginBottom: 6 }}>
                <span>Subtotal</span><span>{money(activeOrder.subtotalInr)}</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, color: 'var(--ink-2)', marginBottom: 10 }}>
                <span>GST (5%)</span><span>{money(activeOrder.taxInr)}</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 18, fontWeight: 700 }}>
                <span>Total</span><span>{money(activeOrder.totalInr)}</span>
              </div>
            </div>

            {/* Action buttons */}
            <div style={{ padding: '12px 20px', display: 'flex', gap: 8, borderTop: '1px solid var(--line-soft)' }}>
              <button
                onClick={() => settleOrder.mutate()}
                disabled={(activeOrder.items ?? []).length === 0}
                style={{
                  flex: 1, background: 'var(--success)', color: '#fff', border: 'none', borderRadius: 10,
                  padding: '14px 0', fontSize: 14, fontWeight: 600, cursor: 'pointer',
                  display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
                  opacity: (activeOrder.items ?? []).length === 0 ? .5 : 1,
                }}
              >
                <CreditCard size={16} /> Pay
              </button>
              <button
                onClick={() => setShowChargeModal(true)}
                disabled={(activeOrder.items ?? []).length === 0}
                style={{
                  flex: 1, background: 'var(--brand)', color: '#fff', border: 'none', borderRadius: 10,
                  padding: '14px 0', fontSize: 14, fontWeight: 600, cursor: 'pointer',
                  display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
                  opacity: (activeOrder.items ?? []).length === 0 ? .5 : 1,
                }}
              >
                <BedDouble size={16} /> Room
              </button>
              <button
                onClick={() => voidOrder.mutate()}
                style={{
                  background: 'var(--danger)', color: '#fff', border: 'none', borderRadius: 10,
                  padding: '14px 16px', fontSize: 14, fontWeight: 600, cursor: 'pointer',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                }}
              >
                <Ban size={16} />
              </button>
            </div>
          </>
        )}
      </div>

      {/* ─── Charge to Room Modal ────────────────────────────── */}
      {showChargeModal && (
        <div style={{
          position: 'fixed', inset: 0, background: 'rgba(0,0,0,.5)', display: 'flex',
          alignItems: 'center', justifyContent: 'center', zIndex: 9999,
        }}>
          <div style={{
            background: 'var(--surface)', borderRadius: 16, width: 420, maxHeight: '80vh',
            overflow: 'auto', padding: 24,
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
              <h3 style={{ margin: 0, fontSize: 18, fontWeight: 700 }}>Charge to Room</h3>
              <button onClick={() => setShowChargeModal(false)} style={{ background: 'none', border: 'none', cursor: 'pointer' }}>
                <X size={20} />
              </button>
            </div>
            <div style={{ position: 'relative', marginBottom: 16 }}>
              <Search size={16} style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', color: 'var(--ink-3)' }} />
              <input
                type="text"
                placeholder="Search by guest name or room..."
                value={roomSearch}
                onChange={e => setRoomSearch(e.target.value)}
                style={{
                  width: '100%', padding: '12px 12px 12px 36px', borderRadius: 10,
                  border: '1px solid var(--line-soft)', fontSize: 14, background: 'var(--bg)',
                  boxSizing: 'border-box',
                }}
              />
            </div>
            <p style={{ fontSize: 13, color: 'var(--ink-3)', textAlign: 'center', padding: 20 }}>
              Enter a reservation ID to charge <strong>{money(activeOrder?.totalInr ?? 0)}</strong> to the guest's folio.
            </p>
            <div style={{ display: 'flex', gap: 8 }}>
              <input
                id="reservationId"
                type="text"
                placeholder="Reservation ID"
                style={{
                  flex: 1, padding: '12px', borderRadius: 10,
                  border: '1px solid var(--line-soft)', fontSize: 14, background: 'var(--bg)',
                }}
              />
              <button
                onClick={() => {
                  const el = document.getElementById('reservationId') as HTMLInputElement;
                  if (el?.value) chargeToRoom.mutate(el.value);
                }}
                style={{
                  background: 'var(--brand)', color: '#fff', border: 'none', borderRadius: 10,
                  padding: '12px 20px', fontSize: 14, fontWeight: 600, cursor: 'pointer',
                }}
              >
                Charge
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
