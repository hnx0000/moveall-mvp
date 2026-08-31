import type { SportType } from "@moveall/contracts";

export type RecordGoal = {
  id: string;
  postId: string;
  authorName: string;
  sport: SportType;
  content: string;
  private: boolean;
  achieved: boolean;
  createdAt: string;
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

export function saveRecordGoal(goal: Omit<RecordGoal, "id" | "achieved" | "createdAt">) {
  const current = readRecordGoals().filter((item) => item.postId !== goal.postId);
  const next: RecordGoal = {
    ...goal,
    id: `goal-${Date.now()}`,
    achieved: false,
    createdAt: new Date().toISOString(),
  };
  globalThis.localStorage?.setItem(storageKey, JSON.stringify([next, ...current]));
  return next;
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
