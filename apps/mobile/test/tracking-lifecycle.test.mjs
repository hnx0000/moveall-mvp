import test from "node:test";
import assert from "node:assert/strict";
import {
  createTrackingLifetime,
  createSerialTaskQueue,
  createBackgroundTrackStore,
} from "../src/features/location/tracking-lifecycle.ts";
const deferred = () => {
  let resolve;
  const promise = new Promise((r) => {
    resolve = r;
  });
  return { promise, resolve };
};

test("unmount and StrictMode remount invalidate old permission and workout scopes", async () => {
  const life = createTrackingLifetime();
  life.mount();
  const old = life.begin(),
    scope = life.scope(),
    permission = deferred();
  let starts = 0;
  const work = permission.promise.then(() => {
    if (old()) starts++;
  });
  life.unmount();
  life.mount();
  const next = life.begin();
  permission.resolve();
  await work;
  assert.equal(starts, 0);
  assert.equal(scope(), false);
  assert.equal(next(), true);
});
test("a watcher delivered after pause is removed, never owned by the new start", () => {
  const life = createTrackingLifetime();
  life.mount();
  const old = life.begin();
  life.invalidate();
  const next = life.begin();
  let removed = 0;
  life.attach(
    {
      remove() {
        removed++;
      },
    },
    old,
  );
  assert.equal(removed, 1);
  assert.equal(next(), true);
  life.attach(
    {
      remove() {
        removed++;
      },
    },
    next,
  );
  life.unmount();
  assert.equal(removed, 2);
});
test("queued resume waits for pause drain; rejection cannot poison later work", async () => {
  const queue = createSerialTaskQueue(),
    pause = deferred(),
    order = [];
  const first = queue(async () => {
    await pause.promise;
    order.push("drained");
  });
  const second = queue(async () => {
    order.push("resumed");
  });
  await Promise.resolve();
  assert.deepEqual(order, []);
  pause.resolve();
  await Promise.all([first, second]);
  assert.deepEqual(order, ["drained", "resumed"]);
  await assert.rejects(
    queue(async () => {
      throw Error("disk");
    }),
  );
  assert.equal(await queue(async () => 42), 42);
});
function fixture() {
  const data = new Map();
  const storage = {
    getItem: async (key) => data.get(key) ?? null,
    setItem: async (key, value) => {
      data.set(key, value);
    },
    removeItem: async (key) => {
      data.delete(key);
    },
    multiRemove: async (keys) => {
      keys.forEach((key) => data.delete(key));
    },
  };
  const buffer = createBackgroundTrackStore(storage, (old, points) =>
    [...old, ...points].sort((a, b) => a.timestamp - b.timestamp),
  );
  return { buffer, data, storage };
}
test("consume and concurrent batch append never erase the new batch", async () => {
  const f = fixture();
  await f.buffer.begin("running", 0);
  await f.buffer.append([{ timestamp: 1 }]);
  const pause = deferred(),
    entered = deferred(),
    remove = f.storage.removeItem;
  f.storage.removeItem = async (key) => {
    entered.resolve();
    await pause.promise;
    await remove(key);
  };
  const consuming = f.buffer.consume();
  await entered.promise;
  const writing = f.buffer.append([{ timestamp: 2 }]);
  pause.resolve();
  assert.deepEqual(await consuming, [{ timestamp: 1 }]);
  await writing;
  assert.deepEqual(await f.buffer.read(), [{ timestamp: 2 }]);
});
test("sealed pause excludes later fixes; new workout ignores delayed old batches", async () => {
  const f = fixture();
  await f.buffer.begin("cycling", 10);
  await f.buffer.seal(20);
  await f.buffer.append([{ timestamp: 9 }, { timestamp: 15 }, { timestamp: 25 }]);
  assert.deepEqual(await f.buffer.consume(), [{ timestamp: 15 }]);
  await f.buffer.clear();
  await f.buffer.begin("running", 50);
  await f.buffer.append([{ timestamp: 15 }, { timestamp: 55 }]);
  assert.deepEqual(await f.buffer.read(), [{ timestamp: 55 }]);
});
test("storage errors surface without deleting the buffer, and consumption retries", async () => {
  const f = fixture();
  await f.buffer.begin("running", 0);
  await f.buffer.append([{ timestamp: 1 }]);
  const read = f.storage.getItem;
  f.storage.getItem = async () => {
    throw Error("disk");
  };
  await assert.rejects(f.buffer.consume(), /disk/);
  f.storage.getItem = read;
  assert.deepEqual(await f.buffer.consume(() => false), []);
  assert.deepEqual(await f.buffer.consume(), [{ timestamp: 1 }]);
});
test("finish after pause cannot extend the closed recording window", async () => {
  const f = fixture();
  await f.buffer.begin("running", 0);
  await f.buffer.seal(100);
  await f.buffer.seal(200);
  await f.buffer.append([{ timestamp: 90 }, { timestamp: 150 }]);
  assert.deepEqual(await f.buffer.read(), [{ timestamp: 90 }]);
});
