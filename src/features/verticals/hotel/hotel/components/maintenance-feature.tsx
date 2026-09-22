'use client';

/**
 * Maintenance & Out-of-Order Room Management
 *
 * Tracks room repair tickets, HVAC/facility maintenance, and out-of-order inventory status.
 */

import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import {
  AlertCircle,
  CheckCircle2,
  Clock,
  Plus,
  RefreshCw,
  Sparkles,
  TriangleAlert,
  Wrench,
} from 'lucide-react';
import { api, apiErrorMessage } from '@/lib/api';
import { Badge, EmptyState, Field, Modal, Skeleton } from '../ui/kit';
import { HospitalityPage, HospitalitySection } from '../ui/page-shell';
import { ROOM_LABEL, ROOM_TONE } from '../ui/tone';
import { useHotelProperty } from '../hooks/use-hotel-property';
import type { RoomRow } from '../types';

interface MaintenanceTicket {
  id: string;
  roomNumber?: string;
  title: string;
  description: string;
  priority: 'URGENT' | 'HIGH' | 'MEDIUM' | 'LOW';
  status: 'OPEN' | 'IN_PROGRESS' | 'RESOLVED';
  reportedAt: string;
  assignedTo?: string;
}

const MOCK_TICKETS: MaintenanceTicket[] = [
  {
    id: 'maint-1',
    roomNumber: '104',
    title: 'AC Leaking Water',
    description: 'Split AC condensate tray overflowing, needs technician.',
    priority: 'URGENT',
    status: 'IN_PROGRESS',
    reportedAt: new Date(Date.now() - 3600000 * 2).toISOString(),
    assignedTo: 'Rajesh (HVAC)',
  },
  {
    id: 'maint-2',
    roomNumber: '204',
    title: 'Bathroom Door Latch Sticking',
    description: 'Hardware adjustment required for smooth lock.',
    priority: 'MEDIUM',
    status: 'OPEN',
    reportedAt: new Date(Date.now() - 3600000 * 5).toISOString(),
  },
];

