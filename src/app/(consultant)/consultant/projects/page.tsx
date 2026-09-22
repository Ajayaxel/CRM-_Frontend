import { Suspense } from 'react';
import { ProjectsScreen } from '@/features/verticals/consulting/consultant';

export default function ProjectsPage() {
  return (
    <Suspense fallback={null}>
      <ProjectsScreen />
    </Suspense>
  );
}
