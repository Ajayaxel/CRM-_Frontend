import { LocationsFeature } from '@/features/verticals/realestate/realestate';

export const metadata = {
  title: 'Location Hierarchy Master | BMN CRM',
  description: 'Dynamic 4-level location hierarchy master (State -> District -> City -> Area).',
};

export default function NmkLocationsPage() {
  return <LocationsFeature />;
}
