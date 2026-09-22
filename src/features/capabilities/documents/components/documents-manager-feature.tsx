'use client';

import { useEffect, useState, useRef } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { AlertTriangle,
  FolderOpen, Upload, Search, Trash2, Download, Eye, X, FileText,
  Image, FileSpreadsheet, File, AlertCircle
} from 'lucide-react';
import { api, apiErrorMessage } from '@/lib/api';
import { openDocument, useStorageStatus } from '@/features/capabilities/documents/document-uploader';
import { Modal } from '@/components/molecules/modal';
import { Field } from '@/components/molecules/field';
import {
  DocumentRow, DocumentFolder, FOLDER_LABELS, FOLDER_COLORS,
  formatFileSize, isImageMime, isPdfMime, fileIcon, uploaderName
} from '../documents-utils';
import { formatDate } from '@/lib/utils';

const FOLDERS: DocumentFolder[] = ['STUDENT', 'LEAD', 'ADMISSION', 'ORGANIZATION', 'OTHER'];

interface PaginatedDocs {
  data: DocumentRow[];
  meta: { total: number; page: number; limit: number; totalPages: number };
}

// ─── Styles ────────────────────────────────────────────────────────────────────

const card: React.CSSProperties = {
  background: 'var(--surface)',
  border: '1px solid var(--border)',
  borderRadius: 16,
  padding: 24,
};

const tabBar: React.CSSProperties = {
  display: 'flex',
  gap: 8,
  flexWrap: 'wrap',
  marginBottom: 24,
};

const fileGrid: React.CSSProperties = {
  display: 'grid',
  gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))',
  gap: 16,
};

const fileCardStyle = (selected: boolean): React.CSSProperties => ({
  background: selected ? 'color-mix(in srgb, var(--accent) 10%, var(--surface))' : 'var(--surface-2)',
  border: `1px solid ${selected ? 'var(--accent)' : 'var(--border)'}`,
  borderRadius: 12,
  padding: 16,
  cursor: 'pointer',
  transition: 'all 0.2s',
  display: 'flex',
  flexDirection: 'column',
  gap: 10,
  position: 'relative',
});

const emptyState: React.CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
  alignItems: 'center',
  justifyContent: 'center',
  padding: '64px 24px',
  color: 'var(--text-muted)',
  gap: 12,
};

// ─── Component ─────────────────────────────────────────────────────────────────

