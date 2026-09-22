'use client';

import React, { useState } from 'react';
import { ShieldAlert, AlertTriangle, CheckCircle2, Clock, Ticket, RefreshCw, Cpu } from 'lucide-react';
import { SolarFaultEvent } from '../solar-client';

interface FaultViewProps {
  projectId?: string;
  faults?: SolarFaultEvent[];
}

export function SolarFaultManagementView({ projectId, faults: initialFaults }: FaultViewProps) {
  const [evaluating, setEvaluating] = useState(false);
  const [events, setEvents] = useState<SolarFaultEvent[]>(
    initialFaults || [
      {
        id: 'flt-101',
        projectId: projectId || 'proj-1',
        faultType: 'UNDERPERFORMANCE',
        severity: 'MEDIUM',
        status: 'OPEN',
        firstSeenAt: new Date(Date.now() - 2 * 86400_000).toISOString(),
        lastSeenAt: new Date().toISOString(),
        serviceTicketId: 'TCK-8842',
        detail: 'Generating 64% of expected for 3 consecutive days (Weather PSH target mismatch)',
      },
      {
        id: 'flt-100',
        projectId: projectId || 'proj-1',
        faultType: 'INVERTER_DOWN',
        severity: 'HIGH',
        status: 'RESOLVED',
        firstSeenAt: new Date(Date.now() - 5 * 86400_000).toISOString(),
        lastSeenAt: new Date(Date.now() - 4 * 86400_000).toISOString(),
        resolvedAt: new Date(Date.now() - 4 * 86400_000).toISOString(),
        serviceTicketId: 'TCK-8810',
        detail: 'No generation recorded during daylight hours. Auto-resolved when power restored.',
      },
    ]
  );

  const triggerEvaluation = async () => {
    setEvaluating(true);
    setTimeout(() => setEvaluating(false), 1000);
  };

  const getSeverityBadge = (sev: string) => {
    switch (sev) {
      case 'HIGH':
        return <span className="px-2 py-0.5 text-xs font-bold rounded-md " style={{ background: 'var(--tone-expired-bg)', color: 'var(--tone-expired)', border: '1px solid var(--tone-expired-line)' }}>HIGH</span>;
      case 'MEDIUM':
        return <span className="px-2 py-0.5 text-xs font-bold rounded-md " style={{ background: 'var(--tone-renewal-bg)', color: 'var(--tone-renewal)', border: '1px solid var(--tone-renewal-line)' }}>MEDIUM</span>;
      default:
        return <span className="px-2 py-0.5 text-xs font-bold rounded-md " style={{ background: 'var(--tone-sales-bg)', color: 'var(--tone-sales)', border: '1px solid var(--tone-sales-line)' }}>LOW</span>;
    }
  };

  return (
    <div
      className="space-y-6 p-6 rounded-2xl border shadow-2xl"
      style={{ background: 'var(--surface)', color: 'var(--ink)', borderColor: 'var(--hairline)' }}
    >
      <div className="flex items-center justify-between border-b pb-4" style={{ borderColor: 'var(--hairline)' }}>
        <div>
          <div className="flex items-center gap-2">
            <span className="px-2.5 py-1 text-xs font-semibold rounded-full flex items-center gap-1" style={{ background: 'var(--tone-sales-bg)', color: 'var(--tone-sales)', border: '1px solid var(--tone-sales-line)' }}>
              <Cpu className="w-3.5 h-3.5" /> AI FAULT ENGINE (2B)
            </span>
          </div>
          <h2 className="text-xl font-bold mt-1" style={{ color: 'var(--ink)' }}>Autonomous Fault Monitoring & Auto-Tickets</h2>
        </div>

        <button
          onClick={triggerEvaluation}
          disabled={evaluating}
          className="px-4 py-1.5 text-sm font-medium rounded-lg shadow-lg transition-all flex items-center gap-2 disabled:opacity-50 hover:opacity-90"
          style={{ background: 'var(--tone-sales)', color: 'var(--surface)' }}
        >
          <RefreshCw className={`w-4 h-4 ${evaluating ? 'animate-spin' : ''}`} />
          {evaluating ? 'Evaluating Stream...' : 'Run Fault Rules'}
        </button>
      </div>

      {/* Invariant Banner */}
      <div className="p-3.5 rounded-xl border text-xs flex items-start gap-2.5" style={{ background: 'var(--tone-sales-bg)', borderColor: 'var(--tone-sales-line)', color: 'var(--ink-2)' }}>
        <ShieldAlert className="w-4 h-4 shrink-0 mt-0.5" style={{ color: 'var(--tone-sales)' }} />
        <div>
          <span className="font-semibold" style={{ color: 'var(--tone-sales)' }}>Single Open-Ticket Invariant:</span> An ongoing fault updates its existing ticket (<code className="px-1 py-0.5 rounded" style={{ background: 'var(--surface-2)', color: 'var(--ink)' }}>touch()</code>) instead of flooding the service desk with duplicate tickets on every poll.
        </div>
      </div>

      {/* Fault Events Table */}
      <div className="rounded-xl border overflow-hidden" style={{ background: 'var(--surface-2)', borderColor: 'var(--hairline)' }}>
        <div className="px-4 py-3 border-b text-xs font-semibold uppercase tracking-wider grid grid-cols-12 gap-2" style={{ borderColor: 'var(--hairline)', color: 'var(--ink-2)' }}>
          <div className="col-span-3">Fault Type</div>
          <div className="col-span-2">Severity</div>
          <div className="col-span-2">Status</div>
          <div className="col-span-3">Service Ticket</div>
          <div className="col-span-2">Last Touch</div>
        </div>

        <div className="divide-y">
          {events.map((evt) => (
            <div key={evt.id} className="p-4 hover:bg-[var(--surface)] transition-colors space-y-2" style={{ borderColor: 'var(--hairline)' }}>
              <div className="grid grid-cols-12 gap-2 items-center text-sm">
                <div className="col-span-3 font-semibold flex items-center gap-2" style={{ color: 'var(--ink)' }}>
                  <AlertTriangle className="w-4 h-4" style={{ color: evt.status === 'OPEN' ? 'var(--tone-renewal)' : 'var(--ink-3)' }} />
                  {evt.faultType}
                </div>
                <div className="col-span-2">{getSeverityBadge(evt.severity)}</div>
                <div className="col-span-2">
                  {evt.status === 'OPEN' ? (
                    <span className="px-2 py-0.5 text-xs font-medium rounded flex items-center gap-1 w-fit" style={{ background: 'var(--tone-active-bg)', color: 'var(--tone-active)', border: '1px solid var(--tone-active-line)' }}>
                      <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse"></span> ACTIVE
                    </span>
                  ) : (
                    <span className="px-2 py-0.5 text-xs font-medium rounded border flex items-center gap-1 w-fit" style={{ background: 'var(--tone-neutral-bg)', color: 'var(--tone-neutral)', borderColor: 'var(--tone-neutral-line)' }}>
                      <CheckCircle2 className="w-3 h-3" /> RESOLVED
                    </span>
                  )}
                </div>
                <div className="col-span-3 font-mono text-xs flex items-center gap-1.5" style={{ color: 'var(--tone-sales)' }}>
                  <Ticket className="w-3.5 h-3.5" /> {evt.serviceTicketId || '—'}
                </div>
                <div className="col-span-2 text-xs flex items-center gap-1" style={{ color: 'var(--ink-2)' }}>
                  <Clock className="w-3 h-3" style={{ color: 'var(--ink-3)' }} /> {new Date(evt.lastSeenAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                </div>
              </div>
              {evt.detail && (
                <div className="text-xs pl-6 border-l-2 ml-2" style={{ color: 'var(--ink-2)', borderColor: 'var(--hairline-strong)' }}>
                  {evt.detail}
                </div>
              )}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
