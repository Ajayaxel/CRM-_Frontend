'use client';

import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { UserSquare2, Plus, X, ShieldCheck, ShieldAlert, Building2, Phone, Mail, Landmark, Trash2, BadgeCheck } from 'lucide-react';
import { api, apiErrorMessage } from '@/lib/api';
import { Owner, OwnerType, KycType, KYC_TYPES, KYC_LABEL, money } from '../realestate-client';

const card: React.CSSProperties = { background: 'var(--surface)', border: '1px solid var(--line-soft)', borderRadius: 16 };
const label: React.CSSProperties = { fontSize: 12, fontWeight: 600, color: 'var(--ink-3)', marginBottom: 4, display: 'block' };
const input: React.CSSProperties = { width: '100%', padding: '9px 11px', borderRadius: 10, border: '1px solid var(--line)', background: 'var(--surface)', color: 'var(--ink)', fontSize: 14 };
const BRAND = 'var(--brand,#132376)';

function KycBadge({ verified }: { verified: boolean }) {
  return (
    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, fontSize: 12, fontWeight: 600, padding: '2px 9px', borderRadius: 999,
      background: verified ? 'var(--success-bg)' : 'var(--warning-bg,#fdf2e2)', color: verified ? 'var(--success)' : 'var(--warning,#c67c1e)' }}>
      {verified ? <ShieldCheck size={13} /> : <ShieldAlert size={13} />}{verified ? 'KYC verified' : 'KYC pending'}
    </span>
  );
}

export function OwnersFeature() {
  const qc = useQueryClient();
  const [compose, setCompose] = useState(false);
  const [openId, setOpenId] = useState<string | null>(null);
  const { data: owners } = useQuery({ queryKey: ['owners'], queryFn: async () => (await api.get<Owner[]>('/owners')).data });

  const list = owners ?? [];
  const verified = list.filter((o) => o.kycVerified).length;
  const totalProps = list.reduce((s, o) => s + (o.propertyCount ?? 0), 0);

  return (
    <div style={{ animation: 'fadeUp .4s ease' }}>
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 18, gap: 12, flexWrap: 'wrap' }}>
        <div>
          <h1 style={{ fontSize: 24, fontWeight: 700, display: 'flex', alignItems: 'center', gap: 10 }}><UserSquare2 size={24} /> Owners</h1>
          <p style={{ color: 'var(--ink-3)', marginTop: 4, fontSize: 14 }}>Landlords &amp; sellers whose units you list — with KYC and payout details.</p>
        </div>
        <button onClick={() => setCompose(true)} style={{ display: 'inline-flex', alignItems: 'center', gap: 6, background: BRAND, color: '#fff', border: 'none', borderRadius: 10, padding: '10px 16px', fontWeight: 600, cursor: 'pointer' }}>
          <Plus size={16} /> Add owner
        </button>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(150px,1fr))', gap: 12, marginBottom: 18 }}>
        <Stat label="Owners" value={list.length} />
        <Stat label="KYC verified" value={`${verified}/${list.length}`} accent="var(--success)" />
        <Stat label="Linked properties" value={totalProps} />
      </div>

      {list.length === 0 ? (
        <div style={{ ...card, padding: 48, textAlign: 'center', color: 'var(--ink-3)' }}>
          No owners yet. Add the landlord or seller behind a listing to start their KYC file.
        </div>
      ) : (
        <div style={{ ...card, overflow: 'hidden' }}>
          {list.map((o, i) => (
            <button key={o.id} onClick={() => setOpenId(o.id)} style={{ display: 'grid', gridTemplateColumns: '1fr auto', alignItems: 'center', gap: 12, width: '100%', textAlign: 'left', padding: '14px 18px', background: 'transparent', border: 'none', borderTop: i ? '1px solid var(--line-soft)' : 'none', cursor: 'pointer' }}>
              <div style={{ minWidth: 0 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                  <span style={{ fontWeight: 600 }}>{o.name}</span>
                  <span style={{ fontSize: 12, color: 'var(--ink-3)', fontFamily: 'monospace' }}>{o.reference}</span>
                  <span style={{ fontSize: 11, fontWeight: 600, padding: '1px 7px', borderRadius: 999, background: 'var(--surface-2)', color: 'var(--ink-3)' }}>{o.ownerType === 'COMPANY' ? 'Company' : 'Individual'}</span>
                  <KycBadge verified={o.kycVerified} />
                </div>
                <div style={{ fontSize: 13, color: 'var(--ink-3)', marginTop: 3, display: 'flex', gap: 14, flexWrap: 'wrap' }}>
                  {o.phone && <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}><Phone size={12} />{o.phone}</span>}
                  {o.email && <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}><Mail size={12} />{o.email}</span>}
                  {o.agreementPct != null && <span>Agreement {o.agreementPct}%</span>}
                </div>
              </div>
              <div style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 13, color: 'var(--ink-2)' }}>
                <Building2 size={14} /> {o.propertyCount ?? 0}
              </div>
            </button>
          ))}
        </div>
      )}

      {compose && <ComposeOwner onClose={() => setCompose(false)} onDone={() => { setCompose(false); qc.invalidateQueries({ queryKey: ['owners'] }); }} />}
      {openId && <OwnerDetail id={openId} onClose={() => setOpenId(null)} />}
    </div>
  );
}

