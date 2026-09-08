import test from "node:test";
import assert from "node:assert/strict";
import { createActiveWorkoutStore } from "../src/features/location/active-workout-recovery.ts";
const sample = {
  version: 1,
  id: "run-1",
  owner: "A",
  sport: "running",
  startedAt: 1000,
  savedAt: 6000,
  elapsedMs: 5000,
  points: [{ latitude: 37, longitude: 127, timestamp: 6000 }],
  pauseBoundaries: [],
  fields: { poolLength: "25" },
};
function fixture() {
  const map = new Map();
  return {
    getItem: async (k) => map.get(k) ?? null,
    setItem: async (k, v) => {
      map.set(k, v);
    },
    removeItem: async (k) => {
      map.delete(k);
    },
  };
}
test("workout checkpoint survives reload without inventing elapsed time or leaking owners", async () => {
  const storage = fixture();
  await createActiveWorkoutStore(storage, "live").write(sample);
  const restored = createActiveWorkoutStore(storage, "live");
  assert.deepEqual(await restored.read("A"), sample);
  assert.equal(await restored.read("B"), null);
  await assert.rejects(restored.write({ ...sample, id: "run-2" }));
});
test("completion fences a late write and removes only the matching workout", async () => {
  const store = createActiveWorkoutStore(fixture(), "live");
  await store.write(sample);
  const results = await Promise.all([
    store.complete("A", "run-1"),
    store.write({ ...sample, elapsedMs: 9999 }),
  ]);
  assert.equal(
    results[1],
    false,
    "a deleted checkpoint cannot be reported as a successful restore",
  );
  assert.equal(await store.read("A"), null);
  await store.write({ ...sample, id: "run-2" });
  await store.complete("A", "run-1");
  assert.equal((await store.read("A")).id, "run-2");
});
test("failed checkpoint writes remain visible to caller and preserve previous copy", async () => {
  const storage = fixture();
  const store = createActiveWorkoutStore(storage, "live");
  await store.write(sample);
  storage.setItem = async () => {
    throw Error("disk full");
  };
  await assert.rejects(store.write({ ...sample, elapsedMs: 9999 }));
  assert.deepEqual(await store.read("A"), sample);
});
