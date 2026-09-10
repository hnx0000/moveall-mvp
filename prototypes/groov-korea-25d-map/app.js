import { embedded, connectApp, sendApp } from './app-host.mjs';
import { liveDistricts } from './app-data.mjs';
import { mountLocateButton } from './map-location.mjs';
import { installMapToolIcons } from './map-tool-icons.mjs';
import { mountZoomReadout } from './map-toolbar.mjs';
import { mountRankingHeat } from './ranking-heat.mjs';
import { mountOrientation, mountBoundaryPulse, SCORE_HEIGHT } from "./map-motion.mjs";
import { mountMapViewport } from './map-viewport.mjs';
import { mountNationalHud } from './national-hud.mjs';
import { mountNationalDongs } from "./national-dongs.mjs";
import {
  aggregateProvinces,
  applyLiveTick,
  buildDistrictModel,
  classifyHeat,
  formatPoints,
  rankDistricts,
  totalsFor,
} from "./model.mjs";

const ORANGE = "#ff5733";
const ALL_PREFIXES = [
  "11",
  "21",
  "22",
  "23",
  "24",
  "25",
  "26",
  "29",
  "31",
  "32",
  "33",
  "34",
  "35",
  "36",
  "37",
  "38",
  "39",
];
const REGIONS = {
  korea: {
    name: "전국",
    title: "전국 지역 랭킹",
    eyebrow: "NATIONAL FRONT",
    prefixes: ALL_PREFIXES,
    skin: "assets/korea.png",
    center: [127.72, 36.14],
    zoom: 5.38,
    pitch: 52,
    bearing: -7,
  },
  seoul: {
    name: "서울",
    title: "서울 지역 랭킹",
    eyebrow: "SEOUL FRONT",
    prefixes: ["11"],
    skin: "assets/seoul.png",
    bounds: [
      [126.76, 37.41],
      [127.2, 37.72],
    ],
    pitch: 58,
    bearing: -10,
  },
  gyeonggi: {
    name: "경기",
    title: "경기 지역 랭킹",
    eyebrow: "GYEONGGI FRONT",
    prefixes: ["31"],
    skin: "assets/gyeonggi.png",
    bounds: [
      [126.34, 36.82],
      [127.87, 38.32],
    ],
    pitch: 54,
    bearing: -7,
  },
  gangwon: {
    name: "강원",
    title: "강원 지역 랭킹",
    eyebrow: "GANGWON FRONT",
    prefixes: ["32"],
    skin: "assets/gangwon.png",
    bounds: [
      [127.52, 36.9],
      [129.72, 38.67],
    ],
    pitch: 57,
    bearing: -10,
  },
  chungcheong: {
    name: "충청",
    title: "충청권 지역 랭킹",
    eyebrow: "CHUNGCHEONG FRONT",
    prefixes: ["25", "29", "33", "34"],
    skin: "assets/chungcheong.png",
    bounds: [
      [125.83, 35.79],
      [128.1, 37.22],
    ],
    pitch: 54,
    bearing: -6,
  },
  jeolla: {
    name: "전라",
    title: "전라권 지역 랭킹",
    eyebrow: "JEOLLA FRONT",
    prefixes: ["24", "35", "36"],
    skin: "assets/jeolla.png",
    bounds: [
      [125.61, 33.9],
      [127.89, 36.28],
    ],
    pitch: 54,
    bearing: -8,
  },
  gyeongsang: {
    name: "경상",
    title: "경상권 지역 랭킹",
    eyebrow: "GYEONGSANG FRONT",
    prefixes: ["21", "22", "26", "37", "38"],
    skin: "assets/gyeongsang.png",
    bounds: [
      [127.48, 34.37],
      [129.79, 37.38],
    ],
    pitch: 56,
    bearing: -8,
  },
  jeju: {
    name: "제주",
    title: "제주 지역 랭킹",
    eyebrow: "JEJU FRONT",
    prefixes: ["39"],
    skin: "assets/jeju.png",
    bounds: [
      [126.02, 33.02],
      [127.03, 33.68],
    ],
    pitch: 59,
    bearing: -12,
  },
};

const dom = Object.fromEntries(
  [
    "skin-scan",
    "skin-image",
    "season-clock",
    "total-score",
    "active-people",
    "hot-count",
    "score-eyebrow",
    "ranking-toggle",
    "ranking-panel",
    "ranking-title",
    "ranking-eyebrow",
    "ranking-list",
    "live-switch",
    "last-sync",
    "selection-card",
    "selection-image",
    "selection-state",
    "selection-name",
    "selection-score",
    "selection-rank",
    "selection-rate",
    "selection-delta",
    "selection-focus",
    "zoom-in",
    "zoom-out",
    "tilt-toggle",
    "gps-locate",
    "reset-view",
    "motion-burst",
    "toast",
    "loading-scene",
    "loading-progress",
  ].map((id) => [id, document.getElementById(id)]),
);

let map, orientation, outlinePulse, rankingHeat;
let topologyResult;
let districtModels = [];
let districtByCode = new Map();
let activeRegion = "korea";
let selectedCode = "11040";
let landmarkMarkers = [];
let liveTimer;
let liveEnabled = true;
let liveTick = 0;
let toastTimer;
let regionTransitionTimer;
let previousRanks = new Map();
let initialSceneFinished = false;
const nationalHUD=mountNationalHud(document.querySelector('.game-shell'),{
  onRegionSelect:key=>setRegion(key),
  onRankingModeChange:enabled=>rankingHeat?.setEnabled(enabled),
});

