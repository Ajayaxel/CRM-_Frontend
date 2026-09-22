'use client';

import { useState } from 'react';
import { useMutation } from '@tanstack/react-query';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { ClipboardList, Sun } from 'lucide-react';
import { api, apiErrorMessage } from '@/lib/api';

/**
 * E2 — the solar block on a CRM lead: book the site survey and convert to a project.
 * Rendered only for the SOLAR vertical; the survey booked here rides across on
 * conversion and becomes the survey the design is sized from.
 */
export function SolarLeadPanel({ leadId }: { leadId: string }) {
  const router = useRouter();
  const [scheduledAt, setScheduledAt] = useState('');
  const [notes, setNotes] = useState('');
  const [booked, setBooked] = useState<string | null>(null);

  const book = useMutation({
    mutationFn: () => api.post(`/solar/leads/${leadId}/survey-request`, {
      scheduledAt: scheduledAt ? new Date(scheduledAt).toISOString() : undefined,
      notes: notes || undefined,
    }),
    onSuccess: () => { setBooked(scheduledAt || 'unscheduled'); toast.success('Site survey booked'); },
    onError: (e) => toast.error(apiErrorMessage(e)),
  });
  const convert = useMutation({
    mutationFn: async () => (await api.post<any>(`/solar/leads/${leadId}/convert`, {})).data,
    onSuccess: (p) => { toast.success(`Project ${p.code} created${p.surveys?.length ? ' — survey carried across' : ''}`); router.push('/solar'); },
    onError: (e) => toast.error(apiErrorMessage(e)),
  });

  return (
    <div style={{ background: 'var(--surface)', border: '1px solid var(--line-soft)', borderRadius: 14, padding: 16, marginTop: 14 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontWeight: 700, fontSize: 13.5, marginBottom: 10 }}>
        <Sun size={14} style={{ color: 'var(--gold,#c67c1e)' }} /> Solar
      </div>
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'flex-end' }}>
        <div style={{ flex: '1 1 170px' }}>
          <label className="label" style={{ fontSize: 11 }}>Survey date</label>
          <input className="input" style={{ height: 32, fontSize: 12.5 }} type="datetime-local" value={scheduledAt} onChange={(e) => setScheduledAt(e.target.value)} />
        </div>
        <div style={{ flex: '2 1 200px' }}>
          <label className="label" style={{ fontSize: 11 }}>Notes</label>
          <input className="input" style={{ height: 32, fontSize: 12.5 }} value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Access, roof type…" />
        </div>
        <button className="btn-secondary" style={{ height: 32, fontSize: 12 }} disabled={book.isPending} onClick={() => book.mutate()}>
          <ClipboardList size={12} /> Book survey
        </button>
        <button className="btn-primary" style={{ height: 32, fontSize: 12 }} disabled={convert.isPending} onClick={() => convert.mutate()}>
          Convert to solar project
        </button>
      </div>
      {booked && <div style={{ fontSize: 12, color: 'var(--success,#1e874b)', marginTop: 8 }}>Survey booked — it will carry onto the project when you convert.</div>}
    </div>
  );
}
