import test from "node:test";
import assert from "node:assert/strict";
import {
  createPushRegistrationCoordinator,
  setNotificationIdentity,
  isNotificationIdentity,
} from "../src/features/notifications/push-lifecycle.ts";
const deferred = () => {
  let resolve;
  const promise = new Promise((r) => {
    resolve = r;
  });
  return { promise, resolve };
};
const input = { token: "device", platform: "ios" };
test("logout while the permission prompt is open cannot register afterward", async () => {
  const permission = deferred(),
    calls = [];
  const coordinator = createPushRegistrationCoordinator({
    registerPushDevice: async () => calls.push("register"),
    unregisterPushDevice: async () => calls.push("delete"),
  });
  let active = true;
  const job = coordinator.begin({
    prepare: () => permission.promise,
    isCurrent: () => active,
    accessToken: () => "A",
  });
  active = false;
  await job.stop();
  permission.resolve(input);
  await job.done;
  assert.deepEqual(calls, []);
});
test("a delayed A registration and cleanup cannot overtake B ownership", async () => {
  const registration = deferred(),
    entered = deferred(),
    calls = [];
  const coordinator = createPushRegistrationCoordinator({
    registerPushDevice: async (token) => {
      calls.push("register:" + token);
      if (token === "A") {
        entered.resolve();
        await registration.promise;
      }
    },
    unregisterPushDevice: async (token) => {
      calls.push("delete:" + token);
    },
  });
  const a = coordinator.begin({
    prepare: async () => input,
    isCurrent: () => true,
    accessToken: () => "A",
  });
  await entered.promise;
  const stopping = a.stop();
  const b = coordinator.begin({
    prepare: async () => input,
    isCurrent: () => true,
    accessToken: () => "B",
  });
  registration.resolve();
  await Promise.all([a.done, stopping, b.done]);
  assert.deepEqual(calls, ["register:A", "delete:A", "register:B"]);
});
test("refresh/profile updates retain a login lifetime; replacing or ending a login invalidates it", () => {
  const first = setNotificationIdentity("A", true);
  assert.equal(setNotificationIdentity("A"), first);
  assert.equal(isNotificationIdentity("A", first), true);
  setNotificationIdentity("B", true);
  assert.equal(isNotificationIdentity("A", first), false);
  setNotificationIdentity(null);
  assert.equal(isNotificationIdentity("B"), false);
});