installMapToolIcons();

bindStaticControls();
if (!embedded) startClock();
boot().catch((error) => {
  console.error(error);
  dom["loading-scene"].querySelector(".loading-core span").textContent = "MAP ENGINE ERROR";
  showToast("지도 엔진을 불러오지 못했습니다. 네트워크를 확인해주세요.");
});

async function boot() {
  setLoading(18);
  const [topology, baseStyle] = await Promise.all([
    fetch("assets/korea-municipalities.json")
      .then(assertResponse)
      .then((response) => response.json()),
    fetch("assets/base-style.json")
      .then(assertResponse)
      .then((response) => response.json()),
  ]);
  setLoading(42);

  topologyResult = decodeTopology(topology);
  districtModels = buildDistrictModel(topologyResult.areas.features);
  if (embedded) districtModels = liveDistricts(districtModels, null);
  districtByCode = new Map(districtModels.map((district) => [district.code, district]));
  previousRanks = new Map(
    rankDistricts(districtModels).map((district) => [district.code, district.rank]),
  );
  setLoading(58);

  map = new maplibregl.Map({
    container: "map",
    style: createGroovStyle(baseStyle),
    center: [127.72, 36.14],
    zoom: 4.72,
    pitch: 22,
    bearing: 0,
    antialias: true,
    maxPitch: 72,
    minZoom: 4.45,
    maxZoom: 19.5,
    maxBounds: [
      [123.3, 31.8],
      [133.0, 40.0],
    ],
    attributionControl: true,
    fadeDuration: 0,
  });

  map.once("load", onMapLoad);
  map.on("error", (event) => console.warn("Map resource warning", event?.error?.message ?? event));
}

function onMapLoad() {
  setLoading(76);
  addTerrain();
  addLeagueSourcesAndLayers();
  rankingHeat = mountRankingHeat(map, ['groov-region-wash']);
  rankingHeat.setEnabled(nationalHUD.rankingMode);
  orientation = mountOrientation(map, dom["tilt-toggle"], document.getElementById("compass"), 52);
  mountZoomReadout(map, document.getElementById('national-zoom-value'));
  outlinePulse = mountBoundaryPulse(map, "national-impact");
  mountMapViewport(map);
  mountLocateButton(map,dom['gps-locate'],{notify:showToast,padding:()=>responsivePadding(),camera:()=>orientation.camera()});
  mountNationalDongs(map, {
    context: false,
    camera: () => orientation.camera(),
    onError: showToast,
    onSelect: ({ entry, feature }) => {
      outlinePulse(feature || null);
      if (feature) {
        showToast(entry.name);
      }
    },
  }).catch((e) => showToast(e.message));
  bindMapInteractions();
  updateLeagueScene({ animateRows: false, rebuildMarkers: true });
  const finishInitialScene = () => {
    if (initialSceneFinished) return;
    initialSceneFinished = true;
    setLoading(100);
    setTimeout(() => dom["loading-scene"].classList.add("is-done"), 240);
    if (embedded) return;
    map.easeTo({
      center: REGIONS.korea.center,
      zoom: REGIONS.korea.zoom,
      pitch: REGIONS.korea.pitch,
      bearing: REGIONS.korea.bearing,
      duration: 2100,
      easing: cinematicEase,
    });
  };
  map.once("idle", finishInitialScene);
  setTimeout(finishInitialScene, 5500);
  if (!embedded) startLiveSimulation();
  else {
    let focusKey = null;
    connectApp(state => {
      districtModels = liveDistricts(districtModels, state.league);
      if (state.selection?.code) selectedCode = state.selection.code;
      updateLeagueScene({animateRows:false});
      const key = state.selection?.focus;
      if (key && key !== focusKey && districtByCode.has(selectedCode)) {
        focusKey = key; focusDistrict(selectedCode);
      }
    });
  }
}

function addTerrain() {
  try {
    const demSource = {
      type: "raster-dem",
      tiles: ["https://s3.amazonaws.com/elevation-tiles-prod/terrarium/{z}/{x}/{y}.png"],
      tileSize: 256,
      encoding: "terrarium",
      maxzoom: 15,
    };
    map.addSource("groov-dem-hillshade", demSource);
    map.addSource("groov-dem-terrain", structuredClone(demSource));
    const firstSymbol = map.getStyle().layers.find((layer) => layer.type === "symbol")?.id;
    map.addLayer(
      {
        id: "groov-hillshade",
        type: "hillshade",
        source: "groov-dem-hillshade",
        paint: {
          "hillshade-shadow-color": "#030304",
          "hillshade-highlight-color": "#ff8a67",
          "hillshade-accent-color": "#5f2117",
          "hillshade-exaggeration": 0.42,
        },
      },
      firstSymbol,
    );
    // Height is opt-in. Hillshade retains terrain detail without raised boards.
  } catch (error) {
    console.warn("Terrain fallback active", error);
  }
}

