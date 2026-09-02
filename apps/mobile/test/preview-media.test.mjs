import assert from "node:assert/strict";
import test from "node:test";

// Exercise the IndexedDB request/transaction boundary without operating a user browser.
function indexedDbDouble(storage, failWrite = false) {
  return {
    open() {
      const request = {};
      queueMicrotask(() => {
        request.result = {
          close() {},
          transaction() {
            const tx = {
              objectStore() {
                return {
                  put(blob, key) {
                    queueMicrotask(() => {
                      if (failWrite) tx.onerror?.();
                      else {
                        storage.set(key, blob);
                        tx.oncomplete?.();
                      }
                    });
                  },
                  get(key) {
                    const result = {};
                    queueMicrotask(() => {
                      result.result = storage.get(key);
                      result.onsuccess?.();
                    });
                    return result;
                  },
                  delete(key) {
                    queueMicrotask(() => {
                      storage.delete(key);
                      tx.oncomplete?.();
                    });
                  },
                };
              },
            };
            return tx;
          },
        };
        request.onsuccess?.();
      });
      return request;
    },
  };
}

test("preview artwork survives fresh-module hydration and is removed with its post", async () => {
  const previous = globalThis.indexedDB;
  const data = new Map();
  globalThis.indexedDB = indexedDbDouble(data);
  try {
    const media = await import("../src/media/preview-media.ts?first");
    const uri = "data:image/png;base64,aGVsbG8=";
    const key = await media.savePreviewImage("post-test", uri);
    assert.equal(data.get(key).type, "image/png");
    const restored = await import("../src/media/preview-media.ts?restored");
    await restored.hydratePreviewImages([{ mediaUrl: key }]);
    const loaded = restored.previewImageUri(key);
    assert.ok(loaded.startsWith("blob:"));
    assert.equal(await (await fetch(loaded)).text(), "hello");
    await restored.deletePreviewImage(key);
    assert.equal(data.has(key), false);
    assert.equal(restored.previewImageUri(key), undefined);
  } finally {
    if (previous === undefined) delete globalThis.indexedDB;
    else globalThis.indexedDB = previous;
  }
});

test("failed artwork writes reject instead of pretending a post was saved", async () => {
  const previous = globalThis.indexedDB;
  globalThis.indexedDB = indexedDbDouble(new Map(), true);
  try {
    const media = await import("../src/media/preview-media.ts?failed");
    await assert.rejects(
      media.savePreviewImage("failed", "data:image/png;base64,aGVsbG8="),
      /저장/,
    );
    assert.equal(media.previewImageUri("groov-preview-media:failed"), undefined);
  } finally {
    if (previous === undefined) delete globalThis.indexedDB;
    else globalThis.indexedDB = previous;
  }
});

test("workout and feed metadata storage failures keep retries possible without duplicates", async () => {
  const previous = globalThis.localStorage;
  const data = new Map();
  let fail = false;
  globalThis.localStorage = {
    getItem: (key) => data.get(key) ?? null,
    removeItem: (key) => data.delete(key),
    setItem(key, value) {
      if (fail) throw new Error("quota");
      data.set(key, value);
    },
  };
  try {
    const { demoApi } = await import("../src/api/demo-client.ts?quota");
    const beforeWorkouts = (await demoApi.workouts("demo")).length;
    const beforePosts = (await demoApi.feed()).length;
    const input = {
      sport: "running",
      startedAt: "2026-09-03T00:00:00Z",
      endedAt: "2026-09-03T01:00:00Z",
      perceivedExertion: 5,
      source: "manual",
      metrics: {},
      routePoints: [{ latitude: 37.5, longitude: 127, timestamp: 1000 }],
    };
    fail = true;
    await assert.rejects(demoApi.createWorkoutSession("demo", input), /저장/);
    await assert.rejects(
      demoApi.createPost("demo", { sport: "running", content: "저장 재시도" }),
      /저장/,
    );
    assert.equal((await demoApi.workouts("demo")).length, beforeWorkouts);
    assert.equal((await demoApi.feed()).length, beforePosts);
    fail = false;
    const saved = await demoApi.createWorkoutSession("demo", input);
    const { demoApi: restored } = await import("../src/api/demo-client.ts?quota-restored");
    assert.deepEqual(
      (await restored.workouts("demo")).find((item) => item.id === saved.id).routePoints,
      input.routePoints,
    );
  } finally {
    if (previous === undefined) delete globalThis.localStorage;
    else globalThis.localStorage = previous;
  }
});
