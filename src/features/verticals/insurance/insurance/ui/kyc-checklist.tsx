'use client';

/**
 * The client's paperwork as a checklist, not a folder.
 *
 * "Files on this client · 2 files" told you what was there. It could not tell
 * you what was MISSING, which is the only question anybody asks of KYC — the
 * PAN card nobody chased is discovered by the insurer at underwriting or by the
 * surveyor at claim, both of which are far too late.
 *
 * So each expected document gets a box. A filled box shows the file; an empty
 * box states what it is for and offers to fill it. The gaps are the point.
 *
 * WHICH boxes depends on what the client actually holds: the RC book and
 * driving licence appear only once there is a vehicle on the book, because a
 * permanently empty slot on a health-only customer teaches people that empty
 * slots are normal.
 */

import { useRef, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { Check, Download, FileText, Trash2, UploadCloud } from 'lucide-react';
import { api, apiErrorMessage } from '@/lib/api';
import { openDocument, useStorageStatus } from '@/features/capabilities/documents/document-uploader';
import { Badge } from './kit';
import { kindsForClient, type ClientDocumentKind } from './document-kinds';

type Doc = {
  id: string; name: string; fileName: string; sizeBytes: number;
  status: 'READY' | 'PENDING' | 'MISSING'; createdAt: string; kind?: string | null;
};

export function KycChecklist({
  clientId, categories,
}: {
  clientId: string;
  /** Every category this client holds — decides whether motor slots appear. */
  categories: (string | null | undefined)[];
}) {
  const qc = useQueryClient();
  const storage = useStorageStatus();
  const key = ['ins-docs', 'INS_CLIENT', clientId];

  const { data } = useQuery<{ data: Doc[] }>({
    queryKey: key,
    queryFn: async () =>
      (await api.get(`/documents?relatedType=INS_CLIENT&relatedId=${clientId}&limit=100`)).data,
  });
  const docs = data?.data ?? [];

  const slots = kindsForClient(categories);
  const filled = slots.filter((s) => docs.some((d) => d.kind === s.key)).length;

  if (storage.data && !storage.data.configured) return null;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
        <div style={{ flex: 1 }}>
          <div style={{ fontWeight: 600 }}>Documents on file</div>
          <div className="ds-caption">
            {filled === slots.length
              ? 'Everything asked for is here'
              : `${slots.length - filled} still to collect`}
          </div>
        </div>
        <Badge tone={filled === slots.length ? 'active' : 'renewal'}>
          {filled} of {slots.length}
        </Badge>
      </div>

      <div className="ds-grid ds-grid-cards">
        {slots.map((slot) => (
          <Slot
            key={slot.key}
            slot={slot}
            clientId={clientId}
            docs={docs.filter((d) => d.kind === slot.key)}
            maxBytes={storage.data?.maxBytes ?? 20 * 1024 * 1024}
            accept={storage.data?.allowedMimeTypes.join(',')}
            onChanged={() => qc.invalidateQueries({ queryKey: key })}
          />
        ))}
      </div>
    </div>
  );
}

function Slot({
  slot, clientId, docs, maxBytes, accept, onChanged,
}: {
  slot: ClientDocumentKind;
  clientId: string;
  docs: Doc[];
  maxBytes: number;
  accept?: string;
  onChanged: () => void;
}) {
  const fileRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const has = docs.length > 0;

  const upload = useMutation({
    mutationFn: async (file: File) => {
      const intent = (
        await api.post('/documents/upload-intent', {
          fileName: file.name, mimeType: file.type, sizeBytes: file.size,
          name: slot.label, folder: 'OTHER', relatedType: 'INS_CLIENT', relatedId: clientId,
          // The whole point: the file says which slot it fills.
          kind: slot.key,
        })
      ).data;
      const put = await fetch(intent.uploadUrl, { method: 'PUT', body: file, headers: intent.requiredHeaders });
      if (!put.ok) {
        throw new Error(
          put.status === 403
            ? 'Storage rejected the upload — the bucket may not allow uploads from this site.'
            : `Upload failed (${put.status})`,
        );
      }
      return (await api.post(`/documents/${intent.documentId}/complete`, {})).data;
    },
    onSuccess: () => { onChanged(); toast.success(`${slot.label} uploaded`); },
    onError: (e: any) => toast.error(e?.message ?? apiErrorMessage(e)),
    onSettled: () => { setBusy(false); if (fileRef.current) fileRef.current.value = ''; },
  });

  const remove = useMutation({
    mutationFn: (id: string) => api.delete(`/documents/${id}`),
    onSuccess: () => { onChanged(); toast.success(`${slot.label} removed`); },
    onError: (e) => toast.error(apiErrorMessage(e)),
  });

  return (
    <div
      style={{
        display: 'flex', flexDirection: 'column', gap: 8, padding: 14, borderRadius: 12,
        border: has ? '1px solid var(--hairline)' : '1px dashed var(--hairline-strong)',
        background: has ? 'var(--surface)' : 'transparent',
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        {has
          ? <Check size={15} style={{ color: 'var(--tone-active)', flexShrink: 0 }} aria-hidden="true" />
          : <FileText size={15} style={{ color: 'var(--ink-3)', flexShrink: 0 }} aria-hidden="true" />}
        <span style={{ fontWeight: 600, fontSize: 13.5, flex: 1 }}>{slot.label}</span>
        {!has && <span className="ds-caption">Not on file</span>}
      </div>
      <div className="ds-caption">{slot.blurb}</div>

      {docs.map((d) => (
        <div key={d.id} style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <span
            className="ds-caption"
            style={{ flex: 1, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}
            title={d.fileName}
          >
            {d.fileName}
          </span>
          {/* A row that lost its file says so rather than offering a 404. */}
          {d.status === 'MISSING' ? (
            <span className="ds-caption" style={{ color: 'var(--tone-expired)' }}>file missing</span>
          ) : (
            <button className="btn-ghost btn-sm" title="Download" onClick={() => openDocument(d.id)}>
              <Download size={13} />
            </button>
          )}
          <button
            className="btn-ghost btn-sm"
            title="Remove"
            style={{ color: 'var(--tone-expired)' }}
            onClick={() => confirm(`Remove the ${slot.label.toLowerCase()}?`) && remove.mutate(d.id)}
          >
            <Trash2 size={13} />
          </button>
        </div>
      ))}

      <input
        ref={fileRef}
        type="file"
        style={{ display: 'none' }}
        accept={accept}
        onChange={(e) => {
          const file = e.target.files?.[0];
          if (!file) return;
          if (file.size > maxBytes) {
            toast.error(`That file is ${(file.size / 1048576).toFixed(1)}MB; the limit is ${Math.round(maxBytes / 1048576)}MB.`);
            e.target.value = '';
            return;
          }
          setBusy(true);
          upload.mutate(file);
        }}
      />
      {/* A single-file slot that is already filled hides Upload: replacing is
          delete-then-upload, so the old file is never silently orphaned. */}
      {(!has || slot.multiple) && (
        <button
          className={has ? 'btn-ghost btn-sm' : 'btn-secondary btn-sm'}
          disabled={busy}
          style={{ alignSelf: 'flex-start', marginTop: 'auto' }}
          onClick={() => fileRef.current?.click()}
        >
          <UploadCloud size={13} /> {busy ? 'Uploading…' : has ? 'Add another' : 'Upload'}
        </button>
      )}
    </div>
  );
}
