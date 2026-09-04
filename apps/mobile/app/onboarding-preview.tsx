import { OnboardingFlow } from "./onboarding";

// Display-only flow: never completes an account's onboarding or requests location.
export default function OnboardingPreviewScreen() {
  return <OnboardingFlow preview />;
}
