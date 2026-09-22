'use client';

import React from 'react';
import { Bell, Send, CheckCircle2, MessageSquare, Mail, Phone, Smartphone } from 'lucide-react';

export function SolarNotificationEngineView() {
  const events = [
    { type: 'PROPOSAL_SENT', channel: 'WHATSAPP', recipient: '+971501234567', time: '10 mins ago', status: 'SENT' },
    { type: 'PAYMENT_RECEIVED', channel: 'EMAIL', recipient: 'customer@alquozsolar.ae', time: '2 hours ago', status: 'SENT' },
    { type: 'FAULT_RAISED', channel: 'WHATSAPP', recipient: '+971509876543', time: 'Yesterday', status: 'SENT' },
    { type: 'INVOICE_GENERATED', channel: 'EMAIL', recipient: 'finance@alquozsolar.ae', time: '2 days ago', status: 'SENT' },
  ];

  const getChannelIcon = (ch: string) => {
    switch (ch) {
      case 'WHATSAPP':
        return <MessageSquare className="w-4 h-4" style={{ color: 'var(--tone-active)' }} />;
      case 'EMAIL':
        return <Mail className="w-4 h-4" style={{ color: 'var(--tone-sales)' }} />;
      case 'SMS':
        return <Phone className="w-4 h-4" style={{ color: 'var(--tone-renewal)' }} />;
      default:
        return <Smartphone className="w-4 h-4" style={{ color: 'var(--tone-claim)' }} />;
    }
  };

  return (
    <div
      className="space-y-6 p-6 rounded-2xl border shadow-2xl"
      style={{ background: 'var(--surface)', color: 'var(--ink)', borderColor: 'var(--hairline)' }}
    >
      {/* Header */}
      <div className="flex items-center justify-between border-b pb-4" style={{ borderColor: 'var(--hairline)' }}>
        <div>
          <div className="flex items-center gap-2">
            <span className="px-2.5 py-1 text-xs font-semibold rounded-full flex items-center gap-1" style={{ background: 'var(--tone-sales-bg)', color: 'var(--tone-sales)', border: '1px solid var(--tone-sales-line)' }}>
              <Bell className="w-3.5 h-3.5" /> EVENT ENGINE (#27)
            </span>
          </div>
          <h2 className="text-xl font-bold mt-1" style={{ color: 'var(--ink)' }}>Multi-Channel Lifecycle Notification Engine</h2>
        </div>
      </div>

      {/* Events Table */}
      <div className="rounded-xl border overflow-hidden" style={{ background: 'var(--surface-2)', borderColor: 'var(--hairline)' }}>
        <div className="px-4 py-3 border-b text-xs font-semibold uppercase tracking-wider grid grid-cols-12 gap-2" style={{ borderColor: 'var(--hairline)', color: 'var(--ink-2)' }}>
          <div className="col-span-3">Event Trigger</div>
          <div className="col-span-3">Channel</div>
          <div className="col-span-3">Recipient</div>
          <div className="col-span-2">Timestamp</div>
          <div className="col-span-1">Status</div>
        </div>

        <div className="divide-y">
          {events.map((evt, idx) => (
            <div key={idx} className="p-4 hover:bg-[var(--surface)] transition-colors grid grid-cols-12 gap-2 items-center text-sm" style={{ borderColor: 'var(--hairline)' }}>
              <div className="col-span-3 font-semibold font-mono text-xs" style={{ color: 'var(--ink)' }}>{evt.type}</div>
              <div className="col-span-3 flex items-center gap-1.5 text-xs" style={{ color: 'var(--ink-2)' }}>
                {getChannelIcon(evt.channel)} {evt.channel}
              </div>
              <div className="col-span-3 text-xs font-mono" style={{ color: 'var(--ink-2)' }}>{evt.recipient}</div>
              <div className="col-span-2 text-xs" style={{ color: 'var(--ink-3)' }}>{evt.time}</div>
              <div className="col-span-1">
                <span className="px-2 py-0.5 text-[10px] font-bold rounded flex items-center gap-1 w-fit" style={{ background: 'var(--tone-active-bg)', color: 'var(--tone-active)', border: '1px solid var(--tone-active-line)' }}>
                  <CheckCircle2 className="w-3 h-3" /> SENT
                </span>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