function addLeagueSourcesAndLayers() {
  const featureData = buildFeatureCollection();
  const provinceData = buildProvincePoints();
  const districtPoints = buildDistrictPoints();

  map.addSource("groov-districts", { type: "geojson", data: featureData, promoteId: "code" });
  map.addSource("groov-province-lines", { type: "geojson", data: topologyResult.provinceLines });
  map.addSource("groov-municipal-lines", { type: "geojson", data: topologyResult.municipalLines });
  map.addSource("groov-province-points", { type: "geojson", data: provinceData });
  map.addSource("groov-district-points", { type: "geojson", data: districtPoints });
  map.addSource("groov-heat-points", { type: "geojson", data: buildHeatPoints() });
  map.addSource("groov-gps", { type: "geojson", data: emptyFeatureCollection() });

  map.addLayer({
    id: "groov-region-wash",
    type: "fill",
    source: "groov-districts",
    paint: {
      "fill-color": [
        "interpolate",
        ["linear"],
        ["get", "heat"],
        20,
        "#161618",
        62,
        "#35211b",
        82,
        "#6e2a1c",
        100,
        ORANGE,
      ],
      "fill-opacity": ["interpolate", ["linear"], ["zoom"], 4.5, 0.2, 8, 0.08],
    },
  });

  map.addLayer({
    id: "groov-heat-bloom",
    type: "circle",
    source: "groov-heat-points",
    paint: {
      "circle-radius": [
        "interpolate",
        ["linear"],
        ["zoom"],
        4.5,
        ["interpolate", ["linear"], ["get", "heat"], 82, 14, 100, 28],
        9,
        ["interpolate", ["linear"], ["get", "heat"], 82, 30, 100, 66],
      ],
      "circle-color": ORANGE,
      "circle-blur": 0.86,
      "circle-opacity": ["interpolate", ["linear"], ["get", "heat"], 81, 0, 82, 0.16, 100, 0.45],
      "circle-pitch-alignment": "map",
    },
  });

  map.addLayer({
    id: "groov-district-extrusions",
    layout: { visibility: "none" },
    type: "fill-extrusion",
    source: "groov-districts",
    paint: {
      "fill-extrusion-color": [
        "interpolate",
        ["linear"],
        ["get", "heat"],
        20,
        "#1c1c1f",
        56,
        "#39231d",
        72,
        "#762d1d",
        88,
        "#d43e22",
        100,
        ORANGE,
      ],
      "fill-extrusion-height": SCORE_HEIGHT,
      "fill-extrusion-base": 0,
      "fill-extrusion-opacity": 0.5,
      "fill-extrusion-vertical-gradient": true,
    },
  });

  map.addLayer({
    id: "groov-municipal-grid",
    type: "line",
    layout:{'line-join':'round','line-cap':'round'},
    source: "groov-municipal-lines",
    paint: {
      "line-color": ORANGE,
      "line-opacity": [
        "interpolate",
        ["linear"],
        ["zoom"],
        4.5,
        0.08,
        7,
        0.32,
        11,
        0.6,
        14,
        0.12,
        15,
        0,
      ],
      "line-width": ["interpolate", ["linear"], ["zoom"], 4.5, 0.3, 8, 0.8, 12, 1.2],
    },
  });

  map.addLayer({
    id: "groov-province-fronts-glow",
    type: "line",
    layout:{'line-join':'round','line-cap':'round'},
    source: "groov-province-lines",
    paint: { "line-color": ORANGE, "line-opacity": 0.18, "line-blur": ['interpolate',['linear'],['zoom'],4,2,10,4], "line-width": ['interpolate',['linear'],['zoom'],4,4,8,7,12,10] },
  });
  map.addLayer({
    id: "groov-province-fronts",
    type: "line",
    layout:{'line-join':'round','line-cap':'round'},
    source: "groov-province-lines",
    paint: {
      "line-color": ORANGE,
      "line-opacity": 0.88,
      "line-width": ["interpolate", ["linear"], ["zoom"], 4.5, 1.1, 8, 2.2, 12, 3.2],
    },
  });

  map.addLayer({
    id: "groov-selected-extrusion",
    layout: { visibility: "none" },
    type: "fill-extrusion",
    source: "groov-districts",
    filter: ["==", ["get", "code"], selectedCode],
    paint: {
      "fill-extrusion-color": "#ff744e",
      "fill-extrusion-height": SCORE_HEIGHT,
      "fill-extrusion-opacity": 0.66,
      "fill-extrusion-vertical-gradient": true,
    },
  });
  map.addLayer({
    id: "groov-selected-outline",
    type: "line",
    layout:{'line-join':'round','line-cap':'round'},
    source: "groov-districts",
    filter: ["==", ["get", "code"], selectedCode],
    paint: {
      "line-color": "#ffad91",
      "line-width": 1.6,
      "line-blur": 0.2,
      "line-opacity": ["interpolate", ["linear"], ["zoom"], 4, 0.8, 13, 0.8, 15, 0],
    },
  });

  map.addLayer({
    id: "groov-region-hit",
    type: "fill",
    source: "groov-districts",
    paint: { "fill-opacity": 0 },
  });
  map.addLayer({
    id: "groov-province-labels",
    type: "symbol",
    source: "groov-province-points",
    minzoom: 4.2,
    maxzoom: 8.3,
    layout: {
      "text-field": ["concat", ["get", "name"], "\n", ["get", "scoreLabel"], " PT"],
      "text-font": ["Noto Sans Regular"],
      "text-size": ["interpolate", ["linear"], ["zoom"], 4.5, 10, 5.8, 14, 7.8, 20],
      "text-line-height": 1.05,
      "text-letter-spacing": 0.06,
      "text-max-width": 8,
      "text-allow-overlap": false,
      "text-padding": 12,
    },
    paint: {
      "text-color": "#e6e2de",
      "text-halo-color": "rgba(5,5,6,.92)",
      "text-halo-width": 1.8,
      "text-opacity": ["interpolate", ["linear"], ["zoom"], 4.2, 0.75, 6.2, 1, 8.3, 0],
    },
  });

  map.addLayer({
    id: "groov-district-labels",
    type: "symbol",
    source: "groov-district-points",
    minzoom: 7.05,
    maxzoom: 14.5,
    layout: {
      "text-field": ["concat", ["get", "name"], "  ", ["get", "scoreLabel"]],
      "text-font": ["Noto Sans Regular"],
      "text-size": ["interpolate", ["linear"], ["zoom"], 7, 9, 9, 13, 12, 18],
      "text-letter-spacing": 0.04,
      "text-allow-overlap": false,
      "text-padding": 6,
    },
    paint: {
      "text-color": ["case", [">=", ["get", "heat"], 82], "#ffd6ca", "#bab7b4"],
      "text-halo-color": "rgba(5,5,6,.94)",
      "text-halo-width": 1.5,
    },
  });

  map.addLayer({
    id: "groov-gps-trail",
    type: "line",
    source: "groov-gps",
    filter: ["==", ["geometry-type"], "LineString"],
    paint: { "line-color": ORANGE, "line-width": 5, "line-opacity": 0.9, "line-blur": 0.2 },
  });
  map.addLayer({
    id: "groov-gps-point-glow",
    type: "circle",
    source: "groov-gps",
    filter: ["==", ["geometry-type"], "Point"],
    paint: {
      "circle-radius": 22,
      "circle-color": ORANGE,
      "circle-opacity": 0.18,
      "circle-blur": 0.65,
    },
  });
  map.addLayer({
    id: "groov-gps-point",
    type: "circle",
    source: "groov-gps",
    filter: ["==", ["geometry-type"], "Point"],
    paint: {
      "circle-radius": 6,
      "circle-color": ORANGE,
      "circle-stroke-color": "#fff5ef",
      "circle-stroke-width": 2,
    },
  });
}

