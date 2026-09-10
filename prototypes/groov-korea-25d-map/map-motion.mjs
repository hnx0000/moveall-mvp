import { mountSavedPlaces } from './saved-places.mjs';
const reduced = () => globalThis.matchMedia?.("(prefers-reduced-motion: reduce)").matches;

export function mountOrientation(map, tiltButton, compassButton, defaultPitch = 48) {
  mountSavedPlaces(map, tiltButton.parentElement);
  let target = null;
  const camera = () => target || { pitch: map.getPitch(), bearing: map.getBearing() };
  const sync = () => {
    const state = camera();
    const tilted = state.pitch > 1;
    if(!tiltButton.querySelector?.('svg'))tiltButton.textContent = tilted ? "평면" : "2.5D";
    tiltButton.setAttribute("aria-label", tilted ? "평면으로 전환" : "2.5D로 전환");
    tiltButton.title=tilted ? "평면으로 전환" : "2.5D로 전환";
    tiltButton.setAttribute("aria-pressed", String(tilted));
    if (compassButton) compassButton.style.setProperty("--north-angle", `${-map.getBearing()}deg`);
    document.body.dataset.pitch = map.getPitch().toFixed(2);
    document.body.dataset.bearing = map.getBearing().toFixed(2);
  };
  const turn = (next) => {
    map.stop();
    target = next;
    sync();
    map.easeTo({ ...next, duration: reduced() ? 0 : 650 });
  };
  let holdTimer, holding = false, held = false, startY = 0, startPitch = 0;
  tiltButton.style.touchAction = 'none';
  tiltButton.addEventListener('pointerdown', event => {
    held = false; startY = event.clientY; startPitch = map.getPitch();
    tiltButton.setPointerCapture?.(event.pointerId);
    holdTimer = setTimeout(() => { holding = true; held = true; map.stop(); target = null; }, 380);
  });
  tiltButton.addEventListener('pointermove', event => {
    if (!holding) return;
    map.jumpTo({ pitch: Math.max(0, Math.min(65, startPitch + (startY - event.clientY) * .5)) });
  });
  const release = () => { clearTimeout(holdTimer); holding = false; };
  tiltButton.addEventListener('pointerup', release);
  tiltButton.addEventListener('pointercancel', release);
  tiltButton.addEventListener('lostpointercapture', release);
  tiltButton.addEventListener('contextmenu', event => event.preventDefault());
  tiltButton.addEventListener("click", () => {
    if (held) { held = false; return; }
    turn({ ...camera(), pitch: camera().pitch > 1 ? 0 : defaultPitch });
  });
  tiltButton.setAttribute('aria-description', '누르면 2.5D 전환, 길게 누른 채 위아래로 움직이면 각도 조절');
  compassButton?.addEventListener("click", () => turn({ ...camera(), bearing: 0 }));
  map.on("movestart", (event) => {
    if (event.originalEvent) target = null;
  });
  map.on("moveend", () => {
    target = null;
    sync();
  });
  map.on("pitch", sync);
  map.on("rotate", sync);
  sync();
  return { camera, sync };
}

// A geographic pulse, not a screen-centred circle. Multipolygons and holes are retained.
export function mountBoundaryPulse(map, prefix = "selection-impact") {
  const empty = { type: "FeatureCollection", features: [] };
  map.addSource(prefix, { type: "geojson", data: empty });
  map.addLayer({id:`${prefix}-shadow`,type:'fill',source:prefix,paint:{'fill-color':'#080909','fill-opacity':.24,'fill-translate':[0,3],'fill-translate-anchor':'viewport'}});
  map.addLayer({id:`${prefix}-lift`,type:'fill-extrusion',source:prefix,paint:{'fill-extrusion-color':'#ff8058','fill-extrusion-opacity':.32,'fill-extrusion-height':0,'fill-extrusion-base':0,'fill-extrusion-vertical-gradient':false}});
  map.addLayer({
    id: `${prefix}-wave`,
    type: "line",
    source: prefix,
    layout:{'line-join':'round','line-cap':'round'},
    paint: { "line-color": "#ff5733", "line-width": 1, "line-opacity": 0, "line-blur": 2 },
  });
  map.addLayer({
    id: `${prefix}-edge`,
    type: "line",
    source: prefix,
    layout:{'line-join':'round','line-cap':'round'},
    paint: { "line-color": "#ffb092", "line-width": 1, "line-opacity": 0 },
  });
  let frame;
  const height=()=>Math.max(1,Math.min(4000,156543.03392*Math.cos((map.getCenter?.().lat||37)*Math.PI/180)/2**map.getZoom()*4));
  let selected=false;
  const syncLift=()=>{if(selected){map.setPaintProperty(`${prefix}-lift`,'fill-extrusion-height',height());map.setPaintProperty(`${prefix}-lift`,'fill-extrusion-base',height()*.65);}};
  map.on('zoomend',syncLift);
  return (feature) => {
    cancelAnimationFrame(frame);
    if (!feature?.geometry) {
      selected=false;
      map.getSource(prefix).setData(empty);
      return;
    }
    map.getSource(prefix).setData(feature);
    selected=true;
    if (reduced()) {
      syncLift();
      map.setPaintProperty(`${prefix}-wave`,'line-opacity',0);
      map.setPaintProperty(`${prefix}-edge`,'line-opacity',0);
      return;
    }
    const start = performance.now();
    const step = (now) => {
      const t = Math.min(1, (now - start) / 760);
      const attack = Math.min(1, t / 0.12);
      const rise=1-(1-t)**3;
      map.setPaintProperty(`${prefix}-lift`,'fill-extrusion-height',height()*rise);
      map.setPaintProperty(`${prefix}-lift`,'fill-extrusion-base',height()*.65*rise);
      map.setPaintProperty(`${prefix}-wave`, "line-width", 1 + (map.getZoom()<7?5:10) * rise);
      map.setPaintProperty(`${prefix}-wave`, "line-opacity", 0.55 * attack * (1 - t) ** 2);
      map.setPaintProperty(`${prefix}-wave`, "line-blur", 1 + 3 * t);
      map.setPaintProperty(`${prefix}-edge`, "line-width", 1 + 3 * Math.sin(Math.PI * t));
      map.setPaintProperty(`${prefix}-edge`, "line-opacity", attack * (1 - t));
      if (t < 1) frame = requestAnimationFrame(step);
    };
    frame = requestAnimationFrame(step);
  };
}

export const DONG_FADE = [
  "interpolate",
  ["linear"],
  ["zoom"],
  13.9,
  0,
  14.4,
  0.23,
  15,
  0.72,
  19,
  0.82,
];
export const SCORE_HEIGHT = [
  "interpolate",
  ["linear"],
  ["zoom"],
  4,
  ["interpolate", ["linear"], ["get", "score"], 250000, 35, 1000000, 320],
  10,
  ["interpolate", ["linear"], ["get", "score"], 250000, 5, 1000000, 45],
  14,
  0,
];
