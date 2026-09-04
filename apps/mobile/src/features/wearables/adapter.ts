import type { SportType, WorkoutSessionCreateInput } from "@moveall/contracts";

export type HealthProvider = "mock" | "apple-health" | "health-connect" | "garmin";
export type HealthPermission =
  | "workout"
  | "heart-rate"
  | "respiratory-rate"
  | "steps"
  | "distance"
  | "calories"
  | "elevation"
  | "route";

export const groovHealthPermissions: HealthPermission[] = [
  "workout",
  "heart-rate",
  "respiratory-rate",
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

export type WearableCapabilities = {
  importWorkouts: boolean;
  exportWorkouts: boolean;
  automaticSync: boolean;
  liveMetrics: boolean;
};

export interface WearableAdapter {
  readonly provider: HealthProvider;
  readonly capabilities: WearableCapabilities;
  availability(): Promise<WearableAvailability>;
  requestPermission(permissions?: HealthPermission[]): Promise<boolean>;
  startSession(sport: SportType): AsyncIterable<LiveMetricSample>;
  stopSession(): Promise<void>;
  importRecentWorkouts(since: Date): Promise<WorkoutSessionCreateInput[]>;
  exportWorkout(workout: WorkoutSessionCreateInput): Promise<boolean>;
}

export class MockWearableAdapter implements WearableAdapter {
  readonly provider = "mock" as const;
  readonly capabilities = {
    importWorkouts: false,
    exportWorkouts: false,
    automaticSync: false,
    liveMetrics: false,
  } as const;

  async availability(): Promise<WearableAvailability> {
    return { available: false, reason: "unsupported-platform" };
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

  async exportWorkout(): Promise<boolean> {
    return false;
  }
}
