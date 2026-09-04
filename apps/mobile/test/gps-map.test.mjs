import assert from "node:assert/strict";
import test from "node:test";
import {
  appendTrackPointResult,
  calculateTrackDistance,
} from "../src/features/location/gps-track.ts";
import { mapFitPoints, splitRouteSegments } from "../src/components/workout-map-model.ts";

const point = (latitude, longitude, timestamp, accuracy = 6, extra = {}) => ({
  latitude,
  longitude,
  timestamp,
  accuracy,
  altitude: null,
  ...extra,
});

test("cycling track accepts continuous fixes and rejects inaccurate teleports", () => {
  let points = [];
  for (let index = 0; index < 5; index += 1) {
    const result = appendTrackPointResult(
      points,
      point(37.5 + index * 0.00009, 127, index * 1000),
      "cycling",
    );
    assert.equal(result.accepted, true);
    points = result.points;
  }

  const inaccurate = appendTrackPointResult(points, point(37.501, 127, 5000, 80), "cycling");
  assert.equal(inaccurate.accepted, false);
  assert.equal(inaccurate.reason, "inaccurate");

  const teleport = appendTrackPointResult(points, point(37.52, 127.02, 5000), "cycling");
  assert.equal(teleport.accepted, false);
  assert.equal(teleport.reason, "speed");
  assert.equal(teleport.points, points);
});

test("a long background gap starts a new segment and never invents distance", () => {
  const start = point(37.5, 127, 0);
  const moving = appendTrackPointResult([start], point(37.50009, 127, 1000), "running").points;
  const distanceBeforeGap = calculateTrackDistance(moving);
  const resumed = appendTrackPointResult(moving, point(37.51, 127.01, 60_000), "running");
  assert.equal(resumed.accepted, true);
  assert.equal(resumed.points.at(-1).breakBefore, true);
  assert.equal(calculateTrackDistance(resumed.points), distanceBeforeGap);
});

test("map segments do not draw a line across a paused or missing interval", () => {
  const points = [
    point(37.5, 127, 0),
    point(37.5001, 127, 1000),
    point(37.6, 127.1, 60_000, 6, { breakBefore: true }),
    point(37.6001, 127.1, 61_000),
  ];
  assert.deepEqual(
    splitRouteSegments(points).map((segment) => segment.length),
    [2, 2],
  );
  assert.equal(mapFitPoints(points, [], []).length, 4);
});

test("duplicate, non-finite and future fixes are rejected without mutating the track", () => {
  const start = point(37.5, 127, 1_000);
  const duplicate = appendTrackPointResult([start], point(37.5, 127, 1_000), "running");
  assert.equal(duplicate.accepted, false);
  assert.equal(duplicate.reason, "duplicate");
  assert.equal(duplicate.points.length, 1);

  const invalidAccuracy = appendTrackPointResult(
    [start],
    point(37.5001, 127, 2_000, Number.NaN),
    "running",
  );
  assert.equal(invalidAccuracy.reason, "invalid");

  const future = appendTrackPointResult(
    [start],
    point(37.5001, 127, 100_000),
    "running",
    { receivedAt: 2_000, maxFutureSkewMs: 30_000 },
  );
  assert.equal(future.reason, "future");
});

test("distance calculation never leaks NaN to saved workout metrics", () => {
  const corrupt = [point(37.5, 127, 0), point(Number.NaN, 127, 1_000)];
  assert.equal(calculateTrackDistance(corrupt), 0);
});
