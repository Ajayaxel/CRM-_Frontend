'use client';

import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { Activity, FileText, Pencil, Plus, Trash2, LogIn } from 'lucide-react';
import { api } from '@/lib/api';

const cardStyle: React.CSSProperties = {
  background: 'var(--surface)',
  border: '1px solid var(--line-soft)',
  borderRadius: 20,
  boxShadow: 'var(--shadow-1)',
};

interface AuditRow {
  id: string;
  action: string;
  entityType: string;
  entityId: string;
  createdAt: string;
}

/** "LEAD" → "Lead", "INS_POLICY" → "Ins policy" — entity keys are a storage detail. */
const human = (s: string) =>
  (s || '').replace(/[_-]+/g, ' ').toLowerCase().replace(/^./, (c) => c.toUpperCase());

const KIND: Record<string, { icon: any; tint: string; color: string }> = {
  CREATE: { icon: Plus, tint: 'var(--success-bg)', color: 'var(--success)' },
  UPDATE: { icon: Pencil, tint: 'var(--gold-bg)', color: 'var(--gold-ink)' },
  DELETE: { icon: Trash2, tint: 'var(--danger-bg)', color: 'var(--danger)' },
  LOGIN: { icon: LogIn, tint: 'rgba(19,35,118,.09)', color: 'var(--navy)' },
};

function relative(at: string) {
  const mins = Math.round((Date.now() - new Date(at).getTime()) / 60000);
  if (mins < 1) return 'Just now';
  if (mins < 60) return `${mins} minute${mins === 1 ? '' : 's'} ago`;
  const hrs = Math.round(mins / 60);
  if (hrs < 24) return `${hrs} hour${hrs === 1 ? '' : 's'} ago`;
  const days = Math.round(hrs / 24);
  if (days < 7) return `${days} day${days === 1 ? '' : 's'} ago`;
  return new Date(at).toLocaleDateString(undefined, { day: '2-digit', month: 'short' });
}

/**
 * Real activity, read from the audit log.
 *
 * This card used to render three INVENTED events — named people who do not
 * exist, converting to admissions that never happened — hardcoded in the
 * component and shown beside live KPIs reading zero. On a demo that reads as
 * data, and someone could act on it. It now shows what actually happened, or
 * says plainly that nothing has.
 */
export function RecentActivity() {
  const { data, isLoading, isError } = useQuery({
    queryKey: ['dash-audit'],
    queryFn: async () => (await api.get<{ items: AuditRow[] }>('/audit-logs', { params: { take: 6 } })).data,
    retry: false,
  });

  const items = data?.items ?? [];

  return (
    <div style={{ ...cardStyle, padding: 20 }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
        <div>
          <div style={{ fontWeight: 700, fontSize: 15 }}>Recent Activity</div>
          <div style={{ fontSize: 12, color: 'var(--ink-3)' }}>Changes across your workspace</div>
        </div>
      </div>

      {isLoading ? (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {[0, 1, 2].map((i) => (
            <div key={i} style={{ height: 42, borderRadius: 10, background: 'var(--surface-2)' }} />
          ))}
        </div>
      ) : items.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '20px 8px' }}>
          <span style={{
            width: 38, height: 38, borderRadius: 11, display: 'inline-flex', alignItems: 'center',
            justifyContent: 'center', background: 'var(--surface-2)', color: 'var(--ink-3)', marginBottom: 10,
          }}><Activity size={17} /></span>
          <div style={{ fontWeight: 650, fontSize: 14 }}>
            {isError ? 'Activity is unavailable' : 'Nothing has happened yet'}
          </div>
          <div style={{ fontSize: 12.5, color: 'var(--ink-3)', marginTop: 4, maxWidth: '34ch', marginInline: 'auto', lineHeight: 1.5 }}>
            {isError
              ? 'We could not load the activity log just now.'
              : 'As your team creates and updates records, those changes appear here.'}
          </div>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          {items.map((it) => {
            const meta = KIND[(it.action || '').toUpperCase()] ?? { icon: FileText, tint: 'var(--surface-2)', color: 'var(--ink-3)' };
            const Icon = meta.icon;
            return (
              <div key={it.id} style={{ display: 'flex', gap: 12 }}>
                <div style={{ width: 34, height: 34, borderRadius: 10, background: meta.tint, color: meta.color, display: 'flex', alignItems: 'center', justifyContent: 'center', flex: '0 0 34px' }}>
                  <Icon size={16} strokeWidth={2} />
                </div>
                <div style={{ minWidth: 0 }}>
                  <div style={{ fontSize: 13, fontWeight: 600, lineHeight: 1.3 }}>
                    {human(it.action)} · {human(it.entityType)}
                  </div>
                  <div style={{ fontSize: 11.5, color: 'var(--ink-3)', marginTop: 3 }}>{relative(it.createdAt)}</div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
