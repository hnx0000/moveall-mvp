import { embedded, connectApp, requestApp } from './app-host.mjs';
import { mountAppTrack } from './app-track.mjs';
import { neighborhoodLabel } from './verified-neighborhood.mjs';
import { mountLocateButton } from './map-location.mjs';
import { installMapToolIcons } from './map-tool-icons.mjs';
import { mountOrientation, mountBoundaryPulse, DONG_FADE } from "./map-motion.mjs";
import { mountNationalDongs } from "./national-dongs.mjs";
import { mountCoursePlanner } from "./course-planner.mjs";
import { mountMapViewport } from './map-viewport.mjs';
import { mountMobileMapUI } from './mobile-map-ui.mjs';
import { mountZoomReadout } from './map-toolbar.mjs';
import { mountRankingHeat } from './ranking-heat.mjs';
import { mountDetailHud } from './detail-hud.mjs';
import { createDetailStyle } from "./detail-style.mjs";
import { routeLengthMeters, sampleRoute, filterGpsFix } from "./route-model.mjs";

const ORANGE = "#ff5733";
const SSANGMUN = "1132066000";
const EMPTY = () => ({ type: "FeatureCollection", features: [] });
const $ = (id) => document.getElementById(id);
const REDUCED = matchMedia("(prefers-reduced-motion: reduce)").matches;
const VIEWS = {
  explore: {
    title: "코스탐색",
    eyebrow: "01 / KOREA · EXPLORE",
    description: "달리고 싶은 곳을 찾고, 나만의 코스를 그려보세요.",
    status: "시·군·구 → 읍·면·동",
    pitch: 48,
    bearing: -12,
  },
  dobong: {
    title: "도봉구",
    eyebrow: "01 / SEOUL · DOBONG",
    description: "14개 동, 하나의 리그.",
    status: "행정동 경계 · 동별 점수 시뮬레이션",
    pitch: 48,
    bearing: -12,
  },
  run: {
    title: "당신의 발자취.",
    eyebrow: "02 / RUNNING · ZOOM 17",
    description: "코스를 만들거나 내 GPS로 운동을 시작하세요.",
    status: "나만의 코스 · GPS 기록",
    pitch: 44,
    bearing: -12,
  },
};
let map,
  regions,
  route,
  routeCoords,
  routeLength = 0,
  ready = false;
let view = new URLSearchParams(location.search).get("view") || "explore";
if (!VIEWS[view]) view = "explore";
let selectedCode = SSANGMUN;
let regionModels = [],
  landmarkMarkers = [],
  rankLive = true,
  tick = 0;
let mode = "preview",
  playback = false,
  progress = 0,
  follow = true,
  frameTime = 0,
  renderTime = 0;
let gpsId = null,
  gpsToken = 0,
  gpsPrevious = null,
  gpsSegments = [],
  gpsDistance = 0,
  gpsStart = 0,
  gpsElapsed = 0,
  lastGpsCoordinate = null;
let runner, toastTimer, orientation, outlinePulse, planner, nationalDongs, dobongRegions, rankingHeat;
let rankAreaLabel = "도봉구";
let previewSpeed = 2.85;
const query = new URLSearchParams(location.search);
let pendingView = null;
let mobileUI;
let areaPicked=view==='dobong';
const show = (id, visible) => {
  $(id).hidden = !visible;
};

function setupMobileUI(){
  if(mobileUI)return;
  document.querySelector('.map-actions').id='mobile-tools';
  document.querySelector('.map-bottom').id='mobile-info';
  mobileUI=mountMobileMapUI({
    root:document.querySelector('.detail-shell'),
    panels:{ranking:{element:$('detail-ranking'),title:'동네 랭킹'},course:{element:$('course-planner'),title:'나만의 코스',ownHeader:true}},
    actions:[],
    beforeOpen:key=>{if(key==='course'&&mode==='live'){toast('GPS 기록을 종료한 뒤 코스를 설계해주세요.');return false;}return true;},
    onChange:(key,previous)=>{
      show('detail-ranking',key==='ranking');
      rankingHeat?.setEnabled(key==='ranking');
      $('detail-rank-toggle').setAttribute('aria-expanded',String(key==='ranking'));
      $('area-ranking').setAttribute('aria-expanded',String(key==='ranking'));
      if(previous==='course'&&key!=='course'&&planner?.active)planner.toggle(false);
      if(key==='course'&&!planner?.active)planner?.toggle(true);
    },
  });

}

installMapToolIcons();
const detailHud=mountDetailHud(document.querySelector('.detail-shell'));
bindControls();
boot().catch((error) => {
  console.error("Detail map boot failed", error);
  $("loading-copy").textContent = "지도를 불러오지 못했습니다. 새로고침해 주세요.";
});

