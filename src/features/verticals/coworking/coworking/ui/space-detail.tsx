'use client';

/**
 * The space detail view the floor plan opens.
 *
 * Everything on it is a row: the gallery, the walkthrough video, the amenities,
 * the price tiers, the booking rules and the live availability all come from
 * GET /coworking/spaces/:id. Clicking a different hotspot changes `spaceId` and
 * every panel re-reads — there is no per-space markup anywhere in this file,
 * which is what makes a space added tonight look right tomorrow morning.
 */

import { useEffect, useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import {
  CalendarClock, ChevronLeft, ChevronRight, Clock, Expand, Play, Users, X,
} from 'lucide-react';
import { api } from '@/lib/api';
import { Badge, EmptyState, Modal, Skeleton, humanStatus } from './kit';
import { spaceTypeLabel, toneForSpaceStatus } from './tone';
import { Detail, DetailGrid, fmtDateTime, money } from './common';

export interface SpaceMedia {
  id: string; kind: string; url: string; posterUrl?: string | null; caption?: string | null; isCover: boolean;
}

export interface SpaceDetail {
  id: string; name: string; code: string; type: string; customType?: string | null;
  zone?: string | null; capacity: number; units: number; description?: string | null;
  status: string; liveStatus?: string;
  hourlyInr?: number | null; halfDayInr?: number | null; dailyInr?: number | null;
  weeklyInr?: number | null; monthlyInr?: number | null; depositInr: number; setupFeeInr: number; taxPct: number;
  amenities: string[];
  media: SpaceMedia[]; gallery: SpaceMedia[]; videos: SpaceMedia[];
  floor?: { id: string; name: string; level: number } | null;
  building?: { id: string; name: string; city?: string | null } | null;
  rules: Record<string, unknown>;
  openingHours: Record<string, [string, string][]>;
  currentBooking?: { id: string; reference: string; contactName: string; endAt: string } | null;
  upcoming: { id: string; reference: string; contactName: string; startAt: string; endAt: string; status: string }[];
  blocks: { id: string; kind: string; startAt: string; endAt: string; reason?: string | null }[];
}

const DAY_NAMES = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

/** A gallery that can go full-screen, because a photograph of a room is the point. */
function Gallery({ media }: { media: SpaceMedia[] }) {
  const [index, setIndex] = useState(0);
  const [full, setFull] = useState(false);

  useEffect(() => { setIndex(0); }, [media]);

  useEffect(() => {
    if (!full) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setFull(false);
      if (e.key === 'ArrowRight') setIndex((i) => (i + 1) % media.length);
      if (e.key === 'ArrowLeft') setIndex((i) => (i - 1 + media.length) % media.length);
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [full, media.length]);

  if (!media.length) {
    return (
      <div className="ds-inset" style={{
        height: 220, borderRadius: 'var(--r-card)', display: 'flex', alignItems: 'center',
        justifyContent: 'center', background: 'var(--surface-2)', color: 'var(--ink-3)', fontSize: 13,
      }}>No photographs yet</div>
    );
  }

  const current = media[Math.min(index, media.length - 1)];
  return (
    <>
      <div style={{ position: 'relative', borderRadius: 'var(--r-card)', overflow: 'hidden', background: 'var(--surface-2)' }}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={current.url}
          alt={current.caption ?? 'Space photograph'}
          style={{ width: '100%', height: 260, objectFit: 'cover', display: 'block' }}
        />
        <button
          type="button" className="btn-ghost btn-sm" aria-label="View full screen"
          onClick={() => setFull(true)}
          style={{ position: 'absolute', top: 10, right: 10, background: 'var(--surface)', width: 30, padding: 0 }}
        ><Expand size={14} /></button>
        {media.length > 1 && (
          <>
            <button
              type="button" aria-label="Previous photograph" className="btn-ghost btn-sm"
              onClick={() => setIndex((i) => (i - 1 + media.length) % media.length)}
              style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', background: 'var(--surface)', width: 30, padding: 0 }}
            ><ChevronLeft size={15} /></button>
            <button
              type="button" aria-label="Next photograph" className="btn-ghost btn-sm"
              onClick={() => setIndex((i) => (i + 1) % media.length)}
              style={{ position: 'absolute', right: 10, top: '50%', transform: 'translateY(-50%)', background: 'var(--surface)', width: 30, padding: 0 }}
            ><ChevronRight size={15} /></button>
          </>
        )}
        {current.caption && (
          <div style={{
            position: 'absolute', left: 0, right: 0, bottom: 0, padding: '18px 12px 8px',
            background: 'linear-gradient(transparent, rgba(28,22,18,0.72))', color: '#fff', fontSize: 12,
          }}>{current.caption}</div>
        )}
      </div>

      {media.length > 1 && (
        <div className="ds-scroll-x" style={{ display: 'flex', gap: 6, marginTop: 8 }}>
          {media.map((m, i) => (
            <button
              key={m.id} type="button" onClick={() => setIndex(i)} aria-label={`Photograph ${i + 1}`}
              style={{
                flex: 'none', width: 64, height: 44, padding: 0, borderRadius: 6, overflow: 'hidden',
                border: i === index ? '2px solid var(--tone-info)' : '1px solid var(--hairline)',
                cursor: 'pointer', background: 'var(--surface-2)',
              }}
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={m.url} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }} />
            </button>
          ))}
        </div>
      )}

      {full && (
        <div
          role="dialog" aria-modal="true" aria-label="Photograph, full screen"
          onClick={() => setFull(false)}
          style={{
            position: 'fixed', inset: 0, zIndex: 120, background: 'rgba(18,14,11,0.94)',
            display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24,
          }}
        >
          <button
            type="button" aria-label="Close" className="btn-ghost btn-sm"
            style={{ position: 'absolute', top: 18, right: 18, width: 32, padding: 0, background: 'var(--surface)' }}
            onClick={() => setFull(false)}
          ><X size={16} /></button>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={current.url} alt={current.caption ?? ''}
            onClick={(e) => e.stopPropagation()}
            style={{ maxWidth: '100%', maxHeight: '100%', objectFit: 'contain' }}
          />
        </div>
      )}
    </>
  );
}

