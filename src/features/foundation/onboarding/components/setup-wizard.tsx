'use client';

import { useState } from 'react';
import { toast } from 'sonner';
import { Building2, Key, Users2, ShieldAlert, CheckCircle2, ChevronRight, ChevronLeft, Upload, Calculator } from 'lucide-react';

const STEPS = ['Organization', 'Property Config', 'Taxes & Ledger', 'Room Categories', 'Team Roster', 'Launch Setup'];

export function SetupWizard() {
  const [currentStep, setCurrentStep] = useState(0);
  const [orgName, setOrgName] = useState('');
  const [propertyName, setPropertyName] = useState('');
  const [propertyType, setPropertyType] = useState('HOTEL');
  const [roomCategory, setRoomCategory] = useState('');
  const [basePrice, setBasePrice] = useState('');

  const nextStep = () => {
    if (currentStep === 0 && !orgName) {
      toast.error('Organization Name is required');
      return;
    }
    if (currentStep === 1 && !propertyName) {
      toast.error('Property Name is required');
      return;
    }
    if (currentStep < STEPS.length - 1) {
      setCurrentStep(prev => prev + 1);
    }
  };

  const prevStep = () => {
    if (currentStep > 0) {
      setCurrentStep(prev => prev - 1);
    }
  };

  const handleLaunch = () => {
    toast.success('Property setup complete! Hospitality OS configured successfully.');
    window.location.href = '/dashboard';
  };

  const handleCsvImport = (type: string) => {
    toast.success(`Mock CSV data imported successfully for ${type}!`);
  };

  return (
    <div style={{ animation: 'fadeUp .4s ease', padding: 24, maxWidth: 800, margin: '0 auto' }}>
      <div style={{ textAlign: 'center', marginBottom: 30 }}>
        <h1 style={{ fontSize: 28, fontWeight: 800, letterSpacing: '-.02em', margin: 0 }}>Guided Customer Onboarding</h1>
        <p style={{ fontSize: 14, color: 'var(--ink-2)', marginTop: 6 }}>Welcome to BMN Connect. Configure your hospitality engine in minutes.</p>
      </div>

      {/* Progress timeline */}
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 40, position: 'relative' }}>
        <div style={{ position: 'absolute', top: '50%', left: 0, right: 0, height: 2, background: 'var(--line-soft)', zIndex: 1, transform: 'translateY(-50%)' }} />
        {STEPS.map((step, idx) => {
          const active = idx === currentStep;
          const done = idx < currentStep;
          return (
            <div key={step} style={{ position: 'relative', zIndex: 2, display: 'flex', flexDirection: 'column', alignItems: 'center', width: 90 }}>
              <div style={{
                width: 32, height: 32, borderRadius: '50%',
                background: done ? 'var(--success)' : active ? 'var(--brand)' : 'var(--bg)',
                color: done || active ? '#fff' : 'var(--ink-3)',
                border: '2px solid',
                borderColor: done ? 'var(--success)' : active ? 'var(--brand)' : 'var(--line-soft)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontSize: 12, fontWeight: 700, transition: 'all .2s',
              }}>
                {done ? <CheckCircle2 size={16} /> : idx + 1}
              </div>
              <span style={{ fontSize: 10, fontWeight: 600, color: active ? 'var(--brand)' : 'var(--ink-3)', marginTop: 8, textAlign: 'center' }}>{step}</span>
            </div>
          );
        })}
      </div>

      {/* Step Panels */}
      <div style={{ background: 'var(--surface)', border: '1px solid var(--line-soft)', borderRadius: 16, padding: 30, minHeight: 300, marginBottom: 24 }}>
        {currentStep === 0 && (
          <div style={{ animation: 'fadeIn .2s' }}>
            <h3 style={{ margin: '0 0 16px', fontSize: 18, fontWeight: 700, display: 'flex', alignItems: 'center', gap: 8 }}>
              <Building2 style={{ color: 'var(--brand)' }} /> Let's create your Organization
            </h3>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              <div>
                <label style={{ fontSize: 12, fontWeight: 600, color: 'var(--ink-2)', display: 'block', marginBottom: 6 }}>Organization / Corporate Name *</label>
                <input
                  type="text"
                  placeholder="BMN Hotels & Resorts Group"
                  value={orgName}
                  onChange={e => setOrgName(e.target.value)}
                  style={{ width: '100%', padding: '12px', borderRadius: 8, border: '1px solid var(--line-soft)', background: 'var(--bg)', fontSize: 14 }}
                />
              </div>
            </div>
          </div>
        )}

        {currentStep === 1 && (
          <div style={{ animation: 'fadeIn .2s' }}>
            <h3 style={{ margin: '0 0 16px', fontSize: 18, fontWeight: 700, display: 'flex', alignItems: 'center', gap: 8 }}>
              <Building2 style={{ color: 'var(--brand)' }} /> Register your First Property
            </h3>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              <div>
                <label style={{ fontSize: 12, fontWeight: 600, color: 'var(--ink-2)', display: 'block', marginBottom: 6 }}>Property / Hotel Name *</label>
                <input
                  type="text"
                  placeholder="BMN Grand Palace, Dubai"
                  value={propertyName}
                  onChange={e => setPropertyName(e.target.value)}
                  style={{ width: '100%', padding: '12px', borderRadius: 8, border: '1px solid var(--line-soft)', background: 'var(--bg)', fontSize: 14 }}
                />
              </div>
              <div>
                <label style={{ fontSize: 12, fontWeight: 600, color: 'var(--ink-2)', display: 'block', marginBottom: 6 }}>Property Type</label>
                <select
                  value={propertyType}
                  onChange={e => setPropertyType(e.target.value)}
                  style={{ width: '100%', padding: '12px', borderRadius: 8, border: '1px solid var(--line-soft)', background: 'var(--bg)', fontSize: 14 }}
                >
                  <option value="HOTEL">Hotel</option>
                  <option value="RESORT">Resort</option>
                  <option value="SERVICED_APARTMENT">Serviced Apartment</option>
                  <option value="HOLIDAY_HOME">Holiday Home</option>
                </select>
              </div>
            </div>
          </div>
        )}

        {currentStep === 2 && (
          <div style={{ animation: 'fadeIn .2s' }}>
            <h3 style={{ margin: '0 0 16px', fontSize: 18, fontWeight: 700, display: 'flex', alignItems: 'center', gap: 8 }}>
              <Calculator style={{ color: 'var(--brand)' }} /> Regional Taxes & Ledger Setup
            </h3>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              <p style={{ fontSize: 13, color: 'var(--ink-3)', margin: 0 }}>Configure standard hospitality tax policies or customize later.</p>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                <div style={{ border: '1px solid var(--line-soft)', borderRadius: 10, padding: 14, background: 'var(--bg)' }}>
                  <div style={{ fontWeight: 600, fontSize: 13, marginBottom: 4 }}>Standard GST (India)</div>
                  <div style={{ fontSize: 12, color: 'var(--ink-3)' }}>18% Room Tax, 5% F&B Service GST. Auto-posted to folio.</div>
                </div>
                <div style={{ border: '1px solid var(--line-soft)', borderRadius: 10, padding: 14, background: 'var(--bg)' }}>
                  <div style={{ fontWeight: 600, fontSize: 13, marginBottom: 4 }}>Standard VAT (UAE / Global)</div>
                  <div style={{ fontSize: 12, color: 'var(--ink-3)' }}>5% Unified VAT, 10% Service Charge, Tourism Dirham fees.</div>
                </div>
              </div>
            </div>
          </div>
        )}

        {currentStep === 3 && (
          <div style={{ animation: 'fadeIn .2s' }}>
            <h3 style={{ margin: '0 0 16px', fontSize: 18, fontWeight: 700, display: 'flex', alignItems: 'center', gap: 8 }}>
              <Key style={{ color: 'var(--brand)' }} /> Room Categories config
            </h3>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: 10 }}>
                <div>
                  <label style={{ fontSize: 12, fontWeight: 600, color: 'var(--ink-2)', display: 'block', marginBottom: 6 }}>Category Name</label>
                  <input
                    type="text"
                    placeholder="Deluxe Room"
                    value={roomCategory}
                    onChange={e => setRoomCategory(e.target.value)}
                    style={{ width: '100%', padding: '12px', borderRadius: 8, border: '1px solid var(--line-soft)', background: 'var(--bg)', fontSize: 14 }}
                  />
                </div>
                <div>
                  <label style={{ fontSize: 12, fontWeight: 600, color: 'var(--ink-2)', display: 'block', marginBottom: 6 }}>Base Price (INR) / night</label>
                  <input
                    type="number"
                    placeholder="5000"
                    value={basePrice}
                    onChange={e => setBasePrice(e.target.value)}
                    style={{ width: '100%', padding: '12px', borderRadius: 8, border: '1px solid var(--line-soft)', background: 'var(--bg)', fontSize: 14 }}
                  />
                </div>
              </div>
              <div style={{ border: '2px dashed var(--line-soft)', borderRadius: 12, padding: 24, textAlign: 'center', marginTop: 10 }}>
                <Upload size={24} style={{ opacity: .3, marginBottom: 8 }} />
                <div style={{ fontWeight: 600, fontSize: 13, marginBottom: 4 }}>Bulk Import Rooms Configuration</div>
                <p style={{ fontSize: 11, color: 'var(--ink-3)', margin: '0 0 12px' }}>Drag & drop room lists as CSV or XLS files.</p>
                <button
                  onClick={() => handleCsvImport('Rooms')}
                  style={{ padding: '8px 16px', border: '1px solid var(--line-soft)', background: 'var(--surface)', borderRadius: 6, fontSize: 12, fontWeight: 600, cursor: 'pointer' }}
                >
                  Choose File
                </button>
              </div>
            </div>
          </div>
        )}

        {currentStep === 4 && (
          <div style={{ animation: 'fadeIn .2s' }}>
            <h3 style={{ margin: '0 0 16px', fontSize: 18, fontWeight: 700, display: 'flex', alignItems: 'center', gap: 8 }}>
              <Users2 style={{ color: 'var(--brand)' }} /> Team Roster setup
            </h3>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              <p style={{ fontSize: 13, color: 'var(--ink-3)', margin: 0 }}>Register employee accounts and configure operational shift tasks immediately.</p>
              <div style={{ border: '2px dashed var(--line-soft)', borderRadius: 12, padding: 24, textAlign: 'center', marginTop: 10 }}>
                <Upload size={24} style={{ opacity: .3, marginBottom: 8 }} />
                <div style={{ fontWeight: 600, fontSize: 13, marginBottom: 4 }}>Bulk Import Guest / Employee Roster</div>
                <p style={{ fontSize: 11, color: 'var(--ink-3)', margin: '0 0 12px' }}>Upload system profiles template.</p>
                <button
                  onClick={() => handleCsvImport('Employees')}
                  style={{ padding: '8px 16px', border: '1px solid var(--line-soft)', background: 'var(--surface)', borderRadius: 6, fontSize: 12, fontWeight: 600, cursor: 'pointer' }}
                >
                  Choose File
                </button>
              </div>
            </div>
          </div>
        )}

        {currentStep === 5 && (
          <div style={{ animation: 'fadeIn .2s', textAlign: 'center', padding: '20px 0' }}>
            <CheckCircle2 size={48} style={{ color: 'var(--success)', margin: '0 auto 16px' }} />
            <h3 style={{ margin: '0 0 8px', fontSize: 20, fontWeight: 700 }}>Onboarding Configured!</h3>
            <p style={{ fontSize: 14, color: 'var(--ink-2)', maxWidth: 500, margin: '0 auto 24px' }}>
              Your BMN Connect workspace is ready. We've mapped your property databases and prepared the transaction pipelines.
            </p>
            <button
              onClick={handleLaunch}
              style={{ padding: '12px 28px', background: 'var(--brand)', color: '#fff', border: 'none', borderRadius: 8, fontSize: 14, fontWeight: 600, cursor: 'pointer' }}
            >
              Go to Workspace Dashboard
            </button>
          </div>
        )}
      </div>

      {/* Timeline Controls */}
      {currentStep < 5 && (
        <div style={{ display: 'flex', justifyContent: 'space-between' }}>
          <button
            onClick={prevStep}
            disabled={currentStep === 0}
            style={{
              display: 'flex', alignItems: 'center', gap: 6, padding: '10px 18px', borderRadius: 8,
              border: '1px solid var(--line-soft)', background: 'var(--surface)',
              fontWeight: 600, fontSize: 13, cursor: currentStep === 0 ? 'not-allowed' : 'pointer',
              opacity: currentStep === 0 ? .5 : 1,
            }}
          >
            <ChevronLeft size={16} /> Back
          </button>
          <button
            onClick={nextStep}
            style={{
              display: 'flex', alignItems: 'center', gap: 6, padding: '10px 18px', borderRadius: 8,
              border: 'none', background: 'var(--brand)', color: '#fff',
              fontWeight: 600, fontSize: 13, cursor: 'pointer',
            }}
          >
            Continue <ChevronRight size={16} />
          </button>
        </div>
      )}
    </div>
  );
}
