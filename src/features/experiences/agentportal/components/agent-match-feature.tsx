'use client';

import { useState } from 'react';
import { useMutation, useQuery } from '@tanstack/react-query';
import { toast } from 'sonner';
import { Sparkles, Wand2, MessageSquareText, Image as ImageIcon } from 'lucide-react';
import { api, apiErrorMessage } from '@/lib/api';
import { Agent, MatchResult, Parsed, TYPE_LABEL, money } from '../agentportal-client';
import { PropertyCard } from './shared';

const card: React.CSSProperties = { background: 'var(--surface)', border: '1px solid var(--line-soft)', borderRadius: 16 };

const SAMPLES = [
  'Hi, looking for a 3 bhk apartment in Bandra under 2.5 cr, ready to move',
  'Need 2bhk on rent near Whitefield, budget 45k, family',
  'Investor here — want a studio or 1bhk in Gachibowli, 40-60 lakh, good rental yield',
];

export function AgentMatchFeature() {
  const { data: agents } = useQuery({ queryKey: ['agents'], queryFn: async () => (await api.get<Agent[]>('/agent-portal/agents')).data });
  const [text, setText] = useState('');
  const [agentId, setAgentId] = useState('');
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [imageUrl, setImageUrl] = useState('');
  const [parsed, setParsed] = useState<Parsed | null>(null);
  const [matches, setMatches] = useState<MatchResult[] | null>(null);
  const [leadId, setLeadId] = useState<string | null>(null);

  const run = useMutation({
    mutationFn: async () => (await api.post('/agent-portal/intake', { text, agentId: agentId || undefined, name: name || undefined, phone: phone || undefined, imageUrl: imageUrl || undefined, source: 'WHATSAPP' })).data as { parsed: Parsed; matches: MatchResult[]; leadId: string },
    onSuccess: (d) => { setParsed(d.parsed); setMatches(d.matches); setLeadId(d.leadId); toast.success(`Lead saved · ${d.matches.length} matches`); },
    onError: (e) => toast.error(apiErrorMessage(e)),
  });

  return (
    <div style={{ animation: 'fadeUp .4s ease' }}>
      <div style={{ marginBottom: 18 }}>
        <h1 style={{ fontSize: 26, fontWeight: 700, letterSpacing: '-.02em', margin: 0 }}>Lead Match</h1>
        <p style={{ fontSize: 14, color: 'var(--ink-2)', margin: '6px 0 0' }}>Paste a WhatsApp / group message (or a photo caption). We extract the requirement and match your listings.</p>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1.1fr 1fr', gap: 16, alignItems: 'start' }}>
        <div style={{ ...card, padding: 18 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12, fontWeight: 700, fontSize: 15 }}><MessageSquareText size={16} /> Incoming enquiry</div>
          <textarea className="input" style={{ minHeight: 110, paddingTop: 10, resize: 'vertical' }} value={text} onChange={(e) => setText(e.target.value)} placeholder="e.g. Looking for a 3 BHK apartment in Bandra under 2.5 cr…" />
          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginTop: 8 }}>
            {SAMPLES.map((s, i) => <button key={i} className="btn-secondary" style={{ height: 26, fontSize: 11 }} onClick={() => setText(s)}>Sample {i + 1}</button>)}
          </div>
          <div style={{ display: 'flex', gap: 10, marginTop: 12 }}>
            <div style={{ flex: 1 }}><label className="label">Lead name</label><input className="input" value={name} onChange={(e) => setName(e.target.value)} placeholder="Optional" /></div>
            <div style={{ flex: 1 }}><label className="label">Phone</label><input className="input" value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="Optional" /></div>
          </div>
          <div style={{ display: 'flex', gap: 10, marginTop: 10 }}>
            <div style={{ flex: 1 }}><label className="label">Assign to agent</label><select className="input" value={agentId} onChange={(e) => setAgentId(e.target.value)}><option value="">Unassigned</option>{(agents ?? []).map((a) => <option key={a.id} value={a.id}>{a.name}</option>)}</select></div>
            <div style={{ flex: 1 }}><label className="label"><ImageIcon size={11} style={{ marginRight: 3, verticalAlign: 'middle' }} />Photo URL</label><input className="input" value={imageUrl} onChange={(e) => setImageUrl(e.target.value)} placeholder="Optional" /></div>
          </div>
          <button className="btn-primary" style={{ marginTop: 14, width: '100%', height: 40 }} disabled={!text.trim() || run.isPending} onClick={() => run.mutate()}><Wand2 size={16} /> {run.isPending ? 'Matching…' : 'Extract & match'}</button>
        </div>

        <div style={{ ...card, padding: 18, minHeight: 160 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12, fontWeight: 700, fontSize: 15 }}><Sparkles size={16} style={{ color: 'var(--brand,#132376)' }} /> Extracted requirement</div>
          {!parsed && <div style={{ fontSize: 13, color: 'var(--ink-3)' }}>Paste a message and hit <b>Extract & match</b> to see the parsed budget, area, BHK and type here.</div>}
          {parsed && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              <Row label="Intent" value={`${parsed.purpose[0] + parsed.purpose.slice(1).toLowerCase()} · ${parsed.leadKind[0] + parsed.leadKind.slice(1).toLowerCase()}`} />
              <Row label="Budget" value={parsed.budgetMinInr || parsed.budgetMaxInr ? `${money(parsed.budgetMinInr)} – ${money(parsed.budgetMaxInr)}` : '—'} />
              <Row label="BHK" value={parsed.bedroomsWanted ? `${parsed.bedroomsWanted} BHK` : '—'} />
              <Row label="Type" value={parsed.propertyTypePref ? TYPE_LABEL[parsed.propertyTypePref] : '—'} />
              <Row label="Area" value={parsed.preferredArea ?? '—'} />
              {parsed.notes.length > 0 && <div style={{ display: 'flex', gap: 5, flexWrap: 'wrap', marginTop: 4 }}>{parsed.notes.map((n, i) => <span key={i} className="badge" style={{ background: 'var(--brand-bg,#e9ecfb)', color: 'var(--brand,#132376)', fontSize: 10.5 }}>{n}</span>)}</div>}
              {leadId && <div style={{ fontSize: 11.5, color: 'var(--success)', marginTop: 6 }}>✓ Saved as a lead in the CRM pipeline</div>}
            </div>
          )}
        </div>
      </div>

      {matches && (
        <div style={{ marginTop: 22 }}>
          <div className="eyebrow" style={{ marginBottom: 12 }}>{matches.length} matching propert{matches.length === 1 ? 'y' : 'ies'} · ranked</div>
          {matches.length === 0 && <div style={{ ...card, padding: 30, textAlign: 'center', color: 'var(--ink-3)', fontSize: 14 }}>No available listings fit this requirement yet.</div>}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(300px,1fr))', gap: 14 }}>
            {matches.map((m) => <PropertyCard key={m.property.id} p={m.property} matchPct={m.matchPct} reasons={m.reasons} />)}
          </div>
        </div>
      )}
    </div>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, borderBottom: '1px solid var(--line-soft)', paddingBottom: 6 }}><span style={{ color: 'var(--ink-3)' }}>{label}</span><span style={{ fontWeight: 600 }}>{value}</span></div>;
}
