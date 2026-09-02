import AsyncStorage from "@react-native-async-storage/async-storage";
import type { WorkoutSession, WorkoutSessionCreateInput } from "@moveall/contracts";
import { AppState, Platform } from "react-native";
import { api } from "../../api/client";
import type { WearableAdapter } from "./adapter";

const enabledKey = "groov-health-auto-sync-enabled-v1";
const exportedKey = "groov-health-exported-workouts-v1";
const lastSyncKey = "groov-health-last-sync-at-v1";
const throttleMs = 15 * 60 * 1000;

export type HealthSyncResult = {
  imported: number;
  exported: number;
  duplicates: number;
  failed: number;
};

export async function setHealthAutoSyncEnabled(enabled: boolean) {
  if (Platform.OS !== "web") await AsyncStorage.setItem(enabledKey, enabled ? "true" : "false");
}

export async function isHealthAutoSyncEnabled() {
  if (Platform.OS === "web") return false;
  return (await AsyncStorage.getItem(enabledKey)) === "true";
}

function isDuplicate(input: WorkoutSessionCreateInput, existing: WorkoutSession[]) {
  return existing.some(
    (workout) =>
      workout.sport === input.sport &&
      Math.abs(Date.parse(workout.startedAt) - Date.parse(input.startedAt)) < 60_000,
  );
}

async function exportedIds() {
  try {
    const stored = await AsyncStorage.getItem(exportedKey);
    return new Set(stored ? (JSON.parse(stored) as string[]) : []);
  } catch {
    return new Set<string>();
  }
}

export async function syncHealthData(
  token: string,
  adapter: WearableAdapter,
  options: { force?: boolean } = {},
): Promise<HealthSyncResult> {
  const result: HealthSyncResult = { imported: 0, exported: 0, duplicates: 0, failed: 0 };
  const availability = await adapter.availability();
  if (!availability.available) return result;
  if (!options.force) {
    if (!(await isHealthAutoSyncEnabled()) || AppState.currentState !== "active") return result;
    const lastSync = Number(await AsyncStorage.getItem(lastSyncKey));
    if (Number.isFinite(lastSync) && Date.now() - lastSync < throttleMs) return result;
  }

  const existing = await api.workouts(token);
  const since = new Date();
  since.setDate(since.getDate() - 30);
  const candidates = await adapter.importRecentWorkouts(since);
  for (const candidate of candidates) {
    if (isDuplicate(candidate, existing)) {
      result.duplicates += 1;
      continue;
    }
    try {
      const saved = await api.createWorkoutSession(token, candidate);
      existing.push(saved);
      result.imported += 1;
    } catch {
      result.failed += 1;
    }
  }

  const exported = await exportedIds();
  const groovWorkouts = existing
    .filter(
      (workout) =>
        workout.source !== "wearable" &&
        Date.parse(workout.startedAt) >= since.getTime() &&
        !exported.has(workout.id),
    )
    .sort((left, right) => Date.parse(left.startedAt) - Date.parse(right.startedAt))
    .slice(-100);
  for (const workout of groovWorkouts) {
    try {
      if (await adapter.exportWorkout(workout)) {
        exported.add(workout.id);
        result.exported += 1;
      }
    } catch {
      result.failed += 1;
    }
  }
  await AsyncStorage.multiSet([
    [exportedKey, JSON.stringify([...exported].slice(-1_000))],
    [lastSyncKey, String(Date.now())],
  ]);
  return result;
}