function Stat({ label, value, accent }: { label: string; value: number | string; accent?: string }) {
  return (
    <div style={{ ...card, padding: '14px 16px' }}>
      <div style={{ fontSize: 12, color: 'var(--ink-3)', fontWeight: 600 }}>{label}</div>
      <div style={{ fontSize: 22, fontWeight: 700, marginTop: 2, color: accent || 'var(--ink)' }}>{value}</div>
    </div>
  );
}

function ComposeOwner({ onClose, onDone }: { onClose: () => void; onDone: () => void }) {
  const [f, setF] = useState<any>({ name: '', ownerType: 'INDIVIDUAL' as OwnerType, phone: '', email: '', nationality: '', kycType: 'EMIRATES_ID' as KycType, kycNumber: '', agreementPct: '', bankName: '', bankAccount: '', bankIfsc: '', address: '' });
  const set = (k: string) => (e: any) => setF({ ...f, [k]: e.target.value });
  const save = useMutation({
    mutationFn: () => api.post('/owners', { ...f, agreementPct: f.agreementPct === '' ? undefined : Number(f.agreementPct) }),
    onSuccess: () => { toast.success('Owner added'); onDone(); },
    onError: (e) => toast.error(apiErrorMessage(e)),
  });
  return (
    <Drawer title="Add owner" onClose={onClose}>
      <div style={{ display: 'grid', gap: 12 }}>
        <div><span style={label}>Name *</span><input style={input} value={f.name} onChange={set('name')} placeholder="e.g. Rashid Al Maktoum" /></div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
          <div><span style={label}>Type</span>
            <select style={input} value={f.ownerType} onChange={set('ownerType')}><option value="INDIVIDUAL">Individual</option><option value="COMPANY">Company</option></select>
          </div>
          <div><span style={label}>Nationality</span><input style={input} value={f.nationality} onChange={set('nationality')} placeholder="UAE" /></div>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
          <div><span style={label}>Phone</span><input style={input} value={f.phone} onChange={set('phone')} placeholder="+971…" /></div>
          <div><span style={label}>Email</span><input style={input} value={f.email} onChange={set('email')} placeholder="owner@example.com" /></div>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1.4fr', gap: 12 }}>
          <div><span style={label}>KYC document</span>
            <select style={input} value={f.kycType} onChange={set('kycType')}>{KYC_TYPES.map((k) => <option key={k} value={k}>{KYC_LABEL[k]}</option>)}</select>
          </div>
          <div><span style={label}>KYC number</span><input style={input} value={f.kycNumber} onChange={set('kycNumber')} placeholder="784-…" /></div>
        </div>
        <div><span style={label}>Management agreement %</span><input style={input} type="number" value={f.agreementPct} onChange={set('agreementPct')} placeholder="2.5" /></div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 12 }}>
          <div><span style={label}>Bank</span><input style={input} value={f.bankName} onChange={set('bankName')} placeholder="Emirates NBD" /></div>
          <div><span style={label}>Account</span><input style={input} value={f.bankAccount} onChange={set('bankAccount')} placeholder="AE…" /></div>
          <div><span style={label}>IFSC / SWIFT</span><input style={input} value={f.bankIfsc} onChange={set('bankIfsc')} /></div>
        </div>
        <div><span style={label}>Address</span><input style={input} value={f.address} onChange={set('address')} /></div>
        <button disabled={!f.name.trim() || save.isPending} onClick={() => save.mutate()} style={{ background: BRAND, color: '#fff', border: 'none', borderRadius: 10, padding: '11px', fontWeight: 600, cursor: 'pointer', opacity: !f.name.trim() || save.isPending ? 0.6 : 1 }}>
          {save.isPending ? 'Saving…' : 'Add owner'}
        </button>
      </div>
    </Drawer>
  );
}

