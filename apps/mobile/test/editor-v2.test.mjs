import assert from "node:assert/strict";
import test from "node:test";
import { applyGesture, initialEditorDocument, pushHistory, touchGeometry } from "../src/editor-v2/editor-model.ts";

test("V2 transforms store normalized coordinates and clamp scale", () => {
  const moved = applyGesture({ x: .5, y: .5, scale: 1, rotation: 0 }, { dx: 100, dy: -50, scale: 10, rotation: 200 }, { width: 400, height: 500 });
  assert.equal(moved.x, .75);
  assert.equal(moved.y, .4);
  assert.equal(moved.scale, 3);
  assert.equal(moved.rotation, -160);
});

test("two touches produce a stable pinch center, distance and angle", () => {
  assert.deepEqual(touchGeometry([{ pageX: 10, pageY: 20 }, { pageX: 40, pageY: 60 }]), { centerX: 25, centerY: 40, distance: 50, angle: 53.13010235415598 });
});

test("editor history is immutable and capped", () => {
  const history = Array.from({ length: 55 }, () => initialEditorDocument);
  const result = pushHistory(history, { ...initialEditorDocument, ratio: "1:1" });
  assert.equal(result.length, 50);
  assert.equal(result.at(-1).ratio, "1:1");
  assert.notEqual(result.at(-1), initialEditorDocument);
});

test("V2 starts clean without an unsolicited record layer", () => {
  assert.deepEqual(initialEditorDocument.layers, []);
});

test("landscape 3:2 is preserved in the editable document", () => {
  const landscape = { ...initialEditorDocument, ratio: "3:2" };
  assert.equal(pushHistory([], landscape).at(-1).ratio, "3:2");
});
