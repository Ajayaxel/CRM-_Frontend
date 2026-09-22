'use client';

import { useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { FileText, RotateCcw, Save, Eye, Code2 } from 'lucide-react';
import { api, apiErrorMessage } from '@/lib/api';
import { useAuth } from '@/features/foundation/auth';
import {
  DocKind, DocTemplate, DocSubject, SUBJECT_LABEL, SUBJECT_BLURB, splitTokens,
} from '../documents-client';

const card: React.CSSProperties = { background: 'var(--surface)', border: '1px solid var(--line-soft)', borderRadius: 16 };
const ORDER: DocSubject[] = ['ENGAGEMENT', 'INVOICE', 'EMPLOYEE'];

/**
 * The eleven documents the firm sends, and their markup.
 *
 * The token list beside the editor is not decoration — it is the contract, and
 * the API refuses a save that uses anything outside it. Showing it here is what
 * makes that refusal make sense rather than look arbitrary: a token that is not
 * on this list renders empty, and an offer letter stating no salary does not
 * look like a draft.
 */
export function DocumentTemplatesFeature() {
  const qc = useQueryClient();
  const { hasPermission } = useAuth();
  const canEdit = hasPermission('document.manage');
  const [selected, setSelected] = useState<string | null>(null);
  const [draft, setDraft] = useState<string | null>(null);
  const [tab, setTab] = useState<'markup' | 'preview'>('markup');

  const { data: kinds } = useQuery({
    queryKey: ['doc-kinds'],
    queryFn: async () => (await api.get<DocKind[]>('/documents/generated/kinds')).data,
  });
  const kind = useMemo(() => (kinds ?? []).find((k) => k.key === selected) ?? null, [kinds, selected]);

  const { data: template } = useQuery({
    queryKey: ['doc-template', selected],
    enabled: !!selected,
    queryFn: async () => (await api.get<DocTemplate>(`/documents/generated/templates/${selected}`)).data,
  });
  const { data: preview } = useQuery({
    queryKey: ['doc-preview', selected, template?.version],
    enabled: !!selected && tab === 'preview',
    queryFn: async () => (await api.get<{ html: string }>(`/documents/generated/templates/${selected}/preview`)).data,
  });

  const refresh = () => {
    qc.invalidateQueries({ queryKey: ['doc-template', selected] });
    qc.invalidateQueries({ queryKey: ['doc-preview', selected] });
  };
  const save = useMutation({
    mutationFn: () => api.put(`/documents/generated/templates/${selected}`, { html: draft ?? '' }),
    onSuccess: () => { setDraft(null); refresh(); toast.success('Template saved'); },
    onError: (e) => toast.error(apiErrorMessage(e)),
  });
  const reset = useMutation({
    mutationFn: () => api.delete(`/documents/generated/templates/${selected}`),
    onSuccess: () => { setDraft(null); refresh(); toast.success('Back to the standard template'); },
    onError: (e) => toast.error(apiErrorMessage(e)),
  });

  const body = draft ?? template?.html ?? '';
  const dirty = draft !== null && draft !== template?.html;
  const { scalars, blocks } = kind ? splitTokens(kind.tokens) : { scalars: [], blocks: [] };

  return (
    <div style={{ animation: 'fadeUp .4s ease' }}>
      <div style={{ marginBottom: 18 }}>
        <h1 style={{ fontSize: 26, fontWeight: 700, letterSpacing: '-.02em', margin: 0 }}>Document templates</h1>
        <p style={{ fontSize: 14, color: 'var(--ink-2)', margin: '6px 0 0' }}>
          What every quotation, proposal, letter and certificate looks like when it leaves the firm.
        </p>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'minmax(220px,280px) 1fr', gap: 18, alignItems: 'start' }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          {ORDER.map((subject) => {
            const group = (kinds ?? []).filter((k) => k.subject === subject);
            if (!group.length) return null;
            return (
              <div key={subject} style={{ ...card, padding: 12 }}>
                <div style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '.07em', color: 'var(--ink-3)' }}>
                  {SUBJECT_LABEL[subject]}
                </div>
                <div style={{ fontSize: 11.5, color: 'var(--ink-3)', margin: '2px 0 8px' }}>{SUBJECT_BLURB[subject]}</div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                  {group.map((k) => (
                    <button key={k.key}
                      onClick={() => { setSelected(k.key); setDraft(null); setTab('markup'); }}
                      style={{
                        textAlign: 'left', border: 0, cursor: 'pointer', borderRadius: 8, padding: '7px 9px',
                        background: selected === k.key ? 'var(--brand-bg,#e9ecfb)' : 'transparent',
                        color: selected === k.key ? 'var(--brand,#132376)' : 'var(--ink-1)',
                        fontWeight: selected === k.key ? 650 : 500, fontSize: 13,
                      }}>
                      {k.label}
                      <div style={{ fontSize: 11, color: 'var(--ink-3)', fontWeight: 400 }}>{k.blurb}</div>
                    </button>
                  ))}
                </div>
              </div>
            );
          })}
        </div>

        {!kind && (
          <div style={{ ...card, padding: 48, textAlign: 'center', color: 'var(--ink-3)' }}>
            <FileText size={30} style={{ opacity: 0.4 }} />
            <div style={{ marginTop: 10, fontSize: 14 }}>Pick a document to see how it is written.</div>
          </div>
        )}

        {kind && (
          <div style={{ ...card, padding: 18 }}>
            <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12, flexWrap: 'wrap', marginBottom: 12 }}>
              <div style={{ flex: 1, minWidth: 180 }}>
                <div style={{ fontWeight: 700, fontSize: 16 }}>{kind.label}</div>
                <div style={{ fontSize: 12, color: 'var(--ink-3)', marginTop: 2 }}>
                  {template?.isPackagedDefault
                    ? 'Using the standard template'
                    : `Your own version · v${template?.version ?? 1}`}
                </div>
              </div>
              <div style={{ display: 'flex', gap: 6 }}>
                <button className={tab === 'markup' ? 'btn-primary' : 'btn-secondary'} style={{ height: 32, fontSize: 12.5 }}
                  onClick={() => setTab('markup')}><Code2 size={13} /> Markup</button>
                <button className={tab === 'preview' ? 'btn-primary' : 'btn-secondary'} style={{ height: 32, fontSize: 12.5 }}
                  onClick={() => setTab('preview')}><Eye size={13} /> Preview</button>
              </div>
            </div>

            {tab === 'markup' && (
              <>
                <textarea
                  className="input"
                  readOnly={!canEdit}
                  spellCheck={false}
                  value={body}
                  onChange={(e) => setDraft(e.target.value)}
                  style={{
                    width: '100%', minHeight: 380, fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace',
                    fontSize: 12, lineHeight: 1.6, paddingTop: 10, resize: 'vertical',
                  }}
                />
                {canEdit && (
                  <div style={{ display: 'flex', gap: 8, marginTop: 12, alignItems: 'center', flexWrap: 'wrap' }}>
                    <button className="btn-primary" disabled={!dirty || save.isPending} onClick={() => save.mutate()}>
                      <Save size={14} /> Save
                    </button>
                    {dirty && <button className="btn-secondary" onClick={() => setDraft(null)}>Discard</button>}
                    {!template?.isPackagedDefault && (
                      <button className="btn-secondary" style={{ marginLeft: 'auto' }} onClick={() => reset.mutate()}>
                        <RotateCcw size={13} /> Back to standard
                      </button>
                    )}
                  </div>
                )}
                {!canEdit && (
                  <div style={{ fontSize: 12, color: 'var(--ink-3)', marginTop: 10 }}>
                    Read-only — editing a template needs the Documents permission.
                  </div>
                )}
              </>
            )}

            {tab === 'preview' && (
              <div style={{ border: '1px solid var(--line-soft)', borderRadius: 10, padding: 22, background: '#fff', color: '#111', overflowX: 'auto' }}
                // The preview is server-rendered from the stored template, which
                // the API sanitises with an allow-list on save. Every token is
                // replaced with its own name so a half-filled draft can never be
                // mistaken for a finished document.
                dangerouslySetInnerHTML={{ __html: preview?.html ?? '' }} />
            )}

            <div style={{ marginTop: 16, paddingTop: 14, borderTop: '1px solid var(--line-soft)' }}>
              <div style={{ fontSize: 11.5, fontWeight: 700, color: 'var(--ink-2)', marginBottom: 6 }}>
                What this document may say
              </div>
              <div style={{ fontSize: 11.5, color: 'var(--ink-3)', marginBottom: 8 }}>
                Anything outside this list renders blank, so a save that uses one is refused.
              </div>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
                {scalars.map((t) => (
                  <code key={t} style={{ fontSize: 11, background: 'var(--surface-2)', borderRadius: 5, padding: '2px 6px' }}>
                    {`{{${t}}}`}
                  </code>
                ))}
              </div>
              {blocks.length > 0 && (
                <>
                  <div style={{ fontSize: 11.5, fontWeight: 700, color: 'var(--ink-2)', margin: '12px 0 6px' }}>
                    Repeating sections
                  </div>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
                    {blocks.map((b) => (
                      <code key={b} style={{ fontSize: 11, background: 'var(--surface-2)', borderRadius: 5, padding: '2px 6px' }}>
                        {`{{#${b}}} … {{/${b}}}`}
                      </code>
                    ))}
                  </div>
                </>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