export function MaintenanceFeature() {
  const qc = useQueryClient();
  const { propertyId } = useHotelProperty();
  const [tickets, setTickets] = useState<MaintenanceTicket[]>(MOCK_TICKETS);
  const [newTicketModal, setNewTicketModal] = useState(false);
  const [ticketTitle, setTicketTitle] = useState('');
  const [ticketRoom, setTicketRoom] = useState('');
  const [ticketDesc, setTicketDesc] = useState('');
  const [ticketPriority, setTicketPriority] = useState<'URGENT' | 'HIGH' | 'MEDIUM' | 'LOW'>('HIGH');

  const { data: rooms = [], isLoading } = useQuery<RoomRow[]>({
    queryKey: ['hotel-rooms-maintenance', propertyId],
    queryFn: async () => (await api.get('/hotel/rooms', { params: { propertyId } })).data,
    enabled: Boolean(propertyId),
  });

  const setStatus = useMutation({
    mutationFn: async ({ id, status }: { id: string; status: string }) =>
      (await api.post(`/hotel/rooms/${id}/status`, { status })).data,
    onSuccess: () => {
      toast.success('Room status updated');
      qc.invalidateQueries({ queryKey: ['hotel-rooms'] });
      qc.invalidateQueries({ queryKey: ['hotel-rooms-maintenance'] });
    },
    onError: (e) => toast.error(apiErrorMessage(e)),
  });

  const outOfOrderRooms = rooms.filter(
    (r) => r.housekeepingStatus === 'OUT_OF_ORDER' || r.derivedStatus === 'OUT_OF_ORDER'
  );

  const handleCreateTicket = () => {
    const t: MaintenanceTicket = {
      id: `maint-${Date.now()}`,
      roomNumber: ticketRoom || undefined,
      title: ticketTitle,
      description: ticketDesc,
      priority: ticketPriority,
      status: 'OPEN',
      reportedAt: new Date().toISOString(),
    };
    setTickets([t, ...tickets]);
    toast.success('Maintenance ticket logged');
    setTicketTitle('');
    setTicketRoom('');
    setTicketDesc('');
    setNewTicketModal(false);
  };

  const handleResolveTicket = (id: string) => {
    setTickets(tickets.map((t) => (t.id === id ? { ...t, status: 'RESOLVED' } : t)));
    toast.success('Ticket marked resolved');
  };

  return (
    <HospitalityPage
      title="Maintenance"
      subtitle="Corrective and preventive facility maintenance and out-of-order room management"
      actions={
        <button className="btn-primary" onClick={() => setNewTicketModal(true)}>
          <Plus size={15} /> New Maintenance Ticket
        </button>
      }
    >
      {/* KPI Cards */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))',
          gap: 12,
          marginBottom: 16,
        }}
      >
        <div className="ds-card" style={{ padding: '12px 14px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span className="ds-caption-upper" style={{ fontWeight: 600 }}>Active Tickets</span>
            <Wrench size={16} color="var(--primary)" />
          </div>
          <div style={{ fontSize: 24, fontWeight: 700, margin: '4px 0 2px' }}>
            {tickets.filter((t) => t.status !== 'RESOLVED').length}
          </div>
          <div className="ds-caption">Repair tasks open</div>
        </div>

        <div className="ds-card" style={{ padding: '12px 14px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span className="ds-caption-upper" style={{ fontWeight: 600 }}>Out of Order Rooms</span>
            <AlertCircle size={16} color="var(--tone-expired)" />
          </div>
          <div style={{ fontSize: 24, fontWeight: 700, margin: '4px 0 2px', color: 'var(--tone-expired)' }}>
            {outOfOrderRooms.length}
          </div>
          <div className="ds-caption">Blocked from inventory</div>
        </div>
      </div>

      {/* Out of Order Rooms Section */}
      {outOfOrderRooms.length > 0 && (
        <HospitalitySection title="Out of Order Rooms">
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(240px, 1fr))', gap: 12 }}>
            {outOfOrderRooms.map((r) => (
              <div
                key={r.id}
                className="ds-card"
                style={{
                  padding: 14,
                  border: '1.5px solid var(--tone-expired-line)',
                  background: 'var(--tone-expired-bg)',
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                }}
              >
                <div>
                  <strong className="ds-num" style={{ fontSize: 18 }}>
                    Room {r.roomNumber}
                  </strong>
                  <div className="ds-caption" style={{ color: 'var(--tone-expired)' }}>
                    {r.category?.name ?? 'Room'} · Maintenance Lock
                  </div>
                </div>
                <button
                  className="btn-secondary btn-sm"
                  style={{ background: 'var(--surface)', fontSize: 12 }}
                  disabled={setStatus.isPending}
                  onClick={() => setStatus.mutate({ id: r.id, status: 'CLEAN' })}
                >
                  <CheckCircle2 size={13} /> Set Ready
                </button>
              </div>
            ))}
          </div>
        </HospitalitySection>
      )}

      {/* Active Maintenance Tickets */}
      <HospitalitySection title="Maintenance Tickets">
        <div className="ds-card" style={{ overflow: 'hidden' }}>
          <table className="ds-table" style={{ width: '100%' }}>
            <thead>
              <tr>
                <th>Ticket</th>
                <th>Target</th>
                <th>Priority</th>
                <th>Status</th>
                <th>Assigned</th>
                <th style={{ textAlign: 'right' }}>Action</th>
              </tr>
            </thead>
            <tbody>
              {tickets.map((t) => (
                <tr key={t.id}>
                  <td>
                    <div style={{ fontWeight: 600 }}>{t.title}</div>
                    <div className="ds-caption">{t.description}</div>
                  </td>
                  <td>
                    {t.roomNumber ? (
                      <strong className="ds-num">Room {t.roomNumber}</strong>
                    ) : (
                      <span className="ds-caption">General Facility</span>
                    )}
                  </td>
                  <td>
                    <Badge
                      tone={
                        t.priority === 'URGENT'
                          ? 'expired'
                          : t.priority === 'HIGH'
                          ? 'renewal'
                          : 'neutral'
                      }
                    >
                      {t.priority}
                    </Badge>
                  </td>
                  <td>
                    <Badge tone={t.status === 'RESOLVED' ? 'active' : 'info'}>
                      {t.status.replace('_', ' ').toLowerCase()}
                    </Badge>
                  </td>
                  <td>{t.assignedTo ?? <span className="ds-caption">Unassigned</span>}</td>
                  <td style={{ textAlign: 'right' }}>
                    {t.status !== 'RESOLVED' && (
                      <button
                        className="btn-secondary btn-sm"
                        onClick={() => handleResolveTicket(t.id)}
                      >
                        <CheckCircle2 size={13} /> Mark Resolved
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </HospitalitySection>

      {/* New Ticket Modal */}
      <Modal
        open={newTicketModal}
        onClose={() => setNewTicketModal(false)}
        width={520}
        title="Log Maintenance Ticket"
        footer={
          <>
            <button className="btn-secondary" onClick={() => setNewTicketModal(false)}>
              Cancel
            </button>
            <button
              className="btn-primary"
              disabled={!ticketTitle.trim()}
              onClick={handleCreateTicket}
            >
              Create Ticket
            </button>
          </>
        }
      >
        <div className="ds-formflow" style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          <Field label="Issue Title" required>
            <input
              className="input"
              value={ticketTitle}
              onChange={(e) => setTicketTitle(e.target.value)}
              placeholder="e.g. Geyser Not Heating"
            />
          </Field>
          <div className="ds-field-pair" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
            <Field label="Room (Optional)">
              <select className="input" value={ticketRoom} onChange={(e) => setTicketRoom(e.target.value)}>
                <option value="">Facility / Common Area</option>
                {rooms.map((r) => (
                  <option key={r.id} value={r.roomNumber}>
                    Room {r.roomNumber}
                  </option>
                ))}
              </select>
            </Field>
            <Field label="Priority">
              <select
                className="input"
                value={ticketPriority}
                onChange={(e) => setTicketPriority(e.target.value as any)}
              >
                <option value="LOW">Low</option>
                <option value="MEDIUM">Medium</option>
                <option value="HIGH">High</option>
                <option value="URGENT">Urgent</option>
              </select>
            </Field>
          </div>
          <Field label="Description">
            <textarea
              className="input"
              rows={3}
              value={ticketDesc}
              onChange={(e) => setTicketDesc(e.target.value)}
              placeholder="Describe the maintenance issue or parts required…"
            />
          </Field>
        </div>
      </Modal>
    </HospitalityPage>
  );
}