function bindMapInteractions() {
  map.on("click", "groov-region-hit", (event) => {
    if (map.getContainer?.().dataset.savedPlacePicking === 'true') return;
    const feature = event.features?.[0];
    if (!feature || map.getZoom() >= 14.1) return;
    const code = String(feature.properties.code);
    const point = event.point;
    selectDistrict(code, { animateCamera: true, burst: [point.x, point.y] });
  });
  map.on("dblclick", "groov-region-hit", (event) => {
    if (map.getContainer?.().dataset.savedPlacePicking === 'true') { event.preventDefault(); return; }
    event.preventDefault();
    const feature = event.features?.[0];
    if (feature) focusDistrict(String(feature.properties.code));
  });
  map.on("mouseenter", "groov-region-hit", () => {
    map.getCanvas().style.cursor = "pointer";
  });
  map.on("mouseleave", "groov-region-hit", () => {
    map.getCanvas().style.cursor = "grab";
  });
  map.on("zoom", updateLandmarkScale);
  map.on("moveend", () => {
    document.body.dataset.zoom = map.getZoom().toFixed(2);
    document.body.dataset.center = `${map.getCenter().lng.toFixed(6)},${map.getCenter().lat.toFixed(6)}`;
  });
  map.on("dragstart", () => {
  });
}

function updateLeagueScene({ animateRows = true, rebuildMarkers = false } = {}) {
  districtByCode = new Map(districtModels.map((district) => [district.code, district]));
  const source = map?.getSource("groov-districts");
  if (source) source.setData(buildFeatureCollection());
  map?.getSource("groov-district-points")?.setData(buildDistrictPoints());
  map?.getSource("groov-province-points")?.setData(buildProvincePoints());
  map?.getSource("groov-heat-points")?.setData(buildHeatPoints());

  applyActiveFilters();
  const ranking = currentRanking();
  if (!ranking.some((district) => district.code === selectedCode)) {
    selectedCode = ranking[0]?.code ?? selectedCode;
    outlinePulse?.(districtByCode.get(selectedCode)?.feature);
  }
  map?.setFilter("groov-selected-extrusion", ["==", ["get", "code"], selectedCode]);
  map?.setFilter("groov-selected-outline", ["==", ["get", "code"], selectedCode]);
  renderRanking(ranking, animateRows);
  renderTotals(ranking);
  renderSelection();

  previousRanks = new Map(ranking.map((district) => [district.code, district.rank]));
}

function applyActiveFilters() {
  if (!map?.isStyleLoaded()) return;
  const prefixes = REGIONS[activeRegion].prefixes;
  const regionFilter = ["in", ["get", "provinceCode"], ["literal", prefixes]];
  [
    "groov-region-wash",
    "groov-district-extrusions",
    "groov-region-hit",
    "groov-district-labels",
    "groov-heat-bloom",
  ].forEach((id) => {
    if (map.getLayer(id)) map.setFilter(id, regionFilter);
  });
  if (map.getLayer("groov-province-labels"))
    map.setFilter("groov-province-labels", ["in", ["get", "code"], ["literal", prefixes]]);
}

