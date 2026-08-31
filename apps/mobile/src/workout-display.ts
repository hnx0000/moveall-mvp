import type { WorkoutSession } from "@moveall/contracts";

export function sortWorkoutsForDisplay(workouts: WorkoutSession[]) {
  return [...workouts].sort((left, right) => {
    const qualityDifference =
      Number(isMeaningfulWorkout(right)) - Number(isMeaningfulWorkout(left));
    if (qualityDifference !== 0) return qualityDifference;
    return Date.parse(right.endedAt) - Date.parse(left.endedAt);
  });
}

export function isMeaningfulWorkout(workout: WorkoutSession) {
  const durationSeconds = Math.max(
    0,
    (Date.parse(workout.endedAt) - Date.parse(workout.startedAt)) / 1000,
  );
  if (workout.sport === "running" || workout.sport === "hiking" || workout.sport === "cycling") {
    return Number(workout.metrics.distanceKm ?? 0) >= 0.05 || durationSeconds >= 600;
  }
  if (workout.sport === "swimming") {
    return Number(workout.metrics.distanceM ?? 0) >= 25 || durationSeconds >= 600;
  }
  if (workout.sport === "diving") {
    return (
      Number(workout.metrics.maxDepthM ?? 0) > 0 ||
      Number(workout.metrics.dynamicDistanceM ?? 0) > 0 ||
      durationSeconds >= 600
    );
  }
  return (
    Number(workout.metrics.exerciseCount ?? 0) > 0 ||
    Number(workout.metrics.routineCompletion ?? 0) > 0 ||
    durationSeconds >= 300
  );
}
