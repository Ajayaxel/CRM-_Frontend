'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { Building2, Plus, Search, X } from 'lucide-react';
import { api, apiErrorMessage } from '@/lib/api';
import { useAuth } from '@/features/foundation/auth';
import { card, Empty, Loading, Pill, Row } from './shared';
import { CsCompany, CsPaged, CsRelationKind, humanEnum } from '../workspace-client';

const RELATIONS: CsRelationKind[] = ['CLIENT', 'PROSPECT', 'PARTNER', 'VENDOR', 'INVESTOR', 'INFLUENCER', 'CONSULTANT'];

/**
 * The client register.
 *
 * One row per real-world company, however many relationships it has with the
 * firm — a company that is both a client and a vendor is one record here, which
 * is the whole reason CsCompanyRelation exists. Opening a row goes to that
 * company's workspace, which is where the consulting product actually lives.
 */
export function CompaniesFeature() {
  const router = useRouter();
  const qc = useQueryClient();
  const { hasPermission } = useAuth();
  const canManage = hasPermission('consulting.company.manage');

  const [q, setQ] = useState('');
  const [relation, setRelation] = useState<CsRelationKind | ''>('');
  const [compose, setCompose] = useState(false);

  const { data, isLoading } = useQuery({
    queryKey: ['cs-companies', q, relation],
    queryFn: async () =>
      (await api.get<CsPaged<CsCompany>>('/consulting/companies', {
        params: { ...(q ? { q } : {}), ...(relation ? { relation } : {}) },
      })).data,
  });

  const create = useMutation({
    mutationFn: (body: Record<string, unknown>) => api.post<CsCompany>('/consulting/companies', body),
    onSuccess: (res) => {
      toast.success('Company added');
      setCompose(false);
      qc.invalidateQueries({ queryKey: ['cs-companies'] });
      router.push(`/companies/${res.data.id}`);
    },
    onError: (e) => toast.error(apiErrorMessage(e)),
  });

  const companies = data?.items ?? [];

  return (
    <div style={{ animation: 'fadeUp .4s ease' }}>
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 18 }}>
        <div>
          <h1 style={{ fontSize: 26, fontWeight: 700, letterSpacing: '-.02em', margin: 0 }}>Companies</h1>
          <p style={{ fontSize: 14, color: 'var(--ink-2)', margin: '6px 0 0' }}>
            Every client, partner and vendor — one record each, whatever they are to you.
          </p>
        </div>
        {canManage ? (
          <button className="btn-primary" onClick={() => setCompose(true)}><Plus size={15} /> New company</button>
        ) : null}
      </div>

      <div style={{ display: 'flex', gap: 10, marginBottom: 14, flexWrap: 'wrap' }}>
        <div style={{ position: 'relative', flex: 1, minWidth: 220 }}>
          <Search size={15} style={{ position: 'absolute', left: 10, top: 11, color: 'var(--ink-3)' }} />
          <input
            className="input"
            style={{ paddingLeft: 32, width: '100%' }}
            placeholder="Search by name, industry or city"
            value={q}
            onChange={(e) => setQ(e.target.value)}
          />
        </div>
        <select className="input" value={relation} onChange={(e) => setRelation(e.target.value as CsRelationKind | '')}>
          <option value="">Every relationship</option>
          {RELATIONS.map((r) => <option key={r} value={r}>{humanEnum(r)}</option>)}
        </select>
      </div>

      {isLoading ? <Loading /> : companies.length === 0 ? (
        <Empty
          title={q || relation ? 'Nothing matches that' : 'No companies yet'}
          hint={q || relation ? 'Try a different search.' : 'A company is where an engagement, its issues, its meetings and its strategy all hang.'}
          action={canManage && !q && !relation ? <button className="btn-primary" onClick={() => setCompose(true)}><Plus size={15} /> Add the first one</button> : undefined}
        />
      ) : (
        <div style={{ ...card, overflow: 'hidden' }}>
          {companies.map((c) => (
            <Row key={c.id} onClick={() => router.push(`/companies/${c.id}`)}>
              <Building2 size={16} style={{ color: 'var(--ink-3)', flexShrink: 0 }} />
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontWeight: 600, fontSize: 14 }}>{c.name}</div>
                <div style={{ fontSize: 12, color: 'var(--ink-2)' }}>
                  {[c.industry, c.city].filter(Boolean).join(' · ') || 'No industry recorded'}
                </div>
              </div>
              <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                {(c.relations ?? []).map((r) => <Pill key={r.kind}>{humanEnum(r.kind)}</Pill>)}
              </div>
              <div style={{ fontSize: 12, color: 'var(--ink-2)', width: 150, textAlign: 'right' }}>
                {c._count ? `${c._count.issues} issues · ${c._count.projects} projects` : ''}
              </div>
            </Row>
          ))}
        </div>
      )}

      {compose ? (
        <ComposeCompany
          busy={create.isPending}
          onClose={() => setCompose(false)}
          onSubmit={(body) => create.mutate(body)}
        />
      ) : null}
    </div>
  );
}

