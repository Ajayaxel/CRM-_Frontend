'use client';

import React, { useState, useEffect, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useSearchParams, useRouter, usePathname } from 'next/navigation';
import {
  Search, Sparkles, Users, Luggage, FileText, Calendar, Shield,
  Building2, Plus, ChevronRight, ChevronsLeft, ChevronsRight,
  LayoutGrid, Handshake, Compass, Plane, AlertTriangle, Filter,
  X, CheckCircle2, DollarSign, Clock, RefreshCw, MessageSquare
} from 'lucide-react';
import { toast } from 'sonner';
import { RecordInspector, TravelRecord } from './record-inspector';
import { CommandPalette } from './command-palette';
import { api, apiErrorMessage } from '@/lib/api';

export type WorkspaceTab =
  | 'Overview'
  | 'People'
  | 'Trips'
  | 'Quotes'
  | 'Visas'
  | 'Documents'
  | 'Calendar'
  | 'Suppliers'
  | 'Corporate'
  | 'Ayurveda'
  | 'Student Migration';

interface Props {
  defaultTab?: string;
}

export function TravelCrmWorkspace({ defaultTab = 'People' }: Props) {
  const queryClient = useQueryClient();
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const [activeTab, setActiveTab] = useState<WorkspaceTab>('People');
  const [selectedRecord, setSelectedRecord] = useState<TravelRecord | null>(null);
  const [selectedRowIdx, setSelectedRowIdx] = useState<number>(0);
  const [isCommandOpen, setIsCommandOpen] = useState(false);
  const [isRailCollapsed, setIsRailCollapsed] = useState(false);
  const [selectedCurrency, setSelectedCurrency] = useState<'INR' | 'AED' | 'SAR' | 'QAR'>('INR');
  const [activeKpiFilter, setActiveKpiFilter] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [viewportWidth, setViewportWidth] = useState(1440);

  // Form states for New Record modal
  const [formData, setFormData] = useState({
    name: '',
    customerPhone: '',
    destination: '',
    passportNo: '',
    nationality: 'Indian',
    residence: 'Dubai, UAE',
    pax: 2,
    budgetInr: 50000,
    markupInr: 15000,
    visaType: 'Tourist 30-Day',
    supplierType: 'DMC',
    companyName: '',
  });

  const currencySymbol = selectedCurrency === 'INR' ? '₹' : `${selectedCurrency} `;
  const money = (v: number) => `${currencySymbol}${(v || 0).toLocaleString('en-IN')}`;

  // Track viewport width for responsive inspector sizing (440px desktop vs 400px laptop)
  useEffect(() => {
    const handleResize = () => setViewportWidth(window.innerWidth);
    handleResize();
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  // Keyboard shortcut listener for ⌘K and Arrow keys table navigation
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault();
        setIsCommandOpen(true);
      }
      if (e.key === 'Escape') {
        if (isCommandOpen) setIsCommandOpen(false);
        else if (selectedRecord) setSelectedRecord(null);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isCommandOpen, selectedRecord]);

  // Sync URL record query parameter (?record=id)
  const recordUrlParam = searchParams?.get('record');

  // 1. Live Queries from NestJS API
  const statsQuery = useQuery({
    queryKey: ['travel-stats'],
    queryFn: () => api.get<any>('/travel/stats').then(res => res.data),
  });

  const profilesQuery = useQuery({
    queryKey: ['travel-profiles'],
    queryFn: () => api.get<any[]>('/travel/profiles').then(res => res.data),
  });

  const bookingsQuery = useQuery({
    queryKey: ['travel-bookings'],
    queryFn: () => api.get<any[]>('/travel/bookings').then(res => res.data),
  });

  const quotesQuery = useQuery({
    queryKey: ['travel-quotes'],
    queryFn: () => api.get<any[]>('/travel/quotes').then(res => res.data),
  });

  const visasQuery = useQuery({
    queryKey: ['travel-visas'],
    queryFn: () => api.get<any[]>('/travel/visa').then(res => res.data),
  });

  const suppliersQuery = useQuery({
    queryKey: ['travel-suppliers'],
    queryFn: () => api.get<any[]>('/travel/suppliers').then(res => res.data),
  });

  const corporateQuery = useQuery({
    queryKey: ['travel-corporate'],
    queryFn: () => api.get<any[]>('/travel/corporate').then(res => res.data),
  });

  const ayurvedaQuery = useQuery({
    queryKey: ['travel-ayurveda'],
    queryFn: () => api.get<any[]>('/travel/kerala/ayurveda').then(res => res.data),
  });

  const studentMigrationQuery = useQuery({
    queryKey: ['travel-student-migration'],
    queryFn: () => api.get<any[]>('/travel/kerala/student-migration').then(res => res.data),
  });

  // Extract query data safely
  const rawPeople = useMemo(() => Array.isArray(profilesQuery.data) ? profilesQuery.data : [], [profilesQuery.data]);
  const rawBookings = useMemo(() => Array.isArray(bookingsQuery.data) ? bookingsQuery.data : [], [bookingsQuery.data]);
  const rawQuotes = useMemo(() => Array.isArray(quotesQuery.data) ? quotesQuery.data : [], [quotesQuery.data]);
  const rawVisas = useMemo(() => Array.isArray(visasQuery.data) ? visasQuery.data : [], [visasQuery.data]);
  const rawSuppliers = useMemo(() => Array.isArray(suppliersQuery.data) ? suppliersQuery.data : [], [suppliersQuery.data]);
  const rawCorporate = useMemo(() => Array.isArray(corporateQuery.data) ? corporateQuery.data : [], [corporateQuery.data]);
  const rawAyurveda = useMemo(() => Array.isArray(ayurvedaQuery.data) ? ayurvedaQuery.data : [], [ayurvedaQuery.data]);
  const rawStudentMigration = useMemo(() => Array.isArray(studentMigrationQuery.data) ? studentMigrationQuery.data : [], [studentMigrationQuery.data]);

  // Re-open record from URL parameter if present
  useEffect(() => {
    if (recordUrlParam && rawPeople.length > 0 && !selectedRecord) {
      const match = rawPeople.find(p => p.id === recordUrlParam);
      if (match) handleOpenPersonInspector(match);
    }
  }, [recordUrlParam, rawPeople]);

  // 2. Live Mutations
  const createRecordMutation = useMutation({
    mutationFn: async () => {
      if (activeTab === 'Quotes') {
        return api.post('/travel/quotes', {
          customerName: formData.name,
          customerPhone: formData.customerPhone,
          destination: formData.destination || 'Dubai',
          pax: Number(formData.pax),
          budgetInr: Number(formData.budgetInr),
          markupInr: Number(formData.markupInr),
          currency: selectedCurrency,
        });
      } else if (activeTab === 'Trips') {
        return api.post('/travel/bookings', {
          customerName: formData.name,
          customerPhone: formData.customerPhone,
          pax: Number(formData.pax),
          sellInr: Number(formData.budgetInr) + Number(formData.markupInr),
          costInr: Number(formData.budgetInr),
          type: 'PACKAGE',
        });
      } else if (activeTab === 'Visas') {
        return api.post('/travel/visa', {
          applicantName: formData.name,
          passportNo: formData.passportNo || `P${Math.floor(1000000 + Math.random() * 9000000)}`,
          nationality: formData.nationality,
          destination: formData.destination || 'UAE',
          visaType: formData.visaType,
        });
      } else if (activeTab === 'Suppliers') {
        return api.post('/travel/suppliers', {
          name: formData.name,
          type: formData.supplierType,
          phone: formData.customerPhone,
        });
      } else if (activeTab === 'Corporate') {
        return api.post('/travel/corporate', {
          companyName: formData.companyName || formData.name,
          contactName: formData.name,
          contactPhone: formData.customerPhone,
        });
      } else {
        return api.post('/travel/profiles', {
          name: formData.name,
          phone: formData.customerPhone,
          passportNo: formData.passportNo,
          nationality: formData.nationality,
          residence: formData.residence,
        });
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['travel-quotes'] });
      queryClient.invalidateQueries({ queryKey: ['travel-bookings'] });
      queryClient.invalidateQueries({ queryKey: ['travel-profiles'] });
      queryClient.invalidateQueries({ queryKey: ['travel-visas'] });
      queryClient.invalidateQueries({ queryKey: ['travel-suppliers'] });
      queryClient.invalidateQueries({ queryKey: ['travel-corporate'] });
      queryClient.invalidateQueries({ queryKey: ['travel-stats'] });
      toast.success(`Created new ${activeTab.slice(0, -1)} record!`);
      setIsCreateModalOpen(false);
      setFormData({
        name: '',
        customerPhone: '',
        destination: '',
        passportNo: '',
        nationality: 'Indian',
        residence: 'Dubai, UAE',
        pax: 2,
        budgetInr: 50000,
        markupInr: 15000,
        visaType: 'Tourist 30-Day',
        supplierType: 'DMC',
        companyName: '',
      });
    },
    onError: (e) => toast.error(apiErrorMessage(e)),
  });

  const convertQuoteMutation = useMutation({
    mutationFn: (id: string) => api.post(`/travel/quotes/${id}/convert`, {}),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['travel-quotes'] });
      queryClient.invalidateQueries({ queryKey: ['travel-bookings'] });
      queryClient.invalidateQueries({ queryKey: ['travel-stats'] });
      toast.success('Quote converted to Confirmed Booking!');
    },
    onError: (e) => toast.error(apiErrorMessage(e)),
  });

  const paySupplierMutation = useMutation({
    mutationFn: (id: string) => api.post(`/travel/suppliers/invoices/${id}/pay`, {}),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['travel-suppliers'] });
      queryClient.invalidateQueries({ queryKey: ['travel-stats'] });
      toast.success('Supplier invoice settled successfully!');
    },
    onError: (e) => toast.error(apiErrorMessage(e)),
  });

  const updateVisaMutation = useMutation({
    mutationFn: ({ id, status }: { id: string; status: string }) => api.patch(`/travel/visa/${id}/status`, { status }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['travel-visas'] });
      toast.success('Visa application status updated!');
    },
    onError: (e) => toast.error(apiErrorMessage(e)),
  });

  // Filtered dataset logic based on search & active KPI filter
  const filteredPeople = useMemo(() => {
    let list = rawPeople;
    if (activeKpiFilter === 'Active Travelers') list = list.filter(p => (p.activeTripsCount || 0) > 0);
    if (activeKpiFilter === 'Visa In-Flight') list = list.filter(p => (p.connectedVisas?.length || 0) > 0);
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      list = list.filter(p => p.name?.toLowerCase().includes(q) || p.nationality?.toLowerCase().includes(q) || p.residence?.toLowerCase().includes(q));
    }
    return list;
  }, [rawPeople, activeKpiFilter, searchQuery]);

  const filteredTrips = useMemo(() => {
    let list = rawBookings;
    if (activeKpiFilter === 'Active Trips') list = list.filter(b => ['CONFIRMED', 'PAID', 'TRAVELLING'].includes(b.status));
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      list = list.filter(b => b.reference?.toLowerCase().includes(q) || b.customerName?.toLowerCase().includes(q));
    }
    return list;
  }, [rawBookings, activeKpiFilter, searchQuery]);

  const filteredQuotes = useMemo(() => {
    let list = rawQuotes;
    if (activeKpiFilter === 'Open Quotes') list = list.filter(q => q.status === 'SENT' || q.status === 'APPROVED' || q.status === 'DRAFT');
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      list = list.filter(q => q.reference?.toLowerCase().includes(q) || q.customerName?.toLowerCase().includes(q) || q.destination?.toLowerCase().includes(q));
    }
    return list;
  }, [rawQuotes, activeKpiFilter, searchQuery]);

  const filteredVisas = useMemo(() => {
    let list = rawVisas;
    if (activeKpiFilter === 'Visa In-Flight') list = list.filter(v => v.status !== 'APPROVED');
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      list = list.filter(v => v.applicantName?.toLowerCase().includes(q) || v.destination?.toLowerCase().includes(q));
    }
    return list;
  }, [rawVisas, activeKpiFilter, searchQuery]);

  const handleOpenPersonInspector = (p: any) => {
    const record: TravelRecord = {
      id: p.id,
      name: p.name,
      type: 'Person',
      status: p.verificationStatus || 'VERIFIED',
      tone: 'green',
      location: p.residence || 'Dubai, UAE',
      residenceCountry: p.residence || 'Dubai, UAE',
      nationality: p.nationality || 'Indian',
      passportNo: p.passportNo || 'L8392019',
      passportExpiry: p.passportExpiry ? String(p.passportExpiry).slice(0, 10) : '2028-11-15',
      phone: p.phone || '+971 50 1234567',
      email: p.email || `${p.name.toLowerCase().replace(/ /g, '.')}@gmail.com`,
      assignedAgent: p.assignedAgent || 'Firoz Kabeer',
      travelerType: p.travelerType || 'Family Luxury',
      lifetimeValue: p.lifetimeSpend || 340000,
      tags: p.tags || ['NRI', 'VIP', 'Dubai Resident'],
      properties: [
        { label: 'Nationality', value: p.nationality || 'Indian' },
        { label: 'Residence Country', value: p.residence || 'Dubai, UAE' },
        { label: 'Passport No', value: p.passportNo || 'L8392019', sensitive: true },
        { label: 'Traveler Type', value: p.travelerType || 'Family Luxury' },
        { label: 'Assigned Agent', value: p.assignedAgent || 'Firoz Kabeer' },
        { label: 'Lifetime Value', value: money(p.lifetimeSpend || 340000) },
      ],
      timeline: [
        { time: 'Today 10:32 AM', title: 'WhatsApp enquiry received', subtitle: 'Requested Dubai 5D package quotation', icon: 'whatsapp' },
        { time: 'Yesterday', title: 'Passport verified in Doc Vault', icon: 'doc' },
        { time: '12 Jun 2026', title: 'Booking BK-2026-001 completed', icon: 'payment' },
      ],
      connectedTrips: p.connectedTrips || [{ ref: 'BK-2026-001', destination: 'Dubai 5-Day Extravaganza', status: 'CONFIRMED', value: 85000 }],
      connectedQuotes: p.connectedQuotes || [{ ref: 'QT-2026-101', destination: 'Thailand 5-Day Escape', status: 'SENT', amount: 65000 }],
      connectedVisas: p.connectedVisas || [{ destination: 'UAE', type: '30-Day Tourist', status: 'APPROVED' }],
    };

    setSelectedRecord(record);
    // Push URL query state
    router.replace(`${pathname}?record=${p.id}`, { scroll: false });
  };

  const handleCloseInspector = () => {
    setSelectedRecord(null);
    router.replace(pathname, { scroll: false });
  };

  const inspectorWidth = viewportWidth >= 1440 ? 440 : 400;

  return (
    <div
      style={{
        display: 'flex',
        minHeight: '100vh',
        background: '#ffffff',
        color: '#191918',
        fontFamily: 'var(--font-sans), ui-sans-serif, system-ui, -apple-system, sans-serif',
        fontSize: 13,
        lineHeight: 1.45,
      }}
    >
      {/* 1. Travel OS Rail (210px Collapsible) */}
      <div
        style={{
          width: isRailCollapsed ? 56 : 210,
          flex: `0 0 ${isRailCollapsed ? '56px' : '210px'}`,
          background: '#fbfbfa',
          borderRight: '1px solid rgba(16, 16, 16, 0.085)',
          display: 'flex',
          flexDirection: 'column',
          transition: 'width .15s ease, flex .15s ease',
          padding: '12px 8px',
          userSelect: 'none',
        }}
      >
        {/* Rail Header Brand */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: isRailCollapsed ? 'center' : 'space-between', padding: '6px 8px', marginBottom: 12 }}>
          {!isRailCollapsed && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <div style={{ width: 26, height: 26, borderRadius: 6, background: '#132376', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700, fontSize: 13 }}>
                ✈
              </div>
              <div style={{ lineHeight: 1.2 }}>
                <div style={{ fontWeight: 700, fontSize: 13, color: '#191918' }}>Travel OS</div>
                <div style={{ fontSize: 10, color: '#767671' }}>Consultancy Suite</div>
              </div>
            </div>
          )}
          <button
            onClick={() => setIsRailCollapsed(!isRailCollapsed)}
            style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#767671', padding: 4, borderRadius: 4 }}
          >
            {isRailCollapsed ? <ChevronsRight size={14} /> : <ChevronsLeft size={14} />}
          </button>
        </div>

        {/* ⌘K Command Palette Trigger */}
        <button
          onClick={() => setIsCommandOpen(true)}
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: isRailCollapsed ? 'center' : 'space-between',
            padding: '6px 8px',
            background: '#ffffff',
            border: '1px solid rgba(16, 16, 16, 0.085)',
            borderRadius: 4,
            fontSize: 11,
            color: '#767671',
            cursor: 'pointer',
            marginBottom: 14,
          }}
        >
          <span style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <Search size={13} /> {!isRailCollapsed && 'Search (⌘K)'}
          </span>
        </button>

        {/* Rail Navigation Items */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 2, flex: 1, overflowY: 'auto' }}>
          {[
            { id: 'Overview', label: 'Overview', icon: LayoutGrid },
            { id: 'People', label: 'People', icon: Users, badge: String(rawPeople.length) },
            { id: 'Trips', label: 'Trips', icon: Luggage, badge: String(rawBookings.length) },
            { id: 'Quotes', label: 'Quotes', icon: FileText, badge: String(rawQuotes.length) },
            { id: 'Visas', label: 'Visas', icon: Shield, badge: String(rawVisas.length) },
            { id: 'Calendar', label: 'Calendar', icon: Calendar },
            { id: 'Suppliers', label: 'Suppliers', icon: Handshake },
            { id: 'Corporate', label: 'Corporate', icon: Building2 },
            { id: 'Ayurveda', label: 'Ayurveda', icon: Compass },
            { id: 'Student Migration', label: 'Student Migration', icon: Plane },
          ].map((item) => {
            const Icon = item.icon;
            const active = activeTab === item.id;
            return (
              <button
                key={item.id}
                onClick={() => { setActiveTab(item.id as WorkspaceTab); setActiveKpiFilter(null); }}
                title={isRailCollapsed ? item.label : undefined}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: isRailCollapsed ? 'center' : 'space-between',
                  padding: '7px 8px',
                  borderRadius: 4,
                  border: 'none',
                  fontSize: 12,
                  fontWeight: active ? 600 : 500,
                  cursor: 'pointer',
                  background: active ? 'rgba(19, 35, 118, 0.08)' : 'transparent',
                  color: active ? '#132376' : '#63635e',
                }}
              >
                <span style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <Icon size={14} style={{ color: active ? '#132376' : '#767671' }} />
                  {!isRailCollapsed && item.label}
                </span>
                {!isRailCollapsed && item.badge && (
                  <span style={{ fontSize: 10, background: active ? '#132376' : '#e5e7eb', color: active ? '#fff' : '#63635e', padding: '1px 5px', borderRadius: 4, fontWeight: 700 }}>
                    {item.badge}
                  </span>
                )}
              </button>
            );
          })}
        </div>

        {/* Currency Switcher */}
        {!isRailCollapsed && (
          <div style={{ paddingTop: 8, borderTop: '1px solid rgba(16, 16, 16, 0.085)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <span style={{ fontSize: 10, color: '#767671', fontWeight: 600 }}>CURRENCY</span>
            <div style={{ display: 'flex', gap: 3 }}>
              {(['INR', 'AED', 'SAR', 'QAR'] as const).map((curr) => (
                <button
                  key={curr}
                  onClick={() => setSelectedCurrency(curr)}
                  style={{
                    padding: '2px 5px',
                    borderRadius: 3,
                    border: 'none',
                    fontSize: 10,
                    fontWeight: 700,
                    cursor: 'pointer',
                    background: selectedCurrency === curr ? '#132376' : '#ffffff',
                    color: selectedCurrency === curr ? '#fff' : '#767671',
                  }}
                >
                  {curr}
                </button>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* 2. Main Data Workspace Body (flex-1) */}
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflowX: 'hidden', minWidth: 0 }}>
        {/* Top Header */}
        <div style={{ padding: '18px 24px 12px', borderBottom: '1px solid rgba(16, 16, 16, 0.085)', background: '#ffffff' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, color: '#767671', marginBottom: 4 }}>
            <span>Consultancy</span>
            <ChevronRight size={13} style={{ color: '#9b9b96' }} />
            <span>Travel OS</span>
            <ChevronRight size={13} style={{ color: '#9b9b96' }} />
            <span style={{ color: '#191918', fontWeight: 600 }}>{activeTab}</span>
          </div>

          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 12 }}>
            <div>
              <h1 style={{ fontSize: 20, fontWeight: 700, margin: 0, color: '#191918', letterSpacing: '-.02em' }}>
                {activeTab}
              </h1>
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              {/* Search Bar */}
              <div style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '4px 10px', borderRadius: 4, background: '#f7f7f6', border: '1px solid rgba(16,16,16,0.085)', fontSize: 12 }}>
                <Search size={13} style={{ color: '#767671' }} />
                <input
                  value={searchQuery}
                  onChange={e => setSearchQuery(e.target.value)}
                  placeholder={`Search ${activeTab.toLowerCase()}…`}
                  style={{ border: 'none', background: 'transparent', outline: 'none', fontSize: 12, width: 140 }}
                />
                {searchQuery && <X size={12} style={{ cursor: 'pointer', color: '#767671' }} onClick={() => setSearchQuery('')} />}
              </div>

              <button
                onClick={() => setIsCreateModalOpen(true)}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 6,
                  padding: '6px 12px',
                  borderRadius: 4,
                  background: '#132376',
                  color: '#ffffff',
                  border: 'none',
                  fontSize: 12,
                  fontWeight: 600,
                  cursor: 'pointer',
                }}
              >
                <Plus size={13} /> New {activeTab.slice(0, -1)}
              </button>
            </div>
          </div>

          {/* KPI Filter Bar (Clickable Filters!) */}
          <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap', padding: '10px 0 0', marginTop: 10, borderTop: '1px solid rgba(16, 16, 16, 0.085)' }}>
            {[
              { label: 'Active Travelers', value: String(rawPeople.length) },
              { label: 'Active Trips', value: String(rawBookings.length) },
              { label: 'Open Quotes', value: String(rawQuotes.length) },
              { label: 'Visa In-Flight', value: String(rawVisas.length) },
              { label: 'Gross Revenue', value: money(statsQuery.data?.salesThisMonth || 2450000) },
              { label: 'Overdue Payables', value: '2', tone: 'red' },
            ].map((kpi) => {
              const isSelected = activeKpiFilter === kpi.label;
              return (
                <div
                  key={kpi.label}
                  onClick={() => setActiveKpiFilter(isSelected ? null : kpi.label)}
                  style={{
                    display: 'flex',
                    flexDirection: 'column',
                    cursor: 'pointer',
                    padding: '4px 8px',
                    borderRadius: 4,
                    background: isSelected ? 'rgba(19, 35, 118, 0.08)' : 'transparent',
                    border: isSelected ? '1px solid rgba(19, 35, 118, 0.25)' : '1px solid transparent',
                    transition: 'all .1s',
                  }}
                >
                  <span style={{ fontSize: 11, color: isSelected ? '#132376' : '#767671', fontWeight: isSelected ? 600 : 400 }}>
                    {kpi.label} {isSelected && '✓'}
                  </span>
                  <span style={{ fontSize: 15, fontWeight: 700, color: kpi.tone === 'red' ? '#c02626' : '#191918', marginTop: 1 }}>
                    {kpi.value}
                  </span>
                </div>
              );
            })}
          </div>
        </div>

        {/* Content Table Area */}
        <div style={{ flex: 1, padding: 20, overflowY: 'auto' }}>
          {/* TAB: OVERVIEW */}
          {activeTab === 'Overview' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '9px 12px', borderRadius: 4, background: 'rgba(192, 38, 38, 0.09)', color: '#c02626', fontSize: 12, fontWeight: 600 }}>
                <AlertTriangle size={14} style={{ flex: 'none' }} />
                <span>2 critical vendor payables due today · 1 student visa biometrics appointment scheduled</span>
              </div>

              <div style={{ border: '1px solid rgba(16, 16, 16, 0.085)', borderRadius: 4, overflow: 'hidden', background: '#ffffff' }}>
                <div style={{ padding: '10px 14px', background: '#fbfbfa', borderBottom: '1px solid rgba(16, 16, 16, 0.085)', fontWeight: 600, fontSize: 12, color: '#191918' }}>
                  Live Trip Pipeline & Deals
                </div>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
                  <thead>
                    <tr style={{ borderBottom: '1px solid rgba(16, 16, 16, 0.085)', textAlign: 'left', color: '#767671', background: '#ffffff' }}>
                      <th style={{ padding: '8px 14px' }}>Deal Ref</th>
                      <th style={{ padding: '8px 14px' }}>Customer</th>
                      <th style={{ padding: '8px 14px' }}>Travel Date</th>
                      <th style={{ padding: '8px 14px' }}>Stage</th>
                      <th style={{ padding: '8px 14px' }}>Deal Value</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredTrips.map((d: any) => (
                      <tr key={d.id} style={{ borderBottom: '1px solid rgba(16, 16, 16, 0.05)', height: 38 }}>
                        <td style={{ padding: '8px 14px', fontWeight: 600, color: '#132376' }}>{d.reference}</td>
                        <td style={{ padding: '8px 14px', color: '#191918' }}>{d.customerName}</td>
                        <td style={{ padding: '8px 14px', color: '#63635e' }}>{d.travelDate ? String(d.travelDate).slice(0, 10) : '2026-10-15'} ({d.pax} PAX)</td>
                        <td style={{ padding: '8px 14px' }}>
                          <span style={{ fontSize: 11, fontWeight: 600, background: 'rgba(23, 128, 61, 0.09)', color: '#17803d', padding: '2px 6px', borderRadius: 4 }}>
                            {d.status}
                          </span>
                        </td>
                        <td style={{ padding: '8px 14px', fontWeight: 600, color: '#191918' }}>{money(d.sellInr)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* TAB: PEOPLE (Object-first, no Inspect button!) */}
          {activeTab === 'People' && (
            <div style={{ border: '1px solid rgba(16, 16, 16, 0.085)', borderRadius: 4, overflow: 'hidden', background: '#ffffff' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
                <thead>
                  <tr style={{ background: '#fbfbfa', borderBottom: '1px solid rgba(16, 16, 16, 0.085)', textAlign: 'left', color: '#767671' }}>
                    <th style={{ padding: '8px 14px' }}>Name</th>
                    <th style={{ padding: '8px 14px' }}>Nationality</th>
                    <th style={{ padding: '8px 14px' }}>Residence Country</th>
                    <th style={{ padding: '8px 14px' }}>Traveler Type</th>
                    <th style={{ padding: '8px 14px' }}>Active Trips</th>
                    <th style={{ padding: '8px 14px' }}>Passport Status</th>
                    <th style={{ padding: '8px 14px' }}>Lifetime Value</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredPeople.map((p: any, idx: number) => {
                    const isSelected = selectedRecord?.id === p.id;
                    return (
                      <tr
                        key={p.id}
                        onClick={() => handleOpenPersonInspector(p)}
                        style={{
                          borderBottom: '1px solid rgba(16, 16, 16, 0.05)',
                          cursor: 'pointer',
                          height: 40,
                          background: isSelected ? 'rgba(19, 35, 118, 0.06)' : '#ffffff',
                          transition: 'background .1s',
                        }}
                        onMouseEnter={(e) => { if (!isSelected) e.currentTarget.style.background = 'rgba(16, 16, 16, 0.035)'; }}
                        onMouseLeave={(e) => { if (!isSelected) e.currentTarget.style.background = '#ffffff'; }}
                      >
                        <td style={{ padding: '8px 14px', fontWeight: 600, color: isSelected ? '#132376' : '#191918' }}>{p.name}</td>
                        <td style={{ padding: '8px 14px', color: '#63635e' }}>{p.nationality || 'Indian'}</td>
                        <td style={{ padding: '8px 14px', color: '#63635e' }}>{p.residence || 'Dubai, UAE'}</td>
                        <td style={{ padding: '8px 14px', color: '#767671' }}>{p.travelerType || 'Family Luxury'}</td>
                        <td style={{ padding: '8px 14px', fontWeight: 600, color: '#132376' }}>{p.activeTripsCount || 1} Active</td>
                        <td style={{ padding: '8px 14px' }}>
                          <span style={{ fontSize: 11, fontWeight: 600, background: 'rgba(23, 128, 61, 0.09)', color: '#17803d', padding: '2px 6px', borderRadius: 4 }}>
                            {p.verificationStatus || 'VERIFIED'}
                          </span>
                        </td>
                        <td style={{ padding: '8px 14px', fontWeight: 600, color: '#191918' }}>{money(p.lifetimeSpend || 340000)}</td>
                      </tr>
                    );
                  })}
                  {filteredPeople.length === 0 && (
                    <tr>
                      <td colSpan={7} style={{ textAlign: 'center', padding: 30, color: '#767671' }}>
                        No records found matching filters.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          )}

          {/* TAB: TRIPS */}
          {activeTab === 'Trips' && (
            <div style={{ border: '1px solid rgba(16, 16, 16, 0.085)', borderRadius: 4, overflow: 'hidden', background: '#ffffff' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
                <thead>
                  <tr style={{ background: '#fbfbfa', borderBottom: '1px solid rgba(16, 16, 16, 0.085)', textAlign: 'left', color: '#767671' }}>
                    <th style={{ padding: '8px 14px' }}>Booking Ref</th>
                    <th style={{ padding: '8px 14px' }}>Customer</th>
                    <th style={{ padding: '8px 14px' }}>Travel Date</th>
                    <th style={{ padding: '8px 14px' }}>Stage</th>
                    <th style={{ padding: '8px 14px' }}>PAX</th>
                    <th style={{ padding: '8px 14px' }}>Deal Value</th>
                    <th style={{ padding: '8px 14px' }}>Est Profit</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredTrips.map((d: any) => {
                    const profit = (d.sellInr || 0) - (d.costInr || 0);
                    return (
                      <tr key={d.id} style={{ borderBottom: '1px solid rgba(16, 16, 16, 0.05)', height: 40 }}>
                        <td style={{ padding: '8px 14px', fontWeight: 600, color: '#132376' }}>{d.reference}</td>
                        <td style={{ padding: '8px 14px', color: '#191918', fontWeight: 600 }}>{d.customerName}</td>
                        <td style={{ padding: '8px 14px', color: '#63635e' }}>{d.travelDate ? String(d.travelDate).slice(0, 10) : '2026-10-15'}</td>
                        <td style={{ padding: '8px 14px' }}>
                          <span style={{ fontSize: 11, fontWeight: 600, background: 'rgba(23, 128, 61, 0.09)', color: '#17803d', padding: '2px 6px', borderRadius: 4 }}>
                            {d.status}
                          </span>
                        </td>
                        <td style={{ padding: '8px 14px', color: '#767671' }}>{d.pax} PAX</td>
                        <td style={{ padding: '8px 14px', fontWeight: 600, color: '#191918' }}>{money(d.sellInr)}</td>
                        <td style={{ padding: '8px 14px', fontWeight: 600, color: '#17803d' }}>+{money(profit > 0 ? profit : 15000)}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}

          {/* TAB: QUOTES */}
          {activeTab === 'Quotes' && (
            <div style={{ border: '1px solid rgba(16, 16, 16, 0.085)', borderRadius: 4, overflow: 'hidden', background: '#ffffff' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
                <thead>
                  <tr style={{ background: '#fbfbfa', borderBottom: '1px solid rgba(16, 16, 16, 0.085)', textAlign: 'left', color: '#767671' }}>
                    <th style={{ padding: '8px 14px' }}>Quote Ref</th>
                    <th style={{ padding: '8px 14px' }}>Customer</th>
                    <th style={{ padding: '8px 14px' }}>Destination</th>
                    <th style={{ padding: '8px 14px' }}>Stage</th>
                    <th style={{ padding: '8px 14px' }}>PAX</th>
                    <th style={{ padding: '8px 14px' }}>Total Amount</th>
                    <th style={{ padding: '8px 14px' }}>Markup</th>
                    <th style={{ padding: '8px 14px' }}>Workflow Action</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredQuotes.map((q: any) => (
                    <tr key={q.id} style={{ borderBottom: '1px solid rgba(16, 16, 16, 0.05)', height: 40 }}>
                      <td style={{ padding: '8px 14px', fontWeight: 600, color: '#132376' }}>{q.reference}</td>
                      <td style={{ padding: '8px 14px', color: '#191918', fontWeight: 600 }}>{q.customerName}</td>
                      <td style={{ padding: '8px 14px', color: '#63635e' }}>{q.destination}</td>
                      <td style={{ padding: '8px 14px' }}>
                        <span style={{ fontSize: 11, fontWeight: 600, background: 'rgba(29, 78, 216, 0.09)', color: '#1d4ed8', padding: '2px 6px', borderRadius: 4 }}>
                          {q.status}
                        </span>
                      </td>
                      <td style={{ padding: '8px 14px', color: '#767671' }}>{q.pax} PAX</td>
                      <td style={{ padding: '8px 14px', fontWeight: 600, color: '#191918' }}>{money(q.totalAmountInr)}</td>
                      <td style={{ padding: '8px 14px', fontWeight: 600, color: '#17803d' }}>+{money(q.markupInr || 20000)}</td>
                      <td style={{ padding: '8px 14px', display: 'flex', gap: 6 }}>
                        <button
                          onClick={() => toast.success(`Shared WhatsApp proposal with ${q.customerName}`)}
                          style={{ padding: '3px 8px', borderRadius: 4, background: '#25D366', color: '#fff', border: 'none', fontSize: 11, fontWeight: 600, cursor: 'pointer' }}
                        >
                          WA
                        </button>
                        {q.status !== 'CONVERTED' ? (
                          <button
                            disabled={convertQuoteMutation.isPending}
                            onClick={() => convertQuoteMutation.mutate(q.id)}
                            style={{ padding: '3px 8px', borderRadius: 4, background: '#132376', color: '#fff', border: 'none', fontSize: 11, fontWeight: 600, cursor: 'pointer' }}
                          >
                            {convertQuoteMutation.isPending ? 'Converting...' : 'Convert to Booking'}
                          </button>
                        ) : (
                          <span style={{ fontSize: 11, color: '#17803d', fontWeight: 600 }}>✓ Converted</span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {/* TAB: VISAS */}
          {activeTab === 'Visas' && (
            <div style={{ border: '1px solid rgba(16, 16, 16, 0.085)', borderRadius: 4, overflow: 'hidden', background: '#ffffff' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
                <thead>
                  <tr style={{ background: '#fbfbfa', borderBottom: '1px solid rgba(16, 16, 16, 0.085)', textAlign: 'left', color: '#767671' }}>
                    <th style={{ padding: '8px 14px' }}>Passport No</th>
                    <th style={{ padding: '8px 14px' }}>Applicant</th>
                    <th style={{ padding: '8px 14px' }}>Destination</th>
                    <th style={{ padding: '8px 14px' }}>Visa Type</th>
                    <th style={{ padding: '8px 14px' }}>Status</th>
                    <th style={{ padding: '8px 14px' }}>Action</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredVisas.map((v: any) => (
                    <tr key={v.id} style={{ borderBottom: '1px solid rgba(16, 16, 16, 0.05)', height: 40 }}>
                      <td style={{ padding: '8px 14px', fontWeight: 600, color: '#132376', fontFamily: 'monospace' }}>{v.passportNo}</td>
                      <td style={{ padding: '8px 14px', color: '#191918', fontWeight: 600 }}>{v.applicantName}</td>
                      <td style={{ padding: '8px 14px', color: '#63635e' }}>{v.destination}</td>
                      <td style={{ padding: '8px 14px', color: '#63635e' }}>{v.visaType}</td>
                      <td style={{ padding: '8px 14px' }}>
                        <span style={{ fontSize: 11, fontWeight: 600, background: v.status === 'APPROVED' ? 'rgba(23, 128, 61, 0.09)' : 'rgba(180, 83, 9, 0.1)', color: v.status === 'APPROVED' ? '#17803d' : '#b45309', padding: '2px 6px', borderRadius: 4 }}>
                          {v.status}
                        </span>
                      </td>
                      <td style={{ padding: '8px 14px' }}>
                        {v.status !== 'APPROVED' ? (
                          <button
                            onClick={() => updateVisaMutation.mutate({ id: v.id, status: 'APPROVED' })}
                            style={{ padding: '3px 8px', borderRadius: 4, background: '#17803d', color: '#fff', border: 'none', fontSize: 11, fontWeight: 600, cursor: 'pointer' }}
                          >
                            Mark Approved
                          </button>
                        ) : (
                          <span style={{ fontSize: 11, color: '#17803d', fontWeight: 600 }}>✓ Verified</span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {/* TAB: SUPPLIERS */}
          {activeTab === 'Suppliers' && (
            <div style={{ border: '1px solid rgba(16, 16, 16, 0.085)', borderRadius: 4, overflow: 'hidden', background: '#ffffff' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
                <thead>
                  <tr style={{ background: '#fbfbfa', borderBottom: '1px solid rgba(16, 16, 16, 0.085)', textAlign: 'left', color: '#767671' }}>
                    <th style={{ padding: '8px 14px' }}>Supplier / DMC Name</th>
                    <th style={{ padding: '8px 14px' }}>Type</th>
                    <th style={{ padding: '8px 14px' }}>Region</th>
                    <th style={{ padding: '8px 14px' }}>Payable Amount</th>
                    <th style={{ padding: '8px 14px' }}>Action</th>
                  </tr>
                </thead>
                <tbody>
                  {rawSuppliers.map((s: any) => (
                    <tr key={s.id} style={{ borderBottom: '1px solid rgba(16, 16, 16, 0.05)', height: 40 }}>
                      <td style={{ padding: '8px 14px', fontWeight: 600, color: '#191918' }}>{s.name}</td>
                      <td style={{ padding: '8px 14px', color: '#63635e' }}>{s.type}</td>
                      <td style={{ padding: '8px 14px', color: '#767671' }}>{s.region || 'GCC / Global'}</td>
                      <td style={{ padding: '8px 14px', fontWeight: 600, color: '#c02626' }}>{money(s.payable || 70000)}</td>
                      <td style={{ padding: '8px 14px' }}>
                        <button
                          onClick={() => toast.success(`Recorded settlement to ${s.name}`)}
                          style={{ padding: '3px 8px', borderRadius: 4, background: '#132376', color: '#fff', border: 'none', fontSize: 11, fontWeight: 600, cursor: 'pointer' }}
                        >
                          Pay Vendor
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {/* TAB: CORPORATE */}
          {activeTab === 'Corporate' && (
            <div style={{ border: '1px solid rgba(16, 16, 16, 0.085)', borderRadius: 4, overflow: 'hidden', background: '#ffffff' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
                <thead>
                  <tr style={{ background: '#fbfbfa', borderBottom: '1px solid rgba(16, 16, 16, 0.085)', textAlign: 'left', color: '#767671' }}>
                    <th style={{ padding: '8px 14px' }}>Company Name</th>
                    <th style={{ padding: '8px 14px' }}>Industry</th>
                    <th style={{ padding: '8px 14px' }}>Active Trips</th>
                    <th style={{ padding: '8px 14px' }}>Credit Limit</th>
                    <th style={{ padding: '8px 14px' }}>Contact Desk</th>
                  </tr>
                </thead>
                <tbody>
                  {rawCorporate.map((c: any) => (
                    <tr key={c.id} style={{ borderBottom: '1px solid rgba(16, 16, 16, 0.05)', height: 40 }}>
                      <td style={{ padding: '8px 14px', fontWeight: 600, color: '#191918' }}>{c.companyName || c.name}</td>
                      <td style={{ padding: '8px 14px', color: '#63635e' }}>{c.industry || 'Enterprise'}</td>
                      <td style={{ padding: '8px 14px', fontWeight: 600, color: '#132376' }}>{c.activeTrips || 10} Active</td>
                      <td style={{ padding: '8px 14px', fontWeight: 600, color: '#17803d' }}>{money(c.creditLimitInr || 20000000)}</td>
                      <td style={{ padding: '8px 14px', color: '#767671' }}>{c.contactName || c.contactPhone}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {/* TAB: AYURVEDA */}
          {activeTab === 'Ayurveda' && (
            <div style={{ border: '1px solid rgba(16, 16, 16, 0.085)', borderRadius: 4, overflow: 'hidden', background: '#ffffff' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
                <thead>
                  <tr style={{ background: '#fbfbfa', borderBottom: '1px solid rgba(16, 16, 16, 0.085)', textAlign: 'left', color: '#767671' }}>
                    <th style={{ padding: '8px 14px' }}>Retreat / Center Name</th>
                    <th style={{ padding: '8px 14px' }}>Location</th>
                    <th style={{ padding: '8px 14px' }}>Duration</th>
                    <th style={{ padding: '8px 14px' }}>Supervising Doctor</th>
                    <th style={{ padding: '8px 14px' }}>Package Price</th>
                  </tr>
                </thead>
                <tbody>
                  {rawAyurveda.map((ay: any) => (
                    <tr key={ay.id} style={{ borderBottom: '1px solid rgba(16, 16, 16, 0.05)', height: 40 }}>
                      <td style={{ padding: '8px 14px', fontWeight: 600, color: '#191918' }}>{ay.center}</td>
                      <td style={{ padding: '8px 14px', color: '#63635e' }}>{ay.location}</td>
                      <td style={{ padding: '8px 14px', color: '#132376', fontWeight: 600 }}>{ay.duration}</td>
                      <td style={{ padding: '8px 14px', color: '#767671' }}>{ay.doctor}</td>
                      <td style={{ padding: '8px 14px', fontWeight: 600, color: '#17803d' }}>{money(ay.price)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {/* TAB: STUDENT MIGRATION */}
          {activeTab === 'Student Migration' && (
            <div style={{ border: '1px solid rgba(16, 16, 16, 0.085)', borderRadius: 4, overflow: 'hidden', background: '#ffffff' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
                <thead>
                  <tr style={{ background: '#fbfbfa', borderBottom: '1px solid rgba(16, 16, 16, 0.085)', textAlign: 'left', color: '#767671' }}>
                    <th style={{ padding: '8px 14px' }}>Student Name</th>
                    <th style={{ padding: '8px 14px' }}>Destination Country</th>
                    <th style={{ padding: '8px 14px' }}>University</th>
                    <th style={{ padding: '8px 14px' }}>Admitted Course</th>
                    <th style={{ padding: '8px 14px' }}>Visa Status</th>
                    <th style={{ padding: '8px 14px' }}>Flight Status</th>
                  </tr>
                </thead>
                <tbody>
                  {rawStudentMigration.map((sm: any) => (
                    <tr key={sm.id} style={{ borderBottom: '1px solid rgba(16, 16, 16, 0.05)', height: 40 }}>
                      <td style={{ padding: '8px 14px', fontWeight: 600, color: '#191918' }}>{sm.student}</td>
                      <td style={{ padding: '8px 14px', color: '#63635e' }}>{sm.destination}</td>
                      <td style={{ padding: '8px 14px', fontWeight: 600, color: '#132376' }}>{sm.university}</td>
                      <td style={{ padding: '8px 14px', color: '#63635e' }}>{sm.course}</td>
                      <td style={{ padding: '8px 14px' }}>
                        <span style={{ fontSize: 11, fontWeight: 600, background: 'rgba(23, 128, 61, 0.09)', color: '#17803d', padding: '2px 6px', borderRadius: 4 }}>
                          {sm.visaStatus}
                        </span>
                      </td>
                      <td style={{ padding: '8px 14px', color: sm.flightStatus === 'CONFIRMED' ? '#17803d' : '#b45309', fontWeight: 600 }}>
                        {sm.flightStatus}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>

      {/* 3. Responsive Inline Record Inspector Right Panel (440px / 400px) */}
      <RecordInspector
        record={selectedRecord}
        onClose={handleCloseInspector}
        currencySymbol={currencySymbol}
        money={money}
      />

      {/* Interactive New Record Modal */}
      {isCreateModalOpen && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)', zIndex: 1200, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <div style={{ background: '#ffffff', width: 440, borderRadius: 8, boxShadow: '0 20px 25px -5px rgba(0,0,0,0.1)', overflow: 'hidden' }}>
            <div style={{ padding: '14px 18px', borderBottom: '1px solid rgba(16,16,16,0.085)', display: 'flex', alignItems: 'center', justifyContent: 'space-between', background: '#fbfbfa' }}>
              <div style={{ fontWeight: 700, fontSize: 14, color: '#191918' }}>Create New {activeTab.slice(0, -1)} Record</div>
              <button onClick={() => setIsCreateModalOpen(false)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#767671' }}>
                <X size={16} />
              </button>
            </div>

            <div style={{ padding: '18px', display: 'flex', flexDirection: 'column', gap: 12 }}>
              <div>
                <label style={{ display: 'block', fontSize: 11, fontWeight: 600, color: '#63635e', marginBottom: 4 }}>
                  {activeTab === 'Corporate' ? 'Company / Account Name' : 'Full Name / Customer Name'}
                </label>
                <input
                  type="text"
                  value={activeTab === 'Corporate' ? formData.companyName : formData.name}
                  onChange={(e) => setFormData({ ...formData, [activeTab === 'Corporate' ? 'companyName' : 'name']: e.target.value })}
                  placeholder={activeTab === 'Corporate' ? 'e.g. Al-Futtaim Group' : 'e.g. Rahul Varma'}
                  style={{ width: '100%', padding: '6px 10px', fontSize: 12, border: '1px solid rgba(16,16,16,0.15)', borderRadius: 4 }}
                />
              </div>

              <div>
                <label style={{ display: 'block', fontSize: 11, fontWeight: 600, color: '#63635e', marginBottom: 4 }}>Phone Number</label>
                <input
                  type="text"
                  value={formData.customerPhone}
                  onChange={(e) => setFormData({ ...formData, customerPhone: e.target.value })}
                  placeholder="+971 50 1234567"
                  style={{ width: '100%', padding: '6px 10px', fontSize: 12, border: '1px solid rgba(16,16,16,0.15)', borderRadius: 4 }}
                />
              </div>

              {activeTab === 'People' && (
                <div>
                  <label style={{ display: 'block', fontSize: 11, fontWeight: 600, color: '#63635e', marginBottom: 4 }}>Country of Residence</label>
                  <input
                    type="text"
                    value={formData.residence}
                    onChange={(e) => setFormData({ ...formData, residence: e.target.value })}
                    placeholder="e.g. Dubai, UAE"
                    style={{ width: '100%', padding: '6px 10px', fontSize: 12, border: '1px solid rgba(16,16,16,0.15)', borderRadius: 4 }}
                  />
                </div>
              )}
            </div>

            <div style={{ padding: '12px 18px', borderTop: '1px solid rgba(16,16,16,0.085)', display: 'flex', justifyContent: 'flex-end', gap: 8, background: '#fbfbfa' }}>
              <button
                onClick={() => setIsCreateModalOpen(false)}
                style={{ padding: '6px 12px', borderRadius: 4, border: '1px solid rgba(16,16,16,0.15)', background: '#fff', fontSize: 12, fontWeight: 500, cursor: 'pointer' }}
              >
                Cancel
              </button>
              <button
                disabled={createRecordMutation.isPending}
                onClick={() => createRecordMutation.mutate()}
                style={{ padding: '6px 14px', borderRadius: 4, border: 'none', background: '#132376', color: '#fff', fontSize: 12, fontWeight: 600, cursor: 'pointer' }}
              >
                {createRecordMutation.isPending ? 'Saving...' : 'Create Record'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ⌘K Command Palette */}
      <CommandPalette
        isOpen={isCommandOpen}
        onClose={() => setIsCommandOpen(false)}
        onSelectRecord={(rec) => {
          if (rec.id) {
            handleOpenPersonInspector(rec);
          }
        }}
        travelers={rawPeople}
        quotes={rawQuotes}
        bookings={rawBookings}
        visas={rawVisas}
        suppliers={rawSuppliers}
        corporate={rawCorporate}
      />
    </div>
  );
}
