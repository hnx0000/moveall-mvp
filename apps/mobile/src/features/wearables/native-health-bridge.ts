import type { SportType, WorkoutSessionCreateInput } from "@moveall/contracts";
import { NativeModules } from "react-native";
import type { HealthPermission, HealthProvider, LiveMetricSample } from "./adapter";

export type NativeHealthBridge = {
  isAvailable(): Promise<boolean>;
  requestPermissions(permissions: HealthPermission[]): Promise<boolean>;
  startWorkout(sport: SportType): Promise<string>;
  readLiveSample(sessionId: string): Promise<LiveMetricSample | null>;
  stopWorkout(sessionId: string): Promise<void>;
  readWorkouts(sinceIso: string, untilIso: string): Promise<WorkoutSessionCreateInput[]>;
};

export function nativeHealthBridge(
  provider: Exclude<HealthProvider, "mock" | "garmin">,
): NativeHealthBridge | null {
  const moduleName = provider === "health-connect" ? "GroovHealthConnect" : "GroovHealthKit";
  const candidate = NativeModules[moduleName] as Partial<NativeHealthBridge> | undefined;
  if (
    !candidate ||
    typeof candidate.isAvailable !== "function" ||
    typeof candidate.requestPermissions !== "function" ||
    typeof candidate.startWorkout !== "function" ||
    typeof candidate.readLiveSample !== "function" ||
    typeof candidate.stopWorkout !== "function" ||
    typeof candidate.readWorkouts !== "function"
  ) {
    return null;
  }
  return candidate as NativeHealthBridge;
}
