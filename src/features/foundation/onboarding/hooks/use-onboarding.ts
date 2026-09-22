'use client';

import { useQuery } from '@tanstack/react-query';
import { api } from '@/lib/api';
import { useAuth } from '@/features/foundation/auth';
import type { OnboardingState } from '../onboarding-client';

/** Shared onboarding state hook — used by the home page and the Topbar "Setup" chip. */
export function useOnboarding() {
  const { user } = useAuth();
  return useQuery({
    queryKey: ['onboarding-state'],
    enabled: !!user,
    queryFn: async () => (await api.get<OnboardingState>('/onboarding/state')).data,
    staleTime: 30_000,
  });
}
