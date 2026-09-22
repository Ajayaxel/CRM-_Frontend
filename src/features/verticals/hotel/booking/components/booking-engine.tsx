'use client';

import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { Calendar, User, Tag, ShieldCheck, CreditCard, Sparkles, Plus, Check } from 'lucide-react';
import { api } from '@/lib/api';
import { fmtOrgMoneyExact } from '@/lib/org-locale';
import { useHotelProperty } from '@/features/verticals/hotel/hotel';

interface RoomCategory {
  id: string;
  name: string;
  description: string | null;
  basePriceInr: number;
  capacity: number;
}

interface BookingPackage {
  id: string;
  name: string;
  description: string | null;
  priceInr: number;
  includes: string[];
}

// The *Inr columns hold WHOLE RUPEES, not paise. Dividing by 100 here showed a
// ₹2,000 room as "₹20" — harmless while the screen was wired to a property id
// that matched nothing, and a misquote at the counter the moment it was not.
const money = (v: number) => fmtOrgMoneyExact(v);

export function BookingEngine() {
  const qc = useQueryClient();
  // The property comes from the roster, not from a literal. `useHotelProperty`
  // returns exactly the properties this user may operate; a receptionist with
  // one gets it without choosing.
  const { propertyId, categories: propertyCategories } = useHotelProperty();

  // State
  const [categoryId, setCategoryId] = useState('');
  const [checkInDate, setCheckInDate] = useState('');
  const [checkOutDate, setCheckOutDate] = useState('');
  const [guestName, setGuestName] = useState('');
  const [guestEmail, setGuestEmail] = useState('');
  const [guestPhone, setGuestPhone] = useState('');
  const [promoCode, setPromoCode] = useState('');
  const [selectedPackageId, setSelectedPackageId] = useState('');
  const [selectedAddOns, setSelectedAddOns] = useState<string[]>([]);

  // Queries
  const { data: categories = [] } = useQuery<RoomCategory[]>({
    queryKey: ['room-categories', propertyId],
    queryFn: async () => (await api.get('/hotel/rooms')).data.map((r: any) => r.category).filter((v: any, i: any, self: any) => self.findIndex((t: any) => t.id === v.id) === i),
  });

  const { data: packages = [] } = useQuery<BookingPackage[]>({
    queryKey: ['booking-packages', propertyId],
    queryFn: async () => (await api.get('/hotel-bookings/packages', { params: { propertyId } })).data,
  });

  // Mutations
  const createBooking = useMutation({
    mutationFn: async (data: any) => (await api.post('/hotel-bookings', data)).data,
    onSuccess: (data: any) => {
      toast.success('Direct Booking request created!');
      confirmBooking.mutate(data.id);
    },
    onError: () => toast.error('Failed to create booking'),
  });

  const confirmBooking = useMutation({
    mutationFn: async (bookingId: string) => (await api.post(`/hotel-bookings/${bookingId}/confirm`)).data,
    onSuccess: () => {
      toast.success('Booking confirmed & Reservation created!');
      // Reset form
      setCategoryId('');
      setCheckInDate('');
      setCheckOutDate('');
      setGuestName('');
      setGuestEmail('');
      setGuestPhone('');
      setPromoCode('');
      setSelectedPackageId('');
      setSelectedAddOns([]);
      qc.invalidateQueries({ queryKey: ['pos-orders'] });
    },
  });

  const handleAddOnToggle = (addon: string) => {
    setSelectedAddOns(prev =>
      prev.includes(addon) ? prev.filter(a => a !== addon) : [...prev, addon]
    );
  };

  const handleBook = () => {
    if (!categoryId || !checkInDate || !checkOutDate || !guestName || !guestEmail) {
      toast.error('Please fill in all required fields');
      return;
    }
    createBooking.mutate({
      propertyId,
      guestName,
      guestEmail,
      guestPhone,
      categoryId,
      checkInDate,
      checkOutDate,
      promoCode,
      packageId: selectedPackageId || undefined,
      addOns: selectedAddOns,
    });
  };

  return (
    <div style={{ animation: 'fadeUp .4s ease', padding: 24, maxWidth: 1000, margin: '0 auto' }}>
      <div style={{ marginBottom: 24 }}>
        <h1 style={{ fontSize: 26, fontWeight: 700, letterSpacing: '-.02em', margin: 0 }}>Direct Booking Engine</h1>
        <p style={{ fontSize: 14, color: 'var(--ink-2)', margin: '6px 0 0' }}>SaaS Booking Widget. Creates reservations & awards loyalty rewards immediately.</p>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '3fr 2fr', gap: 20 }}>
        {/* Left: Configuration Form */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          <div style={{ background: 'var(--surface)', border: '1px solid var(--line-soft)', borderRadius: 12, padding: 20 }}>
            <h3 style={{ margin: '0 0 16px', fontSize: 15, fontWeight: 600, display: 'flex', alignItems: 'center', gap: 8 }}>
              <Calendar size={18} style={{ color: 'var(--brand)' }} /> Stay & Guest Details
            </h3>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 12 }}>
              <div>
                <label style={{ fontSize: 12, fontWeight: 500, color: 'var(--ink-3)', display: 'block', marginBottom: 4 }}>Check-In Date *</label>
                <input
                  type="date"
                  value={checkInDate}
                  onChange={e => setCheckInDate(e.target.value)}
                  style={{ width: '100%', padding: '10px', borderRadius: 8, border: '1px solid var(--line-soft)', background: 'var(--bg)', fontSize: 13 }}
                />
              </div>
              <div>
                <label style={{ fontSize: 12, fontWeight: 500, color: 'var(--ink-3)', display: 'block', marginBottom: 4 }}>Check-Out Date *</label>
                <input
                  type="date"
                  value={checkOutDate}
                  onChange={e => setCheckOutDate(e.target.value)}
                  style={{ width: '100%', padding: '10px', borderRadius: 8, border: '1px solid var(--line-soft)', background: 'var(--bg)', fontSize: 13 }}
                />
              </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 12, marginBottom: 16 }}>
              <div style={{ gridColumn: 'span 3' }}>
                <label style={{ fontSize: 12, fontWeight: 500, color: 'var(--ink-3)', display: 'block', marginBottom: 4 }}>Guest Full Name *</label>
                <input
                  type="text"
                  placeholder="John Doe"
                  value={guestName}
                  onChange={e => setGuestName(e.target.value)}
                  style={{ width: '100%', padding: '10px', borderRadius: 8, border: '1px solid var(--line-soft)', background: 'var(--bg)', fontSize: 13 }}
                />
              </div>
              <div style={{ gridColumn: 'span 2' }}>
                <label style={{ fontSize: 12, fontWeight: 500, color: 'var(--ink-3)', display: 'block', marginBottom: 4 }}>Guest Email *</label>
                <input
                  type="email"
                  placeholder="john@example.com"
                  value={guestEmail}
                  onChange={e => setGuestEmail(e.target.value)}
                  style={{ width: '100%', padding: '10px', borderRadius: 8, border: '1px solid var(--line-soft)', background: 'var(--bg)', fontSize: 13 }}
                />
              </div>
              <div>
                <label style={{ fontSize: 12, fontWeight: 500, color: 'var(--ink-3)', display: 'block', marginBottom: 4 }}>Guest Phone</label>
                <input
                  type="text"
                  placeholder="+91 9999999999"
                  value={guestPhone}
                  onChange={e => setGuestPhone(e.target.value)}
                  style={{ width: '100%', padding: '10px', borderRadius: 8, border: '1px solid var(--line-soft)', background: 'var(--bg)', fontSize: 13 }}
                />
              </div>
            </div>

            <div>
              <label style={{ fontSize: 12, fontWeight: 500, color: 'var(--ink-3)', display: 'block', marginBottom: 6 }}>Select Room Category *</label>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))', gap: 10 }}>
                {categories.map(cat => (
                  <button
                    key={cat.id}
                    onClick={() => setCategoryId(cat.id)}
                    style={{
                      background: categoryId === cat.id ? 'var(--brand-soft)' : 'var(--bg)',
                      border: categoryId === cat.id ? '2px solid var(--brand)' : '1px solid var(--line-soft)',
                      borderRadius: 10, padding: 12, cursor: 'pointer', textAlign: 'left', transition: 'all .15s',
                    }}
                  >
                    <div style={{ fontWeight: 600, fontSize: 13, marginBottom: 4 }}>{cat.name}</div>
                    <div style={{ color: 'var(--brand)', fontWeight: 700, fontSize: 14 }}>{money(cat.basePriceInr)}/night</div>
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* Optional Packages & Add-ons */}
          <div style={{ background: 'var(--surface)', border: '1px solid var(--line-soft)', borderRadius: 12, padding: 20 }}>
            <h3 style={{ margin: '0 0 16px', fontSize: 15, fontWeight: 600, display: 'flex', alignItems: 'center', gap: 8 }}>
              <Sparkles size={18} style={{ color: 'var(--gold, #e6a23c)' }} /> Special Packages & Add-ons
            </h3>

            {packages.length > 0 && (
              <div style={{ marginBottom: 16 }}>
                <label style={{ fontSize: 12, fontWeight: 500, color: 'var(--ink-3)', display: 'block', marginBottom: 6 }}>Packages</label>
                <div style={{ display: 'flex', gap: 10, overflowX: 'auto' }}>
                  {packages.map(pkg => (
                    <button
                      key={pkg.id}
                      onClick={() => setSelectedPackageId(selectedPackageId === pkg.id ? '' : pkg.id)}
                      style={{
                        background: selectedPackageId === pkg.id ? 'var(--brand-soft)' : 'var(--bg)',
                        border: selectedPackageId === pkg.id ? '2px solid var(--brand)' : '1px solid var(--line-soft)',
                        borderRadius: 10, padding: 12, cursor: 'pointer', textAlign: 'left', minWidth: 200, flexShrink: 0,
                      }}
                    >
                      <div style={{ fontWeight: 600, fontSize: 13 }}>{pkg.name}</div>
                      <div style={{ color: 'var(--brand)', fontWeight: 700, fontSize: 14, margin: '4px 0' }}>+{money(pkg.priceInr)}</div>
                      <div style={{ fontSize: 11, color: 'var(--ink-3)' }}>{pkg.includes.join(', ')}</div>
                    </button>
                  ))}
                </div>
              </div>
            )}

            <div>
              <label style={{ fontSize: 12, fontWeight: 500, color: 'var(--ink-3)', display: 'block', marginBottom: 6 }}>Custom Stay Add-ons</label>
              <div style={{ display: 'flex', gap: 8 }}>
                {['Airport Transfer', 'Early Check-In', 'Late Check-Out', 'Spa Treatment'].map(addon => {
                  const selected = selectedAddOns.includes(addon);
                  return (
                    <button
                      key={addon}
                      onClick={() => handleAddOnToggle(addon)}
                      style={{
                        display: 'flex', alignItems: 'center', gap: 6,
                        padding: '8px 14px', borderRadius: 20, fontSize: 12, fontWeight: 500,
                        background: selected ? 'var(--brand)' : 'var(--bg)',
                        color: selected ? '#fff' : 'var(--ink-2)',
                        border: selected ? 'none' : '1px solid var(--line-soft)',
                        cursor: 'pointer', transition: 'all .15s',
                      }}
                    >
                      {selected ? <Check size={14} /> : <Plus size={14} />} {addon}
                    </button>
                  );
                })}
              </div>
            </div>
          </div>
        </div>

        {/* Right: Booking Summary & Promo */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          <div style={{ background: 'var(--surface)', border: '1px solid var(--line-soft)', borderRadius: 12, padding: 20 }}>
            <h3 style={{ margin: '0 0 16px', fontSize: 15, fontWeight: 600 }}>Booking Summary</h3>

            {/* Promo input */}
            <div style={{ display: 'flex', gap: 8, marginBottom: 20 }}>
              <input
                type="text"
                placeholder="PROMO CODE"
                value={promoCode}
                onChange={e => setPromoCode(e.target.value)}
                style={{ flex: 1, padding: '10px', borderRadius: 8, border: '1px solid var(--line-soft)', background: 'var(--bg)', fontSize: 13, textTransform: 'uppercase' }}
              />
              <button style={{ padding: '0 16px', borderRadius: 8, border: '1px solid var(--line-soft)', background: 'var(--surface)', fontWeight: 600, fontSize: 13, cursor: 'pointer' }}>
                Apply
              </button>
            </div>

            {/* Price lines */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10, paddingBottom: 16, borderBottom: '1px solid var(--line-soft)' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, color: 'var(--ink-2)' }}>
                <span>Selected Room</span>
                <span>{categoryId ? 'Calculated' : 'None'}</span>
              </div>
              {selectedPackageId && (
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, color: 'var(--ink-2)' }}>
                  <span>Package Boost</span>
                  <span>+{money(packages.find(p => p.id === selectedPackageId)?.priceInr || 0)}</span>
                </div>
              )}
              {selectedAddOns.map(a => (
                <div key={a} style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, color: 'var(--ink-2)' }}>
                  <span>{a}</span>
                  <span>Included</span>
                </div>
              ))}
            </div>

            {/* Action */}
            <button
              onClick={handleBook}
              disabled={createBooking.isPending || confirmBooking.isPending}
              style={{
                width: '100%', marginTop: 20, background: 'var(--brand)', color: '#fff', border: 'none',
                borderRadius: 10, padding: '14px 0', fontSize: 14, fontWeight: 600, cursor: 'pointer',
                display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
              }}
            >
              <CreditCard size={16} /> Confirm & Reserve Stay
            </button>

            <div style={{ display: 'flex', alignItems: 'center', gap: 6, justifyContent: 'center', marginTop: 14, color: 'var(--success)', fontSize: 12, fontWeight: 500 }}>
              <ShieldCheck size={14} /> Instant Confirmation Enabled
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
