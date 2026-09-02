import assert from "node:assert/strict";
import test from "node:test";
import {
  brandVisible,
  constrainLayer,
  detachedRoute,
  fitRouteMap,
  initialLayers,
  layer,
  projectRoute,
  routePath,
  workoutMetricLayers,
} from "../src/components/record-studio-model.ts";
import { appendTrackPoint, calculateTrackDistance } from "../src/features/location/gps-track.ts";

const point = (latitude, longitude, timestamp = 0, extra = {}) => ({
  latitude,
  longitude,
  timestamp,
  accuracy: 5,
  altitude: null,
  ...extra,
});
const route = [point(37.5, 127, 0), point(37.501, 127, 10000), point(37.501, 127.001, 20000)];
test("missing historical GPS never becomes a sample route", () => {
  assert.equal(fitRouteMap([]), null);
  assert.deepEqual(detachedRoute([]), []);
  assert.equal(routePath([]), "");
});
test("map route projection fits the portrait and keeps its Mercator geometry", () => {
  const camera = fitRouteMap(route);
  assert.ok(camera.zoom <= 18);
  for (const p of camera.points) {
    assert.ok(p.x >= 35 && p.x <= 325);
    assert.ok(p.y >= 70 && p.y <= 500);
  }
  const world = projectRoute(route),
    free = detachedRoute(route);
  const worldRatio = (world[2].x - world[0].x) / (world[0].y - world[1].y);
  const freeRatio = (free[2].x - free[0].x) / (free[0].y - free[1].y);
  assert.ok(Math.abs(worldRatio - freeRatio) < 1e-7);
});
test("longitude wrapping does not stretch a route across the world", () => {
  const camera = fitRouteMap([point(0, 179.999), point(0, -179.999, 10000)]);
  assert.ok(camera.zoom > 10);
});
test("GPS gaps remain disconnected in both map and detached route", () => {
  const broken = [...route, point(37.51, 127.02, 100000, { breakBefore: true })];
  assert.equal((routePath(fitRouteMap(broken).points).match(/M/g) ?? []).length, 2);
  assert.equal((routePath(detachedRoute(broken)).match(/M/g) ?? []).length, 2);
});
test("external export always shows GROOV, irrespective of the in-app switch", () => {
  assert.equal(brandVisible(false, false), false);
  assert.equal(brandVisible(true, false), true);
  assert.equal(brandVisible(false, true), true);
  assert.equal(brandVisible(true, true), true);
});
test("drag and resize bounds keep layers on the canvas", () => {
  const item = constrainLayer({ ...layer("a", "text", "text", "text", -200, 2000), scale: 20 });
  assert.ok(item.x - (item.width * item.scale) / 2 >= 0);
  assert.ok(item.y + (item.height * item.scale) / 2 <= 640);
});
test("metrics use the selected workout, not invented values or editable stats", () => {
  const workout = {
    sport: "cycling",
    startedAt: "2026-09-03T00:00:00Z",
    endedAt: "2026-09-03T01:00:00Z",
    metrics: { distanceKm: 20, averageSpeedKmh: 20, calories: 500 },
    routePoints: route,
  };
  const layers = workoutMetricLayers(workout);
  assert.equal(layers.find((l) => l.id === "metric-distanceKm").text, "20.00 km");
  assert.equal(layers.find((l) => l.id === "metric-duration").text, "01:00:00");
  assert.equal(
    layers.some((l) => l.id === "metric-averageHeartRateBpm"),
    false,
  );
  assert.equal(
    initialLayers({ ...workout, routePoints: [] }).find((l) => l.kind === "route").visible,
    false,
  );
});

test("rotated layers stay inside the artwork when moved or enlarged", () => {
  for (const rotation of [15, 45, 90, 135, 275]) {
    const item = constrainLayer({
      ...layer("rotation", "text", "hello", "text", -100, 900, 300, 70),
      rotation,
      scale: 3,
    });
    const angle = (rotation * Math.PI) / 180;
    const width =
      (Math.abs(item.width * Math.cos(angle)) + Math.abs(item.height * Math.sin(angle))) *
      item.scale;
    const height =
      (Math.abs(item.width * Math.sin(angle)) + Math.abs(item.height * Math.cos(angle))) *
      item.scale;
    assert.ok(item.x - width / 2 >= 4.99);
    assert.ok(item.x + width / 2 <= 355.01);
    assert.ok(item.y - height / 2 >= 4.99);
    assert.ok(item.y + height / 2 <= 635.01);
  }
});
test("GPS rejects jitter, out-of-order points, invalid fixes and unrealistic jumps", () => {
  const first = [point(37.5, 127, 1000)];
  assert.equal(appendTrackPoint(first, point(37.5, 127, 2000)), first);
  assert.equal(appendTrackPoint(first, point(37.51, 127, 2000)), first);
  assert.equal(appendTrackPoint(first, point(37.5001, 127, 0)), first);
  assert.equal(appendTrackPoint(first, point(37.5001, 127, 2000, { accuracy: 200 })), first);
  assert.equal(appendTrackPoint(first, point(NaN, 127, 2000)), first);
});
test("GPS resumes after a gap without inflating measured distance", () => {
  const before = [point(37.5, 127, 1000), point(37.5001, 127, 3000)];
  const resumed = appendTrackPoint(before, point(37.6, 127, 100000));
  assert.equal(resumed.at(-1).breakBefore, true);
  assert.equal(calculateTrackDistance(resumed), calculateTrackDistance(before));
  const afterPause = appendTrackPoint(before, point(37.6, 127, 4000, { breakBefore: true }));
  assert.equal(calculateTrackDistance(afterPause), calculateTrackDistance(before));
});
