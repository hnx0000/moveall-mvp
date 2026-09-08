import test from "node:test";
import assert from "node:assert/strict";
import { resolveAppMode, sessionStorageKey } from "../src/config/app-mode.ts";
import { requestJson } from "../src/api/transport.ts";
import { createUserListStore } from "../src/storage/user-list-store.ts";
import { createPollingLoop } from "../src/api/polling-loop.ts";
test("missing mode fails closed to live and sessions are mode/server isolated", () => {
  assert.equal(resolveAppMode(undefined), "live");
  assert.equal(resolveAppMode("demo"), "demo");
  assert.throws(() => resolveAppMode("false"));
  assert.notEqual(
    sessionStorageKey("live", "https://api.a"),
    sessionStorageKey("demo", "https://api.a"),
  );
  assert.notEqual(
    sessionStorageKey("live", "https://api.a"),
    sessionStorageKey("live", "https://api.b"),
  );
});
test("transport validates envelopes and preserves HTTP/application failures", async () => {
  const response =
    (body, status = 200) =>
    async () =>
      new Response(body, { status });
  assert.equal(await requestJson("https://api.test", "/", {}, response('{"ok":true,"data":3}')), 3);
  await assert.rejects(requestJson("", "/"), { code: "API_NOT_CONFIGURED" });
  await assert.rejects(
    requestJson("https://api.test", "/", {}, response("<html>502</html>", 502)),
    { code: "INVALID_RESPONSE", status: 502 },
  );
  await assert.rejects(requestJson("https://api.test", "/", {}, response('{"data":3}')), {
    code: "INVALID_RESPONSE",
  });
  await assert.rejects(
    requestJson(
      "https://api.test",
      "/",
      {},
      response('{"ok":false,"error":{"code":"AUTH_INVALID","message":"auth"}}', 401),
    ),
    { code: "AUTH_INVALID", status: 401 },
  );
});
test("timeout and user cancellation differ; mutations are never blindly retried", async () => {
  let calls = 0;
  const stalled = async (_url, { signal }) => {
    calls++;
    return new Promise((_, reject) => {
      const abort = () => reject(Error("aborted"));
      if (signal.aborted) abort();
      else signal.addEventListener("abort", abort, { once: true });
    });
  };
  await assert.rejects(requestJson("https://api.test", "/", { method: "POST" }, stalled, 5), {
    code: "REQUEST_TIMEOUT",
  });
  assert.equal(calls, 1);
  const control = new AbortController();
  control.abort();
  await assert.rejects(requestJson("https://api.test", "/", { signal: control.signal }, stalled), {
    code: "REQUEST_CANCELLED",
  });
});
test("native-compatible goals persist, isolate owners, and serialize concurrent changes", async () => {
  const data = new Map();
  const storage = {
    getItem: async (k) => data.get(k) ?? null,
    setItem: async (k, v) => {
      data.set(k, v);
    },
  };
  const a = createUserListStore(storage, "goals");
  await Promise.all([
    a.update("A", (xs) => [...xs, 1]),
    a.update("A", (xs) => [...xs, 2]),
    a.update("B", () => [9]),
  ]);
  assert.deepEqual(await createUserListStore(storage, "goals").read("A"), [1, 2]);
  assert.deepEqual(await a.read("B"), [9]);
  const bad = createUserListStore(
    {
      ...storage,
      setItem: async () => {
        throw Error("disk full");
      },
    },
    "bad",
  );
  await assert.rejects(
    bad.update("A", () => [1]),
    /disk full/,
  );
});
test("polling stops and aborts without overlapping the active request", async () => {
  let count = 0,
    aborted = false;
  let resolve;
  const poll = createPollingLoop((signal) => {
    count++;
    return new Promise((r) => {
      resolve = r;
      signal.addEventListener("abort", () => {
        aborted = true;
        r();
      });
    });
  }, 5);
  poll.setActive(true);
  poll.setActive(true);
  assert.equal(count, 1);
  poll.stop();
  resolve();
  await new Promise((r) => setTimeout(r, 15));
  assert.equal(aborted, true);
  assert.equal(count, 1);
});
