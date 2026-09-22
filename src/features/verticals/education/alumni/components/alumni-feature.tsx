'use client';

import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { Check, ChevronRight, GraduationCap, MessageCircle, Plus, ShieldOff, X } from 'lucide-react';
import { api, apiErrorMessage } from '@/lib/api';
import { useAuth } from '@/features/foundation/auth';
import {
  Alumnus, AlumnusDetail, AlumniOverview, AlumniStatus, INTERACTION_KINDS,
  STATUS_LABEL, STATUS_TONE, UNCONTACTABLE, fmtDate, fullName, roleText,
} from '../alumni-client';

const card: React.CSSProperties = { background: 'var(--surface)', border: '1px solid var(--line-soft)', borderRadius: 16 };

export function AlumniFeature() {
  const [search, setSearch] = useState('');
  const [year, setYear] = useState('');
  const [consentedOnly, setConsentedOnly] = useState(false);
  const [openId, setOpenId] = useState<string | null>(null);
  const [adding, setAdding] = useState(false);

  const { hasPermission } = useAuth();
  const canManage = hasPermission('alumni.manage');

  const { data: ov } = useQuery({
    queryKey: ['alumni-overview'],
    queryFn: async () => (await api.get<AlumniOverview>('/alumni/overview')).data,
  });
  const { data: rows, isLoading } = useQuery({
    queryKey: ['alumni', search, year, consentedOnly],
    queryFn: async () => (await api.get<Alumnus[]>('/alumni', {
      params: {
        ...(search.trim() ? { search: search.trim() } : {}),
        ...(year ? { year } : {}),
        ...(consentedOnly ? { consented: 'true' } : {}),
      },
    })).data,
  });

  const years = Object.keys(ov?.byYear ?? {}).filter((y) => y !== 'Unknown').sort().reverse();

  return (
    <div style={{ animation: 'fadeUp .4s ease' }}>
      <div style={{ marginBottom: 18 }}>
        <h1 style={{ fontSize: 26, fontWeight: 700, letterSpacing: '-.02em', margin: 0 }}>Alumni</h1>
        <p style={{ fontSize: 14, color: 'var(--ink-2)', margin: '6px 0 0' }}>
          The register of graduates, where they went, and who has agreed to be contacted.
        </p>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 12, marginBottom: 16 }}>
        <Stat label="On the register" value={ov?.total ?? 0} />
        <Stat label="Active" value={ov?.active ?? 0} accent="var(--success,#1e874b)" />
        {/* Consented AND active — the number a campaign may actually mail. */}
        <Stat label="Contactable" value={ov?.contactable ?? 0} accent="var(--brand,#132376)" />
        <Stat label="Employer known" value={ov?.employed ?? 0} />
      </div>

      <div style={{ display: 'flex', gap: 8, marginBottom: 14, flexWrap: 'wrap', alignItems: 'center' }}>
        <input className="input" style={{ height: 34, width: 240 }} placeholder="Search name, employer or admission no" value={search} onChange={(e) => setSearch(e.target.value)} />
        <select className="input" style={{ height: 34, width: 150 }} value={year} onChange={(e) => setYear(e.target.value)}>
          <option value="">Any cohort</option>
          {years.map((y) => <option key={y} value={y}>Class of {y}</option>)}
        </select>
        <button
          className="btn-secondary"
          style={{ height: 34, fontSize: 12.5, borderColor: consentedOnly ? 'var(--brand,#132376)' : undefined, color: consentedOnly ? 'var(--brand,#132376)' : undefined }}
          onClick={() => setConsentedOnly(!consentedOnly)}
        >
          <Check size={13} /> Consented only
        </button>
        <div style={{ flex: 1 }} />
        {canManage && !adding && (
          <button className="btn-primary" style={{ height: 34, fontSize: 12.5 }} onClick={() => setAdding(true)}>
            <Plus size={14} /> Add an alumnus
          </button>
        )}
      </div>

      {adding && canManage && <AddAlumnus onDone={() => setAdding(false)} onCancel={() => setAdding(false)} />}

      {isLoading ? <Empty text="Loading the register…" />
        : !rows?.length ? (
          <Empty text={search || year || consentedOnly
            ? 'Nobody matches those filters.'
            : 'The register is empty. Alumni who predate this system can be added by hand — they are usually the cohort worth reaching first.'} />
        ) : (
          <div style={{ display: 'grid', gap: 10 }}>
            {rows.map((a) => (
              <div key={a.id} style={card}>
                <button
                  onClick={() => setOpenId(openId === a.id ? null : a.id)}
                  style={{ width: '100%', display: 'flex', alignItems: 'center', gap: 10, padding: '13px 16px', background: 'none', border: 'none', cursor: 'pointer', textAlign: 'left', flexWrap: 'wrap' }}
                >
                  <div style={{ flex: 1, minWidth: 220 }}>
                    <div style={{ fontSize: 14, fontWeight: 600 }}>{fullName(a)}</div>
                    <div style={{ fontSize: 11.5, color: 'var(--ink-3)', marginTop: 2 }}>
                      {a.graduationYear ? `Class of ${a.graduationYear}` : 'Year unknown'}
                      {a.programme ? ` · ${a.programme}` : ''} · {roleText(a)}
                      {a.location ? ` · ${a.location}` : ''}
                    </div>
                  </div>
                  {/* Consent shows its date, because a claim of consent without one is not a claim. */}
                  {a.contactConsent
                    ? <Pill text={`consented ${fmtDate(a.contactConsentAt)}`} tone={{ bg: 'var(--success-bg,#e6f4ea)', fg: 'var(--success,#1e874b)' }} />
                    : <Pill text="no consent" tone={{ bg: 'var(--line-soft,#eef0f4)', fg: 'var(--ink-3,#6b7280)' }} />}
                  <Pill text={STATUS_LABEL[a.status]} tone={STATUS_TONE[a.status]} />
                  <ChevronRight size={15} style={{ color: 'var(--ink-4,#9aa1ab)', transform: openId === a.id ? 'rotate(90deg)' : undefined, transition: 'transform .15s' }} />
                </button>
                {openId === a.id && <AlumnusPanel id={a.id} canManage={canManage} />}
              </div>
            ))}
          </div>
        )}
    </div>
  );
}

