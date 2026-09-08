import test from "node:test";
import assert from "node:assert/strict";
import { indoorSwimMetrics, requiresOutdoorGps } from "../src/features/location/swim-metrics.ts";
test("indoor swimming never selects GPS while outdoor swimming does", () => {
  assert.equal(requiresOutdoorGps("swimming", "indoor"), false);
  assert.equal(requiresOutdoorGps("swimming", "outdoor"), true);
  for (const sport of ["running", "hiking", "cycling"])
    assert.equal(requiresOutdoorGps(sport, "indoor"), true);
  for (const sport of ["strength", "diving"])
    assert.equal(requiresOutdoorGps(sport, "outdoor"), false);
});
test("20 lengths in a 25m pool is 500m in the shared display/save calculation", () => {
  assert.deepEqual(indoorSwimMetrics("25", "20"), { error: null, distanceM: 500, laps: 20 });
  assert.deepEqual(indoorSwimMetrics("50", "10"), { error: null, distanceM: 500, laps: 10 });
});
test("blank is unmeasured, zero is measured, negative/fractional/invalid values are rejected", () => {
  assert.equal(indoorSwimMetrics("25", "").distanceM, undefined);
  assert.equal(indoorSwimMetrics("25", "0").distanceM, 0);
  for (const value of ["-1", "2.5", "NaN", "10001"])
    assert.ok(indoorSwimMetrics("25", value).error);
  for (const value of ["0", "101", "NaN"]) assert.ok(indoorSwimMetrics(value, "20").error);
});