async function boot() {
  const [baseStyle, areaData] = await Promise.all([
    fetchJson("assets/base-style.json"),
    fetchJson("assets/dobong-dongs.geojson"),
  ]);
  regions = areaData;
  dobongRegions = areaData;
  route = EMPTY();
  routeCoords = [];
  routeLength = 0;
  regionModels = regions.features.map((feature, index) => {
    const name = feature.properties.adm_nm.split(" ").at(-1);
    const seed = Number(feature.properties.adm_cd2.slice(-5)) + index * 43;
    const score =
      name === "쌍문1동"
        ? 184820
        : name === "창1동"
          ? 179410
          : name === "방학1동"
            ? 173650
            : 55000 + (seed % 90000);
    return {
      code: feature.properties.adm_cd2,
      name,
      score: embedded ? 0 : score,
      participation: embedded ? 0 : 35 + (seed % 540) / 10,
      heat: embedded ? 0 : name === "쌍문1동" ? 92 : name === "창1동" ? 86 : 28 + (seed % 68),
      center: interiorCenter(feature.geometry),
      bounds: geometryBounds(feature.geometry),
      feature,
    };
  });
  rankModels();
  map = new maplibregl.Map({
    container: "detail-map",
    style: createDetailStyle(baseStyle),
    center: [127.0319, 37.661],
    zoom: 12,
    pitch: 38,
    bearing: -12,
    minZoom: 4.5,
    maxZoom: 19.5,
    maxPitch: 65,
    maxBounds: [
      [123.8, 32.7],
      [132.5, 39.1],
    ],
    antialias: true,
    attributionControl: false,
  });
  map.addControl(
    new maplibregl.AttributionControl({
      compact: true,
      customAttribution:
        '<a href="https://github.com/vuski/admdongkor" target="_blank" rel="noopener">경계: 통계청 SGIS · vuski</a>',
    }),
    "bottom-right",
  );
  map.addControl(new maplibregl.ScaleControl({ maxWidth: 90, unit: "metric" }), "bottom-left");
  map.on("error", (event) => console.warn("Detail map resource", event.error?.message));
  map.on("load", () => {
    addAreaLayers();
    rankingHeat = mountRankingHeat(map, ['detail-area-tint']);
    rankingHeat.setEnabled(!$('detail-ranking').hidden);
    addRouteLayers();
    ready = true;
    mountMapViewport(map);
    orientation = mountOrientation(map, $("detail-tilt"), $("detail-compass"), 48);
    mountZoomReadout(map, $('zoom-value'));
    outlinePulse = mountBoundaryPulse(map, "detail-impact");
    mountLocateButton(map,$('detail-locate'),{notify:toast,padding:cameraPadding,camera:()=>orientation.camera(),
      beforeMove:()=>{follow=false;$('route-follow').setAttribute('aria-pressed','false');}});
    planner = mountCoursePlanner(map, {
      button: $("course-pin-toggle"),
      host: $("course-planner"),
      camera: () => orientation.camera(),
      padding:()=>detailHud.padding(),
      canOpen: () => {
        if (mode === "live") {
          toast("GPS 기록을 종료한 뒤 코스를 설계해주세요.");
          return false;
        }
        return true;
      },
      notify: toast,
      onToggle: (active) => {
        playback = false;
        if(active){closeRanking();mobileUI?.open('course');}
        else if(mobileUI?.current==='course')mobileUI.close();
        if(active)outlinePulse?.(null);
        show("run-card", !active && view === "run");
        runner.getElement().style.display = !active && view === "run" && (routeLength>0 || lastGpsCoordinate) ? "" : "none";
        ["run-plan", "run-glow", "run-shadow", "run-trail", "run-highlight", "run-start"].forEach(
          (id) =>
            map.setLayoutProperty(id, "visibility", !active && view === "run" && routeLength>0 ? "visible" : "none"),
        );
      },
      onUse: (course) => {
        if (embedded) { void requestApp('course-use',{course}).then(()=>toast('선택한 코스를 기록 지도에 적용했습니다.')).catch(error=>toast(error.message)); return; }
        mode = "preview";
        route = lineFeature(course.coordinates);
        routeCoords = course.coordinates;
        routeLength = course.distanceMeters;
        previewSpeed = course.sport === "cycling" ? 5.5 : course.sport==='hiking'?1:2.85;
        progress = 0;
        VIEWS.run.title = course.name;
        VIEWS.run.eyebrow = `03 / ${course.sport.toUpperCase()} · MY COURSE`;
        VIEWS.run.status = "나만의 가상 코스 · 실제 GPS와 별도";
        VIEWS.run.description =
          (course.sport === "cycling" ? "사이클" : course.sport==='hiking'?'등산':"러닝") + " · 나만의 코스";
        map.getSource("detail-route-plan").setData(route);
        setView("run");
      },
    });
    nationalDongs = mountNationalDongs(map, {
      camera: () => orientation.camera(),
      searchHost: $("area-search"),
      onSelect: acceptNationalSelection,
      padding:cameraPadding,
      beforeSearchSelect:()=>{
        if(mode==='live'){toast('GPS 기록을 종료한 뒤 다른 지역을 선택해주세요.');return false;}
        planner?.toggle(false);mobileUI?.close();return true;
      },
      onPlaceSelect:()=>mobileUI?.close(),
      isInteractive: () => !planner.active && mode !== "live",
      onError: toast,
    })
      .then((api) => {
        setupMobileUI();
        if (query.get("plan") === "1") planner.toggle(true);
        return api;
      })
      .catch((e) => {setupMobileUI();toast(e.message);});
    bindMap();
    renderLeague();
    setView(view, true);
    if (query.has("lng") && query.has("lat")) {
      const lng = Number(query.get("lng")),
        lat = Number(query.get("lat"));
      if (lng >= 124 && lng <= 132.5 && lat >= 32.8 && lat <= 39)
        map.jumpTo({
          center: [lng, lat],
          zoom: Math.max(5, Math.min(19, Number(query.get("zoom")) || 15)),
          pitch: Math.max(0, Math.min(65, Number(query.get("pitch")) || 0)),
          bearing: Number(query.get("bearing")) || 0,
        });
    }
    $("detail-loading").classList.add("is-done");
    requestAnimationFrame(animate);
    if (!embedded) setInterval(updateLeague, 5000);
    else {
      const updateTrack = mountAppTrack(map);
      connectApp(state => {
        updateTrack(state);
        if (state.neighborhood) {
          const label = neighborhoodLabel(state.neighborhood);
          $('view-description').textContent = label + '에서 나만의 코스를 찾아보세요.';
        }
      });
      ['detail-area-tint','detail-area-names'].forEach(id => map.setLayoutProperty(id,'visibility','none'));
    }
  });
}

