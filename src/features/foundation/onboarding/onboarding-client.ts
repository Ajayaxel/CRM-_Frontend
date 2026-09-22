export interface OnboardingStep {
  key: string;
  label: string;
  why: string;
  cta: { label: string; href: string };
  track: string;
  manualOnly: boolean;
  activation: boolean;
  done: boolean;
  dataDone: boolean;
  dismissed: boolean;
}

export interface OnboardingTrack {
  track: string;
  label: string;
  total: number;
  done: number;
  percent: number;
  activated: boolean;
}

export interface OnboardingState {
  tracks: OnboardingTrack[];
  steps: OnboardingStep[];
  skipped: boolean;
  activated: boolean;
  activatedAt?: string | null;
  percent: number;
}
