import type { SportType, WorkoutSessionCreateInput } from "@moveall/contracts";
import type {
  HealthPermission,
  LiveMetricSample,
  WearableAdapter,
  WearableAvailability,
} from "./adapter";
import { groovHealthPermissions } from "./adapter";
import { nativeHealthBridge, type NativeHealthBridge } from "./native-health-bridge";

export class NativeHealthAdapter implements WearableAdapter {
  private activeSessionId: string | null = null;
  private stopped = false;
  private readonly bridge: NativeHealthBridge | null;

  constructor(readonly provider: "apple-health" | "health-connect") {
    this.bridge = nativeHealthBridge(provider);
  }

  async availability(): Promise<WearableAvailability> {
    if (!this.bridge) return { available: false, reason: "native-build-required" };
    return (await this.bridge.isAvailable())
      ? { available: true }
      : { available: false, reason: "provider-not-installed" };
  }

  async requestPermission(
    permissions: HealthPermission[] = groovHealthPermissions,
  ): Promise<boolean> {
    return this.bridge ? this.bridge.requestPermissions(permissions) : false;
  }

  async *startSession(sport: SportType): AsyncIterable<LiveMetricSample> {
    if (!this.bridge) throw new Error("Health provider native build is required");
    this.stopped = false;
    this.activeSessionId = await this.bridge.startWorkout(sport);
    while (!this.stopped && this.activeSessionId) {
      const sample = await this.bridge.readLiveSample(this.activeSessionId);
      if (sample) yield sample;
      await new Promise((resolve) => setTimeout(resolve, 1_000));
    }
  }

  async stopSession(): Promise<void> {
    this.stopped = true;
    const sessionId = this.activeSessionId;
    this.activeSessionId = null;
    if (this.bridge && sessionId) await this.bridge.stopWorkout(sessionId);
  }

  async importRecentWorkouts(since: Date): Promise<WorkoutSessionCreateInput[]> {
    if (!this.bridge || !(await this.bridge.isAvailable())) return [];
    return this.bridge.readWorkouts(since.toISOString(), new Date().toISOString());
  }
}
