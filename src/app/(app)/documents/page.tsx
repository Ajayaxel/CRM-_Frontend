import type { Metadata } from 'next';
import { DocumentsManagerFeature } from '@/features/capabilities/documents';

export const metadata: Metadata = {
  title: 'Documents | BMN Connect CRM',
  description: 'Manage uploaded files: student records, admission documents, and organization files.',
};

export default function DocumentsPage() {
  return <DocumentsManagerFeature />;
}
