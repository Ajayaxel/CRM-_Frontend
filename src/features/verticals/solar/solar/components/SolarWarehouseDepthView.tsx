'use client';

import React from 'react';
import { Warehouse, ArrowLeftRight, Package, CheckCircle2, ShieldCheck, Box } from 'lucide-react';

export function SolarWarehouseDepthView() {
  const itemTypes = [
    { code: 'MC4_PAIR', name: 'MC4 Solar Cable Connectors (Male/Female Pair)', cat: 'ACCESSORY', stock: 450 },
    { code: 'MOUNTING_RAIL_4M', name: 'Aluminium Solar Mounting Rail (4 Meter)', cat: 'STRUCTURE', stock: 120 },
    { code: 'SOLAR_CABLE_6MM', name: 'UV Resistant 6mm² DC Solar Cable', cat: 'CABLE', stock: 850 },
    { code: 'SPD_DC_1000V', name: 'Surge Protection Device (1000V DC)', cat: 'PROTECTION', stock: 35 },
  ];

  const transfers = [
    { id: 'TRF-1092', from: 'Central Dubai Depot', to: 'Al Quoz Site Store', item: 'MC4_PAIR', qty: 50, status: 'SHIPPED' },
    { id: 'TRF-1088', from: 'Central Dubai Depot', to: 'Sharjah Hub', item: 'MOUNTING_RAIL_4M', qty: 20, status: 'RECEIVED' },
  ];

  return (
    <div
      className="space-y-6 p-6 rounded-2xl border shadow-2xl"
      style={{ background: 'var(--surface)', color: 'var(--ink)', borderColor: 'var(--hairline)' }}
    >
      {/* Header */}
      <div className="flex items-center justify-between border-b pb-4" style={{ borderColor: 'var(--hairline)' }}>
        <div>
          <div className="flex items-center gap-2">
            <span className="px-2.5 py-1 text-xs font-semibold rounded-full flex items-center gap-1" style={{ background: 'var(--tone-claim-bg)', color: 'var(--tone-claim)', border: '1px solid var(--tone-claim-line)' }}>
              <Warehouse className="w-3.5 h-3.5" /> WAREHOUSE & SOLAR ITEMS (#10 & #9)
            </span>
          </div>
          <h2 className="text-xl font-bold mt-1" style={{ color: 'var(--ink)' }}>Multi-Warehouse Stock Transfers & Solar Accessories</h2>
        </div>
      </div>

      {/* Item Catalogue */}
      <div className="space-y-3">
        <h3 className="text-xs font-semibold uppercase tracking-wider" style={{ color: 'var(--ink-2)' }}>Specialised Solar Component Stock</h3>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {itemTypes.map((it, idx) => (
            <div key={idx} className="p-3.5 rounded-xl border flex items-center justify-between" style={{ background: 'var(--surface-2)', borderColor: 'var(--hairline)' }}>
              <div>
                <span className="text-[10px] font-mono px-1.5 py-0.5 rounded border" style={{ background: 'var(--tone-claim-bg)', color: 'var(--tone-claim)', borderColor: 'var(--tone-claim-line)' }}>
                  {it.code}
                </span>
                <div className="text-xs font-bold mt-1" style={{ color: 'var(--ink)' }}>{it.name}</div>
              </div>
              <div className="text-right">
                <div className="text-sm font-black font-mono" style={{ color: 'var(--tone-renewal)' }}>{it.stock}</div>
                <div className="text-[10px]" style={{ color: 'var(--ink-2)' }}>In Stock</div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Transfers Table */}
      <div className="space-y-3">
        <h3 className="text-xs font-semibold uppercase tracking-wider flex items-center gap-1.5" style={{ color: 'var(--ink-2)' }}>
          <ArrowLeftRight className="w-3.5 h-3.5" style={{ color: 'var(--tone-claim)' }} /> Recent Inter-Warehouse Transfers
        </h3>
        <div className="rounded-xl border overflow-hidden divide-y" style={{ background: 'var(--surface-2)', borderColor: 'var(--hairline)' }}>
          {transfers.map((t, idx) => (
            <div key={idx} className="p-3.5 flex items-center justify-between text-xs" style={{ borderColor: 'var(--hairline)' }}>
              <div className="space-y-0.5">
                <span className="font-mono font-bold" style={{ color: 'var(--ink)' }}>{t.id}</span> — <span className="font-medium" style={{ color: 'var(--ink-2)' }}>{t.item}</span> ({t.qty} units)
                <div className="text-[11px]" style={{ color: 'var(--ink-2)' }}>
                  {t.from} → <span style={{ color: 'var(--ink)' }}>{t.to}</span>
                </div>
              </div>
              <span className="px-2 py-0.5 text-[10px] font-bold rounded " style={{ background: 'var(--tone-claim-bg)', color: 'var(--tone-claim)', border: '1px solid var(--tone-claim-line)' }}>
                {t.status}
              </span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
