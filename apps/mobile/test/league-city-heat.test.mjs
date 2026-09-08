import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { koreaMunicipalities } from "../src/assets/korea-municipal-paths.ts";
import {
  assertCityHeatMapData,
  createCityHeatStandings,
  findNearestRivals,
  formatCityHeatRank,
  formatCityHeatScore,
  heatBand,
  landmarkForRank,
  scoreAfterContribution,
} from "../src/components/league-city-heat-model.ts";

const screen = readFileSync(new URL("../app/league-city-heat.tsx", import.meta.url), "utf8");

test("city heat validates the real municipality source and all 25 Seoul districts", () => {
  const audit = assertCityHeatMapData(koreaMunicipalities);
  assert.equal(audit.valid, true);
  assert.equal(audit.seoulCount, 25);
  assert.equal(audit.duplicateCodeCount, 0);
  assert.equal(audit.validGeometry, true);
});

test("score and rank formatting safely handle invalid and large values", () => {
  assert.equal(formatCityHeatScore(123456), "123,456");
  assert.equal(formatCityHeatScore(123456, true), "123.5K");
  assert.equal(formatCityHeatScore(Number.NaN), "0");
  assert.equal(formatCityHeatRank(323), "#323");
  assert.equal(formatCityHeatRank(null), "#1");
  assert.equal(scoreAfterContribution(7_839, 128), 7_967);
  assert.equal(scoreAfterContribution(7_839, -100), 7_839);
});

test("rankings are deterministic, unique and award the top three landmarks", () => {
  const seoul = koreaMunicipalities.filter((area) => area.province === "서울");
  const standings = createCityHeatStandings(seoul);
  const ranked = [...standings].sort((a, b) => a.rank - b.rank);
  assert.equal(standings.length, 25);
  assert.deepEqual(new Set(standings.map((area) => area.rank)).size, 25);
  assert.equal(ranked[0]?.landmark, "tower");
  assert.equal(ranked[1]?.landmark, "arena");
  assert.equal(ranked[2]?.landmark, "beacon");
  assert.equal(landmarkForRank(9), "base");
  assert.equal(heatBand(1000), "critical");
  assert.equal(heatBand(-1), "quiet");
});

test("nearest rivals never include the selected region and missing selections fail safely", () => {
  const standings = createCityHeatStandings(
    koreaMunicipalities.filter((area) => area.province === "서울"),
  );
  const selected = standings[0];
  assert.ok(selected);
  const rivals = findNearestRivals(standings, selected.code, 2);
  assert.equal(rivals.length, 2);
  assert.ok(rivals.every((area) => area.code !== selected.code));
  assert.deepEqual(findNearestRivals(standings, "missing"), []);
});

test("isolated prototype contains guarded gestures, drilldown and game loop", () => {
  assert.match(screen, /level === "country"/);
  assert.match(screen, /enterSeoul/);
  assert.match(screen, /focusDistrict/);
  assert.match(screen, /distanceBetweenTouches/);
  assert.match(screen, /isDoubleTap/);
  assert.match(screen, /simulateContribution/);
  assert.match(screen, /GROOV CITY HEAT/);
  assert.match(screen, /현재 리그에는 적용되지 않습니다/);
});