function currentRanking() {
  const prefixes = REGIONS[activeRegion].prefixes;
  return rankDistricts(
    districtModels.filter((district) => prefixes.includes(district.provinceCode)),
  );
}

function renderRanking(ranking, animateRows) {
  dom["ranking-list"].replaceChildren(
    ...ranking.filter(d => !embedded || d.rank).slice(0, 10).map((district) => {
      const row = document.createElement("li");
      const movedUp =
        animateRows && (previousRanks.get(district.code) ?? district.rank) > district.rank;
      row.className = `rank-row${district.code === selectedCode ? " is-selected" : ""}${movedUp ? " rank-up" : ""}`;
      const button = document.createElement("button");
      button.type = "button";
      button.dataset.code = district.code;
      button.setAttribute(
        "aria-label",
        `${district.rank}위 ${district.province} ${district.name}, ${formatPoints(district.score)}점`,
      );
      button.innerHTML = `
      <span class="rank-number">${String(district.rank).padStart(2, "0")}</span>
      <span class="rank-place"><b>${district.province} · ${district.name}</b><small>참여 ${district.participationRate.toFixed(1)}% ${embedded ? '· 서버 집계' : '· 오늘 +' + formatPoints(district.todayDelta)}</small></span>
      <span class="rank-score"><b>${formatPoints(district.score, true)} <small>PT</small></b><small>${{stable:'안정',battle:'접전',overheat:'과열'}[classifyHeat(district.heat)]}</small></span>`;
      button.addEventListener("click", () =>
        selectDistrict(district.code, { animateCamera: true }),
      );
      row.append(button);
      return row;
    }),
  );
}

function renderTotals(ranking) {
  const totals = totalsFor(ranking);
  document.getElementById('mobile-rank-summary').textContent=`총 ${formatPoints(totals.score,true)} pt · ${formatPoints(totals.participants,true)}명 참여 · ${embedded ? '서버 집계' : '샘플 점수'}`;
  dom["total-score"].textContent = formatPoints(totals.score, true);
  dom["active-people"].textContent = formatPoints(totals.participants, true);
  dom["hot-count"].textContent = formatPoints(totals.overheat);
  dom["score-eyebrow"].textContent =
    activeRegion === "korea" ? "NATIONAL SCORE BOARD" : `${REGIONS[activeRegion].eyebrow} SCORE`;
  dom["ranking-title"].textContent = REGIONS[activeRegion].title;
  dom["ranking-eyebrow"].textContent = REGIONS[activeRegion].eyebrow;
}

function renderSelection() {
  const district = districtByCode.get(selectedCode) ?? currentRanking()[0];
  if (!district) return;
  const localRank =
    currentRanking().find((item) => item.code === district.code)?.rank ?? district.rank;
  const state = classifyHeat(district.heat);
  dom["selection-card"].classList.toggle("is-overheat", state === "overheat");
  dom["selection-card"].classList.remove("is-impact");
  void dom["selection-card"].offsetWidth;
  dom["selection-card"].classList.add("is-impact");
  dom["selection-state"].textContent = `${state.toUpperCase()} FRONT`;
  dom["selection-name"].textContent = `${district.province} · ${district.name}`;
  dom["selection-score"].textContent = formatPoints(district.score);
  dom["selection-rank"].textContent = localRank ? `#${localRank}` : "—";
  dom["selection-rate"].textContent = `${district.participationRate.toFixed(1)}%`;
  dom["selection-delta"].textContent = `+${formatPoints(district.todayDelta)}`;
  if (embedded) {
    const p = dom["selection-rate"].parentElement;
    p.childNodes.forEach(node => { if(node.nodeType === 3) node.textContent = " 참여 · 서버 집계 "; });
    dom["selection-delta"].hidden = true;
  }
  dom["selection-image"].src = skinForProvince(district.provinceCode);
  dom["selection-image"].alt = `${district.province} 권역 지도 스킨`;
}

function selectDistrict(code, { animateCamera = false, burst = null } = {}) {
  const district = districtByCode.get(code);
  if (!district) return;
  selectedCode = code;
  sendApp('region-select',{code:district.code,name:district.name,province:district.province,regionKey:district.regionKey});
  map.setFilter("groov-selected-extrusion", ["==", ["get", "code"], code]);
  map.setFilter("groov-selected-outline", ["==", ["get", "code"], code]);
  renderRanking(currentRanking(), false);
  renderSelection();
  nationalHUD.open('ranking');
  outlinePulse(district.feature);
  if (animateCamera) {
    map.easeTo({
      center: district.center,
      zoom: Math.max(map.getZoom(), activeRegion === "korea" ? 7.4 : 8.4),
      ...orientation.camera(),
      duration: 1350,
      padding:responsivePadding(),
      easing: cinematicEase,
    });
  }
}

