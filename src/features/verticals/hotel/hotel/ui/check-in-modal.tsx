'use client';

/**
 * §10 check-in: pick the actual room, then hand the guest the key.
 *
 * The room list is the availability endpoint's answer for THIS stay's dates,
 * not every room in the building — so a room already promised to somebody else
 * is not offered. If two receptionists race for the last one anyway, the server
 * takes a row lock and the loser gets a 409 naming the reservation that holds
 * it, which is what this shows.
 */

import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { BedDouble } from 'lucide-react';
import { api, apiErrorMessage } from '@/lib/api';
import { fmtOrgMoneyExact } from '@/lib/org-locale';
import { EmptyState, Field, Modal, Skeleton } from './kit';
import type { AvailabilityResult, ReservationRow } from '../types';

export function CheckInModal({
  reservation, onClose, onDone,
}: { reservation: ReservationRow | null; onClose: () => void; onDone: () => void }) {
  const qc = useQueryClient();
  const [roomId, setRoomId] = useState('');

  const { data, isLoading } = useQuery<AvailabilityResult>({
    queryKey: ['hotel-availability', reservation?.id],
    queryFn: async () => (await api.get('/hotel/availability', {
      params: {
        propertyId: reservation!.propertyId,
        from: reservation!.checkInDate,
        to: reservation!.checkOutDate,
        categoryId: reservation!.category?.id,
        // Its own hold must not count against it.
        excludeReservationId: reservation!.id,
      },
    })).data,
    enabled: Boolean(reservation),
  });

  const checkIn = useMutation({
    mutationFn: async () => (await api.post(`/hotel/reservations/${reservation!.id}/check-in`, { roomId })).data,
    onSuccess: (r: any) => {
      toast.success(`Checked in to room ${data?.rooms.find((x) => x.id === roomId)?.roomNumber ?? ''}`);
      qc.invalidateQueries({ queryKey: ['hotel-reception'] });
      setRoomId('');
      onDone();
    },
    onError: (e) => toast.error(apiErrorMessage(e)),
  });

  const rooms = data?.rooms ?? [];

  return (
    <Modal
      open={Boolean(reservation)}
      onClose={onClose}
      width={560}
      title="Check in"
      subtitle={reservation ? `${reservation.guest.firstName} ${reservation.guest.lastName ?? ''} · ${reservation.category?.name ?? ''}`.trim() : undefined}
      footer={
        <>
          <button className="btn-secondary" onClick={onClose}>Cancel</button>
          <button
            className="btn-primary"
            disabled={!roomId || checkIn.isPending}
            onClick={() => checkIn.mutate()}
          >
            Check in
          </button>
        </>
      }
    >
      {isLoading ? <Skeleton rows={3} /> : rooms.length === 0 ? (
        <EmptyState
          icon={BedDouble}
          title={data?.excludesUncleanedRooms
            ? 'No clean room free for these dates'
            : 'No room free for these dates'}
          body={data?.excludesUncleanedRooms
            ? 'Every room of this type is either taken or waiting on housekeeping. Mark a room clean on the Rooms screen, or move the guest to another room type.'
            : 'Every room of this type is taken for the whole stay. Move the guest to another room type, or shorten the stay.'}
        />
      ) : (
        <Field
          label="Room"
          hint={`${data!.availableRooms} of ${data!.totalRooms} free for ${data!.nights} night(s)`
            + (data!.excludesUncleanedRooms ? ' · rooms awaiting housekeeping are not offered' : '')}
        >
          <select className="input" value={roomId} onChange={(e) => setRoomId(e.target.value)}>
            <option value="">Choose a room…</option>
            {rooms.map((r) => (
              <option key={r.id} value={r.id}>
                {r.roomNumber}{r.floor ? ` · floor ${r.floor}` : ''} — {r.category?.name} ({fmtOrgMoneyExact(r.category?.basePriceInr ?? 0)}/night)
              </option>
            ))}
          </select>
        </Field>
      )}
    </Modal>
  );
}
