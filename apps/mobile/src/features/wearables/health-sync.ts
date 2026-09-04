import AsyncStorage from "@react-native-async-storage/async-storage";
import type { WorkoutSession, WorkoutSessionCreateInput } from "@moveall/contracts";
import { AppState, Platform } from "react-native";
import { api } from "../../api/client";
import type { WearableAdapter } from "./adapter";

const enabledKey = "groov-health-auto-sync-enabled-v1";
const exportedKey = "groov-health-exported-workouts-v1";
const lastSyncKey = "groov-health-last-sync-at-v1";
const statusKey = "groov-health-sync-status-v1";
const throttleMs = 15 * 60 * 1000;
const statusListeners = new Set<(status: HealthSyncStatus) => void>();
let activeSync: Promise<HealthSyncResult> | null = null;

export type HealthSyncResult = {
  imported: number;
  exported: number;
  duplicates: number;
  failed: number;
};

export type HealthSyncPhase = "ready" | "syncing" | "completed" | "failed";

export type HealthSyncStatus = {
  phase: HealthSyncPhase;
  updatedAt: string;
  message: string;
  result?: HealthSyncResult;
};

export async function getHealthSyncStatus(): Promise<HealthSyncStatus | null> {
  if (Platform.OS === "web") return null;
  try {
    const stored = await AsyncStorage.getItem(statusKey);
    return stored ? (JSON.parse(stored) as HealthSyncStatus) : null;
  } catch {
    return null;
  }
}

export function subscribeHealthSyncStatus(listener: (status: HealthSyncStatus) => void) {
  statusListeners.add(listener);
  return () => {
    statusListeners.delete(listener);
  };
}

export async function markHealthSyncReady(message = "완료 운동 동기화 준비됨") {
  await publishStatus({ phase: "ready", updatedAt: new Date().toISOString(), message });
}

async function publishStatus(status: HealthSyncStatus) {
  if (Platform.OS !== "web") await AsyncStorage.setItem(statusKey, JSON.stringify(status));
  statusListeners.forEach((listener) => listener(status));
}

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

export function syncHealthData(
  token: string,
  adapter: WearableAdapter,
  options: { force?: boolean } = {},
): Promise<HealthSyncResult> {
  if (activeSync) return activeSync;
  activeSync = runHealthSync(token, adapter, options).finally(() => {
    activeSync = null;
  });
  return activeSync;
}

async function runHealthSync(
  token: string,
  adapter: WearableAdapter,
  options: { force?: boolean },
): Promise<HealthSyncResult> {
  const result: HealthSyncResult = { imported: 0, exported: 0, duplicates: 0, failed: 0 };
  try {
    const availability = await adapter.availability();
    if (!availability.available) {
      if (options.force) {
        await publishStatus({
          phase: "failed",
          updatedAt: new Date().toISOString(),
          message: "이 기기에서 건강 데이터 제공자를 사용할 수 없습니다.",
        });
      }
      return result;
    }
    if (!options.force) {
      if (!(await isHealthAutoSyncEnabled()) || AppState.currentState !== "active") return result;
      const lastSync = Number(await AsyncStorage.getItem(lastSyncKey));
      if (Number.isFinite(lastSync) && Date.now() - lastSync < throttleMs) return result;
    }

    await publishStatus({
      phase: "syncing",
      updatedAt: new Date().toISOString(),
      message: "완료된 워치·GROOV 운동을 동기화하는 중",
    });

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
    await publishStatus({
      phase: result.failed > 0 ? "failed" : "completed",
      updatedAt: new Date().toISOString(),
      message:
        result.failed > 0
          ? `${result.failed}개 기록을 처리하지 못했습니다.`
          : "완료 운동 동기화를 마쳤습니다.",
      result,
    });
    return result;
  } catch (error) {
    await publishStatus({
      phase: "failed",
      updatedAt: new Date().toISOString(),
      message: error instanceof Error ? error.message : "건강 기록 동기화에 실패했습니다.",
    });
    throw error;
  }
}
