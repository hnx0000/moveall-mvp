import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync, existsSync, readdirSync } from "node:fs";
import vm from "node:vm";
import ts from "typescript";
import { readCourse, courseStorageKey, acceptsMapMessage } from "../src/features/maps/map-state.ts";
import { liveDistricts, trackGeoJSON } from "../../../prototypes/groov-korea-25d-map/app-data.mjs";
import {
  rankDistricts,
  aggregateProvinces,
} from "../../../prototypes/groov-korea-25d-map/model.mjs";
import { mountAppTrack } from "../../../prototypes/groov-korea-25d-map/app-track.mjs";

const read = (path) => readFileSync(new URL(path, import.meta.url), "utf8");
const models = [
  {
    code: "11",
    name: "중구",
    province: "서울",
    provinceCode: "11",
    center: [127, 37],
    score: 999,
    heat: 99,
  },
  {
    code: "21",
    name: "중구",
    province: "부산",
    provinceCode: "21",
    center: [129, 35],
    score: 888,
    heat: 88,
  },
];
const course = {
  name: "우이천 왕복",
  sport: "running",
  pins: [
    [127.02, 37.65],
    [127.025, 37.655],
  ],
  coordinates: [
    [127.02, 37.65],
    [127.021, 37.652],
    [127.025, 37.655],
  ],
  distanceMeters: 780,
  turnaroundIndex: 1,
};