function focusDistrict(code) {
  const district = districtByCode.get(code);
  if (!district) return;
  selectDistrict(code);
  const padding = responsivePadding(true);
  map.fitBounds(district.bounds, {
    padding,
    ...orientation.camera(),
    duration: 1600,
    maxZoom: 11.3,
    easing: cinematicEase,
  });
  triggerSkin(skinForProvince(district.provinceCode));
  showToast(`${district.province} ${district.name} 전장 확대`);
}

function setRegion(key, { announce = true } = {}) {
  const region = REGIONS[key];
  if (!region || !map?.getLayer('groov-region-hit') || !orientation) return false;
  nationalHUD.closeRegionMenu();
  activeRegion = key;
  nationalHUD.setRegion(key);
  const ranking = currentRanking();
  selectedCode = ranking[0]?.code ?? selectedCode;
  outlinePulse?.(districtByCode.get(selectedCode)?.feature);
  applyActiveFilters();
  updateLeagueScene({ animateRows: false, rebuildMarkers: true });
  triggerSkin(region.skin);
  if (region.center) {
    map.flyTo({
      center: region.center,
      zoom: region.zoom,
      ...orientation.camera(),
      padding:responsivePadding(),
      duration: 1850,
      curve: 1.42,
      easing: cinematicEase,
    });
  } else {
    map.fitBounds(region.bounds, {
      padding: responsivePadding(),
      ...orientation.camera(),
      duration: 1850,
      maxZoom: key === "seoul" ? 9.7 : 8.3,
      easing: cinematicEase,
    });
  }
  if (announce) showToast(`${region.name} 전장으로 이동`);
}

function updateLandmarkScale() {
  /* Scene has no floating rank tokens. */
}

function startLiveSimulation() {
  clearInterval(liveTimer);
  liveTimer = setInterval(() => {
    if (!liveEnabled || document.hidden) return;
    liveTick += 1;
    districtModels = applyLiveTick(districtModels, liveTick);
    updateLeagueScene({ animateRows: true, rebuildMarkers: true });
    dom["last-sync"].textContent = "JUST NOW";
  }, 4200);
}

function bindStaticControls() {
  dom["live-switch"].addEventListener("click", () => {
    liveEnabled = !liveEnabled;
    dom["live-switch"].classList.toggle("is-live", liveEnabled);
    dom["live-switch"].setAttribute("aria-pressed", String(liveEnabled));
    dom["live-switch"].querySelector("span").textContent = liveEnabled ? "LIVE" : "PAUSE";
    showToast(liveEnabled ? "실시간 점수 시뮬레이션 재개" : "실시간 점수 시뮬레이션 일시정지");
  });
  dom["zoom-in"].addEventListener("click", () => map?.zoomIn({ duration: 480 }));
  dom["zoom-out"].addEventListener("click", () => map?.zoomOut({ duration: 480 }));
  document.getElementById("open-course").addEventListener("click", () => {
    if (!map) return;
    if (embedded) { sendApp('navigate',{kind:'course'}); return; }
    const p = map.getCenter(),
      angle = orientation.camera();
    location.href =
      "detail.html?" +
      new URLSearchParams({
        view: "explore",
        lng: p.lng,
        lat: p.lat,
        zoom: Math.max(14, map.getZoom()),
        pitch: angle.pitch,
        bearing: angle.bearing,
        plan: "1",
      });
  });
  dom["reset-view"].addEventListener("click", () => {
    if (activeRegion === "korea") {
      map?.flyTo({
        center: REGIONS.korea.center,
        zoom: REGIONS.korea.zoom,
        ...orientation.camera(),
        duration: 1500,
        curve: 1.35,
        easing: cinematicEase,
      });
      triggerSkin(REGIONS.korea.skin);
    } else setRegion("korea");
  });
  dom["selection-focus"].addEventListener("click", () => focusDistrict(selectedCode));

}

function createGroovStyle(style) {
  const next = structuredClone(style);
  next.layers = next.layers.map((layer) => {
    const item = structuredClone(layer);
    const id = item.id.toLowerCase();
    item.paint ||= {};
    item.layout ||= {};
    if (item.type === "background") item.paint["background-color"] = "#070708";
    if (item.type === "fill") {
      item.paint["fill-color"] = /water/.test(id)
        ? "#080c10"
        : /building/.test(id)
          ? "#1f2023"
          : /park|wood|grass|landcover/.test(id)
            ? "#141617"
            : "#111113";
      if ("fill-outline-color" in item.paint) item.paint["fill-outline-color"] = "#292a2d";
    }
    if (item.type === "line") {
      const isRoad =
        item["source-layer"] === "transportation" ||
        /road|street|motorway|primary|secondary|tertiary|path|bridge|tunnel/.test(id);
      const isSmall = /minor|street|service|track|path|pedestrian/.test(id);
      if (/casing|hatching/.test(id)) item.layout.visibility = "none";
      else if (isRoad) {
        item.minzoom = 0;
        item.layout.visibility = "visible";
        item.layout["line-cap"] = "round";
        item.layout["line-join"] = "round";
        item.paint["line-color"] = isSmall ? "#55575b" : "#777a80";
        item.paint["line-opacity"] = isSmall ? 0.46 : 0.64;
        item.paint["line-width"] = isSmall
          ? ["interpolate", ["linear"], ["zoom"], 5, 0.18, 9, 0.55, 13, 1.1]
          : ["interpolate", ["linear"], ["zoom"], 5, 0.34, 9, 0.9, 13, 1.65];
      } else if (/water/.test(id)) {
        item.paint["line-color"] = "#222c33";
        item.paint["line-opacity"] = 0.58;
      } else {
        item.paint["line-color"] = "#303135";
        item.paint["line-opacity"] = 0.48;
      }
    }
    if (item.type === "symbol") {
      const keep =
        /road_label|road-name|place_city|place_town|settlement/.test(id) &&
        !/poi|airport|transit|station|housenumber/.test(id);
      item.layout.visibility = keep ? "visible" : "none";
      if (keep) {
        item.paint["text-color"] = "#77777b";
        item.paint["text-halo-color"] = "#080809";
        item.paint["text-halo-width"] = 1;
        item.paint["text-opacity"] = 0.52;
        if ("icon-opacity" in item.paint) item.paint["icon-opacity"] = 0;
      }
    }
    if (item.type === "circle") item.paint["circle-color"] = "#696b70";
    if (item.type === "fill-extrusion") {
      item.paint["fill-extrusion-color"] = "#202124";
      item.paint["fill-extrusion-opacity"] = 0.58;
    }
    return item;
  });
  return next;
}

