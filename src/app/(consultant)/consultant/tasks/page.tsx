import { Suspense } from 'react';
import { TasksScreen } from '@/features/verticals/consulting/consultant';

export default function TasksPage() {
  return (
    <Suspense fallback={null}>
      <TasksScreen />
    </Suspense>
  );
}
