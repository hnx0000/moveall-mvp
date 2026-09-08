import test from "node:test";
import assert from "node:assert/strict";
import {
  appendTrackPointResult,
  mergeTrackPointSources,
  calculateTrackDistance,
} from "../src/features/location/gps-track.ts";
const point = (n, extra = {}) => ({
  latitude: 37.5 + n * 0.00008,
  longitude: 127,
  accuracy: 6,
  altitude: null,
  timestamp: n * 5000,
  ...extra,
});
test("late background batch restores the route after a foreground fix arrives first", () => {
  const foreground = appendTrackPointResult([point(0)], point(12), "cycling").points;
  assert.equal(calculateTrackDistance(foreground), 0);
  const background = Array.from({ length: 12 }, (_, i) => point(i));
  const merged = mergeTrackPointSources(foreground, background, "cycling");
  assert.equal(merged.length, 13);
  assert.ok(calculateTrackDistance(merged) > 0.1);
  assert.equal(merged.at(-1).breakBefore, undefined);
  assert.deepEqual(mergeTrackPointSources(merged, background, "cycling"), merged);
});
test("explicit pauses survive a merge, while inaccurate teleports are rejected", () => {
  const existing = [point(0), point(2, { breakBefore: true, breakReason: "pause" })];
  const merged = mergeTrackPointSources(existing, [point(1), point(3, { accuracy: 1000 })]);
  assert.equal(merged.length, 3);
  assert.equal(merged.at(-1).breakReason, "pause");
});
test("foreground wins duplicate timestamps without repeated smoothing", () => {
  const existing = [point(0), point(1)];
  assert.deepEqual(mergeTrackPointSources(existing, [point(1, { latitude: 80 })]), existing);
});
test("merge is bounded at 30000 accepted points", () => {
  const incoming = Array.from({ length: 30005 }, (_, i) => point(i));
  assert.equal(mergeTrackPointSources([], incoming, "cycling").length, 30000);
});
test("a late first resumed fix moves the pause boundary without cutting the resumed route twice", () => {
  const old = point(0),
    resumed = point(4, { latitude: 37.6 });
  const foreground = point(5, { latitude: 37.60008, breakBefore: true, breakReason: "pause" });
  const merged = mergeTrackPointSources([old, foreground], [resumed], "running", [15000]);
  assert.equal(merged.length, 3);
  assert.equal(merged[1].breakReason, "pause");
  assert.equal(merged[2].breakBefore, undefined);
  assert.ok(calculateTrackDistance(merged) > 0.008);
});
test("a rejected first resumed fix retains the break for the next accepted fix", () => {
  const merged = mergeTrackPointSources(
    [point(0)],
    [point(3, { accuracy: 1000 }), point(4, { latitude: 37.6 })],
    "running",
    [10000],
  );
  assert.equal(merged.length, 2);
  assert.equal(merged[1].breakReason, "pause");
  assert.equal(calculateTrackDistance(merged), 0);
});