function Stat({ label, value, accent }: { label: string; value: number; accent?: string }) {
  return (
    <div style={{ ...card, padding: '14px 16px' }}>
      <div style={{ fontSize: 22, fontWeight: 800, color: accent }}>{value}</div>
      <div style={{ fontSize: 12, color: 'var(--ink-3)' }}>{label}</div>
    </div>
  );
}

function Empty({ text }: { text: string }) {
  return <div style={{ ...card, padding: 28, textAlign: 'center', color: 'var(--ink-3)', fontSize: 13.5 }}>{text}</div>;
}

function Pill({ text, tone }: { text: string; tone: { bg: string; fg: string } }) {
  return (
    <span style={{ background: tone.bg, color: tone.fg, fontSize: 11.5, fontWeight: 700, padding: '3px 9px', borderRadius: 999, whiteSpace: 'nowrap' }}>
      {text}
    </span>
  );
}

function AddAlumnus({ onDone, onCancel }: { onDone: () => void; onCancel: () => void }) {
  const qc = useQueryClient();
  const [f, setF] = useState({ firstName: '', lastName: '', graduationYear: '', programme: '', currentEmployer: '', designation: '', email: '' });

  const thisYear = new Date().getFullYear();
  const y = Number(f.graduationYear);
  const badYear = f.graduationYear !== '' && (!Number.isInteger(y) || y < 1900 || y > thisYear + 10);

  const create = useMutation({
    mutationFn: async () => (await api.post('/alumni', {
      ...f,
      graduationYear: f.graduationYear ? Number(f.graduationYear) : undefined,
    })).data,
    onSuccess: () => {
      toast.success('Added to the register');
      qc.invalidateQueries({ queryKey: ['alumni'] });
      qc.invalidateQueries({ queryKey: ['alumni-overview'] });
      onDone();
    },
    onError: (e) => toast.error(apiErrorMessage(e)),
  });

  return (
    <div style={{ ...card, padding: 12, marginBottom: 12, display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
      <input className="input" style={{ height: 34, width: 150 }} placeholder="First name" value={f.firstName} onChange={(e) => setF({ ...f, firstName: e.target.value })} autoFocus />
      <input className="input" style={{ height: 34, width: 150 }} placeholder="Last name" value={f.lastName} onChange={(e) => setF({ ...f, lastName: e.target.value })} />
      <input
        className="input"
        style={{ height: 34, width: 120, borderColor: badYear ? 'var(--danger,#c0392b)' : undefined }}
        inputMode="numeric" placeholder="Grad year" value={f.graduationYear}
        onChange={(e) => setF({ ...f, graduationYear: e.target.value })}
      />
      <input className="input" style={{ height: 34, width: 130 }} placeholder="Programme" value={f.programme} onChange={(e) => setF({ ...f, programme: e.target.value })} />
      <input className="input" style={{ height: 34, width: 160 }} placeholder="Employer" value={f.currentEmployer} onChange={(e) => setF({ ...f, currentEmployer: e.target.value })} />
      <input className="input" style={{ height: 34, width: 150 }} placeholder="Designation" value={f.designation} onChange={(e) => setF({ ...f, designation: e.target.value })} />
      <input className="input" style={{ height: 34, width: 190 }} placeholder="Email" value={f.email} onChange={(e) => setF({ ...f, email: e.target.value })} />
      <button className="btn-primary" style={{ height: 34, fontSize: 12.5 }} disabled={!f.firstName.trim() || badYear || create.isPending} onClick={() => create.mutate()}>
        {create.isPending ? 'Adding…' : 'Add'}
      </button>
      <button className="btn-secondary" style={{ height: 34, width: 34, padding: 0 }} onClick={onCancel}><X size={14} /></button>
      {badYear && <span style={{ fontSize: 11.5, color: 'var(--danger,#c0392b)' }}>That does not look like a graduation year</span>}
      {/* Consent is never set here — it is granted deliberately, and dated. */}
      <span style={{ fontSize: 11.5, color: 'var(--ink-3)', width: '100%' }}>
        Contact consent is not assumed. Grant it on the record once they have actually agreed.
      </span>
    </div>
  );
}

function AlumnusPanel({ id, canManage }: { id: string; canManage: boolean }) {
  const qc = useQueryClient();
  const [subject, setSubject] = useState('');
  const [kind, setKind] = useState<string>('EMAIL');

  const { data: a } = useQuery({
    queryKey: ['alumnus', id],
    queryFn: async () => (await api.get<AlumnusDetail>(`/alumni/${id}`)).data,
  });

  const refresh = () => {
    qc.invalidateQueries({ queryKey: ['alumnus', id] });
    qc.invalidateQueries({ queryKey: ['alumni'] });
    qc.invalidateQueries({ queryKey: ['alumni-overview'] });
  };

  const setConsent = useMutation({
    mutationFn: async (granted: boolean) => (await api.patch(`/alumni/${id}`, { contactConsent: granted })).data,
    onSuccess: (r: any) => { toast.success(r?.contactConsent ? 'Consent recorded' : 'Consent withdrawn — marked opted out'); refresh(); },
    onError: (e) => toast.error(apiErrorMessage(e)),
  });

  const log = useMutation({
    mutationFn: async () => (await api.post(`/alumni/${id}/interactions`, { kind, subject: subject.trim() })).data,
    onSuccess: () => { toast.success('Contact recorded'); setSubject(''); refresh(); },
    onError: (e) => toast.error(apiErrorMessage(e)),
  });

  if (!a) return <div style={{ padding: '10px 16px', fontSize: 12.5, color: 'var(--ink-3)' }}>Loading…</div>;

  const uncontactable = UNCONTACTABLE.includes(a.status);

  return (
    <div style={{ borderTop: '1px solid var(--line-soft)', padding: 16 }}>
      <div style={{ display: 'flex', gap: 14, flexWrap: 'wrap', fontSize: 12, color: 'var(--ink-3)', marginBottom: 12 }}>
        {a.email && <span>{a.email}</span>}
        {a.phone && <span>{a.phone}</span>}
        {a.admissionNo && <span>Admission {a.admissionNo}</span>}
        {a.linkedinUrl && <span>{a.linkedinUrl}</span>}
      </div>

      {canManage && (
        <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap', marginBottom: 12 }}>
          {a.contactConsent ? (
            <button className="btn-secondary" style={{ height: 32, fontSize: 12 }} disabled={setConsent.isPending} onClick={() => setConsent.mutate(false)}>
              <ShieldOff size={13} /> Withdraw consent
            </button>
          ) : (
            <button className="btn-secondary" style={{ height: 32, fontSize: 12 }} disabled={setConsent.isPending} onClick={() => setConsent.mutate(true)}>
              <Check size={13} /> Record consent
            </button>
          )}
          <span style={{ fontSize: 11.5, color: 'var(--ink-3)' }}>
            {a.contactConsent ? `Agreed on ${fmtDate(a.contactConsentAt)}.` : 'No consent on file.'}
          </span>
        </div>
      )}

      {/*
        The API refuses contact against someone opted out or deceased. Offering
        the form and letting it 400 would put the burden on whoever clicks.
      */}
      {canManage && !uncontactable && (
        <div style={{ display: 'flex', gap: 8, marginBottom: 10, flexWrap: 'wrap' }}>
          <select className="input" style={{ height: 32, width: 120 }} value={kind} onChange={(e) => setKind(e.target.value)}>
            {INTERACTION_KINDS.map((k) => <option key={k} value={k}>{k.charAt(0) + k.slice(1).toLowerCase()}</option>)}
          </select>
          <input className="input" style={{ height: 32, width: 280 }} placeholder="What was said" value={subject} onChange={(e) => setSubject(e.target.value)} />
          <button className="btn-secondary" style={{ height: 32, fontSize: 12 }} disabled={!subject.trim() || log.isPending} onClick={() => log.mutate()}>
            <MessageCircle size={13} /> Record contact
          </button>
        </div>
      )}
      {canManage && uncontactable && (
        <div style={{ fontSize: 12, color: 'var(--ink-3)', marginBottom: 10 }}>
          {a.status === 'OPTED_OUT'
            ? 'This alumnus has opted out of contact, so nothing further can be recorded against them.'
            : 'This record is marked deceased.'}
        </div>
      )}

      <div style={{ fontSize: 12, fontWeight: 700, marginBottom: 6, color: 'var(--ink-2)' }}>
        <GraduationCap size={12} style={{ verticalAlign: -2 }} /> Contact history
      </div>
      {!a.interactions.length ? (
        <div style={{ fontSize: 12.5, color: 'var(--ink-3)' }}>Nobody has been in touch yet.</div>
      ) : (
        <div style={{ display: 'grid', gap: 5 }}>
          {a.interactions.map((i) => (
            <div key={i.id} style={{ display: 'flex', gap: 10, fontSize: 12.5, flexWrap: 'wrap' }}>
              <span style={{ color: 'var(--ink-3)', width: 110 }}>{fmtDate(i.occurredAt)}</span>
              <span style={{ color: 'var(--ink-3)', width: 80 }}>{i.kind.toLowerCase()}</span>
              <span style={{ flex: 1, minWidth: 160 }}>{i.subject}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
