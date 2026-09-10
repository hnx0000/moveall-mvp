import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import vm from "node:vm";
import ts from "typescript";
import * as lifecycle from "../src/features/location/tracking-lifecycle.ts";
import * as gps from "../src/features/location/gps-track.ts";

test("pause during native startup seals the window; late startup and later fixes cannot restart recording", async () => {
  const values = new Map();
  const storage = {
    getItem: async (k) => values.get(k) ?? null,
    setItem: async (k, v) => {
      values.set(k, v);
    },
    removeItem: async (k) => {
      values.delete(k);
    },
    multiRemove: async (keys) => {
      keys.forEach((k) => values.delete(k));
    },
  };
  let task,
    resolveStart,
    enteredStart,
    current = true,
    running = false;
  const nativeEntered = new Promise((r) => {
    enteredStart = r;
  });
  const nativeStart = new Promise((r) => {
    resolveStart = r;
  });
  const location = {
    Accuracy: { BestForNavigation: 6 },
    ActivityType: { Fitness: 3 },
    hasServicesEnabledAsync: async () => true,
    getForegroundPermissionsAsync: async () => ({ granted: true }),
    requestBackgroundPermissionsAsync: async () => ({ granted: true }),
    getBackgroundPermissionsAsync: async () => ({ granted: true }),
    hasStartedLocationUpdatesAsync: async () => running,
    startLocationUpdatesAsync: async () => {
      enteredStart();
      await nativeStart;
      running = true;
    },
    stopLocationUpdatesAsync: async () => {
      running = false;
    },
  };
  const mocks = {
    "@react-native-async-storage/async-storage": storage,
    "expo-location": location,
    "expo-task-manager": {
      isTaskDefined: () => false,
      isAvailableAsync: async () => true,
      defineTask: (name, callback) => {
        task = callback;
      },
    },
    "react-native": { Platform: { OS: "android" } },
    "./gps-track": gps,
    "./tracking-lifecycle": lifecycle,
  };
  const source = readFileSync(
    new URL("../src/features/location/background-location.ts", import.meta.url),
    "utf8",
  );
  const code = ts.transpileModule(source, {
    compilerOptions: {
      module: ts.ModuleKind.CommonJS,
      target: ts.ScriptTarget.ES2022,
      esModuleInterop: true,
    },
  }).outputText;
  const exports = {};
  vm.runInNewContext(code, { exports, require: (name) => mocks[name], Date, Promise });
  const started = exports.startBackgroundTrack("running", () => current, 1000, "run");
  await nativeEntered;
  current = false;
  const stopped = exports.stopBackgroundTrack(2000);
  resolveStart();
  assert.equal(await started, false);
  await stopped;
  assert.equal(running, false);
  await task({
    data: {
      locations: [
        {
          timestamp: 1500,
          coords: { latitude: 37.5, longitude: 127, altitude: null, accuracy: 6 },
        },
        {
          timestamp: 3000,
          coords: { latitude: 37.5001, longitude: 127, altitude: null, accuracy: 6 },
        },
      ],
    },
  });
  const buffer = await exports.readBackgroundTrack("run");
  assert.equal(buffer.length, 1);
  assert.equal(buffer[0].timestamp, 1500);
  assert.equal(JSON.parse(values.get("groov-background-workout-window-v2")).until, 2000);
});
