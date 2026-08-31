import type { SportType, WorkoutSession } from "@moveall/contracts";

export type RecordGoalTarget = {
  metric: "distanceKm" | "distanceM" | "elevationGainM" | "sets" | "exerciseCount" | "maxDepthM";
  value: number;
  label: string;
};

export type RecordGoal = {
  id: string;
  postId: string;
  authorName: string;
  sport: SportType;
  content: string;
  private: boolean;
  achieved: boolean;
  createdAt: string;
  target?: RecordGoalTarget;
};

const storageKey = "groov-record-goals-v1";

export function readRecordGoals(): RecordGoal[] {
  try {
    const raw = globalThis.localStorage?.getItem(storageKey);
    if (!raw) return [];
    const parsed: unknown = JSON.parse(raw);
    return Array.isArray(parsed) ? (parsed as RecordGoal[]) : [];
  } catch {
    return [];
  }
}

export function saveRecordGoal(goal: Omit<RecordGoal, "id" | "achieved" | "createdAt" | "target">) {
  const current = readRecordGoals().filter((item) => item.postId !== goal.postId);
  const target = recordGoalTarget(goal.sport, goal.content);
  const next: RecordGoal = {
    ...goal,
    id: `goal-${Date.now()}`,
    achieved: false,
    createdAt: new Date().toISOString(),
    ...(target ? { target } : {}),
  };
  globalThis.localStorage?.setItem(storageKey, JSON.stringify([next, ...current]));
  return next;
}

export function workoutMeetsRecordGoal(goal: RecordGoal, workout: WorkoutSession) {
  if (goal.achieved || workout.sport !== goal.sport) return false;
  if (Date.parse(workout.endedAt) < Date.parse(goal.createdAt)) return false;
  if (!goal.target) return true;

  const rawValue =
    goal.target.metric === "distanceM"
      ? (workout.metrics.distanceM ?? Number(workout.metrics.distanceKm ?? 0) * 1000)
      : workout.metrics[goal.target.metric];
  return typeof rawValue === "number" && rawValue >= goal.target.value;
}

export function removeRecordGoal(goalId: string) {
  globalThis.localStorage?.setItem(
    storageKey,
    JSON.stringify(readRecordGoals().filter((goal) => goal.id !== goalId)),
  );
}

export function markRecordGoalAchieved(goalId: string) {
  globalThis.localStorage?.setItem(
    storageKey,
    JSON.stringify(
      readRecordGoals().map((goal) => (goal.id === goalId ? { ...goal, achieved: true } : goal)),
    ),
  );
}

function recordGoalTarget(sport: SportType, content: string): RecordGoalTarget | undefined {
  const normalized = content.replace(/,/g, "");

  if (sport === "running" || sport === "cycling" || sport === "hiking") {
    const distance = normalized.match(/(\d+(?:\.\d+)?)\s*km/i);
    if (distance) {
      const value = Number(distance[1]);
      if (Number.isFinite(value) && value > 0)
        return { metric: "distanceKm", value, label: `${value}km 이상` };
    }
    if (sport === "hiking") {
      const elevation = normalized.match(/(?:고도|상승)[^\d]*(\d+(?:\.\d+)?)\s*m/i);
      if (elevation) {
        const value = Number(elevation[1]);
        if (Number.isFinite(value) && value > 0)
          return { metric: "elevationGainM", value, label: `고도 ${value}m 이상` };
      }
    }
  }

  if (sport === "swimming") {
    const distance = normalized.match(/(\d+(?:\.\d+)?)\s*m/i);
    if (distance) {
      const value = Number(distance[1]);
      if (Number.isFinite(value) && value > 0)
        return { metric: "distanceM", value, label: `${value}m 이상` };
    }
  }

  if (sport === "strength") {
    const sets = normalized.match(/(\d+)\s*세트/);
    if (sets) {
      const value = Number(sets[1]);
      if (value > 0) return { metric: "sets", value, label: `${value}세트 이상` };
    }
    const exercises = normalized.match(/(\d+)\s*종목/);
    if (exercises) {
      const value = Number(exercises[1]);
      if (value > 0) return { metric: "exerciseCount", value, label: `${value}종목 이상` };
    }
  }

  if (sport === "diving") {
    const depth = normalized.match(/(?:수심|depth)[^\d]*(\d+(?:\.\d+)?)\s*m/i);
    if (depth) {
      const value = Number(depth[1]);
      if (Number.isFinite(value) && value > 0)
        return { metric: "maxDepthM", value, label: `수심 ${value}m 이상` };
    }
  }

  return undefined;
}
