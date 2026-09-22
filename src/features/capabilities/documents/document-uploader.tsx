'use client';

/**
 * The one place the browser talks to object storage.
 *
 * Three steps, and the third is the one people leave out: ask the API to
 * authorise an upload, PUT the file straight to R2, then tell the API it landed.
 * Without that last call the row stays PENDING and never appears in a list — the
 * upload silently does nothing, which is worse than an error.
 *
 * The bytes go browser → R2 directly. They never pass through our API, so a
 * 20MB policy schedule costs no server memory and no Railway bandwidth.
 *
 *   POST /documents/upload-intent   -> { documentId, uploadUrl, requiredHeaders }
 *   PUT  <uploadUrl>                 (direct to R2, exact Content-Type required)
 *   POST /documents/:id/complete     -> verified against what the bucket received
 */

import { useRef, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { Paperclip, Upload } from 'lucide-react';
import { api, apiErrorMessage } from '@/lib/api';

export type UploadTarget = {
  relatedType: string;
  relatedId?: string | null;
  folder?: string;
  /** Query keys to refetch once the upload is confirmed. */
  invalidate?: unknown[][];
};

export function useStorageStatus() {
  return useQuery<{ configured: boolean; provider: string; maxBytes: number; allowedMimeTypes: string[] }>({
    queryKey: ['storage-status'],
    queryFn: async () => (await api.get('/documents/storage-status')).data,
    staleTime: 60_000,
  });
}

export function DocumentUploader({ target, label = 'Upload document' }: { target: UploadTarget; label?: string }) {
  const qc = useQueryClient();
  const inputRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const storage = useStorageStatus();

  const upload = useMutation({
    mutationFn: async (file: File) => {
      const intent = (
        await api.post('/documents/upload-intent', {
          fileName: file.name,
          mimeType: file.type,
          sizeBytes: file.size,
          name: file.name,
          relatedType: target.relatedType,
          relatedId: target.relatedId ?? undefined,
          folder: target.folder,
        })
      ).data;

      // Straight to R2. The signature covers Content-Type, so sending a
      // different one here fails with an opaque 403 from the bucket.
      const put = await fetch(intent.uploadUrl, {
        method: 'PUT',
        body: file,
        headers: intent.requiredHeaders,
      });
      if (!put.ok) {
        throw new Error(
          put.status === 403
            ? 'Storage rejected the upload. If this persists the bucket CORS rules may not allow PUT from this domain.'
            : `Upload failed (${put.status})`,
        );
      }

      // Only now is it a document. The API re-reads the size and type from the
      // bucket rather than trusting what this browser claimed.
      return (await api.post(`/documents/${intent.documentId}/complete`, {})).data;
    },
    onSuccess: () => {
      toast.success('Document uploaded');
      for (const key of target.invalidate ?? []) qc.invalidateQueries({ queryKey: key });
      qc.invalidateQueries({ queryKey: ['documents', target.relatedType, target.relatedId] });
    },
    onError: (e: any) => toast.error(e?.message ?? apiErrorMessage(e)),
    onSettled: () => {
      setBusy(false);
      if (inputRef.current) inputRef.current.value = '';
    },
  });

  if (storage.data && !storage.data.configured) {
    return (
      <div className="ds-caption" style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        <Paperclip size={14} />
        Document storage isn&rsquo;t configured on this server yet, so uploads are turned off.
      </div>
    );
  }

  return (
    <>
      <input
        ref={inputRef}
        type="file"
        style={{ display: 'none' }}
        accept={storage.data?.allowedMimeTypes.join(',')}
        onChange={(e) => {
          const file = e.target.files?.[0];
          if (!file) return;
          const max = storage.data?.maxBytes ?? 20 * 1024 * 1024;
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
      <button className="btn-secondary btn-sm" disabled={busy} onClick={() => inputRef.current?.click()}>
        <Upload size={14} /> {busy ? 'Uploading…' : label}
      </button>
    </>
  );
}

/** Fetches a fresh signed link per click — there is no permanent URL to hold. */
export async function openDocument(id: string) {
  try {
    const { url } = (await api.get(`/documents/${id}/download`)).data;
    window.open(url, '_blank', 'noopener,noreferrer');
  } catch (e) {
    toast.error(apiErrorMessage(e));
  }
}
