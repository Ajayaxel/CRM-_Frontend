'use client';

import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { Building } from 'lucide-react';
import { api } from '@/lib/api';
import { Agent, FilterOptions, Property } from '../agentportal-client';
import { FilterBar, Filters, PropertyCard } from './shared';

const card: React.CSSProperties = { background: 'var(--surface)', border: '1px solid var(--line-soft)', borderRadius: 16 };

export function AgentPropertiesFeature() {
  const qc = useQueryClient();
  const [filters, setFilters] = useState<Filters>({});
  const [agentId, setAgentId] = useState('');
  const { data: agents } = useQuery({ queryKey: ['agents'], queryFn: async () => (await api.get<Agent[]>('/agent-portal/agents')).data });
  const { data: options } = useQuery({ queryKey: ['agent-filter-options'], queryFn: async () => (await api.get<FilterOptions>('/agent-portal/filter-options')).data });
  const qs = new URLSearchParams(Object.entries({ ...filters, agentId: agentId || undefined }).filter(([, v]) => v) as any).toString();
  const { data } = useQuery({ queryKey: ['agent-properties', qs], queryFn: async () => (await api.get<Property[]>(`/agent-portal/properties${qs ? `?${qs}` : ''}`)).data });
  const assign = useMutation({ mutationFn: ({ id, agentId }: { id: string; agentId: string }) => api.patch(`/agent-portal/properties/${id}/agent`, { agentId: agentId || null }), onSuccess: () => { qc.invalidateQueries({ queryKey: ['agent-properties'] }); qc.invalidateQueries({ queryKey: ['agents'] }); toast.success('Agent updated'); } });

  return (
    <div style={{ animation: 'fadeUp .4s ease' }}>
      <div style={{ marginBottom: 18 }}>
        <h1 style={{ fontSize: 26, fontWeight: 700, letterSpacing: '-.02em', margin: 0 }}>Listings</h1>
        <p style={{ fontSize: 14, color: 'var(--ink-2)', margin: '6px 0 0' }}>Every property — filter, and assign an agent to each listing.</p>
      </div>

      <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginBottom: 10, flexWrap: 'wrap' }}>
        <select className="input" style={{ height: 38, width: 200 }} value={agentId} onChange={(e) => setAgentId(e.target.value)}>
          <option value="">All agents</option>
          <option value="unassigned">— Unassigned —</option>
          {(agents ?? []).map((a) => <option key={a.id} value={a.id}>{a.name}</option>)}
        </select>
        <span style={{ fontSize: 12.5, color: 'var(--ink-3)' }}>{(data ?? []).length} propert{(data ?? []).length === 1 ? 'y' : 'ies'}</span>
      </div>
      <FilterBar options={options} value={filters} onChange={setFilters} />

      {(data ?? []).length === 0 && <div style={{ ...card, padding: 44, textAlign: 'center', color: 'var(--ink-3)' }}><Building size={30} style={{ opacity: 0.4 }} /><div style={{ marginTop: 10, fontSize: 14 }}>No properties match these filters.</div></div>}

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(300px,1fr))', gap: 14 }}>
        {(data ?? []).map((p) => (
          <PropertyCard key={p.id} p={p} footer={
            <div style={{ marginTop: 12, paddingTop: 10, borderTop: '1px solid var(--line-soft)' }}>
              <label className="label" style={{ marginBottom: 4 }}>Assigned agent</label>
              <select className="input" style={{ height: 34, fontSize: 12.5 }} value={p.agent?.id ?? ''} onChange={(e) => assign.mutate({ id: p.id, agentId: e.target.value })}>
                <option value="">Unassigned</option>
                {(agents ?? []).map((a) => <option key={a.id} value={a.id}>{a.name}</option>)}
              </select>
            </div>
          } />
        ))}
      </div>
    </div>
  );
}
