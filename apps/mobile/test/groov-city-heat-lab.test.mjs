import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { koreaMunicipalities } from "../src/assets/korea-municipal-paths.ts";
import {
  HEAT_COUNTRY_VIEW,
  assertHeatGeometry,
  createDistrictFronts,
  createProvinceFronts,
  formatHeat,
  panHeatView,
  provinceView,
  zoomHeatView,
} from "../src/components/groov-city-heat-engine.ts";

const webScreen = readFileSync(new URL("../src/components/groov-city-heat-lab.web.tsx", import.meta.url), "utf8");

test("new CITY HEAT engine uses the complete real administrative geometry", () => {
  const audit = assertHeatGeometry(koreaMunicipalities);
  assert.equal(audit.valid, true);
  assert.equal(audit.seoulCount, 25);
  assert.ok(audit.count > 200);
});

test("province and district rankings are deterministic and unique", () => {
  const provinces = createProvinceFronts(koreaMunicipalities);
  assert.equal(provinces.length, 17);
  assert.equal(new Set(provinces.map((item) => item.rank)).size, 17);
  const seoul = createDistrictFronts(koreaMunicipalities.filter((area) => area.province === "서울"));
  assert.equal(seoul.length, 25);
  assert.equal(new Set(seoul.map((item) => item.rank)).size, 25);
  assert.equal([...seoul].sort((a, b) => a.rank - b.rank)[0]?.landmark, "spire");
});

test("view transforms remain finite and constrained", () => {
  const seoulAreas = koreaMunicipalities.filter((area) => area.province === "서울");
  const focused = provinceView(seoulAreas);
  const zoomed = zoomHeatView(focused, 0.5);
  const panned = panHeatView(zoomed, 1000, -1000, 360, 640);
  for (const value of Object.values(panned)) assert.equal(Number.isFinite(value), true);
  assert.ok(panned.width < HEAT_COUNTRY_VIEW.width);
  assert.equal(formatHeat(123456), "123,456");
  assert.equal(formatHeat(Number.NaN), "0");
});

test("web lab separates drag, pinch, click and double-click interactions", () => {
  assert.match(webScreen, /onPointerDown/);
  assert.match(webScreen, /setPointerCapture/);
  assert.match(webScreen, /pointerDistance/);
  assert.match(webScreen, /suppressClickUntil/);
  assert.match(webScreen, /onDoubleClick/);
  assert.match(webScreen, /onWheel/);
  assert.match(webScreen, /touch-action:none/);
});

test("web lab includes landmarks, ranking, mission, reward, and score feedback", () => {
  assert.match(webScreen, /BattleLandmark/);
  assert.match(webScreen, /LIVE MISSION/);
  assert.match(webScreen, /NEXT REWARD/);
  assert.match(webScreen, /ranking-sheet/);
  assert.match(webScreen, /energy-burst/);
  assert.doesNotMatch(webScreen, /현재 리그에는 적용되지 않습니다/);
});
