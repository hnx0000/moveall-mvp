import test from "node:test";
import assert from "node:assert/strict";
import {
  aggregateProvinces,
  applyLiveTick,
  buildDistrictModel,
  classifyHeat,
  formatPoints,
  rankDistricts,
  totalsFor,
} from "./model.mjs";

const feature = (code, name, center) => ({ properties: { code, name, center, bounds: [[center[0] - .1, center[1] - .1], [center[0] + .1, center[1] + .1]] } });
const sample = buildDistrictModel([
  feature("11040", "성동구", [127.04, 37.56]),
  feature("21140", "수영구", [129.11, 35.16]),
  feature("31023", "성남시분당구", [127.12, 37.38]),
  feature("32010", "춘천시", [127.73, 37.88]),
]);

test("known leaders stay in deterministic top-three order", () => {
  assert.deepEqual(rankDistricts(sample).slice(0, 3).map((item) => item.code), ["11040", "21140", "31023"]);
});

test("province aggregate includes score, participation and bounds", () => {
  const provinces = aggregateProvinces(sample);
  assert.equal(provinces.length, 4);
  assert.ok(provinces.every((province) => province.score > 0 && province.participationRate > 0));
  assert.ok(provinces.every((province) => province.bounds.length === 2));
});

test("live tick changes a bounded subset and preserves identities", () => {
  const updated = applyLiveTick(sample, 3);
  assert.deepEqual(updated.map((item) => item.code), sample.map((item) => item.code));
  assert.ok(updated.some((item, index) => item.score > sample[index].score));
  assert.ok(updated.every((item, index) => item.score >= sample[index].score));
});

test("heat buckets and totals are stable", () => {
  assert.equal(classifyHeat(82), "overheat");
  assert.equal(classifyHeat(62), "battle");
  assert.equal(classifyHeat(61), "stable");
  assert.ok(totalsFor(sample).score > 0);
  assert.equal(formatPoints(997400), "997,400");
  assert.equal(formatPoints(997400, true), "997.4K");
});
