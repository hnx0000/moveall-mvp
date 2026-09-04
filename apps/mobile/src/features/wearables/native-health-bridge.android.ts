import type { SportType, WorkoutSessionCreateInput } from "@moveall/contracts";
import {
  getSdkStatus,
  initialize,
  insertRecords,
  readRecords,
  requestPermission,
  SdkAvailabilityStatus,
  ExerciseType,
  type Permission,
} from "react-native-health-connect";
import type { HealthPermission, HealthProvider, LiveMetricSample } from "./adapter";

export type NativeHealthBridge = {
  readonly supportsLiveMetrics: boolean;
  isAvailable(): Promise<boolean>;
  requestPermissions(permissions: HealthPermission[]): Promise<boolean>;
  startWorkout(sport: SportType): Promise<string>;
  readLiveSample(sessionId: string): Promise<LiveMetricSample | null>;
  stopWorkout(sessionId: string): Promise<void>;
  readWorkouts(sinceIso: string, untilIso: string): Promise<WorkoutSessionCreateInput[]>;
  writeWorkout(workout: WorkoutSessionCreateInput): Promise<boolean>;
};

const permissionMap: Partial<Record<HealthPermission, Permission["recordType"][]>> = {
  workout: ["ExerciseSession"],
  "heart-rate": ["HeartRate"],
  "respiratory-rate": ["RespiratoryRate"],
  steps: ["Steps", "StepsCadence"],
  distance: ["Distance"],
  calories: ["TotalCaloriesBurned"],
  elevation: ["ElevationGained"],
};

const sportByExerciseType = new Map<number, SportType>([
  [ExerciseType.RUNNING, "running"],
  [ExerciseType.RUNNING_TREADMILL, "running"],
  [ExerciseType.HIKING, "hiking"],
  [ExerciseType.BIKING, "cycling"],
  [ExerciseType.BIKING_STATIONARY, "cycling"],
  [ExerciseType.STRENGTH_TRAINING, "strength"],
  [ExerciseType.WEIGHTLIFTING, "strength"],
  [ExerciseType.SWIMMING_POOL, "swimming"],
  [ExerciseType.SWIMMING_OPEN_WATER, "swimming"],
  [ExerciseType.SCUBA_DIVING, "diving"],
]);

const exerciseTypeBySport: Record<SportType, number> = {
  running: ExerciseType.RUNNING,
  hiking: ExerciseType.HIKING,
  cycling: ExerciseType.BIKING,
  strength: ExerciseType.STRENGTH_TRAINING,
  swimming: ExerciseType.SWIMMING_POOL,
  diving: ExerciseType.SCUBA_DIVING,
};

async function ensureInitialized() {
  if ((await getSdkStatus()) !== SdkAvailabilityStatus.SDK_AVAILABLE) return false;
  return initialize();
}

async function safeRead<T extends Parameters<typeof readRecords>[0]>(
  recordType: T,
  startedAt: string,
  endedAt: string,
) {
  try {
    return await readRecords(recordType, {
      timeRangeFilter: { operator: "between", startTime: startedAt, endTime: endedAt },
      pageSize: 500,
    });
  } catch {
    return { records: [] } as Awaited<ReturnType<typeof readRecords<T>>>;
  }
}

const average = (values: number[]) =>
  values.length ? values.reduce((sum, value) => sum + value, 0) / values.length : 0;

