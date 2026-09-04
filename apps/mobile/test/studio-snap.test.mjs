import assert from "node:assert/strict";
import test from "node:test";
import {
  layer,
  recordGroup,
  regroupRecord,
  ungroupRecord,
} from "../src/components/record-studio-model.ts";
import { snapTextPosition } from "../src/components/studio-snap.ts";

const text = (id, x, y) => layer(id, "text", "hello", "text", x, y, 100, 40);
test("snap aligns both axes within four visible pixels", () => {
  const moving = text("a", 50, 50),
    target = text("b", 100, 200);
  const result = snapTextPosition(moving, 97, 202, [moving, target], 1);
  assert.equal(result.x, 100);
  assert.equal(result.y, 200);
  assert.deepEqual(result.guides, { x: 100, y: 200 });
});
test("magnet releases outside the small capture zone", () => {
  const result = snapTextPosition(text("a", 0, 0), 95, 205, [text("b", 100, 200)], 1);
  assert.equal(result.x, 95);
  assert.equal(result.y, 205);
  assert.deepEqual(result.guides, {});
});
test("threshold stays four screen pixels on a scaled canvas", () => {
  assert.equal(snapTextPosition(text("a", 0, 0), 93, 300, [text("b", 100, 200)], 0.5).x, 100);
  assert.equal(snapTextPosition(text("a", 0, 0), 91, 300, [text("b", 100, 200)], 0.5).x, 91);
});
test("ignore self, hidden text, graphics and rotated text", () => {
  const moving = text("a", 100, 200);
  const result = snapTextPosition(
    moving,
    98,
    198,
    [
      moving,
      { ...text("b", 100, 200), visible: false },
      { ...text("c", 100, 200), kind: "route" },
      { ...text("d", 100, 200), rotation: 30 },
    ],
    1,
  );
  assert.deepEqual(result.guides, {});
});
test("edge alignment works for text boxes with different widths", () => {
  const moving = text("a", 0, 0),
    target = { ...text("b", 200, 300), width: 200 };
  const result = snapTextPosition(moving, 152, 400, [target], 1);
  assert.equal(result.x, 150);
  assert.equal(result.guides.x, 100);
});
test("regroup and split preserve individually edited layout and visibility", () => {
  const entries = [
    text("a", 100, 120),
    { ...text("b", 260, 330), rotation: 25, scale: 1.3, color: "#123456", visible: false },
  ];
  const result = ungroupRecord(regroupRecord(entries), true);
  for (let i = 0; i < result.length; i++) {
    for (const key of ["x", "y", "rotation", "scale"])
      assert.ok(Math.abs(result[i][key] - entries[i][key]) < 1e-8);
    assert.equal(result[i].color, entries[i].color);
    assert.equal(result[i].visible, entries[i].visible);
  }
});
test("record starts grouped and splitting preserves a moved, rotated group's children", () => {
  const group = recordGroup({
    sport: "running",
    startedAt: "2026-09-04T00:00:00Z",
    endedAt: "2026-09-04T00:18:00Z",
    metrics: { distanceKm: 2.6 },
  });
  assert.equal(group.kind, "group");
  const flat = ungroupRecord({ ...group, rotation: 15, scale: 0.7 }, true);
  const roundTrip = ungroupRecord(regroupRecord(flat), true);
  flat.forEach((child, index) => assert.ok(Math.abs(child.x - roundTrip[index].x) < 1e-8));
});