function decodeTopology(topology) {
  const object = Object.values(topology.objects)[0];
  const { scale, translate } = topology.transform;
  const decodedArcs = topology.arcs.map((arc) => {
    let x = 0;
    let y = 0;
    return arc.map(([dx, dy]) => {
      x += dx;
      y += dy;
      return [x * scale[0] + translate[0], y * scale[1] + translate[1]];
    });
  });
  const arcPoints = (index) => {
    const points = decodedArcs[index < 0 ? ~index : index];
    return index < 0 ? [...points].reverse() : [...points];
  };
  const ringCoordinates = (ring) => {
    const points = ring.flatMap((index, part) => {
      const arc = arcPoints(index);
      return part ? arc.slice(1) : arc;
    });
    if (points.length && !samePoint(points[0], points.at(-1))) points.push([...points[0]]);
    return points;
  };

  const arcUsage = new Map();
  const features = object.geometries.map((geometry) => {
    const provinceCode = String(geometry.properties.code).slice(0, 2);
    const polygons = geometry.type === "Polygon" ? [geometry.arcs] : geometry.arcs;
    for (const polygon of polygons)
      for (const ring of polygon)
        for (const index of ring) {
          const canonical = index < 0 ? ~index : index;
          const usage = arcUsage.get(canonical) ?? {
            count: 0,
            directed: index,
            provinces: new Set(),
          };
          usage.count += 1;
          usage.provinces.add(provinceCode);
          arcUsage.set(canonical, usage);
        }
    const coordinates =
      geometry.type === "Polygon"
        ? geometry.arcs.map(ringCoordinates)
        : geometry.arcs.map((polygon) => polygon.map(ringCoordinates));
    const geometryGeoJson = { type: geometry.type, coordinates };
    const bounds = geometryBounds(geometryGeoJson);
    return {
      type: "Feature",
      id: String(geometry.properties.code),
      properties: {
        ...geometry.properties,
        code: String(geometry.properties.code),
        provinceCode,
        center: geometryCentroid(geometryGeoJson),
        bounds,
      },
      geometry: geometryGeoJson,
    };
  });

  const provinceLines = [];
  const municipalLines = [];
  for (const usage of arcUsage.values()) {
    const feature = {
      type: "Feature",
      properties: {},
      geometry: { type: "LineString", coordinates: arcPoints(usage.directed) },
    };
    if (usage.count === 1 || usage.provinces.size > 1) provinceLines.push(feature);
    else municipalLines.push(feature);
  }
  return {
    areas: { type: "FeatureCollection", features },
    provinceLines: { type: "FeatureCollection", features: provinceLines },
    municipalLines: { type: "FeatureCollection", features: municipalLines },
  };
}

function buildFeatureCollection() {
  return {
    type: "FeatureCollection",
    features: districtModels.map((district) => ({
      ...district.feature,
      id: district.code,
      properties: {
        ...district.feature.properties,
        code: district.code,
        provinceCode: district.provinceCode,
        province: district.province,
        score: district.score,
        heat: district.heat,
        scoreLabel: formatPoints(district.score, true),
      },
    })),
  };
}

function buildProvincePoints() {
  return {
    type: "FeatureCollection",
    features: aggregateProvinces(districtModels).map((province) => ({
      type: "Feature",
      properties: {
        code: province.code,
        name: province.name,
        score: province.score,
        scoreLabel: formatPoints(province.score, true),
        heat: province.heat,
      },
      geometry: { type: "Point", coordinates: province.center },
    })),
  };
}

function buildDistrictPoints() {
  return {
    type: "FeatureCollection",
    features: districtModels.map((district) => ({
      type: "Feature",
      properties: {
        code: district.code,
        provinceCode: district.provinceCode,
        name: district.name,
        scoreLabel: formatPoints(district.score, true),
        heat: district.heat,
      },
      geometry: { type: "Point", coordinates: district.center },
    })),
  };
}

function buildHeatPoints() {
  return {
    type: "FeatureCollection",
    features: districtModels
      .filter((district) => district.heat >= 82)
      .map((district) => ({
        type: "Feature",
        properties: {
          code: district.code,
          provinceCode: district.provinceCode,
          heat: district.heat,
        },
        geometry: { type: "Point", coordinates: district.center },
      })),
  };
}

