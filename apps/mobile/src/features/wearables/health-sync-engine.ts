import type { WorkoutSession, WorkoutSessionCreateInput } from "@moveall/contracts";
import type { WearableAdapter } from "./adapter";
import type { MutationOptions } from "../../api/mutation-options";
export type HealthSyncResult = {
  imported: number;
  exported: number;
  duplicates: number;
  failed: number;
};
export type HealthSyncStatus = {
  phase: "ready" | "syncing" | "completed" | "failed";
  updatedAt: string;
  message: string;
  result?: HealthSyncResult;
};
export type HealthSyncOptions = {
  userId: string;
  force?: boolean;
  isCurrent?: () => boolean;
  getAccessToken?: () => string;
};
type Storage = {
  getItem(key: string): Promise<string | null>;
  setItem(key: string, value: string): Promise<void>;
};
type HealthApi = {
  consent(token: string): Promise<{ healthDataAccepted: boolean } | null>;
  workouts(token: string): Promise<WorkoutSession[]>;
  createWorkoutSession(
    token: string,
    input: WorkoutSessionCreateInput,
    operation?: MutationOptions,
  ): Promise<WorkoutSession>;
};
export const healthOwner = (userId: string, provider: string) =>
  `${encodeURIComponent(userId)}:${provider}`;

