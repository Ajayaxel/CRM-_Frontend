'use client';

import React from 'react';
import { FileText, GitCommit, ShieldCheck, Download, Clock, CheckCircle2 } from 'lucide-react';

export function SolarDocumentVersionView() {
  const versions = [
    { doc: 'SLD Electrical Diagram', ver: 'V3', date: 'Yesterday', by: 'Eng. Omar Farooq', status: 'APPROVED', checksum: 'sha256-a9b8c7d6' },
    { doc: 'System Design Proposal', ver: 'V2', date: '3 days ago', by: 'Sales Desk', status: 'SIGNED', checksum: 'sha256-e5f4g3h2' },
    { doc: 'Site Survey Assessment', ver: 'V1', date: '1 week ago', by: 'Field Tech', status: 'COMPLETED', checksum: 'sha256-1a2b3c4d' },
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
            <span className="px-2.5 py-1 text-xs font-semibold rounded-full flex items-center gap-1" style={{ background: 'var(--tone-sales-bg)', color: 'var(--tone-sales)', border: '1px solid var(--tone-sales-line)' }}>
              <GitCommit className="w-3.5 h-3.5" /> VERSION CONTROL (#23)
            </span>
          </div>
          <h2 className="text-xl font-bold mt-1" style={{ color: 'var(--ink)' }}>Project Document Revision History & Checksum Control</h2>
        </div>
      </div>

      {/* Version Tree List */}
      <div className="space-y-3">
        {versions.map((v, idx) => (
          <div key={idx} className="p-4 rounded-xl border flex items-center justify-between" style={{ background: 'var(--surface-2)', borderColor: 'var(--hairline)' }}>
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-xl bg-[var(--tone-sales-bg)] border border-[var(--tone-sales-line)] flex items-center justify-center font-mono font-bold text-[var(--tone-sales)]">
                {v.ver}
              </div>
              <div>
                <h3 className="text-sm font-bold" style={{ color: 'var(--ink)' }}>{v.doc}</h3>
                <div className="text-xs mt-0.5" style={{ color: 'var(--ink-2)' }}>
                  Uploaded by <span style={{ color: 'var(--ink)' }}>{v.by}</span> ({v.date})
                </div>
              </div>
            </div>

            <div className="flex items-center gap-3">
              <span className="text-[10px] font-mono px-2 py-0.5 rounded border" style={{ color: 'var(--ink-2)', background: 'var(--surface)', borderColor: 'var(--hairline)' }}>
                {v.checksum}
              </span>
              <span className="px-2.5 py-1 text-[10px] font-bold rounded-full " style={{ background: 'var(--tone-active-bg)', color: 'var(--tone-active)', border: '1px solid var(--tone-active-line)' }}>
                {v.status}
              </span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
