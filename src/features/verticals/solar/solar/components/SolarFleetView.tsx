'use client';

import React from 'react';
import { Truck, Navigation, Fuel, CheckCircle2, AlertCircle, Clock, MapPin } from 'lucide-react';

export function SolarFleetView() {
  const vehicles = [
    { plate: 'DXB-58291', make: 'Toyota', model: 'HiAce Van', type: 'INSTALLATION_VAN', driver: 'Rashid Khan (Lead Tech)', status: 'IN_TRANSIT', fuel: 84, odo: 42150 },
    { plate: 'DXB-10492', make: 'Isuzu', model: 'NPR 4-Ton Truck', type: 'PANEL_TRANSPORT', driver: 'Amit Patel', status: 'AVAILABLE', fuel: 92, odo: 68300 },
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
            <span className="px-2.5 py-1 text-xs font-semibold rounded-full flex items-center gap-1" style={{ background: 'var(--tone-renewal-bg)', color: 'var(--tone-renewal)', border: '1px solid var(--tone-renewal-line)' }}>
              <Truck className="w-3.5 h-3.5" /> FLEET & DISPATCH (#22)
            </span>
          </div>
          <h2 className="text-xl font-bold mt-1" style={{ color: 'var(--ink)' }}>Crew Installation Fleet & GPS Odometer Tracking</h2>
        </div>
      </div>

      {/* Vehicle Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {vehicles.map((v, idx) => (
          <div key={idx} className="p-5 rounded-xl border space-y-3" style={{ background: 'var(--surface-2)', borderColor: 'var(--hairline)' }}>
            <div className="flex items-center justify-between">
              <div>
                <span className="text-xs font-mono px-2 py-0.5 rounded border font-bold" style={{ background: 'var(--tone-neutral-bg)', color: 'var(--tone-neutral)', borderColor: 'var(--tone-neutral-line)' }}>
                  {v.plate}
                </span>
                <h3 className="text-base font-bold mt-1" style={{ color: 'var(--ink)' }}>{v.make} {v.model}</h3>
              </div>
              <span className={`px-2.5 py-1 text-[10px] font-bold rounded-full flex items-center gap-1 border ${
                v.status === 'IN_TRANSIT'
                  ? 'bg-[var(--tone-renewal-bg)] text-[var(--tone-renewal)] border-[var(--tone-renewal-line)]'
                  : 'bg-[var(--tone-active-bg)] text-[var(--tone-active)] border-[var(--tone-active-line)]'
              }`}>
                <Navigation className="w-3 h-3" /> {v.status}
              </span>
            </div>

            <div className="text-xs" style={{ color: 'var(--ink-2)' }}>
              Assigned Driver: <span className="font-medium" style={{ color: 'var(--ink)' }}>{v.driver}</span>
            </div>

            <div className="grid grid-cols-2 gap-2 pt-2 border-t text-xs" style={{ borderColor: 'var(--hairline)' }}>
              <div className="flex items-center gap-1.5" style={{ color: 'var(--ink-2)' }}>
                <Fuel className="w-3.5 h-3.5" style={{ color: 'var(--tone-active)' }} /> Fuel: <span className="font-mono font-bold" style={{ color: 'var(--ink)' }}>{v.fuel}%</span>
              </div>
              <div className="flex items-center gap-1.5" style={{ color: 'var(--ink-2)' }}>
                <MapPin className="w-3.5 h-3.5" style={{ color: 'var(--tone-sales)' }} /> Odometer: <span className="font-mono font-bold" style={{ color: 'var(--ink)' }}>{v.odo.toLocaleString()} km</span>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
