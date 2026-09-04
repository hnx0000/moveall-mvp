import type { WorkoutSession } from "@moveall/contracts";
import { SAMPLE_STUDIO_ROUTE } from "./record-studio-model";

/** Only the editor consumes this fixture; never insert it into the user's workout history. */
export const SAMPLE_RUNNING_WORKOUT: WorkoutSession = {
  id: "editor-sample-running-route",
  userId: "editor-sample",
  sport: "running",
  startedAt: "2026-09-04T00:00:00.000Z",
  endedAt: "2026-09-04T00:18:00.000Z",
  createdAt: "2026-09-04T00:18:00.000Z",
  perceivedExertion: 4,
  source: "manual",
  notes: "편집 테스트용 가상 러닝 · 실제 운동 기록 아님",
  metrics: { distanceKm: 2.6, durationMinutes: 18, paceSeconds: 415, calories: 180 },
  routePoints: SAMPLE_STUDIO_ROUTE.map((point, index) => ({
    ...point,
    timestamp: Date.parse("2026-09-04T00:00:00.000Z") + index * 16875,
  })),
};