async function fetchJson(url) {
  const response = await fetch(url);
  if (!response.ok) throw new Error(`${url}: HTTP ${response.status}`);
  return response.json();
}
function rankModels() {
  regionModels.sort((a, b) => b.score - a.score);
  regionModels.forEach((item, index) => {
    item.rank = embedded ? null : index + 1;
  });
}
function selected() {
  return regionModels.find((item) => item.code === selectedCode) || regionModels[0];
}
function areaGeoJson() {
  return {
    type: "FeatureCollection",
    features: regionModels.map((item) => ({
      ...item.feature,
      id: item.code,
      properties: {
        code: item.code,
        name: item.name,
        score: item.score,
        heat: item.heat,
        rank: item.rank,
      },
    })),
  };
}
function pointsGeoJson() {
  return {
    type: "FeatureCollection",
    features: regionModels.map((item) => ({
      type: "Feature",
      properties: {
        code: item.code,
        name: item.name,
        rank: item.rank,
        scoreText: `${(item.score / 1000).toFixed(1)}K`,
      },
      geometry: { type: "Point", coordinates: item.center },
    })),
  };
}

function addAreaLayers() {
  map.addSource("detail-areas", { type: "geojson", data: areaGeoJson(), promoteId: "code" });
  map.addSource("detail-labels", { type: "geojson", data: pointsGeoJson() });
  const firstRoad = map
    .getStyle()
    .layers.find(
      (layer) => layer.type === "line" && layer["source-layer"] === "transportation",
    )?.id;
  map.addLayer(
    {
      id: "detail-area-tint",
      type: "fill",
      source: "detail-areas",
      paint: {
        "fill-color": [
          "interpolate",
          ["linear"],
          ["get", "heat"],
          20,
          "#64666a",
          65,
          "#855044",
          100,
          ORANGE,
        ],
      "fill-opacity": ["interpolate", ["linear"], ["zoom"], 13.9, 0, 15, 0.035, 17, 0.015],
      },
    },
    firstRoad,
  );
  map.addLayer({
    id: "detail-border-glow",
    type: "line",
    source: "detail-areas",
    paint: {
      "line-color": ORANGE,
      "line-width": ["interpolate", ["linear"], ["zoom"], 11, 4, 15, 6, 18, 8],
      "line-opacity": 0.15,
      "line-blur": 4,
    },
  });
  map.addLayer({
    id: "detail-borders",
    type: "line",
    source: "detail-areas",
    paint: {
      "line-color": ORANGE,
      "line-width": ["interpolate", ["linear"], ["zoom"], 11, 0.6, 13, 1, 16, 1.5, 19, 2],
      "line-opacity": 0.68,
    },
  });
  map.addLayer(
    {
      id: "detail-selected-fill",
      type: "fill",
      source: "detail-areas",
      filter: ["==", ["get", "code"], selectedCode],
      paint: { "fill-color": ORANGE, "fill-opacity": 0.045 },
    },
    firstRoad,
  );
  map.addLayer({
    id: "detail-selected-edge",
    type: "line",
    source: "detail-areas",
    filter: ["==", ["get", "code"], selectedCode],
    paint: {
      "line-color": "#ffad8a",
      "line-opacity": 0.95,
      "line-width": ["interpolate", ["linear"], ["zoom"], 11, 1.1, 15, 2, 19, 2.5],
    },
  });
  map.addLayer({
    id: "detail-area-names",
    type: "symbol",
    source: "detail-labels",
    minzoom: 14,
    maxzoom: 16.2,
    layout: {
      "text-field": embedded ? ["get", "name"] : ["concat", ["get", "name"], "\n", ["get", "scoreText"]],
      "text-font": ["Noto Sans Regular"],
      "text-size": ["interpolate", ["linear"], ["zoom"], 11, 10, 13, 12, 15, 16, 16.2, 18],
      "text-anchor": "top",
      "text-offset": [0, 1.2],
      "text-line-height": 1.3,
      "text-padding": 6,
      "text-allow-overlap": false,
    },
    paint: {
      "text-color": "#e5e2da",
      "text-halo-color": "#111216",
      "text-halo-width": 1.8,
      "text-opacity": 0.92,
    },
  });
}

