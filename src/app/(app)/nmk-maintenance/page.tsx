import { TaskMaintenanceFeature } from '@/features/verticals/realestate/realestate';

export const metadata = {
  title: 'Task-Based Maintenance & Quotes | BMN CRM',
  description: 'Task-based maintenance requests, itemized quotes, customer approval, and before/after photos.',
};

export default function NmkMaintenancePage() {
  return <TaskMaintenanceFeature />;
}
