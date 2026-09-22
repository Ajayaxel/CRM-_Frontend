'use client';

import { DashboardFeature } from '@/features/capabilities/dashboard';
import { RealEstateDashboard } from '@/features/verticals/realestate/realestate';
import { SolarDashboard } from '@/features/verticals/solar/solar';
import { RetailDashboard } from '@/features/verticals/retail/retail';
import { InsuranceDashboard } from '@/features/verticals/insurance/insurance/screens/dashboard';
import { CoworkingDashboard } from '@/features/verticals/coworking/coworking';
import { PoultryDashboard } from '@/features/verticals/poultry/poultry';
import { FrontDeskFeature } from '@/features/verticals/hotel/hotel';
import { useAuth } from '@/features/foundation/auth';
import { InstituteDashboard } from '@/features/verticals/education/institute-dashboard';

export default function DashboardPage() {
  const { user } = useAuth();
  const vertical = user?.organization?.vertical;
  if (vertical === 'REAL_ESTATE') return <RealEstateDashboard />;
  if (vertical === 'SOLAR') return <SolarDashboard />;
  if (vertical === 'RETAIL') return <RetailDashboard />;
  if (vertical === 'INSURANCE') return <InsuranceDashboard />;
  if (vertical === 'COWORKING') return <CoworkingDashboard />;
  if (vertical === 'POULTRY') return <PoultryDashboard />;
  // A residency's dashboard IS the front desk. Sign-in pushes /dashboard, so
  // without this a receptionist lands on enrolment funnels and lead conversion
  // — somebody else's business — and has to navigate to their own screen.
  if (vertical === 'HOTEL') return <FrontDeskFeature />;
  // AIMER and every institute get the branded "Institution overview" — white-
  // labelled per org (primaryColor). The generic fallback below is only reached
  // by a vertical that has no dashboard of its own.
  if (vertical === 'INSTITUTE') return <InstituteDashboard />;
  // The fallback is written in institute vocabulary — enrolments, admissions,
  // average fee. A vertical that reaches it sees somebody else's business.
  return <DashboardFeature />;
}
