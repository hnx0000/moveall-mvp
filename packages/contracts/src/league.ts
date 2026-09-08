import { z } from "zod";

export const LeagueModeSchema = z.enum([
  "activity",
  "running",
  "hiking",
  "cycling",
  "strength",
  "swimming",
  "diving",
]);
export type LeagueMode = z.infer<typeof LeagueModeSchema>;

export const LeaguePeriodSchema = z.enum(["week", "month", "season"]);
export type LeaguePeriod = z.infer<typeof LeaguePeriodSchema>;

export const LeagueQuerySchema = z
  .object({
    mode: LeagueModeSchema.default("activity"),
    period: LeaguePeriodSchema.default("season"),
    regionKey: z.string().trim().min(2).max(160).optional(),
  })
  .strict();
export type LeagueQuery = z.infer<typeof LeagueQuerySchema>;

export type LeagueSeason = {
  id: string;
  name: string;
  startAt: string;
  endAt: string;
};

export type LeaguePlayerStanding = {
  userId: string;
  displayName: string;
  rank: number;
  points: number;
  activityCount: number;
  mine: boolean;
};

export type LeagueRegionStanding = {
  regionKey: string;
  regionName: string;
  province: string | null;
  rank: number;
  points: number;
  activityCount: number;
  memberCount: number;
  activeMemberCount: number;
  participantCount: number;
  participationRate: number;
  leader: LeaguePlayerStanding | null;
};

export type LeagueSnapshot = {
  query: LeagueQuery;
  season: LeagueSeason;
  range: { startAt: string; endAt: string };
  generatedAt: string;
  revision: string;
  viewer: {
    verification: "verified" | "expired" | "missing";
    regionKey: string | null;
    regionName: string | null;
    verificationExpiresAt: string | null;
    rank: number | null;
    points: number;
    activityCount: number;
  };
  region: LeagueRegionStanding | null;
  regions: LeagueRegionStanding[];
  players: LeaguePlayerStanding[];
};

export type LeagueWorkoutForScoring = {
  sport: Exclude<LeagueMode, "activity">;
  startedAt: string;
  endedAt: string;
  perceivedExertion: number;
  metrics: Record<string, number>;
};

const sportMinuteWeight: Record<LeagueWorkoutForScoring["sport"], number> = {
  running: 2,
  hiking: 1.6,
  cycling: 1.4,
  strength: 1.5,
  swimming: 2.2,
  diving: 2,
};

const distanceWeight: Partial<Record<LeagueWorkoutForScoring["sport"], number>> = {
  running: 10,
  hiking: 8,
  cycling: 3,
  swimming: 25,
};

function finiteMetric(metrics: Record<string, number>, key: string, cap: number) {
  const value = metrics[key];
  return typeof value === "number" && Number.isFinite(value)
    ? Math.min(cap, Math.max(0, value))
    : 0;
}

export function calculateLeaguePoints(workout: LeagueWorkoutForScoring) {
  const elapsedMs = Date.parse(workout.endedAt) - Date.parse(workout.startedAt);
  const elapsedMinutes = Math.min(
    360,
    Number.isFinite(elapsedMs) ? Math.max(0, elapsedMs / 60_000) : 0,
  );
  const measured = [
    [workout.metrics.durationMilliseconds, 60_000],
    [workout.metrics.durationMinutes, 1],
    [workout.metrics.durationSeconds, 60],
  ] as const;
  const duration = measured.find(
    ([value]) => typeof value === "number" && Number.isFinite(value) && value >= 0,
  );
  // An explicit zero is measured zero, not an invitation to score the paused wall time.
  const metricMinutes = duration ? duration[0]! / duration[1] : elapsedMinutes;
  const durationMinutes = Math.min(elapsedMinutes, metricMinutes, 360);
  const distanceKm = finiteMetric(workout.metrics, "distanceKm", 300);
  const calories = finiteMetric(workout.metrics, "calories", 4_000);
  const exertion = Math.min(10, Math.max(1, workout.perceivedExertion || 5));

  let raw = durationMinutes * sportMinuteWeight[workout.sport];
  raw += distanceKm * (distanceWeight[workout.sport] ?? 0);
  raw += calories * 0.04;

  if (workout.sport === "strength") {
    raw += finiteMetric(workout.metrics, "volumeKg", 30_000) * 0.008;
    raw += finiteMetric(workout.metrics, "sets", 80) * 2;
  }
  if (workout.sport === "diving") {
    raw += finiteMetric(workout.metrics, "maxDepthM", 150) * 4;
    raw += finiteMetric(workout.metrics, "dynamicDistanceM", 300) * 0.5;
  }

  const effortFactor = 0.8 + exertion * 0.04;
  return Math.max(0, Math.min(3_000, Math.round(raw * effortFactor)));
}

const kstOffsetMs = 9 * 60 * 60 * 1000;

function kstParts(now: Date) {
  const shifted = new Date(now.getTime() + kstOffsetMs);
  return {
    year: shifted.getUTCFullYear(),
    month: shifted.getUTCMonth(),
    date: shifted.getUTCDate(),
    day: shifted.getUTCDay(),
  };
}

function kstBoundary(year: number, month: number, date = 1) {
  return new Date(Date.UTC(year, month, date) - kstOffsetMs);
}

export function currentLeagueSeason(now = new Date()): LeagueSeason {
  const { year, month } = kstParts(now);
  let startYear = year;
  let startMonth: number;
  let name: string;
  if (month >= 2 && month <= 4) {
    startMonth = 2;
    name = "봄";
  } else if (month >= 5 && month <= 7) {
    startMonth = 5;
    name = "여름";
  } else if (month >= 8 && month <= 10) {
    startMonth = 8;
    name = "가을";
  } else {
    startMonth = 11;
    name = "겨울";
    startYear = month === 11 ? year : year - 1;
  }
  const endMonth = startMonth === 11 ? 2 : startMonth + 3;
  const endYear = startMonth === 11 ? startYear + 1 : startYear;
  return {
    id: `${startYear}-${name}`,
    name: `${startYear} ${name} 시즌`,
    startAt: kstBoundary(startYear, startMonth).toISOString(),
    endAt: kstBoundary(endYear, endMonth).toISOString(),
  };
}

export function leagueRange(period: LeaguePeriod, now = new Date()) {
  const season = currentLeagueSeason(now);
  if (period === "season") return { startAt: season.startAt, endAt: season.endAt };
  const parts = kstParts(now);
  if (period === "month") {
    return {
      startAt: kstBoundary(parts.year, parts.month).toISOString(),
      endAt: kstBoundary(parts.year, parts.month + 1).toISOString(),
    };
  }
  const daysFromMonday = (parts.day + 6) % 7;
  return {
    startAt: kstBoundary(parts.year, parts.month, parts.date - daysFromMonday).toISOString(),
    endAt: kstBoundary(parts.year, parts.month, parts.date - daysFromMonday + 7).toISOString(),
  };
}