test("course save/use/remove survives reload, serializes writes and isolates accounts", async () => {
  const disk = new Map();
  const storage = {getItem:async key=>disk.get(key)??null,setItem:async(key,value)=>{disk.set(key,value);}};
  const source = ts.transpileModule(read("../src/features/maps/course-storage.ts"), {compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText;
  const load = () => {
    const context = {exports:{},require:name=>name.includes("async-storage")?storage:{courseStorageKey,readCourse},Set,Promise,Date,Math,JSON};
    vm.createContext(context);vm.runInContext(source,context);return context.exports;
  };
  const library=load();
  await Promise.all([library.changeCourseLibrary("A","course-save",course),library.changeCourseLibrary("A","course-save",{...course,name:"두 번째"})]);
  const saved=await library.loadCourseLibrary("A");assert.equal(saved.courses.length,2);
  await library.changeCourseLibrary("A","course-use",saved.courses[0]);
  assert.equal((await load().loadCourseLibrary("A")).selected.name,saved.courses[0].name);
  assert.equal((await load().loadCourseLibrary("B")).courses.length,0);
  await library.changeCourseLibrary("A","course-remove",saved.courses[0].id);
  const after=await library.loadCourseLibrary("A");assert.equal(after.courses.length,1);assert.equal(after.selected,null);
});

test("live integration never inherits prototype score, simulated tick or invented rank", () => {
  const empty = liveDistricts(models, null);
  assert.ok(empty.every((m) => m.score === 0 && m.heat === 0 && m.todayDelta === 0));
  assert.ok(rankDistricts(empty).every((m) => m.rank === null));
  const actual = liveDistricts(models, {
    regions: [
      {
        regionKey: "seoul",
        province: "서울특별시",
        regionName: "중구",
        points: 134,
        rank: 323,
        memberCount: 500,
        participantCount: 51,
        participationRate: 10.2,
      },
    ],
  });
  assert.equal(actual[0].score, 134);
  assert.equal(actual[1].score, 0);
  assert.equal(rankDistricts(actual)[0].rank, 323);
  assert.equal(aggregateProvinces(actual)[0].score, 134);
  const source = read("../../../prototypes/groov-korea-25d-map/app.js");
  assert.match(source, /if \(!embedded\) startLiveSimulation/);
  assert.match(source, /liveDistricts\(districtModels, state.league\)/);
});
test("app GPS segments stay separate from the planned course and no fix invents a location", () => {
  const sources = new Map(),
    layers = [],
    moves = [];
  const map = {
    addSource: (id, s) =>
      sources.set(id, {
        data: s.data,
        setData(data) {
          this.data = data;
        },
      }),
    addLayer: (l) => layers.push(l),
    getSource: (id) => sources.get(id),
    jumpTo: (x) => moves.push(x),
  };
  const update = mountAppTrack(map);
  update({ points: [] });
  assert.equal(moves.length, 0);
  const points = [
    { latitude: 37.65, longitude: 127.02 },
    { latitude: 37.66, longitude: 127.03 },
    { latitude: 37.8, longitude: 127.1, breakBefore: true },
    { latitude: 37.81, longitude: 127.11 },
  ];
  update({ points, currentPoint: points[3], course });
  assert.equal(sources.get("app-recorded-track").data.features.length, 2);
  assert.equal(sources.get("app-planned-track").data.geometry.coordinates, course.coordinates);
  assert.deepEqual(moves[0].center, [127.11, 37.81]);
  update({ points, currentPoint: points[2] });
  assert.equal(moves.length, 1, "polling must not repeatedly steal the camera");
  assert.equal(
    trackGeoJSON([points[0], { latitude: NaN, longitude: 127 }, points[1]]).features.length,
    0,
  );
});
test("course validation enforces usable geometry, max 30 pins and per-account storage namespace", () => {
  assert.equal(readCourse(course).name, "우이천 왕복");
  for (const changed of [
    { pins: Array(31).fill(course.pins[0]) },
    {
      coordinates: [
        [0, 0],
        [1, 1],
      ],
    },
    { distanceMeters: NaN },
    { sport: "strength" },
    { turnaroundIndex: 30 },
  ])
    assert.throws(() => readCourse({ ...course, ...changed }));
  assert.notEqual(courseStorageKey("user/a"), courseStorageKey("user/b"));
  assert.equal(
    acceptsMapMessage({ source: "groov-map", channel: "a", type: "ready", payload: {} }, "b"),
    false,
  );
});
test("embedded bridge rejects another window/origin/channel; ready/state and course replies round trip", async () => {
  const events = new Map(),
    sent = [],
    parent = { postMessage: (data, origin) => sent.push({ data, origin }) };
  const window = { parent, addEventListener: (name, fn) => events.set(name, fn) };
  const context = {
    window,
    location: {
      search: "?embedded=1&kind=course&channel=test-channel",
      origin: "http://localhost:8081",
    },
    URLSearchParams,
    Map,
    Promise,
    Error,
    setTimeout,
    clearTimeout,
    crypto: { randomUUID: () => "request-1" },
    document: {
      documentElement: { dataset: {} },
      createElement: () => ({}),
      head: { append() {} },
      addEventListener() {},
    },
  };
  vm.createContext(context);
  vm.runInContext(
    read("../../../prototypes/groov-korea-25d-map/app-host.mjs").replace(/export /g, ""),
    context,
  );
  const states = [];
  context.connectApp((s) => states.push(s));
  assert.equal(sent[0].data.type, "ready");
  assert.equal(sent[0].origin, "http://localhost:8081");
  const message = {
    source: "groov-app",
    channel: "test-channel",
    type: "state",
    payload: { points: [] },
  };
  events.get("message")({ source: {}, origin: "http://localhost:8081", data: message });
  events.get("message")({ source: parent, origin: "https://wrong.test", data: message });
  assert.equal(states.length, 1);
  events.get("message")({ source: parent, origin: "http://localhost:8081", data: message });
  assert.equal(states.length, 2);
  const reply = context.requestApp("course-save", { course });
  events.get("message")({
    source: parent,
    origin: "http://localhost:8081",
    data: { ...message, type: "reply", payload: { id: "request-1", value: { saved: true } } },
  });
  assert.equal((await reply).saved, true);
});
test("both main app slots use packaged maps; old rendering and local prototype URLs are absent", () => {
  for (const file of [
    "../src/screens/activity-screen.tsx",
    "../src/components/live-workout-recorder.tsx",
  ]) {
    const source = read(file);
    assert.match(source, /<GroovCourseMap/);
    assert.doesNotMatch(source, /<WorkoutMap\b/);
  }
  const league = read("../app/league-region.tsx");
  assert.match(league, /<GroovRankingMap/);
  assert.doesNotMatch(league, /<Svg\b|PanResponder|mapSelectionCard/);
  const surface = read("../src/components/groov-map-surface.web.tsx");
  assert.match(surface, /\/groov-maps\//);
  assert.doesNotMatch(surface, /8095/);
  assert.match(surface, /event\.source\s*!==\s*frame\.current\?\.contentWindow/);
  const base = new URL("../public/groov-maps/", import.meta.url);
  for (const file of [
    "index.html",
    "detail.html",
    "app-host.mjs",
    "app-track.mjs",
    "assets/maplibre-gl.js",
    "assets/korea-municipalities.json",
    "assets/administrative/search-index.json",
  ])
    assert.ok(existsSync(new URL(file, base)), file);
  for (const file of [".data", "server.mjs", "course-api.mjs"])
    assert.ok(!existsSync(new URL(file, base)), file);
  for (const file of readdirSync(base).filter((x) => /\.(html|js|mjs|css)$/.test(x))) {
    const body = readFileSync(new URL(file, base), "utf8");
    for (const match of body.matchAll(
      /(?:from\s*['"]|(?:src|href)=['"])(\.\/[^'"]+|(?:assets\/)[^'"]+)['"]/g,
    )) {
      if (!/[?#]/.test(match[1]))
        assert.ok(existsSync(new URL(match[1], base)), file + " → " + match[1]);
    }
  }
});
