'use client';

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api, apiErrorMessage } from '@/lib/api';
import { toast } from 'sonner';
import {
  Wrench,
  Plus,
  Search,
  CheckCircle2,
  Clock,
  IndianRupee,
  Image as ImageIcon,
  Layers,
  X,
  FileText,
} from 'lucide-react';

const card: React.CSSProperties = {
  background: 'var(--surface)',
  border: '1px solid var(--line-soft)',
  borderRadius: 16,
};

export function TaskMaintenanceFeature() {
  const qc = useQueryClient();
  const [search, setSearch] = useState('');
  const [selectedReq, setSelectedReq] = useState<any>(null);
  const [showIssueModal, setShowIssueModal] = useState(false);
  const [showTaskModal, setShowTaskModal] = useState(false);

  const [propertyId, setPropertyId] = useState('');
  const [category, setCategory] = useState('AC');
  const [priority, setPriority] = useState('MEDIUM');
  const [description, setDescription] = useState('');
  const [imageUrl, setImageUrl] = useState('');

  const [taskTitle, setTaskTitle] = useState('');
  const [taskCost, setTaskCost] = useState('500');

  const { data: properties = [] } = useQuery({
    queryKey: ['property-care-properties'],
    queryFn: async () => (await api.get('/property-care/properties')).data || [],
  });

  const { data: maintenanceList = [] } = useQuery({
    queryKey: ['property-care-maintenance'],
    queryFn: async () => (await api.get('/property-care/maintenance')).data || [],
  });

  const createMaintenance = useMutation({
    mutationFn: () =>
      api.post('/property-care/maintenance', {
        propertyId,
        category,
        priority,
        description,
        images: imageUrl ? [imageUrl] : [],
        reportedBy: 'CUSTOMER',
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['property-care-maintenance'] });
      toast.success('Maintenance Issue Reported (#MC-1023 created)');
      setShowIssueModal(false);
      setDescription('');
      setImageUrl('');
    },
    onError: (e) => toast.error(apiErrorMessage(e)),
  });

  const addTask = useMutation({
    mutationFn: () =>
      api.post(`/property-care/maintenance/${selectedReq?.id}/tasks`, {
        title: taskTitle,
        costInr: Number(taskCost),
        status: 'PENDING',
      }),
    onSuccess: (res) => {
      qc.invalidateQueries({ queryKey: ['property-care-maintenance'] });
      toast.success('Itemized Task Added');
      setShowTaskModal(false);
      setTaskTitle('');
      // Update selectedReq with latest if applicable
      if (res?.data) {
        setSelectedReq(res.data);
      }
    },
    onError: (e) => toast.error(apiErrorMessage(e)),
  });

  const approveQuote = useMutation({
    mutationFn: (quoteId: string) =>
      api.post(`/property-care/quotes/${quoteId}/approve`, { approvedBy: 'Noufal MK (Owner)' }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['property-care-maintenance'] });
      toast.success('Quotation Approved by Customer!');
    },
    onError: (e) => toast.error(apiErrorMessage(e)),
  });

  const filtered = maintenanceList.filter((m: any) =>
    (m.requestNumber || '').toLowerCase().includes(search.toLowerCase()) ||
    (m.category || '').toLowerCase().includes(search.toLowerCase()) ||
    (m.description || '').toLowerCase().includes(search.toLowerCase())
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
            <Wrench size={13} /> Task-Based Maintenance Architecture
          </div>
          <h1 style={{ fontSize: 26, fontWeight: 700, letterSpacing: '-.02em', margin: 0, color: 'var(--ink)' }}>
            Property Maintenance &amp; Quotations
          </h1>
          <p style={{ fontSize: 14, color: 'var(--ink-2)', margin: '6px 0 0', maxWidth: 680 }}>
            Itemized task breakdown with cost estimation, quotation approval, customer photo attachments, and work completion tracking.
          </p>
        </div>
        <button
          onClick={() => setShowIssueModal(true)}
          className="btn-primary"
          style={{ height: 42, padding: '0 18px', display: 'inline-flex', alignItems: 'center', gap: 8 }}
        >
          <Plus size={16} /> Report Maintenance Issue
        </button>
      </div>

      {/* Main Grid: Left Request List, Right Request Detail */}
      <div style={{ display: 'grid', gridTemplateColumns: 'minmax(300px, 360px) 1fr', gap: 16, alignItems: 'start' }}>
        {/* Left Side: Requests list */}
        <div style={{ ...card, padding: 16, display: 'flex', flexDirection: 'column', gap: 12 }}>
          <div style={{ position: 'relative' }}>
            <Search size={15} style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', color: 'var(--ink-3)' }} />
            <input
              className="input"
              style={{ paddingLeft: 36, width: '100%' }}
              type="text"
              placeholder="Search #MC request..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 8, maxHeight: 600, overflowY: 'auto' }}>
            {filtered.length === 0 ? (
              <div style={{ padding: '30px 10px', textAlign: 'center', color: 'var(--ink-3)', fontSize: 13 }}>
                No maintenance requests found.
              </div>
            ) : (
              filtered.map((m: any) => {
                const isSelected = selectedReq?.id === m.id;
                const statusColor =
                  m.status === 'APPROVED'
                    ? { bg: 'var(--success-bg, #dcfce7)', fg: 'var(--success, #15803d)' }
                    : m.status === 'QUOTED'
                    ? { bg: 'var(--brand-subtle, #eff6ff)', fg: 'var(--brand, #132376)' }
                    : { bg: 'var(--warning-bg, #fef3c7)', fg: 'var(--warning, #b45309)' };

                return (
                  <div
                    key={m.id}
                    onClick={() => setSelectedReq(m)}
                    style={{
                      padding: 14,
                      borderRadius: 12,
                      cursor: 'pointer',
                      border: isSelected ? '1.5px solid var(--brand, #132376)' : '1px solid var(--line-soft)',
                      background: isSelected ? 'var(--brand-subtle, #f0f4ff)' : 'var(--surface-2, #f8fafc)',
                      transition: 'all 0.15s ease',
                      display: 'flex',
                      flexDirection: 'column',
                      gap: 8,
                    }}
                  >
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <span style={{ fontWeight: 700, fontSize: 13, color: 'var(--ink)' }}>
                        {m.requestNumber}
                      </span>
                      <span
                        style={{
                          fontSize: 10,
                          fontWeight: 700,
                          padding: '2px 8px',
                          borderRadius: 6,
                          background: statusColor.bg,
                          color: statusColor.fg,
                          textTransform: 'uppercase',
                        }}
                      >
                        {m.status}
                      </span>
                    </div>

                    <p
                      style={{
                        fontSize: 12.5,
                        color: 'var(--ink-2)',
                        margin: 0,
                        lineHeight: 1.4,
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                        display: '-webkit-box',
                        WebkitLineClamp: 2,
                        WebkitBoxOrient: 'vertical',
                      }}
                    >
                      {m.description || 'Maintenance Issue'}
                    </p>

                    <div
                      style={{
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'center',
                        fontSize: 12,
                        paddingTop: 8,
                        borderTop: '1px solid var(--line-soft)',
                      }}
                    >
                      <span style={{ fontWeight: 600, color: 'var(--ink-3)' }}>
                        {m.category}
                      </span>
                      <span style={{ fontWeight: 700, color: 'var(--ink)' }}>
                        ₹{(m.totalCostInr || 0).toLocaleString('en-IN')}
                      </span>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>

        {/* Right Side: Detailed View */}
        <div style={{ ...card, padding: 22, minHeight: 450 }}>
          {selectedReq ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
              {/* Detail Header */}
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', paddingBottom: 16, borderBottom: '1px solid var(--line-soft)', flexWrap: 'wrap', gap: 12 }}>
                <div>
                  <span style={{ fontSize: 11, fontWeight: 700, color: 'var(--brand, #132376)', textTransform: 'uppercase', letterSpacing: '.04em' }}>
                    Maintenance Request Detail
                  </span>
                  <h2 style={{ fontSize: 20, fontWeight: 700, margin: '4px 0 2px', color: 'var(--ink)' }}>
                    {selectedReq.requestNumber} — {selectedReq.category} Issue
                  </h2>
                  <p style={{ fontSize: 13, color: 'var(--ink-2)', margin: 0 }}>
                    {selectedReq.description}
                  </p>
                </div>
                <button
                  onClick={() => setShowTaskModal(true)}
                  className="btn-secondary"
                  style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 13, height: 36, padding: '0 14px' }}
                >
                  <Plus size={15} /> Split into Itemized Task
                </button>
              </div>

              {/* Customer Photos */}
              {selectedReq.images && selectedReq.images.length > 0 && (
                <div>
                  <h4 style={{ fontSize: 12, fontWeight: 700, color: 'var(--ink-2)', textTransform: 'uppercase', margin: '0 0 10px', display: 'flex', alignItems: 'center', gap: 6 }}>
                    <ImageIcon size={14} /> Customer Reported Photos
                  </h4>
                  <div style={{ display: 'flex', gap: 10, overflowX: 'auto', paddingBottom: 4 }}>
                    {selectedReq.images.map((img: string, i: number) => (
                      <img
                        key={i}
                        src={img}
                        alt="Issue photo"
                        style={{ width: 100, height: 100, objectFit: 'cover', borderRadius: 10, border: '1px solid var(--line-soft)' }}
                      />
                    ))}
                  </div>
                </div>
              )}

              {/* Itemized Tasks Breakdown */}
              <div>
                <h4 style={{ fontSize: 12, fontWeight: 700, color: 'var(--ink-2)', textTransform: 'uppercase', margin: '0 0 10px', display: 'flex', alignItems: 'center', gap: 6 }}>
                  <Layers size={14} /> Itemized Task Breakdown
                </h4>
                <div style={{ border: '1px solid var(--line-soft)', borderRadius: 12, overflow: 'hidden' }}>
                  <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13, textAlign: 'left' }}>
                    <thead>
                      <tr style={{ background: 'var(--surface-2, #f8fafc)', borderBottom: '1px solid var(--line-soft)', color: 'var(--ink-2)' }}>
                        <th style={{ padding: '10px 14px', fontWeight: 600 }}>Task Title</th>
                        <th style={{ padding: '10px 14px', fontWeight: 600 }}>Status</th>
                        <th style={{ padding: '10px 14px', fontWeight: 600, textAlign: 'right' }}>Cost (₹)</th>
                      </tr>
                    </thead>
                    <tbody>
                      {selectedReq.tasks && selectedReq.tasks.length > 0 ? (
                        selectedReq.tasks.map((t: any) => (
                          <tr key={t.id} style={{ borderBottom: '1px solid var(--line-soft)' }}>
                            <td style={{ padding: '12px 14px', fontWeight: 600, color: 'var(--ink)' }}>{t.title}</td>
                            <td style={{ padding: '12px 14px' }}>
                              <span style={{ fontSize: 11, fontWeight: 700, padding: '2px 8px', borderRadius: 6, background: 'var(--surface-2)', color: 'var(--ink-2)' }}>
                                {t.status}
                              </span>
                            </td>
                            <td style={{ padding: '12px 14px', textAlign: 'right', fontWeight: 700, color: 'var(--ink)' }}>
                              ₹{(t.costInr || 0).toLocaleString('en-IN')}
                            </td>
                          </tr>
                        ))
                      ) : (
                        <tr>
                          <td colSpan={3} style={{ padding: 24, textAlign: 'center', color: 'var(--ink-3)', fontStyle: 'italic' }}>
                            No tasks split yet. Click &quot;Split into Itemized Task&quot; above to add breakdown.
                          </td>
                        </tr>
                      )}
                    </tbody>
                    <tfoot>
                      <tr style={{ background: 'var(--surface-2, #f8fafc)', fontWeight: 700 }}>
                        <td colSpan={2} style={{ padding: '12px 14px', color: 'var(--ink)' }}>Total Maintenance Charges</td>
                        <td style={{ padding: '12px 14px', textAlign: 'right', color: 'var(--brand, #132376)', fontSize: 15 }}>
                          ₹{(selectedReq.totalCostInr || 0).toLocaleString('en-IN')}
                        </td>
                      </tr>
                    </tfoot>
                  </table>
                </div>
              </div>

              {/* Quotation Approval Box */}
              {selectedReq.quotes && selectedReq.quotes.length > 0 && (
                <div
                  style={{
                    background: 'var(--surface-2, #f8fafc)',
                    border: '1px solid var(--line-soft)',
                    borderRadius: 14,
                    padding: 16,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    flexWrap: 'wrap',
                    gap: 12,
                  }}
                >
                  <div>
                    <span style={{ fontSize: 11, fontWeight: 700, color: 'var(--brand, #132376)', textTransform: 'uppercase' }}>
                      Quotation #{selectedReq.quotes[0].quoteNumber}
                    </span>
                    <div style={{ fontSize: 20, fontWeight: 800, color: 'var(--ink)', margin: '4px 0 2px' }}>
                      ₹{(selectedReq.quotes[0].totalAmountInr || 0).toLocaleString('en-IN')}
                    </div>
                    <p style={{ fontSize: 12, color: 'var(--ink-2)', margin: 0 }}>
                      Status: <strong style={{ textTransform: 'uppercase' }}>{selectedReq.quotes[0].status}</strong>
                    </p>
                  </div>
                  {selectedReq.quotes[0].status === 'PENDING' && (
                    <button
                      onClick={() => approveQuote.mutate(selectedReq.quotes[0].id)}
                      className="btn-primary"
                      style={{ padding: '0 18px', height: 38 }}
                    >
                      Approve Quote
                    </button>
                  )}
                </div>
              )}
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '100%', minHeight: 360, color: 'var(--ink-3)', gap: 10 }}>
              <Wrench size={36} strokeWidth={1.5} />
              <p style={{ fontSize: 14, margin: 0, fontWeight: 500 }}>
                Select a maintenance request from the left list to view task details.
              </p>
            </div>
          )}
        </div>
      </div>

      {/* Modal: Report Maintenance Issue */}
      {showIssueModal && (
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
            onClick={() => setShowIssueModal(false)}
          />
          <div
            style={{
              ...card,
              position: 'relative',
              zIndex: 1,
              width: 500,
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
                <Wrench size={18} color="var(--brand, #132376)" /> Report Maintenance Issue
              </h3>
              <button
                onClick={() => setShowIssueModal(false)}
                style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--ink-3)', padding: 4 }}
              >
                <X size={18} />
              </button>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              <div>
                <label className="label" style={{ display: 'block', fontSize: 12, fontWeight: 600, marginBottom: 6 }}>
                  Select Property
                </label>
                <select
                  className="input"
                  style={{ width: '100%' }}
                  value={propertyId}
                  onChange={(e) => setPropertyId(e.target.value)}
                >
                  <option value="">-- Select Property --</option>
                  {properties.map((p: any) => (
                    <option key={p.id} value={p.id}>
                      {p.title} ({p.ownerName})
                    </option>
                  ))}
                </select>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                <div>
                  <label className="label" style={{ display: 'block', fontSize: 12, fontWeight: 600, marginBottom: 6 }}>
                    Category
                  </label>
                  <select
                    className="input"
                    style={{ width: '100%' }}
                    value={category}
                    onChange={(e) => setCategory(e.target.value)}
                  >
                    <option value="AC">AC</option>
                    <option value="PLUMBING">PLUMBING</option>
                    <option value="ELECTRICAL">ELECTRICAL</option>
                    <option value="PAINTING">PAINTING</option>
                    <option value="GARDENING">GARDENING</option>
                    <option value="CLEANING">CLEANING</option>
                  </select>
                </div>
                <div>
                  <label className="label" style={{ display: 'block', fontSize: 12, fontWeight: 600, marginBottom: 6 }}>
                    Priority
                  </label>
                  <select
                    className="input"
                    style={{ width: '100%' }}
                    value={priority}
                    onChange={(e) => setPriority(e.target.value)}
                  >
                    <option value="LOW">LOW</option>
                    <option value="MEDIUM">MEDIUM</option>
                    <option value="HIGH">HIGH</option>
                    <option value="URGENT">URGENT</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="label" style={{ display: 'block', fontSize: 12, fontWeight: 600, marginBottom: 6 }}>
                  Issue Description
                </label>
                <textarea
                  className="input"
                  rows={3}
                  style={{ width: '100%', resize: 'vertical' }}
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="e.g. AC leaking near kitchen ceiling"
                />
              </div>

              <div>
                <label className="label" style={{ display: 'block', fontSize: 12, fontWeight: 600, marginBottom: 6 }}>
                  Attach Photo URL (Optional)
                </label>
                <input
                  className="input"
                  style={{ width: '100%' }}
                  type="text"
                  placeholder="https://images.unsplash.com/..."
                  value={imageUrl}
                  onChange={(e) => setImageUrl(e.target.value)}
                />
              </div>
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10, marginTop: 22, paddingTop: 14, borderTop: '1px solid var(--line-soft)' }}>
              <button
                type="button"
                onClick={() => setShowIssueModal(false)}
                className="btn-secondary"
                style={{ padding: '0 16px', height: 38 }}
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => createMaintenance.mutate()}
                disabled={!propertyId || createMaintenance.isPending}
                className="btn-primary"
                style={{ padding: '0 18px', height: 38 }}
              >
                {createMaintenance.isPending ? 'Submitting...' : 'Submit Issue'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal: Add Task */}
      {showTaskModal && (
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
            onClick={() => setShowTaskModal(false)}
          />
          <div
            style={{
              ...card,
              position: 'relative',
              zIndex: 1,
              width: 440,
              maxWidth: '100%',
              padding: 24,
              borderRadius: 18,
              boxShadow: '0 20px 40px rgba(0,0,0,0.18)',
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 18 }}>
              <h3 style={{ fontSize: 17, fontWeight: 700, margin: 0, display: 'flex', alignItems: 'center', gap: 8, color: 'var(--ink)' }}>
                <Plus size={18} color="var(--brand, #132376)" /> Add Task to #{selectedReq?.requestNumber}
              </h3>
              <button
                onClick={() => setShowTaskModal(false)}
                style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--ink-3)', padding: 4 }}
              >
                <X size={18} />
              </button>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              <div>
                <label className="label" style={{ display: 'block', fontSize: 12, fontWeight: 600, marginBottom: 6 }}>
                  Task Title
                </label>
                <input
                  className="input"
                  style={{ width: '100%' }}
                  type="text"
                  placeholder="e.g. Gas Refill or AC Servicing"
                  value={taskTitle}
                  onChange={(e) => setTaskTitle(e.target.value)}
                />
              </div>

              <div>
                <label className="label" style={{ display: 'block', fontSize: 12, fontWeight: 600, marginBottom: 6 }}>
                  Estimated Cost (₹)
                </label>
                <input
                  className="input"
                  style={{ width: '100%' }}
                  type="number"
                  value={taskCost}
                  onChange={(e) => setTaskCost(e.target.value)}
                />
              </div>
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10, marginTop: 22, paddingTop: 14, borderTop: '1px solid var(--line-soft)' }}>
              <button
                type="button"
                onClick={() => setShowTaskModal(false)}
                className="btn-secondary"
                style={{ padding: '0 16px', height: 38 }}
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => addTask.mutate()}
                disabled={!taskTitle || addTask.isPending}
                className="btn-primary"
                style={{ padding: '0 18px', height: 38 }}
              >
                {addTask.isPending ? 'Adding...' : 'Add Task'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
