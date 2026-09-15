import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync, existsSync } from "node:fs";
import { medalDefinitions as defs, medalGrades } from "../src/rewards/medal-design-catalog.ts";
const root = new URL("../", import.meta.url);
test("106 unique designs: 36 activity, 36 specialty, 34 special", () => {
  assert.equal(defs.length, 106);
  assert.equal(new Set(defs.map((d) => d.id)).size, 106);
  for (const [kind, n] of [
    ["activity", 36],
    ["specialty", 36],
    ["special", 34],
  ])
    assert.equal(defs.filter((d) => d.category === kind).length, n);
  for (const [sport, n] of [
    ["strength", 15],
    ["running", 19],
    ["hiking", 16],
    ["swimming", 19],
    ["diving", 19],
    ["cycling", 18],
  ])
    assert.equal(defs.filter((d) => d.sport === sport).length, n);
});
test("twelve core series each use the six approved grades and correct targets", () => {
  const core = defs.filter((d) => d.category !== "special");
  const ids = new Set(core.map((d) => d.seriesId));
  assert.equal(ids.size, 12);
  for (const id of ids) {
    const series = core.filter((d) => d.seriesId === id);
    assert.equal(series.length, 6);
    assert.deepEqual(
      series.map((d) => d.grade),
      [...medalGrades],
    );
    assert.deepEqual(
      series.map((d) => d.stage),
      [1, 2, 3, 4, 5, 6],
    );
  }
  for (const sport of new Set(core.map((d) => d.sport)))
    assert.deepEqual(
      core.filter((d) => d.sport === sport && d.category === "activity").map((d) => d.target),
      [1, 5, 10, 30, 50, 100],
    );
  assert.deepEqual(
    core.filter((d) => d.seriesId === "strength_routine_weeks").map((d) => d.target),
    [1, 2, 4, 8, 12, 24],
  );
  assert.deepEqual(
    core.filter((d) => d.seriesId === "swimming_total_km").map((d) => d.target),
    [1, 5, 10, 25, 50, 100],
  );
});
test("all artwork paths resolve and special medals have no ordinary grade", () => {
  for (const d of defs) {
    assert.ok(d.title && d.description && d.requiredData.length && d.target > 0 && d.unit);
    if (d.category === "special") {
      assert.equal(d.grade, null);
      assert.equal(d.stage, null);
    }
    assert.ok(existsSync(new URL(d.assetPath, root)), d.assetPath);
    assert.equal(d.assetPath, `assets/images/medal-sculpted/${d.id}.png`);
  }
});
test("single-session distances are not cumulative; official races never infer distance completion", () => {
  assert.equal(defs.find((d) => d.id === "running_single_km_10").aggregation, "singleMeters");
  assert.equal(defs.find((d) => d.id === "running_total_km_10").aggregation, "totalMeters");
  for (const id of ["running_official_half", "running_official_marathon"])
    assert.equal(defs.find((d) => d.id === id).verification, "pending-data");
  assert.equal(defs.filter((d) => d.optional === "scuba").length, 4);
  assert.ok(
    defs
      .filter((d) => d.optional === "scuba")
      .every((d) => d.requiredData.some((s) => s.includes("고유 ID"))),
  );
});
test("archive-only implementation does not replace the MY award renderer or API", () => {
  const profile = readFileSync(new URL("app/(tabs)/profile.tsx", root), "utf8");
  const api = readFileSync(new URL("../api/src/medals.ts", root), "utf8");
  assert.ok(!profile.includes("medal-design"));
  assert.ok(!api.includes("medal-design"));
  const gallery = readFileSync(new URL("src/rewards/medal-sculpted-gallery.tsx", root), "utf8");
  assert.ok(!gallery.includes("api."));
  assert.ok(!gallery.includes("useAuth"));
  assert.ok(gallery.includes("NOT AWARDED"));
  const archive = readFileSync(new URL("app/reward-collection.tsx", root), "utf8");
  assert.ok(archive.includes("<MedalDesignGallery />"));
  assert.ok(!archive.includes("<RunningMedalGallery />"));
});
