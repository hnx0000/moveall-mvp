import assert from "node:assert/strict";
import test from "node:test";
import {
  NATIONAL_VIEW,
  SEOUL_VIEW,
  focusViewport,
  panViewport,
  zoomLevel,
  zoomViewport,
} from "../src/components/league-map-model.ts";

test("zoom keeps the same center and never leaves national bounds", () => {
  const zoomed = zoomViewport(SEOUL_VIEW, 0.5);
  assert.equal(zoomed.x + zoomed.width / 2, SEOUL_VIEW.x + SEOUL_VIEW.width / 2);
  assert.equal(zoomed.y + zoomed.height / 2, SEOUL_VIEW.y + SEOUL_VIEW.height / 2);
  assert.deepEqual(zoomViewport(NATIONAL_VIEW, 5), NATIONAL_VIEW);
});

test("dragging moves only the camera so shared region geometry stays gapless", () => {
  const moved = panViewport(SEOUL_VIEW, 100, -50, 400, 400);
  assert.ok(moved.x < SEOUL_VIEW.x);
  assert.ok(moved.y > SEOUL_VIEW.y);
  assert.equal(moved.width, SEOUL_VIEW.width);
});

test("district focus reveals neighborhood hotspots", () => {
  assert.ok(zoomLevel(focusViewport([102.7, 44.9])) > 2);
});
