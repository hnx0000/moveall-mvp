import type { SportType, WorkoutSession } from "@moveall/contracts";

export const averageHeartRateKey = "averageHeartRateBpm";
export const maximumHeartRateKey = "maximumHeartRateBpm";
export const runningStepsKey = "steps";
export const averageCadenceKey = "averageCadenceSpm";
export const waterTemperatureKey = "waterTemperatureC";

export type WorkoutMetricLabel = { label: string; value: string };

export function workoutSensorMetrics(workout: WorkoutSession): WorkoutMetricLabel[] {
  const metrics: WorkoutMetricLabel[] = [
    {
      label: "평균 심박수",
      value: formatHeartRate(workout.metrics[averageHeartRateKey]),
    },
  ];

  if (["running", "hiking", "cycling", "strength", "diving"].includes(workout.sport)) {
    metrics.push({
      label: "최대 심박수",
      value: formatHeartRate(workout.metrics[maximumHeartRateKey]),
    });
  }

  if (workout.sport === "running" || workout.sport === "hiking") {
    metrics.push({ label: "걸음", value: formatSteps(workout.metrics[runningStepsKey]) });
  }

  if (workout.sport === "running") {
    metrics.push({
      label: "평균 케이던스",
      value: formatCadence(workout.metrics[averageCadenceKey]),
    });
  }

  if (workout.sport === "swimming") {
    metrics.push(
      {
        label: "총 스트로크",
        value: formatStrokeCount(workout.metrics.totalStrokes),
      },
      {
        label: "평균 SWOLF",
        value: formatSwolf(workout.metrics.averageSwolf),
      },
    );
  }

  if (workout.sport === "diving") {
    metrics.push({
      label: "수온",
      value: formatWaterTemperature(workout.metrics[waterTemperatureKey]),
    });
  }

  return metrics;
}

export function aggregateSensorMetrics(
  workouts: WorkoutSession[],
  sport: SportType,
): WorkoutMetricLabel[] {
  const metrics: WorkoutMetricLabel[] = [
    {
      label: "평균 심박수",
      value: formatHeartRate(weightedMetricAverage(workouts, averageHeartRateKey)),
    },
  ];

  if (["running", "hiking", "cycling", "strength", "diving"].includes(sport)) {
    metrics.push({
      label: "최대 심박수",
      value: formatHeartRate(maxMetric(workouts, maximumHeartRateKey)),
    });
  }

  if (sport === "running" || sport === "hiking") {
    metrics.push({ label: "걸음", value: formatSteps(sumMetric(workouts, runningStepsKey)) });
  }

  if (sport === "running") {
    metrics.push({
      label: "평균 케이던스",
      value: formatCadence(weightedMetricAverage(workouts, averageCadenceKey)),
    });
  }

  if (sport === "swimming") {
    metrics.push(
      {
        label: "총 스트로크",
        value: formatStrokeCount(sumMetric(workouts, "totalStrokes")),
      },
      {
        label: "평균 SWOLF",
        value: formatSwolf(weightedMetricAverage(workouts, "averageSwolf")),
      },
    );
  }

  if (sport === "diving") {
    metrics.push({
      label: "수온",
      value: formatWaterTemperature(weightedMetricAverage(workouts, waterTemperatureKey)),
    });
  }

  return metrics;
}

export function formatSensorMetricLine(workout: WorkoutSession): string {
  return workoutSensorMetrics(workout)
    .map((metric) => `${metric.label} ${metric.value}`)
    .join(" · ");
}

export function formatHeartRate(value: number | undefined): string {
  return isPositive(value) ? `${Math.round(value)} bpm` : "0 bpm";
}

export function formatSteps(value: number | undefined): string {
  return isPositive(value) ? Math.round(value).toLocaleString("ko-KR") : "0";
}

export function formatCadence(value: number | undefined): string {
  return isPositive(value) ? `${Math.round(value)} spm` : "0 spm";
}

export function formatStrokeCount(value: number | undefined): string {
  return isPositive(value) ? Math.round(value).toLocaleString("ko-KR") : "0";
}

export function formatSwolf(value: number | undefined): string {
  return isPositive(value) ? `${Math.round(value)}` : "0";
}

export function formatWaterTemperature(value: number | undefined): string {
  return isPositive(value) ? `${Number(value.toFixed(1))} °C` : "0 °C";
}

function weightedMetricAverage(workouts: WorkoutSession[], key: string): number | undefined {
  const measured = workouts.filter((workout) => isPositive(workout.metrics[key]));
  if (!measured.length) return undefined;
  const weighted = measured.reduce(
    (result, workout) => {
      const duration = Math.max(1, Date.parse(workout.endedAt) - Date.parse(workout.startedAt));
      return {
        value: result.value + Number(workout.metrics[key]) * duration,
        duration: result.duration + duration,
      };
    },
    { value: 0, duration: 0 },
  );
  return weighted.duration > 0 ? weighted.value / weighted.duration : undefined;
}

function sumMetric(workouts: WorkoutSession[], key: string): number | undefined {
  const values = workouts
    .map((workout) => workout.metrics[key])
    .filter((value): value is number => isPositive(value));
  return values.length ? values.reduce((sum, value) => sum + value, 0) : undefined;
}

function maxMetric(workouts: WorkoutSession[], key: string): number | undefined {
  const values = workouts
    .map((workout) => workout.metrics[key])
    .filter((value): value is number => isPositive(value));
  return values.length ? Math.max(...values) : undefined;
}

function isPositive(value: number | undefined): value is number {
  return typeof value === "number" && Number.isFinite(value) && value > 0;
}
