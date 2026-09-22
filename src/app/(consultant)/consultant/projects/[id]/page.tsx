'use client';

import { useParams } from 'next/navigation';
import { ProjectRecord } from '@/features/verticals/consulting/consultant';

export default function ProjectRecordPage() {
  const { id } = useParams<{ id: string }>();
  return <ProjectRecord projectId={id} />;
}
