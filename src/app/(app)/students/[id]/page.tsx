'use client';

import { StudentDetailFeature } from '@/features/verticals/education/students';
import { useParams } from 'next/navigation';

export default function StudentDetailPage() {
  const { id } = useParams<{ id: string }>();
  return <StudentDetailFeature id={id} />;
}
