'use client';

import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useRouter } from 'next/navigation';
import { api } from '@/lib/api';
import { T } from '@/features/verticals/education/institute-dashboard';
import { QueueResponse, RequestRow, RequestStatus, Priority, TYPE_LABEL, STATUS_LABEL } from '../academic-requests-client';

const card: React.CSSProperties = { background: T.surface, border: `1px solid ${T.border}`, borderRadius: T.radius };

const STATUS_TONE: Record<RequestStatus, { bg: string; fg: string }> = {
  SUBMITTED: { bg: T.brandSubtle, fg: T.brandText },
  UNDER_REVIEW: { bg: '#eef0f2', fg: T.ink2 },
  APPROVED: { bg: T.successBg, fg: T.success },
  REJECTED: { bg: T.dangerBg, fg: T.dangerText },
  SCHEDULED: { bg: '#fbe3da', fg: '#8c2f1b' },
  COMPLETED: { bg: T.successBg, fg: T.success },
};
const PRIORITY_TONE: Record<Priority, { bg: string; fg: string; label: string }> = {
  HIGH: { bg: '#fdecdf', fg: '#b45309', label: 'High' },
  NORMAL: { bg: '#eef0f2', fg: T.ink2, label: 'Normal' },
  LOW: { bg: '#eef0f2', fg: T.ink3, label: 'Low' },
};
const FILTERS: { key: string; label: string }[] = [
  { key: 'ALL', label: 'All' }, { key: 'SUBMITTED', label: 'Submitted' }, { key: 'UNDER_REVIEW', label: 'Under Review' },
  { key: 'APPROVED', label: 'Approved' }, { key: 'SCHEDULED', label: 'Scheduled' }, { key: 'REJECTED', label: 'Rejected' },
];

export function RequestQueueFeature() {
  const router = useRouter();
  const [status, setStatus] = useState('ALL');
  const { data, isLoading } = useQuery({
    queryKey: ['acad-requests', status],
    queryFn: async () => (await api.get<QueueResponse>('/academic-requests', { params: status === 'ALL' ? {} : { status } })).data,
  });
  const counts = data?.counts ?? {};

  const th: React.CSSProperties = { textAlign: 'left', fontSize: 10.5, letterSpacing: '.05em', fontWeight: 700, color: T.ink3, padding: '12px 16px', textTransform: 'uppercase' };
  const td: React.CSSProperties = { padding: '14px 16px', fontSize: 13, borderTop: `1px solid ${T.border}`, verticalAlign: 'top' };

  return (
    <div style={{ animation: 'fadeUp .4s ease', fontFamily: T.font, color: T.ink }}>
      <div style={{ marginBottom: 18 }}>
        <h1 style={{ fontSize: 26, fontWeight: 700, letterSpacing: '-.02em', margin: 0 }}>Academic request queue</h1>
        <p style={{ fontSize: 14, color: T.ink2, margin: '6px 0 0' }}>Faculty-reported academic issues awaiting an operational decision.</p>
      </div>

      <div style={{ display: 'flex', gap: 8, marginBottom: 16, flexWrap: 'wrap' }}>
        {FILTERS.map((f) => {
          const active = status === f.key;
          const n = counts[f.key] ?? 0;
          const tone = f.key !== 'ALL' ? STATUS_TONE[f.key as RequestStatus] : { bg: T.brand, fg: '#fff' };
          return (
            <button key={f.key} onClick={() => setStatus(f.key)} style={{
              all: 'unset', cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: 6, height: 32, padding: '0 14px', borderRadius: 999,
              fontSize: 12.5, fontWeight: 700,
              background: active ? (f.key === 'ALL' ? T.brand : tone.bg) : 'transparent',
              color: active ? (f.key === 'ALL' ? '#fff' : tone.fg) : T.ink2,
              border: `1px solid ${active ? 'transparent' : T.border}`,
            }}>{f.label} · {n}</button>
          );
        })}
      </div>

      <div style={{ ...card, overflow: 'hidden' }}>
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: 900 }}>
            <thead><tr>
              <th style={th}>Ticket</th><th style={th}>Batch</th><th style={th}>Subject</th><th style={th}>Type</th>
              <th style={th}>Hours</th><th style={th}>Priority</th><th style={th}>Status</th>
            </tr></thead>
            <tbody>
              {isLoading ? <tr><td style={td} colSpan={7}>Loading…</td></tr>
                : !data?.items.length ? <tr><td style={{ ...td, textAlign: 'center', color: T.ink3, padding: 40 }} colSpan={7}>No requests in this view.</td></tr>
                : data.items.map((r) => <Row key={r.id} r={r} td={td} onOpen={() => router.push(`/academic-requests/${r.id}`)} />)}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

function Row({ r, td, onOpen }: { r: RequestRow; td: React.CSSProperties; onOpen: () => void }) {
  const st = STATUS_TONE[r.status]; const pr = PRIORITY_TONE[r.priority];
  const dt = new Date(r.submittedAt).toLocaleString([], { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' });
  return (
    <tr onClick={onOpen} style={{ cursor: 'pointer' }} onMouseEnter={(e) => (e.currentTarget.style.background = T.bg)} onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}>
      <td style={td}><div style={{ fontWeight: 700, color: T.ink }}>{r.code}</div><div style={{ fontSize: 11.5, color: T.ink3, marginTop: 2 }}>{dt}</div></td>
      <td style={td}><div style={{ fontWeight: 600 }}>{r.batch ? r.batch.name : '—'}</div><div style={{ fontSize: 11.5, color: T.ink3 }}>{r.batch?.course ?? ''}</div></td>
      <td style={td}><div style={{ fontWeight: 600 }}>{r.subject?.name ?? '—'}</div><div style={{ fontSize: 11.5, color: T.ink3 }}>{r.subject?.code ?? ''}</div></td>
      <td style={td}><div style={{ fontWeight: 600 }}>{TYPE_LABEL[r.type]}</div><div style={{ fontSize: 11.5, color: T.ink3 }}>{r.faculty ?? ''}</div></td>
      <td style={td}><div style={{ fontWeight: 600 }}>{r.hoursRequested != null ? `+${r.hoursRequested} h` : '—'}</div><div style={{ fontSize: 11.5, color: T.ink3 }}>{r.completionPct != null ? `${r.completionPct}% complete` : ''}</div></td>
      <td style={td}><span style={{ fontSize: 11, fontWeight: 700, padding: '3px 10px', borderRadius: 999, background: pr.bg, color: pr.fg }}>{pr.label}</span></td>
      <td style={td}><span style={{ fontSize: 10.5, fontWeight: 800, letterSpacing: '.03em', padding: '4px 10px', borderRadius: 999, background: st.bg, color: st.fg }}>{STATUS_LABEL[r.status].toUpperCase()}</span></td>
    </tr>
  );
}