function addRouteLayers() {
  map.addSource("detail-route-plan", { type: "geojson", data: route });
  map.addSource("detail-route-progress", { type: "geojson", data: EMPTY() });
  map.addSource("detail-route-start", {
    type: "geojson",
    data: EMPTY(),
  });
  map.addLayer({
    id: "run-plan",
    type: "line",
    source: "detail-route-plan",
    layout: { "line-cap": "round", "line-join": "round" },
    paint: {
      "line-color": "#878a8f",
      "line-width": ["interpolate", ["linear"], ["zoom"], 12, 1.2, 17, 2.3, 19, 3],
      "line-dasharray": [1, 3],
      "line-opacity": 0.48,
    },
  });
  map.addLayer({
    id: "run-glow",
    type: "line",
    source: "detail-route-progress",
    layout: { "line-cap": "round", "line-join": "round" },
    paint: {
      "line-color": ORANGE,
      "line-width": ["interpolate", ["linear"], ["zoom"], 12, 8, 17, 15, 19, 20],
      "line-blur": 8,
      "line-opacity": 0.36,
    },
  });
  map.addLayer({
    id: "run-shadow",
    type: "line",
    source: "detail-route-progress",
    layout: { "line-cap": "round", "line-join": "round" },
    paint: {
      "line-color": "#412118",
      "line-width": ["interpolate", ["linear"], ["zoom"], 12, 3.8, 17, 7.5, 19, 11],
      "line-opacity": 0.8,
    },
  });
  map.addLayer({
    id: "run-trail",
    type: "line",
    source: "detail-route-progress",
    layout: { "line-cap": "round", "line-join": "round" },
    paint: {
      "line-color": ORANGE,
      "line-width": ["interpolate", ["linear"], ["zoom"], 12, 2.3, 17, 4.8, 19, 7],
      "line-opacity": 1,
    },
  });
  map.addLayer({
    id: "run-highlight",
    type: "line",
    source: "detail-route-progress",
    layout: { "line-cap": "round", "line-join": "round" },
    paint: {
      "line-color": "#ffd0ab",
      "line-width": ["interpolate", ["linear"], ["zoom"], 12, 0.4, 17, 0.85, 19, 1.3],
      "line-opacity": 0.73,
    },
  });
  map.addLayer({
    id: "run-start",
    type: "circle",
    source: "detail-route-start",
    paint: {
      "circle-radius": 5,
      "circle-color": "#17181a",
      "circle-stroke-color": ORANGE,
      "circle-stroke-width": 2,
    },
  });
  const element = document.createElement("div");
  element.className = "runner-marker";
  element.innerHTML = "<span></span>";
  element.setAttribute("aria-label", "러닝 현재 위치");
  runner = new maplibregl.Marker({ element, anchor: "center" })
    .setLngLat([127.0319,37.661])
    .addTo(map);
}

function setView(nextView, immediate = false) {
  if (!ready || !VIEWS[nextView]) return;
  if (mode === "live" && nextView !== "run") {
    pendingView = nextView;
    openStopDialog();
    return;
  }
  planner?.toggle(false);
  mobileUI?.close();
  outlinePulse?.(null);
  if (nextView === "dobong") {
    setRegionalData(dobongRegions.features, SSANGMUN);
    rankAreaLabel = "도봉구";
  }
  view = nextView;
  if(view==='explore')areaPicked=false;
  if(view==='dobong')areaPicked=true;
  const config = VIEWS[view];
  document.body.dataset.view = view;
  document
    .querySelectorAll("[data-view].view-tabs button, .view-tabs button")
    .forEach((button) =>
      button.setAttribute(
        "aria-pressed",
        String(
          button.dataset.view === view || (view === "dobong" && button.dataset.view === "explore"),
        ),
      ),
    );
  const nextUrl = new URL(location.href); nextUrl.searchParams.set('view',view);
  history.replaceState({}, "", nextUrl);
  document.title = `GROOV · ${config.title}`;
  $("view-eyebrow").textContent = config.eyebrow;
  $("view-title").textContent = config.title;
  $("view-description").textContent = config.description;
  $("view-status").textContent = config.status;
  show("area-card", view !== "run");
  show("run-card", view === "run");
  show("heat-key", view !== "run");
  closeRanking();
  const areaVisible = view !== "run";
  map.setLayoutProperty("detail-area-names", "visibility", areaVisible ? "visible" : "none");
  map.setLayoutProperty("detail-area-tint", "visibility", areaVisible ? "visible" : "none");
  ["detail-borders", "detail-border-glow"].forEach((id) =>
    map.setFilter(id, areaVisible ? null : ["==", ["get", "code"], SSANGMUN]),
  );
  const runVisible = view === "run";
  ["detail-borders", "detail-border-glow"].forEach((id) =>
    map.setLayoutProperty(id, "visibility", "none"),
  );
  ["run-plan", "run-glow", "run-shadow", "run-trail", "run-highlight", "run-start"].forEach((id) =>
    map.setLayoutProperty(id, "visibility", runVisible && routeLength>0 ? "visible" : "none"),
  );
  runner.getElement().style.display = runVisible && (routeLength>0 || lastGpsCoordinate) ? "" : "none";
  setSelectedFilter();
  renderArea();
  renderLandmarks();
  const duration = immediate || REDUCED ? 0 : 1500;
  if (view === "explore")
    map.flyTo({ center: [127.6, 36.15], zoom: 6, ...orientation.camera(), duration });
  if (view === "dobong")
    map.fitBounds(collectionBounds(regions), {
      padding: cameraPadding(),
      ...orientation.camera(),
      duration,
      maxZoom: 13.2,
    });
  if (view === "run") {
    follow = true;
    $("route-follow").setAttribute("aria-pressed", "true");
    const coordinate =
      mode === "live" || mode === "stopped"
        ? lastGpsCoordinate || routeCoords[0] || map.getCenter()
        : sampleRoute(routeCoords, routeLength * progress).coordinate || map.getCenter();
    map.flyTo({
      center: coordinate,
      zoom: 17,
      ...orientation.camera(),
      padding: runPadding(),
      duration,
    });
    renderRun();
  } else playback = false;
  orientation.sync();
  updateZoom();
}

function setSelectedFilter() {
  ["detail-selected-fill", "detail-selected-edge"].forEach((id) =>
    map.setFilter(id, ["==", ["get", "code"], selectedCode]),
  );
  map.setPaintProperty(
    "detail-selected-fill",
    "fill-opacity",
    view === "run" ? 0 : ["interpolate", ["linear"], ["zoom"], 13.9, 0, 15, 0.045],
  );
  map.setPaintProperty("detail-selected-edge", "line-opacity", view === "run" ? 0 : DONG_FADE);
}

