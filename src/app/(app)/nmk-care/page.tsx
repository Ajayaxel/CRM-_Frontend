import { PropertyCarePlansFeature } from '@/features/verticals/realestate/realestate';

export const metadata = {
  title: 'NMK Property Care Plans | BMN CRM',
  description: 'Annual Property Care management plans, multi-property subscriptions, and portfolio tracking.',
};

export default function NmkCarePage() {
  return <PropertyCarePlansFeature />;
}
