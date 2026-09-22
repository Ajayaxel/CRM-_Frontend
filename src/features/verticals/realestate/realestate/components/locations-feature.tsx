'use client';

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api, apiErrorMessage } from '@/lib/api';
import { toast } from 'sonner';
import {
  MapPin,
  Plus,
  Search,
  Trash2,
  Map,
  X,
} from 'lucide-react';

const card: React.CSSProperties = {
  background: 'var(--surface)',
  border: '1px solid var(--line-soft)',
  borderRadius: 16,
};

export function LocationsFeature() {
  const qc = useQueryClient();
  const [search, setSearch] = useState('');
  const [showAddModal, setShowAddModal] = useState(false);

  const [state, setState] = useState('Kerala');
  const [district, setDistrict] = useState('Ernakulam');
  const [city, setCity] = useState('Kochi');
  const [area, setArea] = useState('Kakkanad');
  const [pincode, setPincode] = useState('682030');

  const { data: locations = [] } = useQuery({
    queryKey: ['property-care-locations'],
    queryFn: async () => (await api.get('/property-care/locations')).data || [],
  });

  const createLocation = useMutation({
    mutationFn: () =>
      api.post('/property-care/locations', {
        state,
        district,
        city,
        area,
        pincode,
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['property-care-locations'] });
      toast.success('Location Master added successfully');
      setShowAddModal(false);
    },
    onError: (e) => toast.error(apiErrorMessage(e)),
  });

  const deleteLocation = useMutation({
    mutationFn: (id: string) => api.delete(`/property-care/locations/${id}`),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['property-care-locations'] });
      toast.success('Location record deleted');
    },
    onError: (e) => toast.error(apiErrorMessage(e)),
  });

  const filtered = locations.filter((loc: any) =>
    (loc.state || '').toLowerCase().includes(search.toLowerCase()) ||
    (loc.district || '').toLowerCase().includes(search.toLowerCase()) ||
    (loc.city || '').toLowerCase().includes(search.toLowerCase()) ||
    (loc.area || '').toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div style={{ animation: 'fadeUp .4s ease', display: 'flex', flexDirection: 'column', gap: 18 }}>
      {/* Page Header */}
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 16, flexWrap: 'wrap' }}>
        <div>
          <div
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: 6,
              fontSize: 12,
              fontWeight: 700,
              color: 'var(--brand, #132376)',
              background: 'var(--brand-subtle, #eff6ff)',
              padding: '3px 10px',
              borderRadius: 999,
              marginBottom: 8,
            }}
          >
            <MapPin size={13} /> Dynamic Location Master
          </div>
          <h1 style={{ fontSize: 26, fontWeight: 700, letterSpacing: '-.02em', margin: 0, color: 'var(--ink)' }}>
            Location Hierarchy (State → District → City → Area)
          </h1>
          <p style={{ fontSize: 14, color: 'var(--ink-2)', margin: '6px 0 0', maxWidth: 680 }}>
            Flexible location management allowing client portfolio expansion across Kerala (Kochi, Kozhikode, Wayanad) and any future state/district.
          </p>
        </div>
        <button
          onClick={() => setShowAddModal(true)}
          className="btn-primary"
          style={{ height: 42, padding: '0 18px', display: 'inline-flex', alignItems: 'center', gap: 8 }}
        >
          <Plus size={16} /> Add New Location
        </button>
      </div>

      {/* Main Container */}
      <div style={{ ...card, padding: 22 }}>
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: 12,
            marginBottom: 18,
            paddingBottom: 14,
            borderBottom: '1px solid var(--line-soft)',
            flexWrap: 'wrap',
          }}
        >
          <h2 style={{ fontSize: 16, fontWeight: 700, margin: 0, display: 'flex', alignItems: 'center', gap: 8, color: 'var(--ink)' }}>
            <Map size={18} color="var(--brand, #132376)" /> Active Location Hierarchy Master ({filtered.length})
          </h2>
          <div style={{ position: 'relative', width: 280, maxWidth: '100%' }}>
            <Search size={15} style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', color: 'var(--ink-3)' }} />
            <input
              className="input"
              style={{ paddingLeft: 36, width: '100%' }}
              type="text"
              placeholder="Search State, District, City..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
        </div>

        {filtered.length === 0 ? (
          <div style={{ padding: '40px 0', textAlign: 'center', color: 'var(--ink-3)', fontSize: 14 }}>
            No locations found. Click &quot;Add New Location&quot; to create a new area entry.
          </div>
        ) : (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))', gap: 14 }}>
            {filtered.map((loc: any) => (
              <div
                key={loc.id}
                style={{
                  background: 'var(--surface-2, #f8fafc)',
                  border: '1px solid var(--line-soft, #e2e8f0)',
                  borderRadius: 14,
                  padding: 16,
                  display: 'flex',
                  flexDirection: 'column',
                  gap: 10,
                  transition: 'border-color 0.2s',
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                  <span
                    style={{
                      fontSize: 10,
                      fontWeight: 700,
                      letterSpacing: '.04em',
                      textTransform: 'uppercase',
                      padding: '2px 8px',
                      borderRadius: 6,
                      background: 'var(--brand-subtle, #eff6ff)',
                      color: 'var(--brand, #132376)',
                    }}
                  >
                    {loc.state}
                  </span>
                  <button
                    onClick={() => deleteLocation.mutate(loc.id)}
                    title="Delete location"
                    style={{
                      background: 'none',
                      border: 'none',
                      cursor: 'pointer',
                      color: 'var(--ink-3)',
                      padding: 4,
                      borderRadius: 6,
                      display: 'flex',
                      alignItems: 'center',
                    }}
                    onMouseEnter={(e) => (e.currentTarget.style.color = 'var(--danger, #c0392b)')}
                    onMouseLeave={(e) => (e.currentTarget.style.color = 'var(--ink-3)')}
                  >
                    <Trash2 size={14} />
                  </button>
                </div>

                <div>
                  <h3 style={{ fontSize: 16, fontWeight: 700, margin: '2px 0', color: 'var(--ink)' }}>
                    {loc.city} <span style={{ fontWeight: 500, color: 'var(--ink-2)', fontSize: 14 }}>({loc.area})</span>
                  </h3>
                  <p style={{ fontSize: 12, color: 'var(--ink-2)', margin: '2px 0 0' }}>
                    District: <strong style={{ color: 'var(--ink)' }}>{loc.district}</strong>
                  </p>
                  {loc.pincode && (
                    <p style={{ fontSize: 11, color: 'var(--ink-3)', margin: '2px 0 0' }}>
                      PIN: {loc.pincode}
                    </p>
                  )}
                </div>

                <div
                  style={{
                    paddingTop: 8,
                    borderTop: '1px solid var(--line-soft)',
                    fontSize: 11,
                    fontWeight: 600,
                    color: 'var(--brand, #132376)',
                    display: 'flex',
                    alignItems: 'center',
                    gap: 5,
                  }}
                >
                  <MapPin size={12} /> {loc.state} / {loc.district} / {loc.city} / {loc.area}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Add Location Modal */}
      {showAddModal && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            zIndex: 60,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: 16,
          }}
        >
          <div
            style={{ position: 'absolute', inset: 0, background: 'rgba(20,15,12,.42)' }}
            onClick={() => setShowAddModal(false)}
          />
          <div
            style={{
              ...card,
              position: 'relative',
              zIndex: 1,
              width: 480,
              maxWidth: '100%',
              maxHeight: '92vh',
              overflow: 'auto',
              padding: 24,
              borderRadius: 18,
              boxShadow: '0 20px 40px rgba(0,0,0,0.18)',
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 18 }}>
              <h3 style={{ fontSize: 17, fontWeight: 700, margin: 0, display: 'flex', alignItems: 'center', gap: 8, color: 'var(--ink)' }}>
                <MapPin size={18} color="var(--brand, #132376)" /> Add Location Master Record
              </h3>
              <button
                onClick={() => setShowAddModal(false)}
                style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--ink-3)', padding: 4 }}
              >
                <X size={18} />
              </button>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              <div>
                <label className="label" style={{ display: 'block', fontSize: 12, fontWeight: 600, marginBottom: 6 }}>
                  State
                </label>
                <input
                  className="input"
                  style={{ width: '100%' }}
                  type="text"
                  value={state}
                  onChange={(e) => setState(e.target.value)}
                  placeholder="e.g. Kerala"
                />
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                <div>
                  <label className="label" style={{ display: 'block', fontSize: 12, fontWeight: 600, marginBottom: 6 }}>
                    District
                  </label>
                  <input
                    className="input"
                    style={{ width: '100%' }}
                    type="text"
                    value={district}
                    onChange={(e) => setDistrict(e.target.value)}
                    placeholder="e.g. Ernakulam"
                  />
                </div>
                <div>
                  <label className="label" style={{ display: 'block', fontSize: 12, fontWeight: 600, marginBottom: 6 }}>
                    City
                  </label>
                  <input
                    className="input"
                    style={{ width: '100%' }}
                    type="text"
                    value={city}
                    onChange={(e) => setCity(e.target.value)}
                    placeholder="e.g. Kochi"
                  />
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                <div>
                  <label className="label" style={{ display: 'block', fontSize: 12, fontWeight: 600, marginBottom: 6 }}>
                    Area
                  </label>
                  <input
                    className="input"
                    style={{ width: '100%' }}
                    type="text"
                    value={area}
                    onChange={(e) => setArea(e.target.value)}
                    placeholder="e.g. Kakkanad"
                  />
                </div>
                <div>
                  <label className="label" style={{ display: 'block', fontSize: 12, fontWeight: 600, marginBottom: 6 }}>
                    Pincode
                  </label>
                  <input
                    className="input"
                    style={{ width: '100%' }}
                    type="text"
                    value={pincode}
                    onChange={(e) => setPincode(e.target.value)}
                    placeholder="e.g. 682030"
                  />
                </div>
              </div>
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10, marginTop: 22, paddingTop: 14, borderTop: '1px solid var(--line-soft)' }}>
              <button
                type="button"
                onClick={() => setShowAddModal(false)}
                className="btn-secondary"
                style={{ padding: '0 16px', height: 38 }}
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => createLocation.mutate()}
                disabled={!city || !area || createLocation.isPending}
                className="btn-primary"
                style={{ padding: '0 18px', height: 38 }}
              >
                {createLocation.isPending ? 'Adding...' : 'Add Location'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
