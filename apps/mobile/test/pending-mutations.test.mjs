import test from "node:test";
import assert from "node:assert/strict";
import { createPendingMutations } from "../src/api/pending-mutations.ts";
import { normalizePendingInput } from "../src/api/pending-input.ts";
const item = {
  owner: "A",
  kind: "workout.create",
  key: "one",
  input: { sport: "running" },
  createdAt: "2026-09-08",
};
function fixture() {
  const data = new Map();
  return {
    getItem: async (k) => data.get(k) ?? null,
    setItem: async (k, v) => {
      data.set(k, v);
    },
    removeItem: async (k) => {
      data.delete(k);
    },
  };
}
test("pending requests survive reload and remain isolated to owner", async () => {
  const storage = fixture();
  await createPendingMutations(storage, "live").reserve(item);
  const restored = createPendingMutations(storage, "live");
  assert.deepEqual(await restored.list("A"), [item]);
  assert.deepEqual(await restored.list("B"), []);
  await restored.reserve(item);
  await assert.rejects(restored.reserve({ ...item, key: "two" }));
  await restored.acknowledge("A", item.kind, "two");
  assert.equal((await restored.list("A")).length, 1);
  await restored.acknowledge("A", item.kind, "one");
  assert.deepEqual(await restored.list("A"), []);
});
test("failed disk write never reserves; concurrent different writes cannot overwrite", async () => {
  const broken = createPendingMutations(
    {
      ...fixture(),
      setItem: async () => {
        throw Error("disk full");
      },
    },
    "x",
  );
  await assert.rejects(broken.reserve(item), /disk full/);
  const store = createPendingMutations(fixture(), "x");
  const results = await Promise.allSettled([
    store.reserve(item),
    store.reserve({ ...item, key: "other" }),
  ]);
  assert.equal(results.filter((x) => x.status === "fulfilled").length, 1);
});
test("schema key reordering does not prevent same-key recovery", async () => {
  const store = createPendingMutations(fixture(), "x");
  await store.reserve({
    ...item,
    input: { sport: "running", contentType: "post", content: "same" },
  });
  await store.reserve({
    ...item,
    input: { content: "same", sport: "running", contentType: "post" },
  });
  assert.equal((await store.list("A")).length, 1);
});

test("GPS pause metadata and trimmed fields cannot deadlock a same-key schema replay", async () => {
  const storage = fixture();
  const raw = {
    ...item,
    input: {
      sport: "running",
      startedAt: "2026-09-08T00:00:00Z",
      endedAt: "2026-09-08T00:10:00Z",
      perceivedExertion: 5,
      metrics: { durationMinutes: 10 },
      routePoints: [
        {
          latitude: 37.5,
          longitude: 127,
          timestamp: 1788825600000,
          accuracy: 5,
          breakBefore: true,
          breakReason: "pause",
        },
      ],
    },
  };
  // Also cover a previously stored, pre-normalization payload.
  await createPendingMutations(storage, "gps").reserve(raw);
  const store = createPendingMutations(storage, "gps", normalizePendingInput);
  const normalized = normalizePendingInput(raw.kind, raw.input);
  assert.equal(normalized.routePoints[0].breakReason, undefined);
  await store.reserve({ ...raw, input: normalized });
  await assert.rejects(
    store.reserve({ ...raw, input: { ...normalized, metrics: { durationMinutes: 11 } } }),
  );
  assert.equal((await store.list("A")).length, 1);
});

test("a proven uncreated post keeps its only draft before releasing the save slot", async () => {
  const storage = fixture();
  const store = createPendingMutations(storage, "drafts");
  const rejected = {
    ...item,
    kind: "post.create",
    input: {
      content: "keep my caption",
      mediaId: "uploaded-image",
      audience: { scope: "crew", crewIds: ["deleted"] },
    },
  };
  await store.reserve(rejected);
  await store.preserveRejected("A", rejected.kind, rejected.key);
  const reloaded = createPendingMutations(storage, "drafts");
  assert.deepEqual(await reloaded.rejectedDrafts("A"), [rejected]);
  assert.deepEqual(await reloaded.rejectedDrafts("B"), []);
  assert.deepEqual(await reloaded.list("A"), []);
  await reloaded.reserve({ ...rejected, key: "new" });
  assert.equal((await reloaded.rejectedDrafts("A")).length, 1);
});

test("failed draft preservation never erases the pending original", async () => {
  const storage = fixture();
  const store = createPendingMutations(
    {
      ...storage,
      setItem: async (key, value) => {
        if (key.endsWith(":rejected-drafts")) throw Error("disk full");
        await storage.setItem(key, value);
      },
    },
    "drafts",
  );
  await store.reserve(item);
  await assert.rejects(store.preserveRejected("A", item.kind, item.key), /disk full/);
  assert.deepEqual(await store.list("A"), [item]);
});
