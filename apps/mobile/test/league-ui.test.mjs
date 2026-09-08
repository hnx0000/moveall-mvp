import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const league = readFileSync(new URL("../app/(tabs)/knowledge.tsx", import.meta.url), "utf8");
const regional = readFileSync(new URL("../app/league-region.tsx", import.meta.url), "utf8");
const municipalPaths = readFileSync(
  new URL("../src/assets/korea-municipal-paths.ts", import.meta.url),
  "utf8",
);

test("league home is one continuous live rank flow with seven modes", () => {
  assert.match(league, /MY RANK/);
  assert.match(league, /지역 개인 랭킹/);
  assert.match(league, /전체 보기/);
  for (const label of ["전체", "러닝", "등산", "근력", "사이클", "다이빙", "수영"])
    assert.match(league, new RegExp(label));
  assert.match(league, /api\.league/);
  assert.match(league, /3_000/);
  assert.doesNotMatch(league, /내 기록으로 도전|타이틀 직접 입력|로컬 매치 이름 후보/);
});

test("regional league uses the integrated ranking map and existing server snapshot", () => {
  assert.match(league, /router\.push\("\/league-region"\)/);
  assert.match(regional, /<GroovRankingMap/);
  assert.match(regional, /league: snapshot/);
  assert.match(regional, /onRegionSelect/);
  assert.doesNotMatch(regional, /<Svg|PanResponder|rankerNames/);
  assert.equal((municipalPaths.match(/"code":/g) ?? []).length, 250);
});

test("regional dashboard includes heat, participation, score, ranker and rivals", () => {
  for (const label of [
    "과열",
    "지역 인원",
    "리그 참여",
    "참여율",
    "지역 점수",
    "THIS REGION RANKER",
    "점수 차가 가까운 지역",
    "지역 내 순위",
  ])
    assert.match(regional, new RegExp(label));
  assert.match(regional, /router\.back\(\)/);
});

test("mobile league typography keeps long ranks and scores constrained", () => {
  assert.match(league, /adjustsFontSizeToFit/);
  assert.match(league, /rankNumber: \{[^}]*width: 38/);
  assert.match(regional, /minimumFontScale=\{0\.65\}/);
  assert.match(regional, /rankNumber: \{[^}]*width: 38/);
});

test("regional selection retains real points and actual member rankings", () => {
  assert.match(regional, /municipalityStanding/);
  assert.match(regional, /area.standing/);
  assert.match(regional, /selectMyRegion/);
  assert.match(regional, /setMapFocus/);
});
