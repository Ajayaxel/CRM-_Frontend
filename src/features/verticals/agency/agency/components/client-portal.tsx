'use client';

import { useState, useEffect } from 'react';
import { toast } from 'sonner';
import {
  Briefcase, FolderKanban, FileText, LifeBuoy, Check, AlertCircle, Plus, X, ArrowUpRight,
  Clock, ShieldAlert, BadgeHelp, CheckCircle2, DollarSign
} from 'lucide-react';

interface Retainer {
  id: string;
  title: string;
  monthlyFeeInr: number;
  hoursIncluded: number;
}

interface Deliverable {
  id: string;
  title: string;
  channel?: string | null;
  status: 'TODO' | 'IN_PROGRESS' | 'REVIEW' | 'PUBLISHED';
  assignee?: string | null;
  dueAt?: string | null;
}

interface Project {
  id: string;
  name: string;
  type: string;
  status: string;
  budgetInr?: number | null;
  dueAt?: string | null;
  deliverables: Deliverable[];
}

interface Invoice {
  id: string;
  number: string;
  subtotalInr: number;
  totalInr: number;
  status: 'DRAFT' | 'SENT' | 'PARTIAL' | 'PAID' | 'UNPAID';
  dueDate?: string | null;
  createdAt: string;
}

interface Ticket {
  id: string;
  title: string;
  description?: string | null;
  priority: 'LOW' | 'MEDIUM' | 'HIGH' | 'URGENT';
  status: 'TODO' | 'IN_PROGRESS' | 'DONE';
  createdAt: string;
}

interface PortalState {
  account: {
    id: string;
    name: string;
    industry?: string | null;
    primaryContact?: string | null;
    phone?: string | null;
    healthScore: number;
    retainers: Retainer[];
    projects: Project[];
  };
  invoices: Invoice[];
  tickets: Ticket[];
}

const cardStyle: React.CSSProperties = {
  background: 'var(--surface)',
  border: '1px solid var(--line-soft)',
  borderRadius: 16,
  padding: 20,
  boxShadow: '0 2px 8px rgba(0,0,0,0.03)'
};

const DELIV_STATUS_META = {
  TODO: { label: 'Planned', bg: 'var(--surface-2)', fg: 'var(--ink-3)' },
  IN_PROGRESS: { label: 'In Progress', bg: 'var(--brand-bg,#e9ecfb)', fg: 'var(--brand,#132376)' },
  REVIEW: { label: 'Awaiting Approval', bg: 'var(--warning-bg,#fdf2e2)', fg: 'var(--warning,#c67c1e)' },
  PUBLISHED: { label: 'Approved', bg: 'var(--success-bg)', fg: 'var(--success)' },
};

/** The link's key rides in the URL fragment (#k=…) and reaches the API only as a header. */
function linkHeaders(): Record<string, string> {
  if (typeof window === 'undefined') return {};
  const k = new URLSearchParams(window.location.hash.slice(1)).get('k');
  return k ? { 'x-bmn-capability': k } : {};
}