/** No React/OS globals: consent, work and status belong to exactly one account/provider. */
export function createHealthSyncCoordinator(deps: {
  storage: Storage;
  api: HealthApi;
  isForeground: () => boolean;
  activeUserId: () => string | null;
  now?: () => number;
}) {
  const now = deps.now ?? Date.now;
  const generations = new Map<string, number>();
  const flights = new Map<string, Promise<HealthSyncResult>>();
  const listeners = new Map<string, Set<(status: HealthSyncStatus) => void>>();
  const disabled = new Set<string>();
  const consentWrites = new Map<string, Promise<void>>();
  const key = (owner: string, field: string) => `groov-health-v2:${owner}:${field}`;
  const publish = async (owner: string, status: HealthSyncStatus) => {
    await deps.storage.setItem(key(owner, "status"), JSON.stringify(status));
    listeners.get(owner)?.forEach((listener) => listener(status));
  };
  const enabled = async (owner: string) =>
    !disabled.has(owner) &&
    (await deps.storage.getItem(key(owner, "enabled"))) === "true" &&
    !disabled.has(owner);
  const cancel = (userId: string) => {
    const prefix = encodeURIComponent(userId) + ":";
    for (const owner of new Set([...generations.keys(), ...flights.keys()])) {
      if (!owner.startsWith(prefix)) continue;
      generations.set(owner, (generations.get(owner) ?? 0) + 1);
      flights.delete(owner);
    }
  };
  return {
    cancel,
    isEnabled: enabled,
    async setEnabled(owner: string, value: boolean) {
      if (!value) {
        disabled.add(owner);
        generations.set(owner, (generations.get(owner) ?? 0) + 1);
        flights.delete(owner);
      }
      const generation = generations.get(owner) ?? 0;
      const write = (consentWrites.get(owner) ?? Promise.resolve())
        .catch(() => undefined)
        .then(() => deps.storage.setItem(key(owner, "enabled"), String(value)));
      consentWrites.set(owner, write);
      await write;
      if (value && (generations.get(owner) ?? 0) === generation) disabled.delete(owner);
    },
    async status(owner: string): Promise<HealthSyncStatus | null> {
      const raw = await deps.storage.getItem(key(owner, "status"));
      try {
        return raw ? (JSON.parse(raw) as HealthSyncStatus) : null;
      } catch {
        return null;
      }
    },
    subscribe(owner: string, listener: (status: HealthSyncStatus) => void) {
      const set = listeners.get(owner) ?? new Set();
      set.add(listener);
      listeners.set(owner, set);
      return () => {
        set.delete(listener);
        if (!set.size) listeners.delete(owner);
      };
    },
    ready(owner: string, message: string) {
      return publish(owner, { phase: "ready", updatedAt: new Date(now()).toISOString(), message });
    },
    sync(token: string, adapter: WearableAdapter, options: HealthSyncOptions) {
      if (!options.userId)
        return Promise.reject(new Error("건강 기록을 연결할 계정을 확인해 주세요."));
      const owner = healthOwner(options.userId, adapter.provider);
      const previous = flights.get(owner);
      if (previous) return previous;
      const generation = generations.get(owner) ?? 0;
      generations.set(owner, generation);
      const current = () =>
        deps.activeUserId() === options.userId &&
        !disabled.has(owner) &&
        (generations.get(owner) ?? 0) === generation &&
        (options.isCurrent?.() ?? true);
      const accessToken = () => options.getAccessToken?.() ?? token;
      const run = async (): Promise<HealthSyncResult> => {
        const result: HealthSyncResult = { imported: 0, exported: 0, duplicates: 0, failed: 0 };
        try {
          if (!current() || !deps.isForeground()) return result;
          const localConsent = await enabled(owner);
          if (!current()) return result;
          if (!localConsent) {
            if (options.force)
              throw new Error("현재 계정에서 건강 기록 연결을 먼저 허용해 주세요.");
            return result;
          }
          const consent = await deps.api.consent(accessToken());
          if (!current()) return result;
          if (!consent?.healthDataAccepted) {
            if (options.force)
              throw new Error("동의 및 데이터 설정에서 건강정보 이용에 동의해 주세요.");
            return result;
          }
          const last = Number(await deps.storage.getItem(key(owner, "last-sync")));
          if (!current() || (!options.force && last > 0 && now() - last < 900_000)) return result;
          const availability = await adapter.availability();
          if (!current()) return result;
          if (!availability.available)
            throw new Error("이 기기에서 건강 기록을 사용할 수 없습니다.");
          await publish(owner, {
            phase: "syncing",
            updatedAt: new Date(now()).toISOString(),
            message: "완료된 운동을 동기화하는 중",
          });
          if (!current()) return result;
          const existing = await deps.api.workouts(accessToken());
          if (!current()) return result;
          const since = new Date(now() - 30 * 86_400_000);
          const candidates = await adapter.importRecentWorkouts(since);
          if (!current()) return result;
          for (const candidate of candidates) {
            if (!current()) return result;
            const { healthRecordId, ...workoutInput } = candidate;
            if (
              !healthRecordId ||
              (adapter.provider !== "apple-health" && adapter.provider !== "health-connect")
            ) {
              result.failed++;
              continue;
            }
            if (
              existing.some(
                (workout) =>
                  workout.sport === candidate.sport &&
                  Math.abs(Date.parse(workout.startedAt) - Date.parse(candidate.startedAt)) <
                    60_000,
              )
            ) {
              result.duplicates++;
              continue;
            }
            try {
              const saved = await deps.api.createWorkoutSession(accessToken(), workoutInput, {
                idempotencyKey: healthRecordId,
                healthProvider: adapter.provider,
              });
              existing.push(saved);
              result.imported++;
            } catch (error) {
              if (
                error &&
                typeof error === "object" &&
                "code" in error &&
                error.code === "HEALTH_IMPORT_DELETED"
              )
                result.duplicates++;
              else result.failed++;
            }
          }
          const raw = await deps.storage.getItem(key(owner, "exported"));
          if (!current()) return result;
          const exported = new Set<string>(raw ? JSON.parse(raw) : []);
          const candidatesForExport = existing
            .filter(
              (workout) =>
                workout.source !== "wearable" &&
                Date.parse(workout.startedAt) >= since.getTime() &&
                !exported.has(workout.id),
            )
            .slice(-100);
          for (const workout of candidatesForExport) {
            if (!current()) return result;
            try {
              if (await adapter.exportWorkout(workout)) {
                exported.add(workout.id);
                result.exported++;
                // A completed OS write still belongs to its original owner after cancellation.
                await deps.storage.setItem(key(owner, "exported"), JSON.stringify([...exported]));
              }
            } catch {
              result.failed++;
            }
          }
          if (!current()) return result;
          await deps.storage.setItem(key(owner, "last-sync"), String(now()));
          if (!current()) return result;
          await publish(owner, {
            phase: result.failed ? "failed" : "completed",
            updatedAt: new Date(now()).toISOString(),
            message: result.failed
              ? `${result.failed}개 기록을 처리하지 못했습니다.`
              : "완료 운동 동기화를 마쳤습니다.",
            result,
          });
          return result;
        } catch (error) {
          if (current())
            await publish(owner, {
              phase: "failed",
              updatedAt: new Date(now()).toISOString(),
              message: error instanceof Error ? error.message : "건강 기록 동기화에 실패했습니다.",
            });
          throw error;
        }
      };
      const promise = run().finally(() => {
        if (flights.get(owner) === promise) flights.delete(owner);
      });
      flights.set(owner, promise);
      return promise;
    },
  };
}
