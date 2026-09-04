import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const league = readFileSync(new URL("../app/(tabs)/knowledge.tsx", import.meta.url), "utf8");
const regional = readFileSync(new URL("../app/league-region.tsx", import.meta.url), "utf8");
const municipalPaths = readFileSync(
  new URL("../src/assets/korea-municipal-paths.ts", import.meta.url),
  "utf8",
);

test("league home is one continuous rank flow with six separate modes", () => {
  assert.match(league, /MY RANK/);
  assert.match(league, /내 주변 개인 랭킹/);
  assert.match(league, /전체 보기/);
  for (const label of ["액티비티", "러닝", "근력", "사이클", "다이빙", "수영"])
    assert.match(league, new RegExp(label));
  assert.doesNotMatch(league, /내 기록으로 도전|타이틀 직접 입력|로컬 매치 이름 후보/);
});

test("regional league is an interactive gapless administrative map", () => {
  assert.match(league, /router\.push\("\/league-region"\)/);
  assert.match(regional, /서울 25개 구와 전국 시군구를 탐색하는 지역 리그 지도/);
  assert.match(regional, /viewBox=/);
  assert.match(regional, /koreaMunicipalities\.map/);
  for (const capability of ["zoomViewport", "panViewport", "focusViewport", "동네 핫스폿"])
    assert.match(regional, new RegExp(capability));
  assert.equal((municipalPaths.match(/"code":/g) ?? []).length, 250);
  for (const region of [
    "서울",
    "부산",
    "대구",
    "인천",
    "광주",
    "대전",
    "울산",
    "세종",
    "경기",
    "강원",
    "충북",
    "충남",
    "전북",
    "전남",
    "경북",
    "경남",
    "제주",
  ])
    assert.match(municipalPaths, new RegExp(`"province":"${region}"`));
});

test("regional dashboard includes heat, participation, score, ranker and rivals", () => {
  for (const label of [
    "과열",
    "지역 인원",
    "리그 참여",
    "참여율",
    "지역 점수",
    "THIS REGION RANKER",
    "인접 경쟁 지역",
    "지역 내 순위",
  ])
    assert.match(regional, new RegExp(label));
  assert.match(regional, /router\.back\(\)/);
});
