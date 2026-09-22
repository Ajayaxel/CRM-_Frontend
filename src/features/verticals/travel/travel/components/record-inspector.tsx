'use client';

import React, { useState, useEffect } from 'react';
import {
  X, Sparkles, FileText, Shield, CreditCard, Luggage, Phone,
  Building2, ArrowRight, MessageSquare, Plus, Clock, Check, AlertTriangle,
  User, MapPin, Globe, Calendar, Edit3, ChevronDown, ExternalLink,
  TrendingUp, Flag
} from 'lucide-react';
import { toast } from 'sonner';

export interface TravelRecord {
  id: string;
  name: string;
  type: 'Person' | 'Company' | 'Deal' | 'Quote' | 'Visa' | 'Supplier' | 'Document' | 'Payment' | 'Ayurveda' | 'Student' | 'Pilgrimage';
  status: string;
  tone?: 'green' | 'amber' | 'blue' | 'red' | 'violet' | 'slate';
  // Person fields
  company?: string;
  location?: string;
  residenceCountry?: string;
  departureCountry?: string;
  nationality?: string;
  language?: string;
  travelerType?: string;
  passportNo?: string;
  passportExpiry?: string;
  phone?: string;
  email?: string;
  assignedAgent?: string;
  source?: string;
  tags?: string[];
  lifetimeValue?: number;
  // Trip/Quote fields
  destination?: string;
  departure?: string;
  pax?: number;
  travelDate?: string;
  returnDate?: string;
  sellInr?: number;
  costInr?: number;
  markupInr?: number;
  // Visa fields
  visaType?: string;
  embassy?: string;
  visaStatus?: string;
  // Supplier fields
  supplierType?: string;
  payable?: number;
  // Generic
  properties: { label: string; value: string | number; sensitive?: boolean }[];
  timeline: { time: string; title: string; subtitle?: string; icon?: string }[];
  connectedTrips?: { ref: string; destination: string; status: string; value: number }[];
  connectedQuotes?: { ref: string; destination: string; status: string; amount: number }[];
  connectedVisas?: { destination: string; type: string; status: string }[];
  connectedDocuments?: { title: string; status: string; expiry?: string }[];
  payments?: { title: string; subtitle: string; tag?: string; amount?: number }[];
}

interface Props {
  record: TravelRecord | null;
  onClose: () => void;
  currencySymbol?: string;
  money?: (v: number) => string;
}

type InspectorTab = 'Overview' | 'Activity' | 'Trips' | 'Finance' | 'Documents';

const statusColors: Record<string, { bg: string; color: string }> = {
  VERIFIED: { bg: 'rgba(23,128,61,0.09)', color: '#17803d' },
  CONFIRMED: { bg: 'rgba(23,128,61,0.09)', color: '#17803d' },
  APPROVED: { bg: 'rgba(23,128,61,0.09)', color: '#17803d' },
  PAID: { bg: 'rgba(23,128,61,0.09)', color: '#17803d' },
  ACTIVE: { bg: 'rgba(23,128,61,0.09)', color: '#17803d' },
  PROCESSING: { bg: 'rgba(29,78,216,0.09)', color: '#1d4ed8' },
  SENT: { bg: 'rgba(29,78,216,0.09)', color: '#1d4ed8' },
  IN_PROGRESS: { bg: 'rgba(29,78,216,0.09)', color: '#1d4ed8' },
  PENDING: { bg: 'rgba(180,83,9,0.1)', color: '#b45309' },
  UNVERIFIED: { bg: 'rgba(180,83,9,0.1)', color: '#b45309' },
  DRAFT: { bg: 'rgba(82,82,91,0.09)', color: '#52525b' },
  CANCELLED: { bg: 'rgba(192,38,38,0.09)', color: '#c02626' },
  REJECTED: { bg: 'rgba(192,38,38,0.09)', color: '#c02626' },
};

function StatusPill({ status }: { status: string }) {
  const c = statusColors[status] || { bg: 'rgba(82,82,91,0.09)', color: '#52525b' };
  return (
    <span style={{
      fontSize: 10,
      fontWeight: 700,
      background: c.bg,
      color: c.color,
      padding: '2px 7px',
      borderRadius: 4,
      letterSpacing: '.02em',
      textTransform: 'uppercase',
    }}>
      {status}
    </span>
  );
}

