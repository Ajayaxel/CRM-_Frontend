'use client';

import { useParams } from 'next/navigation';
import { DocumentRecord } from '@/features/verticals/consulting/consultant';

export default function DocumentRecordPage() {
  const { id } = useParams<{ id: string }>();
  return <DocumentRecord documentId={id} />;
}
