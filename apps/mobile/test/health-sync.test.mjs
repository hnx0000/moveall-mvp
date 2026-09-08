import test from "node:test";
import assert from "node:assert/strict";
import {
  createHealthSyncCoordinator,
  healthOwner,
} from "../src/features/wearables/health-sync-engine.ts";
const deferred = () => {
  let resolve;
  const promise = new Promise((r) => {
    resolve = r;
  });
  return { promise, resolve };
};
const workout = {
  healthRecordId: "native-health-record-1",
  sport: "running",
  startedAt: "2026-09-08T01:00:00Z",
  endedAt: "2026-09-08T01:30:00Z",
  metrics: {},
  source: "wearable",
};
function fixture(initialUser = "A") {
  const data = new Map([["groov-health-auto-sync-enabled-v1", "true"]]);
  const uploads = [],
    exports = [];
  let consent = true;
  let activeUser = initialUser;
  const storage = {
    getItem: async (key) => data.get(key) ?? null,
    setItem: async (key, value) => {
      data.set(key, value);
    },
  };
  const api = {
    consent: async () => ({ healthDataAccepted: consent }),
    workouts: async () => [],
    createWorkoutSession: async (token, input) => {
      uploads.push(token);
      return { ...input, id: String(uploads.length) };
    },
  };
  const adapter = {
    provider: "apple-health",
    availability: async () => ({ available: true }),
    importRecentWorkouts: async () => [workout],
    exportWorkout: async (item) => {
      exports.push(item);
      return true;
    },
  };
  const engine = createHealthSyncCoordinator({
    storage,
    api,
    activeUserId: () => activeUser,
    isForeground: () => true,
    now: () => Date.parse("2026-09-08T02:00:00Z"),
  });
  return {
    engine,
    adapter,
    uploads,
    exports,
    data,
    storage,
    setUser: (value) => {
      activeUser = value;
    },
    setConsent: (value) => {
      consent = value;
    },
  };
}
test("legacy consent is never transferred to a new account, even with force", async () => {
  const f = fixture("B");
  await assert.rejects(f.engine.sync("B", f.adapter, { userId: "B", force: true }));
  assert.equal(f.uploads.length, 0);
  assert.equal(f.data.get("groov-health-auto-sync-enabled-v1"), "true");
});

test("original health ID is sent as operation metadata, not as workout body", async () => {
  const data = new Map();
  let request;
  const engine = createHealthSyncCoordinator({
    storage: {
      getItem: async (key) => data.get(key) ?? null,
      setItem: async (key, value) => data.set(key, value),
    },
    activeUserId: () => "A",
    isForeground: () => true,
    api: {
      consent: async () => ({ healthDataAccepted: true }),
      workouts: async () => [],
      createWorkoutSession: async (token, body, options) => {
        request = { token, body, options };
        throw Object.assign(Error("deleted"), { code: "HEALTH_IMPORT_DELETED" });
      },
    },
  });
  await engine.setEnabled(healthOwner("A", "apple-health"), true);
  const result = await engine.sync(
    "token",
    {
      provider: "apple-health",
      availability: async () => ({ available: true }),
      importRecentWorkouts: async () => [workout],
      exportWorkout: async () => true,
    },
    { userId: "A", force: true },
  );
  assert.equal(request.body.healthRecordId, undefined);
  assert.deepEqual(request.options, {
    idempotencyKey: workout.healthRecordId,
    healthProvider: "apple-health",
  });
  assert.equal(result.failed, 0);
  assert.equal(result.duplicates, 1);
});
test("server consent remains mandatory after local OS permission", async () => {
  const f = fixture();
  await f.engine.setEnabled(healthOwner("A", "apple-health"), true);
  f.setConsent(false);
  await assert.rejects(f.engine.sync("A", f.adapter, { userId: "A", force: true }));
  assert.equal(f.uploads.length, 0);
});
test("account switch during delayed health reading cannot upload to either new account or stale job", async () => {
  const f = fixture(),
    reading = deferred(),
    entered = deferred();
  await f.engine.setEnabled(healthOwner("A", "apple-health"), true);
  f.adapter.importRecentWorkouts = async () => {
    entered.resolve();
    return reading.promise;
  };
  const running = f.engine.sync("A", f.adapter, { userId: "A", force: true });
  await entered.promise;
  f.engine.cancel("A");
  f.setUser("B");
  await assert.rejects(f.engine.sync("B", f.adapter, { userId: "B", force: true }));
  reading.resolve([workout]);
  await running;
  assert.deepEqual(f.uploads, []);
});
test("same-account sync is single flight", async () => {
  const f = fixture();
  await f.engine.setEnabled(healthOwner("A", "apple-health"), true);
  const one = f.engine.sync("A", f.adapter, { userId: "A", force: true });
  const two = f.engine.sync("A", f.adapter, { userId: "A", force: true });
  assert.equal(one, two);
  await one;
  assert.deepEqual(f.uploads, ["A"]);
});

test("revocation blocks new work immediately, even before its disk write completes", async () => {
  const f = fixture(),
    write = deferred();
  await f.engine.setEnabled(healthOwner("A", "apple-health"), true);
  const original = f.storage.setItem;
  f.storage.setItem = async (key, value) => {
    if (value === "false") await write.promise;
    await original(key, value);
  };
  const disabling = f.engine.setEnabled(healthOwner("A", "apple-health"), false);
  await f.engine.sync("A", f.adapter, { userId: "A", force: true });
  assert.deepEqual(f.uploads, []);
  write.resolve();
  await disabling;
});

test("late screen requests after logout cannot start another health task", async () => {
  const f = fixture();
  await f.engine.setEnabled(healthOwner("A", "apple-health"), true);
  f.engine.cancel("A");
  f.setUser(null);
  await f.engine.sync("still-valid-token", f.adapter, {
    userId: "A",
    force: true,
    isCurrent: () => true,
  });
  assert.deepEqual(f.uploads, []);
});

test("an old cancelled task cannot delete the new single flight", async () => {
  const f = fixture(),
    first = deferred(),
    second = deferred(),
    entered = deferred();
  await f.engine.setEnabled(healthOwner("A", "apple-health"), true);
  let reads = 0;
  f.adapter.importRecentWorkouts = async () => {
    reads++;
    if (reads === 1) {
      entered.resolve();
      return first.promise;
    }
    return second.promise;
  };
  const old = f.engine.sync("A", f.adapter, { userId: "A", force: true });
  await entered.promise;
  f.engine.cancel("A");
  const next = f.engine.sync("A", f.adapter, { userId: "A", force: true });
  first.resolve([]);
  await old;
  assert.equal(f.engine.sync("A", f.adapter, { userId: "A", force: true }), next);
  second.resolve([workout]);
  await next;
  assert.deepEqual(f.uploads, ["A"]);
});