function initials(name: string) {
  return name
    .split(' ')
    .slice(0, 2)
    .map((w) => w[0])
    .join('')
    .toUpperCase();
}

function avatarColor(name: string) {
  const hues = [215, 250, 165, 190, 270, 340, 25, 135];
  let h = 0;
  for (let i = 0; i < name.length; i++) h += name.charCodeAt(i);
  const hue = hues[h % hues.length];
  return `hsl(${hue},55%,40%)`;
}

export function RecordInspector({ record, onClose, currencySymbol = '₹', money }: Props) {
  const [tab, setTab] = useState<InspectorTab>('Overview');

  useEffect(() => {
    setTab('Overview');
  }, [record?.id]);

  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, [onClose]);

  if (!record) return null;

  const fmt = money || ((v: number) => `${currencySymbol}${(v || 0).toLocaleString('en-IN')}`);

  const tabs: InspectorTab[] = ['Overview', 'Activity', 'Trips', 'Finance', 'Documents'];

  const profit = record.sellInr && record.costInr ? record.sellInr - record.costInr : null;
  const margin = profit && record.sellInr ? Math.round((profit / record.sellInr) * 100) : null;

  const travelIntelligence: string[] = [];
  if (record.passportExpiry) {
    const expDate = new Date(record.passportExpiry);
    const months = Math.floor((expDate.getTime() - Date.now()) / (1000 * 60 * 60 * 24 * 30));
    if (months < 6) travelIntelligence.push(`Passport expires in ~${months} months — renewal required before travel.`);
    if (months < 0) travelIntelligence.push('Passport appears to be expired. Urgent action required.');
  }
  if (record.nationality === 'Indian' && record.residenceCountry === 'Dubai, UAE') {
    travelIntelligence.push('Indian NRI based in Dubai — eligible for UAE-facilitated visas for GCC destinations.');
  }
  if ((record.connectedTrips?.length || 0) === 0) {
    travelIntelligence.push('No active trip. High probability of interest — consider reaching out with a new package.');
  }
  if (record.type === 'Person') {
    travelIntelligence.push('Based on traveler profile, consider recommending: Europe (Dec–Jan), Thailand (Oct–Nov).');
  }

  return (
    <div
      style={{
        width: 400,
        flex: '0 0 400px',
        height: '100vh',
        background: '#ffffff',
        borderLeft: '1px solid rgba(16,16,16,0.085)',
        display: 'flex',
        flexDirection: 'column',
        overflow: 'hidden',
        position: 'sticky',
        top: 0,
      }}
    >
      {/* Header */}
      <div style={{
        padding: '16px 18px 0',
        borderBottom: '1px solid rgba(16,16,16,0.085)',
        background: '#fafaf9',
        flexShrink: 0,
      }}>
        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 12 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            {/* Avatar */}
            <div style={{
              width: 40,
              height: 40,
              borderRadius: 8,
              background: avatarColor(record.name),
              color: '#fff',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontWeight: 700,
              fontSize: 14,
              flexShrink: 0,
            }}>
              {initials(record.name)}
            </div>
            <div>
              <div style={{ fontWeight: 700, fontSize: 15, color: '#191918', lineHeight: 1.2, marginBottom: 2 }}>
                {record.name}
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
                <StatusPill status={record.status} />
                {record.type && (
                  <span style={{ fontSize: 10, color: '#767671', fontWeight: 500 }}>{record.type}</span>
                )}
              </div>
            </div>
          </div>
          <button
            onClick={onClose}
            style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#767671', padding: 4, borderRadius: 4, display: 'flex', alignItems: 'center' }}
          >
            <X size={15} />
          </button>
        </div>

        {/* Quick Info Row */}
        {(record.location || record.residenceCountry || record.nationality) && (
          <div style={{ display: 'flex', gap: 12, marginBottom: 10, flexWrap: 'wrap' }}>
            {record.nationality && (
              <span style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 11, color: '#63635e' }}>
                <Flag size={11} /> {record.nationality}
              </span>
            )}
            {(record.residenceCountry || record.location) && (
              <span style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 11, color: '#63635e' }}>
                <MapPin size={11} /> {record.residenceCountry || record.location}
              </span>
            )}
            {record.destination && (
              <span style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 11, color: '#63635e' }}>
                <Globe size={11} /> → {record.destination}
              </span>
            )}
          </div>
        )}

        {/* Action Row */}
        <div style={{ display: 'flex', gap: 5, marginBottom: 12, flexWrap: 'wrap' }}>
          {record.phone && (
            <button
              onClick={() => toast.success(`WhatsApp opened for ${record.phone}`)}
              style={{ display: 'flex', alignItems: 'center', gap: 5, padding: '5px 9px', borderRadius: 4, background: '#25D366', color: '#fff', border: 'none', fontSize: 11, fontWeight: 600, cursor: 'pointer' }}
            >
              <MessageSquare size={12} /> WhatsApp
            </button>
          )}
          <button
            onClick={() => toast.success(`Creating quote for ${record.name}…`)}
            style={{ display: 'flex', alignItems: 'center', gap: 5, padding: '5px 9px', borderRadius: 4, background: '#132376', color: '#fff', border: 'none', fontSize: 11, fontWeight: 600, cursor: 'pointer' }}
          >
            <Plus size={12} /> Quote
          </button>
          <button
            onClick={() => toast.success(`Opening trip creation for ${record.name}…`)}
            style={{ display: 'flex', alignItems: 'center', gap: 5, padding: '5px 9px', borderRadius: 4, background: '#fff', color: '#191918', border: '1px solid rgba(16,16,16,0.15)', fontSize: 11, fontWeight: 600, cursor: 'pointer' }}
          >
            <Luggage size={12} /> Trip
          </button>
          <button
            onClick={() => toast.success(`Starting visa application for ${record.name}…`)}
            style={{ display: 'flex', alignItems: 'center', gap: 5, padding: '5px 9px', borderRadius: 4, background: '#fff', color: '#191918', border: '1px solid rgba(16,16,16,0.15)', fontSize: 11, fontWeight: 600, cursor: 'pointer' }}
          >
            <Shield size={12} /> Visa
          </button>
        </div>

        {/* Tabs */}
        <div style={{ display: 'flex', gap: 0 }}>
          {tabs.map((t) => (
            <button
              key={t}
              onClick={() => setTab(t)}
              style={{
                padding: '7px 10px',
                border: 'none',
                background: 'transparent',
                fontSize: 12,
                fontWeight: tab === t ? 600 : 400,
                color: tab === t ? '#191918' : '#767671',
                cursor: 'pointer',
                borderBottom: tab === t ? '2px solid #191918' : '2px solid transparent',
                transition: 'all .1s',
              }}
            >
              {t}
            </button>
          ))}
        </div>
      </div>

      {/* Tab Content */}
      <div style={{ flex: 1, overflowY: 'auto', padding: '14px 18px' }}>

        {/* ── OVERVIEW ── */}
        {tab === 'Overview' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>

            {/* Travel Intelligence */}
            {travelIntelligence.length > 0 && (
              <div style={{ background: 'rgba(99,92,255,0.06)', border: '1px solid rgba(99,92,255,0.15)', borderRadius: 6, padding: '10px 12px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 8, fontWeight: 600, fontSize: 11, color: '#4f46e5' }}>
                  <Sparkles size={13} /> Travel Intelligence
                </div>
                {travelIntelligence.map((tip, i) => (
                  <div key={i} style={{ fontSize: 12, color: '#3730a3', marginBottom: i < travelIntelligence.length - 1 ? 6 : 0, lineHeight: 1.5 }}>
                    · {tip}
                  </div>
                ))}
              </div>
            )}

            {/* Properties */}
            <div>
              <div style={{ fontSize: 10, fontWeight: 700, color: '#9b9b96', letterSpacing: '.06em', textTransform: 'uppercase', marginBottom: 8 }}>Properties</div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 0, border: '1px solid rgba(16,16,16,0.085)', borderRadius: 6, overflow: 'hidden' }}>
                {record.properties.map((p, i) => (
                  <div key={i} style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    padding: '7px 12px',
                    borderBottom: i < record.properties.length - 1 ? '1px solid rgba(16,16,16,0.05)' : 'none',
                    background: '#fff',
                  }}>
                    <span style={{ fontSize: 11, color: '#767671', fontWeight: 500 }}>{p.label}</span>
                    <span style={{ fontSize: 12, color: '#191918', fontWeight: 600, fontFamily: p.sensitive ? 'monospace' : 'inherit' }}>
                      {p.sensitive ? `••••${String(p.value).slice(-4)}` : p.value}
                    </span>
                  </div>
                ))}
              </div>
            </div>

            {/* Connected Records */}
            {((record.connectedTrips?.length || 0) > 0 || (record.connectedQuotes?.length || 0) > 0 || (record.connectedVisas?.length || 0) > 0) && (
              <div>
                <div style={{ fontSize: 10, fontWeight: 700, color: '#9b9b96', letterSpacing: '.06em', textTransform: 'uppercase', marginBottom: 8 }}>Connected Records</div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                  {(record.connectedTrips || []).map((trip, i) => (
                    <div key={i} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '8px 12px', borderRadius: 5, border: '1px solid rgba(16,16,16,0.085)', background: '#fafaf9', cursor: 'pointer' }}
                      onMouseEnter={e => (e.currentTarget.style.background = '#f3f3f0')}
                      onMouseLeave={e => (e.currentTarget.style.background = '#fafaf9')}
                    >
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        <Luggage size={13} style={{ color: '#767671' }} />
                        <div>
                          <div style={{ fontSize: 12, fontWeight: 600, color: '#191918' }}>{trip.ref}</div>
                          <div style={{ fontSize: 11, color: '#767671' }}>{trip.destination}</div>
                        </div>
                      </div>
                      <div style={{ textAlign: 'right' }}>
                        <StatusPill status={trip.status} />
                        <div style={{ fontSize: 11, color: '#191918', fontWeight: 600, marginTop: 3 }}>{fmt(trip.value)}</div>
                      </div>
                    </div>
                  ))}
                  {(record.connectedQuotes || []).map((q, i) => (
                    <div key={i} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '8px 12px', borderRadius: 5, border: '1px solid rgba(16,16,16,0.085)', background: '#fafaf9', cursor: 'pointer' }}
                      onMouseEnter={e => (e.currentTarget.style.background = '#f3f3f0')}
                      onMouseLeave={e => (e.currentTarget.style.background = '#fafaf9')}
                    >
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        <FileText size={13} style={{ color: '#767671' }} />
                        <div>
                          <div style={{ fontSize: 12, fontWeight: 600, color: '#191918' }}>{q.ref}</div>
                          <div style={{ fontSize: 11, color: '#767671' }}>{q.destination}</div>
                        </div>
                      </div>
                      <div style={{ textAlign: 'right' }}>
                        <StatusPill status={q.status} />
                        <div style={{ fontSize: 11, color: '#191918', fontWeight: 600, marginTop: 3 }}>{fmt(q.amount)}</div>
                      </div>
                    </div>
                  ))}
                  {(record.connectedVisas || []).map((v, i) => (
                    <div key={i} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '8px 12px', borderRadius: 5, border: '1px solid rgba(16,16,16,0.085)', background: '#fafaf9' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        <Shield size={13} style={{ color: '#767671' }} />
                        <div>
                          <div style={{ fontSize: 12, fontWeight: 600, color: '#191918' }}>{v.destination}</div>
                          <div style={{ fontSize: 11, color: '#767671' }}>{v.type}</div>
                        </div>
                      </div>
                      <StatusPill status={v.status} />
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Tags */}
            {record.tags && record.tags.length > 0 && (
              <div>
                <div style={{ fontSize: 10, fontWeight: 700, color: '#9b9b96', letterSpacing: '.06em', textTransform: 'uppercase', marginBottom: 8 }}>Tags</div>
                <div style={{ display: 'flex', gap: 5, flexWrap: 'wrap' }}>
                  {record.tags.map((tag, i) => (
                    <span key={i} style={{ fontSize: 11, background: '#f1f5f9', color: '#475569', padding: '2px 8px', borderRadius: 12, fontWeight: 500 }}>
                      {tag}
                    </span>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {/* ── ACTIVITY ── */}
        {tab === 'Activity' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 0 }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
              <div style={{ fontSize: 10, fontWeight: 700, color: '#9b9b96', letterSpacing: '.06em', textTransform: 'uppercase' }}>Timeline</div>
              <button
                onClick={() => toast.success('Note added to timeline')}
                style={{ display: 'flex', alignItems: 'center', gap: 4, padding: '4px 8px', borderRadius: 4, background: '#f7f7f6', border: '1px solid rgba(16,16,16,0.085)', fontSize: 11, fontWeight: 600, cursor: 'pointer', color: '#191918' }}
              >
                <Plus size={11} /> Note
              </button>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 0 }}>
              {record.timeline.map((event, i) => (
                <div key={i} style={{ display: 'flex', gap: 12, paddingBottom: 14, position: 'relative' }}>
                  <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 0, flexShrink: 0 }}>
                    <div style={{ width: 22, height: 22, borderRadius: '50%', background: '#f1f5f9', display: 'flex', alignItems: 'center', justifyContent: 'center', border: '1px solid rgba(16,16,16,0.085)' }}>
                      {event.icon === 'whatsapp' ? <MessageSquare size={10} style={{ color: '#25D366' }} /> :
                        event.icon === 'payment' ? <CreditCard size={10} style={{ color: '#17803d' }} /> :
                        event.icon === 'doc' ? <FileText size={10} style={{ color: '#767671' }} /> :
                        event.icon === 'visa' ? <Shield size={10} style={{ color: '#1d4ed8' }} /> :
                        <Clock size={10} style={{ color: '#767671' }} />}
                    </div>
                    {i < record.timeline.length - 1 && (
                      <div style={{ width: 1, flex: 1, background: 'rgba(16,16,16,0.085)', minHeight: 12, marginTop: 2 }} />
                    )}
                  </div>
                  <div style={{ paddingBottom: 2 }}>
                    <div style={{ fontSize: 12, fontWeight: 600, color: '#191918', lineHeight: 1.4 }}>{event.title}</div>
                    {event.subtitle && <div style={{ fontSize: 11, color: '#63635e', marginTop: 2, lineHeight: 1.4 }}>{event.subtitle}</div>}
                    <div style={{ fontSize: 10, color: '#9b9b96', marginTop: 3 }}>{event.time}</div>
                  </div>
                </div>
              ))}
              {record.timeline.length === 0 && (
                <div style={{ textAlign: 'center', color: '#9b9b96', fontSize: 12, padding: 24 }}>No activity recorded yet.</div>
              )}
            </div>
          </div>
        )}

        {/* ── TRIPS ── */}
        {tab === 'Trips' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 4 }}>
              <div style={{ fontSize: 10, fontWeight: 700, color: '#9b9b96', letterSpacing: '.06em', textTransform: 'uppercase' }}>
                Trips ({(record.connectedTrips?.length || 0) + (record.connectedQuotes?.length || 0)})
              </div>
              <button
                onClick={() => toast.success(`Creating trip for ${record.name}…`)}
                style={{ display: 'flex', alignItems: 'center', gap: 4, padding: '4px 8px', borderRadius: 4, background: '#132376', color: '#fff', border: 'none', fontSize: 11, fontWeight: 600, cursor: 'pointer' }}
              >
                <Plus size={11} /> New Trip
              </button>
            </div>
            {(record.connectedTrips || []).map((trip, i) => (
              <div key={i} style={{ padding: '10px 12px', borderRadius: 6, border: '1px solid rgba(16,16,16,0.085)', background: '#fafaf9' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
                  <span style={{ fontSize: 12, fontWeight: 700, color: '#132376' }}>{trip.ref}</span>
                  <StatusPill status={trip.status} />
                </div>
                <div style={{ fontSize: 12, color: '#191918', fontWeight: 600 }}>{trip.destination}</div>
                <div style={{ fontSize: 11, color: '#767671', marginTop: 2 }}>Value: {fmt(trip.value)}</div>
              </div>
            ))}
            {(record.connectedQuotes || []).map((q, i) => (
              <div key={i} style={{ padding: '10px 12px', borderRadius: 6, border: '1px solid rgba(16,16,16,0.085)', background: '#fafaf9' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
                  <span style={{ fontSize: 12, fontWeight: 700, color: '#767671' }}>{q.ref} (Quote)</span>
                  <StatusPill status={q.status} />
                </div>
                <div style={{ fontSize: 12, color: '#191918', fontWeight: 600 }}>{q.destination}</div>
                <div style={{ fontSize: 11, color: '#767671', marginTop: 2 }}>{fmt(q.amount)}</div>
              </div>
            ))}
            {!record.connectedTrips?.length && !record.connectedQuotes?.length && (
              <div style={{ textAlign: 'center', color: '#9b9b96', fontSize: 12, padding: 24 }}>No trips or quotes found.</div>
            )}
          </div>
        )}

        {/* ── FINANCE ── */}
        {tab === 'Finance' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            {record.sellInr != null && (
              <div style={{ border: '1px solid rgba(16,16,16,0.085)', borderRadius: 6, overflow: 'hidden' }}>
                <div style={{ padding: '8px 12px', background: '#fafaf9', borderBottom: '1px solid rgba(16,16,16,0.085)', fontSize: 11, fontWeight: 700, color: '#191918' }}>
                  Trip P&L
                </div>
                {[
                  { label: 'Selling Price', value: fmt(record.sellInr || 0), color: '#191918' },
                  { label: 'Supplier Cost', value: `− ${fmt(record.costInr || 0)}`, color: '#c02626' },
                  { label: 'Gross Profit', value: profit ? fmt(profit) : '—', color: '#17803d' },
                  { label: 'Margin', value: margin ? `${margin}%` : '—', color: '#17803d' },
                ].map((row, i) => (
                  <div key={i} style={{ display: 'flex', justifyContent: 'space-between', padding: '7px 12px', borderBottom: '1px solid rgba(16,16,16,0.05)' }}>
                    <span style={{ fontSize: 11, color: '#767671' }}>{row.label}</span>
                    <span style={{ fontSize: 12, fontWeight: 700, color: row.color }}>{row.value}</span>
                  </div>
                ))}
              </div>
            )}

            {record.lifetimeValue != null && (
              <div style={{ padding: '10px 12px', borderRadius: 6, background: 'rgba(19,35,118,0.04)', border: '1px solid rgba(19,35,118,0.1)' }}>
                <div style={{ fontSize: 11, color: '#767671', marginBottom: 2 }}>Lifetime Value</div>
                <div style={{ fontSize: 22, fontWeight: 700, color: '#132376' }}>{fmt(record.lifetimeValue)}</div>
              </div>
            )}

            {(record.payments || []).map((p, i) => (
              <div key={i} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '8px 12px', border: '1px solid rgba(16,16,16,0.085)', borderRadius: 5 }}>
                <div>
                  <div style={{ fontSize: 12, fontWeight: 600, color: '#191918' }}>{p.title}</div>
                  <div style={{ fontSize: 11, color: '#767671' }}>{p.subtitle}</div>
                </div>
                {p.tag && <StatusPill status={p.tag} />}
              </div>
            ))}

            {!record.sellInr && !record.lifetimeValue && !record.payments?.length && (
              <div style={{ textAlign: 'center', color: '#9b9b96', fontSize: 12, padding: 24 }}>No financial records found.</div>
            )}
          </div>
        )}

        {/* ── DOCUMENTS ── */}
        {tab === 'Documents' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 4 }}>
              <div style={{ fontSize: 10, fontWeight: 700, color: '#9b9b96', letterSpacing: '.06em', textTransform: 'uppercase' }}>Documents</div>
              <button
                onClick={() => toast.success('Document upload dialog opened')}
                style={{ display: 'flex', alignItems: 'center', gap: 4, padding: '4px 8px', borderRadius: 4, background: '#f7f7f6', border: '1px solid rgba(16,16,16,0.085)', fontSize: 11, fontWeight: 600, cursor: 'pointer', color: '#191918' }}
              >
                <Plus size={11} /> Add
              </button>
            </div>
            {record.passportNo && (
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '8px 12px', border: '1px solid rgba(16,16,16,0.085)', borderRadius: 5, background: '#fafaf9' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <Shield size={13} style={{ color: '#767671' }} />
                  <div>
                    <div style={{ fontSize: 12, fontWeight: 600, color: '#191918' }}>Passport</div>
                    <div style={{ fontSize: 11, color: '#767671', fontFamily: 'monospace' }}>
                      ••••{String(record.passportNo).slice(-4)}
                    </div>
                  </div>
                </div>
                <StatusPill status="VERIFIED" />
              </div>
            )}
            {(record.connectedDocuments || []).map((doc, i) => (
              <div key={i} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '8px 12px', border: '1px solid rgba(16,16,16,0.085)', borderRadius: 5, background: '#fafaf9' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <FileText size={13} style={{ color: '#767671' }} />
                  <div>
                    <div style={{ fontSize: 12, fontWeight: 600, color: '#191918' }}>{doc.title}</div>
                    {doc.expiry && <div style={{ fontSize: 11, color: '#767671' }}>Expires: {doc.expiry}</div>}
                  </div>
                </div>
                <StatusPill status={doc.status} />
              </div>
            ))}
            {!record.passportNo && !record.connectedDocuments?.length && (
              <div style={{ textAlign: 'center', color: '#9b9b96', fontSize: 12, padding: 24 }}>No documents on file.</div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
