'use client';

import { useState, useEffect, useRef, useMemo } from 'react';
import {
  Search, Sparkles, User, FileText, Luggage, Shield, Building2,
  ArrowRight, X, Plus, CreditCard, Handshake
} from 'lucide-react';
import { toast } from 'sonner';

interface SearchResult {
  id: string;
  type: string;
  title: string;
  subtitle: string;
  category: string;
  icon?: React.ElementType;
  action?: () => void;
}

interface Props {
  isOpen: boolean;
  onClose: () => void;
  onSelectRecord?: (record: any) => void;
  travelers?: any[];
  quotes?: any[];
  bookings?: any[];
  visas?: any[];
  suppliers?: any[];
  corporate?: any[];
}

const categoryIcons: Record<string, React.ElementType> = {
  People: User,
  Trips: Luggage,
  Quotes: FileText,
  Visas: Shield,
  Suppliers: Handshake,
  Corporate: Building2,
  Actions: Plus,
};

export function CommandPalette({
  isOpen,
  onClose,
  onSelectRecord,
  travelers = [],
  quotes = [],
  bookings = [],
  visas = [],
  suppliers = [],
  corporate = [],
}: Props) {
  const [query, setQuery] = useState('');
  const [selectedIdx, setSelectedIdx] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (isOpen) {
      setQuery('');
      setSelectedIdx(0);
      setTimeout(() => inputRef.current?.focus(), 50);
    }
  }, [isOpen]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault();
        if (isOpen) onClose();
      }
      if (e.key === 'Escape' && isOpen) onClose();
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  const quickActions: SearchResult[] = [
    { id: 'a1', type: 'Action', title: 'Create new person', subtitle: 'Add a customer, traveler, or lead', category: 'Actions', icon: User, action: () => { toast.success('Opening new person form…'); onClose(); } },
    { id: 'a2', type: 'Action', title: 'Create quote', subtitle: 'Start a new travel quotation', category: 'Actions', icon: FileText, action: () => { toast.success('Opening new quote form…'); onClose(); } },
    { id: 'a3', type: 'Action', title: 'Create trip', subtitle: 'Confirm a booking', category: 'Actions', icon: Luggage, action: () => { toast.success('Opening new trip form…'); onClose(); } },
    { id: 'a4', type: 'Action', title: 'Start visa application', subtitle: 'Create a new visa case', category: 'Actions', icon: Shield, action: () => { toast.success('Opening visa application form…'); onClose(); } },
    { id: 'a5', type: 'Action', title: 'Record payment', subtitle: 'Log customer or supplier payment', category: 'Actions', icon: CreditCard, action: () => { toast.success('Opening payment record form…'); onClose(); } },
  ];

  const results = useMemo<SearchResult[]>(() => {
    const q = query.toLowerCase().trim();

    const travelerResults: SearchResult[] = travelers.slice(0, 50).map((t: any) => ({
      id: `p-${t.id}`,
      type: 'Person',
      title: t.name || t.fullName || 'Unknown',
      subtitle: [t.nationality, t.location || t.residenceCountry, t.passportNo ? `Passport ••••${String(t.passportNo).slice(-4)}` : null].filter(Boolean).join(' · '),
      category: 'People',
      icon: User,
      action: () => { if (onSelectRecord) onSelectRecord({ ...t, _type: 'Person' }); onClose(); },
    }));

    const quoteResults: SearchResult[] = quotes.slice(0, 30).map((q2: any) => ({
      id: `q-${q2.id}`,
      type: 'Quote',
      title: `${q2.reference || 'QT-—'} · ${q2.destination || 'Unknown'}`,
      subtitle: [q2.customerName, q2.status, q2.totalAmountInr ? `₹${Number(q2.totalAmountInr).toLocaleString('en-IN')}` : null].filter(Boolean).join(' · '),
      category: 'Quotes',
      icon: FileText,
      action: () => { if (onSelectRecord) onSelectRecord({ ...q2, _type: 'Quote' }); onClose(); },
    }));

    const bookingResults: SearchResult[] = bookings.slice(0, 30).map((b: any) => ({
      id: `b-${b.id}`,
      type: 'Trip',
      title: `${b.reference || 'BK-—'} · ${b.customerName || 'Unknown'}`,
      subtitle: [b.status, b.travelDate ? String(b.travelDate).slice(0, 10) : null, b.pax ? `${b.pax} PAX` : null].filter(Boolean).join(' · '),
      category: 'Trips',
      icon: Luggage,
      action: () => { if (onSelectRecord) onSelectRecord({ ...b, _type: 'Trip' }); onClose(); },
    }));

    const visaResults: SearchResult[] = visas.slice(0, 20).map((v: any) => ({
      id: `v-${v.id}`,
      type: 'Visa',
      title: `${v.applicantName || 'Unknown'} → ${v.destination || '—'}`,
      subtitle: [v.visaType, v.status, v.passportNo ? `••••${String(v.passportNo).slice(-4)}` : null].filter(Boolean).join(' · '),
      category: 'Visas',
      icon: Shield,
      action: () => { if (onSelectRecord) onSelectRecord({ ...v, _type: 'Visa' }); onClose(); },
    }));

    const supplierResults: SearchResult[] = suppliers.slice(0, 15).map((s: any) => ({
      id: `s-${s.id}`,
      type: 'Supplier',
      title: s.name || 'Unknown Supplier',
      subtitle: [s.type, s.region || s.country].filter(Boolean).join(' · '),
      category: 'Suppliers',
      icon: Handshake,
      action: () => { onClose(); },
    }));

    const all = [...travelerResults, ...quoteResults, ...bookingResults, ...visaResults, ...supplierResults];

    if (!q) return all.slice(0, 12);

    return all.filter(r =>
      r.title.toLowerCase().includes(q) ||
      r.subtitle.toLowerCase().includes(q) ||
      r.type.toLowerCase().includes(q)
    ).slice(0, 15);
  }, [query, travelers, quotes, bookings, visas, suppliers, onSelectRecord, onClose]);

  const actionResults = query.trim()
    ? quickActions.filter(a => a.title.toLowerCase().includes(query.toLowerCase()))
    : quickActions;

  const allItems = [...results, ...actionResults];

  useEffect(() => setSelectedIdx(0), [query]);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'ArrowDown') { e.preventDefault(); setSelectedIdx(i => Math.min(i + 1, allItems.length - 1)); }
    if (e.key === 'ArrowUp') { e.preventDefault(); setSelectedIdx(i => Math.max(i - 1, 0)); }
    if (e.key === 'Enter') {
      e.preventDefault();
      const item = allItems[selectedIdx];
      if (item?.action) item.action();
    }
  };

  if (!isOpen) return null;

  // Group results by category
  const grouped: Record<string, SearchResult[]> = {};
  results.forEach(r => {
    if (!grouped[r.category]) grouped[r.category] = [];
    grouped[r.category].push(r);
  });

  let flatIdx = 0;

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 1300,
        background: 'rgba(15,23,42,0.4)',
        backdropFilter: 'blur(4px)',
        display: 'flex',
        alignItems: 'flex-start',
        justifyContent: 'center',
        paddingTop: '8vh',
        animation: 'cmdFadeIn .12s ease-out',
      }}
      onClick={onClose}
    >
      <style>{`
        @keyframes cmdFadeIn { from { opacity: 0; } to { opacity: 1; } }
        @keyframes cmdSlideIn { from { opacity: 0; transform: translateY(-8px) scale(.98); } to { opacity: 1; transform: translateY(0) scale(1); } }
      `}</style>
      <div
        onClick={e => e.stopPropagation()}
        onKeyDown={handleKeyDown}
        style={{
          width: 640,
          maxWidth: '92vw',
          background: '#ffffff',
          borderRadius: 12,
          boxShadow: '0 24px 48px rgba(0,0,0,0.2), 0 0 0 1px rgba(0,0,0,0.06)',
          overflow: 'hidden',
          animation: 'cmdSlideIn .18s cubic-bezier(.16,1,.3,1)',
          maxHeight: '75vh',
          display: 'flex',
          flexDirection: 'column',
        }}
      >
        {/* Input Bar */}
        <div style={{ display: 'flex', alignItems: 'center', padding: '14px 18px', borderBottom: '1px solid rgba(16,16,16,0.085)', gap: 12, flexShrink: 0 }}>
          <Search size={18} style={{ color: '#767671', flexShrink: 0 }} />
          <input
            ref={inputRef}
            value={query}
            onChange={e => setQuery(e.target.value)}
            placeholder="Search people, trips, quotes, visas… or type a command"
            style={{
              flex: 1,
              border: 'none',
              outline: 'none',
              fontSize: 15,
              fontWeight: 500,
              color: '#191918',
              background: 'transparent',
            }}
          />
          {query && (
            <button
              onClick={() => setQuery('')}
              style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#767671', padding: 2, display: 'flex', alignItems: 'center' }}
            >
              <X size={14} />
            </button>
          )}
          <kbd style={{ fontSize: 11, background: '#f1f5f9', color: '#767671', padding: '2px 6px', borderRadius: 4, fontFamily: 'monospace', flexShrink: 0 }}>ESC</kbd>
        </div>

        {/* Results */}
        <div style={{ overflowY: 'auto', maxHeight: 'calc(75vh - 58px)' }}>
          {/* AI suggestion row */}
          {query.trim().length > 2 && (
            <div style={{ padding: '10px 18px', background: 'linear-gradient(135deg, #EEF2FF 0%, #F5F3FF 100%)', borderBottom: '1px solid rgba(99,92,255,0.12)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, fontWeight: 600, color: '#4f46e5' }}>
                <Sparkles size={15} />
                AI: "{query}"
              </div>
              <button
                onClick={() => { toast.success(`AI executing: "${query}"`); onClose(); }}
                style={{ padding: '4px 10px', borderRadius: 5, background: '#4f46e5', color: '#fff', border: 'none', fontSize: 11, fontWeight: 700, cursor: 'pointer' }}
              >
                Run
              </button>
            </div>
          )}

          {/* Grouped search results */}
          {Object.entries(grouped).map(([category, items]) => {
            const Icon = categoryIcons[category] || User;
            return (
              <div key={category}>
                <div style={{ padding: '8px 18px 4px', fontSize: 10, fontWeight: 700, color: '#9b9b96', letterSpacing: '.06em', textTransform: 'uppercase' }}>
                  {category}
                </div>
                {items.map(item => {
                  const ItemIcon = item.icon || User;
                  const isSelected = flatIdx === selectedIdx;
                  const currentIdx = flatIdx++;
                  return (
                    <div
                      key={item.id}
                      onClick={() => item.action?.()}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        padding: '9px 18px',
                        cursor: 'pointer',
                        background: isSelected ? '#f1f5f9' : 'transparent',
                        transition: 'background .1s',
                      }}
                      onMouseEnter={e => { setSelectedIdx(currentIdx); (e.currentTarget.style.background = '#f1f5f9'); }}
                      onMouseLeave={e => { (e.currentTarget.style.background = isSelected ? '#f1f5f9' : 'transparent'); }}
                    >
                      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                        <div style={{ width: 28, height: 28, borderRadius: 6, background: '#f7f7f6', display: 'flex', alignItems: 'center', justifyContent: 'center', border: '1px solid rgba(16,16,16,0.085)' }}>
                          <ItemIcon size={13} style={{ color: '#63635e' }} />
                        </div>
                        <div>
                          <div style={{ fontSize: 13, fontWeight: 600, color: '#191918' }}>{item.title}</div>
                          <div style={{ fontSize: 11, color: '#767671', marginTop: 1 }}>{item.subtitle}</div>
                        </div>
                      </div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        <span style={{ fontSize: 10, background: '#f1f5f9', color: '#767671', padding: '2px 6px', borderRadius: 4, fontWeight: 600 }}>{item.type}</span>
                        <ArrowRight size={14} style={{ color: '#c5c5c2' }} />
                      </div>
                    </div>
                  );
                })}
              </div>
            );
          })}

          {/* Quick actions */}
          {actionResults.length > 0 && (
            <div>
              <div style={{ padding: '8px 18px 4px', fontSize: 10, fontWeight: 700, color: '#9b9b96', letterSpacing: '.06em', textTransform: 'uppercase' }}>
                Actions
              </div>
              {actionResults.map(item => {
                const ItemIcon = item.icon || Plus;
                const isSelected = flatIdx === selectedIdx;
                const currentIdx = flatIdx++;
                return (
                  <div
                    key={item.id}
                    onClick={() => item.action?.()}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      padding: '9px 18px',
                      cursor: 'pointer',
                      background: isSelected ? '#f1f5f9' : 'transparent',
                    }}
                    onMouseEnter={e => { setSelectedIdx(currentIdx); (e.currentTarget.style.background = '#f1f5f9'); }}
                    onMouseLeave={e => { (e.currentTarget.style.background = 'transparent'); }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                      <div style={{ width: 28, height: 28, borderRadius: 6, background: 'rgba(99,92,255,0.08)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                        <ItemIcon size={13} style={{ color: '#4f46e5' }} />
                      </div>
                      <div>
                        <div style={{ fontSize: 13, fontWeight: 600, color: '#191918' }}>{item.title}</div>
                        <div style={{ fontSize: 11, color: '#767671', marginTop: 1 }}>{item.subtitle}</div>
                      </div>
                    </div>
                    <ArrowRight size={14} style={{ color: '#c5c5c2' }} />
                  </div>
                );
              })}
            </div>
          )}

          {results.length === 0 && !query.trim() && (
            <div style={{ padding: '20px 18px', color: '#9b9b96', fontSize: 13, textAlign: 'center' }}>
              Type to search people, trips, quotes, or visas…
            </div>
          )}
          {results.length === 0 && query.trim() && (
            <div style={{ padding: '20px 18px', color: '#9b9b96', fontSize: 13, textAlign: 'center' }}>
              No results for "{query}" — try a name, reference, or destination.
            </div>
          )}
        </div>

        {/* Footer */}
        <div style={{ padding: '8px 18px', background: '#fafaf9', borderTop: '1px solid rgba(16,16,16,0.085)', display: 'flex', gap: 16, fontSize: 11, color: '#9b9b96', flexShrink: 0 }}>
          <span>↑↓ Navigate</span>
          <span>↵ Open</span>
          <span>⌘K or Esc Close</span>
        </div>
      </div>
    </div>
  );
}
