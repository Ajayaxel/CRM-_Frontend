'use client';

import { useState } from 'react';
import { Plane, Calendar, CreditCard, Shield, MessageSquare, Download, CheckCircle, Clock } from 'lucide-react';

export default function MyTripPage() {
  const [activeTab, setActiveTab] = useState<'itinerary' | 'docs' | 'payments'>('itinerary');

  return (
    <div style={{ padding: 24, maxWidth: 1000, margin: '0 auto', animation: 'fadeUp .3s ease' }}>
      <div style={{ background: 'linear-gradient(135deg, #1E293B 0%, #0F172A 100%)', color: '#fff', borderRadius: 16, padding: 24, marginBottom: 24 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
          <div>
            <span style={{ fontSize: 11, fontWeight: 700, background: 'rgba(59,130,246,0.2)', color: '#60A5FA', padding: '3px 10px', borderRadius: 20 }}>
              CONFIRMED TRIP
            </span>
            <h1 style={{ fontSize: 24, fontWeight: 700, margin: '10px 0 4px' }}>5 Days Dubai Luxury Experience</h1>
            <p style={{ fontSize: 13, color: '#94A3B8', margin: 0 }}>Booking Ref: BMN-84920 • 2 Pax • Travel Date: 12 Oct 2026</p>
          </div>
          <button
            onClick={() => alert('Opening WhatsApp concierge support...')}
            style={{
              background: '#25D366',
              color: '#fff',
              border: 'none',
              padding: '10px 16px',
              borderRadius: 8,
              fontWeight: 600,
              fontSize: 13,
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: 8,
            }}
          >
            <MessageSquare size={16} /> WhatsApp Concierge
          </button>
        </div>
      </div>

      <div style={{ display: 'flex', gap: 16, borderBottom: '1px solid var(--line-soft)', marginBottom: 20 }}>
        {[
          { id: 'itinerary', label: 'Live Itinerary', icon: Calendar },
          { id: 'docs', label: 'Vouchers & Passports', icon: Shield },
          { id: 'payments', label: 'Payment Balance', icon: CreditCard },
        ].map((t) => {
          const Icon = t.icon;
          const active = activeTab === t.id;
          return (
            <button
              key={t.id}
              onClick={() => setActiveTab(t.id as any)}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 8,
                padding: '10px 0',
                border: 'none',
                background: 'none',
                borderBottom: active ? '2px solid var(--brand)' : '2px solid transparent',
                color: active ? 'var(--brand)' : 'var(--ink-2)',
                fontWeight: active ? 600 : 500,
                fontSize: 14,
                cursor: 'pointer',
              }}
            >
              <Icon size={16} /> {t.label}
            </button>
          );
        })}
      </div>

      {activeTab === 'itinerary' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          <div style={{ background: 'var(--surface)', border: '1px solid var(--line-soft)', borderRadius: 12, padding: 18 }}>
            <h3 style={{ fontSize: 16, fontWeight: 700, margin: '0 0 10px', color: 'var(--brand)' }}>Day 1: Dubai Arrival & Marina Dhow Cruise</h3>
            <p style={{ fontSize: 13, color: 'var(--ink-2)', margin: 0 }}>Arrive at DXB Terminal 3. Meet & greet by representative. Check in at Atlantis The Palm. Sunset Marina Dhow Dinner Cruise included.</p>
          </div>
          <div style={{ background: 'var(--surface)', border: '1px solid var(--line-soft)', borderRadius: 12, padding: 18 }}>
            <h3 style={{ fontSize: 16, fontWeight: 700, margin: '0 0 10px', color: 'var(--brand)' }}>Day 2: Desert Safari & BBQ Dinner</h3>
            <p style={{ fontSize: 13, color: 'var(--ink-2)', margin: 0 }}>Dune bashing in 4x4 Land Cruiser, camel riding, quad biking, and live Tanoura dance show with BBQ dinner.</p>
          </div>
        </div>
      )}

      {activeTab === 'docs' && (
        <div style={{ background: 'var(--surface)', border: '1px solid var(--line-soft)', borderRadius: 12, padding: 20 }}>
          <h3 style={{ fontSize: 16, fontWeight: 700, margin: '0 0 16px' }}>Digital Vouchers & Visa Copy</h3>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '12px 0', borderBottom: '1px solid var(--line-soft)' }}>
            <div>
              <div style={{ fontWeight: 600, fontSize: 14 }}>UAE 30-Day Tourist Visa</div>
              <div style={{ fontSize: 12, color: 'var(--ink-3)' }}>Verified & Issued • Status: APPROVED</div>
            </div>
            <button style={{ padding: '6px 12px', background: 'var(--bg)', border: '1px solid var(--line-soft)', borderRadius: 6, fontSize: 12, fontWeight: 600, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6 }}>
              <Download size={14} /> Download PDF
            </button>
          </div>
        </div>
      )}

      {activeTab === 'payments' && (
        <div style={{ background: 'var(--surface)', border: '1px solid var(--line-soft)', borderRadius: 12, padding: 20 }}>
          <h3 style={{ fontSize: 16, fontWeight: 700, margin: '0 0 16px' }}>Payment Summary</h3>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 14, marginBottom: 16 }}>
            <div style={{ background: 'var(--bg)', padding: 14, borderRadius: 8 }}>
              <span style={{ fontSize: 12, color: 'var(--ink-3)' }}>Total Amount</span>
              <div style={{ fontSize: 18, fontWeight: 700 }}>₹1,50,000</div>
            </div>
            <div style={{ background: 'var(--bg)', padding: 14, borderRadius: 8 }}>
              <span style={{ fontSize: 12, color: 'var(--ink-3)' }}>Paid</span>
              <div style={{ fontSize: 18, fontWeight: 700, color: '#10B981' }}>₹1,50,000</div>
            </div>
            <div style={{ background: 'var(--bg)', padding: 14, borderRadius: 8 }}>
              <span style={{ fontSize: 12, color: 'var(--ink-3)' }}>Balance Due</span>
              <div style={{ fontSize: 18, fontWeight: 700, color: '#3B82F6' }}>₹0</div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