function Walkthrough({ videos }: { videos: SpaceMedia[] }) {
  const [playing, setPlaying] = useState<string | null>(null);
  if (!videos.length) return null;
  return (
    <div style={{ display: 'grid', gap: 10 }}>
      {videos.map((v) => (
        <div key={v.id} style={{ borderRadius: 'var(--r-card)', overflow: 'hidden', border: '1px solid var(--hairline)' }}>
          {playing === v.id ? (
            <video src={v.url} poster={v.posterUrl ?? undefined} controls autoPlay style={{ width: '100%', display: 'block', background: 'var(--surface-2)' }} />
          ) : (
            <button
              type="button" onClick={() => setPlaying(v.id)}
              style={{
                position: 'relative', width: '100%', border: 0, padding: 0, cursor: 'pointer',
                background: 'var(--surface-2)', minHeight: 160, display: 'block',
              }}
            >
              {v.posterUrl && (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={v.posterUrl} alt="" style={{ width: '100%', height: 180, objectFit: 'cover', display: 'block' }} />
              )}
              <span style={{
                position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center',
                gap: 8, color: 'var(--ink)', fontSize: 13, fontWeight: 600,
              }}>
                <span style={{
                  width: 42, height: 42, borderRadius: '50%', background: 'var(--surface)',
                  display: 'inline-flex', alignItems: 'center', justifyContent: 'center', boxShadow: 'var(--e-float)',
                }}><Play size={18} /></span>
                {v.caption ?? (v.kind === 'WALKTHROUGH' ? 'Play the walkthrough' : 'Play video')}
              </span>
            </button>
          )}
        </div>
      ))}
    </div>
  );
}

function PriceTiers({ space }: { space: SpaceDetail }) {
  const tiers = [
    { label: 'Hourly', value: space.hourlyInr },
    { label: 'Half day', value: space.halfDayInr },
    { label: 'Full day', value: space.dailyInr },
    { label: 'Weekly', value: space.weeklyInr },
    { label: 'Monthly', value: space.monthlyInr },
  ].filter((t) => t.value != null);

  if (!tiers.length) {
    return <div className="ds-caption">No published rates — this space is sold through a membership plan.</div>;
  }
  return (
    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
      {tiers.map((t) => (
        <div key={t.label} className="ds-card" style={{ padding: '10px 14px', minWidth: 104 }}>
          <div className="ds-caption">{t.label}</div>
          <div style={{ fontSize: 16, fontWeight: 700, marginTop: 2 }}>{money(t.value)}</div>
        </div>
      ))}
      {space.depositInr > 0 && (
        <div className="ds-card" style={{ padding: '10px 14px', minWidth: 104 }}>
          <div className="ds-caption">Deposit</div>
          <div style={{ fontSize: 16, fontWeight: 700, marginTop: 2 }}>{money(space.depositInr)}</div>
        </div>
      )}
    </div>
  );
}

