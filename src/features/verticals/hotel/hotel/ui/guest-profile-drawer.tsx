'use client';

/**
 * Guest Profile Slide-Over Drawer
 *
 * Displays full customer relationship profile for hotel guests:
 * - Contact & Identification details
 * - Current Stay card (if checked in) with live folio balance and quick folio link
 * - Chronological Stay History (room, dates, amount paid, status)
 * - Quick "Book Next Stay" action
 */

import { useState } from 'react';
import {
  BedDouble,
  Calendar,
  CheckCircle2,
  Clock,
  ExternalLink,
  History,
  KeyRound,
  Mail,
  Phone,
  Plus,
  Receipt,
  User,
  UserCheck,
} from 'lucide-react';
import { fmtOrgMoneyExact } from '@/lib/org-locale';
import { Badge, Drawer, EmptyState, fmtDate } from './kit';
import { RESERVATION_TONE } from './tone';
import type { ReservationRow } from '../types';

export interface GuestProfileData {
  id: string;
  firstName: string;
  lastName: string | null;
  email: string | null;
  phone: string | null;
  stayCount: number;
  inHouse: boolean;
  lastStay: {
    checkInDate: string;
    checkOutDate: string;
    status: string;
    room: { roomNumber: string } | null;
    category: { name: string } | null;
  } | null;
  reservations?: {
    id: string;
    status: string;
    checkInDate: string;
    checkOutDate: string;
    totalPriceInr?: number;
    room?: { roomNumber: string } | null;
    category?: { name: string } | null;
  }[];
}

interface GuestProfileDrawerProps {
  guest: GuestProfileData | null;
  onClose: () => void;
  onBookStay?: (guest: GuestProfileData) => void;
  onOpenFolio?: (reservationId: string) => void;
}

export function GuestProfileDrawer({
  guest,
  onClose,
  onBookStay,
  onOpenFolio,
}: GuestProfileDrawerProps) {
  if (!guest) return null;

  const fullName = `${guest.firstName} ${guest.lastName ?? ''}`.trim();
  const currentStay = guest.reservations?.find((r) => r.status === 'CHECKED_IN');
  const pastStays = guest.reservations?.filter((r) => r.status !== 'CHECKED_IN') ?? [];

  return (
    <Drawer
      open={Boolean(guest)}
      onClose={onClose}
      title={fullName}
      subtitle={`Guest Profile · ${guest.stayCount} lifetime stay${guest.stayCount === 1 ? '' : 's'}`}
      width={580}
    >
      <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
        {/* Guest Header Card */}
        <div
          className="ds-card"
          style={{
            padding: 16,
            background: 'var(--surface-sunken, rgba(0,0,0,0.02))',
            borderRadius: 'var(--radius-md, 8px)',
            border: '1px solid var(--border)',
          }}
        >
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <h3 style={{ fontSize: 18, fontWeight: 700, margin: 0 }}>{fullName}</h3>
                {guest.inHouse ? (
                  <Badge tone="active">In House</Badge>
                ) : guest.stayCount > 1 ? (
                  <Badge tone="info">Returning Guest</Badge>
                ) : (
                  <Badge tone="neutral">Guest</Badge>
                )}
              </div>
              <div
                style={{
                  display: 'flex',
                  flexWrap: 'wrap',
                  gap: 12,
                  marginTop: 8,
                  fontSize: 13,
                  color: 'var(--ink-secondary)',
                }}
              >
                {guest.phone && (
                  <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                    <Phone size={13} /> {guest.phone}
                  </div>
                )}
                {guest.email && (
                  <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                    <Mail size={13} /> {guest.email}
                  </div>
                )}
              </div>
            </div>

            {onBookStay && (
              <button
                className="btn-primary btn-sm"
                onClick={() => onBookStay(guest)}
              >
                <Plus size={13} /> Book Stay
              </button>
            )}
          </div>
        </div>

        {/* Current Active Stay Card (if in-house) */}
        {currentStay ? (
          <div
            className="ds-card"
            style={{
              padding: 14,
              border: '1.5px solid var(--tone-info-line)',
              background: 'var(--tone-info-bg)',
              borderRadius: 'var(--radius-md, 8px)',
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
              <span
                style={{
                  fontSize: 11.5,
                  fontWeight: 700,
                  textTransform: 'uppercase',
                  letterSpacing: '0.05em',
                  color: 'var(--tone-info)',
                  display: 'flex',
                  alignItems: 'center',
                  gap: 6,
                }}
              >
                <KeyRound size={13} /> Current Stay (Checked In)
              </span>
              {currentStay.room && (
                <strong style={{ fontSize: 14, color: 'var(--tone-sales)' }}>
                  Room {currentStay.room.roomNumber}
                </strong>
              )}
            </div>

            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, marginTop: 4 }}>
              <span>
                {fmtDate(currentStay.checkInDate)} → {fmtDate(currentStay.checkOutDate)} ({currentStay.category?.name ?? 'Standard'})
              </span>
            </div>

            {onOpenFolio && (
              <div style={{ marginTop: 10 }}>
                <button
                  className="btn-secondary btn-sm"
                  style={{ background: 'var(--surface)', fontSize: 12 }}
                  onClick={() => onOpenFolio(currentStay.id)}
                >
                  <Receipt size={13} /> Open Guest Folio
                </button>
              </div>
            )}
          </div>
        ) : null}

        {/* Stay History */}
        <div>
          <h4
            style={{
              fontSize: 12,
              fontWeight: 700,
              textTransform: 'uppercase',
              letterSpacing: '0.06em',
              color: 'var(--ink-secondary)',
              margin: '0 0 10px',
              display: 'flex',
              alignItems: 'center',
              gap: 6,
            }}
          >
            <History size={14} /> Stay History ({guest.reservations?.length ?? guest.stayCount})
          </h4>

          {!guest.reservations || guest.reservations.length === 0 ? (
            <div className="ds-card" style={{ padding: 14, textAlign: 'center', color: 'var(--ink-muted)' }}>
              No recorded prior stays.
            </div>
          ) : (
            <div className="ds-card" style={{ overflow: 'hidden' }}>
              <table className="ds-table" style={{ width: '100%' }}>
                <thead>
                  <tr>
                    <th>Stay Dates</th>
                    <th>Room</th>
                    <th>Status</th>
                    {onOpenFolio && <th style={{ textAlign: 'right' }}>Folio</th>}
                  </tr>
                </thead>
                <tbody>
                  {guest.reservations.map((res) => (
                    <tr key={res.id}>
                      <td>
                        <div style={{ fontWeight: 500, fontSize: 12.5 }}>
                          {fmtDate(res.checkInDate)} → {fmtDate(res.checkOutDate)}
                        </div>
                        <div className="ds-caption">{res.category?.name ?? 'Room'}</div>
                      </td>
                      <td>
                        {res.room?.roomNumber ? (
                          <strong className="ds-num" style={{ fontSize: 13 }}>
                            Room {res.room.roomNumber}
                          </strong>
                        ) : (
                          <span className="ds-caption">—</span>
                        )}
                      </td>
                      <td>
                        <Badge tone={RESERVATION_TONE[res.status] ?? 'neutral'}>
                          {res.status.replace('_', ' ').toLowerCase()}
                        </Badge>
                      </td>
                      {onOpenFolio && (
                        <td style={{ textAlign: 'right' }}>
                          <button
                            className="btn-ghost btn-sm"
                            style={{ fontSize: 11.5 }}
                            onClick={() => onOpenFolio(res.id)}
                            title="View stay folio"
                          >
                            <Receipt size={12} />
                          </button>
                        </td>
                      )}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </Drawer>
  );
}
