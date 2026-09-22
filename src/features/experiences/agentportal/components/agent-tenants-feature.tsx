'use client';

import { useEffect, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { Users, AlertTriangle, Home, Plus, X, Link2, Check, BadgeCheck } from 'lucide-react';
import { api, apiErrorMessage } from '@/lib/api';
import { Agent, AgentTenant, ConvertibleLead, ONBOARD_META, Property, money } from '../agentportal-client';

const card: React.CSSProperties = { background: 'var(--surface)', border: '1px solid var(--line-soft)', borderRadius: 16 };

export function AgentTenantsFeature() {
  const qc = useQueryClient();
  const { data: agents } = useQuery({ queryKey: ['agents'], queryFn: async () => (await api.get<Agent[]>('/agent-portal/agents')).data });
  const [agentId, setAgentId] = useState('');
  const [add, setAdd] = useState(false);
  useEffect(() => { if (!agentId && agents?.length) setAgentId(agents[0].id); }, [agents, agentId]);
  const { data } = useQuery({ queryKey: ['agent-tenants', agentId], enabled: !!agentId, queryFn: async () => (await api.get<AgentTenant[]>(`/agent-portal/agents/${agentId}/tenants`)).data });
  const refresh = () => qc.invalidateQueries({ queryKey: ['agent-tenants'] });
  const verify = useMutation({ mutationFn: (id: string) => api.post(`/leases/${id}/verify`, {}), onSuccess: () => { refresh(); toast.success('Tenant verified · lease active'); } });

  return (
    <div style={{ animation: 'fadeUp .4s ease' }}>
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 18, flexWrap: 'wrap', gap: 10 }}>
        <div>
          <h1 style={{ fontSize: 26, fontWeight: 700, letterSpacing: '-.02em', margin: 0 }}>Tenants</h1>
          <p style={{ fontSize: 14, color: 'var(--ink-2)', margin: '6px 0 0' }}>Onboard tenants from a lead or manually, verify their details, then manage the tenancy.</p>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <select className="input" style={{ height: 40, width: 190 }} value={agentId} onChange={(e) => setAgentId(e.target.value)}>
            {(agents ?? []).map((a) => <option key={a.id} value={a.id}>{a.name}</option>)}
          </select>
          <button className="btn-primary" onClick={() => setAdd(true)}><Plus size={15} /> Add tenant</button>
        </div>
      </div>

      {(data ?? []).length === 0 && <div style={{ ...card, padding: 44, textAlign: 'center', color: 'var(--ink-3)' }}><Users size={30} style={{ opacity: 0.4 }} /><div style={{ marginTop: 10, fontSize: 14 }}>No tenants on this agent's listings yet. Add one from a lead or manually.</div></div>}

      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        {(data ?? []).map((t) => {
          const om = ONBOARD_META[t.onboardingStatus];
          return (
            <div key={t.id} style={{ ...card, padding: 16 }}>
              <div style={{ display: 'grid', gridTemplateColumns: '1.4fr 1.4fr 1fr 1.1fr auto', gap: 12, alignItems: 'center' }}>
                <div>
                  <div style={{ fontWeight: 700, fontSize: 14 }}>{t.tenantName}</div>
                  <div style={{ fontSize: 12, color: 'var(--ink-3)' }}>{t.tenantPhone ?? '—'}</div>
                </div>
                <div style={{ fontSize: 13, color: 'var(--ink-2)', display: 'flex', alignItems: 'center', gap: 6 }}><Home size={13} style={{ color: 'var(--ink-3)' }} />{t.property?.title ?? '—'}</div>
                <div style={{ fontSize: 13 }}><b>{money(t.rentInr)}</b><span style={{ color: 'var(--ink-3)' }}>/mo</span></div>
                <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                  <span className="badge" style={{ background: om.bg, color: om.fg }}>{om.label}</span>
                  {t.openComplaints > 0 && <span className="badge" style={{ background: 'var(--danger-bg,#fce8e8)', color: 'var(--danger,#c0392b)' }}><AlertTriangle size={11} style={{ marginRight: 3 }} />{t.openComplaints}</span>}
                </div>
                <div style={{ display: 'flex', gap: 6, justifyContent: 'flex-end' }}>
                  {t.onboardingStatus === 'SUBMITTED' && <button className="btn-primary" style={{ height: 32, fontSize: 12.5 }} disabled={verify.isPending} onClick={() => verify.mutate(t.id)}><BadgeCheck size={13} /> Verify</button>}
                  {(t.onboardingStatus === 'INVITED' || t.onboardingStatus === 'SUBMITTED') && <CopyLink leaseId={t.id} />}
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {add && <OnboardModal agentId={agentId} onClose={() => setAdd(false)} onDone={refresh} />}
    </div>
  );
}

/**
 * Portal links are issued by the API — signed, bound to this lease, expiring in
 * 30 days. `/t/<leaseId>` on its own opens nothing any more.
 */
async function issueTenantLink(leaseId: string): Promise<string> {
  const r = await api.post<{ path: string }>(`/leases/${leaseId}/portal-link`);
  return `${window.location.origin}${r.data.path}`;
}

async function copyText(text: string) {
  try { await navigator.clipboard.writeText(text); } catch { window.prompt('Copy this link', text); }
}

function CopyLink({ leaseId }: { leaseId: string }) {
  const [c, setC] = useState(false);
  const [busy, setBusy] = useState(false);
  const copy = async () => {
    setBusy(true);
    try { await copyText(await issueTenantLink(leaseId)); setC(true); toast.success('Portal link copied · valid 30 days'); setTimeout(() => setC(false), 1200); }
    catch (e) { toast.error(apiErrorMessage(e)); }
    finally { setBusy(false); }
  };
  return <button className="btn-secondary" style={{ height: 32, fontSize: 12.5 }} disabled={busy} onClick={copy}>{c ? <><Check size={13} /> Copied</> : <><Link2 size={13} /> Portal link</>}</button>;
}

function OnboardModal({ agentId, onClose, onDone }: { agentId: string; onClose: () => void; onDone: () => void }) {
  const [tab, setTab] = useState<'lead' | 'manual'>('lead');
  const { data: leads } = useQuery({ queryKey: ['convertible-leads'], queryFn: async () => (await api.get<ConvertibleLead[]>('/leases/convertible-leads')).data });
  const { data: props = [] } = useQuery({
    queryKey: ['agent-properties', agentId],
    queryFn: async () => {
      if (agentId) {
        const res = (await api.get<Property[]>(`/agent-portal/properties?agentId=${agentId}`)).data || [];
        if (res.length > 0) return res;
      }
      return (await api.get<Property[]>('/agent-portal/properties')).data || [];
    },
  });
  const [f, setF] = useState<any>({ leadId: '', tenantName: '', tenantPhone: '', tenantEmail: '', propertyId: '', startDate: '2026-08-01', endDate: '2027-07-31', rentInr: '', depositInr: '' });
  const set = (k: string, v: any) => setF((s: any) => ({ ...s, [k]: v }));
  // Selecting a property pre-fills rent & deposit from the listing. Rent listings carry a monthly
  // rent; for sale listings we estimate ~0.35%/mo of the price so the field is never left blank.
  const selectProperty = (id: string) => setF((s: any) => {
    const p = (props ?? []).find((x) => x.id === id);
    const rent = p?.rentInr ?? (p?.priceInr ? Math.round((p.priceInr * 0.0035) / 500) * 500 : null);
    return { ...s, propertyId: id, rentInr: rent ?? s.rentInr, depositInr: p?.depositInr ?? (rent ? rent * 2 : s.depositInr) };
  });
  const [invite, setInvite] = useState<{ id: string; link?: string } | null>(null);
  const onboard = useMutation({
    mutationFn: () => api.post('/leases/onboard', {
      leadId: tab === 'lead' ? f.leadId : undefined,
      propertyId: f.propertyId,
      tenantName: tab === 'manual' ? f.tenantName : (f.tenantName || undefined),
      tenantPhone: f.tenantPhone || undefined, tenantEmail: f.tenantEmail || undefined,
      startDate: f.startDate, endDate: f.endDate, rentInr: Number(f.rentInr) || 0, depositInr: f.depositInr ? Number(f.depositInr) : undefined,
    }),
    onSuccess: (r: any) => { onDone(); toast.success('Tenant onboarded · invite ready'); setInvite({ id: r.data.id }); issueTenantLink(r.data.id).then((link) => setInvite({ id: r.data.id, link })).catch((e) => toast.error(apiErrorMessage(e))); },
    onError: (e) => toast.error(apiErrorMessage(e)),
  });
  const canSubmit = f.propertyId && f.rentInr && (tab === 'lead' ? f.leadId : f.tenantName);

  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 60, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }}>
      <div style={{ position: 'absolute', inset: 0, background: 'rgba(20,15,12,.42)' }} onClick={onClose} />
      <div style={{ ...card, position: 'relative', zIndex: 1, width: 540, maxWidth: '100%', maxHeight: '92vh', overflowY: 'auto', padding: 22, borderRadius: 18 }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}><div style={{ fontWeight: 700, fontSize: 16 }}>Onboard tenant</div><button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--ink-3)' }}><X size={20} /></button></div>

        {invite ? (
          <div style={{ textAlign: 'center', padding: '10px 0' }}>
            <div style={{ fontWeight: 700, fontSize: 15 }}>Tenant onboarded 🎉</div>
            <div style={{ fontSize: 13, color: 'var(--ink-3)', margin: '6px 0 14px' }}>Share this portal link — the tenant fills their details & ID for verification.</div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, background: 'var(--surface-2)', borderRadius: 10, padding: '10px 12px' }}>
              <span style={{ fontFamily: 'var(--mono)', fontSize: 12, flex: 1, textAlign: 'left', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{invite.link ?? 'Creating a secure link…'}</span>
              {invite.link && <button className="btn-secondary" style={{ height: 32, fontSize: 12.5 }} onClick={() => { copyText(invite.link!); toast.success('Portal link copied'); }}><Link2 size={13} /> Copy</button>}
            </div>
            <a className="btn-secondary" href={invite.link ?? '#'} target="_blank" rel="noopener" style={{ marginTop: 10, width: '100%', justifyContent: 'center', height: 34 }}>Open tenant portal →</a>
            <button className="btn-primary" style={{ marginTop: 12, width: '100%' }} onClick={onClose}>Done</button>
          </div>
        ) : (
          <>
            <div style={{ display: 'inline-flex', background: 'var(--surface-2)', borderRadius: 10, padding: 3, marginBottom: 14 }}>
              {(['lead', 'manual'] as const).map((tt) => <button key={tt} onClick={() => setTab(tt)} style={{ border: 'none', cursor: 'pointer', borderRadius: 8, padding: '7px 16px', fontSize: 13, fontWeight: 600, background: tab === tt ? 'var(--surface)' : 'transparent', color: tab === tt ? 'var(--ink-1)' : 'var(--ink-3)' }}>{tt === 'lead' ? 'From a lead' : 'Manual'}</button>)}
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              {tab === 'lead' ? (
                <div><label className="label">Tenant lead <span style={{ color: 'var(--ink-3)', fontWeight: 400 }}>(from CRM / omni)</span></label>
                  <select className="input" value={f.leadId} onChange={(e) => set('leadId', e.target.value)}><option value="">Select a tenant lead…</option>{(leads ?? []).map((l) => <option key={l.id} value={l.id}>{l.firstName} {l.lastName ?? ''} · {l.phone ?? '—'}{l.preferredArea ? ` · ${l.preferredArea}` : ''}</option>)}</select>
                  {(leads ?? []).length === 0 && <div style={{ fontSize: 11.5, color: 'var(--ink-3)', marginTop: 4 }}>No unconverted tenant leads. Capture one via Lead Match or the public enquiry.</div>}
                </div>
              ) : (
                <div style={{ display: 'flex', gap: 10 }}>
                  <div style={{ flex: 1 }}><label className="label">Tenant name</label><input className="input" value={f.tenantName} onChange={(e) => set('tenantName', e.target.value)} /></div>
                  <div style={{ flex: 1 }}><label className="label">Phone</label><input className="input" value={f.tenantPhone} onChange={(e) => set('tenantPhone', e.target.value)} /></div>
                </div>
              )}
              <div><label className="label">Property</label><select className="input" value={f.propertyId} onChange={(e) => selectProperty(e.target.value)}><option value="">Select property…</option>{(props ?? []).map((p) => <option key={p.id} value={p.id}>{p.title} {p.area ? `(${p.area})` : ''}{p.rentInr ? ` · ₹${Number(p.rentInr).toLocaleString('en-IN')}/mo` : ''}</option>)}</select></div>
              <div style={{ display: 'flex', gap: 10 }}>
                <div style={{ flex: 1 }}><label className="label">Start</label><input className="input" type="date" value={f.startDate} onChange={(e) => set('startDate', e.target.value)} /></div>
                <div style={{ flex: 1 }}><label className="label">End</label><input className="input" type="date" value={f.endDate} onChange={(e) => set('endDate', e.target.value)} /></div>
              </div>
              <div style={{ display: 'flex', gap: 10 }}>
                <div style={{ flex: 1 }}><label className="label">Rent ₹/mo</label><input className="input" type="number" value={f.rentInr} onChange={(e) => set('rentInr', e.target.value)} /></div>
                <div style={{ flex: 1 }}><label className="label">Deposit ₹</label><input className="input" type="number" value={f.depositInr} onChange={(e) => set('depositInr', e.target.value)} /></div>
              </div>
            </div>
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10, marginTop: 18 }}><button className="btn-secondary" onClick={onClose}>Cancel</button><button className="btn-primary" disabled={!canSubmit || onboard.isPending} onClick={() => onboard.mutate()}>Onboard &amp; invite</button></div>
          </>
        )}
      </div>
    </div>
  );
}
