/** Prevent navigation decisions using onboarding data from an earlier session. */
export function isOnboardingPending(
  loading: boolean,
  resolvedFor: string | null,
  currentSessionKey: string | null,
) {
  return loading || resolvedFor !== currentSessionKey;
}
