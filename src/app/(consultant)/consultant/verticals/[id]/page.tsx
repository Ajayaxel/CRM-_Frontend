'use client';

import { useParams } from 'next/navigation';
import { VerticalRecord } from '@/features/verticals/consulting/consultant';

export default function VerticalRecordPage() {
  const { id } = useParams<{ id: string }>();
  return <VerticalRecord verticalId={id} />;
}