function Rules({ rules }: { rules: Record<string, unknown> }) {
  const n = (k: string) => (typeof rules[k] === 'number' ? (rules[k] as number) : null);
  const lines: string[] = [];
  if (n('minMinutes')) lines.push(`Minimum booking ${n('minMinutes')} minutes`);
  if (n('maxMinutes')) lines.push(`Maximum booking ${n('maxMinutes')} minutes`);
  if (n('incrementMinutes')) lines.push(`Booked in ${n('incrementMinutes')}-minute increments`);
  if (n('noticeHours')) lines.push(`${n('noticeHours')} hours' notice required`);
  if (n('maxAdvanceDays')) lines.push(`Opens ${n('maxAdvanceDays')} days ahead`);
  if (n('bufferMinutes')) lines.push(`${n('bufferMinutes')}-minute buffer between bookings`);
  if (n('setupMinutes')) lines.push(`${n('setupMinutes')} minutes set-up time`);
  if (n('cleanupMinutes')) lines.push(`${n('cleanupMinutes')} minutes clean-up time`);
  if (n('cancellationHours') != null) {
    lines.push(
      n('cancellationPenaltyPct')
        ? `Free cancellation up to ${n('cancellationHours')} hours before; ${n('cancellationPenaltyPct')}% after`
        : `Free cancellation up to ${n('cancellationHours')} hours before`,
    );
  }
  if (rules.requiresApproval) lines.push('Bookings need approval before they are confirmed');
  if (rules.membersOnly) lines.push('Members only');
  if (rules.allowRecurring === false) lines.push('No repeating bookings');

  if (!lines.length) return <div className="ds-caption">No special rules — book any open slot.</div>;
  return (
    <ul style={{ margin: 0, paddingLeft: 18, display: 'grid', gap: 4 }}>
      {lines.map((l) => <li key={l} style={{ fontSize: 13, color: 'var(--ink-2)' }}>{l}</li>)}
    </ul>
  );
}

function OpeningHours({ hours }: { hours: Record<string, [string, string][]> }) {
  const rows = DAY_NAMES.map((name, day) => {
    const key = String(day);
    const ranges = Object.prototype.hasOwnProperty.call(hours, key) ? hours[key] : null;
    return {
      name,
      text: ranges == null ? 'Open 24 hours' : ranges.length === 0 ? 'Closed' : ranges.map(([a, b]) => `${a}–${b}`).join(', '),
      closed: ranges != null && ranges.length === 0,
    };
  });
  return (
    <div style={{ display: 'grid', gap: 4 }}>
      {rows.map((r) => (
        <div key={r.name} style={{ display: 'flex', gap: 10, fontSize: 13 }}>
          <span style={{ width: 92, color: 'var(--ink-3)' }}>{r.name}</span>
          <span style={{ color: r.closed ? 'var(--ink-3)' : 'var(--ink)' }}>{r.text}</span>
        </div>
      ))}
    </div>
  );
}

