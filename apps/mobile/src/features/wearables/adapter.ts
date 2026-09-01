import type { SportType, WorkoutSessionCreateInput } from "@moveall/contracts";

export type HealthProvider = "mock" | "apple-health" | "health-connect" | "garmin";
export type HealthPermission =
  "workout" | "heart-rate" | "steps" | "distance" | "calories" | "elevation" | "route";

export const groovHealthPermissions: HealthPermission[] = [
  "workout",
  "heart-rate",
  "steps",
  "distance",
  "calories",
  "elevation",
  "route",
];

export type LiveMetricSample = {
  recordedAt: string;
  values: Record<string, number>;
};

export type WearableAvailability = {
  available: boolean;
  reason?: "unsupported-platform" | "native-build-required" | "provider-not-installed";
};

export interface WearableAdapter {
  readonly provider: HealthProvider;
  availability(): Promise<WearableAvailability>;
  requestPermission(permissions?: HealthPermission[]): Promise<boolean>;
  startSession(sport: SportType): AsyncIterable<LiveMetricSample>;
  stopSession(): Promise<void>;
  importRecentWorkouts(since: Date): Promise<WorkoutSessionCreateInput[]>;
}

export class MockWearableAdapter implements WearableAdapter {
  readonly provider = "mock" as const;

  async availability(): Promise<WearableAvailability> {
    return { available: true };
  }

  async requestPermission(): Promise<boolean> {
    return true;
  }

  async *startSession(): AsyncIterable<LiveMetricSample> {
    yield { recordedAt: new Date().toISOString(), values: { heartRate: 120 } };
  }

  async stopSession(): Promise<void> {}

  async importRecentWorkouts(): Promise<WorkoutSessionCreateInput[]> {
    return [];
  }
}
