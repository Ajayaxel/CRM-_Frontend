'use client';

import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { AlertTriangle, ChevronRight, FileText, MessageCircle, Plus, UserPlus } from 'lucide-react';
import { api, apiErrorMessage } from '@/lib/api';
import {
  CompanyMou, CorporateBoardRow, CorporateProfile, ExpiringMou,
  INTERACTION_KINDS, MOU_EXPIRY_WINDOW_DAYS, MOU_STATUS_LABEL, MOU_TONE,
  daysLeftText, fmtDay,
} from '../placements-client';

const card: React.CSSProperties = { background: 'var(--surface)', border: '1px solid var(--line-soft)', borderRadius: 16 };

/** "1 contact" / "2 contacts" — these counts are usually 0 or 1 in practice. */
const plural = (n: number, word: string) => `${n} ${word}${n === 1 ? '' : 's'}`;

/**
 * Corporate relations (BRD §4.11): the companies the institute has a
 * relationship with, the people inside them, what was last said to whom, and
 * the MoUs that govern any of it.
 *
 * It sits on the Placements page because the API nests it under `/placements`
 * and it is the same company master — a recruiter and an MoU partner are the
 * same organisation, and splitting them would mean entering it twice.
 */
export function CorporateTab({ canManage }: { canManage: boolean }) {
  const [open, setOpen] = useState<string | null>(null);

  const { data: board, isLoading } = useQuery({
    queryKey: ['corporate-board'],
    queryFn: async () => (await api.get<CorporateBoardRow[]>('/placements/corporate/board')).data,
  });
  /*
   * The board is a placement.view read; the expiring list and the company
   * profile are corporate.manage — the server draws the line there, and asking
   * for them without the key would produce a 403 the user can do nothing
   * about. So they are not asked for.
   */
  const { data: expiring } = useQuery({
    queryKey: ['corporate-expiring'],
    queryFn: async () => (await api.get<ExpiringMou[]>('/placements/corporate/mous/expiring')).data,
    enabled: canManage,
  });

  return (
    <div>
      {/*
        The expiring list first, because it is the only part of this screen
        with a deadline. An MoU that lapses unnoticed ends a relationship by
        accident.
      */}
      {expiring && expiring.length > 0 && (
        <div style={{ ...card, padding: 14, marginBottom: 14, borderColor: 'var(--gold,#c67c1e)' }}>
          <div style={{ fontSize: 12.5, fontWeight: 700, color: 'var(--gold,#c67c1e)', marginBottom: 8 }}>
            <AlertTriangle size={13} style={{ verticalAlign: -2 }} />{' '}
            {expiring.length} MoU{expiring.length === 1 ? '' : 's'} ending within {MOU_EXPIRY_WINDOW_DAYS} days
          </div>
          <div style={{ display: 'grid', gap: 5 }}>
            {expiring.map((m) => (
              <div key={m.id} style={{ display: 'flex', gap: 10, fontSize: 12.5, flexWrap: 'wrap' }}>
                <span style={{ fontWeight: 600, minWidth: 160 }}>{m.company}</span>
                <span style={{ flex: 1, minWidth: 140 }}>{m.title}</span>
                <span style={{ color: 'var(--ink-3)' }}>{fmtDay(m.endDate)}</span>
                <span style={{ color: 'var(--gold,#c67c1e)', fontWeight: 600, width: 90, textAlign: 'right' }}>
                  {daysLeftText(m.daysLeft)}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {isLoading ? (
        <div style={{ ...card, padding: 28, textAlign: 'center', color: 'var(--ink-3)', fontSize: 13.5 }}>Loading the engagement board…</div>
      ) : !board?.length ? (
        <div style={{ ...card, padding: 28, textAlign: 'center', color: 'var(--ink-3)', fontSize: 13.5 }}>
          No companies yet. Add one on the Companies tab — a recruiter and an MoU partner are the same record.
        </div>
      ) : (
        <div style={{ display: 'grid', gap: 10 }}>
          {board.map((c) => (
            <div key={c.id} style={card}>
              <button
                onClick={() => setOpen(open === c.id ? null : c.id)}
                style={{ width: '100%', display: 'flex', alignItems: 'center', gap: 10, padding: '13px 16px', background: 'none', border: 'none', cursor: 'pointer', textAlign: 'left' }}
              >
                <div style={{ flex: 1, minWidth: 200 }}>
                  <div style={{ fontSize: 14, fontWeight: 600 }}>{c.name}</div>
                  <div style={{ fontSize: 11.5, color: 'var(--ink-3)', marginTop: 2 }}>
                    {plural(c.contacts, 'contact')} · {plural(c.interactions, 'interaction')} · {plural(c.jobs, 'role')} · {plural(c.internships, 'intern')}
                    {c.lastInteraction ? ` · last: ${c.lastInteraction} (${fmtDay(c.lastInteractionAt)})` : ' · never contacted'}
                  </div>
                </div>
                {c.mouActive > 0 && <Pill text={`${c.mouActive} active`} tone={MOU_TONE.ACTIVE} />}
                {c.mouExpiring > 0 && <Pill text={`${c.mouExpiring} expiring`} tone={MOU_TONE.EXPIRING} />}
                {c.mouExpired > 0 && <Pill text={`${c.mouExpired} expired`} tone={MOU_TONE.EXPIRED} />}
                <ChevronRight size={16} style={{ color: 'var(--ink-4,#9aa1ab)', transform: open === c.id ? 'rotate(90deg)' : undefined, transition: 'transform .15s' }} />
              </button>
              {open === c.id && (canManage
                ? <CompanyPanel companyId={c.id} canManage={canManage} />
                : (
                  <div style={{ borderTop: '1px solid var(--line-soft)', padding: '12px 16px', fontSize: 12.5, color: 'var(--ink-3)' }}>
                    Contacts, MoUs and the interaction history need the corporate relations permission.
                  </div>
                ))}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function Pill({ text, tone }: { text: string; tone: { bg: string; fg: string } }) {
  return (
    <span style={{ background: tone.bg, color: tone.fg, fontSize: 11.5, fontWeight: 700, padding: '3px 9px', borderRadius: 999, whiteSpace: 'nowrap' }}>
      {text}
    </span>
  );
}

function CompanyPanel({ companyId, canManage }: { companyId: string; canManage: boolean }) {
  const qc = useQueryClient();
  const { data } = useQuery({
    queryKey: ['corporate-profile', companyId],
    queryFn: async () => (await api.get<CorporateProfile>(`/placements/corporate/${companyId}`)).data,
  });

  const refresh = () => {
    qc.invalidateQueries({ queryKey: ['corporate-profile', companyId] });
    qc.invalidateQueries({ queryKey: ['corporate-board'] });
    qc.invalidateQueries({ queryKey: ['corporate-expiring'] });
  };

  if (!data) return <div style={{ padding: '10px 16px', fontSize: 12.5, color: 'var(--ink-3)' }}>Loading…</div>;

  return (
    <div style={{ borderTop: '1px solid var(--line-soft)', padding: 16, display: 'grid', gap: 16 }}>
      <Contacts profile={data} canManage={canManage} onChanged={refresh} />
      <Mous profile={data} canManage={canManage} onChanged={refresh} />
      <Interactions profile={data} canManage={canManage} onChanged={refresh} />
    </div>
  );
}

function Contacts({ profile, canManage, onChanged }: { profile: CorporateProfile; canManage: boolean; onChanged: () => void }) {
  const [name, setName] = useState('');
  const [designation, setDesignation] = useState('');
  const [email, setEmail] = useState('');

  const add = useMutation({
    mutationFn: async () => (await api.post(`/placements/corporate/${profile.id}/contacts`, {
      name: name.trim(), designation: designation.trim() || undefined, email: email.trim() || undefined,
    })).data,
    onSuccess: () => { toast.success('Contact added'); setName(''); setDesignation(''); setEmail(''); onChanged(); },
    onError: (e) => toast.error(apiErrorMessage(e)),
  });

  return (
    <section>
      <SectionTitle>Contacts</SectionTitle>
      {!profile.contacts.length ? (
        <Muted>Nobody recorded at this company yet.</Muted>
      ) : (
        <div style={{ display: 'grid', gap: 5 }}>
          {profile.contacts.map((c) => (
            <div key={c.id} style={{ display: 'flex', gap: 10, fontSize: 12.5, flexWrap: 'wrap' }}>
              <span style={{ fontWeight: 600, minWidth: 150 }}>{c.name}</span>
              {c.isPrimary && <Pill text="primary" tone={MOU_TONE.SUPERSEDED} />}
              <span style={{ color: 'var(--ink-3)', minWidth: 140 }}>{c.designation ?? '—'}</span>
              <span style={{ color: 'var(--ink-3)' }}>{c.email ?? c.phone ?? '—'}</span>
            </div>
          ))}
        </div>
      )}
      {canManage && (
        <div style={{ display: 'flex', gap: 8, marginTop: 8, flexWrap: 'wrap' }}>
          <input className="input" style={{ height: 32, width: 160 }} placeholder="Name" value={name} onChange={(e) => setName(e.target.value)} />
          <input className="input" style={{ height: 32, width: 150 }} placeholder="Designation" value={designation} onChange={(e) => setDesignation(e.target.value)} />
          <input className="input" style={{ height: 32, width: 190 }} placeholder="Email" value={email} onChange={(e) => setEmail(e.target.value)} />
          <button className="btn-secondary" style={{ height: 32, fontSize: 12 }} disabled={!name.trim() || add.isPending} onClick={() => add.mutate()}>
            <UserPlus size={13} /> Add contact
          </button>
        </div>
      )}
    </section>
  );
}

function Mous({ profile, canManage, onChanged }: { profile: CorporateProfile; canManage: boolean; onChanged: () => void }) {
  const [title, setTitle] = useState('');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [renewedFromId, setRenewedFromId] = useState('');
  const [terminating, setTerminating] = useState<string | null>(null);
  const [reason, setReason] = useState('');

  const create = useMutation({
    mutationFn: async () => (await api.post(`/placements/corporate/${profile.id}/mous`, {
      title: title.trim(), startDate, endDate, renewedFromId: renewedFromId || undefined,
    })).data,
    onSuccess: () => { toast.success('MoU recorded'); setTitle(''); setStartDate(''); setEndDate(''); setRenewedFromId(''); onChanged(); },
    onError: (e) => toast.error(apiErrorMessage(e)),
  });

  const terminate = useMutation({
    mutationFn: async (id: string) => (await api.post(`/placements/corporate/mous/${id}/terminate`, { reason: reason.trim() })).data,
    onSuccess: () => { toast.success('MoU terminated'); setTerminating(null); setReason(''); onChanged(); },
    onError: (e) => toast.error(apiErrorMessage(e)),
  });

  /*
   * Only an MoU that is not already superseded can be renewed — the server
   * refuses a second renewal of the same one, so offering it here would only
   * produce a 400 the user has to read to understand.
   */
  const renewable = profile.mous.filter((m) => m.status !== 'SUPERSEDED' && m.status !== 'TERMINATED');
  const datesBad = !!startDate && !!endDate && new Date(endDate) <= new Date(startDate);

  return (
    <section>
      <SectionTitle>MoUs</SectionTitle>
      {!profile.mous.length ? (
        <Muted>No MoU on file. Status is worked out from the dates each time it is read, so nothing here can go stale.</Muted>
      ) : (
        <div style={{ display: 'grid', gap: 6 }}>
          {profile.mous.map((m: CompanyMou) => (
            <div key={m.id} style={{ display: 'flex', gap: 10, fontSize: 12.5, alignItems: 'center', flexWrap: 'wrap' }}>
              <FileText size={13} style={{ color: 'var(--ink-4,#9aa1ab)' }} />
              <span style={{ fontWeight: 600, minWidth: 160 }}>{m.title}</span>
              <span style={{ color: 'var(--ink-3)' }}>{fmtDay(m.startDate)} → {fmtDay(m.endDate)}</span>
              <Pill text={MOU_STATUS_LABEL[m.status]} tone={MOU_TONE[m.status]} />
              {m.terminationReason && <span style={{ fontSize: 11.5, color: 'var(--ink-3)' }}>{m.terminationReason}</span>}
              {canManage && m.status !== 'TERMINATED' && m.status !== 'SUPERSEDED' && (
                terminating === m.id ? (
                  <>
                    <input className="input" style={{ height: 28, width: 180, fontSize: 12 }} placeholder="Reason (required)" value={reason} onChange={(e) => setReason(e.target.value)} autoFocus />
                    <button className="btn-secondary" style={{ height: 28, fontSize: 11 }} disabled={!reason.trim() || terminate.isPending} onClick={() => terminate.mutate(m.id)}>
                      Confirm
                    </button>
                    <button className="btn-secondary" style={{ height: 28, fontSize: 11 }} onClick={() => { setTerminating(null); setReason(''); }}>Cancel</button>
                  </>
                ) : (
                  <button className="btn-secondary" style={{ height: 26, fontSize: 11 }} onClick={() => setTerminating(m.id)}>Terminate</button>
                )
              )}
            </div>
          ))}
        </div>
      )}
      {canManage && (
        <div style={{ display: 'flex', gap: 8, marginTop: 8, flexWrap: 'wrap', alignItems: 'center' }}>
          <input className="input" style={{ height: 32, width: 200 }} placeholder="MoU title" value={title} onChange={(e) => setTitle(e.target.value)} />
          <input className="input" style={{ height: 32, width: 140 }} type="date" title="Start" value={startDate} onChange={(e) => setStartDate(e.target.value)} />
          <input className="input" style={{ height: 32, width: 140, borderColor: datesBad ? 'var(--danger,#c0392b)' : undefined }} type="date" title="End" value={endDate} onChange={(e) => setEndDate(e.target.value)} />
          {renewable.length > 0 && (
            <select className="input" style={{ height: 32, width: 190 }} value={renewedFromId} onChange={(e) => setRenewedFromId(e.target.value)}>
              <option value="">Not a renewal</option>
              {renewable.map((m) => <option key={m.id} value={m.id}>Renews: {m.title}</option>)}
            </select>
          )}
          <button className="btn-secondary" style={{ height: 32, fontSize: 12 }} disabled={!title.trim() || !startDate || !endDate || datesBad || create.isPending} onClick={() => create.mutate()}>
            <Plus size={13} /> Record MoU
          </button>
          {datesBad && <span style={{ fontSize: 11.5, color: 'var(--danger,#c0392b)' }}>An MoU must end after it starts</span>}
        </div>
      )}
    </section>
  );
}

function Interactions({ profile, canManage, onChanged }: { profile: CorporateProfile; canManage: boolean; onChanged: () => void }) {
  const [kind, setKind] = useState<string>('MEETING');
  const [subject, setSubject] = useState('');
  const [contactId, setContactId] = useState('');

  const log = useMutation({
    mutationFn: async () => (await api.post(`/placements/corporate/${profile.id}/interactions`, {
      kind, subject: subject.trim(), contactId: contactId || undefined,
    })).data,
    onSuccess: () => { toast.success('Interaction logged'); setSubject(''); onChanged(); },
    onError: (e) => toast.error(apiErrorMessage(e)),
  });

  return (
    <section>
      <SectionTitle>Interactions</SectionTitle>
      {canManage && (
        <div style={{ display: 'flex', gap: 8, marginBottom: 8, flexWrap: 'wrap' }}>
          <select className="input" style={{ height: 32, width: 120 }} value={kind} onChange={(e) => setKind(e.target.value)}>
            {INTERACTION_KINDS.map((k) => <option key={k} value={k}>{k.charAt(0) + k.slice(1).toLowerCase()}</option>)}
          </select>
          {profile.contacts.length > 0 && (
            <select className="input" style={{ height: 32, width: 170 }} value={contactId} onChange={(e) => setContactId(e.target.value)}>
              <option value="">No specific contact</option>
              {profile.contacts.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
          )}
          <input className="input" style={{ height: 32, width: 250 }} placeholder="What was discussed" value={subject} onChange={(e) => setSubject(e.target.value)} />
          <button className="btn-secondary" style={{ height: 32, fontSize: 12 }} disabled={!subject.trim() || log.isPending} onClick={() => log.mutate()}>
            <MessageCircle size={13} /> Log
          </button>
        </div>
      )}
      {!profile.interactions.length ? (
        <Muted>Nothing logged yet.</Muted>
      ) : (
        <div style={{ display: 'grid', gap: 5 }}>
          {profile.interactions.map((i) => (
            <div key={i.id} style={{ fontSize: 12.5, display: 'flex', gap: 10, flexWrap: 'wrap' }}>
              <span style={{ color: 'var(--ink-3)', width: 100 }}>{fmtDay(i.occurredAt)}</span>
              <span style={{ color: 'var(--ink-3)', width: 70 }}>{i.kind.toLowerCase()}</span>
              <span style={{ flex: 1, minWidth: 160 }}>{i.subject}</span>
              {i.contact?.name && <span style={{ color: 'var(--ink-3)' }}>{i.contact.name}</span>}
            </div>
          ))}
        </div>
      )}
    </section>
  );
}

function SectionTitle({ children }: { children: React.ReactNode }) {
  return <div style={{ fontSize: 12, fontWeight: 700, marginBottom: 6, color: 'var(--ink-2)' }}>{children}</div>;
}
function Muted({ children }: { children: React.ReactNode }) {
  return <div style={{ fontSize: 12.5, color: 'var(--ink-3)' }}>{children}</div>;
}