export function SpaceDetailBody({
  spaceId, onBook,
}: { spaceId: string; onBook?: (space: SpaceDetail) => void }) {
  const { data: space, isLoading, isError } = useQuery({
    queryKey: ['cw-space', spaceId],
    queryFn: async () => (await api.get<SpaceDetail>(`/coworking/spaces/${spaceId}`)).data,
    enabled: !!spaceId,
  });

  const bookable = useMemo(
    () => !!space && space.status !== 'INACTIVE' && space.status !== 'BLOCKED',
    [space],
  );

  if (isLoading) return <Skeleton rows={4} height={70} />;
  if (isError || !space) {
    return <EmptyState title="That space could not be loaded" body="It may have been removed. Close this and refresh the plan." />;
  }

  return (
    <div style={{ display: 'grid', gap: 22 }}>
      <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0,1.15fr) minmax(0,1fr)', gap: 22 }} className="cw-detail-grid">
        <div>
          <Gallery media={space.gallery} />
          {space.videos.length > 0 && (
            <div style={{ marginTop: 14 }}>
              <h3 className="ds-h3" style={{ marginBottom: 8 }}>Walkthrough</h3>
              <Walkthrough videos={space.videos} />
            </div>
          )}
        </div>

        <div style={{ display: 'grid', gap: 18, alignContent: 'start' }}>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
              <Badge tone={toneForSpaceStatus(space.liveStatus ?? space.status)}>{humanStatus(space.liveStatus ?? space.status)}</Badge>
              <span className="ds-caption">{spaceTypeLabel(space.type, space.customType)}</span>
              <span className="ds-caption">·</span>
              <span className="ds-caption">{space.code}</span>
            </div>
            <h2 className="ds-h1" style={{ fontSize: 22, marginTop: 8 }}>{space.name}</h2>
            <div style={{ display: 'flex', gap: 14, marginTop: 8, flexWrap: 'wrap' }}>
              <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5, fontSize: 13, color: 'var(--ink-2)' }}>
                <Users size={13} /> Seats {space.capacity}
              </span>
              {space.units > 1 && (
                <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5, fontSize: 13, color: 'var(--ink-2)' }}>
                  {space.units} bookable units
                </span>
              )}
              {space.floor && (
                <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5, fontSize: 13, color: 'var(--ink-2)' }}>
                  {space.building?.name ? `${space.building.name} · ` : ''}{space.floor.name}
                  {space.zone ? ` · ${space.zone}` : ''}
                </span>
              )}
            </div>
            {space.description && (
              <p className="ds-body" style={{ marginTop: 12 }}>{space.description}</p>
            )}
          </div>

          <div>
            <h3 className="ds-h3" style={{ marginBottom: 8 }}>Pricing</h3>
            <PriceTiers space={space} />
          </div>

          {space.amenities.length > 0 && (
            <div>
              <h3 className="ds-h3" style={{ marginBottom: 8 }}>Amenities</h3>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                {space.amenities.map((a) => <span key={a} className="ds-badge ds-tone-neutral">{a}</span>)}
              </div>
            </div>
          )}

          {onBook && (
            <div>
              <button
                className="btn-primary" style={{ width: '100%' }}
                disabled={!bookable}
                onClick={() => onBook(space)}
              >
                {bookable ? 'Book now' : `Not bookable — ${humanStatus(space.status).toLowerCase()}`}
              </button>
              {space.currentBooking && (
                <div className="ds-caption" style={{ marginTop: 8 }}>
                  In use by {space.currentBooking.contactName} until {fmtDateTime(space.currentBooking.endAt)}. You can still book a later slot.
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(240px,1fr))', gap: 22 }}>
        <div>
          <h3 className="ds-h3" style={{ marginBottom: 8 }}>Opening hours</h3>
          <OpeningHours hours={space.openingHours} />
        </div>
        <div>
          <h3 className="ds-h3" style={{ marginBottom: 8 }}>Booking rules</h3>
          <Rules rules={space.rules} />
        </div>
        <div>
          <h3 className="ds-h3" style={{ marginBottom: 8 }}>Next up</h3>
          {space.upcoming.length === 0 && space.blocks.length === 0 ? (
            <div className="ds-caption">Nothing booked. The space is free from now on.</div>
          ) : (
            <div style={{ display: 'grid', gap: 8 }}>
              {space.upcoming.slice(0, 5).map((b) => (
                <div key={b.id} style={{ display: 'flex', gap: 8, alignItems: 'center', fontSize: 13 }}>
                  <CalendarClock size={13} style={{ color: 'var(--ink-3)', flex: 'none' }} />
                  <span style={{ minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{b.contactName}</span>
                  <span className="ds-caption" style={{ marginLeft: 'auto', flex: 'none' }}>{fmtDateTime(b.startAt)}</span>
                </div>
              ))}
              {space.blocks.slice(0, 3).map((b) => (
                <div key={b.id} style={{ display: 'flex', gap: 8, alignItems: 'center', fontSize: 13 }}>
                  <Clock size={13} style={{ color: 'var(--tone-claim)', flex: 'none' }} />
                  <span>{humanStatus(b.kind)}{b.reason ? ` — ${b.reason}` : ''}</span>
                  <span className="ds-caption" style={{ marginLeft: 'auto', flex: 'none' }}>{fmtDateTime(b.startAt)}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      <DetailGrid>
        <Detail label="Tax" value={`${space.taxPct}%`} />
        <Detail label="Deposit" value={space.depositInr ? money(space.depositInr) : 'None'} />
        <Detail label="Set-up fee" value={space.setupFeeInr ? money(space.setupFeeInr) : 'None'} />
        <Detail label="Photographs" value={space.gallery.length} />
      </DetailGrid>

      <style jsx>{`
        @media (max-width: 860px) {
          :global(.cw-detail-grid) { grid-template-columns: minmax(0, 1fr) !important; }
        }
      `}</style>
    </div>
  );
}

/** The modal wrapper the floor plan and the space list both open. */
export function SpaceDetailModal({
  spaceId, onClose, onBook,
}: { spaceId: string | null; onClose: () => void; onBook?: (space: SpaceDetail) => void }) {
  return (
    <Modal open={!!spaceId} onClose={onClose} title="Space" width={1040}>
      {spaceId && <SpaceDetailBody spaceId={spaceId} onBook={onBook} />}
    </Modal>
  );
}