function triggerSkin(src) {
  clearTimeout(regionTransitionTimer);
  dom["skin-image"].src = src;
  dom["skin-scan"].classList.remove("is-active");
  void dom["skin-scan"].offsetWidth;
  dom["skin-scan"].classList.add("is-active");
  regionTransitionTimer = setTimeout(() => dom["skin-scan"].classList.remove("is-active"), 1080);
}

function showToast(message) {
  clearTimeout(toastTimer);
  dom.toast.textContent = message;
  dom.toast.classList.add("is-visible");
  toastTimer = setTimeout(() => dom.toast.classList.remove("is-visible"), 1800);
}

function startClock() {
  let remaining = 6 * 3600 + 18 * 60 + 42;
  setInterval(() => {
    remaining = Math.max(0, remaining - 1);
    const hours = Math.floor(remaining / 3600);
    const minutes = Math.floor((remaining % 3600) / 60);
    const seconds = remaining % 60;
    dom["season-clock"].textContent = [hours, minutes, seconds]
      .map((part) => String(part).padStart(2, "0"))
      .join(":");
  }, 1000);
}

function setLoading(value) {
  dom["loading-progress"].style.width = `${value}%`;
}

function skinForProvince(prefix) {
  if (prefix === "11") return REGIONS.seoul.skin;
  if (prefix === "31") return REGIONS.gyeonggi.skin;
  if (prefix === "32") return REGIONS.gangwon.skin;
  if (["25", "29", "33", "34"].includes(prefix)) return REGIONS.chungcheong.skin;
  if (["24", "35", "36"].includes(prefix)) return REGIONS.jeolla.skin;
  if (["21", "22", "26", "37", "38"].includes(prefix)) return REGIONS.gyeongsang.skin;
  if (prefix === "39") return REGIONS.jeju.skin;
  return REGIONS.korea.skin;
}

function responsivePadding(focus = false) {
  return nationalHUD.padding();
}

function geometryBounds(geometry) {
  const points = flattenCoordinates(geometry.coordinates);
  return points.reduce(
    (bounds, point) => [
      [Math.min(bounds[0][0], point[0]), Math.min(bounds[0][1], point[1])],
      [Math.max(bounds[1][0], point[0]), Math.max(bounds[1][1], point[1])],
    ],
    [
      [Infinity, Infinity],
      [-Infinity, -Infinity],
    ],
  );
}

function geometryCentroid(geometry) {
  const polygons = geometry.type === "Polygon" ? [geometry.coordinates] : geometry.coordinates;
  let best = null;
  for (const polygon of polygons) {
    const ring = polygon[0] ?? [];
    const centroid = ringCentroid(ring);
    if (!best || Math.abs(centroid.area) > Math.abs(best.area)) best = centroid;
  }
  if (best && Number.isFinite(best.x) && Number.isFinite(best.y)) return [best.x, best.y];
  const bounds = geometryBounds(geometry);
  return [(bounds[0][0] + bounds[1][0]) / 2, (bounds[0][1] + bounds[1][1]) / 2];
}

function ringCentroid(ring) {
  let area = 0;
  let x = 0;
  let y = 0;
  for (let index = 0; index < ring.length - 1; index += 1) {
    const a = ring[index];
    const b = ring[index + 1];
    const cross = a[0] * b[1] - b[0] * a[1];
    area += cross;
    x += (a[0] + b[0]) * cross;
    y += (a[1] + b[1]) * cross;
  }
  area *= 0.5;
  if (Math.abs(area) < 1e-12) return { x: ring[0]?.[0] ?? 0, y: ring[0]?.[1] ?? 0, area: 0 };
  return { x: x / (6 * area), y: y / (6 * area), area };
}

function flattenCoordinates(value) {
  if (!Array.isArray(value)) return [];
  if (typeof value[0] === "number" && typeof value[1] === "number") return [value];
  return value.flatMap(flattenCoordinates);
}

function distanceKm(a, b) {
  const rad = Math.PI / 180;
  const lat1 = a[1] * rad;
  const lat2 = b[1] * rad;
  const deltaLat = (b[1] - a[1]) * rad;
  const deltaLon = (b[0] - a[0]) * rad;
  const h =
    Math.sin(deltaLat / 2) ** 2 + Math.cos(lat1) * Math.cos(lat2) * Math.sin(deltaLon / 2) ** 2;
  return 6371 * 2 * Math.atan2(Math.sqrt(h), Math.sqrt(1 - h));
}

function cinematicEase(value) {
  return value < 0.5 ? 4 * value ** 3 : 1 - Math.pow(-2 * value + 2, 3) / 2;
}

function samePoint(a, b) {
  return Math.abs(a[0] - b[0]) < 1e-9 && Math.abs(a[1] - b[1]) < 1e-9;
}

function emptyFeatureCollection() {
  return { type: "FeatureCollection", features: [] };
}

function assertResponse(response) {
  if (!response.ok) throw new Error(`HTTP ${response.status} · ${response.url}`);
  return response;
}

function clamp(value, minimum, maximum) {
  return Math.max(minimum, Math.min(maximum, value));
}