function renderLeague() {
  $("detail-ranking").querySelector("h2").textContent = rankAreaLabel + " 순위";
  $("detail-rank-toggle").querySelector("b").textContent = String(regionModels.length);
  const list = $("detail-rank-list");
  list.replaceChildren(
    ...regionModels.slice(0, 60).map((item) => {
      const li = document.createElement("li");
      li.classList.toggle("is-selected", item.code === selectedCode);
      const button = document.createElement("button");
      button.type = "button";
      button.setAttribute("aria-label", `${item.rank}위 ${item.name} 선택`);
      button.innerHTML = `<span>${String(item.rank).padStart(2, "0")}</span><b>${item.name}</b><strong>${item.score.toLocaleString("ko-KR")}</strong>`;
      button.addEventListener("click", () => selectArea(item.code, true));
      li.append(button);
      return li;
    }),
  );
  renderArea();
  renderLandmarks();
}

function renderArea() {
  if(!areaPicked&&view==='explore'){
    $("area-name").textContent="전국 탐색";
    $("area-caption").textContent="지역 현황";
    $("area-score").textContent="—";$("area-participation").textContent="—";$("area-rank").textContent="—";
    $("area-heat").textContent="지역 선택";
    $("area-focus").textContent="지역을 선택하세요";$("area-focus").disabled=true;$("area-ranking").disabled=true;
    return;
  }
  $("area-focus").disabled=false;$("area-ranking").disabled=false;
  const item = selected();
  if (!item) return;
  $("area-name").textContent = neighborhoodLabel({district:rankAreaLabel.split(" ").at(-1),neighborhood:item.name});
  $("area-caption").textContent = rankAreaLabel + " / SELECTED AREA";
  $("area-score").textContent = item.score.toLocaleString("ko-KR");
  $("area-participation").textContent = `${item.participation.toFixed(1)}%`;
  $("area-rank").textContent = `#${item.rank}`;
  $("area-heat").textContent = item.heat >= 82 ? "과열" : item.heat >= 62 ? "접전" : "안정";
  $("area-focus").textContent = "이 동 자세히 ↗";
}

function selectArea(code, camera = false, point = null) {
  if (!ready || view === "run" || planner?.active) return;
  selectedCode = code;
  areaPicked=true;
  setSelectedFilter();
  renderLeague();
  const item = selected();
  outlinePulse(item.feature);
  if (camera) {
    closeRanking();
    map.easeTo({
      center: item.center,
      zoom: Math.max(map.getZoom(), 13.3),
      padding: cameraPadding(),
      ...orientation.camera(),
      duration: REDUCED ? 0 : 1000,
    });
  }
}

function renderLandmarks() {
  /* Ranking lives in the panel, not over the streets. */
}

function updateLeague() {
  if (!ready || !rankLive || document.hidden || view === "run") return;
  tick++;
  const item = regionModels[(tick * 5) % regionModels.length];
  item.score += 410 + (tick % 7) * 180;
  item.participation = Math.min(98, item.participation + 0.1);
  rankModels();
  map.getSource("detail-areas").setData(areaGeoJson());
  map.getSource("detail-labels").setData(pointsGeoJson());
  renderLeague();
}

function bindMap() {
  map.on("zoom", updateZoom);

  map.on("dragstart", () => {
    follow = false;
    $("route-follow").setAttribute("aria-pressed", "false");
  });
  map.on("moveend", () => {
    document.body.dataset.zoom = map.getZoom().toFixed(2);
    document.body.dataset.center = `${map.getCenter().lng.toFixed(6)},${map.getCenter().lat.toFixed(6)}`;
  });
}

function bindControls() {
  $("area-ranking").addEventListener("click",()=>$("detail-rank-toggle").click());
  document
    .querySelectorAll(".view-tabs button[data-view]")
    .forEach((button) => button.addEventListener("click", () => setView(button.dataset.view)));
  $("detail-zoom-in").addEventListener("click", () => map?.zoomIn({ duration: REDUCED ? 0 : 350 }));
  $("detail-zoom-out").addEventListener("click", () =>
    map?.zoomOut({ duration: REDUCED ? 0 : 350 }),
  );
  $("route-follow").addEventListener("click", () => {
    if (!ready) return;
    if (mode !== "preview" && !lastGpsCoordinate) {
      toast("GPS 위치를 수신한 뒤 따라갈 수 있습니다.");
      return;
    }
    follow = !follow;
    $("route-follow").setAttribute("aria-pressed", String(follow));
    if (follow)
      map.easeTo({
        center: runner.getLngLat(),
        padding: runPadding(),
        duration: REDUCED ? 0 : 500,
      });
  });
  $("detail-rank-toggle").addEventListener("click", () => {
    if(mobileUI?.mobile){mobileUI.toggle('ranking');return;}
    planner?.toggle(false);
    const open = $("detail-ranking").hidden;
    show("detail-ranking", open);
    rankingHeat?.setEnabled(open);
    $("detail-rank-toggle").setAttribute("aria-expanded", String(open));
    $("area-ranking").setAttribute("aria-expanded", String(open));
  });
  $("detail-rank-close").addEventListener("click", closeRanking);
  $("league-live").addEventListener("click", () => {
    rankLive = !rankLive;
    $("league-live").setAttribute("aria-pressed", String(rankLive));
    $("league-live").textContent = rankLive ? "● LIVE" : "Ⅱ PAUSE";
  });
  $("area-focus").addEventListener("click", () => {
    if (!ready) return;
    map.fitBounds(selected().bounds, {
      padding: cameraPadding(),
      ...orientation.camera(),
      maxZoom: 15.5,
      duration: REDUCED ? 0 : 950,
    });
  });
  $("route-play").addEventListener("click", () => {
    if (!ready || mode === "live" || !routeLength) return;
    if (mode === "stopped") {
      mode = "preview";
      progress = 0.05;
      $("gps-accuracy").textContent = "실제 도로 기반";
      renderRun(true);
    }
    if (progress >= 1) progress = 0;
    playback = !playback;
    renderRun();
  });
  $("route-progress").addEventListener("input", () => {
    if (!ready || mode === "live" || !routeLength) return;
    playback = false;
    mode = "preview";
    progress = Number($("route-progress").value) / 1000;
    renderRun(true);
  });
  $("gps-start").addEventListener("click", startGps);
  $("gps-stop").addEventListener("click", openStopDialog);
  $("stop-dialog").addEventListener("close", () => {
    const nextView = pendingView;
    pendingView = null;
    if ($("stop-dialog").returnValue === "finish") {
      stopGps();
      if (nextView) setView(nextView);
    }
  });
  window.addEventListener("pagehide", () => {
    if (mode === "live") stopGps(false);
  });
}

