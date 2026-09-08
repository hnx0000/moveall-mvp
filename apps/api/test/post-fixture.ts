import type { AppStore } from "../src/domain/store.js";
import type { SportType } from "@moveall/contracts";

export async function postWorkoutId(
  store: Pick<AppStore, "createWorkoutSession">,
  userId: string,
  sport: SportType = "running",
) {
  const workout = await store.createWorkoutSession(userId, {
    sport,
    startedAt: "2026-09-08T00:00:00Z",
    endedAt: "2026-09-08T00:30:00Z",
    perceivedExertion: 5,
    metrics: { durationMinutes: 30 },
    source: "manual",
  });
  return workout.id;
}
