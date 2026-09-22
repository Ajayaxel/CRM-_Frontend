'use client';

import { useState } from 'react';
import { User, Users, Luggage, FileText, Shield, CreditCard, ArrowRight, Building2, Layers } from 'lucide-react';
import { toast } from 'sonner';

interface Props {
  currencySymbol?: string;
}

export function RelationshipGraph({ currencySymbol = '₹' }: Props) {
  const [selectedNode, setSelectedNode] = useState<string>('customer');

  return (
    <div style={{ background: '#ffffff', border: '1px solid #E2E8F0', borderRadius: 12, padding: 24 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
        <div>
          <h3 style={{ fontSize: 18, fontWeight: 700, margin: 0, color: '#0F172A' }}>🕸️ BMN Connect Business Relationship Graph</h3>
          <div style={{ fontSize: 12, color: '#64748B', marginTop: 4 }}>Visualizing interconnected object relationships (Customer → Family → Trips → Visas → Payments)</div>
        </div>
        <span style={{ fontSize: 11, background: '#EEF2FF', color: '#4F46E5', padding: '4px 10px', borderRadius: 20, fontWeight: 600 }}>
          Interactive Object Node View
        </span>
      </div>

      {/* Relationship Graph Pipeline Visualizer */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: 16, background: '#F8FAFC', padding: 20, borderRadius: 12, border: '1px solid #E2E8F0', position: 'relative' }}>
        {/* Node 1: Customer */}
        <div
          onClick={() => {
            setSelectedNode('customer');
            toast.info('Node selected: Traveler Customer');
          }}
          style={{
            background: selectedNode === 'customer' ? '#EEF2FF' : '#ffffff',
            border: selectedNode === 'customer' ? '2px solid #4F46E5' : '1px solid #CBD5E1',
            borderRadius: 10,
            padding: 16,
            cursor: 'pointer',
            textAlign: 'center',
            boxShadow: selectedNode === 'customer' ? '0 4px 12px rgba(79,70,229,0.15)' : 'none',
          }}
        >
          <User size={24} style={{ color: '#4F46E5', marginBottom: 6 }} />
          <div style={{ fontSize: 13, fontWeight: 700, color: '#0F172A' }}>Rahul Varma</div>
          <div style={{ fontSize: 11, color: '#64748B' }}>Traveler Object</div>
          <div style={{ fontSize: 10, background: '#DCFCE7', color: '#15803D', padding: '2px 6px', borderRadius: 4, marginTop: 8, display: 'inline-block', fontWeight: 600 }}>
            GCC Expat
          </div>
        </div>

        {/* Node 2: Family Account */}
        <div
          onClick={() => {
            setSelectedNode('family');
            toast.info('Node selected: Varma Family Account');
          }}
          style={{
            background: selectedNode === 'family' ? '#EEF2FF' : '#ffffff',
            border: selectedNode === 'family' ? '2px solid #4F46E5' : '1px solid #CBD5E1',
            borderRadius: 10,
            padding: 16,
            cursor: 'pointer',
            textAlign: 'center',
          }}
        >
          <Users size={24} style={{ color: '#8B5CF6', marginBottom: 6 }} />
          <div style={{ fontSize: 13, fontWeight: 700, color: '#0F172A' }}>Varma Family</div>
          <div style={{ fontSize: 11, color: '#64748B' }}>Family Account</div>
          <div style={{ fontSize: 10, background: '#F1F5F9', color: '#475569', padding: '2px 6px', borderRadius: 4, marginTop: 8, display: 'inline-block', fontWeight: 600 }}>
            4 Members
          </div>
        </div>

        {/* Node 3: Trip Deal */}
        <div
          onClick={() => {
            setSelectedNode('trip');
            toast.info('Node selected: Dubai 5D Family Trip Deal');
          }}
          style={{
            background: selectedNode === 'trip' ? '#EEF2FF' : '#ffffff',
            border: selectedNode === 'trip' ? '2px solid #4F46E5' : '1px solid #CBD5E1',
            borderRadius: 10,
            padding: 16,
            cursor: 'pointer',
            textAlign: 'center',
          }}
        >
          <Luggage size={24} style={{ color: '#059669', marginBottom: 6 }} />
          <div style={{ fontSize: 13, fontWeight: 700, color: '#0F172A' }}>Dubai 5D Trip</div>
          <div style={{ fontSize: 11, color: '#64748B' }}>Trip Deal Object</div>
          <div style={{ fontSize: 10, background: '#DCFCE7', color: '#15803D', padding: '2px 6px', borderRadius: 4, marginTop: 8, display: 'inline-block', fontWeight: 600 }}>
            {currencySymbol}85,000 Deal
          </div>
        </div>

        {/* Node 4: Visa Application */}
        <div
          onClick={() => {
            setSelectedNode('visa');
            toast.info('Node selected: UAE Tourist Visa');
          }}
          style={{
            background: selectedNode === 'visa' ? '#EEF2FF' : '#ffffff',
            border: selectedNode === 'visa' ? '2px solid #4F46E5' : '1px solid #CBD5E1',
            borderRadius: 10,
            padding: 16,
            cursor: 'pointer',
            textAlign: 'center',
          }}
        >
          <Shield size={24} style={{ color: '#D97706', marginBottom: 6 }} />
          <div style={{ fontSize: 13, fontWeight: 700, color: '#0F172A' }}>UAE Tourist Visa</div>
          <div style={{ fontSize: 11, color: '#64748B' }}>Visa Object</div>
          <div style={{ fontSize: 10, background: '#FEF3C7', color: '#D97706', padding: '2px 6px', borderRadius: 4, marginTop: 8, display: 'inline-block', fontWeight: 600 }}>
            Passport Verified
          </div>
        </div>

        {/* Node 5: Payment Ledger */}
        <div
          onClick={() => {
            setSelectedNode('payment');
            toast.info('Node selected: Payment Ledger');
          }}
          style={{
            background: selectedNode === 'payment' ? '#EEF2FF' : '#ffffff',
            border: selectedNode === 'payment' ? '2px solid #4F46E5' : '1px solid #CBD5E1',
            borderRadius: 10,
            padding: 16,
            cursor: 'pointer',
            textAlign: 'center',
          }}
        >
          <CreditCard size={24} style={{ color: '#2563EB', marginBottom: 6 }} />
          <div style={{ fontSize: 13, fontWeight: 700, color: '#0F172A' }}>Settlement Ledger</div>
          <div style={{ fontSize: 11, color: '#64748B' }}>Payment Object</div>
          <div style={{ fontSize: 10, background: '#DBEAFE', color: '#1D4ED8', padding: '2px 6px', borderRadius: 4, marginTop: 8, display: 'inline-block', fontWeight: 600 }}>
            {currencySymbol}45,000 Received
          </div>
        </div>
      </div>
    </div>
  );
}