function animate(time) {
  if (embedded) return;
  const dt = frameTime ? Math.min(0.2, (time - frameTime) / 1000) : 0;
  frameTime = time;
  if (ready && view === "run" && !document.hidden) {
    if (playback && mode === "preview") {
      progress = Math.min(1, progress + (dt * previewSpeed * 12) / routeLength);
      if (progress >= 1) playback = false;
    }
    if (time - renderTime > 100 && !planner?.active) {
      renderRun(false, playback);
      renderTime = time;
    }
  }
  requestAnimationFrame(animate);
}

function renderRun(recenter = false, moving = false) {
  if (!ready) return;
  const isGps = mode === "live" || mode === "stopped";
  let distance = 0,
    seconds = 0,
    coordinate = lastGpsCoordinate || routeCoords[0],
    bearing = 0;
  if (!isGps && routeLength>0) {
    const sample = sampleRoute(routeCoords, progress * routeLength);
    coordinate = sample.coordinate;
    bearing = sample.bearing;
    distance = progress * routeLength;
    seconds = distance / previewSpeed;
    const coords = sample.completedCoordinates;
    map
      .getSource("detail-route-progress")
      .setData(coords.length > 1 ? lineFeature(coords) : EMPTY());
    map.getSource("detail-route-start").setData(pointFeature(routeCoords[0]));
  } else if(isGps) {
    distance = gpsDistance;
    seconds = mode === "live" ? (performance.now() - gpsStart) / 1000 : gpsElapsed;
  }
  if (view === "run") {
    runner.getElement().style.display = !coordinate ? "none" : "";
    if(coordinate)runner.setLngLat(coordinate);
    runner.getElement().style.setProperty("--bearing", `${bearing - map.getBearing()}deg`);
    if (coordinate && follow && (recenter || moving))
      map.easeTo({
        center: coordinate,
        padding: runPadding(),
        duration: REDUCED ? 0 : 140,
        easing: (x) => x,
      });
  }
  map.setLayoutProperty("run-plan", "visibility", view === "run" && !isGps && routeLength>0 ? "visible" : "none");
  $("run-distance").textContent = (distance / 1000).toFixed(2);
  $("run-time").textContent = formatTime(seconds);
  $("run-pace").textContent =
    distance > 15 && seconds > 0 ? formatPace(seconds / (distance / 1000)) : "—:—";
  $("route-total").textContent = `${(routeLength / 1000).toFixed(2)} km`;
  $("route-progress").value = String(Math.round(progress * 1000));
  $("run-state").innerHTML =
    `<i></i>${mode === "live" ? "GPS 기록 중" : mode === "stopped" ? "GPS 기록 종료" : !routeLength ? "코스를 선택하거나 GPS 기록을 시작하세요" : playback ? "내 코스 재생 중" : progress >= 1 ? "내 코스 재생 완료" : "내 코스 미리보기"}`;
  $("route-play").textContent =
    mode === "live"
      ? "기록 중"
      : mode === "stopped"
        ? "가상 코스로 돌아가기"
        : playback
          ? "재생 일시정지"
          : progress >= 1
            ? "다시 재생"
            : "루트 재생";
  $("route-play").disabled = mode === "live" || !routeLength;
  show("gps-start", mode !== "live");
  show("gps-stop", mode === "live");
  show("demo-scrubber", !isGps && routeLength>0);
  $("run-card").classList.toggle("is-recording", mode === "live");
  document.body.dataset.routeMode = mode;
  document.body.dataset.routeProgress = progress.toFixed(4);
  $("view-status").textContent =
    view === "run"
      ? mode === "live"
        ? "이 기기의 GPS로 기록 중"
        : mode === "stopped"
          ? "GPS와 타이머가 중지되었습니다"
          : VIEWS.run.status
      : VIEWS[view].status;
}

