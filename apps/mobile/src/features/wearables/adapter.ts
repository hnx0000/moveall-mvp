import type { SportType } from "@moveall/contracts";

export type LiveMetricSample = {
  recordedAt: string;
  values: Record<string, number>;
};

export interface WearableAdapter {
  readonly provider: "mock" | "apple-health" | "health-connect" | "garmin";
  requestPermission(): Promise<boolean>;
  startSession(sport: SportType): AsyncIterable<LiveMetricSample>;
  stopSession(): Promise<void>;
}

export class MockWearableAdapter implements WearableAdapter {
  readonly provider = "mock" as const;

  async requestPermission(): Promise<boolean> {
    return true;
  }

  async *startSession(): AsyncIterable<LiveMetricSample> {
    yield { recordedAt: new Date().toISOString(), values: { heartRate: 120 } };
  }

  async stopSession(): Promise<void> {}
}
