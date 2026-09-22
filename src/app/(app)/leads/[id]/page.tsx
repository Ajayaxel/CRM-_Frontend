'use client';

import { LeadDetailFeature } from '@/features/capabilities/leads';
import { useParams } from 'next/navigation';

export default function LeadDetailPage() {
  const { id } = useParams<{ id: string }>();
  return <LeadDetailFeature id={id} />;
}