function startGps() {
  if (embedded) return;
  if (!ready || mode === "live") return;
  if (!navigator.geolocation) {
    toast("이 브라우저에서는 GPS를 사용할 수 없습니다.");
    return;
  }
  playback = false;
  mode = "live";
  follow = true;
  gpsToken++;
  const token = gpsToken;
  map.setMaxBounds(null);
  gpsSegments = [];
  gpsDistance = 0;
  gpsPrevious = null;
  lastGpsCoordinate = null;
  gpsStart = performance.now();
  gpsElapsed = 0;
  map.getSource("detail-route-progress").setData(EMPTY());
  map.getSource("detail-route-start").setData(EMPTY());
  $("gps-accuracy").textContent = "GPS 위치 확인 중";
  $("route-follow").setAttribute("aria-pressed", "true");
  const localId = navigator.geolocation.watchPosition(
    (position) => {
      if (token !== gpsToken || mode !== "live") return;
      const fix = {
        longitude: position.coords.longitude,
        latitude: position.coords.latitude,
        accuracy: position.coords.accuracy,
        timestamp: position.timestamp,
      };
      const result = filterGpsFix(gpsPrevious, fix, { now: Date.now() });
      if (!result.accepted) {
        $("gps-accuracy").textContent =
          result.reason === "accuracy"
            ? `GPS 보정 대기 ±${Math.round(fix.accuracy)}m`
            : "GPS 좌표 확인 중";
        return;
      }
      gpsPrevious = result.fix || fix;
      lastGpsCoordinate = result.coordinate;
      if (!gpsSegments.length || result.breakSegment) gpsSegments.push([]);
      gpsSegments.at(-1).push(result.coordinate);
      gpsDistance += result.distanceMeters || 0;
      map.getSource("detail-route-progress").setData({
        type: "FeatureCollection",
        features: gpsSegments.filter((segment) => segment.length > 1).map(lineFeature),
      });
      map.getSource("detail-route-start").setData(pointFeature(gpsSegments[0][0]));
      $("gps-accuracy").textContent = `GPS ±${Math.round(fix.accuracy)}m`;
      runner.setLngLat(result.coordinate);
      if (follow && view === "run")
        map.easeTo({
          center: result.coordinate,
          padding: runPadding(),
          duration: REDUCED ? 0 : 750,
        });
    },
    (error) => {
      if (token !== gpsToken) return;
      if (gpsId !== null) navigator.geolocation.clearWatch(gpsId);
      gpsId = null;
      gpsToken++;
      mode = gpsDistance > 0 ? "stopped" : "preview";
      gpsElapsed = (performance.now() - gpsStart) / 1000;
      $("gps-accuracy").textContent = mode === "stopped" ? "GPS 수신 중단" : "실제 도로 기반";
      renderRun();
      const reason =
        error.code === 1 ? "위치 권한이 허용되지 않았습니다." : "GPS를 받지 못했습니다.";
      toast(
        `${reason} ${mode === "stopped" ? "수신한 경로를 유지하고 기록을 중지했습니다." : "예시 루트로 돌아갑니다."}`,
      );
    },
    { enableHighAccuracy: true, maximumAge: 0, timeout: 15000 },
  );
  gpsId = localId;
  renderRun();
}

function openStopDialog() {
  $("stop-dialog").returnValue = "";
  $("stop-dialog").showModal();
}
function stopGps(notify = true) {
  if (mode !== "live") return;
  if (gpsId !== null) navigator.geolocation.clearWatch(gpsId);
  gpsId = null;
  gpsToken++;
  gpsElapsed = (performance.now() - gpsStart) / 1000;
  mode = "stopped";
  playback = false;
  $("gps-accuracy").textContent = "GPS 수신 중지";
  renderRun();
  if (notify) toast("기록을 종료했습니다. GPS와 타이머가 멈췄습니다.");
}

function updateZoom() {
  if (!map) return;
  const scale = Math.max(0.62, Math.min(0.94, 0.68 + (map.getZoom() - 12) * 0.06));
  landmarkMarkers.forEach(({ marker }) => {
    marker.getElement().style.setProperty("--token-scale", scale.toFixed(2));
    marker.getElement().style.opacity = map.getZoom() > 15.5 ? "0" : "1";
    marker.getElement().style.pointerEvents = map.getZoom() > 15.5 ? "none" : "";
  });
}
function closeRanking() {
  if(mobileUI?.current==='ranking')mobileUI.close();
  show("detail-ranking", false);
  rankingHeat?.setEnabled(false);
  $("detail-rank-toggle").setAttribute("aria-expanded", "false");
  $("area-ranking").setAttribute("aria-expanded", "false");
}
function cameraPadding() {
  const mobile=detailHud.padding();if(mobile)return mobile;
  return innerWidth < 560
    ? { top: 170, bottom: 240, left: 25, right: 45 }
    : innerWidth < 1100
      ? { top: 135, bottom: 245, left: 50, right: 65 }
      : { top: 135, bottom: 170, left: 230, right: 90 };
}
function runPadding() {
  const mobile=detailHud.padding();if(mobile)return mobile;
  return innerWidth < 560
    ? { top: 120, bottom: 250, left: 0, right: 0 }
    : { top: 100, bottom: 170, left: innerWidth > 1100 ? 150 : 0, right: 0 };
}