const bridge: NativeHealthBridge = {
  supportsLiveMetrics: false,
  isAvailable: ensureInitialized,
  async requestPermissions(permissions) {
    if (!(await ensureInitialized())) return false;
    const requested = permissions.flatMap((permission) => permissionMap[permission] ?? []);
    const readPermissions = [...new Set(requested)].map(
      (recordType) => ({ accessType: "read", recordType }) as Permission,
    );
    const writePermissions = (["ExerciseSession", "Distance", "TotalCaloriesBurned"] as const)
      .filter((recordType) => requested.includes(recordType))
      .map((recordType) => ({ accessType: "write", recordType }) as Permission);
    const requestedPermissions = [...readPermissions, ...writePermissions];
    const granted = await requestPermission(requestedPermissions);
    return requestedPermissions
      .filter((permission) => permission.recordType !== "RespiratoryRate")
      .every((permission) =>
        granted.some(
          (candidate) =>
            candidate.accessType === permission.accessType &&
            candidate.recordType === permission.recordType,
        ),
      );
  },
  async startWorkout() {
    throw new Error("Health Connect is an import source, not a live watch session");
  },
  async readLiveSample() {
    return null;
  },
  async stopWorkout() {},
  async readWorkouts(sinceIso, untilIso) {
    if (!(await ensureInitialized())) return [];
    const sessions = await safeRead("ExerciseSession", sinceIso, untilIso);
    const imported = await Promise.all(
      sessions.records.map(async (session): Promise<WorkoutSessionCreateInput | null> => {
        const sport = sportByExerciseType.get(session.exerciseType);
        if (!sport || Date.parse(session.endTime) <= Date.parse(session.startTime)) return null;
        const [heart, respiratory, steps, cadence, distance, calories, elevation] =
          await Promise.all([
            safeRead("HeartRate", session.startTime, session.endTime),
            safeRead("RespiratoryRate", session.startTime, session.endTime),
            safeRead("Steps", session.startTime, session.endTime),
            safeRead("StepsCadence", session.startTime, session.endTime),
            safeRead("Distance", session.startTime, session.endTime),
            safeRead("TotalCaloriesBurned", session.startTime, session.endTime),
            safeRead("ElevationGained", session.startTime, session.endTime),
          ]);
        const heartRates = heart.records.flatMap((record) =>
          record.samples.map((sample) => sample.beatsPerMinute),
        );
        const respiratoryRates = respiratory.records.map((record) => record.rate);
        const cadences = cadence.records.flatMap((record) =>
          record.samples.map((sample) => sample.rate),
        );
        const distanceM = distance.records.reduce(
          (sum, record) => sum + record.distance.inMeters,
          0,
        );
        return {
          sport,
          startedAt: session.startTime,
          endedAt: session.endTime,
          perceivedExertion: 5,
          notes: session.notes || session.title || "Health Connect에서 가져온 기록",
          source: "wearable" as const,
          metrics: {
            durationSeconds: Math.round(
              (Date.parse(session.endTime) - Date.parse(session.startTime)) / 1000,
            ),
            ...(distanceM > 0 ? { distanceKm: distanceM / 1000 } : {}),
            steps: steps.records.reduce((sum, record) => sum + record.count, 0),
            calories: calories.records.reduce(
              (sum, record) => sum + record.energy.inKilocalories,
              0,
            ),
            elevationGainM: elevation.records.reduce(
              (sum, record) => sum + record.elevation.inMeters,
              0,
            ),
            ...(heartRates.length
              ? {
                  averageHeartRateBpm: average(heartRates),
                  maximumHeartRateBpm: Math.max(...heartRates),
                }
              : {}),
            ...(respiratoryRates.length
              ? { averageRespiratoryRatePerMinute: average(respiratoryRates) }
              : {}),
            ...(cadences.length ? { averageCadenceSpm: average(cadences) } : {}),
          },
        } satisfies WorkoutSessionCreateInput;
      }),
    );
    return imported.filter((workout): workout is WorkoutSessionCreateInput => workout !== null);
  },
  async writeWorkout(workout) {
    if (!(await ensureInitialized())) return false;
    const base = { startTime: workout.startedAt, endTime: workout.endedAt };
    await insertRecords([
      {
        recordType: "ExerciseSession",
        ...base,
        exerciseType: exerciseTypeBySport[workout.sport],
        title: `GROOV ${workout.sport}`,
        notes: workout.notes ?? "GROOV에서 기록한 운동",
      },
    ]);
    const distanceKm = workout.metrics.distanceKm ?? (workout.metrics.distanceM ?? 0) / 1000;
    if (Number.isFinite(distanceKm) && distanceKm > 0) {
      await insertRecords([
        {
          recordType: "Distance",
          ...base,
          distance: { value: distanceKm, unit: "kilometers" },
        },
      ]);
    }
    const calories = workout.metrics.calories ?? 0;
    if (Number.isFinite(calories) && calories > 0) {
      await insertRecords([
        {
          recordType: "TotalCaloriesBurned",
          ...base,
          energy: { value: calories, unit: "kilocalories" },
        },
      ]);
    }
    return true;
  },
};

export function nativeHealthBridge(
  provider: Exclude<HealthProvider, "mock" | "garmin">,
): NativeHealthBridge | null {
  return provider === "health-connect" ? bridge : null;
}
