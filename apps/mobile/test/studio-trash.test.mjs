import assert from "node:assert/strict";
import test from "node:test";
import { isOverTrash, hideDraggedLayer } from "../src/components/studio-trash.ts";
import { layer, recordGroup } from "../src/components/record-studio-model.ts";

test("trash accepts a release within its measured window coordinates only", () => {
  const bounds = { x: 140, y: 620, width: 88, height: 88 };
  assert.equal(isOverTrash(180, 660, bounds), true);
  assert.equal(isOverTrash(140, 620, bounds), true);
  assert.equal(isOverTrash(139, 660, bounds), false);
  assert.equal(isOverTrash(180, 709, bounds), false);
  assert.equal(isOverTrash(NaN, 660, bounds), false);
  assert.equal(isOverTrash(180, 660, null), false);
});
test("hiding keeps the text and restores its pre-drag position for the eye toggle", () => {
  const origin = {
    ...layer("text-1", "text", "오늘도 완주", "텍스트", 120, 250),
    rotation: 15,
    scale: 1.2,
  };
  const other = layer("text-2", "text", "남길 글", "텍스트", 200, 100);
  const hidden = hideDraggedLayer([{ ...origin, x: 180, y: 850 }, other], origin);
  assert.equal(hidden.length, 2);
  assert.deepEqual(hidden[0], { ...origin, visible: false });
  assert.equal(hidden[1], other);
  assert.deepEqual({ ...hidden[0], visible: true }, origin);
});
test("a record group is hidden and restored without losing metrics or child visibility", () => {
  const group = recordGroup({
    sport: "running",
    startedAt: "2026-09-04T00:00:00Z",
    endedAt: "2026-09-04T00:18:00Z",
    metrics: { distanceKm: 2.6 },
  });
  const hidden = hideDraggedLayer([{ ...group, y: 1000 }], group)[0];
  assert.equal(hidden.visible, false);
  assert.deepEqual(hidden.children, group.children);
  assert.deepEqual({ ...hidden, visible: true }, group);
});
test("an unknown drag does not remove unrelated layers", () => {
  const existing = layer("kept", "text", "hi", "text", 50, 50);
  assert.deepEqual(hideDraggedLayer([existing], { ...existing, id: "missing" }), [existing]);
});