function toast(message) {
  clearTimeout(toastTimer);
  $("detail-toast").textContent = message;
  $("detail-toast").classList.add("is-visible");
  toastTimer = setTimeout(() => $("detail-toast").classList.remove("is-visible"), 2700);
}
function lineFeature(coordinates) {
  return { type: "Feature", properties: {}, geometry: { type: "LineString", coordinates } };
}
function pointFeature(coordinates) {
  return { type: "Feature", properties: {}, geometry: { type: "Point", coordinates } };
}
function formatTime(seconds) {
  const total = Math.max(0, Math.floor(seconds));
  const h = Math.floor(total / 3600);
  return `${h ? `${String(h).padStart(2, "0")}:` : ""}${String(Math.floor(total / 60) % 60).padStart(2, "0")}:${String(total % 60).padStart(2, "0")}`;
}
function formatPace(seconds) {
  if (!Number.isFinite(seconds) || seconds > 5999) return "—:—";
  return `${Math.floor(seconds / 60)}:${String(Math.floor(seconds % 60)).padStart(2, "0")}`;
}
function flattenCoordinates(value) {
  return typeof value[0] === "number" ? [value] : value.flatMap(flattenCoordinates);
}
function geometryBounds(geometry) {
  return flattenCoordinates(geometry.coordinates).reduce(
    (bounds, coord) => [
      [Math.min(bounds[0][0], coord[0]), Math.min(bounds[0][1], coord[1])],
      [Math.max(bounds[1][0], coord[0]), Math.max(bounds[1][1], coord[1])],
    ],
    [
      [Infinity, Infinity],
      [-Infinity, -Infinity],
    ],
  );
}
function collectionBounds(collection) {
  return collection.features.reduce(
    (bounds, feature) => {
      const next = geometryBounds(feature.geometry);
      return [
        [Math.min(bounds[0][0], next[0][0]), Math.min(bounds[0][1], next[0][1])],
        [Math.max(bounds[1][0], next[1][0]), Math.max(bounds[1][1], next[1][1])],
      ];
    },
    [
      [Infinity, Infinity],
      [-Infinity, -Infinity],
    ],
  );
}
function interiorCenter(geometry) {
  const polygons = geometry.type === "Polygon" ? [geometry.coordinates] : geometry.coordinates;
  const ring = polygons.slice().sort((a, b) => b[0].length - a[0].length)[0][0];
  const bounds = geometryBounds({ type: "Polygon", coordinates: [ring] });
  const center = [(bounds[0][0] + bounds[1][0]) / 2, (bounds[0][1] + bounds[1][1]) / 2];
  if (pointInRing(center, ring)) return center;
  for (let y = 1; y < 10; y++)
    for (let x = 1; x < 10; x++) {
      const point = [
        bounds[0][0] + ((bounds[1][0] - bounds[0][0]) * x) / 10,
        bounds[0][1] + ((bounds[1][1] - bounds[0][1]) * y) / 10,
      ];
      if (pointInRing(point, ring)) return point;
    }
  return ring[0];
}
function pointInRing(point, ring) {
  let inside = false;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const a = ring[i],
      b = ring[j];
    if (
      a[1] > point[1] !== b[1] > point[1] &&
      point[0] < ((b[0] - a[0]) * (point[1] - a[1])) / (b[1] - a[1]) + a[0]
    )
      inside = !inside;
  }
  return inside;
}
function setRegionalData(features, code) {
  regions = { type: "FeatureCollection", features };
  regionModels = features.map((feature, index) => {
    const seed = Number(feature.properties.adm_cd2.slice(-5)) + index * 43;
    return {
      code: feature.properties.adm_cd2,
      name: feature.properties.adm_nm.split(" ").at(-1),
      score: embedded ? 0 : 55000 + (seed % 90000),
      participation: embedded ? 0 : 35 + (seed % 540) / 10,
      heat: embedded ? 0 : 28 + (seed % 68),
      center: interiorCenter(feature.geometry),
      bounds: geometryBounds(feature.geometry),
      feature,
    };
  });
  rankModels();
  selectedCode = code || regionModels[0]?.code;
  if (ready) {
    map.getSource("detail-areas").setData(areaGeoJson());
    map.getSource("detail-labels").setData(pointsGeoJson());
    setSelectedFilter();
    renderLeague();
  }
}
function acceptNationalSelection({ entry, feature, peers }) {
  if (planner?.active) return;
  if (mode === "live") {
    toast("GPS 기록을 먼저 종료해주세요.");
    return;
  }
  if (!peers.length) return;
  view = "explore";
  areaPicked=true;
  setRegionalData(peers, feature?.properties.adm_cd2);
  rankAreaLabel =
    feature?.properties.adm_nm.split(" ").slice(0, -1).join(" ") || entry.fullName || entry.name;
  document.body.dataset.view = view;
  const nextUrl = new URL(location.href); nextUrl.searchParams.set('view','explore');
  history.replaceState({}, "", nextUrl);
  document
    .querySelectorAll(".view-tabs button")
    .forEach((b) => b.setAttribute("aria-pressed", String(b.dataset.view === view)));
  $("view-title").textContent = feature ? neighborhoodLabel({district:rankAreaLabel.split(" ").at(-1),neighborhood:feature.properties.emd}) : entry.fullName || entry.name;
  document.title = `GROOV · ${$("view-title").textContent}`;
  $("view-eyebrow").textContent = "KOREA / NEIGHBORHOOD";
  $("view-description").textContent = rankAreaLabel;
  $("view-status").textContent = "14–15 배율부터 읍·면·동 경계";
  show("run-card", false);
  show("area-card", true);
  show("heat-key", true);
  map.setLayoutProperty("detail-area-names", "visibility", "visible");
  map.setLayoutProperty("detail-area-tint", "visibility", "visible");
  setSelectedFilter();
  closeRanking();
  runner.getElement().style.display = "none";
  ["run-plan", "run-glow", "run-shadow", "run-trail", "run-highlight", "run-start"].forEach((id) =>
    map.setLayoutProperty(id, "visibility", "none"),
  );
  renderLeague();
  outlinePulse(feature || null);
}
