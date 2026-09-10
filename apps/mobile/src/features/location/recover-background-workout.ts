import type { ActiveWorkoutCheckpoint } from "./active-workout-recovery";
import { mergeTrackPointSources, type RecordedTrackPoint } from "./gps-track.ts";

/** Recover only time confirmed by this workout's native fixes, never the time of reopening. */
export function recoverBackgroundWorkout(
  checkpoint: ActiveWorkoutCheckpoint,
  buffered: RecordedTrackPoint[],
  now = Date.now(),
): ActiveWorkoutCheckpoint {
  const wasRecording =
    typeof checkpoint.recordingSince === "number" && Number.isFinite(checkpoint.recordingSince);
  const eligible = buffered.filter(
    (point) =>
      point.timestamp >= checkpoint.startedAt &&
      point.timestamp <= now &&
      (point.timestamp <= checkpoint.savedAt ||
        (wasRecording && point.timestamp >= checkpoint.recordingSince!)),
  );
  const points = mergeTrackPointSources(
    checkpoint.points.filter((point) => point.timestamp <= now),
    eligible,
    checkpoint.sport,
    checkpoint.pauseBoundaries,
  );
  const confirmedAt = wasRecording
    ? Math.max(checkpoint.savedAt, points.at(-1)?.timestamp ?? checkpoint.savedAt)
    : checkpoint.savedAt;
  return {
    ...checkpoint,
    points,
    savedAt: confirmedAt,
    elapsedMs: checkpoint.elapsedMs + Math.max(0, confirmedAt - checkpoint.savedAt),
    recordingSince: null,
  };
}