function ComposeCompany({ onClose, onSubmit, busy }: {
  onClose: () => void;
  onSubmit: (body: Record<string, unknown>) => void;
  busy: boolean;
}) {
  const [name, setName] = useState('');
  const [industry, setIndustry] = useState('');
  const [city, setCity] = useState('');
  const [relations, setRelations] = useState<CsRelationKind[]>(['CLIENT']);

  const toggle = (r: CsRelationKind) =>
    setRelations((prev) => (prev.includes(r) ? prev.filter((x) => x !== r) : [...prev, r]));

  return (
    <div
      onClick={onClose}
      style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,.35)', display: 'grid', placeItems: 'center', zIndex: 60, padding: 16 }}
    >
      <div onClick={(e) => e.stopPropagation()} style={{ ...card, width: 'min(520px,100%)', padding: 20 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
          <h2 style={{ fontSize: 17, fontWeight: 700, margin: 0 }}>New company</h2>
          <button className="btn-ghost" onClick={onClose}><X size={16} /></button>
        </div>

        {/* Deliberately four fields. Spec §29: simple entry, and everything else
            about a company can be filled in from its workspace afterwards. */}
        <label style={{ fontSize: 12, color: 'var(--ink-2)' }}>Name</label>
        <input className="input" style={{ width: '100%', marginBottom: 10 }} value={name} onChange={(e) => setName(e.target.value)} autoFocus />
        <label style={{ fontSize: 12, color: 'var(--ink-2)' }}>Industry</label>
        <input className="input" style={{ width: '100%', marginBottom: 10 }} value={industry} onChange={(e) => setIndustry(e.target.value)} />
        <label style={{ fontSize: 12, color: 'var(--ink-2)' }}>City</label>
        <input className="input" style={{ width: '100%', marginBottom: 12 }} value={city} onChange={(e) => setCity(e.target.value)} />

        <div style={{ fontSize: 12, color: 'var(--ink-2)', marginBottom: 6 }}>What are they to you?</div>
        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 16 }}>
          {RELATIONS.map((r) => (
            <button
              key={r}
              onClick={() => toggle(r)}
              style={{
                fontSize: 12, padding: '4px 10px', borderRadius: 999, cursor: 'pointer',
                border: `1px solid ${relations.includes(r) ? 'var(--brand,#132376)' : 'var(--line-soft)'}`,
                background: relations.includes(r) ? 'var(--brand,#132376)' : 'transparent',
                color: relations.includes(r) ? '#fff' : 'var(--ink-2)',
              }}
            >
              {humanEnum(r)}
            </button>
          ))}
        </div>

        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
          <button className="btn-ghost" onClick={onClose}>Cancel</button>
          <button
            className="btn-primary"
            disabled={!name.trim() || relations.length === 0 || busy}
            onClick={() => onSubmit({
              name: name.trim(),
              ...(industry.trim() ? { industry: industry.trim() } : {}),
              ...(city.trim() ? { city: city.trim() } : {}),
              relations,
            })}
          >
            {busy ? 'Adding…' : 'Add company'}
          </button>
        </div>
      </div>
    </div>
  );
}
