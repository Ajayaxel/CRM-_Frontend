'use client';

import { ExternalLink, MapPin, Video } from 'lucide-react';
import {
  EXTERNAL_PROVIDERS, MeetingDraft, MeetingJoin, MeetingProvider,
  PROVIDER_HINT, PROVIDER_LABEL, meetingError,
} from '../meeting-client';

/**
 * The organiser's choice, in one control shared by every surface that
 * schedules something.
 *
 * Three surfaces ask this question — campus events, mock interviews and PTM
 * slots — and three copies of the radio group would drift the first time a
 * provider is added. The wording is the same everywhere for the same reason: a
 * registrar who learns it on one screen should not have to relearn it.
 */
export function MeetingFields({
  value, onChange, placeLabel = 'Venue',
}: {
  value: MeetingDraft;
  onChange: (m: MeetingDraft) => void;
  /** "Venue" for an event, "Room" for a PTM slot — the physical field's name. */
  placeLabel?: string;
}) {
  const err = meetingError(value);
  const set = (patch: Partial<MeetingDraft>) => onChange({ ...value, ...patch });

  return (
    <div style={{ display: 'grid', gap: 8 }}>
      <div style={{ display: 'flex', gap: 14, alignItems: 'center', flexWrap: 'wrap', fontSize: 12.5 }}>
        <span style={{ color: 'var(--ink-3)', fontSize: 11.5 }}>Format</span>
        <label style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
          <input
            type="radio" name={`fmt-${placeLabel}`} checked={value.format === 'IN_PERSON'}
            onChange={() => set({ format: 'IN_PERSON' })}
          />
          <MapPin size={12} /> In person
        </label>
        <label style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
          <input
            type="radio" name={`fmt-${placeLabel}`} checked={value.format === 'ONLINE'}
            onChange={() => set({ format: 'ONLINE' })}
          />
          <Video size={12} /> Online
        </label>
      </div>

      {value.format === 'IN_PERSON' ? (
        <input
          className="input" style={{ height: 34, width: 240 }}
          placeholder={placeLabel}
          value={value.place}
          onChange={(e) => set({ place: e.target.value })}
        />
      ) : (
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
          <select
            className="input" style={{ height: 34, width: 210 }}
            value={value.provider}
            onChange={(e) => set({ provider: e.target.value as MeetingProvider })}
          >
            {/* In-app first: it is the default and the one that keeps people in the product. */}
            <option value="IN_APP">{PROVIDER_LABEL.IN_APP}</option>
            {EXTERNAL_PROVIDERS.map((p) => <option key={p} value={p}>{PROVIDER_LABEL[p]}</option>)}
          </select>

          {value.provider === 'IN_APP' ? (
            <span style={{ fontSize: 11.5, color: 'var(--ink-3)' }}>
              A room is created automatically — nothing to paste.
            </span>
          ) : (
            <input
              className="input"
              style={{ height: 34, flex: 1, minWidth: 280, borderColor: err ? 'var(--danger,#c0392b)' : undefined }}
              placeholder={PROVIDER_HINT[value.provider] ?? 'https://…'}
              value={value.url}
              onChange={(e) => set({ url: e.target.value })}
            />
          )}
        </div>
      )}

      {err && <span style={{ fontSize: 11.5, color: 'var(--danger,#c0392b)' }}>{err}</span>}
    </div>
  );
}

/**
 * The participant's side: one action that does the right thing.
 *
 * An external link opens in a new tab and SAYS it leaves the app, because
 * being handed to Zoom without warning is disorienting — and because the
 * in-app case must not look identical to it when it behaves differently.
 */
export function JoinButton({ join, size = 'md' }: { join?: MeetingJoin | null; size?: 'sm' | 'md' }) {
  if (!join || !join.online || !join.url) {
    return join && !join.online
      ? <span style={{ fontSize: 11.5, color: 'var(--ink-3)' }}><MapPin size={11} style={{ verticalAlign: -1 }} /> In person</span>
      : null;
  }
  const h = size === 'sm' ? 28 : 32;
  const fs = size === 'sm' ? 11 : 12;

  if (join.external) {
    return (
      <a
        className="btn-secondary"
        href={join.url}
        target="_blank"
        rel="noopener noreferrer"
        style={{ height: h, fontSize: fs, display: 'inline-flex', alignItems: 'center', gap: 5, textDecoration: 'none' }}
        title={`Opens ${join.url} in a new tab`}
      >
        <ExternalLink size={12} /> {join.label}
      </a>
    );
  }
  return (
    <a
      className="btn-primary"
      href={join.url}
      style={{ height: h, fontSize: fs, display: 'inline-flex', alignItems: 'center', gap: 5, textDecoration: 'none' }}
    >
      <Video size={12} /> {join.label}
    </a>
  );
}
