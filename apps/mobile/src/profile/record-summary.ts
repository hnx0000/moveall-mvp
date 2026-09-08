import type { SportType, WorkoutSession } from "@moveall/contracts";
import { workoutDurationMilliseconds } from "../workout-duration.ts";

export type RecordFilter = "all" | SportType;
export const recordMetricIds = [
  "minutes",
  "distance",
  "depth",
  "volume",
  "calories",
  "steps",
  "elevation",
  "sets",
  "laps",
  "strokes",
  "dynamic",
  "count",
] as const;
export type RecordMetricId = (typeof recordMetricIds)[number];
export type RecordMetric = {
  id: RecordMetricId;
  label: string;
  value: number;
  unit: string;
  digits: number;
  note?: string;
};

const common: RecordMetricId[] = ["minutes", "calories", "count"];
const sportMetrics: Record<SportType, RecordMetricId[]> = {
  running: ["distance", "steps", "elevation"],
  hiking: ["distance", "steps", "elevation"],
  cycling: ["distance", "elevation"],
  strength: ["volume", "sets"],
  swimming: ["distance", "laps", "strokes"],
  diving: ["depth", "dynamic"],
};

export function availableRecordMetrics(filter: RecordFilter): RecordMetricId[] {
  return filter === "all" ? [...recordMetricIds] : [...common, ...sportMetrics[filter]];
}

export function defaultRecordMetrics(filter: RecordFilter): RecordMetricId[] {
  if (filter === "all") return ["minutes", "distance", "depth", "volume", "calories", "steps"];
  return ["minutes", ...sportMetrics[filter], "calories"];
}

export function normalizeRecordMetrics(value: unknown, filter: RecordFilter): RecordMetricId[] {
  const allowed = availableRecordMetrics(filter);
  if (!Array.isArray(value)) return defaultRecordMetrics(filter);
  const valid = [...new Set(value.filter((id): id is RecordMetricId => allowed.includes(id)))];
  return valid.length ? valid : defaultRecordMetrics(filter);
}

export function moveRecordMetric(ids: RecordMetricId[], id: RecordMetricId, direction: -1 | 1) {
  const from = ids.indexOf(id);
  const to = from + direction;
  if (from < 0 || to < 0 || to >= ids.length) return ids;
  const next = [...ids];
  [next[from], next[to]] = [next[to]!, next[from]!];
  return next;
}

const validNumber = (value: number | undefined): value is number =>
  typeof value === "number" && Number.isFinite(value) && value >= 0;

export function summarizeRecords(
  workouts: WorkoutSession[],
  filter: RecordFilter,
): Record<RecordMetricId, RecordMetric> {
  const records = filter === "all" ? workouts : workouts.filter((item) => item.sport === filter);
  const sum = (key: string, sports?: SportType[]) =>
    records.reduce((total, item) => {
      if (sports && !sports.includes(item.sport)) return total;
      const value = item.metrics[key];
      return total + (validNumber(value) ? value : 0);
    }, 0);
  const metric = (
    id: RecordMetricId,
    label: string,
    value: number,
    unit: string,
    digits = 0,
  ): RecordMetric => ({ id, label, value, unit, digits });
  // Sum active milliseconds before rounding, and never count km and m twice.
  const minutes =
    records.reduce((total, item) => total + workoutDurationMilliseconds(item), 0) / 60_000;
  const distance = records.reduce((total, item) => {
    if (!["running", "hiking", "cycling", "swimming"].includes(item.sport)) return total;
    const { distanceKm, distanceM } = item.metrics;
    return (
      total + (validNumber(distanceKm) ? distanceKm : validNumber(distanceM) ? distanceM / 1000 : 0)
    );
  }, 0);
  return {
    minutes: metric("minutes", "누적 시간", minutes, "분", 1),
    distance: metric("distance", "누적 거리", distance, "km", 2),
    // Existing diving records store one max depth per workout, not a depth time series.
    depth: {
      ...metric("depth", "누적 기록 수심", sum("maxDepthM", ["diving"]), "m", 1),
      note: "각 다이빙 기록의 최대 수심을 더한 값이에요. 실제 수직 이동 거리는 아니에요.",
    },
    volume: metric("volume", "누적 무게", sum("volumeKg", ["strength"]), "kg"),
    calories: metric("calories", "누적 소모", sum("calories"), "kcal"),
    steps: metric("steps", "누적 걸음", sum("steps", ["running", "hiking"]), "걸음"),
    elevation: metric(
      "elevation",
      "누적 고도 상승",
      sum("elevationGainM", ["running", "hiking", "cycling"]),
      "m",
    ),
    sets: metric("sets", "누적 세트", sum("sets", ["strength"]), "세트"),
    laps: metric("laps", "누적 랩", sum("laps", ["swimming"]), "lap"),
    strokes: metric("strokes", "누적 스트로크", sum("totalStrokes", ["swimming"]), "회"),
    dynamic: metric("dynamic", "누적 다이내믹", sum("dynamicDistanceM", ["diving"]), "m", 1),
    count: metric("count", "누적 운동", records.length, "회"),
  };
}

export function recordMetricStorageKey(userId: string) {
  return `groov-record-metric-layout-v1:${encodeURIComponent(userId)}`;
}
