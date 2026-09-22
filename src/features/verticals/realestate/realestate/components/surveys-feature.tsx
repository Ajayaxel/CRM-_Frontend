'use client';

import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { ClipboardList, Copy, ExternalLink, Trash2, Users, X, MessageSquare } from 'lucide-react';
import { api } from '@/lib/api';
import { useAuth } from '@/features/foundation/auth/hooks/auth-context';

const card: React.CSSProperties = { background: 'var(--surface)', border: '1px solid var(--line-soft)', borderRadius: 16 };

interface SurveyRow { key: string; title: string; active: boolean; questionCount: number; responses: number; createdAt?: string | null }
interface SurveyAnswer { question: string; answer: string | string[] }
interface SurveyResponse { leadId: string; name: string; phone?: string | null; email?: string | null; location?: string | null; at: string; answers: SurveyAnswer[] }

export function SurveysFeature() {
  const qc = useQueryClient();
  const { user } = useAuth();
  const [open, setOpen] = useState<SurveyRow | null>(null);
  const { data } = useQuery({ queryKey: ['re-surveys'], queryFn: async () => (await api.get<SurveyRow[]>('/realestate/surveys')).data });
  const del = useMutation({
    mutationFn: (key: string) => api.delete(`/realestate/surveys/${key}`),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['re-surveys'] }); toast.success('Survey deleted'); },
  });

  // The page is served by the API, but linked through the CRM's own origin —
  // Next proxies /api, so a shared link stays on the domain people trust.
  const slug = user?.organization.slug ?? '';
  const link = (k: string) => `${typeof window !== 'undefined' ? window.location.origin : ''}/api/realestate/survey/${slug}/${k}/page`;
  const rows = data ?? [];
  const totalResponses = rows.reduce((s, r) => s + r.responses, 0);

  return (
    <div style={{ animation: 'fadeUp .4s ease' }}>
      <div style={{ marginBottom: 18 }}>
        <h1 style={{ fontSize: 26, fontWeight: 700, letterSpacing: '-.02em', margin: 0 }}>Surveys</h1>
        <p style={{ fontSize: 14, color: 'var(--ink-2)', margin: '6px 0 0' }}>
          Share the link on WhatsApp. Every response becomes a lead with the respondent&apos;s name, phone and location.
        </p>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(160px,1fr))', gap: 14, marginBottom: 18 }}>
        <Stat label="Live surveys" value={rows.filter((r) => r.active).length} />
        <Stat label="Responses" value={totalResponses} accent="var(--success)" />
      </div>

      {rows.length === 0 && (
        <div style={{ ...card, padding: 44, textAlign: 'center', color: 'var(--ink-3)' }}>
          <ClipboardList size={30} style={{ opacity: 0.4 }} />
          <div style={{ marginTop: 10, fontSize: 14 }}>No surveys yet.</div>
        </div>
      )}

      <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        {rows.map((s) => (
          <div key={s.key} style={{ ...card, padding: 18 }}>
            <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap' }}>
              <div style={{ minWidth: 240, flex: 1 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                  <span style={{ fontWeight: 700, fontSize: 15 }}>{s.title}</span>
                  <span className="badge" style={{ background: 'var(--surface-2)', color: 'var(--ink-3)' }}>{s.questionCount} questions</span>
                  <span className="badge" style={{ background: 'var(--success-bg)', color: 'var(--success)' }}>
                    <Users size={11} style={{ marginRight: 3 }} />{s.responses} responses
                  </span>
                </div>
                <div style={{ display: 'flex', gap: 6, marginTop: 12, flexWrap: 'wrap' }}>
                  <code style={{ flex: '1 1 220px', minWidth: 0, fontSize: 11.5, background: 'var(--surface-3)', padding: '8px 10px', borderRadius: 8, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{link(s.key)}</code>
                  <button className="btn-secondary" style={{ height: 34, width: 36, padding: 0 }} title="Copy link"
                    onClick={() => { navigator.clipboard.writeText(link(s.key)); toast.success('Link copied'); }}><Copy size={14} /></button>
                  <a className="btn-secondary" style={{ height: 34, width: 36, padding: 0, display: 'inline-flex', alignItems: 'center', justifyContent: 'center' }}
                    title="Open survey" href={link(s.key)} target="_blank" rel="noreferrer"><ExternalLink size={14} /></a>
                </div>
              </div>
              <div style={{ display: 'flex', gap: 8, flexShrink: 0 }}>
                <button className="btn-secondary" style={{ height: 34 }} onClick={() => setOpen(s)}>
                  <MessageSquare size={13} /> Responses
                </button>
                <button className="btn-secondary" style={{ height: 34, width: 34, padding: 0 }} title="Delete survey"
                  onClick={() => del.mutate(s.key)}><Trash2 size={13} /></button>
              </div>
            </div>
          </div>
        ))}
      </div>

      {open && <ResponsesModal survey={open} onClose={() => setOpen(null)} />}
    </div>
  );
}

function Stat({ label, value, accent }: { label: string; value: number | string; accent?: string }) {
  return (
    <div style={{ ...card, padding: 16 }}>
      <div style={{ fontSize: 22, fontWeight: 800, color: accent ?? 'var(--ink-1)' }}>{value}</div>
      <div style={{ fontSize: 12, color: 'var(--ink-3)', marginTop: 2 }}>{label}</div>
    </div>
  );
}

function ResponsesModal({ survey, onClose }: { survey: SurveyRow; onClose: () => void }) {
  const { data, isLoading } = useQuery({
    queryKey: ['re-survey-responses', survey.key],
    queryFn: async () => (await api.get<{ total: number; responses: SurveyResponse[] }>(`/realestate/surveys/${survey.key}/responses`)).data,
  });
  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 60, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }}>
      <div style={{ position: 'absolute', inset: 0, background: 'rgba(20,15,12,.42)' }} onClick={onClose} />
      <div style={{ ...card, position: 'relative', zIndex: 1, width: 720, maxWidth: '100%', maxHeight: '86vh', overflow: 'auto', padding: 22, borderRadius: 18 }}>
        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12, marginBottom: 14 }}>
          <div style={{ fontWeight: 700, fontSize: 16, lineHeight: 1.4 }}>{survey.title}</div>
          <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--ink-3)', flexShrink: 0 }}><X size={20} /></button>
        </div>
        {isLoading && <div style={{ color: 'var(--ink-3)', fontSize: 14 }}>Loading…</div>}
        {!isLoading && (data?.responses ?? []).length === 0 && (
          <div style={{ padding: 30, textAlign: 'center', color: 'var(--ink-3)', fontSize: 14 }}>
            No responses yet. Share the link to start collecting.
          </div>
        )}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          {(data?.responses ?? []).map((r) => (
            <div key={r.leadId} style={{ border: '1px solid var(--line-soft)', borderRadius: 12, padding: 14 }}>
              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
                <span style={{ fontWeight: 700, fontSize: 14 }}>{r.name}</span>
                {r.phone && <a href={`tel:${r.phone}`} className="badge" style={{ background: 'var(--surface-2)', color: 'var(--ink-2)' }}>{r.phone}</a>}
                {r.location && <span className="badge" style={{ background: 'var(--surface-2)', color: 'var(--ink-3)' }}>{r.location}</span>}
                <span style={{ fontSize: 11.5, color: 'var(--ink-3)', marginLeft: 'auto' }}>{new Date(r.at).toLocaleDateString()}</span>
              </div>
              {r.email && <div style={{ fontSize: 12.5, color: 'var(--ink-3)', marginTop: 4 }}>{r.email}</div>}
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginTop: 10 }}>
                {r.answers.map((a, i) => (
                  <div key={i} style={{ fontSize: 13, lineHeight: 1.5 }}>
                    <div style={{ color: 'var(--ink-3)' }}>{a.question}</div>
                    <div style={{ fontWeight: 600 }}>{Array.isArray(a.answer) ? a.answer.join(', ') : a.answer}</div>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
