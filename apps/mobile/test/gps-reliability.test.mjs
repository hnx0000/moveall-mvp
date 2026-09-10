import test from "node:test";
import assert from "node:assert/strict";
import {
  createResilientWatch,
  subscribeBrowserLocation,
} from "../src/features/location/resilient-watch.ts";
import {
  appendTrackPointResult,
  calculateTrackDistance,
} from "../src/features/location/gps-track.ts";
import { recoverBackgroundWorkout } from "../src/features/location/recover-background-workout.ts";
import { createBackgroundTrackStore } from "../src/features/location/tracking-lifecycle.ts";
import { mountAppTrack } from "../../../prototypes/groov-korea-25d-map/app-track.mjs";
import {
  createLocateAction,
  mountLocateButton,
} from "../../../prototypes/groov-korea-25d-map/map-location.mjs";

const flush = async () => {
  await Promise.resolve();
  await Promise.resolve();
};
const point = (timestamp, latitude = 37.5) => ({
  latitude,
  longitude: 127,
  accuracy: 6,
  altitude: null,
  timestamp,
});
function watchFixture() {
  let now = 0,
    tick,
    visible = true;
  const calls = [],
    positions = [],
    errors = [],
    waiting = [],
    removed = [];
  const watcher = createResilientWatch({
    subscribe: (position, error) => {
      const id = calls.length;
      calls.push({ position, error });
      return { remove: () => removed.push(id) };
    },
    onPosition: (p) => positions.push(p),
    onError: (e) => errors.push(e),
    onWaiting: () => waiting.push(true),
    now: () => now,
    every: (callback) => {
      tick = callback;
      return 1;
    },
    cancel: () => {
      tick = () => {};
    },
    isVisible: () => visible,
  });
  return {
    watcher,
    calls,
    positions,
    errors,
    waiting,
    removed,
    advance(ms) {
      now += ms;
      tick();
    },
    hide() {
      visible = false;
    },
    show() {
      visible = true;
      watcher.resume();
    },
  };
}
test("web uses real browser watch id, high accuracy, bounded fresh fixes and error callback", () => {
  let success, failure, options, cleared;
  const received = [],
    errors = [];
  const subscription = subscribeBrowserLocation(
    {
      watchPosition: (s, e, o) => {
        success = s;
        failure = e;
        options = o;
        return 77;
      },
      clearWatch: (id) => {
        cleared = id;
      },
    },
    (p) => received.push(p),
    (e) => errors.push(e),
  );
  assert.deepEqual(options, { enableHighAccuracy: true, maximumAge: 0, timeout: 15000 });
  success(point(1000));
  failure({ code: 3 });
  subscription.remove();
  assert.equal(received.length, 1);
  assert.equal(errors[0].code, 3);
  assert.equal(cleared, 77);
});
test("no first fix does not block subscription; watchdog reconnects without losing ownership", async () => {
  const f = watchFixture();
  await flush();
  assert.equal(f.calls.length, 1);
  f.advance(30000);
  await flush();
  assert.equal(f.calls.length, 2);
  assert.deepEqual(f.removed, [0]);
  f.calls[0].position("old");
  f.calls[1].position("new");
  assert.deepEqual(f.positions, ["new"]);
  f.watcher.remove();
  f.advance(60000);
  f.calls[1].position("closed");
  assert.deepEqual(f.positions, ["new"]);
});
test("denied permissions do not loop prompts; returning to app retries; hidden state does not spin", async () => {
  const f = watchFixture();
  await flush();
  f.calls[0].error({ code: 1 });
  f.advance(120000);
  assert.equal(f.calls.length, 1);
  f.show();
  await flush();
  assert.equal(f.calls.length, 2);
  f.hide();
  f.advance(120000);
  assert.equal(f.calls.length, 2);
  f.show();
  await flush();
  assert.equal(f.calls.length, 3);
  f.watcher.remove();
});
test("async native subscription resolved after disposal is immediately removed", async () => {
  let finish,
    removed = 0;
  const watcher = createResilientWatch({
    subscribe: () =>
      new Promise((r) => {
        finish = r;
      }),
    onPosition: () => assert.fail(),
    onError: () => assert.fail(),
    onWaiting: () => {},
    every: () => 1,
    cancel: () => {},
  });
  watcher.remove();
  finish({ remove: () => removed++ });
  await flush();
  assert.equal(removed, 1);
});
test("old cached first fix is rejected live but remains valid for historical replay", () => {
  assert.equal(
    appendTrackPointResult([], point(1000), "running", { receivedAt: 60000 }).reason,
    "stale",
  );
  assert.equal(appendTrackPointResult([], point(1000), "running").accepted, true);
});
const checkpoint = {
  version: 1,
  id: "run",
  owner: "person",
  sport: "running",
  startedAt: 1000,
  savedAt: 6000,
  elapsedMs: 5000,
  recordingSince: 1000,
  points: [point(6000)],
  pauseBoundaries: [],
  fields: {},
};
test("suspended UI recovery retains confirmed native route and time, not hours until reopening", () => {
  const recovered = recoverBackgroundWorkout(
    checkpoint,
    [point(60000, 37.501), point(61000, 37.50104)],
    3600000,
  );
  assert.equal(recovered.savedAt, 61000);
  assert.equal(recovered.elapsedMs, 60000);
  assert.equal(recovered.recordingSince, null);
  assert.equal(recovered.points.length, 3);
  assert.equal(recovered.points[1].breakBefore, true);
  assert.ok(calculateTrackDistance(recovered.points) < 0.01);
});
test("paused/legacy recovery never extends time; future batches and bad fixes cannot extend it", () => {
  for (const recordingSince of [null, undefined]) {
    const recovered = recoverBackgroundWorkout(
      { ...checkpoint, recordingSince },
      [point(60000, 37.501)],
      90000,
    );
    assert.equal(recovered.elapsedMs, 5000);
    assert.equal(recovered.points.length, 1);
  }
  const recovered = recoverBackgroundWorkout(
    checkpoint,
    [point(100000, 37.6), { ...point(60000, 37.6), accuracy: 8000 }],
    90000,
  );
  assert.equal(recovered.elapsedMs, 5000);
});
test("canceled or other-workout clear cannot erase the active native buffer", async () => {
  const data = new Map(),
    storage = {
      getItem: async (k) => data.get(k) ?? null,
      setItem: async (k, v) => {
        data.set(k, v);
      },
      removeItem: async (k) => {
        data.delete(k);
      },
      multiRemove: async (keys) => {
        keys.forEach((k) => data.delete(k));
      },
    };
  const store = createBackgroundTrackStore(storage, (a, b) => [...a, ...b]);
  await store.begin("running", 0, "B");
  await store.append([point(1000)]);
  await store.clear("A");
  assert.equal((await store.readFor("B")).length, 1);
  await store.clear("B", () => false);
  assert.equal((await store.readFor("B")).length, 1);
  await store.begin("running", 2000, "C");
  assert.equal((await store.readFor("C")).length, 0);
});
test("recovery cannot extend duration from a stored future-skewed fix", () => {
  const recovered = recoverBackgroundWorkout(
    { ...checkpoint, points: [point(6000), point(35000, 37.501)] },
    [],
    10000,
  );
  assert.equal(recovered.savedAt, 6000);
  assert.equal(recovered.elapsedMs, 5000);
});
test("recording transition cancels pending standalone locate and removes the old marker", (t) => {
  const previousNavigator = Object.getOwnPropertyDescriptor(globalThis, "navigator"),
    oldDocument = globalThis.document,
    oldMaplibre = globalThis.maplibregl;
  t.after(() => {
    if (previousNavigator) Object.defineProperty(globalThis, "navigator", previousNavigator);
    else delete globalThis.navigator;
    globalThis.document = oldDocument;
    globalThis.maplibregl = oldMaplibre;
  });
  let success,
    click,
    recording = false,
    created = 0,
    removed = 0;
  Object.defineProperty(globalThis, "navigator", {
    configurable: true,
    value: {
      geolocation: {
        getCurrentPosition: (s) => {
          success = s;
        },
      },
    },
  });
  globalThis.document = { createElement: () => ({ setAttribute() {} }) };
  globalThis.maplibregl = {
    Marker: class {
      constructor() {
        created++;
      }
      setLngLat() {
        return this;
      }
      addTo() {
        return this;
      }
      remove() {
        removed++;
      }
    },
  };
  const events = new Map(),
    map = { on: (e, h) => events.set(e, h), off() {}, easeTo() {} };
  mountLocateButton(
    map,
    {
      setAttribute() {},
      addEventListener: (e, h) => {
        click = h;
      },
      removeEventListener() {},
    },
    { locateRecorded: () => recording },
  );
  const fix = () => ({
    timestamp: Date.now(),
    coords: { latitude: 37.5, longitude: 127, accuracy: 6 },
  });
  click();
  recording = true;
  events.get("groov-recording-change")({ recording: true });
  success(fix());
  assert.equal(created, 0);
  recording = false;
  click();
  success(fix());
  assert.equal(created, 1);
  recording = true;
  events.get("groov-recording-change")({ recording: true });
  assert.equal(removed, 1);
  events.get("remove")();
});
test("fullscreen recording follows accepted fixes without resetting tilt/zoom; drag suspends and locate resumes", () => {
  const sources = new Map(),
    moves = [],
    events = new Map();
  const map = {
    addSource: (id, data) =>
      sources.set(id, {
        ...data,
        setData(v) {
          this.data = v;
        },
      }),
    addLayer() {},
    getSource: (id) => sources.get(id),
    jumpTo: (p) => moves.push(p),
    on: (e, h) => events.set(e, h),
    off() {},
  };
  const update = mountAppTrack(map);
  update({ recording: true, points: [], currentPoint: point(1000) });
  update({ recording: true, points: [], currentPoint: point(2000, 37.5001) });
  assert.equal(moves.length, 2);
  assert.deepEqual(moves[1], { center: [127, 37.5001] });
  events.get("dragstart")({ originalEvent: {} });
  update({ recording: true, points: [], currentPoint: point(3000, 37.5002) });
  assert.equal(moves.length, 2);
  assert.equal(update.locate(), true);
  assert.deepEqual(moves.at(-1), { center: [127, 37.5002] });
  update({ recording: false, points: [], currentPoint: point(4000, 37.5003) });
  assert.equal(update.locate(), false);
});
test("map locate rejects stale and imprecise fixes instead of teleporting camera", () => {
  let success;
  const moved = [],
    messages = [];
  const action = createLocateAction({
    geolocation: {
      getCurrentPosition: (s) => {
        success = s;
      },
    },
    onPosition: (p) => moved.push(p),
    notify: (m) => messages.push(m),
  });
  action.locate();
  success({ timestamp: 1, coords: { latitude: 37.5, longitude: 127, accuracy: 5 } });
  action.locate();
  success({ timestamp: Date.now(), coords: { latitude: 37.5, longitude: 127, accuracy: 8000 } });
  assert.equal(moved.length, 0);
  assert.equal(messages.length, 4);
  action.destroy();
});
