import type { SportType, WorkoutSessionCreateInput } from "@moveall/contracts";
import type {
  HealthPermission,
  HealthProvider,
  LiveMetricSample,
  HealthImportCandidate,
} from "./adapter";

export type NativeHealthBridge = {
  readonly supportsLiveMetrics: boolean;
  isAvailable(): Promise<boolean>;
  requestPermissions(permissions: HealthPermission[]): Promise<boolean>;
  startWorkout(sport: SportType): Promise<string>;
  readLiveSample(sessionId: string): Promise<LiveMetricSample | null>;
  stopWorkout(sessionId: string): Promise<void>;
  readWorkouts(sinceIso: string, untilIso: string): Promise<HealthImportCandidate[]>;
  writeWorkout(workout: WorkoutSessionCreateInput): Promise<boolean>;
};

export function nativeHealthBridge(
  _provider: Exclude<HealthProvider, "mock" | "garmin">,
): NativeHealthBridge | null {
  return null;
}