function OwnerDetail({ id, onClose }: { id: string; onClose: () => void }) {
  const qc = useQueryClient();
  const { data: o, refetch } = useQuery({ queryKey: ['owner', id], queryFn: async () => (await api.get<Owner>(`/owners/${id}`)).data });
  const refresh = () => { refetch(); qc.invalidateQueries({ queryKey: ['owners'] }); };
  const verify = useMutation({ mutationFn: () => api.post(`/owners/${id}/verify-kyc`, { verified: true }), onSuccess: () => { refresh(); toast.success('KYC verified'); }, onError: (e) => toast.error(apiErrorMessage(e)) });
  const del = useMutation({ mutationFn: () => api.delete(`/owners/${id}`), onSuccess: () => { qc.invalidateQueries({ queryKey: ['owners'] }); toast.success('Owner removed'); onClose(); }, onError: (e) => toast.error(apiErrorMessage(e)) });

  return (
    <Drawer title={o ? o.name : 'Owner'} subtitle={o?.reference} onClose={onClose}>
      {!o ? <div style={{ color: 'var(--ink-3)' }}>Loading…</div> : (
        <div style={{ display: 'grid', gap: 16 }}>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
            <KycBadge verified={o.kycVerified} />
            <span style={{ fontSize: 12, fontWeight: 600, padding: '2px 9px', borderRadius: 999, background: 'var(--surface-2)', color: 'var(--ink-3)' }}>{o.ownerType === 'COMPANY' ? 'Company' : 'Individual'}</span>
            {!o.kycVerified && <button disabled={verify.isPending} onClick={() => verify.mutate()} style={{ display: 'inline-flex', alignItems: 'center', gap: 5, marginLeft: 'auto', background: 'var(--success-bg)', color: 'var(--success)', border: 'none', borderRadius: 8, padding: '6px 12px', fontWeight: 600, fontSize: 13, cursor: 'pointer' }}><BadgeCheck size={14} /> Verify KYC</button>}
          </div>

          <Section title="Contact">
            <Row k="Phone" v={o.phone} /><Row k="Email" v={o.email} /><Row k="Nationality" v={o.nationality} /><Row k="Address" v={o.address} />
          </Section>
          <Section title="KYC">
            <Row k="Document" v={o.kycType ? KYC_LABEL[o.kycType] : null} /><Row k="Number" v={o.kycNumber} />
            <Row k="Agreement" v={o.agreementPct != null ? `${o.agreementPct}%` : null} />
          </Section>
          {(o.bankName || o.bankAccount) && (
            <Section title="Payout bank"><Row k="Bank" v={o.bankName} /><Row k="Account" v={o.bankAccount} /><Row k="IFSC / SWIFT" v={o.bankIfsc} /></Section>
          )}

          <div>
            <div style={{ ...label, display: 'flex', alignItems: 'center', gap: 6 }}><Building2 size={13} /> Linked properties ({o.properties?.length ?? 0})</div>
            {(o.properties ?? []).length === 0 ? <div style={{ fontSize: 13, color: 'var(--ink-3)' }}>None linked yet — set this owner on a property from its listing.</div> : (
              <div style={{ display: 'grid', gap: 6 }}>
                {o.properties!.map((p) => (
                  <div key={p.id} style={{ ...card, padding: '9px 12px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <div><span style={{ fontWeight: 600, fontSize: 13 }}>{p.title}</span> <span style={{ fontSize: 11, color: 'var(--ink-3)', fontFamily: 'monospace' }}>{p.reference}</span></div>
                    <span style={{ fontSize: 13, color: 'var(--ink-2)' }}>{money(p.priceInr ?? p.rentInr)}</span>
                  </div>
                ))}
              </div>
            )}
          </div>

          <button disabled={del.isPending} onClick={() => { if (confirm('Remove this owner? Linked properties will be detached.')) del.mutate(); }} style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 6, background: 'transparent', color: 'var(--danger,#c0392b)', border: '1px solid var(--danger,#c0392b)', borderRadius: 10, padding: '9px', fontWeight: 600, cursor: 'pointer' }}>
            <Trash2 size={14} /> Remove owner
          </button>
        </div>
      )}
    </Drawer>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return <div><div style={label}>{title}</div><div style={{ display: 'grid', gap: 4 }}>{children}</div></div>;
}
function Row({ k, v }: { k: string; v?: string | null }) {
  return <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13 }}><span style={{ color: 'var(--ink-3)' }}>{k}</span><span style={{ color: 'var(--ink)', fontWeight: 500 }}>{v || '—'}</span></div>;
}

function Drawer({ title, subtitle, onClose, children }: { title: string; subtitle?: string | null; onClose: () => void; children: React.ReactNode }) {
  return (
    <div onClick={onClose} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,.35)', zIndex: 50, display: 'flex', justifyContent: 'flex-end' }}>
      <div onClick={(e) => e.stopPropagation()} style={{ width: 'min(520px,100%)', height: '100%', background: 'var(--bg,var(--surface))', borderLeft: '1px solid var(--line)', padding: 22, overflowY: 'auto', animation: 'slideIn .25s ease' }}>
        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 18 }}>
          <div><h2 style={{ fontSize: 19, fontWeight: 700 }}>{title}</h2>{subtitle && <div style={{ fontSize: 13, color: 'var(--ink-3)', fontFamily: 'monospace' }}>{subtitle}</div>}</div>
          <button onClick={onClose} style={{ background: 'transparent', border: 'none', cursor: 'pointer', color: 'var(--ink-3)' }}><X size={20} /></button>
        </div>
        {children}
      </div>
    </div>
  );
}
