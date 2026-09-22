'use client';

import { useState } from 'react';
import { toast } from 'sonner';
import { Blocks, Key, ToggleLeft, ToggleRight, Search, Check, ShieldCheck, HelpCircle } from 'lucide-react';

interface ExtensionApp {
  id: string;
  name: string;
  category: string;
  description: string;
  installed: boolean;
  developer: string;
}

const APPS: ExtensionApp[] = [
  { id: 'stripe', name: 'Stripe Payments', category: 'Payment Gateways', description: 'Enable direct guest folio billing with cards, Apple Pay, and local wallets.', installed: true, developer: 'Stripe Inc.' },
  { id: 'dormakaba', name: 'Dormakaba RFID Key', category: 'Door Locks', description: 'Auto-generate and write room cards directly upon front desk guest check-in.', installed: false, developer: 'Dormakaba' },
  { id: 'quickbooks', name: 'QuickBooks Accounting', category: 'Accounting', description: 'Sync Night Audit balances and POS ledger postings to QuickBooks Online daily.', installed: false, developer: 'Intuit' },
  { id: 'nest', name: 'Google Nest Comfort', category: 'IoT Devices', description: 'Optimize room AC & heating temperature sync dynamically based on occupancy state.', installed: false, developer: 'Google Nest' },
  { id: 'whatsapp', name: 'WATI WhatsApp Broadcast', category: 'CRM', description: 'Configure automated guest templates for pre-arrivals, check-ins, and receipts.', installed: true, developer: 'WATI' },
];

export function MarketplaceStore() {
  const [appsList, setAppsList] = useState<ExtensionApp[]>(APPS);
  const [searchTerm, setSearchTerm] = useState('');

  const toggleInstall = (id: string) => {
    setAppsList(prev =>
      prev.map(app => {
        if (app.id === id) {
          const nextState = !app.installed;
          toast.success(nextState ? `${app.name} installed successfully!` : `${app.name} removed from your workspace.`);
          return { ...app, installed: nextState };
        }
        return app;
      })
    );
  };

  const filteredApps = appsList.filter(app =>
    app.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    app.category.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div style={{ animation: 'fadeUp .4s ease', padding: 24, maxWidth: 1000, margin: '0 auto' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 24 }}>
        <div>
          <h1 style={{ fontSize: 26, fontWeight: 700, letterSpacing: '-.02em', margin: 0 }}>App Marketplace</h1>
          <p style={{ fontSize: 14, color: 'var(--ink-2)', marginTop: 6 }}>Extend BMN Connect with plug-and-play hardware, IoT devices, and corporate accounting suites.</p>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, color: 'var(--success)', background: 'var(--success-soft, #e8f8f0)', padding: '6px 14px', borderRadius: 20, fontWeight: 500 }}>
          <ShieldCheck size={14} /> Sandbox Testing Active
        </div>
      </div>

      {/* Search Bar */}
      <div style={{ position: 'relative', marginBottom: 24 }}>
        <Search size={18} style={{ position: 'absolute', left: 14, top: '50%', transform: 'translateY(-50%)', color: 'var(--ink-3)' }} />
        <input
          type="text"
          placeholder="Search integration apps, categories, or keywords..."
          value={searchTerm}
          onChange={e => setSearchTerm(e.target.value)}
          style={{ width: '100%', padding: '12px 12px 12px 42px', borderRadius: 10, border: '1px solid var(--line-soft)', background: 'var(--surface)', fontSize: 14, boxSizing: 'border-box' }}
        />
      </div>

      {/* App Grid */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(290px, 1fr))', gap: 16 }}>
        {filteredApps.map(app => (
          <div key={app.id} style={{ background: 'var(--surface)', border: '1px solid var(--line-soft)', borderRadius: 14, padding: 20, display: 'flex', flexDirection: 'column', transition: 'all .15s' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 12 }}>
              <div>
                <span style={{ fontSize: 10, fontWeight: 700, color: 'var(--brand)', textTransform: 'uppercase', letterSpacing: '.06em' }}>{app.category}</span>
                <h3 style={{ margin: '4px 0 0', fontSize: 15, fontWeight: 700 }}>{app.name}</h3>
              </div>
              <div style={{ fontSize: 11, color: 'var(--ink-3)' }}>{app.developer}</div>
            </div>

            <p style={{ fontSize: 12, color: 'var(--ink-2)', lineHeight: 1.5, margin: '0 0 20px', flex: 1 }}>{app.description}</p>

            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', paddingTop: 14, borderTop: '1px solid var(--line-soft)' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 11, color: 'var(--ink-3)' }}>
                <Key size={12} /> OAuth permissions
              </div>
              <button
                onClick={() => toggleInstall(app.id)}
                style={{
                  display: 'flex', alignItems: 'center', gap: 6,
                  padding: '8px 16px', borderRadius: 8, fontSize: 12, fontWeight: 600,
                  background: app.installed ? 'var(--bg)' : 'var(--brand)',
                  color: app.installed ? 'var(--ink-2)' : '#fff',
                  border: app.installed ? '1px solid var(--line-soft)' : 'none',
                  cursor: 'pointer', transition: 'all .15s',
                }}
              >
                {app.installed ? <Check size={14} /> : null}
                {app.installed ? 'Installed' : 'Install App'}
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
