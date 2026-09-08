import test from "node:test";
import assert from "node:assert/strict";
import { workoutDurationMilliseconds, formatWorkoutClock } from "../src/workout-duration.ts";

const workout = (metrics) => ({
  startedAt: "2026-09-08T00:00:00Z",
  endedAt: "2026-09-08T01:00:00Z",
  metrics,
});
test("saved active time excludes a long pause and preserves timer hundredths", () => {
  const record = workout({ durationMilliseconds: 58737, durationMinutes: 58737 / 60000 });
  assert.equal(workoutDurationMilliseconds(record), 58737);
  assert.equal(formatWorkoutClock(workoutDurationMilliseconds(record)), "00:00:58:73");
  assert.equal(formatWorkoutClock(4063780), "01:07:43:78");
});
test("legacy records use measured minutes before wall time, including explicit zero", () => {
  assert.equal(workoutDurationMilliseconds(workout({ durationMinutes: 2 })), 120000);
  assert.equal(workoutDurationMilliseconds(workout({ durationMinutes: 0 })), 0);
  assert.equal(workoutDurationMilliseconds(workout({})), 3600000);
  assert.equal(workoutDurationMilliseconds(workout({ durationMinutes: NaN })), 3600000);
  assert.equal(formatWorkoutClock(NaN), "00:00:00:00");
});
