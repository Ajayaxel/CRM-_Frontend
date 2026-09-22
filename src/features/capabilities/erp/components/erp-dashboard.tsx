'use client';

import { useState } from 'react';
import { useMutation } from '@tanstack/react-query';
import { toast } from 'sonner';
import { Moon, Package, Receipt, Users, Wallet, CheckCircle2, ChevronRight, Activity } from 'lucide-react';
import { api } from '@/lib/api';
import { useHotelProperty } from '@/features/verticals/hotel/hotel';

const TABS = ['Finance & Accounts', 'Procurement & Inventory', 'Payroll', 'Night Audit'];

export function ErpDashboard() {
  const [activeTab, setActiveTab] = useState('Night Audit');

  // The night audit posts a night's room charges for a real property. It ran
  // against the string 'mock-property-id', which matches nothing — so it
  // reported success while charging nobody.
  const { propertyId } = useHotelProperty();

  const auditMutation = useMutation({
    mutationFn: async () => {
      const { data } = await api.post('/finance/night-audit', {
        propertyId,
        date: new Date().toISOString(),
      });
      return data;
    },
    onSuccess: (data) => {
      toast.success(`Night Audit Completed. ${data.roomsProcessed} rooms processed. ₹${data.revenuePosted} posted.`);
    },
    onError: (err: any) => {
      toast.error(err.response?.data?.message || 'Failed to run Night Audit');
    },
  });

  return (
    <div style={{ animation: 'fadeUp .4s ease', padding: 24, maxWidth: 1200, margin: '0 auto' }}>
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 24 }}>
        <div>
          <h1 style={{ fontSize: 26, fontWeight: 700, letterSpacing: '-.02em', margin: 0 }}>Enterprise ERP</h1>
          <p style={{ fontSize: 14, color: 'var(--ink-2)', margin: '6px 0 0' }}>Unified general ledger, procurement, inventory, and payroll.</p>
        </div>
      </div>

      <div style={{ display: 'flex', gap: 8, marginBottom: 24, borderBottom: '1px solid var(--line-soft)', paddingBottom: 16 }}>
        {TABS.map((t) => (
          <button
            key={t}
            onClick={() => setActiveTab(t)}
            style={{
              padding: '8px 16px',
              borderRadius: 20,
              fontSize: 14,
              fontWeight: 500,
              background: activeTab === t ? 'var(--brand)' : 'transparent',
              color: activeTab === t ? '#fff' : 'var(--ink-2)',
              border: 'none',
              cursor: 'pointer',
              transition: 'all 0.2s'
            }}
          >
            {t}
          </button>
        ))}
      </div>

      {activeTab === 'Night Audit' && (
        <div style={{ background: 'var(--surface)', border: '1px solid var(--line-soft)', borderRadius: 16, padding: 32, textAlign: 'center' }}>
          <div style={{ width: 64, height: 64, borderRadius: 32, background: 'var(--brand-soft)', color: 'var(--brand)', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 16px' }}>
            <Moon size={32} />
          </div>
          <h2 style={{ fontSize: 20, fontWeight: 600, margin: '0 0 8px' }}>Run Night Audit</h2>
          <p style={{ color: 'var(--ink-2)', maxWidth: 400, margin: '0 auto 24px' }}>
            Execute the end-of-day process to automatically post room charges to all active guest folios and increment the business date.
          </p>
          <button
            onClick={() => auditMutation.mutate()}
            disabled={auditMutation.isPending}
            style={{
              background: 'var(--brand)',
              color: '#fff',
              border: 'none',
              padding: '12px 24px',
              borderRadius: 8,
              fontSize: 15,
              fontWeight: 600,
              cursor: auditMutation.isPending ? 'not-allowed' : 'pointer',
              opacity: auditMutation.isPending ? 0.7 : 1,
              display: 'inline-flex',
              alignItems: 'center',
              gap: 8
            }}
          >
            {auditMutation.isPending ? <Activity className="spin" size={18} /> : <CheckCircle2 size={18} />}
            {auditMutation.isPending ? 'Processing...' : 'Execute Night Audit'}
          </button>
        </div>
      )}

      {activeTab === 'Finance & Accounts' && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 16 }}>
          <div style={{ background: 'var(--surface)', border: '1px solid var(--line-soft)', borderRadius: 12, padding: 24 }}>
            <Wallet size={24} style={{ color: 'var(--brand)', marginBottom: 12 }} />
            <h3 style={{ margin: '0 0 4px', fontSize: 16 }}>General Ledger</h3>
            <p style={{ color: 'var(--ink-2)', fontSize: 14, margin: 0 }}>View Chart of Accounts and Journal Entries.</p>
          </div>
          <div style={{ background: 'var(--surface)', border: '1px solid var(--line-soft)', borderRadius: 12, padding: 24 }}>
            <Receipt size={24} style={{ color: 'var(--success)', marginBottom: 12 }} />
            <h3 style={{ margin: '0 0 4px', fontSize: 16 }}>Guest Folios</h3>
            <p style={{ color: 'var(--ink-2)', fontSize: 14, margin: 0 }}>Manage checked-in guest billing and payments.</p>
          </div>
        </div>
      )}

      {activeTab === 'Procurement & Inventory' && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 16 }}>
          <div style={{ background: 'var(--surface)', border: '1px solid var(--line-soft)', borderRadius: 12, padding: 24 }}>
            <Package size={24} style={{ color: 'var(--brand)', marginBottom: 12 }} />
            <h3 style={{ margin: '0 0 4px', fontSize: 16 }}>Purchase Orders</h3>
            <p style={{ color: 'var(--ink-2)', fontSize: 14, margin: 0 }}>Create POs for vendors and suppliers.</p>
          </div>
          <div style={{ background: 'var(--surface)', border: '1px solid var(--line-soft)', borderRadius: 12, padding: 24 }}>
            <Activity size={24} style={{ color: 'var(--gold)', marginBottom: 12 }} />
            <h3 style={{ margin: '0 0 4px', fontSize: 16 }}>Stock Levels</h3>
            <p style={{ color: 'var(--ink-2)', fontSize: 14, margin: 0 }}>Monitor linens, F&B ingredients, and amenities.</p>
          </div>
        </div>
      )}

      {activeTab === 'Payroll' && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 16 }}>
          <div style={{ background: 'var(--surface)', border: '1px solid var(--line-soft)', borderRadius: 12, padding: 24 }}>
            <Users size={24} style={{ color: 'var(--brand)', marginBottom: 12 }} />
            <h3 style={{ margin: '0 0 4px', fontSize: 16 }}>Staff Registry</h3>
            <p style={{ color: 'var(--ink-2)', fontSize: 14, margin: 0 }}>Manage employees, roles, and base salaries.</p>
          </div>
          <div style={{ background: 'var(--surface)', border: '1px solid var(--line-soft)', borderRadius: 12, padding: 24 }}>
            <Receipt size={24} style={{ color: 'var(--danger)', marginBottom: 12 }} />
            <h3 style={{ margin: '0 0 4px', fontSize: 16 }}>Payslips</h3>
            <p style={{ color: 'var(--ink-2)', fontSize: 14, margin: 0 }}>Generate monthly payroll records and deductions.</p>
          </div>
        </div>
      )}
    </div>
  );
}
