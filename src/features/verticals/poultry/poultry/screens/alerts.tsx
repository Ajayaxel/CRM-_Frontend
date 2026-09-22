'use client';

import React, { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { BellOff } from 'lucide-react';
import { api, apiErrorMessage } from '@/lib/api';
import { useAuth } from '@/features/foundation/auth';
import { Badge, Card, EmptyState, Skeleton, humanStatus } from '../ui/kit';
import { PageHead, Pagination, StatusSelect, fmtDateTime, useListState } from '../ui/common';
import { toneForAlertSeverity } from '../ui/tone';

interface AlertRow {
  id: string; type: string; severity: string; title: string; message: string;
  date: string; status: string;
}

const ALERT_STATUSES = ['OPEN', 'ACKNOWLEDGED', 'RESOLVED'];
const ALERT_TYPES = [
  'FEED_LOW', 'FEED_EXHAUSTION', 'FEED_SHORTFALL', 'PICKUP_DUE', 'PICKUP_OVERDUE',
  'REST_COMPLETE', 'PLACEMENT_ELIGIBLE', 'MEDICINE_LOW', 'SUPPLIER_DUE', 'SUPPLIER_OVERDUE',
  'APPROVAL_PENDING', 'STALL_UNCLOSED', 'FINANCE_ANOMALY', 'BIRD_MISMATCH',
];

export function PoultryAlerts() {
  const qc = useQueryClient();
  const { hasPermission } = useAuth();
  const canManage = hasPermission('poultry.manage');
  const { state, set, params } = useListState();
  const [typeFilter, setTypeFilter] = useState('');

  const { data, isLoading } = useQuery({
    queryKey: ['py-alerts', params, typeFilter],
    queryFn: async () => (await api.get<{ data: AlertRow[]; meta: { page: number; limit: number; total: number; totalPages: number } }>(
      '/poultry/alerts',
      { params: { ...params, ...(typeFilter ? { type: typeFilter } : {}) } },
    )).data,
  });

  const invalidate = () => {
    qc.invalidateQueries({ queryKey: ['py-alerts'] });
    qc.invalidateQueries({ queryKey: ['py-dashboard'] });
  };

  const ack = useMutation({
    mutationFn: (id: string) => api.post(`/poultry/alerts/${id}/ack`),
    onSuccess: () => { toast.success('Alert acknowledged'); invalidate(); },
    onError: (e) => toast.error(apiErrorMessage(e)),
  });
  const resolve = useMutation({
    mutationFn: (id: string) => api.post(`/poultry/alerts/${id}/resolve`),
    onSuccess: () => { toast.success('Alert resolved'); invalidate(); },
    onError: (e) => toast.error(apiErrorMessage(e)),
  });
  const sweep = useMutation({
    mutationFn: async () => (await api.post<Record<string, number>>('/poultry/maintenance/sweep')).data,
    onSuccess: (counts) => { toast.success(`Sweep complete — ${JSON.stringify(counts)}`); invalidate(); },
    onError: (e) => toast.error(apiErrorMessage(e)),
  });

  const rows = data?.data ?? [];

  return (
    <div className="ds-page">
      <PageHead
        title="Alerts"
        subtitle="What the sweep found — feed running out, pickups due, payables ageing"
        actions={canManage && (
          <button className="btn-secondary" disabled={sweep.isPending} onClick={() => sweep.mutate()}>
            {sweep.isPending ? 'Sweeping…' : 'Run sweep now'}
          </button>
        )}
      />

      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 14 }}>
        <StatusSelect value={state.status} onChange={(v) => set({ status: v })} options={ALERT_STATUSES} />
        <StatusSelect value={typeFilter} onChange={setTypeFilter} options={ALERT_TYPES} label="All types" />
      </div>

      {isLoading ? (
        <Skeleton rows={4} height={84} />
      ) : rows.length === 0 ? (
        <Card><EmptyState icon={BellOff} title="No alerts" body="Nothing needs attention under these filters." compact /></Card>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {rows.map((a) => (
            <Card key={a.id}>
              <div style={{ display: 'flex', gap: 12, alignItems: 'flex-start', flexWrap: 'wrap' }}>
                <div style={{ minWidth: 0, flex: '1 1 280px' }}>
                  <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap', marginBottom: 4 }}>
                    <Badge tone={toneForAlertSeverity(a.severity)}>{humanStatus(a.severity)}</Badge>
                    <span style={{ fontWeight: 650 }}>{a.title}</span>
                    <Badge tone={a.status === 'RESOLVED' ? 'active' : a.status === 'ACKNOWLEDGED' ? 'info' : 'neutral'}>{humanStatus(a.status)}</Badge>
                  </div>
                  <div style={{ fontSize: 13 }}>{a.message}</div>
                  <div className="ds-caption" style={{ marginTop: 4 }}>{humanStatus(a.type)} · {fmtDateTime(a.date)}</div>
                </div>
                <div style={{ marginLeft: 'auto', display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                  {a.status === 'OPEN' && (
                    <button className="btn-secondary btn-sm" disabled={ack.isPending} onClick={() => ack.mutate(a.id)}>
                      {ack.isPending ? 'Saving…' : 'Acknowledge'}
                    </button>
                  )}
                  {canManage && a.status !== 'RESOLVED' && (
                    <button className="btn-primary btn-sm" disabled={resolve.isPending} onClick={() => resolve.mutate(a.id)}>
                      {resolve.isPending ? 'Saving…' : 'Resolve'}
                    </button>
                  )}
                </div>
              </div>
            </Card>
          ))}
        </div>
      )}
      <Pagination meta={data?.meta} onPage={(p) => set({ page: p })} />
    </div>
  );
}