export function DocumentsManagerFeature() {
  const qc = useQueryClient();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [activeFolder, setActiveFolder] = useState<DocumentFolder | 'ALL'>('ALL');
  const [search, setSearch] = useState('');
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [showUpload, setShowUpload] = useState(false);
  const [showPreview, setShowPreview] = useState(false);
  // The image preview needs a URL the <img> can load, so it asks for an
  // INLINE signed link — granted by the API only for real image types.
  // Fetched while the modal is open and dropped when it closes, so no
  // usable URL outlives the view.
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const storage = useStorageStatus();

  // Upload form state
  const [uploadFile, setUploadFile] = useState<File | null>(null);
  const [uploadName, setUploadName] = useState('');
  const [uploadFolder, setUploadFolder] = useState<DocumentFolder>('OTHER');

  // Query
  const params = new URLSearchParams();
  if (activeFolder !== 'ALL') params.set('folder', activeFolder);
  if (search) params.set('search', search);
  params.set('limit', '100');

  const { data, isLoading } = useQuery<PaginatedDocs>({
    queryKey: ['documents', activeFolder, search],
    queryFn: async () => (await api.get<PaginatedDocs>(`/documents?${params.toString()}`)).data,
  });

  const docs = data?.data ?? [];
  const selectedDoc = docs.find((d) => d.id === selectedId) ?? null;

  // Upload mutation
  const uploadMutation = useMutation({
    mutationFn: async () => {
      if (!uploadFile) throw new Error('No file selected');
      const intent = (await api.post('/documents/upload-intent', {
        fileName: uploadFile.name,
        mimeType: uploadFile.type,
        sizeBytes: uploadFile.size,
        name: uploadName || uploadFile.name,
        folder: uploadFolder,
      })).data;
      const put = await fetch(intent.uploadUrl, { method: 'PUT', body: uploadFile, headers: intent.requiredHeaders });
      if (!put.ok) throw new Error(`Storage rejected the upload (${put.status})`);
      return api.post(`/documents/${intent.documentId}/complete`, {});
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['documents'] });
      toast.success('File uploaded successfully');
      setShowUpload(false);
      setUploadFile(null);
      setUploadName('');
      setUploadFolder('OTHER');
    },
    onError: (e) => toast.error(apiErrorMessage(e)),
  });

  // Delete mutation
  const deleteMutation = useMutation({
    mutationFn: (id: string) => api.delete(`/documents/${id}`),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['documents'] });
      toast.success('Document deleted');
      setSelectedId(null);
    },
    onError: (e) => toast.error(apiErrorMessage(e)),
  });

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0];
    if (!f) return;
    setUploadFile(f);
    if (!uploadName) setUploadName(f.name);
  }

  function renderFileIcon(mimeType: string, size = 32) {
    const style: React.CSSProperties = { width: size, height: size, opacity: 0.7 };
    if (isImageMime(mimeType)) return <Image style={style} />;
    if (isPdfMime(mimeType)) return <FileText style={style} color="var(--accent)" />;
    if (mimeType.includes('sheet') || mimeType.includes('excel')) return <FileSpreadsheet style={style} color="#16a34a" />;
    return <File style={style} />;
  }

  return (
    <div style={{ padding: 24, display: 'flex', flexDirection: 'column', gap: 20 }}>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 12 }}>
        <div>
          <h1 style={{ fontSize: 22, fontWeight: 700, margin: 0, display: 'flex', alignItems: 'center', gap: 8 }}>
            <FolderOpen size={22} color="var(--accent)" /> Documents
          </h1>
          <p style={{ margin: 0, color: 'var(--text-muted)', fontSize: 14 }}>
            {data?.meta.total ?? 0} file{data?.meta.total !== 1 ? 's' : ''} stored
          </p>
        </div>
        {/* Offering an upload that cannot succeed is how "it just does nothing"
            happens. When storage is not wired up, say so instead. */}
        {storage.data && !storage.data.configured ? (
          <div
            style={{
              display: 'flex', alignItems: 'center', gap: 8, fontSize: 13,
              color: 'var(--ink-2)', border: '1px solid var(--hairline)',
              borderRadius: 10, padding: '10px 16px',
            }}
            title="Set R2_ACCOUNT_ID, R2_ACCESS_KEY_ID, R2_SECRET_ACCESS_KEY and R2_BUCKET on the api service"
          >
            <AlertTriangle size={15} /> Document storage isn&rsquo;t configured yet — uploads are off
          </div>
        ) : (
          <button
            id="btn-upload-document"
            onClick={() => setShowUpload(true)}
            style={{
              background: 'var(--accent)', color: '#fff', border: 'none',
              borderRadius: 10, padding: '10px 20px', fontWeight: 600,
              cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 8, fontSize: 14,
            }}
          >
            <Upload size={16} /> Upload File
          </button>
        )}
      </div>

      {/* Folder Tabs */}
      <div style={tabBar}>
        {(['ALL', ...FOLDERS] as const).map((folder) => {
          const active = activeFolder === folder;
          const color = folder === 'ALL' ? 'var(--accent)' : FOLDER_COLORS[folder];
          return (
            <button
              key={folder}
              id={`tab-folder-${folder.toLowerCase()}`}
              onClick={() => setActiveFolder(folder)}
              style={{
                padding: '8px 18px', borderRadius: 20, fontSize: 13, fontWeight: 600,
                border: `2px solid ${active ? color : 'var(--border)'}`,
                background: active ? `color-mix(in srgb, ${color} 12%, transparent)` : 'transparent',
                color: active ? color : 'var(--text-muted)',
                cursor: 'pointer', transition: 'all 0.2s',
              }}
            >
              {folder === 'ALL' ? '📁 All Files' : `${fileIcon(folder)} ${FOLDER_LABELS[folder]}`}
            </button>
          );
        })}
      </div>

      {/* Search */}
      <div style={{ ...card, padding: '10px 14px', display: 'flex', alignItems: 'center', gap: 10 }}>
        <Search size={16} color="var(--text-muted)" />
        <input
          id="input-document-search"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search by file name…"
          style={{
            flex: 1, background: 'transparent', border: 'none', outline: 'none',
            color: 'var(--text)', fontSize: 14,
          }}
        />
        {search && (
          <button onClick={() => setSearch('')} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)' }}>
            <X size={14} />
          </button>
        )}
      </div>

      {/* File Grid */}
      <div style={card}>
        {isLoading ? (
          <div style={emptyState}>
            <div className="spinner" style={{ width: 32, height: 32, border: '3px solid var(--border)', borderTop: '3px solid var(--accent)', borderRadius: '50%' }} />
            <span>Loading documents…</span>
          </div>
        ) : docs.length === 0 ? (
          <div style={emptyState}>
            <FolderOpen size={48} strokeWidth={1.5} />
            <span style={{ fontSize: 16, fontWeight: 600 }}>No documents found</span>
            <span style={{ fontSize: 13 }}>Upload your first file to get started</span>
          </div>
        ) : (
          <div style={fileGrid}>
            {docs.map((doc) => (
              <div
                key={doc.id}
                id={`doc-card-${doc.id}`}
                style={fileCardStyle(selectedId === doc.id)}
                onClick={() => setSelectedId(selectedId === doc.id ? null : doc.id)}
              >
                {/* File icon */}
                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  <div style={{
                    width: 44, height: 44, borderRadius: 10, background: 'var(--surface)',
                    display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 22,
                  }}>
                    {fileIcon(doc.mimeType)}
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontWeight: 600, fontSize: 13, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', color: 'var(--text)' }}>
                      {doc.name}
                    </div>
                    <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>{formatFileSize(doc.sizeBytes)}</div>
                  </div>
                </div>

                {/* Folder badge */}
                <div style={{
                  display: 'inline-flex', alignItems: 'center', gap: 4,
                  fontSize: 11, fontWeight: 600, padding: '2px 8px', borderRadius: 20,
                  background: `color-mix(in srgb, ${FOLDER_COLORS[doc.folder]} 12%, transparent)`,
                  color: FOLDER_COLORS[doc.folder], width: 'fit-content',
                }}>
                  {FOLDER_LABELS[doc.folder]}
                </div>

                {/* Meta */}
                <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>
                  {formatDate(doc.createdAt)} · {uploaderName(doc)}
                </div>

                {/* Actions row */}
                <div style={{ display: 'flex', gap: 8 }}>
                  <button
                    id={`btn-download-${doc.id}`}
                    onClick={(e) => { e.stopPropagation(); openDocument(doc.id); }}
                    style={{
                      flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 4,
                      padding: '6px 0', borderRadius: 8, background: 'var(--surface)',
                      border: '1px solid var(--border)', color: 'var(--text-muted)',
                      fontSize: 12, fontWeight: 600, textDecoration: 'none', cursor: 'pointer',
                    }}
                  >
                    <Download size={12} /> Download
                  </button>
                  {isImageMime(doc.mimeType) && (
                    <button
                      id={`btn-preview-${doc.id}`}
                      onClick={(e) => { e.stopPropagation(); setSelectedId(doc.id); setShowPreview(true); }}
                      style={{
                        flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 4,
                        padding: '6px 0', borderRadius: 8, background: 'color-mix(in srgb, var(--accent) 10%, transparent)',
                        border: '1px solid var(--accent)', color: 'var(--accent)',
                        fontSize: 12, fontWeight: 600, cursor: 'pointer',
                      }}
                    >
                      <Eye size={12} /> Preview
                    </button>
                  )}
                  <button
                    id={`btn-delete-${doc.id}`}
                    onClick={(e) => {
                      e.stopPropagation();
                      if (confirm(`Delete "${doc.name}"? This cannot be undone.`)) {
                        deleteMutation.mutate(doc.id);
                      }
                    }}
                    style={{
                      padding: '6px 10px', borderRadius: 8, background: 'transparent',
                      border: '1px solid #ef4444', color: '#ef4444',
                      fontSize: 12, cursor: 'pointer',
                    }}
                  >
                    <Trash2 size={12} />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Upload Modal */}
      <Modal open={showUpload} onClose={() => setShowUpload(false)} title="Upload Document">
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          {/* File picker */}
          <div
            id="dropzone-upload"
            onClick={() => fileInputRef.current?.click()}
            style={{
              border: '2px dashed var(--border)', borderRadius: 12, padding: '32px 16px',
              textAlign: 'center', cursor: 'pointer', transition: 'border-color 0.2s',
              background: 'var(--surface-2)',
            }}
          >
            <input ref={fileInputRef} type="file" hidden onChange={handleFileChange} />
            {uploadFile ? (
              <div>
                <div style={{ fontSize: 28 }}>{fileIcon(uploadFile.type)}</div>
                <div style={{ fontWeight: 600, marginTop: 8 }}>{uploadFile.name}</div>
                <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>{formatFileSize(uploadFile.size)}</div>
              </div>
            ) : (
              <div>
                <Upload size={32} style={{ opacity: 0.4 }} />
                <div style={{ marginTop: 8, fontWeight: 600 }}>Click to select a file</div>
                <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>PDF, DOCX, XLSX, Images, CSV · Max 20 MB</div>
              </div>
            )}
          </div>

          <Field label="Display Name">
            <input
              id="upload-name"
              value={uploadName}
              onChange={(e) => setUploadName(e.target.value)}
              placeholder="Optional — defaults to file name"
              style={{
                width: '100%', padding: '10px 12px', borderRadius: 8,
                border: '1px solid var(--border)', background: 'var(--surface)',
                color: 'var(--text)', fontSize: 14, boxSizing: 'border-box',
              }}
            />
          </Field>

          <Field label="Folder">
            <select
              id="upload-folder"
              value={uploadFolder}
              onChange={(e) => setUploadFolder(e.target.value as DocumentFolder)}
              style={{
                width: '100%', padding: '10px 12px', borderRadius: 8,
                border: '1px solid var(--border)', background: 'var(--surface)',
                color: 'var(--text)', fontSize: 14,
              }}
            >
              {FOLDERS.map((f) => (
                <option key={f} value={f}>{FOLDER_LABELS[f]}</option>
              ))}
            </select>
          </Field>

          <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
            <button
              onClick={() => setShowUpload(false)}
              style={{ padding: '10px 20px', borderRadius: 8, background: 'var(--surface-2)', border: '1px solid var(--border)', cursor: 'pointer', fontWeight: 600 }}
            >
              Cancel
            </button>
            <button
              id="btn-confirm-upload"
              disabled={!uploadFile || uploadMutation.isPending}
              onClick={() => uploadMutation.mutate()}
              style={{
                padding: '10px 20px', borderRadius: 8, background: 'var(--accent)', color: '#fff',
                border: 'none', cursor: uploadFile && !uploadMutation.isPending ? 'pointer' : 'not-allowed',
                fontWeight: 600, opacity: !uploadFile ? 0.5 : 1,
              }}
            >
              {uploadMutation.isPending ? 'Uploading…' : 'Upload'}
            </button>
          </div>
        </div>
      </Modal>

      {/* Image Preview Modal */}
      {selectedDoc && showPreview && isImageMime(selectedDoc.mimeType) && (
        <Modal
          open={showPreview}
          onClose={() => { setShowPreview(false); setPreviewUrl(null); }}
          title={selectedDoc.name}
        >
          <div style={{ textAlign: 'center' }}>
            <ImagePreview docId={selectedDoc.id} url={previewUrl} onUrl={setPreviewUrl} />
            <img
              src={previewUrl ?? undefined}
              alt={selectedDoc.name}
              style={{ maxWidth: '100%', maxHeight: '70vh', borderRadius: 8, objectFit: 'contain' }}
            />
            <div style={{ marginTop: 12, display: 'flex', justifyContent: 'center', gap: 10 }}>
              <button onClick={() => openDocument(selectedDoc.id)}
                style={{
                  padding: '8px 18px', borderRadius: 8, background: 'var(--accent)', color: '#fff',
                  textDecoration: 'none', fontWeight: 600, display: 'flex', alignItems: 'center', gap: 6, fontSize: 14,
                }}>
                <Download size={14} /> Download
              </button>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
}

/**
 * Asks for an INLINE signed link once the preview opens. Separate component so
 * the fetch has a mount/unmount lifecycle: fired on render it would re-sign on
 * every keystroke elsewhere in the page.
 */
function ImagePreview({ docId, url, onUrl }: { docId: string; url: string | null; onUrl: (u: string | null) => void }) {
  useEffect(() => {
    let cancelled = false;
    api
      .get(`/documents/${docId}/download?inline=1`)
      .then((r) => { if (!cancelled) onUrl(r.data.url); })
      .catch(() => { if (!cancelled) onUrl(null); });
    return () => { cancelled = true; };
  }, [docId, onUrl]);
  return url ? null : <div className="ds-caption" style={{ padding: 20 }}>Loading preview…</div>;
}