export function ClientPortal({ accountId }: { accountId: string }) {
  const [data, setData] = useState<PortalState | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [tab, setTab] = useState<'projects' | 'invoices' | 'tickets'>('projects');
  const [newTicketModal, setNewTicketModal] = useState(false);
  const [approvingId, setApprovingId] = useState<string | null>(null);

  const [ticketForm, setTicketForm] = useState({ title: '', description: '', priority: 'MEDIUM' });

  const loadData = () => {
    setLoading(true);
    fetch(`/api/agency/portal/${accountId}`, { headers: linkHeaders() })
      .then((res) => {
        if (!res.ok) throw new Error();
        return res.json();
      })
      .then((json) => {
        setData(json);
        setError(false);
      })
      .catch(() => setError(true))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    loadData();
  }, [accountId]);

  const approve = async (deliverableId: string) => {
    setApprovingId(deliverableId);
    try {
      const res = await fetch(`/api/agency/portal/${accountId}/deliverables/${deliverableId}/approve`, {
        method: 'POST',
        headers: linkHeaders(),
      });
      if (!res.ok) throw new Error();
      toast.success('Deliverable approved successfully');
      loadData();
    } catch {
      toast.error('Failed to approve deliverable');
    } finally {
      setApprovingId(null);
    }
  };

  const submitTicket = async () => {
    if (!ticketForm.title) return;
    try {
      const res = await fetch(`/api/agency/portal/${accountId}/tickets`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...linkHeaders() },
        body: JSON.stringify(ticketForm),
      });
      if (!res.ok) throw new Error();
      toast.success('Support ticket created');
      setNewTicketModal(false);
      setTicketForm({ title: '', description: '', priority: 'MEDIUM' });
      loadData();
    } catch {
      toast.error('Failed to create ticket');
    }
  };

  if (loading && !data) {
    return (
      <div style={{ display: 'flex', minHeight: '80vh', alignItems: 'center', justifyContent: 'center', color: 'var(--ink-2)' }}>
        <div>Loading Client Portal...</div>
      </div>
    );
  }

  if (error || !data) {
    return (
      <div style={{ display: 'flex', minHeight: '80vh', alignItems: 'center', justifyContent: 'center', padding: 16 }}>
        <div style={{ ...cardStyle, width: 420, textAlign: 'center' }}>
          <ShieldAlert size={40} style={{ color: 'var(--danger)', margin: '0 auto 12px' }} />
          <div style={{ fontWeight: 700, fontSize: 16, marginBottom: 6 }}>Portal Access Error</div>
          <div style={{ fontSize: 14, color: 'var(--ink-3)', marginBottom: 18 }}>The request client portal does not exist, or you do not have permission to view it.</div>
          <button className="btn-primary" onClick={loadData}>Retry</button>
        </div>
      </div>
    );
  }

  const { account, invoices, tickets } = data;

  const money = (n: number) => {
    if (n >= 100000) return `₹${(n / 100000).toFixed(1)} L`;
    return `₹${n.toLocaleString('en-IN')}`;
  };

  return (
    <div style={{ minHeight: '100vh', background: 'var(--surface-alt,#f8f9fc)', color: 'var(--ink-1)' }}>
      {/* Branded Header */}
      <header style={{ background: '#132376', color: '#fff', padding: '24px 20px', borderBottom: '1px solid rgba(255,255,255,0.1)' }}>
        <div style={{ maxWidth: 1100, margin: '0 auto', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 16 }}>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <Briefcase size={22} style={{ color: 'var(--gold,#c67c1e)' }} />
              <h1 style={{ fontSize: 20, fontWeight: 800, margin: 0, letterSpacing: '-.02em' }}>{account.name} Portal</h1>
            </div>
            <p style={{ fontSize: 13, color: 'rgba(255,255,255,0.7)', margin: '4px 0 0' }}>{account.industry ?? 'General Service'} Client Workspace</p>
          </div>
          <div style={{ display: 'flex', gap: 12 }}>
            <button className="btn-secondary" style={{ background: 'rgba(255,255,255,0.1)', color: '#fff', border: '1px solid rgba(255,255,255,0.15)', height: 36 }} onClick={loadData}>Refresh</button>
            <button className="btn-primary" style={{ background: 'var(--gold,#c67c1e)', color: '#fff', height: 36 }} onClick={() => setNewTicketModal(true)}><Plus size={15} /> Raise Ticket</button>
          </div>
        </div>
      </header>

      <main style={{ maxWidth: 1100, margin: '0 auto', padding: '24px 16px' }}>
        {/* Retainers Overview */}
        {account.retainers.length > 0 && (
          <div style={{ ...cardStyle, marginBottom: 20, display: 'flex', flexWrap: 'wrap', gap: 16, alignItems: 'center' }}>
            <div style={{ flex: 1, minWidth: 200 }}>
              <div style={{ fontSize: 12, color: 'var(--ink-3)', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Active Engagement</div>
              <div style={{ fontSize: 18, fontWeight: 700, marginTop: 4 }}>{account.retainers[0].title}</div>
            </div>
            <div style={{ display: 'flex', gap: 24 }}>
              <div>
                <div style={{ fontSize: 11, color: 'var(--ink-3)' }}>Monthly Fee</div>
                <div style={{ fontSize: 18, fontWeight: 800, color: 'var(--brand,#132376)', display: 'flex', alignItems: 'center', gap: 4 }}><DollarSign size={16} />{money(account.retainers[0].monthlyFeeInr)}</div>
              </div>
              <div>
                <div style={{ fontSize: 11, color: 'var(--ink-3)' }}>Included Hours</div>
                <div style={{ fontSize: 18, fontWeight: 800, color: 'var(--ink-1)', display: 'flex', alignItems: 'center', gap: 4 }}><Clock size={16} />{account.retainers[0].hoursIncluded || 'Unlimited'} hrs</div>
              </div>
            </div>
          </div>
        )}

        {/* Tab Selection */}
        <div style={{ display: 'flex', gap: 8, borderBottom: '1px solid var(--line-soft)', marginBottom: 20, paddingBottom: 2 }}>
          <button
            onClick={() => setTab('projects')}
            style={{
              padding: '8px 16px', border: 'none', background: 'none', cursor: 'pointer',
              fontWeight: 700, fontSize: 14, color: tab === 'projects' ? 'var(--brand,#132376)' : 'var(--ink-3)',
              borderBottom: tab === 'projects' ? '2px solid var(--brand,#132376)' : 'none'
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}><FolderKanban size={15} /> Projects & Deliverables</div>
          </button>
          <button
            onClick={() => setTab('invoices')}
            style={{
              padding: '8px 16px', border: 'none', background: 'none', cursor: 'pointer',
              fontWeight: 700, fontSize: 14, color: tab === 'invoices' ? 'var(--brand,#132376)' : 'var(--ink-3)',
              borderBottom: tab === 'invoices' ? '2px solid var(--brand,#132376)' : 'none'
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}><FileText size={15} /> Invoice History</div>
          </button>
          <button
            onClick={() => setTab('tickets')}
            style={{
              padding: '8px 16px', border: 'none', background: 'none', cursor: 'pointer',
              fontWeight: 700, fontSize: 14, color: tab === 'tickets' ? 'var(--brand,#132376)' : 'var(--ink-3)',
              borderBottom: tab === 'tickets' ? '2px solid var(--brand,#132376)' : 'none'
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}><LifeBuoy size={15} /> Support Tickets ({tickets.length})</div>
          </button>
        </div>

        {/* Tab Content: Projects */}
        {tab === 'projects' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            {account.projects.length === 0 && (
              <div style={{ ...cardStyle, textAlign: 'center', color: 'var(--ink-3)', padding: 44 }}>
                <FolderKanban size={32} style={{ opacity: 0.4, margin: '0 auto 10px' }} />
                <div>No active projects found.</div>
              </div>
            )}

            {account.projects.map((proj) => (
              <div key={proj.id} style={cardStyle}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: 10, borderBottom: '1px solid var(--line-soft)', paddingBottom: 12, marginBottom: 14 }}>
                  <div>
                    <span className="badge" style={{ background: 'var(--brand-bg,#e9ecfb)', color: 'var(--brand,#132376)', marginBottom: 6 }}>{proj.type}</span>
                    <h3 style={{ fontSize: 16, fontWeight: 700, margin: '4px 0 0' }}>{proj.name}</h3>
                  </div>
                  <div style={{ textAlign: 'right' }}>
                    <div style={{ fontSize: 12, color: 'var(--ink-3)' }}>Project Status</div>
                    <div style={{ fontWeight: 700, fontSize: 13, textTransform: 'capitalize', color: 'var(--brand,#132376)', marginTop: 2 }}>{proj.status.toLowerCase()}</div>
                  </div>
                </div>

                <div style={{ fontSize: 13, fontWeight: 700, marginBottom: 8, color: 'var(--ink-2)' }}>Campaign Deliverables</div>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: 10 }}>
                  {proj.deliverables.length === 0 ? (
                    <div style={{ fontSize: 12, color: 'var(--ink-3)', padding: 12, border: '1px dashed var(--line-soft)', borderRadius: 8 }}>No deliverables listed for this project yet.</div>
                  ) : (
                    proj.deliverables.map((deliv) => {
                      const meta = DELIV_STATUS_META[deliv.status];
                      return (
                        <div key={deliv.id} style={{ border: '1px solid var(--line-soft)', background: 'var(--surface-alt)', padding: 12, borderRadius: 10, display: 'flex', flexDirection: 'column', justifyContent: 'space-between', minHeight: 90 }}>
                          <div>
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
                              <span style={{ fontSize: 10, fontWeight: 700, color: 'var(--ink-3)' }}>{deliv.channel ?? 'Campaign'}</span>
                              <span className="badge" style={{ background: meta.bg, color: meta.fg, fontSize: 9, padding: '1px 5px' }}>{meta.label}</span>
                            </div>
                            <div style={{ fontSize: 13, fontWeight: 700 }}>{deliv.title}</div>
                          </div>
                          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: 10 }}>
                            <div style={{ fontSize: 11, color: 'var(--ink-3)' }}>{deliv.dueAt ? `Due: ${new Date(deliv.dueAt).toLocaleDateString()}` : ''}</div>
                            {deliv.status === 'REVIEW' && (
                              <button
                                className="btn-secondary"
                                style={{ height: 26, fontSize: 11, background: 'var(--success-bg)', color: 'var(--success)', border: 'none', padding: '0 8px' }}
                                disabled={approvingId === deliv.id}
                                onClick={() => approve(deliv.id)}
                              >
                                {approvingId === deliv.id ? 'Approving...' : <><Check size={11} style={{ marginRight: 3 }} /> Approve</>}
                              </button>
                            )}
                          </div>
                        </div>
                      );
                    })
                  )}
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Tab Content: Invoices */}
        {tab === 'invoices' && (
          <div style={cardStyle}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
              <div style={{ fontWeight: 700, fontSize: 15 }}>Billing History</div>
            </div>
            {invoices.length === 0 ? (
              <div style={{ textAlign: 'center', padding: 30, color: 'var(--ink-3)' }}>No billing invoices found.</div>
            ) : (
              <div style={{ overflowX: 'auto' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
                  <thead>
                    <tr style={{ borderBottom: '1px solid var(--line-soft)', textAlign: 'left' }}>
                      <th style={{ padding: '8px 4px', color: 'var(--ink-3)' }}>Invoice No.</th>
                      <th style={{ padding: '8px 4px', color: 'var(--ink-3)' }}>Created</th>
                      <th style={{ padding: '8px 4px', color: 'var(--ink-3)' }}>Due Date</th>
                      <th style={{ padding: '8px 4px', color: 'var(--ink-3)' }}>Amount</th>
                      <th style={{ padding: '8px 4px', color: 'var(--ink-3)', textAlign: 'right' }}>Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {invoices.map((inv) => {
                      const isPaid = inv.status === 'PAID';
                      const badgeBg = isPaid ? 'var(--success-bg)' : 'var(--danger-bg)';
                      const badgeFg = isPaid ? 'var(--success)' : 'var(--danger)';
                      return (
                        <tr key={inv.id} style={{ borderBottom: '1px solid var(--line-soft)' }}>
                          <td style={{ padding: '10px 4px', fontWeight: 700 }}>{inv.number}</td>
                          <td style={{ padding: '10px 4px' }}>{new Date(inv.createdAt).toLocaleDateString()}</td>
                          <td style={{ padding: '10px 4px' }}>{inv.dueDate ? new Date(inv.dueDate).toLocaleDateString() : '—'}</td>
                          <td style={{ padding: '10px 4px', fontWeight: 700 }}>{money(inv.totalInr)}</td>
                          <td style={{ padding: '10px 4px', textAlign: 'right' }}>
                            <span className="badge" style={{ background: badgeBg, color: badgeFg }}>{inv.status}</span>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}

        {/* Tab Content: Support Tickets */}
        {tab === 'tickets' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--ink-2)' }}>Reported Incidents</div>
              <button className="btn-secondary" style={{ height: 30, fontSize: 12 }} onClick={() => setNewTicketModal(true)}><Plus size={13} /> Log Ticket</button>
            </div>

            {tickets.length === 0 ? (
              <div style={{ ...cardStyle, textAlign: 'center', color: 'var(--ink-3)', padding: 44 }}>
                <BadgeHelp size={32} style={{ opacity: 0.4, margin: '0 auto 10px' }} />
                <div>No tickets submitted yet. Have an issue? Click log ticket above.</div>
              </div>
            ) : (
              tickets.map((t) => {
                const isDone = t.status === 'DONE';
                return (
                  <div key={t.id} style={{ ...cardStyle, padding: 16, opacity: isDone ? 0.7 : 1 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: 8 }}>
                      <div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                          <span style={{ fontSize: 11, fontWeight: 700, color: 'var(--danger,#c0392b)', textTransform: 'uppercase' }}>{t.priority} Priority</span>
                          <span style={{ fontSize: 11, color: 'var(--ink-3)' }}>Opened: {new Date(t.createdAt).toLocaleDateString()}</span>
                        </div>
                        <h4 style={{ fontSize: 14, fontWeight: 700, margin: '4px 0 0' }}>{t.title}</h4>
                        {t.description && <p style={{ fontSize: 12, color: 'var(--ink-2)', margin: '6px 0 0' }}>{t.description}</p>}
                      </div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                        {isDone ? (
                          <span className="badge" style={{ background: 'var(--success-bg)', color: 'var(--success)' }}><CheckCircle2 size={12} style={{ marginRight: 3 }} /> Resolved</span>
                        ) : t.status === 'IN_PROGRESS' ? (
                          <span className="badge" style={{ background: 'var(--brand-bg,#e9ecfb)', color: 'var(--brand)' }}><Clock size={12} style={{ marginRight: 3 }} /> In Progress</span>
                        ) : (
                          <span className="badge" style={{ background: 'var(--surface-2)', color: 'var(--ink-3)' }}><AlertCircle size={12} style={{ marginRight: 3 }} /> Open</span>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        )}
      </main>

      {/* New Ticket Modal */}
      {newTicketModal && (
        <div style={{ position: 'fixed', inset: 0, zIndex: 60, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }}>
          <div style={{ position: 'absolute', inset: 0, background: 'rgba(20,15,12,.42)' }} onClick={() => setNewTicketModal(false)} />
          <div style={{ ...cardStyle, position: 'relative', zIndex: 1, width: 480, maxWidth: '100%', padding: 22, borderRadius: 18 }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
              <div style={{ fontWeight: 700, fontSize: 16 }}>Raise Support Incident</div>
              <button onClick={() => setNewTicketModal(false)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--ink-3)' }}><X size={20} /></button>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              <div>
                <label className="label">Summary / Title</label>
                <input
                  className="input"
                  value={ticketForm.title}
                  onChange={(e) => setTicketForm((s) => ({ ...s, title: e.target.value }))}
                  placeholder="Need assistance with Instagram sync error"
                />
              </div>
              <div>
                <label className="label">Detailed Description</label>
                <textarea
                  className="input"
                  rows={4}
                  value={ticketForm.description}
                  onChange={(e) => setTicketForm((s) => ({ ...s, description: e.target.value }))}
                  placeholder="Describe the issue or request details..."
                  style={{ resize: 'vertical' }}
                />
              </div>
              <div>
                <label className="label">Priority Level</label>
                <select
                  className="input"
                  value={ticketForm.priority}
                  onChange={(e) => setTicketForm((s) => ({ ...s, priority: e.target.value }))}
                >
                  <option value="LOW">Low</option>
                  <option value="MEDIUM">Medium</option>
                  <option value="HIGH">High</option>
                  <option value="URGENT">Urgent</option>
                </select>
              </div>
            </div>
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10, marginTop: 18 }}>
              <button className="btn-secondary" onClick={() => setNewTicketModal(false)}>Cancel</button>
              <button className="btn-primary" disabled={!ticketForm.title} onClick={submitTicket}>Submit Ticket</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
