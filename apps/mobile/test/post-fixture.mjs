export async function demoPostWorkout(api) {
  return api.createWorkoutSession("demo", {
    sport: "running",
    startedAt: "2026-09-08T00:00:00Z",
    endedAt: "2026-09-08T00:30:00Z",
    metrics: { durationMinutes: 30 },
    perceivedExertion: 5,
    source: "manual",
  });
}
