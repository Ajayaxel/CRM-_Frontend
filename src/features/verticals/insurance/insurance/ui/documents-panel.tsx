'use client';

/**
 * The Documents panel for a policy, claim or client.
 *
 * Storage and the upload flow already existed; nothing in the insurance screens
 * ever called them, so every Documents tab was empty no matter how the backend
 * was configured. This is the caller.
 *
 * A broker's day is policy schedules, claim forms and KYC, so this is the most
 * used surface in the vertical after the policy list itself.
 */

import { useRef, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { FileText, UploadCloud, Download, Trash2, AlertTriangle } from 'lucide-react';
import { api, apiErrorMessage } from '@/lib/api';
import { openDocument, useStorageStatus } from '@/features/capabilities/documents/document-uploader';
import { EmptyState } from './kit';

type Doc = {
  id: string; name: string; fileName: string; mimeType: string; sizeBytes: number;
  status: 'READY' | 'PENDING' | 'MISSING'; createdAt: string; kind?: string | null;
  downloadable: boolean; note?: string | null;
  uploadedBy?: { firstName: string; lastName?: string | null } | null;
};

export function DocumentsPanel({
  relatedType, relatedId, folder = 'OTHER', title = 'Documents', unfiledOnly = false,
}: {
  relatedType: 'INS_POLICY' | 'INS_CLAIM' | 'INS_CLIENT';
  relatedId: string;
  folder?: string;
  title?: string;
  /**
   * Hide files that already fill a named slot on the checklist above. Without
   * this the Aadhaar card appears twice on one screen — once as satisfying the
   * requirement, once as a loose file — and deleting the loose copy silently
   * empties the slot.
   */
  unfiledOnly?: boolean;
}) {
  const qc = useQueryClient();
  const storage = useStorageStatus();
  const fileRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);

  const key = ['ins-docs', relatedType, relatedId];
  const { data, isLoading } = useQuery<{ data: Doc[] }>({
    queryKey: key,
    queryFn: async () =>
      (await api.get(`/documents?relatedType=${relatedType}&relatedId=${relatedId}&limit=100`)).data,
  });
  const docs = (data?.data ?? []).filter((d) => !unfiledOnly || !d.kind);

  const upload = useMutation({
    mutationFn: async (file: File) => {
      const intent = (
        await api.post('/documents/upload-intent', {
          fileName: file.name, mimeType: file.type, sizeBytes: file.size,
          name: file.name, folder, relatedType, relatedId,
        })
      ).data;
      // Straight to R2. The signature covers Content-Type, so these exact
      // headers must go with it or the bucket returns an opaque 403.
      const put = await fetch(intent.uploadUrl, { method: 'PUT', body: file, headers: intent.requiredHeaders });
      if (!put.ok) {
        throw new Error(
          put.status === 403
            ? 'Storage rejected the upload — the bucket may not allow uploads from this site.'
            : `Upload failed (${put.status})`,
        );
      }
      // Without this the row stays PENDING and never appears — the upload would
      // silently do nothing, which is worse than an error.
      return (await api.post(`/documents/${intent.documentId}/complete`, {})).data;
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: key }); toast.success('Document uploaded'); },
    onError: (e: any) => toast.error(e?.message ?? apiErrorMessage(e)),
    onSettled: () => { setBusy(false); if (fileRef.current) fileRef.current.value = ''; },
  });

  const remove = useMutation({
    mutationFn: (id: string) => api.delete(`/documents/${id}`),
    onSuccess: () => { qc.invalidateQueries({ queryKey: key }); toast.success('Document removed'); },
    onError: (e) => toast.error(apiErrorMessage(e)),
  });

  if (storage.data && !storage.data.configured) {
    return (
      <div style={{ display: 'flex', gap: 10, alignItems: 'flex-start', padding: 16, borderRadius: 10, background: 'var(--tone-renewal-bg)', color: 'var(--tone-renewal)' }}>
        <AlertTriangle size={17} style={{ flexShrink: 0, marginTop: 1 }} />
        <div style={{ fontSize: 13.5 }}>
          <div style={{ fontWeight: 600 }}>Document storage isn&rsquo;t configured</div>
          <div>Uploads are turned off until it is, rather than accepting a file and losing it.</div>
        </div>
      </div>
    );
  }

  const max = storage.data?.maxBytes ?? 20 * 1024 * 1024;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div>
          <div style={{ fontWeight: 600 }}>{title}</div>
          <div className="ds-caption">
            {docs.length} file{docs.length === 1 ? '' : 's'} · PDF, image, Word or Excel up to {Math.round(max / 1048576)}MB
          </div>
        </div>
        <input
          ref={fileRef}
          type="file"
          style={{ display: 'none' }}
          accept={storage.data?.allowedMimeTypes.join(',')}
          onChange={(e) => {
            const file = e.target.files?.[0];
            if (!file) return;
            if (file.size > max) {
              // Caught here so a 20MB transfer is not spent discovering it.
              toast.error(`That file is ${(file.size / 1048576).toFixed(1)}MB; the limit is ${Math.round(max / 1048576)}MB.`);
              e.target.value = '';
              return;
            }
            setBusy(true);
            upload.mutate(file);
          }}
        />
        <button className="btn-secondary btn-sm" disabled={busy} onClick={() => fileRef.current?.click()}>
          <UploadCloud size={14} /> {busy ? 'Uploading…' : 'Upload'}
        </button>
      </div>

      {isLoading ? (
        <div className="ds-caption" style={{ padding: 20 }}>Loading…</div>
      ) : !docs.length ? (
        <EmptyState
          icon={FileText}
          title={unfiledOnly ? 'Nothing else on file' : 'No documents yet'}
          body={unfiledOnly
            ? 'Anything that does not belong to one of the boxes above goes here.'
            : 'Attach the policy schedule, claim forms or KYC so they sit with the record.'}
          compact
        />
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          {docs.map((d) => (
            <div
              key={d.id}
              style={{
                display: 'flex', alignItems: 'center', gap: 10, padding: '9px 12px',
                border: '1px solid var(--hairline)', borderRadius: 10, background: 'var(--surface)',
              }}
            >
              <FileText size={16} style={{ color: 'var(--navy)', flexShrink: 0 }} />
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 13.5, fontWeight: 500, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {d.name || d.fileName}
                </div>
                <div className="ds-caption">
                  {(d.sizeBytes / 1024).toFixed(0)} KB · {new Date(d.createdAt).toLocaleDateString()}
                  {d.uploadedBy ? ` · ${d.uploadedBy.firstName}` : ''}
                </div>
              </div>
              {/* A lost file says so instead of offering a download that 404s. */}
              {d.status === 'MISSING' ? (
                <span className="ds-caption" title={d.note ?? ''} style={{ color: 'var(--tone-expired)' }}>
                  file missing
                </span>
              ) : (
                <button className="btn-ghost btn-sm" title="Download" onClick={() => openDocument(d.id)}>
                  <Download size={14} />
                </button>
              )}
              <button
                className="btn-ghost btn-sm"
                title="Remove"
                style={{ color: 'var(--tone-expired)' }}
                onClick={() => confirm(`Remove "${d.name || d.fileName}"?`) && remove.mutate(d.id)}
              >
                <Trash2 size={14} />
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
