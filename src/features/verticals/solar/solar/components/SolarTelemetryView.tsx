'use client';

import React, { useState } from 'react';
import { Activity, Zap, Sun, ShieldAlert, Cpu, CheckCircle2, Clock } from 'lucide-react';

interface TelemetryProp {
  projectId?: string;
  projectCode?: string;
  customerName?: string;
}

export function SolarTelemetryView({ projectId, projectCode = 'SOL-0042', customerName = 'Al Quoz Solar Facility' }: TelemetryProp) {
  const [vendor, setVendor] = useState('GROWATT');
  const [isPolling, setIsPolling] = useState(false);

  // Mock telemetry stream data
  const livePowerW = 8450; // 8.45 kW
  const dailyKwh = 42.6;
  const expectedPshKwh = 48.0;
  const performanceRatio = 88.7;
  const gridUp = true;
  const tempC = 46.2;
  const strings = [
    { name: 'String 1 (South Roof)', powerW: 4250, voltage: 580, current: 7.3, yieldKwh: 21.4 },
    { name: 'String 2 (East Tilt)', powerW: 4200, voltage: 575, current: 7.3, yieldKwh: 21.2 },
  ];

  const handlePoll = async () => {
    setIsPolling(true);
    setTimeout(() => setIsPolling(false), 1200);
  };

  return (
    <div
      className="space-y-6 p-6 rounded-2xl border shadow-2xl"
      style={{ background: 'var(--surface)', color: 'var(--ink)', borderColor: 'var(--hairline)' }}
    >
      {/* Header Bar */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 border-b pb-4" style={{ borderColor: 'var(--hairline)' }}>
        <div>
          <div className="flex items-center gap-2">
            <span className="px-2.5 py-1 text-xs font-semibold rounded-full flex items-center gap-1" style={{ background: 'var(--tone-active-bg)', color: 'var(--tone-active)', border: '1px solid var(--tone-active-line)' }}>
              <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse"></span> LIVE IoT STREAM
            </span>
            <span className="text-xs font-mono" style={{ color: 'var(--ink-2)' }}>{projectCode}</span>
          </div>
          <h2 className="text-xl font-bold mt-1" style={{ color: 'var(--ink)' }}>{customerName} — IoT Ingestion</h2>
        </div>

        <div className="flex items-center gap-3">
          <select
            value={vendor}
            onChange={(e) => setVendor(e.target.value)}
            className="border text-sm rounded-lg px-3 py-1.5 focus:ring-2 focus:ring-emerald-500 outline-none"
            style={{ background: 'var(--surface-2)', borderColor: 'var(--hairline-strong)', color: 'var(--ink)' }}
          >
            <option value="GROWATT">Growatt ShineServer</option>
            <option value="SOLIS">Solis / Ginlong</option>
            <option value="HUAWEI">Huawei FusionSolar</option>
            <option value="SMA">SMA Sunny Portal</option>
            <option value="FRONIUS">Fronius Solar.web</option>
            <option value="SOLAREDGE">SolarEdge API</option>
          </select>
          <button
            onClick={handlePoll}
            disabled={isPolling}
            className="px-4 py-1.5 font-medium text-sm rounded-lg shadow-lg transition-all flex items-center gap-2 disabled:opacity-50 hover:opacity-90"
            style={{ background: 'var(--tone-active)', color: 'var(--surface)' }}
          >
            <Activity className={`w-4 h-4 ${isPolling ? 'animate-spin' : ''}`} />
            {isPolling ? 'Polling API...' : 'Poll Interval'}
          </button>
        </div>
      </div>

      {/* Primary KPI Grid */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="backdrop-blur-md p-4 rounded-xl border flex flex-col justify-between" style={{ background: 'var(--surface-2)', borderColor: 'var(--hairline)' }}>
          <div className="flex items-center justify-between" style={{ color: 'var(--ink-2)' }}>
            <span className="text-xs font-medium uppercase tracking-wider">Instantaneous Power</span>
            <Zap className="w-4 h-4" style={{ color: 'var(--tone-renewal)' }} />
          </div>
          <div className="mt-3">
            <div className="text-2xl font-black font-mono" style={{ color: 'var(--ink)' }}>{(livePowerW / 1000).toFixed(2)} kW</div>
            <div className="text-xs mt-1 flex items-center gap-1" style={{ color: 'var(--tone-renewal)' }}>
              <span className="w-1.5 h-1.5 rounded-full bg-amber-400 animate-ping"></span> Real-time AC Output
            </div>
          </div>
        </div>

        <div className="backdrop-blur-md p-4 rounded-xl border flex flex-col justify-between" style={{ background: 'var(--surface-2)', borderColor: 'var(--hairline)' }}>
          <div className="flex items-center justify-between" style={{ color: 'var(--ink-2)' }}>
            <span className="text-xs font-medium uppercase tracking-wider">Daily Generation</span>
            <Sun className="w-4 h-4" style={{ color: 'var(--tone-renewal)' }} />
          </div>
          <div className="mt-3">
            <div className="text-2xl font-black font-mono" style={{ color: 'var(--ink)' }}>{dailyKwh} kWh</div>
            <div className="text-xs mt-1" style={{ color: 'var(--ink-2)' }}>Target: {expectedPshKwh} kWh (Weather PSH)</div>
          </div>
        </div>

        <div className="backdrop-blur-md p-4 rounded-xl border flex flex-col justify-between" style={{ background: 'var(--surface-2)', borderColor: 'var(--hairline)' }}>
          <div className="flex items-center justify-between" style={{ color: 'var(--ink-2)' }}>
            <span className="text-xs font-medium uppercase tracking-wider">Performance Ratio</span>
            <Activity className="w-4 h-4" style={{ color: 'var(--tone-active)' }} />
          </div>
          <div className="mt-3">
            <div className="text-2xl font-black font-mono" style={{ color: 'var(--tone-active)' }}>{performanceRatio}%</div>
            <div className="text-xs mt-1" style={{ color: 'var(--tone-active)' }}>Normal Range (&gt;78%)</div>
          </div>
        </div>

        <div className="backdrop-blur-md p-4 rounded-xl border flex flex-col justify-between" style={{ background: 'var(--surface-2)', borderColor: 'var(--hairline)' }}>
          <div className="flex items-center justify-between" style={{ color: 'var(--ink-2)' }}>
            <span className="text-xs font-medium uppercase tracking-wider">Inverter Status</span>
            <Cpu className="w-4 h-4" style={{ color: 'var(--tone-sales)' }} />
          </div>
          <div className="mt-3">
            <div className="flex items-center gap-2">
              <CheckCircle2 className="w-5 h-5" style={{ color: 'var(--tone-active)' }} />
              <span className="text-lg font-bold" style={{ color: 'var(--ink)' }}>Grid Online</span>
            </div>
            <div className="text-xs mt-1" style={{ color: 'var(--ink-2)' }}>Temp: {tempC}°C · Grid: {gridUp ? 'Normal' : 'Down'}</div>
          </div>
        </div>
      </div>

      {/* String-Level Telemetry Breakdown */}
      <div className="p-5 rounded-xl border" style={{ background: 'var(--surface-2)', borderColor: 'var(--hairline)' }}>
        <h3 className="text-sm font-semibold mb-4 flex items-center gap-2" style={{ color: 'var(--ink)' }}>
          <Cpu className="w-4 h-4" style={{ color: 'var(--tone-active)' }} /> Per-String Yield & Voltage Matrix
        </h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {strings.map((s, idx) => (
            <div key={idx} className="p-4 rounded-lg border flex items-center justify-between" style={{ background: 'var(--surface)', borderColor: 'var(--hairline)' }}>
              <div>
                <div className="text-sm font-medium" style={{ color: 'var(--ink)' }}>{s.name}</div>
                <div className="text-xs mt-1" style={{ color: 'var(--ink-2)' }}>
                  Voltage: <span className="font-mono" style={{ color: 'var(--ink)' }}>{s.voltage} V</span> · Current: <span className="font-mono" style={{ color: 'var(--ink)' }}>{s.current} A</span>
                </div>
              </div>
              <div className="text-right">
                <div className="text-lg font-bold font-mono" style={{ color: 'var(--tone-active)' }}>{(s.powerW / 1000).toFixed(2)} kW</div>
                <div className="text-xs font-mono" style={{ color: 'var(--ink-2)' }}>{s.yieldKwh} kWh today</div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
