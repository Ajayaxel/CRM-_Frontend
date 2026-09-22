'use client';

import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Shield, Eye, Calendar, User, Search, RefreshCw } from 'lucide-react';
import { api } from '@/lib/api';

interface AuditLog {
  id: string;
  action: string;
  entityType: string;
  entityId: string;
  userId: string | null;
  reason: string | null;
  ipAddress: string | null;
  createdAt: string;
}

interface AuditResponse {
  items: AuditLog[];
  total: number;
}

export function AuditLogViewer() {
  const [actionFilter, setActionFilter] = useState('');
  const [entityFilter, setEntityFilter] = useState('');

  const { data, isLoading, refetch } = useQuery<AuditResponse>({
    queryKey: ['audit-logs', actionFilter, entityFilter],
    queryFn: async () => (await api.get('/audit-logs', {
      params: {
        action: actionFilter || undefined,
        entityType: entityFilter || undefined,
        take: 50,
      }
    })).data,
  });

  const logs = data?.items || [];

  return (
    <div style={{ animation: 'fadeUp .4s ease', padding: 24, maxWidth: 1200, margin: '0 auto' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
        <div>
          <h1 style={{ fontSize: 26, fontWeight: 700, letterSpacing: '-.02em', margin: 0 }}>System Audit Trail</h1>
          <p style={{ fontSize: 14, color: 'var(--ink-2)', margin: '6px 0 0' }}>Security compliances compliance logging. Logs logins, check-ins, check-outs, and folio updates.</p>
        </div>
        <button
          onClick={() => refetch()}
          style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '10px 16px', borderRadius: 8, background: 'var(--surface)', border: '1px solid var(--line-soft)', fontSize: 13, fontWeight: 600, cursor: 'pointer' }}
        >
          <RefreshCw size={14} className={isLoading ? 'spin' : ''} /> Refresh Trail
        </button>
      </div>

      {/* Filter panel */}
      <div style={{ display: 'flex', gap: 12, marginBottom: 20 }}>
        <div style={{ flex: 1, position: 'relative' }}>
          <Search size={16} style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', color: 'var(--ink-3)' }} />
          <input
            type="text"
            placeholder="Filter by Action (e.g. CHECK_IN, CHECK_OUT)..."
            value={actionFilter}
            onChange={e => setActionFilter(e.target.value)}
            style={{ width: '100%', padding: '10px 10px 10px 36px', borderRadius: 8, border: '1px solid var(--line-soft)', background: 'var(--surface)', fontSize: 13 }}
          />
        </div>
        <div style={{ flex: 1, position: 'relative' }}>
          <Search size={16} style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', color: 'var(--ink-3)' }} />
          <input
            type="text"
            placeholder="Filter by Entity Type (e.g. HotelReservation)..."
            value={entityFilter}
            onChange={e => setEntityFilter(e.target.value)}
            style={{ width: '100%', padding: '10px 10px 10px 36px', borderRadius: 8, border: '1px solid var(--line-soft)', background: 'var(--surface)', fontSize: 13 }}
          />
        </div>
      </div>

      {/* Audit Log Table */}
      <div style={{ background: 'var(--surface)', border: '1px solid var(--line-soft)', borderRadius: 12, overflow: 'hidden' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13, textAlign: 'left' }}>
          <thead>
            <tr style={{ background: 'var(--bg)', borderBottom: '1px solid var(--line-soft)', color: 'var(--ink-2)', fontWeight: 600 }}>
              <th style={{ padding: '14px 20px' }}>Action</th>
              <th style={{ padding: '14px 20px' }}>Entity Type</th>
              <th style={{ padding: '14px 20px' }}>Entity ID</th>
              <th style={{ padding: '14px 20px' }}>User ID</th>
              <th style={{ padding: '14px 20px' }}>IP Address</th>
              <th style={{ padding: '14px 20px' }}>Timestamp</th>
            </tr>
          </thead>
          <tbody>
            {logs.length === 0 ? (
              <tr>
                <td colSpan={6} style={{ textAlign: 'center', padding: 40, color: 'var(--ink-3)' }}>
                  <Shield size={36} style={{ opacity: .3, marginBottom: 10 }} />
                  <p>No audit trail logs match the filters.</p>
                </td>
              </tr>
            ) : (
              logs.map(log => (
                <tr key={log.id} style={{ borderBottom: '1px solid var(--line-soft)', transition: 'background .15s' }}>
                  <td style={{ padding: '14px 20px', fontWeight: 600, color: 'var(--brand)' }}>
                    {log.action}
                  </td>
                  <td style={{ padding: '14px 20px', color: 'var(--ink-2)' }}>{log.entityType}</td>
                  <td style={{ padding: '14px 20px', fontFamily: 'monospace', color: 'var(--ink-3)' }}>{log.entityId}</td>
                  <td style={{ padding: '14px 20px', color: 'var(--ink-2)' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                      <User size={13} style={{ opacity: .5 }} /> {log.userId || 'System Auto'}
                    </div>
                  </td>
                  <td style={{ padding: '14px 20px', color: 'var(--ink-3)' }}>{log.ipAddress || 'Internal'}</td>
                  <td style={{ padding: '14px 20px', color: 'var(--ink-3)' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                      <Calendar size={13} style={{ opacity: .5 }} /> {new Date(log.createdAt).toLocaleString()}
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
