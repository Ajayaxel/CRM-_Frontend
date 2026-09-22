// ─── Local type aliases to avoid importing from @prisma/client in the web app ───
export type DocumentFolder = 'STUDENT' | 'LEAD' | 'ADMISSION' | 'ORGANIZATION' | 'OTHER';
export type RelatedEntity = 'NONE' | 'LEAD' | 'STUDENT';

export interface DocumentRow {
  id: string;
  name: string;
  fileName: string;
  mimeType: string;
  sizeBytes: number;
  storageKey: string;
  folder: DocumentFolder;
  relatedType: RelatedEntity;
  relatedId?: string | null;
  url: string;
  createdAt: string;
  uploadedBy?: { id: string; firstName: string; lastName: string } | null;
}

export const FOLDER_LABELS: Record<DocumentFolder, string> = {
  STUDENT: 'Students',
  LEAD: 'Leads',
  ADMISSION: 'Admissions',
  ORGANIZATION: 'Organization',
  OTHER: 'Other',
};

export const FOLDER_COLORS: Record<DocumentFolder, string> = {
  STUDENT: 'var(--accent)',
  LEAD: '#7c3aed',
  ADMISSION: '#0891b2',
  ORGANIZATION: '#d97706',
  OTHER: 'var(--text-muted)',
};

export function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export function isImageMime(mimeType: string): boolean {
  return mimeType.startsWith('image/');
}

export function isPdfMime(mimeType: string): boolean {
  return mimeType === 'application/pdf';
}

export function fileIcon(mimeType: string): string {
  if (isImageMime(mimeType)) return '🖼️';
  if (isPdfMime(mimeType)) return '📄';
  if (mimeType.includes('word')) return '📝';
  if (mimeType.includes('excel') || mimeType.includes('spreadsheet')) return '📊';
  if (mimeType.includes('csv') || mimeType.includes('text')) return '📃';
  return '📎';
}

export function uploaderName(doc: DocumentRow): string {
  if (!doc.uploadedBy) return 'Unknown';
  return `${doc.uploadedBy.firstName} ${doc.uploadedBy.lastName}`.trim();
}
