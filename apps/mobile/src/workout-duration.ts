type TimedWorkout = {
  startedAt: string;
  endedAt: string;
  metrics: Record<string, number>;
};

// Prefer measured active time: the wall-clock interval can contain pauses or a restart.
export function workoutDurationMilliseconds(workout: TimedWorkout): number {
  const ms = workout.metrics.durationMilliseconds;
  if (typeof ms === "number" && Number.isFinite(ms) && ms >= 0) return Math.round(ms);
  const minutes = workout.metrics.durationMinutes;
  if (typeof minutes === "number" && Number.isFinite(minutes) && minutes >= 0)
    return Math.round(minutes * 60_000);
  const elapsed = Date.parse(workout.endedAt) - Date.parse(workout.startedAt);
  return Number.isFinite(elapsed) ? Math.max(0, elapsed) : 0;
}

export function formatWorkoutClock(milliseconds: number): string {
  const centiseconds = Math.floor(
    Math.max(0, Number.isFinite(milliseconds) ? milliseconds : 0) / 10,
  );
  return [
    Math.floor(centiseconds / 360_000),
    Math.floor((centiseconds % 360_000) / 6_000),
    Math.floor((centiseconds % 6_000) / 100),
    centiseconds % 100,
  ]
    .map((value) => String(value).padStart(2, "0"))
    .join(":");
}
