import assert from "node:assert/strict";
import test from "node:test";
import { readFile } from "node:fs/promises";
import { sportValues, RoutineCreateInputSchema } from "@moveall/contracts";
import {
  availableRecordMetrics,
  defaultRecordMetrics,
  normalizeRecordMetrics,
  moveRecordMetric,
  recordMetricStorageKey,
  summarizeRecords,
} from "../src/profile/record-summary.ts";

const workout = (sport, metrics) => ({
  sport,
  metrics,
  startedAt: "2026-09-01T00:00:00Z",
  endedAt: "2026-09-01T00:10:00Z",
});

test("records owns a non-shrinking sport selector above totals and opens from the top", async () => {
  const source = await readFile(
    new URL("../src/profile/records-screen.tsx", import.meta.url),
    "utf8",
  );
  const profile = await readFile(new URL("../app/(tabs)/profile.tsx", import.meta.url), "utf8");
  const section = source.indexOf("<View style={styles.sportRecordsSection}>");
  const totals = source.indexOf("<RecordTotals");
  assert.ok(section > 0 && section < totals);
  const selector = source.slice(section, totals);
  assert.match(selector, /운동별 기록/);
  assert.match(selector, /\["all", \.\.\.sportValues\]/);
  assert.match(selector, /onPress=\{\(\) => setFilter\(itemSport\)\}/);
  assert.doesNotMatch(selector, /router\.(push|replace)/);
  assert.match(source, /sportRecordsStrip:\s*\{\s*flexGrow: 0,\s*flexShrink: 0,\s*minHeight: 90/);
  assert.match(source, /pageScroll\.current\?\.scrollTo\(\{ y: 0, animated: false \}\)/);
  assert.match(source, /sportScroll\.current\?\.scrollTo\(\{ x: 0, animated: false \}\)/);
  assert.match(profile, /router\.push\("\/profile\/records"\)/);
  assert.doesNotMatch(profile, /title="운동별 기록"|\["records", "기록"\]/);
});

test("record totals aggregate active milliseconds before rounding", () => {
  const items = [
    workout("running", { durationMilliseconds: 24_000 }),
    workout("running", { durationMilliseconds: 24_000 }),
  ];
  assert.equal(summarizeRecords(items, "all").minutes.value, 0.8);
  assert.equal(
    summarizeRecords([workout("strength", { durationMinutes: 2.5 })], "all").minutes.value,
    2.5,
  );
  assert.equal(summarizeRecords([workout("hiking", {})], "all").minutes.value, 10);
});

test("record distances normalize each workout without counting km and m twice", () => {
  const items = [
    workout("running", { distanceKm: 5, distanceM: 5000 }),
    workout("swimming", { distanceM: 250 }),
    workout("swimming", { distanceKm: 0.5 }),
    workout("cycling", { distanceKm: 10 }),
    workout("strength", { distanceKm: 999 }),
  ];
  assert.equal(summarizeRecords(items, "all").distance.value, 15.75);
  assert.equal(summarizeRecords(items, "swimming").distance.value, 0.75);
  assert.equal(summarizeRecords(items, "running").count.value, 1);
});

test("each sport exposes and accumulates its supported totals only", () => {
  const items = [
    workout("strength", { volumeKg: 1200, sets: 8, calories: 300 }),
    workout("hiking", { elevationGainM: 250, steps: 5000, calories: 200 }),
    workout("swimming", { laps: 10, totalStrokes: 150 }),
    workout("diving", { maxDepthM: 12, dynamicDistanceM: 30 }),
    workout("diving", { maxDepthM: 8, dynamicDistanceM: 20 }),
  ];
  const all = summarizeRecords(items, "all");
  assert.equal(all.volume.value, 1200);
  assert.equal(all.sets.value, 8);
  assert.equal(all.steps.value, 5000);
  assert.equal(all.elevation.value, 250);
  assert.equal(all.laps.value, 10);
  assert.equal(all.strokes.value, 150);
  assert.equal(all.dynamic.value, 50);
  assert.equal(all.depth.value, 20);
  assert.match(all.depth.note, /최대 수심/);
  assert.match(all.depth.note, /실제 수직 이동 거리는 아니/);
  assert.equal(summarizeRecords(items, "strength").calories.value, 300);
  assert.equal(summarizeRecords(items, "diving").volume.value, 0);
  assert.ok(!availableRecordMetrics("diving").includes("volume"));
  assert.ok(!availableRecordMetrics("strength").includes("distance"));
});

test("missing and invalid cumulative metrics do not create invented values", () => {
  const empty = summarizeRecords([], "all");
  assert.ok(Object.values(empty).every((item) => item.value === 0));
  const all = summarizeRecords(
    [
      workout("running", { distanceKm: NaN, distanceM: 1000, steps: -100, calories: Infinity }),
      workout("strength", { volumeKg: -12, sets: NaN }),
    ],
    "all",
  );
  assert.equal(all.distance.value, 1);
  assert.equal(all.steps.value, 0);
  assert.equal(all.calories.value, 0);
  assert.equal(all.volume.value, 0);
});

test("layout settings preserve order, reject unknown/duplicate metrics, and keep a nonempty default", () => {
  assert.deepEqual(
    normalizeRecordMetrics(["sets", "volume", "sets", "invalid", "distance"], "strength"),
    ["sets", "volume"],
  );
  assert.deepEqual(normalizeRecordMetrics([], "cycling"), defaultRecordMetrics("cycling"));
  assert.deepEqual(normalizeRecordMetrics({ broken: true }, "all"), defaultRecordMetrics("all"));
  const original = ["minutes", "volume", "sets"];
  assert.deepEqual(moveRecordMetric(original, "sets", -1), ["minutes", "sets", "volume"]);
  assert.deepEqual(moveRecordMetric(original, "minutes", 1), ["volume", "minutes", "sets"]);
  assert.deepEqual(moveRecordMetric(original, "minutes", -1), original);
  assert.deepEqual(moveRecordMetric(original, "sets", 1), original);
  assert.deepEqual(original, ["minutes", "volume", "sets"]);
  assert.notEqual(recordMetricStorageKey("user-a"), recordMetricStorageKey("user-b"));
});

test("all six routine sports validate, save, edit, and survive preview reload", async () => {
  const storage = new Map();
  const previous = globalThis.localStorage;
  globalThis.localStorage = {
    getItem: (key) => storage.get(key) ?? null,
    setItem: (key, value) => storage.set(key, value),
    removeItem: (key) => storage.delete(key),
  };
  try {
    const { demoApi: api } = await import("../src/api/demo-client.ts?routine-six-sports");
    const created = [];
    assert.equal(sportValues.length, 6);
    for (const sport of sportValues) {
      const input = RoutineCreateInputSchema.parse({
        title: `${sport} 테스트 루틴`,
        sport,
        daysOfWeek: [1, 3, 5],
        items: [{ name: "워밍업", target: "10분", order: 0 }],
      });
      const routine = await api.createRoutine("demo", input);
      assert.equal(routine.sport, sport);
      const edited = await api.updateRoutine("demo", routine.id, {
        ...input,
        title: `${sport} 수정 루틴`,
      });
      assert.equal(edited.sport, sport);
      created.push(edited);
    }
    const { demoApi: restored } =
      await import("../src/api/demo-client.ts?routine-six-sports-reload");
    const routines = await restored.routines("demo");
    for (const expected of created) {
      const actual = routines.find((item) => item.id === expected.id);
      assert.equal(actual.sport, expected.sport);
      assert.equal(actual.title, expected.title);
    }
  } finally {
    if (previous === undefined) delete globalThis.localStorage;
    else globalThis.localStorage = previous;
  }
});
