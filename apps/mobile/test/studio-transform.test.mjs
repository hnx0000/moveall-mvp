import assert from "node:assert/strict";
import test from "node:test";
import { resizeFromHandle } from "../src/components/studio-transform.ts";
import { recordGroup, ungroupRecord } from "../src/components/record-studio-model.ts";

const base = {
  scale: 1,
  rotation: 0,
  displayScale: 1,
  width: 200,
  height: 200,
  corner: "se",
  dx: 20,
  dy: 20,
};
test("corner handles resize consistently at different preview sizes and rotations", () => {
  assert.equal(resizeFromHandle(base), 1.2);
  assert.equal(resizeFromHandle({ ...base, displayScale: 0.5, dx: 10, dy: 10 }), 1.2);
  assert.equal(resizeFromHandle({ ...base, rotation: 90, dx: -20, dy: 20 }), 1.2);
  assert.equal(resizeFromHandle({ ...base, corner: "nw", dx: -20, dy: -20 }), 1.2);
});
test("photos can shrink below canvas size without flipping or disappearing", () => {
  assert.equal(resizeFromHandle({ ...base, dx: -90, dy: -90 }), 0.15);
  assert.equal(resizeFromHandle({ ...base, dx: 99999, dy: 99999 }), 6);
});
test("imported records are independent draggable elements with original metric values", () => {
  const items = ungroupRecord(
    recordGroup({
      sport: "running",
      startedAt: "2026-09-03T00:00:00Z",
      endedAt: "2026-09-03T00:30:00Z",
      metrics: { distanceKm: 5, calories: 250 },
    }),
  );
  assert.ok(items.every((item) => item.kind !== "group"));
  assert.ok(items.some((item) => item.text === "5.00 km"));
  const moved = { ...items[0], x: -50, y: 700 };
  assert.equal(moved.x, -50);
  assert.notEqual(items[1].x, -50);
});
