'use client';

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api, apiErrorMessage } from '@/lib/api';
import { toast } from 'sonner';
import {
  Building2,
  Plus,
  Search,
  CheckCircle2,
  Kanban,
  X,
} from 'lucide-react';

const card: React.CSSProperties = {
  background: 'var(--surface)',
  border: '1px solid var(--line-soft)',
  borderRadius: 16,
};

export function ProjectConsultingFeature() {
  const qc = useQueryClient();
  const [search, setSearch] = useState('');
  const [showAddModal, setShowAddModal] = useState(false);

  const [title, setTitle] = useState('');
  const [stage, setStage] = useState('PLANNING');
  const [estimatedCostInr, setEstimatedCostInr] = useState('4500000');
  const [notes, setNotes] = useState('');

  const { data: projects = [] } = useQuery({
    queryKey: ['realestate-consulting-projects'],
    queryFn: async () => (await api.get('/realestate/consulting')).data || [],
  });

  const createProject = useMutation({
    mutationFn: () =>
      api.post('/realestate/consulting', {
        title,
        stage,
        estimatedCostInr: Number(estimatedCostInr),
        notes,
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['realestate-consulting-projects'] });
      toast.success('Consulting Project created successfully');
      setShowAddModal(false);
      setTitle('');
      setNotes('');
    },
    onError: (e) => toast.error(apiErrorMessage(e)),
  });

  const filtered = projects.filter((p: any) =>
    (p.title || '').toLowerCase().includes(search.toLowerCase()) ||
    (p.projectNumber || '').toLowerCase().includes(search.toLowerCase()) ||
    (p.stage || '').toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div style={{ animation: 'fadeUp .4s ease', display: 'flex', flexDirection: 'column', gap: 18 }}>
      {/* Page Header */}
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 16, flexWrap: 'wrap' }}>
        <div>
          <div style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 12, fontWeight: 700, color: 'var(--brand, #132376)', background: 'var(--brand-subtle, #eff6ff)', padding: '3px 10px', borderRadius: 999, marginBottom: 8 }}>
            <Building2 size={13} /> NMK Project Consulting
          </div>
          <h1 style={{ fontSize: 26, fontWeight: 700, letterSpacing: '-.02em', margin: 0, color: 'var(--ink)' }}>
            Real Estate &amp; Construction Consulting
          </h1>
          <p style={{ fontSize: 14, color: 'var(--ink-2)', margin: '6px 0 0', maxWidth: 640 }}>
            Planning, cost estimation, contractor coordination, milestone tracking, and final project handover documentation.
          </p>
        </div>
        <button
          onClick={() => setShowAddModal(true)}
          className="btn-primary"
          style={{ height: 42, padding: '0 18px', display: 'inline-flex', alignItems: 'center', gap: 8 }}
        >
          <Plus size={16} /> Create Consulting Project
        </button>
      </div>

      {/* Main List Container */}
      <div style={{ ...card, padding: 22 }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, marginBottom: 18, paddingBottom: 14, borderBottom: '1px solid var(--line-soft)', flexWrap: 'wrap' }}>
          <h2 style={{ fontSize: 16, fontWeight: 700, margin: 0, display: 'flex', alignItems: 'center', gap: 8, color: 'var(--ink)' }}>
            <Kanban size={18} color="var(--brand, #132376)" /> Active Consulting Projects ({filtered.length})
          </h2>
          <div style={{ position: 'relative', width: 280, maxWidth: '100%' }}>
            <Search size={15} style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', color: 'var(--ink-3)' }} />
            <input
              className="input"
              style={{ paddingLeft: 36, width: '100%' }}
              type="text"
              placeholder="Search projects..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
        </div>

        {filtered.length === 0 ? (
          <div style={{ padding: '40px 0', textAlign: 'center', color: 'var(--ink-3)', fontSize: 14 }}>
            No consulting projects found. Click &quot;Create Consulting Project&quot; to begin.
          </div>
        ) : (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(340px, 1fr))', gap: 14 }}>
            {filtered.map((proj: any) => (
              <div
                key={proj.id}
                style={{
                  background: 'var(--surface-2, #f8fafc)',
                  border: '1px solid var(--line-soft, #e2e8f0)',
                  borderRadius: 14,
                  padding: 16,
                  display: 'flex',
                  flexDirection: 'column',
                  gap: 12,
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 10 }}>
                  <div>
                    <span style={{ fontSize: 11, fontWeight: 700, borderRadius: 6, padding: '3px 8px', background: 'var(--brand-subtle, #eff6ff)', color: 'var(--brand, #132376)' }}>
                      {proj.stage}
                    </span>
                    <h3 style={{ fontSize: 15, fontWeight: 700, margin: '8px 0 2px', color: 'var(--ink)' }}>
                      {proj.projectNumber ? `${proj.projectNumber} — ` : ''}{proj.title}
                    </h3>
                    <p style={{ fontSize: 12, color: 'var(--ink-2)', margin: 0 }}>
                      {proj.notes || 'Full construction supervision & consulting'}
                    </p>
                  </div>
                  <div style={{ textAlign: 'right', whiteSpace: 'nowrap' }}>
                    <div style={{ fontSize: 11, color: 'var(--ink-3)' }}>Estimated Cost</div>
                    <div style={{ fontSize: 16, fontWeight: 800, color: 'var(--brand, #132376)', marginTop: 2 }}>
                      ₹{(proj.estimatedCostInr || 0).toLocaleString('en-IN')}
                    </div>
                  </div>
                </div>

                {proj.milestones && proj.milestones.length > 0 && (
                  <div style={{ paddingTop: 10, borderTop: '1px solid var(--line-soft)', display: 'flex', flexDirection: 'column', gap: 6 }}>
                    <span style={{ fontSize: 11, fontWeight: 700, color: 'var(--ink-3)', textTransform: 'uppercase', letterSpacing: '.04em' }}>
                      Project Milestones
                    </span>
                    {proj.milestones.map((m: any) => (
                      <div
                        key={m.id}
                        style={{
                          display: 'flex',
                          justifyContent: 'space-between',
                          alignItems: 'center',
                          fontSize: 12,
                          background: 'var(--surface)',
                          padding: '6px 10px',
                          borderRadius: 8,
                          border: '1px solid var(--line-soft)',
                        }}
                      >
                        <span style={{ display: 'flex', alignItems: 'center', gap: 6, fontWeight: 500, color: 'var(--ink)' }}>
                          <CheckCircle2 size={14} color={m.status === 'COMPLETED' ? 'var(--success, #16a34a)' : 'var(--ink-3)'} />
                          {m.title}
                        </span>
                        <span style={{ fontWeight: 700, color: 'var(--ink)' }}>
                          ₹{(m.costInr || 0).toLocaleString('en-IN')}
                        </span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Modal */}
      {showAddModal && (
        <div style={{ position: 'fixed', inset: 0, zIndex: 60, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }}>
          <div style={{ position: 'absolute', inset: 0, background: 'rgba(20,15,12,.42)' }} onClick={() => setShowAddModal(false)} />
          <div style={{ ...card, position: 'relative', zIndex: 1, width: 480, maxWidth: '100%', maxHeight: '92vh', overflow: 'auto', padding: 22, borderRadius: 18, boxShadow: '0 20px 40px rgba(0,0,0,0.18)' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
              <div style={{ fontWeight: 700, fontSize: 16, display: 'flex', alignItems: 'center', gap: 8, color: 'var(--ink)' }}>
                <Building2 size={18} color="var(--brand, #132376)" /> Create Consulting Project
              </div>
              <button onClick={() => setShowAddModal(false)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--ink-3)' }}>
                <X size={20} />
              </button>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              <div>
                <label className="label">Project Title</label>
                <input
                  className="input"
                  style={{ width: '100%' }}
                  type="text"
                  placeholder="e.g. Kochi Villa Construction & Consulting"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                />
              </div>

              <div style={{ display: 'flex', gap: 10 }}>
                <div style={{ flex: 1 }}>
                  <label className="label">Project Stage</label>
                  <select
                    className="input"
                    style={{ width: '100%' }}
                    value={stage}
                    onChange={(e) => setStage(e.target.value)}
                  >
                    <option value="PLANNING">PLANNING</option>
                    <option value="ESTIMATION">ESTIMATION</option>
                    <option value="DESIGN">DESIGN</option>
                    <option value="EXECUTION">EXECUTION</option>
                    <option value="MONITORING">MONITORING</option>
                    <option value="HANDOVER">HANDOVER</option>
                  </select>
                </div>
                <div style={{ flex: 1 }}>
                  <label className="label">Estimated Cost (₹)</label>
                  <input
                    className="input"
                    style={{ width: '100%' }}
                    type="number"
                    value={estimatedCostInr}
                    onChange={(e) => setEstimatedCostInr(e.target.value)}
                  />
                </div>
              </div>

              <div>
                <label className="label">Project Notes &amp; Scope</label>
                <textarea
                  className="input"
                  rows={3}
                  style={{ width: '100%', height: 'auto', padding: '10px 12px' }}
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder="Architectural plan approval, structural supervision..."
                />
              </div>
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10, marginTop: 20, paddingTop: 14, borderTop: '1px solid var(--line-soft)' }}>
              <button className="btn-secondary" onClick={() => setShowAddModal(false)}>
                Cancel
              </button>
              <button
                className="btn-primary"
                onClick={() => createProject.mutate()}
                disabled={!title || createProject.isPending}
              >
                Create Project
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
