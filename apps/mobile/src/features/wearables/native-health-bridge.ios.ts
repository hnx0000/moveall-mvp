import type { SportType, WorkoutSessionCreateInput } from "@moveall/contracts";
import {
  isHealthDataAvailableAsync,
  queryQuantitySamples,
  queryWorkoutSamples,
  requestAuthorization,
  saveWorkoutSample,
  WorkoutActivityType,
  WorkoutTypeIdentifier,
} from "@kingstinct/react-native-healthkit";
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

const readTypesByPermission: Partial<Record<HealthPermission, string[]>> = {
  workout: [WorkoutTypeIdentifier],
  "heart-rate": ["HKQuantityTypeIdentifierHeartRate"],
  "respiratory-rate": ["HKQuantityTypeIdentifierRespiratoryRate"],
  steps: ["HKQuantityTypeIdentifierStepCount"],
  distance: [
    "HKQuantityTypeIdentifierDistanceWalkingRunning",
    "HKQuantityTypeIdentifierDistanceCycling",
    "HKQuantityTypeIdentifierDistanceSwimming",
  ],
  calories: ["HKQuantityTypeIdentifierActiveEnergyBurned"],
  elevation: ["HKQuantityTypeIdentifierFlightsClimbed"],
};

const sportByActivityType = new Map<WorkoutActivityType, SportType>([
  [WorkoutActivityType.running, "running"],
  [WorkoutActivityType.hiking, "hiking"],
  [WorkoutActivityType.cycling, "cycling"],
  [WorkoutActivityType.functionalStrengthTraining, "strength"],
  [WorkoutActivityType.traditionalStrengthTraining, "strength"],
  [WorkoutActivityType.swimming, "swimming"],
  [WorkoutActivityType.underwaterDiving, "diving"],
]);

const activityTypeBySport: Record<SportType, WorkoutActivityType> = {
  running: WorkoutActivityType.running,
  hiking: WorkoutActivityType.hiking,
  cycling: WorkoutActivityType.cycling,
  strength: WorkoutActivityType.traditionalStrengthTraining,
  swimming: WorkoutActivityType.swimming,
  diving: WorkoutActivityType.underwaterDiving,
};

async function safeQuantities(
  identifier: Parameters<typeof queryQuantitySamples>[0],
  startDate: Date,
  endDate: Date,
) {
  try {
    return await queryQuantitySamples(identifier, {
      filter: { date: { startDate, endDate, strictStartDate: true, strictEndDate: true } },
      limit: -1,
      ascending: true,
    });
  } catch {
    return [];
  }
}

const average = (values: number[]) =>
  values.length ? values.reduce((sum, value) => sum + value, 0) / values.length : 0;

const bridge: NativeHealthBridge = {
  supportsLiveMetrics: false,
  isAvailable: isHealthDataAvailableAsync,
  async requestPermissions(permissions) {
    if (!(await isHealthDataAvailableAsync())) return false;
    const toRead = [
      ...new Set(permissions.flatMap((permission) => readTypesByPermission[permission] ?? [])),
    ];
    return requestAuthorization({
      toRead: toRead as NonNullable<Parameters<typeof requestAuthorization>[0]["toRead"]>,
      toShare: [WorkoutTypeIdentifier],
    });
  },
  async startWorkout() {
    throw new Error("HealthKit is an import source, not a live Apple Watch session");
  },
  async readLiveSample() {
    return null;
  },
  async stopWorkout() {},
  async readWorkouts(sinceIso, untilIso) {
    if (!(await isHealthDataAvailableAsync())) return [];
    const workouts = await queryWorkoutSamples({
      filter: { date: { startDate: new Date(sinceIso), endDate: new Date(untilIso) } },
      limit: -1,
      ascending: true,
    });
    const imported = await Promise.all(
      workouts.map(async (workout): Promise<WorkoutSessionCreateInput | null> => {
        const sport = sportByActivityType.get(workout.workoutActivityType);
        if (!sport || workout.endDate <= workout.startDate) return null;
        const [heartRates, respiratoryRates, steps] = await Promise.all([
          safeQuantities("HKQuantityTypeIdentifierHeartRate", workout.startDate, workout.endDate),
          safeQuantities(
            "HKQuantityTypeIdentifierRespiratoryRate",
            workout.startDate,
            workout.endDate,
          ),
          safeQuantities("HKQuantityTypeIdentifierStepCount", workout.startDate, workout.endDate),
        ]);
        const heartValues = heartRates.map((sample) => {
          if (sample.unit === "count/s") return sample.quantity * 60;
          return sample.quantity;
        });
        const respiratoryValues = respiratoryRates.map((sample) => {
          if (sample.unit === "count/s") return sample.quantity * 60;
          return sample.quantity;
        });
        return {
          sport,
          startedAt: workout.startDate.toISOString(),
          endedAt: workout.endDate.toISOString(),
          perceivedExertion: 5,
          notes: "Apple 건강에서 가져온 기록",
          source: "wearable" as const,
          metrics: {
            durationSeconds: Math.round(
              (workout.endDate.getTime() - workout.startDate.getTime()) / 1000,
            ),
            ...(workout.totalDistance?.quantity
              ? { distanceKm: workout.totalDistance.quantity / 1000 }
              : {}),
            ...(workout.totalEnergyBurned?.quantity
              ? { calories: workout.totalEnergyBurned.quantity }
              : {}),
            steps: steps.reduce((sum, sample) => sum + sample.quantity, 0),
            ...(heartValues.length
              ? {
                  averageHeartRateBpm: average(heartValues),
                  maximumHeartRateBpm: Math.max(...heartValues),
                }
              : {}),
            ...(respiratoryValues.length
              ? { averageRespiratoryRatePerMinute: average(respiratoryValues) }
              : {}),
            ...(workout.totalSwimmingStrokeCount?.quantity
              ? { totalStrokes: workout.totalSwimmingStrokeCount.quantity }
              : {}),
          },
        } satisfies WorkoutSessionCreateInput;
      }),
    );
    return imported.filter((workout): workout is WorkoutSessionCreateInput => workout !== null);
  },
  async writeWorkout(workout) {
    if (!(await isHealthDataAvailableAsync())) return false;
    const distanceKm = workout.metrics.distanceKm ?? (workout.metrics.distanceM ?? 0) / 1000;
    const calories = workout.metrics.calories ?? 0;
    await saveWorkoutSample(
      activityTypeBySport[workout.sport],
      [],
      new Date(workout.startedAt),
      new Date(workout.endedAt),
      {
        ...(Number.isFinite(distanceKm) && distanceKm > 0 ? { distance: distanceKm * 1000 } : {}),
        ...(Number.isFinite(calories) && calories > 0 ? { energyBurned: calories } : {}),
      },
      { HKWorkoutBrandName: "GROOV" },
    );
    return true;
  },
};

export function nativeHealthBridge(
  provider: Exclude<HealthProvider, "mock" | "garmin">,
): NativeHealthBridge | null {
  return provider === "apple-health" ? bridge : null;
}
