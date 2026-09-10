import assert from "node:assert/strict";
import test from "node:test";
import { readFile } from "node:fs/promises";
import { moveListItem, reorderTarget } from "../src/lib/reorder-list.ts";

test("drag reorder preserves fields and identity, supports both ends, and leaves its input intact", () => {
  const items = [{ id: "a", sets: "3" }, { id: "b", sets: "5" }, { id: "c", sets: "4" }];
  const next = moveListItem(items, 0, 2);
  assert.deepEqual(next.map(item => item.id), ["b", "c", "a"]);
  assert.equal(next[2], items[0]);
  assert.deepEqual(moveListItem(next, 2, 0), items);
  assert.deepEqual(items.map(item => item.sets), ["3", "5", "4"]);
  assert.equal(moveListItem(items, 0, -1), items);
  assert.equal(moveListItem(items, 0, 3), items);
  assert.equal(moveListItem(items, 1, 1), items);
});

test("row centers determine destinations for unequal heights without small-movement swaps", () => {
  const rows = [{ y: 0, height: 150 }, { y: 158, height: 70 }, { y: 236, height: 110 }];
  assert.equal(reorderTarget(rows, 0, 8), 0);
  assert.equal(reorderTarget(rows, 0, 120), 1);
  assert.equal(reorderTarget(rows, 0, 220), 2);
  assert.equal(reorderTarget(rows, 2, -220), 0);
  assert.equal(reorderTarget(rows, 2, -110), 1);
});

test("profile uses stable draft keys and shared drag handles instead of arrow buttons", async () => {
  const profile = await readFile(new URL("../app/(tabs)/profile.tsx", import.meta.url), "utf8");
  const component = await readFile(new URL("../src/components/reorderable-list.tsx", import.meta.url), "utf8");
  assert.equal((profile.match(/<ReorderableList /g) || []).length, 2);
  assert.match(profile, /itemKey=\{item => item.draftId\}/);
  assert.doesNotMatch(profile, /moveRoutineItem|onPress=.*moveRoutine\(|↑|↓/);
  assert.match(profile, /routineItemRemove: \{ position: "absolute", top: 0, right: 0/);
  assert.match(profile, /api.reorderRoutines/);
  assert.match(profile, /scrollEnabled=\{!draggingRoutine\}/);
  assert.match(component, /onPanResponderTerminate: .*onFinish\(false\)/);
  assert.match(component, /touchAction: "none"/);
  assert.match(component, /scrollTo\(/);
  assert.match(component, /accessibilityActions=/);
});
